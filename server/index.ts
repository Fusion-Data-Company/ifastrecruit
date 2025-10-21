import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDemoData } from "./seedData";

const app = express();

// Security headers (only in production to avoid conflicts with Vite dev)
if (app.get("env") === "production") {
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP to avoid conflicts with inline scripts
    crossOriginEmbedderPolicy: false,
  }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Seed demo data if in development mode
  if (app.get("env") === "development") {
    try {
      await seedDemoData();
    } catch (error) {
      console.log("Demo data already exists or seeding failed - this is normal");
    }
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);

    // Log build information in production
    try {
      const fs = await import('fs');
      const path = await import('path');
      const distPath = path.resolve(import.meta.dirname, "public");
      const indexPath = path.resolve(distPath, "index.html");

      if (fs.existsSync(indexPath)) {
        const indexContent = fs.readFileSync(indexPath, 'utf-8');
        const jsMatch = indexContent.match(/assets\/index-([a-zA-Z0-9_-]+)\.js/);
        const cssMatch = indexContent.match(/assets\/index-([a-zA-Z0-9_-]+)\.css/);
        const stats = fs.statSync(indexPath);

        log('='.repeat(60));
        log('PRODUCTION BUILD INFO');
        log('='.repeat(60));
        log(`JavaScript Hash: ${jsMatch ? jsMatch[1] : 'NOT FOUND'}`);
        log(`CSS Hash: ${cssMatch ? cssMatch[1] : 'NOT FOUND'}`);
        log(`Build Date: ${stats.mtime.toISOString()}`);
        log(`Build Size: ${(stats.size / 1024).toFixed(2)} KB`);
        log('='.repeat(60));
      } else {
        log('⚠️  WARNING: Production build files not found!');
      }
    } catch (error) {
      log(`⚠️  WARNING: Could not read build info: ${error}`);
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
