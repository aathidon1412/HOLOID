I’ll draft ready-to-paste Gemini prompts for each diagram type, tailored to your HOLOID project structure and written in a Rational Rose-style modeling format. Next I’ll give you one reusable context block plus separate prompts for all 9 diagrams.

Use this approach in Gemini: paste the **Common Project Context** once, then run each diagram prompt separately for best output quality.

## Common Project Context (paste once before any diagram prompt)

You are a senior software architect.  
Create formal, tool-friendly diagrams in a Rational Rose-like modeling style: clear notation, consistent naming, layered structure, and professional labels.

System name: **HOLOID**  
Domain: emergency healthcare coordination platform.

Tech stack:
- Frontend: React + TypeScript (Vite), UI components, dashboards, role-based pages.
- Backend: Node.js + Express, REST APIs, JWT auth, RBAC middleware, services, controllers, models.
- Data: MongoDB with Mongoose models.

Major backend modules:
- Auth: login/register/token/user session and role handling.
- Hospital operations: hospitals, bed slots, occupancy.
- Resource management: oxygen, blood, medicines, inventory tracking.
- Logistics: ambulance and transfer flows.
- Command center: centralized monitoring and orchestration.
- Notifications: push/email alerts.
- Audit logging and activity traceability.

Key entities (from models):
User, Hospital, BedSlot, Resource, HospitalResourceInventory, Ambulance, Patient, Transfer, PushSubscription, AuditLog.

Output requirements for every diagram:
- Include title, assumptions, and legend.
- Use consistent identifiers and names across all diagrams.
- Show cardinalities, directions, and constraints where relevant.
- Add short explanation after the diagram.
- If any detail is missing, make explicit assumptions and label them clearly.

Preferred output format:
1) PlantUML (primary)  
2) Mermaid (secondary, if possible)

---

## 1) Architecture Diagram Prompt

Create a **high-level architecture diagram** for HOLOID showing:
- Client layer (React web app, role-specific dashboards).
- API layer (Express routes/controllers).
- Business/service layer (auth, bed reservation, logistics, notifications, audit, token/map services).
- Data layer (MongoDB models and collections).
- External integrations (email/push/maps).
- Cross-cutting concerns (RBAC, validation, error handling, logging).

Show deployment-style boundaries and data/control flow between layers.  
Use C4-style container clarity combined with UML component rigor.

---

## 2) Data Flow Diagram Prompt

Create a **Data Flow Diagram (DFD)** for HOLOID:
- Context Level (Level 0): system + external actors (Admin, Hospital Staff, Command Center, Logistics Team, Notification Services).
- Level 1: decompose into core processes:
  Auth & Access Control, Bed Management, Resource Management, Transfer & Ambulance Dispatch, Notification Engine, Audit Logging.
- Data stores: User DB, Hospital/Bed DB, Resource Inventory DB, Transfer DB, Audit DB, Subscription DB.
- Show major input/output flows and named data packets (e.g., admission request, occupancy update, dispatch order, alert payload).

Use proper DFD conventions (process, data store, external entity, flow arrows).

---

## 3) UML Diagram Prompt (Use Case + Class Overview)

Create a **UML set** containing:
1. Use Case Diagram:
   - Actors: Admin, Command Center Operator, Hospital Operator, Logistics Operator, Notification Service.
   - Use cases: Authenticate, Manage Users, Manage Hospitals, Update Bed Status, Track Resource Inventory, Request Transfer, Dispatch Ambulance, Send Alerts, View Dashboard, Audit Review.
2. High-level Class Diagram:
   - Core classes/entities and key associations among User, Hospital, BedSlot, Resource, HospitalResourceInventory, Ambulance, Patient, Transfer, PushSubscription, AuditLog.
   - Show multiplicity and key attributes only.

Keep naming consistent with backend model names.

---

## 4) Sequence Diagram Prompt

Create a **sequence diagram** for this scenario:  
“Command center receives a critical patient transfer request and dispatches ambulance while notifying stakeholders.”

Include lifelines:
Frontend UI, Auth Middleware, CommandCenter Controller, Logistics Controller, Transfer Service, Ambulance model/service, Notification service, Audit service, MongoDB.

Show:
- Auth + RBAC check.
- Transfer creation.
- Ambulance selection/assignment.
- Notification trigger (push/email).
- Audit log write.
- Response back to UI.

Add alternate paths:
- No ambulance available.
- Authorization failure.
- Notification service failure with retry/fallback.

---

## 5) Component Diagram Prompt

Create a **UML component diagram** for HOLOID backend + frontend:
- Frontend components (dashboards, sidebar/topbar, metrics, transfer history).
- Backend components (routes, controllers, middleware, services, models, utils).
- Explicit provided/required interfaces (REST endpoints, service interfaces, notification adapters).
- Dependencies between modules:
  Auth, Hospital, Resource, Logistics, Command Center, Notification, Audit.
- Mark reusable shared components (error handler, validator, RBAC, API response wrapper).

Use strict component notation with interfaces and dependency arrows.

---

## 6) Entity Relationship Diagram Prompt

Create a **logical ER diagram** for HOLOID data model using these entities:
User, Hospital, BedSlot, Resource, HospitalResourceInventory, Ambulance, Patient, Transfer, PushSubscription, AuditLog.

Show:
- Primary keys.
- Foreign-key-style references (even if MongoDB stores ObjectIds).
- One-to-one, one-to-many, many-to-many relationships.
- Junction/associative behavior where needed (e.g., inventory by hospital and resource).
- Important business constraints (e.g., transfer must reference patient, source, destination).

Provide a short relationship rules summary.

---

## 7) Schema Diagram Prompt

Create a **MongoDB schema diagram** (document model view):
- For each collection, list key fields, types, required flags, enums, indexes, and references.
- Show embedded vs referenced design choices.
- Include audit and notification-related schemas.
- Highlight validation constraints and unique fields.
- Include timestamps and status lifecycle fields where appropriate.

Output should resemble a production-ready schema map for engineering documentation.

---

## 8) Table Structure Diagram Prompt

Create a **table-structure style diagram** (RDBMS-style representation of MongoDB collections) for documentation:
- Each collection shown as a table-like block with:
  field name, type, nullable, default, key/index marker, description.
- Include PK-equivalent `_id`, logical FK references, and indexed fields.
- Add “candidate relational mapping” notes for migration/reporting contexts.

Use clear, compact tabular visual blocks.

---

## 9) Relationship Mapping Diagram Prompt

Create a **relationship mapping diagram** focused on business interactions:
- User-to-Hospital ownership/assignment.
- Hospital-to-BedSlot composition.
- Hospital-to-Inventory relationship via HospitalResourceInventory.
- Transfer linking Patient, source Hospital, destination Hospital, and Ambulance.
- Notification and Audit relationships to domain events.
- Identify strong vs weak dependencies and lifecycle ownership.

Include:
- Cardinality labels.
- Directional semantics.
- Event-driven relationships (who emits/consumes events).

---

If you want, I can also generate a **single mega-prompt** that asks Gemini to output all 9 diagrams in one run, plus a stricter version that forces consistent IDs and naming across every diagram.
