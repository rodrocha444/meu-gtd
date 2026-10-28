# Meu GTD

> Núcleo de gerenciamento de tarefas inspirado no **TickTick** estruturado pela metodologia **GTD (Getting Things Done)**, com experiência nativa (*Native Feel*) e arquitetura *Offline-First*.

---

## ⚡ Stack Tecnológica

- **Frontend:** React 18 + Vite 6 + Tailwind CSS v4 + TypeScript (Strict Mode).
- **Mobile & Cross-Platform:** Capacitor 6 (iOS, Android, PWA/Web).
- **Dados & Offline-First:** Drizzle ORM + Turso (`@libsql/client`).
  - *Arquitetura:* Leitura/escrita primária em SQLite local (Embedded Replicas) com sincronização em background no Turso Cloud (0ms UI latency).

---

## 🚀 Funcionalidades Core

1. **Quick Capture com NLP Parser:**
   - Prioridades: `!1`, `!2`, `!3`, `!baixa`, `!media`, `!alta`, `!urgente`.
   - Listas: `~inbox`, `~"Próximas Ações"`.
   - Processamento de datas naturais em PT-BR (`hoje`, `amanhã`, `segunda`, `+3d`, `dd/mm`).
2. **Smart Views GTD:**
   - **Inbox:** Entrada não-processada.
   - **Hoje:** Tarefas para o dia atual.
   - **Próximos 7 Dias:** Planejamento semanal.
   - **Ações Seguintes:** Ações imediatas sem compromisso de data rígida.
   - **Algum Dia:** Ideias e projetos futuros.
3. **TickTick Feel & Native Mobile:**
   - Checkbox estilizado com cor por prioridade (Alta: Vermelho, Média: Amarelo, Baixa: Azul).
   - Gestos de Swipe no mobile (Direita = Concluir com Haptics; Esquerda = Triagem GTD).
   - Anti-Browser UX (bloqueio de scroll elástico no root, safe-area insets, sem menus de contexto acidentais).

---

## 📦 Scripts Disponíveis

```bash
# Iniciar servidor de desenvolvimento web
npm run dev

# Validar TypeScript e gerar build de produção
npm run build

# Gerar migrações do Drizzle ORM
npm run db:generate

# Aplicar migrações no banco Turso / SQLite
npm run db:migrate

# Abrir Drizzle Studio para inspecionar dados
npm run db:studio

# Compilar e sincronizar com plataformas móveis (Capacitor)
npm run cap:sync

# Abrir no Xcode (iOS)
npm run cap:ios

# Abrir no Android Studio (Android)
npm run cap:android
```

---

## ⚙️ Variáveis de Ambiente

Configure o arquivo `.env` (baseado em `.env.example`):

```bash
# Turso Database URL
VITE_TURSO_DATABASE_URL=libsql://meu-gtd-rodrocha444.aws-us-east-1.turso.io

# Token de autenticação Turso
VITE_TURSO_AUTH_TOKEN=seu_token_aqui

# (Opcional) Criptografia da réplica SQLite local
VITE_LOCAL_DB_ENCRYPTION_KEY=
```

---

## 🌐 Deploy no GitHub Pages via GitHub Actions

O repositório está configurado para realizar deploy contínuo no GitHub Pages através do workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Passos para ativar no repositório GitHub:
1. Acesse o repositório no GitHub: **Settings** > **Pages**.
2. Na seção **Build and deployment** > **Source**, selecione: **GitHub Actions**.
3. (Opcional) Caso utilize sincronização com o Turso Cloud na Web, adicione as credenciais em **Settings** > **Secrets and variables** > **Actions**:
   - `VITE_TURSO_DATABASE_URL`
   - `VITE_TURSO_AUTH_TOKEN`
4. A cada `push` na branch `main` (ou acionamento manual via **Run workflow** na aba **Actions**), o build será gerado e publicado automaticamente.

