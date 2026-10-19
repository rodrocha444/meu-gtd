import type { RecurrenceMode, TaskPriority } from '../db/schema';
import type { TaskReminder } from '../types/task';
import { createDefaultReminder } from './reminder';
import { buildRRule, formatRecurrenceBadge, type RecurrenceFrequency } from './recurrence';

export interface ParsedQuickTask {
  /** Título limpo sem os metadados extraídos */
  cleanTitle: string;
  /** Prioridade extraída: 0 (Nenhuma), 1 (Baixa), 2 (Média), 3 (Alta) */
  priority: TaskPriority;
  /** Nome ou slug da lista extraída via ~lista (null se não informada -> fallback para Inbox) */
  targetListQuery: string | null;
  /** Timestamp (ms) da data de vencimento extraída */
  dueDate: number | null;
  /** Rótulo amigável da data detectada para preview na UI */
  detectedDateLabel: string | null;
  /** Regra RRule extraída (ex: FREQ=YEARLY;INTERVAL=1) */
  recurrenceRule: string | null;
  /** Modo de repetição: 'fixed' (padrão pela data) ou 'after_completion' (após concluir) */
  recurrenceMode: RecurrenceMode;
  /** Rótulo amigável da recorrência detectada */
  detectedRecurrenceLabel: string | null;
  /** Lembretes detectados via NLP */
  reminders?: TaskReminder[];
  /** Rótulo amigável do lembrete detectado */
  detectedReminderLabel?: string | null;
}

const PRIORITY_MAP: Record<string, TaskPriority> = {
  '0': 0,
  nenhuma: 0,
  '1': 1,
  baixa: 1,
  low: 1,
  '2': 2,
  media: 2,
  média: 2,
  med: 2,
  '3': 3,
  alta: 3,
  urgente: 3,
  high: 3,
};

const WEEKDAY_MAP: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  terça: 2,
  'terça-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
  sábado: 6,
};

/**
 * Retorna um Date ajustado para o final da manhã/dia útil (09:00 local) da data alvo
 */
function atNineAM(base: Date, addDays = 0): Date {
  const result = new Date(base);
  result.setDate(result.getDate() + addDays);
  result.setHours(9, 0, 0, 0);
  return result;
}

/**
 * Parser NLP de Captura Rápida estilo TickTick + GTD
 *
 * Exemplos suportados:
 * - "Enviar contrato assinado !alta ~trabalho amanhã"
 * - "Aniversário da Mariana 25/10 todo ano"
 * - "Limpar filtro do ar-condicionado a cada 30 dias após concluir"
 */
export function parseQuickCaptureInput(
  rawInput: string,
  now: Date = new Date()
): ParsedQuickTask {
  let workingText = rawInput;
  let priority: TaskPriority = 0;
  let targetListQuery: string | null = null;
  let dueDate: number | null = null;
  let detectedDateLabel: string | null = null;
  let recurrenceRule: string | null = null;
  let recurrenceMode: RecurrenceMode = 'fixed';
  const reminders: TaskReminder[] = [];
  let detectedReminderLabel: string | null = null;

  // 1. Extrair Prioridade: !1, !2, !3, !alta, !média, !baixa, !urgente
  const priorityRegex = /(?:^|\s)!(0|1|2|3|baixa|low|m[eé]dia|med|alta|urgente|high|nenhuma)\b/gi;
  workingText = workingText.replace(priorityRegex, (_fullMatch, pToken: string) => {
    const normalized = pToken.toLowerCase();
    const mapped = PRIORITY_MAP[normalized];
    if (mapped !== undefined) {
      priority = mapped;
    }
    return ' ';
  });

  // 2. Extrair Lista de destino: ~lista ou ~"Nome da Lista"
  const listRegex = /(?:^|\s)~(?:"([^"]+)"|([\p{L}\p{N}_-]+))/gu;
  workingText = workingText.replace(
    listRegex,
    (_fullMatch, quotedList: string | undefined, singleWordList: string | undefined) => {
      const extracted = (quotedList ?? singleWordList ?? '').trim();
      if (extracted) {
        targetListQuery = extracted.toLowerCase();
      }
      return ' ';
    }
  );

  // 3. Extrair Lembretes em PT-BR (ex: "lembrar 15 dias antes", "lembrete 15d antes", "lembrar no dia", "lembrete:15d")
  const onTheDayReminderRegex =
    /(?:^|\s)\b(?:lembrar|lembrete)\s+no\s+dia(?:\s*[àa]s?\s*(\d{1,2})(?::(\d{2}))?h?)?\b/i;
  const onTheDayMatch = workingText.match(onTheDayReminderRegex);
  if (onTheDayMatch) {
    const rawH = onTheDayMatch[1];
    const rawM = onTheDayMatch[2];
    const timeStr = rawH ? `${rawH.padStart(2, '0')}:${(rawM || '00').padStart(2, '0')}` : '09:00';
    reminders.push(createDefaultReminder(0, timeStr));
    detectedReminderLabel = `No dia (${timeStr})`;
    workingText = workingText.replace(onTheDayReminderRegex, ' ');
  }

  const offsetReminderRegex =
    /(?:^|\s)\b(?:lembrar|lembrete:?)\s*(\d{1,3})\s*(?:dias?|d)\s*(?:antes)?(?:\s*[àa]s?\s*(\d{1,2})(?::(\d{2}))?h?)?\b/i;
  const offsetMatch = workingText.match(offsetReminderRegex);
  if (offsetMatch && offsetMatch[1]) {
    const days = Math.max(0, Number.parseInt(offsetMatch[1], 10));
    const rawH = offsetMatch[2];
    const rawM = offsetMatch[3];
    const timeStr = rawH ? `${rawH.padStart(2, '0')}:${(rawM || '00').padStart(2, '0')}` : '09:00';
    reminders.push(createDefaultReminder(days, timeStr));
    detectedReminderLabel = `${days === 0 ? 'No dia' : `${days}d antes`} (${timeStr})`;
    workingText = workingText.replace(offsetReminderRegex, ' ');
  }

  // 4. Extrair Modificador de Recorrência por Conclusão: "após concluir" / "após conclusão"
  const afterCompletionRegex = /(?:^|\s)\bap[oó]s\s+(?:concluir|conclus[aã]o)\b/i;
  if (afterCompletionRegex.test(workingText)) {
    recurrenceMode = 'after_completion';
    workingText = workingText.replace(afterCompletionRegex, ' ');
  }

  // 5. Extrair Regras de Recorrência em PT-BR
  // 5a. "a cada N dias|semanas|meses|anos"
  const customIntervalRegex =
    /(?:^|\s)\ba\s+cada\s+(\d{1,3})\s+(dia|dias|semana|semanas|m[eê]s|meses|ano|anos)\b/i;
  const intervalMatch = workingText.match(customIntervalRegex);
  if (intervalMatch && intervalMatch[1] && intervalMatch[2]) {
    const interval = Math.max(1, Number.parseInt(intervalMatch[1], 10));
    const unit = intervalMatch[2].toLowerCase();
    let freq: RecurrenceFrequency = 'DAILY';
    if (unit.startsWith('semana')) freq = 'WEEKLY';
    else if (unit.startsWith('m')) freq = 'MONTHLY';
    else if (unit.startsWith('ano')) freq = 'YEARLY';

    recurrenceRule = buildRRule(freq, interval);
    workingText = workingText.replace(customIntervalRegex, ' ');
  }

  // 5b. Expressões simples: "todo dia", "toda semana", "todo mês", "todo ano", "anual", "mensal", "semanal", "diariamente"
  if (!recurrenceRule) {
    const simpleRecurrenceRegex =
      /(?:^|\s)\b(todo\s+dia|diariamente|toda\s+semana|semanalmente|semanal|todo\s+m[eê]s|mensalmente|mensal|todo\s+ano|anualmente|anual)\b/i;
    const recMatch = workingText.match(simpleRecurrenceRegex);
    if (recMatch && recMatch[1]) {
      const token = recMatch[1].toLowerCase();
      if (token.includes('dia')) {
        recurrenceRule = buildRRule('DAILY', 1);
      } else if (token.includes('semana')) {
        recurrenceRule = buildRRule('WEEKLY', 1);
      } else if (token.includes('mês') || token.includes('mes') || token.includes('mensal')) {
        recurrenceRule = buildRRule('MONTHLY', 1);
      } else {
        recurrenceRule = buildRRule('YEARLY', 1);
      }
      workingText = workingText.replace(simpleRecurrenceRegex, ' ');
    }
  }

  // 6. Extrair Expressões de Data em Português
  // 6a. "depois de amanhã"
  const afterTomorrowRegex = /(?:^|\s)depois\s+de\s+amanh[aã](?:[\s.,!?;]|$)/iu;
  if (afterTomorrowRegex.test(workingText)) {
    const target = atNineAM(now, 2);
    dueDate = target.getTime();
    detectedDateLabel = 'Depois de amanhã';
    workingText = workingText.replace(afterTomorrowRegex, ' ');
  }

  // 6b. "hoje" / "amanhã" / "próxima semana"
  if (dueDate === null) {
    const relativeWordRegex =
      /(?:^|\s)(hoje|amanh[aã]|pr[oó]xima\s+semana)(?:[\s.,!?;]|$)/iu;
    const match = workingText.match(relativeWordRegex);
    if (match && match[1]) {
      const token = match[1].toLowerCase();
      if (token === 'hoje') {
        dueDate = atNineAM(now, 0).getTime();
        detectedDateLabel = 'Hoje';
      } else if (token.startsWith('amanh')) {
        dueDate = atNineAM(now, 1).getTime();
        detectedDateLabel = 'Amanhã';
      } else {
        dueDate = atNineAM(now, 7).getTime();
        detectedDateLabel = 'Próx. Semana';
      }
      workingText = workingText.replace(relativeWordRegex, ' ');
    }
  }

  // 6c. Offset curto "+Nd" (ex: +2d, +7d)
  if (dueDate === null) {
    const offsetDaysRegex = /(?:^|\s)\+(\d{1,3})d(?:[\s.,!?;]|$)/iu;
    const match = workingText.match(offsetDaysRegex);
    if (match && match[1]) {
      const days = Number.parseInt(match[1], 10);
      dueDate = atNineAM(now, days).getTime();
      detectedDateLabel = `+${days}d`;
      workingText = workingText.replace(offsetDaysRegex, ' ');
    }
  }

  // 6d. Dias da semana (segunda, terça, quarta, quinta, sexta, sábado, domingo)
  if (dueDate === null) {
    const weekdayRegex =
      /(?:^|\s)(domingo|segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[aá]bado)(?:[\s.,!?;]|$)/iu;
    const match = workingText.match(weekdayRegex);
    if (match && match[1]) {
      const dayKey = match[1].toLowerCase();
      const targetDay = WEEKDAY_MAP[dayKey];
      if (targetDay !== undefined) {
        const currentDay = now.getDay();
        let daysAhead = (targetDay - currentDay + 7) % 7;
        if (daysAhead === 0) daysAhead = 7; // próximo dia da semana
        dueDate = atNineAM(now, daysAhead).getTime();
        detectedDateLabel =
          match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        workingText = workingText.replace(weekdayRegex, ' ');
      }
    }
  }

  // 6e. Data explícita DD/MM (ex: 25/10)
  if (dueDate === null) {
    const explicitDateRegex = /(?:^|\s)\b(\d{1,2})\/(\d{1,2})\b/;
    const match = workingText.match(explicitDateRegex);
    if (match && match[1] && match[2]) {
      const day = Number.parseInt(match[1], 10);
      const month = Number.parseInt(match[2], 10) - 1;
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
        const candidate = new Date(now.getFullYear(), month, day, 9, 0, 0, 0);
        if (candidate.getTime() < now.getTime() - 86_400_000) {
          candidate.setFullYear(candidate.getFullYear() + 1);
        }
        dueDate = candidate.getTime();
        detectedDateLabel = `${String(day).padStart(2, '0')}/${String(
          month + 1
        ).padStart(2, '0')}`;
        workingText = workingText.replace(explicitDateRegex, ' ');
      }
    }
  }

  // Se tiver recorrência e nenhuma data foi informada, assume "Hoje" como data inicial
  if (recurrenceRule && dueDate === null) {
    dueDate = atNineAM(now, 0).getTime();
    detectedDateLabel = 'Hoje';
  }

  const detectedRecurrenceLabel = formatRecurrenceBadge(
    recurrenceRule,
    recurrenceMode
  );

  // Preserva quebras de linha existentes, normalizando espaços dentro de cada linha
  const cleanTitle = workingText
    .split('\n')
    .map((line) => line.replace(/[^\S\r\n]+/g, ' ').trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && idx < arr.length - 1))
    .join('\n')
    .trim();

  return {
    cleanTitle,
    priority,
    targetListQuery,
    dueDate,
    detectedDateLabel,
    recurrenceRule,
    recurrenceMode,
    detectedRecurrenceLabel,
    reminders: reminders.length > 0 ? reminders : undefined,
    detectedReminderLabel,
  };
}
