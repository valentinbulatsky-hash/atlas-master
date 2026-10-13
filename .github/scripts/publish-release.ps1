$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
. "$PSScriptRoot/installer-archive.ps1"

function Invoke-Gh {
  param([string[]]$Arguments)
  $output = & gh @Arguments
  if ($LASTEXITCODE -ne 0) { throw "GitHub command failed: $($Arguments[0..1] -join ' ')" }
  return $output
}

function Get-Release {
  param([string]$Tag)
  $json = & gh release view $Tag --repo $env:GITHUB_REPOSITORY --json tagName,isDraft,assets 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return ($json -join [Environment]::NewLine | ConvertFrom-Json)
}

function Get-ReleaseArchive {
  param([string]$Tag, [string]$Name, [string]$InstallerName)
  $dir = Join-Path $env:RUNNER_TEMP ([System.IO.Path]::GetRandomFileName())
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  Invoke-Gh -Arguments @('release','download',$Tag,'--repo',$env:GITHUB_REPOSITORY,'--pattern',$Name,'--dir',$dir) | Out-Host
  $file = Join-Path $dir $Name
  return Assert-InstallerArchive -Path $file -InstallerName $InstallerName
}

function Write-Notes {
  param([string]$Source, [string]$Destination, $Verification)
  $notes = Get-Content $Source -Raw
  $base = "https://github.com/$env:GITHUB_REPOSITORY/blob/$env:GITHUB_SHA"
  $notes = $notes.Replace('(README.md)',"($base/README.md)").Replace('(CHANGELOG.md)',"($base/CHANGELOG.md)")
  $notes += [Environment]::NewLine + [Environment]::NewLine + "**SHA-256 архива:** $($Verification.ZipSha256)" + [Environment]::NewLine
  $notes += [Environment]::NewLine + "**SHA-256 установщика:** $($Verification.InstallerSha256)" + [Environment]::NewLine
  $notes | Set-Content $Destination -Encoding utf8NoBOM
}

# Publish the checked current version. A published archive is never overwritten.
$version = $env:ATLAS_RELEASE_VERSION
$tag = $env:ATLAS_RELEASE_TAG
$archiveName = "AtlasMaster-$version-Windows-x64-Setup.zip"
$installerName = "AtlasMaster-$version-x64-Setup.exe"
$archive = Join-Path $env:ATLAS_RELEASE_ASSETS $archiveName
Assert-InstallerArchive -Path $archive -InstallerName $installerName | Out-Host
$current = Get-Release -Tag $tag
if (!$current) {
  Invoke-Gh -Arguments @('release','create',$tag,$archive,'--repo',$env:GITHUB_REPOSITORY,'--target',$env:GITHUB_SHA,'--title',"Атлас мастера $version — Windows",'--draft','--notes-file','RELEASES.md') | Out-Host
  $current = Get-Release -Tag $tag
}
if (!$current -or @($current.assets).Count -ne 1 -or $current.assets[0].name -ne $archiveName) {
  throw 'Current release must contain exactly the installer archive.'
}
$checked = Get-ReleaseArchive -Tag $tag -Name $archiveName -InstallerName $installerName
$notesPath = Join-Path $env:RUNNER_TEMP 'atlas-current-release.md'
Write-Notes -Source 'RELEASES.md' -Destination $notesPath -Verification $checked
Invoke-Gh -Arguments @('release','edit',$tag,'--repo',$env:GITHUB_REPOSITORY,'--draft=false','--latest','--notes-file',$notesPath) | Out-Host

# One-time migration explicitly requested for the first release.
# Its original installer is repackaged unchanged; old assets are removed only
# after the uploaded replacement has been downloaded and verified.
if ($version -eq '0.1.2') {
  $legacyTag = 'desktop-v0.1.1'
  $legacyZip = 'AtlasMaster-0.1.1-Windows-x64-Setup.zip'
  $legacyExe = 'AtlasMaster-0.1.1-x64-Setup.exe'
  $oldNames = @(
    'AtlasMaster-0.1.1-Source.zip',
    'AtlasMaster-0.1.1-Windows-x64.zip',
    'AtlasMaster-0.1.1-x64-Setup.exe',
    'AtlasMaster-Windows-Instructions.md',
    'SHA256SUMS.txt'
  )
  $legacy = Get-Release -Tag $legacyTag
  if (!$legacy) { throw 'First release not found.' }
  $unexpected = @($legacy.assets | Where-Object { $_.name -ne $legacyZip -and $_.name -notin $oldNames })
  if ($unexpected.Count) { throw 'First release has unexpected assets; preserving them and stopping.' }
  $expectedHash = ''
  if (!@($legacy.assets | Where-Object { $_.name -eq $legacyZip }).Count) {
    if (!@($legacy.assets | Where-Object { $_.name -eq $legacyExe }).Count) { throw 'Original first-release installer missing.' }
    $stage = Join-Path $env:RUNNER_TEMP 'atlas-first-installer'
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    Invoke-Gh -Arguments @('release','download',$legacyTag,'--repo',$env:GITHUB_REPOSITORY,'--pattern',$legacyExe,'--dir',$stage,'--clobber') | Out-Host
    $original = Join-Path $stage $legacyExe
    $expectedHash = (Get-FileHash $original -Algorithm SHA256).Hash.ToLowerInvariant()
    $replacement = Join-Path $stage $legacyZip
    Compress-Archive -Path $original -DestinationPath $replacement -CompressionLevel Optimal -Force
    Assert-InstallerArchive -Path $replacement -InstallerName $legacyExe -ExpectedInstallerHash $expectedHash | Out-Host
    Invoke-Gh -Arguments @('release','upload',$legacyTag,$replacement,'--repo',$env:GITHUB_REPOSITORY) | Out-Host
  }
  $legacyChecked = Get-ReleaseArchive -Tag $legacyTag -Name $legacyZip -InstallerName $legacyExe
  if ($expectedHash -and $legacyChecked.InstallerSha256 -ne $expectedHash) { throw 'Uploaded first-release installer differs from the original.' }
  $legacyNotes = Join-Path $env:RUNNER_TEMP 'atlas-first-release.md'
  Write-Notes -Source 'release-notes/0.1.1.md' -Destination $legacyNotes -Verification $legacyChecked
  Invoke-Gh -Arguments @('release','edit',$legacyTag,'--repo',$env:GITHUB_REPOSITORY,'--notes-file',$legacyNotes) | Out-Host
  $legacy = Get-Release -Tag $legacyTag
  foreach ($asset in $legacy.assets) {
    if ($asset.name -in $oldNames) {
      Invoke-Gh -Arguments @('release','delete-asset',$legacyTag,$asset.name,'--repo',$env:GITHUB_REPOSITORY,'--yes') | Out-Host
    }
  }
  $legacy = Get-Release -Tag $legacyTag
  if (@($legacy.assets).Count -ne 1 -or $legacy.assets[0].name -ne $legacyZip) { throw 'First-release packaging migration incomplete.' }
  Write-Output 'First release now contains only its verified installer ZIP.'
}
Write-Output "Published $tag with only its verified installer ZIP."
