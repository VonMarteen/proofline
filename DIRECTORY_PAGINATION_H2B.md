# PROOFLINE H2B — Directorio cifrado y paginación final

## Objetivo
Cerrar el estándar ARMAR 25/50/100 en las listas que faltaban sin degradar la privacidad del directorio.

## Directorio
Los campos `displayNameEncrypted`, `emailEncrypted` y `jobTitleEncrypted` permanecen cifrados. La búsqueda no descifra todo el directorio en el navegador ni pagina en frontend.

`DirectoryPerson` incorpora:
- `searchTokens String[]`
- `searchIndexVersion Int`

Los tokens son HMAC/blind indexes de prefijos normalizados; no contienen texto plano. Los registros existentes se reindexan automáticamente la primera vez que se realiza una búsqueda tras el upgrade. Los nuevos registros e importaciones nacen indexados.

La búsqueda soporta nombre, email, puesto e ID; el área se resuelve por la relación `OrganizationUnit`.

## Paginación
- 25 por defecto
- 25 / 50 / 100
- máximo 100 por petición
- `count + skip + take`
- orden estable
- filtros reinician página 1

Se aplica a:
- Workspace · Personas y organización
- selector de personas de Población
- Workspace · Facturas
- Workspace · Usage ledger
- Control · Suscripciones
- Control · Métodos de pago
- Control · Facturas
- Control · Movimientos de pago

## Upgrade de base local
Este avance añade dos columnas a `DirectoryPerson`. Tras aplicar el ZIP:

```bash
pnpm db:generate
pnpm db:push
```

`db:push` es aditivo para este cambio; no requiere reset ni borrado de datos.
