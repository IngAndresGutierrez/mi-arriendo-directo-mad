---
name: firestore-security-rules
description: Writing and reviewing Firestore and Cloud Storage security rules for sensitive data (contracts, identity documents, income, payments). Use it when creating or modifying firestore.rules / storage.rules, when adding a new collection, or whenever you have to decide who may read a document.
---

# Firestore & Storage Security Rules

The project's real files are **`firestore.rules`** and **`storage.rules`** at the repo root.
This skill explains the *why* and the patterns; when you change rules, edit those files and keep
them consistent with what is already there.

This project stores **sensitive personal data**: national id documents, employment letters,
income, rental contracts and payments. The rules are the last line of defence: assume the client
is hostile and that any query the rules allow will be executed.

## Non-negotiable principles

1. **Deny by default.** No collection has access until a rule grants it explicitly. Never
   `allow read, write: if true;` and never `if request.auth != null;` as a blanket rule.
2. **No permissive recursive wildcard.** `match /{document=**}` with a broad `allow` overrides
   every specific rule below it.
3. **Split `read` into `get` and `list`.** A permissive `list` lets the client enumerate the
   whole collection even if each `get` looks safe. Identity data should almost never be listable.
4. **Validate shape and types on write**, not just authorization. Without validation the client
   can write `status: "approved"` or `rent: -1`.
5. **Immutable fields**: `status`, amounts, `createdAt`, `landlordUid` are not changed by the
   tenant. If only the backend may move a field, forbid it to the client and do it with the
   Admin SDK (which ignores the rules).
6. **Rules are not a filter.** They do not transform documents: if a doc contains a sensitive
   field and you grant `get`, the client sees all of it. Split the sensitive part into a
   subcollection or a separate document.

## The project's skeleton

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- helpers ----------
    function isSignedIn() {
      return request.auth != null;
    }
    function uid() {
      return request.auth.uid;
    }
    function isOwner(userId) {
      return isSignedIn() && uid() == userId;
    }
    // role from custom claims (the Admin SDK sets them, the client cannot forge them)
    function hasRole(role) {
      return isSignedIn() && request.auth.token.role == role;
    }
    function isLandlord() { return hasRole('landlord'); }
    function isAdmin()    { return hasRole('admin'); }

    // incoming / existing data
    function incoming() { return request.resource.data; }
    function current()  { return resource.data; }

    // only these keys changed
    function onlyChanged(keys) {
      return incoming().diff(current()).affectedKeys().hasOnly(keys);
    }
    function unchanged(fields) {
      return !incoming().diff(current()).affectedKeys().hasAny(fields);
    }

    // ---------- users ----------
    match /users/{userId} {
      allow get: if isOwner(userId) || isAdmin();
      allow list: if isAdmin();                       // nobody enumerates users
      allow create: if isOwner(userId)
                    && incoming().keys().hasOnly(
                         ['fullName','email','phone','role','createdAt'])
                    && incoming().role in ['tenant','landlord'];
      allow update: if isOwner(userId)
                    && onlyChanged(['fullName','phone','updatedAt']);  // role NOT included
      allow delete: if isAdmin();

      // identity documents: isolated in a subcollection, never listable to others
      match /documents/{docId} {
        allow get: if isOwner(userId) || isAdmin();
        allow list: if isOwner(userId) || isAdmin();
        allow create: if isOwner(userId) && validDocument();
        allow update, delete: if isAdmin();           // append-only for the user
      }
      function validDocument() {
        return incoming().keys().hasOnly(['type','storagePath','uploadedAt'])
            && incoming().type in ['id_front','id_back','employment_letter','bank_statement']
            && incoming().storagePath is string
            && incoming().storagePath.matches('^applicants/' + userId + '/.*');
      }
    }

    // ---------- properties ----------
    match /properties/{propertyId} {
      // public catalog: only if the doc is published and carries no owner data
      allow get, list: if current().status == 'available' || isPropertyOwner() || isAdmin();

      allow create: if isLandlord()
                    && incoming().landlordUid == uid()
                    && validProperty();
      allow update: if (isPropertyOwner() && validProperty() && unchanged(['landlordUid']))
                    || isAdmin();
      allow delete: if isPropertyOwner() || isAdmin();

      function isPropertyOwner() {
        return isSignedIn() && current().landlordUid == uid();
      }
      function validProperty() {
        return incoming().rent is int && incoming().rent > 0
            && incoming().address.city is string && incoming().address.city.size() <= 80
            && incoming().status in ['draft','available','rented','inactive'];
      }
    }

    // ---------- applications ----------
    // Visible ONLY to the tenant who created it and to the property's landlord.
    match /applications/{applicationId} {
      allow get: if isApplicationTenant() || isApplicationLandlord() || isAdmin();
      allow list: if isSignedIn()
                  && (request.query.limit <= 50)
                  && (resource == null || isApplicationTenant() || isApplicationLandlord());

      allow create: if isSignedIn()
                    && incoming().tenantUid == uid()
                    && incoming().status == 'pending'            // no self-approval
                    && exists(/databases/$(database)/documents/properties/$(incoming().propertyId));

      // the tenant only withdraws; approving/rejecting belongs to the landlord
      allow update: if (isApplicationTenant() && onlyChanged(['status','updatedAt'])
                        && incoming().status == 'withdrawn')
                    || (isApplicationLandlord() && onlyChanged(['status','notes','updatedAt'])
                        && incoming().status in ['approved','rejected'])
                    || isAdmin();
      allow delete: if isAdmin();

      function isApplicationTenant() {
        return isSignedIn() && current().tenantUid == uid();
      }
      function isApplicationLandlord() {
        return isSignedIn() && get(/databases/$(database)/documents/properties/$(current().propertyId))
                 .data.landlordUid == uid();
      }
    }

    // ---------- contracts and payments: read-only for the parties ----------
    match /contracts/{contractId} {
      allow get: if isContractParty() || isAdmin();
      allow list: if false;                            // queried from the server
      allow create, update, delete: if false;          // Admin SDK only
      function isContractParty() {
        return isSignedIn()
            && (current().tenantUid == uid() || current().landlordUid == uid());
      }

      match /payments/{paymentId} {
        // ⚠️ `&&` binds tighter than `||`: ALWAYS parenthesize a mixed condition, or you end
        // up granting access to someone you did not mean to.
        allow get, list: if isAdmin()
                         || (isSignedIn() && isParentContractParty());
        allow write: if false;                         // payments are written by the backend

        function isParentContractParty() {
          let contract = get(/databases/$(database)/documents/contracts/$(contractId)).data;
          return contract.tenantUid == uid() || contract.landlordUid == uid();
        }
      }
    }
  }
}
```

## Things that break in production

- **`get()` costs a read and there is a cap of 10 per request** (20 in a `list`). If you need
  more, **denormalize**: copy `landlordUid` into the application instead of reading the property
  in every rule.
- **`list` and `resource`**: in a query, `resource` is each candidate doc; you cannot use
  `resource` to restrict *what* the client asks for. Force the filter with `request.query.limit`
  and by validating the expected `where`s, or simply close `list` and run the query from the
  server with the Admin SDK.
- **A `list` rule must be verifiable from the query, not from the result.** Verified against the
  emulator: with `allow list: if resource.data.status == 'available'`, a
  `getDocs(collection(db, "properties"))` with no filter is denied **even when the collection is
  empty**. The client must include the `where` that satisfies the rule:
  `query(collection(db, "properties"), where("status", "==", "available"))`. If your catalog
  returns `permission-denied` with rules that "look right", this is almost always why.
- **Custom claims go stale**: the client's token keeps the old claim for up to ~1h, or until
  `getIdToken(true)`. After changing a role, force a refresh.
- **Rules ≠ business validation.** Any invariant spanning documents (e.g. "a rented property
  accepts no applications") belongs in a Server Action / the Admin SDK.
- **The Admin SDK ignores the rules entirely.** Not an excuse for lax rules, but it is the tool
  for everything the client must not be able to do.
- **`&&` has higher precedence than `||`.** `A && B || C` is `(A && B) || C`. In a security rule
  that difference is a leak: always parenthesize.
- **In `create` there is no `resource`.** Any helper using `resource.data` fails on creation:
  keep the `create` and `update` helpers separate.

## Mandatory verification

Every new or modified rule is tested against the emulator before deploying:

```bash
# the Firestore emulator needs JDK 21 or newer
firebase emulators:exec --only firestore --project demo-mad "pnpm vitest run tests/rules"
firebase deploy --only firestore:rules,storage
```

Tests with `@firebase/rules-unit-testing`, always covering the negative case:

```ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

const env = await initializeTestEnvironment({ projectId: "demo-mad" });
const outsider = env.authenticatedContext("uid-third-party").firestore();

// a third party NEVER reads someone else's application
await assertFails(getDoc(doc(outsider, "applications/a1")));
// the tenant does not approve their own application
await assertFails(updateDoc(doc(tenant, "applications/a1"), { status: "approved" }));
```

## Storage Rules (identity documents)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /applicants/{userId}/{allPaths=**} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 8 * 1024 * 1024
                   && request.resource.contentType.matches('image/(jpeg|png|webp)|application/pdf');
    }
    match /properties/{propertyId}/{allPaths=**} {
      allow read: if true;                                  // listing photos
      allow write: if request.auth != null
                   && request.resource.size < 8 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    match /{allPaths=**} { allow read, write: if false; }    // explicit closure
  }
}
```
