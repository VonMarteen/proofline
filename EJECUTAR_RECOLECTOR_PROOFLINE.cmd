@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PROOFLINE - Recolector de estado real

echo.
echo ========================================================
echo   PROOFLINE - RECOLECTOR DE ESTADO REAL
 echo ========================================================
echo.
if not exist "package.json" (
    echo ERROR: Falta package.json. Extrae este ZIP en la carpeta RAIZ de PROOFLINE.
    echo Ejemplo: C:\Users\aruma\Desktop\PROOFLINE
    echo.
    pause
    exit /b 1
)
if not exist "apps\support" (
    echo ERROR: Falta apps\support. Comprueba que estas en la raiz del proyecto.
    echo.
    pause
    exit /b 1
)
if not exist "scripts\recolectar-estado-proofline.ps1" (
    echo ERROR: Falta scripts\recolectar-estado-proofline.ps1.
    echo Extrae el ZIP completo conservando las carpetas.
    echo.
    pause
    exit /b 1
)

echo Se recopilaran fuentes y configuracion, sin dependencias ni .env.
echo El ZIP de salida se creara en esta misma carpeta.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\recolectar-estado-proofline.ps1" -Root "."
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
    echo ERROR: El recolector no pudo completar la tarea. Codigo: %EXIT_CODE%
) else (
    echo Recoleccion finalizada correctamente.
)
echo.
pause
exit /b %EXIT_CODE%
