# TripoSR ohne torchmcubes (lässt sich auf dem Bau-Rechner nicht kompilieren): PyMCubes verwenden
import re
p='TripoSR/tsr/models/isosurface.py';s=open(p).read()
s=s.replace('from torchmcubes import marching_cubes','import mcubes\nimport numpy as _np\ndef marching_cubes(vol, thr):\n    v,f=mcubes.marching_cubes(vol.detach().cpu().numpy(), thr)\n    return torch.from_numpy(v.astype(_np.float32)), torch.from_numpy(f.astype(_np.int64))')
open(p,'w').write(s);print('TripoSR gepatcht')
