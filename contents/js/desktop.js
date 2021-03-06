jQuery.noConflict();

(function($, PLUGIN_ID) {
    'use strict';

    var config;

    var BOX_API_BASE_URL = 'https://api.box.com/2.0';
    var configChildFolderNameFlds = []; // config の階層名が入る項目(名)の配列

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

    // config 情報の読込とチェック(イベントの都度呼ぶ)
    //   イベント処理で毎回行う。(record は何に使うんだろう？)
    var validateConfig = function(record) {
        config = kintone.plugin.app.getConfig(PLUGIN_ID);
        if (!config) {return false;}

        // config の階層名項目を配列へ(configでは配列の保存はできない)
        configChildFolderNameFlds = [];
        if( config.child1FolderNameFld ) {
            configChildFolderNameFlds.push( config.child1FolderNameFld ); 
            if( config.child2FolderNameFld ) {
                configChildFolderNameFlds.push( config.child2FolderNameFld ); 
                if( config.child3FolderNameFld ) {
                    configChildFolderNameFlds.push( config.child3FolderNameFld) ; 
                    if( config.child4FolderNameFld ) {
                        configChildFolderNameFlds.push( config.child4FolderNameFld ); 
                        if( config.child5FolderNameFld ) {
                            configChildFolderNameFlds.push( config.child5FolderNameFld );
                        }
                    }
                }
            } 
        }        
        return true;
    };

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
            // default limit=100 1000件以上の場合はoffsetかmarkerを使う。
            return ajax_get( BOX_API_BASE_URL + '/folders/' + folder_id + '/items?limit=1000', config.boxAppToken );
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

    // Box API GET/DELETE Ajax 

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

    // レコード保存処理(共通)
    //    event を返すこと
    var submitRecord = async function(event) {

        // config の設定情報チェック
        if (!validateConfig(event.record)) {
            event.error = i18n.failed_to_create_folder;
            return event;
        }

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

    // サブフォルダの存在チェックと登録(再帰あり)
    //  最後のサブフォルダIDを返す。エラーがあれば event.error に内容を設定。
    async function createSubfolder( depth, parent_folder_id, record) { 
        var fieldName = configChildFolderNameFlds[depth];
        if( fieldName && record[ fieldName ].value ) {
            try {
                var folder_id = await search_folder(parent_folder_id, record[ fieldName ].value);
                if( folder_id == null ) {
                    var result = await create_box_folder(parent_folder_id, record[ fieldName ].value);  
                    folder_id = result.id;
                } 
                // さらに階層があるか？
                if( depth + 1 < configChildFolderNameFlds.length ) {
                    folder_id = await createSubfolder( depth+1, folder_id, record ); // 再帰
                }
                return folder_id;
            } catch(e) {
                event.error = i18n.failed_to_create_subfolder + '\n' + e.status + '\n' + e.responseText ;   
            }
        }
        return parent_folder_id;
    }

    // レコード削除処理(共通)
    //    event を返すこと
    var submitDeleteRecord = async function(event) {

        var record = event.record;
        var error = null;

        // config の設定情報チェック
        if (!validateConfig(event.record)) {
            event.error = i18n.failed_to_create_folder;
            return event;
        }

        // フォルダIDが無ければ何もしない
        if (!record[config.folderIdFld].value) return event;

        // 階層名を配列へ(後ろから削除していく為)
        var childFolderNames = [];
        for( var i = 0; i < configChildFolderNameFlds.length; i++ ) {
            var folderName = record[ configChildFolderNameFlds[i] ].value;
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

    //
    // Boxフォルダ階層選択ドロップダウン
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

    // ドロップダウン(select)の選択肢の作成
    //   Box のディレクトリからリストを作成
    var setSelectItems = async function( folder_id, select ) {
        var option_html = '<option value=""></option>';

        // Box フォルダ情報取得
        var entries;
        try {
            var result = await get_folder_items( folder_id );
            entries = result.entries;
        } catch(e) {
           // none
        }
        if( entries ) {

            // 子フォルダをリストに追加 
            entries.forEach(function(item) {
                if( item.type === 'folder' ) { 
                    option_html += '<option value="' + item.id + '">' + item.name + '</option>';                    
                }
            });
            select.innerHTML = option_html; // レンダリング
        }
    }

    // ドロップダウンの選択肢のクリア(未使用)
    //   KUC を使う場合 
    var clearDropdownItems = function( dropdown ) {
        dropdown.value = ''; // 非選択
        while (dropdown.items.length) {
            dropdown.items.shift();
        }
    }

    // ドロップダウンの選択肢の作成(未使用)
    //   KUC
    var setDropdownItems = async function( folder_id, dropdown) {

        clearDropdownItems(dropdown);

        // dropdown.items.push({label: '-----', value: ''});

        // Box フォルダ情報取得
        var entries;
        try {
            var result = await get_folder_items( folder_id );
            entries = result.entries;
        } catch(e) {
           // none
        }
        if( entries ) {

            // 子フォルダをリストに追加 
            entries.forEach(function(item) {
                if( item.type === 'folder' ) { 
                    dropdown.items.push({
                        label: item.name,
                        value: item.id
                    });
                }
            });
            dropdown.value = ''; // 非選択
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

        // KUC を使う場合(KUCを使うと外から css のカスタマイズが出来ない)
        var dropdown1;
        var dropdown2;
        var dropdown3;
        var dropdown4;
        var dropdown5;

        var select1; 
        var select2;
        var select3;
        var select4;
        var select5;

        // 複写時のリスト作成用
        var subfolder_id1;
        var subfolder_id2;
        var subfolder_id3;
        var subfolder_id4;
        var subfolder_id5;

        // config に設定があればドロップダウンを表示
        //   複写入力時の初期化も考慮
        if( config.child1FolderSelectSpace ) {
  
            // element 作成
            // kuc
            // dropdown1 = new Kuc.Dropdown({items: []});

            // non kuc
            dropdown1 = createDropdownElement('dropdown_select_1');

            // フォルダ選択肢を設定(１階層目は親フォルダ直下)
            // kuc
            // setDropdownItems( config.parentFolderId, dropdown1 ); 

            // DOM に割り当て
            kintone.app.record.getSpaceElement(config.child1FolderSelectSpace).appendChild(dropdown1);

            // non kuc
            select1 = $('#dropdown_select_1').get(0);
            await setSelectItems( config.parentFolderId, select1 ); 

            // フィールドに値があるか(複写時の階層選択設定)
            var selected_name = record[ config.child1FolderNameFld ].value; 
            if( selected_name ) {
                subfolder_id1 = setSelectedByText( select1, selected_name );
            }

        }

        // ２階層以下同様
        if( config.child2FolderSelectSpace ) {
            // kuc
            // dropdown2 = new Kuc.Dropdown({items: []});
            // kintone.app.record.getSpaceElement(config.child2FolderSelectSpace).appendChild(dropdown2);
            // non kuc
            dropdown2 = createDropdownElement('dropdown_select_2');
            kintone.app.record.getSpaceElement(config.child2FolderSelectSpace).appendChild(dropdown2);
            select2 = $('#dropdown_select_2').get(0);

            // フィールドに値があるか(複写時の階層選択設定)
            if( subfolder_id1 ) {
                await setSelectItems( subfolder_id1, select2 ); 
                var selected_name = record[ config.child2FolderNameFld ].value; 
                if( selected_name ) {
                     subfolder_id2 = setSelectedByText( select2, selected_name );
                }
            }

        }
        if( config.child3FolderSelectSpace ) {
            // dropdown3 = new Kuc.Dropdown({items: []});
            // kintone.app.record.getSpaceElement(config.child3FolderSelectSpace).appendChild(dropdown3);
            dropdown3 = createDropdownElement('dropdown_select_3');
            kintone.app.record.getSpaceElement(config.child3FolderSelectSpace).appendChild(dropdown3);
            select3 = $('#dropdown_select_3').get(0);

            // フィールドに値があるか(複写時の階層選択設定)
            if( subfolder_id2 ) {
                await setSelectItems( subfolder_id2, select3 ); 
                var selected_name = record[ config.child3FolderNameFld ].value; 
                if( selected_name ) {
                     subfolder_id3 = setSelectedByText( select3, selected_name );
                }
            }

        }
        if( config.child4FolderSelectSpace ) {
            // dropdown4 = new Kuc.Dropdown({items: []});
            // kintone.app.record.getSpaceElement(config.child4FolderSelectSpace).appendChild(dropdown4);
            dropdown4 = createDropdownElement('dropdown_select_4');
            kintone.app.record.getSpaceElement(config.child4FolderSelectSpace).appendChild(dropdown4);
            select4 = $('#dropdown_select_4').get(0);
            // フィールドに値があるか(複写時の階層選択設定)
            if( subfolder_id3 ) {
                await setSelectItems( subfolder_id3, select4 ); 
                var selected_name = record[ config.child4FolderNameFld ].value; 
                if( selected_name ) {
                     subfolder_id4 = setSelectedByText( select4, selected_name );
                }
            }
        }
        if( config.child5FolderSelectSpace ) {
            // dropdown5 = new Kuc.Dropdown({items: []});
            // kintone.app.record.getSpaceElement(config.child5FolderSelectSpace).appendChild(dropdown5);
            dropdown5 = createDropdownElement('dropdown_select_5');
            kintone.app.record.getSpaceElement(config.child5FolderSelectSpace).appendChild(dropdown5);
            select5 = $('#dropdown_select_5').get(0);
            // フィールドに値があるか(複写時の階層選択設定)
            if( subfolder_id4 ) {
                await setSelectItems( subfolder_id4, select5 ); 
                var selected_name = record[ config.child5FolderNameFld ].value; 
                if( selected_name ) {
                     subfolder_id5 = setSelectedByText( select5, selected_name );
                }
            }
        }
 
        if( dropdown1 ) {

            // 選択時のイベント処理
            // kuc
            // dropdown1.addEventListener('change', function(event) {
            select1.addEventListener('change', function(event) {
                // 値を別のフィールドにも設定
                var record = kintone.app.record.get(); // レコード情報のコピー
                // var item = dropdown1.items.find( function(item) {
                //     return item.value === event.detail.value;
                // });
                // record.record[config.child1FolderNameFld].value = item.label;
                var option = this.options[ this.selectedIndex ];
                record.record[config.child1FolderNameFld].value = option.text;

                // 下位層の選択肢の作成
                if( dropdown2 ) {
                    // setDropdownItems( item.value, dropdown2 ); 
                    setSelectItems( option.value, select2 ); 
                    record.record[config.child2FolderNameFld].value = '';
                }
                if( dropdown3 ) {
                    // clearDropdownItems( dropdown3 ); 
                    select3.innerHTML = '';
                    record.record[config.child3FolderNameFld].value = '';
                }
                if( dropdown4 ) {
                    // clearDropdownItems( dropdown4 ); 
                    select4.innerHTML = '';
                    record.record[config.child4FolderNameFld].value = '';
                }
                if( dropdown5 ) {
                    // clearDropdownItems( dropdown5 ); 
                    select5.innerHTML = '';
                    record.record[config.child5FolderNameFld].value = '';
                }
                kintone.app.record.set(record) ; // 設定
            });
        }
        if( dropdown2 ) {

            // 選択時のイベント処理
            // dropdown2.addEventListener('change', function(event) {
            select2.addEventListener('change', function(event) {
                var record = kintone.app.record.get();
                // var item = dropdown2.items.find( function(item) {
                //   return item.value === event.detail.value;
                // });
                // record.record[config.child2FolderNameFld].value = item.label;
                var option = this.options[ this.selectedIndex ];
                record.record[config.child2FolderNameFld].value = option.text;
                // 下位層の選択肢の作成
                if( dropdown3 ) {
                    // setDropdownItems( item.value, dropdown3 ); 
                    setSelectItems( option.value, select3 ); 
                    record.record[config.child3FolderNameFld].value = '';
                }
                if( dropdown4 ) {
                    // clearDropdownItems( dropdown4 ); 
                    select4.innerHTML = '';
                    record.record[config.child4FolderNameFld].value = '';
                }
                if( dropdown5 ) {
                    // clearDropdownItems( dropdown5 ); 
                    select5.innerHTML = '';
                    record.record[config.child5FolderNameFld].value = '';
                }
                kintone.app.record.set(record) ; // 設定
            });
        }
        if( dropdown3 ) {

            // 選択時のイベント処理
            // dropdown3.addEventListener('change', function(event) {
            select3.addEventListener('change', function(event) {
                var record = kintone.app.record.get();
                // var item = dropdown3.items.find( function(item) {
                //    return item.value === event.detail.value;
                // });
                // record.record[config.child3FolderNameFld].value = item.label;
                var option = this.options[ this.selectedIndex ];
                record.record[config.child3FolderNameFld].value = option.text;
                // 下位層の選択肢の作成
                if( dropdown4 ) {
                    // setDropdownItems( item.value, dropdown4 ); 
                    setSelectItems( option.value, select4 ); 
                    record.record[config.child4FolderNameFld].value = '';
                }
                if( dropdown5 ) {
                    // setDropdownItems( item.value, dropdown5 ); 
                    setSelectItems( option.value, select5 ); 
                    record.record[config.child5FolderNameFld].value = '';
                }
                kintone.app.record.set(record) ; // 設定
            });
        }
        if( dropdown4 ) {

            // 選択時のイベント処理
            // dropdown4.addEventListener('change', function(event) {
            select4.addEventListener('change', function(event) {
                var record = kintone.app.record.get();
                // var item = dropdown4.items.find( function(item) {
                //    return item.value === event.detail.value;
                // });
                // record.record[config.child4FolderNameFld].value = item.label;
                var option = this.options[ this.selectedIndex ];
                record.record[config.child4FolderNameFld].value = option.text;
                // 下位層の選択肢の作成
                if( dropdown5 ) {
                    // setDropdownItems( item.value, dropdown5 ); 
                    setSelectItems( option.value, select5 ); 
                    record.record[config.child5FolderNameFld].value = '';
                }
                kintone.app.record.set(record) ; // 設定
            });
        }
        if( dropdown5 ) {

            // 選択時のイベント処理
            // dropdown5.addEventListener('change', function(event) {
            select5.addEventListener('change', function(event) {
                var record = kintone.app.record.get();
                // var item = dropdown5.items.find( function(item) {
                //     return item.value === event.detail.value;
                // });
                // record.record[config.child5FolderNameFld].value = item.label;
                var option = this.options[ this.selectedIndex ];
                record.record[config.child5FolderNameFld].value = option.text;
                kintone.app.record.set(record) ; // 設定
            });
        }
        return event;
    }

    //
    // Kintone のイベント処理
    //

    // 明細新規
    kintone.events.on('app.record.create.show', function(event) {
        if (validateConfig(event.record)) {

            // 複写時の対応
            event.record[config.folderIdFld]["value"] = '';    

            // フォルダIDは入力禁止
            event.record[config.folderIdFld]['disabled'] = true;  
            displayDropDown( event );

        }
        return event;
    });

    // 明細編集
    kintone.events.on('app.record.edit.show', function(event) {
        if (validateConfig(event.record)) {

            // 「フォルダ名」は普通入力必須にするので入力可能になる場合は無い
            //  ここでは「フォルダ名」と「フォルダID」が共に入力されていない場合の想定。

            // フォルダIDは入力禁止
            event.record[config.folderIdFld]['disabled'] = true; 

            // フォルダIDに値があればフォルダ名は変更禁止
            //   フォルダ名の変更は出来ないので。
            if (event.record[config.folderIdFld]["value"]) { 
                event.record[config.folderNameFld]['disabled'] = true;  
                if( config.child1FolderNameFld )  event.record[config.child1FolderNameFld]['disabled'] = true;  
                if( config.child2FolderNameFld )  event.record[config.child2FolderNameFld]['disabled'] = true;  
                if( config.child3FolderNameFld )  event.record[config.child3FolderNameFld]['disabled'] = true;  
                if( config.child4FolderNameFld )  event.record[config.child4FolderNameFld]['disabled'] = true;  
                if( config.child5FolderNameFld )  event.record[config.child5FolderNameFld]['disabled'] = true;  

                hidden_dropdown_spaces(); // 階層ドロップダウン用スペース非表示

            } else {
                displayDropDown( event );
            }
        }
        return event;
    });

    // リスト編集時
    kintone.events.on('app.record.index.edit.show', function(event) {
        if (validateConfig(event.record)) {
            event.record[config.folderNameFld]['disabled'] = true;
            event.record[config.folderIdFld]['disabled'] = true;
            if( config.child1FolderNameFld )  event.record[config.child1FolderNameFld]['disabled'] = true;  
            if( config.child2FolderNameFld )  event.record[config.child2FolderNameFld]['disabled'] = true;  
            if( config.child3FolderNameFld )  event.record[config.child3FolderNameFld]['disabled'] = true;  
            if( config.child4FolderNameFld )  event.record[config.child4FolderNameFld]['disabled'] = true;  
            if( config.child5FolderNameFld )  event.record[config.child5FolderNameFld]['disabled'] = true;  
        }
        return event;
    });

    // 詳細画面表示時の処理
    kintone.events.on('app.record.detail.show', function(event) {

        if (validateConfig(event.record)) {

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
    kintone.events.on('app.record.edit.submit', async function(event) {
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
