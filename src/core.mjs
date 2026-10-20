import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const MODEL = 'Xenova/all-MiniLM-L6-v2';
export const hash = data => crypto.createHash('sha256').update(data).digest('hex');
export const cosine = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'notes';

export async function directory(root) {
  const resolved = path.resolve(root);
  // Refuse junctions/symlinks in every existing ancestor, including the root.
  for (let p = resolved;; p = path.dirname(p)) {
    const stat = await fs.lstat(p);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw Error(`Not a plain directory: ${p}`);
    if (p === path.dirname(p)) break;
  }
  return resolved;
}

export async function scan(folder) {
  const root = await directory(folder);
  const files = [], skipped = [];
  const entries = (await fs.readdir(root, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const source = path.join(root, entry.name);
    const st = await fs.lstat(source);
    if (!st.isFile() || st.isSymbolicLink() || !/\.(txt|md)$/i.test(entry.name) || st.size > 262144) {
      skipped.push(entry.name); continue;
    }
    if (files.length >= 100) throw Error('Limit is 100 text files per run. Choose a smaller folder.');
    const bytes = await fs.readFile(source);
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { skipped.push(entry.name); continue; }
    if (!text.trim() || text.includes('\0')) { skipped.push(entry.name); continue; }
    const lines = text.split(/\r?\n/);
    const actions = lines.flatMap((quote, i) => /^\s*(?:[-*]\s*\[ \]|TODO\s*:|NEXT\s*:)/i.test(quote)
      ? [{ line: i+1, quote: quote.trim().slice(0, 400), truncated: quote.trim().length > 400 }] : []);
    const title = (lines.find(l => l.trim()) || entry.name).replace(/^#+\s*/, '').trim().slice(0, 90);
    files.push({ name: entry.name, sha256: hash(bytes), bytes: bytes.length, title, actions,
      excerpt: text.slice(0, 900), excerptTruncated: text.length > 900 });
  }
  return {root, files, skipped};
}

export async function embed(texts, {offline = false, cacheDir} = {}) {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = cacheDir || path.resolve('.cache');
  env.allowRemoteModels = !offline;
  const extractor = await pipeline('feature-extraction', MODEL, {
    dtype: 'q8', local_files_only: offline,
    session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 }
  });
  try {
    const output = [];
    for (const text of texts) output.push((await extractor(text, {pooling: 'mean', normalize: true})).tolist()[0]);
    return output;
  } finally { await extractor.dispose(); }
}

export function groupFiles(files, vectors, threshold = 0.48) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw Error('Threshold must be between 0 and 1.');
  if (vectors.length !== files.length) throw Error('Missing embeddings.');
  // Complete-link clustering prevents a chain of weak matches joining unrelated work.
  const clusters = files.map((_, i) => [i]);
  while (true) {
    let best = null, score = threshold;
    for (let a=0; a<clusters.length; a++) for (let b=a+1; b<clusters.length; b++) {
      const similarity = Math.min(...clusters[a].flatMap(i => clusters[b].map(j => cosine(vectors[i], vectors[j]))));
      if (similarity > score) { best = [a,b]; score = similarity; }
    }
    if (!best) break;
    clusters[best[0]].push(...clusters[best[1]]); clusters.splice(best[1], 1);
  }
  return clusters.map(indices => {
    const medoid = indices.reduce((best, i) => {
      const sum = x => indices.reduce((s,j) => s + cosine(vectors[x], vectors[j]), 0);
      return sum(i) > sum(best) ? i : best;
    }, indices[0]);
    const members = indices.map(i => files[i]);
    const confidence = indices.length < 2 ? null : Math.min(...indices.flatMap((i,a) => indices.slice(a+1).map(j => cosine(vectors[i], vectors[j]))));
    const actions = members.flatMap(f => f.actions.map(a => ({...a, source:f.name})));
    // Smallest explicitly written action by word count. No duration or priority is invented.
    actions.sort((a,b) => a.quote.split(/\s+/).length - b.quote.split(/\s+/).length);
    return { title: files[medoid].title, folder: `doze-${slug(files[medoid].title)}-${hash(members.map(f=>f.name).sort().join('\n')).slice(0,6)}`,
      confidence, files: members, nextStep: actions[0] || null, actions };
  });
}

export async function plan(folder, options={}) {
  const start = performance.now();
  const input = await scan(folder);
  if (!input.files.length) throw Error('No supported UTF-8 .txt or .md files found.');
  const vectors = await embed(input.files.map(f => f.excerpt), options);
  const groups = groupFiles(input.files, vectors, options.threshold ?? 0.48);
  return { version: 1, root: input.root, created: new Date().toISOString(), model: MODEL,
    offline: !!options.offline, threshold: options.threshold ?? 0.48,
    elapsedMs: Math.round(performance.now()-start), skipped:input.skipped, groups,
    moves: groups.filter(g=>g.files.length>1).flatMap(g=>g.files.map(f=>({from:f.name,to:`${g.folder}/${f.name}`,sha256:f.sha256}))) };
}

function validateMoves(moves) {
  if (!Array.isArray(moves) || moves.length>100) throw Error('Invalid move list.');
  const seen = new Set();
  for (const m of moves) {
    if (typeof m.from !== 'string' || typeof m.to !== 'string' || !/^[a-f0-9]{64}$/.test(m.sha256)) throw Error('Invalid move.');
    if (!m.from || m.from.startsWith('.') || /[\\/:\x00-\x1f]/.test(m.from) || /[. ]$/.test(m.from)) throw Error('Unsafe source name.');
    const pieces = m.to.split('/');
    if (pieces.length !== 2 || !/^doze-[a-z0-9-]+$/.test(pieces[0]) || pieces[1] !== m.from) throw Error('Unsafe destination.');
    if (seen.has(m.from.toLowerCase())) throw Error('Duplicate source.');
    seen.add(m.from.toLowerCase());
  }
}
async function exists(p) { try { return await fs.lstat(p); } catch(e) { if(e.code==='ENOENT') return null; throw e; } }
async function verify(p, digest) {
  const st = await fs.lstat(p);
  if (!st.isFile() || st.isSymbolicLink() || hash(await fs.readFile(p)) !== digest) throw Error(`File changed or unsafe: ${p}`);
}
async function withLock(root, action) {
  const lock = path.join(root,'.deskdoze.lock');
  const handle = await fs.open(lock,'wx');
  try { return await action(); } finally { await handle.close(); await fs.unlink(lock); }
}

export async function applyPlan(p) {
  if (p.version !== 1) throw Error('Unsupported plan version.');
  validateMoves(p.moves);
  const root = await directory(p.root);
  return withLock(root, async () => {
    for (const m of p.moves) {
      await verify(path.join(root,m.from),m.sha256);
      const parent = path.dirname(path.join(root,m.to));
      if (await exists(parent)) await directory(parent);
      if (await exists(path.join(root,m.to))) throw Error(`Destination already exists: ${m.to}`);
    }
    const journal = path.join(root,`.deskdoze-undo-${crypto.randomUUID()}.json`);
    // Write-ahead journal: undo can recover even if a crash happens mid-copy/move.
    await fs.writeFile(journal, JSON.stringify({version:1,root,moves:p.moves},null,2), {flag:'wx'});
    try {
      for (const m of p.moves) {
        const src=path.join(root,m.from), dst=path.join(root,m.to);
        await fs.mkdir(path.dirname(dst),{recursive:true});
        await directory(path.dirname(dst));
        await verify(src,m.sha256);
        await fs.copyFile(src,dst,fs.constants.COPYFILE_EXCL);
        await verify(dst,m.sha256);
        await verify(src,m.sha256);
        await fs.unlink(src);
      }
    } catch(e) { throw Error(`${e.message}\nRecover with: node src/cli.mjs undo "${journal}"`); }
    return journal;
  });
}

export async function undo(journalPath) {
  const journal = path.resolve(journalPath);
  const journalStat = await fs.lstat(journal);
  if (!journalStat.isFile() || journalStat.isSymbolicLink()) throw Error('Unsafe journal.');
  const p = JSON.parse(await fs.readFile(journal,'utf8'));
  if (p.version!==1) throw Error('Unsupported journal.');
  validateMoves(p.moves);
  const root = await directory(p.root);
  if (path.dirname(journal)!==root || !path.basename(journal).startsWith('.deskdoze-undo-')) throw Error('Journal must be inside its source folder.');
  return withLock(root,async()=>{
    // Full preflight avoids restoring half a batch before detecting an edited file.
    for (const m of p.moves) {
      const src=path.join(root,m.from), dst=path.join(root,m.to);
      if (await exists(path.dirname(dst))) await directory(path.dirname(dst));
      const a=await exists(src), b=await exists(dst);
      if (!a && !b) throw Error(`Both copies missing: ${m.from}`);
      if (a) await verify(src,m.sha256);
      if (b) await verify(dst,m.sha256);
    }
    for (const m of [...p.moves].reverse()) {
      const src=path.join(root,m.from), dst=path.join(root,m.to);
      if (await exists(dst)) {
        await verify(dst,m.sha256);
        if (!(await exists(src))) await fs.copyFile(dst,src,fs.constants.COPYFILE_EXCL);
        await verify(src,m.sha256);
        await fs.unlink(dst);
      }
    }
    for (const folder of new Set(p.moves.map(m=>path.dirname(path.join(root,m.to))))) {
      try { await fs.rmdir(folder); } catch(e) { if(!['ENOENT','ENOTEMPTY','EEXIST'].includes(e.code)) throw e; }
    }
    return p.moves.length;
  });
}
