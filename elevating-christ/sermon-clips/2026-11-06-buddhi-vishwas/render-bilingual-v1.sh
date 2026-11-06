set -euo pipefail
dir=elevating-christ/sermon-clips/2026-11-06-buddhi-vishwas
python3 - <<'PY'
from PIL import Image, ImageDraw, ImageFont
im=Image.new('RGBA',(1080,560),(250,239,222,255))
d=ImageDraw.Draw(im)
for y in range(80):
 t=y/79
 d.line((0,y,1080,y),fill=(250,239,222,round(255*t*t*(3-2*t))))
font=ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',26)
text='@ElevatingCHRIST'
d.text(((1080-d.textlength(text,font=font))/2,445),text,font=font,fill=(89,94,104,255))
im.save('/tmp/bilingual-panel.png')
PY
ffmpeg -v error -i "$dir/reel.mp4" -loop 1 -i /tmp/bilingual-panel.png -filter_complex "[0:v][1:v]overlay=0:1360:shortest=1,ass=$dir/subtitles-bilingual-v1.ass[v]" -map "[v]" -map 0:a:0 -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a copy -movflags +faststart -shortest "$dir/reel-bilingual-v1.mp4"
ffmpeg -v error -xerror -i "$dir/reel-bilingual-v1.mp4" -f null -
ffmpeg -v error -i "$dir/reel.mp4" -map 0:a:0 -c:a copy -f hash -hash md5 /tmp/source-audio.md5
ffmpeg -v error -i "$dir/reel-bilingual-v1.mp4" -map 0:a:0 -c:a copy -f hash -hash md5 /tmp/output-audio.md5
diff /tmp/source-audio.md5 /tmp/output-audio.md5
echo FULL_DECODE_AND_IDENTICAL_AUDIO_PASSED
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of json "$dir/reel-bilingual-v1.mp4"
ffmpeg -v error -i "$dir/reel-bilingual-v1.mp4" -vf "select='eq(n,60)+eq(n,300)+eq(n,570)',scale=360:-1,tile=3x1" -frames:v 1 -q:v 2 /tmp/bilingual-preview.jpg
echo BILINGUAL_PREVIEW_BEGIN
base64 -w0 /tmp/bilingual-preview.jpg
echo
echo BILINGUAL_PREVIEW_END
git config user.name media-bot
git config user.email media-bot@users.noreply.github.com
git add "$dir/reel-bilingual-v1.mp4"
git commit -m "Render proofread Hindi and English sermon subtitles"
git push
