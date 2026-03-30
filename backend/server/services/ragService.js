"use strict";

const OpenAI = require("openai");

/**
 * RagService — Hybrid RAG + MCP pipeline using Qwen3.5-397B via OpenRouter.
 *
 * Architecture (from HLD/LLD):
 *   1. Query ingestion → normalize, sanitize
 *   2. LLM Query Router → function calling classifies intent
 *      - structured → MongoDB (MCP tools)
 *      - semantic   → VectorDB (ChromaDB)
 *      - hybrid     → Both in parallel
 *   3. Data store execution → parallel MCP + Vector fetch
 *   4. Reranking → filter vector results by distance
 *   5. LLM Result Combiner → merge, deduplicate, ground reasoning
 *   6. Visualization decision → detect viz keywords, call viz MCP tool
 *   7. Final output → text + visual embed + source metadata
 *
 * KEY FEATURES:
 *   - Conversation context maintained via chat history from MongoDB
 *   - Elaborate, scientifically grounded responses
 *   - OpenAI-compatible API via OpenRouter
 *   - Smart fallback when LLM is unavailable
 */
class RagService {
  constructor(vectorService, mongoService, mcpService, config) {
    this.vectorService = vectorService;
    this.mongoService = mongoService;
    this.mcpService = mcpService;
    this.config = config;

    // Initialize OpenAI-compatible client (works with OpenRouter, OpenAI, etc.)
    this.llm = null;
    const apiKey = config.llmApiKey;
    const baseURL = config.llmBaseUrl || "https://openrouter.ai/api/v1";

    if (apiKey && !apiKey.includes("your-")) {
      this.llm = new OpenAI({
        apiKey,
        baseURL,
        defaultHeaders: {
          "HTTP-Referer": "http://localhost:3001",
          "X-Title": "FloatChat-AI",
        },
      });
      console.log(`✅ LLM configured: ${config.llmModel} via ${baseURL}`);
    } else {
      console.warn(
        "⚠️  LLM API key not set — LLM features disabled. Smart fallback active.",
      );
    }

    this.model = config.llmModel || "qwen/qwen3.5-397b-a17b";

    // Named ocean regions for query understanding
    this.OCEAN_REGIONS = {
      "arabian sea": { lat_min: 5, lat_max: 25, lon_min: 50, lon_max: 75 },
      "bay of bengal": { lat_min: 5, lat_max: 23, lon_min: 75, lon_max: 95 },
      "equatorial indian": {
        lat_min: -10,
        lat_max: 10,
        lon_min: 40,
        lon_max: 100,
      },
      "southern indian": {
        lat_min: -60,
        lat_max: -10,
        lon_min: 20,
        lon_max: 120,
      },
      "indian ocean": { lat_min: -60, lat_max: 30, lon_min: 20, lon_max: 120 },
    };

    // Max conversation history messages to include for context
    this.MAX_HISTORY_MESSAGES = 10;
  }

  // ─── Main chat entry point ──────────────────────────────────────────

  async chat(query, sessionId = null, userId = null) {
    console.log(`\n[RAG] ═══ New Query: "${query}" ═══`);

    // ── 1. Save user message ──────────────────────────────────────────
    if (sessionId && userId) {
      await this.mongoService
        .saveMessage(sessionId, "user", query)
        .catch(() => {});
    }

    // ── 2. Load conversation history for context ──────────────────────
    const history = await this._loadHistory(sessionId);

    // ── 3. Parallel: Vector Search + LLM Intent Classification ────────
    const [vectorContext, intent] = await Promise.all([
      this._vectorSearch(query),
      this._classifyIntent(query, history),
    ]);

    // Display intent classification decision
    let intentMessage = "";
    if (intent.tool === "generic_chat") {
      intentMessage = "[ROUTING] Generic conversation (no data tools needed)";
    } else if (
      vectorContext.length > 0 &&
      this.vectorService.status === "connected"
    ) {
      intentMessage = `[ROUTING] Hybrid: Using MCP tool '${intent.tool}' + Semantic search (${vectorContext.length} results)`;
    } else if (this.vectorService.status === "unavailable") {
      intentMessage = `[ROUTING] MongoDB-only: Using MCP tool '${intent.tool}'`;
    } else {
      intentMessage = `[ROUTING] Using MCP tool '${intent.tool}'`;
    }
    console.log(intentMessage);

    if (vectorContext.length > 0) {
      console.log(
        `[RAG] Vector results: ${vectorContext.length} documents found`,
      );
    }

    // ── 4. Execute MCP Tool (if not generic chat) ─────────────────────
    let toolResult = null;
    let toolCode = null;

    if (intent.tool !== "generic_chat") {
      try {
        // If vector search found platform IDs and the tool needs them, inject
        if (
          vectorContext.length > 0 &&
          !intent.params.platform &&
          !intent.params.platforms
        ) {
          const platformIds =
            this.vectorService.extractPlatformIds(vectorContext);
          if (platformIds.length > 0 && this._toolNeedsPlatform(intent.tool)) {
            intent.params.platform = platformIds[0];
          }
        }

        toolResult = await this.mcpService.runTool(intent.tool, intent.params);
        console.log(`[RAG] MCP Tool Executed | Type: ${toolResult?.type}`);

        if (toolResult && !toolResult.error) {
          toolCode = JSON.stringify(
            { tool: intent.tool, params: intent.params, type: toolResult.type },
            null,
            2,
          );
        }
      } catch (e) {
        console.warn("[RAG] MCP tool failed:", e.message);
      }
    }

    // ── 5. Generate Final Response ────────────────────────────────────
    let answer = "";

    if (intent.tool === "generic_chat") {
      answer = await this._generateConversationalResponse(
        query,
        intent,
        vectorContext,
        history,
      );
    } else if (toolResult) {
      answer = await this._generateDataResponse(
        query,
        intent,
        toolResult,
        vectorContext,
        history,
        intentMessage,
      );
    } else {
      answer = this._smartFallback(query, intent, toolResult, intentMessage);
    }

    // ── 6. Build & save response ──────────────────────────────────────
    const aiMessage = {
      type: "ai",
      content: answer,
      hasCode: !!toolCode,
      code: toolCode,
      tool_used: intent.tool,
      tool_result: toolResult,
      intent_info: intentMessage,
      timestamp: new Date(),
    };

    if (sessionId) {
      await this.mongoService
        .saveMessage(sessionId, "ai", answer, toolCode)
        .catch(() => {});
    }

    return aiMessage;
  }

  // ─── Load Conversation History ──────────────────────────────────────

  async _loadHistory(sessionId) {
    if (!sessionId) return [];
    try {
      const messages = await this.mongoService.getMessages(sessionId);
      // Take last N messages for context
      const recent = messages.slice(-this.MAX_HISTORY_MESSAGES);
      return recent.map((m) => ({
        role: m.type === "user" ? "user" : "assistant",
        content:
          typeof m.content === "string"
            ? m.content.substring(0, 500)
            : String(m.content || ""),
      }));
    } catch (e) {
      console.warn("[RAG] Failed to load history:", e.message);
      return [];
    }
  }

  // ─── Vector Search ──────────────────────────────────────────────────

  async _vectorSearch(query) {
    try {
      const results = await this.vectorService.search(query, 12);
      return Array.isArray(results) ? results : [];
    } catch (e) {
      console.warn("[RAG] Vector search failed:", e.message);
      return [];
    }
  }

  // ─── LLM Intent Classification (Function Calling) ──────────────────

  async _classifyIntent(query, history = []) {
    if (!this.llm) {
      return this._keywordFallbackIntent(query);
    }

    try {
      console.log(`[RAG] LLM intent classification (${this.model})...`);

      // Build messages with conversation context
      const messages = [
        {
          role: "system",
          content: `You are FloatChat-AI, an expert oceanographic data assistant specializing in ARGO float data from the Indian Ocean.

Your capabilities:
- Query ARGO float profiles, measurements, and metadata from MongoDB
- Generate visualizations (charts, maps, heatmaps, T-S diagrams)
- Perform semantic search across float summaries
- Calculate statistics and compare ocean regions
- Analyze BGC (biogeochemical) data: dissolved oxygen, chlorophyll, nitrate

RULES FOR TOOL SELECTION:
1. If the user is greeting you, asking your name, asking general science questions ("what is a BGC float?", "what is the Argo program?"), or making casual conversation, respond naturally WITHOUT using any tools.
2. If the user asks about specific data, floats, measurements, visualizations, or ocean regions, use the appropriate tool.
3. For date queries: if the user specifies a single day (e.g. "October 12, 2018"), set BOTH date_start and date_end to that exact day.
4. Known ocean regions and their coordinates:
   - Arabian Sea: 5-25°N, 50-75°E
   - Bay of Bengal: 5-23°N, 75-95°E
   - Equatorial Indian Ocean: 10°S-10°N, 40-100°E
5. Known cities: Mumbai (19.07°N, 72.88°E), Chennai (13.08°N, 80.27°E), Kochi (9.93°N, 76.26°E), Goa (15.49°N, 73.82°E), Kolkata (22.57°N, 88.36°E).

SPECIFIC TOOL ROUTING:
- "how many floats/profiles" or "dataset info" → get_dataset_metadata
- "tell me about float X" / "info on float X" / "everything about float X" → get_metadata_card
- "list profiles for float X" / "profile IDs for float X" → get_float_profiles
- "get profile data/measurements for profile ID" → get_profile_data
- "most recent profiles" / "latest profiles" → get_recent_profiles
- "find floats near X" / "floats within Xkm of" → nearest_floats
- "find profiles in [region]" (natural language search) → search_profiles
- "find BGC profiles" / "dissolved oxygen" / "chlorophyll" profiles → search_bgc_profiles
- "average/mean/statistics for [param]" (global or depth range) → aggregate_statistics
- "statistics for float X" / "stats for platform X" → get_stats_card
- "summary statistics for profile X" → get_profile_summary_stats
- "anomalous profiles" / "anomaly detection" → find_anomalous_profiles
- "profiles deeper than Xm" / "depth range" → find_profiles_by_depth_range
- "missing data" / "data quality" → find_profiles_missing_data
- "vertical gradient" / "thermocline" → get_vertical_gradient
- "trajectory" / "track" / "path of float" → visualize_trajectory
- "depth profile" / "plot temperature vs depth" → visualize_depth_profile
- "T-S diagram" / "temperature vs salinity" → visualize_ts_diagram
- "time series" / "changes over time" → visualize_time_series
- "show on map" / "map of floats" → visualize_float_map
- "heatmap" → visualize_heatmap
- "compare profiles" / "comparison depth chart" → visualize_depth_profile (with multiple platforms)
- "show data table" / "list floats" → get_data_table

6. Use the conversation history to maintain context — if user refers to "that float" or "same region", infer from previous messages.
7. When in doubt about visualization type, use auto_visualize.`,
        },
        // Include conversation history for context maintenance
        ...history.slice(-6),
        { role: "user", content: query },
      ];

      const response = await this.llm.chat.completions.create({
        model: this.model,
        messages,
        tools: this.mcpService.getToolSchemas(),
        tool_choice: "auto",
        temperature: 0.1,
        max_tokens: 1024,
      });

      const msg = response.choices[0]?.message;

      if (msg?.tool_calls && msg.tool_calls.length > 0) {
        const call = msg.tool_calls[0].function;
        let args = {};
        try {
          args =
            typeof call.arguments === "string"
              ? JSON.parse(call.arguments)
              : call.arguments || {};
        } catch {
          args = {};
        }
        console.log(`[RAG] LLM selected tool: ${call.name} with params:`, args);
        return {
          tool: call.name,
          params: args,
          llmConnected: true,
          llmReasoning: "",
        };
      }

      // LLM decided no tool is needed — generic chat
      return {
        tool: "generic_chat",
        params: {},
        llmConnected: true,
        llmReasoning: msg?.content || "",
      };
    } catch (e) {
      console.warn("[RAG] LLM intent classification failed:", e.message);
      return this._keywordFallbackIntent(query);
    }
  }

  // ─── Keyword-based fallback intent (when LLM is unavailable) ────────

  _keywordFallbackIntent(query) {
    const q = query.toLowerCase();

    // Greeting detection
    if (
      /^(hi|hello|hey|good\s*(morning|afternoon|evening)|what'?s\s*up|howdy)/i.test(
        q.trim(),
      )
    ) {
      return {
        tool: "generic_chat",
        params: {},
        llmConnected: false,
        llmReasoning: "",
      };
    }

    // Platform number extraction
    const platformMatch = q.match(
      /(?:float|platform|wmo|id)\s*#?\s*(\d{5,8})|(?:^|\s)(\d{7,8})(?:\s|$)/,
    );
    const platform = platformMatch
      ? platformMatch[1] || platformMatch[2]
      : null;

    // Visualization detection
    if (/\b(t-?s\s*diagram|temperature.*(vs|versus|salinity))\b/i.test(q)) {
      return {
        tool: "visualize_ts_diagram",
        params: platform ? { platform } : {},
        llmConnected: false,
        llmReasoning: "",
      };
    }
    if (/\b(depth\s*profile|profile.*depth|param.*depth)\b/i.test(q)) {
      const param = this._extractParam(q);
      return {
        tool: "visualize_depth_profile",
        params: { platform: platform || "", param },
        llmConnected: false,
        llmReasoning: "",
      };
    }
    if (/\b(trajector|path|track|route)\b/i.test(q) && platform) {
      return {
        tool: "visualize_trajectory",
        params: { platform },
        llmConnected: false,
        llmReasoning: "",
      };
    }
    if (/\b(heatmap|heat\s*map)\b/i.test(q) && platform) {
      const param = this._extractParam(q);
      return {
        tool: "visualize_heatmap",
        params: { platform, param },
        llmConnected: false,
        llmReasoning: "",
      };
    }
    if (/\b(time\s*series|over\s*time|trend)\b/i.test(q) && platform) {
      const param = this._extractParam(q);
      return {
        tool: "visualize_time_series",
        params: { platform, param },
        llmConnected: false,
        llmReasoning: "",
      };
    }
    if (/\b(map|show.*float|where.*float|location)\b/i.test(q)) {
      const region = this._extractRegion(q);
      return {
        tool: "visualize_float_map",
        params: region || {},
        llmConnected: false,
        llmReasoning: "",
      };
    }

    // Data queries
    if (/\b(info|about|metadata|detail|describe)\b/i.test(q) && platform) {
      return {
        tool: "get_metadata_card",
        params: { platform },
        llmConnected: false,
        llmReasoning: "",
      };
    }
    if (
      /\b(stat|mean|average|std|standard\s*dev|min|max)\b/i.test(q) &&
      platform
    ) {
      const param = this._extractParam(q);
      return {
        tool: "get_stats_card",
        params: { platform, param },
        llmConnected: false,
        llmReasoning: "",
      };
    }
    if (/\b(table|list|tabular|grid|all\s*float)\b/i.test(q)) {
      return {
        tool: "get_data_table",
        params: platform ? { platform } : {},
        llmConnected: false,
        llmReasoning: "",
      };
    }
    if (/\b(how\s*many|total|count|dataset|overview)\b/i.test(q)) {
      return {
        tool: "get_dataset_metadata",
        params: {},
        llmConnected: false,
        llmReasoning: "",
      };
    }
    if (platform) {
      return {
        tool: "get_metadata_card",
        params: { platform },
        llmConnected: false,
        llmReasoning: "",
      };
    }
    if (/\b(near|closest|proximity|around)\b/i.test(q)) {
      const coords = this._extractCoords(q);
      return {
        tool: "nearest_floats",
        params: { lat: coords.lat, lon: coords.lon },
        llmConnected: false,
        llmReasoning: "",
      };
    }

    return {
      tool: "generic_chat",
      params: {},
      llmConnected: false,
      llmReasoning: "",
    };
  }

  // ─── Conversational Response (with history context) ─────────────────

  async _generateConversationalResponse(query, intent, vectorContext, history) {
    // If LLM already generated a response during classification
    if (intent.llmReasoning && intent.llmReasoning.trim().length > 10) {
      return this._cleanLLMResponse(intent.llmReasoning);
    }

    // Try LLM for natural conversation
    if (this.llm) {
      try {
        let contextStr = "";
        if (vectorContext.length > 0) {
          contextStr =
            "\n\nRelevant context from ARGO database:\n" +
            vectorContext
              .slice(0, 5)
              .map((r) => `- ${r.document || r.id}`)
              .join("\n");
        }

        const dataSummary = await this._getDataSummary();

        const messages = [
          {
            role: "system",
            content: `You are FloatChat-AI, an expert oceanographic data assistant specializing in ARGO float data from the Indian Ocean.

You have access to ${dataSummary} in your database.

RESPONSE GUIDELINES:
- Respond directly and concisely to what the user asked
- Provide medium-length responses (2-4 sentences per topic, 3-4 paragraphs total)
- Use clear, plain language without excessive formatting
- Focus on accuracy and relevance over elaboration
- Reference specific ARGO data when relevant
- Be helpful and professional${contextStr}`,
          },
          ...history.slice(-6),
          { role: "user", content: query },
        ];

        const response = await this.llm.chat.completions.create({
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 800,
        });

        const content =
          response.choices[0]?.message?.content || this._defaultGreeting();
        return this._cleanLLMResponse(content);
      } catch (e) {
        console.warn("[RAG] LLM conversational response failed:", e.message);
      }
    }

    return this._defaultGreeting();
  }

  // ─── Data/Viz Response with LLM Synthesis ──────────────────────────

  async _generateDataResponse(
    query,
    intent,
    toolResult,
    vectorContext,
    history,
  ) {
    if (!toolResult) return this._smartFallback(query, intent, toolResult);

    // Get structured data first
    const structuredData = this._formatStructuredData(toolResult);

    // For data responses, return structured data instead of paragraph dump
    // Add a brief LLM summary if available
    if (
      this.llm &&
      toolResult?.type !== "plotly" &&
      toolResult?.type !== "leaflet"
    ) {
      try {
        const messages = [
          {
            role: "system",
            content: `You are FloatChat-AI. Provide a 1-2 sentence summary of this data query result. Be concise and factual.`,
          },
          {
            role: "user",
            content: `Summarize this data result:\n${structuredData}`,
          },
        ];

        const response = await this.llm.chat.completions.create({
          model: this.model,
          messages,
          temperature: 0.4,
          max_tokens: 200,
        });

        const summary = response.choices[0]?.message?.content;
        if (summary && summary.trim().length > 10) {
          return `${this._cleanLLMResponse(summary)}\n\nData:\n${structuredData}`;
        }
      } catch (e) {
        console.warn("[RAG] LLM summary generation failed:", e.message);
      }
    }

    // Return structured data as-is if no LLM or LLM fails
    return structuredData;
  }

  // ─── Build Data Context for LLM ────────────────────────────────────

  _buildDataContext(toolResult) {
    const type = toolResult?.type;
    const data = toolResult?.data;

    if (!data && type !== "plotly" && type !== "leaflet")
      return "No data available";

    if (type === "plotly") {
      const layout = toolResult?.plotly?.layout || {};
      const traces = toolResult?.plotly?.data || [];
      const title = layout?.title?.text || "Chart";
      const totalPoints = traces.reduce(
        (acc, t) => acc + (t.x?.length || 0),
        0,
      );
      let detail = `Chart: "${title}" with ${traces.length} data series containing ${totalPoints.toLocaleString()} data points.`;
      // Add sample data for better LLM analysis
      if (traces.length > 0 && traces[0].y?.length > 0) {
        const y = traces[0].y.filter((v) => v != null);
        if (y.length > 0) {
          detail += ` First series range: ${Math.min(...y).toFixed(3)} to ${Math.max(...y).toFixed(3)}.`;
        }
      }
      return detail;
    }

    if (type === "leaflet") {
      const markers = toolResult?.markers || [];
      const summary = `Map showing ${markers.length} float location(s)`;
      let detail = toolResult?.polyline
        ? `${summary}. Trajectory spans ${toolResult.polyline.length} waypoints.`
        : summary;
      if (markers.length > 0 && markers.length <= 10) {
        detail +=
          " Positions: " +
          markers
            .map((m) => `(${m.lat?.toFixed(2)}°, ${m.lon?.toFixed(2)}°)`)
            .join(", ");
      }
      return detail;
    }

    if (type === "metadata_card") {
      const d = data;
      return `Float ${d.platform_number}: project=${d.project_name}, PI=${d.pi_name}, type=${d.platform_type}, cycles=${d.total_cycles}, BGC=${d.has_bgc ? "Yes" : "No"}, date range=${d.first_date} to ${d.last_date}, lat range=${d.geo_bounding_box?.min_lat?.toFixed(2)} to ${d.geo_bounding_box?.max_lat?.toFixed(2)}, lon range=${d.geo_bounding_box?.min_lon?.toFixed(2)} to ${d.geo_bounding_box?.max_lon?.toFixed(2)}`;
    }

    if (type === "stats_card") {
      const d = data;
      return `${toolResult.param} statistics: mean=${d.mean?.toFixed(4)}, std=${d.std?.toFixed(4)}, min=${d.min?.toFixed(4)}, max=${d.max?.toFixed(4)}, count=${d.count} measurements`;
    }

    if (type === "data_table") {
      const rows = toolResult.rows || [];
      let detail = `Table: ${rows.length} records with columns: ${(toolResult.columns || []).join(", ")}`;
      if (rows.length > 0 && rows.length <= 5) {
        detail += ". Sample: " + JSON.stringify(rows[0]);
      }
      return detail;
    }

    if (Array.isArray(data)) {
      const count = data.length;
      const sample = data[0];
      let context = `Retrieved ${count} record(s)`;
      if (sample) {
        const keys = Object.keys(sample).slice(0, 8).join(", ");
        context += `. Fields: ${keys}`;
        if (sample.platform_number) {
          const platforms = [
            ...new Set(data.map((d) => d.platform_number).filter(Boolean)),
          ];
          context += `. Unique platforms: ${platforms.length} (${platforms.slice(0, 5).join(", ")}${platforms.length > 5 ? "..." : ""})`;
        }
      }
      return context;
    }

    if (typeof data === "object") {
      return JSON.stringify(data, null, 2).substring(0, 800);
    }

    return String(data).substring(0, 500);
  }

  // ─── Smart Data-Driven Fallback (no LLM required) ─────────────────

  _smartFallback(query, intent, toolResult) {
    const tool = intent.tool;
    const data = toolResult?.data;
    const type = toolResult?.type;

    if (type === "plotly") {
      const layout = toolResult?.plotly?.layout;
      const title = layout?.title?.text || tool.replace(/_/g, " ");
      const traces = toolResult?.plotly?.data || [];
      const n = traces.reduce((acc, t) => acc + (t.x?.length || 0), 0);
      return `${title}\n\nGenerated a visualization with ${traces.length} data series containing ${n.toLocaleString()} data points from the ARGO Indian Ocean array.\n\nThe interactive chart is rendered above. You can hover over data points for detailed values, zoom in on regions of interest, and use the toolbar for additional options.`;
    }

    if (type === "leaflet") {
      const markers = toolResult?.markers || [];
      let text = `Float Map — ${markers.length} locations\n\nDisplaying ${markers.length} float position${markers.length !== 1 ? "s" : ""} from the ARGO Indian Ocean array.`;
      if (toolResult?.polyline) {
        text += `\n\nThe trajectory path spans ${toolResult.polyline.length} waypoints, showing the float's journey through the ocean. Click on markers to see cycle details.`;
      }
      return text;
    }

    if (type === "metadata_card") {
      const d = toolResult.data || {};
      return (
        `Float Metadata — Platform ${d.platform_number || "?"}\n\n` +
        `Here is the complete technical profile for this ARGO float:\n\n` +
        `Project: ${d.project_name || "—"}\n` +
        `Principal Investigator: ${d.pi_name || "—"}\n` +
        `Platform Type: ${d.platform_type || "—"}\n` +
        `Total Cycles Completed: ${d.total_cycles || "—"}\n` +
        `BGC Capabilities: ${d.has_bgc ? "Yes (carries biogeochemical sensors)" : "No (core parameters only: T, S, P)"}\n` +
        `First Observation: ${d.first_date ? new Date(d.first_date).toLocaleDateString() : "—"}\n` +
        `Latest Observation: ${d.last_date ? new Date(d.last_date).toLocaleDateString() : "—"}\n\n` +
        `The detailed metadata card is displayed above.`
      );
    }

    if (type === "stats_card") {
      const d = toolResult.data || {};
      return (
        `${toolResult.param || ""} Statistics${toolResult.platform ? ` — Platform ${toolResult.platform}` : ""}\n\n` +
        `Mean: ${d.mean?.toFixed(4) ?? "—"}\n` +
        `Standard Deviation: ${d.std?.toFixed(4) ?? "—"}\n` +
        `Minimum: ${d.min?.toFixed(4) ?? "—"}\n` +
        `Maximum: ${d.max?.toFixed(4) ?? "—"}\n` +
        `Total Measurements: ${d.count?.toLocaleString() ?? "—"}\n\n` +
        `The statistics card is displayed above for quick reference.`
      );
    }

    if (type === "data_table") {
      const rows = toolResult.rows || [];
      if (rows.length === 0)
        return "No float data matched your query. Try widening your date range or geographic region.";
      return `Data Table — ${rows.length} records\n\nFound ${rows.length} ARGO float records matching your query. The interactive table is displayed above — you can scroll through all records and expand for more.`;
    }

    if (type === "text") {
      return data || "Processing complete.";
    }

    if (type === "data" && Array.isArray(data)) {
      if (data.length === 0) {
        return `I searched using the ${tool.replace(/_/g, " ")} tool but found 0 matching records. Try:\n- A wider date range\n- A larger geographic region\n- A different platform number`;
      }
      const sample = data[0];
      let intro = `Found ${data.length} ARGO record${data.length !== 1 ? "s" : ""} for your query.\n\n`;
      if (sample.platform_number) {
        const platforms = [
          ...new Set(data.map((d) => d.platform_number).filter(Boolean)),
        ];
        intro += `Platforms: ${platforms.slice(0, 8).join(", ")}${platforms.length > 8 ? ` +${platforms.length - 8} more` : ""}`;
      }
      return intro;
    }

    if (
      type === "data" &&
      data &&
      typeof data === "object" &&
      !Array.isArray(data)
    ) {
      if (data.activeFloats != null) {
        return (
          `ARGO Indian Ocean Dataset Summary\n\n` +
          `Active Floats: ${data.activeFloats.toLocaleString()}\n` +
          `Total Profiles: ${data.total_profiles?.toLocaleString() || "—"}\n` +
          `BGC Profiles: ${data.total_bgc_profiles?.toLocaleString() || "—"}\n` +
          `BGC Coverage: ${data.bgcCoverage || "—"}\n\n` +
          `This dataset covers floats deployed across the Indian Ocean basin, collecting temperature, salinity, and pressure data through autonomous profiling.`
        );
      }
      return `Data retrieved:\n\n\`\`\`json\n${JSON.stringify(data, null, 2).substring(0, 600)}\n\`\`\``;
    }

    if (tool === "generic_chat") {
      return this._defaultGreeting();
    }

    return `I processed your query using the ${tool.replace(/_/g, " ")} tool. ${toolResult?.error ? `\n\nError: ${toolResult.error}` : ""}`;
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  _defaultGreeting() {
    return (
      "Hello! I'm FloatChat-AI, your oceanographic data assistant.\n\n" +
      "I specialize in exploring and analyzing ARGO float data from the Indian Ocean. I can help you with:\n\n" +
      "Data Exploration\n" +
      "• Search for floats by region, date, or platform number\n" +
      "• View detailed metadata cards for specific floats\n" +
      "• Browse data tables with filtering\n\n" +
      "Visualizations\n" +
      "• Temperature and salinity depth profiles\n" +
      "• T-S diagrams for water mass analysis\n" +
      "• Heatmaps showing parameter variation across depth and time\n" +
      "• Time series of oceanographic parameters\n\n" +
      "Maps\n" +
      "• Float trajectory tracking\n" +
      "• Regional float distribution maps\n\n" +
      "Analytics\n" +
      "• Statistical summaries (mean, std, min, max)\n" +
      "• Regional comparisons\n\n" +
      "Try asking me something like:\n" +
      "• Tell me about float 2902277\n" +
      "• Show temperature depth profile for float 1900121\n" +
      "• Show trajectory of float 2902277\n" +
      "• What floats are in the Arabian Sea?"
    );
  }

  async _getDataSummary() {
    try {
      const stats = await this.mongoService.getStats();
      return `${stats.activeFloats} floats, ${stats.total_profiles?.toLocaleString()} profiles, ${stats.total_bgc_profiles?.toLocaleString()} BGC profiles`;
    } catch {
      return "500+ floats and 87,000+ profiles";
    }
  }

  _toolNeedsPlatform(tool) {
    return [
      "query_float",
      "get_float_info",
      "get_metadata_card",
      "visualize_trajectory",
      "visualize_heatmap",
      "visualize_time_series",
      "visualize_depth_profile",
      "visualize_ts_diagram",
      "get_stats_card",
    ].includes(tool);
  }

  _extractParam(q) {
    if (/\btemp(erature)?\b/i.test(q)) return "TEMP";
    if (/\bsal(inity)?\b|psal/i.test(q)) return "PSAL";
    if (/\boxy(gen)?\b|doxy/i.test(q)) return "DOXY";
    if (/\bchloro(phyll)?\b|chla/i.test(q)) return "CHLA";
    if (/\bnitrate\b/i.test(q)) return "NITRATE";
    if (/\bpress(ure)?\b|pres\b/i.test(q)) return "PRES";
    return "TEMP";
  }

  _extractRegion(q) {
    const ql = q.toLowerCase();
    for (const [name, bounds] of Object.entries(this.OCEAN_REGIONS)) {
      if (ql.includes(name)) return bounds;
    }
    return null;
  }

  _extractCoords(q) {
    const cities = {
      mumbai: { lat: 19.07, lon: 72.88 },
      chennai: { lat: 13.08, lon: 80.27 },
      kolkata: { lat: 22.57, lon: 88.36 },
      kochi: { lat: 9.93, lon: 76.26 },
      goa: { lat: 15.49, lon: 73.82 },
      karachi: { lat: 24.86, lon: 67.01 },
      maldives: { lat: 3.2, lon: 73.22 },
      "sri lanka": { lat: 7.87, lon: 80.77 },
    };
    for (const [city, coords] of Object.entries(cities)) {
      if (q.toLowerCase().includes(city)) return coords;
    }
    return { lat: 15, lon: 75 };
  }

  _cleanLLMResponse(text) {
    if (!text) return text;
    // Remove emojis (🌊, 📊, 🗺️, 📈, 🃏, 📋, 👋, ✓, etc.)
    text = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, "");
    // Remove markdown bold/italic/code formatting
    text = text
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .replace(/\*/g, "")
      .replace(/_/g, " ");
    text = text.replace(/`{1,3}/g, "");
    text = text.replace(/#{1,6}\s+/g, "");
    // Remove excessive punctuation
    text = text.replace(/([.!?])\s{2,}/g, "$1 ");
    // Remove trailing whitespace from lines
    text = text
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
    // Clean up multiple blank lines
    text = text.replace(/\n\n\n+/g, "\n\n");
    return text.trim();
  }

  _formatStructuredData(toolResult) {
    const type = toolResult?.type;
    const data = toolResult?.data;

    if (!data && type !== "plotly" && type !== "leaflet") {
      return "No data available";
    }

    // For visualizations, return a brief message (they're rendered separately)
    if (type === "plotly") {
      const layout = toolResult?.plotly?.layout || {};
      const traces = toolResult?.plotly?.data || [];
      const title = layout?.title?.text || "Chart";
      return `VISUALIZATION: ${title}\nData series: ${traces.length}\nTotal data points: ${traces.reduce((acc, t) => acc + (t.x?.length || 0), 0).toLocaleString()}`;
    }

    if (type === "leaflet") {
      const markers = toolResult?.markers || [];
      let text = `MAP: ${markers.length} location(s)`;
      if (toolResult?.polyline) {
        text += `\nTrajectory waypoints: ${toolResult.polyline.length}`;
      }
      return text;
    }

    // For structured data, format as key-value or table
    if (type === "metadata_card") {
      const d = toolResult.data || {};
      return [
        "PLATFORM METADATA",
        "================",
        `Platform: ${d.platform_number}`,
        `Project: ${d.project_name}`,
        `Principal Investigator: ${d.pi_name}`,
        `Platform Type: ${d.platform_type}`,
        `Total Cycles: ${d.total_cycles}`,
        `BGC Sensors: ${d.has_bgc ? "Yes" : "No"}`,
        `Date Range: ${new Date(d.first_date).toLocaleDateString()} to ${new Date(d.last_date).toLocaleDateString()}`,
        `Latitude Range: ${d.geo_bounding_box?.min_lat?.toFixed(2)} to ${d.geo_bounding_box?.max_lat?.toFixed(2)}`,
        `Longitude Range: ${d.geo_bounding_box?.min_lon?.toFixed(2)} to ${d.geo_bounding_box?.max_lon?.toFixed(2)}`,
      ].join("\n");
    }

    if (type === "stats_card") {
      const d = toolResult.data || {};
      return [
        `STATISTICS: ${toolResult.param}${toolResult.platform ? ` (Platform ${toolResult.platform})` : ""}`,
        "======================================",
        `Mean: ${d.mean?.toFixed(4)}`,
        `Std Dev: ${d.std?.toFixed(4)}`,
        `Minimum: ${d.min?.toFixed(4)}`,
        `Maximum: ${d.max?.toFixed(4)}`,
        `Count: ${d.count?.toLocaleString()} measurements`,
      ].join("\n");
    }

    if (type === "data_table") {
      const rows = toolResult.rows || [];
      if (rows.length === 0) {
        return "No records found";
      }
      // Format as simple table
      const cols = toolResult.columns || Object.keys(rows[0] || {});
      const header = cols.join(" | ");
      const separator = cols.map((c) => "---").join("|");
      const rowTexts = rows
        .slice(0, 20)
        .map((row) =>
          cols
            .map((c) =>
              row[c] != null ? String(row[c]).substring(0, 20) : "—",
            )
            .join(" | "),
        );
      return [header, separator, ...rowTexts].join("\n");
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return "No records found";
      }
      // Format array of objects as a simple table
      const sample = data[0];
      const cols = Object.keys(sample).slice(0, 8);
      const header = cols.join(" | ");
      const separator = cols.map((c) => "---").join("|");
      const rowTexts = data
        .slice(0, 25)
        .map((row) =>
          cols
            .map((c) =>
              row[c] != null ? String(row[c]).substring(0, 20) : "—",
            )
            .join(" | "),
        );
      const moreText =
        data.length > 25 ? `\n... and ${data.length - 25} more records` : "";
      return [header, separator, ...rowTexts, moreText].join("\n");
    }

    if (typeof data === "object") {
      return JSON.stringify(data, null, 2).substring(0, 800);
    }

    return String(data).substring(0, 500);
  }

  // ─── Pure semantic search (for /api/search endpoint) ────────────────

  async semanticSearch(query, n = 10, collection = "all") {
    try {
      return await this.vectorService.search(query, n, collection);
    } catch (e) {
      console.error("[RAG] Semantic search error:", e.message);
      return [];
    }
  }
}

module.exports = RagService;
