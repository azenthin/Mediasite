<#
Search-Songs script
Usage examples:
  # Exact title + artist match (recommended when you know both)
  .\scripts\search-songs.ps1 -Title "Let It Slide" -Artist "Ryder Crossie" -Exact

  # Partial match across title/artist/genres/tags
  .\scripts\search-songs.ps1 -Query "Let It Slide" -Limit 20

  # Search only title (case-insensitive, partial by default)
  .\scripts\search-songs.ps1 -Title "Let It Slide"

This script expects sqlite3.exe to be available in PATH. If not, update $sqliteExe to the full path to sqlite3.exe.
#>

param(
  [string]$Title,
  [string]$Artist,
  [string]$Query,
  [int]$Limit = 50,
  [switch]$Exact
)

# Determine DB path relative to the repo root (script sits in scripts/)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$db = Resolve-Path (Join-Path $scriptDir '..\enhanced_music.db') -ErrorAction SilentlyContinue
if (-not $db) {
  Write-Error "enhanced_music.db not found next to the repo root. Run this script from the repo or update the path. Expected at: $(Join-Path $scriptDir '..\enhanced_music.db')"
  exit 1
}
$db = $db.Path

# Path to sqlite3 executable (change if sqlite3 isn't on PATH)
$sqliteExe = 'sqlite3.exe'

# Helper to safely escape single quotes for sqlite CLI
function Escape-SqliteString([string]$s) {
  if ($null -eq $s) { return '' }
  return $s -replace "'", "''"
}

# Build SQL
$sqlWhere = "release_year IS NOT NULL"

if ($Title -or $Artist) {
  if ($Title) {
    $t = Escape-SqliteString($Title.ToLower())
    if ($Exact) {
      $sqlWhere += " AND LOWER(title) = '$t'"
    } else {
      $sqlWhere += " AND LOWER(title) LIKE '%$t%'"
    }
  }
  if ($Artist) {
    $a = Escape-SqliteString($Artist.ToLower())
    if ($Exact) {
      $sqlWhere += " AND LOWER(artist) = '$a'"
    } else {
      $sqlWhere += " AND LOWER(artist) LIKE '%$a%'"
    }
  }
} elseif ($Query) {
  $q = Escape-SqliteString($Query.ToLower())
  $sqlWhere += " AND (LOWER(title) LIKE '%$q%' OR LOWER(artist) LIKE '%$q%' OR LOWER(genres) LIKE '%$q%' OR LOWER(tags) LIKE '%$q%')"
} else {
  Write-Error "Please provide -Title/-Artist OR -Query"
  exit 1
}

# Select fields: year, genres, title, artist, popularity_score (helpful)
$sql = "SELECT release_year AS year, genres, title, artist, popularity_score FROM songs WHERE $sqlWhere ORDER BY CASE WHEN release_year >= 2015 THEN 0 ELSE 1 END, release_year DESC, popularity_score DESC LIMIT $Limit;"

# Run sqlite3 and format CSV output into objects
try {
  $raw = & $sqliteExe $db -header -csv $sql 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Error "sqlite3 failed: $raw"
    exit 1
  }

  if (-not $raw) {
    Write-Output "No rows returned."
    exit 0
  }

  $rows = $raw | ConvertFrom-Csv
  # Print a compact table
  $rows | Select-Object @{Name='Year';Expression={$_.year}}, @{Name='Genres';Expression={$_.genres}}, @{Name='Artist';Expression={$_.artist}}, @{Name='Title';Expression={$_.title}}, @{Name='Score';Expression={$_.popularity_score}} | Format-Table -AutoSize
} catch {
  Write-Error "Failed to run sqlite3: $_"
  exit 1
}
