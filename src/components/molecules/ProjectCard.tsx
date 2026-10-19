import React from 'react';
import { Calendar, ChevronRight, Trash2 } from 'lucide-react';
import { NativeBridge } from '../../lib/native';

export interface ProjectStat {
  id: string;
  name: string;
  color: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  createdAt: number;
}

interface ProjectCardProps {
  project: ProjectStat;
  onView: (projectId: string) => void;
  onDelete: (project: ProjectStat) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onView,
  onDelete,
}) => {
  const formattedDate = React.useMemo(() => {
    const d = new Date(project.createdAt);
    if (isNaN(d.getTime())) return 'Data não disponível';
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, [project.createdAt]);

  return (
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

        <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
          <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span>Criado em {formattedDate}</span>
        </div>
      </div>

    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => {
          void NativeBridge.hapticLightImpact();
          onView(project.id);
        }}
        className="w-full text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-between py-1"
      >
        <span>Ver Ações do Projeto</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
    </div>
  );
};
