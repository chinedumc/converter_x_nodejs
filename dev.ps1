# PowerShell script to run development servers

# Function to check if a command exists
function Test-Command {
    param ($Command)
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'stop'
    try { if (Get-Command $Command) { return $true } }
    catch { return $false }
    finally { $ErrorActionPreference = $oldPreference }
}

# Check prerequisites
Write-Host "Checking prerequisites..."

# Check Node.js
if (-not (Test-Command node)) {
    Write-Host "Error: Node.js is not installed" -ForegroundColor Red
    exit 1
}

# Check npm
if (-not (Test-Command npm)) {
    Write-Host "Error: npm is not installed" -ForegroundColor Red
    exit 1
}

# Install Node.js dependencies for backend
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
npm install
Set-Location ..

# Install Node.js dependencies for frontend
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm install
Set-Location ..

# Function to start the backend server
function Start-Backend {
    Write-Host "Starting backend server..." -ForegroundColor Green
    Set-Location backend
    npm start
}

# Function to start the frontend server
function Start-Frontend {
    Write-Host "Starting frontend server..." -ForegroundColor Green
    Set-Location frontend
    npm run dev
}

# Start both servers
Write-Host "Starting development servers..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PWD'; Start-Backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PWD'; Start-Frontend"

# Open browser
Start-Process "http://localhost:3000"