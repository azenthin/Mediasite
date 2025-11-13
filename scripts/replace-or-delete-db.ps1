<#
replace-or-delete-db.ps1

Safely backup and either delete or replace the local `enhanced_music.db` database.

Usage examples:
  # Backup then delete the DB (interactive unless -Force)
  .\scripts\replace-or-delete-db.ps1 -Action delete

  # Backup then replace with an empty songs table (no data)
  .\scripts\replace-or-delete-db.ps1 -Action empty -Force

  # Backup and keep a copy but don't remove original (no action) - useful for testing
  .\scripts\replace-or-delete-db.ps1 -Action noop -Force

Actions:
  delete  - backup then permanently delete enhanced_music.db
  empty   - backup then replace enhanced_music.db with a fresh empty DB with a minimal songs table
  noop    - create a backup only (no deletion/replacement)

Important: This is destructive. A backup is always created in scripts/backups/ with a timestamp.
If you want me to also run a verification+reimport from Soundcharts/Jaxsta, say so separately.
#>

param(
  [ValidateSet('delete','empty','noop')] [string]$Action = 'noop',
  [switch]$Force
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$dbPath = Join-Path $repoRoot 'enhanced_music.db'

if (-not (Test-Path $dbPath)) {
  Write-Error "enhanced_music.db not found at expected location: $dbPath"
  exit 1
}

# Prepare backup
$backupDir = Join-Path $scriptDir 'backups'
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$backupPath = Join-Path $backupDir "enhanced_music.db.bak.$timestamp"
Write-Output "Backing up $dbPath → $backupPath"
Copy-Item -Path $dbPath -Destination $backupPath -Force

if (-not $Force) {
  $confirm = Read-Host "Backup created. Proceed with action '$Action'? Type YES to continue"
  if ($confirm -ne 'YES') {
    Write-Output "Aborted by user. Backup is at: $backupPath"
    exit 0
  }
}

# Perform action
switch ($Action) {
  'noop' {
    Write-Output "No changes performed. Backup saved at: $backupPath"
    exit 0
  }

  'delete' {
    try {
      Remove-Item -Path $dbPath -Force
      Write-Output "Deleted original DB. Backup remains at: $backupPath"
      exit 0
    } catch {
      Write-Error "Failed to delete DB: $_"
      exit 1
    }
  }

  'empty' {
    # Try to create a fresh sqlite DB with a minimal songs table
    $sqliteExe = 'sqlite3.exe'
    $createSql = "CREATE TABLE songs (id INTEGER PRIMARY KEY, title TEXT, artist TEXT, genres TEXT, moods TEXT, tags TEXT, release_year INTEGER, popularity_score REAL);"

    if (Get-Command $sqliteExe -ErrorAction SilentlyContinue) {
      try {
        # Remove original and create fresh
        Remove-Item -Path $dbPath -Force
        & $sqliteExe $dbPath $createSql
        if ($LASTEXITCODE -ne 0) {
          Write-Warning "sqlite3 reported an error creating the empty DB. Backup is safe at: $backupPath"
          exit 1
        }
        Write-Output "Replaced DB with an empty songs table. Backup: $backupPath"
        exit 0
      } catch {
        Write-Error "Failed to replace DB using sqlite3: $_. Backup is at: $backupPath"
        exit 1
      }
    } else {
      # sqlite3 not available — create an empty zero-byte file as fallback
      try {
        Remove-Item -Path $dbPath -Force
        New-Item -Path $dbPath -ItemType File | Out-Null
        Write-Warning "sqlite3.exe not found in PATH. Created empty file at $dbPath (not a valid SQLite DB). Backup is at: $backupPath"
        exit 0
      } catch {
        Write-Error "Failed to create empty DB file: $_"
        exit 1
      }
    }
  }
}
