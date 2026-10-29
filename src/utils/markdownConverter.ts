/**
 * Utilitário para conversão bidirecional e sanitização entre Markdown legado e HTML WYSIWYG
 */

export function markdownToHtml(md: string): string {
  if (!md) return '<p><br></p>';

  // Se já contiver tags estruturais HTML, retorna como está
  if (/<(h[1-6]|p|div|ul|ol|blockquote|pre|table|br|img)[\s>]/i.test(md)) {
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

    // Imagens: ![alt](src)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      closeList();
      const alt = imgMatch[1] ?? '';
      const src = imgMatch[2] ?? '';
      result.push(
        `<div class="my-2.5 text-center"><img src="${src}" alt="${alt}" class="rounded-xl max-w-full max-h-96 mx-auto object-contain border border-zinc-800 shadow-md" loading="lazy" /></div>`
      );
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
        `<div data-checklist-row="true" data-checked="${isChecked}" class="checklist-row"><button type="button" data-checklist-toggle="true" contenteditable="false" aria-label="Alternar tarefa" class="checklist-toggle"><svg class="checklist-icon" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span data-checklist-text="true" class="checklist-text">${formatInline(text) || '<br>'}</span></div>`
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
    .replace(/[☐☑]/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cria a estrutura HTML padronizada e moderna para um item de checklist
 */
export function createChecklistRowHtml(text = '', isChecked = false): string {
  const safeText = text ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '<br>';
  return `<div data-checklist-row="true" data-checked="${isChecked}" class="checklist-row"><button type="button" data-checklist-toggle="true" contenteditable="false" aria-label="Alternar tarefa" class="checklist-toggle"><svg class="checklist-icon" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span data-checklist-text="true" class="checklist-text">${safeText}</span></div>`;
}

/**
 * Normaliza marcações legadas (ex: spans com símbolos ☐/☑ ou botões antigos)
 * para a nova estrutura de checklist fluida e nativa
 */
export function normalizeChecklistHtml(html: string): string {
  if (!html) return html;

  // Substitui botões antigos ou spans com glifos unicode por SVG moderno
  return html
    .replace(
      /<span data-checklist-icon="true">\s*[☐☑]?\s*<\/span>/gi,
      '<svg class="checklist-icon" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    )
    .replace(
      /data-checklist-toggle="true"\s*contenteditable="false"\s*class="[^"]*"/gi,
      'data-checklist-toggle="true" contenteditable="false" aria-label="Alternar tarefa" class="checklist-toggle"'
    )
    .replace(
      /class="checklist-row[^"]*"/gi,
      'class="checklist-row"'
    );
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
