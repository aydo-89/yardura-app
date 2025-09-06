export function generateMockDashboardData() {
	const now = new Date();
	const user = {
		id: 'mock_user_1',
		name: 'Alex Johnson',
		email: 'alex@example.com',
		phone: '+1 (555) 010-1234',
		address: '1234 15th Ave S',
		city: 'Minneapolis',
		zipCode: '55417',
		stripeCustomerId: 'cus_mock_123',
		orgId: 'org_demo',
	} as const;

	const dogs = [
		{ id: 'dog_1', name: 'Bella', breed: 'Golden Retriever', age: 4, weight: 65 },
		{ id: 'dog_2', name: 'Max', breed: 'Labrador', age: 6, weight: 70 },
	];

	const serviceVisits = Array.from({ length: 6 }).map((_, i) => {
		const d = new Date(now);
		d.setDate(d.getDate() - i * 7);
		return {
			id: `visit_${i}`,
			scheduledDate: d.toISOString(),
			status: i === 0 ? 'SCHEDULED' : 'COMPLETED',
			serviceType: 'WEEKLY_CLEAN',
			yardSize: i % 2 === 0 ? 'medium' : 'large',
		};
	});

	const colors = ['brown', 'tan', 'yellow', 'green', 'black', 'red'];
	const consistencies = ['firm', 'soft', 'loose', 'mucous', 'greasy'];

	const dataReadings = Array.from({ length: 24 }).map((_, i) => {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		return {
			id: `reading_${i}`,
			timestamp: d.toISOString(),
			weight: Math.round(120 + Math.random() * 180),
			volume: Math.round(1 + Math.random() * 3),
			color: colors[Math.floor(Math.random() * colors.length)],
			consistency: consistencies[Math.floor(Math.random() * consistencies.length)],
		};
	});

	return { user, dogs, serviceVisits, dataReadings };
}