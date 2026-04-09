import React, { useState, useEffect } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import ConversationContainer from "../components/ChatGPT/ConversationContainer";
import Dashboard from "../components/Dashboard/Dashboard";
import DataExplorer from "../components/DataExplorer/DataExplorer";
import { AnimatePresence } from "framer-motion";

import ErrorBoundary from "../components/ErrorBoundary";

const AppContent = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname.replace("/", "") || "dashboard";
    setActiveTab(path);
  }, [location.pathname]);

  const renderActiveComponent = () => {
    switch (activeTab) {
      case "chat":
        return <ConversationContainer key="chat" />;
      case "dashboard":
        return <Dashboard key="dashboard" />;
      case "data-explorer":
        return <DataExplorer key="data-explorer" />;
      default:
        return <Dashboard key="dashboard" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
      <main className="pt-[72px]">
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            {renderActiveComponent()}
          </AnimatePresence>
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default AppContent;
