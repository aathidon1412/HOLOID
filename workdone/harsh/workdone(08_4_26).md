# Work Done - 08/04/2026

## Phase Summary

Today's backend phase focused on making HBRMS production-aware for granular bed tracking and real-time synchronization.

Completed areas:

1. Resource data model redesigned for per-ward nesting while preserving numeric counts.
2. REST APIs expanded to create/update inventory and update bed status at ward granularity.
3. Strict request validation added for bed status updates using express-validator.
4. Socket.io behavior upgraded to emit two event types:
	 - bed-update: full payload
	 - bed-status-changed: delta payload
5. Integration tests added using Jest + Supertest with mocked DB and mocked Socket.io.

---

## 1. Data Modeling: The Per-Ward Complexity

### Why nested arrays for wards?

Current shape (simplified):

```json
{
	"hospital": "ObjectId",
	"region": "north",
	"wards": [
		{
			"wardName": "Ward A",
			"beds": [
				{ "type": "ICU", "status": "Vacant", "count": 3 },
				{ "type": "ICU", "status": "Occupied", "count": 7 }
			]
		}
	]
}
```

Pros of nested wards in one Resource document:

1. Locality of data: one read returns the full hospital inventory tree.
2. Fewer joins/lookups: no extra collection hops for common dashboard reads.
3. Easier event broadcasting: one write can produce one full payload for bed-update.
4. Natural fit for "hospital as aggregate root" domain model.

Cons of nested wards:

1. Update complexity: positional updates in deeply nested arrays are harder and easier to get wrong.
2. Write contention risk: multiple admins editing different wards still touch one top-level document.
3. Document growth concern: very large hospital footprints can approach MongoDB document size limits.
4. Limited independent indexing for each ward compared to a dedicated collection.

### Alternative: separate collections (Ward, BedBucket)

Potential design:

- Resource collection: hospital-level metadata.
- Ward collection: one document per ward.
- BedBucket collection: one document per ward x type x status.

Advantages of separate collections:

1. Better write parallelism with lower conflict chance.
2. More targeted indexes and partial indexes.
3. More scalable when ward count is large and dynamic.

Disadvantages:

1. Multi-collection read composition complexity.
2. Higher query overhead for full inventory snapshots.
3. More moving parts in transactional consistency.

### Efficient ICU availability aggregation in nested model

Goal: total number of Vacant ICU beds across all wards for a hospital.

Aggregation pattern:

```js
[
	{ $match: { hospital: ObjectId(hospitalId) } },
	{ $unwind: "$wards" },
	{ $unwind: "$wards.beds" },
	{ $match: { "wards.beds.type": "ICU", "wards.beds.status": "Vacant" } },
	{ $group: { _id: "$hospital", totalAvailableIcuBeds: { $sum: "$wards.beds.count" } } }
]
```

Operational notes:

1. Add compound index on hospital + wards.beds.type + wards.beds.status.
2. Always match hospital first to reduce unwind fan-out.
3. Return 0 when aggregation result is empty.

Nook and corner:

- If a ward accidentally stores duplicate type/status pairs, totals inflate. Guard with schema-level uniqueness validation per ward (type+status pair uniqueness).

---

## 2. The Validation Layer (express-validator)

### Why validate at route layer before Mongoose?

Validation responsibility is layered:

1. Route-level validation (express-validator): request contract and syntax.
2. Controller-level checks: business meaning and flow decisions.
3. Mongoose schema validation: persistence safety.

Benefits of early route validation:

1. Fast fail before any DB call.
2. Consistent 400 shape with an errors array.
3. Cleaner controllers (less repetitive field parsing).
4. Better API ergonomics for frontend form mapping.

### How this helps security and NoSQL hardening

In this endpoint, validation enforces:

1. hospitalId is a valid MongoDB ObjectId.
2. bedType is from strict enum set.
3. status is from strict enum set.

Why this matters:

1. Prevents malformed selectors from reaching query builders.
2. Reduces risk of query-shape abuse where attacker sends object payloads instead of expected scalar values.
3. Makes behavior deterministic under malformed client payloads.

Important nuance:

- Validation is necessary but not sufficient against all NoSQL injection classes.
- Continue using strict query construction (no raw user object spreading into filters) and avoid dynamic operator pass-through.

Nook and corner:

- For additional hardening, use explicit sanitizers (trim, escape where appropriate) and reject unknown fields for mutation endpoints.

---

## 3. Advanced Real-Time Engine (Dual Events)

### Why emit both bed-update and bed-status-changed?

Both events solve different frontend problems:

1. bed-update (full payload)
	 - Best for state replacement.
	 - Useful when client joins late or suspects drift.
	 - Ideal for reducers that replace hospital/region inventory wholesale.

2. bed-status-changed (delta payload)
	 - Best for low-latency UI cues and notifications.
	 - Lightweight for toast/timeline/alert streams.
	 - Minimizes payload cost during high-frequency updates.

Frontend consumption guidance:

1. Use bed-status-changed for immediate UI feedback.
2. Use bed-update as periodic source-of-truth sync (or on reconnect).
3. If conflict detected on client, prioritize latest bed-update snapshot.

### Room scoping behavior when hospital region changes

Key behavior:

1. io.to(region) targets current room membership, not historical region values.
2. If hospital region changes in DB, connected clients still remain in old region room until they re-join new room.

Implications:

1. Existing sockets may stop receiving updates if room migration is not handled.
2. Backend should emit region-change signal and/or enforce room re-subscribe logic.

Recommended mitigation:

1. On region update, emit a region-changed event to hospital room and old region room.
2. Client handles event by leaving old room and joining new room.
3. On reconnect, always re-emit join-region from authoritative profile/hospital data.

Nook and corner:

- If routing key is mutable (region), keep a stable hospital room channel as a fallback sync path.

---

## 4. Testing Strategy (Jest & Supertest)

### Why mock MongoDB connection and Socket.io?

Mocking in tests does three critical things:

1. Isolation: tests verify API logic, not external infra availability.
2. Determinism: no network jitter, no flaky DB latency.
3. Speed: fast suite execution suitable for pre-merge CI.

CI/CD relevance:

1. Pipelines run in ephemeral containers; external DB dependency increases flake risk.
2. Unit/integration-with-mocks serves as fast gate.
3. Full end-to-end with real DB can run separately as slower nightly or pre-release stage.

### What current tests explicitly verify

Implemented checks:

1. GET by region returns 200 and expected payload.
2. POST create inventory returns 201.
3. Invalid bedType returns 400 with validation errors array.
4. Successful bed update triggers Socket.io emit for both event types.

Express-validator edge cases explicitly covered right now:

1. bedType enum rejection (invalid value path).

Validator edges not yet covered in the current suite (recommended next):

1. Invalid hospitalId format.
2. Missing status.
3. Invalid status enum.
4. Empty body.

Nook and corner:

- Presence of mocked Resource methods means tests are API-contract-focused, not Mongo operator correctness tests. Keep one additional test layer for real Mongo semantics.

---

## 5. Nooks, Corners & Concurrency

### The Counter Problem (simultaneous admin updates)

Risk scenario:

1. Admin A and Admin B load the same state.
2. Both write direct assignment on occupied count.
3. Last write wins, causing silent lost update.

Safer approaches:

1. Use atomic increments with $inc when mutation is relative (for example +1 occupied, -1 vacant).
2. Use optimistic concurrency control (document version key check) for absolute writes.
3. Consider MongoDB transactions for multi-counter invariants (Occupied + Vacant + Maintenance consistency).

Recommended invariant pattern:

1. Keep total bed capacity per type immutable per ward.
2. Validate status-bucket sum equals capacity after mutation.
3. Reject write if precondition fails.

Nook and corner:

- If one API updates status and another updates count directly, invariants can diverge. Funnel all count mutations through one command-style endpoint.

### Socket disconnect and missed event recovery

Scenario:

Doctor is offline for 30 seconds exactly while bed-status-changed is emitted.

What happens:

1. Socket.io does not replay missed custom events by default after reconnect.
2. Client may miss critical delta and show stale UI.

Recovery strategy:

1. On reconnect, client triggers full snapshot fetch (GET resource by hospital or region).
2. Optionally request latest bed-update from server side replay cache.
3. Rejoin all relevant rooms (region and hospital).

Advanced option:

1. Add monotonic event sequence numbers.
2. Client tracks last sequence.
3. On reconnect, request delta replay from last seen sequence.

Nook and corner:

- Dual-event model helps here: delta can be missed, but full snapshot event or REST pull restores truth.

---

## Practical Takeaways From This Phase

1. Nested ward modeling is powerful for read locality but needs careful update and concurrency discipline.
2. Route-level validation protects API contracts early and keeps controllers focused.
3. Real-time systems benefit from split event semantics: snapshot + delta.
4. Mock-driven integration tests are ideal for fast, stable CI gates.
5. The next maturity jump is concurrency-safe counters and reconnect replay/catch-up semantics.

## Suggested Next Steps

1. Add validator tests for invalid hospitalId and invalid status.
2. Introduce optimistic concurrency checks for count writes.
3. Add reconnect catch-up flow in frontend using snapshot pull + room rejoin.
4. Add one real Mongo integration suite (separate from mocked tests) for update/aggregate correctness.

