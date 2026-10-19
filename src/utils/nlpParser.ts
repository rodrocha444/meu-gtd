import type { TaskPriority } from '../db/schema';

export interface ParsedQuickTask {
  /** Título limpo sem os metadados extraídos */
  cleanTitle: string;
  /** Prioridade extraída: 0 (Nenhuma), 1 (Baixa), 2 (Média), 3 (Alta) */
  priority: TaskPriority;
  /** Tags (#energia_baixa) e contextos GTD (@computador, @rua) */
  tags: string[];
  /** Nome ou slug da lista extraída via ~lista (null se não informada -> fallback para Inbox) */
  targetListQuery: string | null;
  /** Timestamp (ms) da data de vencimento extraída */
  dueDate: number | null;
  /** Rótulo amigável da data detectada para preview na UI */
  detectedDateLabel: string | null;
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
 * - "Enviar contrato assinado !alta @computador ~trabalho amanhã"
 * - "Comprar café em grãos @rua #energia_baixa !1 hoje"
 * - "Revisar arquitetura offline-first !3 ~next_actions +3d"
 */
export function parseQuickCaptureInput(
  rawInput: string,
  now: Date = new Date()
): ParsedQuickTask {
  let workingText = rawInput;
  let priority: TaskPriority = 0;
  const tagsSet = new Set<string>();
  let targetListQuery: string | null = null;
  let dueDate: number | null = null;
  let detectedDateLabel: string | null = null;

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

  // 2. Extrair Tags (#tag) e Contextos GTD (@contexto)
  const tagAndContextRegex = /(?:^|\s)([#@][\p{L}\p{N}_-]+)\b/gu;
  workingText = workingText.replace(tagAndContextRegex, (_fullMatch, tagToken: string) => {
    tagsSet.add(tagToken.toLowerCase());
    return ' ';
  });

  // 3. Extrair Lista de destino: ~lista ou ~"Nome da Lista"
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

  // 4. Extrair Expressões de Data em Português
  // 4a. "depois de amanhã"
  const afterTomorrowRegex = /(?:^|\s)\bdepois\s+de\s+amanh[aã]\b/i;
  if (afterTomorrowRegex.test(workingText)) {
    const target = atNineAM(now, 2);
    dueDate = target.getTime();
    detectedDateLabel = 'Depois de amanhã';
    workingText = workingText.replace(afterTomorrowRegex, ' ');
  }

  // 4b. "hoje" / "amanhã" / "próxima semana"
  if (dueDate === null) {
    const relativeWordRegex =
      /(?:^|\s)\b(hoje|amanh[aã]|pr[oó]xima\s+semana)\b/i;
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

  // 4c. Offset curto "+Nd" (ex: +2d, +7d)
  if (dueDate === null) {
    const offsetDaysRegex = /(?:^|\s)\+(\d{1,3})d\b/i;
    const match = workingText.match(offsetDaysRegex);
    if (match && match[1]) {
      const days = Number.parseInt(match[1], 10);
      dueDate = atNineAM(now, days).getTime();
      detectedDateLabel = `+${days}d`;
      workingText = workingText.replace(offsetDaysRegex, ' ');
    }
  }

  // 4d. Dias da semana (segunda, terça, quarta, quinta, sexta, sábado, domingo)
  if (dueDate === null) {
    const weekdayRegex =
      /(?:^|\s)\b(domingo|segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[aá]bado)\b/i;
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

  // 4e. Data explícita DD/MM (ex: 25/10)
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

  const cleanTitle = workingText.replace(/\s+/g, ' ').trim();

  return {
    cleanTitle,
    priority,
    tags: Array.from(tagsSet),
    targetListQuery,
    dueDate,
    detectedDateLabel,
  };
}
