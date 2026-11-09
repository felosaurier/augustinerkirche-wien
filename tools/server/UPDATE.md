# Augustinerkirche Wien: Update-Paket ({{MODUS}})

Dieses Paket stammt aus `python tools/paket.py{{OPTION}}`. Es enthält **nur den Programmcode** (Seiten, Stile, Skripte, Symbole) und erneuert damit eine Website, die schon auf dem Server läuft.

**Nicht enthalten** sind die Inhalte, die auf dem Server in der Verwaltung gepflegt werden: `data/` (Tabellen, Hinweisbanner, Startseite, Bildnachweise, Impressum und Datenschutz …), `assets/img/`, `assets/audio/`, `assets/video/`, `assets/pdf/`, `assets/programme/`, `admin/zugaenge.json`, `admin/mitteilungen.json` und das Änderungsprotokoll `admin/protokoll.json`. Sie bleiben auf dem Server genau so, wie sie sind. Die Konfiguration des Webservers liegt unter `server/` bei; erneuert wird sie nur mit Schritt 4.

{{HINWEISE}}

`<IP>` ist die Adresse des Containers.

## 1. Auf den Container laden

Vom Windows-PC (PowerShell oder Git Bash), im Ordner `dist` des Projekts:

```bash
scp {{PAKET}} {{PAKET}}.sha256 root@<IP>:/root/
```

Danach die Prüfsumme kontrollieren (die Datei `{{PAKET}}.sha256` hat `python tools/paket.py` neben das Archiv geschrieben; sie muss `OK` melden):

```bash
cd /root && sha256sum -c {{PAKET}}.sha256
```

## 2. Sicherung der Inhalte (im Container)

Kostet ein paar Sekunden und rettet im Fall der Fälle alles, was in der Verwaltung gepflegt wurde:

```bash
cd /var/www/augustinerkirche && tar czf /root/inhalte-$(date +%F-%H%M).tar.gz data assets admin/*.json 2>/dev/null; ls -lh /root/inhalte-*.tar.gz | tail -1
```

Zurückholen (nur bei Bedarf): `tar xzf /root/inhalte-<Datum>.tar.gz -C /var/www/augustinerkirche`, danach `chown -R www-data:www-data /var/www/augustinerkirche/data /var/www/augustinerkirche/assets`.

## 3. Programmcode erneuern (im Container)

```bash
cd /root && rm -rf {{ORDNER}} && tar xzf {{PAKET}}
cp -a {{ORDNER}}/site/. /var/www/augustinerkirche/
<!--[verwaltung-anfang]-->
chown -R www-data:www-data /var/www/augustinerkirche/admin

### Geteilte Ablage und echtes Löschen (ab November 2026)

Fotos und Videos der Neuigkeiten stehen jetzt in `data/neuigkeiten/` (statt `news-fotos.json` und `news-videos.json`), die Predigten in `data/predigten/` (statt `predigten.json`), Bildnachweise von Fotos beim Foto bzw. als Spalte „Bildnachweis“ in `news.csv`. Die Verwaltung löscht entfernte Dateien wirklich und auch die eigenen Ordner eines gelöschten Eintrags (DELETE auf `assets/img/news/JAHR/<Kennung>/` usw.). Beides braucht die neue `nginx-verwaltung.conf` bzw. `apache-verwaltung.conf`.

Liegen auf dem Server noch die alten Dateien, übernimmt die Verwaltung sie beim ersten Speichern von selbst. Alles auf einmal (mit Vorschaubildern) im Container:

```bash
cd /var/www/augustinerkirche && python3 tools/daten-teilen.py && chown -R www-data:www-data data assets/img/news
```

### Fotos der Hochämter in geteilter Ablage (ab November 2026)

Die Fotos der Hochämter stehen nicht mehr in einer Datei `data/hochamt-fotos.json`, sondern in `data/hochamt-fotos/` (`index.json` und je Hochamt `<Kennung>.json`), mit Vorschaubildern `foto-N-v.webp`. Dafür braucht der Server die neue Konfiguration (`nginx-verwaltung.conf` bzw. `apache-verwaltung.conf`: Schreiben und Löschen in `data/hochamt-fotos/`), sonst schlägt das Speichern von Fotos fehl. Danach `nginx -t && systemctl reload nginx` (bzw. `apache2ctl configtest && systemctl reload apache2`).

Liegt auf dem Server noch die alte Datei, übernimmt die Verwaltung sie beim ersten Speichern eines Hochamts von selbst. Mit Vorschaubildern für alle bisherigen Fotos geht es im Container (braucht `python3-pil`):

```bash
cd /var/www/augustinerkirche && python3 tools/hochamt-fotos-teilen.py && chown -R www-data:www-data data assets/img/hochaemter
```
(`tools/hochamt-fotos-teilen.py` dafür vorher in den Container kopieren.)
<!--[verwaltung-ende]-->
```

Das Kopieren ist hier ungefährlich, weil das Paket keine Inhalte enthält. Der Webserver muss nicht neu gestartet werden. Hinter Cloudflare danach einmal Caching → Purge Everything.

<!--[verwaltung-anfang]-->
## 4. Konfiguration erneuern (nur wenn nötig)

Nötig, wenn eine neue Version der Verwaltung eine Datei zusätzlich schreiben muss. Zuletzt: das **gemeinsame Änderungsprotokoll** `admin/protokoll.json` (Entwickler sehen es unter „Änderungen“). Solange der Server es nicht erlaubt, meldet die Seite „Änderungen“ das, und es gibt nur die Änderungen des eigenen Geräts. Ebenso die **PDFs der Wochenblätter von Aspersdorf** (`assets/pdf/`): Ohne diese Konfiguration weist der Server das Hochladen unter „Wochenblätter (PDF)“ ab.

Wurde `augustinerkirche-verwaltung` nie von Hand angepasst, einfach die neue Fassung übernehmen (nginx):

```bash
cp {{ORDNER}}/server/nginx-verwaltung.conf /etc/nginx/sites-available/augustinerkirche-verwaltung
nginx -t && systemctl reload nginx
```

Wurde sie angepasst (z. B. für einen Reverse-Proxy), stattdessen in `/etc/nginx/sites-available/augustinerkirche-verwaltung` neben dem Block für `/admin/mitteilungen.json` diesen ergänzen und dann `nginx -t && systemctl reload nginx`:

```nginx
    location = /admin/protokoll.json {
        dav_methods PUT;
        dav_access user:rw group:r all:r;
    }
```

Bei Apache: `apache-verwaltung.conf` nach `/etc/apache2/sites-available/augustinerkirche-verwaltung.conf` kopieren (oder dort den Block `<Location "/admin/protokoll.json">` aus der neuen Fassung ergänzen), dann `apache2ctl configtest && systemctl reload apache2`.

Dem Webserver muss außerdem der Ordner `admin/` gehören (war bei der Einrichtung schon so): `chown www-data:www-data /var/www/augustinerkirche/admin`.
<!--[verwaltung-ende]-->

## Neue Inhalte vom PC auf den Server

Inhalte, die auf dem PC entstanden sind (zum Beispiel neue Fotos), kommen nicht mit dem Update-Paket. Am besten gleich in der Verwaltung auf dem Server eintragen. Einzelne Dateien lassen sich auch gezielt kopieren, aber nur, wenn sie auf dem Server seither niemand geändert hat (sonst geht das dort Geänderte verloren):

```bash
scp data/startseite.json root@<IP>:/var/www/augustinerkirche/data/
scp -r assets/img/startseite root@<IP>:/var/www/augustinerkirche/assets/img/
```

Danach im Container: `chown -R www-data:www-data /var/www/augustinerkirche/data /var/www/augustinerkirche/assets`.
