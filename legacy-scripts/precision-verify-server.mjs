import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'node:path';
import * as cheerio from 'cheerio';
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIVE_URL = 'https://www.culturalpeace.org';
const LOCAL_PORT = 8889;
const LOCAL_BASE = `http://localhost:${LOCAL_PORT}`;
const RESULTS_DIR = './precision-results';
const TOLERANCE = 0.1;

// Viewport configurations
const VIEWPORTS = [
  { name: 'desktop-large', width: 1920, height: 1080 },
  { name: 'desktop-medium', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile-large', width: 414, height: 896 },
  { name: 'mobile-small', width: 320, height: 568 }
];

// Pages to test
const PAGES = [
  { name: 'home', live: LIVE_URL, local: `${LOCAL_BASE}/index.html` },
  { name: 'links', live: `${LIVE_URL}/links`, local: `${LOCAL_BASE}/links.html` },
  { name: 'contact', live: `${LIVE_URL}/contact-1`, local: `${LOCAL_BASE}/contact-1.html` }
];

// Simple HTTP server for local files
function createLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(__dirname, 'docs', req.url === '/' ? 'index.html' : req.url);
      
      // Security check
      if (!filePath.startsWith(path.join(__dirname, 'docs'))) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath)
        .then(data => {
          let contentType = 'text/html';
          if (filePath.endsWith('.css')) contentType = 'text/css';
          if (filePath.endsWith('.js')) contentType = 'application/javascript';
          if (filePath.endsWith('.png')) contentType = 'image/png';
          if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
          
          res.setHeader('Content-Type', contentType);
          res.statusCode = 200;
          res.end(data);
        })
        .catch(() => {
          res.statusCode = 404;
          res.end('Not Found');
        });
    });

    server.listen(LOCAL_PORT, () => {
      console.log(`📡 Local server started on http://localhost:${LOCAL_PORT}`);
      resolve(server);
    });

    server.on('error', reject);
  });
}

class PrecisionVerifier {
  constructor() {
    this.browser = null;
    this.server = null;
    this.results = {
      summary: { totalTests: 0, passed: 0, failed: 0, errors: [] },
      detailed: []
    };
  }

  async init() {
    console.log('🚀 Starting Precision Verification with Local Server...');
    
    // Start local server
    this.server = await createLocalServer();
    
    // Setup directories
    await fs.ensureDir(RESULTS_DIR);
    await fs.ensureDir(`${RESULTS_DIR}/screenshots`);
    await fs.ensureDir(`${RESULTS_DIR}/diffs`);
    
    // Launch browser
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async cleanup() {
    if (this.browser) await this.browser.close();
    if (this.server) this.server.close();
  }

  async compareImages(image1Path, image2Path, outputPath) {
    try {
      console.log(`    🔍 Comparing: ${path.basename(image1Path)} vs ${path.basename(image2Path)}`);
      
      // Check if files exist
      if (!await fs.pathExists(image1Path)) {
        throw new Error(`Live screenshot not found: ${image1Path}`);
      }
      if (!await fs.pathExists(image2Path)) {
        throw new Error(`Local screenshot not found: ${image2Path}`);
      }
      
      // Get image dimensions first
      const img1Info = await sharp(image1Path).metadata();
      const img2Info = await sharp(image2Path).metadata();
      
      console.log(`    📐 Live: ${img1Info.width}x${img1Info.height}, Local: ${img2Info.width}x${img2Info.height}`);
      
      // Find the overlapping area (minimum dimensions)
      const width = Math.min(img1Info.width, img2Info.width);
      const height = Math.min(img1Info.height, img2Info.height);
      
      console.log(`    ✂️  Comparing overlapping area: ${width}x${height}`);
      
      // Crop both images to the same size and convert to RGBA for pixelmatch
      const img1 = await sharp(image1Path)
        .extract({ left: 0, top: 0, width, height })
        .ensureAlpha()
        .raw()
        .toBuffer();
        
      const img2 = await sharp(image2Path)
        .extract({ left: 0, top: 0, width, height })
        .ensureAlpha()
        .raw()
        .toBuffer();

      // Create diff buffer (RGBA = 4 channels)
      const diff = Buffer.alloc(width * height * 4);
      
      // Compare using pixelmatch
      const pixelDiff = pixelmatch(
        img1, 
        img2, 
        diff, 
        width, 
        height,
        { threshold: TOLERANCE, diffColor: [255, 0, 0], diffColorAlt: [0, 255, 0] }
      );

      // Save difference image
      await sharp(diff, {
        raw: { width, height, channels: 4 }
      }).png().toFile(outputPath);

      const totalPixels = width * height;
      const diffPercentage = (pixelDiff / totalPixels) * 100;
      
      console.log(`    📊 Pixel differences: ${pixelDiff}/${totalPixels} (${diffPercentage.toFixed(2)}%)`);
      
      // Calculate height difference as additional metric
      const heightDiff = Math.abs(img1Info.height - img2Info.height);
      const heightDiffPercentage = (heightDiff / Math.max(img1Info.height, img2Info.height)) * 100;
      
      return {
        pixelDiff,
        totalPixels,
        diffPercentage,
        heightDiff,
        heightDiffPercentage,
        dimensionsMatch: img1Info.width === img2Info.width && img1Info.height === img2Info.height,
        passed: diffPercentage < 5.0 && heightDiffPercentage < 10.0 // More lenient for now
      };
    } catch (error) {
      console.log(`    ❌ Image comparison error: ${error.message}`);
      return { error: error.message, passed: false, diffPercentage: 0, pixelDiff: 0 };
    }
  }

  async captureScreenshot(page, outputPath, viewport) {
    await page.setViewport(viewport);
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for content to load
    
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

    return await page.screenshot({ path: outputPath, fullPage: true });
  }

  async analyzeContent(page) {
    return await page.evaluate(() => {
      return {
        title: document.title,
        headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
          tag: h.tagName,
          text: h.textContent.trim()
        })),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          loaded: img.complete && img.naturalWidth > 0,
          width: img.naturalWidth,
          height: img.naturalHeight
        })),
        links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
          href: a.href,
          text: a.textContent.trim()
        }))
      };
    });
  }

  async testPage(pageConfig) {
    console.log(`\n🔍 Testing: ${pageConfig.name}`);
    
    const pageResults = {
      name: pageConfig.name,
      viewports: {},
      passed: true
    };

    for (const viewport of VIEWPORTS) {
      console.log(`  📱 ${viewport.name} (${viewport.width}x${viewport.height})`);
      
      const livePage = await this.browser.newPage();
      const localPage = await this.browser.newPage();

      try {
        // Navigate to both versions
        await Promise.all([
          livePage.goto(pageConfig.live, { waitUntil: 'networkidle2', timeout: 60000 }),
          localPage.goto(pageConfig.local, { waitUntil: 'networkidle2', timeout: 30000 })
        ]);

        // Take screenshots
        const liveScreenshot = `${RESULTS_DIR}/screenshots/${pageConfig.name}-live-${viewport.name}.png`;
        const localScreenshot = `${RESULTS_DIR}/screenshots/${pageConfig.name}-local-${viewport.name}.png`;
        const diffImage = `${RESULTS_DIR}/diffs/${pageConfig.name}-diff-${viewport.name}.png`;

        await Promise.all([
          this.captureScreenshot(livePage, liveScreenshot, viewport),
          this.captureScreenshot(localPage, localScreenshot, viewport)
        ]);

        // Compare images
        const comparison = await this.compareImages(liveScreenshot, localScreenshot, diffImage);
        
        pageResults.viewports[viewport.name] = {
          comparison,
          passed: comparison.passed,
          screenshots: { live: liveScreenshot, local: localScreenshot, diff: diffImage }
        };

        // Analyze content for desktop-large only
        if (viewport.name === 'desktop-large') {
          const [liveContent, localContent] = await Promise.all([
            this.analyzeContent(livePage),
            this.analyzeContent(localPage)
          ]);
          
          pageResults.contentAnalysis = {
            live: liveContent,
            local: localContent,
            missingImages: localContent.images.filter(img => !img.loaded),
            headingDiff: Math.abs(liveContent.headings.length - localContent.headings.length),
            imageDiff: Math.abs(liveContent.images.length - localContent.images.length)
          };
        }

        if (!comparison.passed) pageResults.passed = false;
        this.results.summary.totalTests++;
        
        if (comparison.passed) {
          this.results.summary.passed++;
          console.log(`    ✅ PASSED (${comparison.diffPercentage?.toFixed(2) || 'N/A'}% diff)`);
        } else {
          this.results.summary.failed++;
          console.log(`    ❌ FAILED (${comparison.diffPercentage?.toFixed(2) || 'ERROR'}% diff)`);
        }

      } catch (error) {
        console.log(`    ❌ ERROR: ${error.message}`);
        pageResults.viewports[viewport.name] = { error: error.message, passed: false };
        pageResults.passed = false;
        this.results.summary.errors.push(`${pageConfig.name}-${viewport.name}: ${error.message}`);
      } finally {
        await livePage.close();
        await localPage.close();
      }
    }

    return pageResults;
  }

  async generateReport() {
    const accuracy = this.results.summary.totalTests > 0 
      ? ((this.results.summary.passed / this.results.summary.totalTests) * 100).toFixed(1)
      : 0;

    const reportHtml = `<!DOCTYPE html>
<html>
<head>
    <title>🎯 Precision Verification Report</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat { background: white; padding: 1.5rem; border-radius: 8px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .stat-value { font-size: 2rem; font-weight: bold; }
        .page-section { background: white; margin-bottom: 2rem; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .page-header { background: #2c3e50; color: white; padding: 1rem; font-weight: bold; }
        .viewport-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; padding: 1rem; }
        .viewport-card { border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
        .viewport-header { background: #f8f9fa; padding: 1rem; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; }
        .screenshots { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; padding: 1rem; }
        .screenshot img { width: 100%; border-radius: 4px; }
        .screenshot-label { text-align: center; font-size: 0.8rem; color: #666; margin-top: 0.5rem; }
        .passed { border-left: 4px solid #28a745; }
        .failed { border-left: 4px solid #dc3545; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 Precision Verification Report</h1>
        <p>CulturalPeace.org Clone Accuracy Analysis</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>

    <div class="stats">
        <div class="stat">
            <div class="stat-value">${this.results.summary.totalTests}</div>
            <div>Total Tests</div>
        </div>
        <div class="stat">
            <div class="stat-value success">${this.results.summary.passed}</div>
            <div>Passed</div>
        </div>
        <div class="stat">
            <div class="stat-value error">${this.results.summary.failed}</div>
            <div>Failed</div>
        </div>
        <div class="stat">
            <div class="stat-value">${accuracy}%</div>
            <div>Accuracy</div>
        </div>
    </div>

    ${this.results.detailed.map(page => `
    <div class="page-section">
        <div class="page-header">
            ${page.name.toUpperCase()} ${page.passed ? '✅' : '❌'}
        </div>
        
        ${page.contentAnalysis ? `
        <div style="padding: 1rem; background: #f8f9fa; border-bottom: 1px solid #dee2e6;">
            <h4>📊 Content Analysis</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div>
                    <strong>Live:</strong> ${page.contentAnalysis.live.headings.length} headings, ${page.contentAnalysis.live.images.length} images
                </div>
                <div>
                    <strong>Clone:</strong> ${page.contentAnalysis.local.headings.length} headings, ${page.contentAnalysis.local.images.length} images
                </div>
            </div>
            ${page.contentAnalysis.missingImages.length > 0 ? `
            <div style="color: #dc3545; margin-top: 1rem;">
                <strong>⚠️ Missing Images:</strong> ${page.contentAnalysis.missingImages.length}
            </div>` : ''}
        </div>` : ''}
        
        <div class="viewport-grid">
            ${Object.entries(page.viewports).map(([name, result]) => `
            <div class="viewport-card ${result.passed ? 'passed' : 'failed'}">
                <div class="viewport-header">
                    <strong>${name}</strong>
                    <span>${result.passed ? '✅' : '❌'}</span>
                </div>
                ${result.comparison ? `
                <div style="padding: 1rem;">
                    <p>Pixel Difference: <strong>${result.comparison.diffPercentage?.toFixed(2) || 'ERROR'}%</strong></p>
                    <p>Changed pixels: ${result.comparison.pixelDiff?.toLocaleString() || 'N/A'}</p>
                    ${result.comparison.heightDiff ? `<p>Height difference: ${result.comparison.heightDiff}px (${result.comparison.heightDiffPercentage?.toFixed(1)}%)</p>` : ''}
                    <p>Dimensions match: ${result.comparison.dimensionsMatch ? '✅' : '❌'}</p>
                </div>
                <div class="screenshots">
                    <div class="screenshot">
                        <img src="${result.screenshots.live}" alt="Live">
                        <div class="screenshot-label">Live Site</div>
                    </div>
                    <div class="screenshot">
                        <img src="${result.screenshots.local}" alt="Clone">
                        <div class="screenshot-label">Clone</div>
                    </div>
                    <div class="screenshot">
                        <img src="${result.screenshots.diff}" alt="Diff">
                        <div class="screenshot-label">Differences</div>
                    </div>
                </div>
                ` : result.error ? `
                <div style="padding: 1rem; color: #dc3545;">
                    Error: ${result.error}
                </div>` : ''}
            </div>
            `).join('')}
        </div>
    </div>
    `).join('')}
</body>
</html>`;

    await fs.writeFile(`${RESULTS_DIR}/precision-report.html`, reportHtml);
    console.log(`\n📊 Report: ${RESULTS_DIR}/precision-report.html`);
  }

  async run() {
    try {
      await this.init();
      
      for (const pageConfig of PAGES) {
        const result = await this.testPage(pageConfig);
        this.results.detailed.push(result);
      }
      
      await this.generateReport();
      
      console.log(`\n✨ Verification Complete!`);
      console.log(`📈 ${this.results.summary.passed}/${this.results.summary.totalTests} tests passed`);
      console.log(`🎯 ${((this.results.summary.passed/this.results.summary.totalTests)*100).toFixed(1)}% accuracy`);

      return this.results;
    } finally {
      await this.cleanup();
    }
  }
}

const verifier = new PrecisionVerifier();
verifier.run().catch(console.error);