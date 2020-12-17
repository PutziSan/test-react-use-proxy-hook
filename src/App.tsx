import React, { useState } from "react";
import { EventCallback, streamify, UnsubCallback, useAsyncEffect, useProxy, useProxyEffect } from "./useProxy";

function fakeFetch(): Promise<string> {
  console.log("start creating the promise");
  const p = new Promise<string>((r) =>
    setTimeout(() => {
      console.log("promise timeout done");
      r("crazy cooler wert :-)");
    }, 1000)
  );
  console.log("created promise");
  return p;
}

function eventExample(cb: EventCallback<number>): UnsubCallback {
  let counter = 0;
  const iid = setInterval(() => {
    counter++;
    cb(counter);
  }, 1000);
  return () => {
    clearInterval(iid);
    console.log("unsub called");
  };
}

function App() {
  const [text, setText] = useState("");

  const state = useProxy({ proxyTest: "", timerCount: 10 });

  useProxyEffect(() => {
    console.log("useProxyEffect");
    console.log(state.proxyTest);
    return () => {
      console.log("unsub");
    };
  });
  //
  // useAsyncEffect(function* () {
  //   try {
  //     for (let i = 0; i <= 3; i++) {
  //       state.timerCount = 10 - i;
  //       const res = yield fakeFetch();
  //       console.log(i, res);
  //     }
  //     console.log("start countdown:", state.proxyTest);
  //   } finally {
  //     return () => {
  //       console.log("unsub useAsyncEffect");
  //     };
  //   }
  // });

  useAsyncEffect(function* () {
    console.log(state.proxyTest);
    state.timerCount = 0;
    for (const next of streamify(eventExample)) {
      const data = yield next;
      console.log("counter is running!", data);
      state.timerCount = data;
    }
    console.log("we are done here!");
  });

  return (
    <div>
      <div className="">
        <label htmlFor="state-input">state-input</label>
        <input id="state-input" type="text" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="">
        <label htmlFor="proxy-input">proxy-input</label>
        <input
          id="proxy-input"
          type="text"
          value={state.proxyTest}
          onChange={(e) => (state.proxyTest = e.target.value)}
        />
      </div>
      <div className="">
        countdown:
        <h1>{state.timerCount}</h1>
      </div>
    </div>
  );
}

export default App;
