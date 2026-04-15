import { HierarchicalParser, createMemoryFileResolver, sampleNetwork } from './libs/@shumoku/core/dist/index.js';

const fileMap = new Map();
for (const f of sampleNetwork) {
  fileMap.set(f.name, f.content);
  fileMap.set(`./${f.name}`, f.content);
  fileMap.set(`/${f.name}`, f.content);
}

const resolver = createMemoryFileResolver(fileMap, '/');
const hp = new HierarchicalParser(resolver);
const mainFile = sampleNetwork.find((f) => f.name === 'main.yaml');

const result = await hp.parse(mainFile.content, '/main.yaml');
const graph = result.graph;

console.log('=== ALL NODE IDS ===');
graph.nodes.forEach(n => console.log(`  ${n.id} (parent: ${n.parent})`));

console.log('\n=== CAMPUS NODES ===');
graph.nodes
  .filter(n => n.parent && n.parent.startsWith('campus'))
  .forEach(n => console.log(`  ${n.id} (parent: ${n.parent})`));
