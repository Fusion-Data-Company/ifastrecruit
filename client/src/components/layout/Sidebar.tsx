import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navigationItems = [
    { path: "/", label: "Dashboard", icon: "fas fa-chart-line" },
    { path: "/candidates", label: "Candidates", icon: "fas fa-users" },
    { path: "/interviews", label: "Interviews", icon: "fas fa-calendar-alt" },
    { path: "/indeed", label: "Indeed Integration", icon: "fas fa-briefcase" },
    { path: "/apify", label: "Apify Integration", icon: "fas fa-robot" },
    { path: "/airtop", label: "Airtop Integration", icon: "fas fa-desktop" },
    { path: "/email", label: "Email Studio", icon: "fas fa-envelope" },
    { path: "/slack", label: "Slack Pools", icon: "fab fa-slack" },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost" 
        size="sm"
        className="md:hidden fixed top-4 left-4 z-50 glass-panel p-2"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="mobile-menu-toggle"
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-bars'} text-foreground`}></i>
      </Button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div 
        initial={false}
        animate={{ x: isOpen ? 0 : -280 }}
        className={`w-64 fixed left-0 top-0 h-full glass-panel border-r z-50 md:z-40 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
      <div className="p-6">
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-bolt text-primary-foreground text-lg"></i>
          </div>
          <div>
            <h1 className="enterprise-heading text-xl text-foreground">iFast</h1>
            <p className="text-muted-foreground text-sm">Broker</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = location === item.path || (item.path === "/" && location === "/dashboard");
            
            return (
              <Link key={item.path} href={item.path}>
                <motion.div
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg cursor-pointer micro-animation ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid={`nav-${item.path.slice(1) || "dashboard"}`}
                >
                  <i className={`${item.icon} w-5`}></i>
                  <span className="font-medium">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Voice Agent Status */}
        <div className="mt-8 p-4 glass-panel rounded-lg">
          <h3 className="enterprise-heading text-sm font-semibold mb-3">Voice Agents</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="status-indicator bg-accent"></div>
                <span className="text-sm">UI Interface</span>
              </div>
              <span className="text-xs text-muted-foreground" data-testid="agent-ui-status">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="status-indicator bg-primary"></div>
                <span className="text-sm">Interview</span>
              </div>
              <span className="text-xs text-muted-foreground" data-testid="agent-interview-status">Ready</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="status-indicator bg-muted-foreground"></div>
                <span className="text-sm">Onboarding</span>
              </div>
              <span className="text-xs text-muted-foreground" data-testid="agent-onboarding-status">Idle</span>
            </div>
          </div>
        </div>

        {/* Silent Agent Status */}
        <div className="mt-4 p-4 glass-panel rounded-lg">
          <h3 className="enterprise-heading text-sm font-semibold mb-3">Silent Agents</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { name: "Campaign", status: "active" },
              { name: "Data Proc", status: "active" },
              { name: "Email", status: "active" },
              { name: "Calendar", status: "active" },
              { name: "Slack", status: "active" },
              { name: "Airtop", status: "active" },
            ].map((agent, index) => (
              <div key={agent.name} className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${index % 2 === 0 ? "bg-accent" : "bg-primary"}`}></div>
                <span data-testid={`silent-agent-${agent.name.toLowerCase().replace(" ", "")}`}>
                  {agent.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </motion.div>
    </>
  );
}
