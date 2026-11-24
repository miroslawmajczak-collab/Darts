import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { GAME_MODES } from './web/js/engine.js';

const scrypt = promisify(scryptCallback);
export const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LANGUAGE_CODES = JSON.parse(readFileSync(path.join(ROOT,'web/locales/languages.json'),'utf8')).map(item=>item.code);
export const DEFAULTS = { language: 'en', playerCount: 2, mode: 'x01', startScore: 501, checkout: 'double' };
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

export function validateSettings(value) {
  if (!value || !LANGUAGE_CODES.includes(value.language) || !Number.isInteger(value.playerCount) || value.playerCount<1 || value.playerCount>6 || !GAME_MODES.includes(value.mode) || (value.mode==='killer'&&value.playerCount<2) || ![301,501,701].includes(value.startScore) || !['double','straight'].includes(value.checkout)) throw new Error('INVALID_SETTINGS');
  return Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,value[k]]));
}

export function createApp({ dataDir = path.join(ROOT,'config') } = {}) {
  const sessions = new Map();
  const attempts = new Map();
  let mutation = Promise.resolve();
  const serialized = operation => { const next = mutation.then(operation); mutation = next.catch(()=>{}); return next; };
  async function readJSON(name, fallback) {
    try { return JSON.parse(await readFile(path.join(dataDir,name),'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  }
  async function atomicJSON(name, value) {
    await mkdir(dataDir,{recursive:true});
    const destination = path.join(dataDir,name), temp = destination+'.tmp';
    await writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600});
    await rename(temp,destination);
  }
  function authenticated(req) {
    const token = req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('flight_admin='))?.slice(13);
    const expiry = sessions.get(token);
    if (!expiry || expiry < Date.now()) { sessions.delete(token); return false; }
    return true;
  }
  function json(res,status,data,headers={}) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data)); }
  async function body(req) {
    let content='';
    for await (const chunk of req) { content += chunk; if (Buffer.byteLength(content)>8192) throw new Error('BODY_TOO_LARGE'); }
    return JSON.parse(content || '{}');
  }
  const server = http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const port = server.address()?.port;
    const allowedHosts = [`127.0.0.1:${port}`,`localhost:${port}`];
    if (!allowedHosts.includes(req.headers.host)) return json(res,403,{error:'INVALID_HOST'});
    if (!['GET','HEAD'].includes(req.method) && !allowedHosts.some(h=>req.headers.origin===`http://${h}`)) return json(res,403,{error:'INVALID_ORIGIN'});
    try {
      const url = new URL(req.url,`http://${req.headers.host}`);
      if (url.pathname==='/api/health' && req.method==='GET') return json(res,200,{app:'flight-local-darts',ready:true});
      if (url.pathname==='/api/settings' && req.method==='GET') {
        const settings = validateSettings(await readJSON('settings.json',DEFAULTS));
        return json(res,200,settings);
      }
      if (url.pathname==='/api/admin/status' && req.method==='GET') return json(res,200,{configured:Boolean(await readJSON('admin.json',null)),authenticated:authenticated(req)});
      if (['/api/admin/setup','/api/admin/login'].includes(url.pathname) && req.method==='POST') {
        const data = await body(req);
        return await serialized(async()=>{
          const key = req.socket.remoteAddress;
          const bucket = attempts.get(key) || {count:0,until:Date.now()+60000};
          if (bucket.until < Date.now()) {bucket.count=0;bucket.until=Date.now()+60000;}
          if (bucket.count>=6) return json(res,429,{error:'RATE_LIMIT'});
          bucket.count++;attempts.set(key,bucket);
          let admin = await readJSON('admin.json',null);
          if (url.pathname.endsWith('/setup')) {
            if (admin) return json(res,409,{error:'ALREADY_CONFIGURED'});
            if (typeof data.password!=='string' || data.password.length<8 || data.password.length>128) return json(res,400,{error:'WEAK_PASSWORD'});
            const salt=randomBytes(16).toString('hex');
            const hash=(await scrypt(data.password,salt,64)).toString('hex');
            admin={salt,hash};await atomicJSON('admin.json',admin);
          } else {
            if (!admin || typeof data.password!=='string' || data.password.length>128) return json(res,401,{error:'AUTH_FAILED'});
            const candidate=await scrypt(data.password,admin.salt,64);
            const expected=Buffer.from(admin.hash,'hex');
            if (candidate.length!==expected.length || !timingSafeEqual(candidate,expected)) return json(res,401,{error:'AUTH_FAILED'});
          }
          attempts.delete(key);
          const token=randomBytes(32).toString('hex');
          for (const [old, expiry] of sessions) if (expiry<Date.now()) sessions.delete(old);
          sessions.set(token,Date.now()+15*60*1000);
          return json(res,200,{ok:true},{'Set-Cookie':`flight_admin=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=900`});
        });
      }
      if (url.pathname==='/api/admin/logout' && req.method==='POST') {
        const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('flight_admin='))?.slice(13);sessions.delete(token);
        return json(res,200,{ok:true},{'Set-Cookie':'flight_admin=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'});
      }
      if (url.pathname==='/api/settings' && req.method==='POST') {
        if (!authenticated(req)) return json(res,401,{error:'UNAUTHORIZED'});
        const settings=validateSettings(await body(req));
        await serialized(()=>atomicJSON('settings.json',settings));
        return json(res,200,{ok:true});
      }
      if (url.pathname.startsWith('/api/')) return json(res,404,{error:'NOT_FOUND'});
      if (!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'METHOD_NOT_ALLOWED'});
      const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
      const webRoot=path.join(ROOT,'web');
      const filename=path.resolve(webRoot,'.'+relative);
      if (!filename.startsWith(webRoot+path.sep)) return json(res,403,{error:'FORBIDDEN'});
      const ext=path.extname(filename);
      if (!MIME[ext]) return json(res,404,{error:'NOT_FOUND'});
      const info=await stat(filename);
      if (!info.isFile()) return json(res,404,{error:'NOT_FOUND'});
      const content=await readFile(filename);
      res.writeHead(200,{'Content-Type':MIME[ext],'Content-Length':content.length,'Cache-Control':'no-cache'});
      res.end(req.method==='HEAD'?undefined:content);
    } catch (error) {
      if (error.code==='ENOENT') return json(res,404,{error:'NOT_FOUND'});
      if (error.message==='INVALID_SETTINGS' || error.message==='BODY_TOO_LARGE' || error instanceof SyntaxError) return json(res,400,{error:'INVALID_INPUT'});
      console.error('Request failed:',error.message);
      return json(res,500,{error:'SERVER_ERROR'});
    }
  });
  server.requestTimeout=10000;
  server.headersTimeout=10000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.FLIGHT_PORT || 17840);
  if (!Number.isInteger(port) || port<1024 || port>65535) throw new Error('Invalid FLIGHT_PORT');
  const server=createApp();
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Open http://127.0.0.1:${port} or set FLIGHT_PORT.`:error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`FLIGHT is ready: http://127.0.0.1:${port}\nOffline manual darts. Press Ctrl+C to stop.`));
}
