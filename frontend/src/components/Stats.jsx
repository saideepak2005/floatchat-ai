import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import {
  Anchor,
  BarChart3,
  Globe2,
  MapPin,
  Thermometer,
  Droplets,
  Database,
} from "lucide-react";

/* -------------------- Animated Counter -------------------- */
function AnimatedCounter({ target, suffix = "", duration = 2 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const end = target;
    const step = end / (duration * 60);

    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);

    return () => clearInterval(timer);
  }, [isInView, target, duration]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

/* -------------------- Stats Data -------------------- */
const stats = [
  {
    icon: Anchor,
    label: "Active ARGO Floats",
    type: "counter",
    value: 567,
  },
  { icon: BarChart3, label: "Data Points", type: "text", display: "1L+" },
  {
    icon: Globe2,
    label: "Ocean Coverage",
    type: "text",
    display: "Indian",
  },
];

/* -------------------- Data Cards -------------------- */
const dataCards = [
  {
    icon: MapPin,
    label: "Live Maps",
    desc: "Real-time ARGO locations",
    color: "from-teal-400 to-teal-600",
    bg: "bg-teal-50",
  },
  {
    icon: Thermometer,
    label: "Temperature",
    desc: "Depth profiles",
    color: "from-red-400 to-orange-500",
    bg: "bg-orange-50",
  },
  {
    icon: Droplets,
    label: "Salinity",
    desc: "Ocean chemistry",
    color: "from-blue-400 to-cyan-500",
    bg: "bg-blue-50",
  },
  {
    icon: Database,
    label: "Data Export",
    desc: "Multiple formats",
    color: "from-emerald-400 to-teal-500",
    bg: "bg-emerald-50",
  },
];

/* -------------------- Main Component -------------------- */
export default function Stats() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6 }}
      style={{ padding: "40px 20px 60px" }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          background: "white",
          borderRadius: "24px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          border: "1px solid #f1f5f9",
          padding: "40px 32px",
        }}
      >
        {/* ---------------- Stats Row ---------------- */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "24px",
          }}
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                borderRight: i < 2 ? "1px solid #f1f5f9" : "none",
                padding: "0 16px",
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
            >
              <stat.icon
                style={{
                  width: 24,
                  height: 24,
                  color: "#14b8a6",
                  marginBottom: 4,
                }}
              />

              <div
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                {stat.type === "counter" ? (
                  <AnimatedCounter target={stat.value} duration={1.8} />
                ) : (
                  stat.display
                )}
              </div>

              <p
                style={{
                  fontSize: 14,
                  color: "#94a3b8",
                  fontWeight: 500,
                }}
              >
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* ---------------- Divider ---------------- */}
        <div
          style={{
            height: "1px",
            background: "#f1f5f9",
            margin: "32px 0",
          }}
        />

        {/* ---------------- Data Cards ---------------- */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "16px",
          }}
        >
          {dataCards.map((card, i) => (
            <motion.div
              key={card.label}
              className={card.bg}
              style={{
                borderRadius: "20px",
                padding: "20px 16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                border: "2px solid rgba(255,255,255,0.8)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
              whileHover={{ scale: 1.08, y: -6 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 12px 32px rgba(0,0,0,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
              }}
            >
              <motion.div
                className={`bg-gradient-to-br ${card.color}`}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                whileHover={{ rotate: 12, scale: 1.15 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <motion.div whileHover={{ scale: 1.1 }}>
                  <card.icon
                    style={{ width: 22, height: 22, color: "white" }}
                  />
                </motion.div>
              </motion.div>

              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#1e293b",
                  }}
                >
                  {card.label}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                  }}
                >
                  {card.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
