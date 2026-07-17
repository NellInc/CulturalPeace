import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Renders infographic.html (repo root) to:
//   - site-static/Cultural-Peace-14-Principles-Infographic.pdf  (deployed by clean-for-github.mjs)
//   - site-static/assets/infographic-preview.png                (thumbnail for the download card)
async function generatePDF() {
    // Bundled Chromium fails to spawn on this machine; use installed Chrome.
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });
    const page = await browser.newPage();

    const htmlPath = path.join(__dirname, 'infographic.html');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

    await page.pdf({
        path: path.join(__dirname, 'site-static', 'Cultural-Peace-14-Principles-Infographic.pdf'),
        format: 'Letter',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    console.log('PDF generated: site-static/Cultural-Peace-14-Principles-Infographic.pdf');

    // Crisp preview of the full sheet for the website download card
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });
    const sheet = await page.$('.infographic');
    await sheet.screenshot({
        path: path.join(__dirname, 'site-static', 'assets', 'infographic-preview.png')
    });
    console.log('Preview generated: site-static/assets/infographic-preview.png');

    await browser.close();
}

generatePDF().catch(console.error);
