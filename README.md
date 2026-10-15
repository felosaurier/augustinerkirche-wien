<div align="center">

<img src="docs/readme-banner.svg" alt="Augustinerkirche Wien – Pfarre und Kloster St. Augustin" width="100%"/>

<br>

[Lokal ansehen](#lokal-ansehen) &nbsp;&nbsp;·&nbsp;&nbsp; [Verwaltung](#verwaltung) &nbsp;&nbsp;·&nbsp;&nbsp; [Hochämter pflegen](#hochämter-pflegen) &nbsp;&nbsp;·&nbsp;&nbsp; [Neuigkeiten](#neuigkeiten-und-plakate-pflegen) &nbsp;&nbsp;·&nbsp;&nbsp; [Aufbau](#aufbau) &nbsp;&nbsp;·&nbsp;&nbsp; [Gestaltung](#gestaltung)

<br>

</div>

<br>

## Auf einen Blick

| | |
|---|---|
| **Technik** | Statisches HTML, CSS und JavaScript. Kein Build, kein Framework, kein Backend. |
| **Inhalte** | Tabellen und Dateien in `data/`, gepflegt in der Verwaltung (`admin/`) oder direkt in Excel. |
| **Ansehen** | `python -m http.server 8123`, dann `http://localhost:8123` |
| **Verwaltung** | `http://localhost:8123/admin/`, speichert in den Projektordner oder, auf einem Server, direkt dort. |
| **Veröffentlichen** | Per Git (`commit` und `push`) oder als Paket für nginx und Apache: `python tools/paket.py --verwaltung`. |
| **Gestaltung** | Marine und Gold auf Weiß, Calibri, für Handy, Tablet und Laptop. |

## Über das Projekt

Die Website der Pfarre und des Klosters St. Augustin in Wien: Gottesdienste, Sakramente, Geschichte der Augustinerkirche, die Kirchenmusik mit dem Hochamt-Programm sowie die Pfarre Aspersdorf. Sie ist bewusst schlicht gebaut — **statisches HTML, CSS und JavaScript ohne Build-Werkzeug** — und lässt sich auf jedem einfachen Webspace betreiben. Die Seite ist ausschließlich auf Deutsch.

## Seiten

| Seite | Inhalt |
|---|---|
| **Startseite** | Aktuelles, Identität von Pfarre und Kloster, Herzgruft, die nächsten Hochämter |
| **Kalender** | Alle Termine von St. Augustin: Hochämter (Kreuz, Gold) getrennt von den Gottesdiensten (Heilige Messen, Kreis, Bordeaux), Konzerte, die regelmäßigen Messen aus dem Wochenplan (ein Jahr voraus; ausgefallene bleiben durchgestrichen stehen), Termine der Runden, eigene Termine wie Ausflüge und Feste; Monatsblatt mit Punkten je Gruppe, Filter, im laufenden Monat ab heute. Umschaltbar auf den **Wochenüberblick** (`kalender.html#woche`, im Menü unter Kalender): eine Kalenderwoche mit allen sieben Tagen, Woche per Pfeil wählen (vier Wochen zurück, ein Jahr voraus, „Zur aktuellen Woche“), Filter nach Wochentag |
| **Gottesdienste** | Liturgiezeiten, Runden in St. Augustin |
| **Sakramente** | Taufe, Eucharistie, Firmung, Trauung, Wiedereintritt und mehr |
| **Kirchenmusik** | Hochämter und Archiv, Chor, Kammerchor, Repertoire des Chores (mit Suche), Orchester, Solisten, Organisten, Orgeln |
| **Hochamt (Detail)** | Zelebrant, Dirigent, Chor, Orchester, Solisten, Organist und weitere Musik je Termin |
| **Chronik** | Geschichte, Zeitstrahl, Herzgruft, Führungen, Augustinerorden, Mitbrüder |
| **Aspersdorf** | Pfarre, Pfarrkirche St. Georg, Sakramente, Pfarrfriedhof |
| **Runden** | Eigene Seiten für Bibelpur, Fensterblick, Fußwallfahrt, Ministranten und weitere Gruppen |
| **Impressum · Datenschutz** | Rechtliche Angaben |

## Verwaltung

Inhalte pflegst du am einfachsten in der **Verwaltung** unter **`admin/`** (z. B. `http://localhost:8123/admin/`). Sie ist im Stil der Website gestaltet, nicht in der öffentlichen Navigation verlinkt und nur mit **Benutzername und Passwort** erreichbar.

**Aufbau der Verwaltung** (Reiter oben, darunter die Unterpunkte; jede Person sieht nur, was sie bearbeiten darf):
Übersicht · **Neuigkeiten** · **Termine** · **Hochämter** (häufig gebraucht) · **Inhalte** (Pfarre & Kloster: Regelmäßige Termine, Wochenkalender, Runden, Pfarrkanzlei & Kontakt, Kirchenrundgang, Pfarrgemeinderat, Mitbrüder; Kirchenmusik: Solisten, Repertoire, Leitung & Organisten, Paten, CDs) · **Einstellungen** (Titelfotos, Hinweisbanner, Sprüche, Farben & Logo, Impressum & Datenschutz, Zugänge, Änderungen, Mitteilungen). Oben rechts: Mein Profil, Website, Abmelden.

| Bereich | Was du dort machst |
|---|---|
| **Übersicht** | Alle Bereiche als Kacheln, geordnet wie die Reiter (Häufig gebraucht, Inhalte · Pfarre & Kloster, Inhalte · Kirchenmusik, Einstellungen), mit Stand und Schnellzugriff „neu anlegen“; „Noch offen“ (fehlende Angaben der nächsten sechs Wochen, Jahreswechsel) und „Zuletzt geändert“ (auf diesem Gerät, je Eintrag aufklappbar, was sich genau geändert hat) |
| **Hochämter** | Fotos je Termin (mehrere, mit Beschreibung und Bildnachweis; erscheinen neben dem Programm, wo sonst das Plakat steht; gibt es ein Plakat, stehen sie darunter); Termine nach Monaten, Suche, kommende und vergangene; bearbeiten im Fenster mit Vorschlägen aus bisherigen Einträgen, kopieren (eine Woche später), löschen; Excel-Tabelle herunterladen oder einlesen; Jahreswechsel per Knopf |
| **Titelfotos** (Einstellungen) | Titelfotos im Vollbild-Start der vier Hauptseiten, oben das Thema wählen (Augustinerkirche = Startseite, Kirchenmusik, Augustiner, Aspersdorf; Fotos der anderen Themen lassen sich wieder verwenden): Fotos hinzufügen, ersetzen, entfernen, Reihenfolge per Pfeil, Ausschnitt ziehen, Bildnachweis. Bei mehreren Fotos wechseln sie nacheinander (Wechselzeit einstellbar; ein Klick aufs Foto zeigt Pfeile links und rechts zum Blättern und pausiert den Wechsel; bei „reduzierte Bewegung“ im System bleibt das erste Foto stehen) |
| **Neuigkeiten** | Meldungen mit Plakat oder Foto (Ziehen und Ablegen), Vorschau der Karte wie auf der Startseite, Hinweis ob Startseite oder Archiv |
| **Termine** | Eigene Termine für den Kalender: Ausflüge, Feste, Vorträge, Wallfahrten und andere; mit Uhrzeit, Ende, mehreren Tagen, Ort, Beschreibung und Link; kopieren für ein neues Datum. Hochämter und Runden-Termine kommen von selbst in den Kalender; derselbe Termin an mehreren Tagen auf einmal (Weitere Tage) |
| **Regelmäßige Termine** | Alles, was jede Woche gleich ist: Messen, Tagzeitenliturgie, Kanzleistunden, die Führung nach dem Hochamt (je Termin Wochentag, Uhrzeit oder „anschließend“, Kategorie im Kalender: Gottesdienst, Veranstaltung oder keine; optional „Gilt von … bis …“ Monat; Gottesdienste auch unter Liturgie-Zeiten); „Ferien & Pausen“ (Zeitraum und die Wochentage, an denen in dieser Zeit nichts stattfindet); „Entfällt“ (fällt an einem Tag etwas aus, bleibt es im Kalender durchgestrichen mit Grund stehen) |
| **Wochenkalender** | Vorschau des gedruckten Wochenkalenders, Woche für Woche: zeigt alles aus dem Kalender (regelmäßige Termine, Hochämter, Runden, eigene Termine). Dazu trägst du die Einzelheiten der Woche ein: je Tag Tagesbezeichnung und Heilige, je Termin Zelebrant, Musik, Ort und Hinweis, und Termine, die es sonst nicht gibt. Ein Termin, der nicht stattfindet, „entfällt“: er steht nicht im Wochenkalender und ist in der Verwaltung durchgestrichen (kein Löschen und Kopieren). Gespeichert in `data/wochenkalender.json`; ein Eintrag ersetzt den Termin des Kalenders um dieselbe Uhrzeit und behält dessen Link |
| **Pfarrkanzlei & Kontakt** | Öffnungszeiten der Pfarrkanzlei, Telefon, E-Mail und Adresse (Startseite, Impressum) |
| **Impressum & Datenschutz** (Einstellungen) | Impressum und Datenschutzerklärung Abschnitt für Abschnitt: Überschrift, Text mit Werkzeugleiste (fett, Link, Telefon, Liste, Tabelle, Zwischentitel, „fehlt noch“), Reihenfolge, Vorschau je Abschnitt und der ganzen Seite |
| **Änderungen** (nur Entwickler, oben rechts) | Alle Änderungen von allen Personen als Tabelle: Zeitpunkt, Person, Bereich, was genau (vorher → nachher), Suche und Filter, Export als CSV. Quelle ist `admin/protokoll.json`, das bei jedem Speichern mitgeschrieben wird (mit Projektordner oder auf dem Server) |
| **Runden** | Übersicht der Runden (Reihenfolge, ein- und ausblenden) und je Runde die Seite: Kopf, Texte, Terminreihen mit Datumsauswahl (dazu Name, Uhrzeit und Ort für den Kalender), „Auf einen Blick“, Kontakt, Plakat oder Foto; neue Runden bekommen automatisch eine Seite |
| **Pfarrgemeinderat** | Mitglieder sowie Ersatzmitglieder und weitere Verantwortliche für Pfarre → Pfarrgemeinderat: Name, Funktion, Beruf, Aufgaben, E-Mail, Telefon, Foto (mit Bildnachweis); Reihenfolge per Pfeil |
| **Personen** | Mitbrüder, Leitung der Kirchenmusik, Gastdirigenten und Organisten mit Foto, Aufgabe und Text |
| **Solisten** | Liste für Kirchenmusik → Solisten: Foto (wird quadratisch zugeschnitten, Ausschnitt verschiebbar), Stimmlage, verstorben |
| **Bildnachweise** | Kein eigener Bereich: bei jedem Bild (Personen, Solisten, Runden, Neuigkeiten, CDs, Pfarrgemeinderat) gibt es ein Feld „Bildnachweis“. Auf der Website steht er klein unter dem Bild, bei Titelfotos unten in der Ecke; gespeichert in `data/bildnachweise.json` |
| **Paten** | Paten und Ehrenpaten für Kirchenmusik → Patenschaft: hinzufügen (am Ende oder ganz oben), ändern, verschieben, entfernen; die Paten erscheinen nummeriert in dieser Reihenfolge |
| **CDs** | Aufnahmen für Kirchenmusik → CDs: Titel, Gruppe, Werke, Mitwirkende, Leitung, Cover (mit Bildnachweis) und Hörproben als MP3, beides zum Hineinziehen; verschieben, löschen |
| **Repertoire** | Repertoire des Chores nach Komponisten, mit Werken und Hinweisen (z. B. Uraufführungen in der Augustinerkirche) |
| **Zugänge** | Nur für Admins: Zugang anlegen, Rolle, Name oder Passwort ändern, entfernen |

**Rollen und Rechte:** *Admin* darf alles und zusätzlich Zugänge verwalten. Eine *Redaktion* pflegt nur, was ihr unter „Zugänge“ erlaubt wird: einzelne Bereiche (Neuigkeiten, Hochämter, Solisten …) und entweder alle Runden oder nur bestimmte. Menü, Übersicht und Seiten zeigen dann nur diese Bereiche; andere Seiten leiten zur Übersicht um. Zugänge aus der Zeit vor den Rechten dürfen weiterhin alles. Es gibt immer mindestens einen Admin; der erste Zugang aus der Ersteinrichtung ist Admin.

**Texte formatieren:** In Texten von Runden und Personen wird `[Text](pages/chronik.html)` zum Link, `*Wort*` kursiv; E-Mail- und https-Adressen werden automatisch verlinkt.

**Erster Aufruf:** Gibt es noch keinen Zugang, führt die Anmeldeseite durch die Ersteinrichtung: Projektordner verbinden, Namen und Passwort festlegen. Weitere Zugänge legst du danach unter „Zugänge“ an.

**Speichern:** In Chrome oder Edge am Computer einmal den **Projektordner verbinden**; die Verbindung gilt für alle Bereiche, nach einem Neustart des Browsers genügt ein Klick auf „Zugriff erlauben“. Dann landet jede Änderung sofort in der richtigen Datei, Bilder im richtigen Ordner. In anderen Browsern erscheint unten eine Leiste mit den geänderten Dateien zum Herunterladen und dem Ordner, in den sie gehören. Zum Veröffentlichen die Änderungen hochladen (commit und push). **Schutz vor Überschreiben:** Wurde eine Datei seit dem Laden woanders geändert (Excel, ein anderer Tab, ein Git-Update), speichert die Verwaltung nicht darüber, sondern bittet, die Seite neu zu laden. Ließ sich eine Datei beim Laden nicht lesen oder ist sie kaputt, wird sie nicht überschrieben. Ist eine Datei noch in Excel geöffnet, nennt die Meldung die Datei. **Liegt die Verwaltung auf einem Webserver, der Änderungen annimmt (Server-Modus, siehe „Auf einen Webserver stellen“), gibt es keinen Projektordner:** oben steht „Mit dem Server verbunden“, und jede Änderung wird direkt dort gespeichert.

**Sicherheit:** Die Zugänge stehen in `admin/zugaenge.json`, Passwörter nur als Prüfsumme (PBKDF2-SHA256 mit Salz, 600 000 Runden), nie im Klartext. Ein Passwort braucht mindestens 12 Zeichen und darf den Benutzernamen nicht enthalten; der Vorschlag („Sicheres Passwort vorschlagen“) ist länger und erfüllt das immer. Nach fünf falschen Versuchen gibt es eine Wartezeit, eine Sitzung endet nach vier Stunden ohne Aktivität. Die Verwaltung lässt sich nicht in einem fremden Rahmen (iframe) öffnen. Excel-Dateien aus der Verwaltung sind gegen „CSV-Injection“ geschützt: Texte, die mit `=`, `+`, `-` oder `@` beginnen, bekommen ein Leerzeichen davor und werden so nie als Formel ausgeführt. Weil die Website statisch ist, prüft der Browser das Passwort, nicht ein Server: Die Anmeldung hält Unbefugte von der Verwaltung fern, ist aber kein Ersatz für einen Server-Schutz. Ändern lässt sich die öffentliche Website ohnehin nur über den Projektordner oder, im Server-Modus, über den Webserver (dort schützt die Anmeldung am Server, siehe unten). Das gilt auch für die Rollen: Sie steuern, was die Verwaltung anzeigt, ersetzen aber keine Rechte am Server. Wer zusätzlich absichern möchte, schützt den Ordner `admin/` am Webserver mit einem Passwort (z. B. `.htaccess` bei Apache) oder lädt ihn gar nicht erst hoch: Liegt `admin/zugaenge.json` öffentlich im Netz, kann jeder die Prüfsummen herunterladen und offline Passwörter durchprobieren (bei langen Passwörtern aussichtslos, bei kurzen nicht).

**Empfohlene Server-Einstellungen** (bei einer statischen Seite nur dort möglich, nicht im HTML): die Antwortköpfe `Content-Security-Policy: frame-ancestors 'none'` (verhindert das Einbetten der Seiten in fremde Rahmen), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` und `Strict-Transport-Security` (nur über https). Die übrige Richtlinie steht schon in jeder Seite.

**Inhalte aus Datendateien:** Gottesdienste, Runden, Personen, Kontakt, Repertoire, Paten, CDs und Pfarrgemeinderat stehen in `data/*.json` und werden von `js/inhalte.js` auf die Seiten gezeichnet. Der Inhalt im HTML bleibt als Rückfall stehen, falls eine Datei einmal nicht geladen werden kann; maßgeblich sind die Datendateien.

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
| Bildausschnitt | optional, z. B. `50% 20%`: welcher Teil des Bildes auf der Karte zu sehen ist; wird in der Verwaltung durch Ziehen des Bildes in der Vorschau gesetzt |

**Am einfachsten in der [Verwaltung](#verwaltung) unter „Neuigkeiten“:** Formular für Titel, Kurztext, Infos, Beschreibung, Link und Bild mit Vorschau der Karte, dazu eine Liste aller Meldungen zum Bearbeiten und Löschen. Mit verbundenem Projektordner werden `news.csv` und das Bild (automatisch im richtigen Jahresordner, in voller Größe) direkt gespeichert, sonst gibt es Downloads mit Angabe, wohin die Dateien gehören.

- **Startseite:** zeigt immer **4 Meldungen** (am Laptop nebeneinander, auf kleineren Bildschirmen 2 × 2, am Handy untereinander): zuerst die neuesten, deren Enddatum („Bis“) noch nicht vorbei ist; gibt es weniger als 4 davon, wird unten mit den neuesten abgelaufenen aufgefüllt (in der Verwaltung als „Startseite · abgelaufen“ markiert). Darunter führt „Alle Meldungen“ ins Archiv. Ein Klick öffnet ein Fenster mit Plakat, Infos und Details.
- **Archiv** (`pages/archiv.html`): ältere und abgelaufene Meldungen wandern **automatisch** dorthin und sind **nach Jahren** geordnet.
- Jede Meldung hat einen eigenen Link, z. B. `index.html?news=…`, der das Fenster direkt öffnet.
- **Neues Plakat:** Bild als WebP in den **Jahresordner** legen, passend zum Datum der Meldung: Plakate von 2026 nach `assets/img/news/2026/`, Plakate von 2027 nach `assets/img/news/2027/` usw. Dann eine Zeile in `news.csv` ergänzen und dort den Pfad eintragen, z. B. `assets/img/news/2026/bibelpur-2026-27.webp`. Ein Bild reicht, die Vorschau wird automatisch zugeschnitten.

## Cookies und Besucherstatistik

Die Seiten setzen von sich aus **keine Cookies**. Für eine Besucherstatistik ist **Google Analytics 4** vorbereitet, aber ausgeschaltet, solange in [`js/statistik.js`](js/statistik.js) keine Mess-ID steht.

**Einschalten:** In Google Analytics (analytics.google.com) eine Property für die Website anlegen, unter *Verwaltung → Datenstreams* die Mess-ID (`G-…`) kopieren und in `js/statistik.js` bei `const GA_ID = '';` zwischen die Anführungszeichen schreiben. Danach erscheint auf allen öffentlichen Seiten der Cookie-Hinweis. Die alte Universal-Analytics-Kennung (`UA-…`) funktioniert seit Juli 2024 nicht mehr.

**So arbeitet es:**

- Beim ersten Besuch fragt ein Hinweis am unteren Rand. „Ablehnen“ und „Zustimmen“ sind gleichwertig; die Website funktioniert in beiden Fällen gleich.
- **Vor der Zustimmung** gibt es weder Cookies noch eine Verbindung zu Google. Erst nach „Zustimmen“ lädt `statistik.js` das Skript von Google.
- Die Auswahl steht im Browser (`localStorage`, Eintrag `aug-cookies`) und gilt ein Jahr. „Cookie-Einstellungen“ in der Fußzeile und auf der Datenschutzseite öffnet den Hinweis erneut; „Ablehnen“ löscht die Analytics-Cookies wieder.
- Es wird nur Statistik gemessen: Werbefunktionen und Google Signals sind aus, IP-Adressen speichert Google Analytics 4 nicht, der Cookie hält sechs Monate (`COOKIE_TAGE`).
- **Nie gemessen** wird auf `localhost` (der Hinweis erscheint dort trotzdem, zum Ansehen) und in einem Browser, in dem gerade jemand in der Verwaltung angemeldet ist. Die Verwaltung selbst lädt `statistik.js` nie.

**Einstellungen in Google Analytics, damit die Datenschutzerklärung stimmt:** Datenaufbewahrung auf *2 Monate* (Verwaltung → Property → Datenerhebung und -änderung → Datenaufbewahrung), *Google Signals* aus, unter *Datenfreigabe-Einstellungen* alles ausschalten, die *Datenverarbeitungsbedingungen* akzeptieren. Danach den gelb markierten Hinweis am Ende des Abschnitts „Besucherstatistik“ löschen (Verwaltung → Einstellungen → Impressum & Datenschutz).

**Sicherheit:** Die Content-Security-Policy der öffentlichen Seiten erlaubt dafür genau `www.googletagmanager.com/gtag/` (das Skript; der Container-Lader `gtm.js`, über den sich fremder Code einschleusen ließe, bleibt gesperrt) sowie `google-analytics.com` und `analytics.google.com` (Messdaten); die Verwaltung bleibt bei `'self'`. Ein Skript von Google läuft mit allen Rechten der Seite. Deshalb gilt: den Ordner `admin/` nicht auf denselben öffentlichen Server legen wie die Website (oder dort mit einem Passwort schützen), solange Google Analytics eingeschaltet ist. Wer gar keine Einwilligung einholen möchte, nimmt eine Statistik ohne Cookies (z. B. Matomo oder Plausible); dann entfallen Hinweis und Google-Freigabe in der Richtlinie.

## Lokal ansehen

Damit der Hochamt-Kalender seine Tabelle laden kann, braucht die Seite einen lokalen Webserver (Browser blockieren `fetch()` bei direkt geöffneten Dateien):

```bash
python -m http.server 8123
```

Danach im Browser `http://localhost:8123` öffnen.

## Auf einen Webserver stellen (Homelab, nginx, Apache)

Die Website ist rein statisch: Es gibt nichts zu bauen oder zu installieren, der Webserver liefert die Dateien einfach aus. Damit nur das auf den Server kommt, was Besucher brauchen (**ohne** Verwaltung, Entwicklungsdateien und Sperrdateien von Excel), baut `tools/paket.py` ein Paket in den Ordner `dist/` (steht in `.gitignore`):

```bash
python tools/paket.py                         # Test-Paket fürs Homelab   -> dist/homelab-test/ + dist/augustinerkirche-homelab-test.tar.gz
python tools/paket.py --verwaltung            # dasselbe, mit der Verwaltung: sie speichert dann direkt auf dem Server (Server-Modus)
python tools/paket.py --live                  # Paket für den echten Betrieb -> dist/live/ + dist/augustinerkirche-live.tar.gz
python tools/paket.py --ohne-cookie-vorschau  # Test-Paket, aber ohne erzwungenen Cookie-Hinweis
python tools/paket.py --verwaltung --update   # nur Programmcode, zum Aktualisieren: Inhalte auf dem Server bleiben unberührt
```

Nur Python 3, sonst wird nichts gebraucht. Das Paket enthält `site/` (die Website), `server/nginx.conf` und `server/apache.conf` (Konfiguration) sowie eine `ANLEITUNG.md` mit den Befehlen für einen Debian- oder Ubuntu-Container (Proxmox-LXC): hochladen, entpacken, nach `/var/www/augustinerkirche` kopieren, Konfiguration aktivieren, prüfen. Die Vorlagen dafür liegen in `tools/server/`.

- **Test-Paket und Live-Paket** unterscheiden sich nur in drei Punkten: Das Test-Paket sperrt Suchmaschinen aus (`robots.txt`, Kopf `X-Robots-Tag`) und zeigt immer den Cookie-Hinweis (Test-Mess-ID in der **Kopie** von `js/statistik.js`, die Seite gilt als „lokal“, es wird nie etwas an Google gesendet). Das Live-Paket enthält die Dateien genau wie im Projekt.
- **Beim Bauen geprüft:** Jede Datei, auf die eine Seite, ein Stil, ein Skript, das Manifest oder eine Tabelle (Bilder in `news.csv` usw.) verweist, muss im Paket liegen, **auch in der Groß- und Kleinschreibung**. Windows ist dabei nachsichtig, Linux nicht; ein falsch geschriebener Dateiname würde sonst erst auf dem Server auffallen. Gibt es Probleme, listet das Skript sie auf und endet mit Fehler.
- **Konfiguration:** Sie setzt die Antwortköpfe, die sich nur am Server einstellen lassen (`Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`), komprimiert Text, lässt Seiten, Skripte, Stile und Daten bei jedem Aufruf per ETag prüfen (Änderungen sind sofort sichtbar) und Bilder einen Tag im Browser, und liefert versteckte Dateien und Sicherungskopien nie aus. `Strict-Transport-Security` steht auskommentiert darin und gehört erst mit https dazu. Die nginx-Konfiguration wurde mit einem echten nginx geprüft (`nginx -t`, Köpfe, Dateitypen, gzip, Sperren), die Apache-Konfiguration nur gelesen: dort vor dem ersten Einsatz `apache2ctl configtest` ausführen.
- **Die Verwaltung** ist im normalen Paket nicht enthalten: Sie schreibt sonst in den Projektordner auf dem PC, nicht auf den Server. Mit `--verwaltung` kommt sie als **Server-Modus** mit (siehe unten).

### Verwaltung auf dem Server (Server-Modus)

Mit `python tools/paket.py --verwaltung` speichert die Verwaltung **direkt auf dem Webserver**, ohne Projektordner auf dem PC und ohne Hochladen: Jede Änderung ist sofort auf der Website zu sehen, oben in der Verwaltung steht „Mit dem Server verbunden“.

- **So geht es:** Die Verwaltung erkennt den Server am Antwortkopf `X-Aug-Schreiben: ja` (eine `HEAD`-Anfrage an die eigene Seite). Dann liest sie Dateien per `GET`, schreibt per `PUT` und löscht Fotos per `DELETE`. Dafür gibt es in `js/admin/admin.js` ein Objekt (`ServerDir`) mit denselben Methoden wie ein Ordner der File System Access API; der Rest der Verwaltung merkt nichts davon. Schutz vor Überschreiben, WebP-Umrechnung der Fotos und alle Prüfungen bleiben wie im Ordner-Modus. Ohne den Kopf (z. B. lokal mit `python -m http.server`) gilt weiter der Projektordner.
- **Den Schutz übernimmt der Webserver**, nicht die Verwaltung: Sie läuft auf einem **eigenen Port** (8443, https; für den Browser also eine andere Herkunft als die öffentliche Seite) und nur nach einer **Anmeldung am Server** (Basic Auth). Schreiben erlaubt der Server nur für `data/*.csv`/`*.json`, `assets/…` (Bilder, MP3, PDF), `admin/zugaenge.json`, `admin/mitteilungen.json` und `admin/protokoll.json`; auf PUT und DELETE für `js/`, `css/` und die Seiten antwortet er mit 405 oder 404. Die öffentliche Seite (Port 80) kann nichts schreiben und liefert `admin/` nicht aus. Die **Rollen und Rechte je Person** gelten weiter nur in der Oberfläche: Wer die Anmeldung am Server kennt, kann dort in `data/` und `assets/` schreiben.
- **https ist Pflicht** für die Verwaltung: Die Anmeldung rechnet PBKDF2 im Browser, und der gibt das nur über https oder `localhost` frei. Zum Testen genügt ein selbstsigniertes Zertifikat (die Anleitung im Paket zeigt den Befehl), besser ist ein Reverse-Proxy mit gültigem Zertifikat.
- **Die Inhalte liegen dann auf dem Server.** Beim Aktualisieren des Programmcodes werden sie nicht überschrieben (`rsync` mit Ausnahmen, in der `ANLEITUNG.md` des Pakets). Wer die Website zusätzlich in Git pflegt, holt vorher die Inhalte per `scp` in den Projektordner. Die Sicherung der Inhalte ist jetzt Sache des Servers (z. B. Proxmox-Sicherung des Containers).
- **Geprüft** mit einem echten nginx (Podman): Ersteinrichtung, Anmeldung, Speichern, Foto-Upload, Schutz vor Überschreiben, gesperrte Pfade und Dateitypen, Größenbegrenzung, Anmeldung am Server. Die Apache-Fassung (`apache-verwaltung.conf`, WebDAV) ist vorbereitet, aber noch nicht mit einem echten Apache geprüft.

## Aufbau

```
index.html                    Startseite
pages/
  pfarre.html                 Pfarre, Pfarrer, Pfarrkanzlei, Pfarrgemeinderat, Seelsorger
  kalender.html               Kalender: alle Termine von St. Augustin, als Monat oder Wochenüberblick (#woche)
  gottesdienste.html          Liturgiezeiten, Runden
  sakramente.html             Sakramente
  musik.html                  Kirchenmusik: Hochämter, Ensembles, Orgeln
  hochamt.html                Detailseite eines Hochamts
  chronik.html                Geschichte der Kirche, Herzgruft, Führungen, Rundgang
  augustiner.html             Hl. Augustinus, Regel, Orden, Ordensheilige, Vikariat, Augustiner in Wien, Links
  aspersdorf.html             Pfarre Aspersdorf
  archiv.html                 Archiv der Neuigkeiten, nach Jahren
  impressum.html              Impressum
  datenschutz.html            Datenschutzerklärung
  hochaemter-verwaltung.html  Weiterleitung zur neuen Verwaltung
  news-verwaltung.html        Weiterleitung zur neuen Verwaltung
  runden/                     Detailseiten je Pfarrgruppe; runde.html?id=… für neu angelegte Runden
tools/
  paket.py                    Baut das Paket für nginx/Apache (siehe „Auf einen Webserver stellen“)
  server/                     Vorlagen: nginx.conf, apache.conf, ANLEITUNG.md
admin/                        Verwaltung (nur mit Anmeldung)
  index.html                  Anmeldung und Ersteinrichtung
  uebersicht.html             Übersicht
  hochaemter.html             Hochämter pflegen
  neuigkeiten.html            Neuigkeiten und Plakate pflegen
  termine.html                Eigene Termine für den Kalender pflegen
  wochenkalender.html         Wochenkalender (gedruckter Wochenplan) pflegen
  paten.html                  Paten der Kirchenmusik pflegen
  cds.html                    CDs mit Cover und Hörproben pflegen
  pgr.html                    Pfarrgemeinderat pflegen
  solisten.html               Solisten pflegen
  gottesdienste.html          Wochenplan, Ferien und Pausen, Ausfälle pflegen
  kontakt.html                Pfarrkanzlei und Kontakt pflegen
  runden.html                 Runden pflegen
  rundgang.html               Kirchenrundgang pflegen
  startseite.html             Titelfotos der Startseite pflegen
  design.html                 Farben der Titelzeile und Logo je Hauptseite
  sprueche.html               Sprüche (Zitate unten auf den Seiten, wechseln nacheinander)
  hinweise.html               Hinweisbanner oben auf der Website (mit Start- und Enddatum)
  rechtliches.html            Impressum und Datenschutz pflegen
  mitteilungen.html           Mitteilungen an alle in der Verwaltung (nur Entwickler)
  aenderungen.html            Alle Änderungen als Tabelle (nur Entwickler)
  personen.html               Mitbrüder, Leitung, Gastdirigenten, Organisten pflegen
  repertoire.html             Repertoire des Chores pflegen
  zugaenge.html               Zugänge und Rollen verwalten (nur Admin; Rollen: Redaktion, Admin, Entwickler)
  zugaenge.json               Zugänge (Passwörter nur als Prüfsumme)
  mitteilungen.json           Mitteilungen an alle in der Verwaltung
  protokoll.json              Änderungsprotokoll (entsteht beim Speichern; nicht in Git, nicht im Paket)
css/
  style.css                   Zentrales Stylesheet
  admin.css                   Zusätze für die Verwaltung
js/
  main.js                     Navigation, Tabs, Hash-Routing, Einblend-Effekte
  hochaemter-data.js          Gemeinsames Modul: CSV-Tabelle, HTML-Escaping, sichere Links
  hochaemter.js               Kalender und Archiv auf der Musik-Seite
  hochaemter-start.js         Nächste Hochämter auf der Startseite
  news.js                     Neuigkeiten: 3 Karten, Fenster mit Plakat, Jahresarchiv
  kalender-daten.js           Termine für Kalender und Wochenüberblick: Hochämter, Wochenplan (mit Ferien und Ausfällen), Runden, eigene Termine
  kalender.js                 Kalender: Monatsblatt und Termine des Monats
  woche.js                    Wochenüberblick im Kalender: Woche wählen, alle Tage mit ihren Terminen
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
  admin-cds.js                CDs pflegen
  admin-pgr.js                Pfarrgemeinderat pflegen
  admin-solisten.js           Solisten pflegen
  admin-gottesdienste.js      Wochenplan, Ferien und Pausen, Ausfälle
  admin-kontakt.js            Pfarrkanzlei und Kontakt
  admin-runden.js             Runden pflegen
  admin-rundgang.js           Kirchenrundgang pflegen
  admin-startseite.js         Titelfotos der Startseite pflegen
  admin-design.js             Farben & Logo je Hauptseite
  admin-sprueche.js           Sprüche pflegen
  admin-rechtliches.js        Impressum und Datenschutz pflegen
  admin-aenderungen.js        Alle Änderungen als Tabelle (Entwickler)
  admin-personen.js           Personen pflegen
  admin-repertoire.js         Repertoire pflegen
  admin-zugaenge.js           Zugänge und Rollen verwalten
  thema.js                    Farbe der Titelzeile und Logo je Thema (im <head>, aus data/themen.json; <html data-thema="…">)
  inhalte.js                  Zeichnet Gottesdienste, Runden, Personen, Kontakt, Repertoire, Impressum und Datenschutz aus data/
  instagram.js                Instagram-Bereich mit Fallback (derzeit nicht auf der Startseite eingebunden)
  statistik.js                Cookie-Hinweis und Google Analytics (nur mit Zustimmung; ohne Mess-ID aus)
data/
  hochaemter.csv              Hochamt-Termine ab dem laufenden Jahr inkl. Mitwirkende
  archiv/                     Hochamt-Archiv 2015–2025: hochaemter-JJJJ.csv je Jahr, jahre.json
  news.csv                    Neuigkeiten und Plakate
  termine.json                Eigene Termine für den Kalender (Ausflüge, Feste, Vorträge …)
  paten.json                  Paten und Ehrenpaten der Kirchenmusik
  cds.json                    CDs von St. Augustin mit Hörproben
  pgr.json                    Pfarrgemeinderat
  bildnachweise.json          Bildnachweis je Bild, erscheint unter dem Bild
  solisten.json               Solistinnen und Solisten mit Stimmlage
  gottesdienste.json          Regelmäßige Termine der Woche, Ferien, Ausfälle
  wochenkalender.json         Wochenkalender Tag für Tag (Heilige, Zelebrant, Musik, Ort)
  runden.json                 Runden: Übersicht und Inhalt der Seiten
  rundgang.json               Bilder des Kirchenrundgangs (Chronik → Rundgang)
  startseite.json             Titelfotos der Startseite (Diashow, Wechselzeit)
  sprueche.json               Sprüche für die Zitat-Bänder (Text, Quelle, Wechselzeit)
  themen.json                 Farbe der Titelzeile, Schrift und Logo je Hauptseite (Augustinerkirche, Kirchenmusik, Augustiner, Aspersdorf)
  startseite-kirchenmusik.json, startseite-augustiner.json, startseite-aspersdorf.json
                              Titelfotos der Hauptseiten Kirchenmusik, Augustiner, Aspersdorf (gleicher Aufbau)
  personen.json               Mitbrüder, Leitung, Gastdirigenten, Organisten
  hochamt-fotos.json          Fotos je Hochamt (Kennung → Bilder), Bilder in assets/img/hochaemter/<Kennung>/
  kontakt.json                Adresse, Telefon, E-Mail, Öffnungszeiten der Pfarrkanzlei
  repertoire.json             Repertoire des Chores
  rechtliches.json            Impressum und Datenschutzerklärung (Abschnitte mit Text)
site.webmanifest              App-Manifest: Name, Farben, Symbole, Schnellzugriffe
assets/
  logo.png, logo-gold.png     Logo (grün und golden), Favicons, Zierlinie
  icons/verbote.svg           Verbotszeichen in der Fußzeile (Hunde, Handy, Eis, Essen, Rauchen, Schultern, kurze Kleidung, Musik, Hut, Luftballons)
  logo/                       Logo-Varianten für die Titelzeile: gold, gold-dunkel, hellgold, weiss, schwarz, marine, bordeaux, tannengruen, gruen (je 300 × 300, durchsichtig)
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

**Sicherheit:** Jede Seite trägt im `<head>` eine Content-Security-Policy (nur eigene Skripte, keine Inline-Skripte). Inhalte aus den Tabellen werden vor der Ausgabe escaped, Links und Bildpfade nur mit `http(s)`, `mailto` oder als relativer Pfad übernommen. E-Mail-Adressen stehen nie im Klartext im Quelltext der Seiten: `HochamtData.mailHTML` (in `js/hochaemter-data.js`) legt sie rückwärts in `data-mail` ab, `js/main.js` macht beim Anzeigen wieder normale Links daraus; ohne JavaScript erscheint „name(at)domain(dot)at“. Neue Adressen in HTML-Seiten bitte ebenfalls so einbauen, in den Datendateien genügt die normale Schreibweise. Die Richtlinie erlaubt nur eigene Skripte, Bilder, Schriften und Verbindungen (`'self'`), keine Rahmen und keine Plugins; Google Fonts und andere Fremdquellen sind ausdrücklich nicht freigegeben. Einzige Ausnahme sind die öffentlichen Seiten für die optionale Besucherstatistik (`googletagmanager.com`, `google-analytics.com`, `analytics.google.com`, siehe [Cookies und Besucherstatistik](#cookies-und-besucherstatistik)). Zahlen aus den Datendateien (Breite und Höhe von Bildern) und Bildausschnitte werden vor dem Einsetzen geprüft (`HochamtData.num`, `HochamtData.focusPos`), E-Mail-Links nur für einfache, wohlgeformte Adressen gebaut. Wird später ein Instagram-Endpunkt in `js/instagram.js` eingetragen, muss seine Adresse in der Richtlinie unter `connect-src` und die Adresse der Beitragsbilder unter `img-src` ergänzt werden.

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

Im **Impressum** und in der **Datenschutzerklärung** (Verwaltung → Einstellungen → Impressum & Datenschutz; im Text als `[[offen: …]]`) sind gelb markierte Stellen in eckigen Klammern zu ergänzen, etwa Rechtsform, Registernummer, Hosting-Anbieter und Datenschutz-Kontakt. Dazu gehören auch die Angaben zu Cookies und Google Analytics (siehe [Cookies und Besucherstatistik](#cookies-und-besucherstatistik)). Beide Texte sollten von der Pfarre bzw. dem Vikariat geprüft werden.

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
