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

## Notes

- Uses Reddit's public JSON API (no authentication required)
- Content is sorted by upvotes (score) across all subreddits
- Some subreddits may have rate limiting or restricted content

