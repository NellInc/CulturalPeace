import fs from 'fs-extra';
import path from 'node:path';
import xml2js from 'xml2js';
import * as cheerio from 'cheerio';

const XML_FILES = [
  './Squarespace-Wordpress-Export-07-26-2025a.xml',
  './Squarespace-Wordpress-Export-07-26-2025b.xml'
];
const OUTPUT_DIR = './culturalpeace_clone';
const DATA_DIR = './xml_data';

async function parseXMLFile(filePath) {
  const xmlContent = await fs.readFile(filePath, 'utf-8');
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlContent);
  return result;
}

async function extractPages(xmlData) {
  const pages = [];
  
  if (xmlData.rss && xmlData.rss.channel && xmlData.rss.channel[0]) {
    const channel = xmlData.rss.channel[0];
    
    if (channel.item) {
      for (const item of channel.item) {
        const page = {
          title: item.title ? item.title[0] : '',
          link: item.link ? item.link[0] : '',
          pubDate: item['pubDate'] ? item['pubDate'][0] : '',
          content: item['content:encoded'] ? item['content:encoded'][0] : '',
          excerpt: item['excerpt:encoded'] ? item['excerpt:encoded'][0] : '',
          postId: item['wp:post_id'] ? item['wp:post_id'][0] : '',
          postName: item['wp:post_name'] ? item['wp:post_name'][0] : '',
          status: item['wp:status'] ? item['wp:status'][0] : '',
          postType: item['wp:post_type'] ? item['wp:post_type'][0] : '',
          postMeta: []
        };
        
        if (item['wp:postmeta']) {
          for (const meta of item['wp:postmeta']) {
            page.postMeta.push({
              key: meta['wp:meta_key'] ? meta['wp:meta_key'][0] : '',
              value: meta['wp:meta_value'] ? meta['wp:meta_value'][0] : ''
            });
          }
        }
        
        pages.push(page);
      }
    }
  }
  
  return pages;
}

async function processPages(pages) {
  const processedPages = [];
  const seenLinks = new Set();
  
  for (const page of pages) {
    if (page.link && !seenLinks.has(page.link)) {
      seenLinks.add(page.link);
      
      // Clean up the link for file naming
      let fileName = page.link.replace(/^\//, '').replace(/\/$/, '');
      if (!fileName) fileName = 'index';
      if (!fileName.endsWith('.html')) {
        fileName = fileName + (fileName === 'index' ? '' : '/index') + '.html';
      }
      
      // Extract and process content
      const $ = cheerio.load(page.content || '');
      
      // Find all internal links and assets
      const internalLinks = [];
      const assets = [];
      
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          internalLinks.push(href);
        }
      });
      
      $('img[src], link[href], script[src]').each((_, el) => {
        const attr = el.tagName === 'link' ? 'href' : 'src';
        const url = $(el).attr(attr);
        if (url) {
          assets.push({ type: el.tagName, url });
        }
      });
      
      processedPages.push({
        ...page,
        fileName,
        internalLinks,
        assets,
        processedContent: $.html()
      });
    }
  }
  
  return processedPages;
}

async function savePageData(pages) {
  await fs.ensureDir(DATA_DIR);
  
  // Save individual page data
  for (const page of pages) {
    const pagePath = path.join(DATA_DIR, page.fileName.replace('.html', '.json'));
    await fs.ensureDir(path.dirname(pagePath));
    await fs.writeJson(pagePath, page, { spaces: 2 });
  }
  
  // Save manifest
  const manifest = pages.map(p => ({
    title: p.title,
    link: p.link,
    fileName: p.fileName,
    hasContent: !!p.content,
    assetsCount: p.assets.length
  }));
  
  await fs.writeJson(path.join(DATA_DIR, 'manifest.json'), manifest, { spaces: 2 });
  
  console.log(`Saved ${pages.length} pages to ${DATA_DIR}`);
}

async function createBasicHTML(pages) {
  await fs.ensureDir(OUTPUT_DIR);
  
  // Create a basic template
  const template = (title, content, cssPath = '/assets/main.css') => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Cultural Peace</title>
    <link rel="stylesheet" href="${cssPath}">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .sqs-html-content {
            margin: 2em 0;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 10px;
        }
        blockquote {
            border-left: 4px solid #3498db;
            margin: 1.5em 0;
            padding-left: 1em;
            font-style: italic;
        }
        .intrinsic {
            margin: 2em 0;
        }
        a {
            color: #3498db;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <nav>
        <a href="/">Home</a> | 
        <a href="/about">About</a> | 
        <a href="/contact">Contact</a>
    </nav>
    <main>
        ${content}
    </main>
    <footer>
        <p>&copy; Cultural Peace - Cloned from Squarespace</p>
    </footer>
</body>
</html>`;
  
  // Create HTML files from pages
  for (const page of pages) {
    const htmlPath = path.join(OUTPUT_DIR, page.fileName);
    await fs.ensureDir(path.dirname(htmlPath));
    
    const html = template(page.title, page.processedContent || page.content);
    await fs.writeFile(htmlPath, html);
  }
  
  console.log(`Created ${pages.length} HTML files in ${OUTPUT_DIR}`);
}

async function main() {
  console.log('Starting XML parsing...');
  
  const allPages = [];
  
  for (const xmlFile of XML_FILES) {
    if (await fs.pathExists(xmlFile)) {
      console.log(`Processing ${xmlFile}...`);
      const xmlData = await parseXMLFile(xmlFile);
      const pages = await extractPages(xmlData);
      allPages.push(...pages);
    } else {
      console.log(`Warning: ${xmlFile} not found`);
    }
  }
  
  console.log(`Found ${allPages.length} total pages`);
  
  const processedPages = await processPages(allPages);
  console.log(`Processed ${processedPages.length} unique pages`);
  
  await savePageData(processedPages);
  await createBasicHTML(processedPages);
  
  console.log('XML parsing complete!');
  console.log(`\nNext steps:`);
  console.log(`1. Run 'npm run scrape' to fetch live site and assets`);
  console.log(`2. Run 'npm run verify' to compare with live site`);
  console.log(`3. Run 'npm run clean' to optimize for GitHub Pages`);
}

main().catch(console.error);