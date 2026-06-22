# Project: central-panel (facultyware)

## Overview
This is a modern Node.js web application built with Express and EJS. It focuses on a clean, "shadcn/ui" aesthetic using vanilla JavaScript and Tailwind CSS via the **Basecoat** library, with **HTMX** for dynamic interactivity.

## Tech Stack
- **Framework:** Express.js
- **Template Engine:** EJS
- **Styling:** Tailwind CSS (via Basecoat)
- **UI Components:** Basecoat (Vanilla JS + CSS)
- **Interactivity:** HTMX (for partial updates and SPA-like navigation)

## Project Structure & Conventions
- `app.js`: Application entry point and middleware configuration.
- `routes/`: Express router definitions.
- `controllers/`: Application logic for handling requests, extracted from routes.
- `middlewares/`: Custom middleware for authentication, error handling, and access control.
- `lib/db.js`: Database connection and query utility.
- `views/`: EJS templates. 
    - Use `home.ejs` as the primary reference for layout and component usage.
    - Leverage HTMX attributes (`hx-boost`, `hx-target`, `hx-select`) for seamless transitions.
- `public/assets/`:
    - `styles.css`: The primary Tailwind/Basecoat stylesheet.
    - `js/`: Modular vanilla JS components for UI elements. Ensure any new interactive components follow this pattern.

## Development Guidelines
- **UI Components:** Do NOT use React. All UI components are vanilla JS/CSS. Refer to the `public/assets/js/` directory for existing implementations.
- **Styling:** Prefer standard Tailwind classes. Basecoat provides a set of pre-defined components (`btn`, `card`, `input`, etc.) that should be used consistently.
- **Dynamic Content:** Use HTMX for any dynamic updates. Favor server-side partial rendering over client-side fetching and JSON parsing where possible.
- **Themes:** Support for light/dark mode and variant themes is handled by `localStorage` and class toggling on the `<html>` element. Ensure new views include the initialization scripts found in `home.ejs` or `login.ejs`.

## Access Control (ACL)
The project uses a Role-Based Access Control (RBAC) system managed via the `middlewares/acl.js` middleware.

### Database Schema
The following tables are required for ACL:
- **`roles`**: Defines user roles.
    - `id` (INT, Primary Key)
    - `name` (VARCHAR, Unique) - e.g., 'admin', 'staff', 'student'
- **`permissions`**: Defines granular actions.
    - `id` (INT, Primary Key)
    - `name` (VARCHAR, Unique) - e.g., 'manage_users', 'view_reports'
- **`role_has_permissions`**: Pivot table linking roles to permissions.
    - `role_id` (INT, Foreign Key -> `roles.id`)
    - `permission_id` (INT, Foreign Key -> `permissions.id`)
- **`user_has_roles`**: Pivot table linking users to roles.
    - `user_id` (INT, Foreign Key -> `users.id`)
    - `role_id` (INT, Foreign Key -> `roles.id`)

### Usage
To protect a route with a specific permission (or any one of multiple permissions):
```javascript
const { checkPermission } = require('../middlewares/acl');

// Single permission
router.get('/reports', checkPermission('view_reports'), reportController.index);

// Multiple permissions (user must have at least one)
router.get('/reports', checkPermission(['view_reports', 'manage_all']), reportController.index);
```

## Commands
- `npm start`: Runs the production server using `bin/www`.
- `npm run dev`: Runs the server with `nodemon` for development.
