$ErrorActionPreference = 'Stop'
$pidFile = Join-Path $PSScriptRoot 'logs\server.pid'
if (Test-Path -LiteralPath $pidFile) {
    $serverPid = [int](Get-Content -LiteralPath $pidFile)
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid"
    $expectedScript = Join-Path $PSScriptRoot 'server.mjs'
    if ($processInfo -and $processInfo.Name -eq 'node.exe' -and $processInfo.CommandLine.Contains($expectedScript)) {
        Stop-Process -Id $serverPid
    }
    Remove-Item -LiteralPath $pidFile
}
