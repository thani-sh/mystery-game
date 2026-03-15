import { error } from '@sveltejs/kit';
import { getLevelJson, updateLevelJson, getActors } from '$lib/server/filesystem';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const levelId = params.levelId;
	if (!levelId) throw error(404, 'Level ID required');

    // Get actors for NPC selection dropdown
    const actors = await getActors();

	const jsonContent = await getLevelJson(levelId);
	let levelData = null;
	if (jsonContent) {
		try {
			levelData = JSON.parse(jsonContent);
		} catch (e) {
			console.error('Failed to parse level JSON', e);
		}
	} else {
        // Default level data if not created yet
        levelData = {
            id: levelId,
            width: 20,
            height: 20,
            background: `/assets/levels/${levelId}.webp`,
            characters: [],
            playerStart: { x: 0, y: 0 },
            collisions: []
        };
    }

	return {
		levelId,
		levelData,
        actors
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const levelId = params.levelId;
		if (!levelId) throw error(400, 'Level ID required');

		const data = await request.formData();
		const jsonData = data.get('levelData') as string;
		if (!jsonData) throw error(400, 'Missing levelData');

		try {
			// Validate it's proper JSON before saving
			JSON.parse(jsonData);
			await updateLevelJson(levelId, jsonData);
			return { success: true };
		} catch (err) {
            console.error(err);
			throw error(400, 'Invalid JSON data');
		}
	}
};
