import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bus, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const PublicAccess = () => {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa un código de acceso',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Use rpc or raw query to avoid type issues with new column
      const { data, error } = await supabase
        .rpc('validate_access_code' as any, { p_code: accessCode.toUpperCase().trim() });

      // Fallback to direct query with type casting
      const result = await supabase
        .from('clients')
        .select('*')
        .limit(1);
      
      const clients = result.data as any[];
      const matchedClient = clients?.find(
        (c: any) => c.access_code === accessCode.toUpperCase().trim()
      );

      if (!matchedClient) {
        toast({
          title: 'Código inválido',
          description: 'No se encontró ningún cliente con ese código de acceso',
          variant: 'destructive',
        });
        return;
      }

      // Store client info in session storage
      sessionStorage.setItem('publicClientId', matchedClient.id);
      sessionStorage.setItem('publicClientName', matchedClient.name);
      sessionStorage.setItem('publicAccessCode', accessCode.toUpperCase().trim());
      
      navigate('/app');
    } catch {
      toast({
        title: 'Error',
        description: 'Ocurrió un error al verificar el código',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Bus className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">TransportePro</CardTitle>
          <p className="text-muted-foreground mt-2">
            Ingresa tu código de acceso para ver las rutas y ubicaciones en tiempo real
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Código de acceso (ej: ABC12345)"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="pl-10 text-center text-lg tracking-widest uppercase"
                maxLength={8}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verificando...' : 'Acceder'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicAccess;
