# 💞 DUO ARENA

**Zu zweit. Gegeneinander. Zusammen.**

Eure eigene Spiele-App für zwei – mit euren Karikaturen in jedem Spiel, Live-Duellen übers Internet, Chat, Highscores und Outfits.

---

## 🎮 Was drin ist

| Spiel | Art | Was passiert |
|---|---|---|
| ⚽ **Kopfball-Duell** | Live 1 gegen 1 | Big-Head-Fußball: jede steht vor ihrem Tor, 90 Sekunden, Köpfen & Schießen |
| 🎯 **Drop Zone** | Live 1 gegen 1 | Battle Royale von oben: Absprung, Waffen & Westen looten, Zone schrumpft, Best of 3 |
| 🏒 **Air-Hockey** | Live 1 gegen 1 | Jede sieht ihre eigene Seite unten, euer Gesicht ist der Schläger |
| 🃏 **Mau-Mau** | Live 1 gegen 1 | Kartenspiel – König, Dame und Bube zeigen eure Gesichter |
| 🔴 **Vier gewinnt** | Live 1 gegen 1 | Die Spielchips tragen eure Köpfe |
| 👻 **Geister-Jagd** | Solo-Rekord | Pac-Man: du bist der Fresser, die Geister haben das Gesicht der anderen |
| 🏃 **Gleis-Sprint** | Solo-Rekord | Subway-Surfers-Style: eine rennt, die andere ist die Wächterin, die verfolgt |

Alle Duelle lassen sich auch **gegen den Computer** üben, wenn die andere gerade nicht online ist.

Außerdem:
- 🎬 Animiertes Intro mit euch beiden
- 👤 Profile mit Benutzername – ohne Anmeldung, ohne Passwort
- 💬 Chat – auch **während** der Spiele (💬-Knopf oben rechts) + Emoji-Reaktionen in Live-Duellen
- 📨 Herausforderungen: Spiel antippen → „Live gegen …“ → die andere bekommt sofort eine Einladung
- 🏆 Highscores: Duell-Bilanz, Rekordlisten, letzte Matches
- 👑 Outfit-Shop: Hüte, Brillen, Shirts, Spuren – mit Münzen, die ihr beim Spielen verdient
- 📲 Lässt sich wie eine echte App auf den Home-Bildschirm legen

---

## ▶️ Sofort ausprobieren (auf deinem Computer)

Du brauchst nur **Python 3.8 oder neuer** – sonst nichts, keine Installation von Paketen.

```bash
python app.py
```

Dann im Browser **http://localhost:8000** öffnen.

- **Windows:** Doppelklick auf `start_windows.bat` (falls „python“ nicht gefunden wird: `py app.py` eingeben)
- **Mac/Linux:** `./start_mac_linux.sh`

**Im selben WLAN mit dem Handy spielen:** Finde die IP deines Computers heraus (z. B. `192.168.0.23`) und öffne auf dem Handy `http://192.168.0.23:8000`.

---

## 🌍 Online stellen – damit ihr von überall zusammen spielen könnt

Kostenlos mit **Render.com** + **GitHub**. Dauert ca. 15 Minuten, nur einmal.

### Schritt 1 – Code zu GitHub
1. Konto auf **github.com** erstellen (falls noch nicht vorhanden).
2. Oben rechts **„+“ → „New repository“**, Name z. B. `duoarena`, gern **Private** → **Create repository**.
3. Auf „**uploading an existing file**“ klicken und **den Inhalt** des Ordners `duoarena` hineinziehen (also `app.py`, den Ordner `static`, `render.yaml` usw.) → **Commit changes**.

### Schritt 2 – Speicherplatz für Profile & Highscores (wichtig!)
Der kostenlose Render-Server vergisst Dateien, wenn er schlafen geht. Darum speichert DUO ARENA eure Daten zusätzlich in einem privaten GitHub-„Gist“:

1. Öffne **gist.github.com**.
2. Dateiname: `duoarena.json`, Inhalt: `{}` → **Create secret gist**.
3. In der Adresszeile steht jetzt z. B. `gist.github.com/deinname/`**`a1b2c3d4e5f6...`** – diese lange Zeichenfolge ist deine **GIST_ID**. Kopieren.
4. Gehe zu **github.com → Profilbild → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**.
5. Name: `duoarena`, Ablauf: „No expiration“, **nur den Haken bei `gist`** setzen → **Generate token**.
6. Den Token (beginnt mit `ghp_…`) kopieren – das ist dein **GITHUB_TOKEN**. Er wird nur einmal angezeigt!

### Schritt 3 – Auf Render starten
1. Auf **render.com** mit deinem GitHub-Konto anmelden.
2. **New → Web Service** → dein Repository `duoarena` auswählen.
3. Einstellungen:
   - **Runtime:** Python
   - **Build Command:** `echo ok`
   - **Start Command:** `python app.py`
   - **Instance Type:** Free
4. Unter **Environment Variables** zwei Einträge anlegen:
   - `GIST_ID` = deine Gist-ID aus Schritt 2
   - `GITHUB_TOKEN` = dein Token aus Schritt 2
5. **Create Web Service** – nach 1–2 Minuten bekommst du eine Adresse wie `https://duoarena-xxxx.onrender.com`.

### Schritt 4 – Auf beide Handys
1. Adresse auf beiden Handys öffnen.
2. **iPhone:** Teilen-Symbol → „Zum Home-Bildschirm“. **Android:** Menü ⋮ → „App installieren“.
3. Jede erstellt ihr Profil (Benutzername + Charakter) – fertig! 💞

> **Hinweis zum Gratis-Server:** Wenn 15 Minuten niemand spielt, schläft er ein. Beim nächsten Öffnen dauert es dann bis zu einer Minute, bis die App erscheint – danach läuft alles flüssig. Eure Daten bleiben dank Gist erhalten.

---

## 🕹️ Steuerung

| Spiel | Handy | Computer |
|---|---|---|
| Kopfball-Duell | ◀ ▶ laufen, ⤒ springen, ⚽ schießen | Pfeile/WASD, X = schießen |
| Drop Zone | linker Stick laufen, rechter Stick zielen + feuern | WASD + Maus zielen/klicken |
| Air-Hockey | Finger ziehen | Maus ziehen / Pfeiltasten |
| Geister-Jagd | wischen oder Steuerkreuz | Pfeiltasten |
| Gleis-Sprint | wischen ← → ↑ ↓ | Pfeiltasten |
| Mau-Mau / Vier gewinnt | antippen | klicken |

**Mau-Mau-Regeln:** gleiche Farbe oder gleicher Wert. 7 = nächste zieht 2 (stapelbar), 8 = aussetzen, Bube = Wunschfarbe. Kannst du nicht, tippe den Stapel zum Ziehen.

**Münzen:** Live-Duell gewonnen +40, verloren +12 · gegen Computer +15/+5 · Solo-Spiele je nach Punkten.

---

## 🧩 Aufbau (für Neugierige)

```
duoarena/
├── app.py              ← der komplette Python-Server (nur Standardbibliothek)
│                         HTTP + eigenes WebSocket-Protokoll, Profile, Chat,
│                         Einladungen, Räume, Highscores, Shop,
│                         Mau-Mau- & Vier-gewinnt-Logik inkl. Computer-Gegner
├── static/
│   ├── index.html      ← die App-Oberfläche
│   ├── css/style.css
│   ├── img/            ← eure Karikaturen (Köpfe & Ganzkörper), Logo, App-Icons
│   └── js/
│       ├── core.js     ← Netzwerk, Sound, Spiel-Rahmen, Steuerung
│       ├── draw.js     ← zeichnet eure Charaktere + Outfits
│       ├── ui.js       ← Intro, Profile, Menü, Chat, Highscores, Shop
│       └── games/      ← die 7 Spiele
├── render.yaml         ← Render-Konfiguration
└── data/               ← wird automatisch angelegt (eure Spielstände)
```

Der Server ist in Python geschrieben. Die Spiele selbst laufen – wie bei jeder Handy-Web-App – im Browser (JavaScript/Canvas), weil Handys Python nicht direkt ausführen können. So läuft alles flüssig auf iPhone und Android, ohne App Store.

**Einstellungen per Umgebungsvariable:** `PORT` (Standard 8000), `DATA_DIR` (Standard `./data`), `GIST_ID` + `GITHUB_TOKEN` (optionaler Cloud-Speicher).
