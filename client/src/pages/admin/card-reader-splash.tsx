import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Monitor, 
  Upload, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  Info,
  ImageIcon,
  Smartphone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface SplashScreenConfig {
  configurationId: string | null;
  fileId: string | null;
  fileUrl: string | null;
  isAccountDefault?: boolean;
}

export default function AdminCardReaderSplash() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: splashConfig, isLoading } = useQuery<SplashScreenConfig>({
    queryKey: ["/api/stripe/terminal/splash-screen"],
    queryFn: async () => {
      const res = await fetch("/api/stripe/terminal/splash-screen", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch splash screen config");
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/stripe/terminal/splash-screen", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/terminal/splash-screen"] });
      setSelectedFile(null);
      setPreviewUrl(null);
      toast({
        title: "Splash Screen Updated",
        description: data.message || "Your branded screen will appear on the reader within 10 minutes.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload splash screen",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stripe/terminal/splash-screen", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Remove failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/terminal/splash-screen"] });
      toast({
        title: "Splash Screen Removed",
        description: data.message || "Reader will return to default display within 10 minutes.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Remove Failed",
        description: error.message || "Failed to remove splash screen",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select a JPG or PNG image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Image must be under 2MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const hasSplashScreen = splashConfig?.fileId;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Smartphone className="h-6 w-6" />
          Card Reader Display
        </h2>
        <p className="text-muted-foreground mt-1">
          Customize the splash screen shown on your WisePOS E card reader when it's idle.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Upload a branded image to display on your card reader when it's not processing payments. 
          Changes take up to 10 minutes to appear on the reader. 
          Recommended size: <strong>720 x 1280 pixels</strong> (portrait orientation, JPG or PNG, under 2MB).
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Splash Screen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Monitor className="h-5 w-5" />
              Current Display
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : hasSplashScreen ? (
              <div className="space-y-4">
                <div className="relative bg-gray-900 rounded-2xl p-3 mx-auto max-w-[240px] shadow-lg">
                  <div className="bg-black rounded-xl overflow-hidden aspect-[9/16] flex items-center justify-center">
                    {splashConfig?.fileUrl ? (
                      <img
                        src={splashConfig.fileUrl.startsWith('http') ? splashConfig.fileUrl : `https://files.stripe.com${splashConfig.fileUrl}`}
                        alt="Current splash screen"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`flex flex-col items-center text-gray-400 ${splashConfig?.fileUrl ? 'hidden' : ''}`}>
                      <ImageIcon className="h-10 w-10 mb-2" />
                      <p className="text-xs text-center px-4">Branded image applied</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => removeMutation.mutate()}
                  disabled={removeMutation.isPending}
                >
                  {removeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Remove Splash Screen
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="relative bg-gray-900 rounded-2xl p-3 mx-auto max-w-[200px] shadow-lg mb-4">
                  <div className="bg-gray-800 rounded-xl aspect-[9/16] flex items-center justify-center">
                    <div className="text-gray-500">
                      <Monitor className="h-10 w-10 mx-auto mb-2" />
                      <p className="text-xs">Default Stripe Display</p>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">No Custom Splash Screen</Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  Upload an image to brand your reader
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload New Splash Screen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5" />
              Upload New Image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleFileSelect}
              className="hidden"
            />

            {previewUrl ? (
              <div className="space-y-4">
                <div className="relative bg-gray-900 rounded-2xl p-3 mx-auto max-w-[240px] shadow-lg">
                  <div className="bg-black rounded-xl overflow-hidden aspect-[9/16]">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  {selectedFile?.name} ({((selectedFile?.size || 0) / 1024).toFixed(0)} KB)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 wellness-button-primary"
                    onClick={handleUpload}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Apply to Reader
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Click to select an image</p>
                <p className="text-sm text-muted-foreground mt-1">
                  JPG or PNG, 720 x 1280px recommended, max 2MB
                </p>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Image Guidelines</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Resolution: 720 x 1280 pixels (portrait)</li>
                <li>• Format: JPG or PNG</li>
                <li>• Max file size: 2MB</li>
                <li>• The image will be shown when the reader is idle</li>
                <li>• Changes take up to 10 minutes to appear</li>
                <li>• Keep important content centered — edges may be cropped</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}