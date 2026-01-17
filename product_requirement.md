Flashcard PWA – Product Requirements Document (PRD)

Version: 1.3 (Final)
Status: Approved for Development

1. Product Overview

Product Name: Flashcard PWA Template
Platform: Web (PWA, offline‑first)
Deployment: GitHub Pages / Static Hosting

Problem Statement

Parents and teachers need a simple, resilient learning tool that they control. Existing apps are either too complex (Anki) or too rigid (Quizlet). They need a way to turn a Google Sheet into a high-quality study app without managing logins or servers.

Solution

A PWA that consumes a Google Sheet CSV, converts rows into study Variants (Q/A and Cloze), tracks progress locally using a Semantic Reset strategy to ensure data integrity, and works fully offline.

2. Data Model (Google Sheet – Source of Truth)

2.1 CSV Structure

The system consumes a standard CSV.

Required Columns:
ID | Subject | Topic | Question | Answer | Notes

(Note: Notes was formerly referred to as Facts)

2.2 Field Definitions

ID (Required): Stable unique identifier (e.g., card001). Never reused.

Subject (Required): High-level grouping (e.g., History).

Topic (Optional): Sub-grouping (e.g., French Revolution).

Question (Required): The prompt for the standard Q/A card.

Answer (Required): The core answer for the Q/A card.

Notes (Optional): Contextual info. Source for Cloze cards.

2.3 Identity Concepts

To solve the "Two Cards, One ID" problem, we separate Content Identity from Study Identity.

Row Identity (cardId): Represents the raw row in the Sheet. Used for sync and updates.

Variant Identity (variantId): Represents the specific study item.

Q/A Variant: card001::qa

Cloze Variant: card001::cloze

3. Card Generation & Cloze Logic

3.1 The "Explicit Marker" Rule

We do not guess cloze targets. We use explicit syntax.

Syntax: {{target}} or [[target]].

Rule: A cloze variant is generated IF AND ONLY IF the Notes column contains valid marker syntax.

Single Limit: For V1, if multiple markers exist, mask them all (or strictly enforce one). Decision: Mask all occurrences found.

3.2 Variant Generation Rules

For every row in the CSV:

QA Variant (::qa): ALWAYS generated.

Front: Question

Back: Answer + (optional) Notes displayed as context.

Cloze Variant (::cloze): CONDITIONALLY generated.

Condition: Notes matches regex /(\{\{|\[\[)(.*?)(\}\}|\]\])/.

Front: Notes with content inside markers replaced by _____.

Back: Notes with content inside markers highlighted.

(Note: The Question and Answer fields are not used on the Cloze card front, ensuring separation of concerns).

4. Sync & Semantic Reset Strategy

4.1 The "Ship of Theseus" Problem

If a user changes a card from "2+2=?" to "Capital of France?", keeping old progress is dangerous. We use Semantic Hashing to detect changes.

4.2 Hashing Logic

We compute three hashes per row:

sourceRowHash: hash(all_fields) → Detects any edit (triggers DB update).

coreHash: hash(normalize(Question) + normalize(Answer)) → Identity of the Concept.

contextHash: hash(normalize(Notes)) → Identity of the Context.

Normalization: Trim whitespace, collapse spaces. Case-sensitive for V1.

4.3 The Reset Logic (Deterministic)

When sourceRowHash changes during sync:

Change Detected

Effect on ::qa Progress

Effect on ::cloze Progress

Reason

coreHash Changed

RESET (Box 0)

RESET (Box 0)

The core concept changed. Everything is new.

coreHash Same BUT contextHash Changed

KEEP

RESET (Box 0)

Q/A is valid. Cloze text changed, so old mastery is invalid.

Neither Changed

KEEP

KEEP

Minor edit (e.g., Topic change).

Reset Definition: Set box=0, dueAt=now, lapses=0. Do not delete the record; just reset its scheduling.

5. Learning Logic (SRS)

5.1 Variant-Based Progress

Progress is keyed by Variant ID, not Card ID.

Mastering card001::qa does not affect card001::cloze.

5.2 SRS Algorithm (Leitner System V1)

Input: Result (Know / Don't Know)

Intervals:

Box 0: 10 mins (Session)

Box 1: 24 hours

Box 2: 3 days

Box 3: 7 days

Box 4: 14 days

Box 5: 30 days

Logic:

Know → Box + 1

Don't Know → Reset to Box 0 (or Box 1 depending on strictness). Decision: Box 0.

6. Architecture & Database Design

6.1 Database (IndexedDB)

DB Name: flashcard_pwa
Version: 1

Store: cards

Stores content. Key = id (Row ID).

interface CardRecord {
  id: string;             // "card001"
  subject: string;
  topic: string;
  question: string;
  answer: string;
  notes: string;          // Source text for cloze
  status: 'active' | 'archived';
  sourceRowHash: string;  // For generic diffing
  coreHash: string;       // For Semantic Reset (Q+A)
  contextHash: string;    // For Semantic Reset (Notes)
  updatedAt: number;
}


Store: progress

Stores learning state. Key = pk.

interface ProgressRecord {
  pk: string;             // `${profileId}|${rowId}::${variantType}`
  profileId: string;
  rowId: string;          // "card001" - allows fast "get all for this card"
  variantType: 'qa' | 'cloze';
  box: number;
  dueAt: number;          // Epoch ms
  lastReviewedAt: number;
}
// Indexes:
// 'by_profile_due': [profileId, dueAt] -> The Study Queue
// 'by_row': [rowId] -> For resetting/deleting card progress


Store: sync_meta

Tracks sync state.

interface SyncMeta {
  key: 'main';
  csvHash: string;        // Full file hash
  lastSyncAt: number;
}


7. Technical Implementation Details

7.1 CSV Parsing

Library: Use PapaParse. Do not write a regex parser.

Config: { header: true, skipEmptyLines: true }.

7.2 The Sync Engine Algorithm

Fetch & Parse CSV (Network-only fetch).

Validate Headers (ID, Question, Answer mandatory).

Hash entire CSV. If matches sync_meta.csvHash, stop.

Iterate Rows:

Compute newSourceHash, newCoreHash, newContextHash.

Fetch existing card from DB.

Diff:

If New ID → Insert.

If Existing ID + Hash Change → Run Semantic Reset Logic, then Update.

If Missing ID → Mark status = archived.

Clean up Progress:

(Optional V1) Scan for "Zombie Cloze" progress (where Card no longer has {{...}}) and mark as archived/deleted.

7.3 Queue Builder (Performance & Pedagogy)

Do not iterate all cards to build a queue.

Query progress store using index by_profile_due (dueAt <= now).

Collect list of rowIds.

Bulk fetch those cards from DB.

Hydrate Variants:

For each progress item, check if the variant is valid.

(e.g., If progress is ::cloze, check if card.notes still has {{...}}. If not, skip).

Shuffle: Randomize the queue to prevent ID-based clustering.

Sibling Spacing:

Iterate the randomized queue.

If queue[i].rowId === queue[i-1].rowId, immediately swap queue[i] with a random card further down the queue that has a different rowId.

Goal: Prevent immediate "priming" where seeing the QA card gives away the answer to the Cloze card of the same concept.

8. UX/UI Requirements

8.1 Setup & Help

ID Template: Provide a link to a generic Google Sheet template with an auto-ID formula.

iOS Install: Show specific "Share -> Add to Home Screen" instructions if iOS Safari is detected.

8.2 Study Mode

Global Toggle: "Study Mode" dropdown:

Mixed (Default)

Q/A Only

Cloze Only

Visuals:

Cloze cards should visually distinct (e.g., different border color or badge).

8.3 Offline Strategy

Service Worker:

Cache index.html, main.js, style.css (App Shell).

Never cache the CSV data request (use no-store).

Update:

Show "Update Available" banner when SW waits.

8.4 UI Error Prevention (Crucial)

To prevent "White Screen of Death" scenarios:

Router Safety: If a route is requested that has no matching DOM template (e.g. view-settings missing), the router must catch this and redirect to home or show a 404 toast, rather than crashing.

Action Guards: "Flip Card" and "Rate Card" buttons must contain Guard Clauses to check if a valid card is currently loaded.

Scenario: User mashes "Pass" button at the end of a session.

Behavior: App must ignore the click if studyQueue is empty, not throw TypeError.

Empty State: The Study screen must render a specific "All caught up" state if queue.length === 0, and disable all interaction buttons (Flip/Rate).

9. Test Cases (Acceptance Criteria)

The "Paris" Test:

Train card001 (Q: 2+2, A: 4) to Box 3.

Edit CSV: card001 becomes (Q: Capital?, A: Paris).

Sync.

Expectation: card001 is now Box 0 (Due Now).

The "Cloze Edit" Test:

Train card001::cloze (Notes: "Paris is {{beautiful}}") to Box 3.

Edit CSV: Notes become "Paris is {{large}}".

Sync.

Expectation: card001::qa (if unchanged) stays Box 3. card001::cloze resets to Box 0.

The "Missing Marker" Test:

CSV Row has Notes: "Just some text".

Expectation: No ::cloze variant is generated. Progress for ::cloze is ignored/skipped in queue.

Offline Load:

Load app, sync, turn off WiFi.

Refresh page.

Expectation: App loads, study session works.

Empty Queue Interaction (UI Safety):

Complete all cards.

Click "Flip" or "Rate" buttons rapidly.

Expectation: No console errors; app remains stable.

Sibling Spacing Test:

Force 5 pairs of (QA + Cloze) variants to be due immediately.

Expectation: When studying, the user should never see card001::qa immediately followed by card001::cloze (unless the queue is extremely small).