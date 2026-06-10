# Polls Windows media session every 3 seconds and writes JSON to stdout
# Used by the RPC Bridge agent as a child process

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus, Windows.Media.Control, ContentType=WindowsRuntime]

function Await {
  param($AsyncOp, $ResultType)
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq 'AsTask' -and
      $_.GetParameters().Count -eq 1 -and
      $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($AsyncOp))
  $netTask.Wait(-1) | Out-Null
  return $netTask.Result
}

$lastJson = ""

while ($true) {
  try {
    $manager = Await `
      ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) `
      ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

    $session = $manager.GetCurrentSession()

    if ($null -eq $session) {
      $json = '{"playing":false}'
    } else {
      $props = Await `
        ($session.TryGetMediaPropertiesAsync()) `
        ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])

      $playback = $session.GetPlaybackInfo()
      $playing = ($playback.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing)

      $appId = $session.SourceAppUserModelId
      $source = if ($appId -like "*AppleMusic*") { "applemusic" }
                elseif ($appId -like "*Spotify*") { "spotify" }
                elseif ($appId -like "*YouTubeMusic*" -or $appId -like "*youtube*") { "youtubemusic" }
                else { "windows" }

      $obj = [ordered]@{
        playing = $playing
        song    = if ($props.Title) { $props.Title } else { $null }
        artist  = if ($props.Artist) { $props.Artist } else { $null }
        album   = if ($props.AlbumTitle) { $props.AlbumTitle } else { $null }
        source  = $source
      }
      $json = ConvertTo-Json $obj -Compress
    }

    if ($json -ne $lastJson) {
      Write-Output $json
      [Console]::Out.Flush()
      $lastJson = $json
    }
  } catch {
    $json = '{"playing":false}'
    if ($json -ne $lastJson) {
      Write-Output $json
      [Console]::Out.Flush()
      $lastJson = $json
    }
  }

  Start-Sleep -Seconds 3
}
