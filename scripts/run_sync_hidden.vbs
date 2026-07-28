' Run the original sync batch file hidden (no cmd window)
Set WshShell = CreateObject("Wscript.Shell")
WshShell.Run "cmd /c ""D:\jhe\scanner-resi-paket\scanner-resi\scripts\run_sync.bat""", 0, True
