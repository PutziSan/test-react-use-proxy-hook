import { EffectCallback, useCallback, useEffect, useRef, useState } from "react";

// TODO dokumentiere, dass useAsyncEffect bei Nutzung mit klassischem useState stuff nicht richtig funktioniert:
// durch set... wird ein re-render getriggert, was in die execution von den generatoren (zwischen .next() und yield) dazwischenkommt,
// wodurch alle variablen die während des renderns aufgerufen werden dem effect zugeordnet werden
// um das zu verhindern existiert der onDoneStack

function useForceUpdate() {
  const [, updateState] = useState<{}>();
  return useCallback(() => updateState({}), []);
}
function useSymbol(description?: string) {
  const ref = useRef<symbol>();
  if (!ref.current) {
    ref.current = Symbol(description);
  }
  return ref.current;
}

function useThrowError(): (v: any) => void {
  const [error, setError] = useState<any>();
  const throwError = useCallback((e: any) => {
    try {
      setError(e);
    } catch (ex) {
      console.log(
        "failed to throw the error inside the component, propably because the component is already unmounted",
        ex
      );
      console.error(e);
      throw e;
    }
  }, []);
  if (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(error);
    }
  }
  return throwError;
}

// the reference for the effect, which is checked by `useProxy`
let currentEffectRef: undefined | symbol = undefined;
const onDoneStack: Function[] = [];

function callEffect<T extends () => any>(effectRef: symbol, effectFn: T): ReturnType<T> {
  // mark the current effect globally so that `useProxy` can use this reference
  currentEffectRef = effectRef;
  // execute the effect and save the callback, so that it can be executed on cleanup:
  const res = effectFn();
  // the effect is done, reset currentEffectRef
  currentEffectRef = undefined;
  // call everything which holds back until the effect is done
  while (onDoneStack.length > 0) {
    onDoneStack.pop()!();
  }
  return res;
}

// the stack of effects which needs to be executed
const effectStack = new Set<symbol>();
// a callback-stack von cleanup-funktionen, der aufgerufen werden sollte, wenn ein effekt in der cleanup-phase ist
// die getter von useProxy sollten sich hier mit der cleanup-funktion registrieren, die für den aktuellen effect hinterlegen,
// dass er bei einem cleanup zurückgesetzt werden muss
const effectCleanupMap = new Map<symbol, Function[]>();

export function useProxy<T extends Record<string, any>>(p: T | (() => T)): T {
  const proxyRef = useRef<T>();
  const forceUpdate = useForceUpdate();
  if (!proxyRef.current) {
    // ignore because it will always be a function, if it is a function ;-)
    // @ts-ignore
    const init: T = typeof p === "function" ? p() : p;
    // effect-map will store all effect-ids (id via symbol) for a given key,
    // the key is the key of the proxied object
    const effectMap = new Map<any, Set<symbol>>();
    // define the proxy with the initial object, later changes on keys are tracked via the set-call
    proxyRef.current = new Proxy(init, {
      // when "getting" we save the current effect to our map, so that we know later on set, that this effect needs to be updated
      get(obj, key, receiver) {
        if (currentEffectRef) {
          let s = effectMap.get(key);
          if (!s) {
            s = new Set<symbol>();
            effectMap.set(key, s);
          }
          s.add(currentEffectRef);
          // it is marked for the effect, make sure that it can be removed, when this effect is re-initialized:
          let cleanups = effectCleanupMap.get(currentEffectRef);
          if (!cleanups) {
            cleanups = [];
            effectCleanupMap.set(currentEffectRef, cleanups);
          }
          // currentEffectRef zu c geben, damit immer richtige referenz genutzt wird
          const c = currentEffectRef;
          cleanups.push(() => s!.delete(c));
        }
        return Reflect.get(obj, key, receiver);
      },
      // when setting, check if this key was used before in get above and execute the effects connected with this key
      set(obj, key, value, receiver) {
        if (obj[key as keyof T] !== value) {
          // der wert hat sich geändert, füge ihn zu abzuarbeitenden stack hinzu
          if (effectMap.has(key)) {
            for (const effectCid of effectMap.get(key)!) {
              effectStack.add(effectCid);
            }
          }
          if (currentEffectRef) {
            // only forceUpdate after the effect is done, ansonsten wird rendering während des asynchronen effekts ausgeführt und alles wird zerschossen:
            onDoneStack.push(() => forceUpdate());
          } else {
            // forceUpdate so that react and effects knows the new values:
            forceUpdate();
          }
        }
        return Reflect.set(obj, key, value, receiver);
      },
    });
  }
  return proxyRef.current as T;
}

export function useProxyEffect(effectFn: EffectCallback) {
  // pointer of the object is used to identify this effect
  const effectId = useSymbol("useProxyEffect");
  // the reference for the unsubscribe
  const unsubRef = useRef<void | (() => void)>();
  // effect which calls it the first time on first mount and calls the unsubscribe on unmount
  useEffect(
    () => {
      // execute the effect on first render and save the callback, so that it can be executed on cleanup:
      unsubRef.current = callEffect(effectId, effectFn);
      return () => {
        unsubRef.current && unsubRef.current(); // execute the unsub  on unmount if it exists
        // clean up the effect from the stack + map, it will never be used any more (cause it is unmounted here)
        effectStack.delete(effectId);
        effectCleanupMap.delete(effectId);
      };
    },
    // eslint-disable-next-line
    []
  );
  // effect which calls the effect-function on changes
  useEffect(
    () => {
      // only call cleanup, when react normally would call it:
      const cleanup = () => {
        // the effect is marked as "needs to be processed", so call the cleanup-function:
        if (unsubRef.current && effectStack.has(effectId)) {
          unsubRef.current();
        }
      };
      // wenn es nicht als "needs to be processed" markiert ist, das allgemeine cleanup zurückgeben
      // first mount wird von effect oben erledigt:
      if (!effectStack.has(effectId)) return cleanup;
      // execute the effect and save the callback, so that it can be executed on cleanup:
      unsubRef.current = callEffect(effectId, effectFn);
      // we have executed this effect, remove it from the stack:
      effectStack.delete(effectId);
      return cleanup;
    }
    // no dependency-array, it should run on every change and we check on our own, if it should run or not
  );
}
type EffectReturn = void | (() => void | undefined);

interface GeneratorRef {
  generator: Generator<Promise<any>, void | (() => void | undefined)>;
  lastResult?: IteratorResult<any, EffectReturn>;
}

export function useAsyncEffect<T extends Promise<any>>(
  asyncEffectFn: () => Generator<T, EffectReturn, T extends Promise<infer U> ? U : any>
) {
  const throwError = useThrowError();
  // pointer of the object is used to identify this effect
  const effectId = useSymbol("useAsyncEffect");
  // generatorRef is used to store the current state of the last called generator and call the cleanup function for this if needed
  const generatorRef = useRef<GeneratorRef[]>([]);
  // startGenerator defined outside to re-use it in the initial and on-change-effect
  async function startGenerator() {
    const gen = asyncEffectFn();
    const genRef: GeneratorRef = { generator: gen };
    // execute the effect on first render and save the callback, so that it can be executed on cleanup:
    generatorRef.current.push(genRef);
    let iteratorRes = callEffect(effectId, () => gen.next());
    // das ergebnis abspeichern (was möglicherweise das finaly cleanup-callback enthält), sodass cleanup darauf später zugreifen können
    genRef.lastResult = iteratorRes;
    // do it while not done:
    while (!iteratorRes.done) {
      const nextVal = await iteratorRes.value;
      if (iteratorRes.done) return; // falls der generator während des wartens auf das letzte ergebnis abgeschlossen wurde per cleanup
      iteratorRes = callEffect(effectId, () => gen.next(nextVal));
      genRef.lastResult = iteratorRes;
    }
  }
  // cleanup function defined outside to reuse it
  function cleanup() {
    // über alle generatoren die hinzugefügt wurden loopen und entfernen, es können mglweise mehr als einer sein, wenn effects sehr schnell aufeinander
    while (generatorRef.current.length > 0) {
      const g = generatorRef.current.pop()!;
      // überprüfe, ob der aktuelle generator bereits beendet ist
      if (g.lastResult?.done) {
        // er ist bereits beendet, wir können überprüfen
        g.lastResult.value && g.lastResult.value();
      } else {
        // der generator läuft noch, beende ihn mit return, return kriegt die callback-function die falls gewollt im finally block definiert wurde
        // (wir können nicht immer return aufrufen, da return bei einem beendeten generator nicht den letztendlichen Wert bringt)
        const res = g.generator.return();
        if (res.done && res.value) {
          res.value();
        }
      }
    }
    // alle alten referenzen, löschen, sodass der nächste cycle korrekt darauf zugreift: (oben in useProxy-getter definiert)
    const cleanupsForEffect = effectCleanupMap.get(effectId);
    while ((cleanupsForEffect ?? []).length > 0) {
      cleanupsForEffect!.pop()!();
    }
  }
  // effect which calls it the first time on first mount and calls the unsubscribe on unmount
  useEffect(
    () => {
      startGenerator().catch((e) => throwError(e));
      return () => {
        cleanup();
        // clean up the effect from the stack + map, it will never be used any more (cause it is unmounted here)
        effectStack.delete(effectId);
        effectCleanupMap.delete(effectId);
      };
    },
    // eslint-disable-next-line
    []
  );
  // effect which calls the effect-function on changes
  useEffect(
    () => {
      const changeCleanup = () => {
        // the effect is marked as "needs to be processed", so call the cleanup-function:
        if (effectStack.has(effectId)) {
          cleanup();
        }
      };
      // wenn es nicht als "needs to be processed" markiert ist, das allgemeine cleanup zurückgeben
      // first mount wird von effect oben erledigt:
      if (!effectStack.has(effectId)) return changeCleanup;
      // er ist als "abzuarbeiten" markiert, starte den generator
      startGenerator().catch((e) => throwError(e));
      // we have executed this effect, remove it from the stack:
      effectStack.delete(effectId);
      return changeCleanup;
    }
    // no dependency-array, it should run on every change and we check on our own, if it should run or not
  );
}

export type EventCallback<T> = (data: T) => void;
export type UnsubCallback = () => void;
export type Event<T> = (cb: EventCallback<T>) => UnsubCallback;

// firebase-example:
// export function queryToStream<T>(q: firebase.firestore.Query<T>) {
//   return streamify<firebase.firestore.QuerySnapshot<T>>(q.onSnapshot);
// }

export function* streamify<T>(ev: Event<T>) {
  let resolvePromise: (v: T) => void;
  let promise = new Promise<T>((r) => (resolvePromise = r));
  const unsub = ev((data) => {
    resolvePromise(data);
  });
  try {
    while (true) {
      yield promise;
      promise = new Promise<T>((r) => (resolvePromise = r));
    }
  } finally {
    unsub();
  }
}
