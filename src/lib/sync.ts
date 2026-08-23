import type { Recipe } from '../data/types';
import { CloudError, cloud } from './cloud';
import { repo } from './store';

const uploadStagedImage = async (recipe: Recipe): Promise<Recipe> => {
  if (!recipe.image?.startsWith('data:')) return recipe;
  const blob = await fetch(recipe.image).then(response => response.blob());
  const file = new File([blob], 'recipe.jpg', { type: blob.type || 'image/jpeg' });
  const { path } = await cloud.uploadImage(file);
  return { ...recipe, image: path };
};

/** Sends local changes in their original order.  It is deliberately idempotent:
 * favorite operations carry the desired state, and new recipes retain their UUID. */
export async function syncPendingChanges(): Promise<{ synced: number; pending: number }> {
  const changes = await repo.pending();
  if (!navigator.onLine || !cloud.hasSession()) return { synced: 0, pending: changes.length };
  let synced = 0;
  for (const change of changes) {
    try {
      if (change.type === 'recipe.create') await cloud.createRecipe(await uploadStagedImage(change.payload as Recipe));
      if (change.type === 'recipe.update') await cloud.updateRecipe(await uploadStagedImage(change.payload as Recipe));
      if (change.type === 'recipe.delete') await cloud.deleteRecipe((change.payload as { id: string }).id);
      if (change.type === 'note.save') { const payload = change.payload as { recipeId: string; note: string }; await cloud.saveNote(payload.recipeId, payload.note); }
      if (change.type === 'favorite.set') { const payload = change.payload as { recipeId: string; isFavorite: boolean }; await cloud.setFavorite(payload.recipeId, payload.isFavorite); }
      if (change.id !== undefined) await repo.removePending(change.id);
      synced += 1;
    } catch (error) {
      // A missing connection and server faults are retried later.  Authentication
      // errors also remain queued: the user may simply need to sign in again.
      if (error instanceof CloudError && error.status === 409 && change.type === 'recipe.create') {
        if (change.id !== undefined) await repo.removePending(change.id);
        synced += 1;
        continue;
      }
      break;
    }
  }
  return { synced, pending: (await repo.pending()).length };
}
