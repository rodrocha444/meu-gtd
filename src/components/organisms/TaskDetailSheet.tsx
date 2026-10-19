import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Edit3,
  Eye,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Pin,
  RefreshCw,
  Save,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { RecurrenceMode, TaskPriority, TaskStatus } from '../../db/schema';
import { NativeBridge } from '../../lib/native';
import {
  getPriorityMeta,
  GTD_CONTEXT_SUGGESTIONS,
} from '../../constants/priority';
import { SheetHandle } from '../atoms/SheetHandle';
import { SubtaskItem } from '../molecules/SubtaskItem';
import {
  CustomDatePicker,
  CustomRecurrencePicker,
  CustomSelect,
  type CustomSelectOption,
} from '../ui/CustomControls';
import type { UIList, UITask } from '../../types/task';

interface TaskDetailSheetProps {
  selectedTask: UITask | null;
  onClose: () => void;
  listMap: Record<string, UIList>;
  listSelectOptions: CustomSelectOption<string>[];
  subtasks: UITask[];
  onUpdateTask: (
    taskId: string,
    updates: Partial<
      Pick<
        UITask,
        | 'title'
        | 'description'
        | 'listId'
        | 'priority'
        | 'tags'
        | 'dueDate'
        | 'recurrenceRule'
        | 'recurrenceMode'
        | 'isPinned'
      >
    >
  ) => Promise<void> | void;
  onToggleStatus: (task: UITask, targetStatus?: TaskStatus) => void;
  onDeleteTask: (task: UITask) => void;
  onAddSubtask: (parentTask: UITask, title: string) => void;
  onDeleteSubtask: (subtaskId: string) => void;
}

export const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({
  selectedTask,
  onClose,
  listMap,
  listSelectOptions,
  subtasks,
  onUpdateTask,
  onToggleStatus,
  onDeleteTask,
  onAddSubtask,
  onDeleteSubtask,
}) => {
  const [subtaskInput, setSubtaskInput] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');

  // Rascunho local de edição da tarefa
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftListId, setDraftListId] = useState('inbox');
  const [draftDueDate, setDraftDueDate] = useState<number | null>(null);
  const [draftRecurrenceRule, setDraftRecurrenceRule] = useState<string | null>(null);
  const [draftRecurrenceMode, setDraftRecurrenceMode] = useState<RecurrenceMode>('fixed');
  const [draftPriority, setDraftPriority] = useState<TaskPriority>(0);
  const [draftTags, setDraftTags] = useState<string[]>([]);

  // Estados de expansão e visualização da descrição
  const [isExpandedModalOpen, setIsExpandedModalOpen] = useState(false);
  const [isInlineExpanded, setIsInlineExpanded] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Estados de persistência no banco de dados
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Inicializa o rascunho quando a tarefa selecionada muda
  useEffect(() => {
    if (selectedTask) {
      setDraftTitle(selectedTask.title);
      setDraftDescription(selectedTask.description);
      setDraftListId(selectedTask.listId);
      setDraftDueDate(selectedTask.dueDate);
      setDraftRecurrenceRule(selectedTask.recurrenceRule);
      setDraftRecurrenceMode(selectedTask.recurrenceMode);
      setDraftPriority(selectedTask.priority);
      setDraftTags([...selectedTask.tags]);
      setSaveStatus('idle');
      setIsPreviewMode(false);
      setIsExpandedModalOpen(false);
    }
  }, [selectedTask?.id]);

  // Detector de alterações pendentes em relação ao objeto salvo no banco
  const hasPendingChanges = useMemo(() => {
    if (!selectedTask) return false;
    if (draftTitle !== selectedTask.title) return true;
    if (draftDescription !== selectedTask.description) return true;
    if (draftListId !== selectedTask.listId) return true;
    if (draftDueDate !== selectedTask.dueDate) return true;
    if (draftRecurrenceRule !== selectedTask.recurrenceRule) return true;
    if (draftRecurrenceMode !== selectedTask.recurrenceMode) return true;
    if (draftPriority !== selectedTask.priority) return true;
    if (draftTags.length !== selectedTask.tags.length) return true;
    const s = new Set(draftTags);
    for (const tag of selectedTask.tags) {
      if (!s.has(tag)) return true;
    }
    return false;
  }, [
    selectedTask,
    draftTitle,
    draftDescription,
    draftListId,
    draftDueDate,
    draftRecurrenceRule,
    draftRecurrenceMode,
    draftPriority,
    draftTags,
  ]);

  // Salvar explicitamente no banco de dados com feedback visual completo
  const handleSave = async () => {
    if (!selectedTask) return;
    const cleanTitle = draftTitle.trim();
    if (!cleanTitle) {
      setDraftTitle(selectedTask.title);
      return;
    }

    try {
      setSaveStatus('saving');
      void NativeBridge.hapticLightImpact();

      const updates = {
        title: cleanTitle,
        description: draftDescription,
        listId: draftListId,
        dueDate: draftDueDate,
        recurrenceRule: draftRecurrenceRule,
        recurrenceMode: draftRecurrenceMode,
        priority: draftPriority,
        tags: draftTags,
      };

      await onUpdateTask(selectedTask.id, updates);

      if (cleanTitle !== draftTitle) {
        setDraftTitle(cleanTitle);
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSavedTime(timeStr);
      setSaveStatus('saved');
      void NativeBridge.hapticSwipeAction();

      setTimeout(() => {
        setSaveStatus((curr) => (curr === 'saved' ? 'idle' : curr));
      }, 4000);
    } catch {
      setSaveStatus('error');
    }
  };

  // Fecha o painel sem salvar (descarta alterações não salvas se o botão Salvar não foi clicado)
  const handleClose = () => {
    onClose();
  };

  // Atalho de teclado Ctrl+S / Cmd+S para salvar a tarefa
  useEffect(() => {
    if (!selectedTask) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedTask?.id,
    draftTitle,
    draftDescription,
    draftListId,
    draftDueDate,
    draftRecurrenceRule,
    draftRecurrenceMode,
    draftPriority,
    draftTags,
  ]);

  if (!selectedTask) return null;

  const handlePriorityChange = (priority: TaskPriority) => {
    void NativeBridge.hapticLightImpact();
    setDraftPriority(priority);
  };

  const handlePinToggle = () => {
    void NativeBridge.hapticLightImpact();
    const nextPinned = !selectedTask.isPinned;
    void onUpdateTask(selectedTask.id, {
      isPinned: nextPinned,
    });
  };

  const handleToggleTaskStatus = () => {
    onToggleStatus(
      selectedTask,
      selectedTask.status === 'completed' ? 'pending' : 'completed'
    );
  };

  const handleAddStep = () => {
    const clean = subtaskInput.trim();
    if (!clean) return;
    onAddSubtask(selectedTask, clean);
    setSubtaskInput('');
  };

  const handleAddCustomTag = () => {
    const raw = customTagInput.trim().toLowerCase();
    if (!raw) return;
    const formatted = raw.startsWith('@') || raw.startsWith('#') ? raw : `#${raw}`;
    if (!draftTags.includes(formatted)) {
      void NativeBridge.hapticLightImpact();
      setDraftTags((prev) => [...prev, formatted]);
    }
    setCustomTagInput('');
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
      setDraftDescription(newValue);
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
        setDraftDescription(newValue);
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
          value.slice(selectionStart);
        setDraftDescription(newValue);
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
            setDraftDescription(newValue);
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
          setDraftDescription(newValue);
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
            setDraftDescription(newValue);
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
          setDraftDescription(newValue);
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
            setDraftDescription(newValue);
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
          setDraftDescription(newValue);
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
      setDraftDescription(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd =
          selectionStart + insertText.length;
      }, 0);
    }
  };

  // Alternar checkbox interativo no preview Markdown
  const toggleChecklistLine = (lineIdx: number, currentChecked: boolean) => {
    void NativeBridge.hapticLightImpact();
    const lines = draftDescription.split('\n');
    if (lines[lineIdx] !== undefined) {
      const targetLine = lines[lineIdx];
      const newChecked = !currentChecked;
      lines[lineIdx] = targetLine.replace(
        /^(\s*[-*]\s*\[)[ xX](\]\s*)/,
        `$1${newChecked ? 'x' : ' '}$2`
      );
      setDraftDescription(lines.join('\n'));
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
        className="fixed inset-0 z-40 md:static md:inset-auto md:z-auto flex items-end md:items-stretch bg-black/60 md:bg-transparent backdrop-blur-xs md:backdrop-blur-none"
        onClick={handleClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full md:w-[410px] max-h-[88dvh] md:max-h-none bg-zinc-900 md:border-l border-t md:border-t-0 border-zinc-800 rounded-t-3xl md:rounded-none flex flex-col overflow-hidden shadow-2xl"
        >
          <SheetHandle />

          {/* Header do Detalhe */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400">
                {listMap[draftListId]?.name ?? 'Inbox'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
              <span className="text-xs text-zinc-500">Detalhes GTD</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Botão Salvar no Header */}
              <button
                type="button"
                aria-label="Salvar alterações"
                disabled={saveStatus === 'saving'}
                onClick={() => void handleSave()}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
                  hasPendingChanges
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-sm shadow-indigo-500/30 ring-1 ring-indigo-400/50'
                    : saveStatus === 'saved'
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                    : 'bg-zinc-800/70 text-zinc-300 border-zinc-700/60 hover:text-white hover:bg-zinc-800'
                }`}
                title="Salvar alterações no banco de dados (Ctrl+S)"
              >
                {saveStatus === 'saving' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-200" />
                ) : saveStatus === 'saved' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>
                  {saveStatus === 'saving'
                    ? 'Salvando'
                    : saveStatus === 'saved'
                    ? 'Salvo'
                    : 'Salvar'}
                </span>
              </button>

              {/* Botão Fixar no Topo (Pin) */}
              <button
                type="button"
                aria-label="Fixar tarefa"
                onClick={handlePinToggle}
                className={`p-1.5 rounded-lg border transition-colors ${
                  selectedTask.isPinned
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>

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
          <div className="flex-1 native-scroll-container p-4 space-y-4">
            {/* Título Editável + Notas */}
            <div>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSave();
                  }
                }}
                className="w-full bg-transparent text-base font-semibold text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 rounded-lg px-1.5 py-1 -mx-1.5"
              />
              <div className="mt-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <AlignLeft className="w-3 h-3 text-zinc-400" />
                    <span>Descrição / Notas</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {draftDescription.trim().length > 0 && (
                      <span className="text-[10px] text-zinc-500 font-medium mr-0.5">
                        {draftDescription.trim().length} chars
                      </span>
                    )}

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

                    {/* Expandir inline */}
                    <button
                      type="button"
                      onClick={() => {
                        void NativeBridge.hapticLightImpact();
                        setIsInlineExpanded((v) => !v);
                      }}
                      className={`p-1 rounded text-[10px] border transition-colors ${
                        isInlineExpanded
                          ? 'bg-zinc-700 text-zinc-200 border-zinc-600'
                          : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                      }`}
                      title={isInlineExpanded ? 'Reduzir altura' : 'Aumentar altura'}
                    >
                      {isInlineExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    </button>

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

                {/* Barra de Ferramentas de Criação de Listas */}
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
                </div>

                {/* Área de Texto ou Pré-visualização com Listas */}
                {isPreviewMode ? (
                  <div
                    className={`w-full bg-zinc-950/70 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 overflow-y-auto ${
                      isInlineExpanded ? 'min-h-[220px] max-h-[350px]' : 'min-h-[100px] max-h-[180px]'
                    }`}
                  >
                    {renderMarkdownPreview(draftDescription, toggleChecklistLine)}
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    rows={isInlineExpanded ? 10 : 4}
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    onKeyDown={handleDescriptionKeyDown}
                    placeholder="Notas em Markdown, listas (- item, 1. item) ou checklist (- [ ] item)..."
                    className="w-full bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed transition-all resize-y"
                  />
                )}
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
                onChange={(nextListId) => setDraftListId(nextListId)}
              />
            </div>

            {/* Data de Vencimento / Evento usando CustomDatePicker */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Data Agendada / Calendário
              </label>
              <CustomDatePicker
                value={draftDueDate}
                onChange={(nextDueDate) => setDraftDueDate(nextDueDate)}
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
                  setDraftRecurrenceMode(recurrenceMode);
                  if (recurrenceRule && draftDueDate === null) {
                    setDraftDueDate(Date.now());
                  }
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

            {/* Contextos GTD & Tags */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Contextos GTD & Tags
              </label>

              {/* Chips de tags ativas vinculadas com botão de remoção */}
              {draftTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5 p-2 rounded-xl bg-zinc-950/50 border border-zinc-800/70">
                  {draftTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700/60 shadow-xs"
                    >
                      <Tag className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span>{tag}</span>
                      <button
                        type="button"
                        aria-label={`Remover tag ${tag}`}
                        onClick={() => {
                          void NativeBridge.hapticLightImpact();
                          setDraftTags((prev) => prev.filter((t) => t !== tag));
                        }}
                        className="hover:text-red-400 text-zinc-400 ml-0.5 transition-colors p-0.5 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mb-2">
                {GTD_CONTEXT_SUGGESTIONS.map((ctx) => {
                  const active = draftTags.includes(ctx);
                  return (
                    <button
                      key={ctx}
                      type="button"
                      onClick={() => {
                        void NativeBridge.hapticLightImpact();
                        const nextTags = active
                          ? draftTags.filter((t) => t !== ctx)
                          : [...draftTags, ctx];
                        setDraftTags(nextTags);
                      }}
                      className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      <span>{ctx}</span>
                    </button>
                  );
                })}
              </div>

              {/* Adicionar Tag Customizada */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomTag();
                    }
                  }}
                  placeholder="Nova tag (@contexto ou #tag)..."
                  className="flex-1 bg-zinc-950/70 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTag}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium"
                >
                  + Tag
                </button>
              </div>
            </div>

            {/* Subtarefas / Checklists (parent_task_id) */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Subtarefas / Checklist
              </label>
              <div className="space-y-1.5 mb-2">
                {subtasks.map((sub) => (
                  <SubtaskItem
                    key={sub.id}
                    subtask={sub}
                    onToggle={(s) => onToggleStatus(s)}
                    onDelete={onDeleteSubtask}
                  />
                ))}
              </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddStep();
                  }
                }}
                placeholder="Adicionar passo da subtarefa..."
                className="flex-1 bg-zinc-950/70 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddStep}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium"
              >
                + Passo
              </button>
            </div>
          </div>

          {/* Botão Excluir Tarefa Principal */}
          <div className="pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                onDeleteTask(selectedTask);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir Tarefa</span>
            </button>
          </div>
        </div>

        {/* Rodapé Fixo com Status de Persistência no Banco e Botão Salvar Principal */}
        <div className="p-3.5 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {saveStatus === 'saving' ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                <span className="font-medium truncate">Salvando no banco de dados...</span>
              </div>
            ) : saveStatus === 'saved' ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-medium truncate">
                  Salvo no banco{lastSavedTime ? ` às ${lastSavedTime}` : ''}
                </span>
              </div>
            ) : hasPendingChanges ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="font-medium truncate">Alterações não salvas</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Check className="w-3.5 h-3.5 text-emerald-500/70 shrink-0" />
                <span className="truncate">
                  {lastSavedTime ? `Salvo no banco às ${lastSavedTime}` : 'Sincronizado com o banco'}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={saveStatus === 'saving'}
            onClick={() => void handleSave()}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shrink-0 shadow-sm ${
              hasPendingChanges
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 ring-1 ring-indigo-400/50'
                : saveStatus === 'saved'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60'
            }`}
          >
            {saveStatus === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Salvo no Banco!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{hasPendingChanges ? 'Salvar Alterações' : 'Salvar'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>

    {/* =========================================================================
        MODAL EXPANDIDO DE DESCRIÇÃO / NOTAS EM TELA CHEIA
        ========================================================================= */}
    {isExpandedModalOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm"
        onClick={() => setIsExpandedModalOpen(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl h-[85vh] bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
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

          {/* Barra de Ferramentas com Criadores de Listas */}
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
            </div>

            <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">
              {draftDescription.length} caracteres • {draftDescription.split('\n').filter(Boolean).length} linhas
            </span>
          </div>

          {/* Corpo do Editor Expandido: Edição vs Pré-visualização */}
          <div className="flex-1 p-5 overflow-y-auto native-scroll-container bg-zinc-950/20">
            {isPreviewMode ? (
              <div className="max-w-none text-zinc-200">
                {renderMarkdownPreview(draftDescription, toggleChecklistLine)}
              </div>
            ) : (
              <textarea
                ref={expandedTextareaRef}
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                onKeyDown={handleDescriptionKeyDown}
                placeholder="Digite notas em Markdown, tarefas com checklist (- [ ]), links e listas..."
                className="w-full h-full min-h-[300px] bg-transparent text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none font-mono leading-relaxed"
              />
            )}
          </div>

          {/* Rodapé do Editor Expandido */}
          <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between">
            <span className="text-xs text-zinc-500 hidden sm:inline">
              Dica: <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 border border-zinc-700">Enter</kbd> continua a lista • <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 border border-zinc-700">Tab</kbd> indenta
            </span>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={() => setIsExpandedModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
              >
                Concluir
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleSave();
                  setIsExpandedModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar e Fechar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
};
