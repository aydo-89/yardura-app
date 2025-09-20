declare global {
  interface Window {
    google: {
      maps: {
        places: {
          Autocomplete: new (input: HTMLInputElement, options?: {
            types?: string[];
            componentRestrictions?: { country: string };
          }) => google.maps.places.Autocomplete;
        };
      };
    };
  }

  namespace google {
    namespace maps {
      namespace places {
        class Autocomplete {
          constructor(input: HTMLInputElement, options?: {
            types?: string[];
            componentRestrictions?: { country: string };
          });
          addListener(eventName: string, handler: () => void): void;
          getPlace(): google.maps.places.PlaceResult;
        }

        interface PlaceResult {
          address_components?: Array<{
            long_name: string;
            short_name: string;
            types: string[];
          }>;
        }
      }
    }
  }
}

export {};


