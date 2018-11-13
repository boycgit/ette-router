import Router from '../src/index';
import Ette from 'ette';

describe('[Router] subscribe 路由 - 路由规则', () => {
  let app, router, client;

  beforeEach(() => {
    app = new Ette();
    router = new Router();
    client = app.client;
  });

  test('支持根据 ctx.routerPath 自定义路由规则 [ref - custom routerPath]', done => {
    let count = 0;
    app.use(function(ctx, next) {
      // bind /users => example/users
      ctx.routerPath = `/example${ctx.request.path}`;
      count++;
      return next();
    });
    router.subscribe('/example/users', function(ctx, next) {
      ctx.response.body = ctx.request.method + ' ' + ctx.request.path;
      ctx.response.status = 202;
      count++;
      return next();
    });

    app.use(router.routes());

    app.subscribe('/users', {
      onMessage: () => {
        count++;
      }
    });

    const sender = (client as any).subscribe('/users');

    sender.send('good job');

    setTimeout(() => {
      expect(count).toBe(3);
      done();
    }, 0);
  });

  test('当匹配到路由规则时，才会运行其对应的中间件', done => {
    let count = 0;

    var otherRouter = new Router();

    // 不会匹配到该路由
    router.use(function(ctx, next) {
      ctx.response.body = { bar: 'baz' };
      count++;
      return next();
    });

    // 将会匹配到该路由
    (otherRouter as any).subscribe('/bar', function(ctx, next) {
      ctx.response.status = 202;
      ctx.response.body = { foo: 'bar' };
      count++;
      return next();
    });

    app.use(router.routes()).use(otherRouter.routes());

    app.subscribe('/bar', {
      onMessage: () => {
        count++;
      }
    });

    const sender = (client as any).subscribe('/bar');

    sender
      .send('good job')
      .then(res => {
        expect(res.status).toBe(202);
        expect(res.body).toEqual({
          foo: 'bar'
        });

        expect(count).toBe(2);
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });
  test('当匹配不到路由规则时，不会执行对应的中间件逻辑', done => {
    let count = 0;

    var otherRouter = new Router();

    // 不会匹配该路由规则
    router.use(function(ctx, next) {
      ctx.response.body = { bar: 'baz' };
      count++;
      return next();
    });

    // 这里 `get` 规则，匹配不到
    (otherRouter as any).get('/bar', function(ctx, next) {
      ctx.response.status = 202;
      ctx.response.body = { foo: 'bar' };
      count++;
      return next();
    });

    app.use(router.routes()).use(otherRouter.routes());

    app.subscribe('/bar', {
      onMessage: () => {
        count++;
      }
    });

    const sender = (client as any).subscribe('/bar');

    sender
      .send('good job')
      .then(res => {
        expect(res.status).toBe(404);
        expect(res.body).toEqual({});
        expect(count).toBe(1);
        done();
      })
      .catch(err => {
        console.log(err);
        done();
      });
  });

  test('如果不调用 next 方法，将不会调用后续路由', done => {
      let count = 0;

    router.subscribe(
      'user_page',
      '/bar',
      function(ctx, next) {
        //   return next();
        // no next()
      },
      function(ctx) {
        ctx.response.body = { order: 1 };
      }
    );

      app.use(router.routes());

    //   不会被调用，因为之前的路由没有调用 next 方法 
    app.subscribe('/bar', {
      onMessage: () => {
        count++;
      }
    });

    const sender = (client as any).subscribe('/bar');
      sender
          .send('good job')
          .then(res => {
              expect(res.status).toBe(404);
              expect(res.body).toEqual({});
              expect(count).toBe(0);
              done();
          })
          .catch(err => {
              console.log(err);
              done();
          });
  });
});
