import { app } from "../../scripts/app.js";

const NONE_OPTION = "None / なし";
const STABILIZER_AUTO_OPTION = "Any / 自動";
const PRESET_URL = "/krea2_bbox_pose_gesture/presets";
const NODE_NAME = "Krea2BBOXPoseGestureInjectorV1";
const PREVIEW_HEIGHT_PROP = "k2pg_prompt_preview_height";
const PREVIEW_MIN_HEIGHT = 76;
const PREVIEW_MAX_HEIGHT = 240;
const ACCORDION_STATE_PROP = "k2pg_accordion_state";
const ACCORDION_SECTIONS = [
  {
    id: "basic",
    title: "Basic / 基本設定",
    open: true,
    fields: [
      ["enable_pose_preset", "Enable / 有効"],
      ["target_slot", "Target / 対象"],
      ["human_type", "Human / 人物"],
    ],
  },
  {
    id: "whole_body",
    title: "Whole Body / 全体ポーズ",
    open: true,
    fields: [
      ["base_pose_preset", "Base Pose / 基本姿勢"],
      ["performance_preset", "Performance / 定型ポーズ"],
      ["sitting_lying_preset", "Sitting & Lying / 座り・寝そべり"],
      ["pair_preset", "Pair / 2人"],
    ],
  },
  {
    id: "body",
    title: "Body / 身体調整",
    open: false,
    fields: [
      ["torso_preset", "Torso / 胴体"],
      ["lower_body_preset", "Lower Body / 下半身"],
      ["arm_preset", "Arms / 腕"],
    ],
  },
  {
    id: "hands_direction",
    title: "Hands & Direction / 手・方向",
    open: false,
    fields: [
      ["right_hand_preset", "Right Hand / 右手"],
      ["left_hand_preset", "Left Hand / 左手"],
      ["head_preset", "Head / 頭の向き"],
      ["gaze_preset", "Gaze / 視線"],
    ],
  },
  {
    id: "advanced",
    title: "Advanced / 詳細設定",
    open: false,
    fields: [
      ["strength", "Strength / 強さ"],
      ["stabilizer", "Stabilizer / 補強"],
      ["merge_style", "Merge / 結合"],
    ],
  },
];
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

function widgetOptions(w) {
  const values = typeof w?.options?.values === "function" ? w.options.values() : w?.options?.values;
  return Array.isArray(values) ? values : [w?.value ?? ""];
}

function setWidgetValue(node, name, value) {
  const w = widget(node, name);
  if (!w || w.value === value) return;
  w.value = value;
  w.callback?.(value);
  node.__k2pgUpdatePreview?.();
  node.setDirtyCanvas?.(true, false);
  app.graph?.setDirtyCanvas?.(true, true);
}

function hideNativeWidget(w) {
  if (!w || w.__k2pgAccordionHidden) return;
  w.__k2pgAccordionHidden = {
    type: w.type,
    hidden: w.hidden,
    draw: w.draw,
    computeSize: w.computeSize,
  };
  w.serialize = true;
  w.options = w.options || {};
  w.options.serialize = true;
  w.hidden = true;
  w.type = "hidden";
  w.draw = () => {};
  w.computeSize = () => [0, -4];
}

function restoreNativeWidget(w) {
  const original = w?.__k2pgAccordionHidden;
  if (!original) return;
  w.type = original.type;
  w.hidden = original.hidden;
  w.draw = original.draw;
  w.computeSize = original.computeSize;
  delete w.__k2pgAccordionHidden;
}

function accordionState(node) {
  if (!node.properties) node.properties = {};
  const saved = node.properties[ACCORDION_STATE_PROP];
  const state = saved && typeof saved === "object" ? saved : {};
  for (const section of ACCORDION_SECTIONS) {
    if (typeof state[section.id] !== "boolean") state[section.id] = section.open;
  }
  node.properties[ACCORDION_STATE_PROP] = state;
  return state;
}

function previewHeight(node) {
  const raw = Number(node?.properties?.[PREVIEW_HEIGHT_PROP]);
  if (!Number.isFinite(raw)) return PREVIEW_MIN_HEIGHT;
  return Math.max(PREVIEW_MIN_HEIGHT, Math.min(PREVIEW_MAX_HEIGHT, Math.round(raw)));
}

function savePreviewHeight(node, preview) {
  const height = Math.round(preview?.getBoundingClientRect?.().height || 0);
  if (!height) return;
  const clamped = Math.max(PREVIEW_MIN_HEIGHT, Math.min(PREVIEW_MAX_HEIGHT, height));
  if (!node.properties) node.properties = {};
  if (Number(node.properties[PREVIEW_HEIGHT_PROP]) === clamped) return;
  node.properties[PREVIEW_HEIGHT_PROP] = clamped;
  app.graph?.setDirtyCanvas?.(true, true);
}

function attachPreviewResizePersistence(node, preview) {
  const restore = () => {
    preview.style.height = `${previewHeight(node)}px`;
  };
  restore();
  node.__k2pgRestorePreviewHeight = restore;

  let resizing = false;
  let resizeStartPreviewHeight = 0;
  let resizeStartNodeHeight = 0;
  const onPointerDown = (event) => {
    const rect = preview.getBoundingClientRect();
    resizing = event.clientX >= rect.right - 20 && event.clientY >= rect.bottom - 20;
    if (resizing) {
      resizeStartPreviewHeight = rect.height;
      resizeStartNodeHeight = Number(node.size?.[1]) || 0;
    }
  };
  const onPointerUp = () => {
    if (resizing) {
      requestAnimationFrame(() => {
        const currentPreviewHeight = preview.getBoundingClientRect().height;
        const delta = currentPreviewHeight - resizeStartPreviewHeight;
        savePreviewHeight(node, preview);
        if (resizeStartNodeHeight > 0 && Math.abs(delta) >= 1) {
          const width = Number(node.size?.[0]) || 320;
          node.setSize?.([width, Math.max(120, Math.round(resizeStartNodeHeight + delta))]);
          app.graph?.setDirtyCanvas?.(true, true);
        }
      });
    }
    resizing = false;
  };
  const onPointerCancel = () => {
    resizing = false;
  };
  preview.addEventListener("pointerdown", onPointerDown);
  preview.addEventListener("pointerup", onPointerUp);
  preview.addEventListener("pointercancel", onPointerCancel);
  node.__k2pgCleanupPreviewResize = () => {
    preview.removeEventListener("pointerdown", onPointerDown);
    preview.removeEventListener("pointerup", onPointerUp);
    preview.removeEventListener("pointercancel", onPointerCancel);
  };
}

function fetchPresetPayload() {
  return fetch(PRESET_URL, { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))));
}

function fetchPresets(force = false) {
  if (force) presetPayloadPromise = null;
  if (!presetPayloadPromise) {
    presetPayloadPromise = fetchPresetPayload()
      .catch((firstError) => {
        console.warn("[Krea2 Pose Gesture] Preset load failed; retrying once.", firstError);
        return new Promise((resolve) => setTimeout(resolve, 500)).then(fetchPresetPayload);
      })
      .catch((finalError) => {
        console.warn("[Krea2 Pose Gesture] Failed to load presets after retry.", finalError);
        presetPayloadPromise = null;
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
    .k2pg-accordion{box-sizing:border-box;padding:4px 8px 6px;color:#ddd;font:11px sans-serif}
    .k2pg-section{margin:0 0 5px;border:1px solid #424242;border-radius:6px;background:#181818;overflow:hidden}
    .k2pg-section>summary{display:flex;align-items:center;gap:6px;padding:7px 8px;cursor:pointer;color:#eee;font-weight:700;user-select:none;list-style:none}
    .k2pg-section>summary::-webkit-details-marker{display:none}
    .k2pg-section>summary::before{content:"▶";width:11px;color:#999;font-size:9px}
    .k2pg-section[open]>summary::before{content:"▼";color:#35d0c8}
    .k2pg-section-count{margin-left:auto;min-width:17px;padding:1px 5px;border-radius:9px;background:#303030;color:#aaa;text-align:center;font-size:10px}
    .k2pg-section-count.active{background:#164846;color:#65eee7}
    .k2pg-section-body{display:grid;gap:5px;padding:2px 7px 8px;border-top:1px solid #303030}
    .k2pg-field{display:grid;grid-template-columns:minmax(96px,42%) minmax(0,1fr);align-items:center;gap:7px;min-height:25px}
    .k2pg-field-label{color:#bbb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .k2pg-field select{box-sizing:border-box;width:100%;min-width:0;height:25px;border:1px solid #4a4a4a;border-radius:5px;background:#222;color:#eee;padding:2px 5px;font:11px sans-serif}
    .k2pg-field input[type=checkbox]{justify-self:end;width:34px;height:18px;accent-color:#35d0c8}
    .k2pg-live-wrap{box-sizing:border-box;padding:6px 8px 8px}
    .k2pg-live-label{color:#35d0c8;font-size:11px;font-weight:700;margin-bottom:4px}
    .k2pg-live-preview{box-sizing:border-box;width:100%;min-height:76px;max-height:240px;resize:vertical;overflow:auto;border:1px solid #444;border-radius:6px;background:#151515;color:#ddd;padding:7px;font:11px monospace;white-space:pre-wrap;user-select:text}
  `;
  document.head.appendChild(style);
}

function attachAccordion(node) {
  if (node.__k2pgAccordionAttached) return;
  node.__k2pgAccordionAttached = true;
  ensureStyle();

  const fieldNames = ACCORDION_SECTIONS.flatMap((section) => section.fields.map(([name]) => name));
  const nativeWidgets = fieldNames.map((name) => widget(node, name)).filter(Boolean);
  for (const w of nativeWidgets) hideNativeWidget(w);

  const wrap = document.createElement("div");
  wrap.className = "k2pg-accordion";
  const controls = new Map();
  const sections = new Map();
  const state = accordionState(node);
  let lastAccordionHeight = 0;

  const updateCounts = () => {
    for (const section of ACCORDION_SECTIONS) {
      const entry = sections.get(section.id);
      if (!entry) continue;
      const count = section.fields.reduce((total, [name]) => {
        if (["enable_pose_preset", "target_slot", "human_type", "strength", "stabilizer", "merge_style"].includes(name)) return total;
        const value = clean(widgetValue(node, name, NONE_OPTION));
        return total + (value && value !== NONE_OPTION ? 1 : 0);
      }, 0);
      entry.count.textContent = String(count);
      entry.count.classList.toggle("active", count > 0);
    }
  };

  const sync = () => {
    for (const [name, control] of controls) {
      const value = widgetValue(node, name, control.type === "checkbox" ? false : "");
      if (control.type === "checkbox") control.checked = Boolean(value);
      else control.value = String(value);
    }
    const currentState = accordionState(node);
    for (const [id, entry] of sections) entry.details.open = Boolean(currentState[id]);
    updateCounts();
  };

  for (const section of ACCORDION_SECTIONS) {
    const details = document.createElement("details");
    details.className = "k2pg-section";
    details.open = Boolean(state[section.id]);
    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.textContent = section.title;
    const count = document.createElement("span");
    count.className = "k2pg-section-count";
    count.textContent = "0";
    summary.append(title, count);
    const body = document.createElement("div");
    body.className = "k2pg-section-body";

    for (const [name, labelText] of section.fields) {
      const w = widget(node, name);
      if (!w) continue;
      const row = document.createElement("label");
      row.className = "k2pg-field";
      row.title = labelText;
      const label = document.createElement("span");
      label.className = "k2pg-field-label";
      label.textContent = labelText;
      let control;
      if (name === "enable_pose_preset") {
        control = document.createElement("input");
        control.type = "checkbox";
        control.checked = Boolean(w.value);
        control.addEventListener("change", () => setWidgetValue(node, name, control.checked));
      } else {
        control = document.createElement("select");
        for (const value of widgetOptions(w)) {
          const option = document.createElement("option");
          option.value = String(value);
          option.textContent = String(value);
          control.appendChild(option);
        }
        control.value = String(w.value ?? "");
        control.addEventListener("change", () => {
          setWidgetValue(node, name, control.value);
          updateCounts();
        });
      }
      controls.set(name, control);
      row.append(label, control);
      body.appendChild(row);
    }

    details.append(summary, body);
    details.addEventListener("toggle", () => {
      const currentState = accordionState(node);
      if (currentState[section.id] === details.open) return;
      currentState[section.id] = details.open;
      app.graph?.setDirtyCanvas?.(true, true);
      requestAnimationFrame(() => {
        const currentHeight = wrap.scrollHeight;
        const delta = lastAccordionHeight > 0 ? currentHeight - lastAccordionHeight : 0;
        lastAccordionHeight = currentHeight;
        if (Math.abs(delta) >= 1) {
          const width = Number(node.size?.[0]) || 320;
          const height = Number(node.size?.[1]) || 300;
          node.setSize?.([width, Math.max(180, Math.round(height + delta))]);
        }
      });
    });
    sections.set(section.id, { details, count });
    wrap.appendChild(details);
  }

  node.addDOMWidget("krea2_pose_accordion", "Krea2PoseAccordion", wrap, {
    serialize: false,
    hideOnZoom: false,
    getMinHeight: () => wrap.scrollHeight + 8,
  });
  requestAnimationFrame(() => {
    lastAccordionHeight = wrap.scrollHeight;
  });
  node.__k2pgSyncAccordion = sync;
  node.__k2pgCleanupAccordion = () => {
    for (const w of nativeWidgets) restoreNativeWidget(w);
    delete node.__k2pgSyncAccordion;
    delete node.__k2pgCleanupAccordion;
    node.__k2pgAccordionAttached = false;
  };
  sync();
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
  attachPreviewResizePersistence(node, preview);
  wrap.append(label, preview);

  node.addDOMWidget("krea2_pose_prompt_preview", "Krea2PosePromptPreview", wrap, {
    serialize: false,
    hideOnZoom: false,
    getMinHeight: () => previewHeight(node) + 34,
  });

  const update = () => {
    preview.value = buildPreview(node, displayMaps);
    node.setDirtyCanvas?.(true, false);
  };
  node.__k2pgUpdatePreview = update;

  const callbackRestorers = [];
  for (const w of node.widgets || []) {
    if (w.__k2pgPreviewWrapped) continue;
    w.__k2pgPreviewWrapped = true;
    const oldCallback = w.callback;
    w.callback = function (...args) {
      const result = oldCallback?.apply(this, args);
      queueMicrotask(update);
      return result;
    };
    callbackRestorers.push(() => {
      w.callback = oldCallback;
      delete w.__k2pgPreviewWrapped;
    });
  }
  node.__k2pgCleanupLivePreview = () => {
    node.__k2pgCleanupPreviewResize?.();
    for (const restore of callbackRestorers) restore();
    delete node.__k2pgCleanupPreviewResize;
    delete node.__k2pgRestorePreviewHeight;
    delete node.__k2pgUpdatePreview;
    delete node.__k2pgCleanupLivePreview;
    node.__k2pgLivePreviewAttached = false;
  };
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
      attachAccordion(this);
      fetchPresets().then((payload) => attachPreview(this, buildDisplayMaps(payload)));
    };
    const oldConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const result = oldConfigure?.apply(this, arguments);
      if (!this.__k2pgAccordionAttached) attachAccordion(this);
      this.__k2pgSyncAccordion?.();
      fetchPresets().then((payload) => {
        if (!this.__k2pgLivePreviewAttached) attachPreview(this, buildDisplayMaps(payload));
        this.__k2pgRestorePreviewHeight?.();
        this.__k2pgUpdatePreview?.();
      });
      return result;
    };
    const oldRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function () {
      this.__k2pgCleanupLivePreview?.();
      this.__k2pgCleanupAccordion?.();
      return oldRemoved?.apply(this, arguments);
    };
  },
});
