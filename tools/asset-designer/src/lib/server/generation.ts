/**
 * Shared generation utilities for portraits and spritesheets
 */
import fs from 'fs/promises';
import path from 'path';
import {
	getActor,
	getSystemPrompt,
	getPrompt,
	getConceptArtImages,
	saveActorSpeech,
	saveActorFrame,
	getTileset,
	saveTilesetImage
} from '$lib/server/filesystem';
import { generateImage, buildPortraitPrompt, buildSpritesheetPrompt, buildTilesetPrompt } from '$lib/server/gemini';

const ASSETS_DIR = path.resolve(process.cwd(), '../../assets');

/**
 * Generate a single portrait for an actor
 */
export async function generateActorPortrait(
	actorId: string,
	expressionType: string
): Promise<void> {
	const actor = await getActor(actorId);
	if (!actor) {
		throw new Error('Actor not found');
	}

	const systemPrompt = await getSystemPrompt();
	const extraInstructions =
		expressionType === 'talking' ? await getPrompt('talking-portrait.prompt.md') : undefined;
	const { systemInstruction, prompt: userPrompt } = await buildPortraitPrompt(
		systemPrompt,
		actor.content,
		extraInstructions ?? undefined
	);

	const referenceImages: Buffer[] = [];
	const conceptArtImages = await getConceptArtImages();
	referenceImages.push(...conceptArtImages);
	console.log(`Generating ${expressionType} portrait for actor: ${actorId}`);

	// Add actor's concept if it exists
	try {
		const conceptPath = path.join(ASSETS_DIR, 'actors', actorId, 'concept.png');
		const conceptImage = await fs.readFile(conceptPath);
		referenceImages.push(conceptImage);
	} catch {
		// Continue without actor concept
	}

	const result = await generateImage({
		prompt: userPrompt,
		systemInstruction,
		referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
		aspectRatio: '3:4'
	});

	if (!result) {
		throw new Error('Failed to generate portrait');
	}

	await saveActorSpeech(actorId, expressionType, result.data);
	console.log(`Done generating ${expressionType} portrait for actor: ${actorId}`);
}

/**
 * Generate a single spritesheet for an actor
 */
export async function generateActorSpritesheet(
	actorId: string,
	animationType: string
): Promise<void> {
	const actor = await getActor(actorId);
	if (!actor) {
		throw new Error('Actor not found');
	}

	const systemPrompt = await getSystemPrompt();
	const extraInstructions = await getPrompt(`${animationType}-spritesheet.prompt.md`);
	const { systemInstruction, prompt: userPrompt } = await buildSpritesheetPrompt(
		systemPrompt,
		actor.content,
		extraInstructions ?? undefined
	);

	const referenceImages: Buffer[] = [];
	const conceptArtImages = await getConceptArtImages();
	referenceImages.push(...conceptArtImages);
	console.log(`Generating ${animationType} spritesheet for actor: ${actorId}`);

	// Add actor's concept if it exists
	try {
		const conceptPath = path.join(ASSETS_DIR, 'actors', actorId, 'concept.png');
		const conceptImage = await fs.readFile(conceptPath);
		referenceImages.push(conceptImage);
	} catch {
		// Continue without actor concept
	}

	// Add idle spritesheet as reference for other animations
	if (animationType !== 'idle') {
		try {
			const idlePath = path.join(ASSETS_DIR, 'actors', actorId, 'frames', 'idle.png');
			const idleImage = await fs.readFile(idlePath);
			referenceImages.push(idleImage);
		} catch {
			console.warn(`Idle spritesheet not found for ${actorId}, continuing without it`);
		}

		// If generating a walk animation, also include the walk cycle reference wireframe
		if (animationType === 'walk') {
			try {
				const walkReferencePath = path.join(path.resolve(process.cwd(), '../../docs/spec/prompts'), 'walk_cycle_reference.png');
				const walkReferenceImage = await fs.readFile(walkReferencePath);
				referenceImages.push(walkReferenceImage);
			} catch {
				console.warn(`Walk cycle reference not found, continuing without it`);
			}
		}
	} else {
		// For idle animation, add Bets idle spritesheet as reference if available
		try {
			const betsIdlePath = path.join(ASSETS_DIR, 'actors', 'bets', 'frames', 'idle.png');
			const betsIdleImage = await fs.readFile(betsIdlePath);
			referenceImages.push(betsIdleImage);
		} catch {
			console.log(`Bets idle spritesheet not found, continuing without it`);
		}
	}

	const result = await generateImage({
		prompt: userPrompt,
		systemInstruction,
		referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
		aspectRatio: '1:1'
	});

	if (!result) {
		throw new Error('Failed to generate spritesheet');
	}

	await saveActorFrame(actorId, animationType, result.data);
	console.log(`Done generating ${animationType} spritesheet for actor: ${actorId}`);
}

/**
 * Generate a single tileset
 */
export async function generateTileset(
	tilesetId: string
): Promise<void> {
	const tileset = await getTileset(tilesetId);
	if (!tileset) {
		throw new Error('Tileset not found');
	}

	const systemPrompt = await getSystemPrompt();
	const { systemInstruction, prompt: userPrompt } = await buildTilesetPrompt(
		systemPrompt,
		tileset.content
	);

	const referenceImages: Buffer[] = [];
	const conceptArtImages = await getConceptArtImages();
	referenceImages.push(...conceptArtImages);
	console.log(`Generating tileset: ${tilesetId}`);

	const result = await generateImage({
		prompt: userPrompt,
		systemInstruction,
		referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
		aspectRatio: '1:1'
	});

	if (!result) {
		throw new Error('Failed to generate tileset');
	}

	await saveTilesetImage(tilesetId, result.data);
	console.log(`Done generating tileset: ${tilesetId}`);
}
