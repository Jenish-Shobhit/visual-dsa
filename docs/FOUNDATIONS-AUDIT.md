# Foundations source audit

Reviewed: 2026-09-28

This audit records what informed the four foundation lessons owned in this pass:
`01-what-is-code`, `02-memory-and-variables`, `04-decisions-and-loops`, and
`05-functions-and-references`. It deliberately distinguishes a source
inventory from close reading. An inventory is useful for coverage; it is not a
substitute for reading every word.

## Source inventory and review extent

| Source | Form | Available extracted text | Review recorded here |
| --- | --- | ---: | --- |
| `memory-storage-and-processes-lecture.html` | local lecture | 6,904 words | Inspected its argument, RAM/SSD comparison, compression and swap explanation, process discussion, and memory-management claims. |
| `fourier-transform-from-first-principles.html` | local lecture | 3,711 words | Read the extracted lecture, including DFT, complex coefficients, phase, sampling, and the limitations section. |
| *Operating Systems: Three Easy Pieces* | PDF | 296,329 words | Verified the 51-chapter inventory and reviewed the operating-system framing relevant to processes, address spaces, translation, virtual memory, and persistence. I did not do a line-by-line reading of the full book in this pass. |
| *Code: The Hidden Language of Computer Hardware and Software*, 2nd ed. | EPUB | 125,236 words | Enumerated all 28 chapter headings and reviewed the CPU/control, program-counter, registers, memory, calls, operating-system, and coding material relevant to these lessons. I did not do a line-by-line reading of the full book in this pass. |
| *We, Programmers: A Chronicle of Coders from Ada to AI* | EPUB | 125,209 words | Enumerated its 20 chapter structure and sampled historical framing relevant to programming languages and software practice. It provides context rather than a direct technical basis for these four lessons. I did not do a line-by-line reading of the full book in this pass. |

The two copies of `martin-we-programmers-2025.epub` are byte-identical:
`dbf89d8759b8562ab95b8c445781563c5d238ae447e6d184717312514a31868d`.
They count as one source, not two.

## Ideas carried into the lessons

| Lesson | Applied source idea | Resulting teaching decision |
| --- | --- | --- |
| 01 | A program counter selects instruction bytes; fetch and execution may take several lower-level steps. Encoded bits acquire meaning from a shared convention. | The interactive source-line marker is explicitly presented as a behavior model, with a precise note about lower-level execution and representation. |
| 02 | A process receives an address-space abstraction; address translation, registers, runtime data, and language-level objects are different layers. | The name/object diagrams remain, but are separated from physical-address claims. The lesson introduces virtual address spaces and rejects the “reference equals permanent address” misconception. |
| 04 | Control is a sequence of state transitions. A branch or loop test occurs when execution reaches it. | The lesson adds a compressed test/body/update/exit trace and names the common mistake of treating a loop condition as a background monitor. |
| 05 | A call creates a local execution context; returning resumes the suspended computation. Object reachability is distinct from an exact collection time. | The call trace now shows bind/compute/return/resume. The page states JavaScript’s pass-by-value rule precisely and avoids promising when unreachable storage is reclaimed. |

## Claims that need qualification in the source material

These are audit notes for future source maintenance. They do not assert that a
useful teaching analogy is wrong; they identify where a strong statement needs
its boundary stated.

- The Fourier lecture correctly explains that a complex coefficient has both
  magnitude and phase. A magnitude-only spectrum discards timing/shift
  information and cannot, in general, reconstruct the original signal. Its
  own stationarity discussion supports this qualification.
- RAM and SSD have very different access costs, but a fixed “750 times slower”
  ratio is an illustrative order of magnitude. Actual latency depends on
  access pattern, caching, queueing, device, and whether data is already in a
  cache.
- Manual memory management gives control over allocation and reclamation. It
  does not guarantee that a whole program experiences no pauses: paging, I/O,
  locks, scheduling, and allocator behavior can still delay it. Rust’s
  ownership model prevents many memory-safety failures but intentionally does
  not rule out every memory leak.
- “Orphan,” “zombie,” and a completed browser helper are separate notions. A
  process can be detached from its original parent, remain alive, or become a
  zombie awaiting reaping; process-tree evidence is required before assigning
  one of those labels.

## Editorial limits

The lessons use original prose, traces, and figures. They draw on concepts,
not copied passages or reconstructed book diagrams. Their models are scoped
to the prediction each learner must make: source-level state transitions,
language-visible name/object relationships, and call behavior.
