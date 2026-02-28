import { getTileset, getTilesetImageDataUrl } from '$lib/server/filesystem';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const tileset = await getTileset(params.tilesetId);

	if (!tileset) {
		throw error(404, 'Tileset not found');
	}

	const imageUrl = await getTilesetImageDataUrl(params.tilesetId);

	return {
		tileset,
		imageUrl
	};
}
