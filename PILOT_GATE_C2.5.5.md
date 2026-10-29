# PROOFLINE — C2.5.5 Pilot E2E Gate

## Objetivo

Certificar en local el circuito principal sin datos de clientes ni servicios de pago externos:

`crear → configurar → validar → congelar → lanzar → invitar → responder → cerrar → calcular → reportar → aprobar → distribuir → auditar → ledger`

## Ejecución

1. Arrancar Docker Desktop y PROOFLINE con la tarea **Proofline: 2 · ARRANCAR TODO**.
2. Confirmar servicios con **Proofline: 3 · COMPROBAR SERVICIOS**.
3. Ejecutar **Proofline: 6 · PILOT E2E** o:

```bash
pnpm pilot:check
```

El check usa exclusivamente la organización demo local, crea un assessment temporal con nombre `Pilot E2E <timestamp>`, usa seis personas ya existentes del directorio demo, procesa invitaciones por el Outbox/Worker/Mailpit reales y elimina del repositorio de datos los artefactos de negocio temporales al finalizar. Cada ejecución genera 7 correos de prueba (6 invitaciones + 1 entrega de reporte). Para evitar ruido acumulado, el gate limpia mensajes `Pilot E2E` anteriores al comenzar y elimina los generados al terminar correctamente. Define `PILOT_KEEP_EMAILS=1` sólo cuando necesites conservarlos para depuración.

## Gate esperado

La salida final debe incluir:

```text
[OK] PROOFLINE C2.5.5 Pilot E2E · 20/20 gates
```

El gate comprueba:

1. Creación real del assessment.
2. Nivel, scoring, privacidad, cohorte e idioma configurables.
3. Cuestionario puntuable y evidencia cualitativa.
4. Población real seleccionada desde directorio.
5. Perfil legal aprobado y aviso en el idioma del assessment.
6. Identidad visual configurada y preview aprobado.
7. Proofline Check >= 80.
8. Versión congelada e inmutable.
9. Lanzamiento real con population snapshot.
10. Invitaciones individuales por Outbox → Worker → Mailpit.
11. Autosave y resume.
12. Submit final e idempotencia.
13. Durante LIVE no existen resultados finales.
14. CLOSED rechaza nuevas respuestas.
15. Cierre encola y completa análisis mediante worker + analytics.
16. `sourceHash`, `calculationHash`, targets/gaps y sample metadata.
17. Supresión de cohortes por debajo del umbral.
18. L1/L2/L3/L4 con un único snapshot canónico + PDF/JSON/CSV.
19. Aprobación y distribución sólo a destinatarios autorizados.
20. Auditoría y ledger coherentes, con payload de email sensible scrubbed pero correlacionable.

## Condiciones

- No usa Redsys ni PayPal.
- No requiere producción.
- No realiza cobros.
- No borra volúmenes Docker.
- No utiliza datos personales reales.
- Si el worker, analytics o Mailpit no están disponibles, el gate falla de forma explícita.
