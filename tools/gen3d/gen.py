# Erzeugt 3D-Modelle (GLB) aus unseren Monsterbildern.
# 1. Versuch: TRELLIS (Microsoft) über den öffentlichen Hugging-Face-Space.
# 2. Rückfall: TripoSR (Stability AI) direkt auf der CPU des Bau-Rechners.
import os, sys, json, shutil, subprocess, time, traceback, urllib.request
from PIL import Image
BASE = 'https://frontlings.geldbeutel1997.workers.dev/a/'
ids = [x for x in os.environ.get('IDS', 'wolf').split(',') if x]
immap = json.load(open('tools/gen3d/immap.json'))
os.makedirs('out3d', exist_ok=True); os.makedirs('in3d', exist_ok=True)
log = open('out3d/log.txt', 'a')
def say(*a):
    s = ' '.join(str(x) for x in a); print(s, flush=True); log.write(s + '\n'); log.flush()
def fetch(i):
    p = f'in3d/{i}.png'
    if not os.path.exists(p):
        raw = f'in3d/{i}.webp'; rq = urllib.request.Request(BASE + immap[i], headers={'User-Agent': 'Mozilla/5.0 Fortlings-3D'}); open(raw, 'wb').write(urllib.request.urlopen(rq, timeout=60).read())
        im = Image.open(raw).convert('RGBA'); w, h = im.size; s = max(w, h)
        c = Image.new('RGBA', (s, s), (0, 0, 0, 0)); c.paste(im, ((s - w) // 2, (s - h) // 2)); c = c.resize((512, 512), Image.LANCZOS); c.save(p)
    return p
def trellis(i, png):
    from gradio_client import Client, handle_file
    tok = os.environ.get('HF_TOKEN') or None
    sp = os.environ.get('TRELLIS_SPACE', 'trellis-community/TRELLIS')
    c = Client(sp, token=tok) if tok else Client(sp)
    try: c.predict(api_name='/start_session')
    except Exception as e: say('start_session', e)
    pre = c.predict(image=handle_file(png), api_name='/preprocess_image')
    r = c.predict(image=handle_file(pre), multiimages=[], seed=7, ss_guidance_strength=7.5, ss_sampling_steps=12, slat_guidance_strength=3, slat_sampling_steps=12, multiimage_algo='stochastic', mesh_simplify=0.95, texture_size=1024, api_name='/generate_and_extract_glb')
    glb = r[2] if isinstance(r, (list, tuple)) else r
    if isinstance(glb, dict): glb = glb.get('value') or glb.get('path')
    shutil.copy(glb, f'out3d/{i}.glb'); return True
def triposr(i, png):
    if not os.path.isdir('TripoSR'): return False
    rgb = f'in3d/{i}_rgb.png'; im = Image.open(png); bg = Image.new('RGBA', im.size, (127, 127, 127, 255)); bg.alpha_composite(im); bg.convert('RGB').save(rgb)
    d = f'tsr_{i}'; subprocess.run([sys.executable, 'TripoSR/run.py', rgb, '--output-dir', d, '--model-save-format', 'glb', '--device', 'cpu', '--mc-resolution', '256', '--foreground-ratio', '0.85', '--no-remove-bg'], check=True)
    shutil.copy(f'{d}/0/mesh.glb', f'out3d/{i}_tsr.glb'); return True
mode = os.environ.get('MODE', 'trellis')
say('Start', mode, ids)
for i in ids:
    if i not in immap: say('unbekannt', i); continue
    if os.path.exists(f'out3d/{i}.glb'): continue
    try: png = fetch(i)
    except Exception as e: say('Bild laden fehlgeschlagen', i, repr(e)[:200]); continue
    t0 = time.time()
    if mode in ('trellis', 'both'):
        try:
            trellis(i, png); say('TRELLIS ok', i, round(time.time() - t0), 's'); continue
        except Exception as e:
            say('TRELLIS fehlgeschlagen', i, repr(e)[:300])
    if mode in ('tsr', 'both', 'trellis'):
        try:
            triposr(i, png) and say('TripoSR ok', i, round(time.time() - t0), 's')
        except Exception as e:
            say('TripoSR fehlgeschlagen', i, repr(e)[:300]); traceback.print_exc()
