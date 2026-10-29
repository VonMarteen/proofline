# PROOFLINE Control — P3/7 · Dashboard y Negocio

**Base:** `PROOFLINE_AUDIT_20261017-0239.zip` + `PROOFLINE_CONTROL_P2_ENTERPRISE_TABLES_20261017.zip`.
**Entrega:** ZIP incremental (solo archivos cambiados/nuevos). No borrar ni sustituir carpetas enteras.
**Estado:** implementado en código; certificación de aplicación y ejecución integral pendiente en Windows del propietario.

## Cambios reales

1. `Dashboard` y `Negocio`: gráficos SVG con ejes, escala cero, intervalo continuo, valores accesibles y tabla de datos desplegable. Métricas seleccionables (facturas pagadas, emitidas, altas de organizaciones y tickets, estos últimos según permisos).
2. Rangos predefinidos 7/30/90/365 días y consulta por fechas en ambas páginas. Intervalo personalizado validado por API: formato, orden, fechas futuras, duración máxima 366 días; entradas inválidas vuelven al período predefinido.
3. **Corrección contable**: factura pagada se agrupa por `paidAt`; emitida por `issuedAt`. Ambas cifras son **brutas, impuestos incluidos**; la factura marcada `PAID` **no certifica conciliación bancaria**. El cambio corrige la atribución de cobro anteriormente basada en `issuedAt`.
4. EUR únicamente en cifras financieras; las facturas y los planes activos de otras divisas no se suman y aparecen como exclusiones en la metodología. ARPU sobre organizaciones que tienen planes EUR activos. MRR = precios mensuales del catálogo en suscripciones activas EUR; ARR = MRR × 12, **no** cobro anual realizado.
5. La tasa denominada anteriormente «churn estructural» aparece como **proporción actual cancelada**: una medición de estado, no churn temporal real.
6. Forecast solo cuando hay MRR EUR activo y comparación previa de facturas pagadas con base no nula. Mostrar ausencia de datos de forma explícita; toda estimación indica `LOW` y supuestos.
7. Protección `billing.read` reforzada en backend (importes, histórico financiero, forecast y metodología no se exponen al rol sin permiso) y frontend de Negocio.
8. Escalas y barras para **recuentos de suscripciones por plan**, sin usar el MRR como tamaño de barra; KPIs y alertas continúan enlazados a pantallas operativas.
9. Mantiene tema claro/oscuro y estética de Proofline; sin imágenes de relleno, nuevas dependencias, cambios de Prisma ni servicios externos.

## Cómo aplicar

Extraer el ZIP sobre `C:\Users\aruma\Desktop\PROOFLINE` preservando rutas, sobreescribiendo exclusivamente los archivos incluidos. **Instalar previamente P2**, porque P3 se preparó sobre esa base. No ejecutar `db:push` ni `db:generate` para este parche: no hay cambios de esquema.

## Pruebas obligatorias (VS Code, raíz)

```powershell
pnpm control:p3:check
pnpm control:p2:check
pnpm typecheck
pnpm build
pnpm runtime:check
pnpm pilot:check
```

Opcional, al tener la plataforma en ejecución: verificar `http://localhost:4204/es`, `http://localhost:4204/es/business`, y sus vistas `en`. Comprobar rangos 7d/30d/90d/365d y personalizados; pestañas de gráficos; días vacíos; fecha de pago distinta de emisión; plantilla sin datos; papel sin `billing.read`; tema claro/oscuro; tamaños desktop/tablet/móvil y navegación a Suscripciones/Facturas.

## Evidencia local del entorno de preparación

- `node --test tests/control-p3-dashboard.test.mjs`: **7/7**.
- TypeScript 5.8.3 standalone: `backoffice-metrics.ts` **sin errores de tipos**.
- Transpilación sintáctica de 5 archivos TS/TSX modificados: **sin errores sintácticos**.
- ZIP íntegro: validación CRC y SHA256 al generar.
- No se ha ejecutado `pnpm typecheck`, `pnpm build`, `pnpm runtime:check` ni `pnpm pilot:check` sobre el monorepo completo en este entorno: el audit ZIP excluye `node_modules`, Prisma Client generado y servicios Docker. **No declarar P3 completada hasta recibir esos logs**.

## Limitaciones y deuda reconocida

- La fuente de `PAID` sigue siendo el estado de la factura: no hay verificación bancaria. Sin `paidAt` no se atribuye cobro al período; se reporta el número de exclusiones observadas en la consulta.
- Forecast heurístico, no predicción validada ni promesa de ingresos. Requiere conciliación con operaciones/pagos para métricas de caja.
- El servicio de dashboard lee colecciones completas de organizaciones/suscripciones. Volúmenes altos exigen agregaciones SQL/Prisma con pruebas de rendimiento; **no se declara optimización de escalabilidad en esta fase**.
- Las cifras `churnPct` son la proporción de suscripciones actualmente canceladas frente a activas+canceladas; no retención por cohorte o churn mensual.
- Los gráficos muestran evidencia basada en las tablas existentes. Su accesibilidad definitiva (lector de pantalla, contraste, navegación por teclado) y calidad visual requieren verificación manual real.
