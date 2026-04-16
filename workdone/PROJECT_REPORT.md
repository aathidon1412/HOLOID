1. INTRODUCTION

Background of the project:
HOLOID is a full-stack Hospital Bed and Resource Management System (HBRMS) developed to support healthcare coordination during high-pressure situations such as pandemics, disasters, and large-scale emergency surges. The platform centralizes hospital resource visibility, transfer workflows, and decision-support analytics so that hospitals and governing bodies can respond quickly with reliable operational data.

Need for the application:
In emergency healthcare scenarios, hospital coordination is often fragmented across phone calls, manual records, and delayed updates. This causes poor visibility into bed availability, slower patient transfer decisions, and communication gaps between hospital administrators, doctors, and command-center authorities. A unified digital platform is necessary to reduce response time and improve care continuity.

Objective of the application:
The primary objective of HOLOID is to provide a real-time, secure, and role-based system for managing hospital resources and patient transfer logistics. The system targets faster bed allocation, efficient inter-hospital transfer decisions, continuous monitoring of occupancy trends, and reliable alerting for critical resource conditions.

Overview of modules:
- Authentication and Access Control Module: Supports registration, email-based account activation, login, token verification, logout, and role-based authorization.
- Hospital and User Management Module: Maintains hospital identity context and user-role association for operational workflows.
- Resource Inventory Module: Tracks ward-level bed categories, status changes, and availability updates per hospital and region.
- Logistics and Transfer Module: Searches hospitals by capacity, identifies nearest suitable facilities, creates transfer requests, and tracks transfer lifecycle status.
- Command Center Module: Provides region-wise occupancy summaries, critical hospital visibility, transfer history, and audit-oriented operational insights.
- Notification Module: Sends activation and critical alert emails, including transfer-related communication events.
- Real-Time Update Module: Broadcasts bed/resource updates for live monitoring and faster operational awareness.

2. PROBLEM STATEMENT

Existing issues:
Traditional hospital coordination workflows are vulnerable to delayed updates, inconsistent reporting formats, and manual reconciliation errors. During surge situations, these issues increase patient routing delays, create avoidable occupancy mismatches, and reduce the reliability of regional planning.

Need for automation / digitization:
A software-driven approach is required to ensure consistent data capture, immediate availability visibility, controlled access by role, and traceable workflow history. Automation reduces dependency on manual communication chains and improves the speed and quality of resource decisions across institutions.

Expected solution:
HOLOID resolves these challenges through a centralized full-stack architecture that combines secure authentication, structured inventory records, transfer orchestration, analytics endpoints, email notifications, and real-time update capabilities. By integrating these functions into a single platform, the system enables faster, data-backed coordination among hospitals and command-center stakeholders.

3. SYSTEM REQUIREMENTS

3.1 Software Requirements
- OS: Windows 10/11 or Linux (Ubuntu 20.04+ recommended for deployment)
- IDE: Visual Studio Code
- Frontend: HTML5, CSS3, TypeScript, React (Vite-based), Tailwind CSS
- Backend: Node.js with Express.js
- Database: MongoDB (accessed via Mongoose)
- Browser: Google Chrome (latest stable version)

3.2 Hardware Requirements
- Minimum RAM: 8 GB
- Minimum Storage: 40 GB HDD/SSD
- Processor: Dual-core 64-bit processor or higher (Intel i3/Ryzen 3 equivalent and above)

4. TECHNOLOGIES USED

Frontend:
The frontend is built with React and TypeScript to create role-based dashboards and operational pages for administrators, doctors, and government users. HTML/CSS with Tailwind CSS is used to deliver responsive UI components, status indicators, forms, and data presentation for daily hospital operations.

Backend:
Node.js and Express.js handle API routing, request validation, business logic, and middleware-driven concerns such as authentication, authorization, and error handling. The backend also coordinates transfer workflows, notification triggers, and real-time integration points.

Database:
MongoDB stores core domain entities such as users, hospitals, resource inventories, transfers, and audit-related records. Mongoose is used for schema modeling, validation, and structured data operations across modules.

API Communication:
The system follows REST-style API design with JSON request/response payloads between frontend and backend services. This enables clean module interaction for authentication, inventory updates, logistics operations, command-center analytics, and notifications.

Authentication and Security:
The platform implements JWT-based authentication, email account activation, and role-based access control to ensure that only authorized users can access protected workflows. Request validation, controlled middleware checks, and secure password handling support reliable protection of operational and user data.

Version Control:
Git is used for source tracking, branching, and collaborative development workflows, while GitHub serves as the remote repository platform for code management and project version history.
