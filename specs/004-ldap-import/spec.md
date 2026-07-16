# Feature Specification: LDAP/Active Directory Import

**Feature Branch**: `004-ldap-import`  
**Created**: 2026-07-16  
**Status**: Draft  
**Input**: Import users and office locations from Active Directory via LDAP. Run daily sync to detect deltas — new users, disabled users, changed details. Flag issues like departed users for admin review.

## User Scenarios & Testing

### User Story 1 - Admin: Configure LDAP Connection (Priority: P1) 🎯 MVP

An administrator configures the LDAP connection settings — server URL, base DN, bind credentials, and field mappings. The settings are stored securely and the connection is tested before saving.

**Why this priority**: Nothing works without a valid connection. Must be first.

**Independent Test**: Admin enters LDAP server details, clicks "Test Connection" — sees success with user count or specific error message. Saves configuration — it persists across restarts.

**Acceptance Scenarios**:

1. **Given** a valid LDAP server, **When** admin enters URL, base DN, bind DN, password and clicks "Test", **Then** they see "Connected — N users found"
2. **Given** an invalid LDAP server, **When** admin clicks "Test", **Then** they see a specific error (e.g., "Connection refused", "Invalid credentials", "Base DN not found")
3. **Given** configuration is saved, **When** the server restarts, **Then** the configuration is reloaded from `.env`
4. **Given** no LDAP configuration exists, **When** the app starts, **Then** LDAP import is skipped (no errors)

---

### User Story 2 - Admin: Run Manual Import (Priority: P1) 🎯 MVP

An administrator triggers a manual LDAP import from the UI. The system connects to AD, fetches all active users, and creates or updates local user accounts. User accounts from AD are linked by `objectGUID` so renames in AD are tracked correctly.

**Why this priority**: The import is the core feature — populating local users from the directory.

**Independent Test**: Admin clicks "Import Now." New AD users appear in the user list. Existing linked users get updated display names and locations. The import summary shows created/updated/disabled counts.

**Acceptance Scenarios**:

1. **Given** AD has 50 active users and the local DB is empty, **When** admin runs import, **Then** 50 new local user accounts are created, each linked to their AD `objectGUID`
2. **Given** a user "jdoe" was imported previously, **When** their display name changes in AD and import runs again, **Then** the local user's display name is updated
3. **Given** a user was imported from AD, **When** their AD account is disabled (userAccountControl bit set), **Then** the next import marks the local user as inactive
4. **Given** an admin manually created a local user (no AD link), **When** LDAP import runs, **Then** the manual user is left untouched

---

### User Story 3 - Import Office Locations from AD (Priority: P1) 🎯 MVP

During user import, the system extracts unique office location values from AD (`physicalDeliveryOfficeName`) and adds them to the Locations master list (from spec 003). Newly imported users are automatically linked to their AD office location.

**Why this priority**: This bridges LDAP with spec 003 — locations flow from AD into the master list automatically, and users get assigned to the right location.

**Independent Test**: Import users from AD where 3 users have "Head Office" as office and 2 have "Depot." Locations "Head Office" and "Depot" are created in the locations table. Users are linked to the correct location. The locations appear in the admin Locations list.

**Acceptance Scenarios**:

1. **Given** AD users have `physicalDeliveryOfficeName` values, **When** import runs, **Then** unique office values become active locations in the locations table
2. **Given** a location "Head Office" already exists, **When** import finds users with that office, **Then** no duplicate location is created — users are linked to the existing one

---

### User Story 4 - Daily Automated Sync (Priority: P2)

The system runs a daily LDAP sync automatically (configurable schedule). After each sync, it generates a delta report showing new users, disabled users, changed users, and missing users (in local DB but not in AD — possible departed staff).

**Why this priority**: Automation is the goal, but manual import must work first. Daily sync prevents the local DB from drifting from AD.

**Independent Test**: Configure daily sync at 06:00. Next morning, check the sync log — shows import ran with N users processed. New user added to AD overnight appears in local DB. Departed user disabled in AD shows as inactive locally.

**Acceptance Scenarios**:

1. **Given** sync is scheduled daily at 03:00, **When** the scheduled time arrives, **Then** the import runs automatically and logs results
2. **Given** a sync just ran, **When** admin views the sync log, **Then** they see timestamp, users created, users updated, users disabled, errors (if any)
3. **Given** a user exists locally with an AD link but is no longer in AD, **When** sync runs, **Then** that user is NOT automatically disabled — they appear in the "missing from AD" report for admin review

---

### User Story 5 - Admin: Review Sync Issues (Priority: P2)

After each sync, the admin sees a dashboard of issues requiring attention: users who exist locally but not in AD (possible departures), users whose AD accounts were disabled, users whose details changed. The admin can act on each — deactivate the local account, ignore, or re-link.

**Why this priority**: Automated sync without human review is dangerous — you don't want to accidentally disable accounts for users who were temporarily removed from a sync scope or had a DN change.

**Independent Test**: After a sync, the sync review page shows "3 users missing from AD." Admin sees user "jdoe" → clicks "Deactivate" → user is disabled locally. Admin sees user "contractor1" → clicks "Ignore" → they stay active and won't appear in next sync's missing list.

**Acceptance Scenarios**:

1. **Given** a sync found 3 users in local DB with no matching AD account, **When** admin views the sync review page, **Then** all 3 are listed with their last-known AD details
2. **Given** a missing user is listed, **When** admin clicks "Deactivate", **Then** the local account is deactivated and the issue is marked resolved
3. **Given** a missing user is listed, **When** admin clicks "Ignore" (keep active), **Then** the user stays active and a flag is set so they're not reported again unless their status changes
4. **Given** a user was disabled by sync (AD account disabled), **When** admin views the review page, **Then** they see the disabled user and can confirm or re-enable

---

### Edge Cases

- **Empty AD fields**: If a user has no `sAMAccountName`, they are skipped (username is required). If they have no `physicalDeliveryOfficeName`, they get no location link (nullable FK).
- **Username conflicts**: If AD `sAMAccountName` matches an existing manually-created local user with no AD link, the import skips that user and flags the conflict for admin review.
- **DN/OU changes**: A user moved to a different OU gets a new `distinguishedName`. The import uses `objectGUID` for matching, so the user is correctly identified despite the DN change.
- **Bind account expiry**: If the LDAP bind account password expires, the connection test and import will fail with a clear "Invalid credentials" error. The app does not auto-disable the import — admin must fix credentials.
- **Large directories**: AD with 5,000+ users. The import uses paged results (LDAP paging control) to avoid hitting server-side size limits.
- **Deleted AD objects**: If an AD user is hard-deleted (not just disabled), they'll appear as "missing from AD" in the next sync. The admin reviews and deactivates.
- **Sync during network outage**: If the LDAP server is unreachable during a scheduled sync, the sync is skipped and an error is logged. No changes are made to local users.
- **Schema drift**: If spec 003 (master lists) is not yet implemented, location import is skipped gracefully — users are created without location links. Feature degrades cleanly.

## Requirements

### Functional Requirements

- **FR-001**: System MUST support LDAP connection configuration via environment variables (LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASSWORD)
- **FR-002**: System MUST allow testing the LDAP connection from the admin UI
- **FR-003**: System MUST import active AD users (filter: `(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`)
- **FR-004**: System MUST map AD attributes to local user fields: `sAMAccountName` → username, `displayName` → display_name, `mail` → email, `physicalDeliveryOfficeName` → office location
- **FR-005**: System MUST store the AD `objectGUID` as the immutable link between AD and local user accounts
- **FR-006**: System MUST match existing users by `objectGUID` on re-import (survives renames and OU moves)
- **FR-007**: System MUST extract unique `physicalDeliveryOfficeName` values from AD and add them to the locations master list (spec 003)
- **FR-008**: System MUST link imported users to their AD office location via FK
- **FR-009**: System MUST detect AD-disabled users (userAccountControl bit 2) and flag them for review
- **FR-010**: System MUST detect locally-linked users missing from AD and flag them for admin review (NOT auto-disable)
- **FR-011**: System MUST support scheduled daily sync with configurable time
- **FR-012**: System MUST generate a sync report showing: users created, updated, disabled, missing, errors
- **FR-013**: System MUST use LDAP paged results for directories with more than 1,000 users
- **FR-014**: System MUST skip users with duplicate usernames (conflicting with manual local accounts) and flag them
- **FR-015**: System MUST log all sync activity with timestamps for audit purposes

### Key Entities

- **LdapConfig**: Connection settings stored in `.env` — LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASSWORD. No database table needed.
- **User** (extended): New columns: `ad_guid` (TEXT, the base64-encoded objectGUID — null for manual users), `display_name` (TEXT, from AD displayName), `email` (TEXT, from AD mail). Locally-created users have `ad_guid IS NULL`.
- **SyncLog**: New table — `id`, `started` (DATETIME), `finished` (DATETIME), `users_created` (INT), `users_updated` (INT), `users_disabled` (INT), `users_missing` (INT), `errors` (TEXT, JSON array of error messages).
- **SyncIssue**: New table — `id`, `sync_log_id` (FK), `username` (TEXT), `issue_type` (TEXT: 'missing_from_ad' | 'ad_disabled' | 'conflict' | 'changed'), `details` (TEXT, JSON), `resolved` (INTEGER DEFAULT 0), `resolution` (TEXT: null | 'deactivated' | 'ignored' | 're_enabled'). Pending issues from the most recent sync.

### Schema Changes

```sql
ALTER TABLE users ADD COLUMN ad_guid TEXT;          -- base64(objectGUID), null for manual users
ALTER TABLE users ADD COLUMN display_name TEXT;     -- from AD displayName
ALTER TABLE users ADD COLUMN email TEXT;            -- from AD mail

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ad_guid ON users(ad_guid) WHERE ad_guid IS NOT NULL;

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started DATETIME NOT NULL,
    finished DATETIME,
    users_created INTEGER DEFAULT 0,
    users_updated INTEGER DEFAULT 0,
    users_disabled INTEGER DEFAULT 0,
    users_missing INTEGER DEFAULT 0,
    errors TEXT                   -- JSON array of error strings
);

CREATE TABLE IF NOT EXISTS sync_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_log_id INTEGER NOT NULL REFERENCES sync_log(id),
    username TEXT NOT NULL,
    issue_type TEXT NOT NULL,     -- 'missing_from_ad', 'ad_disabled', 'conflict', 'changed'
    details TEXT,                 -- JSON with relevant info
    resolved INTEGER DEFAULT 0,
    resolution TEXT,              -- 'deactivated', 'ignored', 're_enabled', null
    resolved_at DATETIME,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Dependencies

```bash
npm install ldapjs   # Pure JavaScript LDAP client, MIT licensed
```

## Success Criteria

- **SC-001**: Manual import of 500 AD users completes in under 30 seconds
- **SC-002**: Re-import of unchanged directory produces zero changes (idempotent)
- **SC-003**: User moved to different OU in AD is correctly matched by objectGUID (not treated as new/removed)
- **SC-004**: Sync report clearly distinguishes automated actions (created/updated) from review-required actions (missing/disabled)
- **SC-005**: Connection test returns clear, actionable error messages (not stack traces)
- **SC-006**: Scheduled sync runs reliably — no missed runs due to transient LDAP errors (errors logged, next sync retries)

## Assumptions

- AD server is reachable from the Node.js host on port 389 (LDAP) or 636 (LDAPS)
- A dedicated bind account exists with read access to the user OU
- Standard AD schema — `sAMAccountName`, `displayName`, `mail`, `physicalDeliveryOfficeName`, `objectGUID`, `userAccountControl` are all present
- `physicalDeliveryOfficeName` is populated in AD (if empty, users get no location link — not an error)
- Spec 003 (master lists) is implemented before or alongside this spec — location import degrades gracefully if not
- Spec 002 (user management) is implemented — user CRUD must work, `active` column exists
- AD group membership is NOT used for filtering (all active users in base DN are imported)
- Password sync is out of scope — AD passwords are NOT imported. Imported users get a random temporary password or must be set by admin. Authentication remains local.
- `ldapjs` is chosen over `activedirectory` npm package because ldapjs is pure JS (no native addons), actively maintained, and handles paging/bind/search well
