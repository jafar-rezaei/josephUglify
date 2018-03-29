(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return (b64.length * 3 / 4) - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr((len * 3 / 4) - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0; i < l; i += 4) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (isArrayBuffer(value)) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (isArrayBufferView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (isArrayBufferView(string) || isArrayBuffer(string)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
// but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
function isArrayBuffer (obj) {
  return obj instanceof ArrayBuffer ||
    (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
      typeof obj.byteLength === 'number')
}

// Node 0.10 supports `ArrayBuffer` but lacks `ArrayBuffer.isView`
function isArrayBufferView (obj) {
  return (typeof ArrayBuffer.isView === 'function') && ArrayBuffer.isView(obj)
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":3}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
(function (global,Buffer){
!function(h){"use strict";function e(e){return e.split("")}function te(e,n){return 0<=n.indexOf(e)}function V(e,n){for(var t=0,i=n.length;t<i;++t)if(e(n[t]))return n[t]}function n(e){Object.defineProperty(e.prototype,"stack",{get:function(){var e=new Error(this.message);e.name=this.name;try{throw e}catch(e){return e.stack}}})}function o(e,n){this.message=e,this.defs=n}function Y(e,n,t){!0===e&&(e={});var i=e||{};if(t)for(var r in i)ae(i,r)&&!ae(n,r)&&o.croak("`"+r+"` is not a supported option",n);for(var r in n)ae(n,r)&&(i[r]=e&&ae(e,r)?e[r]:n[r]);return i}function t(e,n){var t=0;for(var i in n)ae(n,i)&&(e[i]=n[i],t++);return t}function L(){}function ie(){return!1}function J(){return!0}function C(){return this}function B(){return null}((o.prototype=Object.create(Error.prototype)).constructor=o).prototype.name="DefaultsError",n(o),o.croak=function(e,n){throw new o(e,n)};var re=function(){function e(t,i,r){var o,a=[],s=[];function e(){var e=i(t[o],o),n=e instanceof l;return n&&(e=e.v),e instanceof c?(e=e.v)instanceof f?s.push.apply(s,r?e.v.slice().reverse():e.v):s.push(e):e!==u&&(e instanceof f?a.push.apply(a,r?e.v.slice().reverse():e.v):a.push(e)),n}if(t instanceof Array)if(r){for(o=t.length;0<=--o&&!e(););a.reverse(),s.reverse()}else for(o=0;o<t.length&&!e();++o);else for(o in t)if(ae(t,o)&&e())break;return s.concat(a)}e.at_top=function(e){return new c(e)},e.splice=function(e){return new f(e)},e.last=function(e){return new l(e)};var u=e.skip={};function c(e){this.v=e}function f(e){this.v=e}function l(e){this.v=e}return e}();function v(e,n){e.indexOf(n)<0&&e.push(n)}function S(e,t){return e.replace(/\{(.+?)\}/g,function(e,n){return t&&t[n]})}function T(e,n){for(var t=e.length;0<=--t;)e[t]===n&&e.splice(t,1)}function s(e,a){if(e.length<2)return e.slice();return function e(n){if(n.length<=1)return n;var t=Math.floor(n.length/2),i=n.slice(0,t),r=n.slice(t);return function(e,n){for(var t=[],i=0,r=0,o=0;i<e.length&&r<n.length;)a(e[i],n[r])<=0?t[o++]=e[i++]:t[o++]=n[r++];return i<e.length&&t.push.apply(t,e.slice(i)),r<n.length&&t.push.apply(t,n.slice(r)),t}(i=e(i),r=e(r))}(e)}function W(e){e instanceof Array||(e=e.split(" "));var t="",n=[];e:for(var i=0;i<e.length;++i){for(var r=0;r<n.length;++r)if(n[r][0].length==e[i].length){n[r].push(e[i]);continue e}n.push([e[i]])}function o(e){return JSON.stringify(e).replace(/[\u2028\u2029]/g,function(e){switch(e){case"\u2028":return"\\u2028";case"\u2029":return"\\u2029"}return e})}function a(e){if(1==e.length)return t+="return str === "+o(e[0])+";";t+="switch(str){";for(var n=0;n<e.length;++n)t+="case "+o(e[n])+":";t+="return true}return false;"}if(3<n.length){n.sort(function(e,n){return n.length-e.length}),t+="switch(str.length){";for(i=0;i<n.length;++i){var s=n[i];t+="case "+s[0].length+":",a(s)}t+="}"}else a(e);return new Function("str",t)}function oe(e,n){for(var t=e.length;0<=--t;)if(!n(e[t]))return!1;return!0}function O(){this._values=Object.create(null),this._size=0}function ae(e,n){return Object.prototype.hasOwnProperty.call(e,n)}function $(e){for(var n,t=e.parent(-1),i=0;n=e.parent(i);i++){if(n instanceof ue&&n.body===t)return!0;if(!(n instanceof We&&n.expressions[0]===t||"Call"==n.TYPE&&n.expression===t||n instanceof Xe&&n.expression===t||n instanceof Ze&&n.expression===t||n instanceof tn&&n.condition===t||n instanceof nn&&n.left===t||n instanceof en&&n.expression===t))return!1;t=n}}function i(e,n,t,i){arguments.length<4&&(i=se);var r=n=n?n.split(/\s+/):[];i&&i.PROPS&&(n=n.concat(i.PROPS));for(var o="return function AST_"+e+"(props){ if (props) { ",a=n.length;0<=--a;)o+="this."+n[a]+" = props."+n[a]+";";var s=i&&new i;(s&&s.initialize||t&&t.initialize)&&(o+="this.initialize();"),o+="}}";var u=new Function(o)();if(s&&(u.prototype=s,u.BASE=i),i&&i.SUBCLASSES.push(u),(u.prototype.CTOR=u).PROPS=n||null,u.SELF_PROPS=r,u.SUBCLASSES=[],e&&(u.prototype.TYPE=u.TYPE=e),t)for(a in t)ae(t,a)&&(/^\$/.test(a)?u[a.substr(1)]=t[a]:u.prototype[a]=t[a]);return u.DEFMETHOD=function(e,n){this.prototype[e]=n},void 0!==h&&(h["AST_"+e]=u),u}O.prototype={set:function(e,n){return this.has(e)||++this._size,this._values["$"+e]=n,this},add:function(e,n){return this.has(e)?this.get(e).push(n):this.set(e,[n]),this},get:function(e){return this._values["$"+e]},del:function(e){return this.has(e)&&(--this._size,delete this._values["$"+e]),this},has:function(e){return"$"+e in this._values},each:function(e){for(var n in this._values)e(this._values[n],n.substr(1))},size:function(){return this._size},map:function(e){var n=[];for(var t in this._values)n.push(e(this._values[t],t.substr(1)));return n},clone:function(){var e=new O;for(var n in this._values)e._values[n]=this._values[n];return e._size=this._size,e},toObject:function(){return this._values}},O.fromObject=function(e){var n=new O;return n._size=t(n._values,e),n};var F=i("Token","type value line col pos endline endcol endpos nlb comments_before comments_after file raw",{},null),se=i("Node","start end",{_clone:function(e){if(e){var n=this.clone();return n.transform(new Xn(function(e){if(e!==n)return e.clone(!0)}))}return new this.CTOR(this)},clone:function(e){return this._clone(e)},$documentation:"Base class of all AST nodes",$propdoc:{start:"[AST_Token] The first token of this node",end:"[AST_Token] The last token of this node"},_walk:function(e){return e._visit(this)},walk:function(e){return this._walk(e)}},null);se.warn_function=null,se.warn=function(e,n){se.warn_function&&se.warn_function(S(e,n))};var ue=i("Statement",null,{$documentation:"Base class of all statements"}),ce=i("Debugger",null,{$documentation:"Represents a debugger statement"},ue),fe=i("Directive","value quote",{$documentation:'Represents a directive, like "use strict";',$propdoc:{value:"[string] The value of this directive as a plain string (it's not an AST_String!)",quote:"[string] the original quote character"}},ue),le=i("SimpleStatement","body",{$documentation:"A statement consisting of an expression, i.e. a = 1 + 2",$propdoc:{body:"[AST_Node] an expression node (should not be instanceof AST_Statement)"},_walk:function(e){return e._visit(this,function(){this.body._walk(e)})}},ue);function z(e,n){var t=e.body;if(t instanceof ue)t._walk(n);else for(var i=0,r=t.length;i<r;i++)t[i]._walk(n)}var pe=i("Block","body",{$documentation:"A body of statements (usually braced)",$propdoc:{body:"[AST_Statement*] an array of statements"},_walk:function(e){return e._visit(this,function(){z(this,e)})}},ue),de=i("BlockStatement",null,{$documentation:"A block statement"},pe),he=i("EmptyStatement",null,{$documentation:"The empty statement (empty block or simply a semicolon)"},ue),_=i("StatementWithBody","body",{$documentation:"Base class for all statements that contain one nested body: `For`, `ForIn`, `Do`, `While`, `With`",$propdoc:{body:"[AST_Statement] the body; this should always be present, even if it's an AST_EmptyStatement"}},ue),ve=i("LabeledStatement","label",{$documentation:"Statement with a label",$propdoc:{label:"[AST_Label] a label definition"},_walk:function(e){return e._visit(this,function(){this.label._walk(e),this.body._walk(e)})},clone:function(e){var n=this._clone(e);if(e){var t=n.label,i=this.label;n.walk(new Sn(function(e){e instanceof Oe&&e.label&&e.label.thedef===i&&(e.label.thedef=t).references.push(e)}))}return n}},_),_e=i("IterationStatement",null,{$documentation:"Internal class.  All loops inherit from it."},_),me=i("DWLoop","condition",{$documentation:"Base class for do/while statements",$propdoc:{condition:"[AST_Node] the loop condition.  Should not be instanceof AST_Statement"}},_e),ge=i("Do",null,{$documentation:"A `do` statement",_walk:function(e){return e._visit(this,function(){this.body._walk(e),this.condition._walk(e)})}},me),be=i("While",null,{$documentation:"A `while` statement",_walk:function(e){return e._visit(this,function(){this.condition._walk(e),this.body._walk(e)})}},me),ye=i("For","init condition step",{$documentation:"A `for` statement",$propdoc:{init:"[AST_Node?] the `for` initialization code, or null if empty",condition:"[AST_Node?] the `for` termination clause, or null if empty",step:"[AST_Node?] the `for` update clause, or null if empty"},_walk:function(e){return e._visit(this,function(){this.init&&this.init._walk(e),this.condition&&this.condition._walk(e),this.step&&this.step._walk(e),this.body._walk(e)})}},_e),we=i("ForIn","init object",{$documentation:"A `for ... in` statement",$propdoc:{init:"[AST_Node] the `for/in` initialization code",object:"[AST_Node] the object that we're looping through"},_walk:function(e){return e._visit(this,function(){this.init._walk(e),this.object._walk(e),this.body._walk(e)})}},_e),xe=i("With","expression",{$documentation:"A `with` statement",$propdoc:{expression:"[AST_Node] the `with` expression"},_walk:function(e){return e._visit(this,function(){this.expression._walk(e),this.body._walk(e)})}},_),Ae=i("Scope","variables functions uses_with uses_eval parent_scope enclosed cname",{$documentation:"Base class for all statements introducing a lexical scope",$propdoc:{variables:"[Object/S] a map of name -> SymbolDef for all variables/functions defined in this scope",functions:"[Object/S] like `variables`, but only lists function declarations",uses_with:"[boolean/S] tells whether this scope uses the `with` statement",uses_eval:"[boolean/S] tells whether this scope contains a direct call to the global `eval`",parent_scope:"[AST_Scope?/S] link to the parent scope",enclosed:"[SymbolDef*/S] a list of all symbol definitions that are accessed from this scope or any subscopes",cname:"[integer/S] current index for mangling variables (used internally by the mangler)"},clone:function(e){var n=this._clone(e);return this.variables&&(n.variables=this.variables.clone()),this.functions&&(n.functions=this.functions.clone()),this.enclosed&&(n.enclosed=this.enclosed.slice()),n}},pe),Ee=i("Toplevel","globals",{$documentation:"The toplevel scope",$propdoc:{globals:"[Object/S] a map of name -> SymbolDef for all undeclared names"},wrap_commonjs:function(e){var n=this.body,t="(function(exports){'$ORIG';})(typeof "+e+"=='undefined'?("+e+"={}):"+e+");";return t=(t=Gn(t)).transform(new Xn(function(e){if(e instanceof fe&&"$ORIG"==e.value)return re.splice(n)}))}},Ae),ke=i("Lambda","name argnames uses_arguments",{$documentation:"Base class for functions",$propdoc:{name:"[AST_SymbolDeclaration?] the name of this function",argnames:"[AST_SymbolFunarg*] array of function arguments",uses_arguments:"[boolean/S] tells whether this function accesses the arguments array"},_walk:function(i){return i._visit(this,function(){this.name&&this.name._walk(i);for(var e=this.argnames,n=0,t=e.length;n<t;n++)e[n]._walk(i);z(this,i)})}},Ae),De=i("Accessor",null,{$documentation:"A setter/getter function.  The `name` property is always null."},ke),Fe=i("Function","inlined",{$documentation:"A function expression"},ke),Ce=i("Defun","inlined",{$documentation:"A function definition"},ke),Be=i("Jump",null,{$documentation:"Base class for “jumps” (for now that's `return`, `throw`, `break` and `continue`)"},ue),Se=i("Exit","value",{$documentation:"Base class for “exits” (`return` and `throw`)",$propdoc:{value:"[AST_Node?] the value returned or thrown by this statement; could be null for AST_Return"},_walk:function(e){return e._visit(this,this.value&&function(){this.value._walk(e)})}},Be),Te=i("Return",null,{$documentation:"A `return` statement"},Se),G=i("Throw",null,{$documentation:"A `throw` statement"},Se),Oe=i("LoopControl","label",{$documentation:"Base class for loop control statements (`break` and `continue`)",$propdoc:{label:"[AST_LabelRef?] the label, or null if none"},_walk:function(e){return e._visit(this,this.label&&function(){this.label._walk(e)})}},Be),$e=i("Break",null,{$documentation:"A `break` statement"},Oe),ze=i("Continue",null,{$documentation:"A `continue` statement"},Oe),Me=i("If","condition alternative",{$documentation:"A `if` statement",$propdoc:{condition:"[AST_Node] the `if` condition",alternative:"[AST_Statement?] the `else` part, or null if not present"},_walk:function(e){return e._visit(this,function(){this.condition._walk(e),this.body._walk(e),this.alternative&&this.alternative._walk(e)})}},_),qe=i("Switch","expression",{$documentation:"A `switch` statement",$propdoc:{expression:"[AST_Node] the `switch` “discriminant”"},_walk:function(e){return e._visit(this,function(){this.expression._walk(e),z(this,e)})}},pe),je=i("SwitchBranch",null,{$documentation:"Base class for `switch` branches"},pe),Ne=i("Default",null,{$documentation:"A `default` switch branch"},je),He=i("Case","expression",{$documentation:"A `case` switch branch",$propdoc:{expression:"[AST_Node] the `case` expression"},_walk:function(e){return e._visit(this,function(){this.expression._walk(e),z(this,e)})}},je),Re=i("Try","bcatch bfinally",{$documentation:"A `try` statement",$propdoc:{bcatch:"[AST_Catch?] the catch block, or null if not present",bfinally:"[AST_Finally?] the finally block, or null if not present"},_walk:function(e){return e._visit(this,function(){z(this,e),this.bcatch&&this.bcatch._walk(e),this.bfinally&&this.bfinally._walk(e)})}},pe),Ie=i("Catch","argname",{$documentation:"A `catch` node; only makes sense as part of a `try` statement",$propdoc:{argname:"[AST_SymbolCatch] symbol for the exception"},_walk:function(e){return e._visit(this,function(){this.argname._walk(e),z(this,e)})}},pe),Pe=i("Finally",null,{$documentation:"A `finally` node; only makes sense as part of a `try` statement"},pe),Ue=i("Definitions","definitions",{$documentation:"Base class for `var` nodes (variable declarations/initializations)",$propdoc:{definitions:"[AST_VarDef*] array of variable definitions"},_walk:function(i){return i._visit(this,function(){for(var e=this.definitions,n=0,t=e.length;n<t;n++)e[n]._walk(i)})}},ue),Le=i("Var",null,{$documentation:"A `var` statement"},Ue),Ve=i("VarDef","name value",{$documentation:"A variable declaration; only appears in a AST_Definitions node",$propdoc:{name:"[AST_SymbolVar] name of the variable",value:"[AST_Node?] initializer, or null of there's no initializer"},_walk:function(e){return e._visit(this,function(){this.name._walk(e),this.value&&this.value._walk(e)})}}),Ye=i("Call","expression args",{$documentation:"A function call expression",$propdoc:{expression:"[AST_Node] expression to invoke as function",args:"[AST_Node*] array of arguments"},_walk:function(i){return i._visit(this,function(){for(var e=this.args,n=0,t=e.length;n<t;n++)e[n]._walk(i);this.expression._walk(i)})}}),Je=i("New",null,{$documentation:"An object instantiation.  Derives from a function call since it has exactly the same properties"},Ye),We=i("Sequence","expressions",{$documentation:"A sequence expression (comma-separated expressions)",$propdoc:{expressions:"[AST_Node*] array of expressions (at least two)"},_walk:function(n){return n._visit(this,function(){this.expressions.forEach(function(e){e._walk(n)})})}}),Ge=i("PropAccess","expression property",{$documentation:'Base class for property access expressions, i.e. `a.foo` or `a["foo"]`',$propdoc:{expression:"[AST_Node] the “container” expression",property:"[AST_Node|string] the property to access.  For AST_Dot this is always a plain string, while for AST_Sub it's an arbitrary AST_Node"}}),Xe=i("Dot",null,{$documentation:"A dotted property access expression",_walk:function(e){return e._visit(this,function(){this.expression._walk(e)})}},Ge),Ze=i("Sub",null,{$documentation:'Index-style property access, i.e. `a["foo"]`',_walk:function(e){return e._visit(this,function(){this.expression._walk(e),this.property._walk(e)})}},Ge),Ke=i("Unary","operator expression",{$documentation:"Base class for unary expressions",$propdoc:{operator:"[string] the operator",expression:"[AST_Node] expression that this unary operator applies to"},_walk:function(e){return e._visit(this,function(){this.expression._walk(e)})}}),Qe=i("UnaryPrefix",null,{$documentation:"Unary prefix expression, i.e. `typeof i` or `++i`"},Ke),en=i("UnaryPostfix",null,{$documentation:"Unary postfix expression, i.e. `i++`"},Ke),nn=i("Binary","operator left right",{$documentation:"Binary expression, i.e. `a + b`",$propdoc:{left:"[AST_Node] left-hand side expression",operator:"[string] the operator",right:"[AST_Node] right-hand side expression"},_walk:function(e){return e._visit(this,function(){this.left._walk(e),this.right._walk(e)})}}),tn=i("Conditional","condition consequent alternative",{$documentation:"Conditional expression using the ternary operator, i.e. `a ? b : c`",$propdoc:{condition:"[AST_Node]",consequent:"[AST_Node]",alternative:"[AST_Node]"},_walk:function(e){return e._visit(this,function(){this.condition._walk(e),this.consequent._walk(e),this.alternative._walk(e)})}}),rn=i("Assign",null,{$documentation:"An assignment expression — `a = b + 5`"},nn),on=i("Array","elements",{$documentation:"An array literal",$propdoc:{elements:"[AST_Node*] array of elements"},_walk:function(i){return i._visit(this,function(){for(var e=this.elements,n=0,t=e.length;n<t;n++)e[n]._walk(i)})}}),an=i("Object","properties",{$documentation:"An object literal",$propdoc:{properties:"[AST_ObjectProperty*] array of properties"},_walk:function(i){return i._visit(this,function(){for(var e=this.properties,n=0,t=e.length;n<t;n++)e[n]._walk(i)})}}),sn=i("ObjectProperty","key value",{$documentation:"Base class for literal object properties",$propdoc:{key:"[string|AST_SymbolAccessor] property name. For ObjectKeyVal this is a string. For getters and setters this is an AST_SymbolAccessor.",value:"[AST_Node] property value.  For getters and setters this is an AST_Accessor."},_walk:function(e){return e._visit(this,function(){this.value._walk(e)})}}),un=i("ObjectKeyVal","quote",{$documentation:"A key: value object property",$propdoc:{quote:"[string] the original quote character"}},sn),X=i("ObjectSetter",null,{$documentation:"An object setter property"},sn),Z=i("ObjectGetter",null,{$documentation:"An object getter property"},sn),cn=i("Symbol","scope name thedef",{$propdoc:{name:"[string] name of this symbol",scope:"[AST_Scope/S] the current scope (not necessarily the definition scope)",thedef:"[SymbolDef/S] the definition of this symbol"},$documentation:"Base class for all symbols"}),K=i("SymbolAccessor",null,{$documentation:"The name of a property accessor (setter/getter function)"},cn),fn=i("SymbolDeclaration","init",{$documentation:"A declaration symbol (symbol in var, function name or argument, symbol in catch)"},cn),ln=i("SymbolVar",null,{$documentation:"Symbol defining a variable"},fn),pn=i("SymbolFunarg",null,{$documentation:"Symbol naming a function argument"},ln),dn=i("SymbolDefun",null,{$documentation:"Symbol defining a function"},fn),hn=i("SymbolLambda",null,{$documentation:"Symbol naming a function expression"},fn),vn=i("SymbolCatch",null,{$documentation:"Symbol naming the exception in catch"},fn),Q=i("Label","references",{$documentation:"Symbol naming a label (declaration)",$propdoc:{references:"[AST_LoopControl*] a list of nodes referring to this label"},initialize:function(){this.references=[],this.thedef=this}},cn),_n=i("SymbolRef",null,{$documentation:"Reference to some symbol (not definition/declaration)"},cn),ee=i("LabelRef",null,{$documentation:"Reference to a label symbol"},cn),mn=i("This",null,{$documentation:"The `this` symbol"},cn),gn=i("Constant",null,{$documentation:"Base class for all constants",getValue:function(){return this.value}}),bn=i("String","value quote",{$documentation:"A string literal",$propdoc:{value:"[string] the contents of this string",quote:"[string] the original quote character"}},gn),yn=i("Number","value literal",{$documentation:"A number literal",$propdoc:{value:"[number] the numeric value",literal:"[string] numeric value as string (optional)"}},gn),wn=i("RegExp","value",{$documentation:"A regexp literal",$propdoc:{value:"[RegExp] the actual regexp"}},gn),a=i("Atom",null,{$documentation:"Base class for atoms"},gn),xn=i("Null",null,{$documentation:"The `null` atom",value:null},a),An=i("NaN",null,{$documentation:"The impossible value",value:NaN},a),En=i("Undefined",null,{$documentation:"The `undefined` value",value:void 0},a),kn=i("Hole",null,{$documentation:"A hole in an array",value:void 0},a),Dn=i("Infinity",null,{$documentation:"The `Infinity` value",value:1/0},a),Fn=i("Boolean",null,{$documentation:"Base class for booleans"},a),Cn=i("False",null,{$documentation:"The `false` atom",value:!1},Fn),Bn=i("True",null,{$documentation:"The `true` atom",value:!0},Fn);function Sn(e){this.visit=e,this.stack=[],this.directives=Object.create(null)}Sn.prototype={_visit:function(e,n){this.push(e);var t=this.visit(e,n?function(){n.call(e)}:L);return!t&&n&&n.call(e),this.pop(),t},parent:function(e){return this.stack[this.stack.length-2-(e||0)]},push:function(e){e instanceof ke?this.directives=Object.create(this.directives):e instanceof fe&&!this.directives[e.value]&&(this.directives[e.value]=e),this.stack.push(e)},pop:function(){this.stack.pop()instanceof ke&&(this.directives=Object.getPrototypeOf(this.directives))},self:function(){return this.stack[this.stack.length-1]},find_parent:function(e){for(var n=this.stack,t=n.length;0<=--t;){var i=n[t];if(i instanceof e)return i}},has_directive:function(e){var n=this.directives[e];if(n)return n;var t=this.stack[this.stack.length-1];if(t instanceof Ae)for(var i=0;i<t.body.length;++i){var r=t.body[i];if(!(r instanceof fe))break;if(r.value==e)return r}},loopcontrol_target:function(e){var n=this.stack;if(e.label)for(var t=n.length;0<=--t;){if((i=n[t])instanceof ve&&i.label.name==e.label.name)return i.body}else for(t=n.length;0<=--t;){var i;if((i=n[t])instanceof _e||e instanceof $e&&i instanceof qe)return i}},in_boolean_context:function(){for(var e,n=this.self(),t=0;e=this.parent(t);t++){if(e instanceof le||e instanceof tn&&e.condition===n||e instanceof me&&e.condition===n||e instanceof ye&&e.condition===n||e instanceof Me&&e.condition===n||e instanceof Qe&&"!"==e.operator&&e.expression===n)return!0;if(!(e instanceof nn&&("&&"==e.operator||"||"==e.operator)||e instanceof tn||e.tail_node()===n))return!1;n=e}}};var ne="break case catch const continue debugger default delete do else finally for function if in instanceof new return switch throw try typeof var void while with",M="false null true",m="abstract boolean byte char class double enum export extends final float goto implements import int interface let long native package private protected public short static super synchronized this throws transient volatile yield "+M+" "+ne,q="return new delete throw else case";ne=W(ne),m=W(m),q=W(q),M=W(M);var j=W(e("+-*&%=<>!?|~^")),N=/^0x[0-9a-f]+$/i,H=/^0[0-7]+$/,R=W(["in","instanceof","typeof","new","void","delete","++","--","+","-","!","~","&","|","^","*","/","%",">>","<<",">>>","<",">","<=",">=","==","===","!=","!==","?","=","+=","-=","/=","*=","%=",">>=","<<=",">>>=","|=","^=","&=","&&","||"]),I=W(e("  \n\r\t\f\v​           \u2028\u2029  　\ufeff")),P=W(e("\n\r\u2028\u2029")),U=W(e("[{(,;:")),Tn=W(e("[]{}(),;:")),u={letter:new RegExp("[\\u0041-\\u005A\\u0061-\\u007A\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02C1\\u02C6-\\u02D1\\u02E0-\\u02E4\\u02EC\\u02EE\\u0370-\\u0374\\u0376\\u0377\\u037A-\\u037D\\u037F\\u0386\\u0388-\\u038A\\u038C\\u038E-\\u03A1\\u03A3-\\u03F5\\u03F7-\\u0481\\u048A-\\u052F\\u0531-\\u0556\\u0559\\u0561-\\u0587\\u05D0-\\u05EA\\u05F0-\\u05F2\\u0620-\\u064A\\u066E\\u066F\\u0671-\\u06D3\\u06D5\\u06E5\\u06E6\\u06EE\\u06EF\\u06FA-\\u06FC\\u06FF\\u0710\\u0712-\\u072F\\u074D-\\u07A5\\u07B1\\u07CA-\\u07EA\\u07F4\\u07F5\\u07FA\\u0800-\\u0815\\u081A\\u0824\\u0828\\u0840-\\u0858\\u08A0-\\u08B2\\u0904-\\u0939\\u093D\\u0950\\u0958-\\u0961\\u0971-\\u0980\\u0985-\\u098C\\u098F\\u0990\\u0993-\\u09A8\\u09AA-\\u09B0\\u09B2\\u09B6-\\u09B9\\u09BD\\u09CE\\u09DC\\u09DD\\u09DF-\\u09E1\\u09F0\\u09F1\\u0A05-\\u0A0A\\u0A0F\\u0A10\\u0A13-\\u0A28\\u0A2A-\\u0A30\\u0A32\\u0A33\\u0A35\\u0A36\\u0A38\\u0A39\\u0A59-\\u0A5C\\u0A5E\\u0A72-\\u0A74\\u0A85-\\u0A8D\\u0A8F-\\u0A91\\u0A93-\\u0AA8\\u0AAA-\\u0AB0\\u0AB2\\u0AB3\\u0AB5-\\u0AB9\\u0ABD\\u0AD0\\u0AE0\\u0AE1\\u0B05-\\u0B0C\\u0B0F\\u0B10\\u0B13-\\u0B28\\u0B2A-\\u0B30\\u0B32\\u0B33\\u0B35-\\u0B39\\u0B3D\\u0B5C\\u0B5D\\u0B5F-\\u0B61\\u0B71\\u0B83\\u0B85-\\u0B8A\\u0B8E-\\u0B90\\u0B92-\\u0B95\\u0B99\\u0B9A\\u0B9C\\u0B9E\\u0B9F\\u0BA3\\u0BA4\\u0BA8-\\u0BAA\\u0BAE-\\u0BB9\\u0BD0\\u0C05-\\u0C0C\\u0C0E-\\u0C10\\u0C12-\\u0C28\\u0C2A-\\u0C39\\u0C3D\\u0C58\\u0C59\\u0C60\\u0C61\\u0C85-\\u0C8C\\u0C8E-\\u0C90\\u0C92-\\u0CA8\\u0CAA-\\u0CB3\\u0CB5-\\u0CB9\\u0CBD\\u0CDE\\u0CE0\\u0CE1\\u0CF1\\u0CF2\\u0D05-\\u0D0C\\u0D0E-\\u0D10\\u0D12-\\u0D3A\\u0D3D\\u0D4E\\u0D60\\u0D61\\u0D7A-\\u0D7F\\u0D85-\\u0D96\\u0D9A-\\u0DB1\\u0DB3-\\u0DBB\\u0DBD\\u0DC0-\\u0DC6\\u0E01-\\u0E30\\u0E32\\u0E33\\u0E40-\\u0E46\\u0E81\\u0E82\\u0E84\\u0E87\\u0E88\\u0E8A\\u0E8D\\u0E94-\\u0E97\\u0E99-\\u0E9F\\u0EA1-\\u0EA3\\u0EA5\\u0EA7\\u0EAA\\u0EAB\\u0EAD-\\u0EB0\\u0EB2\\u0EB3\\u0EBD\\u0EC0-\\u0EC4\\u0EC6\\u0EDC-\\u0EDF\\u0F00\\u0F40-\\u0F47\\u0F49-\\u0F6C\\u0F88-\\u0F8C\\u1000-\\u102A\\u103F\\u1050-\\u1055\\u105A-\\u105D\\u1061\\u1065\\u1066\\u106E-\\u1070\\u1075-\\u1081\\u108E\\u10A0-\\u10C5\\u10C7\\u10CD\\u10D0-\\u10FA\\u10FC-\\u1248\\u124A-\\u124D\\u1250-\\u1256\\u1258\\u125A-\\u125D\\u1260-\\u1288\\u128A-\\u128D\\u1290-\\u12B0\\u12B2-\\u12B5\\u12B8-\\u12BE\\u12C0\\u12C2-\\u12C5\\u12C8-\\u12D6\\u12D8-\\u1310\\u1312-\\u1315\\u1318-\\u135A\\u1380-\\u138F\\u13A0-\\u13F4\\u1401-\\u166C\\u166F-\\u167F\\u1681-\\u169A\\u16A0-\\u16EA\\u16EE-\\u16F8\\u1700-\\u170C\\u170E-\\u1711\\u1720-\\u1731\\u1740-\\u1751\\u1760-\\u176C\\u176E-\\u1770\\u1780-\\u17B3\\u17D7\\u17DC\\u1820-\\u1877\\u1880-\\u18A8\\u18AA\\u18B0-\\u18F5\\u1900-\\u191E\\u1950-\\u196D\\u1970-\\u1974\\u1980-\\u19AB\\u19C1-\\u19C7\\u1A00-\\u1A16\\u1A20-\\u1A54\\u1AA7\\u1B05-\\u1B33\\u1B45-\\u1B4B\\u1B83-\\u1BA0\\u1BAE\\u1BAF\\u1BBA-\\u1BE5\\u1C00-\\u1C23\\u1C4D-\\u1C4F\\u1C5A-\\u1C7D\\u1CE9-\\u1CEC\\u1CEE-\\u1CF1\\u1CF5\\u1CF6\\u1D00-\\u1DBF\\u1E00-\\u1F15\\u1F18-\\u1F1D\\u1F20-\\u1F45\\u1F48-\\u1F4D\\u1F50-\\u1F57\\u1F59\\u1F5B\\u1F5D\\u1F5F-\\u1F7D\\u1F80-\\u1FB4\\u1FB6-\\u1FBC\\u1FBE\\u1FC2-\\u1FC4\\u1FC6-\\u1FCC\\u1FD0-\\u1FD3\\u1FD6-\\u1FDB\\u1FE0-\\u1FEC\\u1FF2-\\u1FF4\\u1FF6-\\u1FFC\\u2071\\u207F\\u2090-\\u209C\\u2102\\u2107\\u210A-\\u2113\\u2115\\u2119-\\u211D\\u2124\\u2126\\u2128\\u212A-\\u212D\\u212F-\\u2139\\u213C-\\u213F\\u2145-\\u2149\\u214E\\u2160-\\u2188\\u2C00-\\u2C2E\\u2C30-\\u2C5E\\u2C60-\\u2CE4\\u2CEB-\\u2CEE\\u2CF2\\u2CF3\\u2D00-\\u2D25\\u2D27\\u2D2D\\u2D30-\\u2D67\\u2D6F\\u2D80-\\u2D96\\u2DA0-\\u2DA6\\u2DA8-\\u2DAE\\u2DB0-\\u2DB6\\u2DB8-\\u2DBE\\u2DC0-\\u2DC6\\u2DC8-\\u2DCE\\u2DD0-\\u2DD6\\u2DD8-\\u2DDE\\u2E2F\\u3005-\\u3007\\u3021-\\u3029\\u3031-\\u3035\\u3038-\\u303C\\u3041-\\u3096\\u309D-\\u309F\\u30A1-\\u30FA\\u30FC-\\u30FF\\u3105-\\u312D\\u3131-\\u318E\\u31A0-\\u31BA\\u31F0-\\u31FF\\u3400-\\u4DB5\\u4E00-\\u9FCC\\uA000-\\uA48C\\uA4D0-\\uA4FD\\uA500-\\uA60C\\uA610-\\uA61F\\uA62A\\uA62B\\uA640-\\uA66E\\uA67F-\\uA69D\\uA6A0-\\uA6EF\\uA717-\\uA71F\\uA722-\\uA788\\uA78B-\\uA78E\\uA790-\\uA7AD\\uA7B0\\uA7B1\\uA7F7-\\uA801\\uA803-\\uA805\\uA807-\\uA80A\\uA80C-\\uA822\\uA840-\\uA873\\uA882-\\uA8B3\\uA8F2-\\uA8F7\\uA8FB\\uA90A-\\uA925\\uA930-\\uA946\\uA960-\\uA97C\\uA984-\\uA9B2\\uA9CF\\uA9E0-\\uA9E4\\uA9E6-\\uA9EF\\uA9FA-\\uA9FE\\uAA00-\\uAA28\\uAA40-\\uAA42\\uAA44-\\uAA4B\\uAA60-\\uAA76\\uAA7A\\uAA7E-\\uAAAF\\uAAB1\\uAAB5\\uAAB6\\uAAB9-\\uAABD\\uAAC0\\uAAC2\\uAADB-\\uAADD\\uAAE0-\\uAAEA\\uAAF2-\\uAAF4\\uAB01-\\uAB06\\uAB09-\\uAB0E\\uAB11-\\uAB16\\uAB20-\\uAB26\\uAB28-\\uAB2E\\uAB30-\\uAB5A\\uAB5C-\\uAB5F\\uAB64\\uAB65\\uABC0-\\uABE2\\uAC00-\\uD7A3\\uD7B0-\\uD7C6\\uD7CB-\\uD7FB\\uF900-\\uFA6D\\uFA70-\\uFAD9\\uFB00-\\uFB06\\uFB13-\\uFB17\\uFB1D\\uFB1F-\\uFB28\\uFB2A-\\uFB36\\uFB38-\\uFB3C\\uFB3E\\uFB40\\uFB41\\uFB43\\uFB44\\uFB46-\\uFBB1\\uFBD3-\\uFD3D\\uFD50-\\uFD8F\\uFD92-\\uFDC7\\uFDF0-\\uFDFB\\uFE70-\\uFE74\\uFE76-\\uFEFC\\uFF21-\\uFF3A\\uFF41-\\uFF5A\\uFF66-\\uFFBE\\uFFC2-\\uFFC7\\uFFCA-\\uFFCF\\uFFD2-\\uFFD7\\uFFDA-\\uFFDC]"),digit:new RegExp("[\\u0030-\\u0039\\u0660-\\u0669\\u06F0-\\u06F9\\u07C0-\\u07C9\\u0966-\\u096F\\u09E6-\\u09EF\\u0A66-\\u0A6F\\u0AE6-\\u0AEF\\u0B66-\\u0B6F\\u0BE6-\\u0BEF\\u0C66-\\u0C6F\\u0CE6-\\u0CEF\\u0D66-\\u0D6F\\u0DE6-\\u0DEF\\u0E50-\\u0E59\\u0ED0-\\u0ED9\\u0F20-\\u0F29\\u1040-\\u1049\\u1090-\\u1099\\u17E0-\\u17E9\\u1810-\\u1819\\u1946-\\u194F\\u19D0-\\u19D9\\u1A80-\\u1A89\\u1A90-\\u1A99\\u1B50-\\u1B59\\u1BB0-\\u1BB9\\u1C40-\\u1C49\\u1C50-\\u1C59\\uA620-\\uA629\\uA8D0-\\uA8D9\\uA900-\\uA909\\uA9D0-\\uA9D9\\uA9F0-\\uA9F9\\uAA50-\\uAA59\\uABF0-\\uABF9\\uFF10-\\uFF19]"),non_spacing_mark:new RegExp("[\\u0300-\\u036F\\u0483-\\u0487\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7\\u0610-\\u061A\\u064B-\\u065E\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED\\u0711\\u0730-\\u074A\\u07A6-\\u07B0\\u07EB-\\u07F3\\u0816-\\u0819\\u081B-\\u0823\\u0825-\\u0827\\u0829-\\u082D\\u0900-\\u0902\\u093C\\u0941-\\u0948\\u094D\\u0951-\\u0955\\u0962\\u0963\\u0981\\u09BC\\u09C1-\\u09C4\\u09CD\\u09E2\\u09E3\\u0A01\\u0A02\\u0A3C\\u0A41\\u0A42\\u0A47\\u0A48\\u0A4B-\\u0A4D\\u0A51\\u0A70\\u0A71\\u0A75\\u0A81\\u0A82\\u0ABC\\u0AC1-\\u0AC5\\u0AC7\\u0AC8\\u0ACD\\u0AE2\\u0AE3\\u0B01\\u0B3C\\u0B3F\\u0B41-\\u0B44\\u0B4D\\u0B56\\u0B62\\u0B63\\u0B82\\u0BC0\\u0BCD\\u0C3E-\\u0C40\\u0C46-\\u0C48\\u0C4A-\\u0C4D\\u0C55\\u0C56\\u0C62\\u0C63\\u0CBC\\u0CBF\\u0CC6\\u0CCC\\u0CCD\\u0CE2\\u0CE3\\u0D41-\\u0D44\\u0D4D\\u0D62\\u0D63\\u0DCA\\u0DD2-\\u0DD4\\u0DD6\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E\\u0EB1\\u0EB4-\\u0EB9\\u0EBB\\u0EBC\\u0EC8-\\u0ECD\\u0F18\\u0F19\\u0F35\\u0F37\\u0F39\\u0F71-\\u0F7E\\u0F80-\\u0F84\\u0F86\\u0F87\\u0F90-\\u0F97\\u0F99-\\u0FBC\\u0FC6\\u102D-\\u1030\\u1032-\\u1037\\u1039\\u103A\\u103D\\u103E\\u1058\\u1059\\u105E-\\u1060\\u1071-\\u1074\\u1082\\u1085\\u1086\\u108D\\u109D\\u135F\\u1712-\\u1714\\u1732-\\u1734\\u1752\\u1753\\u1772\\u1773\\u17B7-\\u17BD\\u17C6\\u17C9-\\u17D3\\u17DD\\u180B-\\u180D\\u18A9\\u1920-\\u1922\\u1927\\u1928\\u1932\\u1939-\\u193B\\u1A17\\u1A18\\u1A56\\u1A58-\\u1A5E\\u1A60\\u1A62\\u1A65-\\u1A6C\\u1A73-\\u1A7C\\u1A7F\\u1B00-\\u1B03\\u1B34\\u1B36-\\u1B3A\\u1B3C\\u1B42\\u1B6B-\\u1B73\\u1B80\\u1B81\\u1BA2-\\u1BA5\\u1BA8\\u1BA9\\u1C2C-\\u1C33\\u1C36\\u1C37\\u1CD0-\\u1CD2\\u1CD4-\\u1CE0\\u1CE2-\\u1CE8\\u1CED\\u1DC0-\\u1DE6\\u1DFD-\\u1DFF\\u20D0-\\u20DC\\u20E1\\u20E5-\\u20F0\\u2CEF-\\u2CF1\\u2DE0-\\u2DFF\\u302A-\\u302F\\u3099\\u309A\\uA66F\\uA67C\\uA67D\\uA6F0\\uA6F1\\uA802\\uA806\\uA80B\\uA825\\uA826\\uA8C4\\uA8E0-\\uA8F1\\uA926-\\uA92D\\uA947-\\uA951\\uA980-\\uA982\\uA9B3\\uA9B6-\\uA9B9\\uA9BC\\uAA29-\\uAA2E\\uAA31\\uAA32\\uAA35\\uAA36\\uAA43\\uAA4C\\uAAB0\\uAAB2-\\uAAB4\\uAAB7\\uAAB8\\uAABE\\uAABF\\uAAC1\\uABE5\\uABE8\\uABED\\uFB1E\\uFE00-\\uFE0F\\uFE20-\\uFE26]"),space_combining_mark:new RegExp("[\\u0903\\u093E-\\u0940\\u0949-\\u094C\\u094E\\u0982\\u0983\\u09BE-\\u09C0\\u09C7\\u09C8\\u09CB\\u09CC\\u09D7\\u0A03\\u0A3E-\\u0A40\\u0A83\\u0ABE-\\u0AC0\\u0AC9\\u0ACB\\u0ACC\\u0B02\\u0B03\\u0B3E\\u0B40\\u0B47\\u0B48\\u0B4B\\u0B4C\\u0B57\\u0BBE\\u0BBF\\u0BC1\\u0BC2\\u0BC6-\\u0BC8\\u0BCA-\\u0BCC\\u0BD7\\u0C01-\\u0C03\\u0C41-\\u0C44\\u0C82\\u0C83\\u0CBE\\u0CC0-\\u0CC4\\u0CC7\\u0CC8\\u0CCA\\u0CCB\\u0CD5\\u0CD6\\u0D02\\u0D03\\u0D3E-\\u0D40\\u0D46-\\u0D48\\u0D4A-\\u0D4C\\u0D57\\u0D82\\u0D83\\u0DCF-\\u0DD1\\u0DD8-\\u0DDF\\u0DF2\\u0DF3\\u0F3E\\u0F3F\\u0F7F\\u102B\\u102C\\u1031\\u1038\\u103B\\u103C\\u1056\\u1057\\u1062-\\u1064\\u1067-\\u106D\\u1083\\u1084\\u1087-\\u108C\\u108F\\u109A-\\u109C\\u17B6\\u17BE-\\u17C5\\u17C7\\u17C8\\u1923-\\u1926\\u1929-\\u192B\\u1930\\u1931\\u1933-\\u1938\\u19B0-\\u19C0\\u19C8\\u19C9\\u1A19-\\u1A1B\\u1A55\\u1A57\\u1A61\\u1A63\\u1A64\\u1A6D-\\u1A72\\u1B04\\u1B35\\u1B3B\\u1B3D-\\u1B41\\u1B43\\u1B44\\u1B82\\u1BA1\\u1BA6\\u1BA7\\u1BAA\\u1C24-\\u1C2B\\u1C34\\u1C35\\u1CE1\\u1CF2\\uA823\\uA824\\uA827\\uA880\\uA881\\uA8B4-\\uA8C3\\uA952\\uA953\\uA983\\uA9B4\\uA9B5\\uA9BA\\uA9BB\\uA9BD-\\uA9C0\\uAA2F\\uAA30\\uAA33\\uAA34\\uAA4D\\uAA7B\\uABE3\\uABE4\\uABE6\\uABE7\\uABE9\\uABEA\\uABEC]"),connector_punctuation:new RegExp("[\\u005F\\u203F\\u2040\\u2054\\uFE33\\uFE34\\uFE4D-\\uFE4F\\uFF3F]")};function On(e){return 97<=e&&e<=122||65<=e&&e<=90||170<=e&&u.letter.test(String.fromCharCode(e))}function $n(e){return"string"==typeof e&&(e=e.charCodeAt(0)),55296<=e&&e<=56319}function zn(e){return"string"==typeof e&&(e=e.charCodeAt(0)),56320<=e&&e<=57343}function Mn(e){return 48<=e&&e<=57}function l(e){return!m(e)&&/^[a-z_$][a-z0-9_$]*$/i.test(e)}function qn(e){return 36==e||95==e||On(e)}function jn(e){var n,t,i,r=e.charCodeAt(0);return qn(r)||Mn(r)||8204==r||8205==r||(i=e,u.non_spacing_mark.test(i)||u.space_combining_mark.test(i))||(t=e,u.connector_punctuation.test(t))||(n=r,u.digit.test(String.fromCharCode(n)))}function Nn(e){return/^[a-z_$][a-z0-9_$]*$/i.test(e)}function Hn(e,n,t,i,r){this.message=e,this.filename=n,this.line=t,this.col=i,this.pos=r}function Rn(e,n,t,i,r){throw new Hn(e,n,t,i,r)}function In(e,n,t){return e.type==n&&(null==t||e.value==t)}((Hn.prototype=Object.create(Error.prototype)).constructor=Hn).prototype.name="SyntaxError",n(Hn);var Pn={};function Un(r,o,a,s){var u={text:r,filename:o,pos:0,tokpos:0,line:1,tokline:0,col:0,tokcol:0,newline_before:!1,regex_allowed:!1,comments_before:[],directives:{},directive_stack:[]};function c(){return u.text.charAt(u.pos)}function f(e,n){var t=u.text.charAt(u.pos++);if(e&&!t)throw Pn;return P(t)?(u.newline_before=u.newline_before||!n,++u.line,u.col=0,n||"\r"!=t||"\n"!=c()||(++u.pos,t="\n")):++u.col,t}function l(e){for(;0<e--;)f()}function p(e){return u.text.substr(u.pos,e.length)==e}function d(){u.tokline=u.line,u.tokcol=u.col,u.tokpos=u.pos}var h=!1;function v(e,n,t){u.regex_allowed="operator"==e&&!Vn(n)||"keyword"==e&&q(n)||"punc"==e&&U(n),"punc"==e&&"."==n?h=!0:t||(h=!1);var i={type:e,value:n,line:u.tokline,col:u.tokcol,pos:u.tokpos,endline:u.line,endcol:u.col,endpos:u.pos,nlb:u.newline_before,file:o};return/^(?:num|string|regexp)$/i.test(e)&&(i.raw=r.substring(i.pos,i.endpos)),t||(i.comments_before=u.comments_before,i.comments_after=u.comments_before=[]),u.newline_before=!1,new F(i)}function _(){for(;I(c());)f()}function m(e){Rn(e,o,u.tokline,u.tokcol,u.tokpos)}function g(r){var o=!1,a=!1,s=!1,u="."==r,e=function(e){for(var n,t="",i=0;(n=c())&&e(n,i++);)t+=f();return t}(function(e,n){var t,i=e.charCodeAt(0);switch(i){case 120:case 88:return!s&&(s=!0);case 101:case 69:return!!s||!o&&(o=a=!0);case 45:return a||0==n&&!r;case 43:return a;case a=!1,46:return!(u||s||o)&&(u=!0)}return Mn(t=i)||On(t)});r&&(e=r+e),H.test(e)&&D.has_directive("use strict")&&m("Legacy octal literals are not allowed in strict mode");var n=function(e){if(N.test(e))return parseInt(e.substr(2),16);if(H.test(e))return parseInt(e.substr(1),8);var n=parseFloat(e);return n==e?n:void 0}(e);if(!isNaN(n))return v("num",n);m("Invalid syntax: "+e)}function b(e){var n=f(!0,e);switch(n.charCodeAt(0)){case 110:return"\n";case 114:return"\r";case 116:return"\t";case 98:return"\b";case 118:return"\v";case 102:return"\f";case 120:return String.fromCharCode(t(2));case 117:return String.fromCharCode(t(4));case 10:return"";case 13:if("\n"==c())return f(!0,e),""}return"0"<=n&&n<="7"?function(e){var n=c();"0"<=n&&n<="7"&&(e+=f(!0))[0]<="3"&&"0"<=(n=c())&&n<="7"&&(e+=f(!0));if("0"===e)return"\0";0<e.length&&D.has_directive("use strict")&&m("Legacy octal escape sequences are not allowed in strict mode");return String.fromCharCode(parseInt(e,8))}(n):n}function t(e){for(var n=0;0<e;--e){var t=parseInt(f(!0),16);isNaN(t)&&m("Invalid hex-character pattern in string"),n=n<<4|t}return n}var y=n("Unterminated string constant",function(e){for(var n=f(),t="";;){var i=f(!0,!0);if("\\"==i)i=b(!0);else if(P(i))m("Unterminated string constant");else if(i==n)break;t+=i}var r=v("string",t);return r.quote=e,r});function w(e){var n,t=u.regex_allowed,i=function(){for(var e=u.text,n=u.pos,t=u.text.length;n<t;++n){var i=e[n];if(P(i))return n}return-1}();return-1==i?(n=u.text.substr(u.pos),u.pos=u.text.length):(n=u.text.substring(u.pos,i),u.pos=i),u.col=u.tokcol+(u.pos-u.tokpos),u.comments_before.push(v(e,n,!0)),u.regex_allowed=t,D}var e=n("Unterminated multiline comment",function(){var e=u.regex_allowed,n=function(e,n){var t=u.text.indexOf(e,u.pos);if(n&&-1==t)throw Pn;return t}("*/",!0),t=u.text.substring(u.pos,n).replace(/\r\n|\r|\u2028|\u2029/g,"\n");return l(t.length+2),u.comments_before.push(v("comment2",t,!0)),u.regex_allowed=e,D});function x(){for(var e,n,t=!1,i="",r=!1;null!=(e=c());)if(t)"u"!=e&&m("Expecting UnicodeEscapeSequence -- uXXXX"),jn(e=b())||m("Unicode char: "+e.charCodeAt(0)+" is not valid in identifier"),i+=e,t=!1;else if("\\"==e)r=t=!0,f();else{if(!jn(e))break;i+=f()}return ne(i)&&r&&(n=i.charCodeAt(0).toString(16).toUpperCase(),i="\\u"+"0000".substr(n.length)+n+i.slice(1)),i}var A=n("Unterminated regular expression",function(e){for(var n,t=!1,i=!1;n=f(!0);)if(P(n))m("Unexpected line terminator");else if(t)e+="\\"+n,t=!1;else if("["==n)i=!0,e+=n;else if("]"==n&&i)i=!1,e+=n;else{if("/"==n&&!i)break;"\\"==n?t=!0:e+=n}var r=x();try{var o=new RegExp(e,r);return o.raw_source=e,v("regexp",o)}catch(e){m(e.message)}});function E(e){return v("operator",function e(n){if(!c())return n;var t=n+c();return R(t)?(f(),e(t)):n}(e||f()))}function k(){switch(f(),c()){case"/":return f(),w("comment1");case"*":return f(),e()}return u.regex_allowed?A(""):E("/")}function n(n,t){return function(e){try{return t(e)}catch(e){if(e!==Pn)throw e;m(n)}}}function D(e){if(null!=e)return A(e);for(s&&0==u.pos&&p("#!")&&(d(),l(2),w("comment5"));;){if(_(),d(),a){if(p("\x3c!--")){l(4),w("comment3");continue}if(p("--\x3e")&&u.newline_before){l(3),w("comment4");continue}}var n=c();if(!n)return v("eof");var t=n.charCodeAt(0);switch(t){case 34:case 39:return y(n);case 46:return f(),Mn(c().charCodeAt(0))?g("."):v("punc",".");case 47:var i=k();if(i===D)continue;return i}if(Mn(t))return g();if(Tn(n))return v("punc",f());if(j(n))return E();if(92==t||qn(t))return void 0,r=x(),h?v("name",r):M(r)?v("atom",r):ne(r)?R(r)?v("operator",r):v("keyword",r):v("name",r);break}var r;m("Unexpected character '"+n+"'")}return D.context=function(e){return e&&(u=e),u},D.add_directive=function(e){u.directive_stack[u.directive_stack.length-1].push(e),void 0===u.directives[e]?u.directives[e]=1:u.directives[e]++},D.push_directives_stack=function(){u.directive_stack.push([])},D.pop_directives_stack=function(){for(var e=u.directive_stack[u.directive_stack.length-1],n=0;n<e.length;n++)u.directives[e[n]]--;u.directive_stack.pop()},D.has_directive=function(e){return 0<u.directives[e]},D}var Ln=W(["typeof","void","delete","--","++","!","~","-","+"]),Vn=W(["--","++"]),Yn=W(["=","+=","-=","/=","*=","%=",">>=","<<=",">>>=","|=","^=","&="]),Jn=function(e,n){for(var t=0;t<e.length;++t)for(var i=e[t],r=0;r<i.length;++r)n[i[r]]=t+1;return n}([["||"],["&&"],["|"],["^"],["&"],["==","===","!=","!=="],["<",">","<=",">=","in","instanceof"],[">>","<<",">>>"],["+","-"],["*","/","%"]],{}),Wn=W(["atom","num","string","regexp","name"]);function Gn(e,u){u=Y(u,{bare_returns:!1,expression:!1,filename:null,html5_comments:!0,shebang:!0,strict:!1,toplevel:null},!0);var c={input:"string"==typeof e?Un(e,u.filename,u.html5_comments,u.shebang):e,token:null,prev:null,peeked:null,in_function:0,in_directives:!0,in_loop:0,labels:[]};function f(e,n){return In(c.token,e,n)}function l(){return c.peeked||(c.peeked=c.input())}function p(){return c.prev=c.token,c.peeked?(c.token=c.peeked,c.peeked=null):c.token=c.input(),c.in_directives=c.in_directives&&("string"==c.token.type||f("punc",";")),c.token}function d(){return c.prev}function h(e,n,t,i){var r=c.input.context();Rn(e,r.filename,null!=n?n:r.tokline,null!=t?t:r.tokcol,null!=i?i:r.tokpos)}function t(e,n){h(n,e.line,e.col)}function v(e){null==e&&(e=c.token),t(e,"Unexpected token: "+e.type+" ("+e.value+")")}function _(e,n){if(f(e,n))return p();t(c.token,"Unexpected token "+c.token.type+" «"+c.token.value+"», expected "+e+" «"+n+"»")}function m(e){return _("punc",e)}function g(e){return e.nlb||!oe(e.comments_before,function(e){return!e.nlb})}function b(){return!u.strict&&(f("eof")||f("punc","}")||g(c.token))}function y(e){f("punc",";")?p():e||b()||v()}function w(){m("(");var e=U(!0);return m(")"),e}function n(i){return function(){var e=c.token,n=i.apply(null,arguments),t=d();return n.start=e,n.end=t,n}}function x(){(f("operator","/")||f("operator","/="))&&(c.peeked=null,c.token=c.input(c.token.value.substr(1)))}c.token=p();var A=n(function(e){switch(x(),c.token.type){case"string":if(c.in_directives){var n=l();-1==c.token.raw.indexOf("\\")&&(In(n,"punc",";")||In(n,"punc","}")||g(n)||In(n,"eof"))?c.input.add_directive(c.token.value):c.in_directives=!1}var t=c.in_directives,i=E();return t?new fe(i.body):i;case"num":case"regexp":case"operator":case"atom":return E();case"name":return In(l(),"punc",":")?function(){var n=q(Q);V(function(e){return e.name==n.name},c.labels)&&h("Label "+n.name+" defined twice");m(":"),c.labels.push(n);var e=A();c.labels.pop(),e instanceof _e||n.references.forEach(function(e){e instanceof ze&&(e=e.label.start,h("Continue label `"+n.name+"` refers to non-IterationStatement.",e.line,e.col,e.pos))});return new ve({body:e,label:n})}():E();case"punc":switch(c.token.value){case"{":return new de({start:c.token,body:F(),end:d()});case"[":case"(":return E();case";":return c.in_directives=!1,p(),new he;default:v()}case"keyword":switch(c.token.value){case"break":return p(),k($e);case"continue":return p(),k(ze);case"debugger":return p(),y(),new ce;case"do":p();var r=L(A);_("keyword","while");var o=w();return y(!0),new ge({body:r,condition:o});case"while":return p(),new be({condition:w(),body:L(A)});case"for":return p(),function(){m("(");var e=null;if(!f("punc",";")&&(e=f("keyword","var")?(p(),B(!0)):U(!0,!0),f("operator","in")))return e instanceof Le?1<e.definitions.length&&h("Only one variable declaration allowed in for..in loop",e.start.line,e.start.col,e.start.pos):I(e)||h("Invalid left-hand side in for..in loop",e.start.line,e.start.col,e.start.pos),p(),n=e,t=U(!0),m(")"),new we({init:n,object:t,body:L(A)});var n,t;return function(e){m(";");var n=f("punc",";")?null:U(!0);m(";");var t=f("punc",")")?null:U(!0);return m(")"),new ye({init:e,condition:n,step:t,body:L(A)})}(e)}();case"function":return!e&&c.input.has_directive("use strict")&&h("In strict mode code, functions can only be declared at top level or immediately within another function."),p(),D(Ce);case"if":return p(),function(){var e=w(),n=A(),t=null;f("keyword","else")&&(p(),t=A());return new Me({condition:e,body:n,alternative:t})}();case"return":0!=c.in_function||u.bare_returns||h("'return' outside of function"),p();var a=null;return f("punc",";")?p():b()||(a=U(!0),y()),new Te({value:a});case"switch":return p(),new qe({expression:w(),body:L(C)});case"throw":p(),g(c.token)&&h("Illegal newline after 'throw'");a=U(!0);return y(),new G({value:a});case"try":return p(),function(){var e=F(),n=null,t=null;if(f("keyword","catch")){var i=c.token;p(),m("(");var r=q(vn);m(")"),n=new Ie({start:i,argname:r,body:F(),end:d()})}if(f("keyword","finally")){var i=c.token;p(),t=new Pe({start:i,body:F(),end:d()})}n||t||h("Missing catch/finally blocks");return new Re({body:e,bcatch:n,bfinally:t})}();case"var":p();var s=B();return y(),s;case"with":return c.input.has_directive("use strict")&&h("Strict mode may not include a with statement"),p(),new xe({expression:w(),body:A()})}}v()});function E(e){return new le({body:(e=U(!0),y(),e)})}function k(e){var n,t=null;b()||(t=q(ee,!0)),null!=t?((n=V(function(e){return e.name==t.name},c.labels))||h("Undefined label "+t.name),t.thedef=n):0==c.in_loop&&h(e.TYPE+" not inside a loop or switch"),y();var i=new e({label:t});return n&&n.references.push(i),i}var D=function(e){var n=e===Ce,t=f("name")?q(n?dn:hn):null;n&&!t&&v(),!t||e===De||t instanceof fn||v(d()),m("(");for(var i=[],r=!0;!f("punc",")");)r?r=!1:m(","),i.push(q(pn));p();var o=c.in_loop,a=c.labels;++c.in_function,c.in_directives=!0,c.input.push_directives_stack(),c.in_loop=0,c.labels=[];var s=F(!0);return c.input.has_directive("use strict")&&(t&&M(t),i.forEach(M)),c.input.pop_directives_stack(),--c.in_function,c.in_loop=o,c.labels=a,new e({name:t,argnames:i,body:s})};function F(e){m("{");for(var n=[];!f("punc","}");)f("eof")&&v(),n.push(A(e));return p(),n}function C(){m("{");for(var e,n=[],t=null,i=null;!f("punc","}");)f("eof")&&v(),f("keyword","case")?(i&&(i.end=d()),t=[],i=new He({start:(e=c.token,p(),e),expression:U(!0),body:t}),n.push(i),m(":")):f("keyword","default")?(i&&(i.end=d()),t=[],i=new Ne({start:(e=c.token,p(),m(":"),e),body:t}),n.push(i)):(t||v(),t.push(A()));return i&&(i.end=d()),p(),n}var B=function(e){return new Le({start:d(),definitions:function(e){for(var n=[];n.push(new Ve({start:c.token,name:q(ln),value:f("operator","=")?(p(),U(!1,e)):null,end:d()})),f("punc",",");)p();return n}(e),end:d()})};var s=function(e){if(f("operator","new"))return function(e){var n=c.token;_("operator","new");var t,i=s(!1);f("punc","(")?(p(),t=S(")")):t=[];var r=new Je({start:n,expression:i,args:t,end:d()});return j(r),N(r,e)}(e);var n=c.token;if(f("punc")){switch(n.value){case"(":p();var t=U(!0),i=n.comments_before.length;if([].unshift.apply(t.start.comments_before,n.comments_before),n.comments_before=t.start.comments_before,0==(n.comments_before_length=i)&&0<n.comments_before.length){var r=n.comments_before[0];r.nlb||(r.nlb=n.nlb,n.nlb=!1)}n.comments_after=t.start.comments_after,t.start=n,m(")");var o=d();return o.comments_before=t.end.comments_before,[].push.apply(t.end.comments_after,o.comments_after),o.comments_after=t.end.comments_after,t.end=o,t instanceof Ye&&j(t),N(t,e);case"[":return N(T(),e);case"{":return N(O(),e)}v()}if(f("keyword","function")){p();var a=D(Fe);return a.start=n,a.end=d(),N(a,e)}if(Wn(c.token.type))return N(function(){var e,n=c.token;switch(n.type){case"name":e=z(_n);break;case"num":e=new yn({start:n,end:n,value:n.value});break;case"string":e=new bn({start:n,end:n,value:n.value,quote:n.quote});break;case"regexp":e=new wn({start:n,end:n,value:n.value});break;case"atom":switch(n.value){case"false":e=new Cn({start:n,end:n});break;case"true":e=new Bn({start:n,end:n});break;case"null":e=new xn({start:n,end:n})}}return p(),e}(),e);v()};function S(e,n,t){for(var i=!0,r=[];!f("punc",e)&&(i?i=!1:m(","),!n||!f("punc",e));)f("punc",",")&&t?r.push(new kn({start:c.token,end:c.token})):r.push(U(!1));return p(),r}var T=n(function(){return m("["),new on({elements:S("]",!u.strict,!0)})}),a=n(function(){return D(De)}),O=n(function(){m("{");for(var e=!0,n=[];!f("punc","}")&&(e?e=!1:m(","),u.strict||!f("punc","}"));){var t=c.token,i=t.type,r=$();if("name"==i&&!f("punc",":")){var o=new K({start:c.token,name:""+$(),end:d()});if("get"==r){n.push(new Z({start:t,key:o,value:a(),end:d()}));continue}if("set"==r){n.push(new X({start:t,key:o,value:a(),end:d()}));continue}}m(":"),n.push(new un({start:t,quote:t.quote,key:""+r,value:U(!1),end:d()}))}return p(),new an({properties:n})});function $(){var e=c.token;switch(e.type){case"operator":ne(e.value)||v();case"num":case"string":case"name":case"keyword":case"atom":return p(),e.value;default:v()}}function z(e){var n=c.token.value;return new("this"==n?mn:e)({name:String(n),start:c.token,end:c.token})}function M(e){"arguments"!=e.name&&"eval"!=e.name||h("Unexpected "+e.name+" in strict mode",e.start.line,e.start.col,e.start.pos)}function q(e,n){if(!f("name"))return n||h("Name expected"),null;var t=z(e);return c.input.has_directive("use strict")&&t instanceof fn&&M(t),p(),t}function j(e){for(var n=e.start,t=n.comments_before,i=ae(n,"comments_before_length")?n.comments_before_length:t.length;0<=--i;){var r=t[i];if(/[@#]__PURE__/.test(r.value)){e.pure=r;break}}}var N=function(e,n){var t,i=e.start;if(f("punc","."))return p(),N(new Xe({start:i,expression:e,property:(t=c.token,"name"!=t.type&&v(),p(),t.value),end:d()}),n);if(f("punc","[")){p();var r=U(!0);return m("]"),N(new Ze({start:i,expression:e,property:r,end:d()}),n)}if(n&&f("punc","(")){p();var o=new Ye({start:i,expression:e,args:S(")"),end:d()});return j(o),N(o,!0)}return e},H=function(e){var n=c.token;if(f("operator")&&Ln(n.value)){p(),x();var t=r(Qe,n,H(e));return t.start=n,t.end=d(),t}for(var i=s(e);f("operator")&&Vn(c.token.value)&&!g(c.token);)(i=r(en,c.token,i)).start=n,i.end=c.token,p();return i};function r(e,n,t){var i=n.value;switch(i){case"++":case"--":I(t)||h("Invalid use of "+i+" operator",n.line,n.col,n.pos);break;case"delete":t instanceof _n&&c.input.has_directive("use strict")&&h("Calling delete on expression not allowed in strict mode",t.start.line,t.start.col,t.start.pos)}return new e({operator:i,expression:t})}var R=function(e,n,t){var i=f("operator")?c.token.value:null;"in"==i&&t&&(i=null);var r=null!=i?Jn[i]:null;if(null!=r&&n<r){p();var o=R(H(!0),r,t);return R(new nn({start:e.start,left:e,operator:i,right:o,end:o.end}),n,t)}return e};var o=function(e){var n,t=c.token,i=(n=e,R(H(!0),0,n));if(f("operator","?")){p();var r=U(!1);return m(":"),new tn({start:t,condition:i,consequent:r,alternative:U(!1,e),end:d()})}return i};function I(e){return e instanceof Ge||e instanceof _n}var P=function(e){var n=c.token,t=o(e),i=c.token.value;if(f("operator")&&Yn(i)){if(I(t))return p(),new rn({start:n,left:t,operator:i,right:P(e),end:d()});h("Invalid assignment")}return t},U=function(e,n){for(var t=c.token,i=[];i.push(P(n)),e&&f("punc",",");)p(),e=!0;return 1==i.length?i[0]:new We({start:t,expressions:i,end:l()})};function L(e){++c.in_loop;var n=e();return--c.in_loop,n}return u.expression?U(!0):function(){var e=c.token,n=[];for(c.input.push_directives_stack();!f("eof");)n.push(A(!0));c.input.pop_directives_stack();var t=d(),i=u.toplevel;return i?(i.body=i.body.concat(n),i.end=t):i=new Ee({start:e,body:n,end:t}),i}()}function Xn(e,n){Sn.call(this),this.before=e,this.after=n}function r(e,n,t){this.name=n.name,this.orig=[n],this.init=t,this.eliminated=0,this.scope=e,this.references=[],this.replaced=0,this.global=!1,this.mangled_name=null,this.undeclared=!1,this.id=r.next_id++}function p(e,n){var t=e.names_in_use;return t||(e.names_in_use=t=Object.create(e.mangled_names||null),e.cname_holes=[],e.enclosed.forEach(function(e){e.unmangleable(n)&&(t[e.name]=!0)})),t}function f(e){return e=Y(e,{eval:!1,ie8:!1,keep_fnames:!1,reserved:[],toplevel:!1}),Array.isArray(e.reserved)||(e.reserved=[]),v(e.reserved,"arguments"),e}Xn.prototype=new Sn,function(o){function e(e,r){e.DEFMETHOD("transform",function(e,n){var t,i;return e.push(this),e.before&&(t=e.before(this,r,n)),t===o&&(r(t=this,e),e.after&&(i=e.after(t,n))!==o&&(t=i)),e.pop(),t})}function t(e,n){return re(e,function(e){return e.transform(n,!0)})}e(se,L),e(ve,function(e,n){e.label=e.label.transform(n),e.body=e.body.transform(n)}),e(le,function(e,n){e.body=e.body.transform(n)}),e(pe,function(e,n){e.body=t(e.body,n)}),e(me,function(e,n){e.condition=e.condition.transform(n),e.body=e.body.transform(n)}),e(ye,function(e,n){e.init&&(e.init=e.init.transform(n)),e.condition&&(e.condition=e.condition.transform(n)),e.step&&(e.step=e.step.transform(n)),e.body=e.body.transform(n)}),e(we,function(e,n){e.init=e.init.transform(n),e.object=e.object.transform(n),e.body=e.body.transform(n)}),e(xe,function(e,n){e.expression=e.expression.transform(n),e.body=e.body.transform(n)}),e(Se,function(e,n){e.value&&(e.value=e.value.transform(n))}),e(Oe,function(e,n){e.label&&(e.label=e.label.transform(n))}),e(Me,function(e,n){e.condition=e.condition.transform(n),e.body=e.body.transform(n),e.alternative&&(e.alternative=e.alternative.transform(n))}),e(qe,function(e,n){e.expression=e.expression.transform(n),e.body=t(e.body,n)}),e(He,function(e,n){e.expression=e.expression.transform(n),e.body=t(e.body,n)}),e(Re,function(e,n){e.body=t(e.body,n),e.bcatch&&(e.bcatch=e.bcatch.transform(n)),e.bfinally&&(e.bfinally=e.bfinally.transform(n))}),e(Ie,function(e,n){e.argname=e.argname.transform(n),e.body=t(e.body,n)}),e(Ue,function(e,n){e.definitions=t(e.definitions,n)}),e(Ve,function(e,n){e.name=e.name.transform(n),e.value&&(e.value=e.value.transform(n))}),e(ke,function(e,n){e.name&&(e.name=e.name.transform(n)),e.argnames=t(e.argnames,n),e.body=t(e.body,n)}),e(Ye,function(e,n){e.expression=e.expression.transform(n),e.args=t(e.args,n)}),e(We,function(e,n){e.expressions=t(e.expressions,n)}),e(Xe,function(e,n){e.expression=e.expression.transform(n)}),e(Ze,function(e,n){e.expression=e.expression.transform(n),e.property=e.property.transform(n)}),e(Ke,function(e,n){e.expression=e.expression.transform(n)}),e(nn,function(e,n){e.left=e.left.transform(n),e.right=e.right.transform(n)}),e(tn,function(e,n){e.condition=e.condition.transform(n),e.consequent=e.consequent.transform(n),e.alternative=e.alternative.transform(n)}),e(on,function(e,n){e.elements=t(e.elements,n)}),e(an,function(e,n){e.properties=t(e.properties,n)}),e(sn,function(e,n){e.value=e.value.transform(n)})}(),r.next_id=1,r.prototype={unmangleable:function(e){return e||(e={}),this.global&&!e.toplevel||this.undeclared||!e.eval&&(this.scope.uses_eval||this.scope.uses_with)||e.keep_fnames&&(this.orig[0]instanceof hn||this.orig[0]instanceof dn)},mangle:function(e){var n=e.cache&&e.cache.props;if(this.global&&n&&n.has(this.name))this.mangled_name=n.get(this.name);else if(!this.mangled_name&&!this.unmangleable(e)){var t;(t=this.redefined())?this.mangled_name=t.mangled_name||t.name:this.mangled_name=function(e,i,n){var t=p(e,i),r=e.cname_holes,o=Object.create(null);if(e instanceof Fe&&e.name&&n.orig[0]instanceof pn){var a=e.name.definition();o[a.mangled_name||a.name]=!0}var s,u=[e];n.references.forEach(function(e){var n=e.scope;do{if(!(u.indexOf(n)<0))break;for(var t in p(n,i))o[t]=!0;u.push(n)}while(n=n.parent_scope)});for(var c=0,f=r.length;c<f;c++)if(s=g(r[c]),!o[s])return r.splice(c,1),e.names_in_use[s]=!0,s;for(;;)if(s=g(++e.cname),!t[s]&&l(s)&&!te(s,i.reserved)){if(!o[s])break;r.push(e.cname)}e.names_in_use[s]=!0,i.ie8&&n.orig[0]instanceof hn&&(p(e.parent_scope,i)[s]=!0);return s}(this.scope,e,this),this.global&&n&&n.set(this.name,this.mangled_name)}},redefined:function(){return this.defun&&this.defun.variables.get(this.name)}},Ee.DEFMETHOD("figure_out_scope",function(c){c=Y(c,{cache:null,ie8:!1});var a=this,f=a.parent_scope=null,l=new O,p=null,s=new Sn(function(e,n){if(e instanceof Ie){var t=f;return(f=new Ae(e)).init_scope_vars(t),n(),f=t,!0}if(e instanceof Ae){e.init_scope_vars(f);t=f;var i=p,r=l;return p=f=e,l=new O,n(),f=t,p=i,l=r,!0}if(e instanceof ve){var o=e.label;if(l.has(o.name))throw new Error(S("Label {name} defined twice",o));return l.set(o.name,o),n(),l.del(o.name),!0}if(e instanceof xe)for(var a=f;a;a=a.parent_scope)a.uses_with=!0;else if(e instanceof cn&&(e.scope=f),e instanceof Q&&((e.thedef=e).references=[]),e instanceof hn)p.def_function(e,"arguments"==e.name?void 0:p);else if(e instanceof dn)(e.scope=p.parent_scope).def_function(e,p);else if(e instanceof ln){if(p.def_variable(e,"SymbolVar"==e.TYPE?null:void 0),p!==f){e.mark_enclosed(c);var s=f.find_variable(e);e.thedef!==s&&(e.thedef=s),e.reference(c)}}else if(e instanceof vn)f.def_variable(e).defun=p;else if(e instanceof ee){var u=l.get(e.name);if(!u)throw new Error(S("Undefined label {name} [{line},{col}]",{name:e.name,line:e.start.line,col:e.start.col}));e.thedef=u}});a.walk(s),a.globals=new O;s=new Sn(function(e,n){if(e instanceof Oe&&e.label)return e.label.thedef.references.push(e),!0;if(e instanceof _n){var t=e.name;if("eval"==t&&s.parent()instanceof Ye)for(var i=e.scope;i&&!i.uses_eval;i=i.parent_scope)i.uses_eval=!0;var r=e.scope.find_variable(t);return r?r.scope instanceof ke&&"arguments"==t&&(r.scope.uses_arguments=!0):r=a.def_global(e),e.thedef=r,e.reference(c),!0}var o;if(e instanceof vn&&(o=e.definition().redefined()))for(i=e.scope;i&&(v(i.enclosed,o),i!==o.scope);)i=i.parent_scope});a.walk(s),c.ie8&&a.walk(new Sn(function(e,n){if(e instanceof vn){var t=e.name,i=e.thedef.references,r=e.thedef.defun,o=r.find_variable(t)||a.globals.get(t)||r.def_variable(e);return i.forEach(function(e){e.thedef=o,e.reference(c)}),e.thedef=o,e.reference(c),!0}}))}),Ee.DEFMETHOD("def_global",function(e){var n=this.globals,t=e.name;if(n.has(t))return n.get(t);var i=new r(this,e);return i.undeclared=!0,i.global=!0,n.set(t,i),i}),Ae.DEFMETHOD("init_scope_vars",function(e){this.variables=new O,this.functions=new O,this.uses_with=!1,this.uses_eval=!1,this.parent_scope=e,this.enclosed=[],this.cname=-1}),ke.DEFMETHOD("init_scope_vars",function(){Ae.prototype.init_scope_vars.apply(this,arguments),this.uses_arguments=!1,this.def_variable(new pn({name:"arguments",start:this.start,end:this.end}))}),cn.DEFMETHOD("mark_enclosed",function(e){for(var n=this.definition(),t=this.scope;t&&(v(t.enclosed,n),e.keep_fnames&&t.functions.each(function(e){v(n.scope.enclosed,e)}),t!==n.scope);)t=t.parent_scope}),cn.DEFMETHOD("reference",function(e){this.definition().references.push(this),this.mark_enclosed(e)}),Ae.DEFMETHOD("find_variable",function(e){return e instanceof cn&&(e=e.name),this.variables.get(e)||this.parent_scope&&this.parent_scope.find_variable(e)}),Ae.DEFMETHOD("def_function",function(e,n){var t=this.def_variable(e,n);return(!t.init||t.init instanceof Ce)&&(t.init=n),this.functions.set(e.name,t),t}),Ae.DEFMETHOD("def_variable",function(e,n){var t=this.variables.get(e.name);return t?(t.orig.push(e),t.init&&(t.scope!==e.scope||t.init instanceof Fe)&&(t.init=n)):(t=new r(this,e,n),this.variables.set(e.name,t),t.global=!this.parent_scope),e.thedef=t}),cn.DEFMETHOD("unmangleable",function(e){var n=this.definition();return!n||n.unmangleable(e)}),Q.DEFMETHOD("unmangleable",ie),cn.DEFMETHOD("unreferenced",function(){return 0==this.definition().references.length&&!(this.scope.uses_eval||this.scope.uses_with)}),cn.DEFMETHOD("definition",function(){return this.thedef}),cn.DEFMETHOD("global",function(){return this.definition().global}),Ee.DEFMETHOD("mangle_names",function(a){a=f(a);var s=-1;if(a.cache&&a.cache.props){var n=this.mangled_names=Object.create(null);a.cache.props.each(function(e){n[e]=!0})}var u=[],e=new Sn(function(e,n){if(e instanceof ve){var t=s;return n(),s=t,!0}if(e instanceof Ae)return n(),a.cache&&e instanceof Ee&&e.globals.each(c),e.variables.each(c),!0;if(e instanceof Q){for(var i;!l(i=g(++s)););return e.mangled_name=i,!0}if(!a.ie8&&e instanceof Ie){var r=e.argname.definition(),o=r.redefined();return o&&(u.push(r),r.references.forEach(function(e){e.thedef=o,e.reference(a),e.thedef=r})),n(),o||c(r),!0}});function c(e){te(e.name,a.reserved)||e.mangle(a)}this.walk(e),u.forEach(c)}),Ee.DEFMETHOD("find_colliding_names",function(t){var i=t.cache&&t.cache.props,n=Object.create(null);return t.reserved.forEach(r),this.globals.each(o),this.walk(new Sn(function(e){e instanceof Ae&&e.variables.each(o),e instanceof vn&&o(e.definition())})),n;function r(e){n[e]=!0}function o(e){var n=e.name;if(e.global&&i&&i.has(n))n=i.get(n);else if(!e.unmangleable(t))return;r(n)}}),Ee.DEFMETHOD("expand_names",function(t){g.reset(),g.sort(),t=f(t);var i=this.find_colliding_names(t),r=0;function n(n){if(!(n.global&&t.cache||n.unmangleable(t)||te(n.name,t.reserved))){var e=n.redefined();n.name=e?e.name:function(){for(var e;e=g(r++),i[e]||!l(e););return e}(),n.orig.forEach(function(e){e.name=n.name}),n.references.forEach(function(e){e.name=n.name})}}this.globals.each(n),this.walk(new Sn(function(e){e instanceof Ae&&e.variables.each(n),e instanceof vn&&n(e.definition())}))}),se.DEFMETHOD("tail_node",C),We.DEFMETHOD("tail_node",function(){return this.expressions[this.expressions.length-1]}),Ee.DEFMETHOD("compute_char_frequency",function(t){t=f(t),g.reset();try{se.prototype.print=function(e,n){this._print(e,n),this instanceof cn&&!this.unmangleable(t)?g.consider(this.name,-1):t.properties&&(this instanceof Xe?g.consider(this.property,-1):this instanceof Ze&&function e(n){n instanceof bn?g.consider(n.value,-1):n instanceof tn?(e(n.consequent),e(n.alternative)):n instanceof We&&e(n.tail_node())}(this.property))},g.consider(this.print_to_string(),1)}finally{se.prototype.print=se.prototype._print}g.sort()});var g=function(){var i,r,e="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_".split(""),n="0123456789".split("");function t(){r=Object.create(null),e.forEach(function(e){r[e]=0}),n.forEach(function(e){r[e]=0})}function o(e,n){return r[n]-r[e]}function a(e){var n="",t=54;for(e++;n+=i[--e%t],e=Math.floor(e/t),t=64,0<e;);return n}return a.consider=function(e,n){for(var t=e.length;0<=--t;)r[e[t]]+=n},a.sort=function(){i=s(e,o).concat(s(n,o))},(a.reset=t)(),a}(),Zn=/^$|[;{][\s\n]*$/;function Kn(e){return"comment2"==e.type&&/@preserve|@license|@cc_on/i.test(e.value)}function Qn(s){var e=!s;s=Y(s,{ascii_only:!1,beautify:!1,braces:!1,comments:!1,ie8:!1,indent_level:4,indent_start:0,inline_script:!0,keep_quoted_props:!1,max_line_len:!1,preamble:null,preserve_line:!1,quote_keys:!1,quote_style:0,semicolons:!0,shebang:!0,source_map:null,webkit:!1,width:80,wrap_iife:!1},!0);var u=ie;if(s.comments){var n=s.comments;if("string"==typeof s.comments&&/^\/.*\/[a-zA-Z]*$/.test(s.comments)){var t=s.comments.lastIndexOf("/");n=new RegExp(s.comments.substr(1,t-1),s.comments.substr(t+1))}u=n instanceof RegExp?function(e){return"comment5"!=e.type&&n.test(e.value)}:"function"==typeof n?function(e){return"comment5"!=e.type&&n(this,e)}:"some"===n?Kn:J}var r=0,a=0,c=1,f=0,l="",p=s.ascii_only?function(e,t){return e.replace(/[\u0000-\u001f\u007f-\uffff]/g,function(e){var n=e.charCodeAt(0).toString(16);if(n.length<=2&&!t){for(;n.length<2;)n="0"+n;return"\\x"+n}for(;n.length<4;)n="0"+n;return"\\u"+n})}:function(e){for(var n="",t=0,i=e.length;t<i;t++)$n(e[t])&&!zn(e[t+1])||zn(e[t])&&!$n(e[t-1])?n+="\\u"+e.charCodeAt(t).toString(16):n+=e[t];return n};function o(e,n){var t=function(t,e){var i=0,r=0;function n(){return"'"+t.replace(/\x27/g,"\\'")+"'"}function o(){return'"'+t.replace(/\x22/g,'\\"')+'"'}switch(t=t.replace(/[\\\b\f\n\r\v\t\x22\x27\u2028\u2029\0\ufeff]/g,function(e,n){switch(e){case'"':return++i,'"';case"'":return++r,"'";case"\\":return"\\\\";case"\n":return"\\n";case"\r":return"\\r";case"\t":return"\\t";case"\b":return"\\b";case"\f":return"\\f";case"\v":return s.ie8?"\\x0B":"\\v";case"\u2028":return"\\u2028";case"\u2029":return"\\u2029";case"\ufeff":return"\\ufeff";case"\0":return/[0-9]/.test(t.charAt(n+1))?"\\x00":"\\0"}return e}),t=p(t),s.quote_style){case 1:return n();case 2:return o();case 3:return"'"==e?n():o();default:return r<i?n():o()}}(e,n);return s.inline_script&&(t=(t=(t=t.replace(/<\x2f(script)([>\/\t\n\f\r ])/gi,"<\\/$1$2")).replace(/\x3c!--/g,"\\x3c!--")).replace(/--\x3e/g,"--\\x3e")),t}function i(e){return function e(n,t){if(t<=0)return"";if(1==t)return n;var i=e(n,t>>1);return i+=i,1&t&&(i+=n),i}(" ",s.indent_start+r-e*s.indent_level)}var d,h,v=!1,_=!1,m=0,g=!1,b=!1,y=-1,w="",x=s.source_map&&[],A=x?function(){x.forEach(function(n){try{s.source_map.add(n.token.file,n.line,n.col,n.token.line,n.token.col,n.name||"name"!=n.token.type?n.name:n.token.value)}catch(e){se.warn("Couldn't figure out mapping for {file}:{line},{col} → {cline},{ccol} [{name}]",{file:n.token.file,line:n.token.line,col:n.token.col,cline:n.line,ccol:n.col,name:n.name||""})}}),x=[]}:L,E=s.max_line_len?function(){if(a>s.max_line_len){if(m){var e=l.slice(0,m),n=l.slice(m);if(x){var t=n.length-a;x.forEach(function(e){e.line++,e.col+=t})}l=e+"\n"+n,c++,f++,a=n.length}a>s.max_line_len&&se.warn("Output exceeds {max_line_len} characters",s)}m&&(m=0,A())}:L,k=W("( [ + * / - , .");function D(e){var n=(e=String(e)).charAt(0);g&&n&&(g=!1,"\n"!=n&&(D("\n"),C())),b&&n&&(b=!1,/[\s;})]/.test(n)||F()),y=-1;var t=w.charAt(w.length-1);if(_&&(_=!1,(":"==t&&"}"==n||(!n||";}".indexOf(n)<0)&&";"!=t)&&(s.semicolons||k(n)?(l+=";",a++,f++):(E(),l+="\n",f++,c++,a=0,/^\s+$/.test(e)&&(_=!0)),s.beautify||(v=!1))),!s.beautify&&s.preserve_line&&q[q.length-1])for(var i=q[q.length-1].start.line;c<i;)E(),l+="\n",f++,c++,a=0,v=!1;v&&((jn(t)&&(jn(n)||"\\"==n)||"/"==n&&n==t||("+"==n||"-"==n)&&n==w)&&(l+=" ",a++,f++),v=!1),d&&(x.push({token:d,name:h,line:c,col:a}),d=!1,m||A()),l+=e,f+=e.length;var r=e.split(/\r?\n/),o=r.length-1;c+=o,a+=r[0].length,0<o&&(E(),a=r[o].length),w=e}var F=s.beautify?function(){D(" ")}:function(){v=!0},C=s.beautify?function(e){s.beautify&&D(i(e?.5:0))}:L,B=s.beautify?function(e,n){!0===e&&(e=$());var t=r;r=e;var i=n();return r=t,i}:function(e,n){return n()},S=s.beautify?function(){if(y<0)return D("\n");"\n"!=l[y]&&(l=l.slice(0,y)+"\n"+l.slice(y),f++,c++),y++}:s.max_line_len?function(){E(),m=l.length}:L,T=s.beautify?function(){D(";")}:function(){_=!0};function O(){_=!1,D(";")}function $(){return r+s.indent_level}function z(){return m&&E(),l}function M(){var e=l.lastIndexOf("\n");return/^ *$/.test(l.slice(e+1))}var q=[];return{get:z,toString:z,indent:C,indentation:function(){return r},current_width:function(){return a-r},should_break:function(){return s.width&&this.current_width()>=s.width},has_parens:function(){return"("==l.slice(-1)},newline:S,print:D,space:F,comma:function(){D(","),F()},colon:function(){D(":"),F()},last:function(){return w},semicolon:T,force_semicolon:O,to_utf8:p,print_name:function(e){var n;D((n=(n=e).toString(),n=p(n,!0)))},print_string:function(e,n,t){var i=o(e,n);!0===t&&-1===i.indexOf("\\")&&(Zn.test(l)||O(),O()),D(i)},encode_string:o,next_indent:$,with_indent:B,with_block:function(e){var n;return D("{"),S(),B($(),function(){n=e()}),C(),D("}"),n},with_parens:function(e){D("(");var n=e();return D(")"),n},with_square:function(e){D("[");var n=e();return D("]"),n},add_mapping:x?function(e,n){d=e,h=n}:L,option:function(e){return s[e]},prepend_comments:e?L:function(e){var i=this,n=e.start;if(n&&(!n.comments_before||n.comments_before._dumped!==i)){var r=n.comments_before;if(r||(r=n.comments_before=[]),r._dumped=i,e instanceof Se&&e.value){var o=new Sn(function(e){var n=o.parent();if(!(n instanceof Se||n instanceof nn&&n.left===e||"Call"==n.TYPE&&n.expression===e||n instanceof tn&&n.condition===e||n instanceof Xe&&n.expression===e||n instanceof We&&n.expressions[0]===e||n instanceof Ze&&n.expression===e||n instanceof en))return!0;var t=e.start.comments_before;t&&t._dumped!==i&&(t._dumped=i,r=r.concat(t))});o.push(e),e.value.walk(o)}if(0==f){0<r.length&&s.shebang&&"comment5"==r[0].type&&(D("#!"+r.shift().value+"\n"),C());var t=s.preamble;t&&D(t.replace(/\r\n?|[\n\u2028\u2029]|\s*$/g,"\n"))}if(0!=(r=r.filter(u,e)).length){var a=M();r.forEach(function(e,n){a||(e.nlb?(D("\n"),C(),a=!0):0<n&&F()),/comment[134]/.test(e.type)?(D("//"+e.value.replace(/[@#]__PURE__/g," ")+"\n"),C(),a=!0):"comment2"==e.type&&(D("/*"+e.value.replace(/[@#]__PURE__/g," ")+"*/"),a=!1)}),a||(n.nlb?(D("\n"),C()):F())}}},append_comments:e||u===ie?L:function(e,t){var n=e.end;if(n){var i=n[t?"comments_before":"comments_after"];if(i&&i._dumped!==this&&(e instanceof ue||oe(i,function(e){return!/comment[134]/.test(e.type)}))){i._dumped=this;var r=l.length;i.filter(u,e).forEach(function(e,n){b=!1,g?(D("\n"),C(),g=!1):e.nlb&&(0<n||!M())?(D("\n"),C()):(0<n||!t)&&F(),/comment[134]/.test(e.type)?(D("//"+e.value.replace(/[@#]__PURE__/g," ")),g=!0):"comment2"==e.type&&(D("/*"+e.value.replace(/[@#]__PURE__/g," ")+"*/"),b=!0)}),l.length>r&&(y=r)}}},line:function(){return c},col:function(){return a},pos:function(){return f},push_node:function(e){q.push(e)},pop_node:function(){return q.pop()},parent:function(e){return q[q.length-2-(e||0)]}}}function et(e,n){if(!(this instanceof et))return new et(e,n);Xn.call(this,this.before,this.after),this.options=Y(e,{arguments:!n,booleans:!n,collapse_vars:!n,comparisons:!n,conditionals:!n,dead_code:!n,drop_console:!1,drop_debugger:!n,evaluate:!n,expression:!1,global_defs:{},hoist_funs:!1,hoist_props:!n,hoist_vars:!1,ie8:!1,if_return:!n,inline:!n,join_vars:!n,keep_fargs:!0,keep_fnames:!1,keep_infinity:!1,loops:!n,negate_iife:!n,passes:1,properties:!n,pure_getters:!n&&"strict",pure_funcs:null,reduce_funcs:!n,reduce_vars:!n,sequences:!n,side_effects:!n,switches:!n,top_retain:null,toplevel:!(!e||!e.top_retain),typeofs:!n,unsafe:!1,unsafe_comps:!1,unsafe_Function:!1,unsafe_math:!1,unsafe_proto:!1,unsafe_regexp:!1,unsafe_undefined:!1,unused:!n,warnings:!1},!0);var t=this.options.global_defs;if("object"==typeof t)for(var i in t)/^@/.test(i)&&ae(t,i)&&(t[i.slice(1)]=Gn(t[i],{expression:!0}));!0===this.options.inline&&(this.options.inline=3);var r=this.options.pure_funcs;this.pure_funcs="function"==typeof r?r:r?function(e){return r.indexOf(e.expression.print_to_string())<0}:J;var o=this.options.top_retain;o instanceof RegExp?this.top_retain=function(e){return o.test(e.name)}:"function"==typeof o?this.top_retain=o:o&&("string"==typeof o&&(o=o.split(/,/)),this.top_retain=function(e){return 0<=o.indexOf(e.name)});var a=this.options.toplevel;this.toplevel="string"==typeof a?{funcs:/funcs/.test(a),vars:/vars/.test(a)}:{funcs:a,vars:a};var s=this.options.sequences;this.sequences_limit=1==s?800:0|s,this.warnings_produced={}}function b(e,n){e.walk(new Sn(function(e){return e instanceof We?b(e.tail_node(),n):e instanceof bn?n(e.value):e instanceof tn&&(b(e.consequent,n),b(e.alternative,n)),!0}))}function d(e,n){var t=(n=Y(n,{builtins:!1,cache:null,debug:!1,keep_quoted:!1,only_cache:!1,regex:null,reserved:null},!0)).reserved;Array.isArray(t)||(t=[]),n.builtins||function(n){function t(e){v(n,e)}["null","true","false","Infinity","-Infinity","undefined"].forEach(t),[Object,Array,Function,Number,String,Boolean,Error,Math,Date,RegExp].forEach(function(e){Object.getOwnPropertyNames(e).map(t),e.prototype&&Object.getOwnPropertyNames(e.prototype).map(t)})}(t);var i,r=-1;n.cache?(i=n.cache.props).each(function(e){v(t,e)}):i=new O;var o,a=n.regex,s=!1!==n.debug;s&&(o=!0===n.debug?"":n.debug);var u=[],c=[];return e.walk(new Sn(function(e){e instanceof un?p(e.key):e instanceof sn?p(e.key.name):e instanceof Xe?p(e.property):e instanceof Ze&&b(e.property,p)})),e.transform(new Xn(function(e){e instanceof un?e.key=d(e.key):e instanceof sn?e.key.name=d(e.key.name):e instanceof Xe?e.property=d(e.property):!n.keep_quoted&&e instanceof Ze&&(e.property=function t(e){return e.transform(new Xn(function(e){if(e instanceof We){var n=e.expressions.length-1;e.expressions[n]=t(e.expressions[n])}else e instanceof bn?e.value=d(e.value):e instanceof tn&&(e.consequent=t(e.consequent),e.alternative=t(e.alternative));return e}))}(e.property))}));function f(e){return!(0<=c.indexOf(e))&&(!(0<=t.indexOf(e))&&(n.only_cache?i.has(e):!/^-?[0-9]+(\.[0-9]+)?(e[+-][0-9]+)?$/.test(e)))}function l(e){return!(a&&!a.test(e))&&(!(0<=t.indexOf(e))&&(i.has(e)||0<=u.indexOf(e)))}function p(e){f(e)&&v(u,e),l(e)||v(c,e)}function d(e){if(!l(e))return e;var n=i.get(e);if(!n){if(s){var t="_$"+e+"$"+o+"_";f(t)&&(n=t)}if(!n)for(;!f(n=g(++r)););i.set(e,n)}return n}}!function(){function e(e,n){e.DEFMETHOD("_codegen",n)}var o=!1,a=null,s=null;function t(e,n){Array.isArray(e)?e.forEach(function(e){t(e,n)}):e.DEFMETHOD("needs_parens",n)}function i(e,t,i,n){var r=e.length-1;o=n,e.forEach(function(e,n){!0!==o||e instanceof fe||e instanceof he||e instanceof le&&e.body instanceof bn||(o=!1),e instanceof he||(i.indent(),e.print(i),n==r&&t||(i.newline(),t&&i.newline())),!0===o&&e instanceof le&&e.body instanceof bn&&(o=!1)}),o=!1}function r(e,n){n.print("{"),n.with_indent(n.next_indent(),function(){n.append_comments(e,!0)}),n.print("}")}function u(e,n,t){0<e.body.length?n.with_block(function(){i(e.body,!1,n,t)}):r(e,n)}function c(e,n,t){var i=!1;t&&e.walk(new Sn(function(e){return!!(i||e instanceof Ae)||(e instanceof nn&&"in"==e.operator?i=!0:void 0)})),e.print(n,i)}function f(e,n,t){t.option("quote_keys")?t.print_string(e):""+ +e==e&&0<=e?t.print(d(e)):(m(e)?!t.option("ie8"):Nn(e))?n&&t.option("keep_quoted_props")?t.print_string(e,n):t.print_name(e):t.print_string(e,n)}function l(e,n){n.option("braces")?h(e,n):!e||e instanceof he?n.force_semicolon():e.print(n)}function p(e,n){return 0<e.args.length||n.option("beautify")}function d(e){var n,t=e.toString(10),i=[t.replace(/^0\./,".").replace("e+","e")];return Math.floor(e)===e?(0<=e?i.push("0x"+e.toString(16).toLowerCase(),"0"+e.toString(8)):i.push("-0x"+(-e).toString(16).toLowerCase(),"-0"+(-e).toString(8)),(n=/^(.*?)(0+)$/.exec(e))&&i.push(n[1]+"e"+n[2].length)):(n=/^0?\.(0+)(.*)$/.exec(e))&&i.push(n[2]+"e-"+(n[1].length+n[2].length),t.substr(t.indexOf("."))),function(e){for(var n=e[0],t=n.length,i=1;i<e.length;++i)e[i].length<t&&(t=(n=e[i]).length);return n}(i)}function h(e,n){!e||e instanceof he?n.print("{}"):e instanceof de?e.print(n):n.with_block(function(){n.indent(),e.print(n),n.newline()})}function n(e,n){e.DEFMETHOD("add_source_map",function(e){n(this,e)})}function v(e,n){n.add_mapping(e.start)}se.DEFMETHOD("print",function(e,n){var t=this,i=t._codegen;function r(){e.prepend_comments(t),t.add_source_map(e),i(t,e),e.append_comments(t)}t instanceof Ae?a=t:!s&&t instanceof fe&&"use asm"==t.value&&(s=a),e.push_node(t),n||t.needs_parens(e)?e.with_parens(r):r(),e.pop_node(),t===s&&(s=null)}),se.DEFMETHOD("_print",se.prototype.print),se.DEFMETHOD("print_to_string",function(e){var n=Qn(e);return this.print(n),n.get()}),t(se,ie),t(Fe,function(e){if(!e.has_parens()&&$(e))return!0;var n;if(e.option("webkit")&&((n=e.parent())instanceof Ge&&n.expression===this))return!0;return!!e.option("wrap_iife")&&((n=e.parent())instanceof Ye&&n.expression===this)}),t(an,function(e){return!e.has_parens()&&$(e)}),t(Ke,function(e){var n=e.parent();return n instanceof Ge&&n.expression===this||n instanceof Ye&&n.expression===this}),t(We,function(e){var n=e.parent();return n instanceof Ye||n instanceof Ke||n instanceof nn||n instanceof Ve||n instanceof Ge||n instanceof on||n instanceof sn||n instanceof tn}),t(nn,function(e){var n=e.parent();if(n instanceof Ye&&n.expression===this)return!0;if(n instanceof Ke)return!0;if(n instanceof Ge&&n.expression===this)return!0;if(n instanceof nn){var t=n.operator,i=Jn[t],r=this.operator,o=Jn[r];if(o<i||i==o&&this===n.right)return!0}}),t(Ge,function(e){var n=e.parent();if(n instanceof Je&&n.expression===this){var t=!1;return this.walk(new Sn(function(e){return!!(t||e instanceof Ae)||(e instanceof Ye?t=!0:void 0)})),t}}),t(Ye,function(e){var n,t=e.parent();return t instanceof Je&&t.expression===this||this.expression instanceof Fe&&t instanceof Ge&&t.expression===this&&(n=e.parent(1))instanceof rn&&n.left===t}),t(Je,function(e){var n=e.parent();if(!p(this,e)&&(n instanceof Ge||n instanceof Ye&&n.expression===this))return!0}),t(yn,function(e){var n=e.parent();if(n instanceof Ge&&n.expression===this){var t=this.getValue();if(t<0||/^0/.test(d(t)))return!0}}),t([rn,tn],function(e){var n=e.parent();return n instanceof Ke||(n instanceof nn&&!(n instanceof rn)||(n instanceof Ye&&n.expression===this||(n instanceof tn&&n.condition===this||(n instanceof Ge&&n.expression===this||void 0))))}),e(fe,function(e,n){n.print_string(e.value,e.quote),n.semicolon()}),e(ce,function(e,n){n.print("debugger"),n.semicolon()}),_.DEFMETHOD("_do_print_body",function(e){l(this.body,e)}),e(ue,function(e,n){e.body.print(n),n.semicolon()}),e(Ee,function(e,n){i(e.body,!0,n,!0),n.print("")}),e(ve,function(e,n){e.label.print(n),n.colon(),e.body.print(n)}),e(le,function(e,n){e.body.print(n),n.semicolon()}),e(de,function(e,n){u(e,n)}),e(he,function(e,n){n.semicolon()}),e(ge,function(e,n){n.print("do"),n.space(),h(e.body,n),n.space(),n.print("while"),n.space(),n.with_parens(function(){e.condition.print(n)}),n.semicolon()}),e(be,function(e,n){n.print("while"),n.space(),n.with_parens(function(){e.condition.print(n)}),n.space(),e._do_print_body(n)}),e(ye,function(e,n){n.print("for"),n.space(),n.with_parens(function(){e.init?(e.init instanceof Ue?e.init.print(n):c(e.init,n,!0),n.print(";"),n.space()):n.print(";"),e.condition?(e.condition.print(n),n.print(";"),n.space()):n.print(";"),e.step&&e.step.print(n)}),n.space(),e._do_print_body(n)}),e(we,function(e,n){n.print("for"),n.space(),n.with_parens(function(){e.init.print(n),n.space(),n.print("in"),n.space(),e.object.print(n)}),n.space(),e._do_print_body(n)}),e(xe,function(e,n){n.print("with"),n.space(),n.with_parens(function(){e.expression.print(n)}),n.space(),e._do_print_body(n)}),ke.DEFMETHOD("_do_print",function(t,e){var n=this;e||t.print("function"),n.name&&(t.space(),n.name.print(t)),t.with_parens(function(){n.argnames.forEach(function(e,n){n&&t.comma(),e.print(t)})}),t.space(),u(n,t,!0)}),e(ke,function(e,n){e._do_print(n)}),Se.DEFMETHOD("_do_print",function(e,n){e.print(n),this.value&&(e.space(),this.value.print(e)),e.semicolon()}),e(Te,function(e,n){e._do_print(n,"return")}),e(G,function(e,n){e._do_print(n,"throw")}),Oe.DEFMETHOD("_do_print",function(e,n){e.print(n),this.label&&(e.space(),this.label.print(e)),e.semicolon()}),e($e,function(e,n){e._do_print(n,"break")}),e(ze,function(e,n){e._do_print(n,"continue")}),e(Me,function(e,n){n.print("if"),n.space(),n.with_parens(function(){e.condition.print(n)}),n.space(),e.alternative?(!function(e,n){var t=e.body;if(n.option("braces")||n.option("ie8")&&t instanceof ge)return h(t,n);if(!t)return n.force_semicolon();for(;;)if(t instanceof Me){if(!t.alternative)return h(e.body,n);t=t.alternative}else{if(!(t instanceof _))break;t=t.body}l(e.body,n)}(e,n),n.space(),n.print("else"),n.space(),e.alternative instanceof Me?e.alternative.print(n):l(e.alternative,n)):e._do_print_body(n)}),e(qe,function(e,t){t.print("switch"),t.space(),t.with_parens(function(){e.expression.print(t)}),t.space();var i=e.body.length-1;i<0?r(e,t):t.with_block(function(){e.body.forEach(function(e,n){t.indent(!0),e.print(t),n<i&&0<e.body.length&&t.newline()})})}),je.DEFMETHOD("_do_print_body",function(n){n.newline(),this.body.forEach(function(e){n.indent(),e.print(n),n.newline()})}),e(Ne,function(e,n){n.print("default:"),e._do_print_body(n)}),e(He,function(e,n){n.print("case"),n.space(),e.expression.print(n),n.print(":"),e._do_print_body(n)}),e(Re,function(e,n){n.print("try"),n.space(),u(e,n),e.bcatch&&(n.space(),e.bcatch.print(n)),e.bfinally&&(n.space(),e.bfinally.print(n))}),e(Ie,function(e,n){n.print("catch"),n.space(),n.with_parens(function(){e.argname.print(n)}),n.space(),u(e,n)}),e(Pe,function(e,n){n.print("finally"),n.space(),u(e,n)}),Ue.DEFMETHOD("_do_print",function(t,e){t.print(e),t.space(),this.definitions.forEach(function(e,n){n&&t.comma(),e.print(t)});var n=t.parent();(n instanceof ye||n instanceof we)&&n.init===this||t.semicolon()}),e(Le,function(e,n){e._do_print(n,"var")}),e(Ve,function(e,n){if(e.name.print(n),e.value){n.space(),n.print("="),n.space();var t=n.parent(1),i=t instanceof ye||t instanceof we;c(e.value,n,i)}}),e(Ye,function(e,t){e.expression.print(t),e instanceof Je&&!p(e,t)||((e.expression instanceof Ye||e.expression instanceof ke)&&t.add_mapping(e.start),t.with_parens(function(){e.args.forEach(function(e,n){n&&t.comma(),e.print(t)})}))}),e(Je,function(e,n){n.print("new"),n.space(),Ye.prototype._codegen(e,n)}),We.DEFMETHOD("_do_print",function(t){this.expressions.forEach(function(e,n){0<n&&(t.comma(),t.should_break()&&(t.newline(),t.indent())),e.print(t)})}),e(We,function(e,n){e._do_print(n)}),e(Xe,function(e,n){var t=e.expression;t.print(n);var i=e.property;n.option("ie8")&&m(i)?(n.print("["),n.add_mapping(e.end),n.print_string(i),n.print("]")):(t instanceof yn&&0<=t.getValue()&&(/[xa-f.)]/i.test(n.last())||n.print(".")),n.print("."),n.add_mapping(e.end),n.print_name(i))}),e(Ze,function(e,n){e.expression.print(n),n.print("["),e.property.print(n),n.print("]")}),e(Qe,function(e,n){var t=e.operator;n.print(t),(/^[a-z]/i.test(t)||/[+-]$/.test(t)&&e.expression instanceof Qe&&/^[+-]/.test(e.expression.operator))&&n.space(),e.expression.print(n)}),e(en,function(e,n){e.expression.print(n),n.print(e.operator)}),e(nn,function(e,n){var t=e.operator;e.left.print(n),">"==t[0]&&e.left instanceof en&&"--"==e.left.operator?n.print(" "):n.space(),n.print(t),("<"==t||"<<"==t)&&e.right instanceof Qe&&"!"==e.right.operator&&e.right.expression instanceof Qe&&"--"==e.right.expression.operator?n.print(" "):n.space(),e.right.print(n)}),e(tn,function(e,n){e.condition.print(n),n.space(),n.print("?"),n.space(),e.consequent.print(n),n.space(),n.colon(),e.alternative.print(n)}),e(on,function(n,i){i.with_square(function(){var e=n.elements,t=e.length;0<t&&i.space(),e.forEach(function(e,n){n&&i.comma(),e.print(i),n===t-1&&e instanceof kn&&i.comma()}),0<t&&i.space()})}),e(an,function(e,t){0<e.properties.length?t.with_block(function(){e.properties.forEach(function(e,n){n&&(t.print(","),t.newline()),t.indent(),e.print(t)}),t.newline()}):r(e,t)}),e(un,function(e,n){f(e.key,e.quote,n),n.colon(),e.value.print(n)}),sn.DEFMETHOD("_print_getter_setter",function(e,n){n.print(e),n.space(),f(this.key.name,this.quote,n),this.value._do_print(n,!0)}),e(X,function(e,n){e._print_getter_setter("set",n)}),e(Z,function(e,n){e._print_getter_setter("get",n)}),e(cn,function(e,n){var t=e.definition();n.print_name(t?t.mangled_name||t.name:e.name)}),e(kn,L),e(mn,function(e,n){n.print("this")}),e(gn,function(e,n){n.print(e.getValue())}),e(bn,function(e,n){n.print_string(e.getValue(),e.quote,o)}),e(yn,function(e,n){s&&e.start&&null!=e.start.raw?n.print(e.start.raw):n.print(d(e.getValue()))}),e(wn,function(e,n){var t=e.getValue(),i=t.toString();t.raw_source&&(i="/"+t.raw_source+i.slice(i.lastIndexOf("/"))),i=n.to_utf8(i),n.print(i);var r=n.parent();r instanceof nn&&/^in/.test(r.operator)&&r.left===e&&n.print(" ")}),n(se,L),n(fe,v),n(ce,v),n(cn,v),n(Be,v),n(_,v),n(ve,L),n(ke,v),n(qe,v),n(je,v),n(de,v),n(Ee,L),n(Je,v),n(Re,v),n(Ie,v),n(Pe,v),n(Ue,v),n(gn,v),n(X,function(e,n){n.add_mapping(e.start,e.key.name)}),n(Z,function(e,n){n.add_mapping(e.start,e.key.name)}),n(sn,function(e,n){n.add_mapping(e.start,e.key)})}(),t(et.prototype=new Xn,{option:function(e){return this.options[e]},exposed:function(e){if(e.global)for(var n=0,t=e.orig.length;n<t;n++)if(!this.toplevel[e.orig[n]instanceof dn?"funcs":"vars"])return!0;return!1},compress:function(e){this.option("expression")&&e.process_expression(!0);for(var n=+this.options.passes||1,t=1/0,i=!1,r={ie8:this.option("ie8")},o=0;o<n;o++)if(e.figure_out_scope(r),(0<o||this.option("reduce_vars"))&&e.reset_opt_flags(this),e=e.transform(this),1<n){var a=0;if(e.walk(new Sn(function(){a++})),this.info("pass "+o+": last_count: "+t+", count: "+a),a<t)t=a,i=!1;else{if(i)break;i=!0}}return this.option("expression")&&e.process_expression(!1),e},info:function(){"verbose"==this.options.warnings&&se.warn.apply(se,arguments)},warn:function(e,n){if(this.options.warnings){var t=S(e,n);t in this.warnings_produced||(this.warnings_produced[t]=!0,se.warn.apply(se,arguments))}},clear_warnings:function(){this.warnings_produced={}},before:function(e,n,t){if(e._squeezed)return e;var i=!1;e instanceof Ae&&(e=(e=e.hoist_properties(this)).hoist_declarations(this),i=!0),n(e,this),n(e,this);var r=e.optimize(this);return i&&r instanceof Ae&&(r.drop_unused(this),n(r,this)),r===e&&(r._squeezed=!0),r}}),function(){function e(e,t){e.DEFMETHOD("optimize",function(e){if(this._optimized)return this;if(e.has_directive("use asm"))return this;var n=t(this,e);return n._optimized=!0,n})}function G(e){if(e instanceof mn)return!0;if(e instanceof _n)return e.definition().orig[0]instanceof hn;if(e instanceof Ge){if((e=e.expression)instanceof _n){if(e.is_immutable())return!1;e=e.fixed_value()}return!e||(!!e.is_constant()||G(e))}return!1}function o(e,n){for(var t,i=0;(t=e.parent(i++))&&!(t instanceof Ae);)if(t instanceof Ie){t=t.argname.definition().scope;break}return t.find_variable(n)}function X(e,n,t){return t||(t={}),n&&(t.start||(t.start=n.start),t.end||(t.end=n.end)),new e(t)}function M(e,n){return 1==n.length?n[0]:X(We,e,{expressions:n.reduce(l,[])})}function q(e,n){switch(typeof e){case"string":return X(bn,n,{value:e});case"number":return isNaN(e)?X(An,n):isFinite(e)?1/e<0?X(Qe,n,{operator:"-",expression:X(yn,n,{value:-e})}):X(yn,n,{value:e}):e<0?X(Qe,n,{operator:"-",expression:X(Dn,n)}):X(Dn,n);case"boolean":return X(e?Bn:Cn,n);case"undefined":return X(En,n);default:if(null===e)return X(xn,n,{value:null});if(e instanceof RegExp)return X(wn,n,{value:e});throw new Error(S("Can't handle constant of type: {type}",{type:typeof e}))}}function Z(e,n,t){return e instanceof Qe&&"delete"==e.operator||e instanceof Ye&&e.expression===n&&(t instanceof Ge||t instanceof _n&&"eval"==t.name)?M(n,[X(yn,n,{value:0}),t]):t}function l(e,n){return n instanceof We?e.push.apply(e,n.expressions):e.push(n),e}function b(e){if(null===e)return[];if(e instanceof de)return e.body;if(e instanceof he)return[];if(e instanceof ue)return[e];throw new Error("Can't convert thing to statement array")}function j(e){return null===e||(e instanceof he||e instanceof de&&0==e.body.length)}function y(e){return e instanceof _e&&e.body instanceof de?e.body:e}function K(e){for(;e instanceof Ge;)e=e.expression;return e}function N(e){return"Call"==e.TYPE&&(e.expression instanceof Fe||N(e.expression))}function H(e){return e instanceof _n&&e.definition().undeclared}e(se,function(e,n){return e}),se.DEFMETHOD("equivalent_to",function(e){return this.TYPE==e.TYPE&&this.print_to_string()==e.print_to_string()}),Ae.DEFMETHOD("process_expression",function(i,r){var o=this,a=new Xn(function(e){if(i&&e instanceof le)return X(Te,e,{value:e.body});if(!i&&e instanceof Te){if(r){var n=e.value&&e.value.drop_side_effect_free(r,!0);return n?X(le,e,{body:n}):X(he,e)}return X(le,e,{body:e.value||X(Qe,e,{operator:"void",expression:X(yn,e,{value:0})})})}if(e instanceof ke&&e!==o)return e;if(e instanceof pe){var t=e.body.length-1;0<=t&&(e.body[t]=e.body[t].transform(a))}else e instanceof Me?(e.body=e.body.transform(a),e.alternative&&(e.alternative=e.alternative.transform(a))):e instanceof xe&&(e.body=e.body.transform(a));return e});o.transform(a)}),function(e){function i(e,n){n.assignments=0,n.chained=!1,n.direct_access=!1,n.escaped=!1,n.scope.uses_eval||n.scope.uses_with?n.fixed=!1:e.exposed(n)?n.fixed=!1:n.fixed=n.init,n.recursive_refs=0,n.references=[],n.should_replace=void 0,n.single_use=void 0}function a(n,t,e){e.variables.each(function(e){i(t,e),null===e.fixed?(e.safe_ids=n.safe_ids,c(n,e,!0)):e.fixed&&(n.loop_ids[e.id]=n.in_loop,c(n,e,!0))})}function s(e){e.safe_ids=Object.create(e.safe_ids)}function u(e){e.safe_ids=Object.getPrototypeOf(e.safe_ids)}function c(e,n,t){e.safe_ids[n.id]=t}function f(e,n){if(e.safe_ids[n.id]){if(null==n.fixed){var t=n.orig[0];if(t instanceof pn||"arguments"==t.name)return!1;n.fixed=X(En,t)}return!0}return n.fixed instanceof Ce}function o(e,n,t){return void 0===n.fixed||(null===n.fixed&&n.safe_ids?(n.safe_ids[n.id]=!1,delete n.safe_ids,!0):!!ae(e.safe_ids,n.id)&&(!!f(e,n)&&(!1!==n.fixed&&(!(null!=n.fixed&&(!t||n.references.length>n.assignments))&&oe(n.orig,function(e){return!(e instanceof dn||e instanceof hn)})))))}function l(e,n){if(!((n=p(n))instanceof se)){var t;if(e instanceof on){var i=e.elements;if("length"==n)return q(i.length,e);"number"==typeof n&&n in i&&(t=i[n])}else if(e instanceof an){n=""+n;for(var r=e.properties,o=r.length;0<=--o;){if(!(r[o]instanceof un))return;t||r[o].key!==n||(t=r[o].value)}}return t instanceof _n&&t.fixed_value()||t}}e(se,L);var t=new Sn(function(e){if(e instanceof cn){var n=e.definition();n&&(e instanceof _n&&n.references.push(e),n.fixed=!1)}});e(De,function(e,n,t){return s(e),a(e,t,this),n(),u(e),!0}),e(rn,function(e){var n=this;if(n.left instanceof _n){var t=n.left.definition(),i=t.fixed;if((i||"="==n.operator)&&o(e,t,n.right))return t.references.push(n.left),t.assignments++,"="!=n.operator&&(t.chained=!0),t.fixed="="==n.operator?function(){return n.right}:function(){return X(nn,n,{operator:n.operator.slice(0,-1),left:i instanceof se?i:i(),right:n.right})},c(e,t,!1),n.right.walk(e),c(e,t,!0),!0}}),e(nn,function(e){if(ee(this.operator))return this.left.walk(e),s(e),this.right.walk(e),u(e),!0}),e(He,function(e){return s(e),this.expression.walk(e),u(e),s(e),z(this,e),u(e),!0}),e(tn,function(e){return this.condition.walk(e),s(e),this.consequent.walk(e),u(e),s(e),this.alternative.walk(e),u(e),!0}),e(Ne,function(e,n){return s(e),n(),u(e),!0}),e(Ce,function(e,n,t){this.inlined=!1;var i=e.safe_ids;return e.safe_ids=Object.create(null),a(e,t,this),n(),e.safe_ids=i,!0}),e(ge,function(e){var n=e.in_loop;return e.in_loop=this,s(e),this.body.walk(e),this.condition.walk(e),u(e),e.in_loop=n,!0}),e(ye,function(e){this.init&&this.init.walk(e);var n=e.in_loop;return(e.in_loop=this).condition&&(s(e),this.condition.walk(e),u(e)),s(e),this.body.walk(e),u(e),this.step&&(s(e),this.step.walk(e),u(e)),e.in_loop=n,!0}),e(we,function(e){this.init.walk(t),this.object.walk(e);var n=e.in_loop;return e.in_loop=this,s(e),this.body.walk(e),u(e),e.in_loop=n,!0}),e(Fe,function(i,e,n){var r,o=this;return o.inlined=!1,s(i),a(i,n,o),!o.name&&(r=i.parent())instanceof Ye&&r.expression===o&&o.argnames.forEach(function(e,n){var t=e.definition();o.uses_arguments||void 0!==t.fixed?t.fixed=!1:(t.fixed=function(){return r.args[n]||X(En,r)},i.loop_ids[t.id]=i.in_loop,c(i,t,!0))}),e(),u(i),!0}),e(Me,function(e){return this.condition.walk(e),s(e),this.body.walk(e),u(e),this.alternative&&(s(e),this.alternative.walk(e),u(e)),!0}),e(ve,function(e){return s(e),this.body.walk(e),u(e),!0}),e(vn,function(){this.definition().fixed=!1}),e(_n,function(e,n,t){var i,r,o,a,s=this.definition();s.references.push(this),1==s.references.length&&!s.fixed&&s.orig[0]instanceof dn&&(e.loop_ids[s.id]=e.in_loop),void 0!==s.fixed&&f(e,s)&&"m"!=s.single_use?s.fixed&&((i=this.fixed_value())instanceof ke&&P(e,s)?s.recursive_refs++:i&&(o=e,a=s,t.option("unused")&&!a.scope.uses_eval&&!a.scope.uses_with&&a.references.length-a.recursive_refs==1&&o.loop_ids[a.id]===o.in_loop)?s.single_use=i instanceof ke||s.scope===this.scope&&i.is_constant_expression():s.single_use=!1,function e(n,t,i,r,o){var a=n.parent(r);if(ne(t,a)||!o&&a instanceof Ye&&a.expression===t&&(!(i instanceof Fe)||!(a instanceof Je)&&i.contains_this()))return!0;if(a instanceof on)return e(n,a,a,r+1);if(a instanceof un&&t===a.value){var s=n.parent(r+1);return e(n,s,s,r+2)}return a instanceof Ge&&a.expression===t?!o&&e(n,a,l(i,a.property),r+1):void 0}(e,this,i,0,!!(r=i)&&(r.is_constant()||r instanceof ke||r instanceof mn))&&(s.single_use?s.single_use="m":s.fixed=!1)):s.fixed=!1,function e(n,t,i,r,o,a,s){var u=n.parent(a);if(!o||!o.is_constant()){if(u instanceof rn&&"="==u.operator&&r===u.right||u instanceof Ye&&r!==u.expression||u instanceof Se&&r===u.value&&r.scope!==t.scope||u instanceof Ve&&r===u.value)return!(1<s)||o&&o.is_constant_expression(i)||(s=1),void((!t.escaped||t.escaped>s)&&(t.escaped=s));if(u instanceof on||u instanceof nn&&ee(u.operator)||u instanceof tn&&r!==u.condition||u instanceof We&&r===u.tail_node())e(n,t,i,u,u,a+1,s);else if(u instanceof un&&r===u.value){var c=n.parent(a+1);e(n,t,i,c,c,a+2,s)}else if(u instanceof Ge&&r===u.expression&&(e(n,t,i,u,o=l(o,u.property),a+1,s+1),o))return;0==a&&(t.direct_access=!0)}}(e,s,this.scope,this,i,0,1)}),e(Ee,function(e,n,t){this.globals.each(function(e){i(t,e)}),a(e,t,this)}),e(Re,function(e){return s(e),z(this,e),u(e),this.bcatch&&(s(e),this.bcatch.walk(e),u(e)),this.bfinally&&this.bfinally.walk(e),!0}),e(Ke,function(e,n){var t=this;if(("++"==t.operator||"--"==t.operator)&&t.expression instanceof _n){var i=t.expression.definition(),r=i.fixed;if(r&&o(e,i,!0))return i.references.push(t.expression),i.assignments++,i.chained=!0,i.fixed=function(){return X(nn,t,{operator:t.operator.slice(0,-1),left:X(Qe,t,{operator:"+",expression:r instanceof se?r:r()}),right:X(yn,t,{value:1})})},c(e,i,!0),!0}}),e(Ve,function(e,n){var t=this,i=t.name.definition();if(t.value){if(o(e,i,t.value))return i.fixed=function(){return t.value},e.loop_ids[i.id]=e.in_loop,c(e,i,!1),n(),c(e,i,!0),!0;i.fixed=!1}}),e(be,function(e){var n=e.in_loop;return e.in_loop=this,s(e),this.condition.walk(e),this.body.walk(e),u(e),e.in_loop=n,!0})}(function(e,n){e.DEFMETHOD("reduce_vars",n)}),Ee.DEFMETHOD("reset_opt_flags",function(t){var i=t.option("reduce_vars"),r=new Sn(function(e,n){if(e._squeezed=!1,e._optimized=!1,i)return e.reduce_vars(r,n,t)});r.safe_ids=Object.create(null),r.in_loop=null,r.loop_ids=Object.create(null),this.walk(r)}),cn.DEFMETHOD("fixed_value",function(){var e=this.definition().fixed;return!e||e instanceof se?e:e()}),_n.DEFMETHOD("is_immutable",function(){var e=this.definition().orig;return 1==e.length&&e[0]instanceof hn});var n=W("Array Boolean clearInterval clearTimeout console Date decodeURI decodeURIComponent encodeURI encodeURIComponent Error escape eval EvalError Function isFinite isNaN JSON Math Number parseFloat parseInt RangeError ReferenceError RegExp Object setInterval setTimeout String SyntaxError TypeError unescape URIError");_n.DEFMETHOD("is_declared",function(e){return!this.definition().undeclared||e.option("unsafe")&&n(this.name)});var t,i,r,a,s,R=W("Infinity NaN undefined");function Q(e){return e instanceof Dn||e instanceof An||e instanceof En}function u(e,c){var V,Y,J;!function(){var e=c.self(),n=0;do{if(e instanceof Ie||e instanceof Pe)n++;else if(e instanceof _e)V=!0;else{if(e instanceof Ae){J=e;break}e instanceof Re&&(Y=!0)}}while(e=c.parent(n++))}();for(var W,n=10;W=!1,r(e),c.option("dead_code")&&o(e,c),c.option("if_return")&&i(e,c),0<c.sequences_limit&&(a(e,c),s(e,c)),c.option("join_vars")&&u(e),c.option("collapse_vars")&&t(e,c),W&&0<n--;);function t(t,c){if(J.uses_eval||J.uses_with)return t;for(var f,e,n,l=[],o=t.length,a=new Xn(function(e){if(D)return e;if(!k)return e!==s[u]?e:++u<s.length?O(e):(k=!0,(h=function e(n,t,i){var r=a.parent(t);if(r instanceof rn)return i&&!(r.left instanceof Ge||r.left.name in y)?e(r,t+1,i):n;if(r instanceof nn)return!i||ee(r.operator)&&r.left!==n?n:e(r,t+1,i);if(r instanceof Ye)return n;if(r instanceof He)return n;if(r instanceof tn)return i&&r.condition===n?e(r,t+1,i):n;if(r instanceof Ue)return e(r,t+1,!0);if(r instanceof Se)return i?e(r,t+1,i):n;if(r instanceof Me)return i&&r.condition===n?e(r,t+1,i):n;if(r instanceof _e)return n;if(r instanceof We)return e(r,t+1,r.tail_node()!==n);if(r instanceof le)return e(r,t+1,!0);if(r instanceof qe)return n;if(r instanceof Ke)return n;if(r instanceof Ve)return n;return null}(e,0))===e&&(D=!0),e);var n,t,i=a.parent();if(e instanceof rn&&"="!=e.operator&&_.equivalent_to(e.left)||e instanceof Ye&&_ instanceof Ge&&_.equivalent_to(e.expression)||e instanceof ce||e instanceof _e&&!(e instanceof ye)||e instanceof Oe||e instanceof Re||e instanceof xe||i instanceof ye&&e!==i.init||!x&&e instanceof _n&&!e.is_declared(c))return D=!0,e;if(!v&&(i instanceof nn&&ee(i.operator)&&i.left!==e||i instanceof tn&&i.condition!==e||i instanceof Me&&i.condition!==e)&&(v=i),C&&!(e instanceof fn)&&(g&&_.equivalent_to(e)||b&&(n=b(e,this)))){if(v&&(n||!w||!x))return D=!0,e;if(ne(e,i))return d&&F++,e;if(W=D=!0,F++,c.info("Collapsing {name} [{file}:{line},{col}]",{name:e.print_to_string(),file:e.start.file,line:e.start.line,col:e.start.col}),p instanceof en)return X(Qe,p,p);if(p instanceof Ve){if(d)return D=!1,e;var r=p.name.definition(),o=p.value;return r.references.length-r.replaced!=1||c.exposed(r)?X(rn,p,{operator:"=",left:X(_n,p.name,p.name),right:o}):(r.replaced++,E&&Q(o)?o.transform(c):Z(i,e,o))}return p.write_only=!1,p}return(e instanceof Ye||e instanceof Se&&(m||_ instanceof Ge||L(_))||e instanceof Ge&&(m||e.expression.may_throw_on_access(c))||e instanceof _n&&(function(e){var n=y[e.name];if(!n)return;if(n!==_)return!0;b=!1}(e)||m&&L(e))||e instanceof Ve&&e.value&&(e.name.name in y||m&&L(e.name))||(t=ne(e.left,e))&&(t instanceof Ge||t.name in y)||A&&(Y?e.has_side_effects(c):function e(n,t){if(n instanceof rn)return e(n.left,!0);if(n instanceof Ke)return e(n.expression,!0);if(n instanceof Ve)return n.value&&e(n.value);if(t){if(n instanceof Xe)return e(n.expression,!0);if(n instanceof Ze)return e(n.expression,!0);if(n instanceof _n)return n.definition().scope!==J}return!1}(e)))&&(h=e)instanceof Ae&&(D=!0),O(e)},function(e){D||(h===e&&(D=!0),v===e&&(v=null))}),i=new Xn(function(e){if(D)return e;if(!k){if(e!==s[u])return e;if(++u<s.length)return;return k=!0,e}return e instanceof _n&&e.name==T.name?(--F||(D=!0),ne(e,i.parent())?e:(T.replaced++,d.replaced--,p.value)):e instanceof Ne||e instanceof Ae?e:void 0});0<=--o;){0==o&&c.option("unused")&&$();var s=[];for(z(t[o]);0<l.length;){s=l.pop();var u=0,p=s[s.length-1],d=null,h=null,v=null,_=M(p),r=q(p),m=_&&_.has_side_effects(c),g=_&&!m&&!G(_),b=r&&j(r);if(g||b){var y=R(p),w=(n=void 0,(n=K(e=_))instanceof _n&&n.definition().scope===J&&!(V&&(n.name in y&&y[n.name]!==e||p instanceof Ke||p instanceof rn&&"="!=p.operator)));m||(m=P(p));var x=U(),A=p.may_throw(c),E=p.name instanceof pn,k=E,D=!1,F=0,C=!f||!k;if(!C){for(var B=c.self().argnames.lastIndexOf(p.name)+1;!D&&B<f.length;B++)f[B].transform(a);C=!0}for(var S=o;!D&&S<t.length;S++)t[S].transform(a);if(d){var T=p.name.definition();if(D&&T.references.length-T.replaced>F)F=!1;else{D=!1,u=0,k=E;for(S=o;!D&&S<t.length;S++)t[S].transform(i);d.single_use=!1}}F&&!I(p)&&t.splice(o,1)}}}function O(e){if(e instanceof Ae)return e;if(e instanceof qe){e.expression=e.expression.transform(a);for(var n=0,t=e.body.length;!D&&n<t;n++){var i=e.body[n];if(i instanceof He){if(!k){if(i!==s[u])continue;u++}if(i.expression=i.expression.transform(a),!x)break}}return D=!0,e}}function $(){var e,t=c.self();if(t instanceof Fe&&!t.name&&!t.uses_arguments&&!t.uses_eval&&(e=c.parent())instanceof Ye&&e.expression===t){var i=c.has_directive("use strict");i&&!te(i,t.body)&&(i=!1);var n=t.argnames.length;f=e.args.slice(n);for(var r=Object.create(null),o=n;0<=--o;){var a=t.argnames[o],s=e.args[o];if(f.unshift(X(Ve,a,{name:a,value:s})),!(a.name in r)){if(r[a.name]=!0,s){var u=new Sn(function(e){if(!s)return!0;if(e instanceof _n&&t.variables.has(e.name)){var n=e.definition().scope;if(n!==J)for(;n=n.parent_scope;)if(n===J)return!0;s=null}return e instanceof mn&&(i||!u.find_parent(Ae))?!(s=null):void 0});s.walk(u)}else s=X(En,a).transform(c);s&&l.unshift([X(Ve,a,{name:a,value:s})])}}}}function z(e){s.push(e),e instanceof rn?(l.push(s.slice()),z(e.right)):e instanceof nn?(z(e.left),z(e.right)):e instanceof Ye?(z(e.expression),e.args.forEach(z)):e instanceof He?z(e.expression):e instanceof tn?(z(e.condition),z(e.consequent),z(e.alternative)):e instanceof Ue?e.definitions.forEach(z):e instanceof me?(z(e.condition),e.body instanceof pe||z(e.body)):e instanceof Se?e.value&&z(e.value):e instanceof ye?(e.init&&z(e.init),e.condition&&z(e.condition),e.step&&z(e.step),e.body instanceof pe||z(e.body)):e instanceof we?(z(e.object),e.body instanceof pe||z(e.body)):e instanceof Me?(z(e.condition),e.body instanceof pe||z(e.body),!e.alternative||e.alternative instanceof pe||z(e.alternative)):e instanceof We?e.expressions.forEach(z):e instanceof le?z(e.body):e instanceof qe?(z(e.expression),e.body.forEach(z)):e instanceof Ke?"++"==e.operator||"--"==e.operator?l.push(s.slice()):z(e.expression):e instanceof Ve&&e.value&&(l.push(s.slice()),z(e.value)),s.pop()}function M(e){if(!(e instanceof Ve))return e[e instanceof rn?"left":"expression"];var n=e.name.definition();if(te(e.name,n.orig)){var t=n.orig.length-n.eliminated,i=n.references.length-n.replaced;return 1<t&&!(e.name instanceof pn)||(1<i?function(e){var n=e.value;if(n instanceof _n&&"arguments"!=n.name){var t=n.definition();if(!t.undeclared)return d=t}}(e):!c.exposed(n))?X(_n,e.name,e.name):void 0}}function q(e){if(p instanceof rn&&"="==p.operator)return p.right}function j(e){if(e instanceof _n){var n=e.evaluate(c);return n===e?N:H(n,N)}if(e instanceof mn)return N;if(e.is_truthy())return H(!0,ie);if(e.is_constant())return H(e.evaluate(c),N);if(!(_ instanceof _n))return!1;if(e.has_side_effects(c))return!1;var t,i=_.definition();return e.walk(new Sn(function(e){if(t)return!0;e instanceof _n&&e.definition()===i&&(t=!0)})),!t&&N}function N(e){return r.equivalent_to(e)}function H(t,i){return function(e,n){if(n.in_boolean_context()){if(t&&e.is_truthy()&&!e.has_side_effects(c))return!0;if(e.is_constant())return!e.evaluate(c)==!t}return i(e)}}function R(e){var t=Object.create(null);p instanceof Ve&&(t[p.name.name]=_);var i=new Sn(function(e){var n=K(e);(n instanceof _n||n instanceof mn)&&(t[n.name]=t[n.name]||ne(e,i.parent()))});return e.walk(i),t}function I(i){if(i.name instanceof pn){var e=c.self().argnames.indexOf(i.name),n=c.parent().args;return n[e]&&(n[e]=X(yn,n[e],{value:0})),!0}var r=!1;return t[o].transform(new Xn(function(e,n,t){return r?e:e===i||e.body===i?(r=!0,e instanceof Ve?(e.value=null,e):t?re.skip:null):void 0},function(e){if(e instanceof We)switch(e.expressions.length){case 0:return null;case 1:return e.expressions[0]}}))}function P(e){return!(e instanceof Ke)&&(n=e,n[n instanceof rn?"right":"value"]).has_side_effects(c);var n}function U(){if(m)return!1;if(d)return!0;if(_ instanceof _n){var e=_.definition();if(e.references.length-e.replaced==(p instanceof Ve?1:2))return!0}return!1}function L(e){var n=e.definition();return!(1==n.orig.length&&n.orig[0]instanceof dn)&&(n.scope!==J||!oe(n.references,function(e){var n=e.scope;return"Scope"==n.TYPE&&(n=n.parent_scope),n===J}))}}function r(e){for(var n=[],t=0;t<e.length;){var i=e[t];i instanceof de?(W=!0,r(i.body),[].splice.apply(e,[t,1].concat(i.body)),t+=i.body.length):i instanceof he?(W=!0,e.splice(t,1)):i instanceof fe?n.indexOf(i.value)<0?(t++,n.push(i.value)):(W=!0,e.splice(t,1)):t++}}function i(r,i){for(var o=i.self(),e=function(e){for(var n=0,t=e.length;0<=--t;){var i=e[t];if(i instanceof Me&&i.body instanceof Te&&1<++n)return!0}return!1}(r),a=o instanceof ke,n=r.length;0<=--n;){var t=r[n],s=_(n),u=r[s];if(a&&!u&&t instanceof Te){if(!t.value){W=!0,r.splice(n,1);continue}if(t.value instanceof Qe&&"void"==t.value.operator){W=!0,r[n]=X(le,t,{body:t.value.expression});continue}}if(t instanceof Me){var c;if(d(c=A(t.body))){c.label&&T(c.label.thedef.references,c),W=!0,(t=t.clone()).condition=t.condition.negate(i);var f=v(t.body,c);t.body=X(de,t,{body:b(t.alternative).concat(h())}),t.alternative=X(de,t,{body:f}),r[n]=t.transform(i);continue}if(d(c=A(t.alternative))){c.label&&T(c.label.thedef.references,c),W=!0,(t=t.clone()).body=X(de,t.body,{body:b(t.body).concat(h())});f=v(t.alternative,c);t.alternative=X(de,t.alternative,{body:f}),r[n]=t.transform(i);continue}}if(t instanceof Me&&t.body instanceof Te){var l=t.body.value;if(!l&&!t.alternative&&(a&&!u||u instanceof Te&&!u.value)){W=!0,r[n]=X(le,t.condition,{body:t.condition});continue}if(l&&!t.alternative&&u instanceof Te&&u.value){W=!0,(t=t.clone()).alternative=u,r.splice(n,1,t.transform(i)),r.splice(s,1);continue}if(l&&!t.alternative&&(!u&&a&&e||u instanceof Te)){W=!0,(t=t.clone()).alternative=u||X(Te,t,{value:null}),r.splice(n,1,t.transform(i)),u&&r.splice(s,1);continue}var p=r[m(n)];if(i.option("sequences")&&a&&!t.alternative&&p instanceof Me&&p.body instanceof Te&&_(s)==r.length&&u instanceof le){W=!0,(t=t.clone()).alternative=X(de,u,{body:[u,X(Te,u,{value:null})]}),r.splice(n,1,t.transform(i)),r.splice(s,1);continue}}}function d(e){if(!e)return!1;var n,t=e instanceof Oe?i.loopcontrol_target(e):null;return e instanceof Te&&a&&(!(n=e.value)||n instanceof Qe&&"void"==n.operator)||e instanceof ze&&o===y(t)||e instanceof $e&&t instanceof de&&o===t}function h(){var e=r.slice(n+1);return r.length=n+1,e.filter(function(e){return!(e instanceof Ce)||(r.push(e),!1)})}function v(e,n){var t=b(e).slice(0,-1);return n.value&&t.push(X(le,n.value,{body:n.value.expression})),t}function _(e){for(var n=e+1,t=r.length;n<t;n++){var i=r[n];if(!(i instanceof Le&&g(i)))break}return n}function m(e){for(var n=e;0<=--n;){var t=r[n];if(!(t instanceof Le&&g(t)))break}return n}}function o(n,t){for(var e,i=t.self(),r=0,o=0,a=n.length;r<a;r++){var s=n[r];if(s instanceof Oe){var u=t.loopcontrol_target(s);s instanceof $e&&!(u instanceof _e)&&y(u)===i||s instanceof ze&&y(u)===i?s.label&&T(s.label.thedef.references,s):n[o++]=s}else n[o++]=s;if(A(s)){e=n.slice(r+1);break}}n.length=o,W=o!=a,e&&e.forEach(function(e){w(t,e,n)})}function g(e){return oe(e.definitions,function(e){return!e.value})}function a(n,e){if(!(n.length<2)){for(var t=[],i=0,r=0,o=n.length;r<o;r++){var a=n[r];if(a instanceof le){t.length>=e.sequences_limit&&u();var s=a.body;0<t.length&&(s=s.drop_side_effect_free(e)),s&&l(t,s)}else a instanceof Ue&&g(a)||a instanceof Ce||u(),n[i++]=a}u(),(n.length=i)!=o&&(W=!0)}function u(){if(t.length){var e=M(t[0],t);n[i++]=X(le,e,{body:e}),t=[]}}}function p(e,n){if(!(e instanceof de))return e;for(var t=null,i=0,r=e.body.length;i<r;i++){var o=e.body[i];if(o instanceof Le&&g(o))n.push(o);else{if(t)return!1;t=o}}return t}function s(e,t){function n(e){r--,W=!0;var n=i.body;return M(n,[n,e]).transform(t)}for(var i,r=0,o=0;o<e.length;o++){var a=e[o];if(i)if(a instanceof Se)a.value=n(a.value||X(En,a).transform(t));else if(a instanceof ye){if(!(a.init instanceof Ue)){var s=!1;i.body.walk(new Sn(function(e){return!!(s||e instanceof Ae)||(e instanceof nn&&"in"==e.operator?s=!0:void 0)})),s||(a.init?a.init=n(a.init):(a.init=i.body,r--,W=!0))}}else a instanceof we?a.object=n(a.object):a instanceof Me?a.condition=n(a.condition):a instanceof qe?a.expression=n(a.expression):a instanceof xe&&(a.expression=n(a.expression));if(t.option("conditionals")&&a instanceof Me){var u=[],c=p(a.body,u),f=p(a.alternative,u);if(!1!==c&&!1!==f&&0<u.length){var l=u.length;u.push(X(Me,a,{condition:a.condition,body:c||X(he,a.body),alternative:f})),u.unshift(r,1),[].splice.apply(e,u),o+=l,r+=l+1,W=!(i=null);continue}}e[r++]=a,i=a instanceof le?a:null}e.length=r}function f(e,n){if(e instanceof Ue){var t,i=e.definitions[e.definitions.length-1];if(i.value instanceof an)if(n instanceof rn?t=[n]:n instanceof We&&(t=n.expressions.slice()),t){var r=!1;do{var o=t[0];if(!(o instanceof rn))break;if("="!=o.operator)break;if(!(o.left instanceof Ge))break;var a=o.left.expression;if(!(a instanceof _n))break;if(i.name.name!=a.name)break;if(!o.right.is_constant_expression(J))break;var s=o.left.property;if(s instanceof se&&(s=s.evaluate(c)),s instanceof se)break;s=""+s;var u=c.has_directive("use strict")?function(e){return e.key!=s&&e.key.name!=s}:function(e){return e.key.name!=s};if(!oe(i.value.properties,u))break;i.value.properties.push(X(un,o,{key:s,value:o.right})),t.shift(),r=!0}while(t.length);return r&&t}}}function u(t){for(var e,n=0,i=-1,r=t.length;n<r;n++){var o=t[n],a=t[i];if(o instanceof Ue)a&&a.TYPE==o.TYPE?(a.definitions=a.definitions.concat(o.definitions),W=!0):e&&e.TYPE==o.TYPE&&g(o)?(e.definitions=e.definitions.concat(o.definitions),W=!0):e=t[++i]=o;else if(o instanceof Se)o.value=u(o.value);else if(o instanceof ye){(s=f(a,o.init))?(W=!0,o.init=s.length?M(o.init,s):null,t[++i]=o):a instanceof Le&&(!o.init||o.init.TYPE==a.TYPE)?(o.init&&(a.definitions=a.definitions.concat(o.init.definitions)),o.init=a,t[i]=o,W=!0):e&&o.init&&e.TYPE==o.init.TYPE&&g(o.init)?(e.definitions=e.definitions.concat(o.init.definitions),o.init=null,t[++i]=o,W=!0):t[++i]=o}else if(o instanceof we)o.object=u(o.object);else if(o instanceof Me)o.condition=u(o.condition);else if(o instanceof le){var s;if(s=f(a,o.body)){if(W=!0,!s.length)continue;o.body=M(o.body,s)}t[++i]=o}else o instanceof qe?o.expression=u(o.expression):o instanceof xe?o.expression=u(o.expression):t[++i]=o}function u(e){t[++i]=o;var n=f(a,e);return n?(W=!0,n.length?M(e,n):e instanceof We?e.tail_node().left:e.left):e}t.length=i+1}}function w(n,e,t){e instanceof Ce||n.warn("Dropping unreachable code [{file}:{line},{col}]",e.start),e.walk(new Sn(function(e){return e instanceof Ue?(n.warn("Declarations in unreachable code! [{file}:{line},{col}]",e.start),e.remove_initializers(),t.push(e),!0):e instanceof Ce?(t.push(e),!0):e instanceof Ae||void 0}))}function p(e){return e instanceof gn?e.getValue():e instanceof Qe&&"void"==e.operator&&e.expression instanceof gn?void 0:e}function g(e,n){return e.is_undefined||e instanceof En||e instanceof Qe&&"void"==e.operator&&!e.expression.has_side_effects(n)}(t=function(e,n){e.DEFMETHOD("is_truthy",n)})(se,ie),t(on,J),t(rn,function(){return"="==this.operator&&this.right.is_truthy()}),t(ke,J),t(an,J),t(wn,J),t(We,function(){return this.tail_node().is_truthy()}),t(_n,function(){var e=this.fixed_value();return e&&e.is_truthy()}),function(e){function t(e){return/strict/.test(e.option("pure_getters"))}se.DEFMETHOD("may_throw_on_access",function(e){return!e.option("pure_getters")||this._dot_throw(e)}),e(se,t),e(xn,J),e(En,J),e(gn,ie),e(on,ie),e(an,function(e){if(!t(e))return!1;for(var n=this.properties.length;0<=--n;)if(this.properties[n].value instanceof De)return!0;return!1}),e(ke,ie),e(en,ie),e(Qe,function(){return"void"==this.operator}),e(nn,function(e){return("&&"==this.operator||"||"==this.operator)&&(this.left._dot_throw(e)||this.right._dot_throw(e))}),e(rn,function(e){return"="==this.operator&&this.right._dot_throw(e)}),e(tn,function(e){return this.consequent._dot_throw(e)||this.alternative._dot_throw(e)}),e(Xe,function(e){if(!t(e))return!1;var n=this.expression;return n instanceof _n&&(n=n.fixed_value()),!(n instanceof ke&&"prototype"==this.property)}),e(We,function(e){return this.tail_node()._dot_throw(e)}),e(_n,function(e){if(this.is_undefined)return!0;if(!t(e))return!1;if(H(this)&&this.is_declared(e))return!1;if(this.is_immutable())return!1;var n=this.fixed_value();return!n||n._dot_throw(e)})}(function(e,n){e.DEFMETHOD("_dot_throw",n)}),r=["!","delete"],a=["in","instanceof","==","!=","===","!==","<","<=",">=",">"],(i=function(e,n){e.DEFMETHOD("is_boolean",n)})(se,ie),i(Qe,function(){return te(this.operator,r)}),i(nn,function(){return te(this.operator,a)||ee(this.operator)&&this.left.is_boolean()&&this.right.is_boolean()}),i(tn,function(){return this.consequent.is_boolean()&&this.alternative.is_boolean()}),i(rn,function(){return"="==this.operator&&this.right.is_boolean()}),i(We,function(){return this.tail_node().is_boolean()}),i(Bn,J),i(Cn,J),function(e){e(se,ie),e(yn,J);var n=W("+ - ~ ++ --");e(Ke,function(){return n(this.operator)});var t=W("- * / % & | ^ << >> >>>");e(nn,function(e){return t(this.operator)||"+"==this.operator&&this.left.is_number(e)&&this.right.is_number(e)}),e(rn,function(e){return t(this.operator.slice(0,-1))||"="==this.operator&&this.right.is_number(e)}),e(We,function(e){return this.tail_node().is_number(e)}),e(tn,function(e){return this.consequent.is_number(e)&&this.alternative.is_number(e)})}(function(e,n){e.DEFMETHOD("is_number",n)}),(s=function(e,n){e.DEFMETHOD("is_string",n)})(se,ie),s(bn,J),s(Qe,function(){return"typeof"==this.operator}),s(nn,function(e){return"+"==this.operator&&(this.left.is_string(e)||this.right.is_string(e))}),s(rn,function(e){return("="==this.operator||"+="==this.operator)&&this.right.is_string(e)}),s(We,function(e){return this.tail_node().is_string(e)}),s(tn,function(e){return this.consequent.is_string(e)&&this.alternative.is_string(e)});var c,ee=W("&& ||"),f=W("delete ++ --");function ne(e,n){return n instanceof Ke&&f(n.operator)?n.expression:n instanceof rn&&n.left===e?e:void 0}function x(e,n){return e.print_to_string().length>n.print_to_string().length?n:e}function I(e,n,t){return($(e)?function(e,n){return x(X(le,e,{body:e}),X(le,n,{body:n})).body}:x)(n,t)}function d(e){for(var n in e)e[n]=W(e[n])}c=function(e,n){e.DEFMETHOD("_find_defs",n)},se.DEFMETHOD("resolve_defines",function(e){if(e.option("global_defs")){var n=this._find_defs(e,"");if(n){for(var t,i=this,r=0;t=i,(i=e.parent(r++))instanceof Ge&&i.expression===t;);if(!ne(t,i))return n;e.warn("global_defs "+this.print_to_string()+" redefined [{file}:{line},{col}]",this.start)}}}),c(se,L),c(Xe,function(e,n){return this.expression._find_defs(e,"."+this.property+n)}),c(_n,function(e,n){if(this.global()){var t,i=e.option("global_defs");if(i&&ae(i,t=this.name+n)){var r=function n(e,t){if(e instanceof se)return X(e.CTOR,t,e);if(Array.isArray(e))return X(on,t,{elements:e.map(function(e){return n(e,t)})});if(e&&"object"==typeof e){var i=[];for(var r in e)ae(e,r)&&i.push(X(un,t,{key:r,value:n(e[r],t)}));return X(an,t,{properties:i})}return q(e,t)}(i[t],this),o=e.find_parent(Ee);return r.walk(new Sn(function(e){e instanceof _n&&(e.scope=o,e.thedef=o.def_global(e))})),r}}});var h=["constructor","toString","valueOf"],v={Array:["indexOf","join","lastIndexOf","slice"].concat(h),Boolean:h,Function:h,Number:["toExponential","toFixed","toPrecision"].concat(h),Object:h,RegExp:["test"].concat(h),String:["charAt","charCodeAt","concat","indexOf","italics","lastIndexOf","match","replace","search","slice","split","substr","substring","toLowerCase","toUpperCase","trim"].concat(h)};d(v);var _={Array:["isArray"],Math:["abs","acos","asin","atan","ceil","cos","exp","floor","log","round","sin","sqrt","tan","atan2","pow","max","min"],Number:["isFinite","isNaN"],Object:["create","getOwnPropertyDescriptor","getOwnPropertyNames","getPrototypeOf","isExtensible","isFrozen","isSealed","keys"],String:["fromCharCode"]};d(_),function(e){se.DEFMETHOD("evaluate",function(e){if(!e.option("evaluate"))return this;var n=[],t=this._eval(e,n,1);return n.forEach(function(e){delete e._eval}),!t||t instanceof RegExp?t:"function"==typeof t||"object"==typeof t?this:t});var n=W("! ~ - + void");se.DEFMETHOD("is_constant",function(){return this instanceof gn?!(this instanceof wn):this instanceof Qe&&this.expression instanceof gn&&n(this.operator)}),e(ue,function(){throw new Error(S("Cannot evaluate a statement [{file}:{line},{col}]",this.start))}),e(ke,C),e(se,C),e(gn,function(){return this.getValue()}),e(Fe,function(e){if(e.option("unsafe")){var n=function(){};return n.node=this,n.toString=function(){return"function(){}"},n}return this}),e(on,function(e,n,t){if(e.option("unsafe")){for(var i=[],r=0,o=this.elements.length;r<o;r++){var a=this.elements[r],s=a._eval(e,n,t);if(a===s)return this;i.push(s)}return i}return this}),e(an,function(e,n,t){if(e.option("unsafe")){for(var i={},r=0,o=this.properties.length;r<o;r++){var a=this.properties[r],s=a.key;if(s instanceof cn)s=s.name;else if(s instanceof se&&(s=s._eval(e,n,t))===a.key)return this;if("function"==typeof Object.prototype[s])return this;if(!(a.value instanceof Fe)&&(i[s]=a.value._eval(e,n,t),i[s]===a.value))return this}return i}return this});var r=W("! typeof void");e(Qe,function(e,n,t){var i=this.expression;if(e.option("typeofs")&&"typeof"==this.operator&&(i instanceof ke||i instanceof _n&&i.fixed_value()instanceof ke))return"function";if(r(this.operator)||t++,(i=i._eval(e,n,t))===this.expression)return this;switch(this.operator){case"!":return!i;case"typeof":return i instanceof RegExp?this:typeof i;case"void":return;case"~":return~i;case"-":return-i;case"+":return+i}return this});var a=W("&& || === !==");e(nn,function(e,n,t){a(this.operator)||t++;var i=this.left._eval(e,n,t);if(i===this.left)return this;var r,o=this.right._eval(e,n,t);if(o===this.right)return this;switch(this.operator){case"&&":r=i&&o;break;case"||":r=i||o;break;case"|":r=i|o;break;case"&":r=i&o;break;case"^":r=i^o;break;case"+":r=i+o;break;case"*":r=i*o;break;case"/":r=i/o;break;case"%":r=i%o;break;case"-":r=i-o;break;case"<<":r=i<<o;break;case">>":r=i>>o;break;case">>>":r=i>>>o;break;case"==":r=i==o;break;case"===":r=i===o;break;case"!=":r=i!=o;break;case"!==":r=i!==o;break;case"<":r=i<o;break;case"<=":r=i<=o;break;case">":r=o<i;break;case">=":r=o<=i;break;default:return this}return isNaN(r)&&e.find_parent(xe)?this:r}),e(tn,function(e,n,t){var i=this.condition._eval(e,n,t);if(i===this.condition)return this;var r=i?this.consequent:this.alternative,o=r._eval(e,n,t);return o===r?this:o}),e(_n,function(e,n,t){var i,r=this.fixed_value();if(!r)return this;if(0<=n.indexOf(r))i=r._eval();else{if(this._eval=C,i=r._eval(e,n,t),delete this._eval,i===r)return this;r._eval=function(){return i},n.push(r)}if(i&&"object"==typeof i){var o=this.definition().escaped;if(o&&o<t)return this}return i});var p={Array:Array,Math:Math,Number:Number,Object:Object,String:String},s={Math:["E","LN10","LN2","LOG2E","LOG10E","PI","SQRT1_2","SQRT2"],Number:["MAX_VALUE","MIN_VALUE","NaN","NEGATIVE_INFINITY","POSITIVE_INFINITY"]};d(s),e(Ge,function(e,n,t){if(e.option("unsafe")){var i=this.property;if(i instanceof se&&(i=i._eval(e,n,t))===this.property)return this;var r,o=this.expression;if(H(o)){if(!(s[o.name]||ie)(i))return this;r=p[o.name]}else{if(!(r=o._eval(e,n,t+1))||r===o||!ae(r,i))return this;if("function"==typeof r)switch(i){case"name":return r.node.name?r.node.name.name:"";case"length":return r.node.argnames.length;default:return this}}return r[i]}return this}),e(Ye,function(n,e,t){var i=this.expression;if(n.option("unsafe")&&i instanceof Ge){var r,o=i.property;if(o instanceof se&&(o=o._eval(n,e,t))===i.property)return this;var a=i.expression;if(H(a)){if(!(_[a.name]||ie)(o))return this;r=p[a.name]}else if((r=a._eval(n,e,t+1))===a||!(r&&v[r.constructor.name]||ie)(o))return this;for(var s=[],u=0,c=this.args.length;u<c;u++){var f=this.args[u],l=f._eval(n,e,t);if(f===l)return this;s.push(l)}try{return r[o].apply(r,s)}catch(e){n.warn("Error evaluating {code} [{file}:{line},{col}]",{code:this.print_to_string(),file:this.start.file,line:this.start.line,col:this.start.col})}}return this}),e(Je,C)}(function(e,n){e.DEFMETHOD("_eval",n)}),function(e){function o(e){return X(Qe,e,{operator:"!",expression:e})}function r(e,n,t){var i=o(e);if(t){var r=X(le,n,{body:n});return x(i,r)===r?n:i}return x(i,n)}e(se,function(){return o(this)}),e(ue,function(){throw new Error("Cannot negate a statement")}),e(Fe,function(){return o(this)}),e(Qe,function(){return"!"==this.operator?this.expression:o(this)}),e(We,function(e){var n=this.expressions.slice();return n.push(n.pop().negate(e)),M(this,n)}),e(tn,function(e,n){var t=this.clone();return t.consequent=t.consequent.negate(e),t.alternative=t.alternative.negate(e),r(this,t,n)}),e(nn,function(e,n){var t=this.clone(),i=this.operator;if(e.option("unsafe_comps"))switch(i){case"<=":return t.operator=">",t;case"<":return t.operator=">=",t;case">=":return t.operator="<",t;case">":return t.operator="<=",t}switch(i){case"==":return t.operator="!=",t;case"!=":return t.operator="==",t;case"===":return t.operator="!==",t;case"!==":return t.operator="===",t;case"&&":return t.operator="||",t.left=t.left.negate(e,n),t.right=t.right.negate(e),r(this,t,n);case"||":return t.operator="&&",t.left=t.left.negate(e,n),t.right=t.right.negate(e),r(this,t,n)}return o(this)})}(function(e,t){e.DEFMETHOD("negate",function(e,n){return t.call(this,e,n)})});var m=W("Boolean decodeURI decodeURIComponent Date encodeURI encodeURIComponent Error escape EvalError isFinite isNaN Number Object parseFloat parseInt RangeError ReferenceError String SyntaxError TypeError unescape URIError");function A(e){return e&&e.aborts()}Ye.DEFMETHOD("is_expr_pure",function(e){if(e.option("unsafe")){var n=this.expression;if(H(n)&&m(n.name))return!0;if(n instanceof Xe&&H(n.expression)&&(_[n.expression.name]||ie)(n.property))return!0}return this.pure||!e.pure_funcs(this)}),se.DEFMETHOD("is_call_pure",ie),Xe.DEFMETHOD("is_call_pure",function(e){if(e.option("unsafe")){var n=this.expression,t=ie;return n instanceof on?t=v.Array:n.is_boolean()?t=v.Boolean:n.is_number(e)?t=v.Number:n instanceof wn?t=v.RegExp:n.is_string(e)?t=v.String:this.may_throw_on_access(e)||(t=v.Object),t(this.property)}}),function(e){function n(e,n){for(var t=e.length;0<=--t;)if(e[t].has_side_effects(n))return!0;return!1}e(se,J),e(he,ie),e(gn,ie),e(mn,ie),e(pe,function(e){return n(this.body,e)}),e(Ye,function(e){return!(this.is_expr_pure(e)||this.expression.is_call_pure(e)&&!this.expression.has_side_effects(e))||n(this.args,e)}),e(qe,function(e){return this.expression.has_side_effects(e)||n(this.body,e)}),e(He,function(e){return this.expression.has_side_effects(e)||n(this.body,e)}),e(Re,function(e){return n(this.body,e)||this.bcatch&&this.bcatch.has_side_effects(e)||this.bfinally&&this.bfinally.has_side_effects(e)}),e(Me,function(e){return this.condition.has_side_effects(e)||this.body&&this.body.has_side_effects(e)||this.alternative&&this.alternative.has_side_effects(e)}),e(ve,function(e){return this.body.has_side_effects(e)}),e(le,function(e){return this.body.has_side_effects(e)}),e(ke,ie),e(nn,function(e){return this.left.has_side_effects(e)||this.right.has_side_effects(e)}),e(rn,J),e(tn,function(e){return this.condition.has_side_effects(e)||this.consequent.has_side_effects(e)||this.alternative.has_side_effects(e)}),e(Ke,function(e){return f(this.operator)||this.expression.has_side_effects(e)}),e(_n,function(e){return!this.is_declared(e)}),e(fn,ie),e(an,function(e){return n(this.properties,e)}),e(sn,function(e){return this.value.has_side_effects(e)}),e(on,function(e){return n(this.elements,e)}),e(Xe,function(e){return this.expression.may_throw_on_access(e)||this.expression.has_side_effects(e)}),e(Ze,function(e){return this.expression.may_throw_on_access(e)||this.expression.has_side_effects(e)||this.property.has_side_effects(e)}),e(We,function(e){return n(this.expressions,e)}),e(Ue,function(e){return n(this.definitions,e)}),e(Ve,function(e){return this.value})}(function(e,n){e.DEFMETHOD("has_side_effects",n)}),function(e){function n(e,n){for(var t=e.length;0<=--t;)if(e[t].may_throw(n))return!0;return!1}e(se,J),e(gn,ie),e(he,ie),e(ke,ie),e(fn,ie),e(mn,ie),e(on,function(e){return n(this.elements,e)}),e(rn,function(e){return!!this.right.may_throw(e)||!(!e.has_directive("use strict")&&"="==this.operator&&this.left instanceof _n)&&this.left.may_throw(e)}),e(nn,function(e){return this.left.may_throw(e)||this.right.may_throw(e)}),e(pe,function(e){return n(this.body,e)}),e(Ye,function(e){return!!n(this.args,e)||!this.is_expr_pure(e)&&(!!this.expression.may_throw(e)||(!(this.expression instanceof ke)||n(this.expression.body,e)))}),e(He,function(e){return this.expression.may_throw(e)||n(this.body,e)}),e(tn,function(e){return this.condition.may_throw(e)||this.consequent.may_throw(e)||this.alternative.may_throw(e)}),e(Ue,function(e){return n(this.definitions,e)}),e(Xe,function(e){return this.expression.may_throw_on_access(e)||this.expression.may_throw(e)}),e(Me,function(e){return this.condition.may_throw(e)||this.body&&this.body.may_throw(e)||this.alternative&&this.alternative.may_throw(e)}),e(ve,function(e){return this.body.may_throw(e)}),e(an,function(e){return n(this.properties,e)}),e(sn,function(e){return this.value.may_throw(e)}),e(Te,function(e){return this.value&&this.value.may_throw(e)}),e(We,function(e){return n(this.expressions,e)}),e(le,function(e){return this.body.may_throw(e)}),e(Ze,function(e){return this.expression.may_throw_on_access(e)||this.expression.may_throw(e)||this.property.may_throw(e)}),e(qe,function(e){return this.expression.may_throw(e)||n(this.body,e)}),e(_n,function(e){return!this.is_declared(e)}),e(Re,function(e){return this.bcatch?this.bcatch.may_throw(e):n(this.body,e)||this.bfinally&&this.bfinally.may_throw(e)}),e(Ke,function(e){return!("typeof"==this.operator&&this.expression instanceof _n)&&this.expression.may_throw(e)}),e(Ve,function(e){return!!this.value&&this.value.may_throw(e)})}(function(e,n){e.DEFMETHOD("may_throw",n)}),function(e){function n(e){for(var n=e.length;0<=--n;)if(!e[n].is_constant_expression())return!1;return!0}e(se,ie),e(gn,J),e(ke,function(i){var r=this,o=!0;return r.walk(new Sn(function(e){if(!o)return!0;if(e instanceof _n){if(r.inlined)return!(o=!1);var n=e.definition();if(te(n,r.enclosed)&&!r.variables.has(n.name)){if(i){var t=i.find_variable(e);if(n.undeclared?!t:t===n)return o="f",!0}o=!1}return!0}})),o}),e(Ke,function(){return this.expression.is_constant_expression()}),e(nn,function(){return this.left.is_constant_expression()&&this.right.is_constant_expression()}),e(on,function(){return n(this.elements)}),e(an,function(){return n(this.properties)}),e(sn,function(){return this.value.is_constant_expression()})}(function(e,n){e.DEFMETHOD("is_constant_expression",n)}),function(e){function n(){var e=this.body.length;return 0<e&&A(this.body[e-1])}e(ue,B),e(Be,C),e(de,n),e(je,n),e(Me,function(){return this.alternative&&A(this.body)&&A(this.alternative)&&this})}(function(e,n){e.DEFMETHOD("aborts",n)}),e(fe,function(e,n){return n.has_directive(e.value)!==e?X(he,e):e}),e(ce,function(e,n){return n.option("drop_debugger")?X(he,e):e}),e(ve,function(e,n){return e.body instanceof $e&&n.loopcontrol_target(e.body)===e.body?X(he,e):0==e.label.references.length?e.body:e}),e(pe,function(e,n){return u(e.body,n),e}),e(de,function(e,n){switch(u(e.body,n),e.body.length){case 1:return e.body[0];case 0:return X(he,e)}return e}),e(ke,function(e,n){return u(e.body,n),n.option("side_effects")&&1==e.body.length&&e.body[0]===n.has_directive("use strict")&&(e.body.length=0),e}),Ae.DEFMETHOD("drop_unused",function(b){if(b.option("unused")&&!b.has_directive("use asm")){var y=this;if(!y.uses_eval&&!y.uses_with){var w=!(y instanceof Ee)||b.toplevel.funcs,x=!(y instanceof Ee)||b.toplevel.vars,A=/keep_assign/.test(b.option("unused"))?ie:function(e,n){var t;if(e instanceof rn&&(e.write_only||"="==e.operator)?t=e.left:e instanceof Ke&&e.write_only&&(t=e.expression),/strict/.test(b.option("pure_getters")))for(;t instanceof Ge&&!t.expression.may_throw_on_access(b);)t instanceof Ze&&n.unshift(t.property),t=t.expression;return t},s=[],E=Object.create(null),k=Object.create(null),u=Object.create(null),c=Object.create(null);y instanceof Ee&&b.top_retain&&y.variables.each(function(e){!b.top_retain(e)||e.id in E||(E[e.id]=!0,s.push(e))});var D=new O,i=new O,F=this,f=new Sn(function(e,n){if(e!==y){if(e instanceof Ce){var t=e.name.definition();return w||F!==y||t.id in E||(E[t.id]=!0,s.push(t)),i.add(t.id,e),!0}return e instanceof pn&&F===y&&D.add(e.definition().id,e),e instanceof Ue&&F===y?(e.definitions.forEach(function(e){var n=e.name.definition();e.name instanceof ln&&D.add(n.id,e),x||n.id in E||(E[n.id]=!0,s.push(n)),e.value&&(i.add(n.id,e.value),e.value.has_side_effects(b)&&e.value.walk(f),n.chained||e.name.fixed_value()!==e.value||(k[n.id]=e))}),!0):r(e,n)}});y.walk(f),f=new Sn(r);for(var e=0;e<s.length;e++){var n=i.get(s[e].id);n&&n.forEach(function(e){e.walk(f)})}var C=new Xn(function(a,e,n){var t=C.parent();if(x){var i=[];if((l=A(a,i))instanceof _n){var r=(s=l.definition()).id in E,o=null;if(a instanceof rn?(!r||a.left===l&&s.id in k&&k[s.id]!==a)&&(o=a.right):r||(o=X(yn,a,{value:0})),o)return i.push(o),Z(t,a,M(a,i.map(function(e){return e.transform(C)})))}}if(F===y){var s;if(a instanceof Fe&&a.name&&!b.option("keep_fnames"))(s=a.name.definition()).id in E&&!(1<s.orig.length)||(a.name=null);if(a instanceof ke&&!(a instanceof De))for(var u=!b.option("keep_fargs"),c=a.argnames,f=c.length;0<=--f;){var l;(l=c[f]).definition().id in E?u=!1:(l.__unused=!0,u&&(c.pop(),b[l.unreferenced()?"warn":"info"]("Dropping unused function argument {name} [{file}:{line},{col}]",g(l))))}if(w&&a instanceof Ce&&a!==y)if(!((s=a.name.definition()).id in E))return b[a.name.unreferenced()?"warn":"info"]("Dropping unused function {name} [{file}:{line},{col}]",g(a.name)),s.eliminated++,X(he,a);if(a instanceof Ue&&!(t instanceof we&&t.init===a)){var p=[],d=[],h=[],v=[];switch(a.definitions.forEach(function(e){e.value&&(e.value=e.value.transform(C));var n=e.name.definition();if(!x||n.id in E){if(e.value&&n.id in k&&k[n.id]!==e&&(e.value=e.value.drop_side_effect_free(b)),e.name instanceof ln){var t=D.get(n.id);if(1<t.length&&(!e.value||n.orig.indexOf(e.name)>n.eliminated)){if(b.warn("Dropping duplicated definition of variable {name} [{file}:{line},{col}]",g(e.name)),e.value){var i=X(_n,e.name,e.name);n.references.push(i);var r=X(rn,e,{operator:"=",left:i,right:e.value});k[n.id]===e&&(k[n.id]=r),v.push(r.transform(C))}return T(t,e),void n.eliminated++}}e.value?(0<v.length&&(0<h.length?(v.push(e.value),e.value=M(e.value,v)):p.push(X(le,a,{body:M(a,v)})),v=[]),h.push(e)):d.push(e)}else if(n.orig[0]instanceof vn){(o=e.value&&e.value.drop_side_effect_free(b))&&v.push(o),e.value=null,d.push(e)}else{var o;(o=e.value&&e.value.drop_side_effect_free(b))?(b.warn("Side effects in initialization of unused variable {name} [{file}:{line},{col}]",g(e.name)),v.push(o)):b[e.name.unreferenced()?"warn":"info"]("Dropping unused variable {name} [{file}:{line},{col}]",g(e.name)),n.eliminated++}}),(0<d.length||0<h.length)&&(a.definitions=d.concat(h),p.push(a)),0<v.length&&p.push(X(le,a,{body:M(a,v)})),p.length){case 0:return n?re.skip:X(he,a);case 1:return p[0];default:return n?re.splice(p):X(de,a,{body:p})}}if(a instanceof ye)return e(a,this),a.init instanceof de&&(_=a.init,a.init=_.body.pop(),_.body.push(a)),a.init instanceof le?a.init=a.init.body:j(a.init)&&(a.init=null),_?n?re.splice(_.body):_:a;if(a instanceof ve&&a.body instanceof ye){if(e(a,this),a.body instanceof de){var _=a.body;return a.body=_.body.pop(),_.body.push(a),n?re.splice(_.body):_}return a}if(a instanceof Ae){var m=F;return e(F=a,this),F=m,a}}function g(e){return{name:e.name,file:e.start.file,line:e.start.line,col:e.start.col}}});y.transform(C)}}function l(e,n,t){e.id in E||(n&&t?(E[e.id]=!0,s.push(e)):(u[e.id]=n,c[e.id]=t))}function r(e,n){var t,i=[],r=A(e,i);if(r instanceof _n&&y.variables.get(r.name)===(t=r.definition())){if(i.forEach(function(e){e.walk(f)}),e instanceof rn)if(e.right.walk(f),e.left===r)t.chained||r.fixed_value()!==e.right||(k[t.id]=e),e.write_only||l(t,!0,c[t.id]);else{var o=r.fixed_value();o&&o.is_constant()||l(t,u[t.id],!0)}return!0}if(e instanceof _n)return(t=e.definition()).id in E||(E[t.id]=!0,s.push(t)),!0;if(e instanceof Ae){var a=F;return F=e,n(),F=a,!0}}}),Ae.DEFMETHOD("hoist_declarations",function(r){var o=this;if(r.has_directive("use asm"))return o;var a=r.option("hoist_funs"),s=r.option("hoist_vars");if(a||s){var u=[],c=[],f=new O,l=0,n=0;o.walk(new Sn(function(e){return e instanceof Ae&&e!==o||(e instanceof Le?(++n,!0):void 0)})),s=s&&1<n;var p=new Xn(function(e){if(e!==o){if(e instanceof fe)return u.push(e),X(he,e);if(a&&e instanceof Ce&&(p.parent()===o||!r.has_directive("use strict")))return c.push(e),X(he,e);if(s&&e instanceof Le){e.definitions.forEach(function(e){f.set(e.name.name,e),++l});var n=e.to_assignments(r),t=p.parent();if(t instanceof we&&t.init===e){if(null==n){var i=e.definitions[0].name;return X(_n,i,i)}return n}return t instanceof ye&&t.init===e?n:n?X(le,e,{body:n}):X(he,e)}if(e instanceof Ae)return e}});if(o=o.transform(p),0<l){var t=[];if(f.each(function(n,e){o instanceof ke&&V(function(e){return e.name==n.name.name},o.argnames)?f.del(e):((n=n.clone()).value=null,t.push(n),f.set(e,n))}),0<t.length){for(var e=0;e<o.body.length;){if(o.body[e]instanceof le){var i,d,h=o.body[e].body;if(h instanceof rn&&"="==h.operator&&(i=h.left)instanceof cn&&f.has(i.name)){if((v=f.get(i.name)).value)break;v.value=h.right,T(t,v),t.push(v),o.body.splice(e,1);continue}if(h instanceof We&&(d=h.expressions[0])instanceof rn&&"="==d.operator&&(i=d.left)instanceof cn&&f.has(i.name)){var v;if((v=f.get(i.name)).value)break;v.value=d.right,T(t,v),t.push(v),o.body[e].body=M(h,h.expressions.slice(1));continue}}if(o.body[e]instanceof he)o.body.splice(e,1);else{if(!(o.body[e]instanceof de))break;var _=[e,1].concat(o.body[e].body);o.body.splice.apply(o.body,_)}}t=X(Le,o,{definitions:t}),c.push(t)}}o.body=u.concat(c,o.body)}return o}),Ae.DEFMETHOD("var_names",function(){var t=this._var_names;return t||(this._var_names=t=Object.create(null),this.enclosed.forEach(function(e){t[e.name]=!0}),this.variables.each(function(e,n){t[n]=!0})),t}),Ae.DEFMETHOD("make_var_name",function(e){for(var n=this.var_names(),t=e=e.replace(/(?:^[^a-z_$]|[^a-z0-9_$])/gi,"_"),i=0;n[t];i++)t=e+"$"+i;return n[t]=!0,t}),Ae.DEFMETHOD("hoist_properties",function(e){var u=this;if(!e.option("hoist_props")||e.has_directive("use asm"))return u;var i=u instanceof Ee&&e.top_retain||ie,c=Object.create(null);return u.transform(new Xn(function(r,e){var n;if(r instanceof Ve&&((s=r.name).scope===u&&1!=(t=s.definition()).escaped&&!t.single_use&&!t.direct_access&&!i(t)&&(n=s.fixed_value())===r.value&&n instanceof an)){e(r,this);var o=new O,a=[];return n.properties.forEach(function(e){var n,t,i;a.push(X(Ve,r,{name:(n=e.key,t=X(s.CTOR,s,{name:u.make_var_name(s.name+"_"+n),scope:u}),i=u.def_variable(t),o.set(n,i),u.enclosed.push(i),t),value:e.value}))}),c[t.id]=o,re.splice(a)}if(r instanceof Ge&&r.expression instanceof _n&&(o=c[r.expression.definition().id])){var s,t=o.get(p(r.property));return(s=X(_n,r,{name:t.name,scope:r.expression.scope,thedef:t})).reference({}),s}}))}),function(e){function a(e,n,t){var i=e.length;if(!i)return null;for(var r=[],o=!1,a=0;a<i;a++){var s=e[a].drop_side_effect_free(n,t);o|=s!==e[a],s&&(r.push(s),t=!1)}return o?r.length?r:null:e}e(se,C),e(gn,B),e(mn,B),e(Ye,function(n,e){if(!this.is_expr_pure(n)){if(this.expression.is_call_pure(n)){var t=this.args.slice();return t.unshift(this.expression.expression),(t=a(t,n,e))&&M(this,t)}if(this.expression instanceof Fe&&(!this.expression.name||!this.expression.name.definition().references.length)){var i=this.clone(),r=i.expression;return r.process_expression(!1,n),r.walk(new Sn(function(e){return e instanceof Te&&e.value?(e.value=e.value.drop_side_effect_free(n),!0):e instanceof Ae&&e!==r||void 0})),i}return this}this.pure&&n.warn("Dropping __PURE__ call [{file}:{line},{col}]",this.start);var o=a(this.args,n,e);return o&&M(this,o)}),e(De,B),e(Fe,B),e(nn,function(e,n){var t=this.right.drop_side_effect_free(e);if(!t)return this.left.drop_side_effect_free(e,n);if(ee(this.operator)){if(t===this.right)return this;var i=this.clone();return i.right=t,i}var r=this.left.drop_side_effect_free(e,n);return r?M(this,[r,t]):this.right.drop_side_effect_free(e,n)}),e(rn,function(e){var n=this.left;return n.has_side_effects(e)||e.has_directive("use strict")&&n instanceof Ge&&n.expression.is_constant()?this:(this.write_only=!0,K(n).is_constant_expression(e.find_parent(Ae))?this.right.drop_side_effect_free(e):this)}),e(tn,function(e){var n=this.consequent.drop_side_effect_free(e),t=this.alternative.drop_side_effect_free(e);if(n===this.consequent&&t===this.alternative)return this;if(!n)return t?X(nn,this,{operator:"||",left:this.condition,right:t}):this.condition.drop_side_effect_free(e);if(!t)return X(nn,this,{operator:"&&",left:this.condition,right:n});var i=this.clone();return i.consequent=n,i.alternative=t,i}),e(Ke,function(e,n){if(f(this.operator))return this.write_only=!this.expression.has_side_effects(e),this;if("typeof"==this.operator&&this.expression instanceof _n)return null;var t=this.expression.drop_side_effect_free(e,n);return n&&t&&N(t)?t===this.expression&&"!"==this.operator?this:t.negate(e,n):t}),e(_n,function(e){return this.is_declared(e)?null:this}),e(an,function(e,n){var t=a(this.properties,e,n);return t&&M(this,t)}),e(sn,function(e,n){return this.value.drop_side_effect_free(e,n)}),e(on,function(e,n){var t=a(this.elements,e,n);return t&&M(this,t)}),e(Xe,function(e,n){return this.expression.may_throw_on_access(e)?this:this.expression.drop_side_effect_free(e,n)}),e(Ze,function(e,n){if(this.expression.may_throw_on_access(e))return this;var t=this.expression.drop_side_effect_free(e,n);if(!t)return this.property.drop_side_effect_free(e,n);var i=this.property.drop_side_effect_free(e);return i?M(this,[t,i]):t}),e(We,function(e){var n=this.tail_node(),t=n.drop_side_effect_free(e);if(t===n)return this;var i=this.expressions.slice(0,-1);return t&&i.push(t),M(this,i)})}(function(e,n){e.DEFMETHOD("drop_side_effect_free",n)}),e(le,function(e,n){if(n.option("side_effects")){var t=e.body,i=t.drop_side_effect_free(n,!0);if(!i)return n.warn("Dropping side-effect-free statement [{file}:{line},{col}]",e.start),X(he,e);if(i!==t)return X(le,e,{body:i})}return e}),e(be,function(e,n){return n.option("loops")?X(ye,e,e).optimize(n):e}),e(ge,function(n,e){if(!e.option("loops"))return n;var t=n.condition.is_truthy()||n.condition.tail_node().evaluate(e);if(!(t instanceof se)){if(t)return X(ye,n,{body:X(de,n.body,{body:[n.body,X(le,n.condition,{body:n.condition})]})}).optimize(e);var i=!1,r=new Sn(function(e){return!!(e instanceof Ae||i)||(e instanceof Oe&&r.loopcontrol_target(e)===n?i=!0:void 0)}),o=e.parent();if((o instanceof ve?o:n).walk(r),!i)return X(de,n.body,{body:[n.body,X(le,n.condition,{body:n.condition})]}).optimize(e)}return n.body instanceof le?X(ye,n,{condition:M(n.condition,[n.body.body,n.condition]),body:X(he,n)}).optimize(e):n}),e(ye,function(e,n){if(!n.option("loops"))return e;if(n.option("side_effects")&&e.init&&(e.init=e.init.drop_side_effect_free(n)),e.condition){var t=e.condition.evaluate(n);if(!(t instanceof se))if(t)e.condition=null;else if(!n.option("dead_code")){var i=e.condition;e.condition=q(t,e.condition),e.condition=x(e.condition.transform(n),i)}if(t instanceof se&&(t=e.condition.is_truthy()||e.condition.tail_node().evaluate(n)),t)!e.condition||t instanceof se||(e.body=X(de,e.body,{body:[X(le,e.condition,{body:e.condition}),e.body]}),e.condition=null);else if(n.option("dead_code")){var r=[];return w(n,e.body,r),e.init instanceof ue?r.push(e.init):e.init&&r.push(X(le,e.init,{body:e.init})),r.push(X(le,e.condition,{body:e.condition})),X(de,e,{body:r}).optimize(n)}}return function n(t,i){var e=t.body instanceof de?t.body.body[0]:t.body;if(i.option("dead_code")&&o(e)){var r=[];return t.init instanceof ue?r.push(t.init):t.init&&r.push(X(le,t.init,{body:t.init})),t.condition&&r.push(X(le,t.condition,{body:t.condition})),w(i,t.body,r),X(de,t,{body:r})}return e instanceof Me&&(o(e.body)?(t.condition?t.condition=X(nn,t.condition,{left:t.condition,operator:"&&",right:e.condition.negate(i)}):t.condition=e.condition.negate(i),a(e.alternative)):o(e.alternative)&&(t.condition?t.condition=X(nn,t.condition,{left:t.condition,operator:"&&",right:e.condition}):t.condition=e.condition,a(e.body))),t;function o(e){return e instanceof $e&&i.loopcontrol_target(e)===i.self()}function a(e){e=b(e),t.body instanceof de?(t.body=t.body.clone(),t.body.body=e.concat(t.body.body.slice(1)),t.body=t.body.transform(i)):t.body=X(de,t.body,{body:e}).transform(i),t=n(t,i)}}(e,n)}),e(Me,function(e,n){if(j(e.alternative)&&(e.alternative=null),!n.option("conditionals"))return e;var t=e.condition.evaluate(n);if(!(n.option("dead_code")||t instanceof se)){var i=e.condition;e.condition=q(t,i),e.condition=x(e.condition.transform(n),i)}if(n.option("dead_code")){if(t instanceof se&&(t=e.condition.is_truthy()||e.condition.tail_node().evaluate(n)),!t){n.warn("Condition always false [{file}:{line},{col}]",e.condition.start);var r=[];return w(n,e.body,r),r.push(X(le,e.condition,{body:e.condition})),e.alternative&&r.push(e.alternative),X(de,e,{body:r}).optimize(n)}if(!(t instanceof se)){n.warn("Condition always true [{file}:{line},{col}]",e.condition.start);r=[];return e.alternative&&w(n,e.alternative,r),r.push(X(le,e.condition,{body:e.condition})),r.push(e.body),X(de,e,{body:r}).optimize(n)}}var o=e.condition.negate(n),a=e.condition.print_to_string().length,s=o.print_to_string().length,u=s<a;if(e.alternative&&u){u=!1,e.condition=o;var c=e.body;e.body=e.alternative||X(he,e),e.alternative=c}if(j(e.body)&&j(e.alternative))return X(le,e.condition,{body:e.condition.clone()}).optimize(n);if(e.body instanceof le&&e.alternative instanceof le)return X(le,e,{body:X(tn,e,{condition:e.condition,consequent:e.body.body,alternative:e.alternative.body})}).optimize(n);if(j(e.alternative)&&e.body instanceof le)return a===s&&!u&&e.condition instanceof nn&&"||"==e.condition.operator&&(u=!0),u?X(le,e,{body:X(nn,e,{operator:"||",left:o,right:e.body.body})}).optimize(n):X(le,e,{body:X(nn,e,{operator:"&&",left:e.condition,right:e.body.body})}).optimize(n);if(e.body instanceof he&&e.alternative instanceof le)return X(le,e,{body:X(nn,e,{operator:"||",left:e.condition,right:e.alternative.body})}).optimize(n);if(e.body instanceof Se&&e.alternative instanceof Se&&e.body.TYPE==e.alternative.TYPE)return X(e.body.CTOR,e,{value:X(tn,e,{condition:e.condition,consequent:e.body.value||X(En,e.body),alternative:e.alternative.value||X(En,e.alternative)}).transform(n)}).optimize(n);if(e.body instanceof Me&&!e.body.alternative&&!e.alternative&&(e=X(Me,e,{condition:X(nn,e.condition,{operator:"&&",left:e.condition,right:e.body.condition}),body:e.body.body,alternative:null})),A(e.body)&&e.alternative){var f=e.alternative;return e.alternative=null,X(de,e,{body:[e,f]}).optimize(n)}if(A(e.alternative)){r=e.body;return e.body=e.alternative,e.condition=u?o:e.condition.negate(n),e.alternative=null,X(de,e,{body:[e,r]}).optimize(n)}return e}),e(qe,function(n,t){if(!t.option("switches"))return n;var e,i=n.expression.evaluate(t);if(!(i instanceof se)){var r=n.expression;n.expression=q(i,r),n.expression=x(n.expression.transform(t),r)}if(!t.option("dead_code"))return n;i instanceof se&&(i=n.expression.tail_node().evaluate(t));for(var o,a,s=[],u=[],c=0,f=n.body.length;c<f&&!a;c++){if((e=n.body[c])instanceof Ne)o?g(e,u[u.length-1]):o=e;else if(!(i instanceof se)){if(!((_=e.expression.evaluate(t))instanceof se)&&_!==i){g(e,u[u.length-1]);continue}if(_ instanceof se&&(_=e.expression.tail_node().evaluate(t)),_===i&&(a=e,o)){var l=u.indexOf(o);u.splice(l,1),g(o,u[l-1]),o=null}}if(A(e)){var p=u[u.length-1];A(p)&&p.body.length==e.body.length&&X(de,p,p).equivalent_to(X(de,e,e))&&(p.body=[])}u.push(e)}for(;c<f;)g(n.body[c++],u[u.length-1]);for(0<u.length&&(u[0].body=s.concat(u[0].body)),n.body=u;e=u[u.length-1];){var d=e.body[e.body.length-1];if(d instanceof $e&&t.loopcontrol_target(d)===n&&e.body.pop(),e.body.length||e instanceof He&&(o||e.expression.has_side_effects(t)))break;u.pop()===o&&(o=null)}if(0==u.length)return X(de,n,{body:s.concat(X(le,n.expression,{body:n.expression}))}).optimize(t);if(1==u.length&&(u[0]===a||u[0]===o)){var h=!1,v=new Sn(function(e){if(h||e instanceof ke||e instanceof le)return!0;e instanceof $e&&v.loopcontrol_target(e)===n&&(h=!0)});if(n.walk(v),!h){var _,m=u[0].body.slice();return(_=u[0].expression)&&m.unshift(X(le,_,{body:_})),m.unshift(X(le,n.expression,{body:n.expression})),X(de,n,{body:m}).optimize(t)}}return n;function g(e,n){n&&!A(n)?n.body=n.body.concat(e.body):w(t,e,s)}}),e(Re,function(e,n){if(u(e.body,n),e.bcatch&&e.bfinally&&oe(e.bfinally.body,j)&&(e.bfinally=null),n.option("dead_code")&&oe(e.body,j)){var t=[];return e.bcatch&&(w(n,e.bcatch,t),t.forEach(function(e){e instanceof Ue&&e.definitions.forEach(function(e){var n=e.name.definition().redefined();n&&(e.name=e.name.clone(),e.name.thedef=n)})})),e.bfinally&&(t=t.concat(e.bfinally.body)),X(de,e,{body:t}).optimize(n)}return e}),Ue.DEFMETHOD("remove_initializers",function(){this.definitions.forEach(function(e){e.value=null})}),Ue.DEFMETHOD("to_assignments",function(e){var i=e.option("reduce_vars"),n=this.definitions.reduce(function(e,n){if(n.value){var t=X(_n,n.name,n.name);e.push(X(rn,n,{operator:"=",left:t,right:n.value})),i&&(t.definition().fixed=!1)}return(n=n.name.definition()).eliminated++,n.replaced--,e},[]);return 0==n.length?null:M(this,n)}),e(Ue,function(e,n){return 0==e.definitions.length?X(he,e):e}),e(Ye,function(s,r){var e=s.expression,p=e;r.option("reduce_vars")&&p instanceof _n&&(p=p.fixed_value());var n=p instanceof ke;if(r.option("unused")&&n&&!p.uses_arguments&&!p.uses_eval){for(var t=0,i=0,o=0,a=s.args.length;o<a;o++){var u=o>=p.argnames.length;if(u||p.argnames[o].__unused){if(d=s.args[o].drop_side_effect_free(r))s.args[t++]=d;else if(!u){s.args[t++]=X(yn,s.args[o],{value:0});continue}}else s.args[t++]=s.args[o];i=t}s.args.length=i}if(r.option("unsafe"))if(H(e))switch(e.name){case"Array":if(1!=s.args.length)return X(on,s,{elements:s.args}).optimize(r);break;case"Object":if(0==s.args.length)return X(an,s,{properties:[]});break;case"String":if(0==s.args.length)return X(bn,s,{value:""});if(s.args.length<=1)return X(nn,s,{left:s.args[0],operator:"+",right:X(bn,s,{value:""})}).optimize(r);break;case"Number":if(0==s.args.length)return X(yn,s,{value:0});if(1==s.args.length)return X(Qe,s,{expression:s.args[0],operator:"+"}).optimize(r);case"Boolean":if(0==s.args.length)return X(Cn,s);if(1==s.args.length)return X(Qe,s,{expression:X(Qe,s,{expression:s.args[0],operator:"!"}),operator:"!"}).optimize(r);break;case"RegExp":var c=[];if(oe(s.args,function(e){var n=e.evaluate(r);return c.unshift(n),e!==n}))try{return I(r,s,X(wn,s,{value:RegExp.apply(RegExp,c)}))}catch(e){r.warn("Error converting {expr} [{file}:{line},{col}]",{expr:s.print_to_string(),file:s.start.file,line:s.start.line,col:s.start.col})}}else if(e instanceof Xe)switch(e.property){case"toString":if(0==s.args.length&&!e.expression.may_throw_on_access(r))return X(nn,s,{left:X(bn,s,{value:""}),operator:"+",right:e.expression}).optimize(r);break;case"join":var f;if(e.expression instanceof on)if(!(0<s.args.length&&(f=s.args[0].evaluate(r))===s.args[0])){var l,d,h=[],v=[];return e.expression.elements.forEach(function(e){var n=e.evaluate(r);n!==e?v.push(n):(0<v.length&&(h.push(X(bn,s,{value:v.join(f)})),v.length=0),h.push(e))}),0<v.length&&h.push(X(bn,s,{value:v.join(f)})),0==h.length?X(bn,s,{value:""}):1==h.length?h[0].is_string(r)?h[0]:X(nn,h[0],{operator:"+",left:X(bn,s,{value:""}),right:h[0]}):""==f?(l=h[0].is_string(r)||h[1].is_string(r)?h.shift():X(bn,s,{value:""}),h.reduce(function(e,n){return X(nn,n,{operator:"+",left:e,right:n})},l).optimize(r)):((d=s.clone()).expression=d.expression.clone(),d.expression.expression=d.expression.expression.clone(),d.expression.expression.elements=h,I(r,s,d))}break;case"charAt":if(e.expression.is_string(r)){var _=s.args[0],m=_?_.evaluate(r):0;if(m!==_)return X(Ze,e,{expression:e.expression,property:q(0|m,_||e)}).optimize(r)}break;case"apply":if(2==s.args.length&&s.args[1]instanceof on)return(k=s.args[1].elements.slice()).unshift(s.args[0]),X(Ye,s,{expression:X(Xe,e,{expression:e.expression,property:"call"}),args:k}).optimize(r);break;case"call":var g=e.expression;if(g instanceof _n&&(g=g.fixed_value()),g instanceof ke&&!g.contains_this())return M(this,[s.args[0],X(Ye,s,{expression:e.expression,args:s.args.slice(1)})]).optimize(r)}if(r.option("unsafe_Function")&&H(e)&&"Function"==e.name){if(0==s.args.length)return X(Fe,s,{argnames:[],body:[]});if(oe(s.args,function(e){return e instanceof bn}))try{var b=Gn(A="n(function("+s.args.slice(0,-1).map(function(e){return e.value}).join(",")+"){"+s.args[s.args.length-1].value+"})"),y={ie8:r.option("ie8")};b.figure_out_scope(y);var w,x=new et(r.options);(b=b.transform(x)).figure_out_scope(y),b.compute_char_frequency(y),b.mangle_names(y),b.walk(new Sn(function(e){return!!w||(e instanceof ke?(w=e,!0):void 0)}));var A=Qn();return de.prototype._codegen.call(w,w,A),s.args=[X(bn,s,{value:w.argnames.map(function(e){return e.print_to_string()}).join(",")}),X(bn,s.args[s.args.length-1],{value:A.get().replace(/^\{|\}$/g,"")})],s}catch(e){if(!(e instanceof Hn))throw e;r.warn("Error parsing code passed to new Function [{file}:{line},{col}]",s.args[s.args.length-1].start),r.warn(e.toString())}}var E=n&&p.body[0];if(r.option("inline")&&E instanceof Te&&(!(F=E.value)||F.is_constant_expression())){var k=s.args.concat(F||X(En,s));return M(s,k).optimize(r)}if(n){var D,F,C,B,S=-1;if(r.option("inline")&&!p.uses_arguments&&!p.uses_eval&&!(p.name&&p instanceof Fe)&&(F=function(e){var n=p.body.length;if(r.option("inline")<3)return 1==n&&$(e);e=null;for(var t=0;t<n;t++){var i=p.body[t];if(i instanceof Le){if(e&&!oe(i.definitions,function(e){return!e.value}))return!1}else{if(i instanceof he)continue;if(e)return!1;e=i}}return $(e)}(E))&&(e===p||r.option("unused")&&1==(D=e.definition()).references.length&&!P(r,D)&&p.is_constant_expression(e.scope))&&!s.pure&&!p.contains_this()&&function(){var e=Object.create(null);do{if((C=r.parent(++S))instanceof Ie)e[C.argname.name]=!0;else if(C instanceof _e)B=[];else if(C instanceof _n&&C.fixed_value()instanceof Ae)return!1}while(!(C instanceof Ae));var n=!(C instanceof Ee)||r.toplevel.vars,t=r.option("inline");return!(!function(e,n){for(var t=p.body.length,i=0;i<t;i++){var r=p.body[i];if(r instanceof Le){if(!n)return!1;for(var o=r.definitions.length;0<=--o;){var a=r.definitions[o].name;if(e[a.name]||R(a.name)||C.var_names()[a.name])return!1;B&&B.push(a.definition())}}}return!0}(e,3<=t&&n)||!function(e,n){for(var t=0,i=p.argnames.length;t<i;t++){var r=p.argnames[t];if(!r.__unused){if(!n||e[r.name]||R(r.name)||C.var_names()[r.name])return!1;B&&B.push(r.definition())}}return!0}(e,2<=t&&n)||B&&0!=B.length&&U(p,B))}())return p._squeezed=!0,M(s,function(){var e=[],n=[];(function(e,n){for(var t=p.argnames.length,i=s.args.length;--i>=t;)n.push(s.args[i]);for(i=t;0<=--i;){var r=p.argnames[i],o=s.args[i];if(r.__unused||C.var_names()[r.name])o&&n.push(o);else{var a=X(ln,r,r);r.definition().orig.push(a),!o&&B&&(o=X(En,s)),z(e,n,a,o)}}e.reverse(),n.reverse()})(e,n),function(e,n){for(var t=n.length,i=0,r=p.body.length;i<r;i++){var o=p.body[i];if(o instanceof Le)for(var a=0,s=o.definitions.length;a<s;a++){var u=o.definitions[a],c=u.name;if(z(e,n,c,u.value),B){var f=c.definition(),l=X(_n,c,c);f.references.push(l),n.splice(t++,0,X(rn,u,{operator:"=",left:l,right:X(En,c)}))}}}}(e,n),n.push(F),e.length&&(o=C.body.indexOf(r.parent(S-1))+1,C.body.splice(o,0,X(Le,p,{definitions:e})));return n}()).optimize(r);if(r.option("side_effects")&&oe(p.body,j)){k=s.args.concat(X(En,s));return M(s,k).optimize(r)}}if(r.option("drop_console")&&e instanceof Ge){for(var T=e.expression;T.expression;)T=T.expression;if(H(T)&&"console"==T.name)return X(En,s).optimize(r)}if(r.option("negate_iife")&&r.parent()instanceof le&&N(s))return s.negate(r,!0);var O=s.evaluate(r);return O!==s?(O=q(O,s).optimize(r),I(r,O,s)):s;function $(e){return e?e instanceof Te?e.value?e.value.clone(!0):X(En,s):e instanceof le?X(Qe,e,{operator:"void",expression:e.body.clone(!0)}):void 0:X(En,s)}function z(e,n,t,i){var r=t.definition();C.variables.set(t.name,r),C.enclosed.push(r),C.var_names()[t.name]||(C.var_names()[t.name]=!0,e.push(X(Ve,t,{name:t,value:null})));var o=X(_n,t,t);r.references.push(o),i&&n.push(X(rn,s,{operator:"=",left:o,right:i}))}}),e(Je,function(e,n){if(n.option("unsafe")){var t=e.expression;if(H(t))switch(t.name){case"Object":case"RegExp":case"Function":case"Error":case"Array":return X(Ye,e,e).transform(n)}}return e}),e(We,function(e,t){if(!t.option("side_effects"))return e;var i,r,o=[];i=$(t),r=e.expressions.length-1,e.expressions.forEach(function(e,n){n<r&&(e=e.drop_side_effect_free(t,i)),e&&(l(o,e),i=!1)});var n=o.length-1;return function(){for(;0<n&&g(o[n],t);)n--;n<o.length-1&&(o[n]=X(Qe,e,{operator:"void",expression:o[n]}),o.length=n+1)}(),0==n?(e=Z(t.parent(),t.self(),o[0]))instanceof We||(e=e.optimize(t)):e.expressions=o,e}),Ke.DEFMETHOD("lift_sequences",function(e){if(e.option("sequences")&&this.expression instanceof We){var n=this.expression.expressions.slice(),t=this.clone();return t.expression=n.pop(),n.push(t),M(this,n).optimize(e)}return this}),e(en,function(e,n){return e.lift_sequences(n)}),e(Qe,function(e,n){var t=e.expression;if("delete"==e.operator&&!(t instanceof _n||t instanceof Ge||Q(t)))return t instanceof We?((t=t.expressions.slice()).push(X(Bn,e)),M(e,t).optimize(n)):M(e,[t,X(Bn,e)]).optimize(n);var i=e.lift_sequences(n);if(i!==e)return i;if(n.option("side_effects")&&"void"==e.operator)return(t=t.drop_side_effect_free(n))?(e.expression=t,e):X(En,e).optimize(n);if(n.option("booleans")){if("!"==e.operator&&t.is_truthy())return M(e,[t,X(Cn,e)]).optimize(n);if(n.in_boolean_context())switch(e.operator){case"!":if(t instanceof Qe&&"!"==t.operator)return t.expression;t instanceof nn&&(e=I(n,e,t.negate(n,$(n))));break;case"typeof":return n.warn("Boolean expression always true [{file}:{line},{col}]",e.start),(t instanceof _n?X(Bn,e):M(e,[t,X(Bn,e)])).optimize(n)}}if("-"==e.operator&&t instanceof Dn&&(t=t.transform(n)),t instanceof nn&&("+"==e.operator||"-"==e.operator)&&("*"==t.operator||"/"==t.operator||"%"==t.operator))return X(nn,e,{operator:t.operator,left:X(Qe,t.left,{operator:e.operator,expression:t.left}),right:t.right});if("-"!=e.operator||!(t instanceof yn||t instanceof Dn)){var r=e.evaluate(n);if(r!==e)return I(n,r=q(r,e).optimize(n),e)}return e}),nn.DEFMETHOD("lift_sequences",function(e){if(e.option("sequences")){if(this.left instanceof We){var n=this.left.expressions.slice();return(t=this.clone()).left=n.pop(),n.push(t),M(this,n).optimize(e)}if(this.right instanceof We&&!this.left.has_side_effects(e)){for(var t,i="="==this.operator&&this.left instanceof _n,r=(n=this.right.expressions).length-1,o=0;o<r&&(i||!n[o].has_side_effects(e));o++);if(o==r)return n=n.slice(),(t=this.clone()).right=n.pop(),n.push(t),M(this,n).optimize(e);if(0<o)return(t=this.clone()).right=M(this.right,n.slice(o)),(n=n.slice(0,o)).push(t),M(this,n).optimize(e)}}return this});var E=W("== === != !== * & | ^");function P(e,n){for(var t,i=0;t=e.parent(i);i++)if(t instanceof ke){var r=t.name;if(r&&r.definition()===n)break}return t}function k(e,n){return e instanceof _n||e.TYPE===n.TYPE}function U(t,n){var i=!1,r=new Sn(function(e){return!!i||(e instanceof _n&&te(e.definition(),n)?i=!0:void 0)}),o=new Sn(function(e){if(i)return!0;if(e instanceof Ae&&e!==t){var n=o.parent();if(n instanceof Ye&&n.expression===e)return;return e.walk(r),!0}});return t.walk(o),i}e(nn,function(t,n){function i(){return t.left.is_constant()||t.right.is_constant()||!t.left.has_side_effects(n)&&!t.right.has_side_effects(n)}function e(e){if(i()){e&&(t.operator=e);var n=t.left;t.left=t.right,t.right=n}}if(E(t.operator)&&t.right.is_constant()&&!t.left.is_constant()&&(t.left instanceof nn&&Jn[t.left.operator]>=Jn[t.operator]||e()),t=t.lift_sequences(n),n.option("comparisons"))switch(t.operator){case"===":case"!==":var r=!0;(t.left.is_string(n)&&t.right.is_string(n)||t.left.is_number(n)&&t.right.is_number(n)||t.left.is_boolean()&&t.right.is_boolean()||t.left.equivalent_to(t.right))&&(t.operator=t.operator.substr(0,2));case"==":case"!=":if(!r&&g(t.left,n))t.left=X(xn,t.left);else if(n.option("typeofs")&&t.left instanceof bn&&"undefined"==t.left.value&&t.right instanceof Qe&&"typeof"==t.right.operator){var o=t.right.expression;(o instanceof _n?!o.is_declared(n):o instanceof Ge&&n.option("ie8"))||(t.right=o,t.left=X(En,t.left).optimize(n),2==t.operator.length&&(t.operator+="="))}else if(t.left instanceof _n&&t.right instanceof _n&&t.left.definition()===t.right.definition()&&((u=t.left.fixed_value())instanceof on||u instanceof ke||u instanceof an))return X("="==t.operator[0]?Bn:Cn,t);break;case"&&":case"||":var a=t.left;if(a.operator==t.operator&&(a=a.right),a instanceof nn&&a.operator==("&&"==t.operator?"!==":"===")&&t.right instanceof nn&&a.operator==t.right.operator&&(g(a.left,n)&&t.right.left instanceof xn||a.left instanceof xn&&g(t.right.left,n))&&!a.right.has_side_effects(n)&&a.right.equivalent_to(t.right.right)){var s=X(nn,t,{operator:a.operator.slice(0,-1),left:X(xn,t),right:a.right});return a!==t.left&&(s=X(nn,t,{operator:t.operator,left:t.left.left,right:s})),s}}var u;if(n.option("booleans")&&"+"==t.operator&&n.in_boolean_context()){var c=t.left.evaluate(n),f=t.right.evaluate(n);if(c&&"string"==typeof c)return n.warn("+ in boolean context always true [{file}:{line},{col}]",t.start),M(t,[t.right,X(Bn,t)]).optimize(n);if(f&&"string"==typeof f)return n.warn("+ in boolean context always true [{file}:{line},{col}]",t.start),M(t,[t.left,X(Bn,t)]).optimize(n)}if(n.option("comparisons")&&t.is_boolean()){if(!(n.parent()instanceof nn)||n.parent()instanceof rn){var l=X(Qe,t,{operator:"!",expression:t.negate(n,$(n))});t=I(n,t,l)}switch(t.operator){case">":e("<");break;case">=":e("<=")}}if("+"==t.operator){if(t.right instanceof bn&&""==t.right.getValue()&&t.left.is_string(n))return t.left;if(t.left instanceof bn&&""==t.left.getValue()&&t.right.is_string(n))return t.right;if(t.left instanceof nn&&"+"==t.left.operator&&t.left.left instanceof bn&&""==t.left.left.getValue()&&t.right.is_string(n))return t.left=t.left.right,t.transform(n)}if(n.option("evaluate")){switch(t.operator){case"&&":if(!(c=m(t.left)))return n.warn("Condition left of && always false [{file}:{line},{col}]",t.start),Z(n.parent(),n.self(),t.left).optimize(n);if(!(c instanceof se))return n.warn("Condition left of && always true [{file}:{line},{col}]",t.start),M(t,[t.left,t.right]).optimize(n);if(f=t.right.evaluate(n)){if(!(f instanceof se)){if("&&"==(p=n.parent()).operator&&p.left===n.self()||n.option("booleans")&&n.in_boolean_context())return n.warn("Dropping side-effect-free && [{file}:{line},{col}]",t.start),t.left.optimize(n)}}else{if(n.option("booleans")&&n.in_boolean_context())return n.warn("Boolean && always false [{file}:{line},{col}]",t.start),M(t,[t.left,X(Cn,t)]).optimize(n);t.falsy=!0}if("||"==t.left.operator)if(!(d=t.left.right.evaluate(n)))return X(tn,t,{condition:t.left.left,consequent:t.right,alternative:t.left.right}).optimize(n);break;case"||":var p,d;if(!(c=m(t.left)))return n.warn("Condition left of || always false [{file}:{line},{col}]",t.start),M(t,[t.left,t.right]).optimize(n);if(!(c instanceof se))return n.warn("Condition left of || always true [{file}:{line},{col}]",t.start),Z(n.parent(),n.self(),t.left).optimize(n);if(f=t.right.evaluate(n)){if(!(f instanceof se)){if(n.option("booleans")&&n.in_boolean_context())return n.warn("Boolean || always true [{file}:{line},{col}]",t.start),M(t,[t.left,X(Bn,t)]).optimize(n);t.truthy=!0}}else if("||"==(p=n.parent()).operator&&p.left===n.self()||n.option("booleans")&&n.in_boolean_context())return n.warn("Dropping side-effect-free || [{file}:{line},{col}]",t.start),t.left.optimize(n);if("&&"==t.left.operator)if((d=t.left.right.evaluate(n))&&!(d instanceof se))return X(tn,t,{condition:t.left.left,consequent:t.left.right,alternative:t.right}).optimize(n)}var h=!0;switch(t.operator){case"+":if(t.left instanceof gn&&t.right instanceof nn&&"+"==t.right.operator&&t.right.left instanceof gn&&t.right.is_string(n)&&(t=X(nn,t,{operator:"+",left:X(bn,t.left,{value:""+t.left.getValue()+t.right.left.getValue(),start:t.left.start,end:t.right.left.end}),right:t.right.right})),t.right instanceof gn&&t.left instanceof nn&&"+"==t.left.operator&&t.left.right instanceof gn&&t.left.is_string(n)&&(t=X(nn,t,{operator:"+",left:t.left.left,right:X(bn,t.right,{value:""+t.left.right.getValue()+t.right.getValue(),start:t.left.right.start,end:t.right.end})})),t.left instanceof nn&&"+"==t.left.operator&&t.left.is_string(n)&&t.left.right instanceof gn&&t.right instanceof nn&&"+"==t.right.operator&&t.right.left instanceof gn&&t.right.is_string(n)&&(t=X(nn,t,{operator:"+",left:X(nn,t.left,{operator:"+",left:t.left.left,right:X(bn,t.left.right,{value:""+t.left.right.getValue()+t.right.left.getValue(),start:t.left.right.start,end:t.right.left.end})}),right:t.right.right})),t.right instanceof Qe&&"-"==t.right.operator&&t.left.is_number(n)){t=X(nn,t,{operator:"-",left:t.left,right:t.right.expression});break}if(t.left instanceof Qe&&"-"==t.left.operator&&i()&&t.right.is_number(n)){t=X(nn,t,{operator:"-",left:t.right,right:t.left.expression});break}case"*":h=n.option("unsafe_math");case"&":case"|":case"^":if(t.left.is_number(n)&&t.right.is_number(n)&&i()&&!(t.left instanceof nn&&t.left.operator!=t.operator&&Jn[t.left.operator]>=Jn[t.operator])){var v=X(nn,t,{operator:t.operator,left:t.right,right:t.left});t=t.right instanceof gn&&!(t.left instanceof gn)?I(n,v,t):I(n,t,v)}h&&t.is_number(n)&&(t.right instanceof nn&&t.right.operator==t.operator&&(t=X(nn,t,{operator:t.operator,left:X(nn,t.left,{operator:t.operator,left:t.left,right:t.right.left,start:t.left.start,end:t.right.left.end}),right:t.right.right})),t.right instanceof gn&&t.left instanceof nn&&t.left.operator==t.operator&&(t.left.left instanceof gn?t=X(nn,t,{operator:t.operator,left:X(nn,t.left,{operator:t.operator,left:t.left.left,right:t.right,start:t.left.left.start,end:t.right.end}),right:t.left.right}):t.left.right instanceof gn&&(t=X(nn,t,{operator:t.operator,left:X(nn,t.left,{operator:t.operator,left:t.left.right,right:t.right,start:t.left.right.start,end:t.right.end}),right:t.left.left}))),t.left instanceof nn&&t.left.operator==t.operator&&t.left.right instanceof gn&&t.right instanceof nn&&t.right.operator==t.operator&&t.right.left instanceof gn&&(t=X(nn,t,{operator:t.operator,left:X(nn,t.left,{operator:t.operator,left:X(nn,t.left.left,{operator:t.operator,left:t.left.right,right:t.right.left,start:t.left.right.start,end:t.right.left.end}),right:t.left.left}),right:t.right.right})))}}if(t.right instanceof nn&&t.right.operator==t.operator&&(ee(t.operator)||"+"==t.operator&&(t.right.left.is_string(n)||t.left.is_string(n)&&t.right.right.is_string(n))))return t.left=X(nn,t.left,{operator:t.operator,left:t.left,right:t.right.left}),t.right=t.right.right,t.transform(n);var _=t.evaluate(n);return _!==t?(_=q(_,t).optimize(n),I(n,_,t)):t;function m(e){return!!e.truthy||!e.falsy&&(!!e.is_truthy()||e.evaluate(n))}}),e(_n,function(e,n){var t,i=e.resolve_defines(n);if(i)return i.optimize(n);if(!n.option("ie8")&&H(e)&&(!e.scope.uses_with||!n.find_parent(xe)))switch(e.name){case"undefined":return X(En,e).optimize(n);case"NaN":return X(An,e).optimize(n);case"Infinity":return X(Dn,e).optimize(n)}if(n.option("reduce_vars")&&ne(e,n.parent())!==e){var r=e.definition(),o=e.fixed_value(),a=r.single_use;if(a&&o instanceof ke)if(r.scope===e.scope||n.option("reduce_funcs")&&1!=r.escaped&&!o.inlined){if(P(n,r))a=!1;else if((r.scope!==e.scope||r.orig[0]instanceof pn)&&"f"==(a=o.is_constant_expression(e.scope)))for(var s=e.scope;(s instanceof Ce||s instanceof Fe)&&(s.inlined=!0),s=s.parent_scope;);}else a=!1;if(a&&o){var u;if(o instanceof Ce&&(o._squeezed=!0,o=X(Fe,o,o)),0<r.recursive_refs&&o.name instanceof dn){var c=(u=o.clone(!0)).name.definition(),f=u.variables.get(u.name.name),l=f&&f.orig[0];l instanceof hn||(((l=X(hn,u.name,u.name)).scope=u).name=l,f=u.def_function(l)),u.walk(new Sn(function(e){e instanceof _n&&e.definition()===c&&(e.thedef=f).references.push(e)}))}else(u=o.optimize(n))===o&&(u=o.clone(!0));return u}if(o&&void 0===r.should_replace){var p;if(o instanceof mn)r.orig[0]instanceof pn||!oe(r.references,function(e){return r.scope===e.scope})||(p=o);else{var d=o.evaluate(n);d===o||!n.option("unsafe_regexp")&&d instanceof RegExp||(p=q(d,o))}if(p){var h,v=p.optimize(n).print_to_string().length;o.walk(new Sn(function(e){if(e instanceof _n&&(t=!0),t)return!0})),t?h=function(){var e=p.optimize(n);return e===p?e.clone(!0):e}:(v=Math.min(v,o.print_to_string().length),h=function(){var e=x(p.optimize(n),o);return e===p||e===o?e.clone(!0):e});var _=r.name.length,m=0;n.option("unused")&&!n.exposed(r)&&(m=(_+2+v)/(r.references.length-r.assignments)),r.should_replace=v<=_+m&&h}else r.should_replace=!1}if(r.should_replace)return r.should_replace()}return e}),e(En,function(e,n){if(n.option("unsafe_undefined")){var t=o(n,"undefined");if(t){var i=X(_n,e,{name:"undefined",scope:t.scope,thedef:t});return i.is_undefined=!0,i}}var r=ne(n.self(),n.parent());return r&&k(r,e)?e:X(Qe,e,{operator:"void",expression:X(yn,e,{value:0})})}),e(Dn,function(e,n){var t=ne(n.self(),n.parent());return t&&k(t,e)?e:!n.option("keep_infinity")||t&&!k(t,e)||o(n,"Infinity")?X(nn,e,{operator:"/",left:X(yn,e,{value:1}),right:X(yn,e,{value:0})}):e}),e(An,function(e,n){var t=ne(n.self(),n.parent());return t&&!k(t,e)||o(n,"NaN")?X(nn,e,{operator:"/",left:X(yn,e,{value:0}),right:X(yn,e,{value:0})}):e});var D=["+","-","/","*","%",">>","<<",">>>","|","^","&"],F=["*","|","^","&"];e(rn,function(a,s){var e;if(s.option("dead_code")&&a.left instanceof _n&&(e=a.left.definition()).scope===s.find_parent(ke)){var n,t=0,i=a;do{if(n=i,(i=s.parent(t++))instanceof Se){if(r(t,i))break;if(U(e.scope,[e]))break;return"="==a.operator?a.right:(e.fixed=!1,X(nn,a,{operator:a.operator.slice(0,-1),left:a.left,right:a.right}).optimize(s))}}while(i instanceof nn&&i.right===n||i instanceof We&&i.tail_node()===n)}return"="==(a=a.lift_sequences(s)).operator&&a.left instanceof _n&&a.right instanceof nn&&(a.right.left instanceof _n&&a.right.left.name==a.left.name&&te(a.right.operator,D)?(a.operator=a.right.operator+"=",a.right=a.right.right):a.right.right instanceof _n&&a.right.right.name==a.left.name&&te(a.right.operator,F)&&!a.right.left.has_side_effects(s)&&(a.operator=a.right.operator+"=",a.right=a.right.left)),a;function r(e,n){var t=a.right;a.right=X(xn,t);var i=n.may_throw(s);a.right=t;for(var r,o=a.left.definition().scope;(r=s.parent(e++))!==o;)if(r instanceof Re){if(r.bfinally)return!0;if(i&&r.bcatch)return!0}}}),e(tn,function(e,n){if(!n.option("conditionals"))return e;if(e.condition instanceof We){var t=e.condition.expressions.slice();return e.condition=t.pop(),t.push(e),M(e,t)}var i=e.condition.is_truthy()||e.condition.tail_node().evaluate(n);if(!i)return n.warn("Condition always false [{file}:{line},{col}]",e.start),M(e,[e.condition,e.alternative]).optimize(n);if(!(i instanceof se))return n.warn("Condition always true [{file}:{line},{col}]",e.start),M(e,[e.condition,e.consequent]).optimize(n);var r=i.negate(n,$(n));I(n,i,r)===r&&(e=X(tn,e,{condition:r,consequent:e.alternative,alternative:e.consequent}));var o,a=e.condition,s=e.consequent,u=e.alternative;if(a instanceof _n&&s instanceof _n&&a.definition()===s.definition())return X(nn,e,{operator:"||",left:a,right:u});if(s instanceof rn&&u instanceof rn&&s.operator==u.operator&&s.left.equivalent_to(u.left)&&(!e.condition.has_side_effects(n)||"="==s.operator&&!s.left.has_side_effects(n)))return X(rn,e,{operator:s.operator,left:s.left,right:X(tn,e,{condition:e.condition,consequent:s.right,alternative:u.right})});if(s instanceof Ye&&u.TYPE===s.TYPE&&0<s.args.length&&s.args.length==u.args.length&&s.expression.equivalent_to(u.expression)&&!e.condition.has_side_effects(n)&&!s.expression.has_side_effects(n)&&"number"==typeof(o=function(){for(var e=s.args,n=u.args,t=0,i=e.length;t<i;t++)if(!e[t].equivalent_to(n[t])){for(var r=t+1;r<i;r++)if(!e[r].equivalent_to(n[r]))return;return t}}())){var c=s.clone();return c.args[o]=X(tn,e,{condition:e.condition,consequent:s.args[o],alternative:u.args[o]}),c}if(s instanceof tn&&s.alternative.equivalent_to(u))return X(tn,e,{condition:X(nn,e,{left:e.condition,operator:"&&",right:s.condition}),consequent:s.consequent,alternative:u});if(s.equivalent_to(u))return M(e,[e.condition,s]).optimize(n);if((s instanceof We||u instanceof We)&&s.tail_node().equivalent_to(u.tail_node()))return M(e,[X(tn,e,{condition:e.condition,consequent:h(s),alternative:h(u)}),s.tail_node()]).optimize(n);if(s instanceof nn&&"||"==s.operator&&s.right.equivalent_to(u))return X(nn,e,{operator:"||",left:X(nn,e,{operator:"&&",left:e.condition,right:s.left}),right:u}).optimize(n);var f=n.option("booleans")&&n.in_boolean_context();return p(e.consequent)?d(e.alternative)?l(e.condition):X(nn,e,{operator:"||",left:l(e.condition),right:e.alternative}):d(e.consequent)?p(e.alternative)?l(e.condition.negate(n)):X(nn,e,{operator:"&&",left:l(e.condition.negate(n)),right:e.alternative}):p(e.alternative)?X(nn,e,{operator:"||",left:l(e.condition.negate(n)),right:e.consequent}):d(e.alternative)?X(nn,e,{operator:"&&",left:l(e.condition),right:e.consequent}):e;function l(e){return e.is_boolean()?e:X(Qe,e,{operator:"!",expression:e.negate(n)})}function p(e){return e instanceof Bn||f&&e instanceof gn&&e.getValue()||e instanceof Qe&&"!"==e.operator&&e.expression instanceof gn&&!e.expression.getValue()}function d(e){return e instanceof Cn||f&&e instanceof gn&&!e.getValue()||e instanceof Qe&&"!"==e.operator&&e.expression instanceof gn&&e.expression.getValue()}function h(e){return e instanceof We?M(e,e.expressions.slice(0,-1)):X(yn,e,{value:0})}}),e(Fn,function(e,n){if(!n.option("booleans"))return e;if(n.in_boolean_context())return X(yn,e,{value:+e.value});var t=n.parent();return t instanceof nn&&("=="==t.operator||"!="==t.operator)?(n.warn("Non-strict equality against boolean: {operator} {value} [{file}:{line},{col}]",{operator:t.operator,value:e.value,file:t.start.file,line:t.start.line,col:t.start.col}),X(yn,e,{value:+e.value})):X(Qe,e,{operator:"!",expression:X(yn,e,{value:1-e.value})})}),e(Ze,function(e,n){var t,i=e.expression,r=e.property;if(n.option("properties")){var o=r.evaluate(n);if(o!==r){if("string"==typeof o)if("undefined"==o)o=void 0;else(h=parseFloat(o)).toString()==o&&(o=h);r=e.property=x(r,q(o,r).transform(n));var a=""+o;if(Nn(a)&&a.length<=r.print_to_string().length+1)return X(Xe,e,{expression:i,property:a}).optimize(n)}}if(ne(e,n.parent()))return e;if(o!==r){var s=e.flatten_object(a,n);s&&(i=e.expression=s.expression,r=e.property=s.property)}if(n.option("properties")&&n.option("side_effects")&&r instanceof yn&&i instanceof on){var u=r.getValue(),c=i.elements;if(u in c){for(var f=!0,l=[],p=c.length;--p>u;){(h=c[p].drop_side_effect_free(n))&&(l.unshift(h),f&&h.has_side_effects(n)&&(f=!1))}var d=c[u];for(d=d instanceof kn?X(En,d):d,f||l.unshift(d);0<=--p;){var h;(h=c[p].drop_side_effect_free(n))?l.unshift(h):u--}return f?(l.push(d),M(e,l).optimize(n)):X(Ze,e,{expression:X(on,i,{elements:l}),property:X(yn,r,{value:u})})}}if(n.option("arguments")&&i instanceof _n&&"arguments"==i.name&&1==i.definition().orig.length&&(t=i.scope)instanceof ke&&r instanceof yn){u=r.getValue();var v=t.argnames[u];if(!v&&!n.option("keep_fargs"))for(;u>=t.argnames.length;)v=X(pn,t,{name:t.make_var_name("argument_"+t.argnames.length),scope:t}),t.argnames.push(v),t.enclosed.push(t.def_variable(v));if(v){var _=X(_n,e,v);return _.reference({}),_}}var m=e.evaluate(n);return m!==e?I(n,m=q(m,e).optimize(n),e):e}),ke.DEFMETHOD("contains_this",function(){var n,t=this;return t.walk(new Sn(function(e){return!!n||(e instanceof mn?n=!0:e!==t&&e instanceof Ae||void 0)})),n}),Ge.DEFMETHOD("flatten_object",function(e,n){if(n.option("properties")){var t=this.expression;if(t instanceof an)for(var i=t.properties,r=i.length;0<=--r;){var o=i[r];if(""+o.key==e){if(!oe(i,function(e){return e instanceof un}))break;var a=o.value;if(a instanceof Fe&&!(n.parent()instanceof Je)&&a.contains_this())break;return X(Ze,this,{expression:X(on,t,{elements:i.map(function(e){return e.value})}),property:X(yn,this,{value:r})})}}}}),e(Xe,function(e,n){"arguments"!=e.property&&"caller"!=e.property||n.warn("Function.protoype.{prop} not supported [{file}:{line},{col}]",{prop:e.property,file:e.start.file,line:e.start.line,col:e.start.col});var t=e.resolve_defines(n);if(t)return t.optimize(n);if(ne(e,n.parent()))return e;if(n.option("unsafe_proto")&&e.expression instanceof Xe&&"prototype"==e.expression.property){var i=e.expression.expression;if(H(i))switch(i.name){case"Array":e.expression=X(on,e.expression,{elements:[]});break;case"Function":e.expression=X(Fe,e.expression,{argnames:[],body:[]});break;case"Number":e.expression=X(yn,e.expression,{value:0});break;case"Object":e.expression=X(an,e.expression,{properties:[]});break;case"RegExp":e.expression=X(wn,e.expression,{value:/t/});break;case"String":e.expression=X(bn,e.expression,{value:""})}}var r=e.flatten_object(e.property,n);if(r)return r.optimize(n);var o=e.evaluate(n);return o!==e?I(n,o=q(o,e).optimize(n),e):e}),e(Te,function(e,n){return e.value&&g(e.value,n)&&(e.value=null),e}),e(Ve,function(e,n){var t=n.option("global_defs");return t&&ae(t,e.name.name)&&n.warn("global_defs "+e.name.name+" redefined [{file}:{line},{col}]",e.start),e})}(),function(){var n=function(e){for(var n=!0,t=0;t<e.length;t++)n&&e[t]instanceof ue&&e[t].body instanceof bn?e[t]=new fe({start:e[t].start,end:e[t].end,value:e[t].body.value}):!n||e[t]instanceof ue&&e[t].body instanceof bn||(n=!1);return e},i={Program:function(e){return new Ee({start:s(e),end:u(e),body:n(e.body.map(c))})},FunctionDeclaration:function(e){return new Ce({start:s(e),end:u(e),name:c(e.id),argnames:e.params.map(c),body:n(c(e.body).body)})},FunctionExpression:function(e){return new Fe({start:s(e),end:u(e),name:c(e.id),argnames:e.params.map(c),body:n(c(e.body).body)})},ExpressionStatement:function(e){return new le({start:s(e),end:u(e),body:c(e.expression)})},TryStatement:function(e){var n=e.handlers||[e.handler];if(1<n.length||e.guardedHandlers&&e.guardedHandlers.length)throw new Error("Multiple catch clauses are not supported.");return new Re({start:s(e),end:u(e),body:c(e.block).body,bcatch:c(n[0]),bfinally:e.finalizer?new Pe(c(e.finalizer)):null})},Property:function(e){var n=e.key,t={start:s(n),end:u(e.value),key:"Identifier"==n.type?n.name:n.value,value:c(e.value)};return"init"==e.kind?new un(t):(t.key=new K({name:t.key}),t.value=new De(t.value),"get"==e.kind?new Z(t):"set"==e.kind?new X(t):void 0)},ArrayExpression:function(e){return new on({start:s(e),end:u(e),elements:e.elements.map(function(e){return null===e?new kn:c(e)})})},ObjectExpression:function(e){return new an({start:s(e),end:u(e),properties:e.properties.map(function(e){return e.type="Property",c(e)})})},SequenceExpression:function(e){return new We({start:s(e),end:u(e),expressions:e.expressions.map(c)})},MemberExpression:function(e){return new(e.computed?Ze:Xe)({start:s(e),end:u(e),property:e.computed?c(e.property):e.property.name,expression:c(e.object)})},SwitchCase:function(e){return new(e.test?He:Ne)({start:s(e),end:u(e),expression:c(e.test),body:e.consequent.map(c)})},VariableDeclaration:function(e){return new Le({start:s(e),end:u(e),definitions:e.declarations.map(c)})},Literal:function(e){var n=e.value,t={start:s(e),end:u(e)};if(null===n)return new xn(t);switch(typeof n){case"string":return t.value=n,new bn(t);case"number":return t.value=n,new yn(t);case"boolean":return new(n?Bn:Cn)(t);default:var i=e.regex;return i&&i.pattern?t.value=new RegExp(i.pattern,i.flags).toString():t.value=e.regex&&e.raw?e.raw:n,new wn(t)}},Identifier:function(e){var n=o[o.length-2];return new("LabeledStatement"==n.type?Q:"VariableDeclarator"==n.type&&n.id===e?ln:"FunctionExpression"==n.type?n.id===e?hn:pn:"FunctionDeclaration"==n.type?n.id===e?dn:pn:"CatchClause"==n.type?vn:"BreakStatement"==n.type||"ContinueStatement"==n.type?ee:_n)({start:s(e),end:u(e),name:e.name})}};function r(e){if("Literal"==e.type)return null!=e.raw?e.raw:e.value+""}function s(e){var n=e.loc,t=n&&n.start,i=e.range;return new F({file:n&&n.source,line:t&&t.line,col:t&&t.column,pos:i?i[0]:e.start,endline:t&&t.line,endcol:t&&t.column,endpos:i?i[0]:e.start,raw:r(e)})}function u(e){var n=e.loc,t=n&&n.end,i=e.range;return new F({file:n&&n.source,line:t&&t.line,col:t&&t.column,pos:i?i[1]:e.end,endline:t&&t.line,endcol:t&&t.column,endpos:i?i[1]:e.end,raw:r(e)})}function e(e,n,t){var o="function From_Moz_"+e+"(M){\n";o+="return new U2."+n.name+"({\nstart: my_start_token(M),\nend: my_end_token(M)";var a="function To_Moz_"+e+"(M){\n";a+="return {\ntype: "+JSON.stringify(e),t&&t.split(/\s*,\s*/).forEach(function(e){var n=/([a-z0-9$_]+)(=|@|>|%)([a-z0-9$_]+)/i.exec(e);if(!n)throw new Error("Can't understand property map: "+e);var t=n[1],i=n[2],r=n[3];switch(o+=",\n"+r+": ",a+=",\n"+t+": ",i){case"@":o+="M."+t+".map(from_moz)",a+="M."+r+".map(to_moz)";break;case">":o+="from_moz(M."+t+")",a+="to_moz(M."+r+")";break;case"=":o+="M."+t,a+="M."+r;break;case"%":o+="from_moz(M."+t+").body",a+="to_moz_block(M)";break;default:throw new Error("Can't understand operator in propmap: "+e)}}),o+="\n})\n}",a+="\n}\n}",o=new Function("U2","my_start_token","my_end_token","from_moz","return("+o+")")(h,s,u,c),a=new Function("to_moz","to_moz_block","to_moz_scope","return("+a+")")(l,p,d),i[e]=o,f(n,a)}i.UpdateExpression=i.UnaryExpression=function(e){return new(("prefix"in e?e.prefix:"UnaryExpression"==e.type)?Qe:en)({start:s(e),end:u(e),operator:e.operator,expression:c(e.argument)})},e("EmptyStatement",he),e("BlockStatement",de,"body@body"),e("IfStatement",Me,"test>condition, consequent>body, alternate>alternative"),e("LabeledStatement",ve,"label>label, body>body"),e("BreakStatement",$e,"label>label"),e("ContinueStatement",ze,"label>label"),e("WithStatement",xe,"object>expression, body>body"),e("SwitchStatement",qe,"discriminant>expression, cases@body"),e("ReturnStatement",Te,"argument>value"),e("ThrowStatement",G,"argument>value"),e("WhileStatement",be,"test>condition, body>body"),e("DoWhileStatement",ge,"test>condition, body>body"),e("ForStatement",ye,"init>init, test>condition, update>step, body>body"),e("ForInStatement",we,"left>init, right>object, body>body"),e("DebuggerStatement",ce),e("VariableDeclarator",Ve,"id>name, init>value"),e("CatchClause",Ie,"param>argname, body%body"),e("ThisExpression",mn),e("BinaryExpression",nn,"operator=operator, left>left, right>right"),e("LogicalExpression",nn,"operator=operator, left>left, right>right"),e("AssignmentExpression",rn,"operator=operator, left>left, right>right"),e("ConditionalExpression",tn,"test>condition, consequent>consequent, alternate>alternative"),e("NewExpression",Je,"callee>expression, arguments@args"),e("CallExpression",Ye,"callee>expression, arguments@args"),f(Ee,function(e){return d("Program",e)}),f(Ce,function(e){return{type:"FunctionDeclaration",id:l(e.name),params:e.argnames.map(l),body:d("BlockStatement",e)}}),f(Fe,function(e){return{type:"FunctionExpression",id:l(e.name),params:e.argnames.map(l),body:d("BlockStatement",e)}}),f(fe,function(e){return{type:"ExpressionStatement",expression:{type:"Literal",value:e.value}}}),f(le,function(e){return{type:"ExpressionStatement",expression:l(e.body)}}),f(je,function(e){return{type:"SwitchCase",test:l(e.expression),consequent:e.body.map(l)}}),f(Re,function(e){return{type:"TryStatement",block:p(e),handler:l(e.bcatch),guardedHandlers:[],finalizer:l(e.bfinally)}}),f(Ie,function(e){return{type:"CatchClause",param:l(e.argname),guard:null,body:p(e)}}),f(Ue,function(e){return{type:"VariableDeclaration",kind:"var",declarations:e.definitions.map(l)}}),f(We,function(e){return{type:"SequenceExpression",expressions:e.expressions.map(l)}}),f(Ge,function(e){var n=e instanceof Ze;return{type:"MemberExpression",object:l(e.expression),computed:n,property:n?l(e.property):{type:"Identifier",name:e.property}}}),f(Ke,function(e){return{type:"++"==e.operator||"--"==e.operator?"UpdateExpression":"UnaryExpression",operator:e.operator,prefix:e instanceof Qe,argument:l(e.expression)}}),f(nn,function(e){return{type:"&&"==e.operator||"||"==e.operator?"LogicalExpression":"BinaryExpression",left:l(e.left),operator:e.operator,right:l(e.right)}}),f(on,function(e){return{type:"ArrayExpression",elements:e.elements.map(l)}}),f(an,function(e){return{type:"ObjectExpression",properties:e.properties.map(l)}}),f(sn,function(e){var n,t={type:"Literal",value:e.key instanceof K?e.key.name:e.key};return e instanceof un?n="init":e instanceof Z?n="get":e instanceof X&&(n="set"),{type:"Property",kind:n,key:t,value:l(e.value)}}),f(cn,function(e){var n=e.definition();return{type:"Identifier",name:n?n.mangled_name||n.name:e.name}}),f(wn,function(e){var n=e.value;return{type:"Literal",value:n,raw:n.toString(),regex:{pattern:n.source,flags:n.toString().match(/[gimuy]*$/)[0]}}}),f(gn,function(e){var n=e.value;return"number"==typeof n&&(n<0||0===n&&1/n<0)?{type:"UnaryExpression",operator:"-",prefix:!0,argument:{type:"Literal",value:-n,raw:e.start.raw}}:{type:"Literal",value:n,raw:e.start.raw}}),f(a,function(e){return{type:"Identifier",name:String(e.value)}}),Fn.DEFMETHOD("to_mozilla_ast",gn.prototype.to_mozilla_ast),xn.DEFMETHOD("to_mozilla_ast",gn.prototype.to_mozilla_ast),kn.DEFMETHOD("to_mozilla_ast",function(){return null}),pe.DEFMETHOD("to_mozilla_ast",de.prototype.to_mozilla_ast),ke.DEFMETHOD("to_mozilla_ast",Fe.prototype.to_mozilla_ast);var o=null;function c(e){o.push(e);var n=null!=e?i[e.type](e):null;return o.pop(),n}function f(e,r){e.DEFMETHOD("to_mozilla_ast",function(){return n=r(e=this),t=e.start,i=e.end,null!=t.pos&&null!=i.endpos&&(n.range=[t.pos,i.endpos]),t.line&&(n.loc={start:{line:t.line,column:t.col},end:i.endline?{line:i.endline,column:i.endcol}:null},t.file&&(n.loc.source=t.file)),n;var e,n,t,i})}function l(e){return null!=e?e.to_mozilla_ast():null}function p(e){return{type:"BlockStatement",body:e.body.map(l)}}function d(e,n){var t=n.body.map(l);return n.body[0]instanceof le&&n.body[0].body instanceof bn&&t.unshift(l(new he(n.body[0]))),{type:e,body:t}}se.from_mozilla_ast=function(e){var n=o;o=[];var t=c(e);return o=n,t}}();var y="undefined"==typeof atob?function(e){return new Buffer(e,"base64").toString()}:atob,w="undefined"==typeof btoa?function(e){return new Buffer(e).toString("base64")}:btoa;function x(n,t,e){t[n]&&e.forEach(function(e){t[e]&&("object"!=typeof t[e]&&(t[e]={}),n in t[e]||(t[e][n]=t[n]))})}function A(e){e&&("props"in e?e.props instanceof O||(e.props=O.fromObject(e.props)):e.props=new O)}function E(e){return{props:e.props.toObject()}}h.Dictionary=O,h.TreeWalker=Sn,h.TreeTransformer=Xn,h.minify=function(e,n){var t,i,r=se.warn_function;try{var o,a=(n=Y(n,{compress:{},ie8:!1,keep_fnames:!1,mangle:{},nameCache:null,output:{},parse:{},rename:void 0,sourceMap:!1,timings:!1,toplevel:!1,warnings:!1,wrap:!1},!0)).timings&&{start:Date.now()};void 0===n.rename&&(n.rename=n.compress&&n.mangle),x("ie8",n,["compress","mangle","output"]),x("keep_fnames",n,["compress","mangle"]),x("toplevel",n,["compress","mangle"]),x("warnings",n,["compress"]),n.mangle&&(n.mangle=Y(n.mangle,{cache:n.nameCache&&(n.nameCache.vars||{}),eval:!1,ie8:!1,keep_fnames:!1,properties:!1,reserved:[],toplevel:!1},!0),n.mangle.properties&&("object"!=typeof n.mangle.properties&&(n.mangle.properties={}),n.mangle.properties.keep_quoted&&(o=n.mangle.properties.reserved,Array.isArray(o)||(o=[]),n.mangle.properties.reserved=o),!n.nameCache||"cache"in n.mangle.properties||(n.mangle.properties.cache=n.nameCache.props||{})),A(n.mangle.cache),A(n.mangle.properties.cache)),n.sourceMap&&(n.sourceMap=Y(n.sourceMap,{content:null,filename:null,includeSources:!1,root:null,url:null},!0));var s,u=[];if(n.warnings&&!se.warn_function&&(se.warn_function=function(e){u.push(e)}),a&&(a.parse=Date.now()),e instanceof Ee)s=e;else{for(var c in"string"==typeof e&&(e=[e]),n.parse=n.parse||{},n.parse.toplevel=null,e)if(ae(e,c)&&(n.parse.filename=c,n.parse.toplevel=Gn(e[c],n.parse),n.sourceMap&&"inline"==n.sourceMap.content)){if(1<Object.keys(e).length)throw new Error("inline source map only works with singular input");n.sourceMap.content=(t=e[c],(i=/\n\/\/# sourceMappingURL=data:application\/json(;.*?)?;base64,(.*)/.exec(t))?y(i[2]):(se.warn("inline source map not found"),null))}s=n.parse.toplevel}o&&function(e,n){function t(e){v(n,e)}e.walk(new Sn(function(e){e instanceof un&&e.quote?t(e.key):e instanceof Ze&&b(e.property,t)}))}(s,o),n.wrap&&(s=s.wrap_commonjs(n.wrap)),a&&(a.rename=Date.now()),n.rename&&(s.figure_out_scope(n.mangle),s.expand_names(n.mangle)),a&&(a.compress=Date.now()),n.compress&&(s=new et(n.compress).compress(s)),a&&(a.scope=Date.now()),n.mangle&&s.figure_out_scope(n.mangle),a&&(a.mangle=Date.now()),n.mangle&&(s.compute_char_frequency(n.mangle),s.mangle_names(n.mangle)),a&&(a.properties=Date.now()),n.mangle&&n.mangle.properties&&(s=d(s,n.mangle.properties)),a&&(a.output=Date.now());var f={};if(n.output.ast&&(f.ast=s),!ae(n.output,"code")||n.output.code){if(n.sourceMap&&("string"==typeof n.sourceMap.content&&(n.sourceMap.content=JSON.parse(n.sourceMap.content)),n.output.source_map=function(s){s=Y(s,{file:null,root:null,orig:null,orig_line_diff:0,dest_line_diff:0});var u=new MOZ_SourceMap.SourceMapGenerator({file:s.file,sourceRoot:s.root}),c=s.orig&&new MOZ_SourceMap.SourceMapConsumer(s.orig);return c&&Array.isArray(s.orig.sources)&&c._sources.toArray().forEach(function(e){var n=c.sourceContentFor(e,!0);n&&u.setSourceContent(e,n)}),{add:function(e,n,t,i,r,o){if(c){var a=c.originalPositionFor({line:i,column:r});if(null===a.source)return;e=a.source,i=a.line,r=a.column,o=a.name||o}u.addMapping({generated:{line:n+s.dest_line_diff,column:t},original:{line:i+s.orig_line_diff,column:r},source:e,name:o})},get:function(){return u},toString:function(){return JSON.stringify(u.toJSON())}}}({file:n.sourceMap.filename,orig:n.sourceMap.content,root:n.sourceMap.root}),n.sourceMap.includeSources)){if(e instanceof Ee)throw new Error("original source content unavailable");for(var c in e)ae(e,c)&&n.output.source_map.get().setSourceContent(c,e[c])}delete n.output.ast,delete n.output.code;var l=Qn(n.output);s.print(l),f.code=l.get(),n.sourceMap&&(f.map=n.output.source_map.toString(),"inline"==n.sourceMap.url?f.code+="\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,"+w(f.map):n.sourceMap.url&&(f.code+="\n//# sourceMappingURL="+n.sourceMap.url))}return n.nameCache&&n.mangle&&(n.mangle.cache&&(n.nameCache.vars=E(n.mangle.cache)),n.mangle.properties&&n.mangle.properties.cache&&(n.nameCache.props=E(n.mangle.properties.cache))),a&&(a.end=Date.now(),f.timings={parse:.001*(a.rename-a.parse),rename:.001*(a.compress-a.rename),compress:.001*(a.scope-a.compress),scope:.001*(a.mangle-a.scope),mangle:.001*(a.properties-a.mangle),properties:.001*(a.output-a.properties),output:.001*(a.end-a.output),total:.001*(a.end-a.start)}),u.length&&(f.warnings=u),f}catch(e){return{error:e}}finally{se.warn_function=r}},h.parse=Gn,h._push_uniq=v}("undefined"==typeof UglifyJS?UglifyJS={}:UglifyJS);module.exports = global.UglifyJS
delete global.UglifyJS

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"buffer":2}],5:[function(require,module,exports){
var uglify = require('..')

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
*
*/
josephUglify = function (src , options) {

  var res = uglify.minify(src , options || {})

  if (res.error) {
    throw res.error
  }
  return res.code
}

},{"..":4}]},{},[5]);
