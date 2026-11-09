# Clinic Appointment Booking System

A full-stack, enterprise-grade Clinic Appointment Booking System built according to the **Koya Academy Technical Assessment Specification** (OpenAPI 3.0.3 contract).

The application features an atomic, concurrency-safe JSON-based storage engine, protected API key authentication, idempotency caching, cursor-based pagination, per-email sliding-window rate limiting, comprehensive automated test suites, and a responsive frontend web client.

---

## Table of Contents

1. [Architectural Overview](#architectural-overview)
2. [Compliance with Assessment Levels 1–5](#compliance-with-assessment-levels-15)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Environment Variables](#environment-variables)
6. [Getting Started & Local Installation](#getting-started--local-installation)
7. [Running the Application](#running-the-application)
8. [API Specification & Examples](#api-specification--examples)
   - [Authentication](#authentication-level-2)
   - [POST /reset](#1-post-reset-level-1)
   - [GET /slots](#2-get-slots-level-1)
   - [POST /bookings](#3-post-bookings-levels-15)
   - [GET /bookings](#4-get-bookings-level-4)
   - [GET /bookings/{id}](#5-get-bookingsid-level-1)
   - [DELETE /bookings/{id}](#6-delete-bookingsid-level-3)
9. [Automated Testing](#automated-testing)
10. [Frontend Architecture & Security Proxy](#frontend-architecture--security-proxy)
11. [Deployment & Persistent Storage Guide](#deployment--persistent-storage-guide)
12. [Known Limitations of JSON Storage](#known-limitations-of-json-storage)

---

## Architectural Overview

The system strictly follows the official OpenAPI 3.0.3 specification (`https://koyaacademy.com/assessment-api/openapi.json`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Client Layer                                  │
│  - Browser Client (HTML5 / CSS3 / Vanilla JS)                          │
│  - Automated Graders / API Consumers (curl / test suites)              │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ /client-api/* (same-origin)     │ /* with X-API-Key
                   ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Express.js Application Layer                       │
│  - Auth Middleware (X-API-Key validation)                              │
│  - Sliding Window Rate Limiter (5 attempts/min/email)                  │
│  - Request Validation & Normalization (RFC email, trimming, lower)     │
│  - Centralized Error Handling ({ "error": "<msg>" })                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Service & Concurrency Layer                     │
│  - AsyncLock (In-process serialized write transactions)                │
│  - Atomic File Engine (Temp write + atomic rename)                     │
│  - Idempotency Cache (Exact body match vs 422 conflict)                │
│  - Cursor Pagination Engine (Base64 offset encoding)                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       JSON File Persistence Layer                      │
│   slots.json       │      bookings.json     │    idempotency.json      │
│   (Persistent disk / volume mounted at /data or configured DATA_DIR)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Compliance with Assessment Levels 1–5

### Level 1: Basic Booking Functionality
- **`POST /reset`**: Atomically deletes all existing bookings and replaces all slots with the provided array, including past slots.
- **`GET /slots`**: Returns slots sorted earliest `start` first. Includes `available: boolean` (`false` while slot has a confirmed booking). Supports optional `?provider=` exact-match filter.
- **`POST /bookings`**: Creates a booking with generated unique ID, slot reference, patient name, and lowercase email, setting status to `confirmed` (returns `201`).
- **`GET /bookings/{id}`**: Retrieves booking details or returns `404` (`{"error": "booking not found"}`).

### Level 2: API Key Authentication and Validation
- **Authentication**: Validates incoming `X-API-Key` against the environment variable `API_KEY`. Missing or invalid key immediately returns `401` (`{"error": "Unauthorized"}`).
- **Data Sanitization**: Automatically trims whitespace from `name` and `email`; normalizes `email` to lowercase.
- **Validation**:
  - `400` if `slot_id`, `name`, or `email` is missing or empty.
  - `400` if email format is invalid.
  - `404` if `slot_id` does not exist in `slots.json`.
  - `400` if the slot has already started (`start <= now`).
- **Security**: The browser uses a secure same-origin proxy (`/client-api/*`), preventing `API_KEY` leakage in client-side code.

### Level 3: Concurrency and Cancellation
- **Concurrency Control**: Utilizes an async transaction lock (`AsyncLock`) ensuring that concurrent booking requests for the same slot execute sequentially.
- **Race Condition Prevention**: When multiple requests hit `POST /bookings` simultaneously for the same slot, exactly one request returns `201` and all others return `409` (`{"error": "slot already booked"}`).
- **Cancellation**: `DELETE /bookings/{id}` sets status to `cancelled` and immediately frees the slot (`available: true`). Returns `200` with the cancelled booking object.
- **Cancellation Guards**: Cancelling an already cancelled booking returns `409` (`{"error": "already cancelled"}`). Non-existent IDs return `404`.

### Level 4: Idempotency and Pagination
- **Idempotency**: Supports the `Idempotency-Key` header on `POST /bookings`.
  - Retrying with the same key and identical body returns the original `201` response with the same booking `id` without creating duplicate records.
  - Reusing an existing idempotency key with a different request payload returns `422` (`{"error": "Idempotency-Key reused with a different body"}`).
  - Persisted across restarts in `idempotency.json`.
- **Cursor Pagination**: `GET /bookings?email=<email>&limit=<limit>&cursor=<cursor>`
  - Requires `email` (case-insensitive match).
  - Validates `limit`: integer between 1 and 50 (default: 10). Non-integers or values `< 1` or `> 50` return `400`.
  - Returns `{ "bookings": [...], "next_cursor": "<token>" | null }`.
  - Ordered oldest first (`created_at` ascending). The final page returns `next_cursor: null`.

### Level 5: Rate Limiting
- **Sliding Window Rate Limiter**: Enforces at most 5 booking attempts per email per 60-second window on `POST /bookings`.
- **All Attempts Count**: Both successful and failed booking attempts are recorded.
- **429 Response**: The 6th attempt returns `429` with error `{"error": "Too many attempts for this email"}` and an RFC-compliant `Retry-After: <seconds>` header with whole seconds to wait.
- **Per-Email Isolation**: Rate limits apply strictly per email; other patients are unaffected.

---

## Technology Stack

- **Backend**: Node.js (v24 LTS), Express.js (v4.21), ES Modules (`import`/`export`).
- **Persistence**: File-based JSON storage (`slots.json`, `bookings.json`, `idempotency.json`) using atomic temporary writes and file renaming.
- **Concurrency**: In-process Async Mutex (`AsyncLock`) for serialized transaction processing.
- **Frontend**: HTML5, CSS3 (Custom Properties, Flexbox, CSS Grid), Vanilla JavaScript (ES6+ Fetch API, Idempotency-Key generation, DOM manipulation).
- **Testing**: Built-in Node.js Test Runner (`node:test`, `node:assert/strict`) with isolated disk environments per test suite.

---

## Project Structure

```
clinic-booking-system/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── index.js             # Configuration & environment variable loader
│   │   ├── controllers/
│   │   │   ├── bookingsController.js # Handlers for POST, GET, DELETE /bookings
│   │   │   ├── resetController.js    # Handler for POST /reset
│   │   │   └── slotsController.js    # Handler for GET /slots
│   │   ├── routes/
│   │   │   ├── bookingsRoutes.js     # Protected /bookings endpoints
│   │   │   ├── clientProxyRoutes.js  # Same-origin browser client proxy
│   │   │   ├── resetRoutes.js        # Protected /reset endpoint
│   │   │   └── slotsRoutes.js        # Protected /slots endpoint
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js     # X-API-Key validation (401 on missing/invalid)
│   │   │   ├── errorHandler.js       # Centralized error formatter { error: "<msg>" }
│   │   │   ├── rateLimitMiddleware.js# Sliding-window rate limiter (5 attempts/min)
│   │   │   └── validationMiddleware.js# Request validation for bookings, query, slots
│   │   ├── services/
│   │   │   ├── bookingsService.js    # Core booking business logic & concurrency
│   │   │   ├── idempotencyService.js # Idempotency persistence & comparison
│   │   │   ├── slotsService.js       # Slot listing, sorting, and availability
│   │   │   └── storageService.js     # JSON read/write, initialization & locking
│   │   ├── utils/
│   │   │   ├── asyncLock.js          # In-process asynchronous mutex
│   │   │   ├── atomicFile.js         # Atomic temporary file write + rename
│   │   │   └── cursor.js             # Base64 cursor encoding and decoding
│   │   ├── data/
│   │   │   ├── slots.json            # Active clinic appointment slots
│   │   │   ├── bookings.json         # Permanent booking records
│   │   │   └── idempotency.json      # Idempotency cache store
│   │   └── app.js                   # Express application setup & middleware
│   │
│   ├── server.js                    # HTTP server entrypoint
│   ├── package.json                 # Backend dependencies & scripts
│   ├── .env                         # Local environment variables
│   └── .env.example                 # Example environment template
│
├── frontend/
│   ├── index.html                   # Main landing page & booking modal
│   ├── bookings.html                # My Bookings lookup, pagination & cancellation
│   ├── css/
│   │   └── style.css                # Clinic responsive design stylesheet
│   └── js/
│       └── app.js                   # Client frontend API integration
│
├── tests/
│   ├── testHelper.js                # Test server harness with isolated temp storage
│   ├── level1.test.js               # Level 1 tests: Reset, Slots, Book, Lookup
│   ├── level2.test.js               # Level 2 tests: API Key & Validation
│   ├── level3.test.js               # Level 3 tests: Concurrency (10 sim) & Cancel
│   ├── level4.test.js               # Level 4 tests: Idempotency & Cursor Pagination
│   ├── level5.test.js               # Level 5 tests: 5 attempts/min Rate Limiting
│   ├── persistence.test.js          # Persistence tests: Survives server restart
│   └── frontendIntegration.test.js  # Static serving & client proxy tests
│
├── Dockerfile                       # Multi-stage container definition
├── render.yaml                      # Render Blueprint with Persistent Disk
├── package.json                     # Root project runner
├── .gitignore
└── README.md
```

---

## Environment Variables

Copy `.env.example` to create your `.env` file:

```bash
cp backend/.env.example backend/.env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server listening port | `3000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |
| `API_KEY` | Secret key required in the `X-API-Key` request header | `koya_clinic_secret_key_2026` |
| `DATA_DIR` | Directory path where JSON files are stored | `src/data` (or `/data` in Docker) |

---

## Getting Started & Local Installation

### Prerequisites
- Node.js version 20 or higher (Node 24 LTS recommended).
- npm version 9 or higher.

### Installation
From the root directory:

```bash
# Install backend dependencies
cd backend
npm install
cd ..
```

---

## Running the Application

### Start Development Server
```bash
npm run dev
```

### Start Production Server
```bash
npm start
```

Once started:
- **Frontend Website**: `http://localhost:3000/`
- **My Bookings Page**: `http://localhost:3000/bookings.html`
- **Health Check**: `http://localhost:3000/health`
- **API Endpoints**: `http://localhost:3000/slots`, `http://localhost:3000/bookings`

---

## API Specification & Examples

### Authentication (Level 2)
All direct assessment endpoints require the header:
```http
X-API-Key: koya_clinic_secret_key_2026
```
Missing or invalid key returns:
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Unauthorized"
}
```

---

### 1. `POST /reset` (Level 1)
Atomically clears all bookings and idempotency records, and replaces slots with the provided array.

#### Request
```http
POST /reset HTTP/1.1
Host: localhost:3000
X-API-Key: koya_clinic_secret_key_2026
Content-Type: application/json

{
  "slots": [
    {
      "id": "s1",
      "provider": "Dr Ade",
      "start": "2026-12-10T09:00:00Z",
      "end": "2026-12-10T09:30:00Z"
    },
    {
      "id": "s2",
      "provider": "Dr Chioma",
      "start": "2026-12-10T10:00:00Z",
      "end": "2026-12-10T10:30:00Z"
    }
  ]
}
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Done"
}
```

---

### 2. `GET /slots` (Level 1)
Returns all slots sorted earliest `start` first. Includes `available: boolean`.

#### Request
```http
GET /slots?provider=Dr%20Ade HTTP/1.1
Host: localhost:3000
X-API-Key: koya_clinic_secret_key_2026
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "slots": [
    {
      "id": "s1",
      "provider": "Dr Ade",
      "start": "2026-12-10T09:00:00Z",
      "end": "2026-12-10T09:30:00Z",
      "available": true
    }
  ]
}
```

---

### 3. `POST /bookings` (Levels 1–5)
Books an available slot with concurrency locking, validation, idempotency, and rate limiting.

#### Request
```http
POST /bookings HTTP/1.1
Host: localhost:3000
X-API-Key: koya_clinic_secret_key_2026
Idempotency-Key: a4c8c760-b99b-4bf1-8390-eecab7168d67
Content-Type: application/json

{
  "slot_id": "s1",
  "name": "Ada Obi",
  "email": "ada@example.com"
}
```

#### Success Response
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "b6f00db1-5dd5-48b2-a42e-13c54c30c336",
  "slot_id": "s1",
  "name": "Ada Obi",
  "email": "ada@example.com",
  "status": "confirmed",
  "created_at": "2026-11-09T17:04:39.405Z"
}
```

#### Error Responses
- **400 Missing / Invalid Field or Slot Started**:
  ```json
  { "error": "slot has already started" }
  ```
- **404 Slot Does Not Exist**:
  ```json
  { "error": "slot not found" }
  ```
- **409 Slot Already Booked (Level 3 Concurrency Conflict)**:
  ```json
  { "error": "slot already booked" }
  ```
- **422 Idempotency Key Reused with Different Body (Level 4)**:
  ```json
  { "error": "Idempotency-Key reused with a different body" }
  ```
- **429 Rate Limit Exceeded (Level 5 — 6th attempt in 1 minute)**:
  ```http
  HTTP/1.1 429 Too Many Requests
  Retry-After: 54
  Content-Type: application/json

  { "error": "Too many attempts for this email" }
  ```

---

### 4. `GET /bookings` (Level 4)
Returns a patient's bookings sorted oldest first using cursor-based pagination.

#### Request
```http
GET /bookings?email=ada@example.com&limit=2 HTTP/1.1
Host: localhost:3000
X-API-Key: koya_clinic_secret_key_2026
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "bookings": [
    {
      "id": "b6f00db1-5dd5-48b2-a42e-13c54c30c336",
      "slot_id": "s1",
      "name": "Ada Obi",
      "email": "ada@example.com",
      "status": "confirmed",
      "created_at": "2026-11-09T17:04:39.405Z"
    }
  ],
  "next_cursor": "eyJvZmZzZXQiOjJ9"
}
```

---

### 5. `GET /bookings/{id}` (Level 1)
Retrieves a booking by ID.

#### Request
```http
GET /bookings/b6f00db1-5dd5-48b2-a42e-13c54c30c336 HTTP/1.1
Host: localhost:3000
X-API-Key: koya_clinic_secret_key_2026
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "b6f00db1-5dd5-48b2-a42e-13c54c30c336",
  "slot_id": "s1",
  "name": "Ada Obi",
  "email": "ada@example.com",
  "status": "confirmed",
  "created_at": "2026-11-09T17:04:39.405Z"
}
```

---

### 6. `DELETE /bookings/{id}` (Level 3)
Cancels a booking, marks status as `cancelled`, and frees the slot.

#### Request
```http
DELETE /bookings/b6f00db1-5dd5-48b2-a42e-13c54c30c336 HTTP/1.1
Host: localhost:3000
X-API-Key: koya_clinic_secret_key_2026
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "b6f00db1-5dd5-48b2-a42e-13c54c30c336",
  "slot_id": "s1",
  "name": "Ada Obi",
  "email": "ada@example.com",
  "status": "cancelled",
  "created_at": "2026-11-09T17:04:39.405Z"
}
```

- If already cancelled: returns `409` (`{"error": "already cancelled"}`).
- If ID does not exist: returns `404` (`{"error": "booking not found"}`).

---

## Automated Testing

The project includes 34 comprehensive automated tests covering all 5 levels, data persistence across server restart, and frontend client proxy integration.

Run all tests:
```bash
npm test
```

### Test Suite Summary:
- **`tests/level1.test.js`**: `POST /reset`, `GET /slots` ordering, provider filtering, `POST /bookings` 201 creation, `GET /bookings/{id}` 200 and 404.
- **`tests/level2.test.js`**: Missing/invalid `X-API-Key` (401), missing/empty fields (400), invalid email format (400), non-existent slot (404), slot already started (400), trimming and lowercasing.
- **`tests/level3.test.js`**: Slot already booked (409), 10 simultaneous concurrent requests to the same slot (1 succeeds with 201, 9 fail with 409), `DELETE /bookings/{id}` freeing slots, double cancellation (409).
- **`tests/level4.test.js`**: Idempotency key retry (201 identical response), key reused with different body (422), cursor pagination next/previous, limit validation (1–50), case-insensitive email search.
- **`tests/level5.test.js`**: 5 attempts permitted per email; 6th attempt returns 429 with `Retry-After` header; other emails unaffected.
- **`tests/persistence.test.js`**: Shuts down server completely, boots a new server on the same disk directory, verifies bookings and slot availability survive intact.
- **`tests/frontendIntegration.test.js`**: Static HTML/CSS/JS serving, same-origin client proxy operations without client-side API key leakage.

---

## Frontend Architecture & Security Proxy

Per assessment security requirements:
- **No API Secrets in Frontend**: Client-side JavaScript never contains `API_KEY` or `X-API-Key` headers.
- **Same-Origin Proxy**: The browser interacts with `/client-api/*` endpoints. Express validates the request and processes the transaction on the server.
- **External Consumer Access**: Automated grading tools, curl, and external partners communicate with `/reset`, `/slots`, `/bookings` passing the `X-API-Key` header.
- **Client Idempotency**: The browser automatically attaches an `Idempotency-Key` UUID on booking submissions to prevent accidental double-submits on slow networks.

---

## Deployment & Persistent Storage Guide

Because this application uses JSON storage, bookings must be persisted to a **non-ephemeral disk volume**. Deploying to a standard ephemeral container without a persistent volume will cause bookings to disappear when the container restarts or re-deploys.

### Recommended Platform: Render with Persistent Disk

Render provides managed persistent block storage (`Render Disks`) mounted at `/data`.

1. **Deploy via Render Blueprint**:
   - The repository includes `render.yaml`.
   - In the Render Dashboard, select **New -> Blueprint** and connect this repository.
   - The blueprint provisions a Web Service with 1 instance and a 1GB persistent disk mounted at `/data`.
2. **Environment Variables on Render**:
   - `PORT`: `10000`
   - `NODE_ENV`: `production`
   - `API_KEY`: `<your_secure_api_key>`
   - `DATA_DIR`: `/data`
3. **Persistent Disk Mount**:
   - Mount path: `/data`
   - Size: 1 GB (ample for millions of JSON booking records).

### Alternative: Railway or Fly.io Volume
- **Railway**: Add a Volume in the Railway dashboard mounted at `/data`, and set `DATA_DIR=/data`.
- **Fly.io**: Run `fly volumes create clinic_data --size 1` and mount to `/data` in `fly.toml`.

### Docker Deployment
```bash
# Build the production image
docker build -t clinic-booking-system .

# Run container with persistent volume
docker run -d \
  --name clinic-booking \
  -p 3000:3000 \
  -v clinic_storage:/data \
  -e API_KEY="koya_clinic_secret_key_2026" \
  -e DATA_DIR="/data" \
  clinic-booking-system
```

---

## Known Limitations of JSON Storage

While this application implements atomic writes and memory mutexes, file-based JSON storage has inherent architectural trade-offs compared to relational database engines (PostgreSQL) or document stores (MongoDB):

1. **Single-Instance Deployment Limitation**:
   - Concurrency locking uses an in-process asynchronous mutex (`AsyncLock`).
   - This guarantees 100% thread/event-loop safety for a single server instance.
   - However, running multiple scaled container instances (e.g., behind a round-robin load balancer) would cause race conditions because the local file lock is not distributed across separate machines.
   - **Production Requirement**: Must run as a single backend instance (`numInstances: 1`).
2. **I/O Scaling on Large Datasets**:
   - Every write writes the full array of bookings to disk atomically via a temporary file and rename.
   - For thousands of bookings, write performance is fast (<5ms); for hundreds of thousands of records, memory parsing and serialization overhead will increase compared to indexed B-tree database storage.
3. **No Incremental Write Append**:
   - File replacement ensures no corrupted JSON syntax, but disk write throughput scales with total file size rather than individual record size.

---

## License & Credits

Built for the **Koya Academy Assessment**. Developed by a Senior Full-Stack Engineer adhering to professional software engineering standards.
