Write-Host "=== Fix Gradle Java Version ===" -ForegroundColor Cyan

# 1. Matar todos los procesos Java y Gradle
Write-Host "`n1. Deteniendo procesos Java y Gradle..." -ForegroundColor Yellow
Get-Process java -ErrorAction SilentlyContinue | ForEach-Object { $_.Kill() }
Set-Location android
./gradlew --stop 2>$null
Set-Location ..

# 2. Eliminar COMPLETAMENTE la carpeta .gradle
Write-Host "`n2. Eliminando cachés de Gradle..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$env:USERPROFILE\.gradle" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "android\.gradle" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "android\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "android\app\build" -ErrorAction SilentlyContinue

# 3. Crear gradle.properties GLOBAL con Java 21
Write-Host "`n3. Configurando Gradle global para Java 21..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.gradle" | Out-Null
@"
org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.6.7-hotspot
org.gradle.daemon=true
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
"@ | Out-File -FilePath "$env:USERPROFILE\.gradle\gradle.properties" -Encoding UTF8 -Force

# 4. Crear local.properties
Write-Host "`n4. Configurando Android SDK..." -ForegroundColor Yellow
@"
sdk.dir=C\:\\Users\\migue\\AppData\\Local\\Android\\Sdk
"@ | Out-File -FilePath "android\local.properties" -Encoding UTF8 -Force

# 5. Crear .vscode/settings.json
Write-Host "`n5. Configurando VS Code..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path ".vscode" | Out-Null
@"
{
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-21",
      "path": "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.6.7-hotspot",
      "default": true
    }
  ],
  "java.import.gradle.java.home": "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.6.7-hotspot",
  "java.jdt.ls.java.home": "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.6.7-hotspot"
}
"@ | Out-File -FilePath ".vscode\settings.json" -Encoding UTF8 -Force

# 6. Verificar Gradle desde CLI
Write-Host "`n6. Verificando Gradle..." -ForegroundColor Yellow
Set-Location android
$output = ./gradlew --version 2>&1 | Out-String
if ($output -match "21\.0\.") {
    Write-Host "`n✅ SUCCESS: Gradle está usando Java 21" -ForegroundColor Green
} else {
    Write-Host "`n❌ ERROR: Gradle NO está usando Java 21" -ForegroundColor Red
    Write-Host $output
}
Set-Location ..

Write-Host "`n=== IMPORTANTE ===" -ForegroundColor Cyan
Write-Host "1. CIERRA completamente VS Code (todas las ventanas)"
Write-Host "2. REINICIA tu computadora" -ForegroundColor Yellow
Write-Host "3. Abre VS Code de nuevo"
Write-Host "4. El error debería desaparecer`n"
