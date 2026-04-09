import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, Menu, X, Sailboat, LayoutDashboard, Map, MessageSquare, LogOut } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const landingLinks = [
  { label: "Features", href: "/#features" },
  { label: "Tech Stack", href: "/#tech-stack" },
  { label: "About", href: "/#about" },
];

export default function Navbar({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen }) {
  const [localMobileOpen, setLocalMobileOpen] = useState(false);
  
  const mobileOpen = isMobileMenuOpen !== undefined ? isMobileMenuOpen : localMobileOpen;
  const setMobileOpen = setIsMobileMenuOpen !== undefined ? setIsMobileMenuOpen : setLocalMobileOpen;
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isLandingPage = location.pathname === "/";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const appLinks = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { id: "data-explorer", label: "Data Explorer", icon: Map, path: "/data-explorer" },
    ...(user?.role === "researcher"
      ? [{ id: "chat", label: "Chat", icon: MessageSquare, path: "/chat" }] 
      : []),
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(226, 232, 240, 0.6)",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "68px",
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
          }}
          onClick={() => isLandingPage && window.scrollTo(0,0)}
        >
          <motion.div
            style={{
              width: 40,
              height: 40,
              background: "linear-gradient(135deg, #14b8a6, #0284c7)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(20, 184, 166, 0.3)",
            }}
            whileHover={{ rotate: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <motion.div
              animate={{ y: [-2, 2, -2] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Sailboat style={{ width: 20, height: 20, color: "white" }} />
            </motion.div>
          </motion.div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
              FloatChat AI
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.5px" }}>
              Ocean Data Intelligence
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }} className="hidden md:flex">
          {activeTab ? (
            appLinks.map((link) => (
              <Link
                key={link.id}
                to={link.path}
                onClick={() => setActiveTab && setActiveTab(link.id)}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: activeTab === link.id ? "#0d9488" : "#475569",
                  background: activeTab === link.id ? "#f0fdfa" : "transparent",
                  borderRadius: 8,
                  textDecoration: "none",
                  transition: "all 0.2s",
                }}
              >
                <link.icon style={{ width: 16, height: 16 }} />
                {link.label}
              </Link>
            ))
          ) : (
            landingLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#475569",
                  borderRadius: 8,
                  textDecoration: "none",
                  transition: "all 0.2s",
                }}
              >
                {link.label}
              </a>
            ))
          )}
        </div>

        {/* Desktop Auth Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }} className="hidden md:flex">
          {user ? (
            <>
              {!activeTab && (
                <Link
                  to="/dashboard"
                  style={{
                    padding: "8px 16px",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    textDecoration: "none",
                  }}
                >
                  Go to App
                </Link>
              )}
              <button
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#ef4444",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <LogOut style={{ width: 16, height: 16 }} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#475569",
                  textDecoration: "none",
                }}
              >
                <LogIn style={{ width: 16, height: 16 }} />
                Sign In
              </Link>
              <Link
                to="/signup"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "white",
                  background: "linear-gradient(135deg, #14b8a6, #0284c7)",
                  borderRadius: 12,
                  textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(20, 184, 166, 0.25)",
                }}
              >
                <UserPlus style={{ width: 16, height: 16 }} />
                New Account
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden"
          style={{
            padding: 8,
            color: "#475569",
            borderRadius: 8,
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(16px)",
              borderTop: "1px solid rgba(226, 232, 240, 0.6)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {activeTab
                ? appLinks.map((link) => (
                    <Link
                      key={link.id}
                      to={link.path}
                      onClick={() => { setActiveTab && setActiveTab(link.id); setMobileOpen(false); }}
                      style={{ padding: "10px 16px", fontSize: 14, fontWeight: 500, color: activeTab === link.id ? "#0d9488" : "#475569", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <link.icon style={{ width: 16, height: 16 }} />
                      {link.label}
                    </Link>
                  ))
                : landingLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      style={{ padding: "10px 16px", fontSize: 14, fontWeight: 500, color: "#475569", textDecoration: "none" }}
                    >
                      {link.label}
                    </a>
                  ))}
              <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "8px 0" }} />
              {user ? (
                <button
                  onClick={() => { handleLogout(); setMobileOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 500, color: "#ef4444", background: "transparent", border: "none" }}
                >
                  <LogOut style={{ width: 16, height: 16 }} /> Logout
                </button>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 500, color: "#475569", textDecoration: "none" }}>
                    <LogIn style={{ width: 16, height: 16 }} /> Sign In
                  </Link>
                  <Link to="/signup" onClick={() => setMobileOpen(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "white", background: "linear-gradient(135deg, #14b8a6, #0284c7)", borderRadius: 12, textDecoration: "none" }}>
                    <UserPlus style={{ width: 16, height: 16 }} /> New Account
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
