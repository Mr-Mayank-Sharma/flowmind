# Starts Redis + Qdrant as native Windows processes (in-process alternative to
# Docker Compose on boxes where WSL2/Hyper-V is unavailable, e.g. HCS_E_HYPERV_NOT_INSTALLED).
# Usage:  powershell -ExecutionPolicy Bypass -File infra/scripts/start-native-infra.ps1
# Binaries: C:\Program Files\KMSpico\temp\opencode\infra-bin\{redis,qdrant}

$ErrorActionPreference = "Stop"

$redisDir = "C:\Program Files\KMSpico\temp\opencode\infra-bin\redis"
$qdrantExe = "C:\Program Files\KMSpico\temp\opencode\infra-bin\qdrant\qdrant.exe"
$redisExe = Join-Path $redisDir "redis-server.exe"
$redisCli = Join-Path $redisDir "redis-cli.exe"

function Assert-Port($port, $name) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "$name already listening on :$port"
    return $true
  }
  return $false
}

if (-not (Assert-Port 6379 "Redis")) {
  $p = Start-Process -FilePath $redisExe -ArgumentList "--port", "6379", "--dir", "`"$redisDir`"" -WindowStyle Hidden -PassThru
  Write-Host "Redis started (pid $($p.Id))"
}

if (-not (Assert-Port 6333 "Qdrant")) {
  $p = Start-Process -FilePath $qdrantExe -WindowStyle Hidden -PassThru
  Write-Host "Qdrant started (pid $($p.Id))"
}

Start-Sleep -Seconds 3

$ping = & $redisCli PING
Write-Host "Redis PING -> $ping"

try {
  $collections = (Invoke-RestMethod -Uri "http://localhost:6333/collections" -TimeoutSec 10).result.collections.Count
  Write-Host "Qdrant /collections -> $collections collection(s)"
} catch {
  Write-Host "Qdrant health check failed: $_"
}