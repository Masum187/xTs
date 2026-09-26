# Design-Tokens und UI-Bausteine (XTS-141)

> **Release-Abgrenzung 26.09.2026 (Entscheidung 23):** Im aktuellen Release erfasst xTS Leistungsstunden und zeigt SAP-Planung, Belege und Genehmigungsstatus nur lesend. Planung, Genehmigung/Rueckweisung, Beauftragung/BANF/Bestellung und WE erfolgen ausschliesslich in SAP. Die vorhandenen weitergehenden Frontend-Funktionen bleiben fuer spaeter erhalten, sind fuer diesen Release aber in UI und schreibenden API-Pfaden zu deaktivieren. **Noch nicht technisch umgesetzt.** Nachfolgende Beschreibungen des bisherigen Vollumfangs sind keine aktuelle Release-Freigabe. Massgeblich ist der [Release-Zuschnitt](release-zuschnitt.md); offene Fachfragen bleiben offen.

Stand: 2026-09-12. Grundlage: Handoff "Modernist", Baseline `design-baseline-xts-140.md` (Abschnitt 4), Entscheidungen 20 und 21. Quelle im Code: `frontend/src/design-system.css`. Pruefung: `frontend/e2e/design-system.spec.ts` auf der isolierten Testseite `/assets/design-system/index.html` (Dev-Server).

## Bereitstellung ohne Anwendung

Die Tokens (`--xts-*`), die Schrift Archivo und die Bausteine (`.xts-*`) sind global geladen, werden aber von keinem Screen verwendet. Es gibt keine Element-Selektoren; Schrift und Grundfarben gelten nur ueber `.xts-font`. Die Darstellung der bestehenden Screens ist unveraendert, das sichert der E2E-Test "existing screens do not use the new classes or font yet". Die Anwendung folgt je Story ab XTS-142 (Shell) und XTS-150 (Stundenschreibung).

## Tokens

| Gruppe       | Token                                                         | Wert                                                      |
| ------------ | ------------------------------------------------------------- | --------------------------------------------------------- |
| Grundfarben  | `--xts-color-bg` / `--xts-color-surface` / `--xts-color-text` | `#f3f2f2` / `#eae9e9` / `#201e1d`                         |
| Text         | `--xts-color-text-muted` / `--xts-color-accent-text`          | `#605d5d` / `#ae1800`                                     |
| Akzent       | `--xts-color-accent` / `--xts-color-focus`                    | `#ec3013` (Flaechen, Fokus), Text nie darauf              |
| Ramps        | `--xts-color-neutral-100..900`, `--xts-color-accent-100..900` | wie Handoff                                               |
| Seitenleiste | `--xts-color-nav-bg/-text/-text-active/-rule/-brand-accent`   | `#2d2b2b` / `#bab6b6` / `#ffffff` / `#605d5d` / `#ff563c` |
| Typografie   | `--xts-font-heading` / `--xts-font-body`                      | `"Archivo", system-ui, sans-serif`, 400/600/800           |
| Abstaende    | `--xts-space-1..8`                                            | 4, 8, 12, 16, 24, 32 px                                   |
| Linien       | `--xts-radius` / `--xts-rule-strong` / `--xts-rule-fine`      | 0 / 2 px / 1 px                                           |

## Bausteine

`.xts-font`, `.xts-heading`, `.xts-kicker`, `.xts-text-muted`, `.xts-hr`, `.xts-btn` mit `-primary`, `-secondary`, `-ghost`, `-block`, `.xts-tag` mit `-accent`, `-neutral`, `-outline`, `.xts-field` + `.xts-input`, `.xts-table`, `.xts-grid` mit `.xts-cell`, `.xts-cell-span-2`, `.xts-cell-full`, `.xts-cell-button` (Auswahl per `aria-pressed`). Fokus: `:focus-visible` mit 2 px Akzentring und 2 px Abstand auf Buttons, Eingaben und Kachel-Buttons.

## Gemessene Kontraste (WCAG AA: 4,5:1 Text, 3:1 grosse Schrift)

| Kombination                                    | Werte                 | Kontrast | Ergebnis                                              |
| ---------------------------------------------- | --------------------- | -------- | ----------------------------------------------------- |
| Text auf Hintergrund                           | `#201e1d` / `#f3f2f2` | 14,9:1   | ok                                                    |
| Text auf Surface                               | `#201e1d` / `#eae9e9` | 13,7:1   | ok                                                    |
| Gedaempfter Text (Neutral-700) auf Hintergrund | `#605d5d` / `#f3f2f2` | 5,8:1    | ok; Handoff 55 % Ink (ca. 3,3:1) verworfen            |
| Gedaempfter Text auf Surface                   | `#605d5d` / `#eae9e9` | 5,4:1    | ok                                                    |
| Akzenttext (Kicker, Ghost-Button, Outline-Tag) | `#ae1800` / `#f3f2f2` | 6,4:1    | ok; Akzent-500 (3,8:1) nur fuer Flaechen              |
| Primaerbutton                                  | `#ffffff` / `#ae1800` | 7,2:1    | ok; Handoff `#f3f2f2` auf `#ec3013` (3,8:1) verworfen |
| Tag accent                                     | `#7c1405` / `#fff2ef` | 9,8:1    | ok                                                    |
| Tag neutral                                    | `#444141` / `#f8f4f4` | 9,3:1    | ok                                                    |
| Tabellenkopf (Neutral-700)                     | `#605d5d` / `#f3f2f2` | 5,8:1    | ok; Handoff 60 % Ink (3,3:1) verworfen                |
| Seitenleiste inaktiv                           | `#bab6b6` / `#2d2b2b` | 7,0:1    | ok                                                    |
| Seitenleiste aktiv                             | `#ffffff` / `#2d2b2b` | 14,1:1   | ok                                                    |
| Marke "xTS" (18 px, 800)                       | `#ff563c` / `#2d2b2b` | 4,5:1    | ok (grosse Schrift, 3:1)                              |
| Neutral-500 als Text                           | `#9b9797` / `#f3f2f2` | 2,6:1    | nicht fuer Text zulaessig                             |

Die E2E-Pruefung misst dieselben Paare aus den berechneten Styles der Testseite; der Wert der Marke gilt nur als grosse Schrift.

## Schrift (Entscheidung 21)

Archivo variabel (`wdth`, `wght`) liegt unter `frontend/src/assets/fonts/archivo/` mit OFL-Lizenz und Herkunft; `@font-face` mit `font-display: swap`, Fallback `system-ui, sans-serif`. Zur Laufzeit wird nichts von Google Fonts geladen; der E2E-Test prueft, dass Schriftanfragen nur an `/assets/fonts/` gehen.

## Testseite

`frontend/src/assets/design-system/index.html` zeigt alle Bausteine mit `data-check`-Markierungen fuer die Kontrastmessung und ist nur fuer Entwicklung und E2E gedacht (sie bindet `/styles.css` des Dev-Servers ein).
