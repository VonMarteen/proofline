# PROOFLINE — Public Commercial Site & Experience Spec v0.3

## 1. Objetivo

La web pública de Proofline no es una landing provisional. Es una superficie estructural de venta, confianza, educación y acceso al ecosistema.

Debe conseguir que un director, responsable de People/Organization, consultor o buyer entienda en pocos minutos:

- qué problema resuelve Proofline;
- cómo funciona;
- qué modalidades existen;
- por qué es más simple;
- cómo protege datos;
- qué recibe al final;
- cómo empezar.

## 2. Posicionamiento visual

Atributos:

- premium B2B;
- sobrio sin ser frío;
- mucho espacio y jerarquía;
- gráficos y ejemplos reales/sintéticos de producto;
- animación contenida;
- señal/evidencia/estructura como lenguaje visual;
- evitar stock photography genérica de “empleados felices”.

La web debe poder convivir visualmente con:

> PROOFLINE  
> Signal & Structure  
> by ARMAR TECHNOLOGIES

## 3. Arquitectura de información

### Home

- proposition;
- cómo funciona;
- import/review/collect/analyze/report;
- Proofline Assessment Check;
- Answer → Insight → Evidence;
- privacidad y transparencia;
- Direct vs Professional;
- Library/Marketplace;
- sample output;
- CTA demo / talk to sales / explore sample.

### Product

- Objective;
- Assessment Check;
- Library/Marketplace;
- Population & privacy;
- Collection;
- Analysis;
- Reporting;
- Distribution;
- longitudinal history.

### Solutions — Companies

- HR/People;
- transformation;
- leadership;
- culture;
- organizational diagnostics;
- multi-country organizations.

### Solutions — Consultants / Partners

- multi-client;
- private frameworks;
- partner library;
- branded reports;
- efficiency/margin;
- licensing/Marketplace.

### Assessment Library / Marketplace

Public catalog preview:

- categories;
- author;
- objective;
- dimensions;
- duration;
- methodology status;
- sample output;
- availability/licensing.

No exponer preguntas protegidas/licenciadas si no corresponde.

### Trust Center

- privacy architecture;
- data minimization;
- EU hosting;
- encryption;
- Identity Vault;
- Restricted access;
- security practices;
- subprocessors;
- compliance posture;
- AI transparency;
- contact security/privacy.

### AI Transparency

Explicar de forma no marketiniana:

- dónde se usa IA;
- dónde no;
- qué cálculos son deterministas;
- qué datos se minimizan;
- human review;
- no training claim sólo cuando contractualmente sea exacto;
- provider/subprocessor status.

### Pricing / Commercial modes

Mientras pricing no esté cerrado, mostrar modalidades y `Contact sales` / `Request proposal` sin precios ficticios.

### Demo / Sample report

- assessment sample;
- synthetic result preview;
- sample Executive Brief;
- interactive but safe;
- no real customer data.

### Resources

- guides;
- methodology articles;
- organizational intelligence;
- privacy explainers;
- assessment design;
- case studies futuro.

### About

- Proofline;
- ARMAR TECHNOLOGIES;
- product philosophy;
- contact.

### Legal Center

Permanent footer + dedicated hub.

## 4. Conversion flows

### Request demo

Campos mínimos:

- work email;
- name;
- organization;
- role optional;
- message/use case optional;
- country optional only if needed for routing.

Mostrar privacy notice. Marketing newsletter debe tener consentimiento separado y opcional.

### Create account / Start trial

Si el GTM futuro lo permite:

1. work email;
2. organization;
3. verify email;
4. Terms acceptance;
5. Privacy acknowledgement;
6. organization setup.

No forzar marketing consent.

## 5. Multiidioma

URL locale-aware y SEO correctos:

- `/es/...`
- `/en/...`

`hreflang`, canonical y structured metadata.

Contenido traducido editorialmente; no depender de traducción automática en runtime para páginas contractuales o de venta principales.

## 6. Theme

Selector visible:

- light;
- dark;
- system.

Debe respetar `prefers-color-scheme` antes de hidratar para evitar flash.

La preferencia de theme no se reutiliza para perfilado.

## 7. Consent / Cookie UX

No mostrar banner si sólo existen tecnologías exentas y la revisión jurídica confirma que no hace falta.

Si se usan analytics/marketing no esenciales:

- Accept all;
- Reject all;
- Configure;
- mismas jerarquías visuales para aceptar/rechazar;
- recordar elección;
- cambiar preferencias desde footer;
- scripts bloqueados hasta consentimiento cuando corresponda.

## 8. Performance and SEO

Objetivos:

- Core Web Vitals en rango Good;
- server-rendered/static where possible;
- imágenes AVIF/WebP;
- fonts self-hosted/licensed where possible;
- minimal client JS;
- semantic HTML;
- JSON-LD para Organization/Product/SoftwareApplication cuando corresponda;
- sitemap;
- robots;
- OpenGraph;
- no contenido crítico oculto tras animaciones.

## 9. Accessibility

WCAG 2.2 AA target:

- keyboard;
- focus visible;
- contrast;
- reduced motion;
- headings;
- landmarks;
- forms/errors;
- alt text;
- charts with textual equivalents where material.

## 10. Tech boundary

`apps/site` es deployment separado de `apps/web`, aunque compartan design tokens y componentes de presentación.

Razones: menor blast radius, SEO/performance independientes, ausencia de auth/business code, políticas CSP diferenciadas, campañas/deploys sin afectar la app y analytics de marketing aislado del producto.
