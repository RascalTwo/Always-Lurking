import { useState, useEffect } from "react";

export function UptimeTicker({ started }: { started: number | null }) {
  const [elapsed, setElapsed] = useState(() => (started ? Date.now() - started : 0));
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => setElapsed(elapsed => elapsed + 1000), 1000);
    return () => clearInterval(interval);
  }, [started]);

  if (!started) return null;

  return (
    <time dateTime={new Date(started).toISOString()} className="uptime">
      {new Date(elapsed).toISOString().substr(11, 8)}
    </time>
  );
}
