# josephUglify
Js and Css full optioned browser side uglifier

/**
* Src can be object of files
* var code = {
    "file1.js": "function add(first, second) { return first + second; }",
    "file2.js": "console.log(add(1 + 2, 3 + 4));"
};

options :

{
    parse: {
        // parse options
	    bare_returns (default false) -- support top level return statements
	    html5_comments (default true)
	    shebang (default true) -- support #!command as the first line
    },
    compress: {
        // compress options


	    arguments (default: true) -- replace arguments[index] with function parameter name whenever possible.

	    booleans (default: true) -- various optimizations for boolean context, for example !!a ? b : c → a ? b : c

	    collapse_vars (default: true) -- Collapse single-use non-constant variables, side effects permitting.

	    comparisons (default: true) -- apply certain optimizations to binary nodes, e.g. !(a <= b) → a > b, attempts to negate binary nodes, e.g. a = !b && !c && !d && !e → a=!(b||c||d||e) etc.

	    conditionals (default: true) -- apply optimizations for if-s and conditional expressions

	    dead_code (default: true) -- remove unreachable code

	    drop_console (default: false) -- Pass true to discard calls to console.* functions. If you wish to drop a specific function call such as console.info and/or retain side effects from function arguments after dropping the function call then use pure_funcs instead.

	    drop_debugger (default: true) -- remove debugger; statements

	    evaluate (default: true) -- attempt to evaluate constant expressions

	    expression (default: false) -- Pass true to preserve completion values from terminal statements without return, e.g. in bookmarklets.

	    global_defs (default: {}) -- see conditional compilation

	    hoist_funs (default: false) -- hoist function declarations

	    hoist_props (default: true) -- hoist properties from constant object and array literals into regular variables subject to a set of constraints. For example: var o={p:1, q:2}; f(o.p, o.q); is converted to f(1, 2);. Note: hoist_props works best with mangle enabled, the compress option passes set to 2 or higher, and the compress option toplevel enabled.

	    hoist_vars (default: false) -- hoist var declarations (this is false by default because it seems to increase the size of the output in general)

	    if_return (default: true) -- optimizations for if/return and if/continue

	    inline (default: true) -- inline calls to function with simple/return statement:
	        false -- same as 0
	        0 -- disabled inlining
	        1 -- inline simple functions
	        2 -- inline functions with arguments
	        3 -- inline functions with arguments and variables
	        true -- same as 3

	    join_vars (default: true) -- join consecutive var statements

	    keep_fargs (default: true) -- Prevents the compressor from discarding unused function arguments. You need this for code which relies on Function.length.

	    keep_fnames (default: false) -- Pass true to prevent the compressor from discarding function names. Useful for code relying on Function.prototype.name. See also: the keep_fnames mangle option.

	    keep_infinity (default: false) -- Pass true to prevent Infinity from being compressed into 1/0, which may cause performance issues on Chrome.

	    loops (default: true) -- optimizations for do, while and for loops when we can statically determine the condition.

	    negate_iife (default: true) -- negate "Immediately-Called Function Expressions" where the return value is discarded, to avoid the parens that the code generator would insert.

	    passes (default: 1) -- The maximum number of times to run compress. In some cases more than one pass leads to further compressed code. Keep in mind more passes will take more time.

	    properties (default: true) -- rewrite property access using the dot notation, for example foo["bar"] → foo.bar

	    pure_funcs (default: null) -- You can pass an array of names and UglifyJS will assume that those functions do not produce side effects. DANGER: will not check if the name is redefined in scope. An example case here, for instance var q = Math.floor(a/b). If variable q is not used elsewhere, UglifyJS will drop it, but will still keep the Math.floor(a/b), not knowing what it does. You can pass pure_funcs: [ 'Math.floor' ] to let it know that this function won't produce any side effect, in which case the whole statement would get discarded. The current implementation adds some overhead (compression will be slower).

	    pure_getters (default: "strict") -- If you pass true for this, UglifyJS will assume that object property access (e.g. foo.bar or foo["bar"]) doesn't have any side effects. Specify "strict" to treat foo.bar as side-effect-free only when foo is certain to not throw, i.e. not null or undefined.

	    reduce_funcs (default: true) -- Allows single-use functions to be inlined as function expressions when permissible allowing further optimization. Enabled by default. Option depends on reduce_vars being enabled. Some code runs faster in the Chrome V8 engine if this option is disabled. Does not negatively impact other major browsers.

	    reduce_vars (default: true) -- Improve optimization on variables assigned with and used as constant values.

	    sequences (default: true) -- join consecutive simple statements using the comma operator. May be set to a positive integer to specify the maximum number of consecutive comma sequences that will be generated. If this option is set to true then the default sequences limit is 200. Set option to false or 0 to disable. The smallest sequences length is 2. A sequences value of 1 is grandfathered to be equivalent to true and as such means 200. On rare occasions the default sequences limit leads to very slow compress times in which case a value of 20 or less is recommended.

	    side_effects (default: true) -- Pass false to disable potentially dropping functions marked as "pure". A function call is marked as "pure" if a comment annotation

	    switches (default: true) -- de-duplicate and remove unreachable switch branches

	    toplevel (default: false) -- drop unreferenced functions ("funcs") and/or variables ("vars") in the top level scope (false by default, true to drop both unreferenced functions and variables)

	    top_retain (default: null) -- prevent specific toplevel functions and variables from unused removal (can be array, comma-separated, RegExp or function. Implies toplevel)

	    typeofs (default: true) -- Transforms typeof foo == "undefined" into foo === void 0. Note: recommend to set this value to false for IE10 and earlier versions due to known issues.

	    unsafe (default: false) -- apply "unsafe" transformations (discussion below)

	    unsafe_comps (default: false) -- compress expressions like a <= b assuming none of the operands can be (coerced to) NaN.

	    unsafe_Function (default: false) -- compress and mangle Function(args, code) when both args and code are string literals.

	    unsafe_math (default: false) -- optimize numerical expressions like 2 * x * 3 into 6 * x, which may give imprecise floating point results.

	    unsafe_proto (default: false) -- optimize expressions like Array.prototype.slice.call(a) into [].slice.call(a)

	    unsafe_regexp (default: false) -- enable substitutions of variables with RegExp values the same way as if they are constants.

	    unsafe_undefined (default: false) -- substitute void 0 if there is a variable named undefined in scope (variable name will be mangled, typically reduced to a single character)

	    unused (default: true) -- drop unreferenced functions and variables (simple direct variable assignments do not count as references unless set to "keep_assign")

	    warnings (default: false) -- display warnings when dropping unreachable code or unused declarations etc.

    },
    mangle: {
        // mangle options
		
	    eval (default false) -- Pass true to mangle names visible in scopes where eval or with are used.

	    keep_fnames (default false) -- Pass true to not mangle function names. Useful for code relying on Function.prototype.name. See also: the keep_fnames compress option.

	    reserved (default []) -- Pass an array of identifiers that should be excluded from mangling. Example: ["foo", "bar"].

	    toplevel (default false) -- Pass true to mangle names declared in the top level scope.

        properties: {
            // mangle property options
        }
    },


    output: {
        // output options
        
	    ascii_only (default false) -- escape Unicode characters in strings and regexps (affects directives with non-ascii characters becoming invalid)

	    beautify (default true) -- whether to actually beautify the output. Passing -b will set this to true, but you might need to pass -b even when you want to generate minified code, in order to specify additional arguments, so you can use -b beautify=false to override it.

	    braces (default false) -- always insert braces in if, for, do, while or with statements, even if their body is a single statement.

	    comments (default false) -- pass true or "all" to preserve all comments, "some" to preserve some comments, a regular expression string (e.g. /^!/) or a function.

	    indent_level (default 4)

	    indent_start (default 0) -- prefix all lines by that many spaces

	    inline_script (default true) -- escape HTML comments and the slash in occurrences of </script> in strings

	    keep_quoted_props (default false) -- when turned on, prevents stripping quotes from property names in object literals.

	    max_line_len (default false) -- maximum line length (for uglified code)

	    preamble (default null) -- when passed it must be a string and it will be prepended to the output literally. The source map will adjust for this text. Can be used to insert a comment containing licensing information, for example.

	    preserve_line (default false) -- pass true to preserve lines, but it only works if beautify is set to false.

	    quote_keys (default false) -- pass true to quote all keys in literal objects

	    quote_style (default 0) -- preferred quote style for strings (affects quoted property names and directives as well):
	        0 -- prefers double quotes, switches to single quotes when there are more double quotes in the string itself. 0 is best for gzip size.
	        1 -- always use single quotes
	        2 -- always use double quotes
	        3 -- always use the original quotes

	    semicolons (default true) -- separate statements with semicolons. If you pass false then whenever possible we will use a newline instead of a semicolon, leading to more readable output of uglified code (size before gzip could be smaller; size after gzip insignificantly larger).

	    shebang (default true) -- preserve shebang #! in preamble (bash scripts)

	    webkit (default false) -- enable workarounds for WebKit bugs. PhantomJS users should set this option to true.

	    width (default 80) -- only takes effect when beautification is on, this specifies an (orientative) line width that the beautifier will try to obey. It refers to the width of the line text (excluding indentation). It doesn't work very well currently, but it does make the code generated by UglifyJS more readable.

	    wrap_iife (default false) -- pass true to wrap immediately invoked function expressions. See #640 for more details.

    },
    sourceMap: {
        // source map options
        filename: "out.js",
        url: "out.js.map"
    },
    nameCache: null, // or specify a name cache object
    toplevel: false,
    ie8: false,
    warnings: false,
}
