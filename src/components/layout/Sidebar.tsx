import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Building2, 
  Route, 
  Bus, 
  CalendarClock,
  MapPin,
  LogOut,
  Menu,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import tebsaLogo from '@/assets/tebsa-logo.png';

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { signOut, user, isAdmin, isSupervisor } = useAuth();

  // Menu items - Supervisors page only visible to admins
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Building2, label: 'Clientes', path: '/clients' },
    { icon: Route, label: 'Rutas', path: '/routes' },
    { icon: Bus, label: 'Unidades', path: '/units' },
    { icon: CalendarClock, label: 'Asignaciones', path: '/assignments' },
    { icon: MapPin, label: 'Rastreo GPS', path: '/tracking' },
    ...(isAdmin ? [{ icon: Users, label: 'Supervisores', path: '/supervisors' }] : []),
  ];

  const getRoleLabel = () => {
    if (isAdmin) return 'Administrador';
    if (isSupervisor) return 'Supervisor';
    return 'Usuario';
  };

  return (
    <>
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <img src={tebsaLogo} alt="TEBSA" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="font-bold text-lg text-primary">TEBSA</h1>
            <p className="text-xs text-muted-foreground">Gestión de Transporte</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 md:p-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 md:p-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 md:px-4 py-2 mb-2">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-xs font-medium shrink-0">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground">{getRoleLabel()}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground"
          onClick={async () => {
            await signOut();
            window.location.href = '/login';
          }}
        >
          <LogOut className="w-4 h-4 mr-3" />
          Cerrar Sesión
        </Button>
      </div>
    </>
  );
};

// Mobile sidebar using Sheet
export const MobileSidebar = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72">
        <div className="flex flex-col h-full">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Desktop sidebar
const Sidebar = () => {
  return (
    <aside className="hidden md:flex w-64 bg-card border-r border-border h-screen flex-col">
      <SidebarContent />
    </aside>
  );
};

export default Sidebar;
