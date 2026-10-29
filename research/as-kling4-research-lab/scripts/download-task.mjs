import{readFileSync,writeFileSync}from'node:fs';import path from'node:path';import{RunwayClient}from'../src/client.mjs';
import{downloadTaskOutputs}from'../src/outputs.mjs';
const[file,out]=process.argv.slice(2);if(!file||!out)throw Error('Usage: download-task.mjs STATUS_JSON OUTPUT_DIRECTORY');
const task=JSON.parse(readFileSync(file,'utf8'));if(task.status!=='SUCCEEDED'||!Array.isArray(task.output)||!task.output.length)throw Error('No successful task output');
const client=new RunwayClient({apiKey:process.env.RUNWAYML_API_SECRET,onEvent:e=>console.log(JSON.stringify(e))});
const files=await downloadTaskOutputs(client,task,out);
writeFileSync(path.join(out,'result.json'),JSON.stringify({mode:'live',taskId:task.id,files},null,2)+'\n',{mode:0o600});
console.log('Output files saved. Inspect streams with ffprobe before production use.');
