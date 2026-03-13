# AI Tactical Simulator

## Project Overview
A static web application — an AI Tactical Simulator / Prompt Warfare System. Built with plain HTML, CSS, and JavaScript (no build system or framework).

## Architecture
- `index.html` — Main HTML entry point
- `style.css` — All styles
- `script.js` — Application logic
- `data.js` — Game/simulation data (PUZZLE_DATA, STAGE2_DATA, STAGE3_DATA, STAGE4_DATA, STAGE5_DATA, EXTRA_DATA, STAGES array)
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
- Stage-based puzzle system (5 regular stages + 1 bonus Extra Stage)
  - Stage 1 (id:1): 納期遅延の報告 — deadline pressure (unlockThreshold:0)
  - Stage 2 (id:2): 理不尽な値引きへの対応 — negotiation warfare (unlockThreshold:1)
  - Stage 3 (id:3): 怒れるクライアントの炎上メール — crisis management (unlockThreshold:2)
  - Stage 4 (id:4): エース社員の退職を引き止めろ — retention warfare (unlockThreshold:3)
  - Stage 5 (id:5): 伸び悩む新人の育成面談 — rookie development (unlockThreshold:4)
  - Extra (id:6): 沈黙の会議室 — JoJo-themed bonus stage (bonus:true, unlockThreshold:5)
- Each stage has 27 patterns (3×3×3 combination system)
- Extra Stage unlock via Amazon link click (localStorage `jojo_unlocked`)
- Dramatic ジョジョ-style unlock animation
- X (Twitter) share with rank-based titles and star ratings
- OGP meta tags with absolute Vercel URL
- Amazon Associates integration (link in stage select screen + ad overlay on S/A rank)
- Privacy policy page with Amazon Associates disclosure

## Stage Data Mapping in script.js
- id:1 → PUZZLE_DATA
- id:2 → STAGE2_DATA
- id:3 → STAGE3_DATA
- id:4 → STAGE4_DATA
- id:5 → STAGE5_DATA
- id:6 → EXTRA_DATA

## Key Logic
- `isJojo` context = `id === 6` (JoJo theme CSS class on body)
- `isJojoUnlocked()` checks localStorage `jojo_unlocked`
- `tryStartJojoStage()` calls `startStage(6)` when unlocked
- `renderStages()` sorts regular stages first, bonus stages last
- Amazon affiliate URL: `https://amzn.to/3PySSgo`

## Deployment
- GitHub repo: `takuyarisa-collab/super-duper-happiness`
- Auto-deploys to Vercel at `https://super-duper-happiness-navy.vercel.app`
- Push via: `git push origin main` using `GITHUB_PERSONAL_ACCESS_TOKEN` secret
- Known harmless lock error on push (refs/remotes/origin/main.lock)

## Storage
- `storage` wrapper in script.js provides localStorage with in-memory fallback
- `jojo_unlocked` key controls Extra Stage access
