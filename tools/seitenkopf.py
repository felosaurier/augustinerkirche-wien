#!/usr/bin/env python3
"""Titelzeile (<nav>) und Fusszeile (<footer>) aller Seiten aus einer Vorlage erzeugen.

Die Vorlagen liegen in tools/vorlagen/nav.html und tools/vorlagen/footer.html. Platzhalter:
  {R}        Weg zur Wurzel der Website ("", "../" oder "../../")
  {P}        Weg zum Ordner pages/ ("pages/", "" oder "../")
  {KONTAKT}  Ziel des Links "Kontakt" in der Fusszeile (meist kontakt.html)

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
NAV = re.compile(r'<nav aria-label="Hauptnavigation">.*?</nav>', re.S)
FOOT = re.compile(r'<footer>.*?</footer>', re.S)

# Seiten mit eigenem Ziel fuer "Kontakt" in der Fusszeile (Pfad mit / ab Projektordner)
KONTAKT = {'pages/aspersdorf.html': 'aspersdorf.html#p-leitung'}

# Seiten mit eigener Titelzeile (Vorlage in tools/vorlagen/)
EIGENE_NAV = {'pages/aspersdorf.html': 'nav-aspersdorf.html'}

# Ziel des Logos: die Titelseite des Bereichs, in dem die Seite liegt (Startseite: sie selbst; alles andere: Augustinerkirche)
LOGO = {'index.html': 'index.html', 'pages/musik.html': 'musik.html', 'pages/hochamt.html': 'musik.html', 'pages/orgel-rieger.html': 'musik.html', 'pages/orgel-reil.html': 'musik.html',
        'pages/augustiner.html': 'augustiner.html', 'pages/aspersdorf.html': 'aspersdorf.html'}


def seiten():
    liste = [ROOT / 'index.html'] + sorted((ROOT / 'pages').glob('*.html')) + sorted((ROOT / 'pages' / 'runden').glob('*.html'))
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


def fuellen(vorlage, r, pg, kontakt, logo='augustinerkirche.html'):
    ziel = logo if logo == 'index.html' and not r else pg + logo
    return vorlage.replace('{R}', r).replace('{P}', pg).replace('{KONTAKT}', pg + kontakt).replace('{LOGO}', ziel)


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
    nur_pruefen = '--pruefen' in sys.argv
    abweichend = 0
    for p in seiten():
        rel, r, pg = wege(p)
        roh = p.read_bytes().decode('utf-8')
        crlf = '\r\n' in roh
        s = roh.replace('\r\n', '\n')
        kontakt = KONTAKT.get(rel, 'kontakt.html')
        # Index: Link zur eigenen Seite bleibt, das Ziel steht nach {P}
        neu = NAV.sub(lambda m: fuellen(eigene.get(rel, nav_v), r, pg, kontakt, LOGO.get(rel, 'augustinerkirche.html')), s, count=1)
        neu = FOOT.sub(lambda m: fuellen(foot_v, r, pg, kontakt), neu, count=1)
        if neu != s:
            abweichend += 1
            print(('weicht ab:  ' if nur_pruefen else 'geschrieben: ') + rel)
            if not nur_pruefen:
                p.write_bytes((neu.replace('\n', '\r\n') if crlf else neu).encode('utf-8'))
    print(f'{abweichend} Seite(n) {"weichen ab" if nur_pruefen else "geaendert"}.')


if __name__ == '__main__':
    main()
