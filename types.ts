
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
