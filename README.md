## next steps

- add a function `useObservableProps` (logic like `useProxy` but for props changes und auch ein ref objekt was immer aktuell ist wenn man drauf zugreift)
- add a function `useOnMount()` => a wrapper for `useEffect(..., [])` where we can introduce timers und co
    - sollte aber auch generator-funktionen verstehen können (die dann abgebrochen werden können)
    - ist wichtig, da sonst klassische timer nicht funktionieren wie erhofft
- dokumentiere, wie ein autocomplete beispiel aussieht
- füge beispiele für generator-ersteller hinzu (setInterval, firestore)
- useEffect und useAsyncEffect in gleiche Funktion schreiben - check https://stackoverflow.com/questions/16754956/check-if-function-is-a-generator
- tests für async erweitern
- im nächsten projekt damit arbeiten


## js event loop explained with code

```javascript
function loop2Seconds() {
  const s = new Date().getSeconds();
  while (true) {
    if (new Date().getSeconds() - s >= 2) return console.log("Good, looped for 2 seconds");
  }
}

setTimeout(() => {
  console.log("A1");
  loop2Seconds();
  console.log("A2");
}, 0);
setTimeout(() => {
  console.log("B1");
  loop2Seconds();
  console.log("B2");
}, 0);
console.log("C1");
loop2Seconds();
console.log("C2");
```

log output:

```
C1
Good, looped for 2 seconds
C2
A1
Good, looped for 2 seconds
A2
B1
Good, looped for 2 seconds
B2
```

## generator finally explained with code

```javascript
function* gen() {
  try {
    try {
      console.log("function begin START");
    } finally {
      console.log("FINALLY function begin CALLED START");
    }
    try {
      console.log("yield 1 START");
      yield 1;
    } finally {
      console.log("FINALLY yield 1 CALLED START");
    }
    try {
      console.log("yield 1 DONE");
    } finally {
      console.log("FINALLY yield 1 CALLED DONE");
    }
    yield 2;
    try {
      console.log("yield 2 DONE");
    } finally {
      console.log("FINALLY yield 2 CALLED DONE");
    }
    yield 3;
    console.log("yield 3 DONE");
  } finally {
    console.log("FINALLY CALLED!");
  }
}

const g = gen();

console.log(g.next()); // { value: 1, done: false }
console.log(g.return("foo")); // { value: "foo", done: true }
console.log(g.next()); // { value: undefined, done: true }
```

log output:

```
function begin START
FINALLY function begin CALLED START
yield 1 START
{value: 1, done: false}
FINALLY yield 1 CALLED START
FINALLY CALLED!
{value: "foo", done: true}
{value: undefined, done: true}
```

## async generator finally not always returns value

```javascript
async function* gen() {
  try {
    console.log("function begin START");
    await new Promise((r) => setTimeout(r, 500));
    console.log("yield 1 START");
    yield 1;
    console.log("yield 1 DONE");
    yield 2;
    console.log("yield 2 DONE");
    yield 3;
    console.log("yield 3 DONE");
  } finally {
    console.log("FINALLY CALLED!");
    return () => {};
  }
}

async function doIt() {
  const g = gen();

  console.log("1. g.next", await g.next()); // { value: 1, done: false }
  console.log("2. g.next", await g.next()); // { value: 2, done: false }
  console.log("3. g.next", await g.next()); // { value: 3, done: false }
  console.log("4. g.next", await g.next()); // { value: () => {}, done: true }
  console.log("5. g.next", await g.next()); // { value: undefined, done: true }
  console.log("5. g.next", await g.return()); // { value: undefined, done: true }
}

doIt().then(() => console.log("ready"));
```

log output:

```
function begin START
yield 1 START
1. g.next {value: 1, done: false}
yield 1 DONE
2. g.next {value: 2, done: false}
yield 2 DONE
3. g.next {value: 3, done: false}
yield 3 DONE
FINALLY CALLED!
4. g.next {done: true, value: ƒ}
5. g.next {value: undefined, done: true}
5. g.next {value: undefined, done: true}
ready
```
