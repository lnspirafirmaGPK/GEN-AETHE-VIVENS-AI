import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Loader2, Code, LayoutDashboard, ThumbsUp, ThumbsDown, GitFork, ShieldAlert, CheckCircle, Ban } from 'lucide-react';
import { CodegenMessage, Sender, CodegenPhase } from '../types';
import { v4 as uuidv4 } from 'uuid'; // For generating unique flow IDs

interface CodegenInterfaceProps {
  translations: any;
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

  useEffect(() => {
    // Welcome message - only on first load
    if (!hasInitialized.current) {
      setMessages([
        {
          id: 'init',
          role: Sender.Bot,
          text: translations.welcome,
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
          ? { ...msg, currentPhase: 'BLOCKED', text: translations.error, isStreamingPhase: false }
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
    if (score === null) return { text: translations.notAvailable, color: 'text-slate-500 dark:text-slate-400' };
    if (score >= 80) return { text: translations.healthy, color: 'text-green-600 dark:text-green-400' };
    if (score >= 40) return { text: translations.minorWarnings, color: 'text-orange-600 dark:text-orange-400' };
    return { text: translations.critical, color: 'text-red-600 dark:text-red-400' };
  };

  const patimokkhaStatus = getPatimokkhaStatus(latestValidationScore);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
            <Code size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{translations.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{translations.subtitle}</p>
          </div>
        </div>
        
        {/* Patimokkha Status Bar (Simplified Local Display) */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <LayoutDashboard size={16} className="text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline text-slate-600 dark:text-slate-300">{translations.patimokkhaStatus}</span>
            <span className={`${patimokkhaStatus.color} font-bold`}>{patimokkhaStatus.text}</span>
            {latestValidationScore !== null && (
              <span className="text-xs text-slate-500 dark:text-slate-400">({translations.score}: {latestValidationScore})</span>
            )}
        </div>
      </div>

      {/* Messages / Codegen Outputs */}
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
            
            <div className={`flex flex-col max-w-[80%] ${msg.role === Sender.User ? 'items-end' : 'items-start'}`}>
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
                          {msg.currentPhase === 'DRAFTING' && translations.phaseDrafting}
                          {msg.currentPhase === 'VETTING' && translations.phaseVetting}
                          {msg.currentPhase === 'BLOCKED' && translations.phaseBlocked}
                          {msg.currentPhase === 'FINALIZED' && translations.phaseFinalized}
                        </span>
                      </div>
                    )}

                    {msg.artifact && msg.artifact.source_code && (
                      <div className="mt-2 p-3 bg-slate-700 text-white dark:bg-slate-950 dark:text-slate-100 rounded-lg overflow-x-auto text-xs font-mono">
                        <pre><code>{msg.artifact.source_code}</code></pre>
                      </div>
                    )}

                    {msg.artifact && msg.artifact.audit_report && (
                      <div className={`mt-2 p-3 rounded-lg text-xs leading-relaxed ${
                         msg.currentPhase === 'BLOCKED' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}>
                        <h4 className="font-semibold flex items-center gap-1 mb-1">
                            <ShieldAlert size={14} /> {translations.auditReport}
                        </h4>
                        <p>{msg.artifact.audit_report}</p>
                        {msg.artifact.engine_signature && (
                          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                            Engine: {msg.artifact.engine_signature}
                          </p>
                        )}
                      </div>
                    )}

                    {msg.flowId && (
                      <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>{translations.flowId}: {msg.flowId.substring(0, 8)}...</span>
                        
                        {/* Akashic Traceability Module: Feedback/RSI */}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{translations.feedback}:</span>
                          <button 
                            onClick={() => handleFeedback(msg.id, 'POSITIVE')}
                            disabled={!!msg.feedback}
                            className={`p-1 rounded-full transition-all ${msg.feedback === 'POSITIVE' ? 'bg-green-200 text-green-700 dark:bg-green-700 dark:text-green-200' : 'text-slate-400 hover:text-green-500 dark:hover:text-green-300'}`}
                          >
                            <ThumbsUp size={16} />
                          </button>
                          <button 
                            onClick={() => handleFeedback(msg.id, 'NEGATIVE')}
                            disabled={!!msg.feedback}
                            className={`p-1 rounded-full transition-all ${msg.feedback === 'NEGATIVE' ? 'bg-red-200 text-red-700 dark:bg-red-700 dark:text-red-200' : 'text-slate-400 hover:text-red-500 dark:hover:text-red-300'}`}
                          >
                            <ThumbsDown size={16} />
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

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-slate-200 dark:border-slate-700 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/30 transition-all">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendCommand()}
            placeholder={translations.placeholder}
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
            {messages.length > 0 && messages[messages.length - 1]?.currentPhase === 'DRAFTING' && translations.phaseDrafting}
            {messages.length > 0 && messages[messages.length - 1]?.currentPhase === 'VETTING' && translations.phaseVetting}
          </p>
        )}
      </div>
    </div>
  );
};

export default CodegenInterface;