# Setup Guide

Full step-by-step instructions to get RPC Bridge running.

---

## Prerequisites

- A server or VPS to host the API (any Linux box, even a free-tier Oracle Cloud instance)
- [Docker](https://docs.docker.com/get-docker/) installed on that server
- A free [Supabase](https://supabase.com) account
- A [Discord Developer](https://discord.com/developers/applications) application
- Windows PC with Discord installed (for the agent)
- Android phone with [MacroDroid](https://www.macrodroid.com/) (for Android music)

---

## Step 1 — Create a Discord Application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → give it a name (e.g. "Music Presence")
3. Copy the **Application ID** — you'll need this later
4. Go to **Rich Presence → Art Assets** and upload:
   - A `music_note` asset (fallback icon, any simple image)
   - Optionally `applemusic`, `spotify`, `youtubemusic` icons

> The app name appears as "Playing **Music Presence**" on your profile.
> Album art uses external URLs automatically — no upload needed.

---

## Step 2 — Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste the contents of `supabase-schema.sql`, then run it
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY` (for the agent)
   - **service_role secret key** → `SUPABASE_SERVICE_ROLE_KEY` (for the server — keep this private)
4. Go to **Database → Replication** and confirm `now_playing` and `settings` tables are enabled for realtime

---

## Step 3 — Deploy the server

### Using Docker (recommended)

```bash
git clone https://github.com/your-username/rpc-bridge
cd rpc-bridge/server

# Build the TypeScript first
npm install
npm run build

# Create your .env
cp .env.example .env
nano .env   # fill in all values

# Start
docker-compose up -d
```

Your server is now running on port `3000`. Point your domain/reverse proxy at it.

### Environment variables

```env
PORT=3000
API_KEY=a-long-random-secret-string
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PUBLIC_URL=https://your-domain.com
```

### Verify it's running

```bash
curl https://your-domain.com/api/healthz
# {"ok":true,"ts":...}
```

---

## Step 4 — Install the Windows agent

Open PowerShell and run:

```powershell
irm https://your-domain.com/api/setup/install.ps1 | iex
```

The installer will:
1. Ask for your server URL, API key, Supabase credentials, and Discord Application ID
2. Download the agent `.exe` to `%LOCALAPPDATA%\rpc-bridge\`
3. Save a `.env` config file
4. Optionally add it to Windows startup
5. Optionally launch it immediately

> Make sure Discord is open before starting the agent.

---

## Step 5 — Android setup (MacroDroid)

1. Install [MacroDroid](https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid) on your Android phone
2. Grant it **Notification Access** (Settings → Notifications → Notification access)
3. Create a new macro:

**Trigger:** Notification Received
- App: Apple Music (or whichever app)
- Match type: Any notification

**Action:** HTTP Request
- URL: `https://your-domain.com/api/now-playing`
- Method: POST
- Headers: `x-api-key: your-api-key`, `Content-Type: application/json`
- Body:
  ```json
  {
    "playing": true,
    "song": "[magic_text_notification_title]",
    "artist": "[magic_text_notification_message]",
    "source": "android"
  }
  ```

4. Add a second macro for when music stops:

**Trigger:** Notification Dismissed (same app)

**Action:** HTTP Request (same URL, method POST)
- Body: `{"playing": false}`

> MacroDroid magic text variables like `[magic_text_notification_title]` auto-fill with the notification content at runtime.

---

## Step 6 — Test it

1. Play a song on your phone
2. Check your Discord profile — you should see the Rich Presence appear within a few seconds
3. Check the server logs: `docker-compose logs -f`

---

## Mac setup (optional)

Install [nowplaying-cli](https://github.com/kirtan-shah/nowplaying-cli):

```bash
brew install nowplaying-cli
```

Then run this loop script (add to your shell startup):

```bash
#!/bin/bash
LAST=""
while true; do
  SONG=$(nowplaying-cli get title 2>/dev/null)
  ARTIST=$(nowplaying-cli get artist 2>/dev/null)
  PLAYING=$(nowplaying-cli get playbackRate 2>/dev/null)
  STATE="${SONG}|${ARTIST}|${PLAYING}"

  if [ "$STATE" != "$LAST" ]; then
    if [ "$PLAYING" = "1" ] && [ -n "$SONG" ]; then
      curl -s -X POST https://your-domain.com/api/now-playing \
        -H "x-api-key: your-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"playing\":true,\"song\":\"$SONG\",\"artist\":\"$ARTIST\",\"source\":\"mac\"}"
    else
      curl -s -X POST https://your-domain.com/api/now-playing \
        -H "x-api-key: your-api-key" \
        -H "Content-Type: application/json" \
        -d '{"playing":false}'
    fi
    LAST="$STATE"
  fi
  sleep 3
done
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Discord presence not showing | Make sure Discord is open and the agent is running. Check agent console for errors. |
| Agent says "RPC login failed" | Discord may not be fully loaded yet. Wait 10s and it will auto-reconnect. |
| No album art | The track may not be in the iTunes catalog. Presence still works without art. |
| MacroDroid not firing | Check that Notification Access is granted. Test with a manual HTTP request first. |
| Timer drifts after pause | Send a new `now-playing` POST when you resume to reset `song_started_at`. |
