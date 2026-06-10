# RPC Bridge

Show what you're listening to on Discord — from **any music app** on Android, Windows, or Mac — as a proper Rich Presence status with album art, timestamps, and track info.

```
Android / Windows PC / Mac
  └─ now playing detected
       └─ POST /api/now-playing  →  Self-hosted API server
                                         └─ album art via iTunes API
                                         └─ upserts to Supabase
                                              └─ realtime push
                                                   └─ Windows agent
                                                        └─ Discord RPC
```

**Works with:** Apple Music, Spotify, YouTube Music, and any other app that shows a notification or media session.

---

## What it looks like on Discord

```
🎵  Listening to Music
┌──────────────────────────────────────────┐
│ [album art]   Song Title                 │
│               Artist Name               │
│               0:42 ──────────── 3:22    │
└──────────────────────────────────────────┘
```

- Large image: album art (fetched from iTunes, no pre-upload needed)
- Small icon: app-specific icon (Apple Music, Spotify, etc.)
- Timer: start → end when duration is known, elapsed only otherwise
- Uses Discord's official RPC — no selfbot, no ToS violation

---

## Quick start

See **[SETUP.md](SETUP.md)** for the full step-by-step guide.

**TL;DR:**
1. Create a Discord application at [discord.com/developers](https://discord.com/developers)
2. Create a Supabase project and run `supabase-schema.sql`
3. Deploy the server (`docker-compose up -d`)
4. On Windows: run the one-line installer
5. On Android: configure MacroDroid webhook

---

## Repository layout

```
rpc-bridge/
├── server/               Express API server (self-hosted, Docker-ready)
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── now-playing.ts    POST /api/now-playing + GET /api/current-song
│   │   │   ├── setup.ts          GET /api/setup/install.ps1
│   │   │   └── health.ts         GET /api/healthz
│   │   └── lib/
│   │       ├── supabase.ts       Supabase client + upsert helpers
│   │       ├── itunes.ts         iTunes Search API (album art + duration)
│   │       └── auth.ts           API key middleware
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── agent/                Windows desktop agent → packaged as .exe
│   └── src/
│       ├── index.ts              Main entry — wires everything together
│       └── lib/
│           ├── discord.ts        Discord RPC connection + setActivity
│           ├── supabase.ts       Supabase realtime subscription
│           └── windows-media.ts  Windows media session via PowerShell
│
├── installer/
│   └── install.ps1       One-paste Windows installer
│
├── supabase-schema.sql   Run once in Supabase SQL editor
└── SETUP.md              Full setup guide
```

---

## API reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/now-playing` | `x-api-key` | Update song state |
| `GET`  | `/api/current-song` | `x-api-key` | Get current state |
| `GET`  | `/api/setup/install.ps1` | none | Download installer |
| `GET`  | `/api/healthz` | none | Health check |

### POST /api/now-playing

```json
{ "song": "Blinding Lights", "artist": "The Weeknd", "playing": true, "source": "android" }
```

Stop playing:
```json
{ "playing": false }
```

---

## Music sources

| Source | How it works |
|--------|-------------|
| **Android (any app)** | MacroDroid notification listener → webhook |
| **Windows PC (any app)** | Agent reads OS media session automatically |
| **Mac** | See SETUP.md for AppleScript / nowplaying-cli approach |

---

## Secrets

| Secret | Where | Purpose |
|--------|-------|---------|
| `API_KEY` | Server `.env` + agent `.env` | Shared secret between all components |
| `SUPABASE_URL` | Server + agent `.env` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server `.env` only | Server-side DB writes |
| `SUPABASE_ANON_KEY` | Agent `.env` only | Client-side realtime subscription |
| `DISCORD_APPLICATION_ID` | Agent `.env` | Your Discord app ID |

> Never commit `.env` files. `DISCORD_APPLICATION_ID` is not a secret (it's public), but keep API keys and Supabase keys out of version control.

---

## Architecture decisions

| Decision | Reason |
|----------|--------|
| Agent runs on Windows (not server) | Discord RPC is a local IPC socket — must run on same machine as Discord |
| Supabase Realtime for sync | Sub-second push latency; free tier is sufficient for personal use |
| iTunes India store (`country=in`) | Better coverage of regional/Bollywood tracks |
| `mp:external/` prefix for images | Lets Discord proxy any URL — no need to pre-upload album art |
| PowerShell for Windows media | No native Node.js bindings needed; works cleanly with `pkg` bundling |

---

## License

MIT

---

## Credits

Built by [Rohit (@irohitkun)](https://github.com/irohitkun).
Inspired by [PreMiD](https://premid.app) and [Music Presence](https://github.com/ungive/discord-music-presence).
