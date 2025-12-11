param(
    [int]$Port = 3004
)

Write-Host "Libération du port $Port..." -ForegroundColor Yellow

$connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($connections) {
    $processes = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    
    foreach ($pid in $processes) {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Arrêt du processus: $($process.ProcessName) (PID: $pid)" -ForegroundColor Red
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
    
    Start-Sleep -Seconds 1
    Write-Host "Port $Port libéré!" -ForegroundColor Green
} else {
    Write-Host "Port $Port disponible" -ForegroundColor Green
}

