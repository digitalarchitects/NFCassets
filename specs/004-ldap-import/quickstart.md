# Quickstart: LDAP/Active Directory Import

## Prerequisites

- Spec 002 (user management) implemented
- Spec 003 (master lists) recommended but optional
- LDAP/AD server reachable on port 389 (or 636 for LDAPS)
- AD bind account with read access to the user OU

## Setup

```bash
npm install ldapjs
```

Add to `.env`:

```env
LDAP_URL=ldap://dc.example.com
LDAP_BASE_DN=OU=Users,DC=example,DC=com
LDAP_BIND_DN=CN=ldap-reader,OU=Service Accounts,DC=example,DC=com
LDAP_BIND_PASSWORD=the-bind-password
LDAP_SYNC_HOUR=3
```

## Validation

### 1. Test Connection

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/admin/ldap/test \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{
    "url": "ldap://dc.example.com",
    "baseDn": "OU=Users,DC=example,DC=com",
    "bindDn": "CN=ldap-reader,DC=example,DC=com",
    "password": "the-bind-password"
  }'
# → 200 {"connected":true,"userCount":247}
# Or on error:
# → 400 {"connected":false,"error":"Invalid credentials (49)"}
```

### 2. Manual Import

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/admin/ldap/import \
  -H "CSRF-Token: <token>"
# → 200 {
#     "syncLogId": 1,
#     "usersCreated": 45,
#     "usersUpdated": 2,
#     "usersDisabled": 0,
#     "usersMissing": 0,
#     "issuesCreated": 0,
#     "errors": []
#   }
```

### 3. Verify Imported Users

```bash
curl -b cookies.txt http://localhost:3000/api/users
# → shows users with ad_guid, display_name, email populated
# Manual users show ad_guid: null
```

### 4. Incremental Update

- Change a user's `displayName` in AD
- Change a user's `physicalDeliveryOfficeName` in AD
- Run import again

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/admin/ldap/import \
  -H "CSRF-Token: <token>"
# → {"usersCreated": 0, "usersUpdated": 2, "usersDisabled": 0, ...}
```

### 5. Disabled User Detection

- Disable a test user in AD (set account to disabled)
- Run import

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/admin/ldap/import \
  -H "CSRF-Token: <token>"
# → {"issuesCreated": 1, ...}

curl -b cookies.txt http://localhost:3000/api/admin/sync/issues
# → [{"username":"testuser","issue_type":"ad_disabled","resolved":0}]
```

### 6. Missing User Detection

- Delete a test user from AD
- Run import

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/admin/ldap/import \
  -H "CSRF-Token: <token>"
# → {"usersMissing": 1, "issuesCreated": 1, ...}
```

### 7. Resolve Issues

```bash
# Deactivate local account for user missing from AD
curl -b cookies.txt -X PUT http://localhost:3000/api/admin/sync/issues/1 \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"action":"deactivated"}'
# → 200 {"resolved":true}

# Keep user active (ignore the AD removal)
curl -b cookies.txt -X PUT http://localhost:3000/api/admin/sync/issues/2 \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"action":"ignored"}'
# → 200 {"resolved":true}

# Re-enable a user disabled by AD sync
curl -b cookies.txt -X PUT http://localhost:3000/api/admin/sync/issues/3 \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"action":"re_enabled"}'
# → 200 {"resolved":true}
```

### 8. Sync Log History

```bash
curl -b cookies.txt http://localhost:3000/api/admin/sync/log
# → [{"id":2,"started":"...","finished":"...","usersCreated":0,...}, ...]

curl -b cookies.txt http://localhost:3000/api/admin/sync/log/1
# → full log with issues array
```

### 9. Imported User Login

```bash
# Imported users get a random temp password — admin must set their password
curl -b cookies.txt -X PUT http://localhost:3000/api/users/5/password \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"password":"actual-password"}'

# Now user can log in
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"jdoe","password":"actual-password"}'
# → 200
```

### 10. UI Validation

1. Login as admin → nav shows "LDAP Import" link
2. LDAP Import page → enter AD details → click "Test Connection" → green success badge with user count
3. Click "Import Now" → see summary: "45 created, 2 updated, 0 issues"
4. Navigate to Users page → see imported users with display names and AD source badge
5. Navigate to "Sync Review" → see any issues flagged for attention
6. Click "Deactivate" on a missing user → user greyed out in Users page
