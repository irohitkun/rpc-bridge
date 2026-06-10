# RPC Bridge — Full Handover Document

> Last updated: 2026-06-10  
> For the next agent or developer to pick up exactly where we left off.

---

## What This Project Is

A **Discord Rich Presence bridge** that shows what music you're listening to on your Discord profile — without using a selfbot. It uses the official Discord RPC protocol.

Supported music sources:
- **Windows** — Apple Music, Spotify, YouTube Music, any app with a Windows media session
- **Android** — via MacroDroid HTTP webhook (sends song info to the API)

---

## How It Works (Full Flow)

```
[Music App (Windows/Android)]
        │
        ▼
[Agent (Windows Node.js process)]
        │  reads Windows media session (PowerShell)
        │  OR receives webhook from MacroDroid (Android)
        │
        ▼
[API Server (Replit / self-hostable Express)]
  POST /api/now-playing  ← agent sends song info
        │
        ├─ looks up album art via iTunes Search API
        ├─ saves to Supabase (now_playing table, single row "singleton")
        └─ returns { albumArtUrl } back to agent
        │
        ▼
[Supabase Realtime]
  broadcasts DB change to all subscribed agents
        │
        ▼
[Agent] sets Discord Rich Presence
  → Discord desktop app shows "Listening to Dagabaaz Re by Rahat Fateh Ali Khan"
```

### Android path (MacroDroid)
MacroDroid webhook → `POST /api/now-playing` with `x-api-key` header → same flow as above

---

## Repository Structure

```
/
├── artifacts/
│   └── api-server/          ← Express API server (runs on Replit)
│       └── src/
│           ├── app.ts           ← Express app setup
│           ├── index.ts         ← entry point, binds to PORT
│           ├── routes/
│           │   ├── now-playing.ts   ← POST /now-playing, GET /current-song
│           │   ├── health.ts        ← GET /healthz
│           │   └── index.ts         ← mounts all routes under /api
│           └── lib/
│               ├── supabase.ts  ← upsertNowPlaying(), getNowPlaying() via REST fetch
│               ├── itunes.ts    ← iTunes Search API for album art + duration
│               ├── state.ts     ← in-memory fallback state
│               └── logger.ts    ← pino logger
│
├── rpc-bridge/
│   ├── agent/               ← Windows Node.js agent (runs on user's PC)
│   │   ├── src/
│   │   │   ├── index.ts         ← main: Discord + Supabase + media watcher
│   │   │   └── lib/
│   │   │       ├── discord.ts       ← @xhayper/discord-rpc wrapper, setActivity()
│   │   │       ├── supabase.ts      ← Supabase JS client, realtime subscription
│   │   │       └── windows-media.ts ← spawns PowerShell, reads Windows media session
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── build.mjs        ← esbuild config (for .exe packaging, not yet done)
│   │
│   ├── installer/
│   │   └── install.ps1      ← PowerShell one-liner installer (not yet wired up)
│   │
│   ├── server/              ← standalone Docker server (alternative to Replit deploy)
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   └── src/             ← mirrors artifacts/api-server
│   │
│   ├── supabase-schema.sql  ← run this once in Supabase SQL editor
│   ├── README.md
│   └── SETUP.md
```

---

## Live Infrastructure

| Thing | Value |
|---|---|
| API Server URL | `https://572ca78f-d438-4945-827f-be426a3d114a-00-3miwymzs2qhxd.sisko.replit.dev` |
| API Key | `d5061ec74436553a9bb85b502cf022c20f7f9a9532661119` |
| Supabase Project | `https://dtgxfdmxmbelnpkcannh.supabase.co` |
| Supabase DB | `now_playing` table, single row `id = 'singleton'` |

Replit environment secrets set:
- `SUPABASE_URL` = `https://dtgxfdmxmbelnpkcannh.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (set in Replit secrets)
- `SESSION_SECRET` = (set)
- `API_KEY` = (set in Replit secrets or hardcoded in env)

---

## Agent `.env` (on user's Windows machine)

File location: `C:\Users\Mohana\Downloads\rpc-bridge-agent\agent\.env`

```env
API_KEY=d5061ec74436553a9bb85b502cf022c20f7f9a9532661119
API_URL=https://572ca78f-d438-4945-827f-be426a3d114a-00-3miwymzs2qhxd.sisko.replit.dev
DISCORD_APPLICATION_ID=1513885694823497788
SUPABASE_URL=https://dtgxfdmxmbelnpkcannh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Critical:** `SUPABASE_URL` must NOT have `/rest/v1/` at the end. The Supabase JS client adds that itself.

---

## Supabase Setup (already done)

Run `rpc-bridge/supabase-schema.sql` once in Supabase SQL editor. This:
- Creates `now_playing` table (single row, `id='singleton'`)
- Creates `settings` table (single row, `id='singleton'`, `enabled=true`)
- Enables realtime on both tables

**RLS is disabled** on both tables (done via Supabase dashboard). This is required for the Supabase JS realtime subscription to work.

The realtime publication was added:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE now_playing;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
```

---

## Current Status (as of 2026-06-10)

### ✅ Working
- API server running on Replit, authenticated with `x-api-key` header
- Supabase upsert via REST PATCH (not JS client) — avoids singleton issues
- Supabase realtime subscription in agent — status: `SUBSCRIBED`
- Discord RPC connects successfully on Windows — status: `[discord] RPC connected`
- Windows media session reader (PowerShell script) correctly detects Apple Music
  - Confirmed: `App: AppleInc.AppleMusicWin_nzyj5cx40ttqa!App` detected
  - Song: "Dagabaaz Re", Artist: "Rahat Fateh Ali Khan & Shreya Ghoshal"

### ❌ Not Yet Confirmed Working
- **Discord Rich Presence actually showing on profile** — this is the immediate next step
- The root cause was found and fixed just before handover:

### 🐛 Bug Fixed (not yet tested by user)
**File:** `rpc-bridge/agent/src/lib/windows-media.ts`

The PowerShell script was building JSON by hand and failing to quote song/artist strings:
```
{"playing":true,"song":Dagabaaz Re,"artist":Rahat Fateh Ali Khan...}  ← INVALID JSON
```

**Fixed** by replacing manual string building with `ConvertTo-Json -Compress`:
```powershell
$obj=@{playing=$playing;song=if($p.Title){$p.Title}else{$null};...}
$j=$obj|ConvertTo-Json -Compress
```

This fix is committed but **the user's local agent zip still has the old bug**. They need to update their local `src\lib\windows-media.ts` or re-download the agent.

---

## Immediate Next Steps (to finish the project)

### 1. Get the user to update their local agent file

The user (`irohitkun`) is on Windows at `C:\Users\Mohana\Downloads\rpc-bridge-agent\agent\`.

Tell them to open `src\lib\windows-media.ts` in Notepad (or download the updated zip), find this line:
```
$j="{""playing"":$(if($playing)...
```
And replace lines 35-37 of the PS1 script with:
```powershell
      $obj=@{playing=$playing;song=if($p.Title){$p.Title}else{$null};artist=if($p.Artist){$p.Artist}else{$null};album=if($p.AlbumTitle){$p.AlbumTitle}else{$null};source=$src}
      $j=$obj|ConvertTo-Json -Compress
```

Then delete the cached PS1 and restart:
```cmd
del %TEMP%\rpc-bridge-media.ps1
npx tsx src\index.ts
```

### 2. Verify Discord Rich Presence shows

With Apple Music playing and the agent running, the user's Discord profile should show the song within 3 seconds. Look for `[media] detected:` and `[discord]` logs.

### 3. Discord Application Rich Presence assets (optional but nice)

Go to discord.com/developers → app `1513885694823497788` → Rich Presence → Art Assets  
Upload icons named: `applemusic`, `spotify`, `youtubemusic`, `music_note`  
Without these, the large/small image in the Discord status will be blank.

### 4. Package agent as .exe (planned, not started)

`rpc-bridge/agent/build.mjs` uses esbuild. Goal: produce a single `.exe` so users don't need Node.js.
- Use `pkg` or `nexe` to bundle tsx + the agent
- Or: compile to JS with esbuild, then wrap with `pkg`

### 5. Android / MacroDroid path (planned, not tested)

The API already accepts POST from MacroDroid. The MacroDroid macro needs to:
- Trigger on "Media play" event
- HTTP POST to `{API_URL}/api/now-playing`
- Headers: `x-api-key: {API_KEY}`, `Content-Type: application/json`
- Body: `{"playing":true,"song":"%media_title%","artist":"%media_artist%","source":"android"}`

On stop: same but `{"playing":false}`.

### 6. PowerShell one-liner installer (planned, not started)

`rpc-bridge/installer/install.ps1` exists but isn't wired up. Goal:
- Download latest agent zip from GitHub releases
- Extract, create `.env`, register as startup task

---

## How to Run Locally (for development)

### API Server (Replit)
Already running as a Replit workflow. To restart:
```
pnpm --filter @workspace/api-server run dev
```

### Agent (Windows)
```cmd
cd C:\Users\Mohana\Downloads\rpc-bridge-agent\agent
npm install --ignore-scripts
npx tsx src\index.ts
```
Requires Discord desktop open, `.env` filled in.

### Test API manually
```cmd
curl -X POST https://572ca78f-d438-4945-827f-be426a3d114a-00-3miwymzs2qhxd.sisko.replit.dev/api/now-playing ^
  -H "x-api-key: d5061ec74436553a9bb85b502cf022c20f7f9a9532661119" ^
  -H "Content-Type: application/json" ^
  -d "{\"playing\":true,\"song\":\"Blinding Lights\",\"artist\":\"The Weeknd\",\"source\":\"windows\"}"
```

---

## Known Issues / Gotchas

1. **Linux Discord RPC socket** is at `/run/user/1000/discord-ipc-0`, not `/tmp/discord-ipc-0`. Symlink fixes it but `@xhayper/discord-rpc` still times out on Linux for unknown reasons. **Use Windows.**

2. **`npm install` on Windows** needs `--ignore-scripts` due to esbuild's postinstall requiring cmd.exe in certain environments.

3. **Supabase SUPABASE_URL** must be `https://project.supabase.co` (no `/rest/v1/` suffix) for the JS client. The REST fetch in the server manually appends `/rest/v1/`.

4. **Discord RPC `type: 2` (LISTENING)** is not supported for third-party apps — removed. Only `type: 0` (PLAYING) works.

5. **PowerShell JSON bug** (fixed): song/artist strings with spaces/special characters were not quoted in the hand-built JSON string. Now uses `ConvertTo-Json -Compress`.

6. **Supabase realtime RLS**: must be disabled on `now_playing` and `settings` tables, otherwise `CHANNEL_ERROR`. Done via Supabase dashboard → Table Editor → RLS toggle off.

7. **PS1 cache**: The PowerShell script is written to `%TEMP%\rpc-bridge-media.ps1` only if it doesn't exist. After any change to the PS1 content in `windows-media.ts`, run `del %TEMP%\rpc-bridge-media.ps1` before restarting the agent.

---

## Key Files Quick Reference

| File | Purpose |
|---|---|
| `artifacts/api-server/src/routes/now-playing.ts` | POST /now-playing handler |
| `artifacts/api-server/src/lib/supabase.ts` | Supabase REST upsert (no JS client) |
| `artifacts/api-server/src/lib/itunes.ts` | iTunes album art lookup |
| `rpc-bridge/agent/src/index.ts` | Agent main loop |
| `rpc-bridge/agent/src/lib/discord.ts` | Discord RPC connect + setActivity |
| `rpc-bridge/agent/src/lib/supabase.ts` | Agent Supabase realtime subscription |
| `rpc-bridge/agent/src/lib/windows-media.ts` | PowerShell media watcher |
| `rpc-bridge/supabase-schema.sql` | DB schema + realtime setup |
