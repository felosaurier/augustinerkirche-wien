#!/usr/bin/env python3
"""Neuigkeiten, Predigten und Bildnachweise in die geteilte Ablage uebernehmen (einmalig, verlustfrei).

1. Fotos und Videos der Neuigkeiten
   vorher: data/news-fotos.json {"bilder": {Kennung: [{bild, alt, breite, hoehe}]}}
           data/news-videos.json {"videos": {Kennung: [{datei, titel}]}}
   nachher: data/neuigkeiten/index.json      {"meldungen": {Kennung: {fotos, videos, titelbild}}}
            data/neuigkeiten/<Kennung>.json  {kennung, fotos: [{bild, vorschau, alt, nachweis, breite, hoehe}], videos}
   Vorschau: die schon vorhandene kleine Fassung (<name>-m.webp), sonst wird <name>-v.webp (640 px) erzeugt.
2. Predigten
   vorher: data/predigten.json {"predigten": [{datum, titel, text, bild, …}]}
   nachher: data/predigten/index.json {"predigten": [{id, datum, titel, auszug, bild, nachweis, …}]}
            data/predigten/<id>.json  {id, text}
3. Bildnachweise wandern zu den Daten ihres Bildes:
   - Fotos der Meldungen, Hochaemter, Predigten: Feld "nachweis" beim Foto
   - Plakat/Vorschaubild einer Meldung: neue Spalte "Bildnachweis" in data/news.csv
   In data/bildnachweise.json bleiben nur die uebrigen Bilder (Titelfotos, Personen, Seiten …).

Jede Datei wird erst als .tmp geschrieben und dann umbenannt. Am Ende prueft das Skript, dass jedes
Foto, jedes Video, jeder Text und jeder Nachweis an der neuen Stelle steht; erst dann werden die alten
Dateien entfernt bzw. verkleinert. Bei einem Fehler bleibt alles Alte unveraendert.

Aufruf im Ordner der Website (braucht Pillow fuer fehlende Vorschaubilder: pip install pillow):
  python tools/daten-teilen.py            uebernehmen
  python tools/daten-teilen.py --zeigen   nur zeigen, was passieren wuerde
"""
import csv
import io
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if not (ROOT / 'assets').is_dir() and (Path.cwd() / 'assets').is_dir():
    ROOT = Path.cwd()
D = ROOT / 'data'
ZEIGEN = '--zeigen' in sys.argv


def lesen(p, leer):
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else leer


def text_schreiben(p, text):
    if ZEIGEN:
        return
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + '.tmp')
    with open(tmp, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, p)


def schreiben(p, daten):
    text = json.dumps(daten, ensure_ascii=False, indent=2) + '\n'
    json.loads(text)
    text_schreiben(p, text)


def slug(s, n=40):
    s = str(s).lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:n]


def plain(t):
    t = re.sub(r'\[/?(?:groß|klein)\]', '', str(t or ''))
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)
    t = re.sub(r'[*_~]{1,2}', '', t)
    return re.sub(r'\s+', ' ', t).strip()


def vorschau(bild):
    """kleine Fassung zum Foto: -m.webp, falls vorhanden, sonst -v.webp erzeugen"""
    m = re.sub(r'\.(webp|jpe?g|png)$', '-m.webp', bild, flags=re.I)
    if (ROOT / m).exists():
        return m
    v = re.sub(r'\.(webp|jpe?g|png)$', '-v.webp', bild, flags=re.I)
    if (ROOT / v).exists():
        return v
    if not (ROOT / bild).exists():
        return ''
    if ZEIGEN:
        return v
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return ''
    with Image.open(ROOT / bild) as im:
        im = ImageOps.exif_transpose(im)
        im.thumbnail((640, 640), Image.LANCZOS)
        tmp = (ROOT / v).with_name(Path(v).name + '.tmp')
        im.save(tmp, 'WEBP', quality=76, method=6)
        os.replace(tmp, ROOT / v)
    return v


# ---------- CSV wie js/gemeinsam/hochaemter-data.js (csvText) ----------
def csv_zelle(v):
    s = str(v if v is not None else '')
    if re.match(r'^[=+\-@\t\r]', s) and not re.match(r'^[+-]?\d[\d.,]*$', s):
        s = ' ' + s
    return '"' + s.replace('"', '""') + '"' if re.search(r'[;"\r\n]', s) else s


def csv_text(rows):
    return '﻿' + '\r\n'.join(';'.join(csv_zelle(c) for c in r) for r in rows) + '\r\n'


def main():
    credits_p = D / 'bildnachweise.json'
    credits = lesen(credits_p, {'bilder': {}}).get('bilder', {})
    verbraucht = set()     # Nachweise, die an eine neue Stelle gewandert sind
    berichte = []

    # ---------- 1. Neuigkeiten ----------
    fotos_alt = lesen(D / 'news-fotos.json', {}).get('bilder', {})
    videos_alt = lesen(D / 'news-videos.json', {}).get('videos', {})
    ndir = D / 'neuigkeiten'
    index = lesen(ndir / 'index.json', {'meldungen': {}}).get('meldungen', {})
    neue = {}
    for kid in sorted(set(fotos_alt) | set(videos_alt)):
        fotos = []
        for b in fotos_alt.get(kid, []):
            if not isinstance(b, dict) or not b.get('bild'):
                continue
            e = {'bild': b['bild']}
            v = b.get('vorschau') or vorschau(b['bild'])
            if v:
                e['vorschau'] = v
            e['alt'] = str(b.get('alt') or '')
            n = b.get('nachweis') or credits.get(b['bild'], '')
            if n:
                e['nachweis'] = n
                verbraucht.add(b['bild'])
            e['breite'] = int(b.get('breite') or 0)
            e['hoehe'] = int(b.get('hoehe') or 0)
            fotos.append(e)
        videos = [{'datei': v['datei'], 'titel': str(v.get('titel') or 'Video')} for v in videos_alt.get(kid, []) if isinstance(v, dict) and v.get('datei')]
        if fotos or videos:
            neue[kid] = {'kennung': kid, 'fotos': fotos, 'videos': videos}
    for kid, d in neue.items():
        schreiben(ndir / f'{kid}.json', d)
        index[kid] = {'fotos': len(d['fotos']), 'videos': len(d['videos']), 'titelbild': (d['fotos'][0].get('vorschau') or d['fotos'][0]['bild']) if d['fotos'] else ''}
    if neue:
        schreiben(ndir / 'index.json', {'meldungen': dict(sorted(index.items()))})
    berichte.append(f'Neuigkeiten: {len(neue)} Meldungen, {sum(len(d["fotos"]) for d in neue.values())} Fotos, {sum(len(d["videos"]) for d in neue.values())} Videos')

    # Plakat/Vorschaubild: Spalte "Bildnachweis" in news.csv
    csv_p = D / 'news.csv'
    roh = csv_p.read_bytes().decode('utf-8')
    rows = list(csv.reader(io.StringIO(roh.lstrip('﻿'), newline=''), delimiter=';'))
    if csv_text(rows) != roh:
        sys.exit('Abbruch: news.csv laesst sich nicht unveraendert neu schreiben (Format unbekannt). Nichts geaendert.')
    kopf = [c.strip().lower() for c in rows[0]]
    if 'bildnachweis' not in kopf:
        i_plakat, i_bild = kopf.index('plakat'), kopf.index('vorschaubild')
        rows[0].append('Bildnachweis')
        for r in rows[1:]:
            r += [''] * (len(rows[0]) - 1 - len(r))
            pfad = (r[i_plakat] or r[i_bild]).strip()
            n = credits.get(pfad, '')
            if n:
                verbraucht.add(pfad)
            r.append(n)
        text_schreiben(csv_p, csv_text(rows))
        berichte.append(f'news.csv: Spalte Bildnachweis ergaenzt ({sum(1 for r in rows[1:] if r[-1])} Nachweise)')

    # ---------- 2. Predigten ----------
    pr_alt = D / 'predigten.json'
    pdir = D / 'predigten'
    pr_neu = []
    if pr_alt.exists():
        ids = set()
        for p in lesen(pr_alt, {}).get('predigten', []):
            if not isinstance(p, dict):
                continue
            base = p.get('id') or f"{p.get('datum', '')}-{slug(p.get('titel', ''), 50) or 'predigt'}"
            pid, n = base, 2
            while pid in ids:
                pid, n = f'{base}-{n}', n + 1
            ids.add(pid)
            text = str(p.get('text') or '')
            schreiben(pdir / f'{pid}.json', {'id': pid, 'text': text})
            e = {'id': pid}
            e.update({k: v for k, v in p.items() if k not in ('text', 'id')})
            e['auszug'] = plain(' '.join(text.split('\n')))[:400]
            if e.get('bild') and not e.get('nachweis') and credits.get(e['bild']):
                e['nachweis'] = credits[e['bild']]
            if e.get('bild') and e.get('nachweis'):
                verbraucht.add(e['bild'])
            pr_neu.append(e)
        schreiben(pdir / 'index.json', {'predigten': pr_neu})
        berichte.append(f'Predigten: {len(pr_neu)} Beitraege')

    # ---------- 3. Hochaemter: Nachweise zum Foto ----------
    hdir = D / 'hochamt-fotos'
    hz = 0
    for f in sorted(hdir.glob('*.json')) if hdir.is_dir() else []:
        if f.name == 'index.json':
            continue
        d = lesen(f, {})
        geaendert = False
        for b in d.get('bilder', []):
            if b.get('bild') and not b.get('nachweis') and credits.get(b['bild']):
                b['nachweis'] = credits[b['bild']]
                geaendert = True
                hz += 1
            if b.get('nachweis'):
                verbraucht.add(b.get('bild'))
        if geaendert:
            schreiben(f, d)
    if hz:
        berichte.append(f'Hochaemter: {hz} Nachweise zum Foto')

    if ZEIGEN:
        print('\n'.join(berichte))
        print(f'(nur gezeigt) {len(verbraucht)} Nachweise wuerden aus data/bildnachweise.json wandern.')
        return

    # ---------- Gegenprobe ----------
    fehler = []
    for kid, liste in fotos_alt.items():
        d = lesen(ndir / f'{kid}.json', {})
        da = {b['bild']: b for b in d.get('fotos', [])}
        for b in liste:
            if isinstance(b, dict) and b.get('bild'):
                if b['bild'] not in da:
                    fehler.append(f'Foto {b["bild"]}')
                elif credits.get(b['bild']) and da[b['bild']].get('nachweis') != credits[b['bild']]:
                    fehler.append(f'Nachweis {b["bild"]}')
    for kid, liste in videos_alt.items():
        da = {v['datei'] for v in lesen(ndir / f'{kid}.json', {}).get('videos', [])}
        fehler += [f'Video {v["datei"]}' for v in liste if isinstance(v, dict) and v.get('datei') and v['datei'] not in da]
    if pr_alt.exists():
        for p, e in zip([x for x in lesen(pr_alt, {}).get('predigten', []) if isinstance(x, dict)], pr_neu):
            if lesen(pdir / f'{e["id"]}.json', {}).get('text') != str(p.get('text') or ''):
                fehler.append(f'Predigt {p.get("titel")}')
    if fehler:
        sys.exit(f'Abbruch, {len(fehler)} Abweichung(en), die alten Dateien bleiben: {fehler[:5]}')

    # ---------- Alte Dateien entfernen bzw. verkleinern ----------
    for alt in (D / 'news-fotos.json', D / 'news-videos.json', pr_alt):
        if alt.exists():
            alt.unlink()
            berichte.append(f'entfernt: data/{alt.name}')
    rest = {k: v for k, v in credits.items() if k not in verbraucht}
    schreiben(credits_p, {'bilder': dict(sorted(rest.items()))})
    berichte.append(f'bildnachweise.json: {len(credits)} -> {len(rest)} Eintraege ({len(credits) - len(rest)} gewandert)')
    # Liste der kleinen Fassungen: Fotos der Meldungen brauchen sie nicht mehr (Vorschau steht beim Foto)
    klein_p = D / 'bilder-klein.json'
    if klein_p.exists():
        klein = lesen(klein_p, {})
        fotos_pfade = {b['bild'] for d in neue.values() for b in d['fotos']}
        vorher = len(klein.get('bilder', []))
        klein['bilder'] = [b for b in klein.get('bilder', []) if b not in fotos_pfade]
        if len(klein['bilder']) != vorher:
            schreiben(klein_p, klein)
            berichte.append(f'bilder-klein.json: {vorher} -> {len(klein["bilder"])} Eintraege')
    print('\n'.join(berichte))
    print('Fertig.')


if __name__ == '__main__':
    main()
