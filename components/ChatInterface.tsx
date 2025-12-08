import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, BrainCircuit, Loader2, Paperclip, X, FileText } from 'lucide-react';
import { createChatSession } from '../services/gemini';
import { ChatMessage, Sender } from '../types';
import { Chat, GenerateContentResponse } from '@google/genai';
import { blobToBase64 } from '../services/audio';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize chat session
    chatSessionRef.current = createChatSession(isThinkingMode);
    
    // Welcome message
    setMessages([
      {
        id: 'init',
        role: Sender.Bot,
        text: 'Hello! I am Gemini. I can help you with complex tasks, coding, and reasoning in Thai or English. You can also upload PDF files for me to analyze.',
        timestamp: Date.now(),
      }
    ]);
  }, [isThinkingMode]);

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
        setSelectedFile(file);
      } else {
        alert('Please select a PDF file.');
      }
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !selectedFile) || !chatSessionRef.current || isLoading) return;

    const currentFile = selectedFile;
    const currentText = inputValue;
    
    // Create user message object
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: Sender.User,
      text: currentText,
      timestamp: Date.now(),
      attachment: currentFile ? {
        name: currentFile.name,
        type: currentFile.type
      } : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSelectedFile(null);
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

      let messageContent: any = currentText;

      // Construct multipart message if file is present
      if (currentFile) {
        const base64Data = await blobToBase64(currentFile);
        messageContent = [
          {
            inlineData: {
              data: base64Data,
              mimeType: currentFile.type
            }
          },
          {
            text: currentText || "Please analyze this PDF."
          }
        ];
      }

      const result: GenerateContentResponse = await chatSessionRef.current.sendMessage({
        message: messageContent
      });

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
        text: "Sorry, I encountered an error processing your request.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white">
            <Bot size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Gemini Pro Chat</h2>
            <p className="text-xs text-slate-500">Powered by Gemini 3.0 Pro</p>
          </div>
        </div>
        
        <button
          onClick={() => !isLoading && setIsThinkingMode(!isThinkingMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            isThinkingMode 
              ? 'bg-purple-100 text-purple-700 border border-purple-200 shadow-sm' 
              : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200'
          }`}
          title="Enable deep reasoning capabilities"
        >
          <BrainCircuit size={16} />
          <span>{isThinkingMode ? 'Thinking Mode On' : 'Thinking Mode Off'}</span>
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
              w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1
              ${msg.role === Sender.User ? 'bg-slate-800 text-white' : 'bg-blue-100 text-blue-600'}
            `}>
              {msg.role === Sender.User ? <UserIcon size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={`flex flex-col max-w-[80%] ${msg.role === Sender.User ? 'items-end' : 'items-start'}`}>
              <div className={`
                px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap
                ${msg.role === Sender.User 
                  ? 'bg-slate-800 text-white rounded-tr-none' 
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}
              `}>
                {msg.attachment && (
                  <div className={`flex items-center gap-2 mb-2 p-2 rounded-lg ${msg.role === Sender.User ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <FileText size={16} className={msg.role === Sender.User ? 'text-slate-300' : 'text-slate-500'} />
                    <span className="font-medium text-xs truncate max-w-[150px]">{msg.attachment.name}</span>
                    <span className="text-[10px] opacity-70 uppercase border px-1 rounded border-current">PDF</span>
                  </div>
                )}
                
                {msg.isThinking ? (
                  <div className="flex items-center gap-2 text-slate-500 italic">
                    <Loader2 className="animate-spin" size={14} />
                    <span>Thinking deeply...</span>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        {selectedFile && (
          <div className="flex items-center gap-2 mb-3 bg-indigo-50 border border-indigo-100 p-2 rounded-lg w-fit">
            <div className="w-8 h-8 bg-indigo-100 rounded-md flex items-center justify-center text-indigo-600">
              <FileText size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-indigo-900 truncate max-w-[200px]">{selectedFile.name}</span>
              <span className="text-[10px] text-indigo-500">{(selectedFile.size / 1024).toFixed(0)} KB</span>
            </div>
            <button 
              onClick={removeFile}
              className="ml-2 p-1 hover:bg-indigo-200 rounded-full text-indigo-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-full border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <input 
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded-full transition-colors"
            title="Attach PDF"
          >
            <Paperclip size={18} />
          </button>
          
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={selectedFile ? "Ask about this PDF..." : "Type your message here (Thai or English)..."}
            className="flex-1 bg-transparent border-none focus:ring-0 px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={(!inputValue.trim() && !selectedFile) || isLoading}
            className={`
              p-2.5 rounded-full text-white transition-all
              ${(!inputValue.trim() && !selectedFile) || isLoading 
                ? 'bg-slate-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-md'}
            `}
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
        {isThinkingMode && (
          <p className="text-xs text-purple-600 mt-2 text-center flex items-center justify-center gap-1">
            <BrainCircuit size={12} />
            Thinking mode active: Responses may take longer but will be more thorough.
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;