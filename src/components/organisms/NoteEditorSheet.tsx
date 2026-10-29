import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Edit3,
  Pin,
  Trash2,
  X,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { SheetHandle } from '../atoms/SheetHandle';
import { NoteFolderBadge } from '../atoms/NoteFolderBadge';
import {
  NoteFormattingToolbar,
  type FormatAction,
} from '../molecules/NoteFormattingToolbar';
import {
  markdownToHtml,
  htmlToPlainText,
  createChecklistRowHtml,
  normalizeChecklistHtml,
} from '../../utils/markdownConverter';
import type { UINote, UINoteFolder } from '../../types/note';

interface NoteEditorSheetProps {
  note: UINote | null;
  isOpen: boolean;
  folders: UINoteFolder[];
  onClose: () => void;
  onUpdateNote: (
    noteId: string,
    updates: Partial<Pick<UINote, 'title' | 'content' | 'folderId' | 'isPinned'>>
  ) => void;
  onDeleteNote: (note: UINote) => void;
}

export const NoteEditorSheet: React.FC<NoteEditorSheetProps> = ({
  note,
  isOpen,
  folders,
  onClose,
  onUpdateNote,
  onDeleteNote,
}) => {
  const [title, setTitle] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');
  const [rawHtml, setRawHtml] = useState('');

  const editorRef = useRef<HTMLDivElement | null>(null);
  const isInternalTypingRef = useRef(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setIsPinned(note.isPinned);
      setPreviewMode('edit');

      const initialHtml = normalizeChecklistHtml(markdownToHtml(note.content));
      setRawHtml(initialHtml);

      if (editorRef.current && !isInternalTypingRef.current) {
        editorRef.current.innerHTML = initialHtml;
      }
    }
  }, [note?.id]);

  if (!isOpen || !note) return null;

  const currentFolder = note.folderId
    ? folders.find((f) => f.id === note.folderId) ?? null
    : null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    onUpdateNote(note.id, { title: val });
  };

  const handleTogglePin = () => {
    const nextPin = !isPinned;
    setIsPinned(nextPin);
    void NativeBridge.hapticLightImpact();
    onUpdateNote(note.id, { isPinned: nextPin });
  };

  const handleContentSync = () => {
    if (!editorRef.current) return;
    isInternalTypingRef.current = true;
    const html = editorRef.current.innerHTML;
    setRawHtml(html);
    onUpdateNote(note.id, { content: html });

    setTimeout(() => {
      isInternalTypingRef.current = false;
    }, 100);
  };

  const handleFormatAction = (action: FormatAction) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    switch (action) {
      case 'bold':
        document.execCommand('bold', false);
        break;
      case 'italic':
        document.execCommand('italic', false);
        break;
      case 'strike':
        document.execCommand('strikeThrough', false);
        break;
      case 'highlight':
        document.execCommand('hiliteColor', false, 'rgba(251, 191, 36, 0.25)');
        break;
      case 'h1':
        document.execCommand('formatBlock', false, '<h1>');
        break;
      case 'h2':
        document.execCommand('formatBlock', false, '<h2>');
        break;
      case 'h3':
        document.execCommand('formatBlock', false, '<h3>');
        break;
      case 'bullet':
        document.execCommand('insertUnorderedList', false);
        break;
      case 'number':
        document.execCommand('insertOrderedList', false);
        break;
      case 'quote':
        document.execCommand('formatBlock', false, '<blockquote>');
        break;
      case 'codeblock':
        document.execCommand('formatBlock', false, '<pre>');
        break;
      case 'divider':
        document.execCommand('insertHorizontalRule', false);
        break;
      case 'checklist': {
        const sel = window.getSelection();
        let existingText = '';
        let targetBlock: HTMLElement | null = null;

        if (sel && sel.rangeCount > 0) {
          const anchor = sel.anchorNode;
          const parentEl = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
          targetBlock = parentEl?.closest('p, div, h1, h2, h3, li') as HTMLElement | null;
          if (
            targetBlock &&
            editorRef.current?.contains(targetBlock) &&
            !targetBlock.closest('[data-checklist-row="true"]')
          ) {
            existingText = targetBlock.textContent?.trim() || '';
          }
        }

        const itemHtml = createChecklistRowHtml(existingText, false);

        if (targetBlock && targetBlock !== editorRef.current && targetBlock.parentNode) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = itemHtml;
          const newRow = tempDiv.firstElementChild as HTMLElement;
          if (newRow) {
            targetBlock.parentNode.replaceChild(newRow, targetBlock);
            const textSpan = newRow.querySelector('[data-checklist-text="true"]');
            if (textSpan) {
              const newRange = document.createRange();
              newRange.selectNodeContents(textSpan);
              newRange.collapse(false);
              sel?.removeAllRanges();
              sel?.addRange(newRange);
            }
          }
        } else {
          document.execCommand('insertHTML', false, itemHtml);
        }
        break;
      }
      case 'code': {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const text = sel.toString();
          document.execCommand('insertHTML', false, `<code>${text || 'código'}</code>`);
        }
        break;
      }
    }

    handleContentSync();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (previewMode !== 'edit') return;

    if (e.key === 'Enter' && !e.shiftKey) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      const anchor = sel.anchorNode;
      const parentEl = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
      const checklistRow = parentEl?.closest('[data-checklist-row="true"]') as HTMLElement | null;

      if (checklistRow) {
        e.preventDefault();
        e.stopPropagation();

        const checklistText = checklistRow.querySelector('[data-checklist-text="true"]') as HTMLElement | null;
        const fullText = checklistText?.textContent?.replace(/\u200B/g, '').trim() || '';

        // Se o item estiver vazio: converte a linha em parágrafo normal para sair suavemente do modo checklist
        if (!fullText) {
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          checklistRow.parentNode?.replaceChild(p, checklistRow);

          const newRange = document.createRange();
          newRange.setStart(p, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);

          handleContentSync();
          return;
        }

        // Se tiver texto: divide na posição do cursor
        let textBefore = '';
        let textAfter = '';

        if (checklistText) {
          try {
            const preRange = range.cloneRange();
            preRange.selectNodeContents(checklistText);
            preRange.setEnd(range.startContainer, range.startOffset);
            const caretPos = preRange.toString().length;

            const originalText = checklistText.innerText || checklistText.textContent || '';
            textBefore = originalText.slice(0, caretPos);
            textAfter = originalText.slice(caretPos);

            checklistText.textContent = textBefore || '';
            if (!checklistText.textContent) {
              checklistText.innerHTML = '<br>';
            }
          } catch {
            textBefore = checklistText.textContent || '';
            textAfter = '';
          }
        }

        // Cria o próximo item de checklist desmarcado
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = createChecklistRowHtml(textAfter, false);
        const newRow = tempDiv.firstElementChild as HTMLElement;

        if (newRow) {
          if (checklistRow.nextSibling) {
            checklistRow.parentNode?.insertBefore(newRow, checklistRow.nextSibling);
          } else {
            checklistRow.parentNode?.appendChild(newRow);
          }

          const newTextSpan = newRow.querySelector('[data-checklist-text="true"]');
          if (newTextSpan) {
            const newRange = document.createRange();
            newRange.selectNodeContents(newTextSpan);
            newRange.collapse(false);
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
        }

        handleContentSync();
        return;
      }
    }

    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      const anchor = sel.anchorNode;
      const parentEl = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
      const checklistRow = parentEl?.closest('[data-checklist-row="true"]') as HTMLElement | null;

      if (checklistRow) {
        const checklistText = checklistRow.querySelector('[data-checklist-text="true"]') as HTMLElement | null;
        const currentText = checklistText?.textContent?.replace(/\u200B/g, '').trim() || '';

        // Se o checklist está vazio e o usuário aperta backspace: converte para parágrafo normal
        if (!currentText) {
          e.preventDefault();
          e.stopPropagation();

          const p = document.createElement('p');
          p.innerHTML = '<br>';
          checklistRow.parentNode?.replaceChild(p, checklistRow);

          const newRange = document.createRange();
          newRange.setStart(p, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);

          handleContentSync();
          return;
        }

        // Se o cursor estiver no início absoluto do texto: converte em parágrafo preservando o texto
        if (checklistText && range.collapsed) {
          try {
            const preRange = range.cloneRange();
            preRange.selectNodeContents(checklistText);
            preRange.setEnd(range.startContainer, range.startOffset);
            if (preRange.toString().length === 0) {
              e.preventDefault();
              e.stopPropagation();

              const p = document.createElement('p');
              p.textContent = checklistText.textContent || '';
              if (!p.textContent) p.innerHTML = '<br>';
              checklistRow.parentNode?.replaceChild(p, checklistRow);

              const newRange = document.createRange();
              newRange.setStart(p.firstChild || p, 0);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);

              handleContentSync();
              return;
            }
          } catch {
            // fallback silencioso
          }
        }
      }
    }
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const toggleBtn = target.closest('[data-checklist-toggle]');
    if (toggleBtn) {
      e.preventDefault();
      e.stopPropagation();
      void NativeBridge.hapticLightImpact();
      const row = toggleBtn.closest('[data-checklist-row]') as HTMLElement;
      if (row) {
        const isChecked = row.getAttribute('data-checked') === 'true';
        const nextChecked = !isChecked;
        row.setAttribute('data-checked', String(nextChecked));

        // Assegura classe nativa moderna e ícone SVG caso seja legado
        if (!toggleBtn.classList.contains('checklist-toggle')) {
          toggleBtn.className = 'checklist-toggle';
        }
        if (!toggleBtn.querySelector('.checklist-icon')) {
          toggleBtn.innerHTML =
            '<svg class="checklist-icon" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }

        handleContentSync();
      }
    } else if (e.target === e.currentTarget && editorRef.current) {
      editorRef.current.focus();
    }
  };

  const plainText = htmlToPlainText(rawHtml || note.content);
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const charCount = plainText.length;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-black/75 backdrop-blur-xs p-0 pt-[calc(var(--safe-top,0px)+0.5rem)] md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom:
            'max(0.75rem, calc(var(--safe-bottom, 0px) - var(--keyboard-height, 0px)))',
        }}
        className="w-full max-w-2xl h-full max-h-[calc(100%-0.25rem)] md:h-[85vh] md:max-h-[85vh] flex flex-col bg-zinc-900 border-t md:border border-zinc-800 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="shrink-0">
          <SheetHandle />
        </div>

        {/* Barra superior de ações */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-950/40 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={isPinned ? 'Desafixar anotação' : 'Fixar anotação'}
              onClick={handleTogglePin}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isPinned
                  ? 'text-amber-400 bg-amber-400/10 border border-amber-400/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Pin className="w-4 h-4" />
              <span className="text-[11px] hidden sm:inline">
                {isPinned ? 'Fixada' : 'Fixar'}
              </span>
            </button>

            <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setPreviewMode('edit');
                  setTimeout(() => editorRef.current?.focus(), 50);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  previewMode === 'edit'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Edit3 className="w-3 h-3" />
                <span>Editor</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('preview')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  previewMode === 'preview'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>Leitura</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Excluir anotação"
              onClick={() => onDeleteNote(note)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pasta atual & metadados */}
        <div className="px-5 pt-3 pb-1 flex items-center justify-between gap-3 shrink-0">
          {currentFolder ? (
            <NoteFolderBadge
              name={currentFolder.name}
              color={currentFolder.color}
              size="sm"
            />
          ) : (
            <span className="text-[11px] text-zinc-500 font-medium italic">
              Sem pasta (Geral)
            </span>
          )}
          <div className="text-[11px] text-zinc-500 font-medium">
            {wordCount} palavras • {charCount} carac.
          </div>
        </div>

        {/* Título da Nota */}
        <div className="px-5 pt-1 pb-2 shrink-0">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Título da anotação..."
            className="w-full bg-transparent text-lg md:text-xl font-bold text-zinc-100 placeholder-zinc-600 focus:outline-none tracking-tight"
          />
        </div>

        {/* Barra de Formatação WYSIWYG (Exibida no modo Editor) */}
        {previewMode === 'edit' && (
          <NoteFormattingToolbar onAction={handleFormatAction} />
        )}

        {/* Editor WYSIWYG / Leitura Direta (sem código cru) */}
        <div
          className="flex-1 min-h-0 px-5 py-3 overflow-y-auto native-scroll-container"
          onClick={handleEditorClick}
        >
          <div
            ref={editorRef}
            contentEditable={previewMode === 'edit'}
            suppressContentEditableWarning
            onInput={handleContentSync}
            onKeyDown={handleKeyDown}
            data-placeholder="Digite sua anotação aqui... Use a barra acima para formatar (títulos, negrito, itálico, listas, tarefas)."
            className={`wysiwyg-content min-h-[320px] pb-10 ${
              previewMode === 'preview' ? 'cursor-default select-text' : 'cursor-text'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
