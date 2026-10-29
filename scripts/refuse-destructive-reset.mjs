console.error("[BLOQUEADO] infra:reset con borrado de volúmenes está deshabilitado por la política Armar de preservación de datos.");
console.error("Usa `pnpm infra:down` para detener la infraestructura sin borrar PostgreSQL/MinIO.");
process.exit(1);
