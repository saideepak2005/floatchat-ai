import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();
const API_URL = "http://localhost:3001/api/auth";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session token
    const token = localStorage.getItem("argo_token");
    const savedUser = localStorage.getItem("argo_user");
    
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      } catch (e) {
        localStorage.removeItem("argo_token");
        localStorage.removeItem("argo_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/login`, { email, password });
      const { token, user: userData } = response.data;
      
      setUser(userData);
      localStorage.setItem("argo_token", token);
      localStorage.setItem("argo_user", JSON.stringify(userData));
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      
      return userData;
    } catch (error) {
      throw new Error(error.response?.data?.error || "Authentication failed. Terminal connection refused.");
    }
  };

  const signup = async (email, password, name) => {
    try {
      const response = await axios.post(`${API_URL}/signup`, {
        email,
        password,
        name,
      });
      const { token, user: userData } = response.data;
      
      setUser(userData);
      localStorage.setItem("argo_token", token);
      localStorage.setItem("argo_user", JSON.stringify(userData));
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      
      return userData;
    } catch (error) {
      throw new Error(error.response?.data?.error || "Registration failed. Node provisioning denied.");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("argo_token");
    localStorage.removeItem("argo_user");
    delete axios.defaults.headers.common["Authorization"];
  };

  const hasRole = (roles) => {
    if (!user || !user.role) return false;
    if (typeof roles === "string") return user.role === roles;
    if (Array.isArray(roles)) return roles.includes(user.role);
    return false;
  };

  const value = { user, login, signup, logout, hasRole, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
