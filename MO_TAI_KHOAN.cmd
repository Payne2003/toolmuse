@echo off
rem Mo moi tai khoan Muse trong mot cua so trinh duyet rieng (ho so rieng).
rem Ban tu nhap email va ma 6 so tren trang Muse. Script khong doc hay nhap ma.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\mo-tai-khoan.ps1" %*
if errorlevel 1 pause
