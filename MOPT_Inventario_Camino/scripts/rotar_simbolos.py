"""Prepara los PNG de los ejemplos con las mismas medidas del lienzo web."""
import io
import json
import math
import sys
from PIL import Image

item = json.loads(sys.argv[1])
image = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert('RGBA')
w, h = item['width'], item['height']
angle = math.radians(item['rotation'])
c, s = math.cos(angle), math.sin(angle)
bw, bh = abs(c)*w + abs(s)*h, abs(c)*h + abs(s)*w
density = min(16, 2048/max(bw, bh), max(image.width/w, image.height/h))
pw, ph = max(1, math.ceil(bw*density-1e-8)), max(1, math.ceil(bh*density-1e-8))
sx, sy = pw/bw, ph/bh
# Mapeo inverso del lienzo girado a los píxeles de la figura original.
a, b = c/sx*image.width/w, s/sy*image.width/w
d, e = -s/sx*image.height/h, c/sy*image.height/h
offset_x = image.width/2 - a*pw/2 - b*ph/2
offset_y = image.height/2 - d*pw/2 - e*ph/2
result = image.transform((pw, ph), Image.Transform.AFFINE,
                         (a, b, offset_x, d, e, offset_y),
                         resample=Image.Resampling.BICUBIC)
result.save(sys.stdout.buffer, format='PNG')
