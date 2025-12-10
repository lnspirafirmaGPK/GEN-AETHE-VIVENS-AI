

export enum Sender {
  User = 'user',
  Bot = 'bot',
}

export interface ChatMessage {
  id: string;
  role: Sender;
  text: string;
  isThinking?: boolean;
  timestamp: number;
  attachment?: {
    name: string;
    type: string;
  };
}

export enum AppMode {
  Chat = 'chat',
  Live = 'live',
  Transcribe = 'transcribe',
  Codegen = 'codegen',
}

export interface AudioVisualizerData {
  volume: number;
}

export interface LiveConnectionState {
  isConnected: boolean;
  isStreaming: boolean;
  error: string | null;
}

export type Language = 'en' | 'th';

// NEW: Prebuilt voice names for selection
export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
export const PREBUILT_VOICES: VoiceName[] = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];


// NEW: Codegen specific types
export interface CodegenArtifact {
  source_code: string;
  audit_report: string;
  engine_signature: string;
}

export type CodegenPhase = 'DRAFTING' | 'VETTING' | 'BLOCKED' | 'FINALIZED';

export interface CodegenMessage {
  id: string;
  role: Sender;
  text?: string; // User message has text, bot might not initially
  timestamp: number;
  flowId: string;
  currentPhase?: CodegenPhase;
  isStreamingPhase?: boolean; // Indicates if phases are still being streamed/updated
  validationScore?: number; // Patimokkha score for bot responses
  artifact?: CodegenArtifact;
  feedback?: 'POSITIVE' | 'NEGATIVE';
}