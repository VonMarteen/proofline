"use client";

import { usePathname } from "next/navigation";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const es = !usePathname().startsWith("/en/");
  const technical = String(error.message || "").slice(0, 1100);
  const safeDiagnostic = process.env.NODE_ENV === "development" ? technical : (error.digest || "HTTP error; consult server logs");
  const status = /returned (\d{3})/.exec(technical)?.[1];
  const timeout = /timeout|timed out|abort/i.test(technical);
  const noConnection = /cannot reach|ECONNREFUSED|fetch failed/i.test(technical);
  const title = es ? "No se pudo cargar esta sección" : "Unable to load this section";
  const detail = status === "403"
    ? (es ? "Tu usuario no dispone de los permisos necesarios. No se ha ejecutado ninguna operación." : "Your account lacks the required permissions. No operation was performed.")
    : status === "401"
    ? (es ? "La sesión requiere autenticación." : "Authentication is required.")
    : timeout
    ? (es ? "La consulta ha superado el tiempo de espera. Revisa la API interna y el tiempo de respuesta de la base de datos." : "The request timed out. Check the internal API and database response time.")
    : noConnection
    ? (es ? "No hay conexión con la API interna de Control (puerto 4206). Comprueba el proceso de API." : "Cannot reach the Control internal API (port 4206). Check the API process.")
    : status
    ? (es ? `La API ha devuelto HTTP ${status}. Abre el detalle para diagnosticar el error.` : `The API returned HTTP ${status}. Open details to diagnose the error.`)
    : (es ? "Se ha producido un error durante la carga. Revisa el detalle técnico y los registros del servidor." : "An error occurred while loading. Check technical details and server logs.");
  return <div className="control-stack control-route-error" style={{maxWidth:820}} role="alert">
    <div className="control-page-intro"><div><h1>{title}</h1><p>{detail}</p></div></div>
    <section className="control-panel"><details><summary>{es?"Detalle técnico":"Technical details"}</summary><pre className="control-json" style={{marginTop:14,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{safeDiagnostic || (es?"Consulta los logs del servidor":"Check server logs")}</pre></details><div style={{marginTop:18}}><button className="control-button" onClick={reset}>{es?"Reintentar":"Retry"}</button></div></section>
  </div>;
}
