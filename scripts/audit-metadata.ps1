<#
Audit enhanced_music.db for suspicious metadata entries.
Generates CSV files under scripts\output\:
  - future-years.csv         (release_year > current year)
  - very-old-years.csv       (release_year < 1950)
  - instrumental-or-karaoke.csv (title contains instrumental/karaoke/backing)
  - remix-or-edit-keywords.csv  (title contains remix/mix/edit/version/rework)
  - titles-with-parentheses.csv (titles containing parentheses — often contain remix info)
  - duplicate-titles.csv       (same title appears multiple times)

Usage:
  cd <repo-root>
  powershell -ExecutionPolicy Bypass -File .\scripts\audit-metadata.ps1

Requires sqlite3.exe available on PATH. If sqlite3.exe is not available, set $sqliteExe to the full path.
#>

# Config
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dbPath = Resolve-Path (Join-Path $scriptDir '..\enhanced_music.db') -ErrorAction SilentlyContinue
if (-not $dbPath) {
  Write-Error "enhanced_music.db not found next to the repo root. Expected at: $(Join-Path $scriptDir '..\enhanced_music.db')"
  exit 1
}
$db = $dbPath.Path
$outputDir = Join-Path $scriptDir 'output'
if (-not (Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir | Out-Null }

$sqliteExe = 'sqlite3.exe'  # change if needed

function Run-QuerySave($sql, $outFile, $description) {
  Write-Output "Running: $description -> $outFile"
  $cmdOutput = & $sqliteExe $db -header -csv $sql 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Error "sqlite3 failed for $description:`n$cmdOutput"
    return
  }
  if (-not $cmdOutput) {
    Write-Output "No rows for: $description"
    return
  }
  $fullPath = Join-Path $outputDir $outFile
  $cmdOutput | Out-File -FilePath $fullPath -Encoding utf8
  $count = ($cmdOutput | Select-String -Pattern '.+' | Measure-Object).Count - 1  # subtract header
  Write-Output "Saved $count rows to $fullPath"
}

$currentYear = (Get-Date).Year

# 1) Future years
$futureSql = "SELECT rowid as id, release_year AS year, title, artist, genres, popularity_score FROM songs WHERE release_year > $currentYear ORDER BY release_year DESC;"
Run-QuerySave $futureSql 'future-years.csv' "Future release_year > $currentYear"

# 2) Very old years (likely incorrect)
$veryOldSql = "SELECT rowid as id, release_year AS year, title, artist, genres, popularity_score FROM songs WHERE release_year < 1950 ORDER BY release_year ASC;"
Run-QuerySave $veryOldSql 'very-old-years.csv' "Very old years (<1950)"

# 3) Instrumental / karaoke / backing-track
$instrWhere = "LOWER(title) LIKE '%instrumental%' OR LOWER(title) LIKE '%karaoke%' OR LOWER(title) LIKE '%backing track%' OR LOWER(title) LIKE '%backing-track%' OR LOWER(title) LIKE '%orchestral version%'"
$instrSql = "SELECT rowid as id, release_year AS year, title, artist, genres, popularity_score FROM songs WHERE ($instrWhere) ORDER BY release_year DESC;"
Run-QuerySave $instrSql 'instrumental-or-karaoke.csv' "Instrumental/Karaoke/backing tracks"

# 4) Remix / edit / mix / version keywords
$remixWhere = "LOWER(title) LIKE '%remix%' OR LOWER(title) LIKE '%mix%' OR LOWER(title) LIKE '%edit%' OR LOWER(title) LIKE '%version%' OR LOWER(title) LIKE '%rework%'"
$remixSql = "SELECT rowid as id, release_year AS year, title, artist, genres, popularity_score FROM songs WHERE ($remixWhere) ORDER BY release_year DESC;"
Run-QuerySave $remixSql 'remix-or-edit-keywords.csv' "Remix/Edit/Mix/Version keywords"

# 5) Titles containing parentheses (common place for remix/extra metadata)
$parenSql = "SELECT rowid as id, release_year AS year, title, artist, genres, popularity_score FROM songs WHERE title LIKE '%(%' OR title LIKE '%)%' ORDER BY release_year DESC LIMIT 10000;"
Run-QuerySave $parenSql 'titles-with-parentheses.csv' "Titles with parentheses"

# 6) Duplicate titles (case-insensitive)
$dupSql = @"
SELECT lower(title) as title_norm, COUNT(*) as cnt, GROUP_CONCAT(rowid) as ids, GROUP_CONCAT(artist) as artists, GROUP_CONCAT(release_year) as years
FROM songs
WHERE title IS NOT NULL AND title != ''
GROUP BY title_norm
HAVING cnt > 1
ORDER BY cnt DESC
LIMIT 500;
"@
Run-QuerySave $dupSql 'duplicate-titles.csv' "Duplicate titles (case-insensitive)"

# 7) Titles where title contains another artist name inside parentheses (heuristic)
# This tries to surface cases like "Lucky (Jason Nevins Mixshow edit)" where the parentheses include another name
$parenthesisArtistSql = "SELECT rowid as id, release_year AS year, title, artist, genres, popularity_score FROM songs WHERE title LIKE '%(%' AND title LIKE '%\)%' AND LOWER(title) LIKE '%\_%' ESCAPE '\' LIMIT 500;"
# The above may not be precise; reuse the parentheses file for manual review instead.

Write-Output "Audit complete. CSV files written to: $outputDir"
Write-Output "Open those CSVs and inspect suspicious entries. If you want, I can implement an auto-verification pass using MusicBrainz or Spotify (requires API credentials for Spotify)."
