---
"@forklaunch/better-auth-mikro-orm-fork": patch
---

Prevent consumed verification values from being reinserted by a later EntityManager flush. Read the consumption snapshot without registering it in the identity map, and preserve the guarded delete so concurrent consumers still have exactly one winner.
