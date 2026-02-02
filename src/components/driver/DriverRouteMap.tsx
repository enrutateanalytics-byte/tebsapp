import { useEffect, useState, useCallback } from 'react';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Stop {
  name: string;
  lat: number;
  lng: number;
  order?: number;
}

interface DriverRouteMapProps {
  routeId: string;
  showDriverLocation?: boolean;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 19.4326,
  lng: -99.1332,
};

const DriverRouteMap = ({ routeId, showDriverLocation = true }: DriverRouteMapProps) => {
  const [stops, setStops] = useState<Stop[]>([]);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => {
    fetchRouteData();
    
    if (showDriverLocation) {
      startWatchingLocation();
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [routeId, showDriverLocation]);

  const fetchRouteData = async () => {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('stops')
        .eq('id', routeId)
        .single();

      if (error) throw error;

      if (data?.stops && Array.isArray(data.stops)) {
        const parsedStops = (data.stops as any[]).map((stop: any) => ({
          name: stop.name || 'Parada',
          lat: parseFloat(stop.lat) || 0,
          lng: parseFloat(stop.lng) || 0,
          order: stop.order,
        })).filter(s => s.lat !== 0 && s.lng !== 0);
        
        setStops(parsedStops);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    } finally {
      setLoading(false);
    }
  };

  const startWatchingLocation = () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setDriverLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    setWatchId(id);
  };

  const getCenter = useCallback(() => {
    if (driverLocation) return driverLocation;
    if (stops.length > 0) return { lat: stops[0].lat, lng: stops[0].lng };
    return defaultCenter;
  }, [driverLocation, stops]);

  const pathCoordinates = stops.map(stop => ({ lat: stop.lat, lng: stop.lng }));

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={getCenter()}
      zoom={14}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }}
    >
      {/* Route path */}
      {pathCoordinates.length > 1 && (
        <Polyline
          path={pathCoordinates}
          options={{
            strokeColor: '#3b82f6',
            strokeOpacity: 0.8,
            strokeWeight: 4,
          }}
        />
      )}

      {/* Stops markers */}
      {stops.map((stop, index) => (
        <Marker
          key={index}
          position={{ lat: stop.lat, lng: stop.lng }}
          label={{
            text: `${index + 1}`,
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
          title={stop.name}
        />
      ))}

      {/* Driver location marker */}
      {driverLocation && (
        <Marker
          position={driverLocation}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#22c55e',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          }}
          title="Tu ubicación"
        />
      )}
    </GoogleMap>
  );
};

export default DriverRouteMap;
