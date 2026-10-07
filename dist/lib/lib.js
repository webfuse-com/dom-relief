// src/config.ts
var PARSE_KEYS = [
  "skipHead",
  "skipScripts",
  "textNodes",
  "maxNodes",
  "maxDepth"
];
var GEOMETRY_KEYS = [
  "layerThickness",
  "attributeWeight",
  "textWeight",
  "gap",
  "layout"
];
var COLOR_KEYS = [
  "depthMax"
];
var PLACEMENT_KEYS = [
  "orientation",
  "sameScale"
];
var THEME_KEYS = [
  "background",
  "showGrid",
  "gridColor"
];
var MOTION_KEYS = [
  "interactive",
  "autoRotate",
  "autoFit"
];
var NUMBER_KEYS = [
  "maxNodes",
  "maxDepth",
  "layerThickness",
  "attributeWeight",
  "textWeight",
  "gap",
  "depthMax"
];
var CHOICES = {
  layout: [
    "ordered",
    "squarified"
  ],
  orientation: [
    "horizontal",
    "vertical"
  ],
  projection: [
    "perspective",
    "orthographic"
  ]
};
var DEFAULT_CONFIG = {
  autoFit: true,
  autoRotate: false,
  attributeWeight: 1,
  background: "#F8FAFC",
  depthMax: 15,
  documents: [],
  gap: 0.25,
  gridColor: "#DADDE0",
  interactive: true,
  layerThickness: 2,
  layout: "ordered",
  maxDepth: 300,
  maxNodes: 4e4,
  orientation: "horizontal",
  projection: "perspective",
  sameScale: true,
  showGrid: true,
  skipHead: true,
  skipScripts: true,
  textNodes: false,
  textWeight: 1
};
function sameDocuments(previous, next) {
  return previous.length === next.length && previous.every((source, index) => source === next[index]);
}
function validateChanges(changes) {
  for (const key of Object.keys(changes)) {
    if (!(key in DEFAULT_CONFIG)) {
      throw new TypeError(`Unknown DOMRelief option "${key}"`);
    }
    const configKey = key;
    const value = changes[configKey];
    const expected = DEFAULT_CONFIG[configKey];
    const choices = CHOICES[configKey];
    if (configKey === "documents") {
      if (!Array.isArray(value)) {
        throw new TypeError('DOMRelief option "documents" must be an array');
      }
      continue;
    }
    if (NUMBER_KEYS.includes(configKey)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new TypeError(`DOMRelief option "${key}" must be a finite number of at least 0`);
      }
      continue;
    }
    if (choices !== void 0 && !choices.includes(value)) {
      throw new TypeError(`DOMRelief option "${key}" must be one of ${choices.map((choice) => `"${choice}"`).join(", ")}`);
    }
    if (typeof value !== typeof expected) {
      throw new TypeError(`DOMRelief option "${key}" must be a ${typeof expected}`);
    }
  }
}
function mergeConfig(base, changes) {
  const merged = {
    ...base,
    ...changes
  };
  merged.documents = [...merged.documents];
  return merged;
}
function diffConfig(previous, next) {
  const changed = (keys) => keys.some((key) => previous[key] !== next[key]);
  return {
    documents: !sameDocuments(previous.documents, next.documents),
    parse: changed(PARSE_KEYS),
    geometry: changed(GEOMETRY_KEYS),
    color: changed(COLOR_KEYS),
    placement: changed(PLACEMENT_KEYS),
    theme: changed(THEME_KEYS),
    motion: changed(MOTION_KEYS),
    orientation: previous.orientation !== next.orientation
  };
}

// src/layout.ts
function worstRatio(row, side) {
  let sum = 0;
  let largest = 0;
  let smallest = Infinity;
  for (const item of row) {
    sum += item.area;
    largest = Math.max(largest, item.area);
    smallest = Math.min(smallest, item.area);
  }
  return Math.max(side * side * largest / (sum * sum), sum * sum / (side * side * smallest));
}
function ownWeight(node, options) {
  const attributePart = options.attributeWeight * 0.45 * Math.log1p(node.attributeChars);
  const textPart = options.textWeight * 0.45 * Math.log1p(node.textLength);
  return 1 + attributePart + textPart;
}
function squarify(nodes, weights, x, z, width, length) {
  const total = nodes.reduce((sum, node) => sum + (weights.get(node) ?? 0), 0);
  const scale = width * length / total;
  const result = [];
  let rest = nodes.map((node) => ({
    node,
    area: (weights.get(node) ?? 0) * scale
  })).sort((first, second) => second.area - first.area);
  let restX = x;
  let restZ = z;
  let restWidth = width;
  let restLength = length;
  while (rest.length > 0) {
    const side = Math.min(restWidth, restLength);
    let row = [rest[0]];
    let taken = 1;
    let worst = worstRatio(row, side);
    while (taken < rest.length) {
      const candidate = row.concat(rest[taken]);
      const candidateWorst = worstRatio(candidate, side);
      if (candidateWorst > worst) {
        break;
      }
      row = candidate;
      worst = candidateWorst;
      taken++;
    }
    const rowArea = row.reduce((sum, item) => sum + item.area, 0);
    if (restWidth >= restLength) {
      const columnWidth = rowArea / restLength;
      let cursor = restZ;
      for (const item of row) {
        const itemLength = item.area / columnWidth;
        result.push([item.node, restX, cursor, columnWidth, itemLength]);
        cursor += itemLength;
      }
      restX += columnWidth;
      restWidth -= columnWidth;
    } else {
      const rowLength = rowArea / restWidth;
      let cursor = restX;
      for (const item of row) {
        const itemWidth = item.area / rowLength;
        result.push([item.node, cursor, restZ, itemWidth, rowLength]);
        cursor += itemWidth;
      }
      restZ += rowLength;
      restLength -= rowLength;
    }
    rest = rest.slice(taken);
  }
  return result;
}
function strips(nodes, weights, x, z, width, length) {
  const total = nodes.reduce((sum, node) => sum + (weights.get(node) ?? 0), 0);
  const result = [];
  let offset = 0;
  for (const node of nodes) {
    const share = (weights.get(node) ?? 0) / total;
    if (width >= length) {
      result.push([node, x + offset, z, width * share, length]);
      offset += width * share;
    } else {
      result.push([node, x, z + offset, width, length * share]);
      offset += length * share;
    }
  }
  return result;
}
function computeLayout(root, options) {
  const weights = /* @__PURE__ */ new Map();
  const owns = /* @__PURE__ */ new Map();
  function weigh(node) {
    const own = ownWeight(node, options);
    let sum = own;
    for (const child of node.children) {
      sum += weigh(child);
    }
    owns.set(node, own);
    weights.set(node, sum);
    return sum;
  }
  const rootWeight = weigh(root);
  const side = Math.sqrt(rootWeight);
  const thickness = options.layerThickness * 0.5;
  const blocks = [];
  const blockByNode = /* @__PURE__ */ new Map();
  let height = 0;
  function place(node, x, z, width, length, elevation) {
    const block = {
      node,
      index: blocks.length,
      subtreeSize: 1,
      x,
      z,
      width,
      length,
      elevation,
      thickness,
      ownWeight: owns.get(node) ?? 1,
      weight: weights.get(node) ?? 1
    };
    blocks.push(block);
    blockByNode.set(node, block);
    height = Math.max(height, elevation + thickness);
    const padding = Math.min(options.gap, 0.12 * Math.min(width, length));
    const innerWidth = width - 2 * padding;
    const innerLength = length - 2 * padding;
    if (node.children.length > 0 && innerWidth > 1e-4 && innerLength > 1e-4) {
      const rects = options.layout === "ordered" ? strips(node.children, weights, x + padding, z + padding, innerWidth, innerLength) : squarify(node.children, weights, x + padding, z + padding, innerWidth, innerLength);
      if (options.layout !== "ordered") {
        rects.sort((first, second) => node.children.indexOf(first[0]) - node.children.indexOf(second[0]));
      }
      for (const rect of rects) {
        place(rect[0], rect[1], rect[2], rect[3], rect[4], elevation + thickness);
      }
    }
    block.subtreeSize = blocks.length - block.index;
  }
  place(root, -side / 2, -side / 2, side, side, 0);
  return {
    blocks,
    blockByNode,
    side,
    height
  };
}

// src/parse.ts
var SKIPPED_TAGS = /* @__PURE__ */ new Set([
  "script",
  "style",
  "template",
  "noscript"
]);
function serializeSource(source) {
  if (typeof source === "string") {
    return source;
  }
  if ("documentElement" in source) {
    return source.documentElement.outerHTML;
  }
  return source.outerHTML;
}
function parseHtml(html, options) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const rootElement = options.skipHead ? doc.body ?? doc.documentElement : doc.documentElement;
  let count = 0;
  let truncated = false;
  function walk(element, depth, parent) {
    if (count >= options.maxNodes || depth > options.maxDepth) {
      truncated = true;
      return null;
    }
    const tag = element.tagName.toLowerCase();
    if (options.skipScripts && SKIPPED_TAGS.has(tag)) {
      return null;
    }
    count++;
    const attributes = [];
    let attributeChars = 0;
    for (const attribute of Array.from(element.attributes)) {
      attributes.push([attribute.name, attribute.value]);
      attributeChars += attribute.name.length + attribute.value.length;
    }
    const children = [];
    let textLength = 0;
    const node = {
      tag,
      depth,
      parent,
      children,
      attributes,
      attributeChars,
      get textLength() {
        return textLength;
      }
    };
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childNode = walk(child, depth + 1, node);
        if (childNode !== null) {
          children.push(childNode);
        }
        continue;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.nodeValue ?? "").trim();
        if (text.length === 0) continue;
        if (!options.textNodes || count >= options.maxNodes) {
          textLength += text.length;
          continue;
        }
        count++;
        children.push({
          tag: "#text",
          depth: depth + 1,
          parent: node,
          children: [],
          attributes: [],
          attributeChars: 0,
          textLength: text.length
        });
        continue;
      }
    }
    return node;
  }
  const root = rootElement !== null ? walk(rootElement, 0, null) : null;
  return {
    root,
    nodeCount: count,
    truncated
  };
}

// src/models.ts
function parseKey(options) {
  return [
    options.skipHead,
    options.skipScripts,
    options.textNodes,
    options.maxNodes,
    options.maxDepth
  ].join("|");
}
var ModelCache = class {
  trees = /* @__PURE__ */ new Map();
  build(config) {
    const key = parseKey(config);
    const sources = config.documents.map((source) => serializeSource(source));
    const wanted = new Set(sources);
    for (const html of Array.from(this.trees.keys())) {
      if (!wanted.has(html)) {
        this.trees.delete(html);
      }
    }
    return config.documents.map((source, index) => {
      const tree = this.tree(sources[index], key, config);
      return {
        source,
        tree,
        layout: tree.root !== null ? computeLayout(tree.root, config) : null
      };
    });
  }
  clear() {
    this.trees.clear();
  }
  tree(html, key, options) {
    const cached = this.trees.get(html);
    if (cached !== void 0 && cached.key === key) {
      return cached.tree;
    }
    const tree = parseHtml(html, options);
    this.trees.set(html, {
      key,
      tree
    });
    return tree;
  }
};

// src/scene.ts
import {
  BoxGeometry,
  Color as Color2,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  PerspectiveCamera as PerspectiveCamera2,
  Quaternion,
  Scene,
  Vector3 as Vector32,
  WebGLRenderer
} from "three";

// src/OrbitController.ts
import { Vector3 } from "three";
var OrbitController = class {
  camera;
  element;
  callbacks;
  pointers = /* @__PURE__ */ new Map();
  detachers = [];
  pinch = null;
  target = new Vector3();
  theta = 0.75;
  phi = 0.95;
  radius = 60;
  // Above PI / 2 the camera can look from below.
  maxPhi = 1.55;
  constructor(camera, element, callbacks) {
    this.camera = camera;
    this.element = element;
    this.callbacks = callbacks;
  }
  rotate(deltaX, deltaY) {
    this.theta -= deltaX * 6e-3;
    this.phi = Math.min(this.maxPhi, Math.max(0.05, this.phi - deltaY * 6e-3));
    this.callbacks.onChange();
  }
  pan(deltaX, deltaY) {
    const factor = this.radius * 14e-4;
    const right = new Vector3();
    const up = new Vector3();
    this.camera.updateMatrix();
    right.setFromMatrixColumn(this.camera.matrix, 0);
    up.setFromMatrixColumn(this.camera.matrix, 1);
    this.target.addScaledVector(right, -deltaX * factor).addScaledVector(up, deltaY * factor);
    this.callbacks.onChange();
  }
  zoom(factor) {
    this.radius = Math.min(2e4, Math.max(0.5, this.radius * factor));
    this.callbacks.onChange();
  }
  listen(type, handler, options) {
    this.element.addEventListener(type, handler, options);
    this.detachers.push(() => this.element.removeEventListener(type, handler, options));
  }
  handleDown(event) {
    this.element.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      shift: event.shiftKey
    });
    this.pinch = null;
    this.element.classList.add("dom-relief-dragging");
  }
  handleMove(event) {
    const pointer = this.pointers.get(event.pointerId);
    if (pointer === void 0) return;
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (this.pointers.size === 1) {
      pointer.button === 1 || pointer.button === 2 || pointer.shift ? this.pan(deltaX, deltaY) : this.rotate(deltaX, deltaY);
      return;
    }
    if (this.pointers.size === 2) {
      const [first, second] = Array.from(this.pointers.values());
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const middleX = (first.x + second.x) / 2;
      const middleY = (first.y + second.y) / 2;
      if (this.pinch !== null) {
        this.zoom(this.pinch.distance / Math.max(1, distance));
        this.pan(middleX - this.pinch.middleX, middleY - this.pinch.middleY);
      }
      this.pinch = {
        distance,
        middleX,
        middleY
      };
    }
  }
  handleUp(event) {
    this.pointers.delete(event.pointerId);
    this.pinch = null;
    if (this.pointers.size === 0) {
      this.element.classList.remove("dom-relief-dragging");
    }
  }
  enable() {
    if (this.enabled) {
      return;
    }
    this.listen("contextmenu", (event) => event.preventDefault());
    this.listen("pointerdown", (event) => this.handleDown(event));
    this.listen("pointermove", (event) => this.handleMove(event));
    this.listen("pointerup", (event) => this.handleUp(event));
    this.listen("pointercancel", (event) => this.handleUp(event));
    this.listen("dblclick", () => this.callbacks.onDoubleClick());
    this.listen("wheel", (event) => {
      event.preventDefault();
      this.zoom(Math.exp(event.deltaY * 12e-4));
    }, {
      passive: false
    });
  }
  disable() {
    for (const detach of this.detachers) {
      detach();
    }
    this.detachers.length = 0;
    this.pointers.clear();
    this.element.classList.remove("dom-relief-dragging");
  }
  apply() {
    const sinPhi = Math.sin(this.phi);
    this.camera.position.set(
      this.target.x + this.radius * sinPhi * Math.sin(this.theta),
      this.target.y + this.radius * Math.cos(this.phi),
      this.target.z + this.radius * sinPhi * Math.cos(this.theta)
    );
    this.camera.near = Math.max(0.01, this.radius / 500);
    this.camera.far = this.radius * 30;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.target);
  }
  get enabled() {
    return this.detachers.length > 0;
  }
  get isDragging() {
    return this.pointers.size > 0;
  }
};

// src/colors.ts
import { Color, SRGBColorSpace } from "three";
function depthColor(depth, depthMax, target) {
  const share = Math.min(1, depth / Math.max(1, depthMax));
  const beyond = Math.max(0, depth - depthMax);
  const lightness = Math.max(0.28, 0.56 - 0.06 * share - 0.04 * beyond);
  return target.setHSL(0.62 * (1 - share), 0.62, lightness, SRGBColorSpace);
}
function colorForNode(node, options, target) {
  return depthColor(node.depth, options.depthMax, target);
}

// src/scene.ts
var NORMALIZED_SIDE = 24;
var EDGE_VARYINGS = `
    varying vec3 vEdgeLocal;
    varying vec3 vEdgeNormal;
    varying vec3 vEdgeScale;
`;
var EDGE_VERTEX = `
    #include <begin_vertex>
    vEdgeLocal = position;
    vEdgeNormal = normal;
    vEdgeScale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz))
        * vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
`;
var EDGE_FRAGMENT = `
    #include <color_fragment>
    vec3 edgeAxis = abs(vEdgeNormal);
    vec3 edgeDistance = (0.5 - abs(vEdgeLocal)) * vEdgeScale;
    float edge = 1e6;
    if(edgeAxis.x < 0.5) edge = min(edge, edgeDistance.x);
    if(edgeAxis.y < 0.5) edge = min(edge, edgeDistance.y);
    if(edgeAxis.z < 0.5) edge = min(edge, edgeDistance.z);
    float edgeSoftness = fwidth(edge);
    float edgeWidth = 0.08 * vEdgeScale.y;
    diffuseColor.rgb *= 1.0 - 0.4 * (1.0 - smoothstep(edgeWidth - edgeSoftness, edgeWidth + edgeSoftness, edge));
`;
var ReliefScene = class {
  orthoCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1e4);
  ownsCanvas;
  sizeSource;
  renderer;
  scene = new Scene();
  perspectiveCamera = new PerspectiveCamera2(38, 1, 0.1, 1e4);
  orbit;
  geometry = new BoxGeometry(1, 1, 1);
  material = new MeshStandardMaterial({
    color: 16777215,
    roughness: 0.9,
    metalness: 0
  });
  sun = new DirectionalLight(16777215, 1 * Math.PI);
  fill = new DirectionalLight(16777215, 0.22 * Math.PI);
  resizeObserver;
  config;
  placed = [];
  grid = null;
  gridExtent = 10;
  dirty = true;
  frame = 0;
  disposed = false;
  settleFrame = 0;
  appliedWidth = -1;
  appliedHeight = -1;
  pendingWidth = -1;
  pendingHeight = -1;
  canvas;
  constructor(target, config) {
    this.config = config;
    this.ownsCanvas = !(target instanceof HTMLCanvasElement);
    this.canvas = target instanceof HTMLCanvasElement ? target : document.createElement("canvas");
    this.canvas.classList.add("dom-relief-canvas");
    if (this.ownsCanvas) {
      this.canvas.classList.add("dom-relief-fill");
      target.appendChild(this.canvas);
    }
    this.sizeSource = target;
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -4e-4;
    this.sun.shadow.normalBias = 0.02;
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = EDGE_VARYINGS + shader.vertexShader.replace("#include <begin_vertex>", EDGE_VERTEX);
      shader.fragmentShader = EDGE_VARYINGS + shader.fragmentShader.replace("#include <color_fragment>", EDGE_FRAGMENT);
    };
    this.scene.add(new HemisphereLight(16777215, 5265002, 0.55 * Math.PI), this.sun, this.fill);
    this.orbit = new OrbitController(this.perspectiveCamera, this.canvas, {
      onChange: () => this.requestRender(),
      onDoubleClick: () => this.fit()
    });
    this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
    this.resizeObserver.observe(this.sizeSource);
    if (this.sizeSource.parentElement !== null) {
      this.resizeObserver.observe(this.sizeSource.parentElement);
    }
    this.resize();
    this.loop();
  }
  buildMeshes(models) {
    this.clearMeshes();
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const position = new Vector32();
    const size = new Vector32();
    for (const model of models) {
      if (model.layout === null) {
        continue;
      }
      const mesh = new InstancedMesh(this.geometry, this.material, model.layout.blocks.length);
      model.layout.blocks.forEach((block, index) => {
        const inset = Math.min(this.config.gap * 0.35, 0.08 * Math.min(block.width, block.length));
        const drawnThickness = block.thickness * 0.9;
        position.set(block.x + block.width / 2, block.elevation + drawnThickness / 2, block.z + block.length / 2);
        size.set(Math.max(block.width - 2 * inset, 1e-3), Math.max(drawnThickness, 1e-3), Math.max(block.length - 2 * inset, 1e-3));
        matrix.compose(position, rotation, size);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
      this.placed.push({
        layout: model.layout,
        mesh,
        scale: 1,
        offsetX: 0
      });
    }
    this.recolor();
  }
  recolor() {
    const color = new Color2();
    for (const model of this.placed) {
      model.layout.blocks.forEach((block, index) => {
        model.mesh.setColorAt(index, colorForNode(block.node, this.config, color));
      });
      if (model.mesh.instanceColor !== null) {
        model.mesh.instanceColor.needsUpdate = true;
      }
    }
  }
  clearMeshes() {
    for (const model of this.placed) {
      this.scene.remove(model.mesh);
      model.mesh.dispose();
    }
    this.placed = [];
  }
  place() {
    const vertical = this.config.orientation === "vertical";
    const normalize = this.placed.length > 1 && !this.config.sameScale;
    for (const model of this.placed) {
      model.scale = normalize ? NORMALIZED_SIDE / model.layout.side : 1;
    }
    const sides = this.placed.map((model) => model.layout.side * model.scale);
    const margin = this.placed.length > 1 ? 0.18 * Math.max(...sides) : 0;
    const total = sides.reduce((sum, side) => sum + side, 0) + margin * Math.max(0, this.placed.length - 1);
    let cursor = -total / 2;
    this.placed.forEach((model, index) => {
      model.offsetX = cursor + sides[index] / 2;
      cursor += sides[index] + margin;
      model.mesh.position.set(model.offsetX, 0, 0);
      model.mesh.scale.setScalar(model.scale);
      model.mesh.rotation.set(vertical ? Math.PI / 2 : 0, 0, 0);
    });
    if (vertical) {
      this.sun.position.set(0.45, 0.6, 1);
      this.fill.position.set(-0.7, -0.4, 0.6);
    } else {
      this.sun.position.set(0.55, 1, 0.35);
      this.fill.position.set(-0.7, 0.35, -0.6);
    }
    this.orbit.maxPhi = vertical ? Math.PI - 0.05 : 1.55;
    this.gridExtent = Math.max(10, Math.max(total, ...sides) * 1.35);
    this.buildGrid();
  }
  buildGrid() {
    this.removeGrid();
    if (!this.config.showGrid) return;
    const grid = new GridHelper(this.gridExtent, 24, this.config.gridColor, this.config.gridColor);
    const material = grid.material;
    material.transparent = true;
    material.opacity = 0.7;
    if (this.config.orientation === "vertical") {
      grid.rotation.x = Math.PI / 2;
      grid.position.set(0, 0, -0.03);
    } else {
      grid.position.set(0, -0.02, 0);
    }
    this.grid = grid;
    this.scene.add(grid);
  }
  removeGrid() {
    if (this.grid === null) return;
    this.scene.remove(this.grid);
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    this.grid = null;
  }
  scheduleResize() {
    cancelAnimationFrame(this.settleFrame);
    this.settleFrame = requestAnimationFrame(() => this.settle());
  }
  settle() {
    const width = this.sizeSource.clientWidth;
    const height = this.sizeSource.clientHeight;
    if (width === this.appliedWidth && height === this.appliedHeight) {
      return;
    }
    if (width !== this.pendingWidth || height !== this.pendingHeight) {
      this.pendingWidth = width;
      this.pendingHeight = height;
      this.settleFrame = requestAnimationFrame(() => this.settle());
      return;
    }
    this.resize();
  }
  resize() {
    this.canvas.width = 0;
    this.canvas.height = 0;
    if (this.sizeSource.clientWidth < 2 || this.sizeSource.clientHeight < 2) {
      this.canvas.width = 300;
      this.canvas.height = 150;
    }
    const width = Math.max(1, this.sizeSource.clientWidth);
    const height = Math.max(1, this.sizeSource.clientHeight);
    this.renderer.setSize(width, height, false);
    if ((this.sizeSource.clientWidth !== width || this.sizeSource.clientHeight !== height) && this.renderer.getPixelRatio() !== 1) {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
    }
    this.appliedWidth = this.sizeSource.clientWidth;
    this.appliedHeight = this.sizeSource.clientHeight;
    this.pendingWidth = -1;
    this.pendingHeight = -1;
    this.perspectiveCamera.aspect = Math.max(1, this.canvas.clientWidth) / Math.max(1, this.canvas.clientHeight);
    this.perspectiveCamera.updateProjectionMatrix();
    this.orbit.apply();
    this.renderer.render(this.scene, this.activeCamera());
  }
  loop() {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(() => this.loop());
    if (this.config.autoRotate && !this.orbit.isDragging) {
      this.orbit.theta += 22e-4;
      this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.orbit.apply();
    this.renderer.render(this.scene, this.activeCamera());
  }
  /*
   * The orthographic camera follows the orbit and shows the target plane at the same size.
   */
  activeCamera() {
    if (this.config.projection === "perspective") {
      return this.perspectiveCamera;
    }
    const halfHeight = this.orbit.radius * Math.tan(this.perspectiveCamera.fov * Math.PI / 360);
    const halfWidth = halfHeight * this.perspectiveCamera.aspect;
    this.orthoCamera.left = -halfWidth;
    this.orthoCamera.right = halfWidth;
    this.orthoCamera.top = halfHeight;
    this.orthoCamera.bottom = -halfHeight;
    this.orthoCamera.near = -this.perspectiveCamera.far;
    this.orthoCamera.far = this.perspectiveCamera.far;
    this.orthoCamera.position.copy(this.perspectiveCamera.position);
    this.orthoCamera.quaternion.copy(this.perspectiveCamera.quaternion);
    this.orthoCamera.updateProjectionMatrix();
    return this.orthoCamera;
  }
  /*
   * Pass models only when documents, parsing or geometry changed.
   */
  apply(config, models, changes) {
    this.config = config;
    if (models !== null) {
      this.buildMeshes(models);
    } else if (changes.color) {
      this.recolor();
    }
    if (models !== null || changes.placement || changes.theme) {
      this.place();
    }
    this.scene.background = new Color2(config.background);
    if (config.interactive) {
      this.orbit.enable();
      this.canvas.classList.add("dom-relief-interactive");
    } else {
      this.orbit.disable();
      this.canvas.classList.remove("dom-relief-interactive");
    }
    this.requestRender();
  }
  fit() {
    if (this.placed.length === 0) {
      this.orbit.target.set(0, 0, 0);
      this.orbit.radius = 40;
      this.requestRender();
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let maxSide = 0;
    let maxHeight = 0;
    for (const model of this.placed) {
      const side = model.layout.side * model.scale;
      minX = Math.min(minX, model.offsetX - side / 2);
      maxX = Math.max(maxX, model.offsetX + side / 2);
      maxSide = Math.max(maxSide, side);
      maxHeight = Math.max(maxHeight, model.layout.height * model.scale);
    }
    const aspect = Math.max(0.2, this.perspectiveCamera.aspect);
    const tangent = Math.tan(this.perspectiveCamera.fov * Math.PI / 360);
    const spanWidth = (maxX - minX) * 1.08;
    if (this.config.orientation === "vertical") {
      const spanHeight = maxSide * 1.1;
      this.orbit.target.set((minX + maxX) / 2, 0, maxHeight * 0.5);
      this.orbit.radius = Math.max(spanHeight / (2 * tangent), spanWidth / (2 * tangent * aspect)) * 1.05 + maxHeight;
      this.orbit.theta = 0.3;
      this.orbit.phi = 1.3;
    } else {
      const span = Math.max(spanWidth, maxSide, maxHeight);
      this.orbit.target.set((minX + maxX) / 2, maxHeight * 0.3, 0);
      this.orbit.radius = span / (2 * tangent) * (aspect < 1 ? 1.9 / aspect * 0.75 : 1.25);
      this.orbit.theta = 0.6;
      this.orbit.phi = 0.95;
    }
    this.requestRender();
  }
  requestRender() {
    this.dirty = true;
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.settleFrame);
    this.resizeObserver.disconnect();
    this.orbit.disable();
    this.clearMeshes();
    this.removeGrid();
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.canvas.classList.remove("dom-relief-canvas", "dom-relief-fill", "dom-relief-interactive");
    this.ownsCanvas && this.canvas.remove();
  }
};

// src/meta.ts
function describeModel(model) {
  const nodesPerDepth = [];
  const tags = {};
  const stack = model.tree.root !== null ? [model.tree.root] : [];
  let nodes = 0;
  let textNodes = 0;
  let leaves = 0;
  let depthSum = 0;
  let parents = 0;
  let childSum = 0;
  let maxChildren = 0;
  let attributes = 0;
  let attributeChars = 0;
  let textChars = 0;
  while (stack.length > 0) {
    const node = stack.pop();
    nodes++;
    depthSum += node.depth;
    nodesPerDepth[node.depth] = (nodesPerDepth[node.depth] ?? 0) + 1;
    attributes += node.attributes.length;
    attributeChars += node.attributeChars;
    textChars += node.textLength;
    if (node.tag === "#text") {
      textNodes++;
    } else {
      tags[node.tag] = (tags[node.tag] ?? 0) + 1;
    }
    if (node.children.length === 0) {
      leaves++;
    } else {
      parents++;
      childSum += node.children.length;
      maxChildren = Math.max(maxChildren, node.children.length);
    }
    stack.push(...node.children);
  }
  return {
    attributeChars,
    attributes,
    averageChildren: parents > 0 ? childSum / parents : 0,
    averageDepth: nodes > 0 ? depthSum / nodes : 0,
    elements: nodes - textNodes,
    footprint: model.layout !== null ? model.layout.side * model.layout.side : 0,
    height: model.layout !== null ? model.layout.height : 0,
    leaves,
    maxChildren,
    maxDepth: Math.max(0, nodesPerDepth.length - 1),
    nodes,
    nodesPerDepth: Array.from(nodesPerDepth, (count) => count ?? 0),
    tags,
    textChars,
    textNodes,
    truncated: model.tree.truncated
  };
}

// src/DOMRelief.ts
function createDOMRelief(config = {}) {
  return new DOMRelief(config);
}
var DOMRelief = class {
  config;
  models = new ModelCache();
  scene = null;
  metaCache = null;
  constructor(config = {}) {
    validateChanges(config);
    this.config = mergeConfig(DEFAULT_CONFIG, config);
  }
  buildModels() {
    const models = this.models.build(this.config);
    this.metaCache = {
      documents: models.map(describeModel)
    };
    return models;
  }
  everything() {
    return {
      documents: true,
      parse: true,
      geometry: true,
      color: true,
      placement: true,
      theme: true,
      motion: true,
      orientation: true
    };
  }
  /*
   * Draws into a canvas, or into a new canvas filling an element.
   */
  attach(target) {
    this.detach();
    this.scene = new ReliefScene(target, this.config);
    this.scene.apply(this.config, this.buildModels(), this.everything());
    this.scene.fit();
    return this;
  }
  detach() {
    if (this.scene !== null) {
      this.scene.dispose();
      this.scene = null;
    }
    return this;
  }
  update(keyOrChanges, value) {
    const changes = typeof keyOrChanges === "string" ? {
      [keyOrChanges]: value
    } : keyOrChanges;
    validateChanges(changes);
    const previous = this.config;
    this.config = mergeConfig(previous, changes);
    const diff = diffConfig(previous, this.config);
    const documentsTouched = "documents" in changes;
    const rebuild = documentsTouched || diff.parse || diff.geometry;
    if (rebuild) {
      this.metaCache = null;
    }
    if (this.scene === null) return this;
    this.scene.apply(this.config, rebuild ? this.buildModels() : null, diff);
    if (this.config.autoFit && (diff.documents || diff.orientation || previous.sameScale !== this.config.sameScale)) {
      this.scene.fit();
    }
    return this;
  }
  getConfig() {
    return mergeConfig(this.config, {});
  }
  dispose() {
    this.detach();
    this.models.clear();
  }
  get meta() {
    if (this.metaCache === null) {
      this.buildModels();
    }
    return this.metaCache;
  }
  get canvas() {
    return this.scene !== null ? this.scene.canvas : null;
  }
};
export {
  DEFAULT_CONFIG,
  DOMRelief,
  createDOMRelief
};
