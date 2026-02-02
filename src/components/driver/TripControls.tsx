import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Square, Loader2 } from 'lucide-react';

interface TripControlsProps {
  isStarted: boolean;
  isEnded: boolean;
  isLoading: boolean;
  onStart: () => void;
  onEnd: () => void;
}

const TripControls = ({ isStarted, isEnded, isLoading, onStart, onEnd }: TripControlsProps) => {
  if (isEnded) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Viaje finalizado</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="font-medium text-primary">Completado</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        {!isStarted ? (
          <Button 
            className="w-full" 
            size="lg" 
            onClick={onStart}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Play className="w-5 h-5 mr-2" />
            )}
            Iniciar Viaje
          </Button>
        ) : (
          <Button 
            className="w-full" 
            size="lg" 
            variant="destructive"
            onClick={onEnd}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Square className="w-5 h-5 mr-2" />
            )}
            Finalizar Viaje
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default TripControls;
