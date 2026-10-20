import fs from 'node:fs/promises';
await fs.mkdir('docs',{recursive:true});
let html=await fs.readFile('demo/report.html','utf8');
html=html.replace('<h1>',`<section class="notice"><strong>Recorded synthetic demo</strong><p>This public page shows a verified example. To analyze your own notes locally, <a href="https://github.com/qais-ui/deskdoze">get the code and follow the README</a>. No files are uploaded here.</p><video controls preload="metadata" poster="video-poster.png" style="display:block;width:100%;border-radius:12px" aria-label="DeskDoze captioned demo"><source src="deskdoze-demo.mp4" type="video/mp4"><a href="deskdoze-demo.mp4">Download the captioned video</a></video><p><a href="https://github.com/qais-ui/deskdoze/blob/main/demo/verification.json">Inspect the verification results</a></p></section><h1>`);
await fs.writeFile('docs/index.html',html);
for(const name of ['deskdoze-demo.mp4','video-poster.png','report.png']) await fs.copyFile('demo/'+name,'docs/'+name);
await fs.writeFile('docs/.nojekyll','');
