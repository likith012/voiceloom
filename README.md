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
