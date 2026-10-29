@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo PROOFLINE G0 - Copia de PostgreSQL LOCAL
 echo No modifica ni elimina datos. Necesita pg_dump y pg_restore instalados.
echo Se guardara en .runtime\g0 y NO se incluira en el ZIP de codigo.
set /p CONFIRM=Es esta TU base de datos LOCAL de desarrollo? Escribe RESPALDAR: 
if /I not "%CONFIRM%"=="RESPALDAR" (
 echo Cancelado. No se ha contactado con la base de datos.
 pause
 exit /b 0
)
node scripts\proofline-g0-db.mjs --confirm-local-database
node scripts\proofline-g0-g1-export.mjs
pause
endlocal
