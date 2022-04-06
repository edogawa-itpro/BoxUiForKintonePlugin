# KintoneRestVBA
## Overview
KintoneRest.cls は Excel から Kintone の Rest API を簡単に使う為のクラスです。  
(KintoneRest.cls is Excel VBA Support Class for Kintone Rest API)  
ADOに似た操作で Kintone のデータの取得、更新が行えます。  
## DEMO
|  |       A      |      B      | 
|--|--------------|-------------|
| 1|サブドメイン    | subdomain   |
| 2|ApplicationID |     123     |
| 3|UserName      | hogehoge    |
| 4|Password      | ******      |
```
Option Explicit
'
' Kintone レコード取得サンプル(アプリ単位)
'
'
Public Sub Kinレコード取得_サンプル_アプリ単位()

    Dim kinRest As KintoneRest
    Set kinRest = New KintoneRest
    
    Dim sheet As Worksheet
    Set sheet = ActiveSheet
    
    'Kintone 接続情報
    kinRest.SubDomain = sheet.Cells(1, 2)
    kinRest.appId = sheet.Cells(2, 2)
    kinRest.setAuth sheet.Cells(3, 2), sheet.Cells(4, 2)

    '検索実行 取得カラムを何も指定しないと全カラム取得します
    kinRest.executeQuery
    
    If kinRest.EOF Then
        MsgBox "データがありません"
        Exit Sub
    End If
    
    '新しいシートの作成
    Worksheets().Add After:=Worksheets(Worksheets.Count)
    Dim row As Long
    Dim col As Long
    row = 1
    col = 1
    
    'フィールドタイトル表示
    Dim name As Variant 
    For Each name In kinRest.RecordsetFieldNames
        ActiveSheet.Cells(row, col).value = name
        col = col + 1
    Next
    
    'レコード取得
    While Not kinRest.EOF
        row = row + 1
        col = 1
        For Each name In kinRest.RecordsetFieldNames
            Dim val As String
            val = kinRest.getRecordsetFieldValue(name)
            ActiveSheet.Cells(row, col).value = val
            col = col + 1
        Next
        kinRest.moveNext
    Wend
End Sub
```
## Features
- レコードの追加、更新、削除に対応しています。
- １回のAPI呼び出しでのKintoneの行数の制限を意識する必要がありません。
- サブテーブルの更新、プロセスの更新も一部可能です。
- アプリケーションコピーをサンプルに追加しました。
 
