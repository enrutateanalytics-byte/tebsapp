export interface KmlCoordinate {
  lat: number;
  lng: number;
}

export interface KmlStop {
  name: string;
  lat: number;
  lng: number;
}

export interface KmlParseResult {
  coordinates: KmlCoordinate[];
  stops: KmlStop[];
}

export const parseKmlFile = (kmlContent: string): KmlParseResult => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlContent, 'text/xml');
  
  const coordinates: KmlCoordinate[] = [];
  const stops: KmlStop[] = [];
  
  // Find all Placemarks
  const placemarks = doc.querySelectorAll('Placemark');
  
  placemarks.forEach((placemark) => {
    const nameElement = placemark.querySelector('name');
    const name = nameElement?.textContent?.trim() || '';
    
    // Check for Point (stop/marker)
    const point = placemark.querySelector('Point');
    if (point) {
      const coordElement = point.querySelector('coordinates');
      const coordText = coordElement?.textContent?.trim();
      if (coordText) {
        const parts = coordText.split(',');
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            stops.push({ name, lat, lng });
          }
        }
      }
      return; // Skip to next placemark
    }
    
    // Check for LineString (route path)
    const lineString = placemark.querySelector('LineString');
    if (lineString) {
      const coordElement = lineString.querySelector('coordinates');
      const coordText = coordElement?.textContent?.trim();
      if (coordText) {
        const coordPairs = coordText.split(/\s+/).filter(Boolean);
        coordPairs.forEach((pair) => {
          const parts = pair.split(',');
          if (parts.length >= 2) {
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
              coordinates.push({ lat, lng });
            }
          }
        });
      }
    }
  });
  
  // Fallback: if no LineString found, try to get coordinates from any coordinates element
  if (coordinates.length === 0) {
    const coordinateElements = doc.querySelectorAll('coordinates');
    coordinateElements.forEach((coordElement) => {
      const parent = coordElement.parentElement;
      // Skip if parent is a Point (already handled as stop)
      if (parent?.tagName === 'Point') return;
      
      const coordText = coordElement.textContent?.trim();
      if (!coordText) return;
      
      const coordPairs = coordText.split(/\s+/).filter(Boolean);
      coordPairs.forEach((pair) => {
        const parts = pair.split(',');
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            coordinates.push({ lat, lng });
          }
        }
      });
    });
  }
  
  return { coordinates, stops };
};

export const coordinatesToString = (coordinates: KmlCoordinate[]): string => {
  return JSON.stringify(coordinates);
};

export const stringToCoordinates = (str: string | null): KmlCoordinate[] => {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
};

export const stopsToString = (stops: KmlStop[]): string => {
  return JSON.stringify(stops);
};

export const stringToStops = (str: string | null | unknown): KmlStop[] => {
  if (!str) return [];
  if (Array.isArray(str)) return str as KmlStop[];
  if (typeof str === 'object') return str as KmlStop[];
  if (typeof str === 'string') {
    try {
      return JSON.parse(str);
    } catch {
      return [];
    }
  }
  return [];
};
