---
"better-auth-mikro-orm": patch
---

Use `nativeDelete` and `nativeUpdate` ORM methods for `updateMany`/`deleteMany`. However, this change mean that Identity Map won't be updated after `deleteMany` and `updateMany` methods.
