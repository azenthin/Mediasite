Param(
  [string]$dbPath = "prisma/dev.db"
)
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir = Join-Path -Path (Split-Path -Parent $MyInvocation.MyCommand.Path) -ChildPath "archives"
If (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$dest = Join-Path $outDir ("enhanced_music.$ts.db")
Copy-Item -Path $dbPath -Destination $dest -Force
Write-Output "Backed up $dbPath -> $dest"
