Abstract: Hospital Bed & Resource Management System

1. Project Overview
This project focuses on the development of a comprehensive Hospital Bed and Resource Management System (HBRMS) designed to handle large-scale medical emergencies such as pandemics or natural disasters. The system is a centralized web-based platform built to address critical challenges in managing hospital capacity, specifically tracking bed availability, coordinating ambulance routing, and forecasting resource shortages.

Definition of Key Terms:
- MERN Stack: MongoDB, Express.js, React.js, Node.js.
- JWT: JSON Web Token, used for secure authentication and activation links.
- Socket.io: real-time, bi-directional communication library for live dashboards.

2. Why Does It Matter?
In emergency scenarios, lack of real-time visibility into resource availability leads to delayed transfers and increased mortality. Manual coordination and poor demand forecasting often result in critical resource shortages. HBRMS ensures hospital staff can locate available beds instantly and reduces ambulance deadlock.

3. Project Duration
- 1.5 months

4. Expected Outcomes
- Reduced Wait Times: average bed search time < 5 minutes.
- High Accuracy Forecasting: target >85% prediction accuracy for resource shortages (ML-driven).
- Optimized Response: improved ambulance routing and transfer coordination.
- Proactive Procurement: 7–30 day forecasting for procurement planning.

5. Proposal
Secure, role-based platform for Hospital Administrators, Doctors, and Government Officials integrating three core modules:
1. Real-Time Tracking: live inventory of ICU, General, Ventilator, Oxygen-supported beds.
2. Logistics Management: intelligent ambulance routing and patient transfer.
3. Predictive Intelligence: ML dashboard for demand forecasting.

6. Ideology & Concept
Core ideology: "Centralized Transparency" — connect hospitals into a single, secure network to move from reactive to proactive resource management.

7. Technical Stack (MERN + extras)
- Frontend: React.js
- Backend: Node.js + Express.js
- Database: MongoDB
- Real-Time: Socket.io
- ML: Python/TensorFlow (integrated separately)
- Maps: Google Maps / OpenStreetMap for routing

8. System Workflow
1. Registration → JWT-based activation link emailed.
2. Verification → activate account via token.
3. Data Input → admins update bed counts.
4. Real-Time Processing → updates pushed via WebSockets.
5. Decision Support → immediate routing/nearest-bed search and ML forecasts for future capacity.

9. End User Experience
- Hospital Admins: simple UI to update inventory and receive alerts.
- Doctors/Ambulance Staff: live dashboard to locate beds and plan transfers.
- Government Officials: command-center views for region-wise occupancy and forecasting.

---

Backend — Current Status (what's done)
- Project scaffold: `src/app.js` and `src/server.js` (HTTP + Socket.IO startup).
- Environment & DB: `src/config/db.js` connects to MongoDB.
- Auth: registration, JWT activation-link flow, login, logout, token verification implemented (`src/controllers/authController.js`, `src/routes/authRoutes.js`, `src/services/tokenService.js`).
- Email: `src/services/emailService.js` sends activation link (console fallback available).
- Models: `User` and `Hospital` implemented; `Resource` model present (bed types and statuses).
- Resource APIs: `backend/routes/resourceRoutes.js` and `backend/controllers/resourceController.js` implemented for create, update bed status, and list resources.
- Socket.IO: initialized in `src/server.js`; socket auth via access token added, `join-region`, `subscribe-hospital` room handlers implemented.
- Events: `bed-update` (full resource) and `bed-status-changed` (concise event) are emitted on updates.
- Middleware: `authMiddleware.js` (JWT verification) and `rbacMiddleware.js` available; `errorHandler.js` in place.
- Smoke tests: `backend/scripts/authSmokeTest.js` and `backend/scripts/socketSmokeTest.js` created and executed successfully locally.

Backend — Remaining / Recommended Tasks
- Consolidate legacy/duplicate code under `backend/` root (remove or merge older files like `backend/models/*` vs `src/models/*`).
- Resource model enhancements: add numeric counts, per-ward breakdowns, and validation for bed counts.
- Robust validation & tests: add unit/integration tests for resource APIs, auth flows, and socket events; add CI.
- Refresh tokens & logout hardening: implement refresh token flow and persistent revocation store (Redis) for production.
- Socket hardening: validate socket subscriptions server-side (hospital membership), support token refresh for sockets, and rate-limit events.
- Logistics module: implement hospital-search by availability, nearest-hospital lookup (map integration), and transfer request/track endpoints.
- Map integration: backend services for distance/routing using Google Maps or OSM (mapService skeleton exists; needs API wiring and caching).
- Command-center views & aggregation APIs: region-wise summaries, critical hospital lists, and audit logs for transfers/updates.
- Predictive intelligence: pipeline to export historical data for ML models, endpoints to fetch forecasts, and scheduled jobs to precompute forecasts.
- API documentation: OpenAPI/Swagger spec for all endpoints and Socket events.
- Security & ops: rate limiting, input sanitization, CORS hardening, secrets management, production logging/monitoring.

Immediate next steps (recommended order):
1. Consolidate models and remove legacy duplicates.
2. Harden auth (refresh tokens) and socket authentication refresh.
3. Add resource model counts and validation, then write resource API tests.
4. Implement logistics endpoints + map integration.
5. Add OpenAPI docs and CI tests.

---

If you want, I can now implement any of the remaining items (pick one):
- consolidate legacy files, or
- extend resource model with counts + add tests, or
- implement logistics endpoints (search/nearest/transfer), or
- harden socket auth (refresh tokens + server-side subscription validation).
