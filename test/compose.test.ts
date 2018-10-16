// come from https://github.com/koajs/compose/blob/master/test/test.js

import compose, { middlewareFunction } from '../src/compose';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms || 1));
}

describe('koa compose', () => {
  test('正常组合 - 3 个异步方法为中间件', async () => {
    const arr: number[] = [];
    const stack: middlewareFunction[] = [];

    stack.push(async (context, next: middlewareFunction) => {
      arr.push(1);
      await wait(1);
      await next();
      await wait(1);
      arr.push(6);
    });

    stack.push(async (context, next: middlewareFunction) => {
      arr.push(2);
      await wait(1);
      await next();
      await wait(1);
      arr.push(5);
    });

    stack.push(async (context, next: middlewareFunction) => {
      arr.push(3);
      await wait(1);
      await next();
      await wait(1);
      arr.push(4);
    });

    await compose(stack)({});
    expect(arr).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('中间件组合可以多次调用', () => {
    var stack: middlewareFunction[] = [];

    interface Context {
      arr: number[];
    }

    stack.push(async (context: Context, next: middlewareFunction) => {
      context.arr.push(1);
      await wait(1);
      await next();
      await wait(1);
      context.arr.push(6);
    });

    stack.push(async (context: Context, next: middlewareFunction) => {
      context.arr.push(2);
      await wait(1);
      await next();
      await wait(1);
      context.arr.push(5);
    });

    stack.push(async (context: Context, next: middlewareFunction) => {
      context.arr.push(3);
      await wait(1);
      await next();
      await wait(1);
      context.arr.push(4);
    });

    const fn = compose(stack);
    const ctx1 = { arr: [] };
    const ctx2 = { arr: [] };
    const out = [1, 2, 3, 4, 5, 6];

    return fn(ctx1)
      .then(() => {
        expect(out).toEqual(ctx1.arr);
        return fn(ctx2);
      })
      .then(() => {
        expect(out).toEqual(ctx2.arr);
      });
  });

  it('也支持 0 个中间件的情况', function() {
    return compose([])({});
  });

  it('函数末尾的逻辑也能正常执行', async () => {
    var stack: middlewareFunction[] = [];
    var called = false;

    stack.push(async (ctx, next: middlewareFunction) => {
      await next();
      called = true;
    });

    await compose(stack)({});
    expect(called).toBeTruthy();
  });

  it('中间件中抛出的错误可以被捕获', () => {
    var stack: middlewareFunction[] = [];

    stack.push(() => {
      throw new Error();
    });

    return compose(stack)({})
      .then(function() {
        throw new Error('promise was not rejected');
      })
      .catch(function(e) {
        expect(e).toBeInstanceOf(Error);
      });
  });

  it('执行末尾是 yield* 函数的情况下也能正常执行', () => {
    var stack: middlewareFunction[] = [];

    stack.push(async (ctx, next: middlewareFunction) => {
      await next;
    });

    return compose(stack)({});
  });

  it('执行期间，上下文变量 ctx 是引用类型', () => {
    const ctx = {};

    const stack: middlewareFunction[] = [];

    stack.push(async (ctx2: object, next: middlewareFunction) => {
      await next();
      expect(ctx2).toEqual(ctx);
    });

    stack.push(async (ctx2: object, next: middlewareFunction) => {
      await next();
      expect(ctx2).toEqual(ctx);
    });

    stack.push(async (ctx2: object, next: middlewareFunction) => {
      await next();
      expect(ctx2).toEqual(ctx);
    });

    return compose(stack)(ctx);
  });

  it('在执行期间，可以进行容错操作', async () => {
    const arr: number[] = [];
    const stack: middlewareFunction[] = [];

    stack.push(async (ctx, next: middlewareFunction) => {
      arr.push(1);
      try {
        arr.push(6);
        await next();
        arr.push(7);
      } catch (err) {
        arr.push(2);
      }
      arr.push(3);
    });

    stack.push(async (ctx, next: middlewareFunction) => {
      arr.push(4);
      throw new Error();
    });

    await compose(stack)({});
    expect(arr).toEqual([1, 6, 4, 2, 3]);
  });

  it('compose 操作返回的是 Promsie', () => {
    let called = false;

    return compose([])({}, async () => {
      called = true;
    }).then(function() {
      expect(called).toBeTruthy();
    });
  });

  it('compose 操作可以嵌套，因为 compose 返回的入参签名也是 (ctx, next)', () => {
    var called: number[] = [];

    return compose([
      compose([
        (ctx, next: middlewareFunction) => {
          called.push(1);
          return next();
        },
        (ctx, next: middlewareFunction) => {
          called.push(2);
          return next();
        }
      ]),
      (ctx, next: middlewareFunction) => {
        called.push(3);
        return next();
      }
    ])({}).then(() => {
      expect(called).toEqual([1, 2, 3]);
    });
  });

  it('如果多次调用 next() 将抛出错误', () => {
    return compose([
      async (ctx, next: middlewareFunction) => {
        await next();
        await next();
      }
    ])({}).then(
      () => {
        throw new Error('boom');
      },
      err => {
        expect(err.message).toMatch(/multiple times/);
      }
    );
  });
  it('最终返回的 return 值是最后 return 的数值（这个用例值得好好看）', () => {
    const stack: middlewareFunction[] = [];

    stack.push(async (context, next: middlewareFunction) => {
      var val = await next();
      expect(val).toEqual(2);
      return 1;
    });

    stack.push(async (context, next: middlewareFunction) => {
      const val = await next();
      expect(val).toEqual(0);
      return 2;
    });

    const next: middlewareFunction = async () => 0;
    return compose(stack)({}, next).then(function(val) {
      expect(val).toEqual(1);
    });
  });

  it('不影响原始的中间件数组', () => {
    const middleware: middlewareFunction[] = [];
    const fn1 = (ctx, next: middlewareFunction) => {
      return next();
    };
    middleware.push(fn1);

    for (const fn of middleware) {
      expect(fn).toEqual(fn1);
    }

    compose(middleware);

    for (const fn of middleware) {
      expect(fn).toEqual(fn1);
    }
  });

  it('不会被困在 next 函数中', () => {
    interface Context {
      middleware: number;
      next: number;
    }
    const middleware = [
      (ctx: Context, next: middlewareFunction) => {
        ctx.middleware++;
        return next();
      }
    ];
    const ctx: Context = {
      middleware: 0,
      next: 0
    };

    return compose(middleware)(
      ctx,
      (ctx: Context, next: middlewareFunction) => {
        ctx.next++;
        return next();
      }
    ).then(() => {
      expect(ctx).toEqual({ middleware: 1, next: 1 });
    });
  });
});
