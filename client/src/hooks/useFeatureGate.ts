import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface FeatureAccess {
  hasAccess: boolean;
  requiresUpgrade: boolean;
  message?: string;
}

interface FeatureGateReturn {
  hasFeature: (featureName: string) => boolean;
  checkFeature: (featureName: string) => Promise<FeatureAccess>;
  isLoading: boolean;
  features: Record<string, FeatureAccess>;
}

/**
 * Hook for checking feature availability based on subscription plan
 * 
 * @example
 * ```tsx
 * const { hasFeature, checkFeature } = useFeatureGate();
 * 
 * // Check synchronously (uses cached data)
 * if (!hasFeature('advanced_search')) {
 *   return <UpgradePrompt feature="Advanced Search" />;
 * }
 * 
 * // Check asynchronously (fetches latest data)
 * const access = await checkFeature('unlimited_integrations');
 * if (!access.hasAccess) {
 *   showUpgradeDialog(access.message);
 * }
 * ```
 */
export function useFeatureGate(): FeatureGateReturn {
  const [features, setFeatures] = useState<Record<string, FeatureAccess>>({});

  // Fetch all available features for the current plan
  const { data: featuresData, isLoading } = useQuery({
    queryKey: ["/api/billing/features"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: 10 * 60 * 1000 // Refetch every 10 minutes
  });

  // Update features cache when data changes
  useEffect(() => {
    if (featuresData?.features) {
      const featureMap: Record<string, FeatureAccess> = {};
      
      // Mark available features as accessible
      featuresData.features.forEach((feature: any) => {
        featureMap[feature.name] = {
          hasAccess: true,
          requiresUpgrade: false
        };
      });
      
      setFeatures(featureMap);
    }
  }, [featuresData]);

  // Synchronous check using cached data
  const hasFeature = (featureName: string): boolean => {
    return features[featureName]?.hasAccess || false;
  };

  // Asynchronous check with fresh data from server
  const checkFeature = async (featureName: string): Promise<FeatureAccess> => {
    // First check cache
    if (features[featureName]) {
      return features[featureName];
    }

    try {
      // Fetch specific feature access from server
      const response = await apiRequest("GET", `/api/billing/features/${featureName}`);
      const access = await response.json();
      
      // Update cache
      setFeatures(prev => ({
        ...prev,
        [featureName]: access
      }));
      
      return access;
    } catch (error) {
      console.error(`Failed to check feature access for ${featureName}:`, error);
      return {
        hasAccess: false,
        requiresUpgrade: false,
        message: "Unable to verify feature access"
      };
    }
  };

  return {
    hasFeature,
    checkFeature,
    isLoading,
    features
  };
}

/**
 * Component for conditionally rendering content based on feature availability
 */
interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export function FeatureGate({ 
  feature, 
  children, 
  fallback, 
  showUpgradePrompt = true 
}: FeatureGateProps) {
  const { hasFeature, features } = useFeatureGate();
  
  if (hasFeature(feature)) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showUpgradePrompt) {
    const access = features[feature];
    return (
      <div className="text-center p-4 border rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground mb-2">
          {access?.message || `This feature requires a subscription upgrade`}
        </p>
        <a 
          href="/billing" 
          className="text-primary hover:underline text-sm font-medium"
        >
          View Plans →
        </a>
      </div>
    );
  }
  
  return null;
}

/**
 * Hook for tracking usage metrics
 */
export function useUsageTracking() {
  const track = async (
    metric: "messages" | "storage" | "api_calls" | "active_users" | "integrations" | "file_uploads",
    value: number = 1,
    context?: Record<string, any>
  ) => {
    try {
      await apiRequest("POST", "/api/billing/usage/track", {
        metric,
        value,
        context
      });
    } catch (error) {
      console.error(`Failed to track usage metric ${metric}:`, error);
    }
  };

  return { track };
}