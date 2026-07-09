import { useEffect } from "react";
import { HELP_NOTES, HelpSection } from "../../help/keyboardShortcuts";

interface Props {
  title: string;
  sections: HelpSection[];
  onClose: () => void;
}

export function HelpDialog({ title, sections, onClose }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="help-overlay" onClick={onClose}>
      <div
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="help-dialog-header">
          <h2 id="help-dialog-title">{title}</h2>
          <button type="button" className="help-dialog-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </header>

        <div className="help-dialog-body">
          {sections.map((section) => (
            <section key={section.title} className="help-section">
              <h3>{section.title}</h3>
              <dl className="help-list">
                {section.items.map((item) => (
                  <div key={`${section.title}-${item.keys}`} className="help-item">
                    <dt>{item.keys}</dt>
                    <dd>
                      {item.description}
                      {item.note && <span className="help-item-note">（{item.note}）</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <section className="help-section">
            <h3>補足</h3>
            <ul className="help-notes">
              {HELP_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
