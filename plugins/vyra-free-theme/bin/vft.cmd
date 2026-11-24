@echo off
rem Repo-local launcher for the vyra-free-theme CLI (the plugin installs its own
rem copy into %USERPROFILE%\.dsh\vyra-free-theme\bin\ at runtime).
node "%~dp0..\cli\vft.mjs" %*
