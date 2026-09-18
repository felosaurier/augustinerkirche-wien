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
  hochamt.html              Detailseite eines Hochamts (Besetzung, Solisten, Programm)
  hochaemter-verwaltung.html  Internes Werkzeug zur Pflege der Hochamt-Tabelle
  runden/                   Eigenständige Detailseiten je Pfarrgruppe (neues Fenster)
css/style.css                Zentrales Stylesheet
js/
  main.js                   Navigation, Sidebar-Tabs, Hash-Routing, Reveal
  instagram.js               Instagram-Feed mit Shimmer-Loading und Fallback
  hochaemter-data.js         Gemeinsames Modul: liest data/hochaemter.csv (Excel-Tabelle)
  hochaemter.js              Hochamt-Kalender und Archiv auf musik.html
  hochaemter-start.js        Nächste Hochämter auf der Startseite
  hochamt-detail.js          Detailseite eines Hochamts (pages/hochamt.html?id=...)
  hochaemter-verwaltung.js   Formular-Logik für die interne Verwaltungsseite
  solisten.js                Lädt und sortiert die Solistenliste aus data/solisten.json
data/
  hochaemter.csv             Alle Hochamt-Termine inkl. Mitwirkende (in Excel bearbeitbar)
  solisten.json              Liste der Solistinnen und Solisten mit Stimmlage
assets/
  logo.png, img/             Bilder (teils von den Originalseiten recherchiert)
```

Alle internen Pfade sind **relativ** (nicht root-relative), damit die Seite sowohl per Doppelklick (`file://`) als auch über jeden Webserver funktioniert.

## Lokal ansehen

Einfach `index.html` im Browser öffnen. Für die volle Funktionalität (z. B. den dynamischen Hochamt-Kalender, der `data/hochaemter.csv` per `fetch()` lädt) wird ein lokaler Webserver empfohlen, da Browser `fetch()` auf `file://`-Ebene aus Sicherheitsgründen blockieren:

```bash
npx serve .
# oder
python -m http.server
```

## Hochämter pflegen

Alle Termine stehen in **`data/hochaemter.csv`** — einer Tabelle, die sich direkt in Excel öffnen und bearbeiten lässt. Eine Zeile ist ein Termin, die Website liest die Datei live:

| Spalte | Inhalt | Beispiel |
|---|---|---|
| Datum | TT.MM.JJJJ | 20.09.2026 |
| Uhrzeit | HH:MM | 11:00 |
| Anlass | Art des Termins | Hochamt, Christmette, Adventlichter |
| Werk | Komponist: Werk | W. A. Mozart: Piccolominimesse |
| Ort | Standard: Augustinerkirche | |
| Zelebrant, Dirigent, Chor, Orchester | Freitext | |
| Solisten, Organist, Weitere Musik | mehrere Einträge mit `|` trennen | Anna Muster (Sopran) \| Max Muster (Tenor) |
| Hinweis | Freitext | |

- **Startseite:** zeigt automatisch die nächsten drei Termine, mit Pfeil zur Hochamt-Seite.
- **Musik → Hochämter:** kommende Termine nach Monaten; jeder Termin führt zur Detailseite mit Zelebrant, Dirigent, Chor, Orchester, Solisten, Organist und weiterer Musik. Leere Spalten werden ausgeblendet.
- **Archiv:** Termine in der Vergangenheit erscheinen automatisch unter „Vergangene Hochämter“.

**In Excel speichern:** *Speichern unter → CSV UTF-8 (durch Trennzeichen getrennt)* und `data/hochaemter.csv` ersetzen. Alternativ die Datei über `pages/hochaemter-verwaltung.html` bearbeiten (Formular mit allen Spalten, CSV-Import und -Export). Die Seite ist bewusst nicht in der öffentlichen Navigation verlinkt.

## Inhaltliche Quellen

Texte und Bilder wurden, wo möglich, direkt von den offiziellen Seiten recherchiert und übernommen bzw. originalgetreu wiedergegeben:

- https://augustinerkirche.augustiner.at
- https://hochamt.augustiner.at
- https://aspersdorf.augustiner.at
- https://www.augustiner.at

## Lizenz

Kein offenes Lizenzmodell vorgesehen — Inhalte und Bilder gehören der Pfarre St. Augustin / dem Augustiner-Vikariat Wien bzw. den jeweiligen Bildquellen.
