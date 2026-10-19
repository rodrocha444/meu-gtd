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
4. **Componentes 100% Personalizáveis (Proibido Componentes Legados da Web):**
   - ❌ **Proibido usar controles nativos legados do browser:** `<select>`, `<option>`, `<input type="date">`, `<input type="time">`, `<input type="color">`, `<input type="number">` com spinners nativos, `alert()`, `confirm()`, `prompt()` ou tooltips nativos via atributo `title`.
   - ✅ **Obrigatório usar componentes customizados (`src/components/ui/CustomControls.tsx`):** `CustomSelect`, `CustomSegmentedControl`, `CustomDatePicker` (mini-calendário próprio), `CustomRecurrencePicker`, steppers customizados e sheets/popovers próprios estilizados no tema dark nativo.

---

## 3.5. Arquitetura de Componentes — Atomic Design ⚛️

**Regra fundamental: reutilizar antes de recriar.** Antes de criar qualquer componente novo, verifique se já existe um equivalente ou se um existente pode ser estendido via props.

### Estrutura de Pastas Obrigatória

```
src/components/
├── atoms/          # Unidades mínimas, sem dependências internas
├── molecules/      # Combinação de 2+ átomos com lógica simples
├── organisms/      # Seções complexas com lógica de negócio
├── templates/      # Layouts de página sem dados reais
└── ui/             # Controles customizados globais (CustomControls, modais, etc.)
```

### Definição das Camadas

| Camada | O que é | Exemplos |
|---|---|---|
| **Atom** | Elemento UI indivisível, sem lógica de negócio. Aceita apenas props primitivas. | `Checkbox`, `Badge`, `Icon`, `PriorityDot`, `Tag`, `Button`, `Avatar` |
| **Molecule** | Composição de átomos com lógica de apresentação simples. | `TaskRow`, `TagChip`, `DateBadge`, `SwipeableRow`, `EmptyState` |
| **Organism** | Seção autônoma com acesso a estado/contexto e lógica de negócio. | `TaskList`, `QuickCaptureBar`, `Sidebar`, `CalendarGrid`, `TaskDetailSheet` |
| **Template** | Esqueleto de página (layout puro, sem dados). | `AppShell`, `MobileLayout`, `DesktopLayout` |
| **UI (global)** | Controles de formulário customizados reutilizáveis em qualquer camada. | `CustomSelect`, `CustomDatePicker`, `CustomRecurrencePicker`, `BottomSheet` |

### Regras de Criação

1. **Antes de criar** → busque em `atoms/`, `molecules/`, `organisms/` e `ui/`.
2. **Atomic flow:** Átomos **não** importam Moléculas nem Organismos. Moléculas **não** importam Organismos. Dependência sempre **de baixo para cima** (atoms → molecules → organisms → templates).
3. **Props sobre duplicação:** Se um componente existente precisa de uma variação pequena, adicione uma prop (`variant`, `size`, `color`) em vez de criar um novo arquivo.
4. **Um arquivo por componente:** Cada componente tem seu próprio arquivo nomeado em PascalCase igual ao nome do componente exportado.
5. **Sem lógica de negócio em átomos/moléculas:** Acesso a banco, hooks de dados e chamadas de serviço ficam exclusivamente em Organismos ou acima.
6. **Quebrar arquivos grandes:** Componentes com mais de ~150 linhas ou que misturam responsabilidades devem ser refatorados, extraindo sub-componentes na camada correta.

---

## 4. Modelagem de Dados (`src/db/schema.ts`)

- **`lists`**: `id`, `name`, `color`, `icon`, `is_gtd_system` (boolean), `sort_order`, `created_at`.
  - *Listas GTD fixas:* `inbox`, `next_actions`, `waiting_for`, `someday`.
- **`tasks`**:
  - `status`: `'pending' | 'completed'`.
  - `priority`: `0` (Nenhuma), `1` (Baixa), `2` (Média), `3` (Alta).
  - `parent_task_id`: Self-reference para subtarefas/checklists.
  - `is_pinned`, `due_date`, `recurrence_rule` (RRule RFC 5545), `recurrence_mode` (`'fixed' | 'after_completion'`), `list_id`, `completed_at`.
- **`tags`**: `id`, `name` (ex: `@computador`, `@rua`, `#energia_baixa`), `color`.
- **`task_tags`**: N:N (`task_id`, `tag_id`).

---

## 5. Regras de Negócio & Funcionalidades Core

### 5.1. Quick Capture & NLP Parser (`src/utils/nlpParser.ts`)
- **Prioridade:** `!1`, `!2`, `!3`, `!baixa`, `!media`, `!alta`, `!urgente`.
- **Tags & Contextos GTD:** `@contexto` (ferramenta/local) e `#tag` (energia/tópico).
- **Lista:** `~lista` ou `~"Nome da Lista"` (default: `inbox`).
- **Datas (PT-BR):** `hoje`, `amanhã`, `depois de amanhã`, `próxima semana`, dias da semana (`segunda`..`domingo`), offsets (`+3d`) e `dd/mm`. Extrai e remove da string do título.
- **Recorrência (PT-BR):** `todo dia`, `toda semana`, `todo mês`, `todo ano` / `anual`, `a cada N dias|semanas|meses|anos`, e modificador `após concluir`.

### 5.2. Smart Views GTD & Calendário
- **Inbox:** Entrada não-processada.
- **Hoje:** Vencimento `<= hoje 23:59`.
- **Próximos 7 Dias:** Vencimento nos próximos 7 dias.
- **Calendário (`calendar`):** Visualização em grade Mensal ou Semanal com tarefas agendadas, eventos/aniversários e projeção de ocorrências recorrentes.
- **Ações Seguintes (Next Actions):** Tarefas acionáveis imediatas sem data rígida.
- **Aguardando (Waiting For):** Bloqueadas por terceiros / delegação.
- **Algum Dia (Someday/Maybe):** Ideias futuras sem compromisso ativo.
- **Concluídas (`completed`):** Lista separada e histórico centralizado de tarefas concluídas, além de agrupamento em seção retrátil "Concluídas (N)" nas listas ativas.

### 5.3. Sistema de Repetições (`src/utils/recurrence.ts`)
- **Recorrência Padrão (`fixed` / Por Data Fixa):** Calcula a próxima ocorrência a partir do `due_date` original (ideal para aniversários anuais, contas mensais, eventos fixos).
- **Recorrência por Dia de Conclusão (`after_completion` / Após Concluir):** Calcula a próxima ocorrência somando o intervalo a partir da data em que a tarefa foi efetivamente concluída (`completed_at`).
- Ao concluir uma tarefa recorrente, a ocorrência atual é concluída e a próxima ocorrência pendente é gerada automaticamente na nova data calculada.

### 5.4. Interações & TickTick Feel
- **Checkbox por Prioridade:**
  - `3 (Alta)`: Vermelho.
  - `2 (Média)`: Amarelo.
  - `1 (Baixa)`: Azul.
  - `0 (Nenhuma)`: Cinza.
- **Gestos de Swipe (Mobile):**
  - *Direita:* Concluir tarefa (com Haptics).
  - *Esquerda:* Abrir modal/sheet de Triagem GTD (mover lista, vincular contexto `@tag`, alterar prioridade, data e recorrência).

---

## 6. Diretrizes para Agentes de Código

- Mantenha `strict: true` e preserve tipagens de domínio (`TaskStatus`, `TaskPriority`, `RecurrenceMode`).
- Sempre utilize componentes customizados em vez de elementos nativos legados da web (`<select>`, `<input type="date">`, etc.).
- **Siga obrigatoriamente o Atomic Design (seção 3.5):** todo novo componente deve ser classificado e criado na pasta correta (`atoms/`, `molecules/`, `organisms/`, `templates/`, `ui/`).
- **Reutilizar antes de recriar:** antes de qualquer novo componente, verifique os existentes. Se possível, estenda via props.
- Evite refatorações em massa desnecessárias; use diffs pontuais.
- Antes de commitar/encerrar tarefas, valide com `npm run build` (`tsc -b && vite build`).

