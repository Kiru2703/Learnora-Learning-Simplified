@echo off
echo ================================================
echo   Learnora - AWS Sandbox Bedrock Server
echo ================================================
echo.
echo Paste your AWS Sandbox credentials:
echo (Copy from your sandbox console)
echo.

set /p AWS_ACCESS_KEY_ID="Access Key ID: "
set /p AWS_SECRET_ACCESS_KEY="Secret Access Key: "
set /p AWS_SESSION_TOKEN="Session Token: "
set AWS_DEFAULT_REGION=ap-southeast-2

echo.
echo Credentials set. Starting server...
echo.
python server.py
pause
