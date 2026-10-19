import React from 'react';
import { FolderKanban, FolderPlus } from 'lucide-react';
import { NativeBridge } from '../../lib/native';
import { ProjectCard, type ProjectStat } from '../molecules/ProjectCard';

interface ProjectsHubProps {
  projectStats: ProjectStat[];
  onSelectView: (viewId: string) => void;
  onAddAction: (projectName: string) => void;
  onDeleteProject: (project: ProjectStat) => void;
  onCreateProject: () => void;
}

export const ProjectsHub: React.FC<ProjectsHubProps> = ({
  projectStats,
  onSelectView,
  onAddAction,
  onDeleteProject,
  onCreateProject,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Projetos Ativos ({projectStats.length})
          </h2>
        </div>
        <button
          type="button"
          aria-label="Criar Novo Projeto"
          onClick={() => {
            void NativeBridge.hapticLightImpact();
            onCreateProject();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg active:scale-95 transition-all"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Novo Projeto</span>
        </button>
      </div>

      {projectStats.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center px-6">
          <FolderKanban className="w-12 h-12 text-zinc-600 mb-3" />
          <p className="text-sm font-medium text-zinc-300">
            Nenhum projeto cadastrado
          </p>
          <p className="text-xs text-zinc-500 mt-1 max-w-xs">
            No GTD, projetos são resultados que exigem mais de uma ação física.
            Crie seu primeiro projeto para desdobrá-lo em ações seguintes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projectStats.map((proj) => (
            <ProjectCard
              key={proj.id}
              project={proj}
              onView={onSelectView}
              onAddAction={onAddAction}
              onDelete={onDeleteProject}
            />
          ))}
        </div>
      )}
    </div>
  );
};
