# ZyklusSync – Architektur & Sicherheitsmodell

## Schichten

```
Browser (React, "use client")
  src/app/page.tsx, src/components/*      UI & Zustände (Onboarding → Sperre → Dashboard)
  src/lib/api.ts                          fetch mit Sitzungs-Token (nur im RAM)
  src/lib/useIdleLock.ts                  Auto-Sperre nach 3 Min. Inaktivität
        │  HTTPS, Header "X-ZS-Session"
        ▼
API-Routen  src/app/api/*/route.ts        dünne Adapter: Validierung → Service → JSON
        │  route()-Rahmen (src/server/http.ts)
        ▼
Server-Kern  src/server/*                 nur Server ("server-only")
  http.ts          Auth, Zod-Validierung, zentrale Fehlerbehandlung, no-store
  session.ts       Sitzungen + Schlüsseltresor (RAM)
  pin-service.ts   PIN-Prüfung (serialisiert), Sperre, Migration
  crypto.ts        scrypt, AES-256-GCM, Schlüsselhierarchie
  validation.ts    Zod-Schemas für jede Eingabe
  services/*       Fachlogik (Dashboard, Tagebuch, Zyklen, Onboarding, Einstellungen)
  ml.ts            nächtliche Prognose (23:50 App-Zeitzone)
        │
        ▼
Geteilte reine Logik  src/lib/cycle-math.ts, src/lib/dates.ts   (Client & Server, ohne I/O)
        │
        ▼
SQLite (libsql-Engine)  src/db/*          eine Datei .data/zyklussync.db, Migrationen via PRAGMA user_version
```

**Regeln**
- Routen enthalten keine SQL- oder Fachlogik.
- Die Zyklusberechnung existiert genau einmal (`computeCycleMetrics`).
- Jede Eingabe läuft durch ein Zod-Schema; unbekannte Felder werden verworfen.
- Dem Client wird nichts Sicherheitsrelevantes geglaubt (z. B. bestimmt der Server die `cycle_id`).
- Antworten enthalten nur, was die Oberfläche braucht (keine Körperdaten, keine Geheimnisse).

## Schlüsselhierarchie

```
PIN ──scrypt(N=2^15, eigenes Salz)──▶ KEK   (nie gespeichert)
KEK ──AES-256-GCM──▶ DEK                    (verpackt in user_profile.dek_wrapped)
DEK ──AES-256-GCM──▶ Tagebuch               (daily_logs.notes = "enc:v1:…")
```

- `pin_hash` = scrypt mit Zufallssalz (`scrypt$1$…`). Alte SHA-256-Hashes werden beim nächsten Login automatisch aufgewertet.
- Beim Entsperren wird der DEK entpackt und **nur im Arbeitsspeicher** an die Sitzung gebunden.
- Die Datenbank kennt nur Token-**Hashes** – eine Kopie der Datei enthält weder Tokens noch Schlüssel.
- Server-Neustart ⇒ Tresor leer ⇒ alle Sitzungen ungültig ⇒ PIN nötig.

## Datenbank (SQLite)

| Eigenschaft | Umsetzung |
|---|---|
| Engine | `libsql` (SQLite 3.45, vorkompiliert, keine Build-Skripte nötig) |
| Datei | `.data/zyklussync.db` bzw. `ZYKLUSSYNC_DB_PATH` |
| Verbindung | genau eine pro Server-Prozess, Transaktionen über einen FIFO-Mutex serialisiert |
| Transaktionen | `BEGIN IMMEDIATE` (keine Sperr-Eskalation), Rollback-Sicherheitsnetz beim Freigeben |
| PRAGMAs | `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL`, `secure_delete=ON` |
| Schema | nummerierte Migrationen in `src/db/init.ts`, Version in `PRAGMA user_version` |
| Zeitwerte | Kalendertage `TEXT (YYYY-MM-DD)`, Protokollzeiten ISO 8601, Sicherheitszeiten Unix-ms (`INTEGER`) |
| Platzhalter | `$1…$n` im Code, sicher in SQLite-Parameter übersetzt (keine String-Verkettung) |
| Löschen | `secure_delete` überschreibt gelöschte Inhalte; nach „Alle Daten löschen“ zusätzlich `VACUUM` + `wal_checkpoint(TRUNCATE)` – keine Reste in Datei oder Journal |

## Sitzungen

| Eigenschaft | Wert |
|---|---|
| Transport | Header `X-ZS-Session` (kein Cookie → kein CSRF) |
| Speicherung Client | nur RAM (Reload ⇒ gesperrt) |
| Inaktivität | 3 Min. (Client-Timer + gleitender Server-Ablauf) |
| Maximale Dauer | 12 h, danach PIN erforderlich |
| Sperren | löscht Sitzung + Schlüssel sofort serverseitig |

## Schutz gegen Durchprobieren
- PIN-Prüfungen laufen **serialisiert** (keine Umgehung durch parallele Anfragen).
- Fehlversuche werden atomar gezählt; ab 5 Fehlversuchen 30 s Sperre, verdoppelt bis max. 15 Min.

## Browser-Härtung (`next.config.ts`)
CSP (`connect-src 'self'`, `object-src 'none'`, …), `nosniff`, `Referrer-Policy: no-referrer`,
`Permissions-Policy`, HSTS, COOP/CORP, kein `X-Powered-By`, Schriften selbst gehostet.
In Produktion zusätzlich `CSP_FRAME_ANCESTORS="'none'"` setzen (Clickjacking-Schutz;
in der Entwicklungs-Vorschau offen, weil sie die App im iFrame zeigt).

## Bedrohungsmodell – ehrlich

| Szenario | Geschützt? |
|---|---|
| Fremde Person nimmt das entsperrte Gerät | ✅ Auto-Sperre nach 3 Min., Sichtschutz im Hintergrund |
| API-Zugriff ohne PIN | ✅ jede Datenroute verlangt eine Sitzung |
| Kopie der Datenbankdatei: Tagebuch | ✅ nur Chiffretext |
| Kopie der Datenbankdatei: Zyklus-/Symptomdaten, Profil | ⚠️ Klartext (werden für die nächtliche Prognose ohne Sitzung gebraucht) |
| Offline-Angriff auf den PIN mit Dateikopie | ⚠️ 4 Ziffern = 10.000 Möglichkeiten; scrypt macht es teuer (≈ Minuten statt Millisekunden), aber nicht unmöglich |
| Kompromittierter Server-Prozess | ❌ sieht entpackte Schlüssel entsperrter Sitzungen |

## Empfohlene nächste Schritte
1. **Native Hülle (Android/Capacitor)** mit SQLCipher und Android Keystore – die SQLite-Struktur ist bereits kompatibel; der Schlüssel läge dann in Hardware.
2. **Echte Biometrie** über WebAuthn/Passkeys oder die native BiometricPrompt-API.
3. **Längere Codes optional** (6 Ziffern / Passphrase) für Nutzerinnen mit hohem Schutzbedarf.
4. **Weitere Felder verschlüsseln** (Symptome, Körperdaten) – dann muss die Prognose clientseitig oder nur in entsperrten Sitzungen laufen.
5. **Automatisierte Tests** für `cycle-math`, `crypto` und die Routen in CI.
6. CSP mit Nonces statt `'unsafe-inline'` (erfordert dynamisches Rendering).
