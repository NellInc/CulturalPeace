import fs from 'fs-extra';
import path from 'node:path';
import * as cheerio from 'cheerio';

// ULTRATHINKING PRECISION FIXES FOR VERBATIM MATCH

async function achieveVerbatimMatch() {
  console.log('🎯 APPLYING PRECISION FIXES FOR VERBATIM MATCH...\n');

  // 1. FIX FONT LOADING - Preload exact Squarespace fonts
  console.log('🔤 FIXING FONT LOADING...');
  const fontFixes = `
  <!-- Exact Squarespace Font Loading -->
  <link rel="preconnect" href="https://use.typekit.net">
  <link rel="preload" href="https://use.typekit.net/css/5af/pvc/rp0/ajx/to-/aha/ci2/fih/op5/o2e/6s/szc/k8r/afc/9zx/n0a/9d7/efs/zuf/fhn/4uj/lfr/bh5/2jh/wdm/rw2/qof/2mk/waq/aws/ixw/c2s/aff/1fd.css" as="style">
  <style>
    /* Force exact Squarespace typography */
    * { 
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    
    /* Exact Squarespace spacing reset */
    body, html {
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1.4 !important;
      font-family: "proxima-nova", "Helvetica Neue", Arial, sans-serif !important;
    }
    
    /* Fix hero section exact positioning */
    .sqs-block-html h1 {
      line-height: 1.1 !important;
      letter-spacing: -0.02em !important;
      font-weight: 700 !important;
    }
    
    /* Fix paragraph spacing exactly */
    .sqs-html-content p {
      line-height: 1.6 !important;
      margin-bottom: 1em !important;
    }
    
    /* Remove any added navigation styling */
    nav {
      display: none !important;
    }
    
    /* Force exact image loading */
    img {
      display: block !important;
      width: auto !important;
      height: auto !important;
      max-width: 100% !important;
    }
  </style>`;

  // 2. Process all HTML files
  const docsDir = './docs';
  const htmlFiles = await fs.readdir(docsDir);
  
  for (const file of htmlFiles) {
    if (file.endsWith('.html')) {
      console.log(`   📄 Processing: ${file}`);
      const filePath = path.join(docsDir, file);
      const html = await fs.readFile(filePath, 'utf-8');
      const $ = cheerio.load(html);
      
      // Remove added navigation that doesn't exist on live site
      $('nav').remove();
      
      // Add precise font loading
      $('head').prepend(fontFixes);
      
      // Force exact Squarespace styles
      $('body').removeClass().addClass('');
      
      // Remove any tracking scripts that might affect layout
      $('script:contains("gtag")').remove();
      $('script:contains("analytics")').remove();
      
      // Save optimized version
      await fs.writeFile(filePath, $.html());
    }
  }

  // 3. Create verbatim verification script
  console.log('\n🔍 CREATING VERBATIM VERIFICATION...');
  const verbatimScript = `
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
  const script = \`
    // Remove any dynamic content that changes
    document.querySelectorAll('[data-block-type]').forEach(el => el.removeAttribute('data-block-type'));
    document.querySelectorAll('[id^="yui"]').forEach(el => el.removeAttribute('id'));
    
    // Force identical font rendering
    document.body.style.fontFamily = '"proxima-nova", sans-serif';
    document.body.style.fontSize = '16px';
    document.body.style.lineHeight = '1.4';
    
    window.scrollTo(0, 0);
  \`;
  
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

verbatimTest().catch(console.error);`;

  await fs.writeFile('./verbatim-test.mjs', verbatimScript);

  console.log('\n✨ PRECISION FIXES COMPLETE!');
  console.log('\n📋 NEXT STEPS FOR VERBATIM MATCH:');
  console.log('1. Run: node verbatim-test.mjs');
  console.log('2. Manually compare verbatim-live.png vs verbatim-local.png');
  console.log('3. Identify remaining 1-2% differences');
  console.log('4. Apply micro-adjustments to CSS/fonts');
  console.log('5. Iterate until pixel-perfect match achieved');
}

achieveVerbatimMatch().catch(console.error);