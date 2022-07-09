import { useState, useCallback } from "react";

export default function GenericToggleableDetails({
  defaultOpen = true,
  text,
  children,
  ...props
}: {
  defaultOpen?: boolean;
  text: string;
  children: React.ReactNode;
} & React.DetailsHTMLAttributes<HTMLDetailsElement>) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details {...props} open={open} onToggle={useCallback(e => setOpen(e.currentTarget.open), [])}>
      <summary>{text}</summary>
      <fieldset>
        <legend>
          <button onClick={useCallback(() => setOpen(open => !open), [])}>▼ {text}</button>
        </legend>
        {children}
      </fieldset>
    </details>
  );
}