import sys,subprocess
from playwright.sync_api import sync_playwright
mode,dur,out,stills=sys.argv[1],float(sys.argv[2]),sys.argv[3],sys.argv[4:]
fps=30;n=int(dur*fps)
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1920,'height':1080})
    pg.goto(f'file:///tmp/claude-0/-home-claude/97cef445-46e9-5ae7-96de-83c05c0c70e0/scratchpad/ecio/f/scene.html#{mode}')
    pg.wait_for_function('window.wmReady===true',timeout=20000); pg.wait_for_timeout(300)
    if stills:
        for s in stills:
            pg.evaluate(f'renderAt({s})'); pg.screenshot(path=f'{out}-{s}.jpg',type='jpeg',quality=85)
        sys.exit()
    ff=subprocess.Popen(['ffmpeg','-v','error','-y','-f','image2pipe','-framerate',str(fps),'-i','-','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p',out],stdin=subprocess.PIPE)
    for i in range(n):
        pg.evaluate(f'renderAt({i/fps})'); ff.stdin.write(pg.screenshot(type='png'))
    ff.stdin.close(); ff.wait(); b.close()
