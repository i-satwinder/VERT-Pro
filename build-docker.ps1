<#
.SYNOPSIS
    Builds and pushes the VERT-Pro Docker image to GitHub Container Registry.

.DESCRIPTION
    Builds the Docker image locally and pushes it to ghcr.io/i-satwinder/VERT-Pro.
    Each run tags the image as both 'latest' and with the current short git SHA.

    Prerequisites:
      - Docker Desktop running with 'docker' CLI available
      - Logged in to GHCR: docker login ghcr.io -u <your-username>

.PARAMETER SkipPush
    Build only, do not push to the registry.

.EXAMPLE
    .\build-docker.ps1
    .\build-docker.ps1 -SkipPush
#>

param(
    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"

$IMAGE_NAME = "ghcr.io/i-satwinder/VERT-Pro"
$SHORT_SHA = (git rev-parse --short HEAD 2>$null).Trim()

if (-not $SHORT_SHA) {
    Write-Error "Could not determine git SHA. Are you in a git repository?"
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " VERT-Pro Docker Build"                   -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Image:  $IMAGE_NAME"  -ForegroundColor Yellow
Write-Host "SHA:    $SHORT_SHA"   -ForegroundColor Yellow
Write-Host ""

# Build the image
Write-Host "[1/3] Building Docker image..." -ForegroundColor Green
docker build `
    --build-arg PUB_ENV=production `
    --build-arg PUB_HOSTNAME="" `
    --build-arg PUB_PLAUSIBLE_URL="" `
    --build-arg PUB_VERTD_URL=https://vertd.vert.sh `
    --build-arg PUB_DISABLE_ALL_EXTERNAL_REQUESTS=false `
    --build-arg PUB_DONATION_URL=https://donations.vert.sh `
    --build-arg PUB_STRIPE_KEY=pk_live_51TlrPaFTPjkhEGBSu5Kwy5jJQYxcX5yUUHXiH5g7Xzvb0NKzDqbooc126HjlW35uUkfAgQN2ruEoCuyQynoxpKaA00ojFgQ116 `
    -t "${IMAGE_NAME}:latest" `
    -t "${IMAGE_NAME}:${SHORT_SHA}" `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed."
    exit 1
}

Write-Host ""
Write-Host "[2/3] Image built successfully!" -ForegroundColor Green
Write-Host "  Tagged as: ${IMAGE_NAME}:latest"     -ForegroundColor DarkGray
Write-Host "  Tagged as: ${IMAGE_NAME}:${SHORT_SHA}" -ForegroundColor DarkGray
Write-Host ""

if ($SkipPush) {
    Write-Host "[3/3] Skipping push (--SkipPush flag set)." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Done! Image is available locally." -ForegroundColor Cyan
    exit 0
}

# Check if logged in to GHCR
Write-Host "[3/3] Pushing to GitHub Container Registry..." -ForegroundColor Green
Write-Host "      (If prompted, run: docker login ghcr.io)" -ForegroundColor DarkGray
Write-Host ""

docker push "${IMAGE_NAME}:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Push failed for 'latest' tag. Make sure you're logged in: docker login ghcr.io"
    exit 1
}

docker push "${IMAGE_NAME}:${SHORT_SHA}"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Push failed for SHA tag."
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Push complete!"                         -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ghcr.io/i-satwinder/VERT-Pro:latest"      -ForegroundColor Yellow
Write-Host "  ghcr.io/i-satwinder/VERT-Pro:$SHORT_SHA"   -ForegroundColor Yellow
Write-Host ""
Write-Host "Make sure the package is set to Public in:" -ForegroundColor DarkGray
Write-Host "  https://github.com/i-satwinder/VERT-Pro/pkgs/container/vert-pro" -ForegroundColor DarkGray
Write-Host ""
