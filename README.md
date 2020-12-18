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

**TLDR;** synchronous execution is never intercepted by any calls 

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

## js event loop with promises

Anscheinend werden Promises vorher ausgeführt, aber kein Plan :-D

```javascript
setTimeout(() => {
  console.log("A1");
  loop2Seconds();
  console.log("A2");
}, 0);
Promise.resolve().then(() => {
  console.log("B1");
  loop2Seconds();
  console.log("B2");
});
console.log("C1");
loop2Seconds();
console.log("C2");
```

log output

```
C1
C2
B1
B2
A1
A2
```

## js event loop with async function

```javascript
(async function () {
  setTimeout(() => {
    console.log("A1");
    loop2Seconds();
    console.log("A2");
  }, 0);
  await new Promise((resolve) => {
    console.log("B1");
    loop2Seconds();
    console.log("B2");
    setTimeout(() => {
      console.log("C1");
      loop2Seconds();
      console.log("C2");
      resolve();
    }, 0);
  });
  console.log("D1");
  loop2Seconds();
  console.log("D2");
})();
```

log output

```
B1
B2
A1
A2
C1
C2
D1
D2
```

## js event loop with generator functions

```javascript
const generator = (function* () {
  try {
    console.log("A1");
    let counter = 0;
    while (true) {
      counter++;
      const v = counter;
      setTimeout(() => {
        console.log(v, "G");
      }, 0);
      yield;
    }
    console.log("A2");
  } finally {
    console.log("A3");
  }
})();

console.log("B1");
generator.next();
console.log("B2");

setTimeout(() => {
  console.log("C1");
}, 0);

console.log("D1");
generator.next();
console.log("D2");

console.log("E1");
generator.return();
console.log("E2");
```

log output:

```
B1
A1
B2
D1
D2
E1
A3
E2
1 "G"
C1
2 "G"
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
