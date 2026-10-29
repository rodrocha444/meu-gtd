import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, X, MoveDiagonal, Maximize2 } from 'lucide-react';
import { NativeBridge } from '../../lib/native';

interface ImageResizeOverlayProps {
  imageElement: HTMLImageElement;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onResize: (newWidth: string) => void;
  onOpenFullscreen?: () => void;
  onRemove: () => void;
  onClose: () => void;
}

const PRESETS = [
  { label: '25%', value: '25%' },
  { label: '50%', value: '50%' },
  { label: '75%', value: '75%' },
  { label: '100%', value: '100%' },
];

export const ImageResizeOverlay: React.FC<ImageResizeOverlayProps> = ({
  imageElement,
  scrollContainerRef,
  onResize,
  onOpenFullscreen,
  onRemove,
  onClose,
}) => {
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const isDraggingRef = useRef(false);
  const dragDataRef = useRef<{
    startX: number;
    initialWidth: number;
    containerWidth: number;
  }>({ startX: 0, initialWidth: 0, containerWidth: 0 });

  const updatePosition = useCallback(() => {
    if (!imageElement || !scrollContainerRef.current) return;
    if (!imageElement.isConnected) {
      onClose();
      return;
    }

    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    const imgRect = imageElement.getBoundingClientRect();

    setRect({
      top: imgRect.top - containerRect.top + scrollContainerRef.current.scrollTop,
      left: imgRect.left - containerRect.left + scrollContainerRef.current.scrollLeft,
      width: imgRect.width,
      height: imgRect.height,
    });
  }, [imageElement, scrollContainerRef, onClose]);

  useEffect(() => {
    updatePosition();

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updatePosition, { passive: true });
    }
    window.addEventListener('resize', updatePosition);

    const observer = new ResizeObserver(() => {
      updatePosition();
    });
    observer.observe(imageElement);

    return () => {
      if (container) {
        container.removeEventListener('scroll', updatePosition);
      }
      window.removeEventListener('resize', updatePosition);
      observer.disconnect();
    };
  }, [imageElement, scrollContainerRef, updatePosition]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const containerWidth = scrollContainerRef.current
      ? scrollContainerRef.current.clientWidth - 40
      : 500;

    isDraggingRef.current = true;
    dragDataRef.current = {
      startX: e.clientX,
      initialWidth: imageElement.getBoundingClientRect().width,
      containerWidth: Math.max(containerWidth, 180),
    };
    void NativeBridge.hapticLightImpact();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const { startX, initialWidth, containerWidth } = dragDataRef.current;
    const deltaX = e.clientX - startX;
    const targetPx = Math.max(60, Math.min(containerWidth, initialWidth + deltaX));
    const targetPercent = Math.min(100, Math.max(15, Math.round((targetPx / containerWidth) * 100)));

    imageElement.style.width = `${targetPercent}%`;
    updatePosition();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }
    const currentStyleWidth = imageElement.style.width || '100%';
    onResize(currentStyleWidth);
    void NativeBridge.hapticLightImpact();
  };

  if (!rect) return null;

  const currentWidthVal = imageElement.style.width || '100%';
  const toolbarTop = rect.top > 48 ? rect.top - 44 : rect.top + 8;
  const toolbarLeft = Math.max(12, rect.left + rect.width / 2);

  return (
    <>
      {/* Moldura de seleção ativa da imagem */}
      <div
        style={{
          top: `${rect.top}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        }}
        className="absolute pointer-events-none rounded-xl ring-2 ring-violet-500 ring-offset-2 ring-offset-zinc-900 transition-all duration-75 z-20"
      />

      {/* Barra de ferramentas rápida flutuante */}
      <div
        style={{
          top: `${toolbarTop}px`,
          left: `${toolbarLeft}px`,
          transform: 'translateX(-50%)',
        }}
        className="absolute z-30 flex items-center gap-1 px-2 py-1 bg-zinc-900/95 border border-zinc-700/80 rounded-xl shadow-2xl backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-100 max-w-[calc(100%-1.5rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5">
          {PRESETS.map((preset) => {
            const isActive = currentWidthVal === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void NativeBridge.hapticLightImpact();
                  imageElement.style.width = preset.value;
                  onResize(preset.value);
                  updatePosition();
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 active:scale-95'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-3.5 bg-zinc-700/80 mx-1 shrink-0" />

        {/* Botão de Tela Cheia / Zoom */}
        {onOpenFullscreen && (
          <button
            type="button"
            aria-label="Ver em tela cheia com zoom"
            title="Tela cheia"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void NativeBridge.hapticLightImpact();
              onOpenFullscreen();
            }}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Botão de Excluir Imagem */}
        <button
          type="button"
          aria-label="Remover imagem"
          title="Remover imagem"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Botão de Desmarcar */}
        <button
          type="button"
          aria-label="Concluir redimensionamento"
          title="Concluir"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 active:scale-95 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Alça de redimensionamento interativo (arraste no canto inferior direito) */}
      <div
        style={{
          top: `${rect.top + rect.height - 12}px`,
          left: `${rect.left + rect.width - 12}px`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Arraste para redimensionar"
        className="absolute z-30 w-6 h-6 -ml-1 -mt-1 bg-violet-600 border-2 border-white rounded-full shadow-lg cursor-nwse-resize active:scale-125 touch-none flex items-center justify-center hover:bg-violet-500 transition-transform select-none"
      >
        <MoveDiagonal className="w-3 h-3 text-white pointer-events-none" />
      </div>
    </>
  );
};
