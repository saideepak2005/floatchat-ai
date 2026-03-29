"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const MongoService = require("./services/mongoService");
const VectorService = require("./services/vectorService");
const McpService = require("./services/mcpService");
const RagService = require("./services/ragService");
const createRoutes = require("./routes/chatRoutes");


// ─── Logger Utility ───────────────────────────────────────────────────────────

const logger = {
  info: (msg, data) =>
    console.log(`[INFO]  ${new Date().toISOString()} - ${msg}`, data || ""),
  error: (msg, err) =>
    console.error(
      `[ERROR] ${new Date().toISOString()} - ${msg}`,
      err?.message || err || "",
    ),
  warn: (msg, data) =>
    console.warn(`[WARN]  ${new Date().toISOString()} - ${msg}`, data || ""),
};

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// ─── Service Configuration ────────────────────────────────────────────────────

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DATABASE_NAME || "floatchat_ai";
const LLM_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "qwen/qwen3.5-397b-a17b";
const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
const CHROMA_PERSIST_DIR = process.env.CHROMA_PERSIST_DIR
  ? path.resolve(__dirname, process.env.CHROMA_PERSIST_DIR)
  : path.resolve(__dirname, "../../chroma_data");
const PORT = parseInt(process.env.PORT || "3001", 10);

logger.info("Starting FloatChat-AI Server", {
  port: PORT,
  mongo: MONGO_URI,
  llmModel: LLM_MODEL,
  llmBaseUrl: LLM_BASE_URL,
  llmKeySet: !!LLM_API_KEY && !LLM_API_KEY.includes("your-"),
});

// ─── Service Instances ────────────────────────────────────────────────────────

const mongoService = new MongoService(MONGO_URI, DB_NAME);
const vectorService = new VectorService(CHROMA_PERSIST_DIR);
const mcpService = new McpService(mongoService);
const ragService = new RagService(vectorService, mongoService, mcpService, {
  llmApiKey: LLM_API_KEY,
  llmModel: LLM_MODEL,
  llmBaseUrl: LLM_BASE_URL,
});

// ─── Chat Session Routes (required by ChatGPTInterface.js) ───────────────────

// POST /api/chat/session  — create new chat session
app.post("/api/chat/session", async (req, res) => {
  try {
    const { userId = "anonymous", title = "New Chat" } = req.body;
    const session = await mongoService.createSession(userId, title);
    logger.info("Chat session created", { userId, sessionId: session._id });
    res.json(session);
  } catch (err) {
    logger.error("Create session failed", err);
    res
      .status(500)
      .json({ error: "Failed to create session", detail: err.message });
  }
});

// GET /api/chat/history/:userId  — list sessions for a user
app.get("/api/chat/history/:userId", async (req, res) => {
  try {
    const sessions = await mongoService.getSessions(req.params.userId);
    logger.info("Chat history retrieved", {
      userId: req.params.userId,
      count: sessions?.length || 0,
    });
    res.json(sessions);
  } catch (err) {
    logger.error("Get history failed", err);
    res
      .status(500)
      .json({ error: "Failed to fetch history", detail: err.message });
  }
});

// GET /api/chat/session/:sessionId  — get messages for a session
app.get("/api/chat/session/:sessionId", async (req, res) => {
  try {
    const messages = await mongoService.getMessages(req.params.sessionId);
    logger.info("Chat session messages retrieved", {
      sessionId: req.params.sessionId,
      count: messages?.length || 0,
    });
    res.json(messages);
  } catch (err) {
    logger.error("Get session messages failed", err);
    res
      .status(500)
      .json({ error: "Failed to fetch session", detail: err.message });
  }
});

// DELETE /api/chat/session/:sessionId  — delete a chat session
app.delete("/api/chat/session/:sessionId", async (req, res) => {
  try {
    await mongoService.deleteSession(req.params.sessionId);
    logger.info("Chat session deleted", { sessionId: req.params.sessionId });
    res.json({ ok: true });
  } catch (err) {
    logger.error("Delete session failed", err);
    res
      .status(500)
      .json({ error: "Failed to delete session", detail: err.message });
  }
});

// ─── Main Chat Route (also at /api/chat for direct POST) ─────────────────────

app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId, userId } = req.body;
    if (!message) {
      logger.warn("Chat request missing message", { sessionId, userId });
      return res.status(400).json({ error: "message is required" });
    }
    logger.info("Chat query received", {
      message: message.substring(0, 100),
      sessionId,
      userId,
    });
    const result = await ragService.chat(
      message,
      sessionId || null,
      userId || null,
    );
    res.json(result);
  } catch (err) {
    logger.error("Chat processing failed", err);
    res.status(500).json({ error: "Chat failed", detail: err.message });
  }
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────
// Simple crypto-based token auth (no external JWT dependency needed)

const crypto = require("crypto");

const _users = () => mongoService.db.collection("users");

function hashPassword(pw) {
  return crypto
    .createHash("sha256")
    .update(pw + "floatchat_salt_2026")
    .digest("hex");
}

function makeToken(userId) {
  return crypto
    .createHash("sha256")
    .update(String(userId) + Date.now() + "argo")
    .digest("hex");
}

// POST /api/auth/signup
app.post("/api/auth/signup", async (req, res) => {
  try {
    await mongoService.connect();
    const { email, password, name, role = "researcher" } = req.body;
    if (!email || !password) {
      logger.warn("Signup: missing credentials", { email });
      return res.status(400).json({ error: "email and password required" });
    }

    const existing = await _users().findOne({ email: email.toLowerCase() });
    if (existing) {
      logger.warn("Signup: email already exists", {
        email: email.toLowerCase(),
      });
      return res.status(409).json({ error: "Email already registered" });
    }

    const hash = hashPassword(password);
    const token = makeToken(email);
    const doc = {
      email: email.toLowerCase(),
      name: name || email.split("@")[0],
      role,
      passwordHash: hash,
      token,
      createdAt: new Date(),
    };
    await _users().insertOne(doc);
    logger.info("User registered", { email: doc.email, role: doc.role });

    const user = {
      id: doc._id,
      email: doc.email,
      name: doc.name,
      role: doc.role,
    };
    res.json({ token, user });
  } catch (err) {
    logger.error("Signup failed", err);
    res.status(500).json({ error: "Signup failed", detail: err.message });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    await mongoService.connect();
    const { email, password } = req.body;
    if (!email || !password) {
      logger.warn("Login: missing credentials", { email });
      return res.status(400).json({ error: "email and password required" });
    }

    const doc = await _users().findOne({ email: email.toLowerCase() });
    if (!doc || doc.passwordHash !== hashPassword(password)) {
      logger.warn("Login: invalid credentials", { email: email.toLowerCase() });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Refresh token on each login
    const token = makeToken(doc._id);
    await _users().updateOne(
      { _id: doc._id },
      { $set: { token, lastLogin: new Date() } },
    );
    logger.info("User logged in", { email: doc.email });

    const user = {
      id: doc._id,
      email: doc.email,
      name: doc.name,
      role: doc.role,
    };
    res.json({ token, user });
  } catch (err) {
    logger.error("Login failed", err);
    res.status(500).json({ error: "Login failed", detail: err.message });
  }
});

// POST /api/auth/logout
app.post("/api/auth/logout", async (req, res) => {
  logger.info("User logged out");
  res.json({ ok: true });
});

// GET /api/auth/verify  — check token validity
app.get("/api/auth/verify", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.warn("Auth verify: no token");
      return res.status(401).json({ error: "No token" });
    }
    const token = authHeader.replace("Bearer ", "");
    const doc = await _users().findOne({ token });
    if (!doc) {
      logger.warn("Auth verify: invalid token");
      return res.status(401).json({ error: "Invalid token" });
    }
    res.json({
      valid: true,
      user: { id: doc._id, email: doc.email, name: doc.name, role: doc.role },
    });
  } catch (err) {
    logger.error("Auth verify failed", err);
    res.status(500).json({ error: "Verify failed" });
  }
});

// ─── Direct MCP Tool Endpoint ─────────────────────────────────────────────────
// POST /api/mcp/tool  — call any MCP tool by name with params (for advanced UI use)
app.post("/api/mcp/tool", async (req, res) => {
  try {
    const { tool, params = {} } = req.body;
    if (!tool) {
      logger.warn("MCP tool: missing tool name");
      return res.status(400).json({ error: "tool name is required" });
    }
    logger.info("MCP tool called", { tool, paramKeys: Object.keys(params) });
    const result = await mcpService.runTool(tool, params);
    res.json(result);
  } catch (err) {
    logger.error("MCP tool execution failed", err);
    res.status(500).json({ error: "MCP tool failed", detail: err.message });
  }
});

// ─── All other /api/* routes from chatRoutes.js ──────────────────────────────

app.use("/api", createRoutes(ragService, mongoService, vectorService));

// ─── Health Check ────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    uptime: process.uptime(),
    port: PORT,
    database: DB_NAME,
    mongodb: "connected",
    llm: "configured",
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  logger.warn("Route not found", { method: req.method, path: req.path });
  res.status(404).json({ error: "Route not found", path: req.path });
});

// ─── Global Error Handler ────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  logger.error("Unhandled request error", err);
  res
    .status(500)
    .json({
      error: "Internal server error",
      detail: process.env.NODE_ENV === "dev" ? err.message : undefined,
    });
});

// ─── Bootstrap & Startup ─────────────────────────────────────────────────────

async function start() {
  try {
    logger.info("Connecting to MongoDB", { uri: MONGO_URI });
    await mongoService.connect();
    logger.info("MongoDB connected");

    logger.info("Initializing VectorService");
    await vectorService.connect();
    logger.info("VectorService initialized");

    app.listen(PORT, () => {
      logger.info("🚀 FloatChat-AI Server started successfully", {
        port: PORT,
      });
      console.log(`\n   MongoDB:  ${MONGO_URI} / ${DB_NAME}`);
      console.log(`   LLM:      ${LLM_MODEL} (via ${LLM_BASE_URL})`);
      console.log(`   Health:   http://localhost:${PORT}/health`);
      console.log(`   API Docs: See routes/ and services/\n`);
    });
  } catch (err) {
    logger.error("Fatal startup error", err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

start();
