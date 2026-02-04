import { useState, useEffect, useRef } from "react";
import { loadStripeTerminal, Terminal, Reader } from "@stripe/terminal-js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wifi, WifiOff, RefreshCw, CreditCard, CheckCircle, XCircle } from "lucide-react";

export default function AdminCardReaders() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredReaders, setDiscoveredReaders] = useState<Reader[]>([]);
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
  const [terminalLocationId, setTerminalLocationId] = useState<string | null>(null);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    initializeTerminal();
    // Fetch Terminal location for WisePOS E reader discovery
    fetch('/api/stripe/terminal/location')
      .then(res => res.json())
      .then(data => {
        if (data.location?.id) {
          console.log('[Card Reader] Terminal location fetched:', data.location.id);
          setTerminalLocationId(data.location.id);
        }
      })
      .catch(err => console.error('[Card Reader] Failed to fetch terminal location:', err));
    
    return () => {
      if (terminalRef.current && connectedReader) {
        terminalRef.current.disconnectReader();
      }
    };
  }, []);

  const initializeTerminal = async () => {
    try {
      const StripeTerminal = await loadStripeTerminal();
      if (!StripeTerminal) {
        setTerminalStatus('error');
        return;
      }

      const terminal = StripeTerminal.create({
        onFetchConnectionToken: async () => {
          const response = await fetch('/api/stripe/terminal/connection-token', {
            method: 'POST',
            credentials: 'include',
          });
          const data = await response.json();
          return data.secret;
        },
        onUnexpectedReaderDisconnect: () => {
          setConnectedReader(null);
          toast({
            title: "Reader Disconnected",
            description: "The card reader was unexpectedly disconnected",
            variant: "destructive",
          });
        },
      });

      terminalRef.current = terminal;
      setTerminalStatus('ready');
    } catch (error) {
      console.error('Failed to initialize terminal:', error);
      setTerminalStatus('error');
    }
  };

  const discoverReaders = async () => {
    if (!terminalRef.current) {
      toast({ title: "Error", description: "Terminal not initialized", variant: "destructive" });
      return;
    }

    setIsDiscovering(true);
    setDiscoveredReaders([]);

    try {
      // WisePOS E requires a location ID for discovery
      const result = await terminalRef.current.discoverReaders({
        simulated: false,
        ...(terminalLocationId ? { location: terminalLocationId } : {}),
      });

      if ('error' in result) {
        toast({
          title: "Discovery Error",
          description: result.error.message,
          variant: "destructive",
        });
        setDiscoveredReaders([]);
      } else {
        setDiscoveredReaders(result.discoveredReaders);
        if (result.discoveredReaders.length === 0) {
          toast({
            title: "No Readers Found",
            description: "Make sure your reader is powered on and connected to the same network",
          });
        } else {
          toast({
            title: "Readers Found",
            description: `Discovered ${result.discoveredReaders.length} reader(s)`,
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDiscovering(false);
    }
  };

  const connectToReader = async (reader: Reader) => {
    if (!terminalRef.current) return;

    setIsLoading(true);
    try {
      if (connectedReader) {
        await terminalRef.current.disconnectReader();
      }

      const result = await terminalRef.current.connectReader(reader);
      
      if ('error' in result) {
        toast({
          title: "Connection Failed",
          description: result.error.message,
          variant: "destructive",
        });
      } else {
        setConnectedReader(result.reader);
        toast({
          title: "Reader Connected",
          description: `Successfully connected to ${result.reader.label || result.reader.id}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Connection Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectReader = async () => {
    if (!terminalRef.current || !connectedReader) return;

    setIsLoading(true);
    try {
      await terminalRef.current.disconnectReader();
      setConnectedReader(null);
      toast({
        title: "Disconnected",
        description: "Card reader has been disconnected",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getReaderStatusBadge = (reader: Reader) => {
    if (connectedReader?.id === reader.id) {
      return <Badge className="bg-green-500">Connected</Badge>;
    }
    switch (reader.status) {
      case 'online':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Online</Badge>;
      case 'offline':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Offline</Badge>;
      default:
        return <Badge variant="outline">{reader.status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Card Reader Management
          </CardTitle>
          <CardDescription>
            Discover and connect to Stripe Terminal card readers on your network
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {terminalStatus === 'initializing' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Initializing Stripe Terminal...
            </div>
          )}

          {terminalStatus === 'error' && (
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              Failed to initialize Stripe Terminal
            </div>
          )}

          {terminalStatus === 'ready' && (
            <>
              {connectedReader && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">
                          {connectedReader.label || 'Card Reader'}
                        </p>
                        <p className="text-sm text-green-700">
                          {connectedReader.device_type} • {connectedReader.id}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={disconnectReader}
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={discoverReaders}
                  disabled={isDiscovering}
                  className="flex items-center gap-2"
                >
                  {isDiscovering ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Discovering...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Discover Readers
                    </>
                  )}
                </Button>
              </div>

              {discoveredReaders.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Discovered Readers ({discoveredReaders.length})
                  </h4>
                  <div className="space-y-2">
                    {discoveredReaders.map((reader) => (
                      <div
                        key={reader.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {reader.status === 'online' ? (
                            <Wifi className="h-5 w-5 text-green-600" />
                          ) : (
                            <WifiOff className="h-5 w-5 text-gray-400" />
                          )}
                          <div>
                            <p className="font-medium">
                              {reader.label || reader.device_type}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {reader.id}
                            </p>
                            {reader.ip_address && (
                              <p className="text-xs text-muted-foreground">
                                IP: {reader.ip_address}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getReaderStatusBadge(reader)}
                          {connectedReader?.id !== reader.id && reader.status === 'online' && (
                            <Button
                              size="sm"
                              onClick={() => connectToReader(reader)}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Connect'
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isDiscovering && discoveredReaders.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Wifi className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Click "Discover Readers" to find card readers on your network</p>
                  <p className="text-sm mt-1">
                    Make sure the reader is powered on and connected to WiFi
                  </p>
                </div>
              )}

              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-4">
                  <div className="flex gap-3">
                    <CreditCard className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900">Using a Stripe Reader M2 (Bluetooth)?</p>
                      <p className="text-sm text-amber-800 mt-1">
                        The M2 reader connects via Bluetooth and must be paired through the Stripe Dashboard or a mobile app. 
                        Browser-based discovery only works with WiFi readers (WisePOS E, S700).
                      </p>
                      <p className="text-sm text-amber-800 mt-2">
                        <strong>To pair your M2:</strong>
                      </p>
                      <ol className="text-sm text-amber-800 mt-1 list-decimal list-inside space-y-1">
                        <li>Go to <a href="https://dashboard.stripe.com/terminal/readers" target="_blank" rel="noopener noreferrer" className="underline font-medium">Stripe Dashboard → Readers</a></li>
                        <li>Click "Register a reader"</li>
                        <li>Enter the registration code shown on your M2 screen</li>
                        <li>Once registered, use the M2 with the Stripe mobile app or iPad POS</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
