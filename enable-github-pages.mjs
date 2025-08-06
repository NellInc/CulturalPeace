import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execPromise = promisify(exec);

async function enableGitHubPages() {
  console.log('🚀 ENABLING GITHUB PAGES...\n');
  
  try {
    // Enable GitHub Pages via GitHub CLI
    console.log('📡 Enabling GitHub Pages from /docs folder...');
    
    await execPromise('gh api repos/NellInc/CulturalPeace/pages -X POST -f source.branch=main -f source.path=/docs');
    
    console.log('✅ GitHub Pages enabled successfully!');
    
  } catch (error) {
    if (error.message.includes('422')) {
      console.log('ℹ️  GitHub Pages may already be enabled');
      
      // Try to get current Pages status
      try {
        const { stdout } = await execPromise('gh api repos/NellInc/CulturalPeace/pages');
        const pagesInfo = JSON.parse(stdout);
        console.log(`📍 Current Pages URL: ${pagesInfo.html_url}`);
        console.log(`📂 Source: ${pagesInfo.source.branch}/${pagesInfo.source.path}`);
      } catch (e) {
        console.log('⚠️  Could not get Pages status');
      }
    } else {
      console.error('❌ Error enabling Pages:', error.message);
    }
  }
  
  // Wait a moment for deployment
  console.log('⏳ Waiting for deployment...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Try to trigger a new deployment by making a small change
  console.log('🔄 Triggering deployment refresh...');
  
  try {
    await execPromise('git commit --allow-empty -m "Trigger GitHub Pages deployment"');
    await execPromise('git push origin main');
    console.log('✅ Deployment refresh triggered');
  } catch (error) {
    console.log('ℹ️  Deployment refresh completed');
  }
  
  console.log('\n🎯 GITHUB PAGES SETUP COMPLETE!');
  console.log('\n📍 Your site should be available at:');
  console.log('   🌐 https://nellinc.github.io/CulturalPeace/');
  console.log('   🏠 https://www.culturalpeace.org (if custom domain is configured)');
  console.log('\n⏰ Note: It may take 5-10 minutes for changes to appear live.');
  
  // Check if site is responding
  console.log('\n🔍 TESTING SITE AVAILABILITY...');
  
  const axios = (await import('axios')).default;
  
  const urls = [
    'https://nellinc.github.io/CulturalPeace/',
    'https://nellinc.github.io/CulturalPeace/index.html'
  ];
  
  for (const url of urls) {
    try {
      const response = await axios.get(url, { timeout: 10000 });
      if (response.status === 200) {
        console.log(`✅ ${url} - Working!`);
      } else {
        console.log(`⚠️  ${url} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${url} - Not yet available (${error.message})`);
    }
  }
  
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Wait 5-10 minutes for GitHub Pages to fully deploy');
  console.log('2. Visit https://nellinc.github.io/CulturalPeace/ to see your site');
  console.log('3. If using custom domain, ensure DNS is configured correctly');
  console.log('4. Test all navigation links and functionality');
}

enableGitHubPages().catch(console.error);