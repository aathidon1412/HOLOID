# HOLOID Backend — Modules Reference

> A complete, code-free explanation of every module in the backend — what it is, what it does, how it connects to the rest of the system, and why it exists.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Entry Points](#2-entry-points)
   - [server.js — The Launcher](#serverjs--the-launcher)
   - [app.js — The Express Application](#appjs--the-express-application)
3. [Configuration](#3-configuration)
   - [config/db.js — Database Connection](#configdbjs--database-connection)
4. [Routes](#4-routes)
   - [authRoutes.js](#authroutesjs)
   - [resourceRoutes.js](#resourceroutesjs)
   - [logisticsRoutes.js](#logisticsroutesjs)
   - [commandCenterRoutes.js](#commandcenterroutesjs)
   - [notificationRoutes.js](#notificationroutesjs)
   - [hospitalRoutes.js](#hospitalroutesjs)
   - [userRoutes.js](#userroutesjs)
5. [Controllers](#5-controllers)
   - [authController.js](#authcontrollerjs)
   - [resourceController.js](#resourcecontrollerjs)
   - [logisticsController.js](#logisticscontrollerjs)
   - [commandCenterController.js](#commandcentercontrollerjs)
   - [notificationController.js](#notificationcontrollerjs)
6. [Models (Database Schemas)](#6-models-database-schemas)
   - [User.js](#userjs)
   - [Hospital.js](#hospitaljs)
   - [Resource.js](#resourcejs)
   - [HospitalResourceInventory.js](#hospitalresourceinventoryjs)
   - [Transfer.js](#transferjs)
   - [AuditLog.js](#auditlogjs)
7. [Middleware](#7-middleware)
   - [authMiddleware.js](#authmiddlewarejs)
   - [rbacMiddleware.js](#rbacmiddlewarejs)
   - [errorHandler.js](#errorhandlerjs)
   - [validate.js](#validatejs)
8. [Services](#8-services)
   - [tokenService.js](#tokenservicejs)
   - [emailService.js](#emailservicejs)
   - [mapService.js](#mapservicejs)
   - [auditService.js](#auditservicejs)
9. [Utilities](#9-utilities)
   - [ApiError.js](#apierrorjs)
   - [ApiResponse.js](#apiresponsejs)
   - [catchAsync.js](#catchasyncjs)
   - [roles.js](#rolesjs)
   - [bedType.js](#bedtypejs)
10. [How Everything Connects](#10-how-everything-connects)
11. [Technology Stack](#11-technology-stack)

---

## 1. Project Overview

**HOLOID** is a hospital resource management and patient logistics platform. Its backend is responsible for:

- **User authentication** — secure login with email-based account activation.
- **Hospital resource inventory** — tracking how many beds of each type are available across wards.
- **Patient transfer logistics** — matching patients to hospitals with available capacity, calculating routes, and managing the transfer lifecycle.
- **Command center analytics** — giving officials a real-time occupancy view across all hospitals and regions.
- **Notifications** — sending emails for critical capacity alerts and transfer events.
- **Real-time updates** — broadcasting live bed changes to connected clients via WebSockets.

The project follows a standard **layered architecture**:

```
HTTP Request
   ↓
Routes         (define URL paths and wire middleware + controllers)
   ↓
Middleware     (authentication, validation, error handling)
   ↓
Controllers    (receive the request, contain the business logic)
   ↓
Services       (reusable utilities: email, maps, tokens, audit logs)
   ↓
Models         (MongoDB schemas — the shape of all stored data)
   ↓
Database       (MongoDB via Mongoose)
```

---

## 2. Entry Points

### `server.js` — The Launcher

**File:** `src/server.js`

This is the file that actually **starts** the application. It is the main entry point listed in `package.json`. Everything that requires startup-time initialization happens here — not in `app.js`.

**What it does:**

1. **Loads environment variables** from the `.env` file using `dotenv`.
2. **Connects to MongoDB** by calling the database configuration module.
3. **Creates the HTTP server** (wrapping the Express app) so that Socket.IO can share the same port.
4. **Initializes Socket.IO** on the HTTP server, with CORS configured to accept connections from the frontend URL.
5. **Mounts the resource routes** — these are mounted here (not in `app.js`) because they need access to the `io` (Socket.IO) instance to emit real-time events.
6. **Sets up Socket.IO authentication middleware** — every WebSocket connection must provide a valid JWT token. If the token is missing or invalid, the connection is rejected immediately.
7. **Sets up Socket.IO event handlers** — handles `join-region`, `subscribe-hospital`, and `unsubscribe-hospital` events from clients.
8. **Attaches the 404 and error handler middleware** — these must be mounted last so all routes registered above them are reachable.
9. **Starts listening** on the configured port (default: 5000).

**Why it's separate from `app.js`:** Separating the HTTP/Socket bootstrap from the Express route configuration makes the app easier to test — tests can import `app.js` directly without starting the server.

---

### `app.js` — The Express Application

**File:** `src/app.js`

This module creates and configures the Express application without starting a server. It is imported by `server.js` and by test files.

**What it sets up:**

1. **CORS** — Allows the frontend (configured via `CLIENT_URL` environment variable) to make cross-origin requests. Credentials are enabled so cookies can be passed if needed.
2. **Morgan** — HTTP request logging in "dev" format. Every incoming request is printed to the console with method, path, status code, and response time.
3. **Body parsing** — Parses JSON and URL-encoded request bodies so controllers can read `req.body`.
4. **Base routes** — The `/` and `/health` endpoints.
5. **Route groups** — Mounts all the feature routes under their respective `/api/v1/...` paths.
6. **Backward-compatible aliases** — Older API paths (`/api/logistics`, `/api/command-center`, `/api/notifications`) are also registered pointing to the same route handlers.

**What it does NOT do:** It does not start listening, connect to the database, or initialize Socket.IO. That is all in `server.js`.

---

## 3. Configuration

### `config/db.js` — Database Connection

**File:** `src/config/db.js`

A single function that establishes a connection to MongoDB using Mongoose. It reads the `MONGODB_URI` environment variable and connects to the database. Called once during server startup by `server.js`.

**Why it's isolated:** Keeping the database connection in its own module makes it easy to mock in tests (tests use an in-memory MongoDB instead of a real connection).

---

## 4. Routes

Route files define **which URLs exist** and **what middleware and controller function handles each one**. They do not contain business logic themselves.

---

### `authRoutes.js`

**File:** `src/routes/authRoutes.js`

Defines the URL structure for all authentication actions. Contains its own inline validation logic using `express-validator` before passing requests to the auth controller.

**Validation enforced:**
- Registration requires a non-empty name, a valid email, a password of at least 8 characters, and a role.
- Login requires a valid email and a non-empty password.
- Activation (POST) requires a non-empty token string.

**Routes defined:**
- Register, login, activate (GET + POST), logout, and verify.

---

### `resourceRoutes.js`

**File:** `src/routes/resourceRoutes.js`

Unlike other route files, this one **exports a factory function** rather than a pre-built router. You call it with the `io` instance and it returns a configured router. This design is required because the bed status update endpoint needs to emit Socket.IO events after saving.

Contains validation for the bed status update endpoint — ensures `hospitalId`, `bedType`, and `status` all have valid values before the request reaches the controller.

---

### `logisticsRoutes.js`

**File:** `src/routes/logisticsRoutes.js`

Defines routes for hospital discovery, patient transfer creation, transfer status updates, and hospital resource patching. These are the highest-stakes endpoints in the system — they affect capacity counts and trigger email alerts.

---

### `commandCenterRoutes.js`

**File:** `src/routes/commandCenterRoutes.js`

Defines four read-only endpoints for analytics: region occupancy, critical hospitals, transfer history, and audit logs. No data is written through these endpoints.

---

### `notificationRoutes.js`

**File:** `src/routes/notificationRoutes.js`

Defines two endpoints for manually triggering outbound emails: account activation emails and critical bed alert emails.

---

### `hospitalRoutes.js`

**File:** `src/routes/hospitalRoutes.js`

Currently a **placeholder**. Requires authentication but only returns a static message. Hospital CRUD operations are not yet implemented here.

---

### `userRoutes.js`

**File:** `src/routes/userRoutes.js`

Currently a **placeholder**. Requires authentication but only returns a static message. User management (listing, updating, etc.) is not yet implemented here.

---

## 5. Controllers

Controllers are the **heart of the business logic**. Each controller function receives an HTTP request, performs operations (querying the database, calling services), and sends back a response. They do not define routes — they only handle requests forwarded to them by routes.

---

### `authController.js`

**File:** `src/controllers/authController.js`

Handles the complete user authentication lifecycle.

**Functions:**

**`register`**
Creates a new user. After creating the account in the database, generates a 30-minute activation token and passes it to the email service to send an activation link. The user's `isActive` starts as `false`. In development, the activation link is included in the response for convenience.

**`activateAccount`**
Accepts a token (from either the query string or the request body). Verifies it with the token service, finds the corresponding user, and sets `isActive: true`. Idempotent — if already active, returns success without error.

**`login`**
Looks up the user by email, compares the submitted password against the bcrypt hash in the database, checks that the account is active, updates the `lastLoginAt` timestamp, and issues a signed JWT access token.

**`logout`**
Extracts the current token from the request and adds it to the in-memory revocation list. The token will be rejected on all future requests even if it has not expired yet.

**`verifyAuthToken`**
A pass-through endpoint — simply returns the user object from `req.user`, which was populated by the authentication middleware. Used by the frontend to confirm the session is still valid.

---

### `resourceController.js`

**File:** `src/controllers/resourceController.js`

Manages fine-grained hospital resource inventory — specifically the ward and bed structure stored in the `Resource` collection.

**Functions:**

**`createInventory`**
Creates a new resource inventory document for a hospital. Checks that the hospital ID is valid and that no inventory already exists for it (returns 409 if it does). Accepts an optional array of wards.

**`updateInventory`**
Finds the inventory by hospital ID and replaces the `region` and/or `wards` fields. Uses Mongoose's `findOneAndUpdate` with validators enabled.

**`updateBedStatus`** *(Socket.IO-aware)*
This is a **higher-order function** — it takes `io` as an argument and returns the actual request handler. This pattern allows the handler to close over the Socket.IO instance. After finding the matching resource and applying the status/count change to the relevant beds, it:
1. Saves the updated document.
2. Emits a `bed-update` event to the region room (full ward snapshot).
3. Emits a `bed-status-changed` event for each individual bed that changed (detailed delta).

**`getResources`**
Fetches resource inventory records filtered by optional `hospitalId` and/or `region`. Populates the associated hospital object.

---

### `logisticsController.js`

**File:** `src/controllers/logisticsController.js`

The most complex controller in the system. Handles hospital search, patient transfer creation, transfer lifecycle management, and direct resource patching.

**Helper functions (internal):**
- `getRequester` — extracts actor identity from request body for audit logging.
- `parseCoordinates` — safely converts lat/lng strings to numbers.
- `getHospitalCoordinates` — normalizes the location from either a flat lat/lng format or a GeoJSON coordinates format.

**Functions:**

**`searchHospitalsByResource`**
Queries the database for active hospitals that have at least `minBeds` of the requested `bedType`. If coordinates are provided, adds distance (via haversine formula) to each result and sorts by distance.

**`getNearestHospitalWithRequiredBed`**
Same query as above but requires coordinates and returns only the single closest match.

**`requestPatientTransfer`**
The most involved function in the project. Creates a new patient transfer record. Handles two scenarios:
- If `toHospitalId` is specified: validates the hospital and checks bed availability.
- If not specified: auto-selects the nearest hospital in the same region with available beds.

After resolving both hospitals, calls the map service to get route distance and ETA. Creates the transfer with status `"requested"`. Writes an audit log. If the destination is running critically low on beds and notification emails were provided, sends both a critical alert email and a transfer event email.

**`trackTransfer`**
Simple lookup — retrieves a transfer by ID with both hospital names populated.

**`updateTransferStatus`**
Updates the status of an existing transfer and appends a new entry to its timeline. The key case is when status becomes `"completed"`:
- Verifies destination still has a bed.
- Decrements the bed count at the destination hospital.
- Increments the bed count at the origin hospital (bed freed up).
- Writes audit logs for both hospitals.

Always writes a transfer-level audit log recording the status change.

**`updateHospitalResources`**
Performs a targeted update of numeric resource fields on a hospital document. Only fields in the allowed list are accepted. After saving, if any bed type drops to or below the critical threshold, sends critical alert emails to provided addresses.

---

### `commandCenterController.js`

**File:** `src/controllers/commandCenterController.js`

Read-only analytics controller. No data is modified by any function here.

**Helper functions (internal):**
- `getRegionFromHospital` — extracts a region identifier from a hospital, falling back through state and city if the `region` field is missing.
- `getAvailableBeds` / `getTotalBeds` — safely read bed counts from either the `resources` subdocument or the older `capacity` subdocument (handles schema evolution).

**Functions:**

**`getRegionOccupancySummary`**
Fetches all active hospitals and groups them by region. For each region, accumulates total and available bed counts across all three bed types. Computes an `occupancyRate` (a value from 0 to 1) for each bed type: 1.0 means fully occupied.

**`listCriticalHospitals`**
Identifies hospitals where any bed count is at or below a threshold. Returns only those hospitals, each annotated with a `criticalTypes` array naming which bed categories are at risk.

**`listTransferHistory`**
Retrieves transfer records sorted newest-first with pagination and optional status filtering.

**`listAuditLogs`**
Retrieves audit log entries with pagination and optional filters by entity type and action name.

---

### `notificationController.js`

**File:** `src/controllers/notificationController.js`

A thin controller that validates fields and passes work to the email service. Contains no complex logic itself.

**Functions:**

**`sendAccountActivation`**
Validates that `to`, `accountName`, and `activationLink` are present, then calls the email service.

**`sendCriticalAlert`**
Validates that `to`, `hospitalName`, `bedType`, a numeric `remainingBeds`, and `region` are all present, then calls the email service.

---

## 6. Models (Database Schemas)

Models define the **shape of data stored in MongoDB**. Each model maps to a collection. They are created using Mongoose, which validates data and provides query methods.

---

### `User.js`

**Collection:** `users`

Represents a system user — a person who logs in to the platform.

**Fields:**

| Field | Type | Description |
|---|---|---|
| `name` | String | Full display name |
| `email` | String | Unique login identifier, always stored lowercase |
| `password` | String | Bcrypt-hashed password — never returned in queries by default |
| `role` | String | One of three allowed roles (see Roles utility) |
| `hospital` | Reference → Hospital | Optional link to the hospital this user administers |
| `isActive` | Boolean | `false` until the activation email is clicked |
| `lastLoginAt` | Date | Timestamp of most recent successful login |

**Built-in behavior:**
- **Pre-save hook:** Every time the password field changes, it is automatically hashed with bcrypt before saving. This prevents ever accidentally storing a plain-text password.
- **`comparePassword` method:** A convenience method used during login to check if a submitted plain-text password matches the stored hash.

---

### `Hospital.js`

**Collection:** `hospitals`

Represents a single hospital in the network.

**Fields:**

| Field | Type | Description |
|---|---|---|
| `name` | String | Hospital name |
| `registrationNumber` | String | Optional unique registration identifier |
| `location` | Object | Address (line, city, state, country, postal code) + GeoJSON coordinates |
| `contact` | Object | Phone, email, and optional emergency phone |
| `region` | String | High-level geographic grouping (e.g., "North", "Chennai") |
| `active` | Boolean | Whether the hospital is currently operational |
| `capacity` | Object | Legacy capacity fields: total beds, ICU beds, available beds |
| `resources` | Object | Current available counts: general, ICU, ventilator beds + totals + ambulances |
| `createdBy` | Reference → User | Who registered this hospital in the system |

**Spatial indexing:** A `2dsphere` index is placed on `location.coordinates` to support geospatial queries (finding nearby hospitals).

**Note on `capacity` vs `resources`:** The `capacity` subdocument is a legacy field. Newer code uses the `resources` subdocument for operational counts. The command center controller handles both for backward compatibility.

---

### `Resource.js`

**Collection:** `resources`

Stores the detailed ward-level bed inventory for a hospital. This is separate from the `Hospital` model so that it can be updated independently (and with real-time Socket.IO broadcasts) without touching the main hospital record.

**Structure (nested):**

```
Resource
└── hospital (ref to Hospital)
└── region (string)
└── wards []
    └── wardName
    └── beds []
        └── type  (ICU | General | Ventilator | Oxygen-supported)
        └── status (Occupied | Vacant | Maintenance)
        └── count (number)
```

**Validation:** A custom validator on the `beds` array prevents duplicate `type + status` combinations within the same ward. For example, you cannot have two entries that are both "ICU" and "Occupied" in the same ward — they must be deduplicated.

**Static method:** `getAvailableIcuBedsByHospital` — uses a MongoDB aggregation pipeline to sum up all "Vacant" ICU bed counts across all wards for a given hospital. Useful for analytics.

---

### `HospitalResourceInventory.js`

**Collection:** `hospitalresourceinventories`

This model is **structurally identical to `Resource.js`** and was created as a design iteration. Both models define the same ward-bed schema and the same static aggregation method. In practice, the active code uses `Resource.js` — this file appears to be a predecessor that has not been removed yet.

---

### `Transfer.js`

**Collection:** `transfers`

Represents a single patient transfer request — from one hospital to another.

**Fields:**

| Field | Type | Description |
|---|---|---|
| `patientName` | String | Name of the patient being moved |
| `patientId` | String | Optional external patient reference |
| `requiredBedType` | String | What kind of bed is needed at the destination |
| `fromHospital` | Reference → Hospital | Where the patient is coming from |
| `toHospital` | Reference → Hospital | Where the patient is going |
| `requestedBy` | Actor object | Who requested the transfer (role, id, name) |
| `status` | String | Current state of the transfer |
| `route` | Route object | Distance, estimated time, and which mapping service provided the data |
| `timeline` | Array of Timeline entries | Full history of status changes with timestamps and notes |

**Transfer statuses (in lifecycle order):**
`requested` → `dispatched` → `in_transit` → `completed` (or `cancelled` at any point)

---

### `AuditLog.js`

**Collection:** `auditlogs`

A tamper-evident record of all significant actions in the system. Never updated — only written and read.

**Fields:**

| Field | Type | Description |
|---|---|---|
| `entityType` | String | What kind of thing was affected (e.g., `transfer`, `hospital`) |
| `entityId` | String | The ID of the specific entity |
| `action` | String | What happened (e.g., `transfer_requested`, `bed_occupied_after_transfer`) |
| `actor` | Actor object | Who or what performed the action (role, id, name; defaults to "system") |
| `metadata` | Mixed | Any additional context data relevant to the action |

**Design note:** Only `createdAt` is tracked — there is no `updatedAt` because audit logs are never modified after creation.

---

## 7. Middleware

Middleware functions run **between the route definition and the controller**. Each takes the request, optionally modifies it, and either passes it forward or sends a response directly.

---

### `authMiddleware.js`

**File:** `src/middleware/authMiddleware.js`

Exports the `authenticate` function. Protects any route that requires a logged-in user.

**What it does (in order):**
1. Extracts the Bearer token from the `Authorization` header.
2. Returns 401 if no token is found.
3. Checks the in-memory revocation list — returns 401 if the token was revoked (user already logged out).
4. Verifies the token's signature and decodes its payload.
5. Loads the user from the database using the `sub` (user ID) from the token payload.
6. Returns 401 if the user doesn't exist.
7. Returns 403 if the user's account is inactive.
8. Attaches a clean `req.user` object (id, name, email, role, hospital) to the request for downstream use.
9. Also attaches `req.token` (the raw token string) so the logout controller can revoke it.

---

### `rbacMiddleware.js`

**File:** `src/middleware/rbacMiddleware.js`

Exports the `authorizeRoles` function. Used after `authenticate` to restrict access to specific user roles.

**How to use it:** `authorizeRoles("HOSPITAL_ADMIN", "GOVERNMENT_OFFICIAL")` returns a middleware function that checks whether `req.user.role` is in the allowed list.

**Note:** While this middleware is implemented and functional, it is not yet applied to most routes in the current codebase — most routes have open access. It is ready for use when role restrictions need to be enforced.

---

### `errorHandler.js`

**File:** `src/middleware/errorHandler.js`

The **global error-handling middleware** — the last middleware registered in `server.js`. Express automatically routes any error passed to `next(error)` through this function.

**What it does:**
- Reads the HTTP status code from `error.statusCode` (defaults to 500).
- Reads the machine-readable code from `error.code` (defaults to `INTERNAL_SERVER_ERROR`).
- Formats a consistent error response JSON with `success: false`, and the code and message.
- In non-production environments, includes the full stack trace in the response for debugging.

This is why all controllers can simply `throw new ApiError(...)` — the `catchAsync` wrapper catches the error and passes it here.

---

### `validate.js`

**File:** `src/middleware/validate.js`

A small helper used in route files to run a set of `express-validator` check functions and collect all validation errors. If any errors are found, it immediately returns a 400 response with the error list. Otherwise it calls `next()`.

Used inline in `authRoutes.js` to validate registration and login payloads before they reach the controller.

---

## 8. Services

Services are **reusable utility modules** that handle complex operations. They are called by controllers and have no direct relationship with HTTP requests.

---

### `tokenService.js`

**File:** `src/services/tokenService.js`

Manages all JWT token operations for the application.

**Two types of tokens:**

| Token Type | Purpose | Default Validity |
|---|---|---|
| Access Token | Proves identity for API requests | 1 day |
| Activation Token | One-time link to activate an account | 30 minutes |

**Functions:**
- `generateAccessToken(user)` — signs a token with the user's ID, email, and role.
- `generateActivationToken(user)` — signs a short-lived token for email activation.
- `verifyAccessToken(token)` — validates signature and token type; throws ApiError on failure.
- `verifyActivationToken(token)` — same, but for activation tokens.
- `extractBearerToken(req)` — reads the `Authorization` header and strips the "Bearer " prefix.
- `revokeToken(token, exp)` — adds a token to the in-memory revocation map with its expiry.
- `isTokenRevoked(token)` — checks whether a token is in the revocation map.

**In-memory revocation:** Revoked tokens are stored in a JavaScript `Map` in the process memory, not in the database. This is fast but means the revocation list is **lost on server restart**. Tokens also automatically clean themselves up when they expire (the cleanup runs on every revoke and check operation).

---

### `emailService.js`

**File:** `src/services/emailService.js`

Handles all outbound email sending using **Nodemailer**.

**Design pattern — graceful degradation:** At startup, if the SMTP environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`) are not configured, the transporter is `null`. Instead of crashing, each send function checks for this and prints the email content to the console instead. This allows the system to run fully in development without an email server.

**Email types:**

| Function | Triggered by | Email contents |
|---|---|---|
| `sendActivationEmail` | Registration | Activation link for the new user |
| `sendAccountActivationEmail` | Notification controller | Same as above, different parameter name |
| `sendCriticalAlertEmail` | Transfer creation / resource update | Hospital name, region, bed type, remaining count |
| `sendTransferEventEmail` | Transfer creation / status update | Transfer ID, patient, hospitals, status, route info |

---

### `mapService.js`

**File:** `src/services/mapService.js`

Provides geographic routing and distance calculation. The system supports three providers, used in order of priority:

1. **Google Maps Directions API** — used if `MAP_PROVIDER=google` and `GOOGLE_MAPS_API_KEY` is set. Returns real road distances and driving times.
2. **OSRM (OpenStreetMap Routing Machine)** — used if Google is not configured or returns no result. Uses a public OSRM instance by default (configurable via `OSRM_BASE_URL`). Also returns real road distances.
3. **Haversine formula (fallback)** — a pure mathematical calculation of straight-line distance. Always available, never fails. Estimates driving time by assuming 40 km/h average speed.

**Functions:**
- `haversineDistanceKm(origin, destination)` — pure math, returns km as a number.
- `getRouteMetadata(origin, destination)` — tries providers in order and returns an object with `distanceKm`, `durationMin`, and `source` (which provider was used). Used when creating a transfer.

---

### `auditService.js`

**File:** `src/services/auditService.js`

A minimal one-function service that creates entries in the `AuditLog` collection.

**`createAuditLog({ entityType, entityId, action, actor, metadata })`**

Called by the logistics controller after:
- A transfer is requested.
- A transfer status is updated.
- Bed counts are adjusted after a completed transfer.
- Hospital resources are manually updated.

Defaults the actor to `{ role: "system" }` if none is provided.

---

## 9. Utilities

Small, single-purpose helper modules used across controllers, services, and routes.

---

### `ApiError.js`

**File:** `src/utils/ApiError.js`

A custom error class that extends JavaScript's built-in `Error`. Adds two extra fields: `statusCode` (HTTP status code) and `code` (machine-readable error identifier string).

**Why it exists:** When a controller wants to send a 404 or 401 response, instead of writing `res.status(404).json(...)` directly, it throws `new ApiError(404, "Not found", "RESOURCE_NOT_FOUND")`. The global error handler catches it and formats the response uniformly.

---

### `ApiResponse.js`

**File:** `src/utils/ApiResponse.js`

A simple class for creating consistent success response objects. Every successful response is wrapped in this: `new ApiResponse(200, data, "Success message")`.

**Why it exists:** Ensures that all success responses follow the same structure — even if the message or data changes per endpoint, the outer envelope is always the same shape.

---

### `catchAsync.js`

**File:** `src/utils/catchAsync.js`

A wrapper function used in the auth controller. Takes an async controller function and returns a new function that automatically catches any thrown errors (including rejected Promises) and passes them to Express's `next(error)` — which routes them to the global error handler.

**Why it exists:** Without this, an uncaught error in an async function would crash the Node process instead of returning an error response. The pattern `catchAsync(async (req, res) => { ... })` is a clean, DRY way to add this protection.

---

### `roles.js`

**File:** `src/utils/roles.js`

A constant object defining the three allowed user roles:

| Role | Description |
|---|---|
| `HOSPITAL_ADMIN` | Can manage their hospital's resources |
| `DOCTOR` | Clinical staff who can request transfers |
| `GOVERNMENT_OFFICIAL` | Has access to command center analytics |

Imported by the `User` model to enforce valid values in the `role` field via Mongoose's `enum` validation. Importing from here (instead of duplicating strings) ensures roles are consistent everywhere.

---

### `bedType.js`

**File:** `src/utils/bedType.js`

Handles normalization and validation of bed type strings across different parts of the system.

**Why this exists:** Two different naming conventions exist in the codebase:
- The logistics/hospital model uses camelCase: `generalBeds`, `icuBeds`, `ventilatorBeds`
- The resource inventory model uses display names: `General`, `ICU`, `Ventilator`, `Oxygen-supported`

The `normalizeBedType` function translates between these conventions so that queries to the `Hospital` collection (which uses camelCase) work correctly when a request comes in with a display-name bedType.

`ALLOWED_BED_TYPES` is the canonical list of valid bed type values used for input validation in the logistics controller.

---

## 10. How Everything Connects

Here is a walkthrough of the most important flow — **creating a patient transfer** — showing how all modules work together:

```
1. Client sends POST /api/v1/logistics/transfers
       ↓
2. logisticsRoutes.js receives it, has no middleware ← passes to controller
       ↓
3. logisticsController.js → requestPatientTransfer()
       ├── Reads fromHospitalId, requiredBedType, etc. from req.body
       ├── bedType.js → normalizeBedType() validates and normalizes the bed type
       ├── Hospital model → findById() confirms fromHospital exists
       ├── Hospital model → find() searches for candidate destination hospitals
       ├── mapService.js → getRouteMetadata() calculates distance + ETA
       │       ├── tries Google Maps API
       │       ├── tries OSRM (OpenStreetMap)
       │       └── falls back to haversineDistanceKm()
       ├── Transfer model → create() saves the transfer record
       ├── auditService.js → createAuditLog() records the action
       ├── (if critical) emailService.js → sendCriticalAlertEmail()
       ├── (if critical) emailService.js → sendTransferEventEmail()
       └── Returns the populated transfer document
       ↓
4. If anything throws, catchAsync (if used) or try/catch passes to:
       ↓
5. errorHandler.js → formats the error response uniformly
```

---

## 11. Technology Stack

| Technology | Role |
|---|---|
| **Node.js** | JavaScript runtime — server environment |
| **Express.js** (v5) | Web framework — routing and middleware |
| **MongoDB** | NoSQL database — stores all persistent data |
| **Mongoose** | ODM (Object Document Mapper) — schema definition, validation, and querying |
| **Socket.IO** | WebSocket library — real-time bed update broadcasts |
| **JSON Web Tokens (JWT)** | Stateless authentication — session tokens |
| **bcryptjs** | Password hashing — securely stores passwords |
| **Nodemailer** | Email sending — activation and alert emails |
| **axios** | HTTP client — calls external map APIs (Google Maps, OSRM) |
| **express-validator** | Request validation — enforces field rules before controllers run |
| **Morgan** | HTTP request logger — prints requests to console |
| **dotenv** | Environment variable loader — reads `.env` file |
| **Mocha + Chai + Supertest** | Testing framework — integration tests |
| **mongodb-memory-server** | In-memory MongoDB for tests — no real database needed in CI |
| **Nodemon** | Development server restarter — auto-reloads on file changes |
