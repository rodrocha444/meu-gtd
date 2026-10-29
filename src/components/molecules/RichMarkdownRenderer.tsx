import React from 'react';
import { Check } from 'lucide-react';
import { NativeBridge } from '../../lib/native';

interface RichMarkdownRendererProps {
  content: string;
  onToggleChecklist?: (lineIndex: number, newChecked: boolean) => void;
  className?: string;
}

/**
 * Renderizador de formatações em linha (Inline Markdown)
 */
function renderInlineFormatting(text: string): React.ReactNode[] {
  // Regex para combinar negrito, itálico, tachado, destaque e código inline
  const tokens = text.split(
    /(\*\*.*?\*\*|\*.*?\*|~~.*?~~|==.*?==|`.*?`)/g
  );

  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={index} className="font-bold text-zinc-100">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return (
        <em key={index} className="italic text-zinc-200">
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.startsWith('~~') && token.endsWith('~~') && token.length >= 4) {
      return (
        <del key={index} className="line-through text-zinc-500">
          {token.slice(2, -2)}
        </del>
      );
    }
    if (token.startsWith('==') && token.endsWith('==') && token.length >= 4) {
      return (
        <mark
          key={index}
          className="bg-amber-400/20 text-amber-300 px-1 py-0.5 rounded border border-amber-400/30"
        >
          {token.slice(2, -2)}
        </mark>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={index}
          className="bg-zinc-800 text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono border border-zinc-700/60"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return token;
  });
}

export const RichMarkdownRenderer: React.FC<RichMarkdownRendererProps> = ({
  content,
  onToggleChecklist,
  className = '',
}) => {
  if (!content.trim()) {
    return (
      <p className="text-zinc-600 italic text-sm">Nenhum conteúdo para exibir.</p>
    );
  }

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();

    // Blocos de código multilinhas (```)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // Encerra bloco de código
        elements.push(
          <pre
            key={`code-${i}`}
            className="my-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed"
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Linha vazia
    if (!trimmed) {
      elements.push(<div key={`blank-${i}`} className="h-2" />);
      continue;
    }

    // Divisores horizontais
    if (trimmed === '---' || trimmed === '***') {
      elements.push(
        <hr key={`hr-${i}`} className="my-3 border-t border-zinc-800" />
      );
      continue;
    }

    // Imagens Markdown: ![alt](src)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1];
      const src = imgMatch[2];
      elements.push(
        <div key={`img-${i}`} className="my-3 text-center">
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="rounded-xl max-w-full max-h-96 mx-auto object-contain border border-zinc-800 shadow-md bg-zinc-950/60"
          />
          {alt && (
            <p className="text-[11px] text-zinc-500 mt-1 italic">{alt}</p>
          )}
        </div>
      );
      continue;
    }

    // Títulos H1, H2, H3
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${i}`}
          className="text-lg font-bold text-zinc-100 tracking-tight mt-3 mb-1 pb-1 border-b border-zinc-800"
        >
          {renderInlineFormatting(trimmed.slice(2))}
        </h1>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2
          key={`h2-${i}`}
          className="text-base font-bold text-zinc-200 tracking-tight mt-2.5 mb-1"
        >
          {renderInlineFormatting(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3
          key={`h3-${i}`}
          className="text-xs font-semibold uppercase tracking-wider text-violet-400 mt-2 mb-1"
        >
          {renderInlineFormatting(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    // Citações (Blockquotes)
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-2 pl-3 py-1 border-l-2 border-violet-500 bg-violet-500/10 rounded-r-xl text-zinc-300 italic text-xs leading-relaxed"
        >
          {renderInlineFormatting(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Checklists interativas (- [ ] ou - [x])
    const checklistMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/);
    if (checklistMatch) {
      const isChecked = checklistMatch[1]?.toLowerCase() === 'x';
      const text = checklistMatch[2] ?? '';
      const lineIndex = i;

      elements.push(
        <div
          key={`check-${i}`}
          data-checklist-row="true"
          data-checked={isChecked}
          className="checklist-row"
        >
          <button
            type="button"
            aria-label={isChecked ? 'Marcar como pendente' : 'Marcar como concluída'}
            onClick={() => {
              if (onToggleChecklist) {
                void NativeBridge.hapticLightImpact();
                onToggleChecklist(lineIndex, !isChecked);
              }
            }}
            className={`checklist-toggle ${isChecked ? 'is-checked' : ''}`}
          >
            <Check className="checklist-icon" />
          </button>
          <span
            onClick={() => {
              if (onToggleChecklist) {
                void NativeBridge.hapticLightImpact();
                onToggleChecklist(lineIndex, !isChecked);
              }
            }}
            className="checklist-text cursor-pointer"
          >
            {renderInlineFormatting(text)}
          </span>
        </div>
      );
      continue;
    }

    // Marcadores normais (- item ou * item)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 my-0.5 pl-1">
          <span className="text-violet-400 font-bold shrink-0 mt-0.5">•</span>
          <span className="text-sm text-zinc-300 leading-relaxed">
            {renderInlineFormatting(trimmed.slice(2))}
          </span>
        </div>
      );
      continue;
    }

    // Listas numeradas (1. item)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-2 my-0.5 pl-1">
          <span className="text-xs font-semibold text-violet-400 shrink-0 mt-0.5">
            {numMatch[1]}.
          </span>
          <span className="text-sm text-zinc-300 leading-relaxed">
            {renderInlineFormatting(numMatch[2] ?? '')}
          </span>
        </div>
      );
      continue;
    }

    // Parágrafo de texto comum
    elements.push(
      <p key={`p-${i}`} className="text-sm text-zinc-300 leading-relaxed my-0.5">
        {renderInlineFormatting(rawLine)}
      </p>
    );
  }

  return <div className={`space-y-1 font-sans ${className}`}>{elements}</div>;
};
