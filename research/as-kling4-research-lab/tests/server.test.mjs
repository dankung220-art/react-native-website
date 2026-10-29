import test from'node:test';import assert from'node:assert/strict';import{spawn}from'node:child_process';
test('local server serves the lab root, denies secret paths and has no live POST endpoint',async()=>{
 const child=spawn(process.execPath,[new URL('../src/server.mjs',import.meta.url).pathname,'--port','0'],{stdio:['ignore','pipe','pipe']});
 try{const base=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server did not start')),3000);child.once('exit',()=>{clearTimeout(t);reject(Error('Server exited before listening'));});child.stdout.on('data',buf=>{const m=String(buf).match(/127\.0\.0\.1:(\d+)/);if(m&&Number(m[1])>0){clearTimeout(t);resolve('http://127.0.0.1:'+m[1]);}});});
 const root=await fetch(base);assert.equal(root.status,200);assert.match(await root.text(),/AS · Kling 4 Research Lab/);
 assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await fetch(base+'/src/cli.mjs')).status,404);
 assert.equal((await fetch(base+'/v1/image_to_video',{method:'POST',body:'{}'})).status,405);
 }finally{child.kill();}
});
