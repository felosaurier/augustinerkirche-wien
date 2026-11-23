#!/usr/bin/env python3
"""Titelzeile (<nav>) und Fusszeile (<footer>) aller Seiten aus einer Vorlage erzeugen.

Die Vorlagen liegen in tools/vorlagen/nav.html und tools/vorlagen/footer.html. Platzhalter:
  {R}        Weg zur Wurzel der Website ("", "../" oder "../../")
  {P}        Weg zum Ordner pages/ ("pages/", "" oder "../")
  {KONTAKT}  Ziel des Links "Kontakt" in der Fusszeile (meist kontakt.html)
  {SPRACHEN} Sprachwahl (Flagge der aktuellen Sprache, Klick oeffnet Deutsch, Englisch, Italienisch, Franzoesisch, Spanisch), ganz rechts

Sprachen: uebersetzte Seiten liegen neben der deutschen, mit Kuerzel vor der Endung
(index.en.html, pages/musik.it.html). Sie bekommen Titel- und Fusszeile aus nav.<sprache>.html und
footer.<sprache>.html. Die Flaggen fuehren zur selben Seite in der anderen Sprache; gibt es sie
nicht, zur Startseite dieser Sprache.

Aufruf (im Projektordner):
  python tools/seitenkopf.py             schreibt alle Seiten neu (nur wenn sich etwas aendert)
  python tools/seitenkopf.py --pruefen   zeigt nur, welche Seiten von der Vorlage abweichen
  python tools/seitenkopf.py --vorlage   erzeugt die Vorlagen neu aus pages/augustinerkirche.html

Aenderungen an Menue oder Fusszeile also in der Vorlage machen und dieses Skript laufen lassen.
Seiten ohne <nav> (Weiterleitungen auf die Verwaltung) bleiben unberuehrt.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VORLAGEN = Path(__file__).resolve().parent / 'vorlagen'
NAV = re.compile(r'<nav aria-label="(?:Hauptnavigation|Main navigation|Navigazione principale|Navigation principale|Navegación principal)">.*?</nav>', re.S)
FOOT = re.compile(r'<footer>.*?</footer>', re.S)

# Seiten mit eigenem Ziel fuer "Kontakt" in der Fusszeile (Pfad mit / ab Projektordner)
KONTAKT = {'pages/aspersdorf.html': 'aspersdorf.html#p-leitung'}

# Seiten mit eigener Titelzeile (Vorlage in tools/vorlagen/)
EIGENE_NAV = {'pages/aspersdorf.html': 'nav-aspersdorf.html', 'index.html': 'nav-start.html', 'pages/musik.html': 'nav-musik.html'}

# Ziel des Logos: immer die Startseite der Website (index.html bzw. index.<sprache>.html)

SPRACHEN = [('de', 'Deutsch', 'at'), ('en', 'English', 'gb'), ('it', 'Italiano', 'it'), ('fr', 'Français', 'fr'), ('es', 'Español', 'es')]
SPRACHE = re.compile(r'\.(en|it|fr|es)\.html$')


def sprache(rel):
    m = SPRACHE.search(rel)
    return m.group(1) if m else 'de'


def fassung(rel, lang):
    """Pfad der Seite in einer Sprache (ohne Pruefung, ob es sie gibt): pages/musik.html -> pages/musik.en.html"""
    basis = SPRACHE.sub('.html', rel)
    return basis if lang == 'de' else f'{basis[:-5]}.{lang}.html'


def flaggen(rel, r):
    """Sprachwahl fuer die Seite rel; r: Weg zur Wurzel. Sichtbar ist nur die Flagge der aktuellen
    Sprache, ein Klick oeffnet die Auswahl. data-gleich: dieselbe Seite in der anderen Sprache"""
    jetzt = sprache(rel)
    name_jetzt, flagge_jetzt = next((n, f) for l, n, f in SPRACHEN if l == jetzt)
    teile = []
    for lang, name, flagge in SPRACHEN:
        ziel = fassung(rel, lang)
        gleich = (ROOT / ziel).exists()
        if not gleich:
            ziel = fassung('index.html', lang)
        extra = (' aria-current="true"' if lang == jetzt else '') + (' data-gleich' if gleich else '')
        teile.append(f'<a href="{r}{ziel}" hreflang="{lang}" lang="{lang}"{extra}>'
                     f'<img src="{r}assets/flaggen/{flagge}.svg" alt="" width="24" height="16"/>{name}</a>')
    return ('<details class="nav-lang"><summary title="Sprache · Language · Lingua · Langue · Idioma" aria-label="Sprache · Language · Lingua · Langue · Idioma: '
            f'{name_jetzt}"><img src="{r}assets/flaggen/{flagge_jetzt}.svg" alt="" width="24" height="16"/>'
            '<svg viewBox="0 0 10 6" fill="none" stroke-width="1.8" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4"/></svg>'
            '</summary><div class="nav-lang-menu">' + ''.join(teile) + '</div></details>')


def seiten():
    liste = [ROOT / 'index.html'] + sorted(ROOT.glob('index.*.html')) + sorted((ROOT / 'pages').glob('*.html')) + sorted((ROOT / 'pages' / 'runden').glob('*.html'))
    return [p for p in liste if NAV.search(p.read_text(encoding='utf-8'))]


def wege(p):
    rel = p.relative_to(ROOT).as_posix()
    tiefe = rel.count('/')
    r = '../' * tiefe
    pg = 'pages/' if tiefe == 0 else ('' if tiefe == 1 else '../')
    return rel, r, pg


def zerlegen(text, r, pg, kontakt):
    """Seite -> Vorlage (Gegenstueck zu fuellen)"""
    def attr(m):
        name, wert = m.group(1), m.group(2)
        if re.match(r'(https?:|mailto:|tel:|#|\{)', wert):
            return m.group(0)
        if r and wert.startswith(r):
            return f'{name}="{{R}}{wert[len(r):]}"'
        if wert.startswith(('assets/', 'index.html', 'favicon')) or (not r and wert.startswith('assets')):
            return f'{name}="{{R}}{wert}"'
        return f'{name}="{{P}}{wert}"' if not wert.startswith('../') else m.group(0)
    return re.sub(r'\b(href|src|data-href)="([^"]*)"', attr, text)


def fuellen(vorlage, r, pg, kontakt, rel='index.html'):
    ziel = r + fassung('index.html', sprache(rel))
    return (vorlage.replace('{SPRACHEN}', flaggen(rel, r)).replace('{R}', r).replace('{P}', pg)
            .replace('{KONTAKT}', pg + kontakt).replace('{LOGO}', ziel))


def vorlagen_erzeugen():
    quelle = ROOT / 'pages' / 'augustinerkirche.html'
    s = quelle.read_text(encoding='utf-8')
    rel, r, pg = wege(quelle)
    nav = zerlegen(NAV.search(s).group(0), r, pg, 'kontakt.html')
    nav = re.sub(r'(<a class="nav-logo-wrap" href=")[^"]*(")', r'{LOGO}', nav)
    nav = nav.replace('data-home="../index.html"', 'data-home="{R}index.html"')
    foot = zerlegen(FOOT.search(s).group(0), r, pg, 'kontakt.html')
    foot = foot.replace('href="{P}kontakt.html"', 'href="{KONTAKT}"')
    VORLAGEN.mkdir(exist_ok=True)
    (VORLAGEN / 'nav.html').write_text(nav + '\n', encoding='utf-8', newline='\n')
    (VORLAGEN / 'footer.html').write_text(foot + '\n', encoding='utf-8', newline='\n')
    print('Vorlagen geschrieben:', VORLAGEN)


def main():
    if '--vorlage' in sys.argv:
        vorlagen_erzeugen()
        return
    nav_v = (VORLAGEN / 'nav.html').read_text(encoding='utf-8').rstrip('\n')
    eigene = {rel: (VORLAGEN / name).read_text(encoding='utf-8').rstrip('\n') for rel, name in EIGENE_NAV.items()}
    foot_v = (VORLAGEN / 'footer.html').read_text(encoding='utf-8').rstrip('\n')
    lesen = lambda name: (VORLAGEN / name).read_text(encoding='utf-8').rstrip('\n')
    fremd = {lang: (lesen(f'nav.{lang}.html'), lesen(f'footer.{lang}.html')) for lang, _, _ in SPRACHEN if lang != 'de'}
    nur_pruefen = '--pruefen' in sys.argv
    abweichend = 0
    for p in seiten():
        rel, r, pg = wege(p)
        roh = p.read_bytes().decode('utf-8')
        crlf = '\r\n' in roh
        s = roh.replace('\r\n', '\n')
        lang = sprache(rel)
        if lang == 'de':
            kontakt = KONTAKT.get(rel, 'kontakt.html')
            nav, foot = eigene.get(rel, nav_v), foot_v
        else:
            kontakt = f'kontakt.{lang}.html'
            nav, foot = fremd[lang]
        # Index: Link zur eigenen Seite bleibt, das Ziel steht nach {P}
        neu = NAV.sub(lambda m: fuellen(nav, r, pg, kontakt, rel), s, count=1)
        neu = FOOT.sub(lambda m: fuellen(foot, r, pg, kontakt, rel), neu, count=1)
        if neu != s:
            abweichend += 1
            print(('weicht ab:  ' if nur_pruefen else 'geschrieben: ') + rel)
            if not nur_pruefen:
                p.write_bytes((neu.replace('\n', '\r\n') if crlf else neu).encode('utf-8'))
    print(f'{abweichend} Seite(n) {"weichen ab" if nur_pruefen else "geaendert"}.')


if __name__ == '__main__':
    main()
