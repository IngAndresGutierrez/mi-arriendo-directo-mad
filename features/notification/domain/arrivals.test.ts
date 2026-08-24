import { describe, expect, it } from "vitest";

import { firstSnapshot, nextSnapshot } from "./arrivals";

describe("firstSnapshot", () => {
  it("never announces an arrival: it is what the server already rendered", () => {
    expect(firstSnapshot(["a", "b", "c"]).arrived).toBe(false);
  });

  it("remembers what was there", () => {
    expect([...firstSnapshot(["a", "b"]).seen].sort()).toEqual(["a", "b"]);
  });
});

describe("nextSnapshot", () => {
  it("does not ring when the same documents come back", () => {
    // This is the `readAt` write that opening the panel performs: same ids, different fields.
    const watch = nextSnapshot(firstSnapshot(["a", "b"]), ["a", "b"]);
    expect(watch.arrived).toBe(false);
  });

  it("rings on an id that was not there before", () => {
    const watch = nextSnapshot(firstSnapshot(["a"]), ["b", "a"]);
    expect(watch.arrived).toBe(true);
  });

  it("rings once for a batch, not once per notification", () => {
    // Advancing a stage can notify about several things at once; three chimes is an alarm.
    const watch = nextSnapshot(firstSnapshot(["a"]), ["d", "c", "b", "a"]);
    expect(watch.arrived).toBe(true);
    expect([...watch.seen].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("does not ring for an id it has already accounted for, even after it left the window", () => {
    const first = nextSnapshot(firstSnapshot(["a"]), ["b", "a"]);
    // "b" drops off the fifteen-item window...
    const shrunk = nextSnapshot(first, ["a"]);
    expect(shrunk.arrived).toBe(false);
    // ...and coming back is not news.
    expect(nextSnapshot(shrunk, ["b", "a"]).arrived).toBe(false);
  });

  it("does not ring when documents only disappear", () => {
    expect(nextSnapshot(firstSnapshot(["a", "b"]), ["a"]).arrived).toBe(false);
  });

  it("keeps the same set object when nothing arrived", () => {
    // Nothing to copy means nothing to allocate: this callback runs on every change to the query.
    const watch = firstSnapshot(["a"]);
    expect(nextSnapshot(watch, ["a"]).seen).toBe(watch.seen);
  });
});
