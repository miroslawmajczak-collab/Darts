$ErrorActionPreference = 'Stop'
$appDirectory = $PSScriptRoot
$port = if ($env:FLIGHT_PORT) { $env:FLIGHT_PORT } else { '17840' }
$url = "http://127.0.0.1:$port"
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodeExecutable)) { throw 'Node.js 20 or newer is needed. Install Node.js LTS, then double-click start.bat again.' }
$ready = $false
try { $health = Invoke-RestMethod "$url/api/health" -TimeoutSec 2; $ready = $health.app -eq 'flight-local-darts' } catch { }
if (-not $ready) {
    $logDirectory = Join-Path $appDirectory 'logs'
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    $serverArguments = '"' + (Join-Path $appDirectory 'server.mjs') + '"'
    $serverProcess = Start-Process -FilePath $nodeExecutable -ArgumentList $serverArguments -WorkingDirectory $appDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'server.log') -RedirectStandardError (Join-Path $logDirectory 'server-error.log') -PassThru
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try { $health = Invoke-RestMethod "$url/api/health" -TimeoutSec 1; if ($health.app -eq 'flight-local-darts') { $ready = $true; break } } catch { }
        if ($serverProcess.HasExited) { break }
        Start-Sleep -Milliseconds 150
    }
    if (-not $ready) { throw 'FLIGHT could not start. Check the logs folder; another application may be using the port.' }
    Set-Content -LiteralPath (Join-Path $logDirectory 'server.pid') -Value $serverProcess.Id
}
Start-Process $url
