import { normalizeLocale } from "@proofline/i18n";
import { PageIntro } from "../../../components/page-intro";
import { CtaBand } from "../../../components/cta-band";

export default async function SolutionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";

  return <>
    <section className="page-hero">
      <div className="container">
        <PageIntro
          title={es ? "Una plataforma, dos modelos de operación." : "One platform, two operating models."}
          text={es
            ? "Proofline Direct está pensado para organizaciones que ejecutan sus propios estudios. Proofline Professional añade una capa multi-cliente para consultoras, expertos y partners que necesitan convertir metodología en una operación repetible."
            : "Proofline Direct is designed for organizations running their own studies. Proofline Professional adds a multi-client layer for consultancies, experts and partners who need to turn methodology into a repeatable operation."}
          aside={<div className="page-intro-note"><strong>{es ? "Mismo núcleo" : "Same core"}</strong><span>{es ? "Assessment, privacidad, análisis, evidencia y reporting comparten la misma arquitectura." : "Assessment, privacy, analysis, evidence and reporting share the same architecture."}</span></div>}
        />
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container modes-detail-grid">
        <article id="direct" className="mode-detail-panel">
          <div className="mode-detail-header">
            <p className="mode-audience">{es ? "Equipos internos · operación propia" : "Internal teams · own operation"}</p>
            <h2>Proofline Direct</h2>
            <p>{es
              ? "Para equipos internos que necesitan diseñar, lanzar, analizar y distribuir assessments sin depender de una consultora para cada paso ni operar una suite difícil de mantener."
              : "For internal teams that need to design, launch, analyse and distribute assessments without depending on a consultancy for every step or operating a difficult suite."}</p>
          </div>
          <div className="mode-detail-sections">
            <div><strong>{es ? "Ideal para" : "Best for"}</strong><p>{es ? "People, transformación, estrategia, dirección, experiencia de empleado e investigación interna." : "People, transformation, strategy, leadership, employee experience and internal research."}</p></div>
            <div><strong>{es ? "Qué controla el cliente" : "What the client controls"}</strong><p>{es ? "Objetivos, cuestionarios, población, permisos, privacidad, lanzamientos, análisis, revisiones y distribución." : "Objectives, questionnaires, population, permissions, privacy, launches, analysis, reviews and distribution."}</p></div>
            <div><strong>{es ? "Qué reduce Proofline" : "What Proofline reduces"}</strong><p>{es ? "Trabajo manual, inconsistencias entre oleadas, reporting artesanal y dependencia de hojas de cálculo dispersas." : "Manual work, inconsistencies between waves, hand-built reporting and dependence on scattered spreadsheets."}</p></div>
          </div>
          <ul className="mode-feature-list">
            <li>{es ? "Library y questionnaires privados" : "Library and private questionnaires"}</li>
            <li>{es ? "Assessment Check y readiness" : "Assessment Check and readiness"}</li>
            <li>{es ? "Invitaciones, recordatorios y seguimiento" : "Invitations, reminders and tracking"}</li>
            <li>{es ? "Resultados por audiencia y evidencia navegable" : "Audience-specific results and navigable evidence"}</li>
            <li>{es ? "Roles, auditoría y controles de datos" : "Roles, audit and data controls"}</li>
          </ul>
          <a className="btn btn-primary" href={`/${locale}/contact`}>{es ? "Ver Direct en una demo" : "See Direct in a demo"}</a>
        </article>

        <article id="professional" className="mode-detail-panel professional">
          <div className="mode-detail-header">
            <p className="mode-audience">{es ? "Consultoras y partners · operación multi-cliente" : "Consultancies & partners · multi-client operation"}</p>
            <h2>Proofline Professional</h2>
            <p>{es
              ? "Para firmas que ya poseen metodología, expertise o una cartera de clientes y necesitan una capa de producto que les permita operar con más consistencia sin perder propiedad intelectual ni calidad."
              : "For firms that already own methodology, expertise or a client portfolio and need a product layer that lets them operate more consistently without losing intellectual property or quality."}</p>
          </div>
          <div className="mode-detail-sections">
            <div><strong>{es ? "Ideal para" : "Best for"}</strong><p>{es ? "Consultoras, especialistas, universidades, partners de transformación y firmas de investigación." : "Consultancies, specialists, universities, transformation partners and research firms."}</p></div>
            <div><strong>{es ? "Qué añade" : "What it adds"}</strong><p>{es ? "Separación multi-cliente, frameworks privados, branding, reporting repetible y gobierno centralizado." : "Multi-client separation, private frameworks, branding, repeatable reporting and centralised governance."}</p></div>
            <div><strong>{es ? "Qué protege" : "What it protects"}</strong><p>{es ? "Versiones de metodología, procedencia, reglas de edición y acceso a datos según cliente y proyecto." : "Methodology versions, provenance, edit rules and data access by client and project."}</p></div>
          </div>
          <ul className="mode-feature-list">
            <li>{es ? "Workspaces separados por cliente" : "Separated client workspaces"}</li>
            <li>{es ? "Frameworks propios y bibliotecas privadas" : "Proprietary frameworks and private libraries"}</li>
            <li>{es ? "Informes y portadas por marca o audiencia" : "Reports and covers by brand or audience"}</li>
            <li>{es ? "Marketplace preparado para licencias y revenue share" : "Marketplace ready for licensing and revenue share"}</li>
            <li>{es ? "Trazabilidad operativa y metodológica" : "Operational and methodological traceability"}</li>
          </ul>
          <a className="btn btn-primary" href={`/${locale}/contact`}>{es ? "Hablar sobre Professional" : "Discuss Professional"}</a>
        </article>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="content-heading two-column-heading">
          <h2>{es ? "Qué cambia entre Direct y Professional." : "What changes between Direct and Professional."}</h2>
          <p>{es ? "No son dos productos distintos: cambia el modelo operativo y de gobierno." : "They are not two separate products: the operating and governance model changes."}</p>
        </div>
        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <thead><tr><th>{es ? "Capacidad" : "Capability"}</th><th>Direct</th><th>Professional</th></tr></thead>
            <tbody>
              {(es ? [
                ["Assessments propios", "Incluido", "Incluido"],
                ["Library / Marketplace", "Acceso y biblioteca privada", "Acceso, biblioteca privada y publicación partner"],
                ["Múltiples clientes", "No es el caso principal", "Diseñado para ello"],
                ["Branding de informes", "Marca de organización", "Marca de partner y/o cliente"],
                ["Roles y permisos", "Por organización y assessment", "Por partner, cliente y assessment"],
                ["Operación repetible", "Entre estudios internos", "Entre proyectos y clientes"],
              ] : [
                ["Own assessments", "Included", "Included"],
                ["Library / Marketplace", "Access and private library", "Access, private library and partner publishing"],
                ["Multiple clients", "Not the primary case", "Designed for it"],
                ["Report branding", "Organization brand", "Partner and/or client brand"],
                ["Roles & permissions", "By organization and assessment", "By partner, client and assessment"],
                ["Repeatable operation", "Across internal studies", "Across projects and clients"],
              ]).map((row) => <tr key={row[0]}>{row.map((cell, cellIndex) => <td key={`${row[0]}-${cellIndex}`}>{cell}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container">
        <div className="content-heading">
          <h2>{es ? "Casos donde Proofline encaja especialmente bien." : "Cases where Proofline fits especially well."}</h2>
        </div>
        <div className="use-case-grid">
          {(es ? [
            ["Clima y experiencia", "Oleadas recurrentes, comparabilidad y segmentación con reglas de privacidad."],
            ["Transformación", "Readiness, barreras, evolución y comunicación durante programas de cambio."],
            ["Liderazgo y equipos", "Percepción, brechas y desarrollo con límites claros sobre evaluación individual."],
            ["Consultoría basada en metodología", "Convertir un framework experto en una experiencia operable y escalable."],
          ] : [
            ["Climate & experience", "Recurring waves, comparability and segmentation with privacy rules."],
            ["Transformation", "Readiness, barriers, evolution and communication during change programmes."],
            ["Leadership & teams", "Perception, gaps and development with clear limits on individual evaluation."],
            ["Methodology-led consulting", "Turn an expert framework into an operable, scalable experience."],
          ]).map(([title, text]) => <article className="use-case-card" key={title}><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </div>
    </section>

    <CtaBand
      locale={locale}
      title={es ? "Elige el modelo por cómo trabajas, no por una lista artificial de funciones." : "Choose the model by how you work, not by an artificial feature list."}
      text={es ? "Podemos revisar contigo si Direct o Professional encaja mejor según quién opera los assessments, cuántos clientes intervienen y cómo quieres gobernar la metodología." : "We can review whether Direct or Professional fits better based on who operates assessments, how many clients are involved and how you want to govern methodology."}
      secondaryHref={`/${locale}/product`}
      secondaryLabel={es ? "Ver el producto" : "View product"}
    />
  </>;
}
