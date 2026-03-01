import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncAllAssets } from '$lib/server/processing';

export const POST: RequestHandler = async () => {
	try {
		await syncAllAssets();
		return json({ success: true });
	} catch (error) {
		console.error('Error syncing assets:', error);
		return json({ success: false, error: String(error) }, { status: 500 });
	}
};
