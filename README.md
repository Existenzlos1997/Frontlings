# Fortlings – Online-Version (Cloudflare)

Alles in einem Projekt: Spiel (`public/index.html`) + Server (`src/worker.js`) + Datenbank (D1).
Die D1-Datenbank **kaltmark** (id `924ae586-441e-4946-bd65-adc8e283ba80`) existiert schon in deinem Cloudflare-Konto, das Schema ist eingespielt, `wrangler.jsonc` ist ausgefüllt.

## Weg A: per GitHub (ohne Terminal)
1. Neues GitHub-Repo anlegen und den Inhalt dieses Ordners hochladen (`public/`, `src/`, `wrangler.jsonc`, `schema.sql`, `package.json`).
2. Cloudflare-Dashboard → Workers & Pages → Create → Import a repository → Repo wählen.
3. Name `fortlings`, Deploy-Befehl `npx wrangler deploy` (Standard). Adresse danach: `https://fortlings.<dein-name>.workers.dev`.

## Weg B: per Terminal
```
npm install
npx wrangler login
npx wrangler deploy
```

## Prüfen
`https://<deine-adresse>/api/ping` muss `{"ok":1}` zeigen. Dann Spiel öffnen, unten "Allianz", Spielername wählen.

## Was online geht
Spielername + Konto (Token nur gehasht gespeichert), Arena gegen echte Spieler (Deck + Festung als Snapshot, Gegner nach Pokalen), Freunde suchen/hinzufügen/herausfordern, Allianzen gründen/beitreten, Allianz-Chat (Abfrage alle 6 s), Rangliste. Ohne Server fällt das Spiel auf Trainingsgegner zurück.

## Grenzen
Kämpfe laufen auf dem Handy (Snapshot-Duell, nicht live synchron). Kein Schutz gegen manipulierte Spielstände. Gratis-Limits: Workers 100k Anfragen/Tag, D1 5 Mio. Lesezugriffe/Tag.

## Neu (Version 2)
- **Datenbank ist schon aktualisiert:** Die neuen Tabellen für Karten-Spenden (reqs, gifts, dons) habe ich direkt in deiner D1-Datenbank angelegt. Du musst nur den Worker neu veröffentlichen (gleicher Weg wie oben).
- **Karten spenden:** In der Allianz alle 8 Stunden eine gewöhnliche (bis 8) oder seltene (bis 3) Karte anfragen; Mitglieder spenden Kopien und bekommen 5 Gold. Max. 30 Spenden pro Tag und Spieler.
- **Schutz vor Schummeln:** Der Server nimmt pro Abgleich höchstens ca. +35 Pokale (plus 35 je 2 Minuten Spielzeit) und begrenzte Stufen-Sprünge an.
- **Konto löschen:** Spieler können ihr Online-Konto samt Nachrichten, Freunden und Anfragen selbst löschen (Allianz-Seite unten).
- **Impressum/Datenschutz:** Vorlage im Spiel (Allianz-Seite unten). Platzhalter mit deinen Daten füllen und prüfen lassen.
- **Offline-fähig (PWA):** Auf der Cloudflare-Adresse kann man das Spiel über „Zum Startbildschirm hinzufügen“ wie eine App installieren; es startet dann auch ohne Netz.

## Später: echte App für Google Play / App Store
Die Web-Version lässt sich mit **Capacitor** (kostenlos) in eine Android-/iOS-App verpacken. Für Google Play reicht auch eine „Trusted Web Activity“ (Tool: Bubblewrap) mit der Cloudflare-Adresse. Konten: Google Play einmalig 25 $, Apple 99 $/Jahr.

## Live-Kämpfe (Version 3)
- Echtzeit-PvP über einen Cloudflare **Durable Object** (`Lobby`, SQLite-basiert, im Gratis-Tarif enthalten). Konfiguration steht in `wrangler.jsonc` (`durable_objects` + `migrations`), Cloudflare richtet ihn beim automatischen Deploy selbst ein.
- Ablauf: Spieler A sucht → wartet; Spieler B sucht → beide werden gepaart. A ist „Host“ und rechnet den Kampf, B sieht ihn gespiegelt und schickt nur seine Karten-Züge. Freundes-Live-Kampf: beide tippen beim Freund auf ⚡.
- Verbindung: `wss://<adresse>/api/live?id=…&token=…`

## Aufbau (ab Oktober 2026)
- `game/` – Quelle: das ganze Spiel als **eine** HTML-Datei (läuft auch offline/als Einzeldatei) plus Service Worker, Manifest, Icons.
- `public/` – **gebaute** Server-Version: `python3 tools/build.py game public` lagert die eingebetteten Bilder nach `public/a/` aus. Dadurch lädt die Seite schneller (HTML ~260 KB statt 2,3 MB) und Bilder werden einzeln zwischengespeichert.
- Nach jeder Änderung an `game/index.html` den Build ausführen und beides einchecken; Cloudflare veröffentlicht `public/` automatisch.
