# OPEC Agent

Sistema de monitoramento automático de contestações em marketplaces (Mercado Livre e Shopee) para a equipe de Operações da Branddi.

---

## O que o sistema faz

Marcas parceiras da Branddi precisam responder a contestações abertas por vendedores nos marketplaces — situações onde um vendedor alega que seu anúncio foi pausado indevidamente por suspeita de falsificação. O analista de operações precisa revisar cada contestação, verificar as Notas Fiscais anexadas e encaminhar o caso ao time de Customer Success.

Sem o OPEC Agent, esse processo exige que o analista entre manualmente em cada conta (podendo haver dezenas) todos os dias. O sistema automatiza exatamente isso:

1. **Monitora** todas as contas de clientes cadastradas nos marketplaces
2. **Detecta** contestações novas sem intervenção manual
3. **Coleta** o texto da contestação, screenshot da tela e os PDFs de NF anexados
4. **Extrai** dados estruturados das NFs usando a API do Claude (CNPJ, produto, valor, datas)
5. **Centraliza** tudo num dashboard onde o analista revisa, encaminha ao CS e acompanha o status

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript (Vite) |
| Backend | Node.js + Express + TypeScript |
| Automação de browser | Playwright (Chromium) |
| Extração de NFs por IA | Anthropic Claude API (`claude-sonnet-*`) |
| Banco de dados | JSON local em `backend/data/db.json` |
| Criptografia de senhas | AES-256-GCM (via `DB_ENCRYPTION_KEY`) |
| Empacotamento de arquivos | Archiver (ZIP) |

---

## Estrutura do projeto

```
opec-agent/
├── backend/
│   ├── src/
│   │   ├── index.ts                    # Entry point — Express + startup recovery
│   │   ├── types/
│   │   │   └── index.ts                # Interfaces TypeScript (Client, Contestacao, etc.)
│   │   ├── routes/
│   │   │   └── api.ts                  # Todos os endpoints REST
│   │   └── services/
│   │       ├── database.ts             # Leitura/escrita do db.json
│   │       ├── scraper.ts              # Orquestrador: mock vs. real, dados fictícios
│   │       ├── nfExtractor.ts          # Extração de dados de NF via Claude API
│   │       ├── crypto.ts               # Criptografia AES-256-GCM para senhas
│   │       └── scrapers/
│   │           ├── mercadolivre.ts     # Scraper real do Mercado Livre (Playwright)
│   │           └── shopee.ts           # Scraper real da Shopee (Playwright)
│   ├── data/                           # Gerado em runtime (não versionar)
│   │   ├── db.json                     # Banco de dados local
│   │   ├── screenshots/                # Prints das contestações coletadas
│   │   └── nfs/                        # PDFs de Notas Fiscais baixados
│   ├── .env                            # Variáveis de ambiente (não versionar)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── types/
│   │   │   └── index.ts                # Espelha os tipos do backend (manter sincronizado)
│   │   ├── services/
│   │   │   └── api.ts                  # Todas as chamadas HTTP ao backend
│   │   ├── components/                 # Componentes reutilizáveis (cards, linhas, etc.)
│   │   └── pages/
│   │       └── Dashboard.tsx           # Página principal
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

---

## Como rodar (desenvolvimento)

### Pré-requisitos

- Node.js 20+
- npm 10+

### 1. Variáveis de ambiente

Crie o arquivo `backend/.env`:

```env
# Chave de criptografia AES-256-GCM para senhas dos clientes
# Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DB_ENCRYPTION_KEY=sua_chave_64_caracteres_hex_aqui

# Chave da API do Claude (obrigatória para extração de NFs em modo real)
ANTHROPIC_API_KEY=sk-ant-...

# Opcional: roda o Playwright com janela visível (útil para debug do scraper)
# PLAYWRIGHT_HEADLESS=false
```

### 2. Instalar dependências

```bash
# Backend
cd backend
npm install
npx playwright install chromium

# Frontend
cd ../frontend
npm install
```

### 3. Iniciar

```bash
# Terminal 1 — backend (porta 3333)
cd backend
npm run dev

# Terminal 2 — frontend (porta 5173)
cd frontend
npm run dev
```

Acesse: [http://localhost:5173](http://localhost:5173)

---

## Fluxo de uso

```
[Dashboard]
     │
     ├─ Cadastrar cliente (nome, marketplace, usuário, senha)
     │
     ├─ Clicar "Escanear contas"
     │         │
     │         ├─ Modo Mock  → retorna dados fictícios instantaneamente (sem Playwright)
     │         └─ Modo Real  → abre browser, faz login e coleta contestações reais
     │
     ├─ Ver contestações agrupadas por cliente
     │         │
     │         ├─ Encaminhar ao CS (muda status para "encaminhada")
     │         ├─ Marcar como revisada
     │         └─ Baixar pacote ZIP (screenshot + NFs)
     │
     └─ Alternar Mock ↔ Real (apaga contestações, mantém clientes)
```

### Status das contestações

| Status | Significado |
|--------|-------------|
| `nova` | Detectada pelo scan, aguardando revisão do analista |
| `encaminhada` | Analista encaminhou ao CS — aguardando resposta do marketplace |
| `revisada` | Caso encerrado / respondido |

---

## API REST

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/clients` | Lista clientes (sem senha) |
| `POST` | `/api/clients` | Cadastra novo cliente |
| `DELETE` | `/api/clients/:id` | Remove cliente e suas contestações |
| `GET` | `/api/contestacoes/summary` | Contadores para o dashboard |
| `GET` | `/api/contestacoes/agrupadas` | Contestações agrupadas por cliente |
| `PATCH` | `/api/contestacoes/:id/nova` | Reverte contestação para "nova" |
| `PATCH` | `/api/contestacoes/:id/encaminhar` | Marca como encaminhada |
| `PATCH` | `/api/contestacoes/:id/revisar` | Marca como revisada |
| `PATCH` | `/api/contestacoes/lote/encaminhar` | Encaminha várias de uma vez |
| `GET` | `/api/contestacoes/lote/pacote` | Baixa ZIP com screenshots e NFs |
| `POST` | `/api/scan` | Inicia scan (todos ou um cliente específico) |
| `GET` | `/api/scan/status` | Status atual do scan |
| `GET` | `/api/mode` | Retorna modo atual (mock/real) |
| `POST` | `/api/mode` | Altera o modo |

---

## Modo Mock vs. Modo Real

O sistema opera em dois modos controlados pelo botão no dashboard:

**Modo Mock** (`mockMode: true`)
- Não abre nenhum browser
- Retorna contestações fictícias com NFs simuladas pré-definidas em `scraper.ts`
- Ideal para demonstrações, testes e desenvolvimento sem credenciais reais
- Scan completa em ~800ms por cliente

**Modo Real** (`mockMode: false`)
- Abre o Chromium via Playwright
- Faz login na conta de cada cliente cadastrado
- Navega até a área de contestações e coleta os dados reais
- Baixa os PDFs de NF e extrai os dados via Claude API
- Timeout de 5 minutos por cliente para evitar travamentos

---

## Deploy (produção)

O backend usa Playwright (Chromium headless) e não pode rodar em plataformas serverless como funções do Vercel. A arquitetura de produção é:

| Serviço | Plataforma | Motivo |
|---------|-----------|--------|
| Frontend | **Vercel** | Build estático, deploy automático via Git |
| Backend | **Render** | Suporta Node.js completo + Playwright |

### Frontend no Vercel

1. Importe o repositório no [Vercel](https://vercel.com)
2. Vercel detecta o `vercel.json` na raiz automaticamente — nenhuma configuração extra de build é necessária
3. Adicione a variável de ambiente no painel do Vercel:
   ```
   VITE_API_URL=https://opec-agent-backend.onrender.com/api
   ```
   (substitua pela URL real do seu serviço no Render)

### Backend no Render

1. Crie um novo serviço **Web Service** no [Render](https://render.com)
2. Aponte para o repositório e configure o **Root Directory** como `backend`
3. Render detecta o `render.yaml` automaticamente com os comandos de build e start
4. Adicione as variáveis de ambiente no painel do Render:

   | Variável | Valor |
   |----------|-------|
   | `DB_ENCRYPTION_KEY` | Chave hex de 64 caracteres (gere conforme `.env.example`) |
   | `ANTHROPIC_API_KEY` | Sua chave da API do Claude |
   | `FRONTEND_URL` | URL do seu deploy no Vercel (ex: `https://opec-agent.vercel.app`) |

> **Nota sobre persistência:** No free tier do Render o disco é efêmero — o `db.json` é apagado a cada redeploy. Para dados persistentes em produção, adicione um Persistent Disk no Render ou migre para PostgreSQL (Fase 2).

---

## Estado atual da implementação

### Funcionando (Fase 1 — completo)

- [x] Cadastro e gerenciamento de clientes com senhas criptografadas
- [x] Dashboard com contadores, agrupamento por cliente e histórico
- [x] Scan em modo mock com dados realistas
- [x] Fluxo completo de status: nova → encaminhada → revisada
- [x] Download de pacote ZIP por cliente
- [x] Recovery automático de scan travado ao reiniciar o servidor
- [x] Alternância Mock/Real com limpeza automática de contestações

---

## Próximos passos (Fase 2 — a implementar)

### 1. Validar e corrigir seletores CSS do Mercado Livre

**Arquivo:** `backend/src/services/scrapers/mercadolivre.ts` (bloco `SELECTORS`)

Os seletores atuais são placeholders genéricos baseados em `[class*="..."]`. É preciso:
- Navegar manualmente até a área de contestações do ML logado
- Inspecionar o DOM e mapear os seletores reais de cada elemento
- Atualizar o bloco `SELECTORS` no arquivo

O ML atualiza o frontend com frequência — esses seletores precisam de manutenção periódica.

### 2. Implementar extração de texto de PDFs do Mercado Livre

**Arquivo:** `backend/src/services/scrapers/mercadolivre.ts` (~linha 193)

A função `downloadNFs` baixa o PDF mas usa um placeholder de texto. É preciso substituir pelo uso real do `pdf-parse` (já instalado):

```typescript
import pdfParse from "pdf-parse";

const data = await pdfParse(fs.readFileSync(filePath));
const rawText = data.text;
```

### 3. Validar o scraper da Shopee em ambiente real

**Arquivo:** `backend/src/services/scrapers/shopee.ts`

O scraper da Shopee está mais completo que o do ML, mas ainda precisa ser testado com credenciais reais para:
- Confirmar que o fluxo de login com cookies funciona
- Validar os seletores da área de apelações
- Testar o download e parsing do relatório XLSX

### 4. Extração de dados de NF via Claude (nfExtractor)

**Arquivo:** `backend/src/services/nfExtractor.ts`

Em modo real, o `rawText` extraído do PDF é enviado à API do Claude para identificar CNPJ, produto, valor, datas etc. Precisará de validação em produção com NFs reais para garantir que os prompts retornam os campos corretamente.

### 5. Persistência em banco de dados relacional

**Arquivo:** `backend/src/services/database.ts`

O banco JSON local é adequado para desenvolvimento mas não para produção com múltiplos usuários simultâneos. A interface do `database.ts` está preparada para substituição — basta reimplementar as funções exportadas apontando para PostgreSQL (ou similar) sem alterar nenhum outro arquivo.

### 6. Autenticação de usuários no frontend

Atualmente qualquer pessoa com acesso à URL do frontend pode operar o sistema. Para uso em produção é necessário adicionar um sistema de login (JWT ou sessão).

### 7. Agendamento automático de scans

O dashboard exibe "automático todo dia" mas o disparo ainda é manual. Implementar um cron job no backend (ex: `node-cron`) para executar o scan diariamente em horário configurável.
