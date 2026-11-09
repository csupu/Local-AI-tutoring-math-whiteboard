# MathTutor — one-command local startup
# Starts the FastAPI backend (port 8000) and the Vite frontend (port 5173),
# waits for both, and prints the URL. Press Ctrl+C to stop everything.

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

Write-Host "MathTutor starting..." -ForegroundColor Cyan

function Test-Port([int]$port) {
    try {
        $tcp = New-Object Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $port)
        $tcp.Close()
        return $true
    } catch { return $false }
}

function Stop-Child([int]$id) {
    # Kill the process and its children
    $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($proc) {
        Get-CimInstance Win32_Process -Filter "ParentProcessId = $id" | ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    }
}

foreach ($port in @(8000, 5173)) {
    if (Test-Port $port) {
        Write-Host "Port $port is already in use. Existing services were left running. Open the existing app or stop those services before launching." -ForegroundColor Yellow
        exit 1
    }
}

# Prefer the project's virtual environment; avoid the Windows Store alias.
$pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonExe)) {
    $pythonExe = Get-Command python -All -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -notlike '*\WindowsApps\*' } |
        Select-Object -First 1 -ExpandProperty Source
}
if (-not $pythonExe) {
    $pythonExe = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Python\pythoncore-*\python.exe') -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $pythonExe) { throw 'No usable Python found. Install Python or create backend\.venv.' }

$backend = Start-Process -FilePath $pythonExe `
    -ArgumentList "-m", "uvicorn", "main:app", "--port", "8000", "--log-level", "warning" `
    -WorkingDirectory $backendDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $backendDir "backend.log") `
    -RedirectStandardError (Join-Path $backendDir "backend.err.log") -PassThru

$frontend = Start-Process -FilePath "cmd" `
    -ArgumentList "/c", "npm run dev -- --host 127.0.0.1 --strictPort > dev.log 2>&1" `
    -WorkingDirectory $frontendDir -WindowStyle Hidden -PassThru

$stopped = $false
trap {
    if (-not $stopped) {
        $stopped = $true
        Write-Host "`nShutting down..." -ForegroundColor Yellow
        Stop-Child $backend.Id
        Stop-Child $frontend.Id
    }
}

Write-Host "Waiting for backend  : http://localhost:8000 ..."
for ($i = 0; $i -lt 30; $i++) { Start-Sleep -Milliseconds 500; if (Test-Port 8000) { break } }
if (-not (Test-Port 8000)) {
    Write-Host "Backend did not start. Check c:\mathtools\backend\backend.err.log" -ForegroundColor Red
    Stop-Child $frontend.Id
    exit 1
}
Write-Host "  -> backend is up" -ForegroundColor Green

Write-Host "Waiting for frontend : http://localhost:5173 ..."
for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Milliseconds 500; if (Test-Port 5173) { break } }
if (-not (Test-Port 5173)) {
    Write-Host "Frontend did not start. Check c:\mathtools\frontend\dev.log" -ForegroundColor Red
    Stop-Child $backend.Id
    exit 1
}
Write-Host "  -> frontend is up" -ForegroundColor Green

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  MathTutor is running:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Ollama must be running:  ollama list" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C here to stop everything." -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

try {
    while (-not $backend.HasExited -and -not $frontend.HasExited) {
        Start-Sleep -Seconds 1
        $backend.Refresh()
        $frontend.Refresh()
    }
    Write-Host 'A MathTutor service exited. Check backend/backend.err.log and frontend/dev.log.' -ForegroundColor Red
} finally {
    # Clean up only the services owned by this launcher, including on Ctrl+C.
    Stop-Child $backend.Id
    Stop-Child $frontend.Id
}
