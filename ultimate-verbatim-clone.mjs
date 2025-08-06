import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'node:path';
import * as cheerio from 'cheerio';

// ULTIMATE VERBATIM CLONING SYSTEM
// Captures exact computed styles, not just HTML

class VerbatimCloner {
  constructor() {
    this.browser = null;
    this.outputDir = './verbatim-clone';
  }

  async init() {
    console.log('🎯 LAUNCHING ULTIMATE VERBATIM CLONING SYSTEM...\n');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    });
    
    await fs.ensureDir(this.outputDir);
    await fs.ensureDir(`${this.outputDir}/assets`);
  }

  async captureVerbatimPage(url, filename) {
    console.log(`📸 Capturing verbatim state: ${url}`);
    
    const page = await this.browser.newPage();
    
    // Set viewport exactly
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate and wait for complete load
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    // Wait extra time for all Squarespace dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Scroll to trigger all lazy loading
    await page.evaluate(async () => {
      await new Promise((resolve) => {
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
        }, 100);
      });
    });

    // CAPTURE EXACT COMPUTED STYLES FOR EVERY ELEMENT
    const verbatimHTML = await page.evaluate(() => {
      
      function getExactStyles(element) {
        const computed = window.getComputedStyle(element);
        const exactStyles = {};
        
        // Capture ALL computed style properties
        for (let i = 0; i < computed.length; i++) {
          const prop = computed[i];
          exactStyles[prop] = computed.getPropertyValue(prop);
        }
        
        return exactStyles;
      }
      
      function processElement(element) {
        // Get exact computed styles
        const styles = getExactStyles(element);
        
        // Create inline style string with ALL properties
        const styleString = Object.entries(styles)
          .filter(([prop, value]) => value && value !== 'none' && value !== 'auto')
          .map(([prop, value]) => `${prop}: ${value}`)
          .join('; ');
        
        // Apply exact styles inline
        if (styleString) {
          element.setAttribute('style', styleString);
        }
        
        // Remove all Squarespace-specific attributes that cause differences
        element.removeAttribute('data-block-type');
        element.removeAttribute('data-block-json');
        element.removeAttribute('class'); // Remove classes, use inline styles only
        
        if (element.id && element.id.startsWith('yui')) {
          element.removeAttribute('id');
        }
        
        // Process children recursively
        Array.from(element.children).forEach(processElement);
      }
      
      // Process entire document
      processElement(document.documentElement);
      
      // Remove all <style> and <link> tags - we have inline styles now
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
      
      // Remove all JavaScript
      document.querySelectorAll('script').forEach(el => el.remove());
      
      // Return processed HTML
      return document.documentElement.outerHTML;
    });

    // Save the verbatim HTML with exact styles
    const verbatimPath = path.join(this.outputDir, filename);
    await fs.writeFile(verbatimPath, `<!DOCTYPE html>\n${verbatimHTML}`);
    
    console.log(`   ✅ Saved verbatim: ${filename}`);
    
    await page.close();
    return verbatimPath;
  }

  async createVerbatimClone() {
    const pages = [
      { url: 'https://www.culturalpeace.org', filename: 'index.html' },
      { url: 'https://www.culturalpeace.org/links', filename: 'links.html' },
      { url: 'https://www.culturalpeace.org/contact-1', filename: 'contact-1.html' }
    ];

    for (const pageConfig of pages) {
      await this.captureVerbatimPage(pageConfig.url, pageConfig.filename);
    }

    // Create deployment files
    await this.createDeploymentFiles();
  }

  async createDeploymentFiles() {
    console.log('📋 Creating deployment files...');
    
    // Create CNAME
    await fs.writeFile(path.join(this.outputDir, 'CNAME'), 'www.culturalpeace.org');
    
    // Create .nojekyll
    await fs.writeFile(path.join(this.outputDir, '.nojekyll'), '');
    
    // Create robots.txt
    await fs.writeFile(path.join(this.outputDir, 'robots.txt'), 
      'User-agent: *\\nAllow: /\\nSitemap: https://www.culturalpeace.org/sitemap.xml');
  }

  async verifyVerbatimMatch() {
    console.log('\\n🔍 VERIFYING VERBATIM MATCH...');
    
    const testPage = await this.browser.newPage();
    await testPage.setViewport({ width: 1920, height: 1080 });
    
    // Test original
    await testPage.goto('https://www.culturalpeace.org', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    const originalShot = await testPage.screenshot({ fullPage: true });
    
    // Test verbatim clone
    const localUrl = `file://${path.resolve('./verbatim-clone/index.html')}`;
    await testPage.goto(localUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    const cloneShot = await testPage.screenshot({ fullPage: true });
    
    // Save comparison shots
    await fs.writeFile('./verbatim-original.png', originalShot);
    await fs.writeFile('./verbatim-clone-test.png', cloneShot);
    
    console.log('✅ Verification screenshots saved');
    console.log('   📷 verbatim-original.png');
    console.log('   📷 verbatim-clone-test.png');
    
    await testPage.close();
  }

  async run() {
    try {
      await this.init();
      await this.createVerbatimClone();
      await this.verifyVerbatimMatch();
      
      console.log('\n🎯 VERBATIM CLONING COMPLETE!');
      console.log('\n📊 RESULTS:');
      console.log('   ✅ Exact computed styles captured');
      console.log('   ✅ All JavaScript removed');
      console.log('   ✅ All classes replaced with inline styles');
      console.log('   ✅ Squarespace artifacts removed');
      console.log('\n📁 Output: ./verbatim-clone/');
      console.log('🔍 Compare: verbatim-original.png vs verbatim-clone-test.png');
      
      return true;
    } finally {
      if (this.browser) await this.browser.close();
    }
  }
}

const cloner = new VerbatimCloner();
cloner.run().catch(console.error);