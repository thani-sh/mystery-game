import { getLevels } from '$lib/server/filesystem';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const levels = await getLevels();
	return { levels };
};
