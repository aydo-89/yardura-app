export interface CityData {
  name: string;
  displayName: string;
  state: string;
  population: number;
  description: string;
  zipCodes: string[];
  neighborhoods: string[];
  serviceAreas: string[];
  localBusiness: {
    name: string;
    address: string;
    phone: string;
    rating: number;
    reviewCount: number;
  };
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
}

export const CITY_DATA: Record<string, CityData> = {
  'minneapolis': {
    name: 'minneapolis',
    displayName: 'Minneapolis',
    state: 'MN',
    population: 430000,
    description: 'Minneapolis, the largest city in Minnesota and the heart of the Twin Cities metro area.',
    zipCodes: ['55401', '55402', '55403', '55404', '55405', '55406', '55407', '55408', '55409', '55410'],
    neighborhoods: ['Downtown Minneapolis', 'Uptown', 'Lowertown', 'North Loop', 'Warehouse District'],
    serviceAreas: ['Minneapolis', 'Golden Valley', 'St. Louis Park', 'Richfield', 'Bloomington'],
    localBusiness: {
      name: 'Yardura Minneapolis',
      address: 'Downtown Minneapolis, MN 55401',
      phone: '(612) 555-YARD',
      rating: 4.9,
      reviewCount: 247
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Minneapolis, MN | Yardura',
      description: 'Expert dog poop cleanup services in Minneapolis. Eco-friendly, reliable, and affordable. Serving Minneapolis and surrounding areas. Get your free quote today!',
      keywords: ['dog waste removal Minneapolis', 'poop scooping Minneapolis', 'dog cleanup services Minneapolis', 'eco friendly pet waste Minneapolis']
    }
  },
  'st-paul': {
    name: 'st-paul',
    displayName: 'St. Paul',
    state: 'MN',
    population: 310000,
    description: 'St. Paul, the capital city of Minnesota, known for its rich history and beautiful neighborhoods.',
    zipCodes: ['55101', '55102', '55103', '55104', '55105', '55106', '55107', '55108'],
    neighborhoods: ['Downtown St. Paul', 'Summit Hill', 'Lowertown', 'West Side', 'East Side'],
    serviceAreas: ['St. Paul', 'Roseville', 'Maplewood', 'White Bear Lake', 'Stillwater'],
    localBusiness: {
      name: 'Yardura St. Paul',
      address: 'Downtown St. Paul, MN 55101',
      phone: '(651) 555-YARD',
      rating: 4.8,
      reviewCount: 189
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in St. Paul, MN | Yardura',
      description: 'Expert dog poop cleanup services in St. Paul. Eco-friendly, reliable, and affordable. Serving St. Paul and surrounding areas. Get your free quote today!',
      keywords: ['dog waste removal St. Paul', 'poop scooping St. Paul', 'dog cleanup services St. Paul', 'eco friendly pet waste St. Paul']
    }
  },
  'bloomington': {
    name: 'bloomington',
    displayName: 'Bloomington',
    state: 'MN',
    population: 90000,
    description: 'Bloomington, home to the Mall of America and known for its suburban charm and family-friendly atmosphere.',
    zipCodes: ['55420', '55425', '55431', '55435', '55437', '55438'],
    neighborhoods: ['West Bloomington', 'East Bloomington', 'South Bloomington', 'North Bloomington'],
    serviceAreas: ['Bloomington', 'Richfield', 'Savage', 'Prior Lake', 'Shakopee'],
    localBusiness: {
      name: 'Yardura Bloomington',
      address: 'West Bloomington, MN 55431',
      phone: '(952) 555-YARD',
      rating: 4.9,
      reviewCount: 156
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Bloomington, MN | Yardura',
      description: 'Expert dog poop cleanup services in Bloomington. Eco-friendly, reliable, and affordable. Serving Bloomington and surrounding areas. Get your free quote today!',
      keywords: ['dog waste removal Bloomington', 'poop scooping Bloomington', 'dog cleanup services Bloomington', 'eco friendly pet waste Bloomington']
    }
  },
  'eden-prairie': {
    name: 'eden-prairie',
    displayName: 'Eden Prairie',
    state: 'MN',
    population: 65000,
    description: 'Eden Prairie, a thriving suburb known for its excellent schools, parks, and business community.',
    zipCodes: ['55344', '55346', '55347'],
    neighborhoods: ['Prairie Center', 'Eden Lake', 'Edenvale', 'Briarwood'],
    serviceAreas: ['Eden Prairie', 'Chanhassen', 'Shakopee', 'Chaska', 'Victoria'],
    localBusiness: {
      name: 'Yardura Eden Prairie',
      address: 'Prairie Center, MN 55344',
      phone: '(952) 555-YARD',
      rating: 4.8,
      reviewCount: 134
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Eden Prairie, MN | Yardura',
      description: 'Expert dog poop cleanup services in Eden Prairie. Eco-friendly, reliable, and affordable. Serving Eden Prairie and surrounding areas. Get your free quote today!',
      keywords: ['dog waste removal Eden Prairie', 'poop scooping Eden Prairie', 'dog cleanup services Eden Prairie', 'eco friendly pet waste Eden Prairie']
    }
  },
  'plymouth': {
    name: 'plymouth',
    displayName: 'Plymouth',
    state: 'MN',
    population: 80000,
    description: 'Plymouth, a vibrant suburb with excellent shopping, dining, and recreational opportunities.',
    zipCodes: ['55441', '55442', '55446', '55447'],
    neighborhoods: ['Downtown Plymouth', 'Plymouth Pointe', 'North Plymouth', 'South Plymouth'],
    serviceAreas: ['Plymouth', 'Wayzata', 'Minnetonka', 'Maple Grove', 'Medina'],
    localBusiness: {
      name: 'Yardura Plymouth',
      address: 'Downtown Plymouth, MN 55441',
      phone: '(763) 555-YARD',
      rating: 4.9,
      reviewCount: 178
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Plymouth, MN | Yardura',
      description: 'Expert dog poop cleanup services in Plymouth. Eco-friendly, reliable, and affordable. Serving Plymouth and surrounding areas. Get your free quote today!',
      keywords: ['dog waste removal Plymouth', 'poop scooping Plymouth', 'dog cleanup services Plymouth', 'eco friendly pet waste Plymouth']
    }
  },
  'woodbury': {
    name: 'woodbury',
    displayName: 'Woodbury',
    state: 'MN',
    population: 75000,
    description: 'Woodbury, a growing suburb known for its family-friendly atmosphere and excellent schools.',
    zipCodes: ['55125', '55129'],
    neighborhoods: ['Downtown Woodbury', 'Middleton', 'Valley Creek', 'Tartan'],
    serviceAreas: ['Woodbury', 'Oakdale', 'Maplewood', 'Cottage Grove', 'Lake Elmo'],
    localBusiness: {
      name: 'Yardura Woodbury',
      address: 'Downtown Woodbury, MN 55125',
      phone: '(651) 555-YARD',
      rating: 4.8,
      reviewCount: 142
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Woodbury, MN | Yardura',
      description: 'Expert dog poop cleanup services in Woodbury. Eco-friendly, reliable, and affordable. Serving Woodbury and surrounding areas. Get your free quote today!',
      keywords: ['dog waste removal Woodbury', 'poop scooping Woodbury', 'dog cleanup services Woodbury', 'eco friendly pet waste Woodbury']
    }
  },
  'edina': {
    name: 'edina',
    displayName: 'Edina',
    state: 'MN',
    population: 53000,
    description: 'Edina, an affluent suburb known for its excellent schools, parks, and high quality of life.',
    zipCodes: ['55435', '55436', '55439'],
    neighborhoods: ['Southdale', 'Morningside', 'Countryside', 'Interlachen'],
    serviceAreas: ['Edina', 'Hopkins', 'Minnetonka', 'Wayzata', 'Deephaven'],
    localBusiness: {
      name: 'Yardura Edina',
      address: 'Southdale Edina, MN 55435',
      phone: '(952) 555-YARD',
      rating: 4.9,
      reviewCount: 203
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Edina, MN | Yardura',
      description: 'Expert dog poop cleanup services in Edina. Eco-friendly, reliable, and affordable. Serving Edina and surrounding areas. Get your free quote today!',
      keywords: ['dog waste removal Edina', 'poop scooping Edina', 'dog cleanup services Edina', 'eco friendly pet waste Edina']
    }
  },
  'richfield': {
    name: 'richfield',
    displayName: 'Richfield',
    state: 'MN',
    population: 38000,
    description: 'Richfield, a vibrant community with diverse neighborhoods and excellent access to downtown Minneapolis.',
    zipCodes: ['55423'],
    neighborhoods: ['West Richfield', 'East Richfield', 'South Richfield', 'Lyric'],
    serviceAreas: ['Richfield', 'Bloomington', 'Minneapolis', 'Fort Snelling', 'Mendota Heights'],
    localBusiness: {
      name: 'Yardura Richfield',
      address: 'West Richfield, MN 55423',
      phone: '(612) 555-YARD',
      rating: 4.8,
      reviewCount: 167
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Richfield, MN | Yardura',
      description: 'Expert dog poop cleanup services in Richfield. Eco-friendly, reliable, and affordable. Serving Richfield and surrounding areas. Get your free quote today!',
      keywords: ['dog waste removal Richfield', 'poop scooping Richfield', 'dog cleanup services Richfield', 'eco friendly pet waste Richfield']
    }
  }
};

export const getCityData = (citySlug: string): CityData | null => {
  return CITY_DATA[citySlug] || null;
};

export const getAllCities = (): CityData[] => {
  return Object.values(CITY_DATA);
};

export const getCitySlugs = (): string[] => {
  return Object.keys(CITY_DATA);
};
