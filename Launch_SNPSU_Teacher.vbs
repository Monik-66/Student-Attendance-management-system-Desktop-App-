Set shell = CreateObject("WScript.Shell")
projectPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run Chr(34) & projectPath & "\Launch_SNPSU_Teacher.bat" & Chr(34), 0, False
