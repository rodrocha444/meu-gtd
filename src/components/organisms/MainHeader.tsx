import React from 'react';
import {
  ArrowRightLeft,
  CalendarRange,
  ListFilter,
  Menu,
  Trash2,
} from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { CustomSegmentedControl } from '../ui/CustomControls';
import type { UIList } from '../../types/task';

interface MainHeaderProps {
  activeView: string;
  activeViewTitle: string;
  isShowingCalendar: boolean;
  viewLayout: 'list' | 'calendar';
  onSetViewLayout: (layout: 'list' | 'calendar') => void;
  onOpenMobileDrawer: () => void;
  onOpenTriage: () => void;
  hasInboxTasks: boolean;
  completedCount: number;
  onClearCompleted: () => void;
  currentCustomProject?: UIList | null;
  onDeleteCustomProject?: () => void;
}

export const MainHeader: React.FC<MainHeaderProps> = ({
  activeView,
  activeViewTitle,
  isShowingCalendar,
  viewLayout,
  onSetViewLayout,
  onOpenMobileDrawer,
  onOpenTriage,
  hasInboxTasks,
  completedCount,
  onClearCompleted,
  currentCustomProject,
  onDeleteCustomProject,
}) => {
  return (
    <header className="px-4 pt-2.5 pb-2.5 pt-safe border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Botão para abrir o Menu Lateral no Mobile */}
          <button
            type="button"
            aria-label="Abrir Menu Lateral de Listas"
            onClick={() => {
              void NativeBridge.hapticLightImpact();
              onOpenMobileDrawer();
            }}
            className="md:hidden -ml-1 p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 active:scale-95 transition-all shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-zinc-100 truncate">
              {activeViewTitle}
            </h1>
            <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
              {activeView === 'projects'
                ? 'Revisão Semanal GTD • Garanta que todo projeto ativo tenha uma ação seguinte'
                : activeView === 'completed'
                ? 'Histórico completo de tarefas concluídas • Toque no checkbox para reativar'
                : isShowingCalendar
                ? 'Grade mensal/semanal com eventos, aniversários e repetições'
                : 'Toque para abrir detalhes • Marque o checkbox para concluir'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão Limpar Concluídas (na lista separada de Concluídas) */}
          {activeView === 'completed' && completedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                onClearCompleted();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/25 active:scale-95 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Concluídas</span>
            </button>
          )}

          {/* Botão Excluir Projeto (quando estiver visualizando um projeto customizado) */}
          {currentCustomProject && onDeleteCustomProject && (
            <button
              type="button"
              aria-label={`Excluir projeto ${currentCustomProject.name}`}
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                onDeleteCustomProject();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/25 active:scale-95 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excluir Projeto</span>
            </button>
          )}

          {/* Alternador Customizado Lista vs Calendário */}
          {activeView !== 'projects' && activeView !== 'completed' && (
            <CustomSegmentedControl<'list' | 'calendar'>
              size="sm"
              value={viewLayout}
              onChange={onSetViewLayout}
              options={[
                {
                  value: 'list',
                  label: 'Lista',
                  icon: <ListFilter className="w-3 h-3" />,
                },
                {
                  value: 'calendar',
                  label: 'Calendário',
                  icon: <CalendarRange className="w-3 h-3" />,
                },
              ]}
            />
          )}

          {activeView === 'inbox' && !isShowingCalendar && hasInboxTasks && (
            <button
              type="button"
              aria-label="Triar Inbox"
              onClick={() => {
                void NativeBridge.hapticLightImpact();
                onOpenTriage();
              }}
              className="flex items-center justify-center p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 active:scale-95 transition-all"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
