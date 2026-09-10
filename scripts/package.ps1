[CmdletBinding()]
param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$mpRoot = Split-Path $PSScriptRoot -Parent
Push-Location $mpRoot
try {
  npm run check
  if ($LASTEXITCODE -ne 0) { throw 'Checks failed' }
  npm run test:e2e
  if ($LASTEXITCODE -ne 0) { throw 'Browser checks failed' }
  & $Python -m unittest discover -s tests -p 'test_*.py'
  if ($LASTEXITCODE -ne 0) { throw 'Backend contract checks failed' }
  & $Python -m compileall -q custom_components
  if ($LASTEXITCODE -ne 0) { throw 'Backend compilation failed' }
  $mpVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
  $mpManifest = Get-Content custom_components/mp_glass/manifest.json -Raw | ConvertFrom-Json
  if ($mpManifest.version -ne $mpVersion) { throw 'Version mismatch' }
  New-Item -ItemType Directory -Path artifacts -Force | Out-Null
  & $Python scripts/package.py "artifacts/mp-glass-$mpVersion.zip"
  if ($LASTEXITCODE -ne 0) { throw 'Packaging failed' }
  Write-Host "Local artifact created. This is not a GitHub/HACS release: artifacts/mp-glass-$mpVersion.zip"
} finally { Pop-Location }
