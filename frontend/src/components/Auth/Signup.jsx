import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Waves,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  UserPlus,
} from "lucide-react";
import { motion } from "framer-motion";

const Signup = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (formData.password !== formData.confirmPassword)
      return setError("Passwords do not match");
    if (formData.password.length < 6)
      return setError("Password must be at least 6 characters");

    setLoading(true);
    try {
      await signup(formData.email, formData.password, formData.name);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.6, staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: "white",
        padding: "20px",
        paddingTop: "60px",
        paddingBottom: "60px",
      }}
    >
      {/* Background Elements */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        <motion.div
          style={{
            position: "absolute",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(20, 184, 166, 0.1), rgba(14, 165, 233, 0.05))",
            top: "-100px",
            right: "-100px",
          }}
          animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          style={{
            position: "absolute",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(2, 132, 199, 0.08), rgba(14, 165, 233, 0.03))",
            bottom: "-50px",
            left: "-50px",
          }}
          animate={{ y: [0, 20, 0], x: [0, -15, 0] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
      </div>

      <motion.div
        style={{
          maxWidth: "700px",
          width: "100%",
          position: "relative",
          zIndex: 10,
        }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div
          style={{ textAlign: "center", marginBottom: "32px" }}
          variants={itemVariants}
        >
          <motion.div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "24px",
            }}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "60px",
                height: "60px",
                background: "linear-gradient(135deg, #14b8a6, #0284c7)",
                borderRadius: "12px",
                boxShadow: "0 4px 15px rgba(20, 184, 166, 0.3)",
              }}
            >
              <Waves
                style={{ width: "32px", height: "32px", color: "white" }}
              />
            </div>
          </motion.div>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              background: "linear-gradient(135deg, #14b8a6, #0284c7)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "12px",
            }}
          >
            Create Your Account
          </h1>
          <p style={{ fontSize: "16px", color: "#64748b" }}>
            Join FloatChat AI to explore ocean data
          </p>
        </motion.div>

        {/* Signup Form Box */}
        <motion.div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 4px 20px rgba(20, 184, 166, 0.1)",
            border: "1px solid #e2e8f0",
          }}
          variants={itemVariants}
        >
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              style={{
                marginBottom: "16px",
                padding: "12px",
                background: "#fee2e2",
                border: "1px solid #fca5a5",
                borderRadius: "8px",
              }}
            >
              <p
                style={{ fontSize: "14px", fontWeight: 600, color: "#991b1b" }}
              >
                {error}
              </p>
            </motion.div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {/* Name and Email */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: "6px",
                  }}
                >
                  Full Name
                </label>
                <div style={{ position: "relative" }}>
                  <User
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "18px",
                      height: "18px",
                      color: "#14b8a6",
                    }}
                  />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    style={{
                      width: "100%",
                      paddingLeft: "40px",
                      paddingRight: "12px",
                      paddingTop: "10px",
                      paddingBottom: "10px",
                      background: "#f0fdfa",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#0f172a",
                      outline: "none",
                      transition: "all 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#14b8a6";
                      e.target.style.boxShadow =
                        "0 0 0 3px rgba(20, 184, 166, 0.1)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e2e8f0";
                      e.target.style.boxShadow = "none";
                    }}
                    placeholder="Your name"
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: "6px",
                  }}
                >
                  Email
                </label>
                <div style={{ position: "relative" }}>
                  <Mail
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "18px",
                      height: "18px",
                      color: "#14b8a6",
                    }}
                  />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    style={{
                      width: "100%",
                      paddingLeft: "40px",
                      paddingRight: "12px",
                      paddingTop: "10px",
                      paddingBottom: "10px",
                      background: "#f0fdfa",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#0f172a",
                      outline: "none",
                      transition: "all 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#14b8a6";
                      e.target.style.boxShadow =
                        "0 0 0 3px rgba(20, 184, 166, 0.1)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e2e8f0";
                      e.target.style.boxShadow = "none";
                    }}
                    placeholder="your@email.com"
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "14px 16px",
                borderRadius: "12px",
                border: "1px solid #ccfbf1",
                background: "#f0fdfa",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#0f766e",
                  marginBottom: "4px",
                }}
              >
                Researcher Access
              </p>
              <p style={{ fontSize: "13px", color: "#475569" }}>
                New accounts are created with researcher access for data
                exploration and FloatChat AI.
              </p>
            </div>

            {/* Password Fields */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: "6px",
                  }}
                >
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <Lock
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "18px",
                      height: "18px",
                      color: "#14b8a6",
                    }}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    style={{
                      width: "100%",
                      paddingLeft: "40px",
                      paddingRight: "40px",
                      paddingTop: "10px",
                      paddingBottom: "10px",
                      background: "#f0fdfa",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#0f172a",
                      outline: "none",
                      transition: "all 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#14b8a6";
                      e.target.style.boxShadow =
                        "0 0 0 3px rgba(20, 184, 166, 0.1)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e2e8f0";
                      e.target.style.boxShadow = "none";
                    }}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    {showPassword ? (
                      <EyeOff style={{ width: "18px", height: "18px" }} />
                    ) : (
                      <Eye style={{ width: "18px", height: "18px" }} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: "6px",
                  }}
                >
                  Confirm Password
                </label>
                <div style={{ position: "relative" }}>
                  <Lock
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "18px",
                      height: "18px",
                      color: "#14b8a6",
                    }}
                  />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    style={{
                      width: "100%",
                      paddingLeft: "40px",
                      paddingRight: "40px",
                      paddingTop: "10px",
                      paddingBottom: "10px",
                      background: "#f0fdfa",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#0f172a",
                      outline: "none",
                      transition: "all 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#14b8a6";
                      e.target.style.boxShadow =
                        "0 0 0 3px rgba(20, 184, 166, 0.1)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e2e8f0";
                      e.target.style.boxShadow = "none";
                    }}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    {showConfirmPassword ? (
                      <EyeOff style={{ width: "18px", height: "18px" }} />
                    ) : (
                      <Eye style={{ width: "18px", height: "18px" }} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #14b8a6, #0284c7)",
                color: "white",
                paddingTop: "12px",
                paddingBottom: "12px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "16px",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                marginTop: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 15px rgba(20, 184, 166, 0.3)",
                transition: "all 0.3s",
              }}
            >
              {loading ? (
                <>
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid white",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.6s linear infinite",
                    }}
                  />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <UserPlus style={{ width: "18px", height: "18px" }} />
                  <span>Sign Up</span>
                </>
              )}
            </motion.button>
          </form>

          <div
            style={{
              marginTop: "24px",
              textAlign: "center",
              borderTop: "1px solid #e2e8f0",
              paddingTop: "16px",
            }}
          >
            <p style={{ fontSize: "14px", color: "#64748b" }}>
              Already have an account?{" "}
              <Link
                to="/login"
                style={{
                  color: "#14b8a6",
                  fontWeight: 600,
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "color 0.2s",
                }}
              >
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Signup;
