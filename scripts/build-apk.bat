@echo off
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
set "ANDROID_HOME=C:\Users\patel\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo Syncing workspace to C:\SafeGuard-SOS...
robocopy "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\android\app\src" "C:\SafeGuard-SOS\android\app\src" /E /PURGE /NFL /NDL /NJH /NJS /nc /ns /np
robocopy "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\assets" "C:\SafeGuard-SOS\assets" /E /NFL /NDL /NJH /NJS /nc /ns /np

del /s /q "C:\SafeGuard-SOS\android\app\src\main\res\mipmap*\*.webp" 2>nul
del /s /q "c:\Users\patel\OneDrive\Desktop\programming\SafeGaurd SOS\android\app\src\main\res\mipmap*\*.webp" 2>nul

cd /d "C:\SafeGuard-SOS\android"
call gradlew.bat assembleDebug
pause

