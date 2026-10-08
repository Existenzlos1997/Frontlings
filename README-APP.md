# Fortlings als App (Google Play / App Store)

Fortlings ist eine installierbare Web-App (PWA). Daraus lassen sich ohne Neuprogrammierung Store-Apps bauen.

## Android (Google Play) – empfohlen zuerst
1. Entwicklerkonto bei Google Play anlegen (einmalig 25 US-Dollar): https://play.google.com/console
2. https://www.pwabuilder.com öffnen, die Spiel-Adresse eingeben und auf „Package for stores“ → **Android** tippen.
3. Paketname wählen, z. B. `app.fortlings.game`, Rest so lassen. PWABuilder lädt eine ZIP-Datei herunter. Darin sind
   - eine `.aab`-Datei (die eigentliche App für Google Play),
   - eine `assetlinks.json` und eine Signatur-Datei (`signing.keystore` + Passwort-Datei): **gut aufheben**, ohne sie gibt es keine Updates des Store-Pakets.
4. Die `assetlinks.json` an Claude geben. Sie wird in der Datenbank hinterlegt und unter `/.well-known/assetlinks.json` ausgeliefert, damit die App ohne Browser-Leiste im Vollbild startet. Ein neues Hochladen des Spiels ist dafür nicht nötig.
5. In der Play Console: App anlegen, `.aab` hochladen (zuerst „Interner Test“), Screenshots (`public/shot-*.jpg`), Beschreibung, Datenschutz-Link `https://<deine-adresse>/datenschutz.html`, Altersfreigabe-Fragebogen.

**Updates:** Die Store-App lädt das Spiel von unserer Adresse. Jede Verbesserung ist deshalb sofort auch in der Store-App, ohne neues Hochladen. Ein neues `.aab` braucht es nur, wenn sich Name, Symbol oder Paket-Einstellungen ändern.

## iPhone (App Store)
1. Apple-Entwicklerprogramm (99 US-Dollar pro Jahr). Zum Bauen braucht man einen Mac mit Xcode.
2. PWABuilder → **iOS** erzeugt ein Xcode-Projekt. Auf dem Mac öffnen, signieren, hochladen.
Ohne App Store geht es auf dem iPhone schon jetzt: Safari → Teilen → „Zum Home-Bildschirm“. Benachrichtigungen funktionieren auf dem iPhone nur so (ab iOS 16.4).

## Vor der Veröffentlichung
- Impressum und Datenschutz in `public/datenschutz.html` und im Spiel (Allianz-Seite unten) ausfüllen.
- Echtgeld-Käufe: in den Stores nur über deren Bezahlsystem (Google Play Billing / Apple In-App-Kauf). Der Shop im Spiel ist dafür vorbereitet („Edelsteine“ → „Bald“).
- Altersfreigabe-Fragebogen (IARC) in der Play Console ausfüllen.
