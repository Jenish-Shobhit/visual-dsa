# Sources, models, and scope

The [guided lessons](../index.html) are original explanations and interactive figures written for this project. The [deep studies](../studies/index.html) adapt the author's local 24-lecture DSA study notes into public, navigable pages. Those notes are a starting point for the advanced track; they are not a substitute for testing proofs, examples, and edge cases. Corrections are welcome through repository issues.

The teaching approach also draws on the following reading in the author's Computer Science library:

- Charles Petzold, *Code: The Hidden Language of Computer Hardware and Software* — the path from physical state to symbolic instruction.
- Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau, *Operating Systems: Three Easy Pieces* — memory and machine-model distinctions.
- The author's 24-lecture DSA sequence — cost models, amortization, representation, lower bounds, data structures, graph algorithms, optimization, and computational limits.

Published book text and figures are not reproduced here. The examples, traces, and visual language of the guided path were created for Visual DSA. Mathematical facts and standard algorithms are explained in fresh prose.

## Important teaching simplifications

- Early diagrams show a name and a value as boxes. Actual language implementations may use registers, memory addresses, and optimizations; names are not guaranteed physical boxes.
- An array is often introduced through contiguous storage. JavaScript arrays are flexible language objects and should not be assumed to have a fixed contiguous machine representation.
- JavaScript string indexing reads UTF-16 code units, not necessarily a whole visible character. Text algorithms must choose the unit they mean.
- Big O is an asymptotic upper bound. It is not a synonym for worst case; a complexity claim must state the case and measured operation separately.
- The graph route explorer uses non-negative weights for Dijkstra. Negative weights require a different argument and possibly a different algorithm.
