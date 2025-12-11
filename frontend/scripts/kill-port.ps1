param(
    [Parameter(Mandatory=$true)]
    [int]$Port
)

Write-Host "Recherche des processus utilisant le port $Port..." -ForegroundColor Yellow

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
    
    Write-Host "Port $Port libéré avec succès!" -ForegroundColor Green
} else {
    Write-Host "Aucun processus n'utilise le port $Port" -ForegroundColor Green
}
