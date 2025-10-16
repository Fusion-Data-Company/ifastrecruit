import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut } from "lucide-react";
import NotificationSystem from "@/components/NotificationSystem";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
}

export default function TopBar() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="h-16 glass-panel border-b px-4 md:px-6 flex items-center justify-between md:justify-end pl-16 md:pl-6">
      {/* Page title - shown on mobile */}
      <h1 className="text-lg font-semibold text-foreground md:hidden">iFast Broker</h1>
      
      <div className="flex items-center space-x-2 md:space-x-4">
        <div className="glass-input px-2 md:px-3 py-1 rounded-lg flex items-center space-x-2">
          <i className="fas fa-search text-muted-foreground"></i>
          <Input
            type="text"
            placeholder="Search..."
            className="bg-transparent border-none outline-none text-sm w-32 md:w-64 p-0 h-auto focus-visible:ring-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="search-candidates"
          />
        </div>
        <NotificationSystem />
        
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="glass-panel px-2 md:px-4 py-2 rounded-lg glow-hover micro-animation"
                data-testid="profile-button"
              >
                <User className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" data-testid="profile-menu">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none" data-testid="user-email">
                    {user.email}
                  </p>
                  {user.firstName && user.lastName && (
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.firstName} {user.lastName}
                    </p>
                  )}
                  {user.isAdmin && (
                    <p className="text-xs leading-none text-cyan-400 font-medium">Admin</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="logout-button">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
