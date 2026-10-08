#!/usr/bin/env python3
"""GLB (mit Animationen) -> Spritesheet (WebP) -> ins Spiel einbetten.
Aufruf: python3 tools/sprite3d/make.py <datei.glb> <karten-id> [--yaw -70] [--elev 12] [--frames 8] [--cell 256]
Braucht: Playwright + Chromium, three.js-Ordner unter $THREE_DIR (Standard /tmp/claude-0/t3/three.js)."""
import sys,os,json,base64,shutil,subprocess,time,io,argparse,re
from PIL import Image
ap=argparse.ArgumentParser();ap.add_argument('glb');ap.add_argument('id');ap.add_argument('--yaw',type=float,default=-70);ap.add_argument('--elev',type=float,default=12);ap.add_argument('--frames',type=int,default=8);ap.add_argument('--cell',type=int,default=256);ap.add_argument('--game',default='/home/claude/kaltmark-online/public/index.html');ap.add_argument('--preview',default='')
a=ap.parse_args();here=os.path.dirname(os.path.abspath(__file__));three=os.environ.get('THREE_DIR','/tmp/claude-0/t3/three.js')
work='/tmp/claude-0/s3w';shutil.rmtree(work,ignore_errors=True);os.makedirs(work);os.symlink(three,work+'/three.js');shutil.copy(here+'/render.html',work+'/render.html');shutil.copy(a.glb,work+'/m.glb')
srv=subprocess.Popen([sys.executable,'-m','http.server','8833'],cwd=work,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']);pg=b.new_page();pg.goto('http://localhost:8833/render.html');pg.wait_for_timeout(1200)
        res=pg.evaluate("([f,c,y,e])=>renderSheet('/m.glb',f,c,y,e)",[a.frames,a.cell,a.yaw,a.elev]);b.close()
finally:srv.terminate()
im=Image.open(io.BytesIO(base64.b64decode(res['png'].split(',')[1])));buf=io.BytesIO();im.save(buf,'WEBP',quality=88,method=6)
if a.preview:im.save(a.preview)
meta=res['meta'];meta['src']='data:image/webp;base64,'+base64.b64encode(buf.getvalue()).decode()
print('Animationen im Modell:',res['names']);print('Zuordnung:',res['map']);print('Meta:',{k:v for k,v in meta.items() if k!='src'},'WebP',len(buf.getvalue())//1024,'KB')
s=open(a.game,encoding='utf-8').read();m=re.search(r'const SH3=(\{.*?\});/\*',s,re.S);cur=json.loads(m.group(1)) if m and m.group(1).strip()!='{}' else {}
cur[a.id]=meta;s=s[:m.start(1)]+json.dumps(cur,separators=(',',':'))+s[m.end(1):];open(a.game,'w',encoding='utf-8').write(s);print('eingebettet als',a.id)
