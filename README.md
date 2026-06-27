# Culturepedia

A simple, ownership-first cultural hints web app for travelers and business professionals. Pure static files — no frameworks, no backend, no vendor lock-in.

## Features

- Filter hints by **country** and **category**
- Full-text **search**
- **Upvote** hints (saved in `localStorage`)
- **Submit** new hints (persisted locally)
- **Copy** hint text to clipboard
- **PWA** — installable on mobile and works offline

## Project structure

```
culturepedia/
├── index.html      # Main page (Tailwind via CDN)
├── app.js          # All application logic
├── data.json       # Seed data — 25 cultural hints
├── manifest.json   # PWA manifest
├── sw.js           # Service worker for offline caching
├── icon.svg        # App icon
└── README.md
```

## How it works

1. `data.json` holds the seed hints. Each hint has: `id`, `country`, `category`, `text`, `votes`, `created`, and optional `expertNote`.
2. `app.js` fetches `data.json` on load, merges it with user-submitted hints and vote counts from `localStorage`.
3. The service worker (`sw.js`) caches all static assets so the app works offline after the first visit.

## Run locally

Static files need a local server (browsers block `fetch` on `file://` URLs):

```bash
# Python
python -m http.server 8080

# Node.js (npx)
npx serve .
```

Then open `http://localhost:8080`.

## Deploy

Upload all files to any static host — GitHub Pages, Netlify, Cloudflare Pages, or your own server. No build step required.

## License

Your project — use and modify freely.