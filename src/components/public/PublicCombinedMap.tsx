import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GoogleMap, Marker, Polyline, InfoWindow, OverlayView } from '@react-google-maps/api';
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
  speed: number | null;
  heading: number | null;
  recorded_at: string;
  units?: { plate_number: string } | null;
}

interface AnimatedPosition {
  current: google.maps.LatLngLiteral;
  target: google.maps.LatLngLiteral;
  plateNumber: string;
  unitId: string;
  speed: number;
  heading: number;
  progress: number; // 0-1 interpolation progress toward target
  startPos: google.maps.LatLngLiteral; // position when new target was set
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

// Smooth easing function (ease-in-out cubic)
const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// Generate rotated bus SVG icon as data URL
const createBusIcon = (heading: number, isMoving: boolean): string => {
  const color = isMoving ? '#2563eb' : '#6b7280';
  const glowColor = isMoving ? 'rgba(37,99,235,0.4)' : 'rgba(107,114,128,0.2)';
  return 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <defs>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="${glowColor}" flood-opacity="0.8"/>
        </filter>
      </defs>
      <g transform="rotate(${heading}, 24, 24)" filter="url(#shadow)">
        <!-- Direction indicator -->
        ${isMoving ? `<polygon points="24,6 28,16 20,16" fill="${color}" opacity="0.7"/>` : ''}
        <!-- Bus body -->
        <rect x="14" y="14" width="20" height="24" rx="4" fill="${color}" stroke="white" stroke-width="1.5"/>
        <!-- Windshield -->
        <rect x="16" y="16" width="16" height="7" rx="2" fill="white" opacity="0.9"/>
        <!-- Side windows -->
        <rect x="16" y="25" width="7" height="4" rx="1" fill="white" opacity="0.6"/>
        <rect x="25" y="25" width="7" height="4" rx="1" fill="white" opacity="0.6"/>
        <!-- Wheels -->
        <circle cx="17" cy="37" r="2" fill="#1e293b"/>
        <circle cx="31" cy="37" r="2" fill="#1e293b"/>
      </g>
    </svg>
  `);
};

const PublicCombinedMap = ({ route, clientId }: PublicCombinedMapProps) => {
  const [routeCoordinates, setRouteCoordinates] = useState<google.maps.LatLngLiteral[]>([]);
  const [stops, setStops] = useState<KmlStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<{ stop: KmlStop; index: number } | null>(null);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [animatedPositions, setAnimatedPositions] = useState<Map<string, AnimatedPosition>>(new Map());
  const mapRef = useRef<google.maps.Map | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastPositionsRef = useRef<Map<string, google.maps.LatLngLiteral>>(new Map());
  const queryClient = useQueryClient();

  // Interpolation duration in ms (how long to animate between GPS updates)
  const INTERPOLATION_DURATION_MS = 8000;

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

  // Auto-sync GPS from Tracksolid every 10 seconds when a route is selected
  useEffect(() => {
    if (!route?.id) return;
    const syncGps = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('sync-tracksolid', {
          method: 'POST',
        });
        if (!error && data?.success) {
          console.log(`Auto-sync GPS: ${data.synced} unidades actualizadas`);
          queryClient.invalidateQueries({ queryKey: ['public-gps-positions'] });
        }
      } catch (err) {
        console.warn('Auto-sync GPS error:', err);
      }
    };
    syncGps();
    const intervalId = setInterval(syncGps, 10000);
    return () => clearInterval(intervalId);
  }, [route?.id, queryClient]);

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
    refetchInterval: 10000,
  });

  // Clear animated positions when route changes
  useEffect(() => {
    setAnimatedPositions(new Map());
    lastPositionsRef.current = new Map();
  }, [route?.id]);

  // Update targets when positions change - set up smooth interpolation
  useEffect(() => {
    if (!positions || positions.length === 0) {
      setAnimatedPositions(new Map());
      return;
    }

    setAnimatedPositions((prev) => {
      const updated = new Map<string, AnimatedPosition>();

      positions.forEach((pos) => {
        const targetPos = { lat: Number(pos.latitude), lng: Number(pos.longitude) };
        const speed = Number(pos.speed) || 0;
        const heading = Number(pos.heading) || 0;
        const existing = prev.get(pos.unit_id);

        const lastKnown = lastPositionsRef.current.get(pos.unit_id);
        const coordsChanged = !lastKnown ||
          Math.abs(lastKnown.lat - targetPos.lat) > 0.000005 ||
          Math.abs(lastKnown.lng - targetPos.lng) > 0.000005;

        if (coordsChanged && existing) {
          // New GPS update: start smooth interpolation from current visual position to new target
          updated.set(pos.unit_id, {
            current: existing.current,
            startPos: { ...existing.current },
            target: targetPos,
            plateNumber: pos.units?.plate_number || 'Unidad',
            unitId: pos.unit_id,
            speed,
            heading,
            progress: 0, // reset interpolation
          });
          lastPositionsRef.current.set(pos.unit_id, targetPos);
        } else if (coordsChanged) {
          // First time seeing this unit
          updated.set(pos.unit_id, {
            current: targetPos,
            startPos: targetPos,
            target: targetPos,
            plateNumber: pos.units?.plate_number || 'Unidad',
            unitId: pos.unit_id,
            speed,
            heading,
            progress: 1,
          });
          lastPositionsRef.current.set(pos.unit_id, targetPos);
        } else if (existing) {
          // Same coords, just update speed/heading
          updated.set(pos.unit_id, { ...existing, speed, heading });
        } else {
          updated.set(pos.unit_id, {
            current: targetPos,
            startPos: targetPos,
            target: targetPos,
            plateNumber: pos.units?.plate_number || 'Unidad',
            unitId: pos.unit_id,
            speed,
            heading,
            progress: 1,
          });
          lastPositionsRef.current.set(pos.unit_id, targetPos);
        }
      });

      return updated;
    });
  }, [positions]);

  // Smooth animation loop - interpolates between startPos and target using easing
  useEffect(() => {
    let lastTick = Date.now();

    const tick = () => {
      const now = Date.now();
      const dt = now - lastTick;
      lastTick = now;

      setAnimatedPositions((prev) => {
        let changed = false;
        const updated = new Map(prev);

        updated.forEach((pos, unitId) => {
          if (pos.progress < 1) {
            // Increment progress based on time
            const progressIncrement = dt / INTERPOLATION_DURATION_MS;
            const newProgress = Math.min(1, pos.progress + progressIncrement);
            const easedProgress = easeInOutCubic(newProgress);

            const newCurrent = {
              lat: pos.startPos.lat + (pos.target.lat - pos.startPos.lat) * easedProgress,
              lng: pos.startPos.lng + (pos.target.lng - pos.startPos.lng) * easedProgress,
            };

            updated.set(unitId, { ...pos, current: newCurrent, progress: newProgress });
            changed = true;
          }
        });

        return changed ? updated : prev;
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const center = useMemo(() => {
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
    if (userLocation) return userLocation;
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

  // Convert animated positions map to array for rendering
  const animatedMarkersArray = useMemo(() => {
    return Array.from(animatedPositions.values());
  }, [animatedPositions]);

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
          {/* Route glow effect */}
          <Polyline
            path={routeCoordinates}
            options={{
              strokeColor: 'hsl(221, 83%, 53%)',
              strokeOpacity: 0.2,
              strokeWeight: 8,
            }}
          />
          <Polyline
            path={routeCoordinates}
            options={{
              strokeColor: 'hsl(221, 83%, 53%)',
              strokeOpacity: 0.85,
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

      {/* Animated unit markers with rotation and plate labels */}
      {animatedMarkersArray.map((animPos) => {
        const isMoving = animPos.speed > 2;
        return (
          <Marker
            key={animPos.unitId}
            position={animPos.current}
            title={`${animPos.plateNumber} - ${Math.round(animPos.speed)} km/h`}
            icon={{
              url: createBusIcon(animPos.heading, isMoving),
              scaledSize: new google.maps.Size(48, 48),
              anchor: new google.maps.Point(24, 24),
            }}
            label={{
              text: animPos.plateNumber.replace('TP-TEB-', ''),
              color: isMoving ? '#1e40af' : '#4b5563',
              fontSize: '10px',
              fontWeight: 'bold',
              className: 'bus-label',
            }}
          />
        );
      })}
    </GoogleMap>
  );
};

export default PublicCombinedMap;
