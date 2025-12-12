import React from 'react';
import { Settings, Moon, Sun, Globe, Monitor, Shield, Info, Volume2 } from 'lucide-react';
import { Language, VoiceName, PREBUILT_VOICES } from '../types';

interface SettingsInterfaceProps {
  translations: any; // Changed to any to accept the full translation object
  isDarkMode: boolean;
  toggleTheme: () => void;
  language: Language;
  toggleLanguage: () => void;
  selectedVoice: VoiceName;
  setSelectedVoice: (voice: VoiceName) => void;
}

const SettingsInterface: React.FC<SettingsInterfaceProps> = ({ 
  translations, 
  isDarkMode, 
  toggleTheme, 
  language, 
  toggleLanguage,
  selectedVoice,
  setSelectedVoice
}) => {
  return (
    <div className="h-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 overflow-y-auto transition-colors duration-200">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mb-2">
            <Settings size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{translations.title}</h2> {/* Use translations.settings.title */}
          <p className="text-slate-500 dark:text-slate-400">
            {translations.subtitle} {/* Use translations.settings.subtitle */}
          </p>
        </div>

        {/* Appearance Section */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Monitor size={18} className="text-indigo-500" />
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">{translations.appearance}</h3> {/* Use translations.settings.appearance */}
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-slate-700' : 'bg-orange-100'} transition-colors`}>
                  {isDarkMode ? <Moon size={20} className="text-white" /> : <Sun size={20} className="text-orange-500" />}
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{translations.appearance}</p> {/* Use translations.settings.appearance */}
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {isDarkMode ? 'Dark Mode Active' : 'Light Mode Active'}
                  </p>
                </div>
              </div>
              <button 
                onClick={toggleTheme}
                className="px-4 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
              >
                Toggle
              </button>
            </div>
          </div>
        </div>

        {/* System & Language Section */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Globe size={18} className="text-blue-500" />
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">{translations.system}</h3> {/* Use translations.settings.system */}
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Globe size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{translations.language}</p> {/* Use translations.settings.language */}
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {language === 'en' ? 'English' : 'ภาษาไทย'}
                  </p>
                </div>
              </div>
              <button 
                onClick={toggleLanguage}
                className="px-4 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-sm font-medium uppercase"
              >
                {language}
              </button>
            </div>

            {/* Default Voice Setting */}
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Volume2 size={20} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{translations.voice}</p> {/* Use translations.settings.voice */}
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedVoice}
                  </p>
                </div>
              </div>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PREBUILT_VOICES.map(voice => (
                  <option key={voice} value={voice}>{voice}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Info size={18} className="text-slate-500" />
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">{translations.about}</h3> {/* Use translations.settings.about */}
          </div>
          <div className="p-6">
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Gen-Aethe-Vivens AI</span>
                    <span className="text-sm font-mono text-slate-500">{translations.version}</span> {/* Use translations.settings.version */}
                </div>
                <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-slate-500">{translations.developer}</span> {/* Use translations.settings.developer */}
                    <Shield size={14} className="text-green-500" />
                </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsInterface;