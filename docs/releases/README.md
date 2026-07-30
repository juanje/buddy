# Releases

One file per version, named after its tag (`v0.1.9.md`). Its contents become
the body of the GitHub release, so the notes are written and reviewed in the
repo before the tag exists.

Two things enforce that: [`release.yml`](../../.github/workflows/release.yml)
reads `docs/releases/<tag>.md` and fails the build if it is missing, and
`tests/unit/version-sync.test.ts` fails if the file for the version in
`package.json` is missing. That check is green between releases and only turns
red during one — which is when the notes are meant to be written.

## The process

```bash
npm run version:set 0.2.0          # writes all five files that carry the version
$EDITOR docs/releases/v0.2.0.md    # start from the template below
npx tsc --noEmit && npx vite build && npm test
git commit -am "chore(release): v0.2.0 — <title>"
git tag -a v0.2.0 -m "v0.2.0 — <title>"
git push origin main --follow-tags
```

The same `<title>` is used three times — notes heading, commit subject, tag
message — so a release is findable by any of them.

Pushing the tag runs the quality gate, builds installers for macOS (ARM64 and
x64) and Linux, and opens a **draft** release with these notes as its body.
Review the draft, then publish it.

## Template

Copy this into the new file. Every section is optional except the title and the
opening paragraph — drop the ones with nothing to say rather than padding them.

```markdown
## <Four or five words naming what this release is>

<One paragraph: what changed and why it matters to someone using Buddy. If
nothing user-visible changed, say exactly that here — a maintenance release is
not improved by inflating internals into features.>

**What you could see**

- **<The symptom, as the user met it.>** <Then the cause, in a sentence or two.
  Symptom first, always: "the notice was unreadable in light mode", then "it
  referenced a colour that is not defined anywhere".>

**What was one small change away from going wrong**

- **<A latent defect.>** <Say plainly that it affected nobody, and name what
  would have triggered it. Never write a latent bug as though it were a fix for
  something people experienced.>

**What changed underneath**

<Short prose for work with no visible effect: refactors, tests, CI, docs. One
paragraph, not a list — this is the part a reader is allowed to skip.>

<Closing line: test counts, and anything a user should expect *not* to notice.>
```

## What belongs in one

Written for the person using Buddy, not the person who wrote it. FR-IDs, file
names, function names and implementation detail belong in the commit message;
the release note says what happened to the reader.

Past releases worth reading as examples: [v0.1.8](v0.1.8.md) for a release full
of user-visible defects, [v0.1.9](v0.1.9.md) for one with almost none.

**Leave `v0.1.0.md` alone.** It carries a stray "Download the installer for
your platform below." line, from back when the workflow published a placeholder
body and the real notes were typed into GitHub afterwards. These files were
backfilled verbatim from what was actually published, so they are an archive as
well as an input, and that line is part of the record.
