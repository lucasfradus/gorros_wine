<#
.SYNOPSIS
  Abre, lista y cierra worktrees de Gorros Wine.

.DESCRIPTION
  Cada iteración grande vive en su propio worktree hermano del repo principal:

      C:/Users/lucas/
      ├── Gorros/                 ← main
      ├── Gorros-checkout-mp/     ← feat/checkout-mp   :3001
      └── Gorros-admin-catalogo/  ← feat/admin-catalogo :3002

  Hermanos y no adentro del repo a propósito: así ni `next dev` ni `tsc` los
  escanean, y no hay que ignorarlos en git.

  La base de datos es una sola y compartida (docker `gorros-db`, :5432). Lo que
  cambia por worktree es el puerto del server de Next, que el script reserva y
  deja anotado en `.worktree-port`.

.EXAMPLE
  ./scripts/worktree.ps1 nuevo checkout-mp
  ./scripts/worktree.ps1 nuevo carrito-roto -tipo fix
  ./scripts/worktree.ps1 lista
  ./scripts/worktree.ps1 borrar checkout-mp -borrarRama
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('nuevo', 'lista', 'borrar')]
  [string]$comando = 'lista',

  [Parameter(Position = 1)]
  [string]$slug,

  [ValidateSet('feat', 'fix', 'chore')]
  [string]$tipo = 'feat',

  [switch]$sinInstalar,
  [switch]$borrarRama
)

$ErrorActionPreference = 'Stop'

# git y npm escriben en stderr aunque les vaya bien: "Preparing worktree...",
# "npm warn deprecated...". En PowerShell 5.1, con ErrorActionPreference en Stop,
# cada línea de stderr de un ejecutable nativo se vuelve un error terminante y
# aborta el script a mitad de camino — el worktree quedaba creado pero sin puerto,
# sin .env.local y sin node_modules. Lo único que dice de verdad si un ejecutable
# falló es $LASTEXITCODE, que es lo que se chequea en cada llamada.
function Invoke-Nativo {
  $anterior = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $exe   = $args[0]
    $resto = if ($args.Count -gt 1) { $args[1..($args.Count - 1)] } else { @() }
    & $exe @resto
  } finally { $ErrorActionPreference = $anterior }
}

function Invoke-Git { Invoke-Nativo git @args }

$repo    = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$padre   = Split-Path $repo -Parent
$prefijo = 'Gorros-'

# Windows PowerShell 5.1 le mete BOM a `Set-Content -Encoding utf8`, y un BOM al
# principio de .env.local rompe el `process.loadEnvFile` de drizzle.config.ts.
function Write-TextoUtf8 {
  param([string]$Ruta, [string]$Texto)
  [System.IO.File]::WriteAllText($Ruta, $Texto, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-Worktrees {
  Get-ChildItem -Path $padre -Directory -Filter "$prefijo*" -ErrorAction SilentlyContinue
}

# El puerto libre más bajo: 3000 es el repo principal, los worktrees siguen.
function Get-PuertoLibre {
  $usados = @(3000)
  foreach ($w in Get-Worktrees) {
    $f = Join-Path $w.FullName '.worktree-port'
    if (Test-Path $f) { $usados += [int]((Get-Content $f -Raw).Trim()) }
  }
  return (($usados | Measure-Object -Maximum).Maximum + 1)
}

switch ($comando) {

  'lista' {
    Write-Host ""
    Write-Host "Worktrees de Gorros Wine" -ForegroundColor Cyan
    Write-Host ""

    Invoke-Git -C $repo worktree list | ForEach-Object {
      $ruta = ($_ -split '\s+')[0]
      $f = Join-Path $ruta '.worktree-port'
      $puerto = if (Test-Path $f) { (Get-Content $f -Raw).Trim() } else { '3000' }
      Write-Host ("  :{0}  {1}" -f $puerto, $_)
    }

    Write-Host ""
  }

  'nuevo' {
    if (-not $slug) { throw "Falta el slug. Ej: ./scripts/worktree.ps1 nuevo checkout-mp" }
    if ($slug -notmatch '^[a-z0-9][a-z0-9-]*$') {
      throw "El slug va en minúsculas con guiones: 'checkout-mp', no '$slug'."
    }

    $rama    = "$tipo/$slug"
    $destino = Join-Path $padre "$prefijo$slug"

    if (Test-Path $destino) { throw "Ya existe $destino." }

    Write-Host "`nTrayendo origin..." -ForegroundColor DarkGray
    Invoke-Git -C $repo fetch origin --quiet

    # La base es siempre origin/main. Nunca una rama de feature ajena: si esa
    # rama se rebasa o se descarta, este worktree queda colgado de la nada.
    $existe = Invoke-Git -C $repo rev-parse --verify --quiet "refs/heads/$rama"

    if ($existe) {
      Write-Host "La rama $rama ya existe: se engancha el worktree a esa rama." -ForegroundColor Yellow
      Invoke-Git -C $repo worktree add $destino $rama
    } else {
      Invoke-Git -C $repo worktree add -b $rama $destino origin/main
    }
    if ($LASTEXITCODE -ne 0) { throw "git worktree add falló." }

    $puerto = Get-PuertoLibre
    Write-TextoUtf8 -Ruta (Join-Path $destino '.worktree-port') -Texto "$puerto"

    # .env.local no está versionado, así que hay que copiarlo. El puerto del
    # sitio cambia; DATABASE_URL no, porque la base es compartida.
    $envOrigen = Join-Path $repo '.env.local'
    if (Test-Path $envOrigen) {
      $contenido = (Get-Content $envOrigen -Raw) -replace 'localhost:3000', "localhost:$puerto"
      Write-TextoUtf8 -Ruta (Join-Path $destino '.env.local') -Texto $contenido
      Write-Host "  .env.local copiado (sitio en :$puerto, base compartida)" -ForegroundColor DarkGray
    } else {
      Write-Host "  Ojo: no hay .env.local en el repo principal. Copialo a mano." -ForegroundColor Yellow
    }

    if (-not $sinInstalar) {
      Write-Host "`nInstalando dependencias (node_modules no se comparte entre worktrees)..." -ForegroundColor DarkGray
      Push-Location $destino
      try { Invoke-Nativo npm install } finally { Pop-Location }
      if ($LASTEXITCODE -ne 0) { throw "npm install falló en $destino." }
    }

    Write-Host ""
    Write-Host "Listo: $destino" -ForegroundColor Green
    Write-Host "  rama:   $rama (desde origin/main)"
    Write-Host "  puerto: $puerto"
    Write-Host ""
    Write-Host "  cd `"$destino`""
    if ($sinInstalar) { Write-Host "  npm install" }
    Write-Host "  npm run dev -- -p $puerto"
    Write-Host ""
  }

  'borrar' {
    if (-not $slug) { throw "Falta el slug. Ej: ./scripts/worktree.ps1 borrar checkout-mp" }

    $destino = Join-Path $padre "$prefijo$slug"
    if (-not (Test-Path $destino)) { throw "No existe $destino." }

    $rama = (Invoke-Git -C $destino rev-parse --abbrev-ref HEAD).Trim()

    # El marcador de puerto lo puso este script: se lo lleva antes de irse, o
    # git se niega a borrar el worktree por tener un archivo sin trackear.
    Remove-Item (Join-Path $destino '.worktree-port') -Force -ErrorAction SilentlyContinue

    # Sin --force a propósito: si quedó trabajo sin commitear, que falle y lo
    # vea la persona antes de perderlo.
    Invoke-Git -C $repo worktree remove $destino
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo borrar: hay cambios sin commitear en $destino. Revisalos primero."
    }

    Write-Host "Worktree borrado: $destino" -ForegroundColor Green

    if ($borrarRama) {
      # -d y no -D: sólo borra si ya está mergeada.
      Invoke-Git -C $repo branch -d $rama
      if ($LASTEXITCODE -ne 0) {
        Write-Host "La rama $rama no está mergeada en main: se deja como está." -ForegroundColor Yellow
      } else {
        Write-Host "Rama borrada: $rama" -ForegroundColor Green
      }
    } else {
      Write-Host "La rama $rama sigue existiendo. Para borrarla: -borrarRama" -ForegroundColor DarkGray
    }
  }
}
