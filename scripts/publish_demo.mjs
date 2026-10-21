import fs from 'node:fs/promises';
import { report } from '../src/report.mjs';
const analysis = JSON.parse(await fs.readFile('demo/analysis.json', 'utf8'));
await fs.mkdir('docs', { recursive: true });
await fs.writeFile('docs/index.html', report(analysis, { demo: true }));
for (const name of ['deskdoze-demo.mp4', 'video-poster.png', 'report.png']) {
  await fs.copyFile(`demo/${name}`, `docs/${name}`);
}
await fs.writeFile('docs/.nojekyll', '');
