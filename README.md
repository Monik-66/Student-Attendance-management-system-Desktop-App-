# SNPSU Teacher Desktop

A desktop attendance and academic workflow application for faculty and admin use. This project combines an Electron frontend with a Node.js/Express API and PostgreSQL-backed data access for attendance tracking, section summaries, admin reporting, and elective-aware student filtering.

## Overview

This application is designed for a university environment where teachers need to:

- sign in to a desktop workspace,
- review assigned sections,
- record daily attendance by date and subject,
- review absentee lists,
- manage course-based student filtering for elective programs,
- and generate admin summary reports.

The app supports a teacher-facing desktop interface and a separate admin workflow for section reporting.

## Tech Stack

- JavaScript
- Electron
- Node.js
- Express
- PostgreSQL
- dotenv

## Project Structure

- `main.js` — Electron main process
- `renderer.js` — UI logic and page rendering
- `index.html` — app shell and views
- `styles.css` — desktop styling
- `server.js` — Express API with auth and attendance routes
- `db.js` — PostgreSQL database layer
- `schema.sql` — core database tables and schema
- `create_database.sql` — database bootstrap script
- `seed_students.sql` — sample seed data for local testing
- `reset_schema.js` — schema reset utility
- `offline-store.js` — offline caching logic
- `api-client.js` — API helper usage
- `twilio-service.js` and `ozeki-service.js` — messaging integrations
- `snpsu_admin/` — admin workflow related files
- `report_assets/` — report branding/assets
- `rendered_report/` — output directory for generated reports

## Prerequisites

Before running this project, make sure you have:

- Node.js 18+ installed
- PostgreSQL running locally or on a reachable host
- A database created for the app
- An `.env` file based on `.env.example`

## Local Setup

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the example environment file:

   ```bash
   copy .env.example .env
   ```

4. Update `.env` with your local database and service credentials.

5. Start the API server:

   ```bash
   npm run start:api
   ```

6. Start the desktop app in another terminal:

   ```bash
   npm start
   ```

## Database Setup

Initialize the database schema using the SQL files provided in the project. Example:

```bash
psql -U postgres -d snpsu_teacher -f schema.sql
```

If the app includes a database bootstrap script, you can also use that flow depending on your environment.

## Environment Variables

The app expects variables similar to:

- `API_PORT`
- `API_TOKEN_SECRET`
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PGSSL`

See `.env.example` for the full configuration template.

## Public Repository Notes

This repository is prepared for GitHub upload. Before publishing:

- do not commit your real `.env` file,
- do not commit real student, teacher, or parent contact data,
- replace local sample data with sanitized test records,
- keep database credentials and runtime artifacts out of version control.

## License

This project is licensed under the MIT License.
