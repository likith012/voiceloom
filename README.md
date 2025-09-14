# VoiceLoom

**VoiceLoom** is a multi-speaker text-to-speech (TTS) pipeline that weaves together scripts, voices, and expressive narration into synchronized audio.  
It combines **Gemini TTS**, **fast-whisper alignment**, and a structured **job orchestration system** to deliver high-quality audio with word-level timings.


## ✨ Features

- 🎙️ **Multi-speaker support**  
  Map roles in your script (e.g., `[narrator]`, `[protagonist_m]`) to different voices via a `voices.yml` registry.

- 📝 **Standardized script format**  
  Input scripts with style descriptions, action cues, and inline expressions for precise control.

- ⚡ **Single-pass synthesis**  
  Uses Google Gemini TTS to generate audio in one request with consistent voice switching.

- ⏱️ **Word-level alignment**  
  Aligns final audio with text using **fast-whisper**, producing accurate per-word timings.

- 🗂️ **Caching system**  
  Avoids duplicate API calls by hashing scripts + voice configs and reusing artifacts.

- 🔌 **REST API** (FastAPI)  
  Endpoints for job creation, status tracking, audio retrieval, and alignment timings.

- 📦 **Filesystem-backed job management**  
  Every job has its own directory with request metadata, audio, timings, and manifest.


## 🚀 Quick Start

### 1. Set up environment
```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 2. Configure environment variables
Create .env in project root:
```bash
GOOGLE_API_KEY=your_api_key_here
TTS_MODEL=gemini-2.5-flash-preview-tts
WHISPER_MODEL=tiny.en
WHISPER_DEVICE=cpu
```

### 3. Run the server
```bash
uvicorn app.main:app --reload --port 8000
```

## 📱 Install as a PWA (Mobile & Desktop)

The UI is now a Progressive Web App. After you build the UI, FastAPI serves the static assets, including the service worker and manifest.

### Build the UI
```bash
npm --prefix ui install --legacy-peer-deps
npm --prefix ui run build
```
This generates `ui/dist`, including `sw.js` and `manifest.webmanifest`.

Note: This repository intentionally keeps all Node dependencies scoped to the `ui/` folder. Avoid running `npm install` at the repository root so you don’t create a root-level `package-lock.json`. Use `--prefix ui` or run commands inside the `ui/` directory.

### Serve via FastAPI
`app/main.py` auto-mounts `ui/dist` at `/` when it exists. Run the server and open:
- http://localhost:8000

### Install prompts
- Desktop (Chrome/Edge): You’ll see an Install icon in the address bar. Click to install.
- Android (Chrome): Menu → Add to Home screen.
- iOS (Safari): Share → Add to Home Screen.

### HTTPS note
Service workers require HTTPS in production. For local development, http://localhost is allowed. When deploying, serve over HTTPS (reverse proxy / CDN) to enable offline support and install prompts.

### Update behavior
The service worker is set to auto-update. When a new build is available, the app refreshes to the latest version. You can customize this in `ui/src/main.tsx` by replacing the auto-refresh with a toast/confirm flow.

### Icons
Place branded icons in `ui/public/`:
- `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`, `apple-touch-icon.png`

Replace the placeholders with your graphics to improve the install experience on mobile and desktop.

