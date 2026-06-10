const SUPABASE_URL = process.env["SUPABASE_URL"];
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

export interface NowPlayingRow {
  id: string;
  playing: boolean;
  song: string | null;
  artist: string | null;
  album: string | null;
  album_art_url: string | null;
  song_duration_ms: number | null;
  song_started_at: number | null;
  source: string | null;
  updated_at: number;
}

export async function upsertNowPlaying(data: Omit<NowPlayingRow, "id">): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/now_playing?id=eq.singleton`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed ${res.status}: ${text}`);
  }
}

export async function getNowPlaying(): Promise<NowPlayingRow | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/now_playing?id=eq.singleton`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;
  const rows = await res.json() as NowPlayingRow[];
  return rows[0] ?? null;
}
