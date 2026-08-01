# Licensing notice

This repository is licensed **AGPL-3.0** (see [`LICENSE`](LICENSE)).

## Read this before relying on that

The `starknet` branch has two ancestries, and they are not in the same legal position.

**The contract-facing work is a clear AGPL case.** This frontend is built for
[lssvm2-starknet](https://github.com/loothero/lssvm2-starknet), a Cairo port of sudoswap's
[`lssvm2`](https://github.com/sudoswap/lssvm2), which is AGPL-3.0. The generated ABIs in
`src/abi/` are derived from that project's artifacts, and the GDA safety thresholds in
`src/app/services/gda-safety.ts` are derived from measurements in its test suite. AGPL-3.0 is the
consistent choice for anything in that lineage.

**The upstream frontend is NOT licensed, and this file does not fix that.** This repository is a
fork of [`sudoswap/amm-lite`](https://github.com/sudoswap/amm-lite), which carries **no LICENSE
file and no license field** on its `main` branch. Under default copyright that is "all rights
reserved", not public domain — so the base this fork started from has no explicit grant to
copy, modify or redistribute it.

Applying AGPL-3.0 here is therefore a statement about **this fork's own contributions**. It
cannot grant rights over upstream code that were never granted to us.

## What to do about it

If this frontend is going to be distributed, hosted publicly, or handed to a third party, get an
explicit licence grant from sudoswap for `amm-lite`, or replace the inherited portions. This was
flagged rather than quietly resolved because it is a legal question, not an engineering one.

AGPL-3.0 **§13** is the clause that matters most for a hosted deployment: running a modified
version and letting users interact with it over a network obliges you to offer those users the
corresponding source.
