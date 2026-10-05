import {
    BoxGeometry,
    Color,
    DirectionalLight,
    GridHelper,
    HemisphereLight,
    InstancedMesh,
    LineBasicMaterial,
    Matrix4,
    MeshStandardMaterial,
    PCFSoftShadowMap,
    PerspectiveCamera,
    Quaternion,
    Scene,
    Vector3,
    WebGLRenderer
} from "three";
import type { WebGLProgramParametersWithUniforms } from "three";

import type { ConfigChanges } from "./config.ts";
import type { ReliefModel } from "./models.ts";
import type { DOMReliefConfig, LayoutBlock, LayoutResult } from "./types.ts";
import { OrbitController } from "./OrbitController.ts";
import { colorForNode } from "./colors.ts";


interface PlacedModel {
    readonly layout: LayoutResult;
    readonly mesh: InstancedMesh;
    scale: number;
    offsetX: number;
}


// Model side when sameScale is off.
const NORMALIZED_SIDE: number = 24;

// RENDERING
const EDGE_VARYINGS: string = `
    varying vec3 vEdgeLocal;
    varying vec3 vEdgeNormal;
    varying vec3 vEdgeScale;
`;
const EDGE_VERTEX: string = `
    #include <begin_vertex>
    vEdgeLocal = position;
    vEdgeNormal = normal;
    vEdgeScale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz))
        * vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
`;
const EDGE_FRAGMENT: string = `
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


export class ReliefScene {
    private readonly ownsCanvas: boolean;
    private readonly sizeSource: HTMLElement;
    private readonly renderer: WebGLRenderer;
    private readonly scene: Scene = new Scene();
    private readonly camera: PerspectiveCamera = new PerspectiveCamera(38, 1, 0.1, 10000);
    private readonly orbit: OrbitController;
    private readonly geometry: BoxGeometry = new BoxGeometry(1, 1, 1);
    private readonly material: MeshStandardMaterial = new MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0
    });
    private readonly sun: DirectionalLight = new DirectionalLight(0xffffff, 1.0 * Math.PI);
    private readonly fill: DirectionalLight = new DirectionalLight(0xffffff, 0.22 * Math.PI);
    private readonly resizeObserver: ResizeObserver;

    private config: Readonly<DOMReliefConfig>;
    private placed: PlacedModel[] = [];
    private grid: GridHelper | null = null;
    private gridExtent: number = 10;
    private dirty: boolean = true;
    private frame: number = 0;
    private disposed: boolean = false;

    public readonly canvas: HTMLCanvasElement;

    constructor(target: HTMLCanvasElement | HTMLElement, config: Readonly<DOMReliefConfig>) {
        this.config = config;
        this.ownsCanvas = !(target instanceof HTMLCanvasElement);
        this.canvas = target instanceof HTMLCanvasElement ? target : document.createElement("canvas");
        this.canvas.classList.add("dom-relief-canvas");

        if(this.ownsCanvas) {
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
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.02;

        this.material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
            shader.vertexShader = EDGE_VARYINGS + shader.vertexShader.replace("#include <begin_vertex>", EDGE_VERTEX);
            shader.fragmentShader = EDGE_VARYINGS + shader.fragmentShader.replace("#include <color_fragment>", EDGE_FRAGMENT);
        };

        this.scene.add(new HemisphereLight(0xffffff, 0x50566a, 0.55 * Math.PI), this.sun, this.fill);

        this.orbit = new OrbitController(this.camera, this.canvas, {
            onChange: () => this.requestRender(),
            onDoubleClick: () => this.fit()
        });

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.sizeSource);

        this.resize();
        this.loop();
    }

    private buildMeshes(models: ReliefModel[]) {
        this.clearMeshes();

        const matrix: Matrix4 = new Matrix4();
        const rotation: Quaternion = new Quaternion();
        const position: Vector3 = new Vector3();
        const size: Vector3 = new Vector3();

        for(const model of models) {
            if(model.layout === null) {
                continue;
            }

            const mesh: InstancedMesh = new InstancedMesh(this.geometry, this.material, model.layout.blocks.length);

            model.layout.blocks.forEach((block: LayoutBlock, index: number) => {
                const inset: number = Math.min(this.config.gap * 0.35, 0.08 * Math.min(block.width, block.length));
                const drawnThickness: number = block.thickness * 0.9;

                position.set(block.x + block.width / 2, block.elevation + drawnThickness / 2, block.z + block.length / 2);
                size.set(Math.max(block.width - 2 * inset, 1e-3), Math.max(drawnThickness, 1e-3), Math.max(block.length - 2 * inset, 1e-3));
                matrix.compose(position, rotation, size);
                mesh.setMatrixAt(index, matrix);
            });

            mesh.instanceMatrix.needsUpdate = true;

            this.scene.add(mesh);

            this.placed.push({
                layout: model.layout,
                mesh: mesh,
                scale: 1,
                offsetX: 0
            });
        }

        this.recolor();
    }

    private recolor() {
        const color: Color = new Color();

        for(const model of this.placed) {
            model.layout.blocks
                .forEach((block: LayoutBlock, index: number) => {
                    model.mesh
                        .setColorAt(index, colorForNode(block.node, this.config, color));
                });

            if(model.mesh.instanceColor !== null) {
                model.mesh.instanceColor.needsUpdate = true;
            }
        }
    }

    private clearMeshes() {
        for(const model of this.placed) {
            this.scene.remove(model.mesh);
            model.mesh.dispose();
        }

        this.placed = [];
    }

    private place() {
        const vertical: boolean = this.config.orientation === "vertical";
        const normalize: boolean = this.placed.length > 1 && !this.config.sameScale;

        for(const model of this.placed) {
            model.scale = normalize ? NORMALIZED_SIDE / model.layout.side : 1;
        }

        const sides: number[] = this.placed.map((model: PlacedModel): number => model.layout.side * model.scale);
        const margin: number = this.placed.length > 1 ? 0.18 * Math.max(...sides) : 0;
        const total: number = sides.reduce((sum: number, side: number): number => sum + side, 0) + margin * Math.max(0, this.placed.length - 1);

        let cursor: number = -total / 2;

        this.placed
            .forEach((model: PlacedModel, index: number) => {
                model.offsetX = cursor + sides[index] / 2;
                cursor += sides[index] + margin;
                model.mesh.position.set(model.offsetX, 0, 0);
                model.mesh.scale.setScalar(model.scale);
                model.mesh.rotation.set(vertical ? Math.PI / 2 : 0, 0, 0);
            });

        if(vertical) {
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

    private buildGrid() {
        this.removeGrid();

        if(!this.config.showGrid) return;

        const grid: GridHelper = new GridHelper(this.gridExtent, 24, this.config.gridColor, this.config.gridColor);
        const material: LineBasicMaterial = grid.material as LineBasicMaterial;

        material.transparent = true;
        material.opacity = 0.7;

        if(this.config.orientation === "vertical") {
            grid.rotation.x = Math.PI / 2;

            grid.position.set(0, 0, -0.03);
        } else {
            grid.position.set(0, -0.02, 0);
        }

        this.grid = grid;

        this.scene.add(grid);
    }

    private removeGrid() {
        if(this.grid === null) return;

        this.scene.remove(this.grid);

        this.grid.geometry.dispose();
        (this.grid.material as LineBasicMaterial).dispose();

        this.grid = null;
    }

    private resize() {
        const width: number = Math.max(1, this.sizeSource.clientWidth || this.canvas.width);
        const height: number = Math.max(1, this.sizeSource.clientHeight || this.canvas.height);
        const before: number = this.canvas.clientWidth;

        this.renderer.setSize(width, height, false);

        // Keeps a canvas without CSS size from growing with the pixel ratio.
        if(
            !this.ownsCanvas
            && this.canvas.clientWidth !== before
            && this.renderer.getPixelRatio() !== 1
        ) {
            this.renderer.setPixelRatio(1);
            this.renderer.setSize(width, height, false);
        }

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.requestRender();
    }

    private loop() {
        if(this.disposed) return;

        this.frame = requestAnimationFrame(() => this.loop());

        if(this.config.autoRotate && !this.orbit.isDragging) {
            this.orbit.theta += 0.0022;
            this.dirty = true;
        }

        if(!this.dirty) return;

        this.dirty = false;

        this.orbit.apply();
        this.renderer.render(this.scene, this.camera);
    }

    /*
     * Pass models only when documents, parsing or geometry changed.
     */
    public apply(config: Readonly<DOMReliefConfig>, models: ReliefModel[] | null, changes: ConfigChanges) {
        this.config = config;

        if(models !== null) {
            this.buildMeshes(models);
        } else if(changes.color) {
            this.recolor();
        }

        if(models !== null || changes.placement || changes.theme) {
            this.place();
        }

        this.scene.background = new Color(config.background);

        if(config.interactive) {
            this.orbit.enable();
            this.canvas.classList.add("dom-relief-interactive");
        } else {
            this.orbit.disable();
            this.canvas.classList.remove("dom-relief-interactive");
        }

        this.requestRender();
    }

    public fit() {
        if(this.placed.length === 0) {
            this.orbit.target.set(0, 0, 0);

            this.orbit.radius = 40;

            this.requestRender();

            return;
        }

        let minX: number = Infinity;
        let maxX: number = -Infinity;
        let maxSide: number = 0;
        let maxHeight: number = 0;

        for(const model of this.placed) {
            const side: number = model.layout.side * model.scale;

            minX = Math.min(minX, model.offsetX - side / 2);
            maxX = Math.max(maxX, model.offsetX + side / 2);
            maxSide = Math.max(maxSide, side);
            maxHeight = Math.max(maxHeight, model.layout.height * model.scale);
        }

        const aspect: number = Math.max(0.2, this.camera.aspect);
        const tangent: number = Math.tan((this.camera.fov * Math.PI) / 360);
        const spanWidth: number = (maxX - minX) * 1.08;

        if(this.config.orientation === "vertical") {
            const spanHeight: number = maxSide * 1.1;

            this.orbit.target.set((minX + maxX) / 2, 0, maxHeight * 0.5);

            this.orbit.radius = Math.max(spanHeight / (2 * tangent), spanWidth / (2 * tangent * aspect)) * 1.05 + maxHeight;
            this.orbit.theta = 0.3;
            this.orbit.phi = 1.3;
        } else {
            const span: number = Math.max(spanWidth, maxSide, maxHeight);

            this.orbit.target.set((minX + maxX) / 2, maxHeight * 0.3, 0);

            this.orbit.radius = (span / (2 * tangent)) * (aspect < 1 ? (1.9 / aspect) * 0.75 : 1.25);
            this.orbit.theta = 0.6;
            this.orbit.phi = 0.95;
        }

        this.requestRender();
    }

    public requestRender() {
        this.dirty = true;
    }

    public dispose() {
        this.disposed = true;

        cancelAnimationFrame(this.frame);

        this.resizeObserver.disconnect();
        this.orbit.disable();
        this.clearMeshes();
        this.removeGrid();
        this.geometry.dispose();
        this.material.dispose();
        this.renderer.dispose();
        this.canvas.classList.remove("dom-relief-canvas", "dom-relief-fill", "dom-relief-interactive");

        this.ownsCanvas
            && this.canvas.remove();
    }
}