#!/usr/bin/env python3
"""Baut ein Paket für den Webserver (nginx oder Apache).

Die Website ist rein statisch. Das Paket enthält nur, was Besucher brauchen (ohne Entwicklungsdateien),
dazu die Serverkonfiguration, eine Anleitung und alles als .tar.gz zum Hochladen. Nur Python 3, keine
weiteren Programme.

    python tools/paket.py                         Test-Paket fürs Homelab   -> dist/homelab-test/
    python tools/paket.py --verwaltung            dasselbe, mit der Verwaltung (Server-Modus, siehe unten)
    python tools/paket.py --live                  Paket für den echten Betrieb -> dist/live/
    python tools/paket.py --ohne-cookie-vorschau  Test-Paket, aber ohne erzwungenen Cookie-Hinweis

Das Test-Paket unterscheidet sich vom Live-Paket nur in diesen Punkten (jeder wird beim Bauen genannt):
robots.txt und der Kopf X-Robots-Tag sperren Suchmaschinen aus, und der Cookie-Hinweis erscheint immer
(Test-Mess-ID in der Kopie von js/statistik.js; gemessen wird nie).

Mit --verwaltung kommt die Verwaltung (admin/, js/admin*, css/admin*) mit auf den Server und speichert dort
direkt, ohne Projektordner auf dem PC (Server-Modus). Dafür liegen zwei weitere Konfigurationen bei: die
Verwaltung läuft auf einem eigenen Port, nur mit Anmeldung am Server, und der Server erlaubt Schreiben nur
in data/ und assets/. Die öffentliche Konfiguration sperrt admin/. Ohne --verwaltung bleibt alles davon draußen.

Zum Schluss prüft das Skript, ob jede Datei, auf die eine Seite, ein Stil, ein Skript oder eine Tabelle
verweist, im Paket liegt, auch in der Groß- und Kleinschreibung (Windows ist da nachsichtig, Linux nicht).
"""
import argparse
import hashlib
import html.parser
import os
import posixpath
import re
import shutil
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
VORLAGEN = ROOT / 'tools' / 'server'

DATEIEN = ['index.html', 'favicon.ico', 'site.webmanifest']
ORDNER = ['pages', 'css', 'js', 'assets', 'data']

TEST_MESS_ID = 'G-VORSCHAU01'


def fehler(text):
    print('FEHLER: ' + text)
    sys.exit(1)


def ausgeschlossen(rel, verwaltung):
    """True für alles, was nicht auf den Webserver gehört (rel: Pfad mit / ab Projektordner)."""
    name = rel.rsplit('/', 1)[-1]
    if rel.startswith('pages/') and name.endswith('-verwaltung.html'):
        return True  # Weiterleitungen auf die Verwaltung
    if not verwaltung and rel.startswith(('css/admin', 'js/admin')):
        return True  # Verwaltung
    if name.startswith(('.', '~$')) or name.endswith(('~', '.bak', '.tmp', '.crswap', '.swp', '.log')):
        return True  # versteckte Dateien, Excel-Sperrdateien, Sicherungskopien
    return name in ('Thumbs.db', 'desktop.ini')


def sammeln(verwaltung):
    gefunden, ausgelassen = [], []
    for f in DATEIEN:
        if not (ROOT / f).is_file():
            fehler(f + ' fehlt im Projekt')
        gefunden.append(f)
    for d in ORDNER + (['admin'] if verwaltung else []):
        if not (ROOT / d).is_dir():
            fehler('Ordner ' + d + ' fehlt im Projekt')
        for dirpath, dirnames, filenames in os.walk(ROOT / d):
            dirnames[:] = sorted(x for x in dirnames if not x.startswith('.'))
            for n in sorted(filenames):
                rel = (Path(dirpath) / n).relative_to(ROOT).as_posix()
                (ausgelassen if ausgeschlossen(rel, verwaltung) else gefunden).append(rel)
    return gefunden, ausgelassen


def lesen(p):
    return p.read_bytes().decode('utf-8')


def schreiben(p, text):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(text.encode('utf-8'))


def cookie_vorschau(site):
    """Kopie von js/statistik.js: Test-Mess-ID und "lokal" fest, damit der Hinweis erscheint, aber nie gemessen wird."""
    p = site / 'js' / 'statistik.js'
    s = lesen(p)
    alt_id = "const GA_ID = '';"
    lokal = re.search(r'const lokal = [^\n]*;', s)
    if s.count(alt_id) != 1 or not lokal:
        fehler('js/statistik.js hat sich geändert, die Cookie-Vorschau lässt sich nicht einsetzen (siehe cookie_vorschau in tools/paket.py)')
    eol = '\r\n' if '\r\n' in s else '\n'
    s = s.replace(alt_id, "const GA_ID = '" + TEST_MESS_ID + "';", 1)
    s = s.replace(lokal.group(0), 'const lokal = true;', 1)
    s = '/* HOMELAB-TEST-PAKET: Test-Mess-ID, Seite gilt als lokal. Der Cookie-Hinweis erscheint, gemessen wird nie. */' + eol + s
    schreiben(p, s)


MARKE = re.compile(r'^\s*(?:#|<!--)\[([a-z-]+)-(anfang|ende)\](?:-->)?\s*$')


def bloecke(text, aktiv):
    """Zeilen zwischen [name-anfang] und [name-ende] (in Konfigurationen als #[...], in Markdown als <!--[...]-->)
    bleiben nur, wenn name in aktiv steht. Die Markierungen selbst entfallen."""
    aus, stapel = [], []
    for zeile in text.replace('\r\n', '\n').split('\n'):
        m = MARKE.match(zeile)
        if m:
            if m.group(2) == 'anfang':
                stapel.append(m.group(1) in aktiv)
            else:
                stapel.pop()
            continue
        if all(stapel):
            aus.append(zeile)
    if stapel:
        fehler('Markierung ohne Ende in einer Vorlage (tools/server)')
    return '\n'.join(aus)


def hinweise(test, cookie, verwaltung):
    punkte = []
    if test:
        punkte.append('Suchmaschinen sind ausgesperrt (`robots.txt` und der Kopf `X-Robots-Tag`), falls der Container doch aus dem Internet erreichbar ist.')
        if cookie:
            punkte.append('Der Cookie-Hinweis erscheint immer. In der Kopie von `js/statistik.js` steht dafür eine Test-Mess-ID, und die Seite gilt als „lokal“: '
                          '**es wird nie etwas an Google gesendet.**')
        else:
            punkte.append('Der Cookie-Hinweis erscheint nur, wenn in `js/statistik.js` eine Mess-ID steht (hier: nicht der Fall).')
    if verwaltung:
        punkte.append('Die **Verwaltung ist enthalten und speichert direkt auf dem Server** (siehe Abschnitt 5). Sie liegt auf einem eigenen Port und nur mit Anmeldung am Server. '
                      '`admin/zugaenge.json` mit den Prüfsummen der Passwörter liegt im Paket, bitte das Paket nicht weitergeben.')
    else:
        punkte.append('Die Verwaltung (`admin/`) ist nicht enthalten. Mit `python tools/paket.py --verwaltung` kommt sie dazu und speichert dann direkt auf dem Server.')
    kopf = '**Das ist ein Test-Paket.** Gegenüber dem Live-Paket gilt:' if test else '**Das ist das Live-Paket:** die Dateien genau wie im Projekt, ohne Test-Zusätze.'
    text = kopf + '\n\n' + '\n'.join('- ' + p for p in punkte)
    if not test:
        text += ('\n- Es gibt keine `robots.txt` und keine Sitemap. Vor dem Veröffentlichen die gelb markierten Stellen in Impressum und Datenschutz ergänzen, '
                 'die Mess-ID für die Statistik eintragen (siehe README, „Cookies und Besucherstatistik“) und https einrichten.')
    return text


# ---------- Prüfung: liegt alles da, worauf verwiesen wird? ----------

EXTERN = ('http:', 'https:', 'mailto:', 'tel:', 'data:', 'javascript:', 'blob:', '//', '#')


class Verweise(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if not v:
                continue
            if k in ('href', 'src', 'poster'):
                self.refs.append(v.strip())
            elif k == 'srcset':
                self.refs += [t.split()[0] for t in v.split(',') if t.strip()]


def exakt_da(site, rel):
    """True, wenn der Pfad im Paket liegt, Buchstabe für Buchstabe in der richtigen Schreibung."""
    cur = site
    teile = [t for t in rel.split('/') if t and t != '.']
    for t in teile:
        try:
            if t not in os.listdir(cur):
                return False
        except (FileNotFoundError, NotADirectoryError):
            return False
        cur = cur / t
    return cur.is_file() or (cur.is_dir() and 'index.html' in os.listdir(cur))


def pruefen(site):
    probleme = []

    def ziel(von, ref):
        ref = re.split(r'[?#]', ref, maxsplit=1)[0]
        if not ref or ref.startswith(EXTERN):
            return None
        return posixpath.normpath(posixpath.join(posixpath.dirname(von), ref))

    def pruefe(von, ref, art):
        z = ziel(von, ref)
        if z is None:
            return
        if z.startswith('..') or not exakt_da(site, z):
            probleme.append((art, von, ref))

    for p in sorted(site.rglob('*')):
        if not p.is_file():
            continue
        rel = p.relative_to(site).as_posix()
        endung = p.suffix.lower()
        text = None
        if endung in ('.html', '.css', '.js', '.csv', '.json', '.webmanifest'):
            text = lesen(p)
        if endung == '.html':
            v = Verweise()
            v.feed(text)
            for r in v.refs:
                pruefe(rel, r, 'Seite')
        elif endung == '.css':
            for m in re.finditer(r'url\(\s*(?:"([^"]*)"|\'([^\']*)\'|([^)\s]*))\s*\)', text):
                pruefe(rel, next(g for g in m.groups() if g is not None), 'Stil')
        elif endung == '.webmanifest':
            for m in re.finditer(r'"(?:src|url)"\s*:\s*"([^"]+)"', text):
                pruefe(rel, m.group(1), 'Manifest')
        if endung in ('.js', '.csv', '.json'):
            # Pfade, die vollständig ausgeschrieben im Text stehen (vom Projektordner aus gesehen)
            for m in re.finditer(r'(?<![A-Za-z0-9_./-])((?:assets|data)/[A-Za-z0-9_\-./%@+()]+\.(?:webp|png|jpe?g|gif|svg|ico|mp3|m4a|ogg|wav|pdf|csv|json))(?![A-Za-z0-9_])', text):
                if re.search(r'JJJJ|YYYY|NNNN', m.group(1)):
                    continue  # Platzhalter in Kommentaren, z. B. hochaemter-JJJJ.csv
                if not exakt_da(site, m.group(1)):
                    probleme.append(('Daten', rel, m.group(1)))
    return probleme


# ---------- Bauen ----------

def megabyte(n):
    return '%.1f MB' % (n / 1024 / 1024)


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description='Baut ein Paket für nginx oder Apache (siehe Kopf der Datei).')
    ap.add_argument('--live', action='store_true', help='Paket für den echten Betrieb statt Test-Paket')
    ap.add_argument('--verwaltung', action='store_true', help='Verwaltung mitliefern (Server-Modus: sie speichert direkt auf dem Server)')
    ap.add_argument('--ohne-cookie-vorschau', action='store_true', help='Test-Paket ohne erzwungenen Cookie-Hinweis')
    a = ap.parse_args()
    test = not a.live
    cookie = test and not a.ohne_cookie_vorschau
    verwaltung = a.verwaltung

    ordner = 'homelab-test' if test else 'live'
    paket = 'augustinerkirche-' + ordner + '.tar.gz'
    out = DIST / ordner
    site = out / 'site'
    if out.resolve().parent != DIST.resolve():
        fehler('Ausgabeordner liegt nicht in dist/')
    if out.exists():
        shutil.rmtree(out)
    (DIST / paket).unlink(missing_ok=True)

    gefunden, ausgelassen = sammeln(verwaltung)
    for rel in gefunden:
        ziel = site / rel
        ziel.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, ziel)

    if test:
        schreiben(site / 'robots.txt', 'User-agent: *\nDisallow: /\n')
    if cookie:
        cookie_vorschau(site)

    aktiv = {'test'} if test else set()
    aktiv.add('verwaltung' if verwaltung else 'ohne-verwaltung')
    option = (' --live' if not test else '') + (' --verwaltung' if verwaltung else '') + (' --ohne-cookie-vorschau' if test and a.ohne_cookie_vorschau else '')
    ersetzt = {
        '{{MODUS}}': ('Test auf dem Homelab' if test else 'Live') + (', mit Verwaltung' if verwaltung else ''),
        '{{OPTION}}': option,
        '{{PAKET}}': paket,
        '{{ORDNER}}': ordner,
        '{{PORTS}}': ' bzw. 8443' if verwaltung else '',
        '{{HINWEISE}}': hinweise(test, cookie, verwaltung),
    }
    anleitung = bloecke(lesen(VORLAGEN / 'ANLEITUNG.md'), aktiv)
    for k, v in ersetzt.items():
        anleitung = anleitung.replace(k, v)
    schreiben(out / 'ANLEITUNG.md', anleitung)
    konfigs = ['nginx.conf', 'apache.conf'] + (['nginx-verwaltung.conf', 'apache-verwaltung.conf'] if verwaltung else [])
    for name in konfigs:
        schreiben(out / 'server' / name, bloecke(lesen(VORLAGEN / name), aktiv))

    probleme = pruefen(site)

    def tar_filter(ti):
        ti.uid = ti.gid = 0
        ti.uname = ti.gname = 'root'
        ti.mode = 0o755 if ti.isdir() else 0o644
        return ti

    with tarfile.open(DIST / paket, 'w:gz', compresslevel=9) as tf:
        tf.add(out, arcname=ordner, filter=tar_filter)

    dateien = [p for p in out.rglob('*') if p.is_file()]
    gesamt = sum(p.stat().st_size for p in dateien)
    sha = hashlib.sha256((DIST / paket).read_bytes()).hexdigest()
    ungewoehnlich = [r for r in gefunden if re.search(r'[^\x21-\x7e]', r)]

    print('Paket „%s“ (%s%s)' % (ordner, 'Test' if test else 'Live', ', mit Verwaltung' if verwaltung else ''))
    print('  Ordner:  %s' % out.relative_to(ROOT))
    print('  Archiv:  %s  (%s, SHA-256 %s…)' % ((DIST / paket).relative_to(ROOT), megabyte((DIST / paket).stat().st_size), sha[:16]))
    print('  Inhalt:  %d Dateien, %s (Website: %d Dateien)' % (len(dateien), megabyte(gesamt), len(list(site.rglob('*.*')))))
    if verwaltung:
        print('  Verwaltung: enthalten (Server-Modus). Achtung: admin/zugaenge.json (Prüfsummen der Passwörter) liegt im Paket, bitte nicht weitergeben.')
    else:
        print('  Nicht enthalten: Verwaltung (admin/, css/admin*, js/admin*), Weiterleitungen auf die Verwaltung (%d Dateien)' % len(ausgelassen))
    if test:
        print('  Test-Zusätze:   robots.txt + X-Robots-Tag (Suchmaschinen aus)' + ('; Cookie-Hinweis erzwungen (Test-Mess-ID, es wird nie gemessen)' if cookie else ''))
    else:
        print('  Live: keine Test-Zusätze, Dateien wie im Projekt')
    if ungewoehnlich:
        print('  Hinweis: %d Dateinamen mit Leerzeichen oder Sonderzeichen, z. B. %s' % (len(ungewoehnlich), ungewoehnlich[0]))
    if probleme:
        print('\nPROBLEME: %d Verweise führen ins Leere (Datei fehlt oder andere Groß-/Kleinschreibung):' % len(probleme))
        for art, von, ref in probleme[:40]:
            print('  [%s] %s -> %s' % (art, von, ref))
        if len(probleme) > 40:
            print('  … und %d weitere' % (len(probleme) - 40))
        sys.exit(1)
    print('  Prüfung: alle Verweise zeigen auf vorhandene Dateien (Groß-/Kleinschreibung stimmt)')
    print('\nNächster Schritt: %s hochladen, siehe %s' % ((DIST / paket).relative_to(ROOT), (out / 'ANLEITUNG.md').relative_to(ROOT)))


if __name__ == '__main__':
    main()
