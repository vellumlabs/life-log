---
name: life-ingest
description: Bring diary entries committed by the Life Log app (phone entry point) into an LLM Wiki Kit Pro life log. "/life-ingest" finds raw/diary entries that have no [day] line in wiki/log.md and updates every linked wiki page, finance page and index for each, oldest first.
---

# Ingest entries from the Life Log app

Life Log (a static PWA: voice, text or receipt photos → Claude → a diary entry → GitHub commit) writes **raw/ only**: `raw/diary/YYYY/YYYY-MM-DD[-N].md`, photos in `raw/diary/YYYY/images/`, receipt images in `raw/receipts/images/`. It sets the repository format "LLM Wiki Kit Pro life log" in its settings. This skill does the wiki half of `/life-day` for those entries.

## Steps

1. Find pending entries: every file under `raw/diary/` whose path does not appear in a `[day]` line of `wiki/log.md`. None → say "nothing to ingest" and stop.
2. For each, oldest first:
   1. Read `schema/life-log-workflow.md` section 1 ("Update the wiki") once, then run steps 1–8 for this entry, taking the **links already in the entry** as the names. The entry is the owner's reviewed text: do not rewrite it.
   2. A link whose slug turns out to be an alias of an existing page (the entry links `mom`, the wiki has `ellen-marlow` with "Also called: Mom"): add nothing new, add the alias to that page's `Also called:` if missing, and list it in the report. `raw/` stays immutable, so the link is fixed by writing `YYYY-MM-DD-N.md` (next free N) only if the owner asks.
   3. A `Receipt:` line linking `../../receipts/<name>.md` that does not exist yet → the app saved the image as `raw/receipts/images/<name>.jpg`. Do section 2 steps 2–3: transcribe it to `raw/receipts/<name>.md` (the header's `Image:` links `images/<name>.jpg`) and check the arithmetic. This is a new file, so raw/ stays immutable, and it is what makes the entry's link and `life-check.py`'s receipt check resolve. If the receipt Total differs from the entry's row, keep the receipt's Total on the finance pages and report the difference. (Entries from app versions before 2026-10-22 link the `.jpg` itself; transcribe it the same way and report that `life-check.py` cannot read that line.)
   4. A `YYYY-MM-DD-N.md` entry is the same day's later addition: its History lines link that file, and Mentions count the day once.
   5. Append the `[day]` line to `wiki/log.md` (this is what marks the entry as ingested).
3. If an entry is the first of a new month, run `/life-rollup` for the previous month once, after all entries.
4. Run `python3 scripts/lint.py --stale-days 400` and `python3 scripts/life-check.py`; fix every finding.
5. Commit `day: YYYY-MM-DD[, YYYY-MM-DD…] (life-log app)`. Push as `/life-day` does (once, only with an upstream and `llmwiki.push` not `false`).
6. Report in one paragraph: days ingested, new pages, aliases found, receipt mismatches, any rule being broken.

## Notes

- Install: copy this file to `.claude/skills/life-ingest/SKILL.md` in your life-log repository. Nothing to configure in the app beyond choosing the format.
- The app never writes `wiki/` and never edits an existing file under `raw/` (a second input for the same day becomes `-2.md`).
