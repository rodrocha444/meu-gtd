/**
 * Utilitário para conversão bidirecional e sanitização entre Markdown legado e HTML WYSIWYG
 */

export function markdownToHtml(md: string): string {
  if (!md) return '<p><br></p>';

  // Se já contiver tags estruturais HTML, retorna como está
  if (/<(h[1-6]|p|div|ul|ol|blockquote|pre|table|br)[\s>]/i.test(md)) {
    return md;
  }

  const lines = md.split('\n');
  const result: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let inCode = false;
  let codeBuffer: string[] = [];

  const closeList = () => {
    if (inList) {
      result.push(inList === 'ul' ? '</ul>' : '</ol>');
      inList = null;
    }
  };

  const formatInline = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/==(.*?)==/g, '<mark>$1</mark>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();

    // Blocos de código multilinhas
    if (trimmed.startsWith('```')) {
      closeList();
      if (inCode) {
        result.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
        codeBuffer = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }

    if (!trimmed) {
      closeList();
      result.push('<p><br></p>');
      continue;
    }

    // Divisores
    if (trimmed === '---' || trimmed === '***') {
      closeList();
      result.push('<hr>');
      continue;
    }

    // Títulos
    if (trimmed.startsWith('# ')) {
      closeList();
      result.push(`<h1>${formatInline(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      closeList();
      result.push(`<h2>${formatInline(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      closeList();
      result.push(`<h3>${formatInline(trimmed.slice(4))}</h3>`);
      continue;
    }

    // Citações
    if (trimmed.startsWith('> ')) {
      closeList();
      result.push(`<blockquote>${formatInline(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    // Checklists
    const checkMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/);
    if (checkMatch) {
      closeList();
      const isChecked = checkMatch[1]?.toLowerCase() === 'x';
      const text = checkMatch[2] ?? '';
      result.push(
        `<div data-checklist-row="true" data-checked="${isChecked}" class="checklist-row flex items-start gap-2.5 my-1.5 ${
          isChecked ? 'opacity-60' : ''
        }"><button type="button" data-checklist-toggle="true" contenteditable="false" class="w-4 h-4 rounded-md border ${
          isChecked
            ? 'border-violet-600 bg-violet-600 text-white'
            : 'border-zinc-600 bg-zinc-900 text-violet-400'
        } text-xs flex items-center justify-center shrink-0 mt-0.5 cursor-pointer"><span data-checklist-icon="true">${
          isChecked ? '☑' : '☐'
        }</span></button><span data-checklist-text="true" class="flex-1 outline-none ${
          isChecked ? 'line-through text-zinc-500' : ''
        }">${formatInline(text)}</span></div>`
      );
      continue;
    }

    // Listas com marcadores
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (inList !== 'ul') {
        closeList();
        result.push('<ul>');
        inList = 'ul';
      }
      result.push(`<li>${formatInline(trimmed.slice(2))}</li>`);
      continue;
    }

    // Listas numeradas
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      if (inList !== 'ol') {
        closeList();
        result.push('<ol>');
        inList = 'ol';
      }
      result.push(`<li>${formatInline(numMatch[2] ?? '')}</li>`);
      continue;
    }

    // Linha comum
    closeList();
    result.push(`<p>${formatInline(rawLine)}</p>`);
  }

  closeList();
  return result.join('');
}

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countChecklistInContent(content: string): {
  total: number;
  completed: number;
} {
  if (!content) return { total: 0, completed: 0 };

  // Detecta checkboxes em HTML
  const htmlCheckMatches = content.match(/data-checklist-row="true"/gi);
  if (htmlCheckMatches && htmlCheckMatches.length > 0) {
    const total = htmlCheckMatches.length;
    const completedMatches = content.match(/data-checked="true"/gi);
    const completed = completedMatches ? completedMatches.length : 0;
    return { total, completed };
  }

  // Fallback: detecta checkboxes em Markdown (- [ ] / - [x])
  const mdMatches = content.match(/^-\s*\[([ xX])\]/gm);
  if (mdMatches && mdMatches.length > 0) {
    const total = mdMatches.length;
    const completed = mdMatches.filter((m) =>
      m.toLowerCase().includes('[x]')
    ).length;
    return { total, completed };
  }

  return { total: 0, completed: 0 };
}
