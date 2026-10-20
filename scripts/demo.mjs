import fs from 'node:fs/promises';
import path from 'node:path';
import {plan,applyPlan,undo,hash} from '../src/core.mjs';
import {report} from '../src/report.mjs';

const samples={
 'note-01.md':'# Balcony garden\nThe tomato plants on the balcony need watering. Their soil dries out in the afternoon.\n- [ ] Water tomatoes.\n- [ ] Buy a larger plant pot.\n',
 'note-02.txt':'Balcony plant supplies\nTomato seedlings need a larger pot, compost and a watering can for the balcony garden.\nTODO: Check the compost bag.\n',
 'note-03.md':'# Bicycle repair\nThe bicycle rear tyre is flat. The bike needs a new inner tube and the brakes need checking.\n- [ ] Find the bike pump.\n',
 'note-04.txt':'Bicycle workshop notes\nRepair the punctured rear bicycle tire. Check the inner tube size before visiting the cycle repair shop.\nNEXT: Read the tyre size.\n',
 'note-05.md':'# Weekend soup\nLentil soup recipe: lentils, carrots, onion, cumin and vegetable stock. Simmer until the lentils are soft.\n- [ ] Rinse lentils.\n',
 'note-06.txt':'Soup shopping\nFor the lentil soup recipe, buy red lentils, carrots, onions and vegetable stock. There is already cumin in the pantry.\nTODO: Check lentils in pantry.\n',
 'note-07.md':'# Astronomy\nSaturn has rings made of ice and rock. Its moon Titan has a thick atmosphere.\n',
 'ignore.bin':'This is an unsupported file and stays where it is.'
};
const run = path.resolve('work',`demo-${Date.now()}`);
const inbox=path.join(run,'inbox');
await fs.mkdir(inbox,{recursive:true});
for(const [name,body] of Object.entries(samples)) await fs.writeFile(path.join(inbox,name),body);
console.log('DeskDoze · synthetic demo\nReading seven notes and leaving one unsupported file alone…');
const p=await plan(inbox,{offline:process.argv.includes('--offline')});
await fs.mkdir('demo',{recursive:true});
// Public evidence excludes absolute user paths. The runnable plan remains in work/.
await fs.writeFile(path.join(run,'plan.json'),JSON.stringify(p,null,2));
await fs.writeFile('demo/report.html',report(p));
const publicPlan={...p,root:'<synthetic-demo-folder>'};
await fs.writeFile('demo/analysis.json',JSON.stringify(publicPlan,null,2));
const journal=await applyPlan(p);
for(const m of p.moves) {
  if(hash(await fs.readFile(path.join(inbox,m.to)))!==m.sha256) throw Error('Moved file differs.');
  try {await fs.access(path.join(inbox,m.from)); throw Error('Source still exists.');} catch(e) {if(e.code!=='ENOENT')throw e;}
}
await undo(journal);
for(const [name,body] of Object.entries(samples)) if(await fs.readFile(path.join(inbox,name),'utf8')!==body) throw Error('Undo mismatch.');
const evidence={model:p.model,offline:p.offline,notes:7,groups:p.groups.map(g=>g.files.map(f=>f.name)),moves:p.moves.length,elapsedMs:p.elapsedMs,contentPreserved:true,undoRestoredAll:true,unsupportedFileUntouched:true};
await fs.writeFile('demo/verification.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
console.log('Preview: demo/report.html\nApply and undo verified against every original byte.');
