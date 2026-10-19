import React from 'react';
import { Check, CheckCircle2, AlertCircle, Plus, ChevronRight, Trash2 } from 'lucide-react';
import { NativeBridge } from '../../lib/native';

export interface ProjectStat {
  id: string;
  name: string;
  color: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  percentCompleted: number;
}

interface ProjectCardProps {
  project: ProjectStat;
  onView: (projectId: string) => void;
  onAddAction: (projectName: string) => void;
  onDelete: (project: ProjectStat) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onView,
  onAddAction,
  onDelete,
}) => (
  <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between shadow-lg">
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <h3 className="text-sm font-bold text-zinc-100 truncate">{project.name}</h3>
        </div>
        <button
          type="button"
          aria-label={`Excluir projeto ${project.name}`}
          onClick={() => {
            void NativeBridge.hapticLightImpact();
            onDelete(project);
          }}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {project.pendingTasks > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            Ativo ({project.pendingTasks} {project.pendingTasks === 1 ? 'ação pendente' : 'ações pendentes'})
          </span>
        ) : project.totalTasks > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
            <Check className="w-3 h-3" />
            Todas as ações concluídas
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <AlertCircle className="w-3 h-3" />
            Parado / Sem Próxima Ação
          </span>
        )}
      </div>

      {project.totalTasks > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-zinc-400 mb-1 font-medium">
            <span>Progresso: {project.percentCompleted}%</span>
            <span>{project.completedTasks}/{project.totalTasks} concluídas</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${project.percentCompleted}%`,
                backgroundColor: project.color,
              }}
            />
          </div>
        </div>
      )}
    </div>

    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => {
          void NativeBridge.hapticLightImpact();
          onView(project.id);
        }}
        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
      >
        <span>Ver Ações do Projeto</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          void NativeBridge.hapticLightImpact();
          onAddAction(project.name);
        }}
        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-zinc-200 flex items-center gap-1"
      >
        <Plus className="w-3 h-3" />
        <span>+ Ação</span>
      </button>
    </div>
  </div>
);
