# Servidor local minimo para probar el juego (no hace falta Node ni Python).
#   powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8765] [-Dir dev]
param([int]$Port = 8765, [string]$Dir = "dev")
$root = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) $Dir
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Output "Sirviendo $root en http://localhost:$Port/"
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.css' = 'text/css'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.json' = 'application/json'; '.glb' = 'model/gltf-binary' }
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($path -eq '') { $path = 'index.html' }
  $file = Join-Path $root $path
  try {
    # POST /save/nombre.jpg con un dataURL en el cuerpo: guarda una captura en la carpeta servida (solo para pruebas)
    if ($ctx.Request.HttpMethod -eq 'POST' -and $path -match '^save/([\w\-]+\.(jpg|png))$') {
      $body = (New-Object IO.StreamReader($ctx.Request.InputStream)).ReadToEnd()
      [IO.File]::WriteAllBytes((Join-Path $root $Matches[1]), [Convert]::FromBase64String($body.Substring($body.IndexOf(',') + 1)))
    } elseif (Test-Path $file -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
  } catch { }
  $ctx.Response.Close()
}
