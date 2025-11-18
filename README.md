# Reddit Media Viewer

A lightweight, modern web application for viewing photos, GIFs, and videos from multiple Reddit subreddits in a clean, grid-based interface.

## Features

- **Multi-Subreddit Support**: View content from multiple subreddits simultaneously
- **Media-Focused**: Automatically filters and displays images, GIFs, and videos
- **Clean UI**: Modern, dark-themed interface with smooth animations
- **Lightweight**: Pure vanilla JavaScript, no heavy frameworks
- **Responsive**: Works on desktop, tablet, and mobile devices
- **Lazy Loading**: Images load as you scroll for better performance
- **Load More**: Fetch additional content with a single click

## Usage

1. Open `index.html` in a modern web browser
2. Enter subreddit names (comma-separated) in the input field
   - Example: `pics, aww, gifs, videos`
3. Click "Load Content" to fetch and display media
4. Use the checkboxes to filter between images/GIFs and videos
5. Click on any media card to view the original Reddit post

## Supported Media Types

- **Images**: JPG, PNG, WebP, BMP
- **GIFs**: Animated GIFs, Gfycat, RedGifs
- **Videos**: MP4, WebM, Reddit videos, YouTube links

## Browser Compatibility

Works in all modern browsers that support:
- ES6+ JavaScript
- CSS Grid
- Fetch API

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "New Project"
4. Import your repository
5. Vercel will auto-detect it's a static site and deploy it
6. Your site will be live in seconds!

### Deploy to Netlify

1. Push your code to GitHub
2. Go to [netlify.com](https://netlify.com) and sign in
3. Click "Add new site" → "Import an existing project"
4. Connect to GitHub and select your repository
5. Build settings: Leave defaults (no build command needed)
6. Publish directory: Leave empty (root)
7. Click "Deploy site"

### Deploy to GitHub Pages

1. Push your code to GitHub
2. Go to your repository Settings → Pages
3. Source: Deploy from a branch
4. Branch: `main` / `root`
5. Save - your site will be at `https://YOUR_USERNAME.github.io/reddit-viewer`

## Notes

- Uses Reddit's public JSON API (no authentication required)
- Content is sorted by upvotes (score) across all subreddits
- Some subreddits may have rate limiting or restricted content
- All hosting options above are free for static sites

