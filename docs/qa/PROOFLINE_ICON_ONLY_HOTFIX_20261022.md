# PROOFLINE — Icon-only hotfix · 22/10/2026

## Diagnóstico
El vídeo muestra etiquetas visibles `EN`, `Claro`, `Oscuro` y `Sistema` junto a los iconos en Site, Control, Workspace y Support. El parche de iconos anterior ya generaba SVG sin texto en `packages/ui/src/client.tsx`, por lo que la interfaz reproducía código anterior o no había incorporado el componente actualizado. Además, el acceso a Support mantenía un selector de idioma específico con texto.

## Solución acotada
- `packages/ui/src/client.tsx`: botones y enlaces solo SVG; atributos accesibles, tooltips, datos de estado y persistencia intactos.
- `packages/design-tokens/base.css`: CSS aislado en `.proofline-utility-button` para que una representación anterior con texto visible no lo muestre, conservando los iconos y los focos. No se modifican scrollbars ni botones ordinarios.
- `apps/support/components/support-login-preferences.tsx`: el selector de idioma del login usa el icono Languages y mantiene el cambio de locale y la cookie.

## Aplicación y verificación
1. Extraer el ZIP incremental en la raíz del monorepo, conservando carpetas.
2. **Detener** la tarea VS Code `Proofline: 2 · ARRANCAR TODO` y volver a iniciarla. Es importante detener los procesos Next actuales, no solo refrescar la página.
3. Comprobar en 4200, 4202, 4203, 4204, 4205 (incluyendo login de soporte) que la navegación muestra solo dos iconos, sin `EN`, `ES`, `Claro`, `Oscuro` o `Sistema` visibles. Comprobar cambio de idioma y ciclo tema Sistema→Claro→Oscuro→Sistema, persistencia tras recarga, tooltips y foco con teclado.
4. `node --test tests/proofline-icons-hotfix-20261022.test.mjs`, `pnpm typecheck`, `pnpm build`.
5. Si aún se muestra texto, confirmar que `packages/ui/src/client.tsx` contiene `data-proofline-utility` y que `packages/design-tokens/base.css` contiene `PROOFLINE UI-ICONS-FIX`. Reiniciar procesos con una ventana privada para descartar caché del navegador. No borrar bases de datos, dependencias ni configuraciones.

## Limitaciones
Pruebas de código y de CSS ejecutadas fuera de Windows. La compilación completa y navegación real sobre los servicios locales del usuario requieren comprobación allí.
