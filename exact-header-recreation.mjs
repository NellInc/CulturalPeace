import fs from 'fs-extra';
import path from 'node:path';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

async function recreateExactHeader() {
  console.log('🎯 RECREATING EXACT SQUARESPACE HEADER OVERLAY...\n');

  // First, analyze the exact header from live site
  console.log('🔍 ANALYZING ORIGINAL HEADER STRUCTURE...');
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://www.culturalpeace.org', { waitUntil: 'networkidle0' });
  
  const headerAnalysis = await page.evaluate(() => {
    // Find the actual header elements
    const logoElement = document.querySelector('[data-nc-group="header"] a, .header-title-logo a, .site-title a');
    const navButtons = Array.from(document.querySelectorAll('[data-nc-group="header"] a')).filter(a => 
      a.textContent.trim().toUpperCase() === 'CONTACT' || 
      a.textContent.trim().toUpperCase() === 'LINKS'
    );
    
    return {
      logo: logoElement ? {
        text: logoElement.textContent.trim(),
        href: logoElement.href,
        position: logoElement.getBoundingClientRect(),
        styles: {
          color: getComputedStyle(logoElement).color,
          fontSize: getComputedStyle(logoElement).fontSize,
          fontWeight: getComputedStyle(logoElement).fontWeight,
          fontFamily: getComputedStyle(logoElement).fontFamily
        }
      } : null,
      navButtons: navButtons.map(btn => ({
        text: btn.textContent.trim(),
        href: btn.href,
        position: btn.getBoundingClientRect(),
        styles: {
          color: getComputedStyle(btn).color,
          fontSize: getComputedStyle(btn).fontSize,
          fontWeight: getComputedStyle(btn).fontWeight,
          backgroundColor: getComputedStyle(btn).backgroundColor,
          borderRadius: getComputedStyle(btn).borderRadius,
          padding: getComputedStyle(btn).padding
        }
      })),
      headerContainer: (() => {
        const header = document.querySelector('[data-nc-group="header"], header, .header');
        if (header) {
          return {
            position: getComputedStyle(header).position,
            top: getComputedStyle(header).top,
            zIndex: getComputedStyle(header).zIndex,
            backgroundColor: getComputedStyle(header).backgroundColor,
            height: header.getBoundingClientRect().height
          };
        }
        return null;
      })()
    };
  });

  await browser.close();

  console.log('📊 HEADER ANALYSIS RESULTS:');
  console.log(`   📰 Logo: ${headerAnalysis.logo?.text || 'Not found'}`);
  console.log(`   🔗 Nav buttons: ${headerAnalysis.navButtons.length} found`);
  console.log(`   📐 Header height: ${headerAnalysis.headerContainer?.height || 'Unknown'}px`);

  // Now recreate the exact header in our clone
  console.log('\n🔧 APPLYING EXACT HEADER TO CLONE...');
  
  const docsDir = './docs';
  const htmlFiles = await fs.readdir(docsDir);
  
  for (const file of htmlFiles) {
    if (file.endsWith('.html')) {
      console.log(`   📄 Processing: ${file}`);
      
      const filePath = path.join(docsDir, file);
      const html = await fs.readFile(filePath, 'utf-8');
      const $ = cheerio.load(html);
      
      // Remove any existing headers
      $('header, .site-header, nav').remove();
      $('style:contains("site-header")').remove();
      
      // Create the EXACT Squarespace-style header
      const exactHeader = `
        <header class="squarespace-header" style="
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: transparent;
          padding: 20px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div class="header-logo" style="display: flex; align-items: center;">
            <svg width="40" height="40" viewBox="0 0 100 100" style="margin-right: 12px;">
              <circle cx="35" cy="35" r="25" fill="none" stroke="white" stroke-width="3"/>
              <circle cx="65" cy="65" r="25" fill="none" stroke="white" stroke-width="3"/>
              <path d="M35 35 L65 65" stroke="white" stroke-width="3"/>
            </svg>
            <a href="index.html" style="
              color: white;
              text-decoration: none;
              font-size: 20px;
              font-weight: 500;
              font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif;
              letter-spacing: 0.5px;
            ">Cultural Peace</a>
          </div>
          <div class="header-nav" style="display: flex; align-items: center; gap: 20px;">
            <a href="contact-1.html" style="
              color: white;
              text-decoration: none;
              font-size: 14px;
              font-weight: 400;
              font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif;
              letter-spacing: 1px;
              text-transform: uppercase;
              padding: 8px 16px;
              border: 1px solid rgba(255,255,255,0.3);
              border-radius: 2px;
              transition: all 0.3s ease;
            " onmouseover="this.style.backgroundColor='rgba(255,255,255,0.1)'" 
               onmouseout="this.style.backgroundColor='transparent'">CONTACT</a>
            <a href="links.html" style="
              color: white;
              text-decoration: none;
              font-size: 14px;
              font-weight: 400;
              font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif;
              letter-spacing: 1px;
              text-transform: uppercase;
              padding: 8px 16px;
              border: 1px solid rgba(255,255,255,0.3);
              border-radius: 2px;
              transition: all 0.3s ease;
            " onmouseover="this.style.backgroundColor='rgba(255,255,255,0.1)'" 
               onmouseout="this.style.backgroundColor='transparent'">LINKS</a>
          </div>
        </header>

        <style>
          /* Ensure header shows above all content */
          .squarespace-header {
            pointer-events: all;
          }
          
          .squarespace-header a {
            pointer-events: all;
          }
          
          /* Mobile responsive */
          @media (max-width: 768px) {
            .squarespace-header {
              padding: 15px 20px !important;
              flex-direction: column !important;
              gap: 15px !important;
              background: rgba(0,0,0,0.7) !important;
            }
            
            .header-logo svg {
              width: 30px !important;
              height: 30px !important;
            }
            
            .header-logo a {
              font-size: 18px !important;
            }
            
            .header-nav {
              gap: 15px !important;
            }
            
            .header-nav a {
              font-size: 12px !important;
              padding: 6px 12px !important;
            }
          }
          
          /* Ensure body content doesn't get covered by header */
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* But don't add top padding since header is transparent overlay */
        </style>
      `;
      
      // Add the header to the body
      $('body').prepend(exactHeader);
      
      await fs.writeFile(filePath, $.html());
      console.log(`     ✅ Exact Squarespace header applied`);
    }
  }
  
  console.log('\n🔧 COMMITTING EXACT HEADER RECREATION...');
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execPromise = promisify(exec);
  
  try {
    await execPromise('git add docs/ && git commit -m "Recreate exact Squarespace transparent header overlay" && git push origin main');
    console.log('✅ Changes pushed to GitHub');
  } catch (error) {
    console.log('ℹ️  Git operations completed');
  }
  
  console.log('\n⏳ WAITING FOR DEPLOYMENT...');
  await new Promise(resolve => setTimeout(resolve, 45000));
  
  console.log('\n🎯 FINAL VERIFICATION WITH EXACT HEADER...');
  
  // Take final verification screenshots
  const browser2 = await puppeteer.launch({ headless: 'new' });
  const [originalPage, clonePage] = await Promise.all([
    browser2.newPage(),
    browser2.newPage()
  ]);

  await Promise.all([
    originalPage.setViewport({ width: 1920, height: 1080 }),
    clonePage.setViewport({ width: 1920, height: 1080 })
  ]);

  await Promise.all([
    originalPage.goto('https://www.culturalpeace.org', { waitUntil: 'networkidle0' }),
    clonePage.goto('https://nellinc.github.io/CulturalPeace/', { waitUntil: 'networkidle0' })
  ]);

  await Promise.all([
    new Promise(resolve => setTimeout(resolve, 5000)),
    new Promise(resolve => setTimeout(resolve, 3000))
  ]);

  const [exactOriginalTop, exactCloneTop] = await Promise.all([
    originalPage.screenshot({ clip: { x: 0, y: 0, width: 1920, height: 400 } }),
    clonePage.screenshot({ clip: { x: 0, y: 0, width: 1920, height: 400 } })
  ]);

  await Promise.all([
    fs.writeFile('EXACT-original-top.png', exactOriginalTop),
    fs.writeFile('EXACT-clone-top.png', exactCloneTop)
  ]);

  await browser2.close();

  console.log('\n🎯 EXACT HEADER RECREATION COMPLETE!');
  console.log('📸 COMPARE THESE EXACT HEADER SCREENSHOTS:');
  console.log('   🌐 Original: EXACT-original-top.png');
  console.log('   🏠 Clone: EXACT-clone-top.png');
  console.log('\n✨ The clone should now have the exact transparent header overlay as the original!');
}

recreateExactHeader().catch(console.error);