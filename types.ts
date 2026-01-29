export enum ToolType {
  PENCIL = 'PENCIL',
  BRUSH = 'BRUSH',
  ERASER = 'ERASER',
  FILL = 'FILL',
  PIXEL = 'PIXEL',
  INK = 'INK',
  CHARCOAL = 'CHARCOAL'
}

export enum AppMode {
  DRAWING = 'DRAWING',
  GALLERY = 'GALLERY',
  COMMUNITY = 'COMMUNITY'
}

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  tilt?: number;
}

export interface DrawingSettings {
  color: string;
  size: number;
  opacity: number;
  hardness: number; // 0 to 1
  spacing: number;  // 0.1 to 3 (ratio of size)
  jitter: number;   // 0 to 1
  tool: ToolType;
  isStylus: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  image?: string;
  isThinking?: boolean;
}

// AI Service Types
export interface AIGenerationConfig {
  model: string;
  prompt: string;
  image?: string; // Base64
  aspectRatio?: string;
  imageSize?: string; // 1K, 2K, 4K
  mimeType?: string;
}

// Global augmentation for AI Studio key selection
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}