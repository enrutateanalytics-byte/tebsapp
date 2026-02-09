import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { stringToCoordinates, stringToStops, KmlStop } from '@/lib/kmlParser';
import { toast } from 'sonner';

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

interface AnimatedPosition {
  current: google.maps.LatLngLiteral;
  target: google.maps.LatLngLiteral;
  plateNumber: string;
  unitId: string;
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
  const [selectedUnit, setSelectedUnit] = useState<AnimatedPosition | null>(null);
  const [animatedPositions, setAnimatedPositions] = useState<Map<string, AnimatedPosition>>(new Map());
  const mapRef = useRef<google.maps.Map | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastPositionsRef = useRef<Map<string, google.maps.LatLngLiteral>>(new Map());

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

  // Auto-sync GPS from Tracksolid when route is selected
  useEffect(() => {
    if (!route?.id) return;

    const syncGps = async () => {
      try {
        await supabase.functions.invoke('sync-tracksolid', { method: 'POST' });
      } catch (err) {
        console.error('Auto-sync error:', err);
      }
    };

    // Sync immediately on route select
    syncGps();

    // Then every 15 seconds
    const intervalId = setInterval(syncGps, 15000);
    return () => clearInterval(intervalId);
  }, [route?.id]);

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
    refetchInterval: 10000, // Actualizar cada 10 segundos
  });

  // Animate markers when positions change
  useEffect(() => {
    if (!positions || positions.length === 0) return;

    // Set up new targets for animation
    const newAnimatedPositions = new Map<string, AnimatedPosition>();
    
    positions.forEach((pos) => {
      const targetPos = { lat: Number(pos.latitude), lng: Number(pos.longitude) };
      const lastPos = lastPositionsRef.current.get(pos.unit_id);
      
      // If we have a previous position, animate from there
      const currentPos = lastPos || targetPos;
      
      newAnimatedPositions.set(pos.unit_id, {
        current: currentPos,
        target: targetPos,
        plateNumber: pos.units?.plate_number || 'Unidad',
        unitId: pos.unit_id,
      });
      
      // Update last known position
      lastPositionsRef.current.set(pos.unit_id, targetPos);
    });

    setAnimatedPositions(newAnimatedPositions);

    // Start animation
    const animationDuration = 2000; // 2 seconds for smooth transition
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Easing function for smoother animation
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      setAnimatedPositions((prev) => {
        const updated = new Map(prev);
        updated.forEach((pos, unitId) => {
          if (progress < 1) {
            const newLat = pos.current.lat + (pos.target.lat - pos.current.lat) * easeProgress;
            const newLng = pos.current.lng + (pos.target.lng - pos.current.lng) * easeProgress;
            updated.set(unitId, {
              ...pos,
              current: { lat: newLat, lng: newLng },
            });
          } else {
            updated.set(unitId, {
              ...pos,
              current: pos.target,
            });
          }
        });
        return updated;
      });

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [positions]);

  // Only compute initial center (not reactive to GPS updates)
  const initialCenter = useMemo(() => {
    if (routeCoordinates.length > 0) {
      const sumLat = routeCoordinates.reduce((acc, p) => acc + p.lat, 0);
      const sumLng = routeCoordinates.reduce((acc, p) => acc + p.lng, 0);
      return { lat: sumLat / routeCoordinates.length, lng: sumLng / routeCoordinates.length };
    }
    if (userLocation) {
      return userLocation;
    }
    return defaultCenter;
  }, [routeCoordinates, userLocation]);

  // Fit bounds only when route or stops change (not on GPS position updates)
  useEffect(() => {
    if (!mapRef.current) return;
    if (routeCoordinates.length === 0 && stops.length === 0) return;
    
    const bounds = new google.maps.LatLngBounds();
    routeCoordinates.forEach(coord => bounds.extend(coord));
    stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng }));
    
    mapRef.current.fitBounds(bounds, 50);
  }, [routeCoordinates, stops]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    
    if (routeCoordinates.length === 0 && stops.length === 0 && (!positions || positions.length === 0)) return;
    
    const bounds = new google.maps.LatLngBounds();
    routeCoordinates.forEach(coord => bounds.extend(coord));
    stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng }));
    positions?.forEach(pos => bounds.extend({ lat: Number(pos.latitude), lng: Number(pos.longitude) }));
    map.fitBounds(bounds, 50);
  }, [routeCoordinates, stops, positions]);

  // Convert animated positions map to array for rendering
  const animatedMarkersArray = useMemo(() => {
    return Array.from(animatedPositions.values());
  }, [animatedPositions]);

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={initialCenter}
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

      {/* Animated unit markers */}
      {animatedMarkersArray.map((animPos) => (
        <Marker
          key={animPos.unitId}
          position={animPos.current}
          title={animPos.plateNumber}
          onClick={() => setSelectedUnit(animPos)}
          icon={{
            url: '/images/bus-icon.png',
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20),
          }}
        />
      ))}

      {/* Unit InfoWindow */}
      {selectedUnit && (
        <InfoWindow
          position={selectedUnit.current}
          onCloseClick={() => setSelectedUnit(null)}
        >
          <div className="p-2 min-w-[120px]">
            <p className="font-semibold text-sm text-gray-800">{selectedUnit.plateNumber}</p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

export default PublicCombinedMap;
