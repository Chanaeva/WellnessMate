import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2, Camera, X, FlashlightIcon as Flashlight, RotateCcw, Focus } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  width?: number;
  height?: number;
  fps?: number;
  qrbox?: number;
  disableFlip?: boolean;
}

export function QRScanner({
  onScan,
  onError,
  width = 300,
  height = 300,
  fps = 10,
  qrbox = 250,
  disableFlip = false
}: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-scanner-container';

  useEffect(() => {
    // Initialize scanner
    const newScanner = new Html5Qrcode(scannerContainerId);
    setScanner(newScanner);

    // Cleanup on unmount
    return () => {
      if (newScanner && newScanner.isScanning) {
        newScanner.stop().catch(console.error);
      }
    };
  }, []);

  const startScanning = async () => {
    if (!scanner) return;

    setIsLoading(true);
    setError(null);

    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps,
            qrbox
          },
          (decodedText) => {
            onScan(decodedText);
            stopScanning();
          },
          (errorMessage) => {
            // Don't update state on each frame error
            console.error('QR Scanner error:', errorMessage);
          }
        );
        setIsScanning(true);
      } else {
        throw new Error('No cameras found');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const stopScanning = async () => {
    if (scanner && scanner.isScanning) {
      try {
        await scanner.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      setIsScanning(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <div className="p-4 space-y-4">
        <div 
          id={scannerContainerId} 
          className="relative mx-auto overflow-hidden rounded-lg"
          style={{ 
            width: `${width}px`, 
            height: isScanning ? `${height}px` : '0px',
            transition: 'height 0.3s ease'
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          {!isScanning ? (
            <Button 
              onClick={startScanning} 
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
              Scan QR Code
            </Button>
          ) : (
            <Button 
              onClick={stopScanning} 
              variant="outline"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel Scan
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
