Dim ws
Set ws = CreateObject("WScript.Shell")

' Start the server silently (no black CMD window)
ws.CurrentDirectory = "C:\Users\NITRO\Desktop\Vibe Coding\Finance"
ws.Run "node server.js", 0, False

' Open loading page with default browser immediately
ws.Run "explorer.exe ""C:\Users\NITRO\Desktop\Vibe Coding\Finance\loading.html"""
