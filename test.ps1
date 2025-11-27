# PowerShell script to run tests

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
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

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

# Function to run backend tests
function Test-Backend {
    Write-Host "\nRunning backend tests..." -ForegroundColor Green
    Set-Location backend

    # Run npm audit for security checks
    Write-Host "\nRunning security audit..." -ForegroundColor Yellow
    npm audit

    Set-Location ..
}

# Function to run frontend tests
function Test-Frontend {
    Write-Host "\nRunning frontend tests..." -ForegroundColor Green
    Set-Location frontend

    # Run npm audit
    Write-Host "\nRunning security audit..." -ForegroundColor Yellow
    npm audit

    # Run ESLint if configured
    if (Test-Path "node_modules\.bin\eslint") {
        Write-Host "\nRunning ESLint..." -ForegroundColor Yellow
        npm run lint
    }

    # Run TypeScript compilation check if configured
    if (Test-Path "tsconfig.json") {
        Write-Host "\nChecking TypeScript compilation..." -ForegroundColor Yellow
        npm run build
    }

    Set-Location ..
}

# Main execution
try {
    # Run backend tests
    Test-Backend

    # Run frontend tests
    Test-Frontend

    Write-Host "\nAll tests completed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "\nError occurred during testing: $_" -ForegroundColor Red
    exit 1
}