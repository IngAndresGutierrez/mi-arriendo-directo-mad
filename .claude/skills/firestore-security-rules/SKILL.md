---
name: firestore-security-rules
description: Escribir y revisar reglas de seguridad de Firestore y Cloud Storage para datos sensibles (contratos, cédulas, ingresos, pagos). Úsala al crear o modificar firestore.rules / storage.rules, al añadir una colección nueva, o cuando haya que decidir quién puede leer un documento.
---

# Firestore & Storage Security Rules

Los archivos reales del proyecto son **`firestore.rules`** y **`storage.rules`** en la raíz.
Esta skill explica el *por qué* y los patrones; al modificar reglas, edita esos archivos y
mantén la coherencia con lo que ya está ahí.

Este proyecto guarda **datos personales sensibles**: cédulas, certificados laborales,
ingresos, contratos de arrendamiento y pagos. Las rules son la última línea de defensa:
asume que el cliente es hostil y que cualquier query que las rules permitan será ejecutada.

## Principios no negociables

1. **Deny by default.** Ninguna colección tiene acceso hasta que una regla lo conceda
   explícitamente. Nunca `allow read, write: if true;` ni `if request.auth != null;` como
   regla global.
2. **Nada de wildcard recursivo permisivo.** `match /{document=**}` con `allow` amplio anula
   todas las reglas específicas de abajo.
3. **Separa `read` en `get` y `list`.** Un `list` permisivo deja enumerar toda la colección
   aunque cada `get` parezca seguro. Los datos de identidad casi nunca deben ser listables.
4. **Valida forma y tipos en escritura**, no solo autorización. Sin validación el cliente
   puede escribir `estado: "aprobada"` o `canon: -1`.
5. **Campos inmutables**: `estado`, `montos`, `createdAt`, `propietarioUid` no los cambia el
   inquilino. Si un campo solo lo puede mover el backend, prohíbelo al cliente y hazlo con
   Admin SDK (que ignora las rules).
6. **Las rules no son un filtro.** No transforman documentos: si un doc contiene un campo
   sensible y concedes `get`, el cliente lo ve completo. Separa lo sensible en subcolección
   o documento aparte.

## Esqueleto del proyecto

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
    // rol desde custom claims (los pone el Admin SDK, el cliente no los puede falsificar)
    function hasRole(role) {
      return isSignedIn() && request.auth.token.role == role;
    }
    function isPropietario() { return hasRole('propietario'); }
    function isAdmin()       { return hasRole('admin'); }

    // datos entrantes / existentes
    function incoming() { return request.resource.data; }
    function current()  { return resource.data; }

    // solo estas keys cambiaron
    function onlyChanged(keys) {
      return incoming().diff(current()).affectedKeys().hasOnly(keys);
    }
    function unchanged(campos) {
      return !incoming().diff(current()).affectedKeys().hasAny(campos);
    }

    // ---------- usuarios ----------
    match /usuarios/{userId} {
      allow get: if isOwner(userId) || isAdmin();
      allow list: if isAdmin();                       // nadie enumera usuarios
      allow create: if isOwner(userId)
                    && incoming().keys().hasOnly(
                         ['nombre','email','telefono','rol','createdAt'])
                    && incoming().rol in ['inquilino','propietario'];
      allow update: if isOwner(userId)
                    && onlyChanged(['nombre','telefono','updatedAt']);  // rol NO
      allow delete: if isAdmin();

      // documentos de identidad: aislados en subcolección, nunca listables
      match /documentos/{docId} {
        allow get: if isOwner(userId) || isAdmin();
        allow list: if isOwner(userId) || isAdmin();
        allow create: if isOwner(userId) && validDocumento();
        allow update, delete: if isAdmin();           // append-only para el usuario
      }
      function validDocumento() {
        return incoming().keys().hasOnly(['tipo','storagePath','subidoEn'])
            && incoming().tipo in ['cedula_frente','cedula_reverso','certificado_laboral',
                                   'extracto_bancario']
            && incoming().storagePath is string
            && incoming().storagePath.matches('^postulantes/' + userId + '/.*');
      }
    }

    // ---------- inmuebles ----------
    match /inmuebles/{inmuebleId} {
      // catálogo público: solo si el doc está publicado y no trae datos del dueño
      allow get, list: if current().estado == 'disponible' || isOwnerInmueble() || isAdmin();

      allow create: if isPropietario()
                    && incoming().propietarioUid == uid()
                    && validInmueble();
      allow update: if (isOwnerInmueble() && validInmueble() && unchanged(['propietarioUid']))
                    || isAdmin();
      allow delete: if isOwnerInmueble() || isAdmin();

      function isOwnerInmueble() {
        return isSignedIn() && current().propietarioUid == uid();
      }
      function validInmueble() {
        return incoming().canon is int && incoming().canon > 0
            && incoming().ciudad is string && incoming().ciudad.size() <= 80
            && incoming().estado in ['borrador','disponible','arrendado','inactivo'];
      }
    }

    // ---------- postulaciones ----------
    // Visible SOLO para el inquilino que la creó y el propietario del inmueble.
    match /postulaciones/{postulacionId} {
      allow get: if esInquilino() || esPropietarioDelInmueble() || isAdmin();
      allow list: if isSignedIn()
                  && (request.query.limit <= 50)
                  && (resource == null || esInquilino() || esPropietarioDelInmueble());

      allow create: if isSignedIn()
                    && incoming().inquilinoUid == uid()
                    && incoming().estado == 'pendiente'          // no se auto-aprueba
                    && exists(/databases/$(database)/documents/inmuebles/$(incoming().inmuebleId));

      // el inquilino solo retira; aprobar/rechazar lo hace el propietario
      allow update: if (esInquilino() && onlyChanged(['estado','updatedAt'])
                        && incoming().estado == 'retirada')
                    || (esPropietarioDelInmueble() && onlyChanged(['estado','notas','updatedAt'])
                        && incoming().estado in ['aprobada','rechazada'])
                    || isAdmin();
      allow delete: if isAdmin();

      function esInquilino() {
        return isSignedIn() && current().inquilinoUid == uid();
      }
      function esPropietarioDelInmueble() {
        return isSignedIn() && get(/databases/$(database)/documents/inmuebles/$(current().inmuebleId))
                 .data.propietarioUid == uid();
      }
    }

    // ---------- contratos y pagos: solo lectura para las partes ----------
    match /contratos/{contratoId} {
      allow get: if esParte() || isAdmin();
      allow list: if false;                            // se consultan por query en el servidor
      allow create, update, delete: if false;          // solo Admin SDK
      function esParte() {
        return isSignedIn()
            && (current().inquilinoUid == uid() || current().propietarioUid == uid());
      }

      match /pagos/{pagoId} {
        // ⚠️ `&&` liga más fuerte que `||`: SIEMPRE parentiza una condición mixta,
        // o terminas concediendo acceso a quien no debías.
        allow get, list: if isAdmin()
                         || (isSignedIn() && esParteDelContratoPadre());
        allow write: if false;                         // los pagos los escribe el backend

        function esParteDelContratoPadre() {
          let contrato = get(/databases/$(database)/documents/contratos/$(contratoId)).data;
          return contrato.inquilinoUid == uid() || contrato.propietarioUid == uid();
        }
      }
    }
  }
}
```

## Cosas que rompen en producción

- **`get()` cuesta una lectura y hay tope de 10 por request** (20 en `list`). Si necesitas
  más, **desnormaliza**: copia `propietarioUid` dentro de la postulación en lugar de leer el
  inmueble en cada regla.
- **`list` y `resource`**: en una query, `resource` es cada doc candidato; no puedes usar
  `resource` para restringir *qué* pide el cliente. Fuerza el filtro con
  `request.query.limit` y validando los `where` esperados, o simplemente cierra `list` y haz
  la consulta desde el servidor con Admin SDK.
- **Una regla de `list` debe ser verificable desde la query, no desde el resultado.**
  Verificado en el emulador: con `allow list: if resource.data.estado == 'disponible'`, un
  `getDocs(collection(db, "inmuebles"))` sin filtro se deniega **incluso si la colección está
  vacía**. El cliente debe incluir el `where` que hace cumplir la regla:
  `query(collection(db, "inmuebles"), where("estado", "==", "disponible"))`. Si tu catálogo
  devuelve `permission-denied` con reglas que "parecen correctas", casi siempre es esto.
- **Custom claims caducan**: el token del cliente conserva el claim viejo hasta ~1h o hasta
  `getIdToken(true)`. Tras cambiar un rol, fuerza refresh.
- **Rules ≠ validación de negocio.** Cualquier invariante que cruce documentos (p. ej. "un
  inmueble arrendado no acepta postulaciones") va en Server Action / Admin SDK.
- **Admin SDK ignora completamente las rules.** No lo uses como excusa para dejar rules
  laxas, pero sí para todo lo que el cliente no debe poder hacer.
- **`&&` tiene mayor precedencia que `||`.** `A && B || C` es `(A && B) || C`. En una regla
  de seguridad esa diferencia es una fuga: parentiza siempre.
- **En `create` no existe `resource`.** Cualquier helper que use `resource.data` falla en
  creación: separa los helpers de `create` y de `update`.

## Verificación obligatoria

Toda regla nueva o modificada se prueba con el emulador antes de desplegar:

```bash
# el emulador de Firestore requiere JDK 21 o superior
firebase emulators:exec --only firestore --project demo-mad "pnpm vitest run tests/rules"
firebase deploy --only firestore:rules,storage
```

Test con `@firebase/rules-unit-testing`, cubriendo siempre el caso negativo:

```ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

const env = await initializeTestEnvironment({ projectId: "demo-mad" });
const otro = env.authenticatedContext("uid-ajeno").firestore();

// un tercero NUNCA lee la postulación de otro
await assertFails(getDoc(doc(otro, "postulaciones/p1")));
// el inquilino no se aprueba a sí mismo
await assertFails(updateDoc(doc(inquilino, "postulaciones/p1"), { estado: "aprobada" }));
```

## Storage Rules (documentos de identidad)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /postulantes/{userId}/{allPaths=**} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 8 * 1024 * 1024
                   && request.resource.contentType.matches('image/(jpeg|png|webp)|application/pdf');
    }
    match /inmuebles/{inmuebleId}/{allPaths=**} {
      allow read: if true;                                  // fotos del listado
      allow write: if request.auth != null
                   && request.resource.size < 8 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    match /{allPaths=**} { allow read, write: if false; }    // cierre explícito
  }
}
```
