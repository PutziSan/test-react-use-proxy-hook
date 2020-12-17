import { fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { useAsyncEffect, useProxy, useProxyEffect } from "./useProxy";

function synchronousTests(
  customRender: () => { onEffectMock: jest.Mock; onEffectUnsubMock: jest.Mock; onOtherProxyEffectMock: jest.Mock }
) {
  test("it should have been called initially", () => {
    const { onEffectMock } = customRender();
    expect(onEffectMock).toHaveBeenCalledWith("");
  });

  test("it should have been called on dependent state-change", () => {
    const { onEffectMock } = customRender();
    fireEvent.change(screen.getByLabelText("proxy-input"), { target: { value: "42" } });
    expect(onEffectMock).toHaveBeenCalledWith("42");
  });

  test("unsub should have been called on dependent state-change", () => {
    const { onEffectUnsubMock } = customRender();
    fireEvent.change(screen.getByLabelText("proxy-input"), { target: { value: "42" } });
    expect(onEffectUnsubMock).toHaveBeenCalledWith();
  });

  test("unsub should not have been called on independent state-change", () => {
    const { onEffectUnsubMock } = customRender();
    expect(screen.queryByDisplayValue("42")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("state-input"), { target: { value: "42" } });
    // verify that sth had chagned:
    expect(screen.queryByDisplayValue("42")).toBeInTheDocument();
    // but the state is independent from the effect so unsub should not have been called
    expect(onEffectUnsubMock).not.toHaveBeenCalledWith();
  });

  test("unsub should not have been called on independent proxy-state-change", () => {
    const { onEffectUnsubMock, onOtherProxyEffectMock } = customRender();
    expect(screen.queryByDisplayValue("42")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("independent-proxy-input"), { target: { value: "42" } });
    // verify that sth had chagned:
    expect(screen.queryByDisplayValue("42")).toBeInTheDocument();
    expect(onOtherProxyEffectMock).toHaveBeenCalledWith("42");
    // but the state is independent from the effect so unsub should not have been called
    expect(onEffectUnsubMock).not.toHaveBeenCalledWith();
  });
}

describe("synchronous functionality", () => {
  function App(props: { onEffectCalled(v: string): void; onEffectUnsub(): void; onOtherProxyEffect(v: string): void }) {
    const [text, setText] = useState("");
    const state = useProxy({ proxyTest: "", otherProxyTest: "" });
    useProxyEffect(() => {
      props.onEffectCalled(state.proxyTest);
      return () => {
        props.onEffectUnsub();
      };
    });
    useProxyEffect(() => {
      props.onOtherProxyEffect(state.otherProxyTest); // just call it and do nothing to trigger the effect
    });

    return (
      <div>
        <div className="">
          <label htmlFor="state-input">state-input</label>
          <input id="state-input" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="">
          <label htmlFor="proxy-input">proxy-input</label>
          <input id="proxy-input" value={state.proxyTest} onChange={(e) => (state.proxyTest = e.target.value)} />
        </div>
        <div className="">
          <label htmlFor="independent-proxy-input">independent-proxy-input</label>
          <input
            id="independent-proxy-input"
            value={state.otherProxyTest}
            onChange={(e) => (state.otherProxyTest = e.target.value)}
          />
        </div>
      </div>
    );
  }

  function customRender() {
    const onEffectMock = jest.fn();
    const onEffectUnsubMock = jest.fn();
    const onOtherProxyEffectMock = jest.fn();
    render(
      <App
        onEffectCalled={onEffectMock}
        onEffectUnsub={onEffectUnsubMock}
        onOtherProxyEffect={onOtherProxyEffectMock}
      />
    );
    return { onEffectMock, onEffectUnsubMock, onOtherProxyEffectMock };
  }

  synchronousTests(customRender);
});

describe("asynchronous functionality", () => {
  function App(props: {
    onAsyncEffectCalled(v: string): void;
    onAsyncEffectUnsub(): void;
    onOtherProxyEffect(v: string): void;
    onEffectCalled(v: string): void;
    onEffectUnsub(): void;
    onOtherProxyEffect(v: string): void;
  }) {
    const [text, setText] = useState("");
    const state = useProxy({ proxyTest: "", otherProxyTest: "" });

    useAsyncEffect(function* () {
      try {
        props.onEffectCalled(state.proxyTest);
        yield new Promise((r) => setTimeout(() => r(undefined), 500));
        props.onAsyncEffectCalled(state.proxyTest);
      } finally {
        return () => {
          props.onEffectUnsub();
        };
      }
    });
    useProxyEffect(() => {
      props.onOtherProxyEffect(state.otherProxyTest); // just call it and do nothing to trigger the effect
    });

    return (
      <div>
        <div className="">
          <label htmlFor="state-input">state-input</label>
          <input id="state-input" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="">
          <label htmlFor="proxy-input">proxy-input</label>
          <input id="proxy-input" value={state.proxyTest} onChange={(e) => (state.proxyTest = e.target.value)} />
        </div>
        <div className="">
          <label htmlFor="independent-proxy-input">independent-proxy-input</label>
          <input
            id="independent-proxy-input"
            value={state.otherProxyTest}
            onChange={(e) => (state.otherProxyTest = e.target.value)}
          />
        </div>
      </div>
    );
  }
  let bla: any = undefined;

  function customRender() {
    const onEffectMock = jest.fn();
    const onEffectUnsubMock = jest.fn();
    const onOtherProxyEffectMock = jest.fn();
    const onAsyncEffectCalledMock = jest.fn();
    const onAsyncEffectUnsubMock = jest.fn();
    render(
      <App
        onAsyncEffectCalled={onAsyncEffectCalledMock}
        onAsyncEffectUnsub={onAsyncEffectUnsubMock}
        onEffectCalled={onEffectMock}
        onEffectUnsub={onEffectUnsubMock}
        onOtherProxyEffect={onOtherProxyEffectMock}
      />
    );
    return { onEffectMock, onEffectUnsubMock, onOtherProxyEffectMock, onAsyncEffectCalledMock, onAsyncEffectUnsubMock };
  }

  describe("synchronous stuff should work even when as an async effect defined", () => {
    synchronousTests(customRender);
  });

  // if multiple promises are working, we should use flushPromise: https://stackoverflow.com/a/58716087/5627010
  function flushPromises() {
    return new Promise(resolve => setImmediate(resolve));
  }

  it("should call the async effect after 1 second", async () => {
    jest.useFakeTimers();
    const { onAsyncEffectCalledMock } = customRender();
    expect(onAsyncEffectCalledMock).not.toHaveBeenCalled();
    // Fast-forward until all timers have been executed
    jest.runAllTimers();
    // allow any pending jobs in the PromiseJobs queue to run - for more information check https://stackoverflow.com/a/52196951/5627010
    await flushPromises();
    expect(onAsyncEffectCalledMock).toHaveBeenCalledWith("");
  });
});
