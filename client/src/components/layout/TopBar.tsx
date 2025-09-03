import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import NotificationSystem from "@/components/NotificationSystem";

export default function TopBar() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="h-16 glass-panel border-b px-6 flex items-center justify-end">
      <div className="flex items-center space-x-4">
        <div className="glass-input px-3 py-1 rounded-lg flex items-center space-x-2">
          <i className="fas fa-search text-muted-foreground"></i>
          <Input
            type="text"
            placeholder="Search candidates..."
            className="bg-transparent border-none outline-none text-sm w-64 p-0 h-auto focus-visible:ring-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="search-candidates"
          />
        </div>
        <NotificationSystem />
        
        <Button
          variant="ghost"
          size="sm"
          className="glass-panel px-4 py-2 rounded-lg glow-hover micro-animation"
          data-testid="settings-button"
        >
          <i className="fas fa-cog text-muted-foreground"></i>
        </Button>
      </div>
    </div>
  );
}
