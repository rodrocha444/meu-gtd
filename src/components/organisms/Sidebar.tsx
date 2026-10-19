import React from 'react';
import {
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { SMART_VIEW_ITEMS } from '../../constants/priority';
import { SyncStatusButton } from '../molecules/SyncStatusButton';
import type { UIList } from '../../types/task';

interface SidebarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeView: string;
  onSelectView: (viewId: string) => void;
  lists: UIList[];
  syncState: 'synced' | 'syncing' | 'offline';
  pendingCount?: number;
  onSync: () => void;
  onCreateProject: () => void;
  getTaskCountForView: (viewId: string) => number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen,
  onToggleSidebar,
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
    <aside
      className={`hidden md:flex flex-col border-r border-zinc-800/80 bg-zinc-900/50 transition-all duration-200 shrink-0 ${
        sidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800/80">
        {sidebarOpen && (
          <div className="flex items-center gap-2.5">
            <img
              src="/icon.svg"
              alt="GTD Flow"
              className="w-5 h-5 rounded-md shrink-0"
            />
            <span className="font-bold tracking-tight text-sm">Meu GTD</span>
          </div>
        )}
        <button
          type="button"
          aria-label="Alternar Sidebar"
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 native-scroll-container p-2 space-y-1">
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
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
              {sidebarOpen && (
                <>
                  <span className="truncate flex-1 text-left">{item.label}</span>
                  {count > 0 && (
                    <span className="text-[11px] text-zinc-400 font-semibold px-2 py-0.5 rounded-full bg-zinc-800/80">
                      {count}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}

        {/* Separador entre Listas GTD Inteligentes e Projetos */}
        <div className="my-2 border-t border-zinc-800/60" />

        {/* Seção de Projetos GTD */}
        {sidebarOpen ? (
          <div className="pt-2 pb-1 px-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                onSelectView('projects');
              }}
              className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                activeView === 'projects'
                  ? 'text-pink-400 font-bold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Abrir visão geral de projetos"
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
                onCreateProject();
              }}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Novo Projeto"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Visão Geral de Projetos GTD"
            onClick={() => {
              void NativeBridge.hapticLightImpact();
              onSelectView('projects');
            }}
            className={`w-full flex items-center justify-center py-2.5 rounded-xl text-xs font-medium transition-colors ${
              activeView === 'projects'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="Projetos GTD"
          >
            <FolderKanban className="w-4 h-4 shrink-0 text-pink-400" />
          </button>
        )}

        {customProjects.map((project) => {
          const count = getTaskCountForView(project.id);

          return (
            <button
              key={project.id}
              type="button"
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                onSelectView(project.id);
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
              {sidebarOpen && (
                <>
                  <span className="truncate flex-1 text-left">{project.name}</span>
                  {count > 0 && (
                    <span className="text-[11px] text-zinc-400 font-semibold px-2 py-0.5 rounded-full bg-zinc-800/80">
                      {count}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}

        {sidebarOpen && customProjects.length === 0 && (
          <p className="px-3 py-2 text-[11px] text-zinc-500 italic">
            Nenhum projeto criado
          </p>
        )}
      </nav>

      {/* Status do Turso Embedded Replica */}
      <div className="p-3 border-t border-zinc-800/80">
        <SyncStatusButton
          syncState={syncState}
          pendingCount={pendingCount}
          showLabel={sidebarOpen}
          onClick={onSync}
        />
      </div>
    </aside>
  );
};
