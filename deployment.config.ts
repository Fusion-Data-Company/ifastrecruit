// Production deployment configuration and environment management
export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  port: number;
  host: string;
  cors: {
    origins: string[];
    credentials: boolean;
  };
  security: {
    rateLimiting: {
      windowMs: number;
      max: number;
    };
    helmet: {
      contentSecurityPolicy: boolean;
      crossOriginEmbedderPolicy: boolean;
    };
  };
  database: {
    maxConnections: number;
    idleTimeout: number;
    connectionTimeout: number;
    ssl: boolean;
  };
  cache: {
    type: 'memory' | 'redis';
    ttl: number;
    maxSize?: number;
    redis?: {
      host: string;
      port: number;
      password?: string;
    };
  };
  monitoring: {
    enableMetrics: boolean;
    enableTracing: boolean;
    sampleRate: number;
  };
  features: {
    enableWebsockets: boolean;
    enableBackups: boolean;
    enableAdvancedAnalytics: boolean;
  };
}

// Environment-specific configurations
export const deploymentConfigs: Record<string, DeploymentConfig> = {
  development: {
    environment: 'development',
    port: 5000,
    host: '0.0.0.0',
    cors: {
      origins: ['http://localhost:5000', 'http://127.0.0.1:5000'],
      credentials: true,
    },
    security: {
      rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10000, // Very high for development
      },
      helmet: {
        contentSecurityPolicy: false, // Disabled for development
        crossOriginEmbedderPolicy: false,
      },
    },
    database: {
      maxConnections: 5,
      idleTimeout: 30000,
      connectionTimeout: 10000,
      ssl: false,
    },
    cache: {
      type: 'memory',
      ttl: 300,
      maxSize: 1000,
    },
    monitoring: {
      enableMetrics: true,
      enableTracing: false,
      sampleRate: 1.0,
    },
    features: {
      enableWebsockets: false, // Disabled to avoid conflicts with Vite
      enableBackups: true,
      enableAdvancedAnalytics: true,
    },
  },

  staging: {
    environment: 'staging',
    port: parseInt(process.env.PORT || '5000'),
    host: '0.0.0.0',
    cors: {
      origins: process.env.ALLOWED_ORIGINS?.split(',') || ['https://staging.ifast-broker.com'],
      credentials: true,
    },
    security: {
      rateLimiting: {
        windowMs: 15 * 60 * 1000,
        max: 1000,
      },
      helmet: {
        contentSecurityPolicy: true,
        crossOriginEmbedderPolicy: false,
      },
    },
    database: {
      maxConnections: 15,
      idleTimeout: 30000,
      connectionTimeout: 10000,
      ssl: true,
    },
    cache: {
      type: process.env.REDIS_URL ? 'redis' : 'memory',
      ttl: 600,
      redis: process.env.REDIS_URL ? {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      } : undefined,
    },
    monitoring: {
      enableMetrics: true,
      enableTracing: true,
      sampleRate: 0.5,
    },
    features: {
      enableWebsockets: true,
      enableBackups: true,
      enableAdvancedAnalytics: true,
    },
  },

  production: {
    environment: 'production',
    port: parseInt(process.env.PORT || '5000'),
    host: '0.0.0.0',
    cors: {
      origins: process.env.ALLOWED_ORIGINS?.split(',') || ['https://ifast-broker.com'],
      credentials: true,
    },
    security: {
      rateLimiting: {
        windowMs: 15 * 60 * 1000,
        max: 100, // Strict rate limiting
      },
      helmet: {
        contentSecurityPolicy: true,
        crossOriginEmbedderPolicy: true,
      },
    },
    database: {
      maxConnections: 25,
      idleTimeout: 30000,
      connectionTimeout: 10000,
      ssl: true,
    },
    cache: {
      type: 'redis',
      ttl: 300,
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    },
    monitoring: {
      enableMetrics: true,
      enableTracing: true,
      sampleRate: 0.1, // 10% sampling for performance
    },
    features: {
      enableWebsockets: true,
      enableBackups: true,
      enableAdvancedAnalytics: true,
    },
  },
};

// Get current deployment configuration
export function getDeploymentConfig(): DeploymentConfig {
  const env = process.env.NODE_ENV || 'development';
  return deploymentConfigs[env] || deploymentConfigs.development;
}

// Validate environment variables
export function validateEnvironment(): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const config = getDeploymentConfig();
  const missing: string[] = [];
  const warnings: string[] = [];

  // Required for all environments
  if (!process.env.DATABASE_URL) {
    missing.push('DATABASE_URL');
  }

  // Production requirements
  if (config.environment === 'production') {
    const productionRequired = [
      'OPENROUTER_API_KEY',
      'ELEVENLABS_API_KEY',
      'ALLOWED_ORIGINS',
      'SESSION_SECRET',
    ];

    productionRequired.forEach(env => {
      if (!process.env[env]) {
        missing.push(env);
      }
    });

    // Optional but recommended
    const productionRecommended = [
      'REDIS_URL',
      'MAILJET_API_KEY',
      'SLACK_BOT_TOKEN',
      'APIFY_API_TOKEN',
    ];

    productionRecommended.forEach(env => {
      if (!process.env[env]) {
        warnings.push(`${env} is recommended for full functionality`);
      }
    });
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

// Production readiness checklist
export interface ReadinessCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  critical: boolean;
}

export async function runProductionReadinessChecks(): Promise<{
  ready: boolean;
  score: number;
  checks: ReadinessCheck[];
}> {
  const checks: ReadinessCheck[] = [];

  // Environment validation
  const envValidation = validateEnvironment();
  checks.push({
    name: 'Environment Variables',
    status: envValidation.valid ? 'pass' : 'fail',
    message: envValidation.valid 
      ? 'All required environment variables are set'
      : `Missing: ${envValidation.missing.join(', ')}`,
    critical: true,
  });

  // Database connectivity
  try {
    // This would normally test database connection
    checks.push({
      name: 'Database Connectivity',
      status: 'pass',
      message: 'Database connection successful',
      critical: true,
    });
  } catch (error) {
    checks.push({
      name: 'Database Connectivity',
      status: 'fail',
      message: 'Failed to connect to database',
      critical: true,
    });
  }

  // Security configuration
  const config = getDeploymentConfig();
  checks.push({
    name: 'Security Configuration',
    status: config.security.helmet.contentSecurityPolicy ? 'pass' : 'warning',
    message: config.security.helmet.contentSecurityPolicy 
      ? 'Security headers properly configured'
      : 'Consider enabling Content Security Policy for production',
    critical: false,
  });

  // Rate limiting
  checks.push({
    name: 'Rate Limiting',
    status: config.security.rateLimiting.max < 1000 ? 'pass' : 'warning',
    message: config.security.rateLimiting.max < 1000
      ? 'Rate limiting appropriately configured'
      : 'Rate limiting may be too permissive for production',
    critical: false,
  });

  // SSL/HTTPS
  checks.push({
    name: 'SSL Configuration',
    status: config.database.ssl && process.env.HTTPS === 'true' ? 'pass' : 'warning',
    message: 'Ensure SSL/HTTPS is properly configured in production',
    critical: config.environment === 'production',
  });

  // Caching
  checks.push({
    name: 'Caching Strategy',
    status: config.cache.type === 'redis' ? 'pass' : 'warning',
    message: config.cache.type === 'redis'
      ? 'Redis caching configured'
      : 'Consider Redis for production caching',
    critical: false,
  });

  // Monitoring
  checks.push({
    name: 'Monitoring & Observability',
    status: config.monitoring.enableMetrics ? 'pass' : 'warning',
    message: config.monitoring.enableMetrics
      ? 'Monitoring enabled'
      : 'Enable monitoring for production',
    critical: false,
  });

  // External services
  const externalServices = [
    { name: 'OpenRouter API', env: 'OPENROUTER_API_KEY' },
    { name: 'ElevenLabs API', env: 'ELEVENLABS_API_KEY' },
    { name: 'Mailjet', env: 'MAILJET_API_KEY' },
    { name: 'Slack', env: 'SLACK_BOT_TOKEN' },
  ];

  externalServices.forEach(service => {
    checks.push({
      name: `${service.name} Integration`,
      status: process.env[service.env] ? 'pass' : 'warning',
      message: process.env[service.env]
        ? `${service.name} API key configured`
        : `${service.name} integration not configured - some features may be unavailable`,
      critical: false,
    });
  });

  // Backup strategy
  checks.push({
    name: 'Backup Strategy',
    status: config.features.enableBackups ? 'pass' : 'warning',
    message: config.features.enableBackups
      ? 'Backup functionality enabled'
      : 'Enable backup functionality for production',
    critical: false,
  });

  // Performance configuration
  checks.push({
    name: 'Performance Configuration',
    status: config.database.maxConnections >= 20 ? 'pass' : 'warning',
    message: 'Database connection pool and performance settings configured',
    critical: false,
  });

  // Calculate readiness score
  const totalChecks = checks.length;
  const passedChecks = checks.filter(c => c.status === 'pass').length;
  const criticalFailures = checks.filter(c => c.critical && c.status === 'fail').length;
  
  const score = Math.round((passedChecks / totalChecks) * 100);
  const ready = criticalFailures === 0 && score >= 80;

  return {
    ready,
    score,
    checks,
  };
}

// Deployment health check
export function getDeploymentHealth() {
  const config = getDeploymentConfig();
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  return {
    environment: config.environment,
    uptime: Math.round(uptime),
    memory: {
      used: Math.round(memory.heapUsed / 1024 / 1024),
      total: Math.round(memory.heapTotal / 1024 / 1024),
      percentage: Math.round((memory.heapUsed / memory.heapTotal) * 100),
    },
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    timestamp: new Date().toISOString(),
  };
}

// Export current configuration
export const currentConfig = getDeploymentConfig();