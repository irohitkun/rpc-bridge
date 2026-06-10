-- Run this in your Supabase SQL editor to set up the schema

-- Table: now_playing
-- Holds a single row (id = 'singleton') representing the current song state
CREATE TABLE IF NOT EXISTS now_playing (
  id               TEXT PRIMARY KEY DEFAULT 'singleton',
  playing          BOOLEAN NOT NULL DEFAULT FALSE,
  song             TEXT,
  artist           TEXT,
  album            TEXT,
  album_art_url    TEXT,
  song_duration_ms INTEGER,
  song_started_at  BIGINT,
  source           TEXT,
  updated_at       BIGINT NOT NULL
);

-- Insert default row so the agent always has something to read
INSERT INTO now_playing (id, playing, updated_at)
VALUES ('singleton', FALSE, EXTRACT(EPOCH FROM NOW()) * 1000)
ON CONFLICT (id) DO NOTHING;

-- Table: settings
-- Holds a single row (id = 'singleton') for user preferences
CREATE TABLE IF NOT EXISTS settings (
  id             TEXT PRIMARY KEY DEFAULT 'singleton',
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at     BIGINT NOT NULL
);

INSERT INTO settings (id, enabled, updated_at)
VALUES ('singleton', TRUE, EXTRACT(EPOCH FROM NOW()) * 1000)
ON CONFLICT (id) DO NOTHING;

-- Enable realtime on now_playing so the agent receives instant push updates
ALTER PUBLICATION supabase_realtime ADD TABLE now_playing;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
