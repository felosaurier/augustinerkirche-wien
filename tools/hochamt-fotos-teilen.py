#!/usr/bin/env python3
"""Fotos der Hochaemter in die geteilte Ablage uebernehmen (einmalig, verlustfrei).

Vorher: eine grosse Datei data/hochamt-fotos.json  {"bilder": {"<Kennung>": [ {bild, alt, breite, hoehe}, … ]}}
Nachher:
  data/hochamt-fotos/index.json      schlanke Uebersicht fuer Listen:
      {"hochaemter": {"<Kennung>": {"anzahl": 3, "titelbild": "<Vorschau des ersten Fotos>"}}}
  data/hochamt-fotos/<Kennung>.json  alles zu einem Hochamt:
      {"kennung": "<Kennung>", "bilder": [ {bild, vorschau, alt, breite, hoehe}, … ]}
  Bilder in assets/img/hochaemter/<Kennung>/: foto-N.webp (Grossfassung, laengste Seite hoechstens
  1920 px) und foto-N-v.webp (Vorschau fuer das Fotogitter, laengste Seite 640 px).

Das Skript
  - erzeugt fehlende Vorschaubilder (braucht Pillow: pip install pillow),
  - schreibt jede Datei erst als .tmp und benennt sie dann um (nie eine halbe Datei),
  - prueft am Ende, dass jedes Foto in der neuen Ablage steht, und entfernt erst dann die alte Datei.
Bestehende Detail-Dateien bleiben erhalten; Fotos aus der alten Datei, die dort fehlen, kommen dazu.

Aufruf im Ordner der Website (dort, wo assets/ und data/ liegen):
  python tools/hochamt-fotos-teilen.py            uebernehmen
  python tools/hochamt-fotos-teilen.py --zeigen   nur zeigen, was passieren wuerde
  python tools/hochamt-fotos-teilen.py --vorschau nur fehlende Vorschaubilder nachholen (neue Ablage)
  python tools/hochamt-fotos-teilen.py --reste    Bilddateien in assets/img/hochaemter/ zeigen, die in keiner
                                                  Detail-Datei stehen (Reste frueherer Fassungen)
  python tools/hochamt-fotos-teilen.py --reste --loeschen   diese Reste loeschen (samt Eintrag in bilder-klein.json)
"""
import json
import os
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit('Pillow fehlt: pip install pillow')

ROOT = Path(__file__).resolve().parent.parent
if not (ROOT / 'assets').is_dir() and (Path.cwd() / 'assets').is_dir():
    ROOT = Path.cwd()
ALT = ROOT / 'data' / 'hochamt-fotos.json'
NEU = ROOT / 'data' / 'hochamt-fotos'
INDEX = NEU / 'index.json'
VORSCHAU = 640
QUALITAET = 76
KENNUNG = re.compile(r'^\d{4}-\d{2}-\d{2}-\d{4}$')


def schreiben(pfad: Path, daten) -> None:
    """Atomar schreiben: erst .tmp, dann umbenennen (os.replace ist auch unter Windows atomar)."""
    pfad.parent.mkdir(parents=True, exist_ok=True)
    tmp = pfad.with_name(pfad.name + '.tmp')
    text = json.dumps(daten, ensure_ascii=False, indent=2) + '\n'
    json.loads(text)
    with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, pfad)


def lesen(pfad: Path, leer):
    if not pfad.exists():
        return leer
    return json.loads(pfad.read_text(encoding='utf-8'))


def vorschau_pfad(bild: str) -> str:
    return re.sub(r'\.(webp|jpe?g|png)$', '-v.webp', bild, flags=re.I)


def vorschau_machen(bild: str, nur_zeigen: bool) -> str:
    """Vorschau zu einem Foto anlegen (falls noch nicht da); liefert ihren Pfad oder '' ."""
    quelle = ROOT / bild
    ziel_rel = vorschau_pfad(bild)
    ziel = ROOT / ziel_rel
    if ziel.exists():
        return ziel_rel
    if not quelle.exists():
        print(f'  ! Foto fehlt: {bild}')
        return ''
    if nur_zeigen:
        print(f'  + Vorschau {ziel_rel}')
        return ziel_rel
    with Image.open(quelle) as im:
        im = ImageOps.exif_transpose(im)
        im.thumbnail((VORSCHAU, VORSCHAU), Image.LANCZOS)
        tmp = ziel.with_name(ziel.name + '.tmp')
        im.save(tmp, 'WEBP', quality=QUALITAET, method=6)
        os.replace(tmp, ziel)
    print(f'  + Vorschau {ziel_rel}')
    return ziel_rel


def eintrag(b: dict, nur_zeigen: bool) -> dict:
    bild = str(b.get('bild') or '').strip()
    neu = {'bild': bild, 'vorschau': str(b.get('vorschau') or '') or vorschau_machen(bild, nur_zeigen),
           'alt': str(b.get('alt') or ''), 'breite': int(b.get('breite') or 0), 'hoehe': int(b.get('hoehe') or 0)}
    if (not neu['breite'] or not neu['hoehe']) and (ROOT / bild).exists():
        with Image.open(ROOT / bild) as im:
            neu['breite'], neu['hoehe'] = ImageOps.exif_transpose(im).size
    if not neu['vorschau']:
        del neu['vorschau']
    return neu


def index_aus(details: dict) -> dict:
    return {'hochaemter': {k: {'anzahl': len(v), 'titelbild': v[0].get('vorschau') or v[0]['bild']}
                           for k, v in sorted(details.items()) if v}}


def reste(loeschen: bool) -> None:
    """Bilddateien der Hochaemter, auf die keine Detail-Datei verweist."""
    benutzt = set()
    for f in NEU.glob('*.json') if NEU.is_dir() else []:
        if f.name == 'index.json':
            continue
        for b in lesen(f, {}).get('bilder', []):
            benutzt.update(x for x in (b.get('bild'), b.get('vorschau')) if x)
    if ALT.exists():
        sys.exit('Zuerst uebernehmen (ohne --reste): die alte Datei data/hochamt-fotos.json gibt es noch.')
    ordner = ROOT / 'assets' / 'img' / 'hochaemter'
    liste = [p for p in sorted(ordner.rglob('*')) if p.is_file() and p.relative_to(ROOT).as_posix() not in benutzt]
    if not liste:
        print('Keine Reste.')
        return
    for p in liste:
        print(f'  {"- " if loeschen else ""}{p.relative_to(ROOT).as_posix()}  ({p.stat().st_size // 1024} KB)')
    if not loeschen:
        print(f'{len(liste)} Datei(en). Loeschen mit: --reste --loeschen')
        return
    for p in liste:
        p.unlink()
    for d in sorted(ordner.iterdir(), reverse=True):
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()
    klein = ROOT / 'data' / 'bilder-klein.json'
    if klein.exists():
        daten = lesen(klein, {})
        vorher = len(daten.get('bilder', []))
        # Eintraege der Hochamt-Fotos, deren kleine Fassung (-m.webp) es nicht mehr gibt
        daten['bilder'] = [b for b in daten.get('bilder', []) if not b.startswith('assets/img/hochaemter/')
                           or (ROOT / b.replace('.webp', '-m.webp')).exists()]
        if len(daten['bilder']) != vorher:
            schreiben(klein, daten)
    print(f'{len(liste)} Datei(en) geloescht.')


def main():
    if '--reste' in sys.argv:
        reste('--loeschen' in sys.argv)
        return
    nur_zeigen = '--zeigen' in sys.argv
    alt = lesen(ALT, {}).get('bilder', {}) if ALT.exists() else {}
    details = {}
    for f in sorted(NEU.glob('*.json')) if NEU.is_dir() else []:
        if f.name != 'index.json' and KENNUNG.match(f.stem):
            details[f.stem] = lesen(f, {}).get('bilder', [])
    if not alt and '--vorschau' not in sys.argv and not details:
        print('Nichts zu tun: keine Fotos der Hochaemter gefunden.')
        return

    geaendert = set()
    for kennung, liste in sorted(alt.items()):
        if not KENNUNG.match(kennung) or not isinstance(liste, list):
            print(f'  ! Unbekannte Kennung uebersprungen: {kennung}')
            continue
        vorhanden = {b['bild'] for b in details.get(kennung, [])}
        neu = [b for b in liste if isinstance(b, dict) and b.get('bild') and b['bild'] not in vorhanden]
        if neu:
            print(f'{kennung}: {len(neu)} Foto(s) uebernehmen')
            details.setdefault(kennung, []).extend(eintrag(b, nur_zeigen) for b in neu)
            geaendert.add(kennung)
    # Vorschaubilder auch fuer Fotos nachholen, die schon in der neuen Ablage stehen
    for kennung, liste in details.items():
        for b in liste:
            if not b.get('vorschau'):
                v = vorschau_machen(b['bild'], nur_zeigen)
                if v:
                    b['vorschau'] = v
                    geaendert.add(kennung)

    if nur_zeigen:
        print(f'(nur gezeigt) {len(geaendert)} Hochamt/Hochaemter wuerden geschrieben.')
        return
    for kennung in sorted(geaendert):
        schreiben(NEU / f'{kennung}.json', {'kennung': kennung, 'bilder': details[kennung]})
    schreiben(INDEX, index_aus(details))

    # Gegenprobe: jedes Foto der alten Datei steht in der neuen Ablage
    fehlt = [(k, b.get('bild')) for k, l in alt.items() if KENNUNG.match(k)
             for b in l if isinstance(b, dict) and b.get('bild')
             and b['bild'] not in {x['bild'] for x in lesen(NEU / f'{k}.json', {}).get('bilder', [])}]
    if fehlt:
        sys.exit(f'Abbruch, {len(fehlt)} Foto(s) fehlen in der neuen Ablage, die alte Datei bleibt: {fehlt[:3]}')
    if ALT.exists():
        ALT.unlink()
        print(f'Alte Datei entfernt: {ALT.relative_to(ROOT)}')
    print(f'Fertig: {len(details)} Hochamt/Hochaemter, {sum(len(v) for v in details.values())} Foto(s), Uebersicht {INDEX.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
