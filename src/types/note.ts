export interface UINoteFolder {
  id: string;
  name: string;
  color: string;
  icon?: string;
  parentId?: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface UINote {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  isPinned: boolean;
  color?: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}
