# Propdex Partner Site

Static deal-pages voor `partner.propdex.nl` (partner-briefing) en `invest.propdex.nl` (investor-onepager).

**Single source of truth:** beide pagina's worden bij elke build gerenderd uit `.planning/PARTNER-BRIEFING-*.md` en `.planning/ANGEL-ONEPAGER-*.md` in de hoofd-repo. Aura-styling consistent met de productapp.

## Lokaal previewen

```bash
cd partner-site
npm install
npm run dev
# Opent http://localhost:4173 — index.html landing
# Voor partner-versie: http://localhost:4173/partner.html
# Voor invest-versie:  http://localhost:4173/invest.html
```

Of alleen builden zonder server:

```bash
npm run build
```

Output landt in `partner-site/public/`.

## Markdown editen

Edit alleen `.planning/PARTNER-BRIEFING-2026-05-13.md` of `.planning/ANGEL-ONEPAGER-2026-05-13.md` in de hoofd-repo. De build-stap pakt die op. Geen kopieën in `partner-site/` aanmaken — dat raakt out-of-sync.

Als de bestandsnaam wijzigt (nieuwe datum), pas dan in `build.mjs` de `source:`-velden aan.

## Deploy naar Vercel

### Eerste deploy (eenmalig)

1. Push deze branch naar GitHub
2. Op [vercel.com](https://vercel.com/new) → **Import Git Repository** → kies `propdex`
3. **Project name**: `propdex-deal-pages` (of vergelijkbaar)
4. **Framework Preset**: `Other`
5. **Root Directory**: `partner-site` ← essentieel
6. **Build Command**: `npm install && npm run build` (uit `vercel.json` — auto-detected)
7. **Output Directory**: `public` (uit `vercel.json`)
8. **Install Command**: leeg laten (`npm install` zit al in build)
9. Klik **Deploy**

> ⚠️ Vercel's "Root Directory" mount alleen `partner-site/` standaard. Dat is een probleem omdat `build.mjs` `.planning/` uit de repo-root nodig heeft.
>
> **Twee oplossingen** — kies één:
>
> **Optie A — Symbolic link (snelst):**
> ```bash
> cd partner-site
> ln -s ../.planning planning-content
> # Edit build.mjs: vervang `path.join(REPO_ROOT, '.planning')` met `path.join(__dirname, 'planning-content')`
> git add partner-site/planning-content build.mjs
> git commit -m "partner-site: symlink planning content"
> ```
>
> **Optie B — Root Directory leeg laten (Vercel checkt hele repo):**
> Bij stap 5: Root Directory leeg. Build Command: `cd partner-site && npm install && npm run build`. Output: `partner-site/public`. Werkt direct met huidige `build.mjs`.
>
> Aanbeveling: **Optie B** — schoner, geen symlink-rommel in repo.

### Custom domains koppelen

Na succesvolle deploy:

1. In Vercel project → **Settings** → **Domains**
2. Voeg toe: `partner.propdex.nl`
3. Vercel toont CNAME-record dat je in Siteground DNS moet zetten:
   - Type: `CNAME`
   - Name: `partner`
   - Value: `cname.vercel-dns.com.` (Vercel geeft exacte waarde)
4. Voeg toe: `invest.propdex.nl`
5. Tweede CNAME in Siteground:
   - Type: `CNAME`
   - Name: `invest`
   - Value: `cname.vercel-dns.com.`
6. Wacht op DNS-propagatie (~minuten tot uur). Vercel provisioneert automatisch SSL.

De `vercel.json` rewrites zorgen dat:
- `partner.propdex.nl/` → `/partner.html`
- `invest.propdex.nl/` → `/invest.html`

### Password-gate op partner.propdex.nl (in-page, versleuteld)

De partner-pagina heeft een **eigen Aura-gestylede wachtwoord-gate**. De deal-inhoud
(`partner-content.html`) wordt bij de build **AES-256-GCM-versleuteld** (PBKDF2-SHA256,
150k iteraties) en als ciphertext in `public/partner.html` gezet — de cijfers staan
dus **niet leesbaar in de paginabron**. De browser ontsleutelt client-side via Web
Crypto zodra het juiste wachtwoord is ingevuld.

**Wachtwoord instellen (productie):**

1. Vercel project → **Settings** → **Environment Variables**
2. Voeg toe: `PARTNER_PASSWORD` = het woord dat je aan Hauzer geeft
3. Redeploy — de build her-versleutelt automatisch met dit wachtwoord

> ⚠️ Zonder `PARTNER_PASSWORD` valt de build terug op de placeholder
> `propdex-hauzer-2026` (met een waarschuwing in de build-log). Zet de env-var
> dus altijd vóór de echte pitch.

**Lokaal met een eigen wachtwoord builden:**

```bash
PARTNER_PASSWORD="jouw-woord" npm run build
```

**Hoe wachtwoord delen:** mondeling in het partner-gesprek of via een apart kanaal
(Signal). Niet in dezelfde e-mail als de URL.

> De `invest.propdex.nl`-pagina heeft géén in-page gate. Wil je die ook beschermen,
> gebruik dan Vercel's **Deployment Protection → Password Protection** (project-breed).

## Print naar PDF

Beide pagina's hebben print-friendly CSS. Browser → Print → "Save as PDF" levert een schone PDF zonder navigatie / footer / cross-links.

## Bestandsstructuur

```
partner-site/
├── package.json          — marked dependency + build script
├── build.mjs             — renderer: invest (markdown) + partner (encrypted gate)
├── template.html         — HTML wrapper voor invest-pagina
├── partner-content.html  — BRON van de partner-pitch (edit hier)
├── partner-shell.html    — gate + Web-Crypto-decrypt wrapper voor partner
├── vercel.json           — rewrites + headers
├── README.md             — dit bestand
└── public/
    ├── styles.css        — Aura-styling (incl. gate + deal/feature/SAFE componenten)
    ├── partner.html      — gegenereerd: AES-versleutelde partner-content + gate
    └── invest.html       — gegenereerd uit ANGEL-ONEPAGER-*.md
```

**Partner-pagina editen:** wijzig `partner-content.html` (de pitch) of
`partner-shell.html` (de gate) en run `npm run build`. Niet `public/partner.html`
direct editen — dat wordt overschreven.

## Updaten na markdown-wijzigingen

```bash
# Edit .planning/PARTNER-BRIEFING-2026-05-13.md of ANGEL-ONEPAGER-2026-05-13.md
cd partner-site && npm run build  # lokaal previewen
git add .planning/  # of partner-site/build.mjs als bestandsnaam wijzigde
git commit -m "partner-site: update deal-context"
git push  # Vercel rebuild start automatisch
```

## Veelvoorkomende issues

- **Build faalt op Vercel**: check de Output Logs. Meest waarschijnlijk: Root Directory verkeerd ingesteld (zie Optie A/B hierboven).
- **404 op partner.propdex.nl**: DNS nog niet gepropageerd, of CNAME staat op verkeerd doel. Verifieer met `dig partner.propdex.nl CNAME +short`.
- **Pagina toont raw markdown**: `marked` is niet geïnstalleerd. Run `npm install` lokaal of bekijk Vercel build-log.
- **Styling niet geladen**: check dat `public/styles.css` bestaat na build. Het bestand wordt niet door build.mjs gegenereerd — het zit statisch in `public/` en mag niet verwijderd worden.
