# P6 discovery browser evidence

2026-09-15, local vinext/workerd at localhost:3001 with actual local Wrangler D1. Playwright CLI WebKit; 1280px desktop and390×844mobile. Production untouched.

- Home shows actual canonical480coffees/38roasters and observed feed empty states.
- Catalog roasterfilter Petra returns8 coffees, matching actualD1. [Desktop screenshot](../../output/playwright/catalog-petra-desktop.png) visually inspected.
- Guatemala Las Penas detail displays real package prices and expands from6 to all30 offer links via native details. No invented price chart appears after only one actual baseline. Rendered canonical points to staging /kahve/slug; robots noindex,nofollow.
- Unknown search zzqv-no-match-82910 returns0 and “Bu filtrelerle kahve bulamadık.” plus clearfilter/catalog links.
- Country options were verified after repair: one Brazil value labelledBrezilya; exactEnglish/Turkishaliases deduplicated. Rawsourcevalues untouched; alias query tested separately.
- Safari initially collapsed selectcontrols to23px despite minheight. Appearance fix increased allfourmainselects to44px, measured in actualbrowser. Priceinputs now share fullwidthmobile row. documentElement.scrollWidth390 equalsviewport390. [Mobile screenshot](../../output/playwright/catalog-empty-mobile.png) visually inspected.
- Console has noerrors in discoveryflows; onlyunusedGeistfont preloadwarnings inlocaldev. Kitfailed request produces expected502 consoleentry andsafealert, trackedseparately.

Retained quiz/comparison/calculator/mobilekeyboard evidence: [utilities](p6-utilities.md). Profile-only refresh appliedat21:34UTC:98features/27coffees,zeroobservations/runs/events. ActualbrowserGuatemala Las Penas nowshowsGuatemala andMeyvemsi/Tatlı, pluscurrentinferrednotes. Raw/source/pricehistoryunchanged. Referral endpoints and telemetry are nextphase; notclaimedverifiedhere. Browser source-unavailable state is notyetfault-injected. Productionperformance andremotequeuebehavior arenotprovenbythis localrun.
