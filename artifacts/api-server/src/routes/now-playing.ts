import { Router, type IRouter, type Request, type Response } from "express";
import { getState, setState, clearState } from "../lib/state.js";
import { upsertNowPlaying, getNowPlaying } from "../lib/supabase.js";
import { lookupTrack } from "../lib/itunes.js";

const router: IRouter = Router();

function requireApiKey(req: Request, res: Response, next: () => void): void {
  const key = req.headers["x-api-key"];
  const expected = process.env["API_KEY"];
  if (!expected || key !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

interface NowPlayingBody {
  playing: boolean;
  song?: string;
  artist?: string;
  source?: string;
}

router.post("/now-playing", requireApiKey, async (req: Request, res: Response) => {
  try {
    const body = req.body as NowPlayingBody;

    if (typeof body.playing !== "boolean") {
      res.status(400).json({ error: "playing (boolean) is required" });
      return;
    }

    if (!body.playing) {
      clearState();
      try {
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
      } catch (e) {
        req.log.warn({ err: e }, "supabase upsert failed (non-fatal)");
      }
      res.json({ ok: true });
      return;
    }

    if (!body.song || !body.artist) {
      res.status(400).json({ error: "song and artist are required when playing is true" });
      return;
    }

    const itunes = await lookupTrack(body.song, body.artist);
    const now = Date.now();

    setState({
      playing: true,
      song: body.song,
      artist: body.artist,
      album: itunes.album,
      albumArtUrl: itunes.albumArtUrl,
      songDurationMs: itunes.durationMs,
      songStartedAt: now,
      source: body.source ?? "unknown",
    });

    try {
      await upsertNowPlaying({
        playing: true,
        song: body.song,
        artist: body.artist,
        album: itunes.album,
        album_art_url: itunes.albumArtUrl,
        song_duration_ms: itunes.durationMs,
        song_started_at: now,
        source: body.source ?? "unknown",
        updated_at: now,
      });
    } catch (e) {
      req.log.warn({ err: e }, "supabase upsert failed (non-fatal)");
    }

    req.log.info({ song: body.song, artist: body.artist }, "now-playing updated");
    res.json({ ok: true, albumArtUrl: itunes.albumArtUrl });
  } catch (e) {
    req.log.error({ err: e }, "now-playing POST failed");
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/current-song", requireApiKey, async (_req: Request, res: Response) => {
  const row = await getNowPlaying();
  if (row) {
    res.json(row);
  } else {
    res.json(getState());
  }
});

export default router;
