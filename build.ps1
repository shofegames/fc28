# Arma "index.html" juntando los modulos de src/ en un solo archivo (asi se abre con doble clic y anda en GitHub Pages).
#   powershell -ExecutionPolicy Bypass -File build.ps1          -> index.html (el juego publicado)
#   powershell -ExecutionPolicy Bypass -File build.ps1 -Dev     -> dev\index.html (sin CSP y con window.__e para depurar; no se sube)
#   powershell -ExecutionPolicy Bypass -File build.ps1 -Save    -> index.html y ademas una copia en versiones\FC 28 vN.html (N = la siguiente)
param([string]$Out = "", [switch]$Dev, [switch]$Save)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Out) {
  if ($Dev) { $d = Join-Path $root 'dev'; if (-not (Test-Path $d)) { New-Item -ItemType Directory $d | Out-Null }; $Out = Join-Path $d 'index.html' }
  else { $Out = Join-Path $root 'index.html' }
}
$utf8 = New-Object System.Text.UTF8Encoding $false
$read = { param($p) [System.IO.File]::ReadAllText($p, $utf8) }
function Files($sub, $pat) {
  $names = [string[]]@(Get-ChildItem (Join-Path $root ('src\' + $sub)) -Filter $pat | ForEach-Object { $_.Name })
  [Array]::Sort($names, [System.StringComparer]::Ordinal)
  return @($names | ForEach-Object { Join-Path $root ('src\' + $sub + '\' + $_) })
}
$tpl = & $read (Join-Path $root 'src\index.html')
$css = (Files 'css' '*.css' | ForEach-Object { & $read $_ }) -join "`n"
$js  = (Files 'js' '*.js' | ForEach-Object { "/* ===== " + (Split-Path $_ -Leaf) + " ===== */`n" + (& $read $_) }) -join "`n"
$dbg = ''
if ($Dev) { $dbg = "window.__e=s=>eval(s);`n" }
$code = "(function(){`n'use strict';`n" + $js + "`n" + $dbg + "})();"
# numero de version: la ultima de la carpeta versiones (+1 si se guarda una nueva)
$vdir = Join-Path $root 'versiones'
$last = 0
if (Test-Path $vdir) { Get-ChildItem $vdir -Filter 'FC 28 v*.html' | ForEach-Object { if ($_.Name -match 'v(\d+)\.html$') { $last = [math]::Max($last, [int]$Matches[1]) } } }
$ver = if ($Save) { $last + 1 } else { $last + 1 }
$label = if ($Dev) { "v$ver (prueba)" } else { "v$ver" }
$html = $tpl.Replace('/*@CSS*/', $css).Replace('/*@JS*/', $code).Replace('<!--@VER-->', $label)
if ($Dev) { $html = [regex]::Replace($html, '<meta http-equiv="Content-Security-Policy"[^>]*>', '') }
[System.IO.File]::WriteAllText($Out, $html, $utf8)
if ($Save -and -not $Dev) { if (-not (Test-Path $vdir)) { New-Item -ItemType Directory $vdir | Out-Null }; $vf = Join-Path $vdir ("FC 28 v$ver.html"); [System.IO.File]::WriteAllText($vf, $html, $utf8); Write-Output ("Guardada " + $vf) }
Write-Output ("OK " + $Out + " (" + [math]::Round((Get-Item $Out).Length / 1024) + " KB)")
