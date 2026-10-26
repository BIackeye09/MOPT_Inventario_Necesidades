#!/usr/bin/env python3
"""Corrige únicamente las tres curvas alteradas por la conversión del DPA-301.

Las referencias son el XLS original y las capturas de Excel proporcionadas.
Conserva texto, fuentes, bordes, pesos de línea, tablas y tamaño de página.
Uso de desarrollo: python scripts/corregir_pdf_base.py entrada.pdf salida.pdf
No se ejecuta en la laptop: la PWA incluye el PDF ya preparado.
"""
from pathlib import Path
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (BooleanObject, ContentStream, DictionaryObject,
                           FloatObject, NameObject)


def near(a, b):
    return abs(float(a) - b) < 0.02


def repair(source, destination):
    reader = PdfReader(source)
    if len(reader.pages) != 2:
        raise ValueError('Se esperaba el frente y reverso del DPA-301.')
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    fixed = [0, 0]
    for index, page in enumerate(writer.pages):
        content = ContentStream(page['/Contents'], writer)
        operations = content.operations
        if index == 0:
            for i, (args, operator) in enumerate(operations):
                if operator == b'm' and near(args[0], 379.159) and near(args[1], 537.087):
                    # OfficeArt 7245 guarda x=42252 y x=40359 en enteros de 16 bits.
                    # El conversor los interpretó con signo. Se recupera su valor
                    # original sin tocar los otros puntos de las curvas Bézier.
                    following = operations[i + 1]
                    ending = operations[i + 2]
                    if following[1] != b'c' or ending[1] != b'c':
                        raise ValueError('La curva de sección típica no coincide con el original.')
                    scale = (float(following[0][4]) - float(ending[0][4])) / 21012
                    correction = 65536 * scale
                    args[0] = FloatObject(float(args[0]) + correction)
                    following[0][0] = FloatObject(float(following[0][0]) + correction)
                    fixed[0] += 1
        else:
            starts = []
            for i, (args, operator) in enumerate(operations):
                if operator == b'm' and ((near(args[0],160.638) and near(args[1],731.775)) or
                                         (near(args[0],171.124) and near(args[1],762.565))):
                    starts.append(i)
            if len(starts) != 2:
                raise ValueError('Las curvas de alcantarilla no coinciden con el original.')
            # El ancla del grupo OfficeArt 8294 ya es horizontal. El conversor
            # intercambió sus dimensiones al aplicar otra vez el giro del grupo.
            # Se restaura el ancla, manteniendo cada punto de sus dos trazados.
            bounds = (160.638, 729.819, 171.124, 764.555)
            x0, y0, x1, y1 = bounds
            cx, cy = (x0+x1)/2, (y0+y1)/2
            sx, sy = (y1-y0)/(x1-x0), (x1-x0)/(y1-y0)
            for start in starts:
                i = start
                while operations[i][1] in (b'm', b'c', b'l'):
                    args, _ = operations[i]
                    for p in range(0, len(args), 2):
                        args[p] = FloatObject(cx + (float(args[p])-cx)*sx)
                        args[p+1] = FloatObject(cy + (float(args[p+1])-cy)*sy)
                    i += 1
                fixed[1] += 1

        # El ajuste de trazos evita perder líneas al convertir vectores en puntos
        # del dispositivo. No cambia la anchura guardada ni mueve los bordes.
        resources = page['/Resources'].get_object()
        graphics = resources.get('/ExtGState')
        if graphics is None:
            graphics = DictionaryObject()
            resources[NameObject('/ExtGState')] = graphics
        else:
            graphics = graphics.get_object()
        graphics[NameObject('/MOPTPrintLines')] = DictionaryObject({
            NameObject('/Type'): NameObject('/ExtGState'),
            NameObject('/SA'): BooleanObject(True),
        })
        operations.insert(0, ([NameObject('/MOPTPrintLines')], b'gs'))
        page.replace_contents(content)

    if fixed != [1, 2]:
        raise ValueError(f'No se corrigieron exactamente las tres curvas previstas: {fixed}')
    # Se propone el tamaño físico original al visor PDF; no se reduce a una captura.
    writer._root_object[NameObject('/ViewerPreferences')] = DictionaryObject({
        NameObject('/PrintScaling'): NameObject('/None'),
        NameObject('/PickTrayByPDFSize'): BooleanObject(True),
    })
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('wb') as file:
        writer.write(file)
    print('Tres curvas corregidas; bordes y anchos originales conservados; ajuste de impresión activado.')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Uso: corregir_pdf_base.py entrada.pdf salida.pdf')
    repair(sys.argv[1], sys.argv[2])
