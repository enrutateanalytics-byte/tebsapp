export interface KmlCoordinate {
  lat: number;
  lng: number;
}

export const parseKmlFile = (kmlContent: string): KmlCoordinate[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlContent, 'text/xml');
  
  const coordinates: KmlCoordinate[] = [];
  
  // Find all coordinate elements
  const coordinateElements = doc.querySelectorAll('coordinates');
  
  coordinateElements.forEach((coordElement) => {
    const coordText = coordElement.textContent?.trim();
    if (!coordText) return;
    
    // Split by whitespace or newlines
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
  
  return coordinates;
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
