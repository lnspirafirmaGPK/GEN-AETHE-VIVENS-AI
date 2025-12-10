
import React, { useState, useEffect } from 'react';
import { MessageSquareText, Mic2, FileText, Sparkles, Moon, Sun, Globe, Code, ShieldAlert } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import LiveInterface from './components/LiveInterface';
import Transcriber from './components/Transcriber';
import CodegenInterface from './components/CodegenInterface'; // Import new CodegenInterface
import { AppMode, Language, VoiceName, PREBUILT_VOICES } from './types'; // Import VoiceName and PREBUILT_VOICES
import { translations } from './utils/localization';

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<AppMode>(() => {
    const savedMode = localStorage.getItem('activeMode');
    return savedMode ? (savedMode as AppMode) : AppMode.Chat;
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage ? (savedLanguage as Language) : 'en';
  });
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(() => { // NEW: Voice selection state
    const savedVoice = localStorage.getItem('selectedVoice');
    // Default to 'Kore' if no voice is saved or if saved voice is not in PREBUILT_VOICES
    return (savedVoice && PREBUILT_VOICES.includes(savedVoice as VoiceName)) ? (savedVoice as VoiceName) : 'Kore';
  });
  const [systemDissonance, setSystemDissonance] = useState<number | null>(null); // NEW: Global system dissonance for Codegen

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('activeMode', activeMode);
  }, [activeMode]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => { // NEW: Persist selected voice
    localStorage.setItem('selectedVoice', selectedVoice);
  }, [selectedVoice]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  
  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'th' : 'en');
  };

  const t = translations[language];

  const getDissonanceColorClass = (score: number | null) => {
    if (score === null) return 'text-slate-500 dark:text-slate-400';
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 font-sans">
      {/* Sidebar / Navigation */}
      <div className="w-20 lg:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between flex-shrink-0 transition-colors duration-200">
        <div>
          <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100 dark:border-slate-800 relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
              AI
            </div>
            <span className="hidden lg:block ml-3 font-bold text-slate-800 dark:text-slate-100 text-sm xl:text-lg truncate">GEN-AETHE-VIVENS-AI</span>
            {systemDissonance !== null && (
              <div className="hidden lg:flex items-center gap-1 ml-4 text-xs">
                <ShieldAlert size={14} className={getDissonanceColorClass(systemDissonance)} />
                <span className={`${getDissonanceColorClass(systemDissonance)} font-semibold`}>
                  {systemDissonance}
                </span>
              </div>
            )}
          </div>

          <nav className="p-4 space-y-2">
            <button
              onClick={() => setActiveMode(AppMode.Chat)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeMode === AppMode.Chat 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <MessageSquareText size={22} />
              <span className="hidden lg:block">{t.sidebar.chat}</span>
            </button>

            <button
              onClick={() => setActiveMode(AppMode.Live)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeMode === AppMode.Live 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Mic2 size={22} />
              <span className="hidden lg:block">{t.sidebar.live}</span>
            </button>

            <button
              onClick={() => setActiveMode(AppMode.Transcribe)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeMode === AppMode.Transcribe 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <FileText size={22} />
              <span className="hidden lg:block">{t.sidebar.transcribe}</span>
            </button>

            {/* NEW: Codegen Button */}
            <button
              onClick={() => setActiveMode(AppMode.Codegen)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeMode === AppMode.Codegen
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Code size={22} />
              <span className="hidden lg:block">{t.sidebar.codegen}</span>
            </button>
          </nav>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            {/* Language Toggle - Small Icon Corner Side */}
            <button
              onClick={toggleLanguage}
              className="flex-1 lg:flex-none w-full lg:w-auto flex items-center justify-center lg:justify-start gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title="Switch Language"
            >
              <Globe size={22} />
              <span className="hidden lg:block font-medium">{language.toUpperCase()}</span>
            </button>

             {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="flex-1 w-full lg:w-auto flex items-center justify-center lg:justify-start gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
              <span className="hidden lg:block">{isDarkMode ? t.sidebar.light : t.sidebar.dark}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white hidden lg:block shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} />
              <span className="font-semibold text-sm">{t.sidebar.proTitle}</span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed">
              {t.sidebar.proDesc}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-4 lg:p-6 relative">
        <div className="h-full w-full max-w-6xl mx-auto">
          {activeMode === AppMode.Chat && <ChatInterface translations={t.chat} />}
          {activeMode === AppMode.Live && <LiveInterface translations={t.live} selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice} />} {/* Pass voice state */}
          {activeMode === AppMode.Transcribe && <Transcriber translations={t.transcribe} />}
          {activeMode === AppMode.Codegen && <CodegenInterface translations={t.codegen} onUpdateSystemDissonance={setSystemDissonance} />}
        </div>
      </main>
    </div>
  );
};

export default App;