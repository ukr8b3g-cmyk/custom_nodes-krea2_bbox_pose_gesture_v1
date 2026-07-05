import { app } from "../../scripts/app.js";

const NONE_OPTION = "None / なし";
const STABILIZER_AUTO_OPTION = "Any / 自動";
const PRESET_URL = "/krea2_bbox_pose_gesture/presets";
const NODE_NAME = "Krea2BBOXPoseGestureInjectorV1";
const FIELD_CATEGORIES = {
  base_pose_preset: "base_pose",
  arm_preset: "arm",
  right_hand_preset: "right_hand",
  left_hand_preset: "left_hand",
  torso_preset: "torso",
  gaze_preset: "gaze",
  head_preset: "head",
  lower_body_preset: "lower_body",
  sitting_lying_preset: "sitting_lying",
  performance_preset: "performance",
  pair_preset: "pair",
};

let presetPayloadPromise = null;

function clean(value) {
  return String(value ?? "").trim();
}

function cleanCustomAddOn(value) {
  const text = clean(value);
  if (!text) return "";
  const lowered = text.toLowerCase();
  if (["auto", "none", "none / なし", "なし", "null"].includes(lowered)) return "";
  return text;
}

function addUnique(parts, phrase) {
  const text = clean(phrase);
  if (!text) return;
  if (!parts.some((p) => p.toLowerCase() === text.toLowerCase())) parts.push(text);
}

function appendUnique(base, addition) {
  const left = clean(base);
  const right = clean(addition);
  if (!right) return left;
  if (!left) return right;
  return left.includes(right) ? left : `${left}, ${right}`;
}

function widget(node, name) {
  return node.widgets?.find((w) => w.name === name);
}

function widgetValue(node, name, fallback = "") {
  const w = widget(node, name);
  return w ? w.value : fallback;
}

function fetchPresets() {
  if (!presetPayloadPromise) {
    presetPayloadPromise = fetch(PRESET_URL, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .catch((err) => {
        console.warn("[Krea2 Pose Gesture] Failed to load presets.", err);
        return { presets: [] };
      });
  }
  return presetPayloadPromise;
}

function buildFallbackMap(payload) {
  const map = {};
  const seen = new Set();
  const presets = Array.isArray(payload?.presets) ? payload.presets.slice() : [];
  presets.sort((a, b) => {
    const rel = { high: 10, standard: 20, medium: 20, hard: 30 };
    const ar = rel[clean(a?.reliability).toLowerCase()] ?? 20;
    const br = rel[clean(b?.reliability).toLowerCase()] ?? 20;
    const ap = Number(a?.priority ?? 9999);
    const bp = Number(b?.priority ?? 9999);
    return ar - br || ap - bp || clean(a?.display_name).localeCompare(clean(b?.display_name));
  });
  for (const preset of presets) {
    if (!preset || typeof preset !== "object") continue;
    const label = clean(preset.display_name) || clean(preset.id);
    if (!label) continue;
    const key = seen.has(label) ? `${label} [${clean(preset.id)}]` : label;
    seen.add(label);
    map[key] = preset;
  }
  return map;
}

function buildDisplayMaps(payload) {
  const maps = { __fallback: buildFallbackMap(payload) };
  const categories = payload?.categories;
  if (!categories || typeof categories !== "object") return maps;
  for (const [category, mapping] of Object.entries(categories)) {
    if (mapping && typeof mapping === "object") maps[category] = mapping;
  }
  return maps;
}

function presetFor(displayMaps, fieldName, value) {
  const category = FIELD_CATEGORIES[fieldName];
  return displayMaps?.[category]?.[value] ?? displayMaps?.__fallback?.[value];
}

function sideSpecificOneHandPrompt(prompt, side) {
  let text = clean(prompt);
  if (!text) return text;
  const s = side === "left" ? "left" : "right";
  const replacements = [
    ["right hand", `${s} hand`],
    ["left hand", `${s} hand`],
    ["right index finger", `${s} index finger`],
    ["left index finger", `${s} index finger`],
    ["with one hand", `with the ${s} hand`],
    ["placing one hand", `placing the ${s} hand`],
    ["resting one hand", `resting the ${s} hand`],
    ["raising one hand", `raising the ${s} hand`],
    ["raising one arm", `raising the ${s} arm`],
    ["extending one hand", `extending the ${s} hand`],
    ["one open palm", `the ${s} open palm`],
    ["one palm", `the ${s} palm`],
    ["covering the mouth with one hand", `covering the mouth with the ${s} hand`],
    ["covering one eye with one hand", `covering one eye with the ${s} hand`],
    ["partially covering the face with one hand", `partially covering the face with the ${s} hand`],
    ["touching one cheek with one hand", `touching one cheek with the ${s} hand`],
    ["touching the chin with one hand", `touching the chin with the ${s} hand`],
    ["touching the forehead with one hand", `touching the forehead with the ${s} hand`],
    ["brushing hair away from the face with one hand", `brushing hair away from the face with the ${s} hand`],
    ["pointing forward with the right index finger", `pointing forward with the ${s} index finger`],
    ["pointing to oneself with the right hand", `pointing to oneself with the ${s} hand`],
    ["crossing the index and middle fingers of the right hand", `crossing the index and middle fingers of the ${s} hand`],
    ["placing the index finger", `placing the ${s} index finger`],
  ];
  for (const [oldText, newText] of replacements) text = text.split(oldText).join(newText);
  const lt = text.toLowerCase();
  if (![`${s} hand`, `${s} arm`, `${s} index finger`].some((token) => lt.includes(token))) {
    text = `${text}, with the ${s} hand`;
  }
  return text;
}

function applyStrength(text, strength) {
  if (strength === "Clear") return `clear pose, ${text}`;
  if (strength === "Strong") return `clear intentional pose, ${text}, pose clearly visible`;
  return text;
}

function buildPreview(node, displayMaps) {
  if (widgetValue(node, "enable_pose_preset", true) === false) return "Pose preset disabled.";

  const sittingLyingSelected = clean(widgetValue(node, "sitting_lying_preset", NONE_OPTION));
  const skipNames = new Set();
  if (sittingLyingSelected && sittingLyingSelected !== NONE_OPTION) {
    skipNames.add("base_pose_preset");
    skipNames.add("lower_body_preset");
  }

  const ordered = [
    ["base_pose_preset", null],
    ["arm_preset", null],
    ["right_hand_preset", "right"],
    ["left_hand_preset", "left"],
    ["torso_preset", null],
    ["gaze_preset", null],
    ["head_preset", null],
    ["lower_body_preset", null],
    ["sitting_lying_preset", null],
    ["performance_preset", null],
    ["pair_preset", null],
  ];
  const parts = [];
  const selected = [];
  for (const [name, side] of ordered) {
    if (skipNames.has(name)) continue;
    const value = clean(widgetValue(node, name, NONE_OPTION));
    if (!value || value === NONE_OPTION) continue;
    const preset = presetFor(displayMaps, name, value);
    if (!preset) continue;
    let prompt = clean(preset.prompt);
    if (side) prompt = sideSpecificOneHandPrompt(prompt, side);
    if (prompt) {
      addUnique(parts, prompt);
      selected.push(preset);
    }
  }
  addUnique(parts, cleanCustomAddOn(widgetValue(node, "custom_add_on", "")));
  if (!parts.length) return "No pose text generated.";

  let text = applyStrength(parts.join(", "), widgetValue(node, "strength", "Natural"));
  const stabilizer = widgetValue(node, "stabilizer", NONE_OPTION);
  const extras = [];
  if (stabilizer === STABILIZER_AUTO_OPTION) {
    for (const preset of selected) addUnique(extras, preset.stabilizer);
    if (!extras.length) {
      const scopes = new Set(selected.map((p) => clean(p.scope)));
      if (scopes.has("pair")) addUnique(extras, "both people clearly visible, clear relationship between the two characters");
      else if (scopes.has("hand_expression")) addUnique(extras, "hand clearly visible, accurate fingers, natural hand anatomy");
      if (["full_body", "sitting_lying", "lower_body", "performance"].some((s) => scopes.has(s))) {
        addUnique(extras, "full body visible, clear body pose, natural posture");
      } else if (scopes.has("upper_body")) {
        addUnique(extras, "clear body pose, natural posture");
      }
    }
  } else if (stabilizer === "Hand / 手") addUnique(extras, "hand clearly visible, accurate fingers, natural hand anatomy");
  else if (stabilizer === "Body / 体") addUnique(extras, "clear body pose, natural posture");
  else if (stabilizer === "Full Body / 全身") addUnique(extras, "full body visible, clear body pose, natural posture");
  else if (stabilizer === "Pair / 2人") addUnique(extras, "both people clearly visible, clear relationship between the two characters");
  else if (stabilizer === "Hand + Body / 手+体") {
    addUnique(extras, "hand clearly visible, accurate fingers, natural hand anatomy");
    addUnique(extras, "clear body pose, natural posture");
  }
  for (const extra of extras) text = appendUnique(text, extra);
  return text;
}

function ensureStyle() {
  if (document.getElementById("k2pg-live-preview-style")) return;
  const style = document.createElement("style");
  style.id = "k2pg-live-preview-style";
  style.textContent = `
    .k2pg-live-wrap{box-sizing:border-box;padding:6px 8px 8px}
    .k2pg-live-label{color:#35d0c8;font-size:11px;font-weight:700;margin-bottom:4px}
    .k2pg-live-preview{box-sizing:border-box;width:100%;min-height:76px;max-height:180px;resize:vertical;overflow:auto;border:1px solid #444;border-radius:6px;background:#151515;color:#ddd;padding:7px;font:11px monospace;white-space:pre-wrap;user-select:text}
  `;
  document.head.appendChild(style);
}

function attachPreview(node, displayMaps) {
  if (node.__k2pgLivePreviewAttached) return;
  node.__k2pgLivePreviewAttached = true;
  ensureStyle();

  const wrap = document.createElement("div");
  wrap.className = "k2pg-live-wrap";
  const label = document.createElement("div");
  label.className = "k2pg-live-label";
  label.textContent = "Prompt Preview";
  const preview = document.createElement("textarea");
  preview.className = "k2pg-live-preview";
  preview.readOnly = true;
  preview.placeholder = "No pose text generated.";
  wrap.append(label, preview);

  node.addDOMWidget("krea2_pose_prompt_preview", "Krea2PosePromptPreview", wrap, {
    serialize: false,
    hideOnZoom: false,
    getMinHeight: () => 110,
  });

  const update = () => {
    preview.value = buildPreview(node, displayMaps);
    node.setDirtyCanvas?.(true, false);
  };
  node.__k2pgUpdatePreview = update;

  for (const w of node.widgets || []) {
    if (w.__k2pgPreviewWrapped) continue;
    w.__k2pgPreviewWrapped = true;
    const oldCallback = w.callback;
    w.callback = function (...args) {
      const result = oldCallback?.apply(this, args);
      queueMicrotask(update);
      return result;
    };
  }
  update();
  setTimeout(update, 0);
  setTimeout(update, 250);
}

app.registerExtension({
  name: "krea2.pose.gesture.live.preview",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== NODE_NAME) return;
    const oldCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      oldCreated?.apply(this, arguments);
      fetchPresets().then((payload) => attachPreview(this, buildDisplayMaps(payload)));
    };
    const oldConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const result = oldConfigure?.apply(this, arguments);
      fetchPresets().then((payload) => {
        if (!this.__k2pgLivePreviewAttached) attachPreview(this, buildDisplayMaps(payload));
        this.__k2pgUpdatePreview?.();
      });
      return result;
    };
  },
});
