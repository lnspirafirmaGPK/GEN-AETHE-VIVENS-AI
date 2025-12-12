import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, BrainCircuit, Loader2, Paperclip, X, FileText } from 'lucide-react';
import { createChatSession } from '../services/gemini';
import { ChatMessage, Sender } from '../types';
import { Chat, GenerateContentResponse } from '@google/genai';
import { blobToBase64 } from '../services/audio';

interface ChatInterfaceProps {
  translations: any; // Changed to any to accept the full translation object
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ translations }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  
  const chatSessionRef = useRef<Chat | null>(null);
  // Fix: Corrected typo from HTMLDivSlement to HTMLDivElement
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Initialize chat session
    chatSessionRef.current = createChatSession(isThinkingMode);
    
    // Welcome message - only on first load
    if (!hasInitialized.current) {
      setMessages([
        {
          id: 'init',
          role: Sender.Bot,
          text: translations.welcome, // Use translations.chat.welcome
          timestamp: Date.now(),
        }
      ]);
      hasInitialized.current = true;
    }
  }, [isThinkingMode, translations.welcome]); // Re-run if translations change

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setAttachedFile(file);
      } else {
        alert("Please select a valid PDF file.");
      }
    }
  };

  const clearAttachment = () => {
    setAttachedFile(null);
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !attachedFile) || !chatSessionRef.current || isLoading) return;

    const userText = inputValue;
    const currentFile = attachedFile;
    
    // Create user message object
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: Sender.User,
      text: userText,
      timestamp: Date.now(),
      attachment: currentFile ? { name: currentFile.name, type: 'pdf' } : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setAttachedFile(null);
    setIsLoading(true);

    try {
      // Create a temporary placeholder for the bot response
      const botMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: botMsgId,
        role: Sender.Bot,
        text: '',
        isThinking: true,
        timestamp: Date.now(),
      }]);

      let result: GenerateContentResponse;

      if (currentFile) {
        // Send with attachment using sendMessage (since chat handles history)
        // We need to convert file to base64
        const base64 = await blobToBase64(currentFile);
        
        // The `chat.sendMessage` method accepts a `message` parameter which can be a string, a Part, or an array of Parts.
        result = await chatSessionRef.current.sendMessage({
          message: [
            { text: userText || "Analyze this PDF." },
            { 
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64
                }
            }
          ]
        });
      } else {
         result = await chatSessionRef.current.sendMessage({
          message: userText
        });
      }

      const responseText = result.text || "I couldn't generate a response.";

      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId 
          ? { ...msg, text: responseText, isThinking: false } 
          : msg
      ));

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: Sender.Bot,
        text: translations.error, // Use translations.chat.error
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Bot size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{translations.title}</h2> {/* Use translations.chat.title */}
            <p className="text-xs text-slate-500 dark:text-slate-400">{translations.subtitle}</p> {/* Use translations.chat.subtitle */}
          </div>
        </div>
        
        <button
          onClick={() => !isLoading && setIsThinkingMode(!isThinkingMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            isThinkingMode 
              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-sm' 
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
          title="Enable deep reasoning capabilities"
        >
          <BrainCircuit size={16} />
          <span className="hidden sm:inline">{isThinkingMode ? translations.thinkingOn : translations.thinkingOff}</span> {/* Use translations.chat.thinkingOn/Off */}
        </button>
      </div>

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
                : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'}
            `}>
              {msg.role === Sender.User ? <UserIcon size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={`flex flex-col max-w-[80%] ${msg.role === Sender.User ? 'items-end' : 'items-start'}`}>
              <div className={`
                px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap
                ${msg.role === Sender.User 
                  ? 'bg-slate-800 dark:bg-blue-600 text-white rounded-tr-none border border-transparent' 
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'}
              `}>
                {msg.attachment && (
                  <div className="mb-2 pb-2 border-b border-white/20 flex items-center gap-2">
                    <Paperclip size={14} />
                    <span className="text-xs font-medium">{msg.attachment.name}</span>
                  </div>
                )}
                {msg.isThinking ? (
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 italic">
                    <Loader2 className="animate-spin" size={14} />
                    <span>{translations.thinkingLoading}</span> {/* Use translations.chat.thinkingLoading */}
                  </div>
                ) : (
                  msg.text
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
        {attachedFile && (
          <div className="mb-3 flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg max-w-fit border border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
              <FileText size={16} />
            </div>
            <div className="text-sm">
              <p className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{attachedFile.name}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{translations.pdfName}</p> {/* Use translations.chat.pdfName */}
            </div>
            <button 
              onClick={clearAttachment}
              className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={16} />
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-slate-200 dark:border-slate-700 focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/30 transition-all">
          <label className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors">
            <input 
              type="file" 
              accept="application/pdf"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isLoading}
            />
            <Paperclip size={20} />
          </label>
          
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={translations.placeholder} {/* Use translations.chat.placeholder */}
            className="flex-1 bg-transparent border-none focus:ring-0 px-2 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={(!inputValue.trim() && !attachedFile) || isLoading}
            className={`
              p-2.5 rounded-full text-white transition-all
              ${(!inputValue.trim() && !attachedFile) || isLoading 
                ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-md'}
            `}
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
        {isThinkingMode && (
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 text-center flex items-center justify-center gap-1">
            <BrainCircuit size={12} />
            {translations.thinkingActive} {/* Use translations.chat.thinkingActive */}
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;