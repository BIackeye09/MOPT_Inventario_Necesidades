"""Rasteriza el ejemplo con negro, transparencia y borrado parcial."""
import json
import sys
from PIL import Image, ImageDraw, ImageChops

data = json.load(sys.stdin)
width = 2160
height = round(width*data['frame']['height']/data['frame']['width'])
scale = 2
size = (width*scale, height*scale)
alpha = Image.new('L', size, 0)
for stroke in data['sketch']['strokes']:
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    points = [(x*size[0], y*size[1]) for x, y in stroke['points']]
    pen = stroke['size']*size[0]/1000
    if len(points) > 1:
        draw.line(points, fill=255, width=max(1, round(pen)), joint='curve')
    # Los extremos y las uniones redondas coinciden con el lápiz del lienzo web.
    for x, y in points:
        draw.ellipse((x-pen/2, y-pen/2, x+pen/2, y+pen/2), fill=255)
    alpha = (ImageChops.subtract(alpha, mask) if stroke['tool'] == 'eraser'
             else ImageChops.lighter(alpha, mask))
inset = round(2*size[0]/data['frame']['width'])
clip = Image.new('L', size, 0)
ImageDraw.Draw(clip).rectangle((inset, inset, size[0]-inset-1, size[1]-inset-1), fill=255)
alpha = ImageChops.multiply(alpha, clip).resize((width, height), Image.Resampling.LANCZOS)
result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
result.putalpha(alpha)
result.save(sys.stdout.buffer, format='PNG')
