#Requires -Version 5.1
<#
 PROOFLINE | ARMAR Technologies
 Recolector seguro de codigo fuente para diagnostico tecnico.
 No instala paquetes, no arranca servicios, no modifica datos y no ejecuta migraciones.
 PowerShell 5.1+ en Windows. Ejecucion: doble clic en el .cmd de la raiz.
#>
param([Parameter(Mandatory=$true)][string]$Root)

$ErrorActionPreference = 'Stop'
$Root = $Root.Trim().Trim('"')
$rootResolved = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).ProviderPath.TrimEnd([char[]]@('\', '/'))
if (-not (Test-Path -LiteralPath (Join-Path $rootResolved 'package.json') -PathType Leaf)) {
    throw 'No se encuentra package.json en la raiz indicada.'
}
if (-not (Test-Path -LiteralPath (Join-Path $rootResolved 'apps\support') -PathType Container)) {
    throw 'No se encuentra apps/support en la raiz indicada.'
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$output = Join-Path $rootResolved ("PROOFLINE_ESTADO_REAL_{0}.zip" -f $timestamp)
if (Test-Path -LiteralPath $output) { throw "Ya existe el archivo de salida: $output" }

# Solo carpetas con fuentes, configuracion, pruebas, infraestructura y documentacion.
$includeDirs = @(
    'apps', 'services', 'packages', 'prisma', 'tests', 'scripts',
    'infra', 'infrastructure', 'docker', 'config', 'configs',
    'docs', 'migrations', '.github', '.vscode'
)
$excludeDirs = @(
    '.git', 'node_modules', '.next', '.nuxt', '.output', '.turbo', '.cache',
    '.pnpm-store', '.venv', 'venv', 'env', '__pycache__', '.pytest_cache',
    '.mypy_cache', 'coverage', 'dist', 'build', 'out', 'target', 'tmp', 'temp',
    'logs', '.logs', 'backups', 'backup', 'dumps', 'data', 'dbdata',
    '.runtime', 'runtime', '.local', '.private', 'secrets', 'credentials',
    'storage', 'uploads', 'uploaded', 'attachments', 'screenshots',
    'videos', 'recordings', 'results', 'test-results', 'playwright-report',
    'artifacts', '.idea', '.vs', 'vendor', 'site-packages'
)
$allowedExtensions = @(
    '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs',
    '.json', '.jsonc', '.yaml', '.yml', '.toml', '.prisma', '.py',
    '.html', '.css', '.scss', '.sass', '.md', '.mdx', '.txt', '.sql',
    '.sh', '.cmd', '.ps1', '.ini', '.properties', '.graphql', '.gql',
    '.svg', '.xml', '.conf', '.config', '.lock', '.tf', '.hcl', '.d.ts',
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'
)
$allowedSpecialNames = @(
    'Dockerfile', 'Makefile', 'LICENSE', 'Procfile', '.gitignore',
    '.dockerignore', '.gitattributes', '.editorconfig', 'Caddyfile',
    'pnpm-lock.yaml', 'pnpm-workspace.yaml'
)
# No exportar configuraciones de entorno ni secretos, incluso con extension permitida.
$blockedName = '^(\.env($|\.)|\.npmrc$|\.pypirc$|\.netrc$|id_rsa|id_ed25519|\.htpasswd$|.*\.(?:pem|key|p12|pfx|p8|p7b|keystore|jks|sqlite|sqlite3|db|bak|backup|log|zip|7z|rar|tar|gz|tgz|pdf|csv|xlsx|xls|docx|doc|pptx|mp4|mov|webm)$|.*(?:secret|credential|password|token)[^/\\]*\.(?:txt|json|yaml|yml|ini|conf)$)'
$assetExtensions = @('.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico')
$maxFileBytes = 8MB
$maxTotalBytes = 120MB
$maxFiles = 10000
$stats = [ordered]@{ skippedExcludedDir = 0; skippedTypeOrName = 0; skippedLarge = 0; skippedSensitive = 0; skippedUnreadable = 0 }

function Test-EligibleFile([System.IO.FileInfo]$File, [string]$Relative) {
    if ($File.Name -match $blockedName) { $stats.skippedTypeOrName++; return $false }
    if ($File.Length -gt $maxFileBytes) { $stats.skippedLarge++; return $false }
    if ($File.Name -notin $allowedSpecialNames -and $File.Extension.ToLowerInvariant() -notin $allowedExtensions) {
        $stats.skippedTypeOrName++; return $false
    }
    $extension = $File.Extension.ToLowerInvariant()
    if ($extension -in $assetExtensions -and $Relative -notmatch '(^|[\\/])(public|assets|static|images|icons)([\\/])') {
        $stats.skippedTypeOrName++; return $false
    }
    # No exportar .vscode/settings.json (puede contener rutas o variables locales).
    if ($Relative -match '^\.vscode[\\/]' -and $Relative -notmatch '^\.vscode[\\/]tasks\.json$') {
        $stats.skippedTypeOrName++; return $false
    }
    return $true
}

# Patrones de secretos de alta confianza; falsos positivos se omiten por prudencia.
$secretMarkers = @(
    '-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----',
    '(?i)\b(?:sk_live_[A-Za-z0-9]{12,}|sk_test_[A-Za-z0-9]{12,}|sk-[A-Za-z0-9_-]{24,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|ghs_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})\b',
    '(?i)\b(?:postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?):\/\/[^\s"''`]+:[^\s@"''`]+@',
    '(?im)^\s*(?:DATABASE_URL|DIRECT_URL|JWT_SECRET|AUTH_SECRET|STRIPE_SECRET_KEY|REDIS_PASSWORD|SMTP_PASSWORD|API_SECRET|API_KEY)\s*[:=]\s*["'']?[A-Za-z0-9+/_=.:-]{20,}'
)
function Test-MightContainSecret([System.IO.FileInfo]$File) {
    if ($File.Extension.ToLowerInvariant() -in $assetExtensions) { return $false }
    # Solo fuentes pequenias (<8 MB) que se incorporaran al ZIP.
    $body = [System.IO.File]::ReadAllText($File.FullName)
    foreach ($pattern in $secretMarkers) {
        if ([regex]::IsMatch($body, $pattern)) { return $true }
    }
    return $false
}

$allFiles = New-Object 'System.Collections.Generic.List[System.IO.FileInfo]'
$queue = New-Object 'System.Collections.Generic.Stack[string]'
foreach ($d in $includeDirs) {
    $dirPath = Join-Path $rootResolved $d
    if (Test-Path -LiteralPath $dirPath -PathType Container) { $queue.Push($dirPath) }
}
while ($queue.Count -gt 0) {
    $currentDir = $queue.Pop()
    try { $entries = @(Get-ChildItem -LiteralPath $currentDir -Force -ErrorAction Stop) }
    catch { $stats.skippedUnreadable++; continue }
    foreach ($entry in $entries) {
        if ($entry.PSIsContainer) {
            if ($entry.Name.ToLowerInvariant() -in $excludeDirs) { $stats.skippedExcludedDir++; continue }
            # Avoid junction/reparse-point loops and links to paths outside the project.
            if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { $stats.skippedExcludedDir++; continue }
            $queue.Push($entry.FullName)
        } elseif ($entry -is [System.IO.FileInfo]) {
            $allFiles.Add($entry)
        }
    }
}
# Agregar archivos de configuracion de la raiz, no carpetas adicionales.
foreach ($entry in @(Get-ChildItem -LiteralPath $rootResolved -File -Force -ErrorAction Stop)) {
    $allFiles.Add($entry)
}

$manifestEntries = New-Object System.Collections.ArrayList
$skippedSensitivePaths = New-Object System.Collections.ArrayList
$totalBytes = [long]0
$zip = $null
try {
    $zip = [System.IO.Compression.ZipFile]::Open($output, [System.IO.Compression.ZipArchiveMode]::Create)
    foreach ($f in @($allFiles | Sort-Object FullName -Unique)) {
        if ($manifestEntries.Count -ge $maxFiles) { throw "Limite de $maxFiles archivos alcanzado; no se generara un ZIP incompleto." }
        $relative = $f.FullName.Substring($rootResolved.Length).TrimStart([char[]]@('\', '/'))
        if (-not (Test-EligibleFile $f $relative)) { continue }
        if ($totalBytes + $f.Length -gt $maxTotalBytes) {
            throw 'Limite de 120 MB de fuentes alcanzado. Se detiene para no crear un snapshot parcial.'
        }
        try {
            if (Test-MightContainSecret $f) {
                $stats.skippedSensitive++
                [void]$skippedSensitivePaths.Add($relative.Replace('\','/'))
                continue
            }
            $sha = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            $relZip = $relative.Replace('\','/')
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $f.FullName, $relZip, [System.IO.Compression.CompressionLevel]::Optimal
            )
            [void]$manifestEntries.Add([ordered]@{ path = $relZip; bytes = $f.Length; sha256 = $sha })
            $totalBytes += $f.Length
        } catch {
            # Archivos bloqueados/modificados mientras se recopila: reportar sin copiarlos.
            $stats.skippedUnreadable++
        }
    }

    $gitSha = $null
    $gitDirtyCount = $null
    try {
        if (Get-Command git -ErrorAction SilentlyContinue) {
            $gitSha = (& git -C $rootResolved rev-parse HEAD 2>$null | Select-Object -First 1)
            $gitStatus = @(& git -C $rootResolved status --porcelain -uno 2>$null)
            $gitDirtyCount = $gitStatus.Count
        }
    } catch { }
    $nodeVersion = $null
    $pnpmVersion = $null
    try { if (Get-Command node -ErrorAction SilentlyContinue) { $nodeVersion = (& node --version 2>$null | Select-Object -First 1) } } catch { }
    try { if (Get-Command pnpm -ErrorAction SilentlyContinue) { $pnpmVersion = (& pnpm --version 2>$null | Select-Object -First 1) } } catch { }

    $manifest = [ordered]@{
        tool = 'PROOFLINE_RECOLECTOR_ESTADO_REAL_v2.1'
        generatedLocal = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
        scope = 'fuentes / configuracion / pruebas (sin dependencias ni datos de usuario)'
        filesCount = $manifestEntries.Count
        uncompressedBytes = $totalBytes
        node = $nodeVersion
        pnpm = $pnpmVersion
        gitHEAD = $gitSha
        gitModifiedCount = $gitDirtyCount
        excludedCounts = $stats
        excludedForPossibleSecrets = @($skippedSensitivePaths)
        files = @($manifestEntries.ToArray())
    }
    $manifestJson = ConvertTo-Json -InputObject $manifest -Depth 8
    $entry = $zip.CreateEntry('_CAPTURA_PROOFLINE/manifest.json', [System.IO.Compression.CompressionLevel]::Optimal)
    $writer = [System.IO.StreamWriter]::new($entry.Open(), [System.Text.UTF8Encoding]::new($false))
    try { $writer.Write($manifestJson) } finally { $writer.Dispose() }

    $readmeText = @'
PROOFLINE - Captura tecnica de codigo fuente

Este archivo fue generado localmente y no modifica el repositorio, su BD ni sus servicios.
Incluye fuentes y configuraciones (cuando existan), hash SHA-256 por archivo y
resumen del entorno en _CAPTURA_PROOFLINE/manifest.json.

Exclusiones: .env*, claves/certificados, archivos de datos, credenciales
con nombres reconocibles, node_modules, .next, .git, backups, runtime,
resultados de tests, archivos subidos y binarios no requeridos.
Los archivos con patrones sensibles se excluyen y sus rutas aparecen en manifest.json.

IMPORTANTE: Los filtros son defensivos, pero NO pueden garantizar la ausencia
absoluta de secretos pegados en codigo fuente o datos personales de ejemplo.
Revisa el contenido del ZIP antes de compartirlo.

El ZIP NO demuestra que el sistema completo funcione ni ejecuta test E2E.
'@
    $entry = $zip.CreateEntry('_CAPTURA_PROOFLINE/LEER_ANTES_DE_COMPARTIR.txt', [System.IO.Compression.CompressionLevel]::Optimal)
    $writer = [System.IO.StreamWriter]::new($entry.Open(), [System.Text.UTF8Encoding]::new($false))
    try { $writer.Write($readmeText) } finally { $writer.Dispose() }
} catch {
    if ($null -ne $zip) { $zip.Dispose(); $zip = $null }
    if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force -ErrorAction SilentlyContinue }
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($null -ne $zip) { $zip.Dispose() }
}

Write-Host ''
Write-Host '--------------------------------------------------------' -ForegroundColor DarkGray
Write-Host 'CAPTURA TERMINADA' -ForegroundColor Green
Write-Host ("Archivo: {0}" -f $output) -ForegroundColor Cyan
Write-Host ("Archivos: {0} | Tamano ZIP: {1:N2} MB" -f $manifestEntries.Count, ((Get-Item -LiteralPath $output).Length / 1MB))
Write-Host ("Omitidos por patrones sensibles: {0}" -f $stats.skippedSensitive)
Write-Host 'Abre el ZIP y revisa su contenido antes de subirlo al chat.' -ForegroundColor Yellow
Write-Host '--------------------------------------------------------' -ForegroundColor DarkGray
exit 0
