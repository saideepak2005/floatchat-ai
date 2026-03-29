'use strict';

/**
 * McpService — Complete MCP Tool Registry for FloatChat-AI.
 *
 * ARCHITECTURE: Every tool returns a typed output envelope:
 *   { tool, type, ...payload }
 *
 * TYPES (what the Chat UI renders):
 *   "plotly"          → <Plot data layout />
 *   "leaflet"         → <MapContainer markers polyline />
 *   "metadata_card"   → <MetadataCard />
 *   "data_table"      → <InlineTable rows cols />
 *   "stats_card"      → <StatsCard mean std min max />
 *   "data"            → raw data (text answer is enough)
 *   "text"            → plain text response
 *   "export_csv"      → downloadable CSV
 *
 * TOOL REGISTRY (20+ tools):
 * ── Data Retrieval ─────────────────────────────────────────
 *   query_float, nearest_floats, get_nearest_floats,
 *   profiles_by_date, search_profiles, profiles_by_region,
 *   search_bgc_profiles, get_float_info, get_profile_data,
 *   aggregate_statistics, get_dataset_metadata
 * ── Analytics ──────────────────────────────────────────────
 *   parameter_stats, compare_regions, time_series_stats
 * ── Visualization ──────────────────────────────────────────
 *   visualize_ts_diagram, visualize_depth_profile,
 *   visualize_time_series, visualize_trajectory,
 *   visualize_float_map, visualize_bar_chart,
 *   visualize_comparison_bar, visualize_heatmap,
 *   visualize_multi_panel
 * ── UI Cards ───────────────────────────────────────────────
 *   get_metadata_card, get_data_table, get_stats_card
 */

class McpService {
  constructor(mongoService) {
    this.mongo = mongoService;
  }

  // ─── Public dispatch ─────────────────────────────────────────────────

  async runTool(toolName, params = {}) {
    try {
      switch (toolName) {
        // ═══════════════════════════════════════════
        // DATA RETRIEVAL TOOLS
        // ═══════════════════════════════════════════

        case 'query_float':
          return {
            tool: toolName, type: 'data',
            data: await this.mongo.queryFloat(params.platform, params.cycle || null),
          };

        case 'nearest_floats':
        case 'get_nearest_floats':
          return {
            tool: toolName, type: 'data',
            data: await this.mongo.nearestFloats(
              +params.lat, +params.lon,
              +(params.radius_km || 300), +(params.limit || 20)),
          };

        case 'profiles_by_date':
        case 'search_profiles':
          return {
            tool: toolName, type: 'data',
            data: await this.mongo.profilesByDate(
              params.date_start, params.date_end, params.bbox || null),
          };

        case 'profiles_by_region':
          return {
            tool: toolName, type: 'data',
            data: await this.mongo.profilesByRegion(
              +params.lat_min, +params.lat_max,
              +params.lon_min, +params.lon_max,
              +(params.limit || 200)),
          };

        case 'search_bgc_profiles':
          return {
            tool: toolName, type: 'data',
            data: await this.mongo.bgcProfilesByRegion(
              +(params.lat_min || -90), +(params.lat_max || 90),
              +(params.lon_min || -180), +(params.lon_max || 180),
              +(params.limit || 100)),
          };

        case 'get_float_info':
          return {
            tool: toolName, type: 'data',
            data: await this.mongo.getFloat(params.platform),
          };

        case 'get_profile_data':
          return {
            tool: toolName, type: 'data',
            data: await this.mongo.getProfile(params.profile_id),
          };

        case 'aggregate_statistics':
        case 'get_dataset_metadata':
          return {
            tool: toolName, type: 'data',
            data: await this.mongo.getStats(),
          };

        case 'get_float_profiles': {
          // Alias for query_float — returns all profiles for a float
          return {
            tool: toolName, type: 'data',
            data: await this.mongo.queryFloat(params.platform, params.cycle || null),
          };
        }

        case 'get_recent_profiles': {
          // Return most recent profiles, optionally BGC-only
          const collName = params.include_bgc ? 'bgc_profiles' : 'profiles';
          const recentProfiles = await this.mongo.db.collection(collName)
            .find({})
            .project({ measurements: 0 })
            .sort({ timestamp: -1 })
            .limit(+(params.limit || 20))
            .toArray();
          return { tool: toolName, type: 'data', data: recentProfiles };
        }

        case 'find_profiles_by_depth_range': {
          const minDepth = +(params.min_depth || 0);
          const maxDepth = +(params.max_depth || 2000);
          const depthProfiles = await this.mongo.db.collection('profiles')
            .find({ max_pres: { $gte: minDepth, $lte: maxDepth } })
            .project({ measurements: 0 })
            .sort({ max_pres: -1 })
            .limit(+(params.limit || 50))
            .toArray();
          return { tool: toolName, type: 'data', data: depthProfiles };
        }

        case 'get_profile_summary_stats': {
          const profId = params.profile_id;
          const prof = await this.mongo.db.collection('profiles').findOne(
            profId ? { _id: profId } : { platform_number: String(params.platform) }
          );
          if (!prof || !prof.measurements) return { tool: toolName, type: 'data', data: null };
          const summaryParams = ['temp', 'psal', 'pres'];
          const summary = {};
          for (const p of summaryParams) {
            const vals = prof.measurements.map(m => m[p]).filter(v => v != null);
            if (vals.length) {
              summary[p] = {
                mean: vals.reduce((a,b) => a+b,0) / vals.length,
                min: Math.min(...vals),
                max: Math.max(...vals),
                count: vals.length,
              };
            }
          }
          return { tool: toolName, type: 'data', data: summary };
        }

        case 'find_anomalous_profiles': {
          const anomParam = (params.param || 'TEMP').toLowerCase();
          const anomMinD = +(params.min_depth || 0);
          const anomMaxD = +(params.max_depth || 100);
          // Get global stats first
          const allProfs = await this.mongo.db.collection('profiles')
            .find({})
            .project({ platform_number: 1, cycle_number: 1, measurements: 1 })
            .limit(500)
            .toArray();
          const allVals = [];
          for (const p of allProfs) {
            for (const m of (p.measurements || [])) {
              if (m.pres >= anomMinD && m.pres <= anomMaxD && m[anomParam] != null) {
                allVals.push(m[anomParam]);
              }
            }
          }
          const globalMean = allVals.length ? allVals.reduce((a,b) => a+b,0) / allVals.length : 0;
          const globalStd = allVals.length > 1
            ? Math.sqrt(allVals.reduce((a,v) => a + (v-globalMean)**2, 0) / (allVals.length-1))
            : 1;
          const threshold = +(params.threshold || 2);
          const anomalous = allProfs.filter(p => {
            const vals = (p.measurements || [])
              .filter(m => m.pres >= anomMinD && m.pres <= anomMaxD && m[anomParam] != null)
              .map(m => m[anomParam]);
            if (!vals.length) return false;
            const mean = vals.reduce((a,b) => a+b,0) / vals.length;
            return Math.abs(mean - globalMean) > threshold * globalStd;
          }).map(p => ({ platform_number: p.platform_number, cycle_number: p.cycle_number }));
          return { tool: toolName, type: 'data', data: anomalous };
        }

        case 'find_profiles_missing_data': {
          const missingParam = (params.param || 'DOXY').toLowerCase();
          const missingProfs = await this.mongo.db.collection(this.mongo._isBgcParam(missingParam.toUpperCase()) ? 'bgc_profiles' : 'profiles')
            .find({})
            .project({ platform_number: 1, cycle_number: 1, measurements: 1 })
            .limit(200)
            .toArray();
          const missing = missingProfs.filter(p => {
            const total = (p.measurements || []).length;
            const present = (p.measurements || []).filter(m => m[missingParam] != null).length;
            return total > 0 && (present / total) < 0.5;
          }).map(p => ({
            platform_number: p.platform_number,
            cycle_number: p.cycle_number,
            missing_pct: ((1 - (p.measurements || []).filter(m => m[missingParam] != null).length / (p.measurements || []).length) * 100).toFixed(1) + '%',
          }));
          return { tool: toolName, type: 'data', data: missing };
        }

        case 'get_vertical_gradient': {
          const gradParam = (params.param || 'TEMP').toLowerCase();
          const gradProfile = await this.mongo.db.collection('profiles').findOne(
            params.profile_id ? { _id: params.profile_id } : { platform_number: String(params.platform) }
          );
          if (!gradProfile || !gradProfile.measurements) return { tool: toolName, type: 'data', data: null };
          const sorted = gradProfile.measurements
            .filter(m => m.pres != null && m[gradParam] != null)
            .sort((a,b) => a.pres - b.pres);
          const gradients = [];
          for (let i = 1; i < sorted.length; i++) {
            const dp = sorted[i].pres - sorted[i-1].pres;
            const dv = sorted[i][gradParam] - sorted[i-1][gradParam];
            gradients.push({
              depth_mid: (sorted[i].pres + sorted[i-1].pres) / 2,
              gradient: dp > 0 ? dv / dp : 0,
            });
          }
          // Find thermocline (max gradient)
          const maxGrad = gradients.reduce((best, g) =>
            Math.abs(g.gradient) > Math.abs(best.gradient) ? g : best, gradients[0] || { depth_mid: 0, gradient: 0 });
          return {
            tool: toolName, type: 'data',
            data: { gradients, thermocline_depth: maxGrad.depth_mid, max_gradient: maxGrad.gradient },
          };
        }

        case 'get_multi_profile_data': {
          const multiIds = params.profile_ids || [];
          const multiResult = [];
          for (const pid of multiIds.slice(0, 10)) {
            const doc = await this.mongo.db.collection('profiles').findOne({ _id: pid });
            if (doc) multiResult.push(doc);
          }
          return { tool: toolName, type: 'data', data: multiResult };
        }

        case 'auto_visualize':
        case 'resolve_query_intent': {
          // These are orchestration tools — return a suggestion
          return {
            tool: toolName, type: 'text',
            data: `Based on your query, I'd recommend using one of these tools: visualize_depth_profile (for depth charts), visualize_ts_diagram (for T-S analysis), visualize_trajectory (for float tracks), or visualize_comparison_bar (for regional comparisons).`,
          };
        }

        case 'greeting':
          return {
            tool: toolName, type: 'text',
            data: "Hello! I am FloatChat-AI. Try asking me:\n• 'Show me a T-S diagram near Mumbai'\n• 'Heatmap for float 2902277'\n• 'What is the salinity in the Arabian Sea?'"
          };

        case 'generic_chat':
          return { tool: toolName, type: 'text', data: null };

        // ═══════════════════════════════════════════
        // ANALYTICS TOOLS
        // ═══════════════════════════════════════════

        case 'parameter_stats': {
          const stats = await this.mongo.parameterStats(
            params.profiles || [], params.param || 'PSAL');
          return { tool: toolName, type: 'data', data: stats };
        }

        case 'compare_regions': {
          const cmp = await this.mongo.compareRegions(
            params.region1, params.region2,
            params.param || 'PSAL', params.limit || 100);
          return { tool: toolName, type: 'data', data: cmp };
        }

        case 'time_series_stats': {
          const ts = await this.mongo.timeSeriesStats(
            params.platform, params.param || 'TEMP', params.cycles || null);
          return { tool: toolName, type: 'data', data: ts };
        }

        // ═══════════════════════════════════════════
        // VISUALIZATION TOOLS
        // ═══════════════════════════════════════════

        case 'visualize_ts_diagram': {
          const profiles = await this._resolveProfiles(params);
          // Use paired measurements to get temp+psal from the SAME measurement rows
          const pairedData = await this.mongo.getPairedMeasurements(profiles, ['temp', 'psal']);

          const traces = pairedData.map((p) => {
            const psals = p.data.map(d => d.psal);
            const temps = p.data.map(d => d.temp);
            return {
              x: psals, y: temps,
              mode: 'markers', type: 'scatter',
              name: `${p.platform_number} C${p.cycle_number}`,
              marker: { size: 5, opacity: 0.75 },
              text: p.data.map(d => `Depth: ${Math.abs(d.pres || 0).toFixed(0)} m`),
            };
          }).filter(t => t.x.length > 0);

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: traces,
              layout: {
                title: { text: 'Temperature–Salinity (T-S) Diagram', font: { size: 14 } },
                xaxis: { title: 'Salinity (PSU)' },
                yaxis: { title: 'Temperature (°C)' },
                legend: { orientation: 'h', y: -0.25 },
                hovermode: 'closest',
              },
            },
          };
        }

        case 'visualize_depth_profile':
        case 'plot_profiles':
        case 'compare_profiles_depth':
        case 'visualize_profile_depth_plot': {
          const param = (params.param || 'TEMP').toUpperCase();
          const platforms = Array.isArray(params.platforms)
            ? params.platforms
            : (params.platform ? [params.platform] : []);
          const profiles = platforms.length ? platforms : await this._resolveProfiles(params);
          const data = await this.mongo.getProfileMeasurements(profiles, param);

          const axisLabel = {
            TEMP: 'Temperature (°C)', PSAL: 'Salinity (PSU)',
            PRES: 'Pressure (dbar)', DOXY: 'Dissolved Oxygen (µmol/kg)',
            CHLA: 'Chlorophyll-a (mg/m³)', NITRATE: 'Nitrate (µmol/kg)',
          };

          const traces = data.map(p => ({
            x: p.data.map(d => d.value),
            y: p.data.map(d => -(d.pres || 0)),
            mode: 'lines+markers', type: 'scatter',
            name: `${p.platform_number} C${p.cycle_number}`,
            line: { width: 2 }, marker: { size: 4 },
          })).filter(t => t.x.length > 0);

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: traces,
              layout: {
                title: { text: `${param} Depth Profile`, font: { size: 14 } },
                xaxis: { title: axisLabel[param] || param },
                yaxis: { title: 'Depth (m)', autorange: true },
                legend: { orientation: 'h', y: -0.25 },
                hovermode: 'closest',
              },
            },
          };
        }

        case 'visualize_time_series':
        case 'depth_time_plot': {
          const param = (params.param || 'TEMP').toUpperCase();
          const series = await this.mongo.timeSeriesStats(
            params.platform, param, params.cycles || null);

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: [{
                x: series.map(s => s.timestamp || `C${s.cycle}`),
                y: series.map(s => s.mean),
                error_y: {
                  type: 'data',
                  array: series.map(s => s.max != null && s.min != null ? (s.max - s.min) / 2 : 0),
                  visible: true, color: '#94a3b8',
                },
                mode: 'lines+markers', type: 'scatter',
                name: `${params.platform} — ${param}`,
                line: { color: '#0ea5e9', width: 2 },
                marker: { size: 5 },
                hovertemplate: 'Cycle %{x}<br>Mean: %{y:.3f}<extra></extra>',
              }],
              layout: {
                title: { text: `${param} — Cycle Time Series (Platform ${params.platform})`, font: { size: 14 } },
                xaxis: { title: 'Cycle / Date', type: 'date' },
                yaxis: { title: `Mean ${param}` },
              },
            },
          };
        }

        case 'visualize_trajectory':
        case 'trajectory_map':
        case 'visualize_float_trajectory': {
          const points = await this.mongo.getTrajectory(params.platform);
          return {
            tool: toolName, type: 'leaflet',
            center: points.length
              ? [points[Math.floor(points.length / 2)].latitude, points[Math.floor(points.length / 2)].longitude]
              : [10, 70],
            zoom: 5,
            polyline: points.map(p => [p.latitude, p.longitude]),
            markers: points.map(p => ({
              lat: p.latitude, lon: p.longitude,
              popup: `Platform ${params.platform} — Cycle ${p.cycle_number}<br>${p.timestamp ? new Date(p.timestamp).toLocaleDateString() : ''}`,
            })),
          };
        }

        case 'visualize_float_map':
        case 'map_marker_display': {
          const mapProfiles = await this.mongo.profilesByRegion(
            +(params.lat_min || -60), +(params.lat_max || 30),
            +(params.lon_min || 20), +(params.lon_max || 120),
            +(params.limit || 200));

          return {
            tool: toolName, type: 'leaflet',
            center: [10, 75], zoom: 4,
            polyline: null,
            markers: mapProfiles
              .filter(p => p.latitude != null && p.longitude != null)
              .map(p => ({
                lat: p.latitude, lon: p.longitude,
                popup: `Platform ${p.platform_number} — Cycle ${p.cycle_number}`,
              })),
          };
        }

        case 'visualize_bar_chart': {
          const param = (params.param || 'PSAL').toUpperCase();
          const platforms = Array.isArray(params.platforms) ? params.platforms : [];
          const seriesList = await Promise.all(
            platforms.map(p => this.mongo.timeSeriesStats(p, param, null)));

          const means = seriesList.map(s => {
            const vals = s.map(c => c.mean).filter(v => v != null);
            return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4) : 0;
          });

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: [{
                x: platforms, y: means, type: 'bar',
                marker: { color: '#06b6d4', opacity: 0.85 },
                text: means.map(v => v.toFixed(3)),
                textposition: 'auto',
              }],
              layout: {
                title: { text: `Mean ${param} per Float Platform`, font: { size: 14 } },
                xaxis: { title: 'Platform Number', tickangle: -30 },
                yaxis: { title: `Mean ${param}` },
                bargap: 0.3,
              },
            },
          };
        }

        case 'visualize_comparison_bar': {
          const param = (params.param || 'PSAL').toUpperCase();
          const result = await this.mongo.compareRegions(
            params.region1, params.region2, param, params.limit || 100);

          const r1 = result.region1.stats;
          const r2 = result.region2.stats;

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: [
                {
                  x: ['Mean', 'Std Dev', 'Min', 'Max'],
                  y: [r1.mean, r1.std, r1.min, r1.max],
                  name: 'Region 1', type: 'bar',
                  marker: { color: '#0ea5e9' },
                },
                {
                  x: ['Mean', 'Std Dev', 'Min', 'Max'],
                  y: [r2.mean, r2.std, r2.min, r2.max],
                  name: 'Region 2', type: 'bar',
                  marker: { color: '#f97316' },
                },
              ],
              layout: {
                title: { text: `${param} — Region Comparison`, font: { size: 14 } },
                barmode: 'group',
                xaxis: { title: 'Statistic' },
                yaxis: { title: param },
                legend: { orientation: 'h', y: -0.3 },
              },
            },
            summary: result,
          };
        }

        case 'visualize_heatmap': {
          const param = (params.param || 'TEMP').toUpperCase();
          const depthData = await this.mongo.getDepthTimeData(params.platform, param);

          if (!depthData.length) return { tool: toolName, type: 'data', data: [] };

          const allPres = [...new Set(
            depthData.flatMap(d => d.data.map(v => Math.round(v.pres)))
          )].sort((a, b) => a - b);

          const cycles = depthData.map(d => `C${d.cycle}`);
          const zMatrix = allPres.map(pres =>
            depthData.map(d => {
              const match = d.data.find(v => Math.abs(v.pres - pres) < 10);
              return match ? match.value : null;
            })
          );

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: [{
                z: zMatrix, x: cycles, y: allPres.map(p => -p),
                type: 'heatmap',
                colorscale: param === 'TEMP' ? 'RdBu' : 'Viridis',
                reversescale: param === 'TEMP',
                colorbar: { title: param },
                hoverongaps: false,
              }],
              layout: {
                title: { text: `${param} Heatmap — Platform ${params.platform}`, font: { size: 14 } },
                xaxis: { title: 'Cycle' },
                yaxis: { title: 'Depth (m)', autorange: true },
              },
            },
          };
        }

        case 'visualize_multi_panel': {
          const panelParams = Array.isArray(params.params)
            ? params.params.map(p => p.toUpperCase())
            : ['TEMP', 'PSAL', 'PRES'];

          const platform = params.platform || (Array.isArray(params.platforms) ? params.platforms[0] : null);
          if (!platform) return { tool: toolName, type: 'data', data: null };

          const allData = await Promise.all(
            panelParams.map(p => this.mongo.timeSeriesStats(platform, p, null)));

          const colors = ['#0ea5e9', '#f97316', '#10b981', '#a855f7', '#ef4444'];

          const traces = allData.map((series, i) => ({
            x: series.map(s => s.timestamp || `C${s.cycle}`),
            y: series.map(s => s.mean),
            mode: 'lines+markers', type: 'scatter',
            name: panelParams[i],
            line: { color: colors[i % colors.length], width: 2 },
            marker: { size: 4 },
            xaxis: `x${i > 0 ? i + 1 : ''}`,
            yaxis: `y${i > 0 ? i + 1 : ''}`,
          }));

          const n = panelParams.length;
          const step = 1 / n;
          const layout = {
            title: { text: `Multi-Parameter View — Platform ${platform}`, font: { size: 14 } },
            showlegend: true,
            legend: { orientation: 'h', y: -0.15 },
          };
          panelParams.forEach((p, i) => {
            const key = i === 0 ? '' : (i + 1).toString();
            const bottom = 1 - (i + 1) * step;
            const top = 1 - i * step;
            layout[`xaxis${key}`] = { domain: [0, 1], anchor: `y${key}`, showticklabels: i === n - 1 };
            layout[`yaxis${key}`] = { domain: [bottom + 0.02, top - 0.02], anchor: `x${key}`, title: p };
          });

          return { tool: toolName, type: 'plotly', plotly: { data: traces, layout } };
        }

        // ═══════════════════════════════════════════
        // UI CARD TOOLS
        // ═══════════════════════════════════════════

        case 'get_metadata_card': {
          const float = await this.mongo.getFloat(params.platform);
          return {
            tool: toolName, type: 'metadata_card',
            data: float || { error: `Float ${params.platform} not found` },
          };
        }

        case 'get_data_table': {
          let rows;
          if (params.date_start || params.date_end) {
            const tableProfiles = await this.mongo.profilesByDate(
              params.date_start || '2000-01-01',
              params.date_end || '2030-01-01',
              params
            );
            rows = tableProfiles.map(p => {
              const row = {
                platform_number: p.platform_number,
                cycle_number: p.cycle_number,
                date: p.timestamp ? new Date(p.timestamp).toLocaleDateString() : '—',
                latitude: p.latitude?.toFixed(4),
                longitude: p.longitude?.toFixed(4),
              };
              return row;
            });
          } else if (params.platform && params.platform !== '00000' && params.platform !== 'null') {
            const tableProfiles = await this.mongo.queryFloat(params.platform, null);
            rows = tableProfiles.map(p => ({
              platform_number: p.platform_number,
              cycle_number: p.cycle_number,
              latitude: p.latitude?.toFixed(4),
              longitude: p.longitude?.toFixed(4),
              timestamp: p.timestamp ? new Date(p.timestamp).toLocaleDateString() : '—',
              max_pres: p.max_pres,
            }));
          } else {
            const floats = await this.mongo.getAllFloats(50);
            rows = floats.map(f => ({
              platform_number: f.platform_number,
              total_cycles: f.total_cycles,
              has_bgc: f.has_bgc ? 'Yes' : 'No',
              data_centre: f.data_centre,
              first_date: f.first_date ? new Date(f.first_date).toLocaleDateString() : '—',
              last_date: f.last_date ? new Date(f.last_date).toLocaleDateString() : '—',
            }));
          }
          return {
            tool: toolName, type: 'data_table',
            columns: rows.length ? Object.keys(rows[0]) : [],
            rows,
          };
        }

        case 'get_stats_card': {
          const param = (params.param || 'PSAL').toUpperCase();
          let profileIds = params.profiles || [];
          if (!profileIds.length && params.platform) {
            // For BGC params, query bgc_profiles collection
            const isBgc = this.mongo._isBgcParam(param);
            const docs = isBgc
              ? await this.mongo.queryBgcProfiles(params.platform, null)
              : await this.mongo.queryFloat(params.platform, null);
            profileIds = docs.map(d => d._id);
          }
          const stats = await this.mongo.parameterStats(profileIds, param);
          return {
            tool: toolName, type: 'stats_card',
            param, platform: params.platform || null,
            data: stats,
          };
        }

        case 'export_csv': {
          const csv = await this.mongo.exportCsv(
            params.profiles || [], params.params || ['PRES', 'TEMP', 'PSAL']);
          return { tool: toolName, type: 'export_csv', csv };
        }

        default:
          return { tool: toolName, type: 'data', error: `Unknown tool: ${toolName}`, data: null };
      }
    } catch (err) {
      console.error(`[MCP] "${toolName}" failed:`, err.message);
      return { tool: toolName, type: 'data', error: err.message, data: null };
    }
  }

  // ─── OpenAI Tool Schemas (for function calling) ──────────────────────

  /**
   * Returns OpenAI-compatible tool schemas for native function calling.
   * These are passed to GPT-4o-mini via the `tools` parameter.
   */
  getToolSchemas() {
    return [
      // ── Data Retrieval ──────────────────────────────────
      {
        type: 'function',
        function: {
          name: 'get_float_info',
          description: 'Get all technical metadata, cycles, BGC capabilities, date range, and location bounds for a specific ARGO float. Use when user asks about a float by its platform number or ID. Also use for "how many profiles does float X have".',
          parameters: {
            type: 'object',
            properties: {
              platform: { type: 'string', description: 'The 7-digit platform number / float ID (e.g. "2902277", "1900121")' },
            },
            required: ['platform'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_float_profiles',
          description: 'Retrieve all profile records (cycles) for a specific float platform. Returns metadata like lat, lon, timestamp, cycle for each profile. Use for "list profiles for float X", "list all profile IDs for float X".',
          parameters: {
            type: 'object',
            properties: {
              platform: { type: 'string', description: 'Platform number / float ID' },
              cycle: { type: 'number', description: 'Optional specific cycle number' },
            },
            required: ['platform'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'nearest_floats',
          description: 'Find ARGO float profiles near a geographical location. Use when user asks about floats near a city, coordinates, or ocean region such as "find floats operating near 15N 80E" or "what floats are within 300km of the equator".',
          parameters: {
            type: 'object',
            properties: {
              lat: { type: 'number', description: 'Latitude' },
              lon: { type: 'number', description: 'Longitude' },
              radius_km: { type: 'number', description: 'Search radius in km (default 300)' },
              limit: { type: 'number', description: 'Max results (default 20)' },
            },
            required: ['lat', 'lon'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_profiles',
          description: 'Search for ARGO profiles by date range and optionally by bounding box. Also used for semantic/natural language profile search like "find profiles in the Arabian Sea". Use for queries like "profiles in January 2024" or "measurements between March and June 2023".',
          parameters: {
            type: 'object',
            properties: {
              date_start: { type: 'string', description: 'Start date YYYY-MM-DD. For a single day, set both date_start and date_end to the same value.' },
              date_end: { type: 'string', description: 'End date YYYY-MM-DD' },
              lat_min: { type: 'number', description: 'Optional bounding box south latitude' },
              lat_max: { type: 'number', description: 'Optional bounding box north latitude' },
              lon_min: { type: 'number', description: 'Optional bounding box west longitude' },
              lon_max: { type: 'number', description: 'Optional bounding box east longitude' },
            },
            required: ['date_start', 'date_end'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_bgc_profiles',
          description: 'Search for BGC (biogeochemical) profiles, optionally in a bounding box. Use for queries about dissolved oxygen, chlorophyll-a, nitrate, or any BGC parameter. Also use for "find BGC profiles that measure chlorophyll-a" or "search for profiles related to dissolved oxygen".',
          parameters: {
            type: 'object',
            properties: {
              lat_min: { type: 'number', description: 'South latitude bound (default -90)' },
              lat_max: { type: 'number', description: 'North latitude bound (default 90)' },
              lon_min: { type: 'number', description: 'West longitude bound (default -180)' },
              lon_max: { type: 'number', description: 'East longitude bound (default 180)' },
              limit: { type: 'number', description: 'Max results (default 100)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'profiles_by_region',
          description: 'Get ARGO profiles within a geographic bounding box. Use for area-based queries like "profiles in the Arabian Sea" or "floats between 10°N-20°N and 70°E-80°E".',
          parameters: {
            type: 'object',
            properties: {
              lat_min: { type: 'number', description: 'South latitude bound' },
              lat_max: { type: 'number', description: 'North latitude bound' },
              lon_min: { type: 'number', description: 'West longitude bound' },
              lon_max: { type: 'number', description: 'East longitude bound' },
              limit: { type: 'number', description: 'Max results (default 200)' },
            },
            required: ['lat_min', 'lat_max', 'lon_min', 'lon_max'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_dataset_metadata',
          description: 'Get overall dataset statistics: total floats, profiles, BGC coverage. Use when user asks "how many floats", "how many profiles", "what data do you have", or general dataset overview questions.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_profile_data',
          description: 'Get the full measurement data (temperature, salinity, pressure at all depth levels) for a specific profile ID. Use for "get the full temperature and salinity profile for profile 1900121_001" or "show me quality-controlled adjusted measurements".',
          parameters: {
            type: 'object',
            properties: {
              profile_id: { type: 'string', description: 'Profile ID (e.g. "1900121_001" or "2900765_001_BGC")' },
              use_adjusted: { type: 'boolean', description: 'Whether to prefer adjusted values (default false)' },
            },
            required: ['profile_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_recent_profiles',
          description: 'Get the most recent profiles in the database, sorted by date. Use for "show me the most recent profiles" or "what are the latest BGC profiles".',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of recent profiles to return (default 20)' },
              include_bgc: { type: 'boolean', description: 'If true, return only BGC profiles (default false)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'aggregate_statistics',
          description: 'Get aggregate statistics (mean, std, min, max) for a parameter across a depth range. Use for "average temperature between 0 and 200 meters" or "salinity statistics for the upper 500 meters".',
          parameters: {
            type: 'object',
            properties: {
              param: { type: 'string', enum: ['TEMP', 'PSAL', 'DOXY', 'CHLA', 'NITRATE', 'PRES'], description: 'Parameter to compute stats for' },
              min_depth: { type: 'number', description: 'Minimum depth in meters (default 0)' },
              max_depth: { type: 'number', description: 'Maximum depth in meters (default 2000)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_profile_summary_stats',
          description: 'Calculate summary statistics (mean, min, max, count) for temperature and salinity within a single profile. Use for "calculate summary statistics for profile 1900121_001".',
          parameters: {
            type: 'object',
            properties: {
              profile_id: { type: 'string', description: 'Profile ID' },
              platform: { type: 'string', description: 'Platform number (alternative to profile_id)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'find_anomalous_profiles',
          description: 'Find profiles with anomalous parameter values in a depth range. Use for "find profiles with anomalous temperature values in the surface layer (0-100m)".',
          parameters: {
            type: 'object',
            properties: {
              param: { type: 'string', enum: ['TEMP', 'PSAL', 'DOXY'], description: 'Parameter to check for anomalies (default TEMP)' },
              min_depth: { type: 'number', description: 'Min depth (default 0)' },
              max_depth: { type: 'number', description: 'Max depth (default 100)' },
              threshold: { type: 'number', description: 'Number of standard deviations for anomaly (default 2)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'find_profiles_by_depth_range',
          description: 'Find profiles that reach depths within a certain range. Use for "find profiles that reach depths deeper than 1800 meters".',
          parameters: {
            type: 'object',
            properties: {
              min_depth: { type: 'number', description: 'Minimum max-depth of profiles (default 0)' },
              max_depth: { type: 'number', description: 'Maximum max-depth of profiles (default 2000)' },
              limit: { type: 'number', description: 'Max results (default 50)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'find_profiles_missing_data',
          description: 'Find profiles with significant missing data for a given parameter. Use for "are there any profiles with significant missing dissolved oxygen data".',
          parameters: {
            type: 'object',
            properties: {
              param: { type: 'string', enum: ['TEMP', 'PSAL', 'DOXY', 'CHLA', 'NITRATE'], description: 'Parameter to check (default DOXY)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_vertical_gradient',
          description: 'Calculate the vertical gradient of a parameter in a profile, useful for identifying the thermocline. Use for "what is the vertical temperature gradient in profile X" or "where is the thermocline".',
          parameters: {
            type: 'object',
            properties: {
              profile_id: { type: 'string', description: 'Profile ID' },
              platform: { type: 'string', description: 'Platform number (alternative)' },
              param: { type: 'string', enum: ['TEMP', 'PSAL', 'DOXY'], description: 'Parameter (default TEMP)' },
            },
          },
        },
      },

      // ── Visualization ───────────────────────────────────
      {
        type: 'function',
        function: {
          name: 'visualize_ts_diagram',
          description: 'Generate an interactive Temperature-Salinity (T-S) scatter plot. Use when user asks for "T-S diagram", "temperature vs salinity", or water mass analysis. Can compare multiple profiles.',
          parameters: {
            type: 'object',
            properties: {
              platform: { type: 'string', description: 'Specific float platform number' },
              platforms: { type: 'array', items: { type: 'string' }, description: 'Multiple platforms for comparison' },
              lat_min: { type: 'number' }, lat_max: { type: 'number' },
              lon_min: { type: 'number' }, lon_max: { type: 'number' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'visualize_depth_profile',
          description: 'Generate a depth profile chart showing a parameter vs depth/pressure. Use for "temperature profile", "plot the temperature depth profile", "salinity at depth", "DOXY depth plot", "create a depth plot showing both temperature and salinity", or any parameter vs depth visualization.',
          parameters: {
            type: 'object',
            properties: {
              platform: { type: 'string', description: 'Float platform number' },
              platforms: { type: 'array', items: { type: 'string' }, description: 'Multiple platform numbers for comparison' },
              param: {
                type: 'string',
                enum: ['TEMP', 'PSAL', 'DOXY', 'CHLA', 'NITRATE', 'PRES'],
                description: 'Parameter to plot (default: TEMP)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'visualize_time_series',
          description: 'Generate a time series chart of a parameter across cycles for a specific float. Use for "temperature over time for float X", "salinity trends", "plot temperature changes over time at 10 meters depth".',
          parameters: {
            type: 'object',
            properties: {
              platform: { type: 'string', description: 'Float platform number' },
              param: { type: 'string', enum: ['TEMP', 'PSAL', 'DOXY', 'CHLA', 'NITRATE'], description: 'Parameter (default: TEMP)' },
              depth: { type: 'number', description: 'Specific depth in meters for fixed-depth time series' },
            },
            required: ['platform'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'visualize_trajectory',
          description: 'Show the trajectory/path of a float on an interactive map. Use when user asks "show trajectory", "track float", "where did float X go", "float path", "show me the trajectory of float X on a map".',
          parameters: {
            type: 'object',
            properties: {
              platform: { type: 'string', description: 'Float platform number' },
            },
            required: ['platform'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'visualize_float_map',
          description: 'Show a geographical map with markers of ARGO float positions in a region. Use for "show floats on map", "map of Arabian Sea floats", "where are the floats", "show me where profiles are on a map".',
          parameters: {
            type: 'object',
            properties: {
              lat_min: { type: 'number' }, lat_max: { type: 'number' },
              lon_min: { type: 'number' }, lon_max: { type: 'number' },
              date_start: { type: 'string', description: 'Optional start date YYYY-MM-DD' },
              date_end: { type: 'string', description: 'Optional end date YYYY-MM-DD' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'visualize_heatmap',
          description: 'Generate a heatmap visualization showing parameter values across depth and cycles. Use for "heatmap of temperature", "depth-cycle heatmap", "geographic heatmap of average temperature".',
          parameters: {
            type: 'object',
            properties: {
              platform: { type: 'string', description: 'Platform ID' },
              param: { type: 'string', description: 'Parameter like TEMP or PSAL' },
            },
            required: ['platform', 'param'],
          },
        },
      },

      // ── UI Cards ────────────────────────────────────────
      {
        type: 'function',
        function: {
          name: 'get_metadata_card',
          description: 'Show a detailed metadata card for a specific float with all its technical info, PI name, project, BGC capabilities, date range, and location. Use for "tell me about float X", "tell me everything about float X", "float X metadata", "info on float X".',
          parameters: {
            type: 'object',
            properties: {
              platform: { type: 'string', description: 'Platform number' },
            },
            required: ['platform'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_data_table',
          description: 'Retrieve ARGO float data in a structured table format. Use for "show data table", "list all floats", "tabular data for float X", "show profiles between dates".',
          parameters: {
            type: 'object',
            properties: {
              platform: { type: 'string', description: 'Specific platform float ID' },
              date_start: { type: 'string', description: 'Start date YYYY-MM-DD' },
              date_end: { type: 'string', description: 'End date YYYY-MM-DD' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_stats_card',
          description: 'Show statistical summary (mean, std, min, max) for a parameter of a specific float. Use for "statistics of temperature for float X", "salinity stats", "give me salinity statistics".',
          parameters: {
            type: 'object',
            properties: {
              platform: { type: 'string', description: 'Platform number' },
              param: { type: 'string', enum: ['TEMP', 'PSAL', 'DOXY', 'CHLA', 'NITRATE', 'PRES'], description: 'Parameter (default: PSAL)' },
            },
            required: ['platform'],
          },
        },
      },
    ];
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  async _resolveProfiles(params) {
    if (Array.isArray(params.platforms) && params.platforms.length)
      return params.platforms.map(String);
    if (params.platform) return [String(params.platform)];

    const bbox = params.bbox || this._indianOceanBbox();
    const docs = await this.mongo.profilesByRegion(
      bbox.lat_min, bbox.lat_max, bbox.lon_min, bbox.lon_max, 20);
    return docs.map(d => d.platform_number).filter(Boolean);
  }

  _indianOceanBbox() {
    return { lat_min: -60, lat_max: 30, lon_min: 20, lon_max: 120 };
  }
}

module.exports = McpService;
