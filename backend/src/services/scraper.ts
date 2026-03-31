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
// const MOCK_CONTESTACOES: Omit<
//   Contestacao,
//   "id" | "notasFiscais" | "status" | "foundAt" | "revisadaAt" | "encaminhadaAt"
// >[] = [
//   {
//     clientId: "", // preenchido em runtime
//     clientName: "",
//     marketplace: "mercadolivre",
//     vendedorNome: "distribuidora_silva_oficial",
//     vendedorUrl: "https://www.mercadolivre.com.br/perfil/distribuidora_silva",
//     textoContestacao:
//       "Somos revendedor autorizado da marca. Segue nota fiscal de compra legítima do produto diretamente do fabricante. Não há violação de marca, pois adquirimos o estoque de forma regular.",
//     screenshotPath: "data/screenshots/mock_ml_contestacao.png",
//   },
//   {
//     clientId: "",
//     clientName: "",
//     marketplace: "shopee",
//     vendedorNome: "loja_premium_sp",
//     vendedorUrl: "https://shopee.com.br/loja_premium_sp",
//     textoContestacao:
//       "Os produtos vendidos são originais. Temos autorização do distribuidor regional. Em anexo NF de aquisição. Solicitamos revisão da denúncia pois estamos em conformidade.",
//     screenshotPath: "data/screenshots/mock_shopee_contestacao.png",
//   },
// ];

const MOCK_CONTESTACOES: Omit<
  Contestacao,
  "id" | "notasFiscais" | "status" | "foundAt" | "revisadaAt" | "encaminhadaAt"
>[] = [
  // --- MERCADO LIVRE ---
  {
    clientId: "",
    clientName: "Tramontina",
    marketplace: "mercadolivre",
    vendedorNome: "utilidades_reis",
    vendedorUrl: "https://www.mercadolivre.com.br/perfil/utilidades_reis",
    textoContestacao:
      "Tive meu anúncio das panelas pausado injustamente. Adquirimos nosso estoque em um distribuidor atacadista com CNPJ regular. Anexei as notas fiscais que comprovam a autenticidade dos produtos da marca.",
    screenshotPath: "data/screenshots/ml_tramontina_contestacao.png",
  },
  {
    clientId: "",
    clientName: "Mundial",
    marketplace: "mercadolivre",
    vendedorNome: "atacadao_da_beleza_oficial",
    vendedorUrl:
      "https://www.mercadolivre.com.br/perfil/atacadao_da_beleza_oficial",
    textoContestacao:
      "Somos uma loja de cosméticos e cutelaria há 10 anos. Os alicates e tesouras que vendemos são 100% originais. Segue a documentação de compra para que o anúncio seja reativado o mais rápido possível.",
    screenshotPath: "data/screenshots/ml_mundial_contestacao.png",
  },
  {
    clientId: "",
    clientName: "Pacco",
    marketplace: "mercadolivre",
    vendedorNome: "termicos_e_cia",
    vendedorUrl: "https://www.mercadolivre.com.br/perfil/termicos_e_cia",
    textoContestacao:
      "Gostaria de entender a denúncia, pois sou revendedor autorizado e as garrafas e copos térmicos são legítimos. Não há infração de propriedade intelectual, peço a liberação imediata do meu produto.",
    screenshotPath: "data/screenshots/ml_pacco_contestacao.png",
  },
  {
    clientId: "",
    clientName: "Labotrat",
    marketplace: "mercadolivre",
    vendedorNome: "skin_care_brasil",
    vendedorUrl: "https://www.mercadolivre.com.br/perfil/skin_care_brasil",
    textoContestacao:
      "Os esfoliantes e cremes comercializados neste anúncio foram comprados diretamente da fábrica. Seguem os dados do lote e a NF-e. Aguardo a revisão urgente dessa punição indevida.",
    screenshotPath: "data/screenshots/ml_labotrat_contestacao.png",
  },

  // --- SHOPEE ---
  {
    clientId: "",
    clientName: "Tramontina",
    marketplace: "shopee",
    vendedorNome: "casa_perfeita_sp",
    vendedorUrl: "https://shopee.com.br/casa_perfeita_sp",
    textoContestacao:
      "A denúncia de falsificação não procede. O jogo de facas é original e lacrado na embalagem de fábrica. Trabalho de forma honesta na plataforma e envio a nota de entrada para comprovar.",
    screenshotPath: "data/screenshots/shopee_tramontina_contestacao.png",
  },
  {
    clientId: "",
    clientName: "Mundial",
    marketplace: "shopee",
    vendedorNome: "salao_e_cia_store",
    vendedorUrl: "https://shopee.com.br/salao_e_cia_store",
    textoContestacao:
      "Estou anexando as faturas do fornecedor que me repassa os produtos da Mundial. Acredito que a denúncia foi feita por algum concorrente agindo de má-fé, peço que a equipe analise a NF.",
    screenshotPath: "data/screenshots/shopee_mundial_contestacao.png",
  },
  {
    clientId: "",
    clientName: "Pacco",
    marketplace: "shopee",
    vendedorNome: "aventura_esportes_br",
    vendedorUrl: "https://shopee.com.br/aventura_esportes_br",
    textoContestacao:
      "Minhas vendas foram bloqueadas por suspeita de réplica, mas comercializo apenas itens originais da marca. Podem verificar o código de barras e a nota fiscal de compra em anexo.",
    screenshotPath: "data/screenshots/shopee_pacco_contestacao.png",
  },
  {
    clientId: "",
    clientName: "Labotrat",
    marketplace: "shopee",
    vendedorNome: "imperio_dos_cosmeticos",
    vendedorUrl: "https://shopee.com.br/imperio_dos_cosmeticos",
    textoContestacao:
      "Todos os nossos cosméticos possuem registro na Anvisa e foram adquiridos via distribuidor oficial no estado de São Paulo. A denúncia por uso indevido de marca não tem cabimento no nosso caso.",
    screenshotPath: "data/screenshots/shopee_labotrat_contestacao.png",
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
  const hasContestacao = true;
  if (!hasContestacao) return [];

  const mockBase =
    MOCK_CONTESTACOES[Math.floor(Math.random() * MOCK_CONTESTACOES.length)];

  // Extrai dados da NF usando a Claude API de verdade (desativado no momento)
  // const nf = await extractNFData(MOCK_NF_TEXT, "nf_000123456.pdf", "data/nfs/mock_nf.pdf");
  // Mock fixo para testar a demo
  // const nf: NotaFiscal = {
  //   fileName: "nf_000123456.pdf",
  //   filePath: "data/nfs/mock_nf.pdf",
  //   rawText: MOCK_NF_TEXT,
  //   cnpjEmitente: "12345678000190",
  //   nomeEmitente: "Comercial Distribuidora Silva Ltda",
  //   cnpjDestinatario: "98765432000111",
  //   nomeDestinatario: "Marketplace Vendedor Individual",
  //   produto: "Tênis Esportivo Running Pro",
  //   valorTotal: 1899.0,
  //   dataEmissao: "2025-03-10",
  //   numeroNF: "000123456",
  // };

  const MOCK_NOTAS_FISCAIS: NotaFiscal[] = [
    // --- MERCADO LIVRE ---
    {
      fileName: "nf_tramontina_ml_10293.pdf",
      filePath: "data/nfs/nf_tramontina_ml_10293.pdf",
      rawText: MOCK_NF_TEXT, // Assumindo que você tem essa constante definida no seu arquivo
      cnpjEmitente: "45678912000155",
      nomeEmitente: "Distribuidora Atacadista Sul Ltda",
      cnpjDestinatario: "11222333000144",
      nomeDestinatario: "Utilidades Reis Comercio",
      produto: "Jogo de Panelas Inox Tramontina 5 Peças",
      valorTotal: 4500.0,
      dataEmissao: "2026-02-15",
      numeroNF: "000010293",
    },
    {
      fileName: "nf_mundial_ml_88472.pdf",
      filePath: "data/nfs/nf_mundial_ml_88472.pdf",
      rawText: MOCK_NF_TEXT,
      cnpjEmitente: "98765432000188",
      nomeEmitente: "Atacadão da Cutelaria BR",
      cnpjDestinatario: "55444333000122",
      nomeDestinatario: "Atacadão da Beleza Oficial ME",
      produto: "Kit Alicates Mundial Classic Lote 100un",
      valorTotal: 2150.0,
      dataEmissao: "2026-01-20",
      numeroNF: "000088472",
    },
    {
      fileName: "nf_pacco_ml_55021.pdf",
      filePath: "data/nfs/nf_pacco_ml_55021.pdf",
      rawText: MOCK_NF_TEXT,
      cnpjEmitente: "11122233000199",
      nomeEmitente: "Importadora Térmicos Brasil S.A.",
      cnpjDestinatario: "77888999000155",
      nomeDestinatario: "Termicos e Cia E-commerce",
      produto: "Garrafa Térmica Pacco Hydra 950ml",
      valorTotal: 8900.0,
      dataEmissao: "2026-03-05",
      numeroNF: "000055021",
    },
    {
      fileName: "nf_labotrat_ml_11902.pdf",
      filePath: "data/nfs/nf_labotrat_ml_11902.pdf",
      rawText: MOCK_NF_TEXT,
      cnpjEmitente: "33444555000177",
      nomeEmitente: "Fábrica Labotrat Cosméticos",
      cnpjDestinatario: "99000111000166",
      nomeDestinatario: "Skin Care Brasil Varejo",
      produto: "Esfoliante Corpo e Rosto Labotrat Morango 50un",
      valorTotal: 1200.0,
      dataEmissao: "2026-02-28",
      numeroNF: "000011902",
    },

    // --- SHOPEE ---
    {
      fileName: "nf_tramontina_shopee_33410.pdf",
      filePath: "data/nfs/nf_tramontina_shopee_33410.pdf",
      rawText: MOCK_NF_TEXT,
      cnpjEmitente: "55666777000122",
      nomeEmitente: "Central das Utilidades Atacado",
      cnpjDestinatario: "22333444000188",
      nomeDestinatario: "Casa Perfeita SP Comercio",
      produto: "Jogo de Facas Tramontina Plenus 6 Peças",
      valorTotal: 1850.0,
      dataEmissao: "2026-01-10",
      numeroNF: "000033410",
    },
    {
      fileName: "nf_mundial_shopee_09921.pdf",
      filePath: "data/nfs/nf_mundial_shopee_09921.pdf",
      rawText: MOCK_NF_TEXT,
      cnpjEmitente: "88999000000144",
      nomeEmitente: "Fornecedora Salão Pro Distribuidora",
      cnpjDestinatario: "44555666000111",
      nomeDestinatario: "Salão e Cia Store",
      produto: "Tesoura Profissional Mundial Fio Laser 20un",
      valorTotal: 3400.0,
      dataEmissao: "2026-03-12",
      numeroNF: "000009921",
    },
    {
      fileName: "nf_pacco_shopee_77654.pdf",
      filePath: "data/nfs/nf_pacco_shopee_77654.pdf",
      rawText: MOCK_NF_TEXT,
      cnpjEmitente: "22111000000133",
      nomeEmitente: "Distribuidora Esportiva BR",
      cnpjDestinatario: "66777888000199",
      nomeDestinatario: "Aventura Esportes BR Artigos",
      produto: "Copo Térmico Pacco 500ml Inox",
      valorTotal: 5600.0,
      dataEmissao: "2026-02-05",
      numeroNF: "000077654",
    },
    {
      fileName: "nf_labotrat_shopee_44320.pdf",
      filePath: "data/nfs/nf_labotrat_shopee_44320.pdf",
      rawText: MOCK_NF_TEXT,
      cnpjEmitente: "99888777000155",
      nomeEmitente: "Distribuidora Beleza Oficial",
      cnpjDestinatario: "11222333000166",
      nomeDestinatario: "Império dos Cosméticos Ltda",
      produto: "Creme Hidratante Labotrat Pêssego Caixa 30un",
      valorTotal: 950.0,
      dataEmissao: "2026-03-01",
      numeroNF: "000044320",
    },
  ];

  const contestacao: Contestacao = {
    id: `${client.id}_${Date.now()}`,
    clientId: client.id,
    clientName: client.name,
    marketplace: client.marketplace,
    vendedorNome: mockBase.vendedorNome,
    vendedorUrl: mockBase.vendedorUrl,
    textoContestacao: mockBase.textoContestacao,
    screenshotPath: mockBase.screenshotPath,
    notasFiscais: [
      MOCK_NOTAS_FISCAIS[Math.floor(Math.random() * MOCK_NOTAS_FISCAIS.length)],
    ],
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
