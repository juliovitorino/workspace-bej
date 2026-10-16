import { t } from "../i18n";
import { useTranslation } from "react-i18next";

import type { IntentionValidationResult } from "../services/intentionValidator";

interface IntentionValidationFeedbackProps {
  result: IntentionValidationResult;
}

export function IntentionValidationFeedback({
  result
}: IntentionValidationFeedbackProps) {
  const { t } = useTranslation();
  if (result.status === "empty") {
    return null;
  }

  const feedback = {
    found: {
      message: "✓ " + t("common.communicativeIntentionIdentified"),
      color: "#15803d"
    },
    missing: {
      message: "⚠ " + t("common.youHavenTUsedTheCommunicativeIntentionYet"),
      color: "#b45309"
    },
    unavailable: {
      message: t("common.automaticValidationIsUnavailableForThisIntention"),
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
