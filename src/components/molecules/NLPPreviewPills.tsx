import React from 'react';
import { Flag, Repeat } from 'lucide-react';
import { getPriorityMeta } from '../../constants/priority';
import type { ParsedQuickTask } from '../../utils/nlpParser';

interface NLPPreviewPillsProps {
  parsed: ParsedQuickTask;
}

export const NLPPreviewPills: React.FC<NLPPreviewPillsProps> = ({ parsed }) => {
  const hasPreview =
    parsed.priority > 0 ||
    parsed.tags.length > 0 ||
    parsed.targetListQuery !== null ||
    parsed.detectedDateLabel !== null ||
    parsed.detectedRecurrenceLabel !== null;

  if (!hasPreview) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-1.5 px-1">
      {parsed.priority > 0 && (
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${
            getPriorityMeta(parsed.priority).badgeClass
          }`}
        >
          <Flag className="w-3 h-3" />
          Prioridade {getPriorityMeta(parsed.priority).label}
        </span>
      )}
      {parsed.targetListQuery && (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30 font-medium">
          ~{parsed.targetListQuery}
        </span>
      )}
      {parsed.tags.map((t) => (
        <span
          key={t}
          className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium"
        >
          {t}
        </span>
      ))}
      {parsed.detectedDateLabel && (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
          📅 {parsed.detectedDateLabel}
        </span>
      )}
      {parsed.detectedRecurrenceLabel && (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium flex items-center gap-1">
          <Repeat className="w-3 h-3" />
          {parsed.detectedRecurrenceLabel}
        </span>
      )}
    </div>
  );
};
