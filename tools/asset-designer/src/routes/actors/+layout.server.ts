import { getActors, hasActorConcept, getActorConceptDataUrl } from '$lib/server/filesystem';

export async function load() {
	const actors = await getActors();

	// Check which actors have concepts and get their data URLs
	const actorsWithConcepts = await Promise.all(
		actors.map(async (actor) => ({
			...actor,
			hasConcept: await hasActorConcept(actor.id),
			conceptDataUrl: await getActorConceptDataUrl(actor.id)
		}))
	);

	return {
		actors: actorsWithConcepts
	};
}
