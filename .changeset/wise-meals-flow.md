---
"better-auth-mikro-orm": patch
---

Replace `nativeDelete` with `remove` method to delete rows to properly update IdentityMap in `adapter.deleteMany` method.
