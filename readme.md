# better-auth-mikro-orm

[MikroORM](https://mikro-orm.io/) adapter for [Better Auth](https://www.better-auth.com/)

[![CI](https://github.com/octet-stream/better-auth-mikro-orm/actions/workflows/ci.yaml/badge.svg)](https://github.com/octet-stream/better-auth-mikro-orm/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/octet-stream/better-auth-mikro-orm/graph/badge.svg?token=xcVndkC8mL)](https://codecov.io/gh/octet-stream/better-auth-mikro-orm)

## Installation

Using npm:

```sh
npm i better-auth-mikro-orm
```

Using yarn:

```sh
yarn add better-auth-mikro-orm
```

Using pnpm:

```sh
pnpm add better-auth-mikro-orm
```

## Usage

1. First you'll need to set up MikroORM and define the [core schema](https://www.better-auth.com/docs/concepts/database#core-schema) for Better Auth.
   If you use any plugin, don't forget to check if they have any additional database schema definitions, then define entities you'll need for each plugin.
2. When you're finished with the schema definitions, you can simply pass the result of the `mikroOrmAdapter` call to the `database` option like this:

```ts
import { mikroOrmAdapter } from "better-auth-mikro-orm";
import { betterAuth } from "better-auth";

import { orm } from "./orm.js"; // Your Mikro ORM instance

export const auth = betterAuth({
  database: mikroOrmAdapter(orm),

  // Don't forget to disable the ID generator if it is already managed by MikroORM
  advanced: {
    database: {
      generateId: false,
    },
  },
});
```

## API

### `mikroOrmAdapter(orm: MikroORM): AdapterInstance`

Creates the MikroORM adapter instance. Note that this adapter **does not** manage database schemas for you, so you can't use it with [`@better-auth/cli`](https://www.better-auth.com/docs/concepts/cli).
This means you'll have to manage database schemas on your own.
Please refer to the Better Auth and MikroORM documentations for details.

Returns the `AdapterInstance` function for the Better Auth `database` option.

This function expects a single argument:

- `orm` - An instance of `MikroORM` returned from either `MikroORM.init` or `MikroORM.initSync`.
