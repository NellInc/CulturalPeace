import fs from 'fs-extra';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { minify } from 'html-minifier-terser';
import prettier from 'prettier';

const SOURCE_DIR = './culturalpeace_clone';
const OUTPUT_DIR = './docs'; // GitHub Pages typically serves from 'docs' folder
const CNAME_DOMAIN = 'culturalpeace.org'; // Update if using custom domain

async function cleanHTML(htmlContent, filePath) {
  const $ = cheerio.load(htmlContent);
  
  // Remove Squarespace-specific elements
  $('.sqs-block-id').remove();
  $('.sqs-block-code').removeClass('sqs-block-code');
  $('[data-block-type]').removeAttr('data-block-type');
  $('[data-block-json]').removeAttr('data-block-json');
  $('[id^="yui_"]').removeAttr('id');
  $('.sqs-layout').removeClass('sqs-layout');
  
  // Remove empty divs and spans
  $('div:empty, span:empty').remove();
  
  // Clean up classes
  $('[class]').each((_, el) => {
    const classes = $(el).attr('class').split(' ').filter(c => 
      !c.startsWith('sqs-') && 
      !c.startsWith('yui') &&
      c.length > 0
    );
    if (classes.length > 0) {
      $(el).attr('class', classes.join(' '));
    } else {
      $(el).removeAttr('class');
    }
  });
  
  // Fix internal links for GitHub Pages
  $('a[href]').each((_, el) => {
    let href = $(el).attr('href');
    if (href && !href.startsWith('http') && !href.startsWith('#')) {
      // Remove leading slash for relative paths
      if (href.startsWith('/')) {
        href = href.slice(1);
      }
      // Add .html extension if missing
      if (!href.includes('.') && !href.endsWith('/')) {
        href = href + '.html';
      }
      $(el).attr('href', href);
    }
  });
  
  // Fix asset paths
  $('img[src], link[href], script[src]').each((_, el) => {
    const attr = el.tagName === 'link' ? 'href' : 'src';
    let path = $(el).attr(attr);
    if (path && !path.startsWith('http') && !path.startsWith('data:')) {
      // Make paths relative
      if (path.startsWith('/')) {
        path = path.slice(1);
      }
      $(el).attr(attr, path);
    }
  });
  
  // Add viewport meta if missing
  if ($('meta[name="viewport"]').length === 0) {
    $('head').prepend('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  }
  
  // Add charset if missing
  if ($('meta[charset]').length === 0) {
    $('head').prepend('<meta charset="UTF-8">');
  }
  
  // Add a simple navigation menu
  if ($('nav').length === 0) {
    const nav = `
    <nav style="background: #2c3e50; padding: 1em; text-align: center;">
      <a href="index.html" style="color: white; margin: 0 15px; text-decoration: none;">Home</a>
      <a href="about.html" style="color: white; margin: 0 15px; text-decoration: none;">About</a>
      <a href="contact.html" style="color: white; margin: 0 15px; text-decoration: none;">Contact</a>
    </nav>`;
    $('body').prepend(nav);
  }
  
  // Add responsive CSS
  const responsiveCSS = `
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
      }
      main, .content {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      img {
        max-width: 100%;
        height: auto;
      }
      @media (max-width: 768px) {
        body { font-size: 14px; }
        main, .content { padding: 10px; }
        h1 { font-size: 1.8em; }
        h2 { font-size: 1.4em; }
      }
      blockquote {
        border-left: 4px solid #3498db;
        margin: 1em 0;
        padding-left: 1em;
        color: #555;
        font-style: italic;
      }
      a {
        color: #3498db;
      }
      a:hover {
        color: #2980b9;
      }
      pre {
        background: #f4f4f4;
        padding: 1em;
        overflow-x: auto;
        border-radius: 4px;
      }
      code {
        background: #f4f4f4;
        padding: 0.2em 0.4em;
        border-radius: 3px;
      }
    </style>
  `;
  
  $('head').append(responsiveCSS);
  
  return $.html();
}

async function processFile(sourcePath, destPath) {
  const content = await fs.readFile(sourcePath, 'utf-8');
  const ext = path.extname(sourcePath).toLowerCase();
  
  if (ext === '.html' || ext === '.htm') {
    // Clean and process HTML
    let cleaned = await cleanHTML(content, sourcePath);
    
    // Format with prettier
    try {
      cleaned = await prettier.format(cleaned, {
        parser: 'html',
        printWidth: 120,
        tabWidth: 2
      });
    } catch (e) {
      console.warn(`Could not format ${sourcePath}: ${e.message}`);
    }
    
    // Minify for production
    const minified = await minify(cleaned, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true,
      removeEmptyAttributes: true,
      removeRedundantAttributes: true
    });
    
    await fs.writeFile(destPath, minified);
  } else {
    // Copy other files as-is
    await fs.copy(sourcePath, destPath);
  }
}

async function generateSitemap(outputDir) {
  const files = await fs.readdir(outputDir);
  const htmlFiles = files.filter(f => f.endsWith('.html'));
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${htmlFiles.map(file => `  <url>
    <loc>https://${CNAME_DOMAIN}/${file}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>${file === 'index.html' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;
  
  await fs.writeFile(path.join(outputDir, 'sitemap.xml'), sitemap);
}

async function generate404Page(outputDir) {
  const page404 = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page Not Found | Cultural Peace</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 20px;
    }
    h1 {
      font-size: 120px;
      margin: 0;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    p {
      font-size: 24px;
      margin: 20px 0;
    }
    a {
      display: inline-block;
      padding: 12px 30px;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 25px;
      margin-top: 20px;
      transition: transform 0.3s;
    }
    a:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>Oops! The page you're looking for doesn't exist.</p>
    <a href="index.html">Return to Home</a>
  </div>
</body>
</html>`;
  
  await fs.writeFile(path.join(outputDir, '404.html'), page404);
}

async function createGitHubPagesConfig(outputDir) {
  // Create CNAME file for custom domain
  if (CNAME_DOMAIN && !CNAME_DOMAIN.includes('github.io')) {
    await fs.writeFile(path.join(outputDir, 'CNAME'), CNAME_DOMAIN);
  }
  
  // Create Jekyll config to disable Jekyll processing
  await fs.writeFile(path.join(outputDir, '.nojekyll'), '');
  
  // Create robots.txt
  const robots = `User-agent: *
Allow: /

Sitemap: https://${CNAME_DOMAIN}/sitemap.xml`;
  
  await fs.writeFile(path.join(outputDir, 'robots.txt'), robots);
}

async function copyDirectory(source, dest) {
  await fs.ensureDir(dest);
  const entries = await fs.readdir(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else {
      console.log(`Processing: ${entry.name}`);
      await processFile(sourcePath, destPath);
    }
  }
}

async function main() {
  console.log('Starting GitHub Pages optimization...');
  
  // Check if source directory exists
  if (!await fs.pathExists(SOURCE_DIR)) {
    console.error(`Source directory ${SOURCE_DIR} not found. Please run scrape.mjs first.`);
    process.exit(1);
  }
  
  // Clean output directory
  await fs.emptyDir(OUTPUT_DIR);
  
  // Process all files
  await copyDirectory(SOURCE_DIR, OUTPUT_DIR);
  
  // Generate additional files
  console.log('Generating sitemap...');
  await generateSitemap(OUTPUT_DIR);
  
  console.log('Creating 404 page...');
  await generate404Page(OUTPUT_DIR);
  
  console.log('Setting up GitHub Pages configuration...');
  await createGitHubPagesConfig(OUTPUT_DIR);
  
  // Create a simple README
  const readme = `# Cultural Peace - Static Site

This is a static HTML version of CulturalPeace.org, optimized for GitHub Pages hosting.

## Setup

1. Push this repository to GitHub
2. Go to Settings > Pages
3. Select source: Deploy from a branch
4. Choose branch: main, folder: /docs
5. Save and wait for deployment

## Custom Domain

To use a custom domain:
1. Update the CNAME file in the docs folder
2. Configure DNS settings with your domain provider
3. Add A records pointing to GitHub Pages IPs

## Local Development

To run locally:
\`\`\`bash
cd docs
python -m http.server 8000
# or
npx serve docs
\`\`\`

Then visit http://localhost:8000

## Maintenance

To update content:
1. Run \`npm run full-clone\` to re-scrape the site
2. Commit and push changes
3. GitHub Pages will automatically update`;
  
  await fs.writeFile('README.md', readme);
  
  console.log('\n=== GitHub Pages Optimization Complete ===');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('\nNext steps:');
  console.log('1. Review the generated files in the docs/ folder');
  console.log('2. Test locally: cd docs && python -m http.server 8000');
  console.log('3. Commit and push to GitHub');
  console.log('4. Enable GitHub Pages in repository settings');
  console.log('5. Configure custom domain if needed');
}

main().catch(console.error);