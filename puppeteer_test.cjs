const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));

  console.log("Navigating to login...");
  await page.goto('http://localhost:5174/auth/login');
  
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'pkmkcwearableecg@gmail.com');
  await page.type('input[type="password"]', 'pppp');
  await page.click('button[type="submit"]');
  
  console.log("Waiting for navigation to dashboard...");
  await page.waitForNavigation();
  
  console.log("Navigating to sessions page...");
  await page.goto('http://localhost:5174/admin/sessions');
  
  console.log("Waiting for detail button...");
  await page.waitForSelector('button:has-text("Detail")', { timeout: 10000 }).catch(e => console.log("No detail button found:", e.message));
  
  const detailButtons = await page.$$('button');
  let detailBtn = null;
  for (const btn of detailButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Detail')) {
          detailBtn = btn;
          break;
      }
  }
  
  if (detailBtn) {
      console.log("Clicking Detail...");
      await detailBtn.click();
      console.log("Waiting 3 seconds for page to load...");
      await new Promise(r => setTimeout(r, 3000));
      
      const content = await page.content();
      if (content.includes('Error!')) {
          console.log("FOUND ERROR BOUNDARY!");
          const errText = await page.evaluate(() => {
              const pre = document.querySelector('pre');
              return pre ? pre.textContent : 'No stack trace';
          });
          console.log("Error details:", errText);
      } else {
          console.log("No Error Boundary. Page HTML length:", content.length);
          const hasAdminSidebar = content.includes('Manajemen Sesi');
          console.log("Has Sidebar?", hasAdminSidebar);
      }
  } else {
      console.log("Could not find Detail button");
  }
  
  await browser.close();
})();
