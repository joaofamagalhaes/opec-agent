import { chromium } from "playwright";

const browser = await chromium.launch({ headless: false, slowMo: 500 });
const page = await browser.newPage();

await page.goto(
  "https://brandipp.business.accounts.shopee.com/authenticate/login",
  {
    waitUntil: "networkidle",
  },
);

// Pausa — abre o inspector do Playwright no terminal
await page.pause();
