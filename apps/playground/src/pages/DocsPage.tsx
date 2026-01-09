import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import yamlReference from '../../../../docs/yaml-reference.md?raw'
import vendorIcons from '../../../../docs/vendor-icons.md?raw'

const docs: Record<string, { title: string; content: string }> = {
  'yaml-reference': {
    title: 'YAML Reference',
    content: yamlReference,
  },
  'vendor-icons': {
    title: 'Vendor Icons',
    content: vendorIcons,
  },
}

export default function DocsPage() {
  const { docId } = useParams<{ docId: string }>()
  const [activeDoc, setActiveDoc] = useState(docId || 'yaml-reference')

  const currentDoc = docs[activeDoc] || docs['yaml-reference']

  return (
    <div className="docs-page">
      <aside className="docs-sidebar">
        <nav>
          <h3>Documentation</h3>
          <ul>
            {Object.entries(docs).map(([id, doc]) => (
              <li key={id}>
                <Link
                  to={`/docs/${id}`}
                  className={activeDoc === id ? 'active' : ''}
                  onClick={() => setActiveDoc(id)}
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="docs-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {currentDoc.content}
        </ReactMarkdown>
      </main>
    </div>
  )
}
