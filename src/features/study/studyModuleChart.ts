import { EXTRA_CATEGORIES, OTHER_STUDY_SUBCATEGORIES, STUDY_MODULES } from "./studyStorage";
import type { StudyFilters } from "./studyStats";
import type { studyStats } from "./studyStats";

/** Visual-only keys: recorded sessions remain under the original extra-activities module. */
export const EXTRA_MODULE_PREFIX = "extra-category:";
export const OTHER_SUBCATEGORY_MODULE_PREFIX = "extra-other-subcategory:";

/** Build non-overlapping bars for the dashboard without changing the stored study data. */
export function moduleChartValues(
  stats: Pick<ReturnType<typeof studyStats>, "byModule" | "byExtraCategory" | "byOtherSubcategory">,
  filters: Pick<StudyFilters, "module" | "origin" | "extraCategory" | "extraSubcategory">,
): Record<string, number> {
  const values: Record<string, number> = {};
  const categorySelected = !!filters.extraCategory && filters.extraCategory !== "all";
  const showInternal = filters.origin === "internal" || (filters.origin !== "external" && !categorySelected);
  const showExternal = filters.origin !== "internal" && (filters.module === "all" || filters.module === "extra-activities");

  if (showInternal) {
    for (const module of filters.module === "all" ? STUDY_MODULES : [filters.module]) {
      if (module !== "extra-activities") values[module] = stats.byModule[module] ?? 0;
    }
  }
  if (showExternal) {
    for (const category of EXTRA_CATEGORIES) {
      if (!categorySelected || filters.extraCategory === category) {
        if (category === "other") {
          for (const subcategory of OTHER_STUDY_SUBCATEGORIES) {
            if (!filters.extraSubcategory || filters.extraSubcategory === "all" || filters.extraSubcategory === subcategory) {
              values[`${OTHER_SUBCATEGORY_MODULE_PREFIX}${subcategory}`] = stats.byOtherSubcategory[subcategory] ?? 0;
            }
          }
        } else {
          values[`${EXTRA_MODULE_PREFIX}${category}`] = stats.byExtraCategory[category] ?? 0;
        }
      }
    }
  }
  // Prior-hour adjustments are neither internal modules nor extra-activity categories.
  if (filters.module === "all" && showInternal && stats.byModule.previous) {
    values.previous = stats.byModule.previous;
  }
  return values;
}
