# Production Deployment - Quick Reference

## 🚀 Deploy New Version

```bash
# 1. Build
npm run build

# 2. Commit changes
git add .
git commit -m "Your deployment message"

# 3. Deploy via Replit
# Click "Deploy" button in Replit dashboard
```

## ✅ Verify Deployment

```bash
# Check build version
curl https://your-app.replit.app/api/health

# Look for different jsHash and cssHash values than previous deployment
```

## 🔍 Troubleshooting

### Old Version Still Loading?

1. **Check deployment succeeded**
   ```bash
   curl https://your-app.replit.app/api/health
   ```
   Verify `jsHash` and `cssHash` are new values

2. **Clear browser cache**
   - Open DevTools (F12)
   - Right-click Reload button → "Empty Cache and Hard Reload"
   - Or use Incognito/Private window

3. **Check asset filenames**
   - Open DevTools → Network tab
   - Look for files like `index-HASH.js`
   - Hash should match the one in `/api/health`

### Build Failing?

```bash
# Test build locally first
npm run build

# Check for errors in output
# Common issues:
# - Missing dependencies → npm install
# - TypeScript errors (usually warnings, won't block build)
```

### Auth Loop After Deploy?

1. Clear all cookies for your domain
2. Try login in Incognito window
3. Check `/api/health` shows `"ok": true`

## 📊 What Changed

### Before (BROKEN)
❌ Old JavaScript/CSS files cached forever
❌ No way to verify which version deployed
❌ Browser served stale files even after new deployment

### After (FIXED)
✅ `index.html` never cached - always fresh
✅ JS/CSS files have content hashes (auto cache-bust)
✅ `/api/health` shows exact deployed version
✅ Proper cache headers for optimal performance
✅ Production build info logged on startup

## 🎯 Key Files Modified

- `server/vite.ts` - Cache headers
- `vite.config.ts` - Build optimization
- `server/index.ts` - Build info logging
- `server/routes.ts` - Health check endpoint
- `.replit` - Deployment config

## 📝 Health Check Response

```json
{
  "ok": true,
  "timestamp": "2025-10-21T14:58:59.653Z",
  "environment": "production",
  "build": {
    "deployed": true,
    "jsHash": "CgrEGrm_",      // ← Changes with each build
    "cssHash": "BVjptXmn",     // ← Changes with each build
    "indexSize": 1995,
    "lastModified": "2025-10-21T14:58:17.173Z"
  }
}
```

## 🎨 Build Output

Each deployment creates new files with unique hashes:

```
dist/public/assets/
├── index-CgrEGrm_.js           # Main app (changes each build)
├── index-BVjptXmn.css          # Styles (changes each build)
├── vendor-react-C4-vaQKD.js    # React libs (stable)
├── vendor-ui-DsfXBa2Z.js       # UI components (stable)
└── vendor-query-DgH6TO6h.js    # React Query (stable)
```

## 💡 Pro Tips

1. **Always verify deployment**
   - Check `/api/health` after deploy
   - Note the hash values

2. **Document your deployments**
   - Use descriptive commit messages
   - Note any breaking changes

3. **Test in Incognito first**
   - Fresh browser state
   - No cached files
   - Clean authentication

4. **Monitor after deployment**
   - Check error logs in Replit
   - Test critical user flows
   - Verify real-time features work

## 🆘 Emergency Rollback

If something breaks:

```bash
# Revert last commit
git revert HEAD
git push

# Then redeploy via Replit dashboard
```

Or use Replit's built-in deployment rollback:
- Go to Deployments tab
- Select previous working version
- Click "Promote to Production"

---

For detailed information, see [DEPLOYMENT.md](DEPLOYMENT.md)
