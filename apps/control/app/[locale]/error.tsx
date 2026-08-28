"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="control-stack" style={{ maxWidth: 820 }}>
    <div className="control-page-intro"><div><h1>Control no puede consultar la API</h1><p>Comprueba que la API interna de Proofline Control esté disponible en <code>http://127.0.0.1:4200/health</code>. No se ha ejecutado ninguna acción administrativa.</p></div></div>
    <section className="control-panel"><details><summary>Detalle técnico</summary><pre className="control-json" style={{ marginTop: 14 }}>{error.message}</pre></details><div style={{ marginTop: 18 }}><button className="control-button" onClick={reset}>Reintentar</button></div></section>
  </div>;
}
