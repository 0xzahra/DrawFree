import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import { ChatMessage, AIGenerationConfig } from "../types";

// Helper to get fresh instance (handling key updates if needed)
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateText = async (
  prompt: string,
  systemInstruction?: string,
  model = "gemini-3-pro-preview",
  useThinking = false
): Promise<string> => {
  const ai = getAI();
  const config: any = {
    systemInstruction,
  };

  if (useThinking) {
    config.thinkingConfig = { thinkingBudget: 16000 }; // Moderate budget
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config,
  });

  return response.text || "No response generated.";
};

export const chatWithGemini = async (
  history: ChatMessage[],
  newMessage: string,
  model = "gemini-3-pro-preview",
  grounding: 'none' | 'search' | 'maps' = 'none',
  location?: { lat: number; lng: number }
): Promise<{ text: string; groundingChunks?: any[] }> => {
  const ai = getAI();
  
  const tools: any[] = [];
  if (grounding === 'search') tools.push({ googleSearch: {} });
  if (grounding === 'maps') tools.push({ googleMaps: {} });

  const config: any = {
    tools: tools.length > 0 ? tools : undefined,
  };

  if (grounding === 'maps' && location) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: {
          latitude: location.lat,
          longitude: location.lng,
        },
      },
    };
  }

  // Convert history to format expected by Chat (simplified for single turn here, but ideally uses history)
  // For simplicity in this demo, we'll send the new message as a generateContent call with history context if needed,
  // or use chat.sendMessage. Let's use chat.
  
  // Note: Grounding requires models.generateContent generally for one-off with tools easily. 
  // Let's stick to generateContent for maximum flexibility with tools in this stateless service wrapper.
  
  let contents: any[] = [];
  // Add simplified history context
  history.forEach(h => {
    contents.push({ role: h.role, parts: [{ text: h.text }] });
  });
  contents.push({ role: 'user', parts: [{ text: newMessage }] });

  const response = await ai.models.generateContent({
    model: grounding === 'maps' ? 'gemini-2.5-flash' : model, // Maps specific requirement
    contents: contents,
    config
  });

  return {
    text: response.text || "",
    groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
  };
};

export const analyzeImage = async (
  base64Image: string,
  prompt: string,
  model = "gemini-3-pro-preview"
): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType: "image/png", data: base64Image } },
        { text: prompt },
      ],
    },
  });
  return response.text || "";
};

export const generateImage = async (config: AIGenerationConfig): Promise<string[]> => {
  const ai = getAI();
  const { model, prompt, aspectRatio, imageSize } = config;
  
  // We use generateContent for nano banana series
  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any || "1:1",
        imageSize: imageSize as any || "1K"
      }
    }
  });

  const images: string[] = [];
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        images.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    }
  }
  return images;
};

export const editImage = async (
  base64Image: string,
  prompt: string,
  model = "gemini-2.5-flash-image"
): Promise<string | null> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType: "image/png", data: base64Image } },
        { text: prompt },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};

export const generateVideo = async (
  prompt: string,
  image?: string,
  model = "veo-3.1-fast-generate-preview",
  aspectRatio = "16:9"
): Promise<string | null> => {
  // Ensure Key Selection for Veo
  if (window.aistudio) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
    }
  }

  // Create fresh instance after key selection
  const ai = getAI(); 

  let operation: any;
  const config = {
    numberOfVideos: 1,
    resolution: "720p",
    aspectRatio: aspectRatio,
  };

  if (image) {
    operation = await ai.models.generateVideos({
      model,
      prompt,
      image: { imageBytes: image, mimeType: 'image/png' },
      config
    });
  } else {
    operation = await ai.models.generateVideos({
      model,
      prompt,
      config
    });
  }

  // Polling
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (downloadLink) {
    // Fetch blob
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  return null;
};

// --- Live API & Audio Utils ---

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const createPcmBlob = (data: Float32Array): { data: string; mimeType: string } => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values
    let s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return {
    data: btoa(binary),
    mimeType: 'audio/pcm;rate=16000',
  };
};

export const decodeAudioData = async (
  base64: string,
  ctx: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const dataInt16 = new Int16Array(bytes.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
};

export const connectLiveSession = async (
  onAudioData: (base64: string) => void,
  onClose: () => void
): Promise<{ sendAudio: (blob: any) => void; close: () => void }> => {
  const ai = getAI();
  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    callbacks: {
      onopen: () => console.log('Live Session Opened'),
      onmessage: (message: LiveServerMessage) => {
        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
          onAudioData(audioData);
        }
      },
      onclose: onClose,
      onerror: (e) => console.error('Live Error', e),
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
      systemInstruction: "You are the Drawfree Art Studio Assistant. Helpful, creative, and refined.",
    },
  });

  return {
    sendAudio: async (pcmBlob: any) => {
      const session = await sessionPromise;
      session.sendRealtimeInput({ media: pcmBlob });
    },
    close: async () => {
      const session = await sessionPromise;
      session.close();
    }
  };
};
