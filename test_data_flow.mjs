import { sampleNetwork, HierarchicalParser, createMemoryFileResolver, computeNetworkLayout } from './libs/@shumoku/core/dist/index.js';
import { samplePalette, sampleBomItems } from './apps/editor/src/lib/sample-project.ts';

console.log('=== TEST 1: Verify sampleBomItems node IDs match parsed nodes ===\n');

// Parse the network
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

// Get all node IDs from the parsed graph
const actualNodeIds = new Set(graph.nodes.map(n => n.id));

console.log('Actual node IDs:', Array.from(actualNodeIds).sort());
console.log('');

// Check each BOM item
console.log('BOM Items verification:');
let missingCount = 0;
for (const bomItem of sampleBomItems) {
  if (bomItem.nodeId) {
    const found = actualNodeIds.has(bomItem.nodeId);
    if (!found) {
      console.log(`  ❌ ${bomItem.id}: nodeId="${bomItem.nodeId}" NOT FOUND in diagram`);
      missingCount++;
    } else {
      console.log(`  ✓ ${bomItem.id}: nodeId="${bomItem.nodeId}" found`);
    }
  } else {
    console.log(`  ⚠ ${bomItem.id}: nodeId is undefined (unplaced)`);
  }
}

console.log(`\nResult: ${missingCount === 0 ? '✓ ALL BOM ITEMS MATCH' : `❌ ${missingCount} BOM ITEMS DO NOT MATCH`}`);

console.log('\n=== TEST 2: Verify node assignments via BOM ===\n');

// Simulate the BOM lookup flow
const nodesInBom = sampleBomItems.filter(i => i.nodeId).map(i => i.nodeId);
const unplacedNodes = Array.from(actualNodeIds).filter(n => !nodesInBom.includes(n));

console.log(`Placed in BOM: ${nodesInBom.length} nodes`);
console.log(`Not in BOM: ${unplacedNodes.length} nodes`);
if (unplacedNodes.length > 0) {
  console.log('Unplaced nodes:', unplacedNodes);
}
