# ZyklusSync

Datenschutzorientierte Zyklus-App (Next.js + SQLite). Architektur und Sicherheitsmodell: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Starten

```bash
pnpm install   # oder: npm install
pnpm dev       # oder: npm run dev
```

<http://localhost:3000> öffnen. Beim ersten Start erscheint die **Einrichtung**; im letzten Schritt vergibst du deinen PIN.

Es wird **kein Datenbankserver** benötigt. Alle Daten liegen in einer einzigen SQLite-Datei:

```
.data/zyklussync.db        (+ -wal / -shm während der Laufzeit)
```

Die Tabellen entstehen beim ersten Start automatisch; spätere Schemaänderungen laufen als nummerierte Migrationen
(`PRAGMA user_version`, siehe `src/db/init.ts`). Der Ordner `.data/` ist in `.gitignore` eingetragen.

Optional lässt sich der Speicherort über `ZYKLUSSYNC_DB_PATH` festlegen (Vorlage: `.env.example`).

## Datenbank ansehen (optional)

```bash
npx drizzle-kit studio
```

## Sicherung

Server stoppen und `.data/zyklussync.db` kopieren – oder in der App **Einstellungen → Vollständigen Export laden**
(lesbares JSON inklusive entschlüsseltem Tagebuch).

## Häufige Probleme

| Meldung | Ursache | Lösung |
|---|---|---|
| „Die Datenbankdatei kann nicht geöffnet werden“ | Ordner `.data` nicht beschreibbar, Speicher voll oder `ZYKLUSSYNC_DB_PATH` falsch | Rechte, Speicherplatz und Pfad prüfen |
| „Die Datenbank wird gerade von einem anderen Prozess verwendet“ | Zwei Server nutzen dieselbe Datei | Weitere Instanzen beenden |
| „Die Datenbankdatei ist beschädigt“ | Datei defekt oder keine SQLite-Datei | Datei sichern, entfernen, neu starten |
| „Die SQLite-Engine konnte nicht geladen werden“ | Unvollständige Installation | `rm -rf node_modules && pnpm install` |

Änderungen an `.env` wirken erst nach einem Neustart des Servers.

## Zurücksetzen

In der App: **Einstellungen → Alle Daten löschen** (PIN-Bestätigung).
Komplett: Server stoppen und `.data/zyklussync.db*` löschen.

> Frühere Versionen nutzten PostgreSQL. Diese Daten werden nicht automatisch übernommen;
> ein alter Ordner `.data/zyklussync/` kann gelöscht werden.
