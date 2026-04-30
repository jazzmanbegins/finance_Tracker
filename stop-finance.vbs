Dim ws
Set ws = CreateObject("WScript.Shell")

' Kill all node processes (stops the Finance Tracker server)
ws.Run "taskkill /F /IM node.exe", 0, True

MsgBox "Finance Tracker หยุดทำงานแล้ว", 64, "Finance Tracker"
