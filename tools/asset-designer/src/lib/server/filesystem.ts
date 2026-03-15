import fs from 'fs/promises';
import path from 'path';
import { processAndCopyAsset } from './processing';

const SPEC_DIR = path.resolve(process.cwd(), '../../docs/spec');
const PROMPTS_DIR = path.join(SPEC_DIR, 'prompts');
const ACTORS_DIR = path.join(SPEC_DIR, 'actors');

const ASSETS_DIR = path.resolve(process.cwd(), '../../assets');



export interface Actor {
	id: string;
	name: string;
	description: string;
	content: string;
}



export interface SpecFile {
	id: string;
	name: string;
	content: string;
}

/**
 * Get system prompt from file
 */
export async function getSystemPrompt(): Promise<string> {
	const filePath = path.join(PROMPTS_DIR, 'system.prompt.md');
	const content = await fs.readFile(filePath, 'utf-8');
	return content;
}

/**
 * Get a specific prompt by filename
 */
export async function getPrompt(name: string): Promise<string | null> {
	try {
		const filePath = path.join(PROMPTS_DIR, name);
		const content = await fs.readFile(filePath, 'utf-8');
		return content;
	} catch (error) {
		return null;
	}
}

/**
 * Get concept art reference images
 */
export async function getConceptArtImages(): Promise<Buffer[]> {
	const images: Buffer[] = [];

	try {
		const mainCastPath = path.join(ASSETS_DIR, 'main-cast-concept-image.jpeg');
		const mainCastImage = await fs.readFile(mainCastPath);
		images.push(mainCastImage);
	} catch (error) {
		console.warn('Could not load main-cast-concept-image.jpeg');
	}

	try {
		const recurringPath = path.join(ASSETS_DIR, 'recurring-concept-image.jpeg');
		const recurringImage = await fs.readFile(recurringPath);
		images.push(recurringImage);
	} catch (error) {
		console.warn('Could not load recurring-concept-image.jpeg');
	}

	return images;
}

/**
 * Get all actors
 */
export async function getActors(): Promise<Actor[]> {
	const files = await fs.readdir(ACTORS_DIR);
	const actors: Actor[] = [];

	for (const file of files) {
		if (!file.endsWith('.md')) continue;

		const filePath = path.join(ACTORS_DIR, file);
		const content = await fs.readFile(filePath, 'utf-8');
		const id = file.replace('.md', '');
		actors.push({
			id,
			name: id.replace(/-/g, ' '),
			description: '',
			content
		});
	}

	return actors;
}

/**
 * Get a specific actor
 */
export async function getActor(id: string): Promise<Actor | null> {
	try {
		const filePath = path.join(ACTORS_DIR, `${id}.md`);
		const content = await fs.readFile(filePath, 'utf-8');
		return {
			id,
			name: id.replace(/-/g, ' '),
			description: '',
			content
		};
	} catch (error) {
		return null;
	}
}

/**
 * Update an actor
 */
export async function updateActor(id: string, content: string): Promise<void> {
	const filePath = path.join(ACTORS_DIR, `${id}.md`);
	await fs.writeFile(filePath, content, 'utf-8');
}



/**
 * Get actor concept image path
 */
function getActorConceptPath(actorId: string): string {
	return path.join(ASSETS_DIR, 'actors', actorId, 'concept.png');
}

/**
 * Check if actor has a concept
 */
export async function hasActorConcept(actorId: string): Promise<boolean> {
	try {
		const conceptPath = getActorConceptPath(actorId);
		await fs.access(conceptPath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Save actor concept image
 */
export async function saveActorConcept(actorId: string, imageData: Buffer): Promise<void> {
	const conceptPath = getActorConceptPath(actorId);
	const dir = path.dirname(conceptPath);

	// Create directory if it doesn't exist
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(conceptPath, imageData);

	// Process and copy
	await processAndCopyAsset(conceptPath);
}

/**
 * Get actor concept as base64 data URL
 */
export async function getActorConceptDataUrl(actorId: string): Promise<string | null> {
	try {
		const conceptPath = getActorConceptPath(actorId);
		const imageBuffer = await fs.readFile(conceptPath);
		const base64 = imageBuffer.toString('base64');
		return `data:image/png;base64,${base64}`;
	} catch {
		return null;
	}
}

/**
 * Get actor speech portrait path
 */
function getActorSpeechPath(actorId: string, expressionType: string): string {
	return path.join(ASSETS_DIR, 'actors', actorId, 'speech', `${expressionType}.png`);
}

/**
 * Check if actor has a speech portrait
 */
export async function hasActorSpeech(actorId: string, expressionType: string): Promise<boolean> {
	try {
		const speechPath = getActorSpeechPath(actorId, expressionType);
		await fs.access(speechPath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Save actor speech portrait image
 */
export async function saveActorSpeech(
	actorId: string,
	expressionType: string,
	imageData: Buffer
): Promise<void> {
	const speechPath = getActorSpeechPath(actorId, expressionType);
	const dir = path.dirname(speechPath);

	// Create directory if it doesn't exist
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(speechPath, imageData);

	// Process and copy
	await processAndCopyAsset(speechPath);
}

/**
 * Get actor speech portrait as base64 data URL
 */
export async function getActorSpeechDataUrl(
	actorId: string,
	expressionType: string
): Promise<string | null> {
	try {
		const speechPath = getActorSpeechPath(actorId, expressionType);
		const imageBuffer = await fs.readFile(speechPath);
		const base64 = imageBuffer.toString('base64');
		return `data:image/png;base64,${base64}`;
	} catch {
		return null;
	}
}

/**
 * Get actor frame image path
 */
function getActorFramePath(actorId: string, frameType: string): string {
	return path.join(ASSETS_DIR, 'actors', actorId, 'frames', `${frameType}.png`);
}

/**
 * Check if actor has a specific frame
 */
export async function hasActorFrame(actorId: string, frameType: string): Promise<boolean> {
	try {
		const framePath = getActorFramePath(actorId, frameType);
		await fs.access(framePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Save actor frame image
 */
export async function saveActorFrame(
	actorId: string,
	frameType: string,
	imageData: Buffer
): Promise<void> {
	const framePath = getActorFramePath(actorId, frameType);
	const dir = path.dirname(framePath);

	// Create directory if it doesn't exist
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(framePath, imageData);

	// Process and copy
	await processAndCopyAsset(framePath);
}

/**
 * Get actor frame as base64 data URL
 */
export async function getActorFrameDataUrl(
	actorId: string,
	frameType: string
): Promise<string | null> {
	try {
		const framePath = getActorFramePath(actorId, frameType);
		const imageBuffer = await fs.readFile(framePath);
		const base64 = imageBuffer.toString('base64');
		return `data:image/png;base64,${base64}`;
	} catch {
		return null;
	}
}

/**
 * Get all levels
 */
export async function getLevels(): Promise<string[]> {
	const levelsDir = path.join(ASSETS_DIR, 'levels');
	try {
		const files = await fs.readdir(levelsDir);
		return files
			.filter(f => f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg'))
			.map(f => f.replace(/\.[^/.]+$/, ''));
	} catch {
		return [];
	}
}

/**
 * Get level JSON data
 */
export async function getLevelJson(id: string): Promise<string | null> {
	try {
		const filePath = path.join(ASSETS_DIR, 'levels', `${id}.json`);
		const content = await fs.readFile(filePath, 'utf-8');
		return content;
	} catch {
		return null;
	}
}

/**
 * Update level JSON data
 */
export async function updateLevelJson(id: string, content: string): Promise<void> {
	const filePath = path.join(ASSETS_DIR, 'levels', `${id}.json`);
	await fs.writeFile(filePath, content, 'utf-8');
}
