import { getOwnedConfigurations } from '@/lib/api/queries';
import { DATASET_ID } from '@/lib/dataset';
import { getUsername } from '@/lib/session';
import { PickerGroup } from './config-picker';

/**
 * The picker's "Mine" group. It reads the username cookie, so it renders at
 * request time inside a <Suspense> boundary; the user's list itself is cached
 * per username.
 */
export async function MyConfigurations() {
  const username = await getUsername();
  if (!username) {
    return <PickerGroup heading="Mine" items={[]} empty="Sign in to save your own configurations." />;
  }
  const items = await getOwnedConfigurations(DATASET_ID, username);
  return <PickerGroup heading="Mine" items={items} showOwner={false} empty="Nothing saved yet. Use Save as… to keep one." />;
}
