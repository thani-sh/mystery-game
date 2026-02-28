import { command } from '$app/server';
import { z } from 'zod';
import { generateTileset } from '$lib/server/generation';

/**
 * Generate image for a tileset
 */
export const generateTilesetImageCommand = command(z.string(), async (tilesetId) => {
	await generateTileset(tilesetId);
	return { success: true };
});
