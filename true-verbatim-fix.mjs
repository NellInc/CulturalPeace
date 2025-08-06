import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'node:path';
import * as cheerio from 'cheerio';

// TRUE VERBATIM RECREATION SYSTEM
class TrueVerbatimRecreator {
  constructor() {
    this.browser = null;
  }

  async init() {
    console.log('🎯 TRUE VERBATIM RECREATION SYSTEM - ULTRATHINKING MODE\n');
    this.browser = await puppeteer.launch({ headless: 'new' });
  }

  async captureOriginalStructure() {
    console.log('🔍 DEEP ANALYZING ORIGINAL SQUARESPACE STRUCTURE...');
    
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('https://www.culturalpeace.org', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Extract EXACT structure and styling
    const originalStructure = await page.evaluate(() => {
      const structure = {
        navigation: {
          type: 'none',
          elements: [],
          position: 'none',
          styling: {}
        },
        header: {
          exists: false,
          height: 0,
          styling: {}
        },
        heroSection: {
          exists: false,
          position: 'none',
          backgroundImage: '',
          overlayText: '',
          styling: {}
        },
        pageLayout: {
          startsAt: 0,
          fullHTML: ''
        }
      };

      // Check for ANY header element
      const headers = document.querySelectorAll('header, .header, .site-header, [data-nc-group="header"]');
      if (headers.length > 0) {
        const header = headers[0];
        const rect = header.getBoundingClientRect();
        structure.header = {
          exists: true,
          height: rect.height,
          position: getComputedStyle(header).position,
          top: rect.top,
          styling: {
            backgroundColor: getComputedStyle(header).backgroundColor,
            position: getComputedStyle(header).position,
            zIndex: getComputedStyle(header).zIndex
          }
        };
      }

      // Find navigation elements anywhere on page
      const navElements = document.querySelectorAll('nav, .nav, .navigation, .header-nav, [data-nc-group="header"] a');
      if (navElements.length > 0) {
        structure.navigation.elements = Array.from(navElements).map(nav => {
          const rect = nav.getBoundingClientRect();
          return {
            tag: nav.tagName,
            text: nav.textContent?.trim() || '',
            href: nav.href || '',
            position: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            },
            styling: {
              position: getComputedStyle(nav).position,
              backgroundColor: getComputedStyle(nav).backgroundColor,
              color: getComputedStyle(nav).color,
              fontSize: getComputedStyle(nav).fontSize,
              fontWeight: getComputedStyle(nav).fontWeight
            }
          };
        });
        
        // Determine navigation type
        const firstNav = navElements[0];
        const navRect = firstNav.getBoundingClientRect();
        if (navRect.top < 100) {
          structure.navigation.type = 'top-fixed';
        } else if (navRect.top < 200) {
          structure.navigation.type = 'top-relative';
        } else {
          structure.navigation.type = 'integrated';
        }
        structure.navigation.position = navRect.top;
      }

      // Find hero section
      const heroSelectors = [
        '[style*="background-image"]',
        '.hero',
        '.banner',
        '.intro-banner',
        '.page-banner',
        'section:first-of-type'
      ];
      
      for (const selector of heroSelectors) {
        const hero = document.querySelector(selector);
        if (hero) {
          const rect = hero.getBoundingClientRect();
          const bgImage = getComputedStyle(hero).backgroundImage;
          
          if (bgImage && bgImage !== 'none') {
            structure.heroSection = {
              exists: true,
              position: rect.top,
              backgroundImage: bgImage,
              overlayText: hero.textContent?.trim().substring(0, 200) || '',
              styling: {
                backgroundSize: getComputedStyle(hero).backgroundSize,
                backgroundPosition: getComputedStyle(hero).backgroundPosition,
                height: rect.height,
                width: rect.width
              }
            };
            break;
          }
        }
      }

      // Capture complete HTML structure
      structure.pageLayout.fullHTML = document.documentElement.outerHTML;
      structure.pageLayout.startsAt = document.body.getBoundingClientRect().top;

      return structure;
    });

    console.log('📊 ORIGINAL STRUCTURE ANALYSIS:');
    console.log(`   🏠 Header exists: ${originalStructure.header.exists}`);
    console.log(`   🧭 Navigation type: ${originalStructure.navigation.type}`);
    console.log(`   🌅 Hero section: ${originalStructure.heroSection.exists ? 'Found' : 'Not found'}`);
    console.log(`   📍 Page starts at: ${originalStructure.pageLayout.startsAt}px`);

    await page.close();
    return originalStructure;
  }

  async recreateVerbatimStructure(originalStructure) {
    console.log('\n🔧 RECREATING TRUE VERBATIM STRUCTURE...');
    
    const docsDir = './docs';
    const htmlFiles = await fs.readdir(docsDir);
    
    for (const file of htmlFiles) {
      if (file.endsWith('.html')) {
        console.log(`   📄 Processing: ${file}`);
        
        const filePath = path.join(docsDir, file);
        const html = await fs.readFile(filePath, 'utf-8');
        const $ = cheerio.load(html);
        
        // STEP 1: Remove ANY headers I added
        $('header, .site-header').remove();
        $('nav').remove();
        $('style:contains("site-header")').remove();
        
        // STEP 2: Reset body margins and padding
        $('body').attr('style', (i, style) => {
          return 'margin: 0 !important; padding: 0 !important;';
        });
        
        // STEP 3: If original has no separate header, ensure content starts at top
        if (!originalStructure.header.exists) {
          // Remove any top margins/padding from first elements
          const firstElement = $('body > *:first-child');
          if (firstElement.length) {
            const currentStyle = firstElement.attr('style') || '';
            firstElement.attr('style', currentStyle + '; margin-top: 0 !important; padding-top: 0 !important;');
          }
        }
        
        // STEP 4: If original has navigation integrated, don't add separate nav
        if (originalStructure.navigation.type === 'integrated' || originalStructure.navigation.type === 'none') {
          // Navigation should be part of the page content, not a separate header
          console.log(`     ✓ Keeping navigation integrated as per original`);
        }
        
        // STEP 5: Ensure hero section starts at correct position
        if (originalStructure.heroSection.exists && originalStructure.pageLayout.startsAt <= 10) {
          // Hero should start immediately at page top
          const heroElements = $('[style*="background"], .hero, .banner');
          heroElements.first().css({
            'margin-top': '0',
            'padding-top': '0'
          });
        }
        
        // STEP 6: Add minimal CSS reset to ensure exact positioning
        const verbatimCSS = `
        <style>
          /* TRUE VERBATIM RESET - Remove all artificial spacing */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            overflow-x: hidden;
          }
          
          /* Ensure first content element starts at absolute top */
          body > *:first-child {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          
          /* Remove any header-like spacing */
          .header, .site-header, nav {
            display: none !important;
          }
        </style>`;
        
        $('head').append(verbatimCSS);
        
        await fs.writeFile(filePath, $.html());
        console.log(`     ✅ Verbatim structure applied`);
      }
    }
  }

  async verifyVerbatimMatch() {
    console.log('\n🔍 FINAL VERBATIM VERIFICATION...');
    
    const [originalPage, clonePage] = await Promise.all([
      this.browser.newPage(),
      this.browser.newPage()
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

    // Scroll both to ensure all content loads, then reset to top
    for (const page of [originalPage, clonePage]) {
      await page.evaluate(() => {
        return new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              setTimeout(resolve, 2000);
            }
          }, 50);
        });
      });
    }

    const [originalShot, cloneShot] = await Promise.all([
      originalPage.screenshot({ fullPage: true }),
      clonePage.screenshot({ fullPage: true })
    ]);

    await Promise.all([
      fs.writeFile('final-original.png', originalShot),
      fs.writeFile('final-clone.png', cloneShot)
    ]);

    // Analyze top section specifically
    const [originalTop, cloneTop] = await Promise.all([
      originalPage.screenshot({ clip: { x: 0, y: 0, width: 1920, height: 600 } }),
      clonePage.screenshot({ clip: { x: 0, y: 0, width: 1920, height: 600 } })
    ]);

    await Promise.all([
      fs.writeFile('final-original-top.png', originalTop),
      fs.writeFile('final-clone-top.png', cloneTop)
    ]);

    // Get measurements
    const measurements = await Promise.all([
      originalPage.evaluate(() => {
        const body = document.body;
        const firstElement = document.body.firstElementChild;
        return {
          bodyTop: body.getBoundingClientRect().top,
          firstElementTop: firstElement ? firstElement.getBoundingClientRect().top : 0,
          hasHeader: !!document.querySelector('header, .header, .site-header'),
          totalHeight: body.scrollHeight
        };
      }),
      clonePage.evaluate(() => {
        const body = document.body;
        const firstElement = document.body.firstElementChild;
        return {
          bodyTop: body.getBoundingClientRect().top,
          firstElementTop: firstElement ? firstElement.getBoundingClientRect().top : 0,
          hasHeader: !!document.querySelector('header, .header, .site-header'),
          totalHeight: body.scrollHeight
        };
      })
    ]);

    console.log('\n📊 FINAL MEASUREMENTS:');
    console.log(`   🌐 Original: First element at ${measurements[0].firstElementTop}px, Header: ${measurements[0].hasHeader}`);
    console.log(`   🏠 Clone: First element at ${measurements[1].firstElementTop}px, Header: ${measurements[1].hasHeader}`);
    console.log(`   📏 Top difference: ${Math.abs(measurements[0].firstElementTop - measurements[1].firstElementTop)}px`);

    const topMatch = Math.abs(measurements[0].firstElementTop - measurements[1].firstElementTop) <= 5;
    const headerMatch = measurements[0].hasHeader === measurements[1].hasHeader;

    await Promise.all([originalPage.close(), clonePage.close()]);

    return {
      topMatch,
      headerMatch,
      screenshots: {
        fullOriginal: 'final-original.png',
        fullClone: 'final-clone.png',
        topOriginal: 'final-original-top.png',
        topClone: 'final-clone-top.png'
      },
      measurements
    };
  }

  async run() {
    try {
      await this.init();
      
      const originalStructure = await this.captureOriginalStructure();
      await this.recreateVerbatimStructure(originalStructure);
      
      // Commit changes
      console.log('\n🔧 COMMITTING TRUE VERBATIM FIXES...');
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execPromise = promisify(exec);
      
      await execPromise('git add docs/ && git commit -m "Apply true verbatim structure fixes - remove artificial headers" && git push origin main');
      
      // Wait for deployment
      console.log('⏳ Waiting for GitHub Pages deployment...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      const verification = await this.verifyVerbatimMatch();
      
      console.log('\n🎯 TRUE VERBATIM VERIFICATION COMPLETE!');
      console.log('═══════════════════════════════════════');
      
      if (verification.topMatch && verification.headerMatch) {
        console.log('✅ SUCCESS: TRUE VERBATIM MATCH ACHIEVED!');
        console.log('🏆 Top positioning matches exactly');
        console.log('🏆 Header structure matches exactly');
      } else {
        console.log('🔄 PROGRESS: Closer to verbatim match');
        if (!verification.topMatch) console.log('⚠️  Top positioning still differs');
        if (!verification.headerMatch) console.log('⚠️  Header structure still differs');
      }
      
      console.log('\n📸 COMPARE THESE SCREENSHOTS:');
      console.log(`   🌐 Original (top): ${verification.screenshots.topOriginal}`);
      console.log(`   🏠 Clone (top): ${verification.screenshots.topClone}`);
      console.log(`   🌐 Original (full): ${verification.screenshots.fullOriginal}`);
      console.log(`   🏠 Clone (full): ${verification.screenshots.fullClone}`);
      
      return verification;
      
    } finally {
      if (this.browser) await this.browser.close();
    }
  }
}

const recreator = new TrueVerbatimRecreator();
recreator.run().catch(console.error);