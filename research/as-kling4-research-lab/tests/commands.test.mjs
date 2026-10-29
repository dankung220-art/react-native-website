import test from'node:test';import assert from'node:assert/strict';import{mkdtemp,mkdir,writeFile,readFile,rm}from'node:fs/promises';import{spawnSync}from'node:child_process';import path from'node:path';import os from'node:os';import{buildCommand}from'../src/commands.mjs';
test('pasting the entire exported cURL snippet triggers exactly one submission',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'as-command-'));try{await mkdir(path.join(dir,'scripts'));await mkdir(path.join(dir,'bin'));
  await writeFile(path.join(dir,'scripts/run-curl.sh'),'#!/bin/bash\nprintf "POST\\n" >> "$AS_SUBMISSION_LOG"\n');
  await writeFile(path.join(dir,'bin/curl'),'#!/bin/bash\nprintf "POST\\n" >> "$AS_SUBMISSION_LOG"\n',{mode:0o755});
  const p={model:'kling_4',promptImage:'https://assets.my-test.example/first.jpg',ratio:'auto_720p',duration:10,promptText:'$(touch should-not-exist) `touch should-not-exist`'};
  const r=spawnSync('bash',['-c',buildCommand('curl',p)],{cwd:dir,encoding:'utf8',env:{...process.env,PATH:path.join(dir,'bin')+':'+process.env.PATH,AS_SUBMISSION_LOG:path.join(dir,'submissions')}});
  assert.equal(r.status,0,r.stderr);assert.deepEqual((await readFile(path.join(dir,'submissions'),'utf8')).trim().split('\n'),['POST']);
  await assert.rejects(readFile(path.join(dir,'should-not-exist')));
 }finally{await rm(dir,{recursive:true,force:true});}
});
