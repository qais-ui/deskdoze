"""Render verified demo evidence as a captioned video. Not a live screencast.
Development-only dependencies: Pillow and imageio-ffmpeg.
Run after npm run demo -- --offline and saving demo/report.png.
"""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'demo/analysis.json').read_text(encoding='utf-8'))
CHECK = json.loads((ROOT / 'demo/verification.json').read_text(encoding='utf-8'))
W, H, FPS = 1280, 720, 24
BG, INK, GREEN = '#f3f1e9', '#263b30', '#dce7cf'
FONT = Path('C:/Windows/Fonts')
def font(size, bold=False):
    return ImageFont.truetype(str(FONT / ('segoeuib.ttf' if bold else 'segoeui.ttf')), size)
def frame(title, subtitle):
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((64, 30), 'DeskDoze', font=font(24, True), fill=INK)
    d.text((910, 35), 'EXAMPLE FOLDER / 7 NOTES', font=font(16), fill=INK)
    d.line((64, 82, W-64, 82), fill='#cfd5c7', width=2)
    d.text((64, 110), title, font=font(44, True), fill=INK)
    d.text((64, 178), subtitle, font=font(22), fill='#596457')
    d.text((64, 672), 'Recorded local run · Sample notes', font=font(17), fill='#596457')
    return im, d

scenes = []
im, d = frame('A little room to think.', 'Seven loose notes, ready to sort.')
for i, name in enumerate(f['name'] for g in DATA['groups'] for f in g['files']):
    d.text((90, 245+i*48), name, font=font(27), fill=INK)
d.rounded_rectangle((650, 260, 1170, 560), radius=24, fill=GREEN)
d.text((690, 300), 'Start with a preview.', font=font(32,True), fill=INK)
d.text((690, 365), 'Choose one small task.', font=font(23), fill=INK)
d.text((690, 418), 'Tidy up when ready.', font=font(23), fill=INK)
scenes.append((im, 7))

im, d = frame('Related notes, together.', 'Grouped locally with all-MiniLM-L6-v2 and Transformers.js')
for i, g in enumerate(DATA['groups']):
    y = 242+i*94
    d.rounded_rectangle((64,y,1216,y+78),radius=12,fill='#fffef8')
    d.text((88,y+10), g['title'],font=font(24,True),fill=INK)
    d.text((88,y+43), ' + '.join(f['name'] for f in g['files']),font=font(19),fill='#596457')
scenes.append((im, 8))

im, d = frame('A next step you already wrote.', 'Each task points back to its file and line number.')
for i,g in enumerate(DATA['groups'][:3]):
    a=g['nextStep']; y=248+i*126
    d.rounded_rectangle((64,y,1216,y+105),radius=14,fill=GREEN)
    import re
    task=re.sub(r'^\s*(?:[-*]\s*\[ \]\s*|(?:TODO|NEXT)\s*:\s*)','',a['quote'],flags=re.I)
    d.text((88,y+12),task,font=font(30),fill=INK)
    d.text((88,y+62),f"{a['source']} : line {a['line']}",font=font(21),fill='#596457')
scenes.append((im, 8))

im, d = frame('Review the report before any move.', 'Each group explains its similarity and shows the source excerpt.')
if (ROOT/'demo/report.png').exists():
    shot=Image.open(ROOT/'demo/report.png').convert('RGB')
    # Show the genuine report capture at readable scale, cropped to the first cards.
    shot.thumbnail((1152,1500))
    crop=shot.crop((0,min(350,shot.height//4),min(1152,shot.width),min(350,shot.height//4)+405))
    im.paste(crop,(64,235))
scenes.append((im, 7))

im, d = frame('Apply. Verify. Undo.', 'The demo script checks file contents against the original bytes.')
lines=[f"Notes analyzed: {CHECK['notes']}", f"Groups proposed: {len(CHECK['groups'])}",
       f"Moves applied: {CHECK['moves']}",
       f"Content preserved: {CHECK['contentPreserved']}",
       f"Undo restored all files: {CHECK['undoRestoredAll']}",
       f"Unsupported file untouched: {CHECK['unsupportedFileUntouched']}",
       f"Offline mode: {CHECK['offline']}  |  Analysis: {CHECK['elapsedMs']} ms"]
for i,line in enumerate(lines): d.text((86,245+i*49),line,font=font(26),fill=INK)
scenes.append((im, 8))

im, d = frame('Try it at your own pace.', 'Node.js 20+ · MIT project · Open model downloaded on first run')
for i,line in enumerate(['npm ci', 'npm run demo', 'npm run demo -- --offline', 'Open demo/report.html']):
    d.text((90,255+i*74),line,font=font(32,True),fill=INK)
d.text((90,575),'A small tool for text and Markdown notes.',font=font(21),fill='#596457')
scenes.append((im, 7))

out=ROOT/'demo/deskdoze-demo.mp4'
proc=subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-vcodec','rawvideo','-s',f'{W}x{H}','-pix_fmt','rgb24','-r',str(FPS),'-i','-','-an','-vcodec','libx264','-pix_fmt','yuv420p','-crf','21','-movflags','+faststart',str(out)],stdin=subprocess.PIPE,stderr=subprocess.PIPE)
for image,seconds in scenes:
    raw=image.tobytes()
    for _ in range(seconds*FPS): proc.stdin.write(raw)
proc.stdin.close()
errors=proc.stderr.read().decode(errors='replace')
if proc.wait(): raise RuntimeError(errors)
scenes[0][0].save(ROOT/'demo/video-poster.png')
print(f'Created {out.name}: {sum(s for _,s in scenes)} seconds, {out.stat().st_size} bytes')
