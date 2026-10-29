@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ==================================================
echo PROOFLINE - G0 / G1 - Base real e integridad
 echo NO se modifican archivos de la aplicacion ni la BD
 echo ==================================================
where node >nul 2>nul
if errorlevel 1 (
 echo [ERROR] Node.js no disponible en PATH.
 pause
 exit /b 1
)
echo.
echo [G0] Captura local del codigo y verificacion SHA-256...
node scripts\proofline-g0.mjs --capture
if errorlevel 1 (
 echo [ERROR] G0 no ha podido crear una copia integra.
 pause
 exit /b 2
)
echo.
echo [G1] Diagnostico de integridad del codigo...
node scripts\proofline-g1.mjs
echo.
echo [G1] Inyeccion de errores en memoria, SIN tocar PostgreSQL...
node scripts\proofline-g1-faultlab.mjs
echo.
echo [G1] Comprobaciones de PostgreSQL SOLO LECTURA...
node scripts\proofline-g1-db-readonly.mjs
echo.
echo NOTA: falta respaldo de BD. Para ello ejecuta:
echo node scripts\proofline-g0-db.mjs --confirm-local-database
echo.
echo [EXPORT] Preparando ZIP de resultados sin codigo ni BD...
node scripts\proofline-g0-g1-export.mjs
echo Archivos de resultados: .runtime\g0 y .runtime\g1
pause
endlocal
