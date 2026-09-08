# Brand assets

This directory is the source of truth for Shumoku brand artwork.

## Files

- `logos/`: the three current SVG originals — symbol, wordmark, and lockup.
- `logos/png/`: transparent PNG exports of each variant, 512px wide and 2048px wide (`@4x`).
- `legacy/`: the old horizontal logo, retained for existing slide and published URL compatibility.
- Root favicon files: browser/application-specific icon exports and manifest.
- `screenshots/`: product screenshots, separate from brand artwork.
- `brand.ts`: symbol path constants used by the renderer.

| Variant | SVG | Typical use |
|---|---|---|
| Symbol | [logo-symbol.svg](logos/logo-symbol.svg) | App icons, favicons, compact spaces |
| Wordmark | [logo-wordmark.svg](logos/logo-wordmark.svg) | Website header |
| Lockup | [logo-lockup.svg](logos/logo-lockup.svg) | Presentations and event announcements |

PNG exports use the same filenames under `logos/png/`. Preserve original aspect ratios
and colors. Background shapes in the original artwork are preserved; no extra background
is added. The website continues to serve SVG. PNGs are distributed assets, not a build
step: export them again from the SVG when the artwork changes, then commit both.
No PNG-generation script or additional dependency is required.

## 利用ガイド / Usage guidelines

### 素材の選び方

- **シンボル**：アイコンや省スペースの表示に。初めて紹介する場面では、近くに「Shumoku」と記載してください。
- **ワードマーク（文字だけ）**：ヘッダーなど、名前をすっきり見せたい場所に。
- **ロックアップ（ロゴ＋文字）**：登壇スライド、イベント告知、プロジェクトの紹介に。
- 拡大するWeb素材や印刷にはSVG、SVG非対応のツールには透過PNGを使用してください。
  PNGは通常512px幅、大きなスライドなどには2048px幅（`@4x`）を選べます。

### 見せ方

- 縦横比と元の色を維持し、変形・切り抜き・文字の組み直しを避けてください。
- 周囲に余白を取り、文字や図と重ねず、背景に埋もれない場所に配置してください。
- 小さくして名前が読めなくなる場合は、シンボルと通常のテキスト表記を使ってください。
- 新しい資料には `logos/` の素材を使用してください。`legacy/` は既存資料の互換用です。

### 紹介・登壇などでの利用

Shumokuを紹介する記事、登壇資料、利用事例、比較資料では、個別の連絡なしで
これらの素材を使用できます。可能であれば [Shumokuのサイト](https://www.shumoku.dev/)
へのリンクを添えてください。

公式・公認・提携・スポンサー関係があると誤解させる使い方や、別の製品・団体の
ロゴとしての利用はしないでください。自社の告知に載せる場合も、Shumokuの紹介で
あることが分かるようにしてください。共同ブランド、商品化、公式な関係の表示など、
判断に迷う用途は [contact@shumoku.dev](mailto:contact@shumoku.dev) にご相談ください。

このガイドはブランドの表示・利用についての案内です。リポジトリの
[LICENSE](../LICENSE) を変更・置換するものではなく、コードのライセンスと
公式・公認を名乗ることは別の話です。

### English summary

Use the symbol for compact spaces, the wordmark for headers, and the lockup for
introductions and event materials. Prefer SVG for scaling and PNG for tools that
do not support SVG. Preserve proportions and colors, leave breathing room, and
use a background where the artwork remains legible.

You may use these assets to refer to Shumoku in articles, talks, case studies and
comparisons without contacting us first. A link to the project website is appreciated.
Do not imply official endorsement, partnership or sponsorship, or use the artwork
as another product or organization's identity. Contact us about co-branding,
merchandise or uncertain uses. These display guidelines do not replace or modify
the repository LICENSE and do not grant official or endorsed status.

## Consumers and compatibility

- Server static icons use Git symlinks into this directory.
- HP public logos and slide images are checked-in copies to support deployment and portability.
- Docs copies the root favicon set during Astro startup/build.
- The renderer maintains a TypeScript mirror of `brand.ts` because its package rootDir
  does not allow imports from this directory.

`bun run check:brand-assets` verifies the symlinks/copies and renderer mirror in CI.
Public application filenames are unchanged by this organization. The old horizontal
logo is not a fourth recommended variant; do not use it for new work.

## Updating artwork

1. Update the appropriate SVG in `logos/` and its PNG exports in `logos/png/`.
2. Update any application or slide copies that consume it.
3. If the symbol changes, refresh the root favicon exports and `brand.ts`/renderer mirror.
   A published renderer code change requires its own changeset.
4. Run `bun run check:brand-assets`.

See [the name and logo origin](../docs/ORIGIN.md).
