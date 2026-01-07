export type ParcelFieldMap = {
  parcelId: string;
  houseNo: string;
  streetName: string;
  zipCode: string;
  municipName: string;
};

export type ParcelSource = {
  id: string;
  name: string;
  countyName: string;
  countyFips: string;
  state: string;
  sourceType: 'arcgis';
  layerUrl: string;
  fieldMap?: Partial<ParcelFieldMap>;
};

export const PARCEL_SOURCES: ParcelSource[] = [
  {
    id: 'hennepin-umn',
    name: 'Hennepin Parcel (UMN)',
    countyName: 'Hennepin',
    countyFips: '27053',
    state: 'MN',
    sourceType: 'arcgis',
    layerUrl:
      'https://services.arcgis.com/8df8p0NlLFEShl0r/arcgis/rest/services/Hennepin_Parcel/FeatureServer/0',
    fieldMap: {
      parcelId: 'PID',
      houseNo: 'HOUSE_NO',
      streetName: 'STREET_NM',
      zipCode: 'ZIP_CD',
      municipName: 'MUNIC_NM',
    },
  },
];
