import { BuildOrchestrator } from './lib/build-orchestrator.js';

const args = process.argv.slice(2);
const orchestrator = new BuildOrchestrator();

if (args.includes('--watch') || args.includes('-w')) {
  orchestrator.watch().catch(console.error);
} else {
  orchestrator.build().catch(console.error);
}
