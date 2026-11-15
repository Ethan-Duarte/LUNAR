@echo off
cd /d "%~dp0"
py -3 run_atlas.py --self-test
pause
