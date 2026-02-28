import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

const ai = env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }) : null;

export type AspectRatio = '16:9' | '3:4' | '1:1';

export interface GenerateImageOptions {
	prompt: string;
	referenceImages?: Buffer[]; // Optional multiple reference images
	aspectRatio?: AspectRatio; // Aspect ratio for the generated image
	systemInstruction?: string; // Optional system instruction
}

/**
 * Generate text using Gemini Flash
 */
export async function generateText(
	prompt: string,
	systemInstruction?: string
): Promise<string | null> {
	if (!ai) {
		throw new Error('Gemini API key not configured');
	}

	try {
		const config: any = {};
		if (systemInstruction) {
			config.systemInstruction = systemInstruction;
		}

		const response = await ai.models.generateContent({
			model: 'gemini-3.1-pro-preview',
			contents: [{ text: prompt }],
			config
		});

		const candidates = response.candidates;
		if (!candidates || candidates.length === 0) {
			return null;
		}

		const firstCandidate = candidates[0];
		if (!firstCandidate.content || !firstCandidate.content.parts) {
			return null;
		}

		// Extract text from response
		for (const part of firstCandidate.content.parts) {
			if (part.text) {
				return part.text;
			}
		}

		return null;
	} catch (error) {
		console.error('Error generating text:', error);
		throw error;
	}
}

/**
 * Generate an image using Gemini
 */
export async function generateImage(
	options: GenerateImageOptions
): Promise<{ data: Buffer; mimeType: string } | null> {
	if (!ai) {
		throw new Error('Gemini API key not configured');
	}

	try {
		// Build content parts
		const contentParts: any[] = [{ text: options.prompt }];

		// Add reference images if provided
		if (options.referenceImages && options.referenceImages.length > 0) {
			for (const refImage of options.referenceImages) {
				// Detect mime type based on buffer header
				let mimeType = 'image/png';
				if (refImage[0] === 0xff && refImage[1] === 0xd8) {
					mimeType = 'image/jpeg';
				}

				contentParts.push({
					inlineData: {
						data: refImage.toString('base64'),
						mimeType
					}
				});
			}
		}

		// Build config with aspect ratio if provided
		const config: any = {
			responseModalities: ['image']
		};

		if (options.aspectRatio) {
			config.imageGenerationConfig = {
				aspectRatio: options.aspectRatio
			};
		}

		if (options.systemInstruction) {
			config.systemInstruction = options.systemInstruction;
		}

		const response = await ai.models.generateContent({
			model: 'gemini-3.1-flash-image-preview',
			contents: contentParts,
			config
		});

		// Extract image data from response
		const candidates = response.candidates;
		if (!candidates || candidates.length === 0) {
			return null;
		}

		const firstCandidate = candidates[0];
		if (!firstCandidate.content || !firstCandidate.content.parts) {
			return null;
		}

		// Find the image part
		for (const part of firstCandidate.content.parts) {
			if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
				const base64Data = part.inlineData.data;
				if (!base64Data) continue;
				const buffer = Buffer.from(base64Data, 'base64');
				return {
					data: buffer,
					mimeType: part.inlineData.mimeType
				};
			}
		}

		return null;
	} catch (error) {
		console.error('Error generating image:', error);
		throw error;
	}
}

/**
 * Build a prompt for concept art generation
 */
export function buildConceptPrompt(
	systemPrompt: string,
	characterDescription: string
): { systemInstruction: string; prompt: string } {
	return {
		systemInstruction: systemPrompt,
		prompt: `Character Description:\n${characterDescription}`
	};
}

/**
 * Build a prompt for portrait generation
 */
export async function buildPortraitPrompt(
	systemPrompt: string,
	characterDescription: string,
	extraInstructions?: string
): Promise<{ systemInstruction: string; prompt: string }> {
	// Load base portrait guidelines
	const fs = await import('fs/promises');
	const path = await import('path');
	const PROMPTS_DIR = path.resolve(process.cwd(), '../../docs/spec/prompts');

	let basePortraitInstructions = '';
	try {
		basePortraitInstructions = await fs.readFile(
			path.join(PROMPTS_DIR, 'base-portrait.prompt.md'),
			'utf-8'
		);
	} catch (error) {
		console.warn('Could not load base-portrait.prompt.md, continuing without it');
	}

	return {
		systemInstruction: `${systemPrompt}\n\n${basePortraitInstructions}`,
		prompt: `Character Description:\n${characterDescription}${extraInstructions ? `\n\n${extraInstructions}` : ''}`
	};
}

/**
 * Build a prompt for spritesheet generation
 */
export async function buildSpritesheetPrompt(
	systemPrompt: string,
	characterDescription: string,
	extraInstructions?: string
): Promise<{ systemInstruction: string; prompt: string }> {
	// Load base spritesheet guidelines
	const fs = await import('fs/promises');
	const path = await import('path');
	const PROMPTS_DIR = path.resolve(process.cwd(), '../../docs/spec/prompts');

	let baseSpritesheetInstructions = '';
	try {
		baseSpritesheetInstructions = await fs.readFile(
			path.join(PROMPTS_DIR, 'base-spritesheet.prompt.md'),
			'utf-8'
		);
	} catch (error) {
		console.warn('Could not load base-spritesheet.prompt.md, continuing without it');
	}

	return {
		systemInstruction: `${systemPrompt}\n\n${baseSpritesheetInstructions}`,
		prompt: `Character Description:\n${characterDescription}${extraInstructions ? `\n\n${extraInstructions}` : ''}`
	};
}
