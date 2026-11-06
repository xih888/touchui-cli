# 从官方发行包准备固定运行时，在内存中完成下载和校验，不留下临时归档。
$ErrorActionPreference = 'Stop'
$runtimeDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'runtime'
$requiredFiles = @('node.exe', 'npm', 'npm.cmd', 'LICENSE', 'node_modules\npm\bin\npm-cli.js')
$missingFiles = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $runtimeDirectory $_)) })
if ($missingFiles.Count -eq 0) {
    Write-Output '固定版本运行时已准备，无需重复下载。'
    exit 0
}

Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.IO.Compression
$client = [Net.Http.HttpClient]::new()
$archiveName = 'node-v16.20.2-win-x64.zip'
$baseUrl = 'https://nodejs.org/dist/v16.20.2'
try {
    $archiveBytes = $client.GetByteArrayAsync("$baseUrl/$archiveName").GetAwaiter().GetResult()
    $checksums = $client.GetStringAsync("$baseUrl/SHASUMS256.txt").GetAwaiter().GetResult()
} finally {
    $client.Dispose()
}
$checksumLine = @($checksums -split [char]10 | Where-Object { ($_ -split '\s+')[-1] -eq $archiveName })
if ($checksumLine.Count -ne 1) { throw '官方校验清单中缺少指定运行时。' }
$expectedHash = ($checksumLine[0] -split '\s+')[0]
$sha256 = [Security.Cryptography.SHA256]::Create()
try {
    $actualHash = -join ($sha256.ComputeHash($archiveBytes) | ForEach-Object { $_.ToString('x2') })
} finally {
    $sha256.Dispose()
}
if ($actualHash -ne $expectedHash) { throw '运行时 SHA256 校验失败，未写入工具目录。' }

$stream = [IO.MemoryStream]::new($archiveBytes, $false)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Read)
$prefix = 'node-v16.20.2-win-x64/'
try {
    foreach ($entry in $archive.Entries) {
        if (-not $entry.FullName.StartsWith($prefix) -or $entry.FullName.EndsWith('/')) { continue }
        $relative = $entry.FullName.Substring($prefix.Length)
        if ($relative -notin @('node.exe', 'npm', 'npm.cmd', 'LICENSE') -and -not $relative.StartsWith('node_modules/npm/')) { continue }
        $destination = Join-Path $runtimeDirectory $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        $inputStream = $entry.Open()
        $outputStream = [IO.File]::Create($destination)
        try {
            $inputStream.CopyTo($outputStream)
        } finally {
            $outputStream.Dispose()
            $inputStream.Dispose()
        }
    }
} finally {
    $archive.Dispose()
    $stream.Dispose()
}
Write-Output '已从官方发行包准备 Node.js 16.20.2 和配套 npm。'
