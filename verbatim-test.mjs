
import puppeteer from 'puppeteer';
import fs from 'fs-extra';

const LIVE_URL = 'https://www.culturalpeace.org';
const LOCAL_URL = 'http://localhost:8889/index.html';

async function verbatimTest() {
  const browser = await puppeteer.launch({ headless: false }); // Visual debugging
  
  const [livePage, localPage] = await Promise.all([
    browser.newPage(),
    browser.newPage()
  ]);
  
  // Set identical conditions
  await Promise.all([
    livePage.setViewport({ width: 1920, height: 1080 }),
    localPage.setViewport({ width: 1920, height: 1080 })
  ]);
  
  // Navigate simultaneously
  await Promise.all([
    livePage.goto(LIVE_URL, { waitUntil: 'networkidle0' }),
    localPage.goto(LOCAL_URL, { waitUntil: 'networkidle0' })
  ]);
  
  // Wait for identical conditions
  await Promise.all([
    livePage.waitForTimeout(5000),
    localPage.waitForTimeout(5000)
  ]);
  
  // Inject identical scripts to ensure identical state
  const script = `
    // Remove any dynamic content that changes
    document.querySelectorAll('[data-block-type]').forEach(el => el.removeAttribute('data-block-type'));
    document.querySelectorAll('[id^="yui"]').forEach(el => el.removeAttribute('id'));
    
    // Force identical font rendering
    document.body.style.fontFamily = '"proxima-nova", sans-serif';
    document.body.style.fontSize = '16px';
    document.body.style.lineHeight = '1.4';
    
    window.scrollTo(0, 0);
  `;
  
  await Promise.all([
    livePage.evaluate(script),
    localPage.evaluate(script)
  ]);
  
  // Take final screenshots
  const [liveShot, localShot] = await Promise.all([
    livePage.screenshot({ fullPage: true }),
    localPage.screenshot({ fullPage: true })
  ]);
  
  await fs.writeFile('./verbatim-live.png', liveShot);
  await fs.writeFile('./verbatim-local.png', localShot);
  
  console.log('✅ Verbatim screenshots saved for manual inspection');
  await browser.close();
}

verbatimTest().catch(console.error);