v1.6.3 (2015-12-18)

- add travis ci
- fix bug for update(fn) with basic type

v1.6.2 (2015-12-17)

- fix update(fn) accidentally convert Array to be Array-Like Object
- add console.warn for non basic type

v1.6.0 (2015-12-01)

- cursor.update now can receive a function as updator

v1.5.2 (2015-12-01)

- state will emit `no-update` event when update fails
