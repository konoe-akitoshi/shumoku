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
const inputs: ExperimentInput[] = [
  { candidate: 'A', topology: saved.a },
  { candidate: 'B', topology: saved.b },
]
const cards: string[] = []
const cases = []
for (const input of inputs) {
  for (const presentation of saved.presentations) {
    const { resolved, svg } = await prepareExperiment(input, presentation)
    const coordinates = presentation.nodePlacements.map((p) => ({
      nodeId: p.nodeId,
      requested: p.position,
      actual: resolved.nodes.get(p.nodeId)?.position,
    }))
    if (coordinates.some((p) => !isDeepStrictEqual(p.requested, p.actual))) {
      throw new Error('Saved coordinates were not reproduced')
    }
    cases.push({ candidate: input.candidate, presentationId: presentation.id, coordinates })
    // Inline SVGs use IDs internally. Each iframe keeps its own SVG ID namespace.
    const document = `<style>body{margin:0}svg{width:100%;height:100%}</style>${svg}`
    const srcdoc = document.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    cards.push(`<article><h2>案 ${input.candidate} / ${presentation.id}</h2>
      <iframe title="案 ${input.candidate} / ${presentation.id}" srcdoc="${srcdoc}"></iframe></article>`)
  }
}
if (!isDeepStrictEqual(saved, before) || !isDeepStrictEqual(fixtures, before)) {
  throw new Error('Rendering or file reload changed the saved facts')
}
const report = {
  scope:
    'P1a: node coordinates and port sides only; group rendering and model adoption not evaluated',
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
  <title>P1a 座標分離の比較</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:24px;background:#f1f5f9;color:#0f172a}
    h1{font-size:24px}h2{font-size:16px}p{line-height:1.8}
    main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
    article{background:white;padding:16px;border:1px solid #cbd5e1;border-radius:8px}
    iframe{width:100%;height:400px;border:0}
    @media(max-width:720px){main{grid-template-columns:1fr}}
  </style>
  <h1>P1a 座標分離の比較</h1>
  <p>同じ 2 ノード・2 ポート・1 接続を縦・横に配置。案 A はポートを Node 内に保持し、案 B は別の配列に保持します。<br>
  座標とポートの表示面は別保存。構成・所属・配線長の保存値は描画前後で同一です。</p>
  <p><strong>今回の確認範囲:</strong> 座標、ポートの表示面、保存・再読込。グループの描画、表示サイズ、スタイル、選択・折りたたみは未検証です。<br>
  案 B の二つの所属は保存していますが、この図には描画していません。両案の採否はまだ決めません。</p>
  <main>${cards.join('\n')}</main>
  <p><a href="README.md">実験の説明</a> · <a href="report.json">座標の検証結果</a></p>
  </html>\n`,
)
console.log(`Rendered ${cases.length} cases; topology, presentation and physical profile preserved`)
