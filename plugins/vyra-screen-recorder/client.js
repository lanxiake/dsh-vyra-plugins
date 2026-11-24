/**
 * vyra-screen-recorder — 浏览器端：工具条按钮、录制源选择、截图标注与编码。
 *
 * 编码全部在浏览器里做：宿主只给 JPEG 帧和 WAV，WebCodecs 编 VP9 + Opus，
 * 再用内置 webm-muxer 封装成单个 .webm。这样不需要 Python / ffmpeg。
 */
window.__ModuleLoader__.load({
  id: 'vyra-screen-recorder',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    // ------------------------------------------------------------------ vendor
    const WebMMuxer = (function () {
      const module = { exports: {} }
      "use strict";
var WebMMuxer = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __accessCheck = (obj, member, msg) => {
    if (!member.has(obj))
      throw TypeError("Cannot " + msg);
  };
  var __privateGet = (obj, member, getter) => {
    __accessCheck(obj, member, "read from private field");
    return getter ? getter.call(obj) : member.get(obj);
  };
  var __privateAdd = (obj, member, value) => {
    if (member.has(obj))
      throw TypeError("Cannot add the same private member more than once");
    member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  };
  var __privateSet = (obj, member, value, setter) => {
    __accessCheck(obj, member, "write to private field");
    setter ? setter.call(obj, value) : member.set(obj, value);
    return value;
  };
  var __privateMethod = (obj, member, method) => {
    __accessCheck(obj, member, "access private method");
    return method;
  };

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    ArrayBufferTarget: () => ArrayBufferTarget,
    FileSystemWritableFileStreamTarget: () => FileSystemWritableFileStreamTarget,
    Muxer: () => Muxer,
    StreamTarget: () => StreamTarget,
    SubtitleEncoder: () => SubtitleEncoder
  });

  // src/ebml.ts
  var EBMLFloat32 = class {
    constructor(value) {
      this.value = value;
    }
  };
  var EBMLFloat64 = class {
    constructor(value) {
      this.value = value;
    }
  };
  var measureUnsignedInt = (value) => {
    if (value < 1 << 8) {
      return 1;
    } else if (value < 1 << 16) {
      return 2;
    } else if (value < 1 << 24) {
      return 3;
    } else if (value < 2 ** 32) {
      return 4;
    } else if (value < 2 ** 40) {
      return 5;
    } else {
      return 6;
    }
  };
  var measureEBMLVarInt = (value) => {
    if (value < (1 << 7) - 1) {
      return 1;
    } else if (value < (1 << 14) - 1) {
      return 2;
    } else if (value < (1 << 21) - 1) {
      return 3;
    } else if (value < (1 << 28) - 1) {
      return 4;
    } else if (value < 2 ** 35 - 1) {
      return 5;
    } else if (value < 2 ** 42 - 1) {
      return 6;
    } else {
      throw new Error("EBML VINT size not supported " + value);
    }
  };

  // src/misc.ts
  var readBits = (bytes, start, end) => {
    let result = 0;
    for (let i = start; i < end; i++) {
      let byteIndex = Math.floor(i / 8);
      let byte = bytes[byteIndex];
      let bitIndex = 7 - (i & 7);
      let bit = (byte & 1 << bitIndex) >> bitIndex;
      result <<= 1;
      result |= bit;
    }
    return result;
  };
  var writeBits = (bytes, start, end, value) => {
    for (let i = start; i < end; i++) {
      let byteIndex = Math.floor(i / 8);
      let byte = bytes[byteIndex];
      let bitIndex = 7 - (i & 7);
      byte &= ~(1 << bitIndex);
      byte |= (value & 1 << end - i - 1) >> end - i - 1 << bitIndex;
      bytes[byteIndex] = byte;
    }
  };

  // src/target.ts
  var isTarget = Symbol("isTarget");
  var Target = class {
  };
  isTarget;
  var ArrayBufferTarget = class extends Target {
    constructor() {
      super(...arguments);
      this.buffer = null;
    }
  };
  var StreamTarget = class extends Target {
    constructor(options) {
      super();
      this.options = options;
      if (typeof options !== "object") {
        throw new TypeError("StreamTarget requires an options object to be passed to its constructor.");
      }
      if (options.onData) {
        if (typeof options.onData !== "function") {
          throw new TypeError("options.onData, when provided, must be a function.");
        }
        if (options.onData.length < 2) {
          throw new TypeError(
            "options.onData, when provided, must be a function that takes in at least two arguments (data and position). Ignoring the position argument, which specifies the byte offset at which the data is to be written, can lead to broken outputs."
          );
        }
      }
      if (options.onHeader && typeof options.onHeader !== "function") {
        throw new TypeError("options.onHeader, when provided, must be a function.");
      }
      if (options.onCluster && typeof options.onCluster !== "function") {
        throw new TypeError("options.onCluster, when provided, must be a function.");
      }
      if (options.chunked !== void 0 && typeof options.chunked !== "boolean") {
        throw new TypeError("options.chunked, when provided, must be a boolean.");
      }
      if (options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize < 1024)) {
        throw new TypeError("options.chunkSize, when provided, must be an integer and not smaller than 1024.");
      }
    }
  };
  var FileSystemWritableFileStreamTarget = class extends Target {
    constructor(stream, options) {
      super();
      this.stream = stream;
      this.options = options;
      if (!(stream instanceof FileSystemWritableFileStream)) {
        throw new TypeError("FileSystemWritableFileStreamTarget requires a FileSystemWritableFileStream instance.");
      }
      if (options !== void 0 && typeof options !== "object") {
        throw new TypeError("FileSystemWritableFileStreamTarget's options, when provided, must be an object.");
      }
      if (options) {
        if (options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize <= 0)) {
          throw new TypeError("options.chunkSize, when provided, must be a positive integer");
        }
      }
    }
  };

  // src/writer.ts
  var _helper, _helperView, _writeByte, writeByte_fn, _writeFloat32, writeFloat32_fn, _writeFloat64, writeFloat64_fn, _writeUnsignedInt, writeUnsignedInt_fn, _writeString, writeString_fn;
  var Writer = class {
    constructor() {
      __privateAdd(this, _writeByte);
      __privateAdd(this, _writeFloat32);
      __privateAdd(this, _writeFloat64);
      __privateAdd(this, _writeUnsignedInt);
      __privateAdd(this, _writeString);
      this.pos = 0;
      __privateAdd(this, _helper, new Uint8Array(8));
      __privateAdd(this, _helperView, new DataView(__privateGet(this, _helper).buffer));
      this.offsets = /* @__PURE__ */ new WeakMap();
      this.dataOffsets = /* @__PURE__ */ new WeakMap();
    }
    seek(newPos) {
      this.pos = newPos;
    }
    writeEBMLVarInt(value, width = measureEBMLVarInt(value)) {
      let pos = 0;
      switch (width) {
        case 1:
          __privateGet(this, _helperView).setUint8(pos++, 1 << 7 | value);
          break;
        case 2:
          __privateGet(this, _helperView).setUint8(pos++, 1 << 6 | value >> 8);
          __privateGet(this, _helperView).setUint8(pos++, value);
          break;
        case 3:
          __privateGet(this, _helperView).setUint8(pos++, 1 << 5 | value >> 16);
          __privateGet(this, _helperView).setUint8(pos++, value >> 8);
          __privateGet(this, _helperView).setUint8(pos++, value);
          break;
        case 4:
          __privateGet(this, _helperView).setUint8(pos++, 1 << 4 | value >> 24);
          __privateGet(this, _helperView).setUint8(pos++, value >> 16);
          __privateGet(this, _helperView).setUint8(pos++, value >> 8);
          __privateGet(this, _helperView).setUint8(pos++, value);
          break;
        case 5:
          __privateGet(this, _helperView).setUint8(pos++, 1 << 3 | value / 2 ** 32 & 7);
          __privateGet(this, _helperView).setUint8(pos++, value >> 24);
          __privateGet(this, _helperView).setUint8(pos++, value >> 16);
          __privateGet(this, _helperView).setUint8(pos++, value >> 8);
          __privateGet(this, _helperView).setUint8(pos++, value);
          break;
        case 6:
          __privateGet(this, _helperView).setUint8(pos++, 1 << 2 | value / 2 ** 40 & 3);
          __privateGet(this, _helperView).setUint8(pos++, value / 2 ** 32 | 0);
          __privateGet(this, _helperView).setUint8(pos++, value >> 24);
          __privateGet(this, _helperView).setUint8(pos++, value >> 16);
          __privateGet(this, _helperView).setUint8(pos++, value >> 8);
          __privateGet(this, _helperView).setUint8(pos++, value);
          break;
        default:
          throw new Error("Bad EBML VINT size " + width);
      }
      this.write(__privateGet(this, _helper).subarray(0, pos));
    }
    writeEBML(data) {
      if (data === null)
        return;
      if (data instanceof Uint8Array) {
        this.write(data);
      } else if (Array.isArray(data)) {
        for (let elem of data) {
          this.writeEBML(elem);
        }
      } else {
        this.offsets.set(data, this.pos);
        __privateMethod(this, _writeUnsignedInt, writeUnsignedInt_fn).call(this, data.id);
        if (Array.isArray(data.data)) {
          let sizePos = this.pos;
          let sizeSize = data.size === -1 ? 1 : data.size ?? 4;
          if (data.size === -1) {
            __privateMethod(this, _writeByte, writeByte_fn).call(this, 255);
          } else {
            this.seek(this.pos + sizeSize);
          }
          let startPos = this.pos;
          this.dataOffsets.set(data, startPos);
          this.writeEBML(data.data);
          if (data.size !== -1) {
            let size = this.pos - startPos;
            let endPos = this.pos;
            this.seek(sizePos);
            this.writeEBMLVarInt(size, sizeSize);
            this.seek(endPos);
          }
        } else if (typeof data.data === "number") {
          let size = data.size ?? measureUnsignedInt(data.data);
          this.writeEBMLVarInt(size);
          __privateMethod(this, _writeUnsignedInt, writeUnsignedInt_fn).call(this, data.data, size);
        } else if (typeof data.data === "string") {
          this.writeEBMLVarInt(data.data.length);
          __privateMethod(this, _writeString, writeString_fn).call(this, data.data);
        } else if (data.data instanceof Uint8Array) {
          this.writeEBMLVarInt(data.data.byteLength, data.size);
          this.write(data.data);
        } else if (data.data instanceof EBMLFloat32) {
          this.writeEBMLVarInt(4);
          __privateMethod(this, _writeFloat32, writeFloat32_fn).call(this, data.data.value);
        } else if (data.data instanceof EBMLFloat64) {
          this.writeEBMLVarInt(8);
          __privateMethod(this, _writeFloat64, writeFloat64_fn).call(this, data.data.value);
        }
      }
    }
  };
  _helper = new WeakMap();
  _helperView = new WeakMap();
  _writeByte = new WeakSet();
  writeByte_fn = function(value) {
    __privateGet(this, _helperView).setUint8(0, value);
    this.write(__privateGet(this, _helper).subarray(0, 1));
  };
  _writeFloat32 = new WeakSet();
  writeFloat32_fn = function(value) {
    __privateGet(this, _helperView).setFloat32(0, value, false);
    this.write(__privateGet(this, _helper).subarray(0, 4));
  };
  _writeFloat64 = new WeakSet();
  writeFloat64_fn = function(value) {
    __privateGet(this, _helperView).setFloat64(0, value, false);
    this.write(__privateGet(this, _helper));
  };
  _writeUnsignedInt = new WeakSet();
  writeUnsignedInt_fn = function(value, width = measureUnsignedInt(value)) {
    let pos = 0;
    switch (width) {
      case 6:
        __privateGet(this, _helperView).setUint8(pos++, value / 2 ** 40 | 0);
      case 5:
        __privateGet(this, _helperView).setUint8(pos++, value / 2 ** 32 | 0);
      case 4:
        __privateGet(this, _helperView).setUint8(pos++, value >> 24);
      case 3:
        __privateGet(this, _helperView).setUint8(pos++, value >> 16);
      case 2:
        __privateGet(this, _helperView).setUint8(pos++, value >> 8);
      case 1:
        __privateGet(this, _helperView).setUint8(pos++, value);
        break;
      default:
        throw new Error("Bad UINT size " + width);
    }
    this.write(__privateGet(this, _helper).subarray(0, pos));
  };
  _writeString = new WeakSet();
  writeString_fn = function(str) {
    this.write(new Uint8Array(str.split("").map((x) => x.charCodeAt(0))));
  };
  var _target, _buffer, _bytes, _ensureSize, ensureSize_fn;
  var ArrayBufferTargetWriter = class extends Writer {
    constructor(target) {
      super();
      __privateAdd(this, _ensureSize);
      __privateAdd(this, _target, void 0);
      __privateAdd(this, _buffer, new ArrayBuffer(2 ** 16));
      __privateAdd(this, _bytes, new Uint8Array(__privateGet(this, _buffer)));
      __privateSet(this, _target, target);
    }
    write(data) {
      __privateMethod(this, _ensureSize, ensureSize_fn).call(this, this.pos + data.byteLength);
      __privateGet(this, _bytes).set(data, this.pos);
      this.pos += data.byteLength;
    }
    finalize() {
      __privateMethod(this, _ensureSize, ensureSize_fn).call(this, this.pos);
      __privateGet(this, _target).buffer = __privateGet(this, _buffer).slice(0, this.pos);
    }
  };
  _target = new WeakMap();
  _buffer = new WeakMap();
  _bytes = new WeakMap();
  _ensureSize = new WeakSet();
  ensureSize_fn = function(size) {
    let newLength = __privateGet(this, _buffer).byteLength;
    while (newLength < size)
      newLength *= 2;
    if (newLength === __privateGet(this, _buffer).byteLength)
      return;
    let newBuffer = new ArrayBuffer(newLength);
    let newBytes = new Uint8Array(newBuffer);
    newBytes.set(__privateGet(this, _bytes), 0);
    __privateSet(this, _buffer, newBuffer);
    __privateSet(this, _bytes, newBytes);
  };
  var _trackingWrites, _trackedWrites, _trackedStart, _trackedEnd;
  var BaseStreamTargetWriter = class extends Writer {
    constructor(target) {
      super();
      this.target = target;
      __privateAdd(this, _trackingWrites, false);
      __privateAdd(this, _trackedWrites, void 0);
      __privateAdd(this, _trackedStart, void 0);
      __privateAdd(this, _trackedEnd, void 0);
    }
    write(data) {
      if (!__privateGet(this, _trackingWrites))
        return;
      let pos = this.pos;
      if (pos < __privateGet(this, _trackedStart)) {
        if (pos + data.byteLength <= __privateGet(this, _trackedStart))
          return;
        data = data.subarray(__privateGet(this, _trackedStart) - pos);
        pos = 0;
      }
      let neededSize = pos + data.byteLength - __privateGet(this, _trackedStart);
      let newLength = __privateGet(this, _trackedWrites).byteLength;
      while (newLength < neededSize)
        newLength *= 2;
      if (newLength !== __privateGet(this, _trackedWrites).byteLength) {
        let copy = new Uint8Array(newLength);
        copy.set(__privateGet(this, _trackedWrites), 0);
        __privateSet(this, _trackedWrites, copy);
      }
      __privateGet(this, _trackedWrites).set(data, pos - __privateGet(this, _trackedStart));
      __privateSet(this, _trackedEnd, Math.max(__privateGet(this, _trackedEnd), pos + data.byteLength));
    }
    startTrackingWrites() {
      __privateSet(this, _trackingWrites, true);
      __privateSet(this, _trackedWrites, new Uint8Array(2 ** 10));
      __privateSet(this, _trackedStart, this.pos);
      __privateSet(this, _trackedEnd, this.pos);
    }
    getTrackedWrites() {
      if (!__privateGet(this, _trackingWrites)) {
        throw new Error("Can't get tracked writes since nothing was tracked.");
      }
      let slice = __privateGet(this, _trackedWrites).subarray(0, __privateGet(this, _trackedEnd) - __privateGet(this, _trackedStart));
      let result = {
        data: slice,
        start: __privateGet(this, _trackedStart),
        end: __privateGet(this, _trackedEnd)
      };
      __privateSet(this, _trackedWrites, void 0);
      __privateSet(this, _trackingWrites, false);
      return result;
    }
  };
  _trackingWrites = new WeakMap();
  _trackedWrites = new WeakMap();
  _trackedStart = new WeakMap();
  _trackedEnd = new WeakMap();
  var DEFAULT_CHUNK_SIZE = 2 ** 24;
  var MAX_CHUNKS_AT_ONCE = 2;
  var _sections, _lastFlushEnd, _ensureMonotonicity, _chunked, _chunkSize, _chunks, _writeDataIntoChunks, writeDataIntoChunks_fn, _insertSectionIntoChunk, insertSectionIntoChunk_fn, _createChunk, createChunk_fn, _flushChunks, flushChunks_fn;
  var StreamTargetWriter = class extends BaseStreamTargetWriter {
    constructor(target, ensureMonotonicity) {
      super(target);
      __privateAdd(this, _writeDataIntoChunks);
      __privateAdd(this, _insertSectionIntoChunk);
      __privateAdd(this, _createChunk);
      __privateAdd(this, _flushChunks);
      __privateAdd(this, _sections, []);
      __privateAdd(this, _lastFlushEnd, 0);
      __privateAdd(this, _ensureMonotonicity, void 0);
      __privateAdd(this, _chunked, void 0);
      __privateAdd(this, _chunkSize, void 0);
      __privateAdd(this, _chunks, []);
      __privateSet(this, _ensureMonotonicity, ensureMonotonicity);
      __privateSet(this, _chunked, target.options?.chunked ?? false);
      __privateSet(this, _chunkSize, target.options?.chunkSize ?? DEFAULT_CHUNK_SIZE);
    }
    write(data) {
      super.write(data);
      __privateGet(this, _sections).push({
        data: data.slice(),
        start: this.pos
      });
      this.pos += data.byteLength;
    }
    flush() {
      if (__privateGet(this, _sections).length === 0)
        return;
      let chunks = [];
      let sorted = [...__privateGet(this, _sections)].sort((a, b) => a.start - b.start);
      chunks.push({
        start: sorted[0].start,
        size: sorted[0].data.byteLength
      });
      for (let i = 1; i < sorted.length; i++) {
        let lastChunk = chunks[chunks.length - 1];
        let section = sorted[i];
        if (section.start <= lastChunk.start + lastChunk.size) {
          lastChunk.size = Math.max(lastChunk.size, section.start + section.data.byteLength - lastChunk.start);
        } else {
          chunks.push({
            start: section.start,
            size: section.data.byteLength
          });
        }
      }
      for (let chunk of chunks) {
        chunk.data = new Uint8Array(chunk.size);
        for (let section of __privateGet(this, _sections)) {
          if (chunk.start <= section.start && section.start < chunk.start + chunk.size) {
            chunk.data.set(section.data, section.start - chunk.start);
          }
        }
        if (__privateGet(this, _chunked)) {
          __privateMethod(this, _writeDataIntoChunks, writeDataIntoChunks_fn).call(this, chunk.data, chunk.start);
          __privateMethod(this, _flushChunks, flushChunks_fn).call(this);
        } else {
          if (__privateGet(this, _ensureMonotonicity) && chunk.start < __privateGet(this, _lastFlushEnd)) {
            throw new Error("Internal error: Monotonicity violation.");
          }
          this.target.options.onData?.(chunk.data, chunk.start);
          __privateSet(this, _lastFlushEnd, chunk.start + chunk.data.byteLength);
        }
      }
      __privateGet(this, _sections).length = 0;
    }
    finalize() {
      if (__privateGet(this, _chunked)) {
        __privateMethod(this, _flushChunks, flushChunks_fn).call(this, true);
      }
    }
  };
  _sections = new WeakMap();
  _lastFlushEnd = new WeakMap();
  _ensureMonotonicity = new WeakMap();
  _chunked = new WeakMap();
  _chunkSize = new WeakMap();
  _chunks = new WeakMap();
  _writeDataIntoChunks = new WeakSet();
  writeDataIntoChunks_fn = function(data, position) {
    let chunkIndex = __privateGet(this, _chunks).findIndex((x) => x.start <= position && position < x.start + __privateGet(this, _chunkSize));
    if (chunkIndex === -1)
      chunkIndex = __privateMethod(this, _createChunk, createChunk_fn).call(this, position);
    let chunk = __privateGet(this, _chunks)[chunkIndex];
    let relativePosition = position - chunk.start;
    let toWrite = data.subarray(0, Math.min(__privateGet(this, _chunkSize) - relativePosition, data.byteLength));
    chunk.data.set(toWrite, relativePosition);
    let section = {
      start: relativePosition,
      end: relativePosition + toWrite.byteLength
    };
    __privateMethod(this, _insertSectionIntoChunk, insertSectionIntoChunk_fn).call(this, chunk, section);
    if (chunk.written[0].start === 0 && chunk.written[0].end === __privateGet(this, _chunkSize)) {
      chunk.shouldFlush = true;
    }
    if (__privateGet(this, _chunks).length > MAX_CHUNKS_AT_ONCE) {
      for (let i = 0; i < __privateGet(this, _chunks).length - 1; i++) {
        __privateGet(this, _chunks)[i].shouldFlush = true;
      }
      __privateMethod(this, _flushChunks, flushChunks_fn).call(this);
    }
    if (toWrite.byteLength < data.byteLength) {
      __privateMethod(this, _writeDataIntoChunks, writeDataIntoChunks_fn).call(this, data.subarray(toWrite.byteLength), position + toWrite.byteLength);
    }
  };
  _insertSectionIntoChunk = new WeakSet();
  insertSectionIntoChunk_fn = function(chunk, section) {
    let low = 0;
    let high = chunk.written.length - 1;
    let index = -1;
    while (low <= high) {
      let mid = Math.floor(low + (high - low + 1) / 2);
      if (chunk.written[mid].start <= section.start) {
        low = mid + 1;
        index = mid;
      } else {
        high = mid - 1;
      }
    }
    chunk.written.splice(index + 1, 0, section);
    if (index === -1 || chunk.written[index].end < section.start)
      index++;
    while (index < chunk.written.length - 1 && chunk.written[index].end >= chunk.written[index + 1].start) {
      chunk.written[index].end = Math.max(chunk.written[index].end, chunk.written[index + 1].end);
      chunk.written.splice(index + 1, 1);
    }
  };
  _createChunk = new WeakSet();
  createChunk_fn = function(includesPosition) {
    let start = Math.floor(includesPosition / __privateGet(this, _chunkSize)) * __privateGet(this, _chunkSize);
    let chunk = {
      start,
      data: new Uint8Array(__privateGet(this, _chunkSize)),
      written: [],
      shouldFlush: false
    };
    __privateGet(this, _chunks).push(chunk);
    __privateGet(this, _chunks).sort((a, b) => a.start - b.start);
    return __privateGet(this, _chunks).indexOf(chunk);
  };
  _flushChunks = new WeakSet();
  flushChunks_fn = function(force = false) {
    for (let i = 0; i < __privateGet(this, _chunks).length; i++) {
      let chunk = __privateGet(this, _chunks)[i];
      if (!chunk.shouldFlush && !force)
        continue;
      for (let section of chunk.written) {
        if (__privateGet(this, _ensureMonotonicity) && chunk.start + section.start < __privateGet(this, _lastFlushEnd)) {
          throw new Error("Internal error: Monotonicity violation.");
        }
        this.target.options.onData?.(
          chunk.data.subarray(section.start, section.end),
          chunk.start + section.start
        );
        __privateSet(this, _lastFlushEnd, chunk.start + section.end);
      }
      __privateGet(this, _chunks).splice(i--, 1);
    }
  };
  var FileSystemWritableFileStreamTargetWriter = class extends StreamTargetWriter {
    constructor(target, ensureMonotonicity) {
      super(new StreamTarget({
        onData: (data, position) => target.stream.write({
          type: "write",
          data,
          position
        }),
        chunked: true,
        chunkSize: target.options?.chunkSize
      }), ensureMonotonicity);
    }
  };

  // src/muxer.ts
  var VIDEO_TRACK_NUMBER = 1;
  var AUDIO_TRACK_NUMBER = 2;
  var SUBTITLE_TRACK_NUMBER = 3;
  var VIDEO_TRACK_TYPE = 1;
  var AUDIO_TRACK_TYPE = 2;
  var SUBTITLE_TRACK_TYPE = 17;
  var MAX_CHUNK_LENGTH_MS = 2 ** 15;
  var CODEC_PRIVATE_MAX_SIZE = 2 ** 13;
  var APP_NAME = "https://github.com/Vanilagy/webm-muxer";
  var SEGMENT_SIZE_BYTES = 6;
  var CLUSTER_SIZE_BYTES = 5;
  var FIRST_TIMESTAMP_BEHAVIORS = ["strict", "offset", "permissive"];
  var _options, _writer, _segment, _segmentInfo, _seekHead, _tracksElement, _segmentDuration, _colourElement, _videoCodecPrivate, _audioCodecPrivate, _subtitleCodecPrivate, _cues, _currentCluster, _currentClusterTimestamp, _duration, _videoChunkQueue, _audioChunkQueue, _subtitleChunkQueue, _firstVideoTimestamp, _firstAudioTimestamp, _lastVideoTimestamp, _lastAudioTimestamp, _lastSubtitleTimestamp, _colorSpace, _finalized, _validateOptions, validateOptions_fn, _createFileHeader, createFileHeader_fn, _writeEBMLHeader, writeEBMLHeader_fn, _createCodecPrivatePlaceholders, createCodecPrivatePlaceholders_fn, _createColourElement, createColourElement_fn, _createSeekHead, createSeekHead_fn, _createSegmentInfo, createSegmentInfo_fn, _createTracks, createTracks_fn, _createSegment, createSegment_fn, _createCues, createCues_fn, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn, _segmentDataOffset, segmentDataOffset_get, _writeVideoDecoderConfig, writeVideoDecoderConfig_fn, _fixVP9ColorSpace, fixVP9ColorSpace_fn, _writeSubtitleChunks, writeSubtitleChunks_fn, _createInternalChunk, createInternalChunk_fn, _validateTimestamp, validateTimestamp_fn, _writeBlock, writeBlock_fn, _createCodecPrivateElement, createCodecPrivateElement_fn, _writeCodecPrivate, writeCodecPrivate_fn, _createNewCluster, createNewCluster_fn, _finalizeCurrentCluster, finalizeCurrentCluster_fn, _ensureNotFinalized, ensureNotFinalized_fn;
  var Muxer = class {
    constructor(options) {
      __privateAdd(this, _validateOptions);
      __privateAdd(this, _createFileHeader);
      __privateAdd(this, _writeEBMLHeader);
      __privateAdd(this, _createCodecPrivatePlaceholders);
      __privateAdd(this, _createColourElement);
      __privateAdd(this, _createSeekHead);
      __privateAdd(this, _createSegmentInfo);
      __privateAdd(this, _createTracks);
      __privateAdd(this, _createSegment);
      __privateAdd(this, _createCues);
      __privateAdd(this, _maybeFlushStreamingTargetWriter);
      __privateAdd(this, _segmentDataOffset);
      __privateAdd(this, _writeVideoDecoderConfig);
      __privateAdd(this, _fixVP9ColorSpace);
      __privateAdd(this, _writeSubtitleChunks);
      __privateAdd(this, _createInternalChunk);
      __privateAdd(this, _validateTimestamp);
      __privateAdd(this, _writeBlock);
      __privateAdd(this, _createCodecPrivateElement);
      __privateAdd(this, _writeCodecPrivate);
      __privateAdd(this, _createNewCluster);
      __privateAdd(this, _finalizeCurrentCluster);
      __privateAdd(this, _ensureNotFinalized);
      __privateAdd(this, _options, void 0);
      __privateAdd(this, _writer, void 0);
      __privateAdd(this, _segment, void 0);
      __privateAdd(this, _segmentInfo, void 0);
      __privateAdd(this, _seekHead, void 0);
      __privateAdd(this, _tracksElement, void 0);
      __privateAdd(this, _segmentDuration, void 0);
      __privateAdd(this, _colourElement, void 0);
      __privateAdd(this, _videoCodecPrivate, void 0);
      __privateAdd(this, _audioCodecPrivate, void 0);
      __privateAdd(this, _subtitleCodecPrivate, void 0);
      __privateAdd(this, _cues, void 0);
      __privateAdd(this, _currentCluster, void 0);
      __privateAdd(this, _currentClusterTimestamp, void 0);
      __privateAdd(this, _duration, 0);
      __privateAdd(this, _videoChunkQueue, []);
      __privateAdd(this, _audioChunkQueue, []);
      __privateAdd(this, _subtitleChunkQueue, []);
      __privateAdd(this, _firstVideoTimestamp, void 0);
      __privateAdd(this, _firstAudioTimestamp, void 0);
      __privateAdd(this, _lastVideoTimestamp, -1);
      __privateAdd(this, _lastAudioTimestamp, -1);
      __privateAdd(this, _lastSubtitleTimestamp, -1);
      __privateAdd(this, _colorSpace, void 0);
      __privateAdd(this, _finalized, false);
      __privateMethod(this, _validateOptions, validateOptions_fn).call(this, options);
      __privateSet(this, _options, {
        type: "webm",
        firstTimestampBehavior: "strict",
        ...options
      });
      this.target = options.target;
      let ensureMonotonicity = !!__privateGet(this, _options).streaming;
      if (options.target instanceof ArrayBufferTarget) {
        __privateSet(this, _writer, new ArrayBufferTargetWriter(options.target));
      } else if (options.target instanceof StreamTarget) {
        __privateSet(this, _writer, new StreamTargetWriter(options.target, ensureMonotonicity));
      } else if (options.target instanceof FileSystemWritableFileStreamTarget) {
        __privateSet(this, _writer, new FileSystemWritableFileStreamTargetWriter(options.target, ensureMonotonicity));
      } else {
        throw new Error(`Invalid target: ${options.target}`);
      }
      __privateMethod(this, _createFileHeader, createFileHeader_fn).call(this);
    }
    addVideoChunk(chunk, meta, timestamp) {
      if (!(chunk instanceof EncodedVideoChunk)) {
        throw new TypeError("addVideoChunk's first argument (chunk) must be of type EncodedVideoChunk.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addVideoChunk's second argument (meta), when provided, must be an object.");
      }
      if (timestamp !== void 0 && (!Number.isFinite(timestamp) || timestamp < 0)) {
        throw new TypeError(
          "addVideoChunk's third argument (timestamp), when provided, must be a non-negative real number."
        );
      }
      let data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      this.addVideoChunkRaw(data, chunk.type, timestamp ?? chunk.timestamp, meta);
    }
    addVideoChunkRaw(data, type, timestamp, meta) {
      if (!(data instanceof Uint8Array)) {
        throw new TypeError("addVideoChunkRaw's first argument (data) must be an instance of Uint8Array.");
      }
      if (type !== "key" && type !== "delta") {
        throw new TypeError("addVideoChunkRaw's second argument (type) must be either 'key' or 'delta'.");
      }
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new TypeError("addVideoChunkRaw's third argument (timestamp) must be a non-negative real number.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addVideoChunkRaw's fourth argument (meta), when provided, must be an object.");
      }
      __privateMethod(this, _ensureNotFinalized, ensureNotFinalized_fn).call(this);
      if (!__privateGet(this, _options).video)
        throw new Error("No video track declared.");
      if (__privateGet(this, _firstVideoTimestamp) === void 0)
        __privateSet(this, _firstVideoTimestamp, timestamp);
      if (meta)
        __privateMethod(this, _writeVideoDecoderConfig, writeVideoDecoderConfig_fn).call(this, meta);
      let videoChunk = __privateMethod(this, _createInternalChunk, createInternalChunk_fn).call(this, data, type, timestamp, VIDEO_TRACK_NUMBER);
      if (__privateGet(this, _options).video.codec === "V_VP9")
        __privateMethod(this, _fixVP9ColorSpace, fixVP9ColorSpace_fn).call(this, videoChunk);
      __privateSet(this, _lastVideoTimestamp, videoChunk.timestamp);
      while (__privateGet(this, _audioChunkQueue).length > 0 && __privateGet(this, _audioChunkQueue)[0].timestamp <= videoChunk.timestamp) {
        let audioChunk = __privateGet(this, _audioChunkQueue).shift();
        __privateMethod(this, _writeBlock, writeBlock_fn).call(this, audioChunk, false);
      }
      if (!__privateGet(this, _options).audio || videoChunk.timestamp <= __privateGet(this, _lastAudioTimestamp)) {
        __privateMethod(this, _writeBlock, writeBlock_fn).call(this, videoChunk, true);
      } else {
        __privateGet(this, _videoChunkQueue).push(videoChunk);
      }
      __privateMethod(this, _writeSubtitleChunks, writeSubtitleChunks_fn).call(this);
      __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
    }
    addAudioChunk(chunk, meta, timestamp) {
      if (!(chunk instanceof EncodedAudioChunk)) {
        throw new TypeError("addAudioChunk's first argument (chunk) must be of type EncodedAudioChunk.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addAudioChunk's second argument (meta), when provided, must be an object.");
      }
      if (timestamp !== void 0 && (!Number.isFinite(timestamp) || timestamp < 0)) {
        throw new TypeError(
          "addAudioChunk's third argument (timestamp), when provided, must be a non-negative real number."
        );
      }
      let data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      this.addAudioChunkRaw(data, chunk.type, timestamp ?? chunk.timestamp, meta);
    }
    addAudioChunkRaw(data, type, timestamp, meta) {
      if (!(data instanceof Uint8Array)) {
        throw new TypeError("addAudioChunkRaw's first argument (data) must be an instance of Uint8Array.");
      }
      if (type !== "key" && type !== "delta") {
        throw new TypeError("addAudioChunkRaw's second argument (type) must be either 'key' or 'delta'.");
      }
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new TypeError("addAudioChunkRaw's third argument (timestamp) must be a non-negative real number.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addAudioChunkRaw's fourth argument (meta), when provided, must be an object.");
      }
      __privateMethod(this, _ensureNotFinalized, ensureNotFinalized_fn).call(this);
      if (!__privateGet(this, _options).audio)
        throw new Error("No audio track declared.");
      if (__privateGet(this, _firstAudioTimestamp) === void 0)
        __privateSet(this, _firstAudioTimestamp, timestamp);
      if (meta?.decoderConfig) {
        if (__privateGet(this, _options).streaming) {
          __privateSet(this, _audioCodecPrivate, __privateMethod(this, _createCodecPrivateElement, createCodecPrivateElement_fn).call(this, meta.decoderConfig.description));
        } else {
          __privateMethod(this, _writeCodecPrivate, writeCodecPrivate_fn).call(this, __privateGet(this, _audioCodecPrivate), meta.decoderConfig.description);
        }
      }
      let audioChunk = __privateMethod(this, _createInternalChunk, createInternalChunk_fn).call(this, data, type, timestamp, AUDIO_TRACK_NUMBER);
      __privateSet(this, _lastAudioTimestamp, audioChunk.timestamp);
      while (__privateGet(this, _videoChunkQueue).length > 0 && __privateGet(this, _videoChunkQueue)[0].timestamp <= audioChunk.timestamp) {
        let videoChunk = __privateGet(this, _videoChunkQueue).shift();
        __privateMethod(this, _writeBlock, writeBlock_fn).call(this, videoChunk, true);
      }
      if (!__privateGet(this, _options).video || audioChunk.timestamp <= __privateGet(this, _lastVideoTimestamp)) {
        __privateMethod(this, _writeBlock, writeBlock_fn).call(this, audioChunk, !__privateGet(this, _options).video);
      } else {
        __privateGet(this, _audioChunkQueue).push(audioChunk);
      }
      __privateMethod(this, _writeSubtitleChunks, writeSubtitleChunks_fn).call(this);
      __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
    }
    addSubtitleChunk(chunk, meta, timestamp) {
      if (typeof chunk !== "object" || !chunk) {
        throw new TypeError("addSubtitleChunk's first argument (chunk) must be an object.");
      } else {
        if (!(chunk.body instanceof Uint8Array)) {
          throw new TypeError("body must be an instance of Uint8Array.");
        }
        if (!Number.isFinite(chunk.timestamp) || chunk.timestamp < 0) {
          throw new TypeError("timestamp must be a non-negative real number.");
        }
        if (!Number.isFinite(chunk.duration) || chunk.duration < 0) {
          throw new TypeError("duration must be a non-negative real number.");
        }
        if (chunk.additions && !(chunk.additions instanceof Uint8Array)) {
          throw new TypeError("additions, when present, must be an instance of Uint8Array.");
        }
      }
      if (typeof meta !== "object") {
        throw new TypeError("addSubtitleChunk's second argument (meta) must be an object.");
      }
      __privateMethod(this, _ensureNotFinalized, ensureNotFinalized_fn).call(this);
      if (!__privateGet(this, _options).subtitles)
        throw new Error("No subtitle track declared.");
      if (meta?.decoderConfig) {
        if (__privateGet(this, _options).streaming) {
          __privateSet(this, _subtitleCodecPrivate, __privateMethod(this, _createCodecPrivateElement, createCodecPrivateElement_fn).call(this, meta.decoderConfig.description));
        } else {
          __privateMethod(this, _writeCodecPrivate, writeCodecPrivate_fn).call(this, __privateGet(this, _subtitleCodecPrivate), meta.decoderConfig.description);
        }
      }
      let subtitleChunk = __privateMethod(this, _createInternalChunk, createInternalChunk_fn).call(this, chunk.body, "key", timestamp ?? chunk.timestamp, SUBTITLE_TRACK_NUMBER, chunk.duration, chunk.additions);
      __privateSet(this, _lastSubtitleTimestamp, subtitleChunk.timestamp);
      __privateGet(this, _subtitleChunkQueue).push(subtitleChunk);
      __privateMethod(this, _writeSubtitleChunks, writeSubtitleChunks_fn).call(this);
      __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
    }
    finalize() {
      if (__privateGet(this, _finalized)) {
        throw new Error("Cannot finalize a muxer more than once.");
      }
      while (__privateGet(this, _videoChunkQueue).length > 0)
        __privateMethod(this, _writeBlock, writeBlock_fn).call(this, __privateGet(this, _videoChunkQueue).shift(), true);
      while (__privateGet(this, _audioChunkQueue).length > 0)
        __privateMethod(this, _writeBlock, writeBlock_fn).call(this, __privateGet(this, _audioChunkQueue).shift(), true);
      while (__privateGet(this, _subtitleChunkQueue).length > 0 && __privateGet(this, _subtitleChunkQueue)[0].timestamp <= __privateGet(this, _duration)) {
        __privateMethod(this, _writeBlock, writeBlock_fn).call(this, __privateGet(this, _subtitleChunkQueue).shift(), false);
      }
      if (__privateGet(this, _currentCluster)) {
        __privateMethod(this, _finalizeCurrentCluster, finalizeCurrentCluster_fn).call(this);
      }
      __privateGet(this, _writer).writeEBML(__privateGet(this, _cues));
      if (!__privateGet(this, _options).streaming) {
        let endPos = __privateGet(this, _writer).pos;
        let segmentSize = __privateGet(this, _writer).pos - __privateGet(this, _segmentDataOffset, segmentDataOffset_get);
        __privateGet(this, _writer).seek(__privateGet(this, _writer).offsets.get(__privateGet(this, _segment)) + 4);
        __privateGet(this, _writer).writeEBMLVarInt(segmentSize, SEGMENT_SIZE_BYTES);
        __privateGet(this, _segmentDuration).data = new EBMLFloat64(__privateGet(this, _duration));
        __privateGet(this, _writer).seek(__privateGet(this, _writer).offsets.get(__privateGet(this, _segmentDuration)));
        __privateGet(this, _writer).writeEBML(__privateGet(this, _segmentDuration));
        __privateGet(this, _seekHead).data[0].data[1].data = __privateGet(this, _writer).offsets.get(__privateGet(this, _cues)) - __privateGet(this, _segmentDataOffset, segmentDataOffset_get);
        __privateGet(this, _seekHead).data[1].data[1].data = __privateGet(this, _writer).offsets.get(__privateGet(this, _segmentInfo)) - __privateGet(this, _segmentDataOffset, segmentDataOffset_get);
        __privateGet(this, _seekHead).data[2].data[1].data = __privateGet(this, _writer).offsets.get(__privateGet(this, _tracksElement)) - __privateGet(this, _segmentDataOffset, segmentDataOffset_get);
        __privateGet(this, _writer).seek(__privateGet(this, _writer).offsets.get(__privateGet(this, _seekHead)));
        __privateGet(this, _writer).writeEBML(__privateGet(this, _seekHead));
        __privateGet(this, _writer).seek(endPos);
      }
      __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
      __privateGet(this, _writer).finalize();
      __privateSet(this, _finalized, true);
    }
  };
  _options = new WeakMap();
  _writer = new WeakMap();
  _segment = new WeakMap();
  _segmentInfo = new WeakMap();
  _seekHead = new WeakMap();
  _tracksElement = new WeakMap();
  _segmentDuration = new WeakMap();
  _colourElement = new WeakMap();
  _videoCodecPrivate = new WeakMap();
  _audioCodecPrivate = new WeakMap();
  _subtitleCodecPrivate = new WeakMap();
  _cues = new WeakMap();
  _currentCluster = new WeakMap();
  _currentClusterTimestamp = new WeakMap();
  _duration = new WeakMap();
  _videoChunkQueue = new WeakMap();
  _audioChunkQueue = new WeakMap();
  _subtitleChunkQueue = new WeakMap();
  _firstVideoTimestamp = new WeakMap();
  _firstAudioTimestamp = new WeakMap();
  _lastVideoTimestamp = new WeakMap();
  _lastAudioTimestamp = new WeakMap();
  _lastSubtitleTimestamp = new WeakMap();
  _colorSpace = new WeakMap();
  _finalized = new WeakMap();
  _validateOptions = new WeakSet();
  validateOptions_fn = function(options) {
    if (typeof options !== "object") {
      throw new TypeError("The muxer requires an options object to be passed to its constructor.");
    }
    if (!(options.target instanceof Target)) {
      throw new TypeError("The target must be provided and an instance of Target.");
    }
    if (options.video) {
      if (typeof options.video.codec !== "string") {
        throw new TypeError(`Invalid video codec: ${options.video.codec}. Must be a string.`);
      }
      if (!Number.isInteger(options.video.width) || options.video.width <= 0) {
        throw new TypeError(`Invalid video width: ${options.video.width}. Must be a positive integer.`);
      }
      if (!Number.isInteger(options.video.height) || options.video.height <= 0) {
        throw new TypeError(`Invalid video height: ${options.video.height}. Must be a positive integer.`);
      }
      if (options.video.frameRate !== void 0) {
        if (!Number.isFinite(options.video.frameRate) || options.video.frameRate <= 0) {
          throw new TypeError(
            `Invalid video frame rate: ${options.video.frameRate}. Must be a positive number.`
          );
        }
      }
      if (options.video.alpha !== void 0 && typeof options.video.alpha !== "boolean") {
        throw new TypeError(`Invalid video alpha: ${options.video.alpha}. Must be a boolean.`);
      }
    }
    if (options.audio) {
      if (typeof options.audio.codec !== "string") {
        throw new TypeError(`Invalid audio codec: ${options.audio.codec}. Must be a string.`);
      }
      if (!Number.isInteger(options.audio.numberOfChannels) || options.audio.numberOfChannels <= 0) {
        throw new TypeError(
          `Invalid number of audio channels: ${options.audio.numberOfChannels}. Must be a positive integer.`
        );
      }
      if (!Number.isInteger(options.audio.sampleRate) || options.audio.sampleRate <= 0) {
        throw new TypeError(
          `Invalid audio sample rate: ${options.audio.sampleRate}. Must be a positive integer.`
        );
      }
      if (options.audio.bitDepth !== void 0) {
        if (!Number.isInteger(options.audio.bitDepth) || options.audio.bitDepth <= 0) {
          throw new TypeError(
            `Invalid audio bit depth: ${options.audio.bitDepth}. Must be a positive integer.`
          );
        }
      }
    }
    if (options.subtitles) {
      if (typeof options.subtitles.codec !== "string") {
        throw new TypeError(`Invalid subtitles codec: ${options.subtitles.codec}. Must be a string.`);
      }
    }
    if (options.type !== void 0 && !["webm", "matroska"].includes(options.type)) {
      throw new TypeError(`Invalid type: ${options.type}. Must be 'webm' or 'matroska'.`);
    }
    if (options.firstTimestampBehavior && !FIRST_TIMESTAMP_BEHAVIORS.includes(options.firstTimestampBehavior)) {
      throw new TypeError(`Invalid first timestamp behavior: ${options.firstTimestampBehavior}`);
    }
    if (options.streaming !== void 0 && typeof options.streaming !== "boolean") {
      throw new TypeError(`Invalid streaming option: ${options.streaming}. Must be a boolean.`);
    }
  };
  _createFileHeader = new WeakSet();
  createFileHeader_fn = function() {
    if (__privateGet(this, _writer) instanceof BaseStreamTargetWriter && __privateGet(this, _writer).target.options.onHeader) {
      __privateGet(this, _writer).startTrackingWrites();
    }
    __privateMethod(this, _writeEBMLHeader, writeEBMLHeader_fn).call(this);
    if (!__privateGet(this, _options).streaming) {
      __privateMethod(this, _createSeekHead, createSeekHead_fn).call(this);
    }
    __privateMethod(this, _createSegmentInfo, createSegmentInfo_fn).call(this);
    __privateMethod(this, _createCodecPrivatePlaceholders, createCodecPrivatePlaceholders_fn).call(this);
    __privateMethod(this, _createColourElement, createColourElement_fn).call(this);
    if (!__privateGet(this, _options).streaming) {
      __privateMethod(this, _createTracks, createTracks_fn).call(this);
      __privateMethod(this, _createSegment, createSegment_fn).call(this);
    } else {
    }
    __privateMethod(this, _createCues, createCues_fn).call(this);
    __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
  };
  _writeEBMLHeader = new WeakSet();
  writeEBMLHeader_fn = function() {
    let ebmlHeader = { id: 440786851 /* EBML */, data: [
      { id: 17030 /* EBMLVersion */, data: 1 },
      { id: 17143 /* EBMLReadVersion */, data: 1 },
      { id: 17138 /* EBMLMaxIDLength */, data: 4 },
      { id: 17139 /* EBMLMaxSizeLength */, data: 8 },
      { id: 17026 /* DocType */, data: __privateGet(this, _options).type ?? "webm" },
      { id: 17031 /* DocTypeVersion */, data: 2 },
      { id: 17029 /* DocTypeReadVersion */, data: 2 }
    ] };
    __privateGet(this, _writer).writeEBML(ebmlHeader);
  };
  _createCodecPrivatePlaceholders = new WeakSet();
  createCodecPrivatePlaceholders_fn = function() {
    __privateSet(this, _videoCodecPrivate, { id: 236 /* Void */, size: 4, data: new Uint8Array(CODEC_PRIVATE_MAX_SIZE) });
    __privateSet(this, _audioCodecPrivate, { id: 236 /* Void */, size: 4, data: new Uint8Array(CODEC_PRIVATE_MAX_SIZE) });
    __privateSet(this, _subtitleCodecPrivate, { id: 236 /* Void */, size: 4, data: new Uint8Array(CODEC_PRIVATE_MAX_SIZE) });
  };
  _createColourElement = new WeakSet();
  createColourElement_fn = function() {
    __privateSet(this, _colourElement, { id: 21936 /* Colour */, data: [
      { id: 21937 /* MatrixCoefficients */, data: 2 },
      { id: 21946 /* TransferCharacteristics */, data: 2 },
      { id: 21947 /* Primaries */, data: 2 },
      { id: 21945 /* Range */, data: 0 }
    ] });
  };
  _createSeekHead = new WeakSet();
  createSeekHead_fn = function() {
    const kaxCues = new Uint8Array([28, 83, 187, 107]);
    const kaxInfo = new Uint8Array([21, 73, 169, 102]);
    const kaxTracks = new Uint8Array([22, 84, 174, 107]);
    let seekHead = { id: 290298740 /* SeekHead */, data: [
      { id: 19899 /* Seek */, data: [
        { id: 21419 /* SeekID */, data: kaxCues },
        { id: 21420 /* SeekPosition */, size: 5, data: 0 }
      ] },
      { id: 19899 /* Seek */, data: [
        { id: 21419 /* SeekID */, data: kaxInfo },
        { id: 21420 /* SeekPosition */, size: 5, data: 0 }
      ] },
      { id: 19899 /* Seek */, data: [
        { id: 21419 /* SeekID */, data: kaxTracks },
        { id: 21420 /* SeekPosition */, size: 5, data: 0 }
      ] }
    ] };
    __privateSet(this, _seekHead, seekHead);
  };
  _createSegmentInfo = new WeakSet();
  createSegmentInfo_fn = function() {
    let segmentDuration = { id: 17545 /* Duration */, data: new EBMLFloat64(0) };
    __privateSet(this, _segmentDuration, segmentDuration);
    let segmentInfo = { id: 357149030 /* Info */, data: [
      { id: 2807729 /* TimestampScale */, data: 1e6 },
      { id: 19840 /* MuxingApp */, data: APP_NAME },
      { id: 22337 /* WritingApp */, data: APP_NAME },
      !__privateGet(this, _options).streaming ? segmentDuration : null
    ] };
    __privateSet(this, _segmentInfo, segmentInfo);
  };
  _createTracks = new WeakSet();
  createTracks_fn = function() {
    let tracksElement = { id: 374648427 /* Tracks */, data: [] };
    __privateSet(this, _tracksElement, tracksElement);
    if (__privateGet(this, _options).video) {
      tracksElement.data.push({ id: 174 /* TrackEntry */, data: [
        { id: 215 /* TrackNumber */, data: VIDEO_TRACK_NUMBER },
        { id: 29637 /* TrackUID */, data: VIDEO_TRACK_NUMBER },
        { id: 131 /* TrackType */, data: VIDEO_TRACK_TYPE },
        { id: 134 /* CodecID */, data: __privateGet(this, _options).video.codec },
        __privateGet(this, _videoCodecPrivate),
        __privateGet(this, _options).video.frameRate ? { id: 2352003 /* DefaultDuration */, data: 1e9 / __privateGet(this, _options).video.frameRate } : null,
        { id: 224 /* Video */, data: [
          { id: 176 /* PixelWidth */, data: __privateGet(this, _options).video.width },
          { id: 186 /* PixelHeight */, data: __privateGet(this, _options).video.height },
          __privateGet(this, _options).video.alpha ? { id: 21440 /* AlphaMode */, data: 1 } : null,
          __privateGet(this, _colourElement)
        ] }
      ] });
    }
    if (__privateGet(this, _options).audio) {
      __privateSet(this, _audioCodecPrivate, __privateGet(this, _options).streaming ? __privateGet(this, _audioCodecPrivate) || null : { id: 236 /* Void */, size: 4, data: new Uint8Array(CODEC_PRIVATE_MAX_SIZE) });
      tracksElement.data.push({ id: 174 /* TrackEntry */, data: [
        { id: 215 /* TrackNumber */, data: AUDIO_TRACK_NUMBER },
        { id: 29637 /* TrackUID */, data: AUDIO_TRACK_NUMBER },
        { id: 131 /* TrackType */, data: AUDIO_TRACK_TYPE },
        { id: 134 /* CodecID */, data: __privateGet(this, _options).audio.codec },
        __privateGet(this, _audioCodecPrivate),
        { id: 225 /* Audio */, data: [
          { id: 181 /* SamplingFrequency */, data: new EBMLFloat32(__privateGet(this, _options).audio.sampleRate) },
          { id: 159 /* Channels */, data: __privateGet(this, _options).audio.numberOfChannels },
          __privateGet(this, _options).audio.bitDepth ? { id: 25188 /* BitDepth */, data: __privateGet(this, _options).audio.bitDepth } : null
        ] }
      ] });
    }
    if (__privateGet(this, _options).subtitles) {
      tracksElement.data.push({ id: 174 /* TrackEntry */, data: [
        { id: 215 /* TrackNumber */, data: SUBTITLE_TRACK_NUMBER },
        { id: 29637 /* TrackUID */, data: SUBTITLE_TRACK_NUMBER },
        { id: 131 /* TrackType */, data: SUBTITLE_TRACK_TYPE },
        { id: 134 /* CodecID */, data: __privateGet(this, _options).subtitles.codec },
        __privateGet(this, _subtitleCodecPrivate)
      ] });
    }
  };
  _createSegment = new WeakSet();
  createSegment_fn = function() {
    let segment = {
      id: 408125543 /* Segment */,
      size: __privateGet(this, _options).streaming ? -1 : SEGMENT_SIZE_BYTES,
      data: [
        !__privateGet(this, _options).streaming ? __privateGet(this, _seekHead) : null,
        __privateGet(this, _segmentInfo),
        __privateGet(this, _tracksElement)
      ]
    };
    __privateSet(this, _segment, segment);
    __privateGet(this, _writer).writeEBML(segment);
    if (__privateGet(this, _writer) instanceof BaseStreamTargetWriter && __privateGet(this, _writer).target.options.onHeader) {
      let { data, start } = __privateGet(this, _writer).getTrackedWrites();
      __privateGet(this, _writer).target.options.onHeader(data, start);
    }
  };
  _createCues = new WeakSet();
  createCues_fn = function() {
    __privateSet(this, _cues, { id: 475249515 /* Cues */, data: [] });
  };
  _maybeFlushStreamingTargetWriter = new WeakSet();
  maybeFlushStreamingTargetWriter_fn = function() {
    if (__privateGet(this, _writer) instanceof StreamTargetWriter) {
      __privateGet(this, _writer).flush();
    }
  };
  _segmentDataOffset = new WeakSet();
  segmentDataOffset_get = function() {
    return __privateGet(this, _writer).dataOffsets.get(__privateGet(this, _segment));
  };
  _writeVideoDecoderConfig = new WeakSet();
  writeVideoDecoderConfig_fn = function(meta) {
    if (!meta.decoderConfig)
      return;
    if (meta.decoderConfig.colorSpace) {
      let colorSpace = meta.decoderConfig.colorSpace;
      __privateSet(this, _colorSpace, colorSpace);
      __privateGet(this, _colourElement).data = [
        { id: 21937 /* MatrixCoefficients */, data: {
          "rgb": 1,
          "bt709": 1,
          "bt470bg": 5,
          "smpte170m": 6
        }[colorSpace.matrix] },
        { id: 21946 /* TransferCharacteristics */, data: {
          "bt709": 1,
          "smpte170m": 6,
          "iec61966-2-1": 13
        }[colorSpace.transfer] },
        { id: 21947 /* Primaries */, data: {
          "bt709": 1,
          "bt470bg": 5,
          "smpte170m": 6
        }[colorSpace.primaries] },
        { id: 21945 /* Range */, data: [1, 2][Number(colorSpace.fullRange)] }
      ];
      if (!__privateGet(this, _options).streaming) {
        let endPos = __privateGet(this, _writer).pos;
        __privateGet(this, _writer).seek(__privateGet(this, _writer).offsets.get(__privateGet(this, _colourElement)));
        __privateGet(this, _writer).writeEBML(__privateGet(this, _colourElement));
        __privateGet(this, _writer).seek(endPos);
      }
    }
    if (meta.decoderConfig.description) {
      if (__privateGet(this, _options).streaming) {
        __privateSet(this, _videoCodecPrivate, __privateMethod(this, _createCodecPrivateElement, createCodecPrivateElement_fn).call(this, meta.decoderConfig.description));
      } else {
        __privateMethod(this, _writeCodecPrivate, writeCodecPrivate_fn).call(this, __privateGet(this, _videoCodecPrivate), meta.decoderConfig.description);
      }
    }
  };
  _fixVP9ColorSpace = new WeakSet();
  fixVP9ColorSpace_fn = function(chunk) {
    if (chunk.type !== "key")
      return;
    if (!__privateGet(this, _colorSpace))
      return;
    let i = 0;
    if (readBits(chunk.data, 0, 2) !== 2)
      return;
    i += 2;
    let profile = (readBits(chunk.data, i + 1, i + 2) << 1) + readBits(chunk.data, i + 0, i + 1);
    i += 2;
    if (profile === 3)
      i++;
    let showExistingFrame = readBits(chunk.data, i + 0, i + 1);
    i++;
    if (showExistingFrame)
      return;
    let frameType = readBits(chunk.data, i + 0, i + 1);
    i++;
    if (frameType !== 0)
      return;
    i += 2;
    let syncCode = readBits(chunk.data, i + 0, i + 24);
    i += 24;
    if (syncCode !== 4817730)
      return;
    if (profile >= 2)
      i++;
    let colorSpaceID = {
      "rgb": 7,
      "bt709": 2,
      "bt470bg": 1,
      "smpte170m": 3
    }[__privateGet(this, _colorSpace).matrix];
    writeBits(chunk.data, i + 0, i + 3, colorSpaceID);
  };
  _writeSubtitleChunks = new WeakSet();
  writeSubtitleChunks_fn = function() {
    let lastWrittenMediaTimestamp = Math.min(
      __privateGet(this, _options).video ? __privateGet(this, _lastVideoTimestamp) : Infinity,
      __privateGet(this, _options).audio ? __privateGet(this, _lastAudioTimestamp) : Infinity
    );
    let queue = __privateGet(this, _subtitleChunkQueue);
    while (queue.length > 0 && queue[0].timestamp <= lastWrittenMediaTimestamp) {
      __privateMethod(this, _writeBlock, writeBlock_fn).call(this, queue.shift(), !__privateGet(this, _options).video && !__privateGet(this, _options).audio);
    }
  };
  _createInternalChunk = new WeakSet();
  createInternalChunk_fn = function(data, type, timestamp, trackNumber, duration, additions) {
    let adjustedTimestamp = __privateMethod(this, _validateTimestamp, validateTimestamp_fn).call(this, timestamp, trackNumber);
    let internalChunk = {
      data,
      additions,
      type,
      timestamp: adjustedTimestamp,
      duration,
      trackNumber
    };
    return internalChunk;
  };
  _validateTimestamp = new WeakSet();
  validateTimestamp_fn = function(timestamp, trackNumber) {
    let lastTimestamp = trackNumber === VIDEO_TRACK_NUMBER ? __privateGet(this, _lastVideoTimestamp) : trackNumber === AUDIO_TRACK_NUMBER ? __privateGet(this, _lastAudioTimestamp) : __privateGet(this, _lastSubtitleTimestamp);
    if (trackNumber !== SUBTITLE_TRACK_NUMBER) {
      let firstTimestamp = trackNumber === VIDEO_TRACK_NUMBER ? __privateGet(this, _firstVideoTimestamp) : __privateGet(this, _firstAudioTimestamp);
      if (__privateGet(this, _options).firstTimestampBehavior === "strict" && lastTimestamp === -1 && timestamp !== 0) {
        throw new Error(
          `The first chunk for your media track must have a timestamp of 0 (received ${timestamp}). Non-zero first timestamps are often caused by directly piping frames or audio data from a MediaStreamTrack into the encoder. Their timestamps are typically relative to the age of the document, which is probably what you want.

If you want to offset all timestamps of a track such that the first one is zero, set firstTimestampBehavior: 'offset' in the options.
If you want to allow non-zero first timestamps, set firstTimestampBehavior: 'permissive'.
`
        );
      } else if (__privateGet(this, _options).firstTimestampBehavior === "offset") {
        timestamp -= firstTimestamp;
      }
    }
    if (timestamp < lastTimestamp) {
      throw new Error(
        `Timestamps must be monotonically increasing (went from ${lastTimestamp} to ${timestamp}).`
      );
    }
    if (timestamp < 0) {
      throw new Error(`Timestamps must be non-negative (received ${timestamp}).`);
    }
    return timestamp;
  };
  _writeBlock = new WeakSet();
  writeBlock_fn = function(chunk, canCreateNewCluster) {
    if (__privateGet(this, _options).streaming && !__privateGet(this, _tracksElement)) {
      __privateMethod(this, _createTracks, createTracks_fn).call(this);
      __privateMethod(this, _createSegment, createSegment_fn).call(this);
    }
    let msTimestamp = Math.floor(chunk.timestamp / 1e3);
    let relativeTimestamp = msTimestamp - __privateGet(this, _currentClusterTimestamp);
    let shouldCreateNewClusterFromKeyFrame = canCreateNewCluster && chunk.type === "key" && relativeTimestamp >= 1e3;
    let clusterWouldBeTooLong = relativeTimestamp >= MAX_CHUNK_LENGTH_MS;
    if (!__privateGet(this, _currentCluster) || shouldCreateNewClusterFromKeyFrame || clusterWouldBeTooLong) {
      __privateMethod(this, _createNewCluster, createNewCluster_fn).call(this, msTimestamp);
      relativeTimestamp = 0;
    }
    if (relativeTimestamp < 0) {
      return;
    }
    let prelude = new Uint8Array(4);
    let view = new DataView(prelude.buffer);
    view.setUint8(0, 128 | chunk.trackNumber);
    view.setInt16(1, relativeTimestamp, false);
    if (chunk.duration === void 0 && !chunk.additions) {
      view.setUint8(3, Number(chunk.type === "key") << 7);
      let simpleBlock = { id: 163 /* SimpleBlock */, data: [
        prelude,
        chunk.data
      ] };
      __privateGet(this, _writer).writeEBML(simpleBlock);
    } else {
      let msDuration = Math.floor(chunk.duration / 1e3);
      let blockGroup = { id: 160 /* BlockGroup */, data: [
        { id: 161 /* Block */, data: [
          prelude,
          chunk.data
        ] },
        chunk.duration !== void 0 ? { id: 155 /* BlockDuration */, data: msDuration } : null,
        chunk.additions ? { id: 30113 /* BlockAdditions */, data: chunk.additions } : null
      ] };
      __privateGet(this, _writer).writeEBML(blockGroup);
    }
    __privateSet(this, _duration, Math.max(__privateGet(this, _duration), msTimestamp));
  };
  _createCodecPrivateElement = new WeakSet();
  createCodecPrivateElement_fn = function(data) {
    return { id: 25506 /* CodecPrivate */, size: 4, data: new Uint8Array(data) };
  };
  _writeCodecPrivate = new WeakSet();
  writeCodecPrivate_fn = function(element, data) {
    let endPos = __privateGet(this, _writer).pos;
    __privateGet(this, _writer).seek(__privateGet(this, _writer).offsets.get(element));
    let codecPrivateElementSize = 2 + 4 + data.byteLength;
    let voidDataSize = CODEC_PRIVATE_MAX_SIZE - codecPrivateElementSize;
    if (voidDataSize < 0) {
      let newByteLength = data.byteLength + voidDataSize;
      if (data instanceof ArrayBuffer) {
        data = data.slice(0, newByteLength);
      } else {
        data = data.buffer.slice(0, newByteLength);
      }
      voidDataSize = 0;
    }
    element = [
      __privateMethod(this, _createCodecPrivateElement, createCodecPrivateElement_fn).call(this, data),
      { id: 236 /* Void */, size: 4, data: new Uint8Array(voidDataSize) }
    ];
    __privateGet(this, _writer).writeEBML(element);
    __privateGet(this, _writer).seek(endPos);
  };
  _createNewCluster = new WeakSet();
  createNewCluster_fn = function(timestamp) {
    if (__privateGet(this, _currentCluster)) {
      __privateMethod(this, _finalizeCurrentCluster, finalizeCurrentCluster_fn).call(this);
    }
    if (__privateGet(this, _writer) instanceof BaseStreamTargetWriter && __privateGet(this, _writer).target.options.onCluster) {
      __privateGet(this, _writer).startTrackingWrites();
    }
    __privateSet(this, _currentCluster, {
      id: 524531317 /* Cluster */,
      size: __privateGet(this, _options).streaming ? -1 : CLUSTER_SIZE_BYTES,
      data: [
        { id: 231 /* Timestamp */, data: timestamp }
      ]
    });
    __privateGet(this, _writer).writeEBML(__privateGet(this, _currentCluster));
    __privateSet(this, _currentClusterTimestamp, timestamp);
    let clusterOffsetFromSegment = __privateGet(this, _writer).offsets.get(__privateGet(this, _currentCluster)) - __privateGet(this, _segmentDataOffset, segmentDataOffset_get);
    __privateGet(this, _cues).data.push({ id: 187 /* CuePoint */, data: [
      { id: 179 /* CueTime */, data: timestamp },
      __privateGet(this, _options).video ? { id: 183 /* CueTrackPositions */, data: [
        { id: 247 /* CueTrack */, data: VIDEO_TRACK_NUMBER },
        { id: 241 /* CueClusterPosition */, data: clusterOffsetFromSegment }
      ] } : null,
      __privateGet(this, _options).audio ? { id: 183 /* CueTrackPositions */, data: [
        { id: 247 /* CueTrack */, data: AUDIO_TRACK_NUMBER },
        { id: 241 /* CueClusterPosition */, data: clusterOffsetFromSegment }
      ] } : null
    ] });
  };
  _finalizeCurrentCluster = new WeakSet();
  finalizeCurrentCluster_fn = function() {
    if (!__privateGet(this, _options).streaming) {
      let clusterSize = __privateGet(this, _writer).pos - __privateGet(this, _writer).dataOffsets.get(__privateGet(this, _currentCluster));
      let endPos = __privateGet(this, _writer).pos;
      __privateGet(this, _writer).seek(__privateGet(this, _writer).offsets.get(__privateGet(this, _currentCluster)) + 4);
      __privateGet(this, _writer).writeEBMLVarInt(clusterSize, CLUSTER_SIZE_BYTES);
      __privateGet(this, _writer).seek(endPos);
    }
    if (__privateGet(this, _writer) instanceof BaseStreamTargetWriter && __privateGet(this, _writer).target.options.onCluster) {
      let { data, start } = __privateGet(this, _writer).getTrackedWrites();
      __privateGet(this, _writer).target.options.onCluster(data, start, __privateGet(this, _currentClusterTimestamp));
    }
  };
  _ensureNotFinalized = new WeakSet();
  ensureNotFinalized_fn = function() {
    if (__privateGet(this, _finalized)) {
      throw new Error("Cannot add new video or audio chunks after the file has been finalized.");
    }
  };

  // src/subtitles.ts
  var cueBlockHeaderRegex = /(?:(.+?)\n)?((?:\d{2}:)?\d{2}:\d{2}.\d{3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}.\d{3})/g;
  var preambleStartRegex = /^WEBVTT.*?\n{2}/;
  var timestampRegex = /(?:(\d{2}):)?(\d{2}):(\d{2}).(\d{3})/;
  var inlineTimestampRegex = /<(?:(\d{2}):)?(\d{2}):(\d{2}).(\d{3})>/g;
  var textEncoder = new TextEncoder();
  var _options2, _config, _preambleSeen, _preambleBytes, _preambleEmitted, _parseTimestamp, parseTimestamp_fn, _formatTimestamp, formatTimestamp_fn;
  var SubtitleEncoder = class {
    constructor(options) {
      __privateAdd(this, _parseTimestamp);
      __privateAdd(this, _formatTimestamp);
      __privateAdd(this, _options2, void 0);
      __privateAdd(this, _config, void 0);
      __privateAdd(this, _preambleSeen, false);
      __privateAdd(this, _preambleBytes, void 0);
      __privateAdd(this, _preambleEmitted, false);
      __privateSet(this, _options2, options);
    }
    configure(config) {
      if (config.codec !== "webvtt") {
        throw new Error("Codec must be 'webvtt'.");
      }
      __privateSet(this, _config, config);
    }
    encode(text) {
      if (!__privateGet(this, _config)) {
        throw new Error("Encoder not configured.");
      }
      text = text.replace("\r\n", "\n").replace("\r", "\n");
      cueBlockHeaderRegex.lastIndex = 0;
      let match;
      if (!__privateGet(this, _preambleSeen)) {
        if (!preambleStartRegex.test(text)) {
          let error = new Error("WebVTT preamble incorrect.");
          __privateGet(this, _options2).error(error);
          throw error;
        }
        match = cueBlockHeaderRegex.exec(text);
        let preamble = text.slice(0, match?.index ?? text.length).trimEnd();
        if (!preamble) {
          let error = new Error("No WebVTT preamble provided.");
          __privateGet(this, _options2).error(error);
          throw error;
        }
        __privateSet(this, _preambleBytes, textEncoder.encode(preamble));
        __privateSet(this, _preambleSeen, true);
        if (match) {
          text = text.slice(match.index);
          cueBlockHeaderRegex.lastIndex = 0;
        }
      }
      while (match = cueBlockHeaderRegex.exec(text)) {
        let notes = text.slice(0, match.index);
        let cueIdentifier = match[1] || "";
        let matchEnd = match.index + match[0].length;
        let bodyStart = text.indexOf("\n", matchEnd) + 1;
        let cueSettings = text.slice(matchEnd, bodyStart).trim();
        let bodyEnd = text.indexOf("\n\n", matchEnd);
        if (bodyEnd === -1)
          bodyEnd = text.length;
        let startTime = __privateMethod(this, _parseTimestamp, parseTimestamp_fn).call(this, match[2]);
        let endTime = __privateMethod(this, _parseTimestamp, parseTimestamp_fn).call(this, match[3]);
        let duration = endTime - startTime;
        let body = text.slice(bodyStart, bodyEnd);
        let additions = `${cueSettings}
${cueIdentifier}
${notes}`;
        inlineTimestampRegex.lastIndex = 0;
        body = body.replace(inlineTimestampRegex, (match2) => {
          let time = __privateMethod(this, _parseTimestamp, parseTimestamp_fn).call(this, match2.slice(1, -1));
          let offsetTime = time - startTime;
          return `<${__privateMethod(this, _formatTimestamp, formatTimestamp_fn).call(this, offsetTime)}>`;
        });
        text = text.slice(bodyEnd).trimStart();
        cueBlockHeaderRegex.lastIndex = 0;
        let chunk = {
          body: textEncoder.encode(body),
          additions: additions.trim() === "" ? void 0 : textEncoder.encode(additions),
          timestamp: startTime * 1e3,
          duration: duration * 1e3
        };
        let meta = {};
        if (!__privateGet(this, _preambleEmitted)) {
          meta.decoderConfig = {
            description: __privateGet(this, _preambleBytes)
          };
          __privateSet(this, _preambleEmitted, true);
        }
        __privateGet(this, _options2).output(chunk, meta);
      }
    }
  };
  _options2 = new WeakMap();
  _config = new WeakMap();
  _preambleSeen = new WeakMap();
  _preambleBytes = new WeakMap();
  _preambleEmitted = new WeakMap();
  _parseTimestamp = new WeakSet();
  parseTimestamp_fn = function(string) {
    let match = timestampRegex.exec(string);
    if (!match)
      throw new Error("Expected match.");
    return 60 * 60 * 1e3 * Number(match[1] || "0") + 60 * 1e3 * Number(match[2]) + 1e3 * Number(match[3]) + Number(match[4]);
  };
  _formatTimestamp = new WeakSet();
  formatTimestamp_fn = function(timestamp) {
    let hours = Math.floor(timestamp / (60 * 60 * 1e3));
    let minutes = Math.floor(timestamp % (60 * 60 * 1e3) / (60 * 1e3));
    let seconds = Math.floor(timestamp % (60 * 1e3) / 1e3);
    let milliseconds = timestamp % 1e3;
    return hours.toString().padStart(2, "0") + ":" + minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0") + "." + milliseconds.toString().padStart(3, "0");
  };
  return __toCommonJS(src_exports);
})();
if (typeof module === "object" && typeof module.exports === "object") Object.assign(module.exports, WebMMuxer)

      return module.exports
    })()
    const Mp4Muxer = (function () {
      const module = { exports: {} }
      "use strict";
var Mp4Muxer = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __accessCheck = (obj, member, msg) => {
    if (!member.has(obj))
      throw TypeError("Cannot " + msg);
  };
  var __privateGet = (obj, member, getter) => {
    __accessCheck(obj, member, "read from private field");
    return getter ? getter.call(obj) : member.get(obj);
  };
  var __privateAdd = (obj, member, value) => {
    if (member.has(obj))
      throw TypeError("Cannot add the same private member more than once");
    member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  };
  var __privateSet = (obj, member, value, setter) => {
    __accessCheck(obj, member, "write to private field");
    setter ? setter.call(obj, value) : member.set(obj, value);
    return value;
  };
  var __privateWrapper = (obj, member, setter, getter) => ({
    set _(value) {
      __privateSet(obj, member, value, setter);
    },
    get _() {
      return __privateGet(obj, member, getter);
    }
  });
  var __privateMethod = (obj, member, method) => {
    __accessCheck(obj, member, "access private method");
    return method;
  };

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    ArrayBufferTarget: () => ArrayBufferTarget,
    FileSystemWritableFileStreamTarget: () => FileSystemWritableFileStreamTarget,
    Muxer: () => Muxer,
    StreamTarget: () => StreamTarget
  });

  // src/misc.ts
  var bytes = new Uint8Array(8);
  var view = new DataView(bytes.buffer);
  var u8 = (value) => {
    return [(value % 256 + 256) % 256];
  };
  var u16 = (value) => {
    view.setUint16(0, value, false);
    return [bytes[0], bytes[1]];
  };
  var i16 = (value) => {
    view.setInt16(0, value, false);
    return [bytes[0], bytes[1]];
  };
  var u24 = (value) => {
    view.setUint32(0, value, false);
    return [bytes[1], bytes[2], bytes[3]];
  };
  var u32 = (value) => {
    view.setUint32(0, value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var i32 = (value) => {
    view.setInt32(0, value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var u64 = (value) => {
    view.setUint32(0, Math.floor(value / 2 ** 32), false);
    view.setUint32(4, value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]];
  };
  var fixed_8_8 = (value) => {
    view.setInt16(0, 2 ** 8 * value, false);
    return [bytes[0], bytes[1]];
  };
  var fixed_16_16 = (value) => {
    view.setInt32(0, 2 ** 16 * value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var fixed_2_30 = (value) => {
    view.setInt32(0, 2 ** 30 * value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var ascii = (text, nullTerminated = false) => {
    let bytes2 = Array(text.length).fill(null).map((_, i) => text.charCodeAt(i));
    if (nullTerminated)
      bytes2.push(0);
    return bytes2;
  };
  var last = (arr) => {
    return arr && arr[arr.length - 1];
  };
  var lastPresentedSample = (samples) => {
    let result = void 0;
    for (let sample of samples) {
      if (!result || sample.presentationTimestamp > result.presentationTimestamp) {
        result = sample;
      }
    }
    return result;
  };
  var intoTimescale = (timeInSeconds, timescale, round = true) => {
    let value = timeInSeconds * timescale;
    return round ? Math.round(value) : value;
  };
  var rotationMatrix = (rotationInDegrees) => {
    let theta = rotationInDegrees * (Math.PI / 180);
    let cosTheta = Math.cos(theta);
    let sinTheta = Math.sin(theta);
    return [
      cosTheta,
      sinTheta,
      0,
      -sinTheta,
      cosTheta,
      0,
      0,
      0,
      1
    ];
  };
  var IDENTITY_MATRIX = rotationMatrix(0);
  var matrixToBytes = (matrix) => {
    return [
      fixed_16_16(matrix[0]),
      fixed_16_16(matrix[1]),
      fixed_2_30(matrix[2]),
      fixed_16_16(matrix[3]),
      fixed_16_16(matrix[4]),
      fixed_2_30(matrix[5]),
      fixed_16_16(matrix[6]),
      fixed_16_16(matrix[7]),
      fixed_2_30(matrix[8])
    ];
  };
  var deepClone = (x) => {
    if (!x)
      return x;
    if (typeof x !== "object")
      return x;
    if (Array.isArray(x))
      return x.map(deepClone);
    return Object.fromEntries(Object.entries(x).map(([key, value]) => [key, deepClone(value)]));
  };
  var isU32 = (value) => {
    return value >= 0 && value < 2 ** 32;
  };

  // src/box.ts
  var box = (type, contents, children) => ({
    type,
    contents: contents && new Uint8Array(contents.flat(10)),
    children
  });
  var fullBox = (type, version, flags, contents, children) => box(
    type,
    [u8(version), u24(flags), contents ?? []],
    children
  );
  var ftyp = (details) => {
    let minorVersion = 512;
    if (details.fragmented)
      return box("ftyp", [
        ascii("iso5"),
        // Major brand
        u32(minorVersion),
        // Minor version
        // Compatible brands
        ascii("iso5"),
        ascii("iso6"),
        ascii("mp41")
      ]);
    return box("ftyp", [
      ascii("isom"),
      // Major brand
      u32(minorVersion),
      // Minor version
      // Compatible brands
      ascii("isom"),
      details.holdsAvc ? ascii("avc1") : [],
      ascii("mp41")
    ]);
  };
  var mdat = (reserveLargeSize) => ({ type: "mdat", largeSize: reserveLargeSize });
  var free = (size) => ({ type: "free", size });
  var moov = (tracks, creationTime, fragmented = false) => box("moov", null, [
    mvhd(creationTime, tracks),
    ...tracks.map((x) => trak(x, creationTime)),
    fragmented ? mvex(tracks) : null
  ]);
  var mvhd = (creationTime, tracks) => {
    let duration = intoTimescale(Math.max(
      0,
      ...tracks.filter((x) => x.samples.length > 0).map((x) => {
        const lastSample = lastPresentedSample(x.samples);
        return lastSample.presentationTimestamp + lastSample.duration;
      })
    ), GLOBAL_TIMESCALE);
    let nextTrackId = Math.max(...tracks.map((x) => x.id)) + 1;
    let needsU64 = !isU32(creationTime) || !isU32(duration);
    let u32OrU64 = needsU64 ? u64 : u32;
    return fullBox("mvhd", +needsU64, 0, [
      u32OrU64(creationTime),
      // Creation time
      u32OrU64(creationTime),
      // Modification time
      u32(GLOBAL_TIMESCALE),
      // Timescale
      u32OrU64(duration),
      // Duration
      fixed_16_16(1),
      // Preferred rate
      fixed_8_8(1),
      // Preferred volume
      Array(10).fill(0),
      // Reserved
      matrixToBytes(IDENTITY_MATRIX),
      // Matrix
      Array(24).fill(0),
      // Pre-defined
      u32(nextTrackId)
      // Next track ID
    ]);
  };
  var trak = (track, creationTime) => box("trak", null, [
    tkhd(track, creationTime),
    mdia(track, creationTime)
  ]);
  var tkhd = (track, creationTime) => {
    let lastSample = lastPresentedSample(track.samples);
    let durationInGlobalTimescale = intoTimescale(
      lastSample ? lastSample.presentationTimestamp + lastSample.duration : 0,
      GLOBAL_TIMESCALE
    );
    let needsU64 = !isU32(creationTime) || !isU32(durationInGlobalTimescale);
    let u32OrU64 = needsU64 ? u64 : u32;
    let matrix;
    if (track.info.type === "video") {
      matrix = typeof track.info.rotation === "number" ? rotationMatrix(track.info.rotation) : track.info.rotation;
    } else {
      matrix = IDENTITY_MATRIX;
    }
    return fullBox("tkhd", +needsU64, 3, [
      u32OrU64(creationTime),
      // Creation time
      u32OrU64(creationTime),
      // Modification time
      u32(track.id),
      // Track ID
      u32(0),
      // Reserved
      u32OrU64(durationInGlobalTimescale),
      // Duration
      Array(8).fill(0),
      // Reserved
      u16(0),
      // Layer
      u16(0),
      // Alternate group
      fixed_8_8(track.info.type === "audio" ? 1 : 0),
      // Volume
      u16(0),
      // Reserved
      matrixToBytes(matrix),
      // Matrix
      fixed_16_16(track.info.type === "video" ? track.info.width : 0),
      // Track width
      fixed_16_16(track.info.type === "video" ? track.info.height : 0)
      // Track height
    ]);
  };
  var mdia = (track, creationTime) => box("mdia", null, [
    mdhd(track, creationTime),
    hdlr(track.info.type === "video" ? "vide" : "soun"),
    minf(track)
  ]);
  var mdhd = (track, creationTime) => {
    let lastSample = lastPresentedSample(track.samples);
    let localDuration = intoTimescale(
      lastSample ? lastSample.presentationTimestamp + lastSample.duration : 0,
      track.timescale
    );
    let needsU64 = !isU32(creationTime) || !isU32(localDuration);
    let u32OrU64 = needsU64 ? u64 : u32;
    return fullBox("mdhd", +needsU64, 0, [
      u32OrU64(creationTime),
      // Creation time
      u32OrU64(creationTime),
      // Modification time
      u32(track.timescale),
      // Timescale
      u32OrU64(localDuration),
      // Duration
      u16(21956),
      // Language ("und", undetermined)
      u16(0)
      // Quality
    ]);
  };
  var hdlr = (componentSubtype) => fullBox("hdlr", 0, 0, [
    ascii("mhlr"),
    // Component type
    ascii(componentSubtype),
    // Component subtype
    u32(0),
    // Component manufacturer
    u32(0),
    // Component flags
    u32(0),
    // Component flags mask
    ascii("mp4-muxer-hdlr", true)
    // Component name
  ]);
  var minf = (track) => box("minf", null, [
    track.info.type === "video" ? vmhd() : smhd(),
    dinf(),
    stbl(track)
  ]);
  var vmhd = () => fullBox("vmhd", 0, 1, [
    u16(0),
    // Graphics mode
    u16(0),
    // Opcolor R
    u16(0),
    // Opcolor G
    u16(0)
    // Opcolor B
  ]);
  var smhd = () => fullBox("smhd", 0, 0, [
    u16(0),
    // Balance
    u16(0)
    // Reserved
  ]);
  var dinf = () => box("dinf", null, [
    dref()
  ]);
  var dref = () => fullBox("dref", 0, 0, [
    u32(1)
    // Entry count
  ], [
    url()
  ]);
  var url = () => fullBox("url ", 0, 1);
  var stbl = (track) => {
    const needsCtts = track.compositionTimeOffsetTable.length > 1 || track.compositionTimeOffsetTable.some((x) => x.sampleCompositionTimeOffset !== 0);
    return box("stbl", null, [
      stsd(track),
      stts(track),
      stss(track),
      stsc(track),
      stsz(track),
      stco(track),
      needsCtts ? ctts(track) : null
    ]);
  };
  var stsd = (track) => fullBox("stsd", 0, 0, [
    u32(1)
    // Entry count
  ], [
    track.info.type === "video" ? videoSampleDescription(
      VIDEO_CODEC_TO_BOX_NAME[track.info.codec],
      track
    ) : soundSampleDescription(
      AUDIO_CODEC_TO_BOX_NAME[track.info.codec],
      track
    )
  ]);
  var videoSampleDescription = (compressionType, track) => box(compressionType, [
    Array(6).fill(0),
    // Reserved
    u16(1),
    // Data reference index
    u16(0),
    // Pre-defined
    u16(0),
    // Reserved
    Array(12).fill(0),
    // Pre-defined
    u16(track.info.width),
    // Width
    u16(track.info.height),
    // Height
    u32(4718592),
    // Horizontal resolution
    u32(4718592),
    // Vertical resolution
    u32(0),
    // Reserved
    u16(1),
    // Frame count
    Array(32).fill(0),
    // Compressor name
    u16(24),
    // Depth
    i16(65535)
    // Pre-defined
  ], [
    VIDEO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track),
    track.info.decoderConfig.colorSpace ? colr(track) : null
  ]);
  var COLOR_PRIMARIES_MAP = {
    "bt709": 1,
    // ITU-R BT.709
    "bt470bg": 5,
    // ITU-R BT.470BG
    "smpte170m": 6
    // ITU-R BT.601 525 - SMPTE 170M
  };
  var TRANSFER_CHARACTERISTICS_MAP = {
    "bt709": 1,
    // ITU-R BT.709
    "smpte170m": 6,
    // SMPTE 170M
    "iec61966-2-1": 13
    // IEC 61966-2-1
  };
  var MATRIX_COEFFICIENTS_MAP = {
    "rgb": 0,
    // Identity
    "bt709": 1,
    // ITU-R BT.709
    "bt470bg": 5,
    // ITU-R BT.470BG
    "smpte170m": 6
    // SMPTE 170M
  };
  var colr = (track) => box("colr", [
    ascii("nclx"),
    // Colour type
    u16(COLOR_PRIMARIES_MAP[track.info.decoderConfig.colorSpace.primaries]),
    // Colour primaries
    u16(TRANSFER_CHARACTERISTICS_MAP[track.info.decoderConfig.colorSpace.transfer]),
    // Transfer characteristics
    u16(MATRIX_COEFFICIENTS_MAP[track.info.decoderConfig.colorSpace.matrix]),
    // Matrix coefficients
    u8((track.info.decoderConfig.colorSpace.fullRange ? 1 : 0) << 7)
    // Full range flag
  ]);
  var avcC = (track) => track.info.decoderConfig && box("avcC", [
    // For AVC, description is an AVCDecoderConfigurationRecord, so nothing else to do here
    ...new Uint8Array(track.info.decoderConfig.description)
  ]);
  var hvcC = (track) => track.info.decoderConfig && box("hvcC", [
    // For HEVC, description is a HEVCDecoderConfigurationRecord, so nothing else to do here
    ...new Uint8Array(track.info.decoderConfig.description)
  ]);
  var vpcC = (track) => {
    if (!track.info.decoderConfig) {
      return null;
    }
    let decoderConfig = track.info.decoderConfig;
    if (!decoderConfig.colorSpace) {
      throw new Error(`'colorSpace' is required in the decoder config for VP9.`);
    }
    let parts = decoderConfig.codec.split(".");
    let profile = Number(parts[1]);
    let level = Number(parts[2]);
    let bitDepth = Number(parts[3]);
    let chromaSubsampling = 0;
    let thirdByte = (bitDepth << 4) + (chromaSubsampling << 1) + Number(decoderConfig.colorSpace.fullRange);
    let colourPrimaries = 2;
    let transferCharacteristics = 2;
    let matrixCoefficients = 2;
    return fullBox("vpcC", 1, 0, [
      u8(profile),
      // Profile
      u8(level),
      // Level
      u8(thirdByte),
      // Bit depth, chroma subsampling, full range
      u8(colourPrimaries),
      // Colour primaries
      u8(transferCharacteristics),
      // Transfer characteristics
      u8(matrixCoefficients),
      // Matrix coefficients
      u16(0)
      // Codec initialization data size
    ]);
  };
  var av1C = () => {
    let marker = 1;
    let version = 1;
    let firstByte = (marker << 7) + version;
    return box("av1C", [
      firstByte,
      0,
      0,
      0
    ]);
  };
  var soundSampleDescription = (compressionType, track) => box(compressionType, [
    Array(6).fill(0),
    // Reserved
    u16(1),
    // Data reference index
    u16(0),
    // Version
    u16(0),
    // Revision level
    u32(0),
    // Vendor
    u16(track.info.numberOfChannels),
    // Number of channels
    u16(16),
    // Sample size (bits)
    u16(0),
    // Compression ID
    u16(0),
    // Packet size
    fixed_16_16(track.info.sampleRate)
    // Sample rate
  ], [
    AUDIO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track)
  ]);
  var esds = (track) => {
    let description = new Uint8Array(track.info.decoderConfig.description);
    return fullBox("esds", 0, 0, [
      // https://stackoverflow.com/a/54803118
      u32(58753152),
      // TAG(3) = Object Descriptor ([2])
      u8(32 + description.byteLength),
      // length of this OD (which includes the next 2 tags)
      u16(1),
      // ES_ID = 1
      u8(0),
      // flags etc = 0
      u32(75530368),
      // TAG(4) = ES Descriptor ([2]) embedded in above OD
      u8(18 + description.byteLength),
      // length of this ESD
      u8(64),
      // MPEG-4 Audio
      u8(21),
      // stream type(6bits)=5 audio, flags(2bits)=1
      u24(0),
      // 24bit buffer size
      u32(130071),
      // max bitrate
      u32(130071),
      // avg bitrate
      u32(92307584),
      // TAG(5) = ASC ([2],[3]) embedded in above OD
      u8(description.byteLength),
      // length
      ...description,
      u32(109084800),
      // TAG(6)
      u8(1),
      // length
      u8(2)
      // data
    ]);
  };
  var dOps = (track) => {
    let preskip = 3840;
    let gain = 0;
    const description = track.info.decoderConfig?.description;
    if (description) {
      if (description.byteLength < 18) {
        throw new TypeError("Invalid decoder description provided for Opus; must be at least 18 bytes long.");
      }
      const view2 = ArrayBuffer.isView(description) ? new DataView(description.buffer, description.byteOffset, description.byteLength) : new DataView(description);
      preskip = view2.getUint16(10, true);
      gain = view2.getInt16(14, true);
    }
    return box("dOps", [
      u8(0),
      // Version
      u8(track.info.numberOfChannels),
      // OutputChannelCount
      u16(preskip),
      u32(track.info.sampleRate),
      // InputSampleRate
      fixed_8_8(gain),
      // OutputGain
      u8(0)
      // ChannelMappingFamily
    ]);
  };
  var stts = (track) => {
    return fullBox("stts", 0, 0, [
      u32(track.timeToSampleTable.length),
      // Number of entries
      track.timeToSampleTable.map((x) => [
        // Time-to-sample table
        u32(x.sampleCount),
        // Sample count
        u32(x.sampleDelta)
        // Sample duration
      ])
    ]);
  };
  var stss = (track) => {
    if (track.samples.every((x) => x.type === "key"))
      return null;
    let keySamples = [...track.samples.entries()].filter(([, sample]) => sample.type === "key");
    return fullBox("stss", 0, 0, [
      u32(keySamples.length),
      // Number of entries
      keySamples.map(([index]) => u32(index + 1))
      // Sync sample table
    ]);
  };
  var stsc = (track) => {
    return fullBox("stsc", 0, 0, [
      u32(track.compactlyCodedChunkTable.length),
      // Number of entries
      track.compactlyCodedChunkTable.map((x) => [
        // Sample-to-chunk table
        u32(x.firstChunk),
        // First chunk
        u32(x.samplesPerChunk),
        // Samples per chunk
        u32(1)
        // Sample description index
      ])
    ]);
  };
  var stsz = (track) => fullBox("stsz", 0, 0, [
    u32(0),
    // Sample size (0 means non-constant size)
    u32(track.samples.length),
    // Number of entries
    track.samples.map((x) => u32(x.size))
    // Sample size table
  ]);
  var stco = (track) => {
    if (track.finalizedChunks.length > 0 && last(track.finalizedChunks).offset >= 2 ** 32) {
      return fullBox("co64", 0, 0, [
        u32(track.finalizedChunks.length),
        // Number of entries
        track.finalizedChunks.map((x) => u64(x.offset))
        // Chunk offset table
      ]);
    }
    return fullBox("stco", 0, 0, [
      u32(track.finalizedChunks.length),
      // Number of entries
      track.finalizedChunks.map((x) => u32(x.offset))
      // Chunk offset table
    ]);
  };
  var ctts = (track) => {
    return fullBox("ctts", 0, 0, [
      u32(track.compositionTimeOffsetTable.length),
      // Number of entries
      track.compositionTimeOffsetTable.map((x) => [
        // Time-to-sample table
        u32(x.sampleCount),
        // Sample count
        u32(x.sampleCompositionTimeOffset)
        // Sample offset
      ])
    ]);
  };
  var mvex = (tracks) => {
    return box("mvex", null, tracks.map(trex));
  };
  var trex = (track) => {
    return fullBox("trex", 0, 0, [
      u32(track.id),
      // Track ID
      u32(1),
      // Default sample description index
      u32(0),
      // Default sample duration
      u32(0),
      // Default sample size
      u32(0)
      // Default sample flags
    ]);
  };
  var moof = (sequenceNumber, tracks) => {
    return box("moof", null, [
      mfhd(sequenceNumber),
      ...tracks.map(traf)
    ]);
  };
  var mfhd = (sequenceNumber) => {
    return fullBox("mfhd", 0, 0, [
      u32(sequenceNumber)
      // Sequence number
    ]);
  };
  var fragmentSampleFlags = (sample) => {
    let byte1 = 0;
    let byte2 = 0;
    let byte3 = 0;
    let byte4 = 0;
    let sampleIsDifferenceSample = sample.type === "delta";
    byte2 |= +sampleIsDifferenceSample;
    if (sampleIsDifferenceSample) {
      byte1 |= 1;
    } else {
      byte1 |= 2;
    }
    return byte1 << 24 | byte2 << 16 | byte3 << 8 | byte4;
  };
  var traf = (track) => {
    return box("traf", null, [
      tfhd(track),
      tfdt(track),
      trun(track)
    ]);
  };
  var tfhd = (track) => {
    let tfFlags = 0;
    tfFlags |= 8;
    tfFlags |= 16;
    tfFlags |= 32;
    tfFlags |= 131072;
    let referenceSample = track.currentChunk.samples[1] ?? track.currentChunk.samples[0];
    let referenceSampleInfo = {
      duration: referenceSample.timescaleUnitsToNextSample,
      size: referenceSample.size,
      flags: fragmentSampleFlags(referenceSample)
    };
    return fullBox("tfhd", 0, tfFlags, [
      u32(track.id),
      // Track ID
      u32(referenceSampleInfo.duration),
      // Default sample duration
      u32(referenceSampleInfo.size),
      // Default sample size
      u32(referenceSampleInfo.flags)
      // Default sample flags
    ]);
  };
  var tfdt = (track) => {
    return fullBox("tfdt", 1, 0, [
      u64(intoTimescale(track.currentChunk.startTimestamp, track.timescale))
      // Base Media Decode Time
    ]);
  };
  var trun = (track) => {
    let allSampleDurations = track.currentChunk.samples.map((x) => x.timescaleUnitsToNextSample);
    let allSampleSizes = track.currentChunk.samples.map((x) => x.size);
    let allSampleFlags = track.currentChunk.samples.map(fragmentSampleFlags);
    let allSampleCompositionTimeOffsets = track.currentChunk.samples.map((x) => intoTimescale(x.presentationTimestamp - x.decodeTimestamp, track.timescale));
    let uniqueSampleDurations = new Set(allSampleDurations);
    let uniqueSampleSizes = new Set(allSampleSizes);
    let uniqueSampleFlags = new Set(allSampleFlags);
    let uniqueSampleCompositionTimeOffsets = new Set(allSampleCompositionTimeOffsets);
    let firstSampleFlagsPresent = uniqueSampleFlags.size === 2 && allSampleFlags[0] !== allSampleFlags[1];
    let sampleDurationPresent = uniqueSampleDurations.size > 1;
    let sampleSizePresent = uniqueSampleSizes.size > 1;
    let sampleFlagsPresent = !firstSampleFlagsPresent && uniqueSampleFlags.size > 1;
    let sampleCompositionTimeOffsetsPresent = uniqueSampleCompositionTimeOffsets.size > 1 || [...uniqueSampleCompositionTimeOffsets].some((x) => x !== 0);
    let flags = 0;
    flags |= 1;
    flags |= 4 * +firstSampleFlagsPresent;
    flags |= 256 * +sampleDurationPresent;
    flags |= 512 * +sampleSizePresent;
    flags |= 1024 * +sampleFlagsPresent;
    flags |= 2048 * +sampleCompositionTimeOffsetsPresent;
    return fullBox("trun", 1, flags, [
      u32(track.currentChunk.samples.length),
      // Sample count
      u32(track.currentChunk.offset - track.currentChunk.moofOffset || 0),
      // Data offset
      firstSampleFlagsPresent ? u32(allSampleFlags[0]) : [],
      track.currentChunk.samples.map((_, i) => [
        sampleDurationPresent ? u32(allSampleDurations[i]) : [],
        // Sample duration
        sampleSizePresent ? u32(allSampleSizes[i]) : [],
        // Sample size
        sampleFlagsPresent ? u32(allSampleFlags[i]) : [],
        // Sample flags
        // Sample composition time offsets
        sampleCompositionTimeOffsetsPresent ? i32(allSampleCompositionTimeOffsets[i]) : []
      ])
    ]);
  };
  var mfra = (tracks) => {
    return box("mfra", null, [
      ...tracks.map(tfra),
      mfro()
    ]);
  };
  var tfra = (track, trackIndex) => {
    let version = 1;
    return fullBox("tfra", version, 0, [
      u32(track.id),
      // Track ID
      u32(63),
      // This specifies that traf number, trun number and sample number are 32-bit ints
      u32(track.finalizedChunks.length),
      // Number of entries
      track.finalizedChunks.map((chunk) => [
        u64(intoTimescale(chunk.startTimestamp, track.timescale)),
        // Time
        u64(chunk.moofOffset),
        // moof offset
        u32(trackIndex + 1),
        // traf number
        u32(1),
        // trun number
        u32(1)
        // Sample number
      ])
    ]);
  };
  var mfro = () => {
    return fullBox("mfro", 0, 0, [
      // This value needs to be overwritten manually from the outside, where the actual size of the enclosing mfra box
      // is known
      u32(0)
      // Size
    ]);
  };
  var VIDEO_CODEC_TO_BOX_NAME = {
    "avc": "avc1",
    "hevc": "hvc1",
    "vp9": "vp09",
    "av1": "av01"
  };
  var VIDEO_CODEC_TO_CONFIGURATION_BOX = {
    "avc": avcC,
    "hevc": hvcC,
    "vp9": vpcC,
    "av1": av1C
  };
  var AUDIO_CODEC_TO_BOX_NAME = {
    "aac": "mp4a",
    "opus": "Opus"
  };
  var AUDIO_CODEC_TO_CONFIGURATION_BOX = {
    "aac": esds,
    "opus": dOps
  };

  // src/target.ts
  var isTarget = Symbol("isTarget");
  var Target = class {
  };
  isTarget;
  var ArrayBufferTarget = class extends Target {
    constructor() {
      super(...arguments);
      this.buffer = null;
    }
  };
  var StreamTarget = class extends Target {
    constructor(options) {
      super();
      this.options = options;
      if (typeof options !== "object") {
        throw new TypeError("StreamTarget requires an options object to be passed to its constructor.");
      }
      if (options.onData) {
        if (typeof options.onData !== "function") {
          throw new TypeError("options.onData, when provided, must be a function.");
        }
        if (options.onData.length < 2) {
          throw new TypeError(
            "options.onData, when provided, must be a function that takes in at least two arguments (data and position). Ignoring the position argument, which specifies the byte offset at which the data is to be written, can lead to broken outputs."
          );
        }
      }
      if (options.chunked !== void 0 && typeof options.chunked !== "boolean") {
        throw new TypeError("options.chunked, when provided, must be a boolean.");
      }
      if (options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize < 1024)) {
        throw new TypeError("options.chunkSize, when provided, must be an integer and not smaller than 1024.");
      }
    }
  };
  var FileSystemWritableFileStreamTarget = class extends Target {
    constructor(stream, options) {
      super();
      this.stream = stream;
      this.options = options;
      if (!(stream instanceof FileSystemWritableFileStream)) {
        throw new TypeError("FileSystemWritableFileStreamTarget requires a FileSystemWritableFileStream instance.");
      }
      if (options !== void 0 && typeof options !== "object") {
        throw new TypeError("FileSystemWritableFileStreamTarget's options, when provided, must be an object.");
      }
      if (options) {
        if (options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize <= 0)) {
          throw new TypeError("options.chunkSize, when provided, must be a positive integer");
        }
      }
    }
  };

  // src/writer.ts
  var _helper, _helperView;
  var Writer = class {
    constructor() {
      this.pos = 0;
      __privateAdd(this, _helper, new Uint8Array(8));
      __privateAdd(this, _helperView, new DataView(__privateGet(this, _helper).buffer));
      /**
       * Stores the position from the start of the file to where boxes elements have been written. This is used to
       * rewrite/edit elements that were already added before, and to measure sizes of things.
       */
      this.offsets = /* @__PURE__ */ new WeakMap();
    }
    /** Sets the current position for future writes to a new one. */
    seek(newPos) {
      this.pos = newPos;
    }
    writeU32(value) {
      __privateGet(this, _helperView).setUint32(0, value, false);
      this.write(__privateGet(this, _helper).subarray(0, 4));
    }
    writeU64(value) {
      __privateGet(this, _helperView).setUint32(0, Math.floor(value / 2 ** 32), false);
      __privateGet(this, _helperView).setUint32(4, value, false);
      this.write(__privateGet(this, _helper).subarray(0, 8));
    }
    writeAscii(text) {
      for (let i = 0; i < text.length; i++) {
        __privateGet(this, _helperView).setUint8(i % 8, text.charCodeAt(i));
        if (i % 8 === 7)
          this.write(__privateGet(this, _helper));
      }
      if (text.length % 8 !== 0) {
        this.write(__privateGet(this, _helper).subarray(0, text.length % 8));
      }
    }
    writeBox(box2) {
      this.offsets.set(box2, this.pos);
      if (box2.contents && !box2.children) {
        this.writeBoxHeader(box2, box2.size ?? box2.contents.byteLength + 8);
        this.write(box2.contents);
      } else {
        let startPos = this.pos;
        this.writeBoxHeader(box2, 0);
        if (box2.contents)
          this.write(box2.contents);
        if (box2.children) {
          for (let child of box2.children)
            if (child)
              this.writeBox(child);
        }
        let endPos = this.pos;
        let size = box2.size ?? endPos - startPos;
        this.seek(startPos);
        this.writeBoxHeader(box2, size);
        this.seek(endPos);
      }
    }
    writeBoxHeader(box2, size) {
      this.writeU32(box2.largeSize ? 1 : size);
      this.writeAscii(box2.type);
      if (box2.largeSize)
        this.writeU64(size);
    }
    measureBoxHeader(box2) {
      return 8 + (box2.largeSize ? 8 : 0);
    }
    patchBox(box2) {
      let endPos = this.pos;
      this.seek(this.offsets.get(box2));
      this.writeBox(box2);
      this.seek(endPos);
    }
    measureBox(box2) {
      if (box2.contents && !box2.children) {
        let headerSize = this.measureBoxHeader(box2);
        return headerSize + box2.contents.byteLength;
      } else {
        let result = this.measureBoxHeader(box2);
        if (box2.contents)
          result += box2.contents.byteLength;
        if (box2.children) {
          for (let child of box2.children)
            if (child)
              result += this.measureBox(child);
        }
        return result;
      }
    }
  };
  _helper = new WeakMap();
  _helperView = new WeakMap();
  var _target, _buffer, _bytes, _maxPos, _ensureSize, ensureSize_fn;
  var ArrayBufferTargetWriter = class extends Writer {
    constructor(target) {
      super();
      __privateAdd(this, _ensureSize);
      __privateAdd(this, _target, void 0);
      __privateAdd(this, _buffer, new ArrayBuffer(2 ** 16));
      __privateAdd(this, _bytes, new Uint8Array(__privateGet(this, _buffer)));
      __privateAdd(this, _maxPos, 0);
      __privateSet(this, _target, target);
    }
    write(data) {
      __privateMethod(this, _ensureSize, ensureSize_fn).call(this, this.pos + data.byteLength);
      __privateGet(this, _bytes).set(data, this.pos);
      this.pos += data.byteLength;
      __privateSet(this, _maxPos, Math.max(__privateGet(this, _maxPos), this.pos));
    }
    finalize() {
      __privateMethod(this, _ensureSize, ensureSize_fn).call(this, this.pos);
      __privateGet(this, _target).buffer = __privateGet(this, _buffer).slice(0, Math.max(__privateGet(this, _maxPos), this.pos));
    }
  };
  _target = new WeakMap();
  _buffer = new WeakMap();
  _bytes = new WeakMap();
  _maxPos = new WeakMap();
  _ensureSize = new WeakSet();
  ensureSize_fn = function(size) {
    let newLength = __privateGet(this, _buffer).byteLength;
    while (newLength < size)
      newLength *= 2;
    if (newLength === __privateGet(this, _buffer).byteLength)
      return;
    let newBuffer = new ArrayBuffer(newLength);
    let newBytes = new Uint8Array(newBuffer);
    newBytes.set(__privateGet(this, _bytes), 0);
    __privateSet(this, _buffer, newBuffer);
    __privateSet(this, _bytes, newBytes);
  };
  var DEFAULT_CHUNK_SIZE = 2 ** 24;
  var MAX_CHUNKS_AT_ONCE = 2;
  var _target2, _sections, _chunked, _chunkSize, _chunks, _writeDataIntoChunks, writeDataIntoChunks_fn, _insertSectionIntoChunk, insertSectionIntoChunk_fn, _createChunk, createChunk_fn, _flushChunks, flushChunks_fn;
  var StreamTargetWriter = class extends Writer {
    constructor(target) {
      super();
      __privateAdd(this, _writeDataIntoChunks);
      __privateAdd(this, _insertSectionIntoChunk);
      __privateAdd(this, _createChunk);
      __privateAdd(this, _flushChunks);
      __privateAdd(this, _target2, void 0);
      __privateAdd(this, _sections, []);
      __privateAdd(this, _chunked, void 0);
      __privateAdd(this, _chunkSize, void 0);
      /**
       * The data is divided up into fixed-size chunks, whose contents are first filled in RAM and then flushed out.
       * A chunk is flushed if all of its contents have been written.
       */
      __privateAdd(this, _chunks, []);
      __privateSet(this, _target2, target);
      __privateSet(this, _chunked, target.options?.chunked ?? false);
      __privateSet(this, _chunkSize, target.options?.chunkSize ?? DEFAULT_CHUNK_SIZE);
    }
    write(data) {
      __privateGet(this, _sections).push({
        data: data.slice(),
        start: this.pos
      });
      this.pos += data.byteLength;
    }
    flush() {
      if (__privateGet(this, _sections).length === 0)
        return;
      let chunks = [];
      let sorted = [...__privateGet(this, _sections)].sort((a, b) => a.start - b.start);
      chunks.push({
        start: sorted[0].start,
        size: sorted[0].data.byteLength
      });
      for (let i = 1; i < sorted.length; i++) {
        let lastChunk = chunks[chunks.length - 1];
        let section = sorted[i];
        if (section.start <= lastChunk.start + lastChunk.size) {
          lastChunk.size = Math.max(lastChunk.size, section.start + section.data.byteLength - lastChunk.start);
        } else {
          chunks.push({
            start: section.start,
            size: section.data.byteLength
          });
        }
      }
      for (let chunk of chunks) {
        chunk.data = new Uint8Array(chunk.size);
        for (let section of __privateGet(this, _sections)) {
          if (chunk.start <= section.start && section.start < chunk.start + chunk.size) {
            chunk.data.set(section.data, section.start - chunk.start);
          }
        }
        if (__privateGet(this, _chunked)) {
          __privateMethod(this, _writeDataIntoChunks, writeDataIntoChunks_fn).call(this, chunk.data, chunk.start);
          __privateMethod(this, _flushChunks, flushChunks_fn).call(this);
        } else {
          __privateGet(this, _target2).options.onData?.(chunk.data, chunk.start);
        }
      }
      __privateGet(this, _sections).length = 0;
    }
    finalize() {
      if (__privateGet(this, _chunked)) {
        __privateMethod(this, _flushChunks, flushChunks_fn).call(this, true);
      }
    }
  };
  _target2 = new WeakMap();
  _sections = new WeakMap();
  _chunked = new WeakMap();
  _chunkSize = new WeakMap();
  _chunks = new WeakMap();
  _writeDataIntoChunks = new WeakSet();
  writeDataIntoChunks_fn = function(data, position) {
    let chunkIndex = __privateGet(this, _chunks).findIndex((x) => x.start <= position && position < x.start + __privateGet(this, _chunkSize));
    if (chunkIndex === -1)
      chunkIndex = __privateMethod(this, _createChunk, createChunk_fn).call(this, position);
    let chunk = __privateGet(this, _chunks)[chunkIndex];
    let relativePosition = position - chunk.start;
    let toWrite = data.subarray(0, Math.min(__privateGet(this, _chunkSize) - relativePosition, data.byteLength));
    chunk.data.set(toWrite, relativePosition);
    let section = {
      start: relativePosition,
      end: relativePosition + toWrite.byteLength
    };
    __privateMethod(this, _insertSectionIntoChunk, insertSectionIntoChunk_fn).call(this, chunk, section);
    if (chunk.written[0].start === 0 && chunk.written[0].end === __privateGet(this, _chunkSize)) {
      chunk.shouldFlush = true;
    }
    if (__privateGet(this, _chunks).length > MAX_CHUNKS_AT_ONCE) {
      for (let i = 0; i < __privateGet(this, _chunks).length - 1; i++) {
        __privateGet(this, _chunks)[i].shouldFlush = true;
      }
      __privateMethod(this, _flushChunks, flushChunks_fn).call(this);
    }
    if (toWrite.byteLength < data.byteLength) {
      __privateMethod(this, _writeDataIntoChunks, writeDataIntoChunks_fn).call(this, data.subarray(toWrite.byteLength), position + toWrite.byteLength);
    }
  };
  _insertSectionIntoChunk = new WeakSet();
  insertSectionIntoChunk_fn = function(chunk, section) {
    let low = 0;
    let high = chunk.written.length - 1;
    let index = -1;
    while (low <= high) {
      let mid = Math.floor(low + (high - low + 1) / 2);
      if (chunk.written[mid].start <= section.start) {
        low = mid + 1;
        index = mid;
      } else {
        high = mid - 1;
      }
    }
    chunk.written.splice(index + 1, 0, section);
    if (index === -1 || chunk.written[index].end < section.start)
      index++;
    while (index < chunk.written.length - 1 && chunk.written[index].end >= chunk.written[index + 1].start) {
      chunk.written[index].end = Math.max(chunk.written[index].end, chunk.written[index + 1].end);
      chunk.written.splice(index + 1, 1);
    }
  };
  _createChunk = new WeakSet();
  createChunk_fn = function(includesPosition) {
    let start = Math.floor(includesPosition / __privateGet(this, _chunkSize)) * __privateGet(this, _chunkSize);
    let chunk = {
      start,
      data: new Uint8Array(__privateGet(this, _chunkSize)),
      written: [],
      shouldFlush: false
    };
    __privateGet(this, _chunks).push(chunk);
    __privateGet(this, _chunks).sort((a, b) => a.start - b.start);
    return __privateGet(this, _chunks).indexOf(chunk);
  };
  _flushChunks = new WeakSet();
  flushChunks_fn = function(force = false) {
    for (let i = 0; i < __privateGet(this, _chunks).length; i++) {
      let chunk = __privateGet(this, _chunks)[i];
      if (!chunk.shouldFlush && !force)
        continue;
      for (let section of chunk.written) {
        __privateGet(this, _target2).options.onData?.(
          chunk.data.subarray(section.start, section.end),
          chunk.start + section.start
        );
      }
      __privateGet(this, _chunks).splice(i--, 1);
    }
  };
  var FileSystemWritableFileStreamTargetWriter = class extends StreamTargetWriter {
    constructor(target) {
      super(new StreamTarget({
        onData: (data, position) => target.stream.write({
          type: "write",
          data,
          position
        }),
        chunked: true,
        chunkSize: target.options?.chunkSize
      }));
    }
  };

  // src/muxer.ts
  var GLOBAL_TIMESCALE = 1e3;
  var SUPPORTED_VIDEO_CODECS = ["avc", "hevc", "vp9", "av1"];
  var SUPPORTED_AUDIO_CODECS = ["aac", "opus"];
  var TIMESTAMP_OFFSET = 2082844800;
  var FIRST_TIMESTAMP_BEHAVIORS = ["strict", "offset", "cross-track-offset"];
  var _options, _writer, _ftypSize, _mdat, _videoTrack, _audioTrack, _creationTime, _finalizedChunks, _nextFragmentNumber, _videoSampleQueue, _audioSampleQueue, _finalized, _validateOptions, validateOptions_fn, _writeHeader, writeHeader_fn, _computeMoovSizeUpperBound, computeMoovSizeUpperBound_fn, _prepareTracks, prepareTracks_fn, _generateMpeg4AudioSpecificConfig, generateMpeg4AudioSpecificConfig_fn, _createSampleForTrack, createSampleForTrack_fn, _addSampleToTrack, addSampleToTrack_fn, _validateTimestamp, validateTimestamp_fn, _finalizeCurrentChunk, finalizeCurrentChunk_fn, _finalizeFragment, finalizeFragment_fn, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn, _ensureNotFinalized, ensureNotFinalized_fn;
  var Muxer = class {
    constructor(options) {
      __privateAdd(this, _validateOptions);
      __privateAdd(this, _writeHeader);
      __privateAdd(this, _computeMoovSizeUpperBound);
      __privateAdd(this, _prepareTracks);
      // https://wiki.multimedia.cx/index.php/MPEG-4_Audio
      __privateAdd(this, _generateMpeg4AudioSpecificConfig);
      __privateAdd(this, _createSampleForTrack);
      __privateAdd(this, _addSampleToTrack);
      __privateAdd(this, _validateTimestamp);
      __privateAdd(this, _finalizeCurrentChunk);
      __privateAdd(this, _finalizeFragment);
      __privateAdd(this, _maybeFlushStreamingTargetWriter);
      __privateAdd(this, _ensureNotFinalized);
      __privateAdd(this, _options, void 0);
      __privateAdd(this, _writer, void 0);
      __privateAdd(this, _ftypSize, void 0);
      __privateAdd(this, _mdat, void 0);
      __privateAdd(this, _videoTrack, null);
      __privateAdd(this, _audioTrack, null);
      __privateAdd(this, _creationTime, Math.floor(Date.now() / 1e3) + TIMESTAMP_OFFSET);
      __privateAdd(this, _finalizedChunks, []);
      // Fields for fragmented MP4:
      __privateAdd(this, _nextFragmentNumber, 1);
      __privateAdd(this, _videoSampleQueue, []);
      __privateAdd(this, _audioSampleQueue, []);
      __privateAdd(this, _finalized, false);
      __privateMethod(this, _validateOptions, validateOptions_fn).call(this, options);
      options.video = deepClone(options.video);
      options.audio = deepClone(options.audio);
      options.fastStart = deepClone(options.fastStart);
      this.target = options.target;
      __privateSet(this, _options, {
        firstTimestampBehavior: "strict",
        ...options
      });
      if (options.target instanceof ArrayBufferTarget) {
        __privateSet(this, _writer, new ArrayBufferTargetWriter(options.target));
      } else if (options.target instanceof StreamTarget) {
        __privateSet(this, _writer, new StreamTargetWriter(options.target));
      } else if (options.target instanceof FileSystemWritableFileStreamTarget) {
        __privateSet(this, _writer, new FileSystemWritableFileStreamTargetWriter(options.target));
      } else {
        throw new Error(`Invalid target: ${options.target}`);
      }
      __privateMethod(this, _prepareTracks, prepareTracks_fn).call(this);
      __privateMethod(this, _writeHeader, writeHeader_fn).call(this);
    }
    addVideoChunk(sample, meta, timestamp, compositionTimeOffset) {
      if (!(sample instanceof EncodedVideoChunk)) {
        throw new TypeError("addVideoChunk's first argument (sample) must be of type EncodedVideoChunk.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addVideoChunk's second argument (meta), when provided, must be an object.");
      }
      if (timestamp !== void 0 && (!Number.isFinite(timestamp) || timestamp < 0)) {
        throw new TypeError(
          "addVideoChunk's third argument (timestamp), when provided, must be a non-negative real number."
        );
      }
      if (compositionTimeOffset !== void 0 && !Number.isFinite(compositionTimeOffset)) {
        throw new TypeError(
          "addVideoChunk's fourth argument (compositionTimeOffset), when provided, must be a real number."
        );
      }
      let data = new Uint8Array(sample.byteLength);
      sample.copyTo(data);
      this.addVideoChunkRaw(
        data,
        sample.type,
        timestamp ?? sample.timestamp,
        sample.duration,
        meta,
        compositionTimeOffset
      );
    }
    addVideoChunkRaw(data, type, timestamp, duration, meta, compositionTimeOffset) {
      if (!(data instanceof Uint8Array)) {
        throw new TypeError("addVideoChunkRaw's first argument (data) must be an instance of Uint8Array.");
      }
      if (type !== "key" && type !== "delta") {
        throw new TypeError("addVideoChunkRaw's second argument (type) must be either 'key' or 'delta'.");
      }
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new TypeError("addVideoChunkRaw's third argument (timestamp) must be a non-negative real number.");
      }
      if (!Number.isFinite(duration) || duration < 0) {
        throw new TypeError("addVideoChunkRaw's fourth argument (duration) must be a non-negative real number.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addVideoChunkRaw's fifth argument (meta), when provided, must be an object.");
      }
      if (compositionTimeOffset !== void 0 && !Number.isFinite(compositionTimeOffset)) {
        throw new TypeError(
          "addVideoChunkRaw's sixth argument (compositionTimeOffset), when provided, must be a real number."
        );
      }
      __privateMethod(this, _ensureNotFinalized, ensureNotFinalized_fn).call(this);
      if (!__privateGet(this, _options).video)
        throw new Error("No video track declared.");
      if (typeof __privateGet(this, _options).fastStart === "object" && __privateGet(this, _videoTrack).samples.length === __privateGet(this, _options).fastStart.expectedVideoChunks) {
        throw new Error(`Cannot add more video chunks than specified in 'fastStart' (${__privateGet(this, _options).fastStart.expectedVideoChunks}).`);
      }
      let videoSample = __privateMethod(this, _createSampleForTrack, createSampleForTrack_fn).call(this, __privateGet(this, _videoTrack), data, type, timestamp, duration, meta, compositionTimeOffset);
      if (__privateGet(this, _options).fastStart === "fragmented" && __privateGet(this, _audioTrack)) {
        while (__privateGet(this, _audioSampleQueue).length > 0 && __privateGet(this, _audioSampleQueue)[0].decodeTimestamp <= videoSample.decodeTimestamp) {
          let audioSample = __privateGet(this, _audioSampleQueue).shift();
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _audioTrack), audioSample);
        }
        if (videoSample.decodeTimestamp <= __privateGet(this, _audioTrack).lastDecodeTimestamp) {
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _videoTrack), videoSample);
        } else {
          __privateGet(this, _videoSampleQueue).push(videoSample);
        }
      } else {
        __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _videoTrack), videoSample);
      }
    }
    addAudioChunk(sample, meta, timestamp) {
      if (!(sample instanceof EncodedAudioChunk)) {
        throw new TypeError("addAudioChunk's first argument (sample) must be of type EncodedAudioChunk.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addAudioChunk's second argument (meta), when provided, must be an object.");
      }
      if (timestamp !== void 0 && (!Number.isFinite(timestamp) || timestamp < 0)) {
        throw new TypeError(
          "addAudioChunk's third argument (timestamp), when provided, must be a non-negative real number."
        );
      }
      let data = new Uint8Array(sample.byteLength);
      sample.copyTo(data);
      this.addAudioChunkRaw(data, sample.type, timestamp ?? sample.timestamp, sample.duration, meta);
    }
    addAudioChunkRaw(data, type, timestamp, duration, meta) {
      if (!(data instanceof Uint8Array)) {
        throw new TypeError("addAudioChunkRaw's first argument (data) must be an instance of Uint8Array.");
      }
      if (type !== "key" && type !== "delta") {
        throw new TypeError("addAudioChunkRaw's second argument (type) must be either 'key' or 'delta'.");
      }
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new TypeError("addAudioChunkRaw's third argument (timestamp) must be a non-negative real number.");
      }
      if (!Number.isFinite(duration) || duration < 0) {
        throw new TypeError("addAudioChunkRaw's fourth argument (duration) must be a non-negative real number.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addAudioChunkRaw's fifth argument (meta), when provided, must be an object.");
      }
      __privateMethod(this, _ensureNotFinalized, ensureNotFinalized_fn).call(this);
      if (!__privateGet(this, _options).audio)
        throw new Error("No audio track declared.");
      if (typeof __privateGet(this, _options).fastStart === "object" && __privateGet(this, _audioTrack).samples.length === __privateGet(this, _options).fastStart.expectedAudioChunks) {
        throw new Error(`Cannot add more audio chunks than specified in 'fastStart' (${__privateGet(this, _options).fastStart.expectedAudioChunks}).`);
      }
      let audioSample = __privateMethod(this, _createSampleForTrack, createSampleForTrack_fn).call(this, __privateGet(this, _audioTrack), data, type, timestamp, duration, meta);
      if (__privateGet(this, _options).fastStart === "fragmented" && __privateGet(this, _videoTrack)) {
        while (__privateGet(this, _videoSampleQueue).length > 0 && __privateGet(this, _videoSampleQueue)[0].decodeTimestamp <= audioSample.decodeTimestamp) {
          let videoSample = __privateGet(this, _videoSampleQueue).shift();
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _videoTrack), videoSample);
        }
        if (audioSample.decodeTimestamp <= __privateGet(this, _videoTrack).lastDecodeTimestamp) {
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _audioTrack), audioSample);
        } else {
          __privateGet(this, _audioSampleQueue).push(audioSample);
        }
      } else {
        __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _audioTrack), audioSample);
      }
    }
    /** Finalizes the file, making it ready for use. Must be called after all video and audio chunks have been added. */
    finalize() {
      if (__privateGet(this, _finalized)) {
        throw new Error("Cannot finalize a muxer more than once.");
      }
      if (__privateGet(this, _options).fastStart === "fragmented") {
        for (let videoSample of __privateGet(this, _videoSampleQueue))
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _videoTrack), videoSample);
        for (let audioSample of __privateGet(this, _audioSampleQueue))
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _audioTrack), audioSample);
        __privateMethod(this, _finalizeFragment, finalizeFragment_fn).call(this, false);
      } else {
        if (__privateGet(this, _videoTrack))
          __privateMethod(this, _finalizeCurrentChunk, finalizeCurrentChunk_fn).call(this, __privateGet(this, _videoTrack));
        if (__privateGet(this, _audioTrack))
          __privateMethod(this, _finalizeCurrentChunk, finalizeCurrentChunk_fn).call(this, __privateGet(this, _audioTrack));
      }
      let tracks = [__privateGet(this, _videoTrack), __privateGet(this, _audioTrack)].filter(Boolean);
      if (__privateGet(this, _options).fastStart === "in-memory") {
        let mdatSize;
        for (let i = 0; i < 2; i++) {
          let movieBox2 = moov(tracks, __privateGet(this, _creationTime));
          let movieBoxSize = __privateGet(this, _writer).measureBox(movieBox2);
          mdatSize = __privateGet(this, _writer).measureBox(__privateGet(this, _mdat));
          let currentChunkPos = __privateGet(this, _writer).pos + movieBoxSize + mdatSize;
          for (let chunk of __privateGet(this, _finalizedChunks)) {
            chunk.offset = currentChunkPos;
            for (let { data } of chunk.samples) {
              currentChunkPos += data.byteLength;
              mdatSize += data.byteLength;
            }
          }
          if (currentChunkPos < 2 ** 32)
            break;
          if (mdatSize >= 2 ** 32)
            __privateGet(this, _mdat).largeSize = true;
        }
        let movieBox = moov(tracks, __privateGet(this, _creationTime));
        __privateGet(this, _writer).writeBox(movieBox);
        __privateGet(this, _mdat).size = mdatSize;
        __privateGet(this, _writer).writeBox(__privateGet(this, _mdat));
        for (let chunk of __privateGet(this, _finalizedChunks)) {
          for (let sample of chunk.samples) {
            __privateGet(this, _writer).write(sample.data);
            sample.data = null;
          }
        }
      } else if (__privateGet(this, _options).fastStart === "fragmented") {
        let startPos = __privateGet(this, _writer).pos;
        let mfraBox = mfra(tracks);
        __privateGet(this, _writer).writeBox(mfraBox);
        let mfraBoxSize = __privateGet(this, _writer).pos - startPos;
        __privateGet(this, _writer).seek(__privateGet(this, _writer).pos - 4);
        __privateGet(this, _writer).writeU32(mfraBoxSize);
      } else {
        let mdatPos = __privateGet(this, _writer).offsets.get(__privateGet(this, _mdat));
        let mdatSize = __privateGet(this, _writer).pos - mdatPos;
        __privateGet(this, _mdat).size = mdatSize;
        __privateGet(this, _mdat).largeSize = mdatSize >= 2 ** 32;
        __privateGet(this, _writer).patchBox(__privateGet(this, _mdat));
        let movieBox = moov(tracks, __privateGet(this, _creationTime));
        if (typeof __privateGet(this, _options).fastStart === "object") {
          __privateGet(this, _writer).seek(__privateGet(this, _ftypSize));
          __privateGet(this, _writer).writeBox(movieBox);
          let remainingBytes = mdatPos - __privateGet(this, _writer).pos;
          __privateGet(this, _writer).writeBox(free(remainingBytes));
        } else {
          __privateGet(this, _writer).writeBox(movieBox);
        }
      }
      __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
      __privateGet(this, _writer).finalize();
      __privateSet(this, _finalized, true);
    }
  };
  _options = new WeakMap();
  _writer = new WeakMap();
  _ftypSize = new WeakMap();
  _mdat = new WeakMap();
  _videoTrack = new WeakMap();
  _audioTrack = new WeakMap();
  _creationTime = new WeakMap();
  _finalizedChunks = new WeakMap();
  _nextFragmentNumber = new WeakMap();
  _videoSampleQueue = new WeakMap();
  _audioSampleQueue = new WeakMap();
  _finalized = new WeakMap();
  _validateOptions = new WeakSet();
  validateOptions_fn = function(options) {
    if (typeof options !== "object") {
      throw new TypeError("The muxer requires an options object to be passed to its constructor.");
    }
    if (!(options.target instanceof Target)) {
      throw new TypeError("The target must be provided and an instance of Target.");
    }
    if (options.video) {
      if (!SUPPORTED_VIDEO_CODECS.includes(options.video.codec)) {
        throw new TypeError(`Unsupported video codec: ${options.video.codec}`);
      }
      if (!Number.isInteger(options.video.width) || options.video.width <= 0) {
        throw new TypeError(`Invalid video width: ${options.video.width}. Must be a positive integer.`);
      }
      if (!Number.isInteger(options.video.height) || options.video.height <= 0) {
        throw new TypeError(`Invalid video height: ${options.video.height}. Must be a positive integer.`);
      }
      const videoRotation = options.video.rotation;
      if (typeof videoRotation === "number" && ![0, 90, 180, 270].includes(videoRotation)) {
        throw new TypeError(`Invalid video rotation: ${videoRotation}. Has to be 0, 90, 180 or 270.`);
      } else if (Array.isArray(videoRotation) && (videoRotation.length !== 9 || videoRotation.some((value) => typeof value !== "number"))) {
        throw new TypeError(`Invalid video transformation matrix: ${videoRotation.join()}`);
      }
      if (options.video.frameRate !== void 0 && (!Number.isInteger(options.video.frameRate) || options.video.frameRate <= 0)) {
        throw new TypeError(
          `Invalid video frame rate: ${options.video.frameRate}. Must be a positive integer.`
        );
      }
    }
    if (options.audio) {
      if (!SUPPORTED_AUDIO_CODECS.includes(options.audio.codec)) {
        throw new TypeError(`Unsupported audio codec: ${options.audio.codec}`);
      }
      if (!Number.isInteger(options.audio.numberOfChannels) || options.audio.numberOfChannels <= 0) {
        throw new TypeError(
          `Invalid number of audio channels: ${options.audio.numberOfChannels}. Must be a positive integer.`
        );
      }
      if (!Number.isInteger(options.audio.sampleRate) || options.audio.sampleRate <= 0) {
        throw new TypeError(
          `Invalid audio sample rate: ${options.audio.sampleRate}. Must be a positive integer.`
        );
      }
    }
    if (options.firstTimestampBehavior && !FIRST_TIMESTAMP_BEHAVIORS.includes(options.firstTimestampBehavior)) {
      throw new TypeError(`Invalid first timestamp behavior: ${options.firstTimestampBehavior}`);
    }
    if (typeof options.fastStart === "object") {
      if (options.video) {
        if (options.fastStart.expectedVideoChunks === void 0) {
          throw new TypeError(`'fastStart' is an object but is missing property 'expectedVideoChunks'.`);
        } else if (!Number.isInteger(options.fastStart.expectedVideoChunks) || options.fastStart.expectedVideoChunks < 0) {
          throw new TypeError(`'expectedVideoChunks' must be a non-negative integer.`);
        }
      }
      if (options.audio) {
        if (options.fastStart.expectedAudioChunks === void 0) {
          throw new TypeError(`'fastStart' is an object but is missing property 'expectedAudioChunks'.`);
        } else if (!Number.isInteger(options.fastStart.expectedAudioChunks) || options.fastStart.expectedAudioChunks < 0) {
          throw new TypeError(`'expectedAudioChunks' must be a non-negative integer.`);
        }
      }
    } else if (![false, "in-memory", "fragmented"].includes(options.fastStart)) {
      throw new TypeError(`'fastStart' option must be false, 'in-memory', 'fragmented' or an object.`);
    }
    if (options.minFragmentDuration !== void 0 && (!Number.isFinite(options.minFragmentDuration) || options.minFragmentDuration < 0)) {
      throw new TypeError(`'minFragmentDuration' must be a non-negative number.`);
    }
  };
  _writeHeader = new WeakSet();
  writeHeader_fn = function() {
    __privateGet(this, _writer).writeBox(ftyp({
      holdsAvc: __privateGet(this, _options).video?.codec === "avc",
      fragmented: __privateGet(this, _options).fastStart === "fragmented"
    }));
    __privateSet(this, _ftypSize, __privateGet(this, _writer).pos);
    if (__privateGet(this, _options).fastStart === "in-memory") {
      __privateSet(this, _mdat, mdat(false));
    } else if (__privateGet(this, _options).fastStart === "fragmented") {
    } else {
      if (typeof __privateGet(this, _options).fastStart === "object") {
        let moovSizeUpperBound = __privateMethod(this, _computeMoovSizeUpperBound, computeMoovSizeUpperBound_fn).call(this);
        __privateGet(this, _writer).seek(__privateGet(this, _writer).pos + moovSizeUpperBound);
      }
      __privateSet(this, _mdat, mdat(true));
      __privateGet(this, _writer).writeBox(__privateGet(this, _mdat));
    }
    __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
  };
  _computeMoovSizeUpperBound = new WeakSet();
  computeMoovSizeUpperBound_fn = function() {
    if (typeof __privateGet(this, _options).fastStart !== "object")
      return;
    let upperBound = 0;
    let sampleCounts = [
      __privateGet(this, _options).fastStart.expectedVideoChunks,
      __privateGet(this, _options).fastStart.expectedAudioChunks
    ];
    for (let n of sampleCounts) {
      if (!n)
        continue;
      upperBound += (4 + 4) * Math.ceil(2 / 3 * n);
      upperBound += 4 * n;
      upperBound += (4 + 4 + 4) * Math.ceil(2 / 3 * n);
      upperBound += 4 * n;
      upperBound += 8 * n;
    }
    upperBound += 4096;
    return upperBound;
  };
  _prepareTracks = new WeakSet();
  prepareTracks_fn = function() {
    if (__privateGet(this, _options).video) {
      __privateSet(this, _videoTrack, {
        id: 1,
        info: {
          type: "video",
          codec: __privateGet(this, _options).video.codec,
          width: __privateGet(this, _options).video.width,
          height: __privateGet(this, _options).video.height,
          rotation: __privateGet(this, _options).video.rotation ?? 0,
          decoderConfig: null
        },
        // The fallback contains many common frame rates as factors
        timescale: __privateGet(this, _options).video.frameRate ?? 57600,
        samples: [],
        finalizedChunks: [],
        currentChunk: null,
        firstDecodeTimestamp: void 0,
        lastDecodeTimestamp: -1,
        timeToSampleTable: [],
        compositionTimeOffsetTable: [],
        lastTimescaleUnits: null,
        lastSample: null,
        compactlyCodedChunkTable: []
      });
    }
    if (__privateGet(this, _options).audio) {
      __privateSet(this, _audioTrack, {
        id: __privateGet(this, _options).video ? 2 : 1,
        info: {
          type: "audio",
          codec: __privateGet(this, _options).audio.codec,
          numberOfChannels: __privateGet(this, _options).audio.numberOfChannels,
          sampleRate: __privateGet(this, _options).audio.sampleRate,
          decoderConfig: null
        },
        timescale: __privateGet(this, _options).audio.sampleRate,
        samples: [],
        finalizedChunks: [],
        currentChunk: null,
        firstDecodeTimestamp: void 0,
        lastDecodeTimestamp: -1,
        timeToSampleTable: [],
        compositionTimeOffsetTable: [],
        lastTimescaleUnits: null,
        lastSample: null,
        compactlyCodedChunkTable: []
      });
      if (__privateGet(this, _options).audio.codec === "aac") {
        let guessedCodecPrivate = __privateMethod(this, _generateMpeg4AudioSpecificConfig, generateMpeg4AudioSpecificConfig_fn).call(
          this,
          2,
          // Object type for AAC-LC, since it's the most common
          __privateGet(this, _options).audio.sampleRate,
          __privateGet(this, _options).audio.numberOfChannels
        );
        __privateGet(this, _audioTrack).info.decoderConfig = {
          codec: __privateGet(this, _options).audio.codec,
          description: guessedCodecPrivate,
          numberOfChannels: __privateGet(this, _options).audio.numberOfChannels,
          sampleRate: __privateGet(this, _options).audio.sampleRate
        };
      }
    }
  };
  _generateMpeg4AudioSpecificConfig = new WeakSet();
  generateMpeg4AudioSpecificConfig_fn = function(objectType, sampleRate, numberOfChannels) {
    let frequencyIndices = [96e3, 88200, 64e3, 48e3, 44100, 32e3, 24e3, 22050, 16e3, 12e3, 11025, 8e3, 7350];
    let frequencyIndex = frequencyIndices.indexOf(sampleRate);
    let channelConfig = numberOfChannels;
    let configBits = "";
    configBits += objectType.toString(2).padStart(5, "0");
    configBits += frequencyIndex.toString(2).padStart(4, "0");
    if (frequencyIndex === 15)
      configBits += sampleRate.toString(2).padStart(24, "0");
    configBits += channelConfig.toString(2).padStart(4, "0");
    let paddingLength = Math.ceil(configBits.length / 8) * 8;
    configBits = configBits.padEnd(paddingLength, "0");
    let configBytes = new Uint8Array(configBits.length / 8);
    for (let i = 0; i < configBits.length; i += 8) {
      configBytes[i / 8] = parseInt(configBits.slice(i, i + 8), 2);
    }
    return configBytes;
  };
  _createSampleForTrack = new WeakSet();
  createSampleForTrack_fn = function(track, data, type, timestamp, duration, meta, compositionTimeOffset) {
    let presentationTimestampInSeconds = timestamp / 1e6;
    let decodeTimestampInSeconds = (timestamp - (compositionTimeOffset ?? 0)) / 1e6;
    let durationInSeconds = duration / 1e6;
    let adjusted = __privateMethod(this, _validateTimestamp, validateTimestamp_fn).call(this, presentationTimestampInSeconds, decodeTimestampInSeconds, track);
    presentationTimestampInSeconds = adjusted.presentationTimestamp;
    decodeTimestampInSeconds = adjusted.decodeTimestamp;
    if (meta?.decoderConfig) {
      if (track.info.decoderConfig === null) {
        track.info.decoderConfig = meta.decoderConfig;
      } else {
        Object.assign(track.info.decoderConfig, meta.decoderConfig);
      }
    }
    let sample = {
      presentationTimestamp: presentationTimestampInSeconds,
      decodeTimestamp: decodeTimestampInSeconds,
      duration: durationInSeconds,
      data,
      size: data.byteLength,
      type,
      // Will be refined once the next sample comes in
      timescaleUnitsToNextSample: intoTimescale(durationInSeconds, track.timescale)
    };
    return sample;
  };
  _addSampleToTrack = new WeakSet();
  addSampleToTrack_fn = function(track, sample) {
    if (__privateGet(this, _options).fastStart !== "fragmented") {
      track.samples.push(sample);
    }
    const sampleCompositionTimeOffset = intoTimescale(sample.presentationTimestamp - sample.decodeTimestamp, track.timescale);
    if (track.lastTimescaleUnits !== null) {
      let timescaleUnits = intoTimescale(sample.decodeTimestamp, track.timescale, false);
      let delta = Math.round(timescaleUnits - track.lastTimescaleUnits);
      track.lastTimescaleUnits += delta;
      track.lastSample.timescaleUnitsToNextSample = delta;
      if (__privateGet(this, _options).fastStart !== "fragmented") {
        let lastTableEntry = last(track.timeToSampleTable);
        if (lastTableEntry.sampleCount === 1) {
          lastTableEntry.sampleDelta = delta;
          lastTableEntry.sampleCount++;
        } else if (lastTableEntry.sampleDelta === delta) {
          lastTableEntry.sampleCount++;
        } else {
          lastTableEntry.sampleCount--;
          track.timeToSampleTable.push({
            sampleCount: 2,
            sampleDelta: delta
          });
        }
        const lastCompositionTimeOffsetTableEntry = last(track.compositionTimeOffsetTable);
        if (lastCompositionTimeOffsetTableEntry.sampleCompositionTimeOffset === sampleCompositionTimeOffset) {
          lastCompositionTimeOffsetTableEntry.sampleCount++;
        } else {
          track.compositionTimeOffsetTable.push({
            sampleCount: 1,
            sampleCompositionTimeOffset
          });
        }
      }
    } else {
      track.lastTimescaleUnits = 0;
      if (__privateGet(this, _options).fastStart !== "fragmented") {
        track.timeToSampleTable.push({
          sampleCount: 1,
          sampleDelta: intoTimescale(sample.duration, track.timescale)
        });
        track.compositionTimeOffsetTable.push({
          sampleCount: 1,
          sampleCompositionTimeOffset
        });
      }
    }
    track.lastSample = sample;
    let beginNewChunk = false;
    if (!track.currentChunk) {
      beginNewChunk = true;
    } else {
      let currentChunkDuration = sample.presentationTimestamp - track.currentChunk.startTimestamp;
      if (__privateGet(this, _options).fastStart === "fragmented") {
        let mostImportantTrack = __privateGet(this, _videoTrack) ?? __privateGet(this, _audioTrack);
        const chunkDuration = __privateGet(this, _options).minFragmentDuration ?? 1;
        if (track === mostImportantTrack && sample.type === "key" && currentChunkDuration >= chunkDuration) {
          beginNewChunk = true;
          __privateMethod(this, _finalizeFragment, finalizeFragment_fn).call(this);
        }
      } else {
        beginNewChunk = currentChunkDuration >= 0.5;
      }
    }
    if (beginNewChunk) {
      if (track.currentChunk) {
        __privateMethod(this, _finalizeCurrentChunk, finalizeCurrentChunk_fn).call(this, track);
      }
      track.currentChunk = {
        startTimestamp: sample.presentationTimestamp,
        samples: []
      };
    }
    track.currentChunk.samples.push(sample);
  };
  _validateTimestamp = new WeakSet();
  validateTimestamp_fn = function(presentationTimestamp, decodeTimestamp, track) {
    const strictTimestampBehavior = __privateGet(this, _options).firstTimestampBehavior === "strict";
    const noLastDecodeTimestamp = track.lastDecodeTimestamp === -1;
    const timestampNonZero = decodeTimestamp !== 0;
    if (strictTimestampBehavior && noLastDecodeTimestamp && timestampNonZero) {
      throw new Error(
        `The first chunk for your media track must have a timestamp of 0 (received DTS=${decodeTimestamp}).Non-zero first timestamps are often caused by directly piping frames or audio data from a MediaStreamTrack into the encoder. Their timestamps are typically relative to the age of thedocument, which is probably what you want.

If you want to offset all timestamps of a track such that the first one is zero, set firstTimestampBehavior: 'offset' in the options.
`
      );
    } else if (__privateGet(this, _options).firstTimestampBehavior === "offset" || __privateGet(this, _options).firstTimestampBehavior === "cross-track-offset") {
      if (track.firstDecodeTimestamp === void 0) {
        track.firstDecodeTimestamp = decodeTimestamp;
      }
      let baseDecodeTimestamp;
      if (__privateGet(this, _options).firstTimestampBehavior === "offset") {
        baseDecodeTimestamp = track.firstDecodeTimestamp;
      } else {
        baseDecodeTimestamp = Math.min(
          __privateGet(this, _videoTrack)?.firstDecodeTimestamp ?? Infinity,
          __privateGet(this, _audioTrack)?.firstDecodeTimestamp ?? Infinity
        );
      }
      decodeTimestamp -= baseDecodeTimestamp;
      presentationTimestamp -= baseDecodeTimestamp;
    }
    if (decodeTimestamp < track.lastDecodeTimestamp) {
      throw new Error(
        `Timestamps must be monotonically increasing (DTS went from ${track.lastDecodeTimestamp * 1e6} to ${decodeTimestamp * 1e6}).`
      );
    }
    track.lastDecodeTimestamp = decodeTimestamp;
    return { presentationTimestamp, decodeTimestamp };
  };
  _finalizeCurrentChunk = new WeakSet();
  finalizeCurrentChunk_fn = function(track) {
    if (__privateGet(this, _options).fastStart === "fragmented") {
      throw new Error("Can't finalize individual chunks if 'fastStart' is set to 'fragmented'.");
    }
    if (!track.currentChunk)
      return;
    track.finalizedChunks.push(track.currentChunk);
    __privateGet(this, _finalizedChunks).push(track.currentChunk);
    if (track.compactlyCodedChunkTable.length === 0 || last(track.compactlyCodedChunkTable).samplesPerChunk !== track.currentChunk.samples.length) {
      track.compactlyCodedChunkTable.push({
        firstChunk: track.finalizedChunks.length,
        // 1-indexed
        samplesPerChunk: track.currentChunk.samples.length
      });
    }
    if (__privateGet(this, _options).fastStart === "in-memory") {
      track.currentChunk.offset = 0;
      return;
    }
    track.currentChunk.offset = __privateGet(this, _writer).pos;
    for (let sample of track.currentChunk.samples) {
      __privateGet(this, _writer).write(sample.data);
      sample.data = null;
    }
    __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
  };
  _finalizeFragment = new WeakSet();
  finalizeFragment_fn = function(flushStreamingWriter = true) {
    if (__privateGet(this, _options).fastStart !== "fragmented") {
      throw new Error("Can't finalize a fragment unless 'fastStart' is set to 'fragmented'.");
    }
    let tracks = [__privateGet(this, _videoTrack), __privateGet(this, _audioTrack)].filter((track) => track && track.currentChunk);
    if (tracks.length === 0)
      return;
    let fragmentNumber = __privateWrapper(this, _nextFragmentNumber)._++;
    if (fragmentNumber === 1) {
      let movieBox = moov(tracks, __privateGet(this, _creationTime), true);
      __privateGet(this, _writer).writeBox(movieBox);
    }
    let moofOffset = __privateGet(this, _writer).pos;
    let moofBox = moof(fragmentNumber, tracks);
    __privateGet(this, _writer).writeBox(moofBox);
    {
      let mdatBox = mdat(false);
      let totalTrackSampleSize = 0;
      for (let track of tracks) {
        for (let sample of track.currentChunk.samples) {
          totalTrackSampleSize += sample.size;
        }
      }
      let mdatSize = __privateGet(this, _writer).measureBox(mdatBox) + totalTrackSampleSize;
      if (mdatSize >= 2 ** 32) {
        mdatBox.largeSize = true;
        mdatSize = __privateGet(this, _writer).measureBox(mdatBox) + totalTrackSampleSize;
      }
      mdatBox.size = mdatSize;
      __privateGet(this, _writer).writeBox(mdatBox);
    }
    for (let track of tracks) {
      track.currentChunk.offset = __privateGet(this, _writer).pos;
      track.currentChunk.moofOffset = moofOffset;
      for (let sample of track.currentChunk.samples) {
        __privateGet(this, _writer).write(sample.data);
        sample.data = null;
      }
    }
    let endPos = __privateGet(this, _writer).pos;
    __privateGet(this, _writer).seek(__privateGet(this, _writer).offsets.get(moofBox));
    let newMoofBox = moof(fragmentNumber, tracks);
    __privateGet(this, _writer).writeBox(newMoofBox);
    __privateGet(this, _writer).seek(endPos);
    for (let track of tracks) {
      track.finalizedChunks.push(track.currentChunk);
      __privateGet(this, _finalizedChunks).push(track.currentChunk);
      track.currentChunk = null;
    }
    if (flushStreamingWriter) {
      __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
    }
  };
  _maybeFlushStreamingTargetWriter = new WeakSet();
  maybeFlushStreamingTargetWriter_fn = function() {
    if (__privateGet(this, _writer) instanceof StreamTargetWriter) {
      __privateGet(this, _writer).flush();
    }
  };
  _ensureNotFinalized = new WeakSet();
  ensureNotFinalized_fn = function() {
    if (__privateGet(this, _finalized)) {
      throw new Error("Cannot add new video or audio chunks after the file has been finalized.");
    }
  };
  return __toCommonJS(src_exports);
})();
if (typeof module === "object" && typeof module.exports === "object") Object.assign(module.exports, Mp4Muxer)

      return module.exports
    })()

    // ---------------------------------------------------------------- constants
    const PREFIX = '/plugins/vyra-screen-recorder'
    const ZH = (navigator.language || 'zh').toLowerCase().startsWith('zh')
    const L = (zh, en) => (ZH ? zh : en)
    const S = {
      record: L('录屏', 'Record screen'),
      stop: L('停止录屏', 'Stop recording'),
      screenshot: L('截图', 'Screenshot'),
      pickerTitle: L('选择要录制的内容', 'Choose what to record'),
      desktop: L('整个桌面', 'Entire desktop'),
      monitors: L('显示器', 'Displays'),
      windows: L('窗口', 'Windows'),
      custom: L('自定义区域…', 'Custom region…'),
      customHint: L('拖框选择要录制的区域', 'Drag to choose a region'),
      primary: L('主屏', 'Primary'),
      systemAudio: L('系统声音', 'System audio'),
      microphone: L('麦克风', 'Microphone'),
      hint: L('8 fps · 最长 10 分钟 · 窗口录制会录到遮挡物', '8 fps · up to 10 minutes · window capture includes occluders'),
      close: L('关闭', 'Close'),
      preparing: L('正在准备录制…', 'Preparing recording…'),
      recording: L('录制中', 'Recording'),
      encoding: L('正在编码…', 'Encoding…'),
      openingFolder: L('打开文件夹', 'Open folder'),
      shotHint: L('拖框选择截图区域，单击选整屏；Esc 取消', 'Drag to select; click for full screen; Esc cancels'),
      regionHint: L('拖框选择要录制的区域；Esc 取消', 'Drag to choose the recording region; Esc cancels'),
      useShot: L('用这张', 'Use this'),
      recordRegion: L('录制这块区域', 'Record this region'),
      cancel: L('取消', 'Cancel'),
      reselect: L('重选区域', 'Reselect'),
      undo: L('撤销', 'Undo'),
      clear: L('清空', 'Clear'),
      pen: L('画笔', 'Pen'),
      rect: L('矩形', 'Rectangle'),
      arrow: L('箭头', 'Arrow'),
      text: L('文字', 'Text'),
      noFrames: L('没有录到画面', 'No frames were captured'),
      noRoute: L('宿主路由不可用，请完整重启 DSH 后再试', 'Host routes unavailable; fully restart DSH'),
      // 工具条悬停提示：一行主标题 + 一行可选的快捷键组合（VS Code 风格）。
      recordTip: L('录制屏幕', 'Record screen'),
      stopTip: L('停止录制', 'Stop recording'),
      shotTip: L('截图', 'Screenshot'),
      // 截图浮层：取字与复制。
      extractText: L('提取文字', 'Extract text'),
      extracting: L('正在识别文字…', 'Recognizing text…'),
      extractingProgress: L('正在识别文字', 'Recognizing text'),
      copyText: L('复制文字', 'Copy text'),
      copied: L('已复制', 'Copied'),
      noText: L('没有识别到文字', 'No text found'),
      textPanelTitle: L('文字', 'Text'),
      copyImage: L('复制图片', 'Copy image'),
      copyImageDone: L('图片已复制', 'Image copied'),
      copyFile: L('复制文件', 'Copy file'),
      copyFileDone: L('文件已复制', 'File copied'),
      pasteHint: L('粘贴到聊天窗口或资源管理器', 'Paste into a chat or Explorer'),
      textFailed: L('识别文字失败：', 'Text extraction failed: '),
      copyFailed: L('复制失败：', 'Copy failed: '),
      ocrUnavailable: L('系统 OCR 不可用，请在设置里检查识别语言包', 'System OCR unavailable; check the OCR language pack'),
      ocrCharacters: (count) => L('识别出 ' + count + ' 个字符', count + ' characters'),
      hideTextPanel: L('收起文字面板', 'Hide text panel'),
      showTextPanel: L('展开文字面板（可以选中复制）', 'Show text panel'),
    }

    const DEFAULT_SETTINGS = {
      dir: '',
      videoDir: '',
      shotDir: '',
      format: 'mp4',
      fps: 8,
      quality: 65,
      maxEdge: 1920,
      maxSeconds: 600,
      includeSystemAudio: true,
      includeMic: true,
      hideDshOnShot: false,
      shortcuts: {
        screenshot: 'Ctrl+Alt+S',
        record: 'Ctrl+Alt+R',
        copyImage: 'Ctrl',
        clipboard: 'Ctrl+Shift+C',
        text: 'Ctrl+Alt+C',
        save: 'Ctrl+S',
      },
      ocr: { engine: 'auto', lang: 'system', scale: 2 },
    }

    // ------------------------------------------------------------------- store
    let state = {
      phase: 'idle', // idle | picking | starting | recording | encoding
      picker: null,
      shot: null,
      recording: null,
      progress: null,
      toast: null,
      agentRecording: null,
      settings: DEFAULT_SETTINGS,
      paths: null,
    }
    const listeners = new Set()
    function getState() { return state }
    function setState(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
      for (const listener of [...listeners]) { try { listener() } catch { /* ignore */ } }
    }
    function subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    }
    function useStore() {
      const [snapshot, setSnapshot] = useState(getState())
      useEffect(() => subscribe(() => setSnapshot(getState())), [])
      return snapshot
    }
    function useNow(active) {
      const [now, setNow] = useState(Date.now())
      useEffect(() => {
        if (!active) return undefined
        setNow(Date.now())
        const timer = setInterval(() => setNow(Date.now()), 500)
        return () => clearInterval(timer)
      }, [active])
      return now
    }

    let toastTimer = null
    function toast(text, options) {
      const value = options || {}
      setState({ toast: { text, kind: value.kind || 'info', path: value.path || '', dir: value.dir || '', id: Date.now() } })
      if (toastTimer !== null) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => setState({ toast: null }), value.kind === 'error' ? 9000 : 5000)
    }

    function friendly(error) {
      const message = String((error && error.message) || error || '')
      if (/Failed to fetch|NetworkError|fetch failed|Load failed/i.test(message)) return S.noRoute
      return message || S.noRoute
    }

    async function apiJson(suffix, options) {
      let response
      try {
        response = await fetch(PREFIX + suffix, { cache: 'no-store', ...(options || {}) })
      } catch (error) {
        throw new Error(S.noRoute)
      }
      const text = await response.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* non-JSON error */ }
      if (!response.ok || data.ok === false) throw new Error(data.error || text.slice(0, 200) || ('HTTP ' + response.status))
      return data
    }

    async function uploadBlob(blob, name, kind) {
      const response = await fetch(PREFIX + '/record/save?kind=' + (kind === 'image' ? 'image' : 'video') + '&name=' + encodeURIComponent(name), {
        method: 'POST',
        body: blob,
      })
      const text = await response.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
      return data
    }

    async function loadClientSettings() {
      try {
        const data = await apiJson('/settings')
        setState({ settings: data.settings || DEFAULT_SETTINGS, paths: data.paths || null })
      } catch { /* 保留默认值 */ }
    }

    // ------------------------------------------------------- OCR 与剪贴板
    // 截图浮层的「提取文字」把选中的那块图发给宿主，宿主用 dsh-tool-ocr 配的
    // 引擎（没有配置时用系统自带的 Windows OCR）识别，返回文字和每行位置。
    async function ocrRegion(blob) {
      const response = await fetch(PREFIX + '/ocr', { method: 'POST', body: blob })
      const text = await response.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
      return data
    }

    /**
     * 把图片/文字/文件列表放进系统剪贴板。
     *
     * @param {'image'|'text'|'files'} kind - 剪贴板内容类型。
     * @param {{blob?: Blob, name?: string, text?: string, path?: string}} value - 内容或已保存文件路径。
     */
    async function putClipboard(kind, value) {
      const query = '?kind=' + kind
        + (value && value.name ? '&name=' + encodeURIComponent(value.name) : '')
        + (value && value.path ? '&path=' + encodeURIComponent(value.path) : '')
      let body
      if (kind === 'text') body = new Blob([(value && value.text) || ''], { type: 'text/plain;charset=utf-8' })
      else if (value && value.blob) body = value.blob
      const response = await fetch(PREFIX + '/clipboard' + query, { method: 'POST', body })
      const text = await response.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
      return data
    }

    /** 用系统默认程序打开已保存的图片。 */
    async function openFile(pathValue) {
      const response = await fetch(PREFIX + '/open?path=' + encodeURIComponent(pathValue), { cache: 'no-store' })
      const text = await response.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
      return data
    }

    /** 把剪贴板成功的结果写进提示条；失败时说明卡在哪。 */
    function copiedToast(kind) {
      const label = kind === 'text' ? S.copyText : kind === 'files' ? S.copyFile : S.copyImage
      toast(label + L('：', ': ') + L('已放进剪贴板', 'copied to the clipboard') + ' · ' + S.pasteHint, { kind: 'success' })
    }

    // ------------------------------------------------------------- formatting
    function pad(value) { return String(value).padStart(2, '0') }
    function formatDuration(seconds) {
      const safe = Math.max(0, Math.floor(seconds))
      return pad(Math.floor(safe / 60)) + ':' + pad(safe % 60)
    }
    function stamp() {
      const now = new Date()
      return String(now.getFullYear()) + pad(now.getMonth() + 1) + pad(now.getDate())
        + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds())
    }
    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error(L('图片加载失败', 'Image failed to load')))
        image.src = url
      })
    }
    function sourceKey(choice) {
      if (!choice) return ''
      if (choice.type === 'window') return 'window:' + choice.hwnd
      if (choice.type === 'region') return 'region'
      if (choice.type === 'monitor') return 'monitor:' + (choice.name || (choice.x + ',' + choice.y))
      return 'desktop'
    }

    // ------------------------------------------------------------- shortcuts
    // 快手显示：把宿主解析好的组合渲染成 "Ctrl+Alt+S"，提示里用它。
    // 只做展示，匹配仍由 matchesShortcut 按事件本身判断。
    function shortcutParts(combo) {
      const text = typeof combo === 'string' ? combo.trim() : ''
      if (!text) return []
      const parts = text.split(/[+\s]+/).filter(Boolean)
      const tokens = parts.length > 1 ? parts : (text.match(/ctrl|alt|shift|meta|[^+]?[A-Za-z0-9]/gi) || [])
      const names = { ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Meta', cmd: 'Meta' }
      const out = []
      let key = ''
      for (const token of tokens) {
        const mapped = names[token.toLowerCase()]
        if (mapped) { if (!out.includes(mapped)) out.push(mapped); continue }
        key = token
      }
      if (key) out.push(key === ' ' || key.toLowerCase() === 'space' ? 'Space' : key.toUpperCase())
      return out
    }

    /** 提示条上的按键帽：一个键一个方框，而不是 "Ctrl+Alt+S" 一串文字。 */
    function ShortcutKeys(props) {
      const parts = shortcutParts(props.combo)
      if (parts.length === 0) return null
      return h('span', { className: 'vsr-tip-keys' },
        ...parts.map((part, index) => h('kbd', { key: index, className: 'vsr-kbd' }, part)))
    }

    /**
     * 鼠标悬停提示：主标题一行，可选快捷键一行。
     * 用自绘的提示而不是原生 title——原生提示的延迟、字体、按键帽都没法控制，
     * 也不好看；这里和 VS Code 的悬停一致：上方居中、深色、带按键帽。
     */
    function Tip(props) {
      if (!props.label) return null
      return h('span', { className: 'vsr-tip' + (props.align === 'end' ? ' vsr-tip-end' : ''), role: 'tooltip', 'aria-hidden': 'true' },
        h('span', { className: 'vsr-tip-body' },
          h('span', { className: 'vsr-tip-label' }, props.label),
          props.shortcut ? h(ShortcutKeys, { combo: props.shortcut }) : null,
          props.hint ? h('span', { className: 'vsr-tip-hint' }, props.hint) : null))
    }

    // ------------------------------------------------------------- recording
    let timerHandle = null
    let pollHandle = null
    let finishing = false
    let agentRun = null
    let agentPollTimer = null
    // 截图/选源都必须先抓屏、后出界面：抓屏期间屏幕上不能出现任何本插件 UI，
    // 否则 GDI 会把加载提示、弹窗一起拍进图里，也拖慢到不像原生截图。
    let captureBusy = false

    function stopTimers() {
      if (timerHandle !== null) { clearInterval(timerHandle); timerHandle = null }
      if (pollHandle !== null) { clearInterval(pollHandle); pollHandle = null }
    }

    function startPolling() {
      if (pollHandle !== null) clearInterval(pollHandle)
      pollHandle = setInterval(async () => {
        try {
          const status = await apiJson('/record/status')
          if (state.phase === 'recording' && status.recording === false && !finishing) {
            finishing = true
            stopRecording().finally(() => { finishing = false })
          }
        } catch { /* 宿主临时不可达时继续等下一轮 */ }
      }, 2000)
    }

    /** 抓一张屏幕底图；抓之前先藏起本插件的浮层，抓完再恢复。 */
    async function fetchShot(query) {
      document.documentElement.classList.add('vsr-capturing')
      try {
        // 等两帧，确保 visibility:hidden 已经真正画到屏幕上；窗口被挂起时用超时兜底。
        await new Promise(resolve => {
          let done = false
          const finish = () => { if (!done) { done = true; resolve() } }
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => requestAnimationFrame(finish))
          }
          setTimeout(finish, 80)
        })
        let response
        try { response = await fetch(PREFIX + '/shot' + (query || ''), { cache: 'no-store' }) } catch { throw new Error(S.noRoute) }
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return {
          blob: await response.blob(),
          hidden: response.headers.get('x-vsr-hidden') === '1',
        }
      } finally {
        document.documentElement.classList.remove('vsr-capturing')
      }
    }

    async function openPicker() {
      if (state.phase !== 'idle' || captureBusy) return
      captureBusy = true
      setState({ toast: null })
      try {
        const [sources, shot] = await Promise.all([
          apiJson('/sources'),
          fetchShot('?ts=' + Date.now()),
        ])
        const url = URL.createObjectURL(shot.blob)
        const image = await loadImage(url)
        setState({
          phase: 'picking',
          picker: {
            loading: false,
            error: '',
            sources,
            shotUrl: url,
            shotW: image.naturalWidth,
            shotH: image.naturalHeight,
          },
        })
      } catch (error) {
        toast(L('无法打开录制源：', 'Cannot open recording sources: ') + friendly(error), { kind: 'error' })
      } finally {
        captureBusy = false
      }
    }

    function closePicker() {
      const picker = state.picker
      if (picker && picker.shotUrl) URL.revokeObjectURL(picker.shotUrl)
      setState({ phase: 'idle', picker: null })
    }

    function closeShot() {
      const shot = state.shot
      if (shot && shot.url) URL.revokeObjectURL(shot.url)
      setState({ shot: null })
    }

    async function startMic() {
      const startedAt = Date.now()
      try {
        const media = navigator.mediaDevices
        if (!media || typeof media.getUserMedia !== 'function') throw new Error('no mediaDevices')
        const stream = await media.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })
        const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : ''
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        const chunks = []
        recorder.ondataavailable = event => { if (event.data && event.data.size > 0) chunks.push(event.data) }
        recorder.start(1000)
        return { stream, recorder, chunks, startedAt }
      } catch {
        return null
      }
    }

    function stopMic(mic) {
      if (mic === null || mic === undefined) return Promise.resolve(null)
      return new Promise(resolve => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          try { mic.stream.getTracks().forEach(track => track.stop()) } catch { /* ignore */ }
          resolve(mic.chunks.length ? new Blob(mic.chunks, { type: mic.recorder.mimeType || 'audio/webm' }) : null)
        }
        try {
          if (mic.recorder.state === 'inactive') { finish(); return }
          mic.recorder.onstop = finish
          mic.recorder.stop()
          setTimeout(finish, 2000)
        } catch { finish() }
      })
    }

    async function startRecording(choice, options) {
      const value = options || {}
      const settings = state.settings || DEFAULT_SETTINGS
      closePicker()
      if (state.shot) closeShot()
      setState({ phase: 'starting', progress: { stage: S.preparing, ratio: 0 }, recording: null })
      let mic = null
      if (value.includeMic !== false) mic = await startMic()
      try {
        const result = await apiJson('/record/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            source: choice,
            fps: settings.fps,
            quality: settings.quality,
            maxEdge: settings.maxEdge,
            maxSeconds: settings.maxSeconds,
            includeSystemAudio: value.includeSystemAudio !== undefined ? value.includeSystemAudio : settings.includeSystemAudio,
          }),
        })
        if (mic === null && value.includeMic !== false) {
          toast(L('麦克风不可用，本次只录系统声音', 'Microphone unavailable; recording system audio only'), { kind: 'error' })
        }
        if (value.includeSystemAudio !== false && result.hasAudio === false) {
          toast(L('系统声音不可用，已录制无声视频', 'System audio unavailable; recording without sound'), { kind: 'error' })
        }
        try { localStorage.setItem('vsr.lastSource', JSON.stringify(choice)) } catch { /* ignore */ }
        setState({
          phase: 'recording',
          progress: null,
          recording: {
            sessionId: result.sessionId,
            startedAt: result.startedAt || Date.now(),
            hasAudio: result.hasAudio,
            mic,
          },
        })
        startPolling()
      } catch (error) {
        await stopMic(mic)
        setState({ phase: 'idle', progress: null, recording: null })
        toast(L('开始录制失败：', 'Failed to start recording: ') + friendly(error), { kind: 'error' })
      }
    }

    async function stopRecording() {
      if (state.phase !== 'recording') return
      const recording = state.recording
      stopTimers()
      setState({ phase: 'encoding', progress: { stage: L('正在生成视频…', 'Encoding video…'), ratio: 0.02 } })
      const micBlob = await stopMic(recording ? recording.mic : null)
      let manifest = null
      try {
        manifest = await apiJson('/record/stop', { method: 'POST' })
        const format = (state.settings && state.settings.format) || 'mp4'
        const encoded = await encodeRecording(manifest, micBlob, recording, format)
        if (encoded.fallback) toast(L('当前环境不支持 H.264/AAC，已保存为 WebM', 'H.264/AAC unavailable; saved as WebM'), { kind: 'error' })
        const name = encoded.name
        const file = new File([encoded.blob], name, { type: 'video/webm' })
        const attached = attachFile(file)
        setState({ progress: { stage: L('正在保存…', 'Saving…'), ratio: 0.97 } })
        let saved = null
        try {
          saved = await uploadBlob(encoded.blob, name, 'video')
        } catch (error) {
          downloadBlob(encoded.blob, name)
          toast(L('保存到磁盘失败，已改为浏览器下载：', 'Save failed; downloaded instead: ') + friendly(error), { kind: 'error' })
        }
        if (saved) {
          toast(
            attached
              ? L('录屏已完成，已挂进输入框', 'Recording ready and attached')
              : L('录屏已保存，但没能自动挂进输入框', 'Recording saved, but not attached'),
            { kind: attached ? 'success' : 'error', path: saved.file, dir: saved.dir },
          )
        }
        await fetch(PREFIX + '/record/discard', { method: 'POST' }).catch(() => {})
      } catch (error) {
        toast(L('录屏失败：', 'Recording failed: ') + friendly(error), { kind: 'error' })
        await fetch(PREFIX + '/record/discard', { method: 'POST' }).catch(() => {})
      } finally {
        setState({ phase: 'idle', recording: null, progress: null })
      }
    }

    async function pollAgent() {
      let status
      try { status = await apiJson('/agent/status') } catch { return }
      const job = status.job
      if (!job) {
        if (agentRun && !agentRun.encoding) {
          await stopMic(agentRun.mic)
          agentRun = null
          setState({ agentRecording: null })
        }
        return
      }
      if (job.status === 'recording') {
        if (agentRun === null || agentRun.id !== job.id) {
          if (agentRun) await stopMic(agentRun.mic)
          agentRun = { id: job.id, mic: null, micStartedAt: Date.now(), encoding: false, startingMic: true }
          setState({ agentRecording: { id: job.id, startedAt: job.startedAt || Date.now() } })
          const mic = job.includeMic === false ? null : await startMic()
          if (agentRun !== null && agentRun.id === job.id) {
            agentRun.mic = mic
            agentRun.micStartedAt = mic ? mic.startedAt : Date.now()
            agentRun.startingMic = false
          } else {
            await stopMic(mic)
          }
        }
        return
      }
      if (job.status === 'encoding') {
        if (agentRun === null || agentRun.id !== job.id) {
          agentRun = { id: job.id, mic: null, micStartedAt: Date.now(), encoding: false }
        }
        if (agentRun.encoding) return
        agentRun.encoding = true
        setState({ agentRecording: null, phase: 'encoding', progress: { stage: L('Agent 录屏编码中…', 'Encoding agent recording…'), ratio: 0.05 } })
        const micBlob = await stopMic(agentRun.mic)
        try {
          const encoded = await encodeRecording(job.manifest, micBlob, { mic: { startedAt: agentRun.micStartedAt } }, job.format || 'mp4')
          const response = await fetch(PREFIX + '/agent/save?id=' + encodeURIComponent(job.id) + '&format=' + encodeURIComponent(encoded.format), { method: 'POST', body: encoded.blob })
          const text = await response.text()
          let data = {}
          try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
          if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
          toast(L('Agent 录屏已保存：', 'Agent recording saved: ') + data.file, { kind: 'success', path: data.file, dir: data.dir })
        } catch (error) {
          await fetch(PREFIX + '/agent/error?id=' + encodeURIComponent(job.id), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ error: String((error && error.message) || error) }),
          }).catch(() => {})
          toast(L('Agent 录屏失败：', 'Agent recording failed: ') + friendly(error), { kind: 'error' })
        } finally {
          agentRun = null
          setState({ phase: 'idle', progress: null, agentRecording: null })
        }
      }
    }

    function startAgentWatch() {
      if (agentPollTimer !== null) return
      agentPollTimer = setInterval(() => { void pollAgent() }, 2000)
      void pollAgent()
    }

    function stopAgentWatch() {
      if (agentPollTimer !== null) {
        clearInterval(agentPollTimer)
        agentPollTimer = null
      }
      if (agentRun !== null) {
        void stopMic(agentRun.mic)
        agentRun = null
      }
    }

    async function takeScreenshot() {
      if (state.phase !== 'idle' || captureBusy) return
      const settings = state.settings || DEFAULT_SETTINGS
      const hideDsh = settings.hideDshOnShot === true
      captureBusy = true
      // 截图期间不渲染任何浮层/进度卡：抓到的必须是按快捷键那一刻的屏幕。
      setState({ toast: null })
      try {
        const shot = await fetchShot('?ts=' + Date.now() + (hideDsh ? '&hideDsh=1' : ''))
        const url = URL.createObjectURL(shot.blob)
        const image = await loadImage(url)
        setState({
          shot: {
            mode: 'shot', url, imageW: image.naturalWidth, imageH: image.naturalHeight,
            virtual: null, options: null, hiddenDsh: shot.hidden,
          },
        })
        if (hideDsh && !shot.hidden) {
          toast(L('没有找到可隐藏的 DSH 窗口，这张图里仍有 DSH 界面', 'No DSH window to hide; the screenshot still contains it'), { kind: 'error' })
        }
      } catch (error) {
        toast(L('截图失败：', 'Screenshot failed: ') + friendly(error), { kind: 'error' })
      } finally {
        captureBusy = false
      }
    }

    function openRegionShot(picker, options) {
      if (!picker || !picker.shotUrl) return
      setState({
        phase: 'idle',
        picker: null,
        toast: null,
        shot: {
          mode: 'region',
          url: picker.shotUrl,
          imageW: picker.shotW,
          imageH: picker.shotH,
          virtual: picker.sources.virtual,
          options,
        },
      })
    }

    // -------------------------------------------------------------- encoding
    function pickVideoCodec(width, height, fps, format) {
      const bitrate = Math.min(8000000, Math.max(1500000, Math.round(width * height * fps * 0.1)))
      return (async () => {
        if (typeof VideoEncoder === 'undefined') throw new Error(L('当前环境不支持 WebCodecs', 'WebCodecs unavailable'))
        if (format === 'mp4') {
          try {
            const pixels = width * height
            const level = pixels > 1920 * 1080 ? '32' : pixels > 1280 * 720 ? '28' : '1f'
            const config = { codec: 'avc1.4200' + level, width, height, bitrate, framerate: fps, avc: { format: 'avc' } }
            const support = await VideoEncoder.isConfigSupported(config)
            if (support && support.supported) {
              return {
                container: 'mp4',
                muxerCodec: 'avc',
                config: { ...config, ...(support.config || {}), avc: { format: 'avc' } },
                bitrate,
                extension: 'mp4',
              }
            }
          } catch { /* fall through to WebM */ }
        }
        const candidates = [
          { container: 'webm', muxerCodec: 'V_VP9', codec: 'vp09.00.10.08' },
          { container: 'webm', muxerCodec: 'V_VP8', codec: 'vp8' },
        ]
        for (const candidate of candidates) {
          try {
            const support = await VideoEncoder.isConfigSupported({
              codec: candidate.codec, width, height, bitrate, framerate: fps,
            })
            if (support && support.supported) {
              return {
                container: 'webm',
                muxerCodec: candidate.muxerCodec,
                config: support.config || { codec: candidate.codec, width, height, bitrate, framerate: fps },
                bitrate,
                extension: 'webm',
              }
            }
          } catch { /* try next */ }
        }
        throw new Error(L('没有可用的视频编码器', 'No video encoder available'))
      })()
    }

    async function pickAudioCodec(container) {
      if (typeof AudioEncoder === 'undefined') return null
      const codec = container === 'mp4' ? 'mp4a.40.2' : 'opus'
      try {
        const support = await AudioEncoder.isConfigSupported({
          codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 128000,
        })
        if (support && support.supported) {
          return {
            muxerCodec: container === 'mp4' ? 'aac' : 'opus',
            config: { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 },
          }
        }
      } catch { /* no audio */ }
      return null
    }

    async function mixAudio(manifest, micBlob, recording) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return null
      const durationMs = Math.max(200, manifest.durationMs || 0)
      let systemBuffer = null
      let micBuffer = null
      const context = new AudioContextClass()
      try {
        if (manifest.audio) {
          try {
            const response = await fetch(PREFIX + '/record/audio?session=' + encodeURIComponent(manifest.sessionId), { cache: 'no-store' })
            if (response.ok) {
              const data = await response.arrayBuffer()
              if (data.byteLength > 44) systemBuffer = await context.decodeAudioData(data)
            }
          } catch { /* 没有系统声音 */ }
        }
        if (micBlob) {
          try {
            const data = await micBlob.arrayBuffer()
            if (data.byteLength > 0) micBuffer = await context.decodeAudioData(data)
          } catch { /* 麦克风解码失败时只保留系统声音 */ }
        }
      } finally {
        try { await context.close() } catch { /* ignore */ }
      }
      if (systemBuffer === null && micBuffer === null) return null
      const sampleRate = 48000
      const frames = Math.max(1, Math.ceil((durationMs / 1000) * sampleRate))
      const offline = new OfflineAudioContext(2, frames, sampleRate)
      const addSource = (buffer, offsetMs) => {
        const source = offline.createBufferSource()
        source.buffer = buffer
        source.connect(offline.destination)
        const skip = Math.max(0, -offsetMs / 1000)
        const when = Math.max(0, offsetMs / 1000)
        source.start(when, skip)
      }
      if (systemBuffer) addSource(systemBuffer, manifest.audioOffsetMs || 0)
      if (micBuffer) addSource(micBuffer, (recording && recording.mic ? recording.mic.startedAt : manifest.startedAt) - manifest.startedAt)
      try { return await offline.startRendering() } catch { return null }
    }

    async function encodeRecording(manifest, micBlob, recording, format) {
      const frames = manifest.frames || []
      if (frames.length === 0) throw new Error(S.noFrames)
      const width = manifest.width || 1280
      const height = manifest.height || 720
      const fps = manifest.fps || 8
      const requested = format === 'webm' ? 'webm' : 'mp4'
      setState({ progress: { stage: L('正在混音…', 'Mixing audio…'), ratio: 0.05 } })
      const mixed = await mixAudio(manifest, micBlob, recording)
      let videoCodec = await pickVideoCodec(width, height, fps, requested)
      let audioCodec = mixed ? await pickAudioCodec(videoCodec.container) : null
      let fallback = ''
      if (requested === 'mp4' && videoCodec.container !== 'mp4') fallback = 'no-h264'
      if (mixed && audioCodec === null && videoCodec.container === 'mp4') {
        videoCodec = await pickVideoCodec(width, height, fps, 'webm')
        audioCodec = await pickAudioCodec('webm')
        fallback = 'no-aac'
      }
      const target = videoCodec.container === 'mp4'
        ? new Mp4Muxer.ArrayBufferTarget()
        : new WebMMuxer.ArrayBufferTarget()
      const muxer = videoCodec.container === 'mp4'
        ? new Mp4Muxer.Muxer({
          target,
          video: { codec: 'avc', width, height },
          ...(mixed && audioCodec ? { audio: { codec: 'aac', sampleRate: 48000, numberOfChannels: 2 } } : {}),
          fastStart: 'in-memory',
          firstTimestampBehavior: 'offset',
        })
        : new WebMMuxer.Muxer({
          target,
          video: { codec: videoCodec.muxerCodec, width, height, frameRate: fps },
          ...(mixed && audioCodec ? { audio: { codec: 'A_OPUS', sampleRate: 48000, numberOfChannels: 2 } } : {}),
          firstTimestampBehavior: 'offset',
        })

      let videoError = null
      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta) } catch (error) { videoError = error } },
        error: error => { videoError = error },
      })
      videoEncoder.configure({
        ...videoCodec.config,
        width,
        height,
        bitrate: videoCodec.bitrate,
        framerate: fps,
        latencyMode: 'quality',
      })

      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d', { alpha: false })
      const keyEvery = Math.max(1, Math.round(fps * 2))
      try {
        for (let index = 0; index < frames.length; index++) {
          if (videoError) throw videoError
          const row = frames[index]
          const url = PREFIX + '/record/frame?session=' + encodeURIComponent(manifest.sessionId) + '&file=' + encodeURIComponent(row.file)
          let response
          try { response = await fetch(url, { cache: 'no-store' }) } catch { throw new Error(S.noRoute) }
          if (!response.ok) throw new Error(L('读取第 ', 'Failed to read frame ') + (index + 1) + L(' 帧失败', ''))
          const bitmap = await createImageBitmap(await response.blob())
          ctx.drawImage(bitmap, 0, 0, width, height)
          bitmap.close()
          const timestamp = Math.max(0, Math.round(row.t * 1000))
          const next = index + 1 < frames.length ? frames[index + 1].t : manifest.durationMs
          const duration = Math.max(1000, Math.round((next - row.t) * 1000))
          const frame = new VideoFrame(canvas, { timestamp, duration })
          videoEncoder.encode(frame, { keyFrame: index % keyEvery === 0 })
          frame.close()
          if (videoEncoder.encodeQueueSize > 8) await new Promise(resolve => setTimeout(resolve, 10))
          if (index % 5 === 0) {
            setState({ progress: { stage: L('正在编码画面…', 'Encoding video…'), ratio: 0.1 + (index / frames.length) * 0.72 } })
          }
        }
        await videoEncoder.flush()
      } finally {
        try { videoEncoder.close() } catch { /* ignore */ }
      }
      if (videoError) throw videoError

      if (mixed && audioCodec) {
        setState({ progress: { stage: L('正在编码声音…', 'Encoding audio…'), ratio: 0.84 } })
        let audioError = null
        const audioEncoder = new AudioEncoder({
          output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta) } catch (error) { audioError = error } },
          error: error => { audioError = error },
        })
        audioEncoder.configure(audioCodec.config)
        try {
          const left = mixed.getChannelData(0)
          const right = mixed.numberOfChannels > 1 ? mixed.getChannelData(1) : left
          const chunkFrames = 960
          for (let offset = 0; offset < mixed.length; offset += chunkFrames) {
            if (audioError) throw audioError
            const count = Math.min(chunkFrames, mixed.length - offset)
            const data = new Float32Array(count * 2)
            data.set(left.subarray(offset, offset + count), 0)
            data.set(right.subarray(offset, offset + count), count)
            const audioData = new AudioData({
              format: 'f32-planar',
              sampleRate: 48000,
              numberOfFrames: count,
              numberOfChannels: 2,
              timestamp: Math.round((offset / 48000) * 1000000),
              data,
            })
            audioEncoder.encode(audioData)
            audioData.close()
            if (audioEncoder.encodeQueueSize > 16) await new Promise(resolve => setTimeout(resolve, 5))
          }
          await audioEncoder.flush()
        } finally {
          try { audioEncoder.close() } catch { /* ignore */ }
        }
        if (audioError) throw audioError
      }

      setState({ progress: { stage: L('正在封装…', 'Muxing…'), ratio: 0.95 } })
      muxer.finalize()
      const extension = videoCodec.container === 'mp4' ? 'mp4' : 'webm'
      return {
        blob: new Blob([target.buffer], { type: extension === 'mp4' ? 'video/mp4' : 'video/webm' }),
        name: '录屏-' + stamp() + '.' + extension,
        format: extension,
        fallback,
      }
    }

    // -------------------------------------------------------------- attach
    function findComposerFileInput() {
      const areas = Array.prototype.slice.call(document.querySelectorAll('textarea, [contenteditable="true"]'))
        .filter(element => {
          const rect = element.getBoundingClientRect()
          return rect.width > 80 && rect.height > 12
        })
        .sort((a, b) => {
          const ra = a.getBoundingClientRect()
          const rb = b.getBoundingClientRect()
          return rb.width * rb.height - ra.width * ra.height
        })
      const roots = []
      let box = areas[0] || null
      for (let depth = 0; depth < 10 && box; depth++) {
        roots.push(box)
        box = box.parentElement
      }
      roots.push(document)
      for (const root of roots) {
        const inputs = Array.prototype.slice.call(root.querySelectorAll('input[type="file"]'))
          .filter(input => !input.disabled)
        if (inputs.length > 0) return inputs[inputs.length - 1]
      }
      return null
    }

    function attachFile(file) {
      const input = findComposerFileInput()
      if (input === null) return false
      try {
        const transfer = new DataTransfer()
        transfer.items.add(file)
        input.files = transfer.files
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      } catch {
        return false
      }
    }

    function downloadBlob(blob, name) {
      try {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = name
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10000)
      } catch { /* ignore */ }
    }

    async function reveal(pathValue) {
      try {
        await fetch(PREFIX + '/reveal?path=' + encodeURIComponent(pathValue), { cache: 'no-store' })
      } catch { /* ignore */ }
    }

    async function saveScreenshot(blob, name) {
      const file = new File([blob], name, { type: 'image/jpeg' })
      const attached = attachFile(file)
      let saved = null
      try { saved = await uploadBlob(blob, name, 'image') } catch { /* 保存失败时仍以附件为准 */ }
      toast(
        attached
          ? L('截图已挂进输入框', 'Screenshot attached')
          : (saved ? L('截图已保存', 'Screenshot saved') : L('截图没能保存', 'Screenshot not saved')),
        { kind: attached || saved ? 'success' : 'error', path: saved ? saved.file : '', dir: saved ? saved.dir : '' },
      )
    }

    // ------------------------------------------------------------- settings
    function formatBytes(bytes) {
      if (!Number.isFinite(bytes)) return ''
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
      return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
    }

    function formatDate(ms) {
      try { return new Date(ms).toLocaleString() } catch { return '' }
    }

    function keyName(event) {
      const key = event.key
      if (key === ' ' || key === 'Spacebar') return 'Space'
      if (key.length === 1) return key.toUpperCase()
      return key
    }

    function comboFromEvent(event) {
      const parts = []
      if (event.ctrlKey) parts.push('Ctrl')
      if (event.altKey) parts.push('Alt')
      if (event.shiftKey) parts.push('Shift')
      if (event.metaKey) parts.push('Meta')
      const key = keyName(event)
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) parts.push(key)
      return parts.join('+')
    }

    function matchesShortcut(event, combo) {
      if (!combo) return false
      return comboFromEvent(event) === combo
    }

    function ShortcutInput(props) {
      const [capturing, setCapturing] = useState(false)
      return h('input', {
        className: 'vsr-input vsr-shortcut-input',
        value: capturing ? L('按下快捷键…', 'Press a shortcut…') : props.value,
        readOnly: true,
        onFocus: () => setCapturing(true),
        onBlur: () => setCapturing(false),
        onKeyDown: event => {
          event.preventDefault()
          event.stopPropagation()
          if (event.key === 'Escape') { setCapturing(false); event.currentTarget.blur(); return }
          const key = keyName(event)
          if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return
          const combo = comboFromEvent(event)
          if (!combo) return
          props.onChange(combo)
          setCapturing(false)
          event.currentTarget.blur()
        },
      })
    }

    function SettingsIcon() {
      return h('svg', { viewBox: '0 0 16 16', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, 'aria-hidden': 'true' },
        h('rect', { x: 2, y: 3, width: 12, height: 8.5, rx: 1.5 }),
        h('circle', { cx: 8, cy: 7.25, r: 1.7, fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M6 14h4' }))
    }

    function SettingsPage() {
      const [draft, setDraft] = useState(DEFAULT_SETTINGS)
      const [paths, setPaths] = useState(null)
      const [library, setLibrary] = useState([])
      const [loading, setLoading] = useState(true)
      const [saving, setSaving] = useState(false)
      const [filter, setFilter] = useState('all')
      const [converting, setConverting] = useState(null)
      const [convertProgress, setConvertProgress] = useState(0)
      const [error, setError] = useState('')
      // OCR 引擎列表：来自 dsh-tool-ocr 的配置 + 系统自带 Windows OCR。
      const [ocrInfo, setOcrInfo] = useState({ engines: [], languages: [], winrt: false, active: '' })

      async function refreshOcr() {
        try {
          setOcrInfo(await apiJson('/ocr/status'))
        } catch { /* 宿主老版本没有这条路由时保持空列表 */ }
      }

      async function refreshLibrary() {
        const data = await apiJson('/library')
        setLibrary(data.files || [])
      }

      async function load() {
        setLoading(true)
        setError('')
        try {
          const data = await apiJson('/settings')
          const settings = data.settings || DEFAULT_SETTINGS
          setDraft({
            ...DEFAULT_SETTINGS,
            ...settings,
            shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(settings.shortcuts || {}) },
          })
          setPaths(data.paths || null)
          setState({ settings, paths: data.paths || null })
          await Promise.all([refreshLibrary(), refreshOcr()])
        } catch (failure) {
          setError(friendly(failure))
        } finally {
          setLoading(false)
        }
      }

      useEffect(() => { void load() }, [])

      async function save() {
        setSaving(true)
        try {
          const data = await apiJson('/settings', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(draft),
          })
          setDraft({ ...DEFAULT_SETTINGS, ...data.settings, shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(data.settings.shortcuts || {}) } })
          setPaths(data.paths || null)
          setState({ settings: data.settings, paths: data.paths || null })
          await Promise.all([refreshLibrary(), refreshOcr()])
          toast(L('设置已保存', 'Settings saved'), { kind: 'success' })
        } catch (failure) {
          toast(L('保存失败：', 'Save failed: ') + friendly(failure), { kind: 'error' })
        } finally {
          setSaving(false)
        }
      }

      async function pickDir(fieldName) {
        const picker = window.__DSH_DIRECTORY_PICKER__
        if (!picker || typeof picker.pick !== 'function') {
          toast(L('当前环境不支持文件夹选择，请手动输入路径', 'Folder picker unavailable; type the path'), { kind: 'error' })
          return
        }
        try {
          const dir = await picker.pick()
          if (dir) setDraft(current => ({ ...current, [fieldName]: dir }))
        } catch { /* 用户取消 */ }
      }

      function openPath(target) {
        if (target) void reveal(target)
        else toast(L('先保存设置，宿主才能确定目录', 'Save settings first'), { kind: 'error' })
      }

      /** 文件卡片的「打开文件夹」跟随当前筛选：全部 → 根目录，录屏/截图 → 各自目录。 */
      function openLibraryFolder() {
        const target = filter === 'video' ? paths && paths.recordings
          : filter === 'image' ? paths && paths.screenshots
            : paths && (paths.root || paths.recordings)
        openPath(target || null)
      }

      async function removeFile(file) {
        if (typeof window.confirm === 'function' && !window.confirm(L('删除这个文件？\n', 'Delete this file?\n') + file.name)) return
        try {
          await apiJson('/library/delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind: file.kind, name: file.name }),
          })
          await refreshLibrary()
          toast(L('已删除', 'Deleted'), { kind: 'success' })
        } catch (failure) {
          toast(L('删除失败：', 'Delete failed: ') + friendly(failure), { kind: 'error' })
        }
      }

      async function convert(file) {
        if (converting !== null) return
        const mime = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'
        if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(mime)) {
          toast(L('当前环境不支持 MP4 转换', 'MP4 conversion unavailable'), { kind: 'error' })
          return
        }
        setConverting(file.name)
        setConvertProgress(0)
        const video = document.createElement('video')
        video.src = PREFIX + '/record/serve?kind=video&name=' + encodeURIComponent(file.name)
        video.preload = 'auto'
        video.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none'
        document.body.appendChild(video)
        try {
          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve
            video.onerror = () => reject(new Error(L('加载视频失败', 'Failed to load video')))
          })
          const stream = typeof video.captureStream === 'function' ? video.captureStream() : null
          if (!stream) throw new Error(L('浏览器不支持 captureStream', 'captureStream unavailable'))
          const recorder = new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: Math.min(8000000, Math.max(2000000, Math.round((video.videoWidth || 1280) * (video.videoHeight || 720) * 4))),
          })
          const chunks = []
          recorder.ondataavailable = event => { if (event.data && event.data.size > 0) chunks.push(event.data) }
          const stopped = new Promise(resolve => { recorder.onstop = resolve })
          video.ontimeupdate = () => {
            if (video.duration) setConvertProgress(Math.min(1, video.currentTime / video.duration))
          }
          recorder.start(1000)
          await video.play()
          await new Promise(resolve => {
            video.onended = resolve
            setTimeout(resolve, Math.max(3000, ((video.duration || 0) + 2) * 1000))
          })
          recorder.stop()
          await stopped
          const blob = new Blob(chunks, { type: 'video/mp4' })
          const name = file.name.replace(/\.webm$/i, '') + '.mp4'
          await uploadBlob(blob, name, 'video')
          await refreshLibrary()
          toast(L('已转成 MP4：', 'Converted to MP4: ') + name, { kind: 'success' })
        } catch (failure) {
          toast(L('转换失败：', 'Conversion failed: ') + friendly(failure), { kind: 'error' })
        } finally {
          video.remove()
          setConverting(null)
          setConvertProgress(0)
        }
      }

      const field = (label, control, note) => h('label', { className: 'vsr-field' },
        h('span', { className: 'vsr-field-label' }, label),
        control,
        note ? h('span', { className: 'vsr-field-note' }, note) : null)

      if (loading) {
        return h('div', { className: 'vsr-settings' },
          h('div', { className: 'vsr-settings-head' }, h('h2', null, L('录屏与截图', 'Screen recorder'))),
          h('div', { className: 'vsr-muted' }, L('正在读取设置…', 'Loading settings…')))
      }

      const files = library.filter(file => filter === 'all' || file.kind === filter)
      return h('div', { className: 'vsr-settings' },
        h('div', { className: 'vsr-settings-head' },
          h('div', null,
            h('h2', null, L('录屏与截图', 'Screen recorder')),
            h('div', { className: 'vsr-muted' }, L('存储位置、录制格式、快捷键和文件都在这里管理。', 'Manage storage, format, shortcuts and files.'))),
          h('button', { type: 'button', className: 'vsr-settings-link', onClick: () => { void load() } }, L('刷新', 'Refresh'))),
        error ? h('div', { className: 'vsr-error' }, error) : null,
        h('section', { className: 'vsr-card' },
          h('h3', null, L('存储位置', 'Storage')),
          field(L('视频保存到', 'Save videos to'),
            h('div', { className: 'vsr-storage-row' },
              h('input', {
                className: 'vsr-input vsr-grow',
                value: draft.videoDir,
                placeholder: paths ? paths.recordings : L('默认：视频 / Vyra Screen Recorder / recordings', 'Default: Videos / Vyra Screen Recorder / recordings'),
                onChange: event => setDraft({ ...draft, videoDir: event.target.value }),
              }),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => { void pickDir('videoDir') } }, L('选择…', 'Choose…')),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => openPath(paths && paths.recordings) }, L('打开', 'Open')),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => setDraft({ ...draft, videoDir: '' }) }, L('默认', 'Default')))),
          field(L('截图保存到', 'Save screenshots to'),
            h('div', { className: 'vsr-storage-row' },
              h('input', {
                className: 'vsr-input vsr-grow',
                value: draft.shotDir,
                placeholder: paths ? paths.screenshots : L('默认：视频 / Vyra Screen Recorder / screenshots', 'Default: Videos / Vyra Screen Recorder / screenshots'),
                onChange: event => setDraft({ ...draft, shotDir: event.target.value }),
              }),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => { void pickDir('shotDir') } }, L('选择…', 'Choose…')),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => openPath(paths && paths.screenshots) }, L('打开', 'Open')),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => setDraft({ ...draft, shotDir: '' }) }, L('默认', 'Default')))),
          h('div', { className: 'vsr-muted vsr-path' }, L('留空使用默认位置；目录不存在时会自动创建。', 'Leave empty for the default; folders are created automatically.'))),
        h('section', { className: 'vsr-card' },
          h('h3', null, L('录制', 'Recording')),
          h('div', { className: 'vsr-grid' },
            field(L('保存格式', 'Save format'), h('select', {
              className: 'vsr-select',
              value: draft.format,
              onChange: event => setDraft({ ...draft, format: event.target.value }),
            },
            h('option', { value: 'mp4' }, L('MP4（H.264 / AAC）', 'MP4 (H.264 / AAC)')),
            h('option', { value: 'webm' }, 'WebM（VP9 / Opus）')), L('停止后自动存成 MP4；环境不支持时回退 WebM。', 'Saved as MP4 after recording; falls back to WebM if unsupported.')),
            field(L('帧率', 'Frame rate'), h('select', {
              className: 'vsr-select', value: String(draft.fps),
              onChange: event => setDraft({ ...draft, fps: Number(event.target.value) }),
            }, ...[5, 8, 10, 12].map(value => h('option', { key: value, value: String(value) }, value + ' fps')))),
            field(L('JPEG 质量', 'JPEG quality'), h('input', {
              className: 'vsr-input', type: 'number', min: 40, max: 90, value: draft.quality,
              onChange: event => setDraft({ ...draft, quality: Number(event.target.value) }),
            })),
            field(L('长边上限', 'Max edge'), h('select', {
              className: 'vsr-select', value: String(draft.maxEdge),
              onChange: event => setDraft({ ...draft, maxEdge: Number(event.target.value) }),
            }, ...[1280, 1920, 2560].map(value => h('option', { key: value, value: String(value) }, String(value))))),
            field(L('最长时长', 'Max duration'), h('select', {
              className: 'vsr-select', value: String(draft.maxSeconds),
              onChange: event => setDraft({ ...draft, maxSeconds: Number(event.target.value) }),
            }, ...[60, 180, 300, 600].map(value => h('option', { key: value, value: String(value) }, L(value / 60 + ' 分钟', value / 60 + ' min')))))),
          h('div', { className: 'vsr-checks' },
            h('label', { className: 'vsr-check' }, h('input', {
              type: 'checkbox', checked: draft.includeSystemAudio,
              onChange: event => setDraft({ ...draft, includeSystemAudio: event.target.checked }),
            }), L('默认录系统声音', 'System audio by default')),
            h('label', { className: 'vsr-check' }, h('input', {
              type: 'checkbox', checked: draft.includeMic,
              onChange: event => setDraft({ ...draft, includeMic: event.target.checked }),
            }), L('默认录麦克风', 'Microphone by default')))),
        h('section', { className: 'vsr-card' },
          h('h3', null, L('快捷键', 'Shortcuts')),
          h('div', { className: 'vsr-grid' },
            field(L('截图', 'Screenshot'), h(ShortcutInput, {
              value: draft.shortcuts.screenshot,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, screenshot: value } }),
            })),
            field(L('录屏 / 停止', 'Record / stop'), h(ShortcutInput, {
              value: draft.shortcuts.record,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, record: value } }),
            })),
            field(L('截图浮层 · 提取文字', 'Shot overlay · text'), h(ShortcutInput, {
              value: draft.shortcuts.text,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, text: value } }),
            })),
            field(L('截图浮层 · 复制图片', 'Shot overlay · copy image'), h(ShortcutInput, {
              value: draft.shortcuts.copyImage,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, copyImage: value } }),
            })),
            field(L('截图浮层 · 复制文件', 'Shot overlay · copy file'), h(ShortcutInput, {
              value: draft.shortcuts.clipboard,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, clipboard: value } }),
            })),
            field(L('截图浮层 · 用这张', 'Shot overlay · use this'), h(ShortcutInput, {
              value: draft.shortcuts.save,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, save: value } }),
            }))),
          h('div', { className: 'vsr-muted' }, L('在 DSH 窗口内生效；点输入框后直接按组合键。工具条按钮上悬停会显示对应快捷键。', 'Active while DSH is focused; hover a toolbar button to see its shortcut.'))),
        h('section', { className: 'vsr-card' },
          h('h3', null, L('文字识别', 'Text recognition')),
          h('div', { className: 'vsr-grid' },
            field(L('识别引擎', 'Engine'), h('select', {
              className: 'vsr-select',
              value: (draft.ocr && draft.ocr.engine) || 'auto',
              onChange: event => setDraft({ ...draft, ocr: { ...(draft.ocr || {}), engine: event.target.value } }),
            },
            h('option', { value: 'auto' }, L('自动（跟随 OCR 插件配置，没有则用系统 OCR）', 'Auto (OCR plugin config, else Windows OCR)')),
            ...ocrInfo.engines.map(engine => h('option', { key: engine.id, value: engine.id }, engine.label + ' · ' + engine.mode)))),
            field(L('语言', 'Language'), h('select', {
              className: 'vsr-select',
              value: (draft.ocr && draft.ocr.lang) || 'system',
              onChange: event => setDraft({ ...draft, ocr: { ...(draft.ocr || {}), lang: event.target.value } }),
            },
            h('option', { value: 'system' }, L('跟随系统', 'System default')),
            ...ocrInfo.languages.map(tag => h('option', { key: tag, value: tag }, tag))))),
          h('div', { className: 'vsr-muted' },
            ocrInfo.winrt
              ? L('系统 OCR 可用：', 'Windows OCR available: ') + ocrInfo.languages.join(', ') + L('。截图后拖框即自动取字。', '. Text is read as soon as you select.')
              : L('系统 OCR 不可用：请在「设置 → 时间和语言 → 语言和区域」里安装语言包。', 'Windows OCR unavailable: install a language pack under Settings → Time & language.')),
          h('label', { className: 'vsr-check' }, h('input', {
            type: 'checkbox',
            checked: !(draft.ocr && draft.ocr.auto === false),
            onChange: event => setDraft({ ...draft, ocr: { ...(draft.ocr || {}), auto: event.target.checked } }),
          }), L('截图后自动提取文字', 'Extract text automatically after selecting')))),
        h('section', { className: 'vsr-card' },
          h('h3', null, L('截图', 'Screenshot')),
          h('label', { className: 'vsr-check' }, h('input', {
            type: 'checkbox', checked: draft.hideDshOnShot,
            onChange: event => setDraft({ ...draft, hideDshOnShot: event.target.checked }),
          }), L('截图时先隐藏 DSH 界面', 'Hide DSH before capturing')),
          h('div', { className: 'vsr-muted' }, L('用来截取被 DSH 挡住的窗口或其他应用；截图浮层里也可以临时切换。', 'Capture windows behind DSH; the overlay can toggle it too.'))),
        h('div', { className: 'vsr-settings-actions' },
          h('button', { type: 'button', className: 'vsr-btn-primary', disabled: saving, onClick: () => { void save() } },
            saving ? L('保存中…', 'Saving…') : L('保存设置', 'Save settings')),
          h('span', { className: 'vsr-muted' }, L('修改后点保存。', 'Save to apply.'))),
        h('section', { className: 'vsr-card' },
          h('div', { className: 'vsr-library-head' },
            h('h3', null, L('文件', 'Files')),
            h('div', { className: 'vsr-library-actions' },
              h('button', { type: 'button', className: 'vsr-filter' + (filter === 'all' ? ' vsr-filter-on' : ''), onClick: () => setFilter('all') }, L('全部', 'All')),
              h('button', { type: 'button', className: 'vsr-filter' + (filter === 'video' ? ' vsr-filter-on' : ''), onClick: () => setFilter('video') }, L('录屏', 'Videos')),
              h('button', { type: 'button', className: 'vsr-filter' + (filter === 'image' ? ' vsr-filter-on' : ''), onClick: () => setFilter('image') }, L('截图', 'Images')),
              h('button', { type: 'button', className: 'vsr-settings-link', onClick: () => { void refreshLibrary() } }, L('刷新', 'Refresh')),
              h('button', { type: 'button', className: 'vsr-settings-link', onClick: openLibraryFolder }, L('打开文件夹', 'Open folder'))),
          converting !== null ? h('div', { className: 'vsr-convert' },
            h('div', { className: 'vsr-muted' }, L('正在转 MP4：', 'Converting to MP4: ') + converting + '（会实时播放原音频）'),
            h('div', { className: 'vsr-bar' }, h('div', { className: 'vsr-bar-fill', style: { width: Math.round(convertProgress * 100) + '%' } }))) : null,
          files.length === 0
            ? h('div', { className: 'vsr-empty' }, L('这里还没有文件。', 'No files yet.'))
            : h('div', { className: 'vsr-file-list' }, ...files.map(file => h('div', { className: 'vsr-file-row', key: file.path },
              h('span', { className: 'vsr-file-kind' + (file.kind === 'image' ? ' vsr-file-kind-image' : '') }, file.kind === 'image' ? L('截图', 'Image') : L('录屏', 'Video')),
              h('span', { className: 'vsr-file-name', title: file.path }, file.name),
              h('span', { className: 'vsr-file-meta' }, formatBytes(file.size) + ' · ' + formatDate(file.mtime)),
              h('button', { type: 'button', className: 'vsr-settings-link', onClick: () => { void reveal(file.path) } }, L('打开', 'Open')),
              file.kind === 'video' && file.name.toLowerCase().endsWith('.webm')
                ? h('button', { type: 'button', className: 'vsr-settings-link', disabled: converting !== null, onClick: () => { void convert(file) } }, L('转 MP4', 'To MP4'))
                : null,
              h('button', { type: 'button', className: 'vsr-settings-link vsr-danger', onClick: () => { void removeFile(file) } }, L('删除', 'Delete')))))))
    }

    // ---------------------------------------------------------------- icons
    const iconRecord = () => h('svg', { viewBox: '0 0 16 16', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, 'aria-hidden': 'true' },
      h('rect', { x: 2, y: 3, width: 12, height: 8.5, rx: 1.5 }),
      h('circle', { cx: 8, cy: 7.25, r: 1.7, fill: 'currentColor', stroke: 'none' }),
      h('path', { d: 'M6 14h4' }))
    const iconCamera = () => h('svg', { viewBox: '0 0 16 16', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, 'aria-hidden': 'true' },
      h('path', { d: 'M2.5 5.5h2l1-1.5h5l1 1.5h2v7h-11z' }),
      h('circle', { cx: 8, cy: 9, r: 2.2 }))
    const iconStop = () => h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true' },
      h('rect', { x: 4, y: 4, width: 8, height: 8, rx: 2, fill: 'currentColor' }))
    const iconChevron = open => h('span', { className: 'vsr-chevron', 'aria-hidden': 'true' }, open ? '▾' : '▸')

    // -------------------------------------------------------------- toolbar
    function Toolbar(props) {
      const snapshot = useStore()
      const now = useNow(snapshot.phase === 'recording')
      const recording = snapshot.recording
      const seconds = recording ? Math.max(0, Math.floor((now - recording.startedAt) / 1000)) : 0
      const busy = snapshot.phase === 'starting' || snapshot.phase === 'encoding' || Boolean(snapshot.agentRecording)
      const isRecording = snapshot.phase === 'recording'
      const settings = snapshot.settings || DEFAULT_SETTINGS
      const shortcuts = settings.shortcuts || DEFAULT_SETTINGS.shortcuts
      const agentLabel = L('Agent 正在录屏', 'Agent is recording')
      const recordLabel = snapshot.agentRecording ? agentLabel : (isRecording ? S.stopTip : S.recordTip)
      const recordShortcut = snapshot.agentRecording ? '' : shortcuts.record
      return h('div', { className: 'vsr-toolbar' },
        h('div', { className: 'vsr-btn-wrap' },
          h('button', {
            type: 'button',
            className: 'vsr-btn' + (isRecording ? ' vsr-btn-rec' : ''),
            disabled: busy,
            'aria-label': recordLabel,
            onMouseDown: event => event.preventDefault(),
            onClick: () => { if (isRecording) void stopRecording(); else void openPicker() },
          }, isRecording
            ? h('span', { className: 'vsr-rec-pill' }, h('span', { className: 'vsr-dot' }), formatDuration(seconds), iconStop())
            : iconRecord()),
          h(Tip, { label: recordLabel, shortcut: recordShortcut })),
        h('div', { className: 'vsr-btn-wrap' },
          h('button', {
            type: 'button',
            className: 'vsr-btn',
            disabled: busy || isRecording,
            'aria-label': S.shotTip,
            onMouseDown: event => event.preventDefault(),
            onClick: () => { void takeScreenshot() },
          }, iconCamera()),
          h(Tip, { label: S.shotTip, shortcut: shortcuts.screenshot })),
      )
    }

    // --------------------------------------------------------------- picker
    function useImage(url) {
      const [image, setImage] = useState(null)
      useEffect(() => {
        if (!url) { setImage(null); return undefined }
        let alive = true
        const element = new Image()
        element.onload = () => { if (alive) setImage(element) }
        element.src = url
        return () => { alive = false; element.onload = null }
      }, [url])
      return image
    }

    function Thumb(props) {
      const { image, virtual, rect } = props
      const ref = useRef(null)
      useEffect(() => {
        const canvas = ref.current
        if (!canvas || !image || !virtual || !rect) return
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = 'rgba(0,0,0,.35)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        const kx = image.naturalWidth / virtual.w
        const ky = image.naturalHeight / virtual.h
        const sx = Math.max(0, (rect.x - virtual.x) * kx)
        const sy = Math.max(0, (rect.y - virtual.y) * ky)
        const sw = Math.max(1, Math.min(image.naturalWidth - sx, rect.w * kx))
        const sh = Math.max(1, Math.min(image.naturalHeight - sy, rect.h * ky))
        const scale = Math.min(canvas.width / sw, canvas.height / sh)
        const dw = sw * scale
        const dh = sh * scale
        ctx.drawImage(image, sx, sy, sw, sh, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh)
      }, [image, virtual, rect])
      return h('canvas', { ref, className: 'vsr-thumb', width: 72, height: 44 })
    }

    function Picker(props) {
      const { picker } = props
      const [windowsOpen, setWindowsOpen] = useState(false)
      const storeSnapshot = useStore()
      const defaults = storeSnapshot.settings || DEFAULT_SETTINGS
      const [systemAudio, setSystemAudio] = useState(defaults.includeSystemAudio !== false)
      const [microphone, setMicrophone] = useState(defaults.includeMic !== false)
      const image = useImage(picker.shotUrl)
      const lastKey = useMemo(() => {
        try { return sourceKey(JSON.parse(localStorage.getItem('vsr.lastSource') || 'null')) } catch { return '' }
      }, [])
      const lastRef = useRef(null)
      useEffect(() => {
        if (lastRef.current && typeof lastRef.current.scrollIntoView === 'function') {
          lastRef.current.scrollIntoView({ block: 'nearest' })
        }
      }, [image, windowsOpen])

      const virtual = picker.sources.virtual
      const options = { includeSystemAudio: systemAudio, includeMic: microphone }
      const row = (key, choice, name, detail, thumbnailRect) => {
        const selected = key === lastKey
        return h('button', {
          key: key,
          ref: selected ? lastRef : null,
          type: 'button',
          className: 'vsr-row' + (selected ? ' vsr-row-last' : ''),
          onClick: () => { void startRecording(choice, options) },
        },
        h(Thumb, { image, virtual, rect: thumbnailRect }),
        h('span', { className: 'vsr-row-text' },
          h('span', { className: 'vsr-row-name' }, name),
          h('span', { className: 'vsr-row-detail' }, detail)))
      }

      const desktopChoice = { type: 'desktop' }
      return h('div', { className: 'vsr-overlay', onMouseDown: event => { if (event.target === event.currentTarget) closePicker() } },
        h('div', { className: 'vsr-modal' },
          h('div', { className: 'vsr-modal-head' },
            h('strong', null, S.pickerTitle),
            h('button', { type: 'button', className: 'vsr-x', onClick: closePicker, 'aria-label': S.close }, '×')),
          h('div', { className: 'vsr-scroll' },
            row('desktop', desktopChoice, S.desktop, virtual.w + ' × ' + virtual.h, { x: virtual.x, y: virtual.y, w: virtual.w, h: virtual.h }),
            picker.sources.monitors.length > 0 ? h('div', { className: 'vsr-section' }, S.monitors) : null,
            ...picker.sources.monitors.map(monitor => row(
              'monitor:' + (monitor.name || monitor.x + ',' + monitor.y),
              { type: 'monitor', x: monitor.x, y: monitor.y, w: monitor.w, h: monitor.h, name: monitor.name },
              S.monitors + ' ' + monitor.index + (monitor.primary ? ' · ' + S.primary : ''),
              monitor.w + ' × ' + monitor.h,
              { x: monitor.x, y: monitor.y, w: monitor.w, h: monitor.h },
            )),
            picker.sources.windows.length > 0
              ? h('button', { type: 'button', className: 'vsr-section vsr-section-toggle', onClick: () => setWindowsOpen(open => !open) },
                iconChevron(windowsOpen), ' ' + S.windows + '（' + picker.sources.windows.length + '）')
              : null,
            windowsOpen ? picker.sources.windows.map(win => row(
              'window:' + win.hwnd,
              { type: 'window', hwnd: win.hwnd, title: win.title },
              win.title,
              (win.process ? win.process + ' · ' : '') + win.w + ' × ' + win.h,
              win,
            )) : null,
            h('button', {
              type: 'button',
              className: 'vsr-row vsr-row-custom',
              onClick: () => openRegionShot(picker, options),
            },
            h('span', { className: 'vsr-custom-icon' }, '⌗'),
            h('span', { className: 'vsr-row-text' },
              h('span', { className: 'vsr-row-name' }, S.custom),
              h('span', { className: 'vsr-row-detail' }, S.customHint)))),
          h('div', { className: 'vsr-modal-foot vsr-picker-foot' },
            h('label', { className: 'vsr-check' }, h('input', { type: 'checkbox', checked: systemAudio, onChange: event => setSystemAudio(event.target.checked) }), S.systemAudio),
            h('label', { className: 'vsr-check' }, h('input', { type: 'checkbox', checked: microphone, onChange: event => setMicrophone(event.target.checked) }), S.microphone),
            h('span', { className: 'vsr-hint' }, defaults.fps + ' fps · ' + Math.round(defaults.maxSeconds / 60) + L(' 分钟 · 窗口录制会录到遮挡物', ' min · window capture includes occluders')))))
    }

    // ------------------------------------------------------------ screenshot
    function ScreenshotOverlay(props) {
      const { shot } = props
      const isRegion = shot.mode === 'region'
      const [viewport, setViewport] = useState(0)
      const [phase, setPhase] = useState('select')
      const [sel, setSel] = useState(null)
      const [tool, setTool] = useState('pen')
      const [color, setColor] = useState('#e5484d')
      const [lineWidth, setLineWidth] = useState(3)
      const [strokes, setStrokes] = useState([])
      const [draft, setDraft] = useState(null)
      const [textInput, setTextInput] = useState(null)
      const [imageUrl, setImageUrl] = useState(shot.url)
      const [hiddenDsh, setHiddenDsh] = useState(Boolean(shot.hiddenDsh))
      // 取字与复制：和 QQ / 微信截图一样，在标注工具条上一键取字、一键复制。
      const [extract, setExtract] = useState(null) // { status: 'loading'|'ready'|'error', text, lines, engine, error }
      const [panelOpen, setPanelOpen] = useState(true)
      const [copying, setCopying] = useState(null) // 'image' | 'file' | 'text'
      const [cursorPos, setCursorPos] = useState(null)
      const extractRef = useRef(null)
      const selAtExtract = useRef('')
      const generatedUrls = useRef([])
      const wrapRef = useRef(null)
      const canvasRef = useRef(null)
      const dragRef = useRef(null)
      const selRef = useRef(null)
      const draftRef = useRef(null)
      const imageW = shot.imageW
      const imageH = shot.imageH

      const disp = useMemo(() => {
        const maxW = Math.max(200, window.innerWidth * 0.92)
        const maxH = Math.max(160, window.innerHeight * 0.76)
        const scale = Math.min(maxW / imageW, maxH / imageH, 1)
        return { w: Math.max(1, Math.round(imageW * scale)), h: Math.max(1, Math.round(imageH * scale)) }
      }, [imageW, imageH, viewport])
      const toOrig = point => ({ x: point.x * imageW / disp.w, y: point.y * imageH / disp.h })
      const toDisp = point => ({ x: point.x * disp.w / imageW, y: point.y * disp.h / imageH })

      useEffect(() => {
        const onResize = () => setViewport(value => value + 1)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }, [])
      useEffect(() => {
        setImageUrl(shot.url)
        setHiddenDsh(Boolean(shot.hiddenDsh))
      }, [shot.url])
      useEffect(() => () => {
        for (const url of generatedUrls.current) { try { URL.revokeObjectURL(url) } catch { /* ignore */ } }
      }, [])
      async function toggleHideDsh() {
        const next = !hiddenDsh
        try {
          // 抓新底图时整个截图浮层必须先隐藏，否则拍到的就是这层标注界面。
          const shot = await fetchShot('?ts=' + Date.now() + (next ? '&hideDsh=1' : ''))
          if (next && !shot.hidden) {
            toast(L('没有找到可隐藏的 DSH 窗口', 'No DSH window to hide'), { kind: 'error' })
            return
          }
          const url = URL.createObjectURL(shot.blob)
          generatedUrls.current.push(url)
          setImageUrl(url)
          setHiddenDsh(shot.hidden)
          setSel(null); selRef.current = null
          setStrokes([]); draftRef.current = null; setDraft(null)
          setPhase('select')
        } catch (error) {
          toast(L('切换底图失败：', 'Failed to switch base image: ') + friendly(error), { kind: 'error' })
        }
      }
      useEffect(() => {
        const old = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = old }
      }, [])

      function drawStroke(ctx, stroke) {
        if (!stroke || !stroke.points || stroke.points.length === 0) return
        ctx.strokeStyle = stroke.color
        ctx.fillStyle = stroke.color
        ctx.lineWidth = stroke.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const points = stroke.points.map(toDisp)
        if (stroke.type === 'pen') {
          ctx.beginPath()
          ctx.moveTo(points[0].x, points[0].y)
          for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y)
          ctx.stroke()
        } else if (stroke.type === 'rect') {
          const start = points[0]
          const end = points[points.length - 1]
          ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
        } else if (stroke.type === 'arrow') {
          const start = points[0]
          const end = points[points.length - 1]
          ctx.beginPath()
          ctx.moveTo(start.x, start.y)
          ctx.lineTo(end.x, end.y)
          ctx.stroke()
          const angle = Math.atan2(end.y - start.y, end.x - start.x)
          const size = Math.max(9, stroke.width * 3.2)
          ctx.beginPath()
          ctx.moveTo(end.x, end.y)
          ctx.lineTo(end.x - size * Math.cos(angle - Math.PI / 7), end.y - size * Math.sin(angle - Math.PI / 7))
          ctx.moveTo(end.x, end.y)
          ctx.lineTo(end.x - size * Math.cos(angle + Math.PI / 7), end.y - size * Math.sin(angle + Math.PI / 7))
          ctx.stroke()
        } else if (stroke.type === 'text') {
          ctx.font = '600 ' + Math.max(14, stroke.size) + 'px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif'
          ctx.textBaseline = 'top'
          ctx.fillText(stroke.text, points[0].x, points[0].y)
        }
      }

      useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.round(disp.w * ratio)
        canvas.height = Math.round(disp.h * ratio)
        canvas.style.width = disp.w + 'px'
        canvas.style.height = disp.h + 'px'
        const ctx = canvas.getContext('2d')
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.clearRect(0, 0, disp.w, disp.h)
        if (sel && (phase === 'annotate' || isRegion)) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(sel.x, sel.y, sel.w, sel.h)
          ctx.clip()
          for (const stroke of strokes) drawStroke(ctx, stroke)
          if (draft) drawStroke(ctx, draft)
          ctx.restore()
          ctx.strokeStyle = 'rgba(255,255,255,.95)'
          ctx.lineWidth = 1
          ctx.setLineDash([5, 4])
          ctx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h)
          ctx.setLineDash([])
        }
        if (phase === 'select' && sel && !isRegion) {
          ctx.fillStyle = 'rgba(0,0,0,.42)'
          ctx.fillRect(0, 0, disp.w, disp.h)
          ctx.clearRect(sel.x, sel.y, sel.w, sel.h)
          ctx.strokeStyle = 'rgba(255,255,255,.95)'
          ctx.lineWidth = 1
          ctx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h)
        }
        // 取字结果的行框：半透明蓝底 + 细边，和 QQ / 微信截图取字后的选区一致。
        // 坐标来自原图，按当前显示比例缩放。
        if (phase === 'annotate' && !isRegion && extract && extract.status === 'ready' && extract.lines.length > 0) {
          const kx = disp.w / imageW
          const ky = disp.h / imageH
          for (const line of extract.lines) {
            if (!line || !Number.isFinite(line.x) || !Number.isFinite(line.y)) continue
            const x = line.x * kx
            const y = line.y * ky
            const w = Math.max(1, (line.w || 0) * kx)
            const h = Math.max(1, (line.h || 0) * ky)
            if (sel && (x + w < sel.x || y + h < sel.y || x > sel.x + sel.w || y > sel.y + sel.h)) continue
            ctx.fillStyle = 'rgba(22,119,255,.16)'
            ctx.fillRect(x, y, w, h)
            ctx.strokeStyle = 'rgba(74,163,255,.9)'
            ctx.lineWidth = 1
            ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1))
          }
        }
      }, [sel, strokes, draft, disp, phase, tool, color, lineWidth, viewport, extract])

      function localPoint(event) {
        const rect = wrapRef.current.getBoundingClientRect()
        return { x: event.clientX - rect.left, y: event.clientY - rect.top }
      }
      function onDown(event) {
        if (event.button !== 0 || textInput) return
        const point = localPoint(event)
        if (phase === 'select') {
          dragRef.current = { start: point }
          const next = { x: point.x, y: point.y, w: 0, h: 0 }
          selRef.current = next
          setSel(next)
          return
        }
        if (isRegion) return
        event.preventDefault()
        if (tool === 'text') {
          setTextInput({ x: point.x, y: point.y, value: '' })
          return
        }
        const origin = toOrig(point)
        const next = { type: tool, color, width: lineWidth, size: Math.max(16, lineWidth * 6), points: [origin] }
        dragRef.current = { start: point }
        draftRef.current = next
        setDraft(next)
      }
      function onMove(event) {
        const drag = dragRef.current
        if (!drag) return
        const point = localPoint(event)
        if (phase === 'select') {
          const x = Math.min(drag.start.x, point.x)
          const y = Math.min(drag.start.y, point.y)
          const next = { x, y, w: Math.abs(point.x - drag.start.x), h: Math.abs(point.y - drag.start.y) }
          selRef.current = next
          setSel(next)
          return
        }
        const current = draftRef.current
        if (!current) return
        const origin = toOrig(point)
        const next = current.type === 'pen'
          ? { ...current, points: [...current.points, origin] }
          : { ...current, points: [current.points[0], origin] }
        draftRef.current = next
        setDraft(next)
      }
      function onUp() {
        const drag = dragRef.current
        dragRef.current = null
        if (!drag) return
        if (phase === 'select') {
          const current = selRef.current
          if (!current || current.w < 8 || current.h < 8) {
            const full = { x: 0, y: 0, w: disp.w, h: disp.h }
            selRef.current = full
            setSel(full)
          }
          if (!isRegion) setPhase('annotate')
          return
        }
        const current = draftRef.current
        if (current) {
          setStrokes(all => [...all, current])
          draftRef.current = null
          setDraft(null)
        }
      }
      function commitText() {
        if (!textInput) return
        const value = textInput.value.trim()
        if (value) {
          const origin = toOrig(textInput)
          setStrokes(current => [...current, {
            type: 'text', color, width: lineWidth, size: Math.max(16, lineWidth * 6),
            text: value, points: [origin],
          }])
        }
        setTextInput(null)
      }

      /**
       * 把当前选区（含标注）合成成一张原分辨率的 canvas。
       *
       * 不加标注时直接切原图像素：没有重编码，取字和复制图片都最清晰。
       * 有标注时才把标注按原图比例画上去。
       */
      function renderRegion() {
        return new Promise((resolve, reject) => {
          if (!sel) { reject(new Error(L('还没有选区', 'No selection yet'))); return }
          const image = new Image()
          image.onerror = () => reject(new Error(L('图片加载失败', 'Image failed to load')))
          image.onload = () => {
            const scaleX = imageW / disp.w
            const scaleY = imageH / disp.h
            const sx = sel.x * scaleX
            const sy = sel.y * scaleY
            const sw = Math.max(1, sel.w * scaleX)
            const sh = Math.max(1, sel.h * scaleY)
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round(sw))
            canvas.height = Math.max(1, Math.round(sh))
            const ctx = canvas.getContext('2d')
            ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
            if (strokes.length > 0) {
              ctx.save()
              ctx.translate(-sx, -sy)
              const scaled = strokes.map(stroke => ({ ...stroke, width: stroke.width * scaleX, size: (stroke.size || 0) * scaleX }))
              for (const stroke of scaled) {
                const points = stroke.points
                ctx.strokeStyle = stroke.color
                ctx.fillStyle = stroke.color
                ctx.lineWidth = stroke.width
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'
                if (stroke.type === 'pen') {
                  ctx.beginPath()
                  ctx.moveTo(points[0].x, points[0].y)
                  for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y)
                  ctx.stroke()
                } else if (stroke.type === 'rect') {
                  const start = points[0]
                  const end = points[points.length - 1]
                  ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
                } else if (stroke.type === 'arrow') {
                  const start = points[0]
                  const end = points[points.length - 1]
                  ctx.beginPath()
                  ctx.moveTo(start.x, start.y)
                  ctx.lineTo(end.x, end.y)
                  ctx.stroke()
                  const angle = Math.atan2(end.y - start.y, end.x - start.x)
                  const size = Math.max(9, stroke.width * 3.2)
                  ctx.beginPath()
                  ctx.moveTo(end.x, end.y)
                  ctx.lineTo(end.x - size * Math.cos(angle - Math.PI / 7), end.y - size * Math.sin(angle - Math.PI / 7))
                  ctx.moveTo(end.x, end.y)
                  ctx.lineTo(end.x - size * Math.cos(angle + Math.PI / 7), end.y - size * Math.sin(angle + Math.PI / 7))
                  ctx.stroke()
                } else if (stroke.type === 'text') {
                  ctx.font = '600 ' + Math.max(14, stroke.size) + 'px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif'
                  ctx.textBaseline = 'top'
                  ctx.fillText(stroke.text, points[0].x, points[0].y)
                }
              }
              ctx.restore()
            }
            resolve(canvas)
          }
          image.src = imageUrl
        })
      }

      /** 导出成 JPEG（挂附件/存盘用）：和以前一样，但复用 renderRegion。 */
      function exportShot() {
        if (!sel) return
        renderRegion().then(canvas => {
          canvas.toBlob(blob => {
            closeShot()
            if (blob) void saveScreenshot(blob, '截图-' + stamp() + '.jpg')
          }, 'image/jpeg', 0.9)
        }).catch(() => closeShot())
      }

      /** canvas → PNG Blob，失败时给出可读错误。 */
      function toPng(canvas) {
        return new Promise((resolve, reject) => {
          canvas.toBlob(blob => {
            if (blob) resolve(blob)
            else reject(new Error(L('生成图片失败', 'Could not render the image')))
          }, 'image/png')
        })
      }

      const selectionKey = () => (sel ? [sel.x, sel.y, sel.w, sel.h].map(value => Math.round(value)).join(',') : '')

      /** 提取选区里的文字：结果进面板，同时提示成功/失败。 */
      async function extractText() {
        if (!sel || extractRef.current === 'loading') return
        extractRef.current = 'loading'
        selAtExtract.current = selectionKey()
        setExtract({ status: 'loading', text: '', lines: [], engine: '' })
        setPanelOpen(true)
        try {
          const canvas = await renderRegion()
          const blob = await toPng(canvas)
          const result = await ocrRegion(blob)
          // 识别期间用户又改了选区，这份结果就不是他要的，丢掉。
          if (selAtExtract.current !== selectionKey()) return
          extractRef.current = 'ready'
          setExtract({ status: 'ready', text: result.text || '', lines: result.lines || [], engine: result.engine || '' })
        } catch (error) {
          extractRef.current = 'error'
          setExtract({ status: 'error', text: '', lines: [], engine: '', error: friendly(error) })
          toast(S.textFailed + friendly(error), { kind: 'error' })
        }
      }

      /** 没取过字就直接取字并复制；取过了就只复制。 */
      async function copyText() {
        if (extract && extract.status === 'ready' && extract.text) {
          try {
            await putClipboard('text', { text: extract.text })
            copiedToast('text')
          } catch (error) {
            toast(S.copyFailed + friendly(error), { kind: 'error' })
          }
          return
        }
        await extractText()
      }

      /** 复制选区图片：先存成 PNG（取字/复制文件都复用这个文件），再放进剪贴板。 */
      async function copyImage(as) {
        if (!sel || copying !== null) return
        setCopying(as === 'files' ? 'file' : 'image')
        try {
          const canvas = await renderRegion()
          const blob = await toPng(canvas)
          const name = '截图-' + stamp() + '.png'
          const uploaded = await uploadBlob(blob, name, 'image')
          if (as === 'files') {
            await putClipboard('files', { path: uploaded.file })
            copiedToast('files')
          } else {
            await putClipboard('image', { blob })
            copiedToast('image')
          }
        } catch (error) {
          toast(S.copyFailed + friendly(error), { kind: 'error' })
        } finally {
          setCopying(null)
        }
      }

      /** 复制文字后收起面板，露出完整截图看哪里已复制。 */
      function finishTextPanel() {
        setPanelOpen(false)
      }

      function confirmRegion() {
        if (!sel) return
        const scaleX = imageW / disp.w
        const scaleY = imageH / disp.h
        const virtual = shot.virtual || { x: 0, y: 0, w: imageW, h: imageH }
        const region = {
          type: 'region',
          x: Math.round(virtual.x + sel.x * scaleX * (virtual.w / imageW)),
          y: Math.round(virtual.y + sel.y * scaleY * (virtual.h / imageH)),
          w: Math.max(16, Math.round(sel.w * scaleX * (virtual.w / imageW))),
          h: Math.max(16, Math.round(sel.h * scaleY * (virtual.h / imageH))),
          name: '自定义区域',
        }
        const options = shot.options || {}
        closeShot()
        void startRecording(region, options)
      }

      function confirmCurrent() {
        if (isRegion) { confirmRegion(); return }
        if (!sel) return
        exportShot()
      }

      useEffect(() => {
        const shortcuts = (state.settings || DEFAULT_SETTINGS).shortcuts || DEFAULT_SETTINGS.shortcuts
        // 面板里选中文字按 Ctrl+C 交给浏览器，不能当「复制图片」。
        const inPanel = event => {
          const target = event.target
          return Boolean(target && typeof target.closest === 'function' && target.closest('.vsr-text-panel'))
        }
        const onKey = event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            if (textInput) { setTextInput(null); return }
            closeShot()
            return
          }
          if (textInput || inPanel(event)) return
          if (event.key === 'Enter') {
            event.preventDefault()
            confirmCurrent()
            return
          }
          if (matchesShortcut(event, shortcuts.text)) {
            event.preventDefault()
            if (phase === 'annotate' && !isRegion && sel) void extractText()
            return
          }
          if (matchesShortcut(event, shortcuts.clipboard)) {
            event.preventDefault()
            if (phase === 'annotate' && !isRegion && sel) void copyImage('files')
            return
          }
          if (matchesShortcut(event, shortcuts.copyImage)) {
            event.preventDefault()
            if (phase === 'annotate' && !isRegion && sel) void copyImage('image')
            return
          }
          if (matchesShortcut(event, shortcuts.save)) {
            event.preventDefault()
            confirmCurrent()
            return
          }
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault()
            setStrokes(current => current.slice(0, -1))
          }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      })

      const settings = (state.settings || DEFAULT_SETTINGS)
      const shortcuts = settings.shortcuts || DEFAULT_SETTINGS.shortcuts
      // 松手出选区后自动取字（和 QQ / 微信一致）；设置里可以关掉。
      useEffect(() => {
        if (phase !== 'annotate' || isRegion || !sel) return
        if (settings.ocr && settings.ocr.auto === false) return
        if (extractRef.current !== null) return
        void extractText()
      }, [phase, isRegion, sel && sel.x, sel && sel.y, sel && sel.w, sel && sel.h])

      const colors = ['#e5484d', '#f5a623', '#2ea44f', '#1677ff', '#ffffff', '#111111']
      return h('div', { className: 'vsr-overlay vsr-overlay-shot' },
        h('div', { className: 'vsr-shot-stage' },
          h('div', { ref: wrapRef, className: 'vsr-shot-wrap', style: { width: disp.w, height: disp.h }, onMouseDown: onDown, onMouseMove: onMove, onMouseUp: onUp, onMouseLeave: onUp },
            h('img', { src: imageUrl, className: 'vsr-shot-image', draggable: false, width: disp.w, height: disp.h, alt: '' }),
            h('canvas', { ref: canvasRef, className: 'vsr-shot-canvas' }),
            textInput ? h('input', {
              className: 'vsr-text-input',
              style: { left: textInput.x, top: textInput.y },
              autoFocus: true,
              value: textInput.value,
              onChange: event => setTextInput({ ...textInput, value: event.target.value }),
              onKeyDown: event => {
                if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commitText() }
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setTextInput(null) }
              },
              onBlur: commitText,
            }) : null),
          h('div', { className: 'vsr-shot-topbar' },
            h('span', null, isRegion ? S.regionHint : S.shotHint),
            h('button', {
              type: 'button',
              className: 'vsr-shot-hide' + (hiddenDsh ? ' vsr-shot-hide-on' : ''),
              onClick: toggleHideDsh,
            }, hiddenDsh ? L('显示 DSH 界面', 'Show DSH') : L('隐藏 DSH 界面', 'Hide DSH'))),
          phase === 'annotate' && !isRegion ? h('div', { className: 'vsr-toolbar-floating' },
            h('div', { className: 'vsr-toolgroup' },
              ...[['pen', '✎', S.pen], ['rect', '▭', S.rect], ['arrow', '↗', S.arrow], ['text', 'T', S.text]].map(([key, glyph, label]) =>
                h('div', { key, className: 'vsr-tip-host' },
                  h('button', { type: 'button', className: 'vsr-tool' + (tool === key ? ' vsr-tool-active' : ''), 'aria-label': label, onClick: () => setTool(key) }, glyph),
                  h(Tip, { label }))),
              h('span', { className: 'vsr-sep' }),
              ...colors.map(value => h('button', { key: value, type: 'button', className: 'vsr-swatch' + (color === value ? ' vsr-swatch-active' : ''), style: { background: value }, title: value, onClick: () => setColor(value) })),
              h('span', { className: 'vsr-sep' }),
              ...[2, 3, 5].map(value => h('button', { key: value, type: 'button', className: 'vsr-tool' + (lineWidth === value ? ' vsr-tool-active' : ''), title: String(value), onClick: () => setLineWidth(value) }, h('span', { className: 'vsr-width-dot', style: { width: value + 2, height: value + 2 } }))),
              h('span', { className: 'vsr-sep' }),
              h('div', { className: 'vsr-tip-host' },
                h('button', { type: 'button', className: 'vsr-tool', 'aria-label': S.reselect, onClick: () => { setPhase('select'); setSel(null) } }, '⟲'),
                h(Tip, { label: S.reselect })),
              h('div', { className: 'vsr-tip-host' },
                h('button', { type: 'button', className: 'vsr-tool', 'aria-label': S.undo, onClick: () => setStrokes(current => current.slice(0, -1)) }, '↶'),
                h(Tip, { label: S.undo })),
              h('div', { className: 'vsr-tip-host' },
                h('button', { type: 'button', className: 'vsr-tool', 'aria-label': S.clear, onClick: () => setStrokes([]) }, '🗑'),
                h(Tip, { label: S.clear }))),
            // 取字与复制：和 QQ / 微信截图一样的一排操作，不带「用这张」那么大的视觉权重。
            h('div', { className: 'vsr-toolgroup' },
              h('div', { className: 'vsr-tip-host' },
                h('button', {
                  type: 'button',
                  className: 'vsr-tool vsr-tool-text' + (extract && extract.status === 'ready' ? ' vsr-tool-on' : ''),
                  'aria-label': S.extractText,
                  onClick: () => { void extractText() },
                }, '文'),
                h(Tip, { label: S.extractText, shortcut: shortcuts.text })),
              h('div', { className: 'vsr-tip-host' },
                h('button', {
                  type: 'button',
                  className: 'vsr-tool vsr-tool-text',
                  'aria-label': S.copyImage,
                  disabled: Boolean(copying),
                  onClick: () => { void copyImage('image') },
                }, '⧉'),
                h(Tip, { label: S.copyImage, shortcut: shortcuts.copyImage })),
              h('div', { className: 'vsr-tip-host' },
                h('button', {
                  type: 'button',
                  className: 'vsr-tool vsr-tool-text',
                  'aria-label': S.copyFile,
                  disabled: Boolean(copying),
                  onClick: () => { void copyImage('files') },
                }, '⤓'),
                h(Tip, { label: S.copyFile, shortcut: shortcuts.clipboard }))),
            h('div', { className: 'vsr-toolgroup' },
              h('div', { className: 'vsr-tip-host' },
                h('button', { type: 'button', className: 'vsr-btn-text', onClick: closeShot }, S.cancel),
                h(Tip, { label: S.cancel })),
              h('div', { className: 'vsr-tip-host' },
                h('button', { type: 'button', className: 'vsr-btn-primary', onClick: confirmCurrent }, S.useShot),
                h(Tip, { label: S.useShot, shortcut: shortcuts.save })))) : null,
          phase === 'select' && isRegion ? h('div', { className: 'vsr-toolbar-floating' },
            h('div', { className: 'vsr-toolgroup' },
              h('button', { type: 'button', className: 'vsr-btn-text', onClick: closeShot }, S.cancel),
              h('button', { type: 'button', className: 'vsr-btn-primary', disabled: !sel, onClick: confirmCurrent }, S.recordRegion))) : null,
          // 文字面板：和 QQ / 微信的取字一样，识别结果直接可选中、可一键复制。
          phase === 'annotate' && !isRegion && extract && panelOpen
            ? h(TextPanel, {
              extract,
              shortcut: shortcuts.text,
              onCopy: () => { void copyText() },
              onClose: finishTextPanel,
              onRetry: () => { extractRef.current = null; void extractText() },
            })
            : null,
          phase === 'annotate' && !isRegion && extract && extract.status === 'ready' && !panelOpen
            ? h('button', { type: 'button', className: 'vsr-panel-reopen', onClick: () => setPanelOpen(true) }, '文 ' + S.showTextPanel)
            : null))
    }

    /**
     * 取字结果面板：状态（识别中/有字/没字/失败）+ 可选中文字 + 复制按钮。
     */
    function TextPanel(props) {
      const value = props.extract
      const chars = (value.text || '').replace(/\s/g, '').length
      let body
      if (value.status === 'loading') {
        body = h('div', { className: 'vsr-panel-status' }, h('span', { className: 'vsr-spinner' }), S.extracting)
      } else if (value.status === 'error') {
        body = h('div', { className: 'vsr-panel-status vsr-panel-error' },
          h('span', null, value.error || S.ocrUnavailable),
          h('button', { type: 'button', className: 'vsr-panel-link', onClick: props.onRetry }, L('重试', 'Retry')))
      } else if (!value.text || chars === 0) {
        body = h('div', { className: 'vsr-panel-status' }, S.noText)
      } else {
        // 用 div + user-select:text 而不是 textarea：看得见整段、能按行读，
        // 选中后 Ctrl+C 由浏览器自己处理（面板里的按键不再当快捷键）。
        body = h('div', { className: 'vsr-panel-text', tabIndex: 0, onClick: event => event.stopPropagation() }, value.text)
      }
      return h('div', { className: 'vsr-text-panel', onClick: event => event.stopPropagation() },
        h('div', { className: 'vsr-panel-head' },
          h('strong', null, S.textPanelTitle),
          value.status === 'ready' && chars > 0 ? h('span', { className: 'vsr-panel-meta' }, S.ocrCharacters(chars)) : null,
          h('button', {
            type: 'button',
            className: 'vsr-panel-copy',
            disabled: value.status !== 'ready' || chars === 0,
            onClick: props.onCopy,
          }, S.copyText),
          h('button', { type: 'button', className: 'vsr-panel-x', 'aria-label': S.hideTextPanel, onClick: props.onClose }, '×')),
        body,
        value.status === 'ready' && chars > 0
          ? h('div', { className: 'vsr-panel-foot' }, L('拖动选择部分文字，Ctrl+C 复制；点「复制文字」复制全部（', 'Drag to select, Ctrl+C to copy; “Copy text” copies all (') + props.shortcut + ')')
          : null)
    }

    // ------------------------------------------------------------- overlays
    function RecordingPill(props) {
      const now = useNow(true)
      const seconds = Math.max(0, Math.floor((now - props.recording.startedAt) / 1000))
      return h('div', { className: 'vsr-rec-pill vsr-rec-pill-floating' },
        h('span', { className: 'vsr-dot' }),
        h('span', null, S.recording + ' ' + formatDuration(seconds)),
        h('button', { type: 'button', className: 'vsr-link vsr-link-light', onClick: () => { void stopRecording() } }, S.stop))
    }

    function AgentPill(props) {
      const now = useNow(true)
      const seconds = Math.max(0, Math.floor((now - props.agent.startedAt) / 1000))
      return h('div', { className: 'vsr-rec-pill vsr-rec-pill-floating' },
        h('span', { className: 'vsr-dot' }),
        h('span', null, L('Agent 正在录屏 ', 'Agent recording ') + formatDuration(seconds)))
    }

    function ProgressCard(props) {
      const ratio = Math.max(0, Math.min(1, props.ratio || 0))
      return h('div', { className: 'vsr-progress' },
        h('div', { className: 'vsr-progress-title' }, props.stage),
        h('div', { className: 'vsr-bar' }, h('div', { className: 'vsr-bar-fill', style: { width: Math.round(ratio * 100) + '%' } })))
    }

    function ToastCard(props) {
      const value = props.toast
      return h('div', { className: 'vsr-toast' + (value.kind === 'error' ? ' vsr-toast-error' : '') },
        h('span', { className: 'vsr-toast-text' }, value.text),
        value.path ? h('button', { type: 'button', className: 'vsr-link', onClick: () => { void reveal(value.path) } }, S.openingFolder) : null,
        h('button', { type: 'button', className: 'vsr-toast-x', onClick: () => setState({ toast: null }), 'aria-label': S.close }, '×'))
    }

    function RootOverlay() {
      const snapshot = useStore()
      const children = []
      if (snapshot.phase === 'recording' && snapshot.recording) children.push(h(RecordingPill, { key: 'rec', recording: snapshot.recording }))
      if (snapshot.agentRecording) children.push(h(AgentPill, { key: 'agent', agent: snapshot.agentRecording }))
      // starting 阶段不出任何浮层：启动抓帧和截图都不能把本插件的提示拍进画面。
      if (snapshot.phase === 'encoding' && snapshot.progress) children.push(h(ProgressCard, { key: 'enc', stage: snapshot.progress.stage, ratio: snapshot.progress.ratio }))
      if (snapshot.picker) children.push(h(Picker, { key: 'picker', picker: snapshot.picker }))
      if (snapshot.shot) children.push(h(ScreenshotOverlay, { key: 'shot', shot: snapshot.shot }))
      if (snapshot.toast) children.push(h(ToastCard, { key: 'toast', toast: snapshot.toast }))
      if (children.length === 0) return null
      return ReactDOM.createPortal(h(React.Fragment, null, ...children), document.body)
    }

    // ------------------------------------------------------------------ css
    const CSS = `
.vsr-toolbar { display: inline-flex; align-items: center; gap: 2px; }
.vsr-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 28px; min-width: 28px; padding: 0 6px; border: 0; border-radius: 6px; background: transparent; color: var(--dsh-color-text-secondary, #6b7280); cursor: pointer; font: inherit; }
.vsr-btn:hover:not(:disabled) { background: var(--dsh-color-fill-quaternary, rgba(0,0,0,.06)); color: var(--dsh-color-text-primary, #111827); }
.vsr-btn:disabled { opacity: .45; cursor: default; }
.vsr-btn-rec { color: #e5484d; }
/* 悬停提示：按钮外面套一层定位容器，提示绝对定位在按钮上方居中。
   用 pointer-events:none 保证提示本身不会抢走 hover/点击。 */
.vsr-btn-wrap { position: relative; display: inline-flex; }
.vsr-tip { position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%); z-index: 2147483200; pointer-events: none; opacity: 0; transition: opacity .12s ease .28s; }
.vsr-btn-wrap:hover .vsr-tip,
.vsr-btn-wrap:focus-within .vsr-tip { opacity: 1; }
.vsr-tip-end { left: auto; right: 0; transform: none; }
.vsr-tip-body { display: inline-flex; align-items: center; gap: 8px; padding: 5px 9px; border-radius: 7px; background: rgba(28,28,31,.96); color: #f2f2f4; font: 500 12px/1.3 -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,.3); white-space: nowrap; }
.vsr-tip-label { white-space: nowrap; }
.vsr-tip-hint { color: #a9a9b2; font-weight: 400; }
.vsr-tip-keys { display: inline-flex; align-items: center; gap: 3px; margin-left: 2px; }
.vsr-kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,.22); border-bottom-width: 2px; background: rgba(255,255,255,.1); color: #fff; font: 500 11px/1 ui-monospace, SFMono-Regular, Consolas, "Courier New", monospace; }
@media (prefers-color-scheme: light) {
  .vsr-tip-body { background: rgba(32,32,36,.94); }
}
.vsr-rec-pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px; border-radius: 12px; background: rgba(229,72,77,.12); color: #e5484d; font-size: 12px; font-variant-numeric: tabular-nums; }
.vsr-rec-pill-floating { position: fixed; top: 18px; left: 50%; transform: translateX(-50%); z-index: 2147483001; height: 32px; padding: 0 12px; gap: 8px; background: rgba(20,20,22,.88); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.35); backdrop-filter: blur(8px); }
.vsr-dot { width: 8px; height: 8px; border-radius: 50%; background: #e5484d; box-shadow: 0 0 0 0 rgba(229,72,77,.6); animation: vsr-pulse 1.4s infinite; }
@keyframes vsr-pulse { 0% { box-shadow: 0 0 0 0 rgba(229,72,77,.6); } 70% { box-shadow: 0 0 0 7px rgba(229,72,77,0); } 100% { box-shadow: 0 0 0 0 rgba(229,72,77,0); } }
/* 抓屏的那一帧，本插件的浮层/提示一律不可见，避免被拍进图里。
   工具条按钮是 DSH 常驻界面的一部分，保留——用户截的就是当前界面。 */
html.vsr-capturing .vsr-overlay,
html.vsr-capturing .vsr-progress,
html.vsr-capturing .vsr-toast { visibility: hidden !important; }
.vsr-overlay { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.55); backdrop-filter: blur(3px); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
.vsr-modal { width: 420px; max-width: calc(100vw - 32px); max-height: 82vh; display: flex; flex-direction: column; background: var(--dsh-color-bg-elevated, #fff); color: var(--dsh-color-text-primary, #1f2329); border-radius: 14px; box-shadow: 0 24px 80px rgba(0,0,0,.38); overflow: hidden; }
.vsr-modal-narrow { width: 360px; }
.vsr-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 10px; font-size: 14px; }
.vsr-x { border: 0; background: transparent; color: inherit; font-size: 20px; line-height: 1; cursor: pointer; opacity: .55; padding: 0 3px; }
.vsr-x:hover { opacity: 1; }
.vsr-scroll { overflow: auto; padding: 0 10px 8px; }
.vsr-section { display: block; width: 100%; padding: 10px 6px 6px; font-size: 11px; letter-spacing: .04em; color: var(--dsh-color-text-tertiary, #8a8f98); text-align: left; background: transparent; border: 0; }
.vsr-section-toggle { cursor: pointer; }
.vsr-chevron { display: inline-block; width: 12px; font-size: 10px; }
.vsr-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 8px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: inherit; text-align: left; cursor: pointer; font: inherit; }
.vsr-row:hover { background: var(--dsh-color-fill-quaternary, rgba(0,0,0,.05)); }
.vsr-row-last { border-color: var(--dsh-color-accent, #1677ff); background: color-mix(in srgb, var(--dsh-color-accent, #1677ff) 8%, transparent); }
.vsr-row-custom { margin-top: 4px; }
.vsr-thumb { width: 72px; height: 44px; border-radius: 6px; background: #111; flex: none; }
.vsr-custom-icon { display: flex; align-items: center; justify-content: center; width: 72px; height: 44px; flex: none; border-radius: 6px; border: 1px dashed var(--dsh-color-border, rgba(0,0,0,.25)); font-size: 20px; color: var(--dsh-color-text-tertiary, #8a8f98); }
.vsr-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.vsr-row-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; }
.vsr-row-detail { font-size: 11px; color: var(--dsh-color-text-tertiary, #8a8f98); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; }
.vsr-modal-foot { display: flex; align-items: center; gap: 14px; padding: 10px 16px 12px; border-top: 1px solid var(--dsh-color-border, rgba(0,0,0,.08)); font-size: 12px; flex-wrap: wrap; }
.vsr-picker-foot { gap: 12px; }
.vsr-check { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.vsr-hint { margin-left: auto; color: var(--dsh-color-text-tertiary, #8a8f98); font-size: 11px; }
.vsr-link { border: 0; background: transparent; color: var(--dsh-color-accent, #1677ff); cursor: pointer; font: inherit; padding: 0; }
.vsr-link-light { color: #8fc2ff; }
.vsr-error { padding: 10px 16px 16px; color: #e5484d; font-size: 13px; line-height: 1.5; }
.vsr-muted { color: var(--dsh-color-text-tertiary, #8a8f98); font-size: 13px; }
.vsr-overlay-shot { background: rgba(0,0,0,.62); }
.vsr-shot-stage { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.vsr-shot-wrap { position: relative; cursor: crosshair; box-shadow: 0 20px 70px rgba(0,0,0,.45); border-radius: 2px; overflow: hidden; }
.vsr-shot-image { display: block; user-select: none; pointer-events: none; }
.vsr-shot-canvas { position: absolute; inset: 0; }
.vsr-shot-topbar { display: flex; align-items: center; gap: 14px; color: #fff; font-size: 12px; opacity: .9; }
.vsr-shot-hide { border: 1px solid rgba(255,255,255,.35); border-radius: 6px; background: rgba(0,0,0,.25); color: #fff; padding: 4px 9px; font: inherit; cursor: pointer; }
.vsr-shot-hide:hover { background: rgba(255,255,255,.16); }
.vsr-shot-hide-on { border-color: #4aa3ff; background: rgba(22,119,255,.35); }
.vsr-text-input { position: absolute; z-index: 2; min-width: 80px; padding: 2px 4px; border: 1px dashed #fff; background: rgba(0,0,0,.35); color: #fff; font: 600 16px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; outline: none; }
.vsr-toolbar-floating { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 12px; background: rgba(24,24,27,.94); color: #fff; box-shadow: 0 16px 48px rgba(0,0,0,.45); backdrop-filter: blur(10px); }
.vsr-toolgroup { display: flex; align-items: center; gap: 3px; }
.vsr-tool { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: #e7e7ea; cursor: pointer; font-size: 14px; }
.vsr-tool:hover { background: rgba(255,255,255,.12); }
.vsr-tool-active { background: rgba(22,119,255,.85); color: #fff; }
.vsr-sep { width: 1px; height: 18px; background: rgba(255,255,255,.18); margin: 0 4px; }
.vsr-swatch { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(255,255,255,.35); cursor: pointer; padding: 0; }
.vsr-swatch-active { outline: 2px solid #fff; outline-offset: 1px; }
.vsr-width-dot { display: inline-block; border-radius: 50%; background: #e7e7ea; }
.vsr-btn-text { border: 0; background: transparent; color: #cfcfd4; cursor: pointer; font: inherit; padding: 0 6px; }
.vsr-btn-text:hover { color: #fff; }
.vsr-btn-primary { border: 0; border-radius: 7px; background: #1677ff; color: #fff; cursor: pointer; font: inherit; padding: 6px 12px; }
.vsr-btn-primary:disabled { opacity: .45; cursor: default; }
/* 浮层工具条上的悬停提示：和工具条一样是深色底，所以提示反色成浅色。 */
.vsr-tip-host { position: relative; display: inline-flex; }
.vsr-tip-host .vsr-tip { bottom: calc(100% + 10px); }
.vsr-tip-host .vsr-tip-body { background: #f6f6f8; color: #1c1c1f; box-shadow: 0 8px 24px rgba(0,0,0,.45); }
.vsr-tip-host .vsr-tip-hint { color: #6b7280; }
.vsr-tip-host .vsr-kbd { border-color: rgba(0,0,0,.18); background: rgba(0,0,0,.06); color: #1c1c1f; }
.vsr-tool-text { font-size: 13px; font-weight: 600; }
.vsr-tool-on { background: rgba(22,119,255,.85); color: #fff; }
.vsr-tool:disabled { opacity: .45; cursor: default; }
/* 取字结果面板：贴在工具条上方，深色、可选中文字。 */
.vsr-text-panel { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); z-index: 2147483100; display: flex; flex-direction: column; width: min(560px, calc(100vw - 32px)); max-height: 38vh; border-radius: 12px; background: rgba(24,24,27,.96); color: #f2f2f4; box-shadow: 0 18px 52px rgba(0,0,0,.5); backdrop-filter: blur(10px); font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; overflow: hidden; }
.vsr-panel-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 12px; border-bottom: 1px solid rgba(255,255,255,.1); font-size: 12px; }
.vsr-panel-meta { color: #9a9aa3; font-size: 11px; }
.vsr-panel-copy { margin-left: auto; border: 0; border-radius: 6px; background: #1677ff; color: #fff; font: inherit; font-size: 12px; padding: 4px 10px; cursor: pointer; }
.vsr-panel-copy:disabled { background: rgba(255,255,255,.12); color: #8e8e97; cursor: default; }
.vsr-panel-x { border: 0; background: transparent; color: #cfcfd4; font-size: 16px; line-height: 1; cursor: pointer; padding: 0 2px; }
.vsr-panel-x:hover { color: #fff; }
.vsr-panel-text { flex: 1; min-height: 44px; overflow: auto; padding: 10px 12px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; user-select: text; cursor: text; outline: none; }
.vsr-panel-text::selection { background: rgba(74,163,255,.45); }
.vsr-panel-status { display: flex; align-items: center; gap: 8px; padding: 14px 12px; font-size: 12px; color: #cfcfd4; }
.vsr-panel-error { color: #ff9a9e; flex-wrap: wrap; }
.vsr-panel-link { border: 0; background: transparent; color: #8fc2ff; font: inherit; font-size: 12px; cursor: pointer; padding: 0; }
.vsr-panel-foot { padding: 6px 12px 8px; border-top: 1px solid rgba(255,255,255,.08); color: #8e8e97; font-size: 11px; }
.vsr-panel-reopen { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); z-index: 2147483100; border: 1px solid rgba(255,255,255,.2); border-radius: 999px; background: rgba(24,24,27,.94); color: #f2f2f4; font: inherit; font-size: 12px; padding: 5px 12px; cursor: pointer; }
.vsr-spinner { width: 12px; height: 12px; border-radius: 50%; border: 2px solid rgba(255,255,255,.25); border-top-color: #4aa3ff; animation: vsr-spin .8s linear infinite; }
@keyframes vsr-spin { to { transform: rotate(360deg); } }
.vsr-progress { position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%); z-index: 2147483001; width: 300px; padding: 18px 20px; border-radius: 14px; background: rgba(24,24,27,.94); color: #fff; box-shadow: 0 24px 80px rgba(0,0,0,.45); backdrop-filter: blur(10px); font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
.vsr-progress-title { font-size: 13px; margin-bottom: 12px; }
.vsr-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,.16); overflow: hidden; }
.vsr-bar-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, #1677ff, #4aa3ff); transition: width .2s ease; }
.vsr-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 2147483002; display: flex; align-items: center; gap: 12px; max-width: min(720px, calc(100vw - 32px)); padding: 10px 14px; border-radius: 10px; background: rgba(24,24,27,.94); color: #fff; font-size: 12px; box-shadow: 0 16px 48px rgba(0,0,0,.4); backdrop-filter: blur(10px); font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
.vsr-toast-error { background: rgba(120,24,32,.96); }
.vsr-toast-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vsr-toast-x { border: 0; background: transparent; color: #fff; opacity: .55; cursor: pointer; font-size: 16px; line-height: 1; }
.vsr-toast-x:hover { opacity: 1; }
.vsr-settings { max-width: 900px; padding: 4px 2px 32px; display: flex; flex-direction: column; gap: 14px; color: var(--dsh-color-text-primary, #1f2329); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
.vsr-settings-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.vsr-settings-head h2 { margin: 0 0 4px; font-size: 18px; font-weight: 600; }
.vsr-card { border: 1px solid var(--dsh-color-border, rgba(0,0,0,.09)); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; background: var(--dsh-color-bg-elevated, #fff); }
.vsr-card h3 { margin: 0; font-size: 13px; font-weight: 600; }
.vsr-storage-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.vsr-grow { flex: 1; min-width: 220px; }
.vsr-input, .vsr-select { height: 32px; padding: 0 10px; border: 1px solid var(--dsh-color-border, rgba(0,0,0,.16)); border-radius: 8px; background: transparent; color: inherit; font: inherit; font-size: 13px; }
.vsr-input[type="number"] { width: 90px; }
.vsr-shortcut-input { width: 170px; cursor: pointer; }
.vsr-btn-outline { border: 1px solid var(--dsh-color-border, rgba(0,0,0,.16)); background: transparent; color: inherit; border-radius: 8px; height: 32px; padding: 0 12px; cursor: pointer; font: inherit; font-size: 12px; }
.vsr-btn-outline:hover { background: var(--dsh-color-fill-quaternary, rgba(0,0,0,.05)); }
.vsr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px 14px; }
.vsr-field { display: flex; flex-direction: column; gap: 5px; font-size: 12px; }
.vsr-field-label { color: var(--dsh-color-text-secondary, #6b7280); }
.vsr-field-note { color: var(--dsh-color-text-tertiary, #8a8f98); font-size: 11px; }
.vsr-checks { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; }
.vsr-path { word-break: break-all; }
.vsr-settings-actions { display: flex; align-items: center; gap: 12px; }
.vsr-settings-link { border: 0; background: transparent; color: var(--dsh-color-accent, #1677ff); cursor: pointer; font: inherit; font-size: 12px; padding: 0; }
.vsr-settings-link:disabled { opacity: .45; cursor: default; }
.vsr-danger { color: #e5484d; }
.vsr-library-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.vsr-library-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.vsr-filter { border: 1px solid var(--dsh-color-border, rgba(0,0,0,.16)); background: transparent; color: inherit; border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 12px; cursor: pointer; }
.vsr-filter-on { border-color: var(--dsh-color-accent, #1677ff); color: var(--dsh-color-accent, #1677ff); background: rgba(22,119,255,.1); }
.vsr-file-list { display: flex; flex-direction: column; gap: 2px; max-height: 340px; overflow: auto; }
.vsr-file-row { display: flex; align-items: center; gap: 10px; padding: 7px 4px; border-bottom: 1px solid var(--dsh-color-border, rgba(0,0,0,.07)); font-size: 12px; }
.vsr-file-kind { flex: none; min-width: 36px; padding: 2px 6px; border-radius: 5px; background: rgba(22,119,255,.12); color: #1677ff; text-align: center; font-size: 11px; }
.vsr-file-kind-image { background: rgba(46,164,79,.14); color: #2ea44f; }
.vsr-file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vsr-file-meta { flex: none; color: var(--dsh-color-text-tertiary, #8a8f98); font-size: 11px; }
.vsr-empty { color: var(--dsh-color-text-tertiary, #8a8f98); font-size: 12px; padding: 12px 0; }
.vsr-convert { display: flex; flex-direction: column; gap: 6px; }
@media (prefers-color-scheme: dark) {
  .vsr-modal { background: #1f2329; color: #e8e9eb; }
  .vsr-modal-foot { border-top-color: rgba(255,255,255,.1); }
}
`

    function installStyles() {
      if (document.getElementById('vyra-screen-recorder-style')) return
      const style = document.createElement('style')
      style.id = 'vyra-screen-recorder-style'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    // ----------------------------------------------------------------- apply
    function apply(ctx) {
      try {
        installStyles()
        void loadClientSettings()
        ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'vyra-screen-recorder.tools',
          order: 10,
        }, Toolbar)), 'vyra-screen-recorder: toolbar')
        ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'vyra-screen-recorder.overlay',
          order: 90,
        }, RootOverlay)), 'vyra-screen-recorder: overlay')
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'vyra-screen-recorder',
          order: 37,
          label: () => L('录屏截图', 'Screen recorder'),
        }, SettingsPage)), 'vyra-screen-recorder: settings')
        ctx.effect(() => ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: 'vyra-screen-recorder',
          order: 37,
        }, SettingsIcon)), 'vyra-screen-recorder: settings icon')
        // 官方插件管理页也给每个 bundle 一个配置插槽；老宿主没有这个插槽时静默跳过。
        try {
          ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
            name: 'plugins.bundle.config',
            key: 'vyra-screen-recorder',
            order: 37,
          }, SettingsPage)), 'vyra-screen-recorder: plugin page settings')
        } catch { /* 老宿主没有插件页配置槽 */ }
        const onShortcut = event => {
          if (event.repeat) return
          const target = event.target
          if (target && typeof target.closest === 'function' && target.closest('input,textarea,select,[contenteditable="true"]')) return
          if (state.picker || state.shot) return
          const settings = state.settings || DEFAULT_SETTINGS
          if (matchesShortcut(event, settings.shortcuts.screenshot)) {
            if (state.phase !== 'idle') return
            event.preventDefault()
            void takeScreenshot()
            return
          }
          if (matchesShortcut(event, settings.shortcuts.record)) {
            if (state.agentRecording) return
            if (state.phase === 'recording') { event.preventDefault(); void stopRecording() }
            else if (state.phase === 'idle') { event.preventDefault(); void openPicker() }
          }
        }
        window.addEventListener('keydown', onShortcut, true)
        ctx.effect(() => () => window.removeEventListener('keydown', onShortcut, true), 'vyra-screen-recorder: shortcuts')
        const onPageHide = () => {
          if (state.phase === 'recording' || state.phase === 'starting') {
            try { navigator.sendBeacon(PREFIX + '/record/discard', '') } catch { /* ignore */ }
          }
        }
        window.addEventListener('pagehide', onPageHide)
        ctx.effect(() => () => window.removeEventListener('pagehide', onPageHide), 'vyra-screen-recorder: pagehide')
        startAgentWatch()
        ctx.effect(() => () => stopAgentWatch(), 'vyra-screen-recorder: agent watch')
        // 插件热更/页面刷新后，宿主可能还挂着上一路录制；主动清掉，避免临时目录泄漏。
        // Agent 队列里的录制不能清：它还要等本页面编码。
        apiJson('/record/status').then(status => {
          if (!status || !status.recording) return null
          return apiJson('/agent/status').then(agent => {
            if (agent && agent.job) return null
            return apiJson('/record/discard', { method: 'POST' })
          })
        }).catch(() => {})
      } catch (error) {
        try { console.warn('[vyra-screen-recorder] apply failed', error) } catch { /* ignore */ }
      }
    }

    exports.apply = apply
    exports.inject = ['slots']
    exports.__test = { getState, setState, attachFile, findComposerFileInput }
    return module.exports
  },
})
