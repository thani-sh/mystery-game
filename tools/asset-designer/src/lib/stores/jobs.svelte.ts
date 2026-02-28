import { browser } from '$app/environment';

export type JobStatus = 'running' | 'success' | 'error';

export interface Job {
	id: string;
	title: string;
	status: JobStatus;
	message?: string;
	createdAt: number;
}

const STORAGE_KEY = 'asset-designer-jobs';

function createJobsStore() {
	let jobs = $state<Job[]>([]);

	// Initialize from local storage if in browser
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored) as Job[];
				// Any jobs that were running when the page was closed should be marked as error
				jobs = parsed.map((job) => {
					if (job.status === 'running') {
						return { ...job, status: 'error', message: 'Job was interrupted' };
					}
					return job;
				});
			} catch (e) {
				console.error('Failed to parse jobs from local storage', e);
			}
		}
	}

	// Persist to local storage whenever jobs change
	$effect.root(() => {
		$effect(() => {
			if (browser) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
			}
		});
	});

	return {
		get jobs() {
			return jobs;
		},
		get activeJobsCount() {
			return jobs.filter((j) => j.status === 'running').length;
		},
		add(title: string): string {
			const id = crypto.randomUUID();
			jobs = [
				{
					id,
					title,
					status: 'running',
					createdAt: Date.now()
				},
				...jobs
			];
			return id;
		},
		update(id: string, status: JobStatus, message?: string) {
			jobs = jobs.map((job) =>
				job.id === id ? { ...job, status, message: message || job.message } : job
			);
		},
		clearPast() {
			jobs = jobs.filter((job) => job.status === 'running');
		},
		clearAll() {
			jobs = [];
		}
	};
}

export const jobsStore = createJobsStore();
