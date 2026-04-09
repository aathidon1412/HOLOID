# HOLOID Backend — API Endpoints Reference

> **Base URL:** `http://localhost:5000/api/v1`
>
> All responses follow a consistent envelope:
> - **Success:** `{ success: true, statusCode, data, message }`
> - **Error:** `{ success: false, error: { code, message } }`

---

## Table of Contents

1. [General Routes](#1-general-routes)
2. [Authentication — `/auth`](#2-authentication----auth)
3. [Resource Inventory — `/resources`](#3-resource-inventory----resources)
4. [Logistics — `/logistics`](#4-logistics----logistics)
5. [Command Center — `/command-center`](#5-command-center----command-center)
6. [Notifications — `/notifications`](#6-notifications----notifications)
7. [Users — `/users`](#7-users----users)
8. [Hospitals — `/hospitals`](#8-hospitals----hospitals)
9. [Real-Time Events (Socket.IO)](#9-real-time-events-socketio)
10. [Error Codes Reference](#10-error-codes-reference)

---

## 1. General Routes

These routes live directly at the root of the server (no `/api/v1` prefix).

---

### `GET /`

**What it does:** Returns a simple status message confirming the backend is alive.

**Who can call it:** Anyone — no authentication required.

**Response:** A JSON object saying the backend is running.

---

### `GET /health`

**What it does:** Health-check endpoint. Returns the current server status and a timestamp.

**Who can call it:** Anyone — no authentication required.

**Response:** A JSON object with status `"ok"` and the current ISO timestamp. Used by monitoring tools or deployment platforms.

---

## 2. Authentication — `/auth`

All authentication endpoints are mounted at `/api/v1/auth`.

---

### `POST /api/v1/auth/register`

**What it does:** Registers a brand-new user account. After registration, the account is **inactive** — the user must activate it via email before they can log in.

**Who can call it:** Anyone.

**What you must send (request body):**

| Field | Description |
|---|---|
| `name` | Full name of the user (non-empty string) |
| `email` | Valid email address |
| `password` | Minimum 8 characters |
| `role` | One of: `HOSPITAL_ADMIN`, `DOCTOR`, `GOVERNMENT_OFFICIAL` |
| `hospitalId` | *(Optional)* The MongoDB ID of the hospital this user belongs to |

**What happens internally:**
1. Validates all fields (returns 400 if any fail).
2. Checks if the email is already in the database — returns 409 if it exists.
3. Creates the user record with `isActive: false`.
4. Generates a short-lived **activation token** (valid for 30 minutes).
5. Sends an activation email to the user with a clickable link.

**What you get back (201):**
- The new user's ID, name, email, role, and `isActive: false`.
- In non-production environments, the activation link is also returned in the response body (for easy testing).

---

### `GET /api/v1/auth/activate?token=<TOKEN>`

**What it does:** Activates a user account using the token from the activation email link. This is the link the user clicks in their inbox.

**Who can call it:** Anyone with the activation token (usually the link from the email).

**How the token is passed:** As a query string parameter `?token=...`

**What happens internally:**
1. Decodes and verifies the activation token.
2. Finds the user it belongs to.
3. If already active, returns a success message saying so (idempotent).
4. Sets `isActive: true` and saves the user.

**What you get back (200):** A success message confirming activation.

---

### `POST /api/v1/auth/activate`

**What it does:** Same as the GET version above, but the token is sent in the request body. Useful for programmatic activation flows.

**What you must send:**

| Field | Description |
|---|---|
| `token` | The activation token string |

---

### `POST /api/v1/auth/login`

**What it does:** Logs in an existing, activated user and returns a JWT access token.

**Who can call it:** Anyone.

**What you must send:**

| Field | Description |
|---|---|
| `email` | Registered email address |
| `password` | Account password |

**What happens internally:**
1. Looks up the user by email.
2. Compares the password with the bcrypt-hashed version stored in the database.
3. Checks that the account is active — returns 403 if not.
4. Updates `lastLoginAt` timestamp.
5. Generates a new JWT access token (valid for 1 day by default).

**What you get back (200):**
- `accessToken` — the JWT to include in all future requests as `Authorization: Bearer <token>`.
- User object: ID, name, email, role, and linked hospital ID.

**Possible errors:**
- `401` — Wrong email or password.
- `403` — Account exists but is not activated yet.

---

### `POST /api/v1/auth/logout`

**What it does:** Logs out the currently authenticated user by revoking their JWT token. After this, the token is invalid even if it hasn't expired.

**Who can call it:** Any authenticated user.

**Authentication required:** Yes — Bearer token in the `Authorization` header.

**What happens internally:**
1. Extracts the token from the request.
2. Adds it to an in-memory revocation list with its expiry time.
3. Automatically removes expired tokens from the list to keep memory clean.

**What you get back (200):** A confirmation message that logout was successful.

---

### `GET /api/v1/auth/verify`

**What it does:** Verifies if the current access token is still valid. Returns the authenticated user's information.

**Who can call it:** Any authenticated user.

**Authentication required:** Yes — Bearer token in the `Authorization` header.

**What you get back (200):** The user object attached to the current session (id, name, email, role, hospital).

**Use case:** Frontend apps use this on page load to check if the user is still logged in.

---

## 3. Resource Inventory — `/resources`

These endpoints manage hospital ward and bed inventory. They are mounted at `/api/resources` (note: **no `/v1`** prefix — this route group requires Socket.IO access).

**Real-time feature:** The `updateBedStatus` endpoint emits live events via Socket.IO whenever bed status changes.

---

### `POST /api/resources`

**What it does:** Creates a new resource inventory record for a hospital. Each hospital can only have one inventory record.

**Who can call it:** Any user (no auth guard currently applied to this route group).

**What you must send:**

| Field | Description |
|---|---|
| `hospital` | Valid MongoDB ObjectId of the hospital |
| `region` | String identifying the geographic region |
| `wards` | *(Optional)* Array of ward objects with bed information |

**Ward structure:** Each ward has a `wardName` and a list of `beds`. Each bed entry has a `type` (ICU, General, Ventilator, Oxygen-supported), a `status` (Occupied, Vacant, Maintenance), and a `count`.

**What happens internally:**
- If an inventory already exists for that hospital, returns 409 — use the update endpoint instead.

**What you get back (201):** The full resource inventory document.

---

### `PUT /api/resources/:hospitalId`

**What it does:** Updates an existing resource inventory for a hospital. Replaces the region or wards array (or both).

**URL parameter:** `hospitalId` — the MongoDB ID of the hospital.

**What you can send:**

| Field | Description |
|---|---|
| `region` | New region string |
| `wards` | New wards array (full replacement) |

**What you get back (200):** The updated inventory document.

**Note:** At least one of `region` or `wards` must be provided — otherwise returns 400.

---

### `PUT /api/resources/:hospitalId/beds`

**What it does:** Updates the status (and optionally count) of beds of a specific type within a hospital's inventory. This is the most fine-grained resource update, and it **broadcasts a real-time event** to all clients in the same region.

**URL parameter:** `hospitalId` — the MongoDB ID of the hospital.

**What you must send:**

| Field | Description |
|---|---|
| `bedType` | One of: `ICU`, `General`, `Ventilator`, `Oxygen-supported` |
| `status` | One of: `Occupied`, `Vacant`, `Maintenance` |
| `wardName` | *(Optional)* Filter to only update beds in this specific ward |
| `count` | *(Optional)* New count for matching beds (non-negative integer) |

**What happens after saving:**
- If Socket.IO is active, emits `bed-update` and `bed-status-changed` events to all clients subscribed to that region room.

**What you get back (200):** The full updated resource document.

---

### `GET /api/resources`

**What it does:** Fetches resource inventory records, optionally filtered by hospital or region.

**Query parameters (all optional):**

| Parameter | Description |
|---|---|
| `hospitalId` | Filter to one specific hospital's inventory |
| `region` | Filter to all hospitals in a region |

**What you get back (200):** An array of resource inventory documents, with the linked hospital object populated.

---

## 4. Logistics — `/logistics`

These endpoints handle patient transfer operations and hospital discovery. Mounted at `/api/v1/logistics` (also available under `/api/logistics` for backward compatibility).

---

### `GET /api/v1/logistics/hospitals/search`

**What it does:** Searches for active hospitals that have a minimum number of available beds of a specific type. Optionally filters by region and calculates distance from a given location.

**Query parameters:**

| Parameter | Required | Description |
|---|---|---|
| `bedType` | Yes | Type of bed needed (e.g., `icuBeds`, `generalBeds`, `ventilatorBeds`) |
| `minBeds` | No | Minimum number of available beds (default: 1) |
| `region` | No | Restrict search to a specific region |
| `lat` | No | Latitude of the requesting location |
| `lng` | No | Longitude of the requesting location |

**What happens internally:**
- Queries hospitals with matching bed counts.
- If `lat` and `lng` are provided, calculates the straight-line (haversine) distance to each hospital and sorts results nearest-first.

**What you get back (200):**
- `count` — number of results.
- `hospitals` — array of matching hospital objects, each with an `availableBeds` field and optionally a `distanceKm` field.

---

### `GET /api/v1/logistics/hospitals/nearest`

**What it does:** Finds the single nearest hospital that has the required bed type available. Unlike `search`, this requires coordinates and returns only one result.

**Query parameters:**

| Parameter | Required | Description |
|---|---|---|
| `bedType` | Yes | Type of bed needed |
| `lat` | Yes | Latitude of origin point |
| `lng` | Yes | Longitude of origin point |
| `minBeds` | No | Minimum available beds (default: 1) |
| `region` | No | Restrict to a specific region |

**What you get back (200):** A single hospital object with `distanceKm` attached.

**Possible errors:**
- `400` — `lat` or `lng` missing, or invalid `bedType`.
- `404` — No hospital found matching the criteria.

---

### `POST /api/v1/logistics/transfers`

**What it does:** Creates a new patient transfer request. The system finds the best destination hospital (either the one you specify or the nearest available one), calculates route information, and creates a transfer record. May also send email alerts if bed counts are critically low.

**What you must send:**

| Field | Required | Description |
|---|---|---|
| `patientName` | Yes | Name of the patient being transferred |
| `fromHospitalId` | Yes | MongoDB ID of the hospital initiating the transfer |
| `requiredBedType` | Yes | Type of bed the patient needs |
| `patientId` | No | Optional patient reference ID |
| `toHospitalId` | No | If provided, sends to this specific hospital; otherwise, the system auto-selects the nearest |
| `requestedBy` | No | Object with `role`, `id`, `name` of the person making the request |
| `notificationEmails` | No | Array of email addresses to alert when transfer is created |

**What happens internally:**
1. Validates all required fields.
2. Confirms `fromHospital` exists in the database.
3. If `toHospitalId` is given, confirms it exists and has available beds.
4. If not, automatically finds the nearest hospital in the same region with available beds.
5. Calls the map service to calculate route distance and estimated travel time.
6. Creates the transfer document with status `"requested"` and a timeline entry.
7. Writes an audit log entry.
8. If the destination hospital's remaining beds are at or below the critical threshold (default: 2), sends a critical alert email and a transfer event email to the provided notification addresses.

**What you get back (201):** The full transfer document with populated hospital names.

---

### `GET /api/v1/logistics/transfers/:transferId`

**What it does:** Retrieves the full details and current status of a specific transfer, including its complete status timeline.

**URL parameter:** `transferId` — MongoDB ID of the transfer.

**What you get back (200):** The transfer document with hospital names and regions populated.

**Possible errors:**
- `404` — Transfer not found.

---

### `PATCH /api/v1/logistics/transfers/:transferId/status`

**What it does:** Updates the status of an in-progress transfer. When marked `"completed"`, the system automatically adjusts bed counts at both hospitals (decrements at destination, increments at origin) and writes audit logs for both.

**URL parameter:** `transferId` — MongoDB ID of the transfer.

**What you must send:**

| Field | Required | Description |
|---|---|---|
| `status` | Yes | One of: `requested`, `dispatched`, `in_transit`, `completed`, `cancelled` |
| `note` | No | A short note about this status update |
| `actor` | No | Object with `role`, `id`, `name` of who performed the update |
| `notificationEmails` | No | Emails to notify about this status change |

**What happens on `completed`:**
- Verifies the destination hospital still has a bed available.
- Decrements the bed count at `toHospital`.
- Increments the bed count (bed released) at `fromHospital`.
- Writes two audit logs: one for each hospital.

**What you get back (200):** The updated transfer document.

---

### `PATCH /api/v1/logistics/hospitals/:hospitalId/resources`

**What it does:** Directly updates the numeric resource counts for a hospital (beds, ambulances). Used for manual corrections or bulk updates when the ward-level inventory is not the source of truth.

**URL parameter:** `hospitalId` — MongoDB ID of the hospital.

**What you must send:**

| Field | Description |
|---|---|
| `resources` | Object containing the fields to update (see below) |
| `actor` | *(Optional)* Who made the change |
| `notificationEmails` | *(Optional)* Emails to alert if any bed type hits critical levels |

**Updateable resource fields:**

| Field | Description |
|---|---|
| `generalBeds` | Available general beds |
| `icuBeds` | Available ICU beds |
| `ventilatorBeds` | Available ventilator beds |
| `totalGeneralBeds` | Total general bed capacity |
| `totalIcuBeds` | Total ICU bed capacity |
| `totalVentilatorBeds` | Total ventilator bed capacity |
| `ambulancesAvailable` | Number of ambulances available |

**What you get back (200):** The updated hospital document.

---

## 5. Command Center — `/command-center`

These are read-only analytical endpoints for supervisors and government officials to get a macro-level view of the hospital network. Mounted at `/api/v1/command-center` (also at `/api/command-center`).

---

### `GET /api/v1/command-center/regions/occupancy`

**What it does:** Aggregates all active hospitals and returns an occupancy summary grouped by region. Shows how many beds of each type exist vs. how many are in use.

**Who uses this:** Dashboard for government officials and administrators who need a bird's-eye view.

**What you get back (200):**
- `count` — number of regions.
- `regions` — array of region summaries, each containing:
  - Total and available bed counts for general, ICU, and ventilator beds.
  - `occupancyRate` — a 0.0 to 1.0 ratio (1.0 = fully occupied) for each bed type.

---

### `GET /api/v1/command-center/hospitals/critical`

**What it does:** Lists all hospitals where any bed type is at or below a critical threshold (beds almost full). Helps identify which hospitals are under pressure.

**Query parameters:**

| Parameter | Default | Description |
|---|---|---|
| `threshold` | `2` (or env config) | Beds at or below this number are flagged as critical |

**What you get back (200):**
- `threshold` — the threshold used.
- `count` — number of critical hospitals.
- `hospitals` — array of hospital objects, each with a `criticalTypes` array listing which bed categories are at risk.

---

### `GET /api/v1/command-center/transfers/history`

**What it does:** Returns a paginated list of all transfer records, most recent first.

**Query parameters:**

| Parameter | Default | Max | Description |
|---|---|---|---|
| `limit` | `50` | `200` | Number of transfers to return |
| `status` | none | — | Filter by transfer status (e.g., `completed`, `in_transit`) |

**What you get back (200):**
- `count` — number returned.
- `transfers` — array of transfer documents with hospital names and regions.

---

### `GET /api/v1/command-center/audit-logs`

**What it does:** Returns a list of system audit log entries — a chronological record of all important actions taken in the system (transfers created, bed counts updated, etc.).

**Query parameters:**

| Parameter | Default | Max | Description |
|---|---|---|---|
| `limit` | `100` | `500` | Number of log entries to return |
| `entityType` | none | — | Filter by entity type (e.g., `transfer`, `hospital`) |
| `action` | none | — | Filter by action name (e.g., `transfer_requested`, `bed_occupied_after_transfer`) |

**What you get back (200):**
- `count` — number returned.
- `logs` — array of audit log entries, each showing what happened, when, and who did it.

---

## 6. Notifications — `/notifications`

These endpoints trigger outbound emails. They are mounted at `/api/v1/notifications` (also at `/api/notifications`).

> **Note:** If SMTP credentials are not configured, emails are not sent — the response still returns 200 but indicates the service was skipped.

---

### `POST /api/v1/notifications/account-activation`

**What it does:** Manually triggers an account activation email. Useful for admin tooling or re-sending activation links.

**What you must send:**

| Field | Description |
|---|---|
| `to` | Recipient email address |
| `accountName` | Name to display in the email greeting |
| `activationLink` | The full activation URL to include |

**What you get back (200):** A message indicating success or that the email service is not configured.

---

### `POST /api/v1/notifications/critical-alert`

**What it does:** Manually sends a critical bed alert email to one or more recipients. This is also triggered automatically by the logistics controller when bed levels drop critically.

**What you must send:**

| Field | Description |
|---|---|
| `to` | Recipient email address(es) |
| `hospitalName` | Name of the hospital with critical capacity |
| `bedType` | Which type of bed is running low |
| `remainingBeds` | Current number of remaining beds |
| `region` | Region where the hospital is located |

**What you get back (200):** A message indicating success or that the email service is not configured.

---

## 7. Users — `/users`

Mounted at `/api/v1/users`.

### `GET /api/v1/users`

**What it does:** Placeholder endpoint — currently returns a static message.

**Authentication required:** Yes.

**Status:** Not yet implemented.

---

## 8. Hospitals — `/hospitals`

Mounted at `/api/v1/hospitals`.

### `GET /api/v1/hospitals`

**What it does:** Placeholder endpoint — currently returns a static message.

**Authentication required:** Yes.

**Status:** Not yet implemented — hospital CRUD will be added here.

---

## 9. Real-Time Events (Socket.IO)

The server uses **Socket.IO** for pushing live bed status changes to connected clients without polling.

**Connection requires authentication:** Clients must pass their JWT access token in `socket.handshake.auth.token`.

---

### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `join-region` | `region: string` | Subscribes the client to a geographic region room. The client will then receive all bed updates for hospitals in that region. |
| `subscribe-hospital` | `hospitalId: string` | Subscribes the client to a specific hospital's room (for more targeted updates). |
| `unsubscribe-hospital` | `hospitalId: string` | Unsubscribes the client from a specific hospital's room. |

---

### Server → Client Events

These events are emitted by the server when bed status changes via the `PUT /api/resources/:hospitalId/beds` endpoint.

| Event | Payload | When it fires |
|---|---|---|
| `bed-update` | Full ward data for the hospital | After any bed status update — gives subscribers the latest snapshot of all wards |
| `bed-status-changed` | Delta object showing old vs. new status for the specific bed | Also fires after each bed update — more granular than `bed-update`, one event per changed bed entry |

**Who receives these?** Any client that called `join-region` with the same region as the hospital that was updated.

---

## 10. Error Codes Reference

All error responses contain a machine-readable `code` field for programmatic handling.

| Code | Description |
|---|---|
| `EMAIL_EXISTS` | The email is already registered |
| `MISSING_TOKEN` | No token provided in the request |
| `INVALID_TOKEN` | Token is expired or malformed |
| `INVALID_TOKEN_TYPE` | Wrong type of token used (e.g., activation token used for access) |
| `REVOKED_TOKEN` | Token was valid but has been revoked (logged out) |
| `USER_NOT_FOUND` | The user associated with the token no longer exists |
| `ACCOUNT_INACTIVE` | Account exists but has not been activated |
| `INACTIVE_USER` | User account is deactivated after authentication |
| `UNAUTHENTICATED` | Request requires login but no token was provided |
| `FORBIDDEN` | User is authenticated but does not have the required role |
| `ROUTE_NOT_FOUND` | The requested URL does not match any route |
| `INTERNAL_SERVER_ERROR` | An unexpected server-side error occurred |
