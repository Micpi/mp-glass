[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$mpRoot = Split-Path $PSScriptRoot -Parent
Push-Location $mpRoot
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
  $mpConfig = Join-Path $mpRoot '.dev-ha'
  New-Item -ItemType Directory -Path $mpConfig -Force | Out-Null
  $mpConfiguration = Join-Path $mpConfig 'configuration.yaml'
  if (-not (Test-Path -LiteralPath $mpConfiguration)) {
    @'
default_config:
input_boolean:
  mp_glass_light:
    name: MP Nexus test light state
template:
  - light:
      - name: MP Nexus Test Light
        unique_id: mp_glass_test_light
        state: "{{ is_state('input_boolean.mp_glass_light', 'on') }}"
        turn_on:
          action: input_boolean.turn_on
          target:
            entity_id: input_boolean.mp_glass_light
        turn_off:
          action: input_boolean.turn_off
          target:
            entity_id: input_boolean.mp_glass_light
'@ | Set-Content -LiteralPath $mpConfiguration -Encoding utf8
  }
  docker compose up -d
  if ($LASTEXITCODE -ne 0) { throw 'Docker Engine must be available to launch the real HA instance' }
  Write-Host 'Home Assistant dev: http://127.0.0.1:8124 (complete native onboarding).'
} finally { Pop-Location }
