# AI Tactical Simulator

## Project Overview
A static web application — an AI Tactical Simulator / Prompt Warfare System. Built with plain HTML, CSS, and JavaScript (no build system or framework).

## Architecture
- `index.html` — Main HTML entry point
- `style.css` — All styles
- `script.js` — Application logic
- `data.js` — Game/simulation data (PUZZLE_DATA, STAGE2_DATA, STAGE3_DATA, STAGES array)
- `server.js` — Simple Node.js HTTP static file server
- `privacy.html` — Privacy policy page (Amazon Associates disclosure)
- `og-image.png` — OGP card image for social sharing

## Running the App
- Served via a Node.js HTTP server on port 5000
- Start command: `node server.js`

## Tech Stack
- Pure HTML/CSS/JS (no framework)
- Node.js 20 (for serving static files)
- Japanese language UI

## Key Features
- Stage-based puzzle system (3 stages)
- Stage 3 unlock via Amazon link click (localStorage `jojo_unlocked`)
- Dramatic ジョジョ-style unlock animation
- X (Twitter) share with rank-based titles and star ratings
- OGP meta tags with absolute Vercel URL
- Amazon Associates integration (link in stage select screen)
- Privacy policy page with Amazon Associates disclosure

## Deployment
- GitHub repo: `takuyarisa-collab/super-duper-happiness`
- Auto-deploys to Vercel at `https://super-duper-happiness-navy.vercel.app`
- Push via: `git push origin main` using `GITHUB_PERSONAL_ACCESS_TOKEN` secret
- Known harmless lock error on push (refs/remotes/origin/main.lock)

## Storage
- `storage` wrapper in script.js provides localStorage with in-memory fallback
- `jojo_unlocked` key controls Stage 3 access
