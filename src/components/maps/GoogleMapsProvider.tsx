import { LoadScript } from '@react-google-maps/api';
import { ReactNode } from 'react';

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ['geometry'];

interface GoogleMapsProviderProps {
  children: ReactNode;
}

const GoogleMapsProvider = ({ children }: GoogleMapsProviderProps) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-lg p-8">
        <div className="text-center">
          <p className="text-muted-foreground">Google Maps API Key no configurada</p>
        </div>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={libraries}>
      {children}
    </LoadScript>
  );
};

export default GoogleMapsProvider;
