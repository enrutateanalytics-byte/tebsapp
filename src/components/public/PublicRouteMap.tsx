import { useState, useEffect, useMemo } from 'react';
import { GoogleMap, Polyline, Marker } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { parseKmlFile, KmlCoordinate } from '@/lib/kmlParser';

interface RouteData {
  id: string;
  name: string;
  kml_file_path: string | null;
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadKmlCoordinates = async () => {
      if (!route?.kml_file_path) {
        setCoordinates([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('kml-files')
          .download(route.kml_file_path);

        if (error) throw error;

        const text = await data.text();
        const coords = parseKmlFile(text);
        setCoordinates(coords);
      } catch (err) {
        console.error('Error loading KML:', err);
        setCoordinates([]);
      } finally {
        setLoading(false);
      }
    };

    loadKmlCoordinates();
  }, [route?.kml_file_path]);

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
    if (coordinates.length < 2) return null;
    
    const bounds = new google.maps.LatLngBounds();
    coordinates.forEach((coord) => {
      bounds.extend({ lat: coord.lat, lng: coord.lng });
    });
    return bounds;
  }, [coordinates]);

  if (!route) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Selecciona una ruta para ver el mapa
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Cargando mapa...
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
        </>
      )}
    </GoogleMap>
  );
};

export default PublicRouteMap;
