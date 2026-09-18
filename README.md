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

[Lokal ansehen](#lokal-ansehen) &nbsp;&nbsp;·&nbsp;&nbsp; [Hochämter pflegen](#hochämter-pflegen) &nbsp;&nbsp;·&nbsp;&nbsp; [Aufbau](#aufbau) &nbsp;&nbsp;·&nbsp;&nbsp; [Gestaltung](#gestaltung)

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
  impressum.html              Impressum
  datenschutz.html            Datenschutzerklärung
  hochaemter-verwaltung.html  Internes Werkzeug für die Hochamt-Tabelle
  runden/                     Detailseiten je Pfarrgruppe
css/
  style.css                   Zentrales Stylesheet
js/
  main.js                     Navigation, Tabs, Hash-Routing, Einblend-Effekte
  hochaemter-data.js          Gemeinsames Modul: liest die CSV-Tabelle
  hochaemter.js               Kalender und Archiv auf der Musik-Seite
  hochaemter-start.js         Nächste Hochämter auf der Startseite
  hochamt-detail.js           Detailseite eines Hochamts
  hochaemter-verwaltung.js    Verwaltungsformular
  solisten.js                 Solistenliste
  instagram.js                Instagram-Bereich mit Fallback
data/
  hochaemter.csv              Alle Hochamt-Termine inkl. Mitwirkende
  solisten.json               Solistinnen und Solisten mit Stimmlage
assets/
  logo.png, img/              Logo und Bilder
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
