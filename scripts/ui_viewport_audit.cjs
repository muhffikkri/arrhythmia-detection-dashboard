const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUT_DIR = 'C:/Users/MUHFFI~1/AppData/Local/Temp/opencode/ui-audit';

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({ host: 'localhost', port, path: '/', method: 'GET', timeout: 1500 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body.includes('/src/main.tsx')));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667, isMobile: true, hasTouch: true, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { name: 'tablet', width: 768, height: 1024, isMobile: true, hasTouch: true, ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' },
];

const ROLES = ['admin', 'dokter', 'pasien'];

const PAGES = [
  { url: '/', role: null, expects: ['nav'] },
  { url: '/how-it-works', role: null, expects: [] },
  { url: '/faq', role: null, expects: [] },
  { url: '/auth', role: null, expects: [] },
  { url: '/auth/login', role: null, expects: ['input[type="email"]', 'input[type="password"]', 'button[type="submit"]'] },
  { url: '/auth/register', role: null, expects: ['input', 'button[type="submit"]'] },
  { url: '/admin/dashboard', role: 'admin', expects: [] },
  { url: '/admin/users', role: 'admin', expects: [] },
  { url: '/admin/devices', role: 'admin', expects: [] },
  { url: '/admin/sessions', role: 'admin', expects: [] },
  { url: '/admin/analytics', role: 'admin', expects: [] },
  { url: '/doctor/dashboard', role: 'dokter', expects: [] },
  { url: '/doctor/analytics', role: 'dokter', expects: [] },
  { url: '/doctor/qr-scanner', role: 'dokter', expects: [] },
  { url: '/doctor/profile', role: 'dokter', expects: [] },
  { url: '/patient/dashboard', role: 'pasien', expects: [] },
  { url: '/patient/qr-sync', role: 'pasien', expects: [] },
  { url: '/patient/device-scanner', role: 'pasien', expects: [] },
  { url: '/patient/history', role: 'pasien', expects: [] },
  { url: '/patient/profile', role: 'pasien', expects: [] },
  { url: '/patient/settings', role: 'pasien', expects: [] },
  { url: '/patient/monitor', role: 'pasien', expects: ['button'] },
  { url: '/nonexistent-page', role: null, expects: [] },
];

const results = [];
const consoleIssues = [];

(async () => {
  let port = Number(process.env.E2E_PORT);
  if (!port) {
    port = 5173;
    if (!(await checkPort(5173))) port = 5174;
  }
  const baseUrl = `http://localhost:${port}`;
  console.log(`Audit base URL: ${baseUrl}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
    await page.setUserAgent(vp.ua);

    const pageLoadErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageLoadErrors.push(msg.text().slice(0, 200));
    });
    page.on('pageerror', (err) => pageLoadErrors.push('PAGEERROR: ' + String(err).slice(0, 200)));

    for (const pg of PAGES) {
      const key = `${vp.name}_${pg.url.replace(/\//g, '_') || 'root'}`;

      try {
        await page.goto(`${baseUrl}${pg.url}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        if (pg.role) {
          await page.evaluate((role) => {
            localStorage.setItem('auth_token', 'dummy_token');
            localStorage.setItem('user_id', 'dummy_user');
            localStorage.setItem('user_role', role);
            localStorage.setItem('SECURITY_DEVTOOLS_BLOCKED', 'false');
          }, pg.role);
          await page.goto(`${baseUrl}${pg.url}`, { waitUntil: 'networkidle2', timeout: 25000 });
        } else {
          await page.evaluate(() => localStorage.setItem('SECURITY_DEVTOOLS_BLOCKED', 'false'));
          await new Promise((r) => setTimeout(r, 1200));
        }

        if (pg.url === '/patient/monitor') {
          try {
            const btns = await page.$$eval('button', (els) => els.map((e) => e.textContent.trim()));
            const handles = await page.$$('button');
            for (let i = 0; i < handles.length; i++) {
              if (btns[i] === 'Abaikan') { await handles[i].click(); break; }
            }
          } catch {}
        }

        await new Promise((r) => setTimeout(r, 800));

        const audit = await page.evaluate(() => {
          const de = document.documentElement;
          const offenders = [];
          if (de.scrollWidth > de.clientWidth + 2) {
            const els = Array.from(document.querySelectorAll('body *'));
            for (const el of els) {
              const style = getComputedStyle(el);
              if (style.position === 'fixed' || style.position === 'absolute' || el.tagName === 'CANVAS' || el.tagName === 'SVG') continue;
              const r = el.getBoundingClientRect();
              const vw = window.innerWidth;
              const marginErr = 2;
              if (r.width > 0 && (r.right > vw + marginErr)) {
                offenders.push({
                  tag: el.tagName.toLowerCase(),
                  cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 60),
                  right: Math.round(r.right),
                  vw,
                  text: (el.textContent || '').trim().slice(0, 40),
                });
                if (offenders.length >= 12) break;
              }
            }
          }
          const textLen = (document.body && document.body.textContent ? document.body.textContent.length : 0);
          return {
            title: document.title,
            scrollW: de.scrollWidth,
            clientW: de.clientWidth,
            hOverflow: de.scrollWidth > de.clientWidth + 2,
            offenders,
            textLen,
            buttons: document.querySelectorAll('button').length,
            inputs: document.querySelectorAll('input').length,
            links: document.querySelectorAll('a').length,
            images: Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length,
          };
        });

        const expectedSelectors = [];
        for (const sel of pg.expects) {
          const found = await page.$(sel);
          if (!found) expectedSelectors.push(sel);
        }

        const status = audit.hOverflow ? 'FAIL' : 'OK';
        const row = {
          viewport: vp.name,
          url: pg.url,
          status,
          title: audit.title,
          scrollW: audit.scrollW,
          clientW: audit.clientW,
          textLen: audit.textLen,
          offenders: audit.offenders.length,
          consoleErrors: pageLoadErrors.length,
          brokenImages: audit.images,
          missingSelectors: expectedSelectors,
        };
        results.push(row);

        if (audit.hOverflow || pageLoadErrors.length > 0 || audit.images > 0 || expectedSelectors.length) {
          consoleIssues.push(row);
          console.log(`[${status}] ${vp.name.padEnd(8)} ${pg.url.padEnd(34)} title="${audit.title}"`);
          if (audit.hOverflow) {
            for (const o of audit.offenders.slice(0, 6)) {
              console.log(`        overflow: <${o.tag} class="${o.cls}"> right=${o.right} vw=${o.vw} text="${o.text}"`);
            }
          }
          if (pageLoadErrors.length) {
            console.log(`        console errors (${pageLoadErrors.length}): ${pageLoadErrors.slice(0, 3).join(' | ')}`);
          }
          if (audit.brokenImages > 0) console.log(`        broken images: ${audit.brokenImages}`);
          if (expectedSelectors.length) console.log(`        missing selectors: ${expectedSelectors.join(', ')}`);
        }

        await page.screenshot({ path: path.join(OUT_DIR, `${key}.png`) });
        pageLoadErrors.length = 0;
      } catch (e) {
        results.push({ viewport: vp.name, url: pg.url, status: 'CRASH', error: String(e).slice(0, 200) });
        console.log(`[CRASH] ${vp.name.padEnd(8)} ${pg.url.padEnd(34)} ${String(e).slice(0, 150)}`);
      }
    }
    await page.close();
  }

  await browser.close();

  const summary = {
    total: results.length,
    ok: results.filter((r) => r.status === 'OK').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    crash: results.filter((r) => r.status === 'CRASH').length,
  };
  console.log('\n=============== RINGKASAN ===============');
  console.log(JSON.stringify(summary));
  const fails = results.filter((r) => r.status !== 'OK');
  if (fails.length) {
    console.log('\nDaftar masalah:');
    for (const f of fails) {
      console.log(` - [${f.status}] ${f.viewport} ${f.url} ${f.error || ''}`);
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`\nHasil lengkap: ${path.join(OUT_DIR, 'results.json')}`);
  process.exit(summary.fail === 0 && summary.crash === 0 ? 0 : 1);
})();