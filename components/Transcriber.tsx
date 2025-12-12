import React, { useState, useRef, useEffect } from 'react';
import { FileAudio, Upload, Loader2, CheckCircle2, Mic, Square, Activity, Copy, Check, AlertCircle } from 'lucide-react';
import { transcribeAudioFile } from '../services/gemini';
import { blobToBase64, float32ToInt16, arrayBufferToBase64 } from '../services/audio';
import { GoogleGenAI, LiveServerMessage } from '@google/genai';

interface TranscriberProps {
  translations: any;
}

const Transcriber: React.FC<TranscriberProps> = ({ translations }) => {
  const [transcription, setTranscription] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false); // State for copy button feedback
  
  // Streaming states
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamVolume, setStreamVolume] = useState(0);

  // Audio Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
      setError(null);
      // Don't clear transcription immediately if they want to compare, but usually good UX to clear or append
      // setTranscription(''); 
    }
  };

  const startStreaming = async () => {
    setError(null);
    setTranscription(''); // Clear previous transcription for new stream
    
    try {
      if (!process.env.API_KEY) {
        throw new Error("API Key not found. Please ensure it's configured in your environment.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      inputAudioContextRef.current = inputCtx;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Defensive check for ai and ai.live
      if (!ai || !ai.live) {
         throw new Error("Gemini Live API is not initialized. Please check your API key and library version.");
      }
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: ['AUDIO'], // Required by API even if we only want transcription
          inputAudioTranscription: {}, // Enable Input Transcription
          systemInstruction: "You are a transcriber. Your only task is to listen and provide accurate transcription.", // Keep model quiet
        },
        callbacks: {
          onopen: () => {
            console.log("Streaming started");
            setIsStreaming(true);

            // Audio Processing
            const source = inputCtx.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Volume meter logic
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              setStreamVolume(Math.sqrt(sum / inputData.length));

              // Convert and Send
              const int16Data = float32ToInt16(inputData);
              const base64Data = arrayBufferToBase64(int16Data.buffer);

              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Data
                  }
                });
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: (msg: LiveServerMessage) => {
            // Check for input transcription
            const text = msg.serverContent?.inputTranscription?.text;
            if (text) {
              setTranscription(prev => prev + text);
            }
          },
          onclose: (event) => { // Added event parameter
            console.log("Streaming session closed:", event);
            setError(`Streaming session closed unexpectedly. Code: ${event.code}, Reason: ${event.reason || 'N/A'}`);
            stopStreaming();
          },
          onerror: (errEvent: ErrorEvent) => { // Changed type to ErrorEvent
            console.error("Streaming session error:", errEvent);
            console.trace(); // Add trace for streaming errors
            let userMessage = translations.error;
            if (errEvent.message) {
              userMessage = `Connection error: ${errEvent.message}.`;
            } else if (errEvent.error) {
              userMessage = `Connection error: ${errEvent.error.message || 'Unknown network issue'}.`;
            }
            userMessage += " Please check your network and API key configuration.";
            setError(userMessage);
            stopStreaming();
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Mic/Network error during streaming setup:", err);
      console.trace(); // Add trace for mic/network setup errors
      let userMessage = err.message || translations.micError;
      if (userMessage.includes("API Key")) {
         userMessage = "API Key not found or invalid. Please ensure it's correctly configured in your environment.";
      } else if (userMessage.includes("microphone")) {
        userMessage = "Could not access microphone. Please ensure permissions are granted.";
      } else {
        userMessage = `Streaming setup failed: ${userMessage}`;
      }
      setError(userMessage);
      stopStreaming();
    }
  };

  const stopStreaming = () => {
    setIsStreaming(false);
    setStreamVolume(0);

    // Cleanup Audio
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }

    // Close Session
    sessionRef.current?.then((s: any) => {
      if(s.close) s.close();
    });
    sessionRef.current = null;
  };

  const handleTranscribeFile = async () => {
    if (!audioFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      const base64 = await blobToBase64(audioFile);
      const result = await transcribeAudioFile(base64, audioFile.type);
      setTranscription(result);
    } catch (err) {
      console.error("File transcription error:", err);
      console.trace();
      setError(translations.error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
        })
        .catch(err => {
          console.error("Failed to copy text: ", err);
          // Optionally show an error message to the user
        });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isStreaming) stopStreaming();
    };
  }, [isStreaming]);

  return (
    <div className="h-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 overflow-y-auto transition-colors duration-200">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mb-2">
            <FileAudio size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{translations.title}</h2>
          <p className="text-slate-500 dark:text-slate-400">
            {translations.desc}
          </p>
        </div>

        {/* Input Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* File Upload */}
          <div className={`
            border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors
            ${audioFile && !isStreaming 
              ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
              : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800'}
          `}>
            <input 
              type="file" 
              accept="audio/*" 
              onChange={handleFileUpload} 
              className="hidden" 
              id="audio-upload"
              disabled={isProcessing || isStreaming}
            />
            <label htmlFor="audio-upload" className="cursor-pointer flex flex-col items-center w-full">
               <Upload size={32} className="text-slate-400 dark:text-slate-500 mb-2" />
               <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{translations.uploadLabel}</span>
               <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">{translations.uploadDesc}</span>
            </label>
          </div>

          {/* Streaming Recording */}
          <div className={`
            border-2 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors
            ${isStreaming 
              ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/20' 
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}
          `}>
            {isStreaming ? (
              <div className="relative">
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                <button 
                  onClick={stopStreaming}
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors z-10 relative"
                >
                  <Square size={24} fill="currentColor" />
                </button>
              </div>
            ) : (
              <button 
                onClick={startStreaming}
                disabled={isProcessing}
                className="w-16 h-16 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                <Mic size={28} />
              </button>
            )}
            <div className="flex flex-col items-center">
              <span className={`text-sm font-medium ${isStreaming ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
                {isStreaming ? translations.recordingBtn : translations.recordBtn}
              </span>
              {isStreaming && (
                <div className="h-1 w-20 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-red-500 transition-all duration-100" 
                    style={{ width: `${Math.min(streamVolume * 500, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected File Status */}
        {audioFile && (
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg flex items-center justify-between border border-slate-200 dark:border-slate-700 transition-colors">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                 <FileAudio size={20} />
               </div>
               <div>
                 <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{audioFile.name}</p>
                 <p className="text-xs text-slate-500 dark:text-slate-400">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
               </div>
             </div>
             <button
               onClick={handleTranscribeFile}
               disabled={isProcessing || isStreaming}
               className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
             >
               {isProcessing ? <Loader2 className="animate-spin" size={16} /> : null}
               {isProcessing ? translations.transcribingBtn : translations.transcribeBtn}
             </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-900/30 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Result Area */}
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <CheckCircle2 size={16} className={transcription ? "text-green-500" : "text-slate-300"} />
                  {translations.result}
                  {isStreaming && <Activity size={14} className="animate-pulse text-red-500" />}
                </h3>
                {transcription && (
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title="Copy to Clipboard"
                    >
                        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        {copied ? "Copied!" : "Copy"}
                    </button>
                )}
            </div>
            <div className={`
              p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 
              text-slate-800 dark:text-slate-200 text-base leading-relaxed whitespace-pre-wrap min-h-[200px] transition-colors
              ${isStreaming ? 'border-red-200 dark:border-red-900/30' : ''}
            `}>
              {transcription || <span className="text-slate-400 italic">...</span>}
              {isStreaming && <span className="inline-block w-2 h-4 bg-red-500 ml-1 animate-pulse align-middle" />}
            </div>
        </div>

      </div>
    </div>
  );
};

export default Transcriber;