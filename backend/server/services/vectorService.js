'use strict';

const { ChromaClient } = require('chromadb');
const path = require('path');

/**
 * VectorService — ChromaDB semantic search bridge.
 *
 * Connects to the local ChromaDB persistent store and queries
 * argo_profiles, argo_bgc_profiles, and argo_floats collections.
 *
 * Uses the chromadb npm package directly — no Python subprocess needed.
 */
class VectorService {
  constructor(chromaPersistDir = null) {
    this.persistDir = chromaPersistDir || path.resolve(__dirname, '../../..', 'chroma_data');
    this.client = null;
    this.collections = {};
    this.status = 'disconnected'; // 'connected', 'disconnected', 'unavailable'
  }

  async connect() {
    try {
      // Connect to ChromaDB — use HTTP client if a server is running
      this.client = new ChromaClient({ path: 'http://localhost:8000' });

      // Try to heartbeat — if it fails, ChromaDB server isn't running
      try {
        await this.client.heartbeat();
        console.log('✅ VectorService connected to ChromaDB server at http://localhost:8000');
        this.status = 'connected';
      } catch {
        // ChromaDB server not running
        console.log('⚠️  ChromaDB server not available at http://localhost:8000');
        console.log('   → Vector/semantic search will be unavailable. MongoDB-only mode active.');
        console.log('   → To enable: pip install chromadb && chroma run --path ./chroma_data');
        this.client = null;
        this.status = 'unavailable';
        return;
      }

      // Load all three collections
      const collectionNames = ['argo_profiles', 'argo_bgc_profiles', 'argo_floats'];
      for (const name of collectionNames) {
        try {
          this.collections[name] = await this.client.getCollection({ name });
          const count = await this.collections[name].count();
          console.log(`   📊 Collection "${name}": ${count} documents`);
        } catch (e) {
          console.warn(`   ⚠️  Collection "${name}" not found: ${e.message}`);
        }
      }
    } catch (e) {
      console.warn('⚠️  VectorService initialization failed:', e.message);
      console.log('   Vector search will be unavailable. System will use MongoDB only.');
      this.client = null;
      this.status = 'unavailable';
    }
  }

  /**
   * Search across all collections for the query.
   * Returns an array of results sorted by relevance (lowest distance first).
   *
   * @param {string} query - Natural language query
   * @param {number} nResults - Max results per collection
   * @param {string} collection - 'all', 'profiles', 'bgc_profiles', 'floats'
   * @returns {Array<{id, document, metadata, distance, collection}>}
   */
  async search(query, nResults = 10, collection = 'all') {
    if (!this.client) return [];

    const results = [];
    const targetCollections =
      collection === 'all'
        ? ['argo_profiles', 'argo_bgc_profiles', 'argo_floats']
        : [`argo_${collection}`];

    for (const name of targetCollections) {
      const col = this.collections[name];
      if (!col) continue;

      try {
        const count = await col.count();
        if (count === 0) continue;

        const res = await col.query({
          queryTexts: [query],
          nResults: Math.min(nResults, count),
        });

        if (res && res.ids && res.ids[0]) {
          for (let i = 0; i < res.ids[0].length; i++) {
            results.push({
              id: res.ids[0][i],
              document: res.documents?.[0]?.[i] || null,
              metadata: res.metadatas?.[0]?.[i] || null,
              distance: res.distances?.[0]?.[i] || null,
              collection: name.replace('argo_', ''),
            });
          }
        }
      } catch (e) {
        console.warn(`[VectorService] Error querying ${name}:`, e.message);
      }
    }

    // Sort by distance (lower = more similar for cosine)
    results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

    // Rerank: filter results with distance above threshold
    const RERANK_THRESHOLD = 1.3; // cosine distance, lower is better (0 = identical)
    const reranked = results.filter((r) => r.distance != null && r.distance < RERANK_THRESHOLD);

    return reranked.length > 0 ? reranked.slice(0, nResults * 3) : results.slice(0, nResults);
  }

  /**
   * Extract platform IDs from vector search results.
   */
  extractPlatformIds(results) {
    const ids = new Set();
    for (const r of results) {
      // Metadata may contain platform_number
      if (r.metadata?.platform_number) {
        ids.add(String(r.metadata.platform_number));
      }
      // ID format might be "platformNumber_cycleNumber"
      const match = r.id?.match(/^(\d{5,8})_/);
      if (match) ids.add(match[1]);
    }
    return [...ids];
  }

  /**
   * Get stats for all collections.
   */
  async getStats() {
    if (!this.client) return { status: this.status };

    const stats = { status: this.status };
    for (const [name, col] of Object.entries(this.collections)) {
      try {
        stats[name] = await col.count();
      } catch {
        stats[name] = 0;
      }
    }
    return stats;
  }
}

module.exports = VectorService;
