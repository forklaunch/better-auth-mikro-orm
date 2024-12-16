# better-auth-mikro-orm

[Mikro ORM](https://mikro-orm.io/) adapter for [Better Auth](https://www.better-auth.com/)

## Installation

pnpm:

```sh
pnpm add better-auth-mikro-orm
```

npm:

```sh
npm i better-auth-mikro-orm
```

## Usage

1. First you'll need to set up Mikro ORM and define the [core schema](https://www.better-auth.com/docs/concepts/database#core-schema) for Better Auth.
If you use any plugin - don't forget to check if they have any additional database schema definitions, then define entities you'll need for each plugin.
2. When you finished with the schema definition you can simply pass the result of `mikroOrmAdapter` call to the `database` option like this:

```ts
import {mikroOrmAdapter} from "better-auth-mikro-orm"
import {betterAuth} from "better-auth"

import {orm} from "./orm.js" // Your Mikro ORM instance

export const auth = betterAuth({
  database: mikroOrmAdapter(orm),

  // Don't forget to disable ID generator if it already managed by Mikro ORM:
  advanced: {
    generateId: false
  }
})
```

## API

### `mikroOrmAdapter(orm: MikroORM): AdapterInstance`

Creates Mikro ORM adapter instance. Note that this adapter **does not** manage database schema for you, so you can't use it with [`@better-auth/cli`](https://www.better-auth.com/docs/concepts/cli).
This means you'll have to manage database schema on your own.
Please refer to Better Auth and Mikro ORM documentation on the details.

Returns `AdapterInstance` function for Better Auth `database` option.

This function expects a single argument:

* `orm` - An instance of `MikroORM` returned from `MikroORM.init` or `MikroORM.initSync` methods.
