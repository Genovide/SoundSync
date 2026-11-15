param([Parameter(Mandatory=$true)][string]$Root,[string]$Source='')
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$metadata=Join-Path $PSScriptRoot '../build/windows-runtime-repair.json'
$spec=Get-Content -LiteralPath $metadata -Raw | ConvertFrom-Json
$packages=Join-Path $Root 'alignment/runtime/Lib/site-packages'
foreach($entry in $spec.files){
 $file=Join-Path $packages $entry.path
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw "Installer omitted required PyTorch file: $($entry.path)"}
 if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw "Installed PyTorch file differs: $($entry.path)"}
}
if($Source){
 $Source=[IO.Path]::GetFullPath($Source).TrimEnd('\')
 $prefix=$Source+'\'
 foreach($file in Get-ChildItem -LiteralPath $Source -File -Recurse){
  $relative=$file.FullName.Substring($prefix.Length)
  if(($relative -split '[\\/]')[0] -ieq 'Data'){continue}
  $installed=Join-Path $Root $relative
  if(!(Test-Path -LiteralPath $installed -PathType Leaf)){throw "Installer omitted: $relative"}
  if((Get-Item -LiteralPath $installed).Length -ne $file.Length){throw "Installed file size differs: $relative"}
 }
}
. (Join-Path $PSScriptRoot 'Update-Transaction.ps1')
Test-UpdateRuntime (Join-Path $Root 'alignment/runtime/python.exe')
Write-Host 'Installed EXE payload includes all PyTorch data modules; runtime imports and tensor operation passed'
