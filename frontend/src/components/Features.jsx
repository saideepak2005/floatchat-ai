import { motion } from "framer-motion";
import {
  MessageSquareText,
  Map,
  BarChart3,
  Download,
  BrainCircuit,
  Globe2,
} from "lucide-react";

const features = [
  {
    icon: MessageSquareText,
    title: "Natural Language Chat",
    desc: "Ask questions about oceanographic data in plain English. Get instant insights and visualizations.",
    iconBg: "#f0fdfa",
    iconColor: "#14b8a6",
    borderColor: "#ccfbf1",
  },
  {
    icon: Map,
    title: "Interactive ARGO Float Maps",
    desc: "Explore real-time ARGO float locations with interactive maps showing trajectories and data coverage.",
    iconBg: "#f0f9ff",
    iconColor: "#0284c7",
    borderColor: "#e0f2fe",
  },
  {
    icon: BarChart3,
    title: "Profile Visualizations",
    desc: "Create stunning temperature and salinity depth profiles with interactive charts and graphs.",
    iconBg: "#f0fdfa",
    iconColor: "#0d9488",
    borderColor: "#ccfbf1",
  },
  {
    icon: Download,
    title: "Data Downloads",
    desc: "Export data in multiple formats: NetCDF, CSV, Parquet, and JSON for further analysis.",
    iconBg: "#f0f9ff",
    iconColor: "#0284c7",
    borderColor: "#bae6fd",
  },
  {
    icon: BrainCircuit,
    title: "AI-Powered Analysis",
    desc: "Leverage machine learning algorithms to identify patterns and anomalies in oceanographic data.",
    iconBg: "#f0fdfa",
    iconColor: "#14b8a6",
    borderColor: "#99f6e4",
  },
  {
    icon: Globe2,
    title: "Indian Ocean Focus",
    desc: "Access data from thousands of ARGO floats across the Indian Ocean basins.",
    iconBg: "#f0f9ff",
    iconColor: "#0ea5e9",
    borderColor: "#e0f2fe",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", damping: 20, stiffness: 100 },
  },
};

export default function Features() {
  return (
    <section id="features" style={{ padding: "80px 20px 100px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        {/* Header */}
        <motion.div
          style={{ textAlign: "center", marginBottom: "60px" }}
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
            Powerful Features for{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #0ea5e9, #14b8a6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Ocean Data Exploration
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
            Discover the full potential of ARGO float data with our
            comprehensive suite of tools and visualizations.
          </p>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            gap: "20px",
          }}
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={item}
              whileHover={{ y: -8, scale: 1.03 }}
              style={{
                background: "white",
                borderRadius: "20px",
                padding: "28px",
                border: `2px solid ${feature.borderColor}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 16px 50px rgba(0,0,0,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "20px",
                }}
              >
                <motion.div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: feature.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.3s ease",
                  }}
                  whileHover={{ rotate: 12, scale: 1.1 }}
                >
                  <motion.div
                    whileHover={{ scale: 1.2 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <feature.icon
                      style={{
                        width: 24,
                        height: 24,
                        color: feature.iconColor,
                      }}
                    />
                  </motion.div>
                </motion.div>
                <div>
                  <h3
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      color: "#1e293b",
                      marginBottom: 8,
                    }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    style={{
                      color: "#64748b",
                      lineHeight: 1.6,
                      fontSize: "0.95rem",
                    }}
                  >
                    {feature.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
