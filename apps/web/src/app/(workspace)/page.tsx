import { ConfigPanel } from '@/components/workspace/config-panel';
import { getDefaultConfiguration } from '@/lib/api/queries';
import { DATASET_ID } from '@/lib/dataset';

/** "/": the default configuration. Cached, so the whole page prerenders. */
export default async function HomePage() {
  const configuration = await getDefaultConfiguration(DATASET_ID);
  return <ConfigPanel configuration={configuration} />;
}
