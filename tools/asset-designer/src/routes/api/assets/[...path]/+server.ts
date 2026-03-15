import { error } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';
import type { RequestHandler } from './$types';

const ASSETS_DIR = path.resolve(process.cwd(), '../../assets');

export const GET: RequestHandler = async ({ params }) => {
	const assetPath = params.path;
	if (!assetPath) throw error(400, 'Path is required');

	try {
		const fullPath = path.join(ASSETS_DIR, assetPath);

		// Prevent path traversal
		if (!fullPath.startsWith(ASSETS_DIR)) {
			throw error(403, 'Forbidden');
		}

		const data = await fs.readFile(fullPath);

		let contentType = 'application/octet-stream';
		if (fullPath.endsWith('.webp')) contentType = 'image/webp';
		else if (fullPath.endsWith('.png')) contentType = 'image/png';
		else if (fullPath.endsWith('.jpg') || fullPath.endsWith('.jpeg')) contentType = 'image/jpeg';
		else if (fullPath.endsWith('.json')) contentType = 'application/json';

		return new Response(data, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (err) {
		throw error(404, 'Asset not found');
	}
};
