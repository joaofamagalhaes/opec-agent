// services/scrapers/mercadolivre.ts
// Scraper real do Mercado Livre usando Playwright.
// Faz login na conta do cliente e coleta contestações abertas.
//
// ATENÇÃO: Antes de usar em produção, verifique os Termos de Uso do ML.
// O ML pode aplicar CAPTCHA ou 2FA — trate esses casos conforme necessário.
//
// Como validar os seletores:
//   1. Sete PLAYWRIGHT_HEADLESS=false no .env
//   2. Rode um scan — o browser abrirá visível
//   3. Inspecione os elementos e atualize o objeto SELECTORS abaixo

import { Page } from "playwright";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
import { Client, Contestacao } from "../../types/index.js";
import { extractNFData } from "../nfExtractor.js";

const SCREENSHOTS_DIR = path.resolve("data/screenshots");
const NF_DIR = path.resolve("data/nfs");

// ── Seletores CSS do ML ────────────────────────────────────────────────────
// O ML atualiza o frontend com frequência — se o scraper parar, inspecione o
// DOM com PLAYWRIGHT_HEADLESS=false e atualize os seletores aqui.
const SELECTORS = {
  // Página de login
  loginEmail:    '#user_id',
  loginPassword: '#user_password',
  loginButton:   '[data-testid="action"] button[type="submit"]',

  // Indicador de sessão autenticada (ajuste conforme DOM real pós-login)
  loggedInIndicator: '[class*="nav-user"]',

  // Contestações (ajuste após inspeção manual)
  contestacaoContainer: '[class*="complaint"]',
  contestacaoText:      '[class*="seller-response"]',
  vendedorNome:         '[class*="seller-name"]',
  vendedorUrl:          '[class*="seller-link"]',
  nfAttachment:         '[class*="attachment"] a',
};

async function login(page: Page, username: string, password: string): Promise<boolean> {
  try {
    await page.goto("https://www.mercadolivre.com.br/", { waitUntil: "networkidle" });

    const loginLink = page.locator('a[href*="login"]').first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
    }

    await page.waitForSelector(SELECTORS.loginEmail, { timeout: 10_000 });
    await page.fill(SELECTORS.loginEmail, username);
    await page.keyboard.press("Enter");

    await page.waitForSelector(SELECTORS.loginPassword, { timeout: 10_000 });
    await page.fill(SELECTORS.loginPassword, password);
    await page.keyboard.press("Enter");

    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    const loggedIn = await page
      .locator(SELECTORS.loggedInIndicator)
      .isVisible()
      .catch(() => false);

    if (!loggedIn) {
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `debug_ml_login_fail_${Date.now()}.png`),
      });
    }

    return loggedIn;
  } catch (err) {
    console.error("[ML] Erro no login:", err);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `debug_ml_login_error_${Date.now()}.png`),
    }).catch(() => {});
    return false;
  }
}

async function navigateToContestacoes(page: Page): Promise<void> {
  // Inspecione manualmente a URL da área de contestações e atualize aqui.
  await page.goto(
    "https://www.mercadolivre.com.br/anuncios/contestacoes",
    { waitUntil: "networkidle", timeout: 20_000 }
  );
}

async function collectContestacoes(page: Page, client: Client): Promise<Contestacao[]> {
  const results: Contestacao[] = [];

  const items = await page.locator(SELECTORS.contestacaoContainer).all();

  for (const item of items) {
    try {
      const texto = await item
        .locator(SELECTORS.contestacaoText)
        .innerText()
        .catch(() => "");

      const vendedorNome = await item
        .locator(SELECTORS.vendedorNome)
        .innerText()
        .catch(() => "vendedor desconhecido");

      const vendedorUrl = await item
        .locator(SELECTORS.vendedorUrl)
        .getAttribute("href")
        .catch(() => "");

      const screenshotName = `ml_${client.id}_${Date.now()}.png`;
      const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotName);
      await item.screenshot({ path: screenshotPath });

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
      });
    } catch (err) {
      console.error("[ML] Erro ao coletar contestação:", err);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `debug_ml_collect_error_${Date.now()}.png`),
      }).catch(() => {});
    }
  }

  return results;
}

async function downloadNFs(page: Page, item: any, client: Client) {
  const nfs = [];
  const attachmentLinks = await item.locator(SELECTORS.nfAttachment).all();

  for (const link of attachmentLinks) {
    try {
      const href = await link.getAttribute("href");
      if (!href) continue;

      const cookies = await page.context().cookies();
      const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

      const response = await page.evaluate(
        async ({ url, cookieHeader }: { url: string; cookieHeader: string }) => {
          const r = await fetch(url, { headers: { Cookie: cookieHeader } });
          const buffer = await r.arrayBuffer();
          return Array.from(new Uint8Array(buffer));
        },
        { url: href, cookieHeader: cookieStr }
      );

      const fileName = `nf_ml_${client.id}_${Date.now()}.pdf`;
      const filePath = path.join(NF_DIR, fileName);
      fs.writeFileSync(filePath, Buffer.from(response));

      const pdfData = await pdfParse(fs.readFileSync(filePath));
      const rawText = pdfData.text;

      const nf = await extractNFData(rawText, fileName, filePath);
      nfs.push(nf);
    } catch (err) {
      console.error("[ML] Erro ao baixar/processar NF:", err);
    }
  }

  return nfs;
}

export async function scrapeMercadoLivre(page: Page, client: Client): Promise<Contestacao[]> {
  console.log(`[ML] Iniciando scan: ${client.name}`);

  const loggedIn = await login(page, client.username, client.password);
  if (!loggedIn) {
    console.error(`[ML] Falha no login para ${client.name}`);
    return [];
  }

  await navigateToContestacoes(page);
  const contestacoes = await collectContestacoes(page, client);

  console.log(`[ML] ${contestacoes.length} contestação(ões) encontrada(s) para ${client.name}`);
  return contestacoes;
}
