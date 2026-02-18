import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Shield } from 'lucide-react';
import tebsaLogo from '@/assets/tebsa-eagle-logo.png';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          <img src={tebsaLogo} alt="TEBSA" className="mx-auto w-28 h-28 object-contain drop-shadow-lg" />
          <h1 className="text-2xl font-bold text-foreground">Sistema de Transporte de Personal</h1>
        </div>

        <div className="grid gap-4">
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 hover:border-primary/50"
            onClick={() => navigate('/public-login')}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold text-foreground">APP</h2>
                <p className="text-sm text-muted-foreground">Consulta el estado de las rutas en tiempo real</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 hover:border-primary/50"
            onClick={() => navigate('/login')}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold text-foreground">Administración</h2>
                <p className="text-sm text-muted-foreground">Panel de gestión y configuración del sistema</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <button
          onClick={() => navigate('/privacidad')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          Aviso de Privacidad
        </button>
      </div>
    </div>
  );
};

export default Index;
