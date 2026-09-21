# AI Capsule

AI Capsule is a full-stack web application for saving, reviewing, updating and managing useful AI prompt records.

The application was developed using React, Node.js, Express and SQLite. GitHub OAuth is used for authentication, and the Express backend issues its own JWT in a secure HTTP-only cookie.

## Live Application

https://ai-capsule-22888003.onrender.com

## GitHub Repository

https://github.com/LTU-22888003/AI-Capsule

## Technologies Used

- React
- Vite
- Node.js
- Express
- SQLite
- GitHub OAuth
- JSON Web Tokens (JWT)
- Render

## Main Features

- Public landing page
- Sign in using GitHub OAuth
- Protected dashboard
- Create prompt records
- View saved prompt records
- Update existing prompt records
- Delete prompt records
- User-specific record ownership
- Secure JWT authentication
- Cloud deployment using Render

## Local Installation

Clone or download the project and open the project folder.

### Backend

```bash
cd backend
npm install
npm start
The backend runs on `http://localhost:5000`.

Health check:

```text
http://localhost:5000/api/health
```

Expected response:

```json
{"status":"ok"}
```

### Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Live Application

https://ai-capsule-22888003.onrender.com

Health endpoint:

https://ai-capsule-22888003.onrender.com/api/health

## GitHub Repository

https://github.com/LTU-22888003/AI-Capsule

## Environment Variables

The application uses these environment variable names:

```text
NODE_ENV
NODE_VERSION
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
JWT_SECRET
```

Secret values are not committed to the repository.

## Authentication

GitHub OAuth is used for sign-in.

After successful GitHub authentication, the Express backend creates its own JWT containing the authenticated GitHub user ID and username.

The JWT is signed using `JWT_SECRET` and stored in an HTTP-only cookie named `token`.

The cookie uses:

- HttpOnly
- Secure in production
- SameSite=Lax
- 24-hour expiry

Protected API requests use `jwt.verify()` before access is allowed.

## API Routes

```text
GET    /api/health
GET    /api/capsules
POST   /api/capsules
PUT    /api/capsules/:id
DELETE /api/capsules/:id
```

All capsule CRUD routes require authentication.

Create operations use the verified JWT user ID as the record owner.

Update and delete operations restrict access using both the record ID and authenticated user ID:

```sql
WHERE id = ? AND user_id = ?
```

## Database

SQLite is used to store AI Capsule prompt records.

The application stores fields including project name, prompt title, version, prompt text, response summary, category, usefulness, reviewed status, improved status, screenshot URL, notes and authenticated user ID.

## Security Tests

### Test 1 - No Authentication

```bash
curl -i https://ai-capsule-22888003.onrender.com/api/capsules
```

Result:

```text
HTTP/2 401
{"error":"Unauthorized"}
```

### Test 2 - Invalid JWT

```bash
curl -i -H "Cookie: token=fake-token-123" https://ai-capsule-22888003.onrender.com/api/capsules
```

Result:

```text
HTTP/2 401
{"error":"Unauthorized"}
```

These tests confirm that the server validates the JWT rather than merely checking whether a cookie exists.

## Cloud Deployment

The application is deployed on Render using a single public service for the React frontend and Express backend.

## Known Limitation

The application uses SQLite on a Render free service. The filesystem is not intended for permanent persistent SQLite storage, so saved data may be lost after some redeployments or instance replacements.

The Render free service may also spin down after inactivity, causing the first request to take longer.

## AI Assistance Declaration

AI assistance was used for development guidance, debugging support and explanation of implementation steps.

All suggestions were reviewed and tested before being used.

One issue found during development involved confusing the letter `O` with the number `0` in the GitHub OAuth Client ID. This caused OAuth authorization to fail. The value was checked against the GitHub OAuth application and corrected.

OAuth and JWT security were verified by successfully signing in through GitHub, confirming that Express created its own JWT, checking the HTTP-only authentication cookie, and confirming that unauthenticated and fake-token requests both returned HTTP 401.

CRUD functionality was verified on the deployed application by creating, reading, updating and deleting prompt records.

User ownership was verified by using the authenticated JWT user ID for database operations and restricting update/delete operations with `user_id`.

The frontend and backend were deployed through the same Render service to simplify production routing and authentication-cookie handling.
