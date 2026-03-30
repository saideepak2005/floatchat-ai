"use strict";

const axios = require("axios");

/**
 * VectorService — Bridge to the Python vector search microservice.
 *
 * Calls the Python Flask server (search_server.py) which uses
 * ArgoVectorStore with PersistentClient + SentenceTransformerEmbeddingFunction.
 * This guarantees the same embedding model used during indexing.
 *
 * Start the Python service first:
 *   cd /path/to/floatchat-ai && source .venv/bin/activate
 *   python vector_db/search_server.py
 *
 * Default port: 5100 (configurable via VECTOR_SERVICE_URL env var)
 */
class VectorService {
  constructor() {
    this.baseUrl =
      process.env.VECTOR_SERVICE_URL || "http://localhost:5100";
    this.status = "disconnected"; // 'connected', 'disconnected', 'unavailable'
  }

  async connect() {
    try {
      console.log(
        `[VectorService] Connecting to Python vector service at ${this.baseUrl}...`,
      );

      const res = await axios.get(`${this.baseUrl}/health`, {
        timeout: 10000,
      });

      if (res.data && res.data.status === "ok") {
        this.status = "connected";
        const s = res.data;
        console.log(
          `[VectorService] ✅ Connected — ${(s.profiles || 0).toLocaleString()} profiles, ` +
          `${(s.bgc_profiles || 0).toLocaleString()} BGC, ` +
          `${(s.floats || 0).toLocaleString()} floats`,
        );
      } else {
        throw new Error("Service not ready");
      }
    } catch (e) {
      console.warn(
        `[VectorService] ⚠️  Python vector service not reachable at ${this.baseUrl}`,
      );
      console.warn(
        "[VectorService] Semantic search UNAVAILABLE — falling back to MongoDB-only mode.",
      );
      console.warn(
        "[VectorService] 👉 Start it: source .venv/bin/activate && python vector_db/search_server.py",
      );
      this.status = "unavailable";
    }
  }

  /**
   * Semantic search across collections.
   *
   * @param {string} query - Natural language query
   * @param {number} nResults - Max results per collection
   * @param {string} collection - 'all', 'profiles', 'bgc_profiles', 'floats'
   * @returns {Array<{id, document, metadata, distance, collection}>}
   */
  async search(query, nResults = 10, collection = "all") {
    if (this.status !== "connected") return [];

    try {
      const res = await axios.post(
        `${this.baseUrl}/search`,
        { query, n_results: nResults, collection },
        { timeout: 15000 },
      );

      const results = res.data?.results || [];

      // Rerank: filter results with distance above threshold
      const RERANK_THRESHOLD = 1.3;
      const reranked = results.filter(
        (r) => r.distance != null && r.distance < RERANK_THRESHOLD,
      );

      return reranked.length > 0
        ? reranked.slice(0, nResults * 3)
        : results.slice(0, nResults);
    } catch (e) {
      console.warn("[VectorService] Search error:", e.message);
      return [];
    }
  }

  /**
   * Extract platform IDs from vector search results.
   */
  extractPlatformIds(results) {
    const ids = new Set();
    for (const r of results) {
      if (r.metadata?.platform_number) {
        ids.add(String(r.metadata.platform_number));
      }
      const match = r.id?.match(/^(\d{5,8})_/);
      if (match) ids.add(match[1]);
    }
    return [...ids];
  }

  /**
   * Get stats for all collections.
   */
  async getStats() {
    if (this.status !== "connected") return { status: this.status };

    try {
      const res = await axios.get(`${this.baseUrl}/stats`, {
        timeout: 5000,
      });
      return { status: "connected", ...res.data };
    } catch {
      return { status: this.status };
    }
  }
}

module.exports = VectorService;
