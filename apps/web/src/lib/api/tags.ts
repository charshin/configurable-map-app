/**
 * Cache tags for the cached API reads. Server Actions pass the same tags to
 * `updateTag` after a write, so the next read is fresh.
 */
export const cacheTags = {
  dataset: (datasetId: string) => `dataset:${datasetId}`,
  defaultConfiguration: (datasetId: string) => `configurations:default:${datasetId}`,
  publishedConfigurations: (datasetId: string) => `configurations:published:${datasetId}`,
  ownedConfigurations: (username: string) => `configurations:owner:${username}`,
  configuration: (id: string) => `configuration:${id}`,
};
