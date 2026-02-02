import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, X } from 'lucide-react';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const QRScanner = ({ onScan, onError, isOpen, onClose }: QRScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !isScanning) {
      startScanning();
    }
    
    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async () => {
    if (!containerRef.current) return;

    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScan(decodedText);
          stopScanning();
          onClose();
        },
        (errorMessage) => {
          // Ignore scan errors (no QR found in frame)
        }
      );

      setIsScanning(true);
    } catch (error: any) {
      console.error('Error starting scanner:', error);
      onError?.(error.message || 'Error al iniciar la cámara');
      onClose();
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <h2 className="text-white text-lg font-semibold">Escanear QR</h2>
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <X className="w-6 h-6 text-white" />
        </Button>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm overflow-hidden">
          <CardContent className="p-0">
            <div 
              id="qr-reader" 
              ref={containerRef}
              className="w-full aspect-square"
            />
          </CardContent>
        </Card>
      </div>

      <div className="p-4 text-center">
        <p className="text-white/80 text-sm">
          Apunta la cámara al código QR del pasajero
        </p>
      </div>
    </div>
  );
};

export default QRScanner;
