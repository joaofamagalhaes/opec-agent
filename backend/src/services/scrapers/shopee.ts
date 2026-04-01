// services/scrapers/shopee.ts
// Scraper da Shopee — estrutura idêntica ao mercadolivre.ts.
//
// Como validar os seletores:
//   1. Sete PLAYWRIGHT_HEADLESS=false no .env
//   2. Rode um scan — o browser abrirá visível
//   3. Inspecione os elementos e atualize o objeto SELECTORS abaixo
//
// A Shopee usa React com classes geradas dinamicamente — prefira atributos
// data-* ou seletores de texto quando possível, pois são mais estáveis.

import { Page } from "playwright";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (
  buf: Buffer,
) => Promise<{ text: string }>;
import { Client, Contestacao } from "../../types/index.js";
import { extractNFData } from "../nfExtractor.js";

const SCREENSHOTS_DIR = path.resolve("data/screenshots");
const NF_DIR = path.resolve("data/nfs");

// ── Seletores CSS da Shopee ────────────────────────────────────────────────
const SELECTORS = {
  loginUsername:
    '[placeholder="Professional Work Email"], [placeholder="Email de Trabalho"] ',
  loginPassword: '[placeholder="Password"], [placeholder="Senha"]',
  loginButton: 'button:has-text("Log In"), button:has-text("Entrar")',

  // Indicador de sessão autenticada (ajuste após inspeção manual)
  loggedInIndicator: '[class*="account"]',

  // Área de disputas/contestações (ajuste após inspeção manual)
  contestacaoContainer: '[class*="dispute"]',
  contestacaoText: '[class*="seller-reply"]',
  vendedorNome: '[class*="shop-name"]',
  vendedorUrl: '[class*="shop-link"]',
  nfAttachment: '[class*="file-attachment"] a',
};

async function login(
  page: Page,
  username: string,
  password: string,
): Promise<boolean> {
  try {
    await page.goto(
      "https://brandipp.business.accounts.shopee.com/authenticate/login?lang=pt-BR&should_hide_back=true&client_id=9&next=https%3A%2F%2Fbrandipp.shopee.com",
      {
        waitUntil: "networkidle",
      },
    );

    await page.waitForSelector(SELECTORS.loginUsername, { timeout: 10_000 });
    await page.fill(SELECTORS.loginUsername, username);
    await page.fill(SELECTORS.loginPassword, password);
    await page.click(SELECTORS.loginButton);

    await page.waitForLoadState("networkidle", { timeout: 15_000 });
    await page.waitForTimeout(3_000);

    const loggedIn = await page

      .locator(SELECTORS.loggedInIndicator)
      .isVisible()
      .catch(() => false);

    if (!loggedIn) {
      await page.waitForTimeout(3_000);
      await page.screenshot({
        path: path.join(
          SCREENSHOTS_DIR,
          `debug_shopee_login_fail_${Date.now()}.png`,
        ),
      });
    }

    return loggedIn;
  } catch (err) {
    console.error("[Shopee] Erro no login:", err);
    await page
      .screenshot({
        path: path.join(
          SCREENSHOTS_DIR,
          `debug_shopee_login_error_${Date.now()}.png`,
        ),
      })
      .catch(() => {});
    return false;
  }
}

async function navigateToContestacoes(page: Page): Promise<void> {
  await page.goto("https://seller.shopee.com.br/portal/dispute", {
    waitUntil: "networkidle",
    timeout: 20_000,
  });
}

async function collectContestacoes(
  page: Page,
  client: Client,
): Promise<Contestacao[]> {
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

      const screenshotName = `shopee_${client.id}_${Date.now()}.png`;
      const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotName);
      await item.screenshot({ path: screenshotPath });

      const notasFiscais = await downloadNFs(page, item, client);

      results.push({
        id: `shopee_${client.id}_${Date.now()}`,
        clientId: client.id,
        clientName: client.name,
        marketplace: "shopee",
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
      console.error("[Shopee] Erro ao coletar contestação:", err);
      await page
        .screenshot({
          path: path.join(
            SCREENSHOTS_DIR,
            `debug_shopee_collect_error_${Date.now()}.png`,
          ),
        })
        .catch(() => {});
    }
  }

  return results;
}

async function downloadNFs(page: Page, item: any, client: Client) {
  const nfs = [];
  const links = await item.locator(SELECTORS.nfAttachment).all();

  for (const link of links) {
    try {
      const href = await link.getAttribute("href");
      if (!href) continue;

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

      const fileName = `nf_shopee_${client.id}_${Date.now()}.pdf`;
      const filePath = path.join(NF_DIR, fileName);
      fs.writeFileSync(filePath, Buffer.from(response));

      const pdfData = await pdfParse(fs.readFileSync(filePath));
      const rawText = pdfData.text;

      const nf = await extractNFData(rawText, fileName, filePath);
      nfs.push(nf);
    } catch (err) {
      console.error("[Shopee] Erro ao baixar/processar NF:", err);
    }
  }

  return nfs;
}

export async function scrapeShopee(
  page: Page,
  client: Client,
): Promise<Contestacao[]> {
  console.log(`[Shopee] Iniciando scan: ${client.name}`);

  const loggedIn = await login(page, client.username, client.password);
  if (!loggedIn) {
    console.error(`[Shopee] Falha no login para ${client.name}`);
    return [];
  }

  await navigateToContestacoes(page);
  const contestacoes = await collectContestacoes(page, client);

  console.log(
    `[Shopee] ${contestacoes.length} contestação(ões) para ${client.name}`,
  );
  return contestacoes;
}
