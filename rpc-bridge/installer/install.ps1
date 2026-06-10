# RPC Bridge - Windows Agent Installer
# Run with: irm https://your-domain.com/api/setup/install.ps1 | iex

$ErrorActionPreference = "Stop"
$installDir = "$env:LOCALAPPDATA\rpc-bridge"
$agentExe   = "$installDir\rpc-bridge-agent.exe"
$envFile    = "$installDir\.env"

Write-Host ""
Write-Host "  RPC Bridge - Windows Agent Installer" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $installDir)) {
  New-Item -ItemType Directory -Path $installDir | Out-Null
}

# --- Config ---
$apiUrl        = Read-Host "Server URL (e.g. https://your-domain.com)"
$apiKey        = Read-Host "API key"
$supabaseUrl   = Read-Host "Supabase URL"
$supabaseAnon  = Read-Host "Supabase anon key"
$discordAppId  = Read-Host "Discord Application ID"

Write-Host ""
Write-Host "Downloading agent..." -ForegroundColor Yellow

try {
  Invoke-WebRequest -Uri "$apiUrl/api/setup/agent.exe" -OutFile $agentExe -UseBasicParsing
} catch {
  Write-Host "Failed to download agent. Check your server URL." -ForegroundColor Red
  exit 1
}

# --- Write .env ---
@"
SUPABASE_URL=$supabaseUrl
SUPABASE_ANON_KEY=$supabaseAnon
DISCORD_APPLICATION_ID=$discordAppId
API_KEY=$apiKey
API_URL=$apiUrl
"@ | Out-File -FilePath $envFile -Encoding UTF8

Write-Host "Config saved to $envFile" -ForegroundColor Green

# --- Startup shortcut ---
Write-Host ""
$addStartup = Read-Host "Add to Windows startup so it runs automatically? (y/n)"
if ($addStartup -ieq "y") {
  $startupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
  $shortcut   = "$startupDir\rpc-bridge.lnk"
  $wsh = New-Object -ComObject WScript.Shell
  $sc  = $wsh.CreateShortcut($shortcut)
  $sc.TargetPath       = $agentExe
  $sc.WorkingDirectory = $installDir
  $sc.WindowStyle      = 7   # minimized
  $sc.Save()
  Write-Host "Startup shortcut created." -ForegroundColor Green
}

# --- Launch now ---
Write-Host ""
$launchNow = Read-Host "Launch the agent now? (y/n)"
if ($launchNow -ieq "y") {
  Start-Process -FilePath $agentExe -WorkingDirectory $installDir
  Write-Host "Agent started." -ForegroundColor Green
}

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Cyan
Write-Host "Agent location: $agentExe" -ForegroundColor White
Write-Host ""
