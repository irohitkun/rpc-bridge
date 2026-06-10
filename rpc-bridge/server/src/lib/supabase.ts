import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(url, key);

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

export async function upsertNowPlaying(data: Omit<NowPlayingRow, 'id'>): Promise<void> {
  const { error } = await supabase
    .from('now_playing')
    .upsert({ id: 'singleton', ...data });

  if (error) throw error;
}

export async function getNowPlaying(): Promise<NowPlayingRow | null> {
  const { data, error } = await supabase
    .from('now_playing')
    .select('*')
    .eq('id', 'singleton')
    .single();

  if (error) return null;
  return data as NowPlayingRow;
}
