# Runtime types and metadata schemas for Typescript 

![Coverage](./badges/coverage.svg) [![npm version](https://badge.fury.io/js/typizator-client.svg)](https://badge.fury.io/js/typizator-client) [![Node version](https://img.shields.io/node/v/typizator-client.svg?style=flat)](https://nodejs.org/)

## Purpose

This library is a client for [cdk-typescript-lib](https://www.npmjs.com/package/cdk-typescript-lib) using [typizator](https://www.npmjs.com/package/typizator). It lets you connect to Typescript cloud APIs hosted on AWS lambdas cloud.

## Installation

```bash
npm i typizator-client
```

## Documentation

The server accepts the list of function arguments as a JSON array and returns a JSON object with the `data` field containing the JSON representation of the return value. This library encapsulates it into asynchronous calls.

> There is a tutorial explaining in details how to use this library and to connect it to the web client [here](https://medium.com/@cvds.eu/typescript-api-implementing-with-aws-cdk-and-using-on-a-web-client-2e3fe55a2f7b?sk=7f56e4bae87f46f4d774220d2f6ea95d)

Imagine you have an API implemented on the server that is defined like this using `typizator`:

```ts
const simpleRecordS = objectS({
    id: bigintS,
    name: stringS
})
type SimpleRecord = InferTargetFromSchema<typeof simpleRecordS>

const testApiS = apiS({
    helloWorld: { args: [stringS.notNull], retVal: stringS.notNull },
    noArgs: { args: [] },
    group: {
        called: { args: [simpleRecordS.notNull], retVal: simpleRecordS.notNull },
        secondLevel: {
            foo: { args: [] }
        }
    },
    dateFunc: { args: [dateS.notNull, stringS.optional], retVal: dateS.notNull }
})
```

On the client, you can do:

```ts
const EXAMPLE_URL = "https://example.api"
const URL_CHANGED = "http://foo.net"

const api = connectTsApi(testApiS.metadata, {
    url: EXAMPLE_URL,
    children: {
        group: {
            url: URL_CHANGED
        }
    },
    freeze: freezeFunction,
    unfreeze: unfreezeFunction
})
```

The `children` part is optional, you only need it if different parts of the API are implemented on different endpoints on the server.

`freeze` and `unfreeze` are optional as well, we'll talk about this later.

The call creates the `api` variable looking like this:

```ts
{
    helloWorld: (arg0: string) => Promise<string>,
    noArgs: () => Promise<void>,
    group: {
        called: (arg0: SimpleRecord) => Promise<SimpleRecord>,
        secondLevel: {
            foo: () => Promise<void>
        }
    }
}
```

If the implementation is correctly set up on the server, you don't need to know anything more, you just asynchronously call the API's methods without thinking about the imlementation.

You can implement `freezeFunction` and `unfreezeFunction` with no arguments and no return values that will respectively display and hide loading indicators during the server calls, they can be defined separately on the different levels of the API.

Behind the scenes, when you call `helloWorld("test")` for example, it generates a `POST` HTTP call to _https://example.api/hello-world/_ with the Post's body containing `["test"]` and return something like `{data: "Return value"}`, the unboxed well-typed contents of `data` will resolve the promise.

If there if an error occured on the server, it will return something like `{errorMessage: "Error contents"}`, the library will detect it and reject the promise.

### Authentication

You have the possibility to provide the server with a security token that will be verified by the server and used for authorization. For that, it is enough to add an extra parameter to the API connection:

```ts
const EXAMPLE_URL = "https://example.api"
const URL_CHANGED = "http://foo.net"

const api = connectTsApi(testApiS.metadata, {
    url: EXAMPLE_URL,
    freeze: freezeFunction,
    unfreeze: unfreezeFunction
}, () => securityToken)
```

In this example, `securityToken` can be a state variable dynamically updated by the client page, it is read each time you make a call through the `api` connector.
