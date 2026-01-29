import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { DrawingSettings, Point, ToolType } from '../types';

interface CanvasProps {
  settings: DrawingSettings;
  onStrokeEnd: () => void;
}

export interface CanvasRef {
  getImageData: () => string;
  clear: () => void;
  loadImage: (base64: string) => void;
}

const Canvas = forwardRef<CanvasRef, CanvasProps>(({ settings, onStrokeEnd }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPoint = useRef<Point | null>(null);
  // Track leftover distance for smooth spacing between events
  const distRemainder = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    getImageData: () => {
      if (!canvasRef.current) return '';
      return canvasRef.current.toDataURL('image/png').split(',')[1];
    },
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.fillStyle = '#F5F5DC';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    },
    loadImage: (base64: string) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = `data:image/png;base64,${base64}`;
        }
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#F5F5DC';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  const getCoordinates = (e: React.PointerEvent | PointerEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure !== 0 ? e.pressure : 0.5, // Default pressure if not supported
      tilt: e.tiltX
    };
  };

  const startDrawing = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const point = getCoordinates(e);
    lastPoint.current = point;
    distRemainder.current = 0;
    
    drawStamp(point);
  };

  const drawStamp = (pt: Point) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      const baseSize = settings.size;
      const pressure = settings.isStylus ? (pt.pressure || 0.5) : 1;
      const size = baseSize * pressure;

      // Pixel Art Logic
      if (settings.tool === ToolType.PIXEL) {
        const pixelSize = Math.max(1, Math.floor(settings.size / 2));
        const x = Math.floor(pt.x / pixelSize) * pixelSize;
        const y = Math.floor(pt.y / pixelSize) * pixelSize;
        ctx.fillStyle = settings.tool === ToolType.ERASER ? '#F5F5DC' : settings.color;
        ctx.globalAlpha = 1;
        ctx.fillRect(x, y, pixelSize, pixelSize);
        return;
      }

      // Advanced Brush Logic
      const isEraser = settings.tool === ToolType.ERASER;
      
      // Calculate Jitter
      let jx = 0; 
      let jy = 0;
      if (settings.jitter > 0) {
          jx = (Math.random() - 0.5) * settings.jitter * size * 2;
          jy = (Math.random() - 0.5) * settings.jitter * size * 2;
      }

      const drawX = pt.x + jx;
      const drawY = pt.y + jy;

      ctx.globalAlpha = settings.opacity;
      
      if (settings.hardness < 1) {
          // Soft Brush
          const gradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, size / 2);
          const color = isEraser ? '#F5F5DC' : settings.color;
          // Convert hex to rgb for rgba manipulation if needed, but ctx handles it
          gradient.addColorStop(settings.hardness, color); 
          gradient.addColorStop(1, isEraser ? 'rgba(245, 245, 220, 0)' : `${color}00`); // fade out
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(drawX, drawY, size / 2, 0, Math.PI * 2);
          ctx.fill();
      } else {
          // Hard Brush
          ctx.fillStyle = isEraser ? '#F5F5DC' : settings.color;
          ctx.beginPath();
          ctx.arc(drawX, drawY, size / 2, 0, Math.PI * 2);
          ctx.fill();
      }
  };

  const interpolate = (start: Point, end: Point) => {
      // Calculate distance
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Determine spacing step
      // Ensure minimum step of 1px or 10% of size
      const step = Math.max(0.5, settings.size * settings.spacing);

      let currentDist = distRemainder.current;
      
      // Interpolate along the line
      while (currentDist <= dist) {
          const t = currentDist / dist;
          const x = start.x + dx * t;
          const y = start.y + dy * t;
          
          // Interpolate pressure
          const startP = start.pressure || 0.5;
          const endP = end.pressure || 0.5;
          const pressure = startP + (endP - startP) * t;

          drawStamp({ x, y, pressure });
          
          currentDist += step;
      }

      // Save remainder for next event
      distRemainder.current = currentDist - dist;
  };

  const continueDrawing = (e: React.PointerEvent) => {
    if (!isDrawing || !lastPoint.current) return;
    const currentPoint = getCoordinates(e);

    // If Pixel tool, just draw directly (no interpolation needed usually for raw pixels)
    if (settings.tool === ToolType.PIXEL) {
        drawStamp(currentPoint);
    } else {
        interpolate(lastPoint.current, currentPoint);
    }
    
    lastPoint.current = currentPoint;
  };

  const stopDrawing = () => {
    if (isDrawing) {
        setIsDrawing(false);
        lastPoint.current = null;
        onStrokeEnd();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full touch-none cursor-crosshair shadow-inner"
      onPointerDown={startDrawing}
      onPointerMove={continueDrawing}
      onPointerUp={stopDrawing}
      onPointerLeave={stopDrawing}
      style={{
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.1)'
      }}
    />
  );
});

export default Canvas;