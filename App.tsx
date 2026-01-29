import React, { useRef, useState } from 'react';
import Canvas, { CanvasRef } from './components/Canvas';
import AICenter from './components/AICenter';
import LiveAssistant from './components/LiveAssistant';
import { ToolType, DrawingSettings } from './types';

export default function App() {
  const canvasRef = useRef<CanvasRef>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isLiveOpen, setLiveOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [settings, setSettings] = useState<DrawingSettings>({
    color: '#1c1917', // Ink color
    size: 10,
    opacity: 1,
    hardness: 1,
    spacing: 0.1,
    jitter: 0,
    tool: ToolType.PENCIL,
    isStylus: false
  });

  const tools = [
    { type: ToolType.PENCIL, label: 'Pencil', icon: '✎' },
    { type: ToolType.BRUSH, label: 'Brush', icon: '🖌' },
    { type: ToolType.INK, label: 'Ink', icon: '✒' },
    { type: ToolType.PIXEL, label: 'Pixel', icon: '▦' },
    { type: ToolType.ERASER, label: 'Eraser', icon: '⌫' },
  ];

  const updateSetting = (key: keyof DrawingSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex h-screen overflow-hidden selection:bg-amber-500 selection:text-white font-sans">
      {/* Left Toolbar */}
      <div className="w-16 bg-[#1c1917] border-r border-[#443C36] flex flex-col items-center py-4 space-y-4 z-20">
        <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center font-serif font-bold text-xl text-[#292524] mb-4">
            D
        </div>
        
        {tools.map(tool => (
            <button
                key={tool.type}
                onClick={() => updateSetting('tool', tool.type)}
                className={`w-10 h-10 rounded flex items-center justify-center text-xl transition
                ${settings.tool === tool.type ? 'bg-stone-700 text-amber-500 border border-amber-600' : 'text-stone-500 hover:text-stone-300'}`}
                title={tool.label}
            >
                {tool.icon}
            </button>
        ))}

        <div className="h-px w-8 bg-[#443C36] my-2" />

        {/* Color Picker */}
        <div className="relative group">
            <input 
                type="color" 
                value={settings.color}
                onChange={(e) => updateSetting('color', e.target.value)}
                className="w-8 h-8 rounded-full overflow-hidden border-2 border-stone-600 cursor-pointer p-0"
            />
        </div>

        <div className="flex-1" />

        {/* Live Button */}
        <button
            onClick={() => setLiveOpen(true)}
            className="w-10 h-10 rounded-full bg-red-900/50 text-red-400 border border-red-800 flex items-center justify-center animate-pulse"
            title="Voice Assistant"
        >
            🎙
        </button>

        <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="text-stone-500 hover:text-white p-2"
        >
            {isSidebarOpen ? '»' : '«'}
        </button>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative bg-[#292524] flex items-center justify-center overflow-hidden">
        
        {/* Tool Options Bar (Floating) */}
        <div className="absolute top-4 left-4 right-4 h-14 bg-[#1c1917]/90 backdrop-blur-md border border-[#443C36] rounded shadow-2xl z-30 flex items-center px-6 gap-6 overflow-x-auto">
            <span className="text-amber-500 font-bold uppercase tracking-widest text-xs whitespace-nowrap">
                {tools.find(t => t.type === settings.tool)?.label || 'Tool'} Options
            </span>
            <div className="h-8 w-px bg-stone-700" />
            
            {/* Size */}
            <div className="flex flex-col w-32">
                <div className="flex justify-between text-[10px] text-stone-400 uppercase font-bold">
                    <span>Size</span>
                    <span>{settings.size}px</span>
                </div>
                <input 
                    type="range" min="1" max="100" 
                    value={settings.size} 
                    onChange={(e) => updateSetting('size', Number(e.target.value))}
                    className="accent-amber-600 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            {/* Opacity */}
            <div className="flex flex-col w-32">
                <div className="flex justify-between text-[10px] text-stone-400 uppercase font-bold">
                    <span>Opacity</span>
                    <span>{Math.round(settings.opacity * 100)}%</span>
                </div>
                <input 
                    type="range" min="0.1" max="1" step="0.1"
                    value={settings.opacity} 
                    onChange={(e) => updateSetting('opacity', Number(e.target.value))}
                    className="accent-amber-600 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            {/* Hardness */}
            <div className="flex flex-col w-32">
                <div className="flex justify-between text-[10px] text-stone-400 uppercase font-bold">
                    <span>Hardness</span>
                    <span>{Math.round(settings.hardness * 100)}%</span>
                </div>
                <input 
                    type="range" min="0" max="1" step="0.05"
                    value={settings.hardness} 
                    onChange={(e) => updateSetting('hardness', Number(e.target.value))}
                    className="accent-amber-600 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            {/* Spacing */}
            <div className="flex flex-col w-32">
                <div className="flex justify-between text-[10px] text-stone-400 uppercase font-bold">
                    <span>Spacing</span>
                    <span>{settings.spacing.toFixed(2)}x</span>
                </div>
                <input 
                    type="range" min="0.05" max="3.0" step="0.05"
                    value={settings.spacing} 
                    onChange={(e) => updateSetting('spacing', Number(e.target.value))}
                    className="accent-amber-600 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            {/* Jitter */}
            <div className="flex flex-col w-32">
                <div className="flex justify-between text-[10px] text-stone-400 uppercase font-bold">
                    <span>Jitter</span>
                    <span>{Math.round(settings.jitter * 100)}%</span>
                </div>
                <input 
                    type="range" min="0" max="1" step="0.01"
                    value={settings.jitter} 
                    onChange={(e) => updateSetting('jitter', Number(e.target.value))}
                    className="accent-amber-600 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>
        </div>

        {/* Canvas Wrapper */}
        <div className="w-full h-full p-8 pt-24"> 
            <div className="relative w-full h-full shadow-2xl border-[16px] border-[#3E2723] rounded-sm bg-[#F5F5DC]">
                <Canvas 
                    ref={canvasRef} 
                    settings={settings}
                    onStrokeEnd={() => {}}
                />
            </div>
        </div>
        
        {/* Overlay Loader */}
        {isLoading && (
            <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center backdrop-blur-sm">
                <div className="text-amber-500 font-serif text-xl animate-bounce">
                    The Muse is Thinking...
                </div>
            </div>
        )}
      </div>

      {/* Right Sidebar - AI Center */}
      <div className={`bg-[#1c1917] transition-all duration-300 ease-in-out border-l border-[#443C36] flex flex-col z-20
          ${isSidebarOpen ? 'w-96' : 'w-0 overflow-hidden'}`}>
        {isSidebarOpen && (
            <AICenter 
                onAnalyze={async () => canvasRef.current?.getImageData() || ''}
                onApplyImage={(base64) => canvasRef.current?.loadImage(base64)}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
            />
        )}
      </div>

      <LiveAssistant isOpen={isLiveOpen} onClose={() => setLiveOpen(false)} />
    </div>
  );
}