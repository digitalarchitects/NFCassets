# Implementation Plan: LDAP/Active Directory Import

**Branch**: `004-ldap-import` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-ldap-import/spec.md`

## Summary

Add LDAP/Active Directory user import to the NFC Asset Tracker. New `ldapjs` dependency provides LDAP client. Daily sync pulls active users from AD, creates/updates local accounts linked by immutable `objectGUID`. Office location (`physicalDeliveryOfficeName`) feeds the locations master list (003). Delta detection flags disabled and missing users for admin review. New tables: `sync_log` and `sync_issues` for audit trail and issue tracking.

## Technical Context

**Language/Version**: JavaScript (Node.js 22+)  
**New Dependency**: `ldapjs` (MIT, pure JS — no native addons)  
**Storage**: SQLite — 3 new columns on users, 2 new tables  
**Testing**: Manual verification against real AD  
**Target Platform**: Same as existing — Node.js server with LDAP network access (port 389 or 636)  
**Performance Goals**: 500-user import in < 30 seconds. Paged results for 1,000+ directories.

## Constitution Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Lightweight | ✅ PASS | `ldapjs` is MIT-licensed pure JS — one npm install. No native addons. |
| II. Offline-First | ⚠️ N/A | LDAP import is an online-only admin function. Does not affect scan/verify offline flow. |
| III. GUID Identity | ✅ PASS | AD `objectGUID` used as immutable link — survives renames, OU moves. |
| IV. Audit Trail | ✅ PASS | `sync_log` and `sync_issues` tables provide full audit trail of every import. |
| V. Security | ✅ PASS | LDAP bind password in `.env`, never logged. Connection test does not expose credentials in error messages. |
| VI. Simplicity | ✅ PASS | One new dependency. Flat tables. No message queue — cron runs in-process. |
| VII. Container-First | ✅ PASS | Same app container. LDAP port 389 must be reachable from host network. |

## Project Structure

### Files to Create

```text
lib/ldap.js                # LDAP client: connect, search, import logic
routes/admin.js            # Admin routes: LDAP config test, manual import trigger
public/admin/ldap.html     # LDAP configuration and import UI
public/js/ldap.js          # LDAP admin page logic
public/admin/sync-review.html  # Sync issue review page
public/js/sync-review.js       # Sync review page logic
```

### Files to Modify

```text
db/schema.sql              # Add ad_guid, display_name, email to users. Add sync_log, sync_issues tables.
.env.example               # Add LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASSWORD
app.js                     # Mount admin routes. Add cron-like scheduler for daily sync.
package.json               # Add ldapjs dependency, add "npm run ldap-import" script
public/js/common.js        # Add admin nav links (LDAP Import, Sync Review)
```

## Routes

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/admin/ldap/test` | Session | admin | Test LDAP connection — returns user count or error |
| POST | `/api/admin/ldap/import` | Session | admin | Trigger manual LDAP import |
| GET | `/api/admin/ldap/config` | Session | admin | Get current LDAP config (no password) |
| GET | `/api/admin/sync/log` | Session | admin | List sync logs (last 20) |
| GET | `/api/admin/sync/log/:id` | Session | admin | Get specific sync log with issues |
| GET | `/api/admin/sync/issues` | Session | admin | List unresolved issues from latest sync |
| PUT | `/api/admin/sync/issues/:id` | Session | admin | Resolve issue (deactivate user, ignore, re-enable) |

## AD Attribute Mapping

| AD Attribute | LDAP Name | Local Field | Notes |
|-------------|-----------|-------------|-------|
| SAM Account Name | `sAMAccountName` | `users.username` | Required. Login name. |
| Display Name | `displayName` | `users.display_name` | Full name. |
| Email | `mail` | `users.email` | |
| Office Location | `physicalDeliveryOfficeName` | `locations.name` (via FK) | Creates location if new |
| Object GUID | `objectGUID` | `users.ad_guid` | Base64-encoded. Immutable link. |
| User Account Control | `userAccountControl` | (used for filtering) | Bit 2 = disabled |

**LDAP Search Filter**: `(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`
This matches all enabled user objects in the base DN.

## Import Logic (Pseudocode)

```javascript
async function importFromLDAP() {
    const client = await ldapConnect(config);
    const adUsers = await search(client, baseDN, {
        filter: '(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))',
        scope: 'sub',
        attributes: ['sAMAccountName', 'displayName', 'mail',
                     'physicalDeliveryOfficeName', 'objectGUID', 'userAccountControl'],
        paged: true
    });

    const log = createSyncLog();
    let created = 0, updated = 0;

    for (const adUser of adUsers) {
        const guid = base64Encode(adUser.objectGUID);
        const localUser = findLocalByGuid(guid);

        if (localUser) {
            // Update if changed
            if (localUser.display_name !== adUser.displayName ||
                localUser.email !== adUser.mail) {
                updateUser(localUser.id, { display_name, email });
                updated++;
            }
        } else if (findLocalByUsername(adUser.sAMAccountName)) {
            // Username conflict — flag, skip
            createIssue(log.id, adUser.sAMAccountName, 'conflict', {...});
        } else {
            // Create new user
            const locationId = resolveLocation(adUser.physicalDeliveryOfficeName);
            createUser({
                username: adUser.sAMAccountName,
                display_name: adUser.displayName,
                email: adUser.mail,
                ad_guid: guid,
                location_id: locationId,
                password: generateTempPassword(),
                role: 'user'
            });
            created++;
        }
    }

    // Detect missing (local users with ad_guid not in AD set)
    const adGuids = new Set(adUsers.map(u => base64Encode(u.objectGUID)));
    const localLinkedUsers = findAllLocalWithAdGuid();
    for (const local of localLinkedUsers) {
        if (!adGuids.has(local.ad_guid)) {
            createIssue(log.id, local.username, 'missing_from_ad', {...});
        }
    }

    // Also check AD for disabled users (separate search without the enabled filter)
    const disabledUsers = await searchDisabledUsers(client, baseDN);
    for (const du of disabledUsers) {
        const local = findLocalByGuid(base64Encode(du.objectGUID));
        if (local && local.active === 1) {
            createIssue(log.id, local.username, 'ad_disabled', {...});
        }
    }

    log.finished = now();
    log.users_created = created;
    log.users_updated = updated;
    updateSyncLog(log);
}
```

## Daily Sync Scheduler

The daily sync runs inside the Express process using `setInterval` with a configurable time (default: 03:00). On startup, the app calculates milliseconds until the next scheduled run and sets a timeout.

```javascript
// In app.js, after server starts:
if (process.env.LDAP_URL) {
    const cronHour = parseInt(process.env.LDAP_SYNC_HOUR || '3');
    scheduleDailySync(cronHour, importFromLDAP);
}
```

Environment variable: `LDAP_SYNC_HOUR=3` (0-23, hour of day to run sync).

## Complexity Tracking

| Item | Why | Rejected Alternative |
|------|-----|---------------------|
| `ldapjs` over `activedirectory` npm | Pure JS, no native addons, actively maintained. `activedirectory` wraps ldapjs but adds complexity we don't need. | `activedirectory` — rejected for simplicity. |
| In-process scheduler over cron | Keeps deployment simple — no separate cron container or systemd timer. Already have Node.js running. | System cron or separate worker — rejected for simplicity. Single process, no extra infrastructure. |
| Admin review for missing users | Auto-disabling is dangerous. A user might be temporarily moved to a different OU or the search scope might change. Human review prevents accidental lockouts. | Auto-disable — rejected for safety. |
| `objectGUID` as base64 string | SQLite has no binary type. Base64 is human-readable in the DB and works as a string index. | Binary blob — less practical in SQLite. |
| Password NOT synced from AD | AD passwords are hashed and can't be extracted. Syncing them would require a password filter DLL on the DC — unacceptable complexity for this PoC. | Password sync — rejected as technically infeasible without DC-side changes. |
