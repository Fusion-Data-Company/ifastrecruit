import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import NotificationSystem from "@/components/NotificationSystem";

export default function TopBar() {
  const [searchQuery, setSearchQuery] = useState("");

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
        
        <Button
          variant="ghost"
          size="sm"
          className="glass-panel px-2 md:px-4 py-2 rounded-lg glow-hover micro-animation"
          data-testid="settings-button"
        >
          <i className="fas fa-cog text-muted-foreground"></i>
        </Button>
      </div>
    </div>
  );
}
