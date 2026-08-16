import type { ReactNode } from "react";
import "./SectionCard.css";

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="section-card__header">
        <h2 className="section-card__title">{title}</h2>
        {action}
      </div>
      <div className="section-card__body">{children}</div>
    </section>
  );
}
