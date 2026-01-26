import { GoogleMap, Polyline, Marker } from '@react-google-maps/api';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { KmlStop } from '@/lib/kmlParser';

interface RouteMapProps {
  coordinates: { lat: number; lng: number }[];
  stops?: KmlStop[];
  routeId?: string;
  className?: string;
}

interface GpsPosition {
  id: string;
  unit_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  units?: { plate_number: string; driver_name: string | null } | null;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const RouteMap = ({ coordinates, stops = [], routeId, className }: RouteMapProps) => {
  // Get assignments for this route
  const { data: assignments } = useQuery({
    queryKey: ['route-assignments', routeId],
    queryFn: async () => {
      if (!routeId) return [];
      const { data, error } = await supabase
        .from('assignments')
        .select('unit_id')
        .eq('route_id', routeId)
        .eq('status', 'in_progress');
      if (error) throw error;
      return data;
    },
    enabled: !!routeId,
  });

  const unitIds = [...new Set(assignments?.map(a => a.unit_id) || [])];

  // Get GPS positions for assigned units
  const { data: gpsPositions } = useQuery({
    queryKey: ['route-gps-positions', unitIds],
    queryFn: async () => {
      if (unitIds.length === 0) return [];
      const { data, error } = await supabase
        .from('gps_positions')
        .select('id, unit_id, latitude, longitude, recorded_at, units(plate_number, driver_name)')
        .in('unit_id', unitIds)
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      
      // Get only the latest position per unit
      const latestByUnit = new Map<string, GpsPosition>();
      (data as GpsPosition[]).forEach(pos => {
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
    if (!window.google) return null;
    if (coordinates.length === 0 && (!gpsPositions || gpsPositions.length === 0) && stops.length === 0) return null;
    
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach((coord) => {
      bounds.extend(coord);
    });
    stops.forEach((stop) => {
      bounds.extend({ lat: stop.lat, lng: stop.lng });
    });
    gpsPositions?.forEach((pos) => {
      bounds.extend({ lat: Number(pos.latitude), lng: Number(pos.longitude) });
    });
    return bounds;
  }, [coordinates, stops, gpsPositions]);

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
        
        {/* Unit markers */}
        {gpsPositions?.map((pos) => (
          <Marker
            key={pos.id}
            position={{ lat: Number(pos.latitude), lng: Number(pos.longitude) }}
            title={`${pos.units?.plate_number || 'Unidad'} - ${pos.units?.driver_name || 'Sin conductor'}`}
            icon={{
              url: '/images/bus-icon.png',
              scaledSize: new window.google.maps.Size(40, 40),
              anchor: new window.google.maps.Point(20, 20),
            }}
          />
        ))}
      </GoogleMap>
    </div>
  );
};

export default RouteMap;
