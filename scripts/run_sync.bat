@echo off
cd /d D:\jhe\scanner-resi-paket\scanner-resi
"python" "D:\jhe\scanner-resi-paket\scanner-resi\scripts\desty_sync_cron.py" >> sync_log.txt 2>&1
