@echo off
cd /d "%~dp0"
py -3 run_atlas.py --no-engine --open-browser
if errorlevel 1 pause
