import React, { useState } from 'react';
import * as GeminiService from '../services/geminiService';
import { ChatMessage, AIGenerationConfig } from '../types';

interface AICenterProps {
  onAnalyze: () => Promise<string>; // Get canvas base64
  onApplyImage: (base64: string) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
}

const AICenter: React.FC<AICenterProps> = ({ onAnalyze, onApplyImage, isLoading, setIsLoading }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'generate' | 'edit' | 'video'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'intro',
    role: 'system',
    text: 'Welcome to the Studio. How can I assist your creative process today?'
  }]);
  const [input, setInput] = useState('');
  const [config, setConfig] = useState<AIGenerationConfig>({
    model: 'gemini-3-pro-image-preview',
    prompt: '',
    aspectRatio: '1:1',
    imageSize: '1K'
  });
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);

  // Chat
  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
        // Simple heuristic for grounding
        let grounding: 'none' | 'search' | 'maps' = 'none';
        if (input.toLowerCase().includes('search') || input.toLowerCase().includes('latest') || input.toLowerCase().includes('news')) grounding = 'search';
        if (input.toLowerCase().includes('map') || input.toLowerCase().includes('place') || input.toLowerCase().includes('location')) grounding = 'maps';

        let loc;
        if (grounding === 'maps') {
            try {
                 const pos: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
                 loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            } catch (e) {
                console.warn('Geolocation failed', e);
                // Fallback or ignore
            }
        }
        
        const response = await GeminiService.chatWithGemini(messages, input, 'gemini-3-pro-preview', grounding, loc);
        
        let text = response.text;
        if (response.groundingChunks) {
             text += "\n\nSources:\n" + response.groundingChunks.map((c: any) => {
                 if (c.web?.uri) return `- [${c.web.title}](${c.web.uri})`;
                 if (c.maps?.uri) return `- [${c.maps.title}](${c.maps.uri})`;
                 return '';
             }).join('\n');
        }

        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text }]);
    } catch (e) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text: 'Error connecting to the Muse.' }]);
    } finally {
        setIsLoading(false);
    }
  };

  // Generate Image
  const handleGenerateImage = async () => {
    setIsLoading(true);
    try {
        const images = await GeminiService.generateImage({
            ...config,
            prompt: input || config.prompt
        });
        if (images[0]) {
            onApplyImage(images[0].split(',')[1]); // Send base64 to canvas
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text: 'Image generated and applied to canvas.' }]);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  // Edit Image
  const handleEditImage = async () => {
    setIsLoading(true);
    try {
        const canvasBase64 = await onAnalyze();
        const result = await GeminiService.editImage(canvasBase64, input, 'gemini-2.5-flash-image');
        if (result) {
            onApplyImage(result.split(',')[1]);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  // Analyze
  const handleAnalyze = async () => {
      setIsLoading(true);
      try {
          const canvasBase64 = await onAnalyze();
          const text = await GeminiService.analyzeImage(canvasBase64, input || "Critique this artwork.", "gemini-3-pro-preview");
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `Analysis: ${text}` }]);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  // Video
  const handleVideo = async () => {
      setIsLoading(true);
      try {
        // Optional: grab canvas as starting image
        let image = undefined;
        // If user wants to animate current canvas:
        if (input.toLowerCase().includes("animate")) {
             image = await onAnalyze();
        }

        const videoUrl = await GeminiService.generateVideo(
            input || "Artistic video", 
            image,
            'veo-3.1-fast-generate-preview',
            config.aspectRatio
        );
        if (videoUrl) {
            setGeneratedVideo(videoUrl);
        }
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#272320] border-l border-[#443C36]">
      {/* Tabs */}
      <div className="flex border-b border-[#443C36]">
        {['chat', 'generate', 'edit', 'video'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t as any)}
            className={`flex-1 py-3 text-xs uppercase tracking-widest font-bold ${
              activeTab === t ? 'bg-[#78350f] text-white' : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'chat' && (
          <div className="space-y-4">
             {messages.map(m => (
                 <div key={m.id} className={`p-3 rounded text-sm ${m.role === 'user' ? 'bg-[#78350f] text-white ml-8' : 'bg-[#1c1917] text-stone-300 mr-8 border border-[#443C36]'}`}>
                     <p className="whitespace-pre-wrap">{m.text}</p>
                 </div>
             ))}
          </div>
        )}

        {activeTab === 'generate' && (
           <div className="space-y-4 text-stone-300">
               <h3 className="serif text-xl text-amber-500">Forge New Art</h3>
               <label className="block text-xs uppercase">Model: Gemini 3 Pro</label>
               <div className="grid grid-cols-2 gap-2">
                   {['1:1', '16:9', '9:16', '4:3', '3:4'].map(r => (
                       <button key={r} onClick={() => setConfig({...config, aspectRatio: r})}
                         className={`p-2 border ${config.aspectRatio === r ? 'border-amber-500 text-amber-500' : 'border-stone-700'}`}>
                           {r}
                       </button>
                   ))}
               </div>
               <div className="grid grid-cols-3 gap-2">
                   {['1K', '2K', '4K'].map(s => (
                       <button key={s} onClick={() => setConfig({...config, imageSize: s})}
                         className={`p-2 border ${config.imageSize === s ? 'border-amber-500 text-amber-500' : 'border-stone-700'}`}>
                           {s}
                       </button>
                   ))}
               </div>
           </div>
        )}

        {activeTab === 'edit' && (
            <div className="text-stone-300 space-y-4">
                <h3 className="serif text-xl text-amber-500">Refine & Edit</h3>
                <p className="text-xs">Describe how you want to change the current canvas. E.g., "Make it look like a Van Gogh painting" or "Add a red balloon".</p>
                <button onClick={handleAnalyze} className="w-full py-2 border border-stone-600 hover:border-amber-500">
                    Just Analyze/Critique
                </button>
            </div>
        )}

        {activeTab === 'video' && (
            <div className="text-stone-300 space-y-4">
                <h3 className="serif text-xl text-amber-500">Veo Animation</h3>
                <p className="text-xs">Type "Animate this" to use current canvas, or describe a new video.</p>
                {generatedVideo && (
                    <video src={generatedVideo} controls className="w-full rounded border border-amber-900" />
                )}
            </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#1c1917] border-t border-[#443C36]">
        <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeTab === 'chat' ? "Ask the Master..." : "Describe your vision..."}
            className="w-full bg-[#272320] text-white p-2 text-sm border border-[#443C36] focus:border-amber-700 outline-none rounded resize-none h-24 mb-2"
        />
        <div className="flex gap-2">
            <button 
                onClick={
                    activeTab === 'chat' ? handleSend :
                    activeTab === 'generate' ? handleGenerateImage :
                    activeTab === 'edit' ? handleEditImage :
                    handleVideo
                }
                disabled={isLoading}
                className="flex-1 bg-[#78350f] hover:bg-[#92400e] text-white py-2 font-bold cinzel tracking-widest disabled:opacity-50"
            >
                {isLoading ? 'WORKING...' : 'EXECUTE'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default AICenter;