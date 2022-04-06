VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "RestCommon"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
'
' KintoneRestVBA
' Copyright (c) 2019 edogawa-itpro
' MIT License - https://github.com/edogawa-itpro/KintoneRestVBA
'
Option Explicit
'条件付きコンパイル
#Const Release = 1 '0:「参照設定」を使ったインテリセンスを使う
#Const DebugLevel = 0

'
' REST API 共通クラス
'
'  インスタンスの作成方法
'    Dim comRest As RestCommon
'    Set comRest = new RestCommon
'
'    Dictionary.cls と JsonConverter.vba が別途必要(GitHub)
'

'■クラスの static 変数を定義
'  単純に読み書き可能にするなら Public
'  処理の整合を取りたいなら、Property で公開する
'
'  HTTP ヘッダー
'  固定ヘッダーを２種類用意する
'  可変のヘッダーは実行時にパラメータで渡しても良い
Private myHeaders As Dictionary 'アプリ固定のヘッダー
Private myAuthHeaders As Dictionary '認証に関わるヘッダー

Private httpReqStatus As Integer 'http リクエストの応答(最後の値)

'■プロパティー
'  {Set|Let}/Getを使う
'  オブジェクトなら Set 変数なら Let

'直近の http request status の取得
' 200なら通常OK
Public Property Get status() As Integer
    status = httpReqStatus
End Property


'■クラスのコンストラクタ
Private Sub Class_Initialize()
    '
End Sub

'■クラスのデストラクタ
Private Sub Class_Terminate()
    '
End Sub

'■メソッド
'値を返す場合は Function を使う

'httpヘッダーの追加
Public Sub AddHeader(key As String, value As String)
    If myHeaders Is Nothing Then
        Set myHeaders = New Dictionary
    End If
    myHeaders.Add key, value
End Sub

'httpヘッダークリア
Public Sub ClearHeaders()
    Set myHeaders = Nothing
End Sub

'Auth httpヘッダーの追加
Public Sub AddAuthHeader(key As String, value As String)
    If myAuthHeaders Is Nothing Then
        Set myAuthHeaders = New Dictionary
    End If
    myAuthHeaders.Add key, value
End Sub

'Auth httpヘッダークリア
Public Sub ClearAuthHeaders()
    Set myAuthHeaders = Nothing
End Sub

'
'■ Get実行(JSON)
' 引数のJSON はオブジェクト(Dictionary型)。
' JSON が不要なら execGet() を使う
' url エンコードが必要なら、事前に encodeurl(url) で変換しておく(Excel2013以降の標準関数)
' 普通は、rul パラメータだけを使う場合が多いが、JSON でも渡せるところもある(ex. Kintone)
Public Function ExecGetJson(url As String, objJson As Object) As String
    
    ExecGetJson = execMethodJson(url, "GET", objJson)

End Function

'
'■ POST 実行(JSON)
'   引数の JSON はオブジェクト
'
Public Function ExecPostJson(url As String, objJson As Object) As String
    
    ExecPostJson = execMethodJson(url, "POST", objJson)

End Function

'
'■ PUT 実行(JSON)
'   引数の JSON はオブジェクト
'
Public Function ExecPutJson(url As String, objJson As Object) As String
    
    ExecPutJson = execMethodJson(url, "PUT", objJson)
    
End Function

'
'■ DELETE 実行(JSON)
'   引数の JSON はオブジェクト
'
Public Function ExecDeleteJson(url As String, objJson As Object) As String
    
    ExecDeleteJson = execMethodJson(url, "DELETE", objJson)

End Function

'
'□ JSON 送信共通
'   引数の json はオブジェクト
'   http のレスポンス文字列を返す
'   POST/PUT/DELETEで共通
'
Private Function execMethodJson(url As String, method As String, objJson As Object) As String
    Dim strJson As String
    Dim resBody As String
    Dim headers As Dictionary
    
    Set headers = New Dictionary
    headers.Add "Content-Type", "application/json"
    'Jsonオブジェクトから文字列に変換
    strJson = ConvertToJson(objJson)
    resBody = http_request(url, method, headers, strJson)
    execMethodJson = resBody

End Function


'■ Put実行(非JSON)
'  余り使う事は無いだろう
Public Sub ExecPut(url As String)

    Call http_request(url, "PUT")

End Sub

'■ Delete実行(非JSON)
'  余り使う事は無いだろう
Public Sub ExecDelete(url As String)

    Call http_request(url, "DELETE")

End Sub

'■ Get実行(非JSON)
' url エンコードが必要なら、事前に encodeurl(url) で変換しておく(Excel2013以降の標準関数)
' JSON を渡す必要があるなら、execGetJson() を使う
'
Public Function ExecGet(url As String) As String
    Dim resBody As String
    
    resBody = http_request(url, "GET")
    ExecGet = resBody

End Function

'
' □ httpclient での http リクエスト
'  共通 header も設定
'  body 文字列を返す
Private Function http_request(url As String, method As String, Optional headers As Dictionary, Optional request As String) As String
#If Release = 1 Then
    Dim httpReq As Object    'XMLHTTP オブジェクト
#Else
    Dim httpReq As MSXML2.xmlhttp    'XMLHTTP オブジェクト
#End If
    Dim item As Variant
    Dim reqBody As String
    Dim resBody As String
    Dim i As Integer
    Dim key As String

    Set httpReq = CreateObject("MSXML2.XMLHTTP")
    httpReq.Open method, url, False

    '共通ヘッダー
    If Not (myHeaders Is Nothing) Then
        For i = 0 To myHeaders.Count - 1
            key = myHeaders.Keys(i)
            httpReq.setRequestHeader key, myHeaders(key)
        Next
    End If
    
    '認証ヘッダー
    If Not (myAuthHeaders Is Nothing) Then
        For i = 0 To myAuthHeaders.Count - 1
            key = myAuthHeaders.Keys(i)
            httpReq.setRequestHeader key, myAuthHeaders(key)
        Next
    End If
    
    '個別設定ヘッダー
    If Not (headers Is Nothing) Then
        For i = 0 To headers.Count - 1
            key = headers.Keys(i)
            httpReq.setRequestHeader key, headers(key)
        Next
    End If
    
    'リクエストbody
    If Not IsMissing(request) Then
        reqBody = request
    End If
    
    'リクエスト送信
    httpReq.send (reqBody)

    'レスポンス取得
    resBody = httpReq.responseText

    httpReqStatus = httpReq.status 'プロパティで参照可能にしておく
    If httpReq.status <> 200 Then
        ' エラーあり
    End If

    Set httpReq = Nothing
    
    http_request = resBody

End Function

'
' ■ Base64 エンコード
'    httpヘッダのパスワードのエンコードに使用
'    汎用的に使うには、バイナリからの変換も出来るように分けたほうが良い
'
Public Function EncodeBase64(str As String) As String
#If Release = 1 Then
    Dim doc As Object
    Dim elm As Object
#Else
    Dim doc As MSXML2.DOMDocument
    Dim elm As MSXML2.IXMLDOMElement
#End If
    Dim byteArray() As Byte
    Dim retStr As String
    
    byteArray = StrConv(str, vbFromUnicode)
    
    Set doc = CreateObject("MSXML2.DOMDocument")
    Set elm = doc.createElement("b64")

    elm.DataType = "bin.base64"
    elm.nodeTypedValue = byteArray
    retStr = elm.text

    Set elm = Nothing
    Set doc = Nothing
    
    '「改行」削除
    EncodeBase64 = Replace$(retStr, vbLf, "")
End Function


'
' ■ URL エンコード
'    Excel の標準関数をラップしているだけ
'
Public Function Encode_url(str As String) As String

    Encode_url = Application.WorksheetFunction.encodeUrl(str)
    
End Function


'■ キーをチェックした要素の値取得

' 高速だからDictionaryなので本末転倒なのだが、キーが無い場合のエラーが判り難いので
' あえてキーの存在をチェックしてから値を取得する方法を提供する。
' 速度を要しない場合に使う。
Public Function GetDictionaryValue(dic As Dictionary, key As Variant) As Variant
 
    Dim item As Variant
    For i = 0 To dic.Count - 1
        If key = dic.Keys(i) Then
            GetDictionaryValue = dic(key)
            Exit Function
        End If
    Next
    MsgBox "Dictionary にキー：" & key & "がありません！"
    getDictionarvValu = Nothing
End Function


