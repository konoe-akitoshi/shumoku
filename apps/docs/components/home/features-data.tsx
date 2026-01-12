import type { ReactNode } from 'react'
import { CodeIcon, DocumentIcon, DownloadIcon, ImageIcon, LayoutIcon, NetBoxIcon } from './icons'

export type Feature = {
  title: string
  description: string
  icon: ReactNode
}

export const features: Feature[] = [
  {
    title: 'YAML で定義',
    description: 'シンプルで読みやすい YAML 記法。Git で管理、レビューも簡単',
    icon: <DocumentIcon className="w-6 h-6" />,
  },
  {
    title: '900+ ベンダーアイコン',
    description: 'Yamaha, Aruba, AWS, Juniper など主要ベンダーに対応',
    icon: <ImageIcon className="w-6 h-6" />,
  },
  {
    title: '自動レイアウト',
    description: 'ELK.js による階層的な自動レイアウト。手動配置不要',
    icon: <LayoutIcon className="w-6 h-6" />,
  },
  {
    title: 'SVG エクスポート',
    description: '高品質なベクター形式。ズームしても綺麗',
    icon: <DownloadIcon className="w-6 h-6" />,
  },
  {
    title: 'TypeScript',
    description: '完全な型安全性。IDE での補完も完璧',
    icon: <CodeIcon className="w-6 h-6" />,
  },
  {
    title: 'NetBox 連携',
    description: 'NetBox から自動でダイアグラム生成',
    icon: <NetBoxIcon className="w-6 h-6" />,
  },
]
