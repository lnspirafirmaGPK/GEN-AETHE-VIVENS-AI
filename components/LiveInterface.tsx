

import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, X, Activity, Radio, AlertCircle, Settings } from 'lucide-react'; // Added Settings icon
import { GoogleGenAI, LiveServerMessage } from '@google/genai';
import { float32ToInt16, base64ToArrayBuffer, arrayBufferToBase64 } from '../services/audio';
import { PREBUILT_VOICES, VoiceName } from '../types'; // Import PREBUILT_VOICES and VoiceName

interface LiveInterfaceProps {
  translations: any;
  selectedVoice: VoiceName; // NEW: Prop for selected voice
  setSelectedVoice: (voice: VoiceName) => void; // NEW: Setter for selected voice
}

const LiveInterface: React.FC<LiveInterfaceProps> = ({ translations, selectedVoice, setSelectedVoice }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0); // User input volume
  const [aiVolume, setAiVolume] = useState(0); // AI output volume
  const [error, setError] = useState<string | null>(null);

  // Audio References
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  const initializeAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Ensure contexts are running
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      // Setup Output Analyser for AI Voice Visualization
      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      analyser.connect(outputCtx.destination);
      outputAnalyserRef.current = analyser;

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      return { stream, inputCtx, outputCtx };
    } catch (err) {
      console.error("Audio initialization error:", err);
      console.trace(); // Add trace for initialization errors
      throw new Error("Could not access microphone.");
    }
  };

  const connectToLive = async () => {
    setError(null);
    try {
      if (!process.env.API_KEY) {
        throw new Error("API Key not found. Please ensure it's configured in your environment.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const { stream, inputCtx, outputCtx } = await initializeAudio();

      const userLang = navigator.language || 'en-US';
      const isThai = userLang.startsWith('th');
      
      const systemInstruction = isThai 
        ? 'คุณคือผู้ช่วย AI อัจฉริยะที่พูดภาษาไทยได้อย่างคล่องแคล่ว สุภาพ และเป็นธรรมชาติ โปรดฟังและตอบโต้เป็นภาษาไทยเป็นหลัก แต่สามารถสลับเป็นภาษาอังกฤษได้ทันทีหากคู่สนทนาพูดภาษาอังกฤษ'
        : 'You are a helpful AI assistant. Detect the user language automatically. If the user speaks Thai, respond in Thai. If the user speaks English, respond in English.';
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } }, // Use selectedVoice
          },
          systemInstruction: systemInstruction,
        },
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
            setIsConnected(true);
            
            // Setup Input Processing
            const source = inputCtx.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            
            // Use ScriptProcessor for raw PCM access
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
               if (isMuted) return;

               const inputData = e.inputBuffer.getChannelData(0);
               
               // Simple volume meter for Input
               let sum = 0;
               for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
               const rms = Math.sqrt(sum / inputData.length);
               setVolumeLevel(Math.min(rms * 5, 1)); // Scale for visuals

               // Convert to PCM 16-bit
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
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const buffer = base64ToArrayBuffer(base64Audio);
              
              const audioCtx = outputAudioContextRef.current;
              if (!audioCtx) return;

              const int16 = new Int16Array(buffer);
              const float32 = new Float32Array(int16.length);
              for(let i=0; i<int16.length; i++) {
                float32[i] = int16[i] / 32768.0;
              }

              const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
              audioBuffer.getChannelData(0).set(float32);

              const source = audioCtx.createBufferSource();
              source.buffer = audioBuffer;
              
              if (outputAnalyserRef.current) {
                source.connect(outputAnalyserRef.current);
              } else {
                source.connect(audioCtx.destination);
              }

              const currentTime = audioCtx.currentTime;
              if (nextStartTimeRef.current < currentTime) {
                nextStartTimeRef.current = currentTime;
              }
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
            }
          },
          onclose: (event) => {
            console.log("Session closed:", event);
            setError(`Session closed unexpectedly. Code: ${event.code}, Reason: ${event.reason || 'N/A'}`);
            disconnect();
          },
          onerror: (errEvent: ErrorEvent) => {
            console.error("Session error:", errEvent);
            console.trace();
            let userMessage = translations.error;
            if (errEvent.message) {
              userMessage = `Connection error: ${errEvent.message}.`;
            } else if (errEvent.error) {
              userMessage = `Connection error: ${errEvent.error.message || 'Unknown network issue'}.`;
            }
            userMessage += " Please check your network and API key configuration.";
            setError(userMessage);
            disconnect();
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e: any) {
      console.error("Connection failed:", e);
      console.trace();
      let userMessage = e.message || "Failed to establish connection. Check console for details.";
      if (userMessage.includes("API Key")) {
        userMessage = "API Key not found or invalid. Please ensure it's correctly configured in your environment.";
      } else {
        userMessage = `Connection failed: ${userMessage}. Please check your network and API key configuration.`;
      }
      setError(userMessage);
      disconnect();
    }
  };

  const disconnect = () => {
    setIsConnected(false);
    setVolumeLevel(0);
    setAiVolume(0);
    
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (outputAnalyserRef.current) {
      outputAnalyserRef.current.disconnect();
      outputAnalyserRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    
    sessionRef.current?.then((s: any) => {
        if(s.close) s.close();
    });
    sessionRef.current = null;
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Visualization Loop for AI Voice
  useEffect(() => {
    const updateVisualizers = () => {
      if (outputAnalyserRef.current && isConnected) {
        const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
        outputAnalyserRef.current.getByteFrequencyData(dataArray);
        
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        
        setAiVolume(avg / 255);
      }
      rafRef.current = requestAnimationFrame(updateVisualizers);
    };

    if (isConnected) {
      updateVisualizers();
    } else {
      setAiVolume(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isConnected]);

  useEffect(() => {
    const checkMicAndConnect = async () => {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permissionStatus.state === 'granted') {
          connectToLive();
        }
      } catch (e) {
        console.error("Error querying microphone permission:", e);
        setError("Could not check microphone permission. Please allow access manually.");
      }
    };
    
    checkMicAndConnect();

    return () => {
      disconnect();
    };
  }, [selectedVoice]); // Re-run effect if selectedVoice changes to reconnect with new voice

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl overflow-hidden relative border border-slate-200 dark:border-slate-800 transition-colors duration-200">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none transition-colors duration-500
        bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] 
        from-blue-50 via-white to-white
        dark:from-blue-900/40 dark:via-slate-900 dark:to-slate-900" 
      />

      {/* Header with Voice Selection */}
      <div className="relative z-10 flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Radio size={18} />
          </div>
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">{translations.sidebar.live}</h2>
        </div>
        
        {/* Voice Selection Dropdown */}
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-slate-500 dark:text-slate-400" />
          <label htmlFor="voice-select" className="sr-only">{translations.live.voiceLabel}</label>
          <select
            id="voice-select"
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
            disabled={isConnected} // Disable while connected to prevent interruption
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            {PREBUILT_VOICES.map(voice => (
              <option key={voice} value={voice}>
                {translations.live.voices[voice]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-8 space-y-8">
        
        {/* Visualizer Circle */}
        <div className="relative group">
          {/* User Voice Glow (Blue) */}
          <div className={`absolute inset-0 bg-blue-500 rounded-full blur-2xl transition-all duration-100 ease-out`} 
               style={{ 
                 transform: `scale(${1 + volumeLevel})`,
                 opacity: volumeLevel > 0.01 ? 0.4 : 0
               }} 
          />
          
          {/* AI Voice Glow (Purple/Indigo) */}
          <div className={`absolute inset-0 bg-indigo-500 rounded-full blur-2xl transition-all duration-100 ease-out mix-blend-screen`}
               style={{ 
                 transform: `scale(${1 + aiVolume * 2})`,
                 opacity: aiVolume > 0.01 ? 0.6 : 0
               }}
          />

          {/* Core Avatar */}
          <div className={`
            w-48 h-48 rounded-full border-4 flex items-center justify-center relative shadow-2xl transition-all duration-300 z-10
            ${isConnected 
              ? 'border-blue-400/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md' 
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}
            ${aiVolume > 0.1 ? 'border-indigo-400 dark:border-indigo-400' : ''}
          `}>
             {isConnected ? (
               <div className="flex gap-1 items-end h-16">
                 {[...Array(5)].map((_, i) => (
                   <div 
                     key={i} 
                     className={`w-3 rounded-full transition-all duration-75 ${
                        aiVolume > 0.05 ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-blue-500 dark:bg-blue-400'
                     }`}
                     style={{ 
                       height: `${20 + (Math.max(volumeLevel, aiVolume) * 100 * Math.random())}%`,
                       opacity: 0.8 
                     }}
                   />
                 ))}
               </div>
             ) : (
               <Radio size={48} className="text-slate-300 dark:text-slate-600" />
             )}
          </div>
          
          {isConnected && (
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-sm font-medium animate-pulse whitespace-nowrap transition-colors duration-300
              ${aiVolume > 0.05 ? 'text-indigo-600 dark:text-indigo-300' : 'text-blue-600 dark:text-blue-300'}"
            >
              {aiVolume > 0.05 ? "Gemini is speaking..." : translations.listening}
            </div>
          )}
        </div>

        {/* Status Text */}
        <div className="text-center space-y-2 h-16 w-full max-w-lg">
          {!isConnected && !error && (
            <p className="text-slate-500 dark:text-slate-400 transition-colors">
              {translations.initial}
            </p>
          )}
          {error && (
             <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 px-4 py-2 rounded-lg">
               <AlertCircle size={16} />
               <span className="text-sm">{error}</span>
             </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          {!isConnected ? (
            <button
              onClick={connectToLive}
              className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
            >
              <Mic size={20} />
              <span>{translations.start}</span>
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-all border ${
                  isMuted 
                    ? 'bg-red-100 dark:bg-red-500/20 border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30' 
                    : 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              <button
                onClick={disconnect}
                className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full font-semibold transition-all shadow-lg hover:shadow-red-500/25 active:scale-95 flex items-center gap-2"
              >
                <X size={20} />
                <span>{translations.end}</span>
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="absolute bottom-4 right-4 text-xs text-slate-400 dark:text-slate-600 flex items-center gap-1 transition-colors">
        <Activity size={12} />
        <span>{translations.footer}</span>
      </div>
    </div>
  );
};

export default LiveInterface;