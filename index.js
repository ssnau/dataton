var EventEmitter = require('eventemitter3');

/**
 * merge objects and create a result.
 * #NOTICE: for performance reason, avoid using arguments..
 */
function merge(a, b, c, d, e, f, g) {
    var dest = Array.isArray(a) ? [] : {}; // the type of the object is determined by the first argument
    if (g) throw Error('You pass too many args for merge method');
    // in case any of them not object
    try {
        [a, b, c, d, e, f]
            .filter(Boolean)
            .forEach(function(obj) {
                Object.keys(obj).forEach(function(k) {
                    dest[k] = obj[k];
                });
            });
    } catch (e) {
        return dest;
    }
    return dest;
}
function remove(array, index) {
    return array.filter(function(__, i) {
        return index !== i;
    });
}
function empty(obj) { return obj === undefined || obj === null || obj !== obj; }
function assign(obj, _path, value) {
    var path = _path.concat();
    var last = path.pop();
    while (path.length) {
        var p = path.shift();
        if (empty(obj[p])) obj[p] = {};
        obj = obj[p];
    }
    obj[last] = value;
}
function getIn(obj, _path) {
    var path = _path.concat();
    if (empty(obj) && path.length === 0) return obj;
    var last = path.pop();
    while (path.length) {
        var p = path.shift();
        obj = obj[p];
        if (empty(obj)) return void 0;
    }
    return empty(obj) ? void 0 : obj[last];
}

function traverseObject(obj, fn) {
    var keys = [];
    var val;
    function traverse(obj) {
        // 超过十层，自动终止，防止循环引用导致死循环
        if (keys.length >= 10) {
            fn(keys.concat(), obj);
            return;
        }

        val = fn(keys.concat(), obj);
        if (val === false) return;

        Object.keys(obj).forEach(function (key) {
            keys.push(key);
            traverse(obj[key]);
            keys.pop();
        });
    }

    traverse(obj);
}

function keyPathsCall(obj, fn) {
    traverseObject(obj, function(keys, o) {
        if (typeof o !== 'object' || keys.length >= 10) {
            fn(keys.concat(), o);
            return;
        }
    });
}

function State(state, reviver) {
  this.load(state || {});
  this.clearRecord();
  this.emit('change', this._state);
}
State.prototype = new EventEmitter;
State.prototype.load = function (state) {
  this._state = state;
  this.emit('change', this._state);
};
// deprecated.
State.prototype.toJS = function () {
  return this._state;
}
State.prototype.get = function (path) {
  if (!path) return this._state;
  return this.cursor(path)();
}
State.prototype.set = function (path, value) {
  return this.cursor(path).update(value);
};
State.prototype.update = State.prototype.set;

State.prototype.cursor = function (path, errorplaceholder) {
  if (!path) path = [];
  if (errorplaceholder) throw Error("cursor doesn't support a second argument");
  if (typeof path !== 'string' && !Array.isArray(path)) throw Error('State.prototype.cursor only accept string or array, ' + (typeof path) + ' is forbidden');
  if (typeof path === 'string') { path = path.split('.'); }
  var me = this;

  function ret(subpath) { return ret.get(subpath); }

  ret.get = function (subpath) {
    if (typeof subpath === 'string') { subpath = subpath.split('.'); }
    return getIn(me, ['_state'].concat(path).concat(typeof subpath === 'undefined' ? [] : subpath));
  };

  // please use `update` to update the cursor pointed value.
  ret.update = function (subpath, value) {
    if (typeof subpath === 'function') {
        throw Error('cursor.update does not support unserializable object such as function');
    }
    if (arguments.length === 1) { value = subpath; subpath = []; }
    if (typeof subpath === 'string') subpath = subpath.split('.');
    var p = ['_state'].concat(path.concat(subpath));
    if (getIn(me, p.concat()) !== value) {
        // 更新p路径上的所有变量的引用
        var i = 1;
        while(i < p.length) {
            var xpath = p.slice(0, i);
            xpath.length && INNER.assign(me, xpath, merge(getIn(me, xpath)));
            i++;
        }
        assign(me, p.concat(), value);
        me.emit('change', me._state);
    }
  };

  ret.mergeUpdate = function (value) {
    var changed, changedPaths = [];
    keyPathsCall(value, function(kpath, val) {
        var abspath = ['_state'].concat(path).concat(kpath);
        changed = !(getIn(me, abspath.concat()) === val);
        if (changed) changedPaths.push([abspath.concat(), val]);
    });

    var cached = [], JOIN_MARK = "!@#@";
    changedPaths.forEach(function(conf) {
        // 更新p路径上的所有变量的引用
        var i = 1;
        var p = conf[0];
        var v = conf[1];
        while(i < p.length) {
            var xpath = p.slice(0, i);
            if (cached.indexOf(xpath.join(JOIN_MARK)) > -1) break;
            cached.push(xpath.join(JOIN_MARK));
            xpath.length && INNER.assign(me, xpath, merge(getIn(me, xpath)));
            i++;
        }
        assign(me, p.concat(), v);
    });
    if (changedPaths.length) {
      me.emit('change', me._state);
    }
  };
  return ret;
}
State.prototype.cursorFromObject = function (obj) {
    if (typeof obj !== 'object') throw Error('parameter for cursorFromObject must be an object');
    var path = null;
    traverseObject(this._state, function (paths, object) {
        if (object === obj) {
            path = paths;
            return false; // terminate searching
        }
    });
    return path ? this.cursor(path) : void 0;
}
State.prototype.namespace = function (ns) {
    var me = this;
    if (typeof ns === 'string') { ns = ns.split('.'); }
    if (!Array.isArray(ns)) throw Error('namespace only accept string or array ' + (typeof ns) + ' is forbiddne');
    return {
        cursor: function (path) {
            if (!path) path = [];
            if (typeof path !== 'string' && !Array.isArray(path)) throw Error('State.prototype.cursor only accept string or array, ' + (typeof path) + ' is forbidden');
            if (typeof path === 'string') { path = path.split('.'); }
            return me.cursor(ns.concat(path));
        }
    };
}

// record api
State.prototype.clearRecord = function () { this._records = []; this._recordIndex = -1; }
State.prototype.canUndo = function () {
  var state = this._records[this._recordIndex - 1];
  return !!state;
};
State.prototype.canRedo = function () {
  var state = this._records[this._recordIndex + 1];
  return !!state;
}
State.prototype.undo = function() {  
  var state = this._records[this._recordIndex - 1];
  if (state) {
      this.load(state);
      this._recordIndex--;
  }
}
State.prototype.redo = function() { 
  var state = this._records[this._recordIndex + 1];
  if (state) {
      this.load(state);
      this._recordIndex++;
  }
}
State.prototype.snapshot = function () { 
  this._records[this._recordIndex + 1] = this._state;
  this._records.length = this._recordIndex + 2;
  this._recordIndex++;
}

// minimal set  util helper function to generate new array/object
State.util = {
    // 将array有副作用的方法push/pop/shift/unshift/sort实现一遍无副作用版的
    push: function (array, item) { return array.concat([item]); },
    unshift: function (array, item) { return [item].concat(array); },
    pop: function (array) { return remove(array, array.length -1); },
    shift: function (array) { return remove(array, 0); },
    sort: function (array, compareFn) { return array.concat().sort(compareFn); },
    reverse: function (array) { return array.concat().reverse(); },
    splice: function (array) { 
        var x = array.concat(); 
        var args = [].slice.call(arguments, 1);
        x.splice.apply(x, args); 
        return x;
   },

    // array remove
    remove: remove,
    // object merge
    merge: merge
};

/**
 * 如果直接修改Object.prototype，mocha的coverage会跑挂,大概是因为enumerable的原因
 */
function defindProps(obj, name, value) {
    if (Object.defineProperty) {
        Object.defineProperty(obj, name, {
              enumerable: false,
                configurable: true,
                  writable: true,
                    value: value
        });
    } else {
        obj[name] = value;
    }
}

State.X_PREFIX = 'x';
State.injectPrototype = function () {
    ['push', 'unshift', 'pop', 'shift', 'sort', 'reverse', 'splice', 'remove']
        .forEach(function(name) {
            defindProps(Array.prototype, 'x' + name, function(a, b) {
                return State.util[name](this, a, b);
            });
        });
    // argument对性能有很大影响，故单独放出
    defindProps(Array.prototype, State.X_PREFIX + 'splice', function () {
        return State.util.splice.apply(null , [this].concat([].slice.call(arguments)));
    });
    defindProps(Object.prototype, State.X_PREFIX + 'merge', function(a, b, c, d, e) {
        return merge(this, a, b, c, d, e);
    });
}

State.prototype.util = State.util;
State.prototype.injectPrototype = State.injectPrototype;

module.exports = State;

// For test reason
var INNER = State.INNER_FUNC = {
    assign: assign,
    keyPathsCall: keyPathsCall
};
