import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Shield,
  ArrowLeft,
  Home,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";

const AccessDenied = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ocean-50 to-teal-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        {/* Icon and Header */}
        <div className="mb-8">
          <div className="flex justify-center mb-6">
            <div className="flex items-center justify-center w-20 h-20 bg-red-100 rounded-2xl">
              <Shield className="w-10 h-10 text-red-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            You don't have permission to access this feature
          </p>
        </div>

        {/* User Info */}
        {user && (
          <div className="glass-effect rounded-xl p-6 mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-12 h-12 ocean-gradient rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-lg">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">{user.name}</h3>
                <p className="text-sm text-gray-600 capitalize">{user.role}</p>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
              <AlertTriangle className="w-4 h-4" />
              <span>Chat interface requires researcher access</span>
            </div>
          </div>
        )}

        {/* Access Requirements */}
        <div className="glass-effect rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Required Access
          </h3>
          <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Chat Interface</p>
              <p className="text-sm text-gray-600">Researcher</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/dashboard"
              className="btn-primary flex items-center justify-center space-x-2"
            >
              <Home className="w-4 h-4" />
              <span>Go to Dashboard</span>
            </Link>

            <button
              onClick={handleLogout}
              className="btn-secondary flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Switch Account</span>
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Need different access?{" "}
              <Link
                to="/signup"
                className="text-ocean-600 hover:text-ocean-700 font-medium transition-colors duration-200"
              >
                Create a new account
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Info */}
        <div className="mt-8 p-4 bg-ocean-50 rounded-lg">
          <h4 className="text-sm font-medium text-ocean-800 mb-2">
            Demo Account:
          </h4>
          <div className="text-xs text-ocean-700 space-y-1">
            <p>
              <strong>Researcher:</strong> researcher@argo.com / password
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
