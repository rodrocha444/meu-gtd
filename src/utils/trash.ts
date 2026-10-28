/**
 * Utilitários e regras de retenção para a Lixeira (TickTick Core + GTD)
 * Itens na lixeira são mantidos por 30 dias e depois apagados permanentemente de forma automática.
 */

export const TRASH_RETENTION_DAYS = 30;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Retorna se um item na lixeira já ultrapassou o período de 30 dias de retenção
 */
export function isExpiredTrash(deletedAt: number | null | undefined): boolean {
  if (!deletedAt) return false;
  return Date.now() - deletedAt >= TRASH_RETENTION_MS;
}

/**
 * Calcula quantos dias restantes o item tem antes de ser apagado definitivamente (0 a 30)
 */
export function getTrashRemainingDays(deletedAt: number | null | undefined): number {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const elapsedMs = Date.now() - deletedAt;
  const remainingMs = Math.max(0, TRASH_RETENTION_MS - elapsedMs);
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

/**
 * Formata a data de exclusão amigável em PT-BR (ex: "27 de out. às 22:50")
 */
export function formatDeletedDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
