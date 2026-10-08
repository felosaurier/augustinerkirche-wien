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

[Lokal ansehen](#lokal-ansehen) &nbsp;&nbsp;·&nbsp;&nbsp; [Verwaltung](#verwaltung) &nbsp;&nbsp;·&nbsp;&nbsp; [Hochämter pflegen](#hochämter-pflegen) &nbsp;&nbsp;·&nbsp;&nbsp; [Neuigkeiten](#neuigkeiten-und-plakate-pflegen) &nbsp;&nbsp;·&nbsp;&nbsp; [Aufbau](#aufbau) &nbsp;&nbsp;·&nbsp;&nbsp; [Gestaltung](#gestaltung)

<br>

</div>

<br>

## Über das Projekt

Die Website der Pfarre und des Klosters St. Augustin in Wien: Gottesdienste, Sakramente, Geschichte der Augustinerkirche, die Kirchenmusik mit dem Hochamt-Programm sowie die Pfarre Aspersdorf. Sie ist bewusst schlicht gebaut — **statisches HTML, CSS und JavaScript ohne Build-Werkzeug** — und lässt sich auf jedem einfachen Webspace betreiben. Die Seite ist ausschließlich auf Deutsch.

## Seiten

| Seite | Inhalt |
|---|---|
| **Startseite** | Aktuelles, Identität von Pfarre und Kloster, Herzgruft, die nächsten Hochämter |
| **Kalender** | Alle Termine von St. Augustin: Hochämter und Konzerte, Termine der Runden, eigene Termine wie Ausflüge und Feste; Monatsblatt mit Punkten je Gruppe, Filter, im laufenden Monat ab heute |
| **Gottesdienste** | Liturgiezeiten, Wochenüberblick, Runden in St. Augustin |
| **Sakramente** | Taufe, Eucharistie, Firmung, Trauung, Wiedereintritt und mehr |
| **Kirchenmusik** | Hochämter und Archiv, Chor, Kammerchor, Repertoire des Chores (mit Suche), Orchester, Solisten, Organisten, Orgeln |
| **Hochamt (Detail)** | Zelebrant, Dirigent, Chor, Orchester, Solisten, Organist und weitere Musik je Termin |
| **Chronik** | Geschichte, Zeitstrahl, Herzgruft, Führungen, Augustinerorden, Mitbrüder |
| **Aspersdorf** | Pfarre, Pfarrkirche St. Georg, Sakramente, Pfarrfriedhof |
| **Runden** | Eigene Seiten für Bibelpur, Fensterblick, Fußwallfahrt, Ministranten und weitere Gruppen |
| **Impressum · Datenschutz** | Rechtliche Angaben |

## Verwaltung

Inhalte pflegst du am einfachsten in der **Verwaltung** unter **`admin/`** (z. B. `http://localhost:8123/admin/`). Sie ist im Stil der Website gestaltet, nicht in der öffentlichen Navigation verlinkt und nur mit **Benutzername und Passwort** erreichbar.

| Bereich | Was du dort machst |
|---|---|
| **Übersicht** | Stand aller Bereiche, nächstes Hochamt, neueste Meldung, „Noch offen“ (fehlende Angaben der nächsten sechs Wochen, Jahreswechsel) und die letzten Änderungen auf diesem Gerät |
| **Hochämter** | Termine nach Monaten, Suche, kommende und vergangene; bearbeiten im Fenster mit Vorschlägen aus bisherigen Einträgen, kopieren (eine Woche später), löschen; Excel-Tabelle herunterladen oder einlesen; Jahreswechsel per Knopf |
| **Neuigkeiten** | Meldungen mit Plakat oder Foto (Ziehen und Ablegen), Vorschau der Karte wie auf der Startseite, Hinweis ob Startseite oder Archiv |
| **Termine** | Eigene Termine für den Kalender: Ausflüge, Feste, Vorträge, Wallfahrten und andere; mit Uhrzeit, Ende, mehreren Tagen, Ort, Beschreibung und Link; kopieren für ein neues Datum. Hochämter und Runden-Termine kommen von selbst in den Kalender |
| **Gottesdienste** | Wochenplan (Liturgie-Zeiten und Wochenüberblick), dazu Öffnungszeiten der Pfarrkanzlei, Telefon, E-Mail und Adresse (Startseite, Impressum) |
| **Runden** | Übersicht der Runden (Reihenfolge, ein- und ausblenden) und je Runde die Seite: Kopf, Texte, Terminreihen mit Datumsauswahl (dazu Name, Uhrzeit und Ort für den Kalender), „Auf einen Blick“, Kontakt, Plakat oder Foto; neue Runden bekommen automatisch eine Seite |
| **Personen** | Mitbrüder, Leitung der Kirchenmusik, Gastdirigenten und Organisten mit Foto, Aufgabe und Text |
| **Solisten** | Liste für Kirchenmusik → Solisten: Foto (wird quadratisch zugeschnitten, Ausschnitt verschiebbar), Stimmlage, verstorben |
| **Paten** | Paten und Ehrenpaten für Kirchenmusik → Patenschaft: hinzufügen (am Ende oder ganz oben), ändern, verschieben, entfernen; die Paten erscheinen nummeriert in dieser Reihenfolge |
| **Repertoire** | Repertoire des Chores nach Komponisten, mit Werken und Hinweisen (z. B. Uraufführungen in der Augustinerkirche) |
| **Zugänge** | Nur für Admins: Zugang anlegen, Rolle, Name oder Passwort ändern, entfernen |

**Rollen:** *Admin* darf zusätzlich Zugänge verwalten, *Redaktion* pflegt alle Inhalte. Es gibt immer mindestens einen Admin; der erste Zugang aus der Ersteinrichtung ist Admin.

**Texte formatieren:** In Texten von Runden und Personen wird `[Text](pages/chronik.html)` zum Link, `*Wort*` kursiv; E-Mail- und https-Adressen werden automatisch verlinkt.

**Erster Aufruf:** Gibt es noch keinen Zugang, führt die Anmeldeseite durch die Ersteinrichtung: Projektordner verbinden, Namen und Passwort festlegen. Weitere Zugänge legst du danach unter „Zugänge“ an.

**Speichern:** In Chrome oder Edge am Computer einmal den **Projektordner verbinden**; die Verbindung gilt für alle Bereiche, nach einem Neustart des Browsers genügt ein Klick auf „Zugriff erlauben“. Dann landet jede Änderung sofort in der richtigen Datei, Bilder im richtigen Ordner. In anderen Browsern erscheint unten eine Leiste mit den geänderten Dateien zum Herunterladen und dem Ordner, in den sie gehören. Zum Veröffentlichen die Änderungen hochladen (commit und push).

**Sicherheit:** Die Zugänge stehen in `admin/zugaenge.json`, Passwörter nur als Prüfsumme (PBKDF2-SHA256 mit Salz, 600 000 Runden), nie im Klartext. Nach fünf falschen Versuchen gibt es eine Wartezeit, eine Sitzung endet nach vier Stunden ohne Aktivität. Weil die Website statisch ist, prüft der Browser das Passwort, nicht ein Server: Die Anmeldung hält Unbefugte von der Verwaltung fern, ist aber kein Ersatz für einen Server-Schutz. Ändern lässt sich die öffentliche Website ohnehin nur über den Projektordner. Das gilt auch für die Rollen: Sie steuern, was die Verwaltung anzeigt, ersetzen aber keine Rechte am Server. Wer zusätzlich absichern möchte, schützt den Ordner `admin/` am Webserver mit einem Passwort (z. B. `.htaccess` bei Apache) oder lädt ihn gar nicht erst hoch.

**Inhalte aus Datendateien:** Gottesdienste, Runden, Personen, Kontakt, Repertoire und Paten stehen in `data/*.json` und werden von `js/inhalte.js` auf die Seiten gezeichnet. Der Inhalt im HTML bleibt als Rückfall stehen, falls eine Datei einmal nicht geladen werden kann; maßgeblich sind die Datendateien.

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

**Archiv nach Jahren:** Die Termine von 2015 bis 2025 (übernommen von hochamt.augustiner.at, inklusive Zelebrant, Besetzung und Programm) liegen je Jahr in einer eigenen Datei: `data/archiv/hochaemter-JJJJ.csv`, mit gleichen Spalten wie `data/hochaemter.csv`. Ein Jahr wird auf der Seite „Vergangene Hochämter“ erst geladen, wenn man es anklickt, das hält die Startseite schnell. Die Liste der Archivjahre steht in `data/archiv/jahre.json` (je Jahr `{"jahr": 2025, "anzahl": 86}`, die Anzahl erscheint hochgestellt am Jahres-Reiter). Zum Jahreswechsel: In der Verwaltung unter „Hochämter“ erscheint ab Jänner ein Hinweis, ein Klick auf „Ins Archiv verschieben“ erledigt alles. Von Hand: die Zeilen des Vorjahres aus `hochaemter.csv` in eine neue Datei `data/archiv/hochaemter-JJJJ.csv` verschieben und das Jahr samt Anzahl in `jahre.json` eintragen (neuestes zuerst).

**In Excel speichern:** *Speichern unter → CSV UTF-8 (durch Trennzeichen getrennt)* und `data/hochaemter.csv` ersetzen.

Am bequemsten bearbeitest du die Liste in der [Verwaltung](#verwaltung) unter „Hochämter“.

## Neuigkeiten und Plakate pflegen

Alle Meldungen stehen in **[`data/news.csv`](data/news.csv)** — ebenfalls eine Excel-Tabelle. Eine Zeile ist eine Meldung:

| Spalte | Inhalt |
|---|---|
| Datum | Veröffentlichungsdatum, TT.MM.JJJJ (bestimmt die Reihenfolge) |
| Bis | Letzter Tag als aktive Meldung, TT.MM.JJJJ; danach rückt sie auf der Startseite nach unten bzw. ins Archiv. Leer = zwei Wochen ab dem Datum der Meldung (die Verwaltung trägt das beim Speichern ein) |
| Kategorie | z. B. Kirchenmusik, Konzert, Pfarrleben, Hochamt |
| Titel, Kurztext | erscheinen auf der Karte |
| Infos | Angaben im Fenster als `Bezeichnung: Wert`, mehrere mit <code>&#124;</code> trennen (z. B. `Zeit: 19:30 Uhr`) |
| Details | Absätze im Fenster, mehrere mit <code>&#124;</code> trennen |
| Plakat | ein Bild pro Meldung: erscheint als Vorschau auf der Karte (oberer Ausschnitt) und groß im Fenster |
| Vorschaubild | nur nötig, wenn es kein Plakat gibt (z. B. ein Foto); ohne beides erscheint das goldene Logo |
| Link, Linktext | optionale Schaltfläche im Fenster. In der Verwaltung wählt man das Ziel aus Listen (Hochamt oder Konzert, Runde, Seite der Website, andere Website) statt eine Adresse einzutippen; liegt am Enddatum ein Termin, wird er zum Verknüpfen vorgeschlagen. Ist eine Meldung mit einem Hochamt verknüpft (`pages/hochamt.html?id=…`), erscheint ihr Plakat auch auf der Seite dieses Termins. Die Verknüpfung lässt sich in der Meldung oder im Fenster des Termins wieder aufheben; wird ein Termin verschoben, zieht die Meldung mit |
| Weiterer Link, Weiterer Linktext | optionale zweite Schaltfläche, z. B. „Karten beim Musikverein“ zum Kartenverkauf; ist die Meldung mit einem Termin verknüpft, steht sie auch unter dem Plakat auf dessen Seite |

**Am einfachsten in der [Verwaltung](#verwaltung) unter „Neuigkeiten“:** Formular für Titel, Kurztext, Infos, Beschreibung, Link und Bild mit Vorschau der Karte, dazu eine Liste aller Meldungen zum Bearbeiten und Löschen. Mit verbundenem Projektordner werden `news.csv` und das Bild (automatisch im richtigen Jahresordner, in voller Größe) direkt gespeichert, sonst gibt es Downloads mit Angabe, wohin die Dateien gehören.

- **Startseite:** zeigt immer **3 Meldungen**: zuerst die neuesten, deren Enddatum („Bis“) noch nicht vorbei ist; gibt es weniger als 3 davon, wird unten mit den neuesten abgelaufenen aufgefüllt (in der Verwaltung als „Startseite · abgelaufen“ markiert). Darunter führt „Alle Meldungen“ ins Archiv. Ein Klick öffnet ein Fenster mit Plakat, Infos und Details.
- **Archiv** (`pages/archiv.html`): ältere und abgelaufene Meldungen wandern **automatisch** dorthin und sind **nach Jahren** geordnet.
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
  pfarre.html                 Pfarre, Pfarrer, Pfarrkanzlei, Pfarrgemeinderat, Seelsorger
  kalender.html               Kalender: alle Termine von St. Augustin
  gottesdienste.html          Liturgiezeiten, Wochenüberblick, Runden
  sakramente.html             Sakramente
  musik.html                  Kirchenmusik: Hochämter, Ensembles, Orgeln
  hochamt.html                Detailseite eines Hochamts
  chronik.html                Geschichte, Rundgang, Führungen, Orden, Links
  aspersdorf.html             Pfarre Aspersdorf
  archiv.html                 Archiv der Neuigkeiten, nach Jahren
  impressum.html              Impressum
  datenschutz.html            Datenschutzerklärung
  hochaemter-verwaltung.html  Weiterleitung zur neuen Verwaltung
  news-verwaltung.html        Weiterleitung zur neuen Verwaltung
  runden/                     Detailseiten je Pfarrgruppe; runde.html?id=… für neu angelegte Runden
admin/                        Verwaltung (nur mit Anmeldung)
  index.html                  Anmeldung und Ersteinrichtung
  uebersicht.html             Übersicht
  hochaemter.html             Hochämter pflegen
  neuigkeiten.html            Neuigkeiten und Plakate pflegen
  termine.html                Eigene Termine für den Kalender pflegen
  paten.html                  Paten der Kirchenmusik pflegen
  solisten.html               Solisten pflegen
  gottesdienste.html          Wochenplan, Pfarrkanzlei und Kontakt pflegen
  runden.html                 Runden pflegen
  personen.html               Mitbrüder, Leitung, Gastdirigenten, Organisten pflegen
  repertoire.html             Repertoire des Chores pflegen
  zugaenge.html               Zugänge und Rollen verwalten (nur Admin)
  zugaenge.json               Zugänge (Passwörter nur als Prüfsumme)
css/
  style.css                   Zentrales Stylesheet
  admin.css                   Zusätze für die Verwaltung
js/
  main.js                     Navigation, Tabs, Hash-Routing, Einblend-Effekte
  hochaemter-data.js          Gemeinsames Modul: CSV-Tabelle, HTML-Escaping, sichere Links
  hochaemter.js               Kalender und Archiv auf der Musik-Seite
  hochaemter-start.js         Nächste Hochämter auf der Startseite
  news.js                     Neuigkeiten: 3 Karten, Fenster mit Plakat, Jahresarchiv
  kalender.js                 Kalender: Hochämter, Runden und eigene Termine zusammengeführt
  lightbox.js                 Plakate vergrößern (Hintergrund unscharf)
  hochamt-detail.js           Detailseite eines Hochamts
  solisten.js                 Solistenliste
  hoerproben.js               Hörproben im CD-Katalog (immer nur eine Probe gleichzeitig)
  admin.js                    Verwaltung: Anmeldung, Kopfleiste, Projektordner, Speichern, Fenster
  admin-anmeldung.js          Anmeldung und Ersteinrichtung
  admin-uebersicht.js         Übersicht
  admin-hochaemter.js         Hochämter pflegen, Jahreswechsel
  admin-neuigkeiten.js        Neuigkeiten pflegen
  admin-termine.js            Termine für den Kalender pflegen
  admin-paten.js              Paten der Kirchenmusik pflegen
  admin-solisten.js           Solisten pflegen
  admin-gottesdienste.js      Wochenplan, Pfarrkanzlei und Kontakt
  admin-runden.js             Runden pflegen
  admin-personen.js           Personen pflegen
  admin-repertoire.js         Repertoire pflegen
  admin-zugaenge.js           Zugänge und Rollen verwalten
  inhalte.js                  Zeichnet Gottesdienste, Runden, Personen, Kontakt und Repertoire aus data/
  instagram.js                Instagram-Bereich mit Fallback (derzeit nicht auf der Startseite eingebunden)
data/
  hochaemter.csv              Hochamt-Termine ab dem laufenden Jahr inkl. Mitwirkende
  archiv/                     Hochamt-Archiv 2015–2025: hochaemter-JJJJ.csv je Jahr, jahre.json
  news.csv                    Neuigkeiten und Plakate
  termine.json                Eigene Termine für den Kalender (Ausflüge, Feste, Vorträge …)
  paten.json                  Paten und Ehrenpaten der Kirchenmusik
  solisten.json               Solistinnen und Solisten mit Stimmlage
  gottesdienste.json          Wochenplan der Gottesdienste
  runden.json                 Runden: Übersicht und Inhalt der Seiten
  personen.json               Mitbrüder, Leitung, Gastdirigenten, Organisten
  kontakt.json                Adresse, Telefon, E-Mail, Öffnungszeiten der Pfarrkanzlei
  repertoire.json             Repertoire des Chores
site.webmanifest              App-Manifest: Name, Farben, Symbole, Schnellzugriffe
assets/
  logo.png, logo-gold.png     Logo (grün und golden), Favicons, Zierlinie
  app/                        App-Symbole (192 und 512 Pixel, dazu maskierbar für Android)
  audio/cds/                  Hörproben zu den CDs (MP3, von hochamt.augustiner.at)
  programme/                  Kirchenmusik-Programmhefte 2008–2018 (PDF)
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
    cds/                      CD-Cover (WebP, 400 Pixel)
    news/2026/, 2027/ …       Plakate der Neuigkeiten, je Jahr ein Ordner
```

Alle Pfade sind **relativ**, die Seite funktioniert daher in jedem Unterverzeichnis eines Webservers.

**Sicherheit:** Jede Seite trägt im `<head>` eine Content-Security-Policy (nur eigene Skripte, keine Inline-Skripte). Inhalte aus den Tabellen werden vor der Ausgabe escaped, Links und Bildpfade nur mit `http(s)`, `mailto` oder als relativer Pfad übernommen. E-Mail-Adressen stehen nie im Klartext im Quelltext der Seiten: `HochamtData.mailHTML` (in `js/hochaemter-data.js`) legt sie rückwärts in `data-mail` ab, `js/main.js` macht beim Anzeigen wieder normale Links daraus; ohne JavaScript erscheint „name(at)domain(dot)at“. Neue Adressen in HTML-Seiten bitte ebenfalls so einbauen, in den Datendateien genügt die normale Schreibweise. Wird später ein Instagram-Endpunkt in `js/instagram.js` eingetragen, muss seine Adresse in der Richtlinie unter `connect-src` ergänzt werden.

## Gestaltung

Marine und Gold auf Weiß — klar, ruhig und festlich, passend zu einer Hofkirche.

| | |
|---|---|
| **Überschriften, Daten, Uhrzeiten** | Bodoni Moda, immer aufrecht (keine Kursiven in Überschriften), mit kleiner optischer Größe für kräftigere Haarlinien; Binde- und Gedankenstriche kommen aus einer Systemschrift, weil sie in der Bodoni nur Haarlinien sind |
| **Fließtext, Navigation, Knöpfe** | Hanken Grotesk, normale Schreibung (keine Versal-Labels) |
| **Farben** | Marineblau `#10192e` / `#1b2a4a` für Navigation, Kopfbereiche und Fußzeile · Gold `#8f6b25` auf Weiß, `#d8b96e` auf Marine · Weiß als Lesegrund |
| **Kopfbereich** | Im Querformat steht das Foto randlos rechts neben dem Titel, im Hochformat (Handy) randlos über die volle Breite oberhalb des Titels — keine Ornamente |
| **Stil** | Linien statt Kästen, keine Schatten außer bei Fenstern, nur eine Bewegung beim Laden (das Foto hebt sich) |
| **Zugänglichkeit** | Lesbare Kontraste, sichtbarer Tastaturfokus, Sprunglink zum Inhalt, Menüs per Tastatur (Escape schließt), reduzierte Bewegung wird respektiert |
| **Geräte** | Für Handy im Hochformat, Tablet und Desktop ausgelegt; Bilder werden nicht beschnitten |
| **Menü** | Gepflegt wird nur das Laptop-Menü (`nav-center` in jeder Seite); das Handy-Menü baut `js/main.js` daraus: oben Gottesdienste, Kalender und Kontakt, darunter die Bereiche zum Aufklappen |
| **Reiter einer Unterseite** | Am Laptop als Liste links; auf Handy und Tablet als fixierte Leiste, die den geöffneten Bereich nennt und alle Bereiche aufklappt. Am Ende jedes Bereichs führen „Zurück“ und „Weiter“ durch die Seite |

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
