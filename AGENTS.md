# AGENTS.md — Meu GTD (TickTick Core + GTD)

Guia conciso de contexto e regras de negócio para agentes de IA e desenvolvedores. Otimizado para baixo consumo de tokens.

---

## 1. Escopo & Não-Escopo

- **Propósito:** Núcleo de gerenciamento de tarefas inspirado no **TickTick** estruturado pelo método **GTD (Getting Things Done)**.
- **FORA DE ESCOPO (Proibido adicionar):**
  - ❌ Pomodoro
  - ❌ Rastreador de hábitos
  - ❌ Bloco de notas soltas
  - ❌ Matriz de Eisenhower

---

## 2. Stack Tecnológica

- **Frontend:** React 18 + Vite 6 + Tailwind CSS v4 + TypeScript (Strict Mode).
- **Mobile/Cross-Platform:** Capacitor 6 (iOS, Android, PWA/Web).
- **Dados & Offline-First:** Drizzle ORM + Turso (`@libsql/client`).
  - *Arquitetura:* Leitura/escrita primária em SQLite local (Embedded Replicas) com sincronização em background no Turso Cloud (0ms UI latency).

---

## 3. Regras Estritas de UI/UX ("Native Feel")

1. **Anti-Browser Behavior:**
   - `user-select: none;` global; `user-select: text;` **apenas** em `input` e `textarea`.
   - `-webkit-touch-callout: none;` e `-webkit-tap-highlight-color: transparent;`.
   - `overscroll-behavior-y: none;` no root (scroll elástico travado; permitir apenas em containers `.native-scroll-container`).
   - Menu de contexto bloqueado no Web (`onContextMenu={(e) => e.preventDefault()}`).
2. **Viewport & Safe Areas:**
   - Respeitar `env(safe-area-inset-top|bottom|left|right)`.
   - `@capacitor/keyboard`: animação fluida da barra de captura via variável CSS `--keyboard-height`.
   - `@capacitor/status-bar`: tema dark translúcido.
3. **Feedback Tátil & Layout:**
   - `@capacitor/haptics`: `ImpactStyle.Medium` ao concluir tarefas; haptic leve em swipes e troca de prioridade.
   - *Bottom Sheet* deslizante no mobile; *Sidebar* retrátil no desktop.

---

## 4. Modelagem de Dados (`src/db/schema.ts`)

- **`lists`**: `id`, `name`, `color`, `icon`, `is_gtd_system` (boolean), `sort_order`, `created_at`.
  - *Listas GTD fixas:* `inbox`, `next_actions`, `waiting_for`, `someday`.
- **`tasks`**:
  - `status`: `'pending' | 'completed' | 'wont_do'`.
  - `priority`: `0` (Nenhuma), `1` (Baixa), `2` (Média), `3` (Alta).
  - `parent_task_id`: Self-reference para subtarefas/checklists.
  - `is_pinned`, `due_date`, `recurrence_rule` (RRule), `list_id`, `completed_at`.
- **`tags`**: `id`, `name` (ex: `@computador`, `@rua`, `#energia_baixa`), `color`.
- **`task_tags`**: N:N (`task_id`, `tag_id`).

---

## 5. Regras de Negócio & Funcionalidades Core

### 5.1. Quick Capture & NLP Parser (`src/utils/nlpParser.ts`)
- **Prioridade:** `!1`, `!2`, `!3`, `!baixa`, `!media`, `!alta`, `!urgente`.
- **Tags & Contextos GTD:** `@contexto` (ferramenta/local) e `#tag` (energia/tópico).
- **Lista:** `~lista` ou `~"Nome da Lista"` (default: `inbox`).
- **Datas (PT-BR):** `hoje`, `amanhã`, `depois de amanhã`, `próxima semana`, dias da semana (`segunda`..`domingo`), offsets (`+3d`) e `dd/mm`. Extrai e remove da string do título.

### 5.2. Smart Views GTD
- **Inbox:** Entrada não-processada.
- **Hoje:** Vencimento `<= hoje 23:59`.
- **Próximos 7 Dias:** Vencimento nos próximos 7 dias.
- **Ações Seguintes (Next Actions):** Tarefas acionáveis imediatas sem data rígida.
- **Aguardando (Waiting For):** Bloqueadas por terceiros / delegação.
- **Algum Dia (Someday/Maybe):** Ideias futuras sem compromisso ativo.

### 5.3. Interações & TickTick Feel
- **Checkbox por Prioridade:**
  - `3 (Alta)`: Vermelho.
  - `2 (Média)`: Amarelo.
  - `1 (Baixa)`: Azul.
  - `0 (Nenhuma)`: Cinza.
- **Status "Won't Do" (`wont_do`):** Tarefa descartada/cancelada sem marcar como concluída com sucesso.
- **Gestos de Swipe (Mobile):**
  - *Direita:* Concluir tarefa (com Haptics).
  - *Esquerda:* Abrir modal/sheet de Triagem GTD (mover lista, vincular contexto `@tag`, alterar prioridade).

---

## 6. Diretrizes para Agentes de Código

- Mantenha `strict: true` e preserve tipagens de domínio (`TaskStatus`, `TaskPriority`).
- Evite refatorações em massa desnecessárias; use diffs pontuais.
- Antes de commitar/encerrar tarefas, valide com `npm run build` (`tsc -b && vite build`).
