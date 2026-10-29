import type { UINoteFolder } from '../types/note';

/**
 * Verifica se `candidateChildId` é igual a `parentFolderId` ou se é um
 * descendente hierárquico (subpasta direta ou indireta) de `parentFolderId`.
 * Previne ciclos de dependência ao mover pastas.
 */
export function isDescendantFolder(
  folders: UINoteFolder[],
  parentFolderId: string,
  candidateChildId: string
): boolean {
  if (parentFolderId === candidateChildId) {
    return true;
  }

  const folderMap = new Map<string, UINoteFolder>();
  for (const f of folders) {
    folderMap.set(f.id, f);
  }

  let curr = folderMap.get(candidateChildId);
  while (curr?.parentId) {
    if (curr.parentId === parentFolderId) {
      return true;
    }
    curr = folderMap.get(curr.parentId);
  }

  return false;
}
