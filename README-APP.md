# Fortlings als App (Google Play / App Store)

Fortlings ist eine installierbare Web-App (PWA). Daraus lassen sich ohne Neuprogrammierung Store-Apps bauen.

## Android (Google Play) – empfohlen zuerst
1. Entwicklerkonto bei Google Play anlegen (einmalig 25 US-Dollar).
2. https://www.pwabuilder.com öffnen, die Spiel-Adresse eingeben, „Package for stores“ → **Android**.
3. Paketname wählen, z. B. `app.fortlings.game`. PWABuilder erzeugt ein `.aab` (für Google Play) und eine Datei `assetlinks.json`.
4. Die `assetlinks.json` an Claude geben: sie kommt nach `public/.well-known/assetlinks.json`, damit die App ohne Browser-Leiste startet.
5. Das `.aab` in der Google Play Console hochladen, Screenshots (`public/shot-*.jpg`), Beschreibung, Datenschutz-Link `https://<deine-adresse>/datenschutz.html` eintragen.

## iPhone (App Store)
1. Apple-Entwicklerprogramm (99 US-Dollar pro Jahr). Zum Bauen braucht man einen Mac mit Xcode.
2. PWABuilder → **iOS** erzeugt ein Xcode-Projekt. Auf dem Mac öffnen, signieren, hochladen.
Ohne App Store geht es auf dem iPhone schon jetzt: Safari → Teilen → „Zum Home-Bildschirm“. Benachrichtigungen funktionieren auf dem iPhone nur so (ab iOS 16.4).

## Vor der Veröffentlichung
- Impressum und Datenschutz in `public/datenschutz.html` und im Spiel (Allianz-Seite unten) ausfüllen.
- Echtgeld-Käufe: in den Stores nur über deren Bezahlsystem (Google Play Billing / Apple In-App-Kauf). Der Shop im Spiel ist dafür vorbereitet („Edelsteine“ → „Bald“).
- Altersfreigabe-Fragebogen (IARC) in der Play Console ausfüllen.
