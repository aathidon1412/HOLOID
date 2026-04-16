## Plan: HOLOID Phase 1-3 Operational Upgrade

Upgrade HOLOID from aggregate bed counts to patient-linked bed occupancy, add a mobile-first ambulance logistics workflow with live dispatch tracking, and deliver a non-AI forecasting module now (AI engine explicitly deferred). The approach reuses current transfer/socket architecture and introduces transactional reservation, role-based workflows, and forecast pipelines incrementally to avoid breaking existing operations.
Status: Approved for implementation handoff on 2026-04-16.

**Current Completion Snapshot (2026-04-16)**
- Completed: Phase 0, Phase 1A, Phase 1B, Phase 1C, Phase 1D, Phase 1E, Phase 2A, Phase 2B, Phase 2C, Phase 2D, Phase 2E
- In Progress: None
- Not Started: Phase 3A, Phase 3B


**Steps**
1. [Completed] Phase 0 - Stabilize baseline contracts before feature work: align frontend API clients to one auth token source and one transport helper, enforce role-aware routing guard, and document endpoint aliases. This prevents regressions while adding new roles and portals.
2. [Completed] Phase 1A - Add granular occupancy domain models (*depends on 1*): introduce patient identity entity (minimal fields), per-bed slot entity, and admission/assignment linkage so each patient maps to one explicit bed reservation/occupancy record.
3. [Completed] Phase 1B - Implement atomic bed reservation and release workflows (*depends on 2*): add transactional service methods used by transfer creation/accept/completion paths to prevent double booking under concurrent requests.
4. [Completed] Phase 1C - Introduce dedicated ground-data roles (*depends on 1, parallel with 2*): add BED_MANAGER and DATA_ENTRY roles in auth/RBAC, extend approval chain, and scope permissions to hospital-owned inventory operations.
5. [Completed] Phase 1D - Build streamlined Bed Manager UI (*depends on 2,4*): create a simplified data-entry experience focused on assign patient to bed, mark bed state transitions, and release/discharge actions without exposing analytics-heavy navigation.
6. [Completed] Phase 1E - Real-time occupancy propagation (*depends on 3,5*): emit and consume new socket events for bed reserved/occupied/released updates so all role dashboards reflect consistent live occupancy.
7. [Completed] Phase 2A - Driver/ambulance operational model (*depends on 1*): add ambulance and driver profile domain objects plus transfer-assignment fields to support dispatch acceptance and in-transit lifecycle ownership.
8. [Completed] Phase 2B - Ambulance Driver Portal (mobile-first) (*depends on 7, parallel with 9*): add AMBULANCE_DRIVER route set, lightweight dispatch inbox, accept/reject, status logging (En Route, Arrived), and transfer history tailored for low-interaction mobile usage.
9. [Completed] Phase 2C - Live GPS and ETA engine (*depends on 7*): implement adaptive location cadence (5s while moving, 30s when idle/arrived), stream GPS points to backend sockets, recalculate ETA with existing route provider service, and reflect movement in command-center map views. Interim acceptance: allow manually entered dispatch/location status updates until full live GPS pipeline is active.
10. [Completed] Phase 2D - Push dispatch alerts (*depends on 8*): add Web Push subscription registration and dispatch trigger pipeline so drivers receive urgent alerts instantly; retain email as informational fallback only.
11. [Completed] Phase 2E - Command center live map upgrade (*depends on 9,10*): replace static regional map visuals with OpenStreetMap-based rendering (Leaflet/OpenFreeMap, no API key), live ambulance markers, transfer states, and ETA overlays for admins/government users. Interim acceptance: map status may be manually entered and updated by operators.
12. [Not Started] Phase 3A - Forecasting without external AI (*depends on 1,6,9*): implement scheduled heuristic forecasting (rolling trend + seasonality-lite) from occupancy and transfer history, store forecast snapshots, and expose 7/14/30-day shortage risk APIs.
13. [Not Started] Phase 3B - Forecast visualization and governance (*depends on 12*): wire admin/government analytics screens to forecast APIs, add risk bands and shortage warnings, and keep an abstraction seam for future external AI provider integration (deferred scope).
## Implementation checkpoint 
- 2026-04-16 (Batch 1) completed: backend roles expanded, approval flow updated, frontend role-aware routing added, starter pages created for BED_MANAGER/DATA_ENTRY/AMBULANCE_DRIVER, axios token source unified, frontend build + filtered backend tests passing.
- 2026-04-16 (Phase 1A/1B backend): added Patient and BedSlot models, transactional bed reservation in transfer creation, reservation lifecycle handling on status updates (occupied/released), expanded bed statuses (Reserved/Unavailable), and updated backend model/integration tests to passing state.
- 2026-04-16 (Phase 1D workflow): added Bed Manager APIs for open transfer queue and bed-slot operations, wired logistics routes for slot assign/release/status updates, implemented live Bed Manager and Data Entry consoles with API actions (assign, mark arrived/cancel, rapid status transitions, release/discharge), and validated with backend tests + frontend production build.
- 2026-04-16 (Phase 1E start): backend now emits bed-slot-reserved, bed-slot-occupied, bed-slot-released, and bed-slot-status-changed events from transfer and bed-slot lifecycle operations; frontend Bed Manager, Data Entry, Admin Inventory, and Admin Transfers subscribe to these events and refresh hospital-scoped occupancy data in near real time.
- 2026-04-16 (Phase 1E complete): stabilized occupancy propagation by wiring slot lifecycle events to both hospital and region channels, adding user-room dispatch fanout support, and validating live refresh behavior across bed manager, data-entry, admin inventory, and transfer operations screens.
- 2026-04-16 (Phase 2A complete): added Ambulance domain model, extended Transfer schema with ambulance/driver dispatch metadata and workflow timeline, implemented ambulance management + manual dispatch-assignment APIs, and integrated automatic driver dispatch assignment during transfer creation when eligible resources exist.
- 2026-04-16 (Phase 2B complete): implemented AMBULANCE_DRIVER dispatch board with mobile-first inbox/history views, accept/reject dispatch actions, en-route/arrived/in-transit/handover status progression, realtime socket updates for dispatch lifecycle events, and backend driver-scoped dispatch APIs for operational ownership.
- 2026-04-16 (Phase 2C complete): added driver GPS ingestion endpoint with adaptive cadence handling, persisted transfer-level location timeline, recalculated destination ETA and distance with existing map service, and emitted live dispatch-location updates for driver/hospital/region/command-center listeners.
- 2026-04-16 (Phase 2D complete): added Web Push subscription model and service, exposed push public-key + subscribe/unsubscribe notification APIs, triggered push alerts for dispatch assignment, and retained email notification as informational fallback delivery.
- 2026-04-16 (Phase 2E complete): added command-center live fleet aggregation API, enabled government command-center socket room fanout, migrated GovMap to OpenStreetMap Leaflet live overlays, and rewired GovCommandCenter to live occupancy/critical/fleet data feeds.


**Relevant files**
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/models/Resource.js - Existing ward/status aggregate structure that must be reconciled with per-bed tracking.
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/models/Transfer.js - Transfer lifecycle schema to extend with reservation/dispatch/driver linkage.
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/models/User.js - Role enum and approval metadata extension point.
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/utils/roles.js - Add BED_MANAGER, DATA_ENTRY, AMBULANCE_DRIVER role constants.
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/controllers/logisticsController.js - Existing transfer creation/status logic where atomic reservation must be inserted.
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/controllers/resourceController.js - Existing bed state update flow and socket emission patterns to extend.
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/routes/logisticsRoutes.js - Add/reshape dispatch, GPS, and status endpoints.
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/routes/userRoutes.js - Approval/listing updates for new operational roles.
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/server.js - Socket channel extensions for driver and live location streams.
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/services/mapService.js - Route/ETA recalculation integration point.
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/services/emailService.js - Keep non-urgent fallback notifications; avoid primary dispatch usage.
- d:/College Studies/FSD Lab/Project/HOLOID/backend/src/controllers/commandCenterController.js - Extend with live fleet and forecast read models.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/contexts/AuthContext.tsx - Add new roles and normalized auth state usage.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/components/RequireAuth.tsx - Upgrade to role-aware route guard.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/App.tsx - Add Bed Manager and Ambulance Driver route trees.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/components/AppSidebar.tsx - Role-specific navigation entries.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/layouts/DashboardLayout.tsx - Mobile-first sidebar/drawer behavior for driver usage.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/contexts/SocketContext.tsx - Driver/hospital/command-center subscription channels.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/hooks/useSocket.ts - Existing reusable event subscription hook.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/pages/admin/AdminInventory.tsx - Basis for simplified bed data-entry workflow.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/pages/admin/AdminTransfers.tsx - Existing transfer acceptance UI patterns to repurpose for dispatch.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/pages/doctor/DoctorRequestTransfer.tsx - Existing transfer request workflow that must reserve specific bed slots.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/pages/gov/GovCommandCenter.tsx - Replace static metrics with live dispatch/occupancy feed.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/pages/gov/GovMap.tsx - Replace static SVG with OpenStreetMap map rendering (Leaflet/OpenFreeMap, no API key), then evolve to live GPS overlays.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/lib/api.ts - Canonical API helper to standardize auth and errors.
- d:/College Studies/FSD Lab/Project/HOLOID/frontend/src/api/axiosInstance.js - Legacy client to consolidate or deprecate.

**Verification**
1. Backend model and API verification: add integration tests for patient-to-bed assignment, concurrent reservation conflict handling, dispatch accept/reject, and GPS status progression.
2. Socket verification: validate bed-reservation and GPS events are delivered to hospital, driver, and command-center subscriptions with expected payload shapes.
3. Role/RBAC verification: test BED_MANAGER and DATA_ENTRY can update only authorized hospital inventory; AMBULANCE_DRIVER cannot access admin/doctors pages or endpoints.
4. Push dispatch verification: register driver push subscription, trigger dispatch, and verify notification receipt latency and payload correctness.
5. ETA/GPS verification: simulate moving coordinates and confirm adaptive cadence switching and ETA recalculation behavior; confirm manual status entry fallback updates map state correctly during interim rollout.
6. Map provider verification: confirm frontend uses OpenStreetMap/Leaflet (or OpenFreeMap) tiles directly, with no Google Maps integration and no VITE_GOOGLE_MAPS_API_KEY requirement.
7. Forecast verification: run scheduler against historical snapshots, assert 7/14/30 outputs persist and render on admin/government analytics pages.
8. Regression checks: run backend and frontend test suites and smoke test existing doctor transfer flow remains functional.

**Decisions**
- Decision: Use two distinct operational roles in Phase 1 - BED_MANAGER and DATA_ENTRY.
- Decision: Patient identity scope is minimal for now (patientId, name, age, sex, requiredBedType).
- Decision: Primary urgent dispatch channel is Push notifications.
- Decision: GPS cadence is adaptive (5s moving, 30s idle/arrived).
- Decision: Map integration uses a completely free, no-key approach (OpenStreetMap via Leaflet/OpenFreeMap) with direct public tile access.
- Decision: Google Maps API and VITE_GOOGLE_MAPS_API_KEY are out of scope and must not be required.
- Decision: For Phase 2C-2E interim rollout, map/dispatch status can be manually entered by operators and treated as sufficient completion status.
- Decision: External AI engine is excluded for now; Phase 3 delivers non-AI forecasting with an integration seam for future AI.
- Included scope: Bed-slot reservation integrity, driver ground workflow, live map visibility, and forecast-driven warning panels.
- Excluded scope: Immediate external ML microservice, SMS-first dispatch channel, and multi-tenant multi-instance socket scaling hardening.

**Further Considerations**
1. Bed-slot migration strategy: Option A one-time migration from aggregate counts to generated bed IDs, Option B hybrid mode where both aggregate and slot records coexist temporarily (recommended Option B for safer rollout).
2. Push channel fallback policy: Option A push-only strict, Option B push + in-app banner + email fallback (recommended Option B for reliability).
3. Forecast method hardening: Option A moving-average + trend only now, Option B add seasonal decomposition if 90+ days of data exists (recommended Option B when dataset is sufficient).