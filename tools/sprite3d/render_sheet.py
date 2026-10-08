from playwright.sync_api import sync_playwright
import base64
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']);pg=b.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
    pg.goto('http://localhost:8822/r/render.html');pg.wait_for_timeout(1500)
    res=pg.evaluate("renderSheet('/three.js/examples/models/gltf/RobotExpressive/RobotExpressive.glb',['Idle','Walking','Punch','Death'],8,192)")
    open('/tmp/claude-0/robot_sheet.png','wb').write(base64.b64decode(res['png'].split(',')[1]));print(res['names'],errs[:3]);b.close()
