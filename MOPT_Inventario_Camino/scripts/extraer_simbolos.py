"""Extrae los símbolos oficiales del PDF conservado, sin redibujarlos."""
from pathlib import Path
import json
import base64
import io
import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'symbols'
OUT.mkdir(exist_ok=True)
pdf = fitz.open(ROOT / 'dist/templates/DPA-301-original.pdf')
# Ventanas de la tabla de simbología, expresadas en puntos del PDF original.
symbols = [
    ('alcantarilla-existente', 'Alcantarilla existente', (145, 37, 186, 53)),
    ('alcantarilla-nueva', 'Alcantarilla nueva', (158, 83, 198, 92)),
    ('ampliacion-derecho-via', 'Ampliación derecho de vía', (163, 104, 200, 119)),
    ('asfalto', 'Asfalto', (158, 131, 199, 143)),
    ('bacheo', 'Bacheo', (155, 159, 199, 182)),
    ('cabezales', 'Cabezales', (161, 193, 183, 221)),
    ('chapea-mano', 'Chapea a mano', (319, 40, 369, 55)),
    ('conformacion', 'Conformación', (324, 61, 358, 88)),
    ('derrumbe', 'Derrumbe', (314, 94, 351, 120)),
    ('deslizamiento', 'Deslizamiento', (314, 127, 352, 152)),
    ('direccion-agua', 'Dirección del agua', (320, 170, 360, 188)),
    ('gaviones', 'Gaviones', (322, 192, 343, 223)),
    ('limpieza-derecho-via', 'Limpieza derecho de vía', (544, 35, 560, 60)),
    ('poste-electrico', 'Poste eléctrico', (535, 62, 557, 92)),
    ('puente', 'Puente', (544, 96, 560, 118)),
    ('relastrado', 'Relastrado', (527, 133, 568, 151)),
    ('relleno', 'Relleno', (526, 170, 568, 188)),
    ('tomas', 'Tomas', (528, 199, 554, 222)),
]
manifest = []
for symbol_id, label, rect in symbols:
    pix = pdf[1].get_pixmap(matrix=fitz.Matrix(8, 8), clip=fitz.Rect(rect), alpha=True)
    image = Image.frombytes('RGBA', (pix.width, pix.height), pix.samples)
    box = image.getchannel('A').getbbox()
    if not box:
        raise ValueError(f'Símbolo vacío: {label}')
    # Dos píxeles transparentes evitan recortar el antialias de los trazos.
    image = image.crop((max(0, box[0]-2), max(0, box[1]-2), min(image.width, box[2]+2), min(image.height, box[3]+2)))
    # El mismo PNG se incorpora al catálogo; no se crean archivos por figura.
    png = io.BytesIO()
    image.save(png, format='PNG', optimize=True)
    manifest.append({'id': symbol_id, 'label': label, 'width': image.width, 'height': image.height,
                     'pngBase64': base64.b64encode(png.getvalue()).decode('ascii')})
pix = pdf[0].get_pixmap(matrix=fitz.Matrix(6,6), clip=fitz.Rect(91.165,312.646,181.242,753.568), alpha=False)
pix.save(OUT / 'carretera.png')
(ROOT / 'dist/js/symbol-catalog.js').write_text('// Figuras oficiales DPA-301 y sus PNG originales en un solo catálogo.\n// Base64 conserva cada byte del archivo: no redibuja ni comprime la imagen.\nexport const SYMBOLS = Object.freeze('+json.dumps(manifest, ensure_ascii=False, indent=2)+');\n')
print(f'{len(manifest)} símbolos y fondo extraídos de la plantilla original.')
