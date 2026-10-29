import React, { useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  List,
  ListOrdered,
  Quote,
  Code,
  FileCode,
  Minus,
  Image as ImageIcon,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'highlight'
  | 'code'
  | 'codeblock'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'checklist'
  | 'bullet'
  | 'number'
  | 'quote'
  | 'image'
  | 'divider';

interface NoteFormattingToolbarProps {
  onAction: (action: FormatAction) => void;
  onImageSelect?: (file: File) => void;
}

interface ToolbarGroup {
  id: string;
  items: { action: FormatAction; icon: React.ElementType; label: string }[];
}

const TOOLBAR_GROUPS: ToolbarGroup[] = [
  {
    id: 'headings',
    items: [
      { action: 'h1', icon: Heading1, label: 'Título 1' },
      { action: 'h2', icon: Heading2, label: 'Título 2' },
      { action: 'h3', icon: Heading3, label: 'Título 3' },
    ],
  },
  {
    id: 'styling',
    items: [
      { action: 'bold', icon: Bold, label: 'Negrito' },
      { action: 'italic', icon: Italic, label: 'Itálico' },
      { action: 'strike', icon: Strikethrough, label: 'Tachado' },
      { action: 'highlight', icon: Highlighter, label: 'Destaque' },
    ],
  },
  {
    id: 'lists',
    items: [
      { action: 'checklist', icon: CheckSquare, label: 'Lista de Tarefas' },
      { action: 'bullet', icon: List, label: 'Marcadores' },
      { action: 'number', icon: ListOrdered, label: 'Numeração' },
      { action: 'quote', icon: Quote, label: 'Citação' },
    ],
  },
  {
    id: 'inserts',
    items: [
      { action: 'image', icon: ImageIcon, label: 'Inserir Imagem' },
      { action: 'code', icon: Code, label: 'Código em Linha' },
      { action: 'codeblock', icon: FileCode, label: 'Bloco de Código' },
      { action: 'divider', icon: Minus, label: 'Linha Divisória' },
    ],
  },
];

export const NoteFormattingToolbar: React.FC<NoteFormattingToolbarProps> = ({
  onAction,
  onImageSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartLeftRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    };
  }, []);

  const handleScroll = () => {
    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Permite rolar lateralmente com a roda tradicional do mouse
    if (e.deltaX === 0 && e.deltaY !== 0 && containerRef.current) {
      containerRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isPointerDownRef.current = true;
    isDraggingRef.current = false;
    startXRef.current = e.clientX;
    if (containerRef.current) {
      scrollStartLeftRef.current = containerRef.current.scrollLeft;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    if (Math.abs(deltaX) > 4) {
      isDraggingRef.current = true;
      if (containerRef.current) {
        containerRef.current.scrollLeft = scrollStartLeftRef.current - deltaX;
      }
    }
  };

  const handleMouseUpOrLeave = () => {
    isPointerDownRef.current = false;
    if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    dragTimeoutRef.current = setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    const firstTouch = e.touches[0];
    if (firstTouch) {
      startXRef.current = firstTouch.clientX;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const firstTouch = e.touches[0];
    if (firstTouch) {
      const deltaX = firstTouch.clientX - startXRef.current;
      if (Math.abs(deltaX) > 6) {
        isDraggingRef.current = true;
      }
    }
  };

  const handleTouchEnd = () => {
    if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    dragTimeoutRef.current = setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  const handleButtonClick = (action: FormatAction) => {
    // Ignora o clique se o usuário estava rolando ou arrastando a barra
    if (isDraggingRef.current || isScrollingRef.current) {
      return;
    }
    void NativeBridge.hapticLightImpact();
    if (action === 'image' && onImageSelect) {
      fileInputRef.current?.click();
    } else {
      onAction(action);
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="flex items-center gap-1 overflow-x-auto py-1 px-3 bg-zinc-950/70 border-y border-zinc-800/60 native-scroll-x shrink-0 select-none w-full"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (onImageSelect) {
              onImageSelect(file);
            } else {
              onAction('image');
            }
          }
          e.target.value = '';
        }}
      />
      {TOOLBAR_GROUPS.map((group, groupIndex) => (
        <React.Fragment key={group.id}>
          {groupIndex > 0 && (
            <div className="w-px h-4 bg-zinc-800/80 mx-1 shrink-0" aria-hidden="true" />
          )}
          {group.items.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.action}
                type="button"
                aria-label={btn.label}
                title={btn.label}
                onMouseDown={(e) => {
                  // Previne perda de foco/seleção do editor no desktop
                  e.preventDefault();
                }}
                onClick={() => handleButtonClick(btn.action)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <Icon className="w-3.5 h-3.5 pointer-events-none" />
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};
