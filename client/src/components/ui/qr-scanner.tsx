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
  const isMobile = useIsMobile();
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<number>(0);
  const [hasPermission, setHasPermission] = useState(false);
  const scannerContainerId = 'qr-scanner-container';
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize scanner and check for camera permissions
    const newScanner = new Html5Qrcode(scannerContainerId);
    setScanner(newScanner);

    // Check camera permissions and get available cameras
    const initializeCameras = async () => {
      try {
        const availableCameras = await Html5Qrcode.getCameras();
        setCameras(availableCameras);
        setHasPermission(true);
        
        // Default to back camera on mobile if available
        if (isMobile && availableCameras.length > 1) {
          const backCamera = availableCameras.findIndex(camera => 
            camera.label.toLowerCase().includes('back') || 
            camera.label.toLowerCase().includes('rear')
          );
          if (backCamera !== -1) {
            setSelectedCamera(backCamera);
          }
        }
      } catch (err) {
        console.error('Camera initialization error:', err);
        setError('Camera permission required for QR scanning');
      }
    };

    initializeCameras();

    // Cleanup on unmount
    return () => {
      if (newScanner && newScanner.isScanning) {
        newScanner.stop().catch(console.error);
      }
    };
  }, [isMobile]);

  const startScanning = async () => {
    if (!scanner || !hasPermission) return;

    setIsLoading(true);
    setError(null);

    try {
      if (cameras && cameras.length > 0) {
        const cameraId = cameras[selectedCamera]?.id || { facingMode: "environment" };
        
        await scanner.start(
          cameraId,
          {
            fps: isMobile ? 5 : fps, // Lower FPS on mobile for better performance
            qrbox: isMobile ? Math.min(qrbox, width - 40) : qrbox,
            aspectRatio: isMobile ? 1.0 : 1.777778 // Square aspect ratio on mobile
          },
          (decodedText) => {
            // Vibrate on successful scan (mobile only)
            if (isMobile && navigator.vibrate) {
              navigator.vibrate(200);
            }
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
        throw new Error('No cameras available');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTorch = async () => {
    if (scanner && isScanning) {
      try {
        // Try to toggle torch using the camera track
        const videoTracks = scanner.getState().localMediaStream?.getVideoTracks();
        if (videoTracks && videoTracks.length > 0) {
          const track = videoTracks[0];
          const capabilities = track.getCapabilities();
          
          if ('torch' in capabilities) {
            await track.applyConstraints({
              advanced: [{ torch: !torchEnabled } as any]
            });
            setTorchEnabled(!torchEnabled);
          }
        }
      } catch (err) {
        console.error('Torch control error:', err);
        // Torch not supported, hide the button
      }
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    
    const wasScanning = isScanning;
    if (wasScanning) {
      await stopScanning();
    }
    
    setSelectedCamera((prev) => (prev + 1) % cameras.length);
    
    if (wasScanning) {
      setTimeout(startScanning, 500); // Small delay before restarting
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

  const actualWidth = isMobile ? Math.min(width, window.innerWidth - 32) : width;
  const actualHeight = isMobile ? actualWidth : height;

  return (
    <Card className="w-full max-w-md mx-auto">
      <div className="p-4 space-y-4">
        {/* Camera preview container */}
        <div 
          ref={scannerRef}
          id={scannerContainerId} 
          className="relative mx-auto overflow-hidden rounded-lg bg-gray-900"
          style={{ 
            width: `${actualWidth}px`, 
            height: isScanning ? `${actualHeight}px` : '200px',
            transition: 'height 0.3s ease'
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="text-center text-white">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">Starting camera...</p>
              </div>
            </div>
          )}
          
          {!isScanning && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-center">
              <div>
                <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm opacity-75">Tap to start scanning</p>
              </div>
            </div>
          )}

          {/* Mobile camera controls overlay */}
          {isScanning && isMobile && (
            <div className="absolute top-2 right-2 flex flex-col space-y-2 z-20">
              {cameras.length > 1 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-black/50 text-white border-white/20 h-8 w-8 p-0"
                  onClick={switchCamera}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                className={`bg-black/50 text-white border-white/20 h-8 w-8 p-0 ${torchEnabled ? 'bg-yellow-500/50' : ''}`}
                onClick={toggleTorch}
              >
                <Flashlight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            <div className="flex items-center">
              <X className="h-4 w-4 mr-2" />
              {error}
            </div>
            {error.includes('permission') && (
              <p className="text-xs mt-2 opacity-75">
                Please allow camera access to scan QR codes
              </p>
            )}
          </div>
        )}

        {/* Control buttons */}
        <div className="flex justify-center space-x-3">
          {!isScanning ? (
            <Button 
              onClick={startScanning} 
              disabled={isLoading || !hasPermission}
              className="bg-primary hover:bg-primary/90 flex-1 max-w-xs"
              size={isMobile ? "lg" : "default"}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              {isMobile ? 'Start Scanning' : 'Scan QR Code'}
            </Button>
          ) : (
            <>
              <Button 
                onClick={stopScanning} 
                variant="outline"
                className="flex-1 max-w-xs"
                size={isMobile ? "lg" : "default"}
              >
                <X className="h-4 w-4 mr-2" />
                Stop Scan
              </Button>
              
              {/* Desktop camera controls */}
              {!isMobile && (
                <>
                  {cameras.length > 1 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={switchCamera}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={toggleTorch}
                    className={torchEnabled ? 'bg-yellow-100' : ''}
                  >
                    <Flashlight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>

        {/* Mobile scanning tips */}
        {isMobile && isScanning && (
          <div className="text-center text-sm text-gray-600 space-y-1">
            <p>Hold steady and point at QR code</p>
            <p className="text-xs opacity-75">Device will vibrate when scanned successfully</p>
          </div>
        )}

        {/* Camera info */}
        {cameras.length > 0 && (
          <div className="text-xs text-center text-gray-500">
            {cameras.length > 1 ? (
              <p>Camera: {cameras[selectedCamera]?.label || 'Unknown'} ({selectedCamera + 1}/{cameras.length})</p>
            ) : (
              <p>Camera ready</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
