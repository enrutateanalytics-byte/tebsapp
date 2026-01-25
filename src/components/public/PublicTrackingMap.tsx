import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';

interface GpsPosition {
  id: string;
  unit_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  units?: { plate_number: string } | null;
}

interface PublicTrackingMapProps {
  clientId: string;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = { lat: 19.4326, lng: -99.1332 };

const PublicTrackingMap = ({ clientId }: PublicTrackingMapProps) => {
  // Get routes for this client to find assigned units
  const { data: routes } = useQuery({
    queryKey: ['public-routes-for-tracking', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('id')
        .eq('client_id', clientId)
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Get assignments for these routes
  const routeIds = routes?.map(r => r.id) || [];
  
  const { data: assignments } = useQuery({
    queryKey: ['public-assignments', routeIds],
    queryFn: async () => {
      if (routeIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('assignments')
        .select('unit_id')
        .in('route_id', routeIds)
        .eq('status', 'in_progress');
      
      if (error) throw error;
      return data;
    },
    enabled: routeIds.length > 0,
  });

  const unitIds = [...new Set(assignments?.map(a => a.unit_id) || [])];

  // Get latest GPS positions for these units
  const { data: positions, isLoading } = useQuery({
    queryKey: ['public-gps-positions', unitIds],
    queryFn: async () => {
      if (unitIds.length === 0) return [];

      const { data, error } = await supabase
        .from('gps_positions')
        .select('*, units(plate_number)')
        .in('unit_id', unitIds)
        .order('recorded_at', { ascending: false });
      
      if (error) throw error;
      
      // Get latest position per unit
      const latestByUnit = new Map<string, GpsPosition>();
      (data as GpsPosition[]).forEach((pos) => {
        if (!latestByUnit.has(pos.unit_id)) {
          latestByUnit.set(pos.unit_id, pos);
        }
      });
      
      return Array.from(latestByUnit.values());
    },
    enabled: unitIds.length > 0,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const center = useMemo(() => {
    if (positions && positions.length > 0) {
      const sumLat = positions.reduce((acc, p) => acc + Number(p.latitude), 0);
      const sumLng = positions.reduce((acc, p) => acc + Number(p.longitude), 0);
      return {
        lat: sumLat / positions.length,
        lng: sumLng / positions.length,
      };
    }
    return defaultCenter;
  }, [positions]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Cargando ubicaciones...
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
        <p>No hay unidades con ubicación activa</p>
        <p className="text-sm">Las unidades aparecerán cuando estén en servicio</p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={12}
    >
      {positions.map((pos) => (
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

export default PublicTrackingMap;
