export const API_BASE='https://api.dev.runwayml.com/v1';
export const API_VERSION='2024-11-06';
export const SNAPSHOT_DATE='2026-10-29';
export class ValidationError extends Error{constructor(issues){super(issues.join('; '));this.name='ValidationError';this.issues=issues;}}
/** Deliberately bounded image-only public contract; see docs/SOURCES.json. */
export function validatePayload(p){
 const issues=[];
 if(!p||typeof p!=='object'||Array.isArray(p))throw new ValidationError(['Payload must be an object']);
 for(const k of Object.keys(p))if(!['model','promptImage','promptText','ratio','duration','references'].includes(k))issues.push(`Unsupported field: ${k}`);
 if(p.model!=='kling_4')issues.push('model must be kling_4');
 if(p.duration!==undefined&&(!Number.isInteger(p.duration)||p.duration<3||p.duration>30))issues.push('duration must be a whole number from 3 to 30');
 if(p.ratio!==undefined&&!['auto_720p','auto_1080p'].includes(p.ratio))issues.push('ratio must be auto_720p or auto_1080p');
 if(p.promptText!==undefined&&(typeof p.promptText!=='string'||!p.promptText.trim()||Array.from(p.promptText).length>26000))issues.push('promptText must contain 1–26000 characters; non-English text has a smaller upstream shared budget');
 function uri(s,label){
  if(typeof s!=='string'){issues.push(`${label} must be a media URI`);return;}
  if(s.startsWith('https://')){try{const u=new URL(s);if(!u.hostname||u.username||u.password||s.length<13||s.length>2048)throw Error();}catch{issues.push(`${label} must be a valid HTTPS URL`);}}
  else if(s.startsWith('runway://')){if(s.length<13||s.length>5000)issues.push(`${label} invalid runway URI length`);}
  else if(s.startsWith('data:image/')){if(s.length>5*1024*1024)issues.push(`${label} data URI exceeds 5 MiB`);if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s))issues.push(`${label} invalid or empty base64 image`);}
  else issues.push(`${label} must use HTTPS, runway://, or an image data URI`);
 }
 let frames=0;
 if(typeof p.promptImage==='string'){uri(p.promptImage,'promptImage');frames=1;}
 else if(Array.isArray(p.promptImage)){
  frames=p.promptImage.length;if(frames<1||frames>10)issues.push('promptImage requires 1–10 frames');
  const counts={first:0,middle:0,last:0};
  for(const [i,f]of p.promptImage.entries()){
   if(!f||typeof f!=='object'||Array.isArray(f)){issues.push(`promptImage[${i}] must be an object`);continue;}
   for(const k of Object.keys(f))if(!['uri','position'].includes(k))issues.push(`Unsupported frame field: ${k}`);
   uri(f.uri,`promptImage[${i}].uri`);
   if(!Object.hasOwn(counts,f.position))issues.push('position must be first, middle, or last');else counts[f.position]++;
  }
  if(counts.first!==1)issues.push('Exactly one first frame is required');
  if(counts.middle>8)issues.push('At most 8 middle frames');if(counts.last>1)issues.push('At most one last frame');
 }else issues.push('promptImage is required');
 if(p.references!==undefined){
  if(!Array.isArray(p.references))issues.push('references must be an array');
  else{
   if(p.references.length+frames>10)issues.push('Frames and references together must be at most 10');
   if(p.references.length&&(typeof p.promptText!=='string'||!p.promptText.trim()))issues.push('promptText is required with references');
   for(const [i,r]of p.references.entries()){if(!r||typeof r!=='object'||Array.isArray(r)){issues.push('references entries must be objects');continue;}for(const k of Object.keys(r))if(k!=='uri')issues.push(`Unsupported reference field: ${k}`);uri(r.uri,`references[${i}].uri`);}
  }
 }
 if(issues.length)throw new ValidationError(issues);return structuredClone(p);
}
/** Estimate, not a provider billing cap. Snapshot rates can change. */
export function estimateCost(p,{now=new Date()}={}){
 if(p.referenceVideos?.length||p.videoUri)throw Error('Input video pricing is outside this image-only estimator');
 const duration=p.duration??5,ratio=p.ratio??'auto_720p';
 if(!Number.isInteger(duration)||duration<3||duration>30)throw Error('duration must be 3–30');
 if(!['auto_720p','auto_1080p'].includes(ratio))throw Error('Invalid I2V ratio');
 const date=new Date(now);if(!Number.isFinite(date.getTime()))throw Error('Invalid pricing date');
 const listCredits=Math.ceil(duration*(ratio==='auto_1080p'?235:157)/10);
 const promotion=date>=new Date('2026-10-23T00:00:00Z')&&date<new Date('2026-12-01T00:00:00Z');
 const credits=promotion?Math.ceil(listCredits*.8):listCredits;
 return{credits,usd:credits/100,listCredits,promotion,resolution:ratio==='auto_1080p'?'1080p':'720p',snapshotDate:SNAPSHOT_DATE,promotionEndsExclusive:'2026-12-01T00:00:00Z',estimateOnly:true};
}
export function buildPrompt(d=10){
 if(!Number.isInteger(d)||d<3||d>30)throw Error('duration must be 3–30');
 const a=+(d*.2).toFixed(1),b=+(d*.7).toFixed(1);
 return `REFERENCE LOCK: Use the first frame as the visual reference for the same performer, costume, visible props, position and location. Preserve appearance throughout. These are creative instructions, not technical guarantees.\n\nACTION TIMELINE (approximate timing within a ${d}-second clip):\n0–${a}s: Hold still, with subtle breathing.\n${a}–${b}s: Slowly look slightly to camera-left, then return the gaze. Natural weight and a restrained deadpan expression.\n${b}–${d}s: Hold the final expression for a clean editing handle.\n\nCAMERA: One continuous locked-off shot, same viewpoint and screen direction.\nDIALOGUE: None for this motion-control baseline.\nVOICE / SOUND: Quiet location ambience.\nCONSTRAINTS: Same person and costume. No extra people, text, logo, watermark, cut, orbit, sudden zoom, weapon draw, CG aura or added props. Photoreal live action, modest old Thai film texture and handmade material detail if already present.`;
}
export function redactMedia(v){
 if(Array.isArray(v))return v.map(redactMedia);
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,/authorization|secret|token|api.?key/i.test(k)?'[REDACTED]':redactMedia(x)]));
 if(typeof v==='string'){if(v.startsWith('data:'))return`[DATA URI OMITTED: ${v.length} chars]`;if(v.startsWith('https://')){try{const u=new URL(v);u.search='';u.hash='';return u.href;}catch{return'[URL]';}}}return v;
}
