import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import PlaygroundPage from './pages/PlaygroundPage'
import DocsPage from './pages/DocsPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<PlaygroundPage />} />
          <Route path="docs/:docId" element={<DocsPage />} />
          <Route path="docs" element={<DocsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
