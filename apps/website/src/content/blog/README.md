# ブログを書く

記事は **1フォルダーにMarkdownと画像** をまとめます。記事を書くためのTypeScript、Svelte、HTMLは不要です。
日本語記事だけで公開でき、英訳は必須ではありません。

```text
src/content/blog/
  meetup-1/
    index.md
    images/
      group.webp
      reception.webp
  next-article/
    index.md
    images/
      cover.webp
```

## 新しい記事

1. 小文字英数字とハイフンでフォルダーを作る（例: `meetup-2`）。
2. 同じフォルダーに `index.md` と `images/` を置く。
3. 下の例をコピーして本文を書く。
4. dev serverの `/ja/blog/meetup-2` で確認する。

```markdown
---
title: "Shumoku Meetup #2を開催しました"
description: "今回のMeetupを写真で振り返ります。"
date: "2027-02-16"
image: "./images/cover.webp"
imageAlt: "参加者の集合写真"
category: "イベント開催記"
draft: false
---

## 当日の様子

ここに本文を書きます。

![講演の様子](./images/talk.webp)

- 箇条書き
- [関連リンク](https://shumoku.dev)
```

必要なのはtitle・description・date。dateは引用符付きのYYYY-MM-DD。
表紙のimage / imageAlt、category、draftは省略できます。表紙を使う場合はimageAltも書きます。
タイトル・日付・説明・表紙は共通テンプレートが表示するので、本文で重複させる必要はありません。

フォルダー名がURLのslugになります。記事一覧・日付順・サイトマップ・静的生成対象は自動更新されます。
普段は `index.md` を編集して画像を置くだけで、ルートや画像一覧のコードを触りません。
画像は原本ではなく配信用に圧縮したものを置きます。一般的なMarkdownエディターでも相対パスで画像を確認できます。

## 写真

標準の `![説明](./images/photo.webp)` を使います。
説明は代替テキストとキャプションになり、クリックすると画像全体を表示します。

空行なしで連続する画像は1グループです。PCでは2枚なら2列、3枚なら3列、モバイルは1列になります。
別の段にする場合は空行を挟みます。画像だけの段落として記述してください。

```markdown
![受付](./images/reception.webp)
![講演](./images/talk.webp)
![交流](./images/conversation.webp)
```

単独画像は元の縦横比を保ちます。複数枚のグループは表示枠を4:3に揃えますが、
ファイル自体は切り取りません。画像ファイルの名前を変えたらMarkdownの相対パスも直してください。
ビルド時に画像URLを解決するため、公開時のURLやハッシュ名を人が書く必要はありません。

## 下書きと公開

`draft: true` の記事は一覧・直接URL・サイトマップ・静的生成から除外されます。
ローカル確認時だけfalseにし、未公開のまま保存するときはtrueへ戻します。
これは機密情報の保管機能ではありません。記事フォルダーにも秘密の資料は入れないでください。

言語は省略すると日本語。必要になったときだけ `lang: en` の別記事を追加できます。
同一記事の翻訳を要求する構造ではありません。docsと同様、翻訳がない場合はその言語のUIのまま原文を表示し、未翻訳であることを案内します。
現在のMeetup #1は日本語だけですが、英語の記事一覧にも掲載し、英語URLでも日本語の原文を表示します。
言語切替は同じ記事のURLを維持します。本文には原文のlang属性を指定し、canonicalとhreflangは原文URLを指します。記事・画像ファイルは複製しません。

## Communityとの分離

Communityの写真は `src/lib/community/photos.ts` と `public/images/community/` で別管理します。
記事フォルダーをimportせず、同じ原本を使っていても配信用ファイルは別です。
記事の写真・説明・並び替えや削除はCommunityへ影響しません。逆方向も同様です。
Home/Aboutの既存紹介用画像URLは互換性のため保持しています。
ホームの特集は編集上の指定なので、記事を追加しても自動的には差し替わりません。

## 開発時の確認

websiteディレクトリで `bun run typecheck`、`bun run test`、`bun run build`。
公開前に一覧・直接URL・モバイル表示・画像の説明を確認します。

## 実装の参考

- [MDsveX](https://github.com/pngwn/MDsveX): 通常のMarkdownをSvelteに変換し、画像表示だけ共通layoutで担当。
- [Vite glob import](https://vite.dev/guide/features.html#glob-import): index.mdと記事内の画像を自動収集。
- [Vite static asset handling](https://vite.dev/guide/assets.html): 画像のURLと公開時のハッシュをビルド側で管理。
- [SvelteKit universal load](https://svelte.dev/docs/kit/load#Universal-vs-server): 記事コンポーネントをuniversal loadから渡す。
- [SvelteKit prerender entries](https://svelte.dev/docs/kit/page-options#prerender-entries): 記事から静的生成するURLを列挙。
