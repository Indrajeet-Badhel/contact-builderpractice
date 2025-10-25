import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, Upload, User, LogOut } from "lucide-react";

export function NavBar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) => location === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/">
            <a className="flex items-center gap-2 font-black text-xl font-['Space_Grotesk']" data-testid="link-home">
              <div className="w-8 h-8 bg-foreground text-background flex items-center justify-center rounded-md font-black">
                CB
              </div>
              Contact Builder
            </a>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link href="/">
              <a>
                <Button
                  variant={isActive('/') ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2"
                  data-testid="nav-dashboard"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Button>
              </a>
            </Link>
            <Link href="/upload">
              <a>
                <Button
                  variant={isActive('/upload') ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2"
                  data-testid="nav-upload"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </Button>
              </a>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/profile">
            <a>
              <Button variant="ghost" size="sm" className="gap-2" data-testid="nav-profile">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">Profile</span>
              </Button>
            </a>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/api/logout'}
            className="gap-2"
            data-testid="button-nav-logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
