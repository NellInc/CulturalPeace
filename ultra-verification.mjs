import puppeteer from 'puppeteer';
import fs from 'fs-extra';

// ULTRA VERIFICATION - Side by side comparison
class UltraVerifier {
  constructor() {
    this.browser = null;
    this.results = [];
  }

  async init() {
    console.log('🎯 LAUNCHING ULTRA VERIFICATION SYSTEM...\n');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async comparePages() {
    const pages = [
      { 
        name: 'HOME',
        original: 'https://www.culturalpeace.org',
        clone: 'https://nellinc.github.io/CulturalPeace/'
      },
      {
        name: 'LINKS', 
        original: 'https://www.culturalpeace.org/links',
        clone: 'https://nellinc.github.io/CulturalPeace/links.html'
      },
      {
        name: 'CONTACT',
        original: 'https://www.culturalpeace.org/contact-1', 
        clone: 'https://nellinc.github.io/CulturalPeace/contact-1.html'
      }
    ];

    for (const pageConfig of pages) {
      console.log(`🔍 ULTRA VERIFYING: ${pageConfig.name}`);
      
      const result = await this.verifyPage(pageConfig);
      this.results.push(result);
      
      console.log(`   📊 Match Quality: ${result.matchPercentage}%`);
      console.log(`   🎨 Visual: ${result.visualMatch ? '✅ MATCH' : '❌ DIFFERENT'}`);
      console.log(`   📱 Header: ${result.headerMatch ? '✅ MATCH' : '❌ DIFFERENT'}`);
      console.log(`   🔗 Navigation: ${result.navMatch ? '✅ MATCH' : '❌ DIFFERENT'}`);
      console.log(`   📝 Content: ${result.contentMatch ? '✅ MATCH' : '❌ DIFFERENT'}`);
      console.log('');
    }
  }

  async verifyPage(config) {
    const [originalPage, clonePage] = await Promise.all([
      this.browser.newPage(),
      this.browser.newPage()
    ]);

    const result = {
      name: config.name,
      matchPercentage: 0,
      visualMatch: false,
      headerMatch: false,
      navMatch: false,
      contentMatch: false,
      differences: [],
      screenshots: {}
    };

    try {
      // Set identical viewport
      await Promise.all([
        originalPage.setViewport({ width: 1920, height: 1080 }),
        clonePage.setViewport({ width: 1920, height: 1080 })
      ]);

      // Navigate simultaneously
      await Promise.all([
        originalPage.goto(config.original, { waitUntil: 'networkidle0', timeout: 60000 }),
        clonePage.goto(config.clone, { waitUntil: 'networkidle0', timeout: 30000 })
      ]);

      // Wait for complete loading
      await Promise.all([
        new Promise(resolve => setTimeout(resolve, 5000)),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);

      // Scroll to ensure all content loads
      const scrollScript = `
        window.scrollTo(0, 0);
        await new Promise(resolve => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              setTimeout(resolve, 1000);
            }
          }, 100);
        });
      `;

      await Promise.all([
        originalPage.evaluate(scrollScript),
        clonePage.evaluate(scrollScript)
      ]);

      // Take screenshots
      const [originalShot, cloneShot] = await Promise.all([
        originalPage.screenshot({ fullPage: true }),
        clonePage.screenshot({ fullPage: true })
      ]);

      const originalPath = `ultra-${config.name.toLowerCase()}-original.png`;
      const clonePath = `ultra-${config.name.toLowerCase()}-clone.png`;

      await Promise.all([
        fs.writeFile(originalPath, originalShot),
        fs.writeFile(clonePath, cloneShot)
      ]);

      result.screenshots = { original: originalPath, clone: clonePath };

      // DETAILED ANALYSIS
      const [originalAnalysis, cloneAnalysis] = await Promise.all([
        this.analyzePageStructure(originalPage),
        this.analyzePageStructure(clonePage)
      ]);

      // Compare analyses
      result.headerMatch = this.compareHeaders(originalAnalysis.header, cloneAnalysis.header);
      result.navMatch = this.compareNavigation(originalAnalysis.navigation, cloneAnalysis.navigation);
      result.contentMatch = this.compareContent(originalAnalysis.content, cloneAnalysis.content);
      result.visualMatch = this.compareVisuals(originalAnalysis.visual, cloneAnalysis.visual);

      // Calculate overall match percentage
      const checks = [result.headerMatch, result.navMatch, result.contentMatch, result.visualMatch];
      result.matchPercentage = Math.round((checks.filter(Boolean).length / checks.length) * 100);

      // Identify specific differences
      result.differences = this.identifyDifferences(originalAnalysis, cloneAnalysis);

    } catch (error) {
      console.error(`Error verifying ${config.name}:`, error.message);
      result.differences.push(`Verification error: ${error.message}`);
    }

    await Promise.all([originalPage.close(), clonePage.close()]);
    return result;
  }

  async analyzePageStructure(page) {
    return await page.evaluate(() => {
      const analysis = {
        header: {},
        navigation: {},
        content: {},
        visual: {}
      };

      // Header Analysis
      const header = document.querySelector('header') || document.querySelector('.header');
      if (header) {
        analysis.header = {
          exists: true,
          height: header.offsetHeight,
          backgroundColor: getComputedStyle(header).backgroundColor,
          position: getComputedStyle(header).position
        };
      }

      // Navigation Analysis
      const navLinks = document.querySelectorAll('nav a, header a, .navigation a');
      analysis.navigation = {
        linkCount: navLinks.length,
        links: Array.from(navLinks).map(link => ({
          text: link.textContent.trim(),
          href: link.href
        }))
      };

      // Content Analysis
      analysis.content = {
        title: document.title,
        headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
          tag: h.tagName,
          text: h.textContent.trim().substring(0, 100)
        })),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt,
          loaded: img.complete && img.naturalWidth > 0
        })),
        paragraphs: document.querySelectorAll('p').length
      };

      // Visual Analysis
      const body = document.body;
      analysis.visual = {
        bodyBackgroundColor: getComputedStyle(body).backgroundColor,
        bodyFontFamily: getComputedStyle(body).fontFamily,
        bodyFontSize: getComputedStyle(body).fontSize,
        totalHeight: body.scrollHeight,
        hasHeroSection: !!document.querySelector('.hero, .banner, [style*="background-image"]')
      };

      return analysis;
    });
  }

  compareHeaders(original, clone) {
    if (!original.exists && !clone.exists) return true;
    if (!original.exists || !clone.exists) return false;
    
    return Math.abs(original.height - clone.height) < 20 && 
           original.position === clone.position;
  }

  compareNavigation(original, clone) {
    if (Math.abs(original.linkCount - clone.linkCount) > 2) return false;
    
    const originalTexts = original.links.map(l => l.text.toLowerCase());
    const cloneTexts = clone.links.map(l => l.text.toLowerCase());
    
    const commonTexts = originalTexts.filter(text => 
      cloneTexts.some(cloneText => cloneText.includes(text) || text.includes(cloneText))
    );
    
    return commonTexts.length >= Math.min(originalTexts.length, cloneTexts.length) * 0.8;
  }

  compareContent(original, clone) {
    const headingMatch = Math.abs(original.headings.length - clone.headings.length) <= 2;
    const imageMatch = Math.abs(original.images.length - clone.images.length) <= 2;
    const paragraphMatch = Math.abs(original.paragraphs - clone.paragraphs) <= 5;
    
    return headingMatch && imageMatch && paragraphMatch;
  }

  compareVisuals(original, clone) {
    const heightDiff = Math.abs(original.totalHeight - clone.totalHeight);
    const heightMatch = heightDiff < (original.totalHeight * 0.1); // Within 10%
    
    return heightMatch && (original.hasHeroSection === clone.hasHeroSection);
  }

  identifyDifferences(original, clone) {
    const differences = [];
    
    if (!this.compareHeaders(original.header, clone.header)) {
      differences.push('Header styling or positioning differs');
    }
    
    if (!this.compareNavigation(original.navigation, clone.navigation)) {
      differences.push('Navigation links or structure differs');
    }
    
    if (Math.abs(original.content.headings.length - clone.content.headings.length) > 2) {
      differences.push(`Heading count differs: ${original.content.headings.length} vs ${clone.content.headings.length}`);
    }
    
    if (Math.abs(original.content.images.length - clone.content.images.length) > 2) {
      differences.push(`Image count differs: ${original.content.images.length} vs ${clone.content.images.length}`);
    }
    
    const heightDiff = Math.abs(original.visual.totalHeight - clone.visual.totalHeight);
    if (heightDiff > original.visual.totalHeight * 0.1) {
      differences.push(`Page height differs significantly: ${heightDiff}px difference`);
    }
    
    return differences;
  }

  async generateUltraReport() {
    const overallMatch = Math.round(
      this.results.reduce((sum, r) => sum + r.matchPercentage, 0) / this.results.length
    );

    console.log('🎯 ULTRA VERIFICATION COMPLETE!\n');
    console.log('═══════════════════════════════════════');
    console.log(`📊 OVERALL MATCH QUALITY: ${overallMatch}%`);
    console.log('═══════════════════════════════════════\n');

    for (const result of this.results) {
      console.log(`📄 ${result.name} PAGE:`);
      console.log(`   🎯 Match: ${result.matchPercentage}%`);
      console.log(`   📷 Original: ${result.screenshots.original}`);
      console.log(`   📷 Clone: ${result.screenshots.clone}`);
      
      if (result.differences.length > 0) {
        console.log(`   ⚠️  Differences:`);
        result.differences.forEach(diff => console.log(`      • ${diff}`));
      }
      console.log('');
    }

    if (overallMatch >= 95) {
      console.log('✅ VERDICT: VERBATIM MATCH ACHIEVED!');
      console.log('🏆 Your clone is virtually identical to the original.');
    } else if (overallMatch >= 85) {
      console.log('🟡 VERDICT: VERY CLOSE MATCH');
      console.log('💡 Minor differences detected, but overall excellent quality.');
    } else {
      console.log('🔴 VERDICT: SIGNIFICANT DIFFERENCES');
      console.log('🔧 Additional fixes needed for verbatim match.');
    }

    return overallMatch;
  }

  async run() {
    try {
      await this.init();
      await this.comparePages();
      const score = await this.generateUltraReport();
      return score;
    } finally {
      if (this.browser) await this.browser.close();
    }
  }
}

const verifier = new UltraVerifier();
verifier.run().catch(console.error);