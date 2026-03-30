#!/usr/bin/env python3
"""
Vector Search Microservice — lightweight Flask API for semantic search.

Uses the same ArgoVectorStore (PersistentClient + SentenceTransformerEmbeddingFunction)
that was used to build the embeddings, guaranteeing compatible results.

Endpoints:
    GET  /health              — Health check
    POST /search              — Semantic search (body: {query, n_results, collection})
    GET  /stats               — Collection statistics

Start:  python vector_db/search_server.py
Port:   5100 (configurable via VECTOR_PORT env var)
"""

import json
import logging
import os
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = str(Path(__file__).parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from flask import Flask, request, jsonify
from flask_cors import CORS
from vector_db.vector_store import ArgoVectorStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

store = None


def init_store():
    """Initialize the ArgoVectorStore (loads embedding model + ChromaDB)."""
    global store
    logger.info("Loading ArgoVectorStore (ChromaDB + sentence-transformers)...")
    store = ArgoVectorStore()
    stats = store.get_stats()
    logger.info(
        f"✅ Loaded: {stats['profiles']:,} profiles, "
        f"{stats['bgc_profiles']:,} BGC, {stats['floats']:,} floats"
    )


@app.route("/health", methods=["GET"])
def health():
    if store is None:
        return jsonify({"status": "not_ready"}), 503
    stats = store.get_stats()
    return jsonify({"status": "ok", **stats})


@app.route("/stats", methods=["GET"])
def stats():
    if store is None:
        return jsonify({"error": "Store not initialized"}), 503
    return jsonify(store.get_stats())


@app.route("/search", methods=["POST"])
def search():
    if store is None:
        return jsonify({"error": "Store not initialized"}), 503

    data = request.get_json(force=True)
    query = data.get("query", "")
    n_results = data.get("n_results", 10)
    collection = data.get("collection", "all")  # 'all', 'profiles', 'bgc_profiles', 'floats'

    if not query:
        return jsonify({"error": "query is required"}), 400

    try:
        if collection == "all":
            raw = store.query_all(query, n_results=n_results)
        elif collection == "profiles":
            raw = _query_single(store.query_profiles, query, n_results)
        elif collection == "bgc_profiles":
            raw = _query_single(store.query_bgc_profiles, query, n_results)
        elif collection == "floats":
            raw = _query_single(store.query_floats, query, n_results)
        else:
            raw = store.query_all(query, n_results=n_results)

        # Normalize metadata values (convert non-JSON-serializable types)
        results = []
        for r in raw:
            meta = r.get("metadata", {}) or {}
            clean_meta = {}
            for k, v in meta.items():
                if isinstance(v, (str, int, float, bool)):
                    clean_meta[k] = v
                elif v is None:
                    clean_meta[k] = None
                else:
                    clean_meta[k] = str(v)
            results.append({
                "id": r.get("id"),
                "document": r.get("document"),
                "metadata": clean_meta,
                "distance": r.get("distance"),
                "collection": r.get("collection", collection),
            })

        return jsonify({"query": query, "count": len(results), "results": results})

    except Exception as e:
        logger.error(f"Search error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


def _query_single(query_fn, query_text, n_results):
    """Convert a single-collection ChromaDB result to our standard format."""
    result = query_fn(query_text, n_results=n_results)
    items = []
    if result and result["ids"] and result["ids"][0]:
        for i in range(len(result["ids"][0])):
            items.append({
                "id": result["ids"][0][i],
                "document": result["documents"][0][i] if result.get("documents") else None,
                "metadata": result["metadatas"][0][i] if result.get("metadatas") else None,
                "distance": result["distances"][0][i] if result.get("distances") else None,
            })
    return items


if __name__ == "__main__":
    port = int(os.environ.get("VECTOR_PORT", 5100))
    init_store()
    logger.info(f"🚀 Vector search server starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
