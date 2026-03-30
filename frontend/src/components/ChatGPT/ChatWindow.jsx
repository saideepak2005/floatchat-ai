import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  User,
  Bot,
  Copy,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import ChatMessageRenderer from "./ChatMessageRenderer";

const ChatWindow = ({ chatId, messages, onSendMessage, isTyping }) => {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "--:--";
    }
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
  };

  if (!chatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 overflow-hidden pt-16">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-cyan-500/20">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">
            Indian Ocean Intelligence
          </h2>
          <p className="text-slate-600 mb-10 text-lg leading-relaxed">
            Initialize a secure transmission to begin analyzing subsurface telemetry and trajectories across the Indian Ocean array.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-white rounded-xl border border-slate-200 hover:border-cyan-400 hover:shadow-lg transition-all duration-300 text-left group">
              <h3 className="font-bold text-slate-800 mb-2 group-hover:text-cyan-600 transition-colors">
                Thermal Mapping
              </h3>
              <p className="text-sm text-slate-500">
                Identify thermocline anomalies across the Indian Ocean array.
              </p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-slate-200 hover:border-cyan-400 hover:shadow-lg transition-all duration-300 text-left group">
              <h3 className="font-bold text-slate-800 mb-2 group-hover:text-cyan-600 transition-colors">
                Salinity Diffusion
              </h3>
              <p className="text-sm text-slate-500">
                Analyze PSU gradients in the Indian Ocean boundary.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden pt-16">
      {/* Messages area */}
      <div 
        ref={scrollRef}
        className="flex-1 px-4 md:px-8 py-8 space-y-8 overflow-y-auto scroll-smooth"
      >
        {messages.map((message, index) => (
          <div
            key={message.id || index}
            className={`flex ${
              message.type === "user" ? "justify-end" : "justify-start"
            } animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            <div
              className={`flex items-start space-x-4 max-w-4xl ${
                message.type === "user"
                  ? "flex-row-reverse space-x-reverse"
                  : ""
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                  message.type === "user" 
                    ? "bg-slate-800 text-white" 
                    : "bg-white border border-slate-200 text-cyan-600"
                }`}
              >
                {message.type === "user" ? (
                  <User className="w-5 h-5" />
                ) : (
                  <Bot className="w-5 h-5" />
                )}
              </div>

              {/* Message Content */}
              <div
                className={`flex flex-col ${
                  message.type === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-5 py-4 shadow-sm ${
                    message.type === "user"
                      ? "bg-cyan-600 text-white"
                      : "bg-white border border-slate-200 text-slate-800"
                  }`}
                >
                  <div className={`prose ${message.type === "user" ? "prose-invert" : "prose-slate"} prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-code:text-cyan-600 prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-strong:text-inherit`}>
                    {message.type === "ai" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content || ""}
                      </ReactMarkdown>
                    ) : (
                      <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
                        {message.content}
                      </div>
                    )}
                  </div>

                  {/* Code/JSON Block — only show if no visual renderer will handle it */}
                  {message.hasCode && (!message.tool_result || message.tool_result.type === 'data') && (
                    <div className="mt-5 bg-slate-900 rounded-xl p-5 text-cyan-300 text-sm font-mono overflow-x-auto border border-slate-700/50 shadow-inner">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-widest flex items-center">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                          System Output / Intent
                        </span>
                        <button
                          onClick={() => handleCopy(message.code)}
                          className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-cyan-400"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <pre className="text-xs leading-relaxed">{message.code}</pre>
                    </div>
                  )}
                </div>

                {/* ── MCP Tool Visualization Renderer ─────────────────── */}
                {message.type === "ai" && message.tool_result && (
                  <div className="w-full max-w-3xl">
                    <ChatMessageRenderer toolResult={message.tool_result} />
                  </div>
                )}

                {/* Metadata */}
                <div className="mt-2 flex items-center space-x-3 text-[11px] font-bold uppercase tracking-tighter text-slate-400">
                  <span>{formatTime(message.timestamp)}</span>
                  {message.type === "ai" && message.tool_used && (
                    <span className="text-cyan-500 text-[10px] lowercase tracking-wide font-mono">⚙ {message.tool_used}</span>
                  )}
                  {message.type === "ai" && (
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="hover:text-cyan-500"><ThumbsUp className="w-3 h-3" /></button>
                      <button className="hover:text-red-500"><ThumbsDown className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center">
                <Bot className="w-5 h-5 text-cyan-600" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm">
                <div className="flex items-center space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
