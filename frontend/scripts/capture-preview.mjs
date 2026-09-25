import { chromium } from "playwright";
import { mkdirSync } from "fs";

const out = "preview";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });

const pages = [
  ["home", "/"],
  ["demo", "/demo"],
  ["observer", "/observer"],
  ["admin", "/admin"],
  ["governance", "/governance"],
  ["metrics", "/metrics"],
];

for (const [name, path] of pages) {
  await page.goto(`http://localhost:3100${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  console.log("shot", name);
}

await browser.close();
