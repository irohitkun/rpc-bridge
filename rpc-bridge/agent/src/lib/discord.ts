import { Client } from '@xhayper/discord-rpc';

let client: Client | null = null;
let connected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const APP_ID = process.env.DISCORD_APPLICATION_ID ?? '';

async function connect(): Promise<void> {
  client = new Client({ clientId: APP_ID });

  client.on('ready', () => {
    connected = true;
    console.log('[discord] RPC connected');
  });

  client.on('disconnected', () => {
    connected = false;
    console.warn('[discord] RPC disconnected, reconnecting in 10s');
    scheduleReconnect();
  });

  try {
    await client.login();
  } catch (err) {
    console.error('[discord] login failed:', err);
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await connect();
  }, 10_000);
}

export async function initDiscord(): Promise<void> {
  await connect();
}

export interface ActivityOptions {
  song: string;
  artist: string;
  album: string | null;
  albumArtUrl: string | null;
  durationMs: number | null;
  startedAt: number | null;
  source: string | null;
}

const SOURCE_ICONS: Record<string, string> = {
  applemusic: 'applemusic',
  spotify: 'spotify',
  youtubemusic: 'youtubemusic',
  android: 'applemusic',
  windows: 'music',
};

export async function setActivity(opts: ActivityOptions): Promise<void> {
  if (!connected || !client) return;

  const largeImage = opts.albumArtUrl
    ? `mp:external/${opts.albumArtUrl}`
    : 'music_note';

  const smallImage = SOURCE_ICONS[opts.source ?? ''] ?? 'music_note';

  const timestamps: { start?: number; end?: number } = {};
  if (opts.startedAt) {
    timestamps.start = Math.floor(opts.startedAt / 1000);
    if (opts.durationMs) {
      timestamps.end = Math.floor((opts.startedAt + opts.durationMs) / 1000);
    }
  }

  try {
    await client.user?.setActivity({
      details: opts.song,
      state: opts.artist,
      largeImageKey: largeImage,
      largeImageText: opts.album ?? opts.song,
      smallImageKey: smallImage,
      smallImageText: opts.source ?? 'music',
      startTimestamp: timestamps.start,
      endTimestamp: timestamps.end,
      instance: false,
    });
  } catch (err) {
    console.error('[discord] setActivity failed:', err);
  }
}

export async function clearActivity(): Promise<void> {
  if (!connected || !client) return;
  try {
    await client.user?.clearActivity();
  } catch {
    // ignore
  }
}
