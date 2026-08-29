"use client";
import { Icon } from "@proofline/ui";
import { requestProoflineConfirmation } from "@proofline/ui/client";
export function SupportLogoutButton({locale}:{locale:"es"|"en"}){const es=locale==="es";return <button className="support-logout" onClick={async()=>{const ok=await requestProoflineConfirmation({title:es?"Cerrar sesión":"Sign out",message:es?"¿Quieres cerrar tu sesión de la consola de soporte?":"Do you want to sign out of the Support Console?",confirmLabel:es?"Cerrar sesión":"Sign out"});if(!ok)return;await fetch("/api/session/logout",{method:"POST"});window.location.href=`/login?locale=${locale}`}}><Icon name="logout" size={14}/><span>{es?"Cerrar sesión":"Sign out"}</span></button>}
