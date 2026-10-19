import React from 'react';

export interface BuildInfoProps {
  className?: string;
  showCommit?: boolean;
}

export const BuildInfo: React.FC<BuildInfoProps> = ({
  className = '',
  showCommit = true,
}) => {
  const rawBuildTime = import.meta.env.VITE_APP_BUILD_TIME;
  const commitHash = import.meta.env.VITE_COMMIT_HASH;

  if (!rawBuildTime) {
    return null;
  }

  let formattedDate = '';
  try {
    const date = new Date(rawBuildTime);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`;
    }
  } catch {
    formattedDate = '';
  }

  if (!formattedDate) {
    return null;
  }

  return (
    <div
      className={`text-[10px] text-zinc-500 font-mono tracking-tight select-none ${className}`}
      title={`Deploy: ${rawBuildTime}${commitHash ? ` (${commitHash})` : ''}`}
    >
      <span>Atualizado: {formattedDate}</span>
      {showCommit && commitHash ? (
        <span className="ml-1 text-zinc-600">({commitHash})</span>
      ) : null}
    </div>
  );
};
