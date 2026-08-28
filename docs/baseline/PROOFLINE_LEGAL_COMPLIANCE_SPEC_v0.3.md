# PROOFLINE — Legal, Privacy & Compliance Product Spec v0.3

**Fecha:** 25 de agosto de 2026  
**Ámbito:** España / Unión Europea como baseline inicial  
**Nota:** especificación de producto y arquitectura de cumplimiento; no sustituye asesoramiento jurídico profesional.

## 1. Objetivo

Proofline tiene múltiples actores: ARMAR TECHNOLOGIES, organización cliente, representantes autorizados, usuarios internos, consultoras/partners, participantes, stakeholders que reciben informes, publishers del Marketplace y proveedores/subencargados.

La plataforma debe hacer que **responsabilidades, información, aceptación contractual, consentimiento cuando corresponda y evidencia** sean explícitos, versionados y auditables.

## 2. Regla fundamental: informar, aceptar y consentir no son lo mismo

### Informar

El RGPD obliga a informar sobre el tratamiento. Una Privacy Notice no se convierte por ello en un contrato ni requiere siempre “consentimiento”. Proofline puede registrar un acknowledgement para demostrar que el notice fue mostrado.

### Aceptar

Se usa para condiciones contractuales: Terms, Partner Terms, Order Form, Marketplace Publisher Terms, etc.

### Consentir

Sólo cuando el consentimiento es la base jurídica real del tratamiento. Debe ser libre, específico, informado, inequívoco y revocable. En relaciones laborales existe un desequilibrio que puede hacer que el consentimiento no sea una base adecuada; Proofline no debe forzar a clientes a utilizarlo por defecto.

## 3. Matriz de actores y evidencias

| Actor | Interacción legal mínima | Evidencia |
|---|---|---|
| Visitante web | cookies/preferencias cuando aplique | preference/consent record |
| Lead / contacto comercial | privacy notice; marketing opt-in separado si existe | acknowledgement + consent sólo para marketing |
| Organization Owner | Terms + autoridad para contratar + Privacy Notice | acceptance + acknowledgement |
| Organización cliente | DPA + Order Form / contract | OrganizationAgreement |
| Usuario cliente | Terms/Acceptable Use + Privacy Notice | acceptance/acknowledgement |
| Partner/consultora | Partner Terms + DPA según relación | agreement |
| Publisher Marketplace | Publisher/IP/license terms | acceptance + rights declaration |
| Participant | assessment-specific notice | acknowledgement; consent sólo si jurídicamente corresponde |
| Stakeholder/receptor | confidentiality/use terms si se requiere | acknowledgement/acceptance |
| Soporte ARMAR | internal privileged access policy | internal acceptance + JIT evidence |
| Cliente que autoriza soporte | support access approval | approval record |

## 4. Controller / Processor model

Baseline habitual:

- La **organización cliente** será normalmente responsable del tratamiento respecto de participantes y finalidad del assessment.
- **ARMAR TECHNOLOGIES / Proofline** actuará normalmente como encargado para el procesamiento del assessment conforme a instrucciones documentadas.
- Proofline puede ser responsable independiente para datos necesarios de cuenta, facturación, seguridad, fraude, cumplimiento propio y relación comercial.
- En Marketplace, consultoría o configuraciones especiales la calificación debe revisarse; no asumir automáticamente el mismo rol.

El sistema debe permitir registrar el rol aplicable por procesamiento y organización.

## 5. Assessment Legal Profile

Obligatorio antes de lanzar un assessment con datos personales.

Campos:

### Identidad y roles

- controller legal name;
- controller contact;
- DPO/privacy contact;
- Proofline role;
- partner/consultancy role si existe.

### Finalidad

- business objective;
- processing purpose;
- prohibited secondary purposes si se definen.

### Base jurídica

- legal basis under Article 6 declarada por el controller;
- Article 9 condition si hay special category data;
- rationale/document reference;
- legal reviewer/approver si el cliente usa workflow interno.

### Participación

- voluntary / mandatory / required-by-policy;
- consequences of non-participation cuando proceda;
- estimated time;
- contact for questions.

### Confidencialidad

- identified;
- confidential/pseudonymous;
- anonymous;
- minimum cohort;
- individual access policy;
- open-comment display policy;
- manager access policy.

### Datos

- fields collected;
- source of each field;
- purpose of each field;
- sensitive/special category classification;
- retention;
- deletion/anonymization target.

### Recipients and transfers

- recipient groups;
- subprocessors;
- data region;
- international transfers and safeguard if any.

### Automation / AI

- AI features enabled;
- purposes;
- human review;
- automated decision flag — default false;
- AI Act feature classification record reference.

### Rights

- access;
- rectification where applicable;
- erasure where applicable;
- restriction;
- objection;
- portability where applicable;
- complaint authority information.

## 6. Participant experience

Antes del assessment, el participante verá una pantalla breve y clara con información por capas:

1. quién solicita el assessment;
2. para qué se utilizarán las respuestas;
3. si es voluntario u obligatorio;
4. si Proofline conoce técnicamente su identidad;
5. qué verá el cliente;
6. umbral de confidencialidad;
7. cuánto tiempo se conservarán datos;
8. si se usa IA y para qué;
9. derechos/contacto;
10. enlace a información completa.

CTA según caso:

- `Continuar — he sido informado` para acknowledgement;
- `Acepto los términos de participación` sólo si existe componente contractual real;
- consentimiento separado y granular cuando esa sea la base jurídica;
- `No consentir` debe ser posible cuando el consentimiento sea la base y la participación pueda rechazarse legalmente.

No utilizar “Al continuar aceptas nuestra política de privacidad” como fórmula genérica.

## 7. Legal documents and versioning

### Entidades

```text
LegalDocument
  type
  owner: platform | organization | partner
  jurisdiction_scope

LegalDocumentVersion
  version
  locale
  effective_at
  published_at
  content_hash
  material_change
  requires_reacceptance
  status

LegalInteraction
  subject_ref
  document_version_id
  action
  occurred_at
  organization_id?
  assessment_id?
  session_ref
  evidence_metadata
```

### Estados

`DRAFT → LEGAL_REVIEW → APPROVED → SCHEDULED → ACTIVE → SUPERSEDED → RETIRED`

Nunca sobrescribir texto legal activo manteniendo la misma versión.

## 8. Re-acceptance / change management

- cambio material en Terms: puede requerir reaceptación;
- cambio Privacy Notice: normalmente notificación/acknowledgement, no “nuevo consentimiento” salvo que cambie a una finalidad que realmente lo requiera;
- cambio DPA: workflow contractual;
- cambio de subprocessor: notificación/objection workflow según contrato;
- cambio participant notice: versionar por assessment/wave.

## 9. Cookie & tracking baseline

### Public Site

Panel inicial:

- Accept all;
- Reject all;
- Configure.

Aceptar y rechazar deben estar al mismo nivel de visibilidad. Nada premarcado.

Categorías iniciales:

- Necessary;
- Preferences;
- Analytics;
- Marketing — sólo si realmente se usa.

Idioma y theme elegidos por el usuario pueden almacenarse como preferencias funcionales si se usan exclusivamente para prestar esa funcionalidad.

### Authenticated products

Evitar advertising trackers. Product analytics debe poder desactivarse/configurarse por tenant si legal/contractualmente se requiere.

## 10. DPA / subprocessors

Proofline Control debe gestionar:

- DPA template version;
- signed/accepted DPA por organization;
- custom DPA attachment/reference;
- subprocessor list;
- purpose;
- location;
- transfer mechanism;
- effective date;
- change notifications;
- objections and resolution.

## 11. DPIA / EIPD readiness

Proofline no sustituye la EIPD del responsable, pero debe facilitarla.

Exportable **Assessment Privacy Pack**:

- processing description;
- data map;
- purpose and necessity fields;
- categories and recipients;
- retention;
- security controls;
- confidentiality model;
- AI features;
- subprocessors;
- risk-relevant settings;
- audit evidence.

El backoffice debe poder marcar un cliente/assessment como `DPIA_REQUIRED`, `DPIA_COMPLETED`, `DPIA_NOT_REQUIRED_WITH_RATIONALE` o `PENDING_REVIEW`.

## 12. AI Act governance

Mantener `AI Feature Register`:

- feature;
- provider/model;
- intended purpose;
- input data categories;
- output;
- human oversight;
- whether output may affect employment decisions;
- risk classification;
- legal review;
- documentation version;
- enabled jurisdictions;
- rollout status.

Proofline baseline evita decisiones laborales autónomas. Si una futura feature se utiliza para recruitment, promotion, dismissal, task allocation o evaluación con efectos significativos, debe bloquearse su lanzamiento hasta nueva clasificación jurídica/técnica.

## 13. Data subject rights

Proofline Control incluirá DSR workflows:

- receive;
- identity verification;
- classify request;
- locate data;
- controller coordination;
- export/rectify/delete/restrict;
- deadline tracking;
- approval;
- completion evidence.

Cuando Proofline sea processor, el flujo debe permitir asistir al controller sin responder unilateralmente en su nombre salvo instrucción/autorización.

## 14. Retention and deletion

Retention Matrix configurable por tipo:

- account/business data;
- identity vault;
- raw responses;
- aggregated results;
- reports;
- billing records;
- audit/security logs;
- support attachments;
- legal acceptance evidence.

Operaciones:

`scheduled deletion → hold check → execute → verify → immutable completion record`

## 15. Security incidents and breaches

Control debe soportar:

- incident record;
- impacted systems/data;
- timeline;
- containment;
- controller notification status;
- evidence;
- decision whether breach notification is required;
- corrective actions;
- postmortem.

El software no decide jurídicamente por sí solo si se notifica a una autoridad; ayuda a recopilar evidencia y controlar plazos.

## 16. Marketplace legal controls

Un framework publicado debe registrar:

- publisher identity;
- ownership/right-to-license declaration;
- copyright/license;
- allowed modifications;
- territories;
- commercial terms;
- data requirements;
- methodology claims;
- validated status evidence if claimed;
- version history;
- takedown/retirement workflow.

No permitir etiquetar “validated” sin evidencia documental y aprobación.

## 17. Commercial and billing legal controls

- Order Form / subscription contract version;
- plan;
- price;
- taxes;
- term;
- renewal;
- cancellation;
- usage rules;
- enterprise override;
- purchaser authority;
- acceptance evidence;
- invoice/credit note immutability rules.

## 18. Public legal center

La web comercial tendrá `/legal` o equivalente con acceso permanente a:

- Terms;
- Privacy;
- Cookies;
- DPA;
- Subprocessors;
- Security/Trust;
- AI Transparency;
- Acceptable Use;
- Marketplace/Partner terms cuando correspondan;
- accessibility statement cuando proceda;
- contact privacy/security.

## 19. Official reference baseline

- Regulation (EU) 2016/679 (GDPR), EUR-Lex.
- EDPB Guidelines 07/2020 on controller and processor concepts.
- EDPB Guidelines 05/2020 on consent.
- EDPB Guidelines 4/2019 on Data Protection by Design and by Default.
- AEPD guidance on cookies and current FAQ on consent/information.
- AEPD guidance and lists on DPIA/EIPD.
- Regulation (EU) 2024/1689 (AI Act) and European Commission implementation guidance/timelines.

## 20. Production legal gate

Antes de producción, abogado especializado/DPO debe validar:

1. corporate/legal identity of ARMAR TECHNOLOGIES entity;
2. Terms;
3. Privacy;
4. Cookie implementation;
5. DPA;
6. Subprocessor model;
7. participant notice templates;
8. controller/processor mapping;
9. retention schedule;
10. DPIA posture;
11. AI Act classification;
12. Marketplace IP/licensing;
13. billing/renewal rules;
14. international transfer posture.
