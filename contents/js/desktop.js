jQuery.noConflict();

(function($, PLUGIN_ID) {
    'use strict';

    // プラグインの設定値読み込み
    var config = kintone.plugin.app.getConfig(PLUGIN_ID);
    if (!config) {
        return false;
    }

    var BOX_API_BASE_URL = 'https://api.box.com/2.0';
    var MAX_DEPTH = 5; // 最大Boxフォルダ階層
    var configChildFolderFields   = [];   // config の階層名が入るフィールドコードの配列
    var configChildFolderFldNames = null; // config の階層名が入るフィールド名の配列(オートコンプリートで使用する)
    var selectOnlyDepth = parseInt(config.childFolderSelectOnlyDepth) || 0;  // 選択のみに制限する階層数
    var maxDelayTime = parseInt(config.maxDelayTime) || 0;  // 最大遅延時間(使う事は無いが機能は残している)
    var delayCount = maxDelayTime; // 残り遅延時間(使う事は無いが機能は残している)
    var delayCancel = false;       // キャンセル指示(使う事は無いが機能は残している)
    var autocomplateFldData = [];  // 階層ごとのオートコンプリート用 option 文字列

    // ドロップダウン(セレクトボックス)のエレメント
    var select1; 
    var select2;
    var select3;
    var select4;
    var select5;

    var selectArray = Array( MAX_DEPTH ); // 上の select1～5の配列操作用(将来的にはこちらで統一)

    // 多言語化の作法
    // 例) event.error = i18n.failed_to_create_folder;
    var terms = {
        'en': {
            'failed_to_create_folder': 'Cannot create new folder.',
            'failed_to_create_folder': 'Cannot create new sub folder.',
            'enter_box_folder_name_field': 'Box folder name field is required.',
            'item_name_in_use': 'folder name in use.',
            'item_name_invalid': 'folder name contain invalid character.',
            'error': 'Error:'
        },
        'ja': {
            'failed_to_create_folder': 'フォルダを作成できません。内容を修正後再度試してください。',
            'failed_to_create_subfolder': 'サブフォルダを作成できません。',
            'enter_box_folder_name_field': 'Boxフォルダー名フィールドは必須です。',
            'item_name_in_use': '同じ名前のフォルダーが既にあります。',
            'item_name_invalid': 'フォルダ名に使用できない文字が含まれています。',
            'error': 'Error:'
        }
    };
    var lang = kintone.getLoginUser().language;
    var i18n = (lang in terms) ? terms[lang] : terms['en'];

    // config の階層名項目を配列へ(configでは配列の保存はできない)
    configChildFolderFields  = [];
    if( config.child1FolderNameFld ) {
        configChildFolderFields.push( config.child1FolderNameFld ); 
        if( config.child2FolderNameFld ) {
            configChildFolderFields.push( config.child2FolderNameFld ); 
            if( config.child3FolderNameFld ) {
                configChildFolderFields.push( config.child3FolderNameFld) ; 
                if( config.child4FolderNameFld ) {
                    configChildFolderFields.push( config.child4FolderNameFld ); 
                    if( config.child5FolderNameFld ) {
                        configChildFolderFields.push( config.child5FolderNameFld );
                    }
                }
            }
        } 
    } 
      
    // 良くあるBoxのエラーを要約する
    function translateBoxErrorMsg( box_response ) {
        if( box_response.indexOf("item_name_in_use") != -1 ) {
            return i18n.item_name_in_use;
        }  
        if( box_response.indexOf("item_name_invalid") != -1 ) {
            return i18n.item_name_invalid;
        }  
        return box_response ;
    }

    //
    // ■ 遅延制御と処理のスキップ
    //
    //    複数プラグインが非同期で呼び出される事を想定した機能で
    //    現状は、javascript -> 最古に登録されたプラグイン -> ・・・ -> 最新のプラグイン
    //    の順で同期呼び出しされているので特に使う場面が無い。
    //    本プラグインが正常処理された後に別のプラグインでエラーになるとBoxとの不整合が起きる。

    //
    //  javascript から呼び出す関数
    //  ※ 結局必要無かった。唯一、setCancel() を事前に呼び出せば、本プラグインの処理だけをスキップできる。
    //  (使用例）window.BoxUiPlugin.setCancel(); 
    var BoxUiPlugin = {
        setDone : function() {
            delayCount = 0;
        },
        setCancel : function() {
            delayCount  = 0;
            delayCancel = true;
        }
    }
    window.BoxUiPlugin = BoxUiPlugin;

    // 遅延初期化  編集開始時に設定する(使う場面は無いが機能は残している)
    function delayInit() {
        if( maxDelayTime > 0 ) {
            delayCount  = maxDelayTime*10; // 10ms刻み
            delayCancel = false;
        }
    }

    // 指定時間停止(ms)
    async function sleep(ms) {
        return new Promise( function(resolve) { setTimeout(resolve, ms); });
    }

    // 遅延待ち
    async function delayWait() {
        var isCancel = false;
        while( delayCount > 0  ) {
            await sleep(10);
            delayCount--;
        }
        isCancel = delayCancel;
        delayInit(); // 次回の用意
        return isCancel;
    }

    // config 情報の読込とチェック(イベントの都度呼ぶ)
    //   現状は特に意味は無い
    var validateConfig = function(record) {
        config = kintone.plugin.app.getConfig(PLUGIN_ID);
        if (!config) {return false;}
        return true;
    }

    //
    // ■ Box の処理
    //

    // Box UI Element の表示
    //  いくつかのオプションは設定できると良いかも(Todo)
    function dsp_box_ui_view( access_token, folder_id, element_id ) {

        var element_selector = "#" + element_id;

        var contentExplorer = new Box.ContentExplorer();  
        contentExplorer.show( folder_id, access_token, {
            container: element_selector,logoUrl: "box",
            size: "large",
            canCreateNewFolder : false
        });
    }

    // Boxのフォルダー作成
    //  成功なら json オブジェクトを返す。失敗なら xhr オブジェクトを Throw する
    async function create_box_folder( parent_folder_id, folder_name) {

        var param = {name: folder_name, parent: {id: parent_folder_id}}; 
        var result;
        try {
            result = await ajax_post( BOX_API_BASE_URL + '/folders', config.boxAppToken, param );
        } catch(e) {
            throw e;
        }
        return result;
    }

    // Box 指定フォルダ内に同じ名前のフォルダがあるか探す
    //  存在すれば folder_id を返す。無ければ null
    async function search_folder(parent_folder_id, folder_name ) {
        var folder_id = null;
        try {
          // フォルダ情報では100までしか返らない /folder/items を使う
          var result = await get_folder_items( parent_folder_id );
          var folder = result.entries.find( function(item) {
              return item.type === "folder" && item.name === folder_name ;
          }); 
          if( folder ) folder_id = folder.id;
        } catch(e) {
          throw e;
        }
        return folder_id;
    }

    // Box フォルダ内が空かどうかチェックする
    //  空なら Trueを返す。あれば Falseを返す
    function is_folder_empty( folder_info ) {
        if( folder_info.item_collection ) {
            var entries = folder_info.item_collection.entries;
            if( entries.length == 0 ) return true;
        }
        return false;
    }

    // Box のフォルダの情報を取得
    //   files <= 100 なので全て取得できる訳ではないので注意
    //   成功なら json オブジェクト, 失敗なら xhr を Throw する
    async function get_folder_info(folder_id) {
        try {
            return ajax_get( BOX_API_BASE_URL + '/folders/' + folder_id, config.boxAppToken );
        } catch(e) {
          throw e;
        }
        return null;
    }

    // Box のフォルダ内のファイル情報を取得
    //   成功なら json オブジェクト, 失敗なら xhr を Throw する
    async function get_folder_items(folder_id) {
        try {
            // default limit=100 1000件以上の場合はoffsetかmarkerを使う。(ToDo)
            return ajax_get( BOX_API_BASE_URL + '/folders/' + folder_id + '/items?fields=type,id,sequence_id,etag,name,description&limit=1000', config.boxAppToken );
        } catch(e) {
          throw e;
        }
        return null;
    }

    // Boxのフォルダー削除
    //  成功なら true。失敗なら false で xhr オブジェクトを Throw する
    async function delete_box_folder( folder_id ) {
        try {
            var result = await ajax_delete( BOX_API_BASE_URL + '/folders/' + folder_id, config.boxAppToken );
            return true;
        } catch(e) {
            throw e;
        }
        return false;
    }

    // フォルダが空なら削除する
    //   成功なら True。失敗なら False を返す。
    //   空かどうかの判定が必要ならフォルダ情報取得と削除処理を分けて呼び出す。
    async function delete_empty_folder( folder_id ) {
        var status = false;
        try {
            var folder_info = await get_folder_info( folder_id );
            if( is_folder_empty( folder_info  ) ) {
                status = await delete_box_folder( folder_id );
            }
        } catch(e) {
            status = false;
        }
        return status;
    }

    // サブフォルダの存在チェックと登録(再帰あり)
    //  最後のサブフォルダIDを返す。エラーがあれば event.error に内容を設定。
    async function createSubfolder( depth, parent_folder_id, record) { 
        var fieldName = configChildFolderFields [depth];
        if( fieldName && record[ fieldName ].value ) {
            try {
                var folder_id = await search_folder(parent_folder_id, record[ fieldName ].value);
                if( folder_id == null ) {
                    var result = await create_box_folder(parent_folder_id, record[ fieldName ].value);  
                    folder_id = result.id;
                } 
                // さらに階層があるか？
                if( depth + 1 < configChildFolderFields.length ) {
                    folder_id = await createSubfolder( depth+1, folder_id, record ); // 再帰
                }
                return folder_id;
            } catch(e) {
                event.error = i18n.failed_to_create_subfolder + '\n' + e.status + '\n' + e.responseText ;   
            }
        }
        return parent_folder_id;
    }

    //
    // ■ Box API GET/DELETE Ajax 
    //

    // ajax "GET"
    async function ajax_get(url, access_token ) {
        return ajax_get_delete( url, "GET", access_token );
    }
    // ajax "DELETE"
    async function ajax_delete(url, access_token ) {
        return ajax_get_delete( url, "DELETE", access_token );
    }

    // ajax "GET","DELETE" 共通処理(渡すパラメータが無いメソッド )
    function ajax_get_delete(url, method, access_token ) {

        var deferred = new $.Deferred();

        $.ajax({
          url: url,
          type: method,
          headers: {
            "Authorization":"Bearer " + access_token
          },
          contentType: 'application/json',
          timeout: 10000
        }).done(function(result, textStatus, xhr) {
            deferred.resolve(result); 
        }).fail(function(xhr, textStatus, error) {
            deferred.reject(xhr);  
        }); // ajax()

        return deferred.promise();
    }

    // ajax "POST"
    async function ajax_post( url, access_token, obj_json ) {
        return ajax_post_put( url, "POST", access_token, obj_json );
    }

    // ajax "PUT" 今回は使っていない 
    async function ajax_put( url, access_token, obj_json ) {
        return ajax_post_put( url, "PUT", access_token, obj_json );
    }

    // ajax "POST","PUT" 共通処理(渡すパラメータが有るメソッド )
    function ajax_post_put( url, method, access_token, obj_json ) {

        var deferred = new $.Deferred();

        $.ajax({
          url: url,
          type: method,
          headers: {
          "Authorization":"Bearer " + access_token
          },
          contentType: 'application/json',
          data: JSON.stringify(obj_json),
          timeout: 10000
        }).done(function(result, textStatus, xhr) {
            deferred.resolve(result); 
        }).fail(function(xhr, textStatus, error) {
            deferred.reject(xhr);  
        }); // ajax()

        return deferred.promise();
    }

    //
    // ■ Boxフォルダ階層選択ドロップダウン
    //

    //  ドロップダウン(select)のエレメント作成
    //     51-modern-default.css を利用
    var createDropdownElement = function( id ) {

        // ★ jQuery のエレメントは kintone.app.record.getHeaderMenuSpaceElement().appendChild()でエラーになる。
        // var element = $('<div>'); ×

        var element = document.createElement('div');
        element.className = 'kintoneplugin-select-outer-box-ui';

        element.innerHTML = 
               '<div class="kintoneplugin-select-box-ui">' +
               '<select id="' + id + '">' +
               '</select>' +
               '</div>' 
            ;
 
        return element;
    }

    // Box フォルダ情報取得
    async function getBoxFolderEntries( folder_id ) {
        var entries;
        try {
            var result = await get_folder_items( folder_id );
            entries = result.entries;
        } catch(e) {
           // none
        }
        return entries;
    }

    // ドロップダウン(select)の選択肢の作成
    //   Box のディレクトリからリストを作成
    //   fieldIndex : 1～MAX_DEPTH
    var setSelectItems = function( entries, fieldIndex ) {

        var select = selectArray[ fieldIndex-1 ];
        if( !select ) return;

        var option_html = '<option value=""></option>';

        if( entries ) {

            // 標準では"name"順にしか出来ないので、"description"(説明)でソート出来るようにした。
            var sorted = entries.sort(function(item1,item2) {
                if( item1.description > item2.description ) return  1;    
                if( item1.description < item2.description ) return -1;    
                if( item1.name >= item2.description ) return  1;    
                if( item1.name <  item2.description ) return -1;    
            });

            // 子フォルダをリストに追加 
            sorted.forEach(function(item) {
                if( item.type === 'folder' ) { 
                    option_html += '<option value="' + item.id + '">' + item.name + '</option>';                    
                }
            });
            select.innerHTML = option_html; // レンダリング
        }
    }

    // 階層ドロップダウン用スペースの非表示
    function hidden_dropdown_spaces() {
        if( config.child1FolderSelectSpace ) {
            kintone.app.record.getSpaceElement( config.child1FolderSelectSpace ).parentNode.style.display = 'none';
        }   
        if( config.child2FolderSelectSpace ) {
            kintone.app.record.getSpaceElement( config.child2FolderSelectSpace ).parentNode.style.display = 'none';
        }   
        if( config.child3FolderSelectSpace ) {
            kintone.app.record.getSpaceElement( config.child3FolderSelectSpace ).parentNode.style.display = 'none';
        }   
        if( config.child4FolderSelectSpace ) {
            kintone.app.record.getSpaceElement( config.child4FolderSelectSpace ).parentNode.style.display = 'none';
        }   
        if( config.child5FolderSelectSpace ) {
            kintone.app.record.getSpaceElement( config.child5FolderSelectSpace ).parentNode.style.display = 'none';
        }   
    }

    // select box text による選択
    //    selectエレメントを指定 value を返す(filter使うな simple is better!)
    function setSelectedByText( select, text ) {
        var options = select.options;
        for(var i = 0; i < options.length; i++){
	    if(options[i].text === text ){
		options[i].selected = true;
		return options[i].value;
	    };
        };
    }

    //
    // Boxフォルダ階層選択ドロップダウン表示
    //    新規入力画面を開いた際に設定
    //
    var displayDropDown = async function(event) {
        var record = event.record;
        var subfolder_id;  // レコード複写登録時のリスト作成用

        // config に設定があればドロップダウンを表示
        //   複写入力時の初期化も考慮
        if( config.child1FolderSelectSpace ) {

            // DOM 割り当て
            select1 = createDropDownElement( 'dropdown_select_1', config.child1FolderSelectSpace, 1 );
            subfolder_id = await setDropdownByText(  config.parentFolderId , 1, record[ config.child1FolderNameFld ].value );
        }
        if( config.child2FolderSelectSpace ) {
            select2 = createDropDownElement( 'dropdown_select_2', config.child2FolderSelectSpace, 2 );
            subfolder_id = await setDropdownByText(  subfolder_id , 2, record[ config.child2FolderNameFld ].value );
        }
        if( config.child3FolderSelectSpace ) {
            select3 = createDropDownElement( 'dropdown_select_3', config.child3FolderSelectSpace, 3 );
            subfolder_id = await setDropdownByText(  subfolder_id , 3, record[ config.child3FolderNameFld ].value );
        }
        if( config.child4FolderSelectSpace ) {
            select4 = createDropDownElement( 'dropdown_select_4', config.child4FolderSelectSpace, 4 );
            subfolder_id = await setDropdownByText(  subfolder_id , 4, record[ config.child4FolderNameFld ].value );
        }
        if( config.child5FolderSelectSpace ) {
            select5 = createDropDownElement( 'dropdown_select_5', config.child5FolderSelectSpace, 5 );
            await setDropdownByText(  subfolder_id , 5, record[ config.child5FolderNameFld ].value );
        }

        // ドロップダウンのイベント処理
        if( select1 ) {

            // 選択時のイベント処理
            select1.addEventListener('change', async function(event) {
                await selectEventCommon( 1 );
            });
        }
        if( select2 ) {
            select2.addEventListener('change', async function(event) {
                await selectEventCommon( 2 );
            });
        }
        if( select3 ) {
            select3.addEventListener('change', async function(event) {
                await selectEventCommon( 3 );
            });
        }
        if( select4 ) {
            select4.addEventListener('change', async function(event) {
                await selectEventCommon( 4 );
            });
        }
        if( select5 ) {
            select5.addEventListener('change', async function(event) {
                await selectEventCommon( 5 );
            });
        }
        return event;
    }

    // DOMの割り当て
    function createDropDownElement( elementId, spaceCode, fieldIndex ) {
            var dropdown = createDropdownElement( elementId );
            kintone.app.record.getSpaceElement( spaceCode ).appendChild(dropdown);
            var select = $('#' + elementId ).get(0);
            selectArray[fieldIndex-1] = select;
            return select;
    }

    // 次のドロップダウンの設定
    async function setDropdownByText( prevFolderId, fieldIndex, selectedText ) {
        var folder_id;

        if( prevFolderId ) {        
            var entries = await getBoxFolderEntries( prevFolderId );
            setSelectItems(  entries, fieldIndex ); // ドロップダウン設定 
            setAutocomplete( entries, fieldIndex ); // オートコンプリート設定
            if( selectedText ) {
                 folder_id = setSelectedByText( selectArray[ fieldIndex], selectedText );
            }
        }
        return folder_id;
    }

    // ドロップダウンのイベント共通処理(非 kintone.events.on 内)
    //   選択された値の文字フィールドへの設定と下位ドロップダウンへの値設定
    async function selectEventCommon( fieldIndex ) {
        if( fieldIndex <= 0 || fieldIndex > MAX_DEPTH ) return;
        var select = selectArray[fieldIndex-1];
        if( !select ) return;

        // 値を別のフィールドにも設定
        var record = kintone.app.record.get(); // レコード情報のコピー
        var option = select.options[ select.selectedIndex ];
        record.record[ configChildFolderFields[ fieldIndex-1 ] ].value = option.text;

        // 下位層の選択肢の作成
        if( fieldIndex < selectArray.length ) {
            var entries = await getBoxFolderEntries( option.value ); // フォルダID
            setSelectItems(  entries, fieldIndex+1 ); // ドロップダウン設定 
            setAutocomplete( entries, fieldIndex+1 ); // オートコンプリート設定
            record.record[ configChildFolderFields[fieldIndex] ].value = '';

        }
        // さらに下位はクリア
        for( var i = fieldIndex+1; i < selectArray.length; i++ ) { 
            if( !selectArray[i] ) break;
            selectArray[i].innerHTML = '';
            record.record[ configChildFolderFields[i] ].value = '';
        }
        kintone.app.record.set(record) ; // レコード情報の反映
    }

    // サブフォルダの入力禁止
    function disableSubFolderFields( event ) {
        for( var i = 0; i < configChildFolderFields.length ; i++ ) {
            if( i >= selectOnlyDepth ) break;
            event.record[configChildFolderFields [i]]['disabled'] = true;  
        }     
    }

    // select box の値が選択済か
    function isSelected(select, text ) {
        if( select.selectedIndex === -1 ) return false;
        if( select.options[ select.selectedIndex ].text === text ) return true;
        return false;  
    }

    // select box の値を選択する
    //  選択できたら true を返す
    function setSelectedText(select, text ) {
        for( var i = 0; i < select.length; i++ ) {
            if( select.options[ i ].text === text ) {
                select.selectedIndex = i;
                return true;
            }
        }
        return false;
    }

    //
    // ■ オートコンプリート  
    //
 
    // フィールドコードからフィールド名の取得
    //    ※ kintone.app.record.getFieldElement() は編集画面では使えない(nullが返る)
    //    ただしラベル非表示の場合使えないので注意。
    var getFieldNames = async function() {

        // １回だけで良い
        //   プラグインの読み込み時に行いたいが非同期処理が行えない。
        //   無理やり new kintone.api.promise() で実行しても良いかも・・・。
        if( configChildFolderFldNames ) return;

        var fieldsInfo = await kintone.api(
            kintone.api.url("/k/v1/app/form/fields.json", true), "GET",
            { app: kintone.app.getId() }
        );
        configChildFolderFldNames  = [];
        for( var i = 0; i < configChildFolderFields.length; i++ ) {
             configChildFolderFldNames.push( fieldsInfo.properties[ configChildFolderFields[i] ].label );    
        }

    }

    // フィールド名(フィールドコードでは無い)からDOMエレメントの取得
    //    kintone.app.record.getFieldElement() は編集画面では使えない(nullが返る)
    //   ラベルを非表示にすると取得できないので注意。
    //   ラベルなしでエレメントを取得する術が無い。
    var getFieldInputElement = function(fieldName){
        var input;

        $('.control-gaia').each(function(index, element){
            if($(element).find('.control-label-text-gaia').text() === fieldName){
                input = $(element).find('input');
            }
        });

        return input;
    };

    // オートコンプリートのデータ設定
    //   fieldNameIndex : 1～MAX_DEPTH
    //   entries : box api result
    function setAutocomplete( entries, fieldIndex ) {
        if( fieldIndex < 1 || fieldIndex > MAX_DEPTH ) return; 
        var fieldName = configChildFolderFldNames[ fieldIndex-1 ];        
        var data = [];         
        
        // リストに追加 
        entries.forEach(function(item) {
            if( item.type === 'folder' ) { 
                data.push( item.name );                    
            }
        });
        if( data.length == 0 ) return;

        autocomplateFldData[ fieldIndex-1 ] = data;   

        var element = getFieldInputElement( fieldName );

        // 各階層のイベント処理は共通で良い
        if( element ) {
            // jQuery-UI
            element.autocomplete({
                source: autocomplateFldData[ fieldIndex-1 ]
            });
        }

    }

    //
    // ■ Kintone のイベント処理(共通)
    //

    // レコード保存処理(共通)
    //    event を返すこと
    async function submitRecord(event) {

        // config の設定情報チェック
        if (!validateConfig(event.record)) {
            event.error = i18n.failed_to_create_folder;
            return event;
        }
 
        // 遅延制御 キャンセルなら処理をしない
        var isCancel = await delayWait();
        if( isCancel ) return event;

        // フォルダ名は必須
        if (!event.record[config.folderNameFld].value) {
            event.record[config.folderNameFld].error = i18n.enter_box_folder_name_field;
            return event;
        }

        var error = null;
        var record = event.record;

        var parent_folder_id = config.parentFolderId;

        // 子フォルダの設定があるか？
        //   既にフォルダがあればフォルダIDを取得。無ければ作成しフォルダIDを取得
        parent_folder_id = await createSubfolder( 0, parent_folder_id, record);

        // エラーが無ければファイル格納用のフォルダーを作成
        if( !event.error ) {
            var result;
            try {
                var folder_name = record[config.folderNameFld]["value"];  
                result = await create_box_folder(parent_folder_id, folder_name);   
                // 作成成功ならフォルダIDをフィールドに格納
                event.record[config.folderIdFld].value = result.id;   
            } catch(e) {
                error = i18n.failed_to_create_folder + '\n' + translateBoxErrorMsg(JSON.stringify(JSON.parse(e.responseText))) ;               
            }
        }
        if (error) {event.error = error;}
        return event;
    };

    // レコード削除処理(共通)
    //    event を返すこと
    async function submitDeleteRecord(event) {

        var record = event.record;
        var error = null;

        // config の設定情報チェック
        if (!validateConfig(event.record)) {
            event.error = i18n.failed_to_create_folder;
            return event;
        }

        // 遅延制御 キャンセルなら処理をしない
        var isCancel = await delayWait();
        if( isCancel ) return event;

        // フォルダIDが無ければ何もしない
        if (!record[config.folderIdFld].value) return event;

        // 階層名を配列へ(後ろから削除していく為)
        var childFolderNames = [];
        for( var i = 0; i < configChildFolderFields.length; i++ ) {
            var folderName = record[ configChildFolderFields [i] ].value;
            if( folderName ) {
                childFolderNames.push( folderName );
            } 
        }

        // まず自フォルダの削除
        var status = false;
        var folder_info;
        try {
            // Boxからフォルダの階層情報を取得
            folder_info = await get_folder_info( record[config.folderIdFld].value );
            if( is_folder_empty(folder_info) ) {
                status = await delete_box_folder( record[config.folderIdFld].value );
            } else {
                error = "フォルダが空ではありません";
                status = false;
            }
        } catch(e) {
            var msg = "フォルダ見つからないか、もしくは権限がありません";
            var res = confirm( msg + "\n無視して処理を続行しますか？");
            if (res === false) {   
                error = "処理がキャンセルされました。"
                status = false;
            } 
        }
        // 階層フォルダ情報があれば可能(空)なら削除
        if( status && childFolderNames.length > 0 ) {
            try {
                if( folder_info.path_collection ) {
                    // 階層の配列->parents(0:全てのファイル=root)
                    var parents = folder_info.path_collection.entries;
                    // 後方から照合していく
                    var j = childFolderNames.length - 1; 
                    for( var i = parents.length - 1; j >= 0 && i > 1 ; i-- ) {
                        var parent = parents[i];
                        if( parent.type === "folder" && parent.name === childFolderNames[j] ) {
                            var status = await delete_empty_folder( parent.id );
                            if(!status) break; // 失敗したらそこで終了
                            j--;
                        } else break;
                    }
                }

            } catch(e) {
                // 削除できなくても無視             
            }  
        }       
        if (error) {event.error = error;}
        return event;
    };

    // サブフォルダのフィールド変更イベントの処理
    //   非同期関数なので Promise を返す(フィールド変更イベント処理内では無視する事)
    //   フィールドの値の変更はsleep以後の非同期関数内でkintone.app.record.get/setで行う
    //   fieldIndex : 1～MAX_DEPTH
    async function subFolderFieldChange( event, fieldIndex ) {
        var val = event.record[ configChildFolderFields[fieldIndex-1] ].value;
        var select = selectArray[ fieldIndex-1 ] ; // select box のエレメント

        // 既に選択されていれば何もしない
        if( select && !isSelected( select, val ) ) {
            // 選択できれば次の階層を準備する
            if( setSelectedText( select, val ) ) {
                await sleep(1); // 非同期処理が必ず実行される事を担保する
                await selectEventCommon( fieldIndex );
            }
        }
    }

    //
    // ■ Kintone のイベント処理
    //

    // Kintoneのフィールドイベント
    //   ※ このイベント内では、async/await は使えないので注意
    //      非同期処理は、起動した後に待たずこのイベントを終わらせる事で実行することは可能。
    //   子フォルダの入力イベント(セレクトボックスからの設定でも起こる)
    //   まとめて処理できそうだが、どのフィールドで起こったかの情報が無い(changesにも無い) 
    //   入口だけフィールドの数だけ書く。

    if( config.child1FolderNameFld ) {
        kintone.events.on( 'app.record.create.change.' + config.child1FolderNameFld, function(event) {
            subFolderFieldChange( event, 1 ); // async なので戻り値を return しない事 
            return event;
        });
    }
    if( config.child2FolderNameFld ) {
        kintone.events.on( 'app.record.create.change.' + config.child2FolderNameFld, function(event) {
            subFolderFieldChange( event, 2 );
            return event;
        });
    }
    if( config.child3FolderNameFld ) {
        kintone.events.on( 'app.record.create.change.' + config.child3FolderNameFld, function(event) {
            subFolderFieldChange( event, 3 );
            return event;
        });
    }
    if( config.child4FolderNameFld ) {
        kintone.events.on( 'app.record.create.change.' + config.child4FolderNameFld, function(event) {
            subFolderFieldChange( event, 4 );
            return event;
        });
    }
    if( config.child5FolderNameFld ) {
        kintone.events.on( 'app.record.create.change.' + config.child5FolderNameFld, function(event) {
            subFolderFieldChange( event, 5 );
            return event;
        });
    }

    // 明細新規
    kintone.events.on('app.record.create.show', async function(event) {
        if (validateConfig(event.record)) {

            // 複写時の対応
            event.record[config.folderIdFld]["value"] = '';    

            // フォルダIDは入力禁止
            event.record[config.folderIdFld]['disabled'] = true;
  
            await getFieldNames(); // フィールド名の取得 

            displayDropDown( event ); // ドロップダウン表示

        }
        disableSubFolderFields( event );
        return event;
    });

    // 明細編集
    kintone.events.on('app.record.edit.show', async function(event) {
        if (validateConfig(event.record)) {

            await getFieldNames(); // フィールド名の取得 

            // 「フォルダ名」は普通入力必須にするので入力可能になる場合は無い
            //  ここでは「フォルダ名」と「フォルダID」が共に入力されていない場合の想定。

            // フォルダIDは入力禁止
            event.record[config.folderIdFld]['disabled'] = true; 

            // フォルダIDに値があればフォルダ名は変更禁止
            //   フォルダ名の変更は出来ないので。
            if (event.record[config.folderIdFld]["value"]) { 
                event.record[config.folderNameFld]['disabled'] = true;  
                for( var i = 0; i < configChildFolderFields.length; i++ ) {
                    event.record[ configChildFolderFields[i] ]['disabled'] = true;  
                }
                hidden_dropdown_spaces(); // 階層ドロップダウン用スペース非表示

            } else {
                disableSubFolderFields( event );   
                displayDropDown( event );
            }
            
        }
        return event;
    });

    // リスト編集時
    kintone.events.on('app.record.index.edit.show', async function(event) {
        if (validateConfig(event.record)) {
            event.record[config.folderNameFld]['disabled'] = true;
            event.record[config.folderIdFld]['disabled'] = true;
            for( var i = 0; i < configChildFolderFields.length; i++ ) {
                event.record[ configChildFolderFields[i] ]['disabled'] = true;  
            }
        }
        return event;
    });

    kintone.events.on('app.record.index.show', async function(event) {
        return event;
    });

    // 詳細画面表示時の処理
    kintone.events.on('app.record.detail.show', async function(event) {

        if (validateConfig(event.record)) {

            await getFieldNames(); // フィールド名の取得 

            var folder_id = event.record[config.folderIdFld]["value"];  

            if ( folder_id ) {
                // Box UIElement 表示エレメント作成
                var box_ui_element = document.createElement('div');
                box_ui_element.id = 'box_ui_element';

                // スペース位置にエレメントを追加する
                kintone.app.record.getSpaceElement(config.boxUiSpace).appendChild(box_ui_element);
                //   スペースの枠(親要素にある)の min-width と同じに設定する。(min-heightは指定しても無視される)
                var p_element = kintone.app.record.getSpaceElement(config.boxUiSpace).parentNode;
                box_ui_element.style.setProperty("min-width", p_element.style.minWidth ) ;

                dsp_box_ui_view( config.boxAppToken, folder_id, box_ui_element.id );
            }
            hidden_dropdown_spaces(); // 階層ドロップダウン用スペース非表示
        }
        return event;
    });

    // 新規レコード保存時
    kintone.events.on('app.record.create.submit', async function(event) {
        return submitRecord(event);
    });

    // 編集レコード保存時
    kintone.events.on(['app.record.edit.submit','app.record.index.edit.submit'], async function(event) {
        if (!event.record[config.folderIdFld].value) {
            return submitRecord(event);
        }
        return event;
    });

    // 削除レコード時
    kintone.events.on(['app.record.detail.delete.submit','app.record.index.delete.submit'], async function(event) {
        if (validateConfig(event.record)) {
            // フォルダーIDがあれば削除を試みる
            if (event.record[config.folderIdFld].value) {
                return submitDeleteRecord(event);
            }
        }
        return event;
    });


})(jQuery, kintone.$PLUGIN_ID);
