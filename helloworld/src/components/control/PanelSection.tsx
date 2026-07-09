import { ReactNode } from "react";

interface Props {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function PanelSection({ title, action, children }: Props) {
  return (
    <section className="block">
      {action ? (
        <div className="row">
          <h3>{title}</h3>
          {action}
        </div>
      ) : (
        <h3>{title}</h3>
      )}
      {children}
    </section>
  );
}
