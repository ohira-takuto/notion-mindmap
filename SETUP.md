# Notion MindMap セットアップガイド

## 概要
Notionページに埋め込んで使えるXMind風マインドマップツール。
Claude Codeからも直接操作できます。

---

## Step 1: Notion Integrationの作成

1. https://www.notion.so/my-integrations を開く
2. 「新しいインテグレーション」をクリック
3. 名前: `MindMap` で作成
4. **シークレットトークン**をコピーして保存（`secret_xxx...`）
5. マインドマップを使いたいNotionページを開き、右上「...」→「コネクト」→作成したインテグレーションを追加

---

## Step 2: GitHubにプッシュ

```bash
cd ~/tools/notion-mindmap
git remote add origin https://github.com/YOUR_USERNAME/notion-mindmap.git
git push -u origin main
```

---

## Step 3: Vercelにデプロイ

1. https://vercel.com にアクセス（GitHubアカウントでログイン）
2. 「Add New → Project」→ `notion-mindmap` リポジトリを選択
3. 「Environment Variables」に追加:
   - Name: `NOTION_TOKEN`
   - Value: `secret_xxx...`（Step 1のトークン）
4. 「Deploy」をクリック（2〜3分で完了）
5. 発行されたURL（例: `https://notion-mindmap-xxx.vercel.app`）をメモ

---

## Step 4: NotionページにURLを埋め込む

Claudeに以下のように指示するだけ：

```
「NotionページID: xxx にマインドマップを埋め込んで」
```

または手動で：
1. Notionページを開く
2. `/embed` と入力
3. URLを入力: `https://your-app.vercel.app?pageId=NOTION_PAGE_ID`

---

## Claude Codeからの操作例

### 新しいマインドマップを作成
```
「このNotionページにマインドマップを作って:
  中心: プロジェクトA
  ├── 要件定義
  │    ├── ユーザーインタビュー
  │    └── 競合調査
  └── 実装
       ├── フロント
       └── バック
  ページ: https://notion.so/xxx」
```

### 既存マップを更新
```
「NotionページのマインドマップにノードXXXを追加して」
```

---

## NotionページIDの取得方法

NotionページのURL: `https://notion.so/ページ名-XXXXXXXXXXXXXXXX`
→ 末尾の32文字がページID（ハイフンなし）
