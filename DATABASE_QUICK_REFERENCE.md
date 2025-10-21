# Database Quick Reference

## Critical Information

### Jason AI User
```
Email: jason@ifastbroker.ai
ID: a6f87abf-5498-4b32-9e47-bf0cc12ac10f
Env Var: JASON_USER_ID=a6f87abf-5498-4b32-9e47-bf0cc12ac10f
```

### Admin Accounts (Can Login via OAuth)
```
1. rob@fusiondataco.com
2. mat@fusiondataco.com
3. theinsuranceschool@gmail.com
```

### Database Summary
```
✅ 10 users (1 AI + 3 admins + 6 test users)
✅ 3 channels (non-licensed, fl-licensed, multi-state)
✅ 3 channel memberships (Jason in all channels)
✅ 22 user-channel access permissions
✅ 3 welcome messages
✅ 1 campaign
```

### Verification Script
```bash
tsx server/scripts/verify-database.ts
```

### Re-seed If Needed
```bash
# Full reset:
npm run db:push
tsx server/scripts/run-jason-migration.ts
tsx server/seed-test-users.ts
tsx server/scripts/seed-channels.ts
tsx server/scripts/assign-channels.ts
tsx server/scripts/seed-welcome-messages.ts
tsx server/scripts/seed-campaign.ts
```

---

See [DATABASE_SETUP_COMPLETE.md](DATABASE_SETUP_COMPLETE.md) for full details.
