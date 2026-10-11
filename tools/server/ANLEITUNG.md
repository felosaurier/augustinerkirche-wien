# Augustinerkirche Wien: Paket für den Webserver ({{MODUS}})

Dieses Paket stammt aus `python tools/paket.py{{OPTION}}`. Die Website ist rein statisch (HTML, CSS, JavaScript, Daten-Dateien): Es muss nichts gebaut, installiert oder programmiert werden, der Webserver liefert die Dateien einfach aus.

| Inhalt | Zweck |
|---|---|
| `site/` | die Website, fertig zum Ausliefern (`index.html`, `pages/`, `css/`, `js/`, `assets/`, `data/`) |
<!--[verwaltung-anfang]-->
| `site/admin/` | die Verwaltung (Server-Modus: speichert direkt auf dem Server) |
<!--[verwaltung-ende]-->
| `server/nginx.conf` | Konfiguration für nginx |
| `server/apache.conf` | Konfiguration für Apache |
<!--[verwaltung-anfang]-->
| `server/nginx-verwaltung.conf` | dazu für die Verwaltung: eigener Port, nur mit Anmeldung |
| `server/apache-verwaltung.conf` | dasselbe für Apache (noch nicht mit einem echten Apache geprüft) |
<!--[verwaltung-ende]-->

{{HINWEISE}}

Die Beispiele gelten für einen Debian- oder Ubuntu-Container (Proxmox-LXC). `<IP>` ist die Adresse des Containers.

## 1. Auf den Container laden

Vom Windows-PC (PowerShell oder Git Bash), im Ordner `dist` des Projekts:

```bash
scp {{PAKET}} root@<IP>:/root/
```

Ohne SSH-Zugang geht es auch über die Proxmox-Konsole des Hosts (`pct push <Container-Nr.> {{PAKET}} /root/{{PAKET}}`) oder mit WinSCP: Hauptsache, die Datei liegt danach im Container in `/root/`.

## 2. Entpacken und die Website ablegen (im Container)

```bash
cd /root && tar xzf {{PAKET}}
rm -rf /var/www/augustinerkirche && mkdir -p /var/www/augustinerkirche
cp -a {{ORDNER}}/site/. /var/www/augustinerkirche/
```

<!--[verwaltung-anfang]-->
Das gilt nur für das erste Einrichten. Später, wenn die Verwaltung dort schon Inhalte gespeichert hat, nicht noch einmal so vorgehen (siehe „Aktualisieren“).

<!--[verwaltung-ende]-->
## 3a. Webserver nginx (empfohlen, am schlanksten)

```bash
apt update && apt install -y nginx
cp {{ORDNER}}/server/nginx.conf /etc/nginx/sites-available/augustinerkirche
ln -sf /etc/nginx/sites-available/augustinerkirche /etc/nginx/sites-enabled/augustinerkirche
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## 3b. oder Webserver Apache

```bash
apt update && apt install -y apache2
a2enmod headers deflate
cp {{ORDNER}}/server/apache.conf /etc/apache2/sites-available/augustinerkirche.conf
a2dissite 000-default
a2ensite augustinerkirche
apache2ctl configtest && systemctl reload apache2
```

Nur einen der beiden Webserver nehmen; laufen beide, belegen sie beide Port 80.

## 4. Prüfen

Im Browser `http://<IP>/` öffnen, am besten auch am Handy im selben Netz. Im Container:

```bash
curl -sI http://localhost/ | head -n 15           # 200, die Köpfe X-Content-Type-Options und Content-Security-Policy
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/admin/        # 404: die Verwaltung gehört nicht auf die öffentliche Seite
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/.git/config   # 404
```

Fehlt `curl` im Container: `apt install -y curl`.

<!--[verwaltung-anfang]-->
## 5. Verwaltung auf dem Server

Mit der Verwaltung auf dem Server gibt es **keinen Projektordner** mehr: Sie liest und schreibt die Dateien der Website direkt dort (über HTTP: GET, PUT, DELETE). Änderungen sind sofort auf der Website zu sehen. Der Schutz liegt beim Webserver, nicht in der Verwaltung:

- Die Verwaltung läuft auf einem **eigenen Port** (8443, https) und nur nach einer **Anmeldung am Server** (Basic Auth). Die öffentliche Website (Port 80) kann nichts schreiben und liefert `admin/` nicht aus. Ein anderer Port bedeutet für den Browser eine andere Herkunft: Ein Skript auf der öffentlichen Seite kommt so nicht an die Verwaltung heran.
- Schreiben erlaubt der Server nur in `data/` (Tabellen), `assets/` (Fotos, Hörproben) und für `admin/zugaenge.json` und `admin/mitteilungen.json`. Programmcode (`js/`, `css/`, `pages/`) lässt sich darüber nicht verändern.
- Die Anmeldung der Verwaltung selbst (Name, Passwort, Rechte je Person) bleibt wie gehabt. Sie braucht https, deshalb das Zertifikat unten.
- Ein **langes Passwort** für den Server-Benutzer nehmen (mindestens 16 Zeichen) und Port 8443 **nicht ins Internet freigeben**, sondern nur im Heimnetz oder über ein VPN erreichbar machen (Proxmox-Firewall). Der Server sperrt nach Fehlversuchen nicht von selbst; wer das will, nimmt `fail2ban`.
- Die Inhalte liegen danach auf dem Server: Zum Sichern den Container in Proxmox regelmäßig sichern lassen (Backup oder Snapshot).

**a) Benutzer für die Anmeldung am Server** (einer genügt; die Rechte je Person regelt weiter die Verwaltung):

```bash
apt install -y apache2-utils
htpasswd -B -c /etc/nginx/augustinerkirche.htpasswd redaktion
chgrp www-data /etc/nginx/augustinerkirche.htpasswd && chmod 640 /etc/nginx/augustinerkirche.htpasswd
```

Bei Apache stattdessen `/etc/apache2/augustinerkirche.htpasswd` (Gruppe `www-data` ebenso).

**b) Zertifikat** (selbstsigniert, genügt zum Testen; der Browser warnt einmal):

```bash
mkdir -p /etc/nginx/augustinerkirche-tls && cd /etc/nginx/augustinerkirche-tls
openssl req -x509 -nodes -newkey rsa:2048 -days 825 -keyout key.pem -out cert.pem -subj "/CN=augustinerkirche" -addext "subjectAltName=IP:<IP>"
chmod 600 key.pem && cd /root
```

Bei Apache der Ordner `/etc/apache2/augustinerkirche-tls`. Mit einem Namen statt der Adresse (z. B. `homelab.lan`): `subjectAltName=DNS:homelab.lan,IP:<IP>`. Wer schon einen Reverse-Proxy mit gültigem Zertifikat hat (Nginx Proxy Manager, Caddy, Traefik), nimmt besser den: dann in `nginx-verwaltung.conf` `listen 8443 ssl;` durch `listen 8443;` ersetzen und die drei `ssl_…`-Zeilen entfernen, der Proxy leitet `https://…` an Port 8443 weiter (Kopf `X-Aug-Schreiben` und Anmeldung bleiben).

**c) Dem Webserver Schreibrechte geben** (nur für diese Ordner und die Datei, `www-data` ist der Benutzer von nginx und Apache):

```bash
chown -R www-data:www-data /var/www/augustinerkirche/data /var/www/augustinerkirche/assets
chown www-data:www-data /var/www/augustinerkirche/admin /var/www/augustinerkirche/admin/zugaenge.json /var/www/augustinerkirche/admin/mitteilungen.json
```

Das gemeinsame Änderungsprotokoll `admin/protokoll.json` legt die Verwaltung beim ersten Speichern selbst an (dafür muss `admin/` dem Webserver gehören, siehe oben).

**d) Konfiguration einbinden** (nginx). Die öffentliche Konfiguration aus Schritt 3a muss die aus diesem Paket sein (sie sperrt `admin/`), danach die für die Verwaltung:

```bash
cp {{ORDNER}}/server/nginx.conf /etc/nginx/sites-available/augustinerkirche
cp {{ORDNER}}/server/nginx-verwaltung.conf /etc/nginx/sites-available/augustinerkirche-verwaltung
ln -sf /etc/nginx/sites-available/augustinerkirche-verwaltung /etc/nginx/sites-enabled/augustinerkirche-verwaltung
nginx -t && systemctl reload nginx
```

Bei Apache: `a2enmod dav dav_fs ssl`, die Zeile `Listen 8443` in `/etc/apache2/ports.conf` ergänzen, `apache.conf` erneut kopieren, `apache-verwaltung.conf` nach `/etc/apache2/sites-available/augustinerkirche-verwaltung.conf` kopieren, `a2ensite augustinerkirche-verwaltung`, `apache2ctl configtest && systemctl reload apache2`.

**e) Öffnen:** `https://<IP>:8443/admin/`

- Der Browser warnt vor dem selbstsignierten Zertifikat: „Erweitert“, dann „Weiter“.
- Dann fragt er nach Name und Passwort des Servers (aus a).
- Danach kommt die Anmeldung der Verwaltung. Gibt es noch keinen Zugang, legt sie beim ersten Mal den ersten an („Ersteinrichtung“).
- Oben steht „Mit dem Server verbunden“, und jedes Speichern landet sofort auf dem Server.

**f) Prüfen** (im Container):

```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://localhost:8443/admin/                 # 401: ohne Anmeldung kein Zutritt
curl -sk -u redaktion -I https://localhost:8443/admin/index.html | grep -i x-aug        # X-Aug-Schreiben: ja
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/admin/                        # 404: auf der öffentlichen Seite gibt es die Verwaltung nicht
```

Hinweis: Ohne https auf einer Adresse wie `http://192.168…` kann die Anmeldung der Verwaltung nicht rechnen (der Browser stellt die nötige Verschlüsselungsfunktion nur bei https oder `localhost` bereit). Die Verwaltung meldet das dann auch.

<!--[verwaltung-ende]-->
## Aktualisieren

<!--[ohne-verwaltung-anfang]-->
Nach Änderungen im Projekt das Paket neu bauen (`python tools/paket.py{{OPTION}}`), wieder hochladen und die Schritte 1 und 2 wiederholen. Der Webserver muss dafür nicht neu gestartet werden.
<!--[ohne-verwaltung-ende]-->
<!--[verwaltung-anfang]-->
Die Inhalte (Tabellen in `data/`, Fotos und Hörproben in `assets/img`, `assets/audio`, `assets/programme`, dazu `admin/zugaenge.json`, `admin/mitteilungen.json` und das Änderungsprotokoll `admin/protokoll.json`) liegen jetzt auf dem Server und werden dort in der Verwaltung gepflegt. Beim Aktualisieren dürfen sie nicht überschrieben werden, deshalb **nicht** wieder `rm -rf` und kopieren und **nicht** dieses ganze Paket noch einmal hochladen.

**Am sichersten:** ein Update-Paket bauen, `python tools/paket.py{{OPTION}} --update`. Es enthält nur den Programmcode, die Inhalte fehlen darin ganz; seine Anleitung hat die Befehle. Oder mit diesem Paket nur den Programmcode erneuern:

```bash
apt install -y rsync
cd /root && tar xzf {{PAKET}}
rsync -a --exclude='/data/' --exclude='/admin/zugaenge.json' --exclude='/admin/mitteilungen.json' --exclude='/admin/protokoll.json' --exclude='/assets/img/' --exclude='/assets/audio/' --exclude='/assets/programme/' {{ORDNER}}/site/ /var/www/augustinerkirche/
chown -R www-data:www-data /var/www/augustinerkirche/admin
```

Nach Änderungen im Projekt: Paket neu bauen (`python tools/paket.py{{OPTION}}`), hochladen, diese Befehle. Der Webserver muss nicht neu gestartet werden (nur bei geänderter Konfiguration: Schritt 3 bzw. 5d noch einmal).

### Inhalte vom Server ins Projekt holen

Wer die Website weiter in Git pflegt, holt vorher die Inhalte vom Server in den Projektordner (PowerShell oder Git Bash, im Projektordner) und committet sie wie gewohnt:

```bash
scp -r root@<IP>:/var/www/augustinerkirche/data .
scp -r root@<IP>:/var/www/augustinerkirche/assets .
scp root@<IP>:/var/www/augustinerkirche/admin/zugaenge.json root@<IP>:/var/www/augustinerkirche/admin/mitteilungen.json admin/
```

Wer lokal im Projektordner weiterarbeitet und gleichzeitig auf dem Server, überschreibt sich sonst gegenseitig: eine Seite ist die Hauptquelle der Inhalte, die andere holt sie vorher.
<!--[verwaltung-ende]-->

## Hinter Cloudflare (Tunnel oder Proxy)

Die öffentliche Seite braucht am Server nichts Besonderes: Cloudflare macht https, der Server liefert über Port 80 (Tunnel: `service: http://localhost:80`). In Cloudflare:

- **Speed → Optimization:** Rocket Loader aus. **Scrape Shield:** E-Mail-Verschleierung aus. **Web Analytics:** für diese Seite nicht aktivieren. Cloudflare würde sonst eigene Skripte einfügen, die die Content-Security-Policy blockiert und die der Datenschutzerklärung widersprechen.
- **Caching:** Der Server schickt für `data/` schon `Cache-Control: private, no-cache`, damit Cloudflare keine alten Tabellen ausliefert. Zeigt eine Änderung trotzdem nicht sofort, eine Cache Rule „Bypass cache“ für Pfade, die mit `/data/` beginnen, anlegen. Nach einem Programm-Update: Caching → Purge Everything.
- **Datenschutz:** Cloudflare verarbeitet die IP-Adressen der Besucher. Im echten Betrieb gehört es in die Datenschutzerklärung (Abschnitt „Hosting und Server-Protokolle“).
- **Echte Besucher-IP im Protokoll** (optional): in den `server {}`-Block `set_real_ip_from 127.0.0.1;` und `real_ip_header CF-Connecting-IP;` (cloudflared im selben Container).
<!--[verwaltung-anfang]-->

**Verwaltung hinter Cloudflare:**

- Eigener Name **eine Ebene unter der Domain**, z. B. `ak-verwaltung.feho.at` (nicht `verwaltung.ak.feho.at`: das deckt das kostenlose Cloudflare-Zertifikat nicht ab).
- Tunnel (`config.yml`), das selbstsignierte Zertifikat im Container wird nicht geprüft:

```yaml
ingress:
  - hostname: ak.feho.at
    service: http://localhost:80
  - hostname: ak-verwaltung.feho.at
    service: https://localhost:8443
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

- Port 8443 muss dann nicht im Router freigegeben sein und sollte es nicht.
- **Cloudflare Access** davor (Zero Trust → Access → Applications → Self-hosted, Name der Verwaltung, Regel „Allow“ mit den E-Mail-Adressen der Redaktion). Wer nicht dazugehört, kommt gar nicht bis zur Anmeldung am Server.
- Cache Rule „Bypass cache“ für den ganzen Namen der Verwaltung (der Server schickt `private, no-cache`).
- Ohne Tunnel (normaler DNS-Eintrag, orange Wolke): `https://ak.feho.at:8443/` geht, Cloudflare reicht diesen Port durch; SSL/TLS-Modus „Full“. Dann ist der Port am Router offen: Access ist Pflicht, und am besten nur Cloudflare-Adressen zulassen.
- Meldet das Speichern „keine Verbindung … Anmeldung abgelaufen“, ist die Access-Sitzung abgelaufen: Seite neu laden.
<!--[verwaltung-ende]-->

## Wenn etwas nicht klappt

- **Seite nicht erreichbar:** Läuft der Dienst (`systemctl status nginx` bzw. `apache2`)? Blockiert die Proxmox-Firewall Port 80{{PORTS}}? Antwortet `curl http://localhost/` im Container selbst?
- **„Welcome to nginx“ bzw. Apache-Startseite:** Die Standard-Seite ist noch aktiv (`sites-enabled/default` bzw. `000-default`), siehe Schritt 3.
- **Seite leer oder ohne Daten:** In den Entwicklerwerkzeugen des Browsers (F12) im Reiter „Netzwerk“ nach roten Einträgen suchen; meist fehlt eine Datei oder der Pfad hat die falsche Groß- und Kleinschreibung (Linux unterscheidet das, Windows nicht).
<!--[verwaltung-anfang]-->
- **Die Verwaltung zeigt „Projektordner verbinden“ statt „Mit dem Server verbunden“:** Der Server schickt den Kopf `X-Aug-Schreiben: ja` nicht. Prüfen: `curl -sk -u redaktion -I https://localhost:8443/admin/index.html`. Läuft ein Reverse-Proxy davor, muss er den Kopf durchreichen.
- **Beim Speichern „HTTP 401“:** Die Anmeldung am Server ist abgelaufen oder wurde abgebrochen. Die Seite neu laden und Name und Passwort des Servers eingeben.
- **Beim Speichern „HTTP 405“ oder „403“:** Der Pfad ist nicht zum Schreiben freigegeben, oder `www-data` darf dort nicht schreiben (Schritt 5c). nginx: `nginx -V 2>&1 | grep -c http_dav_module` muss 1 ergeben (sonst `apt install nginx-extras`).
- **Beim Speichern „HTTP 413“:** Die Datei ist größer als erlaubt (`client_max_body_size` bzw. `LimitRequestBody`).
<!--[verwaltung-ende]-->
- **Anderer Port** (z. B. 8080, weil Port 80 belegt ist): nginx `listen 8080 default_server;`; Apache `Listen 8080` in `/etc/apache2/ports.conf` und `<VirtualHost *:8080>`.
- **Mit https für die öffentliche Seite:** Das Zertifikat am besten an einem Reverse-Proxy (Nginx Proxy Manager, Caddy, Traefik) einrichten; dort auch die Zeile `Strict-Transport-Security` einschalten.
