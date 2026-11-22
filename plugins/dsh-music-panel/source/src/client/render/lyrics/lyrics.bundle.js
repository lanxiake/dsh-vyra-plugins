var MPFoliaLyrics = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
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
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/conventions.js
  var require_conventions = __commonJS({
    "node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/conventions.js"(exports) {
      "use strict";
      function find(list, predicate, ac) {
        if (ac === void 0) {
          ac = Array.prototype;
        }
        if (list && typeof ac.find === "function") {
          return ac.find.call(list, predicate);
        }
        for (var i = 0; i < list.length; i++) {
          if (hasOwn(list, i)) {
            var item = list[i];
            if (predicate.call(void 0, item, i, list)) {
              return item;
            }
          }
        }
      }
      function freeze(object, oc) {
        if (oc === void 0) {
          oc = Object;
        }
        if (oc && typeof oc.getOwnPropertyDescriptors === "function") {
          object = oc.create(null, oc.getOwnPropertyDescriptors(object));
        }
        return oc && typeof oc.freeze === "function" ? oc.freeze(object) : object;
      }
      function hasOwn(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
      }
      function assign(target, source) {
        if (target === null || typeof target !== "object") {
          throw new TypeError("target is not an object");
        }
        for (var key in source) {
          if (hasOwn(source, key)) {
            target[key] = source[key];
          }
        }
        return target;
      }
      var HTML_BOOLEAN_ATTRIBUTES = freeze({
        allowfullscreen: true,
        async: true,
        autofocus: true,
        autoplay: true,
        checked: true,
        controls: true,
        default: true,
        defer: true,
        disabled: true,
        formnovalidate: true,
        hidden: true,
        ismap: true,
        itemscope: true,
        loop: true,
        multiple: true,
        muted: true,
        nomodule: true,
        novalidate: true,
        open: true,
        playsinline: true,
        readonly: true,
        required: true,
        reversed: true,
        selected: true
      });
      function isHTMLBooleanAttribute(name) {
        return hasOwn(HTML_BOOLEAN_ATTRIBUTES, name.toLowerCase());
      }
      var HTML_VOID_ELEMENTS = freeze({
        area: true,
        base: true,
        br: true,
        col: true,
        embed: true,
        hr: true,
        img: true,
        input: true,
        link: true,
        meta: true,
        param: true,
        source: true,
        track: true,
        wbr: true
      });
      function isHTMLVoidElement(tagName) {
        return hasOwn(HTML_VOID_ELEMENTS, tagName.toLowerCase());
      }
      var HTML_RAW_TEXT_ELEMENTS = freeze({
        script: false,
        style: false,
        textarea: true,
        title: true
      });
      function isHTMLRawTextElement(tagName) {
        var key = tagName.toLowerCase();
        return hasOwn(HTML_RAW_TEXT_ELEMENTS, key) && !HTML_RAW_TEXT_ELEMENTS[key];
      }
      function isHTMLEscapableRawTextElement(tagName) {
        var key = tagName.toLowerCase();
        return hasOwn(HTML_RAW_TEXT_ELEMENTS, key) && HTML_RAW_TEXT_ELEMENTS[key];
      }
      function isHTMLMimeType(mimeType) {
        return mimeType === MIME_TYPE.HTML;
      }
      function hasDefaultHTMLNamespace(mimeType) {
        return isHTMLMimeType(mimeType) || mimeType === MIME_TYPE.XML_XHTML_APPLICATION;
      }
      var MIME_TYPE = freeze({
        /**
         * `text/html`, the only mime type that triggers treating an XML document as HTML.
         *
         * @see https://www.iana.org/assignments/media-types/text/html IANA MimeType registration
         * @see https://en.wikipedia.org/wiki/HTML Wikipedia
         * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString MDN
         * @see https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#dom-domparser-parsefromstring
         *      WHATWG HTML Spec
         */
        HTML: "text/html",
        /**
         * `application/xml`, the standard mime type for XML documents.
         *
         * @see https://www.iana.org/assignments/media-types/application/xml IANA MimeType
         *      registration
         * @see https://tools.ietf.org/html/rfc7303#section-9.1 RFC 7303
         * @see https://en.wikipedia.org/wiki/XML_and_MIME Wikipedia
         */
        XML_APPLICATION: "application/xml",
        /**
         * `text/xml`, an alias for `application/xml`.
         *
         * @see https://tools.ietf.org/html/rfc7303#section-9.2 RFC 7303
         * @see https://www.iana.org/assignments/media-types/text/xml IANA MimeType registration
         * @see https://en.wikipedia.org/wiki/XML_and_MIME Wikipedia
         */
        XML_TEXT: "text/xml",
        /**
         * `application/xhtml+xml`, indicates an XML document that has the default HTML namespace,
         * but is parsed as an XML document.
         *
         * @see https://www.iana.org/assignments/media-types/application/xhtml+xml IANA MimeType
         *      registration
         * @see https://dom.spec.whatwg.org/#dom-domimplementation-createdocument WHATWG DOM Spec
         * @see https://en.wikipedia.org/wiki/XHTML Wikipedia
         */
        XML_XHTML_APPLICATION: "application/xhtml+xml",
        /**
         * `image/svg+xml`,
         *
         * @see https://www.iana.org/assignments/media-types/image/svg+xml IANA MimeType registration
         * @see https://www.w3.org/TR/SVG11/ W3C SVG 1.1
         * @see https://en.wikipedia.org/wiki/Scalable_Vector_Graphics Wikipedia
         */
        XML_SVG_IMAGE: "image/svg+xml"
      });
      var _MIME_TYPES = Object.keys(MIME_TYPE).map(function(key) {
        return MIME_TYPE[key];
      });
      function isValidMimeType(mimeType) {
        return _MIME_TYPES.indexOf(mimeType) > -1;
      }
      var NAMESPACE = freeze({
        /**
         * The XHTML namespace.
         *
         * @see http://www.w3.org/1999/xhtml
         */
        HTML: "http://www.w3.org/1999/xhtml",
        /**
         * The SVG namespace.
         *
         * @see http://www.w3.org/2000/svg
         */
        SVG: "http://www.w3.org/2000/svg",
        /**
         * The `xml:` namespace.
         *
         * @see http://www.w3.org/XML/1998/namespace
         */
        XML: "http://www.w3.org/XML/1998/namespace",
        /**
         * The `xmlns:` namespace.
         *
         * @see https://www.w3.org/2000/xmlns/
         */
        XMLNS: "http://www.w3.org/2000/xmlns/"
      });
      exports.assign = assign;
      exports.find = find;
      exports.freeze = freeze;
      exports.HTML_BOOLEAN_ATTRIBUTES = HTML_BOOLEAN_ATTRIBUTES;
      exports.HTML_RAW_TEXT_ELEMENTS = HTML_RAW_TEXT_ELEMENTS;
      exports.HTML_VOID_ELEMENTS = HTML_VOID_ELEMENTS;
      exports.hasDefaultHTMLNamespace = hasDefaultHTMLNamespace;
      exports.hasOwn = hasOwn;
      exports.isHTMLBooleanAttribute = isHTMLBooleanAttribute;
      exports.isHTMLRawTextElement = isHTMLRawTextElement;
      exports.isHTMLEscapableRawTextElement = isHTMLEscapableRawTextElement;
      exports.isHTMLMimeType = isHTMLMimeType;
      exports.isHTMLVoidElement = isHTMLVoidElement;
      exports.isValidMimeType = isValidMimeType;
      exports.MIME_TYPE = MIME_TYPE;
      exports.NAMESPACE = NAMESPACE;
    }
  });

  // node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/errors.js
  var require_errors = __commonJS({
    "node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/errors.js"(exports) {
      "use strict";
      var conventions = require_conventions();
      function extendError(constructor, writableName) {
        constructor.prototype = Object.create(Error.prototype, {
          constructor: { value: constructor },
          name: { value: constructor.name, enumerable: true, writable: writableName }
        });
      }
      var DOMExceptionName = conventions.freeze({
        /**
         * the default value as defined by the spec
         */
        Error: "Error",
        /**
         * @deprecated
         * Use RangeError instead.
         */
        IndexSizeError: "IndexSizeError",
        /**
         * @deprecated
         * Just to match the related static code, not part of the spec.
         */
        DomstringSizeError: "DomstringSizeError",
        HierarchyRequestError: "HierarchyRequestError",
        WrongDocumentError: "WrongDocumentError",
        InvalidCharacterError: "InvalidCharacterError",
        /**
         * @deprecated
         * Just to match the related static code, not part of the spec.
         */
        NoDataAllowedError: "NoDataAllowedError",
        NoModificationAllowedError: "NoModificationAllowedError",
        NotFoundError: "NotFoundError",
        NotSupportedError: "NotSupportedError",
        InUseAttributeError: "InUseAttributeError",
        InvalidStateError: "InvalidStateError",
        SyntaxError: "SyntaxError",
        InvalidModificationError: "InvalidModificationError",
        NamespaceError: "NamespaceError",
        /**
         * @deprecated
         * Use TypeError for invalid arguments,
         * "NotSupportedError" DOMException for unsupported operations,
         * and "NotAllowedError" DOMException for denied requests instead.
         */
        InvalidAccessError: "InvalidAccessError",
        /**
         * @deprecated
         * Just to match the related static code, not part of the spec.
         */
        ValidationError: "ValidationError",
        /**
         * @deprecated
         * Use TypeError instead.
         */
        TypeMismatchError: "TypeMismatchError",
        SecurityError: "SecurityError",
        NetworkError: "NetworkError",
        AbortError: "AbortError",
        /**
         * @deprecated
         * Just to match the related static code, not part of the spec.
         */
        URLMismatchError: "URLMismatchError",
        QuotaExceededError: "QuotaExceededError",
        TimeoutError: "TimeoutError",
        InvalidNodeTypeError: "InvalidNodeTypeError",
        DataCloneError: "DataCloneError",
        EncodingError: "EncodingError",
        NotReadableError: "NotReadableError",
        UnknownError: "UnknownError",
        ConstraintError: "ConstraintError",
        DataError: "DataError",
        TransactionInactiveError: "TransactionInactiveError",
        ReadOnlyError: "ReadOnlyError",
        VersionError: "VersionError",
        OperationError: "OperationError",
        NotAllowedError: "NotAllowedError",
        OptOutError: "OptOutError"
      });
      var DOMExceptionNames = Object.keys(DOMExceptionName);
      function isValidDomExceptionCode(value) {
        return typeof value === "number" && value >= 1 && value <= 25;
      }
      function endsWithError(value) {
        return typeof value === "string" && value.substring(value.length - DOMExceptionName.Error.length) === DOMExceptionName.Error;
      }
      function DOMException(messageOrCode, nameOrMessage) {
        if (isValidDomExceptionCode(messageOrCode)) {
          this.name = DOMExceptionNames[messageOrCode];
          this.message = nameOrMessage || "";
        } else {
          this.message = messageOrCode;
          this.name = endsWithError(nameOrMessage) ? nameOrMessage : DOMExceptionName.Error;
        }
        if (Error.captureStackTrace) Error.captureStackTrace(this, DOMException);
      }
      extendError(DOMException, true);
      Object.defineProperties(DOMException.prototype, {
        code: {
          enumerable: true,
          get: function() {
            var code = DOMExceptionNames.indexOf(this.name);
            if (isValidDomExceptionCode(code)) return code;
            return 0;
          }
        }
      });
      var ExceptionCode = {
        INDEX_SIZE_ERR: 1,
        DOMSTRING_SIZE_ERR: 2,
        HIERARCHY_REQUEST_ERR: 3,
        WRONG_DOCUMENT_ERR: 4,
        INVALID_CHARACTER_ERR: 5,
        NO_DATA_ALLOWED_ERR: 6,
        NO_MODIFICATION_ALLOWED_ERR: 7,
        NOT_FOUND_ERR: 8,
        NOT_SUPPORTED_ERR: 9,
        INUSE_ATTRIBUTE_ERR: 10,
        INVALID_STATE_ERR: 11,
        SYNTAX_ERR: 12,
        INVALID_MODIFICATION_ERR: 13,
        NAMESPACE_ERR: 14,
        INVALID_ACCESS_ERR: 15,
        VALIDATION_ERR: 16,
        TYPE_MISMATCH_ERR: 17,
        SECURITY_ERR: 18,
        NETWORK_ERR: 19,
        ABORT_ERR: 20,
        URL_MISMATCH_ERR: 21,
        QUOTA_EXCEEDED_ERR: 22,
        TIMEOUT_ERR: 23,
        INVALID_NODE_TYPE_ERR: 24,
        DATA_CLONE_ERR: 25
      };
      var entries = Object.entries(ExceptionCode);
      for (i = 0; i < entries.length; i++) {
        key = entries[i][0];
        DOMException[key] = entries[i][1];
      }
      var key;
      var i;
      function ParseError(message, locator, cause) {
        this.message = message;
        this.locator = locator;
        this.cause = cause;
        if (Error.captureStackTrace) Error.captureStackTrace(this, ParseError);
      }
      extendError(ParseError);
      exports.DOMException = DOMException;
      exports.DOMExceptionName = DOMExceptionName;
      exports.ExceptionCode = ExceptionCode;
      exports.ParseError = ParseError;
    }
  });

  // node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/grammar.js
  var require_grammar = __commonJS({
    "node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/grammar.js"(exports) {
      "use strict";
      function detectUnicodeSupport(RegExpImpl) {
        try {
          if (typeof RegExpImpl !== "function") {
            RegExpImpl = RegExp;
          }
          var match = new RegExpImpl("\u{1D306}", "u").exec("\u{1D306}");
          return !!match && match[0].length === 2;
        } catch (error) {
        }
        return false;
      }
      var UNICODE_SUPPORT = detectUnicodeSupport();
      function chars(regexp) {
        if (regexp.source[0] !== "[") {
          throw new Error(regexp + " can not be used with chars");
        }
        return regexp.source.slice(1, regexp.source.lastIndexOf("]"));
      }
      function chars_without(regexp, search) {
        if (regexp.source[0] !== "[") {
          throw new Error("/" + regexp.source + "/ can not be used with chars_without");
        }
        if (!search || typeof search !== "string") {
          throw new Error(JSON.stringify(search) + " is not a valid search");
        }
        if (regexp.source.indexOf(search) === -1) {
          throw new Error('"' + search + '" is not is /' + regexp.source + "/");
        }
        if (search === "-" && regexp.source.indexOf(search) !== 1) {
          throw new Error('"' + search + '" is not at the first postion of /' + regexp.source + "/");
        }
        return new RegExp(regexp.source.replace(search, ""), UNICODE_SUPPORT ? "u" : "");
      }
      function reg(args) {
        var self = this;
        return new RegExp(
          Array.prototype.slice.call(arguments).map(function(part) {
            var isStr = typeof part === "string";
            if (isStr && self === void 0 && part === "|") {
              throw new Error("use regg instead of reg to wrap expressions with `|`!");
            }
            return isStr ? part : part.source;
          }).join(""),
          UNICODE_SUPPORT ? "u" : ""
        );
      }
      function regg(args) {
        if (arguments.length === 0) {
          throw new Error("no parameters provided");
        }
        return reg.apply(regg, ["(?:"].concat(Array.prototype.slice.call(arguments), [")"]));
      }
      var UNICODE_REPLACEMENT_CHARACTER = "\uFFFD";
      var Char = /[-\x09\x0A\x0D\x20-\x2C\x2E-\uD7FF\uE000-\uFFFD]/;
      if (UNICODE_SUPPORT) {
        Char = reg("[", chars(Char), "\\u{10000}-\\u{10FFFF}", "]");
      }
      var InvalidChar = new RegExp("[^" + chars(Char) + "]", UNICODE_SUPPORT ? "u" : "");
      var _SChar = /[\x20\x09\x0D\x0A]/;
      var SChar_s = chars(_SChar);
      var S2 = reg(_SChar, "+");
      var S_OPT = reg(_SChar, "*");
      var NameStartChar = /[:_a-zA-Z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
      if (UNICODE_SUPPORT) {
        NameStartChar = reg("[", chars(NameStartChar), "\\u{10000}-\\u{10FFFF}", "]");
      }
      var NameStartChar_s = chars(NameStartChar);
      var NameChar = reg("[", NameStartChar_s, chars(/[-.0-9\xB7]/), chars(/[\u0300-\u036F\u203F-\u2040]/), "]");
      var Name = reg(NameStartChar, NameChar, "*");
      var Name_exact = reg("^", Name, "$");
      var Nmtoken = reg(NameChar, "+");
      var EntityRef = reg("&", Name, ";");
      var CharRef = regg(/&#[0-9]+;|&#x[0-9a-fA-F]+;/);
      var Reference = regg(EntityRef, "|", CharRef);
      var PEReference = reg("%", Name, ";");
      var EntityValue = regg(
        reg('"', regg(/[^%&"]/, "|", PEReference, "|", Reference), "*", '"'),
        "|",
        reg("'", regg(/[^%&']/, "|", PEReference, "|", Reference), "*", "'")
      );
      var AttValue = regg('"', regg(/[^<&"]/, "|", Reference), "*", '"', "|", "'", regg(/[^<&']/, "|", Reference), "*", "'");
      var NCNameStartChar = chars_without(NameStartChar, ":");
      var NCNameChar = chars_without(NameChar, ":");
      var NCName = reg(NCNameStartChar, NCNameChar, "*");
      var NCName_exact = reg("^", NCName, "$");
      var QName = reg(NCName, regg(":", NCName), "?");
      var QName_exact = reg("^", QName, "$");
      var QName_group = reg("(", QName, ")");
      var SystemLiteral = regg(/"[^"]*"|'[^']*'/);
      var PI = reg(/^<\?/, "(", Name, ")", regg(S2, "(?!", _SChar, ")(", Char, "*?)"), "?", /\?>/);
      var PubidChar = /[\x20\x0D\x0Aa-zA-Z0-9-'()+,./:=?;!*#@$_%]/;
      var PubidLiteral = regg('"', PubidChar, '*"', "|", "'", chars_without(PubidChar, "'"), "*'");
      var COMMENT_START = "<!--";
      var COMMENT_END = "-->";
      var Comment = reg(COMMENT_START, regg(chars_without(Char, "-"), "|", reg("-", chars_without(Char, "-"))), "*", COMMENT_END);
      var PCDATA = "#PCDATA";
      var Mixed = regg(
        reg(/\(/, S_OPT, PCDATA, regg(S_OPT, /\|/, S_OPT, QName), "*", S_OPT, /\)\*/),
        "|",
        reg(/\(/, S_OPT, PCDATA, S_OPT, /\)/)
      );
      var _children_quantity = /[?*+]?/;
      var children = reg(
        /\([^>]+\)/,
        _children_quantity
        /*regg(choice, '|', seq), _children_quantity*/
      );
      var contentspec = regg("EMPTY", "|", "ANY", "|", Mixed, "|", children);
      var ELEMENTDECL_START = "<!ELEMENT";
      var elementdecl = reg(ELEMENTDECL_START, S2, regg(QName, "|", PEReference), S2, regg(contentspec, "|", PEReference), S_OPT, ">");
      var NotationType = reg("NOTATION", S2, /\(/, S_OPT, Name, regg(S_OPT, /\|/, S_OPT, Name), "*", S_OPT, /\)/);
      var Enumeration = reg(/\(/, S_OPT, Nmtoken, regg(S_OPT, /\|/, S_OPT, Nmtoken), "*", S_OPT, /\)/);
      var EnumeratedType = regg(NotationType, "|", Enumeration);
      var AttType = regg(/CDATA|ID|IDREF|IDREFS|ENTITY|ENTITIES|NMTOKEN|NMTOKENS/, "|", EnumeratedType);
      var DefaultDecl = regg(/#REQUIRED|#IMPLIED/, "|", regg(regg("#FIXED", S2), "?", AttValue));
      var AttDef = regg(S2, Name, S2, AttType, S2, DefaultDecl);
      var ATTLIST_DECL_START = "<!ATTLIST";
      var AttlistDecl = reg(ATTLIST_DECL_START, S2, Name, AttDef, "*", S_OPT, ">");
      var ABOUT_LEGACY_COMPAT = "about:legacy-compat";
      var ABOUT_LEGACY_COMPAT_SystemLiteral = regg('"' + ABOUT_LEGACY_COMPAT + '"', "|", "'" + ABOUT_LEGACY_COMPAT + "'");
      var SYSTEM = "SYSTEM";
      var PUBLIC = "PUBLIC";
      var ExternalID = regg(regg(SYSTEM, S2, SystemLiteral), "|", regg(PUBLIC, S2, PubidLiteral, S2, SystemLiteral));
      var ExternalID_match = reg(
        "^",
        regg(
          regg(SYSTEM, S2, "(?<SystemLiteralOnly>", SystemLiteral, ")"),
          "|",
          regg(PUBLIC, S2, "(?<PubidLiteral>", PubidLiteral, ")", S2, "(?<SystemLiteral>", SystemLiteral, ")")
        )
      );
      var PubidLiteral_match = reg("^", PubidLiteral, "$");
      var SystemLiteral_match = reg("^", SystemLiteral, "$");
      var NDataDecl = regg(S2, "NDATA", S2, Name);
      var EntityDef = regg(EntityValue, "|", regg(ExternalID, NDataDecl, "?"));
      var ENTITY_DECL_START = "<!ENTITY";
      var GEDecl = reg(ENTITY_DECL_START, S2, Name, S2, EntityDef, S_OPT, ">");
      var PEDef = regg(EntityValue, "|", ExternalID);
      var PEDecl = reg(ENTITY_DECL_START, S2, "%", S2, Name, S2, PEDef, S_OPT, ">");
      var EntityDecl = regg(GEDecl, "|", PEDecl);
      var PublicID = reg(PUBLIC, S2, PubidLiteral);
      var NotationDecl = reg("<!NOTATION", S2, Name, S2, regg(ExternalID, "|", PublicID), S_OPT, ">");
      var Eq = reg(S_OPT, "=", S_OPT);
      var VersionNum = /1[.]\d+/;
      var VersionInfo = reg(S2, "version", Eq, regg("'", VersionNum, "'", "|", '"', VersionNum, '"'));
      var EncName = /[A-Za-z][-A-Za-z0-9._]*/;
      var EncodingDecl = regg(S2, "encoding", Eq, regg('"', EncName, '"', "|", "'", EncName, "'"));
      var SDDecl = regg(S2, "standalone", Eq, regg("'", regg("yes", "|", "no"), "'", "|", '"', regg("yes", "|", "no"), '"'));
      var XMLDecl = reg(/^<\?xml/, VersionInfo, EncodingDecl, "?", SDDecl, "?", S_OPT, /\?>/);
      var DOCTYPE_DECL_START = "<!DOCTYPE";
      var CDATA_START = "<![CDATA[";
      var CDATA_END = "]]>";
      var CDStart = /<!\[CDATA\[/;
      var CDEnd = /\]\]>/;
      var CData = reg(Char, "*?", CDEnd);
      var CDSect = reg(CDStart, CData);
      exports.chars = chars;
      exports.chars_without = chars_without;
      exports.detectUnicodeSupport = detectUnicodeSupport;
      exports.reg = reg;
      exports.regg = regg;
      exports.ABOUT_LEGACY_COMPAT = ABOUT_LEGACY_COMPAT;
      exports.ABOUT_LEGACY_COMPAT_SystemLiteral = ABOUT_LEGACY_COMPAT_SystemLiteral;
      exports.AttlistDecl = AttlistDecl;
      exports.CDATA_START = CDATA_START;
      exports.CDATA_END = CDATA_END;
      exports.CDSect = CDSect;
      exports.Char = Char;
      exports.Comment = Comment;
      exports.COMMENT_START = COMMENT_START;
      exports.COMMENT_END = COMMENT_END;
      exports.DOCTYPE_DECL_START = DOCTYPE_DECL_START;
      exports.elementdecl = elementdecl;
      exports.EntityDecl = EntityDecl;
      exports.EntityValue = EntityValue;
      exports.ExternalID = ExternalID;
      exports.ExternalID_match = ExternalID_match;
      exports.Name = Name;
      exports.Name_exact = Name_exact;
      exports.NCName_exact = NCName_exact;
      exports.NotationDecl = NotationDecl;
      exports.Reference = Reference;
      exports.PEReference = PEReference;
      exports.PI = PI;
      exports.PUBLIC = PUBLIC;
      exports.PubidLiteral = PubidLiteral;
      exports.PubidLiteral_match = PubidLiteral_match;
      exports.QName = QName;
      exports.QName_exact = QName_exact;
      exports.QName_group = QName_group;
      exports.S = S2;
      exports.SChar_s = SChar_s;
      exports.S_OPT = S_OPT;
      exports.SYSTEM = SYSTEM;
      exports.SystemLiteral = SystemLiteral;
      exports.SystemLiteral_match = SystemLiteral_match;
      exports.InvalidChar = InvalidChar;
      exports.UNICODE_REPLACEMENT_CHARACTER = UNICODE_REPLACEMENT_CHARACTER;
      exports.UNICODE_SUPPORT = UNICODE_SUPPORT;
      exports.XMLDecl = XMLDecl;
    }
  });

  // node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/dom.js
  var require_dom = __commonJS({
    "node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/dom.js"(exports) {
      "use strict";
      var conventions = require_conventions();
      var find = conventions.find;
      var hasDefaultHTMLNamespace = conventions.hasDefaultHTMLNamespace;
      var hasOwn = conventions.hasOwn;
      var isHTMLMimeType = conventions.isHTMLMimeType;
      var isHTMLRawTextElement = conventions.isHTMLRawTextElement;
      var isHTMLVoidElement = conventions.isHTMLVoidElement;
      var MIME_TYPE = conventions.MIME_TYPE;
      var NAMESPACE = conventions.NAMESPACE;
      var PDC = /* @__PURE__ */ Symbol();
      var errors = require_errors();
      var DOMException = errors.DOMException;
      var DOMExceptionName = errors.DOMExceptionName;
      var g = require_grammar();
      function checkSymbol(symbol) {
        if (symbol !== PDC) {
          throw new TypeError("Illegal constructor");
        }
      }
      function notEmptyString(input) {
        return input !== "";
      }
      function splitOnASCIIWhitespace(input) {
        return input ? input.split(/[\t\n\f\r ]+/).filter(notEmptyString) : [];
      }
      function orderedSetReducer(current, element) {
        if (!hasOwn(current, element)) {
          current[element] = true;
        }
        return current;
      }
      function toOrderedSet(input) {
        if (!input) return [];
        var list = splitOnASCIIWhitespace(input);
        return Object.keys(list.reduce(orderedSetReducer, {}));
      }
      function arrayIncludes(list) {
        return function(element) {
          return list && list.indexOf(element) !== -1;
        };
      }
      function validateQualifiedName(qualifiedName) {
        if (!g.QName_exact.test(qualifiedName)) {
          throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'invalid character in qualified name "' + qualifiedName + '"');
        }
      }
      function validateAndExtract(namespace, qualifiedName) {
        validateQualifiedName(qualifiedName);
        namespace = namespace || null;
        var prefix = null;
        var localName = qualifiedName;
        if (qualifiedName.indexOf(":") >= 0) {
          var splitResult = qualifiedName.split(":");
          prefix = splitResult[0];
          localName = splitResult[1];
        }
        if (prefix !== null && namespace === null) {
          throw new DOMException(DOMException.NAMESPACE_ERR, "prefix is non-null and namespace is null");
        }
        if (prefix === "xml" && namespace !== conventions.NAMESPACE.XML) {
          throw new DOMException(DOMException.NAMESPACE_ERR, 'prefix is "xml" and namespace is not the XML namespace');
        }
        if ((prefix === "xmlns" || qualifiedName === "xmlns") && namespace !== conventions.NAMESPACE.XMLNS) {
          throw new DOMException(
            DOMException.NAMESPACE_ERR,
            'either qualifiedName or prefix is "xmlns" and namespace is not the XMLNS namespace'
          );
        }
        if (namespace === conventions.NAMESPACE.XMLNS && prefix !== "xmlns" && qualifiedName !== "xmlns") {
          throw new DOMException(
            DOMException.NAMESPACE_ERR,
            'namespace is the XMLNS namespace and neither qualifiedName nor prefix is "xmlns"'
          );
        }
        return [namespace, prefix, localName];
      }
      function copy(src, dest) {
        for (var p in src) {
          if (hasOwn(src, p)) {
            dest[p] = src[p];
          }
        }
      }
      function _extends(Class, Super) {
        var pt = Class.prototype;
        if (!(pt instanceof Super)) {
          let t = function() {
          };
          t.prototype = Super.prototype;
          t = new t();
          copy(pt, t);
          Class.prototype = pt = t;
        }
        if (pt.constructor != Class) {
          if (typeof Class != "function") {
            console.error("unknown Class:" + Class);
          }
          pt.constructor = Class;
        }
      }
      var NodeType = {};
      var ELEMENT_NODE = NodeType.ELEMENT_NODE = 1;
      var ATTRIBUTE_NODE = NodeType.ATTRIBUTE_NODE = 2;
      var TEXT_NODE = NodeType.TEXT_NODE = 3;
      var CDATA_SECTION_NODE = NodeType.CDATA_SECTION_NODE = 4;
      var ENTITY_REFERENCE_NODE = NodeType.ENTITY_REFERENCE_NODE = 5;
      var ENTITY_NODE = NodeType.ENTITY_NODE = 6;
      var PROCESSING_INSTRUCTION_NODE = NodeType.PROCESSING_INSTRUCTION_NODE = 7;
      var COMMENT_NODE = NodeType.COMMENT_NODE = 8;
      var DOCUMENT_NODE = NodeType.DOCUMENT_NODE = 9;
      var DOCUMENT_TYPE_NODE = NodeType.DOCUMENT_TYPE_NODE = 10;
      var DOCUMENT_FRAGMENT_NODE = NodeType.DOCUMENT_FRAGMENT_NODE = 11;
      var NOTATION_NODE = NodeType.NOTATION_NODE = 12;
      var DocumentPosition = conventions.freeze({
        DOCUMENT_POSITION_DISCONNECTED: 1,
        DOCUMENT_POSITION_PRECEDING: 2,
        DOCUMENT_POSITION_FOLLOWING: 4,
        DOCUMENT_POSITION_CONTAINS: 8,
        DOCUMENT_POSITION_CONTAINED_BY: 16,
        DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: 32
      });
      function commonAncestor(a, b) {
        if (b.length < a.length) return commonAncestor(b, a);
        var c = null;
        for (var n in a) {
          if (a[n] !== b[n]) return c;
          c = a[n];
        }
        return c;
      }
      function docGUID(doc) {
        if (!doc.guid) doc.guid = Math.random();
        return doc.guid;
      }
      function NodeList() {
      }
      NodeList.prototype = {
        /**
         * The number of nodes in the list. The range of valid child node indices is 0 to length-1
         * inclusive.
         *
         * @type {number}
         */
        length: 0,
        /**
         * Returns the item at `index`. If index is greater than or equal to the number of nodes in
         * the list, this returns null.
         *
         * @param index
         * Unsigned long Index into the collection.
         * @returns {Node | null}
         * The node at position `index` in the NodeList,
         * or null if that is not a valid index.
         */
        item: function(index) {
          return index >= 0 && index < this.length ? this[index] : null;
        },
        /**
         * Returns a string representation of the NodeList.
         *
         * Accepts the same `options` object as `XMLSerializer.prototype.serializeToString`
         * (`requireWellFormed`, `splitCDATASections`, `nodeFilter`). Passing a function is treated as
         * a legacy `nodeFilter` for backward compatibility.
         *
         * @param {Object | function} [options]
         * @param {boolean} [options.requireWellFormed=false]
         * @param {boolean} [options.splitCDATASections=true]
         * @param {function} [options.nodeFilter]
         * @returns {string}
         */
        toString: function(options) {
          var opts;
          if (typeof options === "function") {
            opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: options };
          } else if (!!options) {
            opts = {
              requireWellFormed: !!options.requireWellFormed,
              splitCDATASections: options.splitCDATASections !== false,
              nodeFilter: options.nodeFilter || null
            };
          } else {
            opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: null };
          }
          for (var buf = [], i = 0; i < this.length; i++) {
            serializeToString(this[i], buf, null, opts);
          }
          return buf.join("");
        },
        /**
         * Filters the NodeList based on a predicate.
         *
         * @param {function(Node): boolean} predicate
         * - A predicate function to filter the NodeList.
         * @returns {Node[]}
         * An array of nodes that satisfy the predicate.
         * @private
         */
        filter: function(predicate) {
          return Array.prototype.filter.call(this, predicate);
        },
        /**
         * Returns the first index at which a given node can be found in the NodeList, or -1 if it is
         * not present.
         *
         * @param {Node} item
         * - The Node item to locate in the NodeList.
         * @returns {number}
         * The first index of the node in the NodeList; -1 if not found.
         * @private
         */
        indexOf: function(item) {
          return Array.prototype.indexOf.call(this, item);
        }
      };
      NodeList.prototype[Symbol.iterator] = function() {
        var me = this;
        var index = 0;
        return {
          next: function() {
            if (index < me.length) {
              return {
                value: me[index++],
                done: false
              };
            } else {
              return {
                done: true
              };
            }
          },
          return: function() {
            return {
              done: true
            };
          }
        };
      };
      function LiveNodeList(node, refresh) {
        this._node = node;
        this._refresh = refresh;
        _updateLiveList(this);
      }
      function _updateLiveList(list) {
        var inc = list._node._inc || list._node.ownerDocument._inc;
        if (list._inc !== inc) {
          var ls = list._refresh(list._node);
          __set__(list, "length", ls.length);
          if (!list.$$length || ls.length < list.$$length) {
            for (var i = ls.length; i in list; i++) {
              if (hasOwn(list, i)) {
                delete list[i];
              }
            }
          }
          copy(ls, list);
          list._inc = inc;
        }
      }
      LiveNodeList.prototype.item = function(i) {
        _updateLiveList(this);
        return this[i] || null;
      };
      _extends(LiveNodeList, NodeList);
      function NamedNodeMap() {
        this._nsIndex = /* @__PURE__ */ Object.create(null);
        this._noNsIndex = /* @__PURE__ */ Object.create(null);
      }
      function _findNodeIndex(list, node) {
        var i = 0;
        while (i < list.length) {
          if (list[i] === node) {
            return i;
          }
          i++;
        }
      }
      function _nnmBucket(map, namespaceURI, create) {
        if (!namespaceURI) {
          return map._noNsIndex;
        }
        var bucket = map._nsIndex[namespaceURI];
        if (!bucket && create) {
          bucket = map._nsIndex[namespaceURI] = /* @__PURE__ */ Object.create(null);
        }
        return bucket;
      }
      function _nnmIndexFind(map, namespaceURI, localName) {
        var bucket = _nnmBucket(map, namespaceURI, false);
        var found = bucket && bucket[localName];
        return found ? found : null;
      }
      function _nnmIndexAdd(map, attr) {
        _nnmBucket(map, attr.namespaceURI, true)[attr.localName] = attr;
      }
      function _nnmIndexRemove(map, attr) {
        var bucket = _nnmBucket(map, attr.namespaceURI, false);
        if (bucket) {
          delete bucket[attr.localName];
        }
      }
      function _addNamedNode(el, list, newAttr, oldAttr) {
        if (oldAttr) {
          list[_findNodeIndex(list, oldAttr)] = newAttr;
        } else {
          list[list.length] = newAttr;
          list.length++;
        }
        _nnmIndexAdd(list, newAttr);
        if (el) {
          newAttr.ownerElement = el;
          var doc = el.ownerDocument;
          if (doc) {
            oldAttr && _onRemoveAttribute(doc, el, oldAttr);
            _onAddAttribute(doc, el, newAttr);
          }
        }
      }
      function _removeNamedNode(el, list, attr) {
        var i = _findNodeIndex(list, attr);
        if (i >= 0) {
          var lastIndex = list.length - 1;
          while (i <= lastIndex) {
            list[i] = list[++i];
          }
          list.length = lastIndex;
          _nnmIndexRemove(list, attr);
          if (el) {
            var doc = el.ownerDocument;
            if (doc) {
              _onRemoveAttribute(doc, el, attr);
            }
            attr.ownerElement = null;
          }
        }
      }
      NamedNodeMap.prototype = {
        length: 0,
        item: NodeList.prototype.item,
        /**
         * Get an attribute by name. Note: Name is in lower case in case of HTML namespace and
         * document.
         *
         * @param {string} localName
         * The local name of the attribute.
         * @returns {Attr | null}
         * The attribute with the given local name, or null if no such attribute exists.
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-get-by-name
         */
        getNamedItem: function(localName) {
          if (this._ownerElement && this._ownerElement._isInHTMLDocumentAndNamespace()) {
            localName = localName.toLowerCase();
          }
          var i = 0;
          while (i < this.length) {
            var attr = this[i];
            if (attr.nodeName === localName) {
              return attr;
            }
            i++;
          }
          return null;
        },
        /**
         * Set an attribute.
         *
         * @param {Attr} attr
         * The attribute to set.
         * @returns {Attr | null}
         * The old attribute with the same local name and namespace URI as the new one, or null if no
         * such attribute exists.
         * @throws {DOMException}
         * With code:
         * - {@link INUSE_ATTRIBUTE_ERR} - If the attribute is already an attribute of another
         * element.
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-set
         */
        setNamedItem: function(attr) {
          var el = attr.ownerElement;
          if (el && el !== this._ownerElement) {
            throw new DOMException(DOMException.INUSE_ATTRIBUTE_ERR);
          }
          var oldAttr = _nnmIndexFind(this, attr.namespaceURI, attr.localName);
          if (oldAttr === attr) {
            return attr;
          }
          _addNamedNode(this._ownerElement, this, attr, oldAttr);
          return oldAttr;
        },
        /**
         * Set an attribute, replacing an existing attribute with the same local name and namespace
         * URI if one exists.
         *
         * @param {Attr} attr
         * The attribute to set.
         * @returns {Attr | null}
         * The old attribute with the same local name and namespace URI as the new one, or null if no
         * such attribute exists.
         * @throws {DOMException}
         * Throws a DOMException with the name "InUseAttributeError" if the attribute is already an
         * attribute of another element.
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-set
         */
        setNamedItemNS: function(attr) {
          return this.setNamedItem(attr);
        },
        /**
         * Removes an attribute specified by the local name.
         *
         * @param {string} localName
         * The local name of the attribute to be removed.
         * @returns {Attr}
         * The attribute node that was removed.
         * @throws {DOMException}
         * With code:
         * - {@link DOMException.NOT_FOUND_ERR} if no attribute with the given name is found.
         * @see https://dom.spec.whatwg.org/#dom-namednodemap-removenameditem
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-remove-by-name
         */
        removeNamedItem: function(localName) {
          var attr = this.getNamedItem(localName);
          if (!attr) {
            throw new DOMException(DOMException.NOT_FOUND_ERR, localName);
          }
          _removeNamedNode(this._ownerElement, this, attr);
          return attr;
        },
        /**
         * Removes an attribute specified by the namespace and local name.
         *
         * @param {string | null} namespaceURI
         * The namespace URI of the attribute to be removed.
         * @param {string} localName
         * The local name of the attribute to be removed.
         * @returns {Attr}
         * The attribute node that was removed.
         * @throws {DOMException}
         * With code:
         * - {@link DOMException.NOT_FOUND_ERR} if no attribute with the given namespace URI and local
         * name is found.
         * @see https://dom.spec.whatwg.org/#dom-namednodemap-removenameditemns
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-remove-by-namespace
         */
        removeNamedItemNS: function(namespaceURI, localName) {
          var attr = this.getNamedItemNS(namespaceURI, localName);
          if (!attr) {
            throw new DOMException(DOMException.NOT_FOUND_ERR, namespaceURI ? namespaceURI + " : " + localName : localName);
          }
          _removeNamedNode(this._ownerElement, this, attr);
          return attr;
        },
        /**
         * Get an attribute by namespace and local name.
         *
         * @param {string | null} namespaceURI
         * The namespace URI of the attribute.
         * @param {string} localName
         * The local name of the attribute.
         * @returns {Attr | null}
         * The attribute with the given namespace URI and local name, or null if no such attribute
         * exists.
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-get-by-namespace
         */
        getNamedItemNS: function(namespaceURI, localName) {
          if (!namespaceURI) {
            namespaceURI = null;
          }
          var i = 0;
          while (i < this.length) {
            var node = this[i];
            if (node.localName === localName && node.namespaceURI === namespaceURI) {
              return node;
            }
            i++;
          }
          return null;
        }
      };
      NamedNodeMap.prototype[Symbol.iterator] = function() {
        var me = this;
        var index = 0;
        return {
          next: function() {
            if (index < me.length) {
              return {
                value: me[index++],
                done: false
              };
            } else {
              return {
                done: true
              };
            }
          },
          return: function() {
            return {
              done: true
            };
          }
        };
      };
      function DOMImplementation() {
      }
      DOMImplementation.prototype = {
        /**
         * Test if the DOM implementation implements a specific feature and version, as specified in
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/core.html#DOMFeatures DOM Features}.
         *
         * The DOMImplementation.hasFeature() method returns a Boolean flag indicating if a given
         * feature is supported. The different implementations fairly diverged in what kind of
         * features were reported. The latest version of the spec settled to force this method to
         * always return true, where the functionality was accurate and in use.
         *
         * @deprecated
         * It is deprecated and modern browsers return true in all cases.
         * @function DOMImplementation#hasFeature
         * @param {string} feature
         * The name of the feature to test.
         * @param {string} [version]
         * This is the version number of the feature to test.
         * @returns {boolean}
         * Always returns true.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMImplementation/hasFeature MDN
         * @see https://www.w3.org/TR/REC-DOM-Level-1/level-one-core.html#ID-5CED94D7 DOM Level 1 Core
         * @see https://dom.spec.whatwg.org/#dom-domimplementation-hasfeature DOM Living Standard
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-5CED94D7 DOM Level 3 Core
         */
        hasFeature: function(feature, version) {
          return true;
        },
        /**
         * Creates a DOM Document object of the specified type with its document element. Note that
         * based on the {@link DocumentType}
         * given to create the document, the implementation may instantiate specialized
         * {@link Document} objects that support additional features than the "Core", such as "HTML"
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#DOM2HTML DOM Level 2 HTML}.
         * On the other hand, setting the {@link DocumentType} after the document was created makes
         * this very unlikely to happen. Alternatively, specialized {@link Document} creation methods,
         * such as createHTMLDocument
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#DOM2HTML DOM Level 2 HTML},
         * can be used to obtain specific types of {@link Document} objects.
         *
         * __It behaves slightly different from the description in the living standard__:
         * - There is no interface/class `XMLDocument`, it returns a `Document`
         * instance (with it's `type` set to `'xml'`).
         * - `encoding`, `mode`, `origin`, `url` fields are currently not declared.
         *
         * @function DOMImplementation.createDocument
         * @param {string | null} namespaceURI
         * The
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/glossary.html#dt-namespaceURI namespace URI}
         * of the document element to create or null.
         * @param {string | null} qualifiedName
         * The
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/glossary.html#dt-qualifiedname qualified name}
         * of the document element to be created or null.
         * @param {DocumentType | null} [doctype=null]
         * The type of document to be created or null. When doctype is not null, its
         * {@link Node#ownerDocument} attribute is set to the document being created. Default is
         * `null`
         * @returns {Document}
         * A new {@link Document} object with its document element. If the NamespaceURI,
         * qualifiedName, and doctype are null, the returned {@link Document} is empty with no
         * document element.
         * @throws {DOMException}
         * With code:
         *
         * - `INVALID_CHARACTER_ERR`: Raised if the specified qualified name is not an XML name
         * according to {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#XML XML 1.0}.
         * - `NAMESPACE_ERR`: Raised if the qualifiedName is malformed, if the qualifiedName has a
         * prefix and the namespaceURI is null, or if the qualifiedName is null and the namespaceURI
         * is different from null, or if the qualifiedName has a prefix that is "xml" and the
         * namespaceURI is different from "{@link http://www.w3.org/XML/1998/namespace}"
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#Namespaces XML Namespaces},
         * or if the DOM implementation does not support the "XML" feature but a non-null namespace
         * URI was provided, since namespaces were defined by XML.
         * - `WRONG_DOCUMENT_ERR`: Raised if doctype has already been used with a different document
         * or was created from a different implementation.
         * - `NOT_SUPPORTED_ERR`: May be raised if the implementation does not support the feature
         * "XML" and the language exposed through the Document does not support XML Namespaces (such
         * as {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#HTML40 HTML 4.01}).
         * @since DOM Level 2.
         * @see {@link #createHTMLDocument}
         * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMImplementation/createDocument MDN
         * @see https://dom.spec.whatwg.org/#dom-domimplementation-createdocument DOM Living Standard
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Level-2-Core-DOM-createDocument DOM
         *      Level 3 Core
         * @see https://www.w3.org/TR/DOM-Level-2-Core/core.html#Level-2-Core-DOM-createDocument DOM
         *      Level 2 Core (initial)
         */
        createDocument: function(namespaceURI, qualifiedName, doctype) {
          var contentType = MIME_TYPE.XML_APPLICATION;
          if (namespaceURI === NAMESPACE.HTML) {
            contentType = MIME_TYPE.XML_XHTML_APPLICATION;
          } else if (namespaceURI === NAMESPACE.SVG) {
            contentType = MIME_TYPE.XML_SVG_IMAGE;
          }
          var doc = new Document(PDC, { contentType });
          doc.implementation = this;
          doc.childNodes = new NodeList();
          doc.doctype = doctype || null;
          if (doctype) {
            doc.appendChild(doctype);
          }
          if (qualifiedName) {
            var root = doc.createElementNS(namespaceURI, qualifiedName);
            doc.appendChild(root);
          }
          return doc;
        },
        /**
         * Creates an empty DocumentType node. Entity declarations and notations are not made
         * available. Entity reference expansions and default attribute additions do not occur.
         *
         * **This behavior is slightly different from the one in the specs**:
         * - `encoding`, `mode`, `origin`, `url` fields are currently not declared.
         * - `publicId` and `systemId` contain the raw data including any possible quotes,
         *   so they can always be serialized back to the original value
         * - `internalSubset` contains the raw string between `[` and `]` if present,
         *   but is not parsed or validated in any form.
         *
         * @function DOMImplementation#createDocumentType
         * @param {string} qualifiedName
         * The {@link https://www.w3.org/TR/DOM-Level-3-Core/glossary.html#dt-qualifiedname qualified
         * name} of the document type to be created.
         * @param {string} [publicId]
         * The external subset public identifier. Stored verbatim including surrounding quotes.
         * When serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
         * if the value is non-empty and does not match the XML `PubidLiteral` production
         * (W3C DOM Parsing §3.2.1.3; XML 1.0 production [12]). Creation-time validation is not
         * enforced — deferred to a future breaking release.
         * @param {string} [systemId]
         * The external subset system identifier. Stored verbatim including surrounding quotes.
         * When serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
         * if the value is non-empty and does not match the XML `SystemLiteral` production
         * (W3C DOM Parsing §3.2.1.3; XML 1.0 production [11]). Creation-time validation is not
         * enforced — deferred to a future breaking release.
         * @param {string} [internalSubset]
         * The internal subset or an empty string if it is not present. Stored verbatim.
         * When serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
         * if the value contains `"]>"`. Creation-time validation is not enforced.
         * @returns {DocumentType}
         * A new {@link DocumentType} node with {@link Node#ownerDocument} set to null.
         * @throws {DOMException}
         * With code:
         *
         * - `INVALID_CHARACTER_ERR`: Raised if the specified qualified name is not an XML name
         * according to {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#XML XML 1.0}.
         * - `NAMESPACE_ERR`: Raised if the qualifiedName is malformed.
         * - `NOT_SUPPORTED_ERR`: May be raised if the implementation does not support the feature
         * "XML" and the language exposed through the Document does not support XML Namespaces (such
         * as {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#HTML40 HTML 4.01}).
         * @since DOM Level 2.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMImplementation/createDocumentType
         *      MDN
         * @see https://dom.spec.whatwg.org/#dom-domimplementation-createdocumenttype DOM Living
         *      Standard
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Level-3-Core-DOM-createDocType DOM
         *      Level 3 Core
         * @see https://www.w3.org/TR/DOM-Level-2-Core/core.html#Level-2-Core-DOM-createDocType DOM
         *      Level 2 Core
         * @see https://github.com/xmldom/xmldom/blob/master/CHANGELOG.md#050
         * @see https://www.w3.org/TR/DOM-Level-2-Core/#core-ID-Core-DocType-internalSubset
         * @prettierignore
         */
        createDocumentType: function(qualifiedName, publicId, systemId, internalSubset) {
          validateQualifiedName(qualifiedName);
          var node = new DocumentType(PDC);
          node.name = qualifiedName;
          node.nodeName = qualifiedName;
          node.publicId = publicId || "";
          node.systemId = systemId || "";
          node.internalSubset = internalSubset || "";
          node.childNodes = new NodeList();
          return node;
        },
        /**
         * Returns an HTML document, that might already have a basic DOM structure.
         *
         * __It behaves slightly different from the description in the living standard__:
         * - If the first argument is `false` no initial nodes are added (steps 3-7 in the specs are
         * omitted)
         * - `encoding`, `mode`, `origin`, `url` fields are currently not declared.
         *
         * @param {string | false} [title]
         * A string containing the title to give the new HTML document.
         * @returns {Document}
         * The HTML document.
         * @since WHATWG Living Standard.
         * @see {@link #createDocument}
         * @see https://dom.spec.whatwg.org/#dom-domimplementation-createhtmldocument
         * @see https://dom.spec.whatwg.org/#html-document
         */
        createHTMLDocument: function(title) {
          var doc = new Document(PDC, { contentType: MIME_TYPE.HTML });
          doc.implementation = this;
          doc.childNodes = new NodeList();
          if (title !== false) {
            doc.doctype = this.createDocumentType("html");
            doc.doctype.ownerDocument = doc;
            doc.appendChild(doc.doctype);
            var htmlNode = doc.createElement("html");
            doc.appendChild(htmlNode);
            var headNode = doc.createElement("head");
            htmlNode.appendChild(headNode);
            if (typeof title === "string") {
              var titleNode = doc.createElement("title");
              titleNode.appendChild(doc.createTextNode(title));
              headNode.appendChild(titleNode);
            }
            htmlNode.appendChild(doc.createElement("body"));
          }
          return doc;
        }
      };
      function Node(symbol) {
        checkSymbol(symbol);
      }
      Node.prototype = {
        /**
         * The first child of this node.
         *
         * @type {Node | null}
         */
        firstChild: null,
        /**
         * The last child of this node.
         *
         * @type {Node | null}
         */
        lastChild: null,
        /**
         * The previous sibling of this node.
         *
         * @type {Node | null}
         */
        previousSibling: null,
        /**
         * The next sibling of this node.
         *
         * @type {Node | null}
         */
        nextSibling: null,
        /**
         * The parent node of this node.
         *
         * @type {Node | null}
         */
        parentNode: null,
        /**
         * The parent element of this node.
         *
         * @type {Element | null}
         */
        get parentElement() {
          return this.parentNode && this.parentNode.nodeType === this.ELEMENT_NODE ? this.parentNode : null;
        },
        /**
         * The child nodes of this node.
         *
         * @type {NodeList}
         */
        childNodes: null,
        /**
         * The document object associated with this node.
         *
         * @type {Document | null}
         */
        ownerDocument: null,
        /**
         * The value of this node.
         *
         * @type {string | null}
         */
        nodeValue: null,
        /**
         * The namespace URI of this node.
         *
         * @type {string | null}
         */
        namespaceURI: null,
        /**
         * The prefix of the namespace for this node.
         *
         * @type {string | null}
         */
        prefix: null,
        /**
         * The local part of the qualified name of this node.
         *
         * @type {string | null}
         */
        localName: null,
        /**
         * The baseURI is currently always `about:blank`,
         * since that's what happens when you create a document from scratch.
         *
         * @type {'about:blank'}
         */
        baseURI: "about:blank",
        /**
         * Is true if this node is part of a document.
         *
         * @type {boolean}
         */
        get isConnected() {
          var rootNode = this.getRootNode();
          return rootNode && rootNode.nodeType === rootNode.DOCUMENT_NODE;
        },
        /**
         * Checks whether `other` is an inclusive descendant of this node.
         *
         * @param {Node | null | undefined} other
         * The node to check.
         * @returns {boolean}
         * True if `other` is an inclusive descendant of this node; false otherwise.
         * @see https://dom.spec.whatwg.org/#dom-node-contains
         */
        contains: function(other) {
          if (!other) return false;
          var parent = other;
          do {
            if (this === parent) return true;
            parent = parent.parentNode;
          } while (parent);
          return false;
        },
        /**
         * @typedef GetRootNodeOptions
         * @property {boolean} [composed=false]
         */
        /**
         * Searches for the root node of this node.
         *
         * **This behavior is slightly different from the in the specs**:
         * - ignores `options.composed`, since `ShadowRoot`s are unsupported, always returns root.
         *
         * @param {GetRootNodeOptions} [options]
         * @returns {Node}
         * Root node.
         * @see https://dom.spec.whatwg.org/#dom-node-getrootnode
         * @see https://dom.spec.whatwg.org/#concept-shadow-including-root
         */
        getRootNode: function(options) {
          var parent = this;
          do {
            if (!parent.parentNode) {
              return parent;
            }
            parent = parent.parentNode;
          } while (parent);
        },
        /**
         * Checks whether the given node is equal to this node.
         *
         * Two nodes are equal when they have the same type, defining characteristics (for the type),
         * and the same childNodes. The comparison is iterative to avoid stack overflows on
         * deeply-nested trees. Attribute nodes of each Element pair are also pushed onto the stack
         * and compared the same way.
         *
         * @param {Node} [otherNode]
         * @returns {boolean}
         * @see https://dom.spec.whatwg.org/#concept-node-equals
         * @see ../docs/walk-dom.md.
         */
        isEqualNode: function(otherNode) {
          if (!otherNode) return false;
          var stack = [{ node: this, other: otherNode }];
          while (stack.length > 0) {
            var pair = stack.pop();
            var node = pair.node;
            var other = pair.other;
            if (node.nodeType !== other.nodeType) return false;
            switch (node.nodeType) {
              case node.DOCUMENT_TYPE_NODE:
                if (node.name !== other.name) return false;
                if (node.publicId !== other.publicId) return false;
                if (node.systemId !== other.systemId) return false;
                break;
              case node.ELEMENT_NODE:
                if (node.namespaceURI !== other.namespaceURI) return false;
                if (node.prefix !== other.prefix) return false;
                if (node.localName !== other.localName) return false;
                if (node.attributes.length !== other.attributes.length) return false;
                for (var i = 0; i < node.attributes.length; i++) {
                  var attr = node.attributes.item(i);
                  var otherAttr = other.getAttributeNodeNS(attr.namespaceURI, attr.localName);
                  if (!otherAttr) return false;
                  stack.push({ node: attr, other: otherAttr });
                }
                break;
              case node.ATTRIBUTE_NODE:
                if (node.namespaceURI !== other.namespaceURI) return false;
                if (node.localName !== other.localName) return false;
                if (node.value !== other.value) return false;
                break;
              case node.PROCESSING_INSTRUCTION_NODE:
                if (node.target !== other.target || node.data !== other.data) return false;
                break;
              case node.TEXT_NODE:
              case node.CDATA_SECTION_NODE:
              case node.COMMENT_NODE:
                if (node.data !== other.data) return false;
                break;
            }
            if (node.childNodes.length !== other.childNodes.length) return false;
            for (var i = node.childNodes.length - 1; i >= 0; i--) {
              stack.push({ node: node.childNodes[i], other: other.childNodes[i] });
            }
          }
          return true;
        },
        /**
         * Checks whether or not the given node is this node.
         *
         * @param {Node} [otherNode]
         */
        isSameNode: function(otherNode) {
          return this === otherNode;
        },
        /**
         * Inserts a node before a reference node as a child of this node.
         *
         * @param {Node} newChild
         * The new child node to be inserted.
         * @param {Node | null} refChild
         * The reference node before which newChild will be inserted.
         * @returns {Node}
         * The new child node successfully inserted.
         * @throws {DOMException}
         * Throws a DOMException if inserting the node would result in a DOM tree that is not
         * well-formed, or if `child` is provided but is not a child of `parent`.
         * See {@link _insertBefore} for more details.
         * @since Modified in DOM L2
         */
        insertBefore: function(newChild, refChild) {
          return _insertBefore(this, newChild, refChild);
        },
        /**
         * Replaces an old child node with a new child node within this node.
         *
         * @param {Node} newChild
         * The new node that is to replace the old node.
         * If it already exists in the DOM, it is removed from its original position.
         * @param {Node} oldChild
         * The existing child node to be replaced.
         * @returns {Node}
         * Returns the replaced child node.
         * @throws {DOMException}
         * Throws a DOMException if replacing the node would result in a DOM tree that is not
         * well-formed, or if `oldChild` is not a child of `this`.
         * This can also occur if the pre-replacement validity assertion fails.
         * See {@link _insertBefore}, {@link Node.removeChild}, and
         * {@link assertPreReplacementValidityInDocument} for more details.
         * @see https://dom.spec.whatwg.org/#concept-node-replace
         */
        replaceChild: function(newChild, oldChild) {
          _insertBefore(this, newChild, oldChild, assertPreReplacementValidityInDocument);
          if (oldChild) {
            this.removeChild(oldChild);
          }
        },
        /**
         * Removes an existing child node from this node.
         *
         * @param {Node} oldChild
         * The child node to be removed.
         * @returns {Node}
         * Returns the removed child node.
         * @throws {DOMException}
         * Throws a DOMException if `oldChild` is not a child of `this`.
         * See {@link _removeChild} for more details.
         */
        removeChild: function(oldChild) {
          return _removeChild(this, oldChild);
        },
        /**
         * Appends a child node to this node.
         *
         * @param {Node} newChild
         * The child node to be appended to this node.
         * If it already exists in the DOM, it is removed from its original position.
         * @returns {Node}
         * Returns the appended child node.
         * @throws {DOMException}
         * Throws a DOMException if appending the node would result in a DOM tree that is not
         * well-formed, or if `newChild` is not a valid Node.
         * See {@link insertBefore} for more details.
         */
        appendChild: function(newChild) {
          return this.insertBefore(newChild, null);
        },
        /**
         * Determines whether this node has any child nodes.
         *
         * @returns {boolean}
         * Returns true if this node has any child nodes, and false otherwise.
         */
        hasChildNodes: function() {
          return this.firstChild != null;
        },
        /**
         * Creates a copy of the calling node.
         *
         * @param {boolean} deep
         * If true, the contents of the node are recursively copied.
         * If false, only the node itself (and its attributes, if it is an element) are copied.
         * @returns {Node}
         * Returns the newly created copy of the node.
         * @throws {DOMException}
         * May throw a DOMException if operations within {@link Element#setAttributeNode} or
         * {@link Node#appendChild} (which are potentially invoked in this method) do not meet their
         * specific constraints.
         * @see {@link cloneNode}
         */
        cloneNode: function(deep) {
          return cloneNode(this.ownerDocument || this, this, deep);
        },
        /**
         * Puts the specified node and all of its subtree into a "normalized" form. In a normalized
         * subtree, no text nodes in the subtree are empty and there are no adjacent text nodes.
         *
         * Specifically, this method merges any adjacent text nodes (i.e., nodes for which `nodeType`
         * is `TEXT_NODE`) into a single node with the combined data. It also removes any empty text
         * nodes.
         *
         * This method iterativly traverses all child nodes to normalize all descendent nodes within
         * the subtree.
         *
         * @throws {DOMException}
         * May throw a DOMException if operations within removeChild or appendData (which are
         * potentially invoked in this method) do not meet their specific constraints.
         * @since Modified in DOM Level 2
         * @see {@link Node.removeChild}
         * @see {@link CharacterData.appendData}
         * @see ../docs/walk-dom.md.
         */
        normalize: function() {
          walkDOM(this, null, {
            enter: function(node) {
              var child = node.firstChild;
              while (child) {
                var next = child.nextSibling;
                if (next !== null && next.nodeType === TEXT_NODE && child.nodeType === TEXT_NODE) {
                  var tail = [];
                  var sibling = next;
                  while (sibling !== null && sibling.nodeType === TEXT_NODE) {
                    tail.push(sibling.data);
                    sibling = sibling.nextSibling;
                  }
                  var removed = child.nextSibling;
                  while (removed !== sibling) {
                    var following = removed.nextSibling;
                    removed.parentNode = null;
                    removed.previousSibling = null;
                    removed.nextSibling = null;
                    removed = following;
                  }
                  child.nextSibling = sibling;
                  if (sibling !== null) {
                    sibling.previousSibling = child;
                  } else {
                    node.lastChild = child;
                  }
                  child.appendData(tail.join(""));
                  _onUpdateChild(node.ownerDocument, node);
                  child = sibling;
                } else {
                  child = next;
                }
              }
              return true;
            }
          });
        },
        /**
         * Checks whether the DOM implementation implements a specific feature and its version.
         *
         * @deprecated
         * Since `DOMImplementation.hasFeature` is deprecated and always returns true.
         * @param {string} feature
         * The package name of the feature to test. This is the same name that can be passed to the
         * method `hasFeature` on `DOMImplementation`.
         * @param {string} version
         * This is the version number of the package name to test.
         * @returns {boolean}
         * Returns true in all cases in the current implementation.
         * @since Introduced in DOM Level 2
         * @see {@link DOMImplementation.hasFeature}
         */
        isSupported: function(feature, version) {
          return this.ownerDocument.implementation.hasFeature(feature, version);
        },
        /**
         * Look up the prefix associated to the given namespace URI, starting from this node.
         * **The default namespace declarations are ignored by this method.**
         * See Namespace Prefix Lookup for details on the algorithm used by this method.
         *
         * **This behavior is different from the in the specs**:
         * - no node type specific handling
         * - uses the internal attribute _nsMap for resolving namespaces that is updated when changing attributes
         *
         * @param {string | null} namespaceURI
         * The namespace URI for which to find the associated prefix.
         * @returns {string | null}
         * The associated prefix, if found; otherwise, null.
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-lookupNamespacePrefix
         * @see https://www.w3.org/TR/DOM-Level-3-Core/namespaces-algorithms.html#lookupNamespacePrefixAlgo
         * @see https://dom.spec.whatwg.org/#dom-node-lookupprefix
         * @see https://github.com/xmldom/xmldom/issues/322
         * @prettierignore
         */
        lookupPrefix: function(namespaceURI) {
          var el = this;
          while (el) {
            var map = el._nsMap;
            if (map) {
              for (var n in map) {
                if (hasOwn(map, n) && map[n] === namespaceURI) {
                  return n;
                }
              }
            }
            el = el.nodeType == ATTRIBUTE_NODE ? el.ownerDocument : el.parentNode;
          }
          return null;
        },
        /**
         * This function is used to look up the namespace URI associated with the given prefix,
         * starting from this node.
         *
         * **This behavior is different from the in the specs**:
         * - no node type specific handling
         * - uses the internal attribute _nsMap for resolving namespaces that is updated when changing attributes
         *
         * @param {string | null} prefix
         * The prefix for which to find the associated namespace URI.
         * @returns {string | null}
         * The associated namespace URI, if found; otherwise, null.
         * @since DOM Level 3
         * @see https://dom.spec.whatwg.org/#dom-node-lookupnamespaceuri
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-lookupNamespaceURI
         * @prettierignore
         */
        lookupNamespaceURI: function(prefix) {
          var el = this;
          while (el) {
            var map = el._nsMap;
            if (map) {
              if (hasOwn(map, prefix)) {
                return map[prefix];
              }
            }
            el = el.nodeType == ATTRIBUTE_NODE ? el.ownerDocument : el.parentNode;
          }
          return null;
        },
        /**
         * Determines whether the given namespace URI is the default namespace.
         *
         * The function works by looking up the prefix associated with the given namespace URI. If no
         * prefix is found (i.e., the namespace URI is not registered in the namespace map of this
         * node or any of its ancestors), it returns `true`, implying the namespace URI is considered
         * the default.
         *
         * **This behavior is different from the in the specs**:
         * - no node type specific handling
         * - uses the internal attribute _nsMap for resolving namespaces that is updated when changing attributes
         *
         * @param {string | null} namespaceURI
         * The namespace URI to be checked.
         * @returns {boolean}
         * Returns true if the given namespace URI is the default namespace, false otherwise.
         * @since DOM Level 3
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-isDefaultNamespace
         * @see https://dom.spec.whatwg.org/#dom-node-isdefaultnamespace
         * @prettierignore
         */
        isDefaultNamespace: function(namespaceURI) {
          var prefix = this.lookupPrefix(namespaceURI);
          return prefix == null;
        },
        /**
         * Compares the reference node with a node with regard to their position in the document and
         * according to the document order.
         *
         * @param {Node} other
         * The node to compare the reference node to.
         * @returns {number}
         * Returns how the node is positioned relatively to the reference node according to the
         * bitmask. 0 if reference node and given node are the same.
         * @since DOM Level 3
         * @see https://www.w3.org/TR/2004/REC-DOM-Level-3-Core-20040407/core.html#Node3-compare
         * @see https://dom.spec.whatwg.org/#dom-node-comparedocumentposition
         */
        compareDocumentPosition: function(other) {
          if (this === other) return 0;
          var node1 = other;
          var node2 = this;
          var attr1 = null;
          var attr2 = null;
          if (node1 instanceof Attr) {
            attr1 = node1;
            node1 = attr1.ownerElement;
          }
          if (node2 instanceof Attr) {
            attr2 = node2;
            node2 = attr2.ownerElement;
            if (attr1 && node1 && node2 === node1) {
              for (var i = 0, attr; attr = node2.attributes[i]; i++) {
                if (attr === attr1)
                  return DocumentPosition.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC + DocumentPosition.DOCUMENT_POSITION_PRECEDING;
                if (attr === attr2)
                  return DocumentPosition.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC + DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
              }
            }
          }
          if (!node1 || !node2 || node2.ownerDocument !== node1.ownerDocument) {
            return DocumentPosition.DOCUMENT_POSITION_DISCONNECTED + DocumentPosition.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC + (docGUID(node2.ownerDocument) > docGUID(node1.ownerDocument) ? DocumentPosition.DOCUMENT_POSITION_FOLLOWING : DocumentPosition.DOCUMENT_POSITION_PRECEDING);
          }
          if (attr2 && node1 === node2) {
            return DocumentPosition.DOCUMENT_POSITION_CONTAINS + DocumentPosition.DOCUMENT_POSITION_PRECEDING;
          }
          if (attr1 && node1 === node2) {
            return DocumentPosition.DOCUMENT_POSITION_CONTAINED_BY + DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
          }
          var chain1 = [];
          var ancestor1 = node1.parentNode;
          while (ancestor1) {
            if (!attr2 && ancestor1 === node2) {
              return DocumentPosition.DOCUMENT_POSITION_CONTAINED_BY + DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
            }
            chain1.push(ancestor1);
            ancestor1 = ancestor1.parentNode;
          }
          chain1.reverse();
          var chain2 = [];
          var ancestor2 = node2.parentNode;
          while (ancestor2) {
            if (!attr1 && ancestor2 === node1) {
              return DocumentPosition.DOCUMENT_POSITION_CONTAINS + DocumentPosition.DOCUMENT_POSITION_PRECEDING;
            }
            chain2.push(ancestor2);
            ancestor2 = ancestor2.parentNode;
          }
          chain2.reverse();
          var ca = commonAncestor(chain1, chain2);
          for (var n in ca.childNodes) {
            var child = ca.childNodes[n];
            if (child === node2) return DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
            if (child === node1) return DocumentPosition.DOCUMENT_POSITION_PRECEDING;
            if (chain2.indexOf(child) >= 0) return DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
            if (chain1.indexOf(child) >= 0) return DocumentPosition.DOCUMENT_POSITION_PRECEDING;
          }
          return 0;
        }
      };
      function _xmlEncoder(c) {
        return c == "<" && "&lt;" || c == ">" && "&gt;" || c == "&" && "&amp;" || c == '"' && "&quot;" || "&#" + c.charCodeAt() + ";";
      }
      copy(NodeType, Node);
      copy(NodeType, Node.prototype);
      copy(DocumentPosition, Node);
      copy(DocumentPosition, Node.prototype);
      function _visitNode(node, callback) {
        walkDOM(node, null, {
          enter: function(n) {
            return callback(n) ? walkDOM.STOP : true;
          }
        });
      }
      function walkDOM(node, context, callbacks) {
        var stack = [{ node, context, phase: walkDOM.ENTER }];
        while (stack.length > 0) {
          var frame = stack.pop();
          if (frame.phase === walkDOM.ENTER) {
            var childContext = callbacks.enter(frame.node, frame.context);
            if (childContext === walkDOM.STOP) {
              return walkDOM.STOP;
            }
            stack.push({ node: frame.node, context: childContext, phase: walkDOM.EXIT });
            if (childContext === null || childContext === void 0) {
              continue;
            }
            var child = frame.node.lastChild;
            while (child) {
              stack.push({ node: child, context: childContext, phase: walkDOM.ENTER });
              child = child.previousSibling;
            }
          } else {
            if (callbacks.exit) {
              callbacks.exit(frame.node, frame.context);
            }
          }
        }
      }
      walkDOM.STOP = /* @__PURE__ */ Symbol("walkDOM.STOP");
      walkDOM.ENTER = 0;
      walkDOM.EXIT = 1;
      function Document(symbol, options) {
        checkSymbol(symbol);
        var opt = options || {};
        this.ownerDocument = this;
        this.contentType = opt.contentType || MIME_TYPE.XML_APPLICATION;
        this.type = isHTMLMimeType(this.contentType) ? "html" : "xml";
      }
      function _onAddAttribute(doc, el, newAttr) {
        doc && doc._inc++;
        var ns = newAttr.namespaceURI;
        if (ns === NAMESPACE.XMLNS) {
          el._nsMap[newAttr.prefix ? newAttr.localName : ""] = newAttr.value;
        }
      }
      function _onRemoveAttribute(doc, el, newAttr, remove) {
        doc && doc._inc++;
        var ns = newAttr.namespaceURI;
        if (ns === NAMESPACE.XMLNS) {
          delete el._nsMap[newAttr.prefix ? newAttr.localName : ""];
        }
      }
      function _onUpdateChild(doc, parent, newChild) {
        if (doc && doc._inc) {
          doc._inc++;
          var childNodes = parent.childNodes;
          if (newChild && !newChild.nextSibling) {
            childNodes[childNodes.length++] = newChild;
          } else {
            var child = parent.firstChild;
            var i = 0;
            while (child) {
              childNodes[i++] = child;
              child = child.nextSibling;
            }
            childNodes.length = i;
            delete childNodes[childNodes.length];
          }
        }
      }
      function _removeChild(parentNode, child) {
        if (parentNode !== child.parentNode) {
          throw new DOMException(DOMException.NOT_FOUND_ERR, "child's parent is not parent");
        }
        var oldPreviousSibling = child.previousSibling;
        var oldNextSibling = child.nextSibling;
        if (oldPreviousSibling) {
          oldPreviousSibling.nextSibling = oldNextSibling;
        } else {
          parentNode.firstChild = oldNextSibling;
        }
        if (oldNextSibling) {
          oldNextSibling.previousSibling = oldPreviousSibling;
        } else {
          parentNode.lastChild = oldPreviousSibling;
        }
        _onUpdateChild(parentNode.ownerDocument, parentNode);
        child.parentNode = null;
        child.previousSibling = null;
        child.nextSibling = null;
        return child;
      }
      function hasValidParentNodeType(node) {
        return node && (node.nodeType === Node.DOCUMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node.nodeType === Node.ELEMENT_NODE);
      }
      function hasInsertableNodeType(node) {
        return node && (node.nodeType === Node.CDATA_SECTION_NODE || node.nodeType === Node.COMMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node.nodeType === Node.DOCUMENT_TYPE_NODE || node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.PROCESSING_INSTRUCTION_NODE || node.nodeType === Node.TEXT_NODE);
      }
      function isDocTypeNode(node) {
        return node && node.nodeType === Node.DOCUMENT_TYPE_NODE;
      }
      function isElementNode(node) {
        return node && node.nodeType === Node.ELEMENT_NODE;
      }
      function isTextNode(node) {
        return node && node.nodeType === Node.TEXT_NODE;
      }
      function isElementInsertionPossible(doc, child) {
        var parentChildNodes = doc.childNodes || [];
        if (find(parentChildNodes, isElementNode) || isDocTypeNode(child)) {
          return false;
        }
        var docTypeNode = find(parentChildNodes, isDocTypeNode);
        return !(child && docTypeNode && parentChildNodes.indexOf(docTypeNode) > parentChildNodes.indexOf(child));
      }
      function isElementReplacementPossible(doc, child) {
        var parentChildNodes = doc.childNodes || [];
        function hasElementChildThatIsNotChild(node) {
          return isElementNode(node) && node !== child;
        }
        if (find(parentChildNodes, hasElementChildThatIsNotChild)) {
          return false;
        }
        var docTypeNode = find(parentChildNodes, isDocTypeNode);
        return !(child && docTypeNode && parentChildNodes.indexOf(docTypeNode) > parentChildNodes.indexOf(child));
      }
      function assertPreInsertionValidity1to5(parent, node, child) {
        if (!hasValidParentNodeType(parent)) {
          throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Unexpected parent node type " + parent.nodeType);
        }
        if (child && child.parentNode !== parent) {
          throw new DOMException(DOMException.NOT_FOUND_ERR, "child not in parent");
        }
        if (
          // 4. If `node` is not a DocumentFragment, DocumentType, Element, or CharacterData node, then throw a "HierarchyRequestError" DOMException.
          !hasInsertableNodeType(node) || // 5. If either `node` is a Text node and `parent` is a document,
          // the sax parser currently adds top level text nodes, this will be fixed in 0.9.0
          // || (node.nodeType === Node.TEXT_NODE && parent.nodeType === Node.DOCUMENT_NODE)
          // or `node` is a doctype and `parent` is not a document, then throw a "HierarchyRequestError" DOMException.
          isDocTypeNode(node) && parent.nodeType !== Node.DOCUMENT_NODE
        ) {
          throw new DOMException(
            DOMException.HIERARCHY_REQUEST_ERR,
            "Unexpected node type " + node.nodeType + " for parent node type " + parent.nodeType
          );
        }
      }
      function assertPreInsertionValidityInDocument(parent, node, child) {
        var parentChildNodes = parent.childNodes || [];
        var nodeChildNodes = node.childNodes || [];
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          var nodeChildElements = nodeChildNodes.filter(isElementNode);
          if (nodeChildElements.length > 1 || find(nodeChildNodes, isTextNode)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "More than one element or text in fragment");
          }
          if (nodeChildElements.length === 1 && !isElementInsertionPossible(parent, child)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Element in fragment can not be inserted before doctype");
          }
        }
        if (isElementNode(node)) {
          if (!isElementInsertionPossible(parent, child)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one element can be added and only after doctype");
          }
        }
        if (isDocTypeNode(node)) {
          if (find(parentChildNodes, isDocTypeNode)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one doctype is allowed");
          }
          var parentElementChild = find(parentChildNodes, isElementNode);
          if (child && parentChildNodes.indexOf(parentElementChild) < parentChildNodes.indexOf(child)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Doctype can only be inserted before an element");
          }
          if (!child && parentElementChild) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Doctype can not be appended since element is present");
          }
        }
      }
      function assertPreReplacementValidityInDocument(parent, node, child) {
        var parentChildNodes = parent.childNodes || [];
        var nodeChildNodes = node.childNodes || [];
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          var nodeChildElements = nodeChildNodes.filter(isElementNode);
          if (nodeChildElements.length > 1 || find(nodeChildNodes, isTextNode)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "More than one element or text in fragment");
          }
          if (nodeChildElements.length === 1 && !isElementReplacementPossible(parent, child)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Element in fragment can not be inserted before doctype");
          }
        }
        if (isElementNode(node)) {
          if (!isElementReplacementPossible(parent, child)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one element can be added and only after doctype");
          }
        }
        if (isDocTypeNode(node)) {
          let hasDoctypeChildThatIsNotChild = function(node2) {
            return isDocTypeNode(node2) && node2 !== child;
          };
          if (find(parentChildNodes, hasDoctypeChildThatIsNotChild)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one doctype is allowed");
          }
          var parentElementChild = find(parentChildNodes, isElementNode);
          if (child && parentChildNodes.indexOf(parentElementChild) < parentChildNodes.indexOf(child)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Doctype can only be inserted before an element");
          }
        }
      }
      function _insertBefore(parent, node, child, _inDocumentAssertion) {
        assertPreInsertionValidity1to5(parent, node, child);
        if (parent.nodeType === Node.DOCUMENT_NODE) {
          (_inDocumentAssertion || assertPreInsertionValidityInDocument)(parent, node, child);
        }
        var cp = node.parentNode;
        if (cp) {
          cp.removeChild(node);
        }
        if (node.nodeType === DOCUMENT_FRAGMENT_NODE) {
          var newFirst = node.firstChild;
          if (newFirst == null) {
            return node;
          }
          var newLast = node.lastChild;
        } else {
          newFirst = newLast = node;
        }
        var pre = child ? child.previousSibling : parent.lastChild;
        newFirst.previousSibling = pre;
        newLast.nextSibling = child;
        if (pre) {
          pre.nextSibling = newFirst;
        } else {
          parent.firstChild = newFirst;
        }
        if (child == null) {
          parent.lastChild = newLast;
        } else {
          child.previousSibling = newLast;
        }
        do {
          newFirst.parentNode = parent;
        } while (newFirst !== newLast && (newFirst = newFirst.nextSibling));
        _onUpdateChild(parent.ownerDocument || parent, parent, node);
        if (node.nodeType == DOCUMENT_FRAGMENT_NODE) {
          node.firstChild = node.lastChild = null;
        }
        return node;
      }
      Document.prototype = {
        /**
         * The implementation that created this document.
         *
         * @type DOMImplementation
         * @readonly
         */
        implementation: null,
        nodeName: "#document",
        nodeType: DOCUMENT_NODE,
        /**
         * The DocumentType node of the document.
         *
         * @type DocumentType
         * @readonly
         */
        doctype: null,
        documentElement: null,
        _inc: 1,
        insertBefore: function(newChild, refChild) {
          if (newChild.nodeType === DOCUMENT_FRAGMENT_NODE) {
            var child = newChild.firstChild;
            while (child) {
              var next = child.nextSibling;
              this.insertBefore(child, refChild);
              child = next;
            }
            return newChild;
          }
          _insertBefore(this, newChild, refChild);
          newChild.ownerDocument = this;
          if (this.documentElement === null && newChild.nodeType === ELEMENT_NODE) {
            this.documentElement = newChild;
          }
          return newChild;
        },
        removeChild: function(oldChild) {
          var removed = _removeChild(this, oldChild);
          if (removed === this.documentElement) {
            this.documentElement = null;
          }
          return removed;
        },
        replaceChild: function(newChild, oldChild) {
          _insertBefore(this, newChild, oldChild, assertPreReplacementValidityInDocument);
          newChild.ownerDocument = this;
          if (oldChild) {
            this.removeChild(oldChild);
          }
          if (isElementNode(newChild)) {
            this.documentElement = newChild;
          }
        },
        /**
         * Imports a node from another document into this document, creating a new copy owned by this
         * document. The source node and its subtree are not modified.
         *
         * @param {Node} importedNode
         * The node to import.
         * @param {boolean} deep
         * If true, the contents of the node are recursively imported.
         * If false, only the node itself (and its attributes, if it is an element) are imported.
         * @returns {Node}
         * Returns the newly created import of the node.
         * @see {@link importNode}
         * @see {@link https://dom.spec.whatwg.org/#dom-document-importnode}
         */
        importNode: function(importedNode, deep) {
          return importNode(this, importedNode, deep);
        },
        // Introduced in DOM Level 2:
        getElementById: function(id) {
          var rtv = null;
          _visitNode(this.documentElement, function(node) {
            if (node.nodeType == ELEMENT_NODE) {
              if (node.getAttribute("id") == id) {
                rtv = node;
                return true;
              }
            }
          });
          return rtv;
        },
        /**
         * Creates a new `Element` that is owned by this `Document`.
         * In HTML Documents `localName` is the lower cased `tagName`,
         * otherwise no transformation is being applied.
         * When `contentType` implies the HTML namespace, it will be set as `namespaceURI`.
         *
         * __This implementation differs from the specification:__ - The provided name is not checked
         * against the `Name` production,
         * so no related error will be thrown.
         * - There is no interface `HTMLElement`, it is always an `Element`.
         * - There is no support for a second argument to indicate using custom elements.
         *
         * @param {string} tagName
         * @returns {Element}
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement
         * @see https://dom.spec.whatwg.org/#dom-document-createelement
         * @see https://dom.spec.whatwg.org/#concept-create-element
         */
        createElement: function(tagName) {
          var node = new Element(PDC);
          node.ownerDocument = this;
          if (this.type === "html") {
            tagName = tagName.toLowerCase();
          }
          if (hasDefaultHTMLNamespace(this.contentType)) {
            node.namespaceURI = NAMESPACE.HTML;
          }
          node.nodeName = tagName;
          node.tagName = tagName;
          node.localName = tagName;
          node.childNodes = new NodeList();
          var attrs = node.attributes = new NamedNodeMap();
          attrs._ownerElement = node;
          return node;
        },
        /**
         * @returns {DocumentFragment}
         */
        createDocumentFragment: function() {
          var node = new DocumentFragment(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          return node;
        },
        /**
         * @param {string} data
         * @returns {Text}
         */
        createTextNode: function(data) {
          var node = new Text(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.appendData(data);
          return node;
        },
        /**
         * @param {string} data
         * @returns {Comment}
         * @see https://dom.spec.whatwg.org/#dom-document-createcomment
         * @see https://www.w3.org/TR/xml/#NT-Comment XML 1.0 production [15]
         * @see https://www.w3.org/TR/DOM-Parsing/#dfn-concept-serialize-xml §3.2.1.3
         *
         *      Note: no validation is performed at creation time. When the resulting document is
         *      serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
         *      if the comment data contains `--` anywhere, ends with `-`, or contains characters
         *      outside the XML Char production (W3C DOM Parsing §3.2.1.3). Without that option the
         *      data is emitted verbatim.
         */
        createComment: function(data) {
          var node = new Comment(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.appendData(data);
          return node;
        },
        /**
         * Returns a new CDATASection node whose data is `data`.
         *
         * __This implementation differs from the specification:__ - calling this method on an HTML
         * document does not throw `NotSupportedError`.
         *
         * @param {string} data
         * @returns {CDATASection}
         * @throws {DOMException}
         * With code `INVALID_CHARACTER_ERR` if `data` contains `"]]>"`.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/createCDATASection
         * @see https://dom.spec.whatwg.org/#dom-document-createcdatasection
         */
        createCDATASection: function(data) {
          if (data.indexOf("]]>") !== -1) {
            throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'data contains "]]>"');
          }
          var node = new CDATASection(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.appendData(data);
          return node;
        },
        /**
         * Returns a ProcessingInstruction node whose target is target and data is data.
         *
         * __This behavior is slightly different from the in the specs__:
         * - it does not do any input validation on the arguments and doesn't throw
         * "InvalidCharacterError".
         *
         * Note: When the resulting document is serialized with `requireWellFormed: true`, the
         * serializer throws `InvalidStateError` if `.target` is not a valid XML `NCName` (a `Name`
         * with no colon) or is an ASCII case-insensitive match for `"xml"`, or if `.data` contains
         * `?>` or characters outside the XML Char production (W3C DOM Parsing §3.2.1.7). Without that
         * option the target and data are emitted verbatim.
         *
         * @param {string} target
         * @param {string} data
         * @returns {ProcessingInstruction}
         * @see https://developer.mozilla.org/docs/Web/API/Document/createProcessingInstruction
         * @see https://dom.spec.whatwg.org/#dom-document-createprocessinginstruction
         * @see https://www.w3.org/TR/DOM-Parsing/#dfn-concept-serialize-xml §3.2.1.7
         */
        createProcessingInstruction: function(target, data) {
          var node = new ProcessingInstruction(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.nodeName = node.target = target;
          node.nodeValue = node.data = data;
          return node;
        },
        /**
         * Creates an `Attr` node that is owned by this document.
         * In HTML Documents `localName` is the lower cased `name`,
         * otherwise no transformation is being applied.
         *
         * __This implementation differs from the specification:__ - The provided name is not checked
         * against the `Name` production,
         * so no related error will be thrown.
         *
         * @param {string} name
         * @returns {Attr}
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/createAttribute
         * @see https://dom.spec.whatwg.org/#dom-document-createattribute
         */
        createAttribute: function(name) {
          if (!g.QName_exact.test(name)) {
            throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'invalid character in name "' + name + '"');
          }
          if (this.type === "html") {
            name = name.toLowerCase();
          }
          return this._createAttribute(name);
        },
        _createAttribute: function(name) {
          var node = new Attr(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.name = name;
          node.nodeName = name;
          node.localName = name;
          node.specified = true;
          return node;
        },
        /**
         * Creates an EntityReference object.
         * The current implementation does not fill the `childNodes` with those of the corresponding
         * `Entity`
         *
         * The `name` is validated against the XML `Name` production at creation time; an invalid name
         * throws `InvalidCharacterError`. When the resulting node is serialized with
         * `requireWellFormed: true`, the serializer re-validates `nodeName` against the XML `Name`
         * production and throws `InvalidStateError` if a later `nodeName` mutation made it invalid;
         * without that option the name is emitted verbatim.
         *
         * __This implementation differs from the specification:__ xmldom does not expand entities —
         * the parser resolves entity references inline and never constructs `EntityReference` nodes,
         * so this method is the only producer.
         *
         * @deprecated
         * In DOM Level 4.
         * @param {string} name
         * The name of the entity to reference. No namespace well-formedness checks are performed.
         * @returns {EntityReference}
         * @throws {DOMException}
         * With code `INVALID_CHARACTER_ERR` when `name` is not a valid XML `Name`.
         * @throws {DOMException}
         * with code `NOT_SUPPORTED_ERR` when the document is of type `html`
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-392B75AE
         */
        createEntityReference: function(name) {
          if (!g.Name_exact.test(name)) {
            throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'not a valid xml name "' + name + '"');
          }
          if (this.type === "html") {
            throw new DOMException("document is an html document", DOMExceptionName.NotSupportedError);
          }
          var node = new EntityReference(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.nodeName = name;
          return node;
        },
        // Introduced in DOM Level 2:
        /**
         * @param {string} namespaceURI
         * @param {string} qualifiedName
         * @returns {Element}
         */
        createElementNS: function(namespaceURI, qualifiedName) {
          var validated = validateAndExtract(namespaceURI, qualifiedName);
          var node = new Element(PDC);
          var attrs = node.attributes = new NamedNodeMap();
          node.childNodes = new NodeList();
          node.ownerDocument = this;
          node.nodeName = qualifiedName;
          node.tagName = qualifiedName;
          node.namespaceURI = validated[0];
          node.prefix = validated[1];
          node.localName = validated[2];
          attrs._ownerElement = node;
          return node;
        },
        // Introduced in DOM Level 2:
        /**
         * @param {string} namespaceURI
         * @param {string} qualifiedName
         * @returns {Attr}
         */
        createAttributeNS: function(namespaceURI, qualifiedName) {
          var validated = validateAndExtract(namespaceURI, qualifiedName);
          var node = new Attr(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.nodeName = qualifiedName;
          node.name = qualifiedName;
          node.specified = true;
          node.namespaceURI = validated[0];
          node.prefix = validated[1];
          node.localName = validated[2];
          return node;
        }
      };
      _extends(Document, Node);
      function Element(symbol) {
        checkSymbol(symbol);
        this._nsMap = /* @__PURE__ */ Object.create(null);
      }
      Element.prototype = {
        nodeType: ELEMENT_NODE,
        /**
         * The attributes of this element.
         *
         * @type {NamedNodeMap | null}
         */
        attributes: null,
        getQualifiedName: function() {
          return this.prefix ? this.prefix + ":" + this.localName : this.localName;
        },
        _isInHTMLDocumentAndNamespace: function() {
          return this.ownerDocument.type === "html" && this.namespaceURI === NAMESPACE.HTML;
        },
        /**
         * Implementaton of Level2 Core function hasAttributes.
         *
         * @returns {boolean}
         * True if attribute list is not empty.
         * @see https://www.w3.org/TR/DOM-Level-2-Core/#core-ID-NodeHasAttrs
         */
        hasAttributes: function() {
          return !!(this.attributes && this.attributes.length);
        },
        hasAttribute: function(name) {
          return !!this.getAttributeNode(name);
        },
        /**
         * Returns element’s first attribute whose qualified name is `name`, and `null`
         * if there is no such attribute.
         *
         * @param {string} name
         * @returns {string | null}
         */
        getAttribute: function(name) {
          var attr = this.getAttributeNode(name);
          return attr ? attr.value : null;
        },
        getAttributeNode: function(name) {
          if (this._isInHTMLDocumentAndNamespace()) {
            name = name.toLowerCase();
          }
          return this.attributes.getNamedItem(name);
        },
        /**
         * Sets the value of element’s first attribute whose qualified name is qualifiedName to value.
         *
         * @param {string} name
         * @param {string} value
         */
        setAttribute: function(name, value) {
          if (this._isInHTMLDocumentAndNamespace()) {
            name = name.toLowerCase();
          }
          var attr = this.getAttributeNode(name);
          if (attr) {
            attr.value = attr.nodeValue = "" + value;
          } else {
            attr = this.ownerDocument._createAttribute(name);
            attr.value = attr.nodeValue = "" + value;
            this.setAttributeNode(attr);
          }
        },
        removeAttribute: function(name) {
          var attr = this.getAttributeNode(name);
          attr && this.removeAttributeNode(attr);
        },
        setAttributeNode: function(newAttr) {
          return this.attributes.setNamedItem(newAttr);
        },
        setAttributeNodeNS: function(newAttr) {
          return this.attributes.setNamedItemNS(newAttr);
        },
        removeAttributeNode: function(oldAttr) {
          return this.attributes.removeNamedItem(oldAttr.nodeName);
        },
        //get real attribute name,and remove it by removeAttributeNode
        removeAttributeNS: function(namespaceURI, localName) {
          var old = this.getAttributeNodeNS(namespaceURI, localName);
          old && this.removeAttributeNode(old);
        },
        hasAttributeNS: function(namespaceURI, localName) {
          return this.getAttributeNodeNS(namespaceURI, localName) != null;
        },
        /**
         * Returns element’s attribute whose namespace is `namespaceURI` and local name is
         * `localName`,
         * or `null` if there is no such attribute.
         *
         * @param {string} namespaceURI
         * @param {string} localName
         * @returns {string | null}
         */
        getAttributeNS: function(namespaceURI, localName) {
          var attr = this.getAttributeNodeNS(namespaceURI, localName);
          return attr ? attr.value : null;
        },
        /**
         * Sets the value of element’s attribute whose namespace is `namespaceURI` and local name is
         * `localName` to value.
         *
         * @param {string} namespaceURI
         * @param {string} qualifiedName
         * @param {string} value
         * @see https://dom.spec.whatwg.org/#dom-element-setattributens
         */
        setAttributeNS: function(namespaceURI, qualifiedName, value) {
          var validated = validateAndExtract(namespaceURI, qualifiedName);
          var localName = validated[2];
          var attr = this.getAttributeNodeNS(namespaceURI, localName);
          if (attr) {
            attr.value = attr.nodeValue = "" + value;
          } else {
            attr = this.ownerDocument.createAttributeNS(namespaceURI, qualifiedName);
            attr.value = attr.nodeValue = "" + value;
            this.setAttributeNode(attr);
          }
        },
        getAttributeNodeNS: function(namespaceURI, localName) {
          return this.attributes.getNamedItemNS(namespaceURI, localName);
        },
        /**
         * Returns a LiveNodeList of all child elements which have **all** of the given class name(s).
         *
         * Returns an empty list if `classNames` is an empty string or only contains HTML white space
         * characters.
         *
         * Warning: This returns a live LiveNodeList.
         * Changes in the DOM will reflect in the array as the changes occur.
         * If an element selected by this array no longer qualifies for the selector,
         * it will automatically be removed. Be aware of this for iteration purposes.
         *
         * @param {string} classNames
         * Is a string representing the class name(s) to match; multiple class names are separated by
         * (ASCII-)whitespace.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/getElementsByClassName
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementsByClassName
         * @see https://dom.spec.whatwg.org/#concept-getelementsbyclassname
         */
        getElementsByClassName: function(classNames) {
          var classNamesSet = toOrderedSet(classNames);
          return new LiveNodeList(this, function(base) {
            var ls = [];
            if (classNamesSet.length > 0) {
              _visitNode(base, function(node) {
                if (node !== base && node.nodeType === ELEMENT_NODE) {
                  var nodeClassNames = node.getAttribute("class");
                  if (nodeClassNames) {
                    var matches = classNames === nodeClassNames;
                    if (!matches) {
                      var nodeClassNamesSet = toOrderedSet(nodeClassNames);
                      matches = classNamesSet.every(arrayIncludes(nodeClassNamesSet));
                    }
                    if (matches) {
                      ls.push(node);
                    }
                  }
                }
              });
            }
            return ls;
          });
        },
        /**
         * Returns a LiveNodeList of elements with the given qualifiedName.
         * Searching for all descendants can be done by passing `*` as `qualifiedName`.
         *
         * All descendants of the specified element are searched, but not the element itself.
         * The returned list is live, which means it updates itself with the DOM tree automatically.
         * Therefore, there is no need to call `Element.getElementsByTagName()`
         * with the same element and arguments repeatedly if the DOM changes in between calls.
         *
         * When called on an HTML element in an HTML document,
         * `getElementsByTagName` lower-cases the argument before searching for it.
         * This is undesirable when trying to match camel-cased SVG elements (such as
         * `<linearGradient>`) in an HTML document.
         * Instead, use `Element.getElementsByTagNameNS()`,
         * which preserves the capitalization of the tag name.
         *
         * `Element.getElementsByTagName` is similar to `Document.getElementsByTagName()`,
         * except that it only searches for elements that are descendants of the specified element.
         *
         * @param {string} qualifiedName
         * @returns {LiveNodeList}
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/getElementsByTagName
         * @see https://dom.spec.whatwg.org/#concept-getelementsbytagname
         */
        getElementsByTagName: function(qualifiedName) {
          var isHTMLDocument = (this.nodeType === DOCUMENT_NODE ? this : this.ownerDocument).type === "html";
          var lowerQualifiedName = qualifiedName.toLowerCase();
          return new LiveNodeList(this, function(base) {
            var ls = [];
            _visitNode(base, function(node) {
              if (node === base || node.nodeType !== ELEMENT_NODE) {
                return;
              }
              if (qualifiedName === "*") {
                ls.push(node);
              } else {
                var nodeQualifiedName = node.getQualifiedName();
                var matchingQName = isHTMLDocument && node.namespaceURI === NAMESPACE.HTML ? lowerQualifiedName : qualifiedName;
                if (nodeQualifiedName === matchingQName) {
                  ls.push(node);
                }
              }
            });
            return ls;
          });
        },
        getElementsByTagNameNS: function(namespaceURI, localName) {
          return new LiveNodeList(this, function(base) {
            var ls = [];
            _visitNode(base, function(node) {
              if (node !== base && node.nodeType === ELEMENT_NODE && (namespaceURI === "*" || node.namespaceURI === namespaceURI) && (localName === "*" || node.localName == localName)) {
                ls.push(node);
              }
            });
            return ls;
          });
        }
      };
      Document.prototype.getElementsByClassName = Element.prototype.getElementsByClassName;
      Document.prototype.getElementsByTagName = Element.prototype.getElementsByTagName;
      Document.prototype.getElementsByTagNameNS = Element.prototype.getElementsByTagNameNS;
      _extends(Element, Node);
      function Attr(symbol) {
        checkSymbol(symbol);
        this.namespaceURI = null;
        this.prefix = null;
        this.ownerElement = null;
      }
      Attr.prototype.nodeType = ATTRIBUTE_NODE;
      _extends(Attr, Node);
      function CharacterData(symbol) {
        checkSymbol(symbol);
      }
      CharacterData.prototype = {
        data: "",
        substringData: function(offset, count) {
          return this.data.substring(offset, offset + count);
        },
        appendData: function(text) {
          text = this.data + text;
          this.nodeValue = this.data = text;
          this.length = text.length;
        },
        insertData: function(offset, text) {
          this.replaceData(offset, 0, text);
        },
        deleteData: function(offset, count) {
          this.replaceData(offset, count, "");
        },
        replaceData: function(offset, count, text) {
          var start = this.data.substring(0, offset);
          var end = this.data.substring(offset + count);
          text = start + text + end;
          this.nodeValue = this.data = text;
          this.length = text.length;
        }
      };
      _extends(CharacterData, Node);
      function Text(symbol) {
        checkSymbol(symbol);
      }
      Text.prototype = {
        nodeName: "#text",
        nodeType: TEXT_NODE,
        splitText: function(offset) {
          var text = this.data;
          var newText = text.substring(offset);
          text = text.substring(0, offset);
          this.data = this.nodeValue = text;
          this.length = text.length;
          var newNode = this.ownerDocument.createTextNode(newText);
          if (this.parentNode) {
            this.parentNode.insertBefore(newNode, this.nextSibling);
          }
          return newNode;
        }
      };
      _extends(Text, CharacterData);
      function Comment(symbol) {
        checkSymbol(symbol);
      }
      Comment.prototype = {
        nodeName: "#comment",
        nodeType: COMMENT_NODE
      };
      _extends(Comment, CharacterData);
      function CDATASection(symbol) {
        checkSymbol(symbol);
      }
      CDATASection.prototype = {
        nodeName: "#cdata-section",
        nodeType: CDATA_SECTION_NODE
      };
      _extends(CDATASection, Text);
      function DocumentType(symbol) {
        checkSymbol(symbol);
      }
      DocumentType.prototype.nodeType = DOCUMENT_TYPE_NODE;
      _extends(DocumentType, Node);
      function Notation(symbol) {
        checkSymbol(symbol);
      }
      Notation.prototype.nodeType = NOTATION_NODE;
      _extends(Notation, Node);
      function Entity(symbol) {
        checkSymbol(symbol);
      }
      Entity.prototype.nodeType = ENTITY_NODE;
      _extends(Entity, Node);
      function EntityReference(symbol) {
        checkSymbol(symbol);
      }
      EntityReference.prototype.nodeType = ENTITY_REFERENCE_NODE;
      _extends(EntityReference, Node);
      function DocumentFragment(symbol) {
        checkSymbol(symbol);
      }
      DocumentFragment.prototype.nodeName = "#document-fragment";
      DocumentFragment.prototype.nodeType = DOCUMENT_FRAGMENT_NODE;
      _extends(DocumentFragment, Node);
      function ProcessingInstruction(symbol) {
        checkSymbol(symbol);
      }
      ProcessingInstruction.prototype.nodeType = PROCESSING_INSTRUCTION_NODE;
      _extends(ProcessingInstruction, CharacterData);
      function XMLSerializer2() {
      }
      XMLSerializer2.prototype.serializeToString = function(node, options) {
        return nodeSerializeToString.call(node, options);
      };
      Node.prototype.toString = nodeSerializeToString;
      function nodeSerializeToString(options) {
        var opts;
        if (typeof options === "function") {
          opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: options };
        } else if (options != null) {
          opts = {
            requireWellFormed: !!options.requireWellFormed,
            splitCDATASections: options.splitCDATASections !== false,
            nodeFilter: options.nodeFilter || null
          };
        } else {
          opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: null };
        }
        var buf = [];
        var refNode = this.nodeType === DOCUMENT_NODE && this.documentElement || this;
        var prefix = refNode.prefix;
        var uri = refNode.namespaceURI;
        if (uri && prefix == null) {
          var prefix = refNode.lookupPrefix(uri);
          if (prefix == null) {
            var visibleNamespaces = [
              { namespace: uri, prefix: null }
              //{namespace:uri,prefix:''}
            ];
          }
        }
        serializeToString(this, buf, visibleNamespaces, opts);
        return buf.join("");
      }
      function needNamespaceDefine(node, isHTML, visibleNamespaces) {
        var prefix = node.prefix || "";
        var uri = node.namespaceURI;
        if (!uri) {
          return false;
        }
        if (prefix === "xml" && uri === NAMESPACE.XML || uri === NAMESPACE.XMLNS) {
          return false;
        }
        var i = visibleNamespaces.length;
        while (i--) {
          var ns = visibleNamespaces[i];
          if (ns.prefix === prefix) {
            return ns.namespace !== uri;
          }
        }
        return true;
      }
      function addSerializedAttribute(buf, qualifiedName, value, requireWellFormed) {
        if (requireWellFormed && !g.QName_exact.test(qualifiedName)) {
          throw new DOMException(
            'The attribute name "' + qualifiedName + '" is not a valid XML QName',
            DOMExceptionName.InvalidStateError
          );
        }
        buf.push(" ", qualifiedName, '="', value.replace(/[<>&"\t\n\r]/g, _xmlEncoder), '"');
      }
      function serializeToString(node, buf, visibleNamespaces, opts) {
        if (!visibleNamespaces) {
          visibleNamespaces = [];
        }
        var nodeFilter = opts.nodeFilter;
        var requireWellFormed = opts.requireWellFormed;
        var splitCDATASections = opts.splitCDATASections;
        var doc = node.nodeType === DOCUMENT_NODE ? node : node.ownerDocument;
        var isHTML = doc.type === "html";
        walkDOM(
          node,
          { ns: visibleNamespaces },
          {
            enter: function(n, ctx) {
              var namespaces = ctx.ns;
              if (nodeFilter) {
                n = nodeFilter(n);
                if (n) {
                  if (typeof n == "string") {
                    buf.push(n);
                    return null;
                  }
                } else {
                  return null;
                }
              }
              switch (n.nodeType) {
                case ELEMENT_NODE:
                  var attrs = n.attributes;
                  var len = attrs.length;
                  var nodeName = n.tagName;
                  var prefixedNodeName = nodeName;
                  if (!isHTML && !n.prefix && n.namespaceURI) {
                    var defaultNS;
                    for (var ai = 0; ai < attrs.length; ai++) {
                      if (attrs.item(ai).name === "xmlns") {
                        defaultNS = attrs.item(ai).value;
                        break;
                      }
                    }
                    if (!defaultNS) {
                      for (var nsi = namespaces.length - 1; nsi >= 0; nsi--) {
                        var nsEntry = namespaces[nsi];
                        if (nsEntry.prefix === "" && nsEntry.namespace === n.namespaceURI) {
                          defaultNS = nsEntry.namespace;
                          break;
                        }
                      }
                    }
                    if (defaultNS !== n.namespaceURI) {
                      for (var nsi = namespaces.length - 1; nsi >= 0; nsi--) {
                        var nsEntry = namespaces[nsi];
                        if (nsEntry.namespace === n.namespaceURI) {
                          if (nsEntry.prefix) {
                            prefixedNodeName = nsEntry.prefix + ":" + nodeName;
                          }
                          break;
                        }
                      }
                    }
                  }
                  if (requireWellFormed && !g.QName_exact.test(prefixedNodeName)) {
                    throw new DOMException(
                      'The element name "' + prefixedNodeName + '" is not a valid XML QName',
                      DOMExceptionName.InvalidStateError
                    );
                  }
                  buf.push("<", prefixedNodeName);
                  var childNamespaces = namespaces.slice();
                  for (var i = 0; i < len; i++) {
                    var attr = attrs.item(i);
                    if (attr.prefix == "xmlns") {
                      childNamespaces.push({
                        prefix: attr.localName,
                        namespace: attr.value
                      });
                    } else if (attr.nodeName == "xmlns") {
                      childNamespaces.push({ prefix: "", namespace: attr.value });
                    }
                  }
                  for (var i = 0; i < len; i++) {
                    var attr = attrs.item(i);
                    if (needNamespaceDefine(attr, isHTML, childNamespaces)) {
                      var attrPrefix = attr.prefix || "";
                      var uri = attr.namespaceURI;
                      addSerializedAttribute(buf, attrPrefix ? "xmlns:" + attrPrefix : "xmlns", uri, requireWellFormed);
                      childNamespaces.push({ prefix: attrPrefix, namespace: uri });
                    }
                    var filteredAttr = nodeFilter ? nodeFilter(attr) : attr;
                    if (filteredAttr) {
                      if (typeof filteredAttr === "string") {
                        buf.push(filteredAttr);
                      } else {
                        addSerializedAttribute(buf, filteredAttr.name, filteredAttr.value, requireWellFormed);
                      }
                    }
                  }
                  if (nodeName === prefixedNodeName && needNamespaceDefine(n, isHTML, childNamespaces)) {
                    var nodePrefix = n.prefix || "";
                    var uri = n.namespaceURI;
                    addSerializedAttribute(buf, nodePrefix ? "xmlns:" + nodePrefix : "xmlns", uri, requireWellFormed);
                    childNamespaces.push({ prefix: nodePrefix, namespace: uri });
                  }
                  var canCloseTag = !n.firstChild;
                  if (canCloseTag && (isHTML || n.namespaceURI === NAMESPACE.HTML)) {
                    canCloseTag = isHTMLVoidElement(nodeName);
                  }
                  if (canCloseTag) {
                    buf.push("/>");
                    return null;
                  }
                  buf.push(">");
                  if (isHTML && isHTMLRawTextElement(nodeName)) {
                    var child = n.firstChild;
                    while (child) {
                      if (child.data) {
                        buf.push(child.data);
                      } else {
                        serializeToString(child, buf, childNamespaces.slice(), opts);
                      }
                      child = child.nextSibling;
                    }
                    buf.push("</", prefixedNodeName, ">");
                    return null;
                  }
                  return { ns: childNamespaces, tag: prefixedNodeName };
                case DOCUMENT_NODE:
                case DOCUMENT_FRAGMENT_NODE:
                  if (requireWellFormed && n.nodeType === DOCUMENT_NODE && n.documentElement == null) {
                    throw new DOMException("The Document has no documentElement", DOMExceptionName.InvalidStateError);
                  }
                  return { ns: namespaces };
                case ATTRIBUTE_NODE:
                  addSerializedAttribute(buf, n.name, n.value, requireWellFormed);
                  return null;
                case TEXT_NODE:
                  if (requireWellFormed && g.InvalidChar.test(n.data)) {
                    throw new DOMException(
                      "The Text node data contains characters outside the XML Char production",
                      DOMExceptionName.InvalidStateError
                    );
                  }
                  buf.push(n.data.replace(/[<&>]/g, _xmlEncoder));
                  return null;
                case CDATA_SECTION_NODE:
                  if (requireWellFormed && n.data.indexOf("]]>") !== -1) {
                    throw new DOMException('The CDATASection data contains "]]>"', DOMExceptionName.InvalidStateError);
                  }
                  if (splitCDATASections) {
                    buf.push(g.CDATA_START, n.data.replace(/]]>/g, "]]]]><![CDATA[>"), g.CDATA_END);
                  } else {
                    buf.push(g.CDATA_START, n.data, g.CDATA_END);
                  }
                  return null;
                case COMMENT_NODE:
                  if (requireWellFormed) {
                    if (g.InvalidChar.test(n.data)) {
                      throw new DOMException(
                        "The comment node data contains characters outside the XML Char production",
                        DOMExceptionName.InvalidStateError
                      );
                    }
                    if (n.data.indexOf("--") !== -1 || n.data[n.data.length - 1] === "-") {
                      throw new DOMException(
                        'The comment node data contains "--" or ends with "-"',
                        DOMExceptionName.InvalidStateError
                      );
                    }
                  }
                  buf.push(g.COMMENT_START, n.data, g.COMMENT_END);
                  return null;
                case DOCUMENT_TYPE_NODE:
                  var pubid = n.publicId;
                  var sysid = n.systemId;
                  if (requireWellFormed) {
                    if (!g.Name_exact.test(n.name)) {
                      throw new DOMException(
                        'The doctype name "' + n.name + '" is not a valid XML Name',
                        DOMExceptionName.InvalidStateError
                      );
                    }
                    if (pubid && !g.PubidLiteral_match.test(pubid)) {
                      throw new DOMException("DocumentType publicId is not a valid PubidLiteral", DOMExceptionName.InvalidStateError);
                    }
                    if (sysid && sysid !== "." && !g.SystemLiteral_match.test(sysid)) {
                      throw new DOMException("DocumentType systemId is not a valid SystemLiteral", DOMExceptionName.InvalidStateError);
                    }
                    if (n.internalSubset && n.internalSubset.indexOf("]>") !== -1) {
                      throw new DOMException('DocumentType internalSubset contains "]>"', DOMExceptionName.InvalidStateError);
                    }
                  }
                  buf.push(g.DOCTYPE_DECL_START, " ", n.name);
                  if (pubid) {
                    buf.push(" ", g.PUBLIC, " ", pubid);
                    if (sysid && sysid !== ".") {
                      buf.push(" ", sysid);
                    }
                  } else if (sysid && sysid !== ".") {
                    buf.push(" ", g.SYSTEM, " ", sysid);
                  }
                  if (n.internalSubset) {
                    buf.push(" [", n.internalSubset, "]");
                  }
                  buf.push(">");
                  return null;
                case PROCESSING_INSTRUCTION_NODE:
                  if (requireWellFormed) {
                    if (!g.NCName_exact.test(n.target) || n.target.toLowerCase() === "xml") {
                      throw new DOMException(
                        'The processing instruction target "' + n.target + '" is not a valid XML NCName or is reserved',
                        DOMExceptionName.InvalidStateError
                      );
                    }
                    if (g.InvalidChar.test(n.data)) {
                      throw new DOMException(
                        "The ProcessingInstruction data contains characters outside the XML Char production",
                        DOMExceptionName.InvalidStateError
                      );
                    }
                    if (n.data.indexOf("?>") !== -1) {
                      throw new DOMException('The ProcessingInstruction data contains "?>"', DOMExceptionName.InvalidStateError);
                    }
                  }
                  buf.push("<?", n.target, " ", n.data, "?>");
                  return null;
                case ENTITY_REFERENCE_NODE:
                  if (requireWellFormed && !g.Name_exact.test(n.nodeName)) {
                    throw new DOMException(
                      'The entity reference name "' + n.nodeName + '" is not a valid XML Name',
                      DOMExceptionName.InvalidStateError
                    );
                  }
                  buf.push("&", n.nodeName, ";");
                  return null;
                //case ENTITY_NODE:
                //case NOTATION_NODE:
                default:
                  buf.push("??", n.nodeName);
                  return null;
              }
            },
            exit: function(n, childCtx) {
              if (childCtx && childCtx.tag) {
                buf.push("</", childCtx.tag, ">");
              }
            }
          }
        );
      }
      function importNode(doc, node, deep) {
        var destRoot;
        walkDOM(node, null, {
          enter: function(srcNode, destParent) {
            var destNode = srcNode.cloneNode(false);
            destNode.ownerDocument = doc;
            destNode.parentNode = null;
            if (destParent === null) {
              destRoot = destNode;
            } else {
              destParent.appendChild(destNode);
            }
            var shouldDeep = srcNode.nodeType === ATTRIBUTE_NODE || deep;
            return shouldDeep ? destNode : null;
          }
        });
        return destRoot;
      }
      function cloneNode(doc, node, deep) {
        var destRoot;
        walkDOM(node, null, {
          enter: function(srcNode, destParent) {
            var destNode = new srcNode.constructor(PDC);
            for (var n in srcNode) {
              if (hasOwn(srcNode, n)) {
                var v = srcNode[n];
                if (typeof v != "object") {
                  if (v != destNode[n]) {
                    destNode[n] = v;
                  }
                }
              }
            }
            if (srcNode.childNodes) {
              destNode.childNodes = new NodeList();
            }
            destNode.ownerDocument = doc;
            var shouldDeep = deep;
            switch (destNode.nodeType) {
              case ELEMENT_NODE:
                var attrs = srcNode.attributes;
                var attrs2 = destNode.attributes = new NamedNodeMap();
                var len = attrs.length;
                attrs2._ownerElement = destNode;
                for (var i = 0; i < len; i++) {
                  destNode.setAttributeNode(cloneNode(doc, attrs.item(i), true));
                }
                break;
              case ATTRIBUTE_NODE:
                shouldDeep = true;
            }
            if (destParent !== null) {
              destParent.appendChild(destNode);
            } else {
              destRoot = destNode;
            }
            return shouldDeep ? destNode : null;
          }
        });
        return destRoot;
      }
      function __set__(object, key, value) {
        object[key] = value;
      }
      function childrenRefresh(node) {
        var ls = [];
        var child = node.firstChild;
        while (child) {
          if (child.nodeType === ELEMENT_NODE) {
            ls.push(child);
          }
          child = child.nextSibling;
        }
        return ls;
      }
      try {
        if (Object.defineProperty) {
          Object.defineProperty(LiveNodeList.prototype, "length", {
            get: function() {
              _updateLiveList(this);
              return this.$$length;
            }
          });
          Object.defineProperty(Node.prototype, "textContent", {
            get: function() {
              if (this.nodeType === ELEMENT_NODE || this.nodeType === DOCUMENT_FRAGMENT_NODE) {
                var buf = [];
                walkDOM(this, null, {
                  enter: function(n) {
                    if (n.nodeType === ELEMENT_NODE || n.nodeType === DOCUMENT_FRAGMENT_NODE) {
                      return true;
                    }
                    if (n.nodeType === PROCESSING_INSTRUCTION_NODE || n.nodeType === COMMENT_NODE) {
                      return null;
                    }
                    buf.push(n.nodeValue);
                  }
                });
                return buf.join("");
              }
              return this.nodeValue;
            },
            set: function(data) {
              switch (this.nodeType) {
                case ELEMENT_NODE:
                case DOCUMENT_FRAGMENT_NODE:
                  while (this.firstChild) {
                    this.removeChild(this.firstChild);
                  }
                  if (data || String(data)) {
                    this.appendChild(this.ownerDocument.createTextNode(data));
                  }
                  break;
                default:
                  this.data = data;
                  this.value = data;
                  this.nodeValue = data;
              }
            }
          });
          Object.defineProperty(CharacterData.prototype, "data", {
            get: function() {
              return this._data != null ? this._data : "";
            },
            set: function(v) {
              this._data = v;
              this.length = typeof v === "string" ? v.length : 0;
            }
          });
          Object.defineProperty(CharacterData.prototype, "nodeValue", {
            get: function() {
              return this.data;
            },
            set: function(v) {
              this.data = v;
            },
            enumerable: true,
            configurable: true
          });
          Object.defineProperty(Element.prototype, "children", {
            get: function() {
              return new LiveNodeList(this, childrenRefresh);
            }
          });
          Object.defineProperty(Document.prototype, "children", {
            get: function() {
              return new LiveNodeList(this, childrenRefresh);
            }
          });
          Object.defineProperty(DocumentFragment.prototype, "children", {
            get: function() {
              return new LiveNodeList(this, childrenRefresh);
            }
          });
          __set__ = function(object, key, value) {
            object["$$" + key] = value;
          };
        }
      } catch (e) {
      }
      exports._updateLiveList = _updateLiveList;
      exports.Attr = Attr;
      exports.CDATASection = CDATASection;
      exports.CharacterData = CharacterData;
      exports.Comment = Comment;
      exports.Document = Document;
      exports.DocumentFragment = DocumentFragment;
      exports.DocumentType = DocumentType;
      exports.DOMImplementation = DOMImplementation;
      exports.Element = Element;
      exports.Entity = Entity;
      exports.EntityReference = EntityReference;
      exports.LiveNodeList = LiveNodeList;
      exports.NamedNodeMap = NamedNodeMap;
      exports.Node = Node;
      exports.NodeList = NodeList;
      exports.Notation = Notation;
      exports.Text = Text;
      exports.ProcessingInstruction = ProcessingInstruction;
      exports.walkDOM = walkDOM;
      exports.XMLSerializer = XMLSerializer2;
    }
  });

  // node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/entities.js
  var require_entities = __commonJS({
    "node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/entities.js"(exports) {
      "use strict";
      var freeze = require_conventions().freeze;
      exports.XML_ENTITIES = freeze({
        amp: "&",
        apos: "'",
        gt: ">",
        lt: "<",
        quot: '"'
      });
      exports.HTML_ENTITIES = freeze({
        Aacute: "\xC1",
        aacute: "\xE1",
        Abreve: "\u0102",
        abreve: "\u0103",
        ac: "\u223E",
        acd: "\u223F",
        acE: "\u223E\u0333",
        Acirc: "\xC2",
        acirc: "\xE2",
        acute: "\xB4",
        Acy: "\u0410",
        acy: "\u0430",
        AElig: "\xC6",
        aelig: "\xE6",
        af: "\u2061",
        Afr: "\u{1D504}",
        afr: "\u{1D51E}",
        Agrave: "\xC0",
        agrave: "\xE0",
        alefsym: "\u2135",
        aleph: "\u2135",
        Alpha: "\u0391",
        alpha: "\u03B1",
        Amacr: "\u0100",
        amacr: "\u0101",
        amalg: "\u2A3F",
        AMP: "&",
        amp: "&",
        And: "\u2A53",
        and: "\u2227",
        andand: "\u2A55",
        andd: "\u2A5C",
        andslope: "\u2A58",
        andv: "\u2A5A",
        ang: "\u2220",
        ange: "\u29A4",
        angle: "\u2220",
        angmsd: "\u2221",
        angmsdaa: "\u29A8",
        angmsdab: "\u29A9",
        angmsdac: "\u29AA",
        angmsdad: "\u29AB",
        angmsdae: "\u29AC",
        angmsdaf: "\u29AD",
        angmsdag: "\u29AE",
        angmsdah: "\u29AF",
        angrt: "\u221F",
        angrtvb: "\u22BE",
        angrtvbd: "\u299D",
        angsph: "\u2222",
        angst: "\xC5",
        angzarr: "\u237C",
        Aogon: "\u0104",
        aogon: "\u0105",
        Aopf: "\u{1D538}",
        aopf: "\u{1D552}",
        ap: "\u2248",
        apacir: "\u2A6F",
        apE: "\u2A70",
        ape: "\u224A",
        apid: "\u224B",
        apos: "'",
        ApplyFunction: "\u2061",
        approx: "\u2248",
        approxeq: "\u224A",
        Aring: "\xC5",
        aring: "\xE5",
        Ascr: "\u{1D49C}",
        ascr: "\u{1D4B6}",
        Assign: "\u2254",
        ast: "*",
        asymp: "\u2248",
        asympeq: "\u224D",
        Atilde: "\xC3",
        atilde: "\xE3",
        Auml: "\xC4",
        auml: "\xE4",
        awconint: "\u2233",
        awint: "\u2A11",
        backcong: "\u224C",
        backepsilon: "\u03F6",
        backprime: "\u2035",
        backsim: "\u223D",
        backsimeq: "\u22CD",
        Backslash: "\u2216",
        Barv: "\u2AE7",
        barvee: "\u22BD",
        Barwed: "\u2306",
        barwed: "\u2305",
        barwedge: "\u2305",
        bbrk: "\u23B5",
        bbrktbrk: "\u23B6",
        bcong: "\u224C",
        Bcy: "\u0411",
        bcy: "\u0431",
        bdquo: "\u201E",
        becaus: "\u2235",
        Because: "\u2235",
        because: "\u2235",
        bemptyv: "\u29B0",
        bepsi: "\u03F6",
        bernou: "\u212C",
        Bernoullis: "\u212C",
        Beta: "\u0392",
        beta: "\u03B2",
        beth: "\u2136",
        between: "\u226C",
        Bfr: "\u{1D505}",
        bfr: "\u{1D51F}",
        bigcap: "\u22C2",
        bigcirc: "\u25EF",
        bigcup: "\u22C3",
        bigodot: "\u2A00",
        bigoplus: "\u2A01",
        bigotimes: "\u2A02",
        bigsqcup: "\u2A06",
        bigstar: "\u2605",
        bigtriangledown: "\u25BD",
        bigtriangleup: "\u25B3",
        biguplus: "\u2A04",
        bigvee: "\u22C1",
        bigwedge: "\u22C0",
        bkarow: "\u290D",
        blacklozenge: "\u29EB",
        blacksquare: "\u25AA",
        blacktriangle: "\u25B4",
        blacktriangledown: "\u25BE",
        blacktriangleleft: "\u25C2",
        blacktriangleright: "\u25B8",
        blank: "\u2423",
        blk12: "\u2592",
        blk14: "\u2591",
        blk34: "\u2593",
        block: "\u2588",
        bne: "=\u20E5",
        bnequiv: "\u2261\u20E5",
        bNot: "\u2AED",
        bnot: "\u2310",
        Bopf: "\u{1D539}",
        bopf: "\u{1D553}",
        bot: "\u22A5",
        bottom: "\u22A5",
        bowtie: "\u22C8",
        boxbox: "\u29C9",
        boxDL: "\u2557",
        boxDl: "\u2556",
        boxdL: "\u2555",
        boxdl: "\u2510",
        boxDR: "\u2554",
        boxDr: "\u2553",
        boxdR: "\u2552",
        boxdr: "\u250C",
        boxH: "\u2550",
        boxh: "\u2500",
        boxHD: "\u2566",
        boxHd: "\u2564",
        boxhD: "\u2565",
        boxhd: "\u252C",
        boxHU: "\u2569",
        boxHu: "\u2567",
        boxhU: "\u2568",
        boxhu: "\u2534",
        boxminus: "\u229F",
        boxplus: "\u229E",
        boxtimes: "\u22A0",
        boxUL: "\u255D",
        boxUl: "\u255C",
        boxuL: "\u255B",
        boxul: "\u2518",
        boxUR: "\u255A",
        boxUr: "\u2559",
        boxuR: "\u2558",
        boxur: "\u2514",
        boxV: "\u2551",
        boxv: "\u2502",
        boxVH: "\u256C",
        boxVh: "\u256B",
        boxvH: "\u256A",
        boxvh: "\u253C",
        boxVL: "\u2563",
        boxVl: "\u2562",
        boxvL: "\u2561",
        boxvl: "\u2524",
        boxVR: "\u2560",
        boxVr: "\u255F",
        boxvR: "\u255E",
        boxvr: "\u251C",
        bprime: "\u2035",
        Breve: "\u02D8",
        breve: "\u02D8",
        brvbar: "\xA6",
        Bscr: "\u212C",
        bscr: "\u{1D4B7}",
        bsemi: "\u204F",
        bsim: "\u223D",
        bsime: "\u22CD",
        bsol: "\\",
        bsolb: "\u29C5",
        bsolhsub: "\u27C8",
        bull: "\u2022",
        bullet: "\u2022",
        bump: "\u224E",
        bumpE: "\u2AAE",
        bumpe: "\u224F",
        Bumpeq: "\u224E",
        bumpeq: "\u224F",
        Cacute: "\u0106",
        cacute: "\u0107",
        Cap: "\u22D2",
        cap: "\u2229",
        capand: "\u2A44",
        capbrcup: "\u2A49",
        capcap: "\u2A4B",
        capcup: "\u2A47",
        capdot: "\u2A40",
        CapitalDifferentialD: "\u2145",
        caps: "\u2229\uFE00",
        caret: "\u2041",
        caron: "\u02C7",
        Cayleys: "\u212D",
        ccaps: "\u2A4D",
        Ccaron: "\u010C",
        ccaron: "\u010D",
        Ccedil: "\xC7",
        ccedil: "\xE7",
        Ccirc: "\u0108",
        ccirc: "\u0109",
        Cconint: "\u2230",
        ccups: "\u2A4C",
        ccupssm: "\u2A50",
        Cdot: "\u010A",
        cdot: "\u010B",
        cedil: "\xB8",
        Cedilla: "\xB8",
        cemptyv: "\u29B2",
        cent: "\xA2",
        CenterDot: "\xB7",
        centerdot: "\xB7",
        Cfr: "\u212D",
        cfr: "\u{1D520}",
        CHcy: "\u0427",
        chcy: "\u0447",
        check: "\u2713",
        checkmark: "\u2713",
        Chi: "\u03A7",
        chi: "\u03C7",
        cir: "\u25CB",
        circ: "\u02C6",
        circeq: "\u2257",
        circlearrowleft: "\u21BA",
        circlearrowright: "\u21BB",
        circledast: "\u229B",
        circledcirc: "\u229A",
        circleddash: "\u229D",
        CircleDot: "\u2299",
        circledR: "\xAE",
        circledS: "\u24C8",
        CircleMinus: "\u2296",
        CirclePlus: "\u2295",
        CircleTimes: "\u2297",
        cirE: "\u29C3",
        cire: "\u2257",
        cirfnint: "\u2A10",
        cirmid: "\u2AEF",
        cirscir: "\u29C2",
        ClockwiseContourIntegral: "\u2232",
        CloseCurlyDoubleQuote: "\u201D",
        CloseCurlyQuote: "\u2019",
        clubs: "\u2663",
        clubsuit: "\u2663",
        Colon: "\u2237",
        colon: ":",
        Colone: "\u2A74",
        colone: "\u2254",
        coloneq: "\u2254",
        comma: ",",
        commat: "@",
        comp: "\u2201",
        compfn: "\u2218",
        complement: "\u2201",
        complexes: "\u2102",
        cong: "\u2245",
        congdot: "\u2A6D",
        Congruent: "\u2261",
        Conint: "\u222F",
        conint: "\u222E",
        ContourIntegral: "\u222E",
        Copf: "\u2102",
        copf: "\u{1D554}",
        coprod: "\u2210",
        Coproduct: "\u2210",
        COPY: "\xA9",
        copy: "\xA9",
        copysr: "\u2117",
        CounterClockwiseContourIntegral: "\u2233",
        crarr: "\u21B5",
        Cross: "\u2A2F",
        cross: "\u2717",
        Cscr: "\u{1D49E}",
        cscr: "\u{1D4B8}",
        csub: "\u2ACF",
        csube: "\u2AD1",
        csup: "\u2AD0",
        csupe: "\u2AD2",
        ctdot: "\u22EF",
        cudarrl: "\u2938",
        cudarrr: "\u2935",
        cuepr: "\u22DE",
        cuesc: "\u22DF",
        cularr: "\u21B6",
        cularrp: "\u293D",
        Cup: "\u22D3",
        cup: "\u222A",
        cupbrcap: "\u2A48",
        CupCap: "\u224D",
        cupcap: "\u2A46",
        cupcup: "\u2A4A",
        cupdot: "\u228D",
        cupor: "\u2A45",
        cups: "\u222A\uFE00",
        curarr: "\u21B7",
        curarrm: "\u293C",
        curlyeqprec: "\u22DE",
        curlyeqsucc: "\u22DF",
        curlyvee: "\u22CE",
        curlywedge: "\u22CF",
        curren: "\xA4",
        curvearrowleft: "\u21B6",
        curvearrowright: "\u21B7",
        cuvee: "\u22CE",
        cuwed: "\u22CF",
        cwconint: "\u2232",
        cwint: "\u2231",
        cylcty: "\u232D",
        Dagger: "\u2021",
        dagger: "\u2020",
        daleth: "\u2138",
        Darr: "\u21A1",
        dArr: "\u21D3",
        darr: "\u2193",
        dash: "\u2010",
        Dashv: "\u2AE4",
        dashv: "\u22A3",
        dbkarow: "\u290F",
        dblac: "\u02DD",
        Dcaron: "\u010E",
        dcaron: "\u010F",
        Dcy: "\u0414",
        dcy: "\u0434",
        DD: "\u2145",
        dd: "\u2146",
        ddagger: "\u2021",
        ddarr: "\u21CA",
        DDotrahd: "\u2911",
        ddotseq: "\u2A77",
        deg: "\xB0",
        Del: "\u2207",
        Delta: "\u0394",
        delta: "\u03B4",
        demptyv: "\u29B1",
        dfisht: "\u297F",
        Dfr: "\u{1D507}",
        dfr: "\u{1D521}",
        dHar: "\u2965",
        dharl: "\u21C3",
        dharr: "\u21C2",
        DiacriticalAcute: "\xB4",
        DiacriticalDot: "\u02D9",
        DiacriticalDoubleAcute: "\u02DD",
        DiacriticalGrave: "`",
        DiacriticalTilde: "\u02DC",
        diam: "\u22C4",
        Diamond: "\u22C4",
        diamond: "\u22C4",
        diamondsuit: "\u2666",
        diams: "\u2666",
        die: "\xA8",
        DifferentialD: "\u2146",
        digamma: "\u03DD",
        disin: "\u22F2",
        div: "\xF7",
        divide: "\xF7",
        divideontimes: "\u22C7",
        divonx: "\u22C7",
        DJcy: "\u0402",
        djcy: "\u0452",
        dlcorn: "\u231E",
        dlcrop: "\u230D",
        dollar: "$",
        Dopf: "\u{1D53B}",
        dopf: "\u{1D555}",
        Dot: "\xA8",
        dot: "\u02D9",
        DotDot: "\u20DC",
        doteq: "\u2250",
        doteqdot: "\u2251",
        DotEqual: "\u2250",
        dotminus: "\u2238",
        dotplus: "\u2214",
        dotsquare: "\u22A1",
        doublebarwedge: "\u2306",
        DoubleContourIntegral: "\u222F",
        DoubleDot: "\xA8",
        DoubleDownArrow: "\u21D3",
        DoubleLeftArrow: "\u21D0",
        DoubleLeftRightArrow: "\u21D4",
        DoubleLeftTee: "\u2AE4",
        DoubleLongLeftArrow: "\u27F8",
        DoubleLongLeftRightArrow: "\u27FA",
        DoubleLongRightArrow: "\u27F9",
        DoubleRightArrow: "\u21D2",
        DoubleRightTee: "\u22A8",
        DoubleUpArrow: "\u21D1",
        DoubleUpDownArrow: "\u21D5",
        DoubleVerticalBar: "\u2225",
        DownArrow: "\u2193",
        Downarrow: "\u21D3",
        downarrow: "\u2193",
        DownArrowBar: "\u2913",
        DownArrowUpArrow: "\u21F5",
        DownBreve: "\u0311",
        downdownarrows: "\u21CA",
        downharpoonleft: "\u21C3",
        downharpoonright: "\u21C2",
        DownLeftRightVector: "\u2950",
        DownLeftTeeVector: "\u295E",
        DownLeftVector: "\u21BD",
        DownLeftVectorBar: "\u2956",
        DownRightTeeVector: "\u295F",
        DownRightVector: "\u21C1",
        DownRightVectorBar: "\u2957",
        DownTee: "\u22A4",
        DownTeeArrow: "\u21A7",
        drbkarow: "\u2910",
        drcorn: "\u231F",
        drcrop: "\u230C",
        Dscr: "\u{1D49F}",
        dscr: "\u{1D4B9}",
        DScy: "\u0405",
        dscy: "\u0455",
        dsol: "\u29F6",
        Dstrok: "\u0110",
        dstrok: "\u0111",
        dtdot: "\u22F1",
        dtri: "\u25BF",
        dtrif: "\u25BE",
        duarr: "\u21F5",
        duhar: "\u296F",
        dwangle: "\u29A6",
        DZcy: "\u040F",
        dzcy: "\u045F",
        dzigrarr: "\u27FF",
        Eacute: "\xC9",
        eacute: "\xE9",
        easter: "\u2A6E",
        Ecaron: "\u011A",
        ecaron: "\u011B",
        ecir: "\u2256",
        Ecirc: "\xCA",
        ecirc: "\xEA",
        ecolon: "\u2255",
        Ecy: "\u042D",
        ecy: "\u044D",
        eDDot: "\u2A77",
        Edot: "\u0116",
        eDot: "\u2251",
        edot: "\u0117",
        ee: "\u2147",
        efDot: "\u2252",
        Efr: "\u{1D508}",
        efr: "\u{1D522}",
        eg: "\u2A9A",
        Egrave: "\xC8",
        egrave: "\xE8",
        egs: "\u2A96",
        egsdot: "\u2A98",
        el: "\u2A99",
        Element: "\u2208",
        elinters: "\u23E7",
        ell: "\u2113",
        els: "\u2A95",
        elsdot: "\u2A97",
        Emacr: "\u0112",
        emacr: "\u0113",
        empty: "\u2205",
        emptyset: "\u2205",
        EmptySmallSquare: "\u25FB",
        emptyv: "\u2205",
        EmptyVerySmallSquare: "\u25AB",
        emsp: "\u2003",
        emsp13: "\u2004",
        emsp14: "\u2005",
        ENG: "\u014A",
        eng: "\u014B",
        ensp: "\u2002",
        Eogon: "\u0118",
        eogon: "\u0119",
        Eopf: "\u{1D53C}",
        eopf: "\u{1D556}",
        epar: "\u22D5",
        eparsl: "\u29E3",
        eplus: "\u2A71",
        epsi: "\u03B5",
        Epsilon: "\u0395",
        epsilon: "\u03B5",
        epsiv: "\u03F5",
        eqcirc: "\u2256",
        eqcolon: "\u2255",
        eqsim: "\u2242",
        eqslantgtr: "\u2A96",
        eqslantless: "\u2A95",
        Equal: "\u2A75",
        equals: "=",
        EqualTilde: "\u2242",
        equest: "\u225F",
        Equilibrium: "\u21CC",
        equiv: "\u2261",
        equivDD: "\u2A78",
        eqvparsl: "\u29E5",
        erarr: "\u2971",
        erDot: "\u2253",
        Escr: "\u2130",
        escr: "\u212F",
        esdot: "\u2250",
        Esim: "\u2A73",
        esim: "\u2242",
        Eta: "\u0397",
        eta: "\u03B7",
        ETH: "\xD0",
        eth: "\xF0",
        Euml: "\xCB",
        euml: "\xEB",
        euro: "\u20AC",
        excl: "!",
        exist: "\u2203",
        Exists: "\u2203",
        expectation: "\u2130",
        ExponentialE: "\u2147",
        exponentiale: "\u2147",
        fallingdotseq: "\u2252",
        Fcy: "\u0424",
        fcy: "\u0444",
        female: "\u2640",
        ffilig: "\uFB03",
        fflig: "\uFB00",
        ffllig: "\uFB04",
        Ffr: "\u{1D509}",
        ffr: "\u{1D523}",
        filig: "\uFB01",
        FilledSmallSquare: "\u25FC",
        FilledVerySmallSquare: "\u25AA",
        fjlig: "fj",
        flat: "\u266D",
        fllig: "\uFB02",
        fltns: "\u25B1",
        fnof: "\u0192",
        Fopf: "\u{1D53D}",
        fopf: "\u{1D557}",
        ForAll: "\u2200",
        forall: "\u2200",
        fork: "\u22D4",
        forkv: "\u2AD9",
        Fouriertrf: "\u2131",
        fpartint: "\u2A0D",
        frac12: "\xBD",
        frac13: "\u2153",
        frac14: "\xBC",
        frac15: "\u2155",
        frac16: "\u2159",
        frac18: "\u215B",
        frac23: "\u2154",
        frac25: "\u2156",
        frac34: "\xBE",
        frac35: "\u2157",
        frac38: "\u215C",
        frac45: "\u2158",
        frac56: "\u215A",
        frac58: "\u215D",
        frac78: "\u215E",
        frasl: "\u2044",
        frown: "\u2322",
        Fscr: "\u2131",
        fscr: "\u{1D4BB}",
        gacute: "\u01F5",
        Gamma: "\u0393",
        gamma: "\u03B3",
        Gammad: "\u03DC",
        gammad: "\u03DD",
        gap: "\u2A86",
        Gbreve: "\u011E",
        gbreve: "\u011F",
        Gcedil: "\u0122",
        Gcirc: "\u011C",
        gcirc: "\u011D",
        Gcy: "\u0413",
        gcy: "\u0433",
        Gdot: "\u0120",
        gdot: "\u0121",
        gE: "\u2267",
        ge: "\u2265",
        gEl: "\u2A8C",
        gel: "\u22DB",
        geq: "\u2265",
        geqq: "\u2267",
        geqslant: "\u2A7E",
        ges: "\u2A7E",
        gescc: "\u2AA9",
        gesdot: "\u2A80",
        gesdoto: "\u2A82",
        gesdotol: "\u2A84",
        gesl: "\u22DB\uFE00",
        gesles: "\u2A94",
        Gfr: "\u{1D50A}",
        gfr: "\u{1D524}",
        Gg: "\u22D9",
        gg: "\u226B",
        ggg: "\u22D9",
        gimel: "\u2137",
        GJcy: "\u0403",
        gjcy: "\u0453",
        gl: "\u2277",
        gla: "\u2AA5",
        glE: "\u2A92",
        glj: "\u2AA4",
        gnap: "\u2A8A",
        gnapprox: "\u2A8A",
        gnE: "\u2269",
        gne: "\u2A88",
        gneq: "\u2A88",
        gneqq: "\u2269",
        gnsim: "\u22E7",
        Gopf: "\u{1D53E}",
        gopf: "\u{1D558}",
        grave: "`",
        GreaterEqual: "\u2265",
        GreaterEqualLess: "\u22DB",
        GreaterFullEqual: "\u2267",
        GreaterGreater: "\u2AA2",
        GreaterLess: "\u2277",
        GreaterSlantEqual: "\u2A7E",
        GreaterTilde: "\u2273",
        Gscr: "\u{1D4A2}",
        gscr: "\u210A",
        gsim: "\u2273",
        gsime: "\u2A8E",
        gsiml: "\u2A90",
        Gt: "\u226B",
        GT: ">",
        gt: ">",
        gtcc: "\u2AA7",
        gtcir: "\u2A7A",
        gtdot: "\u22D7",
        gtlPar: "\u2995",
        gtquest: "\u2A7C",
        gtrapprox: "\u2A86",
        gtrarr: "\u2978",
        gtrdot: "\u22D7",
        gtreqless: "\u22DB",
        gtreqqless: "\u2A8C",
        gtrless: "\u2277",
        gtrsim: "\u2273",
        gvertneqq: "\u2269\uFE00",
        gvnE: "\u2269\uFE00",
        Hacek: "\u02C7",
        hairsp: "\u200A",
        half: "\xBD",
        hamilt: "\u210B",
        HARDcy: "\u042A",
        hardcy: "\u044A",
        hArr: "\u21D4",
        harr: "\u2194",
        harrcir: "\u2948",
        harrw: "\u21AD",
        Hat: "^",
        hbar: "\u210F",
        Hcirc: "\u0124",
        hcirc: "\u0125",
        hearts: "\u2665",
        heartsuit: "\u2665",
        hellip: "\u2026",
        hercon: "\u22B9",
        Hfr: "\u210C",
        hfr: "\u{1D525}",
        HilbertSpace: "\u210B",
        hksearow: "\u2925",
        hkswarow: "\u2926",
        hoarr: "\u21FF",
        homtht: "\u223B",
        hookleftarrow: "\u21A9",
        hookrightarrow: "\u21AA",
        Hopf: "\u210D",
        hopf: "\u{1D559}",
        horbar: "\u2015",
        HorizontalLine: "\u2500",
        Hscr: "\u210B",
        hscr: "\u{1D4BD}",
        hslash: "\u210F",
        Hstrok: "\u0126",
        hstrok: "\u0127",
        HumpDownHump: "\u224E",
        HumpEqual: "\u224F",
        hybull: "\u2043",
        hyphen: "\u2010",
        Iacute: "\xCD",
        iacute: "\xED",
        ic: "\u2063",
        Icirc: "\xCE",
        icirc: "\xEE",
        Icy: "\u0418",
        icy: "\u0438",
        Idot: "\u0130",
        IEcy: "\u0415",
        iecy: "\u0435",
        iexcl: "\xA1",
        iff: "\u21D4",
        Ifr: "\u2111",
        ifr: "\u{1D526}",
        Igrave: "\xCC",
        igrave: "\xEC",
        ii: "\u2148",
        iiiint: "\u2A0C",
        iiint: "\u222D",
        iinfin: "\u29DC",
        iiota: "\u2129",
        IJlig: "\u0132",
        ijlig: "\u0133",
        Im: "\u2111",
        Imacr: "\u012A",
        imacr: "\u012B",
        image: "\u2111",
        ImaginaryI: "\u2148",
        imagline: "\u2110",
        imagpart: "\u2111",
        imath: "\u0131",
        imof: "\u22B7",
        imped: "\u01B5",
        Implies: "\u21D2",
        in: "\u2208",
        incare: "\u2105",
        infin: "\u221E",
        infintie: "\u29DD",
        inodot: "\u0131",
        Int: "\u222C",
        int: "\u222B",
        intcal: "\u22BA",
        integers: "\u2124",
        Integral: "\u222B",
        intercal: "\u22BA",
        Intersection: "\u22C2",
        intlarhk: "\u2A17",
        intprod: "\u2A3C",
        InvisibleComma: "\u2063",
        InvisibleTimes: "\u2062",
        IOcy: "\u0401",
        iocy: "\u0451",
        Iogon: "\u012E",
        iogon: "\u012F",
        Iopf: "\u{1D540}",
        iopf: "\u{1D55A}",
        Iota: "\u0399",
        iota: "\u03B9",
        iprod: "\u2A3C",
        iquest: "\xBF",
        Iscr: "\u2110",
        iscr: "\u{1D4BE}",
        isin: "\u2208",
        isindot: "\u22F5",
        isinE: "\u22F9",
        isins: "\u22F4",
        isinsv: "\u22F3",
        isinv: "\u2208",
        it: "\u2062",
        Itilde: "\u0128",
        itilde: "\u0129",
        Iukcy: "\u0406",
        iukcy: "\u0456",
        Iuml: "\xCF",
        iuml: "\xEF",
        Jcirc: "\u0134",
        jcirc: "\u0135",
        Jcy: "\u0419",
        jcy: "\u0439",
        Jfr: "\u{1D50D}",
        jfr: "\u{1D527}",
        jmath: "\u0237",
        Jopf: "\u{1D541}",
        jopf: "\u{1D55B}",
        Jscr: "\u{1D4A5}",
        jscr: "\u{1D4BF}",
        Jsercy: "\u0408",
        jsercy: "\u0458",
        Jukcy: "\u0404",
        jukcy: "\u0454",
        Kappa: "\u039A",
        kappa: "\u03BA",
        kappav: "\u03F0",
        Kcedil: "\u0136",
        kcedil: "\u0137",
        Kcy: "\u041A",
        kcy: "\u043A",
        Kfr: "\u{1D50E}",
        kfr: "\u{1D528}",
        kgreen: "\u0138",
        KHcy: "\u0425",
        khcy: "\u0445",
        KJcy: "\u040C",
        kjcy: "\u045C",
        Kopf: "\u{1D542}",
        kopf: "\u{1D55C}",
        Kscr: "\u{1D4A6}",
        kscr: "\u{1D4C0}",
        lAarr: "\u21DA",
        Lacute: "\u0139",
        lacute: "\u013A",
        laemptyv: "\u29B4",
        lagran: "\u2112",
        Lambda: "\u039B",
        lambda: "\u03BB",
        Lang: "\u27EA",
        lang: "\u27E8",
        langd: "\u2991",
        langle: "\u27E8",
        lap: "\u2A85",
        Laplacetrf: "\u2112",
        laquo: "\xAB",
        Larr: "\u219E",
        lArr: "\u21D0",
        larr: "\u2190",
        larrb: "\u21E4",
        larrbfs: "\u291F",
        larrfs: "\u291D",
        larrhk: "\u21A9",
        larrlp: "\u21AB",
        larrpl: "\u2939",
        larrsim: "\u2973",
        larrtl: "\u21A2",
        lat: "\u2AAB",
        lAtail: "\u291B",
        latail: "\u2919",
        late: "\u2AAD",
        lates: "\u2AAD\uFE00",
        lBarr: "\u290E",
        lbarr: "\u290C",
        lbbrk: "\u2772",
        lbrace: "{",
        lbrack: "[",
        lbrke: "\u298B",
        lbrksld: "\u298F",
        lbrkslu: "\u298D",
        Lcaron: "\u013D",
        lcaron: "\u013E",
        Lcedil: "\u013B",
        lcedil: "\u013C",
        lceil: "\u2308",
        lcub: "{",
        Lcy: "\u041B",
        lcy: "\u043B",
        ldca: "\u2936",
        ldquo: "\u201C",
        ldquor: "\u201E",
        ldrdhar: "\u2967",
        ldrushar: "\u294B",
        ldsh: "\u21B2",
        lE: "\u2266",
        le: "\u2264",
        LeftAngleBracket: "\u27E8",
        LeftArrow: "\u2190",
        Leftarrow: "\u21D0",
        leftarrow: "\u2190",
        LeftArrowBar: "\u21E4",
        LeftArrowRightArrow: "\u21C6",
        leftarrowtail: "\u21A2",
        LeftCeiling: "\u2308",
        LeftDoubleBracket: "\u27E6",
        LeftDownTeeVector: "\u2961",
        LeftDownVector: "\u21C3",
        LeftDownVectorBar: "\u2959",
        LeftFloor: "\u230A",
        leftharpoondown: "\u21BD",
        leftharpoonup: "\u21BC",
        leftleftarrows: "\u21C7",
        LeftRightArrow: "\u2194",
        Leftrightarrow: "\u21D4",
        leftrightarrow: "\u2194",
        leftrightarrows: "\u21C6",
        leftrightharpoons: "\u21CB",
        leftrightsquigarrow: "\u21AD",
        LeftRightVector: "\u294E",
        LeftTee: "\u22A3",
        LeftTeeArrow: "\u21A4",
        LeftTeeVector: "\u295A",
        leftthreetimes: "\u22CB",
        LeftTriangle: "\u22B2",
        LeftTriangleBar: "\u29CF",
        LeftTriangleEqual: "\u22B4",
        LeftUpDownVector: "\u2951",
        LeftUpTeeVector: "\u2960",
        LeftUpVector: "\u21BF",
        LeftUpVectorBar: "\u2958",
        LeftVector: "\u21BC",
        LeftVectorBar: "\u2952",
        lEg: "\u2A8B",
        leg: "\u22DA",
        leq: "\u2264",
        leqq: "\u2266",
        leqslant: "\u2A7D",
        les: "\u2A7D",
        lescc: "\u2AA8",
        lesdot: "\u2A7F",
        lesdoto: "\u2A81",
        lesdotor: "\u2A83",
        lesg: "\u22DA\uFE00",
        lesges: "\u2A93",
        lessapprox: "\u2A85",
        lessdot: "\u22D6",
        lesseqgtr: "\u22DA",
        lesseqqgtr: "\u2A8B",
        LessEqualGreater: "\u22DA",
        LessFullEqual: "\u2266",
        LessGreater: "\u2276",
        lessgtr: "\u2276",
        LessLess: "\u2AA1",
        lesssim: "\u2272",
        LessSlantEqual: "\u2A7D",
        LessTilde: "\u2272",
        lfisht: "\u297C",
        lfloor: "\u230A",
        Lfr: "\u{1D50F}",
        lfr: "\u{1D529}",
        lg: "\u2276",
        lgE: "\u2A91",
        lHar: "\u2962",
        lhard: "\u21BD",
        lharu: "\u21BC",
        lharul: "\u296A",
        lhblk: "\u2584",
        LJcy: "\u0409",
        ljcy: "\u0459",
        Ll: "\u22D8",
        ll: "\u226A",
        llarr: "\u21C7",
        llcorner: "\u231E",
        Lleftarrow: "\u21DA",
        llhard: "\u296B",
        lltri: "\u25FA",
        Lmidot: "\u013F",
        lmidot: "\u0140",
        lmoust: "\u23B0",
        lmoustache: "\u23B0",
        lnap: "\u2A89",
        lnapprox: "\u2A89",
        lnE: "\u2268",
        lne: "\u2A87",
        lneq: "\u2A87",
        lneqq: "\u2268",
        lnsim: "\u22E6",
        loang: "\u27EC",
        loarr: "\u21FD",
        lobrk: "\u27E6",
        LongLeftArrow: "\u27F5",
        Longleftarrow: "\u27F8",
        longleftarrow: "\u27F5",
        LongLeftRightArrow: "\u27F7",
        Longleftrightarrow: "\u27FA",
        longleftrightarrow: "\u27F7",
        longmapsto: "\u27FC",
        LongRightArrow: "\u27F6",
        Longrightarrow: "\u27F9",
        longrightarrow: "\u27F6",
        looparrowleft: "\u21AB",
        looparrowright: "\u21AC",
        lopar: "\u2985",
        Lopf: "\u{1D543}",
        lopf: "\u{1D55D}",
        loplus: "\u2A2D",
        lotimes: "\u2A34",
        lowast: "\u2217",
        lowbar: "_",
        LowerLeftArrow: "\u2199",
        LowerRightArrow: "\u2198",
        loz: "\u25CA",
        lozenge: "\u25CA",
        lozf: "\u29EB",
        lpar: "(",
        lparlt: "\u2993",
        lrarr: "\u21C6",
        lrcorner: "\u231F",
        lrhar: "\u21CB",
        lrhard: "\u296D",
        lrm: "\u200E",
        lrtri: "\u22BF",
        lsaquo: "\u2039",
        Lscr: "\u2112",
        lscr: "\u{1D4C1}",
        Lsh: "\u21B0",
        lsh: "\u21B0",
        lsim: "\u2272",
        lsime: "\u2A8D",
        lsimg: "\u2A8F",
        lsqb: "[",
        lsquo: "\u2018",
        lsquor: "\u201A",
        Lstrok: "\u0141",
        lstrok: "\u0142",
        Lt: "\u226A",
        LT: "<",
        lt: "<",
        ltcc: "\u2AA6",
        ltcir: "\u2A79",
        ltdot: "\u22D6",
        lthree: "\u22CB",
        ltimes: "\u22C9",
        ltlarr: "\u2976",
        ltquest: "\u2A7B",
        ltri: "\u25C3",
        ltrie: "\u22B4",
        ltrif: "\u25C2",
        ltrPar: "\u2996",
        lurdshar: "\u294A",
        luruhar: "\u2966",
        lvertneqq: "\u2268\uFE00",
        lvnE: "\u2268\uFE00",
        macr: "\xAF",
        male: "\u2642",
        malt: "\u2720",
        maltese: "\u2720",
        Map: "\u2905",
        map: "\u21A6",
        mapsto: "\u21A6",
        mapstodown: "\u21A7",
        mapstoleft: "\u21A4",
        mapstoup: "\u21A5",
        marker: "\u25AE",
        mcomma: "\u2A29",
        Mcy: "\u041C",
        mcy: "\u043C",
        mdash: "\u2014",
        mDDot: "\u223A",
        measuredangle: "\u2221",
        MediumSpace: "\u205F",
        Mellintrf: "\u2133",
        Mfr: "\u{1D510}",
        mfr: "\u{1D52A}",
        mho: "\u2127",
        micro: "\xB5",
        mid: "\u2223",
        midast: "*",
        midcir: "\u2AF0",
        middot: "\xB7",
        minus: "\u2212",
        minusb: "\u229F",
        minusd: "\u2238",
        minusdu: "\u2A2A",
        MinusPlus: "\u2213",
        mlcp: "\u2ADB",
        mldr: "\u2026",
        mnplus: "\u2213",
        models: "\u22A7",
        Mopf: "\u{1D544}",
        mopf: "\u{1D55E}",
        mp: "\u2213",
        Mscr: "\u2133",
        mscr: "\u{1D4C2}",
        mstpos: "\u223E",
        Mu: "\u039C",
        mu: "\u03BC",
        multimap: "\u22B8",
        mumap: "\u22B8",
        nabla: "\u2207",
        Nacute: "\u0143",
        nacute: "\u0144",
        nang: "\u2220\u20D2",
        nap: "\u2249",
        napE: "\u2A70\u0338",
        napid: "\u224B\u0338",
        napos: "\u0149",
        napprox: "\u2249",
        natur: "\u266E",
        natural: "\u266E",
        naturals: "\u2115",
        nbsp: "\xA0",
        nbump: "\u224E\u0338",
        nbumpe: "\u224F\u0338",
        ncap: "\u2A43",
        Ncaron: "\u0147",
        ncaron: "\u0148",
        Ncedil: "\u0145",
        ncedil: "\u0146",
        ncong: "\u2247",
        ncongdot: "\u2A6D\u0338",
        ncup: "\u2A42",
        Ncy: "\u041D",
        ncy: "\u043D",
        ndash: "\u2013",
        ne: "\u2260",
        nearhk: "\u2924",
        neArr: "\u21D7",
        nearr: "\u2197",
        nearrow: "\u2197",
        nedot: "\u2250\u0338",
        NegativeMediumSpace: "\u200B",
        NegativeThickSpace: "\u200B",
        NegativeThinSpace: "\u200B",
        NegativeVeryThinSpace: "\u200B",
        nequiv: "\u2262",
        nesear: "\u2928",
        nesim: "\u2242\u0338",
        NestedGreaterGreater: "\u226B",
        NestedLessLess: "\u226A",
        NewLine: "\n",
        nexist: "\u2204",
        nexists: "\u2204",
        Nfr: "\u{1D511}",
        nfr: "\u{1D52B}",
        ngE: "\u2267\u0338",
        nge: "\u2271",
        ngeq: "\u2271",
        ngeqq: "\u2267\u0338",
        ngeqslant: "\u2A7E\u0338",
        nges: "\u2A7E\u0338",
        nGg: "\u22D9\u0338",
        ngsim: "\u2275",
        nGt: "\u226B\u20D2",
        ngt: "\u226F",
        ngtr: "\u226F",
        nGtv: "\u226B\u0338",
        nhArr: "\u21CE",
        nharr: "\u21AE",
        nhpar: "\u2AF2",
        ni: "\u220B",
        nis: "\u22FC",
        nisd: "\u22FA",
        niv: "\u220B",
        NJcy: "\u040A",
        njcy: "\u045A",
        nlArr: "\u21CD",
        nlarr: "\u219A",
        nldr: "\u2025",
        nlE: "\u2266\u0338",
        nle: "\u2270",
        nLeftarrow: "\u21CD",
        nleftarrow: "\u219A",
        nLeftrightarrow: "\u21CE",
        nleftrightarrow: "\u21AE",
        nleq: "\u2270",
        nleqq: "\u2266\u0338",
        nleqslant: "\u2A7D\u0338",
        nles: "\u2A7D\u0338",
        nless: "\u226E",
        nLl: "\u22D8\u0338",
        nlsim: "\u2274",
        nLt: "\u226A\u20D2",
        nlt: "\u226E",
        nltri: "\u22EA",
        nltrie: "\u22EC",
        nLtv: "\u226A\u0338",
        nmid: "\u2224",
        NoBreak: "\u2060",
        NonBreakingSpace: "\xA0",
        Nopf: "\u2115",
        nopf: "\u{1D55F}",
        Not: "\u2AEC",
        not: "\xAC",
        NotCongruent: "\u2262",
        NotCupCap: "\u226D",
        NotDoubleVerticalBar: "\u2226",
        NotElement: "\u2209",
        NotEqual: "\u2260",
        NotEqualTilde: "\u2242\u0338",
        NotExists: "\u2204",
        NotGreater: "\u226F",
        NotGreaterEqual: "\u2271",
        NotGreaterFullEqual: "\u2267\u0338",
        NotGreaterGreater: "\u226B\u0338",
        NotGreaterLess: "\u2279",
        NotGreaterSlantEqual: "\u2A7E\u0338",
        NotGreaterTilde: "\u2275",
        NotHumpDownHump: "\u224E\u0338",
        NotHumpEqual: "\u224F\u0338",
        notin: "\u2209",
        notindot: "\u22F5\u0338",
        notinE: "\u22F9\u0338",
        notinva: "\u2209",
        notinvb: "\u22F7",
        notinvc: "\u22F6",
        NotLeftTriangle: "\u22EA",
        NotLeftTriangleBar: "\u29CF\u0338",
        NotLeftTriangleEqual: "\u22EC",
        NotLess: "\u226E",
        NotLessEqual: "\u2270",
        NotLessGreater: "\u2278",
        NotLessLess: "\u226A\u0338",
        NotLessSlantEqual: "\u2A7D\u0338",
        NotLessTilde: "\u2274",
        NotNestedGreaterGreater: "\u2AA2\u0338",
        NotNestedLessLess: "\u2AA1\u0338",
        notni: "\u220C",
        notniva: "\u220C",
        notnivb: "\u22FE",
        notnivc: "\u22FD",
        NotPrecedes: "\u2280",
        NotPrecedesEqual: "\u2AAF\u0338",
        NotPrecedesSlantEqual: "\u22E0",
        NotReverseElement: "\u220C",
        NotRightTriangle: "\u22EB",
        NotRightTriangleBar: "\u29D0\u0338",
        NotRightTriangleEqual: "\u22ED",
        NotSquareSubset: "\u228F\u0338",
        NotSquareSubsetEqual: "\u22E2",
        NotSquareSuperset: "\u2290\u0338",
        NotSquareSupersetEqual: "\u22E3",
        NotSubset: "\u2282\u20D2",
        NotSubsetEqual: "\u2288",
        NotSucceeds: "\u2281",
        NotSucceedsEqual: "\u2AB0\u0338",
        NotSucceedsSlantEqual: "\u22E1",
        NotSucceedsTilde: "\u227F\u0338",
        NotSuperset: "\u2283\u20D2",
        NotSupersetEqual: "\u2289",
        NotTilde: "\u2241",
        NotTildeEqual: "\u2244",
        NotTildeFullEqual: "\u2247",
        NotTildeTilde: "\u2249",
        NotVerticalBar: "\u2224",
        npar: "\u2226",
        nparallel: "\u2226",
        nparsl: "\u2AFD\u20E5",
        npart: "\u2202\u0338",
        npolint: "\u2A14",
        npr: "\u2280",
        nprcue: "\u22E0",
        npre: "\u2AAF\u0338",
        nprec: "\u2280",
        npreceq: "\u2AAF\u0338",
        nrArr: "\u21CF",
        nrarr: "\u219B",
        nrarrc: "\u2933\u0338",
        nrarrw: "\u219D\u0338",
        nRightarrow: "\u21CF",
        nrightarrow: "\u219B",
        nrtri: "\u22EB",
        nrtrie: "\u22ED",
        nsc: "\u2281",
        nsccue: "\u22E1",
        nsce: "\u2AB0\u0338",
        Nscr: "\u{1D4A9}",
        nscr: "\u{1D4C3}",
        nshortmid: "\u2224",
        nshortparallel: "\u2226",
        nsim: "\u2241",
        nsime: "\u2244",
        nsimeq: "\u2244",
        nsmid: "\u2224",
        nspar: "\u2226",
        nsqsube: "\u22E2",
        nsqsupe: "\u22E3",
        nsub: "\u2284",
        nsubE: "\u2AC5\u0338",
        nsube: "\u2288",
        nsubset: "\u2282\u20D2",
        nsubseteq: "\u2288",
        nsubseteqq: "\u2AC5\u0338",
        nsucc: "\u2281",
        nsucceq: "\u2AB0\u0338",
        nsup: "\u2285",
        nsupE: "\u2AC6\u0338",
        nsupe: "\u2289",
        nsupset: "\u2283\u20D2",
        nsupseteq: "\u2289",
        nsupseteqq: "\u2AC6\u0338",
        ntgl: "\u2279",
        Ntilde: "\xD1",
        ntilde: "\xF1",
        ntlg: "\u2278",
        ntriangleleft: "\u22EA",
        ntrianglelefteq: "\u22EC",
        ntriangleright: "\u22EB",
        ntrianglerighteq: "\u22ED",
        Nu: "\u039D",
        nu: "\u03BD",
        num: "#",
        numero: "\u2116",
        numsp: "\u2007",
        nvap: "\u224D\u20D2",
        nVDash: "\u22AF",
        nVdash: "\u22AE",
        nvDash: "\u22AD",
        nvdash: "\u22AC",
        nvge: "\u2265\u20D2",
        nvgt: ">\u20D2",
        nvHarr: "\u2904",
        nvinfin: "\u29DE",
        nvlArr: "\u2902",
        nvle: "\u2264\u20D2",
        nvlt: "<\u20D2",
        nvltrie: "\u22B4\u20D2",
        nvrArr: "\u2903",
        nvrtrie: "\u22B5\u20D2",
        nvsim: "\u223C\u20D2",
        nwarhk: "\u2923",
        nwArr: "\u21D6",
        nwarr: "\u2196",
        nwarrow: "\u2196",
        nwnear: "\u2927",
        Oacute: "\xD3",
        oacute: "\xF3",
        oast: "\u229B",
        ocir: "\u229A",
        Ocirc: "\xD4",
        ocirc: "\xF4",
        Ocy: "\u041E",
        ocy: "\u043E",
        odash: "\u229D",
        Odblac: "\u0150",
        odblac: "\u0151",
        odiv: "\u2A38",
        odot: "\u2299",
        odsold: "\u29BC",
        OElig: "\u0152",
        oelig: "\u0153",
        ofcir: "\u29BF",
        Ofr: "\u{1D512}",
        ofr: "\u{1D52C}",
        ogon: "\u02DB",
        Ograve: "\xD2",
        ograve: "\xF2",
        ogt: "\u29C1",
        ohbar: "\u29B5",
        ohm: "\u03A9",
        oint: "\u222E",
        olarr: "\u21BA",
        olcir: "\u29BE",
        olcross: "\u29BB",
        oline: "\u203E",
        olt: "\u29C0",
        Omacr: "\u014C",
        omacr: "\u014D",
        Omega: "\u03A9",
        omega: "\u03C9",
        Omicron: "\u039F",
        omicron: "\u03BF",
        omid: "\u29B6",
        ominus: "\u2296",
        Oopf: "\u{1D546}",
        oopf: "\u{1D560}",
        opar: "\u29B7",
        OpenCurlyDoubleQuote: "\u201C",
        OpenCurlyQuote: "\u2018",
        operp: "\u29B9",
        oplus: "\u2295",
        Or: "\u2A54",
        or: "\u2228",
        orarr: "\u21BB",
        ord: "\u2A5D",
        order: "\u2134",
        orderof: "\u2134",
        ordf: "\xAA",
        ordm: "\xBA",
        origof: "\u22B6",
        oror: "\u2A56",
        orslope: "\u2A57",
        orv: "\u2A5B",
        oS: "\u24C8",
        Oscr: "\u{1D4AA}",
        oscr: "\u2134",
        Oslash: "\xD8",
        oslash: "\xF8",
        osol: "\u2298",
        Otilde: "\xD5",
        otilde: "\xF5",
        Otimes: "\u2A37",
        otimes: "\u2297",
        otimesas: "\u2A36",
        Ouml: "\xD6",
        ouml: "\xF6",
        ovbar: "\u233D",
        OverBar: "\u203E",
        OverBrace: "\u23DE",
        OverBracket: "\u23B4",
        OverParenthesis: "\u23DC",
        par: "\u2225",
        para: "\xB6",
        parallel: "\u2225",
        parsim: "\u2AF3",
        parsl: "\u2AFD",
        part: "\u2202",
        PartialD: "\u2202",
        Pcy: "\u041F",
        pcy: "\u043F",
        percnt: "%",
        period: ".",
        permil: "\u2030",
        perp: "\u22A5",
        pertenk: "\u2031",
        Pfr: "\u{1D513}",
        pfr: "\u{1D52D}",
        Phi: "\u03A6",
        phi: "\u03C6",
        phiv: "\u03D5",
        phmmat: "\u2133",
        phone: "\u260E",
        Pi: "\u03A0",
        pi: "\u03C0",
        pitchfork: "\u22D4",
        piv: "\u03D6",
        planck: "\u210F",
        planckh: "\u210E",
        plankv: "\u210F",
        plus: "+",
        plusacir: "\u2A23",
        plusb: "\u229E",
        pluscir: "\u2A22",
        plusdo: "\u2214",
        plusdu: "\u2A25",
        pluse: "\u2A72",
        PlusMinus: "\xB1",
        plusmn: "\xB1",
        plussim: "\u2A26",
        plustwo: "\u2A27",
        pm: "\xB1",
        Poincareplane: "\u210C",
        pointint: "\u2A15",
        Popf: "\u2119",
        popf: "\u{1D561}",
        pound: "\xA3",
        Pr: "\u2ABB",
        pr: "\u227A",
        prap: "\u2AB7",
        prcue: "\u227C",
        prE: "\u2AB3",
        pre: "\u2AAF",
        prec: "\u227A",
        precapprox: "\u2AB7",
        preccurlyeq: "\u227C",
        Precedes: "\u227A",
        PrecedesEqual: "\u2AAF",
        PrecedesSlantEqual: "\u227C",
        PrecedesTilde: "\u227E",
        preceq: "\u2AAF",
        precnapprox: "\u2AB9",
        precneqq: "\u2AB5",
        precnsim: "\u22E8",
        precsim: "\u227E",
        Prime: "\u2033",
        prime: "\u2032",
        primes: "\u2119",
        prnap: "\u2AB9",
        prnE: "\u2AB5",
        prnsim: "\u22E8",
        prod: "\u220F",
        Product: "\u220F",
        profalar: "\u232E",
        profline: "\u2312",
        profsurf: "\u2313",
        prop: "\u221D",
        Proportion: "\u2237",
        Proportional: "\u221D",
        propto: "\u221D",
        prsim: "\u227E",
        prurel: "\u22B0",
        Pscr: "\u{1D4AB}",
        pscr: "\u{1D4C5}",
        Psi: "\u03A8",
        psi: "\u03C8",
        puncsp: "\u2008",
        Qfr: "\u{1D514}",
        qfr: "\u{1D52E}",
        qint: "\u2A0C",
        Qopf: "\u211A",
        qopf: "\u{1D562}",
        qprime: "\u2057",
        Qscr: "\u{1D4AC}",
        qscr: "\u{1D4C6}",
        quaternions: "\u210D",
        quatint: "\u2A16",
        quest: "?",
        questeq: "\u225F",
        QUOT: '"',
        quot: '"',
        rAarr: "\u21DB",
        race: "\u223D\u0331",
        Racute: "\u0154",
        racute: "\u0155",
        radic: "\u221A",
        raemptyv: "\u29B3",
        Rang: "\u27EB",
        rang: "\u27E9",
        rangd: "\u2992",
        range: "\u29A5",
        rangle: "\u27E9",
        raquo: "\xBB",
        Rarr: "\u21A0",
        rArr: "\u21D2",
        rarr: "\u2192",
        rarrap: "\u2975",
        rarrb: "\u21E5",
        rarrbfs: "\u2920",
        rarrc: "\u2933",
        rarrfs: "\u291E",
        rarrhk: "\u21AA",
        rarrlp: "\u21AC",
        rarrpl: "\u2945",
        rarrsim: "\u2974",
        Rarrtl: "\u2916",
        rarrtl: "\u21A3",
        rarrw: "\u219D",
        rAtail: "\u291C",
        ratail: "\u291A",
        ratio: "\u2236",
        rationals: "\u211A",
        RBarr: "\u2910",
        rBarr: "\u290F",
        rbarr: "\u290D",
        rbbrk: "\u2773",
        rbrace: "}",
        rbrack: "]",
        rbrke: "\u298C",
        rbrksld: "\u298E",
        rbrkslu: "\u2990",
        Rcaron: "\u0158",
        rcaron: "\u0159",
        Rcedil: "\u0156",
        rcedil: "\u0157",
        rceil: "\u2309",
        rcub: "}",
        Rcy: "\u0420",
        rcy: "\u0440",
        rdca: "\u2937",
        rdldhar: "\u2969",
        rdquo: "\u201D",
        rdquor: "\u201D",
        rdsh: "\u21B3",
        Re: "\u211C",
        real: "\u211C",
        realine: "\u211B",
        realpart: "\u211C",
        reals: "\u211D",
        rect: "\u25AD",
        REG: "\xAE",
        reg: "\xAE",
        ReverseElement: "\u220B",
        ReverseEquilibrium: "\u21CB",
        ReverseUpEquilibrium: "\u296F",
        rfisht: "\u297D",
        rfloor: "\u230B",
        Rfr: "\u211C",
        rfr: "\u{1D52F}",
        rHar: "\u2964",
        rhard: "\u21C1",
        rharu: "\u21C0",
        rharul: "\u296C",
        Rho: "\u03A1",
        rho: "\u03C1",
        rhov: "\u03F1",
        RightAngleBracket: "\u27E9",
        RightArrow: "\u2192",
        Rightarrow: "\u21D2",
        rightarrow: "\u2192",
        RightArrowBar: "\u21E5",
        RightArrowLeftArrow: "\u21C4",
        rightarrowtail: "\u21A3",
        RightCeiling: "\u2309",
        RightDoubleBracket: "\u27E7",
        RightDownTeeVector: "\u295D",
        RightDownVector: "\u21C2",
        RightDownVectorBar: "\u2955",
        RightFloor: "\u230B",
        rightharpoondown: "\u21C1",
        rightharpoonup: "\u21C0",
        rightleftarrows: "\u21C4",
        rightleftharpoons: "\u21CC",
        rightrightarrows: "\u21C9",
        rightsquigarrow: "\u219D",
        RightTee: "\u22A2",
        RightTeeArrow: "\u21A6",
        RightTeeVector: "\u295B",
        rightthreetimes: "\u22CC",
        RightTriangle: "\u22B3",
        RightTriangleBar: "\u29D0",
        RightTriangleEqual: "\u22B5",
        RightUpDownVector: "\u294F",
        RightUpTeeVector: "\u295C",
        RightUpVector: "\u21BE",
        RightUpVectorBar: "\u2954",
        RightVector: "\u21C0",
        RightVectorBar: "\u2953",
        ring: "\u02DA",
        risingdotseq: "\u2253",
        rlarr: "\u21C4",
        rlhar: "\u21CC",
        rlm: "\u200F",
        rmoust: "\u23B1",
        rmoustache: "\u23B1",
        rnmid: "\u2AEE",
        roang: "\u27ED",
        roarr: "\u21FE",
        robrk: "\u27E7",
        ropar: "\u2986",
        Ropf: "\u211D",
        ropf: "\u{1D563}",
        roplus: "\u2A2E",
        rotimes: "\u2A35",
        RoundImplies: "\u2970",
        rpar: ")",
        rpargt: "\u2994",
        rppolint: "\u2A12",
        rrarr: "\u21C9",
        Rrightarrow: "\u21DB",
        rsaquo: "\u203A",
        Rscr: "\u211B",
        rscr: "\u{1D4C7}",
        Rsh: "\u21B1",
        rsh: "\u21B1",
        rsqb: "]",
        rsquo: "\u2019",
        rsquor: "\u2019",
        rthree: "\u22CC",
        rtimes: "\u22CA",
        rtri: "\u25B9",
        rtrie: "\u22B5",
        rtrif: "\u25B8",
        rtriltri: "\u29CE",
        RuleDelayed: "\u29F4",
        ruluhar: "\u2968",
        rx: "\u211E",
        Sacute: "\u015A",
        sacute: "\u015B",
        sbquo: "\u201A",
        Sc: "\u2ABC",
        sc: "\u227B",
        scap: "\u2AB8",
        Scaron: "\u0160",
        scaron: "\u0161",
        sccue: "\u227D",
        scE: "\u2AB4",
        sce: "\u2AB0",
        Scedil: "\u015E",
        scedil: "\u015F",
        Scirc: "\u015C",
        scirc: "\u015D",
        scnap: "\u2ABA",
        scnE: "\u2AB6",
        scnsim: "\u22E9",
        scpolint: "\u2A13",
        scsim: "\u227F",
        Scy: "\u0421",
        scy: "\u0441",
        sdot: "\u22C5",
        sdotb: "\u22A1",
        sdote: "\u2A66",
        searhk: "\u2925",
        seArr: "\u21D8",
        searr: "\u2198",
        searrow: "\u2198",
        sect: "\xA7",
        semi: ";",
        seswar: "\u2929",
        setminus: "\u2216",
        setmn: "\u2216",
        sext: "\u2736",
        Sfr: "\u{1D516}",
        sfr: "\u{1D530}",
        sfrown: "\u2322",
        sharp: "\u266F",
        SHCHcy: "\u0429",
        shchcy: "\u0449",
        SHcy: "\u0428",
        shcy: "\u0448",
        ShortDownArrow: "\u2193",
        ShortLeftArrow: "\u2190",
        shortmid: "\u2223",
        shortparallel: "\u2225",
        ShortRightArrow: "\u2192",
        ShortUpArrow: "\u2191",
        shy: "\xAD",
        Sigma: "\u03A3",
        sigma: "\u03C3",
        sigmaf: "\u03C2",
        sigmav: "\u03C2",
        sim: "\u223C",
        simdot: "\u2A6A",
        sime: "\u2243",
        simeq: "\u2243",
        simg: "\u2A9E",
        simgE: "\u2AA0",
        siml: "\u2A9D",
        simlE: "\u2A9F",
        simne: "\u2246",
        simplus: "\u2A24",
        simrarr: "\u2972",
        slarr: "\u2190",
        SmallCircle: "\u2218",
        smallsetminus: "\u2216",
        smashp: "\u2A33",
        smeparsl: "\u29E4",
        smid: "\u2223",
        smile: "\u2323",
        smt: "\u2AAA",
        smte: "\u2AAC",
        smtes: "\u2AAC\uFE00",
        SOFTcy: "\u042C",
        softcy: "\u044C",
        sol: "/",
        solb: "\u29C4",
        solbar: "\u233F",
        Sopf: "\u{1D54A}",
        sopf: "\u{1D564}",
        spades: "\u2660",
        spadesuit: "\u2660",
        spar: "\u2225",
        sqcap: "\u2293",
        sqcaps: "\u2293\uFE00",
        sqcup: "\u2294",
        sqcups: "\u2294\uFE00",
        Sqrt: "\u221A",
        sqsub: "\u228F",
        sqsube: "\u2291",
        sqsubset: "\u228F",
        sqsubseteq: "\u2291",
        sqsup: "\u2290",
        sqsupe: "\u2292",
        sqsupset: "\u2290",
        sqsupseteq: "\u2292",
        squ: "\u25A1",
        Square: "\u25A1",
        square: "\u25A1",
        SquareIntersection: "\u2293",
        SquareSubset: "\u228F",
        SquareSubsetEqual: "\u2291",
        SquareSuperset: "\u2290",
        SquareSupersetEqual: "\u2292",
        SquareUnion: "\u2294",
        squarf: "\u25AA",
        squf: "\u25AA",
        srarr: "\u2192",
        Sscr: "\u{1D4AE}",
        sscr: "\u{1D4C8}",
        ssetmn: "\u2216",
        ssmile: "\u2323",
        sstarf: "\u22C6",
        Star: "\u22C6",
        star: "\u2606",
        starf: "\u2605",
        straightepsilon: "\u03F5",
        straightphi: "\u03D5",
        strns: "\xAF",
        Sub: "\u22D0",
        sub: "\u2282",
        subdot: "\u2ABD",
        subE: "\u2AC5",
        sube: "\u2286",
        subedot: "\u2AC3",
        submult: "\u2AC1",
        subnE: "\u2ACB",
        subne: "\u228A",
        subplus: "\u2ABF",
        subrarr: "\u2979",
        Subset: "\u22D0",
        subset: "\u2282",
        subseteq: "\u2286",
        subseteqq: "\u2AC5",
        SubsetEqual: "\u2286",
        subsetneq: "\u228A",
        subsetneqq: "\u2ACB",
        subsim: "\u2AC7",
        subsub: "\u2AD5",
        subsup: "\u2AD3",
        succ: "\u227B",
        succapprox: "\u2AB8",
        succcurlyeq: "\u227D",
        Succeeds: "\u227B",
        SucceedsEqual: "\u2AB0",
        SucceedsSlantEqual: "\u227D",
        SucceedsTilde: "\u227F",
        succeq: "\u2AB0",
        succnapprox: "\u2ABA",
        succneqq: "\u2AB6",
        succnsim: "\u22E9",
        succsim: "\u227F",
        SuchThat: "\u220B",
        Sum: "\u2211",
        sum: "\u2211",
        sung: "\u266A",
        Sup: "\u22D1",
        sup: "\u2283",
        sup1: "\xB9",
        sup2: "\xB2",
        sup3: "\xB3",
        supdot: "\u2ABE",
        supdsub: "\u2AD8",
        supE: "\u2AC6",
        supe: "\u2287",
        supedot: "\u2AC4",
        Superset: "\u2283",
        SupersetEqual: "\u2287",
        suphsol: "\u27C9",
        suphsub: "\u2AD7",
        suplarr: "\u297B",
        supmult: "\u2AC2",
        supnE: "\u2ACC",
        supne: "\u228B",
        supplus: "\u2AC0",
        Supset: "\u22D1",
        supset: "\u2283",
        supseteq: "\u2287",
        supseteqq: "\u2AC6",
        supsetneq: "\u228B",
        supsetneqq: "\u2ACC",
        supsim: "\u2AC8",
        supsub: "\u2AD4",
        supsup: "\u2AD6",
        swarhk: "\u2926",
        swArr: "\u21D9",
        swarr: "\u2199",
        swarrow: "\u2199",
        swnwar: "\u292A",
        szlig: "\xDF",
        Tab: "	",
        target: "\u2316",
        Tau: "\u03A4",
        tau: "\u03C4",
        tbrk: "\u23B4",
        Tcaron: "\u0164",
        tcaron: "\u0165",
        Tcedil: "\u0162",
        tcedil: "\u0163",
        Tcy: "\u0422",
        tcy: "\u0442",
        tdot: "\u20DB",
        telrec: "\u2315",
        Tfr: "\u{1D517}",
        tfr: "\u{1D531}",
        there4: "\u2234",
        Therefore: "\u2234",
        therefore: "\u2234",
        Theta: "\u0398",
        theta: "\u03B8",
        thetasym: "\u03D1",
        thetav: "\u03D1",
        thickapprox: "\u2248",
        thicksim: "\u223C",
        ThickSpace: "\u205F\u200A",
        thinsp: "\u2009",
        ThinSpace: "\u2009",
        thkap: "\u2248",
        thksim: "\u223C",
        THORN: "\xDE",
        thorn: "\xFE",
        Tilde: "\u223C",
        tilde: "\u02DC",
        TildeEqual: "\u2243",
        TildeFullEqual: "\u2245",
        TildeTilde: "\u2248",
        times: "\xD7",
        timesb: "\u22A0",
        timesbar: "\u2A31",
        timesd: "\u2A30",
        tint: "\u222D",
        toea: "\u2928",
        top: "\u22A4",
        topbot: "\u2336",
        topcir: "\u2AF1",
        Topf: "\u{1D54B}",
        topf: "\u{1D565}",
        topfork: "\u2ADA",
        tosa: "\u2929",
        tprime: "\u2034",
        TRADE: "\u2122",
        trade: "\u2122",
        triangle: "\u25B5",
        triangledown: "\u25BF",
        triangleleft: "\u25C3",
        trianglelefteq: "\u22B4",
        triangleq: "\u225C",
        triangleright: "\u25B9",
        trianglerighteq: "\u22B5",
        tridot: "\u25EC",
        trie: "\u225C",
        triminus: "\u2A3A",
        TripleDot: "\u20DB",
        triplus: "\u2A39",
        trisb: "\u29CD",
        tritime: "\u2A3B",
        trpezium: "\u23E2",
        Tscr: "\u{1D4AF}",
        tscr: "\u{1D4C9}",
        TScy: "\u0426",
        tscy: "\u0446",
        TSHcy: "\u040B",
        tshcy: "\u045B",
        Tstrok: "\u0166",
        tstrok: "\u0167",
        twixt: "\u226C",
        twoheadleftarrow: "\u219E",
        twoheadrightarrow: "\u21A0",
        Uacute: "\xDA",
        uacute: "\xFA",
        Uarr: "\u219F",
        uArr: "\u21D1",
        uarr: "\u2191",
        Uarrocir: "\u2949",
        Ubrcy: "\u040E",
        ubrcy: "\u045E",
        Ubreve: "\u016C",
        ubreve: "\u016D",
        Ucirc: "\xDB",
        ucirc: "\xFB",
        Ucy: "\u0423",
        ucy: "\u0443",
        udarr: "\u21C5",
        Udblac: "\u0170",
        udblac: "\u0171",
        udhar: "\u296E",
        ufisht: "\u297E",
        Ufr: "\u{1D518}",
        ufr: "\u{1D532}",
        Ugrave: "\xD9",
        ugrave: "\xF9",
        uHar: "\u2963",
        uharl: "\u21BF",
        uharr: "\u21BE",
        uhblk: "\u2580",
        ulcorn: "\u231C",
        ulcorner: "\u231C",
        ulcrop: "\u230F",
        ultri: "\u25F8",
        Umacr: "\u016A",
        umacr: "\u016B",
        uml: "\xA8",
        UnderBar: "_",
        UnderBrace: "\u23DF",
        UnderBracket: "\u23B5",
        UnderParenthesis: "\u23DD",
        Union: "\u22C3",
        UnionPlus: "\u228E",
        Uogon: "\u0172",
        uogon: "\u0173",
        Uopf: "\u{1D54C}",
        uopf: "\u{1D566}",
        UpArrow: "\u2191",
        Uparrow: "\u21D1",
        uparrow: "\u2191",
        UpArrowBar: "\u2912",
        UpArrowDownArrow: "\u21C5",
        UpDownArrow: "\u2195",
        Updownarrow: "\u21D5",
        updownarrow: "\u2195",
        UpEquilibrium: "\u296E",
        upharpoonleft: "\u21BF",
        upharpoonright: "\u21BE",
        uplus: "\u228E",
        UpperLeftArrow: "\u2196",
        UpperRightArrow: "\u2197",
        Upsi: "\u03D2",
        upsi: "\u03C5",
        upsih: "\u03D2",
        Upsilon: "\u03A5",
        upsilon: "\u03C5",
        UpTee: "\u22A5",
        UpTeeArrow: "\u21A5",
        upuparrows: "\u21C8",
        urcorn: "\u231D",
        urcorner: "\u231D",
        urcrop: "\u230E",
        Uring: "\u016E",
        uring: "\u016F",
        urtri: "\u25F9",
        Uscr: "\u{1D4B0}",
        uscr: "\u{1D4CA}",
        utdot: "\u22F0",
        Utilde: "\u0168",
        utilde: "\u0169",
        utri: "\u25B5",
        utrif: "\u25B4",
        uuarr: "\u21C8",
        Uuml: "\xDC",
        uuml: "\xFC",
        uwangle: "\u29A7",
        vangrt: "\u299C",
        varepsilon: "\u03F5",
        varkappa: "\u03F0",
        varnothing: "\u2205",
        varphi: "\u03D5",
        varpi: "\u03D6",
        varpropto: "\u221D",
        vArr: "\u21D5",
        varr: "\u2195",
        varrho: "\u03F1",
        varsigma: "\u03C2",
        varsubsetneq: "\u228A\uFE00",
        varsubsetneqq: "\u2ACB\uFE00",
        varsupsetneq: "\u228B\uFE00",
        varsupsetneqq: "\u2ACC\uFE00",
        vartheta: "\u03D1",
        vartriangleleft: "\u22B2",
        vartriangleright: "\u22B3",
        Vbar: "\u2AEB",
        vBar: "\u2AE8",
        vBarv: "\u2AE9",
        Vcy: "\u0412",
        vcy: "\u0432",
        VDash: "\u22AB",
        Vdash: "\u22A9",
        vDash: "\u22A8",
        vdash: "\u22A2",
        Vdashl: "\u2AE6",
        Vee: "\u22C1",
        vee: "\u2228",
        veebar: "\u22BB",
        veeeq: "\u225A",
        vellip: "\u22EE",
        Verbar: "\u2016",
        verbar: "|",
        Vert: "\u2016",
        vert: "|",
        VerticalBar: "\u2223",
        VerticalLine: "|",
        VerticalSeparator: "\u2758",
        VerticalTilde: "\u2240",
        VeryThinSpace: "\u200A",
        Vfr: "\u{1D519}",
        vfr: "\u{1D533}",
        vltri: "\u22B2",
        vnsub: "\u2282\u20D2",
        vnsup: "\u2283\u20D2",
        Vopf: "\u{1D54D}",
        vopf: "\u{1D567}",
        vprop: "\u221D",
        vrtri: "\u22B3",
        Vscr: "\u{1D4B1}",
        vscr: "\u{1D4CB}",
        vsubnE: "\u2ACB\uFE00",
        vsubne: "\u228A\uFE00",
        vsupnE: "\u2ACC\uFE00",
        vsupne: "\u228B\uFE00",
        Vvdash: "\u22AA",
        vzigzag: "\u299A",
        Wcirc: "\u0174",
        wcirc: "\u0175",
        wedbar: "\u2A5F",
        Wedge: "\u22C0",
        wedge: "\u2227",
        wedgeq: "\u2259",
        weierp: "\u2118",
        Wfr: "\u{1D51A}",
        wfr: "\u{1D534}",
        Wopf: "\u{1D54E}",
        wopf: "\u{1D568}",
        wp: "\u2118",
        wr: "\u2240",
        wreath: "\u2240",
        Wscr: "\u{1D4B2}",
        wscr: "\u{1D4CC}",
        xcap: "\u22C2",
        xcirc: "\u25EF",
        xcup: "\u22C3",
        xdtri: "\u25BD",
        Xfr: "\u{1D51B}",
        xfr: "\u{1D535}",
        xhArr: "\u27FA",
        xharr: "\u27F7",
        Xi: "\u039E",
        xi: "\u03BE",
        xlArr: "\u27F8",
        xlarr: "\u27F5",
        xmap: "\u27FC",
        xnis: "\u22FB",
        xodot: "\u2A00",
        Xopf: "\u{1D54F}",
        xopf: "\u{1D569}",
        xoplus: "\u2A01",
        xotime: "\u2A02",
        xrArr: "\u27F9",
        xrarr: "\u27F6",
        Xscr: "\u{1D4B3}",
        xscr: "\u{1D4CD}",
        xsqcup: "\u2A06",
        xuplus: "\u2A04",
        xutri: "\u25B3",
        xvee: "\u22C1",
        xwedge: "\u22C0",
        Yacute: "\xDD",
        yacute: "\xFD",
        YAcy: "\u042F",
        yacy: "\u044F",
        Ycirc: "\u0176",
        ycirc: "\u0177",
        Ycy: "\u042B",
        ycy: "\u044B",
        yen: "\xA5",
        Yfr: "\u{1D51C}",
        yfr: "\u{1D536}",
        YIcy: "\u0407",
        yicy: "\u0457",
        Yopf: "\u{1D550}",
        yopf: "\u{1D56A}",
        Yscr: "\u{1D4B4}",
        yscr: "\u{1D4CE}",
        YUcy: "\u042E",
        yucy: "\u044E",
        Yuml: "\u0178",
        yuml: "\xFF",
        Zacute: "\u0179",
        zacute: "\u017A",
        Zcaron: "\u017D",
        zcaron: "\u017E",
        Zcy: "\u0417",
        zcy: "\u0437",
        Zdot: "\u017B",
        zdot: "\u017C",
        zeetrf: "\u2128",
        ZeroWidthSpace: "\u200B",
        Zeta: "\u0396",
        zeta: "\u03B6",
        Zfr: "\u2128",
        zfr: "\u{1D537}",
        ZHcy: "\u0416",
        zhcy: "\u0436",
        zigrarr: "\u21DD",
        Zopf: "\u2124",
        zopf: "\u{1D56B}",
        Zscr: "\u{1D4B5}",
        zscr: "\u{1D4CF}",
        zwj: "\u200D",
        zwnj: "\u200C"
      });
      exports.entityMap = exports.HTML_ENTITIES;
    }
  });

  // node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/sax.js
  var require_sax = __commonJS({
    "node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/sax.js"(exports) {
      "use strict";
      var conventions = require_conventions();
      var g = require_grammar();
      var errors = require_errors();
      var isHTMLEscapableRawTextElement = conventions.isHTMLEscapableRawTextElement;
      var isHTMLMimeType = conventions.isHTMLMimeType;
      var isHTMLRawTextElement = conventions.isHTMLRawTextElement;
      var hasOwn = conventions.hasOwn;
      var NAMESPACE = conventions.NAMESPACE;
      var ParseError = errors.ParseError;
      var DOMException = errors.DOMException;
      var S_TAG = 0;
      var S_ATTR = 1;
      var S_ATTR_SPACE = 2;
      var S_EQ = 3;
      var S_ATTR_NOQUOT_VALUE = 4;
      var S_ATTR_END = 5;
      var S_TAG_SPACE = 6;
      var S_TAG_CLOSE = 7;
      function XMLReader() {
      }
      XMLReader.prototype = {
        parse: function(source, defaultNSMap, entityMap) {
          var domBuilder = this.domBuilder;
          domBuilder.startDocument();
          _copy(defaultNSMap, defaultNSMap = /* @__PURE__ */ Object.create(null));
          parse2(source, defaultNSMap, entityMap, domBuilder, this.errorHandler);
          domBuilder.endDocument();
        }
      };
      var ENTITY_REG = /&#?\w+;?/g;
      function parse2(source, defaultNSMapCopy, entityMap, domBuilder, errorHandler) {
        var isHTML = isHTMLMimeType(domBuilder.mimeType);
        if (source.indexOf(g.UNICODE_REPLACEMENT_CHARACTER) >= 0) {
          errorHandler.warning("Unicode replacement character detected, source encoding issues?");
        }
        function fixedFromCharCode(code) {
          if (code > 65535) {
            code -= 65536;
            var surrogate1 = 55296 + (code >> 10), surrogate2 = 56320 + (code & 1023);
            return String.fromCharCode(surrogate1, surrogate2);
          } else {
            return String.fromCharCode(code);
          }
        }
        function entityReplacer(a2) {
          var complete = a2[a2.length - 1] === ";" ? a2 : a2 + ";";
          if (!isHTML && complete !== a2) {
            errorHandler.error("EntityRef: expecting ;");
            return a2;
          }
          var match = g.Reference.exec(complete);
          if (!match || match[0].length !== complete.length) {
            errorHandler.error("entity not matching Reference production: " + a2);
            return a2;
          }
          var k = complete.slice(1, -1);
          if (hasOwn(entityMap, k)) {
            return entityMap[k];
          } else if (k.charAt(0) === "#") {
            return fixedFromCharCode(parseInt(k.substring(1).replace("x", "0x")));
          } else {
            errorHandler.error("entity not found:" + a2);
            return a2;
          }
        }
        function appendText(end2) {
          if (end2 > start) {
            var xt = source.substring(start, end2).replace(ENTITY_REG, entityReplacer);
            locator && position(start);
            domBuilder.characters(xt, 0, end2 - start);
            start = end2;
          }
        }
        var lineStart = 0;
        var lineEnd = 0;
        var linePattern = /\r\n?|\n|$/g;
        var locator = domBuilder.locator;
        function position(p, m) {
          while (p >= lineEnd && (m = linePattern.exec(source))) {
            lineStart = lineEnd;
            lineEnd = m.index + m[0].length;
            locator.lineNumber++;
          }
          locator.columnNumber = p - lineStart + 1;
        }
        var parseStack = [{ currentNSMap: defaultNSMapCopy }];
        var unclosedTags = [];
        var start = 0;
        while (true) {
          try {
            var tagStart = source.indexOf("<", start);
            if (tagStart < 0) {
              if (!isHTML && unclosedTags.length > 0) {
                return errorHandler.fatalError("unclosed xml tag(s): " + unclosedTags.join(", "));
              }
              if (!source.substring(start).match(/^\s*$/)) {
                var doc = domBuilder.doc;
                var text = doc.createTextNode(source.substring(start));
                if (doc.documentElement) {
                  return errorHandler.error("Extra content at the end of the document");
                }
                doc.appendChild(text);
                domBuilder.currentElement = text;
              }
              return;
            }
            if (tagStart > start) {
              var fromSource = source.substring(start, tagStart);
              if (!isHTML && unclosedTags.length === 0) {
                fromSource = fromSource.replace(new RegExp(g.S_OPT.source, "g"), "");
                fromSource && errorHandler.error("Unexpected content outside root element: '" + fromSource + "'");
              }
              appendText(tagStart);
            }
            switch (source.charAt(tagStart + 1)) {
              case "/":
                var end = source.indexOf(">", tagStart + 2);
                var tagNameRaw = source.substring(tagStart + 2, end > 0 ? end : void 0);
                if (!tagNameRaw) {
                  return errorHandler.fatalError("end tag name missing");
                }
                var endTagNameStrict = g.reg("^", g.QName_group, g.S_OPT, "$");
                var tagNameMatch = end > 0 && endTagNameStrict.exec(tagNameRaw);
                if (!tagNameMatch) {
                  var leadingTagNameMatch = end > 0 && g.reg("^", g.QName_group).exec(tagNameRaw);
                  if (isHTML && leadingTagNameMatch) {
                    errorHandler.warning('end tag name contains invalid trailing characters: "' + tagNameRaw + '"');
                    tagNameMatch = leadingTagNameMatch;
                  } else if (
                    // Backward compatibility, remove this whole `else if` arm in the next breaking release
                    // (XML then falls through to the `fatalError` below, for a clean mode split: XML fatal,
                    // HTML warning). A valid end-tag name followed by a line break and trailing content was
                    // silently accepted while `reg` still used the `m` flag; re-adding `m` here matches exactly
                    // those inputs, kept recoverable and reported.
                    leadingTagNameMatch && new RegExp(endTagNameStrict.source, endTagNameStrict.flags + "m").test(tagNameRaw)
                  ) {
                    errorHandler.error('end tag name is followed by a line break and trailing content: "' + tagNameRaw + '"');
                    tagNameMatch = leadingTagNameMatch;
                  } else {
                    return errorHandler.fatalError('end tag name contains invalid characters: "' + tagNameRaw + '"');
                  }
                }
                if (!domBuilder.currentElement && !domBuilder.doc.documentElement) {
                  return;
                }
                var currentTagName = unclosedTags[unclosedTags.length - 1] || domBuilder.currentElement.tagName || domBuilder.doc.documentElement.tagName || "";
                if (currentTagName !== tagNameMatch[1]) {
                  var tagNameLower = tagNameMatch[1].toLowerCase();
                  if (!isHTML || currentTagName.toLowerCase() !== tagNameLower) {
                    return errorHandler.fatalError('Opening and ending tag mismatch: "' + currentTagName + '" != "' + tagNameRaw + '"');
                  }
                }
                var config = parseStack.pop();
                unclosedTags.pop();
                var localNSMap = config.localNSMap;
                domBuilder.endElement(config.uri, config.localName, currentTagName);
                if (localNSMap) {
                  for (var prefix in localNSMap) {
                    if (hasOwn(localNSMap, prefix)) {
                      domBuilder.endPrefixMapping(prefix);
                    }
                  }
                }
                end++;
                break;
              // end element
              case "?":
                locator && position(tagStart);
                end = parseProcessingInstruction(source, tagStart, domBuilder, errorHandler);
                break;
              case "!":
                locator && position(tagStart);
                end = parseDoctypeCommentOrCData(source, tagStart, domBuilder, errorHandler, isHTML);
                break;
              default:
                locator && position(tagStart);
                var el = new ElementAttributes();
                var currentNSMap = parseStack[parseStack.length - 1].currentNSMap;
                var end = parseElementStartPart(source, tagStart, el, currentNSMap, entityReplacer, errorHandler, isHTML);
                var len = el.length;
                if (!el.closed) {
                  if (isHTML && conventions.isHTMLVoidElement(el.tagName)) {
                    el.closed = true;
                  } else {
                    unclosedTags.push(el.tagName);
                  }
                }
                if (locator && len) {
                  var locator2 = copyLocator(locator, {});
                  for (var i = 0; i < len; i++) {
                    var a = el[i];
                    position(a.offset);
                    a.locator = copyLocator(locator, {});
                  }
                  domBuilder.locator = locator2;
                  if (appendElement(el, domBuilder, currentNSMap)) {
                    parseStack.push(el);
                  }
                  domBuilder.locator = locator;
                } else {
                  if (appendElement(el, domBuilder, currentNSMap)) {
                    parseStack.push(el);
                  }
                }
                if (isHTML && !el.closed) {
                  end = parseHtmlSpecialContent(source, end, el.tagName, entityReplacer, domBuilder);
                } else {
                  end++;
                }
            }
          } catch (e) {
            if (e instanceof ParseError) {
              throw e;
            } else if (e instanceof DOMException) {
              return errorHandler.fatalError("Error constructing the DOM: " + e.name + ": " + e.message, e);
            }
            errorHandler.error("element parse error: " + e);
            end = -1;
          }
          if (end > start) {
            start = end;
          } else {
            appendText(Math.max(tagStart, start) + 1);
          }
        }
      }
      function copyLocator(f, t) {
        t.lineNumber = f.lineNumber;
        t.columnNumber = f.columnNumber;
        return t;
      }
      function parseElementStartPart(source, start, el, currentNSMap, entityReplacer, errorHandler, isHTML) {
        function addAttribute(qname, value2, startIndex) {
          if (hasOwn(el.attributeNames, qname)) {
            return errorHandler.fatalError("Attribute " + qname + " redefined");
          }
          if (!isHTML && value2.indexOf("<") >= 0) {
            return errorHandler.fatalError("Unescaped '<' not allowed in attributes values");
          }
          el.addValue(
            qname,
            // @see https://www.w3.org/TR/xml/#AVNormalize
            // since the xmldom sax parser does not "interpret" DTD the following is not implemented:
            // - recursive replacement of (DTD) entity references
            // - trimming and collapsing multiple spaces into a single one for attributes that are not of type CDATA
            value2.replace(/[\t\n\r]/g, " ").replace(ENTITY_REG, entityReplacer),
            startIndex
          );
        }
        var attrName;
        var value;
        var p = ++start;
        var s = S_TAG;
        while (true) {
          var c = source.charAt(p);
          if (s === S_TAG && c === "<") {
            throw new Error("unexpected < in tag name: " + source.slice(start, p));
          }
          switch (c) {
            case "=":
              if (s === S_ATTR) {
                attrName = source.slice(start, p);
                s = S_EQ;
              } else if (s === S_ATTR_SPACE) {
                s = S_EQ;
              } else {
                throw new Error("attribute equal must after attrName");
              }
              break;
            case "'":
            case '"':
              if (s === S_EQ || s === S_ATTR) {
                if (s === S_ATTR) {
                  errorHandler.warning('attribute value must after "="');
                  attrName = source.slice(start, p);
                }
                start = p + 1;
                p = source.indexOf(c, start);
                if (p > 0) {
                  value = source.slice(start, p);
                  addAttribute(attrName, value, start - 1);
                  s = S_ATTR_END;
                } else {
                  throw new Error("attribute value no end '" + c + "' match");
                }
              } else if (s == S_ATTR_NOQUOT_VALUE) {
                value = source.slice(start, p);
                addAttribute(attrName, value, start);
                errorHandler.warning('attribute "' + attrName + '" missed start quot(' + c + ")!!");
                start = p + 1;
                s = S_ATTR_END;
              } else {
                throw new Error('attribute value must after "="');
              }
              break;
            case "/":
              switch (s) {
                case S_TAG:
                  el.setTagName(source.slice(start, p));
                case S_ATTR_END:
                case S_TAG_SPACE:
                case S_TAG_CLOSE:
                  s = S_TAG_CLOSE;
                  el.closed = true;
                case S_ATTR_NOQUOT_VALUE:
                case S_ATTR:
                  break;
                case S_ATTR_SPACE:
                  el.closed = true;
                  break;
                //case S_EQ:
                default:
                  throw new Error("attribute invalid close char('/')");
              }
              break;
            case "":
              errorHandler.error("unexpected end of input");
              if (s == S_TAG) {
                el.setTagName(source.slice(start, p));
              }
              return p;
            case ">":
              switch (s) {
                case S_TAG:
                  el.setTagName(source.slice(start, p));
                case S_ATTR_END:
                case S_TAG_SPACE:
                case S_TAG_CLOSE:
                  break;
                //normal
                case S_ATTR_NOQUOT_VALUE:
                //Compatible state
                case S_ATTR:
                  value = source.slice(start, p);
                  if (value.slice(-1) === "/") {
                    el.closed = true;
                    value = value.slice(0, -1);
                  }
                case S_ATTR_SPACE:
                  if (s === S_ATTR_SPACE) {
                    value = attrName;
                  }
                  if (s == S_ATTR_NOQUOT_VALUE) {
                    errorHandler.warning('attribute "' + value + '" missed quot(")!');
                    addAttribute(attrName, value, start);
                  } else {
                    if (!isHTML) {
                      errorHandler.warning('attribute "' + value + '" missed value!! "' + value + '" instead!!');
                    }
                    addAttribute(value, value, start);
                  }
                  break;
                case S_EQ:
                  if (!isHTML) {
                    return errorHandler.fatalError(`AttValue: ' or " expected`);
                  }
              }
              return p;
            /*xml space '\x20' | #x9 | #xD | #xA; */
            case "\x80":
              c = " ";
            default:
              if (c <= " ") {
                switch (s) {
                  case S_TAG:
                    el.setTagName(source.slice(start, p));
                    s = S_TAG_SPACE;
                    break;
                  case S_ATTR:
                    attrName = source.slice(start, p);
                    s = S_ATTR_SPACE;
                    break;
                  case S_ATTR_NOQUOT_VALUE:
                    var value = source.slice(start, p);
                    errorHandler.warning('attribute "' + value + '" missed quot(")!!');
                    addAttribute(attrName, value, start);
                  case S_ATTR_END:
                    s = S_TAG_SPACE;
                    break;
                }
              } else {
                switch (s) {
                  //case S_TAG:void();break;
                  //case S_ATTR:void();break;
                  //case S_ATTR_NOQUOT_VALUE:void();break;
                  case S_ATTR_SPACE:
                    if (!isHTML) {
                      errorHandler.warning('attribute "' + attrName + '" missed value!! "' + attrName + '" instead2!!');
                    }
                    addAttribute(attrName, attrName, start);
                    start = p;
                    s = S_ATTR;
                    break;
                  case S_ATTR_END:
                    errorHandler.warning('attribute space is required"' + attrName + '"!!');
                  case S_TAG_SPACE:
                    s = S_ATTR;
                    start = p;
                    break;
                  case S_EQ:
                    s = S_ATTR_NOQUOT_VALUE;
                    start = p;
                    break;
                  case S_TAG_CLOSE:
                    throw new Error("elements closed character '/' and '>' must be connected to");
                }
              }
          }
          p++;
        }
      }
      function appendElement(el, domBuilder, currentNSMap) {
        var tagName = el.tagName;
        var localNSMap = null;
        var i = el.length;
        while (i--) {
          var a = el[i];
          var qName = a.qName;
          var value = a.value;
          var nsp = qName.indexOf(":");
          if (nsp > 0) {
            var prefix = a.prefix = qName.slice(0, nsp);
            var localName = qName.slice(nsp + 1);
            var nsPrefix = prefix === "xmlns" && localName;
          } else {
            localName = qName;
            prefix = null;
            nsPrefix = qName === "xmlns" && "";
          }
          a.localName = localName;
          if (nsPrefix !== false) {
            if (localNSMap == null) {
              localNSMap = /* @__PURE__ */ Object.create(null);
              currentNSMap = Object.create(currentNSMap);
            }
            currentNSMap[nsPrefix] = localNSMap[nsPrefix] = value;
            a.uri = NAMESPACE.XMLNS;
            domBuilder.startPrefixMapping(nsPrefix, value);
          }
        }
        var i = el.length;
        while (i--) {
          a = el[i];
          if (a.prefix) {
            if (a.prefix === "xml") {
              a.uri = NAMESPACE.XML;
            }
            if (a.prefix !== "xmlns") {
              a.uri = currentNSMap[a.prefix];
            }
          }
        }
        var nsp = tagName.indexOf(":");
        if (nsp > 0) {
          prefix = el.prefix = tagName.slice(0, nsp);
          localName = el.localName = tagName.slice(nsp + 1);
        } else {
          prefix = null;
          localName = el.localName = tagName;
        }
        var ns = el.uri = currentNSMap[prefix || ""];
        domBuilder.startElement(ns, localName, tagName, el);
        if (el.closed) {
          domBuilder.endElement(ns, localName, tagName);
          if (localNSMap) {
            for (prefix in localNSMap) {
              if (hasOwn(localNSMap, prefix)) {
                domBuilder.endPrefixMapping(prefix);
              }
            }
          }
        } else {
          el.currentNSMap = currentNSMap;
          el.localNSMap = localNSMap;
          return true;
        }
      }
      function parseHtmlSpecialContent(source, elStartEnd, tagName, entityReplacer, domBuilder) {
        var isEscapableRaw = isHTMLEscapableRawTextElement(tagName);
        if (isEscapableRaw || isHTMLRawTextElement(tagName)) {
          var closeTag = new RegExp("</" + tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ">", "ig");
          closeTag.lastIndex = elStartEnd;
          var match = closeTag.exec(source);
          var elEndStart = match ? match.index : -1;
          if (elEndStart < 0) {
            return elStartEnd + 1;
          }
          var text = source.substring(elStartEnd + 1, elEndStart);
          if (isEscapableRaw) {
            text = text.replace(ENTITY_REG, entityReplacer);
          }
          domBuilder.characters(text, 0, text.length);
          return elEndStart;
        }
        return elStartEnd + 1;
      }
      function _copy(source, target) {
        for (var n in source) {
          if (hasOwn(source, n)) {
            target[n] = source[n];
          }
        }
      }
      function parseUtils(source, start) {
        var index = start;
        function char(n) {
          n = n || 0;
          return source.charAt(index + n);
        }
        function skip(n) {
          n = n || 1;
          index += n;
        }
        function skipBlanks() {
          var blanks = 0;
          while (index < source.length) {
            var c = char();
            if (c !== " " && c !== "\n" && c !== "	" && c !== "\r") {
              return blanks;
            }
            blanks++;
            skip();
          }
          return -1;
        }
        function substringFromIndex() {
          return source.substring(index);
        }
        function substringStartsWith(text) {
          return source.substring(index, index + text.length) === text;
        }
        function substringStartsWithCaseInsensitive(text) {
          return source.substring(index, index + text.length).toUpperCase() === text.toUpperCase();
        }
        function getMatch(args) {
          var expr = g.reg("^", args);
          var match = expr.exec(substringFromIndex());
          if (match) {
            skip(match[0].length);
            return match[0];
          }
          return null;
        }
        return {
          char,
          getIndex: function() {
            return index;
          },
          getMatch,
          getSource: function() {
            return source;
          },
          skip,
          skipBlanks,
          substringFromIndex,
          substringStartsWith,
          substringStartsWithCaseInsensitive
        };
      }
      function parseDoctypeInternalSubset(p, errorHandler) {
        function parsePI(p2, errorHandler2) {
          var match = g.PI.exec(p2.substringFromIndex());
          if (!match) {
            return errorHandler2.fatalError("processing instruction is not well-formed at position " + p2.getIndex());
          }
          if (match[1].toLowerCase() === "xml") {
            return errorHandler2.fatalError(
              "xml declaration is only allowed at the start of the document, but found at position " + p2.getIndex()
            );
          }
          p2.skip(match[0].length);
          return match[0];
        }
        var source = p.getSource();
        if (p.char() === "[") {
          p.skip(1);
          var intSubsetStart = p.getIndex();
          while (p.getIndex() < source.length) {
            p.skipBlanks();
            if (p.char() === "]") {
              var internalSubset = source.substring(intSubsetStart, p.getIndex());
              p.skip(1);
              return internalSubset;
            }
            var current = null;
            if (p.char() === "<" && p.char(1) === "!") {
              switch (p.char(2)) {
                case "E":
                  if (p.char(3) === "L") {
                    current = p.getMatch(g.elementdecl);
                  } else if (p.char(3) === "N") {
                    current = p.getMatch(g.EntityDecl);
                  }
                  break;
                case "A":
                  current = p.getMatch(g.AttlistDecl);
                  break;
                case "N":
                  current = p.getMatch(g.NotationDecl);
                  break;
                case "-":
                  current = p.getMatch(g.Comment);
                  break;
              }
            } else if (p.char() === "<" && p.char(1) === "?") {
              current = parsePI(p, errorHandler);
            } else if (p.char() === "%") {
              current = p.getMatch(g.PEReference);
            } else {
              return errorHandler.fatalError("Error detected in Markup declaration");
            }
            if (!current) {
              return errorHandler.fatalError("Error in internal subset at position " + p.getIndex());
            }
          }
          return errorHandler.fatalError("doctype internal subset is not well-formed, missing ]");
        }
      }
      function parseDoctypeCommentOrCData(source, start, domBuilder, errorHandler, isHTML) {
        var p = parseUtils(source, start);
        switch (isHTML ? p.char(2).toUpperCase() : p.char(2)) {
          case "-":
            var comment = p.getMatch(g.Comment);
            if (comment) {
              domBuilder.comment(comment, g.COMMENT_START.length, comment.length - g.COMMENT_START.length - g.COMMENT_END.length);
              return p.getIndex();
            } else {
              return errorHandler.fatalError("comment is not well-formed at position " + p.getIndex());
            }
          case "[":
            var cdata = p.getMatch(g.CDSect);
            if (cdata) {
              if (!isHTML && !domBuilder.currentElement) {
                return errorHandler.fatalError("CDATA outside of element");
              }
              domBuilder.startCDATA();
              domBuilder.characters(cdata, g.CDATA_START.length, cdata.length - g.CDATA_START.length - g.CDATA_END.length);
              domBuilder.endCDATA();
              return p.getIndex();
            } else {
              return errorHandler.fatalError("Invalid CDATA starting at position " + start);
            }
          case "D": {
            if (domBuilder.doc && domBuilder.doc.documentElement) {
              return errorHandler.fatalError("Doctype not allowed inside or after documentElement at position " + p.getIndex());
            }
            if (isHTML ? !p.substringStartsWithCaseInsensitive(g.DOCTYPE_DECL_START) : !p.substringStartsWith(g.DOCTYPE_DECL_START)) {
              return errorHandler.fatalError("Expected " + g.DOCTYPE_DECL_START + " at position " + p.getIndex());
            }
            p.skip(g.DOCTYPE_DECL_START.length);
            if (p.skipBlanks() < 1) {
              return errorHandler.fatalError("Expected whitespace after " + g.DOCTYPE_DECL_START + " at position " + p.getIndex());
            }
            var doctype = {
              name: void 0,
              publicId: void 0,
              systemId: void 0,
              internalSubset: void 0
            };
            doctype.name = p.getMatch(g.Name);
            if (!doctype.name)
              return errorHandler.fatalError("doctype name missing or contains unexpected characters at position " + p.getIndex());
            if (isHTML && doctype.name.toLowerCase() !== "html") {
              errorHandler.warning("Unexpected DOCTYPE in HTML document at position " + p.getIndex());
            }
            p.skipBlanks();
            if (p.substringStartsWith(g.PUBLIC) || p.substringStartsWith(g.SYSTEM)) {
              var match = g.ExternalID_match.exec(p.substringFromIndex());
              if (!match) {
                return errorHandler.fatalError("doctype external id is not well-formed at position " + p.getIndex());
              }
              if (match.groups.SystemLiteralOnly !== void 0) {
                doctype.systemId = match.groups.SystemLiteralOnly;
              } else {
                doctype.systemId = match.groups.SystemLiteral;
                doctype.publicId = match.groups.PubidLiteral;
              }
              p.skip(match[0].length);
            } else if (isHTML && p.substringStartsWithCaseInsensitive(g.SYSTEM)) {
              p.skip(g.SYSTEM.length);
              if (p.skipBlanks() < 1) {
                return errorHandler.fatalError("Expected whitespace after " + g.SYSTEM + " at position " + p.getIndex());
              }
              doctype.systemId = p.getMatch(g.ABOUT_LEGACY_COMPAT_SystemLiteral);
              if (!doctype.systemId) {
                return errorHandler.fatalError(
                  "Expected " + g.ABOUT_LEGACY_COMPAT + " in single or double quotes after " + g.SYSTEM + " at position " + p.getIndex()
                );
              }
            }
            if (isHTML && doctype.systemId && !g.ABOUT_LEGACY_COMPAT_SystemLiteral.test(doctype.systemId)) {
              errorHandler.warning("Unexpected doctype.systemId in HTML document at position " + p.getIndex());
            }
            if (!isHTML) {
              p.skipBlanks();
              doctype.internalSubset = parseDoctypeInternalSubset(p, errorHandler);
            }
            p.skipBlanks();
            if (p.char() !== ">") {
              return errorHandler.fatalError("doctype not terminated with > at position " + p.getIndex());
            }
            p.skip(1);
            domBuilder.startDTD(doctype.name, doctype.publicId, doctype.systemId, doctype.internalSubset);
            domBuilder.endDTD();
            return p.getIndex();
          }
          default:
            return errorHandler.fatalError('Not well-formed XML starting with "<!" at position ' + start);
        }
      }
      function parseProcessingInstruction(source, start, domBuilder, errorHandler) {
        var match = source.substring(start).match(g.PI);
        if (!match) {
          return errorHandler.fatalError("Invalid processing instruction starting at position " + start);
        }
        if (match[1].toLowerCase() === "xml") {
          if (start > 0) {
            return errorHandler.fatalError(
              "processing instruction at position " + start + " is an xml declaration which is only at the start of the document"
            );
          }
          if (!g.XMLDecl.test(source.substring(start))) {
            return errorHandler.fatalError("xml declaration is not well-formed");
          }
        }
        domBuilder.processingInstruction(match[1], match[2]);
        return start + match[0].length;
      }
      function ElementAttributes() {
        this.attributeNames = /* @__PURE__ */ Object.create(null);
      }
      ElementAttributes.prototype = {
        setTagName: function(tagName) {
          if (!g.QName_exact.test(tagName)) {
            throw new Error("invalid tagName:" + tagName);
          }
          this.tagName = tagName;
        },
        addValue: function(qName, value, offset) {
          if (!g.QName_exact.test(qName)) {
            throw new Error("invalid attribute:" + qName);
          }
          this.attributeNames[qName] = this.length;
          this[this.length++] = { qName, value, offset };
        },
        length: 0,
        getLocalName: function(i) {
          return this[i].localName;
        },
        getLocator: function(i) {
          return this[i].locator;
        },
        getQName: function(i) {
          return this[i].qName;
        },
        getURI: function(i) {
          return this[i].uri;
        },
        getValue: function(i) {
          return this[i].value;
        }
        //	,getIndex:function(uri, localName)){
        //		if(localName){
        //
        //		}else{
        //			var qName = uri
        //		}
        //	},
        //	getValue:function(){return this.getValue(this.getIndex.apply(this,arguments))},
        //	getType:function(uri,localName){}
        //	getType:function(i){},
      };
      exports.XMLReader = XMLReader;
      exports.parseUtils = parseUtils;
      exports.parseDoctypeCommentOrCData = parseDoctypeCommentOrCData;
    }
  });

  // node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/dom-parser.js
  var require_dom_parser = __commonJS({
    "node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/dom-parser.js"(exports) {
      "use strict";
      var conventions = require_conventions();
      var dom = require_dom();
      var errors = require_errors();
      var entities = require_entities();
      var sax = require_sax();
      var DOMImplementation = dom.DOMImplementation;
      var hasDefaultHTMLNamespace = conventions.hasDefaultHTMLNamespace;
      var isHTMLMimeType = conventions.isHTMLMimeType;
      var isValidMimeType = conventions.isValidMimeType;
      var MIME_TYPE = conventions.MIME_TYPE;
      var NAMESPACE = conventions.NAMESPACE;
      var ParseError = errors.ParseError;
      var XMLReader = sax.XMLReader;
      function normalizeLineEndings(input) {
        return input.replace(/\r[\n\u0085]/g, "\n").replace(/[\r\u0085\u2028\u2029]/g, "\n");
      }
      function DOMParser3(options) {
        options = options || {};
        if (options.locator === void 0) {
          options.locator = true;
        }
        this.assign = options.assign || conventions.assign;
        this.domHandler = options.domHandler || DOMHandler;
        this.onError = options.onError || options.errorHandler;
        if (options.errorHandler && typeof options.errorHandler !== "function") {
          throw new TypeError("errorHandler object is no longer supported, switch to onError!");
        } else if (options.errorHandler) {
          options.errorHandler("warning", "The `errorHandler` option has been deprecated, use `onError` instead!", this);
        }
        this.normalizeLineEndings = options.normalizeLineEndings || normalizeLineEndings;
        this.locator = !!options.locator;
        this.xmlns = this.assign(/* @__PURE__ */ Object.create(null), options.xmlns);
      }
      DOMParser3.prototype.parseFromString = function(source, mimeType) {
        if (!isValidMimeType(mimeType)) {
          throw new TypeError('DOMParser.parseFromString: the provided mimeType "' + mimeType + '" is not valid.');
        }
        var defaultNSMap = this.assign(/* @__PURE__ */ Object.create(null), this.xmlns);
        var entityMap = entities.XML_ENTITIES;
        var defaultNamespace = defaultNSMap[""] || null;
        if (hasDefaultHTMLNamespace(mimeType)) {
          entityMap = entities.HTML_ENTITIES;
          defaultNamespace = NAMESPACE.HTML;
        } else if (mimeType === MIME_TYPE.XML_SVG_IMAGE) {
          defaultNamespace = NAMESPACE.SVG;
        }
        defaultNSMap[""] = defaultNamespace;
        defaultNSMap.xml = defaultNSMap.xml || NAMESPACE.XML;
        var domBuilder = new this.domHandler({
          mimeType,
          defaultNamespace,
          onError: this.onError
        });
        var locator = this.locator ? {} : void 0;
        if (this.locator) {
          domBuilder.setDocumentLocator(locator);
        }
        var sax2 = new XMLReader();
        sax2.errorHandler = domBuilder;
        sax2.domBuilder = domBuilder;
        var isXml = !conventions.isHTMLMimeType(mimeType);
        if (isXml && typeof source !== "string") {
          sax2.errorHandler.fatalError("source is not a string");
        }
        sax2.parse(this.normalizeLineEndings(String(source)), defaultNSMap, entityMap);
        if (!domBuilder.doc.documentElement) {
          sax2.errorHandler.fatalError("missing root element");
        }
        return domBuilder.doc;
      };
      function DOMHandler(options) {
        var opt = options || {};
        this.mimeType = opt.mimeType || MIME_TYPE.XML_APPLICATION;
        this.defaultNamespace = opt.defaultNamespace || null;
        this.cdata = false;
        this.currentElement = void 0;
        this.doc = void 0;
        this.locator = void 0;
        this.onError = opt.onError;
      }
      function position(locator, node) {
        node.lineNumber = locator.lineNumber;
        node.columnNumber = locator.columnNumber;
      }
      DOMHandler.prototype = {
        /**
         * Either creates an XML or an HTML document and stores it under `this.doc`.
         * If it is an XML document, `this.defaultNamespace` is used to create it,
         * and it will not contain any `childNodes`.
         * If it is an HTML document, it will be created without any `childNodes`.
         *
         * @see http://www.saxproject.org/apidoc/org/xml/sax/ContentHandler.html
         */
        startDocument: function() {
          var impl = new DOMImplementation();
          this.doc = isHTMLMimeType(this.mimeType) ? impl.createHTMLDocument(false) : impl.createDocument(this.defaultNamespace, "");
        },
        startElement: function(namespaceURI, localName, qName, attrs) {
          var doc = this.doc;
          var el = doc.createElementNS(namespaceURI, qName || localName);
          var len = attrs.length;
          appendElement(this, el);
          this.currentElement = el;
          this.locator && position(this.locator, el);
          for (var i = 0; i < len; i++) {
            var namespaceURI = attrs.getURI(i);
            var value = attrs.getValue(i);
            var qName = attrs.getQName(i);
            var attr = doc.createAttributeNS(namespaceURI, qName);
            this.locator && position(attrs.getLocator(i), attr);
            attr.value = attr.nodeValue = value;
            el.setAttributeNode(attr);
          }
        },
        endElement: function(namespaceURI, localName, qName) {
          this.currentElement = this.currentElement.parentNode;
        },
        startPrefixMapping: function(prefix, uri) {
        },
        endPrefixMapping: function(prefix) {
        },
        processingInstruction: function(target, data) {
          var ins = this.doc.createProcessingInstruction(target, data);
          this.locator && position(this.locator, ins);
          appendElement(this, ins);
        },
        ignorableWhitespace: function(ch, start, length) {
        },
        characters: function(chars, start, length) {
          chars = _toString.apply(this, arguments);
          if (chars) {
            if (this.cdata) {
              var charNode = this.doc.createCDATASection(chars);
            } else {
              var charNode = this.doc.createTextNode(chars);
            }
            if (this.currentElement) {
              this.currentElement.appendChild(charNode);
            } else if (/^\s*$/.test(chars)) {
              this.doc.appendChild(charNode);
            }
            this.locator && position(this.locator, charNode);
          }
        },
        skippedEntity: function(name) {
        },
        endDocument: function() {
          this.doc.normalize();
        },
        /**
         * Stores the locator to be able to set the `columnNumber` and `lineNumber`
         * on the created DOM nodes.
         *
         * @param {Locator} locator
         */
        setDocumentLocator: function(locator) {
          if (locator) {
            locator.lineNumber = 0;
          }
          this.locator = locator;
        },
        //LexicalHandler
        comment: function(chars, start, length) {
          chars = _toString.apply(this, arguments);
          var comm = this.doc.createComment(chars);
          this.locator && position(this.locator, comm);
          appendElement(this, comm);
        },
        startCDATA: function() {
          this.cdata = true;
        },
        endCDATA: function() {
          this.cdata = false;
        },
        startDTD: function(name, publicId, systemId, internalSubset) {
          var impl = this.doc.implementation;
          if (impl && impl.createDocumentType) {
            var dt = impl.createDocumentType(name, publicId, systemId, internalSubset);
            this.locator && position(this.locator, dt);
            appendElement(this, dt);
            this.doc.doctype = dt;
          }
        },
        reportError: function(level, message) {
          if (typeof this.onError === "function") {
            try {
              this.onError(level, message, this);
            } catch (e) {
              throw new ParseError("Reporting " + level + ' "' + message + '" caused ' + e, this.locator);
            }
          } else {
            console.error("[xmldom " + level + "]	" + message, _locator(this.locator));
          }
        },
        /**
         * @see http://www.saxproject.org/apidoc/org/xml/sax/ErrorHandler.html
         */
        warning: function(message) {
          this.reportError("warning", message);
        },
        error: function(message) {
          this.reportError("error", message);
        },
        /**
         * This function reports a fatal error and throws a ParseError.
         *
         * @param {string} message
         * - The message to be used for reporting and throwing the error.
         * @param {Error} [cause]
         * The error that caused this fatal error, preserved as the thrown `ParseError`'s `cause`.
         * @returns {never}
         * This function always throws an error and never returns a value.
         * @throws {ParseError}
         * Always throws a ParseError with the provided message.
         */
        fatalError: function(message, cause) {
          this.reportError("fatalError", message);
          throw new ParseError(message, this.locator, cause);
        }
      };
      function _locator(l) {
        if (l) {
          return "\n@#[line:" + l.lineNumber + ",col:" + l.columnNumber + "]";
        }
      }
      function _toString(chars, start, length) {
        if (typeof chars == "string") {
          return chars.substr(start, length);
        } else {
          if (chars.length >= start + length || start) {
            return new java.lang.String(chars, start, length) + "";
          }
          return chars;
        }
      }
      "endDTD,startEntity,endEntity,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,resolveEntity,getExternalSubset,notationDecl,unparsedEntityDecl".replace(
        /\w+/g,
        function(key) {
          DOMHandler.prototype[key] = function() {
            return null;
          };
        }
      );
      function appendElement(handler, node) {
        if (!handler.currentElement) {
          handler.doc.appendChild(node);
        } else {
          handler.currentElement.appendChild(node);
        }
      }
      function onErrorStopParsing(level) {
        if (level === "error") throw "onErrorStopParsing";
      }
      function onWarningStopParsing() {
        throw "onWarningStopParsing";
      }
      exports.__DOMHandler = DOMHandler;
      exports.DOMParser = DOMParser3;
      exports.normalizeLineEndings = normalizeLineEndings;
      exports.onErrorStopParsing = onErrorStopParsing;
      exports.onWarningStopParsing = onWarningStopParsing;
    }
  });

  // node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/index.js
  var require_lib = __commonJS({
    "node_modules/.pnpm/@xmldom+xmldom@0.9.12/node_modules/@xmldom/xmldom/lib/index.js"(exports) {
      "use strict";
      var conventions = require_conventions();
      exports.assign = conventions.assign;
      exports.hasDefaultHTMLNamespace = conventions.hasDefaultHTMLNamespace;
      exports.isHTMLMimeType = conventions.isHTMLMimeType;
      exports.isValidMimeType = conventions.isValidMimeType;
      exports.MIME_TYPE = conventions.MIME_TYPE;
      exports.NAMESPACE = conventions.NAMESPACE;
      var errors = require_errors();
      exports.DOMException = errors.DOMException;
      exports.DOMExceptionName = errors.DOMExceptionName;
      exports.ExceptionCode = errors.ExceptionCode;
      exports.ParseError = errors.ParseError;
      var dom = require_dom();
      exports.Attr = dom.Attr;
      exports.CDATASection = dom.CDATASection;
      exports.CharacterData = dom.CharacterData;
      exports.Comment = dom.Comment;
      exports.Document = dom.Document;
      exports.DocumentFragment = dom.DocumentFragment;
      exports.DocumentType = dom.DocumentType;
      exports.DOMImplementation = dom.DOMImplementation;
      exports.Element = dom.Element;
      exports.Entity = dom.Entity;
      exports.EntityReference = dom.EntityReference;
      exports.LiveNodeList = dom.LiveNodeList;
      exports.NamedNodeMap = dom.NamedNodeMap;
      exports.Node = dom.Node;
      exports.NodeList = dom.NodeList;
      exports.Notation = dom.Notation;
      exports.ProcessingInstruction = dom.ProcessingInstruction;
      exports.Text = dom.Text;
      exports.XMLSerializer = dom.XMLSerializer;
      var domParser = require_dom_parser();
      exports.DOMParser = domParser.DOMParser;
      exports.normalizeLineEndings = domParser.normalizeLineEndings;
      exports.onErrorStopParsing = domParser.onErrorStopParsing;
      exports.onWarningStopParsing = domParser.onWarningStopParsing;
    }
  });

  // src/client/utils/lyrics/icuFolia/jieba.ts
  var STATES, B, E, M, S, PREV_STATES, MIN_FLOAT, RE_HAN_DEFAULT, RE_SKIP_DEFAULT, RE_HAN_HMM, RE_SKIP_HMM, LATIN_CHAR, decodeBase64, decodeVarints, splitKeep, createJieba;
  var init_jieba = __esm({
    "src/client/utils/lyrics/icuFolia/jieba.ts"() {
      STATES = ["B", "E", "M", "S"];
      B = 0;
      E = 1;
      M = 2;
      S = 3;
      PREV_STATES = [[E, S], [B, M], [M, B], [S, E]];
      MIN_FLOAT = -314e98;
      RE_HAN_DEFAULT = /([㐀-䶿一-鿿豈-﫿\u{20000}-\u{2A6DF}\u{2A700}-\u{2B73F}\u{2B740}-\u{2B81F}\u{2B820}-\u{2CEAF}\u{2CEB0}-\u{2EBEF}\u{2F800}-\u{2FA1F}a-zA-Z0-9+#&._%-]+)/u;
      RE_SKIP_DEFAULT = /(\r\n|\s)/u;
      RE_HAN_HMM = /([一-鿕]+)/u;
      RE_SKIP_HMM = /([a-zA-Z0-9]+(?:\.\d+)?%?)/u;
      LATIN_CHAR = /^[a-zA-Z0-9]$/;
      decodeBase64 = (base64) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return bytes;
      };
      decodeVarints = (base64, count) => {
        const bytes = decodeBase64(base64);
        const values = new Uint32Array(count);
        let cursor = 0;
        for (let index = 0; index < count; index += 1) {
          let value = 0;
          let scale = 1;
          for (; ; ) {
            const byte = bytes[cursor++];
            value += (byte & 127) * scale;
            if (byte < 128) break;
            scale *= 128;
          }
          values[index] = value;
        }
        return values;
      };
      splitKeep = (text, pattern) => text.split(pattern).map((piece, index) => ({ text: piece, matched: index % 2 === 1 })).filter((piece) => piece.text.length > 0);
      createJieba = (data, options = {}) => {
        const maxHmmWordLength = options.maxHmmWordLength ?? Number.POSITIVE_INFINITY;
        const { words } = data;
        let count = words.length > 0 ? 1 : 0;
        for (let index = 0; index < words.length; index += 1) if (words.charCodeAt(index) === 10) count += 1;
        const starts = new Int32Array(count + 1);
        for (let index = 0, word = 1; index < words.length; index += 1) {
          if (words.charCodeAt(index) === 10) starts[word++] = index + 1;
        }
        starts[count] = words.length + 1;
        const freqs = decodeVarints(data.freqs, count);
        const compareAt = (index, text, from, to) => {
          const wordStart = starts[index];
          const wordLength = starts[index + 1] - 1 - wordStart;
          const keyLength = to - from;
          const shared = Math.min(wordLength, keyLength);
          for (let offset = 0; offset < shared; offset += 1) {
            const diff = words.charCodeAt(wordStart + offset) - text.charCodeAt(from + offset);
            if (diff !== 0) return diff;
          }
          return wordLength - keyLength;
        };
        const lowerBound = (text, from, to) => {
          let low = 0;
          let high = count;
          while (low < high) {
            const mid = low + high >>> 1;
            if (compareAt(mid, text, from, to) < 0) low = mid + 1;
            else high = mid;
          }
          return low;
        };
        const added = /* @__PURE__ */ new Map();
        const addedPrefixes = /* @__PURE__ */ new Set();
        const addedFirstCodes = /* @__PURE__ */ new Set();
        let total = data.total;
        let logTotal = Math.log(total);
        const freqAt = (text, from, to) => {
          if (addedFirstCodes.has(text.charCodeAt(from))) {
            const extra = added.get(text.slice(from, to));
            if (extra !== void 0) return extra;
          }
          const index = lowerBound(text, from, to);
          return index < count && compareAt(index, text, from, to) === 0 ? freqs[index] : 0;
        };
        const isPrefixAt = (text, from, to) => {
          if (addedFirstCodes.has(text.charCodeAt(from)) && addedPrefixes.has(text.slice(from, to))) return true;
          const index = lowerBound(text, from, to);
          if (index >= count) return false;
          const wordStart = starts[index];
          if (starts[index + 1] - 1 - wordStart < to - from) return false;
          for (let offset = 0; offset < to - from; offset += 1) {
            if (words.charCodeAt(wordStart + offset) !== text.charCodeAt(from + offset)) return false;
          }
          return true;
        };
        const freqOf = (word) => freqAt(word, 0, word.length);
        const start = STATES.map((state) => data.hmm.start[state]);
        const trans = STATES.map((from) => STATES.map((to) => data.hmm.trans[from][to] ?? MIN_FLOAT));
        const emit = STATES.map((state) => {
          const [chars, logsBase64] = data.hmm.emit[state];
          const bytes = decodeBase64(logsBase64);
          const logs = new Float64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
          const table = /* @__PURE__ */ new Map();
          Array.from(chars).forEach((char, index) => table.set(char, logs[index]));
          return table;
        });
        const viterbi = (chars) => {
          const n = chars.length;
          const probs = new Float64Array(n * 4);
          const back = new Int8Array(n * 4);
          STATES.forEach((_, state2) => {
            probs[state2] = start[state2] + (emit[state2].get(chars[0]) ?? MIN_FLOAT);
          });
          for (let t = 1; t < n; t += 1) {
            for (let state2 = 0; state2 < 4; state2 += 1) {
              const emitProb = emit[state2].get(chars[t]) ?? MIN_FLOAT;
              let best = Number.NEGATIVE_INFINITY;
              let bestPrev = -1;
              for (const prev of PREV_STATES[state2]) {
                const prob = probs[(t - 1) * 4 + prev] + trans[prev][state2] + emitProb;
                if (prob > best || prob === best && prev > bestPrev) {
                  best = prob;
                  bestPrev = prev;
                }
              }
              probs[t * 4 + state2] = best;
              back[t * 4 + state2] = bestPrev;
            }
          }
          const lastE = probs[(n - 1) * 4 + E];
          const lastS = probs[(n - 1) * 4 + S];
          let state = lastS >= lastE ? S : E;
          const labels = new Array(n);
          for (let t = n - 1; t >= 0; t -= 1) {
            labels[t] = state;
            state = back[t * 4 + state];
          }
          return labels;
        };
        const cutHmm = (text, out) => {
          for (const block of splitKeep(text, RE_HAN_HMM)) {
            if (!block.matched) {
              splitKeep(block.text, RE_SKIP_HMM).forEach((piece) => out.push(piece.text));
              continue;
            }
            const chars = Array.from(block.text);
            const labels = viterbi(chars);
            const words2 = [];
            let begin = 0;
            let next = 0;
            labels.forEach((label, index) => {
              if (label === B) {
                begin = index;
              } else if (label === E) {
                words2.push(chars.slice(begin, index + 1).join(""));
                next = index + 1;
              } else if (label === S) {
                words2.push(chars[index]);
                next = index + 1;
              }
            });
            if (next < chars.length) words2.push(chars.slice(next).join(""));
            words2.forEach((word) => {
              if (Array.from(word).length > maxHmmWordLength) out.push(...Array.from(word));
              else out.push(word);
            });
          }
        };
        const route = (text, bounds) => {
          const n = bounds.length - 1;
          const best = new Float64Array(n + 1);
          const nextIndex = new Int32Array(n + 1);
          for (let index = n - 1; index >= 0; index -= 1) {
            let bestProb = Number.NEGATIVE_INFINITY;
            let bestEnd = index;
            let end = index;
            let found = false;
            while (end < n && isPrefixAt(text, bounds[index], bounds[end + 1])) {
              const freq = freqAt(text, bounds[index], bounds[end + 1]);
              if (freq) {
                found = true;
                const prob = Math.log(freq) - logTotal + best[end + 1];
                if (prob >= bestProb) {
                  bestProb = prob;
                  bestEnd = end;
                }
              }
              end += 1;
            }
            if (!found) {
              bestProb = Math.log(1) - logTotal + best[index + 1];
              bestEnd = index;
            }
            best[index] = bestProb;
            nextIndex[index] = bestEnd + 1;
          }
          return nextIndex;
        };
        const cutBlock = (text, hmm, out) => {
          const bounds = new Int32Array(Array.from(text).length + 1);
          for (let index = 0, offset = 0; offset < text.length; index += 1) {
            offset += text.codePointAt(offset) > 65535 ? 2 : 1;
            bounds[index + 1] = offset;
          }
          const n = bounds.length - 1;
          const nextIndex = route(text, bounds);
          let buffer = [];
          const flush = () => {
            if (buffer.length === 1) {
              out.push(buffer[0]);
            } else if (buffer.length > 1) {
              const run = buffer.join("");
              if (!freqOf(run)) cutHmm(run, out);
              else out.push(...buffer);
            }
            buffer = [];
          };
          let latin = "";
          for (let index = 0; index < n; ) {
            const end = nextIndex[index];
            const word = text.slice(bounds[index], bounds[end]);
            if (!hmm) {
              if (end - index === 1 && LATIN_CHAR.test(word)) {
                latin += word;
              } else {
                if (latin) out.push(latin);
                latin = "";
                out.push(word);
              }
            } else if (end - index === 1) {
              buffer.push(word);
            } else {
              flush();
              out.push(word);
            }
            index = end;
          }
          if (hmm) flush();
          else if (latin) out.push(latin);
        };
        const cut = (text, hmm = true) => {
          const out = [];
          for (const block of splitKeep(text, RE_HAN_DEFAULT)) {
            if (block.matched) {
              cutBlock(block.text, hmm, out);
              continue;
            }
            for (const piece of splitKeep(block.text, RE_SKIP_DEFAULT)) {
              if (piece.matched) out.push(piece.text);
              else out.push(...Array.from(piece.text));
            }
          }
          return out;
        };
        const suggestFreq = (word) => {
          const logFreq = cut(word, false).reduce((sum, piece) => sum + Math.log(freqOf(piece) || 1) - logTotal, 0);
          return Math.max(Math.floor(Math.exp(logFreq + logTotal)) + 1, freqOf(word) || 1);
        };
        const addWord = (word, freq) => {
          const weight = freq ?? suggestFreq(word);
          total += weight - freqOf(word);
          logTotal = Math.log(total);
          added.set(word, weight);
          addedFirstCodes.add(word.charCodeAt(0));
          const chars = Array.from(word);
          for (let length = 1; length <= chars.length; length += 1) addedPrefixes.add(chars.slice(0, length).join(""));
          return weight;
        };
        return { cut, addWord };
      };
    }
  });

  // src/client/utils/lyrics/icuFolia/jiebaLexicon.ts
  var CHINESE_EXTRA_WORDS, CHINESE_DEMOTED_WORDS;
  var init_jiebaLexicon = __esm({
    "src/client/utils/lyrics/icuFolia/jiebaLexicon.ts"() {
      CHINESE_EXTRA_WORDS = [
        "\u6211\u54CB",
        "\u4F60\u54CB",
        "\u4F62\u54CB",
        "\u4F62",
        "\u5187",
        "\u5187\u4EBA",
        "\u5514\u597D",
        "\u5514\u4F7F",
        "\u5514\u7CFB",
        "\u5514\u8BE5",
        "\u5514\u77E5",
        "\u5514\u4F1A",
        "\u5514\u8BC6",
        "\u7CFB\u54AA",
        "\u55BA\u5EA6",
        "\u8FD4\u569F",
        "\u8FC7\u569F",
        "\u569F",
        "\u70B9\u89E3",
        "\u4E5C\u5622",
        "\u54A9\u5622",
        "\u5481\u6837",
        "\u949F\u610F",
        "\u800C\u5BB6",
        "\u4F9D\u5BB6",
        "\u542C\u65E5",
        "\u7434\u65E5",
        "\u8FB9\u5EA6",
        "\u8FB9\u4E2A",
        "\u51E0\u65F6",
        "\u55F0\u5EA6",
        "\u55F0\u4E2A",
        "\u5462\u5EA6",
        "\u5462\u4E2A",
        "\u5622",
        "\u5FC3\u4E8B",
        "\u63FE",
        "\u7747",
        "\u6530"
      ];
      CHINESE_DEMOTED_WORDS = ["\u7684\u8BDD"];
    }
  });

  // node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/data/models/ja.js
  var model;
  var init_ja = __esm({
    "node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/data/models/ja.js"() {
      model = { "UW3": { "\u3002": 2927, "\u306E": 1892, "\u3001": 2285, "\u3092": 2562, "\u306B": 1846, "\u304C": 1948, "\u306F": 1984, "\u3068": 1588, "\u3057": 270, "\u308B": 1470, "\u3082": 1602, "\u306A": 1344, "\u3067": 1587, "\u305F": 1188, "\u3044": 987, "\u304F": 1291, "\u3066": 1233, "\u3046": 1105, "\u3078": 1292, "\u3089": 785, "\u3084": 1175, "\uFF1F": 1825, "?": 1906, "\u3063": -327, "\u3053": 34, "\u3050": 1295, "\u30FC": -115, "\u3093": 563, "\uFF0C": 1899, "\u3070": 1101, "\uFF3D": 1183, "\u308A": 561, "\u304B": 1026, "]": 1525, "\uFF01": 1800, "\u304A": -585, "\u305E": 1145, "\u307E": 10, "\u30C3": -548, "\uFF0E": 1157, "\u3064": 650, "\u7A7A": 721, "\u30B9": -380, "\u3069": 803, "\u2026": 1481, "\u30A4": -308, "\u30F3": -194, "\u30FB": 500, "\u3060": 608, "\u65B9": 472, "\u300C": -624, "\uFF09": 1444, "\u90E8": 321, "\u30D7": -345, "\u3054": -381, "\u3042": 570, "\u30D5": -463, "\u266A": 1332, "\u300D": 832, "\u30E9": -86, "\u2606": 1295, "\u305A": 902, "\u96FB": -402, "\u4EAC": -315, "\u5927": -271, "\u308D": 669, "\u30A2": -307, "\u65E5": 338, "\u624B": -71, "\u306C": 880, "\uFF10": -343, "\u3059": 643, "\u3005": 968, "\u4EE5": -305, "\u7B11": 1486, "\u9593": 426, "\uFF11": -438, "\u89B3": -178, "\u5EA6": 590, "\u300E": -335, "\u65B0": -236, "[": -316, "\u30AB": -102, "\u7684": 295, "\u304D": 223, "\u30ED": -226, "\u5206": 475, "\u308C": 233, "\u3080": 812, "\u3058": 416, "\u3041": 695, "\u30B8": -61, "\u54C1": 40, "\u305B": 290, "\u4ECA": 372, "\u3083": 606, "\u90FD": -77, "\u5F8C": 594, "\u4E2D": 373, "\u3076": 735, "\u3048": 464, "\u3011": 476, "\u30B7": -201, "\u30C9": -176, "\u5909": 324, "\u301C": 332, "\u756A": 216, "\u4E0D": -190, "\u7136": 621, "\u2605": 1043, "\u5B50": -141, "\u3088": 188, "\u3061": 259, "\uFF3B": -237, "\u30BF": -21, "\u8AAC": 81, "\u767A": -151, "\u6700": -147, "\u7D20": -149, "\u6642": 91, "\u5E74": 179, "\u6BB5": 248, "\u4EE3": -109, "\u610F": -96, "\u3073": 17, "\u5B66": -74, "\u3000": 207, "\u5473": 281, "\u6599": -81, "\u884C": -131, "\u30CB": -63, "\u5149": -39, "\u7528": -107, "\uFF4F": -95, "\u4F53": 358, "\u591C": 536, "\u4F5C": -85, "\u7686": 417, "\u30C8": -7, "\u4EBA": 76, "\u65A4": 434, "\u6708": 112, "\u9078": -75, "\uFF12": -58, "\u201D": 363, "\u805E": -62, "\uFF1A": 130, "\u524D": 150, "\u5916": 73, "\u6614": 699, "\u30EC": -24, "\u8D85": 450, "\u9031": 93, "\uFF15": -34, "\u6C34": 58, "\u81EA": -22, "\uFF13": -29, "\u8272": 219, "\u300F": 227, "\u51FA": -24, "\u80FD": -12, "\u30D3": -19, "\u307F": 7, "\u958B": -14, "\u30C6": -12, "\u30E2": -19, "\u30D0": -9, "\u6A5F": -7, "\u306D": 90, "\u7A0B": 51, "\u984C": 18 }, "UW4": { "\u3002": -2921, "\u306E": -1829, "\u306B": -1799, "\u304C": -1557, "\u306F": -1614, "\u3001": -2878, "\u308B": -2280, "\u3067": -1295, "\u3068": -1399, "\u3066": -1522, "\u3092": -1805, "\u3063": -2e3, "\u304B": -1271, "\u308A": -1899, "\u3046": -1061, "\u307E": -821, "\u3057": -919, "\u305F": -814, "\u3044": -676, "\u304A": 416, "\u306A": -906, "\u3089": -2069, "\u3060": -1191, "\u3061": -984, "\u3059": -719, "\u308C": -1661, "\u3093": -1845, "\u304D": -877, "\u305D": 223, "\u30FC": -1265, "\u3084": -634, "\u300D": -2633, "\u3042": 79, "\u3051": -1607, "\u3082": -1204, "\u305E": -1147, "\u304F": -1282, "\u3054": 115, "\u3055": -874, "\u898B": 364, "\uFF1F": -2257, "\u3081": -1016, "\u307F": -637, "\u3088": -627, "\u4EBA": 194, "\u300C": 1150, "\u79C1": 801, "\u30C3": -646, "\u3050": -765, "\u30F3": -591, "[": 1560, "\u4E00": 273, "\u601D": 304, "\u308F": -782, "?": -1830, "\u5408": -827, "\u3058": -1102, "\uFF01": -2092, "\uFF0C": -1995, "\u8A00": 113, "\u4F55": 399, "\u305B": -824, "\u5834": 130, "\u300E": 381, "\u884C": 159, "\u3048": -920, "\u4ECA": 498, "\u300F": -2279, "\u6642": 150, "\u5E83": 186, "\u98DF": 116, "\u4EAC": 115, "\u30FB": -730, "\u308D": -1232, "\u65E5": 91, "\uFF0E": -1414, "\u7A7A": 439, "\u3078": -655, "\u3070": -1174, "\u3064": -611, "\u2026": -1457, "\u3079": -1265, "]": -965, "\uFF11": 526, "\u52B9": 164, "\u5927": 150, "\u30EB": -258, "\u30B5": 80, "\u30EA": -277, "\u30A8": 110, "\u3073": -775, "\u7279": 504, "\u4F7F": 548, "\u5F53": 94, "\u306D": -1133, "\uFF08": 1298, "\u7159": 1199, "\u7DBA": 1247, "\u3086": -457, "\u65B9": -171, "\u6C17": 101, "\u305A": -945, "\u3069": -492, "\u3076": -832, "\u81EA": 280, "\uFF12": 318, "\uFF3B": 922, "\u3041": -814, "\u643A": 121, "\u3083": -1080, "\u6700": 277, "\uFF3D": -414, "\u5E2F": -257, "\u6765": 55, "\u3087": -821, "\u30D5": -180, "\u9593": -295, "\u7B11": -1460, "\u30B9": -53, "\uFF09": -1557, "\u3053": -226, "\u6709": 268, "\u65B0": 128, "\u826F": 25, "\u30BF": -78, "\u304E": -913, "\u7528": -291, "\u305C": -825, "\u3080": -488, "\u2606": -807, "\u5236": 350, "\u7D9A": -264, "\u30AB": 101, "\u266A": -1026, "\u80FD": -219, "\u3056": -429, "\u30E1": 37, "\u8868": 151, "\uFF13": 242, "\u591A": 355, "\u30A4": -59, "\u624B": 66, "\u301C": -834, "\u30E5": -195, "\u516C": 161, "\u64CD": 52, "\u7121": 211, "\u307B": -134, "\u66F8": 273, "\uFF10": -120, "\u7684": -273, "\u30C7": 120, "\u6B21": 53, "\u53D6": -302, "\u3052": -451, "\u4E0D": 301, "\u30ED": -78, "(": 402, "\u53CB": 75, "\u50D5": 299, "\u3065": -539, "\u3010": 368, "\u3000": -695, "\u5C0F": 244, "\u5207": -192, "\u63DB": -239, "\u56DE": -380, "\u4E8C": 438, "\u8FBC": -346, "\u30D0": 93, "\u306C": -173, "\u697D": 174, "\uFF4F": -168, "\u672C": -26, "\u6C34": 123, "\u307C": -349, "\u8857": 232, "\u201D": -927, "\u5C11": 102, "\u6A5F": -41, "\u54C1": -112, "\u30C8": -61, "\u52D5": -14, "\u30AF": -35, "\u5165": 54, "\u4EE3": -128, "\u30EC": -39, "\u30B3": 41, "\u6D77": 163, "\u2605": -456, "\u590F": 213, "\uFF33": -50, "\u6771": 409, "\u5E74": -101, "\u30CB": -66, "\u7F8E": 118, "\u5238": -250, "\u901A": -77, "\u8A71": 104, "\u524D": -43, "\u796D": 329, "\u53C2": 227, "\u8FD4": -112, "\u805E": 85, "\u3075": -118, "\u771F": -116, "\u30D3": -58, "\u4F4F": 70, "\u56DB": 194, "\u5B9F": 44, "\u5168": 48, "\u3071": -125, "\uFF3E": -197, "\u3043": -126, "\u30B0": -20, "\u9AD8": 32, "\u5F7C": 41, "\u59FF": 23, "\u8AB0": 136, "\u30C9": -33, "\u7ACB": -82, "\u60C5": -14, "\u5E97": 22, "\u81ED": 347, "\u5F0F": -76, "\u614B": -24, "\u5B89": 52, "\u4F8B": 74, "\u3072": 49, "\u4F5C": -19, "\u808C": 6, "\u5FC3": 6, "\u65C5": 9, "\u79FB": -17, "\u8DB3": 17, "\u9053": 3, "\u7269": -12, "\u7518": 9, "\u4E09": 4, "\u5EA6": -4 }, "UW5": { "\u3002": -674, "\u3001": -346, "\u306A": -317, "\u306F": -336, "\u306B": -271, "\u3046": 172, "\u3063": 529, "\u305D": -621, "\u3068": -276, "\u3067": -289, "\u304D": 367, "\u3092": -232, "\u308B": 172, "\u307E": -19, "\u3059": -275, "\u3048": 248, "\u3044": 160, "\u306E": -247, "\u3079": 877, "\u30E9": 186, "\u3058": 322, "\u3053": 49, "\u52D5": 712, "\u308C": 204, "\u3082": -128, "\u305F": 4, "\u30FB": -282, "\u3057": -123, "\u304F": 141, "\u3081": 184, "\u3055": -135, "\u300D": -340, "\u4F9B": 203, "\u30EB": -252, "\u3042": -212, "\u304B": 71, "\u5E2F": 89, "\u529B": 137, "\u3064": 443, "\u80FD": 5, "\u30C8": -132, "\u30F3": -77, "\u3078": -320, "\u4E0A": -300, "\u5668": -87, "\u65E5": 203, "\u601D": -109, "\u304C": -175, "\u307C": 484, "\u308A": 93, "\u3056": 178, "\u3093": 407, "\u3076": 43, "\u3060": -93, "\u3088": -151, "\u3051": -56, "\uFF3D": -113, "\u308F": 267, "\u305A": 293, "\u3061": 226, "\u56DE": 300, "\u5E74": 380, "[": -131, "\uFF01": -143, "\uFF0E": -205, "\u30B9": -67, "\u5F53": 217, "\u3066": 84, "\u90FD": 26, "\u5229": 346, "\u30A4": 77, "\u5E83": -175, "\u308D": -71, "\u7684": -90, "\u3073": 270, "\u30E5": -87, "\u4E08": 293, "\u8449": 122, "\u5927": -66, "\u3089": 71, "\u96FB": -47, "\u666F": 147, "\u6240": 10, "\uFF11": -88, "\u8A00": -116, "\u958B": 103, "\u3069": -41, "\u5BFA": -104, "\u672C": 121, "\u4F53": -383, "\u9769": -244, "\u304E": 139, "\u4F5C": 104, "\u5238": -65, "\u2026": -59, "\u6709": -41, "\u3080": 174, "\u306D": -52, "\u7248": -41, "\u5148": -251, "\u8981": 29, "\u30B0": -23, "\u5408": 23, "\u4E00": -30, "\u6539": -52, "\u3005": 51, "\u30D0": -33, "\uFF1F": -29, "\u4F7F": -82, "\uFF12": -49, "\u8EFD": 27, "\u884C": -32, "\u671F": 32, "\u9762": 21, "\u30ED": 9, "\u660E": 20, "\u30E3": 3, "\u6CD5": -15, "\u30C6": -3 }, "UW2": { "\u3002": -529, "\u306E": -308, "\u3092": -850, "\u3001": -535, "\u3057": 117, "\u306B": -356, "\u304B": 23, "\u3082": -359, "\u304C": -287, "\u3068": -398, "\u3063": 90, "\u3067": -342, "\u308C": 34, "\u305D": -238, "\u3088": -28, "\u304A": -470, "\u305E": -457, "\u3066": -289, "\u4EE5": 1111, "\u3059": 188, "\u307E": 163, "\u4EBA": 184, "\u3055": 308, "\u300D": 102, "\u3064": -181, "\u3060": 161, "\u3042": -128, "\u3081": 65, "\u3046": -203, "\u898B": -171, "\u624B": 458, "\u304F": -253, "\u5C11": 316, "\u306F": -346, "\u5168": 550, "\u4E00": 524, "\u306A": -223, "\u89E3": 349, "\u304D": -22, "\u3051": 99, "\u3044": -42, "\u7279": 270, "\u6CD5": 546, "\u3069": -153, "\u826F": 150, "\u7D50": 1020, "\u98DF": 125, "\u3086": 379, "\u30E9": -135, "\u6BCE": 769, "\u968F": 939, "\u3072": -1043, "\u307B": 257, "\u30A4": -68, "\u5883": -201, "\u308A": -80, "\u308B": -135, "\u540C": 397, "\u8A00": -95, "\u3093": 82, "\u3071": 113, "\u305F": -83, "\u5834": 96, "\u53D6": -186, "\u4F5C": -110, "\u5B50": -5, "\u308F": 82, "\u3084": -179, "\u591A": 240, "\u5927": 130, "\u80FD": 138, "\u305C": 424, "\uFF1F": -207, "\u77E5": -113, "\u8A71": 2, "\u76EE": -168, "\u984C": 125, "\u30C7": -143, "\u300C": -92, "\u30B5": -136, "\u3050": -135, "\uFF3D": -170, "\u3070": -93, "\u3054": -82, "\u306D": 197, "\u95A2": 739, "\u30FC": 94, "\u30B0": -101, "\u65B0": -39, "\uFF30": -393, "\uFF10": 95, "\uFF11": 82, "]": -132, "\u843D": -328, "\uFF3E": 278, "\u672C": 215, "?": -122, "\uFF12": -106, "\uFF0C": -125, "\u5148": 225, "\uFF3B": -21, "\u30B8": -65, "\u307F": -30, "\u5473": 113, "\u548C": 169, "\u751F": 117, "\u305B": 16, "\u4E57": -145, "\u7D20": -202, "\u5BB6": 47, "\u7ACB": -216, "\u30B7": -84, "\u4E16": -71, "\u6C34": 123, "[": -1, "\u300E": -101, "\u524D": 49, "\u3076": 3, "\u30B1": -94, "\u96FB": 94, "\u6211": -206, "\u6B8B": 150, "\u5238": -97, "\u4ECA": 12, "\u767E": -105, "\u8ECA": 71, "\u5897": -88, "\u632F": -81, "\u6848": 107, "\u7528": -31, "\u30D7": -26, "\u76F4": 159, "\u4E09": 80, "\u308D": -31, "\u30D0": 73, "\u7740": -14, "\u51B7": -22, "\u7A7A": -11, "\u65E9": 94, "\u5B9F": 50, "\uFF15": -43, "\u3052": 40, "\u4E26": 28, "\u8FFD": -47, "\u9AD8": 9, "\u662F": 7, "\u5909": -3, "\u30D5": -1 }, "UW1": { "\u3044": -85, "\u306B": -141, "\u3067": -122, "\u306A": -109, "\u3064": 209, "\u3002": -24, "\u306F": -65, "\u308A": -105, "\u3068": 36, "\u304C": -106, "\u3053": 43, "\u305D": 47, "\u3069": 124, "\u3046": 21, "\u3057": -27, "\u898B": 88, "\u3060": -97, "\u5927": 155, "\u3066": 68, "\u306E": 5, "\u4E0A": -86, "\u3093": 94, "\u304A": 15, "\u5341": -92, "\u305F": -30, "\u304B": -72, "\u6C34": 48, "\u77E5": 38, "\u3078": -23, "\u59CB": 130, "\u30C3": 196, "\u30D7": -268, "\u3063": 87, "\u4F5C": 25, "\u304F": 44, "\uFF3B": -168, "\u30BF": 26, "\u5C0F": 265, "\u308D": 134, "\u65B0": 119, "\u3082": 10, "\u300C": -110, "\uFF0E": -184, "\u300E": -146, "\u7A4D": -240, "\u3084": -89, "\u30A4": -99, "\u884C": -39, "\u4EAC": -118, "\u30E1": 168, "\u30B9": -53, "\u3061": 81, "\u30D0": 110, "\uFF10": 43, "\u9593": 106, "\u64AE": -96, "\u3048": -51, "\u308C": 36, "\u4F55": 93, "\u58CA": -117, "\u81EA": 113, "\u3056": 281, "\u3070": -43, "\u3001": -17, "\u4EBA": -30, "\u5C11": -45, "\u3089": 10, "\u8C4A": 69, "\u6642": -41, "\u57FA": -99, "\u30FC": 5, "\u8A8D": -96, "\u53D6": 47, "\u4F7F": -36, "\u30B1": -28, "\u300D": -29, "\u6A5F": 17, "\u66F8": -13, "\u8272": 13, "\u751F": -21, "\u30AA": 37, "\u3059": 6, "]": -17, "\u8A71": -6, "\u9762": -14 }, "UW6": { "\u3002": -91, "\u306E": 61, "\u304C": 121, "\u306A": 119, "\u3055": 361, "\u3092": 40, "\u3057": 187, "\u3067": 51, "\u306F": 96, "\u3046": 53, "\u3001": -15, "\u3066": -14, "\u3084": 268, "\u306B": 102, "\u308A": 217, "\u305B": -165, "\u307F": 265, "\u3042": -70, "\u308B": 97, "\u3044": 114, "\u3069": 175, "\u300D": -94, "\u3064": 238, "\u30FC": -64, "\u3068": 25, "\u3071": 445, "\u3063": 192, "\u304A": -114, "\u3082": 38, "\u30B0": 138, "\u6027": 11, "\u30D3": 249, "\u30B3": 63, "\u304B": 132, "\u307E": 175, "\u3081": 251, "\u5834": -184, "\u4ED8": 42, "\u3051": -30, "\u304F": 87, "\u4F9B": -335, "\u4EBA": -33, "\u753B": 232, "\u30AF": -138, "\u30F3": -62, "\u7684": 122, "\u30E5": 117, "\u3050": 23, "\u308F": 138, "\u3093": 138, "\u30BF": 93, "\uFF10": 305, "\u30FB": -81, "\u308C": 66, "\u904A": -229, "\u3070": 120, "\u7A7A": 301, "\u901A": -49, "\u308D": 102, "\u65E5": 97, "\u305D": 63, "\u5BFA": 185, "\u30B9": 15, "\u898B": -40, "\u5B66": -155, "\u96FB": 135, "\u6700": -121, "\u6C17": 164, "\u5730": 163, "\u3058": 164, "\u30EC": 61, "\u51FA": 160, "\u30A2": -31, "\u8A00": -139, "\u305A": -134, "\u3087": -75, "\u30B7": -42, "\u3080": 72, "\u3053": 11, "\u30AB": 40, "\u30EB": 40, "\u3059": 3, "\u30D1": -70, "\u5E83": -46, "\u8FBC": 57, "\u8FD4": 79, "\u516C": -16, "\u30D4": 124, "\u3089": 8, "\uFF0C": 19, "\u3088": 8, "\uFF1A": 131, "\u3083": -20, "\u6C34": 69, "\u3060": -6, "\uFF33": -3, "\u5408": 12, "\u6765": -6, "\u3061": 1 }, "BW2": { "\u3068\u3053": -713, "\u306A\u3044": -1317, "\u3068\u3044": 121, "\u305B\u304F": 2467, "\u3068\u304A": -1189, "\u3067\u3059": -1081, "\u3066\u3044": -619, "\u3078\u3088": 1283, "\u306E\u3067": -545, "\u3067\u3042": -1440, "\u3044\u3088": -1010, "\u305F\u3068": 360, "\u306E\u307F": -1007, "\u3046\u3054": 673, "\u305F\u3044": -934, "\u306A\u3069": -902, "\u3066\u304A": -1002, "\u306B\u3082": -636, "\u3067\u3082": -693, "\u305F\u307E": -658, "\u308B\u3088": -359, "\u3044\u305F": -617, "\u304F\u306A": -746, "\u3066\u304F": -533, "\u3001\u3068": -465, "\u3067\u304D": -834, "\u306F\u3058": -952, "\u306B\u306F": -393, "\u5FB4\u30A8": 984, "\u3068\u3081": -228, "\u672C\u30A4": 1172, "\u3067\u3057": -729, "\u3046\u3069": -808, "\u5E2F\u96FB": -285, "\u3082\u3064": -208, "\u306E\u304C": -425, "\u3084\u3059": -667, "\u3044\u307E": -362, "\u306A\u304F": -293, "\u3044\u5408": -354, "\u304F\u3060": -593, "\u3089\u3086": -547, "\u3044\u3068": -336, "\u3053\u305D": -489, "\u306A\u304B": -197, "\u3044\u3044": -390, "\u3073\u4E0A": 1037, "\u3046\u3084": -350, "\u3046\u6620": 519, "\u3068\u3082": -304, "\u3044\u3082": 368, "\u305F\u3061": -345, "\u306E\u3082": -451, "\u3066\u304D": -732, "\u3089\u306A": -116, "\u3066\u307F": -737, "\u306E\u306F": -394, "\u308B\u3067": -52, "\u306E\u524D": -649, "\u3066\u3042": -944, "\u304C\u3057": 174, "\u304F\u3057": -256, "\u3069\u3053": -494, "\u3044\u65E5": 234, "\u3082\u3042": -179, "\u3046\u3053": -31, "\u3082\u3057": -273, "\u306E\u3044": 108, "\u308B\u3068": -176, "\u3066\u3082": -269, "\u306E\u304B": -203, "\u3059\u3054": -658, "\u306E\u3060": -210, "\u3069\u3082": -364, "\u304B\u306A": -243, "\u3082\u3046": -265, "\u304F\u6765": 17, "\u3068\u304B": -408, "\u306A\u3041": -331, "\u3044\u3064": -112, "\u3068\u304D": -288, "\u304B\u3057": -200, "\u3044\u306A": -242, "\u3066\u884C": -1104, "\u3067\u306A": -513, "\u305F\u3060": -398, "\u306F\u3044": -246, "\u305F\u3088": -194, "\u306A\u5834": 151, "\u308B\u306A": -278, "\u305D\u3053": -714, "\u305F\u3082": 140, "\u306A\u3042": -877, "\u306F\u305A": -387, "\u3044\u3057": -363, "\u3057\u3044": -183, "\u304C\u3063": -239, "\u3057\u305F": -143, "\u3078\u3068": -134, "\u3066\u305F": -150, "\u306F\u3042": -235, "\u3067\u306F": -198, "\u3066\u3053": -73, "\u306B\u3057": -105, "\u3070\u306A": -90, "\u308A\u3057": 73, "\u308B\u3057": -197, "\u3068\u306F": -148, "\u305F\u306A": -153, "\u3089\u3044": -134, "\u305F\u3057": -200, "\u4FC2\u306A": 503, "\u3066\u6B32": -457, "\u3002\u3068": 91, "\u308B\u304B": -98, "\u3064\u3076": -56, "\u3066\u3084": -153, "\u590F\u4F11": -51, "\u308A\u306A": 202, "\u3046\u3044": -97, "\u308A\u3082": -73, "\u3044\u3067": -88, "\u306E\u65B9": 54, "\u65E5\u672C": -151, "\u3076\u3064": -72, "\u306A\u304A": -213, "\u306E\u3054": -494, "\u305F\u3055": -48, "\u4EBA\u3044": 702, "\u3044\u72B6": 46, "\u65E5\u548C": -113, "\u306A\u3057": -92, "\u30FB\u30FB": -82, "\u8B58\u3053": 44, "\u306E\u3088": -19, "\u3044\u308F": -50, "\u300D\u3067": 280, "\u3068\u3046": -13, "\u3064\u3044": -47, "\u308C\u305F": -25, "\u3068\u3068": -48, "\u3001\u306A": -59, "\uFF0E\uFF15": -244, "\u306B\u304E": -77, "\uFF0E\uFF19": -210, "\u3066\u6765": -192, "\u3093\u3069": -4, "\u3067\u3044": -17, "\u3002\u7B11": -155, "\u304C\u306E": 31, "\uFF0E\u307E": 28 }, "BW1": { "\u3057\u3044": 548, "\u304B\u3089": 720, "\u306A\u3044": 579, "\u3093\u306B": -499, "\u3044\u3046": 261, "\u3088\u3046": -378, "\u3082\u306F": -1402, "\u306F\u3084": 93, "\u308C\u305F": 431, "\u3053\u305D": 1262, "\u307E\u307E": 1052, "\u3053\u3068": -614, "\u3057\u3066": -81, "\u3064\u306A": -733, "\u300D\u3068": 95, "\u305D\u306E": -393, "\u306E\u307F": 1389, "\u305F\u3044": 336, "\u767D\u3044": 696, "\u308B\u306E": -448, "\u3066\u3082": 250, "\u5C11\u3057": 730, "\u307E\u3082": -1330, "\u306E\u306F": 359, "\u3084\u304F": 435, "\u304B\u3082": -670, "\u3068\u304B": 674, "\u305F\u3089": 546, "\u305F\u3068": -552, "\u306A\u305E": -999, "\u3067\u3082": 241, "\u3063\u305F": 70, "\u3053\u306E": -461, "\u5168\u90E8": 387, "\u307E\u3068": -835, "\u3093\u3060": 342, "\u306B\u306F": 136, "\u3067\u306F": -151, "\u3046\u306A": 175, "\u3093\u306A": 153, "\u3061\u304C": -363, "\u3068\u304C": -597, "\u6676\u306E": 1358, "\u305F\u306E": -465, "\u4EE5\u4E0A": 320, "\u304C\u3068": -435, "\u306A\u3089": 638, "\u6700\u8FD1": 1077, "\u308B\u3068": 4, "\u3093\u3067": -224, "\u3060\u3093": 114, "\u3088\u308A": 820, "\u3082\u3046": 664, "\u3082\u306E": -266, "\u3002\u30FB": 1202, "\u3044\u3068": -155, "\u304F\u308C": 673, "\u601D\u3044": -809, "\u3046\u306B": -43, "\u304A\u3067": -1153, "\u3088\u304F": 374, "\u304B\u3057": 521, "\u306B\u3082": 299, "\u77E5\u3089": -163, "\u9752\u3044": 237, "\u308C\u3066": -176, "\u3081\u3066": 78, "\u624B\u9806": 450, "\u305E\u306A": -78, "\u540C\u3058": 339, "\u3060\u3051": 489, "\u3059\u306E": -259, "\u3044\u306E": -158, "\u304D\u305F": 227, "\u3059\u3044": 44, "\u307E\u3060": 263, "\u3044\u3044": -134, "\u4F7F\u3044": -565, "\u307E\u308A": 243, "\u3051\u3069": 434, "\u6575\u306A": 298, "\u305F\u3060": 418, "\u306A\u3050": 404, "\u3057\u305F": 129, "\u3068\u3046": 58, "\u306A\u304F": 234, "\u304C\u3001": 407, "\u308A\u3068": 396, "\u3044\u306A": -82, "\u304F\u3066": 332, "\u306A\u305C": 1022, "\u4EBA\u304C": 104, "\u3068\u306B": -164, "\u8A00\u3044": -428, "\u554F\u3044": -316, "\u8CB7\u3044": -597, "\u308C\u304C": -308, "\u306E\u9593": 715, "\u3068\u304D": 826, "\u3044\u3067": -477, "\u821E\u3046": 443, "\u3059\u304C": -135, "\u306A\u3069": 487, "\u306E\u304C": 262, "\u3093\u3066": 220, "\u3084\u3089": 461, "\u305F\uFF0E": 409, "\u306E\u3067": 96, "\u3048\u3070": 231, "\u5229\u306A": 187, "\u3066\u306F": -175, "\u7684\u306A": 140, "\u306F\u3001": 203, "\u3071\u308A": 322, "\u3046\u305E": 82, "\u3082\u3057": 637, "\u3068\u3067": 195, "\u3057\u305A": -351, "\u53D6\u308A": -196, "\u3046\u3084": -118, "\u3053\u3046": -155, "\u73FE\u5728": 495, "\u5927\u5909": 106, "\u307B\u307C": 387, "\u3068\u3082": -55, "\u3044\u305F": 105, "\u5F85\u3061": -312, "\u3068\u306E": 95, "\u306E\u5F8C": 495, "\u3053\u3053": 401, "\u3046\u304B": 175, "\u7A7A\u304D": -161, "\u5B89\u306B": -535, "\u3001\u3068": 77, "\u3066\u3044": -110, "\u4E00\u756A": 65, "\u4F7F\u3046": 173, "\u3068\u306F": -100, "\u3042\u30FC": 941, "\u666E\u6BB5": 308, "\u3044\u3082": -343, "\u308B\u306B": -83, "\u3046\u3068": -101, "\u304D\u306A": 64, "\uFF28\uFF0E": -249, "\u6A4B\u306B": 52, "\u3001\u4ECA": 324, "\u3079\u304D": 568, "\u307E\u3042": 213, "\u3068\u3044": -36, "\u4E0A\u306B": 28, "\u3067\u3001": 71, "\u3044\u300D": 165, "\u304B\u3001": -115, "\u3044\u3001": -24, "\u3064\u3076": -134, "\u3066\u308B": 87, "\u3061\u3089": -147, "\u3089\u306A": -208, "\u3057\u304B": 22, "\uFF3E\uFF3E": 102, "\u305F\u308A": 71, "\u305F\u3081": 380, "\u3076\u3093": 328, "\u306E\u3082": 48, "\uFF01\uFF01": 38, "\u4F55\u304B": 46, "\u306A\u304B": 72, "\u3081\u308B": -23, "\u6301\u3066": -232, "\u662F\u975E": 356, "\u3053\u308D": 190, "\u4E16\u306E": -522, "\u3068\u3001": 21, "\u6CD5\u7684": 79, "\u4F5C\u308A": -39, "\u3055\u308A": 103, "\u308F\u3051": 395, "\u6C17\u304C": 35, "\u3066\u305F": 68, "\u3044\u3057": 43, "\uFF10\u5186": 48, "\u306D\u30FC": 248, "\u308A\u306F": -122, "\u3059\u3089": 58, "\u3083\u3042": 173, "\u3048\u3066": -22, "\u305B\u3093": 35, "\u305C\u3072": 57, "\u843D\u3068": -52, "\u3093\u304B": 24, "\u3058\u308B": -28, "\u6301\u3064": 46, "\u304B\u304C": -28, "\u795E\u793E": 71, "\u306F\u3082": -6, "\u4E09\u56DE": 37, "\u3060\u3057": 52, "\u307E\u308B": -15, "\u308A\u306B": 4, "\u60AA\u3044": 12 }, "TW1": { "\u3088\u3044\u3088": 1543, "\u3082\u306F\u3084": 795, "\u3042\u308A\u304C": -1015, "\u3092\u3082\u3064": 778, "\u307E\u305F\u307E": 1597, "\u3053\u3093\u306B": -344, "\u3067\u898B\u308B": -1323, "\u3068\u3044\u3046": 106, "\u3093\u3069\u3093": 728, "\u3067\u304D\u308B": 167, "\u304A\u3063\u3066": 1406, "\u304C\u826F\u3044": 318, "\u307E\u3057\u305F": -542, "\u3075\u3060\u3093": 945, "\u7518\u3048\u304C": -639, "\u3060\u3093\u3069": -806, "\u5341\u5206\u306B": -359, "\u3066\u3044\u304F": 417, "\u3059\u304D\u3068": -1293, "\u3088\u3046\u306A": 446, "\u30FB\u30FB\u30FB": 596, "\u304B\u306A\u308A": 1e3, "\u3002\u5915\u65B9": 538, "\u3084\u306F\u308A": 917, "\u3053\u3068\u3082": -211, "\u3057\u304B\u3057": 450, "\u306A\u304C\u3089": 576, "\u304B\u306A\u304B": 402, "\u305F\u3061\u306E": 64, "\u3082\u306A\u304F": 116, "\u56F0\u3063\u305F": 554, "\u3087\u3063\u3068": -146, "\u3067\u304B\u3051": -196, "\u3068\u3093\u3069": 606, "\u3084\u3059\u3044": 83, "\u306A\u3093\u3068": -464, "\u6301\u3063\u3066": -346, "\u3087\u3046\u3069": 484, "\u5165\u308C\u308B": 240, "\u3063\u304B\u308A": 414, "\u3068\u601D\u3046": 153, "\u3066\u3044\u3066": 218, "\u3051\u308C\u3070": -48, "\u306B\u4EBA\u304C": 230, "\u304B\u3063\u305F": -24, "\u4EE5\u4E0A\u306B": 84, "\u305D\u3057\u3066": 193, "\u300E\u3044\u3044": -232, "\u3068\u3057\u3066": 95, "\u306A\u3063\u3066": -69, "\u305F\u307E\u305F": -144, "\u304F\u3089\u3044": 79, "\u3046\u3044\u3046": 273, "\u306E\u304A\u3082": -180, "\u304A\u3051\u3070": 121, "\u3059\u3054\u304F": 213, "\u305D\u306E\u6642": 610, "\u3001\u305D\u308C": 408, "\u59CB\u307E\u308B": 32, "\u308D\u3044\u308D": 128, "\u3057\u305F\uFF0E": 155, "\u306A\u3044\u3001": -234, "\u304F\u3066\u306F": -92, "\u3061\u308D\u3093": 170, "\u3060\u3063\u3066": 138, "\u307E\u307E\u306B": 78, "\u30E1\u30FC\u30EB": 8, "\u3088\u3046\u306B": -50, "\u3089\u3057\u304D": 117, "\u306B\u3057\u3066": -22, "\u304F\u3055\u3093": 54, "\u3072\u3068\u3064": 77, "\u308D\u305D\u308D": 62, "\u3042\u307E\u308A": 27, "\u307E\u308B\u3067": 23, "\u8272\u304B\u3089": 11, "\u611F\u3058\u308B": -9, "\u3002\u305D\u3046": 3, "\u7528\u3059\u308B": 4 }, "TW2": { "\u3044\u3068\u3053": -1279, "\u3057\u3066\u304A": -715, "\u3061\u304C\u3046": -834, "\u3067\u306F\u306A": -797, "\u5206\u306B\u3042": -1149, "\u305D\u306E\u307E": -610, "\u3046\u306B\u306A": -487, "\u3069\u3093\u3069": -356, "\u6C17\u306B\u5165": -1868, "\u304B\u3082\u3057": -123, "\u3093\u3067\u3044": -798, "\u304B\u3089\u3057": 361, "\u307E\u308B\u3067": -346, "\u3068\u304C\u3042": -598, "\u304B\u3089\u306A": -431, "\u305D\u3082\u305D": -985, "\u3067\u306F\u3042": -865, "\u3068\u3082\u3042": -408, "\u305D\u306E\u5F8C": -608, "\u308C\u308B\u3053": 251, "\u3092\u3082\u3064": -126, "\u3067\u3082\u3042": -714, "\u304D\u3068\u304A": -5, "\u3068\u306B\u306A": -244, "\u76EE\u306E\u524D": -321, "\u3067\u3082\u306A": -443, "\u3088\u3046\u3084": -146, "\u3042\u308B\u3053": 287, "\u3057\u304B\u306A": 345, "\u3068\u304C\u3067": -255, "\u3066\u3082\u3044": -495, "\u3089\u3068\u8A00": -763, "\u3082\u306E\u3059": -726, "\u3063\u3066\u3053": -146, "\u308B\u306B\u3064": -372, "\u3044\u3066\u3042": -122, "\u3044\u3044\u611F": -342, "\u5973\u306E\u5B50": -759, "\u5168\u304F\u306A": 230, "\u3057\u3066\u3044": -26, "\u3046\u3068\u3057": -40, "\u3068\u3044\u3046": -19, "\u3088\u3046\u306A": -14, "\u307E\u3067\u306B": -20, "\u306A\u308B\u307B": -77, "\u3057\u305F\u3053": -14, "\u306B\u306F\u306A": 14 }, "BW3": { "\u3053\u3068": 458, "\u3061\u306F": -232, "\u3044\u3044": 375, "\u3082\u306E": 1419, "\u3044\u3046": 254, "\u305D\u306E": 814, "\u3057\u3066": 200, "\u306F\u3058": 1177, "\u3067\u304D": 476, "\u304A\u3067": 246, "\u3042\u308B": -151, "\u306A\u308B": 249, "\u3068\u304D": 1060, "\u3053\u308C": 1032, "\u307E\u3068": 955, "\u306A\u3063": -195, "\u307E\u307E": -87, "\u3053\u306E": 990, "\u3046\u307E": 1422, "\u305D\u3046": -889, "\u53D7\u3051": 369, "\u3068\u3044": -384, "\u5206\u304B": 601, "\u4E0A\u304C": 320, "\u5F53\u65E5": 1142, "\u3061\u3087": 865, "\u304A\u308A": -485, "\u5B50\u4F9B": 153, "\u305D\u3053": 245, "\u3086\u308B": -80, "\u6A5F\u5668": -974, "\u3055\u3093": -833, "\u3082\u3089": 1253, "\u305E\u3046": 541, "\u3053\u308D": -229, "\u304B\u3063": -405, "\u306A\u3093": 99, "\u643A\u5E2F": 30, "\u305F\u307E": 488, "\u3053\u305D": -412, "\u3068\u3066": 1132, "\u304B\u306A": 193, "\u3064\u306A": 694, "\u3064\u3076": 242, "\u3088\u308A": -512, "\u305E\u306A": -146, "\u30FB\u30FB": -715, "\u305F\u3081": 593, "\u3068\u3063": 501, "\u306A\u3089": -190, "\u3082\u3046": 1008, "\u77E5\u308B": 17, "\u3067\u3082": 556, "\u30E1\u30FC": 174, "\u3057\u3044": -366, "\u3055\u3044": -294, "\u3068\u601D": -255, "\u3059\u3050": 706, "\u3055\u3042": 496, "\u3088\u304F": 476, "\u304B\u304B": 649, "\u307E\u3082": 368, "\u304B\u3089": -297, "\u3067\u3059": -221, "\u3088\u3046": -126, "\u307E\u3057": -213, "\u3044\u308D": 155, "\u304B\u3051": 749, "\u3053\u307C": 251, "\u3064\u3044": 269, "\u3059\u304B": -218, "\u3044\u3066": -132, "\u96FB\u8A71": -68, "\u307E\u3060": 320, "\u3068\u308A": 664, "\u307F\u305F": -369, "\u305D\u308C": 148, "\u307E\u3041": 609, "\u304B\u3082": -203, "\u3057\u305F": 347, "\u3044\u304B": 335, "\u3059\u3054": 747, "\u59CB\u307E": 48, "\u306A\u304B": 77, "\u3069\u3053": 385, "\u96E3\u3057": 147, "\u3068\u3064": -226, "\u65E5\u304C": 210, "\u308F\u304B": 330, "\u306F\u307E": 424, "\u3042\u3068": 558, "\u304C\u3093": 588, "\u3060\u3051": -176, "\u3082\u3093": 186, "\u305F\u3060": 234, "\u51FA\u6765": -367, "\u3059\u304D": 193, "\u30A2\u30D7": 48, "\u3051\u308C": -163, "\u3046\u3061": 122, "\u5165\u308C": 110, "\u6700\u8FD1": 237, "\u3060\u308D": -314, "\u3082\u3068": 409, "\u304D\u308B": -225, "\u3060\u3044": 249, "\u7269\u8A9E": 88, "\u554F\u984C": 172, "\u306A\u306B": 251, "\u307F\u3093": 214, "\u5927\u4F1A": -128, "\u307E\u3059": -100, "\u3082\u3063": 272, "\u5909\u3048": 385, "\u53CB\u4EBA": 89, "\u59CB\u3081": -141, "\u3067\u3001": 199, "\u3057\u3083": 156, "\u307E\u3067": -187, "\u304D\u307E": -107, "\u9803\u3067": -321, "\u5165\u5834": 125, "\u66F8\u3044": 196, "\u3079\u304D": -93, "\u9762\u767D": 78, "\u3060\u3057": 136, "\u307E\u305B": -89, "\u306F\u308B": 338, "\u305A\u3063": 182, "\u304B\u308F": 85, "\u3068\u3053": 88, "\u624B\u306B": 50, "\u3054\u3068": -247, "\u3064\u3051": 109, "\u306A\u3044": 45, "\u4EE5\u4E0A": -58, "\u3044\u305F": -42, "\u6B69\u304F": 73, "\u4F55\u3067": 71, "\u3044\u307E": 70, "\u305D\u304F": -366, "\u3046\u308C": 108, "\u8003\u3048": 52, "\u3088\u3057": 93, "\u3053\u3060": 48, "\u3069\u3044": -30, "\u3057\u304F": -76, "\u306A\u304F": 30, "\u3048\u3048": 163, "\u306A\u3069": -51, "\u6301\u3063": 63, "\u3044\u3064": 12, "\u306E\u3063": 39, "\u4F7F\u3063": 22, "\u3042\u3075": 177, "\u30EB\u30FC": 27, "\u3061\u308D": -56, "\u306B\u304E": 190, "\u307F\u308D": 181, "\u3082\u3064": 60, "\u901A\u308A": -39, "\u3042\u3066": 47, "\u3053\u3053": 22, "\u307B\u3069": -3, "\u796D\u308A": 26, "\u305D\u3057": 34, "\u6E21\u308B": -6, "\u307E\u3055": 1 }, "TW4": { "\u3042\u308A\u304C": 1289, "\u306A\u305E\u306A": 1250, "\u3088\u3046\u306A": -880, "\u3082\u306F\u3084": 1258, "\u3068\u3053\u308D": 1583, "\u3061\u304C\u3046": 1001, "\u3088\u3046\u306B": -641, "\u3044\u3088\u3044": 589, "\u3042\u308B\u3002": -133, "\u3069\u306E\u3088": 2006, "\u53EF\u80FD\u6027": 1316, "\u3068\u304A\u308A": 901, "\u3088\u3046\u3084": 650, "\u3053\u3068\u304C": -639, "\u30D7\u30ED\u30B0": 741, "\u3044\u3063\u3071": 958, "\u304F\u3089\u3044": 862, "\u3067\u304D\u305F": 906, "\u304B\u306A\u308A": 941, "\u3053\u3068\u306B": -679, "\u3042\u308A\u307E": -429, "\u3053\u3068\u3067": 161, "\u3057\u3066\u4EBA": -717, "\u304A\u308A\u306B": -190, "\u3057\u304B\u3057": 967, "\u308F\u3051\u3067": -292, "\u3053\u3068\u3082": -579, "\u305D\u306E\u307E": 347, "\u3046\u3069\u3093": 792, "\u3044\u3051\u306A": -320, "\u305D\u3046\u3067": -374, "\u30B5\u30FC\u30D3": 54, "\u3057\u305F\u3002": -398, "\u3088\u3046\u3067": -380, "\u3057\u3066\u304A": 277, "\u304A\u308A\u307E": 758, "\u304B\u3063\u305F": -235, "\u3044\u308D\u3044": 677, "\u307E\u3082\u306A": 2, "\u3053\u3068\u3002": 203, "\u3044\u3063\u3066": -270, "\u306A\u3044\u3068": 194, "\u3057\u305F\u304A": -228, "\u306A\u3093\u3068": 529, "\u3053\u3068\u3092": 122, "\u3060\u3063\u305F": -479, "\u3069\u3093\u3069": 313, "\u3053\u3068\u306F": -206, "\u306A\u3093\u3066": -410, "\u306F\u3058\u307E": 29, "\u3053\u308C\u306F": 282, "\u306A\u304B\u306A": 210, "\u5236\u5EA6\u306B": 188, "\u3042\u308B\u3044": -1252, "\u3044\u304F\u3055": -193, "\u3044\u3048\u3070": 263, "\u3072\u3068\u3064": 445, "\u306A\u3044\u3002": 58, "\u3084\u3063\u3066": 87, "\u30E1\u30FC\u30EB": 27, "\u3059\u304D\u3068": 123, "\u306A\u3093\u304B": 132, "\u3057\u3083\u3079": 718, "\u4EAC\u90FD\u306B": 156, "\u306A\u304F\u306A": 66, "\u3044\u304B\u306A": 64, "\u307E\u3063\u3066": -124, "\u306F\u307E\u3063": 106, "\u307F\u3093\u306A": 1, "\u3044\u307E\u3057": -114, "\u3057\u306A\u3044": 80, "\u3088\u308A\u306F": -74, "\u3068\u3053\u304C": 258, "\u3068\u3066\u3082": 1, "\u304D\u308C\u3044": 27, "\u3055\u3089\u306B": 86, "\u3060\u3063\u3066": 79, "\u304A\u3044\u3057": 28, "\u304B\u308F\u3044": 44, "\u624B\u306B\u5165": 15, "\u307F\u305F\u3044": -25, "\u306A\u3093\u3067": -7, "\u3067\u304D\u308B": -1 }, "TW3": { "\u306E\u3088\u3046": -656, "\u3068\u3044\u3046": 381, "\u3066\u3044\u308B": -712, "\u306E\u307E\u307E": -59, "\u306E\u672C\u306F": -859, "\u3078\u3088\u3046": 10, "\u3068\u3057\u305F": -519, "\u306B\u306A\u3063": -248, "\u3066\u3057\u307E": -665, "\u3089\u306A\u3044": -472, "\u308B\u3053\u3068": -167, "\u306E\u3088\u3044": 289, "\u308B\u65B9\u306F": -598, "\u3068\u3053\u308D": -217, "\u5E2F\u96FB\u8A71": -6, "\u304F\u3057\u3066": -456, "\u3068\u3057\u3066": 112, "\u3070\u3044\u3044": -594, "\u3059\u3053\u3068": 284, "\u3066\u307B\u3057": -665, "\u3067\u3042\u3063": -559, "\u3066\u3044\u3046": 428, "\u3001\u305D\u3057": -1770, "\u3046\u3044\u3046": -266, "\u3066\u3044\u304F": -118, "\u3067\u3042\u308B": -324, "\u3068\u8A00\u3063": -594, "\u306F\u307E\u3063": -542, "\u3068\u540C\u6642": -712, "\u3001\u307E\u305F": -382, "\u304C\u3042\u3063": 359, "\u306F\u306A\u3044": -123, "\u3066\u306A\u3044": -177, "\u306B\u3057\u304B": -181, "\u304F\u306A\u3063": -61, "\u3001\u3042\u308B": -182, "\u3066\u304A\u304D": -278, "\u3070\u306A\u3089": -31, "\u306F\u3044\u3048": -116, "\u3082\u3042\u308B": -71, "\u305F\u3053\u3068": -34, "\u306B\u3067\u3082": -166, "\u3068\u3044\u3044": -214, "\u306B\u306A\u3089": 61, "\u3068\u306A\u3063": 22, "\u305F\u305D\u3046": -65, "\u3082\u3057\u304B": -234, "\u3082\u307E\u305F": -45, "\u308B\u305D\u3046": -26, "\u304B\u3069\u3046": -22, "\u306B\u3057\u3066": -7, "\u308A\u3057\u305F": 6, "\u3082\u3044\u3044": -15, "\u306E\u5148\u306B": -21 } };
    }
  });

  // node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/data/models/ja_word.js
  var init_ja_word = __esm({
    "node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/data/models/ja_word.js"() {
    }
  });

  // node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/data/models/th.js
  var init_th = __esm({
    "node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/data/models/th.js"() {
    }
  });

  // node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/data/models/zh-hans.js
  var init_zh_hans = __esm({
    "node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/data/models/zh-hans.js"() {
    }
  });

  // node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/data/models/zh-hant.js
  var init_zh_hant = __esm({
    "node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/data/models/zh-hant.js"() {
    }
  });

  // node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/dom-browser.js
  var init_dom_browser = __esm({
    "node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/dom-browser.js"() {
    }
  });

  // node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/parser.js
  var Parser;
  var init_parser = __esm({
    "node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/parser.js"() {
      Parser = class {
        /**
         * Constructs a BudouX parser.
         * @param model A model data.
         */
        constructor(model6) {
          this.model = new Map(Object.entries(model6).map(([k, v]) => [
            k,
            new Map(Object.entries(v))
          ]));
          this.baseScore = -0.5 * [...this.model.values()].flatMap((group) => [...group.values()]).reduce((prev, curr) => prev + curr, 0);
        }
        /**
         * Parses the input sentence and returns a list of semantic chunks.
         *
         * @param sentence An input sentence.
         * @return The retrieved chunks.
         */
        parse(sentence) {
          if (sentence === "")
            return [];
          const boundaries = this.parseBoundaries(sentence);
          const result = [];
          let start = 0;
          for (const boundary of boundaries) {
            result.push(sentence.slice(start, boundary));
            start = boundary;
          }
          result.push(sentence.slice(start));
          return result;
        }
        /**
         * Parses the input sentence and returns a list of boundaries.
         *
         * @param sentence An input sentence.
         * @return The list of boundaries.
         */
        parseBoundaries(sentence) {
          var _a;
          const result = [];
          const uw1 = this.model.get("UW1");
          const uw2 = this.model.get("UW2");
          const uw3 = this.model.get("UW3");
          const uw4 = this.model.get("UW4");
          const uw5 = this.model.get("UW5");
          const uw6 = this.model.get("UW6");
          const bw1 = this.model.get("BW1");
          const bw2 = this.model.get("BW2");
          const bw3 = this.model.get("BW3");
          const tw1 = this.model.get("TW1");
          const tw2 = this.model.get("TW2");
          const tw3 = this.model.get("TW3");
          const tw4 = this.model.get("TW4");
          for (let i = 1; i < sentence.length; i++) {
            if (((_a = sentence.codePointAt(i - 1)) !== null && _a !== void 0 ? _a : 0) > 65535)
              continue;
            let score = this.baseScore;
            score += (uw1 === null || uw1 === void 0 ? void 0 : uw1.get(sentence.substring(i - 3, i - 2))) || 0;
            score += (uw2 === null || uw2 === void 0 ? void 0 : uw2.get(sentence.substring(i - 2, i - 1))) || 0;
            score += (uw3 === null || uw3 === void 0 ? void 0 : uw3.get(sentence.substring(i - 1, i))) || 0;
            score += (uw4 === null || uw4 === void 0 ? void 0 : uw4.get(sentence.substring(i, i + 1))) || 0;
            score += (uw5 === null || uw5 === void 0 ? void 0 : uw5.get(sentence.substring(i + 1, i + 2))) || 0;
            score += (uw6 === null || uw6 === void 0 ? void 0 : uw6.get(sentence.substring(i + 2, i + 3))) || 0;
            score += (bw1 === null || bw1 === void 0 ? void 0 : bw1.get(sentence.substring(i - 2, i))) || 0;
            score += (bw2 === null || bw2 === void 0 ? void 0 : bw2.get(sentence.substring(i - 1, i + 1))) || 0;
            score += (bw3 === null || bw3 === void 0 ? void 0 : bw3.get(sentence.substring(i, i + 2))) || 0;
            score += (tw1 === null || tw1 === void 0 ? void 0 : tw1.get(sentence.substring(i - 3, i))) || 0;
            score += (tw2 === null || tw2 === void 0 ? void 0 : tw2.get(sentence.substring(i - 2, i + 1))) || 0;
            score += (tw3 === null || tw3 === void 0 ? void 0 : tw3.get(sentence.substring(i - 1, i + 2))) || 0;
            score += (tw4 === null || tw4 === void 0 ? void 0 : tw4.get(sentence.substring(i, i + 3))) || 0;
            if (score > 0)
              result.push(i);
          }
          return result;
        }
      };
    }
  });

  // node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/html_processor.js
  var ZWSP_CODEPOINT, ZWSP, DomAction, domActions, WORD_BREAK, OVERFLOW_WRAP, PARENT_CSS_STYLE;
  var init_html_processor = __esm({
    "node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/html_processor.js"() {
      init_dom_browser();
      init_parser();
      ZWSP_CODEPOINT = 8203;
      ZWSP = String.fromCharCode(ZWSP_CODEPOINT);
      DomAction = {
        Inline: 0,
        // An inline content, becomes a part of a paragraph.
        Block: 1,
        // A nested paragraph.
        Skip: 2,
        // Skip the content. The content before and after are connected.
        Break: 3,
        // A forced break. The content before and after become paragraphs.
        NoBreak: 4,
        // The content provides context, but it's not breakable.
        BreakOpportunity: 5
        // Force a break opportunity.
      };
      domActions = {
        // Hidden elements
        // https://html.spec.whatwg.org/multipage/rendering.html#hidden-elements
        AREA: DomAction.Skip,
        BASE: DomAction.Skip,
        BASEFONT: DomAction.Skip,
        DATALIST: DomAction.Skip,
        HEAD: DomAction.Skip,
        LINK: DomAction.Skip,
        META: DomAction.Skip,
        NOEMBED: DomAction.Skip,
        NOFRAMES: DomAction.Skip,
        PARAM: DomAction.Skip,
        RP: DomAction.Skip,
        SCRIPT: DomAction.Skip,
        STYLE: DomAction.Skip,
        TEMPLATE: DomAction.Skip,
        TITLE: DomAction.Skip,
        NOSCRIPT: DomAction.Skip,
        // Flow content
        // https://html.spec.whatwg.org/multipage/rendering.html#flow-content-3
        HR: DomAction.Break,
        // Disable if `white-space: pre`.
        LISTING: DomAction.Skip,
        PLAINTEXT: DomAction.Skip,
        PRE: DomAction.Skip,
        XMP: DomAction.Skip,
        // Phrasing content
        // https://html.spec.whatwg.org/multipage/rendering.html#phrasing-content-3
        BR: DomAction.Break,
        RT: DomAction.Skip,
        WBR: DomAction.BreakOpportunity,
        // Form controls
        // https://html.spec.whatwg.org/multipage/rendering.html#form-controls
        INPUT: DomAction.Skip,
        SELECT: DomAction.Skip,
        BUTTON: DomAction.Skip,
        TEXTAREA: DomAction.Skip,
        // Other elements where the phrase-based line breaking should be disabled.
        // https://github.com/google/budoux/blob/main/budoux/skip_nodes.json
        ABBR: DomAction.Skip,
        CODE: DomAction.Skip,
        IFRAME: DomAction.Skip,
        TIME: DomAction.Skip,
        VAR: DomAction.Skip,
        // Deprecated, but supported in all browsers.
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/nobr
        NOBR: DomAction.NoBreak
      };
      WORD_BREAK = "keep-all";
      OVERFLOW_WRAP = "anywhere";
      PARENT_CSS_STYLE = `word-break: ${WORD_BREAK}; overflow-wrap: ${OVERFLOW_WRAP};`;
    }
  });

  // node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/index.js
  var init_module = __esm({
    "node_modules/.pnpm/budoux@0.10.3/node_modules/budoux/module/index.js"() {
      init_ja();
      init_ja_word();
      init_th();
      init_zh_hans();
      init_zh_hant();
      init_html_processor();
      init_html_processor();
      init_parser();
    }
  });

  // src/client/utils/lyrics/icuFolia/budouxJapanese.ts
  var budouxJapanese_exports = {};
  __export(budouxJapanese_exports, {
    createJapaneseParser: () => createJapaneseParser
  });
  var createJapaneseParser;
  var init_budouxJapanese = __esm({
    "src/client/utils/lyrics/icuFolia/budouxJapanese.ts"() {
      init_module();
      createJapaneseParser = () => new Parser(model);
    }
  });

  // icu-folia-stub:virtual:icu-folia-dict
  var virtual_icu_folia_dict_exports = {};
  __export(virtual_icu_folia_dict_exports, {
    DICT_FREQS: () => DICT_FREQS,
    DICT_TOTAL: () => DICT_TOTAL,
    DICT_WORDS: () => DICT_WORDS
  });
  var DICT_WORDS, DICT_FREQS, DICT_TOTAL;
  var init_virtual_icu_folia_dict = __esm({
    "icu-folia-stub:virtual:icu-folia-dict"() {
      DICT_WORDS = "";
      DICT_FREQS = "";
      DICT_TOTAL = 0;
    }
  });

  // icu-folia-stub:virtual:icu-folia-hmm
  var virtual_icu_folia_hmm_exports = {};
  __export(virtual_icu_folia_hmm_exports, {
    HMM_EMIT: () => HMM_EMIT,
    HMM_START: () => HMM_START,
    HMM_TRANS: () => HMM_TRANS,
    T2S_PAIRS: () => T2S_PAIRS
  });
  var HMM_START, HMM_TRANS, HMM_EMIT, T2S_PAIRS;
  var init_virtual_icu_folia_hmm = __esm({
    "icu-folia-stub:virtual:icu-folia-hmm"() {
      HMM_START = {};
      HMM_TRANS = {};
      HMM_EMIT = {};
      T2S_PAIRS = "";
    }
  });

  // src/client/utils/lyrics/icuFolia/engines.ts
  var engines_exports = {};
  __export(engines_exports, {
    loadIcuFoliaEngines: () => loadIcuFoliaEngines
  });
  var MAX_HMM_WORD_LENGTH, createSimplifier, loadIcuFoliaEngines;
  var init_engines = __esm({
    "src/client/utils/lyrics/icuFolia/engines.ts"() {
      init_jieba();
      init_jiebaLexicon();
      MAX_HMM_WORD_LENGTH = 2;
      createSimplifier = (pairs) => {
        const map = /* @__PURE__ */ new Map();
        for (let index = 0; index + 1 < pairs.length; index += 2) map.set(pairs[index], pairs[index + 1]);
        return (text) => Array.from(text, (char) => map.get(char) ?? char).join("");
      };
      loadIcuFoliaEngines = async () => {
        const [dict, hmm, { createJapaneseParser: createJapaneseParser2 }] = await Promise.all([
          Promise.resolve().then(() => (init_virtual_icu_folia_dict(), virtual_icu_folia_dict_exports)),
          Promise.resolve().then(() => (init_virtual_icu_folia_hmm(), virtual_icu_folia_hmm_exports)),
          Promise.resolve().then(() => (init_budouxJapanese(), budouxJapanese_exports))
        ]);
        const jieba = createJieba({
          words: dict.DICT_WORDS,
          freqs: dict.DICT_FREQS,
          total: dict.DICT_TOTAL,
          hmm: { start: hmm.HMM_START, trans: hmm.HMM_TRANS, emit: hmm.HMM_EMIT }
        }, { maxHmmWordLength: MAX_HMM_WORD_LENGTH });
        CHINESE_EXTRA_WORDS.forEach((word) => jieba.addWord(word));
        CHINESE_DEMOTED_WORDS.forEach((word) => jieba.addWord(word, 1));
        const simplify = createSimplifier(hmm.T2S_PAIRS);
        const japanese = createJapaneseParser2();
        return {
          cutChinese(text) {
            let cursor = 0;
            return jieba.cut(simplify(text)).map((word) => {
              const original = text.slice(cursor, cursor + word.length);
              cursor += word.length;
              return original;
            });
          },
          parseJapanese: (text) => japanese.parse(text)
        };
      };
    }
  });

  // src/client/render/lyrics/entry.ts
  var entry_exports = {};
  __export(entry_exports, {
    LYRIC_LINE_PRESETS: () => LYRIC_LINE_PRESETS,
    LyricParserFactory: () => LyricParserFactory,
    SEGMENTATION_DELIMITER: () => SEGMENTATION_DELIMITER,
    SegmentationImportError: () => SegmentationImportError,
    applyAutoWordSegmentation: () => applyAutoWordSegmentation,
    applyChorusRangesByTime: () => applyChorusRangesByTime,
    applyDetectedChorusEffects: () => applyDetectedChorusEffects,
    applyLyricLineRules: () => applyLyricLineRules,
    applyLyricStaffPolicy: () => applyLyricStaffPolicy,
    applyLyricWordSegmentation: () => applyLyricWordSegmentation,
    buildSegmentationBoundaries: () => buildSegmentationBoundaries,
    buildSegmentationExportText: () => buildSegmentationExportText,
    clearLyricOffsets: () => clearLyricOffsets,
    compileLyricLineRules: () => compileLyricLineRules,
    countAppliedSegmentationLines: () => countAppliedSegmentationLines,
    createLyricSegmentationRecord: () => createLyricSegmentationRecord,
    detectNonTtmlTimedLyricFormat: () => detectNonTtmlTimedLyricFormat,
    ensureLyricDataRenderHints: () => ensureLyricDataRenderHints,
    getLyricLineSegmentationKey: () => getLyricLineSegmentationKey,
    isIcuFoliaReady: () => isIcuFoliaReady,
    isLyricSegmentationRecord: () => isLyricSegmentationRecord,
    isPureMusicLyricLines: () => isPureMusicLyricLines,
    isPureMusicLyricText: () => isPureMusicLyricText,
    loadIcuFoliaFromData: () => loadIcuFoliaFromData,
    parse: () => parse,
    parseSegmentationImport: () => parseSegmentationImport,
    prepare: () => prepare,
    readLyricOffset: () => readLyricOffset,
    resolveLyricProcessingOptions: () => resolveLyricProcessingOptions,
    serializeEnhancedLrc: () => serializeEnhancedLrc,
    writeLyricOffset: () => writeLyricOffset
  });

  // src/client/utils/lyrics/renderHints.ts
  var MICRO_LINE_DURATION_THRESHOLD = 0.1;
  var SHORT_LINE_DURATION_THRESHOLD = 0.18;
  var MICRO_LINE_RENDER_FLOOR = 0.067;
  var getLastWordEndTime = (line) => {
    const lastWord = line.words?.[line.words.length - 1];
    return lastWord?.endTime ?? line.endTime;
  };
  var getLineTransitionTiming = (rawDuration, lineTransitionMode, wordRevealMode) => {
    if (lineTransitionMode === "none") {
      return {
        enterDuration: 0,
        exitDuration: 0,
        linePassHold: 0
      };
    }
    if (lineTransitionMode === "fast") {
      return {
        enterDuration: clamp(rawDuration * 0.45, 0.045, 0.06),
        exitDuration: clamp(rawDuration * 0.22, 0.03, 0.04),
        linePassHold: wordRevealMode === "instant" ? 0 : 0.03
      };
    }
    return {
      enterDuration: Math.min(0.42, Math.max(0.22, Math.max(rawDuration, 0.12) * 0.34)),
      exitDuration: Math.min(0.32, Math.max(0.18, Math.max(rawDuration, 0.12) * 0.18)),
      linePassHold: wordRevealMode === "instant" ? 0 : 0.06
    };
  };
  var getTimingClass = (rawDuration) => {
    if (rawDuration < MICRO_LINE_DURATION_THRESHOLD) {
      return "micro";
    }
    if (rawDuration < SHORT_LINE_DURATION_THRESHOLD) {
      return "short";
    }
    return "normal";
  };
  var getLineTransitionMode = (timingClass) => {
    if (timingClass === "micro") {
      return "none";
    }
    if (timingClass === "short") {
      return "fast";
    }
    return "normal";
  };
  var getWordRevealMode = (timingClass) => {
    if (timingClass === "micro") {
      return "instant";
    }
    if (timingClass === "short") {
      return "fast";
    }
    return "normal";
  };
  var clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  var buildLineRenderEndTime = (line, rawDuration, lineTransitionMode, wordRevealMode) => {
    if (lineTransitionMode === "none") {
      return Math.max(line.endTime, line.startTime + MICRO_LINE_RENDER_FLOOR);
    }
    const transitionTiming = getLineTransitionTiming(rawDuration, lineTransitionMode, wordRevealMode);
    const linePassStart = Math.max(getLastWordEndTime(line), line.startTime) + transitionTiming.linePassHold;
    const exitStart = lineTransitionMode === "fast" ? Math.max(line.startTime + transitionTiming.enterDuration + 0.01, linePassStart, line.endTime - transitionTiming.exitDuration) : Math.max(linePassStart, line.endTime - transitionTiming.exitDuration);
    return Math.max(line.endTime, exitStart + transitionTiming.exitDuration);
  };
  function buildLineRenderHints(lineOrStart, endTime) {
    const line = typeof lineOrStart === "number" ? { startTime: lineOrStart, endTime: endTime ?? lineOrStart } : lineOrStart;
    const rawDuration = Math.max(line.endTime - line.startTime, 0);
    const timingClass = getTimingClass(rawDuration);
    const lineTransitionMode = getLineTransitionMode(timingClass);
    const wordRevealMode = getWordRevealMode(timingClass);
    return {
      rawDuration,
      timingClass,
      renderEndTime: buildLineRenderEndTime(line, rawDuration, lineTransitionMode, wordRevealMode),
      lineTransitionMode,
      wordRevealMode
    };
  }
  var hasExpectedRenderHints = (line, expected) => {
    const current = line.renderHints;
    return Boolean(
      current && current.rawDuration === expected.rawDuration && current.timingClass === expected.timingClass && current.renderEndTime === expected.renderEndTime && current.lineTransitionMode === expected.lineTransitionMode && current.wordRevealMode === expected.wordRevealMode
    );
  };
  var migrateLyricLinesRenderHints = (lines) => {
    let changed = false;
    const nextLines = lines.map((line) => {
      const renderHints = buildLineRenderHints(line);
      if (hasExpectedRenderHints(line, renderHints)) {
        return line;
      }
      changed = true;
      return {
        ...line,
        renderHints
      };
    });
    return {
      value: changed ? nextLines : lines,
      changed
    };
  };
  var annotateLyricLines = (lines) => {
    return migrateLyricLinesRenderHints(lines).value;
  };
  function migrateLyricDataRenderHints(lyrics) {
    if (!lyrics) {
      return { value: null, changed: false };
    }
    const migration = migrateLyricLinesRenderHints(lyrics.lines);
    if (!migration.changed) {
      return { value: lyrics, changed: false };
    }
    return {
      value: {
        ...lyrics,
        lines: migration.value
      },
      changed: true
    };
  }
  var ensureLyricDataRenderHints = (lyrics) => {
    return migrateLyricDataRenderHints(lyrics).value;
  };

  // src/client/utils/lyrics/graphemeTiming.ts
  var graphemeSegmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
  var splitLyricGraphemes = (text) => {
    if (!text) {
      return [];
    }
    if (graphemeSegmenter) {
      return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
    }
    return Array.from(text);
  };

  // src/client/utils/lyrics/estimatedLineTiming.ts
  var buildTimedWords = (text, startTime, endTime) => {
    const duration = Math.max(endTime - startTime, 0.1);
    const rawTokens = text.split(/\s+/).filter((token) => token);
    const words = [];
    const tokens = [];
    let totalWeight = 0;
    for (const token of rawTokens) {
      if (/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(token)) {
        splitLyricGraphemes(token).forEach((char) => {
          const isPunctuation = /[，。！？、：；"'）]/.test(char);
          const weight = isPunctuation ? 0 : 1;
          tokens.push({ text: char, weight });
          totalWeight += weight;
        });
      } else {
        const weight = 1 + token.length * 0.15;
        tokens.push({ text: token, weight });
        totalWeight += weight;
      }
    }
    if (totalWeight === 0) {
      totalWeight = 1;
    }
    const activeDuration = duration * 0.9;
    const timePerWeight = activeDuration / totalWeight;
    let currentWordStart = startTime;
    tokens.forEach((token) => {
      const wordDuration = token.weight * timePerWeight;
      const finalDuration = Math.max(wordDuration, 0.05);
      words.push({
        text: token.text,
        startTime: currentWordStart,
        endTime: currentWordStart + finalDuration
      });
      if (token.weight > 0) {
        currentWordStart += wordDuration;
      } else {
        currentWordStart += 0.05;
      }
    });
    if (words.length > 0) {
      const lastWord = words[words.length - 1];
      if (lastWord.endTime > endTime) {
        const scale = (endTime - startTime) / (lastWord.endTime - startTime);
        words.forEach((word) => {
          word.startTime = startTime + (word.startTime - startTime) * scale;
          word.endTime = startTime + (word.endTime - startTime) * scale;
        });
      }
    }
    return words;
  };
  var estimateLrcLineEndTime = (text, startTime, nextStartTime) => {
    let duration = nextStartTime !== void 0 ? nextStartTime - startTime : 5;
    const estimatedReadingTime = text.length * 0.5;
    if (duration > estimatedReadingTime + 2 && duration > 5) {
      duration = Math.min(duration, estimatedReadingTime + 2);
    }
    return startTime + duration;
  };

  // node_modules/.pnpm/@applemusic-like-lyrics+ttml@1.0.1/node_modules/@applemusic-like-lyrics/ttml/dist/amll-ttml.mjs
  var NS = {
    TT: "http://www.w3.org/ns/ttml",
    TTM: "http://www.w3.org/ns/ttml#metadata",
    ITUNES: "http://music.apple.com/lyric-ttml-internal",
    AMLL: "http://www.example.com/ns/amll",
    XML: "http://www.w3.org/XML/1998/namespace",
    XMLNS: "http://www.w3.org/2000/xmlns/",
    ITUNES_INTERNAL: "http://music.apple.com/lyric-ttml-internal",
    TTS: "http://www.w3.org/ns/ttml#styling"
  };
  var Elements = {
    TT: "tt",
    Head: "head",
    Body: "body",
    Div: "div",
    P: "p",
    Span: "span",
    Title: "title",
    Name: "name",
    Meta: "meta",
    ITunesMetadata: "iTunesMetadata",
    TTMLMetadata: "metadata",
    Songwriters: "songwriters",
    Songwriter: "songwriter",
    Translation: "translation",
    Translations: "translations",
    Transliteration: "transliteration",
    Transliterations: "transliterations",
    Text: "text",
    ParserError: "parsererror",
    Agent: "agent"
  };
  var Attributes = {
    Timing: "timing",
    Id: "id",
    Key: "key",
    Value: "value",
    Lang: "lang",
    For: "for",
    SongPart: "songPart",
    SongPartKebab: "song-part",
    Begin: "begin",
    End: "end",
    Role: "role",
    Type: "type",
    Dur: "dur",
    Xmlns: "xmlns",
    Ruby: "ruby",
    Obscene: "obscene",
    EmptyBeat: "empty-beat"
  };
  var QualifiedAttributes = {
    ITunesTiming: "itunes:timing",
    ITunesPart: "itunes:songPart",
    ITunesKey: "itunes:key",
    TTMAgent: "ttm:agent",
    TTMRole: "ttm:role",
    TTMName: "ttm:name",
    AmllMeta: "amll:meta",
    AmllObscene: "amll:obscene",
    AmllEmptyBeat: "amll:empty-beat",
    XmlLang: "xml:lang",
    XmlId: "xml:id",
    XmlnsTtm: "xmlns:ttm",
    XmlnsTts: "xmlns:tts",
    XmlnsItunes: "xmlns:itunes",
    XmlnsAmll: "xmlns:amll",
    TtsRuby: "tts:ruby"
  };
  var Values = {
    Word: "Word",
    Line: "Line",
    MimeXML: "application/xml",
    MusicName: "musicName",
    Artists: "artists",
    Album: "album",
    ISRC: "isrc",
    TTMLAuthorGithub: "ttmlAuthorGithub",
    TTMLAuthorGithubLogin: "ttmlAuthorGithubLogin",
    NCMMusicId: "ncmMusicId",
    QQMusicId: "qqMusicId",
    SpotifyId: "spotifyId",
    AppleMusicId: "appleMusicId",
    RoleBg: "x-bg",
    RoleTranslation: "x-translation",
    RoleRoman: "x-roman",
    Group: "group",
    Person: "person",
    Other: "other",
    Full: "full",
    AgentGroup: "v1000",
    AgentDefault: "v1",
    AgentDefaultDuet: "v2",
    RubyContainer: "container",
    RubyBase: "base",
    RubyTextContainer: "textContainer",
    RubyText: "text",
    True: "true",
    TimingMode: "timingMode",
    Language: "language"
  };
  var TTMLParser = class TTMLParser2 {
    domParser;
    static TIME_REGEX = /^(?:(?:(?<hours>\d+):)?(?<minutes>\d+):)?(?<seconds>\d+(?:\.\d+)?)$/;
    static LEADING_SPACE_REGEX = /^\s/;
    static TRAILING_SPACE_REGEX = /\s$/;
    static MULTI_SPACE_REGEX = /\s+/g;
    normalizeText(text, trim = true) {
      if (!text) return "";
      const normalized = text.replace(TTMLParser2.MULTI_SPACE_REGEX, " ");
      return trim ? normalized.trim() : normalized;
    }
    /**
    * 构造一个 TTML 解析器实例
    *
    * @param options 生成器配置选项
    *
    * 在 Node.js 环境下必须注入 `domParser` 实例（例如用 `@xmldom/xmldom` 等）
    */
    constructor(options) {
      if (options?.domParser) this.domParser = options.domParser;
      else if (typeof DOMParser !== "undefined") this.domParser = new DOMParser();
      else throw new Error("No DOMParser found. If you are running in Node.js, please inject a DOMParser (e.g., @xmldom/xmldom).");
    }
    /**
    * 解析 TTML 字符串的静态便捷方法
    * @param xmlStr 需要解析的 TTML XML 字符串
    * @param options 解析器配置选项，用于注入 DOM 依赖
    * @returns 解析后的结构化 TTML 数据结构
    * @throws 当输入的 XML 字符串格式无效时抛出异常
    */
    static parse(xmlStr, options) {
      return new TTMLParser2(options).parse(xmlStr);
    }
    /**
    * 解析 TTML 字符串
    * @param xmlStr 需要解析的 TTML XML 字符串
    * @returns 解析后的结构化 TTML 数据结构
    * @throws 当输入的 XML 字符串格式无效时抛出异常
    */
    parse(xmlStr) {
      if (!xmlStr || typeof xmlStr !== "string") throw new Error("TTMLParser: Input must be a valid XML string.");
      const doc = this.domParser.parseFromString(xmlStr, Values.MimeXML);
      const { metadata, sidecar } = this.parseHead(doc);
      const parserError = doc.getElementsByTagName(Elements.ParserError)[0];
      if (parserError) throw new Error(`TTMLParser: XML parsing error: ${parserError.textContent}`);
      const result = {
        metadata,
        lines: []
      };
      const root = doc.documentElement;
      if (root) {
        const lang = this.getAttr(root, NS.XML, Attributes.Lang);
        if (lang) result.metadata.language = lang;
        const timing = this.getAttr(root, NS.ITUNES, Attributes.Timing);
        if (timing && timing === Values.Word || timing === Values.Line) result.metadata.timingMode = timing;
      }
      this.parseBody(doc, result, sidecar);
      result.metadata.timingMode ??= this.inferTimingMode(result.lines);
      if (result.metadata.platformIds) result.metadata.platformIds = this.sortPlatformIds(result.metadata.platformIds);
      return result;
    }
    inferTimingMode(lines) {
      return lines.some((line) => (line.words?.length ?? 0) > 1 || (line.backgroundVocal?.words?.length ?? 0) > 1) ? "Word" : "Line";
    }
    sortPlatformIds(platformIds) {
      const preferredOrder = [
        "ncmMusicId",
        "qqMusicId",
        "spotifyId",
        "appleMusicId"
      ];
      const orderedPlatformIds = {};
      for (const key of preferredOrder) if (platformIds[key]) orderedPlatformIds[key] = platformIds[key];
      for (const key of Object.keys(platformIds)) if (!orderedPlatformIds[key]) orderedPlatformIds[key] = platformIds[key];
      return orderedPlatformIds;
    }
    parseHead(doc) {
      const head = doc.getElementsByTagName(Elements.Head)[0];
      const resultMeta = {
        title: [],
        artist: [],
        album: [],
        isrc: [],
        authorIds: [],
        authorNames: [],
        songwriters: [],
        agents: {},
        rawProperties: {}
      };
      const sidecar = {};
      if (!head) return {
        metadata: resultMeta,
        sidecar
      };
      this.parseTTMElements(head, resultMeta);
      this.parseAMLLMeta(head, resultMeta);
      this.parseiTunesExtensions(head, resultMeta, sidecar);
      this.deduplicateMetadata(resultMeta);
      return {
        metadata: resultMeta,
        sidecar
      };
    }
    deduplicateMetadata(meta) {
      const dedupe = (arr) => arr ? Array.from(new Set(arr)) : [];
      meta.title = dedupe(meta.title);
      meta.artist = dedupe(meta.artist);
      meta.album = dedupe(meta.album);
      meta.isrc = dedupe(meta.isrc);
      meta.authorIds = dedupe(meta.authorIds);
      meta.authorNames = dedupe(meta.authorNames);
      meta.songwriters = dedupe(meta.songwriters);
      if (meta.platformIds) {
        for (const key of Object.keys(meta.platformIds)) if (meta.platformIds[key]) meta.platformIds[key] = dedupe(meta.platformIds[key]);
      }
      if (meta.rawProperties) {
        for (const key of Object.keys(meta.rawProperties)) if (meta.rawProperties[key]) meta.rawProperties[key] = dedupe(meta.rawProperties[key]);
      }
    }
    parseTTMElements(head, meta) {
      const titles = head.getElementsByTagNameNS(NS.TTM, Elements.Title);
      if (titles.length > 0 && titles[0].textContent) meta.title?.push(titles[0].textContent.trim());
      const agents = Array.from(head.getElementsByTagNameNS(NS.TTM, Elements.Agent));
      for (const agent of agents) {
        const id = this.getAttr(agent, NS.XML, Attributes.Id);
        if (!id) continue;
        const type = this.getAttr(agent, NS.TTM, Attributes.Type, Attributes.Type);
        const names = agent.getElementsByTagNameNS(NS.TTM, Elements.Name);
        const agentObj = { id };
        if (type) agentObj.type = type;
        if (names.length > 0 && names[0].textContent) {
          const rawName = names[0].textContent.trim();
          if (rawName.length > 0) agentObj.name = rawName;
        }
        meta.agents ??= {};
        meta.agents[id] = agentObj;
      }
    }
    parseAMLLMeta(head, meta) {
      const validMetas = Array.from(head.getElementsByTagNameNS(NS.AMLL, Elements.Meta)).filter((el) => {
        return this.getAttr(el, NS.AMLL, Attributes.Key) && this.getAttr(el, NS.AMLL, Attributes.Value);
      });
      for (const el of validMetas) {
        const key = this.getAttr(el, NS.AMLL, Attributes.Key);
        const value = this.getAttr(el, NS.AMLL, Attributes.Value)?.trim();
        if (!key || !value) continue;
        switch (key) {
          case Values.MusicName:
            meta.title?.push(value);
            break;
          case Values.Artists:
            meta.artist?.push(value);
            break;
          case Values.Album:
            meta.album?.push(value);
            break;
          case Values.ISRC:
            meta.isrc?.push(value);
            break;
          case Values.TTMLAuthorGithub:
            meta.authorIds?.push(value);
            break;
          case Values.TTMLAuthorGithubLogin:
            meta.authorNames?.push(value);
            break;
          case Values.NCMMusicId:
          case Values.QQMusicId:
          case Values.SpotifyId:
          case Values.AppleMusicId:
            meta.platformIds ??= {};
            (meta.platformIds[key] ??= []).push(value);
            break;
          default:
            meta.rawProperties ??= {};
            (meta.rawProperties[key] ??= []).push(value);
            break;
        }
      }
    }
    extractSubContent(base, lang, ignoreWords = false) {
      const result = {};
      const mainText = this.normalizeText(base.text);
      const hasMainWords = !ignoreWords && base.words && base.words.length > 0;
      if (mainText || hasMainWords) {
        const main = { text: mainText };
        if (lang) main.language = lang;
        if (hasMainWords) {
          if (!(base.words?.length === 1 && base.words?.[0].startTime === 0 && base.words?.[0].endTime === 0)) main.words = base.words;
        }
        result.main = main;
      }
      if ("backgroundVocal" in base && base.backgroundVocal) {
        const bgVocal = base.backgroundVocal;
        const bgText = this.normalizeText(bgVocal.text);
        const hasBgWords = !ignoreWords && bgVocal.words && bgVocal.words.length > 0;
        if (bgText || hasBgWords) {
          const bg = { text: bgText };
          if (lang) bg.language = lang;
          if (hasBgWords) {
            if (!(bgVocal.words?.length === 1 && bgVocal.words?.[0].startTime === 0 && bgVocal.words?.[0].endTime === 0)) bg.words = bgVocal.words;
          }
          result.bg = bg;
        }
      }
      return result;
    }
    parseiTunesExtensions(head, meta, sidecar) {
      const iTunesMetas = Array.from(head.getElementsByTagName(Elements.ITunesMetadata));
      if (iTunesMetas.length === 0) return;
      for (const iTunesMeta of iTunesMetas) {
        const songwritersContainer = iTunesMeta.getElementsByTagName(Elements.Songwriters)[0];
        if (songwritersContainer) {
          const writers = Array.from(songwritersContainer.getElementsByTagName(Elements.Songwriter));
          for (const writer of writers) {
            const name = writer.textContent?.trim();
            if (name) meta.songwriters?.push(name);
          }
        }
        const processEntries = (containerTagName, itemTagName, type) => {
          const container = iTunesMeta.getElementsByTagName(containerTagName)[0];
          if (!container) return;
          const items = Array.from(container.getElementsByTagName(itemTagName));
          for (const item of items) {
            const lang = this.getAttr(item, NS.XML, Attributes.Lang);
            const textNodes = Array.from(item.getElementsByTagName(Elements.Text));
            for (const textNode of textNodes) {
              const forId = textNode.getAttribute(Attributes.For);
              const parsedContent = this.parseCommonContent(textNode);
              if (forId) {
                const subContents = this.extractSubContent(parsedContent, lang, false);
                sidecar[forId] ??= {};
                if (subContents.main) (sidecar[forId][type] ??= []).push(subContents.main);
                if (subContents.bg) {
                  const bgType = type === "translations" ? "bgTranslations" : "bgRomanizations";
                  (sidecar[forId][bgType] ??= []).push(subContents.bg);
                }
              }
            }
          }
        };
        processEntries(Elements.Translations, Elements.Translation, "translations");
        processEntries(Elements.Transliterations, Elements.Transliteration, "romanizations");
      }
    }
    parseTime(timeStr) {
      if (!timeStr) return 0;
      const cleanStr = timeStr.trim();
      if (cleanStr.length === 0) return 0;
      if (cleanStr.endsWith("s")) {
        const seconds2 = Number(cleanStr.slice(0, -1));
        if (Number.isNaN(seconds2)) return 0;
        return Math.round(seconds2 * 1e3);
      }
      const match = cleanStr.match(TTMLParser2.TIME_REGEX);
      if (match?.groups) {
        const { seconds: seconds2, minutes, hours } = match.groups;
        const secNum = Number(seconds2);
        const minNum = minutes ? parseInt(minutes, 10) : 0;
        const hrNum = hours ? parseInt(hours, 10) : 0;
        if (!Number.isNaN(secNum) && !Number.isNaN(minNum) && !Number.isNaN(hrNum)) {
          const totalSeconds = hrNum * 3600 + minNum * 60 + secNum;
          return Math.round(totalSeconds * 1e3);
        }
      }
      return 0;
    }
    parseBody(doc, result, sidecar) {
      const body = doc.getElementsByTagName(Elements.Body)[0];
      if (!body) return;
      const childNodes = Array.from(body.childNodes);
      let currentBlockIndex = 0;
      for (const node of childNodes) {
        if (node.nodeType !== 1) continue;
        const el = node;
        const tagName = el.localName || el.tagName.toLowerCase().split(":").pop();
        if (tagName === Elements.Div) {
          currentBlockIndex++;
          const songPart = this.getAttr(el, NS.ITUNES, Attributes.SongPartKebab) || this.getAttr(el, NS.ITUNES, Attributes.SongPart);
          const pNodes = el.getElementsByTagNameNS(NS.TT, Elements.P);
          const pList = pNodes.length > 0 ? Array.from(pNodes) : Array.from(el.getElementsByTagName(Elements.P));
          for (const p of pList) this.processLineElement(p, result.lines, sidecar, songPart, currentBlockIndex);
        } else if (tagName === Elements.P) {
          currentBlockIndex++;
          this.processLineElement(el, result.lines, sidecar, void 0, currentBlockIndex);
        }
      }
    }
    processLineElement(p, lines, sidecar, songPart, blockIndex) {
      const id = this.getAttr(p, NS.ITUNES, Attributes.Key);
      if (!id) return;
      const line = {
        id,
        ...this.parseCommonContent(p)
      };
      if (songPart) line.songPart = songPart;
      if (blockIndex !== void 0) line.blockIndex = blockIndex;
      const agentId = this.getAttr(p, NS.TTM, Elements.Agent);
      if (agentId) line.agentId = agentId;
      const externalData = sidecar[id];
      if (externalData) {
        if (externalData.translations) (line.translations ??= []).push(...externalData.translations);
        if (externalData.romanizations) (line.romanizations ??= []).push(...externalData.romanizations);
        if (externalData.bgTranslations && line.backgroundVocal) (line.backgroundVocal.translations ??= []).push(...externalData.bgTranslations);
        if (externalData.bgRomanizations && line.backgroundVocal) (line.backgroundVocal.romanizations ??= []).push(...externalData.bgRomanizations);
      }
      lines.push(line);
    }
    parseCommonContent(element) {
      const beginAttr = this.getAttr(element, NS.XML, Attributes.Begin, Attributes.Begin);
      const endAttr = this.getAttr(element, NS.XML, Attributes.End, Attributes.End);
      const originalStartTime = this.parseTime(beginAttr);
      const originalEndTime = this.parseTime(endAttr);
      const state = this.extractNodeState(element);
      if (state.backgroundVocal) {
        if (state.bgTranslations.length > 0) (state.backgroundVocal.translations ??= []).push(...state.bgTranslations);
        if (state.bgRomanizations.length > 0) (state.backgroundVocal.romanizations ??= []).push(...state.bgRomanizations);
      }
      this.finalizeWords(state.words);
      const { startTime, endTime } = this.calculateTimeRange(originalStartTime, originalEndTime, state.words, state.backgroundVocal);
      const cleanFullText = this.normalizeText(state.fullText);
      const hasTimeAttrs = beginAttr !== null || endAttr !== null;
      this.applyFallbackWord(state.words, cleanFullText, hasTimeAttrs, originalStartTime, originalEndTime, startTime, endTime);
      return this.buildLyricBase(state, cleanFullText, startTime, endTime);
    }
    extractNodeState(element) {
      const state = {
        fullText: "",
        words: [],
        translations: [],
        romanizations: [],
        bgTranslations: [],
        bgRomanizations: [],
        backgroundVocal: void 0
      };
      const childNodes = Array.from(element.childNodes);
      for (const node of childNodes) if (node.nodeType === 3) this.processTextNode(state, node);
      else if (node.nodeType === 1) this.processElementNode(state, node);
      return state;
    }
    calculateTimeRange(originalStart, originalEnd, words, bgVocal) {
      let startTime = originalStart;
      let endTime = originalEnd;
      const timedElements = [...words];
      if (bgVocal) timedElements.push(bgVocal);
      if (timedElements.length > 0) {
        let minChildStart = Infinity;
        let maxChildEnd = 0;
        for (const el of timedElements) {
          if (el.startTime < minChildStart) minChildStart = el.startTime;
          if (el.endTime > maxChildEnd) maxChildEnd = el.endTime;
        }
        if (startTime === 0 || minChildStart > 0 && minChildStart < startTime) startTime = minChildStart === Infinity ? 0 : minChildStart;
        if (endTime === 0 || maxChildEnd > endTime) endTime = maxChildEnd;
      }
      return {
        startTime,
        endTime
      };
    }
    applyFallbackWord(words, cleanText, hasTimeAttrs, origStart, origEnd, calcStart, calcEnd) {
      if (words.length === 0 && cleanText.length > 0 && hasTimeAttrs) words.push({
        text: cleanText,
        startTime: origStart > 0 ? origStart : calcStart,
        endTime: origEnd > 0 ? origEnd : calcEnd,
        endsWithSpace: false
      });
    }
    buildLyricBase(state, cleanText, startTime, endTime) {
      return {
        text: cleanText,
        startTime,
        endTime,
        words: state.words.length > 0 ? state.words : void 0,
        translations: state.translations.length > 0 ? state.translations : void 0,
        romanizations: state.romanizations.length > 0 ? state.romanizations : void 0,
        backgroundVocal: state.backgroundVocal
      };
    }
    processTextNode(state, node) {
      const rawText = node.textContent || "";
      const isFormatting = rawText.includes("\n");
      if (isFormatting && rawText.trim().length === 0) return;
      const normalizedText = this.normalizeText(rawText, false);
      state.fullText += normalizedText;
      if (!isFormatting && normalizedText.length > 0 && normalizedText.trim().length === 0) {
        if (state.words.length > 0) state.words[state.words.length - 1].endsWithSpace = true;
      }
    }
    processElementNode(state, el) {
      const role = this.getAttr(el, NS.TTM, Attributes.Role);
      if (this.getAttr(el, NS.TTS, Attributes.Ruby, QualifiedAttributes.TtsRuby) === Values.RubyContainer) {
        this.processRubyElement(state, el);
        return;
      }
      switch (role) {
        case Values.RoleBg:
          state.backgroundVocal = this.parseBackgroundVocal(el);
          break;
        case Values.RoleTranslation: {
          const translation = this.parseInlineSubContent(el);
          if (translation) {
            if (translation.main) state.translations.push(translation.main);
            if (translation.bg) state.bgTranslations.push(translation.bg);
          }
          break;
        }
        case Values.RoleRoman: {
          const romanization = this.parseInlineSubContent(el);
          if (romanization) {
            if (romanization.main) state.romanizations.push(romanization.main);
            if (romanization.bg) state.bgRomanizations.push(romanization.bg);
          }
          break;
        }
        default:
          this.processWordElement(state, el);
          break;
      }
    }
    processRubyElement(state, containerEl) {
      const isObscene = this.getAttr(containerEl, NS.AMLL, Attributes.Obscene, QualifiedAttributes.AmllObscene) === "true";
      const emptyBeatAttr = this.getAttr(containerEl, NS.AMLL, Attributes.EmptyBeat, QualifiedAttributes.AmllEmptyBeat);
      let emptyBeat;
      if (emptyBeatAttr) {
        const parsedBeat = parseInt(emptyBeatAttr, 10);
        if (!Number.isNaN(parsedBeat)) emptyBeat = parsedBeat;
      }
      let baseText = "";
      const rubyTags = [];
      const childNodes = Array.from(containerEl.childNodes);
      for (const node of childNodes) {
        if (node.nodeType !== 1) continue;
        const childEl = node;
        const childRubyAttr = this.getAttr(childEl, NS.TTS, Attributes.Ruby, QualifiedAttributes.TtsRuby);
        if (childRubyAttr === Values.RubyBase) baseText = this.normalizeText(childEl.textContent, false);
        else if (childRubyAttr === Values.RubyTextContainer) {
          const textNodes = Array.from(childEl.childNodes);
          for (const textNode of textNodes) {
            if (textNode.nodeType !== 1) continue;
            const tNode = textNode;
            if (this.getAttr(tNode, NS.TTS, Attributes.Ruby, QualifiedAttributes.TtsRuby) === Values.RubyText) {
              const begin = this.getAttr(tNode, NS.XML, Attributes.Begin, Attributes.Begin);
              const end = this.getAttr(tNode, NS.XML, Attributes.End, Attributes.End);
              const text = this.normalizeText(tNode.textContent, false).trim();
              if (text && begin && end) rubyTags.push({
                text,
                startTime: this.parseTime(begin),
                endTime: this.parseTime(end)
              });
            }
          }
        }
      }
      if (!baseText) return;
      state.fullText += baseText;
      let startTime = 0;
      let endTime = 0;
      if (rubyTags.length > 0) {
        startTime = Math.min(...rubyTags.map((t) => t.startTime));
        endTime = Math.max(...rubyTags.map((t) => t.endTime));
      }
      const cleanBaseText = baseText.trim();
      if (cleanBaseText.length > 0) {
        const endsWithSpace = TTMLParser2.TRAILING_SPACE_REGEX.test(baseText);
        if (TTMLParser2.LEADING_SPACE_REGEX.test(baseText) && state.words.length > 0) state.words[state.words.length - 1].endsWithSpace = true;
        state.words.push({
          text: cleanBaseText,
          startTime,
          endTime,
          ruby: rubyTags.length > 0 ? rubyTags : void 0,
          endsWithSpace,
          obscene: isObscene ? true : void 0,
          emptyBeat
        });
      }
    }
    processWordElement(state, el) {
      const wBegin = this.getAttr(el, NS.XML, Attributes.Begin, Attributes.Begin);
      const wEnd = this.getAttr(el, NS.XML, Attributes.End, Attributes.End);
      const isObscene = this.getAttr(el, NS.AMLL, Attributes.Obscene, QualifiedAttributes.AmllObscene) === "true";
      const emptyBeatAttr = this.getAttr(el, NS.AMLL, Attributes.EmptyBeat, QualifiedAttributes.AmllEmptyBeat);
      let emptyBeat;
      if (emptyBeatAttr) {
        const parsedBeat = parseInt(emptyBeatAttr, 10);
        if (!Number.isNaN(parsedBeat)) emptyBeat = parsedBeat;
      }
      const rawWText = el.textContent || "";
      const normalizedWText = this.normalizeText(rawWText, false);
      state.fullText += normalizedWText;
      if (wBegin && wEnd) {
        const isFormatting = rawWText.includes("\n");
        let startsWithSpace = false;
        let endsWithSpace = false;
        if (!isFormatting) {
          startsWithSpace = TTMLParser2.LEADING_SPACE_REGEX.test(normalizedWText);
          endsWithSpace = TTMLParser2.TRAILING_SPACE_REGEX.test(normalizedWText);
        }
        const cleanText = normalizedWText.trim();
        if (startsWithSpace && state.words.length > 0) state.words[state.words.length - 1].endsWithSpace = true;
        if (cleanText.length > 0) state.words.push({
          text: cleanText,
          startTime: this.parseTime(wBegin),
          endTime: this.parseTime(wEnd),
          endsWithSpace,
          obscene: isObscene ? true : void 0,
          emptyBeat
        });
      }
    }
    parseBackgroundVocal(el) {
      const { backgroundVocal, ...bgVocal } = this.parseCommonContent(el);
      bgVocal.text = bgVocal.text.replace(/^[(（]+/, "").replace(/[)）]+$/, "");
      if (bgVocal.words && bgVocal.words.length > 0) {
        bgVocal.words[0].text = bgVocal.words[0].text.replace(/^[(（]+/, "").trimStart();
        const lastIdx = bgVocal.words.length - 1;
        bgVocal.words[lastIdx].text = bgVocal.words[lastIdx].text.replace(/[)）]+$/, "").trimEnd();
      }
      return bgVocal;
    }
    parseInlineSubContent(el) {
      const lang = this.getAttr(el, NS.XML, Attributes.Lang);
      const parsed = this.parseCommonContent(el);
      const content = this.extractSubContent(parsed, lang, true);
      if (content.main || content.bg) return content;
      return null;
    }
    finalizeWords(words) {
      if (words.length === 0) return [];
      words[0].text = words[0].text.trimStart();
      const lastIdx = words.length - 1;
      words[lastIdx].text = words[lastIdx].text.trimEnd();
      words[lastIdx].endsWithSpace = false;
      return words;
    }
    getAttr(element, ns, localName, fallbackAttrName) {
      const val = element.getAttributeNS(ns, localName);
      if (val) return val;
      if (fallbackAttrName) {
        const fallbackVal = element.getAttribute(fallbackAttrName);
        if (fallbackVal) return fallbackVal;
      }
      if (element.hasAttributes()) {
        const attributes = Array.from(element.attributes);
        for (const attr of attributes) if ((attr.localName || attr.nodeName.split(":").pop()) === localName) return attr.value;
      }
      return null;
    }
  };

  // src/client/utils/lyrics/parserCore.ts
  var import_xmldom = __toESM(require_lib(), 1);

  // src/client/utils/lyrics/ttmlConversion.ts
  var NON_WESTERN_TEXT_REGEX = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/u;
  var WESTERN_JOINABLE_TEXT_REGEX = /[\p{Script=Latin}\p{N}'’`-]/u;
  var seconds = (milliseconds) => Math.max((milliseconds ?? 0) / 1e3, 0);
  var isWesternJoinableSyllable = (text) => {
    const trimmed = text.trim();
    return trimmed.length > 0 && !NON_WESTERN_TEXT_REGEX.test(trimmed) && WESTERN_JOINABLE_TEXT_REGEX.test(trimmed);
  };
  var convertRuby = (ruby) => {
    if (!ruby?.length) {
      return void 0;
    }
    return ruby.map((tag) => ({
      text: tag.text,
      startTime: seconds(tag.startTime),
      endTime: seconds(tag.endTime)
    }));
  };
  var convertSyllable = (syllable) => ({
    text: syllable.text,
    startTime: seconds(syllable.startTime),
    endTime: seconds(syllable.endTime),
    ...syllable.endsWithSpace ? { endsWithSpace: true } : {},
    ...syllable.obscene ? { obscene: true } : {},
    ...typeof syllable.emptyBeat === "number" ? { emptyBeat: syllable.emptyBeat } : {},
    ...syllable.ruby?.length ? { ruby: convertRuby(syllable.ruby) } : {}
  });
  var buildWordsFromSyllables = (syllables, fallbackText, startTime, endTime, buildTimedWords2) => {
    if (!syllables?.length) {
      return fallbackText.trim().length > 0 ? buildTimedWords2(fallbackText, startTime, endTime) : [];
    }
    const converted = syllables.map(convertSyllable);
    const words = [];
    let currentGroup = [];
    const flushGroup = () => {
      if (currentGroup.length === 0) {
        return;
      }
      const text = currentGroup.map((syllable) => syllable.text).join("");
      if (text.length > 0) {
        words.push({
          text,
          startTime: currentGroup[0].startTime,
          endTime: currentGroup[currentGroup.length - 1].endTime,
          syllables: currentGroup
        });
      }
      currentGroup = [];
    };
    for (let index = 0; index < converted.length; index += 1) {
      const current = converted[index];
      const next = converted[index + 1];
      currentGroup.push(current);
      const shouldMergeWithNext = Boolean(
        next && !current.endsWithSpace && isWesternJoinableSyllable(current.text) && isWesternJoinableSyllable(next.text)
      );
      if (!shouldMergeWithNext) {
        flushGroup();
      }
    }
    return words;
  };
  var convertAlternateTexts = (role, entries) => {
    if (!entries?.length) {
      return [];
    }
    return entries.filter((entry) => entry.text.trim().length > 0).map((entry) => ({
      role,
      ...entry.language ? { language: entry.language } : {},
      text: entry.text,
      ...entry.words?.length ? { syllables: entry.words.map(convertSyllable) } : {}
    }));
  };
  var getFirstText = (entries) => entries?.find((entry) => entry.text.trim().length > 0)?.text;
  var isChorusSongPart = (songPart) => songPart?.trim().toLowerCase() === "chorus";
  var convertBackgroundVocal = (vocal, buildTimedWords2) => {
    if (!vocal || !vocal.text.trim()) {
      return void 0;
    }
    const startTime = seconds(vocal.startTime);
    const endTime = seconds(vocal.endTime);
    const alternateTexts = [
      ...convertAlternateTexts("translation", vocal.translations),
      ...convertAlternateTexts("romanization", vocal.romanizations)
    ];
    return {
      text: vocal.text,
      startTime,
      endTime,
      words: buildWordsFromSyllables(vocal.words, vocal.text, startTime, endTime, buildTimedWords2),
      ...getFirstText(vocal.translations) ? { translation: getFirstText(vocal.translations) } : {},
      ...getFirstText(vocal.romanizations) ? { romanization: getFirstText(vocal.romanizations) } : {},
      ...alternateTexts.length > 0 ? { alternateTexts } : {}
    };
  };
  var convertLine = (line, buildTimedWords2) => {
    const startTime = seconds(line.startTime);
    const endTime = seconds(line.endTime);
    const alternateTexts = [
      ...convertAlternateTexts("translation", line.translations),
      ...convertAlternateTexts("romanization", line.romanizations)
    ];
    const backgroundVocal = convertBackgroundVocal(line.backgroundVocal, buildTimedWords2);
    return {
      words: buildWordsFromSyllables(line.words, line.text, startTime, endTime, buildTimedWords2),
      startTime,
      endTime,
      fullText: line.text,
      ...getFirstText(line.translations) ? { translation: getFirstText(line.translations) } : {},
      ...line.id ? { id: line.id } : {},
      ...line.agentId ? { agentId: line.agentId } : {},
      ...line.songPart ? { songPart: line.songPart } : {},
      ...isChorusSongPart(line.songPart) ? { isChorus: true } : {},
      ...typeof line.blockIndex === "number" ? { blockIndex: line.blockIndex } : {},
      ...getFirstText(line.romanizations) ? { romanization: getFirstText(line.romanizations) } : {},
      ...alternateTexts.length > 0 ? { alternateTexts } : {},
      ...backgroundVocal ? { backgroundVocal, backgroundVocals: [backgroundVocal] } : {}
    };
  };
  var lineToBackgroundVocal = (line) => ({
    text: line.fullText,
    startTime: line.startTime,
    endTime: line.endTime,
    words: line.words,
    ...line.agentId ? { agentId: line.agentId } : {},
    ...line.translation ? { translation: line.translation } : {},
    ...line.romanization ? { romanization: line.romanization } : {},
    ...line.alternateTexts?.length ? { alternateTexts: line.alternateTexts } : {}
  });
  var isSameTtmlBlock = (mainLine, candidate) => mainLine.blockIndex === void 0 || candidate.blockIndex === void 0 || mainLine.blockIndex === candidate.blockIndex;
  var isAgentOverlapHarmony = (mainLine, candidate) => Boolean(
    mainLine.agentId && candidate.agentId && mainLine.agentId !== candidate.agentId && candidate.startTime < mainLine.endTime && candidate.endTime > mainLine.startTime && isSameTtmlBlock(mainLine, candidate)
  );
  var foldAgentOverlapHarmonyLines = (lines) => {
    const mainLines = [];
    for (const line of lines) {
      const mainLine = [...mainLines].reverse().find((candidate) => isAgentOverlapHarmony(candidate, line));
      if (!mainLine) {
        mainLines.push(line);
        continue;
      }
      const inferredVocals = [
        lineToBackgroundVocal(line),
        ...line.backgroundVocals ?? (line.backgroundVocal ? [line.backgroundVocal] : [])
      ];
      const existingVocals = mainLine.backgroundVocals ?? (mainLine.backgroundVocal ? [mainLine.backgroundVocal] : []);
      const backgroundVocals = [...existingVocals, ...inferredVocals];
      mainLine.backgroundVocals = backgroundVocals;
      mainLine.backgroundVocal = backgroundVocals[0];
    }
    return mainLines;
  };
  var convertAgents = (agents) => {
    const entries = Object.entries(agents ?? {});
    if (entries.length === 0) {
      return void 0;
    }
    return {
      agents: Object.fromEntries(entries.map(([id, agent]) => [
        id,
        {
          id: agent.id || id,
          ...agent.name ? { name: agent.name } : {},
          ...agent.type ? { type: agent.type } : {}
        }
      ]))
    };
  };
  var buildLyricDataFromTTMLResult = (result, buildTimedWords2) => {
    const convertedAgents = convertAgents(result.metadata.agents)?.agents;
    const lines = foldAgentOverlapHarmonyLines(
      result.lines.map((line) => convertLine(line, buildTimedWords2))
    );
    const ttml = {
      ...result.metadata.timingMode ? { timingMode: result.metadata.timingMode } : {},
      ...convertedAgents ? { agents: convertedAgents } : {}
    };
    return {
      lines,
      isWordByWord: result.metadata.timingMode === "Word",
      ...Object.keys(ttml).length > 0 ? { ttml } : {}
    };
  };

  // src/client/utils/lyrics/parserCore.ts
  var GLOBAL_LRC_TIME_REGEX = /\[(\d{2,3}):(\d{2})[.:](\d{2,3})\]/g;
  var GLOBAL_ANGLE_TIME_REGEX = /<(\d{2,3}):(\d{2})[.:](\d{2,3})>/g;
  var LRC_LINE_TIME_REGEX = /^\[(\d{2,3}):(\d{2})[.:](\d{2,3})\]/;
  var LEADING_LRC_TAGS_REGEX = /^((?:\[(?:\d{2,3}):(?:\d{2})[.:](?:\d{2,3})\])+)(.*)$/;
  var LRC_METADATA_REGEX = /^\[(ti|ar):([^\]]*)\]$/i;
  var AWLRC_LINE_REGEX = /^\[(\d{1,3}(?::\d{1,3}){0,2})\.(\d{1,3})\](.*)$/;
  var AWLRC_WORD_REGEX = /<(\d+),(\d+)(?:,\d+)?>([^<]*)/g;
  var INTERLUDE_FULL_TEXT = "......";
  var isInterludeLine = (line) => line.fullText === INTERLUDE_FULL_TEXT;
  var attachInterludes = (lines) => {
    const finalLines = [];
    const createInterlude = (start, end) => {
      const duration = end - start;
      const words = [];
      const wordDuration = duration / 6;
      for (let index = 0; index < 6; index += 1) {
        words.push({
          text: ".",
          startTime: start + index * wordDuration,
          endTime: start + (index + 1) * wordDuration
        });
      }
      return {
        startTime: start,
        endTime: end,
        fullText: INTERLUDE_FULL_TEXT,
        words
      };
    };
    if (lines.length > 0 && lines[0].startTime > 3) {
      finalLines.push(createInterlude(0.5, lines[0].startTime - 0.5));
    }
    for (let index = 0; index < lines.length; index += 1) {
      const current = lines[index];
      finalLines.push(current);
      const next = lines[index + 1];
      if (next) {
        const gap = next.startTime - current.endTime;
        if (gap > 3) {
          finalLines.push(createInterlude(current.endTime + 0.05, next.startTime - 0.05));
        }
      }
    }
    return finalLines;
  };
  var finalizeParsedLyricLines = (lines, options = {}) => {
    const withOptionalInterludes = options.includeInterludes === false ? lines : attachInterludes(lines);
    return annotateLyricLines(withOptionalInterludes);
  };
  var sortByStartTimeIfNeeded = (items, isSorted) => {
    if (isSorted) {
      return items;
    }
    return [...items].sort((left, right) => left.startTime - right.startTime);
  };
  var ALTERNATE_TRACK_MATCH_WINDOW = 1;
  var lowerBoundByStartTime = (entries, time) => {
    let low = 0;
    let high = entries.length;
    while (low < high) {
      const middle = low + high >> 1;
      if (entries[middle].startTime < time) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return low;
  };
  var findTranslationsForSortedStartTimes = (startTimes, entries) => {
    const translations = startTimes.map(() => void 0);
    if (startTimes.length === 0 || entries.length === 0) {
      return translations;
    }
    const candidates = [];
    startTimes.forEach((startTime, line) => {
      for (let entry = lowerBoundByStartTime(entries, startTime - ALTERNATE_TRACK_MATCH_WINDOW); entry < entries.length && entries[entry].startTime < startTime + ALTERNATE_TRACK_MATCH_WINDOW; entry += 1) {
        const diff = Math.abs(entries[entry].startTime - startTime);
        if (diff < ALTERNATE_TRACK_MATCH_WINDOW) {
          candidates.push({ line, entry, diff });
        }
      }
    });
    candidates.sort((left, right) => left.diff - right.diff || left.line - right.line || left.entry - right.entry);
    const lineTaken = new Array(startTimes.length).fill(false);
    const entryTaken = new Array(entries.length).fill(false);
    for (const candidate of candidates) {
      if (lineTaken[candidate.line] || entryTaken[candidate.entry]) continue;
      lineTaken[candidate.line] = true;
      entryTaken[candidate.entry] = true;
      translations[candidate.line] = entries[candidate.entry].text;
    }
    return translations;
  };
  var parseTimestamp = (minute, second, fraction) => {
    const min = parseInt(minute, 10);
    const sec = parseInt(second, 10);
    const ms = parseFloat(`0.${fraction}`);
    return min * 60 + sec + ms;
  };
  var collectTimestampMarkers = (content, pattern) => {
    const regex = new RegExp(pattern.source, "g");
    return Array.from(content.matchAll(regex)).map((match) => {
      const index = match.index ?? 0;
      return {
        time: parseTimestamp(match[1], match[2], match[3]),
        index,
        endIndex: index + match[0].length
      };
    });
  };
  var parseMetadataLine = (line, metadata) => {
    const match = line.match(LRC_METADATA_REGEX);
    if (!match) {
      return false;
    }
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "ti" && value) {
      metadata.title = value;
    } else if (key === "ar" && value) {
      metadata.artist = value;
    }
    return true;
  };
  var maybeBuildPreciseLineDraft = (content, pattern, enabled) => {
    if (!enabled) {
      return null;
    }
    const markers = collectTimestampMarkers(content, pattern);
    return buildPreciseLineDraft(content, markers);
  };
  var buildPreciseLineDraft = (content, markers) => {
    if (markers.length < 2) {
      return null;
    }
    const words = [];
    let fullText = "";
    for (let index = 0; index < markers.length - 1; index += 1) {
      const current = markers[index];
      const next = markers[index + 1];
      const segment = content.slice(current.endIndex, next.index).replace(/\r/g, "");
      fullText += segment;
      if (!segment.trim()) {
        continue;
      }
      words.push({
        text: segment,
        startTime: current.time,
        endTime: next.time
      });
    }
    const trailingText = content.slice(markers[markers.length - 1].endIndex).replace(/\r/g, "");
    fullText += trailingText;
    if (trailingText.trim()) {
      words.push({
        text: trailingText,
        startTime: markers[markers.length - 1].time
      });
    }
    if (!fullText.trim()) {
      return null;
    }
    return {
      words,
      startTime: words[0]?.startTime ?? markers[0].time,
      endTime: words[words.length - 1]?.endTime,
      fullText
    };
  };
  var parseSimpleTimedTextEntry = (line) => {
    const match = line.match(LEADING_LRC_TAGS_REGEX);
    if (!match) {
      return null;
    }
    const firstTag = match[1].match(LRC_LINE_TIME_REGEX);
    if (!firstTag) {
      return null;
    }
    const text = match[2].trim();
    if (!text) {
      return null;
    }
    return {
      startTime: parseTimestamp(firstTag[1], firstTag[2], firstTag[3]),
      text
    };
  };
  var parseTimedTextEntries = (content) => {
    const metadata = {};
    const entries = [];
    let isSorted = true;
    let lastStartTime = Number.NEGATIVE_INFINITY;
    const rawLines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      if (parseMetadataLine(line, metadata)) {
        continue;
      }
      const lineTagMatch = line.match(LRC_LINE_TIME_REGEX);
      const body = lineTagMatch ? line.slice(lineTagMatch[0].length) : line;
      const angleDraft = maybeBuildPreciseLineDraft(body, GLOBAL_ANGLE_TIME_REGEX, body.includes("<"));
      const bracketDraft = angleDraft ? null : maybeBuildPreciseLineDraft(
        line,
        GLOBAL_LRC_TIME_REGEX,
        line.indexOf("[", 1) !== -1
      );
      const entry = angleDraft ? {
        startTime: angleDraft.startTime,
        endTime: angleDraft.endTime,
        text: angleDraft.fullText
      } : bracketDraft ? {
        startTime: bracketDraft.startTime,
        endTime: bracketDraft.endTime,
        text: bracketDraft.fullText
      } : parseSimpleTimedTextEntry(line);
      if (!entry || entry.text.length === 0) {
        continue;
      }
      if (entry.startTime < lastStartTime) {
        isSorted = false;
      }
      lastStartTime = entry.startTime;
      entries.push(entry);
    }
    return {
      entries: sortByStartTimeIfNeeded(entries, isSorted),
      isSorted
    };
  };
  var parseLRC = (lrcString, translationString = "", options = {}, romanizationString = "") => {
    const lines = [];
    const rawEntries = [];
    let rawEntriesSorted = true;
    let lastStartTime = Number.NEGATIVE_INFINITY;
    for (const rawLine of lrcString.replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const entry = parseSimpleTimedTextEntry(rawLine);
      if (!entry || entry.text.length === 0) {
        continue;
      }
      if (entry.startTime < lastStartTime) {
        rawEntriesSorted = false;
      }
      lastStartTime = entry.startTime;
      rawEntries.push(entry);
    }
    const sortedRawEntries = sortByStartTimeIfNeeded(rawEntries, rawEntriesSorted);
    const transEntries = parseTimedTextEntries(translationString).entries;
    const romanizationEntries = parseTimedTextEntries(romanizationString).entries;
    const translations = findTranslationsForSortedStartTimes(
      sortedRawEntries.map((entry) => entry.startTime),
      transEntries
    );
    const romanizations = findTranslationsForSortedStartTimes(
      sortedRawEntries.map((entry) => entry.startTime),
      romanizationEntries
    );
    for (let index = 0; index < sortedRawEntries.length; index += 1) {
      const current = sortedRawEntries[index];
      const next = sortedRawEntries[index + 1];
      const translation = translations[index];
      const endTime = estimateLrcLineEndTime(current.text, current.startTime, next?.startTime);
      lines.push({
        words: buildTimedWords(current.text, current.startTime, endTime),
        startTime: current.startTime,
        endTime,
        fullText: current.text,
        translation,
        romanization: romanizations[index]
      });
    }
    return { lines: finalizeParsedLyricLines(lines, options), isWordByWord: false };
  };
  var parseYRC = (yrcString, translationString = "", options = {}, romanizationString = "") => {
    const rawLinesData = [];
    const translationEntries = parseTimedTextEntries(translationString).entries;
    const romanizationEntries = parseTimedTextEntries(romanizationString).entries;
    const rawLines = yrcString.replace(/^\uFEFF/, "").split(/\r?\n/);
    let isSorted = true;
    let lastStartTime = Number.NEGATIVE_INFINITY;
    for (const rawLine of rawLines) {
      const lineMatch = rawLine.match(/^\[(\d+),(\d+)\](.*)/);
      if (!lineMatch) {
        continue;
      }
      const lineStartTimeMs = parseInt(lineMatch[1], 10);
      const lineDurationMs = parseInt(lineMatch[2], 10);
      const rest = lineMatch[3];
      const lineStartTime = lineStartTimeMs / 1e3;
      const lineEndTime = (lineStartTimeMs + lineDurationMs) / 1e3;
      const words = [];
      let fullText = "";
      const wordRegex = /\((\d+),(\d+),(\d+)\)([^\(]*)/g;
      let wordMatch;
      while ((wordMatch = wordRegex.exec(rest)) !== null) {
        const wordStartMs = parseInt(wordMatch[1], 10);
        const wordDurationMs = parseInt(wordMatch[2], 10);
        const text = wordMatch[4];
        words.push({
          text,
          startTime: wordStartMs / 1e3,
          endTime: (wordStartMs + wordDurationMs) / 1e3
        });
        fullText += text;
      }
      if (words.length > 0) {
        if (lineStartTime < lastStartTime) {
          isSorted = false;
        }
        lastStartTime = lineStartTime;
        rawLinesData.push({
          words,
          startTime: lineStartTime,
          endTime: lineEndTime,
          fullText
        });
      }
    }
    const sortedRawLines = sortByStartTimeIfNeeded(rawLinesData, isSorted);
    const translations = findTranslationsForSortedStartTimes(
      sortedRawLines.map((line) => line.startTime),
      translationEntries
    );
    const romanizations = findTranslationsForSortedStartTimes(
      sortedRawLines.map((line) => line.startTime),
      romanizationEntries
    );
    const lines = sortedRawLines.map((line, index) => ({
      ...line,
      translation: translations[index],
      romanization: romanizations[index]
    }));
    return { lines: finalizeParsedLyricLines(lines, options), isWordByWord: true };
  };
  var parseQRC = (qrcString, translationString = "", options = {}, romanizationString = "") => {
    const rawLinesData = [];
    const parseQrcTrackEntries = (track) => {
      if (!track.trim()) return [];
      const qrcLines = parseQRC(track).lines;
      if (qrcLines.length > 0) {
        return qrcLines.map((line) => ({ startTime: line.startTime, text: line.fullText }));
      }
      return parseTimedTextEntries(track).entries;
    };
    const translationEntries = parseQrcTrackEntries(translationString);
    const romanizationEntries = parseQrcTrackEntries(romanizationString);
    const rawLines = qrcString.replace(/^\uFEFF/, "").split(/\r?\n/);
    let isSorted = true;
    let lastStartTime = Number.NEGATIVE_INFINITY;
    for (const rawLine of rawLines) {
      const lineMatch = rawLine.match(/^\[(\d+),(\d+)\](.*)/);
      if (!lineMatch) {
        continue;
      }
      const lineStartTimeMs = parseInt(lineMatch[1], 10);
      const lineDurationMs = parseInt(lineMatch[2], 10);
      const rest = lineMatch[3];
      const lineStartTime = lineStartTimeMs / 1e3;
      const lineEndTime = (lineStartTimeMs + lineDurationMs) / 1e3;
      const words = [];
      let fullText = "";
      const tagRegex = /\((\d+),(\d+)(?:,\d+)?\)/g;
      const tags = [];
      let tagMatch;
      while ((tagMatch = tagRegex.exec(rest)) !== null) {
        tags.push({
          startMs: parseInt(tagMatch[1], 10),
          durationMs: parseInt(tagMatch[2], 10),
          tagStart: tagMatch.index,
          tagEnd: tagMatch.index + tagMatch[0].length
        });
      }
      if (tags.length === 0) {
        continue;
      }
      const textChunks = [];
      let cursor = 0;
      for (const tag of tags) {
        textChunks.push(rest.slice(cursor, tag.tagStart));
        cursor = tag.tagEnd;
      }
      textChunks.push(rest.slice(cursor));
      const prefersLeadingText = textChunks[0].trim().length > 0 && textChunks[textChunks.length - 1].trim().length === 0;
      const prefersTrailingText = textChunks[0].trim().length === 0 && textChunks[textChunks.length - 1].trim().length > 0;
      for (let index = 0; index < tags.length; index += 1) {
        const tag = tags[index];
        const leadingText = textChunks[index] ?? "";
        const trailingText = textChunks[index + 1] ?? "";
        let text = "";
        if (prefersLeadingText) {
          text = leadingText;
        } else if (prefersTrailingText) {
          text = trailingText;
        } else if (trailingText.trim().length > 0 && leadingText.trim().length === 0) {
          text = trailingText;
        } else if (leadingText.trim().length > 0 && trailingText.trim().length === 0) {
          text = leadingText;
        } else {
          text = trailingText.length >= leadingText.length ? trailingText : leadingText;
        }
        if (!text) {
          continue;
        }
        words.push({
          text,
          startTime: tag.startMs / 1e3,
          endTime: (tag.startMs + tag.durationMs) / 1e3
        });
        fullText += text;
      }
      if (words.length > 0) {
        if (lineStartTime < lastStartTime) {
          isSorted = false;
        }
        lastStartTime = lineStartTime;
        rawLinesData.push({
          words,
          startTime: lineStartTime,
          endTime: lineEndTime,
          fullText
        });
      }
    }
    const sortedRawLines = sortByStartTimeIfNeeded(rawLinesData, isSorted);
    const translations = findTranslationsForSortedStartTimes(
      sortedRawLines.map((line) => line.startTime),
      translationEntries
    );
    const romanizations = findTranslationsForSortedStartTimes(
      sortedRawLines.map((line) => line.startTime),
      romanizationEntries
    );
    const lines = sortedRawLines.map((line, index) => ({
      ...line,
      translation: translations[index],
      romanization: romanizations[index]
    }));
    return { lines: finalizeParsedLyricLines(lines, options), isWordByWord: true };
  };
  var parseVttTimestamp = (value) => {
    const normalized = value.trim();
    const parts = normalized.split(":");
    let hours = 0;
    let minutes = 0;
    let seconds2 = 0;
    if (parts.length === 3) {
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
      seconds2 = parseFloat(parts[2]);
    } else if (parts.length === 2) {
      minutes = parseInt(parts[0], 10);
      seconds2 = parseFloat(parts[1]);
    } else {
      seconds2 = parseFloat(parts[0]);
    }
    return hours * 3600 + minutes * 60 + seconds2;
  };
  var stripVttCueText = (text) => {
    return text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
  };
  var parseVTTEntries = (vttString) => {
    const normalized = vttString.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      return [];
    }
    const blocks = normalized.split(/\n{2,}/);
    const entries = [];
    const timingLineRegex = /^((?:\d{2}:)?\d{2}:\d{2}\.\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}\.\d{3})(?:\s+.*)?$/;
    for (const block of blocks) {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0 || lines[0] === "WEBVTT" || lines[0].startsWith("NOTE") || lines[0] === "STYLE" || lines[0] === "REGION") {
        continue;
      }
      const timingLineIndex = lines.findIndex((line) => timingLineRegex.test(line));
      if (timingLineIndex === -1) {
        continue;
      }
      const timingMatch = lines[timingLineIndex].match(timingLineRegex);
      if (!timingMatch) {
        continue;
      }
      const text = stripVttCueText(lines.slice(timingLineIndex + 1).join(" "));
      if (!text) {
        continue;
      }
      entries.push({
        startTime: parseVttTimestamp(timingMatch[1]),
        endTime: parseVttTimestamp(timingMatch[2]),
        text
      });
    }
    return entries.sort((left, right) => left.startTime - right.startTime);
  };
  var parseVTT = (vttString, translationString = "", options = {}, romanizationString = "") => {
    const entries = parseVTTEntries(vttString);
    const translationEntries = parseVTTEntries(translationString);
    const romanizationEntries = parseVTTEntries(romanizationString);
    const translations = findTranslationsForSortedStartTimes(
      entries.map((entry) => entry.startTime),
      translationEntries
    );
    const romanizations = findTranslationsForSortedStartTimes(
      entries.map((entry) => entry.startTime),
      romanizationEntries
    );
    const lines = [];
    for (let index = 0; index < entries.length; index += 1) {
      const current = entries[index];
      const next = entries[index + 1];
      const fallbackEndTime = next ? next.startTime : current.startTime + 5;
      const endTime = Math.max(current.endTime || fallbackEndTime, current.startTime + 0.1);
      lines.push({
        words: buildTimedWords(current.text, current.startTime, endTime),
        startTime: current.startTime,
        endTime,
        fullText: current.text,
        translation: translations[index],
        romanization: romanizations[index]
      });
    }
    return { lines: finalizeParsedLyricLines(lines, options), isWordByWord: false };
  };
  var ITUNES_TTML_NAMESPACE = "http://music.apple.com/lyric-ttml-internal";
  var getLocalName = (node) => node.localName || node.nodeName.split(":").pop() || "";
  var ensureTtmlLineKeys = (documentElement) => {
    if (!documentElement) return;
    const lines = Array.from(documentElement.getElementsByTagName("*")).filter((element) => getLocalName(element) === "p");
    const readKey = (element) => Array.from(element.attributes).find((attribute) => getLocalName(attribute) === "key")?.value;
    const usedKeys = new Set(lines.map(readKey).filter((key) => Boolean(key)));
    let nextIndex = 1;
    lines.forEach((line) => {
      if (readKey(line)) return;
      while (usedKeys.has(`L${nextIndex}`)) nextIndex += 1;
      const key = `L${nextIndex}`;
      usedKeys.add(key);
      line.setAttributeNS(ITUNES_TTML_NAMESPACE, "itunes:key", key);
    });
  };
  var ttmlDomParser = {
    parseFromString: (source, mimeType) => {
      const document2 = new import_xmldom.DOMParser().parseFromString(source, mimeType);
      ensureTtmlLineKeys(document2.documentElement);
      return document2;
    }
  };
  var parseTTML = (ttmlString, _translationString = "", options = {}, _romanizationString = "") => {
    const ttmlResult = TTMLParser.parse(ttmlString.replace(/^\uFEFF/, ""), {
      domParser: ttmlDomParser
    });
    const parsed = buildLyricDataFromTTMLResult(ttmlResult, buildTimedWords);
    const adapted = {
      ...parsed,
      lines: finalizeParsedLyricLines(parsed.lines, options)
    };
    console.log("[TTML] Adapted lyric data for visualizers:", { lineCount: adapted.lines.length });
    return adapted;
  };
  var parseEnhancedLRC = (lrcString, translationString = "", options = {}, romanizationString = "") => {
    const metadata = {};
    const drafts = [];
    const translationEntries = parseTimedTextEntries(translationString).entries;
    const romanizationEntries = parseTimedTextEntries(romanizationString).entries;
    const rawLines = lrcString.replace(/^\uFEFF/, "").split(/\r?\n/);
    let isSorted = true;
    let lastStartTime = Number.NEGATIVE_INFINITY;
    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      if (parseMetadataLine(line, metadata)) {
        continue;
      }
      const lineTagMatch = line.match(LRC_LINE_TIME_REGEX);
      const body = lineTagMatch ? line.slice(lineTagMatch[0].length) : line;
      const angleDraft = maybeBuildPreciseLineDraft(body, GLOBAL_ANGLE_TIME_REGEX, body.includes("<"));
      if (angleDraft) {
        if (angleDraft.startTime < lastStartTime) {
          isSorted = false;
        }
        lastStartTime = angleDraft.startTime;
        drafts.push(angleDraft);
        continue;
      }
      const bracketDraft = maybeBuildPreciseLineDraft(line, GLOBAL_LRC_TIME_REGEX, line.indexOf("[", 1) !== -1);
      if (bracketDraft) {
        if (bracketDraft.startTime < lastStartTime) {
          isSorted = false;
        }
        lastStartTime = bracketDraft.startTime;
        drafts.push(bracketDraft);
        continue;
      }
      const simpleEntry = parseSimpleTimedTextEntry(line);
      if (simpleEntry) {
        if (simpleEntry.startTime < lastStartTime) {
          isSorted = false;
        }
        lastStartTime = simpleEntry.startTime;
        drafts.push({
          words: [],
          startTime: simpleEntry.startTime,
          fullText: simpleEntry.text
        });
      }
    }
    const sortedDrafts = sortByStartTimeIfNeeded(drafts, isSorted);
    const translations = findTranslationsForSortedStartTimes(
      sortedDrafts.map((draft) => draft.startTime),
      translationEntries
    );
    const romanizations = findTranslationsForSortedStartTimes(
      sortedDrafts.map((draft) => draft.startTime),
      romanizationEntries
    );
    const lines = sortedDrafts.map((draft, index) => {
      let lineEndTime = Math.max(draft.endTime ?? sortedDrafts[index + 1]?.startTime ?? draft.startTime + 5, draft.startTime + 1e-3);
      const words = draft.words.length > 0 ? draft.words.map((word, wordIndex) => {
        const nextWordStart = draft.words[wordIndex + 1]?.startTime;
        const fallbackEnd = nextWordStart ?? lineEndTime;
        const endTime = Math.max(word.endTime ?? fallbackEnd, word.startTime + 1e-3);
        return {
          text: word.text,
          startTime: word.startTime,
          endTime
        };
      }) : buildTimedWords(draft.fullText, draft.startTime, lineEndTime);
      if (words.length > 0) {
        lineEndTime = Math.max(lineEndTime, words[words.length - 1].endTime);
      }
      return {
        words,
        startTime: draft.startTime,
        endTime: lineEndTime,
        fullText: draft.fullText,
        translation: translations[index],
        romanization: romanizations[index]
      };
    });
    return {
      lines: finalizeParsedLyricLines(lines, options),
      title: metadata.title,
      artist: metadata.artist,
      // Enhanced LRC may mix timed and plain lines; any line that carried its own word
      // timestamps makes the file word-timed. Plain lines got evenly spread placeholder words.
      isWordByWord: sortedDrafts.some((draft) => draft.words.length > 0)
    };
  };
  var parseKRC = (krcString, translationString = "", options = {}, romanizationString = "") => {
    const rawLinesData = [];
    let embeddedTranslations = [];
    let embeddedRomanizations = [];
    const langMatch = krcString.match(/\[language:([^\]]*)\]/);
    if (langMatch) {
      try {
        let cleanB64 = langMatch[1].trim();
        while (cleanB64.length % 4 !== 0) {
          cleanB64 += "=";
        }
        const decoded = typeof Buffer !== "undefined" ? Buffer.from(cleanB64, "base64").toString("utf8") : new TextDecoder("utf-8").decode(Uint8Array.from(atob(cleanB64), (c) => c.charCodeAt(0)));
        const obj = JSON.parse(decoded);
        const readEmbeddedTrack = (type) => {
          const track = obj.content?.find((item) => item.type === type);
          if (!track || !Array.isArray(track.lyricContent)) return [];
          return track.lyricContent.map((lines2) => {
            if (Array.isArray(lines2)) {
              return lines2.join("").trim();
            }
            return String(lines2).trim();
          });
        };
        embeddedRomanizations = readEmbeddedTrack(0);
        embeddedTranslations = readEmbeddedTrack(1);
      } catch (err) {
        console.error("[Kugou KRC] Failed to decode/parse language tag:", err);
      }
    }
    const translationEntries = parseTimedTextEntries(translationString).entries;
    const romanizationEntries = parseTimedTextEntries(romanizationString).entries;
    const rawLines = krcString.replace(/^\uFEFF/, "").split(/\r?\n/);
    let isSorted = true;
    let lastStartTime = Number.NEGATIVE_INFINITY;
    for (const rawLine of rawLines) {
      const lineMatch = rawLine.match(/^\[(\d+),(\d+)\](.*)/);
      if (!lineMatch) {
        continue;
      }
      const lineStartTimeMs = parseInt(lineMatch[1], 10);
      const lineDurationMs = parseInt(lineMatch[2], 10);
      const rest = lineMatch[3];
      const lineStartTime = lineStartTimeMs / 1e3;
      const lineEndTime = (lineStartTimeMs + lineDurationMs) / 1e3;
      const words = [];
      let fullText = "";
      const wordRegex = /\<(\d+),(\d+)(?:,\d+)?\>([^\<]*)/g;
      let wordMatch;
      while ((wordMatch = wordRegex.exec(rest)) !== null) {
        const wordStartOffsetMs = parseInt(wordMatch[1], 10);
        const wordDurationMs = parseInt(wordMatch[2], 10);
        const text = wordMatch[3];
        const wordStartMs = lineStartTimeMs + wordStartOffsetMs;
        words.push({
          text,
          startTime: wordStartMs / 1e3,
          endTime: (wordStartMs + wordDurationMs) / 1e3
        });
        fullText += text;
      }
      const trimmedRest = rest.trim();
      if (words.length === 0 && trimmedRest.length > 0 && !trimmedRest.startsWith("[") && !trimmedRest.startsWith("<")) {
        words.push(...buildTimedWords(trimmedRest, lineStartTime, lineEndTime));
        fullText = trimmedRest;
      }
      if (words.length > 0) {
        if (lineStartTime < lastStartTime) {
          isSorted = false;
        }
        lastStartTime = lineStartTime;
        rawLinesData.push({
          words,
          startTime: lineStartTime,
          endTime: lineEndTime,
          fullText
        });
      }
    }
    const sortedRawLines = sortByStartTimeIfNeeded(rawLinesData, isSorted);
    const lines = sortedRawLines.map((line, index) => {
      let translation = embeddedTranslations[index] || void 0;
      let romanization = embeddedRomanizations[index] || void 0;
      if (!translation && translationEntries.length > 0) {
        const externalTrans = findTranslationsForSortedStartTimes([line.startTime], translationEntries);
        translation = externalTrans[0] || void 0;
      }
      if (!romanization && romanizationEntries.length > 0) {
        const externalRomanization = findTranslationsForSortedStartTimes([line.startTime], romanizationEntries);
        romanization = externalRomanization[0] || void 0;
      }
      return {
        ...line,
        translation,
        romanization
      };
    });
    return { lines: finalizeParsedLyricLines(lines, options), isWordByWord: true };
  };
  var parseAwlrcTimestamp = (fields, fraction) => {
    const parts = fields.split(":").map((part) => parseInt(part, 10));
    while (parts.length < 3) {
      parts.unshift(0);
    }
    const [hours, minutes, seconds2] = parts;
    return hours * 3600 + minutes * 60 + seconds2 + parseInt(fraction, 10) / 1e3;
  };
  var parseAwlrcAlternateTrack = (content) => {
    const entries = [];
    for (const rawLine of content.replace(/^﻿/, "").split(/\r?\n/)) {
      const match = rawLine.trim().match(AWLRC_LINE_REGEX);
      const text = match?.[3]?.trim();
      if (!match || !text) {
        continue;
      }
      entries.push({ startTime: parseAwlrcTimestamp(match[1], match[2]), text });
    }
    return entries;
  };
  var resolveAlternateTracks = (startTimes, entries) => {
    if (entries.length === 0) {
      return startTimes.map(() => void 0);
    }
    const exactByMs = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const key = Math.round(entry.startTime * 1e3);
      if (!exactByMs.has(key)) {
        exactByMs.set(key, entry.text);
      }
    }
    const exact = startTimes.map((startTime) => exactByMs.get(Math.round(startTime * 1e3)));
    if (exact.some((text) => text !== void 0)) {
      return exact;
    }
    return findTranslationsForSortedStartTimes(startTimes, entries);
  };
  var parseAwlrc = (awlrcString, translationString = "", options = {}, romanizationString = "") => {
    const metadata = {};
    const drafts = [];
    for (const rawLine of awlrcString.replace(/^﻿/, "").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || parseMetadataLine(line, metadata)) {
        continue;
      }
      const lineMatch = line.match(AWLRC_LINE_REGEX);
      if (!lineMatch) {
        continue;
      }
      const startTime = parseAwlrcTimestamp(lineMatch[1], lineMatch[2]);
      const words = [];
      let fullText = "";
      let cursorMs = 0;
      AWLRC_WORD_REGEX.lastIndex = 0;
      let wordMatch;
      while ((wordMatch = AWLRC_WORD_REGEX.exec(lineMatch[3])) !== null) {
        const offsetMs = Math.max(parseInt(wordMatch[1], 10), cursorMs);
        const durationMs = Math.max(parseInt(wordMatch[2], 10), 1);
        words.push({
          text: wordMatch[3],
          startTime: startTime + offsetMs / 1e3,
          endTime: startTime + (offsetMs + durationMs) / 1e3
        });
        cursorMs = offsetMs + durationMs;
        fullText += wordMatch[3];
      }
      if (words.length === 0 || !fullText.trim()) {
        continue;
      }
      drafts.push({ words, startTime, endTime: startTime + cursorMs / 1e3, fullText });
    }
    drafts.sort((left, right) => left.startTime - right.startTime);
    const startTimes = drafts.map((draft) => draft.startTime);
    const translations = resolveAlternateTracks(startTimes, parseAwlrcAlternateTrack(translationString));
    const romanizations = resolveAlternateTracks(startTimes, parseAwlrcAlternateTrack(romanizationString));
    const lines = drafts.map((draft, index) => {
      const next = drafts[index + 1];
      const endTime = next ? Math.min(draft.endTime, next.startTime) : draft.endTime;
      return {
        words: draft.words,
        startTime: draft.startTime,
        endTime: Math.max(endTime, draft.startTime),
        fullText: draft.fullText,
        translation: translations[index],
        romanization: romanizations[index]
      };
    });
    return {
      lines: finalizeParsedLyricLines(lines, options),
      title: metadata.title,
      artist: metadata.artist,
      isWordByWord: true
    };
  };
  var parseLyricsByFormat = (format, content, translation = "", options = {}, romanization = "") => {
    switch (format) {
      case "yrc":
        return parseYRC(content, translation, options, romanization);
      case "qrc":
        return parseQRC(content, translation, options, romanization);
      case "krc":
        return parseKRC(content, translation, options, romanization);
      case "awlrc":
        return parseAwlrc(content, translation, options, romanization);
      case "enhanced-lrc":
        return parseEnhancedLRC(content, translation, options, romanization);
      case "vtt":
        return parseVTT(content, translation, options, romanization);
      case "ttml":
        return parseTTML(content, translation, options, romanization);
      case "lrc":
      default:
        return parseLRC(content, translation, options, romanization);
    }
  };

  // src/client/utils/lyrics/filtering.ts
  var normalizeFilterPattern = (pattern) => pattern?.trim() || "";
  var compileLyricFilterPattern = (pattern) => {
    const normalized = normalizeFilterPattern(pattern);
    if (!normalized) {
      return null;
    }
    try {
      return new RegExp(normalized);
    } catch {
      return null;
    }
  };
  var resolveLyricProcessingOptions = (options = {}) => ({
    ...options,
    includeInterludes: options.includeInterludes ?? true
  });

  // src/client/render/lyrics/worker-inline.ts
  var normalizeWorkerFormat = (format) => {
    if (format === "yrc" || format === "qrc" || format === "krc" || format === "awlrc" || format === "enhanced-lrc" || format === "vtt" || format === "ttml") {
      return format;
    }
    return "lrc";
  };
  var parseLyricsAsync = (format, content, translation, options, romanization) => Promise.resolve().then(() => parseLyricsByFormat(normalizeWorkerFormat(format), content, translation || "", options, romanization || ""));

  // src/client/utils/lyrics/formatDetection.ts
  var VTT_TIMING_LINE_REGEX = /(?:^|\n)\s*(?:\d{2}:)?\d{2}:\d{2}\.\d{3}\s*-->\s*(?:\d{2}:)?\d{2}:\d{2}\.\d{3}/m;
  var ENHANCED_LRC_ANGLE_REGEX = /<\d{2}:\d{2}[.:]\d{2,3}>/;
  var ENHANCED_LRC_INLINE_BRACKET_REGEX = /(?:^|\n)\s*\[\d{2}:\d{2}[.:]\d{2,3}\][^\[\]\n]+(?:\[\d{2}:\d{2}[.:]\d{2,3}\][^\[\]\n]*)+/m;
  var TTML_ROOT_REGEX = /<tt(?:\s|>)/i;
  function detectTimedLyricFormat(content) {
    const normalized = content?.replace(/^\uFEFF/, "").trim() || "";
    if (TTML_ROOT_REGEX.test(normalized) && (normalized.includes("http://www.w3.org/ns/ttml") || normalized.includes("itunes:timing=") || normalized.includes("ttm:agent=") || normalized.includes("ttm:role="))) {
      return "ttml";
    }
    if (normalized.startsWith("WEBVTT") || VTT_TIMING_LINE_REGEX.test(normalized)) {
      return "vtt";
    }
    if (ENHANCED_LRC_ANGLE_REGEX.test(normalized) || ENHANCED_LRC_INLINE_BRACKET_REGEX.test(normalized)) {
      return "enhanced-lrc";
    }
    return "lrc";
  }
  function detectNonTtmlTimedLyricFormat(content) {
    const format = detectTimedLyricFormat(content);
    return format === "ttml" ? "lrc" : format;
  }

  // src/client/utils/lyrics/timelineSplitter.ts
  var hasCjkScript = (text) => /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u.test(text);
  var isRomanizationCandidate = (text) => {
    const lyricText = text.replace(/\[[^\]]*\]|<[^>]*>/gu, "");
    const letters = lyricText.match(/[A-Za-z\u00c0-\u024f]/gu) || [];
    const nonWhitespace = lyricText.match(/\S/gu) || [];
    return letters.length >= 2 && letters.length / Math.max(nonWhitespace.length, 1) >= 0.45 && !hasCjkScript(text);
  };
  function splitCombinedTimeline(rawText) {
    if (!rawText) return { main: "", trans: "", romanization: "" };
    const timeRegex = /\[(\d{2,3}):(\d{2})[.:](\d{2,3})\]/g;
    const enhancedAngleRegex = /<\d{2,3}:\d{2}[.:]\d{2,3}>/;
    const enhancedAngleTimestampRegex = /<\d{2,3}:\d{2}[.:]\d{2,3}>/g;
    const enhancedBracketRegex = /^\s*\[\d{2,3}:\d{2}[.:]\d{2,3}\][^\[\]\n]+(?:\[\d{2,3}:\d{2}[.:]\d{2,3}\][^\[\]\n]*)+$/;
    const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
    const extracted = [];
    for (const line of lines) {
      timeRegex.lastIndex = 0;
      let match;
      let timestampSignature = "";
      let startTimestamp = "";
      while ((match = timeRegex.exec(line)) !== null) {
        if (!startTimestamp) {
          startTimestamp = match[0];
        }
        timestampSignature += match[0];
      }
      if (!timestampSignature) {
        enhancedAngleTimestampRegex.lastIndex = 0;
        while ((match = enhancedAngleTimestampRegex.exec(line)) !== null) {
          if (!startTimestamp) {
            startTimestamp = match[0];
          }
          timestampSignature += match[0];
        }
      }
      if (timestampSignature) {
        const hasMultipleBracketTimestamps = line.indexOf("[", 1) !== -1;
        extracted.push({
          raw: line,
          timestampSignature,
          startTimestamp,
          isEnhancedLike: enhancedAngleRegex.test(line) || hasMultipleBracketTimestamps && enhancedBracketRegex.test(line),
          isBlank: !line.replace(/\[[^\]]*\]|<[^>]*>/gu, "").trim()
        });
      } else {
        extracted.push({
          raw: line,
          timestampSignature: "",
          startTimestamp: "",
          isEnhancedLike: false,
          isBlank: false
        });
      }
    }
    const mainLines = [];
    const transLines = [];
    const romanizationLines = [];
    let isCombined = false;
    const sharesTimeline = (left, right) => left.timestampSignature !== "" && left.timestampSignature === right.timestampSignature || left.startTimestamp !== "" && left.startTimestamp === right.startTimestamp && (left.isEnhancedLike || right.isEnhancedLike);
    for (let i = 0; i < extracted.length; i++) {
      const current = extracted[i];
      const group = [current];
      while (i + 1 < extracted.length && sharesTimeline(current, extracted[i + 1])) {
        group.push(extracted[i + 1]);
        i++;
      }
      const members = group.length > 1 ? group.filter((line) => !line.isBlank) : group;
      if (members.length > 1) {
        const [main, ...alternates] = members;
        const romanizationCandidates = hasCjkScript(main.raw) ? alternates.filter((candidate) => isRomanizationCandidate(candidate.raw)) : [];
        const romanization = romanizationCandidates.length === 1 ? romanizationCandidates[0] : void 0;
        const translation = alternates.find((candidate) => candidate !== romanization);
        mainLines.push(main.raw);
        if (translation) transLines.push(translation.raw);
        if (romanization) romanizationLines.push(romanization.raw);
        isCombined = true;
      } else {
        mainLines.push((members[0] ?? current).raw);
      }
    }
    if (isCombined) {
      return {
        main: mainLines.join("\n"),
        trans: transLines.join("\n"),
        romanization: romanizationLines.join("\n")
      };
    } else {
      return { main: rawText, trans: "", romanization: "" };
    }
  }

  // src/client/utils/lyrics/lrcTimestamp.ts
  var formatLrcTimestamp = (timestampMs) => {
    const totalMs = Math.max(0, Math.floor(timestampMs));
    const minutes = Math.floor(totalMs / 6e4);
    const seconds2 = Math.floor(totalMs % 6e4 / 1e3);
    const centiseconds = Math.floor(totalMs % 1e3 / 10);
    return `[${String(minutes).padStart(2, "0")}:${String(seconds2).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}]`;
  };

  // src/client/utils/lyrics/embeddedLrcNormalization.ts
  function isTranslationUsltTag(tag) {
    const language = tag.language?.toLowerCase();
    const descriptor = tag.descriptor?.toLowerCase() || "";
    return language === "chi" || language === "zho" || descriptor.includes("translation") || descriptor.includes("trans");
  }
  function normalizeEmbeddedLrcText(textContent, translationContent) {
    if (!textContent) {
      return { mainText: "", translationText: "" };
    }
    const { main, trans, romanization } = splitCombinedTimeline(textContent);
    const hasTranslationTimestamp = /(?:\[\d+(?::\d+){0,2}[.:]\d+\]|<\d{2}:\d{2}[.:]\d{2,3}>)/.test(translationContent || "");
    return {
      mainText: main,
      translationText: hasTranslationTimestamp ? translationContent : trans || translationContent || "",
      romanizationText: romanization
    };
  }
  function normalizeEmbeddedUsltTags(usltTags) {
    if (!usltTags?.length) {
      return { mainText: "", translationText: "" };
    }
    if (usltTags.length === 1) {
      return normalizeEmbeddedLrcText(usltTags[0].text);
    }
    const translationTag = usltTags.find((tag) => isTranslationUsltTag(tag));
    if (translationTag) {
      return normalizeEmbeddedLrcText(
        usltTags.find((tag) => tag !== translationTag)?.text,
        translationTag.text
      );
    }
    return normalizeEmbeddedLrcText(usltTags[0].text, usltTags[1].text);
  }
  function normalizeEmbeddedStructuredLyrics(structuredLyrics) {
    if (!structuredLyrics?.length) {
      return { mainText: "", translationText: "" };
    }
    const groups = /* @__PURE__ */ new Map();
    structuredLyrics.forEach((line) => {
      const value = (line.value || "").trim();
      if (!value) {
        return;
      }
      const start = line.start || 0;
      const current = groups.get(start) || [];
      current.push(value);
      groups.set(start, current);
    });
    const mainLines = [];
    const translationLines = [];
    [...groups.entries()].sort((a, b) => a[0] - b[0]).forEach(([start, values]) => {
      const prefix = formatLrcTimestamp(start);
      if (values[0]) {
        mainLines.push(`${prefix}${values[0]}`);
      }
      if (values[1]) {
        translationLines.push(`${prefix}${values[1]}`);
      }
    });
    return {
      mainText: mainLines.join("\n"),
      translationText: translationLines.join("\n")
    };
  }

  // src/client/utils/lyrics/awlrcContainer.ts
  var AWLRC_CONTAINER_REGEX = /\[awlrc:(.+)\]/;
  var CJK_SCRIPT_REGEX = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/gu;
  var LATIN_LETTER_REGEX = /[A-Za-z]/g;
  var decodeBase64Utf8 = (value) => {
    let padded = value.trim();
    while (padded.length % 4 !== 0) {
      padded += "=";
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(padded, "base64").toString("utf8");
    }
    return new TextDecoder("utf-8").decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
  };
  var isHanTransliteration = (track) => {
    const cjkCount = (track.match(CJK_SCRIPT_REGEX) || []).length;
    const latinCount = (track.match(LATIN_LETTER_REGEX) || []).length;
    return cjkCount > latinCount;
  };
  var extractAwlrcContainer = (content) => {
    const containerMatch = content?.match(AWLRC_CONTAINER_REGEX);
    if (!containerMatch) {
      return null;
    }
    const tracks = {};
    let decodedAny = false;
    for (const segment of containerMatch[1].split(",")) {
      const separatorIndex = segment.indexOf(":");
      if (separatorIndex <= 0) {
        continue;
      }
      const key = segment.slice(0, separatorIndex);
      if (key !== "lrc" && key !== "tlrc" && key !== "rlrc" && key !== "awlrc") {
        continue;
      }
      try {
        const decoded = decodeBase64Utf8(segment.slice(separatorIndex + 1));
        if (decoded.trim()) {
          tracks[key] = decoded;
          decodedAny = true;
        }
      } catch (error) {
        console.warn(`[awlrcContainer] Failed to decode "${key}" track:`, error);
      }
    }
    if (tracks.rlrc && isHanTransliteration(tracks.rlrc)) {
      delete tracks.rlrc;
    }
    return decodedAny ? tracks : null;
  };

  // src/client/utils/lyrics/adapters/EmbeddedLyricAdapter.ts
  var EmbeddedLyricAdapter = class {
    async parse(source, options = {}) {
      let mainLrc = "";
      let transLrc = "";
      let romanizationLrc = "";
      if (source.usltTags && source.usltTags.length > 0) {
        const normalized = normalizeEmbeddedUsltTags(source.usltTags);
        mainLrc = normalized.mainText;
        transLrc = normalized.translationText;
        romanizationLrc = normalized.romanizationText || "";
      } else if (source.textContent) {
        const normalized = normalizeEmbeddedLrcText(source.textContent, source.translationContent);
        mainLrc = normalized.mainText;
        transLrc = normalized.translationText;
        romanizationLrc = normalized.romanizationText || "";
      }
      if (!mainLrc) return null;
      const container = extractAwlrcContainer(mainLrc);
      if (container?.awlrc || container?.lrc) {
        const translation = transLrc || container.tlrc || "";
        const romanization = container.rlrc || romanizationLrc;
        return container.awlrc ? await parseLyricsAsync("awlrc", container.awlrc, translation, options, romanization) : await parseLyricsAsync("lrc", container.lrc, translation, options, romanization);
      }
      return await parseLyricsAsync(detectTimedLyricFormat(mainLrc), mainLrc, transLrc, options, romanizationLrc);
    }
  };

  // src/client/utils/lyrics/staffCredits.ts
  var STAFF_ROLE_KEYWORDS = [
    "\u4F5C\u8BCD",
    "\u4F5C\u66F2",
    "\u8BCD",
    "\u66F2",
    "\u7F16\u66F2",
    "\u5236\u4F5C\u4EBA",
    "\u6F14\u5531",
    "\u5409\u4ED6",
    "\u8D1D\u65AF",
    "\u6DF7\u97F3",
    "\u6BCD\u5E26",
    "\u5F55\u97F3",
    "\u76D1\u5236",
    "\u51FA\u54C1",
    "\u7B56\u5212",
    "\u7EDF\u7B79",
    "\u8BBE\u8BA1",
    "\u5BA3\u4F20",
    "\u8FD0\u8425",
    "\u603B\u76D1",
    "\u9E23\u8C22",
    "\u5DE5\u4F5C\u5BA4",
    "\u7248\u6743",
    "\u53D1\u884C",
    "\u827A\u4EBA\u7EDF\u7B79",
    "\u5236\u4F5C\u603B\u76D1",
    "\u603B\u987E\u95EE",
    "\u51FA\u54C1\u4EBA",
    "\u603B\u76D1\u5236",
    "\u6218\u7565",
    "\u89C6\u89C9",
    "\u8D44\u4EA7\u7BA1\u7406",
    "\u603B\u7B56\u5212",
    "\u97F3\u4E50\u603B\u76D1",
    "\u5236\u4F5C\u7EDF\u7B79",
    "\u97F3\u4E50\u7248\u6743",
    "\u521B\u610F\u987E\u95EE",
    "\u5E73\u9762\u8BBE\u8BA1",
    "\u5BA3\u4F20\u7269\u6599",
    "\u9ED1\u80F6\u8BBE\u8BA1",
    "\u9879\u76EE\u603B\u7EDF\u7B79",
    "\u827A\u4EBA\u534F\u529B",
    "\u9879\u76EE\u534F\u529B",
    "\u7B56\u7565\u884C\u9500",
    "\u89C6\u89C9\u7EDF\u7B79",
    "\u5A92\u4ECB",
    "\u5BA3\u4F20\u8425\u9500",
    "\u8054\u5408\u51FA\u54C1",
    "\u534F\u529E\u5355\u4F4D",
    "\u5BA3\u53D1\u5408\u4F5C\u4F19\u4F34",
    "\u72EC\u5BB6\u77ED\u89C6\u9891\u5E73\u53F0",
    "\u4E3B\u9898\u6B4C\u97F3\u4E50\u4E13\u8F91\u5DE5\u4F5C\u56E2\u961F",
    "\u5DE5\u4F5C\u5BA4\u8D1F\u8D23\u4EBA",
    "\u534F\u4F5C",
    "\u5E73\u9762\u6444\u5F71\u5E08",
    "\u6D77\u62A5\u8BBE\u8BA1\u56E2\u961F",
    "\u4F01\u5212",
    "\u548C\u58F0\u7F16\u5199",
    "\u753B\u5E08",
    "\u573A\u666F\u753B\u5E08",
    "PV\u5E95\u56FE",
    "\u7F8E\u5DE5",
    "\u9898\u5B57",
    "\u89C6\u9891",
    "\u4EBA\u58F0\u540E\u671F",
    "PV",
    "\u5C01\u9762",
    "\u5355\u66F2\u5C01\u9762",
    "\u5355\u66F2\u5C01\u9762\u53CA\u6807\u51C6\u5B57\u8BBE\u8BA1",
    "\u5355\u66F2\u5C01\u9762\u6444\u5F71",
    "\u6B4C\u8BCD\u5B57\u5E55",
    "\u6B4C\u624B",
    "\u539F\u5531",
    // 常见补充：和声 / 弦乐 / 键盘 / 鼓 与常见版权缩写
    "\u548C\u58F0",
    "\u5F26\u4E50",
    "\u952E\u76D8",
    "\u9F13",
    "\u5236\u4F5C",
    // 英文字段
    "Producer",
    "Composer",
    "Lyricist",
    "Arranger",
    "Vocal",
    "Guitar",
    "Bass",
    "Mixing",
    "Mastering",
    "Recording",
    "Arrangement",
    "Lyrics",
    "Music"
  ];
  var STAFF_BY_PREFIX = /^\s*(?:produced|written|composed|arranged|mixed|mastered|recorded|performed)\s+by\s+\S/i;
  var escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var KEYWORD_GROUP = `(?:${STAFF_ROLE_KEYWORDS.map(escapeRegExp).join("|")})`;
  var LATIN_ALIAS = `(?:\\s*[A-Za-z][A-Za-z0-9 .&'/-]*)?`;
  var BUILT_IN_STAFF_PATTERN = `^\\s*[\\[\uFF08(\u3010]?\\s*${KEYWORD_GROUP}(?:\\s*[/\u3001&+,\uFF0C\xB7\u30FB\u548C]?\\s*${KEYWORD_GROUP})*${LATIN_ALIAS}\\s*[\\]\uFF09)\u3011]?\\s*[:\uFF1A]\\s*\\S`;
  var builtInStaffRegex = new RegExp(BUILT_IN_STAFF_PATTERN, "i");
  var SPACED_STAFF_REGEX = new RegExp(`^\\s*${KEYWORD_GROUP}(?:\\s*[/\u3001&+,\uFF0C\xB7\u30FB\u548C]\\s*${KEYWORD_GROUP})*\\s+\\S`, "i");
  var isSpacedStaffLine = (line) => SPACED_STAFF_REGEX.test(line.fullText?.trim() || "");
  var createStaffCreditMatcher = (pattern) => {
    const normalized = pattern?.trim() || "";
    let custom = null;
    if (normalized) {
      try {
        custom = new RegExp(normalized, "i");
      } catch {
        custom = null;
      }
    }
    return (line) => {
      const text = line.fullText?.trim() || "";
      if (!text) {
        return false;
      }
      if (custom) {
        return custom.test(text);
      }
      return builtInStaffRegex.test(text) || STAFF_BY_PREFIX.test(text);
    };
  };
  var FILLER_REGEX = /^[^\p{L}\p{N}]+$/u;
  var isFillerLine = (line) => {
    const text = line.fullText?.trim() || "";
    return !text || text.length <= 8 && FILLER_REGEX.test(text);
  };
  var COLON_SHAPED_REGEX = /^[^:：，。！？；…!?]{1,60}[:：]\s*\S/;
  var isColonShaped = (line) => COLON_SHAPED_REGEX.test(line.fullText?.trim() || "");
  var isHeaderLike = (line, meta) => {
    const text = line.fullText?.trim() || "";
    if (!text) {
      return true;
    }
    if (/\s[-–—]\s/.test(text)) {
      return true;
    }
    return Boolean(
      meta.title && text.includes(meta.title.trim()) || meta.artist && text.includes(meta.artist.trim())
    );
  };
  var detectLeadingStaffBlock = (lines, isStaffLine, options = {}) => {
    const maxHeaderLines = options.maxHeaderLines ?? 2;
    const minStaffLines = options.minStaffLines ?? 2;
    const minDictionaryHits = options.minDictionaryHits ?? 2;
    const minTrailingStructuralRun = options.minTrailingStructuralRun ?? 2;
    const meta = options.meta ?? {};
    let cursor = 0;
    let headerLineCount = 0;
    while (cursor < lines.length && !isStaffLine(lines[cursor])) {
      if (isFillerLine(lines[cursor])) {
        cursor += 1;
        continue;
      }
      if (headerLineCount >= maxHeaderLines || !isHeaderLike(lines[cursor], meta)) {
        return null;
      }
      headerLineCount += 1;
      cursor += 1;
    }
    if (cursor >= lines.length) {
      return null;
    }
    const accepted = [];
    let dictionaryHits = 0;
    let pendingFiller = [];
    let scan = cursor;
    while (scan < lines.length) {
      const line = lines[scan];
      if (isFillerLine(line)) {
        pendingFiller.push(scan);
        scan += 1;
        continue;
      }
      const fromDictionary = isStaffLine(line);
      const isStructural = dictionaryHits >= minDictionaryHits && isColonShaped(line);
      if (!fromDictionary && !isStructural) {
        break;
      }
      if (fromDictionary) {
        dictionaryHits += 1;
      }
      accepted.push({ index: scan, fromDictionary, leadingFiller: pendingFiller });
      pendingFiller = [];
      scan += 1;
    }
    let trailingStructural = 0;
    while (trailingStructural < accepted.length && !accepted[accepted.length - 1 - trailingStructural].fromDictionary) {
      trailingStructural += 1;
    }
    if (trailingStructural > 0 && trailingStructural < minTrailingStructuralRun) {
      accepted.length -= trailingStructural;
      pendingFiller = [];
    }
    if (accepted.length < minStaffLines) {
      return null;
    }
    const staffIndexes = accepted.map((entry) => entry.index);
    const memberIndexes = accepted.flatMap((entry) => [...entry.leadingFiller, entry.index]);
    memberIndexes.push(...pendingFiller);
    const lastMemberIndex = memberIndexes[memberIndexes.length - 1];
    let firstLyricIndex = null;
    for (let index = lastMemberIndex + 1; index < lines.length; index += 1) {
      if (!isFillerLine(lines[index])) {
        firstLyricIndex = index;
        break;
      }
    }
    return { staffIndexes, memberIndexes, firstLyricIndex, headerLineCount, absorbedIndexes: [] };
  };

  // src/client/utils/lyrics/pureMusic.ts
  var LRC_TAG_PATTERN = /\[[^\]]*]/g;
  var WORD_TIMING_TAG_PATTERN = /<[\d:.,\s]*>|\(\d+,\d+,\d+\)/g;
  var JSON_LINE_PATTERN = /^\s*\{.*}\s*$/;
  var NOTICE_IGNORED_CHARS_PATTERN = /[\s\p{P}\p{S}]+/gu;
  var NOTICE_PREFIX = "(?:[\u6B64\u672C](?:\u9996)?(?:\u6B4C\u66F2|\u66F2\u76EE|\u4F5C\u54C1|\u4E50\u66F2|\u66F2)?[\u4E3A\u662F]?)?(?:(?:\u6CA1\u6709|\u65E0)(?:\u586B\u8BCD|\u6B4C\u8BCD)\u7684)?";
  var PURE_MUSIC_NOTICE_LINE = new RegExp(`^${NOTICE_PREFIX}[\u7EAF\u7D14]\u97F3[\u4E50\u6A02]\u656C?[\u8BF7\u8ACB][\u60A8\u4F60]?\u6B23[\u8D4F\u8CDE]$`);
  var HEADER_LINE_PATTERN = /\s[-–—]\s/;
  var isStaffCreditLine = createStaffCreditMatcher();
  var hasNeteasePureMusicFlag = (source) => {
    if (!source) return false;
    return Boolean(
      source.pureMusic || source.lrc?.pureMusic || source.yrc?.pureMusic || source.ytlrc?.pureMusic || source.tlyric?.pureMusic
    );
  };
  var splitCleanLyricLines = (text) => {
    if (!text) return [];
    return text.replace(/\uFEFF/g, "").split(/\r?\n/).map((line) => line.replace(LRC_TAG_PATTERN, "").replace(WORD_TIMING_TAG_PATTERN, "").trim()).filter((line) => line && !JSON_LINE_PATTERN.test(line));
  };
  var isPureMusicNoticeLine = (line) => PURE_MUSIC_NOTICE_LINE.test(line.replace(NOTICE_IGNORED_CHARS_PATTERN, ""));
  var isNoticeCompanionLine = (line) => {
    const asLine = { fullText: line };
    return isStaffCreditLine(asLine) || isColonShaped(asLine) || isSpacedStaffLine(asLine) || isFillerLine(asLine) || HEADER_LINE_PATTERN.test(line);
  };
  var isPureMusicLyricText = (text) => {
    let hasNotice = false;
    for (const line of splitCleanLyricLines(text)) {
      if (isPureMusicNoticeLine(line)) {
        hasNotice = true;
        continue;
      }
      if (!isNoticeCompanionLine(line)) {
        return false;
      }
    }
    return hasNotice;
  };
  var isPureMusicLyricLines = (lines) => Boolean(lines?.length) && isPureMusicLyricText(lines.map((line) => line.fullText).join("\n"));

  // src/client/utils/lyrics/neteaseProcessing.ts
  var extractNeteaseLyricPayload = (source) => {
    const mainLrc = source?.lrc?.lyric || null;
    const yrcLrc = source?.yrc?.lyric || source?.lrc?.yrc?.lyric || null;
    const ytlrc = source?.ytlrc?.lyric || source?.lrc?.ytlrc?.lyric || null;
    const yromalrc = source?.yromalrc?.lyric || source?.lrc?.yromalrc?.lyric || null;
    const tlyric = source?.tlyric?.lyric || null;
    const romalrc = source?.romalrc?.lyric || source?.lrc?.romalrc?.lyric || null;
    const transLrc = yrcLrc && ytlrc ? ytlrc : tlyric;
    const romanizationLrc = yrcLrc && yromalrc ? yromalrc : romalrc;
    const isPureMusic = hasNeteasePureMusicFlag(source) || isPureMusicLyricText(mainLrc);
    return {
      mainLrc,
      yrcLrc,
      transLrc,
      romanizationLrc,
      isPureMusic
    };
  };
  var processNeteaseLyrics = async (source, options = {}) => {
    const payload = extractNeteaseLyricPayload(source);
    const primaryLyrics = payload.yrcLrc || payload.mainLrc;
    if (!primaryLyrics || payload.isPureMusic) {
      return {
        ...payload,
        lyrics: null,
        chorusRanges: []
      };
    }
    const format = payload.yrcLrc ? "yrc" : detectTimedLyricFormat(payload.mainLrc || primaryLyrics);
    let lyrics = await parseLyricsAsync(
      format,
      primaryLyrics,
      payload.transLrc || "",
      resolveLyricProcessingOptions(options),
      payload.romanizationLrc || ""
    );
    if (lyrics) {
      lyrics.isWordByWord = !!payload.yrcLrc;
    }
    return {
      ...payload,
      lyrics,
      chorusRanges: []
    };
  };

  // src/client/utils/lyrics/adapters/NeteaseLyricAdapter.ts
  var NeteaseLyricAdapter = class {
    async parse(source, options = {}) {
      return (await processNeteaseLyrics(source, options)).lyrics;
    }
  };

  // src/client/utils/lyrics/navidromeStructuredLyrics.ts
  var pickMainCueLines = (lyrics) => {
    const mainAgentIds = new Set(
      lyrics.agents?.filter((agent) => agent.role === "main").map((agent) => agent.id) ?? []
    );
    const byIndex = /* @__PURE__ */ new Map();
    for (const cueLine of lyrics.cueLine ?? []) {
      const existing = byIndex.get(cueLine.index);
      if (!existing || cueLine.agentId && mainAgentIds.has(cueLine.agentId) && !mainAgentIds.has(existing.agentId ?? "")) {
        byIndex.set(cueLine.index, cueLine);
      }
    }
    return [...byIndex.values()].sort((left, right) => left.index - right.index || (left.start ?? 0) - (right.start ?? 0));
  };
  var finiteTime = (value) => typeof value === "number" && Number.isFinite(value) ? value / 1e3 : void 0;
  var getOffsetSeconds = (lyrics) => finiteTime(lyrics.offset) ?? 0;
  var getAdjustedTime = (value, lyrics) => {
    const time = finiteTime(value);
    return time === void 0 ? void 0 : time + getOffsetSeconds(lyrics);
  };
  var hasNonEmptyLines = (lyrics) => lyrics.line?.some((line) => line.value.trim().length > 0) ?? false;
  var hasCueTiming = (lyrics) => lyrics.cueLine?.some((cueLine) => cueLine.cue?.some((cue) => finiteTime(cue.start) !== void 0)) ?? false;
  var hasEnhancedLineTiming = (lyrics) => lyrics.line?.some((line) => detectTimedLyricFormat(line.value) === "enhanced-lrc") ?? false;
  var isNavidromeStructuredLyricCollection = (lyrics) => Array.isArray(lyrics) && lyrics.every((item) => Array.isArray(item.line));
  var selectPreferredNavidromeStructuredLyric = (items, kind = "main") => {
    const candidates = items?.filter((item) => item.kind === kind && hasNonEmptyLines(item)) ?? [];
    if (kind === "main") {
      const fallbackCandidates = items?.filter(hasNonEmptyLines) ?? [];
      return candidates.find(hasCueTiming) || candidates.find(hasEnhancedLineTiming) || candidates.find((item) => item.synced) || candidates[0] || items?.find((item) => hasNonEmptyLines(item) && hasCueTiming(item)) || fallbackCandidates.find(hasEnhancedLineTiming) || fallbackCandidates.find((item) => item.synced) || fallbackCandidates[0] || null;
    }
    return candidates.find((item) => item.synced) || candidates[0] || null;
  };
  var getTrackTimedEntries = (lyrics) => {
    if (!lyrics) {
      return [];
    }
    return lyrics.line.flatMap((line) => {
      const startTime = getAdjustedTime(line.start, lyrics);
      const text = line.value.trim();
      return startTime === void 0 || !text ? [] : [{ startTime, text }];
    }).sort((left, right) => left.startTime - right.startTime);
  };
  var parseNavidromeLineLyrics = (lyrics, options) => {
    if (!lyrics.synced || hasEnhancedLineTiming(lyrics)) {
      return null;
    }
    const timedLines = getTrackTimedEntries(lyrics);
    if (timedLines.length === 0) {
      return null;
    }
    const hasDuplicateTimestamps = timedLines.some(
      (line, index) => index > 0 && line.startTime === timedLines[index - 1].startTime
    );
    if (hasDuplicateTimestamps) {
      return null;
    }
    const lines = timedLines.map((line, index) => {
      const endTime = Math.max(
        estimateLrcLineEndTime(line.text, line.startTime, timedLines[index + 1]?.startTime),
        line.startTime + 1e-3
      );
      return {
        words: buildTimedWords(line.text, line.startTime, endTime),
        startTime: line.startTime,
        endTime,
        fullText: line.text
      };
    });
    return {
      lines: finalizeParsedLyricLines(lines, options),
      title: lyrics.displayTitle,
      artist: lyrics.displayArtist
    };
  };
  var findInlineAlternates = (lyrics, cueLine) => {
    const mainLine = lyrics.line[cueLine.index];
    if (!mainLine) return {};
    const alternates = [];
    let i = cueLine.index + 1;
    while (i < lyrics.line.length && lyrics.line[i].start === mainLine.start && !lyrics.cueLine?.some((candidate) => candidate.index === i)) {
      const val = lyrics.line[i].value.trim();
      if (val && val !== cueLine.value.trim()) {
        alternates.push(val);
      }
      i++;
    }
    if (alternates.length === 0) return {};
    if (alternates.length === 1) {
      return { translation: alternates[0] };
    }
    const romanizationCandidates = hasCjkScript(mainLine.value) ? alternates.filter(isRomanizationCandidate) : [];
    const romanization = romanizationCandidates.length === 1 ? romanizationCandidates[0] : void 0;
    const translation = alternates.find((candidate) => candidate !== romanization);
    return { translation, romanization };
  };
  var parseNavidromeStructuredLyrics = (lyrics, options = {}) => {
    const cueLines = pickMainCueLines(lyrics).filter((cueLine) => cueLine.cue?.some((cue) => finiteTime(cue.start) !== void 0));
    if (cueLines.length === 0) {
      return parseNavidromeLineLyrics(lyrics, options);
    }
    const lines = cueLines.map((cueLine, lineIndex) => {
      const cues = cueLine.cue ?? [];
      const startTime = getAdjustedTime(cueLine.start, lyrics) ?? getAdjustedTime(cues[0]?.start, lyrics) ?? 0;
      const nextLineStart = getAdjustedTime(cueLines[lineIndex + 1]?.start, lyrics);
      const explicitEnd = getAdjustedTime(cueLine.end, lyrics);
      const fallbackLineEnd = explicitEnd ?? nextLineStart ?? startTime + 5;
      const words = cues.flatMap((cue, wordIndex) => {
        const wordStart = getAdjustedTime(cue.start, lyrics);
        if (wordStart === void 0) {
          return [];
        }
        const nextWordStart = getAdjustedTime(cues[wordIndex + 1]?.start, lyrics);
        const wordEnd = Math.max(
          getAdjustedTime(cue.end, lyrics) ?? nextWordStart ?? fallbackLineEnd,
          wordStart + 1e-3
        );
        return [{ text: cue.value, startTime: wordStart, endTime: wordEnd }];
      });
      const endTime = Math.max(explicitEnd ?? words[words.length - 1]?.endTime ?? fallbackLineEnd, startTime + 1e-3);
      const alternates = findInlineAlternates(lyrics, cueLine);
      return {
        words,
        startTime,
        endTime,
        fullText: cueLine.value || words.map((word) => word.text).join(""),
        translation: alternates.translation,
        romanization: alternates.romanization
      };
    });
    return {
      lines: finalizeParsedLyricLines(lines, options),
      title: lyrics.displayTitle,
      artist: lyrics.displayArtist
    };
  };
  var parseNavidromeStructuredLyricsCollection = (lyricsList, options = {}) => {
    const mainLyrics = selectPreferredNavidromeStructuredLyric(lyricsList);
    if (!mainLyrics) {
      return null;
    }
    const parsedMainLyrics = parseNavidromeStructuredLyrics(mainLyrics, options);
    if (!parsedMainLyrics) {
      return null;
    }
    const translations = findTranslationsForSortedStartTimes(
      parsedMainLyrics.lines.map((line) => line.startTime),
      getTrackTimedEntries(selectPreferredNavidromeStructuredLyric(lyricsList, "translation"))
    );
    const romanizations = findTranslationsForSortedStartTimes(
      parsedMainLyrics.lines.map((line) => line.startTime),
      getTrackTimedEntries(selectPreferredNavidromeStructuredLyric(lyricsList, "pronunciation"))
    );
    return {
      ...parsedMainLyrics,
      lines: parsedMainLyrics.lines.map((line, index) => ({
        ...line,
        translation: translations[index] ?? line.translation,
        romanization: romanizations[index] ?? line.romanization
      }))
    };
  };

  // src/client/utils/lyrics/adapters/NavidromeLyricAdapter.ts
  var NavidromeLyricAdapter = class {
    async parse(source, options = {}) {
      if (source.structuredLyrics && isNavidromeStructuredLyricCollection(source.structuredLyrics)) {
        const parsedStructuredLyrics = parseNavidromeStructuredLyricsCollection(source.structuredLyrics, options);
        if (parsedStructuredLyrics) {
          return parsedStructuredLyrics;
        }
        const mainLyrics = selectPreferredNavidromeStructuredLyric(source.structuredLyrics);
        const translationLyrics = selectPreferredNavidromeStructuredLyric(source.structuredLyrics, "translation");
        const normalizedMainLyrics = normalizeEmbeddedStructuredLyrics(mainLyrics?.line);
        const normalizedTranslationLyrics = translationLyrics ? normalizeEmbeddedStructuredLyrics(translationLyrics.line).mainText : normalizedMainLyrics.translationText;
        return await parseLyricsAsync(
          detectTimedLyricFormat(normalizedMainLyrics.mainText),
          normalizedMainLyrics.mainText,
          normalizedTranslationLyrics,
          options
        );
      }
      if (source.structuredLyrics && !Array.isArray(source.structuredLyrics)) {
        const parsedStructuredLyrics = parseNavidromeStructuredLyrics(source.structuredLyrics, options);
        if (parsedStructuredLyrics) {
          return parsedStructuredLyrics;
        }
        const normalized = normalizeEmbeddedStructuredLyrics(source.structuredLyrics.line);
        return await parseLyricsAsync(
          detectTimedLyricFormat(normalized.mainText),
          normalized.mainText,
          normalized.translationText,
          options
        );
      }
      if (source.structuredLyrics && source.structuredLyrics.length > 0) {
        const normalized = normalizeEmbeddedStructuredLyrics(source.structuredLyrics);
        return await parseLyricsAsync(
          detectTimedLyricFormat(normalized.mainText),
          normalized.mainText,
          normalized.translationText,
          options
        );
      }
      if (source.plainLyrics) {
        const normalized = normalizeEmbeddedLrcText(source.plainLyrics);
        return await parseLyricsAsync(
          detectTimedLyricFormat(normalized.mainText),
          normalized.mainText,
          normalized.translationText,
          options
        );
      }
      return null;
    }
  };

  // src/client/utils/lyrics/wordSegmentation.ts
  var PUNCTUATION_ONLY = /^[\s\p{P}\p{S}]+$/u;
  var isWordLikeText = (text) => !PUNCTUATION_ONLY.test(text);
  var segmentsFromBoundaries = (boundaries) => {
    let cursor = 0;
    return boundaries.map((segment) => {
      const part = { segment, index: cursor, isWordLike: isWordLikeText(segment) };
      cursor += segment.length;
      return part;
    });
  };
  var segmentTextWords = (text) => {
    if (!text) {
      return [];
    }
    const Segmenter = typeof Intl !== "undefined" ? Intl.Segmenter : void 0;
    if (Segmenter) {
      try {
        return Array.from(new Segmenter(void 0, { granularity: "word" }).segment(text), (part) => ({
          segment: part.segment,
          index: part.index,
          isWordLike: part.isWordLike ?? isWordLikeText(part.segment)
        }));
      } catch {
      }
    }
    return segmentsFromBoundaries(splitLyricGraphemes(text));
  };
  var isValidWordSegmentation = (text, boundaries) => Array.isArray(boundaries) && boundaries.length > 0 && boundaries.every((segment) => typeof segment === "string") && boundaries.join("") === text;
  var EDGE_WHITESPACE = /^(\s*)(.*?)(\s*)$/su;
  var splitEdgeWhitespace = (boundaries) => boundaries.flatMap((boundary) => {
    const [, lead, core, trail] = EDGE_WHITESPACE.exec(boundary) ?? [];
    return core ? [lead, core, trail].filter(Boolean) : [boundary].filter(Boolean);
  });
  var segmentLyricWords = (line) => {
    if (isValidWordSegmentation(line.fullText, line.wordSegments)) {
      return segmentsFromBoundaries(splitEdgeWhitespace(line.wordSegments));
    }
    if (isValidWordSegmentation(line.fullText, line.autoWordSegments)) {
      return segmentsFromBoundaries(line.autoWordSegments);
    }
    return segmentTextWords(line.fullText);
  };

  // src/client/utils/lyrics/foliaLyricDocument.ts
  var FOLIA_LYRIC_DOCUMENT_FORMAT = "folia-lyricdata";
  var FOLIA_LYRIC_DOCUMENT_VERSION = 1;
  var isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
  var isRecord = (value) => Boolean(value) && typeof value === "object";
  var isValidWord = (value) => isRecord(value) && typeof value.text === "string" && isFiniteNumber(value.startTime) && isFiniteNumber(value.endTime);
  var isValidLine = (value) => isRecord(value) && typeof value.fullText === "string" && isFiniteNumber(value.startTime) && isFiniteNumber(value.endTime) && Array.isArray(value.words) && value.words.every(isValidWord);
  var isValidBackgroundVocal = (value) => isRecord(value) && typeof value.text === "string" && isFiniteNumber(value.startTime) && isFiniteNumber(value.endTime) && Array.isArray(value.words) && value.words.every(isValidWord);
  var optionalString = (value) => typeof value === "string" ? value : void 0;
  var sanitizeLine = (line) => {
    const {
      translation,
      romanization,
      wordSegments,
      alternateTexts,
      backgroundVocal,
      backgroundVocals,
      // 派生字段，文件里本不该有；有也丢掉，由 setter 按当前的 icu-folia 重新烘焙。
      autoWordSegments: _autoWordSegments,
      ...rest
    } = line;
    const words = rest.words.map((word) => word.syllables !== void 0 && !(Array.isArray(word.syllables) && word.syllables.every(isValidWord)) ? { text: word.text, startTime: word.startTime, endTime: word.endTime } : word);
    const result = {
      ...rest,
      words,
      endTime: Math.max(rest.endTime, rest.startTime)
    };
    const safeTranslation = optionalString(translation);
    if (safeTranslation !== void 0) result.translation = safeTranslation;
    const safeRomanization = optionalString(romanization);
    if (safeRomanization !== void 0) result.romanization = safeRomanization;
    if (isValidWordSegmentation(result.fullText, wordSegments)) {
      result.wordSegments = wordSegments;
    }
    if (Array.isArray(alternateTexts)) {
      const kept = alternateTexts.filter((item) => isRecord(item) && typeof item.text === "string" && typeof item.role === "string");
      if (kept.length > 0) result.alternateTexts = kept;
    }
    if (isValidBackgroundVocal(backgroundVocal)) result.backgroundVocal = backgroundVocal;
    if (Array.isArray(backgroundVocals)) {
      const kept = backgroundVocals.filter(isValidBackgroundVocal);
      if (kept.length > 0) result.backgroundVocals = kept;
    }
    return result;
  };
  var looksLikeFoliaLyricDocument = (text) => {
    const trimmed = text.replace(/^\uFEFF/, "").trimStart();
    return trimmed.startsWith("{") && trimmed.includes(`"${FOLIA_LYRIC_DOCUMENT_FORMAT}"`);
  };
  var parseFoliaLyricDocument = (text) => {
    if (!looksLikeFoliaLyricDocument(text)) return null;
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== "object") return null;
    const document2 = parsed;
    if (document2.format !== FOLIA_LYRIC_DOCUMENT_FORMAT) return null;
    if (document2.version !== FOLIA_LYRIC_DOCUMENT_VERSION) {
      console.warn("[foliaLyricDocument] Unsupported .fia version:", document2.version);
      return null;
    }
    const lyrics = document2.lyrics;
    if (!lyrics || typeof lyrics !== "object" || !Array.isArray(lyrics.lines) || !lyrics.lines.every(isValidLine)) {
      console.warn("[foliaLyricDocument] Malformed .fia lyric payload");
      return null;
    }
    const lines = lyrics.lines.map(sanitizeLine).sort((left, right) => left.startTime - right.startTime);
    return ensureLyricDataRenderHints({
      ...lyrics,
      title: optionalString(lyrics.title),
      artist: optionalString(lyrics.artist),
      isWordByWord: typeof lyrics.isWordByWord === "boolean" ? lyrics.isWordByWord : void 0,
      lines
    });
  };

  // src/client/utils/lyrics/adapters/LocalFileLyricAdapter.ts
  var LocalFileLyricAdapter = class {
    async parse(source, options = {}) {
      if (!source.lrcContent) return null;
      const foliaLyrics = parseFoliaLyricDocument(source.lrcContent);
      if (foliaLyrics) return foliaLyrics;
      const container = extractAwlrcContainer(source.lrcContent);
      if (container?.awlrc || container?.lrc) {
        const translation = source.tLrcContent || container.tlrc || "";
        const romanization = source.rLrcContent || container.rlrc || "";
        return container.awlrc ? await parseLyricsAsync("awlrc", container.awlrc, translation, options, romanization) : await parseLyricsAsync("lrc", container.lrc, translation, options, romanization);
      }
      let mainLrc = source.lrcContent;
      let transLrc = source.tLrcContent || "";
      let romanizationLrc = source.rLrcContent || "";
      let format = source.formatHint || detectTimedLyricFormat(mainLrc);
      if (format !== "ttml") {
        const { main, trans, romanization } = splitCombinedTimeline(mainLrc);
        mainLrc = main;
        transLrc ||= trans;
        romanizationLrc ||= romanization;
        format = source.formatHint || detectTimedLyricFormat(mainLrc);
      }
      return await parseLyricsAsync(format, mainLrc, transLrc, options, romanizationLrc);
    }
  };

  // src/client/utils/lyrics/adapters/QrcLyricAdapter.ts
  var QrcLyricAdapter = class {
    async parse(source, options = {}) {
      if (!source.qrcContent?.trim()) return null;
      return parseLyricsAsync("qrc", source.qrcContent, source.translationContent || "", options);
    }
  };

  // src/client/utils/lyrics/LyricParserFactory.ts
  var LyricParserFactory = class {
    static async parse(source, options = {}) {
      const resolvedOptions = resolveLyricProcessingOptions(options);
      let parsed = null;
      switch (source.type) {
        case "embedded":
          parsed = await new EmbeddedLyricAdapter().parse(source, resolvedOptions);
          break;
        case "netease":
          parsed = await new NeteaseLyricAdapter().parse(source, resolvedOptions);
          break;
        case "navidrome":
          parsed = await new NavidromeLyricAdapter().parse(source, resolvedOptions);
          break;
        case "local":
          parsed = await new LocalFileLyricAdapter().parse(source, resolvedOptions);
          break;
        case "qrc":
          parsed = await new QrcLyricAdapter().parse(source, resolvedOptions);
          break;
        default:
          console.warn("[LyricParserFactory] Unknown lyric source type:", source?.type);
          return null;
      }
      return ensureLyricDataRenderHints(parsed);
    }
  };

  // src/client/utils/lyrics/enhancedLrcSerializer.ts
  var MAX_TIMESTAMP_MS = (99 * 60 + 59) * 1e3 + 999;
  var clampTimestampMs = (seconds2) => Math.min(Math.max(Math.round(seconds2 * 1e3), 0), MAX_TIMESTAMP_MS);
  var splitTimestamp = (seconds2) => {
    const totalMs = clampTimestampMs(seconds2);
    return {
      minutes: Math.floor(totalMs / 6e4),
      seconds: Math.floor(totalMs % 6e4 / 1e3),
      millis: totalMs % 1e3
    };
  };
  var pad2 = (value) => `${value}`.padStart(2, "0");
  var formatLrcLineTimestamp = (seconds2) => formatLrcTimestamp(clampTimestampMs(seconds2));
  var formatLrcWordTimestamp = (seconds2) => {
    const { minutes, seconds: secs, millis } = splitTimestamp(seconds2);
    return `<${pad2(minutes)}:${pad2(secs)}.${`${millis}`.padStart(3, "0")}>`;
  };
  var inferLyricWordTiming = (lyrics) => lyrics.isWordByWord === true ? "word" : "line";
  var alignWordSegments = (line) => {
    const segments = line.words.map((word) => ({ word, text: word.text }));
    if (segments.map((segment) => segment.text).join("") === line.fullText) {
      return segments;
    }
    let cursor = 0;
    const aligned = [];
    let leading = "";
    for (const word of line.words) {
      const needle = word.text.trim();
      const index = needle ? line.fullText.indexOf(needle, cursor) : -1;
      if (index < 0) return segments;
      const gap = line.fullText.slice(cursor, index);
      if (aligned.length > 0) {
        aligned[aligned.length - 1].text += gap;
      } else {
        leading = gap;
      }
      aligned.push({ word, text: needle });
      cursor = index + needle.length;
    }
    if (aligned.length > 0) {
      aligned[0].text = leading + aligned[0].text;
      aligned[aligned.length - 1].text += line.fullText.slice(cursor);
    }
    return aligned;
  };
  var serializeWordTimedBody = (line) => {
    const segments = alignWordSegments(line);
    let body = "";
    let previousEnd = null;
    for (const { word, text } of segments) {
      if (previousEnd !== null && word.startTime - previousEnd > 5e-4) {
        body += formatLrcWordTimestamp(previousEnd);
      }
      body += `${formatLrcWordTimestamp(word.startTime)}${text}`;
      previousEnd = word.endTime;
    }
    const lineEnd = Math.max(previousEnd ?? line.endTime, line.startTime);
    return `${body}${formatLrcWordTimestamp(lineEnd)}`;
  };
  var formatLengthTag = (durationMs) => {
    const totalSeconds = Math.round(durationMs / 1e3);
    return `${pad2(Math.floor(totalSeconds / 60))}:${pad2(totalSeconds % 60)}`;
  };
  var sanitizeTagValue = (value) => value.replace(/[\]\r\n]/g, " ").trim();
  var oneLine = (text) => text.replace(/\s*[\r\n]+\s*/g, " ").trim();
  var serializeEnhancedLrc = (lyrics, options = {}) => {
    const {
      metadata = {},
      includeTranslation = true,
      includeRomanization = true,
      wordTiming = "auto"
    } = options;
    const timing = wordTiming === "auto" ? inferLyricWordTiming(lyrics) : wordTiming;
    const output = [];
    const title = metadata.title ?? lyrics.title;
    const artist = metadata.artist ?? lyrics.artist;
    if (title) output.push(`[ti:${sanitizeTagValue(title)}]`);
    if (artist) output.push(`[ar:${sanitizeTagValue(artist)}]`);
    if (metadata.album) output.push(`[al:${sanitizeTagValue(metadata.album)}]`);
    if (metadata.durationMs && metadata.durationMs > 0) output.push(`[length:${formatLengthTag(metadata.durationMs)}]`);
    output.push("[re:Folia]");
    let previousTagMs = Number.NEGATIVE_INFINITY;
    for (const line of lyrics.lines) {
      if (isInterludeLine(line)) continue;
      const text = oneLine(line.fullText);
      if (!text) continue;
      const tagMs = Math.max(Math.floor(Math.round(Math.max(line.startTime, 0) * 1e3) / 10) * 10, previousTagMs + 10);
      if (tagMs > MAX_TIMESTAMP_MS) break;
      previousTagMs = tagMs;
      const lineTag = formatLrcLineTimestamp(tagMs / 1e3);
      const useWordTiming = timing === "word" && line.words.length > 0;
      output.push(`${lineTag}${useWordTiming ? serializeWordTimedBody({ ...line, fullText: text }) : text}`);
      const translation = includeTranslation && line.translation ? oneLine(line.translation) : "";
      if (translation) output.push(`${lineTag}${translation}`);
      const romanization = includeRomanization && line.romanization ? oneLine(line.romanization) : "";
      if (romanization) output.push(`${lineTag}${romanization}`);
    }
    return `${output.join("\n")}
`;
  };

  // src/client/utils/lyrics/staffCreditsAbsorb.ts
  var isShortLine = (line, maxDuration) => !isFillerLine(line) && line.endTime - line.startTime < maxDuration;
  var sortAscending = (values) => [...values].sort((a, b) => a - b);
  var collectShortRun = (lines, start, step, memberSet, maxDuration) => {
    const taken = [];
    for (let index = start; index >= 0 && index < lines.length; index += step) {
      if (memberSet.has(index) || !isShortLine(lines[index], maxDuration)) {
        break;
      }
      taken.push(index);
    }
    return taken;
  };
  var absorbAdjacentLines = (lines, block, options) => {
    if (options.mode === "off" || block.staffIndexes.length === 0) {
      return block;
    }
    const memberSet = new Set(block.memberIndexes);
    const blockStart = block.memberIndexes[0];
    const lastMember = block.memberIndexes[block.memberIndexes.length - 1];
    const absorbed = collectShortRun(lines, blockStart - 1, -1, memberSet, options.maxDuration);
    if (options.mode === "both") {
      const lastIndex = lines.length - 1;
      const backward = collectShortRun(
        lines,
        Math.min(lastMember + 1, lastIndex),
        1,
        memberSet,
        options.maxDuration
      ).filter((index) => index < lastIndex);
      absorbed.push(...backward);
    }
    if (absorbed.length === 0) {
      return block;
    }
    const absorbedIndexes = sortAscending(absorbed);
    const memberIndexes = sortAscending([...block.memberIndexes, ...absorbedIndexes]);
    for (let index = memberIndexes[memberIndexes.length - 1] + 1; index < lines.length; index += 1) {
      if (!isFillerLine(lines[index])) {
        break;
      }
      memberIndexes.push(index);
    }
    const nextIndex = memberIndexes[memberIndexes.length - 1] + 1;
    const firstLyricIndex = nextIndex < lines.length ? nextIndex : null;
    return {
      ...block,
      memberIndexes,
      firstLyricIndex,
      absorbedIndexes
    };
  };

  // src/client/utils/lyrics/staffCreditsDecision.ts
  var TAIL_MARGIN_SECONDS = 1;
  var needsRetime = (staffLines, windowEnd, minDwell) => {
    for (let index = 0; index < staffLines.length; index += 1) {
      const nextStart = index + 1 < staffLines.length ? staffLines[index + 1].startTime : windowEnd;
      if (nextStart - staffLines[index].startTime < minDwell) {
        return true;
      }
    }
    return false;
  };
  var resolveStaffDecision = (lines, block, minDwell) => {
    const displayIndexes = [...block.staffIndexes, ...block.absorbedIndexes].sort((a, b) => a - b);
    const displayLines = displayIndexes.map((index) => lines[index]);
    const blockLineCount = block.staffIndexes.length;
    const windowStart = lines[block.memberIndexes[0]].startTime;
    const firstLyric = block.firstLyricIndex === null ? null : lines[block.firstLyricIndex];
    const base = {
      blockLineCount,
      requiredSeconds: displayLines.length * minDwell + TAIL_MARGIN_SECONDS,
      staffIndexes: block.staffIndexes,
      memberIndexes: block.memberIndexes,
      absorbedLineCount: block.absorbedIndexes.length,
      absorbedIndexes: block.absorbedIndexes
    };
    if (!firstLyric) {
      const lastLine = lines[lines.length - 1];
      return {
        ...base,
        verdict: "keep",
        windowSeconds: Math.max(0, lastLine.endTime - windowStart)
      };
    }
    const windowSeconds = Math.max(0, firstLyric.startTime - windowStart);
    if (windowSeconds >= base.requiredSeconds) {
      return {
        ...base,
        verdict: needsRetime(displayLines, firstLyric.startTime - TAIL_MARGIN_SECONDS, minDwell) ? "retime" : "keep",
        windowSeconds
      };
    }
    return { ...base, verdict: "hide", windowSeconds };
  };

  // src/client/utils/lyrics/staffCreditsRewrite.ts
  var retimeSyllables = (syllables, shift) => syllables?.map((syllable) => ({
    ...syllable,
    startTime: shift(syllable.startTime),
    endTime: shift(syllable.endTime),
    ruby: syllable.ruby?.map((ruby) => ({
      ...ruby,
      startTime: shift(ruby.startTime),
      endTime: shift(ruby.endTime)
    }))
  }));
  var retimeWords = (words, shift) => words.map((word) => ({
    ...word,
    startTime: shift(word.startTime),
    endTime: shift(word.endTime),
    syllables: retimeSyllables(word.syllables, shift)
  }));
  var retimeAlternateTexts = (alternateTexts, shift) => alternateTexts?.map((alternate) => ({
    ...alternate,
    syllables: retimeSyllables(alternate.syllables, shift)
  }));
  var retimeBackgroundVocal = (vocal, shift) => ({
    ...vocal,
    startTime: shift(vocal.startTime),
    endTime: shift(vocal.endTime),
    words: retimeWords(vocal.words, shift),
    alternateTexts: retimeAlternateTexts(vocal.alternateTexts, shift)
  });
  var retimeLine = (line, startTime, endTime) => {
    const originalSpan = Math.max(line.endTime - line.startTime, 1e-3);
    const scale = (endTime - startTime) / originalSpan;
    const shift = (time) => startTime + (time - line.startTime) * scale;
    return {
      ...line,
      startTime,
      endTime,
      words: retimeWords(line.words, shift),
      alternateTexts: retimeAlternateTexts(line.alternateTexts, shift),
      backgroundVocal: line.backgroundVocal && retimeBackgroundVocal(line.backgroundVocal, shift),
      backgroundVocals: line.backgroundVocals?.map((vocal) => retimeBackgroundVocal(vocal, shift)),
      renderHints: void 0
    };
  };
  var rebuildStaffLines = (lines, block, decision, minDwell) => {
    const memberIndexes = new Set(block.memberIndexes);
    const spreadIndexes = [...block.staffIndexes, ...block.absorbedIndexes].sort((a, b) => a - b);
    const spreadLines = spreadIndexes.map((index) => lines[index]);
    const windowStart = lines[block.memberIndexes[0]].startTime;
    const firstLyric = block.firstLyricIndex === null ? null : lines[block.firstLyricIndex];
    const windowEnd = firstLyric ? firstLyric.startTime - TAIL_MARGIN_SECONDS : spreadLines[spreadLines.length - 1].endTime;
    const replacement = decision.verdict === "retime" ? spreadLines.map((line, index) => {
      const slot = Math.max((windowEnd - windowStart) / spreadLines.length, minDwell);
      return retimeLine(line, windowStart + index * slot, windowStart + (index + 1) * slot);
    }) : [];
    const next = [];
    lines.forEach((line, index) => {
      if (!memberIndexes.has(index)) {
        next.push(line);
        return;
      }
      if (index === block.memberIndexes[0]) {
        next.push(...replacement);
      }
    });
    return next;
  };

  // src/client/utils/lyrics/staffCreditsPolicy.ts
  var DEFAULT_LYRIC_STAFF_POLICY = "smart";
  var DEFAULT_LYRIC_STAFF_MIN_DWELL_SECONDS = 1.5;
  var DEFAULT_LYRIC_STAFF_ABSORB_MODE = "off";
  var LYRIC_STAFF_MIN_DWELL_RANGE = { min: 0.6, max: 4 };
  var NO_BLOCK_DECISION = {
    verdict: "none",
    blockLineCount: 0,
    windowSeconds: 0,
    requiredSeconds: 0,
    staffIndexes: [],
    memberIndexes: [],
    absorbedLineCount: 0,
    absorbedIndexes: []
  };
  var clampMinDwell = (value) => {
    if (!Number.isFinite(value)) {
      return DEFAULT_LYRIC_STAFF_MIN_DWELL_SECONDS;
    }
    return Math.min(LYRIC_STAFF_MIN_DWELL_RANGE.max, Math.max(LYRIC_STAFF_MIN_DWELL_RANGE.min, value));
  };
  var stripInterludes = (lines) => lines.filter((line) => !isInterludeLine(line));
  var analyze = (lyrics, options) => {
    const minDwell = clampMinDwell(options.minDwellSeconds);
    const policy = options.policy ?? DEFAULT_LYRIC_STAFF_POLICY;
    const lines = stripInterludes(lyrics.lines);
    const detected = detectLeadingStaffBlock(lines, createStaffCreditMatcher(options.pattern), {
      meta: { title: lyrics.title, artist: lyrics.artist }
    });
    const block = detected && (policy === "hide" ? detected : absorbAdjacentLines(lines, detected, {
      mode: options.absorbMode ?? DEFAULT_LYRIC_STAFF_ABSORB_MODE,
      maxDuration: minDwell
    }));
    if (!block) {
      return { lines, block: null, decision: NO_BLOCK_DECISION, minDwell };
    }
    if (policy === "hide") {
      return {
        lines,
        block,
        minDwell,
        decision: {
          ...NO_BLOCK_DECISION,
          verdict: "hide",
          blockLineCount: block.staffIndexes.length,
          staffIndexes: block.staffIndexes,
          memberIndexes: block.memberIndexes,
          absorbedLineCount: block.absorbedIndexes.length,
          absorbedIndexes: block.absorbedIndexes
        }
      };
    }
    return { lines, block, decision: resolveStaffDecision(lines, block, minDwell), minDwell };
  };
  var applyLyricStaffPolicy = (lyrics, options = {}) => {
    if (!lyrics) {
      return null;
    }
    const policy = options.policy ?? DEFAULT_LYRIC_STAFF_POLICY;
    if (policy === "keep") {
      return ensureLyricDataRenderHints(lyrics);
    }
    const { lines, block, decision, minDwell } = analyze(lyrics, options);
    if (!block || decision.verdict === "none" || decision.verdict === "keep") {
      return ensureLyricDataRenderHints(lyrics);
    }
    return {
      ...lyrics,
      lines: finalizeParsedLyricLines(rebuildStaffLines(lines, block, decision, minDwell), { includeInterludes: true })
    };
  };

  // src/client/utils/chorusDetector.ts
  var detectChorusLines = (lrcString) => {
    const lines = lrcString.split("\n");
    const lineCounts = /* @__PURE__ */ new Map();
    const timeRegex = /\[(\d{2,3}):(\d{2})[.:](\d{2,3})\]/g;
    lines.forEach((line) => {
      const text = line.replace(timeRegex, "").trim();
      if (!text || text === "......") return;
      if (text.length < 2) return;
      const count = lineCounts.get(text) || 0;
      lineCounts.set(text, count + 1);
    });
    let maxCount = 0;
    lineCounts.forEach((count) => {
      if (count > maxCount) maxCount = count;
    });
    const chorusLines = /* @__PURE__ */ new Set();
    if (maxCount <= 1) return chorusLines;
    lineCounts.forEach((count, text) => {
      if (count === maxCount) {
        chorusLines.add(text);
      }
    });
    console.log("[ChorusDetector] Chorus lines detected:", chorusLines);
    return chorusLines;
  };

  // src/client/utils/lyrics/chorusEffects.ts
  var CHORUS_EFFECTS = ["bars", "circles", "beams"];
  var applyDetectedChorusEffects = (lyrics, mainLrc, random = Math.random) => {
    const chorusLines = detectChorusLines(mainLrc);
    if (chorusLines.size === 0) {
      return lyrics;
    }
    const effectMap = /* @__PURE__ */ new Map();
    chorusLines.forEach((text) => {
      const index = Math.floor(random() * CHORUS_EFFECTS.length) % CHORUS_EFFECTS.length;
      effectMap.set(text, CHORUS_EFFECTS[index]);
    });
    return {
      ...lyrics,
      lines: lyrics.lines.map((line) => {
        const text = line.fullText.trim();
        if (!chorusLines.has(text)) {
          return line;
        }
        return {
          ...line,
          isChorus: true,
          chorusEffect: effectMap.get(text)
        };
      })
    };
  };
  var applyChorusRangesByTime = (lyrics, chorusRanges, random = Math.random) => {
    if (!chorusRanges || chorusRanges.length === 0) {
      return lyrics;
    }
    const rangeEffects = chorusRanges.map(() => {
      const index = Math.floor(random() * CHORUS_EFFECTS.length) % CHORUS_EFFECTS.length;
      return CHORUS_EFFECTS[index];
    });
    return {
      ...lyrics,
      lines: lyrics.lines.map((line) => {
        const lineStart = line.startTime;
        const lineEnd = line.endTime;
        if (typeof lineStart !== "number" || typeof lineEnd !== "number") {
          return line;
        }
        let matchedRangeIndex = -1;
        for (let i = 0; i < chorusRanges.length; i++) {
          const range = chorusRanges[i];
          const rangeStart = range.startTime;
          const rangeEnd = range.endTime;
          if (lineStart < rangeEnd && lineEnd > rangeStart) {
            matchedRangeIndex = i;
            break;
          }
        }
        if (matchedRangeIndex === -1) {
          return line;
        }
        return {
          ...line,
          isChorus: true,
          chorusEffect: rangeEffects[matchedRangeIndex]
        };
      })
    };
  };

  // src/client/utils/lyrics/lyricOffsetMemory.ts
  var STORAGE_KEY = "lyric_timeline_offsets";
  var MAX_ENTRIES = 1e3;
  var cache = null;
  var normalizeKey = (songKey) => {
    if (songKey === null || songKey === void 0 || songKey === "") {
      return null;
    }
    return String(songKey);
  };
  var hydrate = () => {
    if (cache) {
      return cache;
    }
    cache = /* @__PURE__ */ new Map();
    if (typeof window === "undefined") {
      return cache;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
            cache.set(key, value);
          }
        }
      }
    } catch {
    }
    return cache;
  };
  var persist = (map) => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(map)));
    } catch {
    }
  };
  var clearLyricOffsets = () => {
    cache = /* @__PURE__ */ new Map();
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
  };
  var readLyricOffset = (songKey) => {
    const key = normalizeKey(songKey);
    if (!key) {
      return 0;
    }
    return hydrate().get(key) ?? 0;
  };
  var writeLyricOffset = (songKey, offsetMs) => {
    const key = normalizeKey(songKey);
    if (!key) {
      return;
    }
    const map = hydrate();
    map.delete(key);
    if (Number.isFinite(offsetMs) && offsetMs !== 0) {
      map.set(key, offsetMs);
    }
    while (map.size > MAX_ENTRIES) {
      const oldest = map.keys().next().value;
      if (oldest === void 0) {
        break;
      }
      map.delete(oldest);
    }
    persist(map);
  };

  // src/client/utils/lyrics/lyricLineRules.ts
  var LYRIC_LINE_PRESETS = [
    { id: "copyright", words: ["\u7248\u6743\u6240\u6709", "\u672A\u7ECF\u8BB8\u53EF", "\u672A\u7ECF\u6388\u6743", "\u4E0D\u5F97\u7FFB\u5531", "\u7981\u6B62\u7FFB\u5531", "\u4FB5\u6743\u5FC5\u7A76", "all rights reserved", "copyright", "\xA9", "\u2117"] },
    { id: "lyricSource", words: ["\u6B4C\u8BCD\u8D21\u732E\u8005", "\u7FFB\u8BD1\u8D21\u732E\u8005", "\u6B4C\u8BCD\u6765\u6E90", "\u6B4C\u8BCD\u6765\u81EA", "\u6B4C\u8BCD\u63D0\u4F9B", "\u6B4C\u8BCD\u5236\u4F5C", "\u6B4C\u8BCD\u6821\u5BF9", "lrc by"] }
  ];
  var escapeRegExp2 = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var getLyricLinePresetWords = (id) => LYRIC_LINE_PRESETS.find((preset) => preset.id === id)?.words ?? null;
  var foldWidth = (text) => text.replace(/[\uFF01-\uFF5E]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248));
  var lyricLineAsRuleSees = (rule, text) => rule.shape === "written" ? text : foldWidth(text);
  var lyricLineRuleWords = (text) => [...new Set(text.split("\n").map((word) => word.trim()).filter(Boolean))];
  var compileLyricLineRule = (rule) => {
    if (rule.shape === "written") {
      return compileLyricFilterPattern(rule.text);
    }
    if (rule.shape === "preset") {
      const words2 = getLyricLinePresetWords(rule.text);
      return words2 ? new RegExp(words2.map((word) => escapeRegExp2(foldWidth(word))).join("|"), "i") : null;
    }
    const words = lyricLineRuleWords(foldWidth(rule.text));
    if (words.length === 0) {
      return null;
    }
    const body = `(?:${words.sort((one, other) => other.length - one.length).map(escapeRegExp2).join("|")})`;
    switch (rule.shape) {
      case "starts":
        return new RegExp(`^\\s*${body}${rule.colon ? "\\s*[:\uFF1A]" : ""}`, "i");
      case "whole":
        return new RegExp(`^\\s*${body}\\s*$`, "i");
      case "ends":
        return new RegExp(`${body}\\s*$`, "i");
      default:
        return new RegExp(body, "i");
    }
  };
  var compileLyricLineRules = (rules) => rules.flatMap((rule) => {
    if (!rule.on) {
      return [];
    }
    const regex = compileLyricLineRule(rule);
    return regex ? [{ rule, regex }] : [];
  });
  var isMidSongLine = (index, total) => index >= Math.ceil(total / 4) && index < total - Math.ceil(total / 10);
  var lyricLineRuleHits = (compiled, text, index, total) => !(compiled.rule.edgesOnly && isMidSongLine(index, total)) && compiled.regex.test(lyricLineAsRuleSees(compiled.rule, text));
  var matchLyricLines = (lines, compiled) => lines.map((line, index) => compiled.find((entry) => lyricLineRuleHits(entry, line.fullText, index, lines.length)) ?? null);
  var applyLyricLineRules = (lyrics, compiled) => {
    if (!lyrics) {
      return null;
    }
    if (compiled.length === 0) {
      return ensureLyricDataRenderHints(lyrics);
    }
    const lines = lyrics.lines.filter((line) => !isInterludeLine(line));
    const hits = matchLyricLines(lines, compiled);
    return {
      ...lyrics,
      lines: finalizeParsedLyricLines(lines.filter((_, index) => !hits[index]), { includeInterludes: true })
    };
  };

  // src/client/types/lyricSegmentation.ts
  var LYRIC_SEGMENTATION_RECORD_VERSION = 1;

  // A_other/shared/lyricSegmentationPrompt.mjs
  var SEGMENTATION_SYSTEM_PROMPT = [
    "You segment song lyrics into words for a typography engine.",
    "",
    "You receive numbered lyric lines. For each line, split it into the units a human reader would",
    "treat as single words, and return them in order.",
    "",
    "Hard rules, in priority order:",
    "1. Lossless. Concatenating one line\u2019s segments must reproduce that line character for character,",
    "   including every space, punctuation mark and symbol. Never add, drop, reorder or normalise a",
    "   character. Never translate, romanise, or correct spelling.",
    "2. Same count. Return exactly one segment array per input line, in the same order.",
    "3. Split at meaning, not at characters. For Chinese, Japanese and Korean, group characters into",
    "   real words and set phrases (\u4E0D\u77E5\u9053 / \u5B64\u72EC\u7684 / \u30AD\u30E9\u30AD\u30E9), not one character per segment.",
    "   Keep verb\u2013complement and noun\u2013suffix pairs together when they read as one word.",
    "4. One word per segment. A segment carries a single content word plus the grammatical tail glued",
    "   to it. If a segment still holds a second noun, verb or adjective, split it again. Spaces are",
    "   not the only split points: a Japanese or Chinese line usually has none and still needs one",
    "   segment per word. Returning a whole clause, or a whole line, as one segment is a failure.",
    "5. Japanese specifically: split before every content word, and keep each content word together",
    "   with the okurigana, auxiliaries and particles that follow it (\u898B\u3048\u306A\u3044 / \u3088\u3046\u306B / \u96C6\u3081\u305F\u3044 /",
    "   \u3051\u3069). Sentence-final particles (\u3088 / \u306D / \u3055) attach to what precedes them.",
    "6. Keep space-delimited words whole for Latin scripts, and keep contractions such as it\u2019s or",
    "   don\u2019t in one segment.",
    "7. Attach trailing punctuation to the segment it follows (\u4E16\u754C\u3002 not \u4E16\u754C + \u3002). A bracket or quote",
    "   stays in one segment with the text it wraps ((\u62FC\u56FE\u5973\u5B69) not ( + \u62FC\u56FE\u5973\u5B69 + )). A space belongs",
    "   to the segment that precedes it.",
    '8. The "N. " prefix on each input line is numbering added by this request. It is NOT part of the',
    "   lyric. Never include it in a segment.",
    "",
    "Examples. Given:",
    "  1. \u628A\u56DE\u5FC6\u62FC\u597D\u7ED9\u4F60",
    "  2. It\u2019s unbelievable, isn\u2019t it?",
    "  3. \u3044\u3063\u3071\u3044\u3042\u308B\u3093\u3060\u3088\u6B32\u3057\u3044\u3082\u306E",
    "  4. \u898B\u3048\u306A\u3044\u3088\u3046\u306B\u3055 \u96A0\u3057\u3066\u3082",
    "answer exactly:",
    '  {"lines": [["\u628A", "\u56DE\u5FC6", "\u62FC\u597D", "\u7ED9", "\u4F60"], ["It\u2019s ", "unbelievable, ", "isn\u2019t ", "it?"], ["\u3044\u3063\u3071\u3044", "\u3042\u308B\u3093\u3060\u3088", "\u6B32\u3057\u3044", "\u3082\u306E"], ["\u898B\u3048\u306A\u3044", "\u3088\u3046\u306B", "\u3055 ", "\u96A0\u3057\u3066\u3082"]]}',
    "",
    'Respond with JSON only: {"lines": [["seg", "seg"], ["seg"]]}. No prose, no code fence.'
  ].join("\n");
  var WHITESPACE = /\s/;
  var realignSegmentsToText = (boundaries, text) => {
    if (boundaries.join("") === text) {
      return boundaries;
    }
    const slices = [];
    let cursor = 0;
    for (const boundary of boundaries) {
      const wanted = boundary.replace(/\s+/gu, "");
      if (!wanted) {
        continue;
      }
      const start = cursor;
      let matched = 0;
      while (cursor < text.length && matched < wanted.length) {
        const char = text[cursor];
        if (WHITESPACE.test(char)) {
          cursor += 1;
          continue;
        }
        if (char !== wanted[matched]) {
          return null;
        }
        matched += 1;
        cursor += 1;
      }
      if (matched < wanted.length) {
        return null;
      }
      slices.push(text.slice(start, cursor));
    }
    if (slices.length === 0) {
      return null;
    }
    const tail = text.slice(cursor);
    if (tail.trim()) {
      return null;
    }
    slices[slices.length - 1] += tail;
    return slices;
  };

  // src/client/utils/lyrics/lyricSegmentationRecord.ts
  var SEGMENTATION_DELIMITER = "/";
  var getLyricLineSegmentationKey = (line) => `${Math.round(line.startTime * 1e3)}|${line.fullText}`;
  var createLyricSegmentationRecord = (songKey, source, lines) => ({
    version: LYRIC_SEGMENTATION_RECORD_VERSION,
    songKey,
    updatedAt: Date.now(),
    source,
    lines
  });
  var isLyricSegmentationRecord = (value) => {
    if (!value || typeof value !== "object") return false;
    const record = value;
    return record.version === LYRIC_SEGMENTATION_RECORD_VERSION && typeof record.songKey === "string" && typeof record.updatedAt === "number" && (record.source === "ai" || record.source === "manual") && Boolean(record.lines) && typeof record.lines === "object";
  };
  var applyLyricWordSegmentation = (lyrics, record) => {
    if (!lyrics || !record) {
      return lyrics;
    }
    let changed = false;
    const lines = lyrics.lines.map((line) => {
      const boundaries = record.lines[getLyricLineSegmentationKey(line)];
      if (!isValidWordSegmentation(line.fullText, boundaries)) {
        return line;
      }
      changed = true;
      return { ...line, wordSegments: boundaries };
    });
    return changed ? { ...lyrics, lines } : lyrics;
  };
  var countAppliedSegmentationLines = (lyrics, record) => {
    if (!lyrics || !record) return 0;
    return lyrics.lines.reduce((total, line) => {
      const boundaries = record.lines[getLyricLineSegmentationKey(line)];
      return isValidWordSegmentation(line.fullText, boundaries) ? total + 1 : total;
    }, 0);
  };
  var buildSegmentationBoundaries = (lyrics) => lyrics.lines.map((line) => segmentLyricWords(line).map((part) => part.segment));
  var buildSegmentationExportText = (lyrics) => buildSegmentationBoundaries(lyrics).map((boundaries) => boundaries.join(SEGMENTATION_DELIMITER)).join("\n");
  var SegmentationImportError = class extends Error {
    /** 1-based row in the pasted text, or null when the failure is not row-specific. */
    row;
    constructor(message, row = null) {
      super(message);
      this.name = "SegmentationImportError";
      this.row = row;
    }
  };
  var parseDelimitedRows = (text) => text.replace(/\r\n?/g, "\n").split("\n").map((row) => row.split(SEGMENTATION_DELIMITER).filter((segment) => segment.length > 0));
  var parseJsonRows = (text) => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SegmentationImportError("invalid-json");
    }
    const rows = Array.isArray(parsed) ? parsed : parsed?.lines;
    if (!Array.isArray(rows) || !rows.every((row) => Array.isArray(row) && row.every((segment) => typeof segment === "string"))) {
      throw new SegmentationImportError("invalid-json-shape");
    }
    return rows;
  };
  var parseSegmentationImport = (text, lyrics) => {
    const normalized = text.replace(/\r\n?/g, "\n");
    const trimmed = normalized.trim();
    if (!trimmed) {
      throw new SegmentationImportError("empty");
    }
    const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(trimmed);
    const content = fenced ? fenced[1] : normalized;
    const isJson = /^[\[{]/.test(content.trimStart());
    let rows = isJson ? parseJsonRows(content.trim()) : parseDelimitedRows(content);
    const segmentableLines = lyrics.lines.filter((line) => Boolean(line.fullText));
    const coversKnownLines = () => rows.length === lyrics.lines.length || rows.length === segmentableLines.length;
    if (!isJson && !coversKnownLines()) {
      const nonblankRows = rows.filter((row) => row.join("").trim() !== "");
      if (nonblankRows.length === segmentableLines.length) rows = nonblankRows;
    }
    if (!coversKnownLines()) {
      throw new SegmentationImportError("line-count-mismatch");
    }
    const targetLines = rows.length === lyrics.lines.length ? lyrics.lines : segmentableLines;
    const lines = {};
    let appliedCount = 0;
    rows.forEach((boundaries, index) => {
      const line = targetLines[index];
      if (!line.fullText) {
        if (boundaries.join("")) throw new SegmentationImportError("line-text-mismatch", index + 1);
        return;
      }
      const realigned = realignSegmentsToText(boundaries, line.fullText);
      if (!realigned || !isValidWordSegmentation(line.fullText, realigned)) {
        throw new SegmentationImportError("line-text-mismatch", index + 1);
      }
      lines[getLyricLineSegmentationKey(line)] = realigned;
      appliedCount += 1;
    });
    if (appliedCount === 0) {
      throw new SegmentationImportError("empty");
    }
    return { lines, appliedCount };
  };

  // src/client/render/lyrics/entry.ts
  init_jieba();
  init_jiebaLexicon();
  init_budouxJapanese();

  // src/client/utils/lyrics/icuFolia/lexicon.ts
  var CHINESE_TRAILING_PARTICLES = /* @__PURE__ */ new Set([
    "\u7684",
    "\u5730",
    "\u5F97",
    "\u4E86",
    "\u7740",
    "\u8457",
    "\u8FC7",
    "\u904E",
    "\u4EEC",
    "\u5011",
    "\u5417",
    "\u55CE",
    "\u5462",
    "\u5427",
    "\u554A",
    "\u5440",
    "\u5566",
    "\u561B",
    "\u54E6",
    "\u5594",
    "\u4E48",
    "\u9EBC",
    "\u54C7",
    "\u5450",
    "\u54AF",
    // Cantonese
    "\u5605",
    "\u5497",
    "\u5587",
    "\u56C9",
    "\u54A9",
    "\u35CE",
    "\u5643",
    "\u558E",
    "\u556B",
    "\u5416",
    "\u561E"
  ]);
  var CHINESE_NON_HOSTS = /* @__PURE__ */ new Set([
    "\u548C",
    "\u4E0E",
    "\u8207",
    "\u8DDF",
    "\u540C",
    "\u53CA",
    "\u6216",
    "\u800C",
    "\u5728",
    "\u4ECE",
    "\u5F9E",
    "\u5411",
    "\u5BF9",
    "\u5C0D",
    "\u628A",
    "\u88AB",
    "\u7ED9",
    "\u7D66",
    "\u8BA9",
    "\u8B93",
    "\u4E3A",
    "\u70BA",
    "\u4E5F",
    "\u90FD",
    "\u5C31",
    "\u53C8",
    "\u518D",
    "\u8FD8",
    "\u9084",
    "\u624D",
    "\u5F88",
    "\u592A",
    "\u6700",
    "\u66F4",
    "\u4E0D",
    "\u6CA1",
    "\u6C92",
    "\u522B",
    "\u5225",
    "\u672A",
    "\u662F",
    "\u4FC2",
    "\u5514",
    "\u5187",
    "\u5572"
  ]);

  // src/client/utils/lyrics/icuFolia/segmenter.ts
  var CJ_PIECE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆〇]+$/u;
  var KANA = /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
  var ALPHABETIC_WORD = /^[\p{L}\p{M}\p{N}]+$/u;
  var NOT_ALPHABETIC = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
  var HYPHEN = /^[-‐‑]$/;
  var HYPHEN_SPLIT = /[-‐‑]/;
  var isAlphabeticWord = (piece) => ALPHABETIC_WORD.test(piece) && !NOT_ALPHABETIC.test(piece);
  var icuSegmenter = null;
  var icuWordPieces = (text) => {
    icuSegmenter ??= new Intl.Segmenter(void 0, { granularity: "word" });
    return Array.from(icuSegmenter.segment(text), (part) => part.segment);
  };
  var rebuilds = (pieces, text) => pieces.length > 0 && pieces.join("") === text;
  var attachTrailingParticles = (words) => {
    const out = [];
    for (const word of words) {
      const host = out[out.length - 1];
      if (host !== void 0 && CHINESE_TRAILING_PARTICLES.has(word) && !CHINESE_NON_HOSTS.has(host)) {
        out[out.length - 1] = host + word;
      } else {
        out.push(word);
      }
    }
    return out;
  };
  var cutCjRun = (run, icuPieces, engines2) => {
    if (!engines2) {
      return icuPieces;
    }
    if (KANA.test(run)) {
      const bunsetsu = engines2.parseJapanese(run);
      return rebuilds(bunsetsu, run) ? bunsetsu : icuPieces;
    }
    const words = engines2.cutChinese(run);
    return rebuilds(words, run) ? attachTrailingParticles(words) : icuPieces;
  };
  var joinHyphenatedWords = (pieces) => {
    const out = [];
    for (let index = 0; index < pieces.length; index += 1) {
      const piece = pieces[index];
      const previous = out[out.length - 1];
      const next = pieces[index + 1];
      if (HYPHEN.test(piece) && previous !== void 0 && next !== void 0 && isAlphabeticWord(previous.split(HYPHEN_SPLIT).pop() ?? "") && isAlphabeticWord(next)) {
        out[out.length - 1] = previous + piece + next;
        index += 1;
      } else {
        out.push(piece);
      }
    }
    return out;
  };
  var segmentWithIcuFolia = (text, engines2) => {
    if (!text) {
      return [];
    }
    const pieces = icuWordPieces(text);
    const out = [];
    let index = 0;
    while (index < pieces.length) {
      if (!CJ_PIECE.test(pieces[index])) {
        out.push(pieces[index]);
        index += 1;
        continue;
      }
      const runPieces = [];
      while (index < pieces.length && CJ_PIECE.test(pieces[index])) {
        runPieces.push(pieces[index]);
        index += 1;
      }
      out.push(...cutCjRun(runPieces.join(""), runPieces, engines2));
    }
    return joinHyphenatedWords(out);
  };

  // src/client/utils/lyrics/icuFolia/index.ts
  var engines = null;
  var loading = null;
  var loadIcuFolia = (loader = async () => (await Promise.resolve().then(() => (init_engines(), engines_exports))).loadIcuFoliaEngines()) => {
    loading ??= loader().then(
      (loaded) => {
        engines = loaded;
        return true;
      },
      (error) => {
        console.warn("[icu-folia] engines failed to load, lyrics keep the ICU split", error);
        return false;
      }
    );
    return loading;
  };
  var isIcuFoliaReady = () => engines !== null;
  var sameBoundaries = (a, b) => a !== void 0 && a.length === b.length && a.every((segment, index) => segment === b[index]);
  var applyAutoWordSegmentation = (lyrics) => {
    if (!lyrics || !engines) {
      return lyrics;
    }
    let changed = false;
    const lines = lyrics.lines.map((line) => {
      if (!line.fullText) {
        return line;
      }
      const boundaries = segmentWithIcuFolia(line.fullText, engines);
      if (sameBoundaries(line.autoWordSegments, boundaries)) {
        return line;
      }
      changed = true;
      return { ...line, autoWordSegments: boundaries };
    });
    return changed ? { ...lyrics, lines } : lyrics;
  };

  // src/client/render/lyrics/entry.ts
  function parse(source, options = {}) {
    return LyricParserFactory.parse(source, options);
  }
  function prepare(lyrics, options = {}) {
    if (!lyrics) return null;
    const rules = Array.isArray(options.rules) ? options.rules : [];
    const filtered = rules.length > 0 ? applyLyricLineRules(lyrics, compileLyricLineRules(rules)) : lyrics;
    let next = applyLyricStaffPolicy(filtered, { policy: options.policy ?? "smart" });
    if (!next) return null;
    if (next.lines.some((line) => line.isChorus)) return next;
    const ranges = Array.isArray(options.chorusRanges) ? options.chorusRanges : [];
    if (ranges.length > 0) return applyChorusRangesByTime(next, ranges);
    const rebuilt = next.lines.map((line) => `[00:00.00]${line.fullText}`).join("\n");
    return applyDetectedChorusEffects(next, rebuilt);
  }
  function loadIcuFoliaFromData(data) {
    return loadIcuFolia(async () => {
      const { dict, hmm } = data;
      const jieba = createJieba({
        words: dict.words,
        freqs: dict.freqs,
        total: dict.total,
        hmm: { start: hmm.start, trans: hmm.trans, emit: hmm.emit }
      }, { maxHmmWordLength: 2 });
      CHINESE_EXTRA_WORDS.forEach((word) => jieba.addWord(word));
      CHINESE_DEMOTED_WORDS.forEach((word) => jieba.addWord(word, 1));
      const map = /* @__PURE__ */ new Map();
      for (let index = 0; index + 1 < hmm.t2s.length; index += 2) map.set(hmm.t2s[index], hmm.t2s[index + 1]);
      const simplify = (text) => Array.from(text, (char) => map.get(char) ?? char).join("");
      const japanese = createJapaneseParser();
      const engines2 = {
        cutChinese(text) {
          let cursor = 0;
          return jieba.cut(simplify(text)).map((word) => {
            const original = text.slice(cursor, cursor + word.length);
            cursor += word.length;
            return original;
          });
        },
        parseJapanese: (text) => japanese.parse(text)
      };
      return engines2;
    });
  }
  return __toCommonJS(entry_exports);
})();
