@echo off
cd /d "%~dp0"
py -3 -m pip install -r engine/requirements.txt
if errorlevel 1 goto fail
py -3 engine/scripts/download_kernels.py
if errorlevel 1 goto fail
py -3 engine/scripts/check_kernels.py
pause
exit /b
:fail
echo Setup failed. Read the error above; do not close this window before copying it.
pause
exit /b 1
