import 'dotenv/config';
import { initDiscord, setActivity, clearActivity } from './lib/discord.js';
import { subscribeToNowPlaying, getSettings, NowPlayingRow } from './lib/supabase.js';
import { startWindowsMediaWatcher, MediaState } from './lib/windows-media.js';

let localMediaActive = false;
let enabled = true;

async function refreshSettings(): Promise<void> {
  const settings = await getSettings();
  if (settings) enabled = settings.enabled;
}

async function applyNowPlaying(
  playing: boolean,
  song: string | null,
  artist: string | null,
  album: string | null,
  albumArtUrl: string | null,
  durationMs: number | null,
  startedAt: number | null,
  source: string | null
): Promise<void> {
  if (!enabled || !playing || !song || !artist) {
    await clearActivity();
    return;
  }

  await setActivity({
    song,
    artist,
    album,
    albumArtUrl,
    durationMs,
    startedAt,
    source,
  });
}

async function handleWindowsMedia(state: MediaState): Promise<void> {
  localMediaActive = state.playing;

  if (!state.playing) {
    await clearActivity();
    return;
  }

  if (!state.song || !state.artist) {
    await clearActivity();
    return;
  }

  const apiUrl = process.env.API_URL;
  const apiKey = process.env.API_KEY;

  if (apiUrl && apiKey) {
    try {
      const res = await fetch(`${apiUrl}/api/now-playing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          playing: true,
          song: state.song,
          artist: state.artist,
          source: state.source,
        }),
      });

      if (res.ok) {
        const data = await res.json() as { albumArtUrl?: string };
        await applyNowPlaying(
          true,
          state.song,
          state.artist,
          state.album,
          data.albumArtUrl ?? null,
          null,
          Date.now(),
          state.source
        );
        return;
      }
    } catch {
      // fall through to direct activity
    }
  }

  await applyNowPlaying(
    true,
    state.song,
    state.artist,
    state.album,
    null,
    null,
    Date.now(),
    state.source
  );
}

async function handleSupabaseUpdate(row: NowPlayingRow): Promise<void> {
  if (localMediaActive) return;

  await applyNowPlaying(
    row.playing,
    row.song,
    row.artist,
    row.album,
    row.album_art_url,
    row.song_duration_ms,
    row.song_started_at,
    row.source
  );
}

async function main(): Promise<void> {
  console.log('RPC Bridge agent starting...');

  await refreshSettings();
  setInterval(refreshSettings, 60_000);

  await initDiscord();

  subscribeToNowPlaying(handleSupabaseUpdate);

  if (process.platform === 'win32') {
    startWindowsMediaWatcher(handleWindowsMedia);
  } else {
    console.log('[media] non-Windows platform — local media watcher skipped (using Supabase only)');
  }

  console.log('RPC Bridge agent running. Press Ctrl+C to stop.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
