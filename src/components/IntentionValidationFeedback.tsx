
import type { IntentionValidationResult } from "../services/intentionValidator";

interface IntentionValidationFeedbackProps {
  result: IntentionValidationResult;
}

export function IntentionValidationFeedback({
  result
}: IntentionValidationFeedbackProps) {
  if (result.status === "empty") {
    return null;
  }

  const feedback = {
    found: {
      message: "✓ Intenção mental identificada!",
      color: "#15803d"
    },
    missing: {
      message: "⚠ Você ainda não utilizou a intenção mental.",
      color: "#b45309"
    },
    unavailable: {
      message: "Validação automática indisponível para esta intenção.",
      color: "#64748b"
    }
  }[result.status];

  return (
    <p
      role="status"
      aria-live="polite"
      style={{
        margin: "0.5rem 0",
        fontSize: "0.9rem",
        fontWeight: 600,
        color: feedback.color
      }}
    >
      {feedback.message}
    </p>
  );
}
