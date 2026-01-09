import { Link, Outlet, useLocation } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            <h1>Shumoku</h1>
          </Link>
          <nav className="main-nav">
            <Link
              to="/"
              className={location.pathname === '/' ? 'active' : ''}
            >
              Playground
            </Link>
            <Link
              to="/docs/yaml-reference"
              className={location.pathname.startsWith('/docs') ? 'active' : ''}
            >
              Docs
            </Link>
            <a
              href="https://github.com/konoe-akitoshi/shumoku"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
        <p className="tagline">Network Topology Visualization</p>
      </header>
      <Outlet />
    </div>
  )
}
