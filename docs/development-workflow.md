# xTS Development Workflow

## Branching

- `main` ist der geschuetzte Integrationsstand.
- Feature-Arbeit erfolgt auf Branches nach Muster `feature/XTS-123-kurzbeschreibung`.
- Fixes erfolgen auf Branches nach Muster `fix/XTS-123-kurzbeschreibung`.
- Direkte Commits auf `main` sind nicht erlaubt.

## Pull Requests

Ein Pull Request ist die kontrollierte Uebergabe eines Branches in `main`.

Vor Merge muessen gelten:

- GitHub Actions Workflow `xTS CI` ist gruen.
- Mindestens ein Review ist erfolgt.
- Relevante SAP-Transporte sind im PR dokumentiert.
- Akzeptanzkriterien der Story sind erfuellt oder bewusst abgegrenzt.

## Lokale Hooks

Einmalig aktivieren:

```bash
git config core.hooksPath .githooks
```

Danach fuehrt jeder Commit automatisch aus:

```bash
npm run precommit
```

## Cursor und Claude Code

- Beide Tools arbeiten gegen denselben Branch.
- Generierte Aenderungen muessen vor Commit lokal mit `npm run precommit` geprueft werden.
- Fuer groessere Aenderungen zuerst Story-Kontext aus `docs/backlog-v0.1.md` oeffnen.

## Required GitHub Settings

In GitHub fuer `main` konfigurieren:

- Require pull request before merging.
- Require status checks to pass before merging.
- Required check: `Quality Gate`.
- Block force pushes.
- Block direct pushes.
