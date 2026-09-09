import { normalizeLocale } from "@proofline/i18n";
import { Icon } from "@proofline/ui";
import { EvidencePreview } from "../../components/evidence-preview";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";

  const challenges = es ? [
    { icon:"activity" as const, title:"Señales fragmentadas", text:"Feedback, assessments, comentarios y datos viven separados y pierden contexto." },
    { icon:"search" as const, title:"Significado poco claro", text:"Cuesta distinguir qué es ruido, qué importa y qué merece una decisión." },
    { icon:"clock" as const, title:"Decisiones más lentas", text:"Sin una lectura defendible, la organización tarda en pasar de observación a acción." },
  ] : [
    { icon:"activity" as const, title:"Fragmented signals", text:"Feedback, assessments, comments and data live apart and lose context." },
    { icon:"search" as const, title:"Unclear meaning", text:"It is hard to separate noise from what matters and deserves a decision." },
    { icon:"clock" as const, title:"Slower decisions", text:"Without a defensible reading, organizations take longer to move from observation to action." },
  ];

  const process = es ? [
    { icon:"clipboard-check" as const, step:"01", title:"Diseñar", text:"Parte de una pregunta clara, un framework probado o un assessment propio revisado antes de salir." },
    { icon:"people" as const, step:"02", title:"Recoger", text:"Invita a la población correcta con privacidad, cohortes, avisos y control de participación." },
    { icon:"activity" as const, step:"03", title:"Entender", text:"Convierte respuestas en señales, diferencias, riesgos y evidencia con contexto metodológico." },
    { icon:"arrow-right" as const, step:"04", title:"Actuar", text:"Entrega una lectura ejecutiva clara y conserva debajo la profundidad para defender cada conclusión." },
  ] : [
    { icon:"clipboard-check" as const, step:"01", title:"Design", text:"Start from a clear question, a proven framework or your own assessment reviewed before launch." },
    { icon:"people" as const, step:"02", title:"Collect", text:"Invite the right population with privacy, cohorts, notices and participation controls." },
    { icon:"activity" as const, step:"03", title:"Understand", text:"Turn responses into signals, differences, risks and evidence with methodological context." },
    { icon:"arrow-right" as const, step:"04", title:"Act", text:"Deliver a clear executive reading while keeping enough depth to defend every conclusion." },
  ];

  const capabilities = es ? [
    { icon:"reports" as const, title:"Reporte ejecutivo", text:"Una lectura ejecutiva para dirección que prioriza qué está ocurriendo, dónde merece atención y qué evidencia sostiene cada conclusión.", meta:"RESPUESTA PRIMERO" },
    { icon:"activity" as const, title:"Mapa de fortalezas", text:"Compara dimensiones, cohortes y tendencias para localizar fortalezas consistentes, diferencias relevantes y señales que requieren contexto antes de decidir.", meta:"SEÑAL CON CONTEXTO" },
    { icon:"alert" as const, title:"Detección de riesgos", text:"Identifica señales tempranas y muestra sus límites de interpretación para separar riesgo, correlación y evidencia antes de convertirlos en una decisión.", meta:"RIESGO DEFENDIBLE" },
    { icon:"library" as const, title:"Frameworks", text:"Parte de marcos estructurados, versionados y reutilizables, o adapta metodología propia manteniendo trazabilidad sobre preguntas, escalas y cambios.", meta:"MÉTODO REUTILIZABLE" },
  ] : [
    { icon:"reports" as const, title:"Executive report", text:"An executive leadership reading that prioritizes what is happening, where attention is needed and which evidence supports each conclusion.", meta:"ANSWER FIRST" },
    { icon:"activity" as const, title:"Strength map", text:"Compare dimensions, cohorts and trends to locate consistent strengths, meaningful differences and signals that require context before decisions are made.", meta:"SIGNAL IN CONTEXT" },
    { icon:"alert" as const, title:"Risk detection", text:"Identify early signals and expose interpretation limits so risk, correlation and evidence remain distinct before they inform a decision.", meta:"DEFENSIBLE RISK" },
    { icon:"library" as const, title:"Frameworks", text:"Start from structured, versioned and reusable frameworks, or adapt proprietary methodology while keeping questions, scales and changes traceable.", meta:"REUSABLE METHOD" },
  ];

  return <>
    <section className="pl-home-hero">
      <div className="container pl-home-hero-grid">
        <div className="pl-home-hero-copy">
          
          <h1>{es ? <>Inteligencia organizacional para líderes que necesitan <em>claridad.</em></> : <>Organizational intelligence for leaders who need <em>clarity.</em></>}</h1>
          <p className="pl-home-lead">{es ? "Proofline combina assessments estructurados, marcos probados, privacidad y análisis trazable para ayudarte a entender qué está pasando, por qué importa y qué decisión conviene tomar después." : "Proofline combines structured assessments, proven frameworks, privacy and traceable analysis to help you understand what is happening, why it matters and what decision should come next."}</p>
          <div className="pl-home-actions"><a className="btn btn-primary pl-home-primary" href={`/${locale}/contact`}>{es ? "Solicitar una demo" : "Request a demo"}<Icon name="arrow-right" size={16}/></a><a className="pl-home-text-action" href={`/${locale}/product`}><span className="pl-play"><Icon name="arrow-right" size={14}/></span>{es ? "Ver cómo funciona" : "See how it works"}</a></div>
          <div className="pl-home-principles"><span>{es ? "Más claridad" : "More clarity"}</span><i/><span>{es ? "Decisiones más rápidas" : "Faster decisions"}</span><i/><span>{es ? "Evidencia trazable" : "Traceable evidence"}</span></div>
        </div>
        <div className="pl-home-product-stage"><EvidencePreview locale={locale}/><div className="pl-home-handnote">{es ? "La información dispersa se convierte en una lectura con sentido." : "Scattered information becomes a meaningful reading."}</div></div>
      </div>
    </section>

    <section className="pl-signal-strip">
      <div className="container pl-signal-strip-inner"><span className="pl-strip-label">{es ? "Ámbitos que Proofline ayuda a comprender" : "Domains Proofline helps you understand"}</span><div className="pl-strip-items"><span><Icon name="people" size={17}/>{es ? "Personas" : "People"}</span><span><Icon name="handshake" size={17}/>{es ? "Liderazgo" : "Leadership"}</span><span><Icon name="activity" size={17}/>{es ? "Cultura" : "Culture"}</span><span><Icon name="rocket" size={17}/>{es ? "Cambio" : "Change"}</span><span><Icon name="governance" size={17}/>{es ? "Ejecución" : "Execution"}</span></div></div>
    </section>

    <section className="pl-home-section pl-challenge-section">
      <div className="container pl-challenge-grid">
        <div className="pl-challenge-copy"><h2>{es ? <>Demasiadas señales.<br/>Poco significado.<br/>Decisiones que tardan.</> : <>Too many signals.<br/>Too little meaning.<br/>Decisions take too long.</>}</h2><p>{es ? "Las organizaciones generan una enorme cantidad de información. El problema no es recoger más: es conectar lo importante, saber qué puede afirmarse y hacerlo llegar a quienes deben decidir." : "Organizations generate enormous amounts of information. The problem is not collecting more: it is connecting what matters, knowing what can be claimed and getting it to the people who must decide."}</p></div>
        <div className="pl-challenge-cards">{challenges.map(item=><article key={item.title}><span className="pl-round-icon"><Icon name={item.icon} size={22}/></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div>
        <div className="pl-terrain-panel"><div className="pl-terrain-lines" aria-hidden="true"><span/><span/><span/><span/><span/></div><div className="pl-terrain-content"><div><strong>{es ? "Señal conectada" : "Connected signal"}</strong><span>{es ? "Relaciona dimensiones, cohortes y contexto sin separar la evidencia de su origen." : "Relates dimensions, cohorts and context without separating evidence from its source."}</span></div><div><strong>{es ? "Lectura defendible" : "Defensible reading"}</strong><span>{es ? "Distingue dato, interpretación y límite antes de convertir una señal en una conclusión." : "Separates data, interpretation and limits before turning a signal into a conclusion."}</span></div><div><strong>{es ? "Decisión accionable" : "Actionable decision"}</strong><span>{es ? "Entrega una lectura ejecutiva clara y mantiene la profundidad disponible para revisar y justificar." : "Delivers a clear executive reading while keeping depth available for review and justification."}</span></div></div></div>
      </div>
    </section>

    <section className="pl-process-section">
      <div className="container pl-process-grid"><div className="pl-process-intro"><h2>{es ? <>De la señal<br/>a la acción.</> : <>From signal<br/>to action.</>}</h2><p>{es ? "Un recorrido continuo donde pregunta, método, privacidad, evidencia y resultado nunca pierden el vínculo." : "A continuous journey where question, method, privacy, evidence and outcome never lose their connection."}</p><a href={`/${locale}/product`}>{es ? "Ver el ciclo completo" : "See the full cycle"}<Icon name="arrow-right" size={16}/></a></div><div className="pl-process-steps">{process.map((step)=><article key={step.step}><span className="pl-process-icon"><Icon name={step.icon} size={23}/></span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></div>
    </section>

    <section className="pl-home-section pl-capabilities-section">
      <div className="container"><div className="pl-section-heading"><div><h2>{es ? <>Información clara<br/>para un mayor impacto.</> : <>Clear information<br/>for greater impact.</>}</h2></div><p>{es ? "La capa ejecutiva responde primero. La profundidad analítica sigue disponible para quien necesita revisar evidencia, cohortes, metodología o límites." : "The executive layer answers first. Analytical depth remains available for anyone who needs to review evidence, cohorts, methodology or limitations."}</p></div><div className="pl-capability-grid">{capabilities.map((item,index)=><article className={`pl-capability-card card-${index+1}`} key={item.title}><div className="pl-capability-top"><span className="pl-capability-icon"><Icon name={item.icon} size={21}/></span></div><h3>{item.title}</h3><p>{item.text}</p>{index===0?<div className="pl-mini-chart"><i style={{height:"38%"}}/><i style={{height:"56%"}}/><i style={{height:"72%"}}/><i style={{height:"89%"}}/></div>:index===1?<div className="pl-radar"><span/><span/><span/><i/></div>:index===2?<div className="pl-risk-list"><span><i className="high"/>{es?"Rotación":"Turnover"}<b>{es?"Alto":"High"}</b></span><span><i className="mid"/>{es?"Desalineación":"Misalignment"}<b>{es?"Medio":"Medium"}</b></span><span><i className="low"/>{es?"Confianza":"Confidence"}<b>{es?"Bajo":"Low"}</b></span></div>:<div className="pl-framework-sheet"><strong>{es?"Liderazgo adaptativo":"Adaptive leadership"}</strong><span>{es?"Marco estructurado · versión controlada":"Structured framework · controlled version"}</span></div>}<a href={index===3?`/${locale}/library`:`/${locale}/product`}>{es ? (index===3?"Ver frameworks":"Ver ejemplo") : (index===3?"View frameworks":"View example")}<Icon name="arrow-right" size={14}/></a></article>)}</div></div>
    </section>

    <section className="pl-home-section pl-trust-section">
      <div className="container pl-trust-layout"><div className="pl-trust-copy"><h2>{es ? <>Tu información,<br/>siempre protegida.</> : <>Your information,<br/>always protected.</>}</h2><p>{es ? "La confianza no se añade al final del informe. Está presente en la arquitectura, la separación de identidad, los permisos, la retención y la forma en que Proofline limita lo que puede afirmar." : "Trust is not added at the end of the report. It is built into architecture, identity separation, permissions, retention and the way Proofline limits what it can claim."}</p><a className="pl-home-text-link" href={`/${locale}/trust`}>{es ? "Explorar el Trust Center" : "Explore the Trust Center"}<Icon name="arrow-right" size={15}/></a></div><div className="pl-trust-features"><div><Icon name="lock" size={22}/><strong>{es ? "Cifrado y mínimo dato" : "Encryption & data minimisation"}</strong><span>{es ? "Minimiza la información tratada y vincula cada dato a un propósito claro, evitando recopilar o conservar información que no aporta al análisis." : "Minimizes processed information and links each data point to a clear purpose, avoiding collection or retention that does not contribute to the analysis."}</span></div><div><Icon name="governance" size={22}/><strong>{es ? "Gobernanza verificable" : "Verifiable governance"}</strong><span>{es ? "Roles, permisos, retención y cambios relevantes quedan gobernados para que el acceso y las decisiones operativas puedan revisarse con trazabilidad." : "Roles, permissions, retention and relevant changes are governed so access and operational decisions remain reviewable and traceable."}</span></div><div><Icon name="people" size={22}/><strong>{es ? "Acceso controlado" : "Controlled access"}</strong><span>{es ? "El acceso se limita por rol, organización y contexto de uso para que cada persona vea únicamente los resultados y cohortes que le corresponden." : "Access is limited by role, organization and usage context so each person sees only the results and cohorts they are entitled to review."}</span></div><div><Icon name="reports" size={22}/><strong>{es ? "Resultados defendibles" : "Defensible outcomes"}</strong><span>{es ? "Cada conclusión conserva el vínculo con la metodología, la evidencia disponible y los límites que deben entenderse antes de utilizarla para decidir." : "Every conclusion remains connected to method, available evidence and the limitations that must be understood before it is used for a decision."}</span></div></div><div className="pl-trust-landscape"><div className="pl-trust-orbit" aria-hidden="true"><span/><span/><span/></div><div className="pl-trust-landscape-content"><div><strong>{es ? "Privacidad desde el diseño" : "Privacy by design"}</strong><span>{es ? "La separación de identidad, respuesta y resultado forma parte de la arquitectura, no de una capa añadida después." : "Identity, response and outcome separation is part of the architecture, not a layer added afterwards."}</span></div><div><strong>{es ? "Trazabilidad operativa" : "Operational traceability"}</strong><span>{es ? "Permisos, cambios relevantes y entregas pueden auditarse sin exponer información innecesaria." : "Permissions, relevant changes and deliveries can be audited without exposing unnecessary information."}</span></div><div><strong>{es ? "Conclusiones con límites claros" : "Conclusions with clear limits"}</strong><span>{es ? "Cada lectura conserva el vínculo con metodología, evidencia disponible y aquello que los datos no permiten afirmar." : "Each reading stays connected to method, available evidence and what the data does not support claiming."}</span></div></div></div></div>
    </section>

    <section className="pl-usecases-section"><div className="container pl-usecases-grid"><div><h2>{es ? "Hecho para preguntas que importan." : "Built for questions that matter."}</h2></div><div className="pl-usecase-list"><a href={`/${locale}/library`}><div><strong>{es?"Clima y compromiso":"Climate & engagement"}</strong><small>{es?"Entender dónde se concentra la experiencia y qué factores sostienen la señal.":"Understand where experience concentrates and which factors sustain the signal."}</small></div><Icon name="arrow-right" size={17}/></a><a href={`/${locale}/library`}><div><strong>{es?"Liderazgo":"Leadership"}</strong><small>{es?"Contrastar claridad, confianza, coherencia y reconocimiento entre colectivos.":"Compare clarity, confidence, consistency and recognition across cohorts."}</small></div><Icon name="arrow-right" size={17}/></a><a href={`/${locale}/library`}><div><strong>{es?"Cambio y transformación":"Change & transformation"}</strong><small>{es?"Medir comprensión, adopción, fricción y preparación antes de intervenir.":"Measure understanding, adoption, friction and readiness before acting."}</small></div><Icon name="arrow-right" size={17}/></a></div></div></section>

    <section className="pl-final-cta"><div className="container pl-final-cta-inner"><div><h2>{es ? "Descubre qué está pasando realmente en tu organización." : "Discover what is really happening in your organization."}</h2></div><div><a className="btn pl-final-btn" href={`/${locale}/contact`}>{es ? "Solicitar una demo" : "Request a demo"}<Icon name="arrow-right" size={16}/></a><span>{es ? "Cuéntanos tu reto y te mostramos cómo estructurarlo en Proofline." : "Tell us your challenge and we will show you how to structure it in Proofline."}</span></div></div></section>
  </>;
}
