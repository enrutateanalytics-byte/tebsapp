import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Route, Bus, CalendarClock } from 'lucide-react';

const Dashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [clients, routes, units, assignments] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('routes').select('*', { count: 'exact', head: true }),
        supabase.from('units').select('*', { count: 'exact', head: true }),
        supabase.from('assignments').select('*', { count: 'exact', head: true }),
      ]);
      
      return {
        clients: clients.count ?? 0,
        routes: routes.count ?? 0,
        units: units.count ?? 0,
        assignments: assignments.count ?? 0,
      };
    },
  });

  const statCards = [
    { title: 'Clientes', value: stats?.clients ?? 0, icon: Building2, color: 'text-blue-600' },
    { title: 'Rutas', value: stats?.routes ?? 0, icon: Route, color: 'text-green-600' },
    { title: 'Unidades', value: stats?.units ?? 0, icon: Bus, color: 'text-orange-600' },
    { title: 'Asignaciones', value: stats?.assignments ?? 0, icon: CalendarClock, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-1">Resumen general del sistema</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color}`} />
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="text-2xl md:text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Bienvenido a TransportePro</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm md:text-base p-4 pt-0 md:p-6 md:pt-0">
          <p>Este sistema te permite gestionar:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>Clientes:</strong> Empresas que contratan el servicio</li>
            <li><strong>Rutas:</strong> Recorridos con visualización en mapa</li>
            <li><strong>Unidades:</strong> Vehículos con información del conductor</li>
            <li><strong>Asignaciones:</strong> Programación de rutas</li>
            <li><strong>Rastreo GPS:</strong> Seguimiento en tiempo real</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
