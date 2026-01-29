import React, { useEffect, useRef, useState } from 'react';
import { connectLiveSession, createPcmBlob, decodeAudioData } from '../services/geminiService';

interface LiveAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'active' | 'error'>('connecting');
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const liveSessionRef = useRef<{ sendAudio: (blob: any) => void; close: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
        // Cleanup if closed
        liveSessionRef.current?.close();
        liveSessionRef.current = null;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        audioContextRef.current?.close();
        audioContextRef.current = null;
        return;
    }

    const init = async () => {
        try {
            setStatus('connecting');
            
            // Audio Contexts
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContextClass({ sampleRate: 24000 });
            audioContextRef.current = ctx;
            nextStartTimeRef.current = ctx.currentTime;

            // Mic Stream
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Output Gain
            const outputNode = ctx.createGain();
            outputNode.connect(ctx.destination);

            // Connect Live
            const session = await connectLiveSession(
                async (base64Audio) => {
                    // Play audio from model
                    if (!audioContextRef.current) return;
                    
                    const buffer = await decodeAudioData(base64Audio, audioContextRef.current);
                    const source = audioContextRef.current.createBufferSource();
                    source.buffer = buffer;
                    source.connect(outputNode);
                    
                    const now = audioContextRef.current.currentTime;
                    // Schedule for gapless playback
                    const start = Math.max(now, nextStartTimeRef.current);
                    source.start(start);
                    nextStartTimeRef.current = start + buffer.duration;
                },
                () => setStatus('error')
            );
            liveSessionRef.current = session;

            // Process Mic Input
            const inputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                session.sendAudio(pcmBlob);
            };

            source.connect(processor);
            processor.connect(inputCtx.destination); // Required for script processor to run

            setStatus('active');
        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    init();

    return () => {
         // Cleanup handled at start of effect or unmount
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center flex-col">
      <div className={`w-64 h-64 rounded-full border-4 flex items-center justify-center animate-pulse
          ${status === 'active' ? 'border-amber-500 bg-amber-900/20' : 'border-stone-700 bg-stone-800'}`}>
          <div className={`w-48 h-48 rounded-full ${status === 'active' ? 'bg-amber-500/50' : 'bg-stone-700'}`} />
      </div>
      
      <h2 className="mt-8 text-3xl font-serif text-white">
          {status === 'connecting' ? 'Connecting to Studio...' : status === 'active' ? 'Listening...' : 'Connection Lost'}
      </h2>
      
      <p className="mt-4 text-stone-400 max-w-md text-center">
          Speak naturally. Ask for critiques, technique advice, or just chat while you draw.
      </p>

      <button 
        onClick={onClose}
        className="mt-12 px-8 py-3 border border-white text-white hover:bg-white hover:text-black transition uppercase tracking-widest"
      >
          End Session
      </button>
    </div>
  );
};

export default LiveAssistant;