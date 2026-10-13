import type { MentalIntention } from "../types/hashmap";
import { isAuthorMode } from "../utils/authorMode";

interface IntentionCardProps {
  item: MentalIntention;
  onSelect: (item: MentalIntention) => void;
}

export function IntentionCard({ item, onSelect }: IntentionCardProps) {
  const hasYoutubeVideo = typeof item.youtubeVideo === "string" && item.youtubeVideo.trim().length > 0;
  const hasYoutubeShort = typeof item.youtubeShort === "string" && item.youtubeShort.trim().length > 0;

  return (
    <button
      type="button"
      className="intention-card"
      onClick={() => onSelect(item)}
    >
      <div>
        <h2>{item.intention}</h2>
        <p className="english">{item.english}</p>
        {isAuthorMode() && (hasYoutubeVideo || hasYoutubeShort) && (
          <div
            aria-label="Conteúdos publicados no YouTube"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}
          >
            {hasYoutubeVideo && (
              <img
                src="/images/youtube-video.png"
                alt="Vídeo publicado no YouTube"
                title="Vídeo publicado no YouTube"
                width={25}
                height={25}
                style={{ objectFit: "contain", display: "block" }}
              />
            )}
            {hasYoutubeShort && (
              <img
                src="/images/youtube-short.png"
                alt="Short publicado no YouTube"
                title="Short publicado no YouTube"
                width={25}
                height={25}
                style={{ objectFit: "contain", display: "block" }}
              />
            )}
          </div>
        )}
      </div>

      <div className="card-meta">
        {item.pattern && <span>{item.pattern}</span>}

        <div className="card-badges">
          {item.englishLevel && (
            <span className="pill english-level-pill">
              {item.englishLevel}
            </span>
          )}

          {item.category && (
            <span className="pill category-pill">{item.category}</span>
          )}
        </div>

        {item.tags && item.tags.length > 0 && (
          <div className="card-tags">
            {item.tags.map((tag) => (
              <span className="tag-pill" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
