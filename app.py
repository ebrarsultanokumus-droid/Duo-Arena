#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DUO ARENA – Server
==================
Ein kompletter Spiele-Server für zwei Personen, geschrieben in reinem Python
(nur Standardbibliothek, keine Installation nötig).

Er liefert die App an den Browser aus und hält per WebSocket alles live
zusammen: Profile, Chat, Einladungen, Live-Duelle, Highscores, Outfits.
Die Kartenspiele (Mau-Mau, Vier gewinnt) laufen komplett hier auf dem Server,
inklusive Computer-Gegner.

Starten:   python app.py            (dann http://localhost:8000 öffnen)
Port:      Umgebungsvariable PORT   (Standard 8000)
Daten:     Umgebungsvariable DATA_DIR (Standard ./data)
"""
import asyncio
import base64
import gzip
import hashlib
import json
import mimetypes
import os
import random
import struct
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DATA_DIR = Path(os.environ.get("DATA_DIR", str(ROOT / "data")))
DATA_FILE = DATA_DIR / "duoarena.json"
PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("HOST", "0.0.0.0")
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_FRAME = 1 << 20

SOLO_GAMES = ("pacman", "runner")
DUEL_GAMES = ("soccer", "airhockey", "dropzone", "connect4", "maumau")
TURN_GAMES = ("connect4", "maumau")

# --------------------------------------------------------------------------
# Shop / Outfits (Preise liegen auf dem Server, damit niemand schummelt)
# --------------------------------------------------------------------------
SHOP = {
    "hat": [
        {"id": "none", "name": "Nichts", "price": 0},
        {"id": "cap", "name": "Basecap", "price": 40},
        {"id": "party", "name": "Partyhut", "price": 60},
        {"id": "headphones", "name": "Kopfhörer", "price": 90},
        {"id": "flowers", "name": "Blumenkranz", "price": 120},
        {"id": "crown", "name": "Krone", "price": 200},
        {"id": "halo", "name": "Heiligenschein", "price": 150},
        {"id": "horns", "name": "Teufelshörner", "price": 150},
    ],
    "glasses": [
        {"id": "none", "name": "Keine", "price": 0},
        {"id": "shades", "name": "Sonnenbrille", "price": 50},
        {"id": "hearts", "name": "Herzbrille", "price": 80},
        {"id": "stars", "name": "Sternbrille", "price": 80},
        {"id": "nerd", "name": "Nerdbrille", "price": 60},
    ],
    "shirt": [
        {"id": "default", "name": "Original", "price": 0},
        {"id": "pink", "name": "Pink", "price": 30},
        {"id": "red", "name": "Rot", "price": 30},
        {"id": "blue", "name": "Royalblau", "price": 30},
        {"id": "mint", "name": "Mint", "price": 30},
        {"id": "black", "name": "Schwarz", "price": 30},
        {"id": "gold", "name": "Gold", "price": 150},
        {"id": "galaxy", "name": "Galaxy", "price": 250},
    ],
    "trail": [
        {"id": "none", "name": "Keine Spur", "price": 0},
        {"id": "sparkle", "name": "Glitzer", "price": 70},
        {"id": "hearts", "name": "Herzen", "price": 90},
        {"id": "fire", "name": "Feuer", "price": 120},
        {"id": "rainbow", "name": "Regenbogen", "price": 180},
    ],
}
FREE_ITEMS = ["hat:none", "glasses:none", "shirt:default", "trail:none"]


def shop_price(slot, item):
    for it in SHOP.get(slot, []):
        if it["id"] == item:
            return it["price"]
    return None


# --------------------------------------------------------------------------
# Datenspeicher (JSON-Datei, atomar geschrieben)
# --------------------------------------------------------------------------
class Store:
    """Speichert alles in einer JSON-Datei. Optional zusätzlich in einem
    privaten GitHub-Gist (GIST_ID + GITHUB_TOKEN), damit die Daten auch auf
    kostenlosen Hostern ohne festen Speicher (z. B. Render Free) erhalten bleiben."""

    GIST_FILE = "duoarena.json"

    def __init__(self, path):
        self.path = path
        self.data = {"profiles": {}, "chat": [], "scores": {}, "duels": {}, "history": []}
        self._dirty = False
        self._gist_dirty = False
        self._gist_last = 0.0
        self.gist_id = os.environ.get("GIST_ID", "").strip()
        self.gist_token = os.environ.get("GITHUB_TOKEN", "").strip()
        self.load()

    @property
    def gist_on(self):
        return bool(self.gist_id and self.gist_token)

    def _apply(self, d):
        for k in self.data:
            if k in d:
                self.data[k] = d[k]

    def load(self):
        loaded = False
        if self.gist_on:
            try:
                d = self._gist_request("GET")
                content = d.get("files", {}).get(self.GIST_FILE, {}).get("content")
                if content:
                    self._apply(json.loads(content))
                    loaded = True
                    log("Daten aus GitHub-Gist geladen:", len(self.data["profiles"]), "Profile")
            except Exception as e:
                log("Gist konnte nicht gelesen werden:", e)
        if loaded:
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                self._apply(json.load(f))
            log("Daten geladen:", len(self.data["profiles"]), "Profile")
        except FileNotFoundError:
            pass
        except Exception as e:  # beschädigte Datei nicht überschreiben
            log("Konnte Daten nicht lesen:", e)
            try:
                os.replace(self.path, str(self.path) + ".broken")
            except OSError:
                pass

    def mark(self):
        self._dirty = True
        self._gist_dirty = True

    def save(self):
        if not self._dirty:
            return
        self._dirty = False
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp = str(self.path) + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False)
        os.replace(tmp, self.path)

    def gist_due(self, force=False):
        return self.gist_on and self._gist_dirty and (force or time.time() - self._gist_last > 20)

    def gist_push(self):
        """Läuft in einem Hintergrund-Thread."""
        self._gist_dirty = False
        self._gist_last = time.time()
        body = json.dumps(self.data, ensure_ascii=False)
        try:
            self._gist_request("PATCH", {"files": {self.GIST_FILE: {"content": body}}})
        except Exception as e:
            self._gist_dirty = True
            log("Gist-Speichern fehlgeschlagen:", e)

    def _gist_request(self, method, payload=None):
        import urllib.request
        req = urllib.request.Request(
            "https://api.github.com/gists/" + self.gist_id, method=method,
            data=json.dumps(payload).encode("utf-8") if payload is not None else None,
            headers={"Authorization": "Bearer " + self.gist_token, "Accept": "application/vnd.github+json",
                     "User-Agent": "duoarena", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode("utf-8"))

    # ---- Profile
    @property
    def profiles(self):
        return self.data["profiles"]

    def public_profile(self, pid):
        if pid == "cpu":
            return {"id": "cpu", "name": "Computer", "char": "cpu", "outfit": {}, "color": "#7c8cff"}
        p = self.profiles.get(pid)
        if not p:
            return None
        return {k: p[k] for k in ("id", "name", "char", "outfit", "color", "coins", "owned", "created")}

    # ---- Ergebnisse
    def add_score(self, pid, game, score):
        lst = self.data["scores"].setdefault(game, [])
        lst.append({"pid": pid, "score": int(score), "ts": int(time.time())})
        lst.sort(key=lambda e: -e["score"])
        del lst[50:]
        self.mark()

    def add_duel(self, game, players, winner_idx, score_text=""):
        """players: [pidA, pidB]; winner_idx: 0, 1 oder -1 (unentschieden)."""
        g = self.data["duels"].setdefault(game, {})
        for i, pid in enumerate(players):
            if pid == "cpu":
                continue
            rec = g.setdefault(pid, {"w": 0, "l": 0, "d": 0, "cpu_w": 0, "cpu_l": 0})
            vs_cpu = "cpu" in players
            if winner_idx == -1:
                rec["d"] += 1
            elif winner_idx == i:
                rec["cpu_w" if vs_cpu else "w"] += 1
            else:
                rec["cpu_l" if vs_cpu else "l"] += 1
        self.data["history"].insert(0, {
            "game": game, "players": players, "winner": winner_idx,
            "score": score_text, "ts": int(time.time()),
        })
        del self.data["history"][40:]
        self.mark()

    def add_coins(self, pid, n):
        p = self.profiles.get(pid)
        if p:
            p["coins"] = max(0, int(p.get("coins", 0)) + int(n))
            self.mark()


def log(*a):
    print(time.strftime("[%H:%M:%S]"), *a, flush=True)


STORE = Store(DATA_FILE)

# --------------------------------------------------------------------------
# Spiel-Logik auf dem Server: Vier gewinnt
# --------------------------------------------------------------------------
class Connect4:
    COLS, ROWS = 7, 6

    def __init__(self):
        self.tally = [0, 0]
        self.starter = random.randint(0, 1)
        self.reset()

    def reset(self):
        self.board = [[-1] * self.ROWS for _ in range(self.COLS)]  # board[col][row], row 0 = unten
        self.turn = self.starter
        self.winner = None  # 0/1, -1 = unentschieden
        self.line = []
        self.last = None
        self.moves = 0

    def drop_row(self, board, c):
        for r in range(self.ROWS):
            if board[c][r] == -1:
                return r
        return None

    def find_line(self, board, c, r, who):
        for dc, dr in ((1, 0), (0, 1), (1, 1), (1, -1)):
            cells = [(c, r)]
            for s in (1, -1):
                cc, rr = c + dc * s, r + dr * s
                while 0 <= cc < self.COLS and 0 <= rr < self.ROWS and board[cc][rr] == who:
                    cells.append((cc, rr))
                    cc += dc * s
                    rr += dr * s
            if len(cells) >= 4:
                return cells
        return None

    def move(self, idx, d):
        if self.winner is not None:
            if d.get("action") == "again":
                self.starter = 1 - self.starter
                self.reset()
                return None
            return "Runde ist vorbei"
        if idx != self.turn:
            return "Du bist nicht dran"
        try:
            c = int(d.get("col"))
        except (TypeError, ValueError):
            return "Ungültige Spalte"
        if not 0 <= c < self.COLS:
            return "Ungültige Spalte"
        r = self.drop_row(self.board, c)
        if r is None:
            return "Spalte ist voll"
        self.board[c][r] = idx
        self.last = [c, r]
        self.moves += 1
        line = self.find_line(self.board, c, r, idx)
        if line:
            self.winner = idx
            self.line = line
            self.tally[idx] += 1
        elif self.moves >= self.COLS * self.ROWS:
            self.winner = -1
        else:
            self.turn = 1 - idx
        return None

    def view(self, idx):
        return {"board": self.board, "turn": self.turn, "winner": self.winner, "line": self.line,
                "last": self.last, "tally": self.tally}

    def finished(self):
        return self.winner is not None

    # ---- Computer-Gegner (Minimax mit Alpha-Beta)
    def _score_window(self, w, me):
        opp = 1 - me
        if w.count(me) == 4:
            return 1000
        if w.count(me) == 3 and w.count(-1) == 1:
            return 6
        if w.count(me) == 2 and w.count(-1) == 2:
            return 2
        if w.count(opp) == 3 and w.count(-1) == 1:
            return -8
        return 0

    def _evaluate(self, b, me):
        s = sum(3 for r in range(self.ROWS) if b[3][r] == me)
        for c in range(self.COLS):
            for r in range(self.ROWS):
                for dc, dr in ((1, 0), (0, 1), (1, 1), (1, -1)):
                    ec, er = c + 3 * dc, r + 3 * dr
                    if 0 <= ec < self.COLS and 0 <= er < self.ROWS:
                        s += self._score_window([b[c + i * dc][r + i * dr] for i in range(4)], me)
        return s

    def _minimax(self, b, depth, alpha, beta, maxi, me, last):
        if last is not None:
            c, r, who = last
            if self.find_line(b, c, r, who):
                return (100000 + depth) if who == me else -(100000 + depth)
        valid = [c for c in (3, 2, 4, 1, 5, 0, 6) if b[c][self.ROWS - 1] == -1]
        if depth == 0 or not valid:
            return self._evaluate(b, me)
        who = me if maxi else 1 - me
        best = -10 ** 9 if maxi else 10 ** 9
        for c in valid:
            r = self.drop_row(b, c)
            b[c][r] = who
            v = self._minimax(b, depth - 1, alpha, beta, not maxi, me, (c, r, who))
            b[c][r] = -1
            if maxi:
                best = max(best, v)
                alpha = max(alpha, v)
            else:
                best = min(best, v)
                beta = min(beta, v)
            if alpha >= beta:
                break
        return best

    def cpu_action(self, idx):
        if self.winner is not None or self.turn != idx:
            return None
        b = [col[:] for col in self.board]
        valid = [c for c in range(self.COLS) if b[c][self.ROWS - 1] == -1]
        if random.random() < 0.12:  # ab und zu ein kleiner Fehler – macht es menschlicher
            return {"col": random.choice(valid)}
        scored = []
        for c in valid:
            r = self.drop_row(b, c)
            b[c][r] = idx
            v = self._minimax(b, 4, -10 ** 9, 10 ** 9, False, idx, (c, r, idx))
            b[c][r] = -1
            scored.append((v + random.random(), c))
        scored.sort(reverse=True)
        return {"col": scored[0][1]}


# --------------------------------------------------------------------------
# Spiel-Logik auf dem Server: Mau-Mau
# --------------------------------------------------------------------------
SUITS = ["C", "S", "H", "D"]  # Kreuz, Pik, Herz, Karo
RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"]


class MauMau:
    HAND = 5

    def __init__(self):
        self.tally = [0, 0]
        self.starter = random.randint(0, 1)
        self.reset()

    def reset(self):
        deck = [s + r for s in SUITS for r in RANKS]
        random.shuffle(deck)
        self.hands = [[deck.pop() for _ in range(self.HAND)] for _ in range(2)]
        self.pile = [deck.pop()]
        self.deck = deck
        self.wish = None
        self.pending7 = 0
        self.turn = self.starter
        self.phase = "play"  # play | drawn
        self.winner = None
        self.log = []
        self.event = None
        self.say("Neue Runde! Oben liegt " + self.card_name(self.pile[-1]) + ".")

    @staticmethod
    def suit(c):
        return c[0]

    @staticmethod
    def rank(c):
        return c[1:]

    @staticmethod
    def card_name(c):
        names = {"C": "Kreuz", "S": "Pik", "H": "Herz", "D": "Karo"}
        rn = {"J": "Bube", "Q": "Dame", "K": "König", "A": "Ass"}
        return names[c[0]] + " " + rn.get(c[1:], c[1:])

    def say(self, text):
        self.log.append(text)
        del self.log[:-6]

    def current_suit(self):
        return self.wish or self.suit(self.pile[-1])

    def playable(self, c):
        top = self.pile[-1]
        if self.pending7:
            return self.rank(c) == "7"
        if self.rank(c) == "J":
            return self.rank(top) != "J" or self.wish is not None
        if self.suit(c) == self.current_suit():
            return True
        return self.rank(c) == self.rank(top) and self.wish is None

    def draw_cards(self, idx, n):
        got = []
        for _ in range(n):
            if not self.deck:
                top = self.pile.pop()
                self.deck = self.pile
                random.shuffle(self.deck)
                self.pile = [top]
            if not self.deck:
                break
            c = self.deck.pop()
            self.hands[idx].append(c)
            got.append(c)
        return got

    def move(self, idx, d, names=("Spieler 1", "Spieler 2")):
        act = d.get("action")
        if self.winner is not None:
            if act == "again":
                self.starter = 1 - self.starter
                self.reset()
                return None
            return "Runde ist vorbei"
        if idx != self.turn:
            return "Du bist nicht dran"
        me = names[idx]
        self.event = None
        if act == "play":
            c = d.get("card")
            if c not in self.hands[idx]:
                return "Diese Karte hast du nicht"
            if not self.playable(c):
                return "Die Karte passt nicht"
            self.hands[idx].remove(c)
            self.pile.append(c)
            self.wish = None
            self.phase = "play"
            r = self.rank(c)
            self.event = {"type": "play", "who": idx, "card": c}
            if r == "J":
                w = d.get("wish")
                if w not in SUITS:
                    w = self.suit(c)
                self.wish = w
                self.say(me + " legt Bube und wünscht sich " + {"C": "Kreuz", "S": "Pik", "H": "Herz", "D": "Karo"}[w] + ".")
            elif r == "7":
                self.pending7 += 2
                self.say(me + " legt eine 7 – " + str(self.pending7) + " Karten ziehen!")
            elif r == "8":
                self.say(me + " legt eine 8 – aussetzen!")
            else:
                self.say(me + " legt " + self.card_name(c) + ".")
            if not self.hands[idx]:
                self.winner = idx
                self.tally[idx] += 1
                self.say(me + " ruft MAU-MAU! 🎉")
                self.event = {"type": "win", "who": idx}
                return None
            if len(self.hands[idx]) == 1:
                self.say(me + " ruft: Mau!")
                self.event = {"type": "mau", "who": idx, "card": c}
            if r != "8":
                self.turn = 1 - idx
            return None
        if act == "draw":
            if self.phase == "drawn":
                return "Du hast schon gezogen"
            if self.pending7:
                n = self.pending7
                self.pending7 = 0
                self.draw_cards(idx, n)
                self.say(me + " zieht " + str(n) + " Karten.")
                self.turn = 1 - idx
                self.event = {"type": "draw", "who": idx, "n": n}
                return None
            self.draw_cards(idx, 1)
            self.phase = "drawn"
            self.say(me + " zieht eine Karte.")
            self.event = {"type": "draw", "who": idx, "n": 1}
            return None
        if act == "pass":
            if self.phase != "drawn":
                return "Erst ziehen"
            self.phase = "play"
            self.turn = 1 - idx
            self.say(me + " passt.")
            return None
        return "Unbekannte Aktion"

    def view(self, idx):
        hand = sorted(self.hands[idx], key=lambda c: (SUITS.index(c[0]), RANKS.index(c[1:])))
        return {
            "hand": hand,
            "playable": [c for c in hand if self.turn == idx and self.winner is None and self.playable(c)],
            "opp": len(self.hands[1 - idx]),
            "oppHand": self.hands[1 - idx] if self.winner is not None else None,
            "top": self.pile[-1], "under": self.pile[-4:-1], "deck": len(self.deck),
            "wish": self.wish, "pending7": self.pending7, "turn": self.turn, "phase": self.phase,
            "winner": self.winner, "log": self.log, "tally": self.tally, "event": self.event,
        }

    def finished(self):
        return self.winner is not None

    def cpu_action(self, idx):
        if self.winner is not None or self.turn != idx:
            return None
        hand = self.hands[idx]
        ok = [c for c in hand if self.playable(c)]
        if ok:
            opp_few = len(self.hands[1 - idx]) <= 2

            def prio(c):
                r = self.rank(c)
                p = 0
                if r == "J":
                    p -= 10
                if r in ("7", "8"):
                    p += 6 if opp_few else 1
                p += sum(1 for h in hand if h[0] == c[0])
                return p + random.random()

            c = max(ok, key=prio)
            wish = None
            if self.rank(c) == "J":
                rest = [h for h in hand if h != c and self.rank(h) != "J"]
                counts = {s: sum(1 for h in rest if h[0] == s) for s in SUITS}
                wish = max(SUITS, key=lambda s: (counts[s], random.random()))
            return {"action": "play", "card": c, "wish": wish}
        if self.phase == "drawn":
            return {"action": "pass"}
        return {"action": "draw"}


# --------------------------------------------------------------------------
# WebSocket-Verbindung
# --------------------------------------------------------------------------
class Client:
    def __init__(self, reader, writer, addr):
        self.reader = reader
        self.writer = writer
        self.addr = addr
        self.pid = None
        self.room = None
        self.alive = True
        self.last_seen = time.time()
        self.cid = uuid.uuid4().hex[:8]

    def send(self, obj):
        if not self.alive:
            return
        try:
            data = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            self.writer.write(ws_frame(data, 1))
            if self.writer.transport.get_write_buffer_size() > 4 * MAX_FRAME:
                log("Client hängt hinterher – trenne", self.cid)
                self.close()
        except Exception:
            self.close()

    def close(self):
        if self.alive:
            self.alive = False
            try:
                self.writer.write(ws_frame(b"", 8))
                self.writer.close()
            except Exception:
                pass


def ws_frame(payload, opcode=1):
    n = len(payload)
    head = bytes([0x80 | opcode])
    if n < 126:
        head += bytes([n])
    elif n < 65536:
        head += bytes([126]) + struct.pack("!H", n)
    else:
        head += bytes([127]) + struct.pack("!Q", n)
    return head + payload


def ws_unmask(data, mask):
    n = len(data)
    if n == 0:
        return data
    m = (mask * (n // 4 + 1))[:n]
    return (int.from_bytes(data, "big") ^ int.from_bytes(m, "big")).to_bytes(n, "big")


async def ws_read_message(reader):
    """Liest eine komplette Nachricht. Gibt (opcode, bytes) zurück."""
    parts = []
    first_op = None
    while True:
        h = await reader.readexactly(2)
        fin = h[0] & 0x80
        op = h[0] & 0x0F
        masked = h[1] & 0x80
        n = h[1] & 0x7F
        if n == 126:
            n = struct.unpack("!H", await reader.readexactly(2))[0]
        elif n == 127:
            n = struct.unpack("!Q", await reader.readexactly(8))[0]
        if n > MAX_FRAME:
            raise ValueError("Nachricht zu groß")
        mask = await reader.readexactly(4) if masked else b""
        data = await reader.readexactly(n) if n else b""
        if masked:
            data = ws_unmask(data, mask)
        if op >= 8:  # Steuerframes dürfen zwischendurch kommen
            return op, data
        if op != 0:
            first_op = op
        parts.append(data)
        if fin:
            return first_op or 1, b"".join(parts)


# --------------------------------------------------------------------------
# Räume (Live-Duelle & Kartenspiele)
# --------------------------------------------------------------------------
class Room:
    def __init__(self, game, players):
        self.id = uuid.uuid4().hex[:10]
        self.game = game
        self.players = players  # [pid, pid|"cpu"]
        self.clients = {}  # pid -> Client
        self.cpu = "cpu" in players
        self.logic = None
        self.closed = False
        self.gone_since = {}
        self.recorded_rounds = 0
        self.seed = random.randint(1, 10 ** 9)
        if game == "connect4":
            self.logic = Connect4()
        elif game == "maumau":
            self.logic = MauMau()

    def idx_of(self, pid):
        return self.players.index(pid)

    def names(self):
        return [STORE.public_profile(p)["name"] if STORE.public_profile(p) else "?" for p in self.players]

    def start_payload(self, pid):
        return {"t": "room_start", "room": {
            "id": self.id, "game": self.game, "you": self.idx_of(pid), "cpu": self.cpu,
            "players": [STORE.public_profile(p) for p in self.players],
            "seed": self.seed,
        }}

    def send_to(self, pid, obj):
        c = self.clients.get(pid)
        if c and c.alive:
            c.send(obj)

    def push_state(self):
        if not self.logic:
            return
        for i, pid in enumerate(self.players):
            if pid != "cpu":
                self.send_to(pid, {"t": "state", "room": self.id, "s": self.logic.view(i)})


class Hub:
    def __init__(self):
        self.clients = set()
        self.rooms = {}
        self.invites = {}  # id -> {id, from, game, ts}

    # ---- Hilfsfunktionen
    def online_pids(self):
        return sorted({c.pid for c in self.clients if c.pid and c.alive})

    def clients_of(self, pid):
        return [c for c in self.clients if c.pid == pid and c.alive]

    def broadcast(self, obj, exclude=None):
        for c in list(self.clients):
            if c is not exclude and c.pid:
                c.send(obj)

    def push_presence(self):
        self.broadcast({"t": "online", "pids": self.online_pids()})

    def push_profiles(self):
        self.broadcast({"t": "profiles", "profiles": [STORE.public_profile(p) for p in STORE.profiles]})

    def push_scores(self):
        self.broadcast({"t": "scores", "scores": STORE.data["scores"], "duels": STORE.data["duels"],
                        "history": STORE.data["history"]})

    def welcome(self, c):
        c.send({
            "t": "welcome",
            "me": STORE.public_profile(c.pid) if c.pid else None,
            "profiles": [STORE.public_profile(p) for p in STORE.profiles],
            "chat": STORE.data["chat"][-120:],
            "scores": STORE.data["scores"], "duels": STORE.data["duels"], "history": STORE.data["history"],
            "online": self.online_pids(), "shop": SHOP,
            "invites": [i for i in self.invites.values() if i["from"] != c.pid],
        })

    # ---- Eingehende Nachrichten
    async def handle(self, c, msg):
        t = msg.get("t")
        fn = getattr(self, "on_" + str(t), None)
        if fn is None:
            return
        if t not in ("hello", "create_profile", "ping") and not c.pid:
            c.send({"t": "error", "msg": "Bitte zuerst ein Profil wählen."})
            return
        r = fn(c, msg)
        if asyncio.iscoroutine(r):
            await r

    def on_ping(self, c, m):
        c.send({"t": "pong", "ts": m.get("ts")})

    def on_hello(self, c, m):
        pid = m.get("pid")
        if pid in STORE.profiles:
            c.pid = pid
            STORE.profiles[pid]["last"] = int(time.time())
            STORE.mark()
        self.welcome(c)
        if c.pid:
            self.push_presence()
            rid = m.get("room")
            room = self.rooms.get(rid) if rid else None
            if room and not room.closed and c.pid in room.players:
                room.clients[c.pid] = c
                room.gone_since.pop(c.pid, None)
                c.room = room
                c.send({"t": "room_resume", "room": room.id})
                room.push_state()
                for pid in room.players:
                    if pid != c.pid:
                        room.send_to(pid, {"t": "partner_back"})
            elif rid:
                c.send({"t": "room_end", "room": rid, "reason": "Das Spiel wurde beendet."})

    def on_create_profile(self, c, m):
        name = str(m.get("name", "")).strip()[:18]
        char = m.get("char")
        if not name or char not in ("a", "b"):
            c.send({"t": "error", "msg": "Bitte Namen und Charakter wählen."})
            return
        if any(p["name"].lower() == name.lower() for p in STORE.profiles.values()):
            c.send({"t": "error", "msg": "Den Namen gibt es schon – nimm einen anderen."})
            return
        pid = uuid.uuid4().hex[:12]
        STORE.profiles[pid] = {
            "id": pid, "name": name, "char": char,
            "color": str(m.get("color") or ("#ff4fa3" if char == "a" else "#7c5cff"))[:9],
            "coins": 100, "owned": list(FREE_ITEMS),
            "outfit": {"hat": "none", "glasses": "none", "shirt": "default", "trail": "none"},
            "created": int(time.time()), "last": int(time.time()),
        }
        STORE.mark()
        c.pid = pid
        c.send({"t": "profile_created", "me": STORE.public_profile(pid)})
        self.welcome(c)
        self.push_profiles()
        self.push_presence()
        log("Neues Profil:", name)

    def on_update_profile(self, c, m):
        p = STORE.profiles[c.pid]
        if "name" in m:
            name = str(m["name"]).strip()[:18]
            if name and not any(q["name"].lower() == name.lower() and q["id"] != c.pid for q in STORE.profiles.values()):
                p["name"] = name
        if m.get("char") in ("a", "b"):
            p["char"] = m["char"]
        if isinstance(m.get("color"), str) and m["color"].startswith("#"):
            p["color"] = m["color"][:9]
        if isinstance(m.get("outfit"), dict):
            for slot, item in m["outfit"].items():
                if slot in SHOP and (slot + ":" + str(item)) in p["owned"]:
                    p["outfit"][slot] = item
        STORE.mark()
        self.push_profiles()

    def on_buy(self, c, m):
        p = STORE.profiles[c.pid]
        slot, item = m.get("slot"), m.get("item")
        price = shop_price(slot, item)
        key = str(slot) + ":" + str(item)
        if price is None:
            return
        if key in p["owned"]:
            p["outfit"][slot] = item
        elif p["coins"] < price:
            c.send({"t": "error", "msg": "Nicht genug Münzen – spiel noch eine Runde! 🪙"})
            return
        else:
            p["coins"] -= price
            p["owned"].append(key)
            p["outfit"][slot] = item
            c.send({"t": "toast", "msg": "Gekauft! Steht dir super ✨", "kind": "ok"})
        STORE.mark()
        self.push_profiles()

    def on_chat(self, c, m):
        text = str(m.get("text", "")).strip()[:500]
        if not text:
            return
        p = STORE.profiles[c.pid]
        msg = {"id": uuid.uuid4().hex[:10], "pid": c.pid, "name": p["name"], "char": p["char"],
               "text": text, "ts": int(time.time() * 1000)}
        if m.get("game"):
            msg["game"] = str(m["game"])[:20]
        STORE.data["chat"].append(msg)
        del STORE.data["chat"][:-300]
        STORE.mark()
        self.broadcast({"t": "chat", "msg": msg})

    def on_typing(self, c, m):
        self.broadcast({"t": "typing", "pid": c.pid}, exclude=c)

    def on_score(self, c, m):
        game = m.get("game")
        if game not in SOLO_GAMES:
            return
        try:
            score = max(0, min(int(m.get("score", 0)), 10 ** 7))
        except (TypeError, ValueError):
            return
        lst = STORE.data["scores"].get(game, [])
        best_before = max([e["score"] for e in lst if e["pid"] == c.pid] or [0])
        STORE.add_score(c.pid, game, score)
        coins = min(150, score // (40 if game == "pacman" else 25)) + int(m.get("bonus", 0) or 0) // 5
        coins = max(0, min(coins, 200))
        STORE.add_coins(c.pid, coins)
        c.send({"t": "score_saved", "game": game, "score": score, "coins": coins,
                "record": score > best_before, "best": max(best_before, score)})
        if score > best_before and score > 0:
            p = STORE.profiles[c.pid]
            self.broadcast({"t": "toast", "msg": "🏆 " + p["name"] + " hat einen neuen Rekord in " +
                            ("Geister-Jagd" if game == "pacman" else "Gleis-Sprint") + ": " + str(score),
                            "kind": "record"}, exclude=c)
        self.push_scores()
        self.push_profiles()

    # ---- Einladungen
    def on_invite(self, c, m):
        game = m.get("game")
        if game not in DUEL_GAMES:
            return
        for iid in [i for i, v in self.invites.items() if v["from"] == c.pid]:
            del self.invites[iid]
        inv = {"id": uuid.uuid4().hex[:10], "from": c.pid, "game": game, "ts": int(time.time())}
        self.invites[inv["id"]] = inv
        others = [x for x in self.online_pids() if x != c.pid]
        for x in list(self.clients):
            if x.pid and x.pid != c.pid:
                x.send({"t": "invite", "invite": inv})
        c.send({"t": "invite_sent", "invite": inv, "reach": len(others)})

    def on_invite_cancel(self, c, m):
        for iid in [i for i, v in self.invites.items() if v["from"] == c.pid]:
            del self.invites[iid]
            self.broadcast({"t": "invite_gone", "id": iid})

    def on_invite_reply(self, c, m):
        inv = self.invites.pop(m.get("id"), None)
        if not inv:
            c.send({"t": "error", "msg": "Diese Einladung gibt es nicht mehr."})
            return
        self.broadcast({"t": "invite_gone", "id": inv["id"]})
        if not m.get("accept"):
            for x in self.clients_of(inv["from"]):
                x.send({"t": "invite_declined", "by": STORE.profiles[c.pid]["name"]})
            return
        if inv["from"] == c.pid:
            return
        inviters = self.clients_of(inv["from"])
        if not inviters:
            c.send({"t": "error", "msg": "Die Person ist nicht mehr online."})
            return
        self.open_room(inv["game"], [inv["from"], c.pid], {inv["from"]: inviters[-1], c.pid: c})

    def on_start_cpu(self, c, m):
        game = m.get("game")
        if game not in TURN_GAMES:
            return
        self.open_room(game, [c.pid, "cpu"], {c.pid: c})

    def open_room(self, game, players, clients):
        room = Room(game, players)
        self.rooms[room.id] = room
        for pid, cl in clients.items():
            if cl.room:
                self.leave_room(cl, notify=True)
            room.clients[pid] = cl
            cl.room = room
            cl.send(room.start_payload(pid))
        room.push_state()
        log("Raum geöffnet:", game, room.names())
        if room.cpu:
            asyncio.get_event_loop().create_task(self.cpu_loop(room))

    def leave_room(self, c, notify=True):
        room = c.room
        c.room = None
        if not room or room.closed:
            return
        room.closed = True
        self.rooms.pop(room.id, None)
        if notify:
            for pid, cl in room.clients.items():
                if cl is not c and cl.alive:
                    cl.room = None
                    cl.send({"t": "room_end", "room": room.id,
                             "reason": STORE.profiles.get(c.pid, {}).get("name", "Jemand") + " hat das Spiel verlassen."})

    def on_leave_room(self, c, m):
        self.leave_room(c)

    def on_relay(self, c, m):
        room = c.room
        if not room or room.closed:
            return
        out = {"t": "relay", "d": m.get("d")}
        for pid, cl in room.clients.items():
            if cl is not c:
                cl.send(out)

    def on_rt_result(self, c, m):
        """Ergebnis eines Live-Duells (vom Host gemeldet)."""
        room = c.room
        if not room or room.closed or room.game not in DUEL_GAMES or room.idx_of(c.pid) != 0:
            return
        w = m.get("winner")
        if w not in (0, 1, -1):
            return
        self.record(room, w, str(m.get("score", ""))[:20])

    def record(self, room, w, score_text):
        STORE.add_duel(room.game, room.players, w, score_text)
        for i, pid in enumerate(room.players):
            if pid == "cpu":
                continue
            if room.cpu:
                STORE.add_coins(pid, 15 if w == i else 5)
            else:
                STORE.add_coins(pid, 40 if w == i else (20 if w == -1 else 12))
        self.push_scores()
        self.push_profiles()

    async def on_move(self, c, m):
        room = c.room
        if not room or room.closed or not room.logic:
            return
        idx = room.idx_of(c.pid)
        was_done = room.logic.finished()
        if isinstance(room.logic, MauMau):
            err = room.logic.move(idx, m.get("d") or {}, room.names())
        else:
            err = room.logic.move(idx, m.get("d") or {})
        if err:
            c.send({"t": "toast", "msg": err, "kind": "warn"})
            return
        if room.logic.finished() and not was_done:
            self.record(room, room.logic.winner, "%d:%d" % tuple(room.logic.tally))
        room.push_state()

    async def cpu_loop(self, room):
        ci = room.players.index("cpu")
        while not room.closed:
            await asyncio.sleep(0.25)
            lg = room.logic
            if lg.finished() or lg.turn != ci:
                continue
            await asyncio.sleep(0.6 + random.random() * 0.7)
            if room.closed:
                break
            act = lg.cpu_action(ci)
            if act is None:
                continue
            was_done = lg.finished()
            if isinstance(lg, MauMau):
                lg.move(ci, act, room.names())
            else:
                lg.move(ci, act)
            if lg.finished() and not was_done:
                self.record(room, lg.winner, "%d:%d" % tuple(lg.tally))
            room.push_state()

    # ---- Verbindungsende
    def disconnected(self, c):
        self.clients.discard(c)
        if c.room and not c.room.closed:
            room = c.room
            if room.clients.get(c.pid) is c:
                room.gone_since[c.pid] = time.time()
                for pid, cl in room.clients.items():
                    if cl is not c and cl.alive:
                        cl.send({"t": "partner_lost"})
        if c.pid and not self.clients_of(c.pid):
            for iid in [i for i, v in self.invites.items() if v["from"] == c.pid]:
                del self.invites[iid]
                self.broadcast({"t": "invite_gone", "id": iid})
        self.push_presence()

    async def housekeeping(self):
        while True:
            await asyncio.sleep(2)
            now = time.time()
            for room in list(self.rooms.values()):
                for pid, since in list(room.gone_since.items()):
                    if now - since > 25:
                        room.gone_since.pop(pid, None)
                        cl = room.clients.get(pid)
                        if cl:
                            self.leave_room(cl, notify=True)
                        break
                if not room.closed and all(not cl.alive for cl in room.clients.values()):
                    room.closed = True
                    self.rooms.pop(room.id, None)
            for iid, inv in list(self.invites.items()):
                if now - inv["ts"] > 120:
                    del self.invites[iid]
                    self.broadcast({"t": "invite_gone", "id": iid})
            try:
                STORE.save()
            except Exception as e:
                log("Speichern fehlgeschlagen:", e)
            if STORE.gist_due():
                asyncio.get_event_loop().run_in_executor(None, STORE.gist_push)


HUB = Hub()

# --------------------------------------------------------------------------
# HTTP-Server (liefert die App aus) + WebSocket-Upgrade
# --------------------------------------------------------------------------
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("image/svg+xml", ".svg")
_gzip_cache = {}


def http_response(status, headers, body=b""):
    reason = {200: "OK", 304: "Not Modified", 400: "Bad Request", 404: "Not Found", 405: "Method Not Allowed"}.get(status, "OK")
    lines = ["HTTP/1.1 %d %s" % (status, reason)]
    headers.setdefault("Content-Length", str(len(body)))
    for k, v in headers.items():
        lines.append("%s: %s" % (k, v))
    return ("\r\n".join(lines) + "\r\n\r\n").encode("latin-1") + body


def resolve_static(path):
    path = unquote(urlsplit(path).path)
    if path in ("", "/"):
        path = "/index.html"
    if path == "/manifest.webmanifest":
        path = "/manifest.webmanifest"
    target = (STATIC / path.lstrip("/")).resolve()
    try:
        target.relative_to(STATIC.resolve())
    except ValueError:
        return None
    return target if target.is_file() else None


async def serve_http(reader, writer, method, path, headers):
    if path.startswith("/health"):
        writer.write(http_response(200, {"Content-Type": "text/plain"}, b"ok"))
        await writer.drain()
        return True
    if method not in ("GET", "HEAD"):
        writer.write(http_response(405, {"Content-Type": "text/plain"}, b"nope"))
        await writer.drain()
        return False
    f = resolve_static(path)
    if f is None:
        body = b"Nicht gefunden"
        writer.write(http_response(404, {"Content-Type": "text/plain; charset=utf-8"}, body))
        await writer.drain()
        return True
    st = f.stat()
    etag = '"%x-%x"' % (int(st.st_mtime), st.st_size)
    ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
    if ctype.startswith("text/") or ctype in ("application/json", "application/manifest+json", "image/svg+xml"):
        ctype += "; charset=utf-8"
    hdr = {"Content-Type": ctype, "ETag": etag,
           "Cache-Control": "no-cache" if f.suffix in (".html", ".js", ".css", ".webmanifest") else "public, max-age=86400"}
    if headers.get("if-none-match") == etag:
        writer.write(http_response(304, hdr))
        await writer.drain()
        return True
    body = f.read_bytes()
    if f.suffix in (".html", ".js", ".css", ".svg", ".json", ".webmanifest") and "gzip" in headers.get("accept-encoding", ""):
        key = (str(f), etag)
        if key not in _gzip_cache:
            _gzip_cache[key] = gzip.compress(body, 6)
        body = _gzip_cache[key]
        hdr["Content-Encoding"] = "gzip"
        hdr["Vary"] = "Accept-Encoding"
    hdr["Content-Length"] = str(len(body))
    writer.write(http_response(200, hdr, b"" if method == "HEAD" else body))
    await writer.drain()
    return True


async def serve_ws(reader, writer, headers, addr):
    key = headers.get("sec-websocket-key", "")
    accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
    writer.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                  "Sec-WebSocket-Accept: %s\r\n\r\n" % accept).encode())
    await writer.drain()
    c = Client(reader, writer, addr)
    HUB.clients.add(c)

    async def pinger():
        while c.alive:
            await asyncio.sleep(20)
            if time.time() - c.last_seen > 70:
                c.close()
                break
            try:
                writer.write(ws_frame(b"hb", 9))
            except Exception:
                break

    ping_task = asyncio.get_event_loop().create_task(pinger())
    try:
        while c.alive:
            op, data = await ws_read_message(reader)
            c.last_seen = time.time()
            if op == 8:
                break
            if op == 9:
                writer.write(ws_frame(data, 10))
                continue
            if op == 10:
                continue
            try:
                msg = json.loads(data.decode("utf-8"))
            except Exception:
                continue
            if isinstance(msg, dict):
                try:
                    await HUB.handle(c, msg)
                except Exception as e:
                    log("Fehler bei Nachricht", msg.get("t"), repr(e))
            if writer.transport.get_write_buffer_size() > MAX_FRAME:
                await writer.drain()
    except (asyncio.IncompleteReadError, ConnectionError, ValueError, OSError):
        pass
    finally:
        ping_task.cancel()
        c.close()
        HUB.disconnected(c)


async def handle_conn(reader, writer):
    addr = writer.get_extra_info("peername")
    try:
        while True:
            try:
                raw = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=60)
            except (asyncio.TimeoutError, asyncio.IncompleteReadError, asyncio.LimitOverrunError):
                break
            lines = raw.decode("latin-1").split("\r\n")
            parts = lines[0].split(" ")
            if len(parts) < 3:
                break
            method, path = parts[0], parts[1]
            headers = {}
            for ln in lines[1:]:
                if ":" in ln:
                    k, v = ln.split(":", 1)
                    headers[k.strip().lower()] = v.strip()
            if headers.get("upgrade", "").lower() == "websocket":
                await serve_ws(reader, writer, headers, addr)
                return
            if int(headers.get("content-length", "0") or 0) > 0:
                await reader.readexactly(min(int(headers["content-length"]), 65536))
            keep = await serve_http(reader, writer, method, path, headers)
            if not keep or headers.get("connection", "").lower() == "close":
                break
    except (ConnectionError, OSError):
        pass
    except Exception as e:
        log("HTTP-Fehler:", repr(e))
    finally:
        try:
            writer.close()
        except Exception:
            pass


def _shutdown():
    try:
        STORE.save()
        if STORE.gist_due(force=True):
            STORE.gist_push()
    finally:
        os._exit(0)


async def main():
    server = await asyncio.start_server(handle_conn, HOST, PORT, limit=65536)
    try:
        import signal
        asyncio.get_running_loop().add_signal_handler(signal.SIGTERM, _shutdown)
    except (NotImplementedError, RuntimeError, ImportError):
        pass  # Windows
    asyncio.get_event_loop().create_task(HUB.housekeeping())
    log("💞 DUO ARENA läuft auf http://localhost:%d  (Daten: %s%s)" % (PORT, DATA_FILE, " + GitHub-Gist" if STORE.gist_on else ""))
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    if sys.version_info < (3, 8):
        sys.exit("Bitte Python 3.8 oder neuer verwenden.")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        STORE.save()
        if STORE.gist_due(force=True):
            STORE.gist_push()
        print("\nTschüss! 👋")
