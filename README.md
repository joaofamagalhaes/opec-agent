# OPEC Agent

Sistema de monitoramento automático de contestações em marketplaces (Mercado Livre e Shopee) para a equipe de Operações da Branddi.

## O que o sistema faz

1. **Monitora** todas as contas de clientes nos marketplaces diariamente
2. **Detecta** contestações novas sem que o analista precise entrar em cada conta manualmente
3. **Coleta** automaticamente o texto da contestação, print da tela e NFs anexadas
4. **Extrai** dados estruturados das NFs usando IA (Claude API)
5. **Centraliza** tudo num dashboard pronto para o analista revisar e encaminhar ao CS

## Stack

- **Frontend:** React + TypeScript (Vite)
- **Backend:** Node.js + Express + TypeScript
- **Automação de browser:** Playwright
- **IA:** Anthropic Claude API
- **Banco de dados:** JSON local (facilmente substituível por PostgreSQL)

## Estrutura do projeto

```
opec-agent/
├── backend/
│   ├── src/
│   │   ├── types/        # Interfaces TypeScript compartilhadas
│   │   ├── routes/       # Rotas da API REST
│   │   └── services/     # Lógica de negócio (scraping, IA, banco)
│   ├── data/             # Banco JSON + screenshots + NFs (gerado em runtime)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── types/        # Interfaces TypeScript
│   │   ├── services/     # Chamadas à API do backend
│   │   ├── components/   # Componentes reutilizáveis
│   │   └── pages/        # Páginas da aplicação
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

