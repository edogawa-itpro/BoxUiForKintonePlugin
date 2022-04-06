VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "KintoneRest"
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
' Kintone REST API サポートクラス
'
' VBA の ADO を模した Kintone のデータ取得、更新をサポートするクラスです。
' 操作するKintoneアプリケーションごとにインスタンス化して利用します。
'
'   本クラスを使うには以下のクラスとVBAが必要です
'     ・Dictionary.cls   --- GitHub
'     ・JsonConverter.bas  --- GitHub
'     ・RestCommon.cls  --- 同封
'
' VBA では本来の「継承」が出来ないので
' REST API 共通処理は(RestCommonクラス)をコンストラクタでインスタンス化して使っています。
'
' 検索処理は、ADO の Recordset を操作する方法を模しています。
' ただし、クラスを細分化していないので、全く同じにはなっていません。
'
' 更新処理は、処理ごとにレコードバッファを分けました(追加・変更・削除)
' ADO の様な Statement の考え方もありません
' 更新の１件／一括処理の区別は、BeginUpdateBatch()でモード分けしています。
'
' 【制限事項】
'
' ・認証はパスワード認証とAPIトークンのみをサポートします。(BASIC認証は未サポート)
' ・Kintone の仕様上１回の呼び出しの最大のレコード件数が決められています。今後変更される可能性もあります。
' ・Kintone の offset は１万件までに制限される予定です。
' ・  以下の条件の場合に限って制限無くレコードを取得できるとアナウンスされています
'     "order by $id asc" と "$id > 最後のレコードID" を加える
' ・Revision の指定は厳密ではなくほとんどの箇所で省略しています。(今のところRevisionを指定する場面が想定できていません)
' ・サブテーブルの操作は現時点では限定的ですが、実務的にはそれほど不都合ではないと思います。
' ・Request API は複数のアプリに跨るので実装しません。
'
'◆クラス内のグローバル変数を定義 ◆
'
' ◆ 定数
'
' 初期値は、"Private Const" は可能。("Public Const" は言語仕様上不可)
' 外に見せるには "Proparty" にする。
'
' エラー処理用
'
'   Err.Raise エラー番号, オブジェクト名, エラーメッセージ
'
Private Const USER_ERROR_EXIT As Long = 1000
Private Const USER_ERROR_EXIT_MSG As String = "エラーが発生したので中断します"

'
' Kintone の上限設定値
Private Const KIN_MAX_INSERT As Long = 100
Private Const KIN_MAX_UPDATE As Long = 100
Private Const KIN_MAX_DELETE As Long = 100
Private Const KIN_MAX_PROCESS As Long = 100
Private Const KIN_MAX_LIMIT As Long = 500
Private Const KIN_MAX_REQUEST As Long = 20 '未サポート

'Kintone API URL
Private Const KIN_API_RECORD As String = "/k/v1/record.json"
Private Const KIN_API_RECORDS As String = "/k/v1/records.json"
Private Const KIN_API_BULKREQUEST As String = "/k/v1/bulkRequest.json"
Private Const KIN_API_FORM_FIELDS As String = "/k/v1/preview/app/form/fields.json"
Private Const KIN_API_RECORD_STATUS As String = "/k/v1/record/status.json"
Private Const KIN_API_RECORDS_STATUS As String = "/k/v1/records/status.json"

Private Const KIN_API_APP_SETTINGS As String = "/k/v1/app/settings.json"
Private Const KIN_API_APP_VIEWS As String = "/k/v1/app/views.json"
Private Const KIN_API_APP_LAYOUT As String = "/k/v1/app/form/layout.json"
Private Const KIN_API_APP_STATUS As String = "/k/v1/app/status.json"
Private Const KIN_API_APP_CUSTOMIZE As String = "/k/v1/app/customize.json"

Private Const KIN_API_PREVIEW_APP As String = "/k/v1/preview/app.json"
Private Const KIN_API_PREVIEW_DEPLOY As String = "/k/v1/preview/app/deploy.json"
Private Const KIN_API_PREVIEW_SETTINGS As String = "/k/v1/preview/app/settings.json"
Private Const KIN_API_PREVIEW_FORM_FIELDS As String = "/k/v1/preview/app/form/fields.json"
Private Const KIN_API_PREVIEW_LAYOUT As String = "/k/v1/preview/app/form/layout.json"
Private Const KIN_API_PREVIEW_VIEW As String = "/k/v1/preview/app/views.json"
Private Const KIN_API_PREVIEW_STATUS As String = "/k/v1/preview/app/status.json"
Private Const KIN_API_PREVIEW_CUSTOMIZE As String = "/k/v1/preview/app/customize.json"

'KintoneのJSON内の属性名
Private Const KIN_JSON_ATTR_APP As String = "app"
Private Const KIN_JSON_ATTR_APPS As String = "apps"
Private Const KIN_JSON_ATTR_NAME As String = "name"
Private Const KIN_JSON_ATTR_TYPE As String = "type"
Private Const KIN_JSON_ATTR_FIELD As String = "field"
Private Const KIN_JSON_ATTR_VALUE As String = "value"
Private Const KIN_JSON_ATTR_CODE As String = "code"
Private Const KIN_JSON_ATTR_RECORD As String = "record"
Private Const KIN_JSON_ATTR_RECORDS As String = "records"
Private Const KIN_JSON_ATTR_IDS As String = "ids"
Private Const KIN_JSON_ATTR_REVISION As String = "revision"
Private Const KIN_JSON_ATTR_REVISIONS As String = "revisions"
Private Const KIN_JSON_ATTR_UPDATEKEY As String = "updateKey"
Private Const KIN_JSON_ATTR_PROPERTIES = "properties"
Private Const KIN_JSON_ATTR_REQUESTS As String = "requests"
Private Const KIN_JSON_ATTR_MESSAGE As String = "message"
Private Const KIN_JSON_ATTR_ID As String = "id"
Private Const KIN_JSON_ATTR_ACTION As String = "action"
Private Const KIN_JSON_ATTR_ASSIGNEE As String = "assignee"
Private Const KIN_JSON_ATTR_FIELDS As String = "fields"
Private Const KIN_JSON_ATTR_LOOKUP As String = "lookup"
Private Const KIN_JSON_ATTR_RELATEDAPP As String = "relatedApp"
Private Const KIN_JSON_ATTR_REFERENCE As String = "referenceTable"

'Kintoneのフィールド型
Private Const KIN_FIELD_TYPE_RECORD_NUMBER As String = "RECORD_NUMBER"
Private Const KIN_FIELD_TYPE_MODIFIER As String = "MODIFIER"
Private Const KIN_FIELD_TYPE_CREATOR As String = "CREATOR"
Private Const KIN_FIELD_TYPE_NUMBER As String = "NUMBER"
Private Const KIN_FIELD_TYPE_DATE As String = "DATE"
Private Const KIN_FIELD_TYPE_DATETIME As String = "DATETIME"
Private Const KIN_FIELD_TYPE_ID As String = "__ID__"
Private Const KIN_FIELD_TYPE_REVISION As String = "__REVISION__"
Private Const KIN_FIELD_TYPE_USER_SELECT As String = "USER_SELECT"
Private Const KIN_FIELD_TYPE_STATUS_ASSIGNEE As String = "STATUS_ASSIGNEE"
Private Const KIN_FIELD_TYPE_SUBTABLE As String = "SUBTABLE"
Private Const KIN_FIELD_TYPE_FILE As String = "FILE"
Private Const KIN_FIELD_TYPE_RICH_TEXT As String = "RICH_TEXT"
Private Const KIN_FIELD_TYPE_RADIO_BUTTON As String = "RADIO_BUTTON"
Private Const KIN_FIELD_TYPE_CHECK_BOX As String = "CHECK_BOX"
Private Const KIN_FIELD_TYPE_REFERENCE_TABLE As String = "REFERENCE_TABLE"

 
'Kintoneの標準フィールド
Private Const KIN_FIELD_RECORDID = "$id"

'Kintone のドメイン(固定にしときます)
Private Const KINTONE_DOMAIN As String = "cybozu.com"

'
' ◆ 変数
'
' クラス内共通変数
'
Private comRest As restCommon 'REST実行の親クラス

Private kinSubDomain As String 'プロパティ項目
Private kinUser As String 'Kintone のユーザーID
Private kinPass As String 'Kintone のパスワード
Private kinAppId As String 'Kintone の操作するアプリケーションID
Private kinApiToken As String 'Kintone の API トークン

Private kinFieldInfo As Dictionary 'Kintone側のフィールドカタログ(フォーム情報)QUERYでは取得できなカラムも含まれるので注意
                                   '細かい型情報があるので１回だけ取得する

'レコード取得用
Private kinQueryFields As Collection '取得 field を選択する場合
Private kinRecordsetLimit As Long 'MAX 500
Private kinRecordsetManualLimit As Boolean '明示された場合 True
Private kinRecordsetOffset As Long 'Skipする(した)レコード数
Private kinRecordsetKeyField As String '検索キーフィールド(order by 指定を作る)
Private kinRecordsetUseOffset As Boolean 'UseRecordId とは排他
Private kinRecordsetUseRecordId As Boolean 'UseOffset とは排他
Private kinRecordsetLastRecordId As Long 'UseRecordId 時の最終ID値
Private kinRecordsetQuery As String 'query 条件(limit と offset は除く)
Private kinRecordsetQueryFields As Collection 'field を選択する場合($id追加あり)
Private kinRecordsetJson As Dictionary 'API取得そのまま
Private kinRecordsetRecords As Collection '上記の参照
Private kinRecordsetCount As Long '上記の取得レコード数
Private kinRecordsetCountAll As Long '継続した処理レコード数
Private kinRecordsetCursorPos As Long 'カーソル操作用
Private kinRecordsetFields As Collection '取得フィールド情報("name","type"：１レコードも無いと取れない・・・)
Private kinRecordsetFieldNames As Collection '取得フィールド情報(操作し易いように"name"だけ：１レコードも無いと取れない・・・)
Private kinRecordsetFieldCount As Long '取得フィールド数(１レコードも無いと取れない・・・)
Private kinRecordsetEof As Boolean '現状は、moveNext しないと判らない仕様

'更新系の変数
'
'一括レコード登録用
Private isUseBatch As Boolean '"True" なら一括処理
Private kinInsertRecords As Collection ' {"records" : [...]} の [...] 部分
Private kinDeleteRecords As Collection ' {"ids" : [...], "revision ]" の [...] 部分。 revision をどうしよう・・・
Private kinUpdateRecords As Collection ' {"records" : [ "updatekey": {...},"record" : {...} ] の [] 内の部分

'更新操作用レコード {"record" : {...}} の {...} 部分
'  フィールド情報は不要か？(自分でコレクション管理すれば済むので)

'  insert 用
Private kinInsertFields As Collection 'フィールド情報
Private kinInsertFieldValues As Dictionary '１行データ格納用 {"fieldname":{"value":...},...}

'  update 用
Private kinUpdateFields As Collection 'フィールド情報
Private kinUpdateFieldValues As Dictionary '１行データ格納用 {"fieldname":{"value":...},...}

'サブテーブル内レコード用のバッファ
'  サブテーブルごとに持つ
'  addInsertSubTableRecord/addUpdateSubTableRecord() でサブテーブルへの行追加とクリアがされる
'  サブテーブルIDごとに持つ必要性は少ないが、値を設定する際にフィールド型の特定が必要なので別々に持たせた。
'  Dictionary {
'     "subTable1" : {"field1":{"value":123},"field2":...} レコードオブジェクト(Dictionary)
'    ,"subTable2" : {"field1":{"value":123},"field2":...} レコードオブジェクト(Dictionary)
'        ：
Private kinSubTableFieldValues As Dictionary

'プロセス管理用
Private kinProcessRecords As Collection
Private kinProcessCount As Long

'複数アプリ実行用
' ToDo 現状機能していません
Private kinBulk As Dictionary
Private kinRequests As Collection
Private kinRequest As Dictionary

'日付時刻設定用の項目
Private excelJstTimeZone As String '"+09:00"等

'
'◆ プロパティー ◆
'
'   アクセスを細かくコントロールしたいなら {Set|Let}/Getを使う
'   オブジェクトなら Set 変数なら Let

'■ サブドメイン(Get/Let)
Public Property Get SubDomain() As String
    SubDomain = kinSubDomain
End Property

Public Property Let SubDomain(SubDomain As String)
    kinSubDomain = SubDomain
End Property

'■ アプリケーションID(Get/Let)
Public Property Get appId() As String
    appId = kinAppId
End Property

Public Property Let appId(appricationId As String)
    kinAppId = appricationId
    Set kinQueryFields = New Collection
    Set kinRecordsetQueryFields = New Collection
    Set kinInsertFields = New Collection
    Set kinUpdateFields = New Collection
End Property

'検索用レコードセットフィールド(Get)
'  addQueryField()で追加したもの。
'  結果のフィールドリストとは異なるので注意。
'  例えば、何も指定しないと結果には参照可能な全フィールドが取得される。
'  また、"$id" はこのクラスでは指定されていなくても取得する
'  (500件以上のレコードを継続して取得していく為に必要なので)
Public Property Get QueryFields() As Collection
    Set QueryFields = kinQueryFields
End Property

Public Property Get UpdateFields() As Collection
    Set UpdateFields = kinUpdateFields
End Property

'■ キーの指定(Grt/Let)
' 指定すると、キー順に検索する(order by / offset も自動で使用する )
Public Property Let RecordsetKeyField(name As String)
    kinRecordsetKeyField = name
    If name > "" Then
        kinRecordsetUseOffset = True
    Else
        kinRecordsetUseOffset = False
    End If
End Property

Public Property Get RecoedsetKeyField() As String
    RecoedsetKeyField = kinRecordsetKeyField
End Property

'■ アプリの項目(Get)
Public Property Get AppFields() As Collection
    Dim fields As Collection
    Dim properties As Dictionary
    If kinFieldInfo Is Nothing Then
        Set kinFieldInfo = getFieldInfo
    End If
    Set fields = New Collection
    Set properties = kinFieldInfo(KIN_JSON_ATTR_PROPERTIES)
    Dim i As Integer
    For i = 0 To properties.Count - 1
        fields.Add properties.Keys(i)
    Next
    Set AppFields = fields
End Property

'
'■ レコードセット結果フィールド(Get)
'
Public Property Get RecordsetFieldNames() As Collection
    If (Not (kinRecordsetQueryFields Is Nothing)) And (kinRecordsetQueryFields.Count > 0) Then
        Set RecordsetFieldNames = kinRecordsetQueryFields
    Else
        Set RecordsetFieldNames = kinRecordsetFieldNames
    End If
End Property


'■ EOF
Public Property Get EOF() As Boolean
    EOF = kinRecordsetEof
End Property

' "$id" の取得
Public Property Get RECORDID_FIELD() As String
    RECORDID_FIELD = KIN_FIELD_RECORDID
End Property

' JST時刻変換用の時間 ex. "+09:00"
Public Property Let JstTimeZone(offsetTime As String)
    excelJstTimeZone = offsetTime
End Property

Public Property Get JstTimeZone() As String
    JstTimeZone = excelJstTimeZone
End Property

'
'◆ クラスのコンストラクタとデストラクタ ◆
'
' コンストラクタ
Private Sub Class_Initialize()
        
    kinRecordsetLimit = KIN_MAX_LIMIT
    kinRecordsetManualLimit = False
    
    '親クラスのインスタンス化
    Set comRest = New restCommon
    
    
    'オブジェクトの初期化
    Set kinBulk = New Dictionary 'BulkRequest の用意(未使用)
    Set kinRequests = New Collection
    Set kinQueryFields = New Collection
    Set kinRecordsetQueryFields = New Collection
    Set kinRecordsetFields = New Collection
    Set kinRecordsetFieldNames = New Collection
    Set kinInsertFields = New Collection
    Set kinInsertFieldValues = New Dictionary
    Set kinUpdateFields = New Collection
    Set kinUpdateFieldValues = New Dictionary
    kinBulk.Add KIN_JSON_ATTR_REQUESTS, kinRequests
    isUseBatch = False
    excelJstTimeZone = "+09:00"

End Sub

' デストラクタ
Private Sub Class_Terminate()
    'リソースの明示的な破棄が必要なら追加する
End Sub

'◆ メソッド ◆
'
'   値を返す場合は Function を使う
'
'
'■ ユーザー認証情報
' add じゃないような・・・setのほうが良いかな(廃止予定)
Public Sub AddAuth(user As String, pass As String)
    SetAuth user, pass
End Sub

Public Sub SetAuth(user As String, pass As String)
   
    kinUser = user
    kinPass = pass
    comRest.ClearAuthHeaders
    comRest.AddAuthHeader "X-Cybozu-Authorization", comRest.EncodeBase64(user & ":" & pass)

End Sub

'■ APIトークンの設定
Public Sub SetApiToken(token As String)
   
    kinApiToken = token
    comRest.ClearAuthHeaders
    comRest.AddAuthHeader "X-Cybozu-API-Token", kinApiToken

End Sub


'
'■ 追加操作用フィールド名の登録(使用しない)
'
'   使うなら、プロパティでCollectionを公開する事。
'   更新レコードの値設定を番号(1,2,3...)で行う際に利用したかったもの
'   アプリ側で項目管理すれば済むので、冗長か？
'
'   Variant にしているのは、"For Each" 操作内で使いたい為
'   通常は１フィールド。","区切りで複数可能にもしている。
Public Sub AddInsertField(name As Variant)
    Dim names As Variant
    names = Split(name, ",")
    
    Dim i As Long
    For i = 0 To UBound(names)
        kinInsertFields.Add names(i)
    Next i

End Sub

'
'■ 更新操作用フィールド名の登録(使用しない)
'
'   更新レコードの値設定を番号(1,2,3...)で行う際に利用する
'     必須ではない
'
Public Sub AddUpdateField(fieldName As Variant)
    Dim names As Variant
    names = Split(fieldName, ",")
   
    Dim i As Long
    For i = 0 To UBound(names)
        kinUpdateFields.Add names(i)
    Next i

End Sub

'■ 追加操作用フィールドのクリア(使用しない)
Public Sub ClearInsertFileds()
   
    Set kinInsertFields = New Collection

End Sub

'■ 更新操作用フィールドのクリア(使用しない)
Public Sub ClearUpdateFileds()
   
    Set kinUpdateFields = New Collection

End Sub

'■ 追加操作用レコードにフィールドの値を設定(使用しない)
'   名前ではなくあえて番号(1～) addInsertField() した順番
Public Sub AddInsertFieldValueByNo(no_1 As Long, value As Variant)
    Dim fldName As String
    Dim objValue As Dictionary
    'Todo 範囲チェック
    fldName = kinInsertFields(no_1) 'フィールド名
    Set objValue = getFieldValueObj(fldName, value)
    kinInsertFieldValues.Add fldName, objValue
    
End Sub

'■ 追加操作用レコードにフィールドの値を設定
Public Sub AddInsertFieldValue(fieldName As Variant, value As Variant)
    
    If VarType(fieldName) = vbInteger Or VarType(fieldName) = vbLong Then '旧互換
        Dim fieldNo As Long
        fieldNo = fieldName
        AddInsertFieldValueByNo fieldNo, value
        Exit Sub
    End If
    
    Dim objValue As Dictionary
    Dim name As String
    name = fieldName
    Set objValue = getFieldValueObj(name, value)
    kinInsertFieldValues.Add name, objValue
    
End Sub

'
'■ 更新操作用レコードにフィールドの値を設定(使用しない)
'
'      addUpdateField した順番から
'
Public Sub AddUpdateFieldValueByNo(no_1 As Long, value As Variant)
    Dim fldName As String
    fldName = kinUpdateFields(no_1) 'フィールド名
    AddUpdateFieldValueByName fldName, value
    
End Sub


'■ 更新操作用レコードにフィールドの値を設定(名前から)(使用しない)
Public Sub AddUpdateFieldValueByName(fieldName As String, value As Variant)
    
    Dim objValue As Dictionary
    Set objValue = getFieldValueObj(fieldName, value)
    kinUpdateFieldValues.Add fieldName, objValue
    
End Sub

'■ 更新操作用レコードにフィールドの値を設定
Public Sub AddUpdateFieldValue(field As Variant, value As Variant)
    
    If VarType(field) = vbInteger Or VarType(field) = vbLong Then '旧互換
        Dim fieldNo As Long
        fieldNo = field
        AddUpdateFieldValueByNo fieldNo, value
        Exit Sub
    End If
    
    Dim objValue As Dictionary
    Dim fieldName As String
    fieldName = field
    Set objValue = getFieldValueObj(fieldName, value)
    kinUpdateFieldValues.Add fieldName, objValue
    
End Sub

'
'□ Kintone の追加・更新時の "value" 項目オブジェクトの作成
'
'  Kintone のデータ型によってオブジェクトの形式が異なる
'  文字と数値型の変換も行う
'  サブテーブルはフィールドとしてのタイプと中のフィールドのタイプの両方があるので注意。
'
Private Function getFieldValueObj(fldName As String, fldValue As Variant, Optional subTableFieldName As String) As Variant
    Dim objValue As Dictionary
    
    '【重要】引数のオブジェクトをそのまま参照しないこと！
    '        元データが破棄または変更される場合がある。
    
    Dim numValue As Double
    Dim strValue As String
    Dim fldType As String
    
    Set objValue = New Dictionary
    
    If IsNull(fldValue) Then fldValue = ""
    
    fldType = GetFieldType(fldName, subTableFieldName)
    
    'データ型を見てオブジェクトの形式を変える
    '
    '今のところ値は全て""付きでも良いので数値の場合と処理を変える必要はない
    'If isNumType(fldName) Then
    '    If VarType(fldValue) = vbString Then
    '        numValue = val(fldValue)
    '    Else
    '        numValue = fldValue 'オブジェクトの場合を排除する
    '    End If
    '    objValue.Add KIN_JSON_ATTR_VALUE, numValue
    'Else '文字列
        
    If fldType <> KIN_FIELD_TYPE_SUBTABLE Then
        strValue = fldValue 'オブジェクトの場合を排除する(アドレスの参照にならないように)
    End If
        
        'フォーマット変換
        If fldType = KIN_FIELD_TYPE_DATE Then
            If IsDate(strValue) Then
                strValue = Format(strValue, "yyyy-mm-dd")
            Else 'それ以外は何が設定されているか不明
                'とりあえず、以下は想定して変換を行う
                strValue = Left(strValue, 10) ' ex. "2019-12-31T00:00:00"
                strValue = Replace(strValue, "/", "-") ' ex. "2019/12/31"
            End If
        ElseIf fldType = KIN_FIELD_TYPE_DATETIME Then
            If IsDate(strValue) Then
                strValue = Format(strValue, "yyyy-mm-ddThh:nn:ss") + excelJstTimeZone
            Else
                If Len(strValue) < 20 Then
                    MsgBox "日時はUTCかJST形式でなければなりません！(" & strValue & ")"
                End If
            End If
        End If
        
        
        '特殊なデータ型
        'ここに無いデータ型があれば処理を追加して下さい
        '  Collection が配列 "[...]" で、Dictionary がオブジェクト"{,,,}"。
        If fldType = KIN_FIELD_TYPE_USER_SELECT Then
            Dim users As Collection
            Dim user As Dictionary
            Set users = New Collection
            Set user = New Dictionary
            user.Add KIN_JSON_ATTR_CODE, strValue
            users.Add user
            objValue.Add KIN_JSON_ATTR_VALUE, users
            
        ElseIf fldType = KIN_FIELD_TYPE_SUBTABLE Then
           'サブテーブルの場合は、レコード配列が値になる
           '空にしたい場合は、空文字でも良い事にする
            Dim recs As Collection
            If VarType(fldValue) = vbString Then
                'サブテーブルは初期化する "value":[]
                Set recs = New Collection
            Else
                Set recs = fldValue
            End If
            objValue.Add KIN_JSON_ATTR_VALUE, recs
        Else
        '通常の値
            objValue.Add KIN_JSON_ATTR_VALUE, strValue
        End If
    'End If
    
    Set getFieldValueObj = objValue

End Function

'
'□ Requestによる一括処理
'  複数アプリ間でのトランザクション処理も出来るようですが、複雑で制限もあるので今はサポートしません。
'  メリットの１つとして insert で１回の登録件数が 100 -> 2000 にできる(大した事ではない)
'
Private Sub bulkRequest(objAppJson As Object)
    Dim resBody As String

    resBody = kinPostJson(KIN_API_BULKREQUEST, objAppJson)

End Sub

'
'□ １レコード追加処理実行
'
Private Sub insertRecord(objAppJson As Object)
    Dim resBody As String

    resBody = kinPostJson(KIN_API_RECORD, objAppJson)
    
    'エラーハンドリング(kintoneでは200以外はエラー)
    If comRest.status <> 200 Then
        Dim errJson As Dictionary
        Set errJson = ParseJson(resBody)
        MsgBox "追加処理でエラー：" + errJson(KIN_JSON_ATTR_MESSAGE)
        Err.Raise USER_ERROR_EXIT, "", USER_ERROR_EXIT_MSG
    End If

End Sub

'
'□ 複数レコード追加処理実行
'   JSON 中 "record" -> "records" で配列(Collection)
'
Private Sub insertRecords(objAppJson As Object)
    Dim resBody As String

    resBody = kinPostJson(KIN_API_RECORDS, objAppJson)

    'エラーハンドリング(kintoneでは200以外はエラー)
    If comRest.status <> 200 Then
        Dim errJson As Dictionary
        Set errJson = ParseJson(resBody)
        MsgBox "追加処理でエラー：" + errJson(KIN_JSON_ATTR_MESSAGE)
        Err.Raise USER_ERROR_EXIT, "updateRecord", USER_ERROR_EXIT_MSG
    End If

End Sub

'
'□ １レコード更新
'
Private Sub updateRecord(objAppJson As Object)
    Dim resBody As String

    resBody = kinPutJson(KIN_API_RECORD, objAppJson)
        
    'エラーハンドリング(kintoneでは200以外はエラー)
    If comRest.status <> 200 Then
        Dim errJson As Dictionary
        Set errJson = ParseJson(resBody)
        MsgBox "１行更新処理でエラー：" + errJson(KIN_JSON_ATTR_MESSAGE)
        Err.Raise USER_ERROR_EXIT, "updateRecord", USER_ERROR_EXIT_MSG
    End If

End Sub

'
'□ 複数レコード更新
'   JSON 中 "record" -> "records" で配列(Collection)
'
Private Sub updateRecords(objAppJson As Object)
    Dim resBody As String

    resBody = kinPutJson(KIN_API_RECORDS, objAppJson)

 
    'エラーハンドリング(kintoneでは200以外はエラー)
    If comRest.status <> 200 Then
        Dim errJson As Dictionary
        Set errJson = ParseJson(resBody)
        MsgBox "複数行更新処理でエラー：" + errJson(KIN_JSON_ATTR_MESSAGE)
        Err.Raise USER_ERROR_EXIT, "updateRecords", USER_ERROR_EXIT_MSG
    End If

End Sub

'
'□ 複数レコード削除
'   JSON
'
Private Sub deleteRecords(objAppJson As Object)
    Dim resBody As String

    resBody = kinDeleteJson(KIN_API_RECORDS, objAppJson)
    'エラーハンドリング(kintoneでは200以外はエラー)
    If comRest.status <> 200 Then
        Dim errJson As Dictionary
        Set errJson = ParseJson(resBody)
        MsgBox "削除処理でエラー：" + errJson(KIN_JSON_ATTR_MESSAGE)
        Err.Raise USER_ERROR_EXIT, "deleteRecords", USER_ERROR_EXIT_MSG

    End If

End Sub

'
'□ プロセス管理 複数レコードのステータスの更新
'
Private Sub updateProcessRecords(objAppJson As Object)
    Dim resBody As String

    resBody = kinPutJson(KIN_API_RECORDS_STATUS, objAppJson)

    'エラーハンドリング(kintoneでは200以外はエラー)
    If comRest.status <> 200 Then
        Dim errJson As Dictionary
        Set errJson = ParseJson(resBody)
        MsgBox "プロセス更新処理でエラー：" + errJson(KIN_JSON_ATTR_MESSAGE)
        Err.Raise USER_ERROR_EXIT, "updateProcessRecords", USER_ERROR_EXIT_MSG
    End If

End Sub

'
'□ Kintone 内のフィールド情報の取得
'   Jsonオブジェクト(Dictionary)を返す
'
Private Function getFieldInfo() As Variant

    Set getFieldInfo = GetAppFormInfo(kinAppId)

End Function

'
'■ フィールドの型が数値なら true
'
Public Function IsNumType(fieldName As String, Optional subTableFieldName As String)
    'フィールド情報の取得
    Dim fieldType As String
    
    fieldType = GetFieldType(fieldName, subTableFieldName)
    If fieldType = KIN_FIELD_TYPE_NUMBER Then
        IsNumType = True
        Exit Function
    End If
    IsNumType = False
End Function

'
'■ フィールドの Kintone のデータ型を返す
'
'   サブテーブルの中のフィールドタイプが知りたければ、サブテーブル名とフィールド名を渡す
'
Public Function GetFieldType(fieldName As String, Optional subTableFieldName As String) As String
    'フィールド情報の取得(１回だけ)
    If kinFieldInfo Is Nothing Then
        Set kinFieldInfo = getFieldInfo()
    End If
    Dim fields As Dictionary
    Dim fieldInfo As Dictionary
    Set fields = kinFieldInfo(KIN_JSON_ATTR_PROPERTIES)
    
    '"$id"の場合
    If fieldName = KIN_FIELD_RECORDID Then
        GetFieldType = KIN_FIELD_TYPE_NUMBER
        Exit Function
    End If
    
    If Not fields.Exists(fieldName) Then
        MsgBox "KintoneにフィールドID(" + fieldName + ")が見つかりません！"
        Err.Raise USER_ERROR_EXIT, "getFieldType", USER_ERROR_EXIT_MSG
    End If
    Set fieldInfo = fields(fieldName)
    Dim fieldType As String
    fieldType = fieldInfo(KIN_JSON_ATTR_TYPE)
    GetFieldType = fieldType

    'サブテーブルの場合のフィールドタイプ
    If fieldType = KIN_FIELD_TYPE_SUBTABLE And subTableFieldName <> "" Then
        Dim subTableFields As Dictionary
        Set subTableFields = fieldInfo(KIN_JSON_ATTR_FIELDS)
        If Not subTableFields.Exists(subTableFieldName) Then
            MsgBox "フィールド(" & subTableFieldName & ")がサブテーブル(" & fieldName & ")に見つかりません"
            Err.Raise USER_ERROR_EXIT, "getFieldType", USER_ERROR_EXIT_MSG
        End If
        Dim subTableField As Dictionary
        Set subTableField = subTableFields(subTableFieldName)
        GetFieldType = subTableField(KIN_JSON_ATTR_TYPE)
    End If

End Function

'
'■ 選択フィールド追加
'   ","で複数指定可能
' 予めフィールドを指定して読む場合に使用する
' 自分で Collection を管理しても良いが、Query の指定を省略できる
Public Sub AddQueryField(fieldName As Variant)
    Dim strFieldName As String
    '実体の変数で受ける事
    strFieldName = fieldName
    
    If kinRecordsetQueryFields Is Nothing Then
        Set kinRecordsetQueryFields = New Collection
    End If
    If InStr(strFieldName, ",") > 0 Then
        Dim names() As String
        names = Split(strFieldName, ",")
        Dim name As Variant
        For Each name In names
           kinQueryFields.Add name
           kinRecordsetQueryFields.Add name
        Next
    Else
        kinRecordsetQueryFields.Add strFieldName
        kinQueryFields.Add strFieldName
    End If
    
End Sub

'
'■ レコード検索実行
'
Public Sub ExecuteQuery(Optional query As String)
    
    kinRecordsetOffset = 0 '初期設定
    kinRecordsetLastRecordId = 0 '前回クエリの結果
    kinRecordsetQuery = query
    kinRecordsetEof = False
    
    kinRecordsetManualLimit = False
    '"limit" の記述が無ければ自動取得
    If query > "" Then
        If InStr(query, "limit") > 0 Then
            kinRecordsetManualLimit = True
        End If
    End If
    
    '指定によって取得方法を選択
    If kinRecordsetQuery = "" And kinRecordsetKeyField = "" Then
        kinRecordsetUseRecordId = True
        kinRecordsetUseOffset = False
        
        '取得フィールドがあり、その中に "$id" が無ければ追加()
        If (kinRecordsetQueryFields.Count > 0) _
        And (Not isCollectionExist(kinRecordsetQueryFields, KIN_FIELD_RECORDID)) Then
            kinRecordsetQueryFields.Add KIN_FIELD_RECORDID
        End If
        
    ElseIf kinRecordsetKeyField > "" Then
        kinRecordsetUseRecordId = False
        kinRecordsetUseOffset = True
    End If
    
    '実行
    executeQuerySub
    
    'moveNext
    If kinRecordsetCount = 0 Then
        kinRecordsetEof = True
        Exit Sub
    End If
    
    kinRecordsetCursorPos = 1 '基底は１
    kinRecordsetCountAll = 1
    
    '１レコード目でフィールド情報取得
        Dim rec As Dictionary
        Set rec = kinRecordsetRecords(kinRecordsetCursorPos)  '１レコード目
        Set kinRecordsetFields = New Collection
        Set kinRecordsetFieldNames = New Collection
        
        'Dictionary -> Collection
        'index や for each を使えるのがメリット
        Dim i As Integer
        Dim key As String
        Dim item As Dictionary
        For i = 0 To rec.Count - 1
            Dim field As Dictionary
            Set field = New Dictionary
            Dim kin_type As String
            key = rec.Keys(i)
            Set item = rec(key)
            field.Add KIN_JSON_ATTR_NAME, key
            kin_type = item(KIN_JSON_ATTR_TYPE)
            field.Add KIN_JSON_ATTR_TYPE, kin_type
            kinRecordsetFields.Add field, key
            kinRecordsetFieldNames.Add key
        Next

End Sub

'□ レコード検索実行
'  レコードのoffset位置を変更しない
'  現状は GET だが、POST でも良い。URIが長くなったらPOSTにしたほうが良い。
'  "order" "limit" "offset" の順番に書く必要がある
Private Sub executeQuerySub()
    Dim objApp As Dictionary
    Dim strUrlParam As String
    Dim strQueryOption As String
    Dim resBody As String
    
    strQueryOption = kinRecordsetQuery
    If kinRecordsetUseOffset Then
        strQueryOption = " order by " & kinRecordsetKeyField & " asc "
    End If
    If kinRecordsetUseRecordId Then
        strQueryOption = strQueryOption & " $id > " & kinRecordsetLastRecordId _
        & " order by $id asc "
    End If
    
    If Not kinRecordsetManualLimit Then
        strQueryOption = strQueryOption & " limit " & kinRecordsetLimit
    End If
    
    If kinRecordsetUseOffset Then
        strQueryOption = strQueryOption & " offset " & kinRecordsetOffset
    End If
    
    strUrlParam = "&query=" + comRest.Encode_url(strQueryOption)
    
    'フィールド指定がある場合
    If Not (kinRecordsetQueryFields Is Nothing) Then
        Dim i As Long
        Dim name As String
        For i = 1 To kinRecordsetQueryFields.Count
            name = kinRecordsetQueryFields(i)
            strUrlParam = strUrlParam + "&fields" & comRest.Encode_url("[" & (i - 1) & "]") & "=" & comRest.Encode_url(name)
        Next
    End If
    
    resBody = kinGet(KIN_API_RECORDS + "?app=" + kinAppId + strUrlParam)
    
    resBody = Replace(resBody, vbLf, "")
    resBody = Replace(resBody, vbCrLf, "")
    
    '一度テンポラリで受けておく
    Dim tempJson As Dictionary
    Dim tempRecords As Collection
    Set tempJson = ParseJson(resBody)

    'エラーハンドリング(kintoneでは200以外はエラー)
    If comRest.status <> 200 Then
        Dim errJson As Dictionary
        Set errJson = ParseJson(resBody)
        Debug.Print strQueryOption
        Debug.Print strUrlParam
        Set tempRecords = New Collection ' 0 レコード
        MsgBox "検索処理でエラー：" + errJson(KIN_JSON_ATTR_MESSAGE)
        Err.Raise USER_ERROR_EXIT, "executeQuery", USER_ERROR_EXIT_MSG

    Else
        Set tempRecords = tempJson(KIN_JSON_ATTR_RECORDS)
    End If

    '件数があった時だけ変数に設定
    If tempRecords.Count > 0 Then
        Set kinRecordsetJson = tempJson
        Set kinRecordsetRecords = kinRecordsetJson(KIN_JSON_ATTR_RECORDS)
        kinRecordsetCount = kinRecordsetRecords.Count '取得件数
        If kinRecordsetUseOffset Then
            kinRecordsetOffset = kinRecordsetOffset + kinRecordsetCount '次のオフセット位置
        End If
        If kinRecordsetUseRecordId Then
            Dim record As Dictionary
            Set record = kinRecordsetRecords(kinRecordsetCount) '最後のレコード
            kinRecordsetLastRecordId = getRecordFieldValue(record, KIN_FIELD_RECORDID) '値
        End If
        kinRecordsetCursorPos = 0 'カーソル操作用
    Else
        kinRecordsetEof = True
    End If
    

End Sub

'
'■ 次のレコード位置へ
'  バッファに無くなったら再度クエリを実行する
'  読むレコードが無かったら false を返す
'  カーソルを戻る操作は不要だろう
'  現状 EOF を予め予測判定することはできない
'  つまり、    While not kin.EOF
'                 if kin.moveNext then
'  の様に読めたかの判定が要る
'
Public Function MoveNext() As Boolean
    DoEvents
    If kinRecordsetCursorPos >= kinRecordsetCount Then
        '次のoffset から取得するか
        '無ければ false
        If kinRecordsetCount >= kinRecordsetLimit And (Not kinRecordsetManualLimit) Then
            ' EOF の判定あり
            Application.StatusBar = kinRecordsetCountAll & "件目の処理をしています..."
            executeQuerySub
        Else
            kinRecordsetEof = True
            Application.StatusBar = kinRecordsetCountAll & "件完了"

        End If
    End If
        
    If Not kinRecordsetEof Then
        kinRecordsetCursorPos = kinRecordsetCursorPos + 1
        kinRecordsetCountAll = kinRecordsetCountAll + 1
        MoveNext = True
    Else
        MoveNext = False
    End If
    
End Function

'
'■ 現在のレコードからフィールドの値を取得
'
Public Function GetRecordsetFieldValue(name As Variant) As String
    Dim rec As Dictionary
    Dim val As Variant
    Set rec = kinRecordsetRecords(kinRecordsetCursorPos)
    val = getRecordFieldValue(rec, name)
    ' {"value":null} は 空文字に変換
    If IsNull(val) Then
        val = ""
    End If
    GetRecordsetFieldValue = val

End Function


'
'□ レコードからフィールドの値を取得
'
'    Excel への文字列のフォーマットを修正したければ、ここで行う。
'
Private Function getRecordFieldValue(rec As Dictionary, name As Variant) As Variant
    
    Dim fld As Dictionary
    Dim str As String
    Dim fld_type As String
    Set fld = rec(name)
    fld_type = fld(KIN_JSON_ATTR_TYPE)
    '型によってさらに属性があるものがある
    If fld_type = KIN_FIELD_TYPE_CREATOR _
    Or fld_type = KIN_FIELD_TYPE_MODIFIER Then
        Dim sub_value As Dictionary
        Set sub_value = fld(KIN_JSON_ATTR_VALUE)
        getRecordFieldValue = sub_value(KIN_JSON_ATTR_CODE) & "/" & sub_value(KIN_JSON_ATTR_NAME)
        Exit Function
        ' ElseIf fld_type = KIN_FIELD_TYPE_ID Then 'value で同じ
            
    End If
    
    If fld_type = KIN_FIELD_TYPE_STATUS_ASSIGNEE _
    Or fld_type = KIN_FIELD_TYPE_USER_SELECT Then
        Dim sub_users As Collection
        Set sub_users = fld(KIN_JSON_ATTR_VALUE)
        str = ""
        For Each sub_value In sub_users
            If str <> "" Then str = str + ","
            str = str + sub_value(KIN_JSON_ATTR_CODE) & "/" _
            & sub_value(KIN_JSON_ATTR_NAME)
        Next
        getRecordFieldValue = str
        Exit Function
    End If

    If fld_type = KIN_FIELD_TYPE_SUBTABLE Then
        getRecordFieldValue = "<サブテーブル>"
        Exit Function
    End If
    
    If fld_type = KIN_FIELD_TYPE_CHECK_BOX Then
        Dim values As Collection
        Set values = fld(KIN_JSON_ATTR_VALUE)
        str = ""
        Dim val As Variant
        For Each val In values
            If str <> "" Then str = str + ","
            str = str & val
        Next
        getRecordFieldValue = str
        Exit Function
    End If
    
    If fld_type = KIN_FIELD_TYPE_FILE Then
        getRecordFieldValue = "<添付ファイル>"
        Exit Function
    End If
    
    getRecordFieldValue = fld(KIN_JSON_ATTR_VALUE)

End Function

'
' 複数レコード処理を１組の関数でまとめる
'
'■ 複数レコード追加
'  100行(kintoneの１回の最大数)ごとに実行する
'  最後の余りを処理したいので、begin～end の構成とする
'  beginUpdateBatch
'    for
'      insert
'    next
'  endUpdateBatch
'
Public Sub BeginUpdateBatch()
    Set kinInsertRecords = New Collection
    Set kinUpdateRecords = New Collection
    Set kinDeleteRecords = New Collection
    Set kinProcessRecords = New Collection
    isUseBatch = True
End Sub


'■ レコード追加(バッチ、１行共通)
'  通常引数は使わない(レコード情報を先に作成しておく)
Public Sub Insert(Optional objRecord As Dictionary)
    Dim objApp As Dictionary
    
    'バッチかどうかで処理を分ける
    If isUseBatch Then
        '引数があれば優先
        If objRecord Is Nothing Then
            ' setSubTableFields(kinInsertFieldValues)
            kinInsertRecords.Add kinInsertFieldValues
            Set kinInsertFieldValues = New Dictionary
        Else
            ' setSubTableFields(objRecord)
            kinInsertRecords.Add objRecord
        End If
        If kinInsertRecords.Count >= KIN_MAX_INSERT Then
            Set objApp = New Dictionary
            objApp.Add KIN_JSON_ATTR_APP, kinAppId
            objApp.Add KIN_JSON_ATTR_RECORDS, kinInsertRecords
        
            insertRecords objApp
        
            'clear メソッドが無い
            Set kinInsertRecords = New Collection
        End If
    Else
        '１行追加
        Set objApp = New Dictionary
        objApp.Add KIN_JSON_ATTR_APP, kinAppId
        '引数があれば優先
        If objRecord Is Nothing Then
            objApp.Add KIN_JSON_ATTR_RECORD, kinInsertFieldValues
            Set kinInsertFieldValues = New Dictionary
        Else
            objApp.Add KIN_JSON_ATTR_RECORD, objRecord
            kinInsertRecords.Add objRecord
        End If
        insertRecord objApp
    End If

End Sub


'■ １レコード更新(バッチ、１行更新共通)
'  レコードの値は kinUpdateFieldValues を使う
'  レコードを特定するキー(名前と値)が必要
Public Sub Update(keyName As String, keyValue As Variant)
    Dim objApp As Dictionary
    Dim objUpdateRecord As Dictionary
    Dim objUpdateKey As Dictionary
    
    Set objUpdateRecord = New Dictionary '{ objUpdateKey, "record":{...}}
    Set objUpdateKey = New Dictionary ' "id": xxxx
       

    'バッチかどうかで処理を分ける
    If isUseBatch Then
    
        '複数行一括処理
        '外部キーか内部IDか
        If keyName = KIN_JSON_ATTR_ID Or keyName = KIN_FIELD_RECORDID Then
            objUpdateRecord.Add KIN_JSON_ATTR_ID, keyValue
        Else
            '外部キーの場合 "updatekey":{"field":フィールド名,"value":値}
            objUpdateKey.Add KIN_JSON_ATTR_FIELD, keyName
            objUpdateKey.Add KIN_JSON_ATTR_VALUE, newJsonFieldValue(keyName, keyValue)
            objUpdateRecord.Add KIN_JSON_ATTR_UPDATEKEY, objUpdateKey
        End If
        objUpdateRecord.Add KIN_JSON_ATTR_RECORD, kinUpdateFieldValues
        '設定後初期化
        Set kinUpdateFieldValues = New Dictionary
    
        'レコードバッファに追加
        kinUpdateRecords.Add objUpdateRecord
        If kinUpdateRecords.Count >= KIN_MAX_UPDATE Then
            Set objApp = New Dictionary
            objApp.Add KIN_JSON_ATTR_APP, kinAppId
            objApp.Add KIN_JSON_ATTR_RECORDS, kinUpdateRecords
        
            updateRecords objApp
        
            'clear メソッドが無いので代わり
            Set kinUpdateRecords = New Collection
        End If
    Else
    
        '１行更新処理
        Set objApp = New Dictionary
        objApp.Add KIN_JSON_ATTR_APP, kinAppId
        '外部キーか内部IDか
        If keyName = KIN_JSON_ATTR_ID Then
            objApp.Add KIN_JSON_ATTR_ID, keyValue
         Else
            objUpdateKey.Add KIN_JSON_ATTR_FIELD, keyName
            objUpdateKey.Add KIN_JSON_ATTR_VALUE, newJsonFieldValue(keyName, keyValue)
            objApp.Add KIN_JSON_ATTR_UPDATEKEY, objUpdateKey
        End If

        objApp.Add KIN_JSON_ATTR_RECORD, kinUpdateFieldValues
        '設定後レコードバッファはクリア
        Set kinUpdateFieldValues = New Dictionary
        
        updateRecord objApp
        
    End If

End Sub

'
'■ １行削除(バッチ、１行共通)
'  URL 指定でも出来るようだが、JSON のほうが良い
'  現状 revision はサポートしてない
'  "records" を使ったほうが統一感があるのにセンスが無いなぁ！
Public Sub Delete(recordId As Long, Optional revision As Long)
    Dim objApp As Dictionary
    
    kinDeleteRecords.Add recordId
    
    'バッチかどうかで処理を分ける
    ' API には複数削除しかない
    If isUseBatch Then
        If (Not isUseBatch) Or (kinDeleteRecords.Count >= KIN_MAX_DELETE) Then
            Set objApp = New Dictionary
            objApp.Add KIN_JSON_ATTR_APP, kinAppId
            objApp.Add KIN_JSON_ATTR_IDS, kinDeleteRecords
        
            deleteRecords objApp
        
            'clear メソッドが無い
            Set kinDeleteRecords = New Collection
        End If
    End If

End Sub

'
'■ 複数行更新の残りレコード処理
'
Public Sub EndUpdateBatch()
    Dim objApp As Dictionary

    If isUseBatch = False Then
        MsgBox "BeginUpdateBatch が実行されていません！"
        Err.Raise USER_ERROR_EXIT, "EndUpdateBatch", USER_ERROR_EXIT_MSG
        Exit Sub
    End If

    If kinInsertRecords.Count > 0 Then
        Set objApp = New Dictionary
        objApp.Add KIN_JSON_ATTR_APP, kinAppId
        objApp.Add KIN_JSON_ATTR_RECORDS, kinInsertRecords
        
        insertRecords objApp
        
    End If

    If kinUpdateRecords.Count > 0 Then
        Set objApp = New Dictionary
        objApp.Add KIN_JSON_ATTR_APP, kinAppId
        objApp.Add KIN_JSON_ATTR_RECORDS, kinUpdateRecords
        
        updateRecords objApp
        
    End If

    If kinDeleteRecords.Count > 0 Then
        Set objApp = New Dictionary
        objApp.Add KIN_JSON_ATTR_APP, kinAppId
        objApp.Add KIN_JSON_ATTR_IDS, kinDeleteRecords
        
        deleteRecords objApp
        
    End If
    
    If kinProcessRecords.Count > 0 Then
        Set objApp = New Dictionary
        objApp.Add KIN_JSON_ATTR_APP, kinAppId
        objApp.Add KIN_JSON_ATTR_RECORDS, kinProcessRecords
        
        updateProcessRecords objApp
        
    End If
    
    Set kinInsertRecords = Nothing
    Set kinUpdateRecords = Nothing
    Set kinDeleteRecords = Nothing
    Set kinProcessRecords = Nothing
    isUseBatch = False

End Sub


'
'■ レコード内のサブテーブルの行数取得
'
'   現在のレコードセットのレコードに対する
'   操作対象サブテーブル名を設定する

Public Function GetRecordsetSubTableCount(subTableName As String) As Long
    Dim rec As Dictionary
    Dim field As Dictionary
    
    GetRecordsetSubTableCount = 0
    
    '現在のレコード
    Set rec = kinRecordsetRecords(kinRecordsetCursorPos)
    If Not rec.Exists(subTableName) Then
        MsgBox "サブテーブル名(" & subTableName & ")が見つかりません！"
        Exit Function
    End If
    
    Dim subTable As Dictionary
    Dim subTableRows As Collection
    
    Set subTable = rec(subTableName)
    If subTable(KIN_JSON_ATTR_TYPE) <> KIN_FIELD_TYPE_SUBTABLE Then
        MsgBox subTableName & " はサブテーブルではありません"
        Exit Function
    End If
    Set subTableRows = subTable(KIN_JSON_ATTR_VALUE)
    GetRecordsetSubTableCount = subTableRows.Count

End Function

'
'■ レコード内のサブテーブルのフィールド情報を取得
'
'   現在のレコードセットのレコードに対する
'   サブテーブルが１行も無ければ取得できない
'
Public Function GetRecordsetSubTableFields(subTableName As String) As Collection
    Dim fields As Collection
    Dim rows As Collection
    Dim rowId As Dictionary
    Dim row As Dictionary
    
    Set fields = New Collection
    Set GetRecordsetSubTableFields = fields
    Set rows = getRecordsetSubTableRows(subTableName)
    If rows.Count = 0 Then Exit Function

    Set rowId = rows(1)
    ' "id":nnnn は無視
    ' "value":{ レコード }
    Set row = rowId(KIN_JSON_ATTR_VALUE)
    Dim i As Long
    Dim key As String
    For i = 0 To row.Count - 1
        key = row.Keys(i)
        fields.Add key
    Next

End Function


'
'□ レコード内のサブテーブルの行を取得
'
'   現在のレコードセットのレコードに対する
'   サブテーブルが１行も無ければ取得できない
'
Private Function getRecordsetSubTableRows(subTableName As Variant) As Collection
    Dim rec As Dictionary
    Dim field As Dictionary
    Dim subTable As Dictionary
    Dim subTableRows As Collection
    
    Set subTableRows = New Collection
    
    '現在のレコード
    Set rec = kinRecordsetRecords(kinRecordsetCursorPos)
    If Not rec.Exists(subTableName) Then
        MsgBox "サブテーブル名(" & subTableName & ")が見つかりません！"
        Err.Raise USER_ERROR_EXIT, "getRecordsetSubTableRows", USER_ERROR_EXIT_MSG
        Exit Function
    End If
    
    Set subTable = rec(subTableName)
    If subTable(KIN_JSON_ATTR_TYPE) <> KIN_FIELD_TYPE_SUBTABLE Then
        MsgBox subTableName & " はサブテーブルではありません"
        Err.Raise USER_ERROR_EXIT, "getRecordsetSubTableRows", USER_ERROR_EXIT_MSG
        Exit Function
    End If
    Set subTableRows = subTable(KIN_JSON_ATTR_VALUE)
    
    Set getRecordsetSubTableRows = subTableRows

End Function

'
'■ サブテーブルの値を取得
'     For i = 1 to kinRest.getRecordsetSubTableCount(subTableName)
'         For each colName in kinRest.getRecoedsetSubTableFields(subTableName)
'              Cells(row, col) = kinRest.getRecordsetSubTableFieldValue(subTableName, i, colName)
'              col = col + 1
'         Next
'         row = row + 1
'     Next
Public Function GetRecordsetSubTableFieldValue(subTableName As Variant, recordNo As Long, fieldName As Variant) As Variant
    Dim tableRows As Collection
    Dim rowId As Dictionary
    Dim row As Dictionary
    
    Set tableRows = getRecordsetSubTableRows(subTableName)
    Set rowId = tableRows(recordNo)
    ' "id":nnnn は無視
    ' "value":{ レコード }
    Set row = rowId(KIN_JSON_ATTR_VALUE)
    
    GetRecordsetSubTableFieldValue = getRecordFieldValue(row, fieldName)
    
End Function


'
'■ サブテーブル内のレコードバッファに値を設定
'
'   ※サブテーブルIDが必要なのは、データ型を特定する必要がある為
'
Public Sub AddSubTableFieldValue(subTableName As String, fieldName As String, value As Variant)
    Dim subTable As Dictionary
    
    'コンストラクタで最初に行っても良いが・・・
    If kinSubTableFieldValues Is Nothing Then
        Set kinSubTableFieldValues = New Dictionary
    End If
    
    'サブテーブルの参照
    'サブテーブルが無ければ追加する
    If Not kinSubTableFieldValues.Exists(subTableName) Then
        Set subTable = New Dictionary
        kinSubTableFieldValues.Add subTableName, subTable
    Else
        Set subTable = kinSubTableFieldValues(subTableName)
    End If
    
    'フィールドと値を追加
    Dim objValue As Variant
    Set objValue = getFieldValueObj(subTableName, value, fieldName)
    subTable.Add fieldName, objValue

End Sub


'
'■ サブテーブル内の１行をINSERT用レコードに追加
'
'   サブテーブルの行バッファから、INSERT用レコードのサブテーブルに追加する
'   ※ "id" を省略すると２つ目の"value"が無意味に思えるので抜けないように注意！(エラーが出ない)
'
'        "Table": {
'            "value": [  -- subTableRecs
'                {
'                    "value": { -- subTableRecValue
'                        "Text": {
'                            "value": "TableText1"
'                        },
'                        "Number": {
'                            "value": "1"
'                        }
'                    }
'                },
Public Sub AddInsertSubTableRecord(subTableName As Variant)
    Dim recSubTableField As Dictionary
    Dim recSubTableFieldRecs As Collection
    Dim subTableRecValue As Dictionary
    Dim subTableRec As Dictionary

    'レコードのサブテーブルフィールドの配列 -> recSubTableFieldRecs
    '  無ければ登録する
    If Not kinInsertFieldValues.Exists(subTableName) Then
        AddInsertFieldValue subTableName, ""
    End If
    Set recSubTableField = kinInsertFieldValues(subTableName)
    Set recSubTableFieldRecs = subTableField(KIN_JSON_ATTR_VALUE)
    
    'サブテーブルレコードバッファ
    Set subTableRec = kinSubTableFieldValues(subTableName)
    
    'レコードの値の移動
    ' "{id":nnn, "value":{...}} で、"id" は省略可(＝サブテーブル全体の置き換え)
    Set subTableRecValue = New Dictionary
    subTableRecValue.Add KIN_JSON_ATTR_VALUE, subTableRec
    '配列に追加
    recSubTableFieldRecs.Add subTableRecValue
    
    'コピーしたレコードバッファは消去
    kinSubTableFieldValues.Remove (subTableName)

End Sub

'
'■ サブテーブル内の１行をUPDATE用レコードに追加
'
'   サブテーブルの行バッファから、UPDATE用レコードのサブテーブルに追加する
'
Public Sub AddUpdateSubTableRecord(subTableName As String)
    Dim recSubTableField As Dictionary
    Dim recSubTableFieldRecs As Collection
    Dim subTableRec As Dictionary
    Dim subTableRecValue As Dictionary

    'レコードのサブテーブルフィールドの配列 -> recSubTableFieldRecs
    '  無ければ登録する
    If Not kinUpdateFieldValues.Exists(subTableName) Then
        '無ければ登録
        AddUpdateFieldValueByName subTableName, ""
    End If
    Set recSubTableField = kinUpdateFieldValues(subTableName)
    Set recSubTableFieldRecs = recSubTableField(KIN_JSON_ATTR_VALUE)
    
    'サブテーブルレコードバッファ
    Set subTableRec = kinSubTableFieldValues(subTableName)
    
    'レコードのサブテーブルの配列に移動
    'Set subTableValue = New Dictionary
    ' "{id":nnn, "value":{...}} で、"id" は省略可(＝サブテーブル全体の置き換え)
    Set subTableRecValue = New Dictionary
    subTableRecValue.Add KIN_JSON_ATTR_VALUE, subTableRec
    '配列に追加
    recSubTableFieldRecs.Add subTableRecValue
    '追加済のバッファの削除
    kinSubTableFieldValues.Remove (subTableName)

End Sub


'
'□ 更新用サブテーブルを取得
'   存在しない場合は"空"を返す
'
Private Function getSubTableRecords(subTableName As String) As Collection
    Dim subTableRecs As Collection
    
    Set subTableRecs = New Collection
    
    If kinSubTables.Exists(subTableName) Then
        Set subTable = kinSubTables(subTableName)
        Set subTableRecs = subTable(KIN_JSON_ATTR_VALUE)
        kinSubTables.Remove subTableName 'クリア
    End If
    
    Set getSubTableRecords = subTableRecs

End Function


'
'□ 更新用レコードのサブテーブルを設定
'
'   更新レコードバッファを指定する
'   中にサブテーブルがあれば、レコード情報があるか検索し、
'   あれば設定する
'   毎回やるには少し重いかな？？？
'
Private Sub setSubTableRecord(updateRecord As Dictionary)
    Dim i As Long
    Dim fieldName As String
    Dim filedType As String
    
    'レコード内の全フィールドをスキャン
    For i = 1 To updateRecord.Count
        fieldName = updateRecord.Keys(i)
        fieldType = GetFieldType(fieldName)
        If fieldType = KIN_FIELD_TYPE_SUBTABLE Then
            Dim recField As Dictionary
            Set recField = updateRecord(fieldName)
            
            'サブテーブルのレコード情報があるか。あれば "value"を置き換え
            If kinSubTables.Exists(filedName) Then
                Dim subTableValue As Dictionary
                Set subTableValue = kinsubtable(fieldName)
                '置き換え
                recField.Remove KIN_JSON_ATTR_VALUE
                recField.Add KIN_JSON_ATTR_VALUE, subTableValue
                'バッファ削除
                kinSubTables.Remove fieldName
            End If
        End If
    Next

End Sub


'
'■プロセス管理
'
'  とりあえず、最小限でサポートしてみた。
'
Public Sub UpdateProcess(recordId As Long, action As String, assignee As String)
    Dim process As Dictionary
    Dim resBody As String
    Dim records As Collection
    
    Set process = New Dictionary
    
    If isUseBatch Then
        
        process.Add KIN_JSON_ATTR_ID, recordId
        process.Add KIN_JSON_ATTR_ACTION, action
        process.Add KIN_JSON_ATTR_ASSIGNEE, assignee
        'process.Add KIN_JSON_ATTR_REVISION, revision
        Set records = kinProcessUpdates(KIN_JSON_ATTR_RECORDS)
        records.Add process
        kinProcessCount = kinProcessCount + 1
        If kinProcessCount >= KIN_MAX_PROCESS Then
            '実行
            Dim objApp As Dictionary
            Set objApp = New Dictionary
            objApp.Add KIN_JSON_ATTR_APP, kinAppId
            objApp.Add KIN_JSON_ATTR_RECORDS, kinProcessRecords
        
            updateProcessRecords objApp
            
            Set kinProcessRecords = New Collection
            kinProcessCount = 0
        End If
    Else
        '１件実行
        process.Add KIN_JSON_ATTR_APP, appId
        process.Add KIN_JSON_ATTR_ID, recordId
        process.Add KIN_JSON_ATTR_ACTION, action
        process.Add KIN_JSON_ATTR_ASSIGNEE, assignee
        'process.Add KIN_JSON_ATTR_REVISION, revision
        resBody = kinPutJson(KIN_API_RECORD_STATUS, process)
        
    End If

End Sub


'
'□ JSON用のフィールドの値を得る
'   String or Double を返す
'   オブジェクト参照解除にもなる
'
Private Function newJsonFieldValue(fieldName As String, dataValue As Variant) As Variant
    Dim numVal As Double
    Dim strVal As String
    
    If IsNumType(fieldName) Then
    
       If IsNull(dataValue) Then
            numVal = 0
       Else
            If VarType(dataValue) = vbString Then
                numVal = val(dataValue)
            Else
                numVal = dataValue
            End If
       End If
        newJsonFieldValue = numVal
        
    Else
    
       If IsNull(dataValue) Then
            strVal = ""
       Else
            strVal = dataValue
       End If
       newJsonFieldValue = strVal

    End If

End Function

'
'□ Dictionary の要素の存在チェック(不要)
' 「Scripting Runtime」の Dictionary とは互換が無い
'  Dictionary.Exists() で良かった・・・・
Private Function isDictionaryExist(dic As Dictionary, key As Variant) As Boolean
 
    Dim item As Variant
    Dim i As Long
    For i = 0 To dic.Count - 1
        If key = dic.Keys(i) Then
            isDictionaryExist = True
            Exit Function
        End If
    Next
    isDictionaryExist = False
End Function

'
'□ Collection の要素の存在チェック
'
Private Function isCollectionExist(col As Collection, key As Variant) As Boolean
        
    Dim item As Variant
    For Each item In col
        If item = key Then
            isCollectionExist = True
            Exit Function
        End If
    Next
    isCollectionExist = False
End Function

'
'■ カーソルを閉じる
'
Public Sub CloseRecordset()
    kinQueryFields = Nothing     'ここでクリアするかは考慮が必要
    kinRecordsetQueryFields = Nothing
    Set kinQueryFields = New Collection
    Set kinRecordsetQueryFields = New Collection
End Sub

'
'◆ アプリケーション情報の取得・操作 ◆
'
'  クラス内で保持するアプリケーションIDには依存しない処理
'
'■ Kintone のフォームのフィールド情報の取得(アプリID指定)
'
Public Function GetAppFormInfo(appId As Variant) As Dictionary
 
    Set GetAppFormInfo = commonGetApi(KIN_API_FORM_FIELDS & "?app=" & appId, "フォームフィールド情報取得")

End Function

'
'■ Kintone のアプリ設計情報の取得
'
Public Function GetAppSettings(appId As Variant) As Dictionary
    
    Set GetAppSettings = commonGetApi(KIN_API_APP_SETTINGS & "?app=" & appId, "アプリ設定情報取得")

End Function


'
'■ Kintone のアプリのフォームのレイアウト情報の取得
'
Public Function GetFormLayout(appId As Variant) As Dictionary
    
    Set GetFormLayout = commonGetApi(KIN_API_APP_LAYOUT & "?app=" & appId, "フォームレイアウト情報取得")

End Function

'
'■ Kintone のアプリVIEW情報取得
'
Public Function GetAppViews(appId As Variant) As Dictionary
    
    Set GetAppViews = commonGetApi(KIN_API_APP_VIEWS & "?app=" & appId, "アプリVIEW設計情報取得")

End Function

'
'■ Kintone のアプリのプロセス情報取得
'
Public Function GetAppProcess(appId As Variant) As Dictionary
    
    Set GetAppProcess = commonGetApi(KIN_API_APP_STATUS & "?app=" & appId, "アプリのプロセス情報取得")

End Function

'
'■ Kintone のアプリのJavascript/CSS情報取得
'
Public Function GetAppCustomize(appId As Variant) As Dictionary
    
    Set GetAppCustomize = commonGetApi(KIN_API_APP_CUSTOMIZE & "?app=" & appId, "アプリのカスタマイズ情報取得")

End Function

'
'■ Kintone 内に新規アプリを作成
'
'   成功すると、アプリID("app")を含むオブジェクトを返す
'
Public Function CreatePreviewApp(name As String) As Dictionary
    Dim newApp As Dictionary
    Set newApp = New Dictionary
    
    newApp.Add KIN_JSON_ATTR_NAME, name
    
    Set CreatePreviewApp = commonPostApi(KIN_API_PREVIEW_APP, newApp, "アプリ作成")

End Function

'
'■ Kintone 内のプレビュー状態のアプリのフィールド情報を追加する
'
'  成功したら、リビジョン番号を返す
'
Public Function AddPreviewFormFields(formFields As Dictionary) As Variant
    Dim resultJson As Dictionary
    
    Set resultJson = commonPostApi(KIN_API_PREVIEW_FORM_FIELDS, formFields, "フォームフィールドの追加")
    
    AddPreviewFormFields = resultJson(KIN_JSON_ATTR_REVISION)

End Function

'
'■ Kintone 内のプレビュー状態のアプリのフィールド情報を修正する
'
'  成功したら、リビジョン番号を返す
'
Public Function UpdatePreviewFormFields(formFields As Dictionary) As Variant
    Dim resultJson As Dictionary
    
    Set resultJson = commonPutApi(KIN_API_PREVIEW_FORM_FIELDS, formFields, "フォームフィールド変更")
    
    UpdatePreviewFormFields = resultJson(KIN_JSON_ATTR_REVISION)

End Function

'
'■ Kintone 内にプレビュー状態のアプリのセッティング情報を修正する
'
'  appSettings には "app" を設定しておく
'  成功したら、リビジョン番号を返す
'
Public Function UpdatePreviewSettings(appSettings As Dictionary) As Variant
    Dim resultJson As Dictionary
    
    Set resultJson = commonPutApi(KIN_API_PREVIEW_SETTINGS, appSettings, "アプリの設定情報更新")
    
    UpdatePreviewSettings = resultJson(KIN_JSON_ATTR_REVISION)

End Function

'
'■ Kintone 内のプレビュー状態のアプリのレイアウト情報を修正する
'
'  成功したら、リビジョン番号を返す
'
Public Function UpdatePreviewLayout(appLayout As Dictionary) As Variant
    Dim resultJson As Dictionary
    
    Set resultJson = commonPutApi(KIN_API_PREVIEW_LAYOUT, appLayout, "アプリのレイアウト情報更新")
    
    UpdatePreviewLayout = resultJson(KIN_JSON_ATTR_REVISION)

End Function


'
'■ Kintone 内のプレビュー状態のアプリのビュー情報を修正する
'
'  成功したら、リビジョン番号を返す
'
Public Function UpdatePreviewViews(appView As Dictionary) As Variant
    Dim resultJson As Dictionary
    
    Set resultJson = commonPutApi(KIN_API_PREVIEW_VIEW, appView, "アプリのビュー情報更新")
    
    UpdatePreviewViews = resultJson(KIN_JSON_ATTR_REVISION)

End Function


'
'■ Kintone 内のプレビュー状態のアプリのJavascript/CSS情報を修正する
'
'  成功したら、リビジョン番号を返す
'
Public Function UpdatePreviewCustomize(appView As Dictionary) As Variant
    Dim resultJson As Dictionary
    
    Set resultJson = commonPutApi(KIN_API_PREVIEW_CUSTOMIZE, appView, "アプリのJavascript/CSS情報更新")
    
    UpdatePreviewCustomize = resultJson(KIN_JSON_ATTR_REVISION)

End Function


'
'■ Kintone のプロセス情報更新
'
'  成功したら、リビジョン番号を返す
'
Public Function UpdatePreviewProcess(process As Dictionary) As Variant
    Dim resultJson As Dictionary
    
    Set resultJson = commonPutApi(KIN_API_PREVIEW_STATUS, process, "プロセス更新")
    
    UpdatePreviewProcess = resultJson(KIN_JSON_ATTR_REVISION)

End Function

'
'■ Kintone 内のプレビュー状態のアプリをデプロイする
'
'   成功したら、リビジョン番号を返す
'
Public Function DeployPreviewApp(appId As Variant) As Variant
    Dim deployApp As Dictionary
    Dim resultJson As Dictionary
    Dim apps As Collection
    Dim app As Dictionary
    
    Set apps = New Collection
    Set deployApp = New Dictionary
    Set app = New Dictionary
    deployApp.Add KIN_JSON_ATTR_APPS, apps
    app.Add KIN_JSON_ATTR_APP, appId
    apps.Add app
    
    Set resultJson = commonPostApi(KIN_API_PREVIEW_DEPLOY, deployApp, "アプリのデプロイ処理")
    
    DeployPreviewApp = resultJson(KIN_JSON_ATTR_REVISION)

End Function

'
'■ Kintoneのフィールドに関連アプリIDがあるか探しあれば項目名のCollectionを返す
'

' 指定された属性を持つフィールドの名前を返す
Public Function GetRelatedFieldNames(formInfo As Dictionary) As Collection
    Dim relFields As Collection
    Set relFields = New Collection

    Dim fields As Dictionary
    Set fields = formInfo(KIN_JSON_ATTR_PROPERTIES)
    Dim key As Variant
    Dim field As Dictionary
    For Each key In fields.Keys
        Set field = fields(key)
        If field.Exists(KIN_JSON_ATTR_LOOKUP) Then
            relFields.Add key
        ElseIf field.Exists(KIN_JSON_ATTR_REFERENCE) Then
            relFields.Add key
        End If
    Next
    Set GetRelatedFieldNames = relFields

End Function

'
'■ Kintoneの関連アプリケーションIDの変更
'
Public Function UpdateRelatedFieldAppId(formInfo As Dictionary, fieldName As Variant, appId As Variant) As Boolean

    Dim fields As Dictionary
    Set fields = formInfo(KIN_JSON_ATTR_PROPERTIES)
    Dim field As Dictionary
    Set field = fields(fieldName)
    Dim refInfo As Dictionary
    If field.Exists(KIN_JSON_ATTR_REFERENCE) Then
        Set refInfo = field(KIN_JSON_ATTR_REFERENCE)
    ElseIf field.Exists(KIN_JSON_ATTR_LOOKUP) Then
        Set refInfo = field(KIN_JSON_ATTR_LOOKUP)
    Else
        UpdateRelatedFieldAppId = False
        Exit Function
    End If
    Dim relatedApp As Dictionary
    Set relatedApp = refInfo(KIN_JSON_ATTR_RELATEDAPP)
    relatedApp.Remove KIN_JSON_ATTR_APP
    relatedApp.Add KIN_JSON_ATTR_APP, appId
    
    UpdateRelatedFieldAppId = True

End Function

'
'■ Kintoneのフィールド削除
'
Public Function DeleteFormField(formInfo As Dictionary, fieldName As Variant) As Boolean

    Dim fields As Dictionary
    Set fields = formInfo(KIN_JSON_ATTR_PROPERTIES)
    
    DeleteFormField = False
    If fields.Exists(fieldName) Then
        fields.Remove fieldName
        DeleteFormField = True
    End If

End Function
'
'□ GET 共通処理
'    url --- kintone API とパラメータを含む
'    errMsg --- 呼び出し元の処理内容
'
'    成功したら、JSON オブジェクトを返す
'
Private Function commonGetApi(url As String, errMsg As String) As Dictionary
    Dim resBody As String
    Dim resJson As Dictionary
    Set resJson = New Dictionary
    
    resBody = kinGet(url)
    
    resBody = Replace(resBody, vbLf, "")
    resBody = Replace(resBody, vbCrLf, "")
    
#If DebugLevel > 20 Then
    Debug.Print resBody
#End If

    'エラーハンドリング(kintoneでは200以外はエラー)
    If comRest.status <> 200 Then
        Dim errJson As Dictionary
        Set errJson = ParseJson(resBody)
        MsgBox errMsg & "でエラー：" & errJson(KIN_JSON_ATTR_MESSAGE)
        Err.Raise USER_ERROR_EXIT, "commonGetApi", USER_ERROR_EXIT_MSG

    Else
        Set resJson = ParseJson(resBody)
    End If

    Set commonGetApi = resJson

End Function

'
'□ POST 共通処理
'    url --- kintone API とパラメータを含む
'    reqJson --- 引き渡す JSON オブジェクト
'    errMsg --- 呼び出し元の処理内容
'
'    成功したら、JSON オブジェクトを返す
'
Private Function commonPostApi(url As String, reqJson As Dictionary, errMsg As String) As Dictionary
    Set commonPostApi = commonPutPostApi(True, url, reqJson, errMsg)
End Function


'
'□ PUT 共通処理
'    url --- kintone API とパラメータを含む
'    reqJson --- 引き渡す JSON オブジェクト
'    errMsg --- 呼び出し元の処理内容
'
'    成功したら、JSON オブジェクトを返す
'
Private Function commonPutApi(url As String, reqJson As Dictionary, errMsg As String) As Dictionary
    Set commonPutApi = commonPutPostApi(False, url, reqJson, errMsg)
End Function

'
'□ PUT/POST 共通処理
'
'   使い分ける違いが解からない。上書きがPUTか・・・
'
Private Function commonPutPostApi(isPost As Boolean, url As String, reqJson As Dictionary, errMsg As String) As Dictionary
    Dim resBody As String
    Dim resJson As Dictionary
    Set resJson = New Dictionary

#If DebugLevel > 10 Then
    Dim strJson As String
    strJson = ConvertToJson(reqJson)
    Debug.Print strJson
#End If
    
    If isPost Then
        resBody = kinPostJson(url, reqJson)
    Else
        resBody = kinPutJson(url, reqJson)
    End If
    
    resBody = Replace(resBody, vbLf, "")
    resBody = Replace(resBody, vbCrLf, "")
    
#If DebugLevel > 20 Then
    Debug.Print resBody
#End If

    'エラーハンドリング(kintoneでは200以外はエラー)
    If comRest.status <> 200 Then
        Dim errJson As Dictionary
        Set errJson = ParseJson(resBody)
        MsgBox errMsg & "でエラー：" & errJson(KIN_JSON_ATTR_MESSAGE)
        Err.Raise USER_ERROR_EXIT, "commonPutPostApi", USER_ERROR_EXIT_MSG

    Else
        Set resJson = ParseJson(resBody)
    End If

    Set commonPutPostApi = resJson

End Function

'
'□ GET
'  URI が違う場合だけの共通処理
'  API文字列以降を渡す
'  URLエンコードは呼び出し側で行っておくこと
'
Private Function kinGet(kinApiUri As String) As String
    Dim resBody As String

    ' 全体をやっちゃダメ(パラメータ以降だけ)
    ' encodedUrl = Application.WorksheetFunction.EncodeURL(kinApiUri)
    resBody = comRest.ExecGet("https://" + kinSubDomain + "." + KINTONE_DOMAIN + kinApiUri)
        
#If DebugLevel > 1 Then
    Debug.Print resBody
#End If
    
    kinGet = resBody

End Function

'
'□ GET Json
'  滅多に無い呼び出し方法だが・・・
Private Function kinGetJson(kinApiUri As String, objJson As Dictionary) As String
    Dim resBody As String
    
#If DebugLevel > 10 Then
    Dim strJson As String
    strJson = ConvertToJson(objJson)
    Debug.Print strJson
#End If

    ' 全体をやっちゃダメ(パラメータ以降だけ)
    ' encodedUrl = Application.WorksheetFunction.EncodeURL(kinApiUri)
    resBody = comRest.ExecGetJson("https://" + kinSubDomain + "." + KINTONE_DOMAIN + kinApiUri, objJson)
        
#If DebugLevel > 1 Then
    Debug.Print resBody
#End If
    
    kinGetJson = resBody

End Function

'
'□ POST JSON
'  URI が違う場合だけの共通処理
'  JSON はオブジェクトのまま渡す
'
Private Function kinPostJson(kinApiUri As String, objAppJson As Object) As String
    Dim resBody As String
    
#If DebugLevel > 10 Then
    Dim strJson As String
    strJson = ConvertToJson(objAppJson)
    Debug.Print strJson
#End If
    resBody = comRest.ExecPostJson("https://" + kinSubDomain + "." + KINTONE_DOMAIN + kinApiUri, objAppJson)
    
#If DebugLevel > 1 Then
    Debug.Print resBody
#End If
    kinPostJson = resBody

End Function

'
'□ PUT JSON
'  URI が違う場合だけの共通処理
'  JSON はオブジェクトのまま渡す
'
Private Function kinPutJson(kinApiUri As String, objAppJson As Object) As String
    Dim resBody As String
    
#If DebugLevel > 10 Then
    Dim strJson As String
    strJson = ConvertToJson(objAppJson)
    Debug.Print strJson
#End If

    resBody = comRest.ExecPutJson("https://" + kinSubDomain + "." + KINTONE_DOMAIN + kinApiUri, objAppJson)
    
#If DebugLevel > 1 Then
    Debug.Print resBody
#End If
    kinPutJson = resBody

End Function

'
'□ DELETE JSON
'  URI が違う場合だけの共通処理
'  JSON はオブジェクトのまま渡す
'
Private Function kinDeleteJson(kinApiUri As String, objAppJson As Object) As String
    Dim resBody As String
    
#If DebugLevel > 10 Then
    Dim strJson As String
    strJson = ConvertToJson(objAppJson)
    Debug.Print strJson
#End If

    resBody = comRest.ExecDeleteJson("https://" + kinSubDomain + "." + KINTONE_DOMAIN + kinApiUri, objAppJson)
    
#If DebugLevel > 1 Then
    Debug.Print resBody
#End If

    kinDeleteJson = resBody

End Function

'
'◆ ユーティリティ ◆

'
'■ Kintoneの型を考慮した値の比較
'
'   kintoneの値 - 比較値 -> -1,0,1 の何れかを返す
'
Public Function CompareValue(fieldName As String, kinValue As Variant, dataValue As Variant) As Integer
    Dim retVal As Integer
    retVal = 0
    
    If IsNumType(fieldName) Then
        Dim kinVal As Double
        Dim dVal As Double
        
        If IsNull(kinValue) Then
            kinVal = 0
        ElseIf VarType(kinValue) = vbString Then
            kinVal = val(kinValue)
        Else
            kinVal = kinValue
        End If
        
        If IsNull(dataValue) Then
            dVal = 0
        ElseIf VarType(dataValue) = vbString Then
            dVal = val(dataValue)
        Else
            dVal = dataValue
        End If
        
        If kinVal > dVal Then retVal = 1
        If kinVal < dVal Then retVal = -1
        
    Else
        Dim kinStr As String
        Dim dStr As String
        
        If IsNull(kinValue) Then
            kinStr = ""
        Else
            kinStr = kinValue
        End If
        
        If IsNull(dataValue) Then
            dStr = ""
        Else
            dStr = dataValue
        End If
        
        If kinStr > dStr Then retVal = 1
        If kinStr < dStr Then retVal = -1
    
    End If
    
    CompareValue = retVal

End Function

'
' ブランクフォームの項目
'
'   将来変更される可能性がある
'
Public Function GetBlankFormFields() As Collection
    Dim formFields As Collection
    Set formFields = New Collection
    
    formFields.Add "カテゴリー"
    formFields.Add "レコード番号"
    formFields.Add "作業者"
    formFields.Add "更新者"
    formFields.Add "作成者"
    formFields.Add "ステータス"
    formFields.Add "更新日時"
    formFields.Add "作成日時"
    
    Set GetBlankFormFields = formFields

End Function
