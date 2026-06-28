# Augustinerkirche Wien

Modulare, statische Multi-Page-Website für die Pfarre und das Kloster St. Augustin (Augustinerkirche Wien), die Kirchenmusik von St. Augustin und die Pfarre Aspersdorf. Refaktoriert aus einer monolithischen HTML-Datei in eine klassisch-elegante, wartbare Projektstruktur ohne Build-Tooling.

## Design

Zeitlose Typografie (Playfair Display für Überschriften, Source Sans 3 für Fließtext), eine ruhige Farbpalette aus Elfenbein, Anthrazit und Gold, feine Linien statt Schatten-Spielereien, sowie zurückhaltende Scroll- und Hover-Animationen via `IntersectionObserver`. Keine Emojis, keine generischen KI-Website-Muster (keine Neon-Verläufe, keine Wellen-Trenner).

## Struktur

```
index.html                  Startseite (Aktuelles, Identität, Herzgruft, Instagram)
pages/
  gottesdienste.html        Liturgie-Zeiten, Wochenüberblick, Runden in St. Augustin
  musik.html                Hochämter, Ensembles, Organisten, Orgeln, Patenschaft
  sakramente.html           Taufe, Eucharistie, Firmung, Trauung, Wiedereintritt ...
  chronik.html              Geschichte, Herzgruft, Augustinerorden, Mitbrüder
  aspersdorf.html           Pfarre Aspersdorf, Pfarrkirche St. Georg, Pfarrfriedhof
  hochaemter-verwaltung.html  Internes Formular-Werkzeug zur Pflege der Hochamt-Termine
  runden/                   Eigenständige Detailseiten je Pfarrgruppe (neues Fenster)
css/style.css                Zentrales Stylesheet
js/
  main.js                   Navigation, Sprache, Sidebar-Tabs, Hash-Routing, Reveal
  instagram.js               Instagram-Feed mit Shimmer-Loading und Fallback
  hochaemter.js              Rendert den Hochamt-Kalender aus data/hochaemter.json
  hochaemter-verwaltung.js   Formular-Logik für die interne Verwaltungsseite
  solisten.js                Lädt und sortiert die Solistenliste aus data/solisten.json
data/
  hochaemter.json            Liste der Hochamt-Termine (kommend & vergangen)
  solisten.json              Liste der Solistinnen und Solisten mit Stimmlage
assets/
  logo.png, img/             Bilder (teils von den Originalseiten recherchiert)
```

Alle internen Pfade sind **relativ** (nicht root-relative), damit die Seite sowohl per Doppelklick (`file://`) als auch über jeden Webserver funktioniert.

## Lokal ansehen

Einfach `index.html` im Browser öffnen. Für die volle Funktionalität (z. B. den dynamischen Hochamt-Kalender, der `data/hochaemter.json` per `fetch()` lädt) wird ein lokaler Webserver empfohlen, da Browser `fetch()` auf `file://`-Ebene aus Sicherheitsgründen blockieren:

```bash
npx serve .
# oder
python -m http.server
```

## Hochämter pflegen

Termine liegen in `data/hochaemter.json`. Statt die Datei händisch zu bearbeiten, kann `pages/hochaemter-verwaltung.html` genutzt werden — ein Formular zum Hinzufügen/Bearbeiten/Entfernen von Terminen mit Export als JSON-Datei (die anschließend `data/hochaemter.json` ersetzt). Die Seite ist bewusst nicht in der öffentlichen Navigation verlinkt.

## Inhaltliche Quellen

Texte und Bilder wurden, wo möglich, direkt von den offiziellen Seiten recherchiert und übernommen bzw. originalgetreu wiedergegeben:

- https://augustinerkirche.augustiner.at
- https://hochamt.augustiner.at
- https://aspersdorf.augustiner.at
- https://www.augustiner.at

## Lizenz

Kein offenes Lizenzmodell vorgesehen — Inhalte und Bilder gehören der Pfarre St. Augustin / dem Augustiner-Vikariat Wien bzw. den jeweiligen Bildquellen.
