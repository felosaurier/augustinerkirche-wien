#!/usr/bin/env python3
"""Nicht mehr verwendete Dateien und leere Ordner finden (und auf Wunsch loeschen).

Durchsucht assets/img, assets/audio, assets/video, assets/pdf und assets/programme. Eine Datei gilt als
verwendet, wenn ihr Pfad in einer Datendatei (data/, auch Unterordner), einer Seite (*.html), im CSS, in
einem Skript (js/) oder im App-Manifest vorkommt. Kleine Fassungen (<name>-m.webp, <name>-v.webp) gelten
als verwendet, solange ihr Bild verwendet wird oder sie selbst irgendwo stehen (z. B. als "vorschau").
Nicht geprueft werden data/bildnachweise.json und data/bilder-klein.json (sie nennen alles).

Aufruf im Ordner der Website:
  python tools/aufraeumen.py              zeigen, was nicht mehr verwendet wird
  python tools/aufraeumen.py --loeschen   diese Dateien und leere Ordner loeschen; dazu ihre Eintraege
                                          in data/bildnachweise.json und data/bilder-klein.json
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if not (ROOT / 'assets').is_dir() and (Path.cwd() / 'assets').is_dir():
    ROOT = Path.cwd()
ORDNER = ['assets/img', 'assets/audio', 'assets/video', 'assets/pdf', 'assets/programme']
SKIP = {'data/bildnachweise.json', 'data/bilder-klein.json'}


def texte():
    teile = []
    quellen = list((ROOT / 'data').rglob('*.json')) + list((ROOT / 'data').rglob('*.csv'))
    quellen += list(ROOT.glob('*.html')) + list((ROOT / 'pages').rglob('*.html')) + [q for l in ('en', 'it', 'fr', 'es') for q in (ROOT / l).rglob('*.html')] + list((ROOT / 'admin').glob('*.html'))
    quellen += list((ROOT / 'css').glob('*.css')) + list((ROOT / 'js').rglob('*.js')) + list(ROOT.glob('*.webmanifest')) + [ROOT / 'sw.js']
    for p in quellen:
        if p.is_file() and p.relative_to(ROOT).as_posix() not in SKIP:
            teile.append(p.read_text(encoding='utf-8', errors='ignore'))
    return '\n'.join(teile)


def basis(rel):
    return re.sub(r'-[mv]\.webp$', '.webp', rel)


def schreiben(p, daten):
    tmp = p.with_name(p.name + '.tmp')
    tmp.write_text(json.dumps(daten, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    os.replace(tmp, p)


def main():
    loeschen = '--loeschen' in sys.argv
    t = texte()
    reste = []
    for o in ORDNER:
        for p in sorted((ROOT / o).rglob('*')) if (ROOT / o).is_dir() else []:
            if not p.is_file():
                continue
            rel = p.relative_to(ROOT).as_posix()
            kurz = rel[len('assets/'):]
            if rel in t or kurz in t:
                continue
            b = basis(rel)
            if b != rel and (b in t or b[len('assets/'):] in t):
                continue
            reste.append(p)
    leer = [d for o in ORDNER if (ROOT / o).is_dir() for d in sorted((ROOT / o).rglob('*'), reverse=True)
            if d.is_dir() and not any(x for x in d.rglob('*') if x.is_file() and x not in reste)]
    if not reste and not leer:
        print('Nichts zu tun: alle Dateien werden verwendet, keine leeren Ordner.')
        return
    groesse = sum(p.stat().st_size for p in reste)
    for p in reste:
        print(f'  {"- " if loeschen else ""}{p.relative_to(ROOT).as_posix()}  ({p.stat().st_size // 1024} KB)')
    for d in leer:
        print(f'  {"- " if loeschen else ""}{d.relative_to(ROOT).as_posix()}/  (Ordner wird leer)')
    print(f'{len(reste)} Datei(en), {groesse // 1024} KB; {len(leer)} Ordner.')
    if not loeschen:
        print('Loeschen mit: python tools/aufraeumen.py --loeschen')
        return
    weg = {p.relative_to(ROOT).as_posix() for p in reste}
    for p in reste:
        p.unlink()
    for d in leer:
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()
    for name, key in (('bildnachweise.json', 'bilder'), ('bilder-klein.json', 'bilder')):
        f = ROOT / 'data' / name
        if not f.exists():
            continue
        d = json.loads(f.read_text(encoding='utf-8'))
        v = d.get(key)
        if isinstance(v, dict):
            neu = {k: x for k, x in v.items() if k not in weg}
        else:
            neu = [x for x in (v or []) if x not in weg and (ROOT / x).exists()]
        if len(neu) != len(v or []):
            d[key] = neu
            schreiben(f, d)
    print('Geloescht.')


if __name__ == '__main__':
    main()
