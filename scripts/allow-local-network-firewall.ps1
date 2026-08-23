# Allow Vite dev servers (admin 5173, customer 5174) on private network only.
# MUST run as Administrator (right-click PowerShell or Terminal -> "Run as administrator").

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "ERROR: This script must run as Administrator." -ForegroundColor Red
  Write-Host ""
  Write-Host "Do this:" -ForegroundColor Yellow
  Write-Host "  1. Close this window." -ForegroundColor Gray
  Write-Host "  2. Right-click Start -> Terminal (Admin) or Windows PowerShell (Admin)." -ForegroundColor Gray
  Write-Host "  3. Click Yes on the UAC prompt." -ForegroundColor Gray
  Write-Host "  4. Run:" -ForegroundColor Gray
  Write-Host "     cd `"$PWD`"" -ForegroundColor White
  Write-Host "     Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force" -ForegroundColor White
  Write-Host "     .\scripts\allow-local-network-firewall.ps1" -ForegroundColor White
  exit 1
}

$ports = @(5173, 5174)
$ruleNamePrefix = "QRMenu Dev Server"
$ok = 0

foreach ($port in $ports) {
  $name = "$ruleNamePrefix - Port $port"
  $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Rule already exists: $name" -ForegroundColor Yellow
    $ok++
    continue
  }
  try {
    New-NetFirewallRule -DisplayName $name `
      -Direction Inbound `
      -Protocol TCP `
      -LocalPort $port `
      -Action Allow `
      -Profile Private `
      -Description "Allows phone/other devices on same Wi-Fi to open QR Menu dev server (private network only)."
    Write-Host "Added: $name" -ForegroundColor Green
    $ok++
  } catch {
    Write-Host "Failed to add $name : $_" -ForegroundColor Red
  }
}

Write-Host ""
if ($ok -eq $ports.Count) {
  Write-Host "Done. Your phone on the same Wi-Fi can now reach the dev servers." -ForegroundColor Cyan
  Write-Host "If it still fails, ensure your Wi-Fi is set as 'Private' in Windows:" -ForegroundColor Cyan
  Write-Host "  Settings -> Network & Internet -> Wi-Fi -> your network -> Network profile type: Private" -ForegroundColor Gray
} else {
  Write-Host "Some rules could not be added. Run this script again as Administrator." -ForegroundColor Yellow
}
