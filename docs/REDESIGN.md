# A dashboard and one course

## The entry point

The landing page is a basic dashboard: start or resume the last opened chapter, then one ordered list of 17 lessons. The contents list remains readable without JavaScript. “Opened” records a visit, not demonstrated mastery. References and the two larger experiments sit below the course, and lessons introduce them when relevant.

## The learning experience

The first lesson starts with a pencil-and-paper task. A learner predicts the output, steps through reading and writing, moves an instruction, edits the program, interprets the same bits in two ways, transfers the idea to a new example, and explains it in their own words. The deliberately small integer language is parsed without JavaScript evaluation. Its limits are explicit: twelve instructions, assignment, addition, subtraction, multiplication, and output, with bounded integer values.

The next six chapters use concrete predictions before terminology, visible mechanisms, boundaries on each analogy, and worked answers after attempts. Reading notes document the source concepts behind these changes. A model is useful only while its rules and limitations remain clear.

## Presentation and motion

A paper-colored canvas, local system fonts, short line lengths, and a single contents dropdown keep attention on the lesson. Changes have meaning: read/calculate and write/output use different highlights. The shared player supports reverse steps, scrubbing, playback speed, focus-scoped shortcuts, and reduced motion. Sorting preserves item identity as positions change.

## Verification

- `python3 tests/site_integrity.py`: local links, anchors, duplicate IDs, and exactly three practice prompts per lesson.
- `node --test tests/*.test.js`: sorting, search, graph routing, instruction machine, and the new editable program's state semantics.
- Browser verification: desktop and 390px mobile dashboard, saved reading position, prediction feedback, stepping, instruction reordering, number/letter interpretation, and transfer exercise.

No book files are published. Source reading notes distinguish the main text delivered through extraction from original figure inspection and editorial review.
