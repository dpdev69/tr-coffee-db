# The monthly issue (KahveDrop Mektup)

Each month's issue is one text file: `content/bulten/YYYY-MM.md`, for example `content/bulten/2026-11.md`. The same file becomes the page on the site (`/bulten/2026-11`) and the email in Kit. You do not need a content system. Any text editor works, including GitHub's own editor in the browser.

The weekly "Haftalık Drop" does not change. It still arrives in Kit as a draft every Monday.

## 1. Start the month's file

Copy `content/bulten/_template.md` and name the copy after the month: `2026-11.md`. The file opens with a short block between two `---` lines:

```
---
subject: KahveDrop Mektup · Kasım 2026: Guji, Nyeri ve İzmir'de bir festival
title: Sonbaharın ilk meyveli kahveleri
intro: Bu ay üç kahveyi tekrar tekrar demledim. Bir de İzmir'de festival var.
published: false
---
```

- `subject`: the email's subject line.
- `title` and `intro`: the heading and the one or two sentences under it, on the page and in the email.
- `published`: leave this as `false` while you write. Set it to `true` only when the issue is finished (see step 5).

Keep each value on one line. Write `published` in English, exactly `true` or `false`.

## 2. Write your picks

Under `## Bu ayın favorileri`, write one line per coffee. Each line starts with `- `, then the coffee's slug, a colon and your note:

```
## Bu ayın favorileri

- guji-hambela-petra-3f2a: Yaban mersini ve yasemin. Sabah V60'ta en iyisi.
- kenya-nyeri-aa-kronotrop-91bc: Bu ayın sürprizi. Domatesimsi asidite ama tatlı bitiş.
```

**Finding a coffee's slug:** open the coffee on the site. The slug is the last part of the address. For `kahvedrop.com/kahve/guji-hambela-petra-3f2a` it is `guji-hambela-petra-3f2a`.

The site looks up each coffee when the page is shown and adds the name, roaster and package price for you. If a coffee is later sold out or delisted, the issue still shows its name and your note, marked "Şu an tükendi" or "Artık satışta değil".

A note can carry a link: `[kavurucunun sayfası](https://ornek.com/kahve)`. To link to a page on our own site, start the address with `/`, for example `[rehber](/guide)`.

You can also write a plain sentence above the list, as a short introduction.

## 3. The scene section (Sahneden)

Under `## Sahneden`, each news item is one line starting with `- `, and every item needs at least one source link:

```
## Sahneden

- İzmir Kahve Festivali 14-16 Kasım'da Kültürpark'ta. [Festival sitesi](https://ornek.com/festival)
```

A research agent drafts this section into the file for you: ask it for the month's Turkish coffee scene news. It writes each item with its source. Read it, delete what you don't want, and fix the wording. You decide what goes out.

## 4. Preview it locally

In the project folder run `npm run dev` and open `http://localhost:3001/bulten/2026-11`. Unfinished issues (`published: false`) show up only in this local preview, marked "Taslak". The live site never shows them.

If the file has a mistake (a missing colon, an unknown heading, a news item without a link), the preview and the site build stop with a message naming the line, for example `content/bulten/2026-11.md, satır 12: Her sahne haberinde en az bir kaynak bağlantısı olmalı`. The same check runs on a pull request, so a broken file cannot reach the live site.

## 5. Approve and send

1. Set `published: true`.
2. Merge the file into `main`. **Merging is your approval of the content.**
3. Two things then happen automatically:
   - The issue page appears on the site at `/bulten/2026-11` with the next deploy, and is added to the index at `/bulten` and to the sitemap.
   - The "Monthly Issue Draft" workflow creates a **draft** in Kit. It never sends. The run's summary shows the draft ID, and the run keeps an email preview file for 30 days.
4. In Kit, open the draft, choose the recipients, read it once more and press send.

The email has your picks first, then Sahneden, then the month's automated lists (price drops and new arrivals from the last 30 days). Every link back to the site is tagged with the month (`utm_campaign=2026-11`), so you can see in analytics which issue sent the visit.

**Changes after merging:** if you edit the file again after the draft exists, the workflow will not make a second draft. Its summary says a draft already exists. Either edit the draft in Kit, or delete it in Kit and run the workflow again by hand (Actions → Monthly Issue Draft → Run workflow, month `2026-11`). Kit takes a moment to list a new draft, so if the workflow ran twice within a minute, check Kit for a duplicate.

## Sponsor (not in use yet)

An issue can carry one sponsor. It appears only when the site setting `NEXT_PUBLIC_SPONSORSHIPS_ENABLED` is `true` (set the same value as a repository variable for the email). It is always labelled "Sponsorlu" and never changes your picks or the automated lists. Add it inside the top block, indented by two spaces:

```
sponsor:
  name: Örnek Kavurucu
  description: Yeni hasat Kenya bu hafta raflarda.
  link: https://www.ornekkavurucu.com/kenya
  host: www.ornekkavurucu.com
```

`host` must be exactly the address of the sponsor's site in `link`, and the link must start with `https://`. Otherwise the file is rejected. The sponsor's link carries the same month tags, so the sponsor sees the visits in their own analytics.
