import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'node:path';
import * as cheerio from 'cheerio';

const ROOT = 'https://www.culturalpeace.org';
const LOCAL_DIR = './culturalpeace_clone';
const REPORT_FILE = './verification-report.html';

async function normalizeContent(html) {
  const $ = cheerio.load(html);
  
  // Remove elements that are expected to differ
  $('script').remove();
  $('noscript').remove();
  $('meta[name="csrf-token"]').remove();
  $('meta[property="og:updated_time"]').remove();
  $('.sqs-block-id').remove();
  
  // Normalize whitespace
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  
  return {
    text,
    headings: $('h1, h2, h3, h4, h5, h6').map((i, el) => $(el).text().trim()).get(),
    links: $('a[href]').map((i, el) => $(el).attr('href')).get().filter(href => href && !href.startsWith('#')),
    images: $('img[src]').length
  };
}

async function comparePages(liveUrl, localPath) {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const results = {
    url: liveUrl,
    localPath,
    matches: true,
    differences: [],
    errors: []
  };
  
  try {
    // Get live content
    const page = await browser.newPage();
    await page.goto(liveUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    await page.waitForTimeout(2000);
    
    const liveHtml = await page.content();
    const liveContent = await normalizeContent(liveHtml);
    
    // Get local content
    const localHtml = await fs.readFile(localPath, 'utf-8');
    const localContent = await normalizeContent(localHtml);
    
    // Compare text content
    const textSimilarity = calculateSimilarity(liveContent.text, localContent.text);
    if (textSimilarity < 0.9) {
      results.matches = false;
      results.differences.push({
        type: 'text',
        similarity: textSimilarity,
        message: `Text content similarity: ${(textSimilarity * 100).toFixed(1)}%`
      });
    }
    
    // Compare headings
    const headingsDiff = compareArrays(liveContent.headings, localContent.headings);
    if (headingsDiff.missing.length > 0 || headingsDiff.extra.length > 0) {
      results.differences.push({
        type: 'headings',
        missing: headingsDiff.missing,
        extra: headingsDiff.extra
      });
    }
    
    // Compare link count
    const linkDiff = Math.abs(liveContent.links.length - localContent.links.length);
    if (linkDiff > 5) {
      results.differences.push({
        type: 'links',
        liveCount: liveContent.links.length,
        localCount: localContent.links.length,
        message: `Link count difference: ${linkDiff}`
      });
    }
    
    // Compare image count
    const imageDiff = Math.abs(liveContent.images - localContent.images);
    if (imageDiff > 2) {
      results.differences.push({
        type: 'images',
        liveCount: liveContent.images,
        localCount: localContent.images,
        message: `Image count difference: ${imageDiff}`
      });
    }
    
    // Take screenshots for visual comparison
    const screenshotDir = './screenshots';
    await fs.ensureDir(screenshotDir);
    
    const pageName = path.basename(localPath, '.html');
    await page.screenshot({
      path: path.join(screenshotDir, `${pageName}-live.png`),
      fullPage: true
    });
    
    // Screenshot local version
    await page.goto(`file://${path.resolve(localPath)}`, {
      waitUntil: 'networkidle0'
    });
    await page.screenshot({
      path: path.join(screenshotDir, `${pageName}-local.png`),
      fullPage: true
    });
    
    results.screenshots = {
      live: `./screenshots/${pageName}-live.png`,
      local: `./screenshots/${pageName}-local.png`
    };
    
  } catch (error) {
    results.errors.push(error.message);
    results.matches = false;
  } finally {
    await browser.close();
  }
  
  return results;
}

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function compareArrays(arr1, arr2) {
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  
  const missing = arr1.filter(item => !set2.has(item));
  const extra = arr2.filter(item => !set1.has(item));
  
  return { missing, extra };
}

async function generateReport(results) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Verification Report - Cultural Peace Clone</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #2c3e50; }
    .summary {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .page-result {
      background: white;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 8px;
      border-left: 4px solid #3498db;
    }
    .page-result.error {
      border-left-color: #e74c3c;
    }
    .page-result.warning {
      border-left-color: #f39c12;
    }
    .page-result.success {
      border-left-color: #27ae60;
    }
    .differences {
      margin-top: 10px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .screenshots {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    .screenshots img {
      max-width: 45%;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    pre {
      background: #2c3e50;
      color: #ecf0f1;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <h1>CulturalPeace.org Clone Verification Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Total Pages Checked: ${results.length}</p>
    <p>Matching Pages: ${results.filter(r => r.matches).length}</p>
    <p>Pages with Differences: ${results.filter(r => !r.matches && r.errors.length === 0).length}</p>
    <p>Pages with Errors: ${results.filter(r => r.errors.length > 0).length}</p>
  </div>
  
  ${results.map(result => {
    const statusClass = result.errors.length > 0 ? 'error' : 
                        result.matches ? 'success' : 'warning';
    
    return `
    <div class="page-result ${statusClass}">
      <h3>${result.url}</h3>
      <p>Local: ${result.localPath}</p>
      <p>Status: ${result.matches ? '✓ Match' : '⚠ Differences Found'}</p>
      
      ${result.differences.length > 0 ? `
      <div class="differences">
        <h4>Differences:</h4>
        ${result.differences.map(diff => `
          <p><strong>${diff.type}:</strong> ${diff.message || JSON.stringify(diff)}</p>
        `).join('')}
      </div>
      ` : ''}
      
      ${result.errors.length > 0 ? `
      <div class="differences">
        <h4>Errors:</h4>
        ${result.errors.map(err => `<p>${err}</p>`).join('')}
      </div>
      ` : ''}
      
      ${result.screenshots ? `
      <div class="screenshots">
        <div>
          <h4>Live Site</h4>
          <img src="${result.screenshots.live}" alt="Live screenshot">
        </div>
        <div>
          <h4>Local Clone</h4>
          <img src="${result.screenshots.local}" alt="Local screenshot">
        </div>
      </div>
      ` : ''}
    </div>
    `;
  }).join('')}
</body>
</html>`;
  
  await fs.writeFile(REPORT_FILE, html);
  console.log(`Verification report saved to: ${REPORT_FILE}`);
}

async function main() {
  console.log('Starting verification process...');
  
  // Load manifest
  const manifestPath = path.join(LOCAL_DIR, 'manifest.json');
  if (!await fs.pathExists(manifestPath)) {
    console.error('Manifest not found. Please run scrape.mjs first.');
    process.exit(1);
  }
  
  const manifest = await fs.readJson(manifestPath);
  const results = [];
  
  // Verify a sample of pages (or all if few enough)
  const pagesToCheck = manifest.slice(0, Math.min(10, manifest.length));
  
  for (const entry of pagesToCheck) {
    console.log(`Verifying: ${entry.url}`);
    const localPath = path.join(LOCAL_DIR, entry.file);
    
    if (await fs.pathExists(localPath)) {
      const result = await comparePages(entry.url, localPath);
      results.push(result);
      
      if (result.matches) {
        console.log(`  ✓ Match`);
      } else {
        console.log(`  ⚠ Differences found`);
      }
    } else {
      results.push({
        url: entry.url,
        localPath,
        matches: false,
        differences: [],
        errors: ['Local file not found']
      });
      console.log(`  ✗ Local file not found`);
    }
  }
  
  await generateReport(results);
  
  console.log('\n=== Verification Complete ===');
  console.log(`Check ${REPORT_FILE} for detailed results`);
}

main().catch(console.error);