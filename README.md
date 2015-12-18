[![Build Status](https://travis-ci.org/ssnau/dataton.svg?branch=master)](https://travis-ci.org/ssnau/dataton)

Dataton
------

一个简单的基于cursor的状态对象实现。

install
-----

```
npm install dataton
```  

Example
-------

```
var State = require('dataton');
// 任意一个cursor导致的更新都将让state内部的指针指向新的状态
// 且之后的cursor返回值都是基于这个新的状态的路径的值
var state = new State({
       name: 'jack',
       profile: {
               gender: 'male'
           }
});
 
// 通过cursor方法得到cursor
var nameCursor = state.cursor('name');
var profileCursor = state.cursor('profile');
var genderCursor = state.cursor('profile.gender');
 
// 通过调用cursor函数得到cursor对应的值
assert.equal(nameCursor(), 'jack');
assert.equal(genderCursor(), 'male');
 
// 通过调用cursor的update方法，更新其对应值
nameCursor.update('john');
// 如果只想更新其部分值，可传入路径。
profileCursor.update('gender', 'female'); 
// 如果想对对象内部进行操作，可传入函数
// 其返回值将被设成要更新的值
profileCursor.upate(function(profile) {
  profile.name = "benson";
  profile.gender = "female";
  return profile;
});

// 能过调用cursor函数获得已经更新的值
assert.equal(nameCursor(), 'john');
assert.equal(genderCursor(), 'female');
```

API
-------

###State

#### cursor(path)

- `path` 数组或字符串，表示cursor指定的路径。

返回一个cursor，永远指向state的path路径。

```
var state = new State({
    profile: {
        name: 'jack'
    },
    "big.secret": {
        key: "open-the-door"
    }
});
// path 可以是以点分隔的路径
var cursor = state.cursor('profile.name');
assert.equal(cursor(), 'jack');

// path可以是数组
var cursor = state.cursor(['big.secret', 'key']);
assert.equal(cursor(), 'open-the-door');
```

#### load(obj)

将state的内部数据更新为obj。

#### get(path)

读取state的path路径上的数据，若路径不存在则返回undefined.
path可以是字符串或数据。

```
var state = new State();
state.load({name: 'jack'}); // 通过load加载
assert.equal(state.get('name'), 'jack'); // 通过get获取
```

#### set(path, value)

更新path路径上的值为value

```
var state = new State();
state.load({name: 'jack'});
state.set('name', 'john'); // 修改为john了
assert.equal(state.get('name'), 'john'); 
```


#### toJS()

将state的内部数据输出为JSON对象供调试及读取。

#### on(eventName, callback)

监听事件，通常用于监听state的`change`事件。

### Cursor

#### @self()

一个cursor本身就是一个函数，调用自身将返回其游标对应的数据。

```
var state = new State();
state.load({name: 'jack'});
var cursor = state.cursor('name');
assert.equal(cursor(), 'jack');
```

### get(path)

`path`可是字符串也可是数组，表示要取值的相对路径。使用get方法是非常安全的，因为get方法并不会因为path不存在而抛出异常。

```
var state = new State();
state.load({
    profile: {
        name: "jack",
        age: 10,
        parent: {
            mother: {
                name: 'nina'
            },
            father: {
                name: 'chris'
            }
        }
    }
});
var cursor = state.cursor('profile');
assert.equal(cursor.get('parent.mother.name'), 'nina');
// 路径不存在，直接返回undefined
// 如果写成: cursor().some.other.path 将出错。
assert.equal(cursor.get('some.other.path'), undefined);
```

### update(path, sth) 或 update(sth) 或 update(function)

更新cursor对应路径上的值。
```
var state = new State();
state.load({
    profile: {
        name: "jack",
        age: 10,
        parent: {
            mother: {
                name: 'nina'
            },
            father: {
                name: 'chris'
            }
        }
    }
});

var cursor = state.cursor('profile');
// 更新指定路径上的值
cursor.update('parent.mother.name', 'rose');
assert.equal(cursor().parent.mother.name, 'rose');
// 更新整个cursor对应的值
cursor.update({name: 'monkey'});
assert.equal(cursor().name, 'monkey');
assert.equal(cursor.get('parent.mother.name'), undefined);

// 通过传入函数，更新整个cursor对应的值
cursor.update(function(profile) {
  profile.name = 'mm';
  profile.parent.mother.name = 'sarah';
  return profile; // do not forget this line
});
assert.equal(cursor().name, 'mm');
assert.equal(cursor.get('parent.mother.name'), sarah);
```

#### cursorFromObject(obj)

通过传入一个对象，来查找到它对应的cursor, 进而修改这个路径上的内容。
注意：必需是一个对象，不能是基本类型数据。

```
var state = new State();
state.load({
  profile: {
    name: 'jack',
    age: 18
  }
});

var profile = state.get('profile');
var profilecursor = state.cursorFromObject(profile);

cursor.update('name', 'john');
assert.equal(state.get('profile.name'), 'john');
```

### mergeUpdate(obj) 

将obj中所有键的路径，更新到cursor对应的值上, 这是一个深度merge。

```
var state = new State();
state.load({
    profile: {
        name: "jack",
        age: 10,
        parent: {
            mother: {
                name: 'nina'
            },
            father: {
                name: 'chris'
            }
        }
    }
});

var cursor = state.cursor('profile');
// 更新指定路径上的值
cursor.mergeUpdate({
    parent: {
        mother: {
            name: 'coffee'
        }
    }
});

// 更新后的cursor()值为：
{
    parent: {
        mother: { name: 'coffee' }
        father: { name: 'chris' }
    }
}

```


### namespace(path)

命名空间，如果我们的一些cursor的前缀是一样的，那么最好采用命名空间节省代码量。如：

```
var state = new State();
state.load({
    profile: {
        name: "jack",
        age: 10,
        parent: {
            mother: {
                name: 'nina'
            },
            father: {
                name: 'chris'
            }
        }
    }
});

// 设定一个命名空间
var ns = state.namespace('profile');

// 从命名空间开始查找cursor路径
var nameCursor = ns.cursor('name'); // 相当于state.cursor('profile.name');
var fatherCursor = ns.cursor('parent.father'); // 相当于state.cursor('profile.parent.father')

assert.equal(nameCursor(), 'jack');
assert.equal(fatherCursor().name, 'chris');
```

License
----
MIT
