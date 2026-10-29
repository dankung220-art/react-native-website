import{setTimeout as delay}from'node:timers/promises';
import{createHash}from'node:crypto';
import{access,mkdir,rm,link,open}from'node:fs/promises';
import{Readable,Transform}from'node:stream';
import{pipeline}from'node:stream/promises';
import path from'node:path';
import{API_BASE,API_VERSION,validatePayload}from'./core.mjs';
export class APIError extends Error{constructor(status){super(`Runway HTTP ${status}; inspect the task before any new submission`);this.name='APIError';this.status=status;}}
export class SubmissionUnknownError extends Error{constructor(){super('Submission outcome unknown. No automatic POST retry. Inspect Runway task history before submitting again.');this.name='SubmissionUnknownError';}}
export class WaitTimeoutError extends Error{constructor(id){super('Local wait timed out; remote task may still run. Resume the same ID.');this.name='WaitTimeoutError';this.taskId=id;}}
export class TaskFailedError extends Error{constructor(t){super(`Task failed${t.failureCode?` (${t.failureCode})`:''}; no retry submitted`);this.name='TaskFailedError';this.taskId=t.id;this.task=t;}}
export class TaskCanceledError extends Error{constructor(id){super('Task canceled; no retry submitted');this.name='TaskCanceledError';this.taskId=id;}}
function checkId(id){if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('Expected a UUID v4 task ID');}
export class RunwayClient{
 constructor({apiKey,fetchFn=globalThis.fetch,sleepFn=delay,now=Date.now,random=Math.random,onEvent=()=>{}}={}){if(typeof apiKey!=='string'||!apiKey.trim()||/[\r\n]/.test(apiKey))throw Error('RUNWAYML_API_SECRET is required in the server environment');Object.assign(this,{apiKey,fetchFn,sleepFn,now,random,onEvent});}
 emit(event,details={}){this.onEvent({event,...details});}
 api(method,route,body){const headers={Authorization:`Bearer ${this.apiKey}`,'X-Runway-Version':API_VERSION};if(body!==undefined)headers['Content-Type']='application/json';return this.fetchFn(`${API_BASE}${route}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});}
 async create(p,{onCreated}={}){p=validatePayload(p);this.emit('SUBMIT_STARTED',{model:p.model,duration:p.duration??5,ratio:p.ratio??'auto_720p'});let r;try{r=await this.api('POST','/image_to_video',p);}catch{this.emit('SUBMISSION_UNKNOWN');throw new SubmissionUnknownError();}if(r.status>=500){this.emit('SUBMISSION_UNKNOWN',{httpStatus:r.status});throw new SubmissionUnknownError();}if(!r.ok)throw new APIError(r.status);let result;try{result=await r.json();checkId(result.id);}catch{throw new SubmissionUnknownError();}try{if(onCreated)await onCreated(result);this.emit('TASK_CREATED',{taskId:result.id,estimatedCredits:result.estimatedCost?.credits??null});}catch(e){e.taskId=result.id;throw e;}return result;}
 async get(id,{deadline=Infinity}={}){
  checkId(id);for(let attempt=0;attempt<5;attempt++){
   if(this.now()>=deadline)throw new WaitTimeoutError(id);let r;try{r=await this.api('GET',`/tasks/${id}`);}catch{r=null;}
   if(r?.ok){let t;try{t=await r.json();}catch{throw Error('Malformed task JSON');}if(t.id!==id||typeof t.status!=='string')throw Error('Task response ID/status mismatch');return t;}
   const status=r?.status??0;if((r&&status!==429&&![500,502,503,504].includes(status))||attempt===4)throw new APIError(status);
   const h=r?.headers.get('retry-after');let after=Number(h)*1000;if(h&&!Number.isFinite(after))after=Math.max(0,Date.parse(h)-this.now());
   const ms=Math.max(5000,Number.isFinite(after)?after:0,Math.min(60000,5000*2**attempt))+Math.floor(this.random()*500);
   this.emit('READ_BACKOFF',{taskId:id,httpStatus:status,waitMs:ms,attempt:attempt+1});if(this.now()+ms>=deadline)throw new WaitTimeoutError(id);await this.sleepFn(ms);
  }
 }
 async wait(id,{timeoutMs=900000,pollMs=5000}={}){
  checkId(id);if(!Number.isFinite(timeoutMs)||timeoutMs<=0||!Number.isFinite(pollMs))throw Error('Invalid wait settings');const deadline=this.now()+timeoutMs,interval=Math.max(5000,pollMs);
  for(;;){const t=await this.get(id,{deadline});this.emit('TASK_OBSERVED',{taskId:id,status:t.status,...(Number.isFinite(t.progress)?{providerProgress:t.progress}:{})});
   if(t.status==='SUCCEEDED'){if(!Array.isArray(t.output)||!t.output.length||t.output.some(u=>typeof u!=='string'||!u.startsWith('https://')))throw Error('Succeeded task has no valid HTTPS output URL');this.emit('OUTPUT_READY',{taskId:id,outputCount:t.output.length});return t;}
   if(t.status==='FAILED')throw new TaskFailedError(t);if(['CANCELED','CANCELLED'].includes(t.status))throw new TaskCanceledError(id);
   if(!['PENDING','THROTTLED','RUNNING'].includes(t.status))throw Error(`Unknown task status: ${t.status}`);
   if(this.now()+interval>=deadline)throw new WaitTimeoutError(id);await this.sleepFn(interval+Math.floor(this.random()*500));
  }
 }
 async cancel(id){checkId(id);const r=await this.api('DELETE',`/tasks/${id}`);if(!r.ok&&r.status!==404)throw new APIError(r.status);this.emit('CANCEL_OR_DELETE_RESPONSE',{taskId:id,httpStatus:r.status});return{id,status:r.status===404?'ABSENT':'CANCEL_OR_DELETE_ACCEPTED'};}
 async download(url,destination,{maxBytes=512*1024*1024}={}){
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error('Output must be HTTPS media');await mkdir(path.dirname(destination),{recursive:true});
  try{await access(destination);throw Error('Destination already exists; choose a new output directory');}catch(e){if(e.code!=='ENOENT')throw e;}
  this.emit('DOWNLOAD_STARTED',{file:path.basename(destination)});
  // API key must never be forwarded to the media host.
  let current=url,r;
  for(let redirects=0;;redirects++){
   r=await this.fetchFn(current,{redirect:'manual',signal:AbortSignal.timeout(180000)});
   if(![301,302,303,307,308].includes(r.status))break;
   const location=r.headers.get('location');if(!location||redirects>=5)throw Error('Invalid media redirect chain');
   const next=new URL(location,current);if(next.protocol!=='https:'||next.username||next.password)throw Error('Media redirects must remain HTTPS');current=next.href;
  }
  if(!r.ok||!r.body)throw Error(`Media download failed (HTTP ${r.status})`);if(r.url&&new URL(r.url).protocol!=='https:')throw Error('Media redirect did not remain HTTPS');
  const type=(r.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();if(!['video/mp4','application/octet-stream'].includes(type))throw Error('Unexpected media content type');
  if(Number(r.headers.get('content-length'))>maxBytes)throw Error('Media exceeds download size limit');
  let bytes=0,head=Buffer.alloc(0),owns=false;const hash=createHash('sha256'),partial=destination+'.part';
  const check=new Transform({transform(chunk,_enc,cb){bytes+=chunk.length;if(bytes>maxBytes){cb(Error('Media exceeds download size limit'));return;}if(head.length<12)head=Buffer.concat([head,chunk.subarray(0,12-head.length)]);hash.update(chunk);cb(null,chunk);}});
  try{const f=await open(partial,'wx',0o600);owns=true;await pipeline(Readable.fromWeb(r.body),check,f.createWriteStream());if(bytes<12||head.subarray(4,8).toString()!=='ftyp')throw Error('Downloaded bytes are not an MP4 container');await link(partial,destination);await rm(partial);const result={file:destination,bytes,sha256:hash.digest('hex')};this.emit('DOWNLOAD_SAVED',{...result,file:path.basename(destination)});return result;}catch(e){if(owns)await rm(partial,{force:true});throw e;}
 }
}
