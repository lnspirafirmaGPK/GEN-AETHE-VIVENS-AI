import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const createChatSession = (useThinking: boolean = false) => {
  const model = 'gemini-3-pro-preview';
  
  const config: any = {
    systemInstruction: 'You are a helpful, intelligent assistant. You are capable of speaking Thai and English fluently. Answer politely and accurately.',
  };

  if (useThinking) {
    config.thinkingConfig = { thinkingBudget: 32768 };
  }

  return ai.chats.create({
    model,
    config,
  });
};

export const transcribeAudioFile = async (audioBase64: string, mimeType: string): Promise<string> => {
  // Use Flash for fast transcription
  const model = 'gemini-2.5-flash'; 

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          },
          {
            text: "Please transcribe this audio accurately. If the audio is in Thai, transcribe in Thai. If it is mixed, transcribe as appropriate."
          }
        ]
      }
    });

    return response.text || "No transcription generated.";
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};
