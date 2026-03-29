'use strict';

const { MongoClient, ObjectId } = require('mongodb');

/**
 * MongoService — Complete MongoDB data layer for FloatChat-AI.
 *
 * Collections:
 *   profiles      — 87K+ ARGO core profiles with measurements[]
 *   bgc_profiles  — 13K+ BGC profiles
 *   floats        — 567 aggregated float summaries
 *   chat_sessions — user chat sessions
 *   chat_messages — messages within sessions
 *   users         — user accounts
 */
class MongoService {
  constructor(uri, dbName) {
    this.uri = uri;
    this.dbName = dbName;
    this.client = null;
    this.db = null;
  }

  // ─── Connection ──────────────────────────────────────────────────────

  async connect() {
    if (this.db) return;
    this.client = new MongoClient(this.uri);
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    console.log(`✅ MongoDB connected: ${this.dbName}`);
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  // ─── Chat Sessions ──────────────────────────────────────────────────

  async createSession(userId, title = 'New Chat') {
    const doc = {
      userId,
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await this.db.collection('chat_sessions').insertOne(doc);
    return { _id: result.insertedId, id: result.insertedId, ...doc };
  }

  async getSessions(userId) {
    return this.db
      .collection('chat_sessions')
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
  }

  async getMessages(sessionId) {
    const oid = this._toObjectId(sessionId);
    if (!oid) return [];
    return this.db
      .collection('chat_messages')
      .find({ sessionId: oid })
      .sort({ timestamp: 1 })
      .toArray();
  }

  async deleteSession(sessionId) {
    const oid = this._toObjectId(sessionId);
    if (!oid) return;
    await Promise.all([
      this.db.collection('chat_sessions').deleteOne({ _id: oid }),
      this.db.collection('chat_messages').deleteMany({ sessionId: oid }),
    ]);
  }

  async saveMessage(sessionId, type, content, code = null) {
    const oid = this._toObjectId(sessionId);
    if (!oid) return;
    const doc = {
      sessionId: oid,
      type,
      content,
      hasCode: !!code,
      code: code || null,
      timestamp: new Date(),
    };
    await this.db.collection('chat_messages').insertOne(doc);
    await this.db
      .collection('chat_sessions')
      .updateOne({ _id: oid }, { $set: { updatedAt: new Date() } });
  }

  // ─── Float Queries ──────────────────────────────────────────────────

  async getFloat(platformNumber) {
    return this.db
      .collection('floats')
      .findOne({ platform_number: String(platformNumber) });
  }

  async getAllFloats(limit = 500) {
    return this.db
      .collection('floats')
      .find({})
      .sort({ platform_number: 1 })
      .limit(limit)
      .toArray();
  }

  async queryFloat(platformNumber, cycle = null) {
    const filter = { platform_number: String(platformNumber) };
    if (cycle != null) filter.cycle_number = parseInt(cycle);
    return this.db
      .collection('profiles')
      .find(filter, { projection: { measurements: 0 } })
      .sort({ cycle_number: 1 })
      .limit(200)
      .toArray();
  }

  // ─── Geo & Region Queries ───────────────────────────────────────────

  async nearestFloats(lat, lon, radiusKm = 300, limit = 20) {
    return this.db
      .collection('profiles')
      .find({
        geo_location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [lon, lat] },
            $maxDistance: radiusKm * 1000,
          },
        },
      })
      .project({ measurements: 0 })
      .limit(limit)
      .toArray();
  }

  async profilesByRegion(latMin, latMax, lonMin, lonMax, limit = 200) {
    return this.db
      .collection('profiles')
      .find({
        latitude: { $gte: latMin, $lte: latMax },
        longitude: { $gte: lonMin, $lte: lonMax },
      })
      .project({ measurements: 0 })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  // ─── Date / Profile Queries ─────────────────────────────────────────

  async profilesByDate(dateStart, dateEnd, bbox = null) {
    const filter = {
      timestamp: {
        $gte: new Date(dateStart),
        $lte: new Date(dateEnd),
      },
    };
    if (bbox) {
      if (bbox.lat_min != null) filter.latitude = { $gte: +bbox.lat_min, $lte: +bbox.lat_max };
      if (bbox.lon_min != null) filter.longitude = { $gte: +bbox.lon_min, $lte: +bbox.lon_max };
    }
    return this.db
      .collection('profiles')
      .find(filter)
      .project({ measurements: 0 })
      .sort({ timestamp: -1 })
      .limit(500)
      .toArray();
  }

  async getProfile(profileId) {
    return this.db.collection('profiles').findOne({ _id: profileId });
  }

  // ─── BGC Profile Queries ─────────────────────────────────────────────

  async queryBgcProfiles(platformNumber, cycle = null) {
    const filter = { platform_number: String(platformNumber) };
    if (cycle != null) filter.cycle_number = parseInt(cycle);
    return this.db
      .collection('bgc_profiles')
      .find(filter, { projection: { measurements: 0 } })
      .sort({ cycle_number: 1 })
      .limit(200)
      .toArray();
  }

  async bgcProfilesByRegion(latMin, latMax, lonMin, lonMax, limit = 200) {
    return this.db
      .collection('bgc_profiles')
      .find({
        latitude: { $gte: latMin, $lte: latMax },
        longitude: { $gte: lonMin, $lte: lonMax },
      })
      .project({ measurements: 0 })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  // ─── Measurements / Trajectory / Depth-Time ─────────────────────────

  /**
   * Determine which collection to query based on the parameter.
   * BGC params (DOXY, CHLA, BBP700, NITRATE, PH) are in bgc_profiles.
   * Core params (TEMP, PSAL, PRES) are in profiles (and also in bgc_profiles).
   */
  _isBgcParam(param) {
    const bgcParams = ['doxy', 'chla', 'bbp700', 'nitrate', 'ph', 'cdom', 'bbp532'];
    return bgcParams.includes(param.toLowerCase());
  }

  _getCollection(param) {
    return this._isBgcParam(param) ? 'bgc_profiles' : 'profiles';
  }

  async getProfileMeasurements(platformsOrIds, param = 'TEMP') {
    const platforms = Array.isArray(platformsOrIds) ? platformsOrIds : [platformsOrIds];
    const paramKey = param.toLowerCase();
    const collectionName = this._getCollection(param);
    const results = [];

    for (const pn of platforms) {
      const profiles = await this.db
        .collection(collectionName)
        .find({ platform_number: String(pn) })
        .sort({ cycle_number: -1 })
        .limit(10)
        .toArray();

      for (const p of profiles) {
        const data = (p.measurements || [])
          .filter((m) => m[paramKey] != null && m.pres != null)
          .map((m) => ({ pres: m.pres, value: m[paramKey] }));

        if (data.length > 0) {
          results.push({
            profile_id: p._id,
            platform_number: p.platform_number,
            cycle_number: p.cycle_number,
            latitude: p.latitude,
            longitude: p.longitude,
            timestamp: p.timestamp,
            data,
          });
        }
      }
    }
    return results;
  }

  /**
   * Get paired T-S (temp + salinity) measurements from the same profiles.
   * Returns data points where BOTH temp and psal exist at the same pressure level.
   */
  async getPairedMeasurements(platformsOrIds, params = ['temp', 'psal']) {
    const platforms = Array.isArray(platformsOrIds) ? platformsOrIds : [platformsOrIds];
    const results = [];

    for (const pn of platforms) {
      const profiles = await this.db
        .collection('profiles')
        .find({ platform_number: String(pn) })
        .sort({ cycle_number: -1 })
        .limit(10)
        .toArray();

      for (const p of profiles) {
        const data = (p.measurements || [])
          .filter((m) => {
            // All requested params must be present, plus pressure
            return m.pres != null && params.every(key => m[key] != null);
          })
          .map((m) => {
            const point = { pres: m.pres };
            for (const key of params) {
              point[key] = m[key];
            }
            return point;
          });

        if (data.length > 0) {
          results.push({
            profile_id: p._id,
            platform_number: p.platform_number,
            cycle_number: p.cycle_number,
            latitude: p.latitude,
            longitude: p.longitude,
            timestamp: p.timestamp,
            data,
          });
        }
      }
    }
    return results;
  }

  async getTrajectory(platformNumber) {
    return this.db
      .collection('profiles')
      .find(
        { platform_number: String(platformNumber) },
        { projection: { latitude: 1, longitude: 1, cycle_number: 1, timestamp: 1 } }
      )
      .sort({ cycle_number: 1 })
      .toArray();
  }

  async getDepthTimeData(platformNumber, param = 'TEMP') {
    const paramKey = param.toLowerCase();
    const collectionName = this._getCollection(param);
    const profiles = await this.db
      .collection(collectionName)
      .find({ platform_number: String(platformNumber) })
      .sort({ cycle_number: 1 })
      .limit(50)
      .toArray();

    return profiles
      .map((p) => {
        const data = (p.measurements || [])
          .filter((m) => m[paramKey] != null && m.pres != null)
          .map((m) => ({ pres: m.pres, value: m[paramKey] }));
        return {
          cycle: p.cycle_number,
          timestamp: p.timestamp,
          data,
        };
      })
      .filter((d) => d.data.length > 0);
  }

  // ─── Analytics ──────────────────────────────────────────────────────

  async parameterStats(profileIds, param = 'PSAL') {
    const paramKey = param.toLowerCase();
    const collectionName = this._getCollection(param);
    const ids = Array.isArray(profileIds) ? profileIds : [profileIds];
    if (ids.length === 0) return { mean: null, std: null, min: null, max: null, count: 0 };

    const pipeline = [
      { $match: { _id: { $in: ids } } },
      { $unwind: '$measurements' },
      { $match: { [`measurements.${paramKey}`]: { $ne: null } } },
      {
        $group: {
          _id: null,
          mean: { $avg: `$measurements.${paramKey}` },
          min: { $min: `$measurements.${paramKey}` },
          max: { $max: `$measurements.${paramKey}` },
          count: { $sum: 1 },
          values: { $push: `$measurements.${paramKey}` },
        },
      },
    ];

    const result = await this.db.collection(collectionName).aggregate(pipeline).toArray();
    if (!result.length) return { mean: null, std: null, min: null, max: null, count: 0 };

    const r = result[0];
    // Calculate std dev
    const vals = (r.values || []).filter((v) => v != null);
    let std = 0;
    if (vals.length > 1) {
      const mean = r.mean || 0;
      const variance = vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (vals.length - 1);
      std = Math.sqrt(variance);
    }

    return { mean: r.mean, std, min: r.min, max: r.max, count: r.count };
  }

  async compareRegions(region1, region2, param = 'PSAL', limit = 100) {
    const fetchRegion = async (r) => {
      const profiles = await this.profilesByRegion(
        r.lat_min, r.lat_max, r.lon_min, r.lon_max, limit
      );
      const ids = profiles.map((p) => p._id);
      const stats = await this.parameterStats(ids, param);
      return { count: profiles.length, stats };
    };

    const [r1, r2] = await Promise.all([fetchRegion(region1), fetchRegion(region2)]);
    return { region1: r1, region2: r2 };
  }

  async timeSeriesStats(platformNumber, param = 'TEMP', cycles = null) {
    const paramKey = param.toLowerCase();
    const collectionName = this._getCollection(param);
    const filter = { platform_number: String(platformNumber) };
    if (cycles && cycles.length === 2) {
      filter.cycle_number = { $gte: cycles[0], $lte: cycles[1] };
    }

    const profiles = await this.db
      .collection(collectionName)
      .find(filter)
      .sort({ cycle_number: 1 })
      .limit(200)
      .toArray();

    return profiles.map((p) => {
      const vals = (p.measurements || [])
        .map((m) => m[paramKey])
        .filter((v) => v != null);
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      const min = vals.length ? Math.min(...vals) : null;
      const max = vals.length ? Math.max(...vals) : null;

      return {
        cycle: p.cycle_number,
        timestamp: p.timestamp,
        mean,
        min,
        max,
        count: vals.length,
      };
    });
  }

  async getStats() {
    const [profileCount, floatCount, bgcCount] = await Promise.all([
      this.db.collection('profiles').countDocuments(),
      this.db.collection('floats').countDocuments(),
      this.db.collection('bgc_profiles').countDocuments(),
    ]);

    // BGC coverage
    const bgcFloats = await this.db.collection('floats').countDocuments({ has_bgc: true });

    return {
      total_profiles: profileCount,
      activeFloats: floatCount,
      total_bgc_profiles: bgcCount,
      bgcCoverage: floatCount > 0 ? `${((bgcFloats / floatCount) * 100).toFixed(1)}%` : '0%',
    };
  }

  // ─── Export ─────────────────────────────────────────────────────────

  async exportCsv(profileIds, params = ['PRES', 'TEMP', 'PSAL']) {
    const ids = Array.isArray(profileIds) ? profileIds : [profileIds];
    const profiles = await this.db
      .collection('profiles')
      .find({ _id: { $in: ids } })
      .toArray();

    const header = ['profile_id', 'platform_number', 'cycle', 'lat', 'lon', 'timestamp', ...params];
    const lines = [header.join(',')];

    for (const p of profiles) {
      for (const m of p.measurements || []) {
        const row = [
          p._id,
          p.platform_number,
          p.cycle_number,
          p.latitude?.toFixed(4),
          p.longitude?.toFixed(4),
          p.timestamp ? new Date(p.timestamp).toISOString() : '',
          ...params.map((k) => m[k.toLowerCase()] ?? ''),
        ];
        lines.push(row.join(','));
      }
    }
    return lines.join('\n');
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  _toObjectId(id) {
    if (!id) return null;
    try {
      return ObjectId.isValid(id) ? new ObjectId(id) : id;
    } catch {
      return id;
    }
  }
}

module.exports = MongoService;
