import { getTilesets, hasTilesetImage } from '$lib/server/filesystem';

export async function load() {
	const tilesets = await getTilesets();

	// Check which tilesets have images generated
	const tilesetsWithImages = await Promise.all(
		tilesets.map(async (tileset) => {
			const hasImage = await hasTilesetImage(tileset.id);
			return { ...tileset, hasImage };
		})
	);

	return {
		tilesets: tilesetsWithImages
	};
}
