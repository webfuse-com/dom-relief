import type { DOMReliefConfig, DOMReliefMeta } from "./types.ts";
export declare function createDOMRelief(config?: Partial<DOMReliefConfig>): DOMRelief;
export declare class DOMRelief {
    private config;
    private readonly models;
    private scene;
    private metaCache;
    constructor(config?: Partial<DOMReliefConfig>);
    private buildModels;
    private everything;
    attach(target: HTMLCanvasElement | HTMLElement): this;
    detach(): this;
    update<K extends keyof DOMReliefConfig>(key: K, value: DOMReliefConfig[K]): this;
    update(changes: Partial<DOMReliefConfig>): this;
    getConfig(): DOMReliefConfig;
    dispose(): void;
    get meta(): DOMReliefMeta;
    get canvas(): HTMLCanvasElement | null;
}
