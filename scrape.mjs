import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'node:path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { URL } from 'node:url';

const ROOT = 'https://www.culturalpeace.org';
const OUTDIR = './culturalpeace_clone';
const CONCURRENCY = 4;

// Helpers
const sleep = ms => new Promise(r => setTimeout(r, ms));

const urlToFile = u => {
  const url = new URL(u);
  let pathname = url.pathname.replace(/\/$/, '/index');
  
  // Handle special cases
  if (pathname === '/index') pathname = '/index';
  if (!pathname.endsWith('.html') && !pathname.includes('.')) {
    pathname = pathname + '.html';
  }
  
  return path.join(OUTDIR, pathname.startsWith('/') ? pathname.slice(1) : pathname);
};

const saveFile = async (filePath, data) => {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, data);
};

const downloadAsset = async (url, basePath) => {
  try {
    const assetUrl = new URL(url);
    let assetPath;
    
    // Handle different CDN sources
    if (assetUrl.hostname.includes('squarespace')) {
      assetPath = path.join(basePath, 'assets', 'squarespace', assetUrl.pathname);
    } else if (assetUrl.hostname === 'www.culturalpeace.org' || assetUrl.hostname === 'culturalpeace.org') {
      assetPath = path.join(basePath, assetUrl.pathname.slice(1));
    } else {
      assetPath = path.join(basePath, 'assets', 'external', assetUrl.hostname, assetUrl.pathname);
    }
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CulturalPeaceCloner/1.0)'
      }
    });
    
    await saveFile(assetPath, response.data);
    return path.relative(basePath, assetPath);
  } catch (error) {
    console.error(`Failed to download ${url}:`, error.message);
    return null;
  }
};

// Main crawler
async function crawlSite() {
  console.log('Starting Puppeteer crawler for CulturalPeace.org...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const queue = [ROOT];
  const visited = new Set();
  const manifest = [];
  const assets = new Set();
  
  const dlLimit = pLimit(8);
  const pgLimit = pLimit(CONCURRENCY);
  
  while (queue.length > 0) {
    const batch = queue.splice(0, CONCURRENCY);
    
    await Promise.all(batch.map(url => pgLimit(async () => {
      if (visited.has(url)) return;
      visited.add(url);
      
      const page = await browser.newPage();
      
      try {
        // Set viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Block unnecessary resources for faster loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          if (['font', 'media'].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });
        
        console.log(`Navigating to: ${url}`);
        await page.goto(url, {
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 60000
        });
        
        // Wait for Squarespace-specific content to load
        await page.waitForSelector('body', { timeout: 10000 }).catch(() => {});
        await sleep(2000); // Give dynamic content time to load
        
        // Scroll to trigger lazy loading
        await page.evaluate(() => {
          return new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;
              
              if(totalHeight >= scrollHeight){
                clearInterval(timer);
                window.scrollTo(0, 0);
                resolve();
              }
            }, 100);
          });
        });
        
        await sleep(1000);
        
        // Get the final HTML
        const html = await page.content();
        const filePath = urlToFile(url);
        
        // Parse with cheerio for processing
        const $ = cheerio.load(html);
        
        // Remove Squarespace-specific scripts and tracking
        $('script[src*="squarespace-cdn"]').remove();
        $('script[src*="googletagmanager"]').remove();
        $('script[src*="analytics"]').remove();
        $('script:contains("SquareSpace")').remove();
        $('noscript').remove();
        
        // Find all internal links
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          
          try {
            const absoluteUrl = new URL(href, url);
            
            // Only add culturalpeace.org URLs
            if (absoluteUrl.hostname === 'www.culturalpeace.org' || 
                absoluteUrl.hostname === 'culturalpeace.org') {
              const cleanUrl = absoluteUrl.origin + absoluteUrl.pathname;
              if (!visited.has(cleanUrl) && !queue.includes(cleanUrl)) {
                queue.push(cleanUrl);
              }
              
              // Update link to be relative
              const relativePath = absoluteUrl.pathname;
              $(el).attr('href', relativePath);
            }
          } catch (e) {
            // Keep relative links as-is
          }
        });
        
        // Collect and rewrite assets
        const assetPromises = [];
        
        // Images
        $('img[src], img[data-src], img[data-image]').each((_, el) => {
          const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-image');
          if (src && !src.startsWith('data:')) {
            try {
              const assetUrl = new URL(src, url).href;
              assets.add(assetUrl);
              assetPromises.push(dlLimit(async () => {
                const localPath = await downloadAsset(assetUrl, OUTDIR);
                if (localPath) {
                  const relativePath = path.relative(path.dirname(filePath), path.join(OUTDIR, localPath));
                  $(el).attr('src', relativePath);
                  $(el).removeAttr('data-src');
                  $(el).removeAttr('data-image');
                }
              }));
            } catch (e) {}
          }
        });
        
        // CSS
        $('link[rel="stylesheet"][href]').each((_, el) => {
          const href = $(el).attr('href');
          if (href && !href.startsWith('data:')) {
            try {
              const assetUrl = new URL(href, url).href;
              assets.add(assetUrl);
              assetPromises.push(dlLimit(async () => {
                const localPath = await downloadAsset(assetUrl, OUTDIR);
                if (localPath) {
                  const relativePath = path.relative(path.dirname(filePath), path.join(OUTDIR, localPath));
                  $(el).attr('href', relativePath);
                }
              }));
            } catch (e) {}
          }
        });
        
        // JavaScript (be selective)
        $('script[src]').each((_, el) => {
          const src = $(el).attr('src');
          if (src && !src.includes('squarespace-cdn') && !src.includes('analytics')) {
            try {
              const assetUrl = new URL(src, url).href;
              assets.add(assetUrl);
              assetPromises.push(dlLimit(async () => {
                const localPath = await downloadAsset(assetUrl, OUTDIR);
                if (localPath) {
                  const relativePath = path.relative(path.dirname(filePath), path.join(OUTDIR, localPath));
                  $(el).attr('src', relativePath);
                }
              }));
            } catch (e) {}
          }
        });
        
        // Background images in style attributes
        $('[style*="background-image"]').each((_, el) => {
          const style = $(el).attr('style');
          const matches = style.match(/url\(['"]?([^'")]+)['"]?\)/g);
          if (matches) {
            matches.forEach(match => {
              const url = match.match(/url\(['"]?([^'")]+)['"]?\)/)[1];
              if (url && !url.startsWith('data:')) {
                assets.add(new URL(url, ROOT).href);
              }
            });
          }
        });
        
        await Promise.all(assetPromises);
        
        // Save the processed HTML
        await saveFile(filePath, $.html());
        
        manifest.push({
          url,
          file: path.relative(OUTDIR, filePath),
          title: $('title').text() || 'Cultural Peace',
          timestamp: new Date().toISOString()
        });
        
        console.log(`✓ Saved: ${url}`);
        
      } catch (error) {
        console.error(`✗ Failed to process ${url}:`, error.message);
      } finally {
        await page.close();
      }
    })));
  }
  
  // Save manifest
  await saveFile(
    path.join(OUTDIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  // Create index redirect if needed
  const indexPath = path.join(OUTDIR, 'index.html');
  if (!await fs.pathExists(indexPath)) {
    const homeContent = await fs.readFile(path.join(OUTDIR, 'home.html'), 'utf-8').catch(() => null);
    if (homeContent) {
      await fs.writeFile(indexPath, homeContent);
    } else {
      // Create a redirect
      await fs.writeFile(indexPath, `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url=/home">
  <title>Cultural Peace</title>
</head>
<body>
  <p>Redirecting to <a href="/home">Cultural Peace</a>...</p>
</body>
</html>`);
    }
  }
  
  await browser.close();
  
  console.log('\n=== Crawl Complete ===');
  console.log(`Pages crawled: ${visited.size}`);
  console.log(`Assets downloaded: ${assets.size}`);
  console.log(`Output directory: ${OUTDIR}`);
  console.log(`\nManifest saved to: ${path.join(OUTDIR, 'manifest.json')}`);
}

// Run the crawler
crawlSite().catch(console.error);