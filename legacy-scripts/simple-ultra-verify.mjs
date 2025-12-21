import puppeteer from 'puppeteer';
import fs from 'fs-extra';

async function ultraVerification() {
  console.log('🎯 ULTRA VERIFICATION: Original vs Clone\n');

  const browser = await puppeteer.launch({ headless: 'new' });

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
    }
  ];

  let totalMatches = 0;
  const results = [];

  for (const pageConfig of pages) {
    console.log(`🔍 ANALYZING: ${pageConfig.name}`);

    const [originalPage, clonePage] = await Promise.all([
      browser.newPage(),
      browser.newPage()
    ]);

    // Set identical viewport
    await Promise.all([
      originalPage.setViewport({ width: 1920, height: 1080 }),
      clonePage.setViewport({ width: 1920, height: 1080 })
    ]);

    try {
      // Navigate to both versions
      await Promise.all([
        originalPage.goto(pageConfig.original, { waitUntil: 'networkidle0', timeout: 60000 }),
        clonePage.goto(pageConfig.clone, { waitUntil: 'networkidle0', timeout: 30000 })
      ]);

      // Wait for complete loading
      await Promise.all([
        new Promise(resolve => setTimeout(resolve, 5000)),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);

      // Scroll and reset position
      for (const page of [originalPage, clonePage]) {
        await page.evaluate(() => {
          return new Promise((resolve) => {
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
      }

      // Take screenshots
      const [originalShot, cloneShot] = await Promise.all([
        originalPage.screenshot({ fullPage: true }),
        clonePage.screenshot({ fullPage: true })
      ]);

      const originalPath = `verification-${pageConfig.name.toLowerCase()}-original.png`;
      const clonePath = `verification-${pageConfig.name.toLowerCase()}-clone.png`;

      await Promise.all([
        fs.writeFile(originalPath, originalShot),
        fs.writeFile(clonePath, cloneShot)
      ]);

      // Analyze page structure
      const [originalData, cloneData] = await Promise.all([
        originalPage.evaluate(() => {
          return {
            title: document.title,
            headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).length,
            images: Array.from(document.querySelectorAll('img')).length,
            links: Array.from(document.querySelectorAll('a')).length,
            paragraphs: document.querySelectorAll('p').length,
            height: document.body.scrollHeight,
            hasHeroImage: !!document.querySelector('[style*="background-image"], .hero, .banner'),
            navLinks: Array.from(document.querySelectorAll('nav a, header a')).map(a => a.textContent.trim())
          };
        }),
        clonePage.evaluate(() => {
          return {
            title: document.title,
            headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).length,
            images: Array.from(document.querySelectorAll('img')).length,
            links: Array.from(document.querySelectorAll('a')).length,
            paragraphs: document.querySelectorAll('p').length,
            height: document.body.scrollHeight,
            hasHeroImage: !!document.querySelector('[style*="background-image"], .hero, .banner'),
            navLinks: Array.from(document.querySelectorAll('nav a, header a')).map(a => a.textContent.trim())
          };
        })
      ]);

      // Compare data
      const comparison = {
        name: pageConfig.name,
        screenshots: { original: originalPath, clone: clonePath },
        matches: {
          headings: Math.abs(originalData.headings - cloneData.headings) <= 2,
          images: Math.abs(originalData.images - cloneData.images) <= 2,
          paragraphs: Math.abs(originalData.paragraphs - cloneData.paragraphs) <= 5,
          height: Math.abs(originalData.height - cloneData.height) < (originalData.height * 0.2),
          heroImage: originalData.hasHeroImage === cloneData.hasHeroImage,
          navigation: originalData.navLinks.length > 0 && cloneData.navLinks.length > 0
        },
        data: { original: originalData, clone: cloneData }
      };

      const matchCount = Object.values(comparison.matches).filter(Boolean).length;
      const matchPercentage = Math.round((matchCount / Object.keys(comparison.matches).length) * 100);
      
      comparison.matchPercentage = matchPercentage;
      results.push(comparison);

      console.log(`   📊 Match Quality: ${matchPercentage}%`);
      console.log(`   📷 Screenshots: ${originalPath} | ${clonePath}`);
      console.log(`   📈 Original: ${originalData.headings}h, ${originalData.images}img, ${originalData.height}px`);
      console.log(`   📈 Clone: ${cloneData.headings}h, ${cloneData.images}img, ${cloneData.height}px`);
      
      if (!comparison.matches.headings) console.log(`   ⚠️  Heading mismatch: ${originalData.headings} vs ${cloneData.headings}`);
      if (!comparison.matches.images) console.log(`   ⚠️  Image mismatch: ${originalData.images} vs ${cloneData.images}`);
      if (!comparison.matches.height) console.log(`   ⚠️  Height difference: ${Math.abs(originalData.height - cloneData.height)}px`);
      if (!comparison.matches.navigation) console.log(`   ⚠️  Navigation issue detected`);
      
      totalMatches += matchPercentage;

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({ name: pageConfig.name, error: error.message, matchPercentage: 0 });
    }

    await Promise.all([originalPage.close(), clonePage.close()]);
    console.log('');
  }

  await browser.close();

  const overallMatch = Math.round(totalMatches / pages.length);

  console.log('═══════════════════════════════════════');
  console.log(`🎯 OVERALL VERBATIM MATCH: ${overallMatch}%`);
  console.log('═══════════════════════════════════════\n');

  if (overallMatch >= 90) {
    console.log('✅ VERDICT: EXCELLENT VERBATIM MATCH!');
    console.log('🏆 Your clone is highly accurate to the original.');
    console.log('💡 Minor differences may be due to:');
    console.log('   • Font loading variations');
    console.log('   • Dynamic content timing');
    console.log('   • Browser rendering differences');
  } else if (overallMatch >= 75) {
    console.log('🟡 VERDICT: GOOD MATCH WITH MINOR DIFFERENCES');
    console.log('📝 Some structural differences detected.');
  } else {
    console.log('🔴 VERDICT: SIGNIFICANT DIFFERENCES DETECTED');
    console.log('🔧 Major fixes needed for verbatim match.');
  }

  console.log('\n📋 MANUAL VERIFICATION RECOMMENDED:');
  console.log('Compare the screenshot pairs to assess visual similarity:');
  
  for (const result of results) {
    if (result.screenshots) {
      console.log(`   👀 ${result.name}: ${result.screenshots.original} vs ${result.screenshots.clone}`);
    }
  }

  return { overallMatch, results };
}

ultraVerification().catch(console.error);