"""Dibuja el símbolo geométrico de la PWA en los tamaños de instalación."""
from pathlib import Path
from PIL import Image, ImageDraw

destino = Path(__file__).resolve().parents[1] / 'dist' / 'icons'
# Se dibuja a doble tamaño y se reduce para suavizar las líneas diagonales.
imagen = Image.new('RGB', (1024, 1024), '#193e36')
dibujo = ImageDraw.Draw(imagen)
for puntos in [[(190, 110), (125, 402)], [(322, 110), (387, 402)],
               [(256, 110), (256, 167)], [(256, 227), (256, 285)],
               [(256, 345), (256, 402)]]:
    p = [(x * 2, y * 2) for x, y in puntos]
    dibujo.line(p, fill='#d2e8a0', width=44)
    for x, y in p:
        dibujo.ellipse((x - 22, y - 22, x + 22, y + 22), fill='#d2e8a0')
for lado in (192, 512):
    imagen.resize((lado, lado), Image.Resampling.LANCZOS).save(destino / f'icon-{lado}.png')
