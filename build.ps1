# Arma "index.html" juntando los modulos de src/ en un solo archivo (asi se abre con doble clic y anda en GitHub Pages).
#   powershell -ExecutionPolicy Bypass -File build.ps1          -> index.html (el juego publicado)
#   powershell -ExecutionPolicy Bypass -File build.ps1 -Dev     -> dev\index.html (sin CSP y con window.__e para depurar; no se sube)
param([string]$Out = "", [switch]$Dev)
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
$html = $tpl.Replace('/*@CSS*/', $css).Replace('/*@JS*/', $code)
if ($Dev) { $html = [regex]::Replace($html, '<meta http-equiv="Content-Security-Policy"[^>]*>', '') }
[System.IO.File]::WriteAllText($Out, $html, $utf8)
Write-Output ("OK " + $Out + " (" + [math]::Round((Get-Item $Out).Length / 1024) + " KB)")
