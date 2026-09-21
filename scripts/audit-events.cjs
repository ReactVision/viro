// Copyright © 2026 ReactVision
//
// Callbacks that are declared and never fired.
//
// This is a failure with no symptom. An app sets `onSomething`, the prop type
// checks, the component mounts, and nothing ever calls it — no error, no
// warning, no log. The developer concludes the feature is broken in some subtle
// way and goes looking in the wrong place, because the one thing that would
// point at the truth is the absence of something.
//
// It has happened twice: `onWorldMeshUpdated`, and `onCloudAnchorStateChange`,
// which was declared through 3.0.1 with a doc comment promising progress
// updates and was wired to nothing on either platform.
//
// A callback is real if any of three things is true: Android registers an event
// whose name matches, iOS names it, or a JS parent invokes it. Native names
// carry a `Viro` suffix (`onTrackingUpdated` is emitted as `onTrackingUpdatedViro`),
// which is why the match is by prefix rather than equality — checking for the
// bare name alone produces false positives on events that work perfectly.
//
// Run: node scripts/audit-events.cjs   (exits non-zero on a finding)

const fs=require('fs'), path=require('path');
const V = path.resolve(__dirname, '..');
const walk=(d,out=[])=>{ if(!fs.existsSync(d)) return out;
  for(const e of fs.readdirSync(d,{withFileTypes:true})){ const f=path.join(d,e.name);
    if(e.isDirectory()){ if(!/node_modules|build|dist|__test__|web-harness/.test(f)) walk(f,out); } else out.push(f);} return out; };

// 1. Declared in the public prop types
const declared=new Map(); // event -> file
for(const f of walk(path.join(V,'components')).filter(f=>/\.tsx?$/.test(f)&&!/\.web\./.test(f))){
  const s=fs.readFileSync(f,'utf8');
  for(const m of s.matchAll(/^\s*(on[A-Z][A-Za-z0-9]*?)(?:Viro)?\??\s*:\s*\(/gm)){
    if(!declared.has(m[1])) declared.set(m[1], path.relative(V,f));
  }
}

// 2. Emitted / registered natively
const android=new Set(), ios=new Set();
for(const f of walk(path.join(V,'android')).filter(f=>f.endsWith('.java'))){
  const s=fs.readFileSync(f,'utf8');
  for(const m of s.matchAll(/"(on[A-Z][A-Za-z0-9]*?)(?:Viro)?"/g)) android.add(m[1]);
}
for(const f of walk(path.join(V,'ios')).filter(f=>/\.(mm|m|h)$/.test(f))){
  const s=fs.readFileSync(f,'utf8');
  for(const m of s.matchAll(/\b(on[A-Z][A-Za-z0-9]*?)(?:Viro)?\b/g)) ios.add(m[1]);
}
// 3. Events a JS parent synthesises rather than the native side (still real)
const jsEmitted=new Set();
for(const f of walk(path.join(V,'components')).filter(f=>/\.tsx?$/.test(f)&&!/\.web\./.test(f))){
  const s=fs.readFileSync(f,'utf8');
  for(const m of s.matchAll(/(?:this\.)?props\.(on[A-Z][A-Za-z0-9]*)\s*(?:\?\.)?\s*\(/g)) jsEmitted.add(m[1]);
  for(const m of s.matchAll(/\b(on[A-Z][A-Za-z0-9]*)\?\.\(/g)) jsEmitted.add(m[1]);
  // Held in a ref and called later — the commonest shape for a callback a hook
  // must not re-subscribe on, and invisible to a plain `props.onX(` match.
  for(const m of s.matchAll(/\b(on[A-Z][A-Za-z0-9]*)Ref\.current\s*\??\.?\(/g)) jsEmitted.add(m[1]);
  // Passed straight through to a child as a prop.
  for(const m of s.matchAll(/\b(on[A-Z][A-Za-z0-9]*)\s*=\s*\{/g)) jsEmitted.add(m[1]);
}

// React Native's own PanResponder surface, and callback parameters on internal
// helpers rather than component props. Neither is a native event.
// React Native's own PanResponder surface, and callback parameters on internal
// helper functions rather than component props. Neither is a Viro event.
const NOT_VIRO_EVENTS = /^on(Move|Start)ShouldSetPanResponder$|^onPanResponder/;
const INTERNAL = /Studio\/domain\//;
// Parameters of the Studio scene walker, threaded as function arguments rather
// than component props — sceneNavigationHandler.ts:748 calls this one directly.
const WALKER_PARAMS = /^onAnimationTrigger$/;
const gaps=[];
for(const [ev,file] of [...declared].sort()){
  const a=android.has(ev), i=ios.has(ev), j=jsEmitted.has(ev);
  if(!a&&!i&&!j && !NOT_VIRO_EVENTS.test(ev) && !WALKER_PARAMS.test(ev) && !INTERNAL.test(file)) gaps.push({ev,file});
}
console.log('eventos declarados: '+declared.size);
console.log('sin emisor en Android, iOS ni JS: '+gaps.length+'\n');
for(const g of gaps) console.log('  '+g.ev.padEnd(30)+g.file);

if (gaps.length) {
  console.log('\nEach is either a callback to wire up, a prop to remove, or a filter to widen.');
  process.exitCode = 1;
} else {
  console.log('events: every declared callback has something that fires it');
}
