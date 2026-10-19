import React from 'react';
import {
  FolderKanban,
  Plus,
  X,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { SMART_VIEW_ITEMS } from '../../constants/priority';
import { SyncStatusButton } from '../molecules/SyncStatusButton';
import { BuildInfo } from '../atoms/BuildInfo';
import type { UIList } from '../../types/task';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: string;
  onSelectView: (viewId: string) => void;
  lists: UIList[];
  syncState: 'synced' | 'syncing' | 'offline';
  pendingCount?: number;
  onSync: () => void;
  onCreateProject: () => void;
  getTaskCountForView: (viewId: string) => number;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  activeView,
  onSelectView,
  lists,
  syncState,
  pendingCount,
  onSync,
  onCreateProject,
  getTaskCountForView,
}) => {
  const customProjects = lists.filter((l) => !l.isGtdSystem);

  return (
    <>
      {/* Backdrop com fade */}
      <div
        role="presentation"
        onClick={() => {
          void NativeBridge.hapticLightImpact();
          onClose();
        }}
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer Panel Deslizante */}
      <aside
        aria-label="Menu Lateral de Listas"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-zinc-950 border-r border-zinc-800/80 flex flex-col shadow-2xl transition-transform duration-300 ease-out md:hidden pt-safe pb-safe ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}icon.svg`}
              alt="Meu GTD"
              className="w-5 h-5 rounded-md shrink-0"
            />
            <span className="font-bold tracking-tight text-sm text-zinc-100">
              Meu GTD
            </span>
          </div>
          <button
            type="button"
            aria-label="Fechar Menu"
            onClick={() => {
              void NativeBridge.hapticLightImpact();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 native-scroll-container p-2.5 space-y-1">
          {SMART_VIEW_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const count = getTaskCountForView(item.id);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  void NativeBridge.hapticLightImpact();
                  onSelectView(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                <span className="truncate flex-1 text-left">{item.label}</span>
                {count > 0 && (
                  <span className="text-[11px] text-zinc-400 font-semibold px-2 py-0.5 rounded-full bg-zinc-800/80">
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          <div className="my-2 border-t border-zinc-800/60" />

          {/* Cabeçalho da Seção de Projetos GTD */}
          <div className="pt-2 pb-1 px-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                onSelectView('projects');
                onClose();
              }}
              className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                activeView === 'projects'
                  ? 'text-pink-400 font-bold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span>Projetos GTD</span>
              {customProjects.length > 0 && (
                <span className="text-[10px] font-normal text-zinc-600">
                  ({customProjects.length})
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="Criar Novo Projeto GTD"
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                onClose();
                onCreateProject();
              }}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Novo Projeto"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {customProjects.map((project) => {
            const count = getTaskCountForView(project.id);

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  void NativeBridge.hapticLightImpact();
                  onSelectView(project.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  activeView === project.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <FolderKanban
                  className="w-4 h-4 shrink-0"
                  style={{ color: project.color }}
                />
                <span className="truncate flex-1 text-left">{project.name}</span>
                {count > 0 && (
                  <span className="text-[11px] text-zinc-400 font-semibold px-2 py-0.5 rounded-full bg-zinc-800/80">
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {customProjects.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-zinc-500 italic">
              Nenhum projeto criado
            </p>
          )}
        </nav>

        {/* Status do Turso Embedded Replica */}
        <div className="p-3 border-t border-zinc-800/80 flex flex-col gap-2">
          <SyncStatusButton
            syncState={syncState}
            pendingCount={pendingCount}
            showLabel={true}
            onClick={onSync}
          />
          <BuildInfo className="text-center px-1" />
        </div>
      </aside>
    </>
  );
};
