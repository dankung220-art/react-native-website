import{createHash,randomBytes}from'node:crypto';import{createReadStream}from'node:fs';import{readFile,writeFile,rename,mkdir,stat}from'node:fs/promises';import path from'node:path';
async function digest(file){const h=createHash('sha256');let bytes=0;for await(const chunk of createReadStream(file)){bytes+=chunk.length;h.update(chunk);}return{bytes,sha256:h.digest('hex')};}
async function saveCheckpoint(file,value){const tmp=file+'.'+randomBytes(4).toString('hex')+'.part';await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(tmp,file);}
/** Resume only files tied to this task/index and independently re-hashed. */
export async function downloadTaskOutputs(client,task,out){
 if(task.status!=='SUCCEEDED'||!Array.isArray(task.output)||!task.output.length)throw Error('No successful task output');
 await mkdir(out,{recursive:true});const checkpointPath=path.join(out,'outputs.json');let checkpoint={version:1,taskId:task.id,outputCount:task.output.length,files:[]};
 try{checkpoint=JSON.parse(await readFile(checkpointPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(checkpoint.version!==1||checkpoint.taskId!==task.id||checkpoint.outputCount!==task.output.length||!Array.isArray(checkpoint.files))throw Error('Output checkpoint does not match this task');
 const result=[];
 for(let i=0;i<task.output.length;i++){
  const name=i===0?'clip.mp4':`clip-${i+1}.mp4`,destination=path.join(out,name),entry=checkpoint.files.find(x=>x.index===i);
  if(entry){
   if(entry.file!==name||!Number.isInteger(entry.bytes)||entry.bytes<=0||!/^[0-9a-f]{64}$/.test(entry.sha256))throw Error('Invalid output checkpoint record');
   let actual;try{if(!(await stat(destination)).isFile())throw Error();actual=await digest(destination);}catch{throw Error('Output checkpoint file is missing or unreadable; choose a new directory');}
   if(actual.bytes!==entry.bytes||actual.sha256!==entry.sha256)throw Error('Existing output fails checkpoint hash validation; choose a new directory');
   client.emit('OUTPUT_REUSED',{taskId:task.id,index:i,file:name,bytes:actual.bytes,sha256:actual.sha256});result.push({file:destination,...actual,reused:true});continue;
  }
  const saved=await client.download(task.output[i],destination);
  checkpoint.files.push({index:i,file:name,bytes:saved.bytes,sha256:saved.sha256});await saveCheckpoint(checkpointPath,checkpoint);result.push(saved);
 }
 return result;
}
