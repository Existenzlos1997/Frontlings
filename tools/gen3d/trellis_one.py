# Ein Bild -> GLB über den TRELLIS-Space (eigene Python-Umgebung mit aktuellem gradio_client)
import sys, os, shutil
from gradio_client import Client, handle_file
png, out = sys.argv[1], sys.argv[2]
tok = os.environ.get('HF_TOKEN') or None
sp = os.environ.get('TRELLIS_SPACE', 'trellis-community/TRELLIS')
c = Client(sp, token=tok) if tok else Client(sp)
try: c.predict(api_name='/start_session')
except Exception as e: print('start_session', e)
pre = c.predict(image=handle_file(png), api_name='/preprocess_image')
r = c.predict(image=handle_file(pre), multiimages=[], is_multiimage=False, seed=7, ss_guidance_strength=7.5, ss_sampling_steps=12, slat_guidance_strength=3, slat_sampling_steps=12, multiimage_algo='stochastic', mesh_simplify=0.95, texture_size=1024, api_name='/generate_and_extract_glb')
glb = r[2] if isinstance(r, (list, tuple)) else r
if isinstance(glb, dict): glb = glb.get('value') or glb.get('path')
shutil.copy(glb, out); print('ok', out)
