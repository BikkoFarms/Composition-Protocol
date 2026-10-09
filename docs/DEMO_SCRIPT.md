# Settle Flow — Demo Video Script (HackCanton S3)

**Runtime:** 2:50 (hard limit 3:00) · **Voiceover:** ~365 words (~2:30 at a calm 145 wpm, leaving room for pauses)
**Track:** Track 1 — RWA & Business Workflows · **Challenge:** BitSafe Decentralization
**One-line story:** *A cocoa exporter, a lender and an inspector close a deal where every leg moves at once — or nothing moves — and the auditor gets proof without seeing the deal.*

> This replaces the walkthrough in `PITCH_SCRIPT.md` / `JUDGING.md`, which reference buttons
> that no longer exist ("Run allocation matching demo", "Camera beat", the LOC panel on `/demo`).

---

## What judges must see (and where it happens)

| Judges score… | Shown in scene | The moment that proves it |
|---|---|---|
| **Value** (why it matters) | 1, 2 | Partial settlement = someone is underwater; builders rewrite this layer per app |
| **Reuse / builder adoption** | 2, 3 | ~99 vs ~192 lines of Daml; 8 different trades on the same package |
| **Multi-party workflow** (Track 1 state changes) | 4, 5 | Each party signs for itself; nothing settles until all have |
| **Allocation matching** (headline differentiator) | 5 | Wrong amount refused by the ledger, leg stays unlocked |
| **Atomic DvP** (Track 1 transfers) | 5 | "Settle all 3 legs at once" → all delivered in one transaction |
| **Privacy / audit** (Track 1 audit) | 6 | Regulator: `0 tokens`, receipt only — not a UI filter |
| **BitSafe M-of-N** (challenge) | 7 | 1-of-2 refused → 2-of-3 settles; veto exists (enforced in the Daml contracts) |
| **Metrics / MVP** | 8 | 50+ settlements, 0 unexpected failures, real Daml + JSON Ledger API v2 |

---

## Before you hit record (15 minutes of prep saves the video)

1. **Run locally, not on Render.** The free Render tier cold-starts and can freeze mid-take.
   ```bash
   cd backend && npm run dev      # API :4000  (restart = clean ledger state)
   cd frontend && npm run dev     # Web :3100
   ```
2. **Restart the API** right before recording so dropdowns aren't cluttered with test trades.
3. **Pre-stage the BitSafe trade** (scene 7 would otherwise cost 40 s):
   - Exporter desk → pick **Gold doré purchase** → tick **Require BitSafe 2-of-3 approval** → **Propose trade**
   - Lender desk → **Accept as Lender** → switch to **Oracle** → **Accept as Oracle**
   - Settlement desk → select the Gold trade → **Lock as Alice / Bob / Oracle** → **Send to BitSafe governors**
   - Stop there. Leave it at "0 of 2 approvals".
4. **Pre-load metrics:** Activity → **Run 50 settlements** once (scene 8 then shows 50+).
   Do this *before* staging the Gold trade so the Gold trade stays the newest.
5. **Browser:** 1920×1080, zoom **110%**, hide bookmarks bar, one window, tabs open in this order:
   `/` · `/proposer` · `/counterparty` · `/demo` · `/observer` · `/governance` · `/metrics`
6. **Code shot (scene 2):** VS Code with `examples/with-layer/ThreePartyDvp.daml` and
   `examples/hand-rolled/HandRolledDvp.daml` side by side, font 16, minimap off.
7. **Rehearse the clicks twice** with the voiceover muted. Record screen and voice separately if you can — re-recording audio is much easier than re-recording clicks.

---

## The script

### Scene 1 — Hook · 0:00–0:15 · `/` (home)
**Screen:** Home page hero. Slow scroll to the three problem cards ("Partial fills hurt", "Full broadcast kills deals", "Auditors need proof, not data").

> **VO:** "A cocoa exporter in Ghana needs cash. A lender wants collateral. An inspector backs the quality. Three parties, three assets — and today they settle as three separate transfers. If the cash moves and the collateral doesn't, someone is underwater."

**On-screen text:** `3 parties · 3 assets · 1 deal`

---

### Scene 2 — What Settle Flow is · 0:15–0:30 · VS Code split
**Screen:** The two `examples/` files side by side. Scroll the hand-rolled one slowly so its length is obvious.

> **VO:** "Canton's token standard reserves each leg. But every app still hand-writes the trade around it: who signs, whether the pledges match, when it's safe to settle. Settle Flow is that layer, as a reusable Daml package. The same three-party deal: ninety-nine lines with it, a hundred and ninety-two without."

**On-screen text:** `~99 LOC with Settle Flow  vs  ~192 LOC hand-rolled`

---

### Scene 3 — Exporter proposes · 0:30–0:45 · `/proposer`
**Screen:** Open the **Trade** dropdown and let it sit open for a beat (8 trades visible). Choose **Cocoa export finance**. Click **Propose trade**. Hold on the green confirmation.

> **VO:** "Alice, the exporter, proposes. Cocoa today, but coffee, cashew, gold or an FX swap use the same package with no code changes. That's the reuse story. Notice the exporter can't settle. She can only propose or cancel."

---

### Scene 4 — Lender and inspector sign · 0:45–1:00 · `/counterparty`
**Screen:** Lender (Bob) tab → show the leg table → **Accept as Lender**. Click **Oracle** → **Accept as Oracle**. Hold on "✓ You signed at … Fully signed — now on the Settlement desk →".

> **VO:** "The lender reviews the legs that name him and signs. The inspector signs separately. Each party signs for itself, and the ledger won't let anything lock or settle until every counterparty has."

---

### Scene 5 — Lock and settle (the headline) · 1:00–1:45 · `/demo`
**Screen:**
1. Cocoa trade is selected. Pause on the **Signatures** list with timestamps. *(1:00)*
2. Click **Try wrong amount** on the 10,000 USDCx leg. Hold 3 s on the amber "Wrong amount refused" box. *(1:10)*
3. **Lock as Alice** → **Lock as Bob** → **Lock as Oracle**. *(1:25)*
4. **Settle all 3 legs at once.** Hold on the three "Delivered ✓" chips. *(1:35)*

> **VO:** "Signed trades land on the settlement desk, with proof of who signed and when. Now each party locks the leg it owes, and every pledge is checked field by field against the signed terms. Watch. The lender tries to lock a hundred thousand instead of ten thousand. The ledger refuses it, and the leg stays unlocked. Lock the correct amounts... and settle. All three legs move in one Canton transaction. All or nothing. There is no half-settled state."

**On-screen text (step 2):** `Mismatch → refused by the ledger`
**On-screen text (step 4):** `1 transaction · 3 legs · atomic`

---

### Scene 6 — The auditor money shot · 1:45–2:05 · `/observer`
**Screen:** Click **Auditor proof →**. The page opens on this cocoa trade. Slowly move the cursor from the left panel (lender's tokens) to the right panel (`0 tokens`, `visibleTokens: []`, the receipt).

> **VO:** "Same settlement, two views. The lender sees exactly what it received. The regulator gets a settlement receipt, and zero tokens. That's not a filter in our UI. Canton's stakeholder model never puts the legs in the regulator's view, and a Daml test proves it."

**On-screen text:** `Regulator: receipt ✓ · leg data ✗ — testAuditorCannotSeeLegs`

---

### Scene 7 — BitSafe: no single key can move the money · 2:05–2:35 · `/governance`
**Screen:** The pre-staged Gold trade shows "0 of 2 approvals".
1. Point at the "What BitSafe adds" card for 2 s.
2. **Approve as Gov1** → **Try to execute with 1 of 2** → hold on "Refused — not enough approvals". *(2:20)*
3. **Approve as Gov2** → **Execute settlement** → "Settled by 2-of-3 governors". *(2:32)*

> **VO:** "High-value trades go further. Instead of one operator pressing settle, three independent governors run settlement through BitSafe. One approval isn't enough — the ledger refuses it. A second approval, and the whole trade settles atomically. Any governor can also veto. No single compromised key can move the money."

**On-screen text:** `1 of 2 → refused · 2 of 3 → settled`

---

### Scene 8 — Proof and close · 2:35–2:50 · `/metrics`
**Screen:** Activity page: settled count (50+), success rate, the live event feed. End on the home page logo or the Settle Flow wordmark.

> **VO:** "Fifty-plus settlements, zero unexpected failures. Daml contracts with automated tests, wired to the Canton JSON Ledger API. Settle Flow: the trade layer every Canton app was going to write anyway. Adopt it instead of writing it."

**End card (3 s, silent):** `Settle Flow · Revotoken Africa · github.com/BikkoFarms/SettleFlow`

---

## Voiceover only (for reading into the mic)

> A cocoa exporter in Ghana needs cash. A lender wants collateral. An inspector backs the quality. Three parties, three assets — and today they settle as three separate transfers. If the cash moves and the collateral doesn't, someone is underwater.
>
> Canton's token standard reserves each leg. But every app still hand-writes the trade around it: who signs, whether the pledges match, when it's safe to settle. Settle Flow is that layer, as a reusable Daml package. The same three-party deal: ninety-nine lines with it, a hundred and ninety-two without.
>
> Alice, the exporter, proposes. Cocoa today, but coffee, cashew, gold or an FX swap use the same package with no code changes. That's the reuse story. Notice the exporter can't settle. She can only propose or cancel.
>
> The lender reviews the legs that name him and signs. The inspector signs separately. Each party signs for itself, and the ledger won't let anything lock or settle until every counterparty has.
>
> Signed trades land on the settlement desk, with proof of who signed and when. Now each party locks the leg it owes, and every pledge is checked field by field against the signed terms. Watch. The lender tries to lock a hundred thousand instead of ten thousand. The ledger refuses it, and the leg stays unlocked. Lock the correct amounts... and settle. All three legs move in one Canton transaction. All or nothing. There is no half-settled state.
>
> Same settlement, two views. The lender sees exactly what it received. The regulator gets a settlement receipt, and zero tokens. That's not a filter in our UI. Canton's stakeholder model never puts the legs in the regulator's view, and a Daml test proves it.
>
> High-value trades go further. Instead of one operator pressing settle, three independent governors run settlement through BitSafe. One approval isn't enough — the ledger refuses it. A second approval, and the whole trade settles atomically. Any governor can also veto. No single compromised key can move the money.
>
> Fifty-plus settlements, zero unexpected failures. Daml contracts with automated tests, wired to the Canton JSON Ledger API. Settle Flow: the trade layer every Canton app was going to write anyway. Adopt it instead of writing it.

---

## Delivery notes (what separates a good video from a forgettable one)

- **Lead with the human problem, not the tech.** Judges see 50+ "atomic DvP on Canton" videos. The exporter-lender-inspector story is what they'll remember.
- **Let the two key moments breathe.** Hold ~3 s on the *refused* box (scene 5) and on `0 tokens` (scene 6). Those are the shots judges screenshot.
- **Say "refused" and "nothing moved" out loud.** Failure handling is what makes this look production-grade.
- **Move the cursor slowly and deliberately.** Point at what you're talking about; never wiggle.
- **No dead air while the page loads.** Cut it in editing. Jump-cuts between clicks are fine.
- **Don't read jargon you don't explain.** "ACS", "CIP-0056", "R-PRIV-3" belong in on-screen text, not the voiceover (scene 2 is the only exception).
- **Captions on.** Many judges watch muted. Burn in the on-screen text lines above.
- **Music:** low, neutral, ducked under the voice. Or none.
- **Keep it under 2:55** to leave margin for the end card.

## Things to avoid on camera

- The **Propose broken trade** button and **+1 force atomic revert**. Only show a failure you narrate deliberately.
- Old trades in dropdowns (restart the API before recording).
- The Admin page's "No quote yet — start the mock oracle" message. Run `node mocks/oracle/server.mjs` if you show Admin.
- Saying the screen is "live on DevNet" unless it is. Locally the desks run in demo mode (an
  in-memory mirror of the Daml contracts); the contracts and Daml Script tests are the ledger
  evidence. If you record against DevNet, check `GET /health` shows `"mode": "ledger"` and say so.
- Claims the repo can't back up live. If you quote builder interviews from `docs/INTERVIEWS.md`, make sure the team can name and reach those people if judges ask.

## Optional 20-second extension (if you have time to spare)

Insert between scenes 6 and 7, at `/readiness`: pick the cocoa trade and show every leg with **✓ Settled** and **Delivered to … · View receipt →**.
> **VO:** "Every party gets one shared view of the deal: who signed, which legs are locked, what happens next. After settlement, each row links straight to its receipt."
