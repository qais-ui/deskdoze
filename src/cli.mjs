#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {plan, applyPlan, undo} from './core.mjs';
import {report} from './report.mjs';

const [command, target, ...flags] = process.argv.slice(2);
const value = (name, fallback) => flags.includes(name) ? flags[flags.indexOf(name)+1] : fallback;
try {
  if (command === 'plan' && target) {
    const output = path.resolve(value('--out','deskdoze-plan.json'));
    const p = await plan(target,{offline:flags.includes('--offline'),threshold:Number(value('--threshold','0.48'))});
    await fs.writeFile(output,JSON.stringify(p,null,2),{flag:'wx'});
    await fs.writeFile(output+'.html',report(p),{flag:'wx'});
    console.log(`DeskDoze / ${p.groups.length} groups / ${p.moves.length} proposed moves / ${p.elapsedMs} ms`);
    for (const g of p.groups) {
      console.log(`\n${g.title} (${g.files.length} files)`);
      console.log(g.nextStep ? `  ${g.nextStep.quote}\n  Source: ${g.nextStep.source}:${g.nextStep.line}` : '  No explicit unfinished task found.');
    }
    console.log(`\nPreview: ${output}.html\nPlan: ${output}\nNo files were moved.`);
  } else if(command==='apply' && target && flags.includes('--yes')) {
    console.log('Undo journal: '+await applyPlan(JSON.parse(await fs.readFile(target,'utf8'))));
  } else if(command==='undo' && target) {
    console.log(`Restored ${await undo(target)} files. Journal kept for inspection.`);
  } else {
    console.log('DeskDoze — let your notes find each other.\n\nnode src/cli.mjs plan <folder> [--offline] [--out plan.json] [--threshold 0.48]\nnode src/cli.mjs apply <plan.json> --yes\nnode src/cli.mjs undo <journal.json>\n\nFirst plan downloads the open model. Later use --offline. Only top-level UTF-8 .md/.txt files are read.');
    if(command) process.exitCode=1;
  }
} catch(e) { console.error('DeskDoze: '+e.message); process.exitCode=1; }
