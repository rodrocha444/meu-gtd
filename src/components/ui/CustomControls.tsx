import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Plus,
  Repeat,
  X,
} from 'lucide-react';
import type { RecurrenceMode } from '../../db/schema';
import type { TaskReminder } from '../../types/task';
import { NativeBridge } from '../../lib/native';
import {
  createDefaultReminder,
  formatReminderShortLabel,
} from '../../utils/reminder';
import {
  buildRRule,
  formatRecurrenceBadge,
  isSameCalendarDay,
  normalizeToNineAM,
  parseRRule,
  type RecurrenceFrequency,
} from '../../utils/recurrence';

/* ============================================================================
   1. CUSTOM SELECT (Substituto 100% personalizável para <select> nativo)
   ============================================================================ */

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  dotColor?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps<T extends string = string> {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function CustomSelect<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = 'Selecionar...',
  className = '',
  size = 'md',
}: CustomSelectProps<T>): React.ReactElement {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          void NativeBridge.hapticLightImpact();
          setOpen((prev) => !prev);
        }}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-zinc-950/80 border transition-all text-left ${
          open
            ? 'border-indigo-500 ring-2 ring-indigo-500/15 text-zinc-100'
            : 'border-zinc-800 hover:border-zinc-700 text-zinc-200'
        } ${size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'}`}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {selectedOption?.dotColor && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selectedOption.dotColor }}
            />
          )}
          {selectedOption?.icon && (
            <span className="shrink-0 text-zinc-400">{selectedOption.icon}</span>
          )}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180 text-indigo-400' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-2xl bg-zinc-900 border border-zinc-700/90 shadow-2xl py-1.5 max-h-60 native-scroll-container backdrop-blur-xl">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  void NativeBridge.hapticLightImpact();
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-indigo-600/20 text-indigo-200 font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-800/80 active:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {option.dotColor && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: option.dotColor }}
                    />
                  )}
                  {option.icon && (
                    <span className="shrink-0 text-zinc-400">{option.icon}</span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate">{option.label}</div>
                    {option.description && (
                      <div className="text-[10px] text-zinc-500 truncate mt-0.5 font-normal">
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   2. CUSTOM SEGMENTED CONTROL (Alternador nativo estilo iOS / TickTick)
   ============================================================================ */

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSegmentedControlProps<T extends string = string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function CustomSegmentedControl<T extends string = string>({
  value,
  options,
  onChange,
  className = '',
  size = 'md',
}: CustomSegmentedControlProps<T>): React.ReactElement {
  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl bg-zinc-950/90 border border-zinc-800/90 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (opt.value !== value) {
                void NativeBridge.hapticLightImpact();
                onChange(opt.value);
              }
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all ${
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            } ${
              active
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/80'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            {opt.icon}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
   3. CUSTOM NUMBER STEPPER (Substituto para <input type="number"> legado)
   ============================================================================ */

interface CustomNumberStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export const CustomNumberStepper: React.FC<CustomNumberStepperProps> = ({
  value,
  min = 1,
  max = 99,
  onChange,
}) => {
  const handleStep = (delta: number) => {
    const next = Math.max(min, Math.min(max, value + delta));
    if (next !== value) {
      void NativeBridge.hapticLightImpact();
      onChange(next);
    }
  };

  return (
    <div className="inline-flex items-center rounded-xl bg-zinc-950/90 border border-zinc-800 p-0.5">
      <button
        type="button"
        aria-label="Diminuir valor"
        disabled={value <= min}
        onClick={() => handleStep(-1)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-800 disabled:opacity-35 transition-colors"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-8 text-center text-xs font-bold text-zinc-100 tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label="Aumentar valor"
        disabled={value >= max}
        onClick={() => handleStep(1)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-800 disabled:opacity-35 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/* ============================================================================
   4. CUSTOM DATE PICKER (Substituto nativo-dark para <input type="date">)
   ============================================================================ */

const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

interface CustomDatePickerProps {
  value: number | null;
  onChange: (dueDate: number | null) => void;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
}) => {
  const [showCalendarGrid, setShowCalendarGrid] = useState(false);

  const selectedDate = useMemo(
    () => (value !== null ? new Date(value) : null),
    [value]
  );

  const [cursorMonth, setCursorMonth] = useState<Date>(() => {
    const base = value !== null ? new Date(value) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (value !== null) {
      const d = new Date(value);
      setCursorMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [value]);

  const today = useMemo(() => normalizeToNineAM(new Date()), []);
  const tomorrow = useMemo(() => {
    const d = normalizeToNineAM(new Date());
    d.setDate(d.getDate() + 1);
    return d;
  }, []);
  const nextWeek = useMemo(() => {
    const d = normalizeToNineAM(new Date());
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  const isTodaySelected =
    selectedDate !== null && isSameCalendarDay(selectedDate, today);
  const isTomorrowSelected =
    selectedDate !== null && isSameCalendarDay(selectedDate, tomorrow);
  const isNextWeekSelected =
    selectedDate !== null && isSameCalendarDay(selectedDate, nextWeek);

  const calendarDays = useMemo(() => {
    const year = cursorMonth.getFullYear();
    const month = cursorMonth.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ date: Date; inCurrentMonth: boolean }> = [];

    // Dias do mês anterior para preencher início da grade
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i, 9, 0, 0, 0);
      cells.push({ date: d, inCurrentMonth: false });
    }

    // Dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day, 9, 0, 0, 0);
      cells.push({ date: d, inCurrentMonth: true });
    }

    // Preenche até múltiplo de 7
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i, 9, 0, 0, 0);
      cells.push({ date: d, inCurrentMonth: false });
    }

    return cells;
  }, [cursorMonth]);

  const formattedSelected = useMemo(() => {
    if (!selectedDate) return 'Sem data definida';
    if (isTodaySelected) return 'Hoje';
    if (isTomorrowSelected) return 'Amanhã';
    return selectedDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, [selectedDate, isTodaySelected, isTomorrowSelected]);

  return (
    <div className="space-y-2">
      {/* Atalhos Rápidos de Data */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            void NativeBridge.hapticLightImpact();
            onChange(today.getTime());
          }}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            isTodaySelected
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
          }`}
        >
          Hoje
        </button>

        <button
          type="button"
          onClick={() => {
            void NativeBridge.hapticLightImpact();
            onChange(tomorrow.getTime());
          }}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            isTomorrowSelected
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
          }`}
        >
          Amanhã
        </button>

        <button
          type="button"
          onClick={() => {
            void NativeBridge.hapticLightImpact();
            onChange(nextWeek.getTime());
          }}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            isNextWeekSelected
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
          }`}
        >
          +7 Dias
        </button>

        <button
          type="button"
          onClick={() => {
            void NativeBridge.hapticLightImpact();
            setShowCalendarGrid((prev) => !prev);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            showCalendarGrid ||
            (selectedDate !== null &&
              !isTodaySelected &&
              !isTomorrowSelected &&
              !isNextWeekSelected)
              ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300'
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>{formattedSelected}</span>
        </button>

        {value !== null && (
          <button
            type="button"
            aria-label="Remover data"
            onClick={() => {
              void NativeBridge.hapticLightImpact();
              onChange(null);
            }}
            className="p-1.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Mini-Calendário Customizado Interativo */}
      {showCalendarGrid && (
        <div className="p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-200">
              {MONTHS_PT[cursorMonth.getMonth()]} {cursorMonth.getFullYear()}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => {
                  void NativeBridge.hapticLightImpact();
                  setCursorMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  );
                }}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => {
                  void NativeBridge.hapticLightImpact();
                  setCursorMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  );
                }}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS_SHORT.map((w, idx) => (
              <span
                key={idx}
                className="text-[10px] font-semibold text-zinc-500 py-0.5"
              >
                {w}
              </span>
            ))}

            {calendarDays.map(({ date, inCurrentMonth }) => {
              const isSelected =
                selectedDate !== null && isSameCalendarDay(date, selectedDate);
              const isToday = isSameCalendarDay(date, today);

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => {
                    void NativeBridge.hapticLightImpact();
                    onChange(normalizeToNineAM(date).getTime());
                    setShowCalendarGrid(false);
                  }}
                  className={`h-7 rounded-lg text-xs font-medium transition-all flex items-center justify-center ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : isToday
                      ? 'border border-indigo-500/60 text-indigo-300 bg-indigo-500/10'
                      : inCurrentMonth
                      ? 'text-zinc-200 hover:bg-zinc-800'
                      : 'text-zinc-600 hover:bg-zinc-900'
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   5. CUSTOM RECURRENCE PICKER (Recorrência Padrão Fixa + Por Dia de Conclusão)
   ============================================================================ */

interface CustomRecurrencePickerProps {
  recurrenceRule: string | null;
  recurrenceMode: RecurrenceMode;
  onChange: (updates: {
    recurrenceRule: string | null;
    recurrenceMode: RecurrenceMode;
  }) => void;
}

const FREQUENCY_OPTIONS: CustomSelectOption<RecurrenceFrequency>[] = [
  { value: 'DAILY', label: 'Dias', description: 'Repetição diária ou a cada N dias' },
  { value: 'WEEKLY', label: 'Semanas', description: 'Repetição semanal' },
  { value: 'MONTHLY', label: 'Meses', description: 'Repetição mensal no mesmo dia' },
  { value: 'YEARLY', label: 'Anos', description: 'Repetição anual no mesmo dia' },
];

export const CustomRecurrencePicker: React.FC<CustomRecurrencePickerProps> = ({
  recurrenceRule,
  recurrenceMode,
  onChange,
}) => {
  const parsed = useMemo(() => parseRRule(recurrenceRule), [recurrenceRule]);
  const [customOpen, setCustomOpen] = useState(false);

  const activePreset = useMemo(() => {
    if (!parsed) return 'NONE';
    if (parsed.interval === 1) return parsed.freq;
    return 'CUSTOM';
  }, [parsed]);

  const handlePresetClick = (preset: 'NONE' | RecurrenceFrequency | 'CUSTOM') => {
    void NativeBridge.hapticLightImpact();
    if (preset === 'NONE') {
      setCustomOpen(false);
      onChange({ recurrenceRule: null, recurrenceMode });
      return;
    }
    if (preset === 'CUSTOM') {
      setCustomOpen(true);
      if (!parsed) {
        onChange({
          recurrenceRule: buildRRule('DAILY', 2),
          recurrenceMode,
        });
      }
      return;
    }
    setCustomOpen(false);
    onChange({
      recurrenceRule: buildRRule(preset, 1),
      recurrenceMode,
    });
  };

  return (
    <div className="space-y-2.5">
      {/* Presets Rápidos de Repetição */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: 'NONE' as const, label: 'Não repetir' },
          { id: 'DAILY' as const, label: 'Diária' },
          { id: 'WEEKLY' as const, label: 'Semanal' },
          { id: 'MONTHLY' as const, label: 'Mensal' },
          { id: 'YEARLY' as const, label: 'Anual' },
          { id: 'CUSTOM' as const, label: 'Personalizar...' },
        ].map((item) => {
          const isActive =
            item.id === 'CUSTOM'
              ? customOpen || activePreset === 'CUSTOM'
              : !customOpen && activePreset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handlePresetClick(item.id)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1 ${
                isActive
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.id !== 'NONE' && (
                <Repeat className="w-3 h-3 text-indigo-400" />
              )}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Configurador de Intervalo Customizado (Stepper + CustomSelect) */}
      {(customOpen || activePreset === 'CUSTOM') && parsed && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
          <span className="text-xs text-zinc-300 font-medium shrink-0">
            Repetir a cada
          </span>
          <CustomNumberStepper
            value={parsed.interval}
            min={1}
            max={99}
            onChange={(nextInterval) =>
              onChange({
                recurrenceRule: buildRRule(parsed.freq, nextInterval),
                recurrenceMode,
              })
            }
          />
          <CustomSelect<RecurrenceFrequency>
            size="sm"
            className="flex-1"
            value={parsed.freq}
            options={FREQUENCY_OPTIONS}
            onChange={(nextFreq) =>
              onChange({
                recurrenceRule: buildRRule(nextFreq, parsed.interval),
                recurrenceMode,
              })
            }
          />
        </div>
      )}

      {/* Seletor de Modo: Recorrência Padrão (Data Fixa) vs Por Dia de Conclusão */}
      {parsed && (
        <div className="p-2.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/90 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400">
              Tipo de Repetição
            </span>
            <span className="text-[11px] text-indigo-400 font-medium">
              {formatRecurrenceBadge(recurrenceRule, recurrenceMode, true)}
            </span>
          </div>

          <CustomSegmentedControl<RecurrenceMode>
            size="sm"
            className="w-full"
            value={recurrenceMode}
            onChange={(nextMode) =>
              onChange({
                recurrenceRule,
                recurrenceMode: nextMode,
              })
            }
            options={[
              {
                value: 'fixed',
                label: 'Padrão (Data Fixa)',
                icon: <CalendarIcon className="w-3 h-3" />,
              },
              {
                value: 'after_completion',
                label: 'Dia de Conclusão',
                icon: <Clock className="w-3 h-3" />,
              },
            ]}
          />

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {recurrenceMode === 'fixed'
              ? 'Mantém o calendário fixo (ex: aniversários, contas, eventos). A próxima data é calculada a partir do dia agendado.'
              : 'Calcula o próximo ciclo a partir do dia exato em que você concluir a tarefa (ex: cortar cabelo, manutenção, revisão).'}
          </p>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   6. CUSTOM TIME PICKER (Substituto nativo-dark para <input type="time">)
   ============================================================================ */

export interface CustomTimePickerProps {
  value: string; // "HH:mm" (padrão "09:00")
  onChange: (time: string) => void;
  onClose?: () => void;
}

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value = '09:00',
  onChange,
  onClose,
}) => {
  const [rawH, rawM] = (value || '09:00').split(':');
  const initialH = Math.max(0, Math.min(23, Number(rawH) || 9));
  const initialM = Math.max(0, Math.min(59, Number(rawM) || 0));

  const [hours, setHours] = useState(initialH);
  const [minutes, setMinutes] = useState(initialM);

  const quickTimes = ['08:00', '09:00', '12:00', '14:00', '18:00', '20:00'];

  const applyTime = (h: number, m: number) => {
    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    onChange(formatted);
  };

  const handleStepHours = (delta: number) => {
    void NativeBridge.hapticLightImpact();
    const next = (hours + delta + 24) % 24;
    setHours(next);
    applyTime(next, minutes);
  };

  const handleStepMinutes = (delta: number) => {
    void NativeBridge.hapticLightImpact();
    const next = (minutes + delta + 60) % 60;
    setMinutes(next);
    applyTime(hours, next);
  };

  return (
    <div className="p-3 rounded-2xl bg-zinc-950/95 border border-zinc-800 space-y-3 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          Horário do Lembrete
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Steppers de Hora e Minuto */}
      <div className="flex items-center justify-center gap-3 py-1">
        {/* Horas */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label="Aumentar hora"
            onClick={() => handleStepHours(1)}
            className="w-8 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-800 bg-zinc-900 border border-zinc-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <span className="w-12 text-center text-base font-bold text-zinc-100 tabular-nums py-1">
            {String(hours).padStart(2, '0')}h
          </span>
          <button
            type="button"
            aria-label="Diminuir hora"
            onClick={() => handleStepHours(-1)}
            className="w-8 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-800 bg-zinc-900 border border-zinc-800 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="text-xl font-bold text-zinc-500 pb-1">:</span>

        {/* Minutos (passo de 5 min) */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label="Aumentar minutos"
            onClick={() => handleStepMinutes(5)}
            className="w-8 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-800 bg-zinc-900 border border-zinc-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <span className="w-12 text-center text-base font-bold text-zinc-100 tabular-nums py-1">
            {String(minutes).padStart(2, '0')}m
          </span>
          <button
            type="button"
            aria-label="Diminuir minutos"
            onClick={() => handleStepMinutes(-5)}
            className="w-8 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-800 bg-zinc-900 border border-zinc-800 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Atalhos Rápidos de Horário */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-800/80">
        {quickTimes.map((t) => {
          const isSelected = value === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                const [h = 0, m = 0] = t.split(':').map(Number);
                setHours(h);
                setMinutes(m);
                onChange(t);
              }}
              className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                isSelected
                  ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300 font-semibold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
   7. CUSTOM REMINDER PICKER (Suporte a Múltiplos Lembretes e Antecedência)
   ============================================================================ */

export interface CustomReminderPickerProps {
  dueDate: number | null;
  reminders: TaskReminder[];
  onChange: (reminders: TaskReminder[]) => void;
  onSetDueDateDefault?: () => void;
}

export const CustomReminderPicker: React.FC<CustomReminderPickerProps> = ({
  dueDate,
  reminders = [],
  onChange,
  onSetDueDateDefault,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState(15);

  const presets = [
    { label: 'No dia', offsetDays: 0 },
    { label: '1 dia antes', offsetDays: 1 },
    { label: '2 dias antes', offsetDays: 2 },
    { label: '1 semana antes', offsetDays: 7 },
    { label: '15 dias antes', offsetDays: 15 },
    { label: '30 dias antes', offsetDays: 30 },
  ];

  const handleAddPreset = (offsetDays: number) => {
    void NativeBridge.hapticLightImpact();
    const newRem = createDefaultReminder(offsetDays, '09:00');
    onChange([...reminders, newRem]);
    setIsAdding(false);
  };

  const handleRemoveReminder = (id: string) => {
    void NativeBridge.hapticLightImpact();
    onChange(reminders.filter((r) => r.id !== id));
    if (editingReminderId === id) {
      setEditingReminderId(null);
    }
  };

  const handleUpdateTime = (id: string, newTime: string) => {
    onChange(
      reminders.map((r) => (r.id === id ? { ...r, time: newTime } : r))
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Alerta se não houver data agendada */}
      {dueDate === null && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-300">
          <span>Defina uma data de vencimento para calcular a antecedência.</span>
          {onSetDueDateDefault && (
            <button
              type="button"
              onClick={onSetDueDateDefault}
              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-medium shrink-0 ml-2"
            >
              Definir data
            </button>
          )}
        </div>
      )}

      {/* Lista de Lembretes Existentes */}
      {reminders.length > 0 && (
        <div className="space-y-1.5">
          {reminders.map((rem) => {
            const isEditingTime = editingReminderId === rem.id;
            return (
              <div key={rem.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-950/80 border border-zinc-800/90 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                      <Bell className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-medium text-zinc-200 truncate">
                      {formatReminderShortLabel(rem)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Botão de Horário (Padrão 09:00, clicável para editar) */}
                    <button
                      type="button"
                      aria-label="Editar horário do lembrete"
                      onClick={() => {
                        void NativeBridge.hapticLightImpact();
                        setEditingReminderId(isEditingTime ? null : rem.id);
                      }}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border font-semibold transition-colors ${
                        isEditingTime
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                          : 'bg-zinc-900 border-zinc-700/80 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100'
                      }`}
                    >
                      <Clock className="w-3 h-3 text-indigo-400" />
                      <span>{rem.time || '09:00'}</span>
                    </button>

                    {/* Excluir Lembrete */}
                    <button
                      type="button"
                      aria-label="Remover este lembrete"
                      onClick={() => handleRemoveReminder(rem.id)}
                      className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Popover/Painel inline de ajuste de horário para este lembrete */}
                {isEditingTime && (
                  <CustomTimePicker
                    value={rem.time || '09:00'}
                    onChange={(newTime) => handleUpdateTime(rem.id, newTime)}
                    onClose={() => setEditingReminderId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Botão Adicionar ou Painel de Seleção de Presets */}
      {!isAdding ? (
        <button
          type="button"
          onClick={() => {
            void NativeBridge.hapticLightImpact();
            setIsAdding(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-950/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          <span>{reminders.length === 0 ? 'Adicionar Lembrete' : 'Adicionar Outro Lembrete'}</span>
        </button>
      ) : (
        <div className="p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-200">
              Escolha a antecedência (Horário padrão: 09:00)
            </span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.offsetDays}
                type="button"
                onClick={() => handleAddPreset(p.offsetDays)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-indigo-500/60 hover:text-indigo-300 hover:bg-indigo-600/10 transition-colors flex items-center gap-1"
              >
                <Bell className="w-3 h-3 text-amber-400" />
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          {/* Opção Personalizada com Stepper */}
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-400">Personalizado (dias antes):</span>
            <div className="flex items-center gap-2">
              <CustomNumberStepper
                value={customDays}
                min={1}
                max={365}
                onChange={setCustomDays}
              />
              <button
                type="button"
                onClick={() => handleAddPreset(customDays)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
