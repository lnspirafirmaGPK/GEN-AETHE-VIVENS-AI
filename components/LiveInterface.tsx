import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, X, Activity, Radio, AlertCircle, Sparkles } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { float32ToInt16, base64ToArrayBuffer, arrayBufferToBase64 } from '../utils/audio';

const apiKey = process.env.API_KEY || '';

const LiveInterface: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [aiVolumeLevel, setAiVolumeLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Audio References
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);
  
  // Animation for visualizer
  const animationFrameRef = useRef<number>();

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
      
      // Setup Analyser for AI output
      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(outputCtx.destination);
      outputAnalyserRef.current = analyser;

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      return { stream, inputCtx, outputCtx };
    } catch (err: any) {
      console.error("Audio initialization error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error("Microphone permission denied. Please allow access in your browser settings.");
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error("No microphone found. Please check your audio devices.");
      }
      if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        throw new Error("Microphone is busy or not readable. Please check if another app is using it.");
      }
      throw new Error(`Audio device error: ${err.message || "Unknown error"}`);
    }
  };

  const connectToLive = async () => {
    setError(null);
    try {
      const { stream, inputCtx, outputCtx } = await initializeAudio();

      aiRef.current = new GoogleGenAI({ apiKey });
      
      const sessionPromise = aiRef.current.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: 'You are a helpful AI assistant capable of Thai and English conversation. Respond naturally and concisely. If I speak Thai, respond in Thai.',
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
               
               // User volume visualization
               let sum = 0;
               for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
               const rms = Math.sqrt(sum / inputData.length);
               setVolumeLevel(Math.min(rms * 5, 1));

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
              
              // Connect to analyser if available, otherwise destination
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
          onclose: () => {
            console.log("Session closed");
            disconnect();
          },
          onerror: (err: any) => {
            console.error("Session error:", err);
            let errorMessage = "An unexpected connection error occurred.";
            
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (err instanceof ErrorEvent) {
                errorMessage = `Connection failed: ${err.message || "Network issue"}`;
            } else if (typeof err === 'string') {
                errorMessage = err;
            } else if (typeof err === 'object' && err !== null && 'message' in err) {
                errorMessage = (err as any).message;
            }
            
            if (errorMessage.includes("403")) {
              errorMessage = "Access denied (403). Please verify your API key.";
            } else if (errorMessage.includes("503")) {
              errorMessage = "Service unavailable (503). The model may be overloaded.";
            }

            setError(errorMessage);
            disconnect();
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e: any) {
      setError(e.message || "Failed to establish connection.");
      disconnect();
    }
  };

  const disconnect = () => {
    setIsConnected(false);
    setVolumeLevel(0);
    setAiVolumeLevel(0);
    
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
    
    outputAnalyserRef.current = null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    sessionRef.current?.then((s: any) => {
        if(s.close) s.close();
    });
    sessionRef.current = null;
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // AI Volume Animation Loop
  useEffect(() => {
    if (isConnected) {
      const updateAiVolume = () => {
        if (outputAnalyserRef.current) {
          const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
          outputAnalyserRef.current.getByteFrequencyData(dataArray);
          
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const average = sum / dataArray.length;
          // Normalize and smooth
          const vol = Math.min(average / 50, 1.2); 
          setAiVolumeLevel(vol);
        }
        animationFrameRef.current = requestAnimationFrame(updateAiVolume);
      };
      updateAiVolume();
    } else {
      setAiVolumeLevel(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isConnected]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl overflow-hidden text-white relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-900 to-slate-900 z-0 pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-8 space-y-8">
        
        {/* Visualizer Circle */}
        <div className="relative group">
          {/* User Voice Glow */}
          <div className={`absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 transition-all duration-100 ease-out`} 
               style={{ transform: `scale(${1 + volumeLevel})` }} 
          />
          {/* AI Voice Glow */}
          {isConnected && (
            <div className={`absolute inset-0 bg-purple-500 rounded-full blur-2xl transition-all duration-100 ease-out`} 
                 style={{ 
                   transform: `scale(${1 + aiVolumeLevel})`, 
                   opacity: aiVolumeLevel > 0.1 ? 0.3 : 0 
                 }} 
            />
          )}

          <div className={`
            w-48 h-48 rounded-full border-4 flex items-center justify-center relative shadow-2xl transition-all duration-300 overflow-hidden
            ${isConnected 
              ? 'border-blue-400/30 bg-slate-800/80 backdrop-blur-md' 
              : 'border-slate-700 bg-slate-800'}
          `}>
             {isConnected ? (
               <div className="relative flex items-center justify-center w-full h-full">
                 {/* AI Pulse Icon */}
                 <div className="absolute z-10 transition-transform duration-75"
                      style={{ transform: `scale(${1 + (aiVolumeLevel * 0.4)})` }}>
                    <Sparkles 
                      size={48} 
                      className={`text-purple-300 transition-all duration-200 ${aiVolumeLevel > 0.05 ? 'opacity-100 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]' : 'opacity-30'}`} 
                    />
                 </div>

                 {/* User Mic Visualizer (Bars) */}
                 <div className="absolute bottom-8 flex gap-1 items-end h-8 opacity-40">
                    {[...Array(5)].map((_, i) => (
                       <div 
                         key={i} 
                         className="w-2 bg-blue-400 rounded-full transition-all duration-75"
                         style={{ 
                           height: `${20 + (volumeLevel * 100 * Math.random())}%`,
                         }}
                       />
                    ))}
                 </div>
               </div>
             ) : (
               <Radio size={48} className="text-slate-500" />
             )}
          </div>
          
          {isConnected && (
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-blue-200 text-sm font-medium animate-pulse whitespace-nowrap">
              {aiVolumeLevel > 0.1 ? "Gemini is speaking..." : "Listening..."}
            </div>
          )}
        </div>

        {/* Status Text */}
        <div className="text-center space-y-2 h-16 w-full max-w-lg">
          {!isConnected && !error && (
            <p className="text-slate-400">
              Start a real-time voice conversation with Gemini. Speak naturally in Thai or English.
            </p>
          )}
          {error && (
             <div className="flex items-center justify-center gap-3 text-red-200 bg-red-900/40 border border-red-500/30 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
               <AlertCircle size={18} className="flex-shrink-0" />
               <span className="text-sm font-medium">{error}</span>
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
              <span>Start Conversation</span>
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-all border ${
                  isMuted 
                    ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30' 
                    : 'bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700'
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
                <span>End Call</span>
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="absolute bottom-4 right-4 text-xs text-slate-500 flex items-center gap-1">
        <Activity size={12} />
        <span>Gemini 2.5 Live Audio (Preview)</span>
      </div>
    </div>
  );
};

export default LiveInterface;