interface ItunesResult {
  albumArtUrl: string | null;
  durationMs: number | null;
  album: string | null;
}

interface ItunesTrack {
  artworkUrl100?: string;
  trackTimeMillis?: number;
  collectionName?: string;
}

interface ItunesResponse {
  resultCount: number;
  results: ItunesTrack[];
}

export async function lookupTrack(song: string, artist: string): Promise<ItunesResult> {
  const query = `${song} ${artist}`.trim();
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=in&entity=song&limit=5`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { albumArtUrl: null, durationMs: null, album: null };

    const json = await res.json() as ItunesResponse;
    if (!json.resultCount || json.results.length === 0) {
      return { albumArtUrl: null, durationMs: null, album: null };
    }

    const track = json.results[0];
    const rawArt = track.artworkUrl100 ?? null;
    const albumArtUrl = rawArt
      ? rawArt.replace('100x100bb', '600x600bb')
      : null;

    return {
      albumArtUrl,
      durationMs: track.trackTimeMillis ?? null,
      album: track.collectionName ?? null,
    };
  } catch {
    return { albumArtUrl: null, durationMs: null, album: null };
  }
}
