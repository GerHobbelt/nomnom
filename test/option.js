var nomnom = require("../nomnom");

var parser = nomnom()
   .autoShowUsage(false)
   .option('debug', {
      abbr: 'x',
      flag: true,
      help: 'Print debugging info'
   })
   .option('config', {
      abbr: 'c',
      default: 'config.json',
      help: 'JSON file with tests to run'
   })
   .option('version', {
      flag: true,
      help: 'print version and exit',
      callback: function() {
         return "version 1.2.4";
      }
   });


exports.testOption = function(test) {
   var opts = parser.parse(["-x", "--no-verbose", "--bugger=abc", "--toots", "--no-buggaloo", "--bongo"]);

   test.strictEqual(opts.debug, true);
   test.strictEqual(opts.version, undefined);

   // unspecified options are silently accepted and parsed as 'flag' options by default.
   test.strictEqual(opts.verbose, false);
   test.strictEqual(opts.bugger, "abc");
   test.strictEqual(opts.toots, true);
   test.strictEqual(opts.buggaloo, false);
   test.strictEqual(opts.bongo, true);

   test.equal(opts.config, "config.json");
   test.done();
};


exports.testCommandOption = function(test) {
   var parser = nomnom().autoShowUsage(false);
   parser.command('test')
     .option('fruit', {
        abbr: 'f',
        flag: true
     });

   var opts = parser.parse(["test", "-f"]);

   test.strictEqual(opts.fruit, true);
   test.done();
};


exports.testOptionValue = function(test) {
  var parser = nomnom()
    .autoShowUsage(false)
    .options({
      'debug': {
        abbr: 'x',
        flag: true,
        help: 'Print debugging info'
      },
      'config': {
        abbr: 'c',
        default: 'config.json',
        help: 'JSON file with tests to run'
      },
      'req': {
        abbr: 'r',
        default: 'required.json',
        required: true,
        help: 'this option requires a value'
      },
      'opt': {
        abbr: 'o',
        optional: true,
        default: 'optional.json',
        help: 'this option accepts an OPTIONAL value'
      },
      'fruit': {
        abbr: 'f',
        flag: true,
        help: 'fruit flag'
      }
    });

   var opts = parser.parse("-x --config cfg --req xxx --opt --fruit".split(" "));

   test.strictEqual(opts.debug, true);
   test.strictEqual(opts.config, 'cfg');
   test.strictEqual(opts.req, 'xxx');
   test.strictEqual(opts.opt, 'optional.json');
   test.strictEqual(opts.fruit, true);


   var opts = parser.parse("--opt kwaak --fruit".split(" "));

   test.strictEqual(opts.debug, undefined);
   test.strictEqual(opts.config, 'config.json');
   test.strictEqual(opts.req, 'required.json');
   test.strictEqual(opts.opt, 'kwaak');
   test.strictEqual(opts.fruit, true);


   var opts = parser.parse("--opt -f-".split(" "));

   test.strictEqual(opts.debug, undefined);
   test.strictEqual(opts.config, 'config.json');
   test.strictEqual(opts.req, 'required.json');
   test.strictEqual(opts.opt, 'optional.json');
   test.strictEqual(opts.fruit, false);


   var opts = parser.parse("--opt=boo -f-".split(" "));

   test.strictEqual(opts.debug, undefined);
   test.strictEqual(opts.config, 'config.json');
   test.strictEqual(opts.req, 'required.json');
   test.strictEqual(opts.opt, 'boo');
   test.strictEqual(opts.fruit, false);


   var opts = parser.parse("--opt+ -f-".split(" "));

   test.strictEqual(opts.debug, undefined);
   test.strictEqual(opts.config, 'config.json');
   test.strictEqual(opts.req, 'required.json');
   test.strictEqual(opts.opt, true);
   test.strictEqual(opts.fruit, false);


   var opts = parser.parse("--opt- -f+".split(" "));

   test.strictEqual(opts.debug, undefined);
   test.strictEqual(opts.config, 'config.json');
   test.strictEqual(opts.req, 'required.json');
   test.strictEqual(opts.opt, false);
   test.strictEqual(opts.fruit, true);
   test.done();
};


exports.testUnspecifiedOption = function(test) {
  var parser = nomnom()
    .autoShowUsage(false);

   var opts = parser.parse("-x --config cfg --req xxx --opt --fruit".split(" "));

   test.strictEqual(opts.x, true);
   test.strictEqual(opts.config, 'cfg');
   test.strictEqual(opts.req, 'xxx');
   test.strictEqual(opts.opt, true);
   test.strictEqual(opts.fruit, true);


   var opts = parser.parse("--opt kwaak --fruit".split(" "));

   test.strictEqual(opts.opt, 'kwaak');
   test.strictEqual(opts.fruit, true);


   var opts = parser.parse("--opt -f-".split(" "));

   test.strictEqual(opts.opt, true);
   test.strictEqual(opts.f, false);


   var opts = parser.parse("--opt=boo -f-".split(" "));

   test.strictEqual(opts.opt, 'boo');
   test.strictEqual(opts.f, false);


   var opts = parser.parse("--opt+ -f-".split(" "));

   test.strictEqual(opts.opt, true);
   test.strictEqual(opts.f, false);


   var opts = parser.parse("--opt- -f+".split(" "));

   test.strictEqual(opts.opt, false);
   test.strictEqual(opts.f, true);


   var opts = parser.parse("-o abcd -f+".split(" "));

   test.strictEqual(opts.o, 'abcd');
   test.strictEqual(opts.f, true);


   var opts = parser.parse("-o=def -f 5".split(" "));

   test.strictEqual(opts.o, 'def');
   test.strictEqual(opts.f, 5);
   test.done();
};


