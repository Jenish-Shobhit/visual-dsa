/* Visual DSA history data: the events and people behind every lesson.
   Used by the "A history of algorithms" timeline (labs/history.html) and by lesson history notes.
   Research notes, sources and open questions live in docs/research/HISTORY.md.

   Loads as a classic script and defines window.VDSA_HISTORY; in Node it is exported with module.exports.

   Event:  { id, year, yearLabel, title, people, summary, detail, lessons, tags, era, sources }
     year     number used for placing and sorting; negative for BCE. Events are kept in year order.
     yearLabel what the page shows ("c. 300 BCE", "1959–61").
     people   ids from `people` below.
     lessons  lesson ids from js/curriculum.js.
     tags     subset of TAGS.
     era      one of ERAS; derived from year by the boundaries in ERAS.
     sources  short provenance notes (WP = Robert C. Martin, We, Programmers, 2025; Code = Petzold, Code, 2nd ed.;
              TAOCP = Knuth, The Art of Computer Programming; GK = general knowledge; URLs = web sources checked).
   Person: { id, name, born, died, lifeLabel, bio, knownFor, inWeProgrammers }
     born/died are years or null when unknown or still living. inWeProgrammers is true when the person is discussed
     in the text of We, Programmers (chapters or its cast of characters), not merely cited.
   All summaries, details and bios are written for this site; nothing is copied from the source books. */
(function (root) {
  'use strict';

  var ERAS = [
    { id: 'ancient', label: 'Hand methods', from: null, to: 1699 },
    { id: 'mechanical', label: 'Mechanical age', from: 1700, to: 1936 },
    { id: 'early-electronic', label: 'First computers', from: 1937, to: 1959 },
    { id: 'golden-age', label: 'Golden age', from: 1960, to: 1989 },
    { id: 'modern', label: 'Modern', from: 1990, to: null }
  ];

  var TAGS = ['sorting', 'graphs', 'trees', 'foundations', 'hashing', 'strings', 'complexity', 'paradigms', 'hardware', 'languages'];

  var events = [
    {
      id: 'euclid-gcd', year: -300, yearLabel: 'c. 300 BCE', title: 'Euclid’s greatest-common-divisor procedure',
      people: ['euclid'],
      summary: 'Book VII of Euclid’s Elements finds the greatest common measure of two numbers by repeatedly taking the smaller from the larger until the two agree.',
      detail: 'Replace the repeated subtraction with a remainder and you have the version computers still run. The numbers shrink every round, so the procedure must stop, and the common divisor never changes along the way — an early argument that an algorithm both halts and is correct. Knuth calls it the oldest nontrivial algorithm still in everyday use.',
      lessons: ['01-algorithms', '12-recursion'], tags: ['foundations'], era: 'ancient',
      sources: ['GK', 'TAOCP vol. 2 §4.5.2']
    },
    {
      id: 'al-khwarizmi', year: 825, yearLabel: 'c. 825', title: 'Al-Khwarizmi and the word “algorithm”',
      people: ['al-khwarizmi'],
      summary: 'In Baghdad, Muhammad ibn Musa al-Khwarizmi wrote a book on calculating with Hindu numerals; its medieval Latin translation opens “Dixit Algorizmi” — “al-Khwarizmi said”.',
      detail: 'His Latinised name became “algorism”, the art of computing with place-value digits, and later “algorithm”. His book on al-jabr gave us the word “algebra”. Both taught fixed procedures that any careful reader could carry out with pen and paper.',
      lessons: ['01-algorithms', '02-bits-and-memory'], tags: ['foundations'], era: 'ancient',
      sources: ['GK']
    },
    {
      id: 'fibonacci-rabbits', year: 1202, yearLabel: '1202', title: 'Fibonacci’s rabbits',
      people: ['fibonacci'],
      summary: 'Leonardo of Pisa’s Liber Abaci spread Hindu–Arabic numerals through Europe and posed a puzzle about breeding rabbits whose answer runs 1, 1, 2, 3, 5, 8, …',
      detail: 'Each term is the sum of the two before it, which makes the sequence the standard first example of a recursive definition. Computed by naive recursion it takes exponential time, because the same terms are recomputed again and again; remembering them brings it down to linear time — the seed of dynamic programming.',
      lessons: ['12-recursion', '34-dynamic-programming'], tags: ['foundations', 'paradigms'], era: 'ancient',
      sources: ['GK']
    },
    {
      id: 'leibniz-binary', year: 1703, yearLabel: '1703', title: 'Leibniz publishes binary arithmetic',
      people: ['leibniz'],
      summary: 'Gottfried Wilhelm Leibniz described arithmetic with only 0 and 1 in a paper for the Paris Academy of Sciences, printed in 1705.',
      detail: 'He had worked on base 2 for decades. Letters from the Jesuit missionary Joachim Bouvet, who saw binary counting in the 64 hexagrams of the Chinese I Ching, pushed him to publish. Leibniz admired how small the addition and multiplication tables became — the same simplicity that later made binary the natural language of switching circuits.',
      lessons: ['02-bits-and-memory'], tags: ['foundations'], era: 'mechanical',
      sources: ['https://www.historyofinformation.com/detail.php?id=395']
    },
    {
      id: 'euler-konigsberg', year: 1736, yearLabel: '1735–36', title: 'The bridges of Königsberg',
      people: ['euler'],
      summary: 'Leonhard Euler proved that no walk through Königsberg crosses each of its seven bridges exactly once, and in doing so started graph theory.',
      detail: 'He presented the solution to the St Petersburg Academy on 26 August 1735; it was printed in 1741. Euler kept only the four land masses and the bridges joining them. A walk that uses every bridge once is possible only if zero or two land masses touch an odd number of bridges, and in Königsberg all four did. The word “graph” for such a drawing came later, from J. J. Sylvester in 1878.',
      lessons: ['25-graphs'], tags: ['graphs'], era: 'mechanical',
      sources: ['https://en.wikipedia.org/wiki/Seven_Bridges_of_K%C3%B6nigsberg']
    },
    {
      id: 'babbage-difference-engine', year: 1822, yearLabel: '1821–22', title: 'Babbage’s Difference Engine',
      people: ['babbage'],
      summary: 'Tired of checking error-filled, hand-computed tables, Charles Babbage designed a machine that would produce them using nothing but repeated addition.',
      detail: 'The method of finite differences turns a polynomial table into a loop: add each difference column into the one above it, turn the crank, read off the next value. Babbage built a small working section but never the full engine; his later Analytical Engine borrowed punched cards from Jacquard’s loom to hold its instructions. The Science Museum in London finally built his Difference Engine No. 2 around 1991, and it works.',
      lessons: ['01-algorithms', '03-control-flow'], tags: ['hardware', 'foundations'], era: 'mechanical',
      sources: ['WP ch. 2', 'Code ch. 15']
    },
    {
      id: 'lovelace-note-g', year: 1843, yearLabel: '1843', title: 'Note G: a program for a machine that did not exist',
      people: ['lovelace', 'babbage'],
      summary: 'Ada Lovelace’s notes on Babbage’s Analytical Engine include a table of operations for computing Bernoulli numbers, often called the first published computer program.',
      detail: 'Note G lists every operation, the variables it reads and writes, and a group of operations that repeats — a loop. It also holds the first known bug: operation 4 divides the right numbers the wrong way round. How much was Lovelace’s own work is debated; We, Programmers argues that Babbage wrote the programs and calls the two the first pair programmers.',
      lessons: ['01-algorithms', '03-control-flow'], tags: ['foundations', 'languages'], era: 'mechanical',
      sources: ['WP ch. 2', 'https://en.wikipedia.org/wiki/Note_G']
    },
    {
      id: 'lame-euclid-steps', year: 1844, yearLabel: '1844', title: 'Lamé counts the steps of Euclid’s algorithm',
      people: ['lame'],
      summary: 'Gabriel Lamé proved that Euclid’s algorithm never needs more than five division steps per decimal digit of the smaller number.',
      detail: 'The worst case is a pair of consecutive Fibonacci numbers, where every quotient is 1. It is often called the first analysis of an algorithm’s running time: a bound on the work that grows with the size of the input, written a century before computers.',
      lessons: ['05-big-o'], tags: ['complexity'], era: 'mechanical',
      sources: ['https://en.wikipedia.org/wiki/Lam%C3%A9%27s_theorem']
    },
    {
      id: 'boole-algebra', year: 1847, yearLabel: '1847–54', title: 'Boole’s algebra of logic',
      people: ['boole'],
      summary: 'George Boole, a largely self-taught mathematician, treated logical statements as algebra: AND, OR and NOT obey rules much like multiplication and addition.',
      detail: 'His books The Mathematical Analysis of Logic (1847) and The Laws of Thought (1854) worked with classes of things rather than numbers. Every condition in an if-statement is a Boolean expression, and every chip evaluates such expressions with gates.',
      lessons: ['02-bits-and-memory', '03-control-flow'], tags: ['foundations'], era: 'mechanical',
      sources: ['Code ch. 6', 'WP cast of characters']
    },
    {
      id: 'eight-queens', year: 1848, yearLabel: '1848–50', title: 'The eight queens puzzle',
      people: [],
      summary: 'Chess composer Max Bezzel asked how to place eight queens on a chessboard so that none attacks another; Franz Nauck published all 92 solutions in 1850.',
      detail: 'Carl Friedrich Gauss took an interest after reading Nauck’s version in a newspaper, but his casual attempt was incomplete; an 1874 article wrongly credited him with posing and solving it, and the mistake spread for a century. The puzzle became the classic demonstration of backtracking — place a queen, and retreat as soon as a conflict appears — a name D. H. Lehmer gave the method in the 1950s.',
      lessons: ['33-backtracking'], tags: ['paradigms'], era: 'mechanical',
      sources: ['https://en.wikipedia.org/wiki/Eight_queens_puzzle', 'Campbell, Historia Mathematica 4 (1977)']
    },
    {
      id: 'cayley-trees', year: 1857, yearLabel: '1857', title: 'Cayley names trees',
      people: ['cayley'],
      summary: 'Arthur Cayley used the word “tree” for branching diagrams while studying operators in calculus, and later counted them.',
      detail: 'Gustav Kirchhoff had already used spanning trees in 1847 to analyse electrical networks. Cayley’s counting work led to the formula that there are n^(n−2) labelled trees on n vertices, and chemists used trees to count possible molecules long before programmers used them to store data.',
      lessons: ['18-trees'], tags: ['trees'], era: 'mechanical',
      sources: ['GK']
    },
    {
      id: 'baudot-code', year: 1874, yearLabel: '1870s', title: 'Baudot’s five-signal code',
      people: [],
      summary: 'Émile Baudot built a printing telegraph that sent each character as a fixed group of five on/off signals.',
      detail: 'Five signals give only 32 patterns, so the code used shift characters to switch between letters and figures: the same pattern meant different things depending on an earlier state. Fixed-width character codes like this lead to ASCII and to strings stored as arrays of numbers.',
      lessons: ['07-strings-and-two-pointers', '02-bits-and-memory'], tags: ['strings', 'hardware'], era: 'mechanical',
      sources: ['Code ch. 13']
    },
    {
      id: 'tremaux-maze', year: 1882, yearLabel: '1882', title: 'Trémaux’s rule for mazes',
      people: ['lucas'],
      summary: 'Édouard Lucas published a maze-solving rule due to the engineer Charles Pierre Trémaux: mark each passage as you use it, and retreat along your own trail when you are stuck.',
      detail: 'This is depth-first search done with chalk. Go as deep as you can, back up to the last junction with an unexplored passage, and never walk a passage more than twice. The trail of marks plays the part of the call stack.',
      lessons: ['26-bfs-and-dfs'], tags: ['graphs'], era: 'mechanical',
      sources: ['GK']
    },
    {
      id: 'tower-of-hanoi', year: 1883, yearLabel: '1883', title: 'The Tower of Hanoi',
      people: ['lucas'],
      summary: 'Édouard Lucas sold a puzzle of discs on three pegs, with a legend about monks moving 64 golden discs, under the pen name “N. Claus de Siam”.',
      detail: 'To move n discs, move n−1 out of the way, move the largest, then move the n−1 back on top — a solution that is recursive by nature. It takes 2^n − 1 moves, so the monks’ 64 discs would need about 585 billion years at one move per second.',
      lessons: ['12-recursion', '05-big-o'], tags: ['foundations'], era: 'mechanical',
      sources: ['GK']
    },
    {
      id: 'hollerith-census', year: 1890, yearLabel: '1887–90', title: 'Hollerith tabulates the census',
      people: ['hollerith'],
      summary: 'Herman Hollerith’s electric tabulator read holes in cards to count the 1890 US census, and his machines could drop each card into a bin by the value punched in one column.',
      detail: 'Operators sorted a deck on a many-digit key one column at a time, starting with the least significant, stacking the bins back in order after each pass — radix sort, performed by machine and operator. By the 1920s this was routine punched-card practice. Hollerith’s company later merged into the firm renamed IBM.',
      lessons: ['17-linear-time-sorts'], tags: ['sorting', 'hardware'], era: 'mechanical',
      sources: ['https://en.wikipedia.org/wiki/Radix_sort', 'GK']
    },
    {
      id: 'bachmann-big-o', year: 1894, yearLabel: '1894', title: 'Bachmann introduces O',
      people: ['bachmann', 'landau'],
      summary: 'In a book on analytic number theory, Paul Bachmann wrote O(n) to mean a quantity no bigger than a constant times n.',
      detail: 'The O stands for Ordnung, “order”. Edmund Landau’s 1909 handbook on the primes used the symbol everywhere and added little-o, so these are often called Landau symbols. Number theorists used them to describe error terms; computer scientists borrowed them seventy years later to describe running time.',
      lessons: ['05-big-o'], tags: ['complexity'], era: 'mechanical',
      sources: ['Knuth, SIGACT News 8(2), 1976', 'GK']
    },
    {
      id: 'erlang-queues', year: 1909, yearLabel: '1909', title: 'Erlang studies waiting lines',
      people: ['erlang'],
      summary: 'Agner Krarup Erlang, working for the Copenhagen Telephone Company, published the first mathematical study of calls that arrive at random and wait for a free line.',
      detail: 'His 1909 paper showed that call arrivals follow a Poisson pattern, and his later formulas told telephone companies how many circuits to install. Queueing theory, the mathematics of first-come, first-served waiting, starts here; the unit of telephone traffic is still called the erlang.',
      lessons: ['10-queues'], tags: ['foundations'], era: 'mechanical',
      sources: ['https://en.wikipedia.org/wiki/Agner_Krarup_Erlang']
    },
    {
      id: 'boruvka-mst', year: 1926, yearLabel: '1926', title: 'Borůvka wires Moravia',
      people: ['boruvka'],
      summary: 'Asked by a friend at the West Moravian power company how to connect towns with the least cable, Otakar Borůvka published the first minimum spanning tree algorithm.',
      detail: 'In each round every fragment picks its cheapest link to another fragment, the chosen links are added, and the rounds repeat; each round at least halves the number of fragments. He published a mathematical paper and a version for electrical engineers in the same year. The method was rediscovered several times, including by Georges Sollin in 1961.',
      lessons: ['30-minimum-spanning-trees', '32-greedy'], tags: ['graphs', 'paradigms'], era: 'mechanical',
      sources: ['https://en.wikipedia.org/wiki/Bor%C5%AFvka%27s_algorithm']
    },
    {
      id: 'jarnik-mst', year: 1930, yearLabel: '1930', title: 'Jarník grows a tree',
      people: ['jarnik'],
      summary: 'In a paper written as a letter to Borůvka, Vojtěch Jarník described growing a single tree outward, always adding the cheapest edge that reaches a new vertex.',
      detail: 'Robert Prim rediscovered the method at Bell Labs in 1957 and Dijkstra again in 1959, so it is usually called Prim’s algorithm. Written in Czech, Jarník’s paper went almost unnoticed outside Czechoslovakia for decades.',
      lessons: ['30-minimum-spanning-trees'], tags: ['graphs'], era: 'mechanical',
      sources: ['https://en.wikipedia.org/wiki/Prim%27s_algorithm']
    },
    {
      id: 'whitney-matroids', year: 1935, yearLabel: '1935', title: 'Whitney defines matroids',
      people: ['whitney'],
      summary: 'Hassler Whitney captured what independent vectors and cycle-free sets of edges have in common, and called the structure a matroid.',
      detail: 'Takeo Nakasawa developed similar ideas in Japan at about the same time, but his work was forgotten for decades. Matroids later explained exactly when the greedy rule — always take the best remaining item that keeps the set independent — is guaranteed to be optimal.',
      lessons: ['32-greedy'], tags: ['paradigms'], era: 'mechanical',
      sources: ['GK']
    },
    {
      id: 'turing-computable', year: 1936, yearLabel: '1936', title: 'Turing defines computation',
      people: ['turing'],
      summary: 'Alan Turing’s paper “On Computable Numbers” modelled computation as a machine that reads and writes symbols on a tape, and proved that some problems no such machine can solve.',
      detail: 'He also described a universal machine that runs any other machine from its description on the tape — the stored-program idea, in theory. Alonzo Church reached the same negative answer to Hilbert’s decision problem weeks earlier with lambda calculus. Turing’s machine gave “algorithm” a precise meaning.',
      lessons: ['01-algorithms', '37-p-vs-np'], tags: ['foundations', 'complexity'], era: 'mechanical',
      sources: ['WP ch. 3', 'Code ch. 24']
    },
    {
      id: 'shannon-switching', year: 1937, yearLabel: '1937–38', title: 'Shannon joins logic to switches',
      people: ['shannon'],
      summary: 'In his MIT master’s thesis, submitted in August 1937 and published in 1938, Claude Shannon showed that Boole’s algebra describes circuits of relays and switches.',
      detail: 'Switches in series act like AND and switches in parallel like OR, so a circuit can be designed and simplified with algebra instead of by trial and error. Akira Nakashima in Japan had described a similar correspondence a few years earlier. That same year George Stibitz wired a binary adder from telephone relays on his kitchen table.',
      lessons: ['02-bits-and-memory', '03-control-flow'], tags: ['foundations', 'hardware'], era: 'early-electronic',
      sources: ['Code ch. 8 and ch. 15', 'https://en.wikipedia.org/wiki/A_Symbolic_Analysis_of_Relay_and_Switching_Circuits']
    },
    {
      id: 'mark-i-loops', year: 1944, yearLabel: '1944', title: 'Loops by hand on the Harvard Mark I',
      people: ['hopper', 'aiken'],
      summary: 'The Harvard Mark I read its instructions from punched paper tape and had no jump instruction, so its loops and decisions were carried out by its operators.',
      detail: 'When the machine stopped, an operator checked a register and, if the loop was not finished, wound the tape back to a marked start; now and then the tape ends were glued into a physical loop. Grace Hopper, who reported for duty in July 1944, and her fellow programmers wrote these instructions for the operators alongside the tape. John Backus later recalled a looped tape on IBM’s SSEC that picked up a half-twist and became a Möbius strip.',
      lessons: ['03-control-flow'], tags: ['hardware', 'languages'], era: 'early-electronic',
      sources: ['WP ch. 4', 'WP ch. 5']
    },
    {
      id: 'harvard-subroutines', year: 1944, yearLabel: '1944–46', title: 'A library of reusable routines',
      people: ['hopper'],
      summary: 'Hopper’s team at Harvard kept reusable snippets of code and wrote their addresses counted from zero, so a routine could be copied into any program by adding a base address.',
      detail: 'They called this relative coding. The copying and adding were done by hand at first; in 1946 Richard Bloch added extra tape readers so that the Mark I could switch to a routine on another tape and come back. Hopper began to think of each routine as a new command — the idea behind her later compilers.',
      lessons: ['04-functions-and-the-stack'], tags: ['languages'], era: 'early-electronic',
      sources: ['WP ch. 4']
    },
    {
      id: 'zuse-bfs', year: 1945, yearLabel: '1945 (published 1972)', title: 'Zuse’s breadth-first search',
      people: ['zuse'],
      summary: 'Konrad Zuse described a breadth-first search for connected components in his Plankalkül manuscript, part of a doctoral thesis that was rejected and not published until 1972.',
      detail: 'Plankalkül was a high-level language designed on paper during the war, years before FORTRAN. Because the work stayed unpublished, breadth-first search had to be rediscovered by Edward Moore and others in the 1950s.',
      lessons: ['26-bfs-and-dfs'], tags: ['graphs', 'languages'], era: 'early-electronic',
      sources: ['https://en.wikipedia.org/wiki/Breadth-first_search']
    },
    {
      id: 'edvac-report', year: 1945, yearLabel: 'June 1945', title: 'The stored-program report',
      people: ['von-neumann', 'mauchly'],
      summary: 'John von Neumann’s “First Draft of a Report on the EDVAC” described a computer whose memory holds both the data and the instructions.',
      detail: 'The design had five parts: input, output, arithmetic, control and memory. Herman Goldstine circulated the unfinished draft widely, so it became known as the von Neumann architecture, although J. Presper Eckert and John Mauchly had proposed EDVAC and its mercury delay-line memory. Every program you run still sits in memory as numbers, next to its data.',
      lessons: ['02-bits-and-memory', '06-arrays'], tags: ['hardware'], era: 'early-electronic',
      sources: ['WP ch. 3', 'Code ch. 15']
    },
    {
      id: 'von-neumann-merge-sort', year: 1945, yearLabel: '1945', title: 'Von Neumann writes merge sort',
      people: ['von-neumann'],
      summary: 'To show that EDVAC could do more than arithmetic, von Neumann wrote a program in 1945 that sorts by repeatedly merging sorted runs.',
      detail: 'Knuth later studied the 23-page handwritten manuscript and called it von Neumann’s first computer program. Punched-card collators had merged decks for years, but this was among the first programs for a stored-program computer — and the showcase was sorting, not calculation.',
      lessons: ['15-merge-sort'], tags: ['sorting'], era: 'early-electronic',
      sources: ['Knuth, “Von Neumann’s First Computer Program”, Computing Surveys 2(4), 1970', 'https://www.amphilsoc.org/exhibits/treasures/vonneuma.htm']
    },
    {
      id: 'turing-ace-bury', year: 1946, yearLabel: '1945–46', title: 'Turing’s BURY and UNBURY',
      people: ['turing'],
      summary: 'In his design for the ACE computer at the National Physical Laboratory, Turing proposed keeping subroutine return addresses in a last-in, first-out list.',
      detail: 'A standard routine he called BURY filed a return address away and UNBURY dug it out again, so subroutines could call other subroutines. The report circulated in few copies and faded from view until the 1970s, and the stack had to be reinvented.',
      lessons: ['04-functions-and-the-stack', '09-stacks'], tags: ['hardware', 'languages'], era: 'early-electronic',
      sources: ['https://www.cs.auckland.ac.nz/~brian/TuringZeitgeistPreprint.pdf', 'A. M. Turing’s ACE Report of 1946 and Other Papers (MIT Press, 1986)']
    },
    {
      id: 'moore-school-binary-search', year: 1946, yearLabel: '1946', title: 'Binary search is first described',
      people: ['mauchly'],
      summary: 'In the 1946 Moore School Lectures, the first course on electronic computing, John Mauchly described searching a sorted table by repeatedly halving it.',
      detail: 'For the next fourteen years, published versions worked only when the table size was one less than a power of two. Binary search looks simple, and it is famous for off-by-one errors.',
      lessons: ['13-binary-search'], tags: ['foundations'], era: 'early-electronic',
      sources: ['https://en.wikipedia.org/wiki/Binary_search', 'TAOCP vol. 3 §6.2.1']
    },
    {
      id: 'monte-carlo', year: 1946, yearLabel: '1946–49', title: 'Monte Carlo',
      people: ['ulam', 'von-neumann', 'metropolis'],
      summary: 'Recovering from an illness in 1946, Stanislaw Ulam wondered how often a game of solitaire comes out, and realised that playing many random games on a computer would answer faster than combinatorics.',
      detail: 'Von Neumann turned the idea into neutron-diffusion calculations for Los Alamos, first run on the rebuilt ENIAC in 1948 with Klára von Neumann among the programmers. Nicholas Metropolis suggested the code name Monte Carlo, after the casino where Ulam’s uncle liked to gamble. Metropolis and Ulam published the method in 1949.',
      lessons: ['38-randomized-algorithms'], tags: ['paradigms'], era: 'early-electronic',
      sources: ['WP ch. 3 and glossary', 'https://www.lanl.gov/media/publications/actinide-research-quarterly/1123-hitting-the-jackpot-the-birth-of-the-monte-carlo-method']
    },
    {
      id: 'manchester-baby', year: 1948, yearLabel: '21 June 1948', title: 'The first stored program runs',
      people: [],
      summary: 'The Manchester “Baby” ran a 17-instruction program held in its cathode-ray-tube memory, searching for the highest proper factor of 2^18.',
      detail: 'Frederic Williams, Tom Kilburn and Geoff Tootill built it to test the Williams tube as a memory. The program ran for 52 minutes and found the right answer, 131,072. It was the first time an electronic computer ran a program stored in the same memory as its data.',
      lessons: ['02-bits-and-memory'], tags: ['hardware'], era: 'early-electronic',
      sources: ['WP ch. 3', 'https://en.wikipedia.org/wiki/Manchester_Baby']
    },
    {
      id: 'index-registers', year: 1949, yearLabel: '1949', title: 'Index registers',
      people: [],
      summary: 'The Manchester Mark 1 added “B-lines”, registers whose contents were added to an instruction’s address before use — the first index registers.',
      detail: 'Without them, stepping through an array meant a program rewriting the address inside its own instructions, as UNIVAC I and IBM 701 programmers still had to do in the early 1950s. With an index register, fetching a[i] is one instruction: base address plus i.',
      lessons: ['06-arrays'], tags: ['hardware'], era: 'early-electronic',
      sources: ['WP ch. 4 and ch. 5 (self-modifying code on UNIVAC I and IBM 701)', 'GK']
    },
    {
      id: 'edsac-wheeler-jump', year: 1949, yearLabel: '1949–51', title: 'The Wheeler jump and the first programming textbook',
      people: ['wheeler', 'wilkes'],
      summary: 'On Cambridge’s EDSAC, David Wheeler devised a way to call a subroutine and return: the subroutine rewrote its own final jump so that it pointed back to the caller.',
      detail: 'In 1951 Maurice Wilkes, Wheeler and Stanley Gill published The Preparation of Programs for an Electronic Digital Computer, built around a library of closed subroutines — the first programming textbook. The trick fails for recursion, because a second call overwrites the first return address; a stack fixes that.',
      lessons: ['04-functions-and-the-stack'], tags: ['languages', 'hardware'], era: 'early-electronic',
      sources: ['https://history.computer.org/pioneers/wheeler.html', 'WP glossary (EDSAC)']
    },
    {
      id: 'holberton-sort-merge', year: 1951, yearLabel: '1951–52', title: 'A program that writes programs',
      people: ['holberton', 'hopper'],
      summary: 'When IBM salespeople claimed that data on magnetic tape could not be sorted, Betty Holberton wrote a merge sort for UNIVAC tapes, then a generator that produced a custom sort program from a description of the records.',
      detail: 'She worked out the tape merges by sorting cards on the floor, and got it running on the BINAC first. Her Sort-Merge Generator took the key fields and sort order as input and produced machine code — one of the first programs to write another program. It set Grace Hopper thinking, and her A-0 compiler followed in 1952.',
      lessons: ['15-merge-sort'], tags: ['sorting', 'languages'], era: 'early-electronic',
      sources: ['WP ch. 4', 'https://en.wikipedia.org/wiki/Sort_Merge_Generator']
    },
    {
      id: 'huffman-coding', year: 1951, yearLabel: '1951–52', title: 'Huffman’s term paper',
      people: ['huffman'],
      summary: 'Offered a term paper instead of a final exam in Robert Fano’s MIT class, graduate student David Huffman found the optimal prefix code by repeatedly merging the two least frequent symbols.',
      detail: 'Fano had not mentioned that the problem was open — he had worked on it with Claude Shannon. Huffman was about to give up and study for the exam when the idea came: build the code tree from the bottom up. It beat the top-down Shannon–Fano code, and the 1952 paper remains a model proof that a greedy choice can be optimal.',
      lessons: ['32-greedy', '18-trees', '21-heaps'], tags: ['paradigms', 'trees', 'strings'], era: 'early-electronic',
      sources: ['https://en.wikipedia.org/wiki/Huffman_coding', 'https://old.maa.org/press/periodicals/convergence/discovery-of-huffman-codes']
    },
    {
      id: 'luhn-hashing', year: 1953, yearLabel: 'January 1953', title: 'Luhn invents hashing',
      people: ['luhn'],
      summary: 'IBM’s Hans Peter Luhn wrote an internal memo proposing to turn a key into a bucket number and to chain together the items that collide.',
      detail: 'Knuth notes that this was also one of the first uses of linked lists. Luhn’s hash functions worked on decimal digits — for instance adding neighbouring digits modulo 10 — and he suggested buckets holding several records for data on tape or disk.',
      lessons: ['11-hash-tables', '08-linked-lists'], tags: ['hashing'], era: 'early-electronic',
      sources: ['TAOCP vol. 3 §6.4, History']
    },
    {
      id: 'core-memory', year: 1953, yearLabel: '1949–53', title: 'Magnetic-core memory',
      people: [],
      summary: 'Tiny magnetised rings threaded on a grid of wires gave computers a memory in which any address could be read in microseconds.',
      detail: 'An Wang at Harvard filed a core-memory patent in 1949, and Jay Forrester’s team at MIT made the coincident-current design work in the Whirlwind computer in August 1953. Earlier memories — mercury delay lines and rotating drums — made you wait for the data to come round. Core made “random access” true, which is what lets an array fetch a[i] in constant time.',
      lessons: ['02-bits-and-memory', '06-arrays'], tags: ['hardware'], era: 'early-electronic',
      sources: ['WP glossary (core memory, Whirlwind)', 'https://www.computerhistory.org/storageengine/whirlwind-computer-debuts-core-memory/']
    },
    {
      id: 'open-addressing', year: 1954, yearLabel: '1954', title: 'Open addressing and linear probing',
      people: ['amdahl'],
      summary: 'Building an assembler for the IBM 701, Gene Amdahl, Elaine Boehme (later McGraw), Nathaniel Rochester and Arthur Samuel kept symbols in a table and, on a collision, tried the next slot.',
      detail: 'Knuth credits Amdahl with the idea of open addressing with linear probing. Arnold Dumey first described hashing in print in 1956, suggesting a remainder modulo a prime, and in 1957 W. Wesley Peterson named and analysed open addressing. Andrei Ershov found linear probing independently in the Soviet Union in 1957.',
      lessons: ['11-hash-tables'], tags: ['hashing'], era: 'early-electronic',
      sources: ['TAOCP vol. 3 §6.4, History', 'WP cast of characters (Amdahl)']
    },
    {
      id: 'seward-radix', year: 1954, yearLabel: 'May 1954', title: 'Radix and counting sort on a computer',
      people: [],
      summary: 'In his MIT master’s thesis, Harold H. Seward described radix sorting for electronic computers, together with the counting pass that tells each key where to go.',
      detail: 'Instead of physical bins, one pass counts how many keys have each digit, running totals turn the counts into starting positions, and a second pass moves every key into place. The same trick on whole keys is counting sort, which beats the n log n comparison barrier by never comparing keys at all.',
      lessons: ['17-linear-time-sorts'], tags: ['sorting'], era: 'early-electronic',
      sources: ['https://archivesspace.mit.edu/repositories/2/archival_objects/463314', 'https://en.wikipedia.org/wiki/Counting_sort']
    },
    {
      id: 'bauer-samelson-stack', year: 1955, yearLabel: '1955–57', title: 'The stack principle',
      people: ['bauer', 'samelson'],
      summary: 'In Munich, Friedrich L. Bauer and Klaus Samelson used a push-down store — the “Kellerprinzip”, or cellar principle — to translate arithmetic formulas, and filed a patent on 30 March 1957.',
      detail: 'Operators wait in the cellar until one of lower precedence arrives, then leave in last-in, first-out order. Jan Łukasiewicz’s notation of the 1920s had already shown that formulas need no parentheses, and in 1957 Charles Hamblin in Australia independently built a reverse-Polish language around a push-down list. Bauer received the IEEE Computer Pioneer Award for the stack in 1988.',
      lessons: ['09-stacks', '04-functions-and-the-stack'], tags: ['languages', 'foundations'], era: 'early-electronic',
      sources: ['https://de.wikipedia.org/wiki/Stapelspeicher', 'https://en.wikipedia.org/wiki/Charles_Leonard_Hamblin']
    },
    {
      id: 'harris-ross-rail', year: 1955, yearLabel: '24 October 1955', title: 'The Soviet rail network',
      people: ['ted-harris'],
      summary: 'A secret RAND report by Ted Harris and retired General Frank Ross modelled the railways from the western Soviet Union into Eastern Europe as a network with capacities.',
      detail: 'Their network had 44 nodes and 105 links. A greedy “flooding” method found a flow of 163,000 tons and a cut of exactly the same capacity, marked on the map as “the bottleneck”. The Air Force cared about the cut — which links to bomb — more than the flow. The report stayed classified until 1999, when historian Alexander Schrijver asked for its release.',
      lessons: ['31-network-flow'], tags: ['graphs'], era: 'early-electronic',
      sources: ['Schrijver, “On the history of the transportation and maximum flow problems”, Math. Programming 91 (2002), https://homepages.cwi.nl/~lex/files/histtrpclean.pdf']
    },
    {
      id: 'ford-fulkerson', year: 1956, yearLabel: '1954–56', title: 'Max flow equals min cut',
      people: ['ford', 'fulkerson'],
      summary: 'Lester Ford Jr. and Delbert Fulkerson at RAND proved that the largest flow through a network equals the capacity of its smallest cut.',
      detail: 'Their first report is dated November 1954, the augmenting-path algorithm followed in December 1955, and the journal paper appeared in 1956. Peter Elias, Amiel Feinstein and Claude Shannon proved the theorem independently the same year. Ford and Fulkerson said the problem was posed to them by Ted Harris.',
      lessons: ['31-network-flow'], tags: ['graphs'], era: 'early-electronic',
      sources: ['Schrijver 2002 (see harris-ross-rail)']
    },
    {
      id: 'ipl-linked-lists', year: 1956, yearLabel: '1955–56', title: 'Linked lists in IPL',
      people: ['newell', 'shaw', 'simon'],
      summary: 'At RAND and Carnegie Tech, Allen Newell, Cliff Shaw and Herbert Simon built the Information Processing Language around lists of cells joined by links.',
      detail: 'They needed data that could grow and change shape while a program ran, for the Logic Theorist, a program that proved theorems from Principia Mathematica on RAND’s JOHNNIAC. Their papers drew lists as boxes and arrows, as textbooks still do. Newell and Simon shared the 1975 Turing Award, cited in part for list processing.',
      lessons: ['08-linked-lists'], tags: ['languages', 'foundations'], era: 'early-electronic',
      sources: ['https://en.wikipedia.org/wiki/Information_Processing_Language', 'GK']
    },
    {
      id: 'godel-letter', year: 1956, yearLabel: '20 March 1956', title: 'Gödel’s letter to von Neumann',
      people: ['godel', 'von-neumann'],
      summary: 'Kurt Gödel wrote to a gravely ill John von Neumann asking how many steps a machine needs to decide whether a formula has a proof of length n.',
      detail: 'If that number grew only like n or n², Gödel observed, much of the work of mathematicians could be mechanised. That is essentially the P versus NP question, fifteen years before Cook. Von Neumann, in hospital with cancer, never replied; the letter resurfaced in the late 1980s.',
      lessons: ['37-p-vs-np'], tags: ['complexity'], era: 'early-electronic',
      sources: ['https://en.wikipedia.org/wiki/P_versus_NP_problem', 'Hartmanis, “Gödel, von Neumann and the P=?NP problem” (1989)']
    },
    {
      id: 'dijkstra-cafe', year: 1956, yearLabel: '1956', title: 'Twenty minutes on a café terrace',
      people: ['dijkstra'],
      summary: 'Out shopping in Amsterdam with his fiancée, Edsger Dijkstra sat down for coffee and designed his shortest-path algorithm in about twenty minutes, without pencil or paper.',
      detail: 'He wanted a non-numerical demonstration for the new ARMAC computer that ordinary people could follow: the shortest route between Dutch cities, on a simplified map of 64 cities so that 6 bits could number them. He later said that working without paper forced him to avoid every avoidable complication.',
      lessons: ['28-dijkstra-and-a-star'], tags: ['graphs'], era: 'early-electronic',
      sources: ['WP ch. 6 (quoting Dijkstra’s 2001 interview)', 'https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm']
    },
    {
      id: 'kruskal-mst', year: 1956, yearLabel: '1956', title: 'Kruskal: cheapest edge first',
      people: ['kruskal'],
      summary: 'Joseph Kruskal showed that taking edges from cheapest to dearest, and skipping any that would close a cycle, yields a minimum spanning tree.',
      detail: 'His paper was three pages long and also discussed the travelling salesman problem. Doing Kruskal’s cycle test quickly needs a structure that tracks which vertices are already connected — the union-find structure of a later lesson.',
      lessons: ['30-minimum-spanning-trees', '24-union-find', '32-greedy'], tags: ['graphs', 'paradigms'], era: 'early-electronic',
      sources: ['GK', 'Study dsa-12']
    },
    {
      id: 'bubble-sort-named', year: 1956, yearLabel: '1956–62', title: 'Bubble sort gets its name',
      people: [],
      summary: 'Edward Friend analysed “sorting by exchange” in a 1956 survey of computer sorting; Kenneth Iverson’s 1962 book A Programming Language called it bubble sort.',
      detail: 'Knuth’s verdict was that bubble sort has little to recommend it beyond a catchy name and some interesting theory. It survives in teaching because its invariant is easy to see: after pass k, the k largest items are already in place.',
      lessons: ['14-elementary-sorts'], tags: ['sorting'], era: 'early-electronic',
      sources: ['https://users.cs.duke.edu/~ola/papers/bubble.pdf', 'TAOCP vol. 3 §5.2.2']
    },
    {
      id: 'prim-mst', year: 1957, yearLabel: '1957', title: 'Prim at Bell Labs',
      people: ['prim'],
      summary: 'Robert Prim published a method for the cheapest network connecting a set of points: grow one tree from a seed, always adding the cheapest edge that reaches a new point.',
      detail: 'Bell Labs cared because leased telephone networks were priced this way. It was Jarník’s 1930 method, rediscovered; with a binary heap it runs in O(E log V) time.',
      lessons: ['30-minimum-spanning-trees', '21-heaps'], tags: ['graphs'], era: 'early-electronic',
      sources: ['GK', 'Study dsa-12']
    },
    {
      id: 'fortran-arrays', year: 1957, yearLabel: 'April 1957', title: 'FORTRAN and the array',
      people: ['backus'],
      summary: 'John Backus’s team at IBM delivered FORTRAN, which let scientists write formulas with subscripted variables such as A(I,J) and compiled them into fast code for the IBM 704.',
      detail: 'The team made efficient code the first goal, since programmers would not accept a language much slower than hand-written code. The compiler mapped array subscripts onto the 704’s three index registers. Backus had estimated six months; the work took a dozen people about two and a half years.',
      lessons: ['06-arrays'], tags: ['languages'], era: 'early-electronic',
      sources: ['WP ch. 5', 'Code ch. 27']
    },
    {
      id: 'bellman-dynamic-programming', year: 1957, yearLabel: '1950s–1957', title: 'Dynamic programming gets a name',
      people: ['bellman'],
      summary: 'At RAND in the early 1950s, Richard Bellman developed a method for multistage decision problems and, by his own account, chose the name “dynamic programming” to shield it from a research-hating Secretary of Defense.',
      detail: 'In his autobiography he explained that “programming” meant planning and that nobody could use “dynamic” as an insult. His book Dynamic Programming appeared in 1957. Historians point out that the dates do not quite fit — Charles Wilson took office in 1953 — so the story is best read as Bellman told it.',
      lessons: ['34-dynamic-programming', '35-dynamic-programming-2d'], tags: ['paradigms'], era: 'early-electronic',
      sources: ['Dreyfus, “Richard Bellman on the birth of dynamic programming”, Operations Research 50 (2002)', 'Bellman, Eye of the Hurricane (1984)']
    },
    {
      id: 'bellman-ford-moore', year: 1958, yearLabel: '1954–59', title: 'Shortest paths with any weights',
      people: ['bellman', 'ford', 'moore-ef'],
      summary: 'Alfonso Shimbel (1954–55), Lester Ford (1956), Richard Bellman (1958) and Edward Moore (1957–59) each found the method of relaxing every edge again and again until the distances stop improving.',
      detail: 'After V−1 rounds every shortest path is found, even with negative edge weights, and any further improvement reveals a negative cycle. Bellman framed it as dynamic programming in “On a Routing Problem”. A distributed version, in which each router trades distance tables with its neighbours, routed the early ARPANET and lives on in the RIP protocol.',
      lessons: ['29-bellman-ford-and-floyd-warshall'], tags: ['graphs', 'paradigms'], era: 'early-electronic',
      sources: ['https://www.walden-family.com/public/bf-history.pdf', 'https://en.wikipedia.org/wiki/Bellman%E2%80%93Ford_algorithm']
    },
    {
      id: 'mccarthy-lisp', year: 1958, yearLabel: '1958–60', title: 'LISP: recursion and lists',
      people: ['mccarthy'],
      summary: 'John McCarthy at MIT designed LISP around recursive functions over lists built from two-part cells.',
      detail: 'His 1960 paper was titled “Recursive Functions of Symbolic Expressions and Their Computation by Machine”. LISP programs are themselves lists, and to reclaim cells that nothing points to any more McCarthy invented garbage collection. The language lives on in descendants such as Scheme and Clojure.',
      lessons: ['12-recursion', '08-linked-lists'], tags: ['languages'], era: 'early-electronic',
      sources: ['WP ch. 16 and cast of characters', 'GK']
    },
    {
      id: 'moore-maze', year: 1959, yearLabel: '1957–59', title: 'The shortest path through a maze',
      people: ['moore-ef'],
      summary: 'Edward F. Moore of Bell Labs presented breadth-first search at a 1957 Harvard symposium as a way to find the shortest path through a maze; the proceedings appeared in 1959.',
      detail: 'Explore every square one step away, then two steps, and so on; the first time you reach the exit, you have a shortest route. In 1961 C. Y. Lee used the same expanding wavefront to route wires on circuit boards.',
      lessons: ['26-bfs-and-dfs'], tags: ['graphs'], era: 'early-electronic',
      sources: ['https://en.wikipedia.org/wiki/Breadth-first_search', 'GK']
    },
    {
      id: 'de-la-briandais-trie', year: 1959, yearLabel: '1959', title: 'Tries for variable-length keys',
      people: [],
      summary: 'René de la Briandais proposed storing keys letter by letter in a tree, so a search costs time in proportion to the key’s length, not the number of keys stored.',
      detail: 'Each level handles one character, and keys that share a prefix share a path. Axel Thue had described the idea abstractly in 1912, and a year later Edward Fredkin gave the structure its name.',
      lessons: ['22-tries'], tags: ['trees', 'strings'], era: 'early-electronic',
      sources: ['https://en.wikipedia.org/wiki/Trie']
    },
    {
      id: 'ford-johnson', year: 1959, yearLabel: '1959', title: 'How few comparisons can a sort make?',
      people: ['ford'],
      summary: 'Lester Ford Jr. and Selmer Johnson at RAND answered a question of Hugo Steinhaus with merge insertion, a sort that uses very nearly the fewest comparisons possible.',
      detail: 'n items have n! possible orders and each yes/no comparison can at best halve them, so any comparison sort needs at least ⌈log₂ n!⌉ comparisons — about n log₂ n. Merge insertion held the record for the fewest comparisons for about twenty years. It is the same Ford as in Ford–Fulkerson and Bellman–Ford.',
      lessons: ['17-linear-time-sorts'], tags: ['sorting', 'complexity'], era: 'early-electronic',
      sources: ['https://en.wikipedia.org/wiki/Merge-insertion_sort', 'TAOCP vol. 3 §5.3.1']
    },
    {
      id: 'dijkstra-1959-paper', year: 1959, yearLabel: '1959', title: 'Dijkstra’s three-page paper',
      people: ['dijkstra'],
      summary: 'Dijkstra published “A Note on Two Problems in Connexion with Graphs” in Numerische Mathematik: one problem is the minimum spanning tree, the other the shortest path.',
      detail: 'He had used the spanning-tree method to save copper wire on the back panel of the Electrologica X1 computer. The shortest-path half, written up three years after the café, became one of the most used algorithms in computing, inside routing protocols and map software.',
      lessons: ['28-dijkstra-and-a-star', '30-minimum-spanning-trees'], tags: ['graphs'], era: 'early-electronic',
      sources: ['WP ch. 6', 'GK']
    },
    {
      id: 'hoare-quicksort', year: 1959, yearLabel: '1959–61', title: 'Quicksort',
      people: ['hoare'],
      summary: 'As a British exchange student at Moscow State University, Tony Hoare needed to sort the words of a Russian sentence before looking them up on tape for machine translation, and invented quicksort.',
      detail: 'He first thought of insertion sort, then of partitioning around a pivot. At Elliott Brothers in London his boss asked him to code Donald Shell’s 1959 Shellsort; Hoare said he knew something faster, the boss bet sixpence he did not, and Hoare won. He found a neat way to write it only after meeting recursion in ALGOL 60, and published it in July 1961 as Algorithm 64, beside Partition and Find (quickselect).',
      lessons: ['16-quick-sort'], tags: ['sorting', 'paradigms'], era: 'early-electronic',
      sources: ['https://en.wikipedia.org/wiki/Tony_Hoare', 'https://en.wikipedia.org/wiki/Quicksort', 'CACM 4(7), 1961']
    },
    {
      id: 'algol-60-recursion', year: 1960, yearLabel: '1960', title: 'ALGOL 60 and recursion',
      people: ['dijkstra', 'backus', 'naur'],
      summary: 'The ALGOL 60 report, written in Backus–Naur Form, defined a language with nested blocks and local variables — and recursive procedures, which many on the committee opposed as inefficient.',
      detail: 'Dijkstra and Jaap Zonneveld wrote the first complete compiler, for the Electrologica X1, and implemented recursion. Dijkstra’s 1960 paper “Recursive Programming” showed how: every call gets its own frame of local variables on a stack. Recursion is now part of every mainstream language.',
      lessons: ['12-recursion', '04-functions-and-the-stack'], tags: ['languages'], era: 'golden-age',
      sources: ['WP ch. 5 and ch. 6', 'https://link.springer.com/article/10.1007/BF01386232']
    },
    {
      id: 'fredkin-trie', year: 1960, yearLabel: 'September 1960', title: 'Fredkin names the trie',
      people: ['fredkin'],
      summary: 'Edward Fredkin’s paper “Trie Memory” named the structure after the middle of the word “retrieval”.',
      detail: 'Fredkin pronounced it “tree”; many people now say “try” to tell the two apart. Tries sit behind autocomplete, spell checkers and the routing tables that forward internet packets.',
      lessons: ['22-tries'], tags: ['trees', 'strings'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Trie', 'CACM 3(9), 1960']
    },
    {
      id: 'binary-search-trees', year: 1960, yearLabel: '1960–62', title: 'Binary search trees in print',
      people: [],
      summary: 'P. F. Windley, and separately Andrew Booth and Andrew Colin, published binary search trees in 1960; Thomas Hibbard analysed them in 1962 and showed how to delete a key.',
      detail: 'Several people had used the idea in the 1950s. Hibbard’s deletion — replace a node that has two children by its in-order successor — is still the textbook method. Random insertions give trees of logarithmic height on average; sorted insertions give a long chain.',
      lessons: ['19-binary-search-trees'], tags: ['trees'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Binary_search_tree', 'TAOCP vol. 3 §6.2.2']
    },
    {
      id: 'lehmer-binary-search', year: 1960, yearLabel: '1960–62', title: 'Binary search for any size',
      people: ['lehmer'],
      summary: 'D. H. Lehmer published a binary search that works for tables of any length; in 1962 Hermann Bottenbruch gave an ALGOL 60 version.',
      detail: 'Knuth observed that although binary search was first described in 1946, the first published version without bugs did not appear until 1962. Correct versions keep a precise invariant about which interval may still contain the target.',
      lessons: ['13-binary-search'], tags: ['foundations'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Binary_search', 'TAOCP vol. 3 §6.2.1']
    },
    {
      id: 'karatsuba', year: 1960, yearLabel: '1960', title: 'Karatsuba beats the schoolbook',
      people: ['karatsuba', 'kolmogorov'],
      summary: 'Andrey Kolmogorov conjectured in a Moscow seminar that multiplying two n-digit numbers needs about n² steps; within a week, 23-year-old student Anatoly Karatsuba found a faster way.',
      detail: 'Split each number in half and use three half-size multiplications instead of four; applied recursively this takes about n^1.585 steps. Kolmogorov presented the result at the next meeting and then closed the seminar. It showed that divide and conquer can beat the obvious method.',
      lessons: ['15-merge-sort', '05-big-o'], tags: ['paradigms', 'complexity'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Karatsuba_algorithm', 'Study dsa-03']
    },
    {
      id: 'backtrack-named', year: 1960, yearLabel: '1960–65', title: 'Backtracking gets a method',
      people: ['lehmer'],
      summary: 'R. J. Walker described a general backtrack technique for combinatorial search in 1960, using the name D. H. Lehmer had coined in the 1950s.',
      detail: 'Extend a partial solution one choice at a time, and undo the last choice as soon as it cannot lead anywhere. Solomon Golomb and Leonard Baumert’s 1965 paper “Backtrack Programming” made it a standard method, and in 1971 Niklaus Wirth used eight queens to teach stepwise program design.',
      lessons: ['33-backtracking'], tags: ['paradigms'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Backtracking', 'JACM 12(4), 1965', 'CACM 14(4), 1971']
    },
    {
      id: 'shunting-yard', year: 1961, yearLabel: 'November 1961', title: 'The shunting-yard algorithm',
      people: ['dijkstra'],
      summary: 'Dijkstra described converting ordinary infix formulas to reverse Polish order with a stack of waiting operators, like wagons shunted onto a siding.',
      detail: 'It appeared in a Mathematisch Centrum report on his ALGOL 60 translator for the X1. Each operator waits on the stack until one of lower precedence arrives. The same year the Burroughs B5000 put a stack into the hardware itself.',
      lessons: ['09-stacks'], tags: ['languages'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Shunting_yard_algorithm', 'GK']
    },
    {
      id: 'simula-queues', year: 1962, yearLabel: '1962–67', title: 'SIMULA: queues that outlive their creators',
      people: ['dahl', 'nygaard'],
      summary: 'Kristen Nygaard and Ole-Johan Dahl designed SIMULA to simulate customers waiting in queues at service stations.',
      detail: 'ALGOL kept local data on a stack, which suits nested calls but not queues: in a queue the first customer in is the first out, while on a stack the first in is the last out. Dahl moved the data onto a garbage-collected heap, and from those heap objects came the classes and objects of SIMULA 67, ancestor of C++ and Java.',
      lessons: ['10-queues', '04-functions-and-the-stack'], tags: ['languages'], era: 'golden-age',
      sources: ['WP ch. 7']
    },
    {
      id: 'kahn-topological-sort', year: 1962, yearLabel: 'November 1962', title: 'Kahn’s topological sort',
      people: [],
      summary: 'Arthur B. Kahn of Westinghouse published a way to order the tasks of a large project network so that every task comes after the tasks it depends on.',
      detail: 'Such networks came from the critical path method (1957) and the Navy’s PERT system for the Polaris missile (1958). Kahn’s rule: repeatedly remove a task with no remaining prerequisites. On an IBM 7090 it ordered a PERT network of 30,000 activities in under an hour, and if tasks remain but none is free, the network has a cycle.',
      lessons: ['27-topological-sort'], tags: ['graphs'], era: 'golden-age',
      sources: ['https://dl.acm.org/doi/10.1145/368996.369025', 'WP cast of characters (Mauchly and the critical path method)']
    },
    {
      id: 'avl-trees', year: 1962, yearLabel: '1962', title: 'AVL trees',
      people: ['adelson-velsky', 'landis'],
      summary: 'Georgy Adelson-Velsky and Evgenii Landis published the first self-balancing binary search tree in the Soviet journal Doklady.',
      detail: 'Each node’s two subtrees may differ in height by at most one, and rotations restore the rule after an insertion, so searches stay logarithmic. The paper was four pages long, and an English translation appeared the same year. Adelson-Velsky later co-led Kaissa, the program that won the first world computer chess championship in 1974.',
      lessons: ['20-balanced-trees'], tags: ['trees'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/AVL_tree', 'Study dsa-07']
    },
    {
      id: 'floyd-warshall', year: 1962, yearLabel: '1959–62', title: 'All-pairs shortest paths in three loops',
      people: ['floyd', 'warshall', 'roy'],
      summary: 'Bernard Roy (1959), Stephen Warshall (1962) and Robert Floyd (1962) found the triple loop that lets each vertex in turn serve as a possible stopover.',
      detail: 'Warshall’s version computes which vertices can reach which (the transitive closure); Floyd’s Algorithm 97 computes distances. Warshall reportedly bet a colleague a bottle of rum on who could first settle whether the method always works, proved it overnight, and shared the rum with the loser.',
      lessons: ['29-bellman-ford-and-floyd-warshall', '34-dynamic-programming'], tags: ['graphs', 'paradigms'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Stephen_Warshall', 'CACM 5(6), 1962', 'JACM 9(1), 1962']
    },
    {
      id: 'ascii', year: 1963, yearLabel: '1963–67', title: 'ASCII',
      people: [],
      summary: 'The American Standard Code for Information Interchange gave letters, digits, punctuation and control characters 7-bit numbers; a major revision followed in 1967.',
      detail: 'The letters are consecutive, so “is this a letter?” is a range check, and upper and lower case differ by a single bit. A string became an array of small integers. Bob Bemer, who had worked with both Backus and Hopper, is often called the father of ASCII.',
      lessons: ['07-strings-and-two-pointers', '02-bits-and-memory'], tags: ['strings', 'hardware'], era: 'golden-age',
      sources: ['Code ch. 13', 'WP cast of characters (Bemer)']
    },
    {
      id: 'binary-heap', year: 1964, yearLabel: 'June–December 1964', title: 'The binary heap and heapsort',
      people: ['williams-jwj', 'floyd'],
      summary: 'J. W. J. Williams published heapsort in June 1964, introducing the binary heap stored in an array; in December Robert Floyd showed how to build a heap in linear time.',
      detail: 'The heap keeps the largest item at the root without any pointers: the children of position i sit at 2i and 2i+1. Floyd’s “Treesort 3” sifts down from the middle of the array backwards, making heapsort a fully in-place O(n log n) sort. Heaps became the standard priority queue.',
      lessons: ['21-heaps'], tags: ['trees', 'sorting'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Heapsort', 'CACM 7(6) and 7(12), 1964']
    },
    {
      id: 'galler-fischer', year: 1964, yearLabel: 'May 1964', title: 'Union-find forests',
      people: ['galler', 'fischer'],
      summary: 'Bernard Galler and Michael Fischer represented groups of equivalent names as trees in which each element points to a parent, in order to compile FORTRAN EQUIVALENCE statements.',
      detail: 'Two elements are in the same group if they lead to the same root, and merging two groups hangs one root under the other. The same Michael Fischer co-authored the Wagner–Fischer edit-distance algorithm ten years later.',
      lessons: ['24-union-find'], tags: ['trees', 'graphs'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Disjoint-set_data_structure', 'https://en.wikipedia.org/wiki/Michael_J._Fischer']
    },
    {
      id: 'hartmanis-stearns', year: 1965, yearLabel: '1965', title: 'Measuring computational difficulty',
      people: ['hartmanis', 'stearns', 'edmonds'],
      summary: 'Juris Hartmanis and Richard Stearns’s paper “On the Computational Complexity of Algorithms” classified problems by how the running time of the best machine grows with the input.',
      detail: 'The same year Jack Edmonds and Alan Cobham argued that algorithms with running time bounded by a polynomial are the ones that should count as efficient. Hartmanis and Stearns received the 1993 Turing Award for founding computational complexity.',
      lessons: ['05-big-o', '37-p-vs-np'], tags: ['complexity'], era: 'golden-age',
      sources: ['GK']
    },
    {
      id: 'levenshtein-distance', year: 1965, yearLabel: '1965', title: 'Levenshtein distance',
      people: ['levenshtein'],
      summary: 'Studying codes that correct deleted and inserted bits, Vladimir Levenshtein defined the distance between two strings as the fewest insertions, deletions and substitutions that turn one into the other.',
      detail: 'The paper appeared in Russian in 1965 and in English in 1966. The distance now drives spell checkers and DNA comparison, usually computed by filling a table row by row.',
      lessons: ['35-dynamic-programming-2d'], tags: ['strings', 'paradigms'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Levenshtein_distance']
    },
    {
      id: 'bohm-jacopini', year: 1966, yearLabel: 'May 1966', title: 'Sequence, selection, iteration',
      people: ['bohm', 'jacopini'],
      summary: 'Corrado Böhm and Giuseppe Jacopini proved that any flowchart can be rewritten using only sequence, choice and loops, with extra flag variables where needed.',
      detail: 'The result drew little notice at first, but Dijkstra built his case against go to on it. It means an arbitrary jump is never necessary, only sometimes convenient.',
      lessons: ['03-control-flow'], tags: ['languages', 'foundations'], era: 'golden-age',
      sources: ['WP ch. 6 and cast of characters', 'CACM 9(5), 1966']
    },
    {
      id: 'hashing-in-print', year: 1968, yearLabel: '1967–68', title: '“Hashing” reaches print',
      people: [],
      summary: 'The word “hashing” first appeared in print in Harold Hellerman’s 1967 book, and Robert Morris’s 1968 survey “Scatter Storage Techniques” made the subject widely known.',
      detail: 'Knuth found that programmers around the world had said “hash” for years, but nobody put such an undignified word in print before 1967. Morris’s paper also introduced random probing and set off a wave of research.',
      lessons: ['11-hash-tables'], tags: ['hashing'], era: 'golden-age',
      sources: ['TAOCP vol. 3 §6.4, History']
    },
    {
      id: 'goto-considered-harmful', year: 1968, yearLabel: 'March 1968', title: '“Go To Statement Considered Harmful”',
      people: ['dijkstra', 'wirth'],
      summary: 'Dijkstra’s letter to the Communications of the ACM argued that unrestricted jumps make it too hard to know where a running program is and what is true at that point.',
      detail: 'He called it “A Case Against the Go To Statement”; the editor, Niklaus Wirth, rushed it out as a letter under the famous headline. Years of angry replies followed, but structured loops and if-statements won. In 1974 Knuth answered with a survey on when a go to is still justified — the paper that warns premature optimization is the root of all evil.',
      lessons: ['03-control-flow'], tags: ['languages'], era: 'golden-age',
      sources: ['WP ch. 6', 'Knuth, Computing Surveys 6(4), 1974']
    },
    {
      id: 'a-star', year: 1968, yearLabel: '1968', title: 'A* for Shakey the robot',
      people: ['hart', 'nilsson', 'raphael'],
      summary: 'At SRI, Peter Hart, Nils Nilsson and Bertram Raphael created A* to plan routes for Shakey, a mobile robot that reasoned about its own actions.',
      detail: 'A* orders its search by the cost so far plus an estimate of the cost remaining; Raphael suggested adding the two. If the estimate never overestimates, the first path found is a shortest one — the property Hart worked out. Raphael later called the name a quick and rather arbitrary choice.',
      lessons: ['28-dijkstra-and-a-star'], tags: ['graphs', 'paradigms'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/A*_search_algorithm', 'IEEE Trans. SSC 4(2), 1968']
    },
    {
      id: 'knuth-taocp', year: 1968, yearLabel: '1968–73', title: 'The Art of Computer Programming',
      people: ['knuth'],
      summary: 'Donald Knuth published Fundamental Algorithms, the first volume of The Art of Computer Programming; volume 3, Sorting and Searching, followed in 1973.',
      detail: 'Knuth analysed algorithms exactly — counting operations and working out averages — and made “analysis of algorithms” a field. He also chased down who invented what, which is why many dates on this timeline come from his history sections.',
      lessons: ['05-big-o', '18-trees'], tags: ['complexity', 'foundations'], era: 'golden-age',
      sources: ['WP ch. 12 and cast of characters', 'GK']
    },
    {
      id: 'thompson-regex', year: 1968, yearLabel: 'June 1968', title: 'Thompson’s regular-expression search',
      people: ['ken-thompson'],
      summary: 'Ken Thompson published a method that compiles a regular expression into machine code that tracks every possible match position at once.',
      detail: 'Following all the states of the pattern’s automaton together avoids the exponential blow-up of trying alternatives one at a time. Thompson built it into the QED and ed editors, and grep grew out of ed in the early 1970s.',
      lessons: ['36-string-matching'], tags: ['strings', 'languages'], era: 'golden-age',
      sources: ['CACM 11(6), 1968', 'GK']
    },
    {
      id: 'apollo-priorities', year: 1969, yearLabel: '20 July 1969', title: 'Priorities save the Moon landing',
      people: ['margaret-hamilton', 'laning'],
      summary: 'During Apollo 11’s descent the guidance computer raised 1201 and 1202 overload alarms; its executive dropped low-priority jobs and kept the essential ones running.',
      detail: 'The executive, designed by J. Halcombe Laning, scheduled jobs by priority, and Margaret Hamilton’s software team had built the flight software to restart and recover. It is a priority queue in action: when time runs short, serve the most important work first.',
      lessons: ['21-heaps', '10-queues'], tags: ['hardware', 'languages'], era: 'golden-age',
      sources: ['WP cast of characters (Laning)', 'GK']
    },
    {
      id: 'knuth-morris-pratt', year: 1970, yearLabel: '1969–77', title: 'Knuth–Morris–Pratt',
      people: ['morris-jh', 'knuth', 'pratt'],
      summary: 'James Morris found a way to search text without ever backing up while writing a text editor at Berkeley in 1969; Knuth, working from a theorem of Stephen Cook about automata, found the same algorithm independently.',
      detail: 'Morris’s routine was so subtle that other programmers, who did not understand it, had wrecked it with well-meant fixes within months. Vaughan Pratt refined Knuth’s version, and the three published together in 1977. The key idea: after a mismatch, the pattern itself tells you how far you may shift.',
      lessons: ['36-string-matching'], tags: ['strings'], era: 'golden-age',
      sources: ['Knuth, Morris & Pratt, SIAM J. Comput. 6(2), 1977, §7 “Historical remarks”']
    },
    {
      id: 'allen-control-flow', year: 1970, yearLabel: '1970', title: 'Control-flow graphs',
      people: ['frances-allen'],
      summary: 'Frances Allen’s paper “Control Flow Analysis” treated a program as a graph of straight-line blocks joined by possible jumps, so a compiler could find loops and optimise them.',
      detail: 'Each run of straight-line code becomes a node and each branch an edge. Allen, an IBM researcher, became the first woman to receive the Turing Award, in 2006, for her work on optimising compilers.',
      lessons: ['03-control-flow', '25-graphs'], tags: ['languages', 'graphs'], era: 'golden-age',
      sources: ['SIGPLAN Notices 5(7), 1970', 'GK']
    },
    {
      id: 'dinitz-blocking-flow', year: 1970, yearLabel: '1969–70', title: 'Dinitz’s blocking flows',
      people: [],
      summary: 'Yefim Dinitz, a student in Georgy Adelson-Velsky’s group in Moscow, invented a max-flow algorithm in January 1969 in answer to a class exercise, and published it in 1970.',
      detail: 'It uses breadth-first search to build a layered graph and pushes a whole “blocking flow” along shortest paths in each phase, for O(V²E) time overall. Little known in the West until Shimon Even and Alon Itai explained it in the mid-1970s, it remains a favourite of competitive programmers.',
      lessons: ['31-network-flow', '26-bfs-and-dfs'], tags: ['graphs'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Dinic%27s_algorithm', 'Dinitz, “Dinitz’ Algorithm: The Original Version and Even’s Version” (2006)', 'Study dsa-17']
    },
    {
      id: 'b-trees', year: 1970, yearLabel: '1970–72', title: 'B-trees',
      people: ['bayer', 'mccreight'],
      summary: 'At Boeing Scientific Research Labs, Rudolf Bayer and Edward McCreight designed a balanced tree whose nodes hold many keys each, so a search touches only a few disk blocks.',
      detail: 'With hundreds of keys per node, a tree three or four levels deep can index millions of records. They never said what the B stands for; McCreight recalled that they could not use Boeing’s name without the lawyers, and that balance was part of it. Nearly every database and file system uses a B-tree variant.',
      lessons: ['20-balanced-trees'], tags: ['trees'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/B-tree', 'Study dsa-07']
    },
    {
      id: 'bloom-filter', year: 1970, yearLabel: 'July 1970', title: 'Bloom filters',
      people: [],
      summary: 'Burton Bloom proposed a bit array set by several hash functions that answers either “definitely not present” or “probably present”.',
      detail: 'His example was hyphenating 500,000 words, 90% of which follow simple rules: a small filter screens out most of the costly disk lookups for the rest, at the price of occasional false alarms. Bloom filters now sit inside databases, web browsers and network equipment.',
      lessons: ['38-randomized-algorithms', '11-hash-tables'], tags: ['hashing', 'paradigms'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Bloom_filter', 'CACM 13(7), 1970']
    },
    {
      id: 'cook-np-completeness', year: 1971, yearLabel: 'May 1971', title: 'Cook’s theorem',
      people: ['cook', 'levin'],
      summary: 'At the STOC conference, Stephen Cook showed that Boolean satisfiability is at least as hard as every problem whose solutions can be checked quickly.',
      detail: 'If SAT has a polynomial-time algorithm, then so does every problem in NP — the idea of NP-completeness. Leonid Levin reached the same idea independently in Moscow and published in 1973. Cook had moved to Toronto after Berkeley’s mathematics department denied him tenure in 1970, a decision Richard Karp later called a lasting shame for Berkeley.',
      lessons: ['37-p-vs-np'], tags: ['complexity'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Stephen_Cook', 'Study dsa-20']
    },
    {
      id: 'edmonds-greedy-matroids', year: 1971, yearLabel: '1971', title: 'Matroids and the greedy algorithm',
      people: ['edmonds'],
      summary: 'Jack Edmonds showed that the greedy algorithm finds an optimal answer for every choice of weights exactly when the underlying structure is a matroid.',
      detail: 'Richard Rado had proved one direction in 1957. The theorem explains why greedy works for minimum spanning trees but fails for so many other problems.',
      lessons: ['32-greedy'], tags: ['paradigms'], era: 'golden-age',
      sources: ['Study dsa-16', 'Mathematical Programming 1, 1971']
    },
    {
      id: 'tarjan-dfs', year: 1972, yearLabel: '1972', title: 'Depth-first search and linear graph algorithms',
      people: ['tarjan', 'hopcroft'],
      summary: 'Robert Tarjan showed that a single depth-first search, recording discovery order and the lowest vertex reachable, finds strongly connected components in linear time.',
      detail: 'The paper grew out of his Stanford doctoral work. With John Hopcroft he used depth-first search to find biconnected components and to test planarity in linear time, and the two shared the 1986 Turing Award.',
      lessons: ['26-bfs-and-dfs', '27-topological-sort'], tags: ['graphs'], era: 'golden-age',
      sources: ['SIAM J. Comput. 1(2), 1972', 'GK']
    },
    {
      id: 'karp-21-problems', year: 1972, yearLabel: 'March 1972', title: 'Karp’s 21 problems',
      people: ['karp'],
      summary: 'Richard Karp showed that 21 well-known problems — among them clique, vertex cover, Hamiltonian cycle and knapsack — are all NP-complete.',
      detail: 'Each proof was a short reduction chaining back to satisfiability. After Karp’s list, proving a problem NP-complete became the standard way to show that it is probably intractable.',
      lessons: ['37-p-vs-np'], tags: ['complexity'], era: 'golden-age',
      sources: ['Study dsa-20', 'GK']
    },
    {
      id: 'edmonds-karp', year: 1972, yearLabel: '1972', title: 'Shortest augmenting paths',
      people: ['edmonds', 'karp'],
      summary: 'Jack Edmonds and Richard Karp showed that choosing augmenting paths by breadth-first search makes Ford–Fulkerson run in O(VE²) time, whatever the capacities.',
      detail: 'Plain Ford–Fulkerson can take a number of steps that grows with the capacities, and with irrational capacities may never stop. Dinitz had found a related idea in Moscow two years earlier.',
      lessons: ['31-network-flow'], tags: ['graphs'], era: 'golden-age',
      sources: ['JACM 19(2), 1972', 'Study dsa-17']
    },
    {
      id: 'liskov-adt', year: 1974, yearLabel: 'April 1974', title: 'Abstract data types',
      people: ['liskov'],
      summary: 'Barbara Liskov and Stephen Zilles’s “Programming with Abstract Data Types” defined a type by its operations — push, pop, top — rather than by how it is stored.',
      detail: 'Liskov’s CLU language, which followed, built the idea in. A stack is a promise about behaviour, and an array or a linked list can keep that promise. Liskov received the 2008 Turing Award.',
      lessons: ['09-stacks', '10-queues'], tags: ['languages', 'foundations'], era: 'golden-age',
      sources: ['SIGPLAN Notices 9(4), 1974', 'GK']
    },
    {
      id: 'wagner-fischer', year: 1974, yearLabel: 'January 1974', title: 'The string-to-string correction problem',
      people: ['fischer'],
      summary: 'Robert Wagner and Michael Fischer published the dynamic-programming algorithm for edit distance that is taught today.',
      detail: 'It fills an (m+1)×(n+1) table in O(mn) time, each cell taking the cheapest of a deletion, an insertion or a substitution. The same kind of table had turned up in speech recognition (Taras Vintsyuk, 1968) and protein alignment (Saul Needleman and Christian Wunsch, 1970), and the Unix diff tool of 1976 rests on the related longest-common-subsequence problem.',
      lessons: ['35-dynamic-programming-2d'], tags: ['strings', 'paradigms'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Wagner%E2%80%93Fischer_algorithm', 'JACM 21(1), 1974']
    },
    {
      id: 'tarjan-union-find', year: 1975, yearLabel: '1975', title: 'The inverse-Ackermann bound',
      people: ['tarjan'],
      summary: 'Tarjan proved that union-find with union by rank and path compression costs O(α(n)) per operation, where α grows so slowly that it is at most 4 for any input you could store.',
      detail: 'John Hopcroft and Jeffrey Ullman had shown a log* bound in 1973. Tarjan also proved his bound tight for this structure, and in 1989 Michael Fredman and Michael Saks showed that no structure can do better.',
      lessons: ['24-union-find', '05-big-o'], tags: ['complexity', 'trees'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Disjoint-set_data_structure', 'JACM 22(2), 1975']
    },
    {
      id: 'aho-corasick', year: 1975, yearLabel: 'June 1975', title: 'Many patterns at once',
      people: [],
      summary: 'Alfred Aho and Margaret Corasick built a trie of all the search words, with failure links, so a single pass over a text finds every occurrence of every word.',
      detail: 'It was written to speed up bibliographic searches and became the algorithm inside the Unix tool fgrep. It combines a trie with the failure-function idea behind Knuth–Morris–Pratt.',
      lessons: ['22-tries', '36-string-matching'], tags: ['strings', 'trees'], era: 'golden-age',
      sources: ['CACM 18(6), 1975', 'GK']
    },
    {
      id: 'knuth-big-theta', year: 1976, yearLabel: 'April 1976', title: 'Big Omega and Big Theta',
      people: ['knuth'],
      summary: 'In a letter to SIGACT News, Knuth proposed that computer scientists use Ω for lower bounds and Θ for tight bounds alongside Bachmann’s O.',
      detail: 'He traced the history of the symbols and chose a meaning for Ω that differs from Hardy and Littlewood’s older one. His definitions are the ones used in algorithms courses today.',
      lessons: ['05-big-o'], tags: ['complexity'], era: 'golden-age',
      sources: ['Knuth, “Big Omicron and Big Omega and Big Theta”, SIGACT News 8(2), 1976']
    },
    {
      id: 'randomized-primality', year: 1976, yearLabel: '1976–80', title: 'Randomised primality testing',
      people: ['rabin'],
      summary: 'Gary Miller gave a fast primality test that is correct if the extended Riemann hypothesis holds; Michael Rabin turned it into a randomised test that needs no unproven hypothesis.',
      detail: 'Each random trial that fails to show n composite cuts the chance of error by at least a factor of four, so a few dozen trials make a mistake less likely than a hardware fault. Rabin’s 1976 lecture “Probabilistic Algorithms” argued that coin flips are a legitimate design tool.',
      lessons: ['38-randomized-algorithms'], tags: ['paradigms', 'complexity'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Miller%E2%80%93Rabin_primality_test', 'J. Number Theory 12, 1980']
    },
    {
      id: 'boyer-moore', year: 1977, yearLabel: 'October 1977', title: 'Boyer–Moore',
      people: ['robert-boyer', 'j-strother-moore'],
      summary: 'Robert Boyer and J Strother Moore compared the pattern from its last character backwards, so a mismatch can move the search ahead by as much as the whole pattern length.',
      detail: 'On ordinary text, the longer the pattern, the faster the search, because most characters are never examined. Bill Gosper noticed the same skipping idea independently. Variants of it run inside many editors and search tools.',
      lessons: ['36-string-matching'], tags: ['strings'], era: 'golden-age',
      sources: ['CACM 20(10), 1977', 'KMP paper §8']
    },
    {
      id: 'bentley-segment-tree', year: 1977, yearLabel: '1977', title: 'Segment trees',
      people: ['bentley'],
      summary: 'Jon Bentley introduced the segment tree in unpublished notes on Klee’s problem: computing the total area covered by a set of rectangles.',
      detail: 'Each node stores information about one interval of the axis, and any query range breaks into O(log n) nodes. Competitive programmers now use segment trees for range sums, range minimums and updates.',
      lessons: ['23-segment-and-fenwick-trees'], tags: ['trees'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Klee%27s_measure_problem', 'GK']
    },
    {
      id: 'universal-hashing', year: 1977, yearLabel: '1977–79', title: 'Universal hashing',
      people: [],
      summary: 'Larry Carter and Mark Wegman proposed choosing the hash function at random from a family, so that no fixed set of keys is bad for most choices.',
      detail: 'With a family such as h(k) = ((a·k + b) mod p) mod m, any two different keys collide with probability about 1/m. It protects hash tables against anyone who picks colliding keys on purpose.',
      lessons: ['11-hash-tables', '38-randomized-algorithms'], tags: ['hashing', 'paradigms'], era: 'golden-age',
      sources: ['Study dsa-08', 'GK']
    },
    {
      id: 'red-black-trees', year: 1978, yearLabel: '1972–78', title: 'Red-black trees',
      people: ['guibas', 'sedgewick', 'bayer'],
      summary: 'Leonidas Guibas and Robert Sedgewick recast Rudolf Bayer’s 1972 “symmetric binary B-trees” as binary trees with red and black nodes.',
      detail: 'Red links glue nodes into the 2-, 3- and 4-key nodes of a B-tree, and the rules keep every root-to-leaf path within a factor of two of every other. The colours reportedly came from what printed best on a Xerox PARC colour laser printer — or, in Guibas’s telling, from the pens they had to hand. Java’s TreeMap and most C++ std::map implementations are red-black trees.',
      lessons: ['20-balanced-trees'], tags: ['trees'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Red%E2%80%93black_tree']
    },
    {
      id: 'kosaraju-scc', year: 1978, yearLabel: '1978–81', title: 'Two passes for strong components',
      people: [],
      summary: 'S. Rao Kosaraju found a strongly-connected-components algorithm that runs depth-first search twice, once on the graph and once on its reverse; Micha Sharir published it in 1981.',
      detail: 'The first search orders vertices by finishing time; searching the reversed graph in that order peels off one component at a time. It is simpler to explain than Tarjan’s one-pass method, though usually a little slower.',
      lessons: ['27-topological-sort', '26-bfs-and-dfs'], tags: ['graphs'], era: 'golden-age',
      sources: ['https://en.wikipedia.org/wiki/Kosaraju%27s_algorithm']
    },
    {
      id: 'programming-pearls', year: 1983, yearLabel: '1983–86', title: 'Only one in ten',
      people: ['bentley'],
      summary: 'In his Programming Pearls column, Jon Bentley reported that given a couple of hours, about 90% of the professional programmers in his courses wrote a binary search with bugs.',
      detail: 'He used the result to argue for writing programs with explicit invariants. The column was collected in the 1986 book Programming Pearls — whose own carefully proved binary search turned out, in 2006, to hide an overflow bug.',
      lessons: ['13-binary-search'], tags: ['foundations'], era: 'golden-age',
      sources: ['Bentley, Programming Pearls (1986), column 4', 'https://reprog.wordpress.com/2010/04/19/are-you-one-of-the-10-percent/']
    },
    {
      id: 'fibonacci-heaps', year: 1984, yearLabel: '1984–87', title: 'Fibonacci heaps',
      people: ['tarjan'],
      summary: 'Michael Fredman and Robert Tarjan designed a heap in which decreasing a key costs O(1) amortized time.',
      detail: 'That brought Dijkstra’s algorithm down to O(E + V log V). The trees inside the heap have sizes bounded below by Fibonacci numbers, hence the name. In practice simpler binary heaps usually win.',
      lessons: ['21-heaps', '28-dijkstra-and-a-star'], tags: ['trees', 'graphs'], era: 'golden-age',
      sources: ['GK']
    },
    {
      id: 'amortized-analysis', year: 1985, yearLabel: '1985', title: 'Amortized analysis',
      people: ['tarjan'],
      summary: 'Tarjan’s paper “Amortized Computational Complexity” set out how to average the cost of operations over a whole sequence rather than judging each one alone.',
      detail: 'A dynamic array’s occasional expensive doubling is paid for by the many cheap appends before it, so each append costs O(1) amortized. The same year Tarjan and Daniel Sleator published splay trees, binary search trees whose guarantees are amortized too.',
      lessons: ['06-arrays', '19-binary-search-trees', '20-balanced-trees'], tags: ['complexity'], era: 'golden-age',
      sources: ['SIAM J. Algebraic Discrete Methods 6(2), 1985', 'Study dsa-02']
    },
    {
      id: 'reservoir-sampling', year: 1985, yearLabel: 'March 1985', title: 'Reservoir sampling',
      people: ['vitter'],
      summary: 'Jeffrey Vitter analysed how to keep a uniform random sample of k items from a stream of unknown length, and gave a much faster method, Algorithm Z.',
      detail: 'The simple version keeps the first k items, then lets item i replace a random slot with probability k/i. Knuth credits that simple version to Alan Waterman.',
      lessons: ['38-randomized-algorithms'], tags: ['paradigms'], era: 'golden-age',
      sources: ['https://www.cs.umd.edu/~samir/498/vitter.pdf', 'TAOCP vol. 2 §3.4.2']
    },
    {
      id: 'rabin-karp', year: 1987, yearLabel: '1987', title: 'Rabin–Karp',
      people: ['rabin', 'karp'],
      summary: 'Michael Rabin and Richard Karp searched for patterns by comparing hash values of text windows, updating the hash in constant time as the window slides one step.',
      detail: 'Only windows whose hash matches the pattern’s need a full comparison, and picking the hash at random makes false matches rare. The rolling hash also finds repeated substrings and many patterns at once.',
      lessons: ['36-string-matching', '07-strings-and-two-pointers'], tags: ['strings', 'hashing'], era: 'golden-age',
      sources: ['IBM J. Res. Dev. 31(2), 1987', 'GK']
    },
    {
      id: 'skip-lists', year: 1989, yearLabel: '1989–90', title: 'Skip lists',
      people: [],
      summary: 'William Pugh proposed linked lists with random express lanes: each node is promoted to the next level up with probability one half.',
      detail: 'Search, insertion and deletion take O(log n) expected time without any rebalancing rules. Redis keeps its sorted sets in skip lists.',
      lessons: ['38-randomized-algorithms', '08-linked-lists'], tags: ['paradigms', 'trees'], era: 'golden-age',
      sources: ['https://dl.acm.org/doi/10.1145/78973.78977', 'https://redis.io/glossary/redis-sorted-sets/']
    },
    {
      id: 'utf-8', year: 1992, yearLabel: '1991–93', title: 'Unicode and UTF-8',
      people: ['ken-thompson'],
      summary: 'Unicode 1.0 appeared in 1991; in September 1992 Ken Thompson sketched UTF-8, a variable-length way to store Unicode, on a placemat in a New Jersey diner while Rob Pike watched.',
      detail: 'UTF-8 leaves ASCII unchanged and uses two to four bytes for other characters, with bit patterns that show where each character starts. That is why a string’s length can mean bytes or characters. It now encodes almost every web page.',
      lessons: ['07-strings-and-two-pointers'], tags: ['strings', 'hardware'], era: 'modern',
      sources: ['https://www.cl.cam.ac.uk/~mgk25/ucs/utf-8-history.txt']
    },
    {
      id: 'fenwick-trees', year: 1994, yearLabel: '1989–94', title: 'Binary indexed trees',
      people: [],
      summary: 'Peter Fenwick published a compact array structure for running totals, built for adaptive arithmetic coding in data compression; Boris Ryabko had described the same idea in 1989.',
      detail: 'Each position stores the sum of a block whose length is the lowest set bit of its index, so updates and prefix sums both touch O(log n) positions. The whole structure is one array the same size as the data.',
      lessons: ['23-segment-and-fenwick-trees'], tags: ['trees'], era: 'modern',
      sources: ['https://en.wikipedia.org/wiki/Fenwick_tree', 'Software: Practice and Experience 24(3), 1994']
    },
    {
      id: 'introsort', year: 1997, yearLabel: '1997', title: 'Introsort',
      people: [],
      summary: 'David Musser combined quicksort with a switch to heapsort when the recursion gets too deep, guaranteeing O(n log n) time in the worst case.',
      detail: 'It keeps quicksort’s speed on typical data while defusing its quadratic worst case. Most C++ standard libraries implement std::sort this way.',
      lessons: ['16-quick-sort', '21-heaps'], tags: ['sorting'], era: 'modern',
      sources: ['Software: Practice and Experience 27(8), 1997', 'GK']
    },
    {
      id: 'timsort', year: 2002, yearLabel: '2002–15', title: 'Timsort',
      people: [],
      summary: 'Tim Peters wrote Timsort for Python: a merge sort that finds runs already in order and merges them with care.',
      detail: 'Real data is often partly sorted, and Timsort takes advantage, approaching linear time on nearly sorted input. Java adopted it for objects in Java 7, and Android followed. In 2015, trying to prove Java’s version correct with the KeY verifier, Stijn de Gouw and colleagues found inputs that crashed it, and proposed the fix.',
      lessons: ['15-merge-sort', '14-elementary-sorts'], tags: ['sorting'], era: 'modern',
      sources: ['https://ercim-news.ercim.eu/en102/r-i/fixing-the-sorting-algorithm-for-android-java-and-python', 'GK']
    },
    {
      id: 'primes-in-p', year: 2002, yearLabel: 'August 2002', title: 'PRIMES is in P',
      people: [],
      summary: 'Manindra Agrawal and his undergraduate students Neeraj Kayal and Nitin Saxena at IIT Kanpur gave the first deterministic polynomial-time primality test.',
      detail: 'It settled a long-open question, although randomised tests such as Miller–Rabin remain far faster in practice. It showed that a problem solved easily with randomness can sometimes be solved without it.',
      lessons: ['38-randomized-algorithms', '37-p-vs-np'], tags: ['complexity'], era: 'modern',
      sources: ['GK']
    },
    {
      id: 'binary-search-overflow', year: 2006, yearLabel: 'June 2006', title: '“Nearly all binary searches are broken”',
      people: [],
      summary: 'Joshua Bloch reported that mid = (low + high) / 2 overflows when low + high exceeds the largest int, a bug that had sat in Java’s binary search for about nine years.',
      detail: 'The same line appeared in Jon Bentley’s proved-correct binary search in Programming Pearls, where Bloch had learned the algorithm. The fix is mid = low + (high − low) / 2. The bug appears only with arrays of about a billion elements or more, which had become possible.',
      lessons: ['13-binary-search', '15-merge-sort'], tags: ['foundations'], era: 'modern',
      sources: ['https://research.google/blog/extra-extra-read-all-about-it-nearly-all-binary-searches-and-mergesorts-are-broken/']
    },
    {
      id: 'obama-bubble-sort', year: 2007, yearLabel: '2007', title: '“The bubble sort would be the wrong way to go”',
      people: [],
      summary: 'Asked at Google by Eric Schmidt for the most efficient way to sort a million 32-bit integers, presidential candidate Barack Obama answered that bubble sort would be the wrong way to go.',
      detail: 'Schmidt meant it as a joke question. Bubble sort would need about half a trillion comparisons for a million items; a radix sort, which never compares, is a strong answer for fixed-width integers.',
      lessons: ['14-elementary-sorts', '17-linear-time-sorts'], tags: ['sorting'], era: 'modern',
      sources: ['http://www.righto.com/2012/11/obama-on-sorting-1m-integers-bubble.html']
    },
    {
      id: 'edit-distance-lower-bound', year: 2015, yearLabel: '2015', title: 'Why edit distance stays quadratic',
      people: [],
      summary: 'Arturs Backurs and Piotr Indyk showed that edit distance cannot be computed in O(n^(2−ε)) time unless the strong exponential time hypothesis about satisfiability is false.',
      detail: 'Fifty years of failing to beat the quadratic table now have an explanation: a much faster algorithm would mean a breakthrough on SAT.',
      lessons: ['35-dynamic-programming-2d', '37-p-vs-np'], tags: ['complexity', 'strings'], era: 'modern',
      sources: ['STOC 2015', 'Study dsa-23']
    },
    {
      id: 'max-flow-almost-linear', year: 2022, yearLabel: '2022', title: 'Max flow in almost-linear time',
      people: [],
      summary: 'Li Chen, Rasmus Kyng, Yang Liu, Richard Peng, Maximilian Probst Gutenberg and Sushant Sachdeva computed exact maximum flows in m^(1+o(1)) time.',
      detail: 'The paper won a best-paper award at FOCS 2022, 66 years after Ford and Fulkerson. It builds the flow from many small, cleverly maintained cycle improvements rather than from augmenting paths.',
      lessons: ['31-network-flow'], tags: ['graphs', 'complexity'], era: 'modern',
      sources: ['https://dl.acm.org/doi/10.1145/3610940', 'Study dsa-17']
    },
    {
      id: 'negative-weights-near-linear', year: 2022, yearLabel: '2022', title: 'Negative weights in near-linear time',
      people: [],
      summary: 'Aaron Bernstein, Danupon Nanongkai and Christian Wulff-Nilsen found a randomised algorithm for shortest paths with negative integer weights that runs in near-linear time.',
      detail: 'Bellman–Ford’s O(VE) had stood as the simple benchmark since the 1950s, and earlier improvements were modest. The new method uses graph decompositions and calls Dijkstra’s algorithm as a subroutine.',
      lessons: ['29-bellman-ford-and-floyd-warshall'], tags: ['graphs', 'complexity'], era: 'modern',
      sources: ['https://arxiv.org/abs/2203.03456']
    },
    {
      id: 'alphadev', year: 2023, yearLabel: 'June 2023', title: 'AlphaDev’s tiny sorts',
      people: [],
      summary: 'DeepMind’s AlphaDev, a reinforcement-learning system, found shorter assembly routines for sorting three, four and five items, which were merged into LLVM’s C++ standard library.',
      detail: 'Tiny fixed-size sorts run at the bottom of big sorts billions of times a day, so one saved instruction matters. Human programmers soon found further improvements to the same routines.',
      lessons: ['14-elementary-sorts'], tags: ['sorting'], era: 'modern',
      sources: ['https://www.nature.com/articles/s41586-023-06004-9', 'https://arxiv.org/pdf/2307.14503']
    },
    {
      id: 'elastic-hashing', year: 2025, yearLabel: 'January 2025', title: 'An undergraduate beats a 40-year-old conjecture',
      people: [],
      summary: 'Rutgers undergraduate Andrew Krapivin, with Martín Farach-Colton and William Kuszmaul, built an open-addressing hash table, without reordering, whose worst-case expected probes fall far below what Andrew Yao conjectured in 1985.',
      detail: 'They also proved matching lower bounds. The work began when Krapivin, reading a paper on “tiny pointers” in his spare time, needed a better hash table. Meanwhile the 1954 idea of probing nearby slots keeps being retuned: Google’s Swiss tables check 16 slots at once and became Go’s built-in map in 2025.',
      lessons: ['11-hash-tables'], tags: ['hashing'], era: 'modern',
      sources: ['https://arxiv.org/abs/2501.02305', 'https://www.quantamagazine.org/undergraduate-upends-a-40-year-old-data-science-conjecture-20250210/', 'https://go.dev/blog/swisstable']
    },
    {
      id: 'sorting-barrier-sssp', year: 2025, yearLabel: 'June 2025', title: 'Breaking the sorting barrier',
      people: [],
      summary: 'Ran Duan, Jiayi Mao, Xiao Mao, Xinkai Shu and Longhui Yin gave a deterministic shortest-path algorithm for directed graphs that runs in O(m log^(2/3) n) time.',
      detail: 'Dijkstra’s algorithm effectively sorts the vertices by distance, which seemed to force an n log n term. This STOC 2025 best paper shows that on sparse graphs you do not need the full sorted order.',
      lessons: ['28-dijkstra-and-a-star'], tags: ['graphs', 'complexity'], era: 'modern',
      sources: ['https://dl.acm.org/doi/10.1145/3717823.3718179']
    }
  ];

  var people = [
    { id: 'euclid', name: 'Euclid', born: null, died: null, lifeLabel: 'fl. c. 300 BCE', inWeProgrammers: true,
      bio: 'Greek mathematician who worked in Alexandria. His Elements built geometry and number theory as theorems proved from a few axioms, and Book VII contains the greatest-common-divisor procedure still in use.',
      knownFor: ['Elements', 'Euclidean algorithm'] },
    { id: 'al-khwarizmi', name: 'Muhammad ibn Musa al-Khwarizmi', born: 780, died: 850, lifeLabel: 'c. 780 – c. 850', inWeProgrammers: false,
      bio: 'Scholar at the House of Wisdom in Baghdad. His books on calculating with Hindu numerals and on al-jabr taught arithmetic and algebra as step-by-step procedures, and his Latinised name became the word “algorithm”.',
      knownFor: ['Hindu–Arabic numerals', 'Algebra', 'The word “algorithm”'] },
    { id: 'fibonacci', name: 'Leonardo of Pisa (Fibonacci)', born: 1170, died: 1250, lifeLabel: 'c. 1170 – c. 1250', inWeProgrammers: false,
      bio: 'Italian mathematician whose Liber Abaci (1202) popularised Hindu–Arabic numerals in Europe. A puzzle in it about breeding rabbits produced the sequence now named after him.',
      knownFor: ['Liber Abaci', 'Fibonacci numbers'] },
    { id: 'leibniz', name: 'Gottfried Wilhelm Leibniz', born: 1646, died: 1716, lifeLabel: '1646–1716', inWeProgrammers: false,
      bio: 'German philosopher and mathematician who invented calculus independently of Newton and built a mechanical calculator. He championed binary arithmetic and imagined a symbolic language in which arguments could be settled by calculation.',
      knownFor: ['Binary arithmetic', 'Calculus', 'Stepped reckoner'] },
    { id: 'euler', name: 'Leonhard Euler', born: 1707, died: 1783, lifeLabel: '1707–1783', inWeProgrammers: false,
      bio: 'Swiss mathematician, the most prolific of his century, who worked in St Petersburg and Berlin. His 1735 solution of the Königsberg bridges problem is counted as the first theorem of graph theory.',
      knownFor: ['Königsberg bridges', 'Eulerian paths', 'Graph theory'] },
    { id: 'babbage', name: 'Charles Babbage', born: 1791, died: 1871, lifeLabel: '1791–1871', inWeProgrammers: true,
      bio: 'English mathematician and inventor who designed the Difference Engine, to compute tables by repeated addition, and the Analytical Engine, a programmable machine with a separate store and mill. Neither was finished in his lifetime; We, Programmers portrays him as a brilliant starter who rarely finished.',
      knownFor: ['Difference Engine', 'Analytical Engine'] },
    { id: 'lovelace', name: 'Ada Lovelace', born: 1815, died: 1852, lifeLabel: '1815–1852', inWeProgrammers: true,
      bio: 'English mathematician, daughter of Lord Byron, tutored by Augustus De Morgan. Her 1843 notes on Babbage’s Analytical Engine described it as a machine that could manipulate symbols, not only numbers, and included the Bernoulli-number program of Note G.',
      knownFor: ['Note G', 'Notes on the Analytical Engine'] },
    { id: 'lame', name: 'Gabriel Lamé', born: 1795, died: 1870, lifeLabel: '1795–1870', inWeProgrammers: false,
      bio: 'French mathematician and engineer known for work on elasticity and number theory. In 1844 he bounded the number of steps in Euclid’s algorithm using Fibonacci numbers.',
      knownFor: ['Lamé’s theorem'] },
    { id: 'boole', name: 'George Boole', born: 1815, died: 1864, lifeLabel: '1815–1864', inWeProgrammers: true,
      bio: 'English mathematician, largely self-taught, who became a professor at Queen’s College, Cork. He built an algebra of logic in which variables stand for classes and AND and OR behave like multiplication and addition.',
      knownFor: ['Boolean algebra', 'The Laws of Thought'] },
    { id: 'cayley', name: 'Arthur Cayley', born: 1821, died: 1895, lifeLabel: '1821–1895', inWeProgrammers: false,
      bio: 'English mathematician who worked as a lawyer for years before taking a chair at Cambridge. He named and counted trees and helped found the theory of matrices and groups.',
      knownFor: ['Trees', 'Cayley’s formula', 'Matrix algebra'] },
    { id: 'lucas', name: 'Édouard Lucas', born: 1842, died: 1891, lifeLabel: '1842–1891', inWeProgrammers: false,
      bio: 'French mathematician known for work on Fibonacci-like sequences and primality testing. He invented the Tower of Hanoi puzzle and wrote the multi-volume Récréations mathématiques.',
      knownFor: ['Tower of Hanoi', 'Lucas numbers'] },
    { id: 'hollerith', name: 'Herman Hollerith', born: 1860, died: 1929, lifeLabel: '1860–1929', inWeProgrammers: false,
      bio: 'American statistician and inventor whose electric punched-card tabulator processed the 1890 US census. His Tabulating Machine Company became part of the firm renamed IBM in 1924.',
      knownFor: ['Punched-card tabulator', 'Card sorting'] },
    { id: 'bachmann', name: 'Paul Bachmann', born: 1837, died: 1920, lifeLabel: '1837–1920', inWeProgrammers: false,
      bio: 'German number theorist whose multi-volume Zahlentheorie introduced the O notation in 1894.',
      knownFor: ['Big-O notation'] },
    { id: 'landau', name: 'Edmund Landau', born: 1877, died: 1938, lifeLabel: '1877–1938', inWeProgrammers: false,
      bio: 'German number theorist at Göttingen whose 1909 handbook on the distribution of primes spread the O and o symbols. Nazi boycotts drove him from teaching in 1933–34.',
      knownFor: ['Landau symbols', 'Analytic number theory'] },
    { id: 'erlang', name: 'Agner Krarup Erlang', born: 1878, died: 1929, lifeLabel: '1878–1929', inWeProgrammers: false,
      bio: 'Danish mathematician and engineer at the Copenhagen Telephone Company. His studies of randomly arriving calls founded queueing theory, and the unit of telephone traffic bears his name.',
      knownFor: ['Queueing theory', 'Erlang formulas'] },
    { id: 'boruvka', name: 'Otakar Borůvka', born: 1899, died: 1995, lifeLabel: '1899–1995', inWeProgrammers: false,
      bio: 'Czech mathematician in Brno who worked mainly on differential equations and algebra. In 1926 he published the first minimum spanning tree algorithm, prompted by planning an electricity network for Moravia.',
      knownFor: ['Borůvka’s algorithm'] },
    { id: 'jarnik', name: 'Vojtěch Jarník', born: 1897, died: 1970, lifeLabel: '1897–1970', inWeProgrammers: false,
      bio: 'Czech mathematician in Prague, known chiefly for number theory. In 1930 he described the tree-growing minimum spanning tree method later rediscovered by Prim and Dijkstra.',
      knownFor: ['Jarník–Prim algorithm'] },
    { id: 'whitney', name: 'Hassler Whitney', born: 1907, died: 1989, lifeLabel: '1907–1989', inWeProgrammers: false,
      bio: 'American mathematician who shaped graph theory and topology. His 1935 paper defined matroids, the structures on which greedy algorithms are guaranteed to be optimal.',
      knownFor: ['Matroids', 'Graph theory'] },
    { id: 'turing', name: 'Alan Turing', born: 1912, died: 1954, lifeLabel: '1912–1954', inWeProgrammers: true,
      bio: 'English mathematician who defined computability with his 1936 machine model, played a central part in breaking Enigma at Bletchley Park, and designed the ACE computer. Prosecuted for homosexuality in 1952, he died of cyanide poisoning in 1954, officially ruled a suicide.',
      knownFor: ['Turing machine', 'Halting problem', 'ACE design', 'Codebreaking'] },
    { id: 'von-neumann', name: 'John von Neumann', born: 1903, died: 1957, lifeLabel: '1903–1957', inWeProgrammers: true,
      bio: 'Hungarian-American mathematician at the Institute for Advanced Study whose 1945 EDVAC report set out the stored-program design. He wrote a merge sort for EDVAC, developed Monte Carlo methods with Ulam, and did foundational work in game theory and quantum mechanics.',
      knownFor: ['Stored-program architecture', 'Merge sort', 'Monte Carlo method', 'Game theory'] },
    { id: 'shannon', name: 'Claude Shannon', born: 1916, died: 2001, lifeLabel: '1916–2001', inWeProgrammers: false,
      bio: 'American engineer and mathematician. His 1937 master’s thesis applied Boolean algebra to switching circuits, and his 1948 paper founded information theory. He also built juggling machines and a maze-solving mechanical mouse.',
      knownFor: ['Switching-circuit theory', 'Information theory', 'Max-flow min-cut (independently)'] },
    { id: 'hopper', name: 'Grace Hopper', born: 1906, died: 1992, lifeLabel: '1906–1992', inWeProgrammers: true,
      bio: 'American mathematician and naval officer who programmed the Harvard Mark I from 1944, led UNIVAC’s automatic programming work, and built the A-0 and FLOW-MATIC compilers that shaped COBOL. She retired from the Navy as a rear admiral in 1986.',
      knownFor: ['Harvard Mark I', 'A-0 compiler', 'FLOW-MATIC', 'COBOL'] },
    { id: 'aiken', name: 'Howard Aiken', born: 1900, died: 1973, lifeLabel: '1900–1973', inWeProgrammers: true,
      bio: 'Harvard physicist who conceived the Mark I (the Automatic Sequence Controlled Calculator), built by IBM and put to work in 1944. He ran it like a naval ship, with Grace Hopper as his second in command.',
      knownFor: ['Harvard Mark I'] },
    { id: 'holberton', name: 'Betty Holberton', born: 1917, died: 2001, lifeLabel: '1917–2001', inWeProgrammers: true,
      bio: 'One of the six original ENIAC programmers. At Eckert–Mauchly she wrote the UNIVAC Sort-Merge Generator, one of the first programs to write programs, and later helped define the COBOL and FORTRAN standards.',
      knownFor: ['ENIAC', 'Sort-Merge Generator', 'Flowcharting'] },
    { id: 'mauchly', name: 'John Mauchly', born: 1907, died: 1980, lifeLabel: '1907–1980', inWeProgrammers: true,
      bio: 'American physicist who co-designed ENIAC and UNIVAC with J. Presper Eckert. His 1946 Moore School lecture contains the first known description of binary search.',
      knownFor: ['ENIAC', 'UNIVAC', 'Binary search (first description)'] },
    { id: 'zuse', name: 'Konrad Zuse', born: 1910, died: 1995, lifeLabel: '1910–1995', inWeProgrammers: false,
      bio: 'German engineer who built programmable binary computers, the Z1 to Z4, largely on his own from 1936. During the war he designed Plankalkül, an early high-level language.',
      knownFor: ['Z3', 'Plankalkül', 'Breadth-first search (1945)'] },
    { id: 'wilkes', name: 'Maurice Wilkes', born: 1913, died: 2010, lifeLabel: '1913–2010', inWeProgrammers: true,
      bio: 'British computer scientist who led the building of EDSAC at Cambridge (1949), the first stored-program computer in regular service. He invented microprogramming and received the second Turing Award, in 1967.',
      knownFor: ['EDSAC', 'Microprogramming', 'Subroutine libraries'] },
    { id: 'wheeler', name: 'David Wheeler', born: 1927, died: 2004, lifeLabel: '1927–2004', inWeProgrammers: false,
      bio: 'Cambridge computer scientist who wrote EDSAC’s initial orders and invented the Wheeler jump for calling subroutines. His 1951 PhD is often called the first in computer science; decades later he co-invented the Burrows–Wheeler transform used in compression.',
      knownFor: ['Wheeler jump', 'Closed subroutines', 'Burrows–Wheeler transform'] },
    { id: 'ulam', name: 'Stanislaw Ulam', born: 1909, died: 1984, lifeLabel: '1909–1984', inWeProgrammers: true,
      bio: 'Polish-American mathematician at Los Alamos who co-designed the hydrogen bomb with Edward Teller. His question about the odds of winning at solitaire led to the Monte Carlo method.',
      knownFor: ['Monte Carlo method'] },
    { id: 'metropolis', name: 'Nicholas Metropolis', born: 1915, died: 1999, lifeLabel: '1915–1999', inWeProgrammers: false,
      bio: 'Greek-American physicist at Los Alamos who led the MANIAC computer project. He named the Monte Carlo method and co-authored the Metropolis sampling algorithm of 1953.',
      knownFor: ['Monte Carlo method (name)', 'Metropolis algorithm'] },
    { id: 'huffman', name: 'David Huffman', born: 1925, died: 1999, lifeLabel: '1925–1999', inWeProgrammers: false,
      bio: 'American electrical engineer who, as an MIT graduate student, invented optimal prefix codes in a 1951 term paper. He later taught at MIT and UC Santa Cruz and was known for mathematical paper folding.',
      knownFor: ['Huffman coding'] },
    { id: 'luhn', name: 'Hans Peter Luhn', born: 1896, died: 1964, lifeLabel: '1896–1964', inWeProgrammers: false,
      bio: 'German-American inventor at IBM. Besides proposing hashing in 1953, he devised the check-digit formula still used on credit card numbers and early automatic indexing methods.',
      knownFor: ['Hashing with chaining', 'Luhn check digit'] },
    { id: 'amdahl', name: 'Gene Amdahl', born: 1922, died: 2015, lifeLabel: '1922–2015', inWeProgrammers: true,
      bio: 'American computer architect at IBM who originated open addressing with linear probing in 1954 and was chief architect of System/360. He later founded Amdahl Corporation and gave his name to Amdahl’s law on the limits of parallel speed-up.',
      knownFor: ['Linear probing', 'IBM System/360', 'Amdahl’s law'] },
    { id: 'bauer', name: 'Friedrich L. Bauer', born: 1924, died: 2015, lifeLabel: '1924–2015', inWeProgrammers: false,
      bio: 'German computer scientist in Munich who, with Klaus Samelson, invented the stack method for translating formulas and helped design ALGOL. He also helped organise the 1968 NATO conference that popularised the phrase “software engineering”.',
      knownFor: ['Stack principle (Kellerprinzip)', 'ALGOL'] },
    { id: 'samelson', name: 'Klaus Samelson', born: 1918, died: 1980, lifeLabel: '1918–1980', inWeProgrammers: false,
      bio: 'German mathematician and computer scientist in Munich, co-inventor with Bauer of the stack principle for compiling. He served on the committees that designed ALGOL 58 and ALGOL 60.',
      knownFor: ['Stack principle (Kellerprinzip)', 'ALGOL'] },
    { id: 'newell', name: 'Allen Newell', born: 1927, died: 1992, lifeLabel: '1927–1992', inWeProgrammers: false,
      bio: 'American computer scientist and psychologist at RAND and Carnegie Mellon. With Shaw and Simon he created the IPL list-processing languages and the Logic Theorist, and he shared the 1975 Turing Award with Simon.',
      knownFor: ['IPL', 'Logic Theorist', 'List processing'] },
    { id: 'shaw', name: 'Cliff Shaw', born: 1922, died: 1991, lifeLabel: '1922–1991', inWeProgrammers: false,
      bio: 'RAND systems programmer who, with Newell and Simon, built the IPL languages and is often credited with inventing the linked list. He also created JOSS, one of the first interactive time-sharing languages.',
      knownFor: ['Linked lists', 'IPL', 'JOSS'] },
    { id: 'simon', name: 'Herbert A. Simon', born: 1916, died: 2001, lifeLabel: '1916–2001', inWeProgrammers: false,
      bio: 'American scientist at Carnegie Mellon who worked across economics, psychology and computing. He co-created the Logic Theorist and IPL, shared the 1975 Turing Award, and won the 1978 Nobel Prize in economics.',
      knownFor: ['Logic Theorist', 'IPL', 'Bounded rationality'] },
    { id: 'ford', name: 'Lester R. Ford Jr.', born: 1927, died: 2017, lifeLabel: '1927–2017', inWeProgrammers: false,
      bio: 'American mathematician at RAND. He co-proved the max-flow min-cut theorem with Fulkerson, gave the relaxation method behind Bellman–Ford, and with Selmer Johnson devised merge-insertion sorting.',
      knownFor: ['Ford–Fulkerson', 'Bellman–Ford', 'Merge insertion'] },
    { id: 'fulkerson', name: 'D. R. Fulkerson', born: 1924, died: 1976, lifeLabel: '1924–1976', inWeProgrammers: false,
      bio: 'American mathematician at RAND and Cornell who, with Ford, founded network flow theory. The Fulkerson Prize in discrete mathematics is named after him.',
      knownFor: ['Ford–Fulkerson', 'Network flows'] },
    { id: 'ted-harris', name: 'Theodore E. Harris', born: 1919, died: 2005, lifeLabel: '1919–2005', inWeProgrammers: false,
      bio: 'American mathematician at RAND, known for his work on branching processes. With General Frank Ross he modelled the Soviet rail network as a flow problem in 1955, the question that led Ford and Fulkerson to max flow.',
      knownFor: ['Max-flow problem (origin)', 'Branching processes'] },
    { id: 'dijkstra', name: 'Edsger W. Dijkstra', born: 1930, died: 2002, lifeLabel: '1930–2002', inWeProgrammers: true,
      bio: 'Dutch computer scientist and the Netherlands’ first professional programmer. He designed the shortest-path algorithm, co-wrote the first ALGOL 60 compiler, invented semaphores and the shunting-yard algorithm, and argued for structured programming; he received the 1972 Turing Award.',
      knownFor: ['Dijkstra’s algorithm', 'Structured programming', 'Semaphores', 'Shunting-yard algorithm'] },
    { id: 'kruskal', name: 'Joseph Kruskal', born: 1928, died: 2010, lifeLabel: '1928–2010', inWeProgrammers: false,
      bio: 'American mathematician and statistician at Bell Labs. Besides his 1956 minimum spanning tree algorithm he is known for Kruskal’s tree theorem and for multidimensional scaling.',
      knownFor: ['Kruskal’s algorithm'] },
    { id: 'prim', name: 'Robert C. Prim', born: 1921, died: 2021, lifeLabel: '1921–2021', inWeProgrammers: false,
      bio: 'American mathematician at Bell Labs whose 1957 paper on shortest connection networks gave the tree-growing minimum spanning tree algorithm that bears his name.',
      knownFor: ['Prim’s algorithm'] },
    { id: 'backus', name: 'John Backus', born: 1924, died: 2007, lifeLabel: '1924–2007', inWeProgrammers: true,
      bio: 'American computer scientist at IBM who led the team that built FORTRAN (1957), the first widely used high-level language with an optimising compiler. He devised the notation that became Backus–Naur Form and received the 1977 Turing Award.',
      knownFor: ['FORTRAN', 'Backus–Naur Form', 'Speedcoding'] },
    { id: 'naur', name: 'Peter Naur', born: 1928, died: 2016, lifeLabel: '1928–2016', inWeProgrammers: true,
      bio: 'Danish astronomer turned computer scientist who edited the ALGOL 60 report and adapted Backus’s notation for it. He received the 2005 Turing Award.',
      knownFor: ['ALGOL 60', 'Backus–Naur Form'] },
    { id: 'bellman', name: 'Richard Bellman', born: 1920, died: 1984, lifeLabel: '1920–1984', inWeProgrammers: false,
      bio: 'American applied mathematician at RAND who developed dynamic programming and the Bellman equation. He also published the Bellman–Ford shortest-path method and coined the phrase “curse of dimensionality”.',
      knownFor: ['Dynamic programming', 'Bellman–Ford', 'Bellman equation'] },
    { id: 'moore-ef', name: 'Edward F. Moore', born: 1925, died: 2003, lifeLabel: '1925–2003', inWeProgrammers: false,
      bio: 'American mathematician at Bell Labs and later the University of Wisconsin. He described breadth-first search for mazes, found the Bellman–Ford method independently, and gave his name to Moore machines in automata theory.',
      knownFor: ['Breadth-first search', 'Bellman–Ford–Moore', 'Moore machines'] },
    { id: 'mccarthy', name: 'John McCarthy', born: 1927, died: 2011, lifeLabel: '1927–2011', inWeProgrammers: true,
      bio: 'American computer scientist who coined “artificial intelligence” for the 1956 Dartmouth workshop and created LISP. He invented garbage collection, pushed for time-sharing, and received the 1971 Turing Award.',
      knownFor: ['LISP', 'Garbage collection', 'Artificial intelligence'] },
    { id: 'hoare', name: 'Tony Hoare', born: 1934, died: 2026, lifeLabel: '1934–2026', inWeProgrammers: false,
      bio: 'British computer scientist who invented quicksort and quickselect around 1960, created Hoare logic for proving programs correct, and developed Communicating Sequential Processes. He received the 1980 Turing Award, called his 1965 null reference a “billion-dollar mistake”, and died in March 2026.',
      knownFor: ['Quicksort', 'Quickselect', 'Hoare logic', 'CSP'] },
    { id: 'fredkin', name: 'Edward Fredkin', born: 1934, died: 2023, lifeLabel: '1934–2023', inWeProgrammers: false,
      bio: 'American computer scientist and physicist at MIT who named the trie in 1960. He later worked on reversible computing and digital physics.',
      knownFor: ['Trie', 'Reversible computing'] },
    { id: 'lehmer', name: 'D. H. Lehmer', born: 1905, died: 1991, lifeLabel: '1905–1991', inWeProgrammers: false,
      bio: 'American number theorist at Berkeley who built sieve machines and used early computers for mathematics. He coined the term “backtrack” and published an early binary search that works for any table size.',
      knownFor: ['Backtracking (name)', 'Binary search', 'Number theory'] },
    { id: 'karatsuba', name: 'Anatoly Karatsuba', born: 1937, died: 2008, lifeLabel: '1937–2008', inWeProgrammers: false,
      bio: 'Russian mathematician who, as a 23-year-old student in 1960, found the first multiplication method faster than the schoolbook n² steps. He went on to a career in analytic number theory.',
      knownFor: ['Karatsuba multiplication'] },
    { id: 'kolmogorov', name: 'Andrey Kolmogorov', born: 1903, died: 1987, lifeLabel: '1903–1987', inWeProgrammers: false,
      bio: 'Soviet mathematician who founded modern probability theory and algorithmic complexity. He supervised Tony Hoare’s machine-translation work in Moscow, posed the conjecture Karatsuba refuted, and taught Leonid Levin.',
      knownFor: ['Probability theory', 'Kolmogorov complexity'] },
    { id: 'adelson-velsky', name: 'Georgy Adelson-Velsky', born: 1922, died: 2014, lifeLabel: '1922–2014', inWeProgrammers: false,
      bio: 'Soviet and Israeli mathematician who co-invented the AVL tree in 1962. He co-developed the chess program Kaissa, world computer chess champion in 1974, and led the group in which Yefim Dinitz invented his flow algorithm.',
      knownFor: ['AVL tree', 'Kaissa'] },
    { id: 'landis', name: 'Evgenii Landis', born: 1921, died: 1997, lifeLabel: '1921–1997', inWeProgrammers: false,
      bio: 'Soviet mathematician at Moscow State University, known mainly for partial differential equations, and co-inventor of the AVL tree.',
      knownFor: ['AVL tree'] },
    { id: 'floyd', name: 'Robert W. Floyd', born: 1936, died: 2001, lifeLabel: '1936–2001', inWeProgrammers: false,
      bio: 'American computer scientist at Carnegie and Stanford. He published the Floyd–Warshall algorithm and linear-time heap construction, pioneered program verification, and received the 1978 Turing Award; the tortoise-and-hare cycle test is also attributed to him.',
      knownFor: ['Floyd–Warshall', 'Heap construction', 'Program verification', 'Cycle detection'] },
    { id: 'warshall', name: 'Stephen Warshall', born: 1935, died: 2006, lifeLabel: '1935–2006', inWeProgrammers: false,
      bio: 'American computer scientist who worked at Technical Operations and Massachusetts Computer Associates. His 1962 theorem on Boolean matrices gives the transitive-closure half of Floyd–Warshall.',
      knownFor: ['Warshall’s algorithm'] },
    { id: 'roy', name: 'Bernard Roy', born: 1934, died: 2017, lifeLabel: '1934–2017', inWeProgrammers: false,
      bio: 'French operations researcher who published the all-pairs transitive-closure method in 1959 and later founded a decision-analysis laboratory at Paris-Dauphine.',
      knownFor: ['Roy–Floyd–Warshall', 'Decision analysis'] },
    { id: 'williams-jwj', name: 'J. W. J. Williams', born: 1929, died: 2012, lifeLabel: '1929–2012', inWeProgrammers: false,
      bio: 'British-born computer scientist who worked at Elliott Brothers and later in Canada. His 1964 heapsort paper introduced the binary heap.',
      knownFor: ['Heapsort', 'Binary heap'] },
    { id: 'galler', name: 'Bernard Galler', born: 1928, died: 2006, lifeLabel: '1928–2006', inWeProgrammers: false,
      bio: 'American mathematician and computer scientist at the University of Michigan, co-designer of the MAD language and a president of the ACM. With Fischer he introduced the union-find forest in 1964.',
      knownFor: ['Union-find', 'MAD language'] },
    { id: 'fischer', name: 'Michael J. Fischer', born: 1942, died: null, lifeLabel: 'b. 1942', inWeProgrammers: false,
      bio: 'American computer scientist at Yale. He co-authored the 1964 union-find paper, the 1974 Wagner–Fischer edit-distance algorithm, and the FLP result that consensus is impossible in an asynchronous system with one faulty process.',
      knownFor: ['Union-find', 'Wagner–Fischer', 'FLP impossibility'] },
    { id: 'hartmanis', name: 'Juris Hartmanis', born: 1928, died: 2022, lifeLabel: '1928–2022', inWeProgrammers: false,
      bio: 'Latvian-American computer scientist at General Electric and Cornell who, with Stearns, founded computational complexity theory. They shared the 1993 Turing Award.',
      knownFor: ['Computational complexity', 'Time hierarchy'] },
    { id: 'stearns', name: 'Richard E. Stearns', born: 1936, died: null, lifeLabel: 'b. 1936', inWeProgrammers: false,
      bio: 'American computer scientist at General Electric and SUNY Albany, co-founder with Hartmanis of computational complexity theory.',
      knownFor: ['Computational complexity'] },
    { id: 'edmonds', name: 'Jack Edmonds', born: 1934, died: null, lifeLabel: 'b. 1934', inWeProgrammers: false,
      bio: 'American-Canadian mathematician who argued in 1965 that polynomial-time algorithms are the efficient ones, gave the blossom algorithm for matching, and proved the matroid–greedy theorem. He co-authored the Edmonds–Karp max-flow algorithm.',
      knownFor: ['Polynomial time as efficiency', 'Blossom algorithm', 'Edmonds–Karp', 'Matroid greedy theorem'] },
    { id: 'levenshtein', name: 'Vladimir Levenshtein', born: 1935, died: 2017, lifeLabel: '1935–2017', inWeProgrammers: false,
      bio: 'Soviet and Russian mathematician at the Keldysh Institute who worked on error-correcting codes. The edit distance he defined in 1965 bears his name.',
      knownFor: ['Levenshtein distance', 'Coding theory'] },
    { id: 'bohm', name: 'Corrado Böhm', born: 1923, died: 2017, lifeLabel: '1923–2017', inWeProgrammers: true,
      bio: 'Italian computer scientist who described one of the first compilers in his 1951 thesis and, with Jacopini, proved that sequence, selection and iteration suffice. He later worked on the lambda calculus.',
      knownFor: ['Structured program theorem', 'Early compiler'] },
    { id: 'jacopini', name: 'Giuseppe Jacopini', born: 1936, died: 2001, lifeLabel: '1936–2001', inWeProgrammers: true,
      bio: 'Italian computer scientist, co-author with Böhm of the 1966 structured program theorem.',
      knownFor: ['Structured program theorem'] },
    { id: 'wirth', name: 'Niklaus Wirth', born: 1934, died: 2024, lifeLabel: '1934–2024', inWeProgrammers: true,
      bio: 'Swiss computer scientist who designed Pascal, Modula-2 and Oberon and wrote Algorithms + Data Structures = Programs. As an editor he gave Dijkstra’s go-to letter its famous title; he received the 1984 Turing Award.',
      knownFor: ['Pascal', 'Stepwise refinement', 'Algorithms + Data Structures = Programs'] },
    { id: 'hart', name: 'Peter E. Hart', born: 1941, died: null, lifeLabel: 'b. 1941', inWeProgrammers: false,
      bio: 'American computer scientist at SRI who co-invented A* and worked out when its heuristic guarantees a shortest path. With Richard Duda he wrote an influential textbook on pattern recognition.',
      knownFor: ['A* search', 'Pattern classification'] },
    { id: 'nilsson', name: 'Nils J. Nilsson', born: 1933, died: 2019, lifeLabel: '1933–2019', inWeProgrammers: false,
      bio: 'American AI researcher at SRI and Stanford who worked on Shakey the robot, co-invented A* and the STRIPS planner, and wrote widely used AI textbooks.',
      knownFor: ['A* search', 'Shakey', 'STRIPS'] },
    { id: 'raphael', name: 'Bertram Raphael', born: 1936, died: null, lifeLabel: 'b. 1936', inWeProgrammers: false,
      bio: 'American AI researcher at SRI who suggested adding the cost so far to the estimate in A*, and worked on the Shakey project.',
      knownFor: ['A* search', 'Shakey'] },
    { id: 'knuth', name: 'Donald E. Knuth', born: 1938, died: null, lifeLabel: 'b. 1938', inWeProgrammers: true,
      bio: 'American computer scientist at Stanford and author of The Art of Computer Programming (from 1968). He made the analysis of algorithms a mathematical discipline, co-invented the Knuth–Morris–Pratt algorithm, created TeX, and received the 1974 Turing Award.',
      knownFor: ['The Art of Computer Programming', 'Analysis of algorithms', 'Knuth–Morris–Pratt', 'TeX'] },
    { id: 'ken-thompson', name: 'Ken Thompson', born: 1943, died: null, lifeLabel: 'b. 1943', inWeProgrammers: true,
      bio: 'American computer scientist at Bell Labs who created Unix with Dennis Ritchie, the B language, regular-expression search in text editors, and UTF-8 with Rob Pike. He later co-designed the Go language at Google.',
      knownFor: ['Unix', 'Regular-expression search', 'UTF-8', 'Go'] },
    { id: 'morris-jh', name: 'James H. Morris', born: 1941, died: null, lifeLabel: 'b. 1941', inWeProgrammers: false,
      bio: 'American computer scientist who found the linear-time string-search idea while writing a text editor at Berkeley in 1969. He later worked at Xerox PARC and Carnegie Mellon.',
      knownFor: ['Knuth–Morris–Pratt'] },
    { id: 'pratt', name: 'Vaughan Pratt', born: 1944, died: null, lifeLabel: 'b. 1944', inWeProgrammers: false,
      bio: 'Australian-American computer scientist at MIT and Stanford. He co-invented the Knuth–Morris–Pratt algorithm, primality certificates and Pratt parsing.',
      knownFor: ['Knuth–Morris–Pratt', 'Pratt certificates', 'Pratt parsing'] },
    { id: 'bayer', name: 'Rudolf Bayer', born: 1939, died: null, lifeLabel: 'b. 1939', inWeProgrammers: false,
      bio: 'German computer scientist, later at TU Munich, who co-invented the B-tree at Boeing in 1970 and the symmetric binary B-tree, forerunner of the red-black tree, in 1972.',
      knownFor: ['B-tree', 'Symmetric binary B-tree'] },
    { id: 'mccreight', name: 'Edward M. McCreight', born: null, died: null, lifeLabel: '20th century', inWeProgrammers: false,
      bio: 'American computer scientist who co-invented the B-tree with Bayer at Boeing and later worked at Xerox PARC on the Alto. In 1976 he also simplified the construction of suffix trees.',
      knownFor: ['B-tree', 'Suffix trees'] },
    { id: 'cook', name: 'Stephen Cook', born: 1939, died: null, lifeLabel: 'b. 1939', inWeProgrammers: false,
      bio: 'American-Canadian computer scientist at the University of Toronto whose 1971 paper introduced NP-completeness. He received the 1982 Turing Award.',
      knownFor: ['Cook–Levin theorem', 'NP-completeness'] },
    { id: 'levin', name: 'Leonid Levin', born: 1948, died: null, lifeLabel: 'b. 1948', inWeProgrammers: false,
      bio: 'Soviet-American computer scientist, a student of Kolmogorov, who discovered NP-completeness independently of Cook. He emigrated in 1978 and teaches at Boston University.',
      knownFor: ['Cook–Levin theorem', 'Universal search'] },
    { id: 'tarjan', name: 'Robert Tarjan', born: 1948, died: null, lifeLabel: 'b. 1948', inWeProgrammers: false,
      bio: 'American computer scientist at Princeton who designed linear-time depth-first-search algorithms, analysed union-find, and co-invented Fibonacci heaps and splay trees. He shared the 1986 Turing Award with John Hopcroft.',
      knownFor: ['Strongly connected components', 'Union-find analysis', 'Fibonacci heaps', 'Splay trees', 'Amortized analysis'] },
    { id: 'hopcroft', name: 'John Hopcroft', born: 1939, died: null, lifeLabel: 'b. 1939', inWeProgrammers: false,
      bio: 'American computer scientist at Cornell who, with Tarjan, showed how depth-first search yields linear-time graph algorithms such as planarity testing. They shared the 1986 Turing Award.',
      knownFor: ['Planarity testing', 'Hopcroft–Karp matching', 'Automata theory'] },
    { id: 'karp', name: 'Richard Karp', born: 1935, died: null, lifeLabel: 'b. 1935', inWeProgrammers: false,
      bio: 'American computer scientist at Berkeley who showed 21 problems NP-complete and co-invented the Edmonds–Karp, Hopcroft–Karp and Rabin–Karp algorithms. He received the 1985 Turing Award.',
      knownFor: ['Karp’s 21 problems', 'Edmonds–Karp', 'Rabin–Karp'] },
    { id: 'liskov', name: 'Barbara Liskov', born: 1939, died: null, lifeLabel: 'b. 1939', inWeProgrammers: true,
      bio: 'American computer scientist at MIT who put abstract data types into practice with the CLU language and gave her name to the substitution principle. She received the 2008 Turing Award.',
      knownFor: ['Abstract data types', 'CLU', 'Liskov substitution principle'] },
    { id: 'rabin', name: 'Michael O. Rabin', born: 1931, died: null, lifeLabel: 'b. 1931', inWeProgrammers: false,
      bio: 'Israeli computer scientist, long at Harvard and the Hebrew University, who introduced nondeterministic automata with Dana Scott, sharing the 1976 Turing Award, and made randomised algorithms mainstream with the Miller–Rabin primality test and Rabin–Karp string matching.',
      knownFor: ['Miller–Rabin', 'Rabin–Karp', 'Nondeterministic automata'] },
    { id: 'robert-boyer', name: 'Robert S. Boyer', born: 1946, died: null, lifeLabel: 'b. 1946', inWeProgrammers: false,
      bio: 'American computer scientist at the University of Texas, co-inventor of the Boyer–Moore string search and the Boyer–Moore theorem prover.',
      knownFor: ['Boyer–Moore string search', 'Automated theorem proving'] },
    { id: 'j-strother-moore', name: 'J Strother Moore', born: 1947, died: null, lifeLabel: 'b. 1947', inWeProgrammers: false,
      bio: 'American computer scientist at the University of Texas, co-inventor of Boyer–Moore string search and of the ACL2 theorem prover used to verify processor designs.',
      knownFor: ['Boyer–Moore string search', 'ACL2'] },
    { id: 'bentley', name: 'Jon Bentley', born: 1953, died: null, lifeLabel: 'b. 1953', inWeProgrammers: false,
      bio: 'American computer scientist at Carnegie Mellon and Bell Labs who invented the segment tree and the k-d tree and wrote the Programming Pearls columns and books.',
      knownFor: ['Segment tree', 'k-d tree', 'Programming Pearls'] },
    { id: 'guibas', name: 'Leonidas Guibas', born: 1949, died: null, lifeLabel: 'b. 1949', inWeProgrammers: false,
      bio: 'Greek-American computer scientist at Stanford who co-invented red-black trees and has worked widely in computational geometry and graphics.',
      knownFor: ['Red-black trees', 'Computational geometry'] },
    { id: 'sedgewick', name: 'Robert Sedgewick', born: 1946, died: null, lifeLabel: 'b. 1946', inWeProgrammers: false,
      bio: 'American computer scientist at Princeton, a student of Knuth, who co-invented red-black trees, analysed quicksort in depth, and wrote the Algorithms textbooks.',
      knownFor: ['Red-black trees', 'Quicksort analysis', 'Algorithms (textbook)'] },
    { id: 'vitter', name: 'Jeffrey Vitter', born: 1955, died: null, lifeLabel: 'b. 1955', inWeProgrammers: false,
      bio: 'American computer scientist known for reservoir sampling, external-memory algorithms and data compression, who later led universities as provost and chancellor.',
      knownFor: ['Reservoir sampling', 'External-memory algorithms'] },
    { id: 'godel', name: 'Kurt Gödel', born: 1906, died: 1978, lifeLabel: '1906–1978', inWeProgrammers: true,
      bio: 'Austrian-American logician whose 1931 incompleteness theorems showed that no consistent formal system of arithmetic can prove every truth. His 1956 letter to von Neumann anticipated the P versus NP question.',
      knownFor: ['Incompleteness theorems', 'Letter to von Neumann (1956)'] },
    { id: 'dahl', name: 'Ole-Johan Dahl', born: 1931, died: 2002, lifeLabel: '1931–2002', inWeProgrammers: true,
      bio: 'Norwegian computer scientist who implemented SIMULA and moved its data from the stack to a garbage-collected heap, leading to classes and objects. He shared the 2001 Turing Award with Nygaard.',
      knownFor: ['SIMULA', 'Object-oriented programming'] },
    { id: 'nygaard', name: 'Kristen Nygaard', born: 1926, died: 2002, lifeLabel: '1926–2002', inWeProgrammers: true,
      bio: 'Norwegian operations researcher who conceived SIMULA to model customers queueing at stations, and co-created object-oriented programming with Dahl. He was also active in politics, including Norway’s “No to EU” campaign.',
      knownFor: ['SIMULA', 'Object-oriented programming', 'Simulation'] },
    { id: 'frances-allen', name: 'Frances Allen', born: 1932, died: 2020, lifeLabel: '1932–2020', inWeProgrammers: false,
      bio: 'American computer scientist at IBM who laid much of the foundation of compiler optimisation, including control-flow analysis on graphs of basic blocks. In 2006 she became the first woman to receive the Turing Award.',
      knownFor: ['Control-flow analysis', 'Optimising compilers'] },
    { id: 'margaret-hamilton', name: 'Margaret Hamilton', born: 1936, died: null, lifeLabel: 'b. 1936', inWeProgrammers: false,
      bio: 'American computer scientist who led the MIT Instrumentation Laboratory team that wrote the on-board flight software for Apollo. She championed software engineering as a discipline and received the Presidential Medal of Freedom in 2016.',
      knownFor: ['Apollo flight software', 'Software engineering'] },
    { id: 'laning', name: 'J. Halcombe Laning', born: 1920, died: 2012, lifeLabel: '1920–2012', inWeProgrammers: true,
      bio: 'MIT engineer who co-wrote George, an early algebraic compiler for Whirlwind, and designed the priority-driven executive of the Apollo Guidance Computer.',
      knownFor: ['Apollo Guidance Computer executive', 'Algebraic compiler for Whirlwind'] }
  ];

  var api = {
    eras: ERAS,
    tags: TAGS,
    events: events,
    people: people,
    eraOf: function (year) {
      for (var i = 0; i < ERAS.length; i++) {
        var e = ERAS[i];
        if ((e.from === null || year >= e.from) && (e.to === null || year <= e.to)) return e.id;
      }
      return null;
    },
    personById: function (id) { for (var i = 0; i < people.length; i++) if (people[i].id === id) return people[i]; return null; },
    eventsForLesson: function (lessonId) { return events.filter(function (e) { return e.lessons.indexOf(lessonId) !== -1; }); },
    eventsForPerson: function (personId) { return events.filter(function (e) { return e.people.indexOf(personId) !== -1; }); }
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VDSA_HISTORY = api;
}(typeof window !== 'undefined' ? window : null));
