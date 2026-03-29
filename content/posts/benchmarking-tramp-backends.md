---
title: "The new TRAMP alternatives are probably not worth it -- except if you use Magit"
date: 2026-03-29T10:00:00+01:00
draft: false
---

Every few months, someone posts about how painfully slow TRAMP is. And honestly,
they're not wrong (opening a remote file and waiting for that modeline to stop
spinning is one of those small frustrations that add up).

So when two new projects showed up promising to fix this, I got curious.
[tramp-rpc](https://github.com/ArthurHeymans/emacs-tramp-rpc)
uses a Rust server speaking MessagePack-RPC,
[flit.el](https://github.com/muirdm/flit.el) uses a Go server with JSON-RPC.
Both claim significant speedups. I decided to actually measure it.

The short answer surprised me. For basic file operations, the improvements are
modest (ControlMaster already does the heavy lifting). But then I ran actual
`magit-status` on a real codebase and, well, keep reading.

## The thing nobody talks about: ControlMaster

Here's what most "TRAMP is slow" discussions miss. Stock TRAMP already uses SSH
ControlMaster, which keeps a single persistent connection open and multiplexes
all commands through it. Once your first SSH handshake completes (~600ms), every
subsequent command reuses that socket with only ~50ms overhead.

So the real question isn't "SSH vs binary protocol." It's: "is 50ms of
shell-command overhead per operation enough to justify deploying a server binary
on every remote host?"

I ran the benchmarks to find out. The remote host is a Debian 12 box with ~50ms
SSH round-trips (a pretty typical setup). I tested read/write (with and without
cache) and git/magit operations.

## Cold cache: the first-access story

These numbers represent the worst case: no cached data, every operation hits the
remote.

| Test | RPC | flit | sshx |
|---|---|---|---|
| connection-setup | 614 ms | 653 ms | 1.65 s |
| file-exists | 16.2 ms | 15.0 ms | 45.0 ms |
| file-attributes | 14.5 ms | 14.6 ms | 37.6 ms |
| file-read (1KB) | 16.2 ms | 0.3 ms | 42.6 ms |
| file-read (10MB) | 74.0 ms | 808 ms | 191 ms |
| file-write (1KB) | 243 ms | 16.0 ms | 246 ms |
| directory-files | 46.9 ms | 15.9 ms | 43.1 ms |
| dir-files-and-attrs | 17.9 ms | 33.1 ms | 63.3 ms |
| process-file (ls) | 17.4 ms | 66.7 ms | 20.9 ms |
| copy-file | 129 ms | 31.1 ms | 209 ms |
| multi-stat (10x) | 155 ms | 155 ms | 220 ms |

The connection setup improvement is real (600ms vs 1.6s). You actually feel
that one. Metadata operations (`file-exists`, `file-attributes`) are about 2-3x
faster.

But look closer and things get weird. RPC is basically the same speed as stock
TRAMP for file writes (243ms vs 246ms). flit is *3x slower* than stock TRAMP
for running remote commands (67ms vs 21ms for a simple `ls`). And flit
absolutely chokes on large file reads (808ms for a 10MB file vs 191ms for
stock TRAMP).

Neither project is a clean win across the board. They each have operations where
they're actually worse than the thing they're trying to replace.

## Warm cache: no performance benefits

| Test | RPC | flit | sshx |
|---|---|---|---|
| cached-file-exists | 571 us | 132 us | 228 us |
| cached-file-attrs | 323 us | 145 us | 214 us |
| cached-multi-stat (10x) | 1.50 ms | 1.70 ms | 2.15 ms |
| cached-dir-files | 1.22 ms | 330 us | 520 us |

Once data is cached, all three backends return in microseconds. At this scale,
the backend is irrelevant (you're measuring Emacs hash table lookups). And
in real usage, a lot of your TRAMP interactions are hitting warm caches
(reopening buffers, navigating directories you've already listed, etc.).

## Synthetic git benchmarks: mildly interesting

I also tested individual git commands through `process-file`, simulating what
magit does under the hood.

| Test | RPC | flit | sshx |
|---|---|---|---|
| git rev-parse | 16.3 ms | 66.1 ms | 26.7 ms |
| git status | 16.7 ms | 66.7 ms | 20.5 ms |
| git log (20 commits) | 16.3 ms | 67.5 ms | 21.9 ms |
| git diff --stat | 15.9 ms | 66.5 ms | 19.9 ms |
| git ls-files | 16.3 ms | 66.6 ms | 21.5 ms |
| git branch -a | 15.7 ms | 68.0 ms | 20.6 ms |

RPC is consistently the fastest here at ~16ms per command. Stock TRAMP is close
at ~20ms. flit is surprisingly slow at ~67ms (actually 3x slower than stock
TRAMP for running remote commands).

Looking at these numbers, I almost concluded that the RPC approach wasn't worth
the hassle. Sure, 16ms is faster than 20ms, but who cares about 4ms?

Then I ran actual `magit-status`.

## Real magit-status: okay, I was wrong

All the benchmarks above test individual operations in isolation. But that's not
how magit works. When you run `magit-status`, it fires off dozens of git
commands sequentially (rev-parse, status, log, diff, stash, branch info, and
more). Each one is a separate round-trip through TRAMP.

So I ran real `magit-status` on an actual codebase (~750 commits, active
development) through `emacsclient` and timed it end-to-end. Cold connection,
no caches, the full experience.

| | sshx | tramp-rpc | speedup |
|---|---|---|---|
| **magit-status** | **113 s** | **10.1 s** | **11.2x** |

Yeah. Nearly two minutes vs ten seconds. I ran it three times each to make sure
I wasn't imagining things:

- **sshx**: 113.2s, 115.0s, 112.8s
- **tramp-rpc**: 10.3s, 9.9s, 10.1s

This is a completely different story from the synthetic benchmarks. The
per-command improvement was only 4ms (16ms vs 20ms), but tramp-rpc doesn't
actually run those commands one at a time. Its magit integration batches ~60 git
commands into a single round-trip through a `commands.run_parallel` RPC call.
Instead of 60 sequential round-trips at 20ms each (= 1.2s just in network
overhead), it sends everything at once and gets all the results back in one go.

On top of that, tramp-rpc caches the results and serves subsequent magit
requests from that prefetched data, so the file-exists and file-attributes calls
that magit makes between git commands also avoid round-trips.

The 4ms-per-command improvement didn't matter. The batching did. And the
synthetic benchmarks completely missed it.

## So, is it worth it?

For basic file operations (opening files, listing directories, reading and
writing), probably not. ControlMaster already makes stock TRAMP fast enough,
and the RPC backends don't improve things dramatically for these use cases.

But if you use magit on remote repositories, tramp-rpc is transformative. Going
from 2 minutes to 10 seconds for `magit-status` isn't a micro-optimization
(it's the difference between "magit is unusable over TRAMP" and "magit works
fine"). That alone might justify deploying a server binary.

flit is harder to recommend right now. It's fast for file writes and copies, but
its `process-file` performance makes git operations 3x slower than stock TRAMP.
And since it's a complete TRAMP replacement (not a backend), it doesn't
integrate with existing TRAMP configuration.

Stock TRAMP isn't glamorous. For most file operations with ControlMaster, it's
honestly fine. But the moment you open magit on a remote repo, you'll
understand why people are building these alternatives.
