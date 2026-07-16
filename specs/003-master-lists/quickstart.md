# Quickstart: Admin Master Lists

## Prerequisites

- 001-initial-mvp running
- 002-user-role-management implemented (for admin role guard)
- At least one admin account

## Validation After Implementation

### 1. Schema Migration

```bash
npm start
# Check logs for migration messages
# Should see: "Locations seeded: N from existing assets"
# No errors about duplicate columns
```

### 2. Manage Locations

```bash
# List (empty initially, unless migration seeded from existing data)
curl -b cookies.txt http://localhost:3000/api/lists/locations

# Create
curl -b cookies.txt -X POST http://localhost:3000/api/lists/locations \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"name":"Head Office"}'
# → 201 {"location":{"id":1,"name":"Head Office","active":1}}

curl -b cookies.txt -X POST http://localhost:3000/api/lists/locations \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"name":"Satellite Depot"}'

# Duplicate
curl -b cookies.txt -X POST http://localhost:3000/api/lists/locations \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"name":"Head Office"}'
# → 409 "Location already exists"

# Rename
curl -b cookies.txt -X PUT http://localhost:3000/api/lists/locations/1 \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"name":"Main Office"}'
# → 200

# Deactivate
curl -b cookies.txt -X PUT http://localhost:3000/api/lists/locations/2 \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"active":0}'
# → 200
```

### 3. Manage Makes & Models

```bash
# Create makes
curl -b cookies.txt -X POST http://localhost:3000/api/lists/makes \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"name":"Dell"}'

curl -b cookies.txt -X POST http://localhost:3000/api/lists/makes \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"name":"HP"}'

# Create models (Dell = id 1, HP = id 2)
curl -b cookies.txt -X POST http://localhost:3000/api/lists/models \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"makeId":1,"name":"Latitude 5550"}'

curl -b cookies.txt -X POST http://localhost:3000/api/lists/models \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"makeId":1,"name":"Precision 5680"}'

curl -b cookies.txt -X POST http://localhost:3000/api/lists/models \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"makeId":2,"name":"EliteBook 840"}'

# Duplicate model within same make
curl -b cookies.txt -X POST http://localhost:3000/api/lists/models \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"makeId":1,"name":"Latitude 5550"}'
# → 409 "Model already exists for this make"

# List models filtered by make
curl -b cookies.txt "http://localhost:3000/api/lists/models?makeId=1"
# → {"models":[{"id":1,"name":"Latitude 5550",...},{"id":2,"name":"Precision 5680",...}]}
```

### 4. Manage Categories

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/lists/categories \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"name":"Laptop"}'

curl -b cookies.txt -X POST http://localhost:3000/api/lists/categories \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"name":"Monitor"}'
```

### 5. Convenience Endpoint

```bash
curl -b cookies.txt http://localhost:3000/api/lists/all
# → {"locations":[...], "makes":[{id,name,models:[...]}], "categories":[...]}
```

### 6. Create Asset with FKs

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" -H "CSRF-Token: <token>" \
  -d '{"assetNo":"LAPTOP-001","serialNo":"DLT-123","makeId":1,"modelId":1,"locationId":1,"categoryId":1}'
# → 201 {"asset":{"id":...,"assetNo":"LAPTOP-001","makeName":"Dell","modelName":"Latitude 5550","locationName":"Main Office","categoryName":"Laptop",...}}
```

### 7. Search by FK

```bash
curl -b cookies.txt "http://localhost:3000/api/assets?locationId=1&categoryId=1"
# → only laptops at Main Office
```

### 8. UI Validation

1. Login as admin → nav shows "Lists" link → click → see tabs: Locations, Makes & Models, Categories
2. Add a location → appears in the table
3. Rename a location → name changes in both the list table and any asset using it
4. Deactivate a location → greyed out in table, disappears from asset form dropdown
5. Switch to Makes & Models tab → add Dell → add Latitude 5550 under Dell
6. Go to Assets → Add Asset → location dropdown shows active locations only
7. Select Dell from make → model dropdown shows only Dell models
8. Select model → submit → asset created with "Dell Latitude 5550"
9. Search page → use location filter dropdown → only matching assets shown
