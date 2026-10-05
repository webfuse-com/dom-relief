import { PerspectiveCamera, Vector3 } from "three";
export interface OrbitCallbacks {
    readonly onChange: () => void;
    readonly onDoubleClick: () => void;
}
export declare class OrbitController {
    private readonly camera;
    private readonly element;
    private readonly callbacks;
    private readonly pointers;
    private readonly detachers;
    private pinch;
    readonly target: Vector3;
    theta: number;
    phi: number;
    radius: number;
    maxPhi: number;
    constructor(camera: PerspectiveCamera, element: HTMLElement, callbacks: OrbitCallbacks);
    private rotate;
    private pan;
    private zoom;
    private listen;
    private handleDown;
    private handleMove;
    private handleUp;
    enable(): void;
    disable(): void;
    apply(): void;
    get enabled(): boolean;
    get isDragging(): boolean;
}
