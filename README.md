# ette-router

[![Build Status](https://travis-ci.org/boycgit/ette-router.svg?branch=master)](https://travis-ci.org/boycgit/ette-router) [![Coverage Status](https://coveralls.io/repos/github/boycgit/ette-router/badge.svg?branch=master)](https://coveralls.io/github/boycgit/ette-router?branch=master)[![MIT Licence](https://badges.frapsoft.com/os/mit/mit.svg?v=103)](https://opensource.org/licenses/mit-license.php) [![npm version](https://badge.fury.io/js/ette-router.svg)](https://badge.fury.io/js/ette-router)

Router middleware for ette.

 - written in Typescript
 - used with koa style
 - fully tested


## Installation

### Node.js / Browserify

```bash
npm install ette-router --save
```

```javascript
var Router = require('ette-router');

```

### Global object

Include the pre-built script.

```html
<script src="./dist/index.umd.min.js"></script>

```

## Build & test

```bash
npm run build
```

```bash
npm test
```

## Usage

test path: http://forbeslindesay.github.io/express-route-tester/

注：你写路由匹配规则时的 `/` 是很重要的，但你在用 `request` 方法中的 path 里的 `/` 则是无关紧要的；

你需要区分 **路由规则** 和 **中间件** 这两个概念。

直接使用 `use` 的是 **中间件** ：
```js
router.use('/', function(ctx, next) {
    // your code...
    return next();
});
```

使用 HTTP.verb() 的时候，定义的则是 **路由规则**：

```js
router.get('/', function(ctx, next) {
    // your code...
    return next();
});
```
> **路由规则** 本质上也是中间件

> 在代码层面，这部分差别是在 Router#match() 方法返回的 `MatchedRouter` 类型的 `route` 属性是否是 `true` 来区分的，如果为 `true` 表示路由规则，如果是 `false` 表示定义是中间件

> 注意：只有当匹配路由规则的时候才会运行相关的中间件，匹配中间件上的 path 并不会运行中间件！！


## document

```bash
npm run doc
```

then open the generated `out/index.html` file in your browser.

## License

[MIT](LICENSE).
