function Assert-InstallerArchive {
  param([string]$Path, [string]$InstallerName, [string]$ExpectedInstallerHash = '')
  $temp = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
  New-Item -ItemType Directory -Path $temp -Force | Out-Null
  $zip = $null
  try {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
    if ($zip.Entries.Count -ne 1 -or $zip.Entries[0].FullName -ne $InstallerName -or $zip.Entries[0].Length -lt 1MB) {
      throw 'Installer archive must contain exactly one Windows Setup.exe and no other files.'
    }
    $exe = Join-Path $temp $InstallerName
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($zip.Entries[0], $exe)
    $stream = [System.IO.File]::OpenRead($exe)
    try { if ($stream.ReadByte() -ne 77 -or $stream.ReadByte() -ne 90) { throw 'Invalid Windows executable.' } }
    finally { $stream.Dispose() }
    $installerHash = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($ExpectedInstallerHash -and $installerHash -ne $ExpectedInstallerHash.ToLowerInvariant()) {
      throw 'The installer changed while packaging.'
    }
    return [PSCustomObject]@{
      ZipSha256 = (Get-FileHash $Path -Algorithm SHA256).Hash.ToLowerInvariant()
      InstallerSha256 = $installerHash
      InstallerName = $InstallerName
    }
  } finally {
    if ($zip) { $zip.Dispose() }
    Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
  }
}
