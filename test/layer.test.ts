import Router from '../src/index';
import Ette from 'ette';
import Layer from '../src/layer';

describe('[Layer] 中间件 - compose 多个中间件', function() {
  it('可以 compose 多个中间件', function() {
    var app = new Ette();
    var router = new Router();
    var client = app.client;
    (router as any).get(
      '/:category/:title',
      function(ctx, next) {
        ctx.response.status = 500;
        return next();
      },
      function(ctx, next) {
        ctx.response.status = 204;
        return next();
      }
    );
    app.use(router.routes());

    client
      .get('/programming/how-to-node')
      .then(res => {
        expect(res.status).toBe(204);
      })
      .catch(err => {
        console.log(err);
      });
  });
});

describe('[Layer] 方法 - match 方法', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
    app.use(router.routes());
  });
  test('能够捕获 URL 路径中的参数', function() {
    (router as any).get('/:category/:title', function(ctx) {
      expect(ctx).toHaveProperty('params');
      expect(ctx.params).toEqual({
        category: 'match',
        title: 'this'
      });
      ctx.response.status = 204;
    });
    client
      .get('/match/this')
      .then(res => {
        expect(res.status).toBe(204);
      })
      .catch(err => {
        console.log(err);
      });
  });

  test('如果 decodeURIComponent 报错，将返回原始的 url 参数', function() {
    (router as any).get('/:category/:title', function(ctx) {
      expect(ctx).toHaveProperty('params');
      expect(ctx.params).toEqual({
        category: '100%',
        title: '101%'
      });
      ctx.response.status = 204;
    });
    client
      .get('/100%/101%')
      .then(res => {
        expect(res.status).toBe(204);
      })
      .catch(err => {
        console.log(err);
      });
  });

  test('属性 ctx.captures 存储根据正则表达式捕获的参数', function() {
    router.get(
      /^\/api\/([^\/]+)\/?/i,
      function(ctx, next) {
        expect(ctx).toHaveProperty('captures');
        expect(ctx.captures).toEqual(['1']);
        return next();
      },
      function(ctx) {
        expect(ctx).toHaveProperty('captures');
        expect(ctx.captures).toEqual(['1']);
        ctx.response.status = 204;
      }
    );
    client
      .get('/api/1')
      .then(res => {
        expect(res.status).toBe(204);
      })
      .catch(err => {
        console.log(err);
      });
  });
  test('属性 ctx.captures 捕获参数时如果 decodeURIComponent 报错，则存储原始值', function() {
    router.get(
      /^\/api\/([^\/]+)\/?/i,
      function(ctx, next) {
        expect(ctx).toHaveProperty('captures');

        expect(ctx.captures).toEqual(['101%']);

        return next();
      },
      function(ctx) {
        expect(ctx).toHaveProperty('captures');
        expect(ctx.captures).toEqual(['101%']);
        ctx.response.status = 204;
      }
    );
    client
      .get('/api/101%')
      .then(res => {
        expect(res.status).toBe(204);
      })
      .catch(err => {
        console.log(err);
      });
  });

  //  get regex from http://forbeslindesay.github.io/express-route-tester/
  test('属性 ctx.captures 存储内容有可能是 undefined', function() {
    router.get(
      /^\/api(?:\/([^\/]+?))?\/?$/i, // for '/api/:num?' express
      function(ctx, next) {
        expect(ctx).toHaveProperty('captures');
        expect(ctx.captures[0]).toBeUndefined();
        return next();
      },
      function(ctx) {
        expect(ctx).toHaveProperty('captures');
        expect(ctx.captures[0]).toBeUndefined();
        ctx.response.status = 204;
      }
    );
    client
      .get('/api/')
      .then(res => {
        expect(res.status).toBe(204);
      })
      .catch(err => {
        console.log(err);
      });
  });

  test('当传入对应路由的回调函数不存在时，应该给予友好提示', function() {
    var notexistHandle = undefined;
    expect(() => {
      router.get('/foo', notexistHandle);
    }).toThrowError(
      '[ette-router] Invariant failed: get `/foo`: `middleware` must be a function, not "undefined"'
    );

    expect(() => {
      router.get('foo router', '/foo', notexistHandle);
    }).toThrowError(
      '[ette-router] Invariant failed: get `foo router`: `middleware` must be a function, not "undefined"'
    );

    expect(() => {
      router.post('foo router', '/foo', notexistHandle);
    }).toThrowError(
      '[ette-router] Invariant failed: post `foo router`: `middleware` must be a function, not "undefined"'
    );
  });
});

describe('[Layer] 方法 - param 方法', () => {
  let app, router, client, route;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
    app.use(router.routes());
  });

  test('针对参数可以应用中间件', () => {
    route = new Layer(
      '/users/:user',
      ['GET'],
      [
        function(ctx) {
          ctx.response.body = ctx.user;
        }
      ]
    );

    route.param('user', function(id, ctx, next) {
      ctx.user = { name: 'jscon' };
      if (!id) return (ctx.response.status = 404);
      ctx.response.status = 200;
      return next();
    });
    router.stack.push(route);

    client.get('/users/3').then(res => {
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        name: 'jscon'
      });
    });
  });

  test('不匹配参数的中间件会被忽略', () => {
    route = new Layer(
      '/users/:user',
      ['GET'],
      [
        function(ctx) {
          ctx.response.body = ctx.user;
        }
      ]
    );

    route.param('user', function(id, ctx, next) {
      ctx.user = { name: 'jscon' };
      if (!id) return (ctx.response.status = 404);
      ctx.response.status = 200;
      return next();
    });

    route.param('title', function(id, ctx, next) {
      ctx.user = { name: 'mark' };
      if (!id) return (ctx.response.status = 404);
      ctx.response.status = 200;
      return next();
    });
    router.stack.push(route);

    client.get('/users/3').then(res => {
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        name: 'jscon'
      });
    });
  });
});

describe('[Layer] 方法 - url 方法', () => {
  test('生成 route URL', function() {
    var route = new Layer(
      '/:category/:title',
      ['get'],
      [function() {}]
    );
    var url = route.url({ category: 'programming', title: 'how-to-node' });
    expect(url).toBe('/programming/how-to-node');
    url = route.url('programming', 'how-to-node');
    expect(url).toBe('/programming/how-to-node');
  });

  test('使用 encodeURIComponent() 进行转义', function() {
    var route = new Layer(
      '/:category/:title',
      ['get'],
      [function() {}]
    );
    var url = route.url({ category: 'programming', title: 'how to node' });
      expect(url).toBe('/programming/how%20to%20node')
  });
});
