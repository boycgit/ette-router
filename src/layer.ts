import { Key, Path, Token } from 'path-to-regexp';
import { HTTP_METHOD, invariant, safeDecodeURIComponent } from './lib';
import { middlewareFunction } from './compose';
const pathToRegExp = require('path-to-regexp');
const Url = require('url-parse');

export interface LayerOptions {
  end?: boolean;
  name?: string;
  sensitive?: boolean;
  strict?: boolean;
  ignoreCaptures?: boolean;
  [propName: string]: any;
}

interface MiddleFnWithParam {
  (ctx, next): any;
  param?: string;
}

export default class Layer {
  opts: LayerOptions;
  name?: string;
  methods: Array<HTTP_METHOD>;
  paramNames: Key[];
  stack: middlewareFunction[];
  path: Path;
  regexp: RegExp;

  /**
   * Creates an instance of Layer.
   * @example
   *
   * ```js
   * var route = new Layer('/users/:id', ['GET'], fn);
   * // `this.regexp` is `/^\/users\/([^\/]+?)(?:\/)?$/i`
   * // `this.paramNames` is `[{"name":"id","prefix":"/","delimiter":"/","optional":false,"repeat":false,"partial":false,"pattern":"[^\\/]+?"}]`
   *
   *
   * ```
   *
   * @param {*} path
   * @param {*} methods
   * @param {*} middleware
   * @param {*} opts
   * @memberof Layer
   *
   *
   */
  constructor(path, methods, middleware, opts?) {
    this.opts = opts || {};
    this.name = this.opts.name || void 0;
    this.methods = []
      .concat(methods)
      .map((method: HTTP_METHOD) => method.toUpperCase()) as Array<HTTP_METHOD>;
    this.paramNames = [];
    this.stack = Array.isArray(middleware) ? middleware : [middleware];
    this.path = path;
    this.regexp = pathToRegExp(path, this.paramNames, this.opts);
    // ensure middleware is a function
    this.stack.forEach(fn => {
      const type = typeof fn;
      invariant(
        type === 'function',
        `${methods.toString()} \`${this.opts.name ||
          path}\`: \`middleware\` must be a function, not "${type}"`
      );
    });
  }

  match(path: string): boolean {
    // console.log('111', path, this.regexp, this.regexp.test(path));
    return this.regexp.test(path);
  }

  /**
   * Returns map of URL parameters for given `path` and `paramNames`.
   * @example
   *
   * ```js
   * var route = new Layer('/users/:id', ['GET'], fn);
   *
   * route.params(["jscon"]); // => {id: jscon}
   * ```
   * @param {String} path
   * @param {Array.<String>} captures
   * @param {Object=} existingParams
   * @returns {Object}
   * @private
   *
   */
  params(captures: string[], existingParams = {}) {
    var params = existingParams;
    for (var len = captures.length, i = 0; i < len; i++) {
      if (this.paramNames[i]) {
        var c = captures[i];
        params[this.paramNames[i].name] = c ? safeDecodeURIComponent(c) : c;
      }
    }

    return params;
  }
  /**
   * Returns array of regexp url path captures.
   * @example
   *
   * ```js
   * var route = new Layer('/users/:id', ['GET'], fn);
   *
   * route.captures('/users/jscon'); // => ["jscon"]
   * ```
   *
   * @param {String} path
   * @returns {Array.<String>}
   * @private
   *
   */

  captures(path) {
    if (this.opts.ignoreCaptures) return [];
    return path.match(this.regexp).slice(1);
  }

  /**
   * Generate URL for route using given `params`.
   *
   * @example
   *
   * ```javascript
   * var route = new Layer('/users/:id', ['GET'], fn);
   *
   * route.url({ id: 123 }, {query: 'foo=bar&test=true'}); // => "/users/123?foo=bar&test=true"
   *
   * // 也可直接传入替换的值，不推荐这么做，因为不太直观
   * route.url(123, {query: 'foo=bar&test=true'}); // => "users/123?foo=bar&test=true"
   * ```
   *
   * @param {Object} params url parameters
   * @returns {String}
   * @private
   */
  url(params, options?) {
    var args = params;
    var url = (<string>this.path).replace(/\(\.\*\)/g, '');
    var toPath = pathToRegExp.compile(url);
    var replaced;

    //    兼容 route.url('jscon') 这种非对象形式
    if (typeof params != 'object') {
      args = Array.prototype.slice.call(arguments);
      if (typeof args[args.length - 1] == 'object') {
        options = args[args.length - 1];
        args = args.slice(0, args.length - 1);
      }
    }

    // tokens:
    // ["/users",
    //  {"name":"id","prefix":"/","delimiter":"/","optional":false,"repeat":false,"partial":false,"pattern":"[^\\/]+?"}
    // ]
    var tokens: Token[] = pathToRegExp.parse(url);

    var replace = {}; // 存储真正的替换用的键值对，比如 {id: 123}

    if (args instanceof Array) {
      for (var len = tokens.length, i = 0, j = 0; i < len; i++) {
        const token = <Key>tokens[i];
        if (token.name) replace[token.name] = args[j++];
      }
    } else if (tokens.some((token: Key) => !!token.name)) {
      replace = params;
    } else {
      options = params;
    }

    replaced = toPath(replace); // "/user/123"

    // 如果存在 query, 则调用 Url 进行 format
    if (options && options.query) {
      const url = new Url(replaced, {});
      url.set('query', options.query);
      return url.toString();
    }

    return replaced;
  }

  /**
   * Run validations on route named parameters.
   *
   * @example
   *
   * ```javascript
   * layer
   *   .param('id', function (id, ctx, next) {
   *     ctx.user = users[id];
   *     if (!user) return ctx.status = 404;
   *     next();
   *   })
   * ```
   *
   * @param {String} param
   * @param {Function} middleware
   * @returns {Layer}
   * @private
   */

  param(param, fn: middlewareFunction) {
    var stack = this.stack;
    var params = this.paramNames;
    var middleware: MiddleFnWithParam = function(ctx, next) {
      return fn.call(this, ctx.params[param], ctx, next);
    };
    middleware.param = param;

    var names = params.map(function(p) {
      return p.name;
    });

    var x = names.indexOf(param);
    if (x > -1) {
      // iterate through the stack, to figure out where to place the handler fn
      stack.some(function(fn: MiddleFnWithParam, i) {
        // param handlers are always first, so when we find an fn w/o a param property, stop here
        // if the param handler at this part of the stack comes after the one we are adding, stop here
        if (!fn.param || names.indexOf(fn.param) > x) {
          // inject this param handler right before the current item
          stack.splice(i, 0, middleware);
          return true; // then break the loop
        }

        return false;
      });
    }

    return this;
  }

  /**
   * Prefix route path.
   *
   * @param {String} prefix
   * @returns {Layer}
   * @private
   */

  setPrefix(prefix: string) {
    if (this.path) {
      this.path = prefix + this.path;
      this.paramNames = [];
      this.regexp = pathToRegExp(this.path, this.paramNames, this.opts);
    }

    return this;
  }
}
