---
"@forklaunch/better-auth-mikro-orm-fork": patch
---

Return `@forklaunch/core` compliant fields (pii/phi/pci properties) to Better Auth as their values. They serialize as `{}` by design, which broke sign-in for encrypted account columns (password, tokens) and JWKS keys.
