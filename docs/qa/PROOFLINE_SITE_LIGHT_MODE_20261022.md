# PROOFLINE — WEB LIGHT (solo sitio público)

Base: WS3B + hotfix de scrollbars validado por el usuario. Cambios limitados a `apps/site/app`.

## Intervención
- Selector visual explícito `data-theme=light` y modo automático cuando sistema es claro.
- Hero claro con fondo diferenciado; texto comercial de contraste alto.
- Tarjetas, proceso e informes con fondo y borde claros y legibles.
- Trust oscuro dentro de tema claro: titulares, secundarios y CTA en colores claros explícitos, sin contaminación del tema de la página.
- No se modifican dark mode, DOM de las secciones, funcionalidades comerciales, rutas ni Consent Manager.

## Comprobación manual requerida
- A 1440/1024/390 px: hero, 3 problemas, ciclo 5 pasos, informes, Trust, soluciones, CTA, footer.
- Alternar Claro → Oscuro → Automático y recargar. Verificar que Oscuro es idéntico al baseline.
- Probar botones, anclas, navegación y focus por teclado.
- Confirmar legibilidad WCAG AA con herramientas del navegador sobre colores calculados.
- No se afirma certificación visual hasta realizar estas comprobaciones en aplicación real.
