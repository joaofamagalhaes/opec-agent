// services/scrapers/mercadolivre.ts
// Scraper real do Mercado Livre usando Playwright.
// Faz login na conta do cliente e coleta contestações abertas.
//
// ATENÇÃO: Antes de usar em produção, verifique os Termos de Uso do ML.
// O ML pode aplicar CAPTCHA ou 2FA em contas — trate esses casos conforme necessário.

import { Page } from "playwright";
import path from "path";
import fs from "fs";
import { Client, Contestacao, Anexo } from "../../types/index.js";
import { extractNFData } from "../nfExtractor.js";

const SCREENSHOTS_DIR = path.resolve("data/screenshots");
const NF_DIR = path.resolve("data/nfs");

// ── Seletores CSS do ML ────────────────────────────────────────────────────
// ATENÇÃO: O ML atualiza o frontend com frequência.
// Se o scraper parar de funcionar, inspecione o DOM e atualize estes seletores.
const SELECTORS = {
  // Página de login
  loginEmail: "#user_id",
  loginPassword: "#user_password",
  loginButton: '[data-testid="action"] button[type="submit"]',

  // Página de denúncias / contestações
  // TODO: navegue manualmente até a área de contestações e inspecione os seletores reais
  contestacaoContainer: '[class*="complaint"]',
  contestacaoStatus: '[class*="status"]',
  contestacaoText: '[class*="seller-response"]',
  vendedorNome: '[class*="seller-name"]',
  vendedorUrl: '[class*="seller-link"]',
  nfAttachment: '[class*="attachment"] a',
};

/**
 * Faz login no Mercado Livre com as credenciais do cliente.
 * Retorna true se login bem-sucedido, false se falhou.
 */
async function login(
  page: Page,
  username: string,
  password: string,
): Promise<boolean> {
  try {
    await page.goto("https://www.mercadolivre.com.br/", {
      waitUntil: "networkidle",
    });

    // Clicar em "Entrar" se necessário
    const loginLink = page.locator('a[href*="login"]').first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
    }

    // Preencher e-mail
    await page.waitForSelector(SELECTORS.loginEmail, { timeout: 10_000 });
    await page.fill(SELECTORS.loginEmail, username);
    await page.keyboard.press("Enter");

    // Preencher senha
    await page.waitForSelector(SELECTORS.loginPassword, { timeout: 10_000 });
    await page.fill(SELECTORS.loginPassword, password);
    await page.keyboard.press("Enter");

    // Aguardar redirecionamento pós-login
    await page.waitForNavigation({ timeout: 15_000 });

    // Verifica se login foi bem-sucedido (presença de elemento autenticado)
    // TODO: ajustar seletor conforme DOM real do ML pós-login
    const loggedIn = await page
      .locator('[class*="nav-user"]')
      .isVisible()
      .catch(() => false);
    return loggedIn;
  } catch (err) {
    console.error("Erro no login ML:", err);
    return false;
  }
}

/**
 * Navega até a área de contestações do cliente no ML.
 * TODO: mapeie a URL exata da área de denúncias/contestações do ML para marcas.
 */
async function navigateToContestacoes(page: Page): Promise<void> {
  // URL típica — pode variar conforme tipo de conta (marca, anunciante, etc.)
  // Inspecione manualmente navegando até a área de contestações e copie a URL.
  await page.goto("https://www.mercadolivre.com.br/anuncios/contestacoes", {
    waitUntil: "networkidle",
    timeout: 20_000,
  });
}

/**
 * Coleta todas as contestações abertas na página atual.
 */
async function collectContestacoes(
  page: Page,
  client: Client,
): Promise<Contestacao[]> {
  const results: Contestacao[] = [];

  // TODO: ajuste o seletor para o container real de cada contestação
  const items = await page.locator(SELECTORS.contestacaoContainer).all();

  for (const item of items) {
    try {
      // Captura o texto de resposta do vendedor
      const texto = await item
        .locator(SELECTORS.contestacaoText)
        .innerText()
        .catch(() => "");

      // Captura nome e URL do vendedor
      const vendedorNome = await item
        .locator(SELECTORS.vendedorNome)
        .innerText()
        .catch(() => "vendedor desconhecido");

      const vendedorUrl = await item
        .locator(SELECTORS.vendedorUrl)
        .getAttribute("href")
        .catch(() => "");

      // Screenshot da contestação
      const screenshotName = `ml_${client.id}_${Date.now()}.png`;
      const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotName);
      await item.screenshot({ path: screenshotPath });

      // Baixa NFs anexadas
      const notasFiscais = await downloadNFs(page, item, client);

      results.push({
        id: `ml_${client.id}_${Date.now()}`,
        clientId: client.id,
        clientName: client.name,
        marketplace: "mercadolivre",
        vendedorNome,
        vendedorUrl: vendedorUrl ?? "",
        textoContestacao: texto,
        screenshotPath,
        notasFiscais,
        status: "nova",
        foundAt: new Date().toISOString(),
        encaminhadaAt: null,
        revisadaAt: null,
        anexo: [],
      });
    } catch (err) {
      console.error("Erro ao coletar contestação ML:", err);
    }
  }

  return results;
}

/**
 * Baixa os PDFs de NF anexados a uma contestação e extrai dados com IA.
 */
async function downloadNFs(page: Page, item: any, client: Client) {
  const nfs = [];

  // TODO: ajustar seletor para links de NF reais
  const attachmentLinks = await item.locator(SELECTORS.nfAttachment).all();

  for (const link of attachmentLinks) {
    try {
      const href = await link.getAttribute("href");
      if (!href) continue;

      // Download do PDF via fetch (mais confiável que click em Playwright)
      const cookies = await page.context().cookies();
      const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

      const response = await page.evaluate(
        async ({
          url,
          cookieHeader,
        }: {
          url: string;
          cookieHeader: string;
        }) => {
          const r = await fetch(url, { headers: { Cookie: cookieHeader } });
          const buffer = await r.arrayBuffer();
          return Array.from(new Uint8Array(buffer));
        },
        { url: href, cookieHeader: cookieStr },
      );

      const fileName = `nf_${client.id}_${Date.now()}.pdf`;
      const filePath = path.join(NF_DIR, fileName);
      fs.writeFileSync(filePath, Buffer.from(response));

      // TODO: usar pdf-parse para extrair texto real do PDF
      // import pdfParse from "pdf-parse";
      // const data = await pdfParse(fs.readFileSync(filePath));
      // const rawText = data.text;

      // Por enquanto usa placeholder — substitua pelo texto extraído do PDF
      const rawText = `[PDF baixado: ${fileName}] — implemente pdf-parse para extrair texto`;

      const nf = await extractNFData(rawText, fileName, filePath);
      nfs.push(nf);
    } catch (err) {
      console.error("Erro ao baixar NF:", err);
    }
  }

  return nfs;
}

/**
 * Entry point: escaneia a conta do cliente no ML e retorna contestações.
 */
export async function scrapeMercadoLivre(
  page: Page,
  client: Client,
): Promise<Contestacao[]> {
  console.log(`[ML] Iniciando scan: ${client.name}`);

  const loggedIn = await login(page, client.username, client.password);
  if (!loggedIn) {
    console.error(`[ML] Falha no login para ${client.name}`);
    return [];
  }

  await navigateToContestacoes(page);
  const contestacoes = await collectContestacoes(page, client);

  console.log(
    `[ML] ${contestacoes.length} contestação(ões) encontrada(s) para ${client.name}`,
  );
  return contestacoes;
}
