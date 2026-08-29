"use client";
import { useState } from "react";
import { Icon } from "@proofline/ui";
import { requestProoflineConfirmation } from "@proofline/ui/client";
export function LogoutButton({ locale }: { locale: "es" | "en" }) {
  const [busy,setBusy]=useState(false),es=locale==="es";
  return <button className="workspace-logout" type="button" disabled={busy} onClick={async()=>{const ok=await requestProoflineConfirmation({title:es?"Cerrar sesión":"Sign out",message:es?"¿Quieres cerrar la sesión actual de este Workspace?":"Do you want to sign out of this Workspace session?",confirmLabel:es?"Cerrar sesión":"Sign out"});if(!ok)return;setBusy(true);await fetch("/api/session/logout",{method:"POST"});window.location.href=`/login?locale=${locale}`}}><Icon name="logout" size={15}/><span>{busy?(es?"Saliendo…":"Signing out…"):(es?"Cerrar sesión":"Sign out")}</span></button>;
}
