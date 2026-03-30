import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Smile, Plus } from "lucide-react";

const ChatInput = ({ onSendMessage, isTyping, disabled }) => {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = true;
      recog.lang = "en-US";

      recog.onresult = (event) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setMessage(currentTranscript);
      };

      recog.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recog.onend = () => {
        // Automatically send the message when speech stops if we want, but letting user review is safer
        setIsRecording(false);
      };

      setRecognition(recog);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isTyping) {
      onSendMessage(message.trim());
      setMessage("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e) => {
    setMessage(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  const toggleRecording = () => {
    if (!recognition) {
      alert(
        "Voice recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.",
      );
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      setMessage("");
      recognition.start();
      setIsRecording(true);
    }
  };

  return (
    <div className="bg-slate-900 border-t border-slate-700/50 p-4 relative z-20">
      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end space-x-3 max-w-5xl mx-auto"
      >
        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyPress={handleKeyPress}
            placeholder="Ask anything about oceanic arrays or telemetry (Voice mode active)..."
            disabled={disabled}
            className="w-full px-4 py-4 pr-12 border border-slate-700 rounded-2xl resize-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 bg-slate-800 text-slate-100 placeholder-slate-400 font-medium"
            style={{ minHeight: "56px", maxHeight: "120px" }}
            rows={1}
          />

          {/* Emoji Button - Disabled for pure data focus, optionally uncomment */}
          <button
            type="button"
            className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 text-slate-400 hover:text-cyan-400 transition-colors duration-200"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Microphone Button */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={disabled}
            className={`p-4 rounded-xl transition-all duration-300 transform active:scale-95 ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 animate-pulse"
                : "bg-slate-800 text-slate-300 border border-slate-700 hover:text-cyan-400 hover:border-cyan-500 hover:bg-slate-700"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            title={isRecording ? "Stop Recording" : "Start Voice Dictation"}
          >
            {isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!message.trim() || disabled || isTyping}
            className="p-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-cyan-500/50"
          >
            {isTyping ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send className="w-5 h-5 ml-1" />
            )}
          </button>
        </div>
      </form>

      {/* Input Hints */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400 max-w-5xl mx-auto px-2">
        <div className="flex items-center space-x-4 font-mono">
          <span>[Enter] to transmit</span>
          <span>[Shift+Enter] for new line</span>
        </div>
        <div className="flex items-center space-x-2 font-mono">
          <span className="text-cyan-400 tracking-wide">
            {isRecording ? "LISTENING..." : "VOICE UPLINK STANDBY"}
          </span>
          <div
            className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500 animate-ping" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"}`}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
