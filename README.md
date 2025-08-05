# Cultural Peace - Static Site

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
```bash
cd docs
python -m http.server 8000
# or
npx serve docs
```

Then visit http://localhost:8000

## Maintenance

To update content:
1. Run `npm run full-clone` to re-scrape the site
2. Commit and push changes
3. GitHub Pages will automatically update