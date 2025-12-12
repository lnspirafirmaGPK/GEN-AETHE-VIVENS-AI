import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Loader2, Code, LayoutDashboard, ThumbsUp, ThumbsDown, GitFork, ShieldAlert, CheckCircle, Ban, Book, Save, Trash2, Copy, Check, X } from 'lucide-react';
import { CodegenMessage, Sender, CodegenPhase, SavedCodeSnippet } from '../types';
import { v4 as uuidv4 } from 'uuid'; // For generating unique flow IDs

interface CodegenInterfaceProps {
  translations: any; // Changed to any to accept the full translation object
  onUpdateSystemDissonance?: (score: number | null) => void;
}

const CodegenInterface: React.FC<CodegenInterfaceProps> = ({ translations, onUpdateSystemDissonance }) => {
  const [messages, setMessages] = useState<CodegenMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Mock Patimokkha Status: For frontend demo, we'll derive this from the latest response
  const [latestValidationScore, setLatestValidationScore] = useState<number | null>(null);

  // Library State
  const [savedSnippets, setSavedSnippets] = useState<SavedCodeSnippet[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({});
  const [savedStates, setSavedStates] = useState<{[key: string]: boolean}>({}); // Visual feedback for save buttons

  useEffect(() => {
    // Load saved snippets
    const loaded = localStorage.getItem('savedCodeSnippets');
    if (loaded) {
      try {
        setSavedSnippets(JSON.parse(loaded));
      } catch (e) {
        console.error("Failed to parse saved snippets", e);
      }
    }

    // Welcome message - only on first load
    if (!hasInitialized.current) {
      setMessages([
        {
          id: 'init',
          role: Sender.Bot,
          text: translations.welcome, // Use translations.codegen.welcome
          timestamp: Date.now(),
          currentPhase: 'FINALIZED', // Initial state is 'finalized' as a welcome
          flowId: uuidv4(),
          validationScore: 100,
        }
      ]);
      hasInitialized.current = true;
    }
  }, [translations.welcome]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (onUpdateSystemDissonance) {
      onUpdateSystemDissonance(latestValidationScore);
    }
  }, [latestValidationScore, onUpdateSystemDissonance]);

  useEffect(() => {
    localStorage.setItem('savedCodeSnippets', JSON.stringify(savedSnippets));
  }, [savedSnippets]);

  const handleSendCommand = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userPrompt = inputValue;
    const requestId = uuidv4();

    const userMsg: CodegenMessage = {
      id: requestId,
      role: Sender.User,
      text: userPrompt,
      timestamp: Date.now(),
      flowId: requestId,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    setLatestValidationScore(null); // Reset score during new request

    try {
      // Create a temporary placeholder for the bot response, indicating streaming phase
      const botMsgId = uuidv4();
      setMessages(prev => [...prev, {
        id: botMsgId,
        role: Sender.Bot,
        timestamp: Date.now(),
        flowId: requestId,
        currentPhase: 'DRAFTING', // Start with Drafting phase
        isStreamingPhase: true, // Indicates that phases will update
      }]);

      // Simulate streaming phases
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate Gemini thinking
      
      setMessages(prev => prev.map(msg =>
        msg.id === botMsgId
          ? { ...msg, currentPhase: 'VETTING' } // Update to Vetting
          : msg
      ));

      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate Claude vetting

      // Simulate Claude's decision and code generation
      const mockScore = Math.floor(Math.random() * 100);
      let mockPhase: CodegenPhase = 'FINALIZED';
      let mockAuditReport = "SECURITY AUDIT: PASSED. Code logic appears sound. No malicious patterns detected.\nCompliance: AETHERIUM-GENESIS Protocol v1.0";
      let mockSourceCode = `def generated_function_${Date.now().toString().slice(-4)}():\n    # Gemini Drafted this based on: "${userPrompt}"\n    print('Hello World from Aetherium')\n    # ... more complex code related to "${userPrompt}"\n`;

      if (mockScore < 30) { // Simulate a blocked scenario
        mockPhase = 'BLOCKED';
        mockAuditReport = "SECURITY AUDIT: FAILED. Detected potential unsafe operations (e.g., eval, os.system). Code has been vetoed for non-compliance with AETHERIUM-GENESIS Protocol v1.0.";
        mockSourceCode = "# Code generation blocked due to security/ethical concerns.";
      } else if (mockScore < 60) {
        mockAuditReport = "SECURITY AUDIT: PASSED with MINOR WARNINGS. Consider adding input validation for parameters to prevent injection. Code logic appears sound.\nCompliance: AETHERIUM-GENESIS Protocol v1.0";
      }

      setMessages(prev => prev.map(msg =>
        msg.id === botMsgId
          ? {
              ...msg,
              currentPhase: mockPhase,
              validationScore: mockScore,
              isStreamingPhase: false, // Phases are done streaming
              artifact: {
                source_code: mockSourceCode,
                audit_report: mockAuditReport,
                engine_signature: "Dual-Core (Gemini+Claude)",
              },
            }
          : msg
      ));
      setLatestValidationScore(mockScore);

    } catch (error) {
      console.error("Codegen error:", error);
      setMessages(prev => prev.map(msg =>
        msg.id === requestId
          ? { ...msg, currentPhase: 'BLOCKED', text: translations.error, isStreamingPhase: false } // Use translations.codegen.error
          : msg
      ));
      setLatestValidationScore(0); // Indicate critical error
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = (messageId: string, feedbackType: 'POSITIVE' | 'NEGATIVE') => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, feedback: feedbackType } : msg
    ));
    // In a real app, send this feedback to the backend with flowId
    console.log(`Feedback for Flow ID ${messages.find(m => m.id === messageId)?.flowId}: ${feedbackType}`);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const handleSaveSnippet = (code: string, flowId: string, msgId: string, engineSignature?: string) => {
    // Find the associated user prompt to use as description
    const associatedUserMsg = messages.find(m => m.id === flowId && m.role === Sender.User);
    const description = associatedUserMsg?.text || "Generated Code";

    const newSnippet: SavedCodeSnippet = {
      id: uuidv4(),
      code,
      description: description.length > 50 ? description.substring(0, 50) + '...' : description,
      timestamp: Date.now(),
      engineSignature
    };

    setSavedSnippets(prev => [newSnippet, ...prev]);

    // Visual feedback
    setSavedStates(prev => ({ ...prev, [msgId]: true }));
    setTimeout(() => {
        setSavedStates(prev => ({ ...prev, [msgId]: false }));
    }, 2000);
  };

  const handleDeleteSnippet = (id: string) => {
    setSavedSnippets(prev => prev.filter(s => s.id !== id));
  };

  const handleClearAllSnippets = () => {
    if (window.confirm(translations.confirmClearAll)) { // Use translations.codegen.confirmClearAll
        setSavedSnippets([]);
    }
  };

  const getPhaseIcon = (phase?: CodegenPhase) => {
    switch (phase) {
      case 'DRAFTING': return <GitFork size={16} className="text-blue-500" />;
      case 'VETTING': return <ShieldAlert size={16} className="text-orange-500" />;
      case 'BLOCKED': return <Ban size={16} className="text-red-500" />;
      case 'FINALIZED': return <CheckCircle size={16} className="text-green-500" />;
      default: return <Loader2 size={16} className="text-slate-400" />;
    }
  };

  const getPhaseColorClass = (phase?: CodegenPhase) => {
    switch (phase) {
      case 'DRAFTING': return 'text-blue-600 dark:text-blue-400';
      case 'VETTING': return 'text-orange-600 dark:text-orange-400';
      case 'BLOCKED': return 'text-red-600 dark:text-red-400';
      case 'FINALIZED': return 'text-green-600 dark:text-green-400';
      default: return 'text-slate-500 dark:text-slate-400';
    }
  };

  const getPatimokkhaStatus = (score: number | null) => {
    if (score === null) return { text: translations.notAvailable, color: 'text-slate-500 dark:text-slate-400' }; // Use translations.codegen.notAvailable
    if (score >= 80) return { text: translations.healthy, color: 'text-green-600 dark:text-green-400' }; // Use translations.codegen.healthy
    if (score >= 40) return { text: translations.minorWarnings, color: 'text-orange-600 dark:text-orange-400' }; // Use translations.codegen.minorWarnings
    return { text: translations.critical, color: 'text-red-600 dark:text-red-400' }; // Use translations.codegen.critical
  };

  const patimokkhaStatus = getPatimokkhaStatus(latestValidationScore);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200 relative">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
            <Code size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{translations.title}</h2> {/* Use translations.codegen.title */}
            <p className="text-xs text-slate-500 dark:text-slate-400">{translations.subtitle}</p> {/* Use translations.codegen.subtitle */}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            {/* Patimokkha Status */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <LayoutDashboard size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="hidden sm:inline text-slate-600 dark:text-slate-300">{translations.patimokkhaStatus}</span> {/* Use translations.codegen.patimokkhaStatus */}
                <span className={`${patimokkhaStatus.color} font-bold`}>{patimokkhaStatus.text}</span>
                {latestValidationScore !== null && (
                <span className="text-xs text-slate-500 dark:text-slate-400">({translations.score}: {latestValidationScore})</span> {/* Use translations.codegen.score */}
                )}
            </div>

            {/* Library Toggle */}
            <button 
                onClick={() => setShowLibrary(!showLibrary)}
                className={`p-2 rounded-lg transition-colors border ${showLibrary ? 'bg-indigo-100 border-indigo-200 text-indigo-700 dark:bg-indigo-900/50 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                title={translations.library} {/* Use translations.codegen.library */}
            >
                <Book size={20} />
            </button>
        </div>
      </div>

      {/* Main Content Area (Messages + Library Overlay) */}
      <div className="flex-1 overflow-hidden relative flex">
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.map((msg) => (
            <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === Sender.User ? 'flex-row-reverse' : 'flex-row'}`}
            >
                <div className={`
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm
                ${msg.role === Sender.User 
                    ? 'bg-slate-800 dark:bg-slate-700 text-white' 
                    : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'}
                `}>
                {msg.role === Sender.User ? <UserIcon size={16} /> : <Code size={16} />}
                </div>
                
                <div className={`flex flex-col max-w-[85%] ${msg.role === Sender.User ? 'items-end' : 'items-start'}`}>
                <div className={`
                    px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap
                    ${msg.role === Sender.User 
                    ? 'bg-slate-800 dark:bg-indigo-600 text-white rounded-tr-none border border-transparent' 
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'}
                `}>
                    {/* User Prompt */}
                    {msg.text && <p>{msg.text}</p>}

                    {/* Codegen Agent Response */}
                    {msg.role === Sender.Bot && (
                    <>
                        {/* Dual-Core Cog: Process Visualization */}
                        {msg.currentPhase && (
                        <div className={`flex items-center gap-2 font-medium mb-2 ${getPhaseColorClass(msg.currentPhase)}`}>
                            {msg.isStreamingPhase ? <Loader2 className="animate-spin" size={16} /> : getPhaseIcon(msg.currentPhase)}
                            <span className="text-xs sm:text-sm">
                            {msg.currentPhase === 'DRAFTING' && translations.phaseDrafting} {/* Use translations.codegen.phaseDrafting */}
                            {msg.currentPhase === 'VETTING' && translations.phaseVetting} {/* Use translations.codegen.phaseVetting */}
                            {msg.currentPhase === 'BLOCKED' && translations.phaseBlocked} {/* Use translations.codegen.phaseBlocked */}
                            {msg.currentPhase === 'FINALIZED' && translations.phaseFinalized} {/* Use translations.codegen.phaseFinalized */}
                            </span>
                        </div>
                        )}

                        {/* Code Artifact with Header */}
                        {msg.artifact && msg.artifact.source_code && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="bg-slate-100 dark:bg-slate-900 px-3 py-1.5 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Code</span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleCopy(msg.artifact!.source_code, msg.id)}
                                        className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                        title={translations.copy} {/* Use translations.codegen.copy */}
                                    >
                                        {copiedStates[msg.id] ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                        <span>{copiedStates[msg.id] ? translations.copied : translations.copy}</span> {/* Use translations.codegen.copied/copy */}
                                    </button>
                                    <button 
                                        onClick={() => handleSaveSnippet(msg.artifact!.source_code, msg.flowId, msg.id, msg.artifact?.engine_signature)}
                                        className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                        title={savedStates[msg.id] ? translations.saved : translations.save} {/* Use translations.codegen.saved/save */}
                                    >
                                        {savedStates[msg.id] ? <Check size={14} className="text-green-500" /> : <Save size={14} />}
                                        <span>{savedStates[msg.id] ? translations.saved : translations.save}</span> {/* Use translations.codegen.saved/save */}
                                    </button>
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 overflow-x-auto text-xs font-mono">
                                <pre><code>{msg.artifact.source_code}</code></pre>
                            </div>
                        </div>
                        )}

                        {msg.artifact && msg.artifact.audit_report && (
                        <div className={`mt-2 p-3 rounded-lg text-xs leading-relaxed ${
                            msg.currentPhase === 'BLOCKED' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50' : 'bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}>
                            <h4 className="font-semibold flex items-center gap-1 mb-1">
                                <ShieldAlert size={14} /> {translations.auditReport} {/* Use translations.codegen.auditReport */}
                            </h4>
                            <p>{msg.artifact.audit_report}</p>
                            {msg.artifact.engine_signature && (
                            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                                Engine: {msg.artifact.engine_signature}
                            </p>
                            )}
                        </div>
                        )}

                        {msg.flowId && (
                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50 text-xs text-slate-400 dark:text-slate-500 flex items-center justify-between">
                            <span>{translations.flowId}: {msg.flowId.substring(0, 8)}...</span> {/* Use translations.codegen.flowId */}
                            
                            <div className="flex items-center gap-2">
                            <span className="font-medium">{translations.feedback}:</span> {/* Use translations.codegen.feedback */}
                            <button 
                                onClick={() => handleFeedback(msg.id, 'POSITIVE')}
                                disabled={!!msg.feedback}
                                className={`p-1 rounded-full transition-all ${msg.feedback === 'POSITIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'text-slate-400 hover:text-green-500 dark:hover:text-green-400'}`}
                            >
                                <ThumbsUp size={14} />
                            </button>
                            <button 
                                onClick={() => handleFeedback(msg.id, 'NEGATIVE')}
                                disabled={!!msg.feedback}
                                className={`p-1 rounded-full transition-all ${msg.feedback === 'NEGATIVE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'text-slate-400 hover:text-red-500 dark:hover:text-red-400'}`}
                            >
                                <ThumbsDown size={14} />
                            </button>
                            </div>
                        </div>
                        )}
                    </>
                    )}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                </div>
            </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Library Overlay */}
          <div className={`
              absolute inset-y-0 right-0 w-full sm:w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl transform transition-transform duration-300 ease-in-out z-20
              ${showLibrary ? 'translate-x-0' : 'translate-x-full'}
          `}>
              <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center gap-2">
                          <Book size={18} className="text-indigo-600 dark:text-indigo-400" />
                          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{translations.savedSnippets}</h3> {/* Use translations.codegen.savedSnippets */}
                      </div>
                      <div className="flex items-center gap-1">
                        {savedSnippets.length > 0 && (
                            <button 
                                onClick={handleClearAllSnippets}
                                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-900/20 mr-1"
                                title={translations.clearAll} {/* Use translations.codegen.clearAll */}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        <button onClick={() => setShowLibrary(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X size={20} />
                        </button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {savedSnippets.length === 0 ? (
                          <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                              <Book size={48} className="mx-auto mb-2 opacity-20" />
                              <p className="text-sm">{translations.noSavedSnippets}</p> {/* Use translations.codegen.noSavedSnippets */}
                          </div>
                      ) : (
                          savedSnippets.map(snippet => (
                              <div key={snippet.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                  <div className="flex justify-between items-start mb-2">
                                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2" title={snippet.description}>
                                          {snippet.description}
                                      </p>
                                      <button 
                                          onClick={() => handleDeleteSnippet(snippet.id)}
                                          className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                                          title={translations.delete} {/* Use translations.codegen.delete */}
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                  </div>
                                  <div className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 p-2 mb-2 relative group">
                                      <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 overflow-hidden h-12">
                                          <code>{snippet.code}</code>
                                      </pre>
                                      <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 to-transparent pointer-events-none" />
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-400 text-[10px]">
                                          {new Date(snippet.timestamp).toLocaleDateString()}
                                      </span>
                                      <button 
                                          onClick={() => handleCopy(snippet.code, snippet.id)}
                                          className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                                      >
                                          {copiedStates[snippet.id] ? <Check size={12} /> : <Copy size={12} />}
                                          {copiedStates[snippet.id] ? translations.copied : translations.copy} {/* Use translations.codegen.copied/copy */}
                                      </button>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors z-30 relative">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-slate-200 dark:border-slate-700 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/30 transition-all">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendCommand()}
            placeholder={translations.placeholder} {/* Use translations.codegen.placeholder */}
            className="flex-1 bg-transparent border-none focus:ring-0 px-2 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSendCommand}
            disabled={!inputValue.trim() || isLoading}
            className={`
              p-2.5 rounded-full text-white transition-all
              ${!inputValue.trim() || isLoading 
                ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-md'}
            `}
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
        {isLoading && (
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 text-center flex items-center justify-center gap-1">
            <Loader2 className="animate-spin" size={12} />
            {messages.length > 0 && messages[messages.length - 1]?.currentPhase === 'DRAFTING' && translations.phaseDrafting} {/* Use translations.codegen.phaseDrafting */}
            {messages.length > 0 && messages[messages.length - 1]?.currentPhase === 'VETTING' && translations.phaseVetting} {/* Use translations.codegen.phaseVetting */}
          </p>
        )}
      </div>
    </div>
  );
};

export default CodegenInterface;