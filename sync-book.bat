@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "SRC=%~1"
if "%SRC%"=="" set "SRC=%USERPROFILE%\Desktop\Ашик Кериб г1алг1ай ворд.docx"
if not exist "%SRC%" set "SRC=%USERPROFILE%\Desktop\Ашик-Кериб-инг-книга.doc"

if not exist "%SRC%" (
  echo.
  echo  Файл Word не найден.
  echo  Положите документ на рабочий стол или укажите путь:
  echo  sync-book.bat "C:\путь\к\книге.docx"
  echo.
  pause
  exit /b 1
)

if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"

echo.
echo  Обновление из: %SRC%
echo.

powershell -NoProfile -Command ^
  "$docPath='%SRC%'; $pdfPath='%~dp0books\skazki\ashik-kerib\ashik-kerib.pdf'; $outDoc='%~dp0books\skazki\ashik-kerib\ashik-kerib.doc';" ^
  "$w=New-Object -ComObject Word.Application; $w.Visible=$false;" ^
  "$d=$w.Documents.Open($docPath); $d.ExportAsFixedFormat($pdfPath,17); $d.SaveAs2($outDoc,0); $d.Close($false); $w.Quit();" ^
  "[System.Runtime.Interopservices.Marshal]::ReleaseComObject($w)|Out-Null; Write-Host 'Word OK'"

if errorlevel 1 (
  echo  Ошибка экспорта Word.
  pause
  exit /b 1
)

node scripts\attach-reader-images.js
if errorlevel 1 (
  echo  Ошибка картинок для читалки.
  pause
  exit /b 1
)

echo.
echo  Готово. Обновите читалку: Ctrl+F5
echo.
pause
