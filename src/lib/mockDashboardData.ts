export function generateMockDashboardData() {
  const now = new Date();
  const dogs = [
    {
      id: "dog_1",
      name: "Bella",
      breed: "Golden Retriever",
      age: 4,
      weight: 65,
    },
    { id: "dog_2", name: "Max", breed: "Labrador", age: 6, weight: 70 },
  ];

  const serviceVisits = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    return {
      id: `visit_${i}`,
      scheduledDate: d.toISOString(),
      status: i === 0 ? "SCHEDULED" : "COMPLETED",
      serviceType: "WEEKLY_CLEAN",
      yardSize: i % 2 === 0 ? "medium" : "large",
    };
  });

  const dataReadings: Array<{
    id: string;
    timestamp: string;
    weight: number;
    volume: number;
    color: string;
    consistency: string;
  }> = [];

  // Generate realistic volume: ~14 deposits per dog each week over 8 weeks
  const weeks = 8;
  const normalColors = ["brown", "tan"];

  // Create mostly normal scenarios with just a few minor abnormalities
  const weekScenarios = [
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 0: Normal - all good
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 1: Normal - all good
    { color: "normal", consistency: "soft", alertType: "soft" }, // Week 2: Minor soft consistency (just monitor)
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 3: Normal - all good
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 4: Normal - all good
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 5: Normal - all good
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 6: Normal - all good
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 7: Normal - all good
  ];

  for (let week = 0; week < weeks; week++) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - week * 7);

    dogs.forEach((dog, dogIndex) => {
      const depositsPerWeek = 14 + Math.floor(Math.random() * 4) - 2; // 12-16 deposits per dog per week

      for (let deposit = 0; deposit < depositsPerWeek; deposit++) {
        const depositTime = new Date(weekDate);
        depositTime.setHours(6 + Math.floor(Math.random() * 16)); // 6 AM to 10 PM
        depositTime.setMinutes(Math.floor(Math.random() * 60));

        const scenario = weekScenarios[week];
        let weight = dog.weight * 0.02 + Math.random() * 0.01; // ~2% of body weight
        let volume = weight * 1000; // Convert to grams/ml
        const color =
          scenario.color === "normal"
            ? normalColors[Math.floor(Math.random() * normalColors.length)]
            : scenario.color;
        const consistency = scenario.consistency;

        // Add some natural variation
        weight *= 0.8 + Math.random() * 0.4; // ±20% variation
        volume = weight * 1000;

        dataReadings1.push({
          id: `reading_${week}_${dogIndex}_${deposit}`,
          timestamp: depositTime.toISOString(),
          weight: Math.round(weight * 100) / 100,
          volume: Math.round(volume),
          color,
          consistency,
        });
      }
    });
  }

  const user = {
    id: "mock_user_1",
    name: "Alex Johnson",
    email: "alex@example.com",
    phone: "+1 (555) 010-1234",
    address: "1234 15th Ave S",
    city: "Minneapolis",
    zipCode: "55417",
    stripeCustomerId: "cus_mock_123",
    orgId: "org_demo",
  } as const;

  // Generate realistic volume: ~14 deposits per dog each week over 8 weeks
  const dataReadings1: Array<{
    id: string;
    timestamp: string;
    weight: number;
    volume: number;
    color: string;
    consistency: string;
  }> = [];

  // Create mostly normal scenarios with just a few minor abnormalities
  const weekScenarios1 = [
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 0: Normal - all good
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 1: Normal - all good
    { color: "normal", consistency: "soft", alertType: "soft" }, // Week 2: Minor soft consistency (just monitor)
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 3: Normal - all good
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 4: Normal - all good
    { color: "yellow", consistency: "normal", alertType: "color" }, // Week 5: Slight yellow tint (monitor)
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 6: Normal - all good
    { color: "normal", consistency: "normal", alertType: "none" }, // Week 7: Normal - all good
  ];

  for (let w = 0; w < weeks; w++) {
    for (let di = 0; di < dogs.length; di++) {
      const perWeek = 12 + Math.floor(Math.random() * 6); // 12-17 per dog/week
      const scenario = weekScenarios[w];

      for (let r = 0; r < perWeek; r++) {
        const d = new Date(now);
        // spread readings within the week at reasonable daytime hours
        d.setDate(d.getDate() - w * 7 - Math.floor(Math.random() * 7));
        d.setHours(
          7 + Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 60),
          0,
          0,
        );

        // Use scenario-based distribution with some randomization
        let color = scenario.color;
        let consistency = scenario.consistency;

        // Add some variation - not all readings should be the alert type
        const variationRoll = Math.random();
        if (variationRoll < 0.3) {
          // 30% chance of normal variation
          color = normalColors[Math.floor(Math.random() * normalColors.length)];
          consistency = "firm";
        } else if (variationRoll < 0.5) {
          // 20% chance of partial alert
          if (scenario.alertType === "soft") consistency = "soft";
          if (scenario.alertType === "color") color = scenario.color;
          if (scenario.alertType === "parasite") {
            consistency = r % 2 === 0 ? "mucous" : "greasy";
          }
        }

        dataReadings1.push({
          id: `reading_${w}_${di}_${r}`,
          timestamp: d.toISOString(),
          weight: Math.round(120 + Math.random() * 180),
          volume: 1,
          color,
          consistency,
        });
      }
    }
  }

  return { user, dogs, serviceVisits, dataReadings: dataReadings1 };
}

// Mostly normal dataset: all normal readings except one soft week
export function generateMockDashboardDataNormal() {
  const now = new Date();
  const user = {
    id: "mock_user_normal_1",
    name: "Jordan Smith",
    email: "jordan@example.com",
    phone: "+1 (555) 010-4567",
    address: "742 Evergreen Terrace",
    city: "Springfield",
    zipCode: "62704",
    stripeCustomerId: "cus_mock_456",
    orgId: "org_demo",
  } as const;

  const dogs = [
    {
      id: "dog_norm_1",
      name: "Luna",
      breed: "Border Collie",
      age: 5,
      weight: 42,
    },
  ];

  // 8 weekly visits, last is scheduled
  const serviceVisits = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    return {
      id: `visit_norm_${i}`,
      scheduledDate: d.toISOString(),
      status: i === 0 ? "SCHEDULED" : "COMPLETED",
      serviceType: "WEEKLY_CLEAN",
      yardSize: "medium",
    };
  });

  // Build readings: ~14 per week, almost all normal; a single soft week as a warning only
  const weeks = 8;
  const normalColors = ["brown", "tan"];
  const dataReadings: Array<{
    id: string;
    timestamp: string;
    weight: number;
    volume: number;
    color: string;
    consistency: string;
  }> = [];
  const softWeek = 3; // ~3 weeks ago
  for (let w = 0; w < weeks; w++) {
    // Ensure at least 1 reading every week so deposits aren't zero when weight/moisture exist
    const perWeek = Math.max(1, 13 + Math.floor(Math.random() * 3)); // 13-15/week
    for (let r = 0; r < perWeek; r++) {
      const d = new Date(now);
      d.setDate(d.getDate() - w * 7 - Math.floor(Math.random() * 7));
      d.setHours(
        7 + Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 60),
        0,
        0,
      );
      const isSoft = w === softWeek && r < 3; // a few soft that week
      dataReadings.push({
        id: `reading_norm_${w}_${r}`,
        timestamp: d.toISOString(),
        weight: Math.round(120 + (r % 5) * 20),
        volume: 1,
        color: normalColors[(w + r) % normalColors.length],
        consistency: isSoft ? "soft" : "firm",
      });
    }
  }

  return { user, dogs, serviceVisits, dataReadings };
}
