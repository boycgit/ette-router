// const rollup = require('rollup');
const fs = require('fs-extra');
const path = require('path');
const ts = require('typescript');
// const exec = require('child_process').execSync;

// make sure we're in the right folder
process.chdir(path.resolve(__dirname, '..'));

// const binFolder = path.resolve('node_modules/.bin/');
const targetName = 'index';

fs.removeSync('dist');
fs.removeSync('.build.cjs');
fs.removeSync('.build.es');

function runTypeScriptBuild(outDir, target, { declarations }) {
  console.log(
    `Running typescript build (target: ${
    ts.ScriptTarget[target]
    }) in ${outDir}/`
  );

  const tsConfig = path.resolve('tsconfig.json');
  const json = ts.parseConfigFileTextToJson(
    tsConfig,
    ts.sys.readFile(tsConfig),
    true
  );

  const { options } = ts.parseJsonConfigFileContent(
    json.config,
    ts.sys,
    path.dirname(tsConfig)
  );

  options.target = target;
  options.outDir = outDir;
  options.declaration = declarations;

  options.module = ts.ModuleKind.ES2015; // 将代码转换成 ES6 的格式
  options.moduleResolution = ts.ModuleResolutionKind.NodeJs;
  options.importHelpers = true;
  options.noEmitHelpers = true;
  if (declarations) options.declarationDir = path.resolve('.', 'dist');

  const rootFile = path.resolve('src', `${targetName}.ts`);
  const host = ts.createCompilerHost(options, true);
  const prog = ts.createProgram([rootFile], options, host);
  const result = prog.emit();
  if (result.emitSkipped) {
    const message = result.diagnostics
      .map(
        d =>
          `${ts.DiagnosticCategory[d.category]} ${d.code} (${d.file}:${
          d.start
          }): ${d.messageText}`
      )
      .join('\n');

    throw new Error(`Failed to compile typescript:\n\n${message}`);
  }
}

function build() {
  runTypeScriptBuild('.build.cjs', ts.ScriptTarget.ES5, { declarations: true }); // 只用生成一次声明就可以
  runTypeScriptBuild('.build.es', ts.ScriptTarget.ES5, { declarations: false });
}

build();