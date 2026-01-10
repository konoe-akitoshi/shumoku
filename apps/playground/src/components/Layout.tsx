import { Link, Outlet, useLocation } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            <img src="/logo.svg" alt="Shumoku" className="logo-img" />
            <h1>Shumoku</h1>
          </Link>
          <nav className="main-nav">
            <Link
              to="/"
              className={location.pathname === '/' ? 'active' : ''}
            >
              Home
            </Link>
            <Link
              to="/playground"
              className={location.pathname === '/playground' ? 'active' : ''}
            >
              Playground
            </Link>
            <Link
              to="/docs/getting-started"
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
            <a
              href="https://www.npmjs.com/package/shumoku"
              target="_blank"
              rel="noopener noreferrer"
            >
              npm
            </a>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
