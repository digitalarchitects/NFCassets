# Quickstart: User & Role Management

## Prerequisites

- 001-initial-mvp running and functional
- At least one admin account (seeded via `npm run seed`)

## Validation After Implementation

### 1. Schema Migration

```bash
npm start
# Check logs — no errors about duplicate column
# If column already existed, should start normally
```

### 2. Admin Creates a User

```bash
# Login as admin, get session cookie
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<admin-password>"}'

# Get CSRF token
curl -b cookies.txt http://localhost:3000/api/csrf-token
# → {"csrfToken":"..."}

# Create user
curl -b cookies.txt -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "CSRF-Token: <token>" \
  -d '{"username":"staff1","password":"pass1234","role":"user"}'
# → 201 {"user":{"id":2,"username":"staff1","role":"user","active":1,...}}
```

### 3. New User Logs In

```bash
curl -c staff_cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"staff1","password":"pass1234"}'
# → 200 {"user":{"id":2,"username":"staff1","role":"user"}}
```

### 4. New User Changes Password

```bash
curl -b staff_cookies.txt -X PUT http://localhost:3000/api/auth/password \
  -H "Content-Type: application/json" \
  -H "CSRF-Token: <token>" \
  -d '{"currentPassword":"pass1234","newPassword":"newpass5678"}'
# → 200 {"ok":true}

# Verify old password fails
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"staff1","password":"pass1234"}'
# → 401

# Verify new password works
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"staff1","password":"newpass5678"}'
# → 200
```

### 5. Admin Promotes User

```bash
curl -b cookies.txt -X PUT http://localhost:3000/api/users/2 \
  -H "Content-Type: application/json" \
  -H "CSRF-Token: <token>" \
  -d '{"role":"admin"}'
# → 200
```

### 6. Admin Deactivates User

```bash
curl -b cookies.txt -X PUT http://localhost:3000/api/users/2 \
  -H "Content-Type: application/json" \
  -H "CSRF-Token: <token>" \
  -d '{"active":0}'
# → 200

# Deactivated user's next API call fails
curl -b staff_cookies.txt http://localhost:3000/api/auth/me
# → 401 "Account is disabled"
```

### 7. Edge Cases

```bash
# Duplicate username
curl -b cookies.txt -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "CSRF-Token: <token>" \
  -d '{"username":"staff1","password":"test","role":"user"}'
# → 409 "Username already exists"

# Last admin guard
curl -b cookies.txt -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -H "CSRF-Token: <token>" \
  -d '{"role":"user"}'
# → 403 "Cannot remove the last admin"

# Self-deactivation
curl -b cookies.txt -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -H "CSRF-Token: <token>" \
  -d '{"active":0}'
# → 403 "Cannot deactivate your own account"

# Wrong current password
curl -b staff_cookies.txt -X PUT http://localhost:3000/api/auth/password \
  -H "Content-Type: application/json" \
  -H "CSRF-Token: <token>" \
  -d '{"currentPassword":"wrong","newPassword":"something"}'
# → 401 "Current password is incorrect"
```

### 8. UI Validation

1. Login as admin → nav bar shows "Users" link → click → see user table with all accounts
2. Click "Add User" → fill form → user appears in table
3. Change a user's role via dropdown → page reflects change
4. Click "Reset Password" on a user row → enter new password → confirmation
5. Click "Deactivate" on a user → row greys out, shows "Inactive"
6. Login as that user → "Account is disabled" error
7. Login as regular user → click username in navbar → profile page shows username, role, created date
8. Change own password → old password stops working
