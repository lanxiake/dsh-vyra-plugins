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
      loading: L('正在获取屏幕…', 'Preparing…'),
      retry: L('重试', 'Retry'),
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
    }

    // ------------------------------------------------------------------- store
    let state = {
      phase: 'idle', // idle | picking | starting | recording | encoding
      picker: null,
      shot: null,
      recording: null,
      progress: null,
      toast: null,
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

    async function uploadBlob(blob, name) {
      const response = await fetch(PREFIX + '/record/save?name=' + encodeURIComponent(name), {
        method: 'POST',
        body: blob,
      })
      const text = await response.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
      return data
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

    // ------------------------------------------------------------- recording
    let timerHandle = null
    let pollHandle = null
    let finishing = false

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

    async function openPicker() {
      if (state.phase !== 'idle') return
      setState({ phase: 'picking', picker: { loading: true, error: '' }, toast: null })
      try {
        const sources = await apiJson('/sources')
        let response
        try { response = await fetch(PREFIX + '/shot', { cache: 'no-store' }) } catch { throw new Error(S.noRoute) }
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const image = await loadImage(url)
        setState({
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
        setState({ picker: { loading: false, error: friendly(error) } })
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
            fps: 8,
            quality: 65,
            maxEdge: 1920,
            maxSeconds: 600,
            includeSystemAudio: value.includeSystemAudio !== false,
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
        const encoded = await encodeRecording(manifest, micBlob, recording)
        const name = encoded.name
        const file = new File([encoded.blob], name, { type: 'video/webm' })
        const attached = attachFile(file)
        setState({ progress: { stage: L('正在保存…', 'Saving…'), ratio: 0.97 } })
        let saved = null
        try {
          saved = await uploadBlob(encoded.blob, name)
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

    async function takeScreenshot() {
      if (state.phase !== 'idle') return
      setState({ phase: 'starting', progress: { stage: L('正在截图…', 'Capturing…'), ratio: 0.2 }, toast: null })
      try {
        let response
        try { response = await fetch(PREFIX + '/shot', { cache: 'no-store' }) } catch { throw new Error(S.noRoute) }
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const image = await loadImage(url)
        setState({
          phase: 'idle',
          progress: null,
          shot: { mode: 'shot', url, imageW: image.naturalWidth, imageH: image.naturalHeight, virtual: null, options: null },
        })
      } catch (error) {
        setState({ phase: 'idle', progress: null })
        toast(L('截图失败：', 'Screenshot failed: ') + friendly(error), { kind: 'error' })
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
    function pickVideoCodec(width, height, fps) {
      const bitrate = Math.min(8000000, Math.max(1500000, Math.round(width * height * fps * 0.1)))
      return (async () => {
        if (typeof VideoEncoder === 'undefined') throw new Error(L('当前环境不支持 WebCodecs', 'WebCodecs unavailable'))
        const candidates = [
          { webm: 'V_VP9', codec: 'vp09.00.10.08' },
          { webm: 'V_VP8', codec: 'vp8' },
        ]
        for (const candidate of candidates) {
          try {
            const support = await VideoEncoder.isConfigSupported({
              codec: candidate.codec, width, height, bitrate, framerate: fps,
            })
            if (support && support.supported) return { ...candidate, config: support.config || { codec: candidate.codec, width, height, bitrate, framerate: fps }, bitrate }
          } catch { /* try next */ }
        }
        throw new Error(L('没有可用的视频编码器', 'No video encoder available'))
      })()
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

    async function encodeRecording(manifest, micBlob, recording) {
      const frames = manifest.frames || []
      if (frames.length === 0) throw new Error(S.noFrames)
      const width = manifest.width || 1280
      const height = manifest.height || 720
      const fps = manifest.fps || 8
      setState({ progress: { stage: L('正在混音…', 'Mixing audio…'), ratio: 0.05 } })
      const mixed = await mixAudio(manifest, micBlob, recording)
      const videoCodec = await pickVideoCodec(width, height, fps)
      const target = new WebMMuxer.ArrayBufferTarget()
      const muxer = new WebMMuxer.Muxer({
        target,
        video: { codec: videoCodec.webm, width, height, frameRate: fps },
        ...(mixed ? { audio: { codec: 'A_OPUS', sampleRate: 48000, numberOfChannels: 2 } } : {}),
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

      if (mixed) {
        setState({ progress: { stage: L('正在编码声音…', 'Encoding audio…'), ratio: 0.84 } })
        let audioError = null
        const audioEncoder = new AudioEncoder({
          output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta) } catch (error) { audioError = error } },
          error: error => { audioError = error },
        })
        audioEncoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 })
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
      return {
        blob: new Blob([target.buffer], { type: 'video/webm' }),
        name: '录屏-' + stamp() + '.webm',
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
      try { saved = await uploadBlob(blob, name) } catch { /* 保存失败时仍以附件为准 */ }
      toast(
        attached
          ? L('截图已挂进输入框', 'Screenshot attached')
          : (saved ? L('截图已保存', 'Screenshot saved') : L('截图没能保存', 'Screenshot not saved')),
        { kind: attached || saved ? 'success' : 'error', path: saved ? saved.file : '', dir: saved ? saved.dir : '' },
      )
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
      const busy = snapshot.phase === 'starting' || snapshot.phase === 'encoding'
      const isRecording = snapshot.phase === 'recording'
      return h('div', { className: 'vsr-toolbar' },
        h('button', {
          type: 'button',
          className: 'vsr-btn' + (isRecording ? ' vsr-btn-rec' : ''),
          disabled: busy,
          title: isRecording ? S.stop : S.record,
          'aria-label': isRecording ? S.stop : S.record,
          onMouseDown: event => event.preventDefault(),
          onClick: () => { if (isRecording) void stopRecording(); else void openPicker() },
        }, isRecording
          ? h('span', { className: 'vsr-rec-pill' }, h('span', { className: 'vsr-dot' }), formatDuration(seconds), iconStop())
          : iconRecord()),
        h('button', {
          type: 'button',
          className: 'vsr-btn',
          disabled: busy || isRecording,
          title: S.screenshot,
          'aria-label': S.screenshot,
          onMouseDown: event => event.preventDefault(),
          onClick: () => { void takeScreenshot() },
        }, iconCamera()),
        props && props.sessionId ? null : null,
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
      const [systemAudio, setSystemAudio] = useState(true)
      const [microphone, setMicrophone] = useState(true)
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

      if (picker.loading) {
        return h('div', { className: 'vsr-overlay' }, h('div', { className: 'vsr-modal vsr-modal-loading' },
          h('div', { className: 'vsr-spinner' }), h('div', { className: 'vsr-muted' }, S.loading)))
      }
      if (picker.error) {
        return h('div', { className: 'vsr-overlay' }, h('div', { className: 'vsr-modal vsr-modal-narrow' },
          h('div', { className: 'vsr-modal-head' }, h('strong', null, S.pickerTitle), h('button', { type: 'button', className: 'vsr-x', onClick: closePicker, 'aria-label': S.close }, '×')),
          h('div', { className: 'vsr-error' }, picker.error),
          h('div', { className: 'vsr-modal-foot' },
            h('button', { type: 'button', className: 'vsr-link', onClick: () => { closePicker(); void openPicker() } }, S.retry),
            h('button', { type: 'button', className: 'vsr-link', onClick: closePicker }, S.close))))
      }

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
            h('span', { className: 'vsr-hint' }, S.hint))))
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
      }, [sel, strokes, draft, disp, phase, tool, color, lineWidth, viewport])

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

      function exportShot() {
        if (!sel) return
        const image = new Image()
        image.onload = () => {
          const scaleX = imageW / disp.w
          const scaleY = imageH / disp.h
          const sx = sel.x * scaleX
          const sy = sel.y * scaleY
          const sw = Math.max(1, sel.w * scaleX)
          const sh = Math.max(1, sel.h * scaleY)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(sw)
          canvas.height = Math.round(sh)
          const ctx = canvas.getContext('2d')
          ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
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
          canvas.toBlob(blob => {
            closeShot()
            if (blob) void saveScreenshot(blob, '截图-' + stamp() + '.jpg')
          }, 'image/jpeg', 0.9)
        }
        image.src = shot.url
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
        const onKey = event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            if (textInput) { setTextInput(null); return }
            closeShot()
          } else if (event.key === 'Enter' && !textInput) {
            event.preventDefault()
            confirmCurrent()
          } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault()
            setStrokes(current => current.slice(0, -1))
          }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      })

      const colors = ['#e5484d', '#f5a623', '#2ea44f', '#1677ff', '#ffffff', '#111111']
      return h('div', { className: 'vsr-overlay vsr-overlay-shot' },
        h('div', { className: 'vsr-shot-stage' },
          h('div', { ref: wrapRef, className: 'vsr-shot-wrap', style: { width: disp.w, height: disp.h }, onMouseDown: onDown, onMouseMove: onMove, onMouseUp: onUp, onMouseLeave: onUp },
            h('img', { src: shot.url, className: 'vsr-shot-image', draggable: false, width: disp.w, height: disp.h, alt: '' }),
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
          h('div', { className: 'vsr-shot-topbar' }, isRegion ? S.regionHint : S.shotHint),
          phase === 'annotate' && !isRegion ? h('div', { className: 'vsr-toolbar-floating' },
            h('div', { className: 'vsr-toolgroup' },
              ...[['pen', '✎', S.pen], ['rect', '▭', S.rect], ['arrow', '↗', S.arrow], ['text', 'T', S.text]].map(([key, glyph, label]) =>
                h('button', { key, type: 'button', className: 'vsr-tool' + (tool === key ? ' vsr-tool-active' : ''), title: label, onClick: () => setTool(key) }, glyph)),
              h('span', { className: 'vsr-sep' }),
              ...colors.map(value => h('button', { key: value, type: 'button', className: 'vsr-swatch' + (color === value ? ' vsr-swatch-active' : ''), style: { background: value }, title: value, onClick: () => setColor(value) })),
              h('span', { className: 'vsr-sep' }),
              ...[2, 3, 5].map(value => h('button', { key: value, type: 'button', className: 'vsr-tool' + (lineWidth === value ? ' vsr-tool-active' : ''), title: String(value), onClick: () => setLineWidth(value) }, h('span', { className: 'vsr-width-dot', style: { width: value + 2, height: value + 2 } }))),
              h('span', { className: 'vsr-sep' }),
              h('button', { type: 'button', className: 'vsr-tool', title: S.reselect, onClick: () => { setPhase('select'); setSel(null) } }, '⟲'),
              h('button', { type: 'button', className: 'vsr-tool', title: S.undo, onClick: () => setStrokes(current => current.slice(0, -1)) }, '↶'),
              h('button', { type: 'button', className: 'vsr-tool', title: S.clear, onClick: () => setStrokes([]) }, '🗑')),
            h('div', { className: 'vsr-toolgroup' },
              h('button', { type: 'button', className: 'vsr-btn-text', onClick: closeShot }, S.cancel),
              h('button', { type: 'button', className: 'vsr-btn-primary', onClick: confirmCurrent }, S.useShot))) : null,
          phase === 'select' && isRegion ? h('div', { className: 'vsr-toolbar-floating' },
            h('div', { className: 'vsr-toolgroup' },
              h('button', { type: 'button', className: 'vsr-btn-text', onClick: closeShot }, S.cancel),
              h('button', { type: 'button', className: 'vsr-btn-primary', disabled: !sel, onClick: confirmCurrent }, S.recordRegion))) : null))
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
      if (snapshot.phase === 'starting') children.push(h(ProgressCard, { key: 'start', stage: S.preparing, ratio: 0.2 }))
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
.vsr-rec-pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px; border-radius: 12px; background: rgba(229,72,77,.12); color: #e5484d; font-size: 12px; font-variant-numeric: tabular-nums; }
.vsr-rec-pill-floating { position: fixed; top: 18px; left: 50%; transform: translateX(-50%); z-index: 2147483001; height: 32px; padding: 0 12px; gap: 8px; background: rgba(20,20,22,.88); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.35); backdrop-filter: blur(8px); }
.vsr-dot { width: 8px; height: 8px; border-radius: 50%; background: #e5484d; box-shadow: 0 0 0 0 rgba(229,72,77,.6); animation: vsr-pulse 1.4s infinite; }
@keyframes vsr-pulse { 0% { box-shadow: 0 0 0 0 rgba(229,72,77,.6); } 70% { box-shadow: 0 0 0 7px rgba(229,72,77,0); } 100% { box-shadow: 0 0 0 0 rgba(229,72,77,0); } }
.vsr-overlay { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.55); backdrop-filter: blur(3px); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
.vsr-modal { width: 420px; max-width: calc(100vw - 32px); max-height: 82vh; display: flex; flex-direction: column; background: var(--dsh-color-bg-elevated, #fff); color: var(--dsh-color-text-primary, #1f2329); border-radius: 14px; box-shadow: 0 24px 80px rgba(0,0,0,.38); overflow: hidden; }
.vsr-modal-loading { width: auto; min-width: 180px; padding: 22px 26px; align-items: center; gap: 12px; }
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
.vsr-spinner { width: 24px; height: 24px; border-radius: 50%; border: 2px solid rgba(127,127,127,.25); border-top-color: var(--dsh-color-accent, #1677ff); animation: vsr-spin .8s linear infinite; }
@keyframes vsr-spin { to { transform: rotate(360deg); } }
.vsr-muted { color: var(--dsh-color-text-tertiary, #8a8f98); font-size: 13px; }
.vsr-overlay-shot { background: rgba(0,0,0,.62); }
.vsr-shot-stage { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.vsr-shot-wrap { position: relative; cursor: crosshair; box-shadow: 0 20px 70px rgba(0,0,0,.45); border-radius: 2px; overflow: hidden; }
.vsr-shot-image { display: block; user-select: none; pointer-events: none; }
.vsr-shot-canvas { position: absolute; inset: 0; }
.vsr-shot-topbar { color: #fff; font-size: 12px; opacity: .85; }
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
.vsr-progress { position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%); z-index: 2147483001; width: 300px; padding: 18px 20px; border-radius: 14px; background: rgba(24,24,27,.94); color: #fff; box-shadow: 0 24px 80px rgba(0,0,0,.45); backdrop-filter: blur(10px); font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
.vsr-progress-title { font-size: 13px; margin-bottom: 12px; }
.vsr-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,.16); overflow: hidden; }
.vsr-bar-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, #1677ff, #4aa3ff); transition: width .2s ease; }
.vsr-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 2147483002; display: flex; align-items: center; gap: 12px; max-width: min(720px, calc(100vw - 32px)); padding: 10px 14px; border-radius: 10px; background: rgba(24,24,27,.94); color: #fff; font-size: 12px; box-shadow: 0 16px 48px rgba(0,0,0,.4); backdrop-filter: blur(10px); font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
.vsr-toast-error { background: rgba(120,24,32,.96); }
.vsr-toast-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vsr-toast-x { border: 0; background: transparent; color: #fff; opacity: .55; cursor: pointer; font-size: 16px; line-height: 1; }
.vsr-toast-x:hover { opacity: 1; }
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
        const onPageHide = () => {
          if (state.phase === 'recording' || state.phase === 'starting') {
            try { navigator.sendBeacon(PREFIX + '/record/discard', '') } catch { /* ignore */ }
          }
        }
        window.addEventListener('pagehide', onPageHide)
        ctx.effect(() => () => window.removeEventListener('pagehide', onPageHide), 'vyra-screen-recorder: pagehide')
        // 插件热更/页面刷新后，宿主可能还挂着上一路录制；主动清掉，避免临时目录泄漏。
        apiJson('/record/status').then(status => {
          if (status && status.recording) return apiJson('/record/discard', { method: 'POST' })
          return null
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
