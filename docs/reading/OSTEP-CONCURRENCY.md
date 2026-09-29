# OSTEP: Concurrency and the following persistence interface chapters

**Source read:** the assigned physical-PDF span, pages 313–500, represented in `/tmp/dsa-foundations/ostep.txt` by the sequential text slice from the chapter 27 opening through the chapter 39 summary (source lines 15,898–25,879; about 75,030 whitespace-delimited words; 186 form-feed delimiters). This includes the chapter prose, summaries, sidebars, code listings, diagrams/tables, and homework prompts in that slice. The chapter 39 bibliography starts after this slice; it was outside the assigned main-text coverage. This is an original study guide, not a replacement for the source.

## What this span teaches

Concurrency starts with one hard fact: a thread may be paused between any two instructions. Correct programs therefore protect a shared-state update as a unit, wait for state rather than for a notification, and impose ordering where an order matters. The later chapters begin persistence: devices turn requests into durable bytes, while file systems turn raw blocks into named files and directories.

## 27. Thread API

**Mechanism.** POSIX `pthread_create()` starts a routine with one `void *` argument; a `pthread_t` names the created thread. `pthread_join()` waits for a named thread and can collect its returned pointer. A mutex provides mutual exclusion. A condition variable lets a thread sleep until protected state may have changed: wait releases the mutex atomically and reacquires it before returning.

**Rules to retain.** Initialize every mutex/CV, check API return codes, and compile with `-pthread`. Do not return an address of a thread's stack local: that object disappears on return. A shared flag with busy-waiting wastes CPU and is error prone; condition variables pair a predicate (`ready`) with a lock and a `while` loop.

**Hands-on.** Write one thread that receives a heap-allocated argument structure and returns a heap-allocated result; join and free it. Then replace a parent spinning on `done` with a mutex, CV, `while (!done) wait`, and a child that sets `done` before signaling.

**Figures/text coverage.** Listings show thread creation, value packing/unpacking, a dangerous stack return, mutex initialization/wrappers, and the CV pattern. The chapter's guidance and Helgrind exercises are text/homework, not a graphical algorithm.

## 28. Locks

**Mechanism.** A lock makes a critical section appear atomic: exactly one owner may enter. A simple load-then-store flag fails because two threads can both observe “free” before either stores “held.” Hardware atomic read-modify-write operations close that gap: test-and-set, compare-and-swap, load-linked/store-conditional, and fetch-and-add.

**Trade-offs.** Evaluate locks for mutual exclusion, fairness/starvation, and cost under no contention, one CPU, and many CPUs. Test-and-set makes a correct spin lock, but a waiting thread burns cycles and may starve. Ticket locks assign an ordered ticket, improving fairness but still spin. Disabling interrupts works only in restricted single-CPU kernel contexts and is unsuitable as a general user-level lock.

**Sleeping locks.** `yield()` lowers wasted spinning but still causes needless context switches and offers no fairness. A waiter queue plus `park()`/`unpark()` sleeps contenders and hands the lock directly to a chosen successor. The handoff must avoid the wakeup-before-sleep race (`setpark()` in the Solaris example). Linux futexes provide a fast uncontended atomic path and kernel-assisted waiting under contention. A two-phase lock spins briefly, then sleeps.

**Hands-on.** Simulate two threads updating a counter with a deliberately placed pause between load and store; record the lost update. Run the same experiment under a mutex. For a timing experiment, compare a spin lock and mutex with a short versus intentionally long critical section.

**Figures/text coverage.** Figures include the broken flag interleaving, atomic-instruction pseudocode, spin/ticket locks, queued park/unpark lock, and a Linux futex mutex. The priority-inversion discussion is prose with a scheduling scenario, not a measured figure.

## 29. Lock-based concurrent data structures

**Mechanism.** The safe starting point is one lock per data structure operation. It is often all that is needed. More locks may enable parallel operations, but their acquisition/release overhead and more complicated failure paths can make the result slower or less reliable.

**Examples.** A single locked counter is precise but scales badly because all increments contend. An approximate counter keeps a lock and local count per CPU, periodically transfers local values to a global count, and trades a bounded reporting error for scalable updates. A list can use one lock; hand-over-hand locking locks the next node before releasing the current one, but its per-node overhead often loses. A queue with separate head and tail locks lets enqueue and dequeue proceed together; the dummy node separates those paths. A hash table with one lock per bucket scales well when operations spread across buckets.

**Hands-on.** Benchmark a single mutex counter as thread count rises, then implement local counters with several flush thresholds. State the acceptable maximum lag before choosing a threshold. Implement the single-lock queue before attempting split locks, then measure both.

**Figures/text coverage.** Listings cover each implementation. Performance plots compare precise/approximate counters and a singly locked list against a bucket-locked hash table; the book's conclusions depend on those displayed benchmark setups, not a universal speed claim.

## 30. Condition variables

**Mechanism.** A CV is a waiting queue for a predicate about shared state, not the state itself. The waiter locks, tests the predicate in a `while`, and atomically releases the lock while sleeping. A changer locks, changes the predicate, signals or broadcasts, and unlocks. A wakeup only means “recheck”: Mesa semantics do not reserve the condition for the awakened thread.

**Bounded buffer.** Producers must wait while the buffer is full; consumers must wait while it is empty. One CV plus `if` fails when a woken consumer finds another consumer already took the item. Changing `if` to `while` fixes that case, but one CV can wake the wrong class of sleeper and leave everyone asleep. Separate `empty` and `fill` CVs direct wakeups correctly. A ring buffer adds `fill_ptr`, `use_ptr`, and `count` for multiple slots.

**Covering conditions.** When a signaler cannot know which request is now satisfiable, use `broadcast()` so each waiter rechecks. This is correct but can wake many threads that immediately sleep again.

**Hands-on.** Build a one-slot producer/consumer program and first use `if`; add two consumers until it fails. Change to `while`, then demonstrate the single-CV deadlock. Finish with two CVs and a small ring buffer. Log `count`, thread id, and each wait/signal to see the predicate evolve.

**Figures/text coverage.** The chapter supplies detailed scheduler-state tables for both broken buffer solutions and listings for each repair. The covering-condition allocator is a text/listing example, not proof that broadcasting is cheap.

## 31. Semaphores

**Mechanism.** A semaphore is an integer changed atomically by `sem_wait()` (decrement; block when unavailable) and `sem_post()` (increment; wake one waiter if present). Initialize to **1** for a binary semaphore used as a mutex; initialize to **0** for an event that must happen before a wait can finish. A post that happens early remains counted, so the ordering form avoids lost notifications.

**Patterns.** A bounded buffer uses `empty` (initially capacity), `full` (initially zero), and a binary `mutex` guarding only the buffer/index update. Waiting for `empty` or `full` while holding that mutex deadlocks because the thread that could change the count cannot enter. Reader-writer locks use a reader count: the first reader blocks writers and the last reader releases them; this simple version can starve writers. Dining philosophers shows a circular wait; changing one philosopher's acquisition order breaks the cycle.

**Implementation.** The chapter's “Zemaphore” is built from one mutex, one CV, and a nonnegative availability count. Building the reverse abstraction, a correct CV from semaphores, is substantially trickier.

**Hands-on.** Implement parent/child rendezvous with two zero-valued semaphores. Then implement a fixed-size queue and move the mutex acquisition inside the `empty`/`full` waits. Trace the three semaphore values after every operation.

**Figures/text coverage.** Figures include semaphore state traces, correct/incorrect bounded-buffer layouts, a reader-writer lock, philosopher fork diagram, and the CV-based implementation. The traces explain a model where negative values count waiters; the later Zemaphore intentionally uses a different internal invariant.

## 32. Common concurrency problems

**Non-deadlock bugs.** An atomicity violation lets another thread split operations that must act as one, such as “check pointer, then use pointer.” Lock every access governed by that invariant. An order violation lets B run before required action A, such as a new thread observing an object before its creator has published it. Use a protected state flag and CV/semaphore to establish the order.

**Deadlock.** It requires all four Coffman conditions: mutual exclusion, hold-and-wait, no preemption, and circular wait. A wait-for graph cycle exposes the dependency. Prevention can impose a total or partial lock order; acquire all needed locks under a global acquisition lock; release and retry with `trylock()`; or avoid locks with atomic retry-based structures. Retry can livelock, so randomized delay may be needed.

**Other strategies.** A scheduler with complete future lock-demand knowledge can avoid unsafe schedules, but that assumption is rare and costs parallelism. Systems may instead detect cycles and recover, which can be sensible when failures are rare and recovery is viable.

**Hands-on.** Make two functions acquire `A,B` and `B,A`; use a barrier to reproduce the deadlock. Fix it with a documented address or rank order. Next, replace the second acquisition with `trylock()`, count retries, and observe possible wasted work under contention.

**Figures/text coverage.** The chapter has a real-bug count table, a deadlock dependency graph, scheduling tables, and short code cases. Its bug proportions describe the studied applications, not all concurrent software.

## 33. Event-based concurrency (advanced)

**Mechanism.** A single event loop calls `getEvents()` and processes each ready event serially. `select()`/`poll()` report which file descriptors are ready, so choosing the next handler is explicit application scheduling. On one CPU, one handler at a time means no lock-protected shared-state interleaving inside that loop.

**Constraint.** An event handler must not block. A blocking disk read freezes the complete server. Asynchronous I/O issues the request and returns; later a completion query or signal indicates completion. The program must preserve the next step's state itself, often as a continuation indexed by a request/file descriptor. Threads naturally retain that state on their stacks.

**Limits.** Multiple cores reintroduce parallel handlers and synchronization. Page faults and API changes can introduce hidden blocking. Network readiness and disk AIO also may have separate, awkward APIs. Hybrid event loops plus thread pools are a practical response.

**Hands-on.** Make a small single-thread TCP server that returns a fixed response. Add `select()` and serve several connections. Then make one handler intentionally sleep: observe that every client stalls. Refactor the work into a queued completion state machine.

**Figures/text coverage.** The main figure is a `select()` loop. The chapter also includes an AIO control-block listing and a signal example; it does not provide a full production server implementation.

## 34. Summary dialogue on concurrency

**Takeaway.** Keep interactions simple, use known patterns such as mutexes and producer/consumer queues, and introduce concurrency only when it earns its cost. Where possible, prefer a constrained parallel model such as MapReduce over hand-managed shared-state synchronization.

**Hands-on.** Before adding threads to a task, write down the shared state, required predicates, lock order, and the measurement that justifies parallelism. If any item is unclear, simplify the design first.

**Figures/text coverage.** This is prose dialogue; it has no mechanism figure.

## 35. Dialogue on persistence

**Takeaway.** Persistence means retaining information through crashes, power loss, and device failure. It introduces the next set of storage abstractions rather than a new algorithm.

**Hands-on.** Compare an in-memory value with a file written and synced, then consider which one survives process exit and a power loss.

**Figures/text coverage.** Prose dialogue only.

## 36. I/O devices

**Mechanism.** A system connects CPU, memory, and devices through buses. A canonical device offers status, command, and data registers. The OS polls status, transfers data, starts a command, and learns completion; programmed I/O (PIO) makes the CPU copy data itself.

**Efficiency.** Interrupts let the issuing process sleep and the CPU run other work until a device completes. Polling may win for a fast device or high interrupt rate; hybrids poll briefly then enable interrupts. Interrupt coalescing trades latency for lower overhead. DMA lets a controller move data between memory and device after the OS describes source, destination, and length.

**Abstraction.** Device registers may use dedicated I/O instructions or memory-mapped loads/stores. A driver hides device protocol details behind a generic OS layer; this makes file systems device-neutral, although it can hide useful device-specific capabilities.

**Hands-on.** Draw a timeline for PIO versus DMA for a 4 KiB transfer and label when the CPU is free. In a Linux environment, inspect `/sys` or a device listing and identify driver, block device, and file-system layer for one attached disk.

**Figures/text coverage.** Architecture, canonical-device, CPU/disk timelines, file-system stack, IDE-register map, and simplified xv6 IDE-driver listing are covered. The IDE case is illustrative of its protocol, not a current universal driver design.

## 37. Hard disk drives

**Mechanism.** A hard drive exposes numbered sectors (commonly 512 bytes); a sector write is the stated atomic unit, so larger writes can tear on failure. Magnetic platters rotate under heads moved by an arm. Request time is approximately **seek + rotational delay + transfer**. Track skew helps sequential access across tracks; outer zones contain more sectors; an on-drive cache can prefetch and buffer writes.

**Performance.** Sequential work amortizes positioning and approaches transfer bandwidth; small random work spends most time seeking and waiting for rotation. Write-back cache can acknowledge before media persistence, which matters for correctness. Disk schedulers use SSTF/NBF for nearby requests, but risk starvation; SCAN/C-SCAN sweep across tracks to bound waits. SPTF also considers rotation, but modern drives have better geometry/head-position knowledge and often schedule a batch internally. Merging adjacent requests reduces work; delaying an I/O can sometimes admit a better request.

**Hands-on.** Measure sequential and random reads of the same total size with a tool appropriate to a disposable test file. Predict the gap using request size and the timing formula, then compare. Do not use a benchmark mode that overwrites important data.

**Figures/text coverage.** Geometry/seek/track-skew diagrams, timing calculations, performance comparison, and scheduling diagrams support the model. Values shown are example-drive measurements and should not be treated as modern-device specifications.

## 38. RAID

**Mechanism.** RAID presents many disks as one logical block array and maps each logical request to physical requests. Compare designs by useful capacity, tolerated failures, single-request latency, and steady-state sequential/random throughput. The chapter uses `S` for a disk's sequential rate, `R` for random rate, `N` disks, and `B` blocks/disk.

**Levels.** RAID 0 stripes blocks: capacity `N·B`, strong parallel performance, zero disk-failure tolerance. RAID 1 mirrors copies: capacity `(N·B)/2`, guaranteed tolerance of one disk failure, excellent random reads, and roughly half-array write bandwidth. RAID 4 stores a dedicated XOR parity disk: capacity `(N−1)·B`, one-failure tolerance, but small writes need old data + old parity reads and new data + new parity writes; the parity disk serializes them. RAID 5 rotates parity, retaining RAID 4 capacity/failure behavior while spreading the small-write work. Full-stripe writes compute parity from all new data and avoid read-modify-write overhead.

**Durability detail.** Updating multiple disks has a consistent-update problem if a crash leaves replicas/parity disagreeing. A write-ahead log, usually in protected nonvolatile memory in a hardware RAID, records enough information for recovery.

**Hands-on.** Given five disks and a one-block stripe, map logical blocks for RAID 0 and RAID 5. For a one-block RAID-5 overwrite, enumerate the four physical I/Os. Then contrast it with a full-stripe write.

**Figures/text coverage.** Layout diagrams, mapping equations, parity examples, and a comparison table are covered. The table deliberately simplifies real drive latency and controller behavior; it is a reasoning model.

## 39. Files and directories

**Mechanism.** A file is a byte array identified internally by an inode number. A directory maps human-readable names to inode numbers, producing a tree rooted at `/`. `open()` returns a process-private file descriptor, a capability used by `read()`, `write()`, `lseek()`, `fsync()`, and `close()`; descriptors 0, 1, and 2 conventionally denote standard input, output, and error.

**Open-file state.** A descriptor points to a system-wide open-file-table entry holding the inode, access mode, current offset, and reference count. Reads/writes advance that offset; `lseek()` changes only this in-memory offset, not a physical disk head. Separate `open()` calls have separate offsets. `fork()` and `dup()` share an open-file-table entry and therefore share its offset.

**Durability and naming.** `write()` may be buffered; `fsync(fd)` waits until a file's dirty contents reach storage. For a newly created file, syncing its parent directory may also be necessary to make the name durable. `rename()` supports the standard safe replacement pattern: write/sync a temporary file, then atomically rename it into place. `stat()` exposes metadata. `unlink()` removes a name-to-inode link; data is freed only after the inode's hard-link count reaches zero. A symbolic link is a separate file containing a pathname and can dangle.

**Directories and access.** `mkdir()`, `opendir()`/`readdir()`, and `rmdir()` manage directory metadata; an `rmdir()` target must be empty apart from `.` and `..`. Permission bits apply read/write/execute to owner, group, and others; directory execute controls traversal. ACLs express more specific policies. `mkfs` creates a file system and `mount` attaches its root at a directory, merging multiple file systems into one namespace.

**Hands-on.** Use a throwaway directory. Trace `open`, `read`, `write`, and `close` for a tiny program. Open a file twice and show independent offsets; then use `dup()` and show the shared offset. Create a hard link and a symbolic link, delete the original name, and explain why only one remains usable. Finally, use a temporary-file + `fsync` + `rename` update sequence.

**Figures/text coverage.** The directory tree and parent/child open-file-table diagrams, API traces, link examples, permission output, and mount example are covered. The TOCTTOU sidebar is an attack pattern explaining why a check and later use of a pathname can disagree; it is not a complete mitigation recipe.

## Reusable checklist

1. Name the shared variables and their invariants.
2. Associate each predicate with its mutex and wait in a `while` loop.
3. Define lock acquisition order before taking multiple locks.
4. Measure before replacing a simple lock with a finer-grained design.
5. For persistent updates, identify the data, directory metadata, ordering, and exact point at which the application may claim durability.
