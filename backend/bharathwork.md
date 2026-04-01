feat: implement backend logistics, routing intelligence, command-center analytics, and notification services

- Set up a modular backend structure using Express + Mongoose with separated controllers, routes, models, services, and utils.
- Implemented logistics APIs for hospital resource search, nearest hospital lookup by bed type, patient transfer request, transfer tracking, and transfer status updates.
- Added backend map/routing integration with provider-based support:
  - Google Directions API (when API key is configured)
  - OpenStreetMap OSRM routing
  - Automatic haversine fallback for resilience
- Built command-center APIs for region-wise occupancy summaries, critical hospital listing (low bed capacity threshold), transfer history, and audit log retrieval.
- Implemented transfer lifecycle handling with timeline events and state transitions (requested, dispatched, in_transit, completed, cancelled).
- Added hospital resource update endpoint with audit logging and critical alert checks.
- Integrated email notification service using Nodemailer for account activation and critical capacity alerts to admins/officials.
- Added centralized audit logging for transfer events and bed/resource updates to support traceability and governance reporting.
- Strengthened API consistency with structured validation checks, clear status codes, and centralized internal error response handling.
- Added backend dependencies required for these features, including axios for map API calls and nodemailer for email services.
- Updated environment-driven configuration for maps, alert thresholds, SMTP, and server settings for flexible deployment.
