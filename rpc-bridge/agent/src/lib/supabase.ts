import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

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

type ChangeCallback = (row: NowPlayingRow) => void;

let channel: RealtimeChannel | null = null;

export function subscribeToNowPlaying(onChange: ChangeCallback): void {
  if (!supabase) {
    console.log('[supabase] no credentials — realtime subscription skipped');
    return;
  }
  channel = supabase
    .channel('now-playing-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'now_playing' },
      (payload) => {
        const row = payload.new as NowPlayingRow;
        onChange(row);
      }
    )
    .subscribe((status) => {
      console.log(`[supabase] realtime status: ${status}`);
    });
}

export function unsubscribe(): void {
  if (channel && supabase) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

export async function getSettings(): Promise<{ enabled: boolean } | null> {
  if (!supabase) return { enabled: true };
  const { data } = await supabase
    .from('settings')
    .select('enabled')
    .eq('id', 'singleton')
    .single();
  return data as { enabled: boolean } | null;
}
