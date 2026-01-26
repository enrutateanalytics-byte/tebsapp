import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { stringToCoordinates, stringToStops, KmlStop } from '@/lib/kmlParser';

interface RouteData {
  id: string;
  name: string;
  kml_file_path: string | null;
  stops?: unknown;
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
  const [stops, setStops] = useState<KmlStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<{ stop: KmlStop; index: number } | null>(null);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Get user's device location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          // Center map on user location if no route is selected
          if (mapRef.current && !route) {
            mapRef.current.setCenter(location);
            mapRef.current.setZoom(14);
          }
        },
        (error) => {
          console.log('Geolocation error:', error.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Parse route coordinates and stops from stored JSON
  useEffect(() => {
    if (route?.kml_file_path) {
      const coords = stringToCoordinates(route.kml_file_path);
      setRouteCoordinates(coords);
    } else {
      setRouteCoordinates([]);
    }
    
    // Parse stops
    const routeStops = stringToStops(route?.stops);
    setStops(routeStops);
  }, [route?.kml_file_path, route?.stops]);

  // Get assignments ONLY for the selected route
  const { data: assignments } = useQuery({
    queryKey: ['public-assignments', route?.id],
    queryFn: async () => {
      if (!route?.id) return [];
      
      const { data, error } = await supabase
        .from('assignments')
        .select('unit_id')
        .eq('route_id', route.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!route?.id,
  });

  const unitIds = useMemo(() => [...new Set(assignments?.map(a => a.unit_id) || [])], [assignments]);

  // Get GPS positions only for units assigned to the selected route
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
    refetchInterval: 20000, // Actualizar cada 20 segundos
  });

  const center = useMemo(() => {
    // Priority: route coordinates, then unit positions, then user location, then default
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
    if (userLocation) {
      return userLocation;
    }
    return defaultCenter;
  }, [routeCoordinates, positions, userLocation]);

  // Fit bounds whenever route, stops, or positions change
  useEffect(() => {
    if (!mapRef.current) return;
    if (routeCoordinates.length === 0 && stops.length === 0 && (!positions || positions.length === 0)) return;
    
    const bounds = new google.maps.LatLngBounds();
    routeCoordinates.forEach(coord => bounds.extend(coord));
    stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng }));
    positions?.forEach(pos => bounds.extend({ lat: Number(pos.latitude), lng: Number(pos.longitude) }));
    
    mapRef.current.fitBounds(bounds, 50);
  }, [routeCoordinates, stops, positions]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    
    if (routeCoordinates.length === 0 && stops.length === 0 && (!positions || positions.length === 0)) return;
    
    const bounds = new google.maps.LatLngBounds();
    routeCoordinates.forEach(coord => bounds.extend(coord));
    stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng }));
    positions?.forEach(pos => bounds.extend({ lat: Number(pos.latitude), lng: Number(pos.longitude) }));
    map.fitBounds(bounds, 50);
  }, [routeCoordinates, stops, positions]);

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

      {/* Stop markers */}
      {stops.map((stop, index) => (
        <Marker
          key={`stop-${index}`}
          position={{ lat: stop.lat, lng: stop.lng }}
          title={stop.name || `Parada ${index + 1}`}
          onClick={() => setSelectedStop({ stop, index })}
          icon={{
            url: 'data:image/svg+xml,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="12" fill="hsl(262, 83%, 58%)" stroke="white" stroke-width="2"/>
                <text x="14" y="18" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">${index + 1}</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(28, 28),
            anchor: new google.maps.Point(14, 14),
          }}
        />
      ))}

      {/* Stop InfoWindow */}
      {selectedStop && (
        <InfoWindow
          position={{ lat: selectedStop.stop.lat, lng: selectedStop.stop.lng }}
          onCloseClick={() => setSelectedStop(null)}
        >
          <div className="p-1 min-w-[150px]">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {selectedStop.index + 1}
              </span>
              <span className="font-semibold text-sm text-gray-800">Parada {selectedStop.index + 1}</span>
            </div>
            <p className="text-sm text-gray-700">{selectedStop.stop.name || 'Sin nombre'}</p>
          </div>
        </InfoWindow>
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
