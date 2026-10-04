# KahveDrop go-to-market plan

Prepared 2026-10-05 for the owner. Nothing in this plan has been posted, sent, registered or signed up for. Every item marked **Owner** is something only the owner does (posting, messaging, buying, approving). Items marked **Agent** are drafts an agent can prepare for the owner to review.

This builds on `docs/growth-plan.md`, `docs/user-research.md`, `docs/branding-research.md` and `docs/kit-setup.md` on the `001-kahvedrop-v2` branch (they are not on `main`), and on the V2 brief. It does not repeat their milestones (100 → 500 → 1,000 confirmed subscribers), funnel arithmetic or Kit mechanics. Where this plan disagrees with them, it says so (see "Where this plan departs from earlier docs" at the end).

Catalog figures below come from the staging API on 2026-10-05: **492 coffees from 39 roasters**, median 250 g bag **675 TL** (middle half 495–898 TL, 324 bags with a stated weight).

---

## 0. What the research changed

Three findings matter more than anything else in this document.

1. **The catalog is not unique.** At least four Turkish projects already track roaster catalogs:
   - **Pulp** (pulp.tr): 100 brands and 1,198 coffees, gram prices, daily price history, a "piyasa endeksi", origin and process trends, and a weekly "Pulp Weekly" published on the site every week since 2026-07-01. It also has Instagram (`pulp_tr`) and YouTube (`@pulptr`). Its domain was registered 2026-04-18. I found no email signup field on its home page.
   - **Post Roast / Scout Roast** (postroast.tr, hi.postroast.tr/kesfet): a brew-log app that says its catalog counts come from Pulp's live catalog. Scout Roast claims 70+ roasters with a 100 g price sort.
   - **kahve.one** by Gökhan Selamet (forum name `selamet`). It continues a daily price table he has run since 2020, which is pinned on kahveler.net and was relaunched in January 2026. It was **down on 2026-10-05** (server error: disk full).
   - **kahvenibul.co** claims 140+ roasters in search snippets. It was **down on 2026-10-05** (HTTP 521).

   Pulp is bigger than KahveDrop on coverage and price analysis, and it already publishes weekly. Competing as "the price tracker" means competing as the smaller one.
2. **The owner has already been on the forum.** On 2026-05-22 a kahvekulubu.net member, `Brokenchemex`, opened a thread about a "Trade Coffee-like" catalog at `tr-coffee-db.vercel.app` (455 coffees, 37 roasters). It drew constructive replies, and the author shipped fixes the same day. The repo name suggests this is the owner. If so, the community has already seen the v1, and the v1 site is still live. That thread is the natural home for the v2 update. In the same thread, another developer pointed to kahve.one and to his own Post Roast.
3. **Gökhan Selamet is central to the scene.** He is listed as the "Aylık Alım Organizasyon Sorumlusu" (group-buy organiser) on kahvekulubu.net, he owns the kahveler.net pinned table thread, and he built kahve.one. If he reads KahveDrop's launch as a better-funded copy of his five-year project, the owner's reputation suffers on both forums at once. A private, friendly message before any public post is the cheapest protection in this plan.

So the plan positions KahveDrop on **taste and editorial**, which no one else does, and treats the price data as supporting evidence rather than the headline.

---

## 1. Positioning

**One sentence.** KahveDrop is an independent monthly letter and catalog for home brewers in Türkiye who buy specialty beans online: it tells you which coffees are worth drinking this month and what is new in the scene, and every coffee links straight to its roaster.

**The audience.** People who brew filter or espresso at home, buy 250 g bags online one to three times a month, and are tired of reordering from the same two roasters. These are the forum regulars and their quieter friends.

**The newsletter promise (reader-facing):**

> Ayda bir mektup: bu ay gerçekten içmeye değer kahveler, sahneden haberler ve etkinlikler. Haftada bir kısa liste: yeni çıkanlar, geri gelenler, gerçekten düşen fiyatlar. Satış yok, satılık sıralama yok.

**How it differs from Pulp:** Pulp reads the market (index, inflation, ₺/g). KahveDrop answers "what should I drink next": the owner's picks, the taste quiz, "bunu sevdiysen" pairings, scene news and events, all delivered by email. Do not fight Pulp on coverage or on price analysis. Link to it when it is the better source.

**What KahveDrop will never do** (put this on the About page and in the media kit):
- Sell ranking positions, sell inclusion, or let sponsors influence the owner's picks.
- Use affiliate links or take commission without disclosing it on the same line.
- Name and shame a roaster's prices. Price data is shown as facts about one coffee, never as "en pahalı" lists.
- Use roaster photos without permission.
- Share subscriber data with sponsors or roasters, even in aggregate below 50 people.
- Email anyone who has not confirmed through double opt-in.

### Name candidates

Domain status was checked on **2026-10-04 21:41 UTC** through public registry lookups that need no login: Verisign RDAP for .com/.net, Identity Digital RDAP for .fyi, the .co registry WHOIS, and TRABIS WHOIS for .com.tr. "Not registered" means the registry has no record. It does not guarantee the name is registrable (premium or reserved names exist), so recheck at checkout. Prices are from Porkbun's public pricing API on the same date. The September Cloudflare check found USD 10.46 for .com. **Instagram and X handle availability was not checked** because both need a login.

| Name | Domain checked | Status | Yearly price (first year / renewal) |
| --- | --- | --- | --- |
| **KahveDrop** (recommended) | kahvedrop.com | not registered | USD 11.08 / 11.08 (Porkbun); 10.46 (Cloudflare, Sept) |
| | kahvedrop.com.tr | no match in TRABIS | not verified (one registrar banner advertises USD 1.49 first year; renewal unknown) |
| | kahvedrop.fyi / .net / .co | not registered | 5.66 / 12.52 / 15.76 first year, 31.20 renewal for .co |
| Kahve Mektubu | kahvemektubu.com, .com.tr | not registered / no match | 11.08 / 11.08 |
| Çekirdek Postası | cekirdekpostasi.com, .com.tr | not registered / no match | 11.08 / 11.08 |
| Taze Kavrum | tazekavrum.com, .com.tr | not registered / no match | 11.08 / 11.08 |
| KahveAvı | kahveavi.com | not registered | 11.08 / 11.08 |

For reference, `kahveradar.com` was registered on 2026-09-13.

Reasoning:
1. **KahveDrop. Keep it.** It is already wired into the code, the Kit form ("Haftalık Drop") and the earlier research. It is distinct from Pulp, Post Roast and kahve.one, and its .com costs about USD 11 a year. "Drop" fits the weekly list. It does not fit the monthly letter, which is why the monthly issue gets its own section title (below). The `<konu>Drop` pattern also extends to a future newsletter, so the name leaves the portfolio door open.
2. **Kahve Mektubu.** This is the warmest fit for the monthly editorial and reads naturally to every Turkish reader. It is weaker for the weekly price list. Choose it only if the owner wants the monthly letter, not the catalog, to be the brand. Either way, "Mektup" makes a good **name for the monthly issue**: "KahveDrop Mektup · Kasım 2026".
3. **Çekirdek Postası.** Newsletter-native and specific to beans. But "çekirdek" also means seeds, and both ç and ı change in the domain.
4. **Taze Kavrum.** A clear freshness promise, but it sounds like a roaster's shop name, which would confuse readers and roasters alike.
5. **KahveAvı.** This was the earlier fallback. Not recommended now: "av" frames the product as bargain hunting, which puts it on Pulp's ground and is the framing most likely to irritate roasters.

**Portfolio note.** Put the Kit account, the sender identity and any future company in a neutral name (the owner's own name or a holding name), not "KahveDrop". A second newsletter can then share the same paperwork and account without redoing everything. Domain registration itself does not need to be decided now beyond kahvedrop.com.

---

## 2. Forum plan

### What the rules say

**kahvekulubu.net/sosyal.** XenForo forum. The rules are public. Posting requires an account.

- Pinned "Kahve ve Ekipman Satışı Yapan Firmaların Paylaşım İzinleri" (`/sosyal/threads/kahve-ve-ekipman-sat-s-yapan-firmalar-n-paylas-m-izinleri.330/`, 2020). Firms may advertise under conditions, including:
  - "Firma ismi ile kullanıcı adı oluşturmaları."
  - "Şeffaf olmaları."
  - "Tek bir konu üzerinden paylaşımların yapılması ve tartışılması."
  - "Kahve kulübü yönetimi istemesi halinde paylaşımları durdurması."
  - Site-specific discounts must use the tag "kahvekulubunet".
- Pinned "Kavurucular ve Firmalar için Uyarı" (`/sosyal/threads/kavurucular-ve-firmalar-icin-uyar.73/`, 2020): "şimdilik link, internet adresi reklam ve buna benzer şeyler paylaşmazsanız sevinirim". The later firm-permission thread above relaxed this for firms that follow the rules.
- Pinned "Forum Kuralları ve Bilgilendirme Metni" (`/sosyal/threads/forum-kurallar-ve-bilgilendirme-metni.2503/`, 2021). Item 2c allows moderators to hide content that could cause "haksız rekabete" or deprive firms of income "haksız yere". **This is directly relevant to any price comparison.** Warning points accumulate: 90 points brings a 15-day posting ban.
- Help → Terms (`/sosyal/help/terms/`): signatures and avatars must not be offensive. I found no other signature rule. One account per person: "Aynı kullanıcının foruma farklı isimlerle üye olması yasaktır."
- Moderators and contacts: admin `@NoDRaC` (Suat). Group-buy organisers include `@selamet` (Gökhan). There is also a WhatsApp channel, Instagram and Twitter.
- A dedicated subforum for members' own products exists: "Üyelerimizin Ürünleri" ("Üyelerimizin ürettiği veya satışını yaptığı ürünler").

**kahveler.net.** XenForo forum run since January 2022 by the Kahve Masası team: `teyyaredenkahve` (Levent Öncü) and `pepukkahve` (İsmail Gökcan). **The live site blocks automated readers with a Cloudflare challenge.** I did not try to get past it. Everything below comes from Internet Archive snapshots dated 2026-05-11 to 2026-06-13, so the live rules may have changed since.

- Rules (`/help/terms/`, snapshot 2026-05-11):
  - "Reklam Yaparcasına Forumda Dikkat çekecek şekilde forum yada web sitelerinin linki yayınlamak yasaktır. Diğer şekillerde linklerini paylaşmanızda sakınca yoktur."
  - "Paylaşılan içeriklerde kaynak belirtilmesiz zorunludur. Ancak içerik sadece kaynağın reklamlanması için kullanılır ise içerik silinecekitir."
  - Spam: "mesaj sayısı artırmak için art arda, gereksiz yere, boş içerikli mesajlar göndermek yasaktır."
  - Search before posting, and post each topic in the right category.
- Forum tips thread (`/kahve/8758-...`, by teyyaredenkahve):
  - Signatures are allowed: "Kendinizi tanıtan bir imza ekleyebilirsiniz", provided they are not too long or in large type.
  - Social and blog links in the profile are allowed: "sosyal medya hesaplarınızı ve blogunuzu istiyorsanız paylaşabilirsiniz."
- "Tanışma Alanı" description: introducing yourself is "zorunludur" before using the forum.
- "Forumda firma yetkilisi ünvanı almak" (`/kahve/5071-...`): firm representatives can request a "Firma Yetkilisi" title by posting in that thread. This is the disclosed-commercial-account route.
- Pinned in Yurt İçi Kahve Firmaları: Gökhan Selamet's "Online Çekirdek Kahve Bulma Tablosu" (`/kahve/5822-...`, 85+ replies, last activity 2026-03). This is someone else's project thread. **Do not post KahveDrop in it.**

### What gets engagement

Counts are from public forum indexes on 2026-10-05.

- kahvekulubu "Kahve Kulübü Aylık Kahve Alımları": 348 topics, **44K messages**. Members vote on a roaster each month, and the October 2026 result was posted on 2026-10-04.
- kahvekulubu "Kahve Firmaları": one thread per roaster, 41.3K messages. The CoffeeNutz thread alone has 3K replies; Null, Niji, CleanCup, Kafein Kültür, Calibre, Petra, Sezy, Probador, Milestones and Montag each have about 1K–2K.
- kahvekulubu "Sıcak Fırsatlar": the "Kahve ve Ekipman İndirimleri" megathread has **6K replies and 1M views**. Black Friday threads reach hundreds of replies.
- Price grievances get traction. The kahvekulubu "Kahve Fiyatları" thread (May 2026) argues that roasters only ever raise prices. kahveler.net "Kahve Haberleri" ran a "Kahve Fiyatları 2025 Ocak'tan Bu Yana En Düşük Seviyede" story.
- Brewing help is high-volume: Kahve Demleme has 28.6K messages and Değirmenler 22.8K. On kahveler.net, "Bugün İçtiğim Kahve" and Kahve Deneyimleri are active daily.

Reading: group buys and per-roaster threads belong to the community and its roaster relationships. **KahveDrop should stay out of both.** The open lanes are honest discount reporting, "what to try next" advice, and brewing help.

### First month, kahvekulubu.net

Start with the existing `Brokenchemex` account, if it is the owner's. Disclose the role in the profile ("KahveDrop'u yapan kişi"). Do not open a second account; the rules forbid it.

| When | Contribution (no KahveDrop link unless stated) |
| --- | --- |
| Before D (pre-launch) | **Owner:** send a private message to admin `@NoDRaC`. Say that a non-selling catalog plus newsletter will launch on its own domain, and ask whether updates belong in the existing May thread or in "Üyelerimizin Ürünleri", and whether any tag or label is required. Separately, send a courtesy message to `@selamet` (draft below). |
| Week 1 | Answer 2–3 beginner or "which beans" questions in Demlemeye Yeni Başlayanlar or Kahve Demleme from personal experience. No links. |
| Week 2 | One reply in the "Kahve ve Ekipman İndirimleri" megathread listing verified price drops, linking to the **roasters' own pages** (draft B). Repeat weekly only when there are real drops. |
| Week 3 | If the admin has agreed, post the v2 update in the owner's own May thread (draft C). This is the only post with a KahveDrop link, and it stays the single thread for all later updates. |
| Week 4 | Reply in that thread with what changed from the feedback received. Keep answering brewing questions. |

### First month, kahveler.net

Through a personal account named for the owner. Do not use "KahveDrop" as the username unless the admins prefer it.

| When | Contribution |
| --- | --- |
| Week 1 | Introduction in Tanışma Alanı with the role disclosed and **no link** (draft A). Add a short signature: "KahveDrop'u yapıyorum · kahvedrop.com". Signatures are explicitly allowed; keep it one line. |
| Week 1 | Ask in the "Firma yetkilisi ünvanı" thread whether a non-selling directory should carry that title, or use the "Bize Ulaşın" form. Follow the admins' answer. |
| Weeks 2–4 | Contribute to "Bugün İçtiğim Kahve", Kahve Deneyimleri and İndirimler - Promosyonlar. Discount posts link to roasters and name KahveDrop as the source in plain text, as the source rule requires. |
| After week 4 | Only if an admin has said yes: one post in the relevant section introducing the monthly letter. Otherwise the signature stays the only link. |

**When KahveDrop may be named:** in the profile and signature from day one; in discount posts as the plain-text source; with a link only in the single owned thread (kahvekulubu) or wherever admins approve (kahveler.net).

**What to avoid:**
- Posting in roaster threads or group-buy threads with KahveDrop links.
- Any "X is cheaper than Y" or "most expensive" comparison. This risks rule 2c and annoys roasters.
- Posting in Gökhan's table thread, or comparing KahveDrop to kahve.one or Pulp.
- Cross-posting the same text to both forums on the same day.
- Asking friends to upvote or reply.
- Replying to criticism defensively. Thank, fix, report back.

### Draft posts (owner posts, disclosed)

**Courtesy message to Gökhan Selamet (private message on either forum, before launch).**

> Merhaba Gökhan Bey, ben {Ad}, forumda Brokenchemex olarak yazıyorum. Mayıs'ta paylaştığım kahve kataloğunu kendi alan adına taşıyorum ve yanına aylık bir bülten ekliyorum. Kahve tablonuzu 2020'den beri biliyorum, bu işin Türkiye'deki ilk emeği sizin. Duyurmadan önce size haber vermek istedim. Bu arada kahve.one'a bugün erişemedim, bilginiz olsun. Bir gün veri ya da kavurucu listesi konusunda işinize yarayacak bir şey olursa seve seve paylaşırım. Kolay gelsin.

**A. kahveler.net, Tanışma Alanı.**

> **Başlık:** Merhaba, KahveDrop'u yapan kişi olarak tanışmak isterim
>
> Herkese merhaba. Ben {Ad}, {şehir}de yaşıyorum. Evde çoğunlukla V60 ile, {değirmen} kullanarak demliyorum. Son zamanlarda en çok Etiyopya natürellerine takıldım.
>
> Baştan açık olayım: KahveDrop adında küçük bir site ve e-posta bülteni yürütüyorum. Türkiye'deki 39 kavurucunun kahvelerini her gün takip ediyor, hiçbir şey satmıyor, her kahve doğrudan kavurucunun sayfasına gidiyor. Buraya reklam yapmaya değil, okumaya ve bildiğim kadarıyla yardım etmeye geldim. Siteyle ilgili bir şey paylaşmam gerekirse önce yönetime soracağım.
>
> Herkese iyi demlemeler.

**B. kahvekulubu.net, reply in "Kahve ve Ekipman İndirimleri".**

> Bu hafta fiyatı gerçekten düşen birkaç çekirdek. Hepsinde aynı ürün ve aynı gramaj, eski fiyat en az bir haftadır sabitti:
>
> • {Kavurucu} — {Kahve}, 250 g: {eski} ₺ → {yeni} ₺ ({gün} itibarıyla) {kavurucunun ürün linki}
> • {Kavurucu} — {Kahve}, 1 kg: {eski} ₺ → {yeni} ₺ ({gün} itibarıyla) {kavurucunun ürün linki}
>
> Kaynak: KahveDrop'ta tuttuğum günlük fiyat kayıtları. Stoklar hızlı değişiyor, almadan önce kavurucunun sayfasından kontrol edin. Yanlış gördüğünüz bir şey olursa yazın, düzelteyim.

**C. kahvekulubu.net, update in the owner's May thread (only after admin approval).**

> Selamlar, Mayıs'ta burada paylaştığım kahve kataloğunun yeni hâli hazır, artık kendi adresinde: kahvedrop.com
>
> O başlıktaki geri bildirimler doğrudan işe yaradı. 100 g fiyatı artık gerçek paketin fiyatından hesaplanıyor, Milestones ve Cho Coffee eklendi. Kavrum bilgisi de yalnızca kavurucunun sayfasında açıkça yazıyorsa gösteriliyor.
>
> Şu an 39 kavurucudan yaklaşık 490 kahve var ve her gün güncelleniyor. Yeni çıkanlar, stoğa geri dönenler ve gerçekten düşen fiyatlar ayrı listelerde. Satış, aracılık ya da komisyon yok; kavurucular listelenmek için ücret ödemiyor, istemeyen kavurucu tek bir e-postayla listeden çıkabiliyor.
>
> Yeni olan şey ayda bir gönderdiğim bir bülten: o ay içmeye değer bulduğum kahveler, sahneden haberler ve yaklaşan etkinlikler. Haftalık kısa bir liste de var. Abonelik iki adımlı onayla çalışıyor, her e-postanın altından tek tıkla çıkabilirsiniz.
>
> Yine en çok sizin gözünüze güveniyorum: eksik kavurucu, yanlış bilgi ya da işe yaramayan bir şey görürseniz bu başlığa yazın. Bundan sonraki güncellemeleri de yalnızca burada paylaşacağım.

---

## 3. Instagram and X relaunch

### Repurposing honestly

- **Owner:** check what the old followers are. If they have nothing to do with coffee, rename the account but do not present the follower count as a coffee audience anywhere, including the media kit. Archive old unrelated posts (archiving is reversible) instead of deleting them.
- Rename to KahveDrop. Bio: what it is, "Satış yok, satılık sıralama yok", and one link (the newsletter signup page with `utm_source=instagram` or `utm_source=x`).
- First post, pinned: say plainly that the account has changed purpose (copy below).
- Follow all 39 roasters from the account. Interact (likes, real comments) for two weeks before any roaster sees KahveDrop content about them.
- **Visuals:** use text cards built from the data (one brand template, made in Canva or any free tool), plus the owner's own photos of bags bought with the owner's money. Use roaster product photos only after written permission (asked in the roaster email).

### Recurring formats from the catalog

| Format | Day | Data source | Rule |
| --- | --- | --- | --- |
| **Haftanın Yenileri** (carousel, 5–8 coffees) | Monday | NEW events, last 7 days | Origin, process and notes only. No price ranking. |
| **Gerçekten Düştü** | Thursday | Verified same-SKU PRICE_DROP | Old → new price with date. Never "en ucuz". Skip the week if there are no real drops. |
| **Geri Geldi** | When notable | RESTOCKED | Only for coffees people asked about or that sold out quickly. |
| **Ayın Kökeni** | Once a month | Catalog counts by origin and process | For example "Bu ay 39 kavurucuda {n} Etiyopya: {a} natürel, {b} yıkanmış…" (filled from data) No per-roaster price ranking. |
| **Bunu sevdiysen** | Every two weeks | Tasting-note similarity / quiz | Two or three pairings with links. Points to the quiz. |
| **Mektup çıktı** | Monthly issue day | Monthly issue | Story plus post with one pick from the issue and the signup link. |

X gets the same content in shorter form. Add one quick line on the day of each verified drop, maximum one a day.

### Four-week starter calendar (from launch day D)

| Week | Instagram | X |
| --- | --- | --- |
| 1 | Pinned relaunch post; Haftanın Yenileri #1; story pointing to the quiz | Relaunch post; 2 drop/new lines |
| 2 | Haftanın Yenileri #2; Gerçekten Düştü #1; story about how prices are checked | 3 lines; one thread "fiyat düşüşünü nasıl doğruluyoruz" |
| 3 | Haftanın Yenileri #3; Bunu sevdiysen #1; story asking "Bu ay ne içiyorsunuz?" | 3 lines; repost one roaster's new release with credit |
| 4 | Haftanın Yenileri #4; Mektup çıktı; Ayın Kökeni #1 | Monthly issue announcement; 2 lines |

That is about 1.5 hours a week once the template exists. **Agent** prepares the text and card copy from the database every Sunday. **Owner** checks it and posts.

### Draft copy, week 1

**Instagram, pinned relaunch post:**

> Bu hesap bir süredir sessizdi. Bugünden itibaren KahveDrop olarak devam ediyor.
>
> KahveDrop, Türkiye'deki 39 bağımsız kavurucunun yaklaşık 490 nitelikli kahvesini her gün takip eden küçük bir rehber. Yeni çıkanları, stoğa dönenleri ve fiyatı gerçekten düşenleri tek yerde görüyorsunuz. Hiçbir şey satmıyoruz, her kahve doğrudan kavurucunun kendi sayfasına gidiyor. Sıralamalar satılık değil.
>
> Ayda bir de bülten gönderiyorum: o ay içmeye değer bulduğum kahveler, sahneden haberler, etkinlikler.
>
> Bağlantı profilde. Eski takipçiler: kahveyle ilgilenmiyorsanız sizi anlarım, ilgileniyorsanız hoş geldiniz.

**Instagram, Haftanın Yenileri #1 (carousel caption):**

> Bu hafta kataloğa giren yeni kahvelerden seçtiklerimiz ☕
>
> 1/ {Kavurucu} — {Kahve} · {köken}, {işlem} · {notlar}
> 2/ …
>
> Fiyat ve paket seçenekleri kavurucuların sayfasında. Hepsinin listesi kahvedrop.com/yeni adresinde.
> Kavurucuları etiketledim, emek onların.

**Instagram story, quiz:**

> Ne içeceğine karar veremiyor musun? 4 soru, 1 dakika. Damak tadına en yakın kahveleri sıralayalım. → {link}

**X, relaunch:**

> Bu hesap artık KahveDrop. Türkiye'deki 39 kavurucunun ~490 nitelikli kahvesini her gün takip ediyoruz: yeni çıkanlar, geri dönenler, gerçekten düşen fiyatlar. Satış yok, satılık sıralama yok. kahvedrop.com

**X, single drop line:**

> Fiyatı düştü: {Kavurucu} — {Kahve} 250 g, {eski} ₺ → {yeni} ₺ (aynı paket, eski fiyat 7+ gündür sabitti). {kavurucu linki}

**X, method thread, week 2 (first tweet):**

> "İndirim" dediğimiz şeyi nasıl kontrol ediyoruz? Aynı ürün, aynı gramaj, eski fiyat en az bir hafta görülmüş olmalı. Kampanya etiketi tek başına yetmiyor. Kısa bir açıklama 🧵

---

## 4. Roaster relations

**Principles.**
- Roasters hear about KahveDrop from the owner before they hear about it from a forum.
- The first message asks for nothing except optional photo permission.
- Opt-out is honoured within two working days, with no questions asked.
- **Agent** must keep an opt-out list that the crawler respects. The current mechanism is removing the slug from `QUALIFIED_SOURCE_SLUGS` in `shared/v2/qualified-sources.ts` and hiding that roaster's coffees.

**When and how.** **Owner** sends during the first three days after D, in three batches of 13, by email to each roaster's public contact address. Use an Instagram DM only when there is no email. Each message is personal (merge fields filled in), not BCC. **Agent** prepares the 39 filled-in drafts and a tracking sheet: sent, replied, correction, opt-out, photo permission.

Roasters to contact (staging catalog, 2026-10-05, coffee count in brackets):
- A Roasting Lab (39), A4 Kahve (9), Baristocrat (8), Boxx Coffee Roasters (5), Calibre Coffee (18), Cho Coffee Roastery (8), Coach Coffee Company (4)
- Coffee Department (10), Coffee Friendzone (26), Coffeemamma (11), CoffeeNutz (13), Coffeerem Roastery (35), Cup of Joy (7), Daphne Coffee Co. (5)
- Gourme Coffee (16), Homestead Coffee (6), Hound Coffee (11), KafeinKültür (14), Kernel Coffee (10), Kimma Coffee Roasters (10), Kronotrop (11)
- Milestones Coffee (28), Molecule Coffee (9), Montag Coffee Roasters (15), Nok Coffee (10), Null Coffee Roasters (17), Old Java Coffee Roasters (9), Ordinarius Coffee Roastery (9)
- Orkun Üstel (10), Paper Coffee & Chocolate (11), Parsa Coffee Roasters (11), Petra Coffee (7), Poka Coffee Roasters (13), Probador Colectiva (6), Sezy Coffee (33)
- Spada Coffee (13), Story Coffee Roasters (10), Tetra N Roastery (2), Williams Roastery (3)

**First message (Turkish).**

> **Konu:** {Kavurucu} kahveleri KahveDrop'ta listeleniyor: düzeltme ve çıkma seçeneği
>
> Merhaba {Kavurucu} ekibi,
>
> Ben {Ad Soyad}. KahveDrop'u tek başıma yürütüyorum: Türkiye'deki nitelikli kavurucuların kahvelerini tek yerde gösteren, hiçbir şey satmayan bağımsız bir rehber ve e-posta bülteni. Kahvelerinizi size haber vermeden göstermek istemedim, o yüzden yazıyorum.
>
> Şu an sitenizdeki {N} kahve KahveDrop'ta görünüyor: {kahvedrop.com/kavurucu/slug}
>
> Nasıl çalışıyor?
> • Bilgileri herkese açık mağaza sayfanızdan günde bir kez okuyorum: köken, işlem, varyete, tat notları, paket ve fiyat.
> • Satış yapmıyorum, komisyon almıyorum. Her kahve doğrudan sizin ürün sayfanıza gidiyor.
> • Listelenmek ücretsiz ve öyle kalacak. Sıralamalar satılık değil.
>
> Bir hata görürseniz bu e-postaya cevap vermeniz yeterli (örneğin "Kiambu'nun işlemi yıkanmış değil, natürel"). Genelde iki iş günü içinde düzeltiyorum.
>
> Listede olmak istemezseniz "çıkarın" yazmanız yeterli. İki iş günü içinde kahvelerinizi kaldırır, sayfanızı okumayı bırakırım; neden diye sormam.
>
> Tamamen isteğe bağlı bir ricam var: ürün fotoğraflarınızı Instagram paylaşımlarında, sizi etiketleyerek kullanmama izin verir misiniz? Cevap gelmezse kullanmıyorum.
>
> Yeni bir kahve, atölye ya da etkinlik duyuracağınız zaman haber verirseniz aylık bültenin sahne haberleri bölümünde ücretsiz yer veririm.
>
> Teşekkürler, kolay gelsin.
> {Ad Soyad} · kahvedrop.com · {iletişim e-postası}

**From relationship to sponsorship.**
1. **Months 1–2:** corrections and opt-outs handled fast. Scene news from roasters printed free.
2. **After the second monthly issue:** send each roaster that received at least 10 outbound clicks a two-line note: "Geçen ay KahveDrop'tan sitenize {X} ziyaret gitti; en çok tıklanan kahveniz {Kahve} oldu." This is a gift with no ask, and it is the evidence later sponsors will want. Use only the `/go/` outbound counts. They are counts, not people, and the note should say so.
3. **At 500 confirmed subscribers:** offer the sponsor slot first to roasters who have replied or engaged. Never pitch a roaster that has opted out or complained.

---

## 5. Search

Search is a slow channel. Build the pages as a by-product of the newsletter, not as a separate project.

| Page type | Worth it? | Notes |
| --- | --- | --- |
| **Monthly issue pages** (`/mektup/2026-11`) | Yes, first | Real editorial text that nobody else has. Index them. The brief's planned `/haftalik/YYYY-MM-DD` pages should stay `noindex`: they are auto-generated lists, thin and near-duplicate. |
| **Origin and process guides** (`/rehber/etiyopya`, `/rehber/naturel-islem`) | Yes, one a month | Short guide plus the live list of matching coffees from the catalog. Pulp already has `/mense/` pages focused on prices, so make these about taste and brewing. |
| **Coffee pages** (`/kahve/[slug]`) | Already exist | Long-tail queries for exact coffee names. When a coffee goes away, keep the page as "tükendi" with similar coffees rather than letting it 404. |
| **Roaster pages** (`/kavurucu/[slug]`) | Already exist; do not push | The roaster's own site should win its brand query. KahveDrop competing for "{kavurucu}" searches would be noticed by the very people who are future sponsors. |

First Turkish queries to aim at, each with one page. **Search volumes were not verified: no keyword tool was available.** Check them with Google Search Console about 4–6 weeks after launch, and drop what gets no impressions.

1. nitelikli kahve nereden alınır → home page / "Nasıl seçilir" guide
2. filtre kahve çekirdeği önerisi / V60 için kahve → the quiz plus a monthly picks page
3. etiyopya kahve çekirdeği → origin guide
4. natürel işlem kahve nedir → process guide
5. anaerobik kahve → process guide
6. gesha kahve fiyat → live gesha list (factual, no ranking)

**Agent:** draft one guide a month alongside the issue, about 700 words, using catalog facts. **Owner:** add personal tasting lines and publish. Set up Google Search Console on D.

---

## 6. Newsletter content engine

**Rhythm.** The weekly digest (automated Kit draft, Mondays 06:00 Istanbul) stays as built. The owner only reviews and sends it, about 15 minutes. **The monthly letter goes out on the first Tuesday of each month.**

Monthly issue structure:
1. A short opening note (3–4 sentences, personal).
2. **Bu ayın seçimleri:** 3–5 coffees with why, who it suits, and a brew hint.
3. **Sahneden:** 3–5 news items.
4. **Takvim:** upcoming events.
5. **Ayın rakamları:** new arrivals, real price drops, restocks, as a single line each.
6. Reader reply prompt.
7. (From 500 subscribers) one labelled sponsor block.

### Monthly checklist (about 4.5 hours per issue)

| Step | Time | Who |
| --- | --- | --- |
| Pull last month's NEW / PRICE_DROP / RESTOCKED counts and notable items from the database | 15 min | Agent |
| Scan sources and list candidate news items with links (sources below) | 45 min agent, 20 min owner review | Agent → Owner |
| Picks: the owner chooses 3–5 from what was brewed this month. Budget 2–3 bags a month (about 1,350–2,000 TL at the median price). Keep a running note during the month; this is the real work and the reason to subscribe. | ~90 min spread across the month | Owner |
| Draft the issue in Turkish from the notes | 30 min | Agent |
| Edit, add voice, check every link and price on the day | 45 min | Owner |
| Publish the issue page on the site, send through Kit, post the Instagram/X announcement | 20 min | Owner |

Sources to scan each month:
- kahvekulubu.net: Kahve Haberleri, Duyurular, the Aylık Alımlar result thread (forum RSS: `https://www.kahvekulubu.net/sosyal/forums/-/index.rss`).
- kahveler.net: Kahve Haberleri, İndirimler - Promosyonlar. Read in a normal browser; automated reading is blocked.
- Roaster Instagram accounts (from the KahveDrop account's following feed), plus the catalog's NEW events.
- scaturkey.com (national championships), coffeefestivalizmir.com, festivall.com.tr/fest-alt/35/kahve/ (festival listings), and the Kahve Masası YouTube channel.
- Pulp Weekly (pulp.tr/bulten/) for the market picture. Cite it when used.

Before printing anything about the Kahve Kulübü group buys, ask the organisers whether they are happy to have them mentioned. It is their relationship with the roaster.

### Event calendar, October 2026 – March 2027

| Date | Event | Status / source |
| --- | --- | --- |
| 9–11 Oct 2026 | 10. İzmir Kahve Festivali, İzmir Arena | **Confirmed**, coffeefestivalizmir.com. Probably before D; use it for the first issue's recap. |
| Monthly | Kahve Kulübü group buy (vote, then purchase) | **Confirmed recurring**, kahvekulubu.net Aylık Alımlar (October 2026 result posted 4 Oct) |
| 27 Nov 2026 | Black Friday (Friday after US Thanksgiving, 26 Nov). Forum discount threads peak. | Date computed. Engagement confirmed by the 657-reply "Black Friday Kampanyaları" thread. |
| ~27 Nov 2026 | Elazığ Kahve ve Çikolata Festivali; Aydın Kahve Festivali | **Unconfirmed.** Listed as "tahmini" on festivall.com.tr. |
| 4–6 Dec (year unclear) | İzmit Türk Kahvesi Festivali | **Unconfirmed.** Search-result summary only. |
| 5 Dec 2026 | Dünya Türk Kahvesi Günü | **Unverified**, from general knowledge |
| Early 2027 (dates not published) | SCA Türkiye national championships (Barista, Demleme, Latte Art, Cezve & İbrik, CIGS, Cup Tasters, Kavurma) | 2027 rulebooks are on sale at scaturkey.com, but **no dates are published**. 2026 Barista champion: Erhan Dizbay (Kaizen, Antalya). |

Recently passed, useful for the first issue's look-back:
- İstanbul Coffee Festival, 10–13 Sep 2026, Tepe Nautilus (Forbes TR, Euronews TR).
- Bean to Bar × Bean to Cup, 18–20 Sep 2026, Fişekhane, including the Türkiye AeroPress Championship final (Istanbul Workshops, Radar Türkiye).
- Ankara Coffee Festival, 25–27 Sep 2026, Bilkent Center (Yeni Ankara).

The 2027 editions of these will probably fall in September again; unconfirmed. Coffex İstanbul and the Antalya Coffee Festival appear on festival listings for spring 2027 as estimates only.

---

## 7. Sponsorship

**When.**
- **100 confirmed subscribers:** do not sell. Write the media kit with real numbers. Show it to two or three roasters who have engaged and ask one question: "Bu sayılarla bir sponsorluğu ne zaman anlamlı bulurdunuz?"
- **500:** first paid slot in the monthly letter. Founding rate for the first three sponsors. One sponsor per issue.
- **1,000:** reprice from measured click data. Consider a second slot in the weekly digest, clearly separated.

**What a slot contains.** One block after the editorial picks: the roaster's logo or name, up to 60 words written or approved by the sponsor, one coffee or announcement, and one link (tracked through `/go/` with `utm_campaign=sponsor-{ay}`). The same block appears on the issue's web page.

**Labelling.** The block header reads "Sponsorlu" (matching the existing `SponsorCard`). Under it: "Bu bölüm için ödeme alındı. Bültendeki seçimler sponsorluktan bağımsızdır."

**House rule:** the sponsor's coffees do not appear in "Bu ayın seçimleri" in the issue they sponsor. The automated lists (new arrivals, price drops) are data and stay unchanged.

**Media kit numbers** (all from what exists):
- Confirmed subscribers (Kit) and net growth over the last 3 months.
- Monthly issue unique click rate (Kit). Report the open rate only with the privacy caveat.
- Outbound roaster clicks per month (`outbound_roaster_click`), total and median per roaster.
- Clicks the last sponsor received.
- Unsubscribe rate per issue.
- Where subscribers came from (UTM source), in percentages.
- Number of roasters and coffees tracked.

**Pricing approach (reasoning shown; every number marked as an assumption must be replaced by measured data).**
- What a slot is worth to a roaster ≈ sponsor clicks × share who buy × order value, plus the value of a new repeat customer.
- Example at 500 subscribers:
  - Assume 20% of subscribers click something in the monthly issue = 100 people.
  - Assume 30% of them click the sponsor = about 30 visits.
  - Assume 5% buy = 1–2 orders at about 1.5 bags × 675 TL ≈ 1,500 TL of revenue.
- Direct sales alone therefore justify only a few hundred TL. The rest is awareness and new customers who reorder.
- **Founding rate at 500: 1,250 TL per monthly issue**, roughly the retail price of two bags, which is a number every roaster can weigh against a forum discount code or an influencer post.
- **At 1,000: target 2,500 TL**, adjusted up or down by actual sponsor clicks from the founding issues.
- Payment and invoicing require the owner to have a tax registration. See the open questions.

**Media kit one-pager draft (Turkish):**

> **KahveDrop: Sponsorluk Bilgileri · {Ay Yıl}**
>
> **Biz kimiz?** KahveDrop, Türkiye'deki {39} bağımsız kavurucunun {490} nitelikli kahvesini her gün takip eden bağımsız bir rehber ve bülten. Hiçbir şey satmıyoruz, her kahve doğrudan kavurucunun sitesine gidiyor. Okurlarımız evde demleyen, internetten çekirdek alan nitelikli kahve meraklıları.
>
> **Rakamlar (son 3 ay)**
> • Onaylı abone: {N} (iki adımlı onayla, satın alınmış liste yok)
> • Aylık bülten tıklama oranı: %{X}
> • Kavurucu sitelerine giden ziyaret: ayda {Y} (kahve başına medyan {Z})
> • Abonelikten çıkma: sayı başına %{U}
> • Okurların nereden geldiği: forumlar %{a}, Instagram %{b}, arama %{c}, diğer %{d}
>
> **Sponsor alanı neler içeriyor?**
> Ayda bir gönderilen bültende tek bir sponsor alanı: logonuz ya da adınız, 60 kelimeye kadar metin, bir kahve ya da duyuru, bir bağlantı. Aynı alan sayının web sayfasında da yer alır. Ay sonunda alanın aldığı tıklama sayısını size raporluyoruz.
>
> **Kurallarımız**
> • Alan her zaman "Sponsorlu" olarak işaretlenir.
> • Sıralamalar ve "Bu ayın seçimleri" satılık değildir. Sponsor olduğunuz sayıda kahveleriniz seçimlerde yer almaz.
> • Abone bilgilerini kimseyle paylaşmayız.
> • Her sayıda tek sponsor.
>
> **Ücret:** İlk üç sponsora özel {1.250} TL / sayı. Sonraki dönem fiyatı ölçülen tıklamalara göre belirlenir.
>
> **İletişim:** {Ad Soyad} · {e-posta}

---

## 8. Measurement

Check these every Monday in about 15 minutes and write them into one row of a spreadsheet. **Agent** can pull the site-side numbers from Analytics Engine; **Owner** reads Kit.

| Number | Source | Why |
| --- | --- | --- |
| Confirmed subscribers, net change this week | Kit | The only number the milestones count |
| Signups by source (forum / Instagram / X / search / direct) | `newsletter_signup_success` events plus UTM | Shows which channel deserves the hours |
| Visitor → signup rate | Cloudflare Web Analytics visitors ÷ signup successes | Tells whether to fix the page or the traffic |
| Weekly digest and monthly issue: unique click rate, unsubscribes | Kit | Retention; a complaint or a spike in unsubscribes stops everything else |
| Outbound roaster clicks: total and top 5 roasters | `outbound_roaster_click` | Value delivered to roasters; feeds the sponsor case |
| Quiz completions → signups | `quiz_completed` and signup source `quiz` | Tells whether the rebuilt quiz earns its place |

Do not track follower counts as a goal. Social only counts through UTM signups.

---

## 9. First 30, 60, 90 days

D = the day the domain serves the production site. Weeks run D+0 to D+6, and so on. If D lands in late October, Black Friday (27 Nov) falls in weeks 5–6.

**Before D (pre-launch, not public):**
- **Owner:** send the lawyer the questions in section 10.
- **Owner:** set the Kit sender and domain, `DATA_CONTROLLER` and `CONTACT_EMAIL`.
- **Owner:** decide the name (recommendation: keep KahveDrop) and buy the domain.
- **Owner:** send the private messages to the kahvekulubu admin and to Gökhan Selamet.
- **Agent:** draft the 39 roaster emails, the first weekly digest review notes, and the Instagram template copy.

| Week | Items |
| --- | --- |
| **1** (D…D+6) | **Owner:** point `tr-coffee-db.vercel.app` to the new domain (redirect) so the May forum link keeps working; rename and pin on Instagram and X; send roaster emails in three batches; kahveler.net introduction (draft A); set up Search Console. **Agent:** tracking sheet for roaster replies; week 1 social copy; process corrections and opt-outs as they arrive. |
| **2** | **Owner:** first price-drop reply in the kahvekulubu megathread (draft B); 2–3 brewing answers; send Haftalık Drop #1. **Agent:** week 2 social copy; method thread for X. |
| **3** | **Owner:** if the admin agrees, v2 update in the May thread (draft C) and answer every reply within a day; start the picks note. **Agent:** collect monthly news candidates; draft origin guide #1 (Etiyopya). |
| **4** | **Owner:** edit and send Mektup #1 (first Tuesday); publish the issue page and guide #1; first weekly numbers review. **Agent:** draft Mektup #1; prepare the numbers sheet. |
| **5–6** | **Owner:** Black Friday special if it falls here: "Black Friday'de gerçekten düşenler", verified drops only, no "fake discount" call-outs; ask 5 forum responders for a 20-minute chat (the interview script in `docs/user-research.md`). **Agent:** BF list from data; interview notes template. |
| **7–8** | **Owner:** Mektup #2; send roasters the traffic notes (section 4, step 2); guide #2 (natürel/yıkanmış). **Agent:** traffic notes per roaster; draft Mektup #2 and guide #2. |
| **9–10** | **Owner:** decide what to drop. Stop any channel that brought fewer than 5 signups in 8 weeks. **Agent:** 8-week channel summary. |
| **11–12** | **Owner:** Mektup #3; if ≥100 subscribers, show the media kit to 2–3 friendly roasters (no sale). **Agent:** fill the media kit with real numbers; draft Mektup #3. |

Owner time: about 4–6 hours a week, with peaks in issue weeks.

---

## 10. Open questions

**For the owner:**
1. Is `Brokenchemex` on kahvekulubu.net your account? (The plan assumes yes.) What account do you have on kahveler.net, if any?
2. Keep KahveDrop? If yes, is "KahveDrop Mektup" acceptable as the monthly issue name?
3. Which address will roasters write to for corrections and opt-outs, and can you answer within two working days?
4. What is on the old Instagram and X accounts, and who follows them?
5. Budget for the monthly picks: are 2–3 bought bags a month realistic?
6. Do you want to approach Pulp at all (for example, linking to each other)? This plan assumes a polite distance and citation only.

**For the lawyer** (no conclusions are drawn here; the plan depends on these answers):
1. **İYS / commercial messages.** Does the monthly letter become "ticari elektronik ileti" only once it carries a sponsor, or already because the site may earn money later? Does the weekly price-drop digest count as promoting third-party goods? Is İYS registration needed before the first send, and does the Kit double opt-in plus checkbox record satisfy the consent proof?
2. **KVKK.** Who is the data controller before a company exists? Is the privacy notice complete for Kit (USA) and Cloudflare processing abroad, and what transfer mechanism applies? This repeats the open items in `docs/kit-setup.md`.
3. **Sponsored content labelling.** Is "Sponsorlu" plus the explanatory line enough under the advertising rules for newsletters, Instagram and forum posts? Are tags such as "#reklam" or "#işbirliği" required on social posts about a sponsor?
4. **Price statements.** Is it lawful to publish another business's prices and "price dropped" claims taken from its public site, and is any wording ("indirim", "gerçekten düştü") risky? Is reading public storefront pages daily lawful, and does a roaster's opt-out request create an obligation beyond honouring it?
5. **Images and trademarks.** What written permission is enough to use roaster product photos and logos on Instagram and in the media kit?
6. **Getting paid.** What registration (for example a sole proprietorship) and invoicing are needed before taking the first 1,250 TL sponsorship? Does it change the data-controller answer?
7. **Forum self-promotion.** Does disclosed posting on a forum carry any advertising-law duty beyond forum rules?

---

## Where this plan departs from earlier docs

- **Data uniqueness.** `growth-plan.md` and the brief treat the catalog and its daily price events as the product's edge, and the owner's brief calls this a content source "nobody else has". Pulp (100 brands, weekly analysis since July 2026), Post Roast/Scout Roast and kahve.one show it is not. This plan leads with taste and editorial instead.
- **Weekly vs monthly.** `growth-plan.md` and the brief make the weekly "Haftalık Drop" the retention promise. This plan follows the owner's current direction: the monthly letter is the product, and the weekly digest is an automated extra that the owner can skip in weeks with fewer than three real items (the script already skips them).
- **Roaster referral pilot** (`growth-plan.md` task 6). Asking roasters to share KahveDrop with their readers is postponed until after they have received two months of free outbound traffic. The first contact asks for nothing.
- **Interviews** (`growth-plan.md` task 4). These are no longer a pre-launch gate. Recruit five people from forum replies in weeks 5–6, using the existing script.
- **Weekly archive pages** (brief: `/haftalik/YYYY-MM-DD` as future SEO). Keep them out of the index. Index the monthly issue pages instead.
- **Brand reasoning** (`branding-research.md`). It chose KahveDrop partly for the "drop/deal" association. With Pulp owning prices, this plan keeps the name for different reasons (cost, distinctness, portfolio pattern) and rejects KahveAvı, the earlier fallback, because of its bargain-hunting framing.

## Sources (read 2026-10-04/05)

- kahvekulubu.net: home page `https://www.kahvekulubu.net/sosyal/`; terms `/sosyal/help/terms/`; Duyurular `/sosyal/forums/duyurular.2/` and the pinned threads `.330`, `.73`, `.2503` cited above; "Kahve Fiyatları" `/sosyal/threads/kahve-fiyatlar.12245/`; May 2026 thread `/sosyal/threads/trade-coffee-benzeri-bir-kesif-karsilastirma-akisini-turkiye-icin-bulamayinca-kendim-yaptim.12304/`; subforum listings Kahve Firmaları `.16`, Sıcak Fırsatlar `.28`, Kahve Haberleri `.22`.
- kahveler.net (live site returns a Cloudflare challenge; read through the Internet Archive): home page snapshot `web.archive.org/web/20260613113114/https://www.kahveler.net/`; rules `web.archive.org/web/20260511085500/https://www.kahveler.net/help/terms/`; threads `/kahve/8758-…`, `/kahve/5071-…`, `/kahve/8083-…`, `/kahve/5822-…` (pages 4–5); Yurt İçi Kahve Firmaları listing snapshot 2026-06-13.
- Competitors: `https://pulp.tr/` and `/bulten/2026-09-28/`; `https://postroast.tr/`; `https://hi.postroast.tr/kesfet`; `https://kahve.one` (down, error page; archived 2025-07-15); `https://kahvenibul.co` (521); `https://tr-coffee-db.vercel.app/` (v1, live).
- Events: coffeefestivalizmir.com; Euronews TR and Forbes TR on İstanbul Coffee Festival 2026; Yeni Ankara and festivall.com.tr on Ankara Coffee Festival 2026; istanbulworkshops.com and radarturkiye.com on Bean to Bar × Bean to Cup 2026; scaturkey.com (championship pages, 2027 rulebooks); wcc.coffee (Erhan Dizbay profile); festivall.com.tr/fest-alt/35/kahve/ (estimated dates).
- YouTube: Kahve Masası (youtube.com/c/KahveMasası, run by the kahveler.net admins). Kahvetrip (Onur Dinçer) and Baristatus appeared in one search summary but were **not confirmed**. No follower counts were verified for any account.
- Domains: rdap.verisign.com, rdap.identitydigital.services, whois.registry.co, whois.trabis.gov.tr, api.porkbun.com/api/json/v3/pricing/get (all 2026-10-04 21:41 UTC).
