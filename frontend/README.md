# PERE — frontend

Frontend do PERE em Angular.

- Angular 22 (componentes standalone, signals, rotas lazy, sem zone.js), TypeScript estrito
- Tailwind CSS v4 (configurado pelo Angular CLI; tokens de tema em `src/theme.css`) e Angular CDK
- ESLint (angular-eslint) e Prettier

## Requisitos

Node.js **^22.22.3, ^24.15.0 ou >=26.0.0** (exigência do Angular 22; confira com `node --version`) e npm.

## Comandos (dentro de `frontend/`)

```bash
npm install          # instala as dependências
npm start            # servidor de desenvolvimento em http://localhost:4200
npm run build        # build de produção em dist/pere/browser
npm run lint         # ESLint
npm run format       # Prettier (format:check só confere)
```

A API precisa estar rodando em http://localhost:5080. Em desenvolvimento, o `ng serve` encaminha `/api` para ela
(`proxy.conf.json`), então frontend e API ficam na mesma origem e os cookies de sessão funcionam sem CORS.

## Imagem Docker

`Dockerfile` gera o build e o serve com nginx (`nginx.conf`, porta definida pela variável `PORT`, padrão 80).
O app chama a API pelo caminho relativo `/api`, então quem serve o app precisa encaminhar `/api` para a API na
mesma origem: no `docker-compose.yml` da raiz, o arquivo `nginx-api-proxy.conf` é montado no nginx para isso; numa
publicação, o `vercel.json` da raiz faz o mesmo papel.

## Testes

```bash
npm test             # testes unitários do motor do visitante (Vitest)
```

## Modo visitante

Em `/visitor`, qualquer pessoa (com ou sem conta) estuda módulos da comunidade ou arquivos de módulo
(`schemaVersion` 1, o mesmo formato da exportação do professor) sem entrar em turma.

- O motor (`src/app/visitor/engine/`) roda no navegador e reproduz as regras do backend: seleção de
  atividade, estados do conceito, nota inferida da resposta e agendamento FSRS (biblioteca `ts-fsrs`).
- O progresso fica só no navegador (IndexedDB, banco `pere-visitor`) e é salvo a cada resposta. Nada do
  visitante vai para o servidor. "Exportar progresso" gera um arquivo com os módulos e o progresso; "Importar
  progresso" restaura esse arquivo (em outro aparelho, por exemplo).
- Os módulos da comunidade vêm de `/api/public/community/modules` (sem login). Ao abrir `/visitor`, o app
  pergunta ao servidor, com o ETag salvo, se cada módulo mudou; sem mudança a resposta é um 304 vazio.
- As telas de módulo, sessão (os 5 minigames) e cruzadinha são as mesmas do aluno de turma; só a fonte dos
  dados muda (`STUDY_SOURCE`: API para o aluno, motor local para o visitante).

### ts-fsrs × Fsrs.Sharp

O backend usa Fsrs.Sharp 2.0.0; o visitante, ts-fsrs 5.4.2. Os dois usam FSRS-6 com os mesmos 21 parâmetros
padrão, retenção desejada 0,9, intervalo máximo de 36500 dias, passos de aprendizagem de 1 e 10 minutos,
reaprendizagem de 10 minutos e sem fuzz. Comparação feita com a mesma sequência de notas nas duas bibliotecas:

- Revisões feitas na data agendada: resultados idênticos (estabilidade, dificuldade e próxima data). Um teste
  do motor confere esses valores.
- "Difícil" durante os passos de aprendizagem: o ts-fsrs agenda 6 minutos; o Fsrs.Sharp, 10 minutos.
- Revisões fora da data (adiantadas ou atrasadas): pequenas diferenças na estabilidade (por exemplo, 0,98
  contra 0,95 num "De novo" feito 3 dias antes do previsto), que podem mudar a próxima data em cerca de um dia.

Outras diferenças do motor local em relação ao backend, sem efeito nas regras pedagógicas:

- A ordem de revelação das palavras-chave segue o arquivo (no backend, segue o id interno).
- Empates na escolha de atividade são desempatados pelo id do conceito no arquivo (no backend, pelo Guid).
- Não há histórico de tentativas nem estatísticas; guardam-se só a sessão ativa e as 5 últimas.
- A importação confere a estrutura do arquivo, mas não repete os limites de tamanho dos campos do backend.
