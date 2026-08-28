"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card card-strong" style={{ maxWidth: 760 }}>
      <div className="eyebrow">PROOFLINE APP</div>
      <h1>No se pudo cargar la información</h1>
      <p className="muted">
        Comprueba que la API esté activa en <code>http://localhost:4100/health</code>. La interfaz sigue disponible y puedes reintentar sin reiniciar todo Proofline.
      </p>
      <details className="muted" style={{ margin: "18px 0" }}>
        <summary>Detalle técnico</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error.message}</pre>
      </details>
      <button className="btn btn-accent" onClick={reset}>Reintentar</button>
    </div>
  );
}
