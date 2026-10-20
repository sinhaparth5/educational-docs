# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Static Astro 7 blog of math/computing notes at https://edu.parthsinha.com. Bun installs dependencies, while Astro itself runs on Node (>= 22.22). Start the dev server in the background with `bunx astro dev --background` and manage it with `bunx astro dev stop|status|logs`. Astro's docs are at https://docs.astro.build.

## Commands

If `bun` is not found, run `export PATH=$HOME/.bun/bin:$PATH` first.

```sh
bun install --frozen-lockfile   # also applies patches/ (rehype-citation punycode fix)
bun run check                   # astro check: type and content-schema errors
bun run build                   # dist/: pages, OG cards, Pagefind index, .br/.gz files
bun run preview                 # serve dist/ (search only works on a build, not under dev)
bun run new "Post title"        # scaffold src/content/posts/<slug>.mdx as a draft
docker build -t edu .           # Caddy image serving dist/ on :8080
```

There are no tests. CI (`.github/workflows/ci.yml`) runs `check` and `build`.

## Architecture

- **Posts** are MDX in `src/content/posts/`, and the schema is in `src/content.config.ts`. Drafts appear only under `astro dev`. Always fetch posts with `getPosts()` from `src/lib/site.ts`, which filters drafts and sorts newest first, not with raw `getCollection`. Site-wide settings (socials, Giscus IDs, Umami) are in the `SITE` object in the same file.
- **MDX components** (Theorem, Proof, Note, Sidenote, DocCard) are not imported per post. `src/pages/posts/[...id].astro` passes them globally through `<Content components={{...}} />`, so a new one has to be registered there.
- **Citations:** write `[@key]` in a post, with the key defined in `src/content/references/references.bib`. rehype-citation renders IEEE style using `ieee.csl`. The custom `rehypeReferences` plugin in `astro.config.mjs` links each `[n]` and adds the "References" h2. rehype-citation's own `linkCitations` stays off because it crashes on locators.
- **Build hooks** in `astro.config.mjs` run in order: Pagefind indexes elements marked `data-pagefind-body`, then precompress writes `.br`/`.gz` files that Caddy serves with `precompressed`.
- **Social images:** a post with `cover` (1200×630, relative path, via `image()`) uses it as its OG image through `getImage`. Posts without a cover get a satori/resvg card from `src/pages/og/[...slug].png.ts`. Other pages use `public/og-home.jpg`, the default set in `src/layouts/Base.astro`.
- **Viz islands** (`src/components/viz/`) are React components (Mafs, JSXGraph, three) loaded with `client:visible`. three is split into its own chunk.
- **Comments:** Giscus maps threads by pathname, so renaming a post's file orphans its comments.
- **Deploy:** the multi-stage `Dockerfile` builds with Node+Bun and ships only Caddy (`docker/Caddyfile`), running as non-root on :8080 with no TLS. The host's reverse proxy handles HTTPS.

## Conventions

- Styling uses CSS Modules only: no Tailwind, `<style>` blocks or inline styles. Global CSS in `src/styles/global.css` is limited to theme tokens and `.prose`, since Markdown output can't take module classes. Component CSS that overrides `.prose a` needs higher specificity (for example `.card .download`).
- Each component lives in its own kebab-case folder, `src/components/<group>/<kebab-name>/<PascalName>.astro` plus `<PascalName>.module.css`, and is imported with the `@/` alias.
- Colours come from the CSS variables in `:root` and `[data-theme='dark']`. Keep text and accent contrast at WCAG AA in both themes.
- Icons are Tabler SVGs imported as components (`@tabler/icons/outline/<name>.svg`).
- Markdown tables are styled globally and scroll sideways inside themselves on narrow screens, so posts need no wrapper.
