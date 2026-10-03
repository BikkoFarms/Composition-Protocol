# SettleFlow Differentiation

How SettleFlow Differs from Existing Options on Canton

HackCanton Season 3 edition. Details are from memory and public docs. Verify against the current token standard and Daml Finance docs before sharing externally.

Positioning

SettleFlow does not compete with the token standard or with asset registries. It builds on CIP-56 allocations and owns the trade-level coordination that the standard leaves open.

Comparison

 | Daml Finance Batch/Instruction

 | CIP-56 alone

 | SettleFlow

 | 
What it does

 | Atomic multi-party settlement

 | Per-leg allocation requests, allocations with an executor, execute/withdraw/cancel

 | Coordinates the whole trade on top of CIP-56

 | 
Asset model

 | Daml Finance holdings and instruments

 | Token standard interfaces

 | CIP-56 assets, with Daml Finance legs supported through templates

 | 
Gap

 | Non-Daml Finance assets need reshaping; not what wallets and registries integrate with

 | No trade-level logic

 | Needs CIP-56-compliant assets or wrappers

 | 

Other settlement work. Other teams are building settlement engines for Canton. For example, OpenZeppelin's docs describe an experimental, unaudited CIP-112 engine for atomic multi-leg DvP, built on stand-in token interfaces. The pages reviewed do not describe three-party authorization collection, leg matching, or readiness tracking, but that is not confirmed. The right stance is complementary: an engine executes legs, SettleFlow coordinates the parties and can run on top of one. [Verify in its specs repo]

What CIP-56 Leaves Open (SettleFlow's Scope)

One trade object that requests allocations from every party

Verification that each allocation matches the agreed terms

Readiness tracking across all legs

Rules for who may execute or cancel

Cleanup on failure

Every app hand-writes these today.

Why Builders Would Adopt It

Builders are not switching away from anything. They keep their CIP-56 assets and registries and replace their own hand-written coordination code. "Adopt this instead of writing it" is a much lower bar than displacing a library.

Where SettleFlow Has to Prove It

For HackCanton, each point should be visible in the demo and the repo, not only claimed.

Allocation matching: confirm each allocation matches the trade's parties, amounts, instrument, reference, and deadlines. In the demo: a wrong amount is rejected and the trade stays not ready.

Failure paths: ship tests for partial allocation, expiry, a withdrawn leg, and a misbehaving executor. In the demo: a cancelled trade releases its locked legs.

Developer effort: show a working three-party DvP in a small amount of code, next to the hand-rolled equivalent. In the repo: a measured comparison.

Permissioning and audit: executor rules, eligibility, and a per-party audit view. In the demo: each party sees only its own history.

Main Risk

If the token standard's own examples, or another settlement effort, ship a similar coordination template, the gap narrows. Keep SettleFlow easy to align with the standard, and use an adapter interface so it stays useful on top of other engines.

Next Steps

Verify the current CIP-56 allocation interfaces and Daml Finance settlement docs, so the comparison rests on checked details

Submissions close 2026-10-09: prepare a short, honest answer to "what already exists" for the Grand Final Q&A