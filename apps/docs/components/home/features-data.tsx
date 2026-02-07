import type { ReactNode } from 'react'
import { CodeIcon, ImageIcon, LayoutIcon, LinkIcon, NetBoxIcon } from './icons'

// Icons for each feature (order matches translations.features.items)
export const featureIcons: ReactNode[] = [
  <LayoutIcon key="layout" className="w-6 h-6" />,
  <ImageIcon key="image" className="w-6 h-6" />,
  <NetBoxIcon key="netbox" className="w-6 h-6" />,
  <LayoutIcon key="dashboard" className="w-6 h-6" />,
  <CodeIcon key="code" className="w-6 h-6" />,
  <LinkIcon key="link" className="w-6 h-6" />,
]
