# Runtime types and metadata schemas for Typescript 

![Coverage](./badges/coverage.svg) [![npm version](https://badge.fury.io/js/typizator.svg)](https://badge.fury.io/js/typizator) [![Node version](https://img.shields.io/node/v/typizator.svg?style=flat)](https://nodejs.org/)

## Purpose

Typescript doesn't have runtime types, all the type information is erased at the transpile stage. And since the version 5 there is no more _Reflect_ support neither. Here is a simple schemas definition library that lets you keep types metadata at run time, infer Typescript types from those schemas and convert raw JSON/object data to predefined structured types

## Installing

```Bash
npm i typizator
```

## Documentation and tests

Nothing better than tests to show how the library works. Simply read [these tests](https://github.com/cvdsfif/typizator/blob/main/tests/index.test.ts) and you'll know how to use this.

