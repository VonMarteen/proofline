import type { ReactNode } from "react";

export function PageIntro({
  title,
  text,
  aside,
}: {
  title: string;
  text: string;
  aside?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div className="page-intro-copy">
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {aside ? <div className="page-intro-aside">{aside}</div> : null}
    </div>
  );
}
