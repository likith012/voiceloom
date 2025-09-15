# VoiceLoom

VoiceLoom is a multi‑speaker text‑to‑speech (TTS) pipeline that weaves together stories, voices, and expressive delivery into synchronized audio with word‑level timings.

It combines:
- Google Gemini TTS (multi‑speaker synthesis)
- Faster‑Whisper alignment (word timings)
- FastAPI + filesystem job orchestration


## ✨ Features

- Multi‑speaker stories mapped via `config/voices.yml`
- Single‑pass synthesis with consistent voice switching
- Word‑level alignment of final audio
- Filesystem jobs + cache for dedupe
- REST API and a React/Vite PWA UI served by FastAPI


## 📦 Requirements

- Python 3.10+ 
- Node.js 18+ 
- A valid Google API key for Gemini TTS


## � Setup & Run

### 1) Python environment

PowerShell (Windows):
```pwsh
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

### 2) Build the UI

From repo root:
```pwsh
npm --prefix ui install --legacy-peer-deps
npm --prefix ui run build
```

### 3) Configure environment

Create a `.env` file in the project root (values shown are examples):
```dotenv
GOOGLE_API_KEY=your_api_key_here
TTS_MODEL=gemini-2.5-flash-preview-tts
WHISPER_MODEL=tiny.en
WHISPER_DEVICE=auto
WHISPER_COMPUTE_TYPE=int8
HOST=0.0.0.0
PORT=8000
DEBUG=false
DE_DIALECT=false
SSL_CERTFILE=C:\path\to\cert.pem
SSL_KEYFILE=C:\path\to\key.pem
```

### 4) Start the server

Recommended:
```pwsh
python run_server.py
```

## 🧩 Story format (authoring)

```
STYLE DESCRIPTION:
  Freeform prose about tone, pacing, references...

ACTION DICTIONARY:
  cue_name: description

SCRIPT:
  [Role] (<Character>) Utterance with (inline cues)
  [Role] Utterance…
```

- `[Role]` maps to a voice in `config/voices.yml`.
- `<Character>` is displayed in the UI (if present).
- Inline `(…)` cues are shown in the UI; removed when building alignment text.


## 🗂️ Speaker registry

Define voices in `app/config/voices.yml`. Only roles used in the request are required. If a role is missing, the API will return a validation error.


## 🔌 API overview

- `POST /v1/tts/jobs` → create a job
  - Body: `{ script: string, roles: string[] }`
- `GET /v1/tts/jobs/{id}` → job status
- `GET /v1/tts/jobs/{id}/manifest` → `{ audioUrl, timingsUrl, script }`
- `GET /v1/tts/jobs/{id}/audio` → wav/mpeg
- `GET /v1/tts/jobs/{id}/timings` → word timing JSON

Each job is stored under `data/jobs/<jobId>/` with audio, timings, and manifest. 


## 🧭 Data layout

- `data/jobs/<jobId>/` → per‑job artifacts (request.json, status.json, tts_out.wav, timings.json, manifest.json, ui_script.txt, alignment_script.txt)
- `data/cache/` → cache keys mapping to origin job ids for artifact reuse
