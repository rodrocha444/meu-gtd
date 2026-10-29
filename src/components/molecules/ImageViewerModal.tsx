import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { NativeBridge } from '../../lib/native';

interface ImageViewerModalProps {
  src: string | null;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  src,
  alt = 'Visualização de imagem',
  isOpen,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchScaleRef = useRef(1);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Reseta estado sempre que o modal abre ou a imagem muda
  useEffect(() => {
    if (isOpen) {
      resetZoom();
    }
  }, [isOpen, src, resetZoom]);

  const handleZoomIn = useCallback(() => {
    void NativeBridge.hapticLightImpact();
    setScale((prev) => Math.min(4, Math.round((prev + 0.25) * 100) / 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    void NativeBridge.hapticLightImpact();
    setScale((prev) => {
      const next = Math.max(0.5, Math.round((prev - 0.25) * 100) / 100);
      if (next <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handleToggleZoom = useCallback(() => {
    void NativeBridge.hapticLightImpact();
    setScale((prev) => {
      if (prev > 1) {
        setPosition({ x: 0, y: 0 });
        return 1;
      }
      return 2;
    });
  }, []);

  // Teclado: Escape fecha; + / = zoom in; - zoom out; 0 / r reseta
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0' || e.key.toLowerCase() === 'r') {
        e.preventDefault();
        void NativeBridge.hapticLightImpact();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, handleZoomIn, handleZoomOut, resetZoom]);

  // Zoom via roda do mouse (Wheel)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = -e.deltaY * 0.002;
    setScale((prev) => {
      const next = Math.min(4, Math.max(0.5, Math.round((prev + delta * prev) * 100) / 100));
      if (next <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  // Pan com Mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
    }
  };

  // Pan & Pinch com Touch no Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      const touch = e.touches[0];
      if (!touch) return;
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStartRef.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y,
      };
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (t1 && t2) {
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        initialPinchDistRef.current = dist;
        initialPinchScaleRef.current = scale;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const touch = e.touches[0];
      if (!touch) return;
      setPosition({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y,
      });
    } else if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (t1 && t2) {
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const ratio = dist / initialPinchDistRef.current;
        const newScale = Math.min(
          4,
          Math.max(0.5, Math.round(initialPinchScaleRef.current * ratio * 100) / 100)
        );
        setScale(newScale);
        if (newScale <= 1) {
          setPosition({ x: 0, y: 0 });
        }
      }
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    initialPinchDistRef.current = null;
  };

  if (!isOpen || !src) return null;
  if (typeof document === 'undefined') return null;

  const isZoomed = scale !== 1 || position.x !== 0 || position.y !== 0;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-150 overflow-hidden"
      onClick={() => {
        void NativeBridge.hapticLightImpact();
        onClose();
      }}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
    >
      {/* Barra de Ações Superior: Controles de Zoom e Botão Fechar */}
      <div
        className="fixed top-[calc(env(safe-area-inset-top,0px)+0.75rem)] right-[calc(env(safe-area-inset-right,0px)+0.75rem)] z-[10000] flex items-center gap-2 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Controles de Zoom Flutuantes */}
        <div className="flex items-center bg-zinc-900/90 backdrop-blur-md border border-zinc-700/80 rounded-full p-1 shadow-2xl">
          <button
            type="button"
            aria-label="Diminuir zoom (-)"
            title="Diminuir zoom (-)"
            disabled={scale <= 0.5}
            onClick={handleZoomOut}
            className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent transition-all active:scale-95 cursor-pointer touch-manipulation"
          >
            <ZoomOut className="w-4 h-4 stroke-[2.2]" />
          </button>

          <button
            type="button"
            aria-label="Alternar zoom"
            title="Clique para alternar zoom 100% / 200%"
            onClick={handleToggleZoom}
            className="px-2.5 py-1 text-xs font-semibold font-mono text-zinc-200 hover:text-indigo-400 transition-colors cursor-pointer touch-manipulation"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            aria-label="Aumentar zoom (+)"
            title="Aumentar zoom (+)"
            disabled={scale >= 4}
            onClick={handleZoomIn}
            className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent transition-all active:scale-95 cursor-pointer touch-manipulation"
          >
            <ZoomIn className="w-4 h-4 stroke-[2.2]" />
          </button>

          {isZoomed && (
            <button
              type="button"
              aria-label="Resetar zoom (0)"
              title="Resetar zoom (0 / R)"
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                resetZoom();
              }}
              className="p-2 ml-0.5 rounded-full text-amber-400 hover:text-amber-300 hover:bg-zinc-800 transition-all active:scale-95 border-l border-zinc-700/60 cursor-pointer touch-manipulation"
            >
              <RotateCcw className="w-4 h-4 stroke-[2.2]" />
            </button>
          )}
        </div>

        {/* Botão de Fechar */}
        <button
          type="button"
          aria-label="Fechar visualização"
          title="Fechar (Esc)"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            void NativeBridge.hapticLightImpact();
            onClose();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-2.5 rounded-full bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700/80 shadow-2xl transition-all active:scale-95 cursor-pointer touch-manipulation"
        >
          <X className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>

      {/* Conteúdo central da Imagem em Tela Cheia com Zoom & Pan */}
      <div
        className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-8"
        onClick={(e) => {
          // Se clicou no fundo do container (fora da imagem), fecha a visualização
          if (e.target === e.currentTarget) {
            void NativeBridge.hapticLightImpact();
            onClose();
          }
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div
          className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-75"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
            cursor:
              scale > 1
                ? isDragging
                  ? 'grabbing'
                  : 'grab'
                : 'zoom-in',
          }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleToggleZoom();
          }}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="max-w-[92vw] max-h-[85vh] w-auto h-auto object-contain rounded-xl shadow-2xl border border-zinc-800/80 pointer-events-auto"
          />
        </div>

        {/* Legenda opcional */}
        {alt && alt !== 'Imagem' && alt !== 'imagem' && alt !== 'screenshot' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10">
            <p className="px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-medium text-zinc-300 max-w-md truncate text-center shadow-lg">
              {alt}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
