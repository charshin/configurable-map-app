import { type Configuration, configurationSchema } from '@confmap/shared';

/** Validation messages for a draft, keyed by path, e.g. "symbolConfig.color.stops.1.value". */
export type Issues = ReadonlyMap<string, string>;

/** Runs the same schema the API validates with, so the editor flags what a save would reject. */
export function validateDraft(draft: Configuration): Issues {
  const result = configurationSchema.safeParse(draft);
  const issues = new Map<string, string>();
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      if (!issues.has(key)) issues.set(key, issue.message);
    }
  }
  return issues;
}
