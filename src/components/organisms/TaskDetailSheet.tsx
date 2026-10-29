import React, { useEffect, useRef, useState } from 'react';
import {
  AlignLeft,
  Bell,
  Check,
  CheckSquare,
  Edit3,
  Eye,
  Image as ImageIcon,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type { RecurrenceMode, TaskPriority, TaskStatus } from '../../db/schema';
import { NativeBridge } from '../../lib/native';
import { getPriorityMeta } from '../../constants/priority';
import { SheetHandle } from '../atoms/SheetHandle';
import {
  CustomDatePicker,
  CustomRecurrencePicker,
  CustomReminderPicker,
  CustomSelect,
  type CustomSelectOption,
} from '../ui/CustomControls';
import {
  compressAndConvertToBase64,
  pickImageFile,
  extractImageFromClipboard,
  extractImagesFromMarkdown,
  combineMarkdownWithImages,
  type TaskImageAttachment,
} from '../../utils/imageUpload';
import { TaskImageGallery } from '../molecules/TaskImageGallery';
import type { UIList, UITask, TaskReminder } from '../../types/task';

interface TaskDetailSheetProps {
  selectedTask: UITask | null;
  onClose: () => void;
  listMap: Record<string, UIList>;
  listSelectOptions: CustomSelectOption<string>[];
  subtasks?: UITask[];
  onUpdateTask: (
    taskId: string,
    updates: Partial<
      Pick<
        UITask,
        | 'title'
        | 'description'
        | 'listId'
        | 'priority'
        | 'dueDate'
        | 'recurrenceRule'
        | 'recurrenceMode'
        | 'reminders'
      >
    >
  ) => Promise<void> | void;
  onToggleStatus: (task: UITask, targetStatus?: TaskStatus) => void;
  onDeleteTask: (task: UITask) => void;
  onAddSubtask?: (parentTask: UITask, title: string) => void;
  onDeleteSubtask?: (subtaskId: string) => void;
}

export const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({
  selectedTask,
  onClose,
  listMap,
  listSelectOptions,
  onUpdateTask,
  onToggleStatus,
  onDeleteTask,
}) => {
  // Rascunho local de edição da tarefa
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [cleanDescription, setCleanDescription] = useState('');
  const [attachedImages, setAttachedImages] = useState<TaskImageAttachment[]>([]);
  const attachedImagesRef = useRef<TaskImageAttachment[]>([]);
  const [draftListId, setDraftListId] = useState('inbox');
  const [draftDueDate, setDraftDueDate] = useState<number | null>(null);
  const [draftRecurrenceRule, setDraftRecurrenceRule] = useState<string | null>(null);
  const [draftRecurrenceMode, setDraftRecurrenceMode] = useState<RecurrenceMode>('fixed');
  const [draftPriority, setDraftPriority] = useState<TaskPriority>(0);
  const [draftReminders, setDraftReminders] = useState<TaskReminder[]>([]);

  // Estados de expansão e visualização da descrição
  const [isExpandedModalOpen, setIsExpandedModalOpen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(() =>
    Boolean(selectedTask?.description && selectedTask.description.trim().length > 0)
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustTitleHeight = () => {
    const el = titleTextareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 40)}px`;
    }
  };

  // Auto-dimensionamento da altura do título em múltiplas linhas
  useEffect(() => {
    adjustTitleHeight();
    const frame = requestAnimationFrame(adjustTitleHeight);
    return () => cancelAnimationFrame(frame);
  }, [draftTitle, selectedTask?.id]);

  // Status de auto-save offline-first
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Refs para manter sempre a versão mais recente em memória para auto-save
  const draftTitleRef = useRef(draftTitle);
  const draftDescriptionRef = useRef(draftDescription);
  const draftListIdRef = useRef(draftListId);
  const draftDueDateRef = useRef(draftDueDate);
  const draftRecurrenceRuleRef = useRef(draftRecurrenceRule);
  const draftRecurrenceModeRef = useRef(draftRecurrenceMode);
  const draftPriorityRef = useRef(draftPriority);
  const draftRemindersRef = useRef(draftReminders);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { draftTitleRef.current = draftTitle; }, [draftTitle]);
  useEffect(() => { draftDescriptionRef.current = draftDescription; }, [draftDescription]);
  useEffect(() => { draftListIdRef.current = draftListId; }, [draftListId]);
  useEffect(() => { draftDueDateRef.current = draftDueDate; }, [draftDueDate]);
  useEffect(() => { draftRecurrenceRuleRef.current = draftRecurrenceRule; }, [draftRecurrenceRule]);
  useEffect(() => { draftRecurrenceModeRef.current = draftRecurrenceMode; }, [draftRecurrenceMode]);
  useEffect(() => { draftPriorityRef.current = draftPriority; }, [draftPriority]);
  useEffect(() => { draftRemindersRef.current = draftReminders; }, [draftReminders]);

  // Executa o salvamento imediato das alterações no banco / estado local
  const flushSave = async (
    overrides?: Partial<{
      title: string;
      description: string;
      listId: string;
      dueDate: number | null;
      recurrenceRule: string | null;
      recurrenceMode: RecurrenceMode;
      priority: TaskPriority;
      reminders: TaskReminder[];
    }>
  ) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (!selectedTask) return;

    const newTitle =
      overrides?.title !== undefined
        ? overrides.title
        : draftTitleRef.current.trim() || selectedTask.title;
    const newDescription =
      overrides?.description !== undefined
        ? overrides.description
        : draftDescriptionRef.current;
    const newListId =
      overrides?.listId !== undefined
        ? overrides.listId
        : draftListIdRef.current;
    const newDueDate =
      overrides?.dueDate !== undefined
        ? overrides.dueDate
        : draftDueDateRef.current;
    const newRecurrenceRule =
      overrides?.recurrenceRule !== undefined
        ? overrides.recurrenceRule
        : draftRecurrenceRuleRef.current;
    const newRecurrenceMode =
      overrides?.recurrenceMode !== undefined
        ? overrides.recurrenceMode
        : draftRecurrenceModeRef.current;
    const newPriority =
      overrides?.priority !== undefined
        ? overrides.priority
        : draftPriorityRef.current;
    const newReminders =
      overrides?.reminders !== undefined
        ? overrides.reminders
        : draftRemindersRef.current;

    const updates = {
      title: newTitle,
      description: newDescription,
      listId: newListId,
      dueDate: newDueDate,
      recurrenceRule: newRecurrenceRule,
      recurrenceMode: newRecurrenceMode,
      priority: newPriority,
      reminders: newReminders,
    };

    const hasAnyChange =
      updates.title !== selectedTask.title ||
      updates.description !== selectedTask.description ||
      updates.listId !== selectedTask.listId ||
      updates.dueDate !== selectedTask.dueDate ||
      updates.recurrenceRule !== selectedTask.recurrenceRule ||
      updates.recurrenceMode !== selectedTask.recurrenceMode ||
      updates.priority !== selectedTask.priority ||
      JSON.stringify(updates.reminders ?? []) !==
        JSON.stringify(selectedTask.reminders ?? []);

    if (!hasAnyChange) return;

    try {
      setSaveStatus('saving');
      await onUpdateTask(selectedTask.id, updates);
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus((curr) => (curr === 'saved' ? 'idle' : curr));
      }, 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  // Agenda salvamento com debounce de 400ms para digitação contínua
  const scheduleDebouncedSave = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSaveStatus('saving');
    debounceTimerRef.current = setTimeout(() => {
      void flushSave();
    }, 400);
  };

  // Salva imediatamente um campo modificado (dropdowns, datas, prioridade, etc.)
  const saveImmediate = (overrides: Partial<Parameters<typeof flushSave>[0]>) => {
    void flushSave(overrides);
  };

  // Inicializa o rascunho quando a tarefa selecionada muda
  const prevTaskIdRef = useRef(selectedTask?.id);
  useEffect(() => {
    if (prevTaskIdRef.current && prevTaskIdRef.current !== selectedTask?.id) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        void flushSave();
      }
    }
    prevTaskIdRef.current = selectedTask?.id;

    if (selectedTask) {
      setDraftTitle(selectedTask.title);
      draftTitleRef.current = selectedTask.title;
      const { cleanText, images } = extractImagesFromMarkdown(
        selectedTask.description || ''
      );
      setCleanDescription(cleanText);
      setAttachedImages(images);
      attachedImagesRef.current = images;
      setDraftDescription(selectedTask.description);
      draftDescriptionRef.current = selectedTask.description;
      setDraftListId(selectedTask.listId);
      draftListIdRef.current = selectedTask.listId;
      setDraftDueDate(selectedTask.dueDate);
      draftDueDateRef.current = selectedTask.dueDate;
      setDraftRecurrenceRule(selectedTask.recurrenceRule);
      draftRecurrenceRuleRef.current = selectedTask.recurrenceRule;
      setDraftRecurrenceMode(selectedTask.recurrenceMode);
      draftRecurrenceModeRef.current = selectedTask.recurrenceMode;
      setDraftPriority(selectedTask.priority);
      draftPriorityRef.current = selectedTask.priority;
      setDraftReminders(selectedTask.reminders ?? []);
      draftRemindersRef.current = selectedTask.reminders ?? [];
      setSaveStatus('idle');
      const hasDescription = Boolean(
        selectedTask.description && selectedTask.description.trim().length > 0
      );
      setIsPreviewMode(hasDescription);
      setIsExpandedModalOpen(false);
    }
  }, [selectedTask?.id]);

  // Garante salvar alterações pendentes ao fechar ou desmontar
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        void flushSave();
      }
    };
  }, []);

  // Fecha o painel garantindo que tudo foi salvo
  const handleClose = () => {
    void flushSave();
    onClose();
  };

  // Atalho de teclado Ctrl+S / Cmd+S para forçar flush imediato
  useEffect(() => {
    if (!selectedTask) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void flushSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTask?.id]);

  if (!selectedTask) return null;

  const handlePriorityChange = (priority: TaskPriority) => {
    void NativeBridge.hapticLightImpact();
    setDraftPriority(priority);
    draftPriorityRef.current = priority;
    saveImmediate({ priority });
  };

  const handleToggleTaskStatus = () => {
    onToggleStatus(
      selectedTask,
      selectedTask.status === 'completed' ? 'pending' : 'completed'
    );
  };

  // Inserção inteligente de listas dentro da descrição
  const insertListPrefix = (
    type: 'todo' | 'bullet' | 'ordered',
    targetRef: React.RefObject<HTMLTextAreaElement | null>
  ) => {
    void NativeBridge.hapticLightImpact();
    const textarea = targetRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    const selectedText = value.slice(selectionStart, selectionEnd);

    if (selectedText.length > 0) {
      const lines = selectedText.split('\n');
      const formattedLines = lines.map((line, idx) => {
        const clean = line.replace(
          /^(\s*[-*]\s*\[[ xX]\]|\s*[-*]|\s*\d+\.)\s*/,
          ''
        );
        if (type === 'todo') return `- [ ] ${clean}`;
        if (type === 'bullet') return `- ${clean}`;
        if (type === 'ordered') return `${idx + 1}. ${clean}`;
        return line;
      });
      const replacement = formattedLines.join('\n');
      const newValue =
        value.slice(0, selectionStart) + replacement + value.slice(selectionEnd);
      syncDescriptionAndImages(newValue, attachedImagesRef.current, true);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = selectionStart;
        textarea.selectionEnd = selectionStart + replacement.length;
      }, 0);
    } else {
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.slice(lineStart, selectionStart);
      const prefix =
        type === 'todo' ? '- [ ] ' : type === 'bullet' ? '- ' : '1. ';

      if (currentLine.trim() === '') {
        const newValue =
          value.slice(0, lineStart) + prefix + value.slice(selectionStart);
        syncDescriptionAndImages(newValue, attachedImagesRef.current, true);
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd =
            lineStart + prefix.length;
        }, 0);
      } else {
        const insertStr = `\n${prefix}`;
        const newValue =
          value.slice(0, selectionStart) +
          insertStr +
          value.slice(selectionEnd);
        syncDescriptionAndImages(newValue, attachedImagesRef.current, true);
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd =
            selectionStart + insertStr.length;
        }, 0);
      }
    }
  };

  // Continuação automática de listas ao pressionar Enter
  const handleDescriptionKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;

      if (selectionStart === selectionEnd) {
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const lineEnd = value.indexOf('\n', selectionStart);
        const currentLine = value.slice(
          lineStart,
          lineEnd === -1 ? value.length : lineEnd
        );

        // 1. Checklist: `- [ ] ` ou `- [x] `
        const todoMatch = currentLine.match(/^(\s*[-*]\s*\[[ xX]\]\s*)(.*)$/);
        if (todoMatch) {
          e.preventDefault();
          const content = todoMatch[2] ?? '';

          // Se a linha estava vazia (apenas o marcador), apaga o marcador (sai da lista)
          if (!content.trim()) {
            const newValue =
              value.slice(0, lineStart) + value.slice(selectionStart);
            syncDescriptionAndImages(newValue, attachedImagesRef.current, false);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = lineStart;
            }, 0);
            return;
          }

          const indentMatch = currentLine.match(/^(\s*)/);
          const indent = indentMatch?.[1] ?? '';
          const newPrefix = `\n${indent}- [ ] `;
          const newValue =
            value.slice(0, selectionStart) +
            newPrefix +
            value.slice(selectionStart);
          syncDescriptionAndImages(newValue, attachedImagesRef.current, false);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd =
              selectionStart + newPrefix.length;
          }, 0);
          return;
        }

        // 2. Lista com marcadores: `- ` ou `* `
        const bulletMatch = currentLine.match(/^(\s*[-*]\s+)(.*)$/);
        if (bulletMatch) {
          e.preventDefault();
          const prefix = bulletMatch[1] ?? '-';
          const content = bulletMatch[2] ?? '';

          if (!content.trim()) {
            const newValue =
              value.slice(0, lineStart) + value.slice(selectionStart);
            syncDescriptionAndImages(newValue, attachedImagesRef.current, false);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = lineStart;
            }, 0);
            return;
          }

          const indentMatch = currentLine.match(/^(\s*)/);
          const indent = indentMatch?.[1] ?? '';
          const bulletChar = prefix.trim()[0] || '-';
          const newPrefix = `\n${indent}${bulletChar} `;
          const newValue =
            value.slice(0, selectionStart) +
            newPrefix +
            value.slice(selectionStart);
          syncDescriptionAndImages(newValue, attachedImagesRef.current, false);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd =
              selectionStart + newPrefix.length;
          }, 0);
          return;
        }

        // 3. Lista numerada: `1. `, `2. `, etc.
        const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (orderedMatch) {
          e.preventDefault();
          const indent = orderedMatch[1] ?? '';
          const num = parseInt(orderedMatch[2] ?? '1', 10);
          const content = orderedMatch[3] ?? '';

          if (!content.trim()) {
            const newValue =
              value.slice(0, lineStart) + value.slice(selectionStart);
            syncDescriptionAndImages(newValue, attachedImagesRef.current, false);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = lineStart;
            }, 0);
            return;
          }

          const newPrefix = `\n${indent}${num + 1}. `;
          const newValue =
            value.slice(0, selectionStart) +
            newPrefix +
            value.slice(selectionStart);
          syncDescriptionAndImages(newValue, attachedImagesRef.current, false);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd =
              selectionStart + newPrefix.length;
          }, 0);
          return;
        }
      }
    }

    // Indentação com Tab
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;
      const insertText = '  ';
      const newValue =
        value.slice(0, selectionStart) + insertText + value.slice(selectionEnd);
      syncDescriptionAndImages(newValue, attachedImagesRef.current, false);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd =
          selectionStart + insertText.length;
      }, 0);
    }
  };

  const syncDescriptionAndImages = (
    newCleanText: string,
    newImages: TaskImageAttachment[] = attachedImagesRef.current,
    immediate = false
  ) => {
    setCleanDescription(newCleanText);
    setAttachedImages(newImages);
    attachedImagesRef.current = newImages;
    const combined = combineMarkdownWithImages(newCleanText, newImages);
    setDraftDescription(combined);
    draftDescriptionRef.current = combined;
    if (immediate) {
      saveImmediate({ description: combined });
    } else {
      scheduleDebouncedSave();
    }
  };

  const handleRemoveImage = (imageId: string) => {
    const nextImages = attachedImages.filter((img) => img.id !== imageId);
    syncDescriptionAndImages(cleanDescription, nextImages, true);
    if (nextImages.length === 0 && cleanDescription.trim().length === 0) {
      setIsPreviewMode(false);
    }
  };

  const handleInsertImage = async () => {
    void NativeBridge.hapticLightImpact();
    const file = await pickImageFile();
    if (!file) return;

    try {
      const base64 = await compressAndConvertToBase64(file);
      const newImage: TaskImageAttachment = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        alt: 'imagem',
        src: base64,
      };
      const nextImages = [...attachedImagesRef.current, newImage];
      syncDescriptionAndImages(cleanDescription, nextImages, true);
      void NativeBridge.hapticLightImpact();
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
    }
  };

  const handleDescriptionPaste = (
    e: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    const imageFile = extractImageFromClipboard(e);
    if (imageFile) {
      e.preventDefault();
      void (async () => {
        try {
          const base64 = await compressAndConvertToBase64(imageFile);
          const newImage: TaskImageAttachment = {
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            alt: 'screenshot',
            src: base64,
          };
          const nextImages = [...attachedImagesRef.current, newImage];
          syncDescriptionAndImages(cleanDescription, nextImages, true);
          void NativeBridge.hapticLightImpact();
        } catch (err) {
          console.error('Erro ao colar imagem:', err);
        }
      })();
    }
  };

  // Alternar checkbox interativo no preview Markdown
  const toggleChecklistLine = (lineIdx: number, currentChecked: boolean) => {
    void NativeBridge.hapticLightImpact();
    const lines = cleanDescription.split('\n');
    if (lines[lineIdx] !== undefined) {
      const targetLine = lines[lineIdx];
      const newChecked = !currentChecked;
      lines[lineIdx] = targetLine.replace(
        /^(\s*[-*]\s*\[)[ xX](\]\s*)/,
        `$1${newChecked ? 'x' : ' '}$2`
      );
      const newCleanText = lines.join('\n');
      syncDescriptionAndImages(newCleanText, attachedImagesRef.current, true);
    }
  };

  // Renderizador nativo de Markdown / Listas para a visualização
  const renderMarkdownPreview = (
    text: string,
    onToggleChecklist?: (lineIndex: number, currentChecked: boolean) => void
  ) => {
    if (!text.trim()) {
      return (
        <p className="text-xs text-zinc-500 italic">
          Nenhuma anotação adicionada ainda. Clique em Editar para escrever.
        </p>
      );
    }

    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 text-xs text-zinc-200 leading-relaxed font-sans">
        {lines.map((line, idx) => {
          // Checklist: `- [ ] ` ou `- [x] `
          const todoMatch = line.match(/^(\s*)[-*]\s*\[([ xX])\]\s*(.*)$/);
          if (todoMatch) {
            const isChecked = (todoMatch[2] ?? '').toLowerCase() === 'x';
            const content = todoMatch[3] ?? '';
            return (
              <div
                key={idx}
                className="flex items-start gap-2 py-0.5 cursor-pointer group"
                onClick={() => onToggleChecklist?.(idx, isChecked)}
              >
                <div
                  className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    isChecked
                      ? 'bg-emerald-500 border-emerald-500 text-zinc-950'
                      : 'border-zinc-600 group-hover:border-indigo-400 bg-zinc-950/80'
                  }`}
                >
                  {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <span
                  className={
                    isChecked
                      ? 'line-through text-zinc-500'
                      : 'text-zinc-200 group-hover:text-zinc-100'
                  }
                >
                  {content || <span className="text-zinc-600">(item vazio)</span>}
                </span>
              </div>
            );
          }

          // Bullet list: `- ` ou `* `
          const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
          if (bulletMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 py-0.5 pl-1">
                <span className="text-indigo-400 select-none font-bold">•</span>
                <span>{bulletMatch[2] ?? ''}</span>
              </div>
            );
          }

          // Numbered list: `1. `, `2. `
          const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
          if (orderedMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 py-0.5 pl-1">
                <span className="text-indigo-400 font-semibold select-none min-w-[1.2rem]">
                  {orderedMatch[2] ?? '1'}.
                </span>
                <span>{orderedMatch[3] ?? ''}</span>
              </div>
            );
          }

          // Imagem Markdown: `![alt](src)`
          const imgMatch = line.trim().match(/^!\[(.*?)\]\((.*?)\)$/);
          if (imgMatch) {
            const alt = imgMatch[1];
            const src = imgMatch[2];
            return (
              <div key={idx} className="my-2 text-center">
                <img
                  src={src}
                  alt={alt}
                  loading="lazy"
                  className="rounded-xl max-w-full max-h-80 mx-auto object-contain border border-zinc-800 shadow-md bg-zinc-950/60"
                />
                {alt && alt !== 'imagem' && alt !== 'screenshot' && (
                  <p className="text-[10px] text-zinc-500 mt-0.5 italic">{alt}</p>
                )}
              </div>
            );
          }

          // Linha em branco
          if (!line.trim()) {
            return <div key={idx} className="h-2" />;
          }

          // Texto regular
          return (
            <p key={idx} className="py-0.5">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div
        className="absolute inset-0 z-40 md:static md:inset-auto md:z-auto flex items-end md:items-stretch bg-black/60 md:bg-transparent backdrop-blur-xs md:backdrop-blur-none pt-[calc(var(--safe-top,0px)+0.75rem)] md:pt-0"
        onClick={handleClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full md:w-[410px] max-h-[calc(100%-var(--safe-top,0px)-0.75rem)] md:max-h-none bg-zinc-900 md:border-l border-t md:border-t-0 border-zinc-800 rounded-t-3xl md:rounded-none flex flex-col overflow-hidden shadow-2xl"
        >
          <SheetHandle />

          {/* Header do Detalhe */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400">
                {listMap[draftListId]?.name ?? 'Inbox'}
              </span>
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-indigo-400" />
                  <span className="hidden sm:inline">Salvando...</span>
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400/80">
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="hidden sm:inline">Salvo</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Botão Concluir Tarefa */}
              <button
                type="button"
                onClick={handleToggleTaskStatus}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border transition-colors ${
                  selectedTask.status === 'completed'
                    ? 'bg-emerald-600/25 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/35'
                    : 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60 hover:text-emerald-400 hover:border-emerald-500/30'
                }`}
              >
                <Check className="w-3 h-3 stroke-[2.5]" />
                <span>{selectedTask.status === 'completed' ? 'Concluída' : 'Concluir'}</span>
              </button>

              {/* Botão Excluir Tarefa */}
              <button
                type="button"
                aria-label="Excluir tarefa"
                onClick={() => {
                  void NativeBridge.hapticLightImpact();
                  onDeleteTask(selectedTask);
                }}
                className="p-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/70 text-zinc-400 hover:text-red-400 hover:bg-red-500/15 hover:border-red-500/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                aria-label="Fechar detalhes"
                onClick={handleClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Corpo do Detalhe com Scroll Nativo */}
          <div className="flex-1 native-scroll-container p-4 space-y-4 pb-[max(2rem,calc(var(--safe-bottom,0px)+1.5rem))]">
            {/* Título Editável + Notas */}
            <div>
              <textarea
                ref={(el) => {
                  titleTextareaRef.current = el;
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = `${Math.max(el.scrollHeight, 40)}px`;
                  }
                }}
                rows={1}
                value={draftTitle}
                onInput={(e) => {
                  const target = e.currentTarget;
                  target.style.height = 'auto';
                  target.style.height = `${Math.max(target.scrollHeight, 40)}px`;
                }}
                onChange={(e) => {
                  setDraftTitle(e.target.value);
                  draftTitleRef.current = e.target.value;
                  scheduleDebouncedSave();
                }}
                onBlur={() => void flushSave()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void flushSave();
                    (e.target as HTMLElement).blur();
                  }
                }}
                placeholder="Título da tarefa..."
                style={{ fieldSizing: 'content' } as React.CSSProperties}
                className="w-full bg-transparent text-lg md:text-xl font-bold text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 rounded-lg px-2 py-1.5 -mx-2 resize-none break-words whitespace-pre-wrap overflow-y-auto max-h-[35vh] min-h-[40px] leading-snug"
              />
              <div className="mt-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <AlignLeft className="w-3 h-3 text-zinc-400" />
                    <span>Descrição / Notas</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Alternar Visualizar / Editar */}
                    {draftDescription.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsPreviewMode((v) => !v)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 transition-colors ${
                          isPreviewMode
                            ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                            : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                        }`}
                        title={isPreviewMode ? 'Editar Markdown' : 'Visualizar formatado'}
                      >
                        {isPreviewMode ? <Edit3 className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                        <span>{isPreviewMode ? 'Editar' : 'Ver'}</span>
                      </button>
                    )}

                    {/* Expandir em Tela Cheia / Modal focado */}
                    <button
                      type="button"
                      onClick={() => {
                        void NativeBridge.hapticLightImpact();
                        setIsExpandedModalOpen(true);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 transition-colors"
                      title="Expandir editor em tela cheia"
                    >
                      <Maximize2 className="w-2.5 h-2.5" />
                      <span>Expandir</span>
                    </button>
                  </div>
                </div>

                {/* Barra de Ferramentas de Criação de Listas (apenas no modo de edição) */}
                {!isPreviewMode && (
                  <div className="flex items-center gap-1 mb-1.5 p-1 rounded-lg bg-zinc-950/40 border border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => insertListPrefix('todo', textareaRef)}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/50 flex items-center gap-1.5 transition-colors"
                      title="Inserir Checklist (- [ ])"
                    >
                      <CheckSquare className="w-3 h-3 text-emerald-400" />
                      <span>Checklist</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => insertListPrefix('bullet', textareaRef)}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/50 flex items-center gap-1.5 transition-colors"
                      title="Inserir Marcador (- )"
                    >
                      <List className="w-3 h-3 text-indigo-400" />
                      <span>Marcadores</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => insertListPrefix('ordered', textareaRef)}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/50 flex items-center gap-1.5 transition-colors"
                      title="Inserir Lista Numerada (1. )"
                    >
                      <ListOrdered className="w-3 h-3 text-amber-400" />
                      <span>Numerada</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleInsertImage()}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/50 flex items-center gap-1.5 transition-colors"
                      title="Inserir Imagem (WebP comprimido)"
                    >
                      <ImageIcon className="w-3 h-3 text-sky-400" />
                      <span>Imagem</span>
                    </button>
                  </div>
                )}

                {/* Área de Texto ou Pré-visualização com Listas */}
                {isPreviewMode ? (
                  (cleanDescription.trim().length > 0 || attachedImages.length === 0) && (
                    <div
                      onDoubleClick={() => setIsPreviewMode(false)}
                      title="Duplo clique para editar"
                      className="w-full bg-zinc-950/70 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 overflow-y-auto cursor-pointer min-h-[60px] max-h-[220px]"
                    >
                      {renderMarkdownPreview(cleanDescription, toggleChecklistLine)}
                    </div>
                  )
                ) : (
                  <textarea
                    ref={textareaRef}
                    rows={4}
                    value={cleanDescription}
                    onChange={(e) => {
                      const { cleanText, images } = extractImagesFromMarkdown(e.target.value);
                      if (images.length > 0) {
                        syncDescriptionAndImages(cleanText, [...attachedImages, ...images], false);
                      } else {
                        syncDescriptionAndImages(e.target.value, attachedImages, false);
                      }
                    }}
                    onBlur={() => void flushSave()}
                    onKeyDown={handleDescriptionKeyDown}
                    onPaste={handleDescriptionPaste}
                    placeholder="Notas em Markdown, listas (- item, 1. item) ou checklist (- [ ] item)..."
                    className="w-full bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed transition-all resize-y"
                  />
                )}

                {/* Galeria de Imagens & Anexos (estável e única) */}
                <TaskImageGallery
                  images={attachedImages}
                  onRemoveImage={handleRemoveImage}
                />
              </div>
            </div>

            {/* Lista / Destino GTD usando CustomSelect */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Lista / Destino GTD
              </label>
              <CustomSelect<string>
                value={draftListId}
                options={listSelectOptions}
                onChange={(nextListId) => {
                  setDraftListId(nextListId);
                  draftListIdRef.current = nextListId;
                  saveImmediate({ listId: nextListId });
                }}
              />
            </div>

            {/* Data de Vencimento / Evento usando CustomDatePicker */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Data Agendada / Calendário
              </label>
              <CustomDatePicker
                value={draftDueDate}
                onChange={(nextDueDate) => {
                  setDraftDueDate(nextDueDate);
                  draftDueDateRef.current = nextDueDate;
                  saveImmediate({ dueDate: nextDueDate });
                }}
              />
            </div>

            {/* Repetições usando CustomRecurrencePicker */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Repetição & Recorrência
              </label>
              <CustomRecurrencePicker
                recurrenceRule={draftRecurrenceRule}
                recurrenceMode={draftRecurrenceMode}
                onChange={({ recurrenceRule, recurrenceMode }) => {
                  setDraftRecurrenceRule(recurrenceRule);
                  draftRecurrenceRuleRef.current = recurrenceRule;
                  setDraftRecurrenceMode(recurrenceMode);
                  draftRecurrenceModeRef.current = recurrenceMode;
                  let newDue = draftDueDate;
                  if (recurrenceRule && draftDueDate === null) {
                    newDue = Date.now();
                    setDraftDueDate(newDue);
                    draftDueDateRef.current = newDue;
                  }
                  saveImmediate({
                    recurrenceRule,
                    recurrenceMode,
                    dueDate: newDue,
                  });
                }}
              />
            </div>

            {/* Lembretes com Antecedência usando CustomReminderPicker */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                Lembretes & Notificações
              </label>
              <CustomReminderPicker
                dueDate={draftDueDate}
                reminders={draftReminders}
                onChange={(nextReminders) => {
                  setDraftReminders(nextReminders);
                  draftRemindersRef.current = nextReminders;
                  if (draftDueDateRef.current === null) {
                    const now = Date.now();
                    setDraftDueDate(now);
                    draftDueDateRef.current = now;
                    saveImmediate({ dueDate: now, reminders: nextReminders });
                  } else {
                    saveImmediate({ reminders: nextReminders });
                  }
                }}
                onSetDueDateDefault={() => {
                  const now = Date.now();
                  setDraftDueDate(now);
                  draftDueDateRef.current = now;
                  saveImmediate({ dueDate: now });
                }}
              />
            </div>

            {/* Seletor de Prioridade com Haptics */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Prioridade (TickTick Color)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {([0, 1, 2, 3] as TaskPriority[]).map((p) => {
                  const meta = getPriorityMeta(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePriorityChange(p)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                        draftPriority === p
                          ? meta.badgeClass
                          : 'border-zinc-800 bg-zinc-950/50 text-zinc-400'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
        </div>
      </div>
    </div>

    {/* =========================================================================
        MODAL EXPANDIDO DE DESCRIÇÃO / NOTAS EM TELA CHEIA
        ========================================================================= */}
    {isExpandedModalOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm pt-[calc(var(--safe-top,0px)+0.75rem)] pb-[calc(var(--safe-bottom,0px)+0.75rem)]"
        onClick={() => setIsExpandedModalOpen(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl h-[85vh] max-h-[calc(100%-var(--safe-top,0px)-1.5rem)] bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Header do Editor Expandido */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlignLeft className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-sm font-bold text-zinc-100 truncate">
                Notas & Descrição — {draftTitle || selectedTask.title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Alternar Visualização / Edição Markdown */}
              <button
                type="button"
                onClick={() => setIsPreviewMode((prev) => !prev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                  isPreviewMode
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60 hover:text-white'
                }`}
              >
                {isPreviewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{isPreviewMode ? 'Editar' : 'Visualizar'}</span>
              </button>

              <button
                type="button"
                aria-label="Minimizar editor"
                onClick={() => setIsExpandedModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barra de Ferramentas com Criadores de Listas (apenas em modo de edição) */}
          {!isPreviewMode && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/80 bg-zinc-950/40 gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => insertListPrefix('todo', expandedTextareaRef)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/50 flex items-center gap-1.5 transition-colors"
                  title="Adicionar Checklist (- [ ])"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Checklist</span>
                </button>

                <button
                  type="button"
                  onClick={() => insertListPrefix('bullet', expandedTextareaRef)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/50 flex items-center gap-1.5 transition-colors"
                  title="Lista com marcadores (- )"
                >
                  <List className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Marcadores</span>
                </button>

                <button
                  type="button"
                  onClick={() => insertListPrefix('ordered', expandedTextareaRef)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/50 flex items-center gap-1.5 transition-colors"
                  title="Lista numerada (1. )"
                >
                  <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
                  <span>Numerada</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleInsertImage()}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/50 flex items-center gap-1.5 transition-colors"
                  title="Inserir Imagem (WebP comprimido)"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>Imagem</span>
                </button>
              </div>

              <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">
                {cleanDescription.split('\n').filter(Boolean).length} linhas
              </span>
            </div>
          )}

          {/* Corpo do Editor Expandido: Edição vs Pré-visualização */}
          <div className="flex-1 p-5 overflow-y-auto native-scroll-container bg-zinc-950/20 flex flex-col">
            {isPreviewMode ? (
              (cleanDescription.trim().length > 0 || attachedImages.length === 0) && (
                <div
                  onDoubleClick={() => setIsPreviewMode(false)}
                  title="Duplo clique para editar"
                  className="max-w-none text-zinc-200 cursor-pointer flex-1"
                >
                  {renderMarkdownPreview(cleanDescription, toggleChecklistLine)}
                </div>
              )
            ) : (
              <textarea
                ref={expandedTextareaRef}
                value={cleanDescription}
                onChange={(e) => {
                  const { cleanText, images } = extractImagesFromMarkdown(e.target.value);
                  if (images.length > 0) {
                    syncDescriptionAndImages(cleanText, [...attachedImages, ...images], false);
                  } else {
                    syncDescriptionAndImages(e.target.value, attachedImages, false);
                  }
                }}
                onBlur={() => void flushSave()}
                onKeyDown={handleDescriptionKeyDown}
                onPaste={handleDescriptionPaste}
                placeholder="Digite notas em Markdown, tarefas com checklist (- [ ]), links e listas..."
                className="w-full flex-1 min-h-[220px] bg-transparent text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none font-mono leading-relaxed"
              />
            )}

            {/* Galeria de Imagens e Anexos (estável e fora do duplo clique) */}
            <TaskImageGallery
              images={attachedImages}
              onRemoveImage={handleRemoveImage}
            />
          </div>

          {/* Rodapé do Editor Expandido */}
          <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between">
            <span className="text-xs text-zinc-500 hidden sm:inline">
              Dica: <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 border border-zinc-700">Enter</kbd> continua a lista • <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 border border-zinc-700">Tab</kbd> indenta
            </span>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={() => {
                  void flushSave();
                  setIsExpandedModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Concluir</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
};
