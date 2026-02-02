import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { QrCode, Loader2, Download, RefreshCw } from 'lucide-react';

interface PassengerQRGeneratorProps {
  clientId: string;
  userName: string;
}

interface PassengerQRCode {
  id: string;
  qr_code: string;
  employee_name: string;
  employee_id: string | null;
  is_active: boolean;
}

const PassengerQRGenerator = ({ clientId, userName }: PassengerQRGeneratorProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<PassengerQRCode | null>(null);
  const [passengerName, setPassengerName] = useState(userName);
  const [employeeId, setEmployeeId] = useState('');
  const { toast } = useToast();

  // Fetch existing QR code when dialog opens
  useEffect(() => {
    if (open) {
      fetchExistingQR();
    }
  }, [open]);

  const fetchExistingQR = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user already has a QR code
      const { data, error } = await supabase
        .from('passenger_qr_codes')
        .select('id, qr_code, employee_name, employee_id, is_active')
        .eq('client_id', clientId)
        .eq('employee_name', userName)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setQrData(data);
        setPassengerName(data.employee_name);
        setEmployeeId(data.employee_id || '');
      }
    } catch (error) {
      console.error('Error fetching QR:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQR = async () => {
    if (!passengerName.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa tu nombre',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Create new QR code entry
      const { data, error } = await supabase
        .from('passenger_qr_codes')
        .insert({
          client_id: clientId,
          employee_name: passengerName.trim(),
          employee_id: employeeId.trim() || null,
        })
        .select('id, qr_code, employee_name, employee_id, is_active')
        .single();

      if (error) throw error;

      setQrData(data);
      toast({
        title: 'QR Generado',
        description: 'Tu código QR ha sido creado exitosamente',
      });
    } catch (error: any) {
      console.error('Error generating QR:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo generar el código QR',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById('passenger-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR-${passengerName.replace(/\s+/g, '_')}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          size="icon" 
          variant="secondary"
          className="h-12 w-12 rounded-full shadow-lg bg-card hover:bg-accent"
        >
          <QrCode className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Mi Código QR
          </DialogTitle>
          <DialogDescription>
            Este código QR único te identifica como pasajero. El conductor lo escaneará al abordar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : qrData ? (
          <div className="flex flex-col items-center gap-4 py-4">
            {/* QR Code Display */}
            <div className="bg-white p-4 rounded-2xl shadow-inner">
              <QRCodeSVG
                id="passenger-qr-code"
                value={qrData.qr_code}
                size={200}
                level="H"
                includeMargin
              />
            </div>

            {/* Passenger Info */}
            <div className="text-center space-y-1">
              <p className="font-semibold text-lg">{qrData.employee_name}</p>
              {qrData.employee_id && (
                <p className="text-sm text-muted-foreground">ID: {qrData.employee_id}</p>
              )}
            </div>

            {/* Download Button */}
            <Button onClick={downloadQR} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Descargar QR
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="passengerName">Nombre completo</Label>
              <Input
                id="passengerName"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeeId">Número de empleado (opcional)</Label>
              <Input
                id="employeeId"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="Ej: EMP-001"
              />
            </div>

            <Button onClick={generateQR} className="w-full gap-2" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              Generar Mi Código QR
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PassengerQRGenerator;
