# Reading companion: *We, Programmers*

This is an original teaching companion for the course, based on the supplied
plain-text EPUB export. It records ideas that can be taught through small,
checkable programs. It is not a replacement for the book or a chapter-by-
chapter retelling.

## Reading coverage

This record must remain honest about the source pass. In this working session,
the main text for chapters 1–20 was read sequentially from the supplied EPUB
export. The source chapter range ends before the afterword. The notes below are
a course-planning synthesis, not a replacement for the book or a comprehensive
historical account.

## Course lens

The useful thread for a first DSA course is simple: a programmer makes a
human intention executable by choosing a representation, then uses control to
preserve a promise about that representation. An array is not “a list of
values”; it is a decision to make order and position explicit. A loop is not
“repeat this”; it is a disciplined way to advance through that order without
forgetting what is already known. An abstraction earns its name when it hides
details while preserving a promise someone can use.

The recurring lesson shape is:

1. Ask for a prediction before defining a term.
2. Let the learner change one input in a small figure.
3. Explain the representation or control rule that made the result necessary.
4. Give a nearby transfer problem with a hint and a reveal.

## Chapter notes

### 1. Who are we?

The need is detail management: a product wish must eventually become exact
states, operations, and boundary cases. Teach a learner to turn “show the
scores” into an ordered collection and a named position. A good first prompt:
“What information would the machine need before it can show the second score?”

### 2. Babbage

Error-prone hand-made tables created the demand for a machine that could do a
regular calculation repeatedly. The teachable move is to separate a rule from
its inputs: a fixed update rule can generate many table rows. Example: start
with 1 and repeatedly add 3; predict the fifth value before running a loop.

### 3. Hilbert, Turing, and von Neumann

Formal rules become useful when symbols can stand for other things. Numbers
can encode text, pictures, instructions, and proof steps; a stored-program
machine can treat instructions as data in memory. Example: encode a traffic
light as `0`, `1`, or `2`, then write a `next` rule. Transfer: explain why a
number has no meaning until the program agrees on its representation.

### 4. Grace Hopper

Early programming divided one algorithm between a sequential tape machine and
operators who enacted loops and choices from written instructions. Hopper's
team made that precarious work repeatable with comments, independent checking,
test runs, reusable relative routines, and output formatting. Her compiler
work then followed a concrete need: relieve people from repeatedly assembling
machine-level routines. Example: compare `total = total + price` with a
sequence of anonymous memory operations. Hint: the latter is still possible,
but the named version makes the promise easier to inspect.

### 5. John Backus

Scientific programming needed formulas expressed at the level of mathematics,
without hand-managing every instruction and address. Speedcoding first made
indexing and floating-point operations available through an interpreter;
FORTRAN then made the source language and its translation a serious engineering
problem because efficient generated code was essential. BNF answered a separate
need: a language definition could not depend on ambiguous prose. Example: write
`area = width * height`; identify values, operation, destination, and the
unspoken promise that the names refer to numbers. Transfer: change the formula
without changing the storage story.

### 6. Edsger Dijkstra

Unstructured jumps make it difficult to say where a computation is or what is
known at that point. His ALGOL runtime drew a boundary between language and
machine, and the THE system used layers so each level could assume a simpler
world. Sequence, selection, and iteration were a response to control flow:
each gives a reader a manageable path through time. Example: a maximum scan
keeps `best` as the largest visited value; learners check start, preservation,
and finish. A test can expose a mistake; the invariant explains why a repair
works.

### 7. Nygaard and Dahl

Simulation had queues of entities whose lives did not follow stack nesting.
That pressure led from blocks to heap-resident objects, reclamation, classes,
and virtual behavior. Example: `Customer` objects remain in a queue after the
function that created them returns. Transfer: decide whether a value's life
fits a call or must outlast it.

### 8. Kemeny

Time-sharing and BASIC answered a social need: many people needed short,
conversational feedback rather than a distant, expensive batch run. Example:
change one array value and rerun immediately. The lesson is that feedback
changes what people can afford to try.

### 9. Judith Allen

The historical record includes work that institutions often leave unnamed.
For a course, make attribution concrete: code has authors, reviewers, users,
and maintainers, and the quality of a system depends on work beyond the final
algorithm. Transfer: ask a learner to write a useful explanation for the next
reader, including an example and a boundary case.

### 10. Thompson, Ritchie, and Kernighan

Small composable tools and a portable systems language met the need to make
one machine's useful work travel to another. Example: transform an input row
with one function, then feed it to another. Hint: each function should state
the shape of the value it accepts and returns.

### 11. The sixties

As hardware and access changed, programmers began to encounter software as a
shared, long-lived product. Teach the consequence: a program must communicate
its decisions to people who did not write its first version. Example: give a
loop a clear name and an invariant instead of relying on cleverness.

### 12. The seventies

Tools such as source control arose because several people could change the
same evolving description. Example: two edits to a `sum` function can both be
valid yet conflict in the same line. Transfer: split the work into small
independent functions with explicit inputs and outputs.

### 13. The eighties

Personal computers made interactive programs common, while systems work still
needed finite states and explicit resource control. Example: model a door as
`open` or `closed` and permit only valid transitions. Reveal: a state machine
is an array or object whose current value constrains the next operation.

### 14. The nineties

Patterns and design principles responded to a new scale of reuse. Their
practical lesson is dependency direction: stable rules should not depend on
volatile details. Example: a `findLargest(values)` function should not need to
know whether values came from a form, file, or test.

### 15. The millennium

Rapid delivery and changing requirements exposed the cost of vague code and
weak feedback loops. Example: write a small test for empty input before
implementing a scan. Transfer: choose a test that would make the most likely
wrong assumption visible.

### 16. Languages

Many language features are arguments over which mistakes should be made hard
to express and which flexibility is worth retaining. Example: distinguish an
index (a number) from a value at that index. Hint: a type is a promise about
which operations make sense.

### 17. AI

Generated text can resemble an answer without supplying a dependable model,
test, or explanation. Example: ask for the predicted result before accepting
a generated solution, then run a counterexample. Transfer: require a stated
invariant and a boundary-case test for any proposed algorithm.

### 18. Hardware

Performance is shaped by physical constraints: memory, cores, and communication
do not become irrelevant merely because an abstraction hides them. Example:
compare direct array indexing with scanning for a value. Reveal: the first
uses a known position; the second must discover one.

### 19. The World Wide Web

Networked programs made delay, partial failure, and distributed ownership part
of ordinary programming. Example: treat a request result as either a value or
an error, not as a guaranteed immediate value. Transfer: name the assumption
your local array algorithm is allowed to make that a remote request cannot.

### 20. Programming

The enduring craft is not memorizing one language or tool. It is making a
claim precise enough to represent, run, test, and explain. Capstone prompt:
given an unfamiliar task, write the input representation, one step of control,
the invariant, and the smallest counterexample you would test first.

## Direct course applications

For arrays: begin with three score boxes, ask which box `[2]` names, then let
the learner run the trace and explain index as steps from the beginning. The
transfer prompt is `scores[length]`: why is that a boundary rather than a box?

For algorithm reasoning: show two visited values, ask what `best` must mean,
then let the learner run negative values and a tie. The reveal is that the
meaning of `best` survives every iteration; the transfer is changing maximum
to minimum while keeping the same proof shape.
