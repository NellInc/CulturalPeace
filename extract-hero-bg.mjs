import puppeteer from 'puppeteer';
import fs from 'fs-extra';

async function extractHeroBg() {
  console.log('🔍 EXTRACTING EXACT HERO BACKGROUND IMAGE...\n');

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://www.culturalpeace.org', { 
      waitUntil: 'networkidle0',
      timeout: 45000 
    });
    
    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Extract all background images with comprehensive detection
    const bgAnalysis = await page.evaluate(() => {
      const results = [];
      const allElements = document.querySelectorAll('*');
      
      for (const element of allElements) {
        const computedStyle = getComputedStyle(element);
        const bgImage = computedStyle.backgroundImage;
        
        if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {
          const rect = element.getBoundingClientRect();
          
          // Only consider visible elements that might be hero backgrounds
          if (rect.width > 500 && rect.height > 200) {
            results.push({
              element: element.tagName.toLowerCase() + (element.className ? '.' + element.className.split(' ').join('.') : ''),
              backgroundImage: bgImage,
              backgroundSize: computedStyle.backgroundSize,
              backgroundPosition: computedStyle.backgroundPosition,
              position: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
              },
              zIndex: computedStyle.zIndex || 'auto',
              innerHTML: element.innerHTML.substring(0, 200)
            });
          }
        }
      }
      
      return results.sort((a, b) => (b.position.width * b.position.height) - (a.position.width * a.position.height));
    });
    
    console.log(`📊 Found ${bgAnalysis.length} potential background images:`);
    
    if (bgAnalysis.length > 0) {
      bgAnalysis.forEach((bg, index) => {
        console.log(`   ${index + 1}. ${bg.element} - ${Math.round(bg.position.width)}x${Math.round(bg.position.height)}`);
        console.log(`      Background: ${bg.backgroundImage.substring(0, 80)}...`);
        console.log(`      Position: ${bg.backgroundPosition}`);
        console.log(`      Size: ${bg.backgroundSize}`);
        console.log('');
      });
      
      // Save the analysis
      await fs.writeJson('hero-bg-analysis.json', bgAnalysis, { spaces: 2 });
      console.log('✅ Background analysis saved to hero-bg-analysis.json');
      
      // Extract the most likely hero image URL
      const heroImage = bgAnalysis[0];
      if (heroImage) {
        const urlMatch = heroImage.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (urlMatch && urlMatch[1]) {
          const imageUrl = urlMatch[1];
          console.log(`🎯 HERO IMAGE URL FOUND: ${imageUrl}`);
          
          // Save URL for use
          await fs.writeFile('hero-image-url.txt', imageUrl);
          console.log('✅ Hero image URL saved to hero-image-url.txt');
        }
      }
    } else {
      console.log('❌ No background images detected');
      
      // Alternative: Check for img tags that might be heroes
      const imgTags = await page.evaluate(() => {
        const images = [];
        document.querySelectorAll('img').forEach(img => {
          const rect = img.getBoundingClientRect();
          if (rect.width > 500 && rect.height > 200 && rect.top < 500) {
            images.push({
              src: img.src,
              alt: img.alt || '',
              width: rect.width,
              height: rect.height,
              top: rect.top
            });
          }
        });
        return images;
      });
      
      if (imgTags.length > 0) {
        console.log('🖼️ Found potential hero img tags:');
        imgTags.forEach((img, i) => {
          console.log(`   ${i+1}. ${img.src.substring(0, 80)}...`);
          console.log(`      ${Math.round(img.width)}x${Math.round(img.height)} at top: ${Math.round(img.top)}`);
        });
        await fs.writeJson('hero-img-tags.json', imgTags, { spaces: 2 });
      }
    }
    
  } catch (error) {
    console.log('❌ Error accessing original site:', error.message);
  }
  
  await browser.close();
  
  console.log('\n🏆 HERO BACKGROUND EXTRACTION COMPLETE!');
}

extractHeroBg().catch(console.error);