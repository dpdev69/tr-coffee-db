# Branding and domain research

Research date: 2026-09-14. Live Registrar check completed **20:29:40 UTC / 23:29:40 Europe/Istanbul**.
Status: recommendation only; no brand decision accepted, no domain reserved or purchased, no account settings changed.

## Follow-up: kahvedrop.fyi

At the owner's request, both names were checked again with the authenticated production Registrar Check endpoint on **2026-09-14 at 20:43:43 UTC / 23:43:43 Europe/Istanbul**.

| Domain | Authoritative checked availability | First year | Annual renewal at current rate |
| --- | --- | ---: | ---: |
| kahvedrop.fyi | Available, standard tier | USD 5.20 | USD 5.20 |
| kahvedrop.com | Available, standard tier | USD 10.46 | USD 10.46 |

**kahvedrop.fyi is a sensible low-cost option for this product**, not an unrelated novelty extension: its informational connotation fits a discovery feed and weekly email. It saves **USD 5.26 per year** compared with .com. At unchanged rates the three-year comparison is **USD 15.60 versus USD 31.38**. These are registry check prices, not introductory prices taken from a public advertisement; future registry increases and account-specific taxes remain unverified. No purchase or reservation was made.

Brand tradeoff (editorial judgment, not measured user behavior): .fyi suits an information product and a niche enthusiast audience, but “fyi” is English and harder to dictate or remember for Turkish buyers unfamiliar with the abbreviation. .com remains the more conventional choice for broad word-of-mouth discovery. **If the owner prefers .fyi, proceed with KahveDrop as the brand and keep the domain configurable; this is a reasonable product choice at the checked recurring cost.** Do not promise an SEO advantage or disadvantage from the extension without evidence.

This follow-up makes .fyi the cheapest sensible option actually checked here; the original .com recommendation below compared the originally requested .com/.net/.com.tr set. Use an exact-name recheck before any later authorized registration. [Authoritative Check endpoint documentation](https://developers.cloudflare.com/api/resources/registrar/methods/check/)

```json
{
  "checked_at": "2026-09-14T20:43:43Z",
  "http_status": 200,
  "success": true,
  "domains": [
    {
      "name": "kahvedrop.fyi",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "5.20",
        "renewal_cost": "5.20"
      }
    },
    {
      "name": "kahvedrop.com",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "10.46",
        "renewal_cost": "10.46"
      }
    }
  ]
}
```

## Recommendation

Use **KahveDrop** with **kahvedrop.com** as the leading candidate. The exact domain was available at **USD 10.46 for the first year and USD 10.46 per annual renewal** in Cloudflare Registrar's authenticated, production registry check. This is also the cheapest supported extension among the requested .com / .net / .com.tr comparison: .net costs USD 1.40 more per year, and Cloudflare Registrar does not support .com.tr.

This is a product-positioning judgment, not user research: KahveDrop directly fits new releases, restocks, price changes and the already proposed “Haftalık Drop” newsletter. Its nine-character ASCII domain avoids Turkish-character transliteration. The tradeoff is the English word “Drop”; “Yeni kahveleri kaçırma” and explicit Turkish supporting copy should explain the value immediately.

**Best Turkish alternative: KahveAvı / kahveavi.com**, at the same checked price. It is shorter and playful but may frame the product as bargain hunting; the brand's dotless ı becomes i in the domain. Prefer it if broad Turkish accessibility matters more than the release/newsletter association. Neither domain cost nor availability forces a brand compromise today.

Do not buy several alternative brands merely because they are cheap. One .com is enough to validate the proposition. A local .com.tr can be considered later through another registrar if local brand protection becomes worthwhile; availability and price there have not been established.

## Exact live check results

These are current account-authenticated **Check endpoint** responses, not a public TLD price list, search-engine guesses, DNS nonresolution, or a simulated/sandbox registry result.

| Domain | Checked result | First year | Annual renewal at current rate |
| --- | --- | ---: | ---: |
| kahvedrop.com | Available — standard | USD 10.46 | USD 10.46 |
| kahveavi.com | Available — standard | USD 10.46 | USD 10.46 |
| cekirdekavi.com | Available — standard | USD 10.46 | USD 10.46 |
| kahvetakip.com | Available — standard | USD 10.46 | USD 10.46 |
| kahvedrop.net | Available — standard | USD 11.86 | USD 11.86 |
| kahveavi.net | Available — standard | USD 11.86 | USD 11.86 |
| cekirdekavi.net | Available — standard | USD 11.86 | USD 11.86 |
| kahvetakip.net | Available — standard | USD 11.86 | USD 11.86 |
| kahvedrop.com.tr | Cloudflare does not support extension | — | — |
| kahveavi.com.tr | Cloudflare does not support extension | — | — |
| cekirdekavi.com.tr | Cloudflare does not support extension | — | — |
| kahvetakip.com.tr | Cloudflare does not support extension | — | — |
| kahveradari.com | Available — standard | USD 10.46 | USD 10.46 |
| kahveradar.com | Unavailable | — | — |
| cekirdekradari.com | Available — standard | USD 10.46 | USD 10.46 |
| kahvebulteni.com | Available — standard | USD 10.46 | USD 10.46 |
| yenikahve.com | Unavailable | — | — |
| kahvegundemi.com | Available — standard | USD 10.46 | USD 10.46 |

Every available result returned tier `standard`. For the four .com.tr requests the precise reason was `extension_not_supported`, **not** `domain_unavailable`; these domains may or may not be available at a Turkish registrar. The unavailable .com results do not distinguish an existing registration from a reservation or another restriction.

The quoted costs are the API's exact USD `registration_cost` / `renewal_cost` values. The response contains no tax breakdown or tax-inclusive flag. **Account-specific taxes and final checkout total remain unverified**; do not call these tax-inclusive prices or automatically add a Turkish VAT rate. Cloudflare bases applicable sales taxes on billing details. No currency conversion or card issuer charges have been estimated. [Cloudflare sales-tax documentation](https://developers.cloudflare.com/billing/understand/sales-tax/)

At unchanged rates, one .com would total USD 31.38 over three years, compared with USD 35.58 for .net; this arithmetic is a planning comparison, not a price lock. Cloudflare sells domains at registry/ICANN cost without its own markup; underlying rates can change. [Registrar overview](https://developers.cloudflare.com/registrar/), [API price semantics](https://developers.cloudflare.com/api/resources/registrar/)

## Brand comparison

The assessments below are editorial judgments against the supplied V2 strategy, not measured audience preferences or trademark opinions.

| Name | Fit and strengths | Tradeoff | Recommendation |
| --- | --- | --- | --- |
| KahveDrop | Coffee-specific; strong association with new releases and a recurring newsletter; 9 ASCII domain characters; works for eventual recommendations without claiming personalization now. | Mixed Turkish/English; “drop” needs context for some buyers. | First choice. |
| KahveAvı | 8-character ASCII domain; energetic, easy Turkish phrase; supports discovery and deals. | “Av” emphasizes hunting/bargains; written brand ı differs from domain i. | Strong Turkish fallback. |
| ÇekirdekAvı | Evokes specialty beans and exploration; coherent Turkish brand. | 11-character domain; ç and ı both transliterate; “çekirdek” also means seeds outside coffee context. | Less efficient to say/share than first two. |
| KahveTakip | Clear promise to follow coffee changes; 10-character domain with no character mismatch. | Sounds more like a tracking utility; less distinctive emotional identity. | Practical, descriptive fallback. |
| Kahve Radarı | Clearly conveys ongoing discovery; checked kahveradari.com available. | Longer, ı transliteration; shorter kahveradar.com is unavailable, adding potential recall confusion. | Worth keeping as an editorial section label. |
| Kahve Bülteni | Very clear weekly-email meaning; checked kahvebulteni.com available. | Narrows the brand toward publishing while V2 also has catalog and event discovery; ü transliteration. | Better newsletter title than product name. |
| Çekirdek Radarı | Bean-oriented ongoing discovery; checked cekirdekradari.com available. | Longest practical spelling, several transliteration steps. | No advantage over KahveDrop/KahveAvı. |
| Kahve Gündemi | Natural Turkish framing for “what changed”; checked kahvegundemi.com available. | Could suggest general coffee-industry news more than bean discovery; ü transliteration. | Secondary alternative. |

Keep the current proposed hero and newsletter promise with KahveDrop: **“Yeni kahveleri kaçırma.”** / **“Haftalık Drop'a katıl.”** For KahveAvı, consider a plain **“Haftalık kahve keşifleri”** newsletter description so users understand that genuine new releases and restocks are included alongside deals.

Cloudflare currently requires ASCII domains rather than IDN registrations, so the checked spellings intentionally use `kahveavi` and `cekirdekavi`. Turkish display names can still use their correct characters. Cloudflare Registrar domains must use Cloudflare nameservers; that is aligned with this project's intended hosting stack. [Registration requirements](https://developers.cloudflare.com/registrar/get-started/register-domain/)

## Evidence and reproducibility

1. Discovered callable Cloudflare tools first: `mcp__cloudflare__search` and `mcp__cloudflare__execute`.
2. Inspected the OpenAPI endpoint specification for `POST /accounts/{account_id}/registrar/domain-check`.
3. Called that **production** endpoint once with the 18 names listed above, through the existing authenticated connection. No `registrar-sandbox` endpoint or billable registration endpoint was called.
4. Received HTTP status 200, `success: true`, empty errors/messages. Checked timestamp was read immediately afterward.
5. The documentation describes Check as a read-only, registry-authoritative lookup, unlike advisory Search results. Availability is time-sensitive and must be checked again immediately before any later authorized purchase. [Check endpoint](https://developers.cloudflare.com/api/resources/registrar/methods/check/)
6. Public primary Cloudflare docs were read on 2026-09-14. Authenticated API access worked, so no browser fallback was necessary.

The exact non-sensitive domain response data is preserved below. Credentials, account identifiers and registrant data are intentionally excluded.

```json
{
  "checked_at": "2026-09-14T20:29:40Z",
  "http_status": 200,
  "success": true,
  "domains": [
    {
      "name": "kahvedrop.com",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "10.46",
        "renewal_cost": "10.46"
      }
    },
    {
      "name": "kahveavi.com",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "10.46",
        "renewal_cost": "10.46"
      }
    },
    {
      "name": "cekirdekavi.com",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "10.46",
        "renewal_cost": "10.46"
      }
    },
    {
      "name": "kahvetakip.com",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "10.46",
        "renewal_cost": "10.46"
      }
    },
    {
      "name": "kahvedrop.net",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "11.86",
        "renewal_cost": "11.86"
      }
    },
    {
      "name": "kahveavi.net",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "11.86",
        "renewal_cost": "11.86"
      }
    },
    {
      "name": "cekirdekavi.net",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "11.86",
        "renewal_cost": "11.86"
      }
    },
    {
      "name": "kahvetakip.net",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "11.86",
        "renewal_cost": "11.86"
      }
    },
    {
      "name": "kahvedrop.com.tr",
      "registrable": false,
      "tier": "standard",
      "reason": "extension_not_supported"
    },
    {
      "name": "kahveavi.com.tr",
      "registrable": false,
      "tier": "standard",
      "reason": "extension_not_supported"
    },
    {
      "name": "cekirdekavi.com.tr",
      "registrable": false,
      "tier": "standard",
      "reason": "extension_not_supported"
    },
    {
      "name": "kahvetakip.com.tr",
      "registrable": false,
      "tier": "standard",
      "reason": "extension_not_supported"
    },
    {
      "name": "kahveradari.com",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "10.46",
        "renewal_cost": "10.46"
      }
    },
    {
      "name": "kahveradar.com",
      "registrable": false,
      "tier": "standard",
      "reason": "domain_unavailable"
    },
    {
      "name": "cekirdekradari.com",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "10.46",
        "renewal_cost": "10.46"
      }
    },
    {
      "name": "kahvebulteni.com",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "10.46",
        "renewal_cost": "10.46"
      }
    },
    {
      "name": "yenikahve.com",
      "registrable": false,
      "tier": "standard",
      "reason": "domain_unavailable"
    },
    {
      "name": "kahvegundemi.com",
      "registrable": true,
      "tier": "standard",
      "pricing": {
        "currency": "USD",
        "registration_cost": "10.46",
        "renewal_cost": "10.46"
      }
    }
  ]
}
```

## Remaining limits and next decision

- Domain availability is not trademark clearance, a social-handle check, or proof of no competing brand. Small exact-name web searches did not establish a conflicting product, but cannot demonstrate exclusivity; no legal trademark review was performed.
- No .com.tr external-registry availability or pricing was obtained, because the requested Cloudflare check reports that extension unsupported.
- No checkout was opened and no purchase was attempted. Taxes, current billing prerequisites and any final billable amount were not verified.
- Next decision: choose KahveDrop or KahveAvı as the public brand. Then recheck the exact domain and final checkout amount before any explicitly authorized registration.
