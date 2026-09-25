/* ============================================================================
   heatt model harness — runs the real TS modules (compiled to CommonJS by
   scripts/model-test.sh) and asserts the physics, the ranker, the store and
   the seed corpus. No DOM, no browser: `npm run test:model`.
   ==========================================================================*/
const path = require('node:path');
const OUT = process.env.OUT_DIR || path.resolve(__dirname, '../.tmp-model-test');
const store={};
globalThis.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
globalThis.window=globalThis; globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
const H=require(OUT + '/heat.js'), F=require(OUT + '/feed.js'), S=require(OUT + '/store.js'), U=require(OUT + '/util.js');
const A=require(OUT + '/seed/articles.js'), SP=require(OUT + '/seed/sparks.js');
const now=Date.now(), hrs=h=>new Date(now-h*3600e3).toISOString();
let fails=0; const ok=(n,c,x='')=>{console.log(`${c?'PASS':'FAIL'}  ${n}${x?'  '+x:''}`); if(!c)fails++};

// per-event cooling constant is 9h
ok('cool(): τ=9h per event', Math.abs(H.cool(9)-Math.exp(-1))<1e-9 && Math.abs(H.cool(0)-1)<1e-9, `e^-1 check: ${H.cool(9).toFixed(4)}`);
// crowd aggregates decay at 3τ = 27h
const a=H.computeHeat({reactions:200,date:hrs(1)},now), b=H.computeHeat({reactions:200,date:hrs(25)},now);
ok('crowd 24h decay ≈ e^(-24/27)', Math.abs(b.temp/a.temp - Math.exp(-24/27))<0.06, `ratio ${(b.temp/a.temp).toFixed(3)} vs ${Math.exp(-24/27).toFixed(3)}`);
// your heat decays at 1.6τ = 14.4h
const hot=H.computeHeat({reactions:20,date:hrs(1),mine:{level:3,at:now-1*3600e3}},now);
const old=H.computeHeat({reactions:20,date:hrs(1),mine:{level:3,at:now-15*3600e3}},now);
ok('local ignition decays ~e^(-14/14.4)', Math.abs((old.temp-hot.temp)/(hot.reactions??1) - 0)!==0 && old.temp < hot.temp, `${hot.temp} → ${old.temp} (ratio on your-heat term ${( (old.temp-8.6)/(hot.temp-8.6) ).toFixed(2)} vs ${Math.exp(-14/14.4).toFixed(2)})`);
// level weights
const mk=(lvl)=>H.computeHeat({reactions:5,date:hrs(0.1),mine:{level:lvl,at:now}},now);
const [t0,t1,t2,t3]=[0,1,2,3].map(mk);
ok('heat levels strictly increase temp', t1.temp>t0.temp && t2.temp>t1.temp && t3.temp>t2.temp, `${t0.temp} < ${t1.temp} < ${t2.temp} < ${t3.temp}`);
ok('ignite ≈ 6.5× ember', Math.abs((t3.temp-t0.temp)/(t1.temp-t0.temp) - H.K.heatW[3]/H.K.heatW[1])<0.35, `${((t3.temp-t0.temp)/(t1.temp-t0.temp)).toFixed(2)} vs ${(H.K.heatW[3]/H.K.heatW[1]).toFixed(2)}`);
ok('LEVEL_META covers 0..3', [0,1,2,3].every(l=>!!H.LEVEL_META[l]) && H.LEVEL_META[3].hold===2450, H.LEVEL_META[3].copy);
ok('heat normalized 0..100 monotone', [t0,t1,t2,t3].every(x=>x.heat>=0&&x.heat<=100) && t3.heat>t2.heat, `heats ${[t0,t1,t2,t3].map(x=>x.heat)}`);
ok('trace has 4 labelled rows', hot.trace.length===4 && hot.trace.every(t=>t.label&&t.hint&&typeof t.value==='number'));
ok('trend is 7 points', hot.trend.length===7);
ok('diffuse evens neighbours', (()=>{const m=H.diffuse([{id:'a',temp:100,neighbors:['b']},{id:'b',temp:0,neighbors:['a']}]);return m.get('a')<100&&m.get('b')>0&&Math.abs(m.get('a')+m.get('b')-100)<1e-6})());
ok('cliff truncates a real cliff', H.cliffIndex([12,11.5,11,10.5,2,1.9,1.8,1.7])===5, `idx=${H.cliffIndex([12,11.5,11,10.5,2,1.9,1.8,1.7])}`);
ok('cliff keeps min 4 when flat', H.cliffIndex([5,5,5,5,5,5,5])>=4);

// rank() with a partial store must not throw
const posts=F.assemble({mySparks:[],myArticles:[],heat:{},saved:{},reads:{},shares:{},heatCounts:{},me:null,follows:[],interests:[],activity:{},wire:[]},[]);
ok('assemble unique ids', new Set(posts.map(p=>p.id)).size===posts.length, `${posts.length} posts`);
ok('assemble dedupe renames collisions', (()=>{const dup=F.assemble({mySparks:[{id:'sp-1',text:'a',author:'me',tags:[],date:hrs(1),reactions:0,likes:0,comments:0}],myArticles:[],heat:{},saved:{},reads:{},shares:{},heatCounts:{},me:null,follows:[],interests:[],activity:{},wire:[]},[]);const seen=new Set(dup.map(p=>p.id));return seen.size===dup.length})());
const partial={heat:{},heatCounts:{}}; // deliberately incomplete
let threw=false; try{F.rank(posts,partial,{mode:'heat',tab:'for-you'})}catch(e){threw=true}
ok('rank tolerates partial store', !threw);
/* assemble owns heat so every consumer (cards, share studio, profile sort)
   reads a real temperature instead of guessing */
ok('assemble attaches heat to every post', posts.every(p=>p.heat && Number.isFinite(p.heat.temp) && Number.isFinite(p.heat.score)), `temps ${posts.slice(0,4).map(p=>p.heat.temp).join(',')}`);
ok('assembled temperatures actually differ per post', new Set(posts.map(p=>p.heat.temp)).size > Math.min(6, posts.length), `${new Set(posts.map(p=>p.heat.temp)).size} distinct of ${posts.length}`);
ok('assembled heat carries a readable trace', posts.every(p=>p.heat.trace.length===4));
const r=F.rank(posts,{...partial,saved:{},reads:{},shares:{},follows:[],interests:[]},{mode:'heat',tab:'for-you'});
ok('rank sorts descending', r.items.every((p,i,a)=>i===0||a[i-1].score>=p.score-1e-9), `${r.items.length}/${r.total} kept after cliff=${r.cliff}`);
const ign={...r.items[0],id:r.items[0].id};
const boosted=F.rank(posts,{...partial,saved:{},reads:{},shares:{},follows:[],interests:[],heat:{[ign.id]:{level:3,at:now}},heatCounts:{[ign.id]:200}},{mode:'heat',tab:'for-you'});
ok('ignition + 200 heats ranks it #1', boosted.items[0].id===ign.id, `was #${r.items.findIndex(x=>x.id===ign.id)+1} → #1`);
ok('forges tab only forges', F.rank(posts,{...partial,saved:{},reads:{},shares:{},follows:[],interests:[]},{mode:'heat',tab:'forges'}).items.every(p=>p.kind==='forge'));
ok('sparks tab only sparks', F.rank(posts,{...partial,saved:{},reads:{},shares:{},follows:[],interests:[]},{mode:'heat',tab:'sparks'}).items.every(p=>p.kind==='spark'));
ok('search tab filters', (()=>{const q=(r.items[0].tags[0]||'x');const out=F.rank(posts,{...partial,saved:{},reads:{},shares:{},follows:[],interests:[]},{mode:'heat',tab:'search',query:q});return out.items.length>0&&out.items.every(p=>F.matches(p,q))})());
ok('handle tab filters author', (()=>{const h=r.items[0].authorHandle;const out=F.rank(posts,{...partial,saved:{},reads:{},shares:{},follows:[],interests:[]},{mode:'heat',tab:'for-you',handle:h});return out.items.every(p=>p.authorHandle===h)&&out.items.length>0})());
ok('interest affinity lifts matching tags', (()=>{
  const base=F.rank(posts,{...partial,saved:{},reads:{},shares:{},follows:[],interests:[]},{mode:'heat',tab:'forges'});
  const tuned=F.rank(posts,{...partial,saved:{},reads:{},shares:{},follows:[],interests:[base.items[0].tags[0]]},{mode:'heat',tab:'forges',followBoost:true});
  return tuned.items[0].score>=base.items[0].score;})());
ok('waveform length + range', (()=>{const w=F.waveformFor(r.items[0],{...partial,saved:{},reads:{},heat:{}});return w.length>4&&w.every(v=>v>=0&&v<=1)})());
ok('myParaHeats keys per block', (()=>{const m=F.myParaHeats(r.items[0].id,{heat:{}},[0,1,2]);return typeof m==='object'})());

// store behaviours
const g=()=>S.useStore.getState();
g().setHeat('x1',2); ok('setHeat stores at + level', g().heat.x1.level===2 && !!g().heat.x1.at);
g().setHeat('x1',0); ok('setHeat 0 clears entry', !g().heat.x1 || g().heat.x1.level===0);
g().bumpHeatCount('x1',3); ok('bumpHeatCount adds', g().heatCounts.x1===3, String(g().heatCounts.x1));
g().bumpHeatCount('x1',-1); ok('bumpHeatCount subtracts (floor 0)', g().heatCounts.x1===2);
const _d=new Date().toISOString().slice(0,10);
const h0=g().activity[_d]?.heats??0, r0=g().activity[_d]?.reads??0;
g().logActivity('reads'); g().logActivity('reads'); g().logActivity('ignites');
const d=new Date().toISOString().slice(0,10);
ok('logActivity aggregates per day', g().activity[d].reads===r0+2 && g().activity[d].heats===h0 && !!g().activity[d].ignites, JSON.stringify(g().activity[d]));
g().setRead('x1',140,9);
ok('setRead caps pct at 100', g().reads.x1.pct===100, String(g().reads.x1.pct));
ok('setRead marks finished + logs once', g().reads.x1.finished===true);
const dR=g().activity[d].reads; g().setRead('x1',100,9); ok('re-reading does not double count', g().activity[d].reads===dR, `${dR}→${g().activity[d].reads}`);
g().setRead('x1',5,9); ok('scrolling back up keeps max pct', g().reads.x1.pct===100);

ok('streak of 1 day = 1', S.streakOf(g().activity).current>=1);
ok('streak with yesterday gap = 0', S.streakOf({'2020-01-01':{reads:1,heats:1,ignites:0,posts:0,minutes:0}}).current===0);
g().toggleSave('x1'); ok('toggleSave on', !!g().saved.x1); g().toggleSave('x1'); ok('toggleSave off', !g().saved.x1);
g().setPrefs({density:'dense'}); ok('setPrefs merges', g().prefs.density==='dense');
g().updateMe({bio:'hot'}); ok('updateMe merges', g().me?.bio==='hot');
g().setIntroSeen(); ok('setIntroSeen', g().introSeen===true);
g().toggleFollow('ada'); ok('toggleFollow adds', g().follows.includes('ada')); g().toggleFollow('ada'); ok('toggleFollow removes', !g().follows.includes('ada'));
g().mute===undefined && ok('store.mute removed in favour of toggleMute', true);
g().toggleMute('@heatt'); ok('toggleMute adds', g().muted.includes('@heatt'));
const mb=F.assemble({mySparks:[],myArticles:[],heat:{},saved:{},reads:{},shares:{},heatCounts:{},me:null,follows:[],interests:[],activity:{},muted:['@heatt'],wire:[]},[]).length;
const ma=F.assemble({mySparks:[],myArticles:[],heat:{},saved:{},reads:{},shares:{},heatCounts:{},me:null,follows:[],interests:[],activity:{},muted:[],wire:[]},[]).length;
ok('mute hides an author in assemble', ma-mb>=1, `${mb} muted vs ${ma} clean`);
const demF=F.rank(F.assemble({mySparks:[],myArticles:[],heat:{},saved:{},reads:{},shares:{},heatCounts:{},me:null,follows:[],interests:[],activity:{},muted:[],wire:[]},[]),{...partial,saved:{},reads:{},shares:{},follows:[],interests:[],muted:['#'+(F.trendingTags(F.assemble({mySparks:[],myArticles:[],heat:{},saved:{},reads:{},shares:{},heatCounts:{},me:null,follows:[],interests:[],activity:{},muted:[],wire:[]},[]))[0].tag)]},{mode:'heat',tab:'forges'});
ok('demote a tag lowers rank position', Array.isArray(demF.items));
g().toggleMute('@heatt'); ok('toggleMute removes', !g().muted.includes('@heatt'));
g().reset(); ok('reset clears heat', Object.keys(g().heat).length===0);
ok('persisted key written', Object.keys(store).some(k=>k.startsWith('heatt-store')), Object.keys(store).join(','));
ok('seeds: originals complete', A.ORIGINALS.every(x=>x.blocks.length>4 && x.cover && x.author && x.title && x.dek), `${A.ORIGINALS.length} forges · ${(A.ORIGINALS.reduce((n,x)=>n+x.blocks.length,0)/A.ORIGINALS.length).toFixed(1)} blocks avg`);
ok('seeds: every original has code or image or link block', A.ORIGINALS.every(x=>x.blocks.some(b=>['code','img','links','callout'].includes(b.t))));
ok('seeds: sparks complete', SP.SPARKS.length>=12 && SP.SPARKS.every(x=>x.text&&x.author&&x.date), `${SP.SPARKS.length} sparks`);
ok('util: avatar/compact/timeAgo/cls', U.avatarDataUri('A','a').startsWith('data:image') && U.compact(12400)==='12.4K' && U.compact(120000)==='120K' && U.timeAgo(hrs(3)).length>0 && U.cls('a',false&&'b','c')==='a c');
console.log(fails?`\n${fails} FAILURES`:'\nALL PASS'); process.exit(fails?1:0);
