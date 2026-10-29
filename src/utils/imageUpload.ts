/**
 * Utilitário para seleção, compressão e conversão de imagens para Base64 WebP.
 * Otimizado para arquitetura offline-first (SQLite/Turso) sem sobrecarregar o banco de dados.
 */

/**
 * Comprime uma imagem redimensionando-a e convertendo para WebP (com fallback para JPEG)
 * Gera um Base64 leve (geralmente entre 80KB e 250KB) adequado para sincronização offline.
 */
export async function compressAndConvertToBase64(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Se o arquivo já for SVG ou outro vetor, podemos ler direto
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Mantém a proporção redimensionando para o limite máximo
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        // Fundo transparente ou preto suave caso necessário
        ctx.drawImage(img, 0, 0, width, height);

        // Tenta exportar em WebP; se não suportado pelo browser, cai para JPEG
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };

      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Abre o seletor nativo de arquivos do sistema (funciona no Web, PWA e WebView do Capacitor)
 */
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      resolve(file);
      input.remove();
    };

    input.oncancel = () => {
      resolve(null);
      input.remove();
    };

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Extrai um arquivo de imagem caso o usuário tenha colado (Ctrl+V / Cmd+V) uma imagem da área de transferência
 */
export function extractImageFromClipboard(
  event: React.ClipboardEvent | ClipboardEvent
): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }

  return null;
}

/**
 * Insere texto na posição do cursor em um HTMLTextAreaElement preservando o histórico de undo
 */
export function insertTextAtCursor(
  textarea: HTMLTextAreaElement,
  textToInsert: string
): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const original = textarea.value;

  const prefix = start > 0 && original[start - 1] !== '\n' ? '\n' : '';
  const suffix = end < original.length && original[end] !== '\n' ? '\n' : '';
  const insertion = `${prefix}${textToInsert}${suffix}`;

  const updated =
    original.substring(0, start) + insertion + original.substring(end);

  textarea.value = updated;
  const newCursorPos = start + insertion.length;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  textarea.focus();
}

export interface TaskImageAttachment {
  id: string;
  alt: string;
  src: string;
}

/**
 * Separa imagens Markdown (![alt](src)) do texto da descrição
 */
export function extractImagesFromMarkdown(markdown: string): {
  cleanText: string;
  images: TaskImageAttachment[];
} {
  if (!markdown) return { cleanText: '', images: [] };

  const images: TaskImageAttachment[] = [];
  // Regex compatível com imagens Base64 e URLs externas em Markdown
  const regex = /!\[(.*?)\]\(((?:data:image\/[^)]+)|(?:https?:\/\/[^)]+)|[^\s)]+)\)/g;

  let match: RegExpExecArray | null;
  let counter = 0;
  while ((match = regex.exec(markdown)) !== null) {
    images.push({
      id: `img-${Date.now()}-${counter++}`,
      alt: match[1] || 'imagem',
      src: match[2] || '',
    });
  }

  // Remove as tags de imagens do texto, normalizando quebras de linha excedentes
  const cleanText = markdown
    .replace(regex, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanText, images };
}

/**
 * Recombina texto limpo e anexos de imagem no formato Markdown padrão
 */
export function combineMarkdownWithImages(
  cleanText: string,
  images: TaskImageAttachment[]
): string {
  const imagesMarkdown = images
    .filter((img) => Boolean(img.src))
    .map((img) => `![${img.alt || 'imagem'}](${img.src})`)
    .join('\n\n');

  if (!cleanText.trim()) return imagesMarkdown;
  if (images.length === 0) return cleanText;

  return `${cleanText.trim()}\n\n${imagesMarkdown}`;
}
