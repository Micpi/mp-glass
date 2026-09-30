[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$compiler = @(
  "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
  "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) { throw 'Le compilateur .NET Framework de Windows est introuvable.' }
$source = Join-Path $PSScriptRoot 'launcher\MpNexusLauncher.cs'
$output = Join-Path $root 'Lancer MP Nexus.exe'
& $compiler /nologo /target:winexe /codepage:65001 "/out:$output" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll $source
if ($LASTEXITCODE -ne 0) { throw "La compilation du lanceur a échoué ($LASTEXITCODE)." }
Write-Output "Lanceur prêt : $output"
