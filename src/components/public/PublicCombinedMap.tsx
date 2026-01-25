import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { stringToCoordinates } from '@/lib/kmlParser';

interface RouteData {
  id: string;
  name: string;
  kml_file_path: string | null;
}

interface GpsPosition {
  id: string;
  unit_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  units?: { plate_number: string } | null;
}

interface PublicCombinedMapProps {
  route: RouteData | null;
  clientId: string;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = { lat: 19.4326, lng: -99.1332 };

const PublicCombinedMap = ({ route, clientId }: PublicCombinedMapProps) => {
  const [routeCoordinates, setRouteCoordinates] = useState<google.maps.LatLngLiteral[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Parse route coordinates from stored JSON
  useEffect(() => {
    if (route?.kml_file_path) {
      const coords = stringToCoordinates(route.kml_file_path);
      setRouteCoordinates(coords);
    } else {
      setRouteCoordinates([]);
    }
  }, [route?.kml_file_path]);

  // Get assignments for the SELECTED route only
  const { data: assignments } = useQuery({
    queryKey: ['public-assignments', route?.id],
    queryFn: async () => {
      if (!route?.id) return [];
      
      const { data, error } = await supabase
        .from('assignments')
        .select('unit_id')
        .eq('route_id', route.id)
        .eq('status', 'in_progress');
      
      if (error) throw error;
      return data;
    },
    enabled: !!route?.id,
  });

  const unitIds = useMemo(() => [...new Set(assignments?.map(a => a.unit_id) || [])], [assignments]);

  const { data: positions } = useQuery({
    queryKey: ['public-gps-positions', unitIds],
    queryFn: async () => {
      if (unitIds.length === 0) return [];

      const { data, error } = await supabase
        .from('gps_positions')
        .select('*, units(plate_number)')
        .in('unit_id', unitIds)
        .order('recorded_at', { ascending: false });
      
      if (error) throw error;
      
      const latestByUnit = new Map<string, GpsPosition>();
      (data as GpsPosition[]).forEach((pos) => {
        if (!latestByUnit.has(pos.unit_id)) {
          latestByUnit.set(pos.unit_id, pos);
        }
      });
      
      return Array.from(latestByUnit.values());
    },
    enabled: unitIds.length > 0,
    refetchInterval: 30000,
  });

  const center = useMemo(() => {
    // Priority: route coordinates, then unit positions, then default
    if (routeCoordinates.length > 0) {
      const sumLat = routeCoordinates.reduce((acc, p) => acc + p.lat, 0);
      const sumLng = routeCoordinates.reduce((acc, p) => acc + p.lng, 0);
      return { lat: sumLat / routeCoordinates.length, lng: sumLng / routeCoordinates.length };
    }
    if (positions && positions.length > 0) {
      const sumLat = positions.reduce((acc, p) => acc + Number(p.latitude), 0);
      const sumLng = positions.reduce((acc, p) => acc + Number(p.longitude), 0);
      return { lat: sumLat / positions.length, lng: sumLng / positions.length };
    }
    return defaultCenter;
  }, [routeCoordinates, positions]);

  // Fit bounds whenever route or positions change
  useEffect(() => {
    if (!mapRef.current) return;
    if (routeCoordinates.length === 0 && (!positions || positions.length === 0)) return;
    
    const bounds = new google.maps.LatLngBounds();
    routeCoordinates.forEach(coord => bounds.extend(coord));
    positions?.forEach(pos => bounds.extend({ lat: Number(pos.latitude), lng: Number(pos.longitude) }));
    
    mapRef.current.fitBounds(bounds, 50);
  }, [routeCoordinates, positions]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    
    if (routeCoordinates.length === 0 && (!positions || positions.length === 0)) return;
    
    const bounds = new google.maps.LatLngBounds();
    routeCoordinates.forEach(coord => bounds.extend(coord));
    positions?.forEach(pos => bounds.extend({ lat: Number(pos.latitude), lng: Number(pos.longitude) }));
    map.fitBounds(bounds, 50);
  }, [routeCoordinates, positions]);

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={12}
      onLoad={handleMapLoad}
    >
      {/* Route polyline */}
      {routeCoordinates.length > 0 && (
        <>
          <Polyline
            path={routeCoordinates}
            options={{
              strokeColor: 'hsl(221, 83%, 53%)',
              strokeOpacity: 0.8,
              strokeWeight: 4,
            }}
          />
          <Marker
            position={routeCoordinates[0]}
            title="Origen"
            icon={{
              url: 'data:image/svg+xml,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="hsl(142, 76%, 36%)" stroke="white" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(24, 24),
              anchor: new google.maps.Point(12, 12),
            }}
          />
          <Marker
            position={routeCoordinates[routeCoordinates.length - 1]}
            title="Destino"
            icon={{
              url: 'data:image/svg+xml,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="hsl(0, 84%, 60%)" stroke="white" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(24, 24),
              anchor: new google.maps.Point(12, 12),
            }}
          />
        </>
      )}

      {/* Unit markers */}
      {positions?.map((pos) => (
        <Marker
          key={pos.id}
          position={{ lat: Number(pos.latitude), lng: Number(pos.longitude) }}
          title={pos.units?.plate_number || 'Unidad'}
          icon={{
            url: '/images/bus-icon.png',
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20),
          }}
        />
      ))}
    </GoogleMap>
  );
};

export default PublicCombinedMap;
