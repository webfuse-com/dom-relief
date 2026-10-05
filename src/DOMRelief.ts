import type { ConfigChanges } from "./config.ts";
import type { ReliefModel } from "./models.ts";
import type { DOMReliefConfig, DOMReliefMeta } from "./types.ts";
import { DEFAULT_CONFIG, diffConfig, mergeConfig, validateChanges } from "./config.ts";
import { ModelCache } from "./models.ts";
import { ReliefScene } from "./scene.ts";
import { describeModel } from "./meta.ts";


export function createDOMRelief(config: Partial<DOMReliefConfig> = {}): DOMRelief {
    return new DOMRelief(config);
}


/*
 * Draws DOMs as abstract 3D layer models.
 */
export class DOMRelief {
    private config: DOMReliefConfig;

    private readonly models: ModelCache = new ModelCache();

    private scene: ReliefScene | null = null;
    private metaCache: DOMReliefMeta | null = null;

    constructor(config: Partial<DOMReliefConfig> = {}) {
        validateChanges(config);

        this.config = mergeConfig(DEFAULT_CONFIG, config);
    }

    private buildModels(): ReliefModel[] {
        const models: ReliefModel[] = this.models.build(this.config);

        this.metaCache = {
            documents: models.map(describeModel)
        };

        return models;
    }

    private everything(): ConfigChanges {
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
    public attach(target: HTMLCanvasElement | HTMLElement): this {
        this.detach();
        this.scene = new ReliefScene(target, this.config);
        this.scene.apply(this.config, this.buildModels(), this.everything());
        this.scene.fit();

        return this;
    }

    public detach(): this {
        if(this.scene !== null) {
            this.scene.dispose();
            this.scene = null;
        }

        return this;
    }

    public update<K extends keyof DOMReliefConfig>(key: K, value: DOMReliefConfig[K]): this;
    public update(changes: Partial<DOMReliefConfig>): this;
    public update<K extends keyof DOMReliefConfig>(keyOrChanges: K | Partial<DOMReliefConfig>, value?: DOMReliefConfig[K]): this {
        const changes: Partial<DOMReliefConfig> = typeof keyOrChanges === "string"
            ? {
                [keyOrChanges]: value
            }
            : keyOrChanges;

        validateChanges(changes);

        const previous: DOMReliefConfig = this.config;

        this.config = mergeConfig(previous, changes);

        const diff: ConfigChanges = diffConfig(previous, this.config);
        // Passing documents always re-reads them.
        const documentsTouched: boolean = "documents" in changes;
        const rebuild: boolean = documentsTouched || diff.parse || diff.geometry;

        if(rebuild) {
            this.metaCache = null;
        }

        if(this.scene === null) return this;

        this.scene.apply(this.config, rebuild ? this.buildModels() : null, diff);

        if(this.config.autoFit && (diff.documents || diff.orientation || previous.sameScale !== this.config.sameScale)) {
            this.scene.fit();
        }

        return this;
    }

    public getConfig(): DOMReliefConfig {
        return mergeConfig(this.config, {});
    }

    public dispose() {
        this.detach();
        this.models.clear();
    }

    public get meta(): DOMReliefMeta {
        if(this.metaCache === null) {
            this.buildModels();
        }

        return this.metaCache as DOMReliefMeta;
    }

    public get canvas(): HTMLCanvasElement | null {
        return (this.scene !== null) ? this.scene.canvas : null;
    }
}