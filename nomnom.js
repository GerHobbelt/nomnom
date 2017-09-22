var _ = require("underscore"),
    chalk = require("chalk"),
    linewrap = require("@gerhobbelt/linewrap"),
    exit = require("exit");


var retArgs = function (s) {
  return s;
};

var noColorConfig = {
  usageHeadingColor: retArgs,
  usageStringColor: retArgs,
  positionalHelpColor: retArgs,
  optionsHeaderColor: retArgs,
  helpColor: retArgs,
  requiredArgColor: retArgs
};

var isWin = /^win/.test(process.platform);


var defaultColorConfig = _.extend({}, noColorConfig, {
  usageHeadingColor: chalk.bold,
  usageStringColor: chalk /* .stripColor */,
  positionalHelpColor: chalk.grey,
  optionsHeaderColor: isWin ? chalk.cyan : chalk.blue,
  helpColor: chalk /* .stripColor */,
  requiredArgColor: chalk.red
});


function ArgParser() {
  this.commands = {};   // expected commands
  this.specs = {};      // option specifications
}

ArgParser.prototype = {
  /* Add a command to the expected commands */
  command: function (name) {
    var command;
    if (name) {
      command = this.commands[name] = {
        name: name,
        specs: {}
      };
    }
    else {
      command = this.fallback = {
        specs: {}
      };
    }

    // facilitates command('name').options().cb().help()
    var chain = {
      options: function (specs) {
        command.specs = specs;
        return chain;
      },
      opts: function (specs) {
        // old API
        return this.options(specs);
      },
      option: function (name, spec) {
        command.specs[name] = spec;
        return chain;
      },
      callback: function (cb) {
        command.cb = cb;
        return chain;
      },
      help: function (help) {
        command.help = help;
        return chain;
      },
      usage: function (usage) {
        command._usage = usage;
        return chain;
      }
    };
    return chain;
  },

  nocommand: function () {
    return this.command();
  },

  options: function (specs) {
    this.specs = specs;
    return this;
  },

  opts: function (specs) {
    // old API
    return this.options(specs);
  },

  globalOpts: function (specs) {
    // old API
    return this.options(specs);
  },

  option: function (name, spec) {
    this.specs[name] = spec;
    return this;
  },

  _unknownOptionTreatment: true,

  unknownOptionTreatment: function (enable) {
    if (typeof enable === "function") {
      this._unknownOptionTreatment = enable;
    }
    else if (enable) {
      this._unknownOptionTreatment = function __treatUnknownOption__(options, name, value) {
        return {
          name: name,
          value: value
        };
      };
    }
    else {
      this._unknownOptionTreatment = function __treatUnknownOption__(options, name, value) {
        this.print("ERROR: unknown option '" + name + "' specified.", 1);
      };
    }
    return this;
  },

  _autoShowUsage: true,

  autoShowUsage: function (enable) {
    this._autoShowUsage = (arguments.length === 0 || !!enable);
    return this;
  },

  _errorUsageMode: 'minimal',

  errorUsageMode: function (mode) {
    switch (mode) {
    default:
        this._errorUsageMode = 'full';
        return this;

    case 'full':
    case 'none':
    case 'minimal':
        this._errorUsageMode = mode;
        return this;
    }
  },

  _usage: null,

  usage: function (usage) {
    this._usage = usage;
    return this;
  },

  print: null,

  printer: function (print) {
    this.print = print;
    return this;
  },

  _script: null,

  script: function (script) {
    this._script = script;
    return this;
  },

  scriptName: function (script) {
    // old API
    return this.script(script);
  },

  _help: null,

  help: function (help) {
    this._help = help;
    return this;
  },

  _extendHelp: null,

  extendHelp: function (help) {
    this._extendHelp = help;
    return this;
  },

  _produceExplicitOptionsOnly: false,

  produceExplicitOptionsOnly: function (enable) {
    this._produceExplicitOptionsOnly = !!enable;
    return this;
  },

  colors: function () {
    // deprecated - colors are on by default now
    return this;
  },

  _colorConfig: _.extend({}, defaultColorConfig),

  setColors: function (colorConfig) {
    this._colorConfig = _.extend({}, defaultColorConfig, colorConfig);
    return this;
  },

  nocolors: function () {
    this._colorConfig = _.extend({}, noColorConfig);
    return this;
  },

  parseArgs: function (argv) {
    // old API
    return this.parse(argv);
  },

  nom: function (argv) {
    return this.parse(argv);
  },

  parse: function (argv) {
    var that = this;
    this.print = this.print || function (str, code) {
        if (code > 0) {
          console.error(str);
          exit(code);
        }
        else {
          console.log(str);
          exit(0);
        }
      };
    this._help = this._help || "";
    this._script = this._script || process.argv[0] + " " 
        + require("path").basename(process.argv[1]);
    this.specs = this.specs || {};
    this.unknownOptionTreatment(this._unknownOptionTreatment);

    argv = argv || process.argv.slice(2);

    // Automatically print the help when no argument has been provided at all:
    if (this._autoShowUsage && argv.length === 0) {
      argv[0] = "-h";
    }

    var notFlags = [];
    var doubleDashIndex = argv.indexOf("--");
    if (doubleDashIndex > -1) {
      notFlags = argv.slice(doubleDashIndex + 1);
      argv = argv.slice(0, doubleDashIndex);
    }

    var arg = Arg(argv[0]).isValue && argv[0],
        command = arg && this.commands[arg],
        commandExpected = !_(this.commands).isEmpty();

    if (commandExpected) {
      if (command) {
        _(this.specs).extend(command.specs);
        this._script += " " + command.name;
        if (command.help) {
          this._help = command.help;
        }
        this.command = command;
      }
      else if (arg) {
        return this.print(this._script + ": no such command '" + arg + "'", 1);
      }
      else {
        // no command but command expected e.g. 'git -v'
        var helpStringBuilder = {
          list: function () {
            return "one of: " + _(this.commands).keys().join(", ");
          },
          twoColumn: function () {
            // find the longest command name to ensure horizontal alignment
            var maxLength = _(this.commands).max(function (cmd) {
              return cmd.name.length;
            }).name.length;

            var cmdHelp;
            if (maxLength <= 12) {
              // create the two column text strings
              cmdHelp = _.map(this.commands, function (cmd, name) {
                var diff = maxLength - name.length;
                var pad = new Array(diff + 4).join(" ");
                return "  " + [name, pad, cmd.help].join(" ");
              });
            }
            else {
              // create a two column output where the second column interleaves
              // the first. The second column is indented 8 spaces.
              var pad = new Array(8 + 1).join(" ");
              cmdHelp = _.map(this.commands, function (cmd, name) {
                return "  " + [name, "\n", pad, " ", cmd.help].join("");
              });
            }
            return "\n" + cmdHelp.join("\n");
          }
        };

        // if there are a small number of commands and all have help strings,
        // display them in a two column table; otherwise use the brief version.
        // The arbitrary choice of "20" comes from the number commands git
        // displays as "common commands"
        var helpType = "list";
        if (_(this.commands).size() <= 20) {
          if (
            _(this.commands).every(function (cmd) {
              return cmd.help;
            })
          ) {
            helpType = "twoColumn";
          }
        }

        this.specs.command = {
          position: 0,
          help: helpStringBuilder[helpType].call(this)
        };

        if (this.fallback) {
          _(this.specs).extend(this.fallback.specs);
          this._help = this.fallback.help;
        }
        else {
          this.specs.command.required = true;
        }
      }
    }

    if (this.specs.length === undefined) {
      // specs is a hash not an array
      this.specs = _(this.specs).map(function (opt, name) {
        opt.name = name;
        return opt;
      });
    }
    this.specs = this.specs.map(function (opt) {
      var o = Opt(opt);
      if (o.full && /^no-/.test(o.full)) {
        that.print("ERROR: nomnom options MUST NOT start their 'full option name' with 'no-', such as '" + o.full + "'", 1);
      }
      return o;
    });

    if (argv.indexOf("--help") >= 0 || argv.indexOf("-h") >= 0) {
      return this.print(this.getUsage());
    }

    var options = {};

    var args = argv.map(function (arg) {
      return Arg(arg);
    });

    /* -- cmd --flags */
    if (notFlags.length) {
      this.setOption(options, "--", notFlags);
      args = args.concat(
        notFlags.map(function (d) {
          return {
            str: d,
            value: d,
            isValue: true
          };
        })
      );
    }

    args = args.concat(Arg());

    var positionals = [];

    /* parse the args */
    args.reduce(function (arg, val) {
      var opt;

      /* positional */
      if (arg.isValue) {
        if (
          arg.str in that.commands &&
          commandExpected &&
          !command &&
          !that.fallback
        ) {
          that.print("commands can not be interspersed with arguments" + that.getUsageOnError(), 1);
        }
        else {
          positionals.push(arg.value);
        }
      }
      else if (arg.chars) {
        var last;
        var flagValue;

        /* -cfv / ...; always check each of the abbreviated options, if there's one or many: */
        for (var i = 0, last = arg.chars.length - 1; i <= last; i++) {
          var c = arg.chars[i];

          if (i === last) {
            flagValue = arg.value;
          }
          else {
            flagValue = true;
          }

          /* -k */
          if (i === last) {
            if (flagValue === true) {
              /* -k value */
              opt = that.opt(c);
              if (!opt.flag) {
                if (val.isValue && !arg.isFlag) {
                  that.setOption(options, c, val.value);
                  return Arg(); // skip next turn - swallow arg
                }
                else if (arg.isFlag) {
                  // explicit flag treatment of a non-flag option: produce a boolean value anyway.
                  // (this way you can have options which behave as both flag and value option simultaneously)
                  that.setOption(options, c, flagValue);
                }
                else if (opt.__nomnom_dummy__) {
                  // unspecified options which have no value are considered to be *flag* options:
                  that.setOption(options, c, true);
                }
                else if (opt.optional) {
                  that.setOption(options, c, opt.default);
                }
                else {
                  that.print("'-" + (opt.abbr || opt.name || c) + "'" 
                      + " expects a value." + that.getUsageOnError(), 1);
                }
              }
              else {
                /* --flag / --no-flag */
                that.setOption(options, c, flagValue);
              }
            }
            else {
              that.setOption(options, c, arg.value === undefined ? true : arg.value);
            }
          }
          else {
            that.setOption(options, c, flagValue);
          }
        }
      }
      else if (arg.full) {
        var value = arg.value;

        /* --key */
        if (value === true) {
          /* --key value */
          opt = that.opt(arg.full);
          if (!opt.flag) {
            if (val.isValue && !arg.isFlag) {
              that.setOption(options, arg.full, val.value);
              return Arg(); // skip next turn - swallow arg
            }
            else if (arg.isFlag) {
              // explicit flag treatment of a non-flag option: produce a boolean value anyway.
              // (this way you can have options which behave as both flag and value option simultaneously)
              that.setOption(options, arg.full, arg.value);
            }
            else if (opt.__nomnom_dummy__) {
              // unspecified options which have no value are considered to be *flag* options:
              that.setOption(options, arg.full, true);
            }
            else if (opt.optional) {
              that.setOption(options, arg.full, opt.default);
            }
            else {
              that.print("'--" + (opt.full || opt.name || arg.full) + "'" 
                  + " expects a value." + that.getUsageOnError(), 1);
            }
          }
          else {
            /* --flag / --no-flag */
            that.setOption(options, arg.full, value);
          }
        }
        else {
          that.setOption(options, arg.full, value);
        }
      }
      return val;
    });

    positionals.forEach(function (pos, index) {
      this.setOption(options, index, pos);
    }, this);

    options._ = positionals;

    if (!this._produceExplicitOptionsOnly) {
      this.specs.forEach(function (opt) {
        if (opt.default !== undefined && options[opt.name] === undefined) {
          options[opt.name] = opt.default;
        }
      }, this);
    }

    // exit if required arg isn't present
    this.specs.forEach(function (opt) {
      if (opt.required && options[opt.name] === undefined) {
        if (opt.default !== undefined) {
          options[opt.name] = opt.default;
        }
        else {
          var msg = opt.name + " argument is required.";
          msg = this._colorConfig.requiredArgColor(msg);
          //msg = this._nocolors ? msg : chalk.red(msg);

          this.print("\n" + msg + this.getUsageOnError(), 1);
        }
      }
    }, this);

    if (command && command.cb) {
      command.cb(options);
    }
    else if (this.fallback && this.fallback.cb) {
      this.fallback.cb(options);
    }

    return options;
  },

  getUsageOnError: function () {
    switch (this._errorUsageMode) {
    default:                // full
      return '\n\n' + this.getUsage();

    case 'none':
      return '';

    case 'minimal':
      return '\n\nRun with option "--help" to get extended command line usage info.';
    }
  },

  getUsage: function () {
    if (this.command && this.command._usage) {
      return this.command._usage;
    }
    else if (this.fallback && this.fallback._usage) {
      return this.fallback._usage;
    }
    if (this._usage) {
      return this._usage;
    }

    // todo: use a template
    var str = "\n";

    str += this._colorConfig.usageHeadingColor("Usage:");
    str += this._colorConfig.usageStringColor(" " + this._script);

    var positionals = _(this.specs).select(function (opt) {
      return opt.position !== undefined;
    });
    positionals = _(positionals).sortBy(function (opt) {
      return opt.position;
    });
    var options = _(this.specs).select(function (opt) {
      return opt.position === undefined;
    });
    var showOptions = _(options)
      .reject(function (opt) {
        return opt.hidden;
      })
      .toString();

    // assume there are no gaps in the specified pos. args
    positionals.forEach(function (pos) {
      str += this._colorConfig.usageStringColor(" ");

      var posStr = pos.string;
      if (!posStr) {
        posStr = pos.name || "arg" + pos.position;
        if (pos.required) {
          posStr = "<" + posStr + ">";
        }
        else {
          posStr = "[" + posStr + "]";
        }
        if (pos.list) {
          posStr += "...";
        }
      }
      str += this._colorConfig.usageStringColor(posStr);
    }, this);

    if (showOptions) {
      str += this._colorConfig.optionsHeaderColor(" [options]");
    }

    if (showOptions || positionals.length) {
      str += this._colorConfig.usageStringColor("\n\n");
    }

    function spaces(length) {
      var s = "";
      for (var i = 0; i < length; i++) {
        s += " ";
      }
      return s;
    }

    var console_width = (process.stdout && process.stdout.columns) || 80;

    var longest = positionals.reduce(function (max, pos) {
      return pos.name.length > max ? pos.name.length : max;
    }, 0);

    positionals.forEach(function (pos) {
      var posStr = pos.string || pos.name;
      str += this._colorConfig.usageStringColor(posStr + (longest < 12 ? spaces(longest - posStr.length) + "     " : "\n        "));

      var wrap = linewrap((longest < 12 ? longest + 5 : 8), console_width);
      str += this._colorConfig.positionalHelpColor(wrap(pos.help || ""));
      str += this._colorConfig.usageStringColor("\n");
    }, this);
    if (positionals.length && showOptions) {
      str += this._colorConfig.usageStringColor("\n");
    }

    if (showOptions) {
      str += this._colorConfig.optionsHeaderColor("Options:");
      str += this._colorConfig.usageStringColor("\n");

      longest = options.reduce(function (max, opt) {
        return opt.string.length > max && !opt.hidden ? opt.string.length : max;
      }, 0);

      options.forEach(function (opt) {
        if (!opt.hidden) {
          str += this._colorConfig.usageStringColor("   " + opt.string + (longest < 12 ? spaces(longest - opt.string.length) + "   " : "\n"));

          var defaults = (opt.default !== undefined ? "  [" + opt.default + "]" : "");
          var help = opt.help ? opt.help + defaults : "";
          if (0) {
            // linewrap library is still buggy    :-()
            var wrap = linewrap(console_width, {
              whitespace: "line",
              respectLineBreaks: "all",
              //wrapLineIndentBase: / : /,
              //wrapLineIndent: 2,
              wrapLineIndent: longest < 12 ? longest + 3 : 8
            });
          }
          else {
            var indent = longest < 12 ? longest + 3 : 8;
            var indent_str = new Array(indent + 1).join(" ");
            var wrap_master = linewrap(console_width - indent, {
              whitespace: "line",
              respectLineBreaks: "all",
              wrapLineIndentBase: / : /,
              wrapLineIndent: 3,
              //wrapLineIndent: longest < 12 ? longest + 3 : 8,
              lineBreakScheme: "unix"
            });
            var wrap = function (text) {
              var s = wrap_master(text);
              return s
                .split("\n")
                .map(function (l) {
                  return indent_str + l;
                })
                .join("\n");
            };
          }
          str += this._colorConfig.helpColor(wrap(help));
          str += this._colorConfig.usageStringColor("\n");
        }
      }, this);
    }

    if (this._help) {
      str += this._colorConfig.usageStringColor("\n" + this._help);
    }

    if (this._extendHelp) {
      str += "\n" + this._extendHelp;
    }
    return str;
  }
};

ArgParser.prototype.opt = function (arg) {
  // get the specified opt for this parsed arg
  var match = Opt({ __nomnom_dummy__: true });
  this.specs.forEach(function (opt) {
    if (opt.matches(arg)) {
      match = opt;
    }
  });
  return match;
};

ArgParser.prototype.setOption = function (options, arg, value) {
  var option = this.opt(arg);

  if (option.__nomnom_dummy__ && typeof arg === "string" && arg !== "--") {
    // unspecified options receive special treatment:
    var opt = this._unknownOptionTreatment(options, arg, value);
    if (!opt) {
      return;
    }
    arg = opt.name;
    value = opt.value;
  }

  if (option.callback) {
    var message = option.callback(value);

    if (typeof message === "string") {
      this.print(message, 1);
    }
  }

  if (option.type != "string") {
    try {
      // infer type by JSON parsing the string
      value = JSON.parse(value);
    } 
    catch (e) {}
  }

  if (option.transform) {
    value = option.transform(value);
  }

  var name = option.name || arg;
  if (option.choices && option.choices.indexOf(value) === -1) {
    this.print(name + " must be one of: " + option.choices.join(", "), 1);
  }

  if (option.list) {
    if (!options[name]) {
      options[name] = [value];
    }
    else {
      options[name].push(value);
    }
  }
  else {
    options[name] = value;
  }
};


/* an arg is an item that's actually parsed from the command line
   e.g. "-l", "-l+", "log.txt", or "--logfile=log.txt" */
var Arg = function (str) {
  var abbrRegex1 = /^-(\w+)([+\-]?)$/,                      // -v, -v-, -cfv+
      abbrRegex2 = /^-(\w+)=(.+)$/,                         // -o=value
      fullRegex1 = /^--(no-)?(\w+(?:[^=+]*?[^=+\-])?)$/,    // --no-long-flag-name-123, --long-flag-name-123
      fullRegex2 = /^--(\w+(?:[^=+]*?[^=+\-])?)([+\-])$/,   // --long-flag-name-123-, --long-flag-name-123+
      fullRegex3 = /^--(\w+(?:[^=+]*?[^=+\-])?)=(.+)$/,     // --long-flag-name-123=value
      valRegex = /^[^\-].*/;

  var charMatch1 = abbrRegex1.exec(str),
      charMatch2 = abbrRegex2.exec(str),
      chars = charMatch1 ? charMatch1[1].split("") : charMatch2 ? charMatch2[1].split("") : null;

  var fullMatch1 = fullRegex1.exec(str),
      fullMatch2 = fullRegex2.exec(str),
      fullMatch3 = fullRegex3.exec(str),
      full = fullMatch1 ? fullMatch1[2] : fullMatch2 ? fullMatch2[1] : fullMatch3 ? fullMatch3[1] : null;

  var isValue = str !== undefined && (str === "" || valRegex.test(str));
  var isFlag = undefined;
  var value;
  if (isValue) {
    value = str;
  }
  else if (full) {
    if (fullMatch1) {
      if (fullMatch1[1]) {
        // we have an explicit boolean/flag treatment of this option via `--no-[option]`, hence we set `isFlag`.
        isFlag = true;
        value = false;
      }
      else {
        // `--flag`: we may be processing a value or boolean option, hence we DO NOT set `isFlag`.
        value = true;
      }
    }
    else if (fullMatch2) {
      // we have an explicit boolean/flag treatment of this option, hence we set `isFlag`.
      isFlag = true;
      value = (fullMatch2[2] === "+");
    }
    else if (fullMatch3) {
      // we have an explicit value treatment of this option, hence we reset `isFlag`.
      isFlag = false;
      value = fullMatch3[2];
    }
  }
  else if (chars) {
    if (charMatch1 && charMatch1[2]) {
      // we have an explicit boolean/flag treatment of this option, hence we set `isFlag`.
      isFlag = true;
      value = (charMatch1[2] === "+");
    }
    else if (charMatch2 && charMatch2[2]) {
      // we have an explicit value treatment of this option, hence we reset `isFlag`.
      isFlag = false;
      value = charMatch2[2];
    }
    else {
      // `-v` **sets** the `v` flag
      value = true;
    }
  }

  return {
    str: str,
    chars: chars,
    full: full,
    value: value,
    isFlag: isFlag,
    isValue: isValue
  };
};

/* an opt is what's specified by the user in opts hash */
var Opt = function (opt) {
  var strings = (opt.string || "").split(","),
      abbr,
      full,
      metavar,
      string,
      matches;
  for (var i = 0; i < strings.length; i++) {
    string = strings[i].trim();
    if ((matches = string.match(/^\-([^-])(?:\s+(.*))?$/))) {
      abbr = matches[1];
      metavar = matches[2];
    }
    else if ((matches = string.match(/^\-\-(.+?)(?:[=\s]+(.+))?$/))) {
      full = matches[1];
      metavar = metavar || matches[2];
    }
  }

  matches = matches || [];
  abbr = opt.abbr || abbr;            // e.g. v from -v
  full = opt.full || full;            // e.g. verbose from --verbose
  metavar = opt.metavar || metavar;   // e.g. PATH from '--config=PATH'

  if (opt.string) {
    string = opt.string;
  }
  else if (opt.position === undefined) {
    string = "";
    if (abbr) {
      string += "-" + abbr;
      if (metavar) 
        string += " " + metavar;
      string += ", ";
    }
    string += "--" + (full || opt.name);
    if (metavar) {
      string += " " + metavar;
    }
  }

  opt = _(opt).extend({
    name: opt.name || full || abbr,
    string: string,
    abbr: abbr,
    full: full,
    metavar: metavar,
    matches: function (arg) {
      return (
        opt.full === arg ||
        opt.abbr === arg ||
        opt.position == arg ||
        opt.name === arg ||
        (opt.list && arg >= opt.position)
      );
    }
  });
  return opt;
};


var createParser = function () {
  return new ArgParser();
};

var nomnom = createParser();

for (var i in nomnom) {
  if (typeof nomnom[i] === "function") {
    createParser[i] = _(nomnom[i]).bind(nomnom);
  }
}

module.exports = createParser;
