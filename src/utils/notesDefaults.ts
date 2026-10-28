import type { UINote, UINoteFolder } from '../types/note';

export function getDefaultNoteFolders(): UINoteFolder[] {
  const now = Date.now();
  return [
    {
      id: 'folder-procedimentos',
      name: 'Procedimentos Operacionais',
      color: '#3b82f6',
      icon: 'shield',
      parentId: null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'folder-legislacao',
      name: 'Legislação & Normas',
      color: '#10b981',
      icon: 'book',
      parentId: null,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'folder-geral',
      name: 'Geral & Rascunhos',
      color: '#8b5cf6',
      icon: 'file-text',
      parentId: null,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function getDefaultNotes(): UINote[] {
  const now = Date.now();
  return [
    {
      id: 'note-1',
      title: 'Briefing Operacional & Modulação de Rádio',
      content: `### Modulação e Código Q
- **QAP**: Na escuta / pronto para receber
- **QRV**: À disposição
- **TKS**: Obrigado
- **QTH**: Localização atual

### Checklist de Início de Turno (VTR)
1. Cautelar armamento e colete na Reserva de Armas.
2. Inspecionar nível de óleo, estepe, giroflex e sirene da viatura.
3. Testar comunicação de rádio HT com a rede de operações.`,
      folderId: 'folder-procedimentos',
      isPinned: true,
      color: null,
      sortOrder: 0,
      createdAt: now - 3600000 * 24,
      updatedAt: now - 3600000 * 2,
    },
    {
      id: 'note-2',
      title: 'Prazos de Remessa e Registro de BOPM',
      content: `### Elaboração de BOPM
- Ocorrências com flagrante delito devem ter o BOPM protocolado e entregue no Cartório / Central de Flagrantes antes do encerramento do turno de serviço.
- Descrever com precisão a individualização das condutas e objetos apreendidos com os respectivos números de lacre da cadeia de custódia.`,
      folderId: 'folder-legislacao',
      isPinned: false,
      color: null,
      sortOrder: 1,
      createdAt: now - 3600000 * 48,
      updatedAt: now - 3600000 * 12,
    },
    {
      id: 'note-3',
      title: 'Metas para o TAF (Treinamento Físico)',
      content: `### Parâmetros para Pontuação Máxima
- **Corrida 12 min**: meta de 2.800 metros
- **Barra fixa**: 8 repetições estritas
- **Abdominal remador**: 42 repetições em 60 segundos
- **Rotina**: treinos terças e quintas após o período de descanso da escala.`,
      folderId: 'folder-geral',
      isPinned: false,
      color: null,
      sortOrder: 2,
      createdAt: now - 3600000 * 72,
      updatedAt: now - 3600000 * 24,
    },
  ];
}
