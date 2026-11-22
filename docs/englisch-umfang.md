# Englische Fassung: Umfang

Stand 21.11.2026. Die Wortzahlen sind ausgezählt (sichtbarer Text, ohne Kopf- und Fußzeile) und gerundet. Als Faustregel gilt: Eine Fachübersetzung schafft etwa 2.000–3.000 Wörter pro Tag, eine Prüfung eines KI-Entwurfs etwa das Doppelte.

**Gesamt (alle öffentlichen Seiten): ca. 23.000 Wörter**, dazu Inhalte aus der Verwaltung (siehe C).
**Empfohlener Besucher-Bereich (Stufe 1): ca. 4.700 Wörter.**

---

## A. Seiten (fester Text im HTML)

Stufen: **1** = für englischsprachige Besucher wichtig · **2** = sinnvoll, wenn Zeit ist · **–** = bleibt deutsch

### Startseite und Allgemeines

| Seite / Abschnitt | Wörter | Stufe | Anmerkung |
|---|---:|:-:|---|
| Startseite `index.html` | 330 | 1 | „Heute“, „Nächstes Hochamt“ kommen aus Daten (siehe B) |
| Kontakt `pages/kontakt.html` | 240 | 1 | Adresse, Anfahrt, Öffnungszeiten |
| Kalender `pages/kalender.html` | 80 | 1 | Inhalt aus Daten |
| Hochamt-Detail `pages/hochamt.html` | 15 | 1 | Inhalt aus `hochaemter.csv` |
| Datenschutz | 930 | 2 | Kurzfassung auf Englisch reicht |
| Impressum | 400 | – | gesetzlich deutsch ausreichend |
| Neuigkeiten-Archiv | 25 | – | Meldungen bleiben deutsch |
| Offline-Seite | 30 | 1 | sehr kurz |

### Augustinerkirche `pages/augustinerkirche.html` (5.840)

| Abschnitt | Wörter | Stufe |
|---|---:|:-:|
| Einleitung | 80 | 1 |
| Geschichte | 490 | 1 |
| Herzgruft | 100 | 1 |
| Führungen | 160 | 1 |
| Kirchenrundgang | 620 | 1 |
| Gottesdienstzeiten | 60 | 1 |
| Pfarre | 250 | 2 |
| Sakramente | 1.180 | 2 |
| Pfarrkanzlei | 130 | 2 |
| Pfarrer / Mitbrüder | 2.020 | – |
| Pfarrgemeinderat | 400 | – |
| Seelsorger | 140 | – |
| Runden | 90 | – |
| Wiedereintritt | 110 | – |
| Predigten | 20 | – |

### Kirchenmusik `pages/musik.html` (4.320)

| Abschnitt | Wörter | Stufe |
|---|---:|:-:|
| Einleitung | 75 | 1 |
| Hochämter (aus Daten) | 30 | 1 |
| Chor | 150 | 1 |
| Kammerchor | 20 | 1 |
| Orchester | 100 | 1 |
| Orgeln | 220 | 1 |
| Rieger-Orgel `orgel-rieger.html` | 470 | 1 |
| Reil-Orgel `orgel-reil.html` | 310 | 1 |
| Patenschaft (Spenden) | 370 | 1 |
| Leitung | 430 | 2 |
| Organisten | 930 | 2 |
| CDs | 960 | 2 |
| Hochamt-Archiv | 80 | 2 |
| Gastdirigenten | 510 | – |
| Paten (Namensliste) | 400 | – |
| Repertoire, Solisten, Galerie | 60 | – |

### Die Augustiner `pages/augustiner.html` (6.090)

| Abschnitt | Wörter | Stufe |
|---|---:|:-:|
| Einleitung | 80 | 1 |
| Hl. Augustinus | 660 | 1 |
| Augustiner in Wien | 870 | 2 |
| Der Orden | 1.080 | 2 |
| Regel | 940 | 2 |
| Spiritualität | 240 | 2 |
| Bedeutende Augustiner | 660 | 2 |
| Ordensheilige | 270 | 2 |
| Papst Leo | 170 | 2 |
| Augustiner werden | 340 | 2 |
| Vikariat | 460 | – |
| Forschung | 160 | – |
| Links | 180 | – |

> Für die Ordensseiten gibt es oft schon offizielle englische Texte des Augustinerordens (OSA), die man übernehmen oder verlinken kann.

### Bleibt deutsch (Stufe –)

| Seite | Wörter |
|---|---:|
| Pfarre Aspersdorf `pages/aspersdorf.html` | 2.640 |
| Runden (8 Seiten unter `pages/runden/`) | 1.460 |

### Summen

| | Wörter |
|---|---:|
| Stufe 1 | ca. 4.700 |
| Stufe 2 | ca. 9.500 |
| bleibt deutsch | ca. 9.000 |

---

## B. Feste Texte in den Skripten (`js/`)

Knöpfe, Meldungen, Datumsangaben. Insgesamt ca. **450 kurze Texte**, meist 1–5 Wörter. Sie kommen in eine Übersetzungstabelle; das ist hauptsächlich Programmierarbeit.

| Datei | Texte | Inhalt |
|---|---:|---|
| `inhalte.js` | 95 | Inhalte aus Daten (Personen, Runden, Gottesdienste …) |
| `news.js` | 59 | Neuigkeiten |
| `suche.js` | 46 | Suche (Lupe) und Suchbegriffe |
| `main.js` | 43 | Menü, Cookie-Hinweis, Bildnachweise, Allgemeines |
| `hochamt-detail.js` | 34 | Hochamt-Seite |
| `hochaemter.js` | 32 | Hochamt-Liste |
| `hochaemter-data.js` | 26 | Monate, Wochentage, Datumsformat |
| `kalender-daten.js`, `kalender.js`, `woche.js` | 38 | Kalender |
| `thema.js` | 18 | Namen, Untertitel |
| `start-v2.js`, `hochaemter-start.js` | 23 | Startseite („Heute“, „Morgen“, „Jetzt“ …) |
| übrige | 32 | Lightbox, Instagram, Solisten, Statistik |

Nicht vergessen: `sw.js` / `offline.html`, `site.webmanifest` (App-Name), `sitemap.xml`, `robots.txt`.

---

## C. Inhalte aus der Verwaltung (`data/`)

Diese Texte werden laufend in der Verwaltung gepflegt. Für jede Zeile muss entschieden werden: **deutsch lassen** oder **englische Felder in der Verwaltung** (dann dauerhafter Mehraufwand für die Redaktion).

| Datei | Wörter | Vorschlag |
|---|---:|---|
| `gottesdienste.json` (Gottesdienstzeiten) | 130 | **englisch**: wenige feste Begriffe, z. B. „Heilige Messe“ → „Holy Mass“, per Tabelle ohne Mehraufwand |
| `wochenkalender.json` | 610 | Begriffe per Tabelle, Heiligennamen deutsch lassen |
| `kontakt.json` | 40 | englisch (einmalig) |
| `hinweise.json` (Wichtiger Hinweis) | 20 | optional englisches Feld |
| `hochaemter.csv` (105 Hochämter) | 6.180 | **deutsch lassen**: Werktitel und Namen sind ohnehin international; nur Spaltenbeschriftungen übersetzen |
| `repertoire.json` | 1.120 | deutsch lassen (Werktitel) |
| `cds.json` | 870 | deutsch lassen oder Stufe 2 |
| `personen.json` (Pfarrer, Organisten …) | 1.760 | deutsch lassen |
| `solisten.json` | 210 | deutsch lassen |
| `news.csv` + 19 Meldungen | 3.890 | **deutsch lassen** |
| Predigten (8) | – | deutsch lassen |
| `runden.json` | 1.510 | deutsch lassen |
| `paten.json` | 370 | deutsch lassen (Namen) |
| `rechtliches.json` (Impressum, Datenschutz) | 1.310 | siehe A |
| `sprueche.json` (Zitate) | 170 | optional: englische Augustinus-Zitate sind leicht zu finden |
| `startseite*.json` (Bildbeschreibungen) | 400 | Bildbeschreibungen für Vorleseprogramme, Stufe 2 |
| `pgr.json`, `pgr-aspersdorf.json`, `friedhof.json`, `aspersdorf-wochen.json` | 620 | deutsch lassen |
| `komponisten.json` | – | nur intern, keine Übersetzung |

---

## D. Technik (einmalig)

1. Englische Seiten unter `/en/` (z. B. `/en/index.html`, `/en/church.html`, `/en/music.html`) mit `lang="en"`.
2. `tools/seitenkopf.py`: englische Vorlage für Kopfzeile, Menü und Fußzeile, Umschalter **DE | EN**.
3. Übersetzungstabelle für die Skripte (B) und Erkennen der Sprache an `lang`.
4. `tools/seo.py`: `hreflang`-Verweise zwischen DE und EN, englische Seitenbeschreibungen, Sitemap ergänzen.
5. Cookie-Hinweis und Datenschutz-Kurzfassung auf Englisch.
6. `tools/paket.py` und die Suche (`suche.js`) um die englischen Seiten ergänzen.

---

## Offene Entscheidungen

- [ ] Nur Stufe 1, oder auch Stufe 2?
- [ ] Wer übersetzt bzw. prüft den Entwurf?
- [ ] Gottesdienstzeiten und Kalender mit englischen Begriffen (empfohlen), alles andere aus der Verwaltung deutsch?
- [ ] Englische Adressen (`/en/church.html`) oder gleiche Namen wie deutsch (`/en/augustinerkirche.html`)?
