---
"@forklaunch/better-auth-mikro-orm-fork": patch
---

Add an optional trusted operation context around adapter operations and complete transactions, allowing encrypted auth fields to work for both HTTP and direct BetterAuth API calls without changing existing ciphertext policies.
