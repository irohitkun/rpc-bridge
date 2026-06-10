import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

export const setupRouter = Router();

setupRouter.get('/setup/install.ps1', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="install.ps1"');

  const apiUrl = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

  const script = `# RPC Bridge — Windows Agent Installer
# Usage: irm ${apiUrl}/api/setup/install.ps1 | iex

$ErrorActionPreference = "Stop"
$installDir = "$env:LOCALAPPDATA\\rpc-bridge"

Write-Host "Installing RPC Bridge agent..." -ForegroundColor Cyan

if (-not (Test-Path $installDir)) {
  New-Item -ItemType Directory -Path $installDir | Out-Null
}

Write-Host "Downloading agent..." -ForegroundColor Yellow
$agentUrl = "${apiUrl}/api/setup/agent.exe"
Invoke-WebRequest -Uri $agentUrl -OutFile "$installDir\\rpc-bridge-agent.exe"

$apiKey = Read-Host "Enter your API key"
$supabaseUrl = Read-Host "Enter your Supabase URL"
$supabaseAnonKey = Read-Host "Enter your Supabase anon key"
$discordAppId = Read-Host "Enter your Discord Application ID"

$envContent = @"
SUPABASE_URL=$supabaseUrl
SUPABASE_ANON_KEY=$supabaseAnonKey
DISCORD_APPLICATION_ID=$discordAppId
API_KEY=$apiKey
API_URL=${apiUrl}
"@
$envContent | Out-File -FilePath "$installDir\\.env" -Encoding UTF8

$addStartup = Read-Host "Add to Windows startup? (y/n)"
if ($addStartup -eq "y") {
  $startupPath = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
  $shortcutPath = "$startupPath\\rpc-bridge.lnk"
  $wsh = New-Object -ComObject WScript.Shell
  $shortcut = $wsh.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = "$installDir\\rpc-bridge-agent.exe"
  $shortcut.WorkingDirectory = $installDir
  $shortcut.WindowStyle = 7
  $shortcut.Save()
  Write-Host "Added to startup." -ForegroundColor Green
}

Write-Host ""
Write-Host "Done! Run the agent:" -ForegroundColor Green
Write-Host "  $installDir\\rpc-bridge-agent.exe" -ForegroundColor White
`;

  res.send(script);
});
