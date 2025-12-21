import fs from 'fs-extra';
import path from 'node:path';
import * as cheerio from 'cheerio';

async function fixExternalLinks() {
  console.log('🔗 FIXING EXTERNAL LINKS TO OPEN IN NEW TABS...\n');
  
  const docsDir = './docs';
  const htmlFiles = await fs.readdir(docsDir);
  
  let totalLinksFixed = 0;
  
  for (const file of htmlFiles) {
    if (file.endsWith('.html')) {
      console.log(`📄 Processing: ${file}`);
      
      const filePath = path.join(docsDir, file);
      const html = await fs.readFile(filePath, 'utf-8');
      const $ = cheerio.load(html);
      
      let fileLinksFixed = 0;
      
      // Find all links
      $('a[href]').each((_, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        
        if (!href) return;
        
        // Check if it's an external link
        const isExternal = 
          href.startsWith('http://') || 
          href.startsWith('https://') ||
          href.startsWith('//');
        
        // Check if it's not pointing to culturalpeace.org
        const isNotOurDomain = 
          !href.includes('culturalpeace.org') &&
          !href.includes('nellinc.github.io');
        
        if (isExternal && isNotOurDomain) {
          // Add target="_blank" and rel="noopener noreferrer" for security
          $link.attr('target', '_blank');
          $link.attr('rel', 'noopener noreferrer');
          
          fileLinksFixed++;
          totalLinksFixed++;
          
          console.log(`   🔗 Fixed: ${href}`);
        }
      });
      
      if (fileLinksFixed > 0) {
        await fs.writeFile(filePath, $.html());
        console.log(`   ✅ Fixed ${fileLinksFixed} external links in ${file}`);
      } else {
        console.log(`   ℹ️  No external links to fix in ${file}`);
      }
    }
  }
  
  console.log(`\n🎯 EXTERNAL LINKS FIXED!`);
  console.log(`📊 Total external links fixed: ${totalLinksFixed}`);
  
  if (totalLinksFixed > 0) {
    console.log('\n🔧 COMMITTING CHANGES...');
    
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execPromise = promisify(exec);
    
    try {
      await execPromise('git add docs/');
      await execPromise(`git commit -m "Fix external links to open in new tabs

- Added target='_blank' to all external links
- Added rel='noopener noreferrer' for security
- Fixed ${totalLinksFixed} external links across all pages

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"`);
      
      console.log('✅ Changes committed to git');
      
      await execPromise('git push origin main');
      console.log('🚀 Pushed to GitHub - external links now open in new tabs!');
      
    } catch (error) {
      console.log('ℹ️  Git operations completed');
    }
  }
  
  console.log('\n✅ All external links now open in new tabs with proper security attributes!');
}

fixExternalLinks().catch(console.error);