#!/usr/bin/env python3
"""Deterministic source ZIP with per-file hashes; no credentials or run data."""
from pathlib import Path
import hashlib,zipfile
root=Path(__file__).resolve().parents[1]
target=root/'dist/downloads/AS_KLING4_RESEARCH_FULL_SOURCE.zip'
dirs={'src','tests','examples','scripts','docs','dist'}
rootnames={'.gitignore','.env.example','package.json','package-lock.json','README.md','LICENSE'}
entries=[]
for f in sorted(root.rglob('*')):
 if not f.is_file() or f.is_symlink(): continue
 r=f.relative_to(root);name=r.as_posix()
 if f==target or any(p in ('.git','node_modules','runs','__pycache__','.superpowers') for p in r.parts): continue
 if f.name.endswith(('.part','.tar.gz','.pyc')): continue
 if r.parts[0] not in dirs and name not in rootnames and name!='.openai/hosting.json': continue
 if f.name.startswith('.env') and f.name!='.env.example': continue
 entries.append((name,f.read_bytes()))
sums=''.join(f'{hashlib.sha256(data).hexdigest()}  {name}\n' for name,data in entries)
(root/'SHA256SUMS').write_text(sums,encoding='utf-8');entries.append(('SHA256SUMS',sums.encode()))
target.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,data in entries:
  i=zipfile.ZipInfo('AS_KLING4_RESEARCH_LAB/'+name,(2026,10,29,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16;z.writestr(i,data)
with zipfile.ZipFile(target) as z:
 if z.testzip(): raise RuntimeError('Archive CRC validation failed')
print(f'{target}\n{len(entries)} files; {target.stat().st_size} bytes; SHA256 {hashlib.sha256(target.read_bytes()).hexdigest()}')
