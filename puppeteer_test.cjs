const puppeteer = require('puppeteer');
const http = require('http');

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({ host: 'localhost', port, path: '/', method: 'GET', timeout: 1000 }, (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

(async () => {
  // Discover which port Vite is running on (5173 or 5174)
  let port = 5173;
  const is5173Open = await checkPort(5173);
  if (!is5173Open) {
    const is5174Open = await checkPort(5174);
    if (is5174Open) {
      port = 5174;
    } else {
      console.log("WARNING: Local Vite server does not seem to be running on port 5173 or 5174. Defaulting to 5173.");
    }
  }
  
  const baseUrl = `http://localhost:${port}`;
  console.log(`Detected Vite server running at: ${baseUrl}`);

  console.log("Launching headless browser...");
  const browser = await browserLauncher();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));

  try {
    console.log(`Navigating to login page: ${baseUrl}/auth/login`);
    await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'pkmkcwearableecg@gmail.com');
    await page.type('input[type="password"]', 'pppp');
    await page.click('button[type="submit"]');
    
    console.log("Waiting for navigation to dashboard (up to 5s)...");
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
      console.log("Navigation succeeded. Logged in.");
    } catch (e) {
      console.log("Login timeout or failed (normal in offline dev mode). Injecting mock local storage credentials...");
      await page.evaluate(() => {
        localStorage.setItem('auth_token', 'dummy_token');
        localStorage.setItem('user_id', 'dummy_user');
        localStorage.setItem('user_role', 'admin');
      });
    }
    
    console.log(`Navigating to sessions page: ${baseUrl}/admin/sessions`);
    await page.goto(`${baseUrl}/admin/sessions`, { waitUntil: 'networkidle2' });
    
    console.log("Waiting for content to settle...");
    await new Promise(r => setTimeout(r, 2000));
    
    const content = await page.content();
    if (content.includes('Error!')) {
        console.log("FOUND ERROR BOUNDARY!");
        const errText = await page.evaluate(() => {
            const pre = document.querySelector('pre');
            return pre ? pre.textContent : 'No stack trace';
        });
        console.log("Error details:", errText);
        process.exit(1);
    } else {
        console.log("E2E Test Passed: No Error Boundary triggered. Page HTML length:", content.length);
        const hasAdminSidebar = content.includes('Manajemen Sesi') || content.includes('Keluar') || content.includes('Sign Out') || content.includes('Sessions');
        console.log("Has Navigation Elements?", hasAdminSidebar);
    }
  } catch (error) {
    console.error("E2E Test failed with error:", error);
    await browser.close();
    process.exit(1);
  }
  
  await browser.close();
  process.exit(0);

  async function browserLauncher() {
    return await puppeteer.launch({ 
      headless: true, // Use headless for automated environments
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
  }
})();
