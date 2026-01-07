export type StoolLibraryEntry = {
  id: string;
  label: string;
  firmnessScale: number;
  color: string;
  indicator: 'watch' | 'monitor' | 'vet_now';
  summary: string;
  guidance: string;
  imageUrl?: string;
};

export const STOOL_LIBRARY_ENTRIES: StoolLibraryEntry[] = [
  {
    id: 'normal-1',
    label: 'Ideal: firm & easy to pick up',
    firmnessScale: 4,
    color: 'brown',
    indicator: 'watch',
    summary: 'Logs hold shape with a slight sheen. Minimal residue.',
    guidance: 'Great sign of hydration and diet balance.',
    imageUrl: '/stool-library/normal-1.png',
  },
  {
    id: 'soft-1',
    label: 'Soft but formed',
    firmnessScale: 5,
    color: 'brown',
    indicator: 'watch',
    summary: 'Soft piles that lose edges but still stack.',
    guidance: 'Monitor for diet changes or extra treats.',
    imageUrl: '/stool-library/soft-1.png',
  },
  {
    id: 'watery-1',
    label: 'Loose diarrhea',
    firmnessScale: 6,
    color: 'brown',
    indicator: 'monitor',
    summary: 'Mushy stool with no form, but still has some texture.',
    guidance: 'Offer water and bland diet. Monitor for 24 hours.',
    imageUrl: '/stool-library/watery-1.png',
  },
  {
    id: 'watery-2',
    label: 'Liquid diarrhea',
    firmnessScale: 7,
    color: 'brown',
    indicator: 'monitor',
    summary: 'Almost entirely liquid with minimal solid matter.',
    guidance: 'Hydration is critical. If it persists more than a day, contact your vet.',
    imageUrl: '/stool-library/watery-2.png',
  },
  {
    id: 'dry-1',
    label: 'Dry or hard pellets',
    firmnessScale: 1,
    color: 'brown',
    indicator: 'watch',
    summary: 'Small hard nuggets or crumbly stool.',
    guidance: 'Increase hydration and fiber. Check activity levels.',
    imageUrl: '/stool-library/dry-1.png',
  },
  {
    id: 'yellow-1',
    label: 'Pale, gray, or clay-colored',
    firmnessScale: 4,
    color: 'gray-yellow',
    indicator: 'monitor',
    summary: 'Grayish-tan or clay color, may look greasy.',
    guidance: 'Can indicate liver or gallbladder issues. If it persists more than 1-2 days, contact your vet.',
    imageUrl: '/stool-library/yellow-1.png',
  },
  {
    id: 'red-1',
    label: 'Red streaks',
    firmnessScale: 4,
    color: 'red',
    indicator: 'vet_now',
    summary: 'Visible red streaks or spots.',
    guidance: 'Fresh blood can signal irritation. Contact your vet.',
    imageUrl: '/stool-library/red-1.png',
  },
  {
    id: 'black-1',
    label: 'Black or tarry',
    firmnessScale: 3,
    color: 'black',
    indicator: 'vet_now',
    summary: 'Sticky, tar-like texture with dark color.',
    guidance: 'Can signal bleeding higher in the GI tract. Seek vet care.',
    imageUrl: '/stool-library/black-1.png',
  },
  {
    id: 'mucus-1',
    label: 'Mucus coating',
    firmnessScale: 5,
    color: 'brown',
    indicator: 'monitor',
    summary: 'Glossy mucus coating or strands.',
    guidance: 'Track for a few days. If it continues, check with your vet.',
    imageUrl: '/stool-library/mucus-1.png',
  },
];
