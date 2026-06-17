$composeFile = Join-Path $PSScriptRoot "docker-compose.yml"
docker compose -f $composeFile up -d --wait
$env:DATABASE_URL = "mysql+aiomysql://pimis:pimis123@127.0.0.1:3306/pimis?charset=utf8mb4"

Set-Location (Split-Path $PSScriptRoot -Parent)
$venvPython = Join-Path (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) ".venv") "Scripts\python.exe"
& $venvPython -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
