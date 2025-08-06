import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'node:path';
import * as cheerio from 'cheerio';
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';
// import Jimp from 'jimp'; // Not currently used

const LIVE_URL = 'https://www.culturalpeace.org';
const LOCAL_URL = 'file://' + path.resolve('./docs/index.html');
const RESULTS_DIR = './precision-results';
const TOLERANCE = 0.1; // Pixel difference tolerance (0-1)

// Test configurations for different viewports
const VIEWPORTS = [
  { name: 'desktop-large', width: 1920, height: 1080 },
  { name: 'desktop-medium', width: 1440, height: 900 },
  { name: 'desktop-small', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile-large', width: 414, height: 896 },
  { name: 'mobile-medium', width: 375, height: 667 },
  { name: 'mobile-small', width: 320, height: 568 }
];

// Pages to test
const PAGES = [
  { name: 'home', live: LIVE_URL, local: LOCAL_URL },
  { name: 'links', live: `${LIVE_URL}/links`, local: `file://${path.resolve('./docs/links.html')}` },
  { name: 'contact', live: `${LIVE_URL}/contact-1`, local: `file://${path.resolve('./docs/contact-1.html')}` }
];

class PrecisionVerifier {
  constructor() {
    this.browser = null;
    this.results = {
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        pixelDifferences: 0,
        missingAssets: 0,
        errors: []
      },
      detailed: []
    };
  }

  async init() {
    console.log('🚀 Starting Precision Verification System...');
    await fs.ensureDir(RESULTS_DIR);
    await fs.ensureDir(`${RESULTS_DIR}/screenshots`);
    await fs.ensureDir(`${RESULTS_DIR}/diffs`);
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=VizDisplayCompositor'
      ]
    });
  }

  async compareImages(image1Path, image2Path, outputPath) {
    try {
      // Load images using sharp for precise processing
      const img1Buffer = await sharp(image1Path).raw().toBuffer({ resolveWithObject: true });
      const img2Buffer = await sharp(image2Path)
        .resize(img1Buffer.info.width, img1Buffer.info.height)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { width, height } = img1Buffer.info;
      const diff = Buffer.alloc(width * height * 4);

      // Compare images pixel by pixel
      const pixelDiff = pixelmatch(
        img1Buffer.data,
        img2Buffer.data,
        diff,
        width,
        height,
        {
          threshold: TOLERANCE,
          diffColor: [255, 0, 0],
          diffColorAlt: [0, 255, 0]
        }
      );

      // Save difference image
      await sharp(diff, {
        raw: {
          width,
          height,
          channels: 4
        }
      })
        .png()
        .toFile(outputPath);

      const diffPercentage = (pixelDiff / (width * height)) * 100;

      return {
        pixelDiff,
        totalPixels: width * height,
        diffPercentage,
        passed: diffPercentage < 1.0 // Less than 1% difference
      };
    } catch (error) {
      console.error(`Error comparing images: ${error.message}`);
      return {
        error: error.message,
        passed: false
      };
    }
  }

  async captureFullPageScreenshot(page, outputPath, viewport) {
    await page.setViewport(viewport);
    
    // Wait for all content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Scroll to trigger lazy loading
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
            setTimeout(resolve, 1000);
          }
        }, 100);
      });
    });

    // Take full page screenshot
    const screenshot = await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: 'png'
    });

    return screenshot;
  }

  async analyzePageContent(page, url) {
    console.log(`📊 Analyzing content for: ${url}`);
    
    const analysis = await page.evaluate(() => {
      const getComputedStyles = (element) => {
        const styles = window.getComputedStyle(element);
        return {
          fontFamily: styles.fontFamily,
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          lineHeight: styles.lineHeight,
          textAlign: styles.textAlign,
          margin: styles.margin,
          padding: styles.padding,
          display: styles.display,
          position: styles.position
        };
      };

      const results = {
        title: document.title,
        headings: [],
        paragraphs: [],
        images: [],
        links: [],
        fonts: new Set(),
        colors: new Set(),
        errors: []
      };

      // Analyze headings
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
        const styles = getComputedStyles(heading);
        results.headings.push({
          tag: heading.tagName,
          text: heading.textContent.trim(),
          styles
        });
        results.fonts.add(styles.fontFamily);
        results.colors.add(styles.color);
      });

      // Analyze paragraphs
      document.querySelectorAll('p').forEach(p => {
        const styles = getComputedStyles(p);
        results.paragraphs.push({
          text: p.textContent.trim().substring(0, 100),
          styles
        });
        results.fonts.add(styles.fontFamily);
        results.colors.add(styles.color);
      });

      // Analyze images
      document.querySelectorAll('img').forEach(img => {
        results.images.push({
          src: img.src,
          alt: img.alt,
          width: img.naturalWidth,
          height: img.naturalHeight,
          loaded: img.complete && img.naturalWidth > 0
        });
      });

      // Analyze links
      document.querySelectorAll('a[href]').forEach(link => {
        results.links.push({
          href: link.href,
          text: link.textContent.trim(),
          external: !link.href.startsWith(window.location.origin)
        });
      });

      // Convert Sets to Arrays for JSON serialization
      results.fonts = Array.from(results.fonts);
      results.colors = Array.from(results.colors);

      return results;
    });

    // Check for JavaScript errors
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => 
      errors.push(`Failed to load: ${request.url()}`)
    );

    analysis.errors = errors;
    return analysis;
  }

  async testPage(pageConfig) {
    console.log(`\n🔍 Testing page: ${pageConfig.name}`);
    
    const pageResults = {
      name: pageConfig.name,
      live: pageConfig.live,
      local: pageConfig.local,
      viewports: {},
      contentComparison: {},
      passed: true
    };

    for (const viewport of VIEWPORTS) {
      console.log(`  📱 Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
      
      try {
        const livePage = await this.browser.newPage();
        const localPage = await this.browser.newPage();

        // Navigate to pages
        await livePage.goto(pageConfig.live, { waitUntil: 'networkidle0', timeout: 60000 });
        await localPage.goto(pageConfig.local, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Capture screenshots
        const liveScreenshot = `${RESULTS_DIR}/screenshots/${pageConfig.name}-live-${viewport.name}.png`;
        const localScreenshot = `${RESULTS_DIR}/screenshots/${pageConfig.name}-local-${viewport.name}.png`;
        const diffImage = `${RESULTS_DIR}/diffs/${pageConfig.name}-diff-${viewport.name}.png`;

        await this.captureFullPageScreenshot(livePage, liveScreenshot, viewport);
        await this.captureFullPageScreenshot(localPage, localScreenshot, viewport);

        // Compare images
        const comparison = await this.compareImages(liveScreenshot, localScreenshot, diffImage);
        
        // Analyze content (only for desktop-large to avoid redundancy)
        let contentAnalysis = {};
        if (viewport.name === 'desktop-large') {
          const liveContent = await this.analyzePageContent(livePage, pageConfig.live);
          const localContent = await this.analyzePageContent(localPage, pageConfig.local);
          
          contentAnalysis = {
            live: liveContent,
            local: localContent,
            differences: this.compareContent(liveContent, localContent)
          };
          
          pageResults.contentComparison = contentAnalysis;
        }

        pageResults.viewports[viewport.name] = {
          comparison,
          passed: comparison.passed,
          screenshots: {
            live: liveScreenshot,
            local: localScreenshot,
            diff: diffImage
          }
        };

        if (!comparison.passed) {
          pageResults.passed = false;
          this.results.summary.pixelDifferences++;
        }

        this.results.summary.totalTests++;
        if (comparison.passed) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }

        await livePage.close();
        await localPage.close();

      } catch (error) {
        console.error(`Error testing ${pageConfig.name} at ${viewport.name}:`, error.message);
        pageResults.viewports[viewport.name] = {
          error: error.message,
          passed: false
        };
        pageResults.passed = false;
        this.results.summary.errors.push(`${pageConfig.name}-${viewport.name}: ${error.message}`);
      } finally {
        // Pages are automatically closed when browser closes
      }
    }

    return pageResults;
  }

  compareContent(liveContent, localContent) {
    const differences = {
      title: liveContent.title !== localContent.title,
      headingCount: liveContent.headings.length !== localContent.headings.length,
      imageCount: liveContent.images.length !== localContent.images.length,
      linkCount: liveContent.links.length !== localContent.links.length,
      missingImages: [],
      fontDifferences: [],
      colorDifferences: [],
      textDifferences: []
    };

    // Check for missing images
    localContent.images.forEach(img => {
      if (!img.loaded) {
        differences.missingImages.push(img.src);
      }
    });

    // Compare fonts
    const liveFonts = new Set(liveContent.fonts);
    const localFonts = new Set(localContent.fonts);
    localFonts.forEach(font => {
      if (!liveFonts.has(font)) {
        differences.fontDifferences.push(`Local has extra font: ${font}`);
      }
    });

    // Compare headings text
    liveContent.headings.forEach((liveHeading, index) => {
      const localHeading = localContent.headings[index];
      if (localHeading && liveHeading.text !== localHeading.text) {
        differences.textDifferences.push({
          type: 'heading',
          live: liveHeading.text,
          local: localHeading.text
        });
      }
    });

    differences.hasDifferences = Object.values(differences).some(diff => 
      Array.isArray(diff) ? diff.length > 0 : diff === true
    );

    return differences;
  }

  async generateReport() {
    console.log('\n📋 Generating comprehensive report...');
    
    const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Precision Verification Report - Cultural Peace</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f7fa;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #333;
        }
        .stat-label {
            color: #666;
            margin-top: 0.5rem;
        }
        .page-section {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
            overflow: hidden;
        }
        .page-header {
            background: #2c3e50;
            color: white;
            padding: 1rem 1.5rem;
            font-weight: bold;
        }
        .viewport-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1rem;
            padding: 1.5rem;
        }
        .viewport-card {
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            overflow: hidden;
        }
        .viewport-header {
            background: #f8f9fa;
            padding: 1rem;
            border-bottom: 1px solid #e1e8ed;
        }
        .comparison-result {
            padding: 1rem;
        }
        .passed { border-left: 4px solid #27ae60; }
        .failed { border-left: 4px solid #e74c3c; }
        .screenshot-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 0.5rem;
            margin-top: 1rem;
        }
        .screenshot-container {
            text-align: center;
        }
        .screenshot-container img {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .screenshot-label {
            font-size: 0.8rem;
            color: #666;
            margin-top: 0.5rem;
        }
        .content-analysis {
            background: #f8f9fa;
            padding: 1.5rem;
            margin: 1rem;
            border-radius: 8px;
        }
        .error-list {
            background: #fff5f5;
            border-left: 4px solid #e74c3c;
            padding: 1rem;
            margin: 1rem;
        }
        .success { color: #27ae60; }
        .error { color: #e74c3c; }
        .warning { color: #f39c12; }
        pre {
            background: #2c3e50;
            color: #ecf0f1;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Precision Verification Report</h1>
            <p>CulturalPeace.org - Squarespace vs GitHub Pages Clone</p>
            <p>Generated: ${new Date().toISOString()}</p>
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-value">${this.results.summary.totalTests}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-value ${this.results.summary.passed > 0 ? 'success' : 'error'}">${this.results.summary.passed}</div>
                <div class="stat-label">Tests Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value ${this.results.summary.failed > 0 ? 'error' : 'success'}">${this.results.summary.failed}</div>
                <div class="stat-label">Tests Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value ${this.results.summary.pixelDifferences > 0 ? 'warning' : 'success'}">${this.results.summary.pixelDifferences}</div>
                <div class="stat-label">Pixel Differences</div>
            </div>
        </div>

        ${this.results.summary.errors.length > 0 ? `
        <div class="error-list">
            <h3>❌ Errors Encountered</h3>
            <ul>
                ${this.results.summary.errors.map(error => `<li>${error}</li>`).join('')}
            </ul>
        </div>` : ''}

        ${this.results.detailed.map(page => `
        <div class="page-section">
            <div class="page-header">
                📄 ${page.name.toUpperCase()} - ${page.passed ? '✅ PASSED' : '❌ FAILED'}
            </div>
            
            ${page.contentComparison.differences ? `
            <div class="content-analysis">
                <h3>📊 Content Analysis</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <h4>Live Site</h4>
                        <ul>
                            <li>Headings: ${page.contentComparison.live.headings.length}</li>
                            <li>Images: ${page.contentComparison.live.images.length}</li>
                            <li>Links: ${page.contentComparison.live.links.length}</li>
                            <li>Fonts: ${page.contentComparison.live.fonts.length}</li>
                        </ul>
                    </div>
                    <div>
                        <h4>Clone Site</h4>
                        <ul>
                            <li>Headings: ${page.contentComparison.local.headings.length}</li>
                            <li>Images: ${page.contentComparison.local.images.length}</li>
                            <li>Links: ${page.contentComparison.local.links.length}</li>
                            <li>Fonts: ${page.contentComparison.local.fonts.length}</li>
                        </ul>
                    </div>
                </div>
                ${page.contentComparison.differences.missingImages.length > 0 ? `
                <div class="error">
                    <h4>🚨 Missing Images</h4>
                    <ul>
                        ${page.contentComparison.differences.missingImages.map(img => `<li>${img}</li>`).join('')}
                    </ul>
                </div>` : ''}
            </div>` : ''}
            
            <div class="viewport-grid">
                ${Object.entries(page.viewports).map(([viewportName, viewport]) => `
                <div class="viewport-card ${viewport.passed ? 'passed' : 'failed'}">
                    <div class="viewport-header">
                        <strong>${viewportName}</strong>
                        <span style="float: right;">${viewport.passed ? '✅' : '❌'}</span>
                    </div>
                    <div class="comparison-result">
                        ${viewport.comparison ? `
                            <p><strong>Pixel Difference:</strong> ${viewport.comparison.diffPercentage?.toFixed(2)}%</p>
                            <p><strong>Different Pixels:</strong> ${viewport.comparison.pixelDiff?.toLocaleString()}</p>
                            <div class="screenshot-grid">
                                <div class="screenshot-container">
                                    <img src="${viewport.screenshots.live}" alt="Live Site">
                                    <div class="screenshot-label">Live Site</div>
                                </div>
                                <div class="screenshot-container">
                                    <img src="${viewport.screenshots.local}" alt="Clone Site">
                                    <div class="screenshot-label">Clone Site</div>
                                </div>
                                <div class="screenshot-container">
                                    <img src="${viewport.screenshots.diff}" alt="Differences">
                                    <div class="screenshot-label">Differences</div>
                                </div>
                            </div>
                        ` : viewport.error ? `
                            <p class="error">Error: ${viewport.error}</p>
                        ` : ''}
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
        `).join('')}

        <div class="page-section">
            <div class="page-header">🔧 Recommendations</div>
            <div style="padding: 1.5rem;">
                <h3>To achieve pixel-perfect accuracy:</h3>
                <ol>
                    <li><strong>Font Loading:</strong> Ensure all custom fonts are properly loaded</li>
                    <li><strong>Asset Optimization:</strong> Verify all images load correctly</li>
                    <li><strong>CSS Inheritance:</strong> Check for missing or conflicting styles</li>
                    <li><strong>JavaScript Dependencies:</strong> Ensure interactive elements work identically</li>
                    <li><strong>Responsive Behavior:</strong> Test all breakpoints thoroughly</li>
                </ol>
            </div>
        </div>
    </div>
</body>
</html>`;

    await fs.writeFile(`${RESULTS_DIR}/precision-report.html`, reportHtml);
    await fs.writeJson(`${RESULTS_DIR}/results.json`, this.results, { spaces: 2 });

    console.log(`\n📊 Report generated: ${RESULTS_DIR}/precision-report.html`);
    return this.results;
  }

  async run() {
    try {
      await this.init();

      for (const pageConfig of PAGES) {
        const pageResult = await this.testPage(pageConfig);
        this.results.detailed.push(pageResult);
      }

      await this.generateReport();

      console.log('\n✨ Precision Verification Complete!');
      console.log(`📈 Results: ${this.results.summary.passed}/${this.results.summary.totalTests} tests passed`);
      console.log(`🎯 Accuracy: ${((this.results.summary.passed / this.results.summary.totalTests) * 100).toFixed(1)}%`);

      return this.results;

    } catch (error) {
      console.error('💥 Verification failed:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// Run the verification
const verifier = new PrecisionVerifier();
verifier.run().catch(console.error);