import { motion } from "framer-motion";
import {
  Atom,
  Paintbrush,
  Database,
  Search,
  LineChart,
  MapPinned,
  FileCode2,
  Check,
  Server,
  Layers,
  Box,
  Cpu,
} from "lucide-react";

const techLogos = [
  { icon: Atom, name: "React", bg: "#f0f9ff", color: "#0284c7" },
  { icon: Paintbrush, name: "Tailwind CSS", bg: "#f0fdfa", color: "#14b8a6" },
  { icon: Database, name: "MongoDB", bg: "#f0f9ff", color: "#0ea5e9" },
  { icon: Server, name: "Node.js", bg: "#f0fdfa", color: "#0d9488" },
  { icon: Box, name: "ChromaDB", bg: "#f0f9ff", color: "#0284c7" },
  { icon: Layers, name: "LangChain", bg: "#f0fdfa", color: "#14b8a6" },
  { icon: Cpu, name: "Ollama", bg: "#f0f9ff", color: "#0d9488" },
  { icon: LineChart, name: "Plotly", bg: "#f0fdfa", color: "#0284c7" },
  { icon: MapPinned, name: "Leaflet", bg: "#f0f9ff", color: "#14b8a6" },
  { icon: FileCode2, name: "NetCDF", bg: "#f0fdfa", color: "#0d9488" },
];

const categories = [
  {
    title: "AI & Analytics",
    desc: "Local embeddings, Vector search, and LLM orchestration.",
    items: [
      "Qwen3.5-397b-a17b",
      "ChromaDB Vector Store",
      "LangChain + FastMCP",
    ],
    gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    bg: "#f5f3ff",
  },
  {
    title: "Visualization & Map",
    desc: "Interactive oceanographic charts and trajectory mapping.",
    items: ["Plotly.js (Depth/TS Plots)", "React Leaflet", "Real-time routing"],
    gradient: "linear-gradient(135deg, #22c55e, #059669)",
    bg: "#f0fdf4",
  },
  {
    title: "Frontend Layer",
    desc: "Responsive user interface with seamless animations and state.",
    items: ["React (Vite)", "Tailwind CSS v4", "Zustand State"],
    gradient: "linear-gradient(135deg, #06b6d4, #2563eb)",
    bg: "#ecfeff",
  },
  {
    title: "Data & Backend",
    desc: "Secure data ingestion, storage, and RESTful API delivery.",
    items: [
      "MongoDB (Profiles/Floats)",
      "Node.js + Express API",
      "Python Pipeline",
    ],
    gradient: "linear-gradient(135deg, #14b8a6, #0284c7)",
    bg: "#f0fdfa",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, scale: 0.9 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", damping: 15, stiffness: 120 },
  },
};

export default function TechStack() {
  return (
    <section
      id="tech-stack"
      style={{
        padding: "80px 20px 100px",
        background:
          "linear-gradient(180deg, white 0%, #f0f9ff 50%, white 100%)",
      }}
    >
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        {/* Header */}
        <motion.div
          style={{ textAlign: "center", marginBottom: "48px" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
        >
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              fontWeight: 800,
              color: "#0f172a",
              marginBottom: "16px",
              lineHeight: 1.2,
            }}
          >
            Built with{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #0ea5e9, #14b8a6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Modern Technology Stack
            </span>
          </h2>
          <p
            style={{
              fontSize: "1.05rem",
              color: "#94a3b8",
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            Powered by cutting-edge technologies for performance, scalability,
            and reliability.
          </p>
        </motion.div>

        {/* Tech Logo Grid */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
            gap: "12px",
            marginBottom: "48px",
          }}
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
        >
          {techLogos.map((tech) => (
            <motion.div
              key={tech.name}
              variants={item}
              whileHover={{ y: -8, scale: 1.12 }}
              whileTap={{ scale: 0.95 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                padding: "16px 8px",
                borderRadius: "16px",
                background: tech.bg,
                cursor: "pointer",
                border: "2px solid transparent",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = tech.color;
                e.currentTarget.style.boxShadow = `0 8px 24px ${tech.color}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <motion.div
                whileHover={{ rotate: 12, scale: 1.15 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <tech.icon
                  style={{ width: 32, height: 32, color: tech.color }}
                />
              </motion.div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  textAlign: "center",
                }}
              >
                {tech.name}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* System Architecture Header */}
        <motion.h3
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#1e293b",
            textAlign: "center",
            marginBottom: "24px",
          }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          System Architecture
        </motion.h3>

        {/* Category Cards */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
            gap: "16px",
          }}
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
        >
          {categories.map((cat) => (
            <motion.div
              key={cat.title}
              variants={item}
              whileHover={{ y: -8, boxShadow: "0 16px 48px rgba(0,0,0,0.12)" }}
              style={{
                background: cat.bg,
                borderRadius: "20px",
                padding: "24px",
                border: "2px solid transparent",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = cat.gradient
                  .split(",")[0]
                  .slice(1);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: 8,
                  background: cat.gradient,
                  color: "white",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {cat.title}
              </div>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>
                {cat.desc}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {cat.items.map((techItem, idx) => (
                  <motion.div
                    key={techItem}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 14,
                      color: "#475569",
                    }}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <Check
                      style={{ width: 16, height: 16, color: "#14b8a6" }}
                    />
                    {techItem}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
