#!/usr/bin/env python3
"""Vorschau beim Teilen, Suchmaschinen-Angaben und Sitemap erzeugen.

Fuer jede oeffentliche Seite (index.html und pages/*.html) schreibt das Skript im <head> einen Block
zwischen <!--seo-anfang--> und <!--seo-ende--> mit:
  - <link rel="canonical"> (die eine, richtige Adresse der Seite)
  - Open Graph und Twitter-Karte (Titel, Beschreibung und Bild, die WhatsApp, Facebook, Signal usw. beim Teilen zeigen)
  - auf der Startseite strukturierte Daten (schema.org, Kirche mit Adresse und Telefon) fuer Google
und legt sitemap.xml im Projektordner an.
Uebersetzte Seiten (index.en.html, pages/musik.it.html …) bekommen ihre Sprache in og:locale; alle
Fassungen einer Seite verweisen mit <link rel="alternate" hreflang> aufeinander (Deutsch ist x-default).

Titel und Beschreibung kommen aus <title> und <meta name="description"> der Seite.
Die Adresse der Website steht in tools/seo-einstellungen.json ("adresse"), das Bild je Seite unten in BILDER.

Aufruf (im Projektordner):
  python tools/seo.py             schreibt die Seiten und die Sitemap neu
  python tools/seo.py --pruefen   zeigt nur, was sich aendern wuerde
Danach lohnt ein Blick in die Vorschau, z. B. mit dem "Sharing Debugger" von Facebook.
"""
import html
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path(__file__).resolve().parent.parent
EINSTELLUNGEN = Path(__file__).resolve().parent / 'seo-einstellungen.json'
ANFANG, ENDE = '<!--seo-anfang-->', '<!--seo-ende-->'
STANDARD_BILD = 'assets/img/kirche/turm.webp'
# Eigenes Bild je Seite (Pfad ab Projektordner)
BILDER = {
    'pages/orgel-rieger.html': 'assets/img/orgeln/rieger-orgel.webp',
    'pages/orgel-reil.html': 'assets/img/orgeln/reil-orgel.webp',
}
# Seiten, die nicht in die Sitemap und nicht in die Suche gehoeren
AUSGENOMMEN = ('pages/news-verwaltung.html', 'pages/hochaemter-verwaltung.html', 'pages/sakramente.html', 'pages/gottesdienste.html', 'pages/pfarre.html', 'pages/chronik.html', 'pages/predigten.html')
# Seiten, die erst mit ?id=... eine Adresse haben (Vorlagen): ohne canonical/og:url, nicht in der Sitemap
VORLAGEN = ('pages/hochamt.html', 'pages/hochamt.en.html', 'pages/hochamt.it.html')


def einstellungen():
    d = json.loads(EINSTELLUNGEN.read_text(encoding='utf-8'))
    adresse = str(d['adresse']).rstrip('/')
    if not adresse.startswith('https://'):
        sys.exit('seo-einstellungen.json: "adresse" muss mit https:// beginnen')
    return adresse


SPRACHEN = {'de': 'de_AT', 'en': 'en_GB', 'it': 'it_IT'}
SPRACHE = re.compile(r'\.(en|it)\.html$')


def sprache(rel):
    m = SPRACHE.search(rel)
    return m.group(1) if m else 'de'


def fassung(rel, lang):
    basis = SPRACHE.sub('.html', rel)
    return basis if lang == 'de' else f'{basis[:-5]}.{lang}.html'


def seiten():
    liste = [ROOT / 'index.html'] + sorted(ROOT.glob('index.*.html')) + sorted((ROOT / 'pages').glob('*.html'))
    return [p for p in liste if p.relative_to(ROOT).as_posix() not in AUSGENOMMEN and '<title>' in p.read_text(encoding='utf-8')]


def url_von(rel, adresse):
    if rel == 'index.html':
        return adresse + '/'
    return f'{adresse}/{rel}'


def bildmasse(rel):
    if Image is None:
        return None
    try:
        with Image.open(ROOT / rel) as im:
            return im.size
    except OSError:
        return None


def letzte_aenderung(p):
    """Datum der letzten Aenderung: letzter Commit, sonst Dateizeit"""
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', p.relative_to(ROOT).as_posix()], cwd=ROOT,
                             capture_output=True, text=True, timeout=20).stdout.strip()
        if out:
            return out
    except (OSError, subprocess.SubprocessError):
        pass
    return datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).strftime('%Y-%m-%d')


def text_aus(muster, s):
    m = re.search(muster, s, re.S)
    return html.unescape(m.group(1)).strip() if m else ''


def block(rel, s, adresse):
    titel = text_aus(r'<title>(.*?)</title>', s)
    beschr = text_aus(r'<meta name="description" content="([^"]*)"', s)
    bild = BILDER.get(fassung(rel, 'de'), STANDARD_BILD)
    q = html.escape
    lang = sprache(rel)
    andere = [l for l in SPRACHEN if (ROOT / fassung(rel, l)).exists()]
    zeilen = [
        ANFANG,
        *([] if rel in VORLAGEN else [f'<link rel="canonical" href="{q(url_von(rel, adresse))}"/>']),
    ]
    if len(andere) > 1 and rel not in VORLAGEN:
        zeilen += [f'<link rel="alternate" hreflang="{l}" href="{q(url_von(fassung(rel, l), adresse))}"/>' for l in andere]
        zeilen.append(f'<link rel="alternate" hreflang="x-default" href="{q(url_von(fassung(rel, "de"), adresse))}"/>')
    zeilen += [
        '<meta property="og:type" content="website"/>',
        '<meta property="og:site_name" content="Augustinerkirche Wien"/>',
        f'<meta property="og:locale" content="{SPRACHEN[lang]}"/>',
        *[f'<meta property="og:locale:alternate" content="{SPRACHEN[l]}"/>' for l in andere if l != lang],
        f'<meta property="og:title" content="{q(titel)}"/>',
    ]
    if beschr:
        zeilen.append(f'<meta property="og:description" content="{q(beschr)}"/>')
    if rel not in VORLAGEN:
        zeilen.append(f'<meta property="og:url" content="{q(url_von(rel, adresse))}"/>')
    zeilen.append(f'<meta property="og:image" content="{q(adresse + "/" + bild)}"/>')
    masse = bildmasse(bild)
    if masse:
        zeilen += [f'<meta property="og:image:width" content="{masse[0]}"/>', f'<meta property="og:image:height" content="{masse[1]}"/>']
    zeilen.append('<meta name="twitter:card" content="summary_large_image"/>')
    if rel == 'index.html':
        daten = {
            '@context': 'https://schema.org', '@type': 'Church', 'name': 'Augustinerkirche Wien',
            'alternateName': 'Pfarre und Kloster St. Augustin', 'url': adresse + '/',
            'image': adresse + '/' + bild,
            'address': {'@type': 'PostalAddress', 'streetAddress': 'Augustinerstraße 3', 'postalCode': '1010', 'addressLocality': 'Wien', 'addressCountry': 'AT'},
            'telephone': '+43 1 533 70 99', 'sameAs': ['https://www.instagram.com/augustinerkirche/'],
        }
        zeilen.append('<script type="application/ld+json">' + json.dumps(daten, ensure_ascii=False, separators=(',', ':')) + '</script>')
    zeilen.append(ENDE)
    return '\n'.join(zeilen)


def sitemap(adresse, liste):
    zeilen = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p in liste:
        rel = p.relative_to(ROOT).as_posix()
        if rel in VORLAGEN:
            continue
        zeilen += ['  <url>', f'    <loc>{html.escape(url_von(rel, adresse))}</loc>', f'    <lastmod>{letzte_aenderung(p)}</lastmod>', '  </url>']
    zeilen.append('</urlset>')
    return '\n'.join(zeilen) + '\n'


def main():
    pruefen = '--pruefen' in sys.argv
    adresse = einstellungen()
    liste = seiten()
    geaendert = 0
    for p in liste:
        rel = p.relative_to(ROOT).as_posix()
        roh = p.read_bytes().decode('utf-8')
        crlf = '\r\n' in roh
        s = roh.replace('\r\n', '\n')
        neu_block = block(rel, s, adresse)
        if ANFANG in s:
            neu = re.sub(re.escape(ANFANG) + r'.*?' + re.escape(ENDE), lambda m: neu_block, s, count=1, flags=re.S)
        else:
            m = re.search(r'<meta name="description" content="[^"]*"/>\n', s)
            if not m:
                print('keine Beschreibung, uebersprungen:', rel)
                continue
            neu = s[:m.end()] + neu_block + '\n' + s[m.end():]
        if neu != s:
            geaendert += 1
            print(('weicht ab:  ' if pruefen else 'geschrieben: ') + rel)
            if not pruefen:
                p.write_bytes((neu.replace('\n', '\r\n') if crlf else neu).encode('utf-8'))
    karte = sitemap(adresse, liste)
    ziel = ROOT / 'sitemap.xml'
    if not pruefen:
        alt = ziel.read_text(encoding='utf-8') if ziel.exists() else ''
        # nur schreiben, wenn sich mehr als das Datum geaendert hat? -> immer aktuell halten
        if alt != karte:
            ziel.write_text(karte, encoding='utf-8', newline='\n')
            print('sitemap.xml geschrieben:', len([p for p in liste if p.relative_to(ROOT).as_posix() not in VORLAGEN]), 'Seiten')
    print(f'{geaendert} Seite(n) {"weichen ab" if pruefen else "geaendert"}. Adresse: {adresse}')


if __name__ == '__main__':
    main()
