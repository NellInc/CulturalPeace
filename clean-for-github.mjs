import fs from 'fs-extra';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { minify } from 'html-minifier-terser';
import prettier from 'prettier';

// Curated, reviewable source pages. The raw Squarespace scrape remains an import
// artifact and contains obsolete routes, broken local assets, and duplicate H1s.
const SOURCE_DIR = './site-source';
const OUTPUT_DIR = process.env.OUTPUT_DIR || './docs';
const STATIC_DIR = './site-static';
const CNAME_DOMAIN = 'www.culturalpeace.org';
const SITE_ORIGIN = `https://${CNAME_DOMAIN}`;
const PAGE_SEO = {
  'index.html': {
    output: 'index.html',
    url: `${SITE_ORIGIN}/`,
    title: 'Cultural Peace | 14 Principles for Managing Political Polarization',
    description: 'Explore 14 principles for managing political polarization, protecting innocent people during cultural conflict, and strengthening civil discourse.',
    image: 'social-share.jpg',
    imageAlt: 'People gathering together beneath an open sky',
    type: 'WebPage'
  },
  'contact.html': {
    output: 'contact.html',
    url: `${SITE_ORIGIN}/contact.html`,
    title: 'Contact Cultural Peace | Questions and Collaboration',
    description: 'Contact Cultural Peace with questions, feedback, or collaboration ideas about the 14 principles for managing political polarization.',
    image: 'social-share.jpg',
    imageAlt: 'People gathering together beneath an open sky',
    type: 'ContactPage',
    breadcrumb: 'Contact'
  },
  'links.html': {
    output: 'links.html',
    url: `${SITE_ORIGIN}/links.html`,
    title: 'Political Polarization Resources | Cultural Peace',
    description: 'Explore curated articles, videos, tools, and organizations focused on political polarization, civil discourse, conflict management, and cultural peace.',
    image: 'links-social-share.jpg',
    imageAlt: 'A person looking toward a calm coastal landscape',
    type: 'CollectionPage',
    breadcrumb: 'Resources'
  }
};

function addSeoMetadata($, filePath) {
  const fileName = path.basename(filePath);
  const seo = PAGE_SEO[fileName];
  if (!seo) return;

  $('title, meta[name="description"], meta[name="robots"], meta[name^="twitter:"], meta[property^="og:"]').remove();
  $('link[rel="canonical"], link[rel="alternate"][hreflang], script[type="application/ld+json"]').remove();

  const organization = {
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: 'Cultural Peace',
    url: `${SITE_ORIGIN}/`,
    logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/assets/logo.png`, width: 1500, height: 890 },
    description: 'An initiative presenting 14 principles for managing political polarization and cultural conflict.'
  };
  const website = {
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    url: `${SITE_ORIGIN}/`,
    name: 'Cultural Peace',
    inLanguage: 'en',
    publisher: { '@id': `${SITE_ORIGIN}/#organization` }
  };
  const page = {
    '@type': seo.type,
    '@id': `${seo.url}#webpage`,
    url: seo.url,
    name: seo.title,
    description: seo.description,
    inLanguage: 'en',
    dateModified: new Date().toISOString().slice(0, 10),
    isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
    about: { '@id': `${SITE_ORIGIN}/#organization` },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: `${SITE_ORIGIN}/assets/${seo.image}`,
      width: 1200,
      height: 630
    }
  };
  if (fileName === 'index.html') {
    const principles = [
      'Self-Determination', 'Banking Neutrality', 'Immunity from Partiality',
      'Freedom from Assault', 'Freedom from Political Discrimination',
      'Judicial Reporting Embargo', 'Statute of Limitations',
      'Freedom from Secret Exclusion', 'Transparency of Judgment',
      'Freedom of Consciousness', 'Freedom to Enjoy Culture',
      'Equality of Public Access', 'Freedom of Association',
      'No Monopolies on Truth'
    ];
    page.mainEntity = {
      '@type': 'ItemList',
      name: '14 Principles for Cultural Peace',
      numberOfItems: principles.length,
      itemListElement: principles.map((name, index) => ({
        '@type': 'ListItem', position: index + 1, name
      }))
    };
    page.subjectOf = {
      '@type': 'DigitalDocument',
      name: 'Cultural Peace: 14 Principles Infographic',
      encodingFormat: 'application/pdf',
      contentUrl: `${SITE_ORIGIN}/Cultural-Peace-14-Principles-Infographic.pdf`
    };
  }
  const graph = [organization, website, page];
  if (seo.breadcrumb) {
    const breadcrumbId = `${seo.url}#breadcrumb`;
    page.breadcrumb = { '@id': breadcrumbId };
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': breadcrumbId,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: seo.breadcrumb, item: seo.url }
      ]
    });
  }

  const imageUrl = `${SITE_ORIGIN}/assets/${seo.image}`;
  const structuredData = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
  $('head').prepend(`
    <title>${seo.title}</title>
    <meta name="description" content="${seo.description}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <link rel="canonical" href="${seo.url}">
    <link rel="alternate" hreflang="en" href="${seo.url}">
    <link rel="alternate" hreflang="x-default" href="${seo.url}">
    <meta property="og:site_name" content="Cultural Peace">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${seo.title}">
    <meta property="og:description" content="${seo.description}">
    <meta property="og:url" content="${seo.url}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:secure_url" content="${imageUrl}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${seo.imageAlt}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${seo.title}">
    <meta name="twitter:description" content="${seo.description}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:image:alt" content="${seo.imageAlt}">
    <script type="application/ld+json">${structuredData}</script>
  `);
}

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

  addSeoMetadata($, filePath);
  
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

async function processCanonicalPage(sourcePath, destPath) {
  const html = await fs.readFile(sourcePath, 'utf-8');
  const $ = cheerio.load(html, { decodeEntities: false });
  addSeoMetadata($, sourcePath);
  const minified = await minify($.html(), {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
    removeEmptyAttributes: true,
    removeRedundantAttributes: true
  });
  await fs.writeFile(destPath, minified);
}

async function generateSitemap(outputDir) {
  const pages = Object.values(PAGE_SEO);
  const lastModified = new Date().toISOString().split('T')[0];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${lastModified}</lastmod>
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
  <meta name="robots" content="noindex, follow">
  <title>404 - Page Not Found | Cultural Peace</title>
  <link rel="icon" type="image/x-icon" href="assets/favicon.ico">
  <link rel="stylesheet" href="https://use.typekit.net/ycr5rin.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: adobe-garamond-pro, Georgia, serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
      color: #fff;
      background: linear-gradient(160deg, #101d1b 0%, #162724 55%, #1d3934 100%);
    }
    img { height: 72px; width: auto; margin-bottom: 40px; opacity: 0.95; }
    .code {
      font-family: adobe-garamond-pro, Georgia, serif;
      font-size: clamp(90px, 18vw, 150px);
      line-height: 1;
      color: #f4e3c6;
      letter-spacing: 0.02em;
    }
    h1 {
      font-weight: 400;
      font-size: clamp(22px, 4vw, 30px);
      margin: 18px 0 10px;
    }
    p { font-size: 19px; color: rgba(255,255,255,0.7); max-width: 44ch; }
    a.btn {
      display: inline-block;
      margin-top: 34px;
      padding: 16px 34px;
      background: #fff;
      color: #174e49;
      text-decoration: none;
      border-radius: 100px;
      font-family: proxima-nova, sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    a.btn:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(0,0,0,0.3); }
  </style>
</head>
<body>
  <img src="assets/logo-white.webp" alt="Cultural Peace">
  <div class="code">404</div>
  <h1>This page has wandered off.</h1>
  <p>The page you're looking for doesn't exist — but the 14 Principles are right where you left them.</p>
  <a class="btn" href="index.html">Return Home</a>
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
      const outputName = PAGE_SEO[entry.name]?.output || entry.name;
      const destPath = path.join(dest, outputName);
    
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
  
  // Publish only the three canonical pages. The scrape also contains obsolete
  // Squarespace routes and test pages that must not become indexable again.
  for (const [sourceName, seo] of Object.entries(PAGE_SEO)) {
    console.log(`Processing: ${sourceName}`);
    await processCanonicalPage(
      path.join(SOURCE_DIR, sourceName),
      path.join(OUTPUT_DIR, seo.output)
    );
  }

  // Restore stable first-party assets that are not part of the Squarespace scrape.
  await fs.copy(STATIC_DIR, OUTPUT_DIR, { overwrite: true });
  
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
