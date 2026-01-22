import { GoogleMap, Polyline } from '@react-google-maps/api';
import { useMemo } from 'react';

interface RouteMapProps {
  coordinates: { lat: number; lng: number }[];
  className?: string;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const RouteMap = ({ coordinates, className }: RouteMapProps) => {
  const center = useMemo(() => {
    if (coordinates.length === 0) {
      return { lat: 19.4326, lng: -99.1332 }; // Default: Mexico City
    }
    const sumLat = coordinates.reduce((acc, c) => acc + c.lat, 0);
    const sumLng = coordinates.reduce((acc, c) => acc + c.lng, 0);
    return {
      lat: sumLat / coordinates.length,
      lng: sumLng / coordinates.length,
    };
  }, [coordinates]);

  const bounds = useMemo(() => {
    if (coordinates.length === 0 || !window.google) return null;
    
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach((coord) => {
      bounds.extend(coord);
    });
    return bounds;
  }, [coordinates]);

  return (
    <div className={className}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={(map) => {
          if (bounds) {
            map.fitBounds(bounds);
          }
        }}
      >
        {coordinates.length > 1 && (
          <Polyline
            path={coordinates}
            options={{
              strokeColor: '#3b82f6',
              strokeOpacity: 0.8,
              strokeWeight: 4,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
};

export default RouteMap;
