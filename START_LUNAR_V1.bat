@echo off
cd /d "%~dp0"
py -3 run_atlas.py --open-browser
if errorlevel 1 pause
