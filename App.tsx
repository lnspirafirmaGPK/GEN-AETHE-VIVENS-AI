import React, { useState } from 'react';
import { MessageSquareText, Mic2, FileText, Sparkles } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import LiveInterface from './components/LiveInterface';
import Transcriber from './components/Transcriber';
import { AppMode } from './types';

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.Chat);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar / Navigation */}
      <div className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col justify-between flex-shrink-0">
        <div>
          <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              AI
            </div>
            <span className="hidden lg:block ml-3 font-bold text-slate-800 text-lg">ThaiGemini</span>
          </div>

          <nav className="p-4 space-y-2">
            <button
              onClick={() => setActiveMode(AppMode.Chat)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeMode === AppMode.Chat 
                  ? 'bg-blue-50 text-blue-600 font-medium shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <MessageSquareText size={22} />
              <span className="hidden lg:block">Chat & Reason</span>
            </button>

            <button
              onClick={() => setActiveMode(AppMode.Live)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeMode === AppMode.Live 
                  ? 'bg-blue-50 text-blue-600 font-medium shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Mic2 size={22} />
              <span className="hidden lg:block">Live Voice</span>
            </button>

            <button
              onClick={() => setActiveMode(AppMode.Transcribe)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeMode === AppMode.Transcribe 
                  ? 'bg-blue-50 text-blue-600 font-medium shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <FileText size={22} />
              <span className="hidden lg:block">Transcribe</span>
            </button>
          </nav>
        </div>

        <div className="p-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white hidden lg:block">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} />
              <span className="font-semibold text-sm">Pro Features</span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed">
              Experience the power of Gemini 3.0 Pro for complex reasoning and Native Audio for real-time talk.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-4 lg:p-6 relative">
        <div className="h-full w-full max-w-6xl mx-auto">
          {activeMode === AppMode.Chat && <ChatInterface />}
          {activeMode === AppMode.Live && <LiveInterface />}
          {activeMode === AppMode.Transcribe && <Transcriber />}
        </div>
      </main>
    </div>
  );
};

export default App;