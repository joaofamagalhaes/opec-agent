// services/scraper.ts
// Responsável por acessar os marketplaces e coletar contestações.
//
// FASE 1 (MVP): retorna dados mockados realistas para demonstração.
// FASE 2: descomente os blocos de Playwright e implemente o scraping real.

import { chromium } from "playwright";
import path from "path";
import { Client, Contestacao, NotaFiscal } from "../types/index.js";
import { extractNFData } from "./nfExtractor.js";

// NF fictícia para demonstração — simula o texto que viria de um PDF real
const MOCK_NF_TEXT = `
NOTA FISCAL ELETRÔNICA - NF-e
Número: 000123456   Série: 001   Data de Emissão: 2025-03-10

EMITENTE
Razão Social: COMERCIAL DISTRIBUIDORA SILVA LTDA
CNPJ: 12.345.678/0001-90
Endereço: Rua das Flores, 456 - São Paulo/SP

DESTINATÁRIO
Razão Social: MARKETPLACE VENDEDOR INDIVIDUAL
CNPJ: 98.765.432/0001-11

PRODUTOS
001 - Produto: Tênis Esportivo Running Pro - Ref. TE-2024
      Quantidade: 10 UN   Valor Unitário: R$ 189,90
      Valor Total: R$ 1.899,00

TOTAL DA NOTA
Valor Total dos Produtos: R$ 1.899,00
Valor do ICMS: R$ 341,82
Valor Total da NF-e: R$ 1.899,00
`;

// Dados mockados — representam o que o scraper retornaria em produção
const MOCK_CONTESTACOES: Omit<
  Contestacao,
  "id" | "notasFiscais" | "status" | "foundAt" | "revisadaAt" | "encaminhadaAt"
>[] = [
  {
    clientId: "", // preenchido em runtime
    clientName: "",
    marketplace: "mercadolivre",
    vendedorNome: "distribuidora_silva_oficial",
    vendedorUrl: "https://www.mercadolivre.com.br/perfil/distribuidora_silva",
    textoContestacao:
      "Somos revendedor autorizado da marca. Segue nota fiscal de compra legítima do produto diretamente do fabricante. Não há violação de marca, pois adquirimos o estoque de forma regular.",
    screenshotPath: "data/screenshots/mock_ml_contestacao.png",
  },
  {
    clientId: "",
    clientName: "",
    marketplace: "shopee",
    vendedorNome: "loja_premium_sp",
    vendedorUrl: "https://shopee.com.br/loja_premium_sp",
    textoContestacao:
      "Os produtos vendidos são originais. Temos autorização do distribuidor regional. Em anexo NF de aquisição. Solicitamos revisão da denúncia pois estamos em conformidade.",
    screenshotPath: "data/screenshots/mock_shopee_contestacao.png",
  },
];

/**
 * Escaneia um cliente e retorna as contestações encontradas.
 * MVP: retorna mock. Fase 2: usa Playwright para scraping real.
 */ 
export async function scanClient(client: Client): Promise<Contestacao[]> {
  // ── FASE 1: Mock ────────────────────────────────────────────────────────────
  // Simula delay de rede para parecer realista na demo
  await new Promise((res) => setTimeout(res, 800));

  // Sorteia aleatoriamente se há contestação nova (para demo dinâmica)
  const hasContestacao = true
  if (!hasContestacao) return [];

  const mockBase = MOCK_CONTESTACOES[Math.floor(Math.random() * MOCK_CONTESTACOES.length)];

  // Extrai dados da NF usando a Claude API de verdade (desativado no momento)
  // const nf = await extractNFData(MOCK_NF_TEXT, "nf_000123456.pdf", "data/nfs/mock_nf.pdf");
  // Mock fixo para testar a demo
  const nf: NotaFiscal = {
  fileName: "nf_000123456.pdf",
  filePath: "data/nfs/mock_nf.pdf",
  rawText: MOCK_NF_TEXT,
  cnpjEmitente: "12345678000190",
  nomeEmitente: "Comercial Distribuidora Silva Ltda",
  cnpjDestinatario: "98765432000111",
  nomeDestinatario: "Marketplace Vendedor Individual",
  produto: "Tênis Esportivo Running Pro",
  valorTotal: 1899.00,
  dataEmissao: "2025-03-10",
  numeroNF: "000123456",
};

  const contestacao: Contestacao = {
    id: `${client.id}_${Date.now()}`,
    clientId: client.id,
    clientName: client.name,
    marketplace: client.marketplace,
    vendedorNome: mockBase.vendedorNome,
    vendedorUrl: mockBase.vendedorUrl,
    textoContestacao: mockBase.textoContestacao,
    screenshotPath: mockBase.screenshotPath,
    notasFiscais: [nf],
    status: "nova",
    foundAt: new Date().toISOString(),
    encaminhadaAt: null,
    revisadaAt: null,
  };

  return [contestacao];

  // ── FASE 2: Playwright real ─────────────────────────────────────────────────
  // Quando quiser ativar o scraping real:
  // 1. Comente o bloco FASE 1 acima
  // 2. Descomente o bloco abaixo
  // 3. Preencha os seletores em scrapers/mercadolivre.ts e scrapers/shopee.ts
  //
  // import { scrapeMercadoLivre } from "./scrapers/mercadolivre.js";
  // import { scrapeShopee }       from "./scrapers/shopee.js";
  //
  // const browser = await chromium.launch({ headless: true });
  // const page    = await browser.newPage();
  // try {
  //   if (client.marketplace === "mercadolivre") {
  //     return await scrapeMercadoLivre(page, client);
  //   } else {
  //     return await scrapeShopee(page, client);
  //   }
  // } finally {
  //   await browser.close();
  // }
}

/**
 * TODO: Fase 2 — implementar scraping real do Mercado Livre.
 *
 * Fluxo esperado:
 * 1. Navegar para https://www.mercadolivre.com.br/
 * 2. Fazer login com client.username e client.password
 * 3. Navegar até a área de denúncias/contestações
 * 4. Para cada contestação aberta:
 *    a. Capturar screenshot: await page.screenshot({ path: screenshotPath })
 *    b. Extrair texto da resposta do vendedor
 *    c. Baixar PDFs de NF anexados
 *    d. Chamar extractNFData() para cada PDF
 * 5. Retornar array de Contestacao
 */
// async function scrapeMercadoLivre(page, client: Client): Promise<Contestacao[]> { ... }

/**
 * TODO: Fase 2 — implementar scraping real da Shopee.
 * Estrutura similar ao Mercado Livre.
 */
// async function scrapeShopee(page, client: Client): Promise<Contestacao[]> { ... }
