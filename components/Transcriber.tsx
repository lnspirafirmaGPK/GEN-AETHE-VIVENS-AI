import React, { useState, useRef } from 'react';
import { FileAudio, Upload, Loader2, CheckCircle2, Mic, Square } from 'lucide-react';
import { transcribeAudioFile } from '../services/gemini';
import { blobToBase64 } from '../services/audio';

const Transcriber: React.FC = () => {
  const [transcription, setTranscription] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
      setError(null);
      setTranscription('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
      setAudioFile(null);
      setTranscription('');
    } catch (err) {
      console.error("Mic error:", err);
      setError("Cannot access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], "recording.webm", { type: 'audio/webm' });
        setAudioFile(file);
        
        // Stop all tracks
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async () => {
    if (!audioFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      const base64 = await blobToBase64(audioFile);
      const result = await transcribeAudioFile(base64, audioFile.type);
      setTranscription(result);
    } catch (err) {
      setError("Failed to transcribe audio. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 mb-2">
            <FileAudio size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Audio Transcription</h2>
          <p className="text-slate-500">
            Upload an audio file or record directly to transcribe speech to text using Gemini Flash.
          </p>
        </div>

        {/* Input Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* File Upload */}
          <div className={`
            border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors
            ${audioFile && !isRecording ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}
          `}>
            <input 
              type="file" 
              accept="audio/*" 
              onChange={handleFileUpload} 
              className="hidden" 
              id="audio-upload"
              disabled={isProcessing || isRecording}
            />
            <label htmlFor="audio-upload" className="cursor-pointer flex flex-col items-center w-full">
               <Upload size={32} className="text-slate-400 mb-2" />
               <span className="text-sm font-medium text-slate-700">Upload Audio File</span>
               <span className="text-xs text-slate-400 mt-1">MP3, WAV, AAC, etc.</span>
            </label>
          </div>

          {/* Recording */}
          <div className={`
            border-2 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors
            ${isRecording ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50'}
          `}>
            {isRecording ? (
              <button 
                onClick={stopRecording}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors animate-pulse"
              >
                <Square size={24} fill="currentColor" />
              </button>
            ) : (
              <button 
                onClick={startRecording}
                disabled={isProcessing}
                className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                <Mic size={28} />
              </button>
            )}
            <span className={`text-sm font-medium ${isRecording ? 'text-red-600' : 'text-slate-700'}`}>
              {isRecording ? 'Recording... Tap to stop' : 'Record Audio'}
            </span>
          </div>
        </div>

        {/* Selected File Status */}
        {audioFile && (
          <div className="bg-slate-50 p-4 rounded-lg flex items-center justify-between border border-slate-200">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                 <FileAudio size={20} />
               </div>
               <div>
                 <p className="text-sm font-medium text-slate-800 truncate max-w-[200px]">{audioFile.name}</p>
                 <p className="text-xs text-slate-500">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
               </div>
             </div>
             <button
               onClick={handleTranscribe}
               disabled={isProcessing}
               className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
             >
               {isProcessing ? <Loader2 className="animate-spin" size={16} /> : null}
               {isProcessing ? 'Transcribing...' : 'Transcribe'}
             </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        {/* Result */}
        {transcription && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500" />
              Transcription Result
            </h3>
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-base leading-relaxed whitespace-pre-wrap min-h-[150px]">
              {transcription}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Transcriber;