# References

`references.bib` is the shared bibliography for every post. `ieee.csl` is the official
IEEE citation style from the [Citation Style Language project](https://github.com/citation-style-language/styles) (CC BY-SA 3.0).

## Citing in a post

```mdx
Euler solved the Basel problem [@euler1740].
The derivative is defined as a limit [@spivak2008, chap. 9].
Several sources at once [@spivak2008; @knuth1997].
```

These render as numbered IEEE citations like `[1]`, each linked to a numbered **References**
list added at the end of the post. Only the entries a post cites are listed.

Locators after the comma must use one of these words: `p.`, `pp.`, `page`, `chap.`,
`chapter`, `sec.`, `section`, `fig.`, `figure`. Anything else (like `ch.`) fails the build.

## Adding a source

Paste a BibTeX entry into `references.bib`. Google Scholar ("Cite" → BibTeX), Zotero
and arXiv ("Export BibTeX citation") all export it. The key after `@book{` is what you cite.

Keep the file to entries only: an `@` anywhere else (even in a comment) is read as the
start of a new entry and breaks the build.
