# Production Deployment Guide

## Overview

This guide covers the production deployment process for the iFast Recruit application on Replit. The application has been fully optimized for production deployments with proper cache-busting, build verification, and health monitoring.

---

## Critical Fixes Applied

### 1. **Cache-Control Headers**
- **Problem**: Static files were cached indefinitely by browsers and CDNs, preventing new versions from loading
- **Solution**:
  - `index.html`: Never cached (`no-cache, no-store, must-revalidate`)
  - Hashed assets (JS/CSS): Cached for 1 year with `immutable` flag
  - All assets include content hashes in filenames for automatic cache-busting

### 2. **Build Verification**
- Added `/api/health` endpoint that shows:
  - Current environment (development/production)
  - JavaScript bundle hash
  - CSS bundle hash
  - Build timestamp
  - Build size
- Startup logs show build information automatically

### 3. **Optimized Chunk Splitting**
- Vendor code split into separate chunks for better caching:
  - `vendor-react`: React, React DOM, Wouter
  - `vendor-ui`: Radix UI components
  - `vendor-query`: TanStack React Query
- Main application code in separate chunk
- Each chunk has unique content hash

### 4. **Security Headers**
- Helmet security middleware enabled in production
- Proper CORS configuration
- Session security hardened

---

## Deployment Process

### Step 1: Pre-Deployment Checklist

1. **Verify Environment Variables**
   ```bash
   # Check critical variables are set
   echo $DATABASE_URL
   echo $SESSION_SECRET
   echo $REPLIT_DOMAINS
   echo $REPL_ID
   echo $OPENROUTER_API_KEY
   ```

2. **Run Tests** (if applicable)
   ```bash
   npm run test:e2e
   ```

3. **Check TypeScript**
   ```bash
   npm run check
   ```
   Note: Some type errors may exist but won't block deployment

### Step 2: Build Production Assets

```bash
npm run build
```

This command:
1. Builds client with Vite → `dist/public/`
2. Bundles server with esbuild → `dist/index.js`
3. Generates content-hashed filenames for all assets
4. Optimizes and minifies all code

**Expected Output:**
```
✓ built in 20.70s
dist/index.js  802.9kb
```

**Verify Build:**
```bash
ls -lh dist/public/assets/
# Should show files like:
# index-CgrEGrm_.js (main bundle)
# index-BVjptXmn.css (styles)
# vendor-react-*.js (React chunk)
# vendor-ui-*.js (UI components chunk)
# vendor-query-*.js (React Query chunk)
```

### Step 3: Deploy to Replit

#### Option A: Replit Deployment (Recommended)

1. **Commit All Changes**
   ```bash
   git add .
   git commit -m "Production deployment with optimized build"
   ```

2. **Deploy via Replit Dashboard**
   - Click "Deploy" button in Replit
   - Replit will automatically run `npm run build` (configured in `.replit`)
   - Wait for deployment to complete
   - Note the deployment URL

3. **Verify Deployment**
   ```bash
   # Check health endpoint
   curl https://your-app.replit.app/api/health
   ```

   Expected response:
   ```json
   {
     "ok": true,
     "timestamp": "2025-10-21T14:58:59.653Z",
     "environment": "production",
     "build": {
       "deployed": true,
       "jsHash": "CgrEGrm_",
       "cssHash": "BVjptXmn",
       "indexSize": 1995,
       "lastModified": "2025-10-21T14:58:17.173Z"
     }
   }
   ```

#### Option B: Manual Deployment

1. **Build locally**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm run start
   ```

3. **Verify in logs**
   Look for:
   ```
   ============================================================
   PRODUCTION BUILD INFO
   ============================================================
   JavaScript Hash: CgrEGrm_
   CSS Hash: BVjptXmn
   Build Date: 2025-10-21T14:58:17.173Z
   Build Size: 1.95 KB
   ============================================================
   ```

### Step 4: Post-Deployment Verification

1. **Test Authentication**
   - Navigate to `https://your-app.replit.app/login`
   - Complete OAuth flow
   - Verify successful login

2. **Check Build Version**
   ```bash
   curl https://your-app.replit.app/api/health | grep jsHash
   ```
   - Note the hash value
   - After next deployment, verify this hash changes

3. **Test Cache Headers**
   ```bash
   # index.html should NOT be cached
   curl -I https://your-app.replit.app/
   # Look for: Cache-Control: no-cache, no-store, must-revalidate

   # Assets SHOULD be cached
   curl -I https://your-app.replit.app/assets/index-HASH.js
   # Look for: Cache-Control: public, max-age=31536000, immutable
   ```

4. **Clear Browser Cache**
   - Open Developer Tools (F12)
   - Go to Network tab
   - Right-click → "Clear browser cache"
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   - Verify new assets load

---

## Troubleshooting

### Problem: Old Version Still Loading

**Cause**: Browser/CDN caching old files

**Solution**:
1. Check `/api/health` endpoint to verify new build is deployed
2. Clear browser cache completely
3. Use incognito/private window
4. Hard refresh (Ctrl+Shift+R)
5. Check Network tab in DevTools - verify asset filenames have new hashes

### Problem: Build Fails on Deployment

**Cause**: Missing dependencies or build errors

**Solution**:
1. Check Replit deployment logs
2. Verify `package.json` dependencies are installed
3. Run `npm install` if needed
4. Check for TypeScript errors (though they don't block builds)
5. Verify `dist/` folder is in `.gitignore` (it should be)

### Problem: 404 on Assets

**Cause**: Assets not built or path mismatch

**Solution**:
1. Verify `dist/public/assets/` contains files
2. Check `dist/public/index.html` references correct paths
3. Verify server is serving from correct `dist/public` directory
4. Check browser console for exact 404 URLs

### Problem: Authentication Loop After Deployment

**Cause**: Session cookies or auth state mismatch

**Solution**:
1. Clear all cookies for the domain
2. Verify `SESSION_SECRET` hasn't changed
3. Check database session table is accessible
4. Verify `REPLIT_DOMAINS` matches current domain
5. Check auth endpoints in browser Network tab

### Problem: WebSocket/Real-time Features Not Working

**Cause**: WebSocket connection failures

**Solution**:
1. Check browser console for WebSocket errors
2. Verify Replit exposes WebSocket port (5000)
3. Check firewall/proxy settings
4. Test with `/api/health` first to verify server is running

---

## Build Configuration

### Files Modified for Production Deployment

1. **[server/vite.ts](server/vite.ts)** - Static file serving with cache headers
2. **[vite.config.ts](vite.config.ts)** - Build optimization and chunk splitting
3. **[server/index.ts](server/index.ts)** - Build info logging and helmet security
4. **[server/routes.ts](server/routes.ts)** - Health check endpoint with build verification
5. **[.replit](.replit)** - Deployment configuration

### Cache Strategy

```
File Type          | Cache Strategy              | Reason
-------------------|----------------------------|------------------------------------------
index.html         | no-cache, must-revalidate  | Always fetch latest HTML entry point
*.js (hashed)      | 1 year, immutable          | Content hash changes when file changes
*.css (hashed)     | 1 year, immutable          | Content hash changes when file changes
*.png, *.jpg       | 1 year, immutable          | Static assets with hashes
```

### Build Output Structure

```
dist/
├── index.js                    # Server bundle
└── public/                     # Client files (served statically)
    ├── index.html              # Entry point (never cached)
    ├── assets/
    │   ├── index-[hash].js     # Main app bundle
    │   ├── index-[hash].css    # Main styles
    │   ├── vendor-react-[hash].js    # React vendor chunk
    │   ├── vendor-ui-[hash].js       # UI vendor chunk
    │   └── vendor-query-[hash].js    # Query vendor chunk
    └── sounds/                 # Static sound files
```

---

## Monitoring & Maintenance

### Daily Checks

1. **Health Endpoint**
   ```bash
   curl https://your-app.replit.app/api/health
   ```
   - Should return `{"ok": true, ...}`

2. **Error Logs**
   - Check Replit logs for errors
   - Monitor authentication failures
   - Watch for database connection issues

### After Each Deployment

1. Verify new build hash in `/api/health`
2. Test critical user flows:
   - Login
   - Navigation
   - Real-time features
3. Check browser console for errors
4. Monitor performance metrics

### Rollback Procedure

If deployment fails:

1. **Via Git**
   ```bash
   git revert HEAD
   git push
   ```
   Then redeploy through Replit

2. **Via Replit Dashboard**
   - Go to Deployments tab
   - Select previous working deployment
   - Click "Promote to Production"

---

## Performance Optimization

### Current Optimizations

✅ Code splitting (vendor chunks separated)
✅ Asset minification (esbuild)
✅ Content hashing for cache-busting
✅ Aggressive caching for static assets
✅ Gzip compression (via Express)
✅ Security headers (Helmet)

### Future Improvements

- [ ] Enable source maps for production debugging (currently disabled)
- [ ] Add CDN integration for asset delivery
- [ ] Implement service worker for offline support
- [ ] Add bundle size monitoring
- [ ] Set up automated deployment testing

---

## Environment Variables Reference

Required for production:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Session
SESSION_SECRET=<random-secret-key>

# Replit Auth
REPLIT_DOMAINS=<your-domain>.replit.dev
REPL_ID=<your-repl-id>
ISSUER_URL=https://replit.com/oidc  # Optional, defaults to this

# AI Features
OPENROUTER_API_KEY=sk-or-v1-...

# Optional Services
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=

# Environment
NODE_ENV=production
PORT=5000
```

---

## Support & Debugging

### Useful Commands

```bash
# Check which files changed
git status

# View build output
ls -lah dist/public/assets/

# Test production build locally
NODE_ENV=production npm run start

# Check health endpoint
curl http://localhost:5000/api/health

# View server logs
# (In Replit, check the Console tab)
```

### Debug Mode

To enable verbose logging:

1. Check server logs in Replit Console
2. Open browser DevTools → Network tab
3. Filter by "Fetch/XHR" to see API calls
4. Check Console for client-side errors

### Getting Help

- Check [Replit Docs](https://docs.replit.com/)
- Review error logs in Replit Console
- Test locally first: `npm run build && npm run start`
- Verify health endpoint returns expected data

---

## Summary

The production deployment process is now optimized and reliable:

1. ✅ **Build** with `npm run build`
2. ✅ **Deploy** via Replit (automatic)
3. ✅ **Verify** with `/api/health` endpoint
4. ✅ **Monitor** build hash changes
5. ✅ **Cache** properly configured (no stale files)

Each deployment creates unique asset hashes, ensuring browsers always load the latest version. The health endpoint provides instant verification of deployed versions.
