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
    // rating: number; // TODO: Uncomment when we have real ratings
    // reviewCount: number; // TODO: Uncomment when we have real ratings
  };
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
}

export const CITY_DATA: Record<string, CityData> = {
  minneapolis: {
    name: 'minneapolis',
    displayName: 'Minneapolis',
    state: 'MN',
    population: 430000,
    description:
      'Minneapolis, the largest city in Minnesota and the heart of the Twin Cities metro area.',
    zipCodes: [
      '55401',
      '55402',
      '55403',
      '55404',
      '55405',
      '55406',
      '55407',
      '55408',
      '55409',
      '55410',
      '55419', // South Minneapolis
      '55423', // Richfield area
    ],
    neighborhoods: [
      'Downtown Minneapolis',
      'Uptown',
      'Lowertown',
      'North Loop',
      'Warehouse District',
      'South Minneapolis',
    ],
    serviceAreas: ['Minneapolis', 'South Minneapolis', 'Richfield', 'Bloomington'],
    localBusiness: {
      name: 'Yardura Minneapolis',
      address: 'Downtown Minneapolis, MN 55401',
      phone: '(888) 915-YARD',
      // rating: 4.9, // TODO: Uncomment when we have real ratings
      // reviewCount: 247, // TODO: Uncomment when we have real ratings
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Minneapolis, MN | Yardura',
      description:
        'Expert dog poop cleanup services in Minneapolis. Eco-friendly, reliable, and affordable. Serving Minneapolis and surrounding areas. Get your free quote today!',
      keywords: [
        'dog waste removal Minneapolis',
        'poop scooping Minneapolis',
        'dog cleanup services Minneapolis',
        'eco friendly pet waste Minneapolis',
      ],
    },
  },
  bloomington: {
    name: 'bloomington',
    displayName: 'Bloomington',
    state: 'MN',
    population: 90000,
    description:
      'Bloomington, home to the Mall of America and known for its suburban charm and family-friendly atmosphere.',
    zipCodes: ['55420', '55425', '55431', '55435', '55437', '55438'],
    neighborhoods: [
      'West Bloomington',
      'East Bloomington',
      'South Bloomington',
      'North Bloomington',
    ],
    serviceAreas: ['Bloomington', 'Richfield', 'Edina'],
    localBusiness: {
      name: 'Yardura Bloomington',
      address: 'West Bloomington, MN 55431',
      phone: '(888) 915-YARD',
      // rating: 4.9, // TODO: Uncomment when we have real ratings
      // reviewCount: 156, // TODO: Uncomment when we have real ratings
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Bloomington, MN | Yardura',
      description:
        'Expert dog poop cleanup services in Bloomington. Eco-friendly, reliable, and affordable. Serving Bloomington and surrounding areas. Get your free quote today!',
      keywords: [
        'dog waste removal Bloomington',
        'poop scooping Bloomington',
        'dog cleanup services Bloomington',
        'eco friendly pet waste Bloomington',
      ],
    },
  },
  edina: {
    name: 'edina',
    displayName: 'Edina',
    state: 'MN',
    population: 53000,
    description:
      'Edina, an affluent suburb known for its excellent schools, parks, and high quality of life.',
    zipCodes: ['55435', '55436', '55439'],
    neighborhoods: ['Southdale', 'Morningside', 'Countryside', 'Interlachen'],
    serviceAreas: ['Edina', 'Bloomington', 'Hopkins'],
    localBusiness: {
      name: 'Yardura Edina',
      address: 'Southdale Edina, MN 55435',
      phone: '(888) 915-YARD',
      // rating: 4.9, // TODO: Uncomment when we have real ratings
      // reviewCount: 203, // TODO: Uncomment when we have real ratings
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Edina, MN | Yardura',
      description:
        'Expert dog poop cleanup services in Edina. Eco-friendly, reliable, and affordable. Serving Edina and surrounding areas. Get your free quote today!',
      keywords: [
        'dog waste removal Edina',
        'poop scooping Edina',
        'dog cleanup services Edina',
        'eco friendly pet waste Edina',
      ],
    },
  },
  richfield: {
    name: 'richfield',
    displayName: 'Richfield',
    state: 'MN',
    population: 38000,
    description:
      'Richfield, a vibrant community with diverse neighborhoods and excellent access to downtown Minneapolis.',
    zipCodes: ['55423'],
    neighborhoods: ['West Richfield', 'East Richfield', 'South Richfield', 'Lyric'],
    serviceAreas: ['Richfield', 'Bloomington', 'Minneapolis'],
    localBusiness: {
      name: 'Yardura Richfield',
      address: 'West Richfield, MN 55423',
      phone: '(888) 915-YARD',
      // rating: 4.8, // TODO: Uncomment when we have real ratings
      // reviewCount: 167, // TODO: Uncomment when we have real ratings
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Richfield, MN | Yardura',
      description:
        'Expert dog poop cleanup services in Richfield. Eco-friendly, reliable, and affordable. Serving Richfield and surrounding areas. Get your free quote today!',
      keywords: [
        'dog waste removal Richfield',
        'poop scooping Richfield',
        'dog cleanup services Richfield',
        'eco friendly pet waste Richfield',
      ],
    },
  },
  eagan: {
    name: 'eagan',
    displayName: 'Eagan',
    state: 'MN',
    population: 68000,
    description:
      'Eagan, a thriving suburb in the Twin Cities South metro area known for its excellent schools and family-friendly communities.',
    zipCodes: ['55120', '55121', '55122', '55123'],
    neighborhoods: ['Northview', 'Rahncliff', 'Thomas Lake', 'Wescott', 'Southview'],
    serviceAreas: ['Eagan', 'Apple Valley', 'Burnsville', 'Rosemount'],
    localBusiness: {
      name: 'Yardura Eagan',
      address: 'Northview Eagan, MN 55121',
      phone: '(888) 915-YARD',
      // rating: 4.8, // TODO: Uncomment when we have real ratings
      // reviewCount: 124, // TODO: Uncomment when we have real ratings
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Eagan, MN | Yardura',
      description:
        'Expert dog poop cleanup services in Eagan. Eco-friendly, reliable, and affordable. Serving Eagan and surrounding areas. Get your free quote today!',
      keywords: [
        'dog waste removal Eagan',
        'poop scooping Eagan',
        'dog cleanup services Eagan',
        'eco friendly pet waste Eagan',
      ],
    },
  },
  'apple-valley': {
    name: 'apple-valley',
    displayName: 'Apple Valley',
    state: 'MN',
    population: 55000,
    description:
      'Apple Valley, a growing suburb known for its parks, schools, and convenient location in the Twin Cities South metro area.',
    zipCodes: ['55124'],
    neighborhoods: [
      'North Apple Valley',
      'South Apple Valley',
      'East Apple Valley',
      'West Apple Valley',
    ],
    serviceAreas: ['Apple Valley', 'Eagan', 'Burnsville', 'Lakeville'],
    localBusiness: {
      name: 'Yardura Apple Valley',
      address: 'North Apple Valley, MN 55124',
      phone: '(888) 915-YARD',
      // rating: 4.8, // TODO: Uncomment when we have real ratings
      // reviewCount: 98, // TODO: Uncomment when we have real ratings
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Apple Valley, MN | Yardura',
      description:
        'Expert dog poop cleanup services in Apple Valley. Eco-friendly, reliable, and affordable. Serving Apple Valley and surrounding areas. Get your free quote today!',
      keywords: [
        'dog waste removal Apple Valley',
        'poop scooping Apple Valley',
        'dog cleanup services Apple Valley',
        'eco friendly pet waste Apple Valley',
      ],
    },
  },
  lakeville: {
    name: 'lakeville',
    displayName: 'Lakeville',
    state: 'MN',
    population: 67000,
    description:
      'Lakeville, a family-friendly suburb known for its excellent schools, parks, and growing community along I-35.',
    zipCodes: ['55044'],
    neighborhoods: ['North Lakeville', 'South Lakeville', 'East Lakeville', 'West Lakeville'],
    serviceAreas: ['Lakeville', 'Burnsville', 'Apple Valley', 'Farmington'],
    localBusiness: {
      name: 'Yardura Lakeville',
      address: 'North Lakeville, MN 55044',
      phone: '(888) 915-YARD',
      // rating: 4.8, // TODO: Uncomment when we have real ratings
      // reviewCount: 112, // TODO: Uncomment when we have real ratings
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Lakeville, MN | Yardura',
      description:
        'Expert dog poop cleanup services in Lakeville. Eco-friendly, reliable, and affordable. Serving Lakeville and surrounding areas. Get your free quote today!',
      keywords: [
        'dog waste removal Lakeville',
        'poop scooping Lakeville',
        'dog cleanup services Lakeville',
        'eco friendly pet waste Lakeville',
      ],
    },
  },
  burnsville: {
    name: 'burnsville',
    displayName: 'Burnsville',
    state: 'MN',
    population: 62000,
    description:
      'Burnsville, a vibrant suburb known for its diverse community, excellent schools, and convenient location along I-35.',
    zipCodes: ['55306', '55337'],
    neighborhoods: ['North Burnsville', 'South Burnsville', 'East Burnsville', 'West Burnsville'],
    serviceAreas: ['Burnsville', 'Lakeville', 'Apple Valley', 'Savage'],
    localBusiness: {
      name: 'Yardura Burnsville',
      address: 'North Burnsville, MN 55337',
      phone: '(888) 915-YARD',
      // rating: 4.8, // TODO: Uncomment when we have real ratings
      // reviewCount: 134, // TODO: Uncomment when we have real ratings
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in Burnsville, MN | Yardura',
      description:
        'Expert dog poop cleanup services in Burnsville. Eco-friendly, reliable, and affordable. Serving Burnsville and surrounding areas. Get your free quote today!',
      keywords: [
        'dog waste removal Burnsville',
        'poop scooping Burnsville',
        'dog cleanup services Burnsville',
        'eco friendly pet waste Burnsville',
      ],
    },
  },
  'st-cloud': {
    name: 'st-cloud',
    displayName: 'St. Cloud',
    state: 'MN',
    population: 68000,
    description:
      'St. Cloud, a vibrant city in central Minnesota known for its university, riverfront, and growing community.',
    zipCodes: ['56301', '56302', '56303', '56304', '56379', '56387'],
    neighborhoods: [
      'Downtown St. Cloud',
      'North St. Cloud',
      'South St. Cloud',
      'East St. Cloud',
      'West St. Cloud',
    ],
    serviceAreas: [
      'St. Cloud',
      'Sartell',
      'Sauk Rapids',
      'Waite Park',
      'St. Joseph',
      'Cold Spring',
      'Rockville',
    ],
    localBusiness: {
      name: 'Yardura St. Cloud',
      address: 'Downtown St. Cloud, MN 56301',
      phone: '(888) 915-YARD',
      // rating: 4.8, // TODO: Uncomment when we have real ratings
      // reviewCount: 89, // TODO: Uncomment when we have real ratings
    },
    seo: {
      title: 'Professional Dog Waste Removal Services in St. Cloud, MN | Yardura',
      description:
        'Expert dog poop cleanup services in St. Cloud. Eco-friendly, reliable, and affordable. Serving St. Cloud and surrounding central Minnesota areas. Get your free quote today!',
      keywords: [
        'dog waste removal St. Cloud',
        'poop scooping St. Cloud',
        'dog cleanup services St. Cloud',
        'eco friendly pet waste St. Cloud',
      ],
    },
  },
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
