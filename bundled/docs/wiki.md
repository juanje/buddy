# Your Second Brain (Wiki)

Buddy maintains a personal knowledge base for you — a wiki of interconnected pages where your ideas, concepts, and learned knowledge live. This is separate from Buddy's own memory: the wiki is *yours*, Buddy just helps organize and connect it.

## What goes in the wiki

- **Ideas and concepts** you want to keep — things you've thought about, conclusions you've reached, frameworks you use.
- **Knowledge from documents** — share an article, a book chapter, or a PDF, and Buddy can create wiki pages from the ideas you discuss. Automatic multi-concept extraction from documents is planned but not yet available.
- **Knowledge from conversations** — when you say "save this" or "add this to the wiki", Buddy creates or updates a page with what you discussed.
- **Cross-references** — wiki pages link to each other. An idea about team dynamics might link to a page on feedback loops, which links to a page on complex systems. These connections form over time as the wiki grows.

## What doesn't go in the wiki

- **Tasks and action items** — those go to your inbox (`user/inbox.md`) and projects (`user/projects/`).
- **Personal diary entries** — those go to your journal (`user/journal/`).
- **What Buddy learns about you** — preferences, patterns, lessons about how to help you — go to Buddy's own memory (`agent_brain/`).

The distinction: the wiki is knowledge you want to *remember and think with*. Tasks are things you want to *do*. Your journal is what *happened*. Buddy's memory is how *Buddy* gets better.

## How the wiki is organized

Wiki pages live in `user/wiki/`, organized by category in subdirectories:

```
user/wiki/
├── index.md          — master index by category
├── glossary.md       — alphabetical title + summary
├── .meta/
│   └── log.md        — what was filed, when, what changed
├── <category>/       — pages grouped by topic
│   └── <page>.md
└── ...
```

Each page has tags in its frontmatter, cross-references to related pages, and a sources section tracing where the knowledge came from. Categories emerge from content — they're not predefined.

Two navigational files help you find things:
- **`index.md`** — pages grouped by category.
- **`glossary.md`** — every page alphabetically, with a one-line summary.

For tag-based lookups, Buddy searches page frontmatter directly via `wiki_search` — there's no separate tags file to maintain.

Buddy also keeps a filing log in `.meta/log.md` — a record of what was added, when, and what changed.

## How pages get created

There are several ways to add knowledge to the wiki:

- **Tell Buddy directly** — "save this to the wiki", "add a page about X", "remember this concept". Buddy creates or updates the relevant page.
- **Share a document** — attach a file and ask Buddy to capture it. Today, Buddy can read documents you share and create wiki pages from the conversation. Full document ingestion — where Buddy automatically extracts key concepts and creates multiple interconnected pages from a single document — is planned but not yet available.
- **During conversation** — if you're discussing something substantive and say "this is worth keeping", Buddy can capture it as a wiki page rather than just a log entry.

## How pages connect

Wiki pages aren't isolated — they link to each other through explicit cross-references. When Buddy creates a new page, it looks for existing pages that relate and adds links in both directions. Over time, clusters of related knowledge emerge naturally.

You can also ask Buddy to find connections: "what do I know about feedback loops?" will search the wiki and surface relevant pages, even if you didn't remember they existed.

## Wiki maintenance

Buddy maintains the wiki through two mechanisms:

**After every write:** when a page is created or enriched, Buddy immediately rebuilds indexes, updates backlinks, and checks structural integrity. This is instant and automatic — the wiki is always consistent after each change.

**Periodic checks (independent of consolidation):** Buddy periodically audits the wiki for issues that post-write checks can't catch — like manual edits you made outside the app (renaming a file, editing a page in your text editor). This runs on its own cycle, separate from memory consolidation, because the wiki and your conversations grow at different rhythms.

What the checks look for:
- Broken links, orphaned pages, ghost index entries
- Missing backlinks (A links to B, but B doesn't link back to A)
- Missing or incomplete frontmatter
- Thin pages with very little content

**Synthesis:** when enough related pages accumulate, Buddy can automatically create synthesis pages that connect them, subject to growth limits and frequency budgets. This also runs on its own cycle — it needs accumulated material before it's worth attempting.

**Index updates** — index and glossary are rebuilt automatically after every change.

You can also ask Buddy to review the wiki at any time: "check the wiki health", "are there concepts missing?", "organize the wiki".

## Everything is files

Like all of Buddy's knowledge, wiki pages are plain markdown files. You can read them in any text editor, search with Spotlight or grep, or copy the folder elsewhere. Inside the app, wiki pages are browsable — click a link to follow it, use Back to return.
