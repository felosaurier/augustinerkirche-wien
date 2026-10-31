#!/usr/bin/env python3
"""Kleine Bildfassungen fuers Handy erzeugen.

Zu jedem grossen Bild unter assets/img/ (WebP, breiter als 1100 Pixel) entsteht "<name>-m.webp"
(900 Pixel breit). Die Liste der Bilder, zu denen es eine kleine Fassung gibt, steht in
data/bilder-klein.json; die Seiten (js/thema.js, AugBild) nehmen auf schmalen Bildschirmen
die kleine Fassung. Neue Bilder, die in der Verwaltung hochgeladen werden, bekommen ihre
kleine Fassung dort gleich mit; dieses Skript holt nur Bilder nach, die schon da waren.

Aufruf im Ordner der Website (dort, wo assets/ und data/ liegen; braucht Pillow: pip install pillow):
  python tools/bilder-klein.py             fehlende kleine Fassungen erzeugen
  python tools/bilder-klein.py --zeigen    nur zeigen, was passieren wuerde
Auf dem Server (dort liegen die Bilder der Verwaltung) vom Ordner der Website aus:
  python3 tools/bilder-klein.py   (oder das Skript hierher kopieren)
"""
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow fehlt: pip install pillow')

ROOT = Path(__file__).resolve().parent.parent
if not (ROOT / 'assets').is_dir() and (Path.cwd() / 'assets').is_dir():
    ROOT = Path.cwd()
LISTE = ROOT / 'data' / 'bilder-klein.json'
BREITE = 900
AB = 1100          # nur Bilder, die breiter sind
QUALITAET = 78


def main():
    nur_zeigen = '--zeigen' in sys.argv
    bilder = set()
    vorher = nachher = 0
    erzeugt = 0
    for p in sorted((ROOT / 'assets' / 'img').rglob('*.webp')):
        if p.stem.endswith('-m'):
            continue
        klein = p.with_name(p.stem + '-m.webp')
        rel = p.relative_to(ROOT).as_posix()
        if klein.exists() and klein.stat().st_mtime >= p.stat().st_mtime:
            bilder.add(rel)
            continue
        with Image.open(p) as im:
            w, h = im.size
            if w <= AB:
                continue
            if nur_zeigen:
                print('wuerde erzeugen:', rel, f'({w}x{h})')
                continue
            kl = im.convert('RGBA' if 'A' in im.getbands() else 'RGB').resize((BREITE, round(h * BREITE / w)), Image.LANCZOS)
            kl.save(klein, 'WEBP', quality=QUALITAET, method=6)
        gross, kleingroesse = p.stat().st_size, klein.stat().st_size
        if kleingroesse >= gross * 0.85:     # lohnt sich nicht
            klein.unlink()
            continue
        vorher += gross
        nachher += kleingroesse
        erzeugt += 1
        bilder.add(rel)
    if nur_zeigen:
        return
    LISTE.parent.mkdir(exist_ok=True)
    LISTE.write_text(json.dumps({'breite': BREITE, 'bilder': sorted(bilder)}, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    print(f'{erzeugt} neue kleine Fassungen, insgesamt {len(bilder)} in {LISTE.relative_to(ROOT)}')
    if erzeugt:
        print(f'Neu: {vorher // 1024} KB -> {nachher // 1024} KB ({100 - nachher * 100 // max(vorher, 1)} % kleiner)')


if __name__ == '__main__':
    main()
