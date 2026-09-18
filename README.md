<div align="center">

<br>

<img src="assets/logo-gold.png" alt="Goldenes Logo der Augustinerkirche Wien" width="130"/>

<br>

# Augustinerkirche Wien

<sub>P F A R R E &nbsp; & &nbsp; K L O S T E R &nbsp;&nbsp; S T .&nbsp; A U G U S T I N</sub>

<br>

<img src="assets/divider-gold.svg" alt="" width="300"/>

<br>

*Hofpfarrkirche der Habsburger — Heimat der Wiener Kirchenmusik*

<br>

[Lokal ansehen](#lokal-ansehen) &nbsp;&nbsp;·&nbsp;&nbsp; [Hochämter pflegen](#hochämter-pflegen) &nbsp;&nbsp;·&nbsp;&nbsp; [Neuigkeiten](#neuigkeiten-und-plakate-pflegen) &nbsp;&nbsp;·&nbsp;&nbsp; [Aufbau](#aufbau) &nbsp;&nbsp;·&nbsp;&nbsp; [Gestaltung](#gestaltung)

<br>

</div>

<br>

## Über das Projekt

Die Website der Pfarre und des Klosters St. Augustin in Wien: Gottesdienste, Sakramente, Geschichte der Augustinerkirche, die Kirchenmusik mit dem Hochamt-Programm sowie die Pfarre Aspersdorf. Sie ist bewusst schlicht gebaut — **statisches HTML, CSS und JavaScript ohne Build-Werkzeug** — und lässt sich auf jedem einfachen Webspace betreiben. Die Seite ist ausschließlich auf Deutsch.

## Seiten

| Seite | Inhalt |
|---|---|
| **Startseite** | Aktuelles, Identität von Pfarre und Kloster, Herzgruft, die nächsten Hochämter |
| **Gottesdienste** | Liturgiezeiten, Wochenüberblick, Runden in St. Augustin |
| **Sakramente** | Taufe, Eucharistie, Firmung, Trauung, Wiedereintritt und mehr |
| **Kirchenmusik** | Hochämter und Archiv, Chor, Kammerchor, Orchester, Solisten, Organisten, Orgeln |
| **Hochamt (Detail)** | Zelebrant, Dirigent, Chor, Orchester, Solisten, Organist und weitere Musik je Termin |
| **Chronik** | Geschichte, Zeitstrahl, Herzgruft, Führungen, Augustinerorden, Mitbrüder |
| **Aspersdorf** | Pfarre, Pfarrkirche St. Georg, Sakramente, Pfarrfriedhof |
| **Runden** | Eigene Seiten für Bibelpur, Fensterblick, Fußwallfahrt, Ministranten und weitere Gruppen |
| **Impressum · Datenschutz** | Rechtliche Angaben |

## Hochämter pflegen

Alle Termine stehen in **[`data/hochaemter.csv`](data/hochaemter.csv)** — einer Tabelle, die sich direkt in Excel öffnen und bearbeiten lässt. Eine Zeile ist ein Termin, die Website liest die Datei live.

| Spalte | Inhalt | Beispiel |
|---|---|---|
| Datum | TT.MM.JJJJ | `20.09.2026` |
| Uhrzeit | HH:MM | `11:00` |
| Anlass | Art des Termins | `Hochamt`, `Christmette`, `Adventlichter` |
| Werk | Komponist: Werk | `W. A. Mozart: Piccolominimesse` |
| Ort | Standard: Augustinerkirche | |
| Zelebrant, Dirigent, Chor, Orchester | Freitext | |
| Solisten, Organist, Weitere Musik | mehrere Einträge mit <code>&#124;</code> trennen | `Anna Muster (Sopran) \| Max Muster (Tenor)` |
| Hinweis | Freitext | |

**Was daraus entsteht**

- **Startseite:** die nächsten drei Termine, mit Pfeil zur Hochamt-Seite.
- **Kirchenmusik → Hochämter:** kommende Termine nach Monaten. Jeder Termin führt zur Detailseite; leere Spalten werden dort ausgeblendet.
- **Archiv:** vergangene Termine erscheinen automatisch unter „Vergangene Hochämter“.

**In Excel speichern:** *Speichern unter → CSV UTF-8 (durch Trennzeichen getrennt)* und `data/hochaemter.csv` ersetzen.

Alternativ bearbeitest du die Liste komfortabel im Browser über `pages/hochaemter-verwaltung.html` (Formular mit allen Spalten, CSV-Import und -Export). Die Seite ist bewusst nicht in der Navigation verlinkt.

## Neuigkeiten und Plakate pflegen

Alle Meldungen stehen in **[`data/news.csv`](data/news.csv)** — ebenfalls eine Excel-Tabelle. Eine Zeile ist eine Meldung:

| Spalte | Inhalt |
|---|---|
| Datum | Veröffentlichungsdatum, TT.MM.JJJJ (bestimmt die Reihenfolge) |
| Kategorie | z. B. Kirchenmusik, Konzert, Pfarrleben, Hochamt |
| Titel, Kurztext | erscheinen auf der Karte |
| Infos | Angaben im Fenster als `Bezeichnung: Wert`, mehrere mit <code>&#124;</code> trennen (z. B. `Zeit: 19:30 Uhr`) |
| Details | Absätze im Fenster, mehrere mit <code>&#124;</code> trennen |
| Plakat | ein Bild pro Meldung: erscheint als Vorschau auf der Karte (oberer Ausschnitt) und groß im Fenster |
| Vorschaubild | nur nötig, wenn es kein Plakat gibt (z. B. ein Foto); ohne beides erscheint das goldene Logo |
| Link, Linktext | optionale Schaltfläche im Fenster |

**Am einfachsten über die Verwaltungsseite** `pages/news-verwaltung.html` (nicht in der Navigation verlinkt): Formular für Titel, Kurztext, Infos, Beschreibung, Link und Bild, dazu eine Liste aller Meldungen zum Bearbeiten und Entfernen. In Chrome oder Edge einmal den Projektordner verbinden, dann werden `news.csv` und das Bild (automatisch im richtigen Jahresordner, in voller Größe) direkt gespeichert. In anderen Browsern gibt es Downloads mit Anleitung, wohin die Dateien gehören.

- **Startseite:** zeigt immer die **6 neuesten** Meldungen. Ein Klick öffnet ein Fenster mit Plakat, Infos und Details.
- **Archiv** (`pages/archiv.html`): alle älteren Meldungen wandern **automatisch** dorthin und sind **nach Jahren** geordnet.
- Jede Meldung hat einen eigenen Link, z. B. `index.html?news=…`, der das Fenster direkt öffnet.
- **Neues Plakat:** Bild als WebP in den **Jahresordner** legen, passend zum Datum der Meldung: Plakate von 2026 nach `assets/img/news/2026/`, Plakate von 2027 nach `assets/img/news/2027/` usw. Dann eine Zeile in `news.csv` ergänzen und dort den Pfad eintragen, z. B. `assets/img/news/2026/bibelpur-2026-27.webp`. Ein Bild reicht, die Vorschau wird automatisch zugeschnitten.

## Lokal ansehen

Damit der Hochamt-Kalender seine Tabelle laden kann, braucht die Seite einen lokalen Webserver (Browser blockieren `fetch()` bei direkt geöffneten Dateien):

```bash
python -m http.server 8123
```

Danach im Browser `http://localhost:8123` öffnen.

## Aufbau

```
index.html                    Startseite
pages/
  gottesdienste.html          Liturgiezeiten, Wochenüberblick, Runden
  sakramente.html             Sakramente
  musik.html                  Kirchenmusik: Hochämter, Ensembles, Orgeln
  hochamt.html                Detailseite eines Hochamts
  chronik.html                Geschichte, Zeitstrahl, Orden
  aspersdorf.html             Pfarre Aspersdorf
  archiv.html                 Archiv der Neuigkeiten, nach Jahren
  impressum.html              Impressum
  datenschutz.html            Datenschutzerklärung
  hochaemter-verwaltung.html  Internes Werkzeug für die Hochamt-Tabelle
  news-verwaltung.html        Internes Werkzeug: Neuigkeiten und Plakate anlegen
  runden/                     Detailseiten je Pfarrgruppe
css/
  style.css                   Zentrales Stylesheet
js/
  main.js                     Navigation, Tabs, Hash-Routing, Einblend-Effekte
  hochaemter-data.js          Gemeinsames Modul: liest die CSV-Tabelle
  hochaemter.js               Kalender und Archiv auf der Musik-Seite
  hochaemter-start.js         Nächste Hochämter auf der Startseite
  news.js                     Neuigkeiten: 6 Karten, Fenster mit Plakat, Jahresarchiv
  news-verwaltung.js          Verwaltungsseite für Neuigkeiten
  lightbox.js                 Plakate vergrößern (Hintergrund unscharf)
  hochamt-detail.js           Detailseite eines Hochamts
  hochaemter-verwaltung.js    Verwaltungsformular
  solisten.js                 Solistenliste
  instagram.js                Instagram-Bereich mit Fallback
data/
  hochaemter.csv              Alle Hochamt-Termine inkl. Mitwirkende
  news.csv                    Neuigkeiten und Plakate
  solisten.json               Solistinnen und Solisten mit Stimmlage
assets/
  logo.png, logo-gold.png     Logo (grün und golden), Favicons, Zierlinie
  img/
    kirche/                   Außen- und Innenansichten, Altäre, Loretokapelle, Titelbilder
    orgeln/                   Rieger- und Reil-Orgel
    musik/                    Chor und Orchester
    personen/
      patres/                 Mitbrüder der Augustiner
      dirigenten/             Kirchenmusikdirektor und Gastdirigenten
      organisten/             Organisten
      solisten/               Solistinnen und Solisten
      historisch/             Hl. Augustinus
    runden/                   Bilder der Pfarrgruppen
    aspersdorf/               Pfarrkirche St. Georg
    news/2026/, 2027/ …       Plakate der Neuigkeiten, je Jahr ein Ordner
```

Alle Pfade sind **relativ**, die Seite funktioniert daher in jedem Unterverzeichnis eines Webservers.

## Gestaltung

Klassisch, ruhig und festlich — passend zu einer Hofkirche.

| | |
|---|---|
| **Überschriften** | Cormorant Garamond, feine Serifenschrift |
| **Fließtext** | Source Sans 3 |
| **Logo-Schriftzug** | Playfair Display SC |
| **Farben** | Marineblau `#1b2a4a` · Gold `#8f6b25` · Elfenbein `#faf8f3` |
| **Stil** | Feine Linien statt Schatten, zurückhaltende Übergänge, Goldakzente |
| **Zugänglichkeit** | Lesbare Kontraste, sichtbarer Tastaturfokus, reduzierte Bewegung wird respektiert |
| **Geräte** | Für Handy im Hochformat, Tablet und Desktop ausgelegt; Bilder werden nicht beschnitten |

## Vor dem Veröffentlichen

Im **Impressum** und in der **Datenschutzerklärung** sind gelb markierte Stellen in eckigen Klammern zu ergänzen, etwa Rechtsform, Registernummer, Hosting-Anbieter und Datenschutz-Kontakt. Beide Texte sollten von der Pfarre bzw. dem Vikariat geprüft werden.

## Quellen

Texte und Bilder wurden, wo möglich, von den offiziellen Seiten übernommen:

[augustinerkirche.augustiner.at](https://augustinerkirche.augustiner.at) &nbsp;·&nbsp; [hochamt.augustiner.at](https://hochamt.augustiner.at) &nbsp;·&nbsp; [aspersdorf.augustiner.at](https://aspersdorf.augustiner.at) &nbsp;·&nbsp; [augustiner.at](https://www.augustiner.at)

## Lizenz

Kein offenes Lizenzmodell. Inhalte und Bilder gehören der Pfarre St. Augustin bzw. dem Augustiner-Vikariat Wien und den jeweiligen Bildquellen.

<br>

<div align="center">

<img src="assets/divider-gold.svg" alt="" width="300"/>

<br>

<img src="assets/logo-gold.png" alt="" width="48"/>

<sub>Augustinerstraße 3 · 1010 Wien · © Augustiner-Vikariat Wien</sub>

</div>
