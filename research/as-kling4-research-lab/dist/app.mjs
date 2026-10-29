import{validatePayload,estimateCost,buildPrompt,redactMedia}from'./assets/core.mjs';
import{buildCommand}from'./assets/commands.mjs';
import{createImageSelection}from'./assets/input-state.mjs';
const $=id=>document.getElementById(id),s={mode:'form',lang:'curl',data:null,payload:null,rows:[],timer:null,generation:0,template:buildPrompt(10)};$('prompt').value=s.template;
const images=createImageSelection(view=>{
 s.data=view.imageData;$('first-url').value=view.imageData?'':view.uri;
 $('image-preview').hidden=!view.previewSrc;
 if(view.previewSrc)$('image-preview').src=view.previewSrc;else $('image-preview').removeAttribute('src');
 $('upload-empty').hidden=!!view.previewSrc;$('image-meta').textContent=view.caption;$('image-meta').hidden=!view.caption;
});
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3500);}
function save(name,text,type='text/plain;charset=utf-8'){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
function form(){const first=s.data||$('first-url').value.trim(),middle=$('middle-url').value.trim(),last=$('last-url').value.trim(),p={model:'kling_4',promptImage:middle||last?[{uri:first,position:'first'},...(middle?[{uri:middle,position:'middle'}]:[]),...(last?[{uri:last,position:'last'}]:[])]:first,ratio:$('resolution').value,duration:Number($('duration').value)};if($('prompt').value.trim())p.promptText=$('prompt').value;return p;}
function payload(){return validatePayload(s.mode==='json'?JSON.parse($('raw-json').value):form());}
function code(p){return buildCommand(s.lang,p);}
function beat(){const d=Number($('shot-scrub').max)||10,t=Math.min(Number($('shot-scrub').value),d),i=t<d*.2?0:t<d*.7?1:2;$('shot-time').textContent=t.toFixed(1)+' s';$('beat-number').textContent='BEAT 0'+(i+1);$('beat-title').textContent=['ตั้งต้นให้นิ่ง','เคลื่อนไหวอย่างมีเหตุผล','ค้างให้ตัดต่อได้'][i];$('beat-description').textContent=['หายใจเบา ๆ รักษาทิศสายตาและตำแหน่งเริ่มต้น ให้คนดูอ่านตัวละครทัน','ค่อย ๆ มองซ้ายของกล้องแล้วนำสายตากลับ น้ำหนักตัวและสีหน้าต่อเนื่อง ทำเพียงหนึ่งการกระทำ','คงสีหน้า deadpan และท่าจบ ตรวจหน้า มือ เสื้อผ้า และพรอพก่อนนำไปต่อคลิป'][i];}
function update(){
 try{const p=payload(),price=estimateCost(p);s.payload=p;const demo=JSON.stringify(p.promptImage).includes('https://example.com/');$('validation').className='validation '+(demo?'warn':'good');$('validation').textContent=demo?'✓ โครงสร้างผ่าน · ตัวอย่างสำหรับจำลอง ต้องเปลี่ยนภาพก่อนรันจริง':'✓ โครงสร้างผ่าน · มิติภาพและเนื้อหายังต้องผ่านการตรวจของผู้ให้บริการ';$('valid-badge').className='badge good';$('valid-badge').textContent=demo?'DEMO INPUT':'SCHEMA VALID';$('code-view').textContent=code(p);$('summary-duration').textContent=(p.duration??5)+' sec';$('summary-cost').textContent=`${price.credits} ≈ $${price.usd.toFixed(2)}`;$('price-note').textContent=`ประมาณการภาพล้วน · ${price.promotion?'ใช้ส่วนลดถึง 30 พ.ย. 2026 UTC และปัดเครดิตสองครั้ง':'ใช้อัตราปกติ'} · snapshot 29 ต.ค. 2026 อาจเปลี่ยนได้`;$('shot-scrub').max=p.duration??5;$('shot-end').textContent=(p.duration??5)+' s';beat();}
 catch(e){s.payload=null;const empty=s.mode==='form'&&!s.data&&!$('first-url').value.trim();$('validation').className='validation'+(empty?'':' bad');$('validation').textContent=empty?'เพิ่มภาพหรือโหลดตัวอย่างเพื่อเริ่ม':e.message;$('valid-badge').className='badge';$('valid-badge').textContent=empty?'WAITING FOR INPUT':'CHECK INPUT';$('code-view').textContent=empty?'# เตรียมภาพ หรือโหลดตัวอย่างด้านซ้าย\n# จากนั้นบันทึก request.json ก่อนรัน':'# แก้ข้อมูลก่อนสร้างคำสั่ง\n# '+e.message;}
 $('export-request').disabled=!s.payload;$('copy-code').disabled=!s.payload;$('simulate').disabled=!s.payload||s.timer!==null;$('code-filename').textContent={curl:'01_submit.sh',node:'run-once.mjs',json:'request.json'}[s.lang];
}
function mode(m){if(m===s.mode)return;if(m==='json'){images.invalidate();$('raw-json').value=JSON.stringify(form(),null,2);}else{try{const p=payload(),f=typeof p.promptImage==='string'?[{uri:p.promptImage,position:'first'}]:p.promptImage;if(p.references?.length||f.filter(x=>x.position==='middle').length>1){toast('แก้หลายเฟรมหรือภาพอ้างอิงต่อใน JSON เพื่อรักษาข้อมูลครบ');return;}const first=f.find(x=>x.position==='first').uri;images.set(first,first.startsWith('data:')?'ภาพจาก Request JSON':'');$('middle-url').value=f.find(x=>x.position==='middle')?.uri??'';$('last-url').value=f.find(x=>x.position==='last')?.uri??'';$('duration').value=p.duration??5;$('resolution').value=p.ratio??'auto_720p';$('prompt').value=p.promptText??'';}catch{toast('แก้ JSON ให้ผ่านก่อนกลับ Form');return;}}s.mode=m;$('form-panel').hidden=m!=='form';$('json-panel').hidden=m!=='json';$('form-tab').classList.toggle('selected',m==='form');$('json-tab').classList.toggle('selected',m==='json');update();}
$('form-tab').addEventListener('click',()=>mode('form'));$('json-tab').addEventListener('click',()=>mode('json'));
document.querySelectorAll('[data-code]').forEach(b=>b.addEventListener('click',()=>{s.lang=b.dataset.code;document.querySelectorAll('[data-code]').forEach(x=>x.classList.toggle('selected',x===b));update();}));
function clear(){images.clear();$('first-file').value='';update();}
$('clear-image').addEventListener('click',clear);
for(const id of['first-url','middle-url','last-url','resolution','prompt','raw-json'])$(id).addEventListener('input',()=>{if(id==='first-url'){images.set($('first-url').value.trim());$('first-file').value='';}update();});
$('duration').addEventListener('input',()=>{const n=Number($('duration').value);if(Number.isInteger(n)&&n>=3&&n<=30&&$('prompt').value===s.template){s.template=buildPrompt(n);$('prompt').value=s.template;}update();});
$('reset-prompt').addEventListener('click',()=>{try{s.template=buildPrompt(Number($('duration').value));$('prompt').value=s.template;update();toast('ใช้ต้นแบบ AS แล้ว');}catch(e){toast(e.message);}});
async function load(file){
 if(!file)return;
 try{const changed=await images.load(async()=>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('ใช้ PNG/JPG/WebP เท่านั้น');
  if(file.size*4/3+64>5*1024*1024)throw Error('ขนาด data URI เกิน 5 MiB กรุณาย่อภาพหรือใช้ URL');
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('อ่านภาพไม่สำเร็จ'));r.readAsDataURL(file);});
  const img=new Image();img.src=data;await img.decode();const ratio=img.naturalWidth/img.naturalHeight;
  if(Math.min(img.naturalWidth,img.naturalHeight)<300||ratio<.4||ratio>2.5)throw Error('อย่างน้อย 300 px ทุกด้าน และสัดส่วนกว้าง/สูง 0.4–2.5');
  return{uri:data,caption:`${file.name} · ${img.naturalWidth} × ${img.naturalHeight}`};
 });if(changed)update();}catch(e){$('first-file').value='';toast(e.message);}
}
$('first-file').addEventListener('change',e=>load(e.target.files[0]));$('dropzone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('first-file').click();}});
for(const name of['dragenter','dragover'])$('dropzone').addEventListener(name,e=>{e.preventDefault();$('dropzone').classList.add('dragging');});$('dropzone').addEventListener('dragleave',()=>$('dropzone').classList.remove('dragging'));$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('dragging');load(e.dataTransfer.files[0]);});
$('load-example').addEventListener('click',()=>{if(s.timer!==null)stop();s.mode='form';$('form-panel').hidden=false;$('json-panel').hidden=true;$('form-tab').classList.add('selected');$('json-tab').classList.remove('selected');clear();$('first-url').value='https://example.com/replace-with-your-first-frame.jpg';$('middle-url').value='';$('last-url').value='';$('duration').value=10;$('resolution').value='auto_720p';s.template=buildPrompt(10);$('prompt').value=s.template;update();toast('โหลดตัวอย่างสำหรับจำลองแล้ว · เปลี่ยนภาพก่อนรันจริง');});
$('export-request').addEventListener('click',()=>{try{save('request.json',JSON.stringify(payload(),null,2)+'\n','application/json');toast('บันทึก request.json แล้ว');}catch(e){toast(e.message);}});
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(code(payload()));toast('คัดลอกแล้ว');}catch{toast('คัดลอกอัตโนมัติไม่ได้ ให้เลือกข้อความในช่องคำสั่ง');}});
const stages={VALIDATED:0,SUBMIT_STARTED:1,TASK_CREATED:1,RECEIPT_SAVED:1,PENDING:2,THROTTLED:2,RUNNING:2,READ_BACKOFF:2,SUCCEEDED:3,SIMULATION_COMPLETED:3};
function record(event,t,detail){s.rows.push({event,elapsedMs:Math.round(t*1000),mode:'mock',clock:'simulated',detail});if(s.rows.length===1)$('event-log').replaceChildren();const line=document.createElement('div');line.className='event-line';const time=document.createElement('time');time.textContent=t.toFixed(1)+'s';const text=document.createElement('span');text.textContent=event+' · '+detail;line.append(time,text);$('event-log').append(line);$('event-log').scrollTop=$('event-log').scrollHeight;$('observed-state').textContent=event;$('job-clock').textContent=t.toFixed(1).padStart(4,'0')+' s';$('export-log').disabled=false;if(stages[event]!==undefined)document.querySelectorAll('[data-step]').forEach((x,i)=>x.classList.toggle('done',i<=stages[event]));}
function finish(label){s.timer=null;$('observed-state').textContent=label;$('stop-simulation').disabled=true;update();}
function stop(){clearTimeout(s.timer);s.generation++;record('LOCAL_SIMULATION_STOPPED',(s.rows.at(-1)?.elapsedMs??0)/1000,'หยุดเฉพาะการจำลอง ไม่ได้ส่ง DELETE ไป API');finish('หยุดการจำลองแล้ว');}
$('stop-simulation').addEventListener('click',stop);
$('simulate').addEventListener('click',()=>{if(!s.payload)return;const q=[['VALIDATED',0,'ตรวจโครงสร้างและงบ'],['SUBMIT_STARTED',.2,'POST /v1/image_to_video'],['TASK_CREATED',.5,'mock-task / ไม่ใช่งานจริง'],['RECEIPT_SAVED',.6,'เก็บ ID ก่อนรอ'],['PENDING',5.6,'GET /v1/tasks/{id}']],scenario=$('scenario').value;
 if(scenario==='failed')q.push(['RUNNING',10.6,'สถานะที่อ่านพบ'],['FAILED',15.6,'หยุดโดยไม่ส่งซ้ำ']);
 else if(scenario==='timeout')q.push(['THROTTLED',10.6,'ยังรอคิว'],['LOCAL_WAIT_TIMEOUT',15.6,'ID ยังอยู่ งานระยะไกลอาจทำต่อ']);
 else if(scenario==='rate')q.push(['READ_BACKOFF',10.6,'HTTP 429 · สมมติ Retry-After 10s'],['RUNNING',20.6,'อ่าน task เดิมต่อ'],['SUCCEEDED',25.6,'พบ output ในตัวอย่าง'],['SIMULATION_COMPLETED',25.7,'ไม่มีไฟล์วิดีโอจริง']);
 else{if(scenario==='throttled')q.push(['THROTTLED',10.6,'ยังอยู่ในคิว'],['THROTTLED',20.6,'ไม่ใช่การปฏิเสธคำขอ']);q.push(['RUNNING',scenario==='throttled'?30.6:10.6,'ไม่ใช่เวลาเริ่ม inference ที่ยืนยัน'],['SUCCEEDED',scenario==='throttled'?45.6:20.6,'พบ output ในตัวอย่าง'],['SIMULATION_COMPLETED',scenario==='throttled'?45.7:20.7,'ไม่มีไฟล์วิดีโอจริง']);}
 s.rows=[];const generation=++s.generation;let i=0;$('simulate').disabled=true;$('stop-simulation').disabled=false;document.querySelectorAll('[data-step]').forEach(x=>x.classList.remove('done'));
 function next(){if(generation!==s.generation)return;const[event,t,detail]=q[i++];record(event,t,detail);if(i<q.length)s.timer=setTimeout(next,430);else finish(event==='SIMULATION_COMPLETED'?'จำลองสำเร็จ · ไม่มีคลิปจริง':event==='FAILED'?'จำลองงานล้มเหลว · ไม่ส่งซ้ำ':'หมดเวลารอ · task ID ยังอยู่');}s.timer=setTimeout(next,50);
});
$('export-log').addEventListener('click',()=>save('AS_KLING4_SIMULATION.jsonl',s.rows.map(x=>JSON.stringify(redactMedia(x))).join('\n')+'\n','application/x-ndjson'));$('shot-scrub').addEventListener('input',beat);update();
