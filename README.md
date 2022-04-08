# Box UI for kintone Plugin
## Overview
クラウドストレージサービス「Box」の UI を kintone の画面で表示する為のプラグインです。  
(Box UI for kintone plugin)  
添付ファイルを kintone 上にアップロードする代わりに直接 Box のフォルダを参照・作成・ファイルのアップロードが出来ます。  
## Build
1. node.js で環境を作る。
2. プラグイン構築ツール
[kintone-plugin-packer](https://github.com/kintone/js-sdk/tree/master/packages/plugin-packer)
をインストールする。
3. プラグインを作成する。
```
$ kintone-plugin-packer  --ppk PLUGIN_SECRET_KEY.ppk contents
```
4. 作成された plugin.zip を kintone に登録する。
## Demo
![image](https://user-images.githubusercontent.com/58966019/162155281-7467bc08-a4b9-42ab-8b66-e22f56224005.png)
## Features
- Box の認証は OAuth2.0 ではなくアプリトークンを使用。
- Box のフォルダの作成と最大４つまでの階層フォルダが作成できる。
- 階層フォルダのドロップダウンが使える。
 
