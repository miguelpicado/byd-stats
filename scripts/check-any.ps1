# PowerShell script to detect and count files with 'any' types in the src directory

Write-Host "=== Archivos con tipo 'any' ===" -ForegroundColor Cyan

$srcPath = Join-Path $PSScriptRoot "..\src"
$anyFiles = Get-ChildItem -Path $srcPath -Include *.ts, *.tsx -Recurse | Select-String -Pattern ": any" -List

if ($anyFiles) {
    foreach ($fileMatch in $anyFiles) {
        $filePath = $fileMatch.Path
        $relativePath = Resolve-Path $filePath -Relative
        $count = (Get-Content $filePath | Select-String -Pattern ": any" -AllMatches).Count
        Write-Host "$($relativePath): $($count) ocurrencias"
    }

    Write-Host "`n=== Total ===" -ForegroundColor Cyan
    Write-Host "$($anyFiles.Count) archivos"
}
else {
    Write-Host "No se encontraron archivos con ': any'" -ForegroundColor Green
}
