// types/index.ts — espelha os tipos do backend
// Mantenha sincronizado com backend/src/types/index.ts

export type Marketplace = "mercadolivre" | "shopee";
export type ContestacaoStatus = "nova" | "revisada" | "encaminhada";
export type ScanStatus = "idle" | "running" | "done" | "error";

export interface Client {
  id: string;
  name: string;
  marketplace: Marketplace;
  username: string;
  createdAt: string;
}

export interface NotaFiscal {
  fileName: string;
  filePath: string;
  cnpjEmitente: string | null;
  nomeEmitente: string | null;
  cnpjDestinatario: string | null;
  nomeDestinatario: string | null;
  produto: string | null;
  valorTotal: number | null;
  dataEmissao: string | null;
  numeroNF: string | null;
  rawText: string;
}

export interface Anexo {
  fileName: string;
  filePath: string;
  mimeType: string;
  downloadedAt: string;
}

export interface Contestacao {
  id: string;
  clientId: string;
  clientName: string;
  marketplace: Marketplace;
  vendedorNome: string;
  vendedorUrl: string | null;
  textoContestacao: string;
  screenshotPath: string;
  notasFiscais: NotaFiscal[];
  anexo: Anexo[];
  meta?: {
    appealId: string;
    itemId: string;
    shopId: string;
    brand: string;
    violationType: string;
    statusShopee: string;
  };
  status: ContestacaoStatus;
  foundAt: string;
  encaminhadaAt: string | null;
  revisadaAt: string | null;
}

export interface SummaryResponse {
  total: number;
  novas: number;
  encaminhadas: number;
  revisadas: number;
  clientesComNovas: number;
  lastScan: string | null;
  scanStatus: ScanStatus;
}
//novo tipo, grupo de contestações por cliente
export interface GrupoCliente {
  clientId: string;
  clientName: string;
  marketplace: Marketplace;
  contestacoes: Contestacao[];
  novas: number;
  encaminhadas: number;
  revisadas: number;
}
