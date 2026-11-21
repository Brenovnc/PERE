# Regras de trabalho

- Sou iniciante no uso do Claude Code. Se faltar ferramenta (Docker Desktop, .NET SDK 10, Node, Git), pare e diga exatamente o que instalar, em passos simples.
- Nunca execute comandos git (commit, tag, branch, reset, checkout etc.): apenas altere arquivos. Não mexa na tag "antes-da-reestruturacao" nem nos commits existentes.
- Tudo é LOCAL por enquanto: não configure nem altere publicação (Vercel/Neon) sem pedido explícito. Os dados do banco local são de teste e podem ser apagados.
- Faça só o que foi pedido. Se uma decisão que mude comportamento não estiver clara, pergunte.
- Código simples, legível e bem formatado, sem abstrações desnecessárias; comentários (em inglês) só onde o "porquê" não for óbvio. Textos da interface e documentação em português.
- Ao terminar: confirme que build, lint e testes passam e dê um relatório CURTO (o que mudou, como verificar, pendências).

# O projeto

PERE (Plataforma Educacional de Repetição Espaçada), projeto de portfólio. Professores criam módulos de conceitos e turmas; alunos de turma estudam em sessões de até 10 atividades escolhidas automaticamente (recuperação ativa + repetição espaçada FSRS); visitantes estudam módulos da comunidade com o progresso só no navegador. O README.md descreve o produto, os comandos e a solução de problemas.

## Stack

- Backend: ASP.NET Core 10, EF Core 10 + Npgsql, PostgreSQL 17 (docker-compose.yml), Fsrs.Sharp (FSRS-6), xUnit.
- Frontend: Angular 22 (standalone, signals, zoneless, controle de fluxo novo, rotas lazy, TypeScript estrito), Tailwind CSS v4 sem Preflight, Angular CDK, ESLint + Prettier, Vitest (só o motor do visitante), ts-fsrs. Node ^22.22.3, ^24.15.0 ou >=26.

## Estrutura

- `backend/StudyPlatform.Api`: Program.cs (DI, cookie "CAE.Auth" de 8 h só com claims, antiforgery CAE-XSRF/X-CSRF-TOKEN validado pelo CsrfValidationMiddleware, rate limiter em login/cadastro/entrada em turma, tarefas opcionais de inicialização). Controllers/ (Auth, Modules, Classrooms, StudySessions em /api/student, Community, PublicCommunity em /api/public sem login, TeacherDashboard, TeacherProfile). Services/Learning (StudySessionService, ActivitySelectionService, LearningProgressionService, FsrsService, PerformanceRatingService, PrerequisiteService, ModuleContentCache, catálogo e cruzadinha do aluno), Services/Modules (ModuleService, ModuleTransferService com o formato schemaVersion 1, PublicCommunityService com cache e ETag), Services/Classrooms (turmas e matrículas), Services/Auth, Services/Progress. Seed/ (DemoSeeder e demo-module.json). Migrations/ tem uma única migration Initial.
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

Gamificação, login com Google, PWA/offline, editor de módulos para aluno, mudanças nos minigames, mudar onde fica a cruzadinha, publicação (Vercel/Neon) sem pedido explícito.
