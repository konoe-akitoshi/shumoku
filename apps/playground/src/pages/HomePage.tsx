import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <h1>Shumoku</h1>
          <p className="hero-tagline">
            Modern network topology visualization library for TypeScript/JavaScript
          </p>
          <p className="hero-description">
            YAML でネットワーク構成を定義し、美しい SVG ダイアグラムを自動生成。
            <br />
            Yamaha, Aruba, AWS, Juniper など 900+ のベンダーアイコンに対応。
          </p>
          <div className="hero-actions">
            <Link to="/playground" className="btn btn-primary">
              Playground を試す
            </Link>
            <Link to="/docs/getting-started" className="btn btn-secondary">
              Getting Started
            </Link>
          </div>
        </div>
      </section>

      <section className="features">
        <h2>Features</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>YAML ベース</h3>
            <p>シンプルで読みやすい YAML 記法でネットワーク構成を定義</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎨</div>
            <h3>自動レイアウト</h3>
            <p>ELK.js による階層的な自動レイアウト</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🏭</div>
            <h3>ベンダーアイコン</h3>
            <p>Yamaha, Aruba, AWS, Juniper の 900+ アイコン</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3>SVG エクスポート</h3>
            <p>高品質なベクター形式で出力</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔷</div>
            <h3>TypeScript</h3>
            <p>完全な型安全性を提供</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌙</div>
            <h3>テーマ対応</h3>
            <p>ライト/ダークテーマ、カスタムテーマ</p>
          </div>
        </div>
      </section>

      <section className="install">
        <h2>Installation</h2>
        <div className="code-block">
          <pre>
            <code>
{`# 基本インストール
npm install shumoku

# ベンダーアイコン付き
npm install shumoku @shumoku/icons`}
            </code>
          </pre>
        </div>
      </section>

      <section className="example">
        <h2>Example</h2>
        <div className="example-grid">
          <div className="example-code">
            <pre>
              <code>
{`name: "Simple Network"

nodes:
  - id: router
    label: "Core Router"
    type: router
    vendor: yamaha
    model: rtx3510

  - id: switch
    label: "Main Switch"
    type: l2-switch

  - id: server
    label: "Web Server"
    type: server

links:
  - from: { node: router }
    to: { node: switch }
    bandwidth: 10G

  - from: { node: switch }
    to: { node: server }
    bandwidth: 1G`}
              </code>
            </pre>
          </div>
          <div className="example-preview">
            <Link to="/playground" className="try-it">
              Playground で試す →
            </Link>
          </div>
        </div>
      </section>

      <section className="packages">
        <h2>Packages</h2>
        <div className="package-grid">
          <a
            href="https://www.npmjs.com/package/shumoku"
            target="_blank"
            rel="noopener noreferrer"
            className="package-card"
          >
            <h3>shumoku</h3>
            <p>メインパッケージ（全機能を含む）</p>
          </a>
          <a
            href="https://www.npmjs.com/package/@shumoku/core"
            target="_blank"
            rel="noopener noreferrer"
            className="package-card"
          >
            <h3>@shumoku/core</h3>
            <p>コアライブラリ</p>
          </a>
          <a
            href="https://www.npmjs.com/package/@shumoku/parser-yaml"
            target="_blank"
            rel="noopener noreferrer"
            className="package-card"
          >
            <h3>@shumoku/parser-yaml</h3>
            <p>YAML パーサー</p>
          </a>
          <a
            href="https://www.npmjs.com/package/@shumoku/icons"
            target="_blank"
            rel="noopener noreferrer"
            className="package-card"
          >
            <h3>@shumoku/icons</h3>
            <p>ベンダーアイコン（900+）</p>
          </a>
        </div>
      </section>

      <section className="cta">
        <h2>Ready to get started?</h2>
        <div className="cta-actions">
          <Link to="/docs/getting-started" className="btn btn-primary">
            Documentation
          </Link>
          <a
            href="https://github.com/konoe-akitoshi/shumoku"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            GitHub
          </a>
        </div>
      </section>
    </div>
  )
}
