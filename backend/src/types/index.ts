// types/index.ts
// Interfaces centrais do sistema. Altere aqui e o TypeScript
// vai apontar todos os lugares que precisam ser atualizados.

export type Marketplace = "mercadolivre" | "shopee";

export type ContestacaoStatus = "nova" | "revisada" | "encaminhada";

// ── Cliente ──────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;           // Nome da marca/cliente
  marketplace: Marketplace;
  username: string;
  password: string;       // TODO: criptografar em produção
  createdAt: string;      // ISO 8601
}

// ── Nota Fiscal ──────────────────────────────────────────────────────────────

export interface NotaFiscal {
  fileName: string;
  filePath: string;       // Caminho local do PDF baixado

  // Campos extraídos pela IA — null se não encontrado no documento
  cnpjEmitente: string | null;
  nomeEmitente: string | null;
  cnpjDestinatario: string | null;
  nomeDestinatario: string | null;
  produto: string | null;
  valorTotal: number | null;
  dataEmissao: string | null;
  numeroNF: string | null;

  // Texto bruto extraído do PDF (para debug e auditoria)
  rawText: string;
}

// ── Contestação ───────────────────────────────────────────────────────────────

export interface Contestacao {
  id: string;
  clientId: string;
  clientName: string;
  marketplace: Marketplace;

  // Dados coletados pelo scraper
  vendedorNome: string;
  vendedorUrl: string | null; // Pode ser inexistente/inválido
  textoContestacao: string;   // Resposta do vendedor
  screenshotPath: string;     // Caminho do print salvo localmente
  notasFiscais: NotaFiscal[]; // NFs baixadas e extraídas

  // Metadados
  status: ContestacaoStatus;
  foundAt: string;            // Quando o robô detectou
  encaminhadaAt: string | null // Quando for enviada para CS
  revisadaAt: string | null;  // Quando o analista marcou como revisada
}

// ── Scan ─────────────────────────────────────────────────────────────────────

export type ScanStatus = "idle" | "running" | "done" | "error";

export interface ScanLog {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: ScanStatus;
  clientsScanned: number;
  contestacoesFound: number;
  errorMessage: string | null;
}

// ── Respostas da API ──────────────────────────────────────────────────────────

export interface SummaryResponse {
  total: number;
  novas: number;
  revisadas: number;
  clientesComNovas: number;
  lastScan: string | null;
  scanStatus: ScanStatus;
}
