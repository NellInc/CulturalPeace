# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static site clone of CulturalPeace.org, originally hosted on Squarespace. The project scrapes the original site using Puppeteer, processes the HTML to remove Squarespace-specific elements, and outputs a clean static site for GitHub Pages hosting.

## Commands

```bash
# Full clone pipeline (parse XML export, scrape site, verify, clean for GitHub)
npm run full-clone

# Individual steps
npm run parse-xml        # Parse Squarespace XML export to xml_data/
npm run scrape           # Crawl site with Puppeteer to culturalpeace_clone/
npm run verify           # Run visual verification tests
npm run precision-verify # Run precision verification server
npm run clean            # Process and output to docs/ for GitHub Pages

# Local development
cd docs && python -m http.server 8000
# or
npx serve docs
```

## Architecture

### Directory Structure

- `docs/` - GitHub Pages deployment directory (served at culturalpeace.org)
- `culturalpeace_clone/` - Raw scraped site output (gitignored)
- `xml_data/` - Parsed Squarespace export data (gitignored)
- `Backport/` - Separate email collection service with its own package.json

### Core Pipeline Scripts

1. **parse-xml.mjs** - Parses Squarespace WordPress-format XML exports
2. **scrape.mjs** - Puppeteer-based crawler that:
   - Scrapes pages with full JavaScript rendering
   - Downloads and localizes assets (images, CSS)
   - Removes Squarespace tracking/analytics scripts
   - Outputs to `culturalpeace_clone/`
3. **clean-for-github.mjs** - Post-processes scraped content:
   - Removes Squarespace-specific classes/attributes
   - Fixes relative paths for GitHub Pages
   - Minifies HTML
   - Generates sitemap.xml, robots.txt, 404.html
   - Outputs to `docs/`
4. **verify.mjs** - Visual regression testing using pixelmatch/resemblejs

### Key Dependencies

- **puppeteer** - Headless browser for site scraping
- **cheerio** - HTML parsing and manipulation
- **html-minifier-terser** - HTML minification
- **pixelmatch/resemblejs** - Visual comparison for verification

## GitHub Pages Deployment

The site is deployed from the `docs/` folder on the main branch. The CNAME file in `docs/` configures the custom domain (culturalpeace.org).
