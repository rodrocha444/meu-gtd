import React from 'react';
import { X, ZoomIn } from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import type { TaskImageAttachment } from '../../utils/imageUpload';
import { ImageViewerModal } from './ImageViewerModal';

interface TaskImageGalleryProps {
  images: TaskImageAttachment[];
  onRemoveImage?: (id: string) => void;
  readOnly?: boolean;
}

export const TaskImageGallery: React.FC<TaskImageGalleryProps> = ({
  images,
  onRemoveImage,
  readOnly = false,
}) => {
  const [selectedImage, setSelectedImage] = React.useState<TaskImageAttachment | null>(
    null
  );

  if (images.length === 0) return null;

  return (
    <>
      <div className="mt-2.5 pt-2.5 border-t border-zinc-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            <span>Imagens & Anexos</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] text-zinc-300">
              {images.length}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-video flex items-center justify-center cursor-pointer shadow-sm hover:border-zinc-700 transition-all"
              onClick={() => setSelectedImage(img)}
            >
              <img
                src={img.src}
                alt={img.alt}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
              />

              {/* Botão de Zoom ao passar mouse / tocar */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <ZoomIn className="w-5 h-5 text-white/90 drop-shadow" />
              </div>

              {/* Botão de Excluir */}
              {!readOnly && onRemoveImage && (
                <button
                  type="button"
                  aria-label="Remover imagem"
                  title="Remover imagem"
                  onClick={(e) => {
                    e.stopPropagation();
                    void NativeBridge.hapticLightImpact();
                    onRemoveImage(img.id);
                  }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-zinc-900/90 hover:bg-red-500 text-zinc-300 hover:text-white border border-zinc-700 shadow-md transition-all active:scale-90"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal Lightbox de Visualização em Tela Cheia com Zoom */}
      <ImageViewerModal
        isOpen={Boolean(selectedImage)}
        src={selectedImage?.src ?? null}
        alt={selectedImage?.alt}
        onClose={() => setSelectedImage(null)}
      />
    </>
  );
};
