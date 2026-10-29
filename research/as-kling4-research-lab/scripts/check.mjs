import{readFileSync,readdirSync,copyFileSync,existsSync}from'node:fs';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';import path from'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const dir of['src','dist','scripts','tests'])for(const f of readdirSync(path.join(root,dir)))if(f.endsWith('.mjs'))execFileSync(process.execPath,['--check',path.join(root,dir,f)],{stdio:'pipe'});
execFileSync('bash',['-n',path.join(root,'scripts/run-curl.sh')],{stdio:'pipe'});
copyFileSync(path.join(root,'src/core.mjs'),path.join(root,'dist/assets/core.mjs'));
for(const name of['commands.mjs','input-state.mjs'])copyFileSync(path.join(root,'src',name),path.join(root,'dist/assets',name));
for(const f of['README.md','docs/RESEARCH_TIMELINE_TH.md','docs/SOURCES.json','docs/AGENT_HANDOFF_TH.md','examples/scorecard.csv']){if(!existsSync(path.join(root,f)))throw Error('Missing deliverable: '+f);copyFileSync(path.join(root,f),path.join(root,'dist/downloads',path.basename(f)));}
for(const f of['examples/request.first.json','examples/request.keyframes.json','examples/request.references.json'])JSON.parse(readFileSync(path.join(root,f),'utf8'));
console.log('JavaScript/Bash syntax, examples, shared module and research deliverables verified. Browser QA remains unverified.');
