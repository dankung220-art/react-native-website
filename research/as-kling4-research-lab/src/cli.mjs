#!/usr/bin/env node
import{parseArgs}from'node:util';
import{readFileSync,writeFileSync,appendFileSync,mkdirSync,renameSync,existsSync}from'node:fs';
import{createHash,randomBytes}from'node:crypto';
import{pathToFileURL}from'node:url';
import path from'node:path';
import{validatePayload,estimateCost,buildPrompt,redactMedia}from'./core.mjs';
import{RunwayClient,WaitTimeoutError}from'./client.mjs';
import{downloadTaskOutputs}from'./outputs.mjs';
const options={mock:{type:'boolean'},live:{type:'boolean'},'allow-spend':{type:'boolean'},'confirm-cancel':{type:'boolean'},request:{type:'string'},out:{type:'string'},budget:{type:'string'},task:{type:'string'},receipt:{type:'string'},timeout:{type:'string'},image:{type:'string'},duration:{type:'string'},ratio:{type:'string'},help:{type:'boolean'}};
const readJSON=f=>JSON.parse(readFileSync(f,'utf8'));
function saveJSON(f,d){const tmp=f+'.'+randomBytes(4).toString('hex')+'.part';writeFileSync(tmp,JSON.stringify(d,null,2)+'\n',{mode:0o600,flag:'wx'});renameSync(tmp,f);}
function fail(m){throw Error(m);}
function rejectExamples(p){const uris=typeof p.promptImage==='string'?[p.promptImage]:p.promptImage.map(x=>x.uri);uris.push(...(p.references??[]).map(x=>x.uri));for(const uri of uris)if(uri.startsWith('https://')&&/(^|\.)(example\.(com|org|net|invalid)|invalid|test|localhost)$/.test(new URL(uri).hostname))fail('Replace example media URLs with your actual image, or use prepare');}
function logger(out,mode,now){const start=now();return e=>{const row={at:new Date(now()).toISOString(),elapsedMs:now()-start,mode,clock:mode==='mock'?'simulated':'wall',...redactMedia(e)};appendFileSync(path.join(out,'events.jsonl'),JSON.stringify(row)+'\n',{mode:0o600});console.log(JSON.stringify(row));};}
function mockTransport(){const id='64ce0011-1111-4111-8111-123456789abc';let i=0;return async(_u,init)=>{if(init.method==='POST')return Response.json({id,estimatedCost:{credits:0}});const status=['PENDING','THROTTLED','RUNNING','SUCCEEDED'][Math.min(i++,3)];return Response.json({id,status,...(status==='SUCCEEDED'?{output:['https://example.invalid/simulated-not-a-video.mp4']}:{})});};}
export async function main(argv=process.argv.slice(2)){
 const{values:v,positionals}=parseArgs({args:argv,options,allowPositionals:true});const command=positionals[0]??'help';
 if(command==='help'||v.help){console.log(`AS Kling 4 Research Lab\nprepare --image first.jpg --request my-request.json [--duration 10]\nvalidate --request my-request.json\nrun --mock --request examples/request.first.json [--out runs/demo]\nrun --live --allow-spend --budget 150 --request my-request.json\nresume --live --task UUID [--out runs/resumed] [--timeout 900]\nresume --live --receipt runs/ID/receipt.json\ncancel --live --confirm-cancel --task UUID\nLive operations read RUNWAYML_API_SECRET from the environment. Budget is an estimate gate, not a provider billing cap. POST is never automatically retried.`);return;}
 if(command==='prepare'){
  if(!v.image||!v.request)fail('prepare requires --image and --request');const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[path.extname(v.image).toLowerCase()];if(!mime)fail('Use a PNG/JPG/WebP file');
  const duration=Number(v.duration??10),payload=validatePayload({model:'kling_4',promptImage:`data:${mime};base64,${readFileSync(v.image).toString('base64')}`,duration,ratio:v.ratio??'auto_720p',promptText:buildPrompt(duration)});
  if(existsSync(v.request))fail('Request destination already exists');mkdirSync(path.dirname(path.resolve(v.request)),{recursive:true});saveJSON(v.request,payload);console.log(`Prepared ${v.request}. Check image dimensions, minimum 300 px each side, before live submission.`);return;
 }
 if(command==='validate'){if(!v.request)fail('--request is required');const p=validatePayload(readJSON(v.request));console.log(JSON.stringify({valid:true,estimate:estimateCost(p),request:redactMedia(p)},null,2));return;}
 if(!['run','resume','cancel'].includes(command))fail(`Unknown command: ${command}`);
 if(command==='run'&&(!!v.live===!!v.mock))fail('Choose exactly one mode: --mock or --live');
 if(command!=='run'&&(!v.live||v.mock))fail('resume/cancel require --live mode');
 if(command==='run'&&v.live&&!v['allow-spend'])fail('Live submission requires --allow-spend');
 if(command==='cancel'&&!v['confirm-cancel'])fail('Cancellation/deletion requires --confirm-cancel. Refunds are not guaranteed.');
 const mode=v.mock?'mock':'live';let payload,estimate;
 if(command==='run'){if(!v.request)fail('--request is required');payload=validatePayload(readJSON(v.request));estimate=estimateCost(payload);if(v.live){const budget=Number(v.budget);if(!Number.isFinite(budget)||budget<=0)fail('Live submission requires --budget in credits');if(estimate.credits>budget)fail(`Estimated ${estimate.credits} exceeds budget ${budget}; no task submitted`);rejectExamples(payload);}}
 const apiKey=mode==='mock'?'MOCK-NOT-A-REAL-KEY':process.env.RUNWAYML_API_SECRET;if(!apiKey?.trim())fail('RUNWAYML_API_SECRET is required for live operations');
 let clock=Date.now();const now=mode==='mock'?()=>clock:Date.now;
 const out=path.resolve(v.out??path.join('runs',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(3).toString('hex')));mkdirSync(out,{recursive:true,mode:0o700});
 if(command==='run'&&existsSync(path.join(out,'receipt.json')))fail('Output already has a receipt; resume it or choose a new directory');
 const log=logger(out,mode,now),client=new RunwayClient({apiKey,onEvent:log,now,...(mode==='mock'?{fetchFn:mockTransport(),random:()=>0,sleepFn:async ms=>{clock+=ms;}}:{})});
 const timeoutMs=Number(v.timeout??900)*1000;if(!Number.isFinite(timeoutMs)||timeoutMs<=0)fail('--timeout must be positive seconds');
 let taskId=v.task;if(v.receipt){const receipt=readJSON(v.receipt);if(receipt.mode!=='live')fail('Refusing live operation on a mock receipt');taskId=receipt.taskId;}
 try{
  if(command==='run'){
   saveJSON(path.join(out,'request.private.json'),payload);const requestHash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
   saveJSON(path.join(out,'manifest.json'),{mode,model:'kling_4',requestHash,estimate,sourceSnapshot:'2026-10-29',note:'Private request media is kept out of Git and exports'});log({event:'VALIDATED',requestHash,estimatedCredits:estimate.credits,clipDurationSeconds:payload.duration??5});
   const receipt=await client.create(payload,{onCreated(received){taskId=received.id;saveJSON(path.join(out,'receipt.json'),{taskId,mode,createdAt:new Date().toISOString(),requestHash,providerEstimatedCredits:received.estimatedCost?.credits??null});}});taskId=receipt.id;log({event:'RECEIPT_SAVED',taskId});
   if(v.live&&Number(receipt.estimatedCost?.credits)>Number(v.budget))log({event:'PROVIDER_ESTIMATE_EXCEEDS_LOCAL_BUDGET',taskId,providerEstimatedCredits:receipt.estimatedCost.credits});
  }
  if(!taskId)fail('Supply --task or a live --receipt');if(command==='cancel'){console.log(JSON.stringify(await client.cancel(taskId)));return;}
  const task=await client.wait(taskId,{timeoutMs});saveJSON(path.join(out,'task.redacted.json'),redactMedia(task));
  if(mode==='mock'){log({event:'SIMULATION_COMPLETED',taskId,note:'No API call, no credits spent, no generated video, virtual clock only'});return;}
  const files=await downloadTaskOutputs(client,task,out);
  saveJSON(path.join(out,'result.json'),{mode,taskId,files,finishedAt:new Date().toISOString()});log({event:'RUN_COMPLETED',taskId,outputCount:files.length,files:files.map(f=>({file:path.basename(f.file),bytes:f.bytes,sha256:f.sha256}))});
 }catch(e){if(!taskId&&e.taskId)taskId=e.taskId;if(taskId&&!e.taskId)e.taskId=taskId;try{log({event:e instanceof WaitTimeoutError?'LOCAL_WAIT_TIMEOUT':'RUN_STOPPED',taskId:taskId??null,errorType:e.name});}catch{}throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{const key=process.env.RUNWAYML_API_SECRET;console.error(`ERROR ${e.name}: ${key?String(e.message).split(key).join('[REDACTED]'):e.message}`);if(e.taskId)console.error(`Task ID retained: ${e.taskId}\nResume: node src/cli.mjs resume --live --task ${e.taskId}`);process.exitCode=e instanceof WaitTimeoutError?3:1;});
