$lines = Get-Content "data/matrix.txt" | Where-Object { $_.Trim() -ne "" -and -not $_.StartsWith("#") }
$header = $lines[0]
$rows = $lines | Select-Object -Skip 1
$seen = @{}
$dupes = @()
$kept = @()
foreach ($line in $rows) {
  $slug = ($line -split "\|")[1]
  if ($seen.ContainsKey($slug)) { $dupes += $slug; continue }
  $seen[$slug] = $true
  $kept += $line
}
function Count-Field($idx) {
  $m = @{}
  foreach ($line in $kept) {
    $v = ($line -split "\|")[$idx]
    if ($m.ContainsKey($v)) { $m[$v]++ } else { $m[$v] = 1 }
  }
  ($m.GetEnumerator() | ForEach-Object { $_.Key + ":" + $_.Value }) -join "  "
}
Write-Output "ShiftSpec data hygiene"
Write-Output ("total rows: " + $rows.Count)
Write-Output ("unique slugs: " + $seen.Count)
Write-Output ("duplicate slugs: " + $dupes.Count)
Write-Output ("category  " + (Count-Field 4))
Write-Output ("format    " + (Count-Field 14))
Write-Output ("wave      " + (Count-Field 11))
Write-Output ("status    " + (Count-Field 9))
if ($dupes.Count -gt 0) {
  Set-Content -Path "data/matrix.deduped.txt" -Value (@($header) + $kept) -Encoding UTF8
  Write-Output "Wrote data/matrix.deduped.txt — review it, then replace matrix.txt yourself. Source NOT overwritten."
} else {
  Write-Output "No duplicates — source file is clean. Nothing written."
}