$count = 0
$files = Get-ChildItem -Path "src" -Recurse -Include "*.ts", "*.tsx"

Write-Host "Checking for 'any' types in src/ directory..." -ForegroundColor Yellow

$results = @()

foreach ($file in $files) {
    if ($file.Name -eq "vite-env.d.ts") { continue }
    
    $content = Get-Content $file.FullName
    $lineNum = 0
    foreach ($line in $content) {
        $lineNum++
        if ($line -match ": any" -and $line -notmatch "eslint-disable") {
            $count++
            $results += [PSCustomObject]@{
                File = $file.Name
                Line = $lineNum
            }
        }
    }
}

Write-Host "Total explicit 'any' types found: $count" -ForegroundColor Red

if ($count -gt 0) {
    Write-Host "`nTop files with most 'any' usage:" -ForegroundColor Yellow
    $results | Group-Object File | Sort-Object Count -Descending | Select-Object -First 10 Name, Count | Format-Table -AutoSize
}
else {
    Write-Host "No 'any' types found! Great job!" -ForegroundColor Green
}
