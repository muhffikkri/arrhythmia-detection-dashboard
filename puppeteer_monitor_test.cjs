const puppeteer = require('puppeteer');
const http = require('http');

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({ host: 'localhost', port, path: '/', method: 'GET', timeout: 1000 }, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

(async () => {
  let port = 5173;
  if (!(await checkPort(5173))) {
    if (await checkPort(5174)) port = 5174;
    else {
      console.log('SKIP E2E monitor: Vite tidak berjalan di 5173/5174');
      process.exit(0);
    }
  }

  const baseUrl = `http://localhost:${port}`;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/patient/monitor`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dummy_token');
      localStorage.setItem('user_id', 'dummy_user');
      localStorage.setItem('user_role', 'patient');
      localStorage.setItem('synced_device_id', 'ECG-E2E');
    });
    await page.goto(`${baseUrl}/patient/monitor`, { waitUntil: 'networkidle2', timeout: 20000 });

    const ignore = await page.$('button');
    const buttons = await page.$$eval('button', els => els.map(e => e.textContent.trim()));
    if (buttons.includes('Abaikan')) {
      const handles = await page.$$('button');
      for (const handle of handles) {
        const text = await page.evaluate(el => el.textContent.trim(), handle);
        if (text === 'Abaikan') {
          await handle.click();
          break;
        }
      }
    }

    const body = await page.content();
    const checks = {
      canvas: body.includes('ecg-scroll-container') || await page.$('#ecg-scroll-container'),
      gain: body.includes('Gain'),
      speed: body.includes('Speed'),
      playback: body.includes('Playback'),
      heartRate: body.includes('Heart Rate') && body.includes('BPM'),
      ai: body.includes('Klasifikasi AI'),
    };

    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
    if (failed.length) {
      console.error('E2E monitor gagal:', failed.join(', '));
      await browser.close();
      process.exit(1);
    }

    console.log('E2E patient/monitor passed: canvas, gain, speed, playback, heart rate BPM, klasifikasi AI');
    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error('E2E monitor failed:', error);
    await browser.close();
    process.exit(1);
  }
})();
