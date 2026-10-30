# Builds MarkPad.apk without Gradle: tsc for the web app, aapt2 + javac + d8 for
# the Android shell, zip repack, zipalign and apksigner.
#
#   pwsh -File android\build.ps1
#
param(
    [string]$Sdk = "",
    [switch]$SkipWeb
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$android = Join-Path $root 'android'
if (-not $Sdk) { $Sdk = Join-Path (Split-Path -Parent $root) 'android-sdk' }
$sdk = $Sdk
$buildTools = Join-Path $sdk 'build-tools\34.0.0'
$platform = Join-Path $sdk 'platforms\android-34\android.jar'
$javaHome = 'D:\Environment\JDK\jdk-17.0.19'
$py = 'C:\Users\26702\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
$node = 'C:\Users\26702\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'

foreach ($tool in @('aapt2.exe', 'd8.bat', 'zipalign.exe', 'apksigner.bat')) {
    if (-not (Test-Path (Join-Path $buildTools $tool))) { throw "missing build tool: $tool" }
}
if (-not (Test-Path $platform)) { throw "missing android.jar: $platform" }

$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"
$javac = Join-Path $javaHome 'bin\javac.exe'
$keytool = Join-Path $javaHome 'bin\keytool.exe'

$out = Join-Path $android 'build'
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force -Path $out, (Join-Path $out 'gen'), (Join-Path $out 'classes'), (Join-Path $out 'dex'), (Join-Path $out 'assets') | Out-Null

if (-not $SkipWeb) {
    Write-Host '== web build'
    Push-Location $root
    & $node tools\build.mjs
    & $node node_modules\typescript\bin\tsc -p tsconfig.json
    if ($LASTEXITCODE -ne 0) { throw 'tsc failed' }
    & $node tools\rewrite-imports.mjs
    if ($LASTEXITCODE -ne 0) { throw 'import rewrite failed' }
    Pop-Location
}

Write-Host '== stage assets'
# aapt2 -A keeps the directory name, so assets end up as assets/www/...
Copy-Item -Path (Join-Path $root 'www') -Destination (Join-Path $out 'assets') -Recurse -Force

Write-Host '== aapt2 compile'
& (Join-Path $buildTools 'aapt2.exe') compile --dir (Join-Path $android 'res') -o (Join-Path $out 'res.zip')
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile failed' }

Write-Host '== aapt2 link'
& (Join-Path $buildTools 'aapt2.exe') link -o (Join-Path $out 'base.apk') `
    -I $platform `
    --manifest (Join-Path $android 'AndroidManifest.xml') `
    -A (Join-Path $out 'assets') `
    --java (Join-Path $out 'gen') `
    --min-sdk-version 24 `
    --target-sdk-version 34 `
    --no-version-vectors `
    (Join-Path $out 'res.zip')
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link failed' }

Write-Host '== javac'
$sources = @(Get-ChildItem -Path (Join-Path $android 'java'), (Join-Path $out 'gen') -Recurse -Filter *.java | ForEach-Object { $_.FullName })
& $javac -nowarn -encoding UTF-8 -source 11 -target 11 -classpath $platform -d (Join-Path $out 'classes') @sources
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }

Write-Host '== d8'
$classes = @(Get-ChildItem -Path (Join-Path $out 'classes') -Recurse -Filter *.class | ForEach-Object { $_.FullName })
& (Join-Path $buildTools 'd8.bat') --release --min-api 24 --lib $platform --output (Join-Path $out 'dex') @classes
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }

Write-Host '== pack'
& $py (Join-Path $root 'tools\pack.py') (Join-Path $out 'base.apk') (Join-Path $out 'dex\classes.dex') (Join-Path $out 'unsigned.apk')
if ($LASTEXITCODE -ne 0) { throw 'pack failed' }

Write-Host '== zipalign'
& (Join-Path $buildTools 'zipalign.exe') -f -p 4 (Join-Path $out 'unsigned.apk') (Join-Path $out 'aligned.apk')
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

$keystore = Join-Path $android 'debug.keystore'
if (-not (Test-Path $keystore)) {
    Write-Host '== keystore'
    & $keytool -genkeypair -v -keystore $keystore -storepass android -keypass android `
        -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 `
        -dname 'CN=MarkPad, O=MarkPad, C=CN'
    if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }
}

$apk = Join-Path $out 'MarkPad-1.1.0.apk'
Write-Host '== apksigner'
& (Join-Path $buildTools 'apksigner.bat') sign --ks $keystore --ks-pass pass:android `
    --key-pass pass:android --ks-key-alias androiddebugkey --out $apk (Join-Path $out 'aligned.apk')
if ($LASTEXITCODE -ne 0) { throw 'apksigner failed' }

& (Join-Path $buildTools 'apksigner.bat') verify --print-certs $apk
if ($LASTEXITCODE -ne 0) { throw 'apksigner verify failed' }

Write-Host '== badging'
& (Join-Path $buildTools 'aapt.exe') dump badging $apk | Select-Object -First 4

Write-Host ''
Write-Host ("APK: {0}  {1:N0} bytes" -f $apk, (Get-Item $apk).Length)
