# SettleFlow PRD

SettleFlow: Product Requirements Document

HackCanton Season 3 edition

Field

 | Value

 | 
Product

 | SettleFlow, the trade-level coordination layer for three-party DvP settlement on Canton

 | 
Version

 | Draft v0.2

 | 
Date

 | 2026-10-02

 | 
Event

 | HackCanton Season 3, track: Real-World Asset and Business Workflows

 | 
Key dates

 | Submissions close 2026-10-09. Live Grand Final reported for 2026-10-14 [Verify]

 | 
Owner

 | TBD

 | 
Inputs

 | SettleFlow pitch deck; HackCanton S3 announcements on the Canton Network Forum and event listings

 | 

Source tags. [Deck] comes from the SettleFlow pitch deck. [Event] comes from public HackCanton S3 announcements. [Proposed] is a recommendation added in this PRD. [Verify] needs confirming before you rely on it.

1. Summary

A buyer, seller, and custodian can already agree on a trade. On Canton they still write custom Daml to collect three-way authorizations, confirm that all legs match, and safely execute or cancel the DvP. Every team rebuilds this.

SettleFlow is a reusable Daml workflow layer that owns that coordination. It runs on CIP-56 allocations (with Daml Finance leg templates), never holds keys, and lets builders keep their existing assets and registries. [Deck]

Focus of this edition. Submissions close in seven days. This PRD defines what SettleFlow must show to be judged on working software rather than slides: a reproducible three-party DvP demo with visible failure handling and an audit trail, packaged with a public repo, a video, and a build diary. Post-event scope follows the deck roadmap.

2. Event context: HackCanton Season 3

Item

 | Detail

 | Source

 | 
Format

 | Five-week, fully online build program for solo builders or teams, with workshops, mentors, and a live Grand Final

 | Event

 | 
Track

 | Single track: Real-World Asset and Business Workflows, described as end-to-end workflows for issuance, state changes, transfers, and audit

 | Event listing [Verify]

 | 
Rewards

 | Up to $50K in cash and credits. Partner challenges: BitSafe 50K CC, Grofty 10K CC bounty. Hacken offers AI Auditor support

 | Event

 | 
Field

 | As of 2026-09-30: 81 teams, 37 projects, 63 build diaries. 11 projects had a demo or repo online; 4 had shipped the full demo, repo, and video set

 | Event

 | 
Submissions close

 | 2026-10-09

 | Event

 | 
Grand Final

 | Top 5 to 10 finalists pitch live on 2026-10-14

 | Event listing [Verify]

 | 
Submission contents

 | Not published in the sources reviewed. Teams furthest along are shipping demo, repo, and video, plus build diaries

 | [Verify]

 | 
Judging criteria

 | Not found in the sources reviewed

 | [Verify]

 | 
After the event

 | The listing mentions ecosystem support for fundraising and pilot launch

 | Event listing [Verify]

 | 

What this means for SettleFlow

The track fits on transfers (DvP) and state changes (the settlement lifecycle). Issuance and audit must be visible in the demo, not implied. [Proposed]

The event asks teams to put work in front of people who build in the ecosystem, so a runnable repo outweighs a polished deck. [Proposed]

Seven days leaves no room for new scope. Verify what exists, close the gaps, and package it. [Proposed]

3. Problem

For builders [Deck]

Custom authorization orchestration for every settlement flow

Leg-matching checks rebuilt per trade

Execute and cancel logic rebuilt each time

For operators [Deck]

A missed approval breaks settlement

A mismatched leg stalls the DvP

No shared view of readiness

Evidence status. The deck cites a reference workflow on Canton testnet, CIP-56 allocation integration prototypes, feedback from Daml and Canton builders, and early design-partner conversations. It does not yet name design partners or show measured effort saved. [Verify]

4. Goals and non-goals

Goals for the submission (by 2026-10-09)

Working end-to-end DvP. A tokenized asset against a payment token, with a custodian as the third party, executed atomically.

Visible failure handling. A mismatched leg is rejected and a withdrawn or cancelled trade releases any locked legs.

Audit trail. A per-party view of who authorized what and how the trade ended, which speaks directly to the track's audit theme.

A package others can verify. Public repo, one documented run path, demo video, and build diary.

A pitch that leads with the demo. Slides support the demo, not the other way round.

Goals after the event [Deck]

First pilot DvP with partner assets, custodian integrations, and mainnet pilots (see Section 12)

Become the default coordination component for settlement on Canton

Non-goals

Custody of keys or assets [Deck]

Replacing CIP-56, Daml Finance, or any asset registry [Deck]

Trade matching, pricing, or discovery. Trades are agreed off-chain [Deck]

Production hardening or mainnet deployment before 2026-10-09 [Proposed]

A broad library of unrelated primitives [Proposed]

5. Users

Persona

 | Needs

 | 
Application builders

 | A tested workflow they configure instead of writing authorization, matching, and cancel logic

 | 
Asset issuers and custodians (design partners)

 | Predictable three-party settlement over their existing registries, with clear failure handling

 | 
Market operators

 | A shared readiness view, plus audit and operator views

 | 
Hackathon judges and mentors

 | A demo that runs, a real problem, clear track fit, and honest answers about what already exists

 | 

6. Product overview

Settlement flow [Deck]

Trade agreed off-chain

SettleFlow Daml workflow initiated

Authorizations collected

Legs verified, readiness tracked

DvP executed or cancelled

Settlement confirmed on existing rails

Lifecycle states [Proposed]

Lifecycle state machine

From

 | Event

 | To

 | 
Proposed

 | Parties accept terms

 | Collecting

 | 
Collecting

 | All legs allocated and verified

 | Ready

 | 
Collecting

 | Withdrawal or allocate-by deadline

 | Cancelled

 | 
Ready

 | Executor settles all legs atomically

 | Settled

 | 
Ready

 | Cancel or settle-by deadline

 | Cancelled

 | 

Roles [Proposed]

Role

 | Responsibility

 | 
Buyer, Seller

 | Authorize and allocate their own leg

 | 
Third party (custodian or agent)

 | Executes settlement. Whether it also approves the trade is an open question (see Section 14)

 | 

Where SettleFlow sits [Proposed]

Layers

Layer

 | Component

 | 
Application

 | Builder application

 | 
Coordination

 | SettleFlow workflow layer

 | 
Adapter

 | Settlement backend adapter

 | 
Execution options

 | CIP-56 allocations; Daml Finance leg templates; other settlement engines (candidate)

 | 
Assets

 | Existing asset registries

 | 

7. Demo scenario [Proposed]

Target length: three to five minutes. Each step should be runnable from the repo, not only shown in the video.

Step

 | What judges see

 | Status

 | 
1. Issue

 | A custodian-backed tokenized asset and a payment token exist as CIP-56 holdings

 | To build or confirm

 | 
2. Propose

 | Trade terms created: parties, legs, amounts, reference, executor

 | Built

 | 
3. Authorize

 | Buyer and seller each authorize and allocate their leg

 | Built

 | 
4. Mismatch

 | A wrong amount or instrument is rejected by leg matching and the trade stays not ready

 | Built; needs a scripted run

 | 
5. Status

 | A shared readiness view shows who is still outstanding

 | On-ledger built; view to build

 | 
6. Execute

 | The custodian executes and both legs settle atomically

 | Built

 | 
7. Cancel

 | A second trade is withdrawn and its locked legs are released

 | Built; needs a scripted run

 | 
8. Audit

 | A per-party history of authorizations and outcome, showing each party sees only its own data

 | To build

 | 

8. Functional requirements

Priority. P0 must be in the 2026-10-09 submission. P1 should be in the finalist demo if time allows. P2 comes after the event. Status. Built means the deck lists it as implemented, Planned means it appears on the deck roadmap, and Proposed means the deck does not state it.

ID

 | Requirement

 | Priority

 | Status

 | 
FR-1

 | Initiate a settlement from agreed terms: parties, legs, instruments, amounts, reference, executor

 | P0

 | Built

 | 
FR-2

 | Collect three-party authorizations

 | P0

 | Built

 | 
FR-3

 | Request and track CIP-56 allocations for each party's leg

 | P0

 | Built

 | 
FR-4

 | Verify every allocation matches the agreed terms before a trade can become ready

 | P0

 | Built

 | 
FR-5

 | Track readiness of every party on-ledger

 | P0

 | Built

 | 
FR-6

 | Execute all legs atomically

 | P0

 | Built

 | 
FR-7

 | Cancel atomically and release any locked legs

 | P0

 | Built; hardening planned

 | 
FR-8

 | Demo assets: a tokenized asset and a payment token issued as CIP-56 holdings

 | P0

 | Proposed

 | 
FR-9

 | Audit trail view per party

 | P0

 | Proposed (deck plans audit views at 60 to 90 days; pulled forward for the track)

 | 
FR-10

 | Automated failure-path tests: partial allocation, withdrawn leg, mismatched leg, wrong executor

 | P0

 | Proposed

 | 
FR-11

 | Minimal readiness status view (page or CLI output)

 | P1

 | Proposed (deck plans a dashboard at 30 days)

 | 
FR-12

 | Allocate-by and settle-by deadlines so no trade is stranded

 | P1

 | Proposed

 | 
FR-13

 | Permissioning: who may execute or cancel at each stage

 | P1

 | Proposed

 | 
FR-14

 | Privacy rules: what the third party sees versus the counterparties

 | P1

 | Proposed

 | 
FR-15

 | Daml Finance leg templates

 | P1

 | Built

 | 
FR-16

 | Settlement backend adapter interface

 | P2

 | Proposed

 | 
FR-17

 | Custodian integrations

 | P2

 | Planned (60 to 90 days)

 | 
FR-18

 | Market-standard settlement templates

 | P2

 | Planned (6 months)

 | 
FR-19

 | Policy hooks (eligibility, limits, fees)

 | P2

 | Proposed

 | 

9. Non-functional requirements

Area

 | Requirement

 | Source

 | 
Custody

 | No key custody anywhere in the layer

 | Deck

 | 
Atomicity

 | A DvP either fully executes or fully cancels

 | Deck

 | 
Privacy

 | Workflow data visible only to the parties to the trade, using Canton's per-party projection

 | Deck

 | 
Reproducibility

 | A fresh clone runs the demo through one documented path; someone outside the build verifies it before submission

 | Proposed

 | 
Security

 | Run linters and available AI audit tooling on the Daml code before submitting; independent audit before any mainnet pilot

 | Proposed

 | 
Compatibility

 | Pin to specific CIP-56 interface versions and isolate the dependency

 | Proposed

 | 
Licensing

 | Public repo with a stated license, subject to event rules

 | Proposed [Verify]

 | 

10. Plan to submission [Proposed]

Date

 | Milestone

 | 
Fri 2 Oct

 | Freeze scope to the P0 list. Confirm event rules, judging criteria, and required submission parts

 | 
Sat 3 to Mon 5 Oct

 | Verify the existing build from a clean environment. Build FR-8 and FR-9. Script the mismatch and cancel scenarios

 | 
Tue 6 Oct

 | Failure-path tests (FR-10). Minimal status view (FR-11) if time allows

 | 
Wed 7 Oct

 | Security pass: linters and AI audit. Fix findings. Write the README with a single run path

 | 
Thu 8 Oct

 | Record the demo video. Write the build diary entry. Dry run from a fresh clone by someone outside the build

 | 
Fri 9 Oct

 | Submit early in the day. Confirm every required part is attached

 | 
Sat 10 to Tue 13 Oct

 | Pitch rehearsal, Q&A preparation, and a backup demo recording

 | 
Wed 14 Oct

 | Live Grand Final, if selected [Verify]

 | 

11. Success criteria

Measure

 | Target

 | 
Submission complete: repo, demo, video, build diary

 | By 2026-10-09

 | 
Reproducibility

 | An outside reader reproduces the demo from the README alone

 | 
Failure scenarios (FR-10)

 | All pass in a single test run

 | 
Demo length

 | Three to five minutes

 | 
Finalist selection

 | Top 5 to 10 (an outcome, not a controllable target)

 | 
First pilot DvP with partner assets

 | Within 30 days after the event (deck roadmap)

 | 
Design partners in active conversation

 | [TBD]

 | 
Effort versus a hand-rolled build

 | [TBD], measured in lines of Daml and engineering days

 | 

12. Differentiation and likely judge questions

Positioning: SettleFlow builds on CIP-56 allocations and owns the trade-level coordination around them. It does not compete with the token standard or with asset registries.

Option

 | What it gives builders

 | What SettleFlow adds

 | 
CIP-56 allocations alone

 | Per-leg allocation requests, allocations with an executor, and execute, withdraw, or cancel [Verify]

 | One trade object that collects every party's allocation, verifies it matches, tracks readiness, and executes or cancels all legs together

 | 
Daml Finance Batch and Instruction

 | Atomic multi-party settlement on Daml Finance holdings and instruments [Verify]

 | Works with CIP-56 assets and existing registries without reshaping them. Daml Finance legs remain supported through templates

 | 
Other settlement engines, for example OpenZeppelin's experimental CIP-112 engine

 | Atomic multi-leg DvP. Its docs label it experimental and unaudited, built on stand-in token interfaces. The pages reviewed do not describe authorization collection, leg matching, or readiness tracking [Verify in its specs repo]

 | Coordination above execution. SettleFlow can sit on top of an engine like this through the adapter interface (FR-16) rather than compete with it

 | 

Likely question

 | Short answer

 | 
Why not use CIP-56 allocations directly?

 | They cover one party's leg. Every app still has to gather, match, track, and finish the whole trade. SettleFlow is that part.

 | 
Why not Daml Finance settlement?

 | It assumes Daml Finance holdings. SettleFlow targets CIP-56 assets and keeps existing assets and registries intact.

 | 
Is anyone else building settlement on Canton?

 | Yes, and the answer is to be complementary: engines execute legs, SettleFlow coordinates the parties. Do not claim others lack features that have not been checked.

 | 
What happens when a party does not act or a leg is wrong?

 | Show it: the mismatched leg is rejected, and a cancelled trade releases locked legs. Deadlines are a P1 follow-on.

 | 
Where are privacy and audit?

 | Canton's per-party projection limits what each party sees, and the audit view shows each party its own history.

 | 
Why would builders adopt it?

 | It replaces hand-written coordination code. Back this with a measured code comparison (see Section 11).

 | 

13. Post-event roadmap [Deck]

Timing is relative to the end of the event. The deck does not state an anchor date.

Phase

 | Scope

 | 
Next 30 days

 | First pilot DvP with partner assets; readiness dashboard; custodian feedback loop

 | 
Next 60 to 90 days

 | Custodian integrations; hardened cancel path; audit and operator views

 | 
Next 6 months

 | Mainnet pilots; market-standard settlement templates; institutional onboarding

 | 

Go-to-market phases [Deck]. (1) Design partners: asset issuers and custodians already running structured DvP on Canton. (2) Integrations: Daml Finance libraries and existing asset registries. (3) Standard layer: the default coordination component for settlement on Canton.

Proposed addition. Insert a security gate before mainnet pilots: threat model, independent audit, and resolution of critical and high findings.

14. Risks and open questions

Risks

Risk

 | Mitigation

 | 
Only seven days to submit; scope creep

 | Hold the P0 list. Everything else waits

 | 
Deck claims ("already implemented", "live on testnet") are not yet backed by public evidence

 | Publish the repo, a scripted run, and test results

 | 
Demo environment instability

 | Keep a backup recording and a single known-good run path

 | 
Pre-existing work may be treated differently by event rules

 | Confirm eligibility now; document what was built during the event

 | 
Another settlement effort covers part of the coordination layer

 | Be precise about what SettleFlow adds; use the adapter interface to stay complementary

 | 
CIP-56 interfaces change

 | Pin versions and isolate the dependency

 | 
Custodian sales cycles slow pilots after the event

 | Start with issuers already running structured DvP

 | 

Open questions

What are the judging criteria and weights, and what exactly must a submission include?

Do the event rules allow work that existed before the build period, and how should it be disclosed?

Which environment does the demo target: LocalNet, DevNet, or the testnet named in the deck?

Is the third party only the executor, or does it also hold assets or approve the trade? This decides whether permissioning is a hook or a required state.

Is CIP-56 the primary rail with Daml Finance as an adapter, or are both first-class?

Do the BitSafe or Grofty challenges fit SettleFlow, and what are their requirements?

Which repositories, transactions, and partner names can be shown publicly?

Which license will the public repo use?

Who presents, and who covers Q&A, if SettleFlow reaches the Grand Final?

Appendix A: Pitch deck adjustments for HackCanton

Lead with the demo. Move "Product" and a live or recorded run to the front, and shorten the market framing.

Add a track-fit slide: transfers via DvP, state changes via the lifecycle, issuance via demo assets, audit via the per-party view.

Add a short "what exists today" slide naming CIP-56, Daml Finance, and other settlement work, with one line on how SettleFlow differs.

Replace "standard layer" with a claim you can show. Keep it as a long-term vision, not a headline.

Back "already implemented" with links to the repo, tests, and a recorded run.

Replace the Ask with event-relevant requests: finalist exposure, design-partner and custodian introductions, and feedback on CIP-56 allocation patterns.

Anchor the roadmap to dates instead of "now" and "next 30 days".

Add quantified results once measured: lines of Daml saved, time to stand up a three-party DvP.

Appendix B: References

HackCanton Season 3 announcement: https://forum.canton.network/t/hackcanton-season-3-build-something-real-on-canton/9065

HackCanton S3 launch post: https://forum.canton.network/t/hackcanton-s3-launch-build-ship-win-cash-prize/9119

HackCanton S3 build phase and supporters: https://forum.canton.network/t/hackcanton-s3-build-phase-workshops-and-supporters/9212

HackCanton S3 update (submissions close Oct 9): https://forum.canton.network/t/hackcanton-s3-update-teams-projects-live-security-session-and-upcoming/9252

HackCanton League Season 3 listing (track and Grand Final date): https://hacklist.io/

Registration and event page: https://appsfactory.cc/hackathons

OpenZeppelin Settlement (CIP-112) docs: https://docs.openzeppelin.com/canton/settlement