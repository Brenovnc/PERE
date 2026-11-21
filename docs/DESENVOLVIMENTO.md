# Guia de desenvolvimento

Detalhes para quem vai rodar e mexer no PERE no próprio computador. Para uma visão geral do projeto, veja o
[README](../README.md).

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [Ambiente local passo a passo](#ambiente-local-passo-a-passo)
- [Variáveis de ambiente da API](#variáveis-de-ambiente-da-api)
- [Comandos do dia a dia](#comandos-do-dia-a-dia)
- [Solução de problemas](#solução-de-problemas)

## Pré-requisitos

| Ferramenta | Versão | Para quê |
|---|---|---|
| Git | qualquer recente | baixar o código |
| Docker Desktop (ou Docker Engine com Compose) | recente | PostgreSQL local e o caminho "tudo com Docker" |
| .NET SDK | 10 | API e testes do backend |
| Node.js | ^22.22.3, ^24.15.0 ou >= 26 (exigência do Angular 22) | frontend |
| dotnet-ef | 10.0.x | aplicar e criar migrations |

### Windows

Com o `winget` (já vem no Windows 10/11), em um PowerShell:

```powershell
winget install --id Git.Git -e
winget install --id Docker.DockerDesktop -e
winget install --id Microsoft.DotNet.SDK.10 -e
winget install --id OpenJS.NodeJS.LTS -e
```

Depois abra o Docker Desktop uma vez (ele precisa estar aberto para os comandos `docker` funcionarem).

### macOS

Com o [Homebrew](https://brew.sh):

```bash
brew install git node@24
brew install --cask docker dotnet-sdk
```

Abra o Docker Desktop uma vez depois de instalar.

### Linux (Ubuntu/Debian)

```bash
sudo apt update && sudo apt install -y git
# Docker Engine + Compose: siga https://docs.docker.com/engine/install/ubuntu/
# .NET SDK 10: siga https://learn.microsoft.com/dotnet/core/install/linux
# Node.js 24 com o nvm (https://github.com/nvm-sh/nvm):
nvm install 24
```

### Em todos os sistemas

```bash
dotnet tool install --global dotnet-ef --version 10.0.0
```

Confira as versões:

```bash
git --version
docker --version
docker compose version
dotnet --version        # 10.x
dotnet ef --version     # 10.0.x
node --version          # v22.22.3+, v24.15.0+ ou v26+
```

## Ambiente local passo a passo

Execute na raiz do repositório.

1. **Subir o banco** (PostgreSQL na porta 5432):
   ```bash
   docker compose up -d postgres
   ```
2. **Criar as tabelas** (a API não aplica migrations sozinha no ambiente local):
   ```bash
   dotnet ef database update --project backend/StudyPlatform.Api/StudyPlatform.Api.csproj --startup-project backend/StudyPlatform.Api/StudyPlatform.Api.csproj
   ```
3. **Rodar a API** em http://localhost:5080 (deixe o terminal aberto):
   ```bash
   dotnet run --project backend/StudyPlatform.Api/StudyPlatform.Api.csproj
   ```
   Para criar também as contas de demonstração, ligue o seed nesse comando:
   ```bash
   # bash/zsh
   PERE_SEED_DEMO=true dotnet run --project backend/StudyPlatform.Api/StudyPlatform.Api.csproj
   # PowerShell
   $env:PERE_SEED_DEMO="true"; dotnet run --project backend/StudyPlatform.Api/StudyPlatform.Api.csproj
   ```
4. **Rodar o frontend** em http://localhost:4200, em outro terminal:
   ```bash
   cd frontend
   npm install
   npm start
   ```
   O `npm start` encaminha `/api` para a API, então app e API ficam na mesma origem e os cookies funcionam.
5. Abra http://localhost:4200 e crie uma conta (ou use as de demonstração, se ligou o seed).

## Variáveis de ambiente da API

Todas desligadas por padrão:

| Variável | Efeito |
|---|---|
| `PERE_APPLY_MIGRATIONS=true` | Aplica as migrations ao iniciar a API. |
| `PERE_SEED_DEMO=true` | Cria os dados de demonstração ao iniciar (só uma vez; depois é ignorado). |
| `PERE_ALLOW_INSECURE_COOKIES=true` | Permite cookies de sessão sem HTTPS fora do ambiente de desenvolvimento. Usado só pelo `docker compose` local; nunca use numa publicação. |

## Comandos do dia a dia

| Comando (na raiz, salvo indicação) | O que faz |
|---|---|
| `docker compose up -d postgres` | Sobe só o banco, para desenvolver. |
| `docker compose stop postgres` | Para o banco (os dados ficam guardados). |
| `docker compose up -d --build` | Sobe tudo (banco, API e frontend) em http://localhost:8080. |
| `docker compose down` | Para e remove os contêineres (os dados ficam guardados). |
| `docker compose down -v` | Para tudo e **apaga o banco** (reset completo). |
| `dotnet ef database update --project backend/StudyPlatform.Api/StudyPlatform.Api.csproj --startup-project backend/StudyPlatform.Api/StudyPlatform.Api.csproj` | Cria ou atualiza as tabelas do banco. |
| `dotnet ef migrations add NomeDaMudanca --project backend/StudyPlatform.Api/StudyPlatform.Api.csproj --startup-project backend/StudyPlatform.Api/StudyPlatform.Api.csproj` | Cria uma migration depois de mudar o modelo de dados. |
| `dotnet ef migrations remove --project backend/StudyPlatform.Api/StudyPlatform.Api.csproj --startup-project backend/StudyPlatform.Api/StudyPlatform.Api.csproj` | Desfaz a última migration ainda não aplicada. |
| `dotnet run --project backend/StudyPlatform.Api/StudyPlatform.Api.csproj` | Roda a API em http://localhost:5080. |
| `dotnet test backend/Tests/StudyPlatform.Tests/StudyPlatform.Tests.csproj` | Roda os testes do motor de aprendizagem (não precisa de banco). |
| `dotnet format backend/StudyPlatform.Api/StudyPlatform.Api.csproj` | Formata o código do backend. |
| `cd frontend` e `npm start` | Roda o frontend em http://localhost:4200. |
| `cd frontend` e `npm test` | Roda os testes do motor do visitante. |
| `cd frontend` e `npm run lint` | Confere o código do frontend (ESLint). |
| `cd frontend` e `npm run format` | Formata o frontend (Prettier). |
| `cd frontend` e `npm run build` | Gera o build de produção em `frontend/dist/pere/browser`. |

Pare a API (Ctrl+C no terminal dela) antes de criar ou remover migrations: com a API rodando, o build que esses
comandos fazem não consegue sobrescrever os arquivos em uso.

**Resetar o banco do ambiente local** (os dados locais são de teste):

```bash
docker compose down -v
docker compose up -d postgres
dotnet ef database update --project backend/StudyPlatform.Api/StudyPlatform.Api.csproj --startup-project backend/StudyPlatform.Api/StudyPlatform.Api.csproj
```

## Solução de problemas

| Sintoma | Causa e solução |
|---|---|
| `failed to connect to the docker API` ou `Cannot connect to the Docker daemon` | O Docker Desktop está fechado. Abra-o e espere ficar "running". |
| `port is already allocated` ou `address already in use` (5432, 5080, 4200 ou 8080) | Outro programa usa a porta. Descubra qual: Windows `netstat -ano \| findstr :5432`; macOS/Linux `lsof -i :5432`. Feche-o ou pare o outro PostgreSQL. |
| Erros 500 e no log da API `Failed to connect to 127.0.0.1:5432` | O banco não está rodando: `docker compose up -d postgres`. |
| `relation "..." does not exist` no log da API | As tabelas não foram criadas: rode o `dotnet ef database update`. |
| `dotnet ef migrations ...` falha com "Build failed" ou "being used by another process" | A API está rodando e trava os arquivos do build. Pare a API (Ctrl+C) e repita o comando. |
| `dotnet ef` não é reconhecido | Instale a ferramenta (`dotnet tool install --global dotnet-ef --version 10.0.0`) e abra um terminal novo. |
| `npm` avisa `EBADENGINE` ou o `ng` reclama da versão do Node | Use Node ^22.22.3, ^24.15.0 ou 26+ (`node --version`). |
| "Sua sessão expirou" ou erro de CSRF logo depois de reiniciar a API | Normal no ambiente local: a API em desenvolvimento cria chaves novas a cada início. Entre de novo. Se persistir, apague os cookies de `localhost`. |
| Banco criado por uma versão antiga do projeto dá erros de coluna ou tabela | Recrie: `docker compose down -v` e depois os passos 1 e 2 do ambiente local. |
| Na primeira subida do compose, o log da API mostra `Failed executing DbCommand ... __EFMigrationsHistory` | Normal: com o banco vazio, o EF procura o histórico de migrations antes de criá-lo. As linhas seguintes aplicam as migrations. |
| Depois de renomear o banco para `pere`, a API não conecta ao banco antigo | O volume guarda o banco com o nome antigo. Recrie: `docker compose down -v` e suba de novo. |
| O modo visitante "perdeu" o progresso | O progresso do visitante fica no navegador: limpar os dados do site ou usar outra janela anônima apaga tudo. Use "Exportar progresso" para guardar uma cópia. |
