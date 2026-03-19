// services/scrapers/shopee.ts
// Scraper da Shopee — estrutura idêntica ao mercadolivre.ts.
// Implemente os seletores e fluxo de login conforme o DOM real da Shopee.

import { Page } from "playwright";
import path from "path";
import fs from "fs";
import { Client, Contestacao } from "../types/index.js";
import { extractNFData } from "./nfExtractor.js";

const SCREENSHOTS_DIR = path.resolve("data/screenshots");
const NF_DIR = path.resolve("data/nfs");

// ── Seletores CSS da Shopee ────────────────────────────────────────────────
// TODO: inspecione o DOM real da Shopee e preencha estes seletores.
// A Shopee usa React com classes geradas dinamicamente — prefira atributos
// data-* ou seletores de texto quando possível, pois são mais estáveis.
const SELECTORS = {
  loginUsername: '[name="loginKey"]',
  loginPassword: '[name="password"]',
  loginButton:   'button[type="submit"]',

  // Área do seller center / gestão de denúncias
  // TODO: mapear URL e seletores reais
  contestacaoContainer: '[class*="dispute"]',
  contestacaoText:      '[class*="seller-reply"]',
  vendedorNome:         '[class*="shop-name"]',
  vendedorUrl:          '[class*="shop-link"]',
  nfAttachment:         '[class*="file-attachment"] a',
};

async function login(page: Page, username: string, password: string): Promise<boolean> {
  try {
    // A Shopee tem fluxo de login diferente dependendo da região
    // Use https://seller.shopee.com.br/ para contas de vendedor
    await page.goto("https://seller.shopee.com.br/", { waitUntil: "networkidle" });

    await page.waitForSelector(SELECTORS.loginUsername, { timeout: 10_000 });
    await page.fill(SELECTORS.loginUsername, username);
    await page.fill(SELECTORS.loginPassword, password);
    await page.click(SELECTORS.loginButton);

    await page.waitForNavigation({ timeout: 15_000 });

    // TODO: verificar seletor de estado autenticado da Shopee
    const loggedIn = await page.locator('[class*="account"]').isVisible().catch(() => false);
    return loggedIn;

  } catch (err) {
    console.error("Erro no login Shopee:", err);
    return false;
  }
}

async function navigateToContestacoes(page: Page): Promise<void> {
  // TODO: substituir pela URL real da área de contestações/denúncias da Shopee
  await page.goto(
    "https://seller.shopee.com.br/portal/dispute",
    { waitUntil: "networkidle", timeout: 20_000 }
  );
}

async function collectContestacoes(page: Page, client: Client): Promise<Contestacao[]> {
  const results: Contestacao[] = [];
  const items = await page.locator(SELECTORS.contestacaoContainer).all();

  for (const item of items) {
    try {
      const texto = await item.locator(SELECTORS.contestacaoText).innerText().catch(() => "");
      const vendedorNome = await item.locator(SELECTORS.vendedorNome).innerText().catch(() => "");
      const vendedorUrl  = await item.locator(SELECTORS.vendedorUrl).getAttribute("href").catch(() => "");

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
        revisadaAt: null,
      });

    } catch (err) {
      console.error("Erro ao coletar contestação Shopee:", err);
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

      const cookies  = await page.context().cookies();
      const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

      const response = await page.evaluate(
        async ({ url, cookieHeader }: { url: string; cookieHeader: string }) => {
          const r = await fetch(url, { headers: { Cookie: cookieHeader } });
          const buffer = await r.arrayBuffer();
          return Array.from(new Uint8Array(buffer));
        },
        { url: href, cookieHeader: cookieStr }
      );

      const fileName = `nf_shopee_${client.id}_${Date.now()}.pdf`;
      const filePath = path.join(NF_DIR, fileName);
      fs.writeFileSync(filePath, Buffer.from(response));

      const rawText = `[PDF baixado: ${fileName}] — implemente pdf-parse para extrair texto`;
      const nf = await extractNFData(rawText, fileName, filePath);
      nfs.push(nf);

    } catch (err) {
      console.error("Erro ao baixar NF Shopee:", err);
    }
  }

  return nfs;
}

export async function scrapeShopee(page: Page, client: Client): Promise<Contestacao[]> {
  console.log(`[Shopee] Iniciando scan: ${client.name}`);

  const loggedIn = await login(page, client.username, client.password);
  if (!loggedIn) {
    console.error(`[Shopee] Falha no login para ${client.name}`);
    return [];
  }

  await navigateToContestacoes(page);
  const contestacoes = await collectContestacoes(page, client);

  console.log(`[Shopee] ${contestacoes.length} contestação(ões) para ${client.name}`);
  return contestacoes;
}
