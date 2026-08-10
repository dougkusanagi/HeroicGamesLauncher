Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\dl_ag\dev\HeroicGamesLauncher"

command = "pnpm start"

If WScript.Arguments.Count > 0 Then
    arg = LCase(WScript.Arguments(0))
    If arg = "start" Or arg = "dev" Then
        command = "pnpm " & arg
    Else
        command = "pnpm " & WScript.Arguments(0)
    End If
End If

WshShell.Run "cmd.exe /c " & command, 0, False
