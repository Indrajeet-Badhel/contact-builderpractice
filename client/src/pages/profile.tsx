import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User, 
  Key, 
  Settings as SettingsIcon, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle,
  Mail,
  RefreshCw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ApiKey } from "@shared/schema";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const { data: apiKeys = [] } = useQuery<ApiKey[]>({
    queryKey: ['/api/api-keys'],
  });

  const saveApiKeyMutation = useMutation({
    mutationFn: async ({ service, keyName, value }: { service: string; keyName: string; value: string }) => {
      return await apiRequest('POST', '/api/api-keys', { service, keyName, encryptedValue: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      toast({
        title: "API Key Saved",
        description: "Your API key has been securely stored.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest('POST', `/api/api-keys/${keyId}/test`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      toast({
        title: "Connection Successful",
        description: "API key is valid and working.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const apiServices = [
    {
      service: 'gemini',
      name: 'Gemini AI',
      description: 'Required for AI-powered document extraction',
      keys: [{ name: 'api_key', label: 'API Key', placeholder: 'AIza...' }],
    },
    {
      service: 'gmail',
      name: 'Gmail',
      description: 'For reading and extracting contacts from emails',
      keys: [
        { name: 'client_id', label: 'Client ID', placeholder: 'your-client-id.apps.googleusercontent.com' },
        { name: 'client_secret', label: 'Client Secret', placeholder: 'your-client-secret' },
      ],
    },
    {
      service: 'hubspot',
      name: 'HubSpot CRM',
      description: 'Sync contacts directly to your HubSpot account',
      keys: [{ name: 'api_key', label: 'API Key', placeholder: 'pat-na1-...' }],
    },
    {
      service: 'huggingface',
      name: 'Hugging Face',
      description: 'Advanced NLP and entity recognition',
      keys: [{ name: 'api_token', label: 'API Token', placeholder: 'hf_...' }],
    },
  ];

  const getServiceKeys = (service: string) => {
    return apiKeys.filter(k => k.service === service);
  };

  const isServiceConfigured = (service: string) => {
    const requiredKeys = apiServices.find(s => s.service === service)?.keys || [];
    const configuredKeys = getServiceKeys(service);
    return requiredKeys.every(rk => 
      configuredKeys.some(ck => ck.keyName === rk.name)
    );
  };

  const toggleShowKey = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-2 font-['Space_Grotesk']">
            Profile & Settings
          </h1>
          <p className="text-muted-foreground text-lg">
            Manage your account and API integrations
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="profile" data-testid="tab-profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="api-keys" data-testid="tab-api-keys">
              <Key className="w-4 h-4 mr-2" />
              API Keys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-start gap-6">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                    {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground mb-1">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email
                    }
                  </h3>
                  {user?.email && (
                    <p className="text-muted-foreground flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {user.email}
                    </p>
                  )}
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">
                Account Actions
              </h3>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/api/logout'}
                data-testid="button-logout"
              >
                Sign Out
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="api-keys" className="space-y-6">
            <div className="bg-muted/50 border rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                <strong>Secure Storage:</strong> All API keys are encrypted before storage. 
                Only you have access to your credentials.
              </p>
            </div>

            {apiServices.map((serviceConfig) => {
              const isConfigured = isServiceConfigured(serviceConfig.service);
              const serviceKeys = getServiceKeys(serviceConfig.service);

              return (
                <Card key={serviceConfig.service} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-foreground">
                          {serviceConfig.name}
                        </h3>
                        <Badge variant={isConfigured ? "default" : "secondary"}>
                          {isConfigured ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Connected
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Not Connected
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {serviceConfig.description}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {serviceConfig.keys.map((keyConfig) => {
                      const existingKey = serviceKeys.find(k => k.keyName === keyConfig.name);
                      const keyId = existingKey?.id || '';

                      return (
                        <div key={keyConfig.name} className="space-y-2">
                          <Label htmlFor={`${serviceConfig.service}-${keyConfig.name}`}>
                            {keyConfig.label}
                          </Label>
                          <div className="flex gap-2">
                            <div className="flex-1 relative">
                              <Input
                                id={`${serviceConfig.service}-${keyConfig.name}`}
                                type={showKeys[keyId] ? "text" : "password"}
                                placeholder={keyConfig.placeholder}
                                defaultValue={existingKey ? "••••••••••••••••" : ""}
                                onChange={(e) => {
                                  if (e.target.value && e.target.value !== "••••••••••••••••") {
                                    saveApiKeyMutation.mutate({
                                      service: serviceConfig.service,
                                      keyName: keyConfig.name,
                                      value: e.target.value,
                                    });
                                  }
                                }}
                                data-testid={`input-${serviceConfig.service}-${keyConfig.name}`}
                              />
                              {existingKey && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                                  onClick={() => toggleShowKey(keyId)}
                                  data-testid={`button-toggle-visibility-${keyId}`}
                                >
                                  {showKeys[keyId] ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                            {existingKey && (
                              <Button
                                variant="outline"
                                onClick={() => testApiKeyMutation.mutate(existingKey.id)}
                                disabled={testApiKeyMutation.isPending}
                                data-testid={`button-test-${existingKey.id}`}
                              >
                                <RefreshCw className={`w-4 h-4 mr-2 ${testApiKeyMutation.isPending ? 'animate-spin' : ''}`} />
                                Test
                              </Button>
                            )}
                          </div>
                          {existingKey?.lastValidated && (
                            <p className="text-xs text-muted-foreground">
                              Last validated: {new Date(existingKey.lastValidated).toLocaleString()}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
