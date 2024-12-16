# better-auth-adapter-mikro-orm

Mikro ORM Adapter for Better Auth

## Installation

pnpm:

```sh
pnpm add better-auth-adapter-mikro-orm
```

npm:

```sh
npm i better-auth-adapter-mikro-orm
```

## Usage

```ts
import {mikroOrmAdapter} from "better-auth-adapter-mikro-orm"
import {betterAuth} from "better-auth"

import {orm} from "./orm.js" // Your Mikro ORM instance

export const auth = betterAuth({
  database: mikroOrmAdapter(orm)
})
```
