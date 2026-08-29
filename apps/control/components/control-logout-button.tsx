"use client";
import { Icon } from "@proofline/ui";
import { requestProoflineConfirmation } from "@proofline/ui/client";
export function ControlLogoutButton({locale}:{locale:"es"|"en"}){const es=locale==="es";return <button className="control-logout" onClick={async()=>{const ok=await requestProoflineConfirmation({title:es?"Cerrar sesión de Control":"Sign out of Control",message:es?"¿Quieres cerrar tu sesión interna de Proofline Control?":"Do you want to sign out of your internal Proofline Control session?",confirmLabel:es?"Cerrar sesión":"Sign out"});if(!ok)return;await fetch("/api/session/logout",{method:"POST"});window.location.href=`/login?locale=${locale}`}}><Icon name="logout" size={15}/><span>{es?"Cerrar sesión":"Sign out"}</span></button>}
