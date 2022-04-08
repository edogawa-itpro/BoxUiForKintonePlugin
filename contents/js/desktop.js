jQuery.noConflict();

(function($, PLUGIN_ID) {
    'use strict';

    var config;

    var BOX_API_BASE_URL = 'https://api.box.com/2.0';
    var childFolderNames = []; // 階層フォルダの削除で使用

    // 多言語化の作法
    var terms = {
        'en': {
            'failed_to_create_folder': 'Cannot create new folder.',
            'enter_box_folder_name_field': 'Box folder name field is required.',
            'error': 'Error:'
        },
        'ja': {
            'failed_to_create_folder': 'フォルダを作成できません。',
            'enter_box_folder_name_field': 'Boxフォルダー名フィールドは必須です。',
            'error': 'Error:'
        }
    };
    var lang = kintone.getLoginUser().language;
    var i18n = (lang in terms) ? terms[lang] : terms['en'];

    // config 情報の読込とチェック
    //   イベント処理で毎回行う。(record は何に使うんだろう？)
    var validateConfig = function(record) {
        config = kintone.plugin.app.getConfig(PLUGIN_ID);
        if (!config) {return false;}
        return true;
    };

    // Box UI Element による表示
    //  いくつかのオプションは設定できると良いかも？
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
            return ajax_get( BOX_API_BASE_URL + '/folders/' + folder_id + '/items', config.boxAppToken );
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
            var folder_info = await get_folder_info( record[config.folderIdFld].value );
            if( is_folder_empty( folder_info  ) ) {
                status = await delete_box_folder( record[config.folderIdFld].value );
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
        try {
            // 格好悪いが単純に階層の数だけ記述
            if( config.child1FolderNameFld && record[config.child1FolderNameFld].value ) {
                var folder_id = await search_folder(parent_folder_id, record[config.child1FolderNameFld].value);
                if( folder_id == null ) {
                    var result = await create_box_folder(parent_folder_id, record[config.child1FolderNameFld].value);  
                    parent_folder_id = result.id;
                } else parent_folder_id = folder_id;
                if( config.child2FolderNameFld && record[config.child2FolderNameFld].value ) {
                    folder_id = await search_folder(parent_folder_id, record[config.child2FolderNameFld].value);
                    if( folder_id == null ) {
                        var result = await create_box_folder(parent_folder_id, record[config.child2FolderNameFld].value);  
                        parent_folder_id = result.id;
                    } else parent_folder_id = folder_id;
                    if( config.child3FolderNameFld && record[config.child3FolderNameFld].value ) {
                        folder_id = await search_folder(parent_folder_id, record[config.child3FolderNameFld].value);
                        if( folder_id == null ) {
                            var result = await create_box_folder(parent_folder_id, record[config.child3FolderNameFld].value);  
                            parent_folder_id = result.id;
                        } else parent_folder_id = folder_id;
                        if( config.child4FolderNameFld && record[config.child4FolderNameFld].value ) {
                            folder_id = await search_folder(parent_folder_id, record[config.child4FolderNameFld].value);
                            if( folder_id == null ) {
                                var result = await create_box_folder(parent_folder_id, record[config.child4FolderNameFld].value);  
                                parent_folder_id = result.id;
                            } else parent_folder_id = folder_id;
                        }
                    }
                }
            }
        } catch(e) {
            error = e.status + e.responseText ;               
        }  
       
        if( !error ) {
            var result;
            try {
                var folder_name = record[config.folderNameFld]["value"];  
                result = await create_box_folder(parent_folder_id, folder_name);   
                // 作成成功ならフォルダIDをフィールドに格納
                event.record[config.folderIdFld].value = result.id;   
            } catch(e) {
                error = e.status + e.responseText ;               
            }
        }
        if (error) {event.error = error;}
        return event;
    };

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

        // 階層名を配列へ
        childFolderNames = [];
        if( config.child1FolderNameFld && record[config.child1FolderNameFld].value ) {
            childFolderNames.push(record[config.child1FolderNameFld].value); 
            if( config.child2FolderNameFld && record[config.child2FolderNameFld].value ) {
                childFolderNames.push(record[config.child2FolderNameFld].value); 
                if( config.child3FolderNameFld && record[config.child3FolderNameFld].value ) {
                    childFolderNames.push(record[config.child3FolderNameFld].value); 
                    if( config.child4FolderNameFld && record[config.child4FolderNameFld].value ) {
                        childFolderNames.push(record[config.child4FolderNameFld].value);
                    }
                }
            } 
        }        
 
        // まず自フォルダの削除

        var status = false;
        var folder_info;
        try {
            folder_info = await get_folder_info( record[config.folderIdFld].value );
            if( is_folder_empty(folder_info) ) {
                status = await delete_box_folder( record[config.folderIdFld].value );
            } else {
                error = "フォルダが空ではありません";
                status = false;
            }
        } catch(e) {
            error = "フォルダ見つからないか、もしくは権限がありません"
            status = false;
        }
        // 階層フォルダ情報があれば可能なら削除
        if( status && childFolderNames.length > 0 ) {
            try {
                if( folder_info.path_collection ) {
                    var parents = folder_info.path_collection.entries;
                    for( var i = 0; i < parents.length ; i++ ) {
                        var parent = parents[i];
                        if( i >= childFolderNames.length ) break;
                        if( parent.type === "folder" && parent.name === childFolderNames[childFolderNames.length - i ] ) {
                            var status = await delete_empty_folder( parent.id );
                            if(!status) break; // 失敗したらそこで終了
                        }
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
    var createDropdown = function( id ) {

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
    }

    //
    // Boxフォルダ階層選択ドロップダウン表示
    //    新規入力画面を開いた際に設定
    //
    var displayDropDown = async function(event) {
        var record = event.record;
        var dropdown1;
        var dropdown2;
        var dropdown3;
        var dropdown4;

        // KUC を使わない場合
        var select1; 
        var select2;
        var select3;
        var select4;

        // config に設定があればドロップダウンを表示
        if( config.child1FolderSelectSpace ) {
  
            // element 作成
            // kuc
            // dropdown1 = new Kuc.Dropdown({items: []});

            // non kuc
            dropdown1 = createDropdown('dropdown_select_1');

            // フォルダ選択肢を設定(１階層目は親フォルダ直下)
            // kuc
            // setDropdownItems( config.parentFolderId, dropdown1 ); 

            // DOM に割り当て
            kintone.app.record.getSpaceElement(config.child1FolderSelectSpace).appendChild(dropdown1);

            // non kuc
            select1 = $('#dropdown_select_1').get(0);
            await setSelectItems( config.parentFolderId, select1 ); 
        }

        // ２階層以下同様
        if( config.child2FolderSelectSpace ) {
            // kuc
            // dropdown2 = new Kuc.Dropdown({items: []});
            // kintone.app.record.getSpaceElement(config.child2FolderSelectSpace).appendChild(dropdown2);
            // non kuc
            dropdown2 = createDropdown('dropdown_select_2');
            kintone.app.record.getSpaceElement(config.child2FolderSelectSpace).appendChild(dropdown2);
            select2 = $('#dropdown_select_2').get(0);
        }
        if( config.child3FolderSelectSpace ) {
            // dropdown3 = new Kuc.Dropdown({items: []});
            // kintone.app.record.getSpaceElement(config.child3FolderSelectSpace).appendChild(dropdown3);
            dropdown3 = createDropdown('dropdown_select_3');
            kintone.app.record.getSpaceElement(config.child3FolderSelectSpace).appendChild(dropdown3);
            select3 = $('#dropdown_select_3').get(0);
        }
        if( config.child4FolderSelectSpace ) {
            // dropdown4 = new Kuc.Dropdown({items: []});
            // kintone.app.record.getSpaceElement(config.child4FolderSelectSpace).appendChild(dropdown4);
            dropdown4 = createDropdown('dropdown_select_4');
            kintone.app.record.getSpaceElement(config.child4FolderSelectSpace).appendChild(dropdown4);
            select4 = $('#dropdown_select_4').get(0);
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
                kintone.app.record.set(record) ; // 設定
            });
        }
        if( dropdown3 ) {

            // 選択時のイベント処理
            // dropdown3.addEventListener('change', function(event) {
            select3.addEventListener('change', function(event) {
                // var record = kintone.app.record.get();
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
                kintone.app.record.set(record) ; // 設定
            });
        }
        if( dropdown4 ) {

            // 選択時のイベント処理
            // dropdown4.addEventListener('change', function(event) {
            select4.addEventListener('change', function(event) {
                // var record = kintone.app.record.get();
                // var item = dropdown4.items.find( function(item) {
                //     return item.value === event.detail.value;
                // });
                // record.record[config.child4FolderNameFld].value = item.label;
                var option = this.options[ this.selectedIndex ];
                record.record[config.child4FolderNameFld].value = option.text;
                kintone.app.record.set(record) ; // 設定
            });
        }
        return event;
    }

    //
    // Kintone のイベント処理
    //

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

    // 明細新規
    kintone.events.on('app.record.create.show', function(event) {
        if (validateConfig(event.record)) {

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
        }
        return event;
    });

})(jQuery, kintone.$PLUGIN_ID);
