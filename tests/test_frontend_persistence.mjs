import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(process.env.KREA2_POSE_TEST_SOURCE || new URL("../web/krea2_pose_gesture_live_preview.js", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const plain = (value) => JSON.parse(JSON.stringify(value));
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, name);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}
function harness(oldSerialize) {
  const frames = [];
  function Node() {}
  Node.prototype.onSerialize = oldSerialize;
  const context = vm.createContext({ nodeType: Node, NODE_SIZE_PROP: "k2pg_node_size", requestAnimationFrame: (fn) => frames.push(fn) });
  vm.runInContext(extract("normalizeNodeSize") + "\n" + extract("restoreConfiguredNodeSize"), context);
  const start = source.indexOf("    const oldSerialize = nodeType.prototype.onSerialize;");
  const end = source.indexOf("    const oldRemoved = nodeType.prototype.onRemoved;", start);
  assert(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), context);
  return { context, node: new Node(), flush() { while (frames.length) frames.shift()(); } };
}

test("workflow size wins over both stale size properties without changing position or input data", () => {
  const { context: c, node, flush } = harness();
  node.size = [540, 990]; node.pos = [10, 20]; node.properties = { k2pg_node_size: [330, 800] };
  node.setSize = (size) => { node.size = size; };
  const info = { size: [540, 990], properties: { k2pg_node_size: [400, 572] } };
  const before = plain(info);
  c.restoreConfiguredNodeSize(node, info);
  flush();
  assert.deepEqual(plain(node.size), [540, 990]);
  assert.deepEqual(node.pos, [10, 20]);
  assert.deepEqual(info, before);
});

test("older workflows without size retain property fallback and invalid sizes cause no resize", () => {
  const { context: c, node, flush } = harness();
  node.properties = { k2pg_node_size: [330, 800] };
  const sizes = [];
  node.setSize = (size) => sizes.push(plain(size));
  c.restoreConfiguredNodeSize(node, { properties: { k2pg_node_size: [500, 900] } });
  c.restoreConfiguredNodeSize(node, { size: [0, 0] });
  flush();
  assert.deepEqual(sizes, [[500, 900], [330, 800]]);
  node.properties = {};
  c.restoreConfiguredNodeSize(node, { size: [0, 0] });
  flush();
  assert.equal(sizes.length, 2);
});

for (const properties of [{}, { k2pg_node_size: [400, 572], other: { keep: [1] } }]) {
  test(`serialize writes current size only to output (existing size: ${Boolean(properties.k2pg_node_size)})`, () => {
    const { node } = harness((data) => { data.properties.previousHook = "keep"; });
    node.size = [540, 990]; node.properties = plain(properties);
    const before = plain(node.properties);
    const data = { size: node.size.slice(), properties: plain(node.properties), mode: 4, widgets_values: [false, "RED slot"] };
    node.onSerialize(data);
    assert.deepEqual(plain(node.properties), before);
    assert.deepEqual(plain(data.properties.k2pg_node_size), [540, 990]);
    assert.equal(data.properties.previousHook, "keep");
    assert.equal(data.mode, 4);
    assert.deepEqual(data.widgets_values, [false, "RED slot"]);
    assert.doesNotThrow(() => structuredClone(data));
    const serialized = plain(data);
    node.onSerialize(data);
    assert.deepEqual(plain(data), serialized);
    assert.deepEqual(plain(node.properties), before);
  });
}

test("serialize also leaves aliased live properties untouched", () => {
  const { node } = harness();
  node.size = [540, 990]; node.properties = { k2pg_node_size: [400, 572], other: "keep" };
  const data = { properties: node.properties };
  node.onSerialize(data);
  assert.deepEqual(node.properties.k2pg_node_size, [400, 572]);
  assert.notEqual(data.properties, node.properties);
  assert.deepEqual(plain(data.properties), { k2pg_node_size: [540, 990], other: "keep" });
});

test("reactive live properties do not contaminate the serialized copy", () => {
  const { node } = harness();
  node.size = [540, 990];
  node.properties = new Proxy({ k2pg_node_size: [400, 572], other: new Proxy({ keep: [1] }, {}) }, {});
  const before = plain(node.properties);
  const data = { properties: plain(node.properties) };
  node.onSerialize(data);
  assert.deepEqual(plain(node.properties), before);
  assert.doesNotThrow(() => structuredClone(data));
});

test("serialized size restores on the next load without changing the source node", () => {
  const { context: c, node, flush } = harness();
  node.size = [600, 1100]; node.properties = { k2pg_node_size: [400, 572] };
  const data = { size: node.size.slice(), properties: plain(node.properties) };
  node.onSerialize(data);
  const restored = { properties: plain(data.properties), setSize(size) { this.size = size; } };
  c.restoreConfiguredNodeSize(restored, data);
  flush();
  assert.deepEqual(plain(restored.size), [600, 1100]);
  assert.deepEqual(node.properties.k2pg_node_size, [400, 572]);
});
