import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, Upload, LogOut, Users } from "lucide-react";

export function NavBar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) => location === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="cursor-pointer flex items-center gap-3 font-black text-xl font-['Space_Grotesk']" data-testid="link-home">
            {/* NEW: Professional gradient logo */}
            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/20">
              <Users className="w-5 h-5 text-white" strokeWidth={2.5} />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full border-2 border-background shadow-sm"></div>
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Contact Builder
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link 
              href="/" 
              className={`cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-3 ${
                isActive('/') 
                  ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' 
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
              data-testid="nav-dashboard"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link 
              href="/upload" 
              className={`cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-3 ${
                isActive('/upload') 
                  ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' 
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
              data-testid="nav-upload"
            >
              <Upload className="w-4 h-4" />
              Upload
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link 
            href="/profile" 
            className="cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground h-9 px-3"
            data-testid="nav-profile"
          >
            <Avatar className="w-6 h-6">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">Profile</span>
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