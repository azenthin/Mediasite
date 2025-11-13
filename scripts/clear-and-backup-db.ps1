# Backup and Clear Database Script
# Purpose: Create timestamped backup of existing database before clearing for re-ingestion

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dbPath = ".\prisma\dev.db"
$backupDir = ".\scripts\backups"
$backupPath = "$backupDir\pre_reingestion_backup_$timestamp.db"

Write-Host "=== Database Backup and Clear ===" -ForegroundColor Cyan
Write-Host ""

# Check if database exists
if (-not (Test-Path $dbPath)) {
    Write-Host "ERROR: Database file not found at $dbPath" -ForegroundColor Red
    exit 1
}

# Create backups directory if it doesn't exist
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Write-Host "Created backups directory: $backupDir" -ForegroundColor Green
}

# Get database size
$dbSize = (Get-Item $dbPath).Length
$dbSizeMB = [math]::Round($dbSize / 1MB, 2)
Write-Host "Current database size: $dbSizeMB MB ($dbSize bytes)" -ForegroundColor Yellow
Write-Host ""

# Count existing records
Write-Host "Counting existing records..." -ForegroundColor Cyan
$counts = @{}
$tables = @('Media', 'AIPlaylist', 'SongCache', 'VerifiedTrack', 'TrackIdentifier', 'SkippedTrack')

foreach ($table in $tables) {
    try {
        $count = (sqlite3 $dbPath "SELECT COUNT(*) FROM $table;" 2>$null)
        if ($LASTEXITCODE -eq 0) {
            $counts[$table] = $count
            Write-Host "  ${table}: $count records" -ForegroundColor White
        }
    } catch {
        Write-Host "  ${table}: Unable to count" -ForegroundColor DarkGray
    }
}
Write-Host ""

# Create backup
Write-Host "Creating backup: $backupPath" -ForegroundColor Cyan
Copy-Item -Path $dbPath -Destination $backupPath -Force

if (Test-Path $backupPath) {
    $backupSize = (Get-Item $backupPath).Length
    $backupSizeMB = [math]::Round($backupSize / 1MB, 2)
    Write-Host "Backup created successfully: $backupSizeMB MB" -ForegroundColor Green
} else {
    Write-Host "ERROR: Backup failed!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Confirm before clearing
Write-Host "WARNING: About to clear all data from the following tables:" -ForegroundColor Yellow
Write-Host "  - Media (old songs from Spotify search fallback)" -ForegroundColor Yellow
Write-Host "  - AIPlaylist" -ForegroundColor Yellow
Write-Host "  - SongCache" -ForegroundColor Yellow
Write-Host "  - VerifiedTrack" -ForegroundColor Yellow
Write-Host "  - TrackIdentifier" -ForegroundColor Yellow
Write-Host "  - SkippedTrack" -ForegroundColor Yellow
Write-Host ""
Write-Host "Backup location: $backupPath" -ForegroundColor Green
Write-Host ""

$confirmation = Read-Host "Type 'YES' to proceed with clearing the database"

if ($confirmation -ne 'YES') {
    Write-Host "Operation cancelled. Database unchanged." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Clearing database tables..." -ForegroundColor Cyan

# Clear tables (in order to respect foreign key constraints)
$clearSQL = @"
PRAGMA foreign_keys = OFF;
DELETE FROM TrackIdentifier;
DELETE FROM VerifiedTrack;
DELETE FROM SkippedTrack;
DELETE FROM PlaylistMedia;
DELETE FROM Playlist;
DELETE FROM AIPlaylist;
DELETE FROM SongCache;
DELETE FROM WatchHistory;
DELETE FROM CommentLike;
DELETE FROM Comment;
DELETE FROM CommentCount;
DELETE FROM Like;
DELETE FROM Subscription;
DELETE FROM Media;
DELETE FROM AnalyticsEvent;
-- Keep User table intact
PRAGMA foreign_keys = ON;
VACUUM;
"@

$clearSQL | sqlite3 $dbPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database cleared successfully!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to clear database" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Verifying cleared state..." -ForegroundColor Cyan

foreach ($table in $tables) {
    try {
        $count = (sqlite3 $dbPath "SELECT COUNT(*) FROM $table;" 2>$null)
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ${table}: $count records" -ForegroundColor White
        }
    } catch {
        Write-Host "  ${table}: Unable to count" -ForegroundColor DarkGray
    }
}

$newDbSize = (Get-Item $dbPath).Length
$newDbSizeMB = [math]::Round($newDbSize / 1MB, 2)
Write-Host ""
Write-Host "New database size: $newDbSizeMB MB (after VACUUM)" -ForegroundColor Green
Write-Host ""
Write-Host "=== Database Reset Complete ===" -ForegroundColor Green
Write-Host "Backup: $backupPath" -ForegroundColor Cyan
Write-Host "Ready for re-ingestion using the new pipeline!" -ForegroundColor Cyan
