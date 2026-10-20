import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {scan,hash,groupFiles,applyPlan,undo} from '../src/core.mjs';
import {report} from '../src/report.mjs';
async function fixture(t) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'deskdoze-test-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.writeFile(path.join(root,'note.md'),'# Garden\n- [ ] Water plants.\n');
 const move={from:'note.md',to:'doze-garden/note.md',sha256:hash(await fs.readFile(path.join(root,'note.md')))};
 return {root,version:1,moves:[move]};
}
test('apply and undo preserve bytes, and undo is repeatable',async t=>{
 const p=await fixture(t),j=await applyPlan(p);
 await assert.rejects(fs.access(path.join(p.root,'note.md')));
 assert.equal(await undo(j),1); assert.equal(await undo(j),1);
 assert.equal(hash(await fs.readFile(path.join(p.root,'note.md'))),p.moves[0].sha256);
});
test('changed source refuses apply before any move',async t=>{
 const p=await fixture(t);await fs.writeFile(path.join(p.root,'note.md'),'edited');
 await assert.rejects(applyPlan(p),/changed/);
});
test('existing destination is never overwritten',async t=>{
 const p=await fixture(t);await fs.mkdir(path.join(p.root,'doze-garden'));await fs.writeFile(path.join(p.root,p.moves[0].to),'keep');
 await assert.rejects(applyPlan(p),/already exists/);
 assert.equal(await fs.readFile(path.join(p.root,p.moves[0].to),'utf8'),'keep');
});
test('undo refuses changed destination and preserves it',async t=>{
 const p=await fixture(t),j=await applyPlan(p);await fs.writeFile(path.join(p.root,p.moves[0].to),'new edit');
 await assert.rejects(undo(j),/changed/);
 assert.equal(await fs.readFile(path.join(p.root,p.moves[0].to),'utf8'),'new edit');
});
test('path traversal and duplicate moves rejected',async t=>{
 const p=await fixture(t);await assert.rejects(applyPlan({...p,moves:[{...p.moves[0],to:'../escape'}]}),/Unsafe/);
 await assert.rejects(applyPlan({...p,moves:[...p.moves,...p.moves]}),/Duplicate/);
});
test('junction destination is refused',async t=>{
 const p=await fixture(t);const external=await fs.mkdtemp(path.join(os.tmpdir(),'deskdoze-external-'));
 t.after(()=>fs.rm(external,{recursive:true,force:true}));
 await fs.symlink(external,path.join(p.root,'doze-garden'),'junction');
 await assert.rejects(applyPlan(p),/plain directory/);
});
test('write-ahead undo recovers duplicate copy after interrupted move',async t=>{
 const p=await fixture(t);await fs.mkdir(path.join(p.root,'doze-garden'));await fs.copyFile(path.join(p.root,'note.md'),path.join(p.root,p.moves[0].to));
 const j=path.join(p.root,'.deskdoze-undo-test.json');await fs.writeFile(j,JSON.stringify(p));
 await undo(j);await assert.rejects(fs.access(path.join(p.root,p.moves[0].to)));
 assert.equal(hash(await fs.readFile(path.join(p.root,'note.md'))),p.moves[0].sha256);
});
test('scan extracts exact source lines and ignores unsupported files',async t=>{
 const p=await fixture(t);await fs.writeFile(path.join(p.root,'x.bin'),'hello');
 const result=await scan(p.root);assert.equal(result.files[0].actions[0].line,2);assert.equal(result.files[0].actions[0].quote,'- [ ] Water plants.');assert.deepEqual(result.skipped,['x.bin']);
});
test('complete-link prevents weak semantic chains',()=>{
 const files=['a','b','c'].map(name=>({name,title:name,actions:[]}));
 const angle=x=>[Math.cos(x),Math.sin(x)];
 const groups=groupFiles(files,[angle(0),angle(0.5),angle(1)],0.8);
 assert.deepEqual(groups.map(g=>g.files.length).sort(),[1,2]);
});
test('report escapes note content instead of executing markup',()=>{
 const html=report({groups:[{title:'<script>alert(1)</script>',files:[],nextStep:null,confidence:null}],moves:[],elapsedMs:0,skipped:[],created:'now'});
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
