# Regras de trabalho

- Sou iniciante no uso do Claude Code. Se faltar ferramenta (Docker Desktop, .NET SDK 10, Node, Git), pare e diga exatamente o que instalar, em passos simples.
- Nunca execute comandos git (commit, tag, branch, reset, checkout etc.): apenas altere arquivos. Não mexa na tag "antes-da-reestruturacao" nem nos commits existentes.
- O PERE está publicado em https://pere-estudos.vercel.app (Vercel + Neon). Mudanças de publicação ou do banco de produção só com pedido explícito. Os dados do banco local são de teste e podem ser apagados.
- Faça só o que foi pedido. Se uma decisão que mude comportamento não estiver clara, pergunte.
- Código simples, legível e bem formatado, sem abstrações desnecessárias; comentários (em inglês) só onde o "porquê" não for óbvio. Textos da interface e documentação em português.
- Ao terminar: confirme que build, lint e testes passam e dê um relatório CURTO (o que mudou, como verificar, pendências).

# O projeto

PERE (Plataforma Educacional de Repetição Espaçada). Professores criam módulos de conceitos e turmas; alunos de turma estudam em sessões de até 10 atividades escolhidas automaticamente (recuperação ativa + repetição espaçada FSRS); visitantes estudam módulos da comunidade com o progresso só no navegador. O README.md descreve o produto e como rodar; docs/DESENVOLVIMENTO.md traz pré-requisitos, comandos, variáveis de ambiente e solução de problemas.

## Stack

- Backend: ASP.NET Core 10, EF Core 10 + Npgsql, PostgreSQL 17 (docker-compose.yml), Fsrs.Sharp (FSRS-6), xUnit.
- Frontend: Angular 22 (standalone, signals, zoneless, controle de fluxo novo, rotas lazy, TypeScript estrito), Tailwind CSS v4 sem Preflight, Angular CDK, ESLint + Prettier, Vitest (só o motor do visitante), ts-fsrs. Node ^22.22.3, ^24.15.0 ou >=26.

## Estrutura

- `backend/StudyPlatform.Api`: Program.cs (DI, cookie "PERE.Auth" de 8 h só com claims, antiforgery PERE-XSRF/X-CSRF-TOKEN validado pelo CsrfValidationMiddleware, rate limiter em login/cadastro/entrada em turma, tarefas opcionais de inicialização). Controllers/ (Auth, Modules, Classrooms, StudySessions em /api/student, Community, PublicCommunity em /api/public sem login, TeacherDashboard, TeacherProfile). Services/Learning (StudySessionService, ActivitySelectionService, LearningProgressionService, FsrsService, PerformanceRatingService, PrerequisiteService, ModuleContentCache, catálogo e cruzadinha do aluno), Services/Modules (ModuleService, ModuleTransferService com o formato schemaVersion 1, PublicCommunityService com cache e ETag), Services/Classrooms (turmas e matrículas), Services/Auth, Services/Progress. Seed/ (DemoSeeder e demo-module.json). Migrations/ tem uma única migration Initial.
- `backend/Tests/StudyPlatform.Tests`: testes unitários do motor (LearningEngineUnitTests).
- `frontend/src/app`: core/ (API, auth, CSRF, interceptors, tema, StudySource), pages/ (auth, student, teacher), layouts/, minigames/ (5 minigames + cruzadinha), shared/ (componentes e gráficos), visitor/ (modo visitante: motor em engine/, IndexedDB). Tema em src/theme.css, classes comuns em src/components.css.
- `docs/`: exemplo do formato de módulo. `.github/workflows/ci.yml`: CI.

## Domínio e regras

- Professor; Module (Draft/Published/Archived; cópias na comunidade têm IsCommunityListing); Concept (palavras-chave, pistas, Verdadeiro/Falso, Lacunas, Ordenação, pré-requisitos, palavra de cruzadinha); Classroom (código regenerável); Student é conta própria (e-mail + senha) e entra em turma por Enrollment (Pending/Approved/Rejected); o estudo exige matrícula aprovada em turma ativa com o módulo publicado.
- Progresso por aluno + conceito (StudentConceptState). Estados: NEW → EXPOSURE → RECOGNITION → GUIDED_RECALL → FREE_RECALL → MASTERED; pré-requisitos precisam estar MASTERED. O backend é a autoridade para alunos de turma. Prática livre não altera o progresso oficial.
- O motor do visitante (frontend/src/app/visitor/engine) replica as regras do backend: qualquer mudança nas regras de estudo precisa ser feita nos dois lados (diferenças conhecidas em frontend/README.md).
- Desempenho: numa publicação futura no Neon gratuito, a transferência de rede (5 GB/mês) é o limite principal. Evite leituras desnecessárias do banco (há cache do conteúdo dos módulos e dos dados públicos).

## Comandos principais (na raiz)

- Banco: `docker compose up -d postgres` · reset: `docker compose down -v`
- Tabelas: `dotnet ef database update --project backend/StudyPlatform.Api/StudyPlatform.Api.csproj --startup-project backend/StudyPlatform.Api/StudyPlatform.Api.csproj` (a API não aplica migrations sozinha, salvo com PERE_APPLY_MIGRATIONS=true)
- API: `dotnet run --project backend/StudyPlatform.Api/StudyPlatform.Api.csproj` (porta 5080; PERE_SEED_DEMO=true cria os dados de demonstração). Pare a API antes de comandos `dotnet ef migrations`.
- Frontend: `cd frontend; npm install; npm start` (porta 4200, proxy de /api para 5080)
- Tudo em contêineres: `docker compose up -d --build` → http://localhost:8080
- Verificações: `dotnet build` e `dotnet test backend/Tests/StudyPlatform.Tests/StudyPlatform.Tests.csproj`, `dotnet format backend/StudyPlatform.Api/StudyPlatform.Api.csproj --verify-no-changes`; no frontend `npm run lint`, `npm run format:check`, `npm test`, `npm run build`.

## Fora de escopo (decidido)

Gamificação, login com Google, PWA/offline, editor de módulos para aluno, mudanças de regra ou de comportamento dos minigames (o visual pode mudar), mudar onde fica a cruzadinha, publicação (Vercel/Neon) sem pedido explícito.

## Guia visual
- Uma ação principal por área: só ela usa o botão cheio na cor de destaque (`btn-primary`). As outras são secundárias (`btn`, contorno) ou discretas (`btn-ghost`, só texto). Ações destrutivas nunca são principais: usam `btn-danger` (contorno/texto vermelho, sem fundo cheio).
- Hierarquia por tamanho, peso e cor juntos. Nos minigames, o conteúdo da atividade (afirmação, frase, pistas, itens) é sempre o texto mais destacado da tela; rótulos, contadores e instruções são menores e em cor atenuada.
- Menos caixas: não colocar card com borda e sombra dentro de outro card. Agrupar com fundo (`surface-2`) ou espaçamento.
- Cores em 60-30-10: neutros quentes nos fundos, superfícies e texto no meio, destaque em ~10% (bege no tema escuro, marrom no claro). Ardósia (`--select`) só para seleção e destino em jogos. Verde, vermelho e ocre só para estado (acerto, erro, aviso).
- Instruções longas vão para ajuda contextual (botão "?" ao lado do jogo), mas a interface precisa se explicar sozinha por estados visuais (item selecionado, destino possível, item usado). A ajuda nunca é a única forma de entender a tarefa.
- Alvos clicáveis com pelo menos 44px nos minigames e 40px no resto. Foco sempre visível (contorno de 2–3px com contraste ≥ 3:1).
- Tipografia: Lexend para títulos e enunciados das atividades (`font-display`); Atkinson Hyperlegible Next para texto e interface (`font-sans`). Não usar fonte serifada.
- Raios: 0.5rem em controles (botões, campos, chips), 0.75rem em cards, 1rem em painéis grandes e diálogos, 999px em pílulas.
- Sombras: nenhuma em cards no tema escuro (a elevação vem do tom da superfície); no claro, só `0 1px 2px` sutil. Menus e diálogos podem ter sombra maior nos dois temas.
