import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, X, Activity, Radio, AlertCircle } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage } from '@google/genai';
import { float32ToInt16, base64ToArrayBuffer, arrayBufferToBase64 } from '../services/audio';

interface LiveInterfaceProps {
  translations: any;
}

const LiveInterface: React.FC<LiveInterfaceProps> = ({ translations }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Audio References
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);

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

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      return { stream, inputCtx, outputCtx };
    } catch (err) {
      console.error("Audio initialization error:", err);
      throw new Error("Could not access microphone.");
    }
  };

  const connectToLive = async () => {
    setError(null);
    try {
      if (!process.env.API_KEY) {
        throw new Error("API Key not found.");
      }

      // Create AI instance first
      aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const { stream, inputCtx, outputCtx } = await initializeAudio();

      // Detect user language from browser settings
      const userLang = navigator.language || 'en-US';
      const isThai = userLang.startsWith('th');
      
      // Adjust system instruction based on detected language
      // Note: We keep the voiceName as 'Kore' as it handles multilingual output well.
      // The systemInstruction drives the language choice.
      const systemInstruction = isThai 
        ? 'คุณคือผู้ช่วย AI อัจฉริยะที่พูดภาษาไทยได้อย่างคล่องแคล่ว สุภาพ และเป็นธรรมชาติ โปรดฟังและตอบโต้เป็นภาษาไทยเป็นหลัก แต่สามารถสลับเป็นภาษาอังกฤษได้ทันทีหากคู่สนทนาพูดภาษาอังกฤษ'
        : 'You are a helpful AI assistant. Detect the user language automatically. If the user speaks Thai, respond in Thai. If the user speaks English, respond in English.';
      
      const sessionPromise = aiRef.current.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: ['AUDIO'], // Use string literal to avoid CDN enum issues
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
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
               
               // Simple volume meter
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
              source.connect(audioCtx.destination);

              const currentTime = audioCtx.currentTime;
              if (nextStartTimeRef.current < currentTime) {
                nextStartTimeRef.current = currentTime;
              }
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
            }
          },
          onclose: () => {
            console.log("Session closed");
            disconnect();
          },
          onerror: (err) => {
            console.error("Session error:", err);
            setError(translations.error);
            disconnect();
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e: any) {
      console.error("Connection failed:", e);
      setError(e.message || "Failed to establish connection.");
      disconnect();
    }
  };

  const disconnect = () => {
    setIsConnected(false);
    setVolumeLevel(0);
    
    // Clean up audio nodes
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

  useEffect(() => {
    // Auto-connect if permission granted to provide seamless experience
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then((permissionStatus) => {
      if (permissionStatus.state === 'granted') {
        connectToLive();
      }
    });

    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl overflow-hidden relative border border-slate-200 dark:border-slate-800 transition-colors duration-200">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none transition-colors duration-500
        bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] 
        from-blue-50 via-white to-white
        dark:from-blue-900/40 dark:via-slate-900 dark:to-slate-900" 
      />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-8 space-y-8">
        
        {/* Visualizer Circle */}
        <div className="relative group">
          <div className={`absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 transition-all duration-100 ease-out`} 
               style={{ transform: `scale(${1 + volumeLevel})` }} 
          />
          <div className={`
            w-48 h-48 rounded-full border-4 flex items-center justify-center relative shadow-2xl transition-all duration-300
            ${isConnected 
              ? 'border-blue-400/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md' 
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}
          `}>
             {isConnected ? (
               <div className="flex gap-1 items-end h-16">
                 {/* Fake Visualizer bars driven by volume */}
                 {[...Array(5)].map((_, i) => (
                   <div 
                     key={i} 
                     className="w-3 bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-75"
                     style={{ 
                       height: `${20 + (volumeLevel * 100 * Math.random())}%`,
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
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-blue-600 dark:text-blue-300 text-sm font-medium animate-pulse whitespace-nowrap">
              {translations.listening}
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