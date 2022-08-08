jQuery.noConflict();

(function($, PLUGIN_ID) {
    'use strict';
    $(function() {
        var terms = {
            'en': {
                'box_app_token': 'Box Application Token',
                'parent_folder_id': 'Box Parent Folder ID',
                'folder_name_fld': 'kintone Field for Box Folder Name(last child)',
                'folder_name_fld_description': 'Single-line text field',
                'folder_id_fld': 'Box Folder ID',
                'folder_id_fld_description': 'Single-line text or link field',
                'box_ui_space': 'Box UIExplorer display position',
                'box_ui_space_description': 'space filed',
                'child1_folder_name_fld': 'kintone Field for Box child 1 - 4 Folder Name',
                'child1_folder_name_fld_description': 'Single-line text field or Drop down',
                'child2_folder_name_fld': 'kintone Field for Box child 2 Folder Name',
                'child2_folder_name_fld_description': 'Single-line text field or Drop down',
                'child3_folder_name_fld': 'kintone Field for Box child 3 Folder Name',
                'child3_folder_name_fld_description': 'Single-line text field or Drop down',
                'child4_folder_name_fld': 'kintone Field for Box child 4 Folder Name',
                'child4_folder_name_fld_description': 'Single-line text field or Drop down',
                'child5_folder_name_fld': 'kintone Field for Box child 5 Folder Name',
                'child5_folder_name_fld_description': 'Single-line text field or Drop down',
                'child1_folder_select_space': 'Box child 1 Folder Selector display posision',
                'child1_folder_select_space_description': 'space field',
                'child2_folder_select_space': 'Box child 2 Folder Selector display posision',
                'child2_folder_select_space_description': 'space field',
                'child3_folder_select_space': 'Box child 3 Folder Selector display posision',
                'child3_folder_select_space_description': 'space field',
                'child4_folder_select_space': 'Box child 4 Folder Selector display posision',
                'child4_folder_select_space_description': 'space field',
                'child5_folder_select_space': 'Box child 5 Folder Selector display posision',
                'child5_folder_select_space_description': 'space field',
                'plugin_submit': '     Save   ',
                'plugin_cancel': '     Cancel   ',
                'required_field': 'Please enter the required field.',
                'invalid_folder_id': 'Invalid folder ID.',
                'fields_are_same': 'The values of the "Box Parent Folder Filed" and '
                                    + '"Box Folder ID Field" fields must be different.',
                'prohibit_to_download': 'Allow file download only to collaborators',
                'child_folder_select_only_depth': 'child folder select only depth',
                'max_delay_time': 'max delay time(x100ms)'
            },
            'ja': {
                'box_app_token': 'Box アプリケーショントークン',
                'parent_folder_id': 'Box親フォルダID',
                'folder_name_fld': 'Boxフォルダ名用のkintoneフィールド',
                'folder_name_fld_description': '文字列（1行）フィールド',
                'folder_id_fld': 'BoxフォルダIDの格納先',
                'folder_id_fld_description': '文字列（1行）またはリンクフィールド',
                'box_ui_space': 'Box UIExplorer を表示するスペース',
                'box_ui_space_description': 'スペースフィールド',
                'child1_folder_name_fld': '子フォルダ(親から見て第１階層から第４階層)を作る場合のkintoneフィールド',
                'child1_folder_name_fld_description': '文字列（1行）またはドロップダウン',
                'child2_folder_name_fld': '子フォルダ(親から見て第２階層)を作る場合のkintoneフィールド',
                'child2_folder_name_fld_description': '文字列（1行）またはドロップダウン',
                'child3_folder_name_fld': '子フォルダ(親から見て第３階層)を作る場合のkintoneフィールド',
                'child3_folder_name_fld_description': '文字列（1行）またはドロップダウン',
                'child4_folder_name_fld': '子フォルダ(親から見て第４階層)を作る場合のkintoneフィールド',
                'child4_folder_name_fld_description': '文字列（1行）またはドロップダウン',
                'child5_folder_name_fld': '子フォルダ(親から見て第５階層)を作る場合のkintoneフィールド',
                'child5_folder_name_fld_description': '文字列（1行）またはドロップダウン',
                'child1_folder_select_space': 'Box 子フォルダの第１階層から第４階層のフォルダーセレクタを表示する場合の位置',
                'child1_folder_select_space_description': 'スペースフィールド',
                'child2_folder_select_space': 'Box 子フォルダ第２階層セレクタ表示位置',
                'child2_folder_select_space_description': 'スペースフィールド',
                'child3_folder_select_space': 'Box 子フォルダ第３階層セレクタ表示位置',
                'child3_folder_select_space_description': 'スペースフィールド',
                'child4_folder_select_space': 'Box 子フォルダ第４階層セレクタ表示位置',
                'child4_folder_select_space_description': 'スペースフィールド',
                'child5_folder_select_space': 'Box 子フォルダ第５階層セレクタ表示位置',
                'child5_folder_select_space_description': 'スペースフィールド',
                'plugin_submit': '     保存   ',
                'plugin_cancel': '  キャンセル   ',
                'required_field': '必須項目を入力してください。',
                'invalid_folder_id': 'フォルダIDが不正です。',
                'fields_are_same': '「Box親フォルダIDフィールド」と「BoxフォルダーIDフィールド」には、同じフィールドを指定できません。',
                'prohibit_to_download': 'コラボレータにのみダウンロードを許可する',
                'child_folder_select_only_depth': '直接入力不可階層数',
                'max_delay_time': '最大遅延時間(x100ms)'
            }
        };

        // Kintone のAPIパス(URL)の取得
        //  Guestスペースの場合の修正
        var getUrl = function(path) {
            var matchedGuestSpacePath = location.pathname.match(/^\/k\/(guest\/\d+\/)/);
            var guestSpacePath = '';
            if (matchedGuestSpacePath !== null && matchedGuestSpacePath.length === 2) {
                guestSpacePath = matchedGuestSpacePath[1]; // "guest/<space_id>/"
            }
            var apiPath = '/k/' + guestSpacePath + path;
            return apiPath;
        };

        // 言語の設定
        var lang = kintone.getLoginUser().language;
        var i18n = (lang in terms) ? terms[lang] : terms['en'];

        // html テンプレートで html からエレメントの生成
        var html = $('#boxUiPlugin-config').html();
        var tmpl = $.templates(html);
        $('div#boxUiPlugin-config').html(tmpl.render({'terms': i18n}));

        // アプリの全フィールド情報を取得しながら、選択可能なものをリストボックスに追加する
        //   今回のように項目数が決まっていれば、項目ごとに取得するより効率的。
        kintone.api(getUrl('v1/preview/form'), 'GET', {'app': kintone.app.getId()}, function(resp) {
            for (var i = 0; i < resp.properties.length; i++) {
                var prop = resp.properties[i];
                if (prop['type'] === 'SINGLE_LINE_TEXT' || (prop['type'] === 'LINK' && prop['protocol'] === 'WEB')) {
                    $('#folder_id_fld').append($('<OPTION>').text(prop['label']).val(prop['code']));
                }

                if (prop['type'] === 'SINGLE_LINE_TEXT' || prop['type'] === 'DROP_DOWN') {
                    // if( prop['type'] === 'SINGLE_LINE_TEXT'  && prop['unique'] === 'true' ) {
                        $('#folder_name_fld').append($('<OPTION>').text(prop['label']).val(prop['code']));
                    // }
                    $('#child1_folder_name_fld').append($('<OPTION>').text(prop['label']).val(prop['code']));
                    $('#child2_folder_name_fld').append($('<OPTION>').text(prop['label']).val(prop['code']));
                    $('#child3_folder_name_fld').append($('<OPTION>').text(prop['label']).val(prop['code']));
                    $('#child4_folder_name_fld').append($('<OPTION>').text(prop['label']).val(prop['code']));
                    $('#child5_folder_name_fld').append($('<OPTION>').text(prop['label']).val(prop['code']));
                }
                if (prop['type'] === 'SPACER' ) {
                    $('#box_ui_space').append($('<OPTION>').text(prop['elementId']));
                    $('#child1_folder_select_space').append($('<OPTION>').text(prop['elementId']));
                    $('#child2_folder_select_space').append($('<OPTION>').text(prop['elementId']));
                    $('#child3_folder_select_space').append($('<OPTION>').text(prop['elementId']));
                    $('#child4_folder_select_space').append($('<OPTION>').text(prop['elementId']));
                    $('#child5_folder_select_space').append($('<OPTION>').text(prop['elementId']));
                }
            }

            // 既に config が保存されていたらその値を設定
            var config = kintone.plugin.app.getConfig(PLUGIN_ID);
            if (config['boxAppToken']) {
                $('#box_app_token').val(config['boxAppToken']);
            }
            if (config['parentFolderId']) {
                $('#parent_folder_id').val(config['parentFolderId']);
            }
            if (config['folderNameFld']) {
                $('#folder_name_fld').val(config['folderNameFld']);
            }
            if (config['folderIdFld']) {
                $('#folder_id_fld').val(config['folderIdFld']);
            }
            if (config['boxUiSpace']) {
                $('#box_ui_space').val(config['boxUiSpace']);
            }
            if (config['child1FolderNameFld']) {
                $('#child1_folder_name_fld').val(config['child1FolderNameFld']);
            }
            if (config['child2FolderNameFld']) {
                $('#child2_folder_name_fld').val(config['child2FolderNameFld']);
            }
            if (config['child3FolderNameFld']) {
                $('#child3_folder_name_fld').val(config['child3FolderNameFld']);
            }
            if (config['child4FolderNameFld']) {
                $('#child4_folder_name_fld').val(config['child4FolderNameFld']);
            }
            if (config['child5FolderNameFld']) {
                $('#child5_folder_name_fld').val(config['child5FolderNameFld']);
            }
            if (config['child1FolderSelectSpace']) {
                $('#child1_folder_select_space').val(config['child1FolderSelectSpace']);
            }
            if (config['child2FolderSelectSpace']) {
                $('#child2_folder_select_space').val(config['child2FolderSelectSpace']);
            }
            if (config['child3FolderSelectSpace']) {
                $('#child3_folder_select_space').val(config['child3FolderSelectSpace']);
            }
            if (config['child4FolderSelectSpace']) {
                $('#child4_folder_select_space').val(config['child4FolderSelectSpace']);
            }
            if (config['child5FolderSelectSpace']) {
                $('#child5_folder_select_space').val(config['child5FolderSelectSpace']);
            }
            if (config['childFolderSelectOnlyDepth']) {
                $('#child_folder_select_only_depth').val(config['childFolderSelectOnlyDepth']);
            }
            if (config['maxDelayTime']) {
                $('#max_delay_time').val(config['maxDelayTime']);
            }
        });

        // 保管処理
        $('#plugin_submit').click(function() {
            var boxAppToken = $('#box_app_token').val();
            var parentFolderId = $('#parent_folder_id').val();
            var folderNameFld = $('#folder_name_fld').val();
            var folderIdFld = $('#folder_id_fld').val();
            var boxUiSpace = $('#box_ui_space').val();
            var child1FolderNameFld = $('#child1_folder_name_fld').val();
            var child2FolderNameFld = $('#child2_folder_name_fld').val();
            var child3FolderNameFld = $('#child3_folder_name_fld').val();
            var child4FolderNameFld = $('#child4_folder_name_fld').val();
            var child5FolderNameFld = $('#child5_folder_name_fld').val();
            var child1FolderSelectSpace = $('#child1_folder_select_space').val();
            var child2FolderSelectSpace = $('#child2_folder_select_space').val();
            var child3FolderSelectSpace = $('#child3_folder_select_space').val();
            var child4FolderSelectSpace = $('#child4_folder_select_space').val();
            var child5FolderSelectSpace = $('#child5_folder_select_space').val();
            var childFolderSelectOnlyDepth = $('#child_folder_select_only_depth').val();
            var maxDelayTime = $('#max_delay_time').val();

            if (!parentFolderId.match(/^[0-9]+$/) || folderIdFld.length > 20) {
                alert(i18n.invalid_folder_id);
                return;
            }
            if (folderNameFld === null || folderIdFld === null) {
                alert(i18n.required_field);
                return;
            }
            if (boxAppToken.length === 0 || parentFolderId.length === 0 || folderNameFld.length === 0 
             || folderIdFld.length === 0 || boxUiSpace.length === 0 ) {
                alert(i18n.required_field);
                return;
            }
            if (folderNameFld === folderIdFld ) {
                alert(i18n.fields_are_same);
                return;
            }
            // config 内容の設定
            var config = {};
            config['boxAppToken'] = boxAppToken;
            config['parentFolderId'] = parentFolderId;
            config['folderNameFld'] = folderNameFld;
            config['folderIdFld'] = folderIdFld;
            config['boxUiSpace'] = boxUiSpace;
            config['child1FolderNameFld'] = child1FolderNameFld;
            config['child2FolderNameFld'] = child2FolderNameFld;
            config['child3FolderNameFld'] = child3FolderNameFld;
            config['child4FolderNameFld'] = child4FolderNameFld;
            config['child5FolderNameFld'] = child5FolderNameFld;
            config['child1FolderSelectSpace'] = child1FolderSelectSpace;
            config['child2FolderSelectSpace'] = child2FolderSelectSpace;
            config['child3FolderSelectSpace'] = child3FolderSelectSpace;
            config['child4FolderSelectSpace'] = child4FolderSelectSpace;
            config['child5FolderSelectSpace'] = child5FolderSelectSpace;
            config['childFolderSelectOnlyDepth'] = childFolderSelectOnlyDepth;
            config['maxDelayTime'] = maxDelayTime;

            kintone.plugin.app.setConfig(config);
        });

        $('#plugin_cancel').click(function() {
            history.back();
        });

    });
})(jQuery, kintone.$PLUGIN_ID);
