import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function TopBar() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="h-16 glass-panel border-b px-6 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h2 className="enterprise-heading text-lg">Enterprise Dashboard</h2>
        <div className="flex items-center space-x-2 text-muted-foreground text-sm">
          <motion.div
            className="w-2 h-2 bg-accent rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
          <span data-testid="sse-status">Real-time SSE Active</span>
        </div>
      </div>
      
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
