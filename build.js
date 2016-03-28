var fs = require('fs');

function loadStdlibForJavaScript() {
  return {
    assert: function(truth) {
      if (!truth) {
        throw new Error('Assertion failed');
      }
    },

    String_new: function(value) {
      return value;
    },

    String_length: function(self) {
      return self.length;
    },

    String_get: function(self, index) {
      return self.charCodeAt(index);
    },

    String_append: function(self, other) {
      return self + other;
    },

    String_appendNew: function(self, other) {
      return self + other;
    },

    String_slice: function(self, start, end) {
      return self.slice(start, end);
    },

    String_equal: function(self, other) {
      return self === other;
    },

    String_equalNew: function(self, other) {
      return self === other;
    },

    String_toStringSigned: function(value) {
      return (value | 0).toString();
    },

    String_toStringUnsigned: function(value) {
      return (value >>> 0).toString();
    },

    String_quote: function(self) {
      return JSON.stringify(self);
    },

    Uint8Array_new: function(length) {
      return new Uint8Array(length);
    },
  };
}

var CompileTarget = {
  JAVASCRIPT: 1,
  WEBASSEMBLY: 2,
};

function compileAndRunJavaScript(code, sources, target) {
  var before = Date.now();
  var stdlib = loadStdlibForJavaScript();
  var exports = {};
  new Function('globals', 'exports', code)(stdlib, exports);
  var compiler = exports.Compiler_new(target);
  sources.forEach(function(source) {
    if (/\.js\./.test(source.name) && target !== CompileTarget.JAVASCRIPT ||
        /\.wasm\./.test(source.name) && target !== CompileTarget.WEBASSEMBLY) {
      return;
    }
    exports.Compiler_addInput(compiler, source.name, source.contents);
  });
  exports.Compiler_finish(compiler);
  var wasm = exports.Compiler_wasm(compiler);
  var after = Date.now();
  console.log('compile to', target === CompileTarget.JAVASCRIPT ? 'JavaScript' : 'WebAssembly', 'took ' + (after - before) + 'ms');
  return {
    wasm: wasm ? wasm._data.subarray(0, wasm._length) : null,
    log: exports.Compiler_log(compiler),
    js: exports.Compiler_js(compiler),
  };
}

// Always build all targets to catch errors in other targets
function compile(compiler, sources) {
  var compilerJS = compileAndRunJavaScript(compiler, sources, CompileTarget.JAVASCRIPT);
  if (compilerJS.log) {
    process.stdout.write(compilerJS.log);
    process.exit(1);
  }

  var compilerWASM = compileAndRunJavaScript(compiler, sources, CompileTarget.WEBASSEMBLY);
  if (compilerWASM.log) {
    process.stdout.write(compilerWASM.log);
    process.exit(1);
  }

  return {
    wasm: compilerWASM.wasm,
    js: compilerJS.js,
  };
}

var sourceDir = __dirname + '/src';
var sources = [];

fs.readdirSync(sourceDir).forEach(function(entry) {
  if (/\.thin$/.test(entry)) {
    sources.push({
      name: entry,
      contents: fs.readFileSync(sourceDir + '/' + entry, 'utf8'),
    });
  }
});

var compiler = fs.readFileSync(__dirname + '/www/compiled.js', 'utf8');

console.log('compiling...');
var compiler = compile(compiler, sources);

console.log('compiling again...');
var compiler = compile(compiler.js, sources);

console.log('compiling again...');
var compiler = compile(compiler.js, sources);

fs.writeFileSync(__dirname + '/www/compiled.wasm', Buffer(compiler.wasm));
console.log('wrote to "www/compiled.wasm"');

fs.writeFileSync(__dirname + '/www/compiled.js', compiler.js);
console.log('wrote to "www/compiled.js"');
