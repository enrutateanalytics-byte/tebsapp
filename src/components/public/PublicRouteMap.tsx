import { useState, useEffect, useMemo } from 'react';
import { GoogleMap, Polyline, Marker } from '@react-google-maps/api';
import { stringToCoordinates, stringToStops, KmlCoordinate, KmlStop } from '@/lib/kmlParser';

interface RouteData {
  id: string;
  name: string;
  kml_file_path: string | null;
  stops?: unknown;
}

interface PublicRouteMapProps {
  route: RouteData | null;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = { lat: 19.4326, lng: -99.1332 };

const PublicRouteMap = ({ route }: PublicRouteMapProps) => {
  const [coordinates, setCoordinates] = useState<KmlCoordinate[]>([]);
  const [stops, setStops] = useState<KmlStop[]>([]);

  useEffect(() => {
    if (!route?.kml_file_path) {
      setCoordinates([]);
      setStops([]);
      return;
    }

    // Parse coordinates from kml_file_path (stored as JSON string)
    const coords = stringToCoordinates(route.kml_file_path);
    setCoordinates(coords);
    
    // Parse stops
    const routeStops = stringToStops(route.stops);
    setStops(routeStops);
  }, [route?.kml_file_path, route?.stops]);

  const center = useMemo(() => {
    if (coordinates.length > 0) {
      const sumLat = coordinates.reduce((acc, c) => acc + c.lat, 0);
      const sumLng = coordinates.reduce((acc, c) => acc + c.lng, 0);
      return {
        lat: sumLat / coordinates.length,
        lng: sumLng / coordinates.length,
      };
    }
    return defaultCenter;
  }, [coordinates]);

  const bounds = useMemo(() => {
    if (coordinates.length < 2 && stops.length === 0) return null;
    
    const bounds = new google.maps.LatLngBounds();
    coordinates.forEach((coord) => {
      bounds.extend({ lat: coord.lat, lng: coord.lng });
    });
    stops.forEach((stop) => {
      bounds.extend({ lat: stop.lat, lng: stop.lng });
    });
    return bounds;
  }, [coordinates, stops]);

  if (!route) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Selecciona una ruta para ver el mapa
      </div>
    );
  }

  if (!route.kml_file_path) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Esta ruta no tiene un mapa configurado
      </div>
    );
  }

  return (
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
      {coordinates.length > 0 && (
        <>
          {/* Route line */}
          <Polyline
            path={coordinates}
            options={{
              strokeColor: 'hsl(var(--primary))',
              strokeOpacity: 0.8,
              strokeWeight: 4,
            }}
          />
          {/* Start marker */}
          <Marker
            position={coordinates[0]}
            label={{ text: 'A', color: 'white', fontWeight: 'bold' }}
            title="Inicio"
          />
          {/* End marker */}
          <Marker
            position={coordinates[coordinates.length - 1]}
            label={{ text: 'B', color: 'white', fontWeight: 'bold' }}
            title="Fin"
          />
          {/* Stop markers */}
          {stops.map((stop, index) => (
            <Marker
              key={`stop-${index}`}
              position={{ lat: stop.lat, lng: stop.lng }}
              title={stop.name || `Parada ${index + 1}`}
              label={{
                text: String(index + 1),
                color: 'white',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            />
          ))}
        </>
      )}
    </GoogleMap>
  );
};

export default PublicRouteMap;
