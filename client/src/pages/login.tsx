// client/src/pages/login.tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, LogIn, ArrowLeft } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        toast({
          title: "Login successful",
          description: "Welcome back!",
        });
        setLocation("/");
      } else {
        const data = await response.json();
        toast({
          title: "Login failed",
          description: data.message || "Invalid email or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Contact Builder" className="w-16 h-16 mx-auto mb-4" />
          
          <h1 className="text-2xl font-black font-['Space_Grotesk'] bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Welcome Back
          </h1>
          <p className="text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                autoComplete="email"
                required
                data-testid="input-email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                autoComplete="current-password"
                required
                data-testid="input-password"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            data-testid="button-login"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <LogIn className="w-4 h-4 mr-2" />
            )}
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="text-muted-foreground"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </Card>
    </div>
  );
}
