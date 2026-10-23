const { chromium } = require("C:/Users/Impacto Telecom/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 780, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(__dirname, "preview.html")).href);
  const frame = page.frames().find((item) => item !== page.mainFrame());
  await frame.waitForSelector(".ac-day");
  await frame.evaluate(() => document.fonts.ready);
  const results = [];
  for (const theme of ["Claro", "Escuro"]) {
    for (const width of [142, 221]) {
      await frame.evaluate(({ theme, width }) => {
        window.dispatchEvent(new CustomEvent("openai:set_globals", { detail: { globals: { widgetState: { privateContent: { tema: theme, largura: width === 142 ? "Notebook · 142 px" : "Monitor · 221 px" } } } } }));
      }, { theme, width });
      const measures = await frame.evaluate(() => {
        const texts = [];
        for (const el of document.querySelectorAll(".ac-day-header > *, .ac-answer-label, .ac-answer-value, .ac-occupancy")) {
          if (el.scrollWidth > el.clientWidth + 1) texts.push(el.textContent);
        }
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        function rgb(color) {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
        }
        function lum(color) {
          return rgb(color).map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        }
        function contrast(a, b) {
          const x = lum(a), y = lum(b);
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        }
        const marks = [...document.querySelectorAll(".ac-shift")].map((shift) => {
          const fill = getComputedStyle(shift.querySelector(".ac-fill")).backgroundColor;
          const track = getComputedStyle(shift.querySelector(".ac-track")).backgroundColor;
          const background = getComputedStyle(shift.closest(".ac-day")).backgroundColor;
          const text = getComputedStyle(shift.querySelector(".ac-answer-value")).color;
          const secondary = getComputedStyle(shift.querySelector(".ac-occupancy")).color;
          return { tone: shift.dataset.tone, barContrast: contrast(fill, track), dotContrast: contrast(fill, background), textContrast: contrast(text, background), secondaryContrast: contrast(secondary, background) };
        });
        return {
          card: [...document.querySelectorAll(".ac-day")].map((el) => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
          turnWidth: document.querySelector(".ac-shift").getBoundingClientRect().width,
          textOverflow: texts,
          pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          font: document.fonts.check('12px "IBM Plex Sans"'),
          columns: document.getElementById("ac-product").dataset.columns,
          marks
        };
      });
      assert(measures.card.every((r) => r.width === width && r.height === 220));
      assert.equal(measures.turnWidth, width - 34);
      assert.deepEqual(measures.textOverflow, []);
      assert.equal(measures.pageOverflow, false);
      for (const mark of measures.marks) {
        assert(mark.barContrast >= 3, JSON.stringify(mark));
        assert(mark.dotContrast >= 3, JSON.stringify(mark));
        assert(mark.textContrast >= 4.5, JSON.stringify(mark));
        assert(mark.secondaryContrast >= 4.5, JSON.stringify(mark));
      }
      await page.screenshot({ path: path.join(__dirname, `amostra-${theme.toLowerCase()}-${width}.png`), fullPage: true });
      results.push({ theme, width, turnWidth: measures.turnWidth, height: 220, columns: measures.columns, font: measures.font, minBarContrast: Math.min(...measures.marks.map((m) => m.barContrast)), minTextContrast: Math.min(...measures.marks.map((m) => Math.min(m.textContrast, m.secondaryContrast))) });
    }
  }
  await frame.locator(".ac-day").nth(4).locator(".ac-shift").nth(1).click();
  assert.equal(await frame.locator("#ac-dialog").evaluate((el) => el.open), true);
  assert((await frame.locator("#ac-metrics").innerText()).includes("89h"));
  assert((await frame.locator("#ac-note").innerText()).includes("3h48"));
  await page.screenshot({ path: path.join(__dirname, "amostra-detalhe.png"), fullPage: true });
  await page.keyboard.press("Escape");
  assert.equal(await frame.locator("#ac-dialog").evaluate((el) => el.open), false);
  await page.setViewportSize({ width: 320, height: 900 });
  await frame.waitForFunction(() => document.getElementById("ac-product").dataset.columns === "1");
  const narrowOverflow = await frame.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(narrowOverflow, false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, dialog: "abriu, exibiu os dados corretos e fechou com Escape", narrow: "sem corte horizontal em 320px", errors }, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
