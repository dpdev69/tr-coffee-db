# P6 retained utilities: actual browser evidence

Run: 2026-09-15 00:20–00:25 Europe/Istanbul (2026-09-14 21:20–21:25 UTC).

Environment: running vinext at http://localhost:3001, actual local Wrangler D1 (root reported 480 canonical coffees / 38 roasters / 682 active offers). Playwright CLI wrapper, Node 22, isolated session `kahvedrop-utilities`, installed WebKit. Desktop 1280 px and mobile 390 × 844. No application source edits, type generation, build, newsletter submission, outbound purchase click, or external website navigation performed.

## Quiz → actual filtered catalog: passed

Completed all four steps by clicking visible controls:

1. Filter / Pour Over.
2. Meyvemsi.
3. Natürel.
4. Açık.

Summary listed all four choices. Clicking “Kahveleri Göster” followed the retained `/coffees?brewMethod=filter&flavorCategory=Fruity&process=natural&roastLevel=light` link and reached `/kahveler?brewMethod=filter&taste=Fruity&process=natural&roast=light`. The four corresponding controls were selected and the actual catalog returned **9 coffees**, rather than synthetic quiz results or an invented match percentage.

Two of those actual results were exercised further in comparison: both showed Natürel, Açık, Filter / Pour Over compatibility and recorded fruity tasting notes. Country/process text was still partly English in the initial snapshot; the separate source-label fix was already assigned to the crawler agent and is not claimed verified here.

Evidence: [quiz summary](../../output/playwright/p6-quiz-summary.yml), [filtered catalog snapshot](../../output/playwright/p6-quiz-catalog.yml), [filtered catalog screenshot](../../output/playwright/screenshots/p6-quiz-filtered.png).

## Catalog buttons → comparison dock → comparison table → removal: passed

Clicked the actual catalog-card comparison buttons for:

- `25-26-etiyopya-nare-ware-lalissa-natural-64bab22ebd2e`: 25/26 ETİYOPYA NARE WARE LALİSSA/NATURAL, Milestones Coffee.
- `25-26-honduras-carlos-mejia-dark-room-a42ebc6e77b4`: 25/26 HONDURAS CARLOS MEJİA/DARK ROOM, Milestones Coffee.

Dock showed **2 / 3 kahve seçili**. Clicking its “Karşılaştır” link opened a shareable `/compare?coffee=…&coffee=…` URL. The real table matched the catalog cards:

| Coffee | Package price | Weight | 100 g price | Selected package stock |
| --- | ---: | ---: | ---: | --- |
| Ethiopia | 995 TL | 200 g | 497.5 TL | Stokta |
| Honduras | 775 TL | 250 g | 310 TL | Stokta |

Arithmetic independently checked: 995 / 200 × 100 = 497.5; 775 / 250 × 100 = 310. Table also retained processing, roast, notes, brew compatibility and source check dates. Visually inspected the full-page screenshot; columns and rows were legible, without overlapping content.

Clicked Ethiopia “Çıkar”: the URL retained only Honduras and the rendered table had only its column. Browser localStorage `coffeedb:compare:v1` contained exactly the Honduras slug. Later clicked the visible dock clear button: storage became `[]` and the dock disappeared.

Evidence: [two-coffee snapshot](../../output/playwright/p6-compare-two.yml), [table screenshot](../../output/playwright/screenshots/p6-compare-two.png), [removed snapshot](../../output/playwright/p6-compare-removed.yml), [cleared snapshot](../../output/playwright/p6-compare-cleared.yml).

## Brew calculator mathematics and input recovery: passed

Opened `/guide#calculator` in the browser:

- Initial Filter / V60: 15 g × 17 = **255 g demleme suyu**.
- Filled 20 g: **340 g** and “20 g kahve · 1:17 oran”.
- Selected Espresso: its method default became 18 g, showing **36 g fincandaki espresso** at 1:2, correctly distinguished from water added to the machine.
- Filled 20 g espresso: **40 g** at 1:2.
- Cleared input: calculated output disappeared; “0’dan büyük, en fazla 100 g bir miktar gir.” appeared.
- Re-entered 20: output recovered to 40 g.
- Entered 101: output disappeared and the same bounded-input message appeared.

The results above were read from the visible calculator region after each interaction. No stale numeric result remained for empty or over-limit input. Negative/zero/decimal entries and every other brewing method were not separately exercised in this bounded run.

Evidence: [20 g filter screenshot](../../output/playwright/screenshots/p6-brew-20g-filter.png), [invalid input screenshot](../../output/playwright/screenshots/p6-brew-invalid.png). The invalid-state screenshot was visually inspected.

## Mobile menu and keyboard focus: passed

At 390 × 844 on `/quiz`:

- Clicking “Menüyü aç” exposed visible navigation and search; screenshot visually inspected.
- Escape closed the menu and set activeElement to the menu **BUTTON**, aria-label `Menüyü aç`, aria-expanded `false`.
- From that focused trigger, Enter reopened the menu.
- Plain Tab in macOS WebKit moves to form controls under its default link-navigation behavior. Option/Alt+Tab moved focus to the first `Yeni` anchor with href `/yeni`.
- Escape from within the open menu again restored focus to the trigger.
- documentElement.scrollWidth = 390 and innerWidth = 390: no page-level horizontal overflow in this state.

Evidence: [open menu snapshot](../../output/playwright/p6-mobile-menu-open.yml), [open menu screenshot](../../output/playwright/screenshots/p6-mobile-menu-open.png), [Escape/focus screenshot](../../output/playwright/screenshots/p6-mobile-menu-escape-focus.png).

## Console and scope limits

No browser console errors occurred during these exercised flows. Only repeated unused-preloaded-font warnings for Geist / Geist Mono appeared; sample [console log](../../output/playwright/p6-utilities-console.log). These are development-runtime warnings, not a production performance measurement.

This verifies the specified retained utility flows against the local app and real D1. It does not verify remote queue delivery, production deployment, every source record, Kit subscription, analytics, purchase redirects, or every keyboard/platform combination. No new blocking utility defect was found.
