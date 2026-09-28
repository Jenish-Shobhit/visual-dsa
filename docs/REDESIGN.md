# Learning workspace redesign

## Learning experience

The entry point is a workspace with a persistent curriculum sidebar, local reading progress, a searchable catalogue, and a real binary-search experiment. Search covers the 17 guided chapters and 24 advanced studies. The home curriculum filters by prerequisites: foundations, reasoning, structures, and connections. Reading progress means a page was opened; it does not claim mastery.

The visual system uses a navy navigation surface, pale neutral canvas, white experiments, and green navigation accents. Diagrams retain separate semantic colors for the active operation, stored or pending state, and proven results. The mobile menu is hidden from keyboard navigation while closed. Local fonts and static assets keep the site independent of CDNs and build tooling.

## Motion and interaction

- The instruction machine exposes fetch/decode/execute microsteps, encoded instructions, registers, byte arithmetic, memory writes, output, and branches across three programs. It is an invented teaching ISA, not an emulator for a real CPU.
- Home binary search has stable cells, animated elimination, highlighted pseudocode, comparison counts, reversible steps, a scrubber, and an absent-target case.
- The shared lesson player preserves DOM nodes across redraws, animates state changes, supports playback speed, and scopes keyboard shortcuts to the focused figure. Playback pauses when the browser tab becomes hidden.
- Sorting keeps each original item's identity as it moves between slots. Temporary copies in merge sort are shown as translucent duplicates. Original positions let readers inspect stability.
- Reduced-motion settings remove motion without changing the trace or controls.

## Editorial work

The four foundation chapters distinguish source-level instructions from machine instructions, names and references from physical memory, condition tests from continuous monitoring, and calls from shared state. Worked answers are available after the learner attempts the practice.

Every advanced study now states prerequisites and a central invariant, with an answerable self check. The resource audits document exact coverage and substantive corrections; they do not assert that every book was read cover to cover or that every theorem has undergone a publication review.

## Verification

Run `python3 tests/site_integrity.py` and `node --test tests/*.test.js`. Browser checks cover desktop and mobile navigation, global search, the home binary-search trace, chapter playback, sorting with duplicate values, and the advanced-study directory. No public deployment is part of this change.
