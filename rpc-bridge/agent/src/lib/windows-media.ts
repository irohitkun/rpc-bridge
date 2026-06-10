import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { join } from 'path';
import { writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';

export interface MediaState {
  playing: boolean;
  song: string | null;
  artist: string | null;
  album: string | null;
  source: string;
}

type MediaChangeCallback = (state: MediaState) => void;

const PS1_SCRIPT = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus,Windows.Media.Control,ContentType=WindowsRuntime]
function Await { param($AsyncOp,$ResultType) $g=([System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask'-and$_.GetParameters().Count -eq 1-and$_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'})[0];$t=$g.MakeGenericMethod($ResultType);$n=$t.Invoke($null,@($AsyncOp));$n.Wait(-1)|Out-Null;return $n.Result }
$last=""
while($true){
  try{
    $mgr=Await([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync())([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    $s=$mgr.GetCurrentSession()
    if($null -eq $s){$j='{"playing":false}'}
    else{
      $p=Await($s.TryGetMediaPropertiesAsync())([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $pb=$s.GetPlaybackInfo()
      $playing=($pb.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing)
      $id=$s.SourceAppUserModelId
      $src=if($id -like "*AppleMusic*"){"applemusic"}elseif($id -like "*Spotify*"){"spotify"}elseif($id -like "*YouTube*"){"youtubemusic"}else{"windows"}
      $obj=@{playing=$playing;song=if($p.Title){$p.Title}else{$null};artist=if($p.Artist){$p.Artist}else{$null};album=if($p.AlbumTitle){$p.AlbumTitle}else{$null};source=$src}
      $j=$obj|ConvertTo-Json -Compress
    }
    if($j -ne $last){Write-Output $j;[Console]::Out.Flush();$last=$j}
  }catch{$j='{"playing":false}';if($j -ne $last){Write-Output $j;[Console]::Out.Flush();$last=$j}}
  Start-Sleep -Seconds 3
}
`;

let proc: ChildProcessWithoutNullStreams | null = null;
let scriptPath: string | null = null;

export function startWindowsMediaWatcher(onChange: MediaChangeCallback): void {
  const tmpPath = join(tmpdir(), 'rpc-bridge-media.ps1');
  if (!existsSync(tmpPath)) {
    writeFileSync(tmpPath, PS1_SCRIPT, 'utf8');
  }
  scriptPath = tmpPath;

  proc = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
  ]);

  let buffer = '';

  proc.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const state = JSON.parse(trimmed) as MediaState;
        console.log(`[media] detected: playing=${state.playing} song="${state.song}" artist="${state.artist}" source=${state.source}`);
        onChange(state);
      } catch {
        console.warn('[media] malformed line:', trimmed);
      }
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    console.error('[media-watcher] stderr:', chunk.toString().trim());
  });

  proc.on('exit', (code) => {
    console.error(`[media-watcher] exited with code ${code}, restarting in 5s`);
    setTimeout(() => startWindowsMediaWatcher(onChange), 5000);
  });
}

export function stopWindowsMediaWatcher(): void {
  proc?.kill();
  proc = null;
}
