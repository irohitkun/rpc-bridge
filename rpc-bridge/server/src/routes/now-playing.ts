import { Router, Request, Response } from 'express';
import { requireApiKey } from '../lib/auth.js';
import { upsertNowPlaying, getNowPlaying } from '../lib/supabase.js';
import { lookupTrack } from '../lib/itunes.js';

export const nowPlayingRouter = Router();

interface NowPlayingBody {
  playing: boolean;
  song?: string;
  artist?: string;
  source?: string;
}

nowPlayingRouter.post('/now-playing', requireApiKey, async (req: Request, res: Response) => {
  const body = req.body as NowPlayingBody;

  if (typeof body.playing !== 'boolean') {
    res.status(400).json({ error: 'playing (boolean) is required' });
    return;
  }

  if (!body.playing) {
    await upsertNowPlaying({
      playing: false,
      song: null,
      artist: null,
      album: null,
      album_art_url: null,
      song_duration_ms: null,
      song_started_at: null,
      source: body.source ?? null,
      updated_at: Date.now(),
    });
    res.json({ ok: true });
    return;
  }

  if (!body.song || !body.artist) {
    res.status(400).json({ error: 'song and artist are required when playing is true' });
    return;
  }

  const itunes = await lookupTrack(body.song, body.artist);

  await upsertNowPlaying({
    playing: true,
    song: body.song,
    artist: body.artist,
    album: itunes.album,
    album_art_url: itunes.albumArtUrl,
    song_duration_ms: itunes.durationMs,
    song_started_at: Date.now(),
    source: body.source ?? 'unknown',
    updated_at: Date.now(),
  });

  res.json({ ok: true, albumArtUrl: itunes.albumArtUrl });
});

nowPlayingRouter.get('/current-song', requireApiKey, async (_req: Request, res: Response) => {
  const row = await getNowPlaying();
  if (!row) {
    res.json({ playing: false });
    return;
  }
  res.json(row);
});
