export interface SongState {
  playing: boolean;
  song: string | null;
  artist: string | null;
  album: string | null;
  albumArtUrl: string | null;
  songDurationMs: number | null;
  songStartedAt: number | null;
  source: string | null;
  updatedAt: number;
}

const defaultState: SongState = {
  playing: false,
  song: null,
  artist: null,
  album: null,
  albumArtUrl: null,
  songDurationMs: null,
  songStartedAt: null,
  source: null,
  updatedAt: Date.now(),
};

let state: SongState = { ...defaultState };

export function getState(): SongState {
  return state;
}

export function setState(patch: Partial<SongState>): void {
  state = { ...state, ...patch, updatedAt: Date.now() };
}

export function clearState(): void {
  state = { ...defaultState, updatedAt: Date.now() };
}
