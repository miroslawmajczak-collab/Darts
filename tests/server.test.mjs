import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createApp, DEFAULTS } from '../server.mjs';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scratch=path.resolve(appRoot,'../..','work','test-data');

test('local service: static assets, protected settings, authentication and persistence',async t=>{
  await mkdir(scratch,{recursive:true});
  const dataDir=await mkdtemp(path.join(scratch,'settings-'));
  const server=createApp({dataDir});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const post=(endpoint,data,cookie)=>fetch(origin+endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
  let response=await fetch(origin+'/');assert.equal(response.status,200);assert.match(await response.text(),/FLIGHT/);
  assert.equal((await fetch(origin+'/config/admin.json')).status,404);
  assert.equal((await fetch(origin+'/api/settings').then(r=>r.json())).playerCount,2);
  assert.equal((await post('/api/settings',DEFAULTS)).status,401);
  assert.equal((await fetch(origin+'/api/admin/setup',{method:'POST',body:'{}'})).status,403);
  response=await post('/api/admin/setup',{password:'test-password-2026'});assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('/api/admin/setup',{password:'replacement-password'})).status,409);
  const stored=JSON.parse(await readFile(path.join(dataDir,'admin.json'),'utf8'));assert.ok(stored.hash);assert.ok(!JSON.stringify(stored).includes('test-password'));
  response=await post('/api/settings',{...DEFAULTS,language:'pl',playerCount:6},cookie);assert.equal(response.status,200);
  assert.equal((await fetch(origin+'/api/settings').then(r=>r.json())).language,'pl');
  assert.equal((await post('/api/settings',{...DEFAULTS,playerCount:7},cookie)).status,400);
  for(const mode of ['killer','shanghai','halveit']){
    assert.equal((await post('/api/settings',{...DEFAULTS,language:'pl',playerCount:6,mode},cookie)).status,200);
    assert.equal((await fetch(origin+'/api/settings').then(r=>r.json())).mode,mode);
  }
  assert.equal((await post('/api/admin/login',{password:'wrong-password'})).status,401);
  assert.equal((await post('/api/admin/login',{password:'test-password-2026'})).status,200);
  assert.equal((await post('/api/admin/logout',{},cookie)).status,200);
  assert.equal((await post('/api/settings',DEFAULTS,cookie)).status,401);
  assert.equal(JSON.parse(await readFile(path.join(dataDir,'settings.json'),'utf8')).playerCount,6);
});

test('translations are complete, have matching placeholders, and cover UI keys',async()=>{
  const en=JSON.parse(await readFile(path.join(appRoot,'web/locales/en.json'),'utf8'));
  const pl=JSON.parse(await readFile(path.join(appRoot,'web/locales/pl.json'),'utf8'));
  assert.deepEqual(Object.keys(en).sort(),Object.keys(pl).sort());
  for(const key of Object.keys(en)){
    assert.ok(pl[key].trim(),key);
    assert.deepEqual((en[key].match(/\{\w+\}/g)||[]).sort(),(pl[key].match(/\{\w+\}/g)||[]).sort(),key);
  }
  const source=await readFile(path.join(appRoot,'web/js/app.js'),'utf8');
  for(const match of source.matchAll(/\bt\('([^']+)'/g))assert.ok(en[match[1]],`Missing translation: ${match[1]}`);
});
