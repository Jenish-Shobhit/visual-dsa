# History research for Visual DSA

Research behind the history note at the end of each lesson (VISION.md, lesson anatomy item 11) and behind the timeline lab, "A history of algorithms". The structured data lives in `js/data/history.js` (120 events, 97 people) and is checked by `tests/data/history.test.js`. This file holds the reasoning, the ready-to-use notes and the open questions.

Everything below is paraphrased. No sentences are copied from the books; the only quotations are titles and a few words attributed to their speakers.

## How to read the source tags

| Tag | Source |
| --- | --- |
| **WP ch. N** | Robert C. Martin, *We, Programmers: A Chronicle of Coders from Ada to AI* (2025), chapter N. "WP cast" is its appendix "Cast of Supporting Characters"; "WP glossary" is its glossary. Read from `Computer-Science/books/martin-we-programmers-2025.epub`. |
| **Code ch. N** | Charles Petzold, *Code*, 2nd ed. (2022), chapter N. Read from `Computer-Science/books/petzold-code-the-hidden-language-2nd-ed-2022.epub`. |
| **TAOCP** | Donald Knuth, *The Art of Computer Programming*; section numbers given. The vol. 3 hashing history (§6.4) was read directly from a scan (see [Knuth-hash] below). |
| **Study dsa-NN** | The author's own long-form studies in `studies/`. |
| **GK** | General knowledge: widely documented facts (paper titles, venues, years) that I am confident of but did not re-check against a primary source in this session. |
| **[Key]** | A web source checked in this session; the key is listed in "Web sources" at the end. |

Chapters of *We, Programmers* read in full for this work: 2 (Babbage and Lovelace), 3 (Hilbert, Turing, von Neumann), 4 (Hopper), 5 (Backus), 6 (Dijkstra), 7 (Nygaard and Dahl), 16 (Languages), the glossary and the cast of characters; chapters 8–15 and 17–20 were searched for algorithm material. The book is about programmers and languages more than algorithms, so it supplies anecdotes for foundations (control flow, subroutines, arrays, merge sort, Dijkstra, queues vs stacks) and little for trees, hashing or complexity. From *Code* I used chapters 6, 8, 10, 13, 15, 24 and 27 for foundations history.

---

## Lesson history notes

Each lesson has 2–4 dated facts, a ready-to-use note in the site's voice (present tense, concrete, no hype), and source tags. Event ids refer to `js/data/history.js`.

### 01-algorithms — What is an algorithm?

- c. 300 BCE: Euclid's *Elements*, Book VII, Propositions 1–2, find the greatest common measure of two numbers by repeated subtraction. Knuth calls it the oldest nontrivial algorithm still in use. [GK] [TAOCP §4.5.2]
- c. 825: Muhammad ibn Musa al-Khwarizmi, Baghdad, writes on calculating with Hindu numerals; the Latin translation opens "Dixit Algorizmi", the source of "algorism" and later "algorithm". [GK]
- 1843: Ada Lovelace's Note G (in her translation of Menabrea's paper on the Analytical Engine, *Scientific Memoirs*) tabulates a Bernoulli-number computation with a repeated group of operations; operation 4 has its division reversed — the oldest known bug. Martin argues Babbage wrote the programs and Lovelace debugged one. [WP ch. 2] [Note-G]
- 1936: Turing's "On Computable Numbers" gives "algorithm" a precise meaning. [WP ch. 3]

**History note.** The word "algorithm" comes from al-Khwarizmi, a ninth-century Baghdad scholar whose book taught arithmetic with Hindu numerals as recipes anyone could follow. The oldest algorithm still in daily use is Euclid's, from about 300 BCE: to find the greatest common divisor, keep replacing the larger number with the remainder. In 1843 Ada Lovelace published a table of steps for Babbage's unbuilt Analytical Engine — and in operation 4 two numbers were swapped, the first known bug.

Events: `euclid-gcd`, `al-khwarizmi`, `babbage-difference-engine`, `lovelace-note-g`, `turing-computable`.

### 02-bits-and-memory — Bits, bytes & memory

- 1703 (printed 1705): Leibniz, "Explication de l'Arithmétique Binaire", Paris Academy; prompted by Joachim Bouvet's letters linking binary to the I Ching hexagrams. [Leibniz]
- 1937 (thesis submitted 10 Aug 1937; published *Trans. AIEE* 1938): Claude Shannon, "A Symbolic Analysis of Relay and Switching Circuits", MIT. Akira Nakashima described a similar correspondence earlier. [Code ch. 8] [Shannon-thesis]
- 1947: John Tukey coins "bit" (Bell Labs memo, 9 Jan 1947); Shannon credits him in 1948. June 1956: Werner Buchholz coins "byte" at IBM (Stretch). [Code ch. 10] [Bit-byte]
- 21 June 1948: Manchester Baby runs a 17-instruction program from Williams-tube memory (52 minutes, answer 131,072). Core memory: An Wang's patent 1949, Forrester's coincident-current core in Whirlwind, Aug 1953. [WP ch. 3, glossary] [Baby] [Core]

**History note.** Leibniz published arithmetic with only 0 and 1 in 1703, but binary took over only after Claude Shannon showed in 1937 that relay circuits obey Boole's algebra of true and false. John Tukey named the "bit" in 1947 and Werner Buchholz the "byte" in 1956. On 21 June 1948 the Manchester "Baby" ran the first program held in the same electronic memory as its data: 17 instructions, stored as dots of charge on a cathode-ray tube.

Events: `leibniz-binary`, `boole-algebra`, `shannon-switching`, `edvac-report`, `manchester-baby`, `core-memory`, `ascii`, `baudot-code`, `al-khwarizmi`.

### 03-control-flow — Decisions & loops

- 1944: Harvard Mark I has no jump instruction; operators carried out loops by rewinding the paper tape to a marked start when the machine stopped, occasionally gluing the tape into a loop. Backus recalled an SSEC tape loop that picked up a half-twist and became a Möbius strip. [WP ch. 4, ch. 5 fn. 9]
- May 1966: Böhm and Jacopini, "Flow Diagrams, Turing Machines and Languages with Only Two Formation Rules", *CACM* 9(5). [WP ch. 6, cast]
- March 1968: Dijkstra's letter, submitted as "A Case Against the Go To Statement", published by editor Niklaus Wirth as "Go To Statement Considered Harmful", *CACM* 11(3). Knuth's reply, "Structured Programming with go to Statements" (*Computing Surveys*, Dec 1974), contains "premature optimization is the root of all evil". [WP ch. 6] [GK]
- 1970: Frances Allen, "Control Flow Analysis" (*SIGPLAN Notices* 5(7)) — programs as graphs of basic blocks. [GK]

**History note.** The Harvard Mark I of 1944 had no jump instruction. When it paused, an operator read a register and decided whether to wind the paper tape back and run the loop again — people were the control flow. In 1966 Böhm and Jacopini proved that sequence, choice and loops are enough for any program, and in 1968 Dijkstra's letter, retitled by its editor "Go To Statement Considered Harmful", turned that into the rule most languages follow today.

Events: `mark-i-loops`, `lovelace-note-g`, `babbage-difference-engine`, `boole-algebra`, `shannon-switching`, `bohm-jacopini`, `goto-considered-harmful`, `allen-control-flow`.

### 04-functions-and-the-stack — Functions & the call stack

- 1944–46: Hopper's Harvard team keeps a library of routines written with addresses from zero ("relative coding"); in 1946 Richard Bloch adds extra tape readers so the Mark I can switch to a routine and back. [WP ch. 4]
- 1945–46: Turing's ACE report (National Physical Laboratory) files return addresses with routines BURY and UNBURY — a stack. [Turing-zeitgeist]
- 1949–51: David Wheeler's jump on EDSAC; Wilkes, Wheeler and Gill, *The Preparation of Programs for an Electronic Digital Computer* (1951). Dijkstra's ARRA (1953) likewise had no call instruction: programmers planted the return jump by hand. [Wheeler] [WP ch. 6]
- 1955–57: Bauer and Samelson's Kellerprinzip, German patent filed 30 March 1957; Dijkstra's "Recursive Programming" (*Numerische Mathematik* 2, 1960) puts ALGOL's local variables in stack frames. In SIMULA (1962–67) Dahl moves data blocks to a heap because queue members outlive the calls that create them. [Stack-patent] [Recursive-programming] [WP ch. 7]

**History note.** Early machines had no call instruction. On Cambridge's EDSAC, David Wheeler's trick was for a subroutine to rewrite its own last jump so it returned to whoever called it — which breaks the moment a routine calls itself. Alan Turing had already proposed the fix in 1945: file return addresses in a last-in, first-out list, using routines he named BURY and UNBURY.

Events: `harvard-subroutines`, `turing-ace-bury`, `edsac-wheeler-jump`, `bauer-samelson-stack`, `algol-60-recursion`, `simula-queues`.

### 05-big-o — Complexity & Big-O

- 1844: Gabriel Lamé bounds Euclid's algorithm at five division steps per decimal digit; worst case consecutive Fibonacci numbers. Often called the first running-time analysis. [Lame]
- 1894: Paul Bachmann introduces O in *Die analytische Zahlentheorie*; Edmund Landau spreads it and adds o in his 1909 handbook. [GK] [Knuth-1976]
- 1965: Hartmanis and Stearns, "On the Computational Complexity of Algorithms", *Trans. AMS* 117 (Turing Award 1993); Edmonds and Cobham propose polynomial time as "efficient". [GK]
- April 1976: Knuth, "Big Omicron and Big Omega and Big Theta", *SIGACT News* 8(2). [Knuth-1976]

**History note.** Big-O is older than computers: number theorist Paul Bachmann wrote O in 1894, the O standing for Ordnung, "order". Earlier still, in 1844, Gabriel Lamé proved that Euclid's algorithm needs at most five division steps per decimal digit — perhaps the first analysis of running time. Donald Knuth proposed Ω and Θ in 1976 so that lower and tight bounds had names too.

Events: `lame-euclid-steps`, `bachmann-big-o`, `tower-of-hanoi`, `karatsuba`, `hartmanis-stearns`, `knuth-taocp`, `knuth-big-theta`, `tarjan-union-find`.

### 06-arrays — Arrays & dynamic arrays

- 1949: Manchester Mark 1 "B-lines", the first index registers. [GK]
- Early 1950s: UNIVAC I and IBM 701 lacked index registers and indirect addressing, so programs walked arrays by rewriting the addresses inside their own instructions; Backus's Speedcoding interpreter (1953) offered index registers in software. [WP ch. 4, ch. 5]
- 1953: core memory makes access truly random (see lesson 02). April 1957: FORTRAN compiles subscripted variables onto the IBM 704's three index registers; ~30 months' work by a dozen people against a six-month estimate. [WP ch. 5] [Core]
- 1985: Tarjan, "Amortized Computational Complexity" — the tool behind "doubling costs O(1) per append". [GK] [Study dsa-02]

**History note.** On the UNIVAC I and the IBM 701, stepping through an array meant the program rewrote the address inside its own instructions, because the machines had no index registers. Manchester had built them in 1949, and FORTRAN in 1957 let scientists write A(I) and leave the address arithmetic to the compiler. Constant-time indexing also needed memory where every address is equally quick to reach — magnetic core, working by 1953.

Events: `edvac-report`, `index-registers`, `core-memory`, `fortran-arrays`, `amortized-analysis`.

### 07-strings-and-two-pointers — Strings, two pointers & windows

- 1870s: Baudot's five-signal telegraph code, with shift characters. [Code ch. 13]
- 1963 (revised 1967): ASCII; Bob Bemer is often called its father. [Code ch. 13] [WP cast]
- 1991: Unicode 1.0. September 1992: Ken Thompson designs UTF-8 on a placemat in a New Jersey diner with Rob Pike; presented at USENIX, January 1993. [UTF-8]
- 1987: Rabin–Karp rolling hash — the sliding window with a fingerprint. [GK]

**History note.** Telegraph codes of the 1870s already sent each character as a fixed group of on/off signals, and ASCII in 1963 made a string an array of 7-bit numbers with the letters in a row. Unicode broke that neat picture. In September 1992 Ken Thompson sketched UTF-8 on a diner placemat: ASCII characters stay one byte and others take two to four, which is why a string's length in bytes and in characters can differ.

Events: `baudot-code`, `ascii`, `rabin-karp`, `utf-8`.

### 08-linked-lists — Linked lists

- January 1953: Luhn's hashing memo chains colliding items — Knuth counts it among the first linked lists. [Knuth-hash]
- 1955–56: Newell, Shaw and Simon's IPL (RAND, Carnegie Tech, JOHNNIAC) for the Logic Theorist; lists drawn as boxes and arrows. Turing Award 1975 (Newell, Simon). [IPL] [GK]
- 1958–60: McCarthy's LISP; two-part cells; garbage collection. [WP ch. 16, cast] [GK]
- The tortoise-and-hare cycle test is attributed to Robert Floyd by Knuth (TAOCP vol. 2, §3.1 exercises) without a Floyd publication; Brent improved it in 1980. 1989–90: Pugh's skip lists. [GK] [Skip-lists]

**History note.** Linked lists were built for artificial intelligence. In 1955–56 Allen Newell, Cliff Shaw and Herbert Simon needed data that could grow and change shape while their Logic Theorist searched for proofs, so their IPL language joined cells with links — drawn, as you still see them, as boxes and arrows. John McCarthy's LISP (1958) made the two-part cell the building block of a whole language.

Events: `luhn-hashing`, `ipl-linked-lists`, `mccarthy-lisp`, `skip-lists`.

### 09-stacks — Stacks

- 1945–46: Turing's BURY/UNBURY (lesson 04). [Turing-zeitgeist]
- 1955–57: Bauer and Samelson, Kellerprinzip; patent DE1094019 filed 30 March 1957; IEEE Computer Pioneer Award to Bauer, 1988. June 1957: Charles Hamblin's GEORGE (Australia, English Electric DEUCE), reverse Polish on a push-down list. Łukasiewicz's parenthesis-free notation dates from the 1920s. [Stack-patent] [Hamblin]
- November 1961: Dijkstra's shunting-yard algorithm (Mathematisch Centrum report MR 34/61); 1961: Burroughs B5000, a stack machine designed for ALGOL. [Shunting-yard] [GK]
- April 1974: Liskov and Zilles, "Programming with Abstract Data Types" — a stack defined by its operations. [GK]

**History note.** The stack was invented at least three times. Turing sketched one for return addresses in 1945; in Munich, Friedrich Bauer and Klaus Samelson patented a "cellar principle" for translating formulas in 1957; and in Australia Charles Hamblin built a reverse-Polish language around a push-down list the same year. By 1961 Dijkstra's shunting-yard algorithm and the Burroughs B5000's hardware stack had made it standard.

Events: `turing-ace-bury`, `bauer-samelson-stack`, `shunting-yard`, `liskov-adt`.

### 10-queues — Queues & deques

- 1909: Agner Erlang, "The Theory of Probabilities and Telephone Conversations" (*Nyt Tidsskrift for Matematik* B 20) — the first queueing-theory paper. [Erlang]
- 1962–67: SIMULA. ALGOL's stack could not hold queue members, whose lifetimes are first-in, first-out; Dahl moved blocks to a heap, which led to classes and objects in SIMULA 67. [WP ch. 7]
- 20 July 1969: Apollo 11's 1201/1202 alarms; the priority executive (designed by J. Halcombe Laning) shed low-priority jobs; Margaret Hamilton led the flight-software team. [WP cast] [GK]
- The word "deque" is credited by Knuth to E. J. Schweppe (TAOCP vol. 1, §2.2.1). [Deque]

**History note.** Queueing theory began in a telephone exchange: in 1909 Agner Erlang worked out how calls that arrive at random pile up waiting for a free line. In the 1960s Kristen Nygaard and Ole-Johan Dahl ran into the difference between a queue and a stack head-on. Their SIMULA models needed customers to leave a queue in the order they joined, which stack-based ALGOL could not do — so Dahl moved them onto a heap, and objects were born.

Events: `erlang-queues`, `simula-queues`, `apollo-priorities`, `liskov-adt`.

### 11-hash-tables — Hash tables

- January 1953: H. P. Luhn's internal IBM memo — buckets plus chaining; digit-based hash functions. [Knuth-hash]
- 1954: Amdahl, Elaine Boehme (McGraw), Rochester and Samuel, IBM 701 assembler — Knuth credits Amdahl with open addressing and linear probing. Dec 1956: Dumey, first description in print (*Computers and Automation* 5(12)), remainder modulo a prime. 1957: Peterson, "Addressing for Random-Access Storage", *IBM J. R&D* 1, names and analyses open addressing. Ershov finds linear probing independently (1957). [Knuth-hash]
- The word "hashing" does not appear in print until Hellerman's 1967 book; Robert Morris's 1968 *CACM* survey "Scatter Storage Techniques" popularised the subject. [Knuth-hash]
- 1977–79 Carter–Wegman universal hashing; 2016 Python 3.6 compact ordered dicts; 2017 Google's Swiss tables (Abseil 2018, Rust 1.36 in 2019, Go 1.24 in Feb 2025); January 2025 Krapivin, Farach-Colton and Kuszmaul disprove Yao's 1985 conjecture on open addressing. [Study dsa-08] [Swiss] [Krapivin]

**History note.** In January 1953 Hans Peter Luhn at IBM suggested turning a key into a bucket number and chaining together the items that collide. About a year later another IBM group, building an assembler, hit on open addressing: if the slot is taken, try the next one. Programmers said "hash" for years afterwards, but Knuth found that nobody dared print such an undignified word until 1967.

Events: `luhn-hashing`, `open-addressing`, `hashing-in-print`, `bloom-filter`, `universal-hashing`, `elastic-hashing`.

### 12-recursion — Recursion

- 1202: Fibonacci's rabbits — the standard recursive definition, and the standard example of wasted recomputation. [GK]
- 1883: Édouard Lucas's Tower of Hanoi, sold under the pen name "N. Claus de Siam"; 2^64 − 1 moves ≈ 585 billion years at one per second. [GK]
- 1958–60: McCarthy, "Recursive Functions of Symbolic Expressions and Their Computation by Machine, Part I", *CACM* 3(4), April 1960. [GK]
- 1960: ALGOL 60. Martin reports that most of the committee thought recursion inefficient and useless and voted it out, but ambiguous wording let Dijkstra (who, with McCarthy, had argued for it) implement it with Jaap Zonneveld; a 1962 meeting mocked "ALGOL play-boys". Dijkstra's "Recursive Programming" (1960) explains the stack of frames. [WP ch. 6] [Recursive-programming]

**History note.** Recursion was controversial. Many on the ALGOL 60 committee thought it too slow to be worth having, and the wording that let it in was ambiguous. Dijkstra and Jaap Zonneveld implemented it anyway in their 1960 compiler, giving each call its own frame on a stack — the design you trace in this lesson.

Events: `euclid-gcd`, `fibonacci-rabbits`, `tower-of-hanoi`, `mccarthy-lisp`, `algol-60-recursion`.

### 13-binary-search — Binary search

- 1946: John Mauchly describes binary search in the Moore School Lectures. [Binary-search]
- 1960: D. H. Lehmer publishes a version for any table length (earlier ones needed n = 2^k − 1); 1962: Hermann Bottenbruch's ALGOL 60 version. Knuth: first published 1946, first bug-free 1962. [Binary-search]
- 1983 column, 1986 book: Jon Bentley, *Programming Pearls* — about 90% of professional programmers in his courses wrote buggy versions in a couple of hours. [Pearls]
- 2 June 2006: Joshua Bloch, "Extra, Extra — Read All About It: Nearly All Binary Searches and Mergesorts are Broken": `(low + high) / 2` overflows; it sat in `java.util.Arrays.binarySearch` about nine years and in Bentley's proved version. [Bloch]

**History note.** John Mauchly described binary search in 1946, yet by Knuth's count the first published version free of bugs appeared only in 1962. When Jon Bentley set the task to professional programmers, about nine in ten got it wrong. In 2006 Joshua Bloch found that even the proved version in Bentley's book, and the one in Java's library, broke on huge arrays: (low + high) / 2 overflows.

Events: `moore-school-binary-search`, `lehmer-binary-search`, `programming-pearls`, `binary-search-overflow`.

### 14-elementary-sorts — Bubble, selection & insertion sort

- 1956: Edward Friend, "Sorting on Electronic Computer Systems", *JACM* 3(3), analyses "sorting by exchange". 1962: Kenneth Iverson, *A Programming Language*, uses "bubble sort". Knuth: little to recommend it but a catchy name and some interesting theory. [Astrachan] [TAOCP §5.2.2]
- July 1959: Donald Shell's Shellsort (*CACM* 2(7)) — insertion sort on distant items first. [GK]
- November 2007: Eric Schmidt asks Barack Obama at Google for the best way to sort a million 32-bit integers; answer: "the bubble sort would be the wrong way to go". [Obama]
- June 2023: DeepMind's AlphaDev finds shorter sort3/sort4/sort5 routines, merged into LLVM libc++ (*Nature* 618); humans soon improved on them. [AlphaDev]

**History note.** Bubble sort was analysed in 1956 as "sorting by exchange" and got its catchy name from Kenneth Iverson in 1962. Knuth's verdict was that the name is its main virtue. In 2007, when Google's Eric Schmidt asked presidential candidate Barack Obama how to sort a million integers, Obama replied that bubble sort would be the wrong way to go.

Events: `bubble-sort-named`, `timsort`, `obama-bubble-sort`, `alphadev`.

### 15-merge-sort — Merge sort & divide and conquer

- 1945: von Neumann writes a merge sort for EDVAC; Knuth, "Von Neumann's First Computer Program", *Computing Surveys* 2(4), 1970, studies the 23-page manuscript. Goldstine and von Neumann's "Planning and Coding" reports (1947–48) analyse merging and introduce flow diagrams. [VN-merge] [GK]
- 1951–52: Betty Holberton writes a tape merge sort for UNIVAC (working it out with cards on the floor, first on BINAC) to answer IBM claims that tape could not be sorted, then the Sort-Merge Generator — one of the first programs that write programs. [WP ch. 4] [Sort-merge]
- 1960: Karatsuba's divide-and-conquer multiplication refutes Kolmogorov's n² conjecture within a week. [Karatsuba] [Study dsa-03]
- 2002: Tim Peters's Timsort (Python; Java 7; Android). February 2015: de Gouw et al. find a crash while verifying Java's Timsort with KeY. [Timsort-bug]

**History note.** Merge sort was among the first programs written for a stored-program computer: John von Neumann wrote it in 1945 to show that EDVAC could do more than arithmetic. A few years later, when IBM salespeople claimed that data on magnetic tape could not be sorted, Betty Holberton wrote a tape merge sort for UNIVAC — working it out by sorting cards on her floor.

Events: `von-neumann-merge-sort`, `holberton-sort-merge`, `karatsuba`, `timsort`, `binary-search-overflow`.

### 16-quick-sort — Quick sort & quickselect

- 1959: Tony Hoare, British Council exchange student at Moscow State University (machine translation, supervised by Kolmogorov), invents quicksort to sort the words of a sentence before tape lookup. [Hoare] [Quicksort]
- 1960–61: at Elliott Brothers, asked to implement Shellsort, he bets his boss sixpence he knows something faster, and wins (he confirmed the wager was paid). He could only express partitioning neatly after learning ALGOL 60 recursion. [Quicksort] [Hoare-bet]
- July 1961: Algorithms 63 (Partition), 64 (Quicksort) and 65 (Find, i.e. quickselect), *CACM* 4(7); fuller paper *Computer Journal* 5(1), 1962. [GK]
- 1997 Musser's introsort; 2009 Yaroslavskiy's dual-pivot quicksort (Java 7). Hoare died on 5 March 2026, aged 92. [Hoare] [GK]

**History note.** Tony Hoare invented quicksort in 1959 as a student in Moscow, where he needed to sort the words of Russian sentences for a machine-translation project. Back in London his boss asked him to code Shellsort; Hoare said he knew something faster, and won a bet of sixpence. He published it in 1961 together with Find — the quickselect you meet in this lesson.

Events: `hoare-quicksort`, `introsort`.

### 17-linear-time-sorts — Counting, radix & the n log n barrier

- 1887–90: Herman Hollerith's tabulator for the 1890 US census; card sorters drop cards into pockets by one column's digit. Operators sorted multi-digit keys column by column, least significant first; described as common practice by the 1920s. [Radix] [GK]
- May 1954: Harold H. Seward's MIT master's thesis (Digital Computer Laboratory Report R-232): radix sort on computers and the counting pass (counting sort). [Seward]
- 1959: Lester Ford Jr. and Selmer Johnson, "A Tournament Problem", *Amer. Math. Monthly* 66, answering Hugo Steinhaus: merge insertion comes close to the ⌈log₂ n!⌉ lower bound, which follows from counting the n! possible orders. Same Ford as Ford–Fulkerson. [Ford-Johnson] [TAOCP §5.3.1]

**History note.** Radix sort is older than electronic computers. Punched-card operators sorted a deck on a many-digit key one column at a time, least significant first, as the machine dropped each card into one of ten pockets. In 1954 Harold Seward's MIT thesis moved the method onto computers and added the counting pass that tells each key exactly where to go.

Events: `hollerith-census`, `seward-radix`, `ford-johnson`, `obama-bubble-sort`.

### 18-trees — Trees & traversals

- 1847: Kirchhoff uses spanning trees to analyse electrical networks. 1857: Arthur Cayley names "trees" (in work on differential operators); later counts labelled trees, n^(n−2). [GK]
- 1951–52: Huffman's code trees (lesson 32). [Huffman]
- 1968: Knuth's *Fundamental Algorithms* makes tree traversal and representation standard textbook material. [GK]

**History note.** Arthur Cayley named trees in 1857, and Gustav Kirchhoff had used spanning trees to analyse electrical circuits ten years before. Chemists used trees to count possible molecules long before programmers used them to hold data. In computing they arrived in the 1950s, in code trees like Huffman's and in the first search trees.

Events: `cayley-trees`, `huffman-coding`, `knuth-taocp`.

### 19-binary-search-trees — Binary search trees

- 1950s: several independent inventors. 1960: P. F. Windley, "Trees, Forests and Rearranging" (*Computer Journal* 3); A. D. Booth and A. J. T. Colin, "On the Efficiency of a New Method of Dictionary Construction" (*Information and Control* 3). [BST] [TAOCP §6.2.2]
- 1962: Thomas N. Hibbard, *JACM* 9(1) — analysis and the successor-swap deletion. [BST]
- 1985: Sleator and Tarjan's splay trees — self-adjusting BSTs with amortized guarantees. [GK]

**History note.** Several people invented binary search trees in the 1950s; the first papers, by P. F. Windley and by Andrew Booth and Andrew Colin, appeared in 1960. In 1962 Thomas Hibbard showed how to delete a node with two children by swapping in its successor, the method you still use. The trees are fast on random data and slow on sorted data — the problem the next lesson solves.

Events: `binary-search-trees`, `amortized-analysis`.

### 20-balanced-trees — Balanced trees: AVL & red-black

- 1962: G. M. Adelson-Velsky and E. M. Landis, "An Algorithm for the Organization of Information", *Doklady Akademii Nauk SSSR* 146, pp. 263–266; English translation the same year. [AVL]
- 1970–72: Rudolf Bayer and Edward McCreight, Boeing Scientific Research Labs — B-trees (*Acta Informatica* 1, 1972). McCreight later explained that they could not use Boeing's name without the lawyers, and that balance was part of it; Bayer likes to say that thinking about what the B means teaches you about B-trees. [B-tree]
- 1972: Bayer, symmetric binary B-trees; 1978: Guibas and Sedgewick, "A Dichromatic Framework for Balanced Trees" (FOCS). Red was reportedly the best colour on their Xerox PARC laser printer; Guibas also said it was the pens they had. [Red-black]

**History note.** The first self-balancing tree came from Moscow in 1962: Georgy Adelson-Velsky and Evgenii Landis kept every node's two subtrees within one level of each other. Red-black trees arrived in 1978 from Leonidas Guibas and Robert Sedgewick, reworking an idea of Rudolf Bayer. Red was reportedly the colour that looked best on their Xerox PARC laser printer.

Events: `avl-trees`, `b-trees`, `red-black-trees`, `amortized-analysis`.

### 21-heaps — Heaps & priority queues

- June 1964: J. W. J. Williams, "Algorithm 232: Heapsort", *CACM* 7(6) — introduces the array-based binary heap. December 1964: Robert Floyd, "Algorithm 245: Treesort 3", *CACM* 7(12) — linear-time bottom-up construction. [Heapsort]
- 20 July 1969: Apollo 11's priority executive sheds low-priority jobs during the landing alarms. [WP cast] [GK]
- 1984–87: Fredman and Tarjan's Fibonacci heaps (O(1) amortized decrease-key). 2024: Haeupler, Hladík, Rozhoň, Tarjan and Tětek prove Dijkstra with a working-set heap is universally optimal (FOCS 2024). [GK] [Universal-Dijkstra]

**History note.** J. W. J. Williams introduced the binary heap in 1964 as the engine of heapsort, storing a whole tree in an array with no pointers. Six months later Robert Floyd showed how to build a heap in linear time by sifting down from the middle. Priority scheduling had its most famous test in 1969, when Apollo 11's guidance computer, overloaded during the landing, dropped low-priority jobs and kept the vital ones running.

Events: `huffman-coding`, `prim-mst`, `binary-heap`, `apollo-priorities`, `fibonacci-heaps`, `introsort`.

### 22-tries — Tries

- 1912: Axel Thue describes the idea abstractly. 1959: René de la Briandais, "File Searching Using Variable Length Keys" (Western Joint Computer Conference). [Trie]
- September 1960: Edward Fredkin, "Trie Memory", *CACM* 3(9) — named from re*trie*val, pronounced "tree" by Fredkin; many say "try". [Trie]
- 1973: Peter Weiner's suffix tree (Knuth reportedly called it "algorithm of the year 1973"); June 1975: Aho and Corasick, *CACM* 18(6), trie with failure links — Unix fgrep. [Suffix-tree] [GK]

**History note.** René de la Briandais described tries in 1959, and Edward Fredkin named them in 1960 after the middle of the word "retrieval". Fredkin said it like "tree"; many people now say "try" to avoid the confusion. In 1975 Alfred Aho and Margaret Corasick added failure links to a trie of search words, and their algorithm became the Unix tool fgrep.

Events: `de-la-briandais-trie`, `fredkin-trie`, `aho-corasick`.

### 23-segment-and-fenwick-trees — Segment & Fenwick trees

- 1977: Jon Bentley, unpublished Carnegie Mellon notes on Klee's rectangle problem (area of a union of rectangles) — the segment tree. [Klee]
- 1989: Boris Ryabko describes the structure ("A fast on-line code", *Soviet Math. Doklady*); 1994: Peter Fenwick, "A New Data Structure for Cumulative Frequency Tables", *Software: Practice and Experience* 24(3), for adaptive arithmetic coding. [Fenwick]

**History note.** Jon Bentley introduced segment trees in 1977, in unpublished notes on Klee's problem: how much area does a set of overlapping rectangles cover? Fenwick trees came from data compression. Peter Fenwick published them in 1994 to keep running symbol counts for arithmetic coding, not knowing that Boris Ryabko had described the same structure in 1989.

Events: `bentley-segment-tree`, `fenwick-trees`.

### 24-union-find — Union-find

- May 1964: Bernard Galler and Michael Fischer, "An Improved Equivalence Algorithm", *CACM* 7(5) — parent-pointer forests for FORTRAN EQUIVALENCE statements. [Union-find] [Fischer]
- 1956: Kruskal's MST needs exactly this connectivity test. [GK]
- 1973: Hopcroft and Ullman, log* bound; 1975: Tarjan, "Efficiency of a Good But Not Linear Set Union Algorithm", *JACM* 22(2) — O(α(n)), tight; 1989: Fredman and Saks's general lower bound. [Union-find]

**History note.** Union-find was invented to compile FORTRAN. Its EQUIVALENCE statement lets several names share one storage location, and in 1964 Bernard Galler and Michael Fischer tracked the groups of names as trees of parent pointers. In 1975 Robert Tarjan proved that with union by rank and path compression each operation costs O(α(n)), a function that stays at 4 or below for any input you could ever store.

Events: `kruskal-mst`, `galler-fischer`, `tarjan-union-find`.

### 25-graphs — Graphs & representations

- 26 August 1735: Euler presents the Königsberg solution to the St Petersburg Academy; printed 1741 as "Solutio problematis ad geometriam situs pertinentis". [Konigsberg]
- 1878: J. J. Sylvester uses "graph" (in *Nature*); 1936: Dénes Kőnig's first graph-theory textbook. [GK]
- 1970: Frances Allen's control-flow graphs bring graphs into compilers. [GK]

**History note.** Graph theory began with a walking puzzle. In 1735 Leonhard Euler showed that no stroll through Königsberg crosses each of its seven bridges exactly once, by reducing the city to four land masses and the bridges between them. A walk that uses every bridge once needs zero or two land masses touching an odd number of bridges, and in Königsberg all four did.

Events: `euler-konigsberg`, `allen-control-flow`.

### 26-bfs-and-dfs — BFS & DFS

- 1882: Édouard Lucas publishes Charles Pierre Trémaux's maze rule (mark passages, retreat along your trail) — depth-first search. [GK]
- 1945: Konrad Zuse's BFS for connected components in the Plankalkül manuscript (rejected thesis, published 1972). 1957 symposium / 1959 proceedings: Edward F. Moore, "The Shortest Path Through a Maze". 1961: C. Y. Lee's wire router. [BFS]
- 1972–74: Tarjan's linear-time DFS algorithms; Hopcroft and Tarjan, biconnectivity and planarity; Turing Award 1986. [GK]

**History note.** Depth-first search is a 19th-century maze trick: Charles Trémaux marked each passage as he walked it and retreated along his own marks when he got stuck. Breadth-first search was written down by Konrad Zuse in 1945, in a thesis that stayed unpublished until 1972, so Edward Moore of Bell Labs had to reinvent it in 1957 to find the shortest path through a maze.

Events: `tremaux-maze`, `zuse-bfs`, `moore-maze`, `dinitz-blocking-flow`, `tarjan-dfs`, `kosaraju-scc`.

### 27-topological-sort — Topological sort & cycles

- 1957–58: the critical path method (DuPont / Remington Rand; spread by Mauchly's consulting firm, per Martin's cast list) and PERT (US Navy, Polaris) model projects as dependency networks. [WP cast] [GK]
- November 1962: Arthur B. Kahn (Westinghouse, Baltimore), "Topological Sorting of Large Networks", *CACM* 5(11): a 30,000-activity PERT network ordered in under an hour on an IBM 7090. [Kahn]
- 1972: Tarjan's SCC algorithm (*SIAM J. Comput.* 1(2)); 1978: Kosaraju's two-pass method (unpublished), published by Sharir in 1981. [Kosaraju] [GK]

**History note.** Topological sorting grew out of project management. Networks of tasks that must wait for other tasks — PERT for the Navy's Polaris missile, the critical path method in industry — needed an order that respects every dependency. In 1962 Arthur Kahn of Westinghouse published the rule of repeatedly removing a task with no remaining prerequisites; it ordered 30,000 activities in under an hour on an IBM 7090.

Events: `kahn-topological-sort`, `tarjan-dfs`, `kosaraju-scc`.

### 28-dijkstra-and-a-star — Dijkstra & A*

- 1956: Dijkstra designs the algorithm in about twenty minutes on a café terrace in Amsterdam with his fiancée (Maria "Ria" Debets), without pencil and paper, as a demonstration for the ARMAC — shortest routes on a simplified map of 64 Dutch cities (6-bit city numbers). [WP ch. 6] [Dijkstra-wiki]
- 1959: "A Note on Two Problems in Connexion with Graphs", *Numerische Mathematik* 1, pp. 269–271 — shortest paths and MST (the latter used to minimise X1 back-panel wiring). [WP ch. 6]
- 1968: Hart, Nilsson and Raphael, "A Formal Basis for the Heuristic Determination of Minimum Cost Paths", *IEEE Trans. SSC* 4(2) — A* for Shakey at SRI. [A-star]
- 2025: Duan, Mao, Mao, Shu and Yin, "Breaking the Sorting Barrier for Directed Single-Source Shortest Paths", STOC best paper — O(m log^(2/3) n). [Duan]

**History note.** Edsger Dijkstra designed his algorithm in about twenty minutes in 1956, sitting on a café terrace in Amsterdam with his fiancée, with no pencil or paper. He wanted a demonstration for the new ARMAC computer that anyone could follow: the shortest route between Dutch cities. A* followed in 1968, built at SRI to plan paths for Shakey, a robot that decided its own moves.

Events: `dijkstra-cafe`, `dijkstra-1959-paper`, `a-star`, `fibonacci-heaps`, `sorting-barrier-sssp`.

### 29-bellman-ford-and-floyd-warshall — Bellman-Ford & Floyd-Warshall

- Alfonso Shimbel (symposium 1954, proceedings 1955), Lester Ford ("Network Flow Theory", RAND P-923, 1956), Richard Bellman ("On a Routing Problem", *Quarterly of Applied Mathematics* 16, 1958), Edward F. Moore (1957/59). Distributed Bellman–Ford routed the ARPANET; RIP later. [Walden] [GK]
- 1959: Bernard Roy (*Comptes rendus* 249); January 1962: Stephen Warshall, "A Theorem on Boolean Matrices", *JACM* 9(1); June 1962: Robert Floyd, "Algorithm 97: Shortest Path", *CACM* 5(6). Warshall's rum bet. [Warshall]
- 2022: Bernstein, Nanongkai and Wulff-Nilsen, negative-weight SSSP in near-linear time (FOCS 2022). [BNW]

**History note.** Bellman–Ford was found at least four times in five years, by Alfonso Shimbel, Lester Ford, Richard Bellman and Edward Moore; a distributed version later routed packets across the ARPANET. Floyd–Warshall has several parents too. Stephen Warshall reportedly bet a colleague a bottle of rum on who could first settle whether his method always works, proved it overnight, and shared the rum with the loser.

Events: `bellman-ford-moore`, `floyd-warshall`, `negative-weights-near-linear`.

### 30-minimum-spanning-trees — Minimum spanning trees

- 1926: Otakar Borůvka, "O jistém problému minimálním" plus an engineers' version, prompted by Jindřich Saxel of the West Moravian power company. [Boruvka]
- 1930: Vojtěch Jarník's paper written as a letter to Borůvka (the "Prim" method). [Prim-wiki]
- 1956: Joseph Kruskal, *Proc. AMS* 7; 1957: Robert Prim, "Shortest Connection Networks and Some Generalizations", *Bell System Technical Journal* 36; 1959: Dijkstra (X1 back-panel wiring). [GK] [WP ch. 6] [Study dsa-12]

**History note.** The first minimum spanning tree algorithm was written for a power company. In 1926 Otakar Borůvka, asked by a friend how to connect the towns of Moravia to the grid with the least cable, published a method that merges the cheapest links in rounds. Jarník, Kruskal, Prim and Dijkstra followed; Dijkstra used his version to save copper wire in the back panel of the X1 computer.

Events: `boruvka-mst`, `jarnik-mst`, `kruskal-mst`, `prim-mst`, `dijkstra-1959-paper`.

### 31-network-flow — Max flow & min cut

- 24 October 1955: T. E. Harris and Gen. F. S. Ross, "Fundamentals of a Method for Evaluating Rail Net Capacities" (RAND, secret; declassified 21 May 1999 at Schrijver's request): 44 vertices, 105 edges, flow and cut both 163,000 tons, the cut labelled "the bottleneck"; their interest was interdiction. [Schrijver]
- Ford and Fulkerson: RAND RM-1400 (19 Nov 1954), augmenting paths (29 Dec 1955), *Canadian J. Math.* 8 (1956); Elias, Feinstein and Shannon independently (1956). [Schrijver]
- January 1969 / 1970: Yefim Dinitz (Adelson-Velsky's group) — blocking flows, a class exercise; 1972: Edmonds and Karp, *JACM* 19(2); 2022: Chen, Kyng, Liu, Peng, Probst Gutenberg and Sachdeva, m^(1+o(1)) (FOCS 2022 best paper). [Dinic] [Maxflow-2022]

**History note.** Max flow began as a Cold War question. In 1955 Ted Harris and General Frank Ross at RAND modelled the railways from the Soviet Union into Eastern Europe as a network of 44 nodes, found a flow of 163,000 tons, and marked the matching minimum cut as "the bottleneck" — the links an air force would target. Ford and Fulkerson proved the general rule: the largest flow always equals the smallest cut.

Events: `harris-ross-rail`, `ford-fulkerson`, `dinitz-blocking-flow`, `edmonds-karp`, `max-flow-almost-linear`.

### 32-greedy — Greedy algorithms

- 1951–52: David Huffman, term paper in Robert Fano's MIT information-theory course (exempting him from the final); "A Method for the Construction of Minimum-Redundancy Codes", *Proc. IRE* 40(9), 1952. Beat Shannon–Fano by building bottom-up. [Huffman] [Huffman-MAA]
- 1935: Hassler Whitney defines matroids (*Amer. J. Math.* 57); Takeo Nakasawa independently. 1957 Rado; 1971 Jack Edmonds, "Matroids and the Greedy Algorithm", *Math. Programming* 1. [GK] [Study dsa-16]
- MST algorithms (1926, 1956, 1957) are the classic greedy successes. [GK]

**History note.** In 1951 MIT professor Robert Fano let his students skip the final exam if they could find the most efficient binary code. David Huffman almost gave up, then saw that he should build the code tree from the bottom, repeatedly merging the two rarest symbols — beating the method Fano had worked out with Claude Shannon. Twenty years later Jack Edmonds showed that matroids are exactly the structures on which greedy choices like this are always optimal.

Events: `boruvka-mst`, `whitney-matroids`, `huffman-coding`, `kruskal-mst`, `edmonds-greedy-matroids`.

### 33-backtracking — Backtracking

- 1848: Max Bezzel poses eight queens (*Berliner Schachzeitung*); 1850: Franz Nauck publishes all 92 solutions. Gauss's involvement was a brief, incomplete attempt; an 1874 article by J. W. L. Glaisher wrongly credited him, and the error spread (Campbell, *Historia Mathematica* 4, 1977). [Queens]
- 1950s: D. H. Lehmer coins "backtrack"; 1960: R. J. Walker's general description; 1965: Golomb and Baumert, "Backtrack Programming", *JACM* 12(4). [Backtracking]
- April 1971: Wirth, "Program Development by Stepwise Refinement", *CACM* 14(4), develops eight queens (following a suggestion of Dijkstra, who used it in *Notes on Structured Programming*). [Wirth-1971]

**History note.** The eight queens puzzle was published in 1848 by chess composer Max Bezzel, and Franz Nauck listed all 92 solutions in 1850. You may read that Gauss solved it; in fact he made a brief, incomplete attempt, and the story comes from a later mix-up. D. H. Lehmer named the method "backtracking" in the 1950s, and eight queens became its standard example after Wirth and Dijkstra used it around 1970.

Events: `eight-queens`, `backtrack-named`.

### 34-dynamic-programming — Dynamic programming I

- Early 1950s, RAND: Richard Bellman; *Dynamic Programming* (Princeton University Press, 1957). [Dreyfus]
- Naming story (Bellman, *Eye of the Hurricane*, 1984): Secretary of Defense Charles E. Wilson hated the word "research"; "programming" meant planning; "dynamic" cannot be used pejoratively. Dreyfus notes the chronology is shaky (Wilson took office January 1953). [Dreyfus] [Bellman-name]
- Fibonacci (1202) and Floyd–Warshall (1962) are DP in disguise. [GK]

**History note.** Richard Bellman named dynamic programming at RAND in the early 1950s, and by his own account chose the name to disguise what he was doing. The Secretary of Defense, he said, could not stand the word "research"; "programming" meant planning, and nobody could use "dynamic" as an insult. Historians note that the dates do not quite line up, so enjoy the story as Bellman told it.

Events: `fibonacci-rabbits`, `bellman-dynamic-programming`, `floyd-warshall`.

### 35-dynamic-programming-2d — Dynamic programming II

- 1965 (Russian; English 1966): Vladimir Levenshtein, "Binary Codes Capable of Correcting Deletions, Insertions, and Reversals". [Levenshtein]
- Multiple discovery of the table: Vintsyuk 1968 (speech), Needleman and Wunsch 1970 (*J. Mol. Biol.* 48, proteins), Wagner and Fischer, "The String-to-String Correction Problem", *JACM* 21(1), 1974; Hunt and McIlroy's diff (1976) uses LCS. [Wagner-Fischer] [GK]
- 2015: Backurs and Indyk (STOC) — no strongly subquadratic edit distance unless SETH fails. [Study dsa-23] [GK]

**History note.** The edit-distance table was discovered again and again: by speech researchers in 1968, by biologists aligning proteins in 1970, and by computer scientists Robert Wagner and Michael Fischer in 1974. Vladimir Levenshtein had defined the distance in 1965 while studying codes that repair dropped and inserted bits. In 2015 Arturs Backurs and Piotr Indyk explained why nobody has beaten the quadratic table: doing so would mean a breakthrough on satisfiability.

Events: `bellman-dynamic-programming`, `levenshtein-distance`, `wagner-fischer`, `edit-distance-lower-bound`.

### 36-string-matching — String matching

- June 1968: Ken Thompson, "Regular Expression Search Algorithm", *CACM* 11(6); grep grows out of ed. [GK]
- 1969–77: KMP. James Morris found it in summer 1969 while writing a text editor for Berkeley's CDC 6400; other implementors, not understanding it, damaged it with gratuitous "fixes" within months. Knuth found it independently in 1970 by distilling Cook's theorem on two-way pushdown automata; Pratt removed the alphabet dependence; published *SIAM J. Comput.* 6(2), 1977. [KMP]
- October 1977: Boyer and Moore, "A Fast String Searching Algorithm", *CACM* 20(10) (Gosper independently); 1975 Aho–Corasick; 1987 Rabin–Karp (*IBM J. R&D* 31(2)). [KMP] [GK]

**History note.** James Morris found the Knuth–Morris–Pratt idea in 1969 while writing a text editor at Berkeley, but his code was so subtle that other programmers broke it with well-meant fixes within months. Knuth found the same algorithm independently, by working backwards from a theorem about automata, and the three published together in 1977. Boyer and Moore's method, from the same year, reads the pattern backwards and can skip most of the text.

Events: `thompson-regex`, `knuth-morris-pratt`, `aho-corasick`, `boyer-moore`, `rabin-karp`.

### 37-p-vs-np — P, NP & hard problems

- 20 March 1956: Gödel's letter to von Neumann asks how fast proofs of length n can be found; rediscovered late 1980s (Hartmanis 1989). [Godel-letter]
- May 1971: Stephen Cook, "The Complexity of Theorem-Proving Procedures", STOC. Cook had been denied tenure by Berkeley's mathematics department in 1970; Karp later called it an everlasting shame. [Cook] [Study dsa-20]
- 1972: Karp, "Reducibility Among Combinatorial Problems" — 21 NP-complete problems; 1973: Leonid Levin, "Universal Sequential Search Problems", *Problemy Peredachi Informatsii* 9(3). May 2000: Clay Millennium Prize. [Study dsa-20] [GK]
- Context: Turing 1936 (undecidability), Hartmanis–Stearns 1965, AKS 2002. [WP ch. 3] [GK]

**History note.** In March 1956 Kurt Gödel wrote to a dying John von Neumann asking whether proofs could be found in time growing only like n or n² — essentially the P versus NP question. Von Neumann never answered. Stephen Cook stated the question precisely in 1971, Leonid Levin reached the same idea in Moscow, and in 1972 Richard Karp showed that 21 familiar problems are all equally hard.

Events: `turing-computable`, `godel-letter`, `hartmanis-stearns`, `cook-np-completeness`, `karp-21-problems`, `primes-in-p`, `edit-distance-lower-bound`.

### 38-randomized-algorithms — Randomized algorithms

- 1946–49: Ulam's solitaire question while ill (Canfield solitaire); von Neumann; Metropolis names it after the casino where Ulam's uncle gambled; ENIAC runs, spring 1948 (Klára von Neumann among programmers); Metropolis and Ulam, *JASA* 1949. Buffon's needle (posed 1733, published 1777) is a precursor. [WP ch. 3, glossary] [LANL]
- 1976–80: Miller's ERH-conditional test (*JCSS* 13, 1976); Rabin's "Probabilistic Algorithms" (Traub symposium, 1976) and "Probabilistic Algorithm for Testing Primality" (*J. Number Theory* 12, 1980). 2002: AKS deterministic test. [Miller-Rabin] [GK]
- July 1970: Burton Bloom, "Space/Time Trade-offs in Hash Coding with Allowable Errors", *CACM* 13(7) — 500,000-word hyphenation example. 1977–79: Carter–Wegman. [Bloom]
- March 1985: Vitter, "Random Sampling with a Reservoir", *ACM TOMS* 11(1) (Algorithm R credited by Knuth to Alan Waterman). 1989/1990: Pugh's skip lists (WADS; *CACM* 33(6)). 1993: Karger's random-contraction min cut. [Vitter] [Skip-lists] [GK]

**History note.** Monte Carlo methods began with a card game. In 1946, recovering from an illness, Stanislaw Ulam wondered how often solitaire comes out, and realised that dealing many random games on a computer would answer faster than any formula. Nicholas Metropolis named the method after the casino where Ulam's uncle liked to gamble, and by 1948 it was running on ENIAC.

Events: `monte-carlo`, `bloom-filter`, `randomized-primality`, `universal-hashing`, `reservoir-sampling`, `skip-lists`, `primes-in-p`.

---

## People

The full people layer (97 people, with bios, life years and `knownFor`) is in `js/data/history.js`. Key figures, and whether *We, Programmers* discusses them:

| Person | Life | Known for (in this course) | In *We, Programmers*? |
| --- | --- | --- | --- |
| Ada Lovelace | 1815–1852 | Note G, the first published program (lesson 01, 03) | Yes — ch. 2 (argues Babbage wrote the programs; "first pair programmers") |
| Charles Babbage | 1791–1871 | Difference and Analytical Engines | Yes — ch. 2 |
| Alan Turing | 1912–1954 | Computability (01, 37), BURY/UNBURY stack (04, 09) | Yes — ch. 3 |
| John von Neumann | 1903–1957 | EDVAC report (02), merge sort (15), Monte Carlo (38) | Yes — ch. 3 (merge sort itself not mentioned) |
| Grace Hopper | 1906–1992 | Mark I operator loops (03), relative-coded subroutine library (04), compilers | Yes — ch. 4, the book's longest profile |
| Betty Holberton | 1917–2001 | UNIVAC tape merge sort and Sort-Merge Generator (15) | Yes — ch. 4 (as Betty Snyder) and cast |
| John Backus | 1924–2007 | FORTRAN arrays (06), BNF (12) | Yes — ch. 5 |
| Edsger Dijkstra | 1930–2002 | Shortest paths (28), MST (30), ALGOL recursion (12), shunting-yard (09), go-to letter (03) | Yes — ch. 6 |
| Tony Hoare | 1934–2026 | Quicksort, quickselect (16) | Only cited (as co-author of *Structured Programming*, and as an editor of a Dijkstra book) |
| Donald Knuth | b. 1938 | TAOCP (05, 18), KMP (36), Ω/Θ (05) | Cast entry; mentioned in ch. 5, 6, 12 (BNF renaming, *Fundamental Algorithms*) |
| Niklaus Wirth | 1934–2024 | Retitled the go-to letter (03); eight queens by stepwise refinement (33) | Yes — ch. 6 and cast |
| Kristen Nygaard, Ole-Johan Dahl | 1926–2002, 1931–2002 | SIMULA: queues forced heap allocation (10, 04) | Yes — ch. 7 |
| John McCarthy | 1927–2011 | LISP (08, 12) | Cast; mentioned ch. 6, 8, 10, 16 |
| Böhm and Jacopini | 1923–2017, 1936–2001 | Structured program theorem (03) | Yes — ch. 6 and cast |
| Kurt Gödel | 1906–1978 | 1956 letter (37) | Yes — ch. 3 (incompleteness; the 1956 letter is not mentioned) |
| Stanislaw Ulam | 1909–1984 | Monte Carlo (38) | Cast and glossary |
| Gene Amdahl | 1922–2015 | Linear probing (11) | Cast (not for hashing) |
| J. Halcombe Laning | 1920–2012 | Apollo priority executive (21, 10) | Cast (credits his design with saving Apollo 11) |
| George Boole | 1815–1864 | Boolean algebra (02, 03) | Cast |
| Barbara Liskov | b. 1939 | Abstract data types (09, 10) | Mentioned in ch. 14 (design principles) |
| Claude Shannon | 1916–2001 | Switching algebra (02), information theory, min-cut (31) | No |
| Robert Tarjan | b. 1948 | DFS, SCC (26, 27), union-find bound (24), Fibonacci heaps (21), amortized analysis (06) | No |
| Richard Bellman | 1920–1984 | Dynamic programming (34, 35), Bellman–Ford (29) | No |
| Frances Allen | 1932–2020 | Control-flow graphs (03, 25) | No (the book's ch. 9 profiles a different Allen, Judith) |
| Margaret Hamilton | b. 1936 | Apollo flight software (21, 10) | No |

Other people in the data: al-Khwarizmi, Euclid, Fibonacci, Leibniz, Euler, Lamé, Cayley, Lucas, Hollerith, Bachmann, Landau, Erlang, Borůvka, Jarník, Whitney, Howard Aiken (WP ch. 4), John Mauchly (WP ch. 3–4), Konrad Zuse, Maurice Wilkes (WP glossary), David Wheeler, Nicholas Metropolis, David Huffman, H. P. Luhn, Friedrich Bauer, Klaus Samelson, Allen Newell, Cliff Shaw, Herbert Simon, Lester Ford Jr., D. R. Fulkerson, Ted Harris, Joseph Kruskal, Robert Prim, Peter Naur (WP cast), Edward F. Moore, Edward Fredkin, D. H. Lehmer, Anatoly Karatsuba, Andrey Kolmogorov, Adelson-Velsky, Landis, Robert Floyd, Stephen Warshall, Bernard Roy, J. W. J. Williams, Bernard Galler, Michael J. Fischer, Hartmanis, Stearns, Jack Edmonds, Vladimir Levenshtein, Peter Hart, Nils Nilsson, Bertram Raphael, Ken Thompson (WP ch. 10), James H. Morris, Vaughan Pratt, Rudolf Bayer, Edward McCreight, Stephen Cook, Leonid Levin, John Hopcroft, Richard Karp, Michael Rabin, Robert Boyer, J Strother Moore, Jon Bentley, Leonidas Guibas, Robert Sedgewick, Jeffrey Vitter.

Deaths since many reference works were written: Tony Hoare (5 March 2026, Cambridge), Niklaus Wirth (1 January 2024), Edward Fredkin (2023), Robert Prim (2021), Frances Allen (2020), Juris Hartmanis (2022).

---

## Facts we could not verify (or where sources disagree)

1. **How long Dijkstra and Zonneveld took to write the ALGOL 60 compiler.** Martin (WP ch. 6) says six weeks; other accounts (e.g. summaries of Dijkstra's EWD 1166) describe about eight months from December 1959. The data avoids giving a duration.
2. **Bellman's naming story.** It comes from Bellman's 1984 autobiography; Stuart Dreyfus (2002) points out that Charles Wilson became Secretary of Defense only in January 1953, after Bellman had started using the term. Presented as "Bellman's own telling".
3. **Red-black colours.** Two versions from the inventors: the Xerox PARC colour laser printer printed red best (Sedgewick), or the pens they had were red and black (Guibas). Presented as "reportedly … or".
4. **Warshall's rum bet.** Sourced to Wikipedia's Warshall biography; no primary source found. Presented with "reportedly".
5. **Knuth's "algorithm of the year 1973" for Weiner's suffix tree.** Widely repeated (Wikipedia, suffix-tree literature) but I did not find the original remark. Kept out of the data; mentioned here with "reportedly".
6. **Conway Berners-Lee and David Wheeler as early BST users (c. 1960).** Wikipedia's binary-search-tree article states it, citing Knuth; I could not confirm it in a primary source, so the data mentions only "several people in the 1950s".
7. **When punched-card operators adopted least-significant-digit-first radix sorting.** Sources say Hollerith's machines (1887–90) and later sorters supported it and that it was common "as early as 1923"; the exact date is soft.
8. **Mauchly and insertion sort.** Mauchly's 1946 lecture is well documented for binary search; I did not verify claims that it also discussed (binary) insertion sorting, so the data claims only binary search.
9. **Łukasiewicz's notation date.** Usually 1924, sometimes 1920; the data says "the 1920s".
10. **Who wrote Note G.** Historians disagree on the balance between Lovelace and Babbage. Martin (WP ch. 2) argues Babbage wrote the programs and Lovelace debugged one; Allan Bromley documented earlier, simpler unpublished Babbage programs (1837–40). The data states the debate.
11. **Tony Hoare's date of death.** Wikipedia gives 5 March 2026 (Cambridge); The Register's obituary is dated 12 March. The data uses 2026 only.
12. **The Obama question's exact date.** Reported as 14 November 2007; the data says 2007.
13. **Dual-pivot quicksort's advantage coming from cache behaviour.** Removed from the data (secondary sources only).
14. **FOCS best-paper awards** for Bernstein–Nanongkai–Wulff-Nilsen (2022) and Haeupler et al. (2024): not confirmed in this session, so the data does not claim them. The award for Chen et al. (FOCS 2022) and Duan et al. (STOC 2025) were confirmed.
15. **Edward McCreight's birth year** and **Yefim Dinitz's** — not found; McCreight is stored with `born: null`, and Dinitz is named only in event text.
16. **Tukey's memo date (9 January 1947)** — from secondary sources (Wikipedia etymology list), consistent with Petzold's "around 1947".

## Corrections to existing material

- **We, Programmers, ch. 3** says Turing planned the ACE "in Manchester". The ACE was designed at the National Physical Laboratory, Teddington; Turing moved to Manchester later (1948). Don't reuse the Manchester claim.
- **We, Programmers, ch. 6** says Dijkstra's demonstration used "647 cities". The EPUB has run the footnote marker 7 into the number: it is 64 cities (6-bit city numbers, as the footnote says).
- **We, Programmers, ch. 2** says Babbage wrote in 1832, in *The Life of a Philosopher*, that every game of skill could be played by an automaton. The book is *Passages from the Life of a Philosopher*, published in 1864.
- **We, Programmers, ch. 6 references** list "I Remember Edsger Dijkstra (1930–2001)"; Dijkstra died on 6 August 2002.
- **Study dsa-17** ("The max-flow problem was posed in 1955 by Ford and Fulkerson in a classified RAND report …") conflates two documents. The classified 1955 report (declassified 1999) is by T. E. Harris and F. S. Ross; Ford and Fulkerson's first, unclassified report is RAND RM-1400 of 19 November 1954, published in 1956. Harris and Ross cared about the minimum cut (interdiction). Suggested wording: "The problem came from a secret 1955 RAND study by Ted Harris and Frank Ross of the Soviet rail network — the 'min cut' was the cheapest set of links to bomb — and Ford and Fulkerson, who had the problem from Harris, proved max-flow = min-cut in 1956."

## Web sources checked

| Key | URL |
| --- | --- |
| A-star | https://en.wikipedia.org/wiki/A*_search_algorithm |
| AlphaDev | https://www.nature.com/articles/s41586-023-06004-9 ; https://arxiv.org/pdf/2307.14503 |
| Astrachan | https://users.cs.duke.edu/~ola/papers/bubble.pdf |
| AVL | https://en.wikipedia.org/wiki/AVL_tree |
| B-tree | https://en.wikipedia.org/wiki/B-tree |
| Backtracking | https://en.wikipedia.org/wiki/Backtracking |
| Baby | https://en.wikipedia.org/wiki/Manchester_Baby |
| Bellman-name | https://conversableeconomist.com/2022/08/24/why-is-it-called-dynamic-programming/ |
| BFS | https://en.wikipedia.org/wiki/Breadth-first_search |
| Binary-search | https://en.wikipedia.org/wiki/Binary_search |
| Bit-byte | https://en.wikipedia.org/wiki/List_of_computer_term_etymologies ; https://en.wikipedia.org/wiki/Werner_Buchholz |
| Bloch | https://research.google/blog/extra-extra-read-all-about-it-nearly-all-binary-searches-and-mergesorts-are-broken/ |
| Bloom | https://en.wikipedia.org/wiki/Bloom_filter |
| BNW | https://arxiv.org/abs/2203.03456 |
| Boruvka | https://en.wikipedia.org/wiki/Bor%C5%AFvka%27s_algorithm |
| BST | https://en.wikipedia.org/wiki/Binary_search_tree |
| Cook | https://en.wikipedia.org/wiki/Stephen_Cook |
| Core | https://www.computerhistory.org/storageengine/whirlwind-computer-debuts-core-memory/ |
| Deque | https://en.wikipedia.org/wiki/Double-ended_queue |
| Dijkstra-wiki | https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm |
| Dinic | https://en.wikipedia.org/wiki/Dinic%27s_algorithm ; Dinitz, "Dinitz' Algorithm: The Original Version and Even's Version" (2006) |
| Dreyfus | https://www.cs.miami.edu/home/odelia/teaching/csc317_fall19/syllabus/dy_birth.pdf |
| Duan | https://dl.acm.org/doi/10.1145/3717823.3718179 |
| Erlang | https://en.wikipedia.org/wiki/Agner_Krarup_Erlang |
| Fenwick | https://en.wikipedia.org/wiki/Fenwick_tree |
| Fischer | https://en.wikipedia.org/wiki/Michael_J._Fischer |
| Ford-Johnson | https://en.wikipedia.org/wiki/Merge-insertion_sort |
| Godel-letter | https://en.wikipedia.org/wiki/P_versus_NP_problem |
| Hamblin | https://en.wikipedia.org/wiki/Charles_Leonard_Hamblin |
| Heapsort | https://en.wikipedia.org/wiki/Heapsort |
| Hoare | https://en.wikipedia.org/wiki/Tony_Hoare ; https://www.theregister.com/2026/03/12/in_memoriam_sir_tony_hoare/ |
| Hoare-bet | https://www.pcgamer.com/gaming-industry/turing-award-winner-tony-hoare-computing-pioneer-who-invented-the-quicksort-algorithm-for-a-sixpence-bet-dies-at-the-age-of-92/ |
| Huffman | https://en.wikipedia.org/wiki/Huffman_coding |
| Huffman-MAA | https://old.maa.org/press/periodicals/convergence/discovery-of-huffman-codes |
| IPL | https://en.wikipedia.org/wiki/Information_Processing_Language |
| Kahn | https://dl.acm.org/doi/10.1145/368996.369025 |
| Karatsuba | https://en.wikipedia.org/wiki/Karatsuba_algorithm |
| Klee | https://en.wikipedia.org/wiki/Klee%27s_measure_problem |
| KMP | Knuth, Morris & Pratt, "Fast Pattern Matching in Strings", SIAM J. Comput. 6(2), 1977, §7 (read in full): https://www.cs.jhu.edu/~misha/ReadingSeminar/Papers/Knuth77.pdf |
| Knuth-1976 | https://dl.acm.org/doi/10.1145/1008328.1008329 |
| Knuth-hash | TAOCP vol. 3 §6.4 history pages (read in full): https://gwern.net/doc/cs/algorithm/information/compression/1998-knuth-taocp-v3-sortingandsearching-hashinghistory.pdf |
| Konigsberg | https://en.wikipedia.org/wiki/Seven_Bridges_of_K%C3%B6nigsberg |
| Kosaraju | https://en.wikipedia.org/wiki/Kosaraju%27s_algorithm |
| Krapivin | https://arxiv.org/abs/2501.02305 ; https://www.quantamagazine.org/undergraduate-upends-a-40-year-old-data-science-conjecture-20250210/ |
| Lame | https://en.wikipedia.org/wiki/Lam%C3%A9%27s_theorem |
| LANL | https://www.lanl.gov/media/publications/actinide-research-quarterly/1123-hitting-the-jackpot-the-birth-of-the-monte-carlo-method |
| Leibniz | https://www.historyofinformation.com/detail.php?id=395 |
| Levenshtein | https://en.wikipedia.org/wiki/Levenshtein_distance |
| Maxflow-2022 | https://dl.acm.org/doi/10.1145/3610940 |
| Miller-Rabin | https://en.wikipedia.org/wiki/Miller%E2%80%93Rabin_primality_test |
| Note-G | https://en.wikipedia.org/wiki/Note_G |
| Obama | http://www.righto.com/2012/11/obama-on-sorting-1m-integers-bubble.html |
| Pearls | https://reprog.wordpress.com/2010/04/19/are-you-one-of-the-10-percent/ |
| Prim-wiki | https://en.wikipedia.org/wiki/Prim%27s_algorithm |
| Queens | https://en.wikipedia.org/wiki/Eight_queens_puzzle ; Campbell, "Gauss and the eight queens problem", Historia Mathematica 4 (1977) |
| Quicksort | https://en.wikipedia.org/wiki/Quicksort |
| Radix | https://en.wikipedia.org/wiki/Radix_sort |
| Recursive-programming | https://link.springer.com/article/10.1007/BF01386232 |
| Red-black | https://en.wikipedia.org/wiki/Red%E2%80%93black_tree |
| Schrijver | Schrijver, "On the history of the transportation and maximum flow problems", Math. Programming 91 (2002) (read in full): https://homepages.cwi.nl/~lex/files/histtrpclean.pdf |
| Seward | https://archivesspace.mit.edu/repositories/2/archival_objects/463314 |
| Shannon-thesis | https://en.wikipedia.org/wiki/A_Symbolic_Analysis_of_Relay_and_Switching_Circuits |
| Shunting-yard | https://en.wikipedia.org/wiki/Shunting_yard_algorithm |
| Skip-lists | https://dl.acm.org/doi/10.1145/78973.78977 |
| Sort-merge | https://en.wikipedia.org/wiki/Sort_Merge_Generator |
| Stack-patent | https://de.wikipedia.org/wiki/Stapelspeicher |
| Suffix-tree | https://en.wikipedia.org/wiki/Suffix_tree |
| Swiss | https://abseil.io/blog/20180927-swisstables ; https://blog.rust-lang.org/2019/07/04/Rust-1.36.0/ ; https://go.dev/blog/swisstable |
| Timsort-bug | https://ercim-news.ercim.eu/en102/r-i/fixing-the-sorting-algorithm-for-android-java-and-python |
| Trie | https://en.wikipedia.org/wiki/Trie |
| Turing-zeitgeist | https://www.cs.auckland.ac.nz/~brian/TuringZeitgeistPreprint.pdf |
| Union-find | https://en.wikipedia.org/wiki/Disjoint-set_data_structure |
| Universal-Dijkstra | https://arxiv.org/abs/2311.11793 |
| UTF-8 | https://www.cl.cam.ac.uk/~mgk25/ucs/utf-8-history.txt |
| Vitter | https://www.cs.umd.edu/~samir/498/vitter.pdf |
| VN-merge | https://www.amphilsoc.org/exhibits/treasures/vonneuma.htm |
| Wagner-Fischer | https://en.wikipedia.org/wiki/Wagner%E2%80%93Fischer_algorithm |
| Walden | https://www.walden-family.com/public/bf-history.pdf |
| Warshall | https://en.wikipedia.org/wiki/Stephen_Warshall |
| Wheeler | https://history.computer.org/pioneers/wheeler.html |
| Wirth-1971 | https://dl.acm.org/doi/10.1145/362575.362577 |
