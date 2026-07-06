var Xv = { exports: {} }, p0 = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var x2;
function OT() {
  if (x2) return p0;
  x2 = 1;
  var x = Symbol.for("react.transitional.element"), k = Symbol.for("react.fragment");
  function fe(M, P, oe) {
    var Te = null;
    if (oe !== void 0 && (Te = "" + oe), P.key !== void 0 && (Te = "" + P.key), "key" in P) {
      oe = {};
      for (var F in P)
        F !== "key" && (oe[F] = P[F]);
    } else oe = P;
    return P = oe.ref, {
      $$typeof: x,
      type: M,
      key: Te,
      ref: P !== void 0 ? P : null,
      props: oe
    };
  }
  return p0.Fragment = k, p0.jsx = fe, p0.jsxs = fe, p0;
}
var g0 = {}, Qv = { exports: {} }, ke = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var U2;
function zT() {
  if (U2) return ke;
  U2 = 1;
  var x = Symbol.for("react.transitional.element"), k = Symbol.for("react.portal"), fe = Symbol.for("react.fragment"), M = Symbol.for("react.strict_mode"), P = Symbol.for("react.profiler"), oe = Symbol.for("react.consumer"), Te = Symbol.for("react.context"), F = Symbol.for("react.forward_ref"), le = Symbol.for("react.suspense"), V = Symbol.for("react.memo"), me = Symbol.for("react.lazy"), B = Symbol.for("react.activity"), C = Symbol.iterator;
  function ue(b) {
    return b === null || typeof b != "object" ? null : (b = C && b[C] || b["@@iterator"], typeof b == "function" ? b : null);
  }
  var xe = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, ie = Object.assign, be = {};
  function Ue(b, j, te) {
    this.props = b, this.context = j, this.refs = be, this.updater = te || xe;
  }
  Ue.prototype.isReactComponent = {}, Ue.prototype.setState = function(b, j) {
    if (typeof b != "object" && typeof b != "function" && b != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, b, j, "setState");
  }, Ue.prototype.forceUpdate = function(b) {
    this.updater.enqueueForceUpdate(this, b, "forceUpdate");
  };
  function Jt() {
  }
  Jt.prototype = Ue.prototype;
  function mt(b, j, te) {
    this.props = b, this.context = j, this.refs = be, this.updater = te || xe;
  }
  var Mt = mt.prototype = new Jt();
  Mt.constructor = mt, ie(Mt, Ue.prototype), Mt.isPureReactComponent = !0;
  var Bt = Array.isArray;
  function qt() {
  }
  var je = { H: null, A: null, T: null, S: null }, We = Object.prototype.hasOwnProperty;
  function Ct(b, j, te) {
    var ee = te.ref;
    return {
      $$typeof: x,
      type: b,
      key: j,
      ref: ee !== void 0 ? ee : null,
      props: te
    };
  }
  function pe(b, j) {
    return Ct(b.type, j, b.props);
  }
  function Yt(b) {
    return typeof b == "object" && b !== null && b.$$typeof === x;
  }
  function Ae(b) {
    var j = { "=": "=0", ":": "=2" };
    return "$" + b.replace(/[=:]/g, function(te) {
      return j[te];
    });
  }
  var Ve = /\/+/g;
  function Kt(b, j) {
    return typeof b == "object" && b !== null && b.key != null ? Ae("" + b.key) : j.toString(36);
  }
  function Gt(b) {
    switch (b.status) {
      case "fulfilled":
        return b.value;
      case "rejected":
        throw b.reason;
      default:
        switch (typeof b.status == "string" ? b.then(qt, qt) : (b.status = "pending", b.then(
          function(j) {
            b.status === "pending" && (b.status = "fulfilled", b.value = j);
          },
          function(j) {
            b.status === "pending" && (b.status = "rejected", b.reason = j);
          }
        )), b.status) {
          case "fulfilled":
            return b.value;
          case "rejected":
            throw b.reason;
        }
    }
    throw b;
  }
  function _(b, j, te, ee, De) {
    var Ze = typeof b;
    (Ze === "undefined" || Ze === "boolean") && (b = null);
    var Me = !1;
    if (b === null) Me = !0;
    else
      switch (Ze) {
        case "bigint":
        case "string":
        case "number":
          Me = !0;
          break;
        case "object":
          switch (b.$$typeof) {
            case x:
            case k:
              Me = !0;
              break;
            case me:
              return Me = b._init, _(
                Me(b._payload),
                j,
                te,
                ee,
                De
              );
          }
      }
    if (Me)
      return De = De(b), Me = ee === "" ? "." + Kt(b, 0) : ee, Bt(De) ? (te = "", Me != null && (te = Me.replace(Ve, "$&/") + "/"), _(De, j, te, "", function(qa) {
        return qa;
      })) : De != null && (Yt(De) && (De = pe(
        De,
        te + (De.key == null || b && b.key === De.key ? "" : ("" + De.key).replace(
          Ve,
          "$&/"
        ) + "/") + Me
      )), j.push(De)), 1;
    Me = 0;
    var $t = ee === "" ? "." : ee + ":";
    if (Bt(b))
      for (var gt = 0; gt < b.length; gt++)
        ee = b[gt], Ze = $t + Kt(ee, gt), Me += _(
          ee,
          j,
          te,
          Ze,
          De
        );
    else if (gt = ue(b), typeof gt == "function")
      for (b = gt.call(b), gt = 0; !(ee = b.next()).done; )
        ee = ee.value, Ze = $t + Kt(ee, gt++), Me += _(
          ee,
          j,
          te,
          Ze,
          De
        );
    else if (Ze === "object") {
      if (typeof b.then == "function")
        return _(
          Gt(b),
          j,
          te,
          ee,
          De
        );
      throw j = String(b), Error(
        "Objects are not valid as a React child (found: " + (j === "[object Object]" ? "object with keys {" + Object.keys(b).join(", ") + "}" : j) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Me;
  }
  function Z(b, j, te) {
    if (b == null) return b;
    var ee = [], De = 0;
    return _(b, ee, "", "", function(Ze) {
      return j.call(te, Ze, De++);
    }), ee;
  }
  function ne(b) {
    if (b._status === -1) {
      var j = b._result;
      j = j(), j.then(
        function(te) {
          (b._status === 0 || b._status === -1) && (b._status = 1, b._result = te);
        },
        function(te) {
          (b._status === 0 || b._status === -1) && (b._status = 2, b._result = te);
        }
      ), b._status === -1 && (b._status = 0, b._result = j);
    }
    if (b._status === 1) return b._result.default;
    throw b._result;
  }
  var Oe = typeof reportError == "function" ? reportError : function(b) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var j = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof b == "object" && b !== null && typeof b.message == "string" ? String(b.message) : String(b),
        error: b
      });
      if (!window.dispatchEvent(j)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", b);
      return;
    }
    console.error(b);
  }, Ne = {
    map: Z,
    forEach: function(b, j, te) {
      Z(
        b,
        function() {
          j.apply(this, arguments);
        },
        te
      );
    },
    count: function(b) {
      var j = 0;
      return Z(b, function() {
        j++;
      }), j;
    },
    toArray: function(b) {
      return Z(b, function(j) {
        return j;
      }) || [];
    },
    only: function(b) {
      if (!Yt(b))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return b;
    }
  };
  return ke.Activity = B, ke.Children = Ne, ke.Component = Ue, ke.Fragment = fe, ke.Profiler = P, ke.PureComponent = mt, ke.StrictMode = M, ke.Suspense = le, ke.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = je, ke.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(b) {
      return je.H.useMemoCache(b);
    }
  }, ke.cache = function(b) {
    return function() {
      return b.apply(null, arguments);
    };
  }, ke.cacheSignal = function() {
    return null;
  }, ke.cloneElement = function(b, j, te) {
    if (b == null)
      throw Error(
        "The argument must be a React element, but you passed " + b + "."
      );
    var ee = ie({}, b.props), De = b.key;
    if (j != null)
      for (Ze in j.key !== void 0 && (De = "" + j.key), j)
        !We.call(j, Ze) || Ze === "key" || Ze === "__self" || Ze === "__source" || Ze === "ref" && j.ref === void 0 || (ee[Ze] = j[Ze]);
    var Ze = arguments.length - 2;
    if (Ze === 1) ee.children = te;
    else if (1 < Ze) {
      for (var Me = Array(Ze), $t = 0; $t < Ze; $t++)
        Me[$t] = arguments[$t + 2];
      ee.children = Me;
    }
    return Ct(b.type, De, ee);
  }, ke.createContext = function(b) {
    return b = {
      $$typeof: Te,
      _currentValue: b,
      _currentValue2: b,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, b.Provider = b, b.Consumer = {
      $$typeof: oe,
      _context: b
    }, b;
  }, ke.createElement = function(b, j, te) {
    var ee, De = {}, Ze = null;
    if (j != null)
      for (ee in j.key !== void 0 && (Ze = "" + j.key), j)
        We.call(j, ee) && ee !== "key" && ee !== "__self" && ee !== "__source" && (De[ee] = j[ee]);
    var Me = arguments.length - 2;
    if (Me === 1) De.children = te;
    else if (1 < Me) {
      for (var $t = Array(Me), gt = 0; gt < Me; gt++)
        $t[gt] = arguments[gt + 2];
      De.children = $t;
    }
    if (b && b.defaultProps)
      for (ee in Me = b.defaultProps, Me)
        De[ee] === void 0 && (De[ee] = Me[ee]);
    return Ct(b, Ze, De);
  }, ke.createRef = function() {
    return { current: null };
  }, ke.forwardRef = function(b) {
    return { $$typeof: F, render: b };
  }, ke.isValidElement = Yt, ke.lazy = function(b) {
    return {
      $$typeof: me,
      _payload: { _status: -1, _result: b },
      _init: ne
    };
  }, ke.memo = function(b, j) {
    return {
      $$typeof: V,
      type: b,
      compare: j === void 0 ? null : j
    };
  }, ke.startTransition = function(b) {
    var j = je.T, te = {};
    je.T = te;
    try {
      var ee = b(), De = je.S;
      De !== null && De(te, ee), typeof ee == "object" && ee !== null && typeof ee.then == "function" && ee.then(qt, Oe);
    } catch (Ze) {
      Oe(Ze);
    } finally {
      j !== null && te.types !== null && (j.types = te.types), je.T = j;
    }
  }, ke.unstable_useCacheRefresh = function() {
    return je.H.useCacheRefresh();
  }, ke.use = function(b) {
    return je.H.use(b);
  }, ke.useActionState = function(b, j, te) {
    return je.H.useActionState(b, j, te);
  }, ke.useCallback = function(b, j) {
    return je.H.useCallback(b, j);
  }, ke.useContext = function(b) {
    return je.H.useContext(b);
  }, ke.useDebugValue = function() {
  }, ke.useDeferredValue = function(b, j) {
    return je.H.useDeferredValue(b, j);
  }, ke.useEffect = function(b, j) {
    return je.H.useEffect(b, j);
  }, ke.useEffectEvent = function(b) {
    return je.H.useEffectEvent(b);
  }, ke.useId = function() {
    return je.H.useId();
  }, ke.useImperativeHandle = function(b, j, te) {
    return je.H.useImperativeHandle(b, j, te);
  }, ke.useInsertionEffect = function(b, j) {
    return je.H.useInsertionEffect(b, j);
  }, ke.useLayoutEffect = function(b, j) {
    return je.H.useLayoutEffect(b, j);
  }, ke.useMemo = function(b, j) {
    return je.H.useMemo(b, j);
  }, ke.useOptimistic = function(b, j) {
    return je.H.useOptimistic(b, j);
  }, ke.useReducer = function(b, j, te) {
    return je.H.useReducer(b, j, te);
  }, ke.useRef = function(b) {
    return je.H.useRef(b);
  }, ke.useState = function(b) {
    return je.H.useState(b);
  }, ke.useSyncExternalStore = function(b, j, te) {
    return je.H.useSyncExternalStore(
      b,
      j,
      te
    );
  }, ke.useTransition = function() {
    return je.H.useTransition();
  }, ke.version = "19.2.7", ke;
}
var S0 = { exports: {} };
/**
 * @license React
 * react.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
S0.exports;
var N2;
function DT() {
  return N2 || (N2 = 1, (function(x, k) {
    process.env.NODE_ENV !== "production" && (function() {
      function fe(g, U) {
        Object.defineProperty(oe.prototype, g, {
          get: function() {
            console.warn(
              "%s(...) is deprecated in plain JavaScript React classes. %s",
              U[0],
              U[1]
            );
          }
        });
      }
      function M(g) {
        return g === null || typeof g != "object" ? null : (g = Ri && g[Ri] || g["@@iterator"], typeof g == "function" ? g : null);
      }
      function P(g, U) {
        g = (g = g.constructor) && (g.displayName || g.name) || "ReactClass";
        var ae = g + "." + U;
        Mi[ae] || (console.error(
          "Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.",
          U,
          g
        ), Mi[ae] = !0);
      }
      function oe(g, U, ae) {
        this.props = g, this.context = U, this.refs = vt, this.updater = ae || Ga;
      }
      function Te() {
      }
      function F(g, U, ae) {
        this.props = g, this.context = U, this.refs = vt, this.updater = ae || Ga;
      }
      function le() {
      }
      function V(g) {
        return "" + g;
      }
      function me(g) {
        try {
          V(g);
          var U = !1;
        } catch {
          U = !0;
        }
        if (U) {
          U = console;
          var ae = U.error, ce = typeof Symbol == "function" && Symbol.toStringTag && g[Symbol.toStringTag] || g.constructor.name || "Object";
          return ae.call(
            U,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            ce
          ), V(g);
        }
      }
      function B(g) {
        if (g == null) return null;
        if (typeof g == "function")
          return g.$$typeof === ds ? null : g.displayName || g.name || null;
        if (typeof g == "string") return g;
        switch (g) {
          case b:
            return "Fragment";
          case te:
            return "Profiler";
          case j:
            return "StrictMode";
          case Me:
            return "Suspense";
          case $t:
            return "SuspenseList";
          case de:
            return "Activity";
        }
        if (typeof g == "object")
          switch (typeof g.tag == "number" && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), g.$$typeof) {
            case Ne:
              return "Portal";
            case De:
              return g.displayName || "Context";
            case ee:
              return (g._context.displayName || "Context") + ".Consumer";
            case Ze:
              var U = g.render;
              return g = g.displayName, g || (g = U.displayName || U.name || "", g = g !== "" ? "ForwardRef(" + g + ")" : "ForwardRef"), g;
            case gt:
              return U = g.displayName || null, U !== null ? U : B(g.type) || "Memo";
            case qa:
              U = g._payload, g = g._init;
              try {
                return B(g(U));
              } catch {
              }
          }
        return null;
      }
      function C(g) {
        if (g === b) return "<>";
        if (typeof g == "object" && g !== null && g.$$typeof === qa)
          return "<...>";
        try {
          var U = B(g);
          return U ? "<" + U + ">" : "<...>";
        } catch {
          return "<...>";
        }
      }
      function ue() {
        var g = ge.A;
        return g === null ? null : g.getOwner();
      }
      function xe() {
        return Error("react-stack-top-frame");
      }
      function ie(g) {
        if (Ci.call(g, "key")) {
          var U = Object.getOwnPropertyDescriptor(g, "key").get;
          if (U && U.isReactWarning) return !1;
        }
        return g.key !== void 0;
      }
      function be(g, U) {
        function ae() {
          Sc || (Sc = !0, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            U
          ));
        }
        ae.isReactWarning = !0, Object.defineProperty(g, "key", {
          get: ae,
          configurable: !0
        });
      }
      function Ue() {
        var g = B(this.type);
        return Pr[g] || (Pr[g] = !0, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        )), g = this.props.ref, g !== void 0 ? g : null;
      }
      function Jt(g, U, ae, ce, ve, we) {
        var Se = ae.ref;
        return g = {
          $$typeof: Oe,
          type: g,
          key: U,
          props: ae,
          _owner: ce
        }, (Se !== void 0 ? Se : null) !== null ? Object.defineProperty(g, "ref", {
          enumerable: !1,
          get: Ue
        }) : Object.defineProperty(g, "ref", { enumerable: !1, value: null }), g._store = {}, Object.defineProperty(g._store, "validated", {
          configurable: !1,
          enumerable: !1,
          writable: !0,
          value: 0
        }), Object.defineProperty(g, "_debugInfo", {
          configurable: !1,
          enumerable: !1,
          writable: !0,
          value: null
        }), Object.defineProperty(g, "_debugStack", {
          configurable: !1,
          enumerable: !1,
          writable: !0,
          value: ve
        }), Object.defineProperty(g, "_debugTask", {
          configurable: !1,
          enumerable: !1,
          writable: !0,
          value: we
        }), Object.freeze && (Object.freeze(g.props), Object.freeze(g)), g;
      }
      function mt(g, U) {
        return U = Jt(
          g.type,
          U,
          g.props,
          g._owner,
          g._debugStack,
          g._debugTask
        ), g._store && (U._store.validated = g._store.validated), U;
      }
      function Mt(g) {
        Bt(g) ? g._store && (g._store.validated = 1) : typeof g == "object" && g !== null && g.$$typeof === qa && (g._payload.status === "fulfilled" ? Bt(g._payload.value) && g._payload.value._store && (g._payload.value._store.validated = 1) : g._store && (g._store.validated = 1));
      }
      function Bt(g) {
        return typeof g == "object" && g !== null && g.$$typeof === Oe;
      }
      function qt(g) {
        var U = { "=": "=0", ":": "=2" };
        return "$" + g.replace(/[=:]/g, function(ae) {
          return U[ae];
        });
      }
      function je(g, U) {
        return typeof g == "object" && g !== null && g.key != null ? (me(g.key), qt("" + g.key)) : U.toString(36);
      }
      function We(g) {
        switch (g.status) {
          case "fulfilled":
            return g.value;
          case "rejected":
            throw g.reason;
          default:
            switch (typeof g.status == "string" ? g.then(le, le) : (g.status = "pending", g.then(
              function(U) {
                g.status === "pending" && (g.status = "fulfilled", g.value = U);
              },
              function(U) {
                g.status === "pending" && (g.status = "rejected", g.reason = U);
              }
            )), g.status) {
              case "fulfilled":
                return g.value;
              case "rejected":
                throw g.reason;
            }
        }
        throw g;
      }
      function Ct(g, U, ae, ce, ve) {
        var we = typeof g;
        (we === "undefined" || we === "boolean") && (g = null);
        var Se = !1;
        if (g === null) Se = !0;
        else
          switch (we) {
            case "bigint":
            case "string":
            case "number":
              Se = !0;
              break;
            case "object":
              switch (g.$$typeof) {
                case Oe:
                case Ne:
                  Se = !0;
                  break;
                case qa:
                  return Se = g._init, Ct(
                    Se(g._payload),
                    U,
                    ae,
                    ce,
                    ve
                  );
              }
          }
        if (Se) {
          Se = g, ve = ve(Se);
          var nt = ce === "" ? "." + je(Se, 0) : ce;
          return bc(ve) ? (ae = "", nt != null && (ae = nt.replace(ed, "$&/") + "/"), Ct(ve, U, ae, "", function(la) {
            return la;
          })) : ve != null && (Bt(ve) && (ve.key != null && (Se && Se.key === ve.key || me(ve.key)), ae = mt(
            ve,
            ae + (ve.key == null || Se && Se.key === ve.key ? "" : ("" + ve.key).replace(
              ed,
              "$&/"
            ) + "/") + nt
          ), ce !== "" && Se != null && Bt(Se) && Se.key == null && Se._store && !Se._store.validated && (ae._store.validated = 2), ve = ae), U.push(ve)), 1;
        }
        if (Se = 0, nt = ce === "" ? "." : ce + ":", bc(g))
          for (var Je = 0; Je < g.length; Je++)
            ce = g[Je], we = nt + je(ce, Je), Se += Ct(
              ce,
              U,
              ae,
              we,
              ve
            );
        else if (Je = M(g), typeof Je == "function")
          for (Je === g.entries && (xn || console.warn(
            "Using Maps as children is not supported. Use an array of keyed ReactElements instead."
          ), xn = !0), g = Je.call(g), Je = 0; !(ce = g.next()).done; )
            ce = ce.value, we = nt + je(ce, Je++), Se += Ct(
              ce,
              U,
              ae,
              we,
              ve
            );
        else if (we === "object") {
          if (typeof g.then == "function")
            return Ct(
              We(g),
              U,
              ae,
              ce,
              ve
            );
          throw U = String(g), Error(
            "Objects are not valid as a React child (found: " + (U === "[object Object]" ? "object with keys {" + Object.keys(g).join(", ") + "}" : U) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return Se;
      }
      function pe(g, U, ae) {
        if (g == null) return g;
        var ce = [], ve = 0;
        return Ct(g, ce, "", "", function(we) {
          return U.call(ae, we, ve++);
        }), ce;
      }
      function Yt(g) {
        if (g._status === -1) {
          var U = g._ioInfo;
          U != null && (U.start = U.end = performance.now()), U = g._result;
          var ae = U();
          if (ae.then(
            function(ve) {
              if (g._status === 0 || g._status === -1) {
                g._status = 1, g._result = ve;
                var we = g._ioInfo;
                we != null && (we.end = performance.now()), ae.status === void 0 && (ae.status = "fulfilled", ae.value = ve);
              }
            },
            function(ve) {
              if (g._status === 0 || g._status === -1) {
                g._status = 2, g._result = ve;
                var we = g._ioInfo;
                we != null && (we.end = performance.now()), ae.status === void 0 && (ae.status = "rejected", ae.reason = ve);
              }
            }
          ), U = g._ioInfo, U != null) {
            U.value = ae;
            var ce = ae.displayName;
            typeof ce == "string" && (U.name = ce);
          }
          g._status === -1 && (g._status = 0, g._result = ae);
        }
        if (g._status === 1)
          return U = g._result, U === void 0 && console.error(
            `lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))

Did you accidentally put curly braces around the import?`,
            U
          ), "default" in U || console.error(
            `lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))`,
            U
          ), U.default;
        throw g._result;
      }
      function Ae() {
        var g = ge.H;
        return g === null && console.error(
          `Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.`
        ), g;
      }
      function Ve() {
        ge.asyncTransitions--;
      }
      function Kt(g) {
        if (Ec === null)
          try {
            var U = ("require" + Math.random()).slice(0, 7);
            Ec = (x && x[U]).call(
              x,
              "timers"
            ).setImmediate;
          } catch {
            Ec = function(ce) {
              hs === !1 && (hs = !0, typeof MessageChannel > "u" && console.error(
                "This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."
              ));
              var ve = new MessageChannel();
              ve.port1.onmessage = ce, ve.port2.postMessage(void 0);
            };
          }
        return Ec(g);
      }
      function Gt(g) {
        return 1 < g.length && typeof AggregateError == "function" ? new AggregateError(g) : g[0];
      }
      function _(g, U) {
        U !== hn - 1 && console.error(
          "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. "
        ), hn = U;
      }
      function Z(g, U, ae) {
        var ce = ge.actQueue;
        if (ce !== null)
          if (ce.length !== 0)
            try {
              ne(ce), Kt(function() {
                return Z(g, U, ae);
              });
              return;
            } catch (ve) {
              ge.thrownErrors.push(ve);
            }
          else ge.actQueue = null;
        0 < ge.thrownErrors.length ? (ce = Gt(ge.thrownErrors), ge.thrownErrors.length = 0, ae(ce)) : U(g);
      }
      function ne(g) {
        if (!La) {
          La = !0;
          var U = 0;
          try {
            for (; U < g.length; U++) {
              var ae = g[U];
              do {
                ge.didUsePromise = !1;
                var ce = ae(!1);
                if (ce !== null) {
                  if (ge.didUsePromise) {
                    g[U] = ae, g.splice(0, U);
                    return;
                  }
                  ae = ce;
                } else break;
              } while (!0);
            }
            g.length = 0;
          } catch (ve) {
            g.splice(0, U + 1), ge.thrownErrors.push(ve);
          } finally {
            La = !1;
          }
        }
      }
      typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var Oe = Symbol.for("react.transitional.element"), Ne = Symbol.for("react.portal"), b = Symbol.for("react.fragment"), j = Symbol.for("react.strict_mode"), te = Symbol.for("react.profiler"), ee = Symbol.for("react.consumer"), De = Symbol.for("react.context"), Ze = Symbol.for("react.forward_ref"), Me = Symbol.for("react.suspense"), $t = Symbol.for("react.suspense_list"), gt = Symbol.for("react.memo"), qa = Symbol.for("react.lazy"), de = Symbol.for("react.activity"), Ri = Symbol.iterator, Mi = {}, Ga = {
        isMounted: function() {
          return !1;
        },
        enqueueForceUpdate: function(g) {
          P(g, "forceUpdate");
        },
        enqueueReplaceState: function(g) {
          P(g, "replaceState");
        },
        enqueueSetState: function(g) {
          P(g, "setState");
        }
      }, cu = Object.assign, vt = {};
      Object.freeze(vt), oe.prototype.isReactComponent = {}, oe.prototype.setState = function(g, U) {
        if (typeof g != "object" && typeof g != "function" && g != null)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, g, U, "setState");
      }, oe.prototype.forceUpdate = function(g) {
        this.updater.enqueueForceUpdate(this, g, "forceUpdate");
      };
      var ta = {
        isMounted: [
          "isMounted",
          "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
        ],
        replaceState: [
          "replaceState",
          "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
        ]
      };
      for (xi in ta)
        ta.hasOwnProperty(xi) && fe(xi, ta[xi]);
      Te.prototype = oe.prototype, ta = F.prototype = new Te(), ta.constructor = F, cu(ta, oe.prototype), ta.isPureReactComponent = !0;
      var bc = Array.isArray, ds = Symbol.for("react.client.reference"), ge = {
        H: null,
        A: null,
        T: null,
        S: null,
        actQueue: null,
        asyncTransitions: 0,
        isBatchingLegacy: !1,
        didScheduleLegacyUpdate: !1,
        didUsePromise: !1,
        thrownErrors: [],
        getCurrentStack: null,
        recentlyCreatedOwnerStacks: 0
      }, Ci = Object.prototype.hasOwnProperty, ou = console.createTask ? console.createTask : function() {
        return null;
      };
      ta = {
        react_stack_bottom_frame: function(g) {
          return g();
        }
      };
      var Sc, Sl, Pr = {}, xo = ta.react_stack_bottom_frame.bind(
        ta,
        xe
      )(), Uo = ou(C(xe)), xn = !1, ed = /\/+/g, No = typeof reportError == "function" ? reportError : function(g) {
        if (typeof window == "object" && typeof window.ErrorEvent == "function") {
          var U = new window.ErrorEvent("error", {
            bubbles: !0,
            cancelable: !0,
            message: typeof g == "object" && g !== null && typeof g.message == "string" ? String(g.message) : String(g),
            error: g
          });
          if (!window.dispatchEvent(U)) return;
        } else if (typeof process == "object" && typeof process.emit == "function") {
          process.emit("uncaughtException", g);
          return;
        }
        console.error(g);
      }, hs = !1, Ec = null, hn = 0, zl = !1, La = !1, Nl = typeof queueMicrotask == "function" ? function(g) {
        queueMicrotask(function() {
          return queueMicrotask(g);
        });
      } : Kt;
      ta = Object.freeze({
        __proto__: null,
        c: function(g) {
          return Ae().useMemoCache(g);
        }
      });
      var xi = {
        map: pe,
        forEach: function(g, U, ae) {
          pe(
            g,
            function() {
              U.apply(this, arguments);
            },
            ae
          );
        },
        count: function(g) {
          var U = 0;
          return pe(g, function() {
            U++;
          }), U;
        },
        toArray: function(g) {
          return pe(g, function(U) {
            return U;
          }) || [];
        },
        only: function(g) {
          if (!Bt(g))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return g;
        }
      };
      k.Activity = de, k.Children = xi, k.Component = oe, k.Fragment = b, k.Profiler = te, k.PureComponent = F, k.StrictMode = j, k.Suspense = Me, k.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ge, k.__COMPILER_RUNTIME = ta, k.act = function(g) {
        var U = ge.actQueue, ae = hn;
        hn++;
        var ce = ge.actQueue = U !== null ? U : [], ve = !1;
        try {
          var we = g();
        } catch (Je) {
          ge.thrownErrors.push(Je);
        }
        if (0 < ge.thrownErrors.length)
          throw _(U, ae), g = Gt(ge.thrownErrors), ge.thrownErrors.length = 0, g;
        if (we !== null && typeof we == "object" && typeof we.then == "function") {
          var Se = we;
          return Nl(function() {
            ve || zl || (zl = !0, console.error(
              "You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"
            ));
          }), {
            then: function(Je, la) {
              ve = !0, Se.then(
                function(mn) {
                  if (_(U, ae), ae === 0) {
                    try {
                      ne(ce), Kt(function() {
                        return Z(
                          mn,
                          Je,
                          la
                        );
                      });
                    } catch (Ho) {
                      ge.thrownErrors.push(Ho);
                    }
                    if (0 < ge.thrownErrors.length) {
                      var Ui = Gt(
                        ge.thrownErrors
                      );
                      ge.thrownErrors.length = 0, la(Ui);
                    }
                  } else Je(mn);
                },
                function(mn) {
                  _(U, ae), 0 < ge.thrownErrors.length && (mn = Gt(
                    ge.thrownErrors
                  ), ge.thrownErrors.length = 0), la(mn);
                }
              );
            }
          };
        }
        var nt = we;
        if (_(U, ae), ae === 0 && (ne(ce), ce.length !== 0 && Nl(function() {
          ve || zl || (zl = !0, console.error(
            "A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"
          ));
        }), ge.actQueue = null), 0 < ge.thrownErrors.length)
          throw g = Gt(ge.thrownErrors), ge.thrownErrors.length = 0, g;
        return {
          then: function(Je, la) {
            ve = !0, ae === 0 ? (ge.actQueue = ce, Kt(function() {
              return Z(
                nt,
                Je,
                la
              );
            })) : Je(nt);
          }
        };
      }, k.cache = function(g) {
        return function() {
          return g.apply(null, arguments);
        };
      }, k.cacheSignal = function() {
        return null;
      }, k.captureOwnerStack = function() {
        var g = ge.getCurrentStack;
        return g === null ? null : g();
      }, k.cloneElement = function(g, U, ae) {
        if (g == null)
          throw Error(
            "The argument must be a React element, but you passed " + g + "."
          );
        var ce = cu({}, g.props), ve = g.key, we = g._owner;
        if (U != null) {
          var Se;
          e: {
            if (Ci.call(U, "ref") && (Se = Object.getOwnPropertyDescriptor(
              U,
              "ref"
            ).get) && Se.isReactWarning) {
              Se = !1;
              break e;
            }
            Se = U.ref !== void 0;
          }
          Se && (we = ue()), ie(U) && (me(U.key), ve = "" + U.key);
          for (nt in U)
            !Ci.call(U, nt) || nt === "key" || nt === "__self" || nt === "__source" || nt === "ref" && U.ref === void 0 || (ce[nt] = U[nt]);
        }
        var nt = arguments.length - 2;
        if (nt === 1) ce.children = ae;
        else if (1 < nt) {
          Se = Array(nt);
          for (var Je = 0; Je < nt; Je++)
            Se[Je] = arguments[Je + 2];
          ce.children = Se;
        }
        for (ce = Jt(
          g.type,
          ve,
          ce,
          we,
          g._debugStack,
          g._debugTask
        ), ve = 2; ve < arguments.length; ve++)
          Mt(arguments[ve]);
        return ce;
      }, k.createContext = function(g) {
        return g = {
          $$typeof: De,
          _currentValue: g,
          _currentValue2: g,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        }, g.Provider = g, g.Consumer = {
          $$typeof: ee,
          _context: g
        }, g._currentRenderer = null, g._currentRenderer2 = null, g;
      }, k.createElement = function(g, U, ae) {
        for (var ce = 2; ce < arguments.length; ce++)
          Mt(arguments[ce]);
        ce = {};
        var ve = null;
        if (U != null)
          for (Je in Sl || !("__self" in U) || "key" in U || (Sl = !0, console.warn(
            "Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform"
          )), ie(U) && (me(U.key), ve = "" + U.key), U)
            Ci.call(U, Je) && Je !== "key" && Je !== "__self" && Je !== "__source" && (ce[Je] = U[Je]);
        var we = arguments.length - 2;
        if (we === 1) ce.children = ae;
        else if (1 < we) {
          for (var Se = Array(we), nt = 0; nt < we; nt++)
            Se[nt] = arguments[nt + 2];
          Object.freeze && Object.freeze(Se), ce.children = Se;
        }
        if (g && g.defaultProps)
          for (Je in we = g.defaultProps, we)
            ce[Je] === void 0 && (ce[Je] = we[Je]);
        ve && be(
          ce,
          typeof g == "function" ? g.displayName || g.name || "Unknown" : g
        );
        var Je = 1e4 > ge.recentlyCreatedOwnerStacks++;
        return Jt(
          g,
          ve,
          ce,
          ue(),
          Je ? Error("react-stack-top-frame") : xo,
          Je ? ou(C(g)) : Uo
        );
      }, k.createRef = function() {
        var g = { current: null };
        return Object.seal(g), g;
      }, k.forwardRef = function(g) {
        g != null && g.$$typeof === gt ? console.error(
          "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))."
        ) : typeof g != "function" ? console.error(
          "forwardRef requires a render function but was given %s.",
          g === null ? "null" : typeof g
        ) : g.length !== 0 && g.length !== 2 && console.error(
          "forwardRef render functions accept exactly two parameters: props and ref. %s",
          g.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined."
        ), g != null && g.defaultProps != null && console.error(
          "forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?"
        );
        var U = { $$typeof: Ze, render: g }, ae;
        return Object.defineProperty(U, "displayName", {
          enumerable: !1,
          configurable: !0,
          get: function() {
            return ae;
          },
          set: function(ce) {
            ae = ce, g.name || g.displayName || (Object.defineProperty(g, "name", { value: ce }), g.displayName = ce);
          }
        }), U;
      }, k.isValidElement = Bt, k.lazy = function(g) {
        g = { _status: -1, _result: g };
        var U = {
          $$typeof: qa,
          _payload: g,
          _init: Yt
        }, ae = {
          name: "lazy",
          start: -1,
          end: -1,
          value: null,
          owner: null,
          debugStack: Error("react-stack-top-frame"),
          debugTask: console.createTask ? console.createTask("lazy()") : null
        };
        return g._ioInfo = ae, U._debugInfo = [{ awaited: ae }], U;
      }, k.memo = function(g, U) {
        g == null && console.error(
          "memo: The first argument must be a component. Instead received: %s",
          g === null ? "null" : typeof g
        ), U = {
          $$typeof: gt,
          type: g,
          compare: U === void 0 ? null : U
        };
        var ae;
        return Object.defineProperty(U, "displayName", {
          enumerable: !1,
          configurable: !0,
          get: function() {
            return ae;
          },
          set: function(ce) {
            ae = ce, g.name || g.displayName || (Object.defineProperty(g, "name", { value: ce }), g.displayName = ce);
          }
        }), U;
      }, k.startTransition = function(g) {
        var U = ge.T, ae = {};
        ae._updatedFibers = /* @__PURE__ */ new Set(), ge.T = ae;
        try {
          var ce = g(), ve = ge.S;
          ve !== null && ve(ae, ce), typeof ce == "object" && ce !== null && typeof ce.then == "function" && (ge.asyncTransitions++, ce.then(Ve, Ve), ce.then(le, No));
        } catch (we) {
          No(we);
        } finally {
          U === null && ae._updatedFibers && (g = ae._updatedFibers.size, ae._updatedFibers.clear(), 10 < g && console.warn(
            "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
          )), U !== null && ae.types !== null && (U.types !== null && U.types !== ae.types && console.error(
            "We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."
          ), U.types = ae.types), ge.T = U;
        }
      }, k.unstable_useCacheRefresh = function() {
        return Ae().useCacheRefresh();
      }, k.use = function(g) {
        return Ae().use(g);
      }, k.useActionState = function(g, U, ae) {
        return Ae().useActionState(
          g,
          U,
          ae
        );
      }, k.useCallback = function(g, U) {
        return Ae().useCallback(g, U);
      }, k.useContext = function(g) {
        var U = Ae();
        return g.$$typeof === ee && console.error(
          "Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?"
        ), U.useContext(g);
      }, k.useDebugValue = function(g, U) {
        return Ae().useDebugValue(g, U);
      }, k.useDeferredValue = function(g, U) {
        return Ae().useDeferredValue(g, U);
      }, k.useEffect = function(g, U) {
        return g == null && console.warn(
          "React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        ), Ae().useEffect(g, U);
      }, k.useEffectEvent = function(g) {
        return Ae().useEffectEvent(g);
      }, k.useId = function() {
        return Ae().useId();
      }, k.useImperativeHandle = function(g, U, ae) {
        return Ae().useImperativeHandle(g, U, ae);
      }, k.useInsertionEffect = function(g, U) {
        return g == null && console.warn(
          "React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        ), Ae().useInsertionEffect(g, U);
      }, k.useLayoutEffect = function(g, U) {
        return g == null && console.warn(
          "React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        ), Ae().useLayoutEffect(g, U);
      }, k.useMemo = function(g, U) {
        return Ae().useMemo(g, U);
      }, k.useOptimistic = function(g, U) {
        return Ae().useOptimistic(g, U);
      }, k.useReducer = function(g, U, ae) {
        return Ae().useReducer(g, U, ae);
      }, k.useRef = function(g) {
        return Ae().useRef(g);
      }, k.useState = function(g) {
        return Ae().useState(g);
      }, k.useSyncExternalStore = function(g, U, ae) {
        return Ae().useSyncExternalStore(
          g,
          U,
          ae
        );
      }, k.useTransition = function() {
        return Ae().useTransition();
      }, k.version = "19.2.7", typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  })(S0, S0.exports)), S0.exports;
}
var H2;
function Sm() {
  return H2 || (H2 = 1, process.env.NODE_ENV === "production" ? Qv.exports = zT() : Qv.exports = DT()), Qv.exports;
}
/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var j2;
function _T() {
  return j2 || (j2 = 1, process.env.NODE_ENV !== "production" && (function() {
    function x(b) {
      if (b == null) return null;
      if (typeof b == "function")
        return b.$$typeof === Yt ? null : b.displayName || b.name || null;
      if (typeof b == "string") return b;
      switch (b) {
        case be:
          return "Fragment";
        case Jt:
          return "Profiler";
        case Ue:
          return "StrictMode";
        case qt:
          return "Suspense";
        case je:
          return "SuspenseList";
        case pe:
          return "Activity";
      }
      if (typeof b == "object")
        switch (typeof b.tag == "number" && console.error(
          "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
        ), b.$$typeof) {
          case ie:
            return "Portal";
          case Mt:
            return b.displayName || "Context";
          case mt:
            return (b._context.displayName || "Context") + ".Consumer";
          case Bt:
            var j = b.render;
            return b = b.displayName, b || (b = j.displayName || j.name || "", b = b !== "" ? "ForwardRef(" + b + ")" : "ForwardRef"), b;
          case We:
            return j = b.displayName || null, j !== null ? j : x(b.type) || "Memo";
          case Ct:
            j = b._payload, b = b._init;
            try {
              return x(b(j));
            } catch {
            }
        }
      return null;
    }
    function k(b) {
      return "" + b;
    }
    function fe(b) {
      try {
        k(b);
        var j = !1;
      } catch {
        j = !0;
      }
      if (j) {
        j = console;
        var te = j.error, ee = typeof Symbol == "function" && Symbol.toStringTag && b[Symbol.toStringTag] || b.constructor.name || "Object";
        return te.call(
          j,
          "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
          ee
        ), k(b);
      }
    }
    function M(b) {
      if (b === be) return "<>";
      if (typeof b == "object" && b !== null && b.$$typeof === Ct)
        return "<...>";
      try {
        var j = x(b);
        return j ? "<" + j + ">" : "<...>";
      } catch {
        return "<...>";
      }
    }
    function P() {
      var b = Ae.A;
      return b === null ? null : b.getOwner();
    }
    function oe() {
      return Error("react-stack-top-frame");
    }
    function Te(b) {
      if (Ve.call(b, "key")) {
        var j = Object.getOwnPropertyDescriptor(b, "key").get;
        if (j && j.isReactWarning) return !1;
      }
      return b.key !== void 0;
    }
    function F(b, j) {
      function te() {
        _ || (_ = !0, console.error(
          "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
          j
        ));
      }
      te.isReactWarning = !0, Object.defineProperty(b, "key", {
        get: te,
        configurable: !0
      });
    }
    function le() {
      var b = x(this.type);
      return Z[b] || (Z[b] = !0, console.error(
        "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
      )), b = this.props.ref, b !== void 0 ? b : null;
    }
    function V(b, j, te, ee, De, Ze) {
      var Me = te.ref;
      return b = {
        $$typeof: xe,
        type: b,
        key: j,
        props: te,
        _owner: ee
      }, (Me !== void 0 ? Me : null) !== null ? Object.defineProperty(b, "ref", {
        enumerable: !1,
        get: le
      }) : Object.defineProperty(b, "ref", { enumerable: !1, value: null }), b._store = {}, Object.defineProperty(b._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: 0
      }), Object.defineProperty(b, "_debugInfo", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: null
      }), Object.defineProperty(b, "_debugStack", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: De
      }), Object.defineProperty(b, "_debugTask", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: Ze
      }), Object.freeze && (Object.freeze(b.props), Object.freeze(b)), b;
    }
    function me(b, j, te, ee, De, Ze) {
      var Me = j.children;
      if (Me !== void 0)
        if (ee)
          if (Kt(Me)) {
            for (ee = 0; ee < Me.length; ee++)
              B(Me[ee]);
            Object.freeze && Object.freeze(Me);
          } else
            console.error(
              "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
            );
        else B(Me);
      if (Ve.call(j, "key")) {
        Me = x(b);
        var $t = Object.keys(j).filter(function(qa) {
          return qa !== "key";
        });
        ee = 0 < $t.length ? "{key: someKey, " + $t.join(": ..., ") + ": ...}" : "{key: someKey}", Ne[Me + ee] || ($t = 0 < $t.length ? "{" + $t.join(": ..., ") + ": ...}" : "{}", console.error(
          `A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`,
          ee,
          Me,
          $t,
          Me
        ), Ne[Me + ee] = !0);
      }
      if (Me = null, te !== void 0 && (fe(te), Me = "" + te), Te(j) && (fe(j.key), Me = "" + j.key), "key" in j) {
        te = {};
        for (var gt in j)
          gt !== "key" && (te[gt] = j[gt]);
      } else te = j;
      return Me && F(
        te,
        typeof b == "function" ? b.displayName || b.name || "Unknown" : b
      ), V(
        b,
        Me,
        te,
        P(),
        De,
        Ze
      );
    }
    function B(b) {
      C(b) ? b._store && (b._store.validated = 1) : typeof b == "object" && b !== null && b.$$typeof === Ct && (b._payload.status === "fulfilled" ? C(b._payload.value) && b._payload.value._store && (b._payload.value._store.validated = 1) : b._store && (b._store.validated = 1));
    }
    function C(b) {
      return typeof b == "object" && b !== null && b.$$typeof === xe;
    }
    var ue = Sm(), xe = Symbol.for("react.transitional.element"), ie = Symbol.for("react.portal"), be = Symbol.for("react.fragment"), Ue = Symbol.for("react.strict_mode"), Jt = Symbol.for("react.profiler"), mt = Symbol.for("react.consumer"), Mt = Symbol.for("react.context"), Bt = Symbol.for("react.forward_ref"), qt = Symbol.for("react.suspense"), je = Symbol.for("react.suspense_list"), We = Symbol.for("react.memo"), Ct = Symbol.for("react.lazy"), pe = Symbol.for("react.activity"), Yt = Symbol.for("react.client.reference"), Ae = ue.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Ve = Object.prototype.hasOwnProperty, Kt = Array.isArray, Gt = console.createTask ? console.createTask : function() {
      return null;
    };
    ue = {
      react_stack_bottom_frame: function(b) {
        return b();
      }
    };
    var _, Z = {}, ne = ue.react_stack_bottom_frame.bind(
      ue,
      oe
    )(), Oe = Gt(M(oe)), Ne = {};
    g0.Fragment = be, g0.jsx = function(b, j, te) {
      var ee = 1e4 > Ae.recentlyCreatedOwnerStacks++;
      return me(
        b,
        j,
        te,
        !1,
        ee ? Error("react-stack-top-frame") : ne,
        ee ? Gt(M(b)) : Oe
      );
    }, g0.jsxs = function(b, j, te) {
      var ee = 1e4 > Ae.recentlyCreatedOwnerStacks++;
      return me(
        b,
        j,
        te,
        !0,
        ee ? Error("react-stack-top-frame") : ne,
        ee ? Gt(M(b)) : Oe
      );
    };
  })()), g0;
}
var w2;
function RT() {
  return w2 || (w2 = 1, process.env.NODE_ENV === "production" ? Xv.exports = OT() : Xv.exports = _T()), Xv.exports;
}
var K = RT(), Vv = { exports: {} }, v0 = {}, Zv = { exports: {} }, bb = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var B2;
function MT() {
  return B2 || (B2 = 1, (function(x) {
    function k(_, Z) {
      var ne = _.length;
      _.push(Z);
      e: for (; 0 < ne; ) {
        var Oe = ne - 1 >>> 1, Ne = _[Oe];
        if (0 < P(Ne, Z))
          _[Oe] = Z, _[ne] = Ne, ne = Oe;
        else break e;
      }
    }
    function fe(_) {
      return _.length === 0 ? null : _[0];
    }
    function M(_) {
      if (_.length === 0) return null;
      var Z = _[0], ne = _.pop();
      if (ne !== Z) {
        _[0] = ne;
        e: for (var Oe = 0, Ne = _.length, b = Ne >>> 1; Oe < b; ) {
          var j = 2 * (Oe + 1) - 1, te = _[j], ee = j + 1, De = _[ee];
          if (0 > P(te, ne))
            ee < Ne && 0 > P(De, te) ? (_[Oe] = De, _[ee] = ne, Oe = ee) : (_[Oe] = te, _[j] = ne, Oe = j);
          else if (ee < Ne && 0 > P(De, ne))
            _[Oe] = De, _[ee] = ne, Oe = ee;
          else break e;
        }
      }
      return Z;
    }
    function P(_, Z) {
      var ne = _.sortIndex - Z.sortIndex;
      return ne !== 0 ? ne : _.id - Z.id;
    }
    if (x.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var oe = performance;
      x.unstable_now = function() {
        return oe.now();
      };
    } else {
      var Te = Date, F = Te.now();
      x.unstable_now = function() {
        return Te.now() - F;
      };
    }
    var le = [], V = [], me = 1, B = null, C = 3, ue = !1, xe = !1, ie = !1, be = !1, Ue = typeof setTimeout == "function" ? setTimeout : null, Jt = typeof clearTimeout == "function" ? clearTimeout : null, mt = typeof setImmediate < "u" ? setImmediate : null;
    function Mt(_) {
      for (var Z = fe(V); Z !== null; ) {
        if (Z.callback === null) M(V);
        else if (Z.startTime <= _)
          M(V), Z.sortIndex = Z.expirationTime, k(le, Z);
        else break;
        Z = fe(V);
      }
    }
    function Bt(_) {
      if (ie = !1, Mt(_), !xe)
        if (fe(le) !== null)
          xe = !0, qt || (qt = !0, Ae());
        else {
          var Z = fe(V);
          Z !== null && Gt(Bt, Z.startTime - _);
        }
    }
    var qt = !1, je = -1, We = 5, Ct = -1;
    function pe() {
      return be ? !0 : !(x.unstable_now() - Ct < We);
    }
    function Yt() {
      if (be = !1, qt) {
        var _ = x.unstable_now();
        Ct = _;
        var Z = !0;
        try {
          e: {
            xe = !1, ie && (ie = !1, Jt(je), je = -1), ue = !0;
            var ne = C;
            try {
              t: {
                for (Mt(_), B = fe(le); B !== null && !(B.expirationTime > _ && pe()); ) {
                  var Oe = B.callback;
                  if (typeof Oe == "function") {
                    B.callback = null, C = B.priorityLevel;
                    var Ne = Oe(
                      B.expirationTime <= _
                    );
                    if (_ = x.unstable_now(), typeof Ne == "function") {
                      B.callback = Ne, Mt(_), Z = !0;
                      break t;
                    }
                    B === fe(le) && M(le), Mt(_);
                  } else M(le);
                  B = fe(le);
                }
                if (B !== null) Z = !0;
                else {
                  var b = fe(V);
                  b !== null && Gt(
                    Bt,
                    b.startTime - _
                  ), Z = !1;
                }
              }
              break e;
            } finally {
              B = null, C = ne, ue = !1;
            }
            Z = void 0;
          }
        } finally {
          Z ? Ae() : qt = !1;
        }
      }
    }
    var Ae;
    if (typeof mt == "function")
      Ae = function() {
        mt(Yt);
      };
    else if (typeof MessageChannel < "u") {
      var Ve = new MessageChannel(), Kt = Ve.port2;
      Ve.port1.onmessage = Yt, Ae = function() {
        Kt.postMessage(null);
      };
    } else
      Ae = function() {
        Ue(Yt, 0);
      };
    function Gt(_, Z) {
      je = Ue(function() {
        _(x.unstable_now());
      }, Z);
    }
    x.unstable_IdlePriority = 5, x.unstable_ImmediatePriority = 1, x.unstable_LowPriority = 4, x.unstable_NormalPriority = 3, x.unstable_Profiling = null, x.unstable_UserBlockingPriority = 2, x.unstable_cancelCallback = function(_) {
      _.callback = null;
    }, x.unstable_forceFrameRate = function(_) {
      0 > _ || 125 < _ ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : We = 0 < _ ? Math.floor(1e3 / _) : 5;
    }, x.unstable_getCurrentPriorityLevel = function() {
      return C;
    }, x.unstable_next = function(_) {
      switch (C) {
        case 1:
        case 2:
        case 3:
          var Z = 3;
          break;
        default:
          Z = C;
      }
      var ne = C;
      C = Z;
      try {
        return _();
      } finally {
        C = ne;
      }
    }, x.unstable_requestPaint = function() {
      be = !0;
    }, x.unstable_runWithPriority = function(_, Z) {
      switch (_) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          _ = 3;
      }
      var ne = C;
      C = _;
      try {
        return Z();
      } finally {
        C = ne;
      }
    }, x.unstable_scheduleCallback = function(_, Z, ne) {
      var Oe = x.unstable_now();
      switch (typeof ne == "object" && ne !== null ? (ne = ne.delay, ne = typeof ne == "number" && 0 < ne ? Oe + ne : Oe) : ne = Oe, _) {
        case 1:
          var Ne = -1;
          break;
        case 2:
          Ne = 250;
          break;
        case 5:
          Ne = 1073741823;
          break;
        case 4:
          Ne = 1e4;
          break;
        default:
          Ne = 5e3;
      }
      return Ne = ne + Ne, _ = {
        id: me++,
        callback: Z,
        priorityLevel: _,
        startTime: ne,
        expirationTime: Ne,
        sortIndex: -1
      }, ne > Oe ? (_.sortIndex = ne, k(V, _), fe(le) === null && _ === fe(V) && (ie ? (Jt(je), je = -1) : ie = !0, Gt(Bt, ne - Oe))) : (_.sortIndex = Ne, k(le, _), xe || ue || (xe = !0, qt || (qt = !0, Ae()))), _;
    }, x.unstable_shouldYield = pe, x.unstable_wrapCallback = function(_) {
      var Z = C;
      return function() {
        var ne = C;
        C = Z;
        try {
          return _.apply(this, arguments);
        } finally {
          C = ne;
        }
      };
    };
  })(bb)), bb;
}
var Sb = {};
/**
 * @license React
 * scheduler.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Y2;
function CT() {
  return Y2 || (Y2 = 1, (function(x) {
    process.env.NODE_ENV !== "production" && (function() {
      function k() {
        if (Bt = !1, Ct) {
          var _ = x.unstable_now();
          Ae = _;
          var Z = !0;
          try {
            e: {
              mt = !1, Mt && (Mt = !1, je(pe), pe = -1), Jt = !0;
              var ne = Ue;
              try {
                t: {
                  for (Te(_), be = M(ue); be !== null && !(be.expirationTime > _ && le()); ) {
                    var Oe = be.callback;
                    if (typeof Oe == "function") {
                      be.callback = null, Ue = be.priorityLevel;
                      var Ne = Oe(
                        be.expirationTime <= _
                      );
                      if (_ = x.unstable_now(), typeof Ne == "function") {
                        be.callback = Ne, Te(_), Z = !0;
                        break t;
                      }
                      be === M(ue) && P(ue), Te(_);
                    } else P(ue);
                    be = M(ue);
                  }
                  if (be !== null) Z = !0;
                  else {
                    var b = M(xe);
                    b !== null && V(
                      F,
                      b.startTime - _
                    ), Z = !1;
                  }
                }
                break e;
              } finally {
                be = null, Ue = ne, Jt = !1;
              }
              Z = void 0;
            }
          } finally {
            Z ? Ve() : Ct = !1;
          }
        }
      }
      function fe(_, Z) {
        var ne = _.length;
        _.push(Z);
        e: for (; 0 < ne; ) {
          var Oe = ne - 1 >>> 1, Ne = _[Oe];
          if (0 < oe(Ne, Z))
            _[Oe] = Z, _[ne] = Ne, ne = Oe;
          else break e;
        }
      }
      function M(_) {
        return _.length === 0 ? null : _[0];
      }
      function P(_) {
        if (_.length === 0) return null;
        var Z = _[0], ne = _.pop();
        if (ne !== Z) {
          _[0] = ne;
          e: for (var Oe = 0, Ne = _.length, b = Ne >>> 1; Oe < b; ) {
            var j = 2 * (Oe + 1) - 1, te = _[j], ee = j + 1, De = _[ee];
            if (0 > oe(te, ne))
              ee < Ne && 0 > oe(De, te) ? (_[Oe] = De, _[ee] = ne, Oe = ee) : (_[Oe] = te, _[j] = ne, Oe = j);
            else if (ee < Ne && 0 > oe(De, ne))
              _[Oe] = De, _[ee] = ne, Oe = ee;
            else break e;
          }
        }
        return Z;
      }
      function oe(_, Z) {
        var ne = _.sortIndex - Z.sortIndex;
        return ne !== 0 ? ne : _.id - Z.id;
      }
      function Te(_) {
        for (var Z = M(xe); Z !== null; ) {
          if (Z.callback === null) P(xe);
          else if (Z.startTime <= _)
            P(xe), Z.sortIndex = Z.expirationTime, fe(ue, Z);
          else break;
          Z = M(xe);
        }
      }
      function F(_) {
        if (Mt = !1, Te(_), !mt)
          if (M(ue) !== null)
            mt = !0, Ct || (Ct = !0, Ve());
          else {
            var Z = M(xe);
            Z !== null && V(
              F,
              Z.startTime - _
            );
          }
      }
      function le() {
        return Bt ? !0 : !(x.unstable_now() - Ae < Yt);
      }
      function V(_, Z) {
        pe = qt(function() {
          _(x.unstable_now());
        }, Z);
      }
      if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error()), x.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
        var me = performance;
        x.unstable_now = function() {
          return me.now();
        };
      } else {
        var B = Date, C = B.now();
        x.unstable_now = function() {
          return B.now() - C;
        };
      }
      var ue = [], xe = [], ie = 1, be = null, Ue = 3, Jt = !1, mt = !1, Mt = !1, Bt = !1, qt = typeof setTimeout == "function" ? setTimeout : null, je = typeof clearTimeout == "function" ? clearTimeout : null, We = typeof setImmediate < "u" ? setImmediate : null, Ct = !1, pe = -1, Yt = 5, Ae = -1;
      if (typeof We == "function")
        var Ve = function() {
          We(k);
        };
      else if (typeof MessageChannel < "u") {
        var Kt = new MessageChannel(), Gt = Kt.port2;
        Kt.port1.onmessage = k, Ve = function() {
          Gt.postMessage(null);
        };
      } else
        Ve = function() {
          qt(k, 0);
        };
      x.unstable_IdlePriority = 5, x.unstable_ImmediatePriority = 1, x.unstable_LowPriority = 4, x.unstable_NormalPriority = 3, x.unstable_Profiling = null, x.unstable_UserBlockingPriority = 2, x.unstable_cancelCallback = function(_) {
        _.callback = null;
      }, x.unstable_forceFrameRate = function(_) {
        0 > _ || 125 < _ ? console.error(
          "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
        ) : Yt = 0 < _ ? Math.floor(1e3 / _) : 5;
      }, x.unstable_getCurrentPriorityLevel = function() {
        return Ue;
      }, x.unstable_next = function(_) {
        switch (Ue) {
          case 1:
          case 2:
          case 3:
            var Z = 3;
            break;
          default:
            Z = Ue;
        }
        var ne = Ue;
        Ue = Z;
        try {
          return _();
        } finally {
          Ue = ne;
        }
      }, x.unstable_requestPaint = function() {
        Bt = !0;
      }, x.unstable_runWithPriority = function(_, Z) {
        switch (_) {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
            break;
          default:
            _ = 3;
        }
        var ne = Ue;
        Ue = _;
        try {
          return Z();
        } finally {
          Ue = ne;
        }
      }, x.unstable_scheduleCallback = function(_, Z, ne) {
        var Oe = x.unstable_now();
        switch (typeof ne == "object" && ne !== null ? (ne = ne.delay, ne = typeof ne == "number" && 0 < ne ? Oe + ne : Oe) : ne = Oe, _) {
          case 1:
            var Ne = -1;
            break;
          case 2:
            Ne = 250;
            break;
          case 5:
            Ne = 1073741823;
            break;
          case 4:
            Ne = 1e4;
            break;
          default:
            Ne = 5e3;
        }
        return Ne = ne + Ne, _ = {
          id: ie++,
          callback: Z,
          priorityLevel: _,
          startTime: ne,
          expirationTime: Ne,
          sortIndex: -1
        }, ne > Oe ? (_.sortIndex = ne, fe(xe, _), M(ue) === null && _ === M(xe) && (Mt ? (je(pe), pe = -1) : Mt = !0, V(F, ne - Oe))) : (_.sortIndex = Ne, fe(ue, _), mt || Jt || (mt = !0, Ct || (Ct = !0, Ve()))), _;
      }, x.unstable_shouldYield = le, x.unstable_wrapCallback = function(_) {
        var Z = Ue;
        return function() {
          var ne = Ue;
          Ue = Z;
          try {
            return _.apply(this, arguments);
          } finally {
            Ue = ne;
          }
        };
      }, typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  })(Sb)), Sb;
}
var q2;
function I2() {
  return q2 || (q2 = 1, process.env.NODE_ENV === "production" ? Zv.exports = MT() : Zv.exports = CT()), Zv.exports;
}
var Jv = { exports: {} }, Ba = {};
/**
 * @license React
 * react-dom.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var G2;
function xT() {
  if (G2) return Ba;
  G2 = 1;
  var x = Sm();
  function k(le) {
    var V = "https://react.dev/errors/" + le;
    if (1 < arguments.length) {
      V += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var me = 2; me < arguments.length; me++)
        V += "&args[]=" + encodeURIComponent(arguments[me]);
    }
    return "Minified React error #" + le + "; visit " + V + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function fe() {
  }
  var M = {
    d: {
      f: fe,
      r: function() {
        throw Error(k(522));
      },
      D: fe,
      C: fe,
      L: fe,
      m: fe,
      X: fe,
      S: fe,
      M: fe
    },
    p: 0,
    findDOMNode: null
  }, P = Symbol.for("react.portal");
  function oe(le, V, me) {
    var B = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: P,
      key: B == null ? null : "" + B,
      children: le,
      containerInfo: V,
      implementation: me
    };
  }
  var Te = x.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function F(le, V) {
    if (le === "font") return "";
    if (typeof V == "string")
      return V === "use-credentials" ? V : "";
  }
  return Ba.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = M, Ba.createPortal = function(le, V) {
    var me = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!V || V.nodeType !== 1 && V.nodeType !== 9 && V.nodeType !== 11)
      throw Error(k(299));
    return oe(le, V, null, me);
  }, Ba.flushSync = function(le) {
    var V = Te.T, me = M.p;
    try {
      if (Te.T = null, M.p = 2, le) return le();
    } finally {
      Te.T = V, M.p = me, M.d.f();
    }
  }, Ba.preconnect = function(le, V) {
    typeof le == "string" && (V ? (V = V.crossOrigin, V = typeof V == "string" ? V === "use-credentials" ? V : "" : void 0) : V = null, M.d.C(le, V));
  }, Ba.prefetchDNS = function(le) {
    typeof le == "string" && M.d.D(le);
  }, Ba.preinit = function(le, V) {
    if (typeof le == "string" && V && typeof V.as == "string") {
      var me = V.as, B = F(me, V.crossOrigin), C = typeof V.integrity == "string" ? V.integrity : void 0, ue = typeof V.fetchPriority == "string" ? V.fetchPriority : void 0;
      me === "style" ? M.d.S(
        le,
        typeof V.precedence == "string" ? V.precedence : void 0,
        {
          crossOrigin: B,
          integrity: C,
          fetchPriority: ue
        }
      ) : me === "script" && M.d.X(le, {
        crossOrigin: B,
        integrity: C,
        fetchPriority: ue,
        nonce: typeof V.nonce == "string" ? V.nonce : void 0
      });
    }
  }, Ba.preinitModule = function(le, V) {
    if (typeof le == "string")
      if (typeof V == "object" && V !== null) {
        if (V.as == null || V.as === "script") {
          var me = F(
            V.as,
            V.crossOrigin
          );
          M.d.M(le, {
            crossOrigin: me,
            integrity: typeof V.integrity == "string" ? V.integrity : void 0,
            nonce: typeof V.nonce == "string" ? V.nonce : void 0
          });
        }
      } else V == null && M.d.M(le);
  }, Ba.preload = function(le, V) {
    if (typeof le == "string" && typeof V == "object" && V !== null && typeof V.as == "string") {
      var me = V.as, B = F(me, V.crossOrigin);
      M.d.L(le, me, {
        crossOrigin: B,
        integrity: typeof V.integrity == "string" ? V.integrity : void 0,
        nonce: typeof V.nonce == "string" ? V.nonce : void 0,
        type: typeof V.type == "string" ? V.type : void 0,
        fetchPriority: typeof V.fetchPriority == "string" ? V.fetchPriority : void 0,
        referrerPolicy: typeof V.referrerPolicy == "string" ? V.referrerPolicy : void 0,
        imageSrcSet: typeof V.imageSrcSet == "string" ? V.imageSrcSet : void 0,
        imageSizes: typeof V.imageSizes == "string" ? V.imageSizes : void 0,
        media: typeof V.media == "string" ? V.media : void 0
      });
    }
  }, Ba.preloadModule = function(le, V) {
    if (typeof le == "string")
      if (V) {
        var me = F(V.as, V.crossOrigin);
        M.d.m(le, {
          as: typeof V.as == "string" && V.as !== "script" ? V.as : void 0,
          crossOrigin: me,
          integrity: typeof V.integrity == "string" ? V.integrity : void 0
        });
      } else M.d.m(le);
  }, Ba.requestFormReset = function(le) {
    M.d.r(le);
  }, Ba.unstable_batchedUpdates = function(le, V) {
    return le(V);
  }, Ba.useFormState = function(le, V, me) {
    return Te.H.useFormState(le, V, me);
  }, Ba.useFormStatus = function() {
    return Te.H.useHostTransitionStatus();
  }, Ba.version = "19.2.7", Ba;
}
var Ya = {};
/**
 * @license React
 * react-dom.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var L2;
function UT() {
  return L2 || (L2 = 1, process.env.NODE_ENV !== "production" && (function() {
    function x() {
    }
    function k(B) {
      return "" + B;
    }
    function fe(B, C, ue) {
      var xe = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
      try {
        k(xe);
        var ie = !1;
      } catch {
        ie = !0;
      }
      return ie && (console.error(
        "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
        typeof Symbol == "function" && Symbol.toStringTag && xe[Symbol.toStringTag] || xe.constructor.name || "Object"
      ), k(xe)), {
        $$typeof: V,
        key: xe == null ? null : "" + xe,
        children: B,
        containerInfo: C,
        implementation: ue
      };
    }
    function M(B, C) {
      if (B === "font") return "";
      if (typeof C == "string")
        return C === "use-credentials" ? C : "";
    }
    function P(B) {
      return B === null ? "`null`" : B === void 0 ? "`undefined`" : B === "" ? "an empty string" : 'something with type "' + typeof B + '"';
    }
    function oe(B) {
      return B === null ? "`null`" : B === void 0 ? "`undefined`" : B === "" ? "an empty string" : typeof B == "string" ? JSON.stringify(B) : typeof B == "number" ? "`" + B + "`" : 'something with type "' + typeof B + '"';
    }
    function Te() {
      var B = me.H;
      return B === null && console.error(
        `Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.`
      ), B;
    }
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
    var F = Sm(), le = {
      d: {
        f: x,
        r: function() {
          throw Error(
            "Invalid form element. requestFormReset must be passed a form that was rendered by React."
          );
        },
        D: x,
        C: x,
        L: x,
        m: x,
        X: x,
        S: x,
        M: x
      },
      p: 0,
      findDOMNode: null
    }, V = Symbol.for("react.portal"), me = F.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    typeof Map == "function" && Map.prototype != null && typeof Map.prototype.forEach == "function" && typeof Set == "function" && Set.prototype != null && typeof Set.prototype.clear == "function" && typeof Set.prototype.forEach == "function" || console.error(
      "React depends on Map and Set built-in types. Make sure that you load a polyfill in older browsers. https://reactjs.org/link/react-polyfills"
    ), Ya.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = le, Ya.createPortal = function(B, C) {
      var ue = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
      if (!C || C.nodeType !== 1 && C.nodeType !== 9 && C.nodeType !== 11)
        throw Error("Target container is not a DOM element.");
      return fe(B, C, null, ue);
    }, Ya.flushSync = function(B) {
      var C = me.T, ue = le.p;
      try {
        if (me.T = null, le.p = 2, B)
          return B();
      } finally {
        me.T = C, le.p = ue, le.d.f() && console.error(
          "flushSync was called from inside a lifecycle method. React cannot flush when React is already rendering. Consider moving this call to a scheduler task or micro task."
        );
      }
    }, Ya.preconnect = function(B, C) {
      typeof B == "string" && B ? C != null && typeof C != "object" ? console.error(
        "ReactDOM.preconnect(): Expected the `options` argument (second) to be an object but encountered %s instead. The only supported option at this time is `crossOrigin` which accepts a string.",
        oe(C)
      ) : C != null && typeof C.crossOrigin != "string" && console.error(
        "ReactDOM.preconnect(): Expected the `crossOrigin` option (second argument) to be a string but encountered %s instead. Try removing this option or passing a string value instead.",
        P(C.crossOrigin)
      ) : console.error(
        "ReactDOM.preconnect(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.",
        P(B)
      ), typeof B == "string" && (C ? (C = C.crossOrigin, C = typeof C == "string" ? C === "use-credentials" ? C : "" : void 0) : C = null, le.d.C(B, C));
    }, Ya.prefetchDNS = function(B) {
      if (typeof B != "string" || !B)
        console.error(
          "ReactDOM.prefetchDNS(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.",
          P(B)
        );
      else if (1 < arguments.length) {
        var C = arguments[1];
        typeof C == "object" && C.hasOwnProperty("crossOrigin") ? console.error(
          "ReactDOM.prefetchDNS(): Expected only one argument, `href`, but encountered %s as a second argument instead. This argument is reserved for future options and is currently disallowed. It looks like the you are attempting to set a crossOrigin property for this DNS lookup hint. Browsers do not perform DNS queries using CORS and setting this attribute on the resource hint has no effect. Try calling ReactDOM.prefetchDNS() with just a single string argument, `href`.",
          oe(C)
        ) : console.error(
          "ReactDOM.prefetchDNS(): Expected only one argument, `href`, but encountered %s as a second argument instead. This argument is reserved for future options and is currently disallowed. Try calling ReactDOM.prefetchDNS() with just a single string argument, `href`.",
          oe(C)
        );
      }
      typeof B == "string" && le.d.D(B);
    }, Ya.preinit = function(B, C) {
      if (typeof B == "string" && B ? C == null || typeof C != "object" ? console.error(
        "ReactDOM.preinit(): Expected the `options` argument (second) to be an object with an `as` property describing the type of resource to be preinitialized but encountered %s instead.",
        oe(C)
      ) : C.as !== "style" && C.as !== "script" && console.error(
        'ReactDOM.preinit(): Expected the `as` property in the `options` argument (second) to contain a valid value describing the type of resource to be preinitialized but encountered %s instead. Valid values for `as` are "style" and "script".',
        oe(C.as)
      ) : console.error(
        "ReactDOM.preinit(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.",
        P(B)
      ), typeof B == "string" && C && typeof C.as == "string") {
        var ue = C.as, xe = M(ue, C.crossOrigin), ie = typeof C.integrity == "string" ? C.integrity : void 0, be = typeof C.fetchPriority == "string" ? C.fetchPriority : void 0;
        ue === "style" ? le.d.S(
          B,
          typeof C.precedence == "string" ? C.precedence : void 0,
          {
            crossOrigin: xe,
            integrity: ie,
            fetchPriority: be
          }
        ) : ue === "script" && le.d.X(B, {
          crossOrigin: xe,
          integrity: ie,
          fetchPriority: be,
          nonce: typeof C.nonce == "string" ? C.nonce : void 0
        });
      }
    }, Ya.preinitModule = function(B, C) {
      var ue = "";
      if (typeof B == "string" && B || (ue += " The `href` argument encountered was " + P(B) + "."), C !== void 0 && typeof C != "object" ? ue += " The `options` argument encountered was " + P(C) + "." : C && "as" in C && C.as !== "script" && (ue += " The `as` option encountered was " + oe(C.as) + "."), ue)
        console.error(
          "ReactDOM.preinitModule(): Expected up to two arguments, a non-empty `href` string and, optionally, an `options` object with a valid `as` property.%s",
          ue
        );
      else
        switch (ue = C && typeof C.as == "string" ? C.as : "script", ue) {
          case "script":
            break;
          default:
            ue = oe(ue), console.error(
              'ReactDOM.preinitModule(): Currently the only supported "as" type for this function is "script" but received "%s" instead. This warning was generated for `href` "%s". In the future other module types will be supported, aligning with the import-attributes proposal. Learn more here: (https://github.com/tc39/proposal-import-attributes)',
              ue,
              B
            );
        }
      typeof B == "string" && (typeof C == "object" && C !== null ? (C.as == null || C.as === "script") && (ue = M(
        C.as,
        C.crossOrigin
      ), le.d.M(B, {
        crossOrigin: ue,
        integrity: typeof C.integrity == "string" ? C.integrity : void 0,
        nonce: typeof C.nonce == "string" ? C.nonce : void 0
      })) : C == null && le.d.M(B));
    }, Ya.preload = function(B, C) {
      var ue = "";
      if (typeof B == "string" && B || (ue += " The `href` argument encountered was " + P(B) + "."), C == null || typeof C != "object" ? ue += " The `options` argument encountered was " + P(C) + "." : typeof C.as == "string" && C.as || (ue += " The `as` option encountered was " + P(C.as) + "."), ue && console.error(
        'ReactDOM.preload(): Expected two arguments, a non-empty `href` string and an `options` object with an `as` property valid for a `<link rel="preload" as="..." />` tag.%s',
        ue
      ), typeof B == "string" && typeof C == "object" && C !== null && typeof C.as == "string") {
        ue = C.as;
        var xe = M(
          ue,
          C.crossOrigin
        );
        le.d.L(B, ue, {
          crossOrigin: xe,
          integrity: typeof C.integrity == "string" ? C.integrity : void 0,
          nonce: typeof C.nonce == "string" ? C.nonce : void 0,
          type: typeof C.type == "string" ? C.type : void 0,
          fetchPriority: typeof C.fetchPriority == "string" ? C.fetchPriority : void 0,
          referrerPolicy: typeof C.referrerPolicy == "string" ? C.referrerPolicy : void 0,
          imageSrcSet: typeof C.imageSrcSet == "string" ? C.imageSrcSet : void 0,
          imageSizes: typeof C.imageSizes == "string" ? C.imageSizes : void 0,
          media: typeof C.media == "string" ? C.media : void 0
        });
      }
    }, Ya.preloadModule = function(B, C) {
      var ue = "";
      typeof B == "string" && B || (ue += " The `href` argument encountered was " + P(B) + "."), C !== void 0 && typeof C != "object" ? ue += " The `options` argument encountered was " + P(C) + "." : C && "as" in C && typeof C.as != "string" && (ue += " The `as` option encountered was " + P(C.as) + "."), ue && console.error(
        'ReactDOM.preloadModule(): Expected two arguments, a non-empty `href` string and, optionally, an `options` object with an `as` property valid for a `<link rel="modulepreload" as="..." />` tag.%s',
        ue
      ), typeof B == "string" && (C ? (ue = M(
        C.as,
        C.crossOrigin
      ), le.d.m(B, {
        as: typeof C.as == "string" && C.as !== "script" ? C.as : void 0,
        crossOrigin: ue,
        integrity: typeof C.integrity == "string" ? C.integrity : void 0
      })) : le.d.m(B));
    }, Ya.requestFormReset = function(B) {
      le.d.r(B);
    }, Ya.unstable_batchedUpdates = function(B, C) {
      return B(C);
    }, Ya.useFormState = function(B, C, ue) {
      return Te().useFormState(B, C, ue);
    }, Ya.useFormStatus = function() {
      return Te().useHostTransitionStatus();
    }, Ya.version = "19.2.7", typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
  })()), Ya;
}
var X2;
function P2() {
  if (X2) return Jv.exports;
  X2 = 1;
  function x() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) {
      if (process.env.NODE_ENV !== "production")
        throw new Error("^_^");
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(x);
      } catch (k) {
        console.error(k);
      }
    }
  }
  return process.env.NODE_ENV === "production" ? (x(), Jv.exports = xT()) : Jv.exports = UT(), Jv.exports;
}
/**
 * @license React
 * react-dom-client.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Q2;
function NT() {
  if (Q2) return v0;
  Q2 = 1;
  var x = I2(), k = Sm(), fe = P2();
  function M(l) {
    var n = "https://react.dev/errors/" + l;
    if (1 < arguments.length) {
      n += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var u = 2; u < arguments.length; u++)
        n += "&args[]=" + encodeURIComponent(arguments[u]);
    }
    return "Minified React error #" + l + "; visit " + n + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function P(l) {
    return !(!l || l.nodeType !== 1 && l.nodeType !== 9 && l.nodeType !== 11);
  }
  function oe(l) {
    var n = l, u = l;
    if (l.alternate) for (; n.return; ) n = n.return;
    else {
      l = n;
      do
        n = l, (n.flags & 4098) !== 0 && (u = n.return), l = n.return;
      while (l);
    }
    return n.tag === 3 ? u : null;
  }
  function Te(l) {
    if (l.tag === 13) {
      var n = l.memoizedState;
      if (n === null && (l = l.alternate, l !== null && (n = l.memoizedState)), n !== null) return n.dehydrated;
    }
    return null;
  }
  function F(l) {
    if (l.tag === 31) {
      var n = l.memoizedState;
      if (n === null && (l = l.alternate, l !== null && (n = l.memoizedState)), n !== null) return n.dehydrated;
    }
    return null;
  }
  function le(l) {
    if (oe(l) !== l)
      throw Error(M(188));
  }
  function V(l) {
    var n = l.alternate;
    if (!n) {
      if (n = oe(l), n === null) throw Error(M(188));
      return n !== l ? null : l;
    }
    for (var u = l, c = n; ; ) {
      var s = u.return;
      if (s === null) break;
      var r = s.alternate;
      if (r === null) {
        if (c = s.return, c !== null) {
          u = c;
          continue;
        }
        break;
      }
      if (s.child === r.child) {
        for (r = s.child; r; ) {
          if (r === u) return le(s), l;
          if (r === c) return le(s), n;
          r = r.sibling;
        }
        throw Error(M(188));
      }
      if (u.return !== c.return) u = s, c = r;
      else {
        for (var m = !1, v = s.child; v; ) {
          if (v === u) {
            m = !0, u = s, c = r;
            break;
          }
          if (v === c) {
            m = !0, c = s, u = r;
            break;
          }
          v = v.sibling;
        }
        if (!m) {
          for (v = r.child; v; ) {
            if (v === u) {
              m = !0, u = r, c = s;
              break;
            }
            if (v === c) {
              m = !0, c = r, u = s;
              break;
            }
            v = v.sibling;
          }
          if (!m) throw Error(M(189));
        }
      }
      if (u.alternate !== c) throw Error(M(190));
    }
    if (u.tag !== 3) throw Error(M(188));
    return u.stateNode.current === u ? l : n;
  }
  function me(l) {
    var n = l.tag;
    if (n === 5 || n === 26 || n === 27 || n === 6) return l;
    for (l = l.child; l !== null; ) {
      if (n = me(l), n !== null) return n;
      l = l.sibling;
    }
    return null;
  }
  var B = Object.assign, C = Symbol.for("react.element"), ue = Symbol.for("react.transitional.element"), xe = Symbol.for("react.portal"), ie = Symbol.for("react.fragment"), be = Symbol.for("react.strict_mode"), Ue = Symbol.for("react.profiler"), Jt = Symbol.for("react.consumer"), mt = Symbol.for("react.context"), Mt = Symbol.for("react.forward_ref"), Bt = Symbol.for("react.suspense"), qt = Symbol.for("react.suspense_list"), je = Symbol.for("react.memo"), We = Symbol.for("react.lazy"), Ct = Symbol.for("react.activity"), pe = Symbol.for("react.memo_cache_sentinel"), Yt = Symbol.iterator;
  function Ae(l) {
    return l === null || typeof l != "object" ? null : (l = Yt && l[Yt] || l["@@iterator"], typeof l == "function" ? l : null);
  }
  var Ve = Symbol.for("react.client.reference");
  function Kt(l) {
    if (l == null) return null;
    if (typeof l == "function")
      return l.$$typeof === Ve ? null : l.displayName || l.name || null;
    if (typeof l == "string") return l;
    switch (l) {
      case ie:
        return "Fragment";
      case Ue:
        return "Profiler";
      case be:
        return "StrictMode";
      case Bt:
        return "Suspense";
      case qt:
        return "SuspenseList";
      case Ct:
        return "Activity";
    }
    if (typeof l == "object")
      switch (l.$$typeof) {
        case xe:
          return "Portal";
        case mt:
          return l.displayName || "Context";
        case Jt:
          return (l._context.displayName || "Context") + ".Consumer";
        case Mt:
          var n = l.render;
          return l = l.displayName, l || (l = n.displayName || n.name || "", l = l !== "" ? "ForwardRef(" + l + ")" : "ForwardRef"), l;
        case je:
          return n = l.displayName || null, n !== null ? n : Kt(l.type) || "Memo";
        case We:
          n = l._payload, l = l._init;
          try {
            return Kt(l(n));
          } catch {
          }
      }
    return null;
  }
  var Gt = Array.isArray, _ = k.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Z = fe.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, ne = {
    pending: !1,
    data: null,
    method: null,
    action: null
  }, Oe = [], Ne = -1;
  function b(l) {
    return { current: l };
  }
  function j(l) {
    0 > Ne || (l.current = Oe[Ne], Oe[Ne] = null, Ne--);
  }
  function te(l, n) {
    Ne++, Oe[Ne] = l.current, l.current = n;
  }
  var ee = b(null), De = b(null), Ze = b(null), Me = b(null);
  function $t(l, n) {
    switch (te(Ze, n), te(De, l), te(ee, null), n.nodeType) {
      case 9:
      case 11:
        l = (l = n.documentElement) && (l = l.namespaceURI) ? Ng(l) : 0;
        break;
      default:
        if (l = n.tagName, n = n.namespaceURI)
          n = Ng(n), l = rp(n, l);
        else
          switch (l) {
            case "svg":
              l = 1;
              break;
            case "math":
              l = 2;
              break;
            default:
              l = 0;
          }
    }
    j(ee), te(ee, l);
  }
  function gt() {
    j(ee), j(De), j(Ze);
  }
  function qa(l) {
    l.memoizedState !== null && te(Me, l);
    var n = ee.current, u = rp(n, l.type);
    n !== u && (te(De, l), te(ee, u));
  }
  function de(l) {
    De.current === l && (j(ee), j(De)), Me.current === l && (j(Me), Dr._currentValue = ne);
  }
  var Ri, Mi;
  function Ga(l) {
    if (Ri === void 0)
      try {
        throw Error();
      } catch (u) {
        var n = u.stack.trim().match(/\n( *(at )?)/);
        Ri = n && n[1] || "", Mi = -1 < u.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < u.stack.indexOf("@") ? "@unknown:0:0" : "";
      }
    return `
` + Ri + l + Mi;
  }
  var cu = !1;
  function vt(l, n) {
    if (!l || cu) return "";
    cu = !0;
    var u = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var c = {
        DetermineComponentFrameRoot: function() {
          try {
            if (n) {
              var W = function() {
                throw Error();
              };
              if (Object.defineProperty(W.prototype, "props", {
                set: function() {
                  throw Error();
                }
              }), typeof Reflect == "object" && Reflect.construct) {
                try {
                  Reflect.construct(W, []);
                } catch (X) {
                  var Y = X;
                }
                Reflect.construct(l, [], W);
              } else {
                try {
                  W.call();
                } catch (X) {
                  Y = X;
                }
                l.call(W.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (X) {
                Y = X;
              }
              (W = l()) && typeof W.catch == "function" && W.catch(function() {
              });
            }
          } catch (X) {
            if (X && Y && typeof X.stack == "string")
              return [X.stack, Y.stack];
          }
          return [null, null];
        }
      };
      c.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var s = Object.getOwnPropertyDescriptor(
        c.DetermineComponentFrameRoot,
        "name"
      );
      s && s.configurable && Object.defineProperty(
        c.DetermineComponentFrameRoot,
        "name",
        { value: "DetermineComponentFrameRoot" }
      );
      var r = c.DetermineComponentFrameRoot(), m = r[0], v = r[1];
      if (m && v) {
        var A = m.split(`
`), w = v.split(`
`);
        for (s = c = 0; c < A.length && !A[c].includes("DetermineComponentFrameRoot"); )
          c++;
        for (; s < w.length && !w[s].includes(
          "DetermineComponentFrameRoot"
        ); )
          s++;
        if (c === A.length || s === w.length)
          for (c = A.length - 1, s = w.length - 1; 1 <= c && 0 <= s && A[c] !== w[s]; )
            s--;
        for (; 1 <= c && 0 <= s; c--, s--)
          if (A[c] !== w[s]) {
            if (c !== 1 || s !== 1)
              do
                if (c--, s--, 0 > s || A[c] !== w[s]) {
                  var Q = `
` + A[c].replace(" at new ", " at ");
                  return l.displayName && Q.includes("<anonymous>") && (Q = Q.replace("<anonymous>", l.displayName)), Q;
                }
              while (1 <= c && 0 <= s);
            break;
          }
      }
    } finally {
      cu = !1, Error.prepareStackTrace = u;
    }
    return (u = l ? l.displayName || l.name : "") ? Ga(u) : "";
  }
  function ta(l, n) {
    switch (l.tag) {
      case 26:
      case 27:
      case 5:
        return Ga(l.type);
      case 16:
        return Ga("Lazy");
      case 13:
        return l.child !== n && n !== null ? Ga("Suspense Fallback") : Ga("Suspense");
      case 19:
        return Ga("SuspenseList");
      case 0:
      case 15:
        return vt(l.type, !1);
      case 11:
        return vt(l.type.render, !1);
      case 1:
        return vt(l.type, !0);
      case 31:
        return Ga("Activity");
      default:
        return "";
    }
  }
  function bc(l) {
    try {
      var n = "", u = null;
      do
        n += ta(l, u), u = l, l = l.return;
      while (l);
      return n;
    } catch (c) {
      return `
Error generating stack: ` + c.message + `
` + c.stack;
    }
  }
  var ds = Object.prototype.hasOwnProperty, ge = x.unstable_scheduleCallback, Ci = x.unstable_cancelCallback, ou = x.unstable_shouldYield, Sc = x.unstable_requestPaint, Sl = x.unstable_now, Pr = x.unstable_getCurrentPriorityLevel, xo = x.unstable_ImmediatePriority, Uo = x.unstable_UserBlockingPriority, xn = x.unstable_NormalPriority, ed = x.unstable_LowPriority, No = x.unstable_IdlePriority, hs = x.log, Ec = x.unstable_setDisableYieldValue, hn = null, zl = null;
  function La(l) {
    if (typeof hs == "function" && Ec(l), zl && typeof zl.setStrictMode == "function")
      try {
        zl.setStrictMode(hn, l);
      } catch {
      }
  }
  var Nl = Math.clz32 ? Math.clz32 : U, xi = Math.log, g = Math.LN2;
  function U(l) {
    return l >>>= 0, l === 0 ? 32 : 31 - (xi(l) / g | 0) | 0;
  }
  var ae = 256, ce = 262144, ve = 4194304;
  function we(l) {
    var n = l & 42;
    if (n !== 0) return n;
    switch (l & -l) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 4:
        return 4;
      case 8:
        return 8;
      case 16:
        return 16;
      case 32:
        return 32;
      case 64:
        return 64;
      case 128:
        return 128;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
        return l & 261888;
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return l & 3932160;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return l & 62914560;
      case 67108864:
        return 67108864;
      case 134217728:
        return 134217728;
      case 268435456:
        return 268435456;
      case 536870912:
        return 536870912;
      case 1073741824:
        return 0;
      default:
        return l;
    }
  }
  function Se(l, n, u) {
    var c = l.pendingLanes;
    if (c === 0) return 0;
    var s = 0, r = l.suspendedLanes, m = l.pingedLanes;
    l = l.warmLanes;
    var v = c & 134217727;
    return v !== 0 ? (c = v & ~r, c !== 0 ? s = we(c) : (m &= v, m !== 0 ? s = we(m) : u || (u = v & ~l, u !== 0 && (s = we(u))))) : (v = c & ~r, v !== 0 ? s = we(v) : m !== 0 ? s = we(m) : u || (u = c & ~l, u !== 0 && (s = we(u)))), s === 0 ? 0 : n !== 0 && n !== s && (n & r) === 0 && (r = s & -s, u = n & -n, r >= u || r === 32 && (u & 4194048) !== 0) ? n : s;
  }
  function nt(l, n) {
    return (l.pendingLanes & ~(l.suspendedLanes & ~l.pingedLanes) & n) === 0;
  }
  function Je(l, n) {
    switch (l) {
      case 1:
      case 2:
      case 4:
      case 8:
      case 64:
        return n + 250;
      case 16:
      case 32:
      case 128:
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return n + 5e3;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return -1;
      case 67108864:
      case 134217728:
      case 268435456:
      case 536870912:
      case 1073741824:
        return -1;
      default:
        return -1;
    }
  }
  function la() {
    var l = ve;
    return ve <<= 1, (ve & 62914560) === 0 && (ve = 4194304), l;
  }
  function mn(l) {
    for (var n = [], u = 0; 31 > u; u++) n.push(l);
    return n;
  }
  function Ui(l, n) {
    l.pendingLanes |= n, n !== 268435456 && (l.suspendedLanes = 0, l.pingedLanes = 0, l.warmLanes = 0);
  }
  function Ho(l, n, u, c, s, r) {
    var m = l.pendingLanes;
    l.pendingLanes = u, l.suspendedLanes = 0, l.pingedLanes = 0, l.warmLanes = 0, l.expiredLanes &= u, l.entangledLanes &= u, l.errorRecoveryDisabledLanes &= u, l.shellSuspendCounter = 0;
    var v = l.entanglements, A = l.expirationTimes, w = l.hiddenUpdates;
    for (u = m & ~u; 0 < u; ) {
      var Q = 31 - Nl(u), W = 1 << Q;
      v[Q] = 0, A[Q] = -1;
      var Y = w[Q];
      if (Y !== null)
        for (w[Q] = null, Q = 0; Q < Y.length; Q++) {
          var X = Y[Q];
          X !== null && (X.lane &= -536870913);
        }
      u &= ~W;
    }
    c !== 0 && ms(l, c, 0), r !== 0 && s === 0 && l.tag !== 0 && (l.suspendedLanes |= r & ~(m & ~n));
  }
  function ms(l, n, u) {
    l.pendingLanes |= n, l.suspendedLanes &= ~n;
    var c = 31 - Nl(n);
    l.entangledLanes |= n, l.entanglements[c] = l.entanglements[c] | 1073741824 | u & 261930;
  }
  function fu(l, n) {
    var u = l.entangledLanes |= n;
    for (l = l.entanglements; u; ) {
      var c = 31 - Nl(u), s = 1 << c;
      s & n | l[c] & n && (l[c] |= n), u &= ~s;
    }
  }
  function Xa(l, n) {
    var u = n & -n;
    return u = (u & 42) !== 0 ? 1 : td(u), (u & (l.suspendedLanes | n)) !== 0 ? 0 : u;
  }
  function td(l) {
    switch (l) {
      case 2:
        l = 1;
        break;
      case 8:
        l = 4;
        break;
      case 32:
        l = 16;
        break;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        l = 128;
        break;
      case 268435456:
        l = 134217728;
        break;
      default:
        l = 0;
    }
    return l;
  }
  function Em(l) {
    return l &= -l, 2 < l ? 8 < l ? (l & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
  }
  function ld() {
    var l = Z.p;
    return l !== 0 ? l : (l = window.event, l === void 0 ? 32 : _r(l.type));
  }
  function Tm(l, n) {
    var u = Z.p;
    try {
      return Z.p = l, n();
    } finally {
      Z.p = u;
    }
  }
  var Un = Math.random().toString(36).slice(2), xt = "__reactFiber$" + Un, ra = "__reactProps$" + Un, Ni = "__reactContainer$" + Un, ad = "__reactEvents$" + Un, Am = "__reactListeners$" + Un, E0 = "__reactHandles$" + Un, Om = "__reactResources$" + Un, su = "__reactMarker$" + Un;
  function nd(l) {
    delete l[xt], delete l[ra], delete l[ad], delete l[Am], delete l[E0];
  }
  function Tc(l) {
    var n = l[xt];
    if (n) return n;
    for (var u = l.parentNode; u; ) {
      if (n = u[Ni] || u[xt]) {
        if (u = n.alternate, n.child !== null || u !== null && u.child !== null)
          for (l = Pn(l); l !== null; ) {
            if (u = l[xt]) return u;
            l = Pn(l);
          }
        return n;
      }
      l = u, u = l.parentNode;
    }
    return null;
  }
  function Ac(l) {
    if (l = l[xt] || l[Ni]) {
      var n = l.tag;
      if (n === 5 || n === 6 || n === 13 || n === 31 || n === 26 || n === 27 || n === 3)
        return l;
    }
    return null;
  }
  function jo(l) {
    var n = l.tag;
    if (n === 5 || n === 26 || n === 27 || n === 6) return l.stateNode;
    throw Error(M(33));
  }
  function Oc(l) {
    var n = l[Om];
    return n || (n = l[Om] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() }), n;
  }
  function Ot(l) {
    l[su] = !0;
  }
  var zc = /* @__PURE__ */ new Set(), Hi = {};
  function ji(l, n) {
    ru(l, n), ru(l + "Capture", n);
  }
  function ru(l, n) {
    for (Hi[l] = n, l = 0; l < n.length; l++)
      zc.add(n[l]);
  }
  var ud = RegExp(
    "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
  ), id = {}, wo = {};
  function Bo(l) {
    return ds.call(wo, l) ? !0 : ds.call(id, l) ? !1 : ud.test(l) ? wo[l] = !0 : (id[l] = !0, !1);
  }
  function Yo(l, n, u) {
    if (Bo(n))
      if (u === null) l.removeAttribute(n);
      else {
        switch (typeof u) {
          case "undefined":
          case "function":
          case "symbol":
            l.removeAttribute(n);
            return;
          case "boolean":
            var c = n.toLowerCase().slice(0, 5);
            if (c !== "data-" && c !== "aria-") {
              l.removeAttribute(n);
              return;
            }
        }
        l.setAttribute(n, "" + u);
      }
  }
  function cd(l, n, u) {
    if (u === null) l.removeAttribute(n);
    else {
      switch (typeof u) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          l.removeAttribute(n);
          return;
      }
      l.setAttribute(n, "" + u);
    }
  }
  function Pu(l, n, u, c) {
    if (c === null) l.removeAttribute(u);
    else {
      switch (typeof c) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          l.removeAttribute(u);
          return;
      }
      l.setAttributeNS(n, u, "" + c);
    }
  }
  function Qa(l) {
    switch (typeof l) {
      case "bigint":
      case "boolean":
      case "number":
      case "string":
      case "undefined":
        return l;
      case "object":
        return l;
      default:
        return "";
    }
  }
  function od(l) {
    var n = l.type;
    return (l = l.nodeName) && l.toLowerCase() === "input" && (n === "checkbox" || n === "radio");
  }
  function zm(l, n, u) {
    var c = Object.getOwnPropertyDescriptor(
      l.constructor.prototype,
      n
    );
    if (!l.hasOwnProperty(n) && typeof c < "u" && typeof c.get == "function" && typeof c.set == "function") {
      var s = c.get, r = c.set;
      return Object.defineProperty(l, n, {
        configurable: !0,
        get: function() {
          return s.call(this);
        },
        set: function(m) {
          u = "" + m, r.call(this, m);
        }
      }), Object.defineProperty(l, n, {
        enumerable: c.enumerable
      }), {
        getValue: function() {
          return u;
        },
        setValue: function(m) {
          u = "" + m;
        },
        stopTracking: function() {
          l._valueTracker = null, delete l[n];
        }
      };
    }
  }
  function fd(l) {
    if (!l._valueTracker) {
      var n = od(l) ? "checked" : "value";
      l._valueTracker = zm(
        l,
        n,
        "" + l[n]
      );
    }
  }
  function Dm(l) {
    if (!l) return !1;
    var n = l._valueTracker;
    if (!n) return !0;
    var u = n.getValue(), c = "";
    return l && (c = od(l) ? l.checked ? "true" : "false" : l.value), l = c, l !== u ? (n.setValue(l), !0) : !1;
  }
  function ys(l) {
    if (l = l || (typeof document < "u" ? document : void 0), typeof l > "u") return null;
    try {
      return l.activeElement || l.body;
    } catch {
      return l.body;
    }
  }
  var $v = /[\n"\\]/g;
  function Va(l) {
    return l.replace(
      $v,
      function(n) {
        return "\\" + n.charCodeAt(0).toString(16) + " ";
      }
    );
  }
  function ps(l, n, u, c, s, r, m, v) {
    l.name = "", m != null && typeof m != "function" && typeof m != "symbol" && typeof m != "boolean" ? l.type = m : l.removeAttribute("type"), n != null ? m === "number" ? (n === 0 && l.value === "" || l.value != n) && (l.value = "" + Qa(n)) : l.value !== "" + Qa(n) && (l.value = "" + Qa(n)) : m !== "submit" && m !== "reset" || l.removeAttribute("value"), n != null ? Dc(l, m, Qa(n)) : u != null ? Dc(l, m, Qa(u)) : c != null && l.removeAttribute("value"), s == null && r != null && (l.defaultChecked = !!r), s != null && (l.checked = s && typeof s != "function" && typeof s != "symbol"), v != null && typeof v != "function" && typeof v != "symbol" && typeof v != "boolean" ? l.name = "" + Qa(v) : l.removeAttribute("name");
  }
  function gs(l, n, u, c, s, r, m, v) {
    if (r != null && typeof r != "function" && typeof r != "symbol" && typeof r != "boolean" && (l.type = r), n != null || u != null) {
      if (!(r !== "submit" && r !== "reset" || n != null)) {
        fd(l);
        return;
      }
      u = u != null ? "" + Qa(u) : "", n = n != null ? "" + Qa(n) : u, v || n === l.value || (l.value = n), l.defaultValue = n;
    }
    c = c ?? s, c = typeof c != "function" && typeof c != "symbol" && !!c, l.checked = v ? l.checked : !!c, l.defaultChecked = !!c, m != null && typeof m != "function" && typeof m != "symbol" && typeof m != "boolean" && (l.name = m), fd(l);
  }
  function Dc(l, n, u) {
    n === "number" && ys(l.ownerDocument) === l || l.defaultValue === "" + u || (l.defaultValue = "" + u);
  }
  function qo(l, n, u, c) {
    if (l = l.options, n) {
      n = {};
      for (var s = 0; s < u.length; s++)
        n["$" + u[s]] = !0;
      for (u = 0; u < l.length; u++)
        s = n.hasOwnProperty("$" + l[u].value), l[u].selected !== s && (l[u].selected = s), s && c && (l[u].defaultSelected = !0);
    } else {
      for (u = "" + Qa(u), n = null, s = 0; s < l.length; s++) {
        if (l[s].value === u) {
          l[s].selected = !0, c && (l[s].defaultSelected = !0);
          return;
        }
        n !== null || l[s].disabled || (n = l[s]);
      }
      n !== null && (n.selected = !0);
    }
  }
  function _m(l, n, u) {
    if (n != null && (n = "" + Qa(n), n !== l.value && (l.value = n), u == null)) {
      l.defaultValue !== n && (l.defaultValue = n);
      return;
    }
    l.defaultValue = u != null ? "" + Qa(u) : "";
  }
  function Rm(l, n, u, c) {
    if (n == null) {
      if (c != null) {
        if (u != null) throw Error(M(92));
        if (Gt(c)) {
          if (1 < c.length) throw Error(M(93));
          c = c[0];
        }
        u = c;
      }
      u == null && (u = ""), n = u;
    }
    u = Qa(n), l.defaultValue = u, c = l.textContent, c === u && c !== "" && c !== null && (l.value = c), fd(l);
  }
  function du(l, n) {
    if (n) {
      var u = l.firstChild;
      if (u && u === l.lastChild && u.nodeType === 3) {
        u.nodeValue = n;
        return;
      }
    }
    l.textContent = n;
  }
  var T0 = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " "
    )
  );
  function A0(l, n, u) {
    var c = n.indexOf("--") === 0;
    u == null || typeof u == "boolean" || u === "" ? c ? l.setProperty(n, "") : n === "float" ? l.cssFloat = "" : l[n] = "" : c ? l.setProperty(n, u) : typeof u != "number" || u === 0 || T0.has(n) ? n === "float" ? l.cssFloat = u : l[n] = ("" + u).trim() : l[n] = u + "px";
  }
  function O0(l, n, u) {
    if (n != null && typeof n != "object")
      throw Error(M(62));
    if (l = l.style, u != null) {
      for (var c in u)
        !u.hasOwnProperty(c) || n != null && n.hasOwnProperty(c) || (c.indexOf("--") === 0 ? l.setProperty(c, "") : c === "float" ? l.cssFloat = "" : l[c] = "");
      for (var s in n)
        c = n[s], n.hasOwnProperty(s) && u[s] !== c && A0(l, s, c);
    } else
      for (var r in n)
        n.hasOwnProperty(r) && A0(l, r, n[r]);
  }
  function Mm(l) {
    if (l.indexOf("-") === -1) return !1;
    switch (l) {
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return !1;
      default:
        return !0;
    }
  }
  var kv = /* @__PURE__ */ new Map([
    ["acceptCharset", "accept-charset"],
    ["htmlFor", "for"],
    ["httpEquiv", "http-equiv"],
    ["crossOrigin", "crossorigin"],
    ["accentHeight", "accent-height"],
    ["alignmentBaseline", "alignment-baseline"],
    ["arabicForm", "arabic-form"],
    ["baselineShift", "baseline-shift"],
    ["capHeight", "cap-height"],
    ["clipPath", "clip-path"],
    ["clipRule", "clip-rule"],
    ["colorInterpolation", "color-interpolation"],
    ["colorInterpolationFilters", "color-interpolation-filters"],
    ["colorProfile", "color-profile"],
    ["colorRendering", "color-rendering"],
    ["dominantBaseline", "dominant-baseline"],
    ["enableBackground", "enable-background"],
    ["fillOpacity", "fill-opacity"],
    ["fillRule", "fill-rule"],
    ["floodColor", "flood-color"],
    ["floodOpacity", "flood-opacity"],
    ["fontFamily", "font-family"],
    ["fontSize", "font-size"],
    ["fontSizeAdjust", "font-size-adjust"],
    ["fontStretch", "font-stretch"],
    ["fontStyle", "font-style"],
    ["fontVariant", "font-variant"],
    ["fontWeight", "font-weight"],
    ["glyphName", "glyph-name"],
    ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
    ["glyphOrientationVertical", "glyph-orientation-vertical"],
    ["horizAdvX", "horiz-adv-x"],
    ["horizOriginX", "horiz-origin-x"],
    ["imageRendering", "image-rendering"],
    ["letterSpacing", "letter-spacing"],
    ["lightingColor", "lighting-color"],
    ["markerEnd", "marker-end"],
    ["markerMid", "marker-mid"],
    ["markerStart", "marker-start"],
    ["overlinePosition", "overline-position"],
    ["overlineThickness", "overline-thickness"],
    ["paintOrder", "paint-order"],
    ["panose-1", "panose-1"],
    ["pointerEvents", "pointer-events"],
    ["renderingIntent", "rendering-intent"],
    ["shapeRendering", "shape-rendering"],
    ["stopColor", "stop-color"],
    ["stopOpacity", "stop-opacity"],
    ["strikethroughPosition", "strikethrough-position"],
    ["strikethroughThickness", "strikethrough-thickness"],
    ["strokeDasharray", "stroke-dasharray"],
    ["strokeDashoffset", "stroke-dashoffset"],
    ["strokeLinecap", "stroke-linecap"],
    ["strokeLinejoin", "stroke-linejoin"],
    ["strokeMiterlimit", "stroke-miterlimit"],
    ["strokeOpacity", "stroke-opacity"],
    ["strokeWidth", "stroke-width"],
    ["textAnchor", "text-anchor"],
    ["textDecoration", "text-decoration"],
    ["textRendering", "text-rendering"],
    ["transformOrigin", "transform-origin"],
    ["underlinePosition", "underline-position"],
    ["underlineThickness", "underline-thickness"],
    ["unicodeBidi", "unicode-bidi"],
    ["unicodeRange", "unicode-range"],
    ["unitsPerEm", "units-per-em"],
    ["vAlphabetic", "v-alphabetic"],
    ["vHanging", "v-hanging"],
    ["vIdeographic", "v-ideographic"],
    ["vMathematical", "v-mathematical"],
    ["vectorEffect", "vector-effect"],
    ["vertAdvY", "vert-adv-y"],
    ["vertOriginX", "vert-origin-x"],
    ["vertOriginY", "vert-origin-y"],
    ["wordSpacing", "word-spacing"],
    ["writingMode", "writing-mode"],
    ["xmlnsXlink", "xmlns:xlink"],
    ["xHeight", "x-height"]
  ]), vs = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function yn(l) {
    return vs.test("" + l) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : l;
  }
  function Nn() {
  }
  var sd = null;
  function rd(l) {
    return l = l.target || l.srcElement || window, l.correspondingUseElement && (l = l.correspondingUseElement), l.nodeType === 3 ? l.parentNode : l;
  }
  var hu = null, _c = null;
  function bs(l) {
    var n = Ac(l);
    if (n && (l = n.stateNode)) {
      var u = l[ra] || null;
      e: switch (l = n.stateNode, n.type) {
        case "input":
          if (ps(
            l,
            u.value,
            u.defaultValue,
            u.defaultValue,
            u.checked,
            u.defaultChecked,
            u.type,
            u.name
          ), n = u.name, u.type === "radio" && n != null) {
            for (u = l; u.parentNode; ) u = u.parentNode;
            for (u = u.querySelectorAll(
              'input[name="' + Va(
                "" + n
              ) + '"][type="radio"]'
            ), n = 0; n < u.length; n++) {
              var c = u[n];
              if (c !== l && c.form === l.form) {
                var s = c[ra] || null;
                if (!s) throw Error(M(90));
                ps(
                  c,
                  s.value,
                  s.defaultValue,
                  s.defaultValue,
                  s.checked,
                  s.defaultChecked,
                  s.type,
                  s.name
                );
              }
            }
            for (n = 0; n < u.length; n++)
              c = u[n], c.form === l.form && Dm(c);
          }
          break e;
        case "textarea":
          _m(l, u.value, u.defaultValue);
          break e;
        case "select":
          n = u.value, n != null && qo(l, !!u.multiple, n, !1);
      }
    }
  }
  var Go = !1;
  function Cm(l, n, u) {
    if (Go) return l(n, u);
    Go = !0;
    try {
      var c = l(n);
      return c;
    } finally {
      if (Go = !1, (hu !== null || _c !== null) && (Af(), hu && (n = hu, l = _c, _c = hu = null, bs(n), l)))
        for (n = 0; n < l.length; n++) bs(l[n]);
    }
  }
  function Hl(l, n) {
    var u = l.stateNode;
    if (u === null) return null;
    var c = u[ra] || null;
    if (c === null) return null;
    u = c[n];
    e: switch (n) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        (c = !c.disabled) || (l = l.type, c = !(l === "button" || l === "input" || l === "select" || l === "textarea")), l = !c;
        break e;
      default:
        l = !1;
    }
    if (l) return null;
    if (u && typeof u != "function")
      throw Error(
        M(231, n, typeof u)
      );
    return u;
  }
  var ei = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), Ss = !1;
  if (ei)
    try {
      var Lo = {};
      Object.defineProperty(Lo, "passive", {
        get: function() {
          Ss = !0;
        }
      }), window.addEventListener("test", Lo, Lo), window.removeEventListener("test", Lo, Lo);
    } catch {
      Ss = !1;
    }
  var ti = null, xm = null, dd = null;
  function Um() {
    if (dd) return dd;
    var l, n = xm, u = n.length, c, s = "value" in ti ? ti.value : ti.textContent, r = s.length;
    for (l = 0; l < u && n[l] === s[l]; l++) ;
    var m = u - l;
    for (c = 1; c <= m && n[u - c] === s[r - c]; c++) ;
    return dd = s.slice(l, 1 < c ? 1 - c : void 0);
  }
  function hd(l) {
    var n = l.keyCode;
    return "charCode" in l ? (l = l.charCode, l === 0 && n === 13 && (l = 13)) : l = n, l === 10 && (l = 13), 32 <= l || l === 13 ? l : 0;
  }
  function Es() {
    return !0;
  }
  function z0() {
    return !1;
  }
  function kl(l) {
    function n(u, c, s, r, m) {
      this._reactName = u, this._targetInst = s, this.type = c, this.nativeEvent = r, this.target = m, this.currentTarget = null;
      for (var v in l)
        l.hasOwnProperty(v) && (u = l[v], this[v] = u ? u(r) : r[v]);
      return this.isDefaultPrevented = (r.defaultPrevented != null ? r.defaultPrevented : r.returnValue === !1) ? Es : z0, this.isPropagationStopped = z0, this;
    }
    return B(n.prototype, {
      preventDefault: function() {
        this.defaultPrevented = !0;
        var u = this.nativeEvent;
        u && (u.preventDefault ? u.preventDefault() : typeof u.returnValue != "unknown" && (u.returnValue = !1), this.isDefaultPrevented = Es);
      },
      stopPropagation: function() {
        var u = this.nativeEvent;
        u && (u.stopPropagation ? u.stopPropagation() : typeof u.cancelBubble != "unknown" && (u.cancelBubble = !0), this.isPropagationStopped = Es);
      },
      persist: function() {
      },
      isPersistent: Es
    }), n;
  }
  var wi = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function(l) {
      return l.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0
  }, Ts = kl(wi), Xo = B({}, wi, { view: 0, detail: 0 }), Wv = kl(Xo), Nm, Hm, As, md = B({}, Xo, {
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    getModifierState: pn,
    button: 0,
    buttons: 0,
    relatedTarget: function(l) {
      return l.relatedTarget === void 0 ? l.fromElement === l.srcElement ? l.toElement : l.fromElement : l.relatedTarget;
    },
    movementX: function(l) {
      return "movementX" in l ? l.movementX : (l !== As && (As && l.type === "mousemove" ? (Nm = l.screenX - As.screenX, Hm = l.screenY - As.screenY) : Hm = Nm = 0, As = l), Nm);
    },
    movementY: function(l) {
      return "movementY" in l ? l.movementY : Hm;
    }
  }), Qo = kl(md), D0 = B({}, md, { dataTransfer: 0 }), _0 = kl(D0), R0 = B({}, Xo, { relatedTarget: 0 }), yd = kl(R0), jm = B({}, wi, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), M0 = kl(jm), Rc = B({}, wi, {
    clipboardData: function(l) {
      return "clipboardData" in l ? l.clipboardData : window.clipboardData;
    }
  }), Mc = kl(Rc), Hn = B({}, wi, { data: 0 }), C0 = kl(Hn), wm = {
    Esc: "Escape",
    Spacebar: " ",
    Left: "ArrowLeft",
    Up: "ArrowUp",
    Right: "ArrowRight",
    Down: "ArrowDown",
    Del: "Delete",
    Win: "OS",
    Menu: "ContextMenu",
    Apps: "ContextMenu",
    Scroll: "ScrollLock",
    MozPrintableKey: "Unidentified"
  }, mu = {
    8: "Backspace",
    9: "Tab",
    12: "Clear",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Escape",
    32: " ",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    45: "Insert",
    46: "Delete",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12",
    144: "NumLock",
    145: "ScrollLock",
    224: "Meta"
  }, x0 = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
  };
  function jn(l) {
    var n = this.nativeEvent;
    return n.getModifierState ? n.getModifierState(l) : (l = x0[l]) ? !!n[l] : !1;
  }
  function pn() {
    return jn;
  }
  var pd = B({}, Xo, {
    key: function(l) {
      if (l.key) {
        var n = wm[l.key] || l.key;
        if (n !== "Unidentified") return n;
      }
      return l.type === "keypress" ? (l = hd(l), l === 13 ? "Enter" : String.fromCharCode(l)) : l.type === "keydown" || l.type === "keyup" ? mu[l.keyCode] || "Unidentified" : "";
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: pn,
    charCode: function(l) {
      return l.type === "keypress" ? hd(l) : 0;
    },
    keyCode: function(l) {
      return l.type === "keydown" || l.type === "keyup" ? l.keyCode : 0;
    },
    which: function(l) {
      return l.type === "keypress" ? hd(l) : l.type === "keydown" || l.type === "keyup" ? l.keyCode : 0;
    }
  }), gd = kl(pd), Bm = B({}, md, {
    pointerId: 0,
    width: 0,
    height: 0,
    pressure: 0,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 0,
    isPrimary: 0
  }), wn = kl(Bm), Fv = B({}, Xo, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: pn
  }), U0 = kl(Fv), N0 = B({}, wi, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), Iv = kl(N0), Ym = B({}, md, {
    deltaX: function(l) {
      return "deltaX" in l ? l.deltaX : "wheelDeltaX" in l ? -l.wheelDeltaX : 0;
    },
    deltaY: function(l) {
      return "deltaY" in l ? l.deltaY : "wheelDeltaY" in l ? -l.wheelDeltaY : "wheelDelta" in l ? -l.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), Pv = kl(Ym), H0 = B({}, wi, {
    newState: 0,
    oldState: 0
  }), qm = kl(H0), vd = [9, 13, 27, 32], Vo = ei && "CompositionEvent" in window, Cc = null;
  ei && "documentMode" in document && (Cc = document.documentMode);
  var aa = ei && "TextEvent" in window && !Cc, Gm = ei && (!Vo || Cc && 8 < Cc && 11 >= Cc), Os = " ", Bi = !1;
  function bd(l, n) {
    switch (l) {
      case "keyup":
        return vd.indexOf(n.keyCode) !== -1;
      case "keydown":
        return n.keyCode !== 229;
      case "keypress":
      case "mousedown":
      case "focusout":
        return !0;
      default:
        return !1;
    }
  }
  function Lm(l) {
    return l = l.detail, typeof l == "object" && "data" in l ? l.data : null;
  }
  var xc = !1;
  function j0(l, n) {
    switch (l) {
      case "compositionend":
        return Lm(n);
      case "keypress":
        return n.which !== 32 ? null : (Bi = !0, Os);
      case "textInput":
        return l = n.data, l === Os && Bi ? null : l;
      default:
        return null;
    }
  }
  function e1(l, n) {
    if (xc)
      return l === "compositionend" || !Vo && bd(l, n) ? (l = Um(), dd = xm = ti = null, xc = !1, l) : null;
    switch (l) {
      case "paste":
        return null;
      case "keypress":
        if (!(n.ctrlKey || n.altKey || n.metaKey) || n.ctrlKey && n.altKey) {
          if (n.char && 1 < n.char.length)
            return n.char;
          if (n.which) return String.fromCharCode(n.which);
        }
        return null;
      case "compositionend":
        return Gm && n.locale !== "ko" ? null : n.data;
      default:
        return null;
    }
  }
  var Xm = {
    color: !0,
    date: !0,
    datetime: !0,
    "datetime-local": !0,
    email: !0,
    month: !0,
    number: !0,
    password: !0,
    range: !0,
    search: !0,
    tel: !0,
    text: !0,
    time: !0,
    url: !0,
    week: !0
  };
  function yu(l) {
    var n = l && l.nodeName && l.nodeName.toLowerCase();
    return n === "input" ? !!Xm[l.type] : n === "textarea";
  }
  function Qm(l, n, u, c) {
    hu ? _c ? _c.push(c) : _c = [c] : hu = c, n = Sr(n, "onChange"), 0 < n.length && (u = new Ts(
      "onChange",
      "change",
      null,
      u,
      c
    ), l.push({ event: u, listeners: n }));
  }
  var Uc = null, Yi = null;
  function Nc(l) {
    Cg(l, 0);
  }
  function Zo(l) {
    var n = jo(l);
    if (Dm(n)) return l;
  }
  function Vm(l, n) {
    if (l === "change") return n;
  }
  var Sd = !1;
  if (ei) {
    var da;
    if (ei) {
      var Bn = "oninput" in document;
      if (!Bn) {
        var Zm = document.createElement("div");
        Zm.setAttribute("oninput", "return;"), Bn = typeof Zm.oninput == "function";
      }
      da = Bn;
    } else da = !1;
    Sd = da && (!document.documentMode || 9 < document.documentMode);
  }
  function Ed() {
    Uc && (Uc.detachEvent("onpropertychange", Td), Yi = Uc = null);
  }
  function Td(l) {
    if (l.propertyName === "value" && Zo(Yi)) {
      var n = [];
      Qm(
        n,
        Yi,
        l,
        rd(l)
      ), Cm(Nc, n);
    }
  }
  function w0(l, n, u) {
    l === "focusin" ? (Ed(), Uc = n, Yi = u, Uc.attachEvent("onpropertychange", Td)) : l === "focusout" && Ed();
  }
  function B0(l) {
    if (l === "selectionchange" || l === "keyup" || l === "keydown")
      return Zo(Yi);
  }
  function qi(l, n) {
    if (l === "click") return Zo(n);
  }
  function Hc(l, n) {
    if (l === "input" || l === "change")
      return Zo(n);
  }
  function Y0(l, n) {
    return l === n && (l !== 0 || 1 / l === 1 / n) || l !== l && n !== n;
  }
  var na = typeof Object.is == "function" ? Object.is : Y0;
  function gn(l, n) {
    if (na(l, n)) return !0;
    if (typeof l != "object" || l === null || typeof n != "object" || n === null)
      return !1;
    var u = Object.keys(l), c = Object.keys(n);
    if (u.length !== c.length) return !1;
    for (c = 0; c < u.length; c++) {
      var s = u[c];
      if (!ds.call(n, s) || !na(l[s], n[s]))
        return !1;
    }
    return !0;
  }
  function Jm(l) {
    for (; l && l.firstChild; ) l = l.firstChild;
    return l;
  }
  function Km(l, n) {
    var u = Jm(l);
    l = 0;
    for (var c; u; ) {
      if (u.nodeType === 3) {
        if (c = l + u.textContent.length, l <= n && c >= n)
          return { node: u, offset: n - l };
        l = c;
      }
      e: {
        for (; u; ) {
          if (u.nextSibling) {
            u = u.nextSibling;
            break e;
          }
          u = u.parentNode;
        }
        u = void 0;
      }
      u = Jm(u);
    }
  }
  function jc(l, n) {
    return l && n ? l === n ? !0 : l && l.nodeType === 3 ? !1 : n && n.nodeType === 3 ? jc(l, n.parentNode) : "contains" in l ? l.contains(n) : l.compareDocumentPosition ? !!(l.compareDocumentPosition(n) & 16) : !1 : !1;
  }
  function Gi(l) {
    l = l != null && l.ownerDocument != null && l.ownerDocument.defaultView != null ? l.ownerDocument.defaultView : window;
    for (var n = ys(l.document); n instanceof l.HTMLIFrameElement; ) {
      try {
        var u = typeof n.contentWindow.location.href == "string";
      } catch {
        u = !1;
      }
      if (u) l = n.contentWindow;
      else break;
      n = ys(l.document);
    }
    return n;
  }
  function zs(l) {
    var n = l && l.nodeName && l.nodeName.toLowerCase();
    return n && (n === "input" && (l.type === "text" || l.type === "search" || l.type === "tel" || l.type === "url" || l.type === "password") || n === "textarea" || l.contentEditable === "true");
  }
  var Ds = ei && "documentMode" in document && 11 >= document.documentMode, Li = null, Jo = null, vn = null, Yn = !1;
  function Ad(l, n, u) {
    var c = u.window === u ? u.document : u.nodeType === 9 ? u : u.ownerDocument;
    Yn || Li == null || Li !== ys(c) || (c = Li, "selectionStart" in c && zs(c) ? c = { start: c.selectionStart, end: c.selectionEnd } : (c = (c.ownerDocument && c.ownerDocument.defaultView || window).getSelection(), c = {
      anchorNode: c.anchorNode,
      anchorOffset: c.anchorOffset,
      focusNode: c.focusNode,
      focusOffset: c.focusOffset
    }), vn && gn(vn, c) || (vn = c, c = Sr(Jo, "onSelect"), 0 < c.length && (n = new Ts(
      "onSelect",
      "select",
      null,
      n,
      u
    ), l.push({ event: n, listeners: c }), n.target = Li)));
  }
  function li(l, n) {
    var u = {};
    return u[l.toLowerCase()] = n.toLowerCase(), u["Webkit" + l] = "webkit" + n, u["Moz" + l] = "moz" + n, u;
  }
  var qn = {
    animationend: li("Animation", "AnimationEnd"),
    animationiteration: li("Animation", "AnimationIteration"),
    animationstart: li("Animation", "AnimationStart"),
    transitionrun: li("Transition", "TransitionRun"),
    transitionstart: li("Transition", "TransitionStart"),
    transitioncancel: li("Transition", "TransitionCancel"),
    transitionend: li("Transition", "TransitionEnd")
  }, Ko = {}, Xi = {};
  ei && (Xi = document.createElement("div").style, "AnimationEvent" in window || (delete qn.animationend.animation, delete qn.animationiteration.animation, delete qn.animationstart.animation), "TransitionEvent" in window || delete qn.transitionend.transition);
  function Et(l) {
    if (Ko[l]) return Ko[l];
    if (!qn[l]) return l;
    var n = qn[l], u;
    for (u in n)
      if (n.hasOwnProperty(u) && u in Xi)
        return Ko[l] = n[u];
    return l;
  }
  var _s = Et("animationend"), $m = Et("animationiteration"), Od = Et("animationstart"), wc = Et("transitionrun"), Rs = Et("transitionstart"), pu = Et("transitioncancel"), q0 = Et("transitionend"), gu = /* @__PURE__ */ new Map(), $o = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
    " "
  );
  $o.push("scrollEnd");
  function ha(l, n) {
    gu.set(l, n), ji(n, [l]);
  }
  var Bc = typeof reportError == "function" ? reportError : function(l) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var n = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof l == "object" && l !== null && typeof l.message == "string" ? String(l.message) : String(l),
        error: l
      });
      if (!window.dispatchEvent(n)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", l);
      return;
    }
    console.error(l);
  }, Ft = [], jl = 0, bn = 0;
  function Za() {
    for (var l = jl, n = bn = jl = 0; n < l; ) {
      var u = Ft[n];
      Ft[n++] = null;
      var c = Ft[n];
      Ft[n++] = null;
      var s = Ft[n];
      Ft[n++] = null;
      var r = Ft[n];
      if (Ft[n++] = null, c !== null && s !== null) {
        var m = c.pending;
        m === null ? s.next = s : (s.next = m.next, m.next = s), c.pending = s;
      }
      r !== 0 && zd(u, s, r);
    }
  }
  function Ja(l, n, u, c) {
    Ft[jl++] = l, Ft[jl++] = n, Ft[jl++] = u, Ft[jl++] = c, bn |= c, l.lanes |= c, l = l.alternate, l !== null && (l.lanes |= c);
  }
  function Sn(l, n, u, c) {
    return Ja(l, n, u, c), Ms(l);
  }
  function ai(l, n) {
    return Ja(l, null, null, n), Ms(l);
  }
  function zd(l, n, u) {
    l.lanes |= u;
    var c = l.alternate;
    c !== null && (c.lanes |= u);
    for (var s = !1, r = l.return; r !== null; )
      r.childLanes |= u, c = r.alternate, c !== null && (c.childLanes |= u), r.tag === 22 && (l = r.stateNode, l === null || l._visibility & 1 || (s = !0)), l = r, r = r.return;
    return l.tag === 3 ? (r = l.stateNode, s && n !== null && (s = 31 - Nl(u), l = r.hiddenUpdates, c = l[s], c === null ? l[s] = [n] : c.push(n), n.lane = u | 536870912), r) : null;
  }
  function Ms(l) {
    if (50 < Tf)
      throw Tf = 0, rr = null, Error(M(185));
    for (var n = l.return; n !== null; )
      l = n, n = l.return;
    return l.tag === 3 ? l.stateNode : null;
  }
  var ma = {};
  function G0(l, n, u, c) {
    this.tag = l, this.key = u, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = n, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = c, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function fl(l, n, u, c) {
    return new G0(l, n, u, c);
  }
  function Yc(l) {
    return l = l.prototype, !(!l || !l.isReactComponent);
  }
  function ni(l, n) {
    var u = l.alternate;
    return u === null ? (u = fl(
      l.tag,
      n,
      l.key,
      l.mode
    ), u.elementType = l.elementType, u.type = l.type, u.stateNode = l.stateNode, u.alternate = l, l.alternate = u) : (u.pendingProps = n, u.type = l.type, u.flags = 0, u.subtreeFlags = 0, u.deletions = null), u.flags = l.flags & 65011712, u.childLanes = l.childLanes, u.lanes = l.lanes, u.child = l.child, u.memoizedProps = l.memoizedProps, u.memoizedState = l.memoizedState, u.updateQueue = l.updateQueue, n = l.dependencies, u.dependencies = n === null ? null : { lanes: n.lanes, firstContext: n.firstContext }, u.sibling = l.sibling, u.index = l.index, u.ref = l.ref, u.refCleanup = l.refCleanup, u;
  }
  function km(l, n) {
    l.flags &= 65011714;
    var u = l.alternate;
    return u === null ? (l.childLanes = 0, l.lanes = n, l.child = null, l.subtreeFlags = 0, l.memoizedProps = null, l.memoizedState = null, l.updateQueue = null, l.dependencies = null, l.stateNode = null) : (l.childLanes = u.childLanes, l.lanes = u.lanes, l.child = u.child, l.subtreeFlags = 0, l.deletions = null, l.memoizedProps = u.memoizedProps, l.memoizedState = u.memoizedState, l.updateQueue = u.updateQueue, l.type = u.type, n = u.dependencies, l.dependencies = n === null ? null : {
      lanes: n.lanes,
      firstContext: n.firstContext
    }), l;
  }
  function Dd(l, n, u, c, s, r) {
    var m = 0;
    if (c = l, typeof l == "function") Yc(l) && (m = 1);
    else if (typeof l == "string")
      m = vp(
        l,
        u,
        ee.current
      ) ? 26 : l === "html" || l === "head" || l === "body" ? 27 : 5;
    else
      e: switch (l) {
        case Ct:
          return l = fl(31, u, n, s), l.elementType = Ct, l.lanes = r, l;
        case ie:
          return ui(u.children, s, r, n);
        case be:
          m = 8, s |= 24;
          break;
        case Ue:
          return l = fl(12, u, n, s | 2), l.elementType = Ue, l.lanes = r, l;
        case Bt:
          return l = fl(13, u, n, s), l.elementType = Bt, l.lanes = r, l;
        case qt:
          return l = fl(19, u, n, s), l.elementType = qt, l.lanes = r, l;
        default:
          if (typeof l == "object" && l !== null)
            switch (l.$$typeof) {
              case mt:
                m = 10;
                break e;
              case Jt:
                m = 9;
                break e;
              case Mt:
                m = 11;
                break e;
              case je:
                m = 14;
                break e;
              case We:
                m = 16, c = null;
                break e;
            }
          m = 29, u = Error(
            M(130, l === null ? "null" : typeof l, "")
          ), c = null;
      }
    return n = fl(m, u, n, s), n.elementType = l, n.type = c, n.lanes = r, n;
  }
  function ui(l, n, u, c) {
    return l = fl(7, l, c, n), l.lanes = u, l;
  }
  function ko(l, n, u) {
    return l = fl(6, l, null, n), l.lanes = u, l;
  }
  function Wm(l) {
    var n = fl(18, null, null, 0);
    return n.stateNode = l, n;
  }
  function _d(l, n, u) {
    return n = fl(
      4,
      l.children !== null ? l.children : [],
      l.key,
      n
    ), n.lanes = u, n.stateNode = {
      containerInfo: l.containerInfo,
      pendingChildren: null,
      implementation: l.implementation
    }, n;
  }
  var Fm = /* @__PURE__ */ new WeakMap();
  function Ka(l, n) {
    if (typeof l == "object" && l !== null) {
      var u = Fm.get(l);
      return u !== void 0 ? u : (n = {
        value: l,
        source: n,
        stack: bc(n)
      }, Fm.set(l, n), n);
    }
    return {
      value: l,
      source: n,
      stack: bc(n)
    };
  }
  var $a = [], qc = 0, Cs = null, ml = 0, Ra = [], ya = 0, Gn = null, Ma = 1, Ln = "";
  function En(l, n) {
    $a[qc++] = ml, $a[qc++] = Cs, Cs = l, ml = n;
  }
  function Im(l, n, u) {
    Ra[ya++] = Ma, Ra[ya++] = Ln, Ra[ya++] = Gn, Gn = l;
    var c = Ma;
    l = Ln;
    var s = 32 - Nl(c) - 1;
    c &= ~(1 << s), u += 1;
    var r = 32 - Nl(n) + s;
    if (30 < r) {
      var m = s - s % 5;
      r = (c & (1 << m) - 1).toString(32), c >>= m, s -= m, Ma = 1 << 32 - Nl(n) + s | u << s | c, Ln = r + l;
    } else
      Ma = 1 << r | u << s | c, Ln = l;
  }
  function Wo(l) {
    l.return !== null && (En(l, 1), Im(l, 1, 0));
  }
  function Rd(l) {
    for (; l === Cs; )
      Cs = $a[--qc], $a[qc] = null, ml = $a[--qc], $a[qc] = null;
    for (; l === Gn; )
      Gn = Ra[--ya], Ra[ya] = null, Ln = Ra[--ya], Ra[ya] = null, Ma = Ra[--ya], Ra[ya] = null;
  }
  function xs(l, n) {
    Ra[ya++] = Ma, Ra[ya++] = Ln, Ra[ya++] = Gn, Ma = n.id, Ln = n.overflow, Gn = l;
  }
  var wl = null, Lt = null, ot = !1, vu = null, Dl = !1, bu = Error(M(519));
  function Tn(l) {
    var n = Error(
      M(
        418,
        1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
        ""
      )
    );
    throw Io(Ka(n, l)), bu;
  }
  function Us(l) {
    var n = l.stateNode, u = l.type, c = l.memoizedProps;
    switch (n[xt] = l, n[ra] = c, u) {
      case "dialog":
        ct("cancel", n), ct("close", n);
        break;
      case "iframe":
      case "object":
      case "embed":
        ct("load", n);
        break;
      case "video":
      case "audio":
        for (u = 0; u < Rf.length; u++)
          ct(Rf[u], n);
        break;
      case "source":
        ct("error", n);
        break;
      case "img":
      case "image":
      case "link":
        ct("error", n), ct("load", n);
        break;
      case "details":
        ct("toggle", n);
        break;
      case "input":
        ct("invalid", n), gs(
          n,
          c.value,
          c.defaultValue,
          c.checked,
          c.defaultChecked,
          c.type,
          c.name,
          !0
        );
        break;
      case "select":
        ct("invalid", n);
        break;
      case "textarea":
        ct("invalid", n), Rm(n, c.value, c.defaultValue, c.children);
    }
    u = c.children, typeof u != "string" && typeof u != "number" && typeof u != "bigint" || n.textContent === "" + u || c.suppressHydrationWarning === !0 || cp(n.textContent, u) ? (c.popover != null && (ct("beforetoggle", n), ct("toggle", n)), c.onScroll != null && ct("scroll", n), c.onScrollEnd != null && ct("scrollend", n), c.onClick != null && (n.onclick = Nn), n = !0) : n = !1, n || Tn(l, !0);
  }
  function Fo(l) {
    for (wl = l.return; wl; )
      switch (wl.tag) {
        case 5:
        case 31:
        case 13:
          Dl = !1;
          return;
        case 27:
        case 3:
          Dl = !0;
          return;
        default:
          wl = wl.return;
      }
  }
  function Su(l) {
    if (l !== wl) return !1;
    if (!ot) return Fo(l), ot = !0, !1;
    var n = l.tag, u;
    if ((u = n !== 3 && n !== 27) && ((u = n === 5) && (u = l.type, u = !(u !== "form" && u !== "button") || Cf(l.type, l.memoizedProps)), u = !u), u && Lt && Tn(l), Fo(l), n === 13) {
      if (l = l.memoizedState, l = l !== null ? l.dehydrated : null, !l) throw Error(M(317));
      Lt = xh(l);
    } else if (n === 31) {
      if (l = l.memoizedState, l = l !== null ? l.dehydrated : null, !l) throw Error(M(317));
      Lt = xh(l);
    } else
      n === 27 ? (n = Lt, In(l.type) ? (l = Ar, Ar = null, Lt = l) : Lt = n) : Lt = wl ? za(l.stateNode.nextSibling) : null;
    return !0;
  }
  function Qi() {
    Lt = wl = null, ot = !1;
  }
  function Pm() {
    var l = vu;
    return l !== null && (cl === null ? cl = l : cl.push.apply(
      cl,
      l
    ), vu = null), l;
  }
  function Io(l) {
    vu === null ? vu = [l] : vu.push(l);
  }
  var Md = b(null), ii = null, Xn = null;
  function pa(l, n, u) {
    te(Md, n._currentValue), n._currentValue = u;
  }
  function Qn(l) {
    l._currentValue = Md.current, j(Md);
  }
  function Cd(l, n, u) {
    for (; l !== null; ) {
      var c = l.alternate;
      if ((l.childLanes & n) !== n ? (l.childLanes |= n, c !== null && (c.childLanes |= n)) : c !== null && (c.childLanes & n) !== n && (c.childLanes |= n), l === u) break;
      l = l.return;
    }
  }
  function Eu(l, n, u, c) {
    var s = l.child;
    for (s !== null && (s.return = l); s !== null; ) {
      var r = s.dependencies;
      if (r !== null) {
        var m = s.child;
        r = r.firstContext;
        e: for (; r !== null; ) {
          var v = r;
          r = s;
          for (var A = 0; A < n.length; A++)
            if (v.context === n[A]) {
              r.lanes |= u, v = r.alternate, v !== null && (v.lanes |= u), Cd(
                r.return,
                u,
                l
              ), c || (m = null);
              break e;
            }
          r = v.next;
        }
      } else if (s.tag === 18) {
        if (m = s.return, m === null) throw Error(M(341));
        m.lanes |= u, r = m.alternate, r !== null && (r.lanes |= u), Cd(m, u, l), m = null;
      } else m = s.child;
      if (m !== null) m.return = s;
      else
        for (m = s; m !== null; ) {
          if (m === l) {
            m = null;
            break;
          }
          if (s = m.sibling, s !== null) {
            s.return = m.return, m = s;
            break;
          }
          m = m.return;
        }
      s = m;
    }
  }
  function Bl(l, n, u, c) {
    l = null;
    for (var s = n, r = !1; s !== null; ) {
      if (!r) {
        if ((s.flags & 524288) !== 0) r = !0;
        else if ((s.flags & 262144) !== 0) break;
      }
      if (s.tag === 10) {
        var m = s.alternate;
        if (m === null) throw Error(M(387));
        if (m = m.memoizedProps, m !== null) {
          var v = s.type;
          na(s.pendingProps.value, m.value) || (l !== null ? l.push(v) : l = [v]);
        }
      } else if (s === Me.current) {
        if (m = s.alternate, m === null) throw Error(M(387));
        m.memoizedState.memoizedState !== s.memoizedState.memoizedState && (l !== null ? l.push(Dr) : l = [Dr]);
      }
      s = s.return;
    }
    l !== null && Eu(
      n,
      l,
      u,
      c
    ), n.flags |= 262144;
  }
  function Gc(l) {
    for (l = l.firstContext; l !== null; ) {
      if (!na(
        l.context._currentValue,
        l.memoizedValue
      ))
        return !0;
      l = l.next;
    }
    return !1;
  }
  function Le(l) {
    ii = l, Xn = null, l = l.dependencies, l !== null && (l.firstContext = null);
  }
  function I(l) {
    return Ns(ii, l);
  }
  function ci(l, n) {
    return ii === null && Le(l), Ns(l, n);
  }
  function Ns(l, n) {
    var u = n._currentValue;
    if (n = { context: n, memoizedValue: u, next: null }, Xn === null) {
      if (l === null) throw Error(M(308));
      Xn = n, l.dependencies = { lanes: 0, firstContext: n }, l.flags |= 524288;
    } else Xn = Xn.next = n;
    return u;
  }
  var sl = typeof AbortController < "u" ? AbortController : function() {
    var l = [], n = this.signal = {
      aborted: !1,
      addEventListener: function(u, c) {
        l.push(c);
      }
    };
    this.abort = function() {
      n.aborted = !0, l.forEach(function(u) {
        return u();
      });
    };
  }, ey = x.unstable_scheduleCallback, ty = x.unstable_NormalPriority, yl = {
    $$typeof: mt,
    Consumer: null,
    Provider: null,
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0
  };
  function Hs() {
    return {
      controller: new sl(),
      data: /* @__PURE__ */ new Map(),
      refCount: 0
    };
  }
  function js(l) {
    l.refCount--, l.refCount === 0 && ey(ty, function() {
      l.controller.abort();
    });
  }
  var Lc = null, ws = 0, Vi = 0, El = null;
  function zt(l, n) {
    if (Lc === null) {
      var u = Lc = [];
      ws = 0, Vi = Ah(), El = {
        status: "pending",
        value: void 0,
        then: function(c) {
          u.push(c);
        }
      };
    }
    return ws++, n.then(Bs, Bs), n;
  }
  function Bs() {
    if (--ws === 0 && Lc !== null) {
      El !== null && (El.status = "fulfilled");
      var l = Lc;
      Lc = null, Vi = 0, El = null;
      for (var n = 0; n < l.length; n++) (0, l[n])();
    }
  }
  function Ys(l, n) {
    var u = [], c = {
      status: "pending",
      value: null,
      reason: null,
      then: function(s) {
        u.push(s);
      }
    };
    return l.then(
      function() {
        c.status = "fulfilled", c.value = n;
        for (var s = 0; s < u.length; s++) (0, u[s])(n);
      },
      function(s) {
        for (c.status = "rejected", c.reason = s, s = 0; s < u.length; s++)
          (0, u[s])(void 0);
      }
    ), c;
  }
  var oi = _.S;
  _.S = function(l, n) {
    $y = Sl(), typeof n == "object" && n !== null && typeof n.then == "function" && zt(l, n), oi !== null && oi(l, n);
  };
  var ka = b(null);
  function Wa() {
    var l = ka.current;
    return l !== null ? l : Nt.pooledCache;
  }
  function Po(l, n) {
    n === null ? te(ka, ka.current) : te(ka, n.pool);
  }
  function Xc() {
    var l = Wa();
    return l === null ? null : { parent: yl._currentValue, pool: l };
  }
  var Zi = Error(M(460)), Qc = Error(M(474)), ef = Error(M(542)), Vc = { then: function() {
  } };
  function ly(l) {
    return l = l.status, l === "fulfilled" || l === "rejected";
  }
  function ay(l, n, u) {
    switch (u = l[u], u === void 0 ? l.push(n) : u !== n && (n.then(Nn, Nn), n = u), n.status) {
      case "fulfilled":
        return n.value;
      case "rejected":
        throw l = n.reason, xd(l), l;
      default:
        if (typeof n.status == "string") n.then(Nn, Nn);
        else {
          if (l = Nt, l !== null && 100 < l.shellSuspendCounter)
            throw Error(M(482));
          l = n, l.status = "pending", l.then(
            function(c) {
              if (n.status === "pending") {
                var s = n;
                s.status = "fulfilled", s.value = c;
              }
            },
            function(c) {
              if (n.status === "pending") {
                var s = n;
                s.status = "rejected", s.reason = c;
              }
            }
          );
        }
        switch (n.status) {
          case "fulfilled":
            return n.value;
          case "rejected":
            throw l = n.reason, xd(l), l;
        }
        throw Ki = n, Zi;
    }
  }
  function Ji(l) {
    try {
      var n = l._init;
      return n(l._payload);
    } catch (u) {
      throw u !== null && typeof u == "object" && typeof u.then == "function" ? (Ki = u, Zi) : u;
    }
  }
  var Ki = null;
  function ny() {
    if (Ki === null) throw Error(M(459));
    var l = Ki;
    return Ki = null, l;
  }
  function xd(l) {
    if (l === Zi || l === ef)
      throw Error(M(483));
  }
  var $i = null, Zc = 0;
  function qs(l) {
    var n = Zc;
    return Zc += 1, $i === null && ($i = []), ay($i, l, n);
  }
  function tf(l, n) {
    n = n.props.ref, l.ref = n !== void 0 ? n : null;
  }
  function Gs(l, n) {
    throw n.$$typeof === C ? Error(M(525)) : (l = Object.prototype.toString.call(n), Error(
      M(
        31,
        l === "[object Object]" ? "object with keys {" + Object.keys(n).join(", ") + "}" : l
      )
    ));
  }
  function L0(l) {
    function n(N, D) {
      if (l) {
        var H = N.deletions;
        H === null ? (N.deletions = [D], N.flags |= 16) : H.push(D);
      }
    }
    function u(N, D) {
      if (!l) return null;
      for (; D !== null; )
        n(N, D), D = D.sibling;
      return null;
    }
    function c(N) {
      for (var D = /* @__PURE__ */ new Map(); N !== null; )
        N.key !== null ? D.set(N.key, N) : D.set(N.index, N), N = N.sibling;
      return D;
    }
    function s(N, D) {
      return N = ni(N, D), N.index = 0, N.sibling = null, N;
    }
    function r(N, D, H) {
      return N.index = H, l ? (H = N.alternate, H !== null ? (H = H.index, H < D ? (N.flags |= 67108866, D) : H) : (N.flags |= 67108866, D)) : (N.flags |= 1048576, D);
    }
    function m(N) {
      return l && N.alternate === null && (N.flags |= 67108866), N;
    }
    function v(N, D, H, $) {
      return D === null || D.tag !== 6 ? (D = ko(H, N.mode, $), D.return = N, D) : (D = s(D, H), D.return = N, D);
    }
    function A(N, D, H, $) {
      var _e = H.type;
      return _e === ie ? Q(
        N,
        D,
        H.props.children,
        $,
        H.key
      ) : D !== null && (D.elementType === _e || typeof _e == "object" && _e !== null && _e.$$typeof === We && Ji(_e) === D.type) ? (D = s(D, H.props), tf(D, H), D.return = N, D) : (D = Dd(
        H.type,
        H.key,
        H.props,
        null,
        N.mode,
        $
      ), tf(D, H), D.return = N, D);
    }
    function w(N, D, H, $) {
      return D === null || D.tag !== 4 || D.stateNode.containerInfo !== H.containerInfo || D.stateNode.implementation !== H.implementation ? (D = _d(H, N.mode, $), D.return = N, D) : (D = s(D, H.children || []), D.return = N, D);
    }
    function Q(N, D, H, $, _e) {
      return D === null || D.tag !== 7 ? (D = ui(
        H,
        N.mode,
        $,
        _e
      ), D.return = N, D) : (D = s(D, H), D.return = N, D);
    }
    function W(N, D, H) {
      if (typeof D == "string" && D !== "" || typeof D == "number" || typeof D == "bigint")
        return D = ko(
          "" + D,
          N.mode,
          H
        ), D.return = N, D;
      if (typeof D == "object" && D !== null) {
        switch (D.$$typeof) {
          case ue:
            return H = Dd(
              D.type,
              D.key,
              D.props,
              null,
              N.mode,
              H
            ), tf(H, D), H.return = N, H;
          case xe:
            return D = _d(
              D,
              N.mode,
              H
            ), D.return = N, D;
          case We:
            return D = Ji(D), W(N, D, H);
        }
        if (Gt(D) || Ae(D))
          return D = ui(
            D,
            N.mode,
            H,
            null
          ), D.return = N, D;
        if (typeof D.then == "function")
          return W(N, qs(D), H);
        if (D.$$typeof === mt)
          return W(
            N,
            ci(N, D),
            H
          );
        Gs(N, D);
      }
      return null;
    }
    function Y(N, D, H, $) {
      var _e = D !== null ? D.key : null;
      if (typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint")
        return _e !== null ? null : v(N, D, "" + H, $);
      if (typeof H == "object" && H !== null) {
        switch (H.$$typeof) {
          case ue:
            return H.key === _e ? A(N, D, H, $) : null;
          case xe:
            return H.key === _e ? w(N, D, H, $) : null;
          case We:
            return H = Ji(H), Y(N, D, H, $);
        }
        if (Gt(H) || Ae(H))
          return _e !== null ? null : Q(N, D, H, $, null);
        if (typeof H.then == "function")
          return Y(
            N,
            D,
            qs(H),
            $
          );
        if (H.$$typeof === mt)
          return Y(
            N,
            D,
            ci(N, H),
            $
          );
        Gs(N, H);
      }
      return null;
    }
    function X(N, D, H, $, _e) {
      if (typeof $ == "string" && $ !== "" || typeof $ == "number" || typeof $ == "bigint")
        return N = N.get(H) || null, v(D, N, "" + $, _e);
      if (typeof $ == "object" && $ !== null) {
        switch ($.$$typeof) {
          case ue:
            return N = N.get(
              $.key === null ? H : $.key
            ) || null, A(D, N, $, _e);
          case xe:
            return N = N.get(
              $.key === null ? H : $.key
            ) || null, w(D, N, $, _e);
          case We:
            return $ = Ji($), X(
              N,
              D,
              H,
              $,
              _e
            );
        }
        if (Gt($) || Ae($))
          return N = N.get(H) || null, Q(D, N, $, _e, null);
        if (typeof $.then == "function")
          return X(
            N,
            D,
            H,
            qs($),
            _e
          );
        if ($.$$typeof === mt)
          return X(
            N,
            D,
            H,
            ci(D, $),
            _e
          );
        Gs(D, $);
      }
      return null;
    }
    function ye(N, D, H, $) {
      for (var _e = null, yt = null, Ee = D, Ke = D = 0, Ie = null; Ee !== null && Ke < H.length; Ke++) {
        Ee.index > Ke ? (Ie = Ee, Ee = null) : Ie = Ee.sibling;
        var St = Y(
          N,
          Ee,
          H[Ke],
          $
        );
        if (St === null) {
          Ee === null && (Ee = Ie);
          break;
        }
        l && Ee && St.alternate === null && n(N, Ee), D = r(St, D, Ke), yt === null ? _e = St : yt.sibling = St, yt = St, Ee = Ie;
      }
      if (Ke === H.length)
        return u(N, Ee), ot && En(N, Ke), _e;
      if (Ee === null) {
        for (; Ke < H.length; Ke++)
          Ee = W(N, H[Ke], $), Ee !== null && (D = r(
            Ee,
            D,
            Ke
          ), yt === null ? _e = Ee : yt.sibling = Ee, yt = Ee);
        return ot && En(N, Ke), _e;
      }
      for (Ee = c(Ee); Ke < H.length; Ke++)
        Ie = X(
          Ee,
          N,
          Ke,
          H[Ke],
          $
        ), Ie !== null && (l && Ie.alternate !== null && Ee.delete(
          Ie.key === null ? Ke : Ie.key
        ), D = r(
          Ie,
          D,
          Ke
        ), yt === null ? _e = Ie : yt.sibling = Ie, yt = Ie);
      return l && Ee.forEach(function(tu) {
        return n(N, tu);
      }), ot && En(N, Ke), _e;
    }
    function He(N, D, H, $) {
      if (H == null) throw Error(M(151));
      for (var _e = null, yt = null, Ee = D, Ke = D = 0, Ie = null, St = H.next(); Ee !== null && !St.done; Ke++, St = H.next()) {
        Ee.index > Ke ? (Ie = Ee, Ee = null) : Ie = Ee.sibling;
        var tu = Y(N, Ee, St.value, $);
        if (tu === null) {
          Ee === null && (Ee = Ie);
          break;
        }
        l && Ee && tu.alternate === null && n(N, Ee), D = r(tu, D, Ke), yt === null ? _e = tu : yt.sibling = tu, yt = tu, Ee = Ie;
      }
      if (St.done)
        return u(N, Ee), ot && En(N, Ke), _e;
      if (Ee === null) {
        for (; !St.done; Ke++, St = H.next())
          St = W(N, St.value, $), St !== null && (D = r(St, D, Ke), yt === null ? _e = St : yt.sibling = St, yt = St);
        return ot && En(N, Ke), _e;
      }
      for (Ee = c(Ee); !St.done; Ke++, St = H.next())
        St = X(Ee, N, Ke, St.value, $), St !== null && (l && St.alternate !== null && Ee.delete(St.key === null ? Ke : St.key), D = r(St, D, Ke), yt === null ? _e = St : yt.sibling = St, yt = St);
      return l && Ee.forEach(function(Zg) {
        return n(N, Zg);
      }), ot && En(N, Ke), _e;
    }
    function jt(N, D, H, $) {
      if (typeof H == "object" && H !== null && H.type === ie && H.key === null && (H = H.props.children), typeof H == "object" && H !== null) {
        switch (H.$$typeof) {
          case ue:
            e: {
              for (var _e = H.key; D !== null; ) {
                if (D.key === _e) {
                  if (_e = H.type, _e === ie) {
                    if (D.tag === 7) {
                      u(
                        N,
                        D.sibling
                      ), $ = s(
                        D,
                        H.props.children
                      ), $.return = N, N = $;
                      break e;
                    }
                  } else if (D.elementType === _e || typeof _e == "object" && _e !== null && _e.$$typeof === We && Ji(_e) === D.type) {
                    u(
                      N,
                      D.sibling
                    ), $ = s(D, H.props), tf($, H), $.return = N, N = $;
                    break e;
                  }
                  u(N, D);
                  break;
                } else n(N, D);
                D = D.sibling;
              }
              H.type === ie ? ($ = ui(
                H.props.children,
                N.mode,
                $,
                H.key
              ), $.return = N, N = $) : ($ = Dd(
                H.type,
                H.key,
                H.props,
                null,
                N.mode,
                $
              ), tf($, H), $.return = N, N = $);
            }
            return m(N);
          case xe:
            e: {
              for (_e = H.key; D !== null; ) {
                if (D.key === _e)
                  if (D.tag === 4 && D.stateNode.containerInfo === H.containerInfo && D.stateNode.implementation === H.implementation) {
                    u(
                      N,
                      D.sibling
                    ), $ = s(D, H.children || []), $.return = N, N = $;
                    break e;
                  } else {
                    u(N, D);
                    break;
                  }
                else n(N, D);
                D = D.sibling;
              }
              $ = _d(H, N.mode, $), $.return = N, N = $;
            }
            return m(N);
          case We:
            return H = Ji(H), jt(
              N,
              D,
              H,
              $
            );
        }
        if (Gt(H))
          return ye(
            N,
            D,
            H,
            $
          );
        if (Ae(H)) {
          if (_e = Ae(H), typeof _e != "function") throw Error(M(150));
          return H = _e.call(H), He(
            N,
            D,
            H,
            $
          );
        }
        if (typeof H.then == "function")
          return jt(
            N,
            D,
            qs(H),
            $
          );
        if (H.$$typeof === mt)
          return jt(
            N,
            D,
            ci(N, H),
            $
          );
        Gs(N, H);
      }
      return typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint" ? (H = "" + H, D !== null && D.tag === 6 ? (u(N, D.sibling), $ = s(D, H), $.return = N, N = $) : (u(N, D), $ = ko(H, N.mode, $), $.return = N, N = $), m(N)) : u(N, D);
    }
    return function(N, D, H, $) {
      try {
        Zc = 0;
        var _e = jt(
          N,
          D,
          H,
          $
        );
        return $i = null, _e;
      } catch (Ee) {
        if (Ee === Zi || Ee === ef) throw Ee;
        var yt = fl(29, Ee, null, N.mode);
        return yt.lanes = $, yt.return = N, yt;
      } finally {
      }
    };
  }
  var ki = L0(!0), uy = L0(!1), fi = !1;
  function Ls(l) {
    l.updateQueue = {
      baseState: l.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null
    };
  }
  function Ud(l, n) {
    l = l.updateQueue, n.updateQueue === l && (n.updateQueue = {
      baseState: l.baseState,
      firstBaseUpdate: l.firstBaseUpdate,
      lastBaseUpdate: l.lastBaseUpdate,
      shared: l.shared,
      callbacks: null
    });
  }
  function si(l) {
    return { lane: l, tag: 0, payload: null, callback: null, next: null };
  }
  function Fa(l, n, u) {
    var c = l.updateQueue;
    if (c === null) return null;
    if (c = c.shared, (bt & 2) !== 0) {
      var s = c.pending;
      return s === null ? n.next = n : (n.next = s.next, s.next = n), c.pending = n, n = Ms(l), zd(l, null, u), n;
    }
    return Ja(l, c, n, u), Ms(l);
  }
  function Wi(l, n, u) {
    if (n = n.updateQueue, n !== null && (n = n.shared, (u & 4194048) !== 0)) {
      var c = n.lanes;
      c &= l.pendingLanes, u |= c, n.lanes = u, fu(l, u);
    }
  }
  function Nd(l, n) {
    var u = l.updateQueue, c = l.alternate;
    if (c !== null && (c = c.updateQueue, u === c)) {
      var s = null, r = null;
      if (u = u.firstBaseUpdate, u !== null) {
        do {
          var m = {
            lane: u.lane,
            tag: u.tag,
            payload: u.payload,
            callback: null,
            next: null
          };
          r === null ? s = r = m : r = r.next = m, u = u.next;
        } while (u !== null);
        r === null ? s = r = n : r = r.next = n;
      } else s = r = n;
      u = {
        baseState: c.baseState,
        firstBaseUpdate: s,
        lastBaseUpdate: r,
        shared: c.shared,
        callbacks: c.callbacks
      }, l.updateQueue = u;
      return;
    }
    l = u.lastBaseUpdate, l === null ? u.firstBaseUpdate = n : l.next = n, u.lastBaseUpdate = n;
  }
  var iy = !1;
  function Fi() {
    if (iy) {
      var l = El;
      if (l !== null) throw l;
    }
  }
  function Tu(l, n, u, c) {
    iy = !1;
    var s = l.updateQueue;
    fi = !1;
    var r = s.firstBaseUpdate, m = s.lastBaseUpdate, v = s.shared.pending;
    if (v !== null) {
      s.shared.pending = null;
      var A = v, w = A.next;
      A.next = null, m === null ? r = w : m.next = w, m = A;
      var Q = l.alternate;
      Q !== null && (Q = Q.updateQueue, v = Q.lastBaseUpdate, v !== m && (v === null ? Q.firstBaseUpdate = w : v.next = w, Q.lastBaseUpdate = A));
    }
    if (r !== null) {
      var W = s.baseState;
      m = 0, Q = w = A = null, v = r;
      do {
        var Y = v.lane & -536870913, X = Y !== v.lane;
        if (X ? (ut & Y) === Y : (c & Y) === Y) {
          Y !== 0 && Y === Vi && (iy = !0), Q !== null && (Q = Q.next = {
            lane: 0,
            tag: v.tag,
            payload: v.payload,
            callback: null,
            next: null
          });
          e: {
            var ye = l, He = v;
            Y = n;
            var jt = u;
            switch (He.tag) {
              case 1:
                if (ye = He.payload, typeof ye == "function") {
                  W = ye.call(jt, W, Y);
                  break e;
                }
                W = ye;
                break e;
              case 3:
                ye.flags = ye.flags & -65537 | 128;
              case 0:
                if (ye = He.payload, Y = typeof ye == "function" ? ye.call(jt, W, Y) : ye, Y == null) break e;
                W = B({}, W, Y);
                break e;
              case 2:
                fi = !0;
            }
          }
          Y = v.callback, Y !== null && (l.flags |= 64, X && (l.flags |= 8192), X = s.callbacks, X === null ? s.callbacks = [Y] : X.push(Y));
        } else
          X = {
            lane: Y,
            tag: v.tag,
            payload: v.payload,
            callback: v.callback,
            next: null
          }, Q === null ? (w = Q = X, A = W) : Q = Q.next = X, m |= Y;
        if (v = v.next, v === null) {
          if (v = s.shared.pending, v === null)
            break;
          X = v, v = X.next, X.next = null, s.lastBaseUpdate = X, s.shared.pending = null;
        }
      } while (!0);
      Q === null && (A = W), s.baseState = A, s.firstBaseUpdate = w, s.lastBaseUpdate = Q, r === null && (s.shared.lanes = 0), Wn |= m, l.lanes = m, l.memoizedState = W;
    }
  }
  function Hd(l, n) {
    if (typeof l != "function")
      throw Error(M(191, l));
    l.call(n);
  }
  function Ii(l, n) {
    var u = l.callbacks;
    if (u !== null)
      for (l.callbacks = null, l = 0; l < u.length; l++)
        Hd(u[l], n);
  }
  var _l = b(null), Jc = b(0);
  function X0(l, n) {
    l = kn, te(Jc, l), te(_l, n), kn = l | n.baseLanes;
  }
  function Xs() {
    te(Jc, kn), te(_l, _l.current);
  }
  function lf() {
    kn = Jc.current, j(_l), j(Jc);
  }
  var ga = b(null), Ia = null;
  function Au(l) {
    var n = l.alternate;
    te(It, It.current & 1), te(ga, l), Ia === null && (n === null || _l.current !== null || n.memoizedState !== null) && (Ia = l);
  }
  function af(l) {
    te(It, It.current), te(ga, l), Ia === null && (Ia = l);
  }
  function jd(l) {
    l.tag === 22 ? (te(It, It.current), te(ga, l), Ia === null && (Ia = l)) : Vn();
  }
  function Vn() {
    te(It, It.current), te(ga, ga.current);
  }
  function va(l) {
    j(ga), Ia === l && (Ia = null), j(It);
  }
  var It = b(0);
  function nf(l) {
    for (var n = l; n !== null; ) {
      if (n.tag === 13) {
        var u = n.memoizedState;
        if (u !== null && (u = u.dehydrated, u === null || Dn(u) || sc(u)))
          return n;
      } else if (n.tag === 19 && (n.memoizedProps.revealOrder === "forwards" || n.memoizedProps.revealOrder === "backwards" || n.memoizedProps.revealOrder === "unstable_legacy-backwards" || n.memoizedProps.revealOrder === "together")) {
        if ((n.flags & 128) !== 0) return n;
      } else if (n.child !== null) {
        n.child.return = n, n = n.child;
        continue;
      }
      if (n === l) break;
      for (; n.sibling === null; ) {
        if (n.return === null || n.return === l) return null;
        n = n.return;
      }
      n.sibling.return = n.return, n = n.sibling;
    }
    return null;
  }
  var Ou = 0, $e = null, Dt = null, pl = null, Kc = !1, $c = !1, ri = !1, Qs = 0, uf = 0, Pi = null, Q0 = 0;
  function ul() {
    throw Error(M(321));
  }
  function di(l, n) {
    if (n === null) return !1;
    for (var u = 0; u < n.length && u < l.length; u++)
      if (!na(l[u], n[u])) return !1;
    return !0;
  }
  function Vs(l, n, u, c, s, r) {
    return Ou = r, $e = n, n.memoizedState = null, n.updateQueue = null, n.lanes = 0, _.H = l === null || l.memoizedState === null ? F0 : Id, ri = !1, r = u(c, s), ri = !1, $c && (r = V0(
      n,
      u,
      c,
      s
    )), wd(l), r;
  }
  function wd(l) {
    _.H = Ps;
    var n = Dt !== null && Dt.next !== null;
    if (Ou = 0, pl = Dt = $e = null, Kc = !1, uf = 0, Pi = null, n) throw Error(M(300));
    l === null || gl || (l = l.dependencies, l !== null && Gc(l) && (gl = !0));
  }
  function V0(l, n, u, c) {
    $e = l;
    var s = 0;
    do {
      if ($c && (Pi = null), uf = 0, $c = !1, 25 <= s) throw Error(M(301));
      if (s += 1, pl = Dt = null, l.updateQueue != null) {
        var r = l.updateQueue;
        r.lastEffect = null, r.events = null, r.stores = null, r.memoCache != null && (r.memoCache.index = 0);
      }
      _.H = I0, r = n(u, c);
    } while ($c);
    return r;
  }
  function t1() {
    var l = _.H, n = l.useState()[0];
    return n = typeof n.then == "function" ? Wc(n) : n, l = l.useState()[0], (Dt !== null ? Dt.memoizedState : null) !== l && ($e.flags |= 1024), n;
  }
  function Bd() {
    var l = Qs !== 0;
    return Qs = 0, l;
  }
  function kc(l, n, u) {
    n.updateQueue = l.updateQueue, n.flags &= -2053, l.lanes &= ~u;
  }
  function Zs(l) {
    if (Kc) {
      for (l = l.memoizedState; l !== null; ) {
        var n = l.queue;
        n !== null && (n.pending = null), l = l.next;
      }
      Kc = !1;
    }
    Ou = 0, pl = Dt = $e = null, $c = !1, uf = Qs = 0, Pi = null;
  }
  function Yl() {
    var l = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null
    };
    return pl === null ? $e.memoizedState = pl = l : pl = pl.next = l, pl;
  }
  function rl() {
    if (Dt === null) {
      var l = $e.alternate;
      l = l !== null ? l.memoizedState : null;
    } else l = Dt.next;
    var n = pl === null ? $e.memoizedState : pl.next;
    if (n !== null)
      pl = n, Dt = l;
    else {
      if (l === null)
        throw $e.alternate === null ? Error(M(467)) : Error(M(310));
      Dt = l, l = {
        memoizedState: Dt.memoizedState,
        baseState: Dt.baseState,
        baseQueue: Dt.baseQueue,
        queue: Dt.queue,
        next: null
      }, pl === null ? $e.memoizedState = pl = l : pl = pl.next = l;
    }
    return pl;
  }
  function Js() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function Wc(l) {
    var n = uf;
    return uf += 1, Pi === null && (Pi = []), l = ay(Pi, l, n), n = $e, (pl === null ? n.memoizedState : pl.next) === null && (n = n.alternate, _.H = n === null || n.memoizedState === null ? F0 : Id), l;
  }
  function cf(l) {
    if (l !== null && typeof l == "object") {
      if (typeof l.then == "function") return Wc(l);
      if (l.$$typeof === mt) return I(l);
    }
    throw Error(M(438, String(l)));
  }
  function Yd(l) {
    var n = null, u = $e.updateQueue;
    if (u !== null && (n = u.memoCache), n == null) {
      var c = $e.alternate;
      c !== null && (c = c.updateQueue, c !== null && (c = c.memoCache, c != null && (n = {
        data: c.data.map(function(s) {
          return s.slice();
        }),
        index: 0
      })));
    }
    if (n == null && (n = { data: [], index: 0 }), u === null && (u = Js(), $e.updateQueue = u), u.memoCache = n, u = n.data[n.index], u === void 0)
      for (u = n.data[n.index] = Array(l), c = 0; c < l; c++)
        u[c] = pe;
    return n.index++, u;
  }
  function zu(l, n) {
    return typeof n == "function" ? n(l) : n;
  }
  function Du(l) {
    var n = rl();
    return qd(n, Dt, l);
  }
  function qd(l, n, u) {
    var c = l.queue;
    if (c === null) throw Error(M(311));
    c.lastRenderedReducer = u;
    var s = l.baseQueue, r = c.pending;
    if (r !== null) {
      if (s !== null) {
        var m = s.next;
        s.next = r.next, r.next = m;
      }
      n.baseQueue = s = r, c.pending = null;
    }
    if (r = l.baseState, s === null) l.memoizedState = r;
    else {
      n = s.next;
      var v = m = null, A = null, w = n, Q = !1;
      do {
        var W = w.lane & -536870913;
        if (W !== w.lane ? (ut & W) === W : (Ou & W) === W) {
          var Y = w.revertLane;
          if (Y === 0)
            A !== null && (A = A.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: w.action,
              hasEagerState: w.hasEagerState,
              eagerState: w.eagerState,
              next: null
            }), W === Vi && (Q = !0);
          else if ((Ou & Y) === Y) {
            w = w.next, Y === Vi && (Q = !0);
            continue;
          } else
            W = {
              lane: 0,
              revertLane: w.revertLane,
              gesture: null,
              action: w.action,
              hasEagerState: w.hasEagerState,
              eagerState: w.eagerState,
              next: null
            }, A === null ? (v = A = W, m = r) : A = A.next = W, $e.lanes |= Y, Wn |= Y;
          W = w.action, ri && u(r, W), r = w.hasEagerState ? w.eagerState : u(r, W);
        } else
          Y = {
            lane: W,
            revertLane: w.revertLane,
            gesture: w.gesture,
            action: w.action,
            hasEagerState: w.hasEagerState,
            eagerState: w.eagerState,
            next: null
          }, A === null ? (v = A = Y, m = r) : A = A.next = Y, $e.lanes |= W, Wn |= W;
        w = w.next;
      } while (w !== null && w !== n);
      if (A === null ? m = r : A.next = v, !na(r, l.memoizedState) && (gl = !0, Q && (u = El, u !== null)))
        throw u;
      l.memoizedState = r, l.baseState = m, l.baseQueue = A, c.lastRenderedState = r;
    }
    return s === null && (c.lanes = 0), [l.memoizedState, c.dispatch];
  }
  function Gd(l) {
    var n = rl(), u = n.queue;
    if (u === null) throw Error(M(311));
    u.lastRenderedReducer = l;
    var c = u.dispatch, s = u.pending, r = n.memoizedState;
    if (s !== null) {
      u.pending = null;
      var m = s = s.next;
      do
        r = l(r, m.action), m = m.next;
      while (m !== s);
      na(r, n.memoizedState) || (gl = !0), n.memoizedState = r, n.baseQueue === null && (n.baseState = r), u.lastRenderedState = r;
    }
    return [r, c];
  }
  function cy(l, n, u) {
    var c = $e, s = rl(), r = ot;
    if (r) {
      if (u === void 0) throw Error(M(407));
      u = u();
    } else u = n();
    var m = !na(
      (Dt || s).memoizedState,
      u
    );
    if (m && (s.memoizedState = u, gl = !0), s = s.queue, Zd(Ld.bind(null, c, s, l), [
      l
    ]), s.getSnapshot !== n || m || pl !== null && pl.memoizedState.tag & 1) {
      if (c.flags |= 2048, Ic(
        9,
        { destroy: void 0 },
        oy.bind(
          null,
          c,
          s,
          u,
          n
        ),
        null
      ), Nt === null) throw Error(M(349));
      r || (Ou & 127) !== 0 || Ks(c, n, u);
    }
    return u;
  }
  function Ks(l, n, u) {
    l.flags |= 16384, l = { getSnapshot: n, value: u }, n = $e.updateQueue, n === null ? (n = Js(), $e.updateQueue = n, n.stores = [l]) : (u = n.stores, u === null ? n.stores = [l] : u.push(l));
  }
  function oy(l, n, u, c) {
    n.value = u, n.getSnapshot = c, Xd(n) && Qd(l);
  }
  function Ld(l, n, u) {
    return u(function() {
      Xd(n) && Qd(l);
    });
  }
  function Xd(l) {
    var n = l.getSnapshot;
    l = l.value;
    try {
      var u = n();
      return !na(l, u);
    } catch {
      return !0;
    }
  }
  function Qd(l) {
    var n = ai(l, 2);
    n !== null && Oa(n, l, 2);
  }
  function fy(l) {
    var n = Yl();
    if (typeof l == "function") {
      var u = l;
      if (l = u(), ri) {
        La(!0);
        try {
          u();
        } finally {
          La(!1);
        }
      }
    }
    return n.memoizedState = n.baseState = l, n.queue = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: zu,
      lastRenderedState: l
    }, n;
  }
  function ql(l, n, u, c) {
    return l.baseState = u, qd(
      l,
      Dt,
      typeof c == "function" ? c : zu
    );
  }
  function Z0(l, n, u, c, s) {
    if (Is(l)) throw Error(M(485));
    if (l = n.action, l !== null) {
      var r = {
        payload: s,
        action: l,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function(m) {
          r.listeners.push(m);
        }
      };
      _.T !== null ? u(!0) : r.isTransition = !1, c(r), u = n.pending, u === null ? (r.next = n.pending = r, sy(n, r)) : (r.next = u.next, n.pending = u.next = r);
    }
  }
  function sy(l, n) {
    var u = n.action, c = n.payload, s = l.state;
    if (n.isTransition) {
      var r = _.T, m = {};
      _.T = m;
      try {
        var v = u(s, c), A = _.S;
        A !== null && A(m, v), ry(l, n, v);
      } catch (w) {
        Fc(l, n, w);
      } finally {
        r !== null && m.types !== null && (r.types = m.types), _.T = r;
      }
    } else
      try {
        r = u(s, c), ry(l, n, r);
      } catch (w) {
        Fc(l, n, w);
      }
  }
  function ry(l, n, u) {
    u !== null && typeof u == "object" && typeof u.then == "function" ? u.then(
      function(c) {
        dy(l, n, c);
      },
      function(c) {
        return Fc(l, n, c);
      }
    ) : dy(l, n, u);
  }
  function dy(l, n, u) {
    n.status = "fulfilled", n.value = u, hy(n), l.state = u, n = l.pending, n !== null && (u = n.next, u === n ? l.pending = null : (u = u.next, n.next = u, sy(l, u)));
  }
  function Fc(l, n, u) {
    var c = l.pending;
    if (l.pending = null, c !== null) {
      c = c.next;
      do
        n.status = "rejected", n.reason = u, hy(n), n = n.next;
      while (n !== c);
    }
    l.action = null;
  }
  function hy(l) {
    l = l.listeners;
    for (var n = 0; n < l.length; n++) (0, l[n])();
  }
  function $s(l, n) {
    return n;
  }
  function my(l, n) {
    if (ot) {
      var u = Nt.formState;
      if (u !== null) {
        e: {
          var c = $e;
          if (ot) {
            if (Lt) {
              t: {
                for (var s = Lt, r = Dl; s.nodeType !== 8; ) {
                  if (!r) {
                    s = null;
                    break t;
                  }
                  if (s = za(
                    s.nextSibling
                  ), s === null) {
                    s = null;
                    break t;
                  }
                }
                r = s.data, s = r === "F!" || r === "F" ? s : null;
              }
              if (s) {
                Lt = za(
                  s.nextSibling
                ), c = s.data === "F!";
                break e;
              }
            }
            Tn(c);
          }
          c = !1;
        }
        c && (n = u[0]);
      }
    }
    return u = Yl(), u.memoizedState = u.baseState = n, c = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: $s,
      lastRenderedState: n
    }, u.queue = c, u = Wd.bind(
      null,
      $e,
      c
    ), c.dispatch = u, c = fy(!1), r = ec.bind(
      null,
      $e,
      !1,
      c.queue
    ), c = Yl(), s = {
      state: n,
      dispatch: null,
      action: l,
      pending: null
    }, c.queue = s, u = Z0.bind(
      null,
      $e,
      s,
      r,
      u
    ), s.dispatch = u, c.memoizedState = l, [n, u, !1];
  }
  function J0(l) {
    var n = rl();
    return ks(n, Dt, l);
  }
  function ks(l, n, u) {
    if (n = qd(
      l,
      n,
      $s
    )[0], l = Du(zu)[0], typeof n == "object" && n !== null && typeof n.then == "function")
      try {
        var c = Wc(n);
      } catch (m) {
        throw m === Zi ? ef : m;
      }
    else c = n;
    n = rl();
    var s = n.queue, r = s.dispatch;
    return u !== n.memoizedState && ($e.flags |= 2048, Ic(
      9,
      { destroy: void 0 },
      yy.bind(null, s, u),
      null
    )), [c, r, l];
  }
  function yy(l, n) {
    l.action = n;
  }
  function py(l) {
    var n = rl(), u = Dt;
    if (u !== null)
      return ks(n, u, l);
    rl(), n = n.memoizedState, u = rl();
    var c = u.queue.dispatch;
    return u.memoizedState = l, [n, c, !1];
  }
  function Ic(l, n, u, c) {
    return l = { tag: l, create: u, deps: c, inst: n, next: null }, n = $e.updateQueue, n === null && (n = Js(), $e.updateQueue = n), u = n.lastEffect, u === null ? n.lastEffect = l.next = l : (c = u.next, u.next = l, l.next = c, n.lastEffect = l), l;
  }
  function gy() {
    return rl().memoizedState;
  }
  function of(l, n, u, c) {
    var s = Yl();
    $e.flags |= l, s.memoizedState = Ic(
      1 | n,
      { destroy: void 0 },
      u,
      c === void 0 ? null : c
    );
  }
  function ff(l, n, u, c) {
    var s = rl();
    c = c === void 0 ? null : c;
    var r = s.memoizedState.inst;
    Dt !== null && c !== null && di(c, Dt.memoizedState.deps) ? s.memoizedState = Ic(n, r, u, c) : ($e.flags |= l, s.memoizedState = Ic(
      1 | n,
      r,
      u,
      c
    ));
  }
  function Vd(l, n) {
    of(8390656, 8, l, n);
  }
  function Zd(l, n) {
    ff(2048, 8, l, n);
  }
  function vy(l) {
    $e.flags |= 4;
    var n = $e.updateQueue;
    if (n === null)
      n = Js(), $e.updateQueue = n, n.events = [l];
    else {
      var u = n.events;
      u === null ? n.events = [l] : u.push(l);
    }
  }
  function Ws(l) {
    var n = rl().memoizedState;
    return vy({ ref: n, nextImpl: l }), function() {
      if ((bt & 2) !== 0) throw Error(M(440));
      return n.impl.apply(void 0, arguments);
    };
  }
  function Jd(l, n) {
    return ff(4, 2, l, n);
  }
  function by(l, n) {
    return ff(4, 4, l, n);
  }
  function Kd(l, n) {
    if (typeof n == "function") {
      l = l();
      var u = n(l);
      return function() {
        typeof u == "function" ? u() : n(null);
      };
    }
    if (n != null)
      return l = l(), n.current = l, function() {
        n.current = null;
      };
  }
  function Sy(l, n, u) {
    u = u != null ? u.concat([l]) : null, ff(4, 4, Kd.bind(null, n, l), u);
  }
  function Zn() {
  }
  function $d(l, n) {
    var u = rl();
    n = n === void 0 ? null : n;
    var c = u.memoizedState;
    return n !== null && di(n, c[1]) ? c[0] : (u.memoizedState = [l, n], l);
  }
  function K0(l, n) {
    var u = rl();
    n = n === void 0 ? null : n;
    var c = u.memoizedState;
    if (n !== null && di(n, c[1]))
      return c[0];
    if (c = l(), ri) {
      La(!0);
      try {
        l();
      } finally {
        La(!1);
      }
    }
    return u.memoizedState = [c, n], c;
  }
  function Fs(l, n, u) {
    return u === void 0 || (Ou & 1073741824) !== 0 && (ut & 261930) === 0 ? l.memoizedState = n : (l.memoizedState = u, l = og(), $e.lanes |= l, Wn |= l, u);
  }
  function _u(l, n, u, c) {
    return na(u, n) ? u : _l.current !== null ? (l = Fs(l, u, c), na(l, n) || (gl = !0), l) : (Ou & 42) === 0 || (Ou & 1073741824) !== 0 && (ut & 261930) === 0 ? (gl = !0, l.memoizedState = u) : (l = og(), $e.lanes |= l, Wn |= l, n);
  }
  function kd(l, n, u, c, s) {
    var r = Z.p;
    Z.p = r !== 0 && 8 > r ? r : 8;
    var m = _.T, v = {};
    _.T = v, ec(l, !1, n, u);
    try {
      var A = s(), w = _.S;
      if (w !== null && w(v, A), A !== null && typeof A == "object" && typeof A.then == "function") {
        var Q = Ys(
          A,
          c
        );
        hi(
          l,
          n,
          Q,
          Na(l)
        );
      } else
        hi(
          l,
          n,
          c,
          Na(l)
        );
    } catch (W) {
      hi(
        l,
        n,
        { then: function() {
        }, status: "rejected", reason: W },
        Na()
      );
    } finally {
      Z.p = r, m !== null && v.types !== null && (m.types = v.types), _.T = m;
    }
  }
  function $0() {
  }
  function sf(l, n, u, c) {
    if (l.tag !== 5) throw Error(M(476));
    var s = rf(l).queue;
    kd(
      l,
      s,
      n,
      ne,
      u === null ? $0 : function() {
        return Ut(l), u(c);
      }
    );
  }
  function rf(l) {
    var n = l.memoizedState;
    if (n !== null) return n;
    n = {
      memoizedState: ne,
      baseState: ne,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: zu,
        lastRenderedState: ne
      },
      next: null
    };
    var u = {};
    return n.next = {
      memoizedState: u,
      baseState: u,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: zu,
        lastRenderedState: u
      },
      next: null
    }, l.memoizedState = n, l = l.alternate, l !== null && (l.memoizedState = n), n;
  }
  function Ut(l) {
    var n = rf(l);
    n.next === null && (n = l.alternate.memoizedState), hi(
      l,
      n.next.queue,
      {},
      Na()
    );
  }
  function Ey() {
    return I(Dr);
  }
  function k0() {
    return rl().memoizedState;
  }
  function Ty() {
    return rl().memoizedState;
  }
  function Ru(l) {
    for (var n = l.return; n !== null; ) {
      switch (n.tag) {
        case 24:
        case 3:
          var u = Na();
          l = si(u);
          var c = Fa(n, l, u);
          c !== null && (Oa(c, n, u), Wi(c, n, u)), n = { cache: Hs() }, l.payload = n;
          return;
      }
      n = n.return;
    }
  }
  function W0(l, n, u) {
    var c = Na();
    u = {
      lane: c,
      revertLane: 0,
      gesture: null,
      action: u,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, Is(l) ? Fd(n, u) : (u = Sn(l, n, u, c), u !== null && (Oa(u, l, c), Ay(u, n, c)));
  }
  function Wd(l, n, u) {
    var c = Na();
    hi(l, n, u, c);
  }
  function hi(l, n, u, c) {
    var s = {
      lane: c,
      revertLane: 0,
      gesture: null,
      action: u,
      hasEagerState: !1,
      eagerState: null,
      next: null
    };
    if (Is(l)) Fd(n, s);
    else {
      var r = l.alternate;
      if (l.lanes === 0 && (r === null || r.lanes === 0) && (r = n.lastRenderedReducer, r !== null))
        try {
          var m = n.lastRenderedState, v = r(m, u);
          if (s.hasEagerState = !0, s.eagerState = v, na(v, m))
            return Ja(l, n, s, 0), Nt === null && Za(), !1;
        } catch {
        } finally {
        }
      if (u = Sn(l, n, s, c), u !== null)
        return Oa(u, l, c), Ay(u, n, c), !0;
    }
    return !1;
  }
  function ec(l, n, u, c) {
    if (c = {
      lane: 2,
      revertLane: Ah(),
      gesture: null,
      action: c,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, Is(l)) {
      if (n) throw Error(M(479));
    } else
      n = Sn(
        l,
        u,
        c,
        2
      ), n !== null && Oa(n, l, 2);
  }
  function Is(l) {
    var n = l.alternate;
    return l === $e || n !== null && n === $e;
  }
  function Fd(l, n) {
    $c = Kc = !0;
    var u = l.pending;
    u === null ? n.next = n : (n.next = u.next, u.next = n), l.pending = n;
  }
  function Ay(l, n, u) {
    if ((u & 4194048) !== 0) {
      var c = n.lanes;
      c &= l.pendingLanes, u |= c, n.lanes = u, fu(l, u);
    }
  }
  var Ps = {
    readContext: I,
    use: cf,
    useCallback: ul,
    useContext: ul,
    useEffect: ul,
    useImperativeHandle: ul,
    useLayoutEffect: ul,
    useInsertionEffect: ul,
    useMemo: ul,
    useReducer: ul,
    useRef: ul,
    useState: ul,
    useDebugValue: ul,
    useDeferredValue: ul,
    useTransition: ul,
    useSyncExternalStore: ul,
    useId: ul,
    useHostTransitionStatus: ul,
    useFormState: ul,
    useActionState: ul,
    useOptimistic: ul,
    useMemoCache: ul,
    useCacheRefresh: ul
  };
  Ps.useEffectEvent = ul;
  var F0 = {
    readContext: I,
    use: cf,
    useCallback: function(l, n) {
      return Yl().memoizedState = [
        l,
        n === void 0 ? null : n
      ], l;
    },
    useContext: I,
    useEffect: Vd,
    useImperativeHandle: function(l, n, u) {
      u = u != null ? u.concat([l]) : null, of(
        4194308,
        4,
        Kd.bind(null, n, l),
        u
      );
    },
    useLayoutEffect: function(l, n) {
      return of(4194308, 4, l, n);
    },
    useInsertionEffect: function(l, n) {
      of(4, 2, l, n);
    },
    useMemo: function(l, n) {
      var u = Yl();
      n = n === void 0 ? null : n;
      var c = l();
      if (ri) {
        La(!0);
        try {
          l();
        } finally {
          La(!1);
        }
      }
      return u.memoizedState = [c, n], c;
    },
    useReducer: function(l, n, u) {
      var c = Yl();
      if (u !== void 0) {
        var s = u(n);
        if (ri) {
          La(!0);
          try {
            u(n);
          } finally {
            La(!1);
          }
        }
      } else s = n;
      return c.memoizedState = c.baseState = s, l = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: l,
        lastRenderedState: s
      }, c.queue = l, l = l.dispatch = W0.bind(
        null,
        $e,
        l
      ), [c.memoizedState, l];
    },
    useRef: function(l) {
      var n = Yl();
      return l = { current: l }, n.memoizedState = l;
    },
    useState: function(l) {
      l = fy(l);
      var n = l.queue, u = Wd.bind(null, $e, n);
      return n.dispatch = u, [l.memoizedState, u];
    },
    useDebugValue: Zn,
    useDeferredValue: function(l, n) {
      var u = Yl();
      return Fs(u, l, n);
    },
    useTransition: function() {
      var l = fy(!1);
      return l = kd.bind(
        null,
        $e,
        l.queue,
        !0,
        !1
      ), Yl().memoizedState = l, [!1, l];
    },
    useSyncExternalStore: function(l, n, u) {
      var c = $e, s = Yl();
      if (ot) {
        if (u === void 0)
          throw Error(M(407));
        u = u();
      } else {
        if (u = n(), Nt === null)
          throw Error(M(349));
        (ut & 127) !== 0 || Ks(c, n, u);
      }
      s.memoizedState = u;
      var r = { value: u, getSnapshot: n };
      return s.queue = r, Vd(Ld.bind(null, c, r, l), [
        l
      ]), c.flags |= 2048, Ic(
        9,
        { destroy: void 0 },
        oy.bind(
          null,
          c,
          r,
          u,
          n
        ),
        null
      ), u;
    },
    useId: function() {
      var l = Yl(), n = Nt.identifierPrefix;
      if (ot) {
        var u = Ln, c = Ma;
        u = (c & ~(1 << 32 - Nl(c) - 1)).toString(32) + u, n = "_" + n + "R_" + u, u = Qs++, 0 < u && (n += "H" + u.toString(32)), n += "_";
      } else
        u = Q0++, n = "_" + n + "r_" + u.toString(32) + "_";
      return l.memoizedState = n;
    },
    useHostTransitionStatus: Ey,
    useFormState: my,
    useActionState: my,
    useOptimistic: function(l) {
      var n = Yl();
      n.memoizedState = n.baseState = l;
      var u = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      return n.queue = u, n = ec.bind(
        null,
        $e,
        !0,
        u
      ), u.dispatch = n, [l, n];
    },
    useMemoCache: Yd,
    useCacheRefresh: function() {
      return Yl().memoizedState = Ru.bind(
        null,
        $e
      );
    },
    useEffectEvent: function(l) {
      var n = Yl(), u = { impl: l };
      return n.memoizedState = u, function() {
        if ((bt & 2) !== 0)
          throw Error(M(440));
        return u.impl.apply(void 0, arguments);
      };
    }
  }, Id = {
    readContext: I,
    use: cf,
    useCallback: $d,
    useContext: I,
    useEffect: Zd,
    useImperativeHandle: Sy,
    useInsertionEffect: Jd,
    useLayoutEffect: by,
    useMemo: K0,
    useReducer: Du,
    useRef: gy,
    useState: function() {
      return Du(zu);
    },
    useDebugValue: Zn,
    useDeferredValue: function(l, n) {
      var u = rl();
      return _u(
        u,
        Dt.memoizedState,
        l,
        n
      );
    },
    useTransition: function() {
      var l = Du(zu)[0], n = rl().memoizedState;
      return [
        typeof l == "boolean" ? l : Wc(l),
        n
      ];
    },
    useSyncExternalStore: cy,
    useId: k0,
    useHostTransitionStatus: Ey,
    useFormState: J0,
    useActionState: J0,
    useOptimistic: function(l, n) {
      var u = rl();
      return ql(u, Dt, l, n);
    },
    useMemoCache: Yd,
    useCacheRefresh: Ty
  };
  Id.useEffectEvent = Ws;
  var I0 = {
    readContext: I,
    use: cf,
    useCallback: $d,
    useContext: I,
    useEffect: Zd,
    useImperativeHandle: Sy,
    useInsertionEffect: Jd,
    useLayoutEffect: by,
    useMemo: K0,
    useReducer: Gd,
    useRef: gy,
    useState: function() {
      return Gd(zu);
    },
    useDebugValue: Zn,
    useDeferredValue: function(l, n) {
      var u = rl();
      return Dt === null ? Fs(u, l, n) : _u(
        u,
        Dt.memoizedState,
        l,
        n
      );
    },
    useTransition: function() {
      var l = Gd(zu)[0], n = rl().memoizedState;
      return [
        typeof l == "boolean" ? l : Wc(l),
        n
      ];
    },
    useSyncExternalStore: cy,
    useId: k0,
    useHostTransitionStatus: Ey,
    useFormState: py,
    useActionState: py,
    useOptimistic: function(l, n) {
      var u = rl();
      return Dt !== null ? ql(u, Dt, l, n) : (u.baseState = l, [l, u.queue.dispatch]);
    },
    useMemoCache: Yd,
    useCacheRefresh: Ty
  };
  I0.useEffectEvent = Ws;
  function Pc(l, n, u, c) {
    n = l.memoizedState, u = u(c, n), u = u == null ? n : B({}, n, u), l.memoizedState = u, l.lanes === 0 && (l.updateQueue.baseState = u);
  }
  var An = {
    enqueueSetState: function(l, n, u) {
      l = l._reactInternals;
      var c = Na(), s = si(c);
      s.payload = n, u != null && (s.callback = u), n = Fa(l, s, c), n !== null && (Oa(n, l, c), Wi(n, l, c));
    },
    enqueueReplaceState: function(l, n, u) {
      l = l._reactInternals;
      var c = Na(), s = si(c);
      s.tag = 1, s.payload = n, u != null && (s.callback = u), n = Fa(l, s, c), n !== null && (Oa(n, l, c), Wi(n, l, c));
    },
    enqueueForceUpdate: function(l, n) {
      l = l._reactInternals;
      var u = Na(), c = si(u);
      c.tag = 2, n != null && (c.callback = n), n = Fa(l, c, u), n !== null && (Oa(n, l, u), Wi(n, l, u));
    }
  };
  function Oy(l, n, u, c, s, r, m) {
    return l = l.stateNode, typeof l.shouldComponentUpdate == "function" ? l.shouldComponentUpdate(c, r, m) : n.prototype && n.prototype.isPureReactComponent ? !gn(u, c) || !gn(s, r) : !0;
  }
  function P0(l, n, u, c) {
    l = n.state, typeof n.componentWillReceiveProps == "function" && n.componentWillReceiveProps(u, c), typeof n.UNSAFE_componentWillReceiveProps == "function" && n.UNSAFE_componentWillReceiveProps(u, c), n.state !== l && An.enqueueReplaceState(n, n.state, null);
  }
  function tc(l, n) {
    var u = n;
    if ("ref" in n) {
      u = {};
      for (var c in n)
        c !== "ref" && (u[c] = n[c]);
    }
    if (l = l.defaultProps) {
      u === n && (u = B({}, u));
      for (var s in l)
        u[s] === void 0 && (u[s] = l[s]);
    }
    return u;
  }
  function Pd(l) {
    Bc(l);
  }
  function zy(l) {
    console.error(l);
  }
  function eh(l) {
    Bc(l);
  }
  function df(l, n) {
    try {
      var u = l.onUncaughtError;
      u(n.value, { componentStack: n.stack });
    } catch (c) {
      setTimeout(function() {
        throw c;
      });
    }
  }
  function er(l, n, u) {
    try {
      var c = l.onCaughtError;
      c(u.value, {
        componentStack: u.stack,
        errorBoundary: n.tag === 1 ? n.stateNode : null
      });
    } catch (s) {
      setTimeout(function() {
        throw s;
      });
    }
  }
  function Dy(l, n, u) {
    return u = si(u), u.tag = 3, u.payload = { element: null }, u.callback = function() {
      df(l, n);
    }, u;
  }
  function _y(l) {
    return l = si(l), l.tag = 3, l;
  }
  function Ry(l, n, u, c) {
    var s = u.type.getDerivedStateFromError;
    if (typeof s == "function") {
      var r = c.value;
      l.payload = function() {
        return s(r);
      }, l.callback = function() {
        er(n, u, c);
      };
    }
    var m = u.stateNode;
    m !== null && typeof m.componentDidCatch == "function" && (l.callback = function() {
      er(n, u, c), typeof s != "function" && (Pt === null ? Pt = /* @__PURE__ */ new Set([this]) : Pt.add(this));
      var v = c.stack;
      this.componentDidCatch(c.value, {
        componentStack: v !== null ? v : ""
      });
    });
  }
  function l1(l, n, u, c, s) {
    if (u.flags |= 32768, c !== null && typeof c == "object" && typeof c.then == "function") {
      if (n = u.alternate, n !== null && Bl(
        n,
        u,
        s,
        !0
      ), u = ga.current, u !== null) {
        switch (u.tag) {
          case 31:
          case 13:
            return Ia === null ? bh() : u.alternate === null && Qt === 0 && (Qt = 3), u.flags &= -257, u.flags |= 65536, u.lanes = s, c === Vc ? u.flags |= 16384 : (n = u.updateQueue, n === null ? u.updateQueue = /* @__PURE__ */ new Set([c]) : n.add(c), mr(l, c, s)), !1;
          case 22:
            return u.flags |= 65536, c === Vc ? u.flags |= 16384 : (n = u.updateQueue, n === null ? (n = {
              transitions: null,
              markerInstances: null,
              retryQueue: /* @__PURE__ */ new Set([c])
            }, u.updateQueue = n) : (u = n.retryQueue, u === null ? n.retryQueue = /* @__PURE__ */ new Set([c]) : u.add(c)), mr(l, c, s)), !1;
        }
        throw Error(M(435, u.tag));
      }
      return mr(l, c, s), bh(), !1;
    }
    if (ot)
      return n = ga.current, n !== null ? ((n.flags & 65536) === 0 && (n.flags |= 256), n.flags |= 65536, n.lanes = s, c !== bu && (l = Error(M(422), { cause: c }), Io(Ka(l, u)))) : (c !== bu && (n = Error(M(423), {
        cause: c
      }), Io(
        Ka(n, u)
      )), l = l.current.alternate, l.flags |= 65536, s &= -s, l.lanes |= s, c = Ka(c, u), s = Dy(
        l.stateNode,
        c,
        s
      ), Nd(l, s), Qt !== 4 && (Qt = 2)), !1;
    var r = Error(M(520), { cause: c });
    if (r = Ka(r, u), sr === null ? sr = [r] : sr.push(r), Qt !== 4 && (Qt = 2), n === null) return !0;
    c = Ka(c, u), u = n;
    do {
      switch (u.tag) {
        case 3:
          return u.flags |= 65536, l = s & -s, u.lanes |= l, l = Dy(u.stateNode, c, l), Nd(u, l), !1;
        case 1:
          if (n = u.type, r = u.stateNode, (u.flags & 128) === 0 && (typeof n.getDerivedStateFromError == "function" || r !== null && typeof r.componentDidCatch == "function" && (Pt === null || !Pt.has(r))))
            return u.flags |= 65536, s &= -s, u.lanes |= s, s = _y(s), Ry(
              s,
              l,
              u,
              c
            ), Nd(u, s), !1;
      }
      u = u.return;
    } while (u !== null);
    return !1;
  }
  var th = Error(M(461)), gl = !1;
  function kt(l, n, u, c) {
    n.child = l === null ? uy(n, null, u, c) : ki(
      n,
      l.child,
      u,
      c
    );
  }
  function My(l, n, u, c, s) {
    u = u.render;
    var r = n.ref;
    if ("ref" in c) {
      var m = {};
      for (var v in c)
        v !== "ref" && (m[v] = c[v]);
    } else m = c;
    return Le(n), c = Vs(
      l,
      n,
      u,
      m,
      r,
      s
    ), v = Bd(), l !== null && !gl ? (kc(l, n, s), tn(l, n, s)) : (ot && v && Wo(n), n.flags |= 1, kt(l, n, c, s), n.child);
  }
  function Cy(l, n, u, c, s) {
    if (l === null) {
      var r = u.type;
      return typeof r == "function" && !Yc(r) && r.defaultProps === void 0 && u.compare === null ? (n.tag = 15, n.type = r, xy(
        l,
        n,
        r,
        c,
        s
      )) : (l = Dd(
        u.type,
        null,
        c,
        n,
        n.mode,
        s
      ), l.ref = n.ref, l.return = n, n.child = l);
    }
    if (r = l.child, !nh(l, s)) {
      var m = r.memoizedProps;
      if (u = u.compare, u = u !== null ? u : gn, u(m, c) && l.ref === n.ref)
        return tn(l, n, s);
    }
    return n.flags |= 1, l = ni(r, c), l.ref = n.ref, l.return = n, n.child = l;
  }
  function xy(l, n, u, c, s) {
    if (l !== null) {
      var r = l.memoizedProps;
      if (gn(r, c) && l.ref === n.ref)
        if (gl = !1, n.pendingProps = c = r, nh(l, s))
          (l.flags & 131072) !== 0 && (gl = !0);
        else
          return n.lanes = l.lanes, tn(l, n, s);
    }
    return lh(
      l,
      n,
      u,
      c,
      s
    );
  }
  function eg(l, n, u, c) {
    var s = c.children, r = l !== null ? l.memoizedState : null;
    if (l === null && n.stateNode === null && (n.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), c.mode === "hidden") {
      if ((n.flags & 128) !== 0) {
        if (r = r !== null ? r.baseLanes | u : u, l !== null) {
          for (c = n.child = l.child, s = 0; c !== null; )
            s = s | c.lanes | c.childLanes, c = c.sibling;
          c = s & ~r;
        } else c = 0, n.child = null;
        return ba(
          l,
          n,
          r,
          u,
          c
        );
      }
      if ((u & 536870912) !== 0)
        n.memoizedState = { baseLanes: 0, cachePool: null }, l !== null && Po(
          n,
          r !== null ? r.cachePool : null
        ), r !== null ? X0(n, r) : Xs(), jd(n);
      else
        return c = n.lanes = 536870912, ba(
          l,
          n,
          r !== null ? r.baseLanes | u : u,
          u,
          c
        );
    } else
      r !== null ? (Po(n, r.cachePool), X0(n, r), Vn(), n.memoizedState = null) : (l !== null && Po(n, null), Xs(), Vn());
    return kt(l, n, s, u), n.child;
  }
  function lc(l, n) {
    return l !== null && l.tag === 22 || n.stateNode !== null || (n.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), n.sibling;
  }
  function ba(l, n, u, c, s) {
    var r = Wa();
    return r = r === null ? null : { parent: yl._currentValue, pool: r }, n.memoizedState = {
      baseLanes: u,
      cachePool: r
    }, l !== null && Po(n, null), Xs(), jd(n), l !== null && Bl(l, n, c, !0), n.childLanes = s, null;
  }
  function tr(l, n) {
    return n = nr(
      { mode: n.mode, children: n.children },
      l.mode
    ), n.ref = l.ref, l.child = n, n.return = l, n;
  }
  function Sa(l, n, u) {
    return ki(n, l.child, null, u), l = tr(n, n.pendingProps), l.flags |= 2, va(n), n.memoizedState = null, l;
  }
  function tg(l, n, u) {
    var c = n.pendingProps, s = (n.flags & 128) !== 0;
    if (n.flags &= -129, l === null) {
      if (ot) {
        if (c.mode === "hidden")
          return l = tr(n, c), n.lanes = 536870912, lc(null, l);
        if (af(n), (l = Lt) ? (l = wg(
          l,
          Dl
        ), l = l !== null && l.data === "&" ? l : null, l !== null && (n.memoizedState = {
          dehydrated: l,
          treeContext: Gn !== null ? { id: Ma, overflow: Ln } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, u = Wm(l), u.return = n, n.child = u, wl = n, Lt = null)) : l = null, l === null) throw Tn(n);
        return n.lanes = 536870912, null;
      }
      return tr(n, c);
    }
    var r = l.memoizedState;
    if (r !== null) {
      var m = r.dehydrated;
      if (af(n), s)
        if (n.flags & 256)
          n.flags &= -257, n = Sa(
            l,
            n,
            u
          );
        else if (n.memoizedState !== null)
          n.child = l.child, n.flags |= 128, n = null;
        else throw Error(M(558));
      else if (gl || Bl(l, n, u, !1), s = (u & l.childLanes) !== 0, gl || s) {
        if (c = Nt, c !== null && (m = Xa(c, u), m !== 0 && m !== r.retryLane))
          throw r.retryLane = m, ai(l, m), Oa(c, l, m), th;
        bh(), n = Sa(
          l,
          n,
          u
        );
      } else
        l = r.treeContext, Lt = za(m.nextSibling), wl = n, ot = !0, vu = null, Dl = !1, l !== null && xs(n, l), n = tr(n, c), n.flags |= 4096;
      return n;
    }
    return l = ni(l.child, {
      mode: c.mode,
      children: c.children
    }), l.ref = n.ref, n.child = l, l.return = n, l;
  }
  function Pa(l, n) {
    var u = n.ref;
    if (u === null)
      l !== null && l.ref !== null && (n.flags |= 4194816);
    else {
      if (typeof u != "function" && typeof u != "object")
        throw Error(M(284));
      (l === null || l.ref !== u) && (n.flags |= 4194816);
    }
  }
  function lh(l, n, u, c, s) {
    return Le(n), u = Vs(
      l,
      n,
      u,
      c,
      void 0,
      s
    ), c = Bd(), l !== null && !gl ? (kc(l, n, s), tn(l, n, s)) : (ot && c && Wo(n), n.flags |= 1, kt(l, n, u, s), n.child);
  }
  function ac(l, n, u, c, s, r) {
    return Le(n), n.updateQueue = null, u = V0(
      n,
      c,
      u,
      s
    ), wd(l), c = Bd(), l !== null && !gl ? (kc(l, n, r), tn(l, n, r)) : (ot && c && Wo(n), n.flags |= 1, kt(l, n, u, r), n.child);
  }
  function Uy(l, n, u, c, s) {
    if (Le(n), n.stateNode === null) {
      var r = ma, m = u.contextType;
      typeof m == "object" && m !== null && (r = I(m)), r = new u(c, r), n.memoizedState = r.state !== null && r.state !== void 0 ? r.state : null, r.updater = An, n.stateNode = r, r._reactInternals = n, r = n.stateNode, r.props = c, r.state = n.memoizedState, r.refs = {}, Ls(n), m = u.contextType, r.context = typeof m == "object" && m !== null ? I(m) : ma, r.state = n.memoizedState, m = u.getDerivedStateFromProps, typeof m == "function" && (Pc(
        n,
        u,
        m,
        c
      ), r.state = n.memoizedState), typeof u.getDerivedStateFromProps == "function" || typeof r.getSnapshotBeforeUpdate == "function" || typeof r.UNSAFE_componentWillMount != "function" && typeof r.componentWillMount != "function" || (m = r.state, typeof r.componentWillMount == "function" && r.componentWillMount(), typeof r.UNSAFE_componentWillMount == "function" && r.UNSAFE_componentWillMount(), m !== r.state && An.enqueueReplaceState(r, r.state, null), Tu(n, c, r, s), Fi(), r.state = n.memoizedState), typeof r.componentDidMount == "function" && (n.flags |= 4194308), c = !0;
    } else if (l === null) {
      r = n.stateNode;
      var v = n.memoizedProps, A = tc(u, v);
      r.props = A;
      var w = r.context, Q = u.contextType;
      m = ma, typeof Q == "object" && Q !== null && (m = I(Q));
      var W = u.getDerivedStateFromProps;
      Q = typeof W == "function" || typeof r.getSnapshotBeforeUpdate == "function", v = n.pendingProps !== v, Q || typeof r.UNSAFE_componentWillReceiveProps != "function" && typeof r.componentWillReceiveProps != "function" || (v || w !== m) && P0(
        n,
        r,
        c,
        m
      ), fi = !1;
      var Y = n.memoizedState;
      r.state = Y, Tu(n, c, r, s), Fi(), w = n.memoizedState, v || Y !== w || fi ? (typeof W == "function" && (Pc(
        n,
        u,
        W,
        c
      ), w = n.memoizedState), (A = fi || Oy(
        n,
        u,
        A,
        c,
        Y,
        w,
        m
      )) ? (Q || typeof r.UNSAFE_componentWillMount != "function" && typeof r.componentWillMount != "function" || (typeof r.componentWillMount == "function" && r.componentWillMount(), typeof r.UNSAFE_componentWillMount == "function" && r.UNSAFE_componentWillMount()), typeof r.componentDidMount == "function" && (n.flags |= 4194308)) : (typeof r.componentDidMount == "function" && (n.flags |= 4194308), n.memoizedProps = c, n.memoizedState = w), r.props = c, r.state = w, r.context = m, c = A) : (typeof r.componentDidMount == "function" && (n.flags |= 4194308), c = !1);
    } else {
      r = n.stateNode, Ud(l, n), m = n.memoizedProps, Q = tc(u, m), r.props = Q, W = n.pendingProps, Y = r.context, w = u.contextType, A = ma, typeof w == "object" && w !== null && (A = I(w)), v = u.getDerivedStateFromProps, (w = typeof v == "function" || typeof r.getSnapshotBeforeUpdate == "function") || typeof r.UNSAFE_componentWillReceiveProps != "function" && typeof r.componentWillReceiveProps != "function" || (m !== W || Y !== A) && P0(
        n,
        r,
        c,
        A
      ), fi = !1, Y = n.memoizedState, r.state = Y, Tu(n, c, r, s), Fi();
      var X = n.memoizedState;
      m !== W || Y !== X || fi || l !== null && l.dependencies !== null && Gc(l.dependencies) ? (typeof v == "function" && (Pc(
        n,
        u,
        v,
        c
      ), X = n.memoizedState), (Q = fi || Oy(
        n,
        u,
        Q,
        c,
        Y,
        X,
        A
      ) || l !== null && l.dependencies !== null && Gc(l.dependencies)) ? (w || typeof r.UNSAFE_componentWillUpdate != "function" && typeof r.componentWillUpdate != "function" || (typeof r.componentWillUpdate == "function" && r.componentWillUpdate(c, X, A), typeof r.UNSAFE_componentWillUpdate == "function" && r.UNSAFE_componentWillUpdate(
        c,
        X,
        A
      )), typeof r.componentDidUpdate == "function" && (n.flags |= 4), typeof r.getSnapshotBeforeUpdate == "function" && (n.flags |= 1024)) : (typeof r.componentDidUpdate != "function" || m === l.memoizedProps && Y === l.memoizedState || (n.flags |= 4), typeof r.getSnapshotBeforeUpdate != "function" || m === l.memoizedProps && Y === l.memoizedState || (n.flags |= 1024), n.memoizedProps = c, n.memoizedState = X), r.props = c, r.state = X, r.context = A, c = Q) : (typeof r.componentDidUpdate != "function" || m === l.memoizedProps && Y === l.memoizedState || (n.flags |= 4), typeof r.getSnapshotBeforeUpdate != "function" || m === l.memoizedProps && Y === l.memoizedState || (n.flags |= 1024), c = !1);
    }
    return r = c, Pa(l, n), c = (n.flags & 128) !== 0, r || c ? (r = n.stateNode, u = c && typeof u.getDerivedStateFromError != "function" ? null : r.render(), n.flags |= 1, l !== null && c ? (n.child = ki(
      n,
      l.child,
      null,
      s
    ), n.child = ki(
      n,
      null,
      u,
      s
    )) : kt(l, n, u, s), n.memoizedState = r.state, l = n.child) : l = tn(
      l,
      n,
      s
    ), l;
  }
  function Jn(l, n, u, c) {
    return Qi(), n.flags |= 256, kt(l, n, u, c), n.child;
  }
  var lr = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null
  };
  function ar(l) {
    return { baseLanes: l, cachePool: Xc() };
  }
  function en(l, n, u) {
    return l = l !== null ? l.childLanes & ~u : 0, n && (l |= Aa), l;
  }
  function Ny(l, n, u) {
    var c = n.pendingProps, s = !1, r = (n.flags & 128) !== 0, m;
    if ((m = r) || (m = l !== null && l.memoizedState === null ? !1 : (It.current & 2) !== 0), m && (s = !0, n.flags &= -129), m = (n.flags & 32) !== 0, n.flags &= -33, l === null) {
      if (ot) {
        if (s ? Au(n) : Vn(), (l = Lt) ? (l = wg(
          l,
          Dl
        ), l = l !== null && l.data !== "&" ? l : null, l !== null && (n.memoizedState = {
          dehydrated: l,
          treeContext: Gn !== null ? { id: Ma, overflow: Ln } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, u = Wm(l), u.return = n, n.child = u, wl = n, Lt = null)) : l = null, l === null) throw Tn(n);
        return sc(l) ? n.lanes = 32 : n.lanes = 536870912, null;
      }
      var v = c.children;
      return c = c.fallback, s ? (Vn(), s = n.mode, v = nr(
        { mode: "hidden", children: v },
        s
      ), c = ui(
        c,
        s,
        u,
        null
      ), v.return = n, c.return = n, v.sibling = c, n.child = v, c = n.child, c.memoizedState = ar(u), c.childLanes = en(
        l,
        m,
        u
      ), n.memoizedState = lr, lc(null, c)) : (Au(n), nc(n, v));
    }
    var A = l.memoizedState;
    if (A !== null && (v = A.dehydrated, v !== null)) {
      if (r)
        n.flags & 256 ? (Au(n), n.flags &= -257, n = eo(
          l,
          n,
          u
        )) : n.memoizedState !== null ? (Vn(), n.child = l.child, n.flags |= 128, n = null) : (Vn(), v = c.fallback, s = n.mode, c = nr(
          { mode: "visible", children: c.children },
          s
        ), v = ui(
          v,
          s,
          u,
          null
        ), v.flags |= 2, c.return = n, v.return = n, c.sibling = v, n.child = c, ki(
          n,
          l.child,
          null,
          u
        ), c = n.child, c.memoizedState = ar(u), c.childLanes = en(
          l,
          m,
          u
        ), n.memoizedState = lr, n = lc(null, c));
      else if (Au(n), sc(v)) {
        if (m = v.nextSibling && v.nextSibling.dataset, m) var w = m.dgst;
        m = w, c = Error(M(419)), c.stack = "", c.digest = m, Io({ value: c, source: null, stack: null }), n = eo(
          l,
          n,
          u
        );
      } else if (gl || Bl(l, n, u, !1), m = (u & l.childLanes) !== 0, gl || m) {
        if (m = Nt, m !== null && (c = Xa(m, u), c !== 0 && c !== A.retryLane))
          throw A.retryLane = c, ai(l, c), Oa(m, l, c), th;
        Dn(v) || bh(), n = eo(
          l,
          n,
          u
        );
      } else
        Dn(v) ? (n.flags |= 192, n.child = l.child, n = null) : (l = A.treeContext, Lt = za(
          v.nextSibling
        ), wl = n, ot = !0, vu = null, Dl = !1, l !== null && xs(n, l), n = nc(
          n,
          c.children
        ), n.flags |= 4096);
      return n;
    }
    return s ? (Vn(), v = c.fallback, s = n.mode, A = l.child, w = A.sibling, c = ni(A, {
      mode: "hidden",
      children: c.children
    }), c.subtreeFlags = A.subtreeFlags & 65011712, w !== null ? v = ni(
      w,
      v
    ) : (v = ui(
      v,
      s,
      u,
      null
    ), v.flags |= 2), v.return = n, c.return = n, c.sibling = v, n.child = c, lc(null, c), c = n.child, v = l.child.memoizedState, v === null ? v = ar(u) : (s = v.cachePool, s !== null ? (A = yl._currentValue, s = s.parent !== A ? { parent: A, pool: A } : s) : s = Xc(), v = {
      baseLanes: v.baseLanes | u,
      cachePool: s
    }), c.memoizedState = v, c.childLanes = en(
      l,
      m,
      u
    ), n.memoizedState = lr, lc(l.child, c)) : (Au(n), u = l.child, l = u.sibling, u = ni(u, {
      mode: "visible",
      children: c.children
    }), u.return = n, u.sibling = null, l !== null && (m = n.deletions, m === null ? (n.deletions = [l], n.flags |= 16) : m.push(l)), n.child = u, n.memoizedState = null, u);
  }
  function nc(l, n) {
    return n = nr(
      { mode: "visible", children: n },
      l.mode
    ), n.return = l, l.child = n;
  }
  function nr(l, n) {
    return l = fl(22, l, null, n), l.lanes = 0, l;
  }
  function eo(l, n, u) {
    return ki(n, l.child, null, u), l = nc(
      n,
      n.pendingProps.children
    ), l.flags |= 2, n.memoizedState = null, l;
  }
  function to(l, n, u) {
    l.lanes |= n;
    var c = l.alternate;
    c !== null && (c.lanes |= n), Cd(l.return, n, u);
  }
  function ah(l, n, u, c, s, r) {
    var m = l.memoizedState;
    m === null ? l.memoizedState = {
      isBackwards: n,
      rendering: null,
      renderingStartTime: 0,
      last: c,
      tail: u,
      tailMode: s,
      treeForkCount: r
    } : (m.isBackwards = n, m.rendering = null, m.renderingStartTime = 0, m.last = c, m.tail = u, m.tailMode = s, m.treeForkCount = r);
  }
  function Hy(l, n, u) {
    var c = n.pendingProps, s = c.revealOrder, r = c.tail;
    c = c.children;
    var m = It.current, v = (m & 2) !== 0;
    if (v ? (m = m & 1 | 2, n.flags |= 128) : m &= 1, te(It, m), kt(l, n, c, u), c = ot ? ml : 0, !v && l !== null && (l.flags & 128) !== 0)
      e: for (l = n.child; l !== null; ) {
        if (l.tag === 13)
          l.memoizedState !== null && to(l, u, n);
        else if (l.tag === 19)
          to(l, u, n);
        else if (l.child !== null) {
          l.child.return = l, l = l.child;
          continue;
        }
        if (l === n) break e;
        for (; l.sibling === null; ) {
          if (l.return === null || l.return === n)
            break e;
          l = l.return;
        }
        l.sibling.return = l.return, l = l.sibling;
      }
    switch (s) {
      case "forwards":
        for (u = n.child, s = null; u !== null; )
          l = u.alternate, l !== null && nf(l) === null && (s = u), u = u.sibling;
        u = s, u === null ? (s = n.child, n.child = null) : (s = u.sibling, u.sibling = null), ah(
          n,
          !1,
          s,
          u,
          r,
          c
        );
        break;
      case "backwards":
      case "unstable_legacy-backwards":
        for (u = null, s = n.child, n.child = null; s !== null; ) {
          if (l = s.alternate, l !== null && nf(l) === null) {
            n.child = s;
            break;
          }
          l = s.sibling, s.sibling = u, u = s, s = l;
        }
        ah(
          n,
          !0,
          u,
          null,
          r,
          c
        );
        break;
      case "together":
        ah(
          n,
          !1,
          null,
          null,
          void 0,
          c
        );
        break;
      default:
        n.memoizedState = null;
    }
    return n.child;
  }
  function tn(l, n, u) {
    if (l !== null && (n.dependencies = l.dependencies), Wn |= n.lanes, (u & n.childLanes) === 0)
      if (l !== null) {
        if (Bl(
          l,
          n,
          u,
          !1
        ), (u & n.childLanes) === 0)
          return null;
      } else return null;
    if (l !== null && n.child !== l.child)
      throw Error(M(153));
    if (n.child !== null) {
      for (l = n.child, u = ni(l, l.pendingProps), n.child = u, u.return = n; l.sibling !== null; )
        l = l.sibling, u = u.sibling = ni(l, l.pendingProps), u.return = n;
      u.sibling = null;
    }
    return n.child;
  }
  function nh(l, n) {
    return (l.lanes & n) !== 0 ? !0 : (l = l.dependencies, !!(l !== null && Gc(l)));
  }
  function uh(l, n, u) {
    switch (n.tag) {
      case 3:
        $t(n, n.stateNode.containerInfo), pa(n, yl, l.memoizedState.cache), Qi();
        break;
      case 27:
      case 5:
        qa(n);
        break;
      case 4:
        $t(n, n.stateNode.containerInfo);
        break;
      case 10:
        pa(
          n,
          n.type,
          n.memoizedProps.value
        );
        break;
      case 31:
        if (n.memoizedState !== null)
          return n.flags |= 128, af(n), null;
        break;
      case 13:
        var c = n.memoizedState;
        if (c !== null)
          return c.dehydrated !== null ? (Au(n), n.flags |= 128, null) : (u & n.child.childLanes) !== 0 ? Ny(l, n, u) : (Au(n), l = tn(
            l,
            n,
            u
          ), l !== null ? l.sibling : null);
        Au(n);
        break;
      case 19:
        var s = (l.flags & 128) !== 0;
        if (c = (u & n.childLanes) !== 0, c || (Bl(
          l,
          n,
          u,
          !1
        ), c = (u & n.childLanes) !== 0), s) {
          if (c)
            return Hy(
              l,
              n,
              u
            );
          n.flags |= 128;
        }
        if (s = n.memoizedState, s !== null && (s.rendering = null, s.tail = null, s.lastEffect = null), te(It, It.current), c) break;
        return null;
      case 22:
        return n.lanes = 0, eg(
          l,
          n,
          u,
          n.pendingProps
        );
      case 24:
        pa(n, yl, l.memoizedState.cache);
    }
    return tn(l, n, u);
  }
  function jy(l, n, u) {
    if (l !== null)
      if (l.memoizedProps !== n.pendingProps)
        gl = !0;
      else {
        if (!nh(l, u) && (n.flags & 128) === 0)
          return gl = !1, uh(
            l,
            n,
            u
          );
        gl = (l.flags & 131072) !== 0;
      }
    else
      gl = !1, ot && (n.flags & 1048576) !== 0 && Im(n, ml, n.index);
    switch (n.lanes = 0, n.tag) {
      case 16:
        e: {
          var c = n.pendingProps;
          if (l = Ji(n.elementType), n.type = l, typeof l == "function")
            Yc(l) ? (c = tc(l, c), n.tag = 1, n = Uy(
              null,
              n,
              l,
              c,
              u
            )) : (n.tag = 0, n = lh(
              null,
              n,
              l,
              c,
              u
            ));
          else {
            if (l != null) {
              var s = l.$$typeof;
              if (s === Mt) {
                n.tag = 11, n = My(
                  null,
                  n,
                  l,
                  c,
                  u
                );
                break e;
              } else if (s === je) {
                n.tag = 14, n = Cy(
                  null,
                  n,
                  l,
                  c,
                  u
                );
                break e;
              }
            }
            throw n = Kt(l) || l, Error(M(306, n, ""));
          }
        }
        return n;
      case 0:
        return lh(
          l,
          n,
          n.type,
          n.pendingProps,
          u
        );
      case 1:
        return c = n.type, s = tc(
          c,
          n.pendingProps
        ), Uy(
          l,
          n,
          c,
          s,
          u
        );
      case 3:
        e: {
          if ($t(
            n,
            n.stateNode.containerInfo
          ), l === null) throw Error(M(387));
          c = n.pendingProps;
          var r = n.memoizedState;
          s = r.element, Ud(l, n), Tu(n, c, null, u);
          var m = n.memoizedState;
          if (c = m.cache, pa(n, yl, c), c !== r.cache && Eu(
            n,
            [yl],
            u,
            !0
          ), Fi(), c = m.element, r.isDehydrated)
            if (r = {
              element: c,
              isDehydrated: !1,
              cache: m.cache
            }, n.updateQueue.baseState = r, n.memoizedState = r, n.flags & 256) {
              n = Jn(
                l,
                n,
                c,
                u
              );
              break e;
            } else if (c !== s) {
              s = Ka(
                Error(M(424)),
                n
              ), Io(s), n = Jn(
                l,
                n,
                c,
                u
              );
              break e;
            } else {
              switch (l = n.stateNode.containerInfo, l.nodeType) {
                case 9:
                  l = l.body;
                  break;
                default:
                  l = l.nodeName === "HTML" ? l.ownerDocument.body : l;
              }
              for (Lt = za(l.firstChild), wl = n, ot = !0, vu = null, Dl = !0, u = uy(
                n,
                null,
                c,
                u
              ), n.child = u; u; )
                u.flags = u.flags & -3 | 4096, u = u.sibling;
            }
          else {
            if (Qi(), c === s) {
              n = tn(
                l,
                n,
                u
              );
              break e;
            }
            kt(l, n, c, u);
          }
          n = n.child;
        }
        return n;
      case 26:
        return Pa(l, n), l === null ? (u = Hf(
          n.type,
          null,
          n.pendingProps,
          null
        )) ? n.memoizedState = u : ot || (u = n.type, l = n.pendingProps, c = fc(
          Ze.current
        ).createElement(u), c[xt] = n, c[ra] = l, Wl(c, u, l), Ot(c), n.stateNode = c) : n.memoizedState = Hf(
          n.type,
          l.memoizedProps,
          n.pendingProps,
          l.memoizedState
        ), null;
      case 27:
        return qa(n), l === null && ot && (c = n.stateNode = Uf(
          n.type,
          n.pendingProps,
          Ze.current
        ), wl = n, Dl = !0, s = Lt, In(n.type) ? (Ar = s, Lt = za(c.firstChild)) : Lt = s), kt(
          l,
          n,
          n.pendingProps.children,
          u
        ), Pa(l, n), l === null && (n.flags |= 4194304), n.child;
      case 5:
        return l === null && ot && ((s = c = Lt) && (c = u1(
          c,
          n.type,
          n.pendingProps,
          Dl
        ), c !== null ? (n.stateNode = c, wl = n, Lt = za(c.firstChild), Dl = !1, s = !0) : s = !1), s || Tn(n)), qa(n), s = n.type, r = n.pendingProps, m = l !== null ? l.memoizedProps : null, c = r.children, Cf(s, r) ? c = null : m !== null && Cf(s, m) && (n.flags |= 32), n.memoizedState !== null && (s = Vs(
          l,
          n,
          t1,
          null,
          null,
          u
        ), Dr._currentValue = s), Pa(l, n), kt(l, n, c, u), n.child;
      case 6:
        return l === null && ot && ((l = u = Lt) && (u = et(
          u,
          n.pendingProps,
          Dl
        ), u !== null ? (n.stateNode = u, wl = n, Lt = null, l = !0) : l = !1), l || Tn(n)), null;
      case 13:
        return Ny(l, n, u);
      case 4:
        return $t(
          n,
          n.stateNode.containerInfo
        ), c = n.pendingProps, l === null ? n.child = ki(
          n,
          null,
          c,
          u
        ) : kt(l, n, c, u), n.child;
      case 11:
        return My(
          l,
          n,
          n.type,
          n.pendingProps,
          u
        );
      case 7:
        return kt(
          l,
          n,
          n.pendingProps,
          u
        ), n.child;
      case 8:
        return kt(
          l,
          n,
          n.pendingProps.children,
          u
        ), n.child;
      case 12:
        return kt(
          l,
          n,
          n.pendingProps.children,
          u
        ), n.child;
      case 10:
        return c = n.pendingProps, pa(n, n.type, c.value), kt(l, n, c.children, u), n.child;
      case 9:
        return s = n.type._context, c = n.pendingProps.children, Le(n), s = I(s), c = c(s), n.flags |= 1, kt(l, n, c, u), n.child;
      case 14:
        return Cy(
          l,
          n,
          n.type,
          n.pendingProps,
          u
        );
      case 15:
        return xy(
          l,
          n,
          n.type,
          n.pendingProps,
          u
        );
      case 19:
        return Hy(l, n, u);
      case 31:
        return tg(l, n, u);
      case 22:
        return eg(
          l,
          n,
          u,
          n.pendingProps
        );
      case 24:
        return Le(n), c = I(yl), l === null ? (s = Wa(), s === null && (s = Nt, r = Hs(), s.pooledCache = r, r.refCount++, r !== null && (s.pooledCacheLanes |= u), s = r), n.memoizedState = { parent: c, cache: s }, Ls(n), pa(n, yl, s)) : ((l.lanes & u) !== 0 && (Ud(l, n), Tu(n, null, null, u), Fi()), s = l.memoizedState, r = n.memoizedState, s.parent !== c ? (s = { parent: c, cache: c }, n.memoizedState = s, n.lanes === 0 && (n.memoizedState = n.updateQueue.baseState = s), pa(n, yl, c)) : (c = r.cache, pa(n, yl, c), c !== s.cache && Eu(
          n,
          [yl],
          u,
          !0
        ))), kt(
          l,
          n,
          n.pendingProps.children,
          u
        ), n.child;
      case 29:
        throw n.pendingProps;
    }
    throw Error(M(156, n.tag));
  }
  function Mu(l) {
    l.flags |= 4;
  }
  function wy(l, n, u, c, s) {
    if ((n = (l.mode & 32) !== 0) && (n = !1), n) {
      if (l.flags |= 16777216, (s & 335544128) === s)
        if (l.stateNode.complete) l.flags |= 8192;
        else if (rg()) l.flags |= 8192;
        else
          throw Ki = Vc, Qc;
    } else l.flags &= -16777217;
  }
  function By(l, n) {
    if (n.type !== "stylesheet" || (n.state.loading & 4) !== 0)
      l.flags &= -16777217;
    else if (l.flags |= 16777216, !ja(n))
      if (rg()) l.flags |= 8192;
      else
        throw Ki = Vc, Qc;
  }
  function ua(l, n) {
    n !== null && (l.flags |= 4), l.flags & 16384 && (n = l.tag !== 22 ? la() : 536870912, l.lanes |= n, il |= n);
  }
  function hf(l, n) {
    if (!ot)
      switch (l.tailMode) {
        case "hidden":
          n = l.tail;
          for (var u = null; n !== null; )
            n.alternate !== null && (u = n), n = n.sibling;
          u === null ? l.tail = null : u.sibling = null;
          break;
        case "collapsed":
          u = l.tail;
          for (var c = null; u !== null; )
            u.alternate !== null && (c = u), u = u.sibling;
          c === null ? n || l.tail === null ? l.tail = null : l.tail.sibling = null : c.sibling = null;
      }
  }
  function Ge(l) {
    var n = l.alternate !== null && l.alternate.child === l.child, u = 0, c = 0;
    if (n)
      for (var s = l.child; s !== null; )
        u |= s.lanes | s.childLanes, c |= s.subtreeFlags & 65011712, c |= s.flags & 65011712, s.return = l, s = s.sibling;
    else
      for (s = l.child; s !== null; )
        u |= s.lanes | s.childLanes, c |= s.subtreeFlags, c |= s.flags, s.return = l, s = s.sibling;
    return l.subtreeFlags |= c, l.childLanes = u, n;
  }
  function lg(l, n, u) {
    var c = n.pendingProps;
    switch (Rd(n), n.tag) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return Ge(n), null;
      case 1:
        return Ge(n), null;
      case 3:
        return u = n.stateNode, c = null, l !== null && (c = l.memoizedState.cache), n.memoizedState.cache !== c && (n.flags |= 2048), Qn(yl), gt(), u.pendingContext && (u.context = u.pendingContext, u.pendingContext = null), (l === null || l.child === null) && (Su(n) ? Mu(n) : l === null || l.memoizedState.isDehydrated && (n.flags & 256) === 0 || (n.flags |= 1024, Pm())), Ge(n), null;
      case 26:
        var s = n.type, r = n.memoizedState;
        return l === null ? (Mu(n), r !== null ? (Ge(n), By(n, r)) : (Ge(n), wy(
          n,
          s,
          null,
          c,
          u
        ))) : r ? r !== l.memoizedState ? (Mu(n), Ge(n), By(n, r)) : (Ge(n), n.flags &= -16777217) : (l = l.memoizedProps, l !== c && Mu(n), Ge(n), wy(
          n,
          s,
          l,
          c,
          u
        )), null;
      case 27:
        if (de(n), u = Ze.current, s = n.type, l !== null && n.stateNode != null)
          l.memoizedProps !== c && Mu(n);
        else {
          if (!c) {
            if (n.stateNode === null)
              throw Error(M(166));
            return Ge(n), null;
          }
          l = ee.current, Su(n) ? Us(n) : (l = Uf(s, c, u), n.stateNode = l, Mu(n));
        }
        return Ge(n), null;
      case 5:
        if (de(n), s = n.type, l !== null && n.stateNode != null)
          l.memoizedProps !== c && Mu(n);
        else {
          if (!c) {
            if (n.stateNode === null)
              throw Error(M(166));
            return Ge(n), null;
          }
          if (r = ee.current, Su(n))
            Us(n);
          else {
            var m = fc(
              Ze.current
            );
            switch (r) {
              case 1:
                r = m.createElementNS(
                  "http://www.w3.org/2000/svg",
                  s
                );
                break;
              case 2:
                r = m.createElementNS(
                  "http://www.w3.org/1998/Math/MathML",
                  s
                );
                break;
              default:
                switch (s) {
                  case "svg":
                    r = m.createElementNS(
                      "http://www.w3.org/2000/svg",
                      s
                    );
                    break;
                  case "math":
                    r = m.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      s
                    );
                    break;
                  case "script":
                    r = m.createElement("div"), r.innerHTML = "<script><\/script>", r = r.removeChild(
                      r.firstChild
                    );
                    break;
                  case "select":
                    r = typeof c.is == "string" ? m.createElement("select", {
                      is: c.is
                    }) : m.createElement("select"), c.multiple ? r.multiple = !0 : c.size && (r.size = c.size);
                    break;
                  default:
                    r = typeof c.is == "string" ? m.createElement(s, { is: c.is }) : m.createElement(s);
                }
            }
            r[xt] = n, r[ra] = c;
            e: for (m = n.child; m !== null; ) {
              if (m.tag === 5 || m.tag === 6)
                r.appendChild(m.stateNode);
              else if (m.tag !== 4 && m.tag !== 27 && m.child !== null) {
                m.child.return = m, m = m.child;
                continue;
              }
              if (m === n) break e;
              for (; m.sibling === null; ) {
                if (m.return === null || m.return === n)
                  break e;
                m = m.return;
              }
              m.sibling.return = m.return, m = m.sibling;
            }
            n.stateNode = r;
            e: switch (Wl(r, s, c), s) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                c = !!c.autoFocus;
                break e;
              case "img":
                c = !0;
                break e;
              default:
                c = !1;
            }
            c && Mu(n);
          }
        }
        return Ge(n), wy(
          n,
          n.type,
          l === null ? null : l.memoizedProps,
          n.pendingProps,
          u
        ), null;
      case 6:
        if (l && n.stateNode != null)
          l.memoizedProps !== c && Mu(n);
        else {
          if (typeof c != "string" && n.stateNode === null)
            throw Error(M(166));
          if (l = Ze.current, Su(n)) {
            if (l = n.stateNode, u = n.memoizedProps, c = null, s = wl, s !== null)
              switch (s.tag) {
                case 27:
                case 5:
                  c = s.memoizedProps;
              }
            l[xt] = n, l = !!(l.nodeValue === u || c !== null && c.suppressHydrationWarning === !0 || cp(l.nodeValue, u)), l || Tn(n, !0);
          } else
            l = fc(l).createTextNode(
              c
            ), l[xt] = n, n.stateNode = l;
        }
        return Ge(n), null;
      case 31:
        if (u = n.memoizedState, l === null || l.memoizedState !== null) {
          if (c = Su(n), u !== null) {
            if (l === null) {
              if (!c) throw Error(M(318));
              if (l = n.memoizedState, l = l !== null ? l.dehydrated : null, !l) throw Error(M(557));
              l[xt] = n;
            } else
              Qi(), (n.flags & 128) === 0 && (n.memoizedState = null), n.flags |= 4;
            Ge(n), l = !1;
          } else
            u = Pm(), l !== null && l.memoizedState !== null && (l.memoizedState.hydrationErrors = u), l = !0;
          if (!l)
            return n.flags & 256 ? (va(n), n) : (va(n), null);
          if ((n.flags & 128) !== 0)
            throw Error(M(558));
        }
        return Ge(n), null;
      case 13:
        if (c = n.memoizedState, l === null || l.memoizedState !== null && l.memoizedState.dehydrated !== null) {
          if (s = Su(n), c !== null && c.dehydrated !== null) {
            if (l === null) {
              if (!s) throw Error(M(318));
              if (s = n.memoizedState, s = s !== null ? s.dehydrated : null, !s) throw Error(M(317));
              s[xt] = n;
            } else
              Qi(), (n.flags & 128) === 0 && (n.memoizedState = null), n.flags |= 4;
            Ge(n), s = !1;
          } else
            s = Pm(), l !== null && l.memoizedState !== null && (l.memoizedState.hydrationErrors = s), s = !0;
          if (!s)
            return n.flags & 256 ? (va(n), n) : (va(n), null);
        }
        return va(n), (n.flags & 128) !== 0 ? (n.lanes = u, n) : (u = c !== null, l = l !== null && l.memoizedState !== null, u && (c = n.child, s = null, c.alternate !== null && c.alternate.memoizedState !== null && c.alternate.memoizedState.cachePool !== null && (s = c.alternate.memoizedState.cachePool.pool), r = null, c.memoizedState !== null && c.memoizedState.cachePool !== null && (r = c.memoizedState.cachePool.pool), r !== s && (c.flags |= 2048)), u !== l && u && (n.child.flags |= 8192), ua(n, n.updateQueue), Ge(n), null);
      case 4:
        return gt(), l === null && Mf(n.stateNode.containerInfo), Ge(n), null;
      case 10:
        return Qn(n.type), Ge(n), null;
      case 19:
        if (j(It), c = n.memoizedState, c === null) return Ge(n), null;
        if (s = (n.flags & 128) !== 0, r = c.rendering, r === null)
          if (s) hf(c, !1);
          else {
            if (Qt !== 0 || l !== null && (l.flags & 128) !== 0)
              for (l = n.child; l !== null; ) {
                if (r = nf(l), r !== null) {
                  for (n.flags |= 128, hf(c, !1), l = r.updateQueue, n.updateQueue = l, ua(n, l), n.subtreeFlags = 0, l = u, u = n.child; u !== null; )
                    km(u, l), u = u.sibling;
                  return te(
                    It,
                    It.current & 1 | 2
                  ), ot && En(n, c.treeForkCount), n.child;
                }
                l = l.sibling;
              }
            c.tail !== null && Sl() > Tt && (n.flags |= 128, s = !0, hf(c, !1), n.lanes = 4194304);
          }
        else {
          if (!s)
            if (l = nf(r), l !== null) {
              if (n.flags |= 128, s = !0, l = l.updateQueue, n.updateQueue = l, ua(n, l), hf(c, !0), c.tail === null && c.tailMode === "hidden" && !r.alternate && !ot)
                return Ge(n), null;
            } else
              2 * Sl() - c.renderingStartTime > Tt && u !== 536870912 && (n.flags |= 128, s = !0, hf(c, !1), n.lanes = 4194304);
          c.isBackwards ? (r.sibling = n.child, n.child = r) : (l = c.last, l !== null ? l.sibling = r : n.child = r, c.last = r);
        }
        return c.tail !== null ? (l = c.tail, c.rendering = l, c.tail = l.sibling, c.renderingStartTime = Sl(), l.sibling = null, u = It.current, te(
          It,
          s ? u & 1 | 2 : u & 1
        ), ot && En(n, c.treeForkCount), l) : (Ge(n), null);
      case 22:
      case 23:
        return va(n), lf(), c = n.memoizedState !== null, l !== null ? l.memoizedState !== null !== c && (n.flags |= 8192) : c && (n.flags |= 8192), c ? (u & 536870912) !== 0 && (n.flags & 128) === 0 && (Ge(n), n.subtreeFlags & 6 && (n.flags |= 8192)) : Ge(n), u = n.updateQueue, u !== null && ua(n, u.retryQueue), u = null, l !== null && l.memoizedState !== null && l.memoizedState.cachePool !== null && (u = l.memoizedState.cachePool.pool), c = null, n.memoizedState !== null && n.memoizedState.cachePool !== null && (c = n.memoizedState.cachePool.pool), c !== u && (n.flags |= 2048), l !== null && j(ka), null;
      case 24:
        return u = null, l !== null && (u = l.memoizedState.cache), n.memoizedState.cache !== u && (n.flags |= 2048), Qn(yl), Ge(n), null;
      case 25:
        return null;
      case 30:
        return null;
    }
    throw Error(M(156, n.tag));
  }
  function ag(l, n) {
    switch (Rd(n), n.tag) {
      case 1:
        return l = n.flags, l & 65536 ? (n.flags = l & -65537 | 128, n) : null;
      case 3:
        return Qn(yl), gt(), l = n.flags, (l & 65536) !== 0 && (l & 128) === 0 ? (n.flags = l & -65537 | 128, n) : null;
      case 26:
      case 27:
      case 5:
        return de(n), null;
      case 31:
        if (n.memoizedState !== null) {
          if (va(n), n.alternate === null)
            throw Error(M(340));
          Qi();
        }
        return l = n.flags, l & 65536 ? (n.flags = l & -65537 | 128, n) : null;
      case 13:
        if (va(n), l = n.memoizedState, l !== null && l.dehydrated !== null) {
          if (n.alternate === null)
            throw Error(M(340));
          Qi();
        }
        return l = n.flags, l & 65536 ? (n.flags = l & -65537 | 128, n) : null;
      case 19:
        return j(It), null;
      case 4:
        return gt(), null;
      case 10:
        return Qn(n.type), null;
      case 22:
      case 23:
        return va(n), lf(), l !== null && j(ka), l = n.flags, l & 65536 ? (n.flags = l & -65537 | 128, n) : null;
      case 24:
        return Qn(yl), null;
      case 25:
        return null;
      default:
        return null;
    }
  }
  function ng(l, n) {
    switch (Rd(n), n.tag) {
      case 3:
        Qn(yl), gt();
        break;
      case 26:
      case 27:
      case 5:
        de(n);
        break;
      case 4:
        gt();
        break;
      case 31:
        n.memoizedState !== null && va(n);
        break;
      case 13:
        va(n);
        break;
      case 19:
        j(It);
        break;
      case 10:
        Qn(n.type);
        break;
      case 22:
      case 23:
        va(n), lf(), l !== null && j(ka);
        break;
      case 24:
        Qn(yl);
    }
  }
  function On(l, n) {
    try {
      var u = n.updateQueue, c = u !== null ? u.lastEffect : null;
      if (c !== null) {
        var s = c.next;
        u = s;
        do {
          if ((u.tag & l) === l) {
            c = void 0;
            var r = u.create, m = u.inst;
            c = r(), m.destroy = c;
          }
          u = u.next;
        } while (u !== s);
      }
    } catch (v) {
      Rt(n, n.return, v);
    }
  }
  function ln(l, n, u) {
    try {
      var c = n.updateQueue, s = c !== null ? c.lastEffect : null;
      if (s !== null) {
        var r = s.next;
        c = r;
        do {
          if ((c.tag & l) === l) {
            var m = c.inst, v = m.destroy;
            if (v !== void 0) {
              m.destroy = void 0, s = n;
              var A = u, w = v;
              try {
                w();
              } catch (Q) {
                Rt(
                  s,
                  A,
                  Q
                );
              }
            }
          }
          c = c.next;
        } while (c !== r);
      }
    } catch (Q) {
      Rt(n, n.return, Q);
    }
  }
  function ih(l) {
    var n = l.updateQueue;
    if (n !== null) {
      var u = l.stateNode;
      try {
        Ii(n, u);
      } catch (c) {
        Rt(l, l.return, c);
      }
    }
  }
  function uc(l, n, u) {
    u.props = tc(
      l.type,
      l.memoizedProps
    ), u.state = l.memoizedState;
    try {
      u.componentWillUnmount();
    } catch (c) {
      Rt(l, n, c);
    }
  }
  function Cu(l, n) {
    try {
      var u = l.ref;
      if (u !== null) {
        switch (l.tag) {
          case 26:
          case 27:
          case 5:
            var c = l.stateNode;
            break;
          case 30:
            c = l.stateNode;
            break;
          default:
            c = l.stateNode;
        }
        typeof u == "function" ? l.refCleanup = u(c) : u.current = c;
      }
    } catch (s) {
      Rt(l, n, s);
    }
  }
  function Kn(l, n) {
    var u = l.ref, c = l.refCleanup;
    if (u !== null)
      if (typeof c == "function")
        try {
          c();
        } catch (s) {
          Rt(l, n, s);
        } finally {
          l.refCleanup = null, l = l.alternate, l != null && (l.refCleanup = null);
        }
      else if (typeof u == "function")
        try {
          u(null);
        } catch (s) {
          Rt(l, n, s);
        }
      else u.current = null;
  }
  function Yy(l) {
    var n = l.type, u = l.memoizedProps, c = l.stateNode;
    try {
      e: switch (n) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          u.autoFocus && c.focus();
          break e;
        case "img":
          u.src ? c.src = u.src : u.srcSet && (c.srcset = u.srcSet);
      }
    } catch (s) {
      Rt(l, l.return, s);
    }
  }
  function ch(l, n, u) {
    try {
      var c = l.stateNode;
      fp(c, l.type, u, n), c[ra] = n;
    } catch (s) {
      Rt(l, l.return, s);
    }
  }
  function qy(l) {
    return l.tag === 5 || l.tag === 3 || l.tag === 26 || l.tag === 27 && In(l.type) || l.tag === 4;
  }
  function mf(l) {
    e: for (; ; ) {
      for (; l.sibling === null; ) {
        if (l.return === null || qy(l.return)) return null;
        l = l.return;
      }
      for (l.sibling.return = l.return, l = l.sibling; l.tag !== 5 && l.tag !== 6 && l.tag !== 18; ) {
        if (l.tag === 27 && In(l.type) || l.flags & 2 || l.child === null || l.tag === 4) continue e;
        l.child.return = l, l = l.child;
      }
      if (!(l.flags & 2)) return l.stateNode;
    }
  }
  function yf(l, n, u) {
    var c = l.tag;
    if (c === 5 || c === 6)
      l = l.stateNode, n ? (u.nodeType === 9 ? u.body : u.nodeName === "HTML" ? u.ownerDocument.body : u).insertBefore(l, n) : (n = u.nodeType === 9 ? u.body : u.nodeName === "HTML" ? u.ownerDocument.body : u, n.appendChild(l), u = u._reactRootContainer, u != null || n.onclick !== null || (n.onclick = Nn));
    else if (c !== 4 && (c === 27 && In(l.type) && (u = l.stateNode, n = null), l = l.child, l !== null))
      for (yf(l, n, u), l = l.sibling; l !== null; )
        yf(l, n, u), l = l.sibling;
  }
  function pf(l, n, u) {
    var c = l.tag;
    if (c === 5 || c === 6)
      l = l.stateNode, n ? u.insertBefore(l, n) : u.appendChild(l);
    else if (c !== 4 && (c === 27 && In(l.type) && (u = l.stateNode), l = l.child, l !== null))
      for (pf(l, n, u), l = l.sibling; l !== null; )
        pf(l, n, u), l = l.sibling;
  }
  function Gy(l) {
    var n = l.stateNode, u = l.memoizedProps;
    try {
      for (var c = l.type, s = n.attributes; s.length; )
        n.removeAttributeNode(s[0]);
      Wl(n, c, u), n[xt] = l, n[ra] = u;
    } catch (r) {
      Rt(l, l.return, r);
    }
  }
  var mi = !1, Tl = !1, oh = !1, Ly = typeof WeakSet == "function" ? WeakSet : Set, Gl = null;
  function gf(l, n) {
    if (l = l.containerInfo, Rh = Ml, l = Gi(l), zs(l)) {
      if ("selectionStart" in l)
        var u = {
          start: l.selectionStart,
          end: l.selectionEnd
        };
      else
        e: {
          u = (u = l.ownerDocument) && u.defaultView || window;
          var c = u.getSelection && u.getSelection();
          if (c && c.rangeCount !== 0) {
            u = c.anchorNode;
            var s = c.anchorOffset, r = c.focusNode;
            c = c.focusOffset;
            try {
              u.nodeType, r.nodeType;
            } catch {
              u = null;
              break e;
            }
            var m = 0, v = -1, A = -1, w = 0, Q = 0, W = l, Y = null;
            t: for (; ; ) {
              for (var X; W !== u || s !== 0 && W.nodeType !== 3 || (v = m + s), W !== r || c !== 0 && W.nodeType !== 3 || (A = m + c), W.nodeType === 3 && (m += W.nodeValue.length), (X = W.firstChild) !== null; )
                Y = W, W = X;
              for (; ; ) {
                if (W === l) break t;
                if (Y === u && ++w === s && (v = m), Y === r && ++Q === c && (A = m), (X = W.nextSibling) !== null) break;
                W = Y, Y = W.parentNode;
              }
              W = X;
            }
            u = v === -1 || A === -1 ? null : { start: v, end: A };
          } else u = null;
        }
      u = u || { start: 0, end: 0 };
    } else u = null;
    for (Mh = { focusedElem: l, selectionRange: u }, Ml = !1, Gl = n; Gl !== null; )
      if (n = Gl, l = n.child, (n.subtreeFlags & 1028) !== 0 && l !== null)
        l.return = n, Gl = l;
      else
        for (; Gl !== null; ) {
          switch (n = Gl, r = n.alternate, l = n.flags, n.tag) {
            case 0:
              if ((l & 4) !== 0 && (l = n.updateQueue, l = l !== null ? l.events : null, l !== null))
                for (u = 0; u < l.length; u++)
                  s = l[u], s.ref.impl = s.nextImpl;
              break;
            case 11:
            case 15:
              break;
            case 1:
              if ((l & 1024) !== 0 && r !== null) {
                l = void 0, u = n, s = r.memoizedProps, r = r.memoizedState, c = u.stateNode;
                try {
                  var ye = tc(
                    u.type,
                    s
                  );
                  l = c.getSnapshotBeforeUpdate(
                    ye,
                    r
                  ), c.__reactInternalSnapshotBeforeUpdate = l;
                } catch (He) {
                  Rt(
                    u,
                    u.return,
                    He
                  );
                }
              }
              break;
            case 3:
              if ((l & 1024) !== 0) {
                if (l = n.stateNode.containerInfo, u = l.nodeType, u === 9)
                  Tr(l);
                else if (u === 1)
                  switch (l.nodeName) {
                    case "HEAD":
                    case "HTML":
                    case "BODY":
                      Tr(l);
                      break;
                    default:
                      l.textContent = "";
                  }
              }
              break;
            case 5:
            case 26:
            case 27:
            case 6:
            case 4:
            case 17:
              break;
            default:
              if ((l & 1024) !== 0) throw Error(M(163));
          }
          if (l = n.sibling, l !== null) {
            l.return = n.return, Gl = l;
            break;
          }
          Gl = n.return;
        }
  }
  function ur(l, n, u) {
    var c = u.flags;
    switch (u.tag) {
      case 0:
      case 11:
      case 15:
        yi(l, u), c & 4 && On(5, u);
        break;
      case 1:
        if (yi(l, u), c & 4)
          if (l = u.stateNode, n === null)
            try {
              l.componentDidMount();
            } catch (m) {
              Rt(u, u.return, m);
            }
          else {
            var s = tc(
              u.type,
              n.memoizedProps
            );
            n = n.memoizedState;
            try {
              l.componentDidUpdate(
                s,
                n,
                l.__reactInternalSnapshotBeforeUpdate
              );
            } catch (m) {
              Rt(
                u,
                u.return,
                m
              );
            }
          }
        c & 64 && ih(u), c & 512 && Cu(u, u.return);
        break;
      case 3:
        if (yi(l, u), c & 64 && (l = u.updateQueue, l !== null)) {
          if (n = null, u.child !== null)
            switch (u.child.tag) {
              case 27:
              case 5:
                n = u.child.stateNode;
                break;
              case 1:
                n = u.child.stateNode;
            }
          try {
            Ii(l, n);
          } catch (m) {
            Rt(u, u.return, m);
          }
        }
        break;
      case 27:
        n === null && c & 4 && Gy(u);
      case 26:
      case 5:
        yi(l, u), n === null && c & 4 && Yy(u), c & 512 && Cu(u, u.return);
        break;
      case 12:
        yi(l, u);
        break;
      case 31:
        yi(l, u), c & 4 && ug(l, u);
        break;
      case 13:
        yi(l, u), c & 4 && Vy(l, u), c & 64 && (l = u.memoizedState, l !== null && (l = l.dehydrated, l !== null && (u = an.bind(
          null,
          u
        ), xf(l, u))));
        break;
      case 22:
        if (c = u.memoizedState !== null || mi, !c) {
          n = n !== null && n.memoizedState !== null || Tl, s = mi;
          var r = Tl;
          mi = c, (Tl = n) && !r ? $n(
            l,
            u,
            (u.subtreeFlags & 8772) !== 0
          ) : yi(l, u), mi = s, Tl = r;
        }
        break;
      case 30:
        break;
      default:
        yi(l, u);
    }
  }
  function Xy(l) {
    var n = l.alternate;
    n !== null && (l.alternate = null, Xy(n)), l.child = null, l.deletions = null, l.sibling = null, l.tag === 5 && (n = l.stateNode, n !== null && nd(n)), l.stateNode = null, l.return = null, l.dependencies = null, l.memoizedProps = null, l.memoizedState = null, l.pendingProps = null, l.stateNode = null, l.updateQueue = null;
  }
  var Xt = null, Ea = !1;
  function xu(l, n, u) {
    for (u = u.child; u !== null; )
      Qy(l, n, u), u = u.sibling;
  }
  function Qy(l, n, u) {
    if (zl && typeof zl.onCommitFiberUnmount == "function")
      try {
        zl.onCommitFiberUnmount(hn, u);
      } catch {
      }
    switch (u.tag) {
      case 26:
        Tl || Kn(u, n), xu(
          l,
          n,
          u
        ), u.memoizedState ? u.memoizedState.count-- : u.stateNode && (u = u.stateNode, u.parentNode.removeChild(u));
        break;
      case 27:
        Tl || Kn(u, n);
        var c = Xt, s = Ea;
        In(u.type) && (Xt = u.stateNode, Ea = !1), xu(
          l,
          n,
          u
        ), fo(u.stateNode), Xt = c, Ea = s;
        break;
      case 5:
        Tl || Kn(u, n);
      case 6:
        if (c = Xt, s = Ea, Xt = null, xu(
          l,
          n,
          u
        ), Xt = c, Ea = s, Xt !== null)
          if (Ea)
            try {
              (Xt.nodeType === 9 ? Xt.body : Xt.nodeName === "HTML" ? Xt.ownerDocument.body : Xt).removeChild(u.stateNode);
            } catch (r) {
              Rt(
                u,
                n,
                r
              );
            }
          else
            try {
              Xt.removeChild(u.stateNode);
            } catch (r) {
              Rt(
                u,
                n,
                r
              );
            }
        break;
      case 18:
        Xt !== null && (Ea ? (l = Xt, hp(
          l.nodeType === 9 ? l.body : l.nodeName === "HTML" ? l.ownerDocument.body : l,
          u.stateNode
        ), Xf(l)) : hp(Xt, u.stateNode));
        break;
      case 4:
        c = Xt, s = Ea, Xt = u.stateNode.containerInfo, Ea = !0, xu(
          l,
          n,
          u
        ), Xt = c, Ea = s;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        ln(2, u, n), Tl || ln(4, u, n), xu(
          l,
          n,
          u
        );
        break;
      case 1:
        Tl || (Kn(u, n), c = u.stateNode, typeof c.componentWillUnmount == "function" && uc(
          u,
          n,
          c
        )), xu(
          l,
          n,
          u
        );
        break;
      case 21:
        xu(
          l,
          n,
          u
        );
        break;
      case 22:
        Tl = (c = Tl) || u.memoizedState !== null, xu(
          l,
          n,
          u
        ), Tl = c;
        break;
      default:
        xu(
          l,
          n,
          u
        );
    }
  }
  function ug(l, n) {
    if (n.memoizedState === null && (l = n.alternate, l !== null && (l = l.memoizedState, l !== null))) {
      l = l.dehydrated;
      try {
        Xf(l);
      } catch (u) {
        Rt(n, n.return, u);
      }
    }
  }
  function Vy(l, n) {
    if (n.memoizedState === null && (l = n.alternate, l !== null && (l = l.memoizedState, l !== null && (l = l.dehydrated, l !== null))))
      try {
        Xf(l);
      } catch (u) {
        Rt(n, n.return, u);
      }
  }
  function ir(l) {
    switch (l.tag) {
      case 31:
      case 13:
      case 19:
        var n = l.stateNode;
        return n === null && (n = l.stateNode = new Ly()), n;
      case 22:
        return l = l.stateNode, n = l._retryCache, n === null && (n = l._retryCache = new Ly()), n;
      default:
        throw Error(M(435, l.tag));
    }
  }
  function cr(l, n) {
    var u = ir(l);
    n.forEach(function(c) {
      if (!u.has(c)) {
        u.add(c);
        var s = Dg.bind(null, l, c);
        c.then(s, s);
      }
    });
  }
  function Ta(l, n) {
    var u = n.deletions;
    if (u !== null)
      for (var c = 0; c < u.length; c++) {
        var s = u[c], r = l, m = n, v = m;
        e: for (; v !== null; ) {
          switch (v.tag) {
            case 27:
              if (In(v.type)) {
                Xt = v.stateNode, Ea = !1;
                break e;
              }
              break;
            case 5:
              Xt = v.stateNode, Ea = !1;
              break e;
            case 3:
            case 4:
              Xt = v.stateNode.containerInfo, Ea = !0;
              break e;
          }
          v = v.return;
        }
        if (Xt === null) throw Error(M(160));
        Qy(r, m, s), Xt = null, Ea = !1, r = s.alternate, r !== null && (r.return = null), s.return = null;
      }
    if (n.subtreeFlags & 13886)
      for (n = n.child; n !== null; )
        fh(n, l), n = n.sibling;
  }
  var Fe = null;
  function fh(l, n) {
    var u = l.alternate, c = l.flags;
    switch (l.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        Ta(n, l), Ca(l), c & 4 && (ln(3, l, l.return), On(3, l), ln(5, l, l.return));
        break;
      case 1:
        Ta(n, l), Ca(l), c & 512 && (Tl || u === null || Kn(u, u.return)), c & 64 && mi && (l = l.updateQueue, l !== null && (c = l.callbacks, c !== null && (u = l.shared.hiddenCallbacks, l.shared.hiddenCallbacks = u === null ? c : u.concat(c))));
        break;
      case 26:
        var s = Fe;
        if (Ta(n, l), Ca(l), c & 512 && (Tl || u === null || Kn(u, u.return)), c & 4) {
          var r = u !== null ? u.memoizedState : null;
          if (c = l.memoizedState, u === null)
            if (c === null)
              if (l.stateNode === null) {
                e: {
                  c = l.type, u = l.memoizedProps, s = s.ownerDocument || s;
                  t: switch (c) {
                    case "title":
                      r = s.getElementsByTagName("title")[0], (!r || r[su] || r[xt] || r.namespaceURI === "http://www.w3.org/2000/svg" || r.hasAttribute("itemprop")) && (r = s.createElement(c), s.head.insertBefore(
                        r,
                        s.querySelector("head > title")
                      )), Wl(r, c, u), r[xt] = l, Ot(r), c = r;
                      break e;
                    case "link":
                      var m = gp(
                        "link",
                        "href",
                        s
                      ).get(c + (u.href || ""));
                      if (m) {
                        for (var v = 0; v < m.length; v++)
                          if (r = m[v], r.getAttribute("href") === (u.href == null || u.href === "" ? null : u.href) && r.getAttribute("rel") === (u.rel == null ? null : u.rel) && r.getAttribute("title") === (u.title == null ? null : u.title) && r.getAttribute("crossorigin") === (u.crossOrigin == null ? null : u.crossOrigin)) {
                            m.splice(v, 1);
                            break t;
                          }
                      }
                      r = s.createElement(c), Wl(r, c, u), s.head.appendChild(r);
                      break;
                    case "meta":
                      if (m = gp(
                        "meta",
                        "content",
                        s
                      ).get(c + (u.content || ""))) {
                        for (v = 0; v < m.length; v++)
                          if (r = m[v], r.getAttribute("content") === (u.content == null ? null : "" + u.content) && r.getAttribute("name") === (u.name == null ? null : u.name) && r.getAttribute("property") === (u.property == null ? null : u.property) && r.getAttribute("http-equiv") === (u.httpEquiv == null ? null : u.httpEquiv) && r.getAttribute("charset") === (u.charSet == null ? null : u.charSet)) {
                            m.splice(v, 1);
                            break t;
                          }
                      }
                      r = s.createElement(c), Wl(r, c, u), s.head.appendChild(r);
                      break;
                    default:
                      throw Error(M(468, c));
                  }
                  r[xt] = l, Ot(r), c = r;
                }
                l.stateNode = c;
              } else
                Hh(
                  s,
                  l.type,
                  l.stateNode
                );
            else
              l.stateNode = pp(
                s,
                c,
                l.memoizedProps
              );
          else
            r !== c ? (r === null ? u.stateNode !== null && (u = u.stateNode, u.parentNode.removeChild(u)) : r.count--, c === null ? Hh(
              s,
              l.type,
              l.stateNode
            ) : pp(
              s,
              c,
              l.memoizedProps
            )) : c === null && l.stateNode !== null && ch(
              l,
              l.memoizedProps,
              u.memoizedProps
            );
        }
        break;
      case 27:
        Ta(n, l), Ca(l), c & 512 && (Tl || u === null || Kn(u, u.return)), u !== null && c & 4 && ch(
          l,
          l.memoizedProps,
          u.memoizedProps
        );
        break;
      case 5:
        if (Ta(n, l), Ca(l), c & 512 && (Tl || u === null || Kn(u, u.return)), l.flags & 32) {
          s = l.stateNode;
          try {
            du(s, "");
          } catch (ye) {
            Rt(l, l.return, ye);
          }
        }
        c & 4 && l.stateNode != null && (s = l.memoizedProps, ch(
          l,
          s,
          u !== null ? u.memoizedProps : s
        )), c & 1024 && (oh = !0);
        break;
      case 6:
        if (Ta(n, l), Ca(l), c & 4) {
          if (l.stateNode === null)
            throw Error(M(162));
          c = l.memoizedProps, u = l.stateNode;
          try {
            u.nodeValue = c;
          } catch (ye) {
            Rt(l, l.return, ye);
          }
        }
        break;
      case 3:
        if (Bf = null, s = Fe, Fe = ia(n.containerInfo), Ta(n, l), Fe = s, Ca(l), c & 4 && u !== null && u.memoizedState.isDehydrated)
          try {
            Xf(n.containerInfo);
          } catch (ye) {
            Rt(l, l.return, ye);
          }
        oh && (oh = !1, Zy(l));
        break;
      case 4:
        c = Fe, Fe = ia(
          l.stateNode.containerInfo
        ), Ta(n, l), Ca(l), Fe = c;
        break;
      case 12:
        Ta(n, l), Ca(l);
        break;
      case 31:
        Ta(n, l), Ca(l), c & 4 && (c = l.updateQueue, c !== null && (l.updateQueue = null, cr(l, c)));
        break;
      case 13:
        Ta(n, l), Ca(l), l.child.flags & 8192 && l.memoizedState !== null != (u !== null && u.memoizedState !== null) && (Fn = Sl()), c & 4 && (c = l.updateQueue, c !== null && (l.updateQueue = null, cr(l, c)));
        break;
      case 22:
        s = l.memoizedState !== null;
        var A = u !== null && u.memoizedState !== null, w = mi, Q = Tl;
        if (mi = w || s, Tl = Q || A, Ta(n, l), Tl = Q, mi = w, Ca(l), c & 8192)
          e: for (n = l.stateNode, n._visibility = s ? n._visibility & -2 : n._visibility | 1, s && (u === null || A || mi || Tl || lo(l)), u = null, n = l; ; ) {
            if (n.tag === 5 || n.tag === 26) {
              if (u === null) {
                A = u = n;
                try {
                  if (r = A.stateNode, s)
                    m = r.style, typeof m.setProperty == "function" ? m.setProperty("display", "none", "important") : m.display = "none";
                  else {
                    v = A.stateNode;
                    var W = A.memoizedProps.style, Y = W != null && W.hasOwnProperty("display") ? W.display : null;
                    v.style.display = Y == null || typeof Y == "boolean" ? "" : ("" + Y).trim();
                  }
                } catch (ye) {
                  Rt(A, A.return, ye);
                }
              }
            } else if (n.tag === 6) {
              if (u === null) {
                A = n;
                try {
                  A.stateNode.nodeValue = s ? "" : A.memoizedProps;
                } catch (ye) {
                  Rt(A, A.return, ye);
                }
              }
            } else if (n.tag === 18) {
              if (u === null) {
                A = n;
                try {
                  var X = A.stateNode;
                  s ? vl(X, !0) : vl(A.stateNode, !1);
                } catch (ye) {
                  Rt(A, A.return, ye);
                }
              }
            } else if ((n.tag !== 22 && n.tag !== 23 || n.memoizedState === null || n === l) && n.child !== null) {
              n.child.return = n, n = n.child;
              continue;
            }
            if (n === l) break e;
            for (; n.sibling === null; ) {
              if (n.return === null || n.return === l) break e;
              u === n && (u = null), n = n.return;
            }
            u === n && (u = null), n.sibling.return = n.return, n = n.sibling;
          }
        c & 4 && (c = l.updateQueue, c !== null && (u = c.retryQueue, u !== null && (c.retryQueue = null, cr(l, u))));
        break;
      case 19:
        Ta(n, l), Ca(l), c & 4 && (c = l.updateQueue, c !== null && (l.updateQueue = null, cr(l, c)));
        break;
      case 30:
        break;
      case 21:
        break;
      default:
        Ta(n, l), Ca(l);
    }
  }
  function Ca(l) {
    var n = l.flags;
    if (n & 2) {
      try {
        for (var u, c = l.return; c !== null; ) {
          if (qy(c)) {
            u = c;
            break;
          }
          c = c.return;
        }
        if (u == null) throw Error(M(160));
        switch (u.tag) {
          case 27:
            var s = u.stateNode, r = mf(l);
            pf(l, r, s);
            break;
          case 5:
            var m = u.stateNode;
            u.flags & 32 && (du(m, ""), u.flags &= -33);
            var v = mf(l);
            pf(l, v, m);
            break;
          case 3:
          case 4:
            var A = u.stateNode.containerInfo, w = mf(l);
            yf(
              l,
              w,
              A
            );
            break;
          default:
            throw Error(M(161));
        }
      } catch (Q) {
        Rt(l, l.return, Q);
      }
      l.flags &= -3;
    }
    n & 4096 && (l.flags &= -4097);
  }
  function Zy(l) {
    if (l.subtreeFlags & 1024)
      for (l = l.child; l !== null; ) {
        var n = l;
        Zy(n), n.tag === 5 && n.flags & 1024 && n.stateNode.reset(), l = l.sibling;
      }
  }
  function yi(l, n) {
    if (n.subtreeFlags & 8772)
      for (n = n.child; n !== null; )
        ur(l, n.alternate, n), n = n.sibling;
  }
  function lo(l) {
    for (l = l.child; l !== null; ) {
      var n = l;
      switch (n.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          ln(4, n, n.return), lo(n);
          break;
        case 1:
          Kn(n, n.return);
          var u = n.stateNode;
          typeof u.componentWillUnmount == "function" && uc(
            n,
            n.return,
            u
          ), lo(n);
          break;
        case 27:
          fo(n.stateNode);
        case 26:
        case 5:
          Kn(n, n.return), lo(n);
          break;
        case 22:
          n.memoizedState === null && lo(n);
          break;
        case 30:
          lo(n);
          break;
        default:
          lo(n);
      }
      l = l.sibling;
    }
  }
  function $n(l, n, u) {
    for (u = u && (n.subtreeFlags & 8772) !== 0, n = n.child; n !== null; ) {
      var c = n.alternate, s = l, r = n, m = r.flags;
      switch (r.tag) {
        case 0:
        case 11:
        case 15:
          $n(
            s,
            r,
            u
          ), On(4, r);
          break;
        case 1:
          if ($n(
            s,
            r,
            u
          ), c = r, s = c.stateNode, typeof s.componentDidMount == "function")
            try {
              s.componentDidMount();
            } catch (w) {
              Rt(c, c.return, w);
            }
          if (c = r, s = c.updateQueue, s !== null) {
            var v = c.stateNode;
            try {
              var A = s.shared.hiddenCallbacks;
              if (A !== null)
                for (s.shared.hiddenCallbacks = null, s = 0; s < A.length; s++)
                  Hd(A[s], v);
            } catch (w) {
              Rt(c, c.return, w);
            }
          }
          u && m & 64 && ih(r), Cu(r, r.return);
          break;
        case 27:
          Gy(r);
        case 26:
        case 5:
          $n(
            s,
            r,
            u
          ), u && c === null && m & 4 && Yy(r), Cu(r, r.return);
          break;
        case 12:
          $n(
            s,
            r,
            u
          );
          break;
        case 31:
          $n(
            s,
            r,
            u
          ), u && m & 4 && ug(s, r);
          break;
        case 13:
          $n(
            s,
            r,
            u
          ), u && m & 4 && Vy(s, r);
          break;
        case 22:
          r.memoizedState === null && $n(
            s,
            r,
            u
          ), Cu(r, r.return);
          break;
        case 30:
          break;
        default:
          $n(
            s,
            r,
            u
          );
      }
      n = n.sibling;
    }
  }
  function sh(l, n) {
    var u = null;
    l !== null && l.memoizedState !== null && l.memoizedState.cachePool !== null && (u = l.memoizedState.cachePool.pool), l = null, n.memoizedState !== null && n.memoizedState.cachePool !== null && (l = n.memoizedState.cachePool.pool), l !== u && (l != null && l.refCount++, u != null && js(u));
  }
  function rh(l, n) {
    l = null, n.alternate !== null && (l = n.alternate.memoizedState.cache), n = n.memoizedState.cache, n !== l && (n.refCount++, l != null && js(l));
  }
  function zn(l, n, u, c) {
    if (n.subtreeFlags & 10256)
      for (n = n.child; n !== null; )
        vf(
          l,
          n,
          u,
          c
        ), n = n.sibling;
  }
  function vf(l, n, u, c) {
    var s = n.flags;
    switch (n.tag) {
      case 0:
      case 11:
      case 15:
        zn(
          l,
          n,
          u,
          c
        ), s & 2048 && On(9, n);
        break;
      case 1:
        zn(
          l,
          n,
          u,
          c
        );
        break;
      case 3:
        zn(
          l,
          n,
          u,
          c
        ), s & 2048 && (l = null, n.alternate !== null && (l = n.alternate.memoizedState.cache), n = n.memoizedState.cache, n !== l && (n.refCount++, l != null && js(l)));
        break;
      case 12:
        if (s & 2048) {
          zn(
            l,
            n,
            u,
            c
          ), l = n.stateNode;
          try {
            var r = n.memoizedProps, m = r.id, v = r.onPostCommit;
            typeof v == "function" && v(
              m,
              n.alternate === null ? "mount" : "update",
              l.passiveEffectDuration,
              -0
            );
          } catch (A) {
            Rt(n, n.return, A);
          }
        } else
          zn(
            l,
            n,
            u,
            c
          );
        break;
      case 31:
        zn(
          l,
          n,
          u,
          c
        );
        break;
      case 13:
        zn(
          l,
          n,
          u,
          c
        );
        break;
      case 23:
        break;
      case 22:
        r = n.stateNode, m = n.alternate, n.memoizedState !== null ? r._visibility & 2 ? zn(
          l,
          n,
          u,
          c
        ) : or(l, n) : r._visibility & 2 ? zn(
          l,
          n,
          u,
          c
        ) : (r._visibility |= 2, bf(
          l,
          n,
          u,
          c,
          (n.subtreeFlags & 10256) !== 0 || !1
        )), s & 2048 && sh(m, n);
        break;
      case 24:
        zn(
          l,
          n,
          u,
          c
        ), s & 2048 && rh(n.alternate, n);
        break;
      default:
        zn(
          l,
          n,
          u,
          c
        );
    }
  }
  function bf(l, n, u, c, s) {
    for (s = s && ((n.subtreeFlags & 10256) !== 0 || !1), n = n.child; n !== null; ) {
      var r = l, m = n, v = u, A = c, w = m.flags;
      switch (m.tag) {
        case 0:
        case 11:
        case 15:
          bf(
            r,
            m,
            v,
            A,
            s
          ), On(8, m);
          break;
        case 23:
          break;
        case 22:
          var Q = m.stateNode;
          m.memoizedState !== null ? Q._visibility & 2 ? bf(
            r,
            m,
            v,
            A,
            s
          ) : or(
            r,
            m
          ) : (Q._visibility |= 2, bf(
            r,
            m,
            v,
            A,
            s
          )), s && w & 2048 && sh(
            m.alternate,
            m
          );
          break;
        case 24:
          bf(
            r,
            m,
            v,
            A,
            s
          ), s && w & 2048 && rh(m.alternate, m);
          break;
        default:
          bf(
            r,
            m,
            v,
            A,
            s
          );
      }
      n = n.sibling;
    }
  }
  function or(l, n) {
    if (n.subtreeFlags & 10256)
      for (n = n.child; n !== null; ) {
        var u = l, c = n, s = c.flags;
        switch (c.tag) {
          case 22:
            or(u, c), s & 2048 && sh(
              c.alternate,
              c
            );
            break;
          case 24:
            or(u, c), s & 2048 && rh(c.alternate, c);
            break;
          default:
            or(u, c);
        }
        n = n.sibling;
      }
  }
  var xa = 8192;
  function Uu(l, n, u) {
    if (l.subtreeFlags & xa)
      for (l = l.child; l !== null; )
        ig(
          l,
          n,
          u
        ), l = l.sibling;
  }
  function ig(l, n, u) {
    switch (l.tag) {
      case 26:
        Uu(
          l,
          n,
          u
        ), l.flags & xa && l.memoizedState !== null && Bu(
          u,
          Fe,
          l.memoizedState,
          l.memoizedProps
        );
        break;
      case 5:
        Uu(
          l,
          n,
          u
        );
        break;
      case 3:
      case 4:
        var c = Fe;
        Fe = ia(l.stateNode.containerInfo), Uu(
          l,
          n,
          u
        ), Fe = c;
        break;
      case 22:
        l.memoizedState === null && (c = l.alternate, c !== null && c.memoizedState !== null ? (c = xa, xa = 16777216, Uu(
          l,
          n,
          u
        ), xa = c) : Uu(
          l,
          n,
          u
        ));
        break;
      default:
        Uu(
          l,
          n,
          u
        );
    }
  }
  function dh(l) {
    var n = l.alternate;
    if (n !== null && (l = n.child, l !== null)) {
      n.child = null;
      do
        n = l.sibling, l.sibling = null, l = n;
      while (l !== null);
    }
  }
  function Sf(l) {
    var n = l.deletions;
    if ((l.flags & 16) !== 0) {
      if (n !== null)
        for (var u = 0; u < n.length; u++) {
          var c = n[u];
          Gl = c, hh(
            c,
            l
          );
        }
      dh(l);
    }
    if (l.subtreeFlags & 10256)
      for (l = l.child; l !== null; )
        Jy(l), l = l.sibling;
  }
  function Jy(l) {
    switch (l.tag) {
      case 0:
      case 11:
      case 15:
        Sf(l), l.flags & 2048 && ln(9, l, l.return);
        break;
      case 3:
        Sf(l);
        break;
      case 12:
        Sf(l);
        break;
      case 22:
        var n = l.stateNode;
        l.memoizedState !== null && n._visibility & 2 && (l.return === null || l.return.tag !== 13) ? (n._visibility &= -3, fr(l)) : Sf(l);
        break;
      default:
        Sf(l);
    }
  }
  function fr(l) {
    var n = l.deletions;
    if ((l.flags & 16) !== 0) {
      if (n !== null)
        for (var u = 0; u < n.length; u++) {
          var c = n[u];
          Gl = c, hh(
            c,
            l
          );
        }
      dh(l);
    }
    for (l = l.child; l !== null; ) {
      switch (n = l, n.tag) {
        case 0:
        case 11:
        case 15:
          ln(8, n, n.return), fr(n);
          break;
        case 22:
          u = n.stateNode, u._visibility & 2 && (u._visibility &= -3, fr(n));
          break;
        default:
          fr(n);
      }
      l = l.sibling;
    }
  }
  function hh(l, n) {
    for (; Gl !== null; ) {
      var u = Gl;
      switch (u.tag) {
        case 0:
        case 11:
        case 15:
          ln(8, u, n);
          break;
        case 23:
        case 22:
          if (u.memoizedState !== null && u.memoizedState.cachePool !== null) {
            var c = u.memoizedState.cachePool.pool;
            c != null && c.refCount++;
          }
          break;
        case 24:
          js(u.memoizedState.cache);
      }
      if (c = u.child, c !== null) c.return = u, Gl = c;
      else
        e: for (u = l; Gl !== null; ) {
          c = Gl;
          var s = c.sibling, r = c.return;
          if (Xy(c), c === u) {
            Gl = null;
            break e;
          }
          if (s !== null) {
            s.return = r, Gl = s;
            break e;
          }
          Gl = r;
        }
    }
  }
  var cg = {
    getCacheForType: function(l) {
      var n = I(yl), u = n.data.get(l);
      return u === void 0 && (u = l(), n.data.set(l, u)), u;
    },
    cacheSignal: function() {
      return I(yl).controller.signal;
    }
  }, Ky = typeof WeakMap == "function" ? WeakMap : Map, bt = 0, Nt = null, ft = null, ut = 0, _t = 0, Ye = null, Nu = !1, ic = !1, mh = !1, kn = 0, Qt = 0, Wn = 0, ao = 0, yh = 0, Aa = 0, il = 0, sr = null, cl = null, ph = !1, Fn = 0, $y = 0, Tt = 1 / 0, Ef = null, Pt = null, Rl = 0, pi = null, cc = null, Hu = 0, Ua = 0, gh = null, vh = null, Tf = 0, rr = null;
  function Na() {
    return (bt & 2) !== 0 && ut !== 0 ? ut & -ut : _.T !== null ? Ah() : ld();
  }
  function og() {
    if (Aa === 0)
      if ((ut & 536870912) === 0 || ot) {
        var l = ce;
        ce <<= 1, (ce & 3932160) === 0 && (ce = 262144), Aa = l;
      } else Aa = 536870912;
    return l = ga.current, l !== null && (l.flags |= 32), Aa;
  }
  function Oa(l, n, u) {
    (l === Nt && (_t === 2 || _t === 9) || l.cancelPendingCommit !== null) && (ju(l, 0), gi(
      l,
      ut,
      Aa,
      !1
    )), Ui(l, u), ((bt & 2) === 0 || l !== Nt) && (l === Nt && ((bt & 2) === 0 && (ao |= u), Qt === 4 && gi(
      l,
      ut,
      Aa,
      !1
    )), wu(l));
  }
  function fg(l, n, u) {
    if ((bt & 6) !== 0) throw Error(M(327));
    var c = !u && (n & 127) === 0 && (n & l.expiredLanes) === 0 || nt(l, n), s = c ? mg(l, n) : Sh(l, n, !0), r = c;
    do {
      if (s === 0) {
        ic && !c && gi(l, n, 0, !1);
        break;
      } else {
        if (u = l.current.alternate, r && !sg(u)) {
          s = Sh(l, n, !1), r = !1;
          continue;
        }
        if (s === 2) {
          if (r = n, l.errorRecoveryDisabledLanes & r)
            var m = 0;
          else
            m = l.pendingLanes & -536870913, m = m !== 0 ? m : m & 536870912 ? 536870912 : 0;
          if (m !== 0) {
            n = m;
            e: {
              var v = l;
              s = sr;
              var A = v.current.memoizedState.isDehydrated;
              if (A && (ju(v, m).flags |= 256), m = Sh(
                v,
                m,
                !1
              ), m !== 2) {
                if (mh && !A) {
                  v.errorRecoveryDisabledLanes |= r, ao |= r, s = 4;
                  break e;
                }
                r = cl, cl = s, r !== null && (cl === null ? cl = r : cl.push.apply(
                  cl,
                  r
                ));
              }
              s = m;
            }
            if (r = !1, s !== 2) continue;
          }
        }
        if (s === 1) {
          ju(l, 0), gi(l, n, 0, !0);
          break;
        }
        e: {
          switch (c = l, r = s, r) {
            case 0:
            case 1:
              throw Error(M(345));
            case 4:
              if ((n & 4194048) !== n) break;
            case 6:
              gi(
                c,
                n,
                Aa,
                !Nu
              );
              break e;
            case 2:
              cl = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(M(329));
          }
          if ((n & 62914560) === n && (s = Fn + 300 - Sl(), 10 < s)) {
            if (gi(
              c,
              n,
              Aa,
              !Nu
            ), Se(c, 0, !0) !== 0) break e;
            Hu = n, c.timeoutHandle = Er(
              dr.bind(
                null,
                c,
                u,
                cl,
                Ef,
                ph,
                n,
                Aa,
                ao,
                il,
                Nu,
                r,
                "Throttled",
                -0,
                0
              ),
              s
            );
            break e;
          }
          dr(
            c,
            u,
            cl,
            Ef,
            ph,
            n,
            Aa,
            ao,
            il,
            Nu,
            r,
            null,
            -0,
            0
          );
        }
      }
      break;
    } while (!0);
    wu(l);
  }
  function dr(l, n, u, c, s, r, m, v, A, w, Q, W, Y, X) {
    if (l.timeoutHandle = -1, W = n.subtreeFlags, W & 8192 || (W & 16785408) === 16785408) {
      W = {
        stylesheets: null,
        count: 0,
        imgCount: 0,
        imgBytes: 0,
        suspenseyImages: [],
        waitingForImages: !0,
        waitingForViewTransition: !1,
        unsuspend: Nn
      }, ig(
        n,
        r,
        W
      );
      var ye = (r & 62914560) === r ? Fn - Sl() : (r & 4194048) === r ? $y - Sl() : 0;
      if (ye = bp(
        W,
        ye
      ), ye !== null) {
        Hu = r, l.cancelPendingCommit = ye(
          vg.bind(
            null,
            l,
            n,
            r,
            u,
            c,
            s,
            m,
            v,
            A,
            Q,
            W,
            null,
            Y,
            X
          )
        ), gi(l, r, m, !w);
        return;
      }
    }
    vg(
      l,
      n,
      r,
      u,
      c,
      s,
      m,
      v,
      A
    );
  }
  function sg(l) {
    for (var n = l; ; ) {
      var u = n.tag;
      if ((u === 0 || u === 11 || u === 15) && n.flags & 16384 && (u = n.updateQueue, u !== null && (u = u.stores, u !== null)))
        for (var c = 0; c < u.length; c++) {
          var s = u[c], r = s.getSnapshot;
          s = s.value;
          try {
            if (!na(r(), s)) return !1;
          } catch {
            return !1;
          }
        }
      if (u = n.child, n.subtreeFlags & 16384 && u !== null)
        u.return = n, n = u;
      else {
        if (n === l) break;
        for (; n.sibling === null; ) {
          if (n.return === null || n.return === l) return !0;
          n = n.return;
        }
        n.sibling.return = n.return, n = n.sibling;
      }
    }
    return !0;
  }
  function gi(l, n, u, c) {
    n &= ~yh, n &= ~ao, l.suspendedLanes |= n, l.pingedLanes &= ~n, c && (l.warmLanes |= n), c = l.expirationTimes;
    for (var s = n; 0 < s; ) {
      var r = 31 - Nl(s), m = 1 << r;
      c[r] = -1, s &= ~m;
    }
    u !== 0 && ms(l, u, n);
  }
  function Af() {
    return (bt & 6) === 0 ? (bi(0), !1) : !0;
  }
  function ky() {
    if (ft !== null) {
      if (_t === 0)
        var l = ft.return;
      else
        l = ft, Xn = ii = null, Zs(l), $i = null, Zc = 0, l = ft;
      for (; l !== null; )
        ng(l.alternate, l), l = l.return;
      ft = null;
    }
  }
  function ju(l, n) {
    var u = l.timeoutHandle;
    u !== -1 && (l.timeoutHandle = -1, Hg(u)), u = l.cancelPendingCommit, u !== null && (l.cancelPendingCommit = null, u()), Hu = 0, ky(), Nt = l, ft = u = ni(l.current, null), ut = n, _t = 0, Ye = null, Nu = !1, ic = nt(l, n), mh = !1, il = Aa = yh = ao = Wn = Qt = 0, cl = sr = null, ph = !1, (n & 8) !== 0 && (n |= n & 32);
    var c = l.entangledLanes;
    if (c !== 0)
      for (l = l.entanglements, c &= n; 0 < c; ) {
        var s = 31 - Nl(c), r = 1 << s;
        n |= l[s], c &= ~r;
      }
    return kn = n, Za(), u;
  }
  function Of(l, n) {
    $e = null, _.H = Ps, n === Zi || n === ef ? (n = ny(), _t = 3) : n === Qc ? (n = ny(), _t = 4) : _t = n === th ? 8 : n !== null && typeof n == "object" && typeof n.then == "function" ? 6 : 1, Ye = n, ft === null && (Qt = 1, df(
      l,
      Ka(n, l.current)
    ));
  }
  function rg() {
    var l = ga.current;
    return l === null ? !0 : (ut & 4194048) === ut ? Ia === null : (ut & 62914560) === ut || (ut & 536870912) !== 0 ? l === Ia : !1;
  }
  function dg() {
    var l = _.H;
    return _.H = Ps, l === null ? Ps : l;
  }
  function hg() {
    var l = _.A;
    return _.A = cg, l;
  }
  function bh() {
    Qt = 4, Nu || (ut & 4194048) !== ut && ga.current !== null || (ic = !0), (Wn & 134217727) === 0 && (ao & 134217727) === 0 || Nt === null || gi(
      Nt,
      ut,
      Aa,
      !1
    );
  }
  function Sh(l, n, u) {
    var c = bt;
    bt |= 2;
    var s = dg(), r = hg();
    (Nt !== l || ut !== n) && (Ef = null, ju(l, n)), n = !1;
    var m = Qt;
    e: do
      try {
        if (_t !== 0 && ft !== null) {
          var v = ft, A = Ye;
          switch (_t) {
            case 8:
              ky(), m = 6;
              break e;
            case 3:
            case 2:
            case 9:
            case 6:
              ga.current === null && (n = !0);
              var w = _t;
              if (_t = 0, Ye = null, no(l, v, A, w), u && ic) {
                m = 0;
                break e;
              }
              break;
            default:
              w = _t, _t = 0, Ye = null, no(l, v, A, w);
          }
        }
        a1(), m = Qt;
        break;
      } catch (Q) {
        Of(l, Q);
      }
    while (!0);
    return n && l.shellSuspendCounter++, Xn = ii = null, bt = c, _.H = s, _.A = r, ft === null && (Nt = null, ut = 0, Za()), m;
  }
  function a1() {
    for (; ft !== null; ) yg(ft);
  }
  function mg(l, n) {
    var u = bt;
    bt |= 2;
    var c = dg(), s = hg();
    Nt !== l || ut !== n ? (Ef = null, Tt = Sl() + 500, ju(l, n)) : ic = nt(
      l,
      n
    );
    e: do
      try {
        if (_t !== 0 && ft !== null) {
          n = ft;
          var r = Ye;
          t: switch (_t) {
            case 1:
              _t = 0, Ye = null, no(l, n, r, 1);
              break;
            case 2:
            case 9:
              if (ly(r)) {
                _t = 0, Ye = null, pg(n);
                break;
              }
              n = function() {
                _t !== 2 && _t !== 9 || Nt !== l || (_t = 7), wu(l);
              }, r.then(n, n);
              break e;
            case 3:
              _t = 7;
              break e;
            case 4:
              _t = 5;
              break e;
            case 7:
              ly(r) ? (_t = 0, Ye = null, pg(n)) : (_t = 0, Ye = null, no(l, n, r, 7));
              break;
            case 5:
              var m = null;
              switch (ft.tag) {
                case 26:
                  m = ft.memoizedState;
                case 5:
                case 27:
                  var v = ft;
                  if (m ? ja(m) : v.stateNode.complete) {
                    _t = 0, Ye = null;
                    var A = v.sibling;
                    if (A !== null) ft = A;
                    else {
                      var w = v.return;
                      w !== null ? (ft = w, hr(w)) : ft = null;
                    }
                    break t;
                  }
              }
              _t = 0, Ye = null, no(l, n, r, 5);
              break;
            case 6:
              _t = 0, Ye = null, no(l, n, r, 6);
              break;
            case 8:
              ky(), Qt = 6;
              break e;
            default:
              throw Error(M(462));
          }
        }
        oc();
        break;
      } catch (Q) {
        Of(l, Q);
      }
    while (!0);
    return Xn = ii = null, _.H = c, _.A = s, bt = u, ft !== null ? 0 : (Nt = null, ut = 0, Za(), Qt);
  }
  function oc() {
    for (; ft !== null && !ou(); )
      yg(ft);
  }
  function yg(l) {
    var n = jy(l.alternate, l, kn);
    l.memoizedProps = l.pendingProps, n === null ? hr(l) : ft = n;
  }
  function pg(l) {
    var n = l, u = n.alternate;
    switch (n.tag) {
      case 15:
      case 0:
        n = ac(
          u,
          n,
          n.pendingProps,
          n.type,
          void 0,
          ut
        );
        break;
      case 11:
        n = ac(
          u,
          n,
          n.pendingProps,
          n.type.render,
          n.ref,
          ut
        );
        break;
      case 5:
        Zs(n);
      default:
        ng(u, n), n = ft = km(n, kn), n = jy(u, n, kn);
    }
    l.memoizedProps = l.pendingProps, n === null ? hr(l) : ft = n;
  }
  function no(l, n, u, c) {
    Xn = ii = null, Zs(n), $i = null, Zc = 0;
    var s = n.return;
    try {
      if (l1(
        l,
        s,
        n,
        u,
        ut
      )) {
        Qt = 1, df(
          l,
          Ka(u, l.current)
        ), ft = null;
        return;
      }
    } catch (r) {
      if (s !== null) throw ft = s, r;
      Qt = 1, df(
        l,
        Ka(u, l.current)
      ), ft = null;
      return;
    }
    n.flags & 32768 ? (ot || c === 1 ? l = !0 : ic || (ut & 536870912) !== 0 ? l = !1 : (Nu = l = !0, (c === 2 || c === 9 || c === 3 || c === 6) && (c = ga.current, c !== null && c.tag === 13 && (c.flags |= 16384))), gg(n, l)) : hr(n);
  }
  function hr(l) {
    var n = l;
    do {
      if ((n.flags & 32768) !== 0) {
        gg(
          n,
          Nu
        );
        return;
      }
      l = n.return;
      var u = lg(
        n.alternate,
        n,
        kn
      );
      if (u !== null) {
        ft = u;
        return;
      }
      if (n = n.sibling, n !== null) {
        ft = n;
        return;
      }
      ft = n = l;
    } while (n !== null);
    Qt === 0 && (Qt = 5);
  }
  function gg(l, n) {
    do {
      var u = ag(l.alternate, l);
      if (u !== null) {
        u.flags &= 32767, ft = u;
        return;
      }
      if (u = l.return, u !== null && (u.flags |= 32768, u.subtreeFlags = 0, u.deletions = null), !n && (l = l.sibling, l !== null)) {
        ft = l;
        return;
      }
      ft = l = u;
    } while (l !== null);
    Qt = 6, ft = null;
  }
  function vg(l, n, u, c, s, r, m, v, A) {
    l.cancelPendingCommit = null;
    do
      zf();
    while (Rl !== 0);
    if ((bt & 6) !== 0) throw Error(M(327));
    if (n !== null) {
      if (n === l.current) throw Error(M(177));
      if (r = n.lanes | n.childLanes, r |= bn, Ho(
        l,
        u,
        r,
        m,
        v,
        A
      ), l === Nt && (ft = Nt = null, ut = 0), cc = n, pi = l, Hu = u, Ua = r, gh = s, vh = c, (n.subtreeFlags & 10256) !== 0 || (n.flags & 10256) !== 0 ? (l.callbackNode = null, l.callbackPriority = 0, _g(xn, function() {
        return Ag(), null;
      })) : (l.callbackNode = null, l.callbackPriority = 0), c = (n.flags & 13878) !== 0, (n.subtreeFlags & 13878) !== 0 || c) {
        c = _.T, _.T = null, s = Z.p, Z.p = 2, m = bt, bt |= 4;
        try {
          gf(l, n, u);
        } finally {
          bt = m, Z.p = s, _.T = c;
        }
      }
      Rl = 1, bg(), Sg(), Eg();
    }
  }
  function bg() {
    if (Rl === 1) {
      Rl = 0;
      var l = pi, n = cc, u = (n.flags & 13878) !== 0;
      if ((n.subtreeFlags & 13878) !== 0 || u) {
        u = _.T, _.T = null;
        var c = Z.p;
        Z.p = 2;
        var s = bt;
        bt |= 4;
        try {
          fh(n, l);
          var r = Mh, m = Gi(l.containerInfo), v = r.focusedElem, A = r.selectionRange;
          if (m !== v && v && v.ownerDocument && jc(
            v.ownerDocument.documentElement,
            v
          )) {
            if (A !== null && zs(v)) {
              var w = A.start, Q = A.end;
              if (Q === void 0 && (Q = w), "selectionStart" in v)
                v.selectionStart = w, v.selectionEnd = Math.min(
                  Q,
                  v.value.length
                );
              else {
                var W = v.ownerDocument || document, Y = W && W.defaultView || window;
                if (Y.getSelection) {
                  var X = Y.getSelection(), ye = v.textContent.length, He = Math.min(A.start, ye), jt = A.end === void 0 ? He : Math.min(A.end, ye);
                  !X.extend && He > jt && (m = jt, jt = He, He = m);
                  var N = Km(
                    v,
                    He
                  ), D = Km(
                    v,
                    jt
                  );
                  if (N && D && (X.rangeCount !== 1 || X.anchorNode !== N.node || X.anchorOffset !== N.offset || X.focusNode !== D.node || X.focusOffset !== D.offset)) {
                    var H = W.createRange();
                    H.setStart(N.node, N.offset), X.removeAllRanges(), He > jt ? (X.addRange(H), X.extend(D.node, D.offset)) : (H.setEnd(D.node, D.offset), X.addRange(H));
                  }
                }
              }
            }
            for (W = [], X = v; X = X.parentNode; )
              X.nodeType === 1 && W.push({
                element: X,
                left: X.scrollLeft,
                top: X.scrollTop
              });
            for (typeof v.focus == "function" && v.focus(), v = 0; v < W.length; v++) {
              var $ = W[v];
              $.element.scrollLeft = $.left, $.element.scrollTop = $.top;
            }
          }
          Ml = !!Rh, Mh = Rh = null;
        } finally {
          bt = s, Z.p = c, _.T = u;
        }
      }
      l.current = n, Rl = 2;
    }
  }
  function Sg() {
    if (Rl === 2) {
      Rl = 0;
      var l = pi, n = cc, u = (n.flags & 8772) !== 0;
      if ((n.subtreeFlags & 8772) !== 0 || u) {
        u = _.T, _.T = null;
        var c = Z.p;
        Z.p = 2;
        var s = bt;
        bt |= 4;
        try {
          ur(l, n.alternate, n);
        } finally {
          bt = s, Z.p = c, _.T = u;
        }
      }
      Rl = 3;
    }
  }
  function Eg() {
    if (Rl === 4 || Rl === 3) {
      Rl = 0, Sc();
      var l = pi, n = cc, u = Hu, c = vh;
      (n.subtreeFlags & 10256) !== 0 || (n.flags & 10256) !== 0 ? Rl = 5 : (Rl = 0, cc = pi = null, Tg(l, l.pendingLanes));
      var s = l.pendingLanes;
      if (s === 0 && (Pt = null), Em(u), n = n.stateNode, zl && typeof zl.onCommitFiberRoot == "function")
        try {
          zl.onCommitFiberRoot(
            hn,
            n,
            void 0,
            (n.current.flags & 128) === 128
          );
        } catch {
        }
      if (c !== null) {
        n = _.T, s = Z.p, Z.p = 2, _.T = null;
        try {
          for (var r = l.onRecoverableError, m = 0; m < c.length; m++) {
            var v = c[m];
            r(v.value, {
              componentStack: v.stack
            });
          }
        } finally {
          _.T = n, Z.p = s;
        }
      }
      (Hu & 3) !== 0 && zf(), wu(l), s = l.pendingLanes, (u & 261930) !== 0 && (s & 42) !== 0 ? l === rr ? Tf++ : (Tf = 0, rr = l) : Tf = 0, bi(0);
    }
  }
  function Tg(l, n) {
    (l.pooledCacheLanes &= n) === 0 && (n = l.pooledCache, n != null && (l.pooledCache = null, js(n)));
  }
  function zf() {
    return bg(), Sg(), Eg(), Ag();
  }
  function Ag() {
    if (Rl !== 5) return !1;
    var l = pi, n = Ua;
    Ua = 0;
    var u = Em(Hu), c = _.T, s = Z.p;
    try {
      Z.p = 32 > u ? 32 : u, _.T = null, u = gh, gh = null;
      var r = pi, m = Hu;
      if (Rl = 0, cc = pi = null, Hu = 0, (bt & 6) !== 0) throw Error(M(331));
      var v = bt;
      if (bt |= 4, Jy(r.current), vf(
        r,
        r.current,
        m,
        u
      ), bt = v, bi(0, !1), zl && typeof zl.onPostCommitFiberRoot == "function")
        try {
          zl.onPostCommitFiberRoot(hn, r);
        } catch {
        }
      return !0;
    } finally {
      Z.p = s, _.T = c, Tg(l, n);
    }
  }
  function Og(l, n, u) {
    n = Ka(u, n), n = Dy(l.stateNode, n, 2), l = Fa(l, n, 2), l !== null && (Ui(l, 2), wu(l));
  }
  function Rt(l, n, u) {
    if (l.tag === 3)
      Og(l, l, u);
    else
      for (; n !== null; ) {
        if (n.tag === 3) {
          Og(
            n,
            l,
            u
          );
          break;
        } else if (n.tag === 1) {
          var c = n.stateNode;
          if (typeof n.type.getDerivedStateFromError == "function" || typeof c.componentDidCatch == "function" && (Pt === null || !Pt.has(c))) {
            l = Ka(u, l), u = _y(2), c = Fa(n, u, 2), c !== null && (Ry(
              u,
              c,
              n,
              l
            ), Ui(c, 2), wu(c));
            break;
          }
        }
        n = n.return;
      }
  }
  function mr(l, n, u) {
    var c = l.pingCache;
    if (c === null) {
      c = l.pingCache = new Ky();
      var s = /* @__PURE__ */ new Set();
      c.set(n, s);
    } else
      s = c.get(n), s === void 0 && (s = /* @__PURE__ */ new Set(), c.set(n, s));
    s.has(u) || (mh = !0, s.add(u), l = Wy.bind(null, l, n, u), n.then(l, l));
  }
  function Wy(l, n, u) {
    var c = l.pingCache;
    c !== null && c.delete(n), l.pingedLanes |= l.suspendedLanes & u, l.warmLanes &= ~u, Nt === l && (ut & u) === u && (Qt === 4 || Qt === 3 && (ut & 62914560) === ut && 300 > Sl() - Fn ? (bt & 2) === 0 && ju(l, 0) : yh |= u, il === ut && (il = 0)), wu(l);
  }
  function zg(l, n) {
    n === 0 && (n = la()), l = ai(l, n), l !== null && (Ui(l, n), wu(l));
  }
  function an(l) {
    var n = l.memoizedState, u = 0;
    n !== null && (u = n.retryLane), zg(l, u);
  }
  function Dg(l, n) {
    var u = 0;
    switch (l.tag) {
      case 31:
      case 13:
        var c = l.stateNode, s = l.memoizedState;
        s !== null && (u = s.retryLane);
        break;
      case 19:
        c = l.stateNode;
        break;
      case 22:
        c = l.stateNode._retryCache;
        break;
      default:
        throw Error(M(314));
    }
    c !== null && c.delete(n), zg(l, u);
  }
  function _g(l, n) {
    return ge(l, n);
  }
  var Df = null, uo = null, Fy = !1, Eh = !1, Iy = !1, vi = 0;
  function wu(l) {
    l !== uo && l.next === null && (uo === null ? Df = uo = l : uo = uo.next = l), Eh = !0, Fy || (Fy = !0, pr());
  }
  function bi(l, n) {
    if (!Iy && Eh) {
      Iy = !0;
      do
        for (var u = !1, c = Df; c !== null; ) {
          if (l !== 0) {
            var s = c.pendingLanes;
            if (s === 0) var r = 0;
            else {
              var m = c.suspendedLanes, v = c.pingedLanes;
              r = (1 << 31 - Nl(42 | l) + 1) - 1, r &= s & ~(m & ~v), r = r & 201326741 ? r & 201326741 | 1 : r ? r | 2 : 0;
            }
            r !== 0 && (u = !0, io(c, r));
          } else
            r = ut, r = Se(
              c,
              c === Nt ? r : 0,
              c.cancelPendingCommit !== null || c.timeoutHandle !== -1
            ), (r & 3) === 0 || nt(c, r) || (u = !0, io(c, r));
          c = c.next;
        }
      while (u);
      Iy = !1;
    }
  }
  function Th() {
    Py();
  }
  function Py() {
    Eh = Fy = !1;
    var l = 0;
    vi !== 0 && n1() && (l = vi);
    for (var n = Sl(), u = null, c = Df; c !== null; ) {
      var s = c.next, r = ep(c, n);
      r === 0 ? (c.next = null, u === null ? Df = s : u.next = s, s === null && (uo = u)) : (u = c, (l !== 0 || (r & 3) !== 0) && (Eh = !0)), c = s;
    }
    Rl !== 0 && Rl !== 5 || bi(l), vi !== 0 && (vi = 0);
  }
  function ep(l, n) {
    for (var u = l.suspendedLanes, c = l.pingedLanes, s = l.expirationTimes, r = l.pendingLanes & -62914561; 0 < r; ) {
      var m = 31 - Nl(r), v = 1 << m, A = s[m];
      A === -1 ? ((v & u) === 0 || (v & c) !== 0) && (s[m] = Je(v, n)) : A <= n && (l.expiredLanes |= v), r &= ~v;
    }
    if (n = Nt, u = ut, u = Se(
      l,
      l === n ? u : 0,
      l.cancelPendingCommit !== null || l.timeoutHandle !== -1
    ), c = l.callbackNode, u === 0 || l === n && (_t === 2 || _t === 9) || l.cancelPendingCommit !== null)
      return c !== null && c !== null && Ci(c), l.callbackNode = null, l.callbackPriority = 0;
    if ((u & 3) === 0 || nt(l, u)) {
      if (n = u & -u, n === l.callbackPriority) return n;
      switch (c !== null && Ci(c), Em(u)) {
        case 2:
        case 8:
          u = Uo;
          break;
        case 32:
          u = xn;
          break;
        case 268435456:
          u = No;
          break;
        default:
          u = xn;
      }
      return c = yr.bind(null, l), u = ge(u, c), l.callbackPriority = n, l.callbackNode = u, n;
    }
    return c !== null && c !== null && Ci(c), l.callbackPriority = 2, l.callbackNode = null, 2;
  }
  function yr(l, n) {
    if (Rl !== 0 && Rl !== 5)
      return l.callbackNode = null, l.callbackPriority = 0, null;
    var u = l.callbackNode;
    if (zf() && l.callbackNode !== u)
      return null;
    var c = ut;
    return c = Se(
      l,
      l === Nt ? c : 0,
      l.cancelPendingCommit !== null || l.timeoutHandle !== -1
    ), c === 0 ? null : (fg(l, c, n), ep(l, Sl()), l.callbackNode != null && l.callbackNode === u ? yr.bind(null, l) : null);
  }
  function io(l, n) {
    if (zf()) return null;
    fg(l, n, !0);
  }
  function pr() {
    jg(function() {
      (bt & 6) !== 0 ? ge(
        xo,
        Th
      ) : Py();
    });
  }
  function Ah() {
    if (vi === 0) {
      var l = Vi;
      l === 0 && (l = ae, ae <<= 1, (ae & 261888) === 0 && (ae = 256)), vi = l;
    }
    return vi;
  }
  function Rg(l) {
    return l == null || typeof l == "symbol" || typeof l == "boolean" ? null : typeof l == "function" ? l : yn("" + l);
  }
  function co(l, n) {
    var u = n.ownerDocument.createElement("input");
    return u.name = n.name, u.value = n.value, l.id && u.setAttribute("form", l.id), n.parentNode.insertBefore(u, n), l = new FormData(l), u.parentNode.removeChild(u), l;
  }
  function gr(l, n, u, c, s) {
    if (n === "submit" && u && u.stateNode === s) {
      var r = Rg(
        (s[ra] || null).action
      ), m = c.submitter;
      m && (n = (n = m[ra] || null) ? Rg(n.formAction) : m.getAttribute("formAction"), n !== null && (r = n, m = null));
      var v = new Ts(
        "action",
        "action",
        null,
        c,
        s
      );
      l.push({
        event: v,
        listeners: [
          {
            instance: null,
            listener: function() {
              if (c.defaultPrevented) {
                if (vi !== 0) {
                  var A = m ? co(s, m) : new FormData(s);
                  sf(
                    u,
                    {
                      pending: !0,
                      data: A,
                      method: s.method,
                      action: r
                    },
                    null,
                    A
                  );
                }
              } else
                typeof r == "function" && (v.preventDefault(), A = m ? co(s, m) : new FormData(s), sf(
                  u,
                  {
                    pending: !0,
                    data: A,
                    method: s.method,
                    action: r
                  },
                  r,
                  A
                ));
            },
            currentTarget: s
          }
        ]
      });
    }
  }
  for (var Oh = 0; Oh < $o.length; Oh++) {
    var _f = $o[Oh], tp = _f.toLowerCase(), lp = _f[0].toUpperCase() + _f.slice(1);
    ha(
      tp,
      "on" + lp
    );
  }
  ha(_s, "onAnimationEnd"), ha($m, "onAnimationIteration"), ha(Od, "onAnimationStart"), ha("dblclick", "onDoubleClick"), ha("focusin", "onFocus"), ha("focusout", "onBlur"), ha(wc, "onTransitionRun"), ha(Rs, "onTransitionStart"), ha(pu, "onTransitionCancel"), ha(q0, "onTransitionEnd"), ru("onMouseEnter", ["mouseout", "mouseover"]), ru("onMouseLeave", ["mouseout", "mouseover"]), ru("onPointerEnter", ["pointerout", "pointerover"]), ru("onPointerLeave", ["pointerout", "pointerover"]), ji(
    "onChange",
    "change click focusin focusout input keydown keyup selectionchange".split(" ")
  ), ji(
    "onSelect",
    "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
      " "
    )
  ), ji("onBeforeInput", [
    "compositionend",
    "keypress",
    "textInput",
    "paste"
  ]), ji(
    "onCompositionEnd",
    "compositionend focusout keydown keypress keyup mousedown".split(" ")
  ), ji(
    "onCompositionStart",
    "compositionstart focusout keydown keypress keyup mousedown".split(" ")
  ), ji(
    "onCompositionUpdate",
    "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
  );
  var Rf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
    " "
  ), Mg = new Set(
    "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Rf)
  );
  function Cg(l, n) {
    n = (n & 4) !== 0;
    for (var u = 0; u < l.length; u++) {
      var c = l[u], s = c.event;
      c = c.listeners;
      e: {
        var r = void 0;
        if (n)
          for (var m = c.length - 1; 0 <= m; m--) {
            var v = c[m], A = v.instance, w = v.currentTarget;
            if (v = v.listener, A !== r && s.isPropagationStopped())
              break e;
            r = v, s.currentTarget = w;
            try {
              r(s);
            } catch (Q) {
              Bc(Q);
            }
            s.currentTarget = null, r = A;
          }
        else
          for (m = 0; m < c.length; m++) {
            if (v = c[m], A = v.instance, w = v.currentTarget, v = v.listener, A !== r && s.isPropagationStopped())
              break e;
            r = v, s.currentTarget = w;
            try {
              r(s);
            } catch (Q) {
              Bc(Q);
            }
            s.currentTarget = null, r = A;
          }
      }
    }
  }
  function ct(l, n) {
    var u = n[ad];
    u === void 0 && (u = n[ad] = /* @__PURE__ */ new Set());
    var c = l + "__bubble";
    u.has(c) || (vr(n, l, 2, !1), u.add(c));
  }
  function ap(l, n, u) {
    var c = 0;
    n && (c |= 4), vr(
      u,
      l,
      c,
      n
    );
  }
  var zh = "_reactListening" + Math.random().toString(36).slice(2);
  function Mf(l) {
    if (!l[zh]) {
      l[zh] = !0, zc.forEach(function(u) {
        u !== "selectionchange" && (Mg.has(u) || ap(u, !1, l), ap(u, !0, l));
      });
      var n = l.nodeType === 9 ? l : l.ownerDocument;
      n === null || n[zh] || (n[zh] = !0, ap("selectionchange", !1, n));
    }
  }
  function vr(l, n, u, c) {
    switch (_r(n)) {
      case 2:
        var s = Yu;
        break;
      case 8:
        s = qu;
        break;
      default:
        s = Fl;
    }
    u = s.bind(
      null,
      n,
      u,
      l
    ), s = void 0, !Ss || n !== "touchstart" && n !== "touchmove" && n !== "wheel" || (s = !0), c ? s !== void 0 ? l.addEventListener(n, u, {
      capture: !0,
      passive: s
    }) : l.addEventListener(n, u, !0) : s !== void 0 ? l.addEventListener(n, u, {
      passive: s
    }) : l.addEventListener(n, u, !1);
  }
  function np(l, n, u, c, s) {
    var r = c;
    if ((n & 1) === 0 && (n & 2) === 0 && c !== null)
      e: for (; ; ) {
        if (c === null) return;
        var m = c.tag;
        if (m === 3 || m === 4) {
          var v = c.stateNode.containerInfo;
          if (v === s) break;
          if (m === 4)
            for (m = c.return; m !== null; ) {
              var A = m.tag;
              if ((A === 3 || A === 4) && m.stateNode.containerInfo === s)
                return;
              m = m.return;
            }
          for (; v !== null; ) {
            if (m = Tc(v), m === null) return;
            if (A = m.tag, A === 5 || A === 6 || A === 26 || A === 27) {
              c = r = m;
              continue e;
            }
            v = v.parentNode;
          }
        }
        c = c.return;
      }
    Cm(function() {
      var w = r, Q = rd(u), W = [];
      e: {
        var Y = gu.get(l);
        if (Y !== void 0) {
          var X = Ts, ye = l;
          switch (l) {
            case "keypress":
              if (hd(u) === 0) break e;
            case "keydown":
            case "keyup":
              X = gd;
              break;
            case "focusin":
              ye = "focus", X = yd;
              break;
            case "focusout":
              ye = "blur", X = yd;
              break;
            case "beforeblur":
            case "afterblur":
              X = yd;
              break;
            case "click":
              if (u.button === 2) break e;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              X = Qo;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              X = _0;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              X = U0;
              break;
            case _s:
            case $m:
            case Od:
              X = M0;
              break;
            case q0:
              X = Iv;
              break;
            case "scroll":
            case "scrollend":
              X = Wv;
              break;
            case "wheel":
              X = Pv;
              break;
            case "copy":
            case "cut":
            case "paste":
              X = Mc;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              X = wn;
              break;
            case "toggle":
            case "beforetoggle":
              X = qm;
          }
          var He = (n & 4) !== 0, jt = !He && (l === "scroll" || l === "scrollend"), N = He ? Y !== null ? Y + "Capture" : null : Y;
          He = [];
          for (var D = w, H; D !== null; ) {
            var $ = D;
            if (H = $.stateNode, $ = $.tag, $ !== 5 && $ !== 26 && $ !== 27 || H === null || N === null || ($ = Hl(D, N), $ != null && He.push(
              br(D, $, H)
            )), jt) break;
            D = D.return;
          }
          0 < He.length && (Y = new X(
            Y,
            ye,
            null,
            u,
            Q
          ), W.push({ event: Y, listeners: He }));
        }
      }
      if ((n & 7) === 0) {
        e: {
          if (Y = l === "mouseover" || l === "pointerover", X = l === "mouseout" || l === "pointerout", Y && u !== sd && (ye = u.relatedTarget || u.fromElement) && (Tc(ye) || ye[Ni]))
            break e;
          if ((X || Y) && (Y = Q.window === Q ? Q : (Y = Q.ownerDocument) ? Y.defaultView || Y.parentWindow : window, X ? (ye = u.relatedTarget || u.toElement, X = w, ye = ye ? Tc(ye) : null, ye !== null && (jt = oe(ye), He = ye.tag, ye !== jt || He !== 5 && He !== 27 && He !== 6) && (ye = null)) : (X = null, ye = w), X !== ye)) {
            if (He = Qo, $ = "onMouseLeave", N = "onMouseEnter", D = "mouse", (l === "pointerout" || l === "pointerover") && (He = wn, $ = "onPointerLeave", N = "onPointerEnter", D = "pointer"), jt = X == null ? Y : jo(X), H = ye == null ? Y : jo(ye), Y = new He(
              $,
              D + "leave",
              X,
              u,
              Q
            ), Y.target = jt, Y.relatedTarget = H, $ = null, Tc(Q) === w && (He = new He(
              N,
              D + "enter",
              ye,
              u,
              Q
            ), He.target = H, He.relatedTarget = jt, $ = He), jt = $, X && ye)
              t: {
                for (He = xg, N = X, D = ye, H = 0, $ = N; $; $ = He($))
                  H++;
                $ = 0;
                for (var _e = D; _e; _e = He(_e))
                  $++;
                for (; 0 < H - $; )
                  N = He(N), H--;
                for (; 0 < $ - H; )
                  D = He(D), $--;
                for (; H--; ) {
                  if (N === D || D !== null && N === D.alternate) {
                    He = N;
                    break t;
                  }
                  N = He(N), D = He(D);
                }
                He = null;
              }
            else He = null;
            X !== null && Dh(
              W,
              Y,
              X,
              He,
              !1
            ), ye !== null && jt !== null && Dh(
              W,
              jt,
              ye,
              He,
              !0
            );
          }
        }
        e: {
          if (Y = w ? jo(w) : window, X = Y.nodeName && Y.nodeName.toLowerCase(), X === "select" || X === "input" && Y.type === "file")
            var yt = Vm;
          else if (yu(Y))
            if (Sd)
              yt = Hc;
            else {
              yt = B0;
              var Ee = w0;
            }
          else
            X = Y.nodeName, !X || X.toLowerCase() !== "input" || Y.type !== "checkbox" && Y.type !== "radio" ? w && Mm(w.elementType) && (yt = Vm) : yt = qi;
          if (yt && (yt = yt(l, w))) {
            Qm(
              W,
              yt,
              u,
              Q
            );
            break e;
          }
          Ee && Ee(l, Y, w), l === "focusout" && w && Y.type === "number" && w.memoizedProps.value != null && Dc(Y, "number", Y.value);
        }
        switch (Ee = w ? jo(w) : window, l) {
          case "focusin":
            (yu(Ee) || Ee.contentEditable === "true") && (Li = Ee, Jo = w, vn = null);
            break;
          case "focusout":
            vn = Jo = Li = null;
            break;
          case "mousedown":
            Yn = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            Yn = !1, Ad(W, u, Q);
            break;
          case "selectionchange":
            if (Ds) break;
          case "keydown":
          case "keyup":
            Ad(W, u, Q);
        }
        var Ke;
        if (Vo)
          e: {
            switch (l) {
              case "compositionstart":
                var Ie = "onCompositionStart";
                break e;
              case "compositionend":
                Ie = "onCompositionEnd";
                break e;
              case "compositionupdate":
                Ie = "onCompositionUpdate";
                break e;
            }
            Ie = void 0;
          }
        else
          xc ? bd(l, u) && (Ie = "onCompositionEnd") : l === "keydown" && u.keyCode === 229 && (Ie = "onCompositionStart");
        Ie && (Gm && u.locale !== "ko" && (xc || Ie !== "onCompositionStart" ? Ie === "onCompositionEnd" && xc && (Ke = Um()) : (ti = Q, xm = "value" in ti ? ti.value : ti.textContent, xc = !0)), Ee = Sr(w, Ie), 0 < Ee.length && (Ie = new C0(
          Ie,
          l,
          null,
          u,
          Q
        ), W.push({ event: Ie, listeners: Ee }), Ke ? Ie.data = Ke : (Ke = Lm(u), Ke !== null && (Ie.data = Ke)))), (Ke = aa ? j0(l, u) : e1(l, u)) && (Ie = Sr(w, "onBeforeInput"), 0 < Ie.length && (Ee = new C0(
          "onBeforeInput",
          "beforeinput",
          null,
          u,
          Q
        ), W.push({
          event: Ee,
          listeners: Ie
        }), Ee.data = Ke)), gr(
          W,
          l,
          w,
          u,
          Q
        );
      }
      Cg(W, n);
    });
  }
  function br(l, n, u) {
    return {
      instance: l,
      listener: n,
      currentTarget: u
    };
  }
  function Sr(l, n) {
    for (var u = n + "Capture", c = []; l !== null; ) {
      var s = l, r = s.stateNode;
      if (s = s.tag, s !== 5 && s !== 26 && s !== 27 || r === null || (s = Hl(l, u), s != null && c.unshift(
        br(l, s, r)
      ), s = Hl(l, n), s != null && c.push(
        br(l, s, r)
      )), l.tag === 3) return c;
      l = l.return;
    }
    return [];
  }
  function xg(l) {
    if (l === null) return null;
    do
      l = l.return;
    while (l && l.tag !== 5 && l.tag !== 27);
    return l || null;
  }
  function Dh(l, n, u, c, s) {
    for (var r = n._reactName, m = []; u !== null && u !== c; ) {
      var v = u, A = v.alternate, w = v.stateNode;
      if (v = v.tag, A !== null && A === c) break;
      v !== 5 && v !== 26 && v !== 27 || w === null || (A = w, s ? (w = Hl(u, r), w != null && m.unshift(
        br(u, w, A)
      )) : s || (w = Hl(u, r), w != null && m.push(
        br(u, w, A)
      ))), u = u.return;
    }
    m.length !== 0 && l.push({ event: n, listeners: m });
  }
  var Ug = /\r\n?/g, up = /\u0000|\uFFFD/g;
  function ip(l) {
    return (typeof l == "string" ? l : "" + l).replace(Ug, `
`).replace(up, "");
  }
  function cp(l, n) {
    return n = ip(n), ip(l) === n;
  }
  function Ht(l, n, u, c, s, r) {
    switch (u) {
      case "children":
        typeof c == "string" ? n === "body" || n === "textarea" && c === "" || du(l, c) : (typeof c == "number" || typeof c == "bigint") && n !== "body" && du(l, "" + c);
        break;
      case "className":
        cd(l, "class", c);
        break;
      case "tabIndex":
        cd(l, "tabindex", c);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        cd(l, u, c);
        break;
      case "style":
        O0(l, c, r);
        break;
      case "data":
        if (n !== "object") {
          cd(l, "data", c);
          break;
        }
      case "src":
      case "href":
        if (c === "" && (n !== "a" || u !== "href")) {
          l.removeAttribute(u);
          break;
        }
        if (c == null || typeof c == "function" || typeof c == "symbol" || typeof c == "boolean") {
          l.removeAttribute(u);
          break;
        }
        c = yn("" + c), l.setAttribute(u, c);
        break;
      case "action":
      case "formAction":
        if (typeof c == "function") {
          l.setAttribute(
            u,
            "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
          );
          break;
        } else
          typeof r == "function" && (u === "formAction" ? (n !== "input" && Ht(l, n, "name", s.name, s, null), Ht(
            l,
            n,
            "formEncType",
            s.formEncType,
            s,
            null
          ), Ht(
            l,
            n,
            "formMethod",
            s.formMethod,
            s,
            null
          ), Ht(
            l,
            n,
            "formTarget",
            s.formTarget,
            s,
            null
          )) : (Ht(l, n, "encType", s.encType, s, null), Ht(l, n, "method", s.method, s, null), Ht(l, n, "target", s.target, s, null)));
        if (c == null || typeof c == "symbol" || typeof c == "boolean") {
          l.removeAttribute(u);
          break;
        }
        c = yn("" + c), l.setAttribute(u, c);
        break;
      case "onClick":
        c != null && (l.onclick = Nn);
        break;
      case "onScroll":
        c != null && ct("scroll", l);
        break;
      case "onScrollEnd":
        c != null && ct("scrollend", l);
        break;
      case "dangerouslySetInnerHTML":
        if (c != null) {
          if (typeof c != "object" || !("__html" in c))
            throw Error(M(61));
          if (u = c.__html, u != null) {
            if (s.children != null) throw Error(M(60));
            l.innerHTML = u;
          }
        }
        break;
      case "multiple":
        l.multiple = c && typeof c != "function" && typeof c != "symbol";
        break;
      case "muted":
        l.muted = c && typeof c != "function" && typeof c != "symbol";
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "defaultValue":
      case "defaultChecked":
      case "innerHTML":
      case "ref":
        break;
      case "autoFocus":
        break;
      case "xlinkHref":
        if (c == null || typeof c == "function" || typeof c == "boolean" || typeof c == "symbol") {
          l.removeAttribute("xlink:href");
          break;
        }
        u = yn("" + c), l.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          u
        );
        break;
      case "contentEditable":
      case "spellCheck":
      case "draggable":
      case "value":
      case "autoReverse":
      case "externalResourcesRequired":
      case "focusable":
      case "preserveAlpha":
        c != null && typeof c != "function" && typeof c != "symbol" ? l.setAttribute(u, "" + c) : l.removeAttribute(u);
        break;
      case "inert":
      case "allowFullScreen":
      case "async":
      case "autoPlay":
      case "controls":
      case "default":
      case "defer":
      case "disabled":
      case "disablePictureInPicture":
      case "disableRemotePlayback":
      case "formNoValidate":
      case "hidden":
      case "loop":
      case "noModule":
      case "noValidate":
      case "open":
      case "playsInline":
      case "readOnly":
      case "required":
      case "reversed":
      case "scoped":
      case "seamless":
      case "itemScope":
        c && typeof c != "function" && typeof c != "symbol" ? l.setAttribute(u, "") : l.removeAttribute(u);
        break;
      case "capture":
      case "download":
        c === !0 ? l.setAttribute(u, "") : c !== !1 && c != null && typeof c != "function" && typeof c != "symbol" ? l.setAttribute(u, c) : l.removeAttribute(u);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        c != null && typeof c != "function" && typeof c != "symbol" && !isNaN(c) && 1 <= c ? l.setAttribute(u, c) : l.removeAttribute(u);
        break;
      case "rowSpan":
      case "start":
        c == null || typeof c == "function" || typeof c == "symbol" || isNaN(c) ? l.removeAttribute(u) : l.setAttribute(u, c);
        break;
      case "popover":
        ct("beforetoggle", l), ct("toggle", l), Yo(l, "popover", c);
        break;
      case "xlinkActuate":
        Pu(
          l,
          "http://www.w3.org/1999/xlink",
          "xlink:actuate",
          c
        );
        break;
      case "xlinkArcrole":
        Pu(
          l,
          "http://www.w3.org/1999/xlink",
          "xlink:arcrole",
          c
        );
        break;
      case "xlinkRole":
        Pu(
          l,
          "http://www.w3.org/1999/xlink",
          "xlink:role",
          c
        );
        break;
      case "xlinkShow":
        Pu(
          l,
          "http://www.w3.org/1999/xlink",
          "xlink:show",
          c
        );
        break;
      case "xlinkTitle":
        Pu(
          l,
          "http://www.w3.org/1999/xlink",
          "xlink:title",
          c
        );
        break;
      case "xlinkType":
        Pu(
          l,
          "http://www.w3.org/1999/xlink",
          "xlink:type",
          c
        );
        break;
      case "xmlBase":
        Pu(
          l,
          "http://www.w3.org/XML/1998/namespace",
          "xml:base",
          c
        );
        break;
      case "xmlLang":
        Pu(
          l,
          "http://www.w3.org/XML/1998/namespace",
          "xml:lang",
          c
        );
        break;
      case "xmlSpace":
        Pu(
          l,
          "http://www.w3.org/XML/1998/namespace",
          "xml:space",
          c
        );
        break;
      case "is":
        Yo(l, "is", c);
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        (!(2 < u.length) || u[0] !== "o" && u[0] !== "O" || u[1] !== "n" && u[1] !== "N") && (u = kv.get(u) || u, Yo(l, u, c));
    }
  }
  function op(l, n, u, c, s, r) {
    switch (u) {
      case "style":
        O0(l, c, r);
        break;
      case "dangerouslySetInnerHTML":
        if (c != null) {
          if (typeof c != "object" || !("__html" in c))
            throw Error(M(61));
          if (u = c.__html, u != null) {
            if (s.children != null) throw Error(M(60));
            l.innerHTML = u;
          }
        }
        break;
      case "children":
        typeof c == "string" ? du(l, c) : (typeof c == "number" || typeof c == "bigint") && du(l, "" + c);
        break;
      case "onScroll":
        c != null && ct("scroll", l);
        break;
      case "onScrollEnd":
        c != null && ct("scrollend", l);
        break;
      case "onClick":
        c != null && (l.onclick = Nn);
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "innerHTML":
      case "ref":
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        if (!Hi.hasOwnProperty(u))
          e: {
            if (u[0] === "o" && u[1] === "n" && (s = u.endsWith("Capture"), n = u.slice(2, s ? u.length - 7 : void 0), r = l[ra] || null, r = r != null ? r[u] : null, typeof r == "function" && l.removeEventListener(n, r, s), typeof c == "function")) {
              typeof r != "function" && r !== null && (u in l ? l[u] = null : l.hasAttribute(u) && l.removeAttribute(u)), l.addEventListener(n, c, s);
              break e;
            }
            u in l ? l[u] = c : c === !0 ? l.setAttribute(u, "") : Yo(l, u, c);
          }
    }
  }
  function Wl(l, n, u) {
    switch (n) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "img":
        ct("error", l), ct("load", l);
        var c = !1, s = !1, r;
        for (r in u)
          if (u.hasOwnProperty(r)) {
            var m = u[r];
            if (m != null)
              switch (r) {
                case "src":
                  c = !0;
                  break;
                case "srcSet":
                  s = !0;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(M(137, n));
                default:
                  Ht(l, n, r, m, u, null);
              }
          }
        s && Ht(l, n, "srcSet", u.srcSet, u, null), c && Ht(l, n, "src", u.src, u, null);
        return;
      case "input":
        ct("invalid", l);
        var v = r = m = s = null, A = null, w = null;
        for (c in u)
          if (u.hasOwnProperty(c)) {
            var Q = u[c];
            if (Q != null)
              switch (c) {
                case "name":
                  s = Q;
                  break;
                case "type":
                  m = Q;
                  break;
                case "checked":
                  A = Q;
                  break;
                case "defaultChecked":
                  w = Q;
                  break;
                case "value":
                  r = Q;
                  break;
                case "defaultValue":
                  v = Q;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (Q != null)
                    throw Error(M(137, n));
                  break;
                default:
                  Ht(l, n, c, Q, u, null);
              }
          }
        gs(
          l,
          r,
          v,
          A,
          w,
          m,
          s,
          !1
        );
        return;
      case "select":
        ct("invalid", l), c = m = r = null;
        for (s in u)
          if (u.hasOwnProperty(s) && (v = u[s], v != null))
            switch (s) {
              case "value":
                r = v;
                break;
              case "defaultValue":
                m = v;
                break;
              case "multiple":
                c = v;
              default:
                Ht(l, n, s, v, u, null);
            }
        n = r, u = m, l.multiple = !!c, n != null ? qo(l, !!c, n, !1) : u != null && qo(l, !!c, u, !0);
        return;
      case "textarea":
        ct("invalid", l), r = s = c = null;
        for (m in u)
          if (u.hasOwnProperty(m) && (v = u[m], v != null))
            switch (m) {
              case "value":
                c = v;
                break;
              case "defaultValue":
                s = v;
                break;
              case "children":
                r = v;
                break;
              case "dangerouslySetInnerHTML":
                if (v != null) throw Error(M(91));
                break;
              default:
                Ht(l, n, m, v, u, null);
            }
        Rm(l, c, s, r);
        return;
      case "option":
        for (A in u)
          if (u.hasOwnProperty(A) && (c = u[A], c != null))
            switch (A) {
              case "selected":
                l.selected = c && typeof c != "function" && typeof c != "symbol";
                break;
              default:
                Ht(l, n, A, c, u, null);
            }
        return;
      case "dialog":
        ct("beforetoggle", l), ct("toggle", l), ct("cancel", l), ct("close", l);
        break;
      case "iframe":
      case "object":
        ct("load", l);
        break;
      case "video":
      case "audio":
        for (c = 0; c < Rf.length; c++)
          ct(Rf[c], l);
        break;
      case "image":
        ct("error", l), ct("load", l);
        break;
      case "details":
        ct("toggle", l);
        break;
      case "embed":
      case "source":
      case "link":
        ct("error", l), ct("load", l);
      case "area":
      case "base":
      case "br":
      case "col":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "track":
      case "wbr":
      case "menuitem":
        for (w in u)
          if (u.hasOwnProperty(w) && (c = u[w], c != null))
            switch (w) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(M(137, n));
              default:
                Ht(l, n, w, c, u, null);
            }
        return;
      default:
        if (Mm(n)) {
          for (Q in u)
            u.hasOwnProperty(Q) && (c = u[Q], c !== void 0 && op(
              l,
              n,
              Q,
              c,
              u,
              void 0
            ));
          return;
        }
    }
    for (v in u)
      u.hasOwnProperty(v) && (c = u[v], c != null && Ht(l, n, v, c, u, null));
  }
  function fp(l, n, u, c) {
    switch (n) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "input":
        var s = null, r = null, m = null, v = null, A = null, w = null, Q = null;
        for (X in u) {
          var W = u[X];
          if (u.hasOwnProperty(X) && W != null)
            switch (X) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                A = W;
              default:
                c.hasOwnProperty(X) || Ht(l, n, X, null, c, W);
            }
        }
        for (var Y in c) {
          var X = c[Y];
          if (W = u[Y], c.hasOwnProperty(Y) && (X != null || W != null))
            switch (Y) {
              case "type":
                r = X;
                break;
              case "name":
                s = X;
                break;
              case "checked":
                w = X;
                break;
              case "defaultChecked":
                Q = X;
                break;
              case "value":
                m = X;
                break;
              case "defaultValue":
                v = X;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (X != null)
                  throw Error(M(137, n));
                break;
              default:
                X !== W && Ht(
                  l,
                  n,
                  Y,
                  X,
                  c,
                  W
                );
            }
        }
        ps(
          l,
          m,
          v,
          A,
          w,
          Q,
          r,
          s
        );
        return;
      case "select":
        X = m = v = Y = null;
        for (r in u)
          if (A = u[r], u.hasOwnProperty(r) && A != null)
            switch (r) {
              case "value":
                break;
              case "multiple":
                X = A;
              default:
                c.hasOwnProperty(r) || Ht(
                  l,
                  n,
                  r,
                  null,
                  c,
                  A
                );
            }
        for (s in c)
          if (r = c[s], A = u[s], c.hasOwnProperty(s) && (r != null || A != null))
            switch (s) {
              case "value":
                Y = r;
                break;
              case "defaultValue":
                v = r;
                break;
              case "multiple":
                m = r;
              default:
                r !== A && Ht(
                  l,
                  n,
                  s,
                  r,
                  c,
                  A
                );
            }
        n = v, u = m, c = X, Y != null ? qo(l, !!u, Y, !1) : !!c != !!u && (n != null ? qo(l, !!u, n, !0) : qo(l, !!u, u ? [] : "", !1));
        return;
      case "textarea":
        X = Y = null;
        for (v in u)
          if (s = u[v], u.hasOwnProperty(v) && s != null && !c.hasOwnProperty(v))
            switch (v) {
              case "value":
                break;
              case "children":
                break;
              default:
                Ht(l, n, v, null, c, s);
            }
        for (m in c)
          if (s = c[m], r = u[m], c.hasOwnProperty(m) && (s != null || r != null))
            switch (m) {
              case "value":
                Y = s;
                break;
              case "defaultValue":
                X = s;
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (s != null) throw Error(M(91));
                break;
              default:
                s !== r && Ht(l, n, m, s, c, r);
            }
        _m(l, Y, X);
        return;
      case "option":
        for (var ye in u)
          if (Y = u[ye], u.hasOwnProperty(ye) && Y != null && !c.hasOwnProperty(ye))
            switch (ye) {
              case "selected":
                l.selected = !1;
                break;
              default:
                Ht(
                  l,
                  n,
                  ye,
                  null,
                  c,
                  Y
                );
            }
        for (A in c)
          if (Y = c[A], X = u[A], c.hasOwnProperty(A) && Y !== X && (Y != null || X != null))
            switch (A) {
              case "selected":
                l.selected = Y && typeof Y != "function" && typeof Y != "symbol";
                break;
              default:
                Ht(
                  l,
                  n,
                  A,
                  Y,
                  c,
                  X
                );
            }
        return;
      case "img":
      case "link":
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
      case "menuitem":
        for (var He in u)
          Y = u[He], u.hasOwnProperty(He) && Y != null && !c.hasOwnProperty(He) && Ht(l, n, He, null, c, Y);
        for (w in c)
          if (Y = c[w], X = u[w], c.hasOwnProperty(w) && Y !== X && (Y != null || X != null))
            switch (w) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (Y != null)
                  throw Error(M(137, n));
                break;
              default:
                Ht(
                  l,
                  n,
                  w,
                  Y,
                  c,
                  X
                );
            }
        return;
      default:
        if (Mm(n)) {
          for (var jt in u)
            Y = u[jt], u.hasOwnProperty(jt) && Y !== void 0 && !c.hasOwnProperty(jt) && op(
              l,
              n,
              jt,
              void 0,
              c,
              Y
            );
          for (Q in c)
            Y = c[Q], X = u[Q], !c.hasOwnProperty(Q) || Y === X || Y === void 0 && X === void 0 || op(
              l,
              n,
              Q,
              Y,
              c,
              X
            );
          return;
        }
    }
    for (var N in u)
      Y = u[N], u.hasOwnProperty(N) && Y != null && !c.hasOwnProperty(N) && Ht(l, n, N, null, c, Y);
    for (W in c)
      Y = c[W], X = u[W], !c.hasOwnProperty(W) || Y === X || Y == null && X == null || Ht(l, n, W, Y, c, X);
  }
  function _h(l) {
    switch (l) {
      case "css":
      case "script":
      case "font":
      case "img":
      case "image":
      case "input":
      case "link":
        return !0;
      default:
        return !1;
    }
  }
  function sp() {
    if (typeof performance.getEntriesByType == "function") {
      for (var l = 0, n = 0, u = performance.getEntriesByType("resource"), c = 0; c < u.length; c++) {
        var s = u[c], r = s.transferSize, m = s.initiatorType, v = s.duration;
        if (r && v && _h(m)) {
          for (m = 0, v = s.responseEnd, c += 1; c < u.length; c++) {
            var A = u[c], w = A.startTime;
            if (w > v) break;
            var Q = A.transferSize, W = A.initiatorType;
            Q && _h(W) && (A = A.responseEnd, m += Q * (A < v ? 1 : (v - w) / (A - w)));
          }
          if (--c, n += 8 * (r + m) / (s.duration / 1e3), l++, 10 < l) break;
        }
      }
      if (0 < l) return n / l / 1e6;
    }
    return navigator.connection && (l = navigator.connection.downlink, typeof l == "number") ? l : 5;
  }
  var Rh = null, Mh = null;
  function fc(l) {
    return l.nodeType === 9 ? l : l.ownerDocument;
  }
  function Ng(l) {
    switch (l) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function rp(l, n) {
    if (l === 0)
      switch (n) {
        case "svg":
          return 1;
        case "math":
          return 2;
        default:
          return 0;
      }
    return l === 1 && n === "foreignObject" ? 0 : l;
  }
  function Cf(l, n) {
    return l === "textarea" || l === "noscript" || typeof n.children == "string" || typeof n.children == "number" || typeof n.children == "bigint" || typeof n.dangerouslySetInnerHTML == "object" && n.dangerouslySetInnerHTML !== null && n.dangerouslySetInnerHTML.__html != null;
  }
  var Ch = null;
  function n1() {
    var l = window.event;
    return l && l.type === "popstate" ? l === Ch ? !1 : (Ch = l, !0) : (Ch = null, !1);
  }
  var Er = typeof setTimeout == "function" ? setTimeout : void 0, Hg = typeof clearTimeout == "function" ? clearTimeout : void 0, oo = typeof Promise == "function" ? Promise : void 0, jg = typeof queueMicrotask == "function" ? queueMicrotask : typeof oo < "u" ? function(l) {
    return oo.resolve(null).then(l).catch(dp);
  } : Er;
  function dp(l) {
    setTimeout(function() {
      throw l;
    });
  }
  function In(l) {
    return l === "head";
  }
  function hp(l, n) {
    var u = n, c = 0;
    do {
      var s = u.nextSibling;
      if (l.removeChild(u), s && s.nodeType === 8)
        if (u = s.data, u === "/$" || u === "/&") {
          if (c === 0) {
            l.removeChild(s), Xf(n);
            return;
          }
          c--;
        } else if (u === "$" || u === "$?" || u === "$~" || u === "$!" || u === "&")
          c++;
        else if (u === "html")
          fo(l.ownerDocument.documentElement);
        else if (u === "head") {
          u = l.ownerDocument.head, fo(u);
          for (var r = u.firstChild; r; ) {
            var m = r.nextSibling, v = r.nodeName;
            r[su] || v === "SCRIPT" || v === "STYLE" || v === "LINK" && r.rel.toLowerCase() === "stylesheet" || u.removeChild(r), r = m;
          }
        } else
          u === "body" && fo(l.ownerDocument.body);
      u = s;
    } while (u);
    Xf(n);
  }
  function vl(l, n) {
    var u = l;
    l = 0;
    do {
      var c = u.nextSibling;
      if (u.nodeType === 1 ? n ? (u._stashedDisplay = u.style.display, u.style.display = "none") : (u.style.display = u._stashedDisplay || "", u.getAttribute("style") === "" && u.removeAttribute("style")) : u.nodeType === 3 && (n ? (u._stashedText = u.nodeValue, u.nodeValue = "") : u.nodeValue = u._stashedText || ""), c && c.nodeType === 8)
        if (u = c.data, u === "/$") {
          if (l === 0) break;
          l--;
        } else
          u !== "$" && u !== "$?" && u !== "$~" && u !== "$!" || l++;
      u = c;
    } while (u);
  }
  function Tr(l) {
    var n = l.firstChild;
    for (n && n.nodeType === 10 && (n = n.nextSibling); n; ) {
      var u = n;
      switch (n = n.nextSibling, u.nodeName) {
        case "HTML":
        case "HEAD":
        case "BODY":
          Tr(u), nd(u);
          continue;
        case "SCRIPT":
        case "STYLE":
          continue;
        case "LINK":
          if (u.rel.toLowerCase() === "stylesheet") continue;
      }
      l.removeChild(u);
    }
  }
  function u1(l, n, u, c) {
    for (; l.nodeType === 1; ) {
      var s = u;
      if (l.nodeName.toLowerCase() !== n.toLowerCase()) {
        if (!c && (l.nodeName !== "INPUT" || l.type !== "hidden"))
          break;
      } else if (c) {
        if (!l[su])
          switch (n) {
            case "meta":
              if (!l.hasAttribute("itemprop")) break;
              return l;
            case "link":
              if (r = l.getAttribute("rel"), r === "stylesheet" && l.hasAttribute("data-precedence"))
                break;
              if (r !== s.rel || l.getAttribute("href") !== (s.href == null || s.href === "" ? null : s.href) || l.getAttribute("crossorigin") !== (s.crossOrigin == null ? null : s.crossOrigin) || l.getAttribute("title") !== (s.title == null ? null : s.title))
                break;
              return l;
            case "style":
              if (l.hasAttribute("data-precedence")) break;
              return l;
            case "script":
              if (r = l.getAttribute("src"), (r !== (s.src == null ? null : s.src) || l.getAttribute("type") !== (s.type == null ? null : s.type) || l.getAttribute("crossorigin") !== (s.crossOrigin == null ? null : s.crossOrigin)) && r && l.hasAttribute("async") && !l.hasAttribute("itemprop"))
                break;
              return l;
            default:
              return l;
          }
      } else if (n === "input" && l.type === "hidden") {
        var r = s.name == null ? null : "" + s.name;
        if (s.type === "hidden" && l.getAttribute("name") === r)
          return l;
      } else return l;
      if (l = za(l.nextSibling), l === null) break;
    }
    return null;
  }
  function et(l, n, u) {
    if (n === "") return null;
    for (; l.nodeType !== 3; )
      if ((l.nodeType !== 1 || l.nodeName !== "INPUT" || l.type !== "hidden") && !u || (l = za(l.nextSibling), l === null)) return null;
    return l;
  }
  function wg(l, n) {
    for (; l.nodeType !== 8; )
      if ((l.nodeType !== 1 || l.nodeName !== "INPUT" || l.type !== "hidden") && !n || (l = za(l.nextSibling), l === null)) return null;
    return l;
  }
  function Dn(l) {
    return l.data === "$?" || l.data === "$~";
  }
  function sc(l) {
    return l.data === "$!" || l.data === "$?" && l.ownerDocument.readyState !== "loading";
  }
  function xf(l, n) {
    var u = l.ownerDocument;
    if (l.data === "$~") l._reactRetry = n;
    else if (l.data !== "$?" || u.readyState !== "loading")
      n();
    else {
      var c = function() {
        n(), u.removeEventListener("DOMContentLoaded", c);
      };
      u.addEventListener("DOMContentLoaded", c), l._reactRetry = c;
    }
  }
  function za(l) {
    for (; l != null; l = l.nextSibling) {
      var n = l.nodeType;
      if (n === 1 || n === 3) break;
      if (n === 8) {
        if (n = l.data, n === "$" || n === "$!" || n === "$?" || n === "$~" || n === "&" || n === "F!" || n === "F")
          break;
        if (n === "/$" || n === "/&") return null;
      }
    }
    return l;
  }
  var Ar = null;
  function xh(l) {
    l = l.nextSibling;
    for (var n = 0; l; ) {
      if (l.nodeType === 8) {
        var u = l.data;
        if (u === "/$" || u === "/&") {
          if (n === 0)
            return za(l.nextSibling);
          n--;
        } else
          u !== "$" && u !== "$!" && u !== "$?" && u !== "$~" && u !== "&" || n++;
      }
      l = l.nextSibling;
    }
    return null;
  }
  function Pn(l) {
    l = l.previousSibling;
    for (var n = 0; l; ) {
      if (l.nodeType === 8) {
        var u = l.data;
        if (u === "$" || u === "$!" || u === "$?" || u === "$~" || u === "&") {
          if (n === 0) return l;
          n--;
        } else u !== "/$" && u !== "/&" || n++;
      }
      l = l.previousSibling;
    }
    return null;
  }
  function Uf(l, n, u) {
    switch (n = fc(u), l) {
      case "html":
        if (l = n.documentElement, !l) throw Error(M(452));
        return l;
      case "head":
        if (l = n.head, !l) throw Error(M(453));
        return l;
      case "body":
        if (l = n.body, !l) throw Error(M(454));
        return l;
      default:
        throw Error(M(451));
    }
  }
  function fo(l) {
    for (var n = l.attributes; n.length; )
      l.removeAttributeNode(n[0]);
    nd(l);
  }
  var Ha = /* @__PURE__ */ new Map(), Or = /* @__PURE__ */ new Set();
  function ia(l) {
    return typeof l.getRootNode == "function" ? l.getRootNode() : l.nodeType === 9 ? l : l.ownerDocument;
  }
  var eu = Z.d;
  Z.d = {
    f: i1,
    r: Bg,
    D: L,
    C: At,
    L: c1,
    m: mp,
    X: Si,
    S: yp,
    M: rc
  };
  function i1() {
    var l = eu.f(), n = Af();
    return l || n;
  }
  function Bg(l) {
    var n = Ac(l);
    n !== null && n.tag === 5 && n.type === "form" ? Ut(n) : eu.r(l);
  }
  var Nf = typeof document > "u" ? null : document;
  function Al(l, n, u) {
    var c = Nf;
    if (c && typeof n == "string" && n) {
      var s = Va(n);
      s = 'link[rel="' + l + '"][href="' + s + '"]', typeof u == "string" && (s += '[crossorigin="' + u + '"]'), Or.has(s) || (Or.add(s), l = { rel: l, crossOrigin: u, href: n }, c.querySelector(s) === null && (n = c.createElement("link"), Wl(n, "link", l), Ot(n), c.head.appendChild(n)));
    }
  }
  function L(l) {
    eu.D(l), Al("dns-prefetch", l, null);
  }
  function At(l, n) {
    eu.C(l, n), Al("preconnect", l, n);
  }
  function c1(l, n, u) {
    eu.L(l, n, u);
    var c = Nf;
    if (c && l && n) {
      var s = 'link[rel="preload"][as="' + Va(n) + '"]';
      n === "image" && u && u.imageSrcSet ? (s += '[imagesrcset="' + Va(
        u.imageSrcSet
      ) + '"]', typeof u.imageSizes == "string" && (s += '[imagesizes="' + Va(
        u.imageSizes
      ) + '"]')) : s += '[href="' + Va(l) + '"]';
      var r = s;
      switch (n) {
        case "style":
          r = nn(l);
          break;
        case "script":
          r = so(l);
      }
      Ha.has(r) || (l = B(
        {
          rel: "preload",
          href: n === "image" && u && u.imageSrcSet ? void 0 : l,
          as: n
        },
        u
      ), Ha.set(r, l), c.querySelector(s) !== null || n === "style" && c.querySelector(dc(r)) || n === "script" && c.querySelector(wf(r)) || (n = c.createElement("link"), Wl(n, "link", l), Ot(n), c.head.appendChild(n)));
    }
  }
  function mp(l, n) {
    eu.m(l, n);
    var u = Nf;
    if (u && l) {
      var c = n && typeof n.as == "string" ? n.as : "script", s = 'link[rel="modulepreload"][as="' + Va(c) + '"][href="' + Va(l) + '"]', r = s;
      switch (c) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          r = so(l);
      }
      if (!Ha.has(r) && (l = B({ rel: "modulepreload", href: l }, n), Ha.set(r, l), u.querySelector(s) === null)) {
        switch (c) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (u.querySelector(wf(r)))
              return;
        }
        c = u.createElement("link"), Wl(c, "link", l), Ot(c), u.head.appendChild(c);
      }
    }
  }
  function yp(l, n, u) {
    eu.S(l, n, u);
    var c = Nf;
    if (c && l) {
      var s = Oc(c).hoistableStyles, r = nn(l);
      n = n || "default";
      var m = s.get(r);
      if (!m) {
        var v = { loading: 0, preload: null };
        if (m = c.querySelector(
          dc(r)
        ))
          v.loading = 5;
        else {
          l = B(
            { rel: "stylesheet", href: l, "data-precedence": n },
            u
          ), (u = Ha.get(r)) && Uh(l, u);
          var A = m = c.createElement("link");
          Ot(A), Wl(A, "link", l), A._p = new Promise(function(w, Q) {
            A.onload = w, A.onerror = Q;
          }), A.addEventListener("load", function() {
            v.loading |= 1;
          }), A.addEventListener("error", function() {
            v.loading |= 2;
          }), v.loading |= 4, zr(m, n, c);
        }
        m = {
          type: "stylesheet",
          instance: m,
          count: 1,
          state: v
        }, s.set(r, m);
      }
    }
  }
  function Si(l, n) {
    eu.X(l, n);
    var u = Nf;
    if (u && l) {
      var c = Oc(u).hoistableScripts, s = so(l), r = c.get(s);
      r || (r = u.querySelector(wf(s)), r || (l = B({ src: l, async: !0 }, n), (n = Ha.get(s)) && Nh(l, n), r = u.createElement("script"), Ot(r), Wl(r, "link", l), u.head.appendChild(r)), r = {
        type: "script",
        instance: r,
        count: 1,
        state: null
      }, c.set(s, r));
    }
  }
  function rc(l, n) {
    eu.M(l, n);
    var u = Nf;
    if (u && l) {
      var c = Oc(u).hoistableScripts, s = so(l), r = c.get(s);
      r || (r = u.querySelector(wf(s)), r || (l = B({ src: l, async: !0, type: "module" }, n), (n = Ha.get(s)) && Nh(l, n), r = u.createElement("script"), Ot(r), Wl(r, "link", l), u.head.appendChild(r)), r = {
        type: "script",
        instance: r,
        count: 1,
        state: null
      }, c.set(s, r));
    }
  }
  function Hf(l, n, u, c) {
    var s = (s = Ze.current) ? ia(s) : null;
    if (!s) throw Error(M(446));
    switch (l) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof u.precedence == "string" && typeof u.href == "string" ? (n = nn(u.href), u = Oc(
          s
        ).hoistableStyles, c = u.get(n), c || (c = {
          type: "style",
          instance: null,
          count: 0,
          state: null
        }, u.set(n, c)), c) : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if (u.rel === "stylesheet" && typeof u.href == "string" && typeof u.precedence == "string") {
          l = nn(u.href);
          var r = Oc(
            s
          ).hoistableStyles, m = r.get(l);
          if (m || (s = s.ownerDocument || s, m = {
            type: "stylesheet",
            instance: null,
            count: 0,
            state: { loading: 0, preload: null }
          }, r.set(l, m), (r = s.querySelector(
            dc(l)
          )) && !r._p && (m.instance = r, m.state.loading = 5), Ha.has(l) || (u = {
            rel: "preload",
            as: "style",
            href: u.href,
            crossOrigin: u.crossOrigin,
            integrity: u.integrity,
            media: u.media,
            hrefLang: u.hrefLang,
            referrerPolicy: u.referrerPolicy
          }, Ha.set(l, u), r || Yg(
            s,
            l,
            u,
            m.state
          ))), n && c === null)
            throw Error(M(528, ""));
          return m;
        }
        if (n && c !== null)
          throw Error(M(529, ""));
        return null;
      case "script":
        return n = u.async, u = u.src, typeof u == "string" && n && typeof n != "function" && typeof n != "symbol" ? (n = so(u), u = Oc(
          s
        ).hoistableScripts, c = u.get(n), c || (c = {
          type: "script",
          instance: null,
          count: 0,
          state: null
        }, u.set(n, c)), c) : { type: "void", instance: null, count: 0, state: null };
      default:
        throw Error(M(444, l));
    }
  }
  function nn(l) {
    return 'href="' + Va(l) + '"';
  }
  function dc(l) {
    return 'link[rel="stylesheet"][' + l + "]";
  }
  function jf(l) {
    return B({}, l, {
      "data-precedence": l.precedence,
      precedence: null
    });
  }
  function Yg(l, n, u, c) {
    l.querySelector('link[rel="preload"][as="style"][' + n + "]") ? c.loading = 1 : (n = l.createElement("link"), c.preload = n, n.addEventListener("load", function() {
      return c.loading |= 1;
    }), n.addEventListener("error", function() {
      return c.loading |= 2;
    }), Wl(n, "link", u), Ot(n), l.head.appendChild(n));
  }
  function so(l) {
    return '[src="' + Va(l) + '"]';
  }
  function wf(l) {
    return "script[async]" + l;
  }
  function pp(l, n, u) {
    if (n.count++, n.instance === null)
      switch (n.type) {
        case "style":
          var c = l.querySelector(
            'style[data-href~="' + Va(u.href) + '"]'
          );
          if (c)
            return n.instance = c, Ot(c), c;
          var s = B({}, u, {
            "data-href": u.href,
            "data-precedence": u.precedence,
            href: null,
            precedence: null
          });
          return c = (l.ownerDocument || l).createElement(
            "style"
          ), Ot(c), Wl(c, "style", s), zr(c, u.precedence, l), n.instance = c;
        case "stylesheet":
          s = nn(u.href);
          var r = l.querySelector(
            dc(s)
          );
          if (r)
            return n.state.loading |= 4, n.instance = r, Ot(r), r;
          c = jf(u), (s = Ha.get(s)) && Uh(c, s), r = (l.ownerDocument || l).createElement("link"), Ot(r);
          var m = r;
          return m._p = new Promise(function(v, A) {
            m.onload = v, m.onerror = A;
          }), Wl(r, "link", c), n.state.loading |= 4, zr(r, u.precedence, l), n.instance = r;
        case "script":
          return r = so(u.src), (s = l.querySelector(
            wf(r)
          )) ? (n.instance = s, Ot(s), s) : (c = u, (s = Ha.get(r)) && (c = B({}, u), Nh(c, s)), l = l.ownerDocument || l, s = l.createElement("script"), Ot(s), Wl(s, "link", c), l.head.appendChild(s), n.instance = s);
        case "void":
          return null;
        default:
          throw Error(M(443, n.type));
      }
    else
      n.type === "stylesheet" && (n.state.loading & 4) === 0 && (c = n.instance, n.state.loading |= 4, zr(c, u.precedence, l));
    return n.instance;
  }
  function zr(l, n, u) {
    for (var c = u.querySelectorAll(
      'link[rel="stylesheet"][data-precedence],style[data-precedence]'
    ), s = c.length ? c[c.length - 1] : null, r = s, m = 0; m < c.length; m++) {
      var v = c[m];
      if (v.dataset.precedence === n) r = v;
      else if (r !== s) break;
    }
    r ? r.parentNode.insertBefore(l, r.nextSibling) : (n = u.nodeType === 9 ? u.head : u, n.insertBefore(l, n.firstChild));
  }
  function Uh(l, n) {
    l.crossOrigin == null && (l.crossOrigin = n.crossOrigin), l.referrerPolicy == null && (l.referrerPolicy = n.referrerPolicy), l.title == null && (l.title = n.title);
  }
  function Nh(l, n) {
    l.crossOrigin == null && (l.crossOrigin = n.crossOrigin), l.referrerPolicy == null && (l.referrerPolicy = n.referrerPolicy), l.integrity == null && (l.integrity = n.integrity);
  }
  var Bf = null;
  function gp(l, n, u) {
    if (Bf === null) {
      var c = /* @__PURE__ */ new Map(), s = Bf = /* @__PURE__ */ new Map();
      s.set(u, c);
    } else
      s = Bf, c = s.get(u), c || (c = /* @__PURE__ */ new Map(), s.set(u, c));
    if (c.has(l)) return c;
    for (c.set(l, null), u = u.getElementsByTagName(l), s = 0; s < u.length; s++) {
      var r = u[s];
      if (!(r[su] || r[xt] || l === "link" && r.getAttribute("rel") === "stylesheet") && r.namespaceURI !== "http://www.w3.org/2000/svg") {
        var m = r.getAttribute(n) || "";
        m = l + m;
        var v = c.get(m);
        v ? v.push(r) : c.set(m, [r]);
      }
    }
    return c;
  }
  function Hh(l, n, u) {
    l = l.ownerDocument || l, l.head.insertBefore(
      u,
      n === "title" ? l.querySelector("head > title") : null
    );
  }
  function vp(l, n, u) {
    if (u === 1 || n.itemProp != null) return !1;
    switch (l) {
      case "meta":
      case "title":
        return !0;
      case "style":
        if (typeof n.precedence != "string" || typeof n.href != "string" || n.href === "")
          break;
        return !0;
      case "link":
        if (typeof n.rel != "string" || typeof n.href != "string" || n.href === "" || n.onLoad || n.onError)
          break;
        switch (n.rel) {
          case "stylesheet":
            return l = n.disabled, typeof n.precedence == "string" && l == null;
          default:
            return !0;
        }
      case "script":
        if (n.async && typeof n.async != "function" && typeof n.async != "symbol" && !n.onLoad && !n.onError && n.src && typeof n.src == "string")
          return !0;
    }
    return !1;
  }
  function ja(l) {
    return !(l.type === "stylesheet" && (l.state.loading & 3) === 0);
  }
  function Bu(l, n, u, c) {
    if (u.type === "stylesheet" && (typeof c.media != "string" || matchMedia(c.media).matches !== !1) && (u.state.loading & 4) === 0) {
      if (u.instance === null) {
        var s = nn(c.href), r = n.querySelector(
          dc(s)
        );
        if (r) {
          n = r._p, n !== null && typeof n == "object" && typeof n.then == "function" && (l.count++, l = jh.bind(l), n.then(l, l)), u.state.loading |= 4, u.instance = r, Ot(r);
          return;
        }
        r = n.ownerDocument || n, c = jf(c), (s = Ha.get(s)) && Uh(c, s), r = r.createElement("link"), Ot(r);
        var m = r;
        m._p = new Promise(function(v, A) {
          m.onload = v, m.onerror = A;
        }), Wl(r, "link", c), u.instance = r;
      }
      l.stylesheets === null && (l.stylesheets = /* @__PURE__ */ new Map()), l.stylesheets.set(u, n), (n = u.state.preload) && (u.state.loading & 3) === 0 && (l.count++, u = jh.bind(l), n.addEventListener("load", u), n.addEventListener("error", u));
    }
  }
  var un = 0;
  function bp(l, n) {
    return l.stylesheets && l.count === 0 && Bh(l, l.stylesheets), 0 < l.count || 0 < l.imgCount ? function(u) {
      var c = setTimeout(function() {
        if (l.stylesheets && Bh(l, l.stylesheets), l.unsuspend) {
          var r = l.unsuspend;
          l.unsuspend = null, r();
        }
      }, 6e4 + n);
      0 < l.imgBytes && un === 0 && (un = 62500 * sp());
      var s = setTimeout(
        function() {
          if (l.waitingForImages = !1, l.count === 0 && (l.stylesheets && Bh(l, l.stylesheets), l.unsuspend)) {
            var r = l.unsuspend;
            l.unsuspend = null, r();
          }
        },
        (l.imgBytes > un ? 50 : 800) + n
      );
      return l.unsuspend = u, function() {
        l.unsuspend = null, clearTimeout(c), clearTimeout(s);
      };
    } : null;
  }
  function jh() {
    if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
      if (this.stylesheets) Bh(this, this.stylesheets);
      else if (this.unsuspend) {
        var l = this.unsuspend;
        this.unsuspend = null, l();
      }
    }
  }
  var wh = null;
  function Bh(l, n) {
    l.stylesheets = null, l.unsuspend !== null && (l.count++, wh = /* @__PURE__ */ new Map(), n.forEach(Ll, l), wh = null, jh.call(l));
  }
  function Ll(l, n) {
    if (!(n.state.loading & 4)) {
      var u = wh.get(l);
      if (u) var c = u.get(null);
      else {
        u = /* @__PURE__ */ new Map(), wh.set(l, u);
        for (var s = l.querySelectorAll(
          "link[data-precedence],style[data-precedence]"
        ), r = 0; r < s.length; r++) {
          var m = s[r];
          (m.nodeName === "LINK" || m.getAttribute("media") !== "not all") && (u.set(m.dataset.precedence, m), c = m);
        }
        c && u.set(null, c);
      }
      s = n.instance, m = s.getAttribute("data-precedence"), r = u.get(m) || c, r === c && u.set(null, s), u.set(m, s), this.count++, c = jh.bind(this), s.addEventListener("load", c), s.addEventListener("error", c), r ? r.parentNode.insertBefore(s, r.nextSibling) : (l = l.nodeType === 9 ? l.head : l, l.insertBefore(s, l.firstChild)), n.state.loading |= 4;
    }
  }
  var Dr = {
    $$typeof: mt,
    Provider: null,
    Consumer: null,
    _currentValue: ne,
    _currentValue2: ne,
    _threadCount: 0
  };
  function Sp(l, n, u, c, s, r, m, v, A) {
    this.tag = 1, this.containerInfo = l, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = mn(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = mn(0), this.hiddenUpdates = mn(null), this.identifierPrefix = c, this.onUncaughtError = s, this.onCaughtError = r, this.onRecoverableError = m, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = A, this.incompleteTransitions = /* @__PURE__ */ new Map();
  }
  function Yh(l, n, u, c, s, r, m, v, A, w, Q, W) {
    return l = new Sp(
      l,
      n,
      u,
      m,
      A,
      w,
      Q,
      W,
      v
    ), n = 1, r === !0 && (n |= 24), r = fl(3, null, null, n), l.current = r, r.stateNode = l, n = Hs(), n.refCount++, l.pooledCache = n, n.refCount++, r.memoizedState = {
      element: c,
      isDehydrated: u,
      cache: n
    }, Ls(r), l;
  }
  function ro(l) {
    return l ? (l = ma, l) : ma;
  }
  function qg(l, n, u, c, s, r) {
    s = ro(s), c.context === null ? c.context = s : c.pendingContext = s, c = si(n), c.payload = { element: u }, r = r === void 0 ? null : r, r !== null && (c.callback = r), u = Fa(l, c, n), u !== null && (Oa(u, l, n), Wi(u, l, n));
  }
  function qh(l, n) {
    if (l = l.memoizedState, l !== null && l.dehydrated !== null) {
      var u = l.retryLane;
      l.retryLane = u !== 0 && u < n ? u : n;
    }
  }
  function Ep(l, n) {
    qh(l, n), (l = l.alternate) && qh(l, n);
  }
  function Gg(l) {
    if (l.tag === 13 || l.tag === 31) {
      var n = ai(l, 67108864);
      n !== null && Oa(n, l, 67108864), Ep(l, 67108864);
    }
  }
  function ho(l) {
    if (l.tag === 13 || l.tag === 31) {
      var n = Na();
      n = td(n);
      var u = ai(l, n);
      u !== null && Oa(u, l, n), Ep(l, n);
    }
  }
  var Ml = !0;
  function Yu(l, n, u, c) {
    var s = _.T;
    _.T = null;
    var r = Z.p;
    try {
      Z.p = 2, Fl(l, n, u, c);
    } finally {
      Z.p = r, _.T = s;
    }
  }
  function qu(l, n, u, c) {
    var s = _.T;
    _.T = null;
    var r = Z.p;
    try {
      Z.p = 8, Fl(l, n, u, c);
    } finally {
      Z.p = r, _.T = s;
    }
  }
  function Fl(l, n, u, c) {
    if (Ml) {
      var s = Tp(c);
      if (s === null)
        np(
          l,
          n,
          c,
          Gh,
          u
        ), Ei(l, c);
      else if (o1(
        s,
        l,
        n,
        u,
        c
      ))
        c.stopPropagation();
      else if (Ei(l, c), n & 4 && -1 < Da.indexOf(l)) {
        for (; s !== null; ) {
          var r = Ac(s);
          if (r !== null)
            switch (r.tag) {
              case 3:
                if (r = r.stateNode, r.current.memoizedState.isDehydrated) {
                  var m = we(r.pendingLanes);
                  if (m !== 0) {
                    var v = r;
                    for (v.pendingLanes |= 2, v.entangledLanes |= 2; m; ) {
                      var A = 1 << 31 - Nl(m);
                      v.entanglements[1] |= A, m &= ~A;
                    }
                    wu(r), (bt & 6) === 0 && (Tt = Sl() + 500, bi(0));
                  }
                }
                break;
              case 31:
              case 13:
                v = ai(r, 2), v !== null && Oa(v, r, 2), Af(), Ep(r, 2);
            }
          if (r = Tp(c), r === null && np(
            l,
            n,
            c,
            Gh,
            u
          ), r === s) break;
          s = r;
        }
        s !== null && c.stopPropagation();
      } else
        np(
          l,
          n,
          c,
          null,
          u
        );
    }
  }
  function Tp(l) {
    return l = rd(l), Yf(l);
  }
  var Gh = null;
  function Yf(l) {
    if (Gh = null, l = Tc(l), l !== null) {
      var n = oe(l);
      if (n === null) l = null;
      else {
        var u = n.tag;
        if (u === 13) {
          if (l = Te(n), l !== null) return l;
          l = null;
        } else if (u === 31) {
          if (l = F(n), l !== null) return l;
          l = null;
        } else if (u === 3) {
          if (n.stateNode.current.memoizedState.isDehydrated)
            return n.tag === 3 ? n.stateNode.containerInfo : null;
          l = null;
        } else n !== l && (l = null);
      }
    }
    return Gh = l, null;
  }
  function _r(l) {
    switch (l) {
      case "beforetoggle":
      case "cancel":
      case "click":
      case "close":
      case "contextmenu":
      case "copy":
      case "cut":
      case "auxclick":
      case "dblclick":
      case "dragend":
      case "dragstart":
      case "drop":
      case "focusin":
      case "focusout":
      case "input":
      case "invalid":
      case "keydown":
      case "keypress":
      case "keyup":
      case "mousedown":
      case "mouseup":
      case "paste":
      case "pause":
      case "play":
      case "pointercancel":
      case "pointerdown":
      case "pointerup":
      case "ratechange":
      case "reset":
      case "resize":
      case "seeked":
      case "submit":
      case "toggle":
      case "touchcancel":
      case "touchend":
      case "touchstart":
      case "volumechange":
      case "change":
      case "selectionchange":
      case "textInput":
      case "compositionstart":
      case "compositionend":
      case "compositionupdate":
      case "beforeblur":
      case "afterblur":
      case "beforeinput":
      case "blur":
      case "fullscreenchange":
      case "focus":
      case "hashchange":
      case "popstate":
      case "select":
      case "selectstart":
        return 2;
      case "drag":
      case "dragenter":
      case "dragexit":
      case "dragleave":
      case "dragover":
      case "mousemove":
      case "mouseout":
      case "mouseover":
      case "pointermove":
      case "pointerout":
      case "pointerover":
      case "scroll":
      case "touchmove":
      case "wheel":
      case "mouseenter":
      case "mouseleave":
      case "pointerenter":
      case "pointerleave":
        return 8;
      case "message":
        switch (Pr()) {
          case xo:
            return 2;
          case Uo:
            return 8;
          case xn:
          case ed:
            return 32;
          case No:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var qf = !1, Cl = null, Il = null, ca = null, hc = /* @__PURE__ */ new Map(), _n = /* @__PURE__ */ new Map(), el = [], Da = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
    " "
  );
  function Ei(l, n) {
    switch (l) {
      case "focusin":
      case "focusout":
        Cl = null;
        break;
      case "dragenter":
      case "dragleave":
        Il = null;
        break;
      case "mouseover":
      case "mouseout":
        ca = null;
        break;
      case "pointerover":
      case "pointerout":
        hc.delete(n.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        _n.delete(n.pointerId);
    }
  }
  function mo(l, n, u, c, s, r) {
    return l === null || l.nativeEvent !== r ? (l = {
      blockedOn: n,
      domEventName: u,
      eventSystemFlags: c,
      nativeEvent: r,
      targetContainers: [s]
    }, n !== null && (n = Ac(n), n !== null && Gg(n)), l) : (l.eventSystemFlags |= c, n = l.targetContainers, s !== null && n.indexOf(s) === -1 && n.push(s), l);
  }
  function o1(l, n, u, c, s) {
    switch (n) {
      case "focusin":
        return Cl = mo(
          Cl,
          l,
          n,
          u,
          c,
          s
        ), !0;
      case "dragenter":
        return Il = mo(
          Il,
          l,
          n,
          u,
          c,
          s
        ), !0;
      case "mouseover":
        return ca = mo(
          ca,
          l,
          n,
          u,
          c,
          s
        ), !0;
      case "pointerover":
        var r = s.pointerId;
        return hc.set(
          r,
          mo(
            hc.get(r) || null,
            l,
            n,
            u,
            c,
            s
          )
        ), !0;
      case "gotpointercapture":
        return r = s.pointerId, _n.set(
          r,
          mo(
            _n.get(r) || null,
            l,
            n,
            u,
            c,
            s
          )
        ), !0;
    }
    return !1;
  }
  function Lg(l) {
    var n = Tc(l.target);
    if (n !== null) {
      var u = oe(n);
      if (u !== null) {
        if (n = u.tag, n === 13) {
          if (n = Te(u), n !== null) {
            l.blockedOn = n, Tm(l.priority, function() {
              ho(u);
            });
            return;
          }
        } else if (n === 31) {
          if (n = F(u), n !== null) {
            l.blockedOn = n, Tm(l.priority, function() {
              ho(u);
            });
            return;
          }
        } else if (n === 3 && u.stateNode.current.memoizedState.isDehydrated) {
          l.blockedOn = u.tag === 3 ? u.stateNode.containerInfo : null;
          return;
        }
      }
    }
    l.blockedOn = null;
  }
  function Rr(l) {
    if (l.blockedOn !== null) return !1;
    for (var n = l.targetContainers; 0 < n.length; ) {
      var u = Tp(l.nativeEvent);
      if (u === null) {
        u = l.nativeEvent;
        var c = new u.constructor(
          u.type,
          u
        );
        sd = c, u.target.dispatchEvent(c), sd = null;
      } else
        return n = Ac(u), n !== null && Gg(n), l.blockedOn = u, !1;
      n.shift();
    }
    return !0;
  }
  function Gf(l, n, u) {
    Rr(l) && u.delete(n);
  }
  function Xg() {
    qf = !1, Cl !== null && Rr(Cl) && (Cl = null), Il !== null && Rr(Il) && (Il = null), ca !== null && Rr(ca) && (ca = null), hc.forEach(Gf), _n.forEach(Gf);
  }
  function Gu(l, n) {
    l.blockedOn === n && (l.blockedOn = null, qf || (qf = !0, x.unstable_scheduleCallback(
      x.unstable_NormalPriority,
      Xg
    )));
  }
  var Lf = null;
  function Qg(l) {
    Lf !== l && (Lf = l, x.unstable_scheduleCallback(
      x.unstable_NormalPriority,
      function() {
        Lf === l && (Lf = null);
        for (var n = 0; n < l.length; n += 3) {
          var u = l[n], c = l[n + 1], s = l[n + 2];
          if (typeof c != "function") {
            if (Yf(c || u) === null)
              continue;
            break;
          }
          var r = Ac(u);
          r !== null && (l.splice(n, 3), n -= 3, sf(
            r,
            {
              pending: !0,
              data: s,
              method: u.method,
              action: c
            },
            c,
            s
          ));
        }
      }
    ));
  }
  function Xf(l) {
    function n(A) {
      return Gu(A, l);
    }
    Cl !== null && Gu(Cl, l), Il !== null && Gu(Il, l), ca !== null && Gu(ca, l), hc.forEach(n), _n.forEach(n);
    for (var u = 0; u < el.length; u++) {
      var c = el[u];
      c.blockedOn === l && (c.blockedOn = null);
    }
    for (; 0 < el.length && (u = el[0], u.blockedOn === null); )
      Lg(u), u.blockedOn === null && el.shift();
    if (u = (l.ownerDocument || l).$$reactFormReplay, u != null)
      for (c = 0; c < u.length; c += 3) {
        var s = u[c], r = u[c + 1], m = s[ra] || null;
        if (typeof r == "function")
          m || Qg(u);
        else if (m) {
          var v = null;
          if (r && r.hasAttribute("formAction")) {
            if (s = r, m = r[ra] || null)
              v = m.formAction;
            else if (Yf(s) !== null) continue;
          } else v = m.action;
          typeof v == "function" ? u[c + 1] = v : (u.splice(c, 3), c -= 3), Qg(u);
        }
      }
  }
  function Ap() {
    function l(r) {
      r.canIntercept && r.info === "react-transition" && r.intercept({
        handler: function() {
          return new Promise(function(m) {
            return s = m;
          });
        },
        focusReset: "manual",
        scroll: "manual"
      });
    }
    function n() {
      s !== null && (s(), s = null), c || setTimeout(u, 20);
    }
    function u() {
      if (!c && !navigation.transition) {
        var r = navigation.currentEntry;
        r && r.url != null && navigation.navigate(r.url, {
          state: r.getState(),
          info: "react-transition",
          history: "replace"
        });
      }
    }
    if (typeof navigation == "object") {
      var c = !1, s = null;
      return navigation.addEventListener("navigate", l), navigation.addEventListener("navigatesuccess", n), navigation.addEventListener("navigateerror", n), setTimeout(u, 100), function() {
        c = !0, navigation.removeEventListener("navigate", l), navigation.removeEventListener("navigatesuccess", n), navigation.removeEventListener("navigateerror", n), s !== null && (s(), s = null);
      };
    }
  }
  function Lh(l) {
    this._internalRoot = l;
  }
  Xh.prototype.render = Lh.prototype.render = function(l) {
    var n = this._internalRoot;
    if (n === null) throw Error(M(409));
    var u = n.current, c = Na();
    qg(u, c, l, n, null, null);
  }, Xh.prototype.unmount = Lh.prototype.unmount = function() {
    var l = this._internalRoot;
    if (l !== null) {
      this._internalRoot = null;
      var n = l.containerInfo;
      qg(l.current, 2, null, l, null, null), Af(), n[Ni] = null;
    }
  };
  function Xh(l) {
    this._internalRoot = l;
  }
  Xh.prototype.unstable_scheduleHydration = function(l) {
    if (l) {
      var n = ld();
      l = { blockedOn: null, target: l, priority: n };
      for (var u = 0; u < el.length && n !== 0 && n < el[u].priority; u++) ;
      el.splice(u, 0, l), u === 0 && Lg(l);
    }
  };
  var Op = k.version;
  if (Op !== "19.2.7")
    throw Error(
      M(
        527,
        Op,
        "19.2.7"
      )
    );
  Z.findDOMNode = function(l) {
    var n = l._reactInternals;
    if (n === void 0)
      throw typeof l.render == "function" ? Error(M(188)) : (l = Object.keys(l).join(","), Error(M(268, l)));
    return l = V(n), l = l !== null ? me(l) : null, l = l === null ? null : l.stateNode, l;
  };
  var Vg = {
    bundleType: 0,
    version: "19.2.7",
    rendererPackageName: "react-dom",
    currentDispatcherRef: _,
    reconcilerVersion: "19.2.7"
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var Mr = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!Mr.isDisabled && Mr.supportsFiber)
      try {
        hn = Mr.inject(
          Vg
        ), zl = Mr;
      } catch {
      }
  }
  return v0.createRoot = function(l, n) {
    if (!P(l)) throw Error(M(299));
    var u = !1, c = "", s = Pd, r = zy, m = eh;
    return n != null && (n.unstable_strictMode === !0 && (u = !0), n.identifierPrefix !== void 0 && (c = n.identifierPrefix), n.onUncaughtError !== void 0 && (s = n.onUncaughtError), n.onCaughtError !== void 0 && (r = n.onCaughtError), n.onRecoverableError !== void 0 && (m = n.onRecoverableError)), n = Yh(
      l,
      1,
      !1,
      null,
      null,
      u,
      c,
      null,
      s,
      r,
      m,
      Ap
    ), l[Ni] = n.current, Mf(l), new Lh(n);
  }, v0.hydrateRoot = function(l, n, u) {
    if (!P(l)) throw Error(M(299));
    var c = !1, s = "", r = Pd, m = zy, v = eh, A = null;
    return u != null && (u.unstable_strictMode === !0 && (c = !0), u.identifierPrefix !== void 0 && (s = u.identifierPrefix), u.onUncaughtError !== void 0 && (r = u.onUncaughtError), u.onCaughtError !== void 0 && (m = u.onCaughtError), u.onRecoverableError !== void 0 && (v = u.onRecoverableError), u.formState !== void 0 && (A = u.formState)), n = Yh(
      l,
      1,
      !0,
      n,
      u ?? null,
      c,
      s,
      A,
      r,
      m,
      v,
      Ap
    ), n.context = ro(null), u = n.current, c = Na(), c = td(c), s = si(c), s.callback = null, Fa(u, s, c), u = c, n.current.lanes = u, Ui(n, u), wu(n), l[Ni] = n.current, Mf(l), new Xh(n);
  }, v0.version = "19.2.7", v0;
}
var b0 = {};
/**
 * @license React
 * react-dom-client.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var V2;
function HT() {
  return V2 || (V2 = 1, process.env.NODE_ENV !== "production" && (function() {
    function x(e, t) {
      for (e = e.memoizedState; e !== null && 0 < t; )
        e = e.next, t--;
      return e;
    }
    function k(e, t, a, i) {
      if (a >= t.length) return i;
      var o = t[a], f = Al(e) ? e.slice() : et({}, e);
      return f[o] = k(e[o], t, a + 1, i), f;
    }
    function fe(e, t, a) {
      if (t.length !== a.length)
        console.warn("copyWithRename() expects paths of the same length");
      else {
        for (var i = 0; i < a.length - 1; i++)
          if (t[i] !== a[i]) {
            console.warn(
              "copyWithRename() expects paths to be the same except for the deepest key"
            );
            return;
          }
        return M(e, t, a, 0);
      }
    }
    function M(e, t, a, i) {
      var o = t[i], f = Al(e) ? e.slice() : et({}, e);
      return i + 1 === t.length ? (f[a[i]] = f[o], Al(f) ? f.splice(o, 1) : delete f[o]) : f[o] = M(
        e[o],
        t,
        a,
        i + 1
      ), f;
    }
    function P(e, t, a) {
      var i = t[a], o = Al(e) ? e.slice() : et({}, e);
      return a + 1 === t.length ? (Al(o) ? o.splice(i, 1) : delete o[i], o) : (o[i] = P(e[i], t, a + 1), o);
    }
    function oe() {
      return !1;
    }
    function Te() {
      return null;
    }
    function F() {
      console.error(
        "Do not call Hooks inside useEffect(...), useMemo(...), or other built-in Hooks. You can only call Hooks at the top level of your React function. For more information, see https://react.dev/link/rules-of-hooks"
      );
    }
    function le() {
      console.error(
        "Context can only be read while React is rendering. In classes, you can read it in the render method or getDerivedStateFromProps. In function components, you can read it directly in the function body, but not inside Hooks like useReducer() or useMemo()."
      );
    }
    function V() {
    }
    function me() {
    }
    function B(e) {
      var t = [];
      return e.forEach(function(a) {
        t.push(a);
      }), t.sort().join(", ");
    }
    function C(e, t, a, i) {
      return new e1(e, t, a, i);
    }
    function ue(e, t) {
      e.context === Jf && (Dh(e.current, 2, t, e, null, null), ln());
    }
    function xe(e, t) {
      if (Qu !== null) {
        var a = t.staleFamilies;
        t = t.updatedFamilies, ir(), j0(
          e.current,
          t,
          a
        ), ln();
      }
    }
    function ie(e) {
      Qu = e;
    }
    function be(e) {
      return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
    }
    function Ue(e) {
      var t = e, a = e;
      if (e.alternate) for (; t.return; ) t = t.return;
      else {
        e = t;
        do
          t = e, (t.flags & 4098) !== 0 && (a = t.return), e = t.return;
        while (e);
      }
      return t.tag === 3 ? a : null;
    }
    function Jt(e) {
      if (e.tag === 13) {
        var t = e.memoizedState;
        if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
      }
      return null;
    }
    function mt(e) {
      if (e.tag === 31) {
        var t = e.memoizedState;
        if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
      }
      return null;
    }
    function Mt(e) {
      if (Ue(e) !== e)
        throw Error("Unable to find node on an unmounted component.");
    }
    function Bt(e) {
      var t = e.alternate;
      if (!t) {
        if (t = Ue(e), t === null)
          throw Error("Unable to find node on an unmounted component.");
        return t !== e ? null : e;
      }
      for (var a = e, i = t; ; ) {
        var o = a.return;
        if (o === null) break;
        var f = o.alternate;
        if (f === null) {
          if (i = o.return, i !== null) {
            a = i;
            continue;
          }
          break;
        }
        if (o.child === f.child) {
          for (f = o.child; f; ) {
            if (f === a) return Mt(o), e;
            if (f === i) return Mt(o), t;
            f = f.sibling;
          }
          throw Error("Unable to find node on an unmounted component.");
        }
        if (a.return !== i.return) a = o, i = f;
        else {
          for (var d = !1, h = o.child; h; ) {
            if (h === a) {
              d = !0, a = o, i = f;
              break;
            }
            if (h === i) {
              d = !0, i = o, a = f;
              break;
            }
            h = h.sibling;
          }
          if (!d) {
            for (h = f.child; h; ) {
              if (h === a) {
                d = !0, a = f, i = o;
                break;
              }
              if (h === i) {
                d = !0, i = f, a = o;
                break;
              }
              h = h.sibling;
            }
            if (!d)
              throw Error(
                "Child was not found in either parent set. This indicates a bug in React related to the return pointer. Please file an issue."
              );
          }
        }
        if (a.alternate !== i)
          throw Error(
            "Return fibers should always be each others' alternates. This error is likely caused by a bug in React. Please file an issue."
          );
      }
      if (a.tag !== 3)
        throw Error("Unable to find node on an unmounted component.");
      return a.stateNode.current === a ? e : t;
    }
    function qt(e) {
      var t = e.tag;
      if (t === 5 || t === 26 || t === 27 || t === 6) return e;
      for (e = e.child; e !== null; ) {
        if (t = qt(e), t !== null) return t;
        e = e.sibling;
      }
      return null;
    }
    function je(e) {
      return e === null || typeof e != "object" ? null : (e = Bg && e[Bg] || e["@@iterator"], typeof e == "function" ? e : null);
    }
    function We(e) {
      if (e == null) return null;
      if (typeof e == "function")
        return e.$$typeof === Nf ? null : e.displayName || e.name || null;
      if (typeof e == "string") return e;
      switch (e) {
        case xf:
          return "Fragment";
        case Ar:
          return "Profiler";
        case za:
          return "StrictMode";
        case fo:
          return "Suspense";
        case Ha:
          return "SuspenseList";
        case eu:
          return "Activity";
      }
      if (typeof e == "object")
        switch (typeof e.tag == "number" && console.error(
          "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
        ), e.$$typeof) {
          case sc:
            return "Portal";
          case Pn:
            return e.displayName || "Context";
          case xh:
            return (e._context.displayName || "Context") + ".Consumer";
          case Uf:
            var t = e.render;
            return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
          case Or:
            return t = e.displayName || null, t !== null ? t : We(e.type) || "Memo";
          case ia:
            t = e._payload, e = e._init;
            try {
              return We(e(t));
            } catch {
            }
        }
      return null;
    }
    function Ct(e) {
      return typeof e.tag == "number" ? pe(e) : typeof e.name == "string" ? e.name : null;
    }
    function pe(e) {
      var t = e.type;
      switch (e.tag) {
        case 31:
          return "Activity";
        case 24:
          return "Cache";
        case 9:
          return (t._context.displayName || "Context") + ".Consumer";
        case 10:
          return t.displayName || "Context";
        case 18:
          return "DehydratedFragment";
        case 11:
          return e = t.render, e = e.displayName || e.name || "", t.displayName || (e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef");
        case 7:
          return "Fragment";
        case 26:
        case 27:
        case 5:
          return t;
        case 4:
          return "Portal";
        case 3:
          return "Root";
        case 6:
          return "Text";
        case 16:
          return We(t);
        case 8:
          return t === za ? "StrictMode" : "Mode";
        case 22:
          return "Offscreen";
        case 12:
          return "Profiler";
        case 21:
          return "Scope";
        case 13:
          return "Suspense";
        case 19:
          return "SuspenseList";
        case 25:
          return "TracingMarker";
        case 1:
        case 0:
        case 14:
        case 15:
          if (typeof t == "function")
            return t.displayName || t.name || null;
          if (typeof t == "string") return t;
          break;
        case 29:
          if (t = e._debugInfo, t != null) {
            for (var a = t.length - 1; 0 <= a; a--)
              if (typeof t[a].name == "string") return t[a].name;
          }
          if (e.return !== null)
            return pe(e.return);
      }
      return null;
    }
    function Yt(e) {
      return { current: e };
    }
    function Ae(e, t) {
      0 > Si ? console.error("Unexpected pop.") : (t !== yp[Si] && console.error("Unexpected Fiber popped."), e.current = mp[Si], mp[Si] = null, yp[Si] = null, Si--);
    }
    function Ve(e, t, a) {
      Si++, mp[Si] = e.current, yp[Si] = a, e.current = t;
    }
    function Kt(e) {
      return e === null && console.error(
        "Expected host context to exist. This error is likely caused by a bug in React. Please file an issue."
      ), e;
    }
    function Gt(e, t) {
      Ve(nn, t, e), Ve(Hf, e, e), Ve(rc, null, e);
      var a = t.nodeType;
      switch (a) {
        case 9:
        case 11:
          a = a === 9 ? "#document" : "#fragment", t = (t = t.documentElement) && (t = t.namespaceURI) ? sg(t) : Ro;
          break;
        default:
          if (a = t.tagName, t = t.namespaceURI)
            t = sg(t), t = gi(
              t,
              a
            );
          else
            switch (a) {
              case "svg":
                t = vm;
                break;
              case "math":
                t = jv;
                break;
              default:
                t = Ro;
            }
      }
      a = a.toLowerCase(), a = Dm(null, a), a = {
        context: t,
        ancestorInfo: a
      }, Ae(rc, e), Ve(rc, a, e);
    }
    function _(e) {
      Ae(rc, e), Ae(Hf, e), Ae(nn, e);
    }
    function Z() {
      return Kt(rc.current);
    }
    function ne(e) {
      e.memoizedState !== null && Ve(dc, e, e);
      var t = Kt(rc.current), a = e.type, i = gi(t.context, a);
      a = Dm(t.ancestorInfo, a), i = { context: i, ancestorInfo: a }, t !== i && (Ve(Hf, e, e), Ve(rc, i, e));
    }
    function Oe(e) {
      Hf.current === e && (Ae(rc, e), Ae(Hf, e)), dc.current === e && (Ae(dc, e), h0._currentValue = Ir);
    }
    function Ne() {
    }
    function b() {
      if (jf === 0) {
        Yg = console.log, so = console.info, wf = console.warn, pp = console.error, zr = console.group, Uh = console.groupCollapsed, Nh = console.groupEnd;
        var e = {
          configurable: !0,
          enumerable: !0,
          value: Ne,
          writable: !0
        };
        Object.defineProperties(console, {
          info: e,
          log: e,
          warn: e,
          error: e,
          group: e,
          groupCollapsed: e,
          groupEnd: e
        });
      }
      jf++;
    }
    function j() {
      if (jf--, jf === 0) {
        var e = { configurable: !0, enumerable: !0, writable: !0 };
        Object.defineProperties(console, {
          log: et({}, e, { value: Yg }),
          info: et({}, e, { value: so }),
          warn: et({}, e, { value: wf }),
          error: et({}, e, { value: pp }),
          group: et({}, e, { value: zr }),
          groupCollapsed: et({}, e, { value: Uh }),
          groupEnd: et({}, e, { value: Nh })
        });
      }
      0 > jf && console.error(
        "disabledDepth fell below zero. This is a bug in React. Please file an issue."
      );
    }
    function te(e) {
      var t = Error.prepareStackTrace;
      if (Error.prepareStackTrace = void 0, e = e.stack, Error.prepareStackTrace = t, e.startsWith(`Error: react-stack-top-frame
`) && (e = e.slice(29)), t = e.indexOf(`
`), t !== -1 && (e = e.slice(t + 1)), t = e.indexOf("react_stack_bottom_frame"), t !== -1 && (t = e.lastIndexOf(
        `
`,
        t
      )), t !== -1)
        e = e.slice(0, t);
      else return "";
      return e;
    }
    function ee(e) {
      if (Bf === void 0)
        try {
          throw Error();
        } catch (a) {
          var t = a.stack.trim().match(/\n( *(at )?)/);
          Bf = t && t[1] || "", gp = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
        }
      return `
` + Bf + e + gp;
    }
    function De(e, t) {
      if (!e || Hh) return "";
      var a = vp.get(e);
      if (a !== void 0) return a;
      Hh = !0, a = Error.prepareStackTrace, Error.prepareStackTrace = void 0;
      var i = null;
      i = L.H, L.H = null, b();
      try {
        var o = {
          DetermineComponentFrameRoot: function() {
            try {
              if (t) {
                var E = function() {
                  throw Error();
                };
                if (Object.defineProperty(E.prototype, "props", {
                  set: function() {
                    throw Error();
                  }
                }), typeof Reflect == "object" && Reflect.construct) {
                  try {
                    Reflect.construct(E, []);
                  } catch (se) {
                    var q = se;
                  }
                  Reflect.construct(e, [], E);
                } else {
                  try {
                    E.call();
                  } catch (se) {
                    q = se;
                  }
                  e.call(E.prototype);
                }
              } else {
                try {
                  throw Error();
                } catch (se) {
                  q = se;
                }
                (E = e()) && typeof E.catch == "function" && E.catch(function() {
                });
              }
            } catch (se) {
              if (se && q && typeof se.stack == "string")
                return [se.stack, q.stack];
            }
            return [null, null];
          }
        };
        o.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
        var f = Object.getOwnPropertyDescriptor(
          o.DetermineComponentFrameRoot,
          "name"
        );
        f && f.configurable && Object.defineProperty(
          o.DetermineComponentFrameRoot,
          "name",
          { value: "DetermineComponentFrameRoot" }
        );
        var d = o.DetermineComponentFrameRoot(), h = d[0], y = d[1];
        if (h && y) {
          var p = h.split(`
`), z = y.split(`
`);
          for (d = f = 0; f < p.length && !p[f].includes(
            "DetermineComponentFrameRoot"
          ); )
            f++;
          for (; d < z.length && !z[d].includes(
            "DetermineComponentFrameRoot"
          ); )
            d++;
          if (f === p.length || d === z.length)
            for (f = p.length - 1, d = z.length - 1; 1 <= f && 0 <= d && p[f] !== z[d]; )
              d--;
          for (; 1 <= f && 0 <= d; f--, d--)
            if (p[f] !== z[d]) {
              if (f !== 1 || d !== 1)
                do
                  if (f--, d--, 0 > d || p[f] !== z[d]) {
                    var R = `
` + p[f].replace(
                      " at new ",
                      " at "
                    );
                    return e.displayName && R.includes("<anonymous>") && (R = R.replace("<anonymous>", e.displayName)), typeof e == "function" && vp.set(e, R), R;
                  }
                while (1 <= f && 0 <= d);
              break;
            }
        }
      } finally {
        Hh = !1, L.H = i, j(), Error.prepareStackTrace = a;
      }
      return p = (p = e ? e.displayName || e.name : "") ? ee(p) : "", typeof e == "function" && vp.set(e, p), p;
    }
    function Ze(e, t) {
      switch (e.tag) {
        case 26:
        case 27:
        case 5:
          return ee(e.type);
        case 16:
          return ee("Lazy");
        case 13:
          return e.child !== t && t !== null ? ee("Suspense Fallback") : ee("Suspense");
        case 19:
          return ee("SuspenseList");
        case 0:
        case 15:
          return De(e.type, !1);
        case 11:
          return De(e.type.render, !1);
        case 1:
          return De(e.type, !0);
        case 31:
          return ee("Activity");
        default:
          return "";
      }
    }
    function Me(e) {
      try {
        var t = "", a = null;
        do {
          t += Ze(e, a);
          var i = e._debugInfo;
          if (i)
            for (var o = i.length - 1; 0 <= o; o--) {
              var f = i[o];
              if (typeof f.name == "string") {
                var d = t;
                e: {
                  var h = f.name, y = f.env, p = f.debugLocation;
                  if (p != null) {
                    var z = te(p), R = z.lastIndexOf(`
`), E = R === -1 ? z : z.slice(R + 1);
                    if (E.indexOf(h) !== -1) {
                      var q = `
` + E;
                      break e;
                    }
                  }
                  q = ee(
                    h + (y ? " [" + y + "]" : "")
                  );
                }
                t = d + q;
              }
            }
          a = e, e = e.return;
        } while (e);
        return t;
      } catch (se) {
        return `
Error generating stack: ` + se.message + `
` + se.stack;
      }
    }
    function $t(e) {
      return (e = e ? e.displayName || e.name : "") ? ee(e) : "";
    }
    function gt() {
      if (ja === null) return null;
      var e = ja._debugOwner;
      return e != null ? Ct(e) : null;
    }
    function qa() {
      if (ja === null) return "";
      var e = ja;
      try {
        var t = "";
        switch (e.tag === 6 && (e = e.return), e.tag) {
          case 26:
          case 27:
          case 5:
            t += ee(e.type);
            break;
          case 13:
            t += ee("Suspense");
            break;
          case 19:
            t += ee("SuspenseList");
            break;
          case 31:
            t += ee("Activity");
            break;
          case 30:
          case 0:
          case 15:
          case 1:
            e._debugOwner || t !== "" || (t += $t(
              e.type
            ));
            break;
          case 11:
            e._debugOwner || t !== "" || (t += $t(
              e.type.render
            ));
        }
        for (; e; )
          if (typeof e.tag == "number") {
            var a = e;
            e = a._debugOwner;
            var i = a._debugStack;
            if (e && i) {
              var o = te(i);
              o !== "" && (t += `
` + o);
            }
          } else if (e.debugStack != null) {
            var f = e.debugStack;
            (e = e.owner) && f && (t += `
` + te(f));
          } else break;
        var d = t;
      } catch (h) {
        d = `
Error generating stack: ` + h.message + `
` + h.stack;
      }
      return d;
    }
    function de(e, t, a, i, o, f, d) {
      var h = ja;
      Ri(e);
      try {
        return e !== null && e._debugTask ? e._debugTask.run(
          t.bind(null, a, i, o, f, d)
        ) : t(a, i, o, f, d);
      } finally {
        Ri(h);
      }
      throw Error(
        "runWithFiberInDEV should never be called in production. This is a bug in React."
      );
    }
    function Ri(e) {
      L.getCurrentStack = e === null ? null : qa, Bu = !1, ja = e;
    }
    function Mi(e) {
      return typeof Symbol == "function" && Symbol.toStringTag && e[Symbol.toStringTag] || e.constructor.name || "Object";
    }
    function Ga(e) {
      try {
        return cu(e), !1;
      } catch {
        return !0;
      }
    }
    function cu(e) {
      return "" + e;
    }
    function vt(e, t) {
      if (Ga(e))
        return console.error(
          "The provided `%s` attribute is an unsupported type %s. This value must be coerced to a string before using it here.",
          t,
          Mi(e)
        ), cu(e);
    }
    function ta(e, t) {
      if (Ga(e))
        return console.error(
          "The provided `%s` CSS property is an unsupported type %s. This value must be coerced to a string before using it here.",
          t,
          Mi(e)
        ), cu(e);
    }
    function bc(e) {
      if (Ga(e))
        return console.error(
          "Form field values (value, checked, defaultValue, or defaultChecked props) must be strings, not %s. This value must be coerced to a string before using it here.",
          Mi(e)
        ), cu(e);
    }
    function ds(e) {
      if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") return !1;
      var t = __REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (t.isDisabled) return !0;
      if (!t.supportsFiber)
        return console.error(
          "The installed version of React DevTools is too old and will not work with the current version of React. Please update React DevTools. https://react.dev/link/react-devtools"
        ), !0;
      try {
        ho = t.inject(e), Ml = t;
      } catch (a) {
        console.error("React instrumentation encountered an error: %o.", a);
      }
      return !!t.checkDCE;
    }
    function ge(e) {
      if (typeof Ep == "function" && Gg(e), Ml && typeof Ml.setStrictMode == "function")
        try {
          Ml.setStrictMode(ho, e);
        } catch (t) {
          Yu || (Yu = !0, console.error(
            "React instrumentation encountered an error: %o",
            t
          ));
        }
    }
    function Ci(e) {
      return e >>>= 0, e === 0 ? 32 : 31 - (Tp(e) / Gh | 0) | 0;
    }
    function ou(e) {
      var t = e & 42;
      if (t !== 0) return t;
      switch (e & -e) {
        case 1:
          return 1;
        case 2:
          return 2;
        case 4:
          return 4;
        case 8:
          return 8;
        case 16:
          return 16;
        case 32:
          return 32;
        case 64:
          return 64;
        case 128:
          return 128;
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
          return e & 261888;
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
          return e & 3932160;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          return e & 62914560;
        case 67108864:
          return 67108864;
        case 134217728:
          return 134217728;
        case 268435456:
          return 268435456;
        case 536870912:
          return 536870912;
        case 1073741824:
          return 0;
        default:
          return console.error(
            "Should have found matching lanes. This is a bug in React."
          ), e;
      }
    }
    function Sc(e, t, a) {
      var i = e.pendingLanes;
      if (i === 0) return 0;
      var o = 0, f = e.suspendedLanes, d = e.pingedLanes;
      e = e.warmLanes;
      var h = i & 134217727;
      return h !== 0 ? (i = h & ~f, i !== 0 ? o = ou(i) : (d &= h, d !== 0 ? o = ou(d) : a || (a = h & ~e, a !== 0 && (o = ou(a))))) : (h = i & ~f, h !== 0 ? o = ou(h) : d !== 0 ? o = ou(d) : a || (a = i & ~e, a !== 0 && (o = ou(a)))), o === 0 ? 0 : t !== 0 && t !== o && (t & f) === 0 && (f = o & -o, a = t & -t, f >= a || f === 32 && (a & 4194048) !== 0) ? t : o;
    }
    function Sl(e, t) {
      return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
    }
    function Pr(e, t) {
      switch (e) {
        case 1:
        case 2:
        case 4:
        case 8:
        case 64:
          return t + 250;
        case 16:
        case 32:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
          return t + 5e3;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          return -1;
        case 67108864:
        case 134217728:
        case 268435456:
        case 536870912:
        case 1073741824:
          return -1;
        default:
          return console.error(
            "Should have found matching lanes. This is a bug in React."
          ), -1;
      }
    }
    function xo() {
      var e = qf;
      return qf <<= 1, (qf & 62914560) === 0 && (qf = 4194304), e;
    }
    function Uo(e) {
      for (var t = [], a = 0; 31 > a; a++) t.push(e);
      return t;
    }
    function xn(e, t) {
      e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
    }
    function ed(e, t, a, i, o, f) {
      var d = e.pendingLanes;
      e.pendingLanes = a, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= a, e.entangledLanes &= a, e.errorRecoveryDisabledLanes &= a, e.shellSuspendCounter = 0;
      var h = e.entanglements, y = e.expirationTimes, p = e.hiddenUpdates;
      for (a = d & ~a; 0 < a; ) {
        var z = 31 - Fl(a), R = 1 << z;
        h[z] = 0, y[z] = -1;
        var E = p[z];
        if (E !== null)
          for (p[z] = null, z = 0; z < E.length; z++) {
            var q = E[z];
            q !== null && (q.lane &= -536870913);
          }
        a &= ~R;
      }
      i !== 0 && No(e, i, 0), f !== 0 && o === 0 && e.tag !== 0 && (e.suspendedLanes |= f & ~(d & ~t));
    }
    function No(e, t, a) {
      e.pendingLanes |= t, e.suspendedLanes &= ~t;
      var i = 31 - Fl(t);
      e.entangledLanes |= t, e.entanglements[i] = e.entanglements[i] | 1073741824 | a & 261930;
    }
    function hs(e, t) {
      var a = e.entangledLanes |= t;
      for (e = e.entanglements; a; ) {
        var i = 31 - Fl(a), o = 1 << i;
        o & t | e[i] & t && (e[i] |= t), a &= ~o;
      }
    }
    function Ec(e, t) {
      var a = t & -t;
      return a = (a & 42) !== 0 ? 1 : hn(a), (a & (e.suspendedLanes | t)) !== 0 ? 0 : a;
    }
    function hn(e) {
      switch (e) {
        case 2:
          e = 1;
          break;
        case 8:
          e = 4;
          break;
        case 32:
          e = 16;
          break;
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          e = 128;
          break;
        case 268435456:
          e = 134217728;
          break;
        default:
          e = 0;
      }
      return e;
    }
    function zl(e, t, a) {
      if (qu)
        for (e = e.pendingUpdatersLaneMap; 0 < a; ) {
          var i = 31 - Fl(a), o = 1 << i;
          e[i].add(t), a &= ~o;
        }
    }
    function La(e, t) {
      if (qu)
        for (var a = e.pendingUpdatersLaneMap, i = e.memoizedUpdaters; 0 < t; ) {
          var o = 31 - Fl(t);
          e = 1 << o, o = a[o], 0 < o.size && (o.forEach(function(f) {
            var d = f.alternate;
            d !== null && i.has(d) || i.add(f);
          }), o.clear()), t &= ~e;
        }
    }
    function Nl(e) {
      return e &= -e, Cl < e ? Il < e ? (e & 134217727) !== 0 ? ca : hc : Il : Cl;
    }
    function xi() {
      var e = At.p;
      return e !== 0 ? e : (e = window.event, e === void 0 ? ca : Rh(e.type));
    }
    function g(e, t) {
      var a = At.p;
      try {
        return At.p = e, t();
      } finally {
        At.p = a;
      }
    }
    function U(e) {
      delete e[el], delete e[Da], delete e[mo], delete e[o1], delete e[Lg];
    }
    function ae(e) {
      var t = e[el];
      if (t) return t;
      for (var a = e.parentNode; a; ) {
        if (t = a[Ei] || a[el]) {
          if (a = t.alternate, t.child !== null || a !== null && a.child !== null)
            for (e = uo(e); e !== null; ) {
              if (a = e[el])
                return a;
              e = uo(e);
            }
          return t;
        }
        e = a, a = e.parentNode;
      }
      return null;
    }
    function ce(e) {
      if (e = e[el] || e[Ei]) {
        var t = e.tag;
        if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3)
          return e;
      }
      return null;
    }
    function ve(e) {
      var t = e.tag;
      if (t === 5 || t === 26 || t === 27 || t === 6)
        return e.stateNode;
      throw Error("getNodeFromInstance: Invalid argument.");
    }
    function we(e) {
      var t = e[Rr];
      return t || (t = e[Rr] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() }), t;
    }
    function Se(e) {
      e[Gf] = !0;
    }
    function nt(e, t) {
      Je(e, t), Je(e + "Capture", t);
    }
    function Je(e, t) {
      Gu[e] && console.error(
        "EventRegistry: More than one plugin attempted to publish the same registration name, `%s`.",
        e
      ), Gu[e] = t;
      var a = e.toLowerCase();
      for (Lf[a] = e, e === "onDoubleClick" && (Lf.ondblclick = e), e = 0; e < t.length; e++)
        Xg.add(t[e]);
    }
    function la(e, t) {
      Qg[t.type] || t.onChange || t.onInput || t.readOnly || t.disabled || t.value == null || console.error(
        e === "select" ? "You provided a `value` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultValue`. Otherwise, set `onChange`." : "You provided a `value` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultValue`. Otherwise, set either `onChange` or `readOnly`."
      ), t.onChange || t.readOnly || t.disabled || t.checked == null || console.error(
        "You provided a `checked` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultChecked`. Otherwise, set either `onChange` or `readOnly`."
      );
    }
    function mn(e) {
      return un.call(Lh, e) ? !0 : un.call(Ap, e) ? !1 : Xf.test(e) ? Lh[e] = !0 : (Ap[e] = !0, console.error("Invalid attribute name: `%s`", e), !1);
    }
    function Ui(e, t, a) {
      if (mn(t)) {
        if (!e.hasAttribute(t)) {
          switch (typeof a) {
            case "symbol":
            case "object":
              return a;
            case "function":
              return a;
            case "boolean":
              if (a === !1) return a;
          }
          return a === void 0 ? void 0 : null;
        }
        return e = e.getAttribute(t), e === "" && a === !0 ? !0 : (vt(a, t), e === "" + a ? a : e);
      }
    }
    function Ho(e, t, a) {
      if (mn(t))
        if (a === null) e.removeAttribute(t);
        else {
          switch (typeof a) {
            case "undefined":
            case "function":
            case "symbol":
              e.removeAttribute(t);
              return;
            case "boolean":
              var i = t.toLowerCase().slice(0, 5);
              if (i !== "data-" && i !== "aria-") {
                e.removeAttribute(t);
                return;
              }
          }
          vt(a, t), e.setAttribute(t, "" + a);
        }
    }
    function ms(e, t, a) {
      if (a === null) e.removeAttribute(t);
      else {
        switch (typeof a) {
          case "undefined":
          case "function":
          case "symbol":
          case "boolean":
            e.removeAttribute(t);
            return;
        }
        vt(a, t), e.setAttribute(t, "" + a);
      }
    }
    function fu(e, t, a, i) {
      if (i === null) e.removeAttribute(a);
      else {
        switch (typeof i) {
          case "undefined":
          case "function":
          case "symbol":
          case "boolean":
            e.removeAttribute(a);
            return;
        }
        vt(i, a), e.setAttributeNS(t, a, "" + i);
      }
    }
    function Xa(e) {
      switch (typeof e) {
        case "bigint":
        case "boolean":
        case "number":
        case "string":
        case "undefined":
          return e;
        case "object":
          return bc(e), e;
        default:
          return "";
      }
    }
    function td(e) {
      var t = e.type;
      return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
    }
    function Em(e, t, a) {
      var i = Object.getOwnPropertyDescriptor(
        e.constructor.prototype,
        t
      );
      if (!e.hasOwnProperty(t) && typeof i < "u" && typeof i.get == "function" && typeof i.set == "function") {
        var o = i.get, f = i.set;
        return Object.defineProperty(e, t, {
          configurable: !0,
          get: function() {
            return o.call(this);
          },
          set: function(d) {
            bc(d), a = "" + d, f.call(this, d);
          }
        }), Object.defineProperty(e, t, {
          enumerable: i.enumerable
        }), {
          getValue: function() {
            return a;
          },
          setValue: function(d) {
            bc(d), a = "" + d;
          },
          stopTracking: function() {
            e._valueTracker = null, delete e[t];
          }
        };
      }
    }
    function ld(e) {
      if (!e._valueTracker) {
        var t = td(e) ? "checked" : "value";
        e._valueTracker = Em(
          e,
          t,
          "" + e[t]
        );
      }
    }
    function Tm(e) {
      if (!e) return !1;
      var t = e._valueTracker;
      if (!t) return !0;
      var a = t.getValue(), i = "";
      return e && (i = td(e) ? e.checked ? "true" : "false" : e.value), e = i, e !== a ? (t.setValue(e), !0) : !1;
    }
    function Un(e) {
      if (e = e || (typeof document < "u" ? document : void 0), typeof e > "u") return null;
      try {
        return e.activeElement || e.body;
      } catch {
        return e.body;
      }
    }
    function xt(e) {
      return e.replace(
        Xh,
        function(t) {
          return "\\" + t.charCodeAt(0).toString(16) + " ";
        }
      );
    }
    function ra(e, t) {
      t.checked === void 0 || t.defaultChecked === void 0 || Vg || (console.error(
        "%s contains an input of type %s with both checked and defaultChecked props. Input elements must be either controlled or uncontrolled (specify either the checked prop, or the defaultChecked prop, but not both). Decide between using a controlled or uncontrolled input element and remove one of these props. More info: https://react.dev/link/controlled-components",
        gt() || "A component",
        t.type
      ), Vg = !0), t.value === void 0 || t.defaultValue === void 0 || Op || (console.error(
        "%s contains an input of type %s with both value and defaultValue props. Input elements must be either controlled or uncontrolled (specify either the value prop, or the defaultValue prop, but not both). Decide between using a controlled or uncontrolled input element and remove one of these props. More info: https://react.dev/link/controlled-components",
        gt() || "A component",
        t.type
      ), Op = !0);
    }
    function Ni(e, t, a, i, o, f, d, h) {
      e.name = "", d != null && typeof d != "function" && typeof d != "symbol" && typeof d != "boolean" ? (vt(d, "type"), e.type = d) : e.removeAttribute("type"), t != null ? d === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + Xa(t)) : e.value !== "" + Xa(t) && (e.value = "" + Xa(t)) : d !== "submit" && d !== "reset" || e.removeAttribute("value"), t != null ? Am(e, d, Xa(t)) : a != null ? Am(e, d, Xa(a)) : i != null && e.removeAttribute("value"), o == null && f != null && (e.defaultChecked = !!f), o != null && (e.checked = o && typeof o != "function" && typeof o != "symbol"), h != null && typeof h != "function" && typeof h != "symbol" && typeof h != "boolean" ? (vt(h, "name"), e.name = "" + Xa(h)) : e.removeAttribute("name");
    }
    function ad(e, t, a, i, o, f, d, h) {
      if (f != null && typeof f != "function" && typeof f != "symbol" && typeof f != "boolean" && (vt(f, "type"), e.type = f), t != null || a != null) {
        if (!(f !== "submit" && f !== "reset" || t != null)) {
          ld(e);
          return;
        }
        a = a != null ? "" + Xa(a) : "", t = t != null ? "" + Xa(t) : a, h || t === e.value || (e.value = t), e.defaultValue = t;
      }
      i = i ?? o, i = typeof i != "function" && typeof i != "symbol" && !!i, e.checked = h ? e.checked : !!i, e.defaultChecked = !!i, d != null && typeof d != "function" && typeof d != "symbol" && typeof d != "boolean" && (vt(d, "name"), e.name = d), ld(e);
    }
    function Am(e, t, a) {
      t === "number" && Un(e.ownerDocument) === e || e.defaultValue === "" + a || (e.defaultValue = "" + a);
    }
    function E0(e, t) {
      t.value == null && (typeof t.children == "object" && t.children !== null ? Tr.Children.forEach(t.children, function(a) {
        a == null || typeof a == "string" || typeof a == "number" || typeof a == "bigint" || l || (l = !0, console.error(
          "Cannot infer the option value of complex children. Pass a `value` prop or use a plain string as children to <option>."
        ));
      }) : t.dangerouslySetInnerHTML == null || n || (n = !0, console.error(
        "Pass a `value` prop if you set dangerouslyInnerHTML so React knows which value should be selected."
      ))), t.selected == null || Mr || (console.error(
        "Use the `defaultValue` or `value` props on <select> instead of setting `selected` on <option>."
      ), Mr = !0);
    }
    function Om() {
      var e = gt();
      return e ? `

Check the render method of \`` + e + "`." : "";
    }
    function su(e, t, a, i) {
      if (e = e.options, t) {
        t = {};
        for (var o = 0; o < a.length; o++)
          t["$" + a[o]] = !0;
        for (a = 0; a < e.length; a++)
          o = t.hasOwnProperty("$" + e[a].value), e[a].selected !== o && (e[a].selected = o), o && i && (e[a].defaultSelected = !0);
      } else {
        for (a = "" + Xa(a), t = null, o = 0; o < e.length; o++) {
          if (e[o].value === a) {
            e[o].selected = !0, i && (e[o].defaultSelected = !0);
            return;
          }
          t !== null || e[o].disabled || (t = e[o]);
        }
        t !== null && (t.selected = !0);
      }
    }
    function nd(e, t) {
      for (e = 0; e < c.length; e++) {
        var a = c[e];
        if (t[a] != null) {
          var i = Al(t[a]);
          t.multiple && !i ? console.error(
            "The `%s` prop supplied to <select> must be an array if `multiple` is true.%s",
            a,
            Om()
          ) : !t.multiple && i && console.error(
            "The `%s` prop supplied to <select> must be a scalar value if `multiple` is false.%s",
            a,
            Om()
          );
        }
      }
      t.value === void 0 || t.defaultValue === void 0 || u || (console.error(
        "Select elements must be either controlled or uncontrolled (specify either the value prop, or the defaultValue prop, but not both). Decide between using a controlled or uncontrolled select element and remove one of these props. More info: https://react.dev/link/controlled-components"
      ), u = !0);
    }
    function Tc(e, t) {
      t.value === void 0 || t.defaultValue === void 0 || s || (console.error(
        "%s contains a textarea with both value and defaultValue props. Textarea elements must be either controlled or uncontrolled (specify either the value prop, or the defaultValue prop, but not both). Decide between using a controlled or uncontrolled textarea and remove one of these props. More info: https://react.dev/link/controlled-components",
        gt() || "A component"
      ), s = !0), t.children != null && t.value == null && console.error(
        "Use the `defaultValue` or `value` props instead of setting children on <textarea>."
      );
    }
    function Ac(e, t, a) {
      if (t != null && (t = "" + Xa(t), t !== e.value && (e.value = t), a == null)) {
        e.defaultValue !== t && (e.defaultValue = t);
        return;
      }
      e.defaultValue = a != null ? "" + Xa(a) : "";
    }
    function jo(e, t, a, i) {
      if (t == null) {
        if (i != null) {
          if (a != null)
            throw Error(
              "If you supply `defaultValue` on a <textarea>, do not pass children."
            );
          if (Al(i)) {
            if (1 < i.length)
              throw Error("<textarea> can only have at most one child.");
            i = i[0];
          }
          a = i;
        }
        a == null && (a = ""), t = a;
      }
      a = Xa(t), e.defaultValue = a, i = e.textContent, i === a && i !== "" && i !== null && (e.value = i), ld(e);
    }
    function Oc(e, t) {
      return e.serverProps === void 0 && e.serverTail.length === 0 && e.children.length === 1 && 3 < e.distanceFromLeaf && e.distanceFromLeaf > 15 - t ? Oc(e.children[0], t) : e;
    }
    function Ot(e) {
      return "  " + "  ".repeat(e);
    }
    function zc(e) {
      return "+ " + "  ".repeat(e);
    }
    function Hi(e) {
      return "- " + "  ".repeat(e);
    }
    function ji(e) {
      switch (e.tag) {
        case 26:
        case 27:
        case 5:
          return e.type;
        case 16:
          return "Lazy";
        case 31:
          return "Activity";
        case 13:
          return "Suspense";
        case 19:
          return "SuspenseList";
        case 0:
        case 15:
          return e = e.type, e.displayName || e.name || null;
        case 11:
          return e = e.type.render, e.displayName || e.name || null;
        case 1:
          return e = e.type, e.displayName || e.name || null;
        default:
          return null;
      }
    }
    function ru(e, t) {
      return r.test(e) ? (e = JSON.stringify(e), e.length > t - 2 ? 8 > t ? '{"..."}' : "{" + e.slice(0, t - 7) + '..."}' : "{" + e + "}") : e.length > t ? 5 > t ? '{"..."}' : e.slice(0, t - 3) + "..." : e;
    }
    function ud(e, t, a) {
      var i = 120 - 2 * a;
      if (t === null)
        return zc(a) + ru(e, i) + `
`;
      if (typeof t == "string") {
        for (var o = 0; o < t.length && o < e.length && t.charCodeAt(o) === e.charCodeAt(o); o++) ;
        return o > i - 8 && 10 < o && (e = "..." + e.slice(o - 8), t = "..." + t.slice(o - 8)), zc(a) + ru(e, i) + `
` + Hi(a) + ru(t, i) + `
`;
      }
      return Ot(a) + ru(e, i) + `
`;
    }
    function id(e) {
      return Object.prototype.toString.call(e).replace(/^\[object (.*)\]$/, function(t, a) {
        return a;
      });
    }
    function wo(e, t) {
      switch (typeof e) {
        case "string":
          return e = JSON.stringify(e), e.length > t ? 5 > t ? '"..."' : e.slice(0, t - 4) + '..."' : e;
        case "object":
          if (e === null) return "null";
          if (Al(e)) return "[...]";
          if (e.$$typeof === Dn)
            return (t = We(e.type)) ? "<" + t + ">" : "<...>";
          var a = id(e);
          if (a === "Object") {
            a = "", t -= 2;
            for (var i in e)
              if (e.hasOwnProperty(i)) {
                var o = JSON.stringify(i);
                if (o !== '"' + i + '"' && (i = o), t -= i.length - 2, o = wo(
                  e[i],
                  15 > t ? t : 15
                ), t -= o.length, 0 > t) {
                  a += a === "" ? "..." : ", ...";
                  break;
                }
                a += (a === "" ? "" : ",") + i + ":" + o;
              }
            return "{" + a + "}";
          }
          return a;
        case "function":
          return (t = e.displayName || e.name) ? "function " + t : "function";
        default:
          return String(e);
      }
    }
    function Bo(e, t) {
      return typeof e != "string" || r.test(e) ? "{" + wo(e, t - 2) + "}" : e.length > t - 2 ? 5 > t ? '"..."' : '"' + e.slice(0, t - 5) + '..."' : '"' + e + '"';
    }
    function Yo(e, t, a) {
      var i = 120 - a.length - e.length, o = [], f;
      for (f in t)
        if (t.hasOwnProperty(f) && f !== "children") {
          var d = Bo(
            t[f],
            120 - a.length - f.length - 1
          );
          i -= f.length + d.length + 2, o.push(f + "=" + d);
        }
      return o.length === 0 ? a + "<" + e + `>
` : 0 < i ? a + "<" + e + " " + o.join(" ") + `>
` : a + "<" + e + `
` + a + "  " + o.join(`
` + a + "  ") + `
` + a + `>
`;
    }
    function cd(e, t, a) {
      var i = "", o = et({}, t), f;
      for (f in e)
        if (e.hasOwnProperty(f)) {
          delete o[f];
          var d = 120 - 2 * a - f.length - 2, h = wo(e[f], d);
          t.hasOwnProperty(f) ? (d = wo(t[f], d), i += zc(a) + f + ": " + h + `
`, i += Hi(a) + f + ": " + d + `
`) : i += zc(a) + f + ": " + h + `
`;
        }
      for (var y in o)
        o.hasOwnProperty(y) && (e = wo(
          o[y],
          120 - 2 * a - y.length - 2
        ), i += Hi(a) + y + ": " + e + `
`);
      return i;
    }
    function Pu(e, t, a, i) {
      var o = "", f = /* @__PURE__ */ new Map();
      for (p in a)
        a.hasOwnProperty(p) && f.set(
          p.toLowerCase(),
          p
        );
      if (f.size === 1 && f.has("children"))
        o += Yo(
          e,
          t,
          Ot(i)
        );
      else {
        for (var d in t)
          if (t.hasOwnProperty(d) && d !== "children") {
            var h = 120 - 2 * (i + 1) - d.length - 1, y = f.get(d.toLowerCase());
            if (y !== void 0) {
              f.delete(d.toLowerCase());
              var p = t[d];
              y = a[y];
              var z = Bo(
                p,
                h
              );
              h = Bo(
                y,
                h
              ), typeof p == "object" && p !== null && typeof y == "object" && y !== null && id(p) === "Object" && id(y) === "Object" && (2 < Object.keys(p).length || 2 < Object.keys(y).length || -1 < z.indexOf("...") || -1 < h.indexOf("...")) ? o += Ot(i + 1) + d + `={{
` + cd(
                p,
                y,
                i + 2
              ) + Ot(i + 1) + `}}
` : (o += zc(i + 1) + d + "=" + z + `
`, o += Hi(i + 1) + d + "=" + h + `
`);
            } else
              o += Ot(i + 1) + d + "=" + Bo(t[d], h) + `
`;
          }
        f.forEach(function(R) {
          if (R !== "children") {
            var E = 120 - 2 * (i + 1) - R.length - 1;
            o += Hi(i + 1) + R + "=" + Bo(a[R], E) + `
`;
          }
        }), o = o === "" ? Ot(i) + "<" + e + `>
` : Ot(i) + "<" + e + `
` + o + Ot(i) + `>
`;
      }
      return e = a.children, t = t.children, typeof e == "string" || typeof e == "number" || typeof e == "bigint" ? (f = "", (typeof t == "string" || typeof t == "number" || typeof t == "bigint") && (f = "" + t), o += ud(f, "" + e, i + 1)) : (typeof t == "string" || typeof t == "number" || typeof t == "bigint") && (o = e == null ? o + ud("" + t, null, i + 1) : o + ud("" + t, void 0, i + 1)), o;
    }
    function Qa(e, t) {
      var a = ji(e);
      if (a === null) {
        for (a = "", e = e.child; e; )
          a += Qa(e, t), e = e.sibling;
        return a;
      }
      return Ot(t) + "<" + a + `>
`;
    }
    function od(e, t) {
      var a = Oc(e, t);
      if (a !== e && (e.children.length !== 1 || e.children[0] !== a))
        return Ot(t) + `...
` + od(a, t + 1);
      a = "";
      var i = e.fiber._debugInfo;
      if (i)
        for (var o = 0; o < i.length; o++) {
          var f = i[o].name;
          typeof f == "string" && (a += Ot(t) + "<" + f + `>
`, t++);
        }
      if (i = "", o = e.fiber.pendingProps, e.fiber.tag === 6)
        i = ud(o, e.serverProps, t), t++;
      else if (f = ji(e.fiber), f !== null)
        if (e.serverProps === void 0) {
          i = t;
          var d = 120 - 2 * i - f.length - 2, h = "";
          for (p in o)
            if (o.hasOwnProperty(p) && p !== "children") {
              var y = Bo(o[p], 15);
              if (d -= p.length + y.length + 2, 0 > d) {
                h += " ...";
                break;
              }
              h += " " + p + "=" + y;
            }
          i = Ot(i) + "<" + f + h + `>
`, t++;
        } else
          e.serverProps === null ? (i = Yo(
            f,
            o,
            zc(t)
          ), t++) : typeof e.serverProps == "string" ? console.error(
            "Should not have matched a non HostText fiber to a Text node. This is a bug in React."
          ) : (i = Pu(
            f,
            o,
            e.serverProps,
            t
          ), t++);
      var p = "";
      for (o = e.fiber.child, f = 0; o && f < e.children.length; )
        d = e.children[f], d.fiber === o ? (p += od(d, t), f++) : p += Qa(o, t), o = o.sibling;
      for (o && 0 < e.children.length && (p += Ot(t) + `...
`), o = e.serverTail, e.serverProps === null && t--, e = 0; e < o.length; e++)
        f = o[e], p = typeof f == "string" ? p + (Hi(t) + ru(f, 120 - 2 * t) + `
`) : p + Yo(
          f.type,
          f.props,
          Hi(t)
        );
      return a + i + p;
    }
    function zm(e) {
      try {
        return `

` + od(e, 0);
      } catch {
        return "";
      }
    }
    function fd(e, t, a) {
      for (var i = t, o = null, f = 0; i; )
        i === e && (f = 0), o = {
          fiber: i,
          children: o !== null ? [o] : [],
          serverProps: i === t ? a : i === e ? null : void 0,
          serverTail: [],
          distanceFromLeaf: f
        }, f++, i = i.return;
      return o !== null ? zm(o).replaceAll(/^[+-]/gm, ">") : "";
    }
    function Dm(e, t) {
      var a = et({}, e || Q), i = { tag: t };
      return v.indexOf(t) !== -1 && (a.aTagInScope = null, a.buttonTagInScope = null, a.nobrTagInScope = null), A.indexOf(t) !== -1 && (a.pTagInButtonScope = null), m.indexOf(t) !== -1 && t !== "address" && t !== "div" && t !== "p" && (a.listItemTagAutoclosing = null, a.dlItemTagAutoclosing = null), a.current = i, t === "form" && (a.formTag = i), t === "a" && (a.aTagInScope = i), t === "button" && (a.buttonTagInScope = i), t === "nobr" && (a.nobrTagInScope = i), t === "p" && (a.pTagInButtonScope = i), t === "li" && (a.listItemTagAutoclosing = i), (t === "dd" || t === "dt") && (a.dlItemTagAutoclosing = i), t === "#document" || t === "html" ? a.containerTagInScope = null : a.containerTagInScope || (a.containerTagInScope = i), e !== null || t !== "#document" && t !== "html" && t !== "body" ? a.implicitRootScope === !0 && (a.implicitRootScope = !1) : a.implicitRootScope = !0, a;
    }
    function ys(e, t, a) {
      switch (t) {
        case "select":
          return e === "hr" || e === "option" || e === "optgroup" || e === "script" || e === "template" || e === "#text";
        case "optgroup":
          return e === "option" || e === "#text";
        case "option":
          return e === "#text";
        case "tr":
          return e === "th" || e === "td" || e === "style" || e === "script" || e === "template";
        case "tbody":
        case "thead":
        case "tfoot":
          return e === "tr" || e === "style" || e === "script" || e === "template";
        case "colgroup":
          return e === "col" || e === "template";
        case "table":
          return e === "caption" || e === "colgroup" || e === "tbody" || e === "tfoot" || e === "thead" || e === "style" || e === "script" || e === "template";
        case "head":
          return e === "base" || e === "basefont" || e === "bgsound" || e === "link" || e === "meta" || e === "title" || e === "noscript" || e === "noframes" || e === "style" || e === "script" || e === "template";
        case "html":
          if (a) break;
          return e === "head" || e === "body" || e === "frameset";
        case "frameset":
          return e === "frame";
        case "#document":
          if (!a) return e === "html";
      }
      switch (e) {
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
          return t !== "h1" && t !== "h2" && t !== "h3" && t !== "h4" && t !== "h5" && t !== "h6";
        case "rp":
        case "rt":
          return w.indexOf(t) === -1;
        case "caption":
        case "col":
        case "colgroup":
        case "frameset":
        case "frame":
        case "tbody":
        case "td":
        case "tfoot":
        case "th":
        case "thead":
        case "tr":
          return t == null;
        case "head":
          return a || t === null;
        case "html":
          return a && t === "#document" || t === null;
        case "body":
          return a && (t === "#document" || t === "html") || t === null;
      }
      return !0;
    }
    function $v(e, t) {
      switch (e) {
        case "address":
        case "article":
        case "aside":
        case "blockquote":
        case "center":
        case "details":
        case "dialog":
        case "dir":
        case "div":
        case "dl":
        case "fieldset":
        case "figcaption":
        case "figure":
        case "footer":
        case "header":
        case "hgroup":
        case "main":
        case "menu":
        case "nav":
        case "ol":
        case "p":
        case "section":
        case "summary":
        case "ul":
        case "pre":
        case "listing":
        case "table":
        case "hr":
        case "xmp":
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
          return t.pTagInButtonScope;
        case "form":
          return t.formTag || t.pTagInButtonScope;
        case "li":
          return t.listItemTagAutoclosing;
        case "dd":
        case "dt":
          return t.dlItemTagAutoclosing;
        case "button":
          return t.buttonTagInScope;
        case "a":
          return t.aTagInScope;
        case "nobr":
          return t.nobrTagInScope;
      }
      return null;
    }
    function Va(e, t) {
      for (; e; ) {
        switch (e.tag) {
          case 5:
          case 26:
          case 27:
            if (e.type === t) return e;
        }
        e = e.return;
      }
      return null;
    }
    function ps(e, t) {
      t = t || Q;
      var a = t.current;
      if (t = (a = ys(
        e,
        a && a.tag,
        t.implicitRootScope
      ) ? null : a) ? null : $v(e, t), t = a || t, !t) return !0;
      var i = t.tag;
      if (t = String(!!a) + "|" + e + "|" + i, W[t]) return !1;
      W[t] = !0;
      var o = (t = ja) ? Va(t.return, i) : null, f = t !== null && o !== null ? fd(o, t, null) : "", d = "<" + e + ">";
      return a ? (a = "", i === "table" && e === "tr" && (a += " Add a <tbody>, <thead> or <tfoot> to your code to match the DOM tree generated by the browser."), console.error(
        `In HTML, %s cannot be a child of <%s>.%s
This will cause a hydration error.%s`,
        d,
        i,
        a,
        f
      )) : console.error(
        `In HTML, %s cannot be a descendant of <%s>.
This will cause a hydration error.%s`,
        d,
        i,
        f
      ), t && (e = t.return, o === null || e === null || o === e && e._debugOwner === t._debugOwner || de(o, function() {
        console.error(
          `<%s> cannot contain a nested %s.
See this log for the ancestor stack trace.`,
          i,
          d
        );
      })), !1;
    }
    function gs(e, t, a) {
      if (a || ys("#text", t, !1))
        return !0;
      if (a = "#text|" + t, W[a]) return !1;
      W[a] = !0;
      var i = (a = ja) ? Va(a, t) : null;
      return a = a !== null && i !== null ? fd(
        i,
        a,
        a.tag !== 6 ? { children: null } : null
      ) : "", /\S/.test(e) ? console.error(
        `In HTML, text nodes cannot be a child of <%s>.
This will cause a hydration error.%s`,
        t,
        a
      ) : console.error(
        `In HTML, whitespace text nodes cannot be a child of <%s>. Make sure you don't have any extra whitespace between tags on each line of your source code.
This will cause a hydration error.%s`,
        t,
        a
      ), !1;
    }
    function Dc(e, t) {
      if (t) {
        var a = e.firstChild;
        if (a && a === e.lastChild && a.nodeType === 3) {
          a.nodeValue = t;
          return;
        }
      }
      e.textContent = t;
    }
    function qo(e) {
      return e.replace(N, function(t, a) {
        return a.toUpperCase();
      });
    }
    function _m(e, t, a) {
      var i = t.indexOf("--") === 0;
      i || (-1 < t.indexOf("-") ? H.hasOwnProperty(t) && H[t] || (H[t] = !0, console.error(
        "Unsupported style property %s. Did you mean %s?",
        t,
        qo(t.replace(jt, "ms-"))
      )) : He.test(t) ? H.hasOwnProperty(t) && H[t] || (H[t] = !0, console.error(
        "Unsupported vendor-prefixed style property %s. Did you mean %s?",
        t,
        t.charAt(0).toUpperCase() + t.slice(1)
      )) : !D.test(a) || $.hasOwnProperty(a) && $[a] || ($[a] = !0, console.error(
        `Style property values shouldn't contain a semicolon. Try "%s: %s" instead.`,
        t,
        a.replace(D, "")
      )), typeof a == "number" && (isNaN(a) ? _e || (_e = !0, console.error(
        "`NaN` is an invalid value for the `%s` css style property.",
        t
      )) : isFinite(a) || yt || (yt = !0, console.error(
        "`Infinity` is an invalid value for the `%s` css style property.",
        t
      )))), a == null || typeof a == "boolean" || a === "" ? i ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : i ? e.setProperty(t, a) : typeof a != "number" || a === 0 || Ee.has(t) ? t === "float" ? e.cssFloat = a : (ta(a, t), e[t] = ("" + a).trim()) : e[t] = a + "px";
    }
    function Rm(e, t, a) {
      if (t != null && typeof t != "object")
        throw Error(
          "The `style` prop expects a mapping from style properties to values, not a string. For example, style={{marginRight: spacing + 'em'}} when using JSX."
        );
      if (t && Object.freeze(t), e = e.style, a != null) {
        if (t) {
          var i = {};
          if (a) {
            for (var o in a)
              if (a.hasOwnProperty(o) && !t.hasOwnProperty(o))
                for (var f = Y[o] || [o], d = 0; d < f.length; d++)
                  i[f[d]] = o;
          }
          for (var h in t)
            if (t.hasOwnProperty(h) && (!a || a[h] !== t[h]))
              for (o = Y[h] || [h], f = 0; f < o.length; f++)
                i[o[f]] = h;
          h = {};
          for (var y in t)
            for (o = Y[y] || [y], f = 0; f < o.length; f++)
              h[o[f]] = y;
          y = {};
          for (var p in i)
            if (o = i[p], (f = h[p]) && o !== f && (d = o + "," + f, !y[d])) {
              y[d] = !0, d = console;
              var z = t[o];
              d.error.call(
                d,
                "%s a style property during rerender (%s) when a conflicting property is set (%s) can lead to styling bugs. To avoid this, don't mix shorthand and non-shorthand properties for the same value; instead, replace the shorthand with separate values.",
                z == null || typeof z == "boolean" || z === "" ? "Removing" : "Updating",
                o,
                f
              );
            }
        }
        for (var R in a)
          !a.hasOwnProperty(R) || t != null && t.hasOwnProperty(R) || (R.indexOf("--") === 0 ? e.setProperty(R, "") : R === "float" ? e.cssFloat = "" : e[R] = "");
        for (var E in t)
          p = t[E], t.hasOwnProperty(E) && a[E] !== p && _m(e, E, p);
      } else
        for (i in t)
          t.hasOwnProperty(i) && _m(e, i, t[i]);
    }
    function du(e) {
      if (e.indexOf("-") === -1) return !1;
      switch (e) {
        case "annotation-xml":
        case "color-profile":
        case "font-face":
        case "font-face-src":
        case "font-face-uri":
        case "font-face-format":
        case "font-face-name":
        case "missing-glyph":
          return !1;
        default:
          return !0;
      }
    }
    function T0(e) {
      return St.get(e) || e;
    }
    function A0(e, t) {
      if (un.call(Qh, t) && Qh[t])
        return !0;
      if (aE.test(t)) {
        if (e = "aria-" + t.slice(4).toLowerCase(), e = Zg.hasOwnProperty(e) ? e : null, e == null)
          return console.error(
            "Invalid ARIA attribute `%s`. ARIA attributes follow the pattern aria-* and must be lowercase.",
            t
          ), Qh[t] = !0;
        if (t !== e)
          return console.error(
            "Invalid ARIA attribute `%s`. Did you mean `%s`?",
            t,
            e
          ), Qh[t] = !0;
      }
      if (lE.test(t)) {
        if (e = t.toLowerCase(), e = Zg.hasOwnProperty(e) ? e : null, e == null) return Qh[t] = !0, !1;
        t !== e && (console.error(
          "Unknown ARIA attribute `%s`. Did you mean `%s`?",
          t,
          e
        ), Qh[t] = !0);
      }
      return !0;
    }
    function O0(e, t) {
      var a = [], i;
      for (i in t)
        A0(e, i) || a.push(i);
      t = a.map(function(o) {
        return "`" + o + "`";
      }).join(", "), a.length === 1 ? console.error(
        "Invalid aria prop %s on <%s> tag. For details, see https://react.dev/link/invalid-aria-props",
        t,
        e
      ) : 1 < a.length && console.error(
        "Invalid aria props %s on <%s> tag. For details, see https://react.dev/link/invalid-aria-props",
        t,
        e
      );
    }
    function Mm(e, t, a, i) {
      if (un.call(cn, t) && cn[t])
        return !0;
      var o = t.toLowerCase();
      if (o === "onfocusin" || o === "onfocusout")
        return console.error(
          "React uses onFocus and onBlur instead of onFocusIn and onFocusOut. All React events are normalized to bubble, so onFocusIn and onFocusOut are not needed/supported by React."
        ), cn[t] = !0;
      if (typeof a == "function" && (e === "form" && t === "action" || e === "input" && t === "formAction" || e === "button" && t === "formAction"))
        return !0;
      if (i != null) {
        if (e = i.possibleRegistrationNames, i.registrationNameDependencies.hasOwnProperty(t))
          return !0;
        if (i = e.hasOwnProperty(o) ? e[o] : null, i != null)
          return console.error(
            "Invalid event handler property `%s`. Did you mean `%s`?",
            t,
            i
          ), cn[t] = !0;
        if (Tb.test(t))
          return console.error(
            "Unknown event handler property `%s`. It will be ignored.",
            t
          ), cn[t] = !0;
      } else if (Tb.test(t))
        return nE.test(t) && console.error(
          "Invalid event handler property `%s`. React events use the camelCase naming convention, for example `onClick`.",
          t
        ), cn[t] = !0;
      if (uE.test(t) || iE.test(t)) return !0;
      if (o === "innerhtml")
        return console.error(
          "Directly setting property `innerHTML` is not permitted. For more information, lookup documentation on `dangerouslySetInnerHTML`."
        ), cn[t] = !0;
      if (o === "aria")
        return console.error(
          "The `aria` attribute is reserved for future use in React. Pass individual `aria-` attributes instead."
        ), cn[t] = !0;
      if (o === "is" && a !== null && a !== void 0 && typeof a != "string")
        return console.error(
          "Received a `%s` for a string attribute `is`. If this is expected, cast the value to a string.",
          typeof a
        ), cn[t] = !0;
      if (typeof a == "number" && isNaN(a))
        return console.error(
          "Received NaN for the `%s` attribute. If this is expected, cast the value to a string.",
          t
        ), cn[t] = !0;
      if (tu.hasOwnProperty(o)) {
        if (o = tu[o], o !== t)
          return console.error(
            "Invalid DOM property `%s`. Did you mean `%s`?",
            t,
            o
          ), cn[t] = !0;
      } else if (t !== o)
        return console.error(
          "React does not recognize the `%s` prop on a DOM element. If you intentionally want it to appear in the DOM as a custom attribute, spell it as lowercase `%s` instead. If you accidentally passed it from a parent component, remove it from the DOM element.",
          t,
          o
        ), cn[t] = !0;
      switch (t) {
        case "dangerouslySetInnerHTML":
        case "children":
        case "style":
        case "suppressContentEditableWarning":
        case "suppressHydrationWarning":
        case "defaultValue":
        case "defaultChecked":
        case "innerHTML":
        case "ref":
          return !0;
        case "innerText":
        case "textContent":
          return !0;
      }
      switch (typeof a) {
        case "boolean":
          switch (t) {
            case "autoFocus":
            case "checked":
            case "multiple":
            case "muted":
            case "selected":
            case "contentEditable":
            case "spellCheck":
            case "draggable":
            case "value":
            case "autoReverse":
            case "externalResourcesRequired":
            case "focusable":
            case "preserveAlpha":
            case "allowFullScreen":
            case "async":
            case "autoPlay":
            case "controls":
            case "default":
            case "defer":
            case "disabled":
            case "disablePictureInPicture":
            case "disableRemotePlayback":
            case "formNoValidate":
            case "hidden":
            case "loop":
            case "noModule":
            case "noValidate":
            case "open":
            case "playsInline":
            case "readOnly":
            case "required":
            case "reversed":
            case "scoped":
            case "seamless":
            case "itemScope":
            case "capture":
            case "download":
            case "inert":
              return !0;
            default:
              return o = t.toLowerCase().slice(0, 5), o === "data-" || o === "aria-" ? !0 : (a ? console.error(
                'Received `%s` for a non-boolean attribute `%s`.\n\nIf you want to write it to the DOM, pass a string instead: %s="%s" or %s={value.toString()}.',
                a,
                t,
                t,
                a,
                t
              ) : console.error(
                'Received `%s` for a non-boolean attribute `%s`.\n\nIf you want to write it to the DOM, pass a string instead: %s="%s" or %s={value.toString()}.\n\nIf you used to conditionally omit it with %s={condition && value}, pass %s={condition ? value : undefined} instead.',
                a,
                t,
                t,
                a,
                t,
                t,
                t
              ), cn[t] = !0);
          }
        case "function":
        case "symbol":
          return cn[t] = !0, !1;
        case "string":
          if (a === "false" || a === "true") {
            switch (t) {
              case "checked":
              case "selected":
              case "multiple":
              case "muted":
              case "allowFullScreen":
              case "async":
              case "autoPlay":
              case "controls":
              case "default":
              case "defer":
              case "disabled":
              case "disablePictureInPicture":
              case "disableRemotePlayback":
              case "formNoValidate":
              case "hidden":
              case "loop":
              case "noModule":
              case "noValidate":
              case "open":
              case "playsInline":
              case "readOnly":
              case "required":
              case "reversed":
              case "scoped":
              case "seamless":
              case "itemScope":
              case "inert":
                break;
              default:
                return !0;
            }
            console.error(
              "Received the string `%s` for the boolean attribute `%s`. %s Did you mean %s={%s}?",
              a,
              t,
              a === "false" ? "The browser will interpret it as a truthy value." : 'Although this works, it will not work as expected if you pass the string "false".',
              t,
              a
            ), cn[t] = !0;
          }
      }
      return !0;
    }
    function kv(e, t, a) {
      var i = [], o;
      for (o in t)
        Mm(e, o, t[o], a) || i.push(o);
      t = i.map(function(f) {
        return "`" + f + "`";
      }).join(", "), i.length === 1 ? console.error(
        "Invalid value for prop %s on <%s> tag. Either remove it from the element, or pass a string or number value to keep it in the DOM. For details, see https://react.dev/link/attribute-behavior ",
        t,
        e
      ) : 1 < i.length && console.error(
        "Invalid values for props %s on <%s> tag. Either remove them from the element, or pass a string or number value to keep them in the DOM. For details, see https://react.dev/link/attribute-behavior ",
        t,
        e
      );
    }
    function vs(e) {
      return cE.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
    }
    function yn() {
    }
    function Nn(e) {
      return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
    }
    function sd(e) {
      var t = ce(e);
      if (t && (e = t.stateNode)) {
        var a = e[Da] || null;
        e: switch (e = t.stateNode, t.type) {
          case "input":
            if (Ni(
              e,
              a.value,
              a.defaultValue,
              a.defaultValue,
              a.checked,
              a.defaultChecked,
              a.type,
              a.name
            ), t = a.name, a.type === "radio" && t != null) {
              for (a = e; a.parentNode; ) a = a.parentNode;
              for (vt(t, "name"), a = a.querySelectorAll(
                'input[name="' + xt(
                  "" + t
                ) + '"][type="radio"]'
              ), t = 0; t < a.length; t++) {
                var i = a[t];
                if (i !== e && i.form === e.form) {
                  var o = i[Da] || null;
                  if (!o)
                    throw Error(
                      "ReactDOMInput: Mixing React and non-React radio inputs with the same `name` is not supported."
                    );
                  Ni(
                    i,
                    o.value,
                    o.defaultValue,
                    o.defaultValue,
                    o.checked,
                    o.defaultChecked,
                    o.type,
                    o.name
                  );
                }
              }
              for (t = 0; t < a.length; t++)
                i = a[t], i.form === e.form && Tm(i);
            }
            break e;
          case "textarea":
            Ac(e, a.value, a.defaultValue);
            break e;
          case "select":
            t = a.value, t != null && su(e, !!a.multiple, t, !1);
        }
      }
    }
    function rd(e, t, a) {
      if (f1) return e(t, a);
      f1 = !0;
      try {
        var i = e(t);
        return i;
      } finally {
        if (f1 = !1, (Vh !== null || Zh !== null) && (ln(), Vh && (t = Vh, e = Zh, Zh = Vh = null, sd(t), e)))
          for (t = 0; t < e.length; t++) sd(e[t]);
      }
    }
    function hu(e, t) {
      var a = e.stateNode;
      if (a === null) return null;
      var i = a[Da] || null;
      if (i === null) return null;
      a = i[t];
      e: switch (t) {
        case "onClick":
        case "onClickCapture":
        case "onDoubleClick":
        case "onDoubleClickCapture":
        case "onMouseDown":
        case "onMouseDownCapture":
        case "onMouseMove":
        case "onMouseMoveCapture":
        case "onMouseUp":
        case "onMouseUpCapture":
        case "onMouseEnter":
          (i = !i.disabled) || (e = e.type, i = !(e === "button" || e === "input" || e === "select" || e === "textarea")), e = !i;
          break e;
        default:
          e = !1;
      }
      if (e) return null;
      if (a && typeof a != "function")
        throw Error(
          "Expected `" + t + "` listener to be a function, instead got a value of `" + typeof a + "` type."
        );
      return a;
    }
    function _c() {
      if (Jg) return Jg;
      var e, t = r1, a = t.length, i, o = "value" in Qf ? Qf.value : Qf.textContent, f = o.length;
      for (e = 0; e < a && t[e] === o[e]; e++) ;
      var d = a - e;
      for (i = 1; i <= d && t[a - i] === o[f - i]; i++) ;
      return Jg = o.slice(e, 1 < i ? 1 - i : void 0);
    }
    function bs(e) {
      var t = e.keyCode;
      return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
    }
    function Go() {
      return !0;
    }
    function Cm() {
      return !1;
    }
    function Hl(e) {
      function t(a, i, o, f, d) {
        this._reactName = a, this._targetInst = o, this.type = i, this.nativeEvent = f, this.target = d, this.currentTarget = null;
        for (var h in e)
          e.hasOwnProperty(h) && (a = e[h], this[h] = a ? a(f) : f[h]);
        return this.isDefaultPrevented = (f.defaultPrevented != null ? f.defaultPrevented : f.returnValue === !1) ? Go : Cm, this.isPropagationStopped = Cm, this;
      }
      return et(t.prototype, {
        preventDefault: function() {
          this.defaultPrevented = !0;
          var a = this.nativeEvent;
          a && (a.preventDefault ? a.preventDefault() : typeof a.returnValue != "unknown" && (a.returnValue = !1), this.isDefaultPrevented = Go);
        },
        stopPropagation: function() {
          var a = this.nativeEvent;
          a && (a.stopPropagation ? a.stopPropagation() : typeof a.cancelBubble != "unknown" && (a.cancelBubble = !0), this.isPropagationStopped = Go);
        },
        persist: function() {
        },
        isPersistent: Go
      }), t;
    }
    function ei(e) {
      var t = this.nativeEvent;
      return t.getModifierState ? t.getModifierState(e) : (e = SE[e]) ? !!t[e] : !1;
    }
    function Ss() {
      return ei;
    }
    function Lo(e, t) {
      switch (e) {
        case "keyup":
          return UE.indexOf(t.keyCode) !== -1;
        case "keydown":
          return t.keyCode !== Db;
        case "keypress":
        case "mousedown":
        case "focusout":
          return !0;
        default:
          return !1;
      }
    }
    function ti(e) {
      return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
    }
    function xm(e, t) {
      switch (e) {
        case "compositionend":
          return ti(t);
        case "keypress":
          return t.which !== Rb ? null : (Cb = !0, Mb);
        case "textInput":
          return e = t.data, e === Mb && Cb ? null : e;
        default:
          return null;
      }
    }
    function dd(e, t) {
      if (Jh)
        return e === "compositionend" || !y1 && Lo(e, t) ? (e = _c(), Jg = r1 = Qf = null, Jh = !1, e) : null;
      switch (e) {
        case "paste":
          return null;
        case "keypress":
          if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
            if (t.char && 1 < t.char.length)
              return t.char;
            if (t.which)
              return String.fromCharCode(t.which);
          }
          return null;
        case "compositionend":
          return _b && t.locale !== "ko" ? null : t.data;
        default:
          return null;
      }
    }
    function Um(e) {
      var t = e && e.nodeName && e.nodeName.toLowerCase();
      return t === "input" ? !!HE[e.type] : t === "textarea";
    }
    function hd(e) {
      if (!mc) return !1;
      e = "on" + e;
      var t = e in document;
      return t || (t = document.createElement("div"), t.setAttribute(e, "return;"), t = typeof t[e] == "function"), t;
    }
    function Es(e, t, a, i) {
      Vh ? Zh ? Zh.push(i) : Zh = [i] : Vh = i, t = Wn(t, "onChange"), 0 < t.length && (a = new Kg(
        "onChange",
        "change",
        null,
        a,
        i
      ), e.push({ event: a, listeners: t }));
    }
    function z0(e) {
      _t(e, 0);
    }
    function kl(e) {
      var t = ve(e);
      if (Tm(t)) return e;
    }
    function wi(e, t) {
      if (e === "change") return t;
    }
    function Ts() {
      Cp && (Cp.detachEvent("onpropertychange", Xo), xp = Cp = null);
    }
    function Xo(e) {
      if (e.propertyName === "value" && kl(xp)) {
        var t = [];
        Es(
          t,
          xp,
          e,
          Nn(e)
        ), rd(z0, t);
      }
    }
    function Wv(e, t, a) {
      e === "focusin" ? (Ts(), Cp = t, xp = a, Cp.attachEvent("onpropertychange", Xo)) : e === "focusout" && Ts();
    }
    function Nm(e) {
      if (e === "selectionchange" || e === "keyup" || e === "keydown")
        return kl(xp);
    }
    function Hm(e, t) {
      if (e === "click") return kl(t);
    }
    function As(e, t) {
      if (e === "input" || e === "change")
        return kl(t);
    }
    function md(e, t) {
      return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
    }
    function Qo(e, t) {
      if (on(e, t)) return !0;
      if (typeof e != "object" || e === null || typeof t != "object" || t === null)
        return !1;
      var a = Object.keys(e), i = Object.keys(t);
      if (a.length !== i.length) return !1;
      for (i = 0; i < a.length; i++) {
        var o = a[i];
        if (!un.call(t, o) || !on(e[o], t[o]))
          return !1;
      }
      return !0;
    }
    function D0(e) {
      for (; e && e.firstChild; ) e = e.firstChild;
      return e;
    }
    function _0(e, t) {
      var a = D0(e);
      e = 0;
      for (var i; a; ) {
        if (a.nodeType === 3) {
          if (i = e + a.textContent.length, e <= t && i >= t)
            return { node: a, offset: t - e };
          e = i;
        }
        e: {
          for (; a; ) {
            if (a.nextSibling) {
              a = a.nextSibling;
              break e;
            }
            a = a.parentNode;
          }
          a = void 0;
        }
        a = D0(a);
      }
    }
    function R0(e, t) {
      return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? R0(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
    }
    function yd(e) {
      e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
      for (var t = Un(e.document); t instanceof e.HTMLIFrameElement; ) {
        try {
          var a = typeof t.contentWindow.location.href == "string";
        } catch {
          a = !1;
        }
        if (a) e = t.contentWindow;
        else break;
        t = Un(e.document);
      }
      return t;
    }
    function jm(e) {
      var t = e && e.nodeName && e.nodeName.toLowerCase();
      return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
    }
    function M0(e, t, a) {
      var i = a.window === a ? a.document : a.nodeType === 9 ? a : a.ownerDocument;
      g1 || Kh == null || Kh !== Un(i) || (i = Kh, "selectionStart" in i && jm(i) ? i = { start: i.selectionStart, end: i.selectionEnd } : (i = (i.ownerDocument && i.ownerDocument.defaultView || window).getSelection(), i = {
        anchorNode: i.anchorNode,
        anchorOffset: i.anchorOffset,
        focusNode: i.focusNode,
        focusOffset: i.focusOffset
      }), Up && Qo(Up, i) || (Up = i, i = Wn(p1, "onSelect"), 0 < i.length && (t = new Kg(
        "onSelect",
        "select",
        null,
        t,
        a
      ), e.push({ event: t, listeners: i }), t.target = Kh)));
    }
    function Rc(e, t) {
      var a = {};
      return a[e.toLowerCase()] = t.toLowerCase(), a["Webkit" + e] = "webkit" + t, a["Moz" + e] = "moz" + t, a;
    }
    function Mc(e) {
      if (v1[e]) return v1[e];
      if (!$h[e]) return e;
      var t = $h[e], a;
      for (a in t)
        if (t.hasOwnProperty(a) && a in Ub)
          return v1[e] = t[a];
      return e;
    }
    function Hn(e, t) {
      Bb.set(e, t), nt(t, [e]);
    }
    function C0(e) {
      for (var t = kg, a = 0; a < e.length; a++) {
        var i = e[a];
        if (typeof i == "object" && i !== null)
          if (Al(i) && i.length === 2 && typeof i[0] == "string") {
            if (t !== kg && t !== A1)
              return E1;
            t = A1;
          } else return E1;
        else {
          if (typeof i == "function" || typeof i == "string" && 50 < i.length || t !== kg && t !== T1)
            return E1;
          t = T1;
        }
      }
      return t;
    }
    function wm(e, t, a, i) {
      for (var o in e)
        un.call(e, o) && o[0] !== "_" && mu(o, e[o], t, a, i);
    }
    function mu(e, t, a, i, o) {
      switch (typeof t) {
        case "object":
          if (t === null) {
            t = "null";
            break;
          } else {
            if (t.$$typeof === Dn) {
              var f = We(t.type) || "…", d = t.key;
              t = t.props;
              var h = Object.keys(t), y = h.length;
              if (d == null && y === 0) {
                t = "<" + f + " />";
                break;
              }
              if (3 > i || y === 1 && h[0] === "children" && d == null) {
                t = "<" + f + " … />";
                break;
              }
              a.push([
                o + "  ".repeat(i) + e,
                "<" + f
              ]), d !== null && mu(
                "key",
                d,
                a,
                i + 1,
                o
              ), e = !1;
              for (var p in t)
                p === "children" ? t.children != null && (!Al(t.children) || 0 < t.children.length) && (e = !0) : un.call(t, p) && p[0] !== "_" && mu(
                  p,
                  t[p],
                  a,
                  i + 1,
                  o
                );
              a.push([
                "",
                e ? ">…</" + f + ">" : "/>"
              ]);
              return;
            }
            if (f = Object.prototype.toString.call(t), f = f.slice(8, f.length - 1), f === "Array") {
              if (p = C0(t), p === T1 || p === kg) {
                t = JSON.stringify(t);
                break;
              } else if (p === A1) {
                for (a.push([
                  o + "  ".repeat(i) + e,
                  ""
                ]), e = 0; e < t.length; e++)
                  f = t[e], mu(
                    f[0],
                    f[1],
                    a,
                    i + 1,
                    o
                  );
                return;
              }
            }
            if (f === "Promise") {
              if (t.status === "fulfilled") {
                if (f = a.length, mu(
                  e,
                  t.value,
                  a,
                  i,
                  o
                ), a.length > f) {
                  a = a[f], a[1] = "Promise<" + (a[1] || "Object") + ">";
                  return;
                }
              } else if (t.status === "rejected" && (f = a.length, mu(
                e,
                t.reason,
                a,
                i,
                o
              ), a.length > f)) {
                a = a[f], a[1] = "Rejected Promise<" + a[1] + ">";
                return;
              }
              a.push([
                "  ".repeat(i) + e,
                "Promise"
              ]);
              return;
            }
            f === "Object" && (p = Object.getPrototypeOf(t)) && typeof p.constructor == "function" && (f = p.constructor.name), a.push([
              o + "  ".repeat(i) + e,
              f === "Object" ? 3 > i ? "" : "…" : f
            ]), 3 > i && wm(t, a, i + 1, o);
            return;
          }
        case "function":
          t = t.name === "" ? "() => {}" : t.name + "() {}";
          break;
        case "string":
          t = t === LE ? "…" : JSON.stringify(t);
          break;
        case "undefined":
          t = "undefined";
          break;
        case "boolean":
          t = t ? "true" : "false";
          break;
        default:
          t = String(t);
      }
      a.push([
        o + "  ".repeat(i) + e,
        t
      ]);
    }
    function x0(e, t, a, i) {
      var o = !0;
      for (d in e)
        d in t || (a.push([
          Wg + "  ".repeat(i) + d,
          "…"
        ]), o = !1);
      for (var f in t)
        if (f in e) {
          var d = e[f], h = t[f];
          if (d !== h) {
            if (i === 0 && f === "children")
              o = "  ".repeat(i) + f, a.push(
                [Wg + o, "…"],
                [Fg + o, "…"]
              );
            else {
              if (!(3 <= i)) {
                if (typeof d == "object" && typeof h == "object" && d !== null && h !== null && d.$$typeof === h.$$typeof)
                  if (h.$$typeof === Dn) {
                    if (d.type === h.type && d.key === h.key) {
                      d = We(h.type) || "…", o = "  ".repeat(i) + f, d = "<" + d + " … />", a.push(
                        [Wg + o, d],
                        [Fg + o, d]
                      ), o = !1;
                      continue;
                    }
                  } else {
                    var y = Object.prototype.toString.call(d), p = Object.prototype.toString.call(h);
                    if (y === p && (p === "[object Object]" || p === "[object Array]")) {
                      y = [
                        Gb + "  ".repeat(i) + f,
                        p === "[object Array]" ? "Array" : ""
                      ], a.push(y), p = a.length, x0(
                        d,
                        h,
                        a,
                        i + 1
                      ) ? p === a.length && (y[1] = "Referentially unequal but deeply equal objects. Consider memoization.") : o = !1;
                      continue;
                    }
                  }
                else if (typeof d == "function" && typeof h == "function" && d.name === h.name && d.length === h.length && (y = Function.prototype.toString.call(d), p = Function.prototype.toString.call(h), y === p)) {
                  d = h.name === "" ? "() => {}" : h.name + "() {}", a.push([
                    Gb + "  ".repeat(i) + f,
                    d + " Referentially unequal function closure. Consider memoization."
                  ]);
                  continue;
                }
              }
              mu(f, d, a, i, Wg), mu(f, h, a, i, Fg);
            }
            o = !1;
          }
        } else
          a.push([
            Fg + "  ".repeat(i) + f,
            "…"
          ]), o = !1;
      return o;
    }
    function jn(e) {
      ht = e & 63 ? "Blocking" : e & 64 ? "Gesture" : e & 4194176 ? "Transition" : e & 62914560 ? "Suspense" : e & 2080374784 ? "Idle" : "Other";
    }
    function pn(e, t, a, i) {
      tl && (Zf.start = t, Zf.end = a, yo.color = "warning", yo.tooltipText = i, yo.properties = null, (e = e._debugTask) ? e.run(
        performance.measure.bind(
          performance,
          i,
          Zf
        )
      ) : performance.measure(i, Zf));
    }
    function pd(e, t, a) {
      pn(e, t, a, "Reconnect");
    }
    function gd(e, t, a, i, o) {
      var f = pe(e);
      if (f !== null && tl) {
        var d = e.alternate, h = e.actualDuration;
        if (d === null || d.child !== e.child)
          for (var y = e.child; y !== null; y = y.sibling)
            h -= y.actualDuration;
        i = 0.5 > h ? i ? "tertiary-light" : "primary-light" : 10 > h ? i ? "tertiary" : "primary" : 100 > h ? i ? "tertiary-dark" : "primary-dark" : "error";
        var p = e.memoizedProps;
        h = e._debugTask, p !== null && d !== null && d.memoizedProps !== p ? (y = [XE], p = x0(
          d.memoizedProps,
          p,
          y,
          0
        ), 1 < y.length && (p && !Vf && (d.lanes & o) === 0 && 100 < e.actualDuration ? (Vf = !0, y[0] = QE, yo.color = "warning", yo.tooltipText = Lb) : (yo.color = i, yo.tooltipText = f), yo.properties = y, Zf.start = t, Zf.end = a, h != null ? h.run(
          performance.measure.bind(
            performance,
            "​" + f,
            Zf
          )
        ) : performance.measure(
          "​" + f,
          Zf
        ))) : h != null ? h.run(
          console.timeStamp.bind(
            console,
            f,
            t,
            a,
            Lu,
            void 0,
            i
          )
        ) : console.timeStamp(
          f,
          t,
          a,
          Lu,
          void 0,
          i
        );
      }
    }
    function Bm(e, t, a, i) {
      if (tl) {
        var o = pe(e);
        if (o !== null) {
          for (var f = null, d = [], h = 0; h < i.length; h++) {
            var y = i[h];
            f == null && y.source !== null && (f = y.source._debugTask), y = y.value, d.push([
              "Error",
              typeof y == "object" && y !== null && typeof y.message == "string" ? String(y.message) : String(y)
            ]);
          }
          e.key !== null && mu("key", e.key, d, 0, ""), e.memoizedProps !== null && wm(e.memoizedProps, d, 0, ""), f == null && (f = e._debugTask), e = {
            start: t,
            end: a,
            detail: {
              devtools: {
                color: "error",
                track: Lu,
                tooltipText: e.tag === 13 ? "Hydration failed" : "Error boundary caught an error",
                properties: d
              }
            }
          }, f ? f.run(
            performance.measure.bind(performance, "​" + o, e)
          ) : performance.measure("​" + o, e);
        }
      }
    }
    function wn(e, t, a, i, o) {
      if (o !== null) {
        if (tl) {
          var f = pe(e);
          if (f !== null) {
            i = [];
            for (var d = 0; d < o.length; d++) {
              var h = o[d].value;
              i.push([
                "Error",
                typeof h == "object" && h !== null && typeof h.message == "string" ? String(h.message) : String(h)
              ]);
            }
            e.key !== null && mu("key", e.key, i, 0, ""), e.memoizedProps !== null && wm(e.memoizedProps, i, 0, ""), t = {
              start: t,
              end: a,
              detail: {
                devtools: {
                  color: "error",
                  track: Lu,
                  tooltipText: "A lifecycle or effect errored",
                  properties: i
                }
              }
            }, (e = e._debugTask) ? e.run(
              performance.measure.bind(
                performance,
                "​" + f,
                t
              )
            ) : performance.measure("​" + f, t);
          }
        }
      } else
        f = pe(e), f !== null && tl && (o = 1 > i ? "secondary-light" : 100 > i ? "secondary" : 500 > i ? "secondary-dark" : "error", (e = e._debugTask) ? e.run(
          console.timeStamp.bind(
            console,
            f,
            t,
            a,
            Lu,
            void 0,
            o
          )
        ) : console.timeStamp(
          f,
          t,
          a,
          Lu,
          void 0,
          o
        ));
    }
    function Fv(e, t, a, i) {
      if (tl && !(t <= e)) {
        var o = (a & 738197653) === a ? "tertiary-dark" : "primary-dark";
        a = (a & 536870912) === a ? "Prepared" : (a & 201326741) === a ? "Hydrated" : "Render", i ? i.run(
          console.timeStamp.bind(
            console,
            a,
            e,
            t,
            ht,
            rt,
            o
          )
        ) : console.timeStamp(
          a,
          e,
          t,
          ht,
          rt,
          o
        );
      }
    }
    function U0(e, t, a, i) {
      !tl || t <= e || (a = (a & 738197653) === a ? "tertiary-dark" : "primary-dark", i ? i.run(
        console.timeStamp.bind(
          console,
          "Prewarm",
          e,
          t,
          ht,
          rt,
          a
        )
      ) : console.timeStamp(
        "Prewarm",
        e,
        t,
        ht,
        rt,
        a
      ));
    }
    function N0(e, t, a, i) {
      !tl || t <= e || (a = (a & 738197653) === a ? "tertiary-dark" : "primary-dark", i ? i.run(
        console.timeStamp.bind(
          console,
          "Suspended",
          e,
          t,
          ht,
          rt,
          a
        )
      ) : console.timeStamp(
        "Suspended",
        e,
        t,
        ht,
        rt,
        a
      ));
    }
    function Iv(e, t, a, i, o, f) {
      if (tl && !(t <= e)) {
        a = [];
        for (var d = 0; d < i.length; d++) {
          var h = i[d].value;
          a.push([
            "Recoverable Error",
            typeof h == "object" && h !== null && typeof h.message == "string" ? String(h.message) : String(h)
          ]);
        }
        e = {
          start: e,
          end: t,
          detail: {
            devtools: {
              color: "primary-dark",
              track: ht,
              trackGroup: rt,
              tooltipText: o ? "Hydration Failed" : "Recovered after Error",
              properties: a
            }
          }
        }, f ? f.run(
          performance.measure.bind(performance, "Recovered", e)
        ) : performance.measure("Recovered", e);
      }
    }
    function Ym(e, t, a, i) {
      !tl || t <= e || (i ? i.run(
        console.timeStamp.bind(
          console,
          "Errored",
          e,
          t,
          ht,
          rt,
          "error"
        )
      ) : console.timeStamp(
        "Errored",
        e,
        t,
        ht,
        rt,
        "error"
      ));
    }
    function Pv(e, t, a, i) {
      !tl || t <= e || (i ? i.run(
        console.timeStamp.bind(
          console,
          a,
          e,
          t,
          ht,
          rt,
          "secondary-light"
        )
      ) : console.timeStamp(
        a,
        e,
        t,
        ht,
        rt,
        "secondary-light"
      ));
    }
    function H0(e, t, a, i, o) {
      if (tl && !(t <= e)) {
        for (var f = [], d = 0; d < a.length; d++) {
          var h = a[d].value;
          f.push([
            "Error",
            typeof h == "object" && h !== null && typeof h.message == "string" ? String(h.message) : String(h)
          ]);
        }
        e = {
          start: e,
          end: t,
          detail: {
            devtools: {
              color: "error",
              track: ht,
              trackGroup: rt,
              tooltipText: i ? "Remaining Effects Errored" : "Commit Errored",
              properties: f
            }
          }
        }, o ? o.run(
          performance.measure.bind(performance, "Errored", e)
        ) : performance.measure("Errored", e);
      }
    }
    function qm(e, t, a) {
      !tl || t <= e || console.timeStamp(
        "Animating",
        e,
        t,
        ht,
        rt,
        "secondary-dark"
      );
    }
    function vd() {
      for (var e = kh, t = O1 = kh = 0; t < e; ) {
        var a = Xu[t];
        Xu[t++] = null;
        var i = Xu[t];
        Xu[t++] = null;
        var o = Xu[t];
        Xu[t++] = null;
        var f = Xu[t];
        if (Xu[t++] = null, i !== null && o !== null) {
          var d = i.pending;
          d === null ? o.next = o : (o.next = d.next, d.next = o), i.pending = o;
        }
        f !== 0 && Gm(a, o, f);
      }
    }
    function Vo(e, t, a, i) {
      Xu[kh++] = e, Xu[kh++] = t, Xu[kh++] = a, Xu[kh++] = i, O1 |= i, e.lanes |= i, e = e.alternate, e !== null && (e.lanes |= i);
    }
    function Cc(e, t, a, i) {
      return Vo(e, t, a, i), Os(e);
    }
    function aa(e, t) {
      return Vo(e, null, null, t), Os(e);
    }
    function Gm(e, t, a) {
      e.lanes |= a;
      var i = e.alternate;
      i !== null && (i.lanes |= a);
      for (var o = !1, f = e.return; f !== null; )
        f.childLanes |= a, i = f.alternate, i !== null && (i.childLanes |= a), f.tag === 22 && (e = f.stateNode, e === null || e._visibility & Np || (o = !0)), e = f, f = f.return;
      return e.tag === 3 ? (f = e.stateNode, o && t !== null && (o = 31 - Fl(a), e = f.hiddenUpdates, i = e[o], i === null ? e[o] = [t] : i.push(t), t.lane = a | 536870912), f) : null;
    }
    function Os(e) {
      if (i0 > uT)
        throw Jr = i0 = 0, c0 = ab = null, Error(
          "Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops."
        );
      Jr > iT && (Jr = 0, c0 = null, console.error(
        "Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render."
      )), e.alternate === null && (e.flags & 4098) !== 0 && zn(e);
      for (var t = e, a = t.return; a !== null; )
        t.alternate === null && (t.flags & 4098) !== 0 && zn(e), t = a, a = t.return;
      return t.tag === 3 ? t.stateNode : null;
    }
    function Bi(e) {
      if (Qu === null) return e;
      var t = Qu(e);
      return t === void 0 ? e : t.current;
    }
    function bd(e) {
      if (Qu === null) return e;
      var t = Qu(e);
      return t === void 0 ? e != null && typeof e.render == "function" && (t = Bi(e.render), e.render !== t) ? (t = { $$typeof: Uf, render: t }, e.displayName !== void 0 && (t.displayName = e.displayName), t) : e : t.current;
    }
    function Lm(e, t) {
      if (Qu === null) return !1;
      var a = e.elementType;
      t = t.type;
      var i = !1, o = typeof t == "object" && t !== null ? t.$$typeof : null;
      switch (e.tag) {
        case 1:
          typeof t == "function" && (i = !0);
          break;
        case 0:
          (typeof t == "function" || o === ia) && (i = !0);
          break;
        case 11:
          (o === Uf || o === ia) && (i = !0);
          break;
        case 14:
        case 15:
          (o === Or || o === ia) && (i = !0);
          break;
        default:
          return !1;
      }
      return !!(i && (e = Qu(a), e !== void 0 && e === Qu(t)));
    }
    function xc(e) {
      Qu !== null && typeof WeakSet == "function" && (Wh === null && (Wh = /* @__PURE__ */ new WeakSet()), Wh.add(e));
    }
    function j0(e, t, a) {
      do {
        var i = e, o = i.alternate, f = i.child, d = i.sibling, h = i.tag;
        i = i.type;
        var y = null;
        switch (h) {
          case 0:
          case 15:
          case 1:
            y = i;
            break;
          case 11:
            y = i.render;
        }
        if (Qu === null)
          throw Error("Expected resolveFamily to be set during hot reload.");
        var p = !1;
        if (i = !1, y !== null && (y = Qu(y), y !== void 0 && (a.has(y) ? i = !0 : t.has(y) && (h === 1 ? i = !0 : p = !0))), Wh !== null && (Wh.has(e) || o !== null && Wh.has(o)) && (i = !0), i && (e._debugNeedsRemount = !0), (i || p) && (o = aa(e, 2), o !== null && Ge(o, e, 2)), f === null || i || j0(
          f,
          t,
          a
        ), d === null) break;
        e = d;
      } while (!0);
    }
    function e1(e, t, a, i) {
      this.tag = e, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = i, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null, this.actualDuration = -0, this.actualStartTime = -1.1, this.treeBaseDuration = this.selfBaseDuration = -0, this._debugTask = this._debugStack = this._debugOwner = this._debugInfo = null, this._debugNeedsRemount = !1, this._debugHookTypes = null, Xb || typeof Object.preventExtensions != "function" || Object.preventExtensions(this);
    }
    function Xm(e) {
      return e = e.prototype, !(!e || !e.isReactComponent);
    }
    function yu(e, t) {
      var a = e.alternate;
      switch (a === null ? (a = C(
        e.tag,
        t,
        e.key,
        e.mode
      ), a.elementType = e.elementType, a.type = e.type, a.stateNode = e.stateNode, a._debugOwner = e._debugOwner, a._debugStack = e._debugStack, a._debugTask = e._debugTask, a._debugHookTypes = e._debugHookTypes, a.alternate = e, e.alternate = a) : (a.pendingProps = t, a.type = e.type, a.flags = 0, a.subtreeFlags = 0, a.deletions = null, a.actualDuration = -0, a.actualStartTime = -1.1), a.flags = e.flags & 65011712, a.childLanes = e.childLanes, a.lanes = e.lanes, a.child = e.child, a.memoizedProps = e.memoizedProps, a.memoizedState = e.memoizedState, a.updateQueue = e.updateQueue, t = e.dependencies, a.dependencies = t === null ? null : {
        lanes: t.lanes,
        firstContext: t.firstContext,
        _debugThenableState: t._debugThenableState
      }, a.sibling = e.sibling, a.index = e.index, a.ref = e.ref, a.refCleanup = e.refCleanup, a.selfBaseDuration = e.selfBaseDuration, a.treeBaseDuration = e.treeBaseDuration, a._debugInfo = e._debugInfo, a._debugNeedsRemount = e._debugNeedsRemount, a.tag) {
        case 0:
        case 15:
          a.type = Bi(e.type);
          break;
        case 1:
          a.type = Bi(e.type);
          break;
        case 11:
          a.type = bd(e.type);
      }
      return a;
    }
    function Qm(e, t) {
      e.flags &= 65011714;
      var a = e.alternate;
      return a === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null, e.selfBaseDuration = 0, e.treeBaseDuration = 0) : (e.childLanes = a.childLanes, e.lanes = a.lanes, e.child = a.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = a.memoizedProps, e.memoizedState = a.memoizedState, e.updateQueue = a.updateQueue, e.type = a.type, t = a.dependencies, e.dependencies = t === null ? null : {
        lanes: t.lanes,
        firstContext: t.firstContext,
        _debugThenableState: t._debugThenableState
      }, e.selfBaseDuration = a.selfBaseDuration, e.treeBaseDuration = a.treeBaseDuration), e;
    }
    function Uc(e, t, a, i, o, f) {
      var d = 0, h = e;
      if (typeof e == "function")
        Xm(e) && (d = 1), h = Bi(h);
      else if (typeof e == "string")
        d = Z(), d = Cg(e, a, d) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
      else
        e: switch (e) {
          case eu:
            return t = C(31, a, t, o), t.elementType = eu, t.lanes = f, t;
          case xf:
            return Nc(
              a.children,
              o,
              f,
              t
            );
          case za:
            d = 8, o |= wa, o |= Ti;
            break;
          case Ar:
            return e = a, i = o, typeof e.id != "string" && console.error(
              'Profiler must specify an "id" of type `string` as a prop. Received the type `%s` instead.',
              typeof e.id
            ), t = C(12, e, t, i | tt), t.elementType = Ar, t.lanes = f, t.stateNode = { effectDuration: 0, passiveEffectDuration: 0 }, t;
          case fo:
            return t = C(13, a, t, o), t.elementType = fo, t.lanes = f, t;
          case Ha:
            return t = C(19, a, t, o), t.elementType = Ha, t.lanes = f, t;
          default:
            if (typeof e == "object" && e !== null)
              switch (e.$$typeof) {
                case Pn:
                  d = 10;
                  break e;
                case xh:
                  d = 9;
                  break e;
                case Uf:
                  d = 11, h = bd(h);
                  break e;
                case Or:
                  d = 14;
                  break e;
                case ia:
                  d = 16, h = null;
                  break e;
              }
            h = "", (e === void 0 || typeof e == "object" && e !== null && Object.keys(e).length === 0) && (h += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports."), e === null ? a = "null" : Al(e) ? a = "array" : e !== void 0 && e.$$typeof === Dn ? (a = "<" + (We(e.type) || "Unknown") + " />", h = " Did you accidentally export a JSX literal instead of a component?") : a = typeof e, (d = i ? Ct(i) : null) && (h += `

Check the render method of \`` + d + "`."), d = 29, a = Error(
              "Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: " + (a + "." + h)
            ), h = null;
        }
      return t = C(d, a, t, o), t.elementType = e, t.type = h, t.lanes = f, t._debugOwner = i, t;
    }
    function Yi(e, t, a) {
      return t = Uc(
        e.type,
        e.key,
        e.props,
        e._owner,
        t,
        a
      ), t._debugOwner = e._owner, t._debugStack = e._debugStack, t._debugTask = e._debugTask, t;
    }
    function Nc(e, t, a, i) {
      return e = C(7, e, i, t), e.lanes = a, e;
    }
    function Zo(e, t, a) {
      return e = C(6, e, null, t), e.lanes = a, e;
    }
    function Vm(e) {
      var t = C(18, null, null, qe);
      return t.stateNode = e, t;
    }
    function Sd(e, t, a) {
      return t = C(
        4,
        e.children !== null ? e.children : [],
        e.key,
        t
      ), t.lanes = a, t.stateNode = {
        containerInfo: e.containerInfo,
        pendingChildren: null,
        implementation: e.implementation
      }, t;
    }
    function da(e, t) {
      if (typeof e == "object" && e !== null) {
        var a = z1.get(e);
        return a !== void 0 ? a : (t = {
          value: e,
          source: t,
          stack: Me(t)
        }, z1.set(e, t), t);
      }
      return {
        value: e,
        source: t,
        stack: Me(t)
      };
    }
    function Bn(e, t) {
      qi(), Fh[Ih++] = Hp, Fh[Ih++] = Ig, Ig = e, Hp = t;
    }
    function Zm(e, t, a) {
      qi(), Vu[Zu++] = go, Vu[Zu++] = vo, Vu[Zu++] = xr, xr = e;
      var i = go;
      e = vo;
      var o = 32 - Fl(i) - 1;
      i &= ~(1 << o), a += 1;
      var f = 32 - Fl(t) + o;
      if (30 < f) {
        var d = o - o % 5;
        f = (i & (1 << d) - 1).toString(32), i >>= d, o -= d, go = 1 << 32 - Fl(t) + o | a << o | i, vo = f + e;
      } else
        go = 1 << f | a << o | i, vo = e;
    }
    function Ed(e) {
      qi(), e.return !== null && (Bn(e, 1), Zm(e, 1, 0));
    }
    function Td(e) {
      for (; e === Ig; )
        Ig = Fh[--Ih], Fh[Ih] = null, Hp = Fh[--Ih], Fh[Ih] = null;
      for (; e === xr; )
        xr = Vu[--Zu], Vu[Zu] = null, vo = Vu[--Zu], Vu[Zu] = null, go = Vu[--Zu], Vu[Zu] = null;
    }
    function w0() {
      return qi(), xr !== null ? { id: go, overflow: vo } : null;
    }
    function B0(e, t) {
      qi(), Vu[Zu++] = go, Vu[Zu++] = vo, Vu[Zu++] = xr, go = t.id, vo = t.overflow, xr = e;
    }
    function qi() {
      st || console.error(
        "Expected to be hydrating. This is a bug in React. Please file an issue."
      );
    }
    function Hc(e, t) {
      if (e.return === null) {
        if (lu === null)
          lu = {
            fiber: e,
            children: [],
            serverProps: void 0,
            serverTail: [],
            distanceFromLeaf: t
          };
        else {
          if (lu.fiber !== e)
            throw Error(
              "Saw multiple hydration diff roots in a pass. This is a bug in React."
            );
          lu.distanceFromLeaf > t && (lu.distanceFromLeaf = t);
        }
        return lu;
      }
      var a = Hc(
        e.return,
        t + 1
      ).children;
      return 0 < a.length && a[a.length - 1].fiber === e ? (a = a[a.length - 1], a.distanceFromLeaf > t && (a.distanceFromLeaf = t), a) : (t = {
        fiber: e,
        children: [],
        serverProps: void 0,
        serverTail: [],
        distanceFromLeaf: t
      }, a.push(t), t);
    }
    function Y0() {
      st && console.error(
        "We should not be hydrating here. This is a bug in React. Please file a bug."
      );
    }
    function na(e, t) {
      yc || (e = Hc(e, 0), e.serverProps = null, t !== null && (t = Dg(t), e.serverTail.push(t)));
    }
    function gn(e) {
      var t = 1 < arguments.length && arguments[1] !== void 0 ? arguments[1] : !1, a = "", i = lu;
      throw i !== null && (lu = null, a = zm(i)), Ds(
        da(
          Error(
            "Hydration failed because the server rendered " + (t ? "text" : "HTML") + ` didn't match the client. As a result this tree will be regenerated on the client. This can happen if a SSR-ed Client Component used:

- A server/client branch \`if (typeof window !== 'undefined')\`.
- Variable input such as \`Date.now()\` or \`Math.random()\` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

https://react.dev/link/hydration-mismatch` + a
          ),
          e
        )
      ), D1;
    }
    function Jm(e) {
      var t = e.stateNode, a = e.type, i = e.memoizedProps;
      switch (t[el] = e, t[Da] = i, Aa(a, i), a) {
        case "dialog":
          Ye("cancel", t), Ye("close", t);
          break;
        case "iframe":
        case "object":
        case "embed":
          Ye("load", t);
          break;
        case "video":
        case "audio":
          for (a = 0; a < o0.length; a++)
            Ye(o0[a], t);
          break;
        case "source":
          Ye("error", t);
          break;
        case "img":
        case "image":
        case "link":
          Ye("error", t), Ye("load", t);
          break;
        case "details":
          Ye("toggle", t);
          break;
        case "input":
          la("input", i), Ye("invalid", t), ra(t, i), ad(
            t,
            i.value,
            i.defaultValue,
            i.checked,
            i.defaultChecked,
            i.type,
            i.name,
            !0
          );
          break;
        case "option":
          E0(t, i);
          break;
        case "select":
          la("select", i), Ye("invalid", t), nd(t, i);
          break;
        case "textarea":
          la("textarea", i), Ye("invalid", t), Tc(t, i), jo(
            t,
            i.value,
            i.defaultValue,
            i.children
          );
      }
      a = i.children, typeof a != "string" && typeof a != "number" && typeof a != "bigint" || t.textContent === "" + a || i.suppressHydrationWarning === !0 || $y(t.textContent, a) ? (i.popover != null && (Ye("beforetoggle", t), Ye("toggle", t)), i.onScroll != null && Ye("scroll", t), i.onScrollEnd != null && Ye("scrollend", t), i.onClick != null && (t.onclick = yn), t = !0) : t = !1, t || gn(e, !0);
    }
    function Km(e) {
      for (_a = e.return; _a; )
        switch (_a.tag) {
          case 5:
          case 31:
          case 13:
            Ju = !1;
            return;
          case 27:
          case 3:
            Ju = !0;
            return;
          default:
            _a = _a.return;
        }
    }
    function jc(e) {
      if (e !== _a) return !1;
      if (!st)
        return Km(e), st = !0, !1;
      var t = e.tag, a;
      if ((a = t !== 3 && t !== 27) && ((a = t === 5) && (a = e.type, a = !(a !== "form" && a !== "button") || Af(e.type, e.memoizedProps)), a = !a), a && ll) {
        for (a = ll; a; ) {
          var i = Hc(e, 0), o = Dg(a);
          i.serverTail.push(o), a = o.type === "Suspense" ? Df(a) : an(a.nextSibling);
        }
        gn(e);
      }
      if (Km(e), t === 13) {
        if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e)
          throw Error(
            "Expected to have a hydrated suspense instance. This error is likely caused by a bug in React. Please file an issue."
          );
        ll = Df(e);
      } else if (t === 31) {
        if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e)
          throw Error(
            "Expected to have a hydrated suspense instance. This error is likely caused by a bug in React. Please file an issue."
          );
        ll = Df(e);
      } else
        t === 27 ? (t = ll, oc(e.type) ? (e = yb, yb = null, ll = e) : ll = t) : ll = _a ? an(e.stateNode.nextSibling) : null;
      return !0;
    }
    function Gi() {
      ll = _a = null, yc = st = !1;
    }
    function zs() {
      var e = Kf;
      return e !== null && (dn === null ? dn = e : dn.push.apply(
        dn,
        e
      ), Kf = null), e;
    }
    function Ds(e) {
      Kf === null ? Kf = [e] : Kf.push(e);
    }
    function Li() {
      var e = lu;
      if (e !== null) {
        lu = null;
        for (var t = zm(e); 0 < e.children.length; )
          e = e.children[0];
        de(e.fiber, function() {
          console.error(
            `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:

- A server/client branch \`if (typeof window !== 'undefined')\`.
- Variable input such as \`Date.now()\` or \`Math.random()\` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

%s%s`,
            "https://react.dev/link/hydration-mismatch",
            t
          );
        });
      }
    }
    function Jo() {
      Ph = Pg = null, em = !1;
    }
    function vn(e, t, a) {
      Ve(_1, t._currentValue, e), t._currentValue = a, Ve(R1, t._currentRenderer, e), t._currentRenderer !== void 0 && t._currentRenderer !== null && t._currentRenderer !== Vb && console.error(
        "Detected multiple renderers concurrently rendering the same context provider. This is currently unsupported."
      ), t._currentRenderer = Vb;
    }
    function Yn(e, t) {
      e._currentValue = _1.current;
      var a = R1.current;
      Ae(R1, t), e._currentRenderer = a, Ae(_1, t);
    }
    function Ad(e, t, a) {
      for (; e !== null; ) {
        var i = e.alternate;
        if ((e.childLanes & t) !== t ? (e.childLanes |= t, i !== null && (i.childLanes |= t)) : i !== null && (i.childLanes & t) !== t && (i.childLanes |= t), e === a) break;
        e = e.return;
      }
      e !== a && console.error(
        "Expected to find the propagation root when scheduling context work. This error is likely caused by a bug in React. Please file an issue."
      );
    }
    function li(e, t, a, i) {
      var o = e.child;
      for (o !== null && (o.return = e); o !== null; ) {
        var f = o.dependencies;
        if (f !== null) {
          var d = o.child;
          f = f.firstContext;
          e: for (; f !== null; ) {
            var h = f;
            f = o;
            for (var y = 0; y < t.length; y++)
              if (h.context === t[y]) {
                f.lanes |= a, h = f.alternate, h !== null && (h.lanes |= a), Ad(
                  f.return,
                  a,
                  e
                ), i || (d = null);
                break e;
              }
            f = h.next;
          }
        } else if (o.tag === 18) {
          if (d = o.return, d === null)
            throw Error(
              "We just came from a parent so we must have had a parent. This is a bug in React."
            );
          d.lanes |= a, f = d.alternate, f !== null && (f.lanes |= a), Ad(
            d,
            a,
            e
          ), d = null;
        } else d = o.child;
        if (d !== null) d.return = o;
        else
          for (d = o; d !== null; ) {
            if (d === e) {
              d = null;
              break;
            }
            if (o = d.sibling, o !== null) {
              o.return = d.return, d = o;
              break;
            }
            d = d.return;
          }
        o = d;
      }
    }
    function qn(e, t, a, i) {
      e = null;
      for (var o = t, f = !1; o !== null; ) {
        if (!f) {
          if ((o.flags & 524288) !== 0) f = !0;
          else if ((o.flags & 262144) !== 0) break;
        }
        if (o.tag === 10) {
          var d = o.alternate;
          if (d === null)
            throw Error("Should have a current fiber. This is a bug in React.");
          if (d = d.memoizedProps, d !== null) {
            var h = o.type;
            on(o.pendingProps.value, d.value) || (e !== null ? e.push(h) : e = [h]);
          }
        } else if (o === dc.current) {
          if (d = o.alternate, d === null)
            throw Error("Should have a current fiber. This is a bug in React.");
          d.memoizedState.memoizedState !== o.memoizedState.memoizedState && (e !== null ? e.push(h0) : e = [h0]);
        }
        o = o.return;
      }
      e !== null && li(
        t,
        e,
        a,
        i
      ), t.flags |= 262144;
    }
    function Ko(e) {
      for (e = e.firstContext; e !== null; ) {
        if (!on(
          e.context._currentValue,
          e.memoizedValue
        ))
          return !0;
        e = e.next;
      }
      return !1;
    }
    function Xi(e) {
      Pg = e, Ph = null, e = e.dependencies, e !== null && (e.firstContext = null);
    }
    function Et(e) {
      return em && console.error(
        "Context can only be read while React is rendering. In classes, you can read it in the render method or getDerivedStateFromProps. In function components, you can read it directly in the function body, but not inside Hooks like useReducer() or useMemo()."
      ), $m(Pg, e);
    }
    function _s(e, t) {
      return Pg === null && Xi(e), $m(e, t);
    }
    function $m(e, t) {
      var a = t._currentValue;
      if (t = { context: t, memoizedValue: a, next: null }, Ph === null) {
        if (e === null)
          throw Error(
            "Context can only be read while React is rendering. In classes, you can read it in the render method or getDerivedStateFromProps. In function components, you can read it directly in the function body, but not inside Hooks like useReducer() or useMemo()."
          );
        Ph = t, e.dependencies = {
          lanes: 0,
          firstContext: t,
          _debugThenableState: null
        }, e.flags |= 524288;
      } else Ph = Ph.next = t;
      return a;
    }
    function Od() {
      return {
        controller: new JE(),
        data: /* @__PURE__ */ new Map(),
        refCount: 0
      };
    }
    function wc(e) {
      e.controller.signal.aborted && console.warn(
        "A cache instance was retained after it was already freed. This likely indicates a bug in React."
      ), e.refCount++;
    }
    function Rs(e) {
      e.refCount--, 0 > e.refCount && console.warn(
        "A cache instance was released after it was already freed. This likely indicates a bug in React."
      ), e.refCount === 0 && KE($E, function() {
        e.controller.abort();
      });
    }
    function pu(e, t, a) {
      (e & 127) !== 0 ? 0 > pc && (pc = Ql(), wp = ev(t), M1 = t, a != null && (C1 = pe(a)), (pt & (ea | uu)) !== sa && (bl = !0, kf = jp), e = Of(), t = ju(), e !== tm || t !== Bp ? tm = -1.1 : t !== null && (kf = jp), Hr = e, Bp = t) : (e & 4194048) !== 0 && 0 > Ku && (Ku = Ql(), Yp = ev(t), Zb = t, a != null && (Jb = pe(a)), 0 > To) && (e = Of(), t = ju(), (e !== Ff || t !== jr) && (Ff = -1.1), Wf = e, jr = t);
    }
    function q0(e) {
      if (0 > pc) {
        pc = Ql(), wp = e._debugTask != null ? e._debugTask : null, (pt & (ea | uu)) !== sa && (kf = jp);
        var t = Of(), a = ju();
        t !== tm || a !== Bp ? tm = -1.1 : a !== null && (kf = jp), Hr = t, Bp = a;
      }
      0 > Ku && (Ku = Ql(), Yp = e._debugTask != null ? e._debugTask : null, 0 > To) && (e = Of(), t = ju(), (e !== Ff || t !== jr) && (Ff = -1.1), Wf = e, jr = t);
    }
    function gu() {
      var e = Ur;
      return Ur = 0, e;
    }
    function $o(e) {
      var t = Ur;
      return Ur = e, t;
    }
    function ha(e) {
      var t = Ur;
      return Ur += e, t;
    }
    function Bc() {
      Be = Ce = -1.1;
    }
    function Ft() {
      var e = Ce;
      return Ce = -1.1, e;
    }
    function jl(e) {
      0 <= e && (Ce = e);
    }
    function bn() {
      var e = dl;
      return dl = -0, e;
    }
    function Za(e) {
      0 <= e && (dl = e);
    }
    function Ja() {
      var e = ol;
      return ol = null, e;
    }
    function Sn() {
      var e = bl;
      return bl = !1, e;
    }
    function ai(e) {
      fn = Ql(), 0 > e.actualStartTime && (e.actualStartTime = fn);
    }
    function zd(e) {
      if (0 <= fn) {
        var t = Ql() - fn;
        e.actualDuration += t, e.selfBaseDuration = t, fn = -1;
      }
    }
    function Ms(e) {
      if (0 <= fn) {
        var t = Ql() - fn;
        e.actualDuration += t, fn = -1;
      }
    }
    function ma() {
      if (0 <= fn) {
        var e = Ql(), t = e - fn;
        fn = -1, Ur += t, dl += t, Be = e;
      }
    }
    function G0(e) {
      ol === null && (ol = []), ol.push(e), So === null && (So = []), So.push(e);
    }
    function fl() {
      fn = Ql(), 0 > Ce && (Ce = fn);
    }
    function Yc(e) {
      for (var t = e.child; t; )
        e.actualDuration += t.actualDuration, t = t.sibling;
    }
    function ni(e, t) {
      if (Gp === null) {
        var a = Gp = [];
        U1 = 0, wr = Ky(), lm = {
          status: "pending",
          value: void 0,
          then: function(i) {
            a.push(i);
          }
        };
      }
      return U1++, t.then(km, km), t;
    }
    function km() {
      if (--U1 === 0 && (-1 < Ku || (To = -1.1), Gp !== null)) {
        lm !== null && (lm.status = "fulfilled");
        var e = Gp;
        Gp = null, wr = 0, lm = null;
        for (var t = 0; t < e.length; t++) (0, e[t])();
      }
    }
    function Dd(e, t) {
      var a = [], i = {
        status: "pending",
        value: null,
        reason: null,
        then: function(o) {
          a.push(o);
        }
      };
      return e.then(
        function() {
          i.status = "fulfilled", i.value = t;
          for (var o = 0; o < a.length; o++) (0, a[o])(t);
        },
        function(o) {
          for (i.status = "rejected", i.reason = o, o = 0; o < a.length; o++)
            (0, a[o])(void 0);
        }
      ), i;
    }
    function ui() {
      var e = Br.current;
      return e !== null ? e : Zt.pooledCache;
    }
    function ko(e, t) {
      t === null ? Ve(Br, Br.current, e) : Ve(Br, t.pool, e);
    }
    function Wm() {
      var e = ui();
      return e === null ? null : { parent: Xl._currentValue, pool: e };
    }
    function _d() {
      return { didWarnAboutUncachedPromise: !1, thenables: [] };
    }
    function Fm(e) {
      return e = e.status, e === "fulfilled" || e === "rejected";
    }
    function Ka(e, t, a) {
      L.actQueue !== null && (L.didUsePromise = !0);
      var i = e.thenables;
      if (a = i[a], a === void 0 ? i.push(t) : a !== t && (e.didWarnAboutUncachedPromise || (e.didWarnAboutUncachedPromise = !0, console.error(
        "A component was suspended by an uncached promise. Creating promises inside a Client Component or hook is not yet supported, except via a Suspense-compatible library or framework."
      )), t.then(yn, yn), t = a), t._debugInfo === void 0) {
        e = performance.now(), i = t.displayName;
        var o = {
          name: typeof i == "string" ? i : "Promise",
          start: e,
          end: e,
          value: t
        };
        t._debugInfo = [{ awaited: o }], t.status !== "fulfilled" && t.status !== "rejected" && (e = function() {
          o.end = performance.now();
        }, t.then(e, e));
      }
      switch (t.status) {
        case "fulfilled":
          return t.value;
        case "rejected":
          throw e = t.reason, Cs(e), e;
        default:
          if (typeof t.status == "string")
            t.then(yn, yn);
          else {
            if (e = Zt, e !== null && 100 < e.shellSuspendCounter)
              throw Error(
                "An unknown Component is an async Client Component. Only Server Components can be async at the moment. This error is often caused by accidentally adding `'use client'` to a module that was originally written for the server."
              );
            e = t, e.status = "pending", e.then(
              function(f) {
                if (t.status === "pending") {
                  var d = t;
                  d.status = "fulfilled", d.value = f;
                }
              },
              function(f) {
                if (t.status === "pending") {
                  var d = t;
                  d.status = "rejected", d.reason = f;
                }
              }
            );
          }
          switch (t.status) {
            case "fulfilled":
              return t.value;
            case "rejected":
              throw e = t.reason, Cs(e), e;
          }
          throw qr = t, Kp = !0, am;
      }
    }
    function $a(e) {
      try {
        return PE(e);
      } catch (t) {
        throw t !== null && typeof t == "object" && typeof t.then == "function" ? (qr = t, Kp = !0, am) : t;
      }
    }
    function qc() {
      if (qr === null)
        throw Error(
          "Expected a suspended thenable. This is a bug in React. Please file an issue."
        );
      var e = qr;
      return qr = null, Kp = !1, e;
    }
    function Cs(e) {
      if (e === am || e === ov)
        throw Error(
          "Hooks are not supported inside an async component. This error is often caused by accidentally adding `'use client'` to a module that was originally written for the server."
        );
    }
    function ml(e) {
      var t = lt;
      return e != null && (lt = t === null ? e : t.concat(e)), t;
    }
    function Ra() {
      var e = lt;
      if (e != null) {
        for (var t = e.length - 1; 0 <= t; t--)
          if (e[t].name != null) {
            var a = e[t].debugTask;
            if (a != null) return a;
          }
      }
      return null;
    }
    function ya(e, t, a) {
      for (var i = Object.keys(e.props), o = 0; o < i.length; o++) {
        var f = i[o];
        if (f !== "children" && f !== "key") {
          t === null && (t = Yi(e, a.mode, 0), t._debugInfo = lt, t.return = a), de(
            t,
            function(d) {
              console.error(
                "Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.",
                d
              );
            },
            f
          );
          break;
        }
      }
    }
    function Gn(e) {
      var t = $p;
      return $p += 1, nm === null && (nm = _d()), Ka(nm, e, t);
    }
    function Ma(e, t) {
      t = t.props.ref, e.ref = t !== void 0 ? t : null;
    }
    function Ln(e, t) {
      throw t.$$typeof === wg ? Error(
        `A React Element from an older version of React was rendered. This is not supported. It can happen if:
- Multiple copies of the "react" package is used.
- A library pre-bundled an old copy of "react" or "react/jsx-runtime".
- A compiler tries to "inline" JSX instead of using the runtime.`
      ) : (e = Object.prototype.toString.call(t), Error(
        "Objects are not valid as a React child (found: " + (e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e) + "). If you meant to render a collection of children, use an array instead."
      ));
    }
    function En(e, t) {
      var a = Ra();
      a !== null ? a.run(
        Ln.bind(null, e, t)
      ) : Ln(e, t);
    }
    function Im(e, t) {
      var a = pe(e) || "Component";
      dS[a] || (dS[a] = !0, t = t.displayName || t.name || "Component", e.tag === 3 ? console.error(
        `Functions are not valid as a React child. This may happen if you return %s instead of <%s /> from render. Or maybe you meant to call this function rather than return it.
  root.render(%s)`,
        t,
        t,
        t
      ) : console.error(
        `Functions are not valid as a React child. This may happen if you return %s instead of <%s /> from render. Or maybe you meant to call this function rather than return it.
  <%s>{%s}</%s>`,
        t,
        t,
        a,
        t,
        a
      ));
    }
    function Wo(e, t) {
      var a = Ra();
      a !== null ? a.run(
        Im.bind(null, e, t)
      ) : Im(e, t);
    }
    function Rd(e, t) {
      var a = pe(e) || "Component";
      hS[a] || (hS[a] = !0, t = String(t), e.tag === 3 ? console.error(
        `Symbols are not valid as a React child.
  root.render(%s)`,
        t
      ) : console.error(
        `Symbols are not valid as a React child.
  <%s>%s</%s>`,
        a,
        t,
        a
      ));
    }
    function xs(e, t) {
      var a = Ra();
      a !== null ? a.run(
        Rd.bind(null, e, t)
      ) : Rd(e, t);
    }
    function wl(e) {
      function t(S, T) {
        if (e) {
          var O = S.deletions;
          O === null ? (S.deletions = [T], S.flags |= 16) : O.push(T);
        }
      }
      function a(S, T) {
        if (!e) return null;
        for (; T !== null; )
          t(S, T), T = T.sibling;
        return null;
      }
      function i(S) {
        for (var T = /* @__PURE__ */ new Map(); S !== null; )
          S.key !== null ? T.set(S.key, S) : T.set(S.index, S), S = S.sibling;
        return T;
      }
      function o(S, T) {
        return S = yu(S, T), S.index = 0, S.sibling = null, S;
      }
      function f(S, T, O) {
        return S.index = O, e ? (O = S.alternate, O !== null ? (O = O.index, O < T ? (S.flags |= 67108866, T) : O) : (S.flags |= 67108866, T)) : (S.flags |= 1048576, T);
      }
      function d(S) {
        return e && S.alternate === null && (S.flags |= 67108866), S;
      }
      function h(S, T, O, J) {
        return T === null || T.tag !== 6 ? (T = Zo(
          O,
          S.mode,
          J
        ), T.return = S, T._debugOwner = S, T._debugTask = S._debugTask, T._debugInfo = lt, T) : (T = o(T, O), T.return = S, T._debugInfo = lt, T);
      }
      function y(S, T, O, J) {
        var re = O.type;
        return re === xf ? (T = z(
          S,
          T,
          O.props.children,
          J,
          O.key
        ), ya(O, T, S), T) : T !== null && (T.elementType === re || Lm(T, O) || typeof re == "object" && re !== null && re.$$typeof === ia && $a(re) === T.type) ? (T = o(T, O.props), Ma(T, O), T.return = S, T._debugOwner = O._owner, T._debugInfo = lt, T) : (T = Yi(O, S.mode, J), Ma(T, O), T.return = S, T._debugInfo = lt, T);
      }
      function p(S, T, O, J) {
        return T === null || T.tag !== 4 || T.stateNode.containerInfo !== O.containerInfo || T.stateNode.implementation !== O.implementation ? (T = Sd(O, S.mode, J), T.return = S, T._debugInfo = lt, T) : (T = o(T, O.children || []), T.return = S, T._debugInfo = lt, T);
      }
      function z(S, T, O, J, re) {
        return T === null || T.tag !== 7 ? (T = Nc(
          O,
          S.mode,
          J,
          re
        ), T.return = S, T._debugOwner = S, T._debugTask = S._debugTask, T._debugInfo = lt, T) : (T = o(T, O), T.return = S, T._debugInfo = lt, T);
      }
      function R(S, T, O) {
        if (typeof T == "string" && T !== "" || typeof T == "number" || typeof T == "bigint")
          return T = Zo(
            "" + T,
            S.mode,
            O
          ), T.return = S, T._debugOwner = S, T._debugTask = S._debugTask, T._debugInfo = lt, T;
        if (typeof T == "object" && T !== null) {
          switch (T.$$typeof) {
            case Dn:
              return O = Yi(
                T,
                S.mode,
                O
              ), Ma(O, T), O.return = S, S = ml(T._debugInfo), O._debugInfo = lt, lt = S, O;
            case sc:
              return T = Sd(
                T,
                S.mode,
                O
              ), T.return = S, T._debugInfo = lt, T;
            case ia:
              var J = ml(T._debugInfo);
              return T = $a(T), S = R(S, T, O), lt = J, S;
          }
          if (Al(T) || je(T))
            return O = Nc(
              T,
              S.mode,
              O,
              null
            ), O.return = S, O._debugOwner = S, O._debugTask = S._debugTask, S = ml(T._debugInfo), O._debugInfo = lt, lt = S, O;
          if (typeof T.then == "function")
            return J = ml(T._debugInfo), S = R(
              S,
              Gn(T),
              O
            ), lt = J, S;
          if (T.$$typeof === Pn)
            return R(
              S,
              _s(S, T),
              O
            );
          En(S, T);
        }
        return typeof T == "function" && Wo(S, T), typeof T == "symbol" && xs(S, T), null;
      }
      function E(S, T, O, J) {
        var re = T !== null ? T.key : null;
        if (typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint")
          return re !== null ? null : h(S, T, "" + O, J);
        if (typeof O == "object" && O !== null) {
          switch (O.$$typeof) {
            case Dn:
              return O.key === re ? (re = ml(O._debugInfo), S = y(
                S,
                T,
                O,
                J
              ), lt = re, S) : null;
            case sc:
              return O.key === re ? p(S, T, O, J) : null;
            case ia:
              return re = ml(O._debugInfo), O = $a(O), S = E(
                S,
                T,
                O,
                J
              ), lt = re, S;
          }
          if (Al(O) || je(O))
            return re !== null ? null : (re = ml(O._debugInfo), S = z(
              S,
              T,
              O,
              J,
              null
            ), lt = re, S);
          if (typeof O.then == "function")
            return re = ml(O._debugInfo), S = E(
              S,
              T,
              Gn(O),
              J
            ), lt = re, S;
          if (O.$$typeof === Pn)
            return E(
              S,
              T,
              _s(S, O),
              J
            );
          En(S, O);
        }
        return typeof O == "function" && Wo(S, O), typeof O == "symbol" && xs(S, O), null;
      }
      function q(S, T, O, J, re) {
        if (typeof J == "string" && J !== "" || typeof J == "number" || typeof J == "bigint")
          return S = S.get(O) || null, h(T, S, "" + J, re);
        if (typeof J == "object" && J !== null) {
          switch (J.$$typeof) {
            case Dn:
              return O = S.get(
                J.key === null ? O : J.key
              ) || null, S = ml(J._debugInfo), T = y(
                T,
                O,
                J,
                re
              ), lt = S, T;
            case sc:
              return S = S.get(
                J.key === null ? O : J.key
              ) || null, p(T, S, J, re);
            case ia:
              var Qe = ml(J._debugInfo);
              return J = $a(J), T = q(
                S,
                T,
                O,
                J,
                re
              ), lt = Qe, T;
          }
          if (Al(J) || je(J))
            return O = S.get(O) || null, S = ml(J._debugInfo), T = z(
              T,
              O,
              J,
              re,
              null
            ), lt = S, T;
          if (typeof J.then == "function")
            return Qe = ml(J._debugInfo), T = q(
              S,
              T,
              O,
              Gn(J),
              re
            ), lt = Qe, T;
          if (J.$$typeof === Pn)
            return q(
              S,
              T,
              O,
              _s(T, J),
              re
            );
          En(T, J);
        }
        return typeof J == "function" && Wo(T, J), typeof J == "symbol" && xs(T, J), null;
      }
      function se(S, T, O, J) {
        if (typeof O != "object" || O === null) return J;
        switch (O.$$typeof) {
          case Dn:
          case sc:
            me(S, T, O);
            var re = O.key;
            if (typeof re != "string") break;
            if (J === null) {
              J = /* @__PURE__ */ new Set(), J.add(re);
              break;
            }
            if (!J.has(re)) {
              J.add(re);
              break;
            }
            de(T, function() {
              console.error(
                "Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.",
                re
              );
            });
            break;
          case ia:
            O = $a(O), se(S, T, O, J);
        }
        return J;
      }
      function he(S, T, O, J) {
        for (var re = null, Qe = null, Re = null, ze = T, Pe = T = 0, al = null; ze !== null && Pe < O.length; Pe++) {
          ze.index > Pe ? (al = ze, ze = null) : al = ze.sibling;
          var Ul = E(
            S,
            ze,
            O[Pe],
            J
          );
          if (Ul === null) {
            ze === null && (ze = al);
            break;
          }
          re = se(
            S,
            Ul,
            O[Pe],
            re
          ), e && ze && Ul.alternate === null && t(S, ze), T = f(Ul, T, Pe), Re === null ? Qe = Ul : Re.sibling = Ul, Re = Ul, ze = al;
        }
        if (Pe === O.length)
          return a(S, ze), st && Bn(S, Pe), Qe;
        if (ze === null) {
          for (; Pe < O.length; Pe++)
            ze = R(S, O[Pe], J), ze !== null && (re = se(
              S,
              ze,
              O[Pe],
              re
            ), T = f(
              ze,
              T,
              Pe
            ), Re === null ? Qe = ze : Re.sibling = ze, Re = ze);
          return st && Bn(S, Pe), Qe;
        }
        for (ze = i(ze); Pe < O.length; Pe++)
          al = q(
            ze,
            S,
            Pe,
            O[Pe],
            J
          ), al !== null && (re = se(
            S,
            al,
            O[Pe],
            re
          ), e && al.alternate !== null && ze.delete(
            al.key === null ? Pe : al.key
          ), T = f(
            al,
            T,
            Pe
          ), Re === null ? Qe = al : Re.sibling = al, Re = al);
        return e && ze.forEach(function(Co) {
          return t(S, Co);
        }), st && Bn(S, Pe), Qe;
      }
      function Wt(S, T, O, J) {
        if (O == null)
          throw Error("An iterable object provided no iterator.");
        for (var re = null, Qe = null, Re = T, ze = T = 0, Pe = null, al = null, Ul = O.next(); Re !== null && !Ul.done; ze++, Ul = O.next()) {
          Re.index > ze ? (Pe = Re, Re = null) : Pe = Re.sibling;
          var Co = E(S, Re, Ul.value, J);
          if (Co === null) {
            Re === null && (Re = Pe);
            break;
          }
          al = se(
            S,
            Co,
            Ul.value,
            al
          ), e && Re && Co.alternate === null && t(S, Re), T = f(Co, T, ze), Qe === null ? re = Co : Qe.sibling = Co, Qe = Co, Re = Pe;
        }
        if (Ul.done)
          return a(S, Re), st && Bn(S, ze), re;
        if (Re === null) {
          for (; !Ul.done; ze++, Ul = O.next())
            Re = R(S, Ul.value, J), Re !== null && (al = se(
              S,
              Re,
              Ul.value,
              al
            ), T = f(
              Re,
              T,
              ze
            ), Qe === null ? re = Re : Qe.sibling = Re, Qe = Re);
          return st && Bn(S, ze), re;
        }
        for (Re = i(Re); !Ul.done; ze++, Ul = O.next())
          Pe = q(
            Re,
            S,
            ze,
            Ul.value,
            J
          ), Pe !== null && (al = se(
            S,
            Pe,
            Ul.value,
            al
          ), e && Pe.alternate !== null && Re.delete(
            Pe.key === null ? ze : Pe.key
          ), T = f(
            Pe,
            T,
            ze
          ), Qe === null ? re = Pe : Qe.sibling = Pe, Qe = Pe);
        return e && Re.forEach(function(AT) {
          return t(S, AT);
        }), st && Bn(S, ze), re;
      }
      function dt(S, T, O, J) {
        if (typeof O == "object" && O !== null && O.type === xf && O.key === null && (ya(O, null, S), O = O.props.children), typeof O == "object" && O !== null) {
          switch (O.$$typeof) {
            case Dn:
              var re = ml(O._debugInfo);
              e: {
                for (var Qe = O.key; T !== null; ) {
                  if (T.key === Qe) {
                    if (Qe = O.type, Qe === xf) {
                      if (T.tag === 7) {
                        a(
                          S,
                          T.sibling
                        ), J = o(
                          T,
                          O.props.children
                        ), J.return = S, J._debugOwner = O._owner, J._debugInfo = lt, ya(O, J, S), S = J;
                        break e;
                      }
                    } else if (T.elementType === Qe || Lm(
                      T,
                      O
                    ) || typeof Qe == "object" && Qe !== null && Qe.$$typeof === ia && $a(Qe) === T.type) {
                      a(
                        S,
                        T.sibling
                      ), J = o(T, O.props), Ma(J, O), J.return = S, J._debugOwner = O._owner, J._debugInfo = lt, S = J;
                      break e;
                    }
                    a(S, T);
                    break;
                  } else t(S, T);
                  T = T.sibling;
                }
                O.type === xf ? (J = Nc(
                  O.props.children,
                  S.mode,
                  J,
                  O.key
                ), J.return = S, J._debugOwner = S, J._debugTask = S._debugTask, J._debugInfo = lt, ya(O, J, S), S = J) : (J = Yi(
                  O,
                  S.mode,
                  J
                ), Ma(J, O), J.return = S, J._debugInfo = lt, S = J);
              }
              return S = d(S), lt = re, S;
            case sc:
              e: {
                for (re = O, O = re.key; T !== null; ) {
                  if (T.key === O)
                    if (T.tag === 4 && T.stateNode.containerInfo === re.containerInfo && T.stateNode.implementation === re.implementation) {
                      a(
                        S,
                        T.sibling
                      ), J = o(
                        T,
                        re.children || []
                      ), J.return = S, S = J;
                      break e;
                    } else {
                      a(S, T);
                      break;
                    }
                  else t(S, T);
                  T = T.sibling;
                }
                J = Sd(
                  re,
                  S.mode,
                  J
                ), J.return = S, S = J;
              }
              return d(S);
            case ia:
              return re = ml(O._debugInfo), O = $a(O), S = dt(
                S,
                T,
                O,
                J
              ), lt = re, S;
          }
          if (Al(O))
            return re = ml(O._debugInfo), S = he(
              S,
              T,
              O,
              J
            ), lt = re, S;
          if (je(O)) {
            if (re = ml(O._debugInfo), Qe = je(O), typeof Qe != "function")
              throw Error(
                "An object is not an iterable. This error is likely caused by a bug in React. Please file an issue."
              );
            var Re = Qe.call(O);
            return Re === O ? (S.tag !== 0 || Object.prototype.toString.call(S.type) !== "[object GeneratorFunction]" || Object.prototype.toString.call(Re) !== "[object Generator]") && (sS || console.error(
              "Using Iterators as children is unsupported and will likely yield unexpected results because enumerating a generator mutates it. You may convert it to an array with `Array.from()` or the `[...spread]` operator before rendering. You can also use an Iterable that can iterate multiple times over the same items."
            ), sS = !0) : O.entries !== Qe || w1 || (console.error(
              "Using Maps as children is not supported. Use an array of keyed ReactElements instead."
            ), w1 = !0), S = Wt(
              S,
              T,
              Re,
              J
            ), lt = re, S;
          }
          if (typeof O.then == "function")
            return re = ml(O._debugInfo), S = dt(
              S,
              T,
              Gn(O),
              J
            ), lt = re, S;
          if (O.$$typeof === Pn)
            return dt(
              S,
              T,
              _s(S, O),
              J
            );
          En(S, O);
        }
        return typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint" ? (re = "" + O, T !== null && T.tag === 6 ? (a(
          S,
          T.sibling
        ), J = o(T, re), J.return = S, S = J) : (a(S, T), J = Zo(
          re,
          S.mode,
          J
        ), J.return = S, J._debugOwner = S, J._debugTask = S._debugTask, J._debugInfo = lt, S = J), d(S)) : (typeof O == "function" && Wo(S, O), typeof O == "symbol" && xs(S, O), a(S, T));
      }
      return function(S, T, O, J) {
        var re = lt;
        lt = null;
        try {
          $p = 0;
          var Qe = dt(
            S,
            T,
            O,
            J
          );
          return nm = null, Qe;
        } catch (al) {
          if (al === am || al === ov) throw al;
          var Re = C(29, al, null, S.mode);
          Re.lanes = J, Re.return = S;
          var ze = Re._debugInfo = lt;
          if (Re._debugOwner = S._debugOwner, Re._debugTask = S._debugTask, ze != null) {
            for (var Pe = ze.length - 1; 0 <= Pe; Pe--)
              if (typeof ze[Pe].stack == "string") {
                Re._debugOwner = ze[Pe], Re._debugTask = ze[Pe].debugTask;
                break;
              }
          }
          return Re;
        } finally {
          lt = re;
        }
      };
    }
    function Lt(e, t) {
      var a = Al(e);
      return e = !a && typeof je(e) == "function", a || e ? (a = a ? "array" : "iterable", console.error(
        "A nested %s was passed to row #%s in <SuspenseList />. Wrap it in an additional SuspenseList to configure its revealOrder: <SuspenseList revealOrder=...> ... <SuspenseList revealOrder=...>{%s}</SuspenseList> ... </SuspenseList>",
        a,
        t,
        a
      ), !1) : !0;
    }
    function ot(e) {
      e.updateQueue = {
        baseState: e.memoizedState,
        firstBaseUpdate: null,
        lastBaseUpdate: null,
        shared: { pending: null, lanes: 0, hiddenCallbacks: null },
        callbacks: null
      };
    }
    function vu(e, t) {
      e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
        baseState: e.baseState,
        firstBaseUpdate: e.firstBaseUpdate,
        lastBaseUpdate: e.lastBaseUpdate,
        shared: e.shared,
        callbacks: null
      });
    }
    function Dl(e) {
      return {
        lane: e,
        tag: yS,
        payload: null,
        callback: null,
        next: null
      };
    }
    function bu(e, t, a) {
      var i = e.updateQueue;
      if (i === null) return null;
      if (i = i.shared, Y1 === i && !vS) {
        var o = pe(e);
        console.error(
          `An update (setState, replaceState, or forceUpdate) was scheduled from inside an update function. Update functions should be pure, with zero side-effects. Consider using componentDidUpdate or a callback.

Please update the following component: %s`,
          o
        ), vS = !0;
      }
      return (pt & ea) !== sa ? (o = i.pending, o === null ? t.next = t : (t.next = o.next, o.next = t), i.pending = t, t = Os(e), Gm(e, null, a), t) : (Vo(e, i, t, a), Os(e));
    }
    function Tn(e, t, a) {
      if (t = t.updateQueue, t !== null && (t = t.shared, (a & 4194048) !== 0)) {
        var i = t.lanes;
        i &= e.pendingLanes, a |= i, t.lanes = a, hs(e, a);
      }
    }
    function Us(e, t) {
      var a = e.updateQueue, i = e.alternate;
      if (i !== null && (i = i.updateQueue, a === i)) {
        var o = null, f = null;
        if (a = a.firstBaseUpdate, a !== null) {
          do {
            var d = {
              lane: a.lane,
              tag: a.tag,
              payload: a.payload,
              callback: null,
              next: null
            };
            f === null ? o = f = d : f = f.next = d, a = a.next;
          } while (a !== null);
          f === null ? o = f = t : f = f.next = t;
        } else o = f = t;
        a = {
          baseState: i.baseState,
          firstBaseUpdate: o,
          lastBaseUpdate: f,
          shared: i.shared,
          callbacks: i.callbacks
        }, e.updateQueue = a;
        return;
      }
      e = a.lastBaseUpdate, e === null ? a.firstBaseUpdate = t : e.next = t, a.lastBaseUpdate = t;
    }
    function Fo() {
      if (q1) {
        var e = lm;
        if (e !== null) throw e;
      }
    }
    function Su(e, t, a, i) {
      q1 = !1;
      var o = e.updateQueue;
      If = !1, Y1 = o.shared;
      var f = o.firstBaseUpdate, d = o.lastBaseUpdate, h = o.shared.pending;
      if (h !== null) {
        o.shared.pending = null;
        var y = h, p = y.next;
        y.next = null, d === null ? f = p : d.next = p, d = y;
        var z = e.alternate;
        z !== null && (z = z.updateQueue, h = z.lastBaseUpdate, h !== d && (h === null ? z.firstBaseUpdate = p : h.next = p, z.lastBaseUpdate = y));
      }
      if (f !== null) {
        var R = o.baseState;
        d = 0, z = p = y = null, h = f;
        do {
          var E = h.lane & -536870913, q = E !== h.lane;
          if (q ? (at & E) === E : (i & E) === E) {
            E !== 0 && E === wr && (q1 = !0), z !== null && (z = z.next = {
              lane: 0,
              tag: h.tag,
              payload: h.payload,
              callback: null,
              next: null
            });
            e: {
              E = e;
              var se = h, he = t, Wt = a;
              switch (se.tag) {
                case pS:
                  if (se = se.payload, typeof se == "function") {
                    em = !0;
                    var dt = se.call(
                      Wt,
                      R,
                      he
                    );
                    if (E.mode & wa) {
                      ge(!0);
                      try {
                        se.call(Wt, R, he);
                      } finally {
                        ge(!1);
                      }
                    }
                    em = !1, R = dt;
                    break e;
                  }
                  R = se;
                  break e;
                case B1:
                  E.flags = E.flags & -65537 | 128;
                case yS:
                  if (dt = se.payload, typeof dt == "function") {
                    if (em = !0, se = dt.call(
                      Wt,
                      R,
                      he
                    ), E.mode & wa) {
                      ge(!0);
                      try {
                        dt.call(Wt, R, he);
                      } finally {
                        ge(!1);
                      }
                    }
                    em = !1;
                  } else se = dt;
                  if (se == null) break e;
                  R = et({}, R, se);
                  break e;
                case gS:
                  If = !0;
              }
            }
            E = h.callback, E !== null && (e.flags |= 64, q && (e.flags |= 8192), q = o.callbacks, q === null ? o.callbacks = [E] : q.push(E));
          } else
            q = {
              lane: E,
              tag: h.tag,
              payload: h.payload,
              callback: h.callback,
              next: null
            }, z === null ? (p = z = q, y = R) : z = z.next = q, d |= E;
          if (h = h.next, h === null) {
            if (h = o.shared.pending, h === null)
              break;
            q = h, h = q.next, q.next = null, o.lastBaseUpdate = q, o.shared.pending = null;
          }
        } while (!0);
        z === null && (y = R), o.baseState = y, o.firstBaseUpdate = p, o.lastBaseUpdate = z, f === null && (o.shared.lanes = 0), ts |= d, e.lanes = d, e.memoizedState = R;
      }
      Y1 = null;
    }
    function Qi(e, t) {
      if (typeof e != "function")
        throw Error(
          "Invalid argument passed as callback. Expected a function. Instead received: " + e
        );
      e.call(t);
    }
    function Pm(e, t) {
      var a = e.shared.hiddenCallbacks;
      if (a !== null)
        for (e.shared.hiddenCallbacks = null, e = 0; e < a.length; e++)
          Qi(a[e], t);
    }
    function Io(e, t) {
      var a = e.callbacks;
      if (a !== null)
        for (e.callbacks = null, e = 0; e < a.length; e++)
          Qi(a[e], t);
    }
    function Md(e, t) {
      var a = vc;
      Ve(sv, a, e), Ve(um, t, e), vc = a | t.baseLanes;
    }
    function ii(e) {
      Ve(sv, vc, e), Ve(
        um,
        um.current,
        e
      );
    }
    function Xn(e) {
      vc = sv.current, Ae(um, e), Ae(sv, e);
    }
    function pa(e) {
      var t = e.alternate;
      Ve(
        xl,
        xl.current & im,
        e
      ), Ve(au, e, e), $u === null && (t === null || um.current !== null || t.memoizedState !== null) && ($u = e);
    }
    function Qn(e) {
      Ve(xl, xl.current, e), Ve(au, e, e), $u === null && ($u = e);
    }
    function Cd(e) {
      e.tag === 22 ? (Ve(xl, xl.current, e), Ve(au, e, e), $u === null && ($u = e)) : Eu(e);
    }
    function Eu(e) {
      Ve(xl, xl.current, e), Ve(
        au,
        au.current,
        e
      );
    }
    function Bl(e) {
      Ae(au, e), $u === e && ($u = null), Ae(xl, e);
    }
    function Gc(e) {
      for (var t = e; t !== null; ) {
        if (t.tag === 13) {
          var a = t.memoizedState;
          if (a !== null && (a = a.dehydrated, a === null || mr(a) || Wy(a)))
            return t;
        } else if (t.tag === 19 && (t.memoizedProps.revealOrder === "forwards" || t.memoizedProps.revealOrder === "backwards" || t.memoizedProps.revealOrder === "unstable_legacy-backwards" || t.memoizedProps.revealOrder === "together")) {
          if ((t.flags & 128) !== 0) return t;
        } else if (t.child !== null) {
          t.child.return = t, t = t.child;
          continue;
        }
        if (t === e) break;
        for (; t.sibling === null; ) {
          if (t.return === null || t.return === e) return null;
          t = t.return;
        }
        t.sibling.return = t.return, t = t.sibling;
      }
      return null;
    }
    function Le() {
      var e = G;
      Wu === null ? Wu = [e] : Wu.push(e);
    }
    function I() {
      var e = G;
      if (Wu !== null && (zo++, Wu[zo] !== e)) {
        var t = pe(Xe);
        if (!bS.has(t) && (bS.add(t), Wu !== null)) {
          for (var a = "", i = 0; i <= zo; i++) {
            var o = Wu[i], f = i === zo ? e : o;
            for (o = i + 1 + ". " + o; 30 > o.length; )
              o += " ";
            o += f + `
`, a += o;
          }
          console.error(
            `React has detected a change in the order of Hooks called by %s. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://react.dev/link/rules-of-hooks

   Previous render            Next render
   ------------------------------------------------------
%s   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
`,
            t,
            a
          );
        }
      }
    }
    function ci(e) {
      e == null || Al(e) || console.error(
        "%s received a final argument that is not an array (instead, received `%s`). When specified, the final argument must be an array.",
        G,
        typeof e
      );
    }
    function Ns() {
      var e = pe(Xe);
      ES.has(e) || (ES.add(e), console.error(
        "ReactDOM.useFormState has been renamed to React.useActionState. Please update %s to use React.useActionState.",
        e
      ));
    }
    function sl() {
      throw Error(
        `Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.`
      );
    }
    function ey(e, t) {
      if (Fp) return !1;
      if (t === null)
        return console.error(
          "%s received a final argument during this render, but not during the previous render. Even though the final argument is optional, its type cannot change between renders.",
          G
        ), !1;
      e.length !== t.length && console.error(
        `The final argument passed to %s changed size between renders. The order and size of this array must remain constant.

Previous: %s
Incoming: %s`,
        G,
        "[" + t.join(", ") + "]",
        "[" + e.join(", ") + "]"
      );
      for (var a = 0; a < t.length && a < e.length; a++)
        if (!on(e[a], t[a])) return !1;
      return !0;
    }
    function ty(e, t, a, i, o, f) {
      Ao = f, Xe = t, Wu = e !== null ? e._debugHookTypes : null, zo = -1, Fp = e !== null && e.type !== t.type, (Object.prototype.toString.call(a) === "[object AsyncFunction]" || Object.prototype.toString.call(a) === "[object AsyncGeneratorFunction]") && (f = pe(Xe), G1.has(f) || (G1.add(f), console.error(
        "%s is an async Client Component. Only Server Components can be async at the moment. This error is often caused by accidentally adding `'use client'` to a module that was originally written for the server.",
        f === null ? "An unknown Component" : "<" + f + ">"
      ))), t.memoizedState = null, t.updateQueue = null, t.lanes = 0, L.H = e !== null && e.memoizedState !== null ? X1 : Wu !== null ? TS : L1, Lr = f = (t.mode & wa) !== qe;
      var d = N1(a, i, o);
      if (Lr = !1, om && (d = Hs(
        t,
        a,
        i,
        o
      )), f) {
        ge(!0);
        try {
          d = Hs(
            t,
            a,
            i,
            o
          );
        } finally {
          ge(!1);
        }
      }
      return yl(e, t), d;
    }
    function yl(e, t) {
      t._debugHookTypes = Wu, t.dependencies === null ? Oo !== null && (t.dependencies = {
        lanes: 0,
        firstContext: null,
        _debugThenableState: Oo
      }) : t.dependencies._debugThenableState = Oo, L.H = Ip;
      var a = Vt !== null && Vt.next !== null;
      if (Ao = 0, Wu = G = Vl = Vt = Xe = null, zo = -1, e !== null && (e.flags & 65011712) !== (t.flags & 65011712) && console.error(
        "Internal React error: Expected static flag was missing. Please notify the React team."
      ), dv = !1, Wp = 0, Oo = null, a)
        throw Error(
          "Rendered fewer hooks than expected. This may be caused by an accidental early return statement."
        );
      e === null || Zl || (e = e.dependencies, e !== null && Ko(e) && (Zl = !0)), Kp ? (Kp = !1, e = !0) : e = !1, e && (t = pe(t) || "Unknown", SS.has(t) || G1.has(t) || (SS.add(t), console.error(
        "`use` was called from inside a try/catch block. This is not allowed and can lead to unexpected behavior. To handle errors triggered by `use`, wrap your component in a error boundary."
      )));
    }
    function Hs(e, t, a, i) {
      Xe = e;
      var o = 0;
      do {
        if (om && (Oo = null), Wp = 0, om = !1, o >= tT)
          throw Error(
            "Too many re-renders. React limits the number of renders to prevent an infinite loop."
          );
        if (o += 1, Fp = !1, Vl = Vt = null, e.updateQueue != null) {
          var f = e.updateQueue;
          f.lastEffect = null, f.events = null, f.stores = null, f.memoCache != null && (f.memoCache.index = 0);
        }
        zo = -1, L.H = AS, f = N1(t, a, i);
      } while (om);
      return f;
    }
    function js() {
      var e = L.H, t = e.useState()[0];
      return t = typeof t.then == "function" ? Ys(t) : t, e = e.useState()[0], (Vt !== null ? Vt.memoizedState : null) !== e && (Xe.flags |= 1024), t;
    }
    function Lc() {
      var e = hv !== 0;
      return hv = 0, e;
    }
    function ws(e, t, a) {
      t.updateQueue = e.updateQueue, t.flags = (t.mode & Ti) !== qe ? t.flags & -402655237 : t.flags & -2053, e.lanes &= ~a;
    }
    function Vi(e) {
      if (dv) {
        for (e = e.memoizedState; e !== null; ) {
          var t = e.queue;
          t !== null && (t.pending = null), e = e.next;
        }
        dv = !1;
      }
      Ao = 0, Wu = Vl = Vt = Xe = null, zo = -1, G = null, om = !1, Wp = hv = 0, Oo = null;
    }
    function El() {
      var e = {
        memoizedState: null,
        baseState: null,
        baseQueue: null,
        queue: null,
        next: null
      };
      return Vl === null ? Xe.memoizedState = Vl = e : Vl = Vl.next = e, Vl;
    }
    function zt() {
      if (Vt === null) {
        var e = Xe.alternate;
        e = e !== null ? e.memoizedState : null;
      } else e = Vt.next;
      var t = Vl === null ? Xe.memoizedState : Vl.next;
      if (t !== null)
        Vl = t, Vt = e;
      else {
        if (e === null)
          throw Xe.alternate === null ? Error(
            "Update hook called on initial render. This is likely a bug in React. Please file an issue."
          ) : Error("Rendered more hooks than during the previous render.");
        Vt = e, e = {
          memoizedState: Vt.memoizedState,
          baseState: Vt.baseState,
          baseQueue: Vt.baseQueue,
          queue: Vt.queue,
          next: null
        }, Vl === null ? Xe.memoizedState = Vl = e : Vl = Vl.next = e;
      }
      return Vl;
    }
    function Bs() {
      return { lastEffect: null, events: null, stores: null, memoCache: null };
    }
    function Ys(e) {
      var t = Wp;
      return Wp += 1, Oo === null && (Oo = _d()), e = Ka(Oo, e, t), t = Xe, (Vl === null ? t.memoizedState : Vl.next) === null && (t = t.alternate, L.H = t !== null && t.memoizedState !== null ? X1 : L1), e;
    }
    function oi(e) {
      if (e !== null && typeof e == "object") {
        if (typeof e.then == "function") return Ys(e);
        if (e.$$typeof === Pn) return Et(e);
      }
      throw Error("An unsupported type was passed to use(): " + String(e));
    }
    function ka(e) {
      var t = null, a = Xe.updateQueue;
      if (a !== null && (t = a.memoCache), t == null) {
        var i = Xe.alternate;
        i !== null && (i = i.updateQueue, i !== null && (i = i.memoCache, i != null && (t = {
          data: i.data.map(function(o) {
            return o.slice();
          }),
          index: 0
        })));
      }
      if (t == null && (t = { data: [], index: 0 }), a === null && (a = Bs(), Xe.updateQueue = a), a.memoCache = t, a = t.data[t.index], a === void 0 || Fp)
        for (a = t.data[t.index] = Array(e), i = 0; i < e; i++)
          a[i] = i1;
      else
        a.length !== e && console.error(
          "Expected a constant size argument for each invocation of useMemoCache. The previous cache was allocated with size %s but size %s was requested.",
          a.length,
          e
        );
      return t.index++, a;
    }
    function Wa(e, t) {
      return typeof t == "function" ? t(e) : t;
    }
    function Po(e, t, a) {
      var i = El();
      if (a !== void 0) {
        var o = a(t);
        if (Lr) {
          ge(!0);
          try {
            a(t);
          } finally {
            ge(!1);
          }
        }
      } else o = t;
      return i.memoizedState = i.baseState = o, e = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: e,
        lastRenderedState: o
      }, i.queue = e, e = e.dispatch = t1.bind(
        null,
        Xe,
        e
      ), [i.memoizedState, e];
    }
    function Xc(e) {
      var t = zt();
      return Zi(t, Vt, e);
    }
    function Zi(e, t, a) {
      var i = e.queue;
      if (i === null)
        throw Error(
          "Should have a queue. You are likely calling Hooks conditionally, which is not allowed. (https://react.dev/link/invalid-hook-call)"
        );
      i.lastRenderedReducer = a;
      var o = e.baseQueue, f = i.pending;
      if (f !== null) {
        if (o !== null) {
          var d = o.next;
          o.next = f.next, f.next = d;
        }
        t.baseQueue !== o && console.error(
          "Internal error: Expected work-in-progress queue to be a clone. This is a bug in React."
        ), t.baseQueue = o = f, i.pending = null;
      }
      if (f = e.baseState, o === null) e.memoizedState = f;
      else {
        t = o.next;
        var h = d = null, y = null, p = t, z = !1;
        do {
          var R = p.lane & -536870913;
          if (R !== p.lane ? (at & R) === R : (Ao & R) === R) {
            var E = p.revertLane;
            if (E === 0)
              y !== null && (y = y.next = {
                lane: 0,
                revertLane: 0,
                gesture: null,
                action: p.action,
                hasEagerState: p.hasEagerState,
                eagerState: p.eagerState,
                next: null
              }), R === wr && (z = !0);
            else if ((Ao & E) === E) {
              p = p.next, E === wr && (z = !0);
              continue;
            } else
              R = {
                lane: 0,
                revertLane: p.revertLane,
                gesture: null,
                action: p.action,
                hasEagerState: p.hasEagerState,
                eagerState: p.eagerState,
                next: null
              }, y === null ? (h = y = R, d = f) : y = y.next = R, Xe.lanes |= E, ts |= E;
            R = p.action, Lr && a(f, R), f = p.hasEagerState ? p.eagerState : a(f, R);
          } else
            E = {
              lane: R,
              revertLane: p.revertLane,
              gesture: p.gesture,
              action: p.action,
              hasEagerState: p.hasEagerState,
              eagerState: p.eagerState,
              next: null
            }, y === null ? (h = y = E, d = f) : y = y.next = E, Xe.lanes |= R, ts |= R;
          p = p.next;
        } while (p !== null && p !== t);
        if (y === null ? d = f : y.next = h, !on(f, e.memoizedState) && (Zl = !0, z && (a = lm, a !== null)))
          throw a;
        e.memoizedState = f, e.baseState = d, e.baseQueue = y, i.lastRenderedState = f;
      }
      return o === null && (i.lanes = 0), [e.memoizedState, i.dispatch];
    }
    function Qc(e) {
      var t = zt(), a = t.queue;
      if (a === null)
        throw Error(
          "Should have a queue. You are likely calling Hooks conditionally, which is not allowed. (https://react.dev/link/invalid-hook-call)"
        );
      a.lastRenderedReducer = e;
      var i = a.dispatch, o = a.pending, f = t.memoizedState;
      if (o !== null) {
        a.pending = null;
        var d = o = o.next;
        do
          f = e(f, d.action), d = d.next;
        while (d !== o);
        on(f, t.memoizedState) || (Zl = !0), t.memoizedState = f, t.baseQueue === null && (t.baseState = f), a.lastRenderedState = f;
      }
      return [f, i];
    }
    function ef(e, t, a) {
      var i = Xe, o = El();
      if (st) {
        if (a === void 0)
          throw Error(
            "Missing getServerSnapshot, which is required for server-rendered content. Will revert to client rendering."
          );
        var f = a();
        cm || f === a() || (console.error(
          "The result of getServerSnapshot should be cached to avoid an infinite loop"
        ), cm = !0);
      } else {
        if (f = t(), cm || (a = t(), on(f, a) || (console.error(
          "The result of getSnapshot should be cached to avoid an infinite loop"
        ), cm = !0)), Zt === null)
          throw Error(
            "Expected a work-in-progress root. This is a bug in React. Please file an issue."
          );
        (at & 127) !== 0 || ly(i, t, f);
      }
      return o.memoizedState = f, a = { value: f, getSnapshot: t }, o.queue = a, Jc(
        Ji.bind(null, i, a, e),
        [e]
      ), i.flags |= 2048, Tu(
        ku | rn,
        { destroy: void 0 },
        ay.bind(
          null,
          i,
          a,
          f,
          t
        ),
        null
      ), f;
    }
    function Vc(e, t, a) {
      var i = Xe, o = zt(), f = st;
      if (f) {
        if (a === void 0)
          throw Error(
            "Missing getServerSnapshot, which is required for server-rendered content. Will revert to client rendering."
          );
        a = a();
      } else if (a = t(), !cm) {
        var d = t();
        on(a, d) || (console.error(
          "The result of getSnapshot should be cached to avoid an infinite loop"
        ), cm = !0);
      }
      (d = !on(
        (Vt || o).memoizedState,
        a
      )) && (o.memoizedState = a, Zl = !0), o = o.queue;
      var h = Ji.bind(null, i, o, e);
      if (_l(2048, rn, h, [e]), o.getSnapshot !== t || d || Vl !== null && Vl.memoizedState.tag & ku) {
        if (i.flags |= 2048, Tu(
          ku | rn,
          { destroy: void 0 },
          ay.bind(
            null,
            i,
            o,
            a,
            t
          ),
          null
        ), Zt === null)
          throw Error(
            "Expected a work-in-progress root. This is a bug in React. Please file an issue."
          );
        f || (Ao & 127) !== 0 || ly(i, t, a);
      }
      return a;
    }
    function ly(e, t, a) {
      e.flags |= 16384, e = { getSnapshot: t, value: a }, t = Xe.updateQueue, t === null ? (t = Bs(), Xe.updateQueue = t, t.stores = [e]) : (a = t.stores, a === null ? t.stores = [e] : a.push(e));
    }
    function ay(e, t, a, i) {
      t.value = a, t.getSnapshot = i, Ki(t) && ny(e);
    }
    function Ji(e, t, a) {
      return a(function() {
        Ki(t) && (pu(2, "updateSyncExternalStore()", e), ny(e));
      });
    }
    function Ki(e) {
      var t = e.getSnapshot;
      e = e.value;
      try {
        var a = t();
        return !on(e, a);
      } catch {
        return !0;
      }
    }
    function ny(e) {
      var t = aa(e, 2);
      t !== null && Ge(t, e, 2);
    }
    function xd(e) {
      var t = El();
      if (typeof e == "function") {
        var a = e;
        if (e = a(), Lr) {
          ge(!0);
          try {
            a();
          } finally {
            ge(!1);
          }
        }
      }
      return t.memoizedState = t.baseState = e, t.queue = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Wa,
        lastRenderedState: e
      }, t;
    }
    function $i(e) {
      e = xd(e);
      var t = e.queue, a = Bd.bind(null, Xe, t);
      return t.dispatch = a, [e.memoizedState, a];
    }
    function Zc(e) {
      var t = El();
      t.memoizedState = t.baseState = e;
      var a = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      return t.queue = a, t = Zs.bind(
        null,
        Xe,
        !0,
        a
      ), a.dispatch = t, [e, t];
    }
    function qs(e, t) {
      var a = zt();
      return tf(a, Vt, e, t);
    }
    function tf(e, t, a, i) {
      return e.baseState = a, Zi(
        e,
        Vt,
        typeof i == "function" ? i : Wa
      );
    }
    function Gs(e, t) {
      var a = zt();
      return Vt !== null ? tf(a, Vt, e, t) : (a.baseState = e, [e, a.queue.dispatch]);
    }
    function L0(e, t, a, i, o) {
      if (Yl(e))
        throw Error("Cannot update form state while rendering.");
      if (e = t.action, e !== null) {
        var f = {
          payload: o,
          action: e,
          next: null,
          isTransition: !0,
          status: "pending",
          value: null,
          reason: null,
          listeners: [],
          then: function(d) {
            f.listeners.push(d);
          }
        };
        L.T !== null ? a(!0) : f.isTransition = !1, i(f), a = t.pending, a === null ? (f.next = t.pending = f, ki(t, f)) : (f.next = a.next, t.pending = a.next = f);
      }
    }
    function ki(e, t) {
      var a = t.action, i = t.payload, o = e.state;
      if (t.isTransition) {
        var f = L.T, d = {};
        d._updatedFibers = /* @__PURE__ */ new Set(), L.T = d;
        try {
          var h = a(o, i), y = L.S;
          y !== null && y(d, h), uy(e, t, h);
        } catch (p) {
          Ls(e, t, p);
        } finally {
          f !== null && d.types !== null && (f.types !== null && f.types !== d.types && console.error(
            "We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."
          ), f.types = d.types), L.T = f, f === null && d._updatedFibers && (e = d._updatedFibers.size, d._updatedFibers.clear(), 10 < e && console.warn(
            "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
          ));
        }
      } else
        try {
          d = a(o, i), uy(e, t, d);
        } catch (p) {
          Ls(e, t, p);
        }
    }
    function uy(e, t, a) {
      a !== null && typeof a == "object" && typeof a.then == "function" ? (L.asyncTransitions++, a.then(Kc, Kc), a.then(
        function(i) {
          fi(e, t, i);
        },
        function(i) {
          return Ls(e, t, i);
        }
      ), t.isTransition || console.error(
        "An async function with useActionState was called outside of a transition. This is likely not what you intended (for example, isPending will not update correctly). Either call the returned function inside startTransition, or pass it to an `action` or `formAction` prop."
      )) : fi(e, t, a);
    }
    function fi(e, t, a) {
      t.status = "fulfilled", t.value = a, Ud(t), e.state = a, t = e.pending, t !== null && (a = t.next, a === t ? e.pending = null : (a = a.next, t.next = a, ki(e, a)));
    }
    function Ls(e, t, a) {
      var i = e.pending;
      if (e.pending = null, i !== null) {
        i = i.next;
        do
          t.status = "rejected", t.reason = a, Ud(t), t = t.next;
        while (t !== i);
      }
      e.action = null;
    }
    function Ud(e) {
      e = e.listeners;
      for (var t = 0; t < e.length; t++) (0, e[t])();
    }
    function si(e, t) {
      return t;
    }
    function Fa(e, t) {
      if (st) {
        var a = Zt.formState;
        if (a !== null) {
          e: {
            var i = Xe;
            if (st) {
              if (ll) {
                t: {
                  for (var o = ll, f = Ju; o.nodeType !== 8; ) {
                    if (!f) {
                      o = null;
                      break t;
                    }
                    if (o = an(
                      o.nextSibling
                    ), o === null) {
                      o = null;
                      break t;
                    }
                  }
                  f = o.data, o = f === rb || f === o2 ? o : null;
                }
                if (o) {
                  ll = an(
                    o.nextSibling
                  ), i = o.data === rb;
                  break e;
                }
              }
              gn(i);
            }
            i = !1;
          }
          i && (t = a[0]);
        }
      }
      return a = El(), a.memoizedState = a.baseState = t, i = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: si,
        lastRenderedState: t
      }, a.queue = i, a = Bd.bind(
        null,
        Xe,
        i
      ), i.dispatch = a, i = xd(!1), f = Zs.bind(
        null,
        Xe,
        !1,
        i.queue
      ), i = El(), o = {
        state: t,
        dispatch: null,
        action: e,
        pending: null
      }, i.queue = o, a = L0.bind(
        null,
        Xe,
        o,
        f,
        a
      ), o.dispatch = a, i.memoizedState = e, [t, a, !1];
    }
    function Wi(e) {
      var t = zt();
      return Nd(t, Vt, e);
    }
    function Nd(e, t, a) {
      if (t = Zi(
        e,
        t,
        si
      )[0], e = Xc(Wa)[0], typeof t == "object" && t !== null && typeof t.then == "function")
        try {
          var i = Ys(t);
        } catch (d) {
          throw d === am ? ov : d;
        }
      else i = t;
      t = zt();
      var o = t.queue, f = o.dispatch;
      return a !== t.memoizedState && (Xe.flags |= 2048, Tu(
        ku | rn,
        { destroy: void 0 },
        iy.bind(null, o, a),
        null
      )), [i, f, e];
    }
    function iy(e, t) {
      e.action = t;
    }
    function Fi(e) {
      var t = zt(), a = Vt;
      if (a !== null)
        return Nd(t, a, e);
      zt(), t = t.memoizedState, a = zt();
      var i = a.queue.dispatch;
      return a.memoizedState = e, [t, i, !1];
    }
    function Tu(e, t, a, i) {
      return e = { tag: e, create: a, deps: i, inst: t, next: null }, t = Xe.updateQueue, t === null && (t = Bs(), Xe.updateQueue = t), a = t.lastEffect, a === null ? t.lastEffect = e.next = e : (i = a.next, a.next = e, e.next = i, t.lastEffect = e), e;
    }
    function Hd(e) {
      var t = El();
      return e = { current: e }, t.memoizedState = e;
    }
    function Ii(e, t, a, i) {
      var o = El();
      Xe.flags |= e, o.memoizedState = Tu(
        ku | t,
        { destroy: void 0 },
        a,
        i === void 0 ? null : i
      );
    }
    function _l(e, t, a, i) {
      var o = zt();
      i = i === void 0 ? null : i;
      var f = o.memoizedState.inst;
      Vt !== null && i !== null && ey(i, Vt.memoizedState.deps) ? o.memoizedState = Tu(t, f, a, i) : (Xe.flags |= e, o.memoizedState = Tu(
        ku | t,
        f,
        a,
        i
      ));
    }
    function Jc(e, t) {
      (Xe.mode & Ti) !== qe ? Ii(276826112, rn, e, t) : Ii(8390656, rn, e, t);
    }
    function X0(e) {
      Xe.flags |= 4;
      var t = Xe.updateQueue;
      if (t === null)
        t = Bs(), Xe.updateQueue = t, t.events = [e];
      else {
        var a = t.events;
        a === null ? t.events = [e] : a.push(e);
      }
    }
    function Xs(e) {
      var t = El(), a = { impl: e };
      return t.memoizedState = a, function() {
        if ((pt & ea) !== sa)
          throw Error(
            "A function wrapped in useEffectEvent can't be called during rendering."
          );
        return a.impl.apply(void 0, arguments);
      };
    }
    function lf(e) {
      var t = zt().memoizedState;
      return X0({ ref: t, nextImpl: e }), function() {
        if ((pt & ea) !== sa)
          throw Error(
            "A function wrapped in useEffectEvent can't be called during rendering."
          );
        return t.impl.apply(void 0, arguments);
      };
    }
    function ga(e, t) {
      var a = 4194308;
      return (Xe.mode & Ti) !== qe && (a |= 134217728), Ii(a, nu, e, t);
    }
    function Ia(e, t) {
      if (typeof t == "function") {
        e = e();
        var a = t(e);
        return function() {
          typeof a == "function" ? a() : t(null);
        };
      }
      if (t != null)
        return t.hasOwnProperty("current") || console.error(
          "Expected useImperativeHandle() first argument to either be a ref callback or React.createRef() object. Instead received: %s.",
          "an object with keys {" + Object.keys(t).join(", ") + "}"
        ), e = e(), t.current = e, function() {
          t.current = null;
        };
    }
    function Au(e, t, a) {
      typeof t != "function" && console.error(
        "Expected useImperativeHandle() second argument to be a function that creates a handle. Instead received: %s.",
        t !== null ? typeof t : "null"
      ), a = a != null ? a.concat([e]) : null;
      var i = 4194308;
      (Xe.mode & Ti) !== qe && (i |= 134217728), Ii(
        i,
        nu,
        Ia.bind(null, t, e),
        a
      );
    }
    function af(e, t, a) {
      typeof t != "function" && console.error(
        "Expected useImperativeHandle() second argument to be a function that creates a handle. Instead received: %s.",
        t !== null ? typeof t : "null"
      ), a = a != null ? a.concat([e]) : null, _l(
        4,
        nu,
        Ia.bind(null, t, e),
        a
      );
    }
    function jd(e, t) {
      return El().memoizedState = [
        e,
        t === void 0 ? null : t
      ], e;
    }
    function Vn(e, t) {
      var a = zt();
      t = t === void 0 ? null : t;
      var i = a.memoizedState;
      return t !== null && ey(t, i[1]) ? i[0] : (a.memoizedState = [e, t], e);
    }
    function va(e, t) {
      var a = El();
      t = t === void 0 ? null : t;
      var i = e();
      if (Lr) {
        ge(!0);
        try {
          e();
        } finally {
          ge(!1);
        }
      }
      return a.memoizedState = [i, t], i;
    }
    function It(e, t) {
      var a = zt();
      t = t === void 0 ? null : t;
      var i = a.memoizedState;
      if (t !== null && ey(t, i[1]))
        return i[0];
      if (i = e(), Lr) {
        ge(!0);
        try {
          e();
        } finally {
          ge(!1);
        }
      }
      return a.memoizedState = [i, t], i;
    }
    function nf(e, t) {
      var a = El();
      return Dt(a, e, t);
    }
    function Ou(e, t) {
      var a = zt();
      return pl(
        a,
        Vt.memoizedState,
        e,
        t
      );
    }
    function $e(e, t) {
      var a = zt();
      return Vt === null ? Dt(a, e, t) : pl(
        a,
        Vt.memoizedState,
        e,
        t
      );
    }
    function Dt(e, t, a) {
      return a === void 0 || (Ao & 1073741824) !== 0 && (at & 261930) === 0 ? e.memoizedState = t : (e.memoizedState = a, e = hf(), Xe.lanes |= e, ts |= e, a);
    }
    function pl(e, t, a, i) {
      return on(a, t) ? a : um.current !== null ? (e = Dt(e, a, i), on(e, t) || (Zl = !0), e) : (Ao & 42) === 0 || (Ao & 1073741824) !== 0 && (at & 261930) === 0 ? (Zl = !0, e.memoizedState = a) : (e = hf(), Xe.lanes |= e, ts |= e, t);
    }
    function Kc() {
      L.asyncTransitions--;
    }
    function $c(e, t, a, i, o) {
      var f = At.p;
      At.p = f !== 0 && f < Il ? f : Il;
      var d = L.T, h = {};
      h._updatedFibers = /* @__PURE__ */ new Set(), L.T = h, Zs(e, !1, t, a);
      try {
        var y = o(), p = L.S;
        if (p !== null && p(h, y), y !== null && typeof y == "object" && typeof y.then == "function") {
          L.asyncTransitions++, y.then(Kc, Kc);
          var z = Dd(
            y,
            i
          );
          kc(
            e,
            t,
            z,
            ua(e)
          );
        } else
          kc(
            e,
            t,
            i,
            ua(e)
          );
      } catch (R) {
        kc(
          e,
          t,
          { then: function() {
          }, status: "rejected", reason: R },
          ua(e)
        );
      } finally {
        At.p = f, d !== null && h.types !== null && (d.types !== null && d.types !== h.types && console.error(
          "We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."
        ), d.types = h.types), L.T = d, d === null && h._updatedFibers && (e = h._updatedFibers.size, h._updatedFibers.clear(), 10 < e && console.warn(
          "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
        ));
      }
    }
    function ri(e, t, a, i) {
      if (e.tag !== 5)
        throw Error(
          "Expected the form instance to be a HostComponent. This is a bug in React."
        );
      var o = Qs(e).queue;
      q0(e), $c(
        e,
        o,
        t,
        Ir,
        a === null ? V : function() {
          return uf(e), a(i);
        }
      );
    }
    function Qs(e) {
      var t = e.memoizedState;
      if (t !== null) return t;
      t = {
        memoizedState: Ir,
        baseState: Ir,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Wa,
          lastRenderedState: Ir
        },
        next: null
      };
      var a = {};
      return t.next = {
        memoizedState: a,
        baseState: a,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Wa,
          lastRenderedState: a
        },
        next: null
      }, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
    }
    function uf(e) {
      L.T === null && console.error(
        "requestFormReset was called outside a transition or action. To fix, move to an action, or wrap with startTransition."
      );
      var t = Qs(e);
      t.next === null && (t = e.alternate.memoizedState), kc(
        e,
        t.next.queue,
        {},
        ua(e)
      );
    }
    function Pi() {
      var e = xd(!1);
      return e = $c.bind(
        null,
        Xe,
        e.queue,
        !0,
        !1
      ), El().memoizedState = e, [!1, e];
    }
    function Q0() {
      var e = Xc(Wa)[0], t = zt().memoizedState;
      return [
        typeof e == "boolean" ? e : Ys(e),
        t
      ];
    }
    function ul() {
      var e = Qc(Wa)[0], t = zt().memoizedState;
      return [
        typeof e == "boolean" ? e : Ys(e),
        t
      ];
    }
    function di() {
      return Et(h0);
    }
    function Vs() {
      var e = El(), t = Zt.identifierPrefix;
      if (st) {
        var a = vo, i = go;
        a = (i & ~(1 << 32 - Fl(i) - 1)).toString(32) + a, t = "_" + t + "R_" + a, a = hv++, 0 < a && (t += "H" + a.toString(32)), t += "_";
      } else
        a = eT++, t = "_" + t + "r_" + a.toString(32) + "_";
      return e.memoizedState = t;
    }
    function wd() {
      return El().memoizedState = V0.bind(
        null,
        Xe
      );
    }
    function V0(e, t) {
      for (var a = e.return; a !== null; ) {
        switch (a.tag) {
          case 24:
          case 3:
            var i = ua(a), o = Dl(i), f = bu(a, o, i);
            f !== null && (pu(i, "refresh()", e), Ge(f, a, i), Tn(f, a, i)), e = Od(), t != null && f !== null && console.error(
              "The seed argument is not enabled outside experimental channels."
            ), o.payload = { cache: e };
            return;
        }
        a = a.return;
      }
    }
    function t1(e, t, a) {
      var i = arguments;
      typeof i[3] == "function" && console.error(
        "State updates from the useState() and useReducer() Hooks don't support the second callback argument. To execute a side effect after rendering, declare it in the component body with useEffect()."
      ), i = ua(e);
      var o = {
        lane: i,
        revertLane: 0,
        gesture: null,
        action: a,
        hasEagerState: !1,
        eagerState: null,
        next: null
      };
      Yl(e) ? rl(t, o) : (o = Cc(e, t, o, i), o !== null && (pu(i, "dispatch()", e), Ge(o, e, i), Js(o, t, i)));
    }
    function Bd(e, t, a) {
      var i = arguments;
      typeof i[3] == "function" && console.error(
        "State updates from the useState() and useReducer() Hooks don't support the second callback argument. To execute a side effect after rendering, declare it in the component body with useEffect()."
      ), i = ua(e), kc(e, t, a, i) && pu(i, "setState()", e);
    }
    function kc(e, t, a, i) {
      var o = {
        lane: i,
        revertLane: 0,
        gesture: null,
        action: a,
        hasEagerState: !1,
        eagerState: null,
        next: null
      };
      if (Yl(e)) rl(t, o);
      else {
        var f = e.alternate;
        if (e.lanes === 0 && (f === null || f.lanes === 0) && (f = t.lastRenderedReducer, f !== null)) {
          var d = L.H;
          L.H = Oi;
          try {
            var h = t.lastRenderedState, y = f(h, a);
            if (o.hasEagerState = !0, o.eagerState = y, on(y, h))
              return Vo(e, t, o, 0), Zt === null && vd(), !1;
          } catch {
          } finally {
            L.H = d;
          }
        }
        if (a = Cc(e, t, o, i), a !== null)
          return Ge(a, e, i), Js(a, t, i), !0;
      }
      return !1;
    }
    function Zs(e, t, a, i) {
      if (L.T === null && wr === 0 && console.error(
        "An optimistic state update occurred outside a transition or action. To fix, move the update to an action, or wrap with startTransition."
      ), i = {
        lane: 2,
        revertLane: Ky(),
        gesture: null,
        action: i,
        hasEagerState: !1,
        eagerState: null,
        next: null
      }, Yl(e)) {
        if (t)
          throw Error("Cannot update optimistic state while rendering.");
        console.error("Cannot call startTransition while rendering.");
      } else
        t = Cc(
          e,
          a,
          i,
          2
        ), t !== null && (pu(2, "setOptimistic()", e), Ge(t, e, 2));
    }
    function Yl(e) {
      var t = e.alternate;
      return e === Xe || t !== null && t === Xe;
    }
    function rl(e, t) {
      om = dv = !0;
      var a = e.pending;
      a === null ? t.next = t : (t.next = a.next, a.next = t), e.pending = t;
    }
    function Js(e, t, a) {
      if ((a & 4194048) !== 0) {
        var i = t.lanes;
        i &= e.pendingLanes, a |= i, t.lanes = a, hs(e, a);
      }
    }
    function Wc(e) {
      if (e !== null && typeof e != "function") {
        var t = String(e);
        HS.has(t) || (HS.add(t), console.error(
          "Expected the last optional `callback` argument to be a function. Instead received: %s.",
          e
        ));
      }
    }
    function cf(e, t, a, i) {
      var o = e.memoizedState, f = a(i, o);
      if (e.mode & wa) {
        ge(!0);
        try {
          f = a(i, o);
        } finally {
          ge(!1);
        }
      }
      f === void 0 && (t = We(t) || "Component", CS.has(t) || (CS.add(t), console.error(
        "%s.getDerivedStateFromProps(): A valid state object (or null) must be returned. You have returned undefined.",
        t
      ))), o = f == null ? o : et({}, o, f), e.memoizedState = o, e.lanes === 0 && (e.updateQueue.baseState = o);
    }
    function Yd(e, t, a, i, o, f, d) {
      var h = e.stateNode;
      if (typeof h.shouldComponentUpdate == "function") {
        if (a = h.shouldComponentUpdate(
          i,
          f,
          d
        ), e.mode & wa) {
          ge(!0);
          try {
            a = h.shouldComponentUpdate(
              i,
              f,
              d
            );
          } finally {
            ge(!1);
          }
        }
        return a === void 0 && console.error(
          "%s.shouldComponentUpdate(): Returned undefined instead of a boolean value. Make sure to return true or false.",
          We(t) || "Component"
        ), a;
      }
      return t.prototype && t.prototype.isPureReactComponent ? !Qo(a, i) || !Qo(o, f) : !0;
    }
    function zu(e, t, a, i) {
      var o = t.state;
      typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(a, i), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(a, i), t.state !== o && (e = pe(e) || "Component", zS.has(e) || (zS.add(e), console.error(
        "%s.componentWillReceiveProps(): Assigning directly to this.state is deprecated (except inside a component's constructor). Use setState instead.",
        e
      )), Q1.enqueueReplaceState(
        t,
        t.state,
        null
      ));
    }
    function Du(e, t) {
      var a = t;
      if ("ref" in t) {
        a = {};
        for (var i in t)
          i !== "ref" && (a[i] = t[i]);
      }
      if (e = e.defaultProps) {
        a === t && (a = et({}, a));
        for (var o in e)
          a[o] === void 0 && (a[o] = e[o]);
      }
      return a;
    }
    function qd(e) {
      S1(e), console.warn(
        `%s

%s
`,
        fm ? "An error occurred in the <" + fm + "> component." : "An error occurred in one of your React components.",
        `Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://react.dev/link/error-boundaries to learn more about error boundaries.`
      );
    }
    function Gd(e) {
      var t = fm ? "The above error occurred in the <" + fm + "> component." : "The above error occurred in one of your React components.", a = "React will try to recreate this component tree from scratch using the error boundary you provided, " + ((V1 || "Anonymous") + ".");
      if (typeof e == "object" && e !== null && typeof e.environmentName == "string") {
        var i = e.environmentName;
        e = [
          `%o

%s

%s
`,
          e,
          t,
          a
        ].slice(0), typeof e[0] == "string" ? e.splice(
          0,
          1,
          p2 + " " + e[0],
          g2,
          Yv + i + Yv,
          v2
        ) : e.splice(
          0,
          0,
          p2,
          g2,
          Yv + i + Yv,
          v2
        ), e.unshift(console), i = ET.apply(console.error, e), i();
      } else
        console.error(
          `%o

%s

%s
`,
          e,
          t,
          a
        );
    }
    function cy(e) {
      S1(e);
    }
    function Ks(e, t) {
      try {
        fm = t.source ? pe(t.source) : null, V1 = null;
        var a = t.value;
        if (L.actQueue !== null)
          L.thrownErrors.push(a);
        else {
          var i = e.onUncaughtError;
          i(a, { componentStack: t.stack });
        }
      } catch (o) {
        setTimeout(function() {
          throw o;
        });
      }
    }
    function oy(e, t, a) {
      try {
        fm = a.source ? pe(a.source) : null, V1 = pe(t);
        var i = e.onCaughtError;
        i(a.value, {
          componentStack: a.stack,
          errorBoundary: t.tag === 1 ? t.stateNode : null
        });
      } catch (o) {
        setTimeout(function() {
          throw o;
        });
      }
    }
    function Ld(e, t, a) {
      return a = Dl(a), a.tag = B1, a.payload = { element: null }, a.callback = function() {
        de(t.source, Ks, e, t);
      }, a;
    }
    function Xd(e) {
      return e = Dl(e), e.tag = B1, e;
    }
    function Qd(e, t, a, i) {
      var o = a.type.getDerivedStateFromError;
      if (typeof o == "function") {
        var f = i.value;
        e.payload = function() {
          return o(f);
        }, e.callback = function() {
          xc(a), de(
            i.source,
            oy,
            t,
            a,
            i
          );
        };
      }
      var d = a.stateNode;
      d !== null && typeof d.componentDidCatch == "function" && (e.callback = function() {
        xc(a), de(
          i.source,
          oy,
          t,
          a,
          i
        ), typeof o != "function" && (as === null ? as = /* @__PURE__ */ new Set([this]) : as.add(this)), WE(this, i), typeof o == "function" || (a.lanes & 2) === 0 && console.error(
          "%s: Error boundaries should implement getDerivedStateFromError(). In that method, return a state update to display an error message or fallback UI.",
          pe(a) || "Unknown"
        );
      });
    }
    function fy(e, t, a, i, o) {
      if (a.flags |= 32768, qu && vf(e, o), i !== null && typeof i == "object" && typeof i.then == "function") {
        if (t = a.alternate, t !== null && qn(
          t,
          a,
          o,
          !0
        ), st && (yc = !0), a = au.current, a !== null) {
          switch (a.tag) {
            case 31:
            case 13:
              return $u === null ? yf() : a.alternate === null && hl === _o && (hl = pv), a.flags &= -257, a.flags |= 65536, a.lanes = o, i === fv ? a.flags |= 16384 : (t = a.updateQueue, t === null ? a.updateQueue = /* @__PURE__ */ new Set([i]) : t.add(i), fh(e, i, o)), !1;
            case 22:
              return a.flags |= 65536, i === fv ? a.flags |= 16384 : (t = a.updateQueue, t === null ? (t = {
                transitions: null,
                markerInstances: null,
                retryQueue: /* @__PURE__ */ new Set([i])
              }, a.updateQueue = t) : (a = t.retryQueue, a === null ? t.retryQueue = /* @__PURE__ */ new Set([i]) : a.add(i)), fh(e, i, o)), !1;
          }
          throw Error(
            "Unexpected Suspense handler tag (" + a.tag + "). This is a bug in React."
          );
        }
        return fh(e, i, o), yf(), !1;
      }
      if (st)
        return yc = !0, t = au.current, t !== null ? ((t.flags & 65536) === 0 && (t.flags |= 256), t.flags |= 65536, t.lanes = o, i !== D1 && Ds(
          da(
            Error(
              "There was an error while hydrating but React was able to recover by instead client rendering from the nearest Suspense boundary.",
              { cause: i }
            ),
            a
          )
        )) : (i !== D1 && Ds(
          da(
            Error(
              "There was an error while hydrating but React was able to recover by instead client rendering the entire root.",
              { cause: i }
            ),
            a
          )
        ), e = e.current.alternate, e.flags |= 65536, o &= -o, e.lanes |= o, i = da(i, a), o = Ld(
          e.stateNode,
          i,
          o
        ), Us(e, o), hl !== Pf && (hl = Xr)), !1;
      var f = da(
        Error(
          "There was an error during concurrent rendering but React was able to recover by instead synchronously rendering the entire root.",
          { cause: i }
        ),
        a
      );
      if (n0 === null ? n0 = [f] : n0.push(f), hl !== Pf && (hl = Xr), t === null) return !0;
      i = da(i, a), a = t;
      do {
        switch (a.tag) {
          case 3:
            return a.flags |= 65536, e = o & -o, a.lanes |= e, e = Ld(
              a.stateNode,
              i,
              e
            ), Us(a, e), !1;
          case 1:
            if (t = a.type, f = a.stateNode, (a.flags & 128) === 0 && (typeof t.getDerivedStateFromError == "function" || f !== null && typeof f.componentDidCatch == "function" && (as === null || !as.has(f))))
              return a.flags |= 65536, o &= -o, a.lanes |= o, o = Xd(o), Qd(
                o,
                e,
                a,
                i
              ), Us(a, o), !1;
        }
        a = a.return;
      } while (a !== null);
      return !1;
    }
    function ql(e, t, a, i) {
      t.child = e === null ? mS(t, null, a, i) : Gr(
        t,
        e.child,
        a,
        i
      );
    }
    function Z0(e, t, a, i, o) {
      a = a.render;
      var f = t.ref;
      if ("ref" in i) {
        var d = {};
        for (var h in i)
          h !== "ref" && (d[h] = i[h]);
      } else d = i;
      return Xi(t), i = ty(
        e,
        t,
        a,
        d,
        f,
        o
      ), h = Lc(), e !== null && !Zl ? (ws(e, t, o), Zn(e, t, o)) : (st && h && Ed(t), t.flags |= 1, ql(e, t, i, o), t.child);
    }
    function sy(e, t, a, i, o) {
      if (e === null) {
        var f = a.type;
        return typeof f == "function" && !Xm(f) && f.defaultProps === void 0 && a.compare === null ? (a = Bi(f), t.tag = 15, t.type = a, of(t, f), ry(
          e,
          t,
          a,
          i,
          o
        )) : (e = Uc(
          a.type,
          null,
          i,
          t,
          t.mode,
          o
        ), e.ref = t.ref, e.return = t, t.child = e);
      }
      if (f = e.child, !$d(e, o)) {
        var d = f.memoizedProps;
        if (a = a.compare, a = a !== null ? a : Qo, a(d, i) && e.ref === t.ref)
          return Zn(
            e,
            t,
            o
          );
      }
      return t.flags |= 1, e = yu(f, i), e.ref = t.ref, e.return = t, t.child = e;
    }
    function ry(e, t, a, i, o) {
      if (e !== null) {
        var f = e.memoizedProps;
        if (Qo(f, i) && e.ref === t.ref && t.type === e.type)
          if (Zl = !1, t.pendingProps = i = f, $d(e, o))
            (e.flags & 131072) !== 0 && (Zl = !0);
          else
            return t.lanes = e.lanes, Zn(e, t, o);
      }
      return yy(
        e,
        t,
        a,
        i,
        o
      );
    }
    function dy(e, t, a, i) {
      var o = i.children, f = e !== null ? e.memoizedState : null;
      if (e === null && t.stateNode === null && (t.stateNode = {
        _visibility: Np,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      }), i.mode === "hidden") {
        if ((t.flags & 128) !== 0) {
          if (f = f !== null ? f.baseLanes | a : a, e !== null) {
            for (i = t.child = e.child, o = 0; i !== null; )
              o = o | i.lanes | i.childLanes, i = i.sibling;
            i = o & ~f;
          } else i = 0, t.child = null;
          return hy(
            e,
            t,
            f,
            a,
            i
          );
        }
        if ((a & 536870912) !== 0)
          t.memoizedState = { baseLanes: 0, cachePool: null }, e !== null && ko(
            t,
            f !== null ? f.cachePool : null
          ), f !== null ? Md(t, f) : ii(t), Cd(t);
        else
          return i = t.lanes = 536870912, hy(
            e,
            t,
            f !== null ? f.baseLanes | a : a,
            a,
            i
          );
      } else
        f !== null ? (ko(t, f.cachePool), Md(t, f), Eu(t), t.memoizedState = null) : (e !== null && ko(t, null), ii(t), Eu(t));
      return ql(e, t, o, a), t.child;
    }
    function Fc(e, t) {
      return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
        _visibility: Np,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      }), t.sibling;
    }
    function hy(e, t, a, i, o) {
      var f = ui();
      return f = f === null ? null : {
        parent: Xl._currentValue,
        pool: f
      }, t.memoizedState = {
        baseLanes: a,
        cachePool: f
      }, e !== null && ko(t, null), ii(t), Cd(t), e !== null && qn(e, t, i, !0), t.childLanes = o, null;
    }
    function $s(e, t) {
      var a = t.hidden;
      return a !== void 0 && console.error(
        `<Activity> doesn't accept a hidden prop. Use mode="hidden" instead.
- <Activity %s>
+ <Activity %s>`,
        a === !0 ? "hidden" : a === !1 ? "hidden={false}" : "hidden={...}",
        a ? 'mode="hidden"' : 'mode="visible"'
      ), t = Ws(
        { mode: t.mode, children: t.children },
        e.mode
      ), t.ref = e.ref, e.child = t, t.return = e, t;
    }
    function my(e, t, a) {
      return Gr(t, e.child, null, a), e = $s(
        t,
        t.pendingProps
      ), e.flags |= 2, Bl(t), t.memoizedState = null, e;
    }
    function J0(e, t, a) {
      var i = t.pendingProps, o = (t.flags & 128) !== 0;
      if (t.flags &= -129, e === null) {
        if (st) {
          if (i.mode === "hidden")
            return e = $s(t, i), t.lanes = 536870912, Fc(null, e);
          if (Qn(t), (e = ll) ? (a = Rt(
            e,
            Ju
          ), a = a !== null && a.data === $r ? a : null, a !== null && (i = {
            dehydrated: a,
            treeContext: w0(),
            retryLane: 536870912,
            hydrationErrors: null
          }, t.memoizedState = i, i = Vm(a), i.return = t, t.child = i, _a = t, ll = null)) : a = null, a === null)
            throw na(t, e), gn(t);
          return t.lanes = 536870912, null;
        }
        return $s(t, i);
      }
      var f = e.memoizedState;
      if (f !== null) {
        var d = f.dehydrated;
        if (Qn(t), o)
          if (t.flags & 256)
            t.flags &= -257, t = my(
              e,
              t,
              a
            );
          else if (t.memoizedState !== null)
            t.child = e.child, t.flags |= 128, t = null;
          else
            throw Error(
              "Client rendering an Activity suspended it again. This is a bug in React."
            );
        else if (Y0(), (a & 536870912) !== 0 && mf(t), Zl || qn(
          e,
          t,
          a,
          !1
        ), o = (a & e.childLanes) !== 0, Zl || o) {
          if (i = Zt, i !== null && (d = Ec(
            i,
            a
          ), d !== 0 && d !== f.retryLane))
            throw f.retryLane = d, aa(e, d), Ge(i, e, d), Z1;
          yf(), t = my(
            e,
            t,
            a
          );
        } else
          e = f.treeContext, ll = an(
            d.nextSibling
          ), _a = t, st = !0, Kf = null, yc = !1, lu = null, Ju = !1, e !== null && B0(t, e), t = $s(t, i), t.flags |= 4096;
        return t;
      }
      return f = e.child, i = { mode: i.mode, children: i.children }, (a & 536870912) !== 0 && (a & e.lanes) !== 0 && mf(t), e = yu(f, i), e.ref = t.ref, t.child = e, e.return = t, e;
    }
    function ks(e, t) {
      var a = t.ref;
      if (a === null)
        e !== null && e.ref !== null && (t.flags |= 4194816);
      else {
        if (typeof a != "function" && typeof a != "object")
          throw Error(
            "Expected ref to be a function, an object returned by React.createRef(), or undefined/null."
          );
        (e === null || e.ref !== a) && (t.flags |= 4194816);
      }
    }
    function yy(e, t, a, i, o) {
      if (a.prototype && typeof a.prototype.render == "function") {
        var f = We(a) || "Unknown";
        jS[f] || (console.error(
          "The <%s /> component appears to have a render method, but doesn't extend React.Component. This is likely to cause errors. Change %s to extend React.Component instead.",
          f,
          f
        ), jS[f] = !0);
      }
      return t.mode & wa && Ai.recordLegacyContextWarning(
        t,
        null
      ), e === null && (of(t, t.type), a.contextTypes && (f = We(a) || "Unknown", BS[f] || (BS[f] = !0, console.error(
        "%s uses the legacy contextTypes API which was removed in React 19. Use React.createContext() with React.useContext() instead. (https://react.dev/link/legacy-context)",
        f
      )))), Xi(t), a = ty(
        e,
        t,
        a,
        i,
        void 0,
        o
      ), i = Lc(), e !== null && !Zl ? (ws(e, t, o), Zn(e, t, o)) : (st && i && Ed(t), t.flags |= 1, ql(e, t, a, o), t.child);
    }
    function py(e, t, a, i, o, f) {
      return Xi(t), zo = -1, Fp = e !== null && e.type !== t.type, t.updateQueue = null, a = Hs(
        t,
        i,
        a,
        o
      ), yl(e, t), i = Lc(), e !== null && !Zl ? (ws(e, t, f), Zn(e, t, f)) : (st && i && Ed(t), t.flags |= 1, ql(e, t, a, f), t.child);
    }
    function Ic(e, t, a, i, o) {
      switch (Te(t)) {
        case !1:
          var f = t.stateNode, d = new t.type(
            t.memoizedProps,
            f.context
          ).state;
          f.updater.enqueueSetState(f, d, null);
          break;
        case !0:
          t.flags |= 128, t.flags |= 65536, f = Error("Simulated error coming from DevTools");
          var h = o & -o;
          if (t.lanes |= h, d = Zt, d === null)
            throw Error(
              "Expected a work-in-progress root. This is a bug in React. Please file an issue."
            );
          h = Xd(h), Qd(
            h,
            d,
            t,
            da(f, t)
          ), Us(t, h);
      }
      if (Xi(t), t.stateNode === null) {
        if (d = Jf, f = a.contextType, "contextType" in a && f !== null && (f === void 0 || f.$$typeof !== Pn) && !NS.has(a) && (NS.add(a), h = f === void 0 ? " However, it is set to undefined. This can be caused by a typo or by mixing up named and default imports. This can also happen due to a circular dependency, so try moving the createContext() call to a separate file." : typeof f != "object" ? " However, it is set to a " + typeof f + "." : f.$$typeof === xh ? " Did you accidentally pass the Context.Consumer instead?" : " However, it is set to an object with keys {" + Object.keys(f).join(", ") + "}.", console.error(
          "%s defines an invalid contextType. contextType should point to the Context object returned by React.createContext().%s",
          We(a) || "Component",
          h
        )), typeof f == "object" && f !== null && (d = Et(f)), f = new a(i, d), t.mode & wa) {
          ge(!0);
          try {
            f = new a(i, d);
          } finally {
            ge(!1);
          }
        }
        if (d = t.memoizedState = f.state !== null && f.state !== void 0 ? f.state : null, f.updater = Q1, t.stateNode = f, f._reactInternals = t, f._reactInternalInstance = OS, typeof a.getDerivedStateFromProps == "function" && d === null && (d = We(a) || "Component", DS.has(d) || (DS.add(d), console.error(
          "`%s` uses `getDerivedStateFromProps` but its initial state is %s. This is not recommended. Instead, define the initial state by assigning an object to `this.state` in the constructor of `%s`. This ensures that `getDerivedStateFromProps` arguments have a consistent shape.",
          d,
          f.state === null ? "null" : "undefined",
          d
        ))), typeof a.getDerivedStateFromProps == "function" || typeof f.getSnapshotBeforeUpdate == "function") {
          var y = h = d = null;
          if (typeof f.componentWillMount == "function" && f.componentWillMount.__suppressDeprecationWarning !== !0 ? d = "componentWillMount" : typeof f.UNSAFE_componentWillMount == "function" && (d = "UNSAFE_componentWillMount"), typeof f.componentWillReceiveProps == "function" && f.componentWillReceiveProps.__suppressDeprecationWarning !== !0 ? h = "componentWillReceiveProps" : typeof f.UNSAFE_componentWillReceiveProps == "function" && (h = "UNSAFE_componentWillReceiveProps"), typeof f.componentWillUpdate == "function" && f.componentWillUpdate.__suppressDeprecationWarning !== !0 ? y = "componentWillUpdate" : typeof f.UNSAFE_componentWillUpdate == "function" && (y = "UNSAFE_componentWillUpdate"), d !== null || h !== null || y !== null) {
            f = We(a) || "Component";
            var p = typeof a.getDerivedStateFromProps == "function" ? "getDerivedStateFromProps()" : "getSnapshotBeforeUpdate()";
            RS.has(f) || (RS.add(f), console.error(
              `Unsafe legacy lifecycles will not be called for components using new component APIs.

%s uses %s but also contains the following legacy lifecycles:%s%s%s

The above lifecycles should be removed. Learn more about this warning here:
https://react.dev/link/unsafe-component-lifecycles`,
              f,
              p,
              d !== null ? `
  ` + d : "",
              h !== null ? `
  ` + h : "",
              y !== null ? `
  ` + y : ""
            ));
          }
        }
        f = t.stateNode, d = We(a) || "Component", f.render || (a.prototype && typeof a.prototype.render == "function" ? console.error(
          "No `render` method found on the %s instance: did you accidentally return an object from the constructor?",
          d
        ) : console.error(
          "No `render` method found on the %s instance: you may have forgotten to define `render`.",
          d
        )), !f.getInitialState || f.getInitialState.isReactClassApproved || f.state || console.error(
          "getInitialState was defined on %s, a plain JavaScript class. This is only supported for classes created using React.createClass. Did you mean to define a state property instead?",
          d
        ), f.getDefaultProps && !f.getDefaultProps.isReactClassApproved && console.error(
          "getDefaultProps was defined on %s, a plain JavaScript class. This is only supported for classes created using React.createClass. Use a static property to define defaultProps instead.",
          d
        ), f.contextType && console.error(
          "contextType was defined as an instance property on %s. Use a static property to define contextType instead.",
          d
        ), a.childContextTypes && !US.has(a) && (US.add(a), console.error(
          "%s uses the legacy childContextTypes API which was removed in React 19. Use React.createContext() instead. (https://react.dev/link/legacy-context)",
          d
        )), a.contextTypes && !xS.has(a) && (xS.add(a), console.error(
          "%s uses the legacy contextTypes API which was removed in React 19. Use React.createContext() with static contextType instead. (https://react.dev/link/legacy-context)",
          d
        )), typeof f.componentShouldUpdate == "function" && console.error(
          "%s has a method called componentShouldUpdate(). Did you mean shouldComponentUpdate()? The name is phrased as a question because the function is expected to return a value.",
          d
        ), a.prototype && a.prototype.isPureReactComponent && typeof f.shouldComponentUpdate < "u" && console.error(
          "%s has a method called shouldComponentUpdate(). shouldComponentUpdate should not be used when extending React.PureComponent. Please extend React.Component if shouldComponentUpdate is used.",
          We(a) || "A pure component"
        ), typeof f.componentDidUnmount == "function" && console.error(
          "%s has a method called componentDidUnmount(). But there is no such lifecycle method. Did you mean componentWillUnmount()?",
          d
        ), typeof f.componentDidReceiveProps == "function" && console.error(
          "%s has a method called componentDidReceiveProps(). But there is no such lifecycle method. If you meant to update the state in response to changing props, use componentWillReceiveProps(). If you meant to fetch data or run side-effects or mutations after React has updated the UI, use componentDidUpdate().",
          d
        ), typeof f.componentWillRecieveProps == "function" && console.error(
          "%s has a method called componentWillRecieveProps(). Did you mean componentWillReceiveProps()?",
          d
        ), typeof f.UNSAFE_componentWillRecieveProps == "function" && console.error(
          "%s has a method called UNSAFE_componentWillRecieveProps(). Did you mean UNSAFE_componentWillReceiveProps()?",
          d
        ), h = f.props !== i, f.props !== void 0 && h && console.error(
          "When calling super() in `%s`, make sure to pass up the same props that your component's constructor was passed.",
          d
        ), f.defaultProps && console.error(
          "Setting defaultProps as an instance property on %s is not supported and will be ignored. Instead, define defaultProps as a static property on %s.",
          d,
          d
        ), typeof f.getSnapshotBeforeUpdate != "function" || typeof f.componentDidUpdate == "function" || _S.has(a) || (_S.add(a), console.error(
          "%s: getSnapshotBeforeUpdate() should be used with componentDidUpdate(). This component defines getSnapshotBeforeUpdate() only.",
          We(a)
        )), typeof f.getDerivedStateFromProps == "function" && console.error(
          "%s: getDerivedStateFromProps() is defined as an instance method and will be ignored. Instead, declare it as a static method.",
          d
        ), typeof f.getDerivedStateFromError == "function" && console.error(
          "%s: getDerivedStateFromError() is defined as an instance method and will be ignored. Instead, declare it as a static method.",
          d
        ), typeof a.getSnapshotBeforeUpdate == "function" && console.error(
          "%s: getSnapshotBeforeUpdate() is defined as a static method and will be ignored. Instead, declare it as an instance method.",
          d
        ), (h = f.state) && (typeof h != "object" || Al(h)) && console.error("%s.state: must be set to an object or null", d), typeof f.getChildContext == "function" && typeof a.childContextTypes != "object" && console.error(
          "%s.getChildContext(): childContextTypes must be defined in order to use getChildContext().",
          d
        ), f = t.stateNode, f.props = i, f.state = t.memoizedState, f.refs = {}, ot(t), d = a.contextType, f.context = typeof d == "object" && d !== null ? Et(d) : Jf, f.state === i && (d = We(a) || "Component", MS.has(d) || (MS.add(d), console.error(
          "%s: It is not recommended to assign props directly to state because updates to props won't be reflected in state. In most cases, it is better to use props directly.",
          d
        ))), t.mode & wa && Ai.recordLegacyContextWarning(
          t,
          f
        ), Ai.recordUnsafeLifecycleWarnings(
          t,
          f
        ), f.state = t.memoizedState, d = a.getDerivedStateFromProps, typeof d == "function" && (cf(
          t,
          a,
          d,
          i
        ), f.state = t.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof f.getSnapshotBeforeUpdate == "function" || typeof f.UNSAFE_componentWillMount != "function" && typeof f.componentWillMount != "function" || (d = f.state, typeof f.componentWillMount == "function" && f.componentWillMount(), typeof f.UNSAFE_componentWillMount == "function" && f.UNSAFE_componentWillMount(), d !== f.state && (console.error(
          "%s.componentWillMount(): Assigning directly to this.state is deprecated (except inside a component's constructor). Use setState instead.",
          pe(t) || "Component"
        ), Q1.enqueueReplaceState(
          f,
          f.state,
          null
        )), Su(t, i, f, o), Fo(), f.state = t.memoizedState), typeof f.componentDidMount == "function" && (t.flags |= 4194308), (t.mode & Ti) !== qe && (t.flags |= 134217728), f = !0;
      } else if (e === null) {
        f = t.stateNode;
        var z = t.memoizedProps;
        h = Du(a, z), f.props = h;
        var R = f.context;
        y = a.contextType, d = Jf, typeof y == "object" && y !== null && (d = Et(y)), p = a.getDerivedStateFromProps, y = typeof p == "function" || typeof f.getSnapshotBeforeUpdate == "function", z = t.pendingProps !== z, y || typeof f.UNSAFE_componentWillReceiveProps != "function" && typeof f.componentWillReceiveProps != "function" || (z || R !== d) && zu(
          t,
          f,
          i,
          d
        ), If = !1;
        var E = t.memoizedState;
        f.state = E, Su(t, i, f, o), Fo(), R = t.memoizedState, z || E !== R || If ? (typeof p == "function" && (cf(
          t,
          a,
          p,
          i
        ), R = t.memoizedState), (h = If || Yd(
          t,
          a,
          h,
          i,
          E,
          R,
          d
        )) ? (y || typeof f.UNSAFE_componentWillMount != "function" && typeof f.componentWillMount != "function" || (typeof f.componentWillMount == "function" && f.componentWillMount(), typeof f.UNSAFE_componentWillMount == "function" && f.UNSAFE_componentWillMount()), typeof f.componentDidMount == "function" && (t.flags |= 4194308), (t.mode & Ti) !== qe && (t.flags |= 134217728)) : (typeof f.componentDidMount == "function" && (t.flags |= 4194308), (t.mode & Ti) !== qe && (t.flags |= 134217728), t.memoizedProps = i, t.memoizedState = R), f.props = i, f.state = R, f.context = d, f = h) : (typeof f.componentDidMount == "function" && (t.flags |= 4194308), (t.mode & Ti) !== qe && (t.flags |= 134217728), f = !1);
      } else {
        f = t.stateNode, vu(e, t), d = t.memoizedProps, y = Du(a, d), f.props = y, p = t.pendingProps, E = f.context, R = a.contextType, h = Jf, typeof R == "object" && R !== null && (h = Et(R)), z = a.getDerivedStateFromProps, (R = typeof z == "function" || typeof f.getSnapshotBeforeUpdate == "function") || typeof f.UNSAFE_componentWillReceiveProps != "function" && typeof f.componentWillReceiveProps != "function" || (d !== p || E !== h) && zu(
          t,
          f,
          i,
          h
        ), If = !1, E = t.memoizedState, f.state = E, Su(t, i, f, o), Fo();
        var q = t.memoizedState;
        d !== p || E !== q || If || e !== null && e.dependencies !== null && Ko(e.dependencies) ? (typeof z == "function" && (cf(
          t,
          a,
          z,
          i
        ), q = t.memoizedState), (y = If || Yd(
          t,
          a,
          y,
          i,
          E,
          q,
          h
        ) || e !== null && e.dependencies !== null && Ko(e.dependencies)) ? (R || typeof f.UNSAFE_componentWillUpdate != "function" && typeof f.componentWillUpdate != "function" || (typeof f.componentWillUpdate == "function" && f.componentWillUpdate(i, q, h), typeof f.UNSAFE_componentWillUpdate == "function" && f.UNSAFE_componentWillUpdate(
          i,
          q,
          h
        )), typeof f.componentDidUpdate == "function" && (t.flags |= 4), typeof f.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof f.componentDidUpdate != "function" || d === e.memoizedProps && E === e.memoizedState || (t.flags |= 4), typeof f.getSnapshotBeforeUpdate != "function" || d === e.memoizedProps && E === e.memoizedState || (t.flags |= 1024), t.memoizedProps = i, t.memoizedState = q), f.props = i, f.state = q, f.context = h, f = y) : (typeof f.componentDidUpdate != "function" || d === e.memoizedProps && E === e.memoizedState || (t.flags |= 4), typeof f.getSnapshotBeforeUpdate != "function" || d === e.memoizedProps && E === e.memoizedState || (t.flags |= 1024), f = !1);
      }
      if (h = f, ks(e, t), d = (t.flags & 128) !== 0, h || d) {
        if (h = t.stateNode, Ri(t), d && typeof a.getDerivedStateFromError != "function")
          a = null, fn = -1;
        else if (a = eS(h), t.mode & wa) {
          ge(!0);
          try {
            eS(h);
          } finally {
            ge(!1);
          }
        }
        t.flags |= 1, e !== null && d ? (t.child = Gr(
          t,
          e.child,
          null,
          o
        ), t.child = Gr(
          t,
          null,
          a,
          o
        )) : ql(e, t, a, o), t.memoizedState = h.state, e = t.child;
      } else
        e = Zn(
          e,
          t,
          o
        );
      return o = t.stateNode, f && o.props !== i && (sm || console.error(
        "It looks like %s is reassigning its own `this.props` while rendering. This is not supported and can lead to confusing bugs.",
        pe(t) || "a component"
      ), sm = !0), e;
    }
    function gy(e, t, a, i) {
      return Gi(), t.flags |= 256, ql(e, t, a, i), t.child;
    }
    function of(e, t) {
      t && t.childContextTypes && console.error(
        `childContextTypes cannot be defined on a function component.
  %s.childContextTypes = ...`,
        t.displayName || t.name || "Component"
      ), typeof t.getDerivedStateFromProps == "function" && (e = We(t) || "Unknown", YS[e] || (console.error(
        "%s: Function components do not support getDerivedStateFromProps.",
        e
      ), YS[e] = !0)), typeof t.contextType == "object" && t.contextType !== null && (t = We(t) || "Unknown", wS[t] || (console.error(
        "%s: Function components do not support contextType.",
        t
      ), wS[t] = !0));
    }
    function ff(e) {
      return { baseLanes: e, cachePool: Wm() };
    }
    function Vd(e, t, a) {
      return e = e !== null ? e.childLanes & ~a : 0, t && (e |= Cn), e;
    }
    function Zd(e, t, a) {
      var i, o = t.pendingProps;
      oe(t) && (t.flags |= 128);
      var f = !1, d = (t.flags & 128) !== 0;
      if ((i = d) || (i = e !== null && e.memoizedState === null ? !1 : (xl.current & kp) !== 0), i && (f = !0, t.flags &= -129), i = (t.flags & 32) !== 0, t.flags &= -33, e === null) {
        if (st) {
          if (f ? pa(t) : Eu(t), (e = ll) ? (a = Rt(
            e,
            Ju
          ), a = a !== null && a.data !== $r ? a : null, a !== null && (i = {
            dehydrated: a,
            treeContext: w0(),
            retryLane: 536870912,
            hydrationErrors: null
          }, t.memoizedState = i, i = Vm(a), i.return = t, t.child = i, _a = t, ll = null)) : a = null, a === null)
            throw na(t, e), gn(t);
          return Wy(a) ? t.lanes = 32 : t.lanes = 536870912, null;
        }
        var h = o.children;
        if (o = o.fallback, f) {
          Eu(t);
          var y = t.mode;
          return h = Ws(
            { mode: "hidden", children: h },
            y
          ), o = Nc(
            o,
            y,
            a,
            null
          ), h.return = t, o.return = t, h.sibling = o, t.child = h, o = t.child, o.memoizedState = ff(a), o.childLanes = Vd(
            e,
            i,
            a
          ), t.memoizedState = J1, Fc(
            null,
            o
          );
        }
        return pa(t), vy(
          t,
          h
        );
      }
      var p = e.memoizedState;
      if (p !== null) {
        var z = p.dehydrated;
        if (z !== null) {
          if (d)
            t.flags & 256 ? (pa(t), t.flags &= -257, t = Jd(
              e,
              t,
              a
            )) : t.memoizedState !== null ? (Eu(t), t.child = e.child, t.flags |= 128, t = null) : (Eu(t), h = o.fallback, y = t.mode, o = Ws(
              {
                mode: "visible",
                children: o.children
              },
              y
            ), h = Nc(
              h,
              y,
              a,
              null
            ), h.flags |= 2, o.return = t, h.return = t, o.sibling = h, t.child = o, Gr(
              t,
              e.child,
              null,
              a
            ), o = t.child, o.memoizedState = ff(a), o.childLanes = Vd(
              e,
              i,
              a
            ), t.memoizedState = J1, t = Fc(
              null,
              o
            ));
          else if (pa(t), Y0(), (a & 536870912) !== 0 && mf(t), Wy(
            z
          )) {
            if (i = z.nextSibling && z.nextSibling.dataset, i) {
              h = i.dgst;
              var R = i.msg;
              y = i.stck;
              var E = i.cstck;
            }
            f = R, i = h, o = y, z = E, h = f, y = z, h = Error(h || "The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering."), h.stack = o || "", h.digest = i, i = y === void 0 ? null : y, o = {
              value: h,
              source: null,
              stack: i
            }, typeof i == "string" && z1.set(
              h,
              o
            ), Ds(o), t = Jd(
              e,
              t,
              a
            );
          } else if (Zl || qn(
            e,
            t,
            a,
            !1
          ), i = (a & e.childLanes) !== 0, Zl || i) {
            if (i = Zt, i !== null && (o = Ec(
              i,
              a
            ), o !== 0 && o !== p.retryLane))
              throw p.retryLane = o, aa(
                e,
                o
              ), Ge(
                i,
                e,
                o
              ), Z1;
            mr(
              z
            ) || yf(), t = Jd(
              e,
              t,
              a
            );
          } else
            mr(
              z
            ) ? (t.flags |= 192, t.child = e.child, t = null) : (e = p.treeContext, ll = an(
              z.nextSibling
            ), _a = t, st = !0, Kf = null, yc = !1, lu = null, Ju = !1, e !== null && B0(t, e), t = vy(
              t,
              o.children
            ), t.flags |= 4096);
          return t;
        }
      }
      return f ? (Eu(t), h = o.fallback, y = t.mode, E = e.child, z = E.sibling, o = yu(
        E,
        {
          mode: "hidden",
          children: o.children
        }
      ), o.subtreeFlags = E.subtreeFlags & 65011712, z !== null ? h = yu(
        z,
        h
      ) : (h = Nc(
        h,
        y,
        a,
        null
      ), h.flags |= 2), h.return = t, o.return = t, o.sibling = h, t.child = o, Fc(null, o), o = t.child, h = e.child.memoizedState, h === null ? h = ff(a) : (y = h.cachePool, y !== null ? (E = Xl._currentValue, y = y.parent !== E ? { parent: E, pool: E } : y) : y = Wm(), h = {
        baseLanes: h.baseLanes | a,
        cachePool: y
      }), o.memoizedState = h, o.childLanes = Vd(
        e,
        i,
        a
      ), t.memoizedState = J1, Fc(
        e.child,
        o
      )) : (p !== null && (a & 62914560) === a && (a & e.lanes) !== 0 && mf(t), pa(t), a = e.child, e = a.sibling, a = yu(a, {
        mode: "visible",
        children: o.children
      }), a.return = t, a.sibling = null, e !== null && (i = t.deletions, i === null ? (t.deletions = [e], t.flags |= 16) : i.push(e)), t.child = a, t.memoizedState = null, a);
    }
    function vy(e, t) {
      return t = Ws(
        { mode: "visible", children: t },
        e.mode
      ), t.return = e, e.child = t;
    }
    function Ws(e, t) {
      return e = C(22, e, null, t), e.lanes = 0, e;
    }
    function Jd(e, t, a) {
      return Gr(t, e.child, null, a), e = vy(
        t,
        t.pendingProps.children
      ), e.flags |= 2, t.memoizedState = null, e;
    }
    function by(e, t, a) {
      e.lanes |= t;
      var i = e.alternate;
      i !== null && (i.lanes |= t), Ad(
        e.return,
        t,
        a
      );
    }
    function Kd(e, t, a, i, o, f) {
      var d = e.memoizedState;
      d === null ? e.memoizedState = {
        isBackwards: t,
        rendering: null,
        renderingStartTime: 0,
        last: i,
        tail: a,
        tailMode: o,
        treeForkCount: f
      } : (d.isBackwards = t, d.rendering = null, d.renderingStartTime = 0, d.last = i, d.tail = a, d.tailMode = o, d.treeForkCount = f);
    }
    function Sy(e, t, a) {
      var i = t.pendingProps, o = i.revealOrder, f = i.tail, d = i.children, h = xl.current;
      if ((i = (h & kp) !== 0) ? (h = h & im | kp, t.flags |= 128) : h &= im, Ve(xl, h, t), h = o ?? "null", o !== "forwards" && o !== "unstable_legacy-backwards" && o !== "together" && o !== "independent" && !qS[h])
        if (qS[h] = !0, o == null)
          console.error(
            'The default for the <SuspenseList revealOrder="..."> prop is changing. To be future compatible you must explictly specify either "independent" (the current default), "together", "forwards" or "legacy_unstable-backwards".'
          );
        else if (o === "backwards")
          console.error(
            'The rendering order of <SuspenseList revealOrder="backwards"> is changing. To be future compatible you must specify revealOrder="legacy_unstable-backwards" instead.'
          );
        else if (typeof o == "string")
          switch (o.toLowerCase()) {
            case "together":
            case "forwards":
            case "backwards":
            case "independent":
              console.error(
                '"%s" is not a valid value for revealOrder on <SuspenseList />. Use lowercase "%s" instead.',
                o,
                o.toLowerCase()
              );
              break;
            case "forward":
            case "backward":
              console.error(
                '"%s" is not a valid value for revealOrder on <SuspenseList />. React uses the -s suffix in the spelling. Use "%ss" instead.',
                o,
                o.toLowerCase()
              );
              break;
            default:
              console.error(
                '"%s" is not a supported revealOrder on <SuspenseList />. Did you mean "independent", "together", "forwards" or "backwards"?',
                o
              );
          }
        else
          console.error(
            '%s is not a supported value for revealOrder on <SuspenseList />. Did you mean "independent", "together", "forwards" or "backwards"?',
            o
          );
      h = f ?? "null", yv[h] || (f == null ? (o === "forwards" || o === "backwards" || o === "unstable_legacy-backwards") && (yv[h] = !0, console.error(
        'The default for the <SuspenseList tail="..."> prop is changing. To be future compatible you must explictly specify either "visible" (the current default), "collapsed" or "hidden".'
      )) : f !== "visible" && f !== "collapsed" && f !== "hidden" ? (yv[h] = !0, console.error(
        '"%s" is not a supported value for tail on <SuspenseList />. Did you mean "visible", "collapsed" or "hidden"?',
        f
      )) : o !== "forwards" && o !== "backwards" && o !== "unstable_legacy-backwards" && (yv[h] = !0, console.error(
        '<SuspenseList tail="%s" /> is only valid if revealOrder is "forwards" or "backwards". Did you mean to specify revealOrder="forwards"?',
        f
      )));
      e: if ((o === "forwards" || o === "backwards" || o === "unstable_legacy-backwards") && d !== void 0 && d !== null && d !== !1)
        if (Al(d)) {
          for (h = 0; h < d.length; h++)
            if (!Lt(
              d[h],
              h
            ))
              break e;
        } else if (h = je(d), typeof h == "function") {
          if (h = h.call(d))
            for (var y = h.next(), p = 0; !y.done; y = h.next()) {
              if (!Lt(y.value, p)) break e;
              p++;
            }
        } else
          console.error(
            'A single row was passed to a <SuspenseList revealOrder="%s" />. This is not useful since it needs multiple rows. Did you mean to pass multiple children or an array?',
            o
          );
      if (ql(e, t, d, a), st ? (qi(), d = Hp) : d = 0, !i && e !== null && (e.flags & 128) !== 0)
        e: for (e = t.child; e !== null; ) {
          if (e.tag === 13)
            e.memoizedState !== null && by(e, a, t);
          else if (e.tag === 19)
            by(e, a, t);
          else if (e.child !== null) {
            e.child.return = e, e = e.child;
            continue;
          }
          if (e === t) break e;
          for (; e.sibling === null; ) {
            if (e.return === null || e.return === t)
              break e;
            e = e.return;
          }
          e.sibling.return = e.return, e = e.sibling;
        }
      switch (o) {
        case "forwards":
          for (a = t.child, o = null; a !== null; )
            e = a.alternate, e !== null && Gc(e) === null && (o = a), a = a.sibling;
          a = o, a === null ? (o = t.child, t.child = null) : (o = a.sibling, a.sibling = null), Kd(
            t,
            !1,
            o,
            a,
            f,
            d
          );
          break;
        case "backwards":
        case "unstable_legacy-backwards":
          for (a = null, o = t.child, t.child = null; o !== null; ) {
            if (e = o.alternate, e !== null && Gc(e) === null) {
              t.child = o;
              break;
            }
            e = o.sibling, o.sibling = a, a = o, o = e;
          }
          Kd(
            t,
            !0,
            a,
            null,
            f,
            d
          );
          break;
        case "together":
          Kd(
            t,
            !1,
            null,
            null,
            void 0,
            d
          );
          break;
        default:
          t.memoizedState = null;
      }
      return t.child;
    }
    function Zn(e, t, a) {
      if (e !== null && (t.dependencies = e.dependencies), fn = -1, ts |= t.lanes, (a & t.childLanes) === 0)
        if (e !== null) {
          if (qn(
            e,
            t,
            a,
            !1
          ), (a & t.childLanes) === 0)
            return null;
        } else return null;
      if (e !== null && t.child !== e.child)
        throw Error("Resuming work not yet implemented.");
      if (t.child !== null) {
        for (e = t.child, a = yu(e, e.pendingProps), t.child = a, a.return = t; e.sibling !== null; )
          e = e.sibling, a = a.sibling = yu(e, e.pendingProps), a.return = t;
        a.sibling = null;
      }
      return t.child;
    }
    function $d(e, t) {
      return (e.lanes & t) !== 0 ? !0 : (e = e.dependencies, !!(e !== null && Ko(e)));
    }
    function K0(e, t, a) {
      switch (t.tag) {
        case 3:
          Gt(
            t,
            t.stateNode.containerInfo
          ), vn(
            t,
            Xl,
            e.memoizedState.cache
          ), Gi();
          break;
        case 27:
        case 5:
          ne(t);
          break;
        case 4:
          Gt(
            t,
            t.stateNode.containerInfo
          );
          break;
        case 10:
          vn(
            t,
            t.type,
            t.memoizedProps.value
          );
          break;
        case 12:
          (a & t.childLanes) !== 0 && (t.flags |= 4), t.flags |= 2048;
          var i = t.stateNode;
          i.effectDuration = -0, i.passiveEffectDuration = -0;
          break;
        case 31:
          if (t.memoizedState !== null)
            return t.flags |= 128, Qn(t), null;
          break;
        case 13:
          if (i = t.memoizedState, i !== null)
            return i.dehydrated !== null ? (pa(t), t.flags |= 128, null) : (a & t.child.childLanes) !== 0 ? Zd(
              e,
              t,
              a
            ) : (pa(t), e = Zn(
              e,
              t,
              a
            ), e !== null ? e.sibling : null);
          pa(t);
          break;
        case 19:
          var o = (e.flags & 128) !== 0;
          if (i = (a & t.childLanes) !== 0, i || (qn(
            e,
            t,
            a,
            !1
          ), i = (a & t.childLanes) !== 0), o) {
            if (i)
              return Sy(
                e,
                t,
                a
              );
            t.flags |= 128;
          }
          if (o = t.memoizedState, o !== null && (o.rendering = null, o.tail = null, o.lastEffect = null), Ve(
            xl,
            xl.current,
            t
          ), i) break;
          return null;
        case 22:
          return t.lanes = 0, dy(
            e,
            t,
            a,
            t.pendingProps
          );
        case 24:
          vn(
            t,
            Xl,
            e.memoizedState.cache
          );
      }
      return Zn(e, t, a);
    }
    function Fs(e, t, a) {
      if (t._debugNeedsRemount && e !== null) {
        a = Uc(
          t.type,
          t.key,
          t.pendingProps,
          t._debugOwner || null,
          t.mode,
          t.lanes
        ), a._debugStack = t._debugStack, a._debugTask = t._debugTask;
        var i = t.return;
        if (i === null) throw Error("Cannot swap the root fiber.");
        if (e.alternate = null, t.alternate = null, a.index = t.index, a.sibling = t.sibling, a.return = t.return, a.ref = t.ref, a._debugInfo = t._debugInfo, t === i.child)
          i.child = a;
        else {
          var o = i.child;
          if (o === null)
            throw Error("Expected parent to have a child.");
          for (; o.sibling !== t; )
            if (o = o.sibling, o === null)
              throw Error("Expected to find the previous sibling.");
          o.sibling = a;
        }
        return t = i.deletions, t === null ? (i.deletions = [e], i.flags |= 16) : t.push(e), a.flags |= 2, a;
      }
      if (e !== null)
        if (e.memoizedProps !== t.pendingProps || t.type !== e.type)
          Zl = !0;
        else {
          if (!$d(e, a) && (t.flags & 128) === 0)
            return Zl = !1, K0(
              e,
              t,
              a
            );
          Zl = (e.flags & 131072) !== 0;
        }
      else
        Zl = !1, (i = st) && (qi(), i = (t.flags & 1048576) !== 0), i && (i = t.index, qi(), Zm(t, Hp, i));
      switch (t.lanes = 0, t.tag) {
        case 16:
          e: if (i = t.pendingProps, e = $a(t.elementType), t.type = e, typeof e == "function")
            Xm(e) ? (i = Du(
              e,
              i
            ), t.tag = 1, t.type = e = Bi(e), t = Ic(
              null,
              t,
              e,
              i,
              a
            )) : (t.tag = 0, of(t, e), t.type = e = Bi(e), t = yy(
              null,
              t,
              e,
              i,
              a
            ));
          else {
            if (e != null) {
              if (o = e.$$typeof, o === Uf) {
                t.tag = 11, t.type = e = bd(e), t = Z0(
                  null,
                  t,
                  e,
                  i,
                  a
                );
                break e;
              } else if (o === Or) {
                t.tag = 14, t = sy(
                  null,
                  t,
                  e,
                  i,
                  a
                );
                break e;
              }
            }
            throw t = "", e !== null && typeof e == "object" && e.$$typeof === ia && (t = " Did you wrap a component in React.lazy() more than once?"), a = We(e) || e, Error(
              "Element type is invalid. Received a promise that resolves to: " + a + ". Lazy element type must resolve to a class or function." + t
            );
          }
          return t;
        case 0:
          return yy(
            e,
            t,
            t.type,
            t.pendingProps,
            a
          );
        case 1:
          return i = t.type, o = Du(
            i,
            t.pendingProps
          ), Ic(
            e,
            t,
            i,
            o,
            a
          );
        case 3:
          e: {
            if (Gt(
              t,
              t.stateNode.containerInfo
            ), e === null)
              throw Error(
                "Should have a current fiber. This is a bug in React."
              );
            i = t.pendingProps;
            var f = t.memoizedState;
            o = f.element, vu(e, t), Su(t, i, null, a);
            var d = t.memoizedState;
            if (i = d.cache, vn(t, Xl, i), i !== f.cache && li(
              t,
              [Xl],
              a,
              !0
            ), Fo(), i = d.element, f.isDehydrated)
              if (f = {
                element: i,
                isDehydrated: !1,
                cache: d.cache
              }, t.updateQueue.baseState = f, t.memoizedState = f, t.flags & 256) {
                t = gy(
                  e,
                  t,
                  i,
                  a
                );
                break e;
              } else if (i !== o) {
                o = da(
                  Error(
                    "This root received an early update, before anything was able hydrate. Switched the entire root to client rendering."
                  ),
                  t
                ), Ds(o), t = gy(
                  e,
                  t,
                  i,
                  a
                );
                break e;
              } else {
                switch (e = t.stateNode.containerInfo, e.nodeType) {
                  case 9:
                    e = e.body;
                    break;
                  default:
                    e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
                }
                for (ll = an(e.firstChild), _a = t, st = !0, Kf = null, yc = !1, lu = null, Ju = !0, a = mS(
                  t,
                  null,
                  i,
                  a
                ), t.child = a; a; )
                  a.flags = a.flags & -3 | 4096, a = a.sibling;
              }
            else {
              if (Gi(), i === o) {
                t = Zn(
                  e,
                  t,
                  a
                );
                break e;
              }
              ql(
                e,
                t,
                i,
                a
              );
            }
            t = t.child;
          }
          return t;
        case 26:
          return ks(e, t), e === null ? (a = ep(
            t.type,
            null,
            t.pendingProps,
            null
          )) ? t.memoizedState = a : st || (a = t.type, e = t.pendingProps, i = Kt(
            nn.current
          ), i = dr(
            i
          ).createElement(a), i[el] = t, i[Da] = e, Pt(i, a, e), Se(i), t.stateNode = i) : t.memoizedState = ep(
            t.type,
            e.memoizedProps,
            t.pendingProps,
            e.memoizedState
          ), null;
        case 27:
          return ne(t), e === null && st && (i = Kt(nn.current), o = Z(), i = t.stateNode = vi(
            t.type,
            t.pendingProps,
            i,
            o,
            !1
          ), yc || (o = Na(
            i,
            t.type,
            t.pendingProps,
            o
          ), o !== null && (Hc(t, 0).serverProps = o)), _a = t, Ju = !0, o = ll, oc(t.type) ? (yb = o, ll = an(
            i.firstChild
          )) : ll = o), ql(
            e,
            t,
            t.pendingProps.children,
            a
          ), ks(e, t), e === null && (t.flags |= 4194304), t.child;
        case 5:
          return e === null && st && (f = Z(), i = ps(
            t.type,
            f.ancestorInfo
          ), o = ll, (d = !o) || (d = Ag(
            o,
            t.type,
            t.pendingProps,
            Ju
          ), d !== null ? (t.stateNode = d, yc || (f = Na(
            d,
            t.type,
            t.pendingProps,
            f
          ), f !== null && (Hc(t, 0).serverProps = f)), _a = t, ll = an(
            d.firstChild
          ), Ju = !1, f = !0) : f = !1, d = !f), d && (i && na(t, o), gn(t))), ne(t), o = t.type, f = t.pendingProps, d = e !== null ? e.memoizedProps : null, i = f.children, Af(o, f) ? i = null : d !== null && Af(o, d) && (t.flags |= 32), t.memoizedState !== null && (o = ty(
            e,
            t,
            js,
            null,
            null,
            a
          ), h0._currentValue = o), ks(e, t), ql(
            e,
            t,
            i,
            a
          ), t.child;
        case 6:
          return e === null && st && (a = t.pendingProps, e = Z(), i = e.ancestorInfo.current, a = i != null ? gs(
            a,
            i.tag,
            e.ancestorInfo.implicitRootScope
          ) : !0, e = ll, (i = !e) || (i = Og(
            e,
            t.pendingProps,
            Ju
          ), i !== null ? (t.stateNode = i, _a = t, ll = null, i = !0) : i = !1, i = !i), i && (a && na(t, e), gn(t))), null;
        case 13:
          return Zd(e, t, a);
        case 4:
          return Gt(
            t,
            t.stateNode.containerInfo
          ), i = t.pendingProps, e === null ? t.child = Gr(
            t,
            null,
            i,
            a
          ) : ql(
            e,
            t,
            i,
            a
          ), t.child;
        case 11:
          return Z0(
            e,
            t,
            t.type,
            t.pendingProps,
            a
          );
        case 7:
          return ql(
            e,
            t,
            t.pendingProps,
            a
          ), t.child;
        case 8:
          return ql(
            e,
            t,
            t.pendingProps.children,
            a
          ), t.child;
        case 12:
          return t.flags |= 4, t.flags |= 2048, i = t.stateNode, i.effectDuration = -0, i.passiveEffectDuration = -0, ql(
            e,
            t,
            t.pendingProps.children,
            a
          ), t.child;
        case 10:
          return i = t.type, o = t.pendingProps, f = o.value, "value" in o || GS || (GS = !0, console.error(
            "The `value` prop is required for the `<Context.Provider>`. Did you misspell it or forget to pass it?"
          )), vn(t, i, f), ql(
            e,
            t,
            o.children,
            a
          ), t.child;
        case 9:
          return o = t.type._context, i = t.pendingProps.children, typeof i != "function" && console.error(
            "A context consumer was rendered with multiple children, or a child that isn't a function. A context consumer expects a single child that is a function. If you did pass a function, make sure there is no trailing or leading whitespace around it."
          ), Xi(t), o = Et(o), i = N1(
            i,
            o,
            void 0
          ), t.flags |= 1, ql(
            e,
            t,
            i,
            a
          ), t.child;
        case 14:
          return sy(
            e,
            t,
            t.type,
            t.pendingProps,
            a
          );
        case 15:
          return ry(
            e,
            t,
            t.type,
            t.pendingProps,
            a
          );
        case 19:
          return Sy(
            e,
            t,
            a
          );
        case 31:
          return J0(e, t, a);
        case 22:
          return dy(
            e,
            t,
            a,
            t.pendingProps
          );
        case 24:
          return Xi(t), i = Et(Xl), e === null ? (o = ui(), o === null && (o = Zt, f = Od(), o.pooledCache = f, wc(f), f !== null && (o.pooledCacheLanes |= a), o = f), t.memoizedState = {
            parent: i,
            cache: o
          }, ot(t), vn(t, Xl, o)) : ((e.lanes & a) !== 0 && (vu(e, t), Su(t, null, null, a), Fo()), o = e.memoizedState, f = t.memoizedState, o.parent !== i ? (o = {
            parent: i,
            cache: i
          }, t.memoizedState = o, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = o), vn(t, Xl, i)) : (i = f.cache, vn(t, Xl, i), i !== o.cache && li(
            t,
            [Xl],
            a,
            !0
          ))), ql(
            e,
            t,
            t.pendingProps.children,
            a
          ), t.child;
        case 29:
          throw t.pendingProps;
      }
      throw Error(
        "Unknown unit of work tag (" + t.tag + "). This error is likely caused by a bug in React. Please file an issue."
      );
    }
    function _u(e) {
      e.flags |= 4;
    }
    function kd(e, t, a, i, o) {
      if ((t = (e.mode & ZE) !== qe) && (t = !1), t) {
        if (e.flags |= 16777216, (o & 335544128) === o)
          if (e.stateNode.complete) e.flags |= 8192;
          else if (Yy()) e.flags |= 8192;
          else
            throw qr = fv, j1;
      } else e.flags &= -16777217;
    }
    function $0(e, t) {
      if (t.type !== "stylesheet" || (t.state.loading & Fu) !== Fr)
        e.flags &= -16777217;
      else if (e.flags |= 16777216, !ct(t))
        if (Yy()) e.flags |= 8192;
        else
          throw qr = fv, j1;
    }
    function sf(e, t) {
      t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag !== 22 ? xo() : 536870912, e.lanes |= t, Zr |= t);
    }
    function rf(e, t) {
      if (!st)
        switch (e.tailMode) {
          case "hidden":
            t = e.tail;
            for (var a = null; t !== null; )
              t.alternate !== null && (a = t), t = t.sibling;
            a === null ? e.tail = null : a.sibling = null;
            break;
          case "collapsed":
            a = e.tail;
            for (var i = null; a !== null; )
              a.alternate !== null && (i = a), a = a.sibling;
            i === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : i.sibling = null;
        }
    }
    function Ut(e) {
      var t = e.alternate !== null && e.alternate.child === e.child, a = 0, i = 0;
      if (t)
        if ((e.mode & tt) !== qe) {
          for (var o = e.selfBaseDuration, f = e.child; f !== null; )
            a |= f.lanes | f.childLanes, i |= f.subtreeFlags & 65011712, i |= f.flags & 65011712, o += f.treeBaseDuration, f = f.sibling;
          e.treeBaseDuration = o;
        } else
          for (o = e.child; o !== null; )
            a |= o.lanes | o.childLanes, i |= o.subtreeFlags & 65011712, i |= o.flags & 65011712, o.return = e, o = o.sibling;
      else if ((e.mode & tt) !== qe) {
        o = e.actualDuration, f = e.selfBaseDuration;
        for (var d = e.child; d !== null; )
          a |= d.lanes | d.childLanes, i |= d.subtreeFlags, i |= d.flags, o += d.actualDuration, f += d.treeBaseDuration, d = d.sibling;
        e.actualDuration = o, e.treeBaseDuration = f;
      } else
        for (o = e.child; o !== null; )
          a |= o.lanes | o.childLanes, i |= o.subtreeFlags, i |= o.flags, o.return = e, o = o.sibling;
      return e.subtreeFlags |= i, e.childLanes = a, t;
    }
    function Ey(e, t, a) {
      var i = t.pendingProps;
      switch (Td(t), t.tag) {
        case 16:
        case 15:
        case 0:
        case 11:
        case 7:
        case 8:
        case 12:
        case 9:
        case 14:
          return Ut(t), null;
        case 1:
          return Ut(t), null;
        case 3:
          return a = t.stateNode, i = null, e !== null && (i = e.memoizedState.cache), t.memoizedState.cache !== i && (t.flags |= 2048), Yn(Xl, t), _(t), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (e === null || e.child === null) && (jc(t) ? (Li(), _u(t)) : e === null || e.memoizedState.isDehydrated && (t.flags & 256) === 0 || (t.flags |= 1024, zs())), Ut(t), null;
        case 26:
          var o = t.type, f = t.memoizedState;
          return e === null ? (_u(t), f !== null ? (Ut(t), $0(
            t,
            f
          )) : (Ut(t), kd(
            t,
            o,
            null,
            i,
            a
          ))) : f ? f !== e.memoizedState ? (_u(t), Ut(t), $0(
            t,
            f
          )) : (Ut(t), t.flags &= -16777217) : (e = e.memoizedProps, e !== i && _u(t), Ut(t), kd(
            t,
            o,
            e,
            i,
            a
          )), null;
        case 27:
          if (Oe(t), a = Kt(nn.current), o = t.type, e !== null && t.stateNode != null)
            e.memoizedProps !== i && _u(t);
          else {
            if (!i) {
              if (t.stateNode === null)
                throw Error(
                  "We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue."
                );
              return Ut(t), null;
            }
            e = Z(), jc(t) ? Jm(t) : (e = vi(
              o,
              i,
              a,
              e,
              !0
            ), t.stateNode = e, _u(t));
          }
          return Ut(t), null;
        case 5:
          if (Oe(t), o = t.type, e !== null && t.stateNode != null)
            e.memoizedProps !== i && _u(t);
          else {
            if (!i) {
              if (t.stateNode === null)
                throw Error(
                  "We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue."
                );
              return Ut(t), null;
            }
            var d = Z();
            if (jc(t))
              Jm(t);
            else {
              switch (f = Kt(nn.current), ps(o, d.ancestorInfo), d = d.context, f = dr(f), d) {
                case vm:
                  f = f.createElementNS(
                    Ie,
                    o
                  );
                  break;
                case jv:
                  f = f.createElementNS(
                    Ke,
                    o
                  );
                  break;
                default:
                  switch (o) {
                    case "svg":
                      f = f.createElementNS(
                        Ie,
                        o
                      );
                      break;
                    case "math":
                      f = f.createElementNS(
                        Ke,
                        o
                      );
                      break;
                    case "script":
                      f = f.createElement("div"), f.innerHTML = "<script><\/script>", f = f.removeChild(
                        f.firstChild
                      );
                      break;
                    case "select":
                      f = typeof i.is == "string" ? f.createElement("select", {
                        is: i.is
                      }) : f.createElement("select"), i.multiple ? f.multiple = !0 : i.size && (f.size = i.size);
                      break;
                    default:
                      f = typeof i.is == "string" ? f.createElement(o, {
                        is: i.is
                      }) : f.createElement(o), o.indexOf("-") === -1 && (o !== o.toLowerCase() && console.error(
                        "<%s /> is using incorrect casing. Use PascalCase for React components, or lowercase for HTML elements.",
                        o
                      ), Object.prototype.toString.call(f) !== "[object HTMLUnknownElement]" || un.call(s2, o) || (s2[o] = !0, console.error(
                        "The tag <%s> is unrecognized in this browser. If you meant to render a React component, start its name with an uppercase letter.",
                        o
                      )));
                  }
              }
              f[el] = t, f[Da] = i;
              e: for (d = t.child; d !== null; ) {
                if (d.tag === 5 || d.tag === 6)
                  f.appendChild(d.stateNode);
                else if (d.tag !== 4 && d.tag !== 27 && d.child !== null) {
                  d.child.return = d, d = d.child;
                  continue;
                }
                if (d === t) break e;
                for (; d.sibling === null; ) {
                  if (d.return === null || d.return === t)
                    break e;
                  d = d.return;
                }
                d.sibling.return = d.return, d = d.sibling;
              }
              t.stateNode = f;
              e: switch (Pt(f, o, i), o) {
                case "button":
                case "input":
                case "select":
                case "textarea":
                  i = !!i.autoFocus;
                  break e;
                case "img":
                  i = !0;
                  break e;
                default:
                  i = !1;
              }
              i && _u(t);
            }
          }
          return Ut(t), kd(
            t,
            t.type,
            e === null ? null : e.memoizedProps,
            t.pendingProps,
            a
          ), null;
        case 6:
          if (e && t.stateNode != null)
            e.memoizedProps !== i && _u(t);
          else {
            if (typeof i != "string" && t.stateNode === null)
              throw Error(
                "We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue."
              );
            if (e = Kt(nn.current), a = Z(), jc(t)) {
              if (e = t.stateNode, a = t.memoizedProps, o = !yc, i = null, f = _a, f !== null)
                switch (f.tag) {
                  case 3:
                    o && (o = _g(
                      e,
                      a,
                      i
                    ), o !== null && (Hc(t, 0).serverProps = o));
                    break;
                  case 27:
                  case 5:
                    i = f.memoizedProps, o && (o = _g(
                      e,
                      a,
                      i
                    ), o !== null && (Hc(
                      t,
                      0
                    ).serverProps = o));
                }
              e[el] = t, e = !!(e.nodeValue === a || i !== null && i.suppressHydrationWarning === !0 || $y(e.nodeValue, a)), e || gn(t, !0);
            } else
              o = a.ancestorInfo.current, o != null && gs(
                i,
                o.tag,
                a.ancestorInfo.implicitRootScope
              ), e = dr(e).createTextNode(
                i
              ), e[el] = t, t.stateNode = e;
          }
          return Ut(t), null;
        case 31:
          if (a = t.memoizedState, e === null || e.memoizedState !== null) {
            if (i = jc(t), a !== null) {
              if (e === null) {
                if (!i)
                  throw Error(
                    "A dehydrated suspense component was completed without a hydrated node. This is probably a bug in React."
                  );
                if (e = t.memoizedState, e = e !== null ? e.dehydrated : null, !e)
                  throw Error(
                    "Expected to have a hydrated activity instance. This error is likely caused by a bug in React. Please file an issue."
                  );
                e[el] = t, Ut(t), (t.mode & tt) !== qe && a !== null && (e = t.child, e !== null && (t.treeBaseDuration -= e.treeBaseDuration));
              } else
                Li(), Gi(), (t.flags & 128) === 0 && (a = t.memoizedState = null), t.flags |= 4, Ut(t), (t.mode & tt) !== qe && a !== null && (e = t.child, e !== null && (t.treeBaseDuration -= e.treeBaseDuration));
              e = !1;
            } else
              a = zs(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = a), e = !0;
            if (!e)
              return t.flags & 256 ? (Bl(t), t) : (Bl(t), null);
            if ((t.flags & 128) !== 0)
              throw Error(
                "Client rendering an Activity suspended it again. This is a bug in React."
              );
          }
          return Ut(t), null;
        case 13:
          if (i = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
            if (o = i, f = jc(t), o !== null && o.dehydrated !== null) {
              if (e === null) {
                if (!f)
                  throw Error(
                    "A dehydrated suspense component was completed without a hydrated node. This is probably a bug in React."
                  );
                if (f = t.memoizedState, f = f !== null ? f.dehydrated : null, !f)
                  throw Error(
                    "Expected to have a hydrated suspense instance. This error is likely caused by a bug in React. Please file an issue."
                  );
                f[el] = t, Ut(t), (t.mode & tt) !== qe && o !== null && (o = t.child, o !== null && (t.treeBaseDuration -= o.treeBaseDuration));
              } else
                Li(), Gi(), (t.flags & 128) === 0 && (o = t.memoizedState = null), t.flags |= 4, Ut(t), (t.mode & tt) !== qe && o !== null && (o = t.child, o !== null && (t.treeBaseDuration -= o.treeBaseDuration));
              o = !1;
            } else
              o = zs(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = o), o = !0;
            if (!o)
              return t.flags & 256 ? (Bl(t), t) : (Bl(t), null);
          }
          return Bl(t), (t.flags & 128) !== 0 ? (t.lanes = a, (t.mode & tt) !== qe && Yc(t), t) : (a = i !== null, e = e !== null && e.memoizedState !== null, a && (i = t.child, o = null, i.alternate !== null && i.alternate.memoizedState !== null && i.alternate.memoizedState.cachePool !== null && (o = i.alternate.memoizedState.cachePool.pool), f = null, i.memoizedState !== null && i.memoizedState.cachePool !== null && (f = i.memoizedState.cachePool.pool), f !== o && (i.flags |= 2048)), a !== e && a && (t.child.flags |= 8192), sf(t, t.updateQueue), Ut(t), (t.mode & tt) !== qe && a && (e = t.child, e !== null && (t.treeBaseDuration -= e.treeBaseDuration)), null);
        case 4:
          return _(t), e === null && ic(
            t.stateNode.containerInfo
          ), Ut(t), null;
        case 10:
          return Yn(t.type, t), Ut(t), null;
        case 19:
          if (Ae(xl, t), i = t.memoizedState, i === null) return Ut(t), null;
          if (o = (t.flags & 128) !== 0, f = i.rendering, f === null)
            if (o) rf(i, !1);
            else {
              if (hl !== _o || e !== null && (e.flags & 128) !== 0)
                for (e = t.child; e !== null; ) {
                  if (f = Gc(e), f !== null) {
                    for (t.flags |= 128, rf(i, !1), e = f.updateQueue, t.updateQueue = e, sf(t, e), t.subtreeFlags = 0, e = a, a = t.child; a !== null; )
                      Qm(a, e), a = a.sibling;
                    return Ve(
                      xl,
                      xl.current & im | kp,
                      t
                    ), st && Bn(t, i.treeForkCount), t.child;
                  }
                  e = e.sibling;
                }
              i.tail !== null && Ll() > Tv && (t.flags |= 128, o = !0, rf(i, !1), t.lanes = 4194304);
            }
          else {
            if (!o)
              if (e = Gc(f), e !== null) {
                if (t.flags |= 128, o = !0, e = e.updateQueue, t.updateQueue = e, sf(t, e), rf(i, !0), i.tail === null && i.tailMode === "hidden" && !f.alternate && !st)
                  return Ut(t), null;
              } else
                2 * Ll() - i.renderingStartTime > Tv && a !== 536870912 && (t.flags |= 128, o = !0, rf(i, !1), t.lanes = 4194304);
            i.isBackwards ? (f.sibling = t.child, t.child = f) : (e = i.last, e !== null ? e.sibling = f : t.child = f, i.last = f);
          }
          return i.tail !== null ? (e = i.tail, i.rendering = e, i.tail = e.sibling, i.renderingStartTime = Ll(), e.sibling = null, a = xl.current, a = o ? a & im | kp : a & im, Ve(xl, a, t), st && Bn(t, i.treeForkCount), e) : (Ut(t), null);
        case 22:
        case 23:
          return Bl(t), Xn(t), i = t.memoizedState !== null, e !== null ? e.memoizedState !== null !== i && (t.flags |= 8192) : i && (t.flags |= 8192), i ? (a & 536870912) !== 0 && (t.flags & 128) === 0 && (Ut(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : Ut(t), a = t.updateQueue, a !== null && sf(t, a.retryQueue), a = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (a = e.memoizedState.cachePool.pool), i = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (i = t.memoizedState.cachePool.pool), i !== a && (t.flags |= 2048), e !== null && Ae(Br, t), null;
        case 24:
          return a = null, e !== null && (a = e.memoizedState.cache), t.memoizedState.cache !== a && (t.flags |= 2048), Yn(Xl, t), Ut(t), null;
        case 25:
          return null;
        case 30:
          return null;
      }
      throw Error(
        "Unknown unit of work tag (" + t.tag + "). This error is likely caused by a bug in React. Please file an issue."
      );
    }
    function k0(e, t) {
      switch (Td(t), t.tag) {
        case 1:
          return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, (t.mode & tt) !== qe && Yc(t), t) : null;
        case 3:
          return Yn(Xl, t), _(t), e = t.flags, (e & 65536) !== 0 && (e & 128) === 0 ? (t.flags = e & -65537 | 128, t) : null;
        case 26:
        case 27:
        case 5:
          return Oe(t), null;
        case 31:
          if (t.memoizedState !== null) {
            if (Bl(t), t.alternate === null)
              throw Error(
                "Threw in newly mounted dehydrated component. This is likely a bug in React. Please file an issue."
              );
            Gi();
          }
          return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, (t.mode & tt) !== qe && Yc(t), t) : null;
        case 13:
          if (Bl(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
            if (t.alternate === null)
              throw Error(
                "Threw in newly mounted dehydrated component. This is likely a bug in React. Please file an issue."
              );
            Gi();
          }
          return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, (t.mode & tt) !== qe && Yc(t), t) : null;
        case 19:
          return Ae(xl, t), null;
        case 4:
          return _(t), null;
        case 10:
          return Yn(t.type, t), null;
        case 22:
        case 23:
          return Bl(t), Xn(t), e !== null && Ae(Br, t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, (t.mode & tt) !== qe && Yc(t), t) : null;
        case 24:
          return Yn(Xl, t), null;
        case 25:
          return null;
        default:
          return null;
      }
    }
    function Ty(e, t) {
      switch (Td(t), t.tag) {
        case 3:
          Yn(Xl, t), _(t);
          break;
        case 26:
        case 27:
        case 5:
          Oe(t);
          break;
        case 4:
          _(t);
          break;
        case 31:
          t.memoizedState !== null && Bl(t);
          break;
        case 13:
          Bl(t);
          break;
        case 19:
          Ae(xl, t);
          break;
        case 10:
          Yn(t.type, t);
          break;
        case 22:
        case 23:
          Bl(t), Xn(t), e !== null && Ae(Br, t);
          break;
        case 24:
          Yn(Xl, t);
      }
    }
    function Ru(e) {
      return (e.mode & tt) !== qe;
    }
    function W0(e, t) {
      Ru(e) ? (fl(), hi(t, e), ma()) : hi(t, e);
    }
    function Wd(e, t, a) {
      Ru(e) ? (fl(), ec(
        a,
        e,
        t
      ), ma()) : ec(
        a,
        e,
        t
      );
    }
    function hi(e, t) {
      try {
        var a = t.updateQueue, i = a !== null ? a.lastEffect : null;
        if (i !== null) {
          var o = i.next;
          a = o;
          do {
            if ((a.tag & e) === e && (i = void 0, (e & sn) !== rv && (ym = !0), i = de(
              t,
              FE,
              a
            ), (e & sn) !== rv && (ym = !1), i !== void 0 && typeof i != "function")) {
              var f = void 0;
              f = (a.tag & nu) !== 0 ? "useLayoutEffect" : (a.tag & sn) !== 0 ? "useInsertionEffect" : "useEffect";
              var d = void 0;
              d = i === null ? " You returned null. If your effect does not require clean up, return undefined (or nothing)." : typeof i.then == "function" ? `

It looks like you wrote ` + f + `(async () => ...) or returned a Promise. Instead, write the async function inside your effect and call it immediately:

` + f + `(() => {
  async function fetchData() {
    // You can await here
    const response = await MyAPI.getData(someId);
    // ...
  }
  fetchData();
}, [someId]); // Or [] if effect doesn't need props or state

Learn more about data fetching with Hooks: https://react.dev/link/hooks-data-fetching` : " You returned: " + i, de(
                t,
                function(h, y) {
                  console.error(
                    "%s must not return anything besides a function, which is used for clean-up.%s",
                    h,
                    y
                  );
                },
                f,
                d
              );
            }
            a = a.next;
          } while (a !== o);
        }
      } catch (h) {
        Fe(t, t.return, h);
      }
    }
    function ec(e, t, a) {
      try {
        var i = t.updateQueue, o = i !== null ? i.lastEffect : null;
        if (o !== null) {
          var f = o.next;
          i = f;
          do {
            if ((i.tag & e) === e) {
              var d = i.inst, h = d.destroy;
              h !== void 0 && (d.destroy = void 0, (e & sn) !== rv && (ym = !0), o = t, de(
                o,
                IE,
                o,
                a,
                h
              ), (e & sn) !== rv && (ym = !1));
            }
            i = i.next;
          } while (i !== f);
        }
      } catch (y) {
        Fe(t, t.return, y);
      }
    }
    function Is(e, t) {
      Ru(e) ? (fl(), hi(t, e), ma()) : hi(t, e);
    }
    function Fd(e, t, a) {
      Ru(e) ? (fl(), ec(
        a,
        e,
        t
      ), ma()) : ec(
        a,
        e,
        t
      );
    }
    function Ay(e) {
      var t = e.updateQueue;
      if (t !== null) {
        var a = e.stateNode;
        e.type.defaultProps || "ref" in e.memoizedProps || sm || (a.props !== e.memoizedProps && console.error(
          "Expected %s props to match memoized props before processing the update queue. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.",
          pe(e) || "instance"
        ), a.state !== e.memoizedState && console.error(
          "Expected %s state to match memoized state before processing the update queue. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.",
          pe(e) || "instance"
        ));
        try {
          de(
            e,
            Io,
            t,
            a
          );
        } catch (i) {
          Fe(e, e.return, i);
        }
      }
    }
    function Ps(e, t, a) {
      return e.getSnapshotBeforeUpdate(t, a);
    }
    function F0(e, t) {
      var a = t.memoizedProps, i = t.memoizedState;
      t = e.stateNode, e.type.defaultProps || "ref" in e.memoizedProps || sm || (t.props !== e.memoizedProps && console.error(
        "Expected %s props to match memoized props before getSnapshotBeforeUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.",
        pe(e) || "instance"
      ), t.state !== e.memoizedState && console.error(
        "Expected %s state to match memoized state before getSnapshotBeforeUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.",
        pe(e) || "instance"
      ));
      try {
        var o = Du(
          e.type,
          a
        ), f = de(
          e,
          Ps,
          t,
          o,
          i
        );
        a = LS, f !== void 0 || a.has(e.type) || (a.add(e.type), de(e, function() {
          console.error(
            "%s.getSnapshotBeforeUpdate(): A snapshot value (or null) must be returned. You have returned undefined.",
            pe(e)
          );
        })), t.__reactInternalSnapshotBeforeUpdate = f;
      } catch (d) {
        Fe(e, e.return, d);
      }
    }
    function Id(e, t, a) {
      a.props = Du(
        e.type,
        e.memoizedProps
      ), a.state = e.memoizedState, Ru(e) ? (fl(), de(
        e,
        iS,
        e,
        t,
        a
      ), ma()) : de(
        e,
        iS,
        e,
        t,
        a
      );
    }
    function I0(e) {
      var t = e.ref;
      if (t !== null) {
        switch (e.tag) {
          case 26:
          case 27:
          case 5:
            var a = e.stateNode;
            break;
          case 30:
            a = e.stateNode;
            break;
          default:
            a = e.stateNode;
        }
        if (typeof t == "function")
          if (Ru(e))
            try {
              fl(), e.refCleanup = t(a);
            } finally {
              ma();
            }
          else e.refCleanup = t(a);
        else
          typeof t == "string" ? console.error("String refs are no longer supported.") : t.hasOwnProperty("current") || console.error(
            "Unexpected ref object provided for %s. Use either a ref-setter function or React.createRef().",
            pe(e)
          ), t.current = a;
      }
    }
    function Pc(e, t) {
      try {
        de(e, I0, e);
      } catch (a) {
        Fe(e, t, a);
      }
    }
    function An(e, t) {
      var a = e.ref, i = e.refCleanup;
      if (a !== null)
        if (typeof i == "function")
          try {
            if (Ru(e))
              try {
                fl(), de(e, i);
              } finally {
                ma(e);
              }
            else de(e, i);
          } catch (o) {
            Fe(e, t, o);
          } finally {
            e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
          }
        else if (typeof a == "function")
          try {
            if (Ru(e))
              try {
                fl(), de(e, a, null);
              } finally {
                ma(e);
              }
            else de(e, a, null);
          } catch (o) {
            Fe(e, t, o);
          }
        else a.current = null;
    }
    function Oy(e, t, a, i) {
      var o = e.memoizedProps, f = o.id, d = o.onCommit;
      o = o.onRender, t = t === null ? "mount" : "update", uv && (t = "nested-update"), typeof o == "function" && o(
        f,
        t,
        e.actualDuration,
        e.treeBaseDuration,
        e.actualStartTime,
        a
      ), typeof d == "function" && d(f, t, i, a);
    }
    function P0(e, t, a, i) {
      var o = e.memoizedProps;
      e = o.id, o = o.onPostCommit, t = t === null ? "mount" : "update", uv && (t = "nested-update"), typeof o == "function" && o(
        e,
        t,
        i,
        a
      );
    }
    function tc(e) {
      var t = e.type, a = e.memoizedProps, i = e.stateNode;
      try {
        de(
          e,
          dg,
          i,
          t,
          a,
          e
        );
      } catch (o) {
        Fe(e, e.return, o);
      }
    }
    function Pd(e, t, a) {
      try {
        de(
          e,
          bh,
          e.stateNode,
          e.type,
          a,
          t,
          e
        );
      } catch (i) {
        Fe(e, e.return, i);
      }
    }
    function zy(e) {
      return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && oc(e.type) || e.tag === 4;
    }
    function eh(e) {
      e: for (; ; ) {
        for (; e.sibling === null; ) {
          if (e.return === null || zy(e.return)) return null;
          e = e.return;
        }
        for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
          if (e.tag === 27 && oc(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue e;
          e.child.return = e, e = e.child;
        }
        if (!(e.flags & 2)) return e.stateNode;
      }
    }
    function df(e, t, a) {
      var i = e.tag;
      if (i === 5 || i === 6)
        e = e.stateNode, t ? (mg(a), (a.nodeType === 9 ? a.body : a.nodeName === "HTML" ? a.ownerDocument.body : a).insertBefore(e, t)) : (mg(a), t = a.nodeType === 9 ? a.body : a.nodeName === "HTML" ? a.ownerDocument.body : a, t.appendChild(e), a = a._reactRootContainer, a != null || t.onclick !== null || (t.onclick = yn));
      else if (i !== 4 && (i === 27 && oc(e.type) && (a = e.stateNode, t = null), e = e.child, e !== null))
        for (df(e, t, a), e = e.sibling; e !== null; )
          df(e, t, a), e = e.sibling;
    }
    function er(e, t, a) {
      var i = e.tag;
      if (i === 5 || i === 6)
        e = e.stateNode, t ? a.insertBefore(e, t) : a.appendChild(e);
      else if (i !== 4 && (i === 27 && oc(e.type) && (a = e.stateNode), e = e.child, e !== null))
        for (er(e, t, a), e = e.sibling; e !== null; )
          er(e, t, a), e = e.sibling;
    }
    function Dy(e) {
      for (var t, a = e.return; a !== null; ) {
        if (zy(a)) {
          t = a;
          break;
        }
        a = a.return;
      }
      if (t == null)
        throw Error(
          "Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue."
        );
      switch (t.tag) {
        case 27:
          t = t.stateNode, a = eh(e), er(
            e,
            a,
            t
          );
          break;
        case 5:
          a = t.stateNode, t.flags & 32 && (Sh(a), t.flags &= -33), t = eh(e), er(
            e,
            t,
            a
          );
          break;
        case 3:
        case 4:
          t = t.stateNode.containerInfo, a = eh(e), df(
            e,
            a,
            t
          );
          break;
        default:
          throw Error(
            "Invalid host parent fiber. This error is likely caused by a bug in React. Please file an issue."
          );
      }
    }
    function _y(e) {
      var t = e.stateNode, a = e.memoizedProps;
      try {
        de(
          e,
          wu,
          e.type,
          a,
          t,
          e
        );
      } catch (i) {
        Fe(e, e.return, i);
      }
    }
    function Ry(e, t) {
      return t.tag === 31 ? (t = t.memoizedState, e.memoizedState !== null && t === null) : t.tag === 13 ? (e = e.memoizedState, t = t.memoizedState, e !== null && e.dehydrated !== null && (t === null || t.dehydrated === null)) : t.tag === 3 ? e.memoizedState.isDehydrated && (t.flags & 256) === 0 : !1;
    }
    function l1(e, t) {
      if (e = e.containerInfo, db = qv, e = yd(e), jm(e)) {
        if ("selectionStart" in e)
          var a = {
            start: e.selectionStart,
            end: e.selectionEnd
          };
        else
          e: {
            a = (a = e.ownerDocument) && a.defaultView || window;
            var i = a.getSelection && a.getSelection();
            if (i && i.rangeCount !== 0) {
              a = i.anchorNode;
              var o = i.anchorOffset, f = i.focusNode;
              i = i.focusOffset;
              try {
                a.nodeType, f.nodeType;
              } catch {
                a = null;
                break e;
              }
              var d = 0, h = -1, y = -1, p = 0, z = 0, R = e, E = null;
              t: for (; ; ) {
                for (var q; R !== a || o !== 0 && R.nodeType !== 3 || (h = d + o), R !== f || i !== 0 && R.nodeType !== 3 || (y = d + i), R.nodeType === 3 && (d += R.nodeValue.length), (q = R.firstChild) !== null; )
                  E = R, R = q;
                for (; ; ) {
                  if (R === e) break t;
                  if (E === a && ++p === o && (h = d), E === f && ++z === i && (y = d), (q = R.nextSibling) !== null) break;
                  R = E, E = R.parentNode;
                }
                R = q;
              }
              a = h === -1 || y === -1 ? null : { start: h, end: y };
            } else a = null;
          }
        a = a || { start: 0, end: 0 };
      } else a = null;
      for (hb = {
        focusedElem: e,
        selectionRange: a
      }, qv = !1, fa = t; fa !== null; )
        if (t = fa, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
          e.return = t, fa = e;
        else
          for (; fa !== null; ) {
            switch (e = t = fa, a = e.alternate, o = e.flags, e.tag) {
              case 0:
                if ((o & 4) !== 0 && (e = e.updateQueue, e = e !== null ? e.events : null, e !== null))
                  for (a = 0; a < e.length; a++)
                    o = e[a], o.ref.impl = o.nextImpl;
                break;
              case 11:
              case 15:
                break;
              case 1:
                (o & 1024) !== 0 && a !== null && F0(e, a);
                break;
              case 3:
                if ((o & 1024) !== 0) {
                  if (e = e.stateNode.containerInfo, a = e.nodeType, a === 9)
                    zf(e);
                  else if (a === 1)
                    switch (e.nodeName) {
                      case "HEAD":
                      case "HTML":
                      case "BODY":
                        zf(e);
                        break;
                      default:
                        e.textContent = "";
                    }
                }
                break;
              case 5:
              case 26:
              case 27:
              case 6:
              case 4:
              case 17:
                break;
              default:
                if ((o & 1024) !== 0)
                  throw Error(
                    "This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue."
                  );
            }
            if (e = t.sibling, e !== null) {
              e.return = t.return, fa = e;
              break;
            }
            fa = t.return;
          }
    }
    function th(e, t, a) {
      var i = Ft(), o = bn(), f = Ja(), d = Sn(), h = a.flags;
      switch (a.tag) {
        case 0:
        case 11:
        case 15:
          Pa(e, a), h & 4 && W0(a, nu | ku);
          break;
        case 1:
          if (Pa(e, a), h & 4)
            if (e = a.stateNode, t === null)
              a.type.defaultProps || "ref" in a.memoizedProps || sm || (e.props !== a.memoizedProps && console.error(
                "Expected %s props to match memoized props before componentDidMount. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.",
                pe(a) || "instance"
              ), e.state !== a.memoizedState && console.error(
                "Expected %s state to match memoized state before componentDidMount. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.",
                pe(a) || "instance"
              )), Ru(a) ? (fl(), de(
                a,
                H1,
                a,
                e
              ), ma()) : de(
                a,
                H1,
                a,
                e
              );
            else {
              var y = Du(
                a.type,
                t.memoizedProps
              );
              t = t.memoizedState, a.type.defaultProps || "ref" in a.memoizedProps || sm || (e.props !== a.memoizedProps && console.error(
                "Expected %s props to match memoized props before componentDidUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.",
                pe(a) || "instance"
              ), e.state !== a.memoizedState && console.error(
                "Expected %s state to match memoized state before componentDidUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.",
                pe(a) || "instance"
              )), Ru(a) ? (fl(), de(
                a,
                aS,
                a,
                e,
                y,
                t,
                e.__reactInternalSnapshotBeforeUpdate
              ), ma()) : de(
                a,
                aS,
                a,
                e,
                y,
                t,
                e.__reactInternalSnapshotBeforeUpdate
              );
            }
          h & 64 && Ay(a), h & 512 && Pc(a, a.return);
          break;
        case 3:
          if (t = gu(), Pa(e, a), h & 64 && (h = a.updateQueue, h !== null)) {
            if (y = null, a.child !== null)
              switch (a.child.tag) {
                case 27:
                case 5:
                  y = a.child.stateNode;
                  break;
                case 1:
                  y = a.child.stateNode;
              }
            try {
              de(
                a,
                Io,
                h,
                y
              );
            } catch (z) {
              Fe(a, a.return, z);
            }
          }
          e.effectDuration += $o(t);
          break;
        case 27:
          t === null && h & 4 && _y(a);
        case 26:
        case 5:
          if (Pa(e, a), t === null) {
            if (h & 4) tc(a);
            else if (h & 64) {
              e = a.type, t = a.memoizedProps, y = a.stateNode;
              try {
                de(
                  a,
                  hg,
                  y,
                  e,
                  t,
                  a
                );
              } catch (z) {
                Fe(
                  a,
                  a.return,
                  z
                );
              }
            }
          }
          h & 512 && Pc(a, a.return);
          break;
        case 12:
          if (h & 4) {
            h = gu(), Pa(e, a), e = a.stateNode, e.effectDuration += ha(h);
            try {
              de(
                a,
                Oy,
                a,
                t,
                $f,
                e.effectDuration
              );
            } catch (z) {
              Fe(a, a.return, z);
            }
          } else Pa(e, a);
          break;
        case 31:
          Pa(e, a), h & 4 && Cy(e, a);
          break;
        case 13:
          Pa(e, a), h & 4 && xy(e, a), h & 64 && (e = a.memoizedState, e !== null && (e = e.dehydrated, e !== null && (h = yi.bind(
            null,
            a
          ), zg(e, h))));
          break;
        case 22:
          if (h = a.memoizedState !== null || Do, !h) {
            t = t !== null && t.memoizedState !== null || Jl, y = Do;
            var p = Jl;
            Do = h, (Jl = t) && !p ? (Jn(
              e,
              a,
              (a.subtreeFlags & 8772) !== 0
            ), (a.mode & tt) !== qe && 0 <= Ce && 0 <= Be && 0.05 < Be - Ce && pd(
              a,
              Ce,
              Be
            )) : Pa(e, a), Do = y, Jl = p;
          }
          break;
        case 30:
          break;
        default:
          Pa(e, a);
      }
      (a.mode & tt) !== qe && 0 <= Ce && 0 <= Be && ((bl || 0.05 < dl) && wn(
        a,
        Ce,
        Be,
        dl,
        ol
      ), a.alternate === null && a.return !== null && a.return.alternate !== null && 0.05 < Be - Ce && (Ry(
        a.return.alternate,
        a.return
      ) || pn(
        a,
        Ce,
        Be,
        "Mount"
      ))), jl(i), Za(o), ol = f, bl = d;
    }
    function gl(e) {
      var t = e.alternate;
      t !== null && (e.alternate = null, gl(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && U(t)), e.stateNode = null, e._debugOwner = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
    }
    function kt(e, t, a) {
      for (a = a.child; a !== null; )
        My(
          e,
          t,
          a
        ), a = a.sibling;
    }
    function My(e, t, a) {
      if (Ml && typeof Ml.onCommitFiberUnmount == "function")
        try {
          Ml.onCommitFiberUnmount(ho, a);
        } catch (p) {
          Yu || (Yu = !0, console.error(
            "React instrumentation encountered an error: %o",
            p
          ));
        }
      var i = Ft(), o = bn(), f = Ja(), d = Sn();
      switch (a.tag) {
        case 26:
          Jl || An(a, t), kt(
            e,
            t,
            a
          ), a.memoizedState ? a.memoizedState.count-- : a.stateNode && (e = a.stateNode, e.parentNode.removeChild(e));
          break;
        case 27:
          Jl || An(a, t);
          var h = Kl, y = Rn;
          oc(a.type) && (Kl = a.stateNode, Rn = !1), kt(
            e,
            t,
            a
          ), de(
            a,
            bi,
            a.stateNode
          ), Kl = h, Rn = y;
          break;
        case 5:
          Jl || An(a, t);
        case 6:
          if (h = Kl, y = Rn, Kl = null, kt(
            e,
            t,
            a
          ), Kl = h, Rn = y, Kl !== null)
            if (Rn)
              try {
                de(
                  a,
                  pg,
                  Kl,
                  a.stateNode
                );
              } catch (p) {
                Fe(
                  a,
                  t,
                  p
                );
              }
            else
              try {
                de(
                  a,
                  yg,
                  Kl,
                  a.stateNode
                );
              } catch (p) {
                Fe(
                  a,
                  t,
                  p
                );
              }
          break;
        case 18:
          Kl !== null && (Rn ? (e = Kl, no(
            e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e,
            a.stateNode
          ), oo(e)) : no(Kl, a.stateNode));
          break;
        case 4:
          h = Kl, y = Rn, Kl = a.stateNode.containerInfo, Rn = !0, kt(
            e,
            t,
            a
          ), Kl = h, Rn = y;
          break;
        case 0:
        case 11:
        case 14:
        case 15:
          ec(
            sn,
            a,
            t
          ), Jl || Wd(
            a,
            t,
            nu
          ), kt(
            e,
            t,
            a
          );
          break;
        case 1:
          Jl || (An(a, t), h = a.stateNode, typeof h.componentWillUnmount == "function" && Id(
            a,
            t,
            h
          )), kt(
            e,
            t,
            a
          );
          break;
        case 21:
          kt(
            e,
            t,
            a
          );
          break;
        case 22:
          Jl = (h = Jl) || a.memoizedState !== null, kt(
            e,
            t,
            a
          ), Jl = h;
          break;
        default:
          kt(
            e,
            t,
            a
          );
      }
      (a.mode & tt) !== qe && 0 <= Ce && 0 <= Be && (bl || 0.05 < dl) && wn(
        a,
        Ce,
        Be,
        dl,
        ol
      ), jl(i), Za(o), ol = f, bl = d;
    }
    function Cy(e, t) {
      if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
        e = e.dehydrated;
        try {
          de(
            t,
            Eh,
            e
          );
        } catch (a) {
          Fe(t, t.return, a);
        }
      }
    }
    function xy(e, t) {
      if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null))))
        try {
          de(
            t,
            Iy,
            e
          );
        } catch (a) {
          Fe(t, t.return, a);
        }
    }
    function eg(e) {
      switch (e.tag) {
        case 31:
        case 13:
        case 19:
          var t = e.stateNode;
          return t === null && (t = e.stateNode = new XS()), t;
        case 22:
          return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new XS()), t;
        default:
          throw Error(
            "Unexpected Suspense handler tag (" + e.tag + "). This is a bug in React."
          );
      }
    }
    function lc(e, t) {
      var a = eg(e);
      t.forEach(function(i) {
        if (!a.has(i)) {
          if (a.add(i), qu)
            if (rm !== null && dm !== null)
              vf(dm, rm);
            else
              throw Error(
                "Expected finished root and lanes to be set. This is a bug in React."
              );
          var o = lo.bind(null, e, i);
          i.then(o, o);
        }
      });
    }
    function ba(e, t) {
      var a = t.deletions;
      if (a !== null)
        for (var i = 0; i < a.length; i++) {
          var o = e, f = t, d = a[i], h = Ft(), y = f;
          e: for (; y !== null; ) {
            switch (y.tag) {
              case 27:
                if (oc(y.type)) {
                  Kl = y.stateNode, Rn = !1;
                  break e;
                }
                break;
              case 5:
                Kl = y.stateNode, Rn = !1;
                break e;
              case 3:
              case 4:
                Kl = y.stateNode.containerInfo, Rn = !0;
                break e;
            }
            y = y.return;
          }
          if (Kl === null)
            throw Error(
              "Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue."
            );
          My(o, f, d), Kl = null, Rn = !1, (d.mode & tt) !== qe && 0 <= Ce && 0 <= Be && 0.05 < Be - Ce && pn(
            d,
            Ce,
            Be,
            "Unmount"
          ), jl(h), o = d, f = o.alternate, f !== null && (f.return = null), o.return = null;
        }
      if (t.subtreeFlags & 13886)
        for (t = t.child; t !== null; )
          tr(t, e), t = t.sibling;
    }
    function tr(e, t) {
      var a = Ft(), i = bn(), o = Ja(), f = Sn(), d = e.alternate, h = e.flags;
      switch (e.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          ba(t, e), Sa(e), h & 4 && (ec(
            sn | ku,
            e,
            e.return
          ), hi(sn | ku, e), Wd(
            e,
            e.return,
            nu | ku
          ));
          break;
        case 1:
          if (ba(t, e), Sa(e), h & 512 && (Jl || d === null || An(d, d.return)), h & 64 && Do && (h = e.updateQueue, h !== null && (d = h.callbacks, d !== null))) {
            var y = h.shared.hiddenCallbacks;
            h.shared.hiddenCallbacks = y === null ? d : y.concat(d);
          }
          break;
        case 26:
          if (y = zi, ba(t, e), Sa(e), h & 512 && (Jl || d === null || An(d, d.return)), h & 4) {
            var p = d !== null ? d.memoizedState : null;
            if (h = e.memoizedState, d === null)
              if (h === null)
                if (e.stateNode === null) {
                  e: {
                    h = e.type, d = e.memoizedProps, y = y.ownerDocument || y;
                    t: switch (h) {
                      case "title":
                        p = y.getElementsByTagName(
                          "title"
                        )[0], (!p || p[Gf] || p[el] || p.namespaceURI === Ie || p.hasAttribute("itemprop")) && (p = y.createElement(h), y.head.insertBefore(
                          p,
                          y.querySelector(
                            "head > title"
                          )
                        )), Pt(p, h, d), p[el] = e, Se(p), h = p;
                        break e;
                      case "link":
                        var z = Rf(
                          "link",
                          "href",
                          y
                        ).get(h + (d.href || ""));
                        if (z) {
                          for (var R = 0; R < z.length; R++)
                            if (p = z[R], p.getAttribute("href") === (d.href == null || d.href === "" ? null : d.href) && p.getAttribute("rel") === (d.rel == null ? null : d.rel) && p.getAttribute("title") === (d.title == null ? null : d.title) && p.getAttribute("crossorigin") === (d.crossOrigin == null ? null : d.crossOrigin)) {
                              z.splice(R, 1);
                              break t;
                            }
                        }
                        p = y.createElement(h), Pt(p, h, d), y.head.appendChild(
                          p
                        );
                        break;
                      case "meta":
                        if (z = Rf(
                          "meta",
                          "content",
                          y
                        ).get(h + (d.content || ""))) {
                          for (R = 0; R < z.length; R++)
                            if (p = z[R], vt(
                              d.content,
                              "content"
                            ), p.getAttribute("content") === (d.content == null ? null : "" + d.content) && p.getAttribute("name") === (d.name == null ? null : d.name) && p.getAttribute("property") === (d.property == null ? null : d.property) && p.getAttribute("http-equiv") === (d.httpEquiv == null ? null : d.httpEquiv) && p.getAttribute("charset") === (d.charSet == null ? null : d.charSet)) {
                              z.splice(R, 1);
                              break t;
                            }
                        }
                        p = y.createElement(h), Pt(p, h, d), y.head.appendChild(
                          p
                        );
                        break;
                      default:
                        throw Error(
                          'getNodesForType encountered a type it did not expect: "' + h + '". This is a bug in React.'
                        );
                    }
                    p[el] = e, Se(p), h = p;
                  }
                  e.stateNode = h;
                } else
                  Mg(
                    y,
                    e.type,
                    e.stateNode
                  );
              else
                e.stateNode = Oh(
                  y,
                  h,
                  e.memoizedProps
                );
            else
              p !== h ? (p === null ? d.stateNode !== null && (d = d.stateNode, d.parentNode.removeChild(d)) : p.count--, h === null ? Mg(
                y,
                e.type,
                e.stateNode
              ) : Oh(
                y,
                h,
                e.memoizedProps
              )) : h === null && e.stateNode !== null && Pd(
                e,
                e.memoizedProps,
                d.memoizedProps
              );
          }
          break;
        case 27:
          ba(t, e), Sa(e), h & 512 && (Jl || d === null || An(d, d.return)), d !== null && h & 4 && Pd(
            e,
            e.memoizedProps,
            d.memoizedProps
          );
          break;
        case 5:
          if (ba(t, e), Sa(e), h & 512 && (Jl || d === null || An(d, d.return)), e.flags & 32) {
            y = e.stateNode;
            try {
              de(
                e,
                Sh,
                y
              );
            } catch (he) {
              Fe(e, e.return, he);
            }
          }
          h & 4 && e.stateNode != null && (y = e.memoizedProps, Pd(
            e,
            y,
            d !== null ? d.memoizedProps : y
          )), h & 1024 && (K1 = !0, e.type !== "form" && console.error(
            "Unexpected host component type. Expected a form. This is a bug in React."
          ));
          break;
        case 6:
          if (ba(t, e), Sa(e), h & 4) {
            if (e.stateNode === null)
              throw Error(
                "This should have a text node initialized. This error is likely caused by a bug in React. Please file an issue."
              );
            h = e.memoizedProps, d = d !== null ? d.memoizedProps : h, y = e.stateNode;
            try {
              de(
                e,
                a1,
                y,
                d,
                h
              );
            } catch (he) {
              Fe(e, e.return, he);
            }
          }
          break;
        case 3:
          if (y = gu(), wv = null, p = zi, zi = Th(t.containerInfo), ba(t, e), zi = p, Sa(e), h & 4 && d !== null && d.memoizedState.isDehydrated)
            try {
              de(
                e,
                Fy,
                t.containerInfo
              );
            } catch (he) {
              Fe(e, e.return, he);
            }
          K1 && (K1 = !1, tg(e)), t.effectDuration += $o(
            y
          );
          break;
        case 4:
          h = zi, zi = Th(
            e.stateNode.containerInfo
          ), ba(t, e), Sa(e), zi = h;
          break;
        case 12:
          h = gu(), ba(t, e), Sa(e), e.stateNode.effectDuration += ha(h);
          break;
        case 31:
          ba(t, e), Sa(e), h & 4 && (h = e.updateQueue, h !== null && (e.updateQueue = null, lc(e, h)));
          break;
        case 13:
          ba(t, e), Sa(e), e.child.flags & 8192 && e.memoizedState !== null != (d !== null && d.memoizedState !== null) && (Ev = Ll()), h & 4 && (h = e.updateQueue, h !== null && (e.updateQueue = null, lc(e, h)));
          break;
        case 22:
          y = e.memoizedState !== null;
          var E = d !== null && d.memoizedState !== null, q = Do, se = Jl;
          if (Do = q || y, Jl = se || E, ba(t, e), Jl = se, Do = q, E && !y && !q && !se && (e.mode & tt) !== qe && 0 <= Ce && 0 <= Be && 0.05 < Be - Ce && pd(
            e,
            Ce,
            Be
          ), Sa(e), h & 8192)
            e: for (t = e.stateNode, t._visibility = y ? t._visibility & ~Np : t._visibility | Np, !y || d === null || E || Do || Jl || (ac(e), (e.mode & tt) !== qe && 0 <= Ce && 0 <= Be && 0.05 < Be - Ce && pn(
              e,
              Ce,
              Be,
              "Disconnect"
            )), d = null, t = e; ; ) {
              if (t.tag === 5 || t.tag === 26) {
                if (d === null) {
                  E = d = t;
                  try {
                    p = E.stateNode, y ? de(
                      E,
                      vg,
                      p
                    ) : de(
                      E,
                      Eg,
                      E.stateNode,
                      E.memoizedProps
                    );
                  } catch (he) {
                    Fe(E, E.return, he);
                  }
                }
              } else if (t.tag === 6) {
                if (d === null) {
                  E = t;
                  try {
                    z = E.stateNode, y ? de(
                      E,
                      bg,
                      z
                    ) : de(
                      E,
                      Tg,
                      z,
                      E.memoizedProps
                    );
                  } catch (he) {
                    Fe(E, E.return, he);
                  }
                }
              } else if (t.tag === 18) {
                if (d === null) {
                  E = t;
                  try {
                    R = E.stateNode, y ? de(
                      E,
                      gg,
                      R
                    ) : de(
                      E,
                      Sg,
                      E.stateNode
                    );
                  } catch (he) {
                    Fe(E, E.return, he);
                  }
                }
              } else if ((t.tag !== 22 && t.tag !== 23 || t.memoizedState === null || t === e) && t.child !== null) {
                t.child.return = t, t = t.child;
                continue;
              }
              if (t === e) break e;
              for (; t.sibling === null; ) {
                if (t.return === null || t.return === e)
                  break e;
                d === t && (d = null), t = t.return;
              }
              d === t && (d = null), t.sibling.return = t.return, t = t.sibling;
            }
          h & 4 && (h = e.updateQueue, h !== null && (d = h.retryQueue, d !== null && (h.retryQueue = null, lc(e, d))));
          break;
        case 19:
          ba(t, e), Sa(e), h & 4 && (h = e.updateQueue, h !== null && (e.updateQueue = null, lc(e, h)));
          break;
        case 30:
          break;
        case 21:
          break;
        default:
          ba(t, e), Sa(e);
      }
      (e.mode & tt) !== qe && 0 <= Ce && 0 <= Be && ((bl || 0.05 < dl) && wn(
        e,
        Ce,
        Be,
        dl,
        ol
      ), e.alternate === null && e.return !== null && e.return.alternate !== null && 0.05 < Be - Ce && (Ry(
        e.return.alternate,
        e.return
      ) || pn(
        e,
        Ce,
        Be,
        "Mount"
      ))), jl(a), Za(i), ol = o, bl = f;
    }
    function Sa(e) {
      var t = e.flags;
      if (t & 2) {
        try {
          de(e, Dy, e);
        } catch (a) {
          Fe(e, e.return, a);
        }
        e.flags &= -3;
      }
      t & 4096 && (e.flags &= -4097);
    }
    function tg(e) {
      if (e.subtreeFlags & 1024)
        for (e = e.child; e !== null; ) {
          var t = e;
          tg(t), t.tag === 5 && t.flags & 1024 && t.stateNode.reset(), e = e.sibling;
        }
    }
    function Pa(e, t) {
      if (t.subtreeFlags & 8772)
        for (t = t.child; t !== null; )
          th(e, t.alternate, t), t = t.sibling;
    }
    function lh(e) {
      var t = Ft(), a = bn(), i = Ja(), o = Sn();
      switch (e.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          Wd(
            e,
            e.return,
            nu
          ), ac(e);
          break;
        case 1:
          An(e, e.return);
          var f = e.stateNode;
          typeof f.componentWillUnmount == "function" && Id(
            e,
            e.return,
            f
          ), ac(e);
          break;
        case 27:
          de(
            e,
            bi,
            e.stateNode
          );
        case 26:
        case 5:
          An(e, e.return), ac(e);
          break;
        case 22:
          e.memoizedState === null && ac(e);
          break;
        case 30:
          ac(e);
          break;
        default:
          ac(e);
      }
      (e.mode & tt) !== qe && 0 <= Ce && 0 <= Be && (bl || 0.05 < dl) && wn(
        e,
        Ce,
        Be,
        dl,
        ol
      ), jl(t), Za(a), ol = i, bl = o;
    }
    function ac(e) {
      for (e = e.child; e !== null; )
        lh(e), e = e.sibling;
    }
    function Uy(e, t, a, i) {
      var o = Ft(), f = bn(), d = Ja(), h = Sn(), y = a.flags;
      switch (a.tag) {
        case 0:
        case 11:
        case 15:
          Jn(
            e,
            a,
            i
          ), W0(a, nu);
          break;
        case 1:
          if (Jn(
            e,
            a,
            i
          ), t = a.stateNode, typeof t.componentDidMount == "function" && de(
            a,
            H1,
            a,
            t
          ), t = a.updateQueue, t !== null) {
            e = a.stateNode;
            try {
              de(
                a,
                Pm,
                t,
                e
              );
            } catch (p) {
              Fe(a, a.return, p);
            }
          }
          i && y & 64 && Ay(a), Pc(a, a.return);
          break;
        case 27:
          _y(a);
        case 26:
        case 5:
          Jn(
            e,
            a,
            i
          ), i && t === null && y & 4 && tc(a), Pc(a, a.return);
          break;
        case 12:
          if (i && y & 4) {
            y = gu(), Jn(
              e,
              a,
              i
            ), i = a.stateNode, i.effectDuration += ha(y);
            try {
              de(
                a,
                Oy,
                a,
                t,
                $f,
                i.effectDuration
              );
            } catch (p) {
              Fe(a, a.return, p);
            }
          } else
            Jn(
              e,
              a,
              i
            );
          break;
        case 31:
          Jn(
            e,
            a,
            i
          ), i && y & 4 && Cy(e, a);
          break;
        case 13:
          Jn(
            e,
            a,
            i
          ), i && y & 4 && xy(e, a);
          break;
        case 22:
          a.memoizedState === null && Jn(
            e,
            a,
            i
          ), Pc(a, a.return);
          break;
        case 30:
          break;
        default:
          Jn(
            e,
            a,
            i
          );
      }
      (a.mode & tt) !== qe && 0 <= Ce && 0 <= Be && (bl || 0.05 < dl) && wn(
        a,
        Ce,
        Be,
        dl,
        ol
      ), jl(o), Za(f), ol = d, bl = h;
    }
    function Jn(e, t, a) {
      for (a = a && (t.subtreeFlags & 8772) !== 0, t = t.child; t !== null; )
        Uy(
          e,
          t.alternate,
          t,
          a
        ), t = t.sibling;
    }
    function lr(e, t) {
      var a = null;
      e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (a = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== a && (e != null && wc(e), a != null && Rs(a));
    }
    function ar(e, t) {
      e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (wc(t), e != null && Rs(e));
    }
    function en(e, t, a, i, o) {
      if (t.subtreeFlags & 10256 || t.actualDuration !== 0 && (t.alternate === null || t.alternate.child !== t.child))
        for (t = t.child; t !== null; ) {
          var f = t.sibling;
          Ny(
            e,
            t,
            a,
            i,
            f !== null ? f.actualStartTime : o
          ), t = f;
        }
    }
    function Ny(e, t, a, i, o) {
      var f = Ft(), d = bn(), h = Ja(), y = Sn(), p = Vf, z = t.flags;
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          (t.mode & tt) !== qe && 0 < t.actualStartTime && (t.flags & 1) !== 0 && gd(
            t,
            t.actualStartTime,
            o,
            Pl,
            a
          ), en(
            e,
            t,
            a,
            i,
            o
          ), z & 2048 && Is(t, rn | ku);
          break;
        case 1:
          (t.mode & tt) !== qe && 0 < t.actualStartTime && ((t.flags & 128) !== 0 ? Bm(
            t,
            t.actualStartTime,
            o,
            []
          ) : (t.flags & 1) !== 0 && gd(
            t,
            t.actualStartTime,
            o,
            Pl,
            a
          )), en(
            e,
            t,
            a,
            i,
            o
          );
          break;
        case 3:
          var R = gu(), E = Pl;
          Pl = t.alternate !== null && t.alternate.memoizedState.isDehydrated && (t.flags & 256) === 0, en(
            e,
            t,
            a,
            i,
            o
          ), Pl = E, z & 2048 && (a = null, t.alternate !== null && (a = t.alternate.memoizedState.cache), i = t.memoizedState.cache, i !== a && (wc(i), a != null && Rs(a))), e.passiveEffectDuration += $o(
            R
          );
          break;
        case 12:
          if (z & 2048) {
            z = gu(), en(
              e,
              t,
              a,
              i,
              o
            ), e = t.stateNode, e.passiveEffectDuration += ha(z);
            try {
              de(
                t,
                P0,
                t,
                t.alternate,
                $f,
                e.passiveEffectDuration
              );
            } catch (q) {
              Fe(t, t.return, q);
            }
          } else
            en(
              e,
              t,
              a,
              i,
              o
            );
          break;
        case 31:
          z = Pl, R = t.alternate !== null ? t.alternate.memoizedState : null, E = t.memoizedState, R !== null && E === null ? (E = t.deletions, E !== null && 0 < E.length && E[0].tag === 18 ? (Pl = !1, R = R.hydrationErrors, R !== null && Bm(
            t,
            t.actualStartTime,
            o,
            R
          )) : Pl = !0) : Pl = !1, en(
            e,
            t,
            a,
            i,
            o
          ), Pl = z;
          break;
        case 13:
          z = Pl, R = t.alternate !== null ? t.alternate.memoizedState : null, E = t.memoizedState, R === null || R.dehydrated === null || E !== null && E.dehydrated !== null ? Pl = !1 : (E = t.deletions, E !== null && 0 < E.length && E[0].tag === 18 ? (Pl = !1, R = R.hydrationErrors, R !== null && Bm(
            t,
            t.actualStartTime,
            o,
            R
          )) : Pl = !0), en(
            e,
            t,
            a,
            i,
            o
          ), Pl = z;
          break;
        case 23:
          break;
        case 22:
          E = t.stateNode, R = t.alternate, t.memoizedState !== null ? E._visibility & po ? en(
            e,
            t,
            a,
            i,
            o
          ) : eo(
            e,
            t,
            a,
            i,
            o
          ) : E._visibility & po ? en(
            e,
            t,
            a,
            i,
            o
          ) : (E._visibility |= po, nc(
            e,
            t,
            a,
            i,
            (t.subtreeFlags & 10256) !== 0 || t.actualDuration !== 0 && (t.alternate === null || t.alternate.child !== t.child),
            o
          ), (t.mode & tt) === qe || Pl || (e = t.actualStartTime, 0 <= e && 0.05 < o - e && pd(t, e, o), 0 <= Ce && 0 <= Be && 0.05 < Be - Ce && pd(
            t,
            Ce,
            Be
          ))), z & 2048 && lr(
            R,
            t
          );
          break;
        case 24:
          en(
            e,
            t,
            a,
            i,
            o
          ), z & 2048 && ar(t.alternate, t);
          break;
        default:
          en(
            e,
            t,
            a,
            i,
            o
          );
      }
      (t.mode & tt) !== qe && ((e = !Pl && t.alternate === null && t.return !== null && t.return.alternate !== null) && (a = t.actualStartTime, 0 <= a && 0.05 < o - a && pn(
        t,
        a,
        o,
        "Mount"
      )), 0 <= Ce && 0 <= Be && ((bl || 0.05 < dl) && wn(
        t,
        Ce,
        Be,
        dl,
        ol
      ), e && 0.05 < Be - Ce && pn(
        t,
        Ce,
        Be,
        "Mount"
      ))), jl(f), Za(d), ol = h, bl = y, Vf = p;
    }
    function nc(e, t, a, i, o, f) {
      for (o = o && ((t.subtreeFlags & 10256) !== 0 || t.actualDuration !== 0 && (t.alternate === null || t.alternate.child !== t.child)), t = t.child; t !== null; ) {
        var d = t.sibling;
        nr(
          e,
          t,
          a,
          i,
          o,
          d !== null ? d.actualStartTime : f
        ), t = d;
      }
    }
    function nr(e, t, a, i, o, f) {
      var d = Ft(), h = bn(), y = Ja(), p = Sn(), z = Vf;
      o && (t.mode & tt) !== qe && 0 < t.actualStartTime && (t.flags & 1) !== 0 && gd(
        t,
        t.actualStartTime,
        f,
        Pl,
        a
      );
      var R = t.flags;
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          nc(
            e,
            t,
            a,
            i,
            o,
            f
          ), Is(t, rn);
          break;
        case 23:
          break;
        case 22:
          var E = t.stateNode;
          t.memoizedState !== null ? E._visibility & po ? nc(
            e,
            t,
            a,
            i,
            o,
            f
          ) : eo(
            e,
            t,
            a,
            i,
            f
          ) : (E._visibility |= po, nc(
            e,
            t,
            a,
            i,
            o,
            f
          )), o && R & 2048 && lr(
            t.alternate,
            t
          );
          break;
        case 24:
          nc(
            e,
            t,
            a,
            i,
            o,
            f
          ), o && R & 2048 && ar(t.alternate, t);
          break;
        default:
          nc(
            e,
            t,
            a,
            i,
            o,
            f
          );
      }
      (t.mode & tt) !== qe && 0 <= Ce && 0 <= Be && (bl || 0.05 < dl) && wn(
        t,
        Ce,
        Be,
        dl,
        ol
      ), jl(d), Za(h), ol = y, bl = p, Vf = z;
    }
    function eo(e, t, a, i, o) {
      if (t.subtreeFlags & 10256 || t.actualDuration !== 0 && (t.alternate === null || t.alternate.child !== t.child))
        for (var f = t.child; f !== null; ) {
          t = f.sibling;
          var d = e, h = a, y = i, p = t !== null ? t.actualStartTime : o, z = Vf;
          (f.mode & tt) !== qe && 0 < f.actualStartTime && (f.flags & 1) !== 0 && gd(
            f,
            f.actualStartTime,
            p,
            Pl,
            h
          );
          var R = f.flags;
          switch (f.tag) {
            case 22:
              eo(
                d,
                f,
                h,
                y,
                p
              ), R & 2048 && lr(f.alternate, f);
              break;
            case 24:
              eo(
                d,
                f,
                h,
                y,
                p
              ), R & 2048 && ar(f.alternate, f);
              break;
            default:
              eo(
                d,
                f,
                h,
                y,
                p
              );
          }
          Vf = z, f = t;
        }
    }
    function to(e, t, a) {
      if (e.subtreeFlags & Pp)
        for (e = e.child; e !== null; )
          ah(
            e,
            t,
            a
          ), e = e.sibling;
    }
    function ah(e, t, a) {
      switch (e.tag) {
        case 26:
          to(
            e,
            t,
            a
          ), e.flags & Pp && e.memoizedState !== null && ap(
            a,
            zi,
            e.memoizedState,
            e.memoizedProps
          );
          break;
        case 5:
          to(
            e,
            t,
            a
          );
          break;
        case 3:
        case 4:
          var i = zi;
          zi = Th(
            e.stateNode.containerInfo
          ), to(
            e,
            t,
            a
          ), zi = i;
          break;
        case 22:
          e.memoizedState === null && (i = e.alternate, i !== null && i.memoizedState !== null ? (i = Pp, Pp = 16777216, to(
            e,
            t,
            a
          ), Pp = i) : to(
            e,
            t,
            a
          ));
          break;
        default:
          to(
            e,
            t,
            a
          );
      }
    }
    function Hy(e) {
      var t = e.alternate;
      if (t !== null && (e = t.child, e !== null)) {
        t.child = null;
        do
          t = e.sibling, e.sibling = null, e = t;
        while (e !== null);
      }
    }
    function tn(e) {
      var t = e.deletions;
      if ((e.flags & 16) !== 0) {
        if (t !== null)
          for (var a = 0; a < t.length; a++) {
            var i = t[a], o = Ft();
            fa = i, Mu(
              i,
              e
            ), (i.mode & tt) !== qe && 0 <= Ce && 0 <= Be && 0.05 < Be - Ce && pn(
              i,
              Ce,
              Be,
              "Unmount"
            ), jl(o);
          }
        Hy(e);
      }
      if (e.subtreeFlags & 10256)
        for (e = e.child; e !== null; )
          nh(e), e = e.sibling;
    }
    function nh(e) {
      var t = Ft(), a = bn(), i = Ja(), o = Sn();
      switch (e.tag) {
        case 0:
        case 11:
        case 15:
          tn(e), e.flags & 2048 && Fd(
            e,
            e.return,
            rn | ku
          );
          break;
        case 3:
          var f = gu();
          tn(e), e.stateNode.passiveEffectDuration += $o(f);
          break;
        case 12:
          f = gu(), tn(e), e.stateNode.passiveEffectDuration += ha(f);
          break;
        case 22:
          f = e.stateNode, e.memoizedState !== null && f._visibility & po && (e.return === null || e.return.tag !== 13) ? (f._visibility &= ~po, uh(e), (e.mode & tt) !== qe && 0 <= Ce && 0 <= Be && 0.05 < Be - Ce && pn(
            e,
            Ce,
            Be,
            "Disconnect"
          )) : tn(e);
          break;
        default:
          tn(e);
      }
      (e.mode & tt) !== qe && 0 <= Ce && 0 <= Be && (bl || 0.05 < dl) && wn(
        e,
        Ce,
        Be,
        dl,
        ol
      ), jl(t), Za(a), bl = o, ol = i;
    }
    function uh(e) {
      var t = e.deletions;
      if ((e.flags & 16) !== 0) {
        if (t !== null)
          for (var a = 0; a < t.length; a++) {
            var i = t[a], o = Ft();
            fa = i, Mu(
              i,
              e
            ), (i.mode & tt) !== qe && 0 <= Ce && 0 <= Be && 0.05 < Be - Ce && pn(
              i,
              Ce,
              Be,
              "Unmount"
            ), jl(o);
          }
        Hy(e);
      }
      for (e = e.child; e !== null; )
        jy(e), e = e.sibling;
    }
    function jy(e) {
      var t = Ft(), a = bn(), i = Ja(), o = Sn();
      switch (e.tag) {
        case 0:
        case 11:
        case 15:
          Fd(
            e,
            e.return,
            rn
          ), uh(e);
          break;
        case 22:
          var f = e.stateNode;
          f._visibility & po && (f._visibility &= ~po, uh(e));
          break;
        default:
          uh(e);
      }
      (e.mode & tt) !== qe && 0 <= Ce && 0 <= Be && (bl || 0.05 < dl) && wn(
        e,
        Ce,
        Be,
        dl,
        ol
      ), jl(t), Za(a), bl = o, ol = i;
    }
    function Mu(e, t) {
      for (; fa !== null; ) {
        var a = fa, i = a, o = t, f = Ft(), d = bn(), h = Ja(), y = Sn();
        switch (i.tag) {
          case 0:
          case 11:
          case 15:
            Fd(
              i,
              o,
              rn
            );
            break;
          case 23:
          case 22:
            i.memoizedState !== null && i.memoizedState.cachePool !== null && (o = i.memoizedState.cachePool.pool, o != null && wc(o));
            break;
          case 24:
            Rs(i.memoizedState.cache);
        }
        if ((i.mode & tt) !== qe && 0 <= Ce && 0 <= Be && (bl || 0.05 < dl) && wn(
          i,
          Ce,
          Be,
          dl,
          ol
        ), jl(f), Za(d), bl = y, ol = h, i = a.child, i !== null) i.return = a, fa = i;
        else
          e: for (a = e; fa !== null; ) {
            if (i = fa, f = i.sibling, d = i.return, gl(i), i === a) {
              fa = null;
              break e;
            }
            if (f !== null) {
              f.return = d, fa = f;
              break e;
            }
            fa = d;
          }
      }
    }
    function wy() {
      aT.forEach(function(e) {
        return e();
      });
    }
    function By() {
      var e = typeof IS_REACT_ACT_ENVIRONMENT < "u" ? IS_REACT_ACT_ENVIRONMENT : void 0;
      return e || L.actQueue === null || console.error(
        "The current testing environment is not configured to support act(...)"
      ), e;
    }
    function ua(e) {
      if ((pt & ea) !== sa && at !== 0)
        return at & -at;
      var t = L.T;
      return t !== null ? (t._updatedFibers || (t._updatedFibers = /* @__PURE__ */ new Set()), t._updatedFibers.add(e), Ky()) : xi();
    }
    function hf() {
      if (Cn === 0)
        if ((at & 536870912) === 0 || st) {
          var e = _r;
          _r <<= 1, (_r & 3932160) === 0 && (_r = 262144), Cn = e;
        } else Cn = 536870912;
      return e = au.current, e !== null && (e.flags |= 32), Cn;
    }
    function Ge(e, t, a) {
      if (ym && console.error("useInsertionEffect must not schedule updates."), nb && (zv = !0), (e === Zt && (wt === Qr || wt === Vr) || e.cancelPendingCommit !== null) && (Cu(e, 0), On(
        e,
        at,
        Cn,
        !1
      )), xn(e, a), (pt & ea) !== sa && e === Zt) {
        if (Bu)
          switch (t.tag) {
            case 0:
            case 11:
            case 15:
              e = it && pe(it) || "Unknown", a2.has(e) || (a2.add(e), t = pe(t) || "Unknown", console.error(
                "Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://react.dev/link/setstate-in-render",
                t,
                e,
                e
              ));
              break;
            case 1:
              l2 || (console.error(
                "Cannot update during an existing state transition (such as within `render`). Render methods should be a pure function of props and state."
              ), l2 = !0);
          }
      } else
        qu && zl(e, t, a), or(t), e === Zt && ((pt & ea) === sa && (ls |= a), hl === Pf && On(
          e,
          at,
          Cn,
          !1
        )), xa(e);
    }
    function lg(e, t, a) {
      if ((pt & (ea | uu)) !== sa)
        throw Error("Should not already be working.");
      if (at !== 0 && it !== null) {
        var i = it, o = Ll();
        switch (kb) {
          case l0:
          case Qr:
            var f = qp;
            tl && ((i = i._debugTask) ? i.run(
              console.timeStamp.bind(
                console,
                "Suspended",
                f,
                o,
                Lu,
                void 0,
                "primary-light"
              )
            ) : console.timeStamp(
              "Suspended",
              f,
              o,
              Lu,
              void 0,
              "primary-light"
            ));
            break;
          case Vr:
            f = qp, tl && ((i = i._debugTask) ? i.run(
              console.timeStamp.bind(
                console,
                "Action",
                f,
                o,
                Lu,
                void 0,
                "primary-light"
              )
            ) : console.timeStamp(
              "Action",
              f,
              o,
              Lu,
              void 0,
              "primary-light"
            ));
            break;
          default:
            tl && (i = o - qp, 3 > i || console.timeStamp(
              "Blocked",
              qp,
              o,
              Lu,
              void 0,
              5 > i ? "primary-light" : 10 > i ? "primary" : 100 > i ? "primary-dark" : "error"
            ));
        }
      }
      f = (a = !a && (t & 127) === 0 && (t & e.expiredLanes) === 0 || Sl(e, t)) ? mi(e, t) : pf(e, t, !0);
      var d = a;
      do {
        if (f === _o) {
          hm && !a && On(e, t, 0, !1), t = wt, qp = Ql(), kb = t;
          break;
        } else {
          if (i = Ll(), o = e.current.alternate, d && !ng(o)) {
            jn(t), o = oa, f = i, !tl || f <= o || (Ol ? Ol.run(
              console.timeStamp.bind(
                console,
                "Teared Render",
                o,
                f,
                ht,
                rt,
                "error"
              )
            ) : console.timeStamp(
              "Teared Render",
              o,
              f,
              ht,
              rt,
              "error"
            )), uc(t, i), f = pf(e, t, !1), d = !1;
            continue;
          }
          if (f === Xr) {
            if (d = t, e.errorRecoveryDisabledLanes & d)
              var h = 0;
            else
              h = e.pendingLanes & -536870913, h = h !== 0 ? h : h & 536870912 ? 536870912 : 0;
            if (h !== 0) {
              jn(t), Ym(
                oa,
                i,
                t,
                Ol
              ), uc(t, i), t = h;
              e: {
                i = e, f = d, d = n0;
                var y = i.current.memoizedState.isDehydrated;
                if (y && (Cu(i, h).flags |= 256), h = pf(
                  i,
                  h,
                  !1
                ), h !== Xr) {
                  if (W1 && !y) {
                    i.errorRecoveryDisabledLanes |= f, ls |= f, f = Pf;
                    break e;
                  }
                  i = dn, dn = d, i !== null && (dn === null ? dn = i : dn.push.apply(
                    dn,
                    i
                  ));
                }
                f = h;
              }
              if (d = !1, f !== Xr) continue;
              i = Ll();
            }
          }
          if (f === t0) {
            jn(t), Ym(
              oa,
              i,
              t,
              Ol
            ), uc(t, i), Cu(e, 0), On(e, t, 0, !0);
            break;
          }
          e: {
            switch (a = e, f) {
              case _o:
              case t0:
                throw Error("Root did not complete. This is a bug in React.");
              case Pf:
                if ((t & 4194048) !== t) break;
              case gv:
                jn(t), U0(
                  oa,
                  i,
                  t,
                  Ol
                ), uc(t, i), o = t, (o & 127) !== 0 ? lv = i : (o & 4194048) !== 0 && (av = i), On(
                  a,
                  t,
                  Cn,
                  !es
                );
                break e;
              case Xr:
                dn = null;
                break;
              case pv:
              case QS:
                break;
              default:
                throw Error("Unknown root exit status.");
            }
            if (L.actQueue !== null)
              Xt(
                a,
                o,
                t,
                dn,
                u0,
                Sv,
                Cn,
                ls,
                Zr,
                f,
                null,
                null,
                oa,
                i
              );
            else {
              if ((t & 62914560) === t && (d = Ev + JS - Ll(), 10 < d)) {
                if (On(
                  a,
                  t,
                  Cn,
                  !es
                ), Sc(a, 0, !0) !== 0) break e;
                Di = t, a.timeoutHandle = r2(
                  ag.bind(
                    null,
                    a,
                    o,
                    dn,
                    u0,
                    Sv,
                    t,
                    Cn,
                    ls,
                    Zr,
                    es,
                    f,
                    "Throttled",
                    oa,
                    i
                  ),
                  d
                );
                break e;
              }
              ag(
                a,
                o,
                dn,
                u0,
                Sv,
                t,
                Cn,
                ls,
                Zr,
                es,
                f,
                null,
                oa,
                i
              );
            }
          }
        }
        break;
      } while (!0);
      xa(e);
    }
    function ag(e, t, a, i, o, f, d, h, y, p, z, R, E, q) {
      e.timeoutHandle = Wr;
      var se = t.subtreeFlags, he = null;
      if ((se & 8192 || (se & 16785408) === 16785408) && (he = {
        stylesheets: null,
        count: 0,
        imgCount: 0,
        imgBytes: 0,
        suspenseyImages: [],
        waitingForImages: !0,
        waitingForViewTransition: !1,
        unsuspend: yn
      }, ah(t, f, he), se = (f & 62914560) === f ? Ev - Ll() : (f & 4194048) === f ? ZS - Ll() : 0, se = zh(he, se), se !== null)) {
        Di = f, e.cancelPendingCommit = se(
          Xt.bind(
            null,
            e,
            t,
            f,
            a,
            i,
            o,
            d,
            h,
            y,
            z,
            he,
            he.waitingForViewTransition ? "Waiting for the previous Animation" : 0 < he.count ? 0 < he.imgCount ? "Suspended on CSS and Images" : "Suspended on CSS" : he.imgCount === 1 ? "Suspended on an Image" : 0 < he.imgCount ? "Suspended on Images" : null,
            E,
            q
          )
        ), On(
          e,
          f,
          d,
          !p
        );
        return;
      }
      Xt(
        e,
        t,
        f,
        a,
        i,
        o,
        d,
        h,
        y,
        z,
        he,
        R,
        E,
        q
      );
    }
    function ng(e) {
      for (var t = e; ; ) {
        var a = t.tag;
        if ((a === 0 || a === 11 || a === 15) && t.flags & 16384 && (a = t.updateQueue, a !== null && (a = a.stores, a !== null)))
          for (var i = 0; i < a.length; i++) {
            var o = a[i], f = o.getSnapshot;
            o = o.value;
            try {
              if (!on(f(), o)) return !1;
            } catch {
              return !1;
            }
          }
        if (a = t.child, t.subtreeFlags & 16384 && a !== null)
          a.return = t, t = a;
        else {
          if (t === e) break;
          for (; t.sibling === null; ) {
            if (t.return === null || t.return === e) return !0;
            t = t.return;
          }
          t.sibling.return = t.return, t = t.sibling;
        }
      }
      return !0;
    }
    function On(e, t, a, i) {
      t &= ~F1, t &= ~ls, e.suspendedLanes |= t, e.pingedLanes &= ~t, i && (e.warmLanes |= t), i = e.expirationTimes;
      for (var o = t; 0 < o; ) {
        var f = 31 - Fl(o), d = 1 << f;
        i[f] = -1, o &= ~d;
      }
      a !== 0 && No(e, a, t);
    }
    function ln() {
      return (pt & (ea | uu)) === sa ? (Uu(0), !1) : !0;
    }
    function ih() {
      if (it !== null) {
        if (wt === Mn)
          var e = it.return;
        else
          e = it, Jo(), Vi(e), nm = null, $p = 0, e = it;
        for (; e !== null; )
          Ty(e.alternate, e), e = e.return;
        it = null;
      }
    }
    function uc(e, t) {
      (e & 127) !== 0 && (Nr = t), (e & 4194048) !== 0 && (Eo = t), (e & 62914560) !== 0 && (Kb = t), (e & 2080374784) !== 0 && ($b = t);
    }
    function Cu(e, t) {
      tl && (console.timeStamp(
        "Blocking Track",
        3e-3,
        3e-3,
        "Blocking",
        rt,
        "primary-light"
      ), console.timeStamp(
        "Transition Track",
        3e-3,
        3e-3,
        "Transition",
        rt,
        "primary-light"
      ), console.timeStamp(
        "Suspense Track",
        3e-3,
        3e-3,
        "Suspense",
        rt,
        "primary-light"
      ), console.timeStamp(
        "Idle Track",
        3e-3,
        3e-3,
        "Idle",
        rt,
        "primary-light"
      ));
      var a = oa;
      if (oa = Ql(), at !== 0 && 0 < a) {
        if (jn(at), hl === pv || hl === Pf)
          U0(
            a,
            oa,
            t,
            Ol
          );
        else {
          var i = oa, o = Ol;
          if (tl && !(i <= a)) {
            var f = (t & 738197653) === t ? "tertiary-dark" : "primary-dark", d = (t & 536870912) === t ? "Prewarm" : (t & 201326741) === t ? "Interrupted Hydration" : "Interrupted Render";
            o ? o.run(
              console.timeStamp.bind(
                console,
                d,
                a,
                i,
                ht,
                rt,
                f
              )
            ) : console.timeStamp(
              d,
              a,
              i,
              ht,
              rt,
              f
            );
          }
        }
        uc(at, oa);
      }
      if (a = Ol, Ol = null, (t & 127) !== 0) {
        Ol = wp, o = 0 <= pc && pc < Nr ? Nr : pc, i = 0 <= Hr && Hr < Nr ? Nr : Hr, f = 0 <= i ? i : 0 <= o ? o : oa, 0 <= lv ? (jn(2), N0(
          lv,
          f,
          t,
          a
        )) : nv & 127, a = o;
        var h = i, y = Bp, p = 0 < tm, z = kf === jp, R = kf === tv;
        if (o = oa, i = wp, f = M1, d = C1, tl) {
          if (ht = "Blocking", 0 < a ? a > o && (a = o) : a = o, 0 < h ? h > a && (h = a) : h = a, y !== null && a > h) {
            var E = p ? "secondary-light" : "warning";
            i ? i.run(
              console.timeStamp.bind(
                console,
                p ? "Consecutive" : "Event: " + y,
                h,
                a,
                ht,
                rt,
                E
              )
            ) : console.timeStamp(
              p ? "Consecutive" : "Event: " + y,
              h,
              a,
              ht,
              rt,
              E
            );
          }
          o > a && (h = z ? "error" : (t & 738197653) === t ? "tertiary-light" : "primary-light", z = R ? "Promise Resolved" : z ? "Cascading Update" : 5 < o - a ? "Update Blocked" : "Update", R = [], d != null && R.push(["Component name", d]), f != null && R.push(["Method name", f]), a = {
            start: a,
            end: o,
            detail: {
              devtools: {
                properties: R,
                track: ht,
                trackGroup: rt,
                color: h
              }
            }
          }, i ? i.run(
            performance.measure.bind(
              performance,
              z,
              a
            )
          ) : performance.measure(z, a));
        }
        pc = -1.1, kf = 0, C1 = M1 = null, lv = -1.1, tm = Hr, Hr = -1.1, Nr = Ql();
      }
      if ((t & 4194048) !== 0 && (Ol = Yp, o = 0 <= To && To < Eo ? Eo : To, a = 0 <= Ku && Ku < Eo ? Eo : Ku, i = 0 <= Wf && Wf < Eo ? Eo : Wf, f = 0 <= i ? i : 0 <= a ? a : oa, 0 <= av ? (jn(256), N0(
        av,
        f,
        t,
        Ol
      )) : nv & 4194048, R = i, h = jr, y = 0 < Ff, p = x1 === tv, f = oa, i = Yp, d = Zb, z = Jb, tl && (ht = "Transition", 0 < a ? a > f && (a = f) : a = f, 0 < o ? o > a && (o = a) : o = a, 0 < R ? R > o && (R = o) : R = o, o > R && h !== null && (E = y ? "secondary-light" : "warning", i ? i.run(
        console.timeStamp.bind(
          console,
          y ? "Consecutive" : "Event: " + h,
          R,
          o,
          ht,
          rt,
          E
        )
      ) : console.timeStamp(
        y ? "Consecutive" : "Event: " + h,
        R,
        o,
        ht,
        rt,
        E
      )), a > o && (i ? i.run(
        console.timeStamp.bind(
          console,
          "Action",
          o,
          a,
          ht,
          rt,
          "primary-dark"
        )
      ) : console.timeStamp(
        "Action",
        o,
        a,
        ht,
        rt,
        "primary-dark"
      )), f > a && (o = p ? "Promise Resolved" : 5 < f - a ? "Update Blocked" : "Update", R = [], z != null && R.push(["Component name", z]), d != null && R.push(["Method name", d]), a = {
        start: a,
        end: f,
        detail: {
          devtools: {
            properties: R,
            track: ht,
            trackGroup: rt,
            color: "primary-light"
          }
        }
      }, i ? i.run(
        performance.measure.bind(
          performance,
          o,
          a
        )
      ) : performance.measure(o, a))), Ku = To = -1.1, x1 = 0, av = -1.1, Ff = Wf, Wf = -1.1, Eo = Ql()), (t & 62914560) !== 0 && (nv & 62914560) !== 0 && (jn(4194304), qm(Kb, oa)), (t & 2080374784) !== 0 && (nv & 2080374784) !== 0 && (jn(268435456), qm($b, oa)), a = e.timeoutHandle, a !== Wr && (e.timeoutHandle = Wr, pT(a)), a = e.cancelPendingCommit, a !== null && (e.cancelPendingCommit = null, a()), Di = 0, ih(), Zt = e, it = a = yu(
        e.current,
        null
      ), at = t, wt = Mn, iu = null, es = !1, hm = Sl(e, t), W1 = !1, hl = _o, Zr = Cn = F1 = ls = ts = 0, dn = n0 = null, Sv = !1, (t & 8) !== 0 && (t |= t & 32), i = e.entangledLanes, i !== 0)
        for (e = e.entanglements, i &= t; 0 < i; )
          o = 31 - Fl(i), f = 1 << o, t |= e[o], i &= ~f;
      return vc = t, vd(), e = qb(), 1e3 < e - Yb && (L.recentlyCreatedOwnerStacks = 0, Yb = e), Ai.discardPendingWarnings(), a;
    }
    function Kn(e, t) {
      Xe = null, L.H = Ip, L.getCurrentStack = null, Bu = !1, ja = null, t === am || t === ov ? (t = qc(), wt = l0) : t === j1 ? (t = qc(), wt = VS) : wt = t === Z1 ? k1 : t !== null && typeof t == "object" && typeof t.then == "function" ? a0 : vv, iu = t;
      var a = it;
      a === null ? (hl = t0, Ks(
        e,
        da(t, e.current)
      )) : a.mode & tt && zd(a);
    }
    function Yy() {
      var e = au.current;
      return e === null ? !0 : (at & 4194048) === at ? $u === null : (at & 62914560) === at || (at & 536870912) !== 0 ? e === $u : !1;
    }
    function ch() {
      var e = L.H;
      return L.H = Ip, e === null ? Ip : e;
    }
    function qy() {
      var e = L.A;
      return L.A = lT, e;
    }
    function mf(e) {
      Ol === null && (Ol = e._debugTask == null ? null : e._debugTask);
    }
    function yf() {
      hl = Pf, es || (at & 4194048) !== at && au.current !== null || (hm = !0), (ts & 134217727) === 0 && (ls & 134217727) === 0 || Zt === null || On(
        Zt,
        at,
        Cn,
        !1
      );
    }
    function pf(e, t, a) {
      var i = pt;
      pt |= ea;
      var o = ch(), f = qy();
      if (Zt !== e || at !== t) {
        if (qu) {
          var d = e.memoizedUpdaters;
          0 < d.size && (vf(e, at), d.clear()), La(e, t);
        }
        u0 = null, Cu(e, t);
      }
      t = !1, d = hl;
      e: do
        try {
          if (wt !== Mn && it !== null) {
            var h = it, y = iu;
            switch (wt) {
              case k1:
                ih(), d = gv;
                break e;
              case l0:
              case Qr:
              case Vr:
              case a0:
                au.current === null && (t = !0);
                var p = wt;
                if (wt = Mn, iu = null, gf(e, h, y, p), a && hm) {
                  d = _o;
                  break e;
                }
                break;
              default:
                p = wt, wt = Mn, iu = null, gf(e, h, y, p);
            }
          }
          Gy(), d = hl;
          break;
        } catch (z) {
          Kn(e, z);
        }
      while (!0);
      return t && e.shellSuspendCounter++, Jo(), pt = i, L.H = o, L.A = f, it === null && (Zt = null, at = 0, vd()), d;
    }
    function Gy() {
      for (; it !== null; ) oh(it);
    }
    function mi(e, t) {
      var a = pt;
      pt |= ea;
      var i = ch(), o = qy();
      if (Zt !== e || at !== t) {
        if (qu) {
          var f = e.memoizedUpdaters;
          0 < f.size && (vf(e, at), f.clear()), La(e, t);
        }
        u0 = null, Tv = Ll() + KS, Cu(e, t);
      } else
        hm = Sl(
          e,
          t
        );
      e: do
        try {
          if (wt !== Mn && it !== null)
            t: switch (t = it, f = iu, wt) {
              case vv:
                wt = Mn, iu = null, gf(
                  e,
                  t,
                  f,
                  vv
                );
                break;
              case Qr:
              case Vr:
                if (Fm(f)) {
                  wt = Mn, iu = null, Ly(t);
                  break;
                }
                t = function() {
                  wt !== Qr && wt !== Vr || Zt !== e || (wt = bv), xa(e);
                }, f.then(t, t);
                break e;
              case l0:
                wt = bv;
                break e;
              case VS:
                wt = $1;
                break e;
              case bv:
                Fm(f) ? (wt = Mn, iu = null, Ly(t)) : (wt = Mn, iu = null, gf(
                  e,
                  t,
                  f,
                  bv
                ));
                break;
              case $1:
                var d = null;
                switch (it.tag) {
                  case 26:
                    d = it.memoizedState;
                  case 5:
                  case 27:
                    var h = it;
                    if (d ? ct(d) : h.stateNode.complete) {
                      wt = Mn, iu = null;
                      var y = h.sibling;
                      if (y !== null) it = y;
                      else {
                        var p = h.return;
                        p !== null ? (it = p, ur(p)) : it = null;
                      }
                      break t;
                    }
                    break;
                  default:
                    console.error(
                      "Unexpected type of fiber triggered a suspensey commit. This is a bug in React."
                    );
                }
                wt = Mn, iu = null, gf(
                  e,
                  t,
                  f,
                  $1
                );
                break;
              case a0:
                wt = Mn, iu = null, gf(
                  e,
                  t,
                  f,
                  a0
                );
                break;
              case k1:
                ih(), hl = gv;
                break e;
              default:
                throw Error(
                  "Unexpected SuspendedReason. This is a bug in React."
                );
            }
          L.actQueue !== null ? Gy() : Tl();
          break;
        } catch (z) {
          Kn(e, z);
        }
      while (!0);
      return Jo(), L.H = i, L.A = o, pt = a, it !== null ? _o : (Zt = null, at = 0, vd(), hl);
    }
    function Tl() {
      for (; it !== null && !wh(); )
        oh(it);
    }
    function oh(e) {
      var t = e.alternate;
      (e.mode & tt) !== qe ? (ai(e), t = de(
        e,
        Fs,
        t,
        e,
        vc
      ), zd(e)) : t = de(
        e,
        Fs,
        t,
        e,
        vc
      ), e.memoizedProps = e.pendingProps, t === null ? ur(e) : it = t;
    }
    function Ly(e) {
      var t = de(e, Gl, e);
      e.memoizedProps = e.pendingProps, t === null ? ur(e) : it = t;
    }
    function Gl(e) {
      var t = e.alternate, a = (e.mode & tt) !== qe;
      switch (a && ai(e), e.tag) {
        case 15:
        case 0:
          t = py(
            t,
            e,
            e.pendingProps,
            e.type,
            void 0,
            at
          );
          break;
        case 11:
          t = py(
            t,
            e,
            e.pendingProps,
            e.type.render,
            e.ref,
            at
          );
          break;
        case 5:
          Vi(e);
        default:
          Ty(t, e), e = it = Qm(e, vc), t = Fs(t, e, vc);
      }
      return a && zd(e), t;
    }
    function gf(e, t, a, i) {
      Jo(), Vi(t), nm = null, $p = 0;
      var o = t.return;
      try {
        if (fy(
          e,
          o,
          t,
          a,
          at
        )) {
          hl = t0, Ks(
            e,
            da(a, e.current)
          ), it = null;
          return;
        }
      } catch (f) {
        if (o !== null) throw it = o, f;
        hl = t0, Ks(
          e,
          da(a, e.current)
        ), it = null;
        return;
      }
      t.flags & 32768 ? (st || i === vv ? e = !0 : hm || (at & 536870912) !== 0 ? e = !1 : (es = e = !0, (i === Qr || i === Vr || i === l0 || i === a0) && (i = au.current, i !== null && i.tag === 13 && (i.flags |= 16384))), Xy(t, e)) : ur(t);
    }
    function ur(e) {
      var t = e;
      do {
        if ((t.flags & 32768) !== 0) {
          Xy(
            t,
            es
          );
          return;
        }
        var a = t.alternate;
        if (e = t.return, ai(t), a = de(
          t,
          Ey,
          a,
          t,
          vc
        ), (t.mode & tt) !== qe && Ms(t), a !== null) {
          it = a;
          return;
        }
        if (t = t.sibling, t !== null) {
          it = t;
          return;
        }
        it = t = e;
      } while (t !== null);
      hl === _o && (hl = QS);
    }
    function Xy(e, t) {
      do {
        var a = k0(e.alternate, e);
        if (a !== null) {
          a.flags &= 32767, it = a;
          return;
        }
        if ((e.mode & tt) !== qe) {
          Ms(e), a = e.actualDuration;
          for (var i = e.child; i !== null; )
            a += i.actualDuration, i = i.sibling;
          e.actualDuration = a;
        }
        if (a = e.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !t && (e = e.sibling, e !== null)) {
          it = e;
          return;
        }
        it = e = a;
      } while (e !== null);
      hl = gv, it = null;
    }
    function Xt(e, t, a, i, o, f, d, h, y, p, z, R, E, q) {
      e.cancelPendingCommit = null;
      do
        ir();
      while ($l !== ns);
      if (Ai.flushLegacyContextWarning(), Ai.flushPendingUnsafeLifecycleWarnings(), (pt & (ea | uu)) !== sa)
        throw Error("Should not already be working.");
      if (jn(a), p === Xr ? Ym(
        E,
        q,
        a,
        Ol
      ) : i !== null ? Iv(
        E,
        q,
        a,
        i,
        t !== null && t.alternate !== null && t.alternate.memoizedState.isDehydrated && (t.flags & 256) !== 0,
        Ol
      ) : Fv(
        E,
        q,
        a,
        Ol
      ), t !== null) {
        if (a === 0 && console.error(
          "finishedLanes should not be empty during a commit. This is a bug in React."
        ), t === e.current)
          throw Error(
            "Cannot commit the same tree as before. This error is likely caused by a bug in React. Please file an issue."
          );
        if (f = t.lanes | t.childLanes, f |= O1, ed(
          e,
          a,
          f,
          d,
          h,
          y
        ), e === Zt && (it = Zt = null, at = 0), mm = t, us = e, Di = a, eb = f, lb = o, PS = i, tb = q, e2 = R, _i = Av, t2 = null, t.actualDuration !== 0 || (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, bf(ro, function() {
          return r0 = window.event, _i === Av && (_i = P1), cr(), null;
        })) : (e.callbackNode = null, e.callbackPriority = 0), So = null, $f = Ql(), R !== null && Pv(
          q,
          $f,
          R,
          Ol
        ), i = (t.flags & 13878) !== 0, (t.subtreeFlags & 13878) !== 0 || i) {
          i = L.T, L.T = null, o = At.p, At.p = Cl, d = pt, pt |= uu;
          try {
            l1(e, t, a);
          } finally {
            pt = d, At.p = o, L.T = i;
          }
        }
        $l = kS, Ea(), xu(), Qy();
      }
    }
    function Ea() {
      if ($l === kS) {
        $l = ns;
        var e = us, t = mm, a = Di, i = (t.flags & 13878) !== 0;
        if ((t.subtreeFlags & 13878) !== 0 || i) {
          i = L.T, L.T = null;
          var o = At.p;
          At.p = Cl;
          var f = pt;
          pt |= uu;
          try {
            rm = a, dm = e, Bc(), tr(t, e), dm = rm = null, a = hb;
            var d = yd(e.containerInfo), h = a.focusedElem, y = a.selectionRange;
            if (d !== h && h && h.ownerDocument && R0(
              h.ownerDocument.documentElement,
              h
            )) {
              if (y !== null && jm(h)) {
                var p = y.start, z = y.end;
                if (z === void 0 && (z = p), "selectionStart" in h)
                  h.selectionStart = p, h.selectionEnd = Math.min(
                    z,
                    h.value.length
                  );
                else {
                  var R = h.ownerDocument || document, E = R && R.defaultView || window;
                  if (E.getSelection) {
                    var q = E.getSelection(), se = h.textContent.length, he = Math.min(
                      y.start,
                      se
                    ), Wt = y.end === void 0 ? he : Math.min(y.end, se);
                    !q.extend && he > Wt && (d = Wt, Wt = he, he = d);
                    var dt = _0(
                      h,
                      he
                    ), S = _0(
                      h,
                      Wt
                    );
                    if (dt && S && (q.rangeCount !== 1 || q.anchorNode !== dt.node || q.anchorOffset !== dt.offset || q.focusNode !== S.node || q.focusOffset !== S.offset)) {
                      var T = R.createRange();
                      T.setStart(dt.node, dt.offset), q.removeAllRanges(), he > Wt ? (q.addRange(T), q.extend(S.node, S.offset)) : (T.setEnd(S.node, S.offset), q.addRange(T));
                    }
                  }
                }
              }
              for (R = [], q = h; q = q.parentNode; )
                q.nodeType === 1 && R.push({
                  element: q,
                  left: q.scrollLeft,
                  top: q.scrollTop
                });
              for (typeof h.focus == "function" && h.focus(), h = 0; h < R.length; h++) {
                var O = R[h];
                O.element.scrollLeft = O.left, O.element.scrollTop = O.top;
              }
            }
            qv = !!db, hb = db = null;
          } finally {
            pt = f, At.p = o, L.T = i;
          }
        }
        e.current = t, $l = WS;
      }
    }
    function xu() {
      if ($l === WS) {
        $l = ns;
        var e = t2;
        if (e !== null) {
          $f = Ql();
          var t = bo, a = $f;
          !tl || a <= t || console.timeStamp(
            e,
            t,
            a,
            ht,
            rt,
            "secondary-light"
          );
        }
        e = us, t = mm, a = Di;
        var i = (t.flags & 8772) !== 0;
        if ((t.subtreeFlags & 8772) !== 0 || i) {
          i = L.T, L.T = null;
          var o = At.p;
          At.p = Cl;
          var f = pt;
          pt |= uu;
          try {
            rm = a, dm = e, Bc(), th(
              e,
              t.alternate,
              t
            ), dm = rm = null;
          } finally {
            pt = f, At.p = o, L.T = i;
          }
        }
        e = tb, t = e2, bo = Ql(), e = t === null ? e : $f, t = bo, a = _i === I1, i = Ol, So !== null ? H0(
          e,
          t,
          So,
          !1,
          i
        ) : !tl || t <= e || (i ? i.run(
          console.timeStamp.bind(
            console,
            a ? "Commit Interrupted View Transition" : "Commit",
            e,
            t,
            ht,
            rt,
            a ? "error" : "secondary-dark"
          )
        ) : console.timeStamp(
          a ? "Commit Interrupted View Transition" : "Commit",
          e,
          t,
          ht,
          rt,
          a ? "error" : "secondary-dark"
        )), $l = FS;
      }
    }
    function Qy() {
      if ($l === IS || $l === FS) {
        if ($l === IS) {
          var e = bo;
          bo = Ql();
          var t = bo, a = _i === I1;
          !tl || t <= e || console.timeStamp(
            a ? "Interrupted View Transition" : "Starting Animation",
            e,
            t,
            ht,
            rt,
            a ? " error" : "secondary-light"
          ), _i !== I1 && (_i = $S);
        }
        $l = ns, Bh(), e = us;
        var i = mm;
        t = Di, a = PS;
        var o = i.actualDuration !== 0 || (i.subtreeFlags & 10256) !== 0 || (i.flags & 10256) !== 0;
        o ? $l = Ov : ($l = ns, mm = us = null, Vy(
          e,
          e.pendingLanes
        ), Jr = 0, c0 = null);
        var f = e.pendingLanes;
        if (f === 0 && (as = null), o || rh(e), f = Nl(t), i = i.stateNode, Ml && typeof Ml.onCommitFiberRoot == "function")
          try {
            var d = (i.current.flags & 128) === 128;
            switch (f) {
              case Cl:
                var h = Sp;
                break;
              case Il:
                h = Yh;
                break;
              case ca:
                h = ro;
                break;
              case hc:
                h = qh;
                break;
              default:
                h = ro;
            }
            Ml.onCommitFiberRoot(
              ho,
              i,
              h,
              d
            );
          } catch (R) {
            Yu || (Yu = !0, console.error(
              "React instrumentation encountered an error: %o",
              R
            ));
          }
        if (qu && e.memoizedUpdaters.clear(), wy(), a !== null) {
          d = L.T, h = At.p, At.p = Cl, L.T = null;
          try {
            var y = e.onRecoverableError;
            for (i = 0; i < a.length; i++) {
              var p = a[i], z = ug(p.stack);
              de(
                p.source,
                y,
                p.value,
                z
              );
            }
          } finally {
            L.T = d, At.p = h;
          }
        }
        (Di & 3) !== 0 && ir(), xa(e), f = e.pendingLanes, (t & 261930) !== 0 && (f & 42) !== 0 ? (iv = !0, e === ab ? i0++ : (i0 = 0, ab = e)) : i0 = 0, o || uc(t, bo), Uu(0);
      }
    }
    function ug(e) {
      return e = { componentStack: e }, Object.defineProperty(e, "digest", {
        get: function() {
          console.error(
            'You are accessing "digest" from the errorInfo object passed to onRecoverableError. This property is no longer provided as part of errorInfo but can be accessed as a property of the Error instance itself.'
          );
        }
      }), e;
    }
    function Vy(e, t) {
      (e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, Rs(t)));
    }
    function ir() {
      return Ea(), xu(), Qy(), cr();
    }
    function cr() {
      if ($l !== Ov) return !1;
      var e = us, t = eb;
      eb = 0;
      var a = Nl(Di), i = ca > a ? ca : a;
      a = L.T;
      var o = At.p;
      try {
        At.p = i, L.T = null;
        var f = lb;
        lb = null, i = us;
        var d = Di;
        if ($l = ns, mm = us = null, Di = 0, (pt & (ea | uu)) !== sa)
          throw Error("Cannot flush passive effects while already rendering.");
        jn(d), nb = !0, zv = !1;
        var h = 0;
        if (So = null, h = Ll(), _i === $S)
          qm(
            bo,
            h,
            kE
          );
        else {
          var y = bo, p = h, z = _i === P1;
          !tl || p <= y || (Ol ? Ol.run(
            console.timeStamp.bind(
              console,
              z ? "Waiting for Paint" : "Waiting",
              y,
              p,
              ht,
              rt,
              "secondary-light"
            )
          ) : console.timeStamp(
            z ? "Waiting for Paint" : "Waiting",
            y,
            p,
            ht,
            rt,
            "secondary-light"
          ));
        }
        y = pt, pt |= uu;
        var R = i.current;
        Bc(), nh(R);
        var E = i.current;
        R = tb, Bc(), Ny(
          i,
          E,
          d,
          f,
          R
        ), rh(i), pt = y;
        var q = Ll();
        if (E = h, R = Ol, So !== null ? H0(
          E,
          q,
          So,
          !0,
          R
        ) : !tl || q <= E || (R ? R.run(
          console.timeStamp.bind(
            console,
            "Remaining Effects",
            E,
            q,
            ht,
            rt,
            "secondary-dark"
          )
        ) : console.timeStamp(
          "Remaining Effects",
          E,
          q,
          ht,
          rt,
          "secondary-dark"
        )), uc(d, q), Uu(0, !1), zv ? i === c0 ? Jr++ : (Jr = 0, c0 = i) : Jr = 0, zv = nb = !1, Ml && typeof Ml.onPostCommitFiberRoot == "function")
          try {
            Ml.onPostCommitFiberRoot(ho, i);
          } catch (he) {
            Yu || (Yu = !0, console.error(
              "React instrumentation encountered an error: %o",
              he
            ));
          }
        var se = i.current.stateNode;
        return se.effectDuration = 0, se.passiveEffectDuration = 0, !0;
      } finally {
        At.p = o, L.T = a, Vy(e, t);
      }
    }
    function Ta(e, t, a) {
      t = da(a, t), G0(t), t = Ld(e.stateNode, t, 2), e = bu(e, t, 2), e !== null && (xn(e, 2), xa(e));
    }
    function Fe(e, t, a) {
      if (ym = !1, e.tag === 3)
        Ta(e, e, a);
      else {
        for (; t !== null; ) {
          if (t.tag === 3) {
            Ta(
              t,
              e,
              a
            );
            return;
          }
          if (t.tag === 1) {
            var i = t.stateNode;
            if (typeof t.type.getDerivedStateFromError == "function" || typeof i.componentDidCatch == "function" && (as === null || !as.has(i))) {
              e = da(a, e), G0(e), a = Xd(2), i = bu(t, a, 2), i !== null && (Qd(
                a,
                i,
                t,
                e
              ), xn(i, 2), xa(i));
              return;
            }
          }
          t = t.return;
        }
        console.error(
          `Internal React error: Attempted to capture a commit phase error inside a detached tree. This indicates a bug in React. Potential causes include deleting the same fiber more than once, committing an already-finished tree, or an inconsistent return pointer.

Error message:

%s`,
          a
        );
      }
    }
    function fh(e, t, a) {
      var i = e.pingCache;
      if (i === null) {
        i = e.pingCache = new nT();
        var o = /* @__PURE__ */ new Set();
        i.set(t, o);
      } else
        o = i.get(t), o === void 0 && (o = /* @__PURE__ */ new Set(), i.set(t, o));
      o.has(a) || (W1 = !0, o.add(a), i = Ca.bind(null, e, t, a), qu && vf(e, a), t.then(i, i));
    }
    function Ca(e, t, a) {
      var i = e.pingCache;
      i !== null && i.delete(t), e.pingedLanes |= e.suspendedLanes & a, e.warmLanes &= ~a, (a & 127) !== 0 ? 0 > pc && (Nr = pc = Ql(), wp = ev("Promise Resolved"), kf = tv) : (a & 4194048) !== 0 && 0 > Ku && (Eo = Ku = Ql(), Yp = ev("Promise Resolved"), x1 = tv), By() && L.actQueue === null && console.error(
        `A suspended resource finished loading inside a test, but the event was not wrapped in act(...).

When testing, code that resolves suspended data should be wrapped into act(...):

act(() => {
  /* finish loading suspended data */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act`
      ), Zt === e && (at & a) === a && (hl === Pf || hl === pv && (at & 62914560) === at && Ll() - Ev < JS ? (pt & ea) === sa && Cu(e, 0) : F1 |= a, Zr === at && (Zr = 0)), xa(e);
    }
    function Zy(e, t) {
      t === 0 && (t = xo()), e = aa(e, t), e !== null && (xn(e, t), xa(e));
    }
    function yi(e) {
      var t = e.memoizedState, a = 0;
      t !== null && (a = t.retryLane), Zy(e, a);
    }
    function lo(e, t) {
      var a = 0;
      switch (e.tag) {
        case 31:
        case 13:
          var i = e.stateNode, o = e.memoizedState;
          o !== null && (a = o.retryLane);
          break;
        case 19:
          i = e.stateNode;
          break;
        case 22:
          i = e.stateNode._retryCache;
          break;
        default:
          throw Error(
            "Pinged unknown suspense boundary type. This is probably a bug in React."
          );
      }
      i !== null && i.delete(t), Zy(e, a);
    }
    function $n(e, t, a) {
      if ((t.subtreeFlags & 67117056) !== 0)
        for (t = t.child; t !== null; ) {
          var i = e, o = t, f = o.type === za;
          f = a || f, o.tag !== 22 ? o.flags & 67108864 ? f && de(
            o,
            sh,
            i,
            o
          ) : $n(
            i,
            o,
            f
          ) : o.memoizedState === null && (f && o.flags & 8192 ? de(
            o,
            sh,
            i,
            o
          ) : o.subtreeFlags & 67108864 && de(
            o,
            $n,
            i,
            o,
            f
          )), t = t.sibling;
        }
    }
    function sh(e, t) {
      ge(!0);
      try {
        lh(t), jy(t), Uy(e, t.alternate, t, !1), nr(e, t, 0, null, !1, 0);
      } finally {
        ge(!1);
      }
    }
    function rh(e) {
      var t = !0;
      e.current.mode & (wa | Ti) || (t = !1), $n(
        e,
        e.current,
        t
      );
    }
    function zn(e) {
      if ((pt & ea) === sa) {
        var t = e.tag;
        if (t === 3 || t === 1 || t === 0 || t === 11 || t === 14 || t === 15) {
          if (t = pe(e) || "ReactComponent", Dv !== null) {
            if (Dv.has(t)) return;
            Dv.add(t);
          } else Dv = /* @__PURE__ */ new Set([t]);
          de(e, function() {
            console.error(
              "Can't perform a React state update on a component that hasn't mounted yet. This indicates that you have a side-effect in your render function that asynchronously tries to update the component. Move this work to useEffect instead."
            );
          });
        }
      }
    }
    function vf(e, t) {
      qu && e.memoizedUpdaters.forEach(function(a) {
        zl(e, a, t);
      });
    }
    function bf(e, t) {
      var a = L.actQueue;
      return a !== null ? (a.push(t), cT) : bp(e, t);
    }
    function or(e) {
      By() && L.actQueue === null && de(e, function() {
        console.error(
          `An update to %s inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act`,
          pe(e)
        );
      });
    }
    function xa(e) {
      e !== pm && e.next === null && (pm === null ? _v = pm = e : pm = pm.next = e), Rv = !0, L.actQueue !== null ? ib || (ib = !0, cg()) : ub || (ub = !0, cg());
    }
    function Uu(e, t) {
      if (!cb && Rv) {
        cb = !0;
        do
          for (var a = !1, i = _v; i !== null; ) {
            if (e !== 0) {
              var o = i.pendingLanes;
              if (o === 0) var f = 0;
              else {
                var d = i.suspendedLanes, h = i.pingedLanes;
                f = (1 << 31 - Fl(42 | e) + 1) - 1, f &= o & ~(d & ~h), f = f & 201326741 ? f & 201326741 | 1 : f ? f | 2 : 0;
              }
              f !== 0 && (a = !0, fr(i, f));
            } else
              f = at, f = Sc(
                i,
                i === Zt ? f : 0,
                i.cancelPendingCommit !== null || i.timeoutHandle !== Wr
              ), (f & 3) === 0 || Sl(i, f) || (a = !0, fr(i, f));
            i = i.next;
          }
        while (a);
        cb = !1;
      }
    }
    function ig() {
      r0 = window.event, dh();
    }
    function dh() {
      Rv = ib = ub = !1;
      var e = 0;
      is !== 0 && ky() && (e = is);
      for (var t = Ll(), a = null, i = _v; i !== null; ) {
        var o = i.next, f = Sf(i, t);
        f === 0 ? (i.next = null, a === null ? _v = o : a.next = o, o === null && (pm = a)) : (a = i, (e !== 0 || (f & 3) !== 0) && (Rv = !0)), i = o;
      }
      $l !== ns && $l !== Ov || Uu(e), is !== 0 && (is = 0);
    }
    function Sf(e, t) {
      for (var a = e.suspendedLanes, i = e.pingedLanes, o = e.expirationTimes, f = e.pendingLanes & -62914561; 0 < f; ) {
        var d = 31 - Fl(f), h = 1 << d, y = o[d];
        y === -1 ? ((h & a) === 0 || (h & i) !== 0) && (o[d] = Pr(h, t)) : y <= t && (e.expiredLanes |= h), f &= ~h;
      }
      if (t = Zt, a = at, a = Sc(
        e,
        e === t ? a : 0,
        e.cancelPendingCommit !== null || e.timeoutHandle !== Wr
      ), i = e.callbackNode, a === 0 || e === t && (wt === Qr || wt === Vr) || e.cancelPendingCommit !== null)
        return i !== null && hh(i), e.callbackNode = null, e.callbackPriority = 0;
      if ((a & 3) === 0 || Sl(e, a)) {
        if (t = a & -a, t !== e.callbackPriority || L.actQueue !== null && i !== ob)
          hh(i);
        else return t;
        switch (Nl(a)) {
          case Cl:
          case Il:
            a = Yh;
            break;
          case ca:
            a = ro;
            break;
          case hc:
            a = qh;
            break;
          default:
            a = ro;
        }
        return i = Jy.bind(null, e), L.actQueue !== null ? (L.actQueue.push(i), a = ob) : a = bp(a, i), e.callbackPriority = t, e.callbackNode = a, t;
      }
      return i !== null && hh(i), e.callbackPriority = 2, e.callbackNode = null, 2;
    }
    function Jy(e, t) {
      if (iv = uv = !1, r0 = window.event, $l !== ns && $l !== Ov)
        return e.callbackNode = null, e.callbackPriority = 0, null;
      var a = e.callbackNode;
      if (_i === Av && (_i = P1), ir() && e.callbackNode !== a)
        return null;
      var i = at;
      return i = Sc(
        e,
        e === Zt ? i : 0,
        e.cancelPendingCommit !== null || e.timeoutHandle !== Wr
      ), i === 0 ? null : (lg(
        e,
        i,
        t
      ), Sf(e, Ll()), e.callbackNode != null && e.callbackNode === a ? Jy.bind(null, e) : null);
    }
    function fr(e, t) {
      if (ir()) return null;
      uv = iv, iv = !1, lg(e, t, !0);
    }
    function hh(e) {
      e !== ob && e !== null && jh(e);
    }
    function cg() {
      L.actQueue !== null && L.actQueue.push(function() {
        return dh(), null;
      }), gT(function() {
        (pt & (ea | uu)) !== sa ? bp(
          Sp,
          ig
        ) : dh();
      });
    }
    function Ky() {
      if (is === 0) {
        var e = wr;
        e === 0 && (e = Yf, Yf <<= 1, (Yf & 261888) === 0 && (Yf = 256)), is = e;
      }
      return is;
    }
    function bt(e) {
      return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : (vt(e, "action"), vs("" + e));
    }
    function Nt(e, t) {
      var a = t.ownerDocument.createElement("input");
      return a.name = t.name, a.value = t.value, e.id && a.setAttribute("form", e.id), t.parentNode.insertBefore(a, t), e = new FormData(e), a.parentNode.removeChild(a), e;
    }
    function ft(e, t, a, i, o) {
      if (t === "submit" && a && a.stateNode === o) {
        var f = bt(
          (o[Da] || null).action
        ), d = i.submitter;
        d && (t = (t = d[Da] || null) ? bt(t.formAction) : d.getAttribute("formAction"), t !== null && (f = t, d = null));
        var h = new Kg(
          "action",
          "action",
          null,
          i,
          o
        );
        e.push({
          event: h,
          listeners: [
            {
              instance: null,
              listener: function() {
                if (i.defaultPrevented) {
                  if (is !== 0) {
                    var y = d ? Nt(
                      o,
                      d
                    ) : new FormData(o), p = {
                      pending: !0,
                      data: y,
                      method: o.method,
                      action: f
                    };
                    Object.freeze(p), ri(
                      a,
                      p,
                      null,
                      y
                    );
                  }
                } else
                  typeof f == "function" && (h.preventDefault(), y = d ? Nt(
                    o,
                    d
                  ) : new FormData(o), p = {
                    pending: !0,
                    data: y,
                    method: o.method,
                    action: f
                  }, Object.freeze(p), ri(
                    a,
                    p,
                    f,
                    y
                  ));
              },
              currentTarget: o
            }
          ]
        });
      }
    }
    function ut(e, t, a) {
      e.currentTarget = a;
      try {
        t(e);
      } catch (i) {
        S1(i);
      }
      e.currentTarget = null;
    }
    function _t(e, t) {
      t = (t & 4) !== 0;
      for (var a = 0; a < e.length; a++) {
        var i = e[a];
        e: {
          var o = void 0, f = i.event;
          if (i = i.listeners, t)
            for (var d = i.length - 1; 0 <= d; d--) {
              var h = i[d], y = h.instance, p = h.currentTarget;
              if (h = h.listener, y !== o && f.isPropagationStopped())
                break e;
              y !== null ? de(
                y,
                ut,
                f,
                h,
                p
              ) : ut(f, h, p), o = y;
            }
          else
            for (d = 0; d < i.length; d++) {
              if (h = i[d], y = h.instance, p = h.currentTarget, h = h.listener, y !== o && f.isPropagationStopped())
                break e;
              y !== null ? de(
                y,
                ut,
                f,
                h,
                p
              ) : ut(f, h, p), o = y;
            }
        }
      }
    }
    function Ye(e, t) {
      fb.has(e) || console.error(
        'Did not expect a listenToNonDelegatedEvent() call for "%s". This is a bug in React. Please file an issue.',
        e
      );
      var a = t[mo];
      a === void 0 && (a = t[mo] = /* @__PURE__ */ new Set());
      var i = e + "__bubble";
      a.has(i) || (mh(t, e, 2, !1), a.add(i));
    }
    function Nu(e, t, a) {
      fb.has(e) && !t && console.error(
        'Did not expect a listenToNativeEvent() call for "%s" in the bubble phase. This is a bug in React. Please file an issue.',
        e
      );
      var i = 0;
      t && (i |= 4), mh(
        a,
        e,
        i,
        t
      );
    }
    function ic(e) {
      if (!e[Mv]) {
        e[Mv] = !0, Xg.forEach(function(a) {
          a !== "selectionchange" && (fb.has(a) || Nu(a, !1, e), Nu(a, !0, e));
        });
        var t = e.nodeType === 9 ? e : e.ownerDocument;
        t === null || t[Mv] || (t[Mv] = !0, Nu("selectionchange", !1, t));
      }
    }
    function mh(e, t, a, i) {
      switch (Rh(t)) {
        case Cl:
          var o = op;
          break;
        case Il:
          o = Wl;
          break;
        default:
          o = fp;
      }
      a = o.bind(
        null,
        t,
        a,
        e
      ), o = void 0, !s1 || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (o = !0), i ? o !== void 0 ? e.addEventListener(t, a, {
        capture: !0,
        passive: o
      }) : e.addEventListener(t, a, !0) : o !== void 0 ? e.addEventListener(t, a, {
        passive: o
      }) : e.addEventListener(
        t,
        a,
        !1
      );
    }
    function kn(e, t, a, i, o) {
      var f = i;
      if ((t & 1) === 0 && (t & 2) === 0 && i !== null)
        e: for (; ; ) {
          if (i === null) return;
          var d = i.tag;
          if (d === 3 || d === 4) {
            var h = i.stateNode.containerInfo;
            if (h === o) break;
            if (d === 4)
              for (d = i.return; d !== null; ) {
                var y = d.tag;
                if ((y === 3 || y === 4) && d.stateNode.containerInfo === o)
                  return;
                d = d.return;
              }
            for (; h !== null; ) {
              if (d = ae(h), d === null) return;
              if (y = d.tag, y === 5 || y === 6 || y === 26 || y === 27) {
                i = f = d;
                continue e;
              }
              h = h.parentNode;
            }
          }
          i = i.return;
        }
      rd(function() {
        var p = f, z = Nn(a), R = [];
        e: {
          var E = Bb.get(e);
          if (E !== void 0) {
            var q = Kg, se = e;
            switch (e) {
              case "keypress":
                if (bs(a) === 0) break e;
              case "keydown":
              case "keyup":
                q = TE;
                break;
              case "focusin":
                se = "focus", q = m1;
                break;
              case "focusout":
                se = "blur", q = m1;
                break;
              case "beforeblur":
              case "afterblur":
                q = m1;
                break;
              case "click":
                if (a.button === 2) break e;
              case "auxclick":
              case "dblclick":
              case "mousedown":
              case "mousemove":
              case "mouseup":
              case "mouseout":
              case "mouseover":
              case "contextmenu":
                q = Ab;
                break;
              case "drag":
              case "dragend":
              case "dragenter":
              case "dragexit":
              case "dragleave":
              case "dragover":
              case "dragstart":
              case "drop":
                q = sE;
                break;
              case "touchcancel":
              case "touchend":
              case "touchmove":
              case "touchstart":
                q = zE;
                break;
              case Nb:
              case Hb:
              case jb:
                q = hE;
                break;
              case wb:
                q = _E;
                break;
              case "scroll":
              case "scrollend":
                q = oE;
                break;
              case "wheel":
                q = ME;
                break;
              case "copy":
              case "cut":
              case "paste":
                q = yE;
                break;
              case "gotpointercapture":
              case "lostpointercapture":
              case "pointercancel":
              case "pointerdown":
              case "pointermove":
              case "pointerout":
              case "pointerover":
              case "pointerup":
                q = zb;
                break;
              case "toggle":
              case "beforetoggle":
                q = xE;
            }
            var he = (t & 4) !== 0, Wt = !he && (e === "scroll" || e === "scrollend"), dt = he ? E !== null ? E + "Capture" : null : E;
            he = [];
            for (var S = p, T; S !== null; ) {
              var O = S;
              if (T = O.stateNode, O = O.tag, O !== 5 && O !== 26 && O !== 27 || T === null || dt === null || (O = hu(S, dt), O != null && he.push(
                Qt(
                  S,
                  O,
                  T
                )
              )), Wt) break;
              S = S.return;
            }
            0 < he.length && (E = new q(
              E,
              se,
              null,
              a,
              z
            ), R.push({
              event: E,
              listeners: he
            }));
          }
        }
        if ((t & 7) === 0) {
          e: {
            if (E = e === "mouseover" || e === "pointerover", q = e === "mouseout" || e === "pointerout", E && a !== zp && (se = a.relatedTarget || a.fromElement) && (ae(se) || se[Ei]))
              break e;
            if ((q || E) && (E = z.window === z ? z : (E = z.ownerDocument) ? E.defaultView || E.parentWindow : window, q ? (se = a.relatedTarget || a.toElement, q = p, se = se ? ae(se) : null, se !== null && (Wt = Ue(se), he = se.tag, se !== Wt || he !== 5 && he !== 27 && he !== 6) && (se = null)) : (q = null, se = p), q !== se)) {
              if (he = Ab, O = "onMouseLeave", dt = "onMouseEnter", S = "mouse", (e === "pointerout" || e === "pointerover") && (he = zb, O = "onPointerLeave", dt = "onPointerEnter", S = "pointer"), Wt = q == null ? E : ve(q), T = se == null ? E : ve(se), E = new he(
                O,
                S + "leave",
                q,
                a,
                z
              ), E.target = Wt, E.relatedTarget = T, O = null, ae(z) === p && (he = new he(
                dt,
                S + "enter",
                se,
                a,
                z
              ), he.target = T, he.relatedTarget = Wt, O = he), Wt = O, q && se)
                t: {
                  for (he = ao, dt = q, S = se, T = 0, O = dt; O; O = he(O))
                    T++;
                  O = 0;
                  for (var J = S; J; J = he(J))
                    O++;
                  for (; 0 < T - O; )
                    dt = he(dt), T--;
                  for (; 0 < O - T; )
                    S = he(S), O--;
                  for (; T--; ) {
                    if (dt === S || S !== null && dt === S.alternate) {
                      he = dt;
                      break t;
                    }
                    dt = he(dt), S = he(S);
                  }
                  he = null;
                }
              else he = null;
              q !== null && yh(
                R,
                E,
                q,
                he,
                !1
              ), se !== null && Wt !== null && yh(
                R,
                Wt,
                se,
                he,
                !0
              );
            }
          }
          e: {
            if (E = p ? ve(p) : window, q = E.nodeName && E.nodeName.toLowerCase(), q === "select" || q === "input" && E.type === "file")
              var re = wi;
            else if (Um(E))
              if (xb)
                re = As;
              else {
                re = Nm;
                var Qe = Wv;
              }
            else
              q = E.nodeName, !q || q.toLowerCase() !== "input" || E.type !== "checkbox" && E.type !== "radio" ? p && du(p.elementType) && (re = wi) : re = Hm;
            if (re && (re = re(e, p))) {
              Es(
                R,
                re,
                a,
                z
              );
              break e;
            }
            Qe && Qe(e, E, p), e === "focusout" && p && E.type === "number" && p.memoizedProps.value != null && Am(E, "number", E.value);
          }
          switch (Qe = p ? ve(p) : window, e) {
            case "focusin":
              (Um(Qe) || Qe.contentEditable === "true") && (Kh = Qe, p1 = p, Up = null);
              break;
            case "focusout":
              Up = p1 = Kh = null;
              break;
            case "mousedown":
              g1 = !0;
              break;
            case "contextmenu":
            case "mouseup":
            case "dragend":
              g1 = !1, M0(
                R,
                a,
                z
              );
              break;
            case "selectionchange":
              if (jE) break;
            case "keydown":
            case "keyup":
              M0(
                R,
                a,
                z
              );
          }
          var Re;
          if (y1)
            e: {
              switch (e) {
                case "compositionstart":
                  var ze = "onCompositionStart";
                  break e;
                case "compositionend":
                  ze = "onCompositionEnd";
                  break e;
                case "compositionupdate":
                  ze = "onCompositionUpdate";
                  break e;
              }
              ze = void 0;
            }
          else
            Jh ? Lo(e, a) && (ze = "onCompositionEnd") : e === "keydown" && a.keyCode === Db && (ze = "onCompositionStart");
          ze && (_b && a.locale !== "ko" && (Jh || ze !== "onCompositionStart" ? ze === "onCompositionEnd" && Jh && (Re = _c()) : (Qf = z, r1 = "value" in Qf ? Qf.value : Qf.textContent, Jh = !0)), Qe = Wn(
            p,
            ze
          ), 0 < Qe.length && (ze = new Ob(
            ze,
            e,
            null,
            a,
            z
          ), R.push({
            event: ze,
            listeners: Qe
          }), Re ? ze.data = Re : (Re = ti(a), Re !== null && (ze.data = Re)))), (Re = NE ? xm(e, a) : dd(e, a)) && (ze = Wn(
            p,
            "onBeforeInput"
          ), 0 < ze.length && (Qe = new gE(
            "onBeforeInput",
            "beforeinput",
            null,
            a,
            z
          ), R.push({
            event: Qe,
            listeners: ze
          }), Qe.data = Re)), ft(
            R,
            e,
            p,
            a,
            z
          );
        }
        _t(R, t);
      });
    }
    function Qt(e, t, a) {
      return {
        instance: e,
        listener: t,
        currentTarget: a
      };
    }
    function Wn(e, t) {
      for (var a = t + "Capture", i = []; e !== null; ) {
        var o = e, f = o.stateNode;
        if (o = o.tag, o !== 5 && o !== 26 && o !== 27 || f === null || (o = hu(e, a), o != null && i.unshift(
          Qt(e, o, f)
        ), o = hu(e, t), o != null && i.push(
          Qt(e, o, f)
        )), e.tag === 3) return i;
        e = e.return;
      }
      return [];
    }
    function ao(e) {
      if (e === null) return null;
      do
        e = e.return;
      while (e && e.tag !== 5 && e.tag !== 27);
      return e || null;
    }
    function yh(e, t, a, i, o) {
      for (var f = t._reactName, d = []; a !== null && a !== i; ) {
        var h = a, y = h.alternate, p = h.stateNode;
        if (h = h.tag, y !== null && y === i) break;
        h !== 5 && h !== 26 && h !== 27 || p === null || (y = p, o ? (p = hu(a, f), p != null && d.unshift(
          Qt(a, p, y)
        )) : o || (p = hu(a, f), p != null && d.push(
          Qt(a, p, y)
        ))), a = a.return;
      }
      d.length !== 0 && e.push({ event: t, listeners: d });
    }
    function Aa(e, t) {
      O0(e, t), e !== "input" && e !== "textarea" && e !== "select" || t == null || t.value !== null || Eb || (Eb = !0, e === "select" && t.multiple ? console.error(
        "`value` prop on `%s` should not be null. Consider using an empty array when `multiple` is set to `true` to clear the component or `undefined` for uncontrolled components.",
        e
      ) : console.error(
        "`value` prop on `%s` should not be null. Consider using an empty string to clear the component or `undefined` for uncontrolled components.",
        e
      ));
      var a = {
        registrationNameDependencies: Gu,
        possibleRegistrationNames: Lf
      };
      du(e) || typeof t.is == "string" || kv(e, t, a), t.contentEditable && !t.suppressContentEditableWarning && t.children != null && console.error(
        "A component is `contentEditable` and contains `children` managed by React. It is now your responsibility to guarantee that none of those nodes are unexpectedly modified or duplicated. This is probably not intentional."
      );
    }
    function il(e, t, a, i) {
      t !== a && (a = Fn(a), Fn(t) !== a && (i[e] = t));
    }
    function sr(e, t, a) {
      t.forEach(function(i) {
        a[pi(i)] = i === "style" ? cc(e) : e.getAttribute(i);
      });
    }
    function cl(e, t) {
      t === !1 ? console.error(
        "Expected `%s` listener to be a function, instead got `false`.\n\nIf you used to conditionally omit it with %s={condition && value}, pass %s={condition ? value : undefined} instead.",
        e,
        e,
        e
      ) : console.error(
        "Expected `%s` listener to be a function, instead got a value of `%s` type.",
        e,
        typeof t
      );
    }
    function ph(e, t) {
      return e = e.namespaceURI === Ke || e.namespaceURI === Ie ? e.ownerDocument.createElementNS(
        e.namespaceURI,
        e.tagName
      ) : e.ownerDocument.createElement(e.tagName), e.innerHTML = t, e.innerHTML;
    }
    function Fn(e) {
      return Ga(e) && (console.error(
        "The provided HTML markup uses a value of unsupported type %s. This value must be coerced to a string before using it here.",
        Mi(e)
      ), cu(e)), (typeof e == "string" ? e : "" + e).replace(oT, `
`).replace(fT, "");
    }
    function $y(e, t) {
      return t = Fn(t), Fn(e) === t;
    }
    function Tt(e, t, a, i, o, f) {
      switch (a) {
        case "children":
          typeof i == "string" ? (gs(i, t, !1), t === "body" || t === "textarea" && i === "" || Dc(e, i)) : (typeof i == "number" || typeof i == "bigint") && (gs("" + i, t, !1), t !== "body" && Dc(e, "" + i));
          break;
        case "className":
          ms(e, "class", i);
          break;
        case "tabIndex":
          ms(e, "tabindex", i);
          break;
        case "dir":
        case "role":
        case "viewBox":
        case "width":
        case "height":
          ms(e, a, i);
          break;
        case "style":
          Rm(e, i, f);
          break;
        case "data":
          if (t !== "object") {
            ms(e, "data", i);
            break;
          }
        case "src":
        case "href":
          if (i === "" && (t !== "a" || a !== "href")) {
            console.error(
              a === "src" ? 'An empty string ("") was passed to the %s attribute. This may cause the browser to download the whole page again over the network. To fix this, either do not render the element at all or pass null to %s instead of an empty string.' : 'An empty string ("") was passed to the %s attribute. To fix this, either do not render the element at all or pass null to %s instead of an empty string.',
              a,
              a
            ), e.removeAttribute(a);
            break;
          }
          if (i == null || typeof i == "function" || typeof i == "symbol" || typeof i == "boolean") {
            e.removeAttribute(a);
            break;
          }
          vt(i, a), i = vs("" + i), e.setAttribute(a, i);
          break;
        case "action":
        case "formAction":
          if (i != null && (t === "form" ? a === "formAction" ? console.error(
            "You can only pass the formAction prop to <input> or <button>. Use the action prop on <form>."
          ) : typeof i == "function" && (o.encType == null && o.method == null || Uv || (Uv = !0, console.error(
            "Cannot specify a encType or method for a form that specifies a function as the action. React provides those automatically. They will get overridden."
          )), o.target == null || xv || (xv = !0, console.error(
            "Cannot specify a target for a form that specifies a function as the action. The function will always be executed in the same window."
          ))) : t === "input" || t === "button" ? a === "action" ? console.error(
            "You can only pass the action prop to <form>. Use the formAction prop on <input> or <button>."
          ) : t !== "input" || o.type === "submit" || o.type === "image" || Cv ? t !== "button" || o.type == null || o.type === "submit" || Cv ? typeof i == "function" && (o.name == null || i2 || (i2 = !0, console.error(
            'Cannot specify a "name" prop for a button that specifies a function as a formAction. React needs it to encode which action should be invoked. It will get overridden.'
          )), o.formEncType == null && o.formMethod == null || Uv || (Uv = !0, console.error(
            "Cannot specify a formEncType or formMethod for a button that specifies a function as a formAction. React provides those automatically. They will get overridden."
          )), o.formTarget == null || xv || (xv = !0, console.error(
            "Cannot specify a formTarget for a button that specifies a function as a formAction. The function will always be executed in the same window."
          ))) : (Cv = !0, console.error(
            'A button can only specify a formAction along with type="submit" or no type.'
          )) : (Cv = !0, console.error(
            'An input can only specify a formAction along with type="submit" or type="image".'
          )) : console.error(
            a === "action" ? "You can only pass the action prop to <form>." : "You can only pass the formAction prop to <input> or <button>."
          )), typeof i == "function") {
            e.setAttribute(
              a,
              "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
            );
            break;
          } else
            typeof f == "function" && (a === "formAction" ? (t !== "input" && Tt(e, t, "name", o.name, o, null), Tt(
              e,
              t,
              "formEncType",
              o.formEncType,
              o,
              null
            ), Tt(
              e,
              t,
              "formMethod",
              o.formMethod,
              o,
              null
            ), Tt(
              e,
              t,
              "formTarget",
              o.formTarget,
              o,
              null
            )) : (Tt(
              e,
              t,
              "encType",
              o.encType,
              o,
              null
            ), Tt(e, t, "method", o.method, o, null), Tt(
              e,
              t,
              "target",
              o.target,
              o,
              null
            )));
          if (i == null || typeof i == "symbol" || typeof i == "boolean") {
            e.removeAttribute(a);
            break;
          }
          vt(i, a), i = vs("" + i), e.setAttribute(a, i);
          break;
        case "onClick":
          i != null && (typeof i != "function" && cl(a, i), e.onclick = yn);
          break;
        case "onScroll":
          i != null && (typeof i != "function" && cl(a, i), Ye("scroll", e));
          break;
        case "onScrollEnd":
          i != null && (typeof i != "function" && cl(a, i), Ye("scrollend", e));
          break;
        case "dangerouslySetInnerHTML":
          if (i != null) {
            if (typeof i != "object" || !("__html" in i))
              throw Error(
                "`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. Please visit https://react.dev/link/dangerously-set-inner-html for more information."
              );
            if (a = i.__html, a != null) {
              if (o.children != null)
                throw Error(
                  "Can only set one of `children` or `props.dangerouslySetInnerHTML`."
                );
              e.innerHTML = a;
            }
          }
          break;
        case "multiple":
          e.multiple = i && typeof i != "function" && typeof i != "symbol";
          break;
        case "muted":
          e.muted = i && typeof i != "function" && typeof i != "symbol";
          break;
        case "suppressContentEditableWarning":
        case "suppressHydrationWarning":
        case "defaultValue":
        case "defaultChecked":
        case "innerHTML":
        case "ref":
          break;
        case "autoFocus":
          break;
        case "xlinkHref":
          if (i == null || typeof i == "function" || typeof i == "boolean" || typeof i == "symbol") {
            e.removeAttribute("xlink:href");
            break;
          }
          vt(i, a), a = vs("" + i), e.setAttributeNS(Kr, "xlink:href", a);
          break;
        case "contentEditable":
        case "spellCheck":
        case "draggable":
        case "value":
        case "autoReverse":
        case "externalResourcesRequired":
        case "focusable":
        case "preserveAlpha":
          i != null && typeof i != "function" && typeof i != "symbol" ? (vt(i, a), e.setAttribute(a, "" + i)) : e.removeAttribute(a);
          break;
        case "inert":
          i !== "" || Nv[a] || (Nv[a] = !0, console.error(
            "Received an empty string for a boolean attribute `%s`. This will treat the attribute as if it were false. Either pass `false` to silence this warning, or pass `true` if you used an empty string in earlier versions of React to indicate this attribute is true.",
            a
          ));
        case "allowFullScreen":
        case "async":
        case "autoPlay":
        case "controls":
        case "default":
        case "defer":
        case "disabled":
        case "disablePictureInPicture":
        case "disableRemotePlayback":
        case "formNoValidate":
        case "hidden":
        case "loop":
        case "noModule":
        case "noValidate":
        case "open":
        case "playsInline":
        case "readOnly":
        case "required":
        case "reversed":
        case "scoped":
        case "seamless":
        case "itemScope":
          i && typeof i != "function" && typeof i != "symbol" ? e.setAttribute(a, "") : e.removeAttribute(a);
          break;
        case "capture":
        case "download":
          i === !0 ? e.setAttribute(a, "") : i !== !1 && i != null && typeof i != "function" && typeof i != "symbol" ? (vt(i, a), e.setAttribute(a, i)) : e.removeAttribute(a);
          break;
        case "cols":
        case "rows":
        case "size":
        case "span":
          i != null && typeof i != "function" && typeof i != "symbol" && !isNaN(i) && 1 <= i ? (vt(i, a), e.setAttribute(a, i)) : e.removeAttribute(a);
          break;
        case "rowSpan":
        case "start":
          i == null || typeof i == "function" || typeof i == "symbol" || isNaN(i) ? e.removeAttribute(a) : (vt(i, a), e.setAttribute(a, i));
          break;
        case "popover":
          Ye("beforetoggle", e), Ye("toggle", e), Ho(e, "popover", i);
          break;
        case "xlinkActuate":
          fu(
            e,
            Kr,
            "xlink:actuate",
            i
          );
          break;
        case "xlinkArcrole":
          fu(
            e,
            Kr,
            "xlink:arcrole",
            i
          );
          break;
        case "xlinkRole":
          fu(
            e,
            Kr,
            "xlink:role",
            i
          );
          break;
        case "xlinkShow":
          fu(
            e,
            Kr,
            "xlink:show",
            i
          );
          break;
        case "xlinkTitle":
          fu(
            e,
            Kr,
            "xlink:title",
            i
          );
          break;
        case "xlinkType":
          fu(
            e,
            Kr,
            "xlink:type",
            i
          );
          break;
        case "xmlBase":
          fu(
            e,
            sb,
            "xml:base",
            i
          );
          break;
        case "xmlLang":
          fu(
            e,
            sb,
            "xml:lang",
            i
          );
          break;
        case "xmlSpace":
          fu(
            e,
            sb,
            "xml:space",
            i
          );
          break;
        case "is":
          f != null && console.error(
            'Cannot update the "is" prop after it has been initialized.'
          ), Ho(e, "is", i);
          break;
        case "innerText":
        case "textContent":
          break;
        case "popoverTarget":
          c2 || i == null || typeof i != "object" || (c2 = !0, console.error(
            "The `popoverTarget` prop expects the ID of an Element as a string. Received %s instead.",
            i
          ));
        default:
          !(2 < a.length) || a[0] !== "o" && a[0] !== "O" || a[1] !== "n" && a[1] !== "N" ? (a = T0(a), Ho(e, a, i)) : Gu.hasOwnProperty(a) && i != null && typeof i != "function" && cl(a, i);
      }
    }
    function Ef(e, t, a, i, o, f) {
      switch (a) {
        case "style":
          Rm(e, i, f);
          break;
        case "dangerouslySetInnerHTML":
          if (i != null) {
            if (typeof i != "object" || !("__html" in i))
              throw Error(
                "`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. Please visit https://react.dev/link/dangerously-set-inner-html for more information."
              );
            if (a = i.__html, a != null) {
              if (o.children != null)
                throw Error(
                  "Can only set one of `children` or `props.dangerouslySetInnerHTML`."
                );
              e.innerHTML = a;
            }
          }
          break;
        case "children":
          typeof i == "string" ? Dc(e, i) : (typeof i == "number" || typeof i == "bigint") && Dc(e, "" + i);
          break;
        case "onScroll":
          i != null && (typeof i != "function" && cl(a, i), Ye("scroll", e));
          break;
        case "onScrollEnd":
          i != null && (typeof i != "function" && cl(a, i), Ye("scrollend", e));
          break;
        case "onClick":
          i != null && (typeof i != "function" && cl(a, i), e.onclick = yn);
          break;
        case "suppressContentEditableWarning":
        case "suppressHydrationWarning":
        case "innerHTML":
        case "ref":
          break;
        case "innerText":
        case "textContent":
          break;
        default:
          if (Gu.hasOwnProperty(a))
            i != null && typeof i != "function" && cl(a, i);
          else
            e: {
              if (a[0] === "o" && a[1] === "n" && (o = a.endsWith("Capture"), t = a.slice(2, o ? a.length - 7 : void 0), f = e[Da] || null, f = f != null ? f[a] : null, typeof f == "function" && e.removeEventListener(t, f, o), typeof i == "function")) {
                typeof f != "function" && f !== null && (a in e ? e[a] = null : e.hasAttribute(a) && e.removeAttribute(a)), e.addEventListener(t, i, o);
                break e;
              }
              a in e ? e[a] = i : i === !0 ? e.setAttribute(a, "") : Ho(e, a, i);
            }
      }
    }
    function Pt(e, t, a) {
      switch (Aa(t, a), t) {
        case "div":
        case "span":
        case "svg":
        case "path":
        case "a":
        case "g":
        case "p":
        case "li":
          break;
        case "img":
          Ye("error", e), Ye("load", e);
          var i = !1, o = !1, f;
          for (f in a)
            if (a.hasOwnProperty(f)) {
              var d = a[f];
              if (d != null)
                switch (f) {
                  case "src":
                    i = !0;
                    break;
                  case "srcSet":
                    o = !0;
                    break;
                  case "children":
                  case "dangerouslySetInnerHTML":
                    throw Error(
                      t + " is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`."
                    );
                  default:
                    Tt(e, t, f, d, a, null);
                }
            }
          o && Tt(e, t, "srcSet", a.srcSet, a, null), i && Tt(e, t, "src", a.src, a, null);
          return;
        case "input":
          la("input", a), Ye("invalid", e);
          var h = f = d = o = null, y = null, p = null;
          for (i in a)
            if (a.hasOwnProperty(i)) {
              var z = a[i];
              if (z != null)
                switch (i) {
                  case "name":
                    o = z;
                    break;
                  case "type":
                    d = z;
                    break;
                  case "checked":
                    y = z;
                    break;
                  case "defaultChecked":
                    p = z;
                    break;
                  case "value":
                    f = z;
                    break;
                  case "defaultValue":
                    h = z;
                    break;
                  case "children":
                  case "dangerouslySetInnerHTML":
                    if (z != null)
                      throw Error(
                        t + " is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`."
                      );
                    break;
                  default:
                    Tt(e, t, i, z, a, null);
                }
            }
          ra(e, a), ad(
            e,
            f,
            h,
            y,
            p,
            d,
            o,
            !1
          );
          return;
        case "select":
          la("select", a), Ye("invalid", e), i = d = f = null;
          for (o in a)
            if (a.hasOwnProperty(o) && (h = a[o], h != null))
              switch (o) {
                case "value":
                  f = h;
                  break;
                case "defaultValue":
                  d = h;
                  break;
                case "multiple":
                  i = h;
                default:
                  Tt(
                    e,
                    t,
                    o,
                    h,
                    a,
                    null
                  );
              }
          nd(e, a), t = f, a = d, e.multiple = !!i, t != null ? su(e, !!i, t, !1) : a != null && su(e, !!i, a, !0);
          return;
        case "textarea":
          la("textarea", a), Ye("invalid", e), f = o = i = null;
          for (d in a)
            if (a.hasOwnProperty(d) && (h = a[d], h != null))
              switch (d) {
                case "value":
                  i = h;
                  break;
                case "defaultValue":
                  o = h;
                  break;
                case "children":
                  f = h;
                  break;
                case "dangerouslySetInnerHTML":
                  if (h != null)
                    throw Error(
                      "`dangerouslySetInnerHTML` does not make sense on <textarea>."
                    );
                  break;
                default:
                  Tt(
                    e,
                    t,
                    d,
                    h,
                    a,
                    null
                  );
              }
          Tc(e, a), jo(e, i, o, f);
          return;
        case "option":
          E0(e, a);
          for (y in a)
            if (a.hasOwnProperty(y) && (i = a[y], i != null))
              switch (y) {
                case "selected":
                  e.selected = i && typeof i != "function" && typeof i != "symbol";
                  break;
                default:
                  Tt(e, t, y, i, a, null);
              }
          return;
        case "dialog":
          Ye("beforetoggle", e), Ye("toggle", e), Ye("cancel", e), Ye("close", e);
          break;
        case "iframe":
        case "object":
          Ye("load", e);
          break;
        case "video":
        case "audio":
          for (i = 0; i < o0.length; i++)
            Ye(o0[i], e);
          break;
        case "image":
          Ye("error", e), Ye("load", e);
          break;
        case "details":
          Ye("toggle", e);
          break;
        case "embed":
        case "source":
        case "link":
          Ye("error", e), Ye("load", e);
        case "area":
        case "base":
        case "br":
        case "col":
        case "hr":
        case "keygen":
        case "meta":
        case "param":
        case "track":
        case "wbr":
        case "menuitem":
          for (p in a)
            if (a.hasOwnProperty(p) && (i = a[p], i != null))
              switch (p) {
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(
                    t + " is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`."
                  );
                default:
                  Tt(e, t, p, i, a, null);
              }
          return;
        default:
          if (du(t)) {
            for (z in a)
              a.hasOwnProperty(z) && (i = a[z], i !== void 0 && Ef(
                e,
                t,
                z,
                i,
                a,
                void 0
              ));
            return;
          }
      }
      for (h in a)
        a.hasOwnProperty(h) && (i = a[h], i != null && Tt(e, t, h, i, a, null));
    }
    function Rl(e, t, a, i) {
      switch (Aa(t, i), t) {
        case "div":
        case "span":
        case "svg":
        case "path":
        case "a":
        case "g":
        case "p":
        case "li":
          break;
        case "input":
          var o = null, f = null, d = null, h = null, y = null, p = null, z = null;
          for (q in a) {
            var R = a[q];
            if (a.hasOwnProperty(q) && R != null)
              switch (q) {
                case "checked":
                  break;
                case "value":
                  break;
                case "defaultValue":
                  y = R;
                default:
                  i.hasOwnProperty(q) || Tt(
                    e,
                    t,
                    q,
                    null,
                    i,
                    R
                  );
              }
          }
          for (var E in i) {
            var q = i[E];
            if (R = a[E], i.hasOwnProperty(E) && (q != null || R != null))
              switch (E) {
                case "type":
                  f = q;
                  break;
                case "name":
                  o = q;
                  break;
                case "checked":
                  p = q;
                  break;
                case "defaultChecked":
                  z = q;
                  break;
                case "value":
                  d = q;
                  break;
                case "defaultValue":
                  h = q;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (q != null)
                    throw Error(
                      t + " is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`."
                    );
                  break;
                default:
                  q !== R && Tt(
                    e,
                    t,
                    E,
                    q,
                    i,
                    R
                  );
              }
          }
          t = a.type === "checkbox" || a.type === "radio" ? a.checked != null : a.value != null, i = i.type === "checkbox" || i.type === "radio" ? i.checked != null : i.value != null, t || !i || u2 || (console.error(
            "A component is changing an uncontrolled input to be controlled. This is likely caused by the value changing from undefined to a defined value, which should not happen. Decide between using a controlled or uncontrolled input element for the lifetime of the component. More info: https://react.dev/link/controlled-components"
          ), u2 = !0), !t || i || n2 || (console.error(
            "A component is changing a controlled input to be uncontrolled. This is likely caused by the value changing from a defined to undefined, which should not happen. Decide between using a controlled or uncontrolled input element for the lifetime of the component. More info: https://react.dev/link/controlled-components"
          ), n2 = !0), Ni(
            e,
            d,
            h,
            y,
            p,
            z,
            f,
            o
          );
          return;
        case "select":
          q = d = h = E = null;
          for (f in a)
            if (y = a[f], a.hasOwnProperty(f) && y != null)
              switch (f) {
                case "value":
                  break;
                case "multiple":
                  q = y;
                default:
                  i.hasOwnProperty(f) || Tt(
                    e,
                    t,
                    f,
                    null,
                    i,
                    y
                  );
              }
          for (o in i)
            if (f = i[o], y = a[o], i.hasOwnProperty(o) && (f != null || y != null))
              switch (o) {
                case "value":
                  E = f;
                  break;
                case "defaultValue":
                  h = f;
                  break;
                case "multiple":
                  d = f;
                default:
                  f !== y && Tt(
                    e,
                    t,
                    o,
                    f,
                    i,
                    y
                  );
              }
          i = h, t = d, a = q, E != null ? su(e, !!t, E, !1) : !!a != !!t && (i != null ? su(e, !!t, i, !0) : su(e, !!t, t ? [] : "", !1));
          return;
        case "textarea":
          q = E = null;
          for (h in a)
            if (o = a[h], a.hasOwnProperty(h) && o != null && !i.hasOwnProperty(h))
              switch (h) {
                case "value":
                  break;
                case "children":
                  break;
                default:
                  Tt(e, t, h, null, i, o);
              }
          for (d in i)
            if (o = i[d], f = a[d], i.hasOwnProperty(d) && (o != null || f != null))
              switch (d) {
                case "value":
                  E = o;
                  break;
                case "defaultValue":
                  q = o;
                  break;
                case "children":
                  break;
                case "dangerouslySetInnerHTML":
                  if (o != null)
                    throw Error(
                      "`dangerouslySetInnerHTML` does not make sense on <textarea>."
                    );
                  break;
                default:
                  o !== f && Tt(e, t, d, o, i, f);
              }
          Ac(e, E, q);
          return;
        case "option":
          for (var se in a)
            if (E = a[se], a.hasOwnProperty(se) && E != null && !i.hasOwnProperty(se))
              switch (se) {
                case "selected":
                  e.selected = !1;
                  break;
                default:
                  Tt(
                    e,
                    t,
                    se,
                    null,
                    i,
                    E
                  );
              }
          for (y in i)
            if (E = i[y], q = a[y], i.hasOwnProperty(y) && E !== q && (E != null || q != null))
              switch (y) {
                case "selected":
                  e.selected = E && typeof E != "function" && typeof E != "symbol";
                  break;
                default:
                  Tt(
                    e,
                    t,
                    y,
                    E,
                    i,
                    q
                  );
              }
          return;
        case "img":
        case "link":
        case "area":
        case "base":
        case "br":
        case "col":
        case "embed":
        case "hr":
        case "keygen":
        case "meta":
        case "param":
        case "source":
        case "track":
        case "wbr":
        case "menuitem":
          for (var he in a)
            E = a[he], a.hasOwnProperty(he) && E != null && !i.hasOwnProperty(he) && Tt(
              e,
              t,
              he,
              null,
              i,
              E
            );
          for (p in i)
            if (E = i[p], q = a[p], i.hasOwnProperty(p) && E !== q && (E != null || q != null))
              switch (p) {
                case "children":
                case "dangerouslySetInnerHTML":
                  if (E != null)
                    throw Error(
                      t + " is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`."
                    );
                  break;
                default:
                  Tt(
                    e,
                    t,
                    p,
                    E,
                    i,
                    q
                  );
              }
          return;
        default:
          if (du(t)) {
            for (var Wt in a)
              E = a[Wt], a.hasOwnProperty(Wt) && E !== void 0 && !i.hasOwnProperty(Wt) && Ef(
                e,
                t,
                Wt,
                void 0,
                i,
                E
              );
            for (z in i)
              E = i[z], q = a[z], !i.hasOwnProperty(z) || E === q || E === void 0 && q === void 0 || Ef(
                e,
                t,
                z,
                E,
                i,
                q
              );
            return;
          }
      }
      for (var dt in a)
        E = a[dt], a.hasOwnProperty(dt) && E != null && !i.hasOwnProperty(dt) && Tt(e, t, dt, null, i, E);
      for (R in i)
        E = i[R], q = a[R], !i.hasOwnProperty(R) || E === q || E == null && q == null || Tt(e, t, R, E, i, q);
    }
    function pi(e) {
      switch (e) {
        case "class":
          return "className";
        case "for":
          return "htmlFor";
        default:
          return e;
      }
    }
    function cc(e) {
      var t = {};
      e = e.style;
      for (var a = 0; a < e.length; a++) {
        var i = e[a];
        t[i] = e.getPropertyValue(i);
      }
      return t;
    }
    function Hu(e, t, a) {
      if (t != null && typeof t != "object")
        console.error(
          "The `style` prop expects a mapping from style properties to values, not a string. For example, style={{marginRight: spacing + 'em'}} when using JSX."
        );
      else {
        var i, o = i = "", f;
        for (f in t)
          if (t.hasOwnProperty(f)) {
            var d = t[f];
            d != null && typeof d != "boolean" && d !== "" && (f.indexOf("--") === 0 ? (ta(d, f), i += o + f + ":" + ("" + d).trim()) : typeof d != "number" || d === 0 || Ee.has(f) ? (ta(d, f), i += o + f.replace(X, "-$1").toLowerCase().replace(ye, "-ms-") + ":" + ("" + d).trim()) : i += o + f.replace(X, "-$1").toLowerCase().replace(ye, "-ms-") + ":" + d + "px", o = ";");
          }
        i = i || null, t = e.getAttribute("style"), t !== i && (i = Fn(i), Fn(t) !== i && (a.style = cc(e)));
      }
    }
    function Ua(e, t, a, i, o, f) {
      if (o.delete(a), e = e.getAttribute(a), e === null)
        switch (typeof i) {
          case "undefined":
          case "function":
          case "symbol":
          case "boolean":
            return;
        }
      else if (i != null)
        switch (typeof i) {
          case "function":
          case "symbol":
          case "boolean":
            break;
          default:
            if (vt(i, t), e === "" + i)
              return;
        }
      il(t, e, i, f);
    }
    function gh(e, t, a, i, o, f) {
      if (o.delete(a), e = e.getAttribute(a), e === null) {
        switch (typeof i) {
          case "function":
          case "symbol":
            return;
        }
        if (!i) return;
      } else
        switch (typeof i) {
          case "function":
          case "symbol":
            break;
          default:
            if (i) return;
        }
      il(t, e, i, f);
    }
    function vh(e, t, a, i, o, f) {
      if (o.delete(a), e = e.getAttribute(a), e === null)
        switch (typeof i) {
          case "undefined":
          case "function":
          case "symbol":
            return;
        }
      else if (i != null)
        switch (typeof i) {
          case "function":
          case "symbol":
            break;
          default:
            if (vt(i, a), e === "" + i)
              return;
        }
      il(t, e, i, f);
    }
    function Tf(e, t, a, i, o, f) {
      if (o.delete(a), e = e.getAttribute(a), e === null)
        switch (typeof i) {
          case "undefined":
          case "function":
          case "symbol":
          case "boolean":
            return;
          default:
            if (isNaN(i)) return;
        }
      else if (i != null)
        switch (typeof i) {
          case "function":
          case "symbol":
          case "boolean":
            break;
          default:
            if (!isNaN(i) && (vt(i, t), e === "" + i))
              return;
        }
      il(t, e, i, f);
    }
    function rr(e, t, a, i, o, f) {
      if (o.delete(a), e = e.getAttribute(a), e === null)
        switch (typeof i) {
          case "undefined":
          case "function":
          case "symbol":
          case "boolean":
            return;
        }
      else if (i != null)
        switch (typeof i) {
          case "function":
          case "symbol":
          case "boolean":
            break;
          default:
            if (vt(i, t), a = vs("" + i), e === a)
              return;
        }
      il(t, e, i, f);
    }
    function Na(e, t, a, i) {
      for (var o = {}, f = /* @__PURE__ */ new Set(), d = e.attributes, h = 0; h < d.length; h++)
        switch (d[h].name.toLowerCase()) {
          case "value":
            break;
          case "checked":
            break;
          case "selected":
            break;
          default:
            f.add(d[h].name);
        }
      if (du(t)) {
        for (var y in a)
          if (a.hasOwnProperty(y)) {
            var p = a[y];
            if (p != null) {
              if (Gu.hasOwnProperty(y))
                typeof p != "function" && cl(y, p);
              else if (a.suppressHydrationWarning !== !0)
                switch (y) {
                  case "children":
                    typeof p != "string" && typeof p != "number" || il(
                      "children",
                      e.textContent,
                      p,
                      o
                    );
                    continue;
                  case "suppressContentEditableWarning":
                  case "suppressHydrationWarning":
                  case "defaultValue":
                  case "defaultChecked":
                  case "innerHTML":
                  case "ref":
                    continue;
                  case "dangerouslySetInnerHTML":
                    d = e.innerHTML, p = p ? p.__html : void 0, p != null && (p = ph(e, p), il(
                      y,
                      d,
                      p,
                      o
                    ));
                    continue;
                  case "style":
                    f.delete(y), Hu(e, p, o);
                    continue;
                  case "offsetParent":
                  case "offsetTop":
                  case "offsetLeft":
                  case "offsetWidth":
                  case "offsetHeight":
                  case "isContentEditable":
                  case "outerText":
                  case "outerHTML":
                    f.delete(y.toLowerCase()), console.error(
                      "Assignment to read-only property will result in a no-op: `%s`",
                      y
                    );
                    continue;
                  case "className":
                    f.delete("class"), d = Ui(
                      e,
                      "class",
                      p
                    ), il(
                      "className",
                      d,
                      p,
                      o
                    );
                    continue;
                  default:
                    i.context === Ro && t !== "svg" && t !== "math" ? f.delete(y.toLowerCase()) : f.delete(y), d = Ui(
                      e,
                      y,
                      p
                    ), il(
                      y,
                      d,
                      p,
                      o
                    );
                }
            }
          }
      } else
        for (p in a)
          if (a.hasOwnProperty(p) && (y = a[p], y != null)) {
            if (Gu.hasOwnProperty(p))
              typeof y != "function" && cl(p, y);
            else if (a.suppressHydrationWarning !== !0)
              switch (p) {
                case "children":
                  typeof y != "string" && typeof y != "number" || il(
                    "children",
                    e.textContent,
                    y,
                    o
                  );
                  continue;
                case "suppressContentEditableWarning":
                case "suppressHydrationWarning":
                case "value":
                case "checked":
                case "selected":
                case "defaultValue":
                case "defaultChecked":
                case "innerHTML":
                case "ref":
                  continue;
                case "dangerouslySetInnerHTML":
                  d = e.innerHTML, y = y ? y.__html : void 0, y != null && (y = ph(e, y), d !== y && (o[p] = { __html: d }));
                  continue;
                case "className":
                  Ua(
                    e,
                    p,
                    "class",
                    y,
                    f,
                    o
                  );
                  continue;
                case "tabIndex":
                  Ua(
                    e,
                    p,
                    "tabindex",
                    y,
                    f,
                    o
                  );
                  continue;
                case "style":
                  f.delete(p), Hu(e, y, o);
                  continue;
                case "multiple":
                  f.delete(p), il(
                    p,
                    e.multiple,
                    y,
                    o
                  );
                  continue;
                case "muted":
                  f.delete(p), il(
                    p,
                    e.muted,
                    y,
                    o
                  );
                  continue;
                case "autoFocus":
                  f.delete("autofocus"), il(
                    p,
                    e.autofocus,
                    y,
                    o
                  );
                  continue;
                case "data":
                  if (t !== "object") {
                    f.delete(p), d = e.getAttribute("data"), il(
                      p,
                      d,
                      y,
                      o
                    );
                    continue;
                  }
                case "src":
                case "href":
                  if (!(y !== "" || t === "a" && p === "href" || t === "object" && p === "data")) {
                    console.error(
                      p === "src" ? 'An empty string ("") was passed to the %s attribute. This may cause the browser to download the whole page again over the network. To fix this, either do not render the element at all or pass null to %s instead of an empty string.' : 'An empty string ("") was passed to the %s attribute. To fix this, either do not render the element at all or pass null to %s instead of an empty string.',
                      p,
                      p
                    );
                    continue;
                  }
                  rr(
                    e,
                    p,
                    p,
                    y,
                    f,
                    o
                  );
                  continue;
                case "action":
                case "formAction":
                  if (d = e.getAttribute(p), typeof y == "function") {
                    f.delete(p.toLowerCase()), p === "formAction" ? (f.delete("name"), f.delete("formenctype"), f.delete("formmethod"), f.delete("formtarget")) : (f.delete("enctype"), f.delete("method"), f.delete("target"));
                    continue;
                  } else if (d === sT) {
                    f.delete(p.toLowerCase()), il(
                      p,
                      "function",
                      y,
                      o
                    );
                    continue;
                  }
                  rr(
                    e,
                    p,
                    p.toLowerCase(),
                    y,
                    f,
                    o
                  );
                  continue;
                case "xlinkHref":
                  rr(
                    e,
                    p,
                    "xlink:href",
                    y,
                    f,
                    o
                  );
                  continue;
                case "contentEditable":
                  vh(
                    e,
                    p,
                    "contenteditable",
                    y,
                    f,
                    o
                  );
                  continue;
                case "spellCheck":
                  vh(
                    e,
                    p,
                    "spellcheck",
                    y,
                    f,
                    o
                  );
                  continue;
                case "draggable":
                case "autoReverse":
                case "externalResourcesRequired":
                case "focusable":
                case "preserveAlpha":
                  vh(
                    e,
                    p,
                    p,
                    y,
                    f,
                    o
                  );
                  continue;
                case "allowFullScreen":
                case "async":
                case "autoPlay":
                case "controls":
                case "default":
                case "defer":
                case "disabled":
                case "disablePictureInPicture":
                case "disableRemotePlayback":
                case "formNoValidate":
                case "hidden":
                case "loop":
                case "noModule":
                case "noValidate":
                case "open":
                case "playsInline":
                case "readOnly":
                case "required":
                case "reversed":
                case "scoped":
                case "seamless":
                case "itemScope":
                  gh(
                    e,
                    p,
                    p.toLowerCase(),
                    y,
                    f,
                    o
                  );
                  continue;
                case "capture":
                case "download":
                  e: {
                    h = e;
                    var z = d = p, R = o;
                    if (f.delete(z), h = h.getAttribute(z), h === null)
                      switch (typeof y) {
                        case "undefined":
                        case "function":
                        case "symbol":
                          break e;
                        default:
                          if (y === !1) break e;
                      }
                    else if (y != null)
                      switch (typeof y) {
                        case "function":
                        case "symbol":
                          break;
                        case "boolean":
                          if (y === !0 && h === "") break e;
                          break;
                        default:
                          if (vt(y, d), h === "" + y)
                            break e;
                      }
                    il(
                      d,
                      h,
                      y,
                      R
                    );
                  }
                  continue;
                case "cols":
                case "rows":
                case "size":
                case "span":
                  e: {
                    if (h = e, z = d = p, R = o, f.delete(z), h = h.getAttribute(z), h === null)
                      switch (typeof y) {
                        case "undefined":
                        case "function":
                        case "symbol":
                        case "boolean":
                          break e;
                        default:
                          if (isNaN(y) || 1 > y) break e;
                      }
                    else if (y != null)
                      switch (typeof y) {
                        case "function":
                        case "symbol":
                        case "boolean":
                          break;
                        default:
                          if (!(isNaN(y) || 1 > y) && (vt(y, d), h === "" + y))
                            break e;
                      }
                    il(
                      d,
                      h,
                      y,
                      R
                    );
                  }
                  continue;
                case "rowSpan":
                  Tf(
                    e,
                    p,
                    "rowspan",
                    y,
                    f,
                    o
                  );
                  continue;
                case "start":
                  Tf(
                    e,
                    p,
                    p,
                    y,
                    f,
                    o
                  );
                  continue;
                case "xHeight":
                  Ua(
                    e,
                    p,
                    "x-height",
                    y,
                    f,
                    o
                  );
                  continue;
                case "xlinkActuate":
                  Ua(
                    e,
                    p,
                    "xlink:actuate",
                    y,
                    f,
                    o
                  );
                  continue;
                case "xlinkArcrole":
                  Ua(
                    e,
                    p,
                    "xlink:arcrole",
                    y,
                    f,
                    o
                  );
                  continue;
                case "xlinkRole":
                  Ua(
                    e,
                    p,
                    "xlink:role",
                    y,
                    f,
                    o
                  );
                  continue;
                case "xlinkShow":
                  Ua(
                    e,
                    p,
                    "xlink:show",
                    y,
                    f,
                    o
                  );
                  continue;
                case "xlinkTitle":
                  Ua(
                    e,
                    p,
                    "xlink:title",
                    y,
                    f,
                    o
                  );
                  continue;
                case "xlinkType":
                  Ua(
                    e,
                    p,
                    "xlink:type",
                    y,
                    f,
                    o
                  );
                  continue;
                case "xmlBase":
                  Ua(
                    e,
                    p,
                    "xml:base",
                    y,
                    f,
                    o
                  );
                  continue;
                case "xmlLang":
                  Ua(
                    e,
                    p,
                    "xml:lang",
                    y,
                    f,
                    o
                  );
                  continue;
                case "xmlSpace":
                  Ua(
                    e,
                    p,
                    "xml:space",
                    y,
                    f,
                    o
                  );
                  continue;
                case "inert":
                  y !== "" || Nv[p] || (Nv[p] = !0, console.error(
                    "Received an empty string for a boolean attribute `%s`. This will treat the attribute as if it were false. Either pass `false` to silence this warning, or pass `true` if you used an empty string in earlier versions of React to indicate this attribute is true.",
                    p
                  )), gh(
                    e,
                    p,
                    p,
                    y,
                    f,
                    o
                  );
                  continue;
                default:
                  if (!(2 < p.length) || p[0] !== "o" && p[0] !== "O" || p[1] !== "n" && p[1] !== "N") {
                    h = T0(p), d = !1, i.context === Ro && t !== "svg" && t !== "math" ? f.delete(h.toLowerCase()) : (z = p.toLowerCase(), z = tu.hasOwnProperty(
                      z
                    ) && tu[z] || null, z !== null && z !== p && (d = !0, f.delete(z)), f.delete(h));
                    e: if (z = e, R = h, h = y, mn(R))
                      if (z.hasAttribute(R))
                        z = z.getAttribute(
                          R
                        ), vt(
                          h,
                          R
                        ), h = z === "" + h ? h : z;
                      else {
                        switch (typeof h) {
                          case "function":
                          case "symbol":
                            break e;
                          case "boolean":
                            if (z = R.toLowerCase().slice(0, 5), z !== "data-" && z !== "aria-")
                              break e;
                        }
                        h = h === void 0 ? void 0 : null;
                      }
                    else h = void 0;
                    d || il(
                      p,
                      h,
                      y,
                      o
                    );
                  }
              }
          }
      return 0 < f.size && a.suppressHydrationWarning !== !0 && sr(e, f, o), Object.keys(o).length === 0 ? null : o;
    }
    function og(e, t) {
      switch (e.length) {
        case 0:
          return "";
        case 1:
          return e[0];
        case 2:
          return e[0] + " " + t + " " + e[1];
        default:
          return e.slice(0, -1).join(", ") + ", " + t + " " + e[e.length - 1];
      }
    }
    function Oa(e) {
      switch (e) {
        case "css":
        case "script":
        case "font":
        case "img":
        case "image":
        case "input":
        case "link":
          return !0;
        default:
          return !1;
      }
    }
    function fg() {
      if (typeof performance.getEntriesByType == "function") {
        for (var e = 0, t = 0, a = performance.getEntriesByType("resource"), i = 0; i < a.length; i++) {
          var o = a[i], f = o.transferSize, d = o.initiatorType, h = o.duration;
          if (f && h && Oa(d)) {
            for (d = 0, h = o.responseEnd, i += 1; i < a.length; i++) {
              var y = a[i], p = y.startTime;
              if (p > h) break;
              var z = y.transferSize, R = y.initiatorType;
              z && Oa(R) && (y = y.responseEnd, d += z * (y < h ? 1 : (h - p) / (y - p)));
            }
            if (--i, t += 8 * (f + d) / (o.duration / 1e3), e++, 10 < e) break;
          }
        }
        if (0 < e) return t / e / 1e6;
      }
      return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
    }
    function dr(e) {
      return e.nodeType === 9 ? e : e.ownerDocument;
    }
    function sg(e) {
      switch (e) {
        case Ie:
          return vm;
        case Ke:
          return jv;
        default:
          return Ro;
      }
    }
    function gi(e, t) {
      if (e === Ro)
        switch (t) {
          case "svg":
            return vm;
          case "math":
            return jv;
          default:
            return Ro;
        }
      return e === vm && t === "foreignObject" ? Ro : e;
    }
    function Af(e, t) {
      return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
    }
    function ky() {
      var e = window.event;
      return e && e.type === "popstate" ? e === mb ? !1 : (mb = e, !0) : (mb = null, !1);
    }
    function ju() {
      var e = window.event;
      return e && e !== r0 ? e.type : null;
    }
    function Of() {
      var e = window.event;
      return e && e !== r0 ? e.timeStamp : -1.1;
    }
    function rg(e) {
      setTimeout(function() {
        throw e;
      });
    }
    function dg(e, t, a) {
      switch (t) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          a.autoFocus && e.focus();
          break;
        case "img":
          a.src ? e.src = a.src : a.srcSet && (e.srcset = a.srcSet);
      }
    }
    function hg() {
    }
    function bh(e, t, a, i) {
      Rl(e, t, a, i), e[Da] = i;
    }
    function Sh(e) {
      Dc(e, "");
    }
    function a1(e, t, a) {
      e.nodeValue = a;
    }
    function mg(e) {
      if (!e.__reactWarnedAboutChildrenConflict) {
        var t = e[Da] || null;
        if (t !== null) {
          var a = ce(e);
          a !== null && (typeof t.children == "string" || typeof t.children == "number" ? (e.__reactWarnedAboutChildrenConflict = !0, de(a, function() {
            console.error(
              'Cannot use a ref on a React element as a container to `createRoot` or `createPortal` if that element also sets "children" text content using React. It should be a leaf with no children. Otherwise it\'s ambiguous which children should be used.'
            );
          })) : t.dangerouslySetInnerHTML != null && (e.__reactWarnedAboutChildrenConflict = !0, de(a, function() {
            console.error(
              'Cannot use a ref on a React element as a container to `createRoot` or `createPortal` if that element also sets "dangerouslySetInnerHTML" using React. It should be a leaf with no children. Otherwise it\'s ambiguous which children should be used.'
            );
          })));
        }
      }
    }
    function oc(e) {
      return e === "head";
    }
    function yg(e, t) {
      e.removeChild(t);
    }
    function pg(e, t) {
      (e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e).removeChild(t);
    }
    function no(e, t) {
      var a = t, i = 0;
      do {
        var o = a.nextSibling;
        if (e.removeChild(a), o && o.nodeType === 8)
          if (a = o.data, a === s0 || a === Hv) {
            if (i === 0) {
              e.removeChild(o), oo(t);
              return;
            }
            i--;
          } else if (a === f0 || a === cs || a === kr || a === gm || a === $r)
            i++;
          else if (a === dT)
            bi(
              e.ownerDocument.documentElement
            );
          else if (a === mT) {
            a = e.ownerDocument.head, bi(a);
            for (var f = a.firstChild; f; ) {
              var d = f.nextSibling, h = f.nodeName;
              f[Gf] || h === "SCRIPT" || h === "STYLE" || h === "LINK" && f.rel.toLowerCase() === "stylesheet" || a.removeChild(f), f = d;
            }
          } else
            a === hT && bi(e.ownerDocument.body);
        a = o;
      } while (a);
      oo(t);
    }
    function hr(e, t) {
      var a = e;
      e = 0;
      do {
        var i = a.nextSibling;
        if (a.nodeType === 1 ? t ? (a._stashedDisplay = a.style.display, a.style.display = "none") : (a.style.display = a._stashedDisplay || "", a.getAttribute("style") === "" && a.removeAttribute("style")) : a.nodeType === 3 && (t ? (a._stashedText = a.nodeValue, a.nodeValue = "") : a.nodeValue = a._stashedText || ""), i && i.nodeType === 8)
          if (a = i.data, a === s0) {
            if (e === 0) break;
            e--;
          } else
            a !== f0 && a !== cs && a !== kr && a !== gm || e++;
        a = i;
      } while (a);
    }
    function gg(e) {
      hr(e, !0);
    }
    function vg(e) {
      e = e.style, typeof e.setProperty == "function" ? e.setProperty("display", "none", "important") : e.display = "none";
    }
    function bg(e) {
      e.nodeValue = "";
    }
    function Sg(e) {
      hr(e, !1);
    }
    function Eg(e, t) {
      t = t[yT], t = t != null && t.hasOwnProperty("display") ? t.display : null, e.style.display = t == null || typeof t == "boolean" ? "" : ("" + t).trim();
    }
    function Tg(e, t) {
      e.nodeValue = t;
    }
    function zf(e) {
      var t = e.firstChild;
      for (t && t.nodeType === 10 && (t = t.nextSibling); t; ) {
        var a = t;
        switch (t = t.nextSibling, a.nodeName) {
          case "HTML":
          case "HEAD":
          case "BODY":
            zf(a), U(a);
            continue;
          case "SCRIPT":
          case "STYLE":
            continue;
          case "LINK":
            if (a.rel.toLowerCase() === "stylesheet") continue;
        }
        e.removeChild(a);
      }
    }
    function Ag(e, t, a, i) {
      for (; e.nodeType === 1; ) {
        var o = a;
        if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
          if (!i && (e.nodeName !== "INPUT" || e.type !== "hidden"))
            break;
        } else if (i) {
          if (!e[Gf])
            switch (t) {
              case "meta":
                if (!e.hasAttribute("itemprop")) break;
                return e;
              case "link":
                if (f = e.getAttribute("rel"), f === "stylesheet" && e.hasAttribute("data-precedence"))
                  break;
                if (f !== o.rel || e.getAttribute("href") !== (o.href == null || o.href === "" ? null : o.href) || e.getAttribute("crossorigin") !== (o.crossOrigin == null ? null : o.crossOrigin) || e.getAttribute("title") !== (o.title == null ? null : o.title))
                  break;
                return e;
              case "style":
                if (e.hasAttribute("data-precedence")) break;
                return e;
              case "script":
                if (f = e.getAttribute("src"), (f !== (o.src == null ? null : o.src) || e.getAttribute("type") !== (o.type == null ? null : o.type) || e.getAttribute("crossorigin") !== (o.crossOrigin == null ? null : o.crossOrigin)) && f && e.hasAttribute("async") && !e.hasAttribute("itemprop"))
                  break;
                return e;
              default:
                return e;
            }
        } else if (t === "input" && e.type === "hidden") {
          vt(o.name, "name");
          var f = o.name == null ? null : "" + o.name;
          if (o.type === "hidden" && e.getAttribute("name") === f)
            return e;
        } else return e;
        if (e = an(e.nextSibling), e === null) break;
      }
      return null;
    }
    function Og(e, t, a) {
      if (t === "") return null;
      for (; e.nodeType !== 3; )
        if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !a || (e = an(e.nextSibling), e === null)) return null;
      return e;
    }
    function Rt(e, t) {
      for (; e.nodeType !== 8; )
        if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = an(e.nextSibling), e === null)) return null;
      return e;
    }
    function mr(e) {
      return e.data === cs || e.data === kr;
    }
    function Wy(e) {
      return e.data === gm || e.data === cs && e.ownerDocument.readyState !== f2;
    }
    function zg(e, t) {
      var a = e.ownerDocument;
      if (e.data === kr)
        e._reactRetry = t;
      else if (e.data !== cs || a.readyState !== f2)
        t();
      else {
        var i = function() {
          t(), a.removeEventListener("DOMContentLoaded", i);
        };
        a.addEventListener("DOMContentLoaded", i), e._reactRetry = i;
      }
    }
    function an(e) {
      for (; e != null; e = e.nextSibling) {
        var t = e.nodeType;
        if (t === 1 || t === 3) break;
        if (t === 8) {
          if (t = e.data, t === f0 || t === gm || t === cs || t === kr || t === $r || t === rb || t === o2)
            break;
          if (t === s0 || t === Hv)
            return null;
        }
      }
      return e;
    }
    function Dg(e) {
      if (e.nodeType === 1) {
        for (var t = e.nodeName.toLowerCase(), a = {}, i = e.attributes, o = 0; o < i.length; o++) {
          var f = i[o];
          a[pi(f.name)] = f.name.toLowerCase() === "style" ? cc(e) : f.value;
        }
        return { type: t, props: a };
      }
      return e.nodeType === 8 ? e.data === $r ? { type: "Activity", props: {} } : { type: "Suspense", props: {} } : e.nodeValue;
    }
    function _g(e, t, a) {
      return a === null || a[rT] !== !0 ? (e.nodeValue === t ? e = null : (t = Fn(t), e = Fn(e.nodeValue) === t ? null : e.nodeValue), e) : null;
    }
    function Df(e) {
      e = e.nextSibling;
      for (var t = 0; e; ) {
        if (e.nodeType === 8) {
          var a = e.data;
          if (a === s0 || a === Hv) {
            if (t === 0)
              return an(e.nextSibling);
            t--;
          } else
            a !== f0 && a !== gm && a !== cs && a !== kr && a !== $r || t++;
        }
        e = e.nextSibling;
      }
      return null;
    }
    function uo(e) {
      e = e.previousSibling;
      for (var t = 0; e; ) {
        if (e.nodeType === 8) {
          var a = e.data;
          if (a === f0 || a === gm || a === cs || a === kr || a === $r) {
            if (t === 0) return e;
            t--;
          } else
            a !== s0 && a !== Hv || t++;
        }
        e = e.previousSibling;
      }
      return null;
    }
    function Fy(e) {
      oo(e);
    }
    function Eh(e) {
      oo(e);
    }
    function Iy(e) {
      oo(e);
    }
    function vi(e, t, a, i, o) {
      switch (o && ps(e, i.ancestorInfo), t = dr(a), e) {
        case "html":
          if (e = t.documentElement, !e)
            throw Error(
              "React expected an <html> element (document.documentElement) to exist in the Document but one was not found. React never removes the documentElement for any Document it renders into so the cause is likely in some other script running on this page."
            );
          return e;
        case "head":
          if (e = t.head, !e)
            throw Error(
              "React expected a <head> element (document.head) to exist in the Document but one was not found. React never removes the head for any Document it renders into so the cause is likely in some other script running on this page."
            );
          return e;
        case "body":
          if (e = t.body, !e)
            throw Error(
              "React expected a <body> element (document.body) to exist in the Document but one was not found. React never removes the body for any Document it renders into so the cause is likely in some other script running on this page."
            );
          return e;
        default:
          throw Error(
            "resolveSingletonInstance was called with an element type that is not supported. This is a bug in React."
          );
      }
    }
    function wu(e, t, a, i) {
      if (!a[Ei] && ce(a)) {
        var o = a.tagName.toLowerCase();
        console.error(
          "You are mounting a new %s component when a previous one has not first unmounted. It is an error to render more than one %s component at a time and attributes and children of these components will likely fail in unpredictable ways. Please only render a single instance of <%s> and if you need to mount a new one, ensure any previous ones have unmounted first.",
          o,
          o,
          o
        );
      }
      switch (e) {
        case "html":
        case "head":
        case "body":
          break;
        default:
          console.error(
            "acquireSingletonInstance was called with an element type that is not supported. This is a bug in React."
          );
      }
      for (o = a.attributes; o.length; )
        a.removeAttributeNode(o[0]);
      Pt(a, e, t), a[el] = i, a[Da] = t;
    }
    function bi(e) {
      for (var t = e.attributes; t.length; )
        e.removeAttributeNode(t[0]);
      U(e);
    }
    function Th(e) {
      return typeof e.getRootNode == "function" ? e.getRootNode() : e.nodeType === 9 ? e : e.ownerDocument;
    }
    function Py(e, t, a) {
      var i = bm;
      if (i && typeof t == "string" && t) {
        var o = xt(t);
        o = 'link[rel="' + e + '"][href="' + o + '"]', typeof a == "string" && (o += '[crossorigin="' + a + '"]'), y2.has(o) || (y2.add(o), e = { rel: e, crossOrigin: a, href: t }, i.querySelector(o) === null && (t = i.createElement("link"), Pt(t, "link", e), Se(t), i.head.appendChild(t)));
      }
    }
    function ep(e, t, a, i) {
      var o = (o = nn.current) ? Th(o) : null;
      if (!o)
        throw Error(
          '"resourceRoot" was expected to exist. This is a bug in React.'
        );
      switch (e) {
        case "meta":
        case "title":
          return null;
        case "style":
          return typeof a.precedence == "string" && typeof a.href == "string" ? (a = io(a.href), t = we(o).hoistableStyles, i = t.get(a), i || (i = {
            type: "style",
            instance: null,
            count: 0,
            state: null
          }, t.set(a, i)), i) : { type: "void", instance: null, count: 0, state: null };
        case "link":
          if (a.rel === "stylesheet" && typeof a.href == "string" && typeof a.precedence == "string") {
            e = io(a.href);
            var f = we(o).hoistableStyles, d = f.get(e);
            if (!d && (o = o.ownerDocument || o, d = {
              type: "stylesheet",
              instance: null,
              count: 0,
              state: { loading: Fr, preload: null }
            }, f.set(e, d), (f = o.querySelector(
              pr(e)
            )) && !f._p && (d.instance = f, d.state.loading = d0 | Fu), !Iu.has(e))) {
              var h = {
                rel: "preload",
                as: "style",
                href: a.href,
                crossOrigin: a.crossOrigin,
                integrity: a.integrity,
                media: a.media,
                hrefLang: a.hrefLang,
                referrerPolicy: a.referrerPolicy
              };
              Iu.set(e, h), f || Rg(
                o,
                e,
                h,
                d.state
              );
            }
            if (t && i === null)
              throw a = `

  - ` + yr(t) + `
  + ` + yr(a), Error(
                "Expected <link> not to update to be updated to a stylesheet with precedence. Check the `rel`, `href`, and `precedence` props of this component. Alternatively, check whether two different <link> components render in the same slot or share the same key." + a
              );
            return d;
          }
          if (t && i !== null)
            throw a = `

  - ` + yr(t) + `
  + ` + yr(a), Error(
              "Expected stylesheet with precedence to not be updated to a different kind of <link>. Check the `rel`, `href`, and `precedence` props of this component. Alternatively, check whether two different <link> components render in the same slot or share the same key." + a
            );
          return null;
        case "script":
          return t = a.async, a = a.src, typeof a == "string" && t && typeof t != "function" && typeof t != "symbol" ? (a = co(a), t = we(o).hoistableScripts, i = t.get(a), i || (i = {
            type: "script",
            instance: null,
            count: 0,
            state: null
          }, t.set(a, i)), i) : { type: "void", instance: null, count: 0, state: null };
        default:
          throw Error(
            'getResource encountered a type it did not expect: "' + e + '". this is a bug in React.'
          );
      }
    }
    function yr(e) {
      var t = 0, a = "<link";
      return typeof e.rel == "string" ? (t++, a += ' rel="' + e.rel + '"') : un.call(e, "rel") && (t++, a += ' rel="' + (e.rel === null ? "null" : "invalid type " + typeof e.rel) + '"'), typeof e.href == "string" ? (t++, a += ' href="' + e.href + '"') : un.call(e, "href") && (t++, a += ' href="' + (e.href === null ? "null" : "invalid type " + typeof e.href) + '"'), typeof e.precedence == "string" ? (t++, a += ' precedence="' + e.precedence + '"') : un.call(e, "precedence") && (t++, a += " precedence={" + (e.precedence === null ? "null" : "invalid type " + typeof e.precedence) + "}"), Object.getOwnPropertyNames(e).length > t && (a += " ..."), a + " />";
    }
    function io(e) {
      return 'href="' + xt(e) + '"';
    }
    function pr(e) {
      return 'link[rel="stylesheet"][' + e + "]";
    }
    function Ah(e) {
      return et({}, e, {
        "data-precedence": e.precedence,
        precedence: null
      });
    }
    function Rg(e, t, a, i) {
      e.querySelector(
        'link[rel="preload"][as="style"][' + t + "]"
      ) ? i.loading = d0 : (t = e.createElement("link"), i.preload = t, t.addEventListener("load", function() {
        return i.loading |= d0;
      }), t.addEventListener("error", function() {
        return i.loading |= h2;
      }), Pt(t, "link", a), Se(t), e.head.appendChild(t));
    }
    function co(e) {
      return '[src="' + xt(e) + '"]';
    }
    function gr(e) {
      return "script[async]" + e;
    }
    function Oh(e, t, a) {
      if (t.count++, t.instance === null)
        switch (t.type) {
          case "style":
            var i = e.querySelector(
              'style[data-href~="' + xt(a.href) + '"]'
            );
            if (i)
              return t.instance = i, Se(i), i;
            var o = et({}, a, {
              "data-href": a.href,
              "data-precedence": a.precedence,
              href: null,
              precedence: null
            });
            return i = (e.ownerDocument || e).createElement("style"), Se(i), Pt(i, "style", o), _f(i, a.precedence, e), t.instance = i;
          case "stylesheet":
            o = io(a.href);
            var f = e.querySelector(
              pr(o)
            );
            if (f)
              return t.state.loading |= Fu, t.instance = f, Se(f), f;
            i = Ah(a), (o = Iu.get(o)) && tp(i, o), f = (e.ownerDocument || e).createElement("link"), Se(f);
            var d = f;
            return d._p = new Promise(function(h, y) {
              d.onload = h, d.onerror = y;
            }), Pt(f, "link", i), t.state.loading |= Fu, _f(f, a.precedence, e), t.instance = f;
          case "script":
            return f = co(a.src), (o = e.querySelector(
              gr(f)
            )) ? (t.instance = o, Se(o), o) : (i = a, (o = Iu.get(f)) && (i = et({}, a), lp(i, o)), e = e.ownerDocument || e, o = e.createElement("script"), Se(o), Pt(o, "link", i), e.head.appendChild(o), t.instance = o);
          case "void":
            return null;
          default:
            throw Error(
              'acquireResource encountered a resource type it did not expect: "' + t.type + '". this is a bug in React.'
            );
        }
      else
        t.type === "stylesheet" && (t.state.loading & Fu) === Fr && (i = t.instance, t.state.loading |= Fu, _f(i, a.precedence, e));
      return t.instance;
    }
    function _f(e, t, a) {
      for (var i = a.querySelectorAll(
        'link[rel="stylesheet"][data-precedence],style[data-precedence]'
      ), o = i.length ? i[i.length - 1] : null, f = o, d = 0; d < i.length; d++) {
        var h = i[d];
        if (h.dataset.precedence === t) f = h;
        else if (f !== o) break;
      }
      f ? f.parentNode.insertBefore(e, f.nextSibling) : (t = a.nodeType === 9 ? a.head : a, t.insertBefore(e, t.firstChild));
    }
    function tp(e, t) {
      e.crossOrigin == null && (e.crossOrigin = t.crossOrigin), e.referrerPolicy == null && (e.referrerPolicy = t.referrerPolicy), e.title == null && (e.title = t.title);
    }
    function lp(e, t) {
      e.crossOrigin == null && (e.crossOrigin = t.crossOrigin), e.referrerPolicy == null && (e.referrerPolicy = t.referrerPolicy), e.integrity == null && (e.integrity = t.integrity);
    }
    function Rf(e, t, a) {
      if (wv === null) {
        var i = /* @__PURE__ */ new Map(), o = wv = /* @__PURE__ */ new Map();
        o.set(a, i);
      } else
        o = wv, i = o.get(a), i || (i = /* @__PURE__ */ new Map(), o.set(a, i));
      if (i.has(e)) return i;
      for (i.set(e, null), a = a.getElementsByTagName(e), o = 0; o < a.length; o++) {
        var f = a[o];
        if (!(f[Gf] || f[el] || e === "link" && f.getAttribute("rel") === "stylesheet") && f.namespaceURI !== Ie) {
          var d = f.getAttribute(t) || "";
          d = e + d;
          var h = i.get(d);
          h ? h.push(f) : i.set(d, [f]);
        }
      }
      return i;
    }
    function Mg(e, t, a) {
      e = e.ownerDocument || e, e.head.insertBefore(
        a,
        t === "title" ? e.querySelector("head > title") : null
      );
    }
    function Cg(e, t, a) {
      var i = !a.ancestorInfo.containerTagInScope;
      if (a.context === vm || t.itemProp != null)
        return !i || t.itemProp == null || e !== "meta" && e !== "title" && e !== "style" && e !== "link" && e !== "script" || console.error(
          "Cannot render a <%s> outside the main document if it has an `itemProp` prop. `itemProp` suggests the tag belongs to an `itemScope` which can appear anywhere in the DOM. If you were intending for React to hoist this <%s> remove the `itemProp` prop. Otherwise, try moving this tag into the <head> or <body> of the Document.",
          e,
          e
        ), !1;
      switch (e) {
        case "meta":
        case "title":
          return !0;
        case "style":
          if (typeof t.precedence != "string" || typeof t.href != "string" || t.href === "") {
            i && console.error(
              'Cannot render a <style> outside the main document without knowing its precedence and a unique href key. React can hoist and deduplicate <style> tags if you provide a `precedence` prop along with an `href` prop that does not conflict with the `href` values used in any other hoisted <style> or <link rel="stylesheet" ...> tags.  Note that hoisting <style> tags is considered an advanced feature that most will not use directly. Consider moving the <style> tag to the <head> or consider adding a `precedence="default"` and `href="some unique resource identifier"`.'
            );
            break;
          }
          return !0;
        case "link":
          if (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" || t.onLoad || t.onError) {
            if (t.rel === "stylesheet" && typeof t.precedence == "string") {
              e = t.href;
              var o = t.onError, f = t.disabled;
              a = [], t.onLoad && a.push("`onLoad`"), o && a.push("`onError`"), f != null && a.push("`disabled`"), o = og(a, "and"), o += a.length === 1 ? " prop" : " props", f = a.length === 1 ? "an " + o : "the " + o, a.length && console.error(
                'React encountered a <link rel="stylesheet" href="%s" ... /> with a `precedence` prop that also included %s. The presence of loading and error handlers indicates an intent to manage the stylesheet loading state from your from your Component code and React will not hoist or deduplicate this stylesheet. If your intent was to have React hoist and deduplciate this stylesheet using the `precedence` prop remove the %s, otherwise remove the `precedence` prop.',
                e,
                f,
                o
              );
            }
            i && (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" ? console.error(
              "Cannot render a <link> outside the main document without a `rel` and `href` prop. Try adding a `rel` and/or `href` prop to this <link> or moving the link into the <head> tag"
            ) : (t.onError || t.onLoad) && console.error(
              "Cannot render a <link> with onLoad or onError listeners outside the main document. Try removing onLoad={...} and onError={...} or moving it into the root <head> tag or somewhere in the <body>."
            ));
            break;
          }
          switch (t.rel) {
            case "stylesheet":
              return e = t.precedence, t = t.disabled, typeof e != "string" && i && console.error(
                'Cannot render a <link rel="stylesheet" /> outside the main document without knowing its precedence. Consider adding precedence="default" or moving it into the root <head> tag.'
              ), typeof e == "string" && t == null;
            default:
              return !0;
          }
        case "script":
          if (e = t.async && typeof t.async != "function" && typeof t.async != "symbol", !e || t.onLoad || t.onError || !t.src || typeof t.src != "string") {
            i && (e ? t.onLoad || t.onError ? console.error(
              "Cannot render a <script> with onLoad or onError listeners outside the main document. Try removing onLoad={...} and onError={...} or moving it into the root <head> tag or somewhere in the <body>."
            ) : console.error(
              "Cannot render a <script> outside the main document without `async={true}` and a non-empty `src` prop. Ensure there is a valid `src` and either make the script async or move it into the root <head> tag or somewhere in the <body>."
            ) : console.error(
              'Cannot render a sync or defer <script> outside the main document without knowing its order. Try adding async="" or moving it into the root <head> tag.'
            ));
            break;
          }
          return !0;
        case "noscript":
        case "template":
          i && console.error(
            "Cannot render <%s> outside the main document. Try moving it into the root <head> tag.",
            e
          );
      }
      return !1;
    }
    function ct(e) {
      return !(e.type === "stylesheet" && (e.state.loading & m2) === Fr);
    }
    function ap(e, t, a, i) {
      if (a.type === "stylesheet" && (typeof i.media != "string" || matchMedia(i.media).matches !== !1) && (a.state.loading & Fu) === Fr) {
        if (a.instance === null) {
          var o = io(i.href), f = t.querySelector(
            pr(o)
          );
          if (f) {
            t = f._p, t !== null && typeof t == "object" && typeof t.then == "function" && (e.count++, e = Mf.bind(e), t.then(e, e)), a.state.loading |= Fu, a.instance = f, Se(f);
            return;
          }
          f = t.ownerDocument || t, i = Ah(i), (o = Iu.get(o)) && tp(i, o), f = f.createElement("link"), Se(f);
          var d = f;
          d._p = new Promise(function(h, y) {
            d.onload = h, d.onerror = y;
          }), Pt(f, "link", i), a.instance = f;
        }
        e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(a, t), (t = a.state.preload) && (a.state.loading & m2) === Fr && (e.count++, a = Mf.bind(e), t.addEventListener("load", a), t.addEventListener("error", a));
      }
    }
    function zh(e, t) {
      return e.stylesheets && e.count === 0 && vr(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(a) {
        var i = setTimeout(function() {
          if (e.stylesheets && vr(e, e.stylesheets), e.unsuspend) {
            var f = e.unsuspend;
            e.unsuspend = null, f();
          }
        }, vT + t);
        0 < e.imgBytes && pb === 0 && (pb = 125 * fg() * ST);
        var o = setTimeout(
          function() {
            if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && vr(e, e.stylesheets), e.unsuspend)) {
              var f = e.unsuspend;
              e.unsuspend = null, f();
            }
          },
          (e.imgBytes > pb ? 50 : bT) + t
        );
        return e.unsuspend = a, function() {
          e.unsuspend = null, clearTimeout(i), clearTimeout(o);
        };
      } : null;
    }
    function Mf() {
      if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
        if (this.stylesheets)
          vr(this, this.stylesheets);
        else if (this.unsuspend) {
          var e = this.unsuspend;
          this.unsuspend = null, e();
        }
      }
    }
    function vr(e, t) {
      e.stylesheets = null, e.unsuspend !== null && (e.count++, Bv = /* @__PURE__ */ new Map(), t.forEach(np, e), Bv = null, Mf.call(e));
    }
    function np(e, t) {
      if (!(t.state.loading & Fu)) {
        var a = Bv.get(e);
        if (a) var i = a.get(gb);
        else {
          a = /* @__PURE__ */ new Map(), Bv.set(e, a);
          for (var o = e.querySelectorAll(
            "link[data-precedence],style[data-precedence]"
          ), f = 0; f < o.length; f++) {
            var d = o[f];
            (d.nodeName === "LINK" || d.getAttribute("media") !== "not all") && (a.set(d.dataset.precedence, d), i = d);
          }
          i && a.set(gb, i);
        }
        o = t.instance, d = o.getAttribute("data-precedence"), f = a.get(d) || i, f === i && a.set(gb, o), a.set(d, o), this.count++, i = Mf.bind(this), o.addEventListener("load", i), o.addEventListener("error", i), f ? f.parentNode.insertBefore(o, f.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(o, e.firstChild)), t.state.loading |= Fu;
      }
    }
    function br(e, t, a, i, o, f, d, h, y) {
      for (this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Wr, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = Uo(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Uo(0), this.hiddenUpdates = Uo(null), this.identifierPrefix = i, this.onUncaughtError = o, this.onCaughtError = f, this.onRecoverableError = d, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = y, this.incompleteTransitions = /* @__PURE__ */ new Map(), this.passiveEffectDuration = this.effectDuration = -0, this.memoizedUpdaters = /* @__PURE__ */ new Set(), e = this.pendingUpdatersLaneMap = [], t = 0; 31 > t; t++) e.push(/* @__PURE__ */ new Set());
      this._debugRootType = a ? "hydrateRoot()" : "createRoot()";
    }
    function Sr(e, t, a, i, o, f, d, h, y, p, z, R) {
      return e = new br(
        e,
        t,
        a,
        d,
        y,
        p,
        z,
        R,
        h
      ), t = VE, f === !0 && (t |= wa | Ti), t |= tt, f = C(3, null, null, t), e.current = f, f.stateNode = e, t = Od(), wc(t), e.pooledCache = t, wc(t), f.memoizedState = {
        element: i,
        isDehydrated: a,
        cache: t
      }, ot(f), e;
    }
    function xg(e) {
      return e ? (e = Jf, e) : Jf;
    }
    function Dh(e, t, a, i, o, f) {
      if (Ml && typeof Ml.onScheduleFiberRoot == "function")
        try {
          Ml.onScheduleFiberRoot(ho, i, a);
        } catch (d) {
          Yu || (Yu = !0, console.error(
            "React instrumentation encountered an error: %o",
            d
          ));
        }
      o = xg(o), i.context === null ? i.context = o : i.pendingContext = o, Bu && ja !== null && !b2 && (b2 = !0, console.error(
        `Render methods should be a pure function of props and state; triggering nested component updates from render is not allowed. If necessary, trigger nested updates in componentDidUpdate.

Check the render method of %s.`,
        pe(ja) || "Unknown"
      )), i = Dl(t), i.payload = { element: a }, f = f === void 0 ? null : f, f !== null && (typeof f != "function" && console.error(
        "Expected the last optional `callback` argument to be a function. Instead received: %s.",
        f
      ), i.callback = f), a = bu(e, i, t), a !== null && (pu(t, "root.render()", null), Ge(a, e, t), Tn(a, e, t));
    }
    function Ug(e, t) {
      if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
        var a = e.retryLane;
        e.retryLane = a !== 0 && a < t ? a : t;
      }
    }
    function up(e, t) {
      Ug(e, t), (e = e.alternate) && Ug(e, t);
    }
    function ip(e) {
      if (e.tag === 13 || e.tag === 31) {
        var t = aa(e, 67108864);
        t !== null && Ge(t, e, 67108864), up(e, 67108864);
      }
    }
    function cp(e) {
      if (e.tag === 13 || e.tag === 31) {
        var t = ua(e);
        t = hn(t);
        var a = aa(e, t);
        a !== null && Ge(a, e, t), up(e, t);
      }
    }
    function Ht() {
      return ja;
    }
    function op(e, t, a, i) {
      var o = L.T;
      L.T = null;
      var f = At.p;
      try {
        At.p = Cl, fp(e, t, a, i);
      } finally {
        At.p = f, L.T = o;
      }
    }
    function Wl(e, t, a, i) {
      var o = L.T;
      L.T = null;
      var f = At.p;
      try {
        At.p = Il, fp(e, t, a, i);
      } finally {
        At.p = f, L.T = o;
      }
    }
    function fp(e, t, a, i) {
      if (qv) {
        var o = _h(i);
        if (o === null)
          kn(
            e,
            t,
            i,
            Gv,
            a
          ), Mh(e, i);
        else if (Ng(
          o,
          e,
          t,
          a,
          i
        ))
          i.stopPropagation();
        else if (Mh(e, i), t & 4 && -1 < TT.indexOf(e)) {
          for (; o !== null; ) {
            var f = ce(o);
            if (f !== null)
              switch (f.tag) {
                case 3:
                  if (f = f.stateNode, f.current.memoizedState.isDehydrated) {
                    var d = ou(f.pendingLanes);
                    if (d !== 0) {
                      var h = f;
                      for (h.pendingLanes |= 2, h.entangledLanes |= 2; d; ) {
                        var y = 1 << 31 - Fl(d);
                        h.entanglements[1] |= y, d &= ~y;
                      }
                      xa(f), (pt & (ea | uu)) === sa && (Tv = Ll() + KS, Uu(0));
                    }
                  }
                  break;
                case 31:
                case 13:
                  h = aa(f, 2), h !== null && Ge(h, f, 2), ln(), up(f, 2);
              }
            if (f = _h(i), f === null && kn(
              e,
              t,
              i,
              Gv,
              a
            ), f === o) break;
            o = f;
          }
          o !== null && i.stopPropagation();
        } else
          kn(
            e,
            t,
            i,
            null,
            a
          );
      }
    }
    function _h(e) {
      return e = Nn(e), sp(e);
    }
    function sp(e) {
      if (Gv = null, e = ae(e), e !== null) {
        var t = Ue(e);
        if (t === null) e = null;
        else {
          var a = t.tag;
          if (a === 13) {
            if (e = Jt(t), e !== null) return e;
            e = null;
          } else if (a === 31) {
            if (e = mt(t), e !== null) return e;
            e = null;
          } else if (a === 3) {
            if (t.stateNode.current.memoizedState.isDehydrated)
              return t.tag === 3 ? t.stateNode.containerInfo : null;
            e = null;
          } else t !== e && (e = null);
        }
      }
      return Gv = e, null;
    }
    function Rh(e) {
      switch (e) {
        case "beforetoggle":
        case "cancel":
        case "click":
        case "close":
        case "contextmenu":
        case "copy":
        case "cut":
        case "auxclick":
        case "dblclick":
        case "dragend":
        case "dragstart":
        case "drop":
        case "focusin":
        case "focusout":
        case "input":
        case "invalid":
        case "keydown":
        case "keypress":
        case "keyup":
        case "mousedown":
        case "mouseup":
        case "paste":
        case "pause":
        case "play":
        case "pointercancel":
        case "pointerdown":
        case "pointerup":
        case "ratechange":
        case "reset":
        case "resize":
        case "seeked":
        case "submit":
        case "toggle":
        case "touchcancel":
        case "touchend":
        case "touchstart":
        case "volumechange":
        case "change":
        case "selectionchange":
        case "textInput":
        case "compositionstart":
        case "compositionend":
        case "compositionupdate":
        case "beforeblur":
        case "afterblur":
        case "beforeinput":
        case "blur":
        case "fullscreenchange":
        case "focus":
        case "hashchange":
        case "popstate":
        case "select":
        case "selectstart":
          return Cl;
        case "drag":
        case "dragenter":
        case "dragexit":
        case "dragleave":
        case "dragover":
        case "mousemove":
        case "mouseout":
        case "mouseover":
        case "pointermove":
        case "pointerout":
        case "pointerover":
        case "scroll":
        case "touchmove":
        case "wheel":
        case "mouseenter":
        case "mouseleave":
        case "pointerenter":
        case "pointerleave":
          return Il;
        case "message":
          switch (Dr()) {
            case Sp:
              return Cl;
            case Yh:
              return Il;
            case ro:
            case qg:
              return ca;
            case qh:
              return hc;
            default:
              return ca;
          }
        default:
          return ca;
      }
    }
    function Mh(e, t) {
      switch (e) {
        case "focusin":
        case "focusout":
          os = null;
          break;
        case "dragenter":
        case "dragleave":
          fs = null;
          break;
        case "mouseover":
        case "mouseout":
          ss = null;
          break;
        case "pointerover":
        case "pointerout":
          m0.delete(t.pointerId);
          break;
        case "gotpointercapture":
        case "lostpointercapture":
          y0.delete(t.pointerId);
      }
    }
    function fc(e, t, a, i, o, f) {
      return e === null || e.nativeEvent !== f ? (e = {
        blockedOn: t,
        domEventName: a,
        eventSystemFlags: i,
        nativeEvent: f,
        targetContainers: [o]
      }, t !== null && (t = ce(t), t !== null && ip(t)), e) : (e.eventSystemFlags |= i, t = e.targetContainers, o !== null && t.indexOf(o) === -1 && t.push(o), e);
    }
    function Ng(e, t, a, i, o) {
      switch (t) {
        case "focusin":
          return os = fc(
            os,
            e,
            t,
            a,
            i,
            o
          ), !0;
        case "dragenter":
          return fs = fc(
            fs,
            e,
            t,
            a,
            i,
            o
          ), !0;
        case "mouseover":
          return ss = fc(
            ss,
            e,
            t,
            a,
            i,
            o
          ), !0;
        case "pointerover":
          var f = o.pointerId;
          return m0.set(
            f,
            fc(
              m0.get(f) || null,
              e,
              t,
              a,
              i,
              o
            )
          ), !0;
        case "gotpointercapture":
          return f = o.pointerId, y0.set(
            f,
            fc(
              y0.get(f) || null,
              e,
              t,
              a,
              i,
              o
            )
          ), !0;
      }
      return !1;
    }
    function rp(e) {
      var t = ae(e.target);
      if (t !== null) {
        var a = Ue(t);
        if (a !== null) {
          if (t = a.tag, t === 13) {
            if (t = Jt(a), t !== null) {
              e.blockedOn = t, g(e.priority, function() {
                cp(a);
              });
              return;
            }
          } else if (t === 31) {
            if (t = mt(a), t !== null) {
              e.blockedOn = t, g(e.priority, function() {
                cp(a);
              });
              return;
            }
          } else if (t === 3 && a.stateNode.current.memoizedState.isDehydrated) {
            e.blockedOn = a.tag === 3 ? a.stateNode.containerInfo : null;
            return;
          }
        }
      }
      e.blockedOn = null;
    }
    function Cf(e) {
      if (e.blockedOn !== null) return !1;
      for (var t = e.targetContainers; 0 < t.length; ) {
        var a = _h(e.nativeEvent);
        if (a === null) {
          a = e.nativeEvent;
          var i = new a.constructor(
            a.type,
            a
          ), o = i;
          zp !== null && console.error(
            "Expected currently replaying event to be null. This error is likely caused by a bug in React. Please file an issue."
          ), zp = o, a.target.dispatchEvent(i), zp === null && console.error(
            "Expected currently replaying event to not be null. This error is likely caused by a bug in React. Please file an issue."
          ), zp = null;
        } else
          return t = ce(a), t !== null && ip(t), e.blockedOn = a, !1;
        t.shift();
      }
      return !0;
    }
    function Ch(e, t, a) {
      Cf(e) && a.delete(t);
    }
    function n1() {
      vb = !1, os !== null && Cf(os) && (os = null), fs !== null && Cf(fs) && (fs = null), ss !== null && Cf(ss) && (ss = null), m0.forEach(Ch), y0.forEach(Ch);
    }
    function Er(e, t) {
      e.blockedOn === t && (e.blockedOn = null, vb || (vb = !0, vl.unstable_scheduleCallback(
        vl.unstable_NormalPriority,
        n1
      )));
    }
    function Hg(e) {
      Lv !== e && (Lv = e, vl.unstable_scheduleCallback(
        vl.unstable_NormalPriority,
        function() {
          Lv === e && (Lv = null);
          for (var t = 0; t < e.length; t += 3) {
            var a = e[t], i = e[t + 1], o = e[t + 2];
            if (typeof i != "function") {
              if (sp(i || a) === null)
                continue;
              break;
            }
            var f = ce(a);
            f !== null && (e.splice(t, 3), t -= 3, a = {
              pending: !0,
              data: o,
              method: a.method,
              action: i
            }, Object.freeze(a), ri(
              f,
              a,
              i,
              o
            ));
          }
        }
      ));
    }
    function oo(e) {
      function t(y) {
        return Er(y, e);
      }
      os !== null && Er(os, e), fs !== null && Er(fs, e), ss !== null && Er(ss, e), m0.forEach(t), y0.forEach(t);
      for (var a = 0; a < rs.length; a++) {
        var i = rs[a];
        i.blockedOn === e && (i.blockedOn = null);
      }
      for (; 0 < rs.length && (a = rs[0], a.blockedOn === null); )
        rp(a), a.blockedOn === null && rs.shift();
      if (a = (e.ownerDocument || e).$$reactFormReplay, a != null)
        for (i = 0; i < a.length; i += 3) {
          var o = a[i], f = a[i + 1], d = o[Da] || null;
          if (typeof f == "function")
            d || Hg(a);
          else if (d) {
            var h = null;
            if (f && f.hasAttribute("formAction")) {
              if (o = f, d = f[Da] || null)
                h = d.formAction;
              else if (sp(o) !== null) continue;
            } else h = d.action;
            typeof h == "function" ? a[i + 1] = h : (a.splice(i, 3), i -= 3), Hg(a);
          }
        }
    }
    function jg() {
      function e(f) {
        f.canIntercept && f.info === "react-transition" && f.intercept({
          handler: function() {
            return new Promise(function(d) {
              return o = d;
            });
          },
          focusReset: "manual",
          scroll: "manual"
        });
      }
      function t() {
        o !== null && (o(), o = null), i || setTimeout(a, 20);
      }
      function a() {
        if (!i && !navigation.transition) {
          var f = navigation.currentEntry;
          f && f.url != null && navigation.navigate(f.url, {
            state: f.getState(),
            info: "react-transition",
            history: "replace"
          });
        }
      }
      if (typeof navigation == "object") {
        var i = !1, o = null;
        return navigation.addEventListener("navigate", e), navigation.addEventListener("navigatesuccess", t), navigation.addEventListener("navigateerror", t), setTimeout(a, 100), function() {
          i = !0, navigation.removeEventListener("navigate", e), navigation.removeEventListener(
            "navigatesuccess",
            t
          ), navigation.removeEventListener(
            "navigateerror",
            t
          ), o !== null && (o(), o = null);
        };
      }
    }
    function dp(e) {
      this._internalRoot = e;
    }
    function In(e) {
      this._internalRoot = e;
    }
    function hp(e) {
      e[Ei] && (e._reactRootContainer ? console.error(
        "You are calling ReactDOMClient.createRoot() on a container that was previously passed to ReactDOM.render(). This is not supported."
      ) : console.error(
        "You are calling ReactDOMClient.createRoot() on a container that has already been passed to createRoot() before. Instead, call root.render() on the existing root instead if you want to update it."
      ));
    }
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
    var vl = I2(), Tr = Sm(), u1 = P2(), et = Object.assign, wg = Symbol.for("react.element"), Dn = Symbol.for("react.transitional.element"), sc = Symbol.for("react.portal"), xf = Symbol.for("react.fragment"), za = Symbol.for("react.strict_mode"), Ar = Symbol.for("react.profiler"), xh = Symbol.for("react.consumer"), Pn = Symbol.for("react.context"), Uf = Symbol.for("react.forward_ref"), fo = Symbol.for("react.suspense"), Ha = Symbol.for("react.suspense_list"), Or = Symbol.for("react.memo"), ia = Symbol.for("react.lazy"), eu = Symbol.for("react.activity"), i1 = Symbol.for("react.memo_cache_sentinel"), Bg = Symbol.iterator, Nf = Symbol.for("react.client.reference"), Al = Array.isArray, L = Tr.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, At = u1.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, c1 = Object.freeze({
      pending: !1,
      data: null,
      method: null,
      action: null
    }), mp = [], yp = [], Si = -1, rc = Yt(null), Hf = Yt(null), nn = Yt(null), dc = Yt(null), jf = 0, Yg, so, wf, pp, zr, Uh, Nh;
    Ne.__reactDisabledLog = !0;
    var Bf, gp, Hh = !1, vp = new (typeof WeakMap == "function" ? WeakMap : Map)(), ja = null, Bu = !1, un = Object.prototype.hasOwnProperty, bp = vl.unstable_scheduleCallback, jh = vl.unstable_cancelCallback, wh = vl.unstable_shouldYield, Bh = vl.unstable_requestPaint, Ll = vl.unstable_now, Dr = vl.unstable_getCurrentPriorityLevel, Sp = vl.unstable_ImmediatePriority, Yh = vl.unstable_UserBlockingPriority, ro = vl.unstable_NormalPriority, qg = vl.unstable_LowPriority, qh = vl.unstable_IdlePriority, Ep = vl.log, Gg = vl.unstable_setDisableYieldValue, ho = null, Ml = null, Yu = !1, qu = typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u", Fl = Math.clz32 ? Math.clz32 : Ci, Tp = Math.log, Gh = Math.LN2, Yf = 256, _r = 262144, qf = 4194304, Cl = 2, Il = 8, ca = 32, hc = 268435456, _n = Math.random().toString(36).slice(2), el = "__reactFiber$" + _n, Da = "__reactProps$" + _n, Ei = "__reactContainer$" + _n, mo = "__reactEvents$" + _n, o1 = "__reactListeners$" + _n, Lg = "__reactHandles$" + _n, Rr = "__reactResources$" + _n, Gf = "__reactMarker$" + _n, Xg = /* @__PURE__ */ new Set(), Gu = {}, Lf = {}, Qg = {
      button: !0,
      checkbox: !0,
      image: !0,
      hidden: !0,
      radio: !0,
      reset: !0,
      submit: !0
    }, Xf = RegExp(
      "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
    ), Ap = {}, Lh = {}, Xh = /[\n"\\]/g, Op = !1, Vg = !1, Mr = !1, l = !1, n = !1, u = !1, c = ["value", "defaultValue"], s = !1, r = /["'&<>\n\t]|^\s|\s$/, m = "address applet area article aside base basefont bgsound blockquote body br button caption center col colgroup dd details dir div dl dt embed fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hgroup hr html iframe img input isindex li link listing main marquee menu menuitem meta nav noembed noframes noscript object ol p param plaintext pre script section select source style summary table tbody td template textarea tfoot th thead title tr track ul wbr xmp".split(
      " "
    ), v = "applet caption html table td th marquee object template foreignObject desc title".split(
      " "
    ), A = v.concat(["button"]), w = "dd dt li option optgroup p rp rt".split(" "), Q = {
      current: null,
      formTag: null,
      aTagInScope: null,
      buttonTagInScope: null,
      nobrTagInScope: null,
      pTagInButtonScope: null,
      listItemTagAutoclosing: null,
      dlItemTagAutoclosing: null,
      containerTagInScope: null,
      implicitRootScope: !1
    }, W = {}, Y = {
      animation: "animationDelay animationDirection animationDuration animationFillMode animationIterationCount animationName animationPlayState animationTimingFunction".split(
        " "
      ),
      background: "backgroundAttachment backgroundClip backgroundColor backgroundImage backgroundOrigin backgroundPositionX backgroundPositionY backgroundRepeat backgroundSize".split(
        " "
      ),
      backgroundPosition: ["backgroundPositionX", "backgroundPositionY"],
      border: "borderBottomColor borderBottomStyle borderBottomWidth borderImageOutset borderImageRepeat borderImageSlice borderImageSource borderImageWidth borderLeftColor borderLeftStyle borderLeftWidth borderRightColor borderRightStyle borderRightWidth borderTopColor borderTopStyle borderTopWidth".split(
        " "
      ),
      borderBlockEnd: [
        "borderBlockEndColor",
        "borderBlockEndStyle",
        "borderBlockEndWidth"
      ],
      borderBlockStart: [
        "borderBlockStartColor",
        "borderBlockStartStyle",
        "borderBlockStartWidth"
      ],
      borderBottom: [
        "borderBottomColor",
        "borderBottomStyle",
        "borderBottomWidth"
      ],
      borderColor: [
        "borderBottomColor",
        "borderLeftColor",
        "borderRightColor",
        "borderTopColor"
      ],
      borderImage: [
        "borderImageOutset",
        "borderImageRepeat",
        "borderImageSlice",
        "borderImageSource",
        "borderImageWidth"
      ],
      borderInlineEnd: [
        "borderInlineEndColor",
        "borderInlineEndStyle",
        "borderInlineEndWidth"
      ],
      borderInlineStart: [
        "borderInlineStartColor",
        "borderInlineStartStyle",
        "borderInlineStartWidth"
      ],
      borderLeft: ["borderLeftColor", "borderLeftStyle", "borderLeftWidth"],
      borderRadius: [
        "borderBottomLeftRadius",
        "borderBottomRightRadius",
        "borderTopLeftRadius",
        "borderTopRightRadius"
      ],
      borderRight: [
        "borderRightColor",
        "borderRightStyle",
        "borderRightWidth"
      ],
      borderStyle: [
        "borderBottomStyle",
        "borderLeftStyle",
        "borderRightStyle",
        "borderTopStyle"
      ],
      borderTop: ["borderTopColor", "borderTopStyle", "borderTopWidth"],
      borderWidth: [
        "borderBottomWidth",
        "borderLeftWidth",
        "borderRightWidth",
        "borderTopWidth"
      ],
      columnRule: ["columnRuleColor", "columnRuleStyle", "columnRuleWidth"],
      columns: ["columnCount", "columnWidth"],
      flex: ["flexBasis", "flexGrow", "flexShrink"],
      flexFlow: ["flexDirection", "flexWrap"],
      font: "fontFamily fontFeatureSettings fontKerning fontLanguageOverride fontSize fontSizeAdjust fontStretch fontStyle fontVariant fontVariantAlternates fontVariantCaps fontVariantEastAsian fontVariantLigatures fontVariantNumeric fontVariantPosition fontWeight lineHeight".split(
        " "
      ),
      fontVariant: "fontVariantAlternates fontVariantCaps fontVariantEastAsian fontVariantLigatures fontVariantNumeric fontVariantPosition".split(
        " "
      ),
      gap: ["columnGap", "rowGap"],
      grid: "gridAutoColumns gridAutoFlow gridAutoRows gridTemplateAreas gridTemplateColumns gridTemplateRows".split(
        " "
      ),
      gridArea: [
        "gridColumnEnd",
        "gridColumnStart",
        "gridRowEnd",
        "gridRowStart"
      ],
      gridColumn: ["gridColumnEnd", "gridColumnStart"],
      gridColumnGap: ["columnGap"],
      gridGap: ["columnGap", "rowGap"],
      gridRow: ["gridRowEnd", "gridRowStart"],
      gridRowGap: ["rowGap"],
      gridTemplate: [
        "gridTemplateAreas",
        "gridTemplateColumns",
        "gridTemplateRows"
      ],
      listStyle: ["listStyleImage", "listStylePosition", "listStyleType"],
      margin: ["marginBottom", "marginLeft", "marginRight", "marginTop"],
      marker: ["markerEnd", "markerMid", "markerStart"],
      mask: "maskClip maskComposite maskImage maskMode maskOrigin maskPositionX maskPositionY maskRepeat maskSize".split(
        " "
      ),
      maskPosition: ["maskPositionX", "maskPositionY"],
      outline: ["outlineColor", "outlineStyle", "outlineWidth"],
      overflow: ["overflowX", "overflowY"],
      padding: ["paddingBottom", "paddingLeft", "paddingRight", "paddingTop"],
      placeContent: ["alignContent", "justifyContent"],
      placeItems: ["alignItems", "justifyItems"],
      placeSelf: ["alignSelf", "justifySelf"],
      textDecoration: [
        "textDecorationColor",
        "textDecorationLine",
        "textDecorationStyle"
      ],
      textEmphasis: ["textEmphasisColor", "textEmphasisStyle"],
      transition: [
        "transitionDelay",
        "transitionDuration",
        "transitionProperty",
        "transitionTimingFunction"
      ],
      wordWrap: ["overflowWrap"]
    }, X = /([A-Z])/g, ye = /^ms-/, He = /^(?:webkit|moz|o)[A-Z]/, jt = /^-ms-/, N = /-(.)/g, D = /;\s*$/, H = {}, $ = {}, _e = !1, yt = !1, Ee = new Set(
      "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
        " "
      )
    ), Ke = "http://www.w3.org/1998/Math/MathML", Ie = "http://www.w3.org/2000/svg", St = /* @__PURE__ */ new Map([
      ["acceptCharset", "accept-charset"],
      ["htmlFor", "for"],
      ["httpEquiv", "http-equiv"],
      ["crossOrigin", "crossorigin"],
      ["accentHeight", "accent-height"],
      ["alignmentBaseline", "alignment-baseline"],
      ["arabicForm", "arabic-form"],
      ["baselineShift", "baseline-shift"],
      ["capHeight", "cap-height"],
      ["clipPath", "clip-path"],
      ["clipRule", "clip-rule"],
      ["colorInterpolation", "color-interpolation"],
      ["colorInterpolationFilters", "color-interpolation-filters"],
      ["colorProfile", "color-profile"],
      ["colorRendering", "color-rendering"],
      ["dominantBaseline", "dominant-baseline"],
      ["enableBackground", "enable-background"],
      ["fillOpacity", "fill-opacity"],
      ["fillRule", "fill-rule"],
      ["floodColor", "flood-color"],
      ["floodOpacity", "flood-opacity"],
      ["fontFamily", "font-family"],
      ["fontSize", "font-size"],
      ["fontSizeAdjust", "font-size-adjust"],
      ["fontStretch", "font-stretch"],
      ["fontStyle", "font-style"],
      ["fontVariant", "font-variant"],
      ["fontWeight", "font-weight"],
      ["glyphName", "glyph-name"],
      ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
      ["glyphOrientationVertical", "glyph-orientation-vertical"],
      ["horizAdvX", "horiz-adv-x"],
      ["horizOriginX", "horiz-origin-x"],
      ["imageRendering", "image-rendering"],
      ["letterSpacing", "letter-spacing"],
      ["lightingColor", "lighting-color"],
      ["markerEnd", "marker-end"],
      ["markerMid", "marker-mid"],
      ["markerStart", "marker-start"],
      ["overlinePosition", "overline-position"],
      ["overlineThickness", "overline-thickness"],
      ["paintOrder", "paint-order"],
      ["panose-1", "panose-1"],
      ["pointerEvents", "pointer-events"],
      ["renderingIntent", "rendering-intent"],
      ["shapeRendering", "shape-rendering"],
      ["stopColor", "stop-color"],
      ["stopOpacity", "stop-opacity"],
      ["strikethroughPosition", "strikethrough-position"],
      ["strikethroughThickness", "strikethrough-thickness"],
      ["strokeDasharray", "stroke-dasharray"],
      ["strokeDashoffset", "stroke-dashoffset"],
      ["strokeLinecap", "stroke-linecap"],
      ["strokeLinejoin", "stroke-linejoin"],
      ["strokeMiterlimit", "stroke-miterlimit"],
      ["strokeOpacity", "stroke-opacity"],
      ["strokeWidth", "stroke-width"],
      ["textAnchor", "text-anchor"],
      ["textDecoration", "text-decoration"],
      ["textRendering", "text-rendering"],
      ["transformOrigin", "transform-origin"],
      ["underlinePosition", "underline-position"],
      ["underlineThickness", "underline-thickness"],
      ["unicodeBidi", "unicode-bidi"],
      ["unicodeRange", "unicode-range"],
      ["unitsPerEm", "units-per-em"],
      ["vAlphabetic", "v-alphabetic"],
      ["vHanging", "v-hanging"],
      ["vIdeographic", "v-ideographic"],
      ["vMathematical", "v-mathematical"],
      ["vectorEffect", "vector-effect"],
      ["vertAdvY", "vert-adv-y"],
      ["vertOriginX", "vert-origin-x"],
      ["vertOriginY", "vert-origin-y"],
      ["wordSpacing", "word-spacing"],
      ["writingMode", "writing-mode"],
      ["xmlnsXlink", "xmlns:xlink"],
      ["xHeight", "x-height"]
    ]), tu = {
      accept: "accept",
      acceptcharset: "acceptCharset",
      "accept-charset": "acceptCharset",
      accesskey: "accessKey",
      action: "action",
      allowfullscreen: "allowFullScreen",
      alt: "alt",
      as: "as",
      async: "async",
      autocapitalize: "autoCapitalize",
      autocomplete: "autoComplete",
      autocorrect: "autoCorrect",
      autofocus: "autoFocus",
      autoplay: "autoPlay",
      autosave: "autoSave",
      capture: "capture",
      cellpadding: "cellPadding",
      cellspacing: "cellSpacing",
      challenge: "challenge",
      charset: "charSet",
      checked: "checked",
      children: "children",
      cite: "cite",
      class: "className",
      classid: "classID",
      classname: "className",
      cols: "cols",
      colspan: "colSpan",
      content: "content",
      contenteditable: "contentEditable",
      contextmenu: "contextMenu",
      controls: "controls",
      controlslist: "controlsList",
      coords: "coords",
      crossorigin: "crossOrigin",
      dangerouslysetinnerhtml: "dangerouslySetInnerHTML",
      data: "data",
      datetime: "dateTime",
      default: "default",
      defaultchecked: "defaultChecked",
      defaultvalue: "defaultValue",
      defer: "defer",
      dir: "dir",
      disabled: "disabled",
      disablepictureinpicture: "disablePictureInPicture",
      disableremoteplayback: "disableRemotePlayback",
      download: "download",
      draggable: "draggable",
      enctype: "encType",
      enterkeyhint: "enterKeyHint",
      fetchpriority: "fetchPriority",
      for: "htmlFor",
      form: "form",
      formmethod: "formMethod",
      formaction: "formAction",
      formenctype: "formEncType",
      formnovalidate: "formNoValidate",
      formtarget: "formTarget",
      frameborder: "frameBorder",
      headers: "headers",
      height: "height",
      hidden: "hidden",
      high: "high",
      href: "href",
      hreflang: "hrefLang",
      htmlfor: "htmlFor",
      httpequiv: "httpEquiv",
      "http-equiv": "httpEquiv",
      icon: "icon",
      id: "id",
      imagesizes: "imageSizes",
      imagesrcset: "imageSrcSet",
      inert: "inert",
      innerhtml: "innerHTML",
      inputmode: "inputMode",
      integrity: "integrity",
      is: "is",
      itemid: "itemID",
      itemprop: "itemProp",
      itemref: "itemRef",
      itemscope: "itemScope",
      itemtype: "itemType",
      keyparams: "keyParams",
      keytype: "keyType",
      kind: "kind",
      label: "label",
      lang: "lang",
      list: "list",
      loop: "loop",
      low: "low",
      manifest: "manifest",
      marginwidth: "marginWidth",
      marginheight: "marginHeight",
      max: "max",
      maxlength: "maxLength",
      media: "media",
      mediagroup: "mediaGroup",
      method: "method",
      min: "min",
      minlength: "minLength",
      multiple: "multiple",
      muted: "muted",
      name: "name",
      nomodule: "noModule",
      nonce: "nonce",
      novalidate: "noValidate",
      open: "open",
      optimum: "optimum",
      pattern: "pattern",
      placeholder: "placeholder",
      playsinline: "playsInline",
      poster: "poster",
      preload: "preload",
      profile: "profile",
      radiogroup: "radioGroup",
      readonly: "readOnly",
      referrerpolicy: "referrerPolicy",
      rel: "rel",
      required: "required",
      reversed: "reversed",
      role: "role",
      rows: "rows",
      rowspan: "rowSpan",
      sandbox: "sandbox",
      scope: "scope",
      scoped: "scoped",
      scrolling: "scrolling",
      seamless: "seamless",
      selected: "selected",
      shape: "shape",
      size: "size",
      sizes: "sizes",
      span: "span",
      spellcheck: "spellCheck",
      src: "src",
      srcdoc: "srcDoc",
      srclang: "srcLang",
      srcset: "srcSet",
      start: "start",
      step: "step",
      style: "style",
      summary: "summary",
      tabindex: "tabIndex",
      target: "target",
      title: "title",
      type: "type",
      usemap: "useMap",
      value: "value",
      width: "width",
      wmode: "wmode",
      wrap: "wrap",
      about: "about",
      accentheight: "accentHeight",
      "accent-height": "accentHeight",
      accumulate: "accumulate",
      additive: "additive",
      alignmentbaseline: "alignmentBaseline",
      "alignment-baseline": "alignmentBaseline",
      allowreorder: "allowReorder",
      alphabetic: "alphabetic",
      amplitude: "amplitude",
      arabicform: "arabicForm",
      "arabic-form": "arabicForm",
      ascent: "ascent",
      attributename: "attributeName",
      attributetype: "attributeType",
      autoreverse: "autoReverse",
      azimuth: "azimuth",
      basefrequency: "baseFrequency",
      baselineshift: "baselineShift",
      "baseline-shift": "baselineShift",
      baseprofile: "baseProfile",
      bbox: "bbox",
      begin: "begin",
      bias: "bias",
      by: "by",
      calcmode: "calcMode",
      capheight: "capHeight",
      "cap-height": "capHeight",
      clip: "clip",
      clippath: "clipPath",
      "clip-path": "clipPath",
      clippathunits: "clipPathUnits",
      cliprule: "clipRule",
      "clip-rule": "clipRule",
      color: "color",
      colorinterpolation: "colorInterpolation",
      "color-interpolation": "colorInterpolation",
      colorinterpolationfilters: "colorInterpolationFilters",
      "color-interpolation-filters": "colorInterpolationFilters",
      colorprofile: "colorProfile",
      "color-profile": "colorProfile",
      colorrendering: "colorRendering",
      "color-rendering": "colorRendering",
      contentscripttype: "contentScriptType",
      contentstyletype: "contentStyleType",
      cursor: "cursor",
      cx: "cx",
      cy: "cy",
      d: "d",
      datatype: "datatype",
      decelerate: "decelerate",
      descent: "descent",
      diffuseconstant: "diffuseConstant",
      direction: "direction",
      display: "display",
      divisor: "divisor",
      dominantbaseline: "dominantBaseline",
      "dominant-baseline": "dominantBaseline",
      dur: "dur",
      dx: "dx",
      dy: "dy",
      edgemode: "edgeMode",
      elevation: "elevation",
      enablebackground: "enableBackground",
      "enable-background": "enableBackground",
      end: "end",
      exponent: "exponent",
      externalresourcesrequired: "externalResourcesRequired",
      fill: "fill",
      fillopacity: "fillOpacity",
      "fill-opacity": "fillOpacity",
      fillrule: "fillRule",
      "fill-rule": "fillRule",
      filter: "filter",
      filterres: "filterRes",
      filterunits: "filterUnits",
      floodopacity: "floodOpacity",
      "flood-opacity": "floodOpacity",
      floodcolor: "floodColor",
      "flood-color": "floodColor",
      focusable: "focusable",
      fontfamily: "fontFamily",
      "font-family": "fontFamily",
      fontsize: "fontSize",
      "font-size": "fontSize",
      fontsizeadjust: "fontSizeAdjust",
      "font-size-adjust": "fontSizeAdjust",
      fontstretch: "fontStretch",
      "font-stretch": "fontStretch",
      fontstyle: "fontStyle",
      "font-style": "fontStyle",
      fontvariant: "fontVariant",
      "font-variant": "fontVariant",
      fontweight: "fontWeight",
      "font-weight": "fontWeight",
      format: "format",
      from: "from",
      fx: "fx",
      fy: "fy",
      g1: "g1",
      g2: "g2",
      glyphname: "glyphName",
      "glyph-name": "glyphName",
      glyphorientationhorizontal: "glyphOrientationHorizontal",
      "glyph-orientation-horizontal": "glyphOrientationHorizontal",
      glyphorientationvertical: "glyphOrientationVertical",
      "glyph-orientation-vertical": "glyphOrientationVertical",
      glyphref: "glyphRef",
      gradienttransform: "gradientTransform",
      gradientunits: "gradientUnits",
      hanging: "hanging",
      horizadvx: "horizAdvX",
      "horiz-adv-x": "horizAdvX",
      horizoriginx: "horizOriginX",
      "horiz-origin-x": "horizOriginX",
      ideographic: "ideographic",
      imagerendering: "imageRendering",
      "image-rendering": "imageRendering",
      in2: "in2",
      in: "in",
      inlist: "inlist",
      intercept: "intercept",
      k1: "k1",
      k2: "k2",
      k3: "k3",
      k4: "k4",
      k: "k",
      kernelmatrix: "kernelMatrix",
      kernelunitlength: "kernelUnitLength",
      kerning: "kerning",
      keypoints: "keyPoints",
      keysplines: "keySplines",
      keytimes: "keyTimes",
      lengthadjust: "lengthAdjust",
      letterspacing: "letterSpacing",
      "letter-spacing": "letterSpacing",
      lightingcolor: "lightingColor",
      "lighting-color": "lightingColor",
      limitingconeangle: "limitingConeAngle",
      local: "local",
      markerend: "markerEnd",
      "marker-end": "markerEnd",
      markerheight: "markerHeight",
      markermid: "markerMid",
      "marker-mid": "markerMid",
      markerstart: "markerStart",
      "marker-start": "markerStart",
      markerunits: "markerUnits",
      markerwidth: "markerWidth",
      mask: "mask",
      maskcontentunits: "maskContentUnits",
      maskunits: "maskUnits",
      mathematical: "mathematical",
      mode: "mode",
      numoctaves: "numOctaves",
      offset: "offset",
      opacity: "opacity",
      operator: "operator",
      order: "order",
      orient: "orient",
      orientation: "orientation",
      origin: "origin",
      overflow: "overflow",
      overlineposition: "overlinePosition",
      "overline-position": "overlinePosition",
      overlinethickness: "overlineThickness",
      "overline-thickness": "overlineThickness",
      paintorder: "paintOrder",
      "paint-order": "paintOrder",
      panose1: "panose1",
      "panose-1": "panose1",
      pathlength: "pathLength",
      patterncontentunits: "patternContentUnits",
      patterntransform: "patternTransform",
      patternunits: "patternUnits",
      pointerevents: "pointerEvents",
      "pointer-events": "pointerEvents",
      points: "points",
      pointsatx: "pointsAtX",
      pointsaty: "pointsAtY",
      pointsatz: "pointsAtZ",
      popover: "popover",
      popovertarget: "popoverTarget",
      popovertargetaction: "popoverTargetAction",
      prefix: "prefix",
      preservealpha: "preserveAlpha",
      preserveaspectratio: "preserveAspectRatio",
      primitiveunits: "primitiveUnits",
      property: "property",
      r: "r",
      radius: "radius",
      refx: "refX",
      refy: "refY",
      renderingintent: "renderingIntent",
      "rendering-intent": "renderingIntent",
      repeatcount: "repeatCount",
      repeatdur: "repeatDur",
      requiredextensions: "requiredExtensions",
      requiredfeatures: "requiredFeatures",
      resource: "resource",
      restart: "restart",
      result: "result",
      results: "results",
      rotate: "rotate",
      rx: "rx",
      ry: "ry",
      scale: "scale",
      security: "security",
      seed: "seed",
      shaperendering: "shapeRendering",
      "shape-rendering": "shapeRendering",
      slope: "slope",
      spacing: "spacing",
      specularconstant: "specularConstant",
      specularexponent: "specularExponent",
      speed: "speed",
      spreadmethod: "spreadMethod",
      startoffset: "startOffset",
      stddeviation: "stdDeviation",
      stemh: "stemh",
      stemv: "stemv",
      stitchtiles: "stitchTiles",
      stopcolor: "stopColor",
      "stop-color": "stopColor",
      stopopacity: "stopOpacity",
      "stop-opacity": "stopOpacity",
      strikethroughposition: "strikethroughPosition",
      "strikethrough-position": "strikethroughPosition",
      strikethroughthickness: "strikethroughThickness",
      "strikethrough-thickness": "strikethroughThickness",
      string: "string",
      stroke: "stroke",
      strokedasharray: "strokeDasharray",
      "stroke-dasharray": "strokeDasharray",
      strokedashoffset: "strokeDashoffset",
      "stroke-dashoffset": "strokeDashoffset",
      strokelinecap: "strokeLinecap",
      "stroke-linecap": "strokeLinecap",
      strokelinejoin: "strokeLinejoin",
      "stroke-linejoin": "strokeLinejoin",
      strokemiterlimit: "strokeMiterlimit",
      "stroke-miterlimit": "strokeMiterlimit",
      strokewidth: "strokeWidth",
      "stroke-width": "strokeWidth",
      strokeopacity: "strokeOpacity",
      "stroke-opacity": "strokeOpacity",
      suppresscontenteditablewarning: "suppressContentEditableWarning",
      suppresshydrationwarning: "suppressHydrationWarning",
      surfacescale: "surfaceScale",
      systemlanguage: "systemLanguage",
      tablevalues: "tableValues",
      targetx: "targetX",
      targety: "targetY",
      textanchor: "textAnchor",
      "text-anchor": "textAnchor",
      textdecoration: "textDecoration",
      "text-decoration": "textDecoration",
      textlength: "textLength",
      textrendering: "textRendering",
      "text-rendering": "textRendering",
      to: "to",
      transform: "transform",
      transformorigin: "transformOrigin",
      "transform-origin": "transformOrigin",
      typeof: "typeof",
      u1: "u1",
      u2: "u2",
      underlineposition: "underlinePosition",
      "underline-position": "underlinePosition",
      underlinethickness: "underlineThickness",
      "underline-thickness": "underlineThickness",
      unicode: "unicode",
      unicodebidi: "unicodeBidi",
      "unicode-bidi": "unicodeBidi",
      unicoderange: "unicodeRange",
      "unicode-range": "unicodeRange",
      unitsperem: "unitsPerEm",
      "units-per-em": "unitsPerEm",
      unselectable: "unselectable",
      valphabetic: "vAlphabetic",
      "v-alphabetic": "vAlphabetic",
      values: "values",
      vectoreffect: "vectorEffect",
      "vector-effect": "vectorEffect",
      version: "version",
      vertadvy: "vertAdvY",
      "vert-adv-y": "vertAdvY",
      vertoriginx: "vertOriginX",
      "vert-origin-x": "vertOriginX",
      vertoriginy: "vertOriginY",
      "vert-origin-y": "vertOriginY",
      vhanging: "vHanging",
      "v-hanging": "vHanging",
      videographic: "vIdeographic",
      "v-ideographic": "vIdeographic",
      viewbox: "viewBox",
      viewtarget: "viewTarget",
      visibility: "visibility",
      vmathematical: "vMathematical",
      "v-mathematical": "vMathematical",
      vocab: "vocab",
      widths: "widths",
      wordspacing: "wordSpacing",
      "word-spacing": "wordSpacing",
      writingmode: "writingMode",
      "writing-mode": "writingMode",
      x1: "x1",
      x2: "x2",
      x: "x",
      xchannelselector: "xChannelSelector",
      xheight: "xHeight",
      "x-height": "xHeight",
      xlinkactuate: "xlinkActuate",
      "xlink:actuate": "xlinkActuate",
      xlinkarcrole: "xlinkArcrole",
      "xlink:arcrole": "xlinkArcrole",
      xlinkhref: "xlinkHref",
      "xlink:href": "xlinkHref",
      xlinkrole: "xlinkRole",
      "xlink:role": "xlinkRole",
      xlinkshow: "xlinkShow",
      "xlink:show": "xlinkShow",
      xlinktitle: "xlinkTitle",
      "xlink:title": "xlinkTitle",
      xlinktype: "xlinkType",
      "xlink:type": "xlinkType",
      xmlbase: "xmlBase",
      "xml:base": "xmlBase",
      xmllang: "xmlLang",
      "xml:lang": "xmlLang",
      xmlns: "xmlns",
      "xml:space": "xmlSpace",
      xmlnsxlink: "xmlnsXlink",
      "xmlns:xlink": "xmlnsXlink",
      xmlspace: "xmlSpace",
      y1: "y1",
      y2: "y2",
      y: "y",
      ychannelselector: "yChannelSelector",
      z: "z",
      zoomandpan: "zoomAndPan"
    }, Zg = {
      "aria-current": 0,
      "aria-description": 0,
      "aria-details": 0,
      "aria-disabled": 0,
      "aria-hidden": 0,
      "aria-invalid": 0,
      "aria-keyshortcuts": 0,
      "aria-label": 0,
      "aria-roledescription": 0,
      "aria-autocomplete": 0,
      "aria-checked": 0,
      "aria-expanded": 0,
      "aria-haspopup": 0,
      "aria-level": 0,
      "aria-modal": 0,
      "aria-multiline": 0,
      "aria-multiselectable": 0,
      "aria-orientation": 0,
      "aria-placeholder": 0,
      "aria-pressed": 0,
      "aria-readonly": 0,
      "aria-required": 0,
      "aria-selected": 0,
      "aria-sort": 0,
      "aria-valuemax": 0,
      "aria-valuemin": 0,
      "aria-valuenow": 0,
      "aria-valuetext": 0,
      "aria-atomic": 0,
      "aria-busy": 0,
      "aria-live": 0,
      "aria-relevant": 0,
      "aria-dropeffect": 0,
      "aria-grabbed": 0,
      "aria-activedescendant": 0,
      "aria-colcount": 0,
      "aria-colindex": 0,
      "aria-colspan": 0,
      "aria-controls": 0,
      "aria-describedby": 0,
      "aria-errormessage": 0,
      "aria-flowto": 0,
      "aria-labelledby": 0,
      "aria-owns": 0,
      "aria-posinset": 0,
      "aria-rowcount": 0,
      "aria-rowindex": 0,
      "aria-rowspan": 0,
      "aria-setsize": 0,
      "aria-braillelabel": 0,
      "aria-brailleroledescription": 0,
      "aria-colindextext": 0,
      "aria-rowindextext": 0
    }, Qh = {}, lE = RegExp(
      "^(aria)-[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
    ), aE = RegExp(
      "^(aria)[A-Z][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
    ), Eb = !1, cn = {}, Tb = /^on./, nE = /^on[^A-Z]/, uE = RegExp(
      "^(aria)-[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
    ), iE = RegExp(
      "^(aria)[A-Z][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
    ), cE = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i, zp = null, Vh = null, Zh = null, f1 = !1, mc = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), s1 = !1;
    if (mc)
      try {
        var Dp = {};
        Object.defineProperty(Dp, "passive", {
          get: function() {
            s1 = !0;
          }
        }), window.addEventListener("test", Dp, Dp), window.removeEventListener("test", Dp, Dp);
      } catch {
        s1 = !1;
      }
    var Qf = null, r1 = null, Jg = null, Cr = {
      eventPhase: 0,
      bubbles: 0,
      cancelable: 0,
      timeStamp: function(e) {
        return e.timeStamp || Date.now();
      },
      defaultPrevented: 0,
      isTrusted: 0
    }, Kg = Hl(Cr), _p = et({}, Cr, { view: 0, detail: 0 }), oE = Hl(_p), d1, h1, Rp, $g = et({}, _p, {
      screenX: 0,
      screenY: 0,
      clientX: 0,
      clientY: 0,
      pageX: 0,
      pageY: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      getModifierState: Ss,
      button: 0,
      buttons: 0,
      relatedTarget: function(e) {
        return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
      },
      movementX: function(e) {
        return "movementX" in e ? e.movementX : (e !== Rp && (Rp && e.type === "mousemove" ? (d1 = e.screenX - Rp.screenX, h1 = e.screenY - Rp.screenY) : h1 = d1 = 0, Rp = e), d1);
      },
      movementY: function(e) {
        return "movementY" in e ? e.movementY : h1;
      }
    }), Ab = Hl($g), fE = et({}, $g, { dataTransfer: 0 }), sE = Hl(fE), rE = et({}, _p, { relatedTarget: 0 }), m1 = Hl(rE), dE = et({}, Cr, {
      animationName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    }), hE = Hl(dE), mE = et({}, Cr, {
      clipboardData: function(e) {
        return "clipboardData" in e ? e.clipboardData : window.clipboardData;
      }
    }), yE = Hl(mE), pE = et({}, Cr, { data: 0 }), Ob = Hl(
      pE
    ), gE = Ob, vE = {
      Esc: "Escape",
      Spacebar: " ",
      Left: "ArrowLeft",
      Up: "ArrowUp",
      Right: "ArrowRight",
      Down: "ArrowDown",
      Del: "Delete",
      Win: "OS",
      Menu: "ContextMenu",
      Apps: "ContextMenu",
      Scroll: "ScrollLock",
      MozPrintableKey: "Unidentified"
    }, bE = {
      8: "Backspace",
      9: "Tab",
      12: "Clear",
      13: "Enter",
      16: "Shift",
      17: "Control",
      18: "Alt",
      19: "Pause",
      20: "CapsLock",
      27: "Escape",
      32: " ",
      33: "PageUp",
      34: "PageDown",
      35: "End",
      36: "Home",
      37: "ArrowLeft",
      38: "ArrowUp",
      39: "ArrowRight",
      40: "ArrowDown",
      45: "Insert",
      46: "Delete",
      112: "F1",
      113: "F2",
      114: "F3",
      115: "F4",
      116: "F5",
      117: "F6",
      118: "F7",
      119: "F8",
      120: "F9",
      121: "F10",
      122: "F11",
      123: "F12",
      144: "NumLock",
      145: "ScrollLock",
      224: "Meta"
    }, SE = {
      Alt: "altKey",
      Control: "ctrlKey",
      Meta: "metaKey",
      Shift: "shiftKey"
    }, EE = et({}, _p, {
      key: function(e) {
        if (e.key) {
          var t = vE[e.key] || e.key;
          if (t !== "Unidentified") return t;
        }
        return e.type === "keypress" ? (e = bs(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? bE[e.keyCode] || "Unidentified" : "";
      },
      code: 0,
      location: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      repeat: 0,
      locale: 0,
      getModifierState: Ss,
      charCode: function(e) {
        return e.type === "keypress" ? bs(e) : 0;
      },
      keyCode: function(e) {
        return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
      },
      which: function(e) {
        return e.type === "keypress" ? bs(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
      }
    }), TE = Hl(EE), AE = et({}, $g, {
      pointerId: 0,
      width: 0,
      height: 0,
      pressure: 0,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      pointerType: 0,
      isPrimary: 0
    }), zb = Hl(AE), OE = et({}, _p, {
      touches: 0,
      targetTouches: 0,
      changedTouches: 0,
      altKey: 0,
      metaKey: 0,
      ctrlKey: 0,
      shiftKey: 0,
      getModifierState: Ss
    }), zE = Hl(OE), DE = et({}, Cr, {
      propertyName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    }), _E = Hl(DE), RE = et({}, $g, {
      deltaX: function(e) {
        return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
      },
      deltaY: function(e) {
        return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
      },
      deltaZ: 0,
      deltaMode: 0
    }), ME = Hl(RE), CE = et({}, Cr, {
      newState: 0,
      oldState: 0
    }), xE = Hl(CE), UE = [9, 13, 27, 32], Db = 229, y1 = mc && "CompositionEvent" in window, Mp = null;
    mc && "documentMode" in document && (Mp = document.documentMode);
    var NE = mc && "TextEvent" in window && !Mp, _b = mc && (!y1 || Mp && 8 < Mp && 11 >= Mp), Rb = 32, Mb = String.fromCharCode(Rb), Cb = !1, Jh = !1, HE = {
      color: !0,
      date: !0,
      datetime: !0,
      "datetime-local": !0,
      email: !0,
      month: !0,
      number: !0,
      password: !0,
      range: !0,
      search: !0,
      tel: !0,
      text: !0,
      time: !0,
      url: !0,
      week: !0
    }, Cp = null, xp = null, xb = !1;
    mc && (xb = hd("input") && (!document.documentMode || 9 < document.documentMode));
    var on = typeof Object.is == "function" ? Object.is : md, jE = mc && "documentMode" in document && 11 >= document.documentMode, Kh = null, p1 = null, Up = null, g1 = !1, $h = {
      animationend: Rc("Animation", "AnimationEnd"),
      animationiteration: Rc("Animation", "AnimationIteration"),
      animationstart: Rc("Animation", "AnimationStart"),
      transitionrun: Rc("Transition", "TransitionRun"),
      transitionstart: Rc("Transition", "TransitionStart"),
      transitioncancel: Rc("Transition", "TransitionCancel"),
      transitionend: Rc("Transition", "TransitionEnd")
    }, v1 = {}, Ub = {};
    mc && (Ub = document.createElement("div").style, "AnimationEvent" in window || (delete $h.animationend.animation, delete $h.animationiteration.animation, delete $h.animationstart.animation), "TransitionEvent" in window || delete $h.transitionend.transition);
    var Nb = Mc("animationend"), Hb = Mc("animationiteration"), jb = Mc("animationstart"), wE = Mc("transitionrun"), BE = Mc("transitionstart"), YE = Mc("transitioncancel"), wb = Mc("transitionend"), Bb = /* @__PURE__ */ new Map(), b1 = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
      " "
    );
    b1.push("scrollEnd");
    var Yb = 0;
    if (typeof performance == "object" && typeof performance.now == "function")
      var qE = performance, qb = function() {
        return qE.now();
      };
    else {
      var GE = Date;
      qb = function() {
        return GE.now();
      };
    }
    var S1 = typeof reportError == "function" ? reportError : function(e) {
      if (typeof window == "object" && typeof window.ErrorEvent == "function") {
        var t = new window.ErrorEvent("error", {
          bubbles: !0,
          cancelable: !0,
          message: typeof e == "object" && e !== null && typeof e.message == "string" ? String(e.message) : String(e),
          error: e
        });
        if (!window.dispatchEvent(t)) return;
      } else if (typeof process == "object" && typeof process.emit == "function") {
        process.emit("uncaughtException", e);
        return;
      }
      console.error(e);
    }, LE = "This object has been omitted by React in the console log to avoid sending too much data from the server. Try logging smaller or more specific objects.", kg = 0, E1 = 1, T1 = 2, A1 = 3, Wg = "– ", Fg = "+ ", Gb = "  ", tl = typeof console < "u" && typeof console.timeStamp == "function" && typeof performance < "u" && typeof performance.measure == "function", Lu = "Components ⚛", rt = "Scheduler ⚛", ht = "Blocking", Vf = !1, yo = {
      color: "primary",
      properties: null,
      tooltipText: "",
      track: Lu
    }, Zf = {
      start: -0,
      end: -0,
      detail: { devtools: yo }
    }, XE = ["Changed Props", ""], Lb = "This component received deeply equal props. It might benefit from useMemo or the React Compiler in its owner.", QE = ["Changed Props", Lb], Np = 1, po = 2, Xu = [], kh = 0, O1 = 0, Jf = {};
    Object.freeze(Jf);
    var Qu = null, Wh = null, qe = 0, VE = 1, tt = 2, wa = 8, Ti = 16, ZE = 32, Xb = !1;
    try {
      var Qb = Object.preventExtensions({});
    } catch {
      Xb = !0;
    }
    var z1 = /* @__PURE__ */ new WeakMap(), Fh = [], Ih = 0, Ig = null, Hp = 0, Vu = [], Zu = 0, xr = null, go = 1, vo = "", _a = null, ll = null, st = !1, yc = !1, lu = null, Kf = null, Ju = !1, D1 = Error(
      "Hydration Mismatch Exception: This is not a real error, and should not leak into userspace. If you're seeing this, it's likely a bug in React."
    ), _1 = Yt(null), R1 = Yt(null), Vb = {}, Pg = null, Ph = null, em = !1, JE = typeof AbortController < "u" ? AbortController : function() {
      var e = [], t = this.signal = {
        aborted: !1,
        addEventListener: function(a, i) {
          e.push(i);
        }
      };
      this.abort = function() {
        t.aborted = !0, e.forEach(function(a) {
          return a();
        });
      };
    }, KE = vl.unstable_scheduleCallback, $E = vl.unstable_NormalPriority, Xl = {
      $$typeof: Pn,
      Consumer: null,
      Provider: null,
      _currentValue: null,
      _currentValue2: null,
      _threadCount: 0,
      _currentRenderer: null,
      _currentRenderer2: null
    }, Ql = vl.unstable_now, ev = console.createTask ? console.createTask : function() {
      return null;
    }, jp = 1, tv = 2, oa = -0, $f = -0, bo = -0, So = null, fn = -1.1, Ur = -0, dl = -0, Ce = -1.1, Be = -1.1, ol = null, bl = !1, Nr = -0, pc = -1.1, wp = null, kf = 0, M1 = null, C1 = null, Hr = -1.1, Bp = null, tm = -1.1, lv = -1.1, Eo = -0, To = -1.1, Ku = -1.1, x1 = 0, Yp = null, Zb = null, Jb = null, Wf = -1.1, jr = null, Ff = -1.1, av = -1.1, Kb = -0, $b = -0, nv = 0, kE = null, kb = 0, qp = -1.1, uv = !1, iv = !1, Gp = null, U1 = 0, wr = 0, lm = null, Wb = L.S;
    L.S = function(e, t) {
      if (ZS = Ll(), typeof t == "object" && t !== null && typeof t.then == "function") {
        if (0 > To && 0 > Ku) {
          To = Ql();
          var a = Of(), i = ju();
          (a !== Ff || i !== jr) && (Ff = -1.1), Wf = a, jr = i;
        }
        ni(e, t);
      }
      Wb !== null && Wb(e, t);
    };
    var Br = Yt(null), Ai = {
      recordUnsafeLifecycleWarnings: function() {
      },
      flushPendingUnsafeLifecycleWarnings: function() {
      },
      recordLegacyContextWarning: function() {
      },
      flushLegacyContextWarning: function() {
      },
      discardPendingWarnings: function() {
      }
    }, Lp = [], Xp = [], Qp = [], Vp = [], Zp = [], Jp = [], Yr = /* @__PURE__ */ new Set();
    Ai.recordUnsafeLifecycleWarnings = function(e, t) {
      Yr.has(e.type) || (typeof t.componentWillMount == "function" && t.componentWillMount.__suppressDeprecationWarning !== !0 && Lp.push(e), e.mode & wa && typeof t.UNSAFE_componentWillMount == "function" && Xp.push(e), typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps.__suppressDeprecationWarning !== !0 && Qp.push(e), e.mode & wa && typeof t.UNSAFE_componentWillReceiveProps == "function" && Vp.push(e), typeof t.componentWillUpdate == "function" && t.componentWillUpdate.__suppressDeprecationWarning !== !0 && Zp.push(e), e.mode & wa && typeof t.UNSAFE_componentWillUpdate == "function" && Jp.push(e));
    }, Ai.flushPendingUnsafeLifecycleWarnings = function() {
      var e = /* @__PURE__ */ new Set();
      0 < Lp.length && (Lp.forEach(function(h) {
        e.add(
          pe(h) || "Component"
        ), Yr.add(h.type);
      }), Lp = []);
      var t = /* @__PURE__ */ new Set();
      0 < Xp.length && (Xp.forEach(function(h) {
        t.add(
          pe(h) || "Component"
        ), Yr.add(h.type);
      }), Xp = []);
      var a = /* @__PURE__ */ new Set();
      0 < Qp.length && (Qp.forEach(function(h) {
        a.add(
          pe(h) || "Component"
        ), Yr.add(h.type);
      }), Qp = []);
      var i = /* @__PURE__ */ new Set();
      0 < Vp.length && (Vp.forEach(
        function(h) {
          i.add(
            pe(h) || "Component"
          ), Yr.add(h.type);
        }
      ), Vp = []);
      var o = /* @__PURE__ */ new Set();
      0 < Zp.length && (Zp.forEach(function(h) {
        o.add(
          pe(h) || "Component"
        ), Yr.add(h.type);
      }), Zp = []);
      var f = /* @__PURE__ */ new Set();
      if (0 < Jp.length && (Jp.forEach(function(h) {
        f.add(
          pe(h) || "Component"
        ), Yr.add(h.type);
      }), Jp = []), 0 < t.size) {
        var d = B(
          t
        );
        console.error(
          `Using UNSAFE_componentWillMount in strict mode is not recommended and may indicate bugs in your code. See https://react.dev/link/unsafe-component-lifecycles for details.

* Move code with side effects to componentDidMount, and set initial state in the constructor.

Please update the following components: %s`,
          d
        );
      }
      0 < i.size && (d = B(
        i
      ), console.error(
        `Using UNSAFE_componentWillReceiveProps in strict mode is not recommended and may indicate bugs in your code. See https://react.dev/link/unsafe-component-lifecycles for details.

* Move data fetching code or side effects to componentDidUpdate.
* If you're updating state whenever props change, refactor your code to use memoization techniques or move it to static getDerivedStateFromProps. Learn more at: https://react.dev/link/derived-state

Please update the following components: %s`,
        d
      )), 0 < f.size && (d = B(
        f
      ), console.error(
        `Using UNSAFE_componentWillUpdate in strict mode is not recommended and may indicate bugs in your code. See https://react.dev/link/unsafe-component-lifecycles for details.

* Move data fetching code or side effects to componentDidUpdate.

Please update the following components: %s`,
        d
      )), 0 < e.size && (d = B(e), console.warn(
        `componentWillMount has been renamed, and is not recommended for use. See https://react.dev/link/unsafe-component-lifecycles for details.

* Move code with side effects to componentDidMount, and set initial state in the constructor.
* Rename componentWillMount to UNSAFE_componentWillMount to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run \`npx react-codemod rename-unsafe-lifecycles\` in your project source folder.

Please update the following components: %s`,
        d
      )), 0 < a.size && (d = B(
        a
      ), console.warn(
        `componentWillReceiveProps has been renamed, and is not recommended for use. See https://react.dev/link/unsafe-component-lifecycles for details.

* Move data fetching code or side effects to componentDidUpdate.
* If you're updating state whenever props change, refactor your code to use memoization techniques or move it to static getDerivedStateFromProps. Learn more at: https://react.dev/link/derived-state
* Rename componentWillReceiveProps to UNSAFE_componentWillReceiveProps to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run \`npx react-codemod rename-unsafe-lifecycles\` in your project source folder.

Please update the following components: %s`,
        d
      )), 0 < o.size && (d = B(o), console.warn(
        `componentWillUpdate has been renamed, and is not recommended for use. See https://react.dev/link/unsafe-component-lifecycles for details.

* Move data fetching code or side effects to componentDidUpdate.
* Rename componentWillUpdate to UNSAFE_componentWillUpdate to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run \`npx react-codemod rename-unsafe-lifecycles\` in your project source folder.

Please update the following components: %s`,
        d
      ));
    };
    var cv = /* @__PURE__ */ new Map(), Fb = /* @__PURE__ */ new Set();
    Ai.recordLegacyContextWarning = function(e, t) {
      for (var a = null, i = e; i !== null; )
        i.mode & wa && (a = i), i = i.return;
      a === null ? console.error(
        "Expected to find a StrictMode component in a strict mode tree. This error is likely caused by a bug in React. Please file an issue."
      ) : !Fb.has(e.type) && (i = cv.get(a), e.type.contextTypes != null || e.type.childContextTypes != null || t !== null && typeof t.getChildContext == "function") && (i === void 0 && (i = [], cv.set(a, i)), i.push(e));
    }, Ai.flushLegacyContextWarning = function() {
      cv.forEach(function(e) {
        if (e.length !== 0) {
          var t = e[0], a = /* @__PURE__ */ new Set();
          e.forEach(function(o) {
            a.add(pe(o) || "Component"), Fb.add(o.type);
          });
          var i = B(a);
          de(t, function() {
            console.error(
              `Legacy context API has been detected within a strict-mode tree.

The old API will be supported in all 16.x releases, but applications using it should migrate to the new version.

Please update the following components: %s

Learn more about this warning here: https://react.dev/link/legacy-context`,
              i
            );
          });
        }
      });
    }, Ai.discardPendingWarnings = function() {
      Lp = [], Xp = [], Qp = [], Vp = [], Zp = [], Jp = [], cv = /* @__PURE__ */ new Map();
    };
    var Ib = {
      react_stack_bottom_frame: function(e, t, a) {
        var i = Bu;
        Bu = !0;
        try {
          return e(t, a);
        } finally {
          Bu = i;
        }
      }
    }, N1 = Ib.react_stack_bottom_frame.bind(Ib), Pb = {
      react_stack_bottom_frame: function(e) {
        var t = Bu;
        Bu = !0;
        try {
          return e.render();
        } finally {
          Bu = t;
        }
      }
    }, eS = Pb.react_stack_bottom_frame.bind(Pb), tS = {
      react_stack_bottom_frame: function(e, t) {
        try {
          t.componentDidMount();
        } catch (a) {
          Fe(e, e.return, a);
        }
      }
    }, H1 = tS.react_stack_bottom_frame.bind(
      tS
    ), lS = {
      react_stack_bottom_frame: function(e, t, a, i, o) {
        try {
          t.componentDidUpdate(a, i, o);
        } catch (f) {
          Fe(e, e.return, f);
        }
      }
    }, aS = lS.react_stack_bottom_frame.bind(
      lS
    ), nS = {
      react_stack_bottom_frame: function(e, t) {
        var a = t.stack;
        e.componentDidCatch(t.value, {
          componentStack: a !== null ? a : ""
        });
      }
    }, WE = nS.react_stack_bottom_frame.bind(
      nS
    ), uS = {
      react_stack_bottom_frame: function(e, t, a) {
        try {
          a.componentWillUnmount();
        } catch (i) {
          Fe(e, t, i);
        }
      }
    }, iS = uS.react_stack_bottom_frame.bind(
      uS
    ), cS = {
      react_stack_bottom_frame: function(e) {
        var t = e.create;
        return e = e.inst, t = t(), e.destroy = t;
      }
    }, FE = cS.react_stack_bottom_frame.bind(cS), oS = {
      react_stack_bottom_frame: function(e, t, a) {
        try {
          a();
        } catch (i) {
          Fe(e, t, i);
        }
      }
    }, IE = oS.react_stack_bottom_frame.bind(oS), fS = {
      react_stack_bottom_frame: function(e) {
        var t = e._init;
        return t(e._payload);
      }
    }, PE = fS.react_stack_bottom_frame.bind(fS), am = Error(
      "Suspense Exception: This is not a real error! It's an implementation detail of `use` to interrupt the current render. You must either rethrow it immediately, or move the `use` call outside of the `try/catch` block. Capturing without rethrowing will lead to unexpected behavior.\n\nTo handle async errors, wrap your component in an error boundary, or call the promise's `.catch` method and pass the result to `use`."
    ), j1 = Error(
      "Suspense Exception: This is not a real error, and should not leak into userspace. If you're seeing this, it's likely a bug in React."
    ), ov = Error(
      "Suspense Exception: This is not a real error! It's an implementation detail of `useActionState` to interrupt the current render. You must either rethrow it immediately, or move the `useActionState` call outside of the `try/catch` block. Capturing without rethrowing will lead to unexpected behavior.\n\nTo handle async errors, wrap your component in an error boundary."
    ), fv = {
      then: function() {
        console.error(
          'Internal React error: A listener was unexpectedly attached to a "noop" thenable. This is a bug in React. Please file an issue.'
        );
      }
    }, qr = null, Kp = !1, nm = null, $p = 0, lt = null, w1, sS = w1 = !1, rS = {}, dS = {}, hS = {};
    me = function(e, t, a) {
      if (a !== null && typeof a == "object" && a._store && (!a._store.validated && a.key == null || a._store.validated === 2)) {
        if (typeof a._store != "object")
          throw Error(
            "React Component in warnForMissingKey should have a _store. This error is likely caused by a bug in React. Please file an issue."
          );
        a._store.validated = 1;
        var i = pe(e), o = i || "null";
        if (!rS[o]) {
          rS[o] = !0, a = a._owner, e = e._debugOwner;
          var f = "";
          e && typeof e.tag == "number" && (o = pe(e)) && (f = `

Check the render method of \`` + o + "`."), f || i && (f = `

Check the top-level render call using <` + i + ">.");
          var d = "";
          a != null && e !== a && (i = null, typeof a.tag == "number" ? i = pe(a) : typeof a.name == "string" && (i = a.name), i && (d = " It was passed a child from " + i + ".")), de(t, function() {
            console.error(
              'Each child in a list should have a unique "key" prop.%s%s See https://react.dev/link/warning-keys for more information.',
              f,
              d
            );
          });
        }
      }
    };
    var Gr = wl(!0), mS = wl(!1), yS = 0, pS = 1, gS = 2, B1 = 3, If = !1, vS = !1, Y1 = null, q1 = !1, um = Yt(null), sv = Yt(0), au = Yt(null), $u = null, im = 1, kp = 2, xl = Yt(0), rv = 0, ku = 1, sn = 2, nu = 4, rn = 8, cm, bS = /* @__PURE__ */ new Set(), SS = /* @__PURE__ */ new Set(), G1 = /* @__PURE__ */ new Set(), ES = /* @__PURE__ */ new Set(), Ao = 0, Xe = null, Vt = null, Vl = null, dv = !1, om = !1, Lr = !1, hv = 0, Wp = 0, Oo = null, eT = 0, tT = 25, G = null, Wu = null, zo = -1, Fp = !1, Ip = {
      readContext: Et,
      use: oi,
      useCallback: sl,
      useContext: sl,
      useEffect: sl,
      useImperativeHandle: sl,
      useLayoutEffect: sl,
      useInsertionEffect: sl,
      useMemo: sl,
      useReducer: sl,
      useRef: sl,
      useState: sl,
      useDebugValue: sl,
      useDeferredValue: sl,
      useTransition: sl,
      useSyncExternalStore: sl,
      useId: sl,
      useHostTransitionStatus: sl,
      useFormState: sl,
      useActionState: sl,
      useOptimistic: sl,
      useMemoCache: sl,
      useCacheRefresh: sl
    };
    Ip.useEffectEvent = sl;
    var L1 = null, TS = null, X1 = null, AS = null, gc = null, Oi = null, mv = null;
    L1 = {
      readContext: function(e) {
        return Et(e);
      },
      use: oi,
      useCallback: function(e, t) {
        return G = "useCallback", Le(), ci(t), jd(e, t);
      },
      useContext: function(e) {
        return G = "useContext", Le(), Et(e);
      },
      useEffect: function(e, t) {
        return G = "useEffect", Le(), ci(t), Jc(e, t);
      },
      useImperativeHandle: function(e, t, a) {
        return G = "useImperativeHandle", Le(), ci(a), Au(e, t, a);
      },
      useInsertionEffect: function(e, t) {
        G = "useInsertionEffect", Le(), ci(t), Ii(4, sn, e, t);
      },
      useLayoutEffect: function(e, t) {
        return G = "useLayoutEffect", Le(), ci(t), ga(e, t);
      },
      useMemo: function(e, t) {
        G = "useMemo", Le(), ci(t);
        var a = L.H;
        L.H = gc;
        try {
          return va(e, t);
        } finally {
          L.H = a;
        }
      },
      useReducer: function(e, t, a) {
        G = "useReducer", Le();
        var i = L.H;
        L.H = gc;
        try {
          return Po(e, t, a);
        } finally {
          L.H = i;
        }
      },
      useRef: function(e) {
        return G = "useRef", Le(), Hd(e);
      },
      useState: function(e) {
        G = "useState", Le();
        var t = L.H;
        L.H = gc;
        try {
          return $i(e);
        } finally {
          L.H = t;
        }
      },
      useDebugValue: function() {
        G = "useDebugValue", Le();
      },
      useDeferredValue: function(e, t) {
        return G = "useDeferredValue", Le(), nf(e, t);
      },
      useTransition: function() {
        return G = "useTransition", Le(), Pi();
      },
      useSyncExternalStore: function(e, t, a) {
        return G = "useSyncExternalStore", Le(), ef(
          e,
          t,
          a
        );
      },
      useId: function() {
        return G = "useId", Le(), Vs();
      },
      useFormState: function(e, t) {
        return G = "useFormState", Le(), Ns(), Fa(e, t);
      },
      useActionState: function(e, t) {
        return G = "useActionState", Le(), Fa(e, t);
      },
      useOptimistic: function(e) {
        return G = "useOptimistic", Le(), Zc(e);
      },
      useHostTransitionStatus: di,
      useMemoCache: ka,
      useCacheRefresh: function() {
        return G = "useCacheRefresh", Le(), wd();
      },
      useEffectEvent: function(e) {
        return G = "useEffectEvent", Le(), Xs(e);
      }
    }, TS = {
      readContext: function(e) {
        return Et(e);
      },
      use: oi,
      useCallback: function(e, t) {
        return G = "useCallback", I(), jd(e, t);
      },
      useContext: function(e) {
        return G = "useContext", I(), Et(e);
      },
      useEffect: function(e, t) {
        return G = "useEffect", I(), Jc(e, t);
      },
      useImperativeHandle: function(e, t, a) {
        return G = "useImperativeHandle", I(), Au(e, t, a);
      },
      useInsertionEffect: function(e, t) {
        G = "useInsertionEffect", I(), Ii(4, sn, e, t);
      },
      useLayoutEffect: function(e, t) {
        return G = "useLayoutEffect", I(), ga(e, t);
      },
      useMemo: function(e, t) {
        G = "useMemo", I();
        var a = L.H;
        L.H = gc;
        try {
          return va(e, t);
        } finally {
          L.H = a;
        }
      },
      useReducer: function(e, t, a) {
        G = "useReducer", I();
        var i = L.H;
        L.H = gc;
        try {
          return Po(e, t, a);
        } finally {
          L.H = i;
        }
      },
      useRef: function(e) {
        return G = "useRef", I(), Hd(e);
      },
      useState: function(e) {
        G = "useState", I();
        var t = L.H;
        L.H = gc;
        try {
          return $i(e);
        } finally {
          L.H = t;
        }
      },
      useDebugValue: function() {
        G = "useDebugValue", I();
      },
      useDeferredValue: function(e, t) {
        return G = "useDeferredValue", I(), nf(e, t);
      },
      useTransition: function() {
        return G = "useTransition", I(), Pi();
      },
      useSyncExternalStore: function(e, t, a) {
        return G = "useSyncExternalStore", I(), ef(
          e,
          t,
          a
        );
      },
      useId: function() {
        return G = "useId", I(), Vs();
      },
      useActionState: function(e, t) {
        return G = "useActionState", I(), Fa(e, t);
      },
      useFormState: function(e, t) {
        return G = "useFormState", I(), Ns(), Fa(e, t);
      },
      useOptimistic: function(e) {
        return G = "useOptimistic", I(), Zc(e);
      },
      useHostTransitionStatus: di,
      useMemoCache: ka,
      useCacheRefresh: function() {
        return G = "useCacheRefresh", I(), wd();
      },
      useEffectEvent: function(e) {
        return G = "useEffectEvent", I(), Xs(e);
      }
    }, X1 = {
      readContext: function(e) {
        return Et(e);
      },
      use: oi,
      useCallback: function(e, t) {
        return G = "useCallback", I(), Vn(e, t);
      },
      useContext: function(e) {
        return G = "useContext", I(), Et(e);
      },
      useEffect: function(e, t) {
        G = "useEffect", I(), _l(2048, rn, e, t);
      },
      useImperativeHandle: function(e, t, a) {
        return G = "useImperativeHandle", I(), af(e, t, a);
      },
      useInsertionEffect: function(e, t) {
        return G = "useInsertionEffect", I(), _l(4, sn, e, t);
      },
      useLayoutEffect: function(e, t) {
        return G = "useLayoutEffect", I(), _l(4, nu, e, t);
      },
      useMemo: function(e, t) {
        G = "useMemo", I();
        var a = L.H;
        L.H = Oi;
        try {
          return It(e, t);
        } finally {
          L.H = a;
        }
      },
      useReducer: function(e, t, a) {
        G = "useReducer", I();
        var i = L.H;
        L.H = Oi;
        try {
          return Xc(e, t, a);
        } finally {
          L.H = i;
        }
      },
      useRef: function() {
        return G = "useRef", I(), zt().memoizedState;
      },
      useState: function() {
        G = "useState", I();
        var e = L.H;
        L.H = Oi;
        try {
          return Xc(Wa);
        } finally {
          L.H = e;
        }
      },
      useDebugValue: function() {
        G = "useDebugValue", I();
      },
      useDeferredValue: function(e, t) {
        return G = "useDeferredValue", I(), Ou(e, t);
      },
      useTransition: function() {
        return G = "useTransition", I(), Q0();
      },
      useSyncExternalStore: function(e, t, a) {
        return G = "useSyncExternalStore", I(), Vc(
          e,
          t,
          a
        );
      },
      useId: function() {
        return G = "useId", I(), zt().memoizedState;
      },
      useFormState: function(e) {
        return G = "useFormState", I(), Ns(), Wi(e);
      },
      useActionState: function(e) {
        return G = "useActionState", I(), Wi(e);
      },
      useOptimistic: function(e, t) {
        return G = "useOptimistic", I(), qs(e, t);
      },
      useHostTransitionStatus: di,
      useMemoCache: ka,
      useCacheRefresh: function() {
        return G = "useCacheRefresh", I(), zt().memoizedState;
      },
      useEffectEvent: function(e) {
        return G = "useEffectEvent", I(), lf(e);
      }
    }, AS = {
      readContext: function(e) {
        return Et(e);
      },
      use: oi,
      useCallback: function(e, t) {
        return G = "useCallback", I(), Vn(e, t);
      },
      useContext: function(e) {
        return G = "useContext", I(), Et(e);
      },
      useEffect: function(e, t) {
        G = "useEffect", I(), _l(2048, rn, e, t);
      },
      useImperativeHandle: function(e, t, a) {
        return G = "useImperativeHandle", I(), af(e, t, a);
      },
      useInsertionEffect: function(e, t) {
        return G = "useInsertionEffect", I(), _l(4, sn, e, t);
      },
      useLayoutEffect: function(e, t) {
        return G = "useLayoutEffect", I(), _l(4, nu, e, t);
      },
      useMemo: function(e, t) {
        G = "useMemo", I();
        var a = L.H;
        L.H = mv;
        try {
          return It(e, t);
        } finally {
          L.H = a;
        }
      },
      useReducer: function(e, t, a) {
        G = "useReducer", I();
        var i = L.H;
        L.H = mv;
        try {
          return Qc(e, t, a);
        } finally {
          L.H = i;
        }
      },
      useRef: function() {
        return G = "useRef", I(), zt().memoizedState;
      },
      useState: function() {
        G = "useState", I();
        var e = L.H;
        L.H = mv;
        try {
          return Qc(Wa);
        } finally {
          L.H = e;
        }
      },
      useDebugValue: function() {
        G = "useDebugValue", I();
      },
      useDeferredValue: function(e, t) {
        return G = "useDeferredValue", I(), $e(e, t);
      },
      useTransition: function() {
        return G = "useTransition", I(), ul();
      },
      useSyncExternalStore: function(e, t, a) {
        return G = "useSyncExternalStore", I(), Vc(
          e,
          t,
          a
        );
      },
      useId: function() {
        return G = "useId", I(), zt().memoizedState;
      },
      useFormState: function(e) {
        return G = "useFormState", I(), Ns(), Fi(e);
      },
      useActionState: function(e) {
        return G = "useActionState", I(), Fi(e);
      },
      useOptimistic: function(e, t) {
        return G = "useOptimistic", I(), Gs(e, t);
      },
      useHostTransitionStatus: di,
      useMemoCache: ka,
      useCacheRefresh: function() {
        return G = "useCacheRefresh", I(), zt().memoizedState;
      },
      useEffectEvent: function(e) {
        return G = "useEffectEvent", I(), lf(e);
      }
    }, gc = {
      readContext: function(e) {
        return le(), Et(e);
      },
      use: function(e) {
        return F(), oi(e);
      },
      useCallback: function(e, t) {
        return G = "useCallback", F(), Le(), jd(e, t);
      },
      useContext: function(e) {
        return G = "useContext", F(), Le(), Et(e);
      },
      useEffect: function(e, t) {
        return G = "useEffect", F(), Le(), Jc(e, t);
      },
      useImperativeHandle: function(e, t, a) {
        return G = "useImperativeHandle", F(), Le(), Au(e, t, a);
      },
      useInsertionEffect: function(e, t) {
        G = "useInsertionEffect", F(), Le(), Ii(4, sn, e, t);
      },
      useLayoutEffect: function(e, t) {
        return G = "useLayoutEffect", F(), Le(), ga(e, t);
      },
      useMemo: function(e, t) {
        G = "useMemo", F(), Le();
        var a = L.H;
        L.H = gc;
        try {
          return va(e, t);
        } finally {
          L.H = a;
        }
      },
      useReducer: function(e, t, a) {
        G = "useReducer", F(), Le();
        var i = L.H;
        L.H = gc;
        try {
          return Po(e, t, a);
        } finally {
          L.H = i;
        }
      },
      useRef: function(e) {
        return G = "useRef", F(), Le(), Hd(e);
      },
      useState: function(e) {
        G = "useState", F(), Le();
        var t = L.H;
        L.H = gc;
        try {
          return $i(e);
        } finally {
          L.H = t;
        }
      },
      useDebugValue: function() {
        G = "useDebugValue", F(), Le();
      },
      useDeferredValue: function(e, t) {
        return G = "useDeferredValue", F(), Le(), nf(e, t);
      },
      useTransition: function() {
        return G = "useTransition", F(), Le(), Pi();
      },
      useSyncExternalStore: function(e, t, a) {
        return G = "useSyncExternalStore", F(), Le(), ef(
          e,
          t,
          a
        );
      },
      useId: function() {
        return G = "useId", F(), Le(), Vs();
      },
      useFormState: function(e, t) {
        return G = "useFormState", F(), Le(), Fa(e, t);
      },
      useActionState: function(e, t) {
        return G = "useActionState", F(), Le(), Fa(e, t);
      },
      useOptimistic: function(e) {
        return G = "useOptimistic", F(), Le(), Zc(e);
      },
      useMemoCache: function(e) {
        return F(), ka(e);
      },
      useHostTransitionStatus: di,
      useCacheRefresh: function() {
        return G = "useCacheRefresh", Le(), wd();
      },
      useEffectEvent: function(e) {
        return G = "useEffectEvent", F(), Le(), Xs(e);
      }
    }, Oi = {
      readContext: function(e) {
        return le(), Et(e);
      },
      use: function(e) {
        return F(), oi(e);
      },
      useCallback: function(e, t) {
        return G = "useCallback", F(), I(), Vn(e, t);
      },
      useContext: function(e) {
        return G = "useContext", F(), I(), Et(e);
      },
      useEffect: function(e, t) {
        G = "useEffect", F(), I(), _l(2048, rn, e, t);
      },
      useImperativeHandle: function(e, t, a) {
        return G = "useImperativeHandle", F(), I(), af(e, t, a);
      },
      useInsertionEffect: function(e, t) {
        return G = "useInsertionEffect", F(), I(), _l(4, sn, e, t);
      },
      useLayoutEffect: function(e, t) {
        return G = "useLayoutEffect", F(), I(), _l(4, nu, e, t);
      },
      useMemo: function(e, t) {
        G = "useMemo", F(), I();
        var a = L.H;
        L.H = Oi;
        try {
          return It(e, t);
        } finally {
          L.H = a;
        }
      },
      useReducer: function(e, t, a) {
        G = "useReducer", F(), I();
        var i = L.H;
        L.H = Oi;
        try {
          return Xc(e, t, a);
        } finally {
          L.H = i;
        }
      },
      useRef: function() {
        return G = "useRef", F(), I(), zt().memoizedState;
      },
      useState: function() {
        G = "useState", F(), I();
        var e = L.H;
        L.H = Oi;
        try {
          return Xc(Wa);
        } finally {
          L.H = e;
        }
      },
      useDebugValue: function() {
        G = "useDebugValue", F(), I();
      },
      useDeferredValue: function(e, t) {
        return G = "useDeferredValue", F(), I(), Ou(e, t);
      },
      useTransition: function() {
        return G = "useTransition", F(), I(), Q0();
      },
      useSyncExternalStore: function(e, t, a) {
        return G = "useSyncExternalStore", F(), I(), Vc(
          e,
          t,
          a
        );
      },
      useId: function() {
        return G = "useId", F(), I(), zt().memoizedState;
      },
      useFormState: function(e) {
        return G = "useFormState", F(), I(), Wi(e);
      },
      useActionState: function(e) {
        return G = "useActionState", F(), I(), Wi(e);
      },
      useOptimistic: function(e, t) {
        return G = "useOptimistic", F(), I(), qs(e, t);
      },
      useMemoCache: function(e) {
        return F(), ka(e);
      },
      useHostTransitionStatus: di,
      useCacheRefresh: function() {
        return G = "useCacheRefresh", I(), zt().memoizedState;
      },
      useEffectEvent: function(e) {
        return G = "useEffectEvent", F(), I(), lf(e);
      }
    }, mv = {
      readContext: function(e) {
        return le(), Et(e);
      },
      use: function(e) {
        return F(), oi(e);
      },
      useCallback: function(e, t) {
        return G = "useCallback", F(), I(), Vn(e, t);
      },
      useContext: function(e) {
        return G = "useContext", F(), I(), Et(e);
      },
      useEffect: function(e, t) {
        G = "useEffect", F(), I(), _l(2048, rn, e, t);
      },
      useImperativeHandle: function(e, t, a) {
        return G = "useImperativeHandle", F(), I(), af(e, t, a);
      },
      useInsertionEffect: function(e, t) {
        return G = "useInsertionEffect", F(), I(), _l(4, sn, e, t);
      },
      useLayoutEffect: function(e, t) {
        return G = "useLayoutEffect", F(), I(), _l(4, nu, e, t);
      },
      useMemo: function(e, t) {
        G = "useMemo", F(), I();
        var a = L.H;
        L.H = Oi;
        try {
          return It(e, t);
        } finally {
          L.H = a;
        }
      },
      useReducer: function(e, t, a) {
        G = "useReducer", F(), I();
        var i = L.H;
        L.H = Oi;
        try {
          return Qc(e, t, a);
        } finally {
          L.H = i;
        }
      },
      useRef: function() {
        return G = "useRef", F(), I(), zt().memoizedState;
      },
      useState: function() {
        G = "useState", F(), I();
        var e = L.H;
        L.H = Oi;
        try {
          return Qc(Wa);
        } finally {
          L.H = e;
        }
      },
      useDebugValue: function() {
        G = "useDebugValue", F(), I();
      },
      useDeferredValue: function(e, t) {
        return G = "useDeferredValue", F(), I(), $e(e, t);
      },
      useTransition: function() {
        return G = "useTransition", F(), I(), ul();
      },
      useSyncExternalStore: function(e, t, a) {
        return G = "useSyncExternalStore", F(), I(), Vc(
          e,
          t,
          a
        );
      },
      useId: function() {
        return G = "useId", F(), I(), zt().memoizedState;
      },
      useFormState: function(e) {
        return G = "useFormState", F(), I(), Fi(e);
      },
      useActionState: function(e) {
        return G = "useActionState", F(), I(), Fi(e);
      },
      useOptimistic: function(e, t) {
        return G = "useOptimistic", F(), I(), Gs(e, t);
      },
      useMemoCache: function(e) {
        return F(), ka(e);
      },
      useHostTransitionStatus: di,
      useCacheRefresh: function() {
        return G = "useCacheRefresh", I(), zt().memoizedState;
      },
      useEffectEvent: function(e) {
        return G = "useEffectEvent", F(), I(), lf(e);
      }
    };
    var OS = {}, zS = /* @__PURE__ */ new Set(), DS = /* @__PURE__ */ new Set(), _S = /* @__PURE__ */ new Set(), RS = /* @__PURE__ */ new Set(), MS = /* @__PURE__ */ new Set(), CS = /* @__PURE__ */ new Set(), xS = /* @__PURE__ */ new Set(), US = /* @__PURE__ */ new Set(), NS = /* @__PURE__ */ new Set(), HS = /* @__PURE__ */ new Set();
    Object.freeze(OS);
    var Q1 = {
      enqueueSetState: function(e, t, a) {
        e = e._reactInternals;
        var i = ua(e), o = Dl(i);
        o.payload = t, a != null && (Wc(a), o.callback = a), t = bu(e, o, i), t !== null && (pu(i, "this.setState()", e), Ge(t, e, i), Tn(t, e, i));
      },
      enqueueReplaceState: function(e, t, a) {
        e = e._reactInternals;
        var i = ua(e), o = Dl(i);
        o.tag = pS, o.payload = t, a != null && (Wc(a), o.callback = a), t = bu(e, o, i), t !== null && (pu(i, "this.replaceState()", e), Ge(t, e, i), Tn(t, e, i));
      },
      enqueueForceUpdate: function(e, t) {
        e = e._reactInternals;
        var a = ua(e), i = Dl(a);
        i.tag = gS, t != null && (Wc(t), i.callback = t), t = bu(e, i, a), t !== null && (pu(a, "this.forceUpdate()", e), Ge(t, e, a), Tn(t, e, a));
      }
    }, fm = null, V1 = null, Z1 = Error(
      "This is not a real error. It's an implementation detail of React's selective hydration feature. If this leaks into userspace, it's a bug in React. Please file an issue."
    ), Zl = !1, jS = {}, wS = {}, BS = {}, YS = {}, sm = !1, qS = {}, yv = {}, J1 = {
      dehydrated: null,
      treeContext: null,
      retryLane: 0,
      hydrationErrors: null
    }, GS = !1, LS = null;
    LS = /* @__PURE__ */ new Set();
    var Do = !1, Jl = !1, K1 = !1, XS = typeof WeakSet == "function" ? WeakSet : Set, fa = null, rm = null, dm = null, Kl = null, Rn = !1, zi = null, Pl = !1, Pp = 8192, lT = {
      getCacheForType: function(e) {
        var t = Et(Xl), a = t.data.get(e);
        return a === void 0 && (a = e(), t.data.set(e, a)), a;
      },
      cacheSignal: function() {
        return Et(Xl).controller.signal;
      },
      getOwner: function() {
        return ja;
      }
    };
    if (typeof Symbol == "function" && Symbol.for) {
      var e0 = Symbol.for;
      e0("selector.component"), e0("selector.has_pseudo_class"), e0("selector.role"), e0("selector.test_id"), e0("selector.text");
    }
    var aT = [], nT = typeof WeakMap == "function" ? WeakMap : Map, sa = 0, ea = 2, uu = 4, _o = 0, t0 = 1, Xr = 2, pv = 3, Pf = 4, gv = 6, QS = 5, pt = sa, Zt = null, it = null, at = 0, Mn = 0, vv = 1, Qr = 2, l0 = 3, VS = 4, $1 = 5, a0 = 6, bv = 7, k1 = 8, Vr = 9, wt = Mn, iu = null, es = !1, hm = !1, W1 = !1, vc = 0, hl = _o, ts = 0, ls = 0, F1 = 0, Cn = 0, Zr = 0, n0 = null, dn = null, Sv = !1, Ev = 0, ZS = 0, JS = 300, Tv = 1 / 0, KS = 500, u0 = null, Ol = null, as = null, Av = 0, I1 = 1, P1 = 2, $S = 3, ns = 0, kS = 1, WS = 2, FS = 3, IS = 4, Ov = 5, $l = 0, us = null, mm = null, Di = 0, eb = 0, tb = -0, lb = null, PS = null, e2 = null, _i = Av, t2 = null, uT = 50, i0 = 0, ab = null, nb = !1, zv = !1, iT = 50, Jr = 0, c0 = null, ym = !1, Dv = null, l2 = !1, a2 = /* @__PURE__ */ new Set(), cT = {}, _v = null, pm = null, ub = !1, ib = !1, Rv = !1, cb = !1, is = 0, ob = {};
    (function() {
      for (var e = 0; e < b1.length; e++) {
        var t = b1[e], a = t.toLowerCase();
        t = t[0].toUpperCase() + t.slice(1), Hn(a, "on" + t);
      }
      Hn(Nb, "onAnimationEnd"), Hn(Hb, "onAnimationIteration"), Hn(jb, "onAnimationStart"), Hn("dblclick", "onDoubleClick"), Hn("focusin", "onFocus"), Hn("focusout", "onBlur"), Hn(wE, "onTransitionRun"), Hn(BE, "onTransitionStart"), Hn(YE, "onTransitionCancel"), Hn(wb, "onTransitionEnd");
    })(), Je("onMouseEnter", ["mouseout", "mouseover"]), Je("onMouseLeave", ["mouseout", "mouseover"]), Je("onPointerEnter", ["pointerout", "pointerover"]), Je("onPointerLeave", ["pointerout", "pointerover"]), nt(
      "onChange",
      "change click focusin focusout input keydown keyup selectionchange".split(
        " "
      )
    ), nt(
      "onSelect",
      "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
        " "
      )
    ), nt("onBeforeInput", [
      "compositionend",
      "keypress",
      "textInput",
      "paste"
    ]), nt(
      "onCompositionEnd",
      "compositionend focusout keydown keypress keyup mousedown".split(" ")
    ), nt(
      "onCompositionStart",
      "compositionstart focusout keydown keypress keyup mousedown".split(" ")
    ), nt(
      "onCompositionUpdate",
      "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
    );
    var o0 = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
      " "
    ), fb = new Set(
      "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(o0)
    ), Mv = "_reactListening" + Math.random().toString(36).slice(2), n2 = !1, u2 = !1, Cv = !1, i2 = !1, xv = !1, Uv = !1, c2 = !1, Nv = {}, oT = /\r\n?/g, fT = /\u0000|\uFFFD/g, Kr = "http://www.w3.org/1999/xlink", sb = "http://www.w3.org/XML/1998/namespace", sT = "javascript:throw new Error('React form unexpectedly submitted.')", rT = "suppressHydrationWarning", $r = "&", Hv = "/&", f0 = "$", s0 = "/$", cs = "$?", kr = "$~", gm = "$!", dT = "html", hT = "body", mT = "head", rb = "F!", o2 = "F", f2 = "loading", yT = "style", Ro = 0, vm = 1, jv = 2, db = null, hb = null, s2 = { dialog: !0, webview: !0 }, mb = null, r0 = void 0, r2 = typeof setTimeout == "function" ? setTimeout : void 0, pT = typeof clearTimeout == "function" ? clearTimeout : void 0, Wr = -1, d2 = typeof Promise == "function" ? Promise : void 0, gT = typeof queueMicrotask == "function" ? queueMicrotask : typeof d2 < "u" ? function(e) {
      return d2.resolve(null).then(e).catch(rg);
    } : r2, yb = null, Fr = 0, d0 = 1, h2 = 2, m2 = 3, Fu = 4, Iu = /* @__PURE__ */ new Map(), y2 = /* @__PURE__ */ new Set(), Mo = At.d;
    At.d = {
      f: function() {
        var e = Mo.f(), t = ln();
        return e || t;
      },
      r: function(e) {
        var t = ce(e);
        t !== null && t.tag === 5 && t.type === "form" ? uf(t) : Mo.r(e);
      },
      D: function(e) {
        Mo.D(e), Py("dns-prefetch", e, null);
      },
      C: function(e, t) {
        Mo.C(e, t), Py("preconnect", e, t);
      },
      L: function(e, t, a) {
        Mo.L(e, t, a);
        var i = bm;
        if (i && e && t) {
          var o = 'link[rel="preload"][as="' + xt(t) + '"]';
          t === "image" && a && a.imageSrcSet ? (o += '[imagesrcset="' + xt(
            a.imageSrcSet
          ) + '"]', typeof a.imageSizes == "string" && (o += '[imagesizes="' + xt(
            a.imageSizes
          ) + '"]')) : o += '[href="' + xt(e) + '"]';
          var f = o;
          switch (t) {
            case "style":
              f = io(e);
              break;
            case "script":
              f = co(e);
          }
          Iu.has(f) || (e = et(
            {
              rel: "preload",
              href: t === "image" && a && a.imageSrcSet ? void 0 : e,
              as: t
            },
            a
          ), Iu.set(f, e), i.querySelector(o) !== null || t === "style" && i.querySelector(
            pr(f)
          ) || t === "script" && i.querySelector(gr(f)) || (t = i.createElement("link"), Pt(t, "link", e), Se(t), i.head.appendChild(t)));
        }
      },
      m: function(e, t) {
        Mo.m(e, t);
        var a = bm;
        if (a && e) {
          var i = t && typeof t.as == "string" ? t.as : "script", o = 'link[rel="modulepreload"][as="' + xt(i) + '"][href="' + xt(e) + '"]', f = o;
          switch (i) {
            case "audioworklet":
            case "paintworklet":
            case "serviceworker":
            case "sharedworker":
            case "worker":
            case "script":
              f = co(e);
          }
          if (!Iu.has(f) && (e = et({ rel: "modulepreload", href: e }, t), Iu.set(f, e), a.querySelector(o) === null)) {
            switch (i) {
              case "audioworklet":
              case "paintworklet":
              case "serviceworker":
              case "sharedworker":
              case "worker":
              case "script":
                if (a.querySelector(gr(f)))
                  return;
            }
            i = a.createElement("link"), Pt(i, "link", e), Se(i), a.head.appendChild(i);
          }
        }
      },
      X: function(e, t) {
        Mo.X(e, t);
        var a = bm;
        if (a && e) {
          var i = we(a).hoistableScripts, o = co(e), f = i.get(o);
          f || (f = a.querySelector(
            gr(o)
          ), f || (e = et({ src: e, async: !0 }, t), (t = Iu.get(o)) && lp(e, t), f = a.createElement("script"), Se(f), Pt(f, "link", e), a.head.appendChild(f)), f = {
            type: "script",
            instance: f,
            count: 1,
            state: null
          }, i.set(o, f));
        }
      },
      S: function(e, t, a) {
        Mo.S(e, t, a);
        var i = bm;
        if (i && e) {
          var o = we(i).hoistableStyles, f = io(e);
          t = t || "default";
          var d = o.get(f);
          if (!d) {
            var h = { loading: Fr, preload: null };
            if (d = i.querySelector(
              pr(f)
            ))
              h.loading = d0 | Fu;
            else {
              e = et(
                {
                  rel: "stylesheet",
                  href: e,
                  "data-precedence": t
                },
                a
              ), (a = Iu.get(f)) && tp(e, a);
              var y = d = i.createElement("link");
              Se(y), Pt(y, "link", e), y._p = new Promise(function(p, z) {
                y.onload = p, y.onerror = z;
              }), y.addEventListener("load", function() {
                h.loading |= d0;
              }), y.addEventListener("error", function() {
                h.loading |= h2;
              }), h.loading |= Fu, _f(d, t, i);
            }
            d = {
              type: "stylesheet",
              instance: d,
              count: 1,
              state: h
            }, o.set(f, d);
          }
        }
      },
      M: function(e, t) {
        Mo.M(e, t);
        var a = bm;
        if (a && e) {
          var i = we(a).hoistableScripts, o = co(e), f = i.get(o);
          f || (f = a.querySelector(
            gr(o)
          ), f || (e = et({ src: e, async: !0, type: "module" }, t), (t = Iu.get(o)) && lp(e, t), f = a.createElement("script"), Se(f), Pt(f, "link", e), a.head.appendChild(f)), f = {
            type: "script",
            instance: f,
            count: 1,
            state: null
          }, i.set(o, f));
        }
      }
    };
    var bm = typeof document > "u" ? null : document, wv = null, vT = 6e4, bT = 800, ST = 500, pb = 0, gb = null, Bv = null, Ir = c1, h0 = {
      $$typeof: Pn,
      Provider: null,
      Consumer: null,
      _currentValue: Ir,
      _currentValue2: Ir,
      _threadCount: 0
    }, p2 = "%c%s%c", g2 = "background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px", v2 = "", Yv = " ", ET = Function.prototype.bind, b2 = !1, S2 = null, E2 = null, T2 = null, A2 = null, O2 = null, z2 = null, D2 = null, _2 = null, R2 = null, M2 = null;
    S2 = function(e, t, a, i) {
      t = x(e, t), t !== null && (a = k(t.memoizedState, a, 0, i), t.memoizedState = a, t.baseState = a, e.memoizedProps = et({}, e.memoizedProps), a = aa(e, 2), a !== null && Ge(a, e, 2));
    }, E2 = function(e, t, a) {
      t = x(e, t), t !== null && (a = P(t.memoizedState, a, 0), t.memoizedState = a, t.baseState = a, e.memoizedProps = et({}, e.memoizedProps), a = aa(e, 2), a !== null && Ge(a, e, 2));
    }, T2 = function(e, t, a, i) {
      t = x(e, t), t !== null && (a = fe(t.memoizedState, a, i), t.memoizedState = a, t.baseState = a, e.memoizedProps = et({}, e.memoizedProps), a = aa(e, 2), a !== null && Ge(a, e, 2));
    }, A2 = function(e, t, a) {
      e.pendingProps = k(e.memoizedProps, t, 0, a), e.alternate && (e.alternate.pendingProps = e.pendingProps), t = aa(e, 2), t !== null && Ge(t, e, 2);
    }, O2 = function(e, t) {
      e.pendingProps = P(e.memoizedProps, t, 0), e.alternate && (e.alternate.pendingProps = e.pendingProps), t = aa(e, 2), t !== null && Ge(t, e, 2);
    }, z2 = function(e, t, a) {
      e.pendingProps = fe(
        e.memoizedProps,
        t,
        a
      ), e.alternate && (e.alternate.pendingProps = e.pendingProps), t = aa(e, 2), t !== null && Ge(t, e, 2);
    }, D2 = function(e) {
      var t = aa(e, 2);
      t !== null && Ge(t, e, 2);
    }, _2 = function(e) {
      var t = xo(), a = aa(e, t);
      a !== null && Ge(a, e, t);
    }, R2 = function(e) {
      Te = e;
    }, M2 = function(e) {
      oe = e;
    };
    var qv = !0, Gv = null, vb = !1, os = null, fs = null, ss = null, m0 = /* @__PURE__ */ new Map(), y0 = /* @__PURE__ */ new Map(), rs = [], TT = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
      " "
    ), Lv = null;
    if (In.prototype.render = dp.prototype.render = function(e) {
      var t = this._internalRoot;
      if (t === null) throw Error("Cannot update an unmounted root.");
      var a = arguments;
      typeof a[1] == "function" ? console.error(
        "does not support the second callback argument. To execute a side effect after rendering, declare it in a component body with useEffect()."
      ) : be(a[1]) ? console.error(
        "You passed a container to the second argument of root.render(...). You don't need to pass it again since you already passed it to create the root."
      ) : typeof a[1] < "u" && console.error(
        "You passed a second argument to root.render(...) but it only accepts one argument."
      ), a = e;
      var i = t.current, o = ua(i);
      Dh(i, o, a, t, null, null);
    }, In.prototype.unmount = dp.prototype.unmount = function() {
      var e = arguments;
      if (typeof e[0] == "function" && console.error(
        "does not support a callback argument. To execute a side effect after rendering, declare it in a component body with useEffect()."
      ), e = this._internalRoot, e !== null) {
        this._internalRoot = null;
        var t = e.containerInfo;
        (pt & (ea | uu)) !== sa && console.error(
          "Attempted to synchronously unmount a root while React was already rendering. React cannot finish unmounting the root until the current render has completed, which may lead to a race condition."
        ), Dh(e.current, 2, null, e, null, null), ln(), t[Ei] = null;
      }
    }, In.prototype.unstable_scheduleHydration = function(e) {
      if (e) {
        var t = xi();
        e = { blockedOn: null, target: e, priority: t };
        for (var a = 0; a < rs.length && t !== 0 && t < rs[a].priority; a++) ;
        rs.splice(a, 0, e), a === 0 && rp(e);
      }
    }, (function() {
      var e = Tr.version;
      if (e !== "19.2.7")
        throw Error(
          `Incompatible React versions: The "react" and "react-dom" packages must have the exact same version. Instead got:
  - react:      ` + (e + `
  - react-dom:  19.2.7
Learn more: https://react.dev/warnings/version-mismatch`)
        );
    })(), typeof Map == "function" && Map.prototype != null && typeof Map.prototype.forEach == "function" && typeof Set == "function" && Set.prototype != null && typeof Set.prototype.clear == "function" && typeof Set.prototype.forEach == "function" || console.error(
      "React depends on Map and Set built-in types. Make sure that you load a polyfill in older browsers. https://react.dev/link/react-polyfills"
    ), At.findDOMNode = function(e) {
      var t = e._reactInternals;
      if (t === void 0)
        throw typeof e.render == "function" ? Error("Unable to find node on an unmounted component.") : (e = Object.keys(e).join(","), Error(
          "Argument appears to not be a ReactComponent. Keys: " + e
        ));
      return e = Bt(t), e = e !== null ? qt(e) : null, e = e === null ? null : e.stateNode, e;
    }, !(function() {
      var e = {
        bundleType: 1,
        version: "19.2.7",
        rendererPackageName: "react-dom",
        currentDispatcherRef: L,
        reconcilerVersion: "19.2.7"
      };
      return e.overrideHookState = S2, e.overrideHookStateDeletePath = E2, e.overrideHookStateRenamePath = T2, e.overrideProps = A2, e.overridePropsDeletePath = O2, e.overridePropsRenamePath = z2, e.scheduleUpdate = D2, e.scheduleRetry = _2, e.setErrorHandler = R2, e.setSuspenseHandler = M2, e.scheduleRefresh = xe, e.scheduleRoot = ue, e.setRefreshHandler = ie, e.getCurrentFiber = Ht, ds(e);
    })() && mc && window.top === window.self && (-1 < navigator.userAgent.indexOf("Chrome") && navigator.userAgent.indexOf("Edge") === -1 || -1 < navigator.userAgent.indexOf("Firefox"))) {
      var C2 = window.location.protocol;
      /^(https?|file):$/.test(C2) && console.info(
        "%cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools" + (C2 === "file:" ? `
You might need to use a local HTTP server (instead of file://): https://react.dev/link/react-devtools-faq` : ""),
        "font-weight:bold"
      );
    }
    b0.createRoot = function(e, t) {
      if (!be(e))
        throw Error("Target container is not a DOM element.");
      hp(e);
      var a = !1, i = "", o = qd, f = Gd, d = cy;
      return t != null && (t.hydrate ? console.warn(
        "hydrate through createRoot is deprecated. Use ReactDOMClient.hydrateRoot(container, <App />) instead."
      ) : typeof t == "object" && t !== null && t.$$typeof === Dn && console.error(
        `You passed a JSX element to createRoot. You probably meant to call root.render instead. Example usage:

  let root = createRoot(domContainer);
  root.render(<App />);`
      ), t.unstable_strictMode === !0 && (a = !0), t.identifierPrefix !== void 0 && (i = t.identifierPrefix), t.onUncaughtError !== void 0 && (o = t.onUncaughtError), t.onCaughtError !== void 0 && (f = t.onCaughtError), t.onRecoverableError !== void 0 && (d = t.onRecoverableError)), t = Sr(
        e,
        1,
        !1,
        null,
        null,
        a,
        i,
        null,
        o,
        f,
        d,
        jg
      ), e[Ei] = t.current, ic(e), new dp(t);
    }, b0.hydrateRoot = function(e, t, a) {
      if (!be(e))
        throw Error("Target container is not a DOM element.");
      hp(e), t === void 0 && console.error(
        "Must provide initial children as second argument to hydrateRoot. Example usage: hydrateRoot(domContainer, <App />)"
      );
      var i = !1, o = "", f = qd, d = Gd, h = cy, y = null;
      return a != null && (a.unstable_strictMode === !0 && (i = !0), a.identifierPrefix !== void 0 && (o = a.identifierPrefix), a.onUncaughtError !== void 0 && (f = a.onUncaughtError), a.onCaughtError !== void 0 && (d = a.onCaughtError), a.onRecoverableError !== void 0 && (h = a.onRecoverableError), a.formState !== void 0 && (y = a.formState)), t = Sr(
        e,
        1,
        !0,
        t,
        a ?? null,
        i,
        o,
        y,
        f,
        d,
        h,
        jg
      ), t.context = xg(null), a = t.current, i = ua(a), i = hn(i), o = Dl(i), o.callback = null, bu(a, o, i), pu(i, "hydrateRoot()", null), a = i, t.current.lanes = a, xn(t, a), xa(t), e[Ei] = t.current, ic(e), new In(t);
    }, b0.version = "19.2.7", typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
  })()), b0;
}
var Z2;
function jT() {
  if (Z2) return Vv.exports;
  Z2 = 1;
  function x() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) {
      if (process.env.NODE_ENV !== "production")
        throw new Error("^_^");
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(x);
      } catch (k) {
        console.error(k);
      }
    }
  }
  return process.env.NODE_ENV === "production" ? (x(), Vv.exports = NT()) : Vv.exports = HT(), Vv.exports;
}
var wT = jT(), nl = Sm();
async function BT(x) {
  const k = x.name.toLowerCase();
  if (k.endsWith(".csv")) return YT(x);
  if (k.endsWith(".pdf")) return qT(x);
  throw new Error("Неподдерживаемый формат. Загрузите CSV или PDF.");
}
async function YT(x) {
  const fe = (await x.text()).split(/\r?\n/).filter(Boolean), M = [];
  for (const P of fe) {
    const oe = P.split(/[,;\t]/);
    for (const Te of oe) {
      const F = Te.trim().replace(/"/g, "");
      F.startsWith("01") && F.length > 25 && M.push(F);
    }
  }
  return M;
}
async function qT(x) {
  const k = await x.arrayBuffer(), fe = new TextDecoder("utf-8", { fatal: !1 }).decode(k), M = /01\d{14}21[\w\d]{6,}[\dA-Z]{4,}/g;
  return fe.match(M) || [];
}
function GT(x) {
  const k = x.match(/^01(\d{14})/);
  return k ? k[1] : "";
}
const eE = "wb_nomenclature";
function tE() {
  try {
    const x = localStorage.getItem(eE);
    return x ? JSON.parse(x) : [];
  } catch {
    return [];
  }
}
function J2(x) {
  localStorage.setItem(eE, JSON.stringify(x));
}
async function LT(x) {
  const k = tE(), fe = /* @__PURE__ */ new Map();
  for (const P of k)
    for (const oe of P.sizes)
      oe.barcode && fe.set(oe.barcode, { product: P, size: oe });
  const M = /* @__PURE__ */ new Map();
  for (const [P] of fe) {
    const oe = P.slice(0, 12);
    M.set(oe, P);
  }
  return x.map((P) => {
    const oe = GT(P);
    if (!oe)
      return { kiz: P, gtin: "", barcode: "", article: "", name: "", color: "", size: "", matched: !1 };
    const Te = oe.slice(1, 13), F = M.get(Te) || "", le = F ? fe.get(F) : void 0;
    return le ? {
      kiz: P,
      gtin: oe,
      barcode: le.size.barcode,
      article: le.product.article,
      name: `${le.product.brand} ${le.product.name}`.trim(),
      color: "",
      size: le.size.techSize,
      matched: !0
    } : { kiz: P, gtin: oe, barcode: "", article: "", name: "", color: "", size: "", matched: !1 };
  });
}
function K2(x) {
  return {
    nmId: x.nmID,
    article: x.vendorCode,
    name: x.title,
    brand: x.brand,
    sizes: (x.sizes || []).map((k) => {
      var fe;
      return {
        barcode: ((fe = k.skus) == null ? void 0 : fe[0]) || "",
        techSize: k.techSize || "",
        wbSize: k.wbSize || ""
      };
    })
  };
}
async function XT() {
  var P, oe;
  const x = window.callWbProxy;
  if (x) {
    const Te = [];
    let F;
    for (; ; ) {
      const le = await x("content_cards", {
        limit: 100,
        withPhoto: -1,
        cursorNmId: F
      });
      if (!le) throw new Error("Не удалось загрузить номенклатуру. Проверьте кабинет и токен WB.");
      const V = le.cards || [];
      if (!V.length || (V.forEach((me) => Te.push(K2(me))), F = (P = le.cursor) == null ? void 0 : P.nmID, !F)) break;
    }
    return J2(Te), Te;
  }
  const k = localStorage.getItem("wb_token_content") || "";
  if (!k) throw new Error("Токен не задан. Зайдите в Настройки.");
  let fe = 0;
  const M = [];
  for (; ; ) {
    const Te = `https://content-api.wildberries.ru/content/v2/get/cards/list?limit=100${fe ? `&cursor=${fe}` : ""}`, F = await fetch(Te, { headers: { Authorization: k } });
    if (!F.ok) throw new Error(`WB API: ${F.status} ${F.statusText}`);
    const le = await F.json(), V = le.cards || [];
    if (!V.length || (V.forEach((me) => M.push(K2(me))), fe = ((oe = le.cursor) == null ? void 0 : oe.nmID) || 0, !fe)) break;
  }
  return J2(M), M;
}
function QT() {
  return typeof window.callWbProxy == "function";
}
function VT() {
  const [x, k] = nl.useState([]), [fe, M] = nl.useState(!1), [P, oe] = nl.useState(""), [Te, F] = nl.useState(""), [le, V] = nl.useState(/* @__PURE__ */ new Set());
  nl.useEffect(() => {
    k(tE());
  }, []);
  const me = async () => {
    M(!0);
    try {
      const ie = await XT();
      k(ie);
    } catch (ie) {
      alert(ie.message);
    } finally {
      M(!1);
    }
  }, B = nl.useMemo(() => [...new Set(x.map((ie) => ie.brand).filter(Boolean))].sort(), [x]), C = nl.useMemo(
    () => x.filter((ie) => {
      const be = P.toLowerCase(), Ue = !be || ie.article.toLowerCase().includes(be) || ie.name.toLowerCase().includes(be) || ie.sizes.some((mt) => mt.barcode.includes(be)), Jt = !Te || ie.brand === Te;
      return Ue && Jt;
    }),
    [x, P, Te]
  ), ue = (ie) => V((be) => {
    const Ue = new Set(be);
    return Ue.has(ie) ? Ue.delete(ie) : Ue.add(ie), Ue;
  }), xe = (ie) => {
    localStorage.setItem("selected_barcode", ie), document.dispatchEvent(new CustomEvent("switch-tab", { detail: "print" }));
  };
  return /* @__PURE__ */ K.jsxs("div", { className: "space-y-4 max-w-4xl", children: [
    /* @__PURE__ */ K.jsxs("div", { className: "flex flex-col sm:flex-row gap-3", children: [
      /* @__PURE__ */ K.jsx(
        "input",
        {
          value: P,
          onChange: (ie) => oe(ie.target.value),
          placeholder: "Поиск по артикулу, баркоду, названию...",
          className: "flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 min-h-[44px] text-sm text-white placeholder-white/30 outline-none focus:border-purple-500/50 transition-colors"
        }
      ),
      /* @__PURE__ */ K.jsxs(
        "select",
        {
          value: Te,
          onChange: (ie) => F(ie.target.value),
          className: "bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 min-h-[44px] text-sm text-white outline-none focus:border-purple-500/50 transition-colors",
          children: [
            /* @__PURE__ */ K.jsx("option", { value: "", children: "Все бренды" }),
            B.map((ie) => /* @__PURE__ */ K.jsx("option", { value: ie, children: ie }, ie))
          ]
        }
      ),
      /* @__PURE__ */ K.jsx(
        "button",
        {
          type: "button",
          onClick: me,
          disabled: fe,
          className: "px-5 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap",
          children: fe ? "⏳ Синхронизация..." : "🔄 Синхронизировать с WB"
        }
      )
    ] }),
    /* @__PURE__ */ K.jsxs("p", { className: "text-sm text-white/40", children: [
      "Найдено: ",
      C.length,
      " товаров",
      x.length > 0 && ` из ${x.length}`
    ] }),
    /* @__PURE__ */ K.jsxs("div", { className: "space-y-2", children: [
      C.map((ie) => /* @__PURE__ */ K.jsxs("div", { className: "border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02]", children: [
        /* @__PURE__ */ K.jsxs(
          "button",
          {
            type: "button",
            onClick: () => ue(ie.nmId),
            className: "w-full flex items-center gap-4 px-5 py-4 min-h-[44px] text-left hover:bg-white/[0.03] transition-colors duration-150",
            children: [
              /* @__PURE__ */ K.jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ K.jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
                  /* @__PURE__ */ K.jsx("span", { className: "font-medium text-white text-sm", children: ie.name }),
                  /* @__PURE__ */ K.jsx("span", { className: "text-xs px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300", children: ie.brand })
                ] }),
                /* @__PURE__ */ K.jsxs("div", { className: "text-xs text-white/40 mt-0.5", children: [
                  "Арт: ",
                  ie.article,
                  " · ",
                  ie.sizes.length,
                  " размеров"
                ] })
              ] }),
              /* @__PURE__ */ K.jsx("span", { className: `text-white/30 transition-transform duration-200 ${le.has(ie.nmId) ? "rotate-180" : ""}`, children: "▼" })
            ]
          }
        ),
        le.has(ie.nmId) && /* @__PURE__ */ K.jsx("div", { className: "border-t border-white/5 overflow-x-auto", children: /* @__PURE__ */ K.jsxs("table", { className: "w-full text-xs", children: [
          /* @__PURE__ */ K.jsx("thead", { children: /* @__PURE__ */ K.jsxs("tr", { className: "border-b border-white/5", children: [
            /* @__PURE__ */ K.jsx("th", { className: "text-left px-5 py-2.5 text-white/40 font-medium", children: "Размер" }),
            /* @__PURE__ */ K.jsx("th", { className: "text-left px-5 py-2.5 text-white/40 font-medium", children: "WB-размер" }),
            /* @__PURE__ */ K.jsx("th", { className: "text-left px-5 py-2.5 text-white/40 font-medium", children: "Баркод" })
          ] }) }),
          /* @__PURE__ */ K.jsx("tbody", { children: ie.sizes.map((be, Ue) => /* @__PURE__ */ K.jsxs("tr", { className: "border-b border-white/[0.03] hover:bg-white/[0.02]", children: [
            /* @__PURE__ */ K.jsx("td", { className: "px-5 py-2.5 text-white", children: be.techSize }),
            /* @__PURE__ */ K.jsx("td", { className: "px-5 py-2.5 text-white/60", children: be.wbSize }),
            /* @__PURE__ */ K.jsx("td", { className: "px-5 py-2.5", children: /* @__PURE__ */ K.jsx(
              "button",
              {
                type: "button",
                onClick: () => xe(be.barcode),
                className: "font-mono text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors",
                children: be.barcode
              }
            ) })
          ] }, Ue)) })
        ] }) })
      ] }, ie.nmId)),
      C.length === 0 && /* @__PURE__ */ K.jsx("div", { className: "text-center py-16 text-white/30", children: x.length === 0 ? "📦 Нажмите «Синхронизировать с WB» чтобы загрузить номенклатуру" : "🔍 Ничего не найдено" })
    ] })
  ] });
}
function ZT({ record: x }) {
  const k = nl.useRef(null), fe = nl.useRef(null);
  return nl.useEffect(() => {
    let M = !1;
    return import("./bwip-js-DyQIRboM.js").then((P) => {
      if (!M) {
        if (k.current && x.barcode)
          try {
            P.default.toCanvas(k.current, {
              bcid: "ean13",
              text: x.barcode,
              scale: 2,
              height: 8,
              includetext: !0
            });
          } catch {
          }
        if (fe.current && x.kiz)
          try {
            P.default.toCanvas(fe.current, {
              bcid: "datamatrix",
              text: x.kiz.slice(0, 80),
              scale: 3
            });
          } catch {
          }
      }
    }), () => {
      M = !0;
    };
  }, [x]), /* @__PURE__ */ K.jsxs("div", { className: "marking-label border border-white/10 rounded-xl p-3 bg-white print:bg-white print:border-black print:break-after-page print:rounded-none", children: [
    /* @__PURE__ */ K.jsx("p", { className: "text-[9px] text-black font-medium leading-tight mb-1 truncate", children: x.name }),
    /* @__PURE__ */ K.jsxs("p", { className: "text-[8px] text-gray-600 mb-2", children: [
      "Арт: ",
      x.article,
      " · Р: ",
      x.size
    ] }),
    /* @__PURE__ */ K.jsxs("div", { className: "flex gap-2 items-center", children: [
      /* @__PURE__ */ K.jsx("canvas", { ref: k, className: "max-w-[120px]" }),
      /* @__PURE__ */ K.jsx("canvas", { ref: fe, className: "w-12 h-12" })
    ] }),
    /* @__PURE__ */ K.jsxs("p", { className: "text-[6px] text-gray-400 mt-1 break-all", children: [
      x.kiz.slice(0, 32),
      "…"
    ] })
  ] });
}
function JT(x, k) {
  return x.length > k ? `${x.slice(0, k - 1)}…` : x;
}
function KT() {
  try {
    return JSON.parse(localStorage.getItem("label_template") || "{}");
  } catch {
    return {};
  }
}
async function $T(x) {
  const [{ jsPDF: k }, fe] = await Promise.all([import("./jspdf.es.min-bo7Ri0Hj.js").then((B) => B.j), import("./bwip-js-DyQIRboM.js")]), M = x.filter((B) => B.matched);
  if (!M.length) return;
  const P = KT(), oe = P.width || 58, Te = P.height || 40, F = P.showText !== !1, le = P.showEAN !== !1 && !P.dmOnly, V = P.showDM !== !1 || P.dmOnly, me = new k({
    orientation: oe > Te ? "landscape" : "portrait",
    unit: "mm",
    format: [oe, Te]
  });
  for (let B = 0; B < M.length; B++) {
    const C = M[B];
    if (B > 0 && me.addPage([oe, Te], oe > Te ? "landscape" : "portrait"), F && (me.setFontSize(6), me.setTextColor(0, 0, 0), me.text(JT(C.name, 40), 2, 5), me.text(`Арт: ${C.article}  Р: ${C.size}`, 2, 9)), le)
      try {
        const ue = document.createElement("canvas");
        fe.default.toCanvas(ue, {
          bcid: "ean13",
          text: C.barcode,
          scale: 2,
          height: 8,
          includetext: !0,
          textxalign: "center"
        }), me.addImage(ue.toDataURL("image/png"), "PNG", 2, 11, 35, 14);
      } catch {
        me.text(C.barcode, 2, 18);
      }
    if (V)
      try {
        const ue = document.createElement("canvas");
        fe.default.toCanvas(ue, {
          bcid: "datamatrix",
          text: C.kiz,
          scale: 3
        }), me.addImage(ue.toDataURL("image/png"), "PNG", 38, 11, 18, 18);
      } catch {
        me.setFontSize(4), me.text("DataMatrix", 38, 20);
      }
    me.setFontSize(4), me.setTextColor(100, 100, 100), me.text(C.kiz.slice(0, 40), 2, Te - 2);
  }
  me.save(`markings_${Date.now()}.pdf`);
}
const Kv = "marking_logs";
function kT(x) {
  try {
    const k = localStorage.getItem(Kv), fe = k ? JSON.parse(k) : [];
    fe.unshift({ ts: Date.now(), ...x }), localStorage.setItem(Kv, JSON.stringify(fe.slice(0, 50)));
  } catch {
  }
}
function $2() {
  try {
    const x = localStorage.getItem(Kv);
    return x ? JSON.parse(x) : [];
  } catch {
    return [];
  }
}
function WT() {
  localStorage.removeItem(Kv);
}
function FT() {
  const [x, k] = nl.useState([]), [fe, M] = nl.useState(!1), [P, oe] = nl.useState([]), [Te, F] = nl.useState(!1), le = nl.useRef(null), V = async (ie) => {
    M(!0), oe([]);
    try {
      const be = await BT(ie);
      if (!be.length) throw new Error("КИЗ не найдены в файле.");
      const Ue = [...new Set(be)], Jt = be.length - Ue.length, mt = [];
      Jt > 0 && mt.push(`⚠️ Удалено дублей: ${Jt}`);
      const Mt = await LT(Ue), Bt = Mt.filter((qt) => !qt.matched).length;
      Bt > 0 && mt.push(`⚠️ Не найдено в номенклатуре: ${Bt} кодов`), oe(mt), k(Mt), kT({
        total: Mt.length,
        matched: Mt.filter((qt) => qt.matched).length,
        duplicates: Jt,
        errors: Bt
      });
    } catch (be) {
      oe([`❌ Ошибка обработки: ${be.message}`]);
    } finally {
      M(!1);
    }
  }, me = nl.useCallback(async (ie) => {
    ie.preventDefault(), F(!1);
    const be = ie.dataTransfer.files[0];
    be && await V(be);
  }, []), B = async (ie) => {
    var Ue;
    const be = (Ue = ie.target.files) == null ? void 0 : Ue[0];
    be && await V(be);
  }, C = () => window.print(), ue = async () => {
    M(!0);
    try {
      await $T(x);
    } finally {
      M(!1);
    }
  }, xe = x.filter((ie) => ie.matched).length;
  return /* @__PURE__ */ K.jsxs("div", { className: "space-y-6 max-w-5xl", children: [
    /* @__PURE__ */ K.jsxs(
      "div",
      {
        onDrop: me,
        onDragOver: (ie) => {
          ie.preventDefault(), F(!0);
        },
        onDragLeave: () => F(!1),
        onClick: () => {
          var ie;
          return (ie = le.current) == null ? void 0 : ie.click();
        },
        className: `border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${Te ? "border-purple-500 bg-purple-500/10" : "border-white/10 hover:border-white/20 bg-white/[0.02]"}`,
        children: [
          /* @__PURE__ */ K.jsx("input", { ref: le, type: "file", accept: ".csv,.pdf", className: "hidden", onChange: B }),
          /* @__PURE__ */ K.jsx("div", { className: "text-4xl mb-3", children: "📂" }),
          /* @__PURE__ */ K.jsx("p", { className: "text-white font-medium", children: "Перетащите CSV или PDF с КИЗ сюда" }),
          /* @__PURE__ */ K.jsx("p", { className: "text-white/40 text-sm mt-1", children: 'Поддерживаются файлы выгрузки Честного Знака "Текшер"' }),
          fe && /* @__PURE__ */ K.jsxs("div", { className: "mt-4 flex items-center justify-center gap-2 text-purple-400", children: [
            /* @__PURE__ */ K.jsx("div", { className: "w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" }),
            /* @__PURE__ */ K.jsx("span", { className: "text-sm", children: "Обработка файла..." })
          ] })
        ]
      }
    ),
    P.length > 0 && /* @__PURE__ */ K.jsx("div", { className: "rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1", children: P.map((ie, be) => /* @__PURE__ */ K.jsx("p", { className: "text-sm text-amber-400", children: ie }, be)) }),
    x.length > 0 && /* @__PURE__ */ K.jsxs("div", { className: "flex flex-col sm:flex-row gap-4", children: [
      /* @__PURE__ */ K.jsxs("div", { className: "flex-1 rounded-xl border border-white/5 bg-white/[0.02] p-4", children: [
        /* @__PURE__ */ K.jsx("div", { className: "text-2xl font-bold text-white", children: x.length }),
        /* @__PURE__ */ K.jsx("div", { className: "text-xs text-white/40 mt-1", children: "Всего КИЗ" })
      ] }),
      /* @__PURE__ */ K.jsxs("div", { className: "flex-1 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4", children: [
        /* @__PURE__ */ K.jsx("div", { className: "text-2xl font-bold text-purple-300", children: xe }),
        /* @__PURE__ */ K.jsx("div", { className: "text-xs text-white/40 mt-1", children: "Сопоставлено" })
      ] }),
      /* @__PURE__ */ K.jsxs("div", { className: "flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-4", children: [
        /* @__PURE__ */ K.jsx("div", { className: "text-2xl font-bold text-white/70", children: x.length - xe }),
        /* @__PURE__ */ K.jsx("div", { className: "text-xs text-white/40 mt-1", children: "Не найдено" })
      ] })
    ] }),
    xe > 0 && /* @__PURE__ */ K.jsxs("div", { className: "flex flex-wrap gap-3", children: [
      /* @__PURE__ */ K.jsx(
        "button",
        {
          type: "button",
          onClick: C,
          className: "flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-sm font-semibold transition-colors duration-200",
          children: "🖨️ Массовая печать"
        }
      ),
      /* @__PURE__ */ K.jsx(
        "button",
        {
          type: "button",
          onClick: ue,
          disabled: fe,
          className: "flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.03] text-white text-sm font-medium transition-colors duration-200 disabled:opacity-50",
          children: "📥 Скачать PDF-ленту"
        }
      )
    ] }),
    x.length > 0 && /* @__PURE__ */ K.jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 print:grid-cols-1", children: x.filter((ie) => ie.matched).map((ie, be) => /* @__PURE__ */ K.jsx(ZT, { record: ie }, `${ie.kiz}-${be}`)) })
  ] });
}
function IT() {
  const [x, k] = nl.useState(""), [fe, M] = nl.useState(""), [P, oe] = nl.useState(""), [Te, F] = nl.useState($2()), le = QT();
  nl.useEffect(() => {
    k(localStorage.getItem("wb_token_content") || ""), M(localStorage.getItem("wb_token_marketplace") || ""), F($2());
  }, []);
  const V = () => {
    localStorage.setItem("wb_token_content", x.trim()), localStorage.setItem("wb_token_marketplace", fe.trim()), oe("✅ Токены сохранены"), setTimeout(() => oe(""), 3e3);
  }, me = async (C, ue) => {
    oe("⏳ Проверка соединения...");
    try {
      const ie = await fetch(ue === "content" ? "https://content-api.wildberries.ru/content/v2/get/cards/list?limit=1" : "https://marketplace-api.wildberries.ru/api/v3/supplies?limit=1", { headers: { Authorization: C.trim() } });
      oe(ie.ok ? "✅ Подключение успешно!" : `❌ Ошибка ${ie.status}: ${ie.statusText}`);
    } catch (xe) {
      oe(`❌ Сетевая ошибка: ${xe.message}`);
    }
    setTimeout(() => oe(""), 5e3);
  }, B = () => {
    WT(), F([]);
  };
  return /* @__PURE__ */ K.jsxs("div", { className: "space-y-8 max-w-2xl", children: [
    le ? /* @__PURE__ */ K.jsx("div", { className: "rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-sm text-white/70", children: "NR Space использует защищённый WB Proxy с токеном выбранного кабинета. Ручные токены нужны только при автономном запуске модуля." }) : /* @__PURE__ */ K.jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ K.jsx("div", { className: "text-xs text-white/40 uppercase tracking-widest", children: "Токены WB API" }),
      [
        {
          label: "Токен «Контент» (для номенклатуры)",
          key: "content",
          val: x,
          set: k
        },
        {
          label: "Токен «Маркетплейс» (для поставок)",
          key: "marketplace",
          val: fe,
          set: M
        }
      ].map(({ label: C, key: ue, val: xe, set: ie }) => /* @__PURE__ */ K.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ K.jsx("div", { className: "text-sm text-white/60", children: C }),
        /* @__PURE__ */ K.jsxs("div", { className: "flex flex-col sm:flex-row gap-2", children: [
          /* @__PURE__ */ K.jsx(
            "input",
            {
              type: "password",
              value: xe,
              onChange: (be) => ie(be.target.value),
              placeholder: "eyJhbGciOiJFUzI1NiIs...",
              className: "flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 min-h-[44px] text-sm text-white font-mono placeholder-white/20 outline-none focus:border-purple-500/50 transition-colors"
            }
          ),
          /* @__PURE__ */ K.jsx(
            "button",
            {
              type: "button",
              onClick: () => me(xe, ue),
              className: "px-4 py-2.5 min-h-[44px] rounded-xl border border-white/10 text-white/60 hover:border-white/20 hover:text-white text-sm transition-colors whitespace-nowrap",
              children: "Проверить"
            }
          )
        ] })
      ] }, ue)),
      /* @__PURE__ */ K.jsx(
        "button",
        {
          type: "button",
          onClick: V,
          className: "px-5 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors",
          children: "💾 Сохранить токены"
        }
      )
    ] }),
    P && /* @__PURE__ */ K.jsx(
      "p",
      {
        className: `text-sm ${P.startsWith("✅") ? "text-green-400" : P.startsWith("❌") ? "text-red-400" : "text-white/60"}`,
        children: P
      }
    ),
    /* @__PURE__ */ K.jsxs("div", { children: [
      /* @__PURE__ */ K.jsxs("div", { className: "flex items-center justify-between mb-3", children: [
        /* @__PURE__ */ K.jsx("div", { className: "text-xs text-white/40 uppercase tracking-widest", children: "Лог сессий" }),
        Te.length > 0 && /* @__PURE__ */ K.jsx(
          "button",
          {
            type: "button",
            onClick: B,
            className: "text-xs text-white/30 hover:text-white/60 transition-colors min-h-[44px] px-2",
            children: "Очистить"
          }
        )
      ] }),
      Te.length === 0 ? /* @__PURE__ */ K.jsx("p", { className: "text-sm text-white/30 py-6 text-center", children: "Сессий ещё не было" }) : /* @__PURE__ */ K.jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ K.jsxs("table", { className: "w-full text-xs", children: [
        /* @__PURE__ */ K.jsx("thead", { children: /* @__PURE__ */ K.jsx("tr", { className: "border-b border-white/5", children: ["Дата/Время", "Всего КИЗ", "Сопоставлено", "Дублей", "Ошибок"].map((C) => /* @__PURE__ */ K.jsx("th", { className: "text-left px-4 py-2.5 text-white/40 font-medium", children: C }, C)) }) }),
        /* @__PURE__ */ K.jsx("tbody", { children: Te.map((C, ue) => /* @__PURE__ */ K.jsxs("tr", { className: "border-b border-white/[0.03]", children: [
          /* @__PURE__ */ K.jsx("td", { className: "px-4 py-2.5 text-white/60", children: new Date(C.ts).toLocaleString("ru-RU") }),
          /* @__PURE__ */ K.jsx("td", { className: "px-4 py-2.5 text-white", children: C.total }),
          /* @__PURE__ */ K.jsx("td", { className: "px-4 py-2.5 text-purple-300", children: C.matched }),
          /* @__PURE__ */ K.jsx("td", { className: "px-4 py-2.5 text-amber-400", children: C.duplicates }),
          /* @__PURE__ */ K.jsx("td", { className: "px-4 py-2.5 text-white/50", children: C.errors })
        ] }, ue)) })
      ] }) })
    ] })
  ] });
}
const k2 = {
  name: "Объединённая 58×40",
  width: 58,
  height: 40,
  showText: !0,
  showEAN: !0,
  showDM: !0,
  dmOnly: !1,
  dmExtra: !1
}, PT = [
  { label: "58×40 мм (стандарт)", w: 58, h: 40 },
  { label: "70×50 мм (увеличенный)", w: 70, h: 50 },
  { label: "40×25 мм (мини)", w: 40, h: 25 }
];
function eA() {
  const [x, k] = nl.useState(k2);
  nl.useEffect(() => {
    const P = localStorage.getItem("label_template");
    if (P)
      try {
        k({ ...k2, ...JSON.parse(P) });
      } catch {
      }
  }, []);
  const fe = () => {
    localStorage.setItem("label_template", JSON.stringify(x)), alert("Шаблон сохранён");
  }, M = [
    ["showText", "Текст товара (название, артикул, размер)"],
    ["showEAN", "Штрихкод EAN-13 (баркод WB)"],
    ["showDM", "DataMatrix Честного Знака"],
    ["dmOnly", "Только Честный Знак (без ШК и текста)"],
    ["dmExtra", "ЧЗ на отдельной наклейке следом"]
  ];
  return /* @__PURE__ */ K.jsxs("div", { className: "space-y-6 max-w-2xl", children: [
    /* @__PURE__ */ K.jsxs("div", { children: [
      /* @__PURE__ */ K.jsx("div", { className: "text-xs text-white/40 uppercase tracking-widest mb-3", children: "Размер ленты" }),
      /* @__PURE__ */ K.jsx("div", { className: "flex flex-wrap gap-2", children: PT.map((P) => /* @__PURE__ */ K.jsx(
        "button",
        {
          type: "button",
          onClick: () => k((oe) => ({ ...oe, width: P.w, height: P.h })),
          className: `px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium border transition-colors ${x.width === P.w && x.height === P.h ? "bg-purple-600 border-purple-500 text-white" : "border-white/10 text-white/60 hover:border-white/20 hover:text-white"}`,
          children: P.label
        },
        P.label
      )) })
    ] }),
    /* @__PURE__ */ K.jsxs("div", { children: [
      /* @__PURE__ */ K.jsx("div", { className: "text-xs text-white/40 uppercase tracking-widest mb-3", children: "Состав этикетки" }),
      /* @__PURE__ */ K.jsx("div", { className: "space-y-3", children: M.map(([P, oe]) => /* @__PURE__ */ K.jsxs("label", { className: "flex items-center gap-3 cursor-pointer group min-h-[44px]", children: [
        /* @__PURE__ */ K.jsx(
          "button",
          {
            type: "button",
            role: "switch",
            "aria-checked": !!x[P],
            onClick: () => k((Te) => ({ ...Te, [P]: !Te[P] })),
            className: `w-11 h-6 rounded-full border transition-colors duration-200 flex-shrink-0 ${x[P] ? "bg-purple-600 border-purple-500" : "bg-white/5 border-white/10"}`,
            children: /* @__PURE__ */ K.jsx(
              "span",
              {
                className: `block w-4 h-4 rounded-full bg-white mt-0.5 transition-transform duration-200 ${x[P] ? "translate-x-6" : "translate-x-0.5"}`
              }
            )
          }
        ),
        /* @__PURE__ */ K.jsx("span", { className: "text-sm text-white/70 group-hover:text-white transition-colors", children: oe })
      ] }, P)) })
    ] }),
    /* @__PURE__ */ K.jsxs("div", { children: [
      /* @__PURE__ */ K.jsx("div", { className: "text-xs text-white/40 uppercase tracking-widest mb-3", children: "Схема этикетки" }),
      /* @__PURE__ */ K.jsxs(
        "div",
        {
          className: "border border-white/10 rounded-xl bg-white/[0.02] p-3 relative max-w-full",
          style: { width: `${Math.min(x.width * 3, 280)}px`, height: `${x.height * 3}px` },
          children: [
            x.showText && /* @__PURE__ */ K.jsx("div", { className: "absolute top-2 left-2 right-2 h-6 rounded bg-white/10 flex items-center px-2", children: /* @__PURE__ */ K.jsx("span", { className: "text-[8px] text-white/40", children: "Название / Артикул / Размер" }) }),
            x.showEAN && !x.dmOnly && /* @__PURE__ */ K.jsx("div", { className: "absolute top-10 left-2 w-3/5 h-10 rounded bg-white/10 flex items-center justify-center", children: /* @__PURE__ */ K.jsx("span", { className: "text-[8px] text-white/40", children: "EAN-13" }) }),
            (x.showDM || x.dmOnly) && !x.dmExtra && /* @__PURE__ */ K.jsx("div", { className: "absolute top-10 right-2 w-10 h-10 rounded bg-white/10 flex items-center justify-center", children: /* @__PURE__ */ K.jsx("span", { className: "text-[8px] text-white/40", children: "DM" }) })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ K.jsx(
      "button",
      {
        type: "button",
        onClick: fe,
        className: "px-6 py-2.5 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors",
        children: "💾 Сохранить шаблон"
      }
    )
  ] });
}
const W2 = [
  { id: "print", label: "🖨️ Печать и Склейка" },
  { id: "nomen", label: "📦 Номенклатура" },
  { id: "tpl", label: "🎨 Конструктор шаблонов" },
  { id: "settings", label: "⚙️ Настройки и Логи" }
];
function tA() {
  const [x, k] = nl.useState("print");
  return nl.useEffect(() => {
    const fe = (M) => {
      const P = M.detail;
      W2.some((oe) => oe.id === P) && k(P);
    };
    return document.addEventListener("switch-tab", fe), () => document.removeEventListener("switch-tab", fe);
  }, []), /* @__PURE__ */ K.jsxs("div", { className: "marking-module min-h-[60vh] text-white", children: [
    /* @__PURE__ */ K.jsxs("div", { className: "border-b border-white/5 px-4 sm:px-6 py-5", children: [
      /* @__PURE__ */ K.jsx("h1", { className: "text-xl font-bold text-white", children: "Маркировка и Штрихкоды" }),
      /* @__PURE__ */ K.jsx("p", { className: "text-sm text-white/40 mt-1", children: "Zero-Storage — вся обработка в браузере, данные не хранятся на сервере" })
    ] }),
    /* @__PURE__ */ K.jsx("div", { className: "border-b border-white/5 px-4 sm:px-6", children: /* @__PURE__ */ K.jsx("div", { className: "flex gap-1 -mb-px overflow-x-auto", children: W2.map((fe) => /* @__PURE__ */ K.jsx(
      "button",
      {
        type: "button",
        onClick: () => k(fe.id),
        className: `px-4 py-3 min-h-[44px] text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-200 ${x === fe.id ? "border-purple-500 text-white" : "border-transparent text-white/40 hover:text-white/70"}`,
        children: fe.label
      },
      fe.id
    )) }) }),
    /* @__PURE__ */ K.jsxs("div", { className: "p-4 sm:p-6", children: [
      x === "print" && /* @__PURE__ */ K.jsx(FT, {}),
      x === "nomen" && /* @__PURE__ */ K.jsx(VT, {}),
      x === "tpl" && /* @__PURE__ */ K.jsx(eA, {}),
      x === "settings" && /* @__PURE__ */ K.jsx(IT, {})
    ] })
  ] });
}
const F2 = document.getElementById("marking-root");
F2 && !window.__markingMounted && (wT.createRoot(F2).render(/* @__PURE__ */ K.jsx(tA, {})), window.__markingMounted = !0);
