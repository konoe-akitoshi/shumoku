import { writeFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import {
  type ExperimentInput,
  loadFixtures,
  prepareExperiment,
  saveAndReload,
} from './coordinate-prototype'

const fixtures = await loadFixtures()
const before = structuredClone(fixtures)
const saved = await saveAndReload(fixtures)
const sections: string[] = []
const cases = []
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
for (const scenario of [
  { name: '座標と表示面', fixtures: saved },
  { name: '表示サイズと3ポートの順序', fixtures: saved.multiport },
]) {
  const cards: string[] = []
  const inputs: ExperimentInput[] = [
    { candidate: 'A', topology: scenario.fixtures.a },
    { candidate: 'B', topology: scenario.fixtures.b },
  ]
  for (const input of inputs) {
    for (const presentation of scenario.fixtures.presentations) {
      const { resolved, svg } = await prepareExperiment(input, presentation)
      const coordinates = presentation.nodePlacements.map((p) => ({
        nodeId: p.nodeId,
        requested: p.position,
        actual: resolved.nodes.get(p.nodeId)?.position,
      }))
      if (coordinates.some((p) => !isDeepStrictEqual(p.requested, p.actual))) {
        throw new Error('Saved coordinates were not reproduced')
      }
      const sizes = (presentation.nodeSizes ?? []).map((p) => ({
        nodeId: p.nodeId,
        requested: p.size,
        actual: resolved.nodes.get(p.nodeId)?.size,
      }))
      if (sizes.some((p) => !isDeepStrictEqual(p.requested, p.actual))) {
        throw new Error('Saved sizes were not reproduced')
      }
      const ports = [...resolved.ports.values()].map((port) => ({
        id: port.id,
        side: port.side,
        position: port.absolutePosition,
      }))
      const connections = [...resolved.edges.values()].map((edge) => ({
        id: edge.id,
        fromPortId: edge.fromPortId,
        toPortId: edge.toPortId,
      }))
      cases.push({
        candidate: input.candidate,
        presentationId: presentation.id,
        coordinates,
        sizes,
        ports,
        connections,
      })
      // Each iframe keeps its own SVG ID namespace.
      const document = `<style>body{margin:0}svg{width:100%;height:100%}</style>${svg}`
      const srcdoc = escapeHtml(document)
      const title = escapeHtml(`案 ${input.candidate} / ${presentation.id}`)
      const caption = sizes
        .map((p) => `${p.nodeId}: ${p.requested.width} × ${p.requested.height} px`)
        .join(' / ')
      cards.push(`<article><h3>${title}</h3><p>${escapeHtml(caption || 'サイズは自動計算')}</p>
        <iframe title="${title}" srcdoc="${srcdoc}"></iframe></article>`)
    }
  }
  sections.push(`<section><h2>${scenario.name}</h2><main>${cards.join('\n')}</main></section>`)
}
if (!isDeepStrictEqual(saved, before) || !isDeepStrictEqual(fixtures, before)) {
  throw new Error('Rendering or file reload changed the saved facts')
}
const report = {
  scope:
    'P1a: coordinates, explicit sizes and connected port ordering; group rendering and model adoption not evaluated',
  topologyUnchanged: true,
  presentationReloaded: true,
  physicalProfileUnchanged: true,
  cases,
}
await writeFile(new URL('./report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`)
await writeFile(
  new URL('./comparison.html', import.meta.url),
  `<!doctype html><html lang="ja"><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1a 構成と表示の分離</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:24px;background:#f1f5f9;color:#0f172a}
    h1{font-size:24px}h2{font-size:20px}h3{font-size:16px}p{line-height:1.8}section{margin-top:32px}
    main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
    article{background:white;padding:16px;border:1px solid #cbd5e1;border-radius:8px}
    iframe{width:100%;height:400px;border:0}
    @media(max-width:720px){main{grid-template-columns:1fr}}
  </style>
  <h1>P1a 構成と表示の分離</h1>
  <p>案 A はポートを Node 内に保持し、案 B は別の配列に保持します。
  座標・表示サイズ・ポートの表示面と順序は別保存。構成・所属・配線長の保存値は描画前後で同一です。</p>
  <p>下段は同じ構成で表示サイズと3ポートの順序を変更した例です。Ethernet1 / 2 / 3 の接続先は維持しています。
  逆順で線が交差するのは指定した並びの結果です。サイズ指定がなければ自動計算します。</p>
  <p><strong>今回の確認範囲:</strong> 座標、表示サイズ、接続済みポートの表示面と順序、保存・再読込。
  グループの描画、スタイル、選択・折りたたみは未検証です。
  案 B の所属は保存していますが、この図には描画していません。両案の採否はまだ決めません。</p>
  ${sections.join('\n')}
  <p><a href="README.md">実験の説明とサイズの方針</a> · <a href="report.json">座標・サイズ・端点の検証結果</a></p>
  </html>\n`,
)
console.log(`Rendered ${cases.length} cases; topology, presentation and physical profile preserved`)
