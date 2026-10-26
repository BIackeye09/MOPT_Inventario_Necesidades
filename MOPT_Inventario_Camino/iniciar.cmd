@echo off
REM Acceso alternativo al mismo servidor Dart configurado para VS Code.
title MOPT - Inventario de Necesidades del Camino
cd /d "%~dp0"
where dart >nul 2>nul
if errorlevel 1 (
  echo No se encontro Dart en PATH.
  echo Si ya tienes Flutter, agrega su carpeta bin a PATH y reinicia VS Code.
  echo Consulta LEEME_PRIMERO.txt para seleccionar el SDK de Dart en VS Code.
  pause
  exit /b 1
)
dart herramientas\servir.dart
pause
