import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import { NativeBridge } from '../../lib/native';

interface NotePreviewImageButtonsProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onOpenFullscreen: (src: string, alt: string) => void;
}

interface ImageButtonPosition {
  id: string;
  src: string;
  alt: string;
  top: number;
  left: number;
}

export const NotePreviewImageButtons: React.FC<NotePreviewImageButtonsProps> = ({
  editorRef,
  scrollContainerRef,
  onOpenFullscreen,
}) => {
  const [positions, setPositions] = useState<ImageButtonPosition[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const calculatePositions = useCallback(() => {
    if (!editorRef.current || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const images = Array.from(editorRef.current.querySelectorAll('img'));

    const nextPositions: ImageButtonPosition[] = [];

    images.forEach((img, idx) => {
      const imgRect = img.getBoundingClientRect();
      if (imgRect.width === 0 || imgRect.height === 0) return;

      // 8px a partir do topo da imagem e 8px a partir da margem direita da imagem
      const top = imgRect.top - containerRect.top + container.scrollTop + 8;
      const left = imgRect.left - containerRect.left + container.scrollLeft + imgRect.width - 36;

      nextPositions.push({
        id: `img-expand-${idx}-${img.src.slice(-16)}`,
        src: img.src,
        alt: img.alt || 'Imagem da anotação',
        top,
        left,
      });
    });

    setPositions(nextPositions);
  }, [editorRef, scrollContainerRef]);

  useEffect(() => {
    calculatePositions();

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', calculatePositions, { passive: true });
    }
    window.addEventListener('resize', calculatePositions);

    // Observa mudanças nas dimensões das imagens
    if (editorRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        calculatePositions();
      });

      const images = editorRef.current.querySelectorAll('img');
      images.forEach((img) => {
        resizeObserverRef.current?.observe(img);
        if (!img.complete) {
          img.addEventListener('load', calculatePositions, { once: true });
        }
      });
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', calculatePositions);
      }
      window.removeEventListener('resize', calculatePositions);
      resizeObserverRef.current?.disconnect();
    };
  }, [editorRef, scrollContainerRef, calculatePositions]);

  if (positions.length === 0) return null;

  return (
    <>
      {positions.map((btn) => (
        <button
          key={btn.id}
          type="button"
          aria-label="Ver em tela cheia"
          title="Ver imagem em tela cheia"
          style={{
            top: `${btn.top}px`,
            left: `${btn.left}px`,
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void NativeBridge.hapticLightImpact();
            onOpenFullscreen(btn.src, btn.alt);
          }}
          className="absolute z-20 w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950/85 hover:bg-violet-600 text-zinc-300 hover:text-white border border-zinc-700/80 shadow-lg backdrop-blur-xs transition-all active:scale-90 hover:scale-105 cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />
        </button>
      ))}
    </>
  );
};
