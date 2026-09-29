# OSTEP: Storage and Distribution (Chapters 40-51)

This is a mechanism-first companion to *Operating Systems: Three Easy Pieces*.
Read a storage system as two things: **persistent data structures** and the
**protocol that changes them safely**. A file system is therefore much closer to
a durable graph than to a magical folder.

## 40. File-System Implementation

- A volume has a superblock (layout facts), inode bitmap, data bitmap, inode
  table, and data region. An inode is the metadata record for one file: owner,
  permissions, size, timestamps, link count, and pointers to content.
- Direct pointers make small files cheap. Indirect, double-indirect, and
  triple-indirect pointer blocks trade additional lookup I/O for much larger
  files. Extents store `(first block, length)` instead; they are compact when
  a file is contiguous.
- A directory is a file whose payload maps `name -> inode number`; it is not a
  special container outside the file system. A linear directory needs a scan;
  a B-tree directory improves large-directory lookup and insertion.
- Opening `/a/b` walks root inode -> root directory data -> `a` inode -> `a`
  directory data -> `b` inode. Reading needs the inode and the requested data
  block. Allocation bitmaps are **not** consulted for an ordinary read.
- Creating or extending a file changes several structures: allocation bitmap,
  inode, payload, and often parent-directory data and inode. That fan-out is
  why caching and write buffering matter.
- The unified page cache keeps hot metadata and contents in RAM. Delayed writes
  batch, reorder, or eliminate I/O, but writes still in memory are lost on a
  crash. `fsync()` asks for durable completion.

**DSA correction:** an inode is an index record, not the file’s name. A path is
a sequence of dictionary lookups; file block lookup is a shallow, deliberately
unbalanced tree optimized for the many-small-files distribution.

## 41. Locality and the Fast File System (FFS)

- Old Unix scattered inode, data, and free blocks, treating a disk like RAM.
  That caused seeks, rotational delay, and fragmentation.
- FFS divides the volume into cylinder groups (modern descendants call them
  block groups). Each has local inodes, data blocks, allocation bitmaps, and a
  superblock copy. The placement rule is simple: keep related objects near.
- Place a new directory where inode capacity is available; place its files near
  that directory and their inode near their data. This reduces path traversal
  and sibling-file seeks.
- A very large file would consume one group, so the large-file exception spreads
  later chunks across groups. Chunk size amortizes a seek over enough transfer.
- FFS used fragments for small files, and historical rotationally staggered
  placement when host software could not issue the next request in time.

**DSA connection:** locality is an invariant about a graph embedding: edges
frequently traversed together should have nearby physical targets. It is a
weighted placement problem, not merely a free-list choice.

## 42. Crash Consistency: fsck and Journaling

- Appending one block can update data, an inode, and a bitmap. A crash between
  writes leaves dangling pointers, leaked space, or valid metadata that points
  at stale data. Persistence needs an atomic-looking transition despite
  sector-at-a-time completion.
- `fsck` reconstructs consistency by scanning the whole volume: sanity-check
  the superblock, rebuild allocation knowledge from inodes, check types, link
  counts, duplicate/bad pointers, and directory structure. It repairs metadata,
  not necessarily application data; it is slow because recovery is O(volume).
- A journal is write-ahead logging: write transaction begin plus new blocks to
  the log, force a commit record only after they arrive, then checkpoint those
  blocks to their home locations. Recovery replays only committed transactions,
  so work scales with log size.
- Data journaling logs data and metadata. Metadata journaling logs metadata;
  ordered mode forces file data home before its metadata commit, preventing new
  metadata from exposing garbage. Revoke records stop old journal entries from
  overwriting a reused block during replay.
- Alternatives: soft updates enforce dependency order; copy-on-write writes a
  new tree then atomically advances its root; backpointers let readers detect a
  broken forward reference.

**Hands-on check:** for every multi-block update, list the durable states after
each prefix of writes. If any prefix breaks a pointer/ownership invariant,
you need ordering, logging, COW, or repair.

## 43. Log-Structured File Systems (LFS)

- LFS buffers data and metadata into a memory segment, then appends the whole
  segment to unused disk space. Large sequential writes amortize positioning
  costs and avoid RAID small-write penalties.
- Append-only placement moves each inode. The inode map (imap) maps stable
  inode number to its latest disk address. A fixed checkpoint region points to
  current imap pieces, giving recovery a known starting point.
- The cost is garbage: overwritten blocks are old versions, not immediately
  reusable. A cleaner reads partially used segments, keeps live blocks, writes
  them compactly elsewhere, and frees old segments.
- Segment summaries store `(inode number, file offset)` for each block. To test
  liveness, find the current inode through the imap and check whether its
  pointer for that offset still names this physical address.
- Cleaning policy matters: clean cold segments sooner and hot segments later
  when later overwrites will make more of a hot segment dead. Two checkpoint
  regions with timestamped start/end records protect checkpoint updates; roll
  forward recovers valid later segments after a crash.

**DSA correction:** the imap is an indirection table, like a moving-object
handle table. It preserves a stable logical key while physical location changes.
Garbage collection is compaction with reachability decided from current roots.

## 44. Flash-Based SSDs

- NAND has cells arranged as pages inside much larger erase blocks. Reads are
  page-granular and quick; a page can be programmed once only after its entire
  erase block is erased. Erase is slow and destroys every page in that block.
- SLC, MLC, and TLC trade density for performance/endurance margin. Repeated
  program/erase cycles wear blocks; reads/programs can also disturb neighbors.
- An SSD presents a familiar logical block interface through a flash translation
  layer (FTL), which maps logical block addresses to physical pages.
- A naive in-place FTL must read live neighbors, erase their block, and rewrite
  them for a small overwrite. Log-structured FTLs instead append writes,
  update the mapping, and reclaim invalid pages later. This shifts the cost to
  garbage collection and **write amplification**.
- Fine-grained page mappings are flexible but large; block mappings are small
  but costly to update; hybrid mappings/caching balance those costs. Wear
  leveling also migrates long-lived data so every erase block gets a fair share
  of wear. `trim` tells the device which logical content is dead.

**DSA connection:** the FTL is another address-translation map. The key
operation is not overwrite; it is `logical key -> newest physical version`,
plus a collector that reclaims unreferenced versions.

## 45. Data Integrity and Protection

- Whole-disk failures are only one failure model. Latent sector errors, silent
  corruption, misdirected writes, and acknowledged-but-lost writes also occur.
- A checksum detects accidental corruption by storing a function of data and
  rechecking it on read. Additive and XOR checks are cheap but weak; Fletcher
  and CRCs detect more patterns. A checksum detects; redundancy enables repair.
- Store checksums with data for fewer I/Os, or separately for independent
  failure domains. Include the expected physical identity (disk and block) to
  detect a valid block written to the wrong location.
- A lost write can leave old data with a valid old checksum and identity.
  Read-after-write detects it at high cost; a checksum in an updated parent
  inode/indirect block can reveal a data block that stayed old.
- Scrubbing reads and verifies cold data periodically before all replicas rot.
  Its costs are checksum CPU, checksum space, extra reads, and any repair I/O.

**DSA correction:** hashes/checksums are evidence, not proof of equality. Their
usefulness depends on failure model, placement, and what trusted copy permits
repair.

## 46-47. Persistence and Distribution Dialogues

- Persistence adds recovery: data must remain meaningful across a restart, not
  merely be reachable during one process lifetime.
- The same principles survive hardware changes: locality, batching,
  indirection, replication, retries, and explicit failure handling.

## 48. Distributed Systems

- A distributed system joins components that independently fail. The service
  can remain available because replication and recovery hide individual faults.
- Communication is fundamentally unreliable: bit corruption, failed links or
  hosts, and full router/receiver buffers all lose packets. UDP exposes this
  directly; checksums can detect corruption but cannot ensure delivery.
- Reliable delivery adds acknowledgment, timeout, and retransmission. The hard
  case is a lost reply: the client cannot distinguish “request lost” from
  “operation happened, reply lost.” Sequence numbers plus duplicate suppression
  give at-most-once behavior for a server that retains request history.
- RPC packages a request/reply protocol as a procedure call, but it does not
  erase network reality. Marshaling turns arguments into bytes; a stub sends;
  timeout/retry semantics and idempotence must be part of the API contract.

**Hands-on rule:** whenever a retry follows a timeout, enumerate both worlds:
the request never ran, and it ran but its answer vanished. Design the operation
to be idempotent or give it a request ID the server remembers.

## 49. Sun's Network File System (NFS)

- A distributed file system has client-side file-system code, a file server,
  and server disks. NFS chose a stateless server so a server reboot does not
  require reconstructing client open-file state.
- NFSv2 identifies objects with opaque file handles and exposes RPC operations
  such as lookup, read, write, create, remove, and getattr. Handles make a
  request self-contained and support fast crash recovery.
- Statelessness requires idempotent operations or client-visible retry safety.
  A repeated write at the same offset is safe; an operation such as create needs
  care around duplicate requests and result semantics.
- Client caching improves reads. NFS checks attributes periodically and flushes
  dirty data on close. This creates close-to-open consistency: a client opening
  after another client closes should see the update, while concurrent access can
  observe stale cache data.

**DSA connection:** a file handle is a stable capability/key, not a pathname.
Path lookup is repeated key discovery; subsequent remote operations use the
resolved key directly.

## 50. The Andrew File System (AFS)

- AFS targets many clients per server by caching whole files on client local
  disk, then using server callbacks. Its unit of caching is a file, unlike
  NFS's blocks.
- AFSv1 checked validity too often and constrained scale. AFSv2 lets a server
  promise a cached copy remains valid; on another client's modification, it
  breaks callbacks to holders. Clients send changed whole files on close.
- Callback state makes server crashes visible: clients must discard or revalidate
  cached files after a restart. This is the price of stronger scalable caching.
- Whole-file caching is excellent for sequential, mostly unshared files and
  rereads that fit local disk. It is poor for sparse access or small edits to a
  large existing file, where fetching/storing the whole file is wasted work.
- AFS also supplied a global namespace, authentication, ACLs, and administrative
  tooling.

## 51. Distribution Dialogue

Failure is normal, not an exceptional branch. Redundancy, retry, and precise
protocols can make a collection of unreliable machines look dependable, but
only within the stated semantics.

## Appendices A-H and implementation bridges

- **A-B: VMM dialogue and virtual-machine monitors.** A hypervisor inserts one
  more control and translation layer below an OS: it saves/restores complete VM
  state, intercepts privileged instructions, maps guest physical frames to
  machine frames, and may use shadow page tables. The information gap between
  VMM and guest motivates inference or paravirtualized cooperation.
- **C-D: monitors dialogue and monitors.** A monitor is mutual exclusion around
  object methods plus condition variables. With Mesa semantics, `signal` is only
  a hint, so every `wait` must be enclosed by a `while` predicate recheck;
  `broadcast` may be required but can cause a thundering herd. This appendix
  also relates monitors to POSIX locks/conditions, semaphores, and Java.
- **E-F: labs dialogue and C/Unix tutorial.** The tutorial follows a program
  from preprocessing, compilation, assembly, and linking through `gcc` flags,
  libraries, separate compilation, make dependencies, `gdb`, man/info pages,
  headers, return values, and `errno`.
- **G-H: systems and xv6 projects.** The project sequence explicitly includes a
  file-system checker, defragmenter, concurrent file server, extent-based xv6
  file system, FFS layout, journaling FS, and xv6 fsck. These are the best
  practical storage sequence:

1. Build an in-memory inode/directory model and assert ownership/link-count
   invariants.
2. Serialize it as blocks, then write a checker that rebuilds allocation and
   reachability from roots.
3. Inject a crash after every write of `create`, `append`, and `rename`; add a
   minimal journal until every recovered state is valid.
4. Add a request ID and duplicate table to a tiny UDP RPC file service; then
   test dropped requests and dropped responses.

## Reading record

- The assigned continuation, lines 27,358-34,230, was read sequentially in
  bounded 100-line extracts without truncation. It completes chapter 41 and
  covers chapters 42-50 through the AFS homework material. Lines 25,988-27,357
  had already been read in the preceding pass; this record does not make a
  new line-by-line certification beyond the completed assigned continuation.
- Read every appendix A-H from lines 34,279-36,676. The detailed bounded
  appendix reads were 34,231-34,650; 34,651-35,050; 35,000-35,796;
  35,797-36,330; and 36,080-36,330, with G/H continued through 36,676.
  The general index was not treated as instructional content.
- Figures were inspected through the supplied text extraction, including the
  inode layout, FFS group and placement diagrams, journaling timelines, LFS
  maps/cleaning diagrams, flash page/block state transitions, and AFS/NFS
  comparison table. I did not render the original PDF pages for visual-only
  detail; the guide relies on their captions and extracted content.
