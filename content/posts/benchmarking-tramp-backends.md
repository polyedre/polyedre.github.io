---
title: "The new vibecoded TRAMP alternatives are probably not worth it"
date: 2026-03-29T10:00:00+01:00
draft: false
---

Every few months, someone posts about how painfully slow TRAMP is. And honestly,
they're not wrong -- opening a remote file and waiting for that modeline to stop
spinning is one of those small frustrations that add up.

So when two new projects showed up promising to fix this -- both replacing
TRAMP's shell-parsing approach with a proper binary RPC server --
I got curious. [tramp-rpc](https://github.com/ArthurHeymans/emacs-tramp-rpc)
uses a Rust server speaking MessagePack-RPC,
[flit.el](https://github.com/muirdm/flit.el) uses a Go server with JSON-RPC.
Both claim significant speedups. I decided to actually measure it.

The short answer: with SSH ControlMaster -- which TRAMP already uses by default
-- the difference is way less dramatic than you'd think.

## The thing nobody talks about: ControlMaster

Here's what most "TRAMP is slow" discussions miss. Stock TRAMP already uses SSH
ControlMaster, which keeps a single persistent connection open and multiplexes
all commands through it. Once your first SSH handshake completes (~600ms), every
subsequent command reuses that socket with only ~50ms overhead.

So the real question isn't "SSH vs binary protocol." It's: "is 50ms of
shell-command overhead per operation enough to justify deploying a server binary
on every remote host?"

I ran the benchmarks to find out. The remote host is a Debian 12 box with ~50ms
SSH round-trips -- a pretty typical setup. Five iterations per test, reporting
medians. I tested cold cache (first access), warm cache (repeated access), and
git/magit operations.

## Cold cache: the first-access story

These numbers represent the worst case -- no cached data, every operation hits
the remote.

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

The connection setup improvement is real -- 600ms vs 1.6s. You actually feel
that one. Metadata operations (file-exists, file-attributes) are about 2-3x
faster. Not bad.

But look closer and things get weird. RPC is basically the same speed as stock
TRAMP for file writes (243ms vs 246ms). flit is *3x slower* than stock TRAMP
for running remote commands (67ms vs 21ms for a simple `ls`). And flit
absolutely chokes on large file reads -- 808ms for a 10MB file vs 191ms for
stock TRAMP.

Neither project is a clean win across the board. They each have operations where
they're actually worse than the thing they're trying to replace.

## Warm cache: it doesn't matter

| Test | RPC | flit | sshx |
|---|---|---|---|
| cached-file-exists | 571 us | 132 us | 228 us |
| cached-file-attrs | 323 us | 145 us | 214 us |
| cached-multi-stat (10x) | 1.50 ms | 1.70 ms | 2.15 ms |
| cached-dir-files | 1.22 ms | 330 us | 520 us |

Once data is cached, all three backends return in microseconds. At this scale,
the backend is irrelevant -- you're measuring Emacs hash table lookups. And
in real usage, a lot of your TRAMP interactions are hitting warm caches
(reopening buffers, navigating directories you've already listed, etc.).

The funny thing is that RPC is actually the *slowest* for cached lookups.
571 microseconds vs 228 for stock TRAMP. Doesn't matter in practice, but it's
ironic.

## Git and magit: where it actually gets interesting

This is the test I was most curious about. Magit on remote repos is genuinely
painful with stock TRAMP because it runs dozens of git commands sequentially.

| Test | RPC | flit | sshx |
|---|---|---|---|
| git rev-parse | 16.3 ms | 66.1 ms | 26.7 ms |
| git status | 16.7 ms | 66.7 ms | 20.5 ms |
| git log (20 commits) | 16.3 ms | 67.5 ms | 21.9 ms |
| git diff --stat | 15.9 ms | 66.5 ms | 19.9 ms |
| git ls-files | 16.3 ms | 66.6 ms | 21.5 ms |
| git branch -a | 15.7 ms | 68.0 ms | 20.6 ms |
| **magit-refresh-sim (5 cmds)** | **79.5 ms** | **396 ms** | **118 ms** |

RPC is consistently the fastest here -- ~16ms per git command vs ~20ms for stock
TRAMP. Not a huge per-command difference, but it adds up. The simulated
magit refresh (5 sequential commands) comes in at 79ms vs 118ms for sshx.

flit, on the other hand, is a disaster for git operations. Every command takes
~67ms -- over 3x slower than stock TRAMP. The simulated refresh takes 396ms.
If you use magit on remote repos and switch to flit, things will actually get
worse.

To be fair, tramp-rpc has a trick this benchmark doesn't capture: it can batch
all those git commands into a single round-trip. That's where the real magit
speedup lives, not in shaving 4ms off individual calls.

## So, is it worth it?

For me, probably not. The improvements on a typical SSH connection are real but
modest. You save a second on connection setup, a few milliseconds per file
operation, and maybe 40ms on a magit refresh. In exchange, you need to compile,
deploy, and maintain a server binary on every remote host.

Stock TRAMP isn't glamorous. But with ControlMaster doing the heavy lifting,
it's doing a more reasonable job than its reputation suggests. Sometimes the
boring tool is fine.
