const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async()=>{
const b=await chromium.launch(); const context=await b.newContext({...devices['Galaxy S9+'],acceptDownloads:true});
const p=await context.newPage(), errors=[];p.on('pageerror',e=>errors.push(e.message));
const url=process.argv[2];await p.goto(url);await p.evaluate(()=>sessionStorage.setItem('swingkai_preview','1'));await p.reload();
await p.click('[data-tab="science"]');await p.click('[data-action="export-recording"]');assert.match(await p.locator('#exportStatus').innerText(),/No raw recording/);
const payload=await p.evaluate(async()=>{const {synthSwings}=await import('./swing-review.js');return{source:'apple-watch',placement:'lead-wrist',marked_reps:6,batches:[{session_id:'test',batch_sequence:0,sample_sequence:0,monotonic_timestamp:0,orientation:'unknown',battery_state:'unknown',samples:synthSwings({n:6})}]}});
await p.setInputFiles('#importFile',{name:'recording.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
await p.waitForFunction(()=>document.querySelector('#importNote').textContent.startsWith('Imported'));
assert.match(await p.locator('#sciReview').innerText(),/Experimental review/);
assert.doesNotMatch(await p.locator('#sciReview').innerText(),/got snatchy|sequence you rehearsed held|3:1 as a reference/);
const dlPromise=p.waitForEvent('download');await p.click('[data-action="export-recording"]');const dl=await dlPromise;
const j=JSON.parse(await fs.readFile(await dl.path(),'utf8'));assert.equal(j.batches[0].samples.length,payload.batches[0].samples.length);assert.equal(j.review.facts.experimental,true);assert.equal(j.review.facts.engine_version,'0.2.0');
assert.equal(j.readiness,undefined);assert.equal(j.name,undefined);assert.equal(j.notes,undefined);
assert.match(j.review.next.join(' '),/unchanged/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
console.log(JSON.stringify({androidViewport:true,exportSamples:j.batches[0].samples.length,experimental:true,privateFieldsExcluded:true,errors}));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
