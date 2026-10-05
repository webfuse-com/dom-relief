import { PerspectiveCamera, Vector3 } from "three";


export interface OrbitCallbacks {
    readonly onChange: () => void;
    readonly onDoubleClick: () => void;
}

interface PointerState {
    x: number;
    y: number;
    readonly button: number;
    readonly shift: boolean;
}

interface PinchState {
    readonly distance: number;
    readonly middleX: number;
    readonly middleY: number;
}


export class OrbitController {
    private readonly camera: PerspectiveCamera;
    private readonly element: HTMLElement;
    private readonly callbacks: OrbitCallbacks;
    private readonly pointers: Map<number, PointerState> = new Map();
    private readonly detachers: Array<() => void> = [];

    private pinch: PinchState | null = null;

    public readonly target: Vector3 = new Vector3();

    public theta: number = 0.75;
    public phi: number = 0.95;
    public radius: number = 60;
    // Above PI / 2 the camera can look from below.
    public maxPhi: number = 1.55;

    constructor(camera: PerspectiveCamera, element: HTMLElement, callbacks: OrbitCallbacks) {
        this.camera = camera;
        this.element = element;
        this.callbacks = callbacks;
    }

    private rotate(deltaX: number, deltaY: number) {
        this.theta -= deltaX * 0.006;
        this.phi = Math.min(this.maxPhi, Math.max(0.05, this.phi - deltaY * 0.006));
        this.callbacks.onChange();
    }

    private pan(deltaX: number, deltaY: number) {
        const factor: number = this.radius * 0.0014;
        const right: Vector3 = new Vector3();
        const up: Vector3 = new Vector3();

        this.camera.updateMatrix();
        right.setFromMatrixColumn(this.camera.matrix, 0);
        up.setFromMatrixColumn(this.camera.matrix, 1);
        this.target.addScaledVector(right, -deltaX * factor).addScaledVector(up, deltaY * factor);
        this.callbacks.onChange();
    }

    private zoom(factor: number) {
        this.radius = Math.min(20000, Math.max(0.5, this.radius * factor));

        this.callbacks.onChange();
    }

    private listen(type: string, handler: (event: Event) => void, options?: AddEventListenerOptions) {
        this.element.addEventListener(type, handler, options);

        this.detachers.push(() => this.element.removeEventListener(type, handler, options));
    }

    private handleDown(event: PointerEvent) {
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

    private handleMove(event: PointerEvent) {
        const pointer: PointerState | undefined = this.pointers.get(event.pointerId);

        if(pointer === undefined) return;

        const deltaX: number = event.clientX - pointer.x;
        const deltaY: number = event.clientY - pointer.y;

        pointer.x = event.clientX;
        pointer.y = event.clientY;

        if(this.pointers.size === 1) {
            (pointer.button === 1 || pointer.button === 2 || pointer.shift)
                ? this.pan(deltaX, deltaY)
                : this.rotate(deltaX, deltaY);

            return;
        }

        if(this.pointers.size === 2) {
            const [ first, second ]: PointerState[] = Array.from(this.pointers.values());

            const distance: number = Math.hypot(first.x - second.x, first.y - second.y);
            const middleX: number = (first.x + second.x) / 2;
            const middleY: number = (first.y + second.y) / 2;

            if(this.pinch !== null) {
                this.zoom(this.pinch.distance / Math.max(1, distance));
                this.pan(middleX - this.pinch.middleX, middleY - this.pinch.middleY);
            }

            this.pinch = {
                distance: distance,
                middleX: middleX,
                middleY: middleY
            };
        }
    }

    private handleUp(event: PointerEvent) {
        this.pointers.delete(event.pointerId);
        this.pinch = null;

        if(this.pointers.size === 0) {
            this.element.classList.remove("dom-relief-dragging");
        }
    }

    public enable() {
        if(this.enabled) {
            return;
        }

        this.listen("contextmenu", (event: Event) => event.preventDefault());
        this.listen("pointerdown", (event: Event) => this.handleDown(event as PointerEvent));
        this.listen("pointermove", (event: Event) => this.handleMove(event as PointerEvent));
        this.listen("pointerup", (event: Event) => this.handleUp(event as PointerEvent));
        this.listen("pointercancel", (event: Event) => this.handleUp(event as PointerEvent));
        this.listen("dblclick", () => this.callbacks.onDoubleClick());
        this.listen("wheel", (event: Event) => {
            event.preventDefault();
            this.zoom(Math.exp((event as WheelEvent).deltaY * 0.0012));
        }, {
            passive: false
        });
    }

    public disable() {
        for(const detach of this.detachers) {
            detach();
        }

        this.detachers.length = 0;
        this.pointers.clear();
        this.element.classList.remove("dom-relief-dragging");
    }

    public apply() {
        const sinPhi: number = Math.sin(this.phi);

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

    public get enabled(): boolean {
        return this.detachers.length > 0;
    }

    public get isDragging(): boolean {
        return this.pointers.size > 0;
    }
}