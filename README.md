# educational-docs

Notes on math and computing, with interactive graphs, published at [edu.parthsinha.com](https://edu.parthsinha.com).

It is a static site built with [Astro](https://astro.build). Posts are written in MDX and can use KaTeX math, IEEE-style citations and interactive visualizations. The site also has Pagefind search, RSS, Giscus comments and generated social images.

## Development

You need [Bun](https://bun.sh) and Node 22.22 or newer.

```sh
bun install
bun run dev        # http://localhost:4321
bun run check      # type and content checks
bun run build      # static site in dist/
bun run preview    # serve dist/ (search only works here, not under dev)
```

## Writing a post

```sh
bun run new "Post title"
```

This creates `src/content/posts/post-title.mdx` as a draft. Drafts appear under `bun run dev` but are left out of a build, so set `draft: false` (or remove the line) to publish.

Frontmatter fields:

| Field | Required | Notes |
| :-- | :-- | :-- |
| `title`, `description`, `date` | yes | |
| `tags` | no | list of strings |
| `featured` | no | shown in the home page Featured section |
| `updated` | no | date of the last edit |
| `cover`, `coverAlt` | no | 1200×630 image path relative to the post, used as the social preview |
| `series` | no | `{ name, part }` for multi-part posts |

Cite sources with `[@key]`. Each key needs an entry in `src/content/references/references.bib`, and the post gets an IEEE-style numbered reference list at the end.

You can use these components in any post without importing them: `<Theorem>`, `<Proof>`, `<Note>`, `<Sidenote>` and `<DocCard>`.

## Deployment

The Docker image builds the site and serves it with Caddy on port 8080 as a non-root user. It serves the pre-compressed brotli and gzip files written at build time. HTTPS is handled by the reverse proxy on the host.

```sh
docker build -t edu .
docker run -d --name edu -p 127.0.0.1:8080:8080 --read-only --cap-drop ALL --tmpfs /tmp edu
```
