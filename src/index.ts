import compose, { middlewareFunction } from './compose';
import { HTTP_METHOD } from './lib';
import Layer, { LayerOptions } from './layer';

const METHODS_LOWERCASE: string[] = Object.keys(HTTP_METHOD).map(k =>
  HTTP_METHOD[k as any].toLowerCase()
);

interface RouterOptions extends LayerOptions {
  prefix?: string;
  methods?: HTTP_METHOD[];
}

interface RouterMiddlewareFn {
  (ctx, next): any;
  router?: Router;
}

interface MatchedRouter {
  path: Layer[];
  pathAndMethod: Layer[];
  route: boolean;
}

export default class Router {
  opts: RouterOptions;
  params: object;
  stack: Layer[];
  /**
   * Create a new router.
   *
   * @example
   *
   * Basic usage:
   *
   * ```javascript
   * var Koa = require('koa');
   * var Router = require('koa-router');
   *
   * var app = new Koa();
   * var router = new Router();
   *
   * router.get('/', (ctx, next) => {
   *   // ctx.router available
   * });
   *
   * app
   *   .use(router.routes())
   *   .use(router.allowedMethods());
   * ```
   *
   * @alias module:koa-router
   * @param {Object=} opts
   * @param {String=} opts.prefix prefix router paths
   * @constructor
   */

  constructor(opts?: RouterOptions) {
    this.opts = opts || {};
    this.params = {};
    this.stack = [];
  }

  /**
   * Generate URL from url pattern and given `params`.
   *
   * @example
   *
   * ```javascript
   * var url = Router.url('/users/:id', {id: 1});
   * // => "/users/1"
   * ```
   *
   * @param {String} path url pattern
   * @param {Object} params url parameters
   * @returns {String}
   */
  static url(path: string, ...args): string {
    return Layer.prototype.url.apply({ path: path }, args);
  }

  /**
   * Create and register a route.
   * Layer instance push to this.stack
   *
   * @param {String} path Path string.
   * @param {Array.<String>} methods Array of HTTP verbs.
   * @param {Function} middleware Multiple middleware also accepted.
   * @returns {Layer}
   * @private
   */

  register(
    path: string,
    methods: string | string[],
    middleware: middlewareFunction,
    opts: LayerOptions = {}
  ): Layer | Router {
    var router = this;

    // support array of paths， 支持 path 数组格式的路径
    if (Array.isArray(path)) {
      path.forEach(function(p) {
        router.register.call(router, p, methods, middleware, opts);
      });

      return this;
    }

    // create route
    var route = new Layer(path, methods, middleware, {
      end: opts.end === false ? opts.end : true,
      name: opts.name,
      sensitive: opts.sensitive || this.opts.sensitive || false,
      strict: opts.strict || this.opts.strict || false,
      prefix: opts.prefix || this.opts.prefix || '',
      ignoreCaptures: opts.ignoreCaptures
    });

    if (this.opts.prefix) {
      route.setPrefix(this.opts.prefix);
    }

    // add parameter middleware
    Object.keys(this.params).forEach(function(param) {
      route.param(param, this.params[param]);
    }, this);

    this.stack.push(route);

    return route;
  }

  /**
   * Use given middleware.
   *
   * Middleware run in the order they are defined by `.use()`. They are invoked
   * sequentially, requests start at the first middleware and work their way
   * "down" the middleware stack.
   *
   * @example
   *
   * ```javascript
   * // session middleware will run before authorize
   * router
   *   .use(session())
   *   .use(authorize());
   *
   * // use middleware only with given path
   * router.use('/users', userAuth());
   *
   * // or with an array of paths
   * router.use(['/users', '/admin'], userAuth());
   *
   * app.use(router.routes());
   * ```
   *
   * @param {String=} path
   * @param {Function} middleware
   * @param {Function=} ...
   * @returns {Router}
   */

  use(...middleware): Router {
    var router = this;
    var path;

    // support array of paths
    if (Array.isArray(middleware[0]) && typeof middleware[0][0] === 'string') {
      middleware[0].forEach(function(p: string) {
        router.use.apply(router, [p].concat(middleware.slice(1)));
      });

      return this;
    }

    var hasPath = typeof middleware[0] === 'string';
    if (hasPath) {
      path = middleware.shift();
    }

    // 做一层中间件遍历，方便 use 内联路由的时候，添加自己路由的前缀
    middleware.forEach(function(m: RouterMiddlewareFn) {
      // nested routers 内联路由规则的时候，会挨个 setPrefix 之后，再纳入到自己的 stack 中
      if (m.router) {
        m.router.stack.forEach(function(nestedLayer: Layer) {
          if (path) nestedLayer.setPrefix(path);

          // see test case:
          //  - [ref-nests with root prefixes]
          //  - [ref-nests with special prefixes]
          if (router.opts.prefix) nestedLayer.setPrefix(router.opts.prefix);
          router.stack.push(nestedLayer);
        });

        if (router.params) {
          Object.keys(router.params).forEach(function(key) {
            (<Router>m.router).param(key, router.params[key]);
          });
        }
      } else {
        router.register(path || '(.*)', [], m, {
          end: false,
          ignoreCaptures: !hasPath
        });
      }
    });

    return this;
  }

  /**
   * Set the path prefix for a Router instance that was already initialized.
   *
   * @example
   *
   * ```javascript
   * router.prefix('/things/:thing_id')
   * ```
   *
   * @param {String} prefix
   * @returns {Router}
   */

  prefix(prefix: string): Router {
    // seeing:  [ref - trailing slash prefix]
    prefix = prefix.replace(/\/$/, ''); // 去掉末尾的 `/`

    this.opts.prefix = prefix;

    this.stack.forEach(function(route: Layer) {
      route.setPrefix(prefix);
    });

    return this;
  }

  /**
   * Match given `path` and return corresponding routes.
   *
   * @param {String} path
   * @param {String} method
   * @returns {Object.<path, pathAndMethod>} returns layers that matched path and
   * path and method.
   * @private
   */

  match(path: string, method: HTTP_METHOD): MatchedRouter {
    var layers = this.stack;
    var layer;
    var matched: MatchedRouter = {
      path: [],
      pathAndMethod: [],
      route: false
    };

    for (var len = layers.length, i = 0; i < len; i++) {
      layer = layers[i];

      // 首先找到所有满足当前 path 的（注册过的）layer，
      if (layer.match(path)) {
        matched.path.push(layer);

        // 如果 layer 没有 method，相当于 all，针对所有的 method 都拥有该 route
        if (layer.methods.length === 0 || !!~layer.methods.indexOf(method)) {
          matched.pathAndMethod.push(layer);
          if (layer.methods.length) matched.route = true;
        }
      }
    }

    return matched;
  }

  /**
   * Returns router middleware which dispatches a route matching the request.
   *
   * @returns {Function}
   */

  routes(): RouterMiddlewareFn {
    var router = this;

    // 生成专供 router 使用的中间件函数
    // req.path + req.method 是非常重要的，就是根据这个来进行路由匹配
    var dispatch: RouterMiddlewareFn = function dispatch(ctx, next) {
      const req = ctx.request;
      // testcase: [ref - custom routerPath]
      var path = router.opts.routerPath || ctx.routerPath || req.path;

      //   获取所有匹配的 layer 列表
      var matched: MatchedRouter = router.match(path, req.method);

      //   设置 ctx.matched ，其内容是 matched.path 大融合
      if (ctx.matched) {
        ctx.matched.push.apply(ctx.matched, matched.path);
      } else {
        ctx.matched = matched.path;
      }

      //   设置 ctx.router 为当前 router
      ctx.router = router;

      //   如果没有 route 属性，说明匹配的是中间件而非路由规则，则直接 next
      if (!matched.route) return next();

      var matchedLayers = matched.pathAndMethod;
      var mostSpecificLayer = matchedLayers[matchedLayers.length - 1];

      //   将匹配到的路径保存到 `_matchedRoute` 中，只是方便 debug 吧，没有特殊作用
      ctx._matchedRoute = mostSpecificLayer.path;
      if (mostSpecificLayer.name) {
        ctx._matchedRouteName = mostSpecificLayer.name;
      }
      // console.log(ctx._matchedRoute, matchedLayers.length);

      //   中间件数组
      const layerChain: middlewareFunction[] = matchedLayers.reduce(function(
        memo: middlewareFunction[],
        layer: Layer
      ) {
        // 没到下一个中间件，需要更新 ctx 中的 captures、params、routerName 等变量
        memo.push(function(ctx: any, next: any) {
          ctx.captures = layer.captures(path);
          ctx.params = layer.params(ctx.captures, ctx.params);
          ctx.routerName = layer.name;
          return next();
        });

        return memo.concat(layer.stack); // layer.stack 保存的就是中间件（每个路由下的）
      },
      []);

      return compose(layerChain)(ctx, next); // compse 所有的中间件
    };

    dispatch.router = this;

    return dispatch;
  }

  /**
   * Register route with all methods.
   *
   * @param {String} name Optional.
   * @param {String} path
   * @param {Function=} middleware You may also pass multiple middleware.
   * @param {Function} callback
   * @returns {Router}
   * @private
   */

  all(name, path: string, middleware): Router {
    var middleware;

    // name 是可选的
    if (typeof path === 'string') {
      middleware = Array.prototype.slice.call(arguments, 2);
    } else {
      middleware = Array.prototype.slice.call(arguments, 1);
      path = name;
      name = null;
    }

    this.register(path, METHODS_LOWERCASE, middleware, {
      name: name
    });

    return this;
  }

  /**
   * Lookup route with given `name`.
   *
   * @param {String} name
   * @returns {Layer|false}
   */

  route(name: string): Layer | false {
    var routes = this.stack;

    for (var len = routes.length, i = 0; i < len; i++) {
      if (routes[i].name && routes[i].name === name) {
        return routes[i];
      }
    }
    return false;
  }

  /**
   * Generate URL for route. Takes a route name and map of named `params`.
   *
   * @example
   *
   * ```javascript
   * router.get('user', '/users/:id', (ctx, next) => {
   *   // ...
   * });
   *
   * router.url('user', 3);
   * // => "/users/3"
   *
   * router.url('user', { id: 3 });
   * // => "/users/3"
   *
   * router.use((ctx, next) => {
   *   // redirect to named route
   *   ctx.redirect(ctx.router.url('sign-in'));
   * })
   *
   * router.url('user', { id: 3 }, { query: { limit: 1 } });
   * // => "/users/3?limit=1"
   *
   * router.url('user', { id: 3 }, { query: "limit=1" });
   * // => "/users/3?limit=1"
   * ```
   *
   * @param {String} name route name
   * @param {Object} params url parameters
   * @param {Object} [options] options parameter
   * @param {Object|String} [options.query] query options
   * @returns {String|Error}
   */

  url(name: string, params: object): string | Error {
    var route = this.route(name);

    if (route) {
      var args = Array.prototype.slice.call(arguments, 1);
      return route.url.apply(route, args);
    }

    return new Error(`No route found for name: ${name}`);
  }

  /**
   * Run middleware for named route parameters. Useful for auto-loading or
   * validation.
   *
   * @example
   *
   * ```javascript
   * router
   *   .param('user', (id, ctx, next) => {
   *     ctx.user = users[id];
   *     if (!ctx.user) return ctx.status = 404;
   *     return next();
   *   })
   *   .get('/users/:user', ctx => {
   *     ctx.body = ctx.user;
   *   })
   *   .get('/users/:user/friends', ctx => {
   *     return ctx.user.getFriends().then(function(friends) {
   *       ctx.body = friends;
   *     });
   *   })
   *   // /users/3 => {"id": 3, "name": "Alex"}
   *   // /users/3/friends => [{"id": 4, "name": "TJ"}]
   * ```
   *
   * @param {String} param
   * @param {Function} middleware
   * @returns {Router}
   */

  param(param: string, middleware: middlewareFunction): Router {
    this.params[param] = middleware; // well also used in router.register methods, afterwise

    // let every route insert this middleware, if param exist in route path regexp
    this.stack.forEach(function(route) {
      route.param(param, middleware);
    });
    return this;
  }
}

/**
 * Create `router.verb()` methods, where *verb* is one of the HTTP verbs such
 * as `router.get()` or `router.post()`.
 *
 * Match URL patterns to callback functions or controller actions using `router.verb()`,
 * where **verb** is one of the HTTP verbs such as `router.get()` or `router.post()`.
 *
 * Additionaly, `router.all()` can be used to match against all methods.
 *
 * ```javascript
 * router
 *   .get('/', (ctx, next) => {
 *     ctx.body = 'Hello World!';
 *   })
 *   .post('/users', (ctx, next) => {
 *     // ...
 *   })
 *   .put('/users/:id', (ctx, next) => {
 *     // ...
 *   })
 *   .del('/users/:id', (ctx, next) => {
 *     // ...
 *   })
 *   .all('/users/:id', (ctx, next) => {
 *     // ...
 *   });
 * ```
 *
 * When a route is matched, its path is available at `ctx._matchedRoute` and if named,
 * the name is available at `ctx._matchedRouteName`
 *
 * Route paths will be translated to regular expressions using
 * [path-to-regexp](https://github.com/pillarjs/path-to-regexp).
 *
 * Query strings will not be considered when matching requests.
 *
 * #### Named routes
 *
 * Routes can optionally have names. This allows generation of URLs and easy
 * renaming of URLs during development.
 *
 * ```javascript
 * router.get('user', '/users/:id', (ctx, next) => {
 *  // ...
 * });
 *
 * router.url('user', 3);
 * // => "/users/3"
 * ```
 *
 * #### Multiple middleware
 *
 * Multiple middleware may be given:
 *
 * ```javascript
 * router.get(
 *   '/users/:id',
 *   (ctx, next) => {
 *     return User.findOne(ctx.params.id).then(function(user) {
 *       ctx.user = user;
 *       next();
 *     });
 *   },
 *   ctx => {
 *     console.log(ctx.user);
 *     // => { id: 17, name: "Alex" }
 *   }
 * );
 * ```
 *
 * ### Nested routers
 *
 * Nesting routers is supported:
 *
 * ```javascript
 * var forums = new Router();
 * var posts = new Router();
 *
 * posts.get('/', (ctx, next) => {...});
 * posts.get('/:pid', (ctx, next) => {...});
 * forums.use('/forums/:fid/posts', posts.routes(), posts.allowedMethods());
 *
 * // responds to "/forums/123/posts" and "/forums/123/posts/123"
 * app.use(forums.routes());
 * ```
 *
 * #### Router prefixes
 *
 * Route paths can be prefixed at the router level:
 *
 * ```javascript
 * var router = new Router({
 *   prefix: '/users'
 * });
 *
 * router.get('/', ...); // responds to "/users"
 * router.get('/:id', ...); // responds to "/users/:id"
 * ```
 *
 * #### URL parameters
 *
 * Named route parameters are captured and added to `ctx.params`.
 *
 * ```javascript
 * router.get('/:category/:title', (ctx, next) => {
 *   console.log(ctx.params);
 *   // => { category: 'programming', title: 'how-to-node' }
 * });
 * ```
 *
 * The [path-to-regexp](https://github.com/pillarjs/path-to-regexp) module is
 * used to convert paths to regular expressions.
 *
 * @name get|put|post|patch|delete|del
 * @memberof module:koa-router.prototype
 * @param {String} path
 * @param {Function=} middleware route middleware(s)
 * @param {Function} callback route callback
 * @returns {Router}
 */

METHODS_LOWERCASE.forEach(function(methodName) {
  Router.prototype[methodName] = function(name, path, middleware) {
    var middleware;

    // 兼容 name 存在的情况
    if (typeof path === 'string' || path instanceof RegExp) {
      middleware = Array.prototype.slice.call(arguments, 2);
    } else {
      middleware = Array.prototype.slice.call(arguments, 1);
      path = name;
      name = null;
    }

    this.register(path, [methodName], middleware, {
      name: name
    });

    return this;
  };
});

// Alias for `router.delete()` because delete is a reserved word
Router.prototype['del'] = Router.prototype['delete'];

// Alias for `router.routes`
Router.prototype['middleware'] = Router.prototype['routes'];
