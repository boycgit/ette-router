import Router from '../src/index';
import { HTTP_METHOD } from '../src/lib';
import Ette from 'ette';
const METHODS_LOWERCASE: string[] = Object.keys(HTTP_METHOD).map(k =>
  HTTP_METHOD[k as any].toLowerCase()
);

describe('[Router] 构造函数 - 创建实例', function() {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
    app.use(router.routes());
  });
  test('简单创建实例', function() {
    expect(router).toBeInstanceOf(Router);
  });

  test('router 拥有中间件属性 route', () => {
    expect(router).toHaveProperty('routes');
    expect(router.routes).toBeInstanceOf(Function);
    var middleware = router.routes();
    expect(middleware).toBeInstanceOf(Function);
  });

  test('支持 promise 作为中间件', done => {
    var getMsg = function() {
      return new Promise(function(resolve, reject) {
        setTimeout(() => {
          resolve({ msg: 'hello world' });
        }, 0);
      });
    };
    router.get(
      '/',
      function(ctx, next) {
        return next();
      },
      function(ctx) {
        return getMsg().then(function(msg) {
          ctx.response.body = msg;
          ctx.response.status = 204;
        });
      }
    );

    client
      .get('/')
      .then(res => {
        expect(res.status).toBe(204);
        expect(res.body).toEqual({
          msg: 'hello world'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
});

describe('[Router] 路由 - 路由规则', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
  });

  test('支持根据 ctx.routerPath 自定义路由规则 [ref - custom routerPath]', done => {
    app.use(function(ctx, next) {
      // bind /users => example/users
      ctx.routerPath = `/example${ctx.request.path}`;
      return next();
    });
    router.get('/example/users', function(ctx) {
      ctx.response.body = ctx.request.method + ' ' + ctx.request.path;
      ctx.response.status = 202;
    });

    app.use(router.routes());

    client
      .get('/users')
      .then(res => {
        expect(res.status).toBe(202);
        expect(res.body).toBe('GET /users');
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('当匹配到路由规则时，才会运行其对应的中间件', done => {
    var otherRouter = new Router();

    router.use(function(ctx, next) {
      ctx.response.body = { bar: 'baz' };
      return next();
    });

    (otherRouter as any).get('/bar', function(ctx, next) {
      ctx.response.status = 202;
      ctx.response.body = { foo: 'bar' };
      return next();
    });

    app.use(router.routes()).use(otherRouter.routes());
    client
      .get('/bar')
      .then(res => {
        expect(res.status).toBe(202);
        expect(res.body).toEqual({
          foo: 'bar'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('如果不调用 next 方法，将不会调用后续路由', done => {
    router.get(
      'user_page',
      '/user/(.*).jsx',
      function(ctx, next) {
        //   return next();
        // no next()
      },
      function(ctx) {
        ctx.response.body = { order: 1 };
      }
    );

    client
      .get('/user/account.jsx')
      .then(res => {
        expect(res.status).toBe(404);
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('当匹配多个路由规则时，匹配到的路由规则叠加起作用', done => {
    router
      .get('user_page', '/user/(.*).jsx', function(ctx, next) {
        ctx.response.body = { order: 1, name: 'user_page' };
        ctx.response.status = 201;
        return next();
      })
      .all('app', '/app/(.*).jsx', function(ctx, next) {
        ctx.response.body = { order: 2 };
        ctx.response.status = 202;
        return next();
      })
      .all('view', '(.*).jsx', function(ctx, next) {
        ctx.response.body.order = 3;
        ctx.response.status = 203;
        return next();
      });

    app.use(router.routes());
    client
      .get('/user/account.jsx')
      .then(res => {
        expect(res.status).toBe(203);
        expect(res.body).toEqual({
          order: 3,
          name: 'user_page'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('当匹配多个路由规则时，如果不调用 next，则只会运行最先匹配的中间件', done => {
    router
      .get('user_page', '/user/(.*).jsx', function(ctx, next) {
        ctx.response.body = { order: 1, name: 'user_page' };
        ctx.response.status = 201;
      })
      .all('app', '/app/(.*).jsx', function(ctx, next) {
        ctx.response.body = { order: 2 };
        ctx.response.status = 202;
        return next();
      })
      .all('view', '(.*).jsx', function(ctx, next) {
        ctx.response.body.order = 3;
        ctx.response.status = 203;
        return next();
      });

    app.use(router.routes());
    client
      .get('/user/account.jsx')
      .then(res => {
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          order: 1,
          name: 'user_page'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('内联 route 如果使用正则表达式，不会破坏父路由的正常运行', done => {
    var parentRouter = new Router();
    var nestedRouter = new Router();

    (nestedRouter as any)
      .get(/^\/\w$/i, function(ctx, next) {
        return next();
      })
      .get('/first-nested-route', function(ctx, next) {
        return next();
      })
      .get('/second-nested-route', function(ctx, next) {
        return next();
      });

    parentRouter.use(
      '/parent-route',
      function(ctx, next) {
        return next();
      },
      nestedRouter.routes()
    );

    app.use(parentRouter.routes());
    client
      .get('/parent-route')
      .then(res => {
        expect(res.status).toBe(404);
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('支持 promise（本质是为了支持 async/await）', done => {
    router.get('/async', function(ctx, next) {
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          ctx.response.body = {
            msg: 'promises!'
          };
          resolve(next());
        }, 1);
      });
    });

    app.use(router.routes());
    client
      .get('/async')
      .then(res => {
        expect(res.status).toBe(404);
        expect(res.body).toEqual({
          msg: 'promises!'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
});

describe('[Router] 路由 - 子中间件', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
    app.use(router.routes());
  });

  test('子中间件运行在父中间件之后', done => {
    var subrouter = new Router().use(function(ctx, next) {
      ctx.msg = 'subrouter';
      return next();
    });

    (subrouter as any).get('/', function(ctx) {
      ctx.response.body = { msg: ctx.msg };
      ctx.response.status = 200;
    });
    var router = new Router()
      .use(function(ctx, next) {
        ctx.msg = 'router';
        return next();
      })
      .use(subrouter.routes());
    app.use(router.routes());

    client
      .get('/')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          msg: 'subrouter'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('子中间件运行时，会携带父中间件信息', done => {
    var subrouter = new Router();

    (subrouter as any).get('/sub', function(ctx) {
      ctx.response.body = { msg: ctx.msg };
      ctx.response.status = 200;
    });
    var router = new Router()
      .use(function(ctx, next) {
        ctx.msg = 'router';
        return next();
      })
      .use('/parent', subrouter.routes());
    app.use(router.routes());

    client
      .get('/parent/sub')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          msg: 'router'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
});

describe('[Router] 路由 - context 上下文', function() {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
    app.use(router.routes());
  });

  test('router 实例之间共享中间件的 ctx', function(done) {
    const router2 = new Router();
    router.get('/', function(ctx, next) {
      ctx.foo = 'bar';
      return next();
    });
    (router2 as any).get('/', function(ctx, next) {
      ctx.baz = 'qux';
      ctx.response.body = { foo: ctx.foo };
      ctx.response.status = 202;
      return next();
    });
    app.use(router.routes()).use(router2.routes());
    client
      .get('/')
      .then(res => {
        expect(res.status).toBe(202);
        expect(res.body).toEqual({ foo: 'bar' });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('注册中间件时可以指定共同路径', function(done) {
    var parentRouter = new Router();
    var nestedRouter = new Router();

    (nestedRouter as any)
      .get('/first-nested-route', function(ctx, next) {
        ctx.response.body = { n: ctx.n };
        ctx.response.status = 202;
        return next();
      })
      .get('/second-nested-route', function(ctx, next) {
        return next();
      })
      .get('/third-nested-route', function(ctx, next) {
        return next();
      });

    parentRouter.use(
      '/parent-route',
      function(ctx, next) {
        ctx.n = ctx.n ? ctx.n + 1 : 1;
        return next();
      },
      nestedRouter.routes()
    );

    app.use(parentRouter.routes());

    client
      .get('/parent-route/first-nested-route')
      .then(res => {
        expect(res.status).toBe(202);
        expect(res.body).toEqual({ n: 1 });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('router 作为属性挂载到 ctx 对象上', function(done) {
    router.get('home', '/', function(ctx, next) {
      ctx.response.body = {
        url: ctx.router.url('home')
      };
      ctx.response.status = 202;
      return next();
    });
    app.use(router.routes());
    client
      .get('/')
      .then(res => {
        expect(res.status).toBe(202);
        expect(res.body.url).toBe('/');
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('每个 router 上可以注册多个中间件', function(done) {
    router.get(
      '/double',
      function(ctx, next) {
        return new Promise(function(resolve) {
          setTimeout(function() {
            ctx.response.body = { message: 'Hello' };
            resolve(next());
          }, 1);
        });
      },
      function(ctx, next) {
        return new Promise(function(resolve) {
          setTimeout(function() {
            ctx.response.body.message += ' World';
            resolve(next());
          }, 1);
        });
      },
      function(ctx, next) {
        ctx.response.status = 202;
        ctx.response.body.message += '!';
        return next();
      }
    );

    app.use(router.routes());
    client
      .get('/double')
      .then(res => {
        expect(res.status).toBe(202);
        expect(res.body.message).toBe('Hello World!');
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
});

describe('[Router] 路由 - 路由的内联', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
  });

  test('在 root path 下，配置内联路由规则 [ref-nests with root prefixes]', done => {
    var forums = new Router({
      prefix: '/forums'
    });
    var posts = new Router({
      prefix: '/:fid/posts'
    });

    (posts as any)
      .get('/', function(ctx, next) {
        ctx.response.status = 204;
      })
      .get('/:pid', function(ctx, next) {
        ctx.response.status = 200;
        ctx.response.body = ctx.params;
        return next();
      });

    forums.use(posts.routes());
    app.use(forums.routes());

    client
      .get('/forums/1/posts/')
      .then(res => {
        expect(res.status).toBe(204);
        return client.get('/forums/1');
      })
      .then(res => {
        expect(res.status).toBe(404);
        return client.get('/forums/1/posts/2');
      })
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          fid: '1',
          pid: '2'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('在指定 path 下，配置内联路由规则 [ref-nests with special prefixes]', done => {
    var forums = new Router({
      prefix: '/api'
    });
    var posts = new Router({
      prefix: '/posts'
    });

    (posts as any)
      .get('/', function(ctx, next) {
        ctx.response.status = 204;
      })
      .get('/:pid', function(ctx, next) {
        ctx.response.status = 200;
        ctx.response.body = ctx.params;
        return next();
      });

    forums.use('/forums/:fid', posts.routes());
    app.use(forums.routes());

    client
      .get('/api/forums/1/posts/')
      .then(res => {
        expect(res.status).toBe(204);
        return client.get('/forums/1');
      })
      .then(res => {
        expect(res.status).toBe(404);
        return client.get('/api/forums/1/posts/2');
      })
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          fid: '1',
          pid: '2'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
});

describe('[Router] 路由 - verb() 方法', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
    app.use(router.routes());
  });
  it('给每个 HTTP verb 注册一个路由动作', function() {
    METHODS_LOWERCASE.forEach(function(method) {
      expect(router).toHaveProperty(method);
      expect(router[method]).toBeInstanceOf(Function);
      router[method]('/', function() {});
    });
    expect(router.stack.length).toBe(METHODS_LOWERCASE.length);
  });

  it('使用正则表达式注册路由', () => {
    METHODS_LOWERCASE.forEach(function(method) {
      expect(router[method](/^\/\w$/i, function() {})).toBe(router);
    });
  });
  it('使用名字注册路由', () => {
    METHODS_LOWERCASE.forEach(function(method) {
      expect(router[method](method, '/', function() {})).toBe(router);
    });
  });
  it('使用名字 + 正则表达式注册路由', () => {
    METHODS_LOWERCASE.forEach(function(method) {
      expect(router[method](method, /^\/$/i, function() {})).toBe(router);
    });
  });

  it('支持批量路径注册路由', () => {
    router.get(['/one', '/two'], function(ctx, next) {
      return next();
    });
    expect(router.stack.length).toBe(2);
    expect(router.stack[0].path).toBe('/one');
    expect(router.stack[1].path).toBe('/two');
  });

  test('匹配相应的 request 方法', done => {
    router.get('/:category/:title', function(ctx) {
      expect(ctx).toHaveProperty('params');
      expect(ctx.params).toEqual({
        category: 'programming',
        title: 'how-to-node'
      });
      ctx.response.status = 201;
    });
    router.post('/:category', function(ctx) {
      expect(ctx).toHaveProperty('params');
      expect(ctx.params).toEqual({
        category: 'programming'
      });
      ctx.response.status = 202;
    });
    router.put('/:category/not-a-title', function(ctx) {
      expect(ctx).toHaveProperty('params');
      expect(ctx.params).toEqual({
        category: 'programming'
      });
      ctx.response.status = 203;
    });

    client
      .get('/programming/how-to-node')
      .then(res => {
        expect(res.status).toBe(201);
        return client.post('/programming');
      })
      .then(res => {
        expect(res.status).toBe(202);
        return client.put('/programming/not-a-title');
      })
      .then(res => {
        expect(res.status).toBe(203);
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
});

describe('[Router] 路由 - 参数', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
    app.use(router.routes());
  });
  test('匹配无参数路由，对应参数是 undefined', done => {
    router.get('/notparameter', function(ctx, next) {
      ctx.response.body = {
        param: ctx.params.parameter
      };
      ctx.response.status = 201;
    });

    router.get('/:parameter', function(ctx, next) {
      ctx.response.body = {
        param: ctx.params.parameter
      };
      ctx.response.status = 202;
    });

    client
      .get('/notparameter')
      .then(res => {
        expect(res.status).toBe(201);
        expect(res.body.param).toBeUndefined();
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
});

describe('[Router] 方法 - use', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
    app.use(router.routes());
  });
  test('无 path 情况运行路由中间件', done => {
    router.use(function(ctx, next) {
      ctx.foo = 'baz';
      return next();
    });

    router.use(function(ctx, next) {
      ctx.foo = 'foo';
      return next();
    });

    router.get('/foo/bar', function(ctx) {
      ctx.response.body = {
        foobar: ctx.foo + 'bar'
      };
      ctx.response.status = 201;
    });

    client
      .get('/foo/bar')
      .then(res => {
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          foobar: 'foobar'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
  test('指定 path 下运行路由中间件', done => {
    router.use('/foo/bar', function(ctx, next) {
      ctx.foo = 'foo';
      return next();
    });

    router.get('/foo/bar', function(ctx) {
      ctx.response.body = {
        foobar: ctx.foo + 'bar'
      };
      ctx.response.status = 201;
    });

    client
      .get('/foo/bar')
      .then(res => {
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          foobar: 'foobar'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
  test('总是先运行父中间件，再运行子中间件', done => {
    var subrouter = new Router();
    router.use(function(ctx, next) {
      ctx.foo = 'foo';
      return next();
    });

    subrouter.use(function(ctx, next) {
      ctx.foo = 'foo';
      return next();
    });
    (subrouter as any).get('/bar', function(ctx) {
      ctx.response.body = {
        foobar: ctx.foo + 'bar'
      };
      ctx.response.status = 201;
    });

    router.use('/foo', subrouter.routes());

    client
      .get('/foo/bar')
      .then(res => {
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          foobar: 'foobar'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('中间件可以同时应用在多条路径里', done => {
    router.use(['/foo', '/bar'], function(ctx, next) {
      ctx.foo = 'foo';
      ctx.bar = 'bar';
      return next();
    });

    router.get('/foo', function(ctx, next) {
      ctx.response.body = {
        foobar: ctx.foo + '1bar'
      };
      ctx.response.status = 201;
    });

    router.get('/bar', function(ctx) {
      ctx.response.body = {
        foobar: '1foo' + ctx.bar
      };
      ctx.response.status = 202;
    });

    client
      .get('/foo')
      .then(res => {
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          foobar: 'foo1bar'
        });
        return client.get('/bar');
      })
      .then(res => {
        expect(res.status).toBe(202);
        expect(res.body).toEqual({
          foobar: '1foobar'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('不要给没设置路径前缀的路由中间件添加 (.*) 路由匹配', done => {
    var nested = new Router();
    var called = 0;

    (nested as any)
      .get('/', (ctx, next) => {
        ctx.response.body = 'root';
        called += 1;
        return next();
      })
      .get('/test', (ctx, next) => {
        ctx.response.body = 'test';
        called += 1;
        return next();
      });

    router.use(nested.routes());

    client
      .get('/test')
      .then(res => {
        expect(res.body).toBe('test');
        expect(called).toBe(1);
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
});

describe('[Router] 方法 - register', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
  });

  test('注册新的路由', () => {
    expect(router).toHaveProperty('register');
    expect(router.register).toBeInstanceOf(Function);
    router.register('/', ['GET', 'POST'], function() {});
    app.use(router.routes());
    expect(router.stack).toBeInstanceOf(Array);
    expect(router.stack.length).toBe(1);
    expect(router.stack[0].path).toBe('/');
  });
});

describe('[Router] 方法 - route', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
  });
  it('能够从子路由那儿获取路由信息', function() {
    var subrouter = new Router();

    (subrouter as any).get('child', '/hello', function(ctx) {
      ctx.response.body = { hello: 'world' };
    });
    router.use(subrouter.routes());
    expect(router.route('child')).toHaveProperty('name', 'child');
  });
});
describe('[Router] 方法 - url', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
  });
  it('给定 route name 前提下，可以生成 URL', function() {
    app.use(router.routes());
    router.get('books', '/:category/:title', function(ctx) {
      ctx.response.status = 204;
    });
    var url = router.url('books', {
      category: 'programming',
      title: 'how to node'
    });
    expect(url).toBe('/programming/how%20to%20node');

    // 第二种方式
    url = router.url('books', 'programming', 'how to node');
    expect(url).toBe('/programming/how%20to%20node');
  });

  it('在给定内联路由名字的前提下，生成 URL ', function() {
    router = new Router({
      prefix: '/books'
    });

    var embeddedRouter = new Router({
      prefix: '/chapters'
    });
    (embeddedRouter as any).get(
      'chapters',
      '/:chapterName/:pageNumber',
      function(ctx) {
        ctx.response.status = 204;
      }
    );
    router.use(embeddedRouter.routes());
    app.use(router.routes());
    var url = router.url('chapters', {
      chapterName: 'Learning ECMA6',
      pageNumber: 123
    });

    expect(url).toBe('/books/chapters/Learning%20ECMA6/123');

    url = router.url('chapters', 'Learning ECMA6', 123);
    expect(url).toBe('/books/chapters/Learning%20ECMA6/123');
  });
  it('当有两个内联路由的时候，给定内联路由名字可以生成 URL ', function() {
    router = new Router({
      prefix: '/books'
    });

    var embeddedRouter = new Router({
      prefix: '/chapters'
    });
    var embeddedRouter2 = new Router({
      prefix: '/:chapterName/pages'
    });
    (embeddedRouter2 as any).get('chapters', '/:pageNumber', function(ctx) {
      ctx.response.status = 204;
    });
    embeddedRouter.use(embeddedRouter2.routes());
    router.use(embeddedRouter.routes());
    app.use(router.routes());
    var url = router.url('chapters', {
      chapterName: 'Learning ECMA6',
      pageNumber: 123
    });

    expect(url).toBe('/books/chapters/Learning%20ECMA6/pages/123');
  });

  it('在给定路由名的时候，通过 params 和 query 可生成 url ', function() {
    router.get('books', '/books/:category/:id', function(ctx) {
      ctx.status = 204;
    });
    var url = router.url('books', 'programming', 4, {
      query: { page: 3, limit: 10 }
    });
    expect(url).toBe('/books/programming/4?page=3&limit=10');

    var url = router.url(
      'books',
      { category: 'programming', id: 4 },
      { query: { page: 3, limit: 10 } }
    );
    expect(url).toBe('/books/programming/4?page=3&limit=10');

    var url = router.url(
      'books',
      { category: 'programming', id: 4 },
      { query: 'page=3&limit=10' }
    );
    expect(url).toBe('/books/programming/4?page=3&limit=10');
  });

  test('在给定路由名，没有 params 只有 query 也可生成 url', function() {
    router.get('category', '/category', function(ctx) {
      ctx.response.status = 204;
    });
    var url = router.url('category', {
      query: { page: 3, limit: 10 }
    });
    expect(url).toBe('/category?page=3&limit=10');
  });
});

describe('[Router] 方法 - param', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
    app.use(router.routes());
  });
  test('能运行 param 中间件', done => {
    router
      .param('user', (id, ctx, next) => {
        ctx.user = { name: 'alex' };
        if (!id) return (ctx.response.status = 404);
        return next();
      })
      .get('/users/:user', function(ctx, next) {
        ctx.response.body = ctx.user;
        ctx.response.status = 200;
      });

    client
      .get('/users/3')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ name: 'alex' });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('按 URL 中出现的顺序运行 param 中间件', done => {
    router
      .param('user', function(id, ctx, next) {
        ctx.user = { name: 'alex' };
        if (ctx.ranFirst) {
          ctx.user.ordered = 'parameters';
        }
        if (!id) return (ctx.response.status = 404);
        ctx.response.status = 200;
        return next();
      })
      .param('first', function(id, ctx, next) {
        ctx.ranFirst = true;
        if (ctx.user) {
          ctx.ranFirst = false;
        }
        if (!id) return (ctx.response.status = 404);
        return next();
      })
      .get('/:first/users/:user', function(ctx) {
        ctx.response.body = ctx.user;
      });

    client
      .get('/first/users/3')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ name: 'alex', ordered: 'parameters' });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
  test('即使乱序地增加 param 中间件，仍旧是按 URL 中出现的顺序运行 param 中间件 ', done => {
    router
      // intentional random order
      .param('a', function(id, ctx, next) {
        ctx.state = {
          loaded: [id]
        };
        return next();
      })
      .param('d', function(id, ctx, next) {
        ctx.state.loaded.push(id);
        return next();
      })
      .param('c', function(id, ctx, next) {
        ctx.state.loaded.push(id);
        return next();
      })
      .param('b', function(id, ctx, next) {
        ctx.state.loaded.push(id);
        return next();
      })
      .get('/:a/:b/:c/:d', function(ctx, next) {
        ctx.response.body = ctx.state.loaded;
        ctx.response.status = 200;
      });

    client
      .get('/1/2/3/4')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual(['1', '2', '3', '4']);
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('在子路由中可以运行父路由中的 param 中间件 ', done => {
    var subrouter = new Router();
    (subrouter as any).get('/:cid', function(ctx) {
      ctx.response.body = {
        id: ctx.params.id,
        cid: ctx.params.cid
      };
      ctx.response.status = 200;
    });
    router
      .param('id', function(id, ctx, next) {
        ctx.params.id = 'ran';
        if (!id) return (ctx.response.status = 404);
        return next();
      })
      .use('/:id/children', subrouter.routes());

    client
      .get('/did-not-run/children/2')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          id: 'ran',
          cid: '2'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
});

describe('[Router] 方法 - opts 选项', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
  });

  test('设置 strict 选项为 true', done => {
    router = new Router({
      strict: true
    });
    router.get('/info', function(ctx) {
      ctx.response.body = 'hello';
      ctx.response.status = 200;
    });
    app.use(router.routes());

    client
      .get('/info')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toBe('hello');
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });

    client
      .get('/info/')
      .then(res => {
        expect(res.status).toBe(404);
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
  test('当设置 strict 选项为 false（默认），末尾的 `/` 是可选的', done => {
    router = new Router();
    router.get('/info', function(ctx) {
      ctx.response.body = 'hello';
      ctx.response.status = 200;
    });
    app.use(router.routes());

    client
      .get('/info')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toBe('hello');
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });

    client
      .get('/info/')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toBe('hello');
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('嵌套路由下，子路由设置 strict 为 true', done => {
    var subrouter = new Router({
      strict: true
    });
    router.use(function(ctx, next) {
      ctx.foo = 'foo';
      return next();
    });

    subrouter.use(function(ctx, next) {
      ctx.foo = 'foo';
      return next();
    });
    (subrouter as any).get('/bar', function(ctx) {
      ctx.response.body = {
        foobar: ctx.foo + 'bar'
      };
      ctx.response.status = 201;
    });

    router.use('/foo', subrouter.routes());
    app.use(router.routes());

    client
      .get('/foo/bar')
      .then(res => {
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          foobar: 'foobar'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
    client
      .get('/foo/bar/')
      .then(res => {
        expect(res.status).toBe(404);
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
  test('嵌套路由下，子路由设置 strict 为 false（默认）', done => {
    var subrouter = new Router();
    router.use(function(ctx, next) {
      ctx.foo = 'foo';
      return next();
    });

    subrouter.use(function(ctx, next) {
      ctx.foo = 'foo';
      return next();
    });
    (subrouter as any).get('/bar', function(ctx) {
      ctx.response.body = {
        foobar: ctx.foo + 'bar'
      };
      ctx.response.status = 201;
    });

    router.use('/foo', subrouter.routes());
    app.use(router.routes());

    client
      .get('/foo/bar')
      .then(res => {
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          foobar: 'foobar'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
    client
      .get('/foo/bar/')
      .then(res => {
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          foobar: 'foobar'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('设置 prefix 选项', done => {
    router = new Router({ prefix: '/things/:thing_id' });
    router.get('/list', function(ctx) {
      ctx.response.body = ctx.params;
      ctx.response.status = 200;
    });
    app.use(router.routes());

    client
      .get('/things/1/list')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          thing_id: '1'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
});

describe('[Router] 方法 - routes', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
  });

  test('返回 composed 中间件函数', done => {
    var middlewareCount = 0;
    var middlewareA = function(ctx, next) {
      middlewareCount++;
      return next();
    };
    var middlewareB = function(ctx, next) {
      middlewareCount++;
      return next();
    };

    router.use(middlewareA, middlewareB);
    router.get('/users/:id', function(ctx) {
      expect(ctx.params.id).toBe('1');
      ctx.response.body = { hello: 'world' };
      ctx.response.status = 200;
    });
    var routerMiddleware = router.routes();
    expect(routerMiddleware).toBeInstanceOf(Function);

    app.use(routerMiddleware);

    client
      .get('/users/1')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          hello: 'world'
        });
        expect(middlewareCount).toBe(2);
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('当路径匹配时，在 ctx 对象上存在 `_matchedRoute` 属性', done => {
    var middleware = function(ctx, next) {
      expect(ctx._matchedRoute).toBe('/users/:id');
      return next();
    };

    router.use(middleware);
    router.get('/users/:id', function(ctx, next) {
      expect(ctx._matchedRoute).toBe('/users/:id');
      expect(ctx.params.id).toBe('1');
      ctx.response.body = { hello: 'world' };
      ctx.response.status = 200;
    });

    var routerMiddleware = router.routes();
    app.use(routerMiddleware);

    client
      .get('/users/1')
      .then(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          hello: 'world'
        });
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
  test('当路径匹配时，如果是 named 路由，在 ctx 对象上存在 `_matchedRouteName` 属性', done => {
    var middleware = function(ctx, next) {
      expect(ctx._matchedRoute).toBe('/users/:id');
      return next();
    };

    router.use(middleware);
    router.get('users#show', '/users/:id', function(ctx, next) {
      expect(ctx._matchedRouteName).toBe('users#show');
      expect(ctx.params.id).toBe('1');

      ctx.response.status = 200;
    });
    app.use(router.routes());

    client
      .get('/users/1')
      .then(res => {
        expect(res.status).toBe(200);

        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
  test('如果不是 named 路由，在 ctx 对象上不存在 `_matchedRouteName` 属性', done => {
    var middleware = function(ctx, next) {
      expect(ctx._matchedRoute).toBe('/users/:id');
      return next();
    };

    router.use(middleware);
    router.get('/users/:id', function(ctx, next) {
      expect(ctx._matchedRouteName).toBeUndefined();
      expect(ctx.params.id).toBe('1');
      ctx.response.status = 200;
    });
    app.use(router.routes());

    client
      .get('/users/1')
      .then(res => {
        expect(res.status).toBe(200);

        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
});

describe('[Router] 方法 - prefix', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
  });
  it('将更新 opts.prefix', function() {
    expect(router.opts).not.toHaveProperty('prefix');
    router.prefix('/things/:thing_id');
    expect(router.opts.prefix).toBe('/things/:thing_id');
  });

  it('将更新已存在的路由的 prefix', function() {
    router.get('/users/:id', function(ctx) {
      ctx.body = 'test';
    });
    router.prefix('/things/:thing_id');
    var route = router.stack[0];
    expect(route.path).toBe('/things/:thing_id/users/:id');
    expect(route.paramNames.length).toBe(2);
    expect(route.paramNames[0]).toHaveProperty('name', 'thing_id');
    expect(route.paramNames[1]).toHaveProperty('name', 'id');
  });

  it('路由匹配时，并不会生成 params.0 属性', function(done) {
    router.use(function(ctx, next) {
      return next();
    });

    router.get('/foo/:id', function(ctx) {
      ctx.response.body = ctx.params;
    });
    router.prefix('/things');
    app.use(router.routes());

    client
      .get('/things/foo/108')
      .then(res => {
        expect(res.body).toHaveProperty('id', '108');
        expect(res.body).not.toHaveProperty('0');
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  describe(
    'prefix 末尾有没有 `/` 行为应该是一致的 [ref - trailing slash prefix]',
    testPrefix('/admin/')
  );
  describe('prefix 末尾没有 `/` 的情况', testPrefix('/admin'));
});

function testPrefix(prefix) {
  return function() {
    let app, router, client;
    let middlewareCount;

    beforeEach(() => {
      app = new Ette();
      router = new Router();
      client = app.client;
      middlewareCount = 0;
      //   这个算中间件
      router.use(function(ctx, next) {
        middlewareCount++;
        ctx.thing = 'worked';
        ctx.response.body = { name: 'working' };
        ctx.response.status = 201;
        return next();
      });

      router.get('/', function(ctx) {
        middlewareCount++;
        ctx.response.body = { name: ctx.thing };
        ctx.response.status = 202;
      });

      router.prefix(prefix);
      app.use(router.routes());
    });

    test('当 request 路径末尾存在 `/` 符号，匹配两条路由规则', function(done) {
      client
        .get('/admin/')
        .then(res => {
          expect(middlewareCount).toBe(2);
          expect(res.status).toBe(202);
          expect(res.body).toEqual({
            name: 'worked'
          });
          done();
        })
        .catch(err => {
          console.log(err);
          done();
        });
    });
    test('当 request 路径末尾不存在 `/` 符号，匹配 0 条路由规则', function(done) {
      client
        .get('/admin')
        .then(res => {
          expect(middlewareCount).toBe(0);
          expect(res.status).toBe(404);
          done();
        })
        .catch(err => {
          console.log(err);
          done();
        });
    });
  };
}

describe('[Router] 静态方法 - url', function() {
  it('生成路由 URL', function() {
    var url = Router.url('/:category/:title', {
      category: 'programming',
      title: 'how-to-node'
    });
    expect(url).toEqual('/programming/how-to-node');
  });

  it('使用 encodeURIComponent() 转义', function() {
    var url = Router.url('/:category/:title', {
      category: 'programming',
      title: 'how to node'
    });
    expect(url).toEqual('/programming/how%20to%20node');
  });

  it('根据 params 和 query 生成 URL', function() {
    var url = Router.url('/books/:category/:id', 'programming', 4, {
      query: { page: 3, limit: 10 }
    });
    expect(url).toEqual('/books/programming/4?page=3&limit=10');
    var url = Router.url(
      '/books/:category/:id',
      { category: 'programming', id: 4 },
      { query: { page: 3, limit: 10 } }
    );
    expect(url).toEqual('/books/programming/4?page=3&limit=10');
    var url = Router.url(
      '/books/:category/:id',
      { category: 'programming', id: 4 },
      { query: 'page=3&limit=10' }
    );
    expect(url).toEqual('/books/programming/4?page=3&limit=10');
  });

  it('在无 params 而有 query 的情况下也可以生成 url', function() {
    var url = Router.url('/category', {
      query: { page: 3, limit: 10 }
    });
    expect(url).toEqual('/category?page=3&limit=10');
  });
});
