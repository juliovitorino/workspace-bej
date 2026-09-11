import type { HashmapMetadata } from "../types/hashmap";

interface HeaderProps {
  metadata?: HashmapMetadata;
  source?: "remote" | "cache";
}

export function Header({ metadata, source }: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Brazilian English Journey</p>
        <h1>Mental Hashmap</h1>
        <p className="subtitle">
          Busque pela intenção em português ou pela estrutura em inglês.
        </p>
      </div>

      {metadata && (
        <div className="metadata">
          <span>v{metadata.version}</span>
          <span>Atualizado em {metadata.updatedAt}</span>
          {source === "cache" && <span className="cache-badge">cache local</span>}
        </div>
      )}
    </header>
  );
}
