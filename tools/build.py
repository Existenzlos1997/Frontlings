#!/usr/bin/env python3
"""Baut die Server-Version: lagert eingebettete Bilder und Töne (data:-URIs) in public/a/ aus.
Aufruf: python3 tools/build.py <quelle> <ziel>   (Quelle: Ordner mit der Einzeldatei index.html)"""
import re,sys,os,base64,hashlib,shutil
src,dst=sys.argv[1],sys.argv[2]
s=open(os.path.join(src,'index.html'),encoding='utf-8').read()
os.makedirs(os.path.join(dst,'a'),exist_ok=True)
EXT={'png':'png','jpeg':'jpg','jpg':'jpg','webp':'webp','gif':'gif','mpeg':'mp3','ogg':'ogg'};n=0;seen={}
def sub(m):
    global n
    mime,b=m.group(1),m.group(2);raw=base64.b64decode(b);h=hashlib.sha1(raw).hexdigest()[:12];fn='a/%s.%s'%(h,EXT.get(mime,'bin'))
    if fn not in seen:
        open(os.path.join(dst,fn),'wb').write(raw);seen[fn]=len(raw);n+=1
    return fn
out=re.sub(r'data:(?:image|audio)/(png|jpeg|jpg|webp|gif|mpeg|ogg);base64,([A-Za-z0-9+/=]+)',sub,s)
open(os.path.join(dst,'index.html'),'w',encoding='utf-8').write(out)
for f in os.listdir(src):
    p=os.path.join(src,f)
    if f!='index.html' and os.path.isfile(p):shutil.copy(p,os.path.join(dst,f))
keep=set(x.split('/')[1] for x in seen)
for f in os.listdir(os.path.join(dst,'a')):
    if f not in keep:os.remove(os.path.join(dst,'a',f))
print('index.html',len(out),'Bytes; Bilder:',n,'Dateien,',sum(seen.values()),'Bytes')
