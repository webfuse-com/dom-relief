import type { DOMReliefConfig } from "./types.ts";
export interface ConfigChanges {
    readonly documents: boolean;
    readonly parse: boolean;
    readonly geometry: boolean;
    readonly color: boolean;
    readonly placement: boolean;
    readonly theme: boolean;
    readonly motion: boolean;
    readonly orientation: boolean;
}
export declare const DEFAULT_CONFIG: Readonly<DOMReliefConfig>;
export declare function validateChanges(changes: Partial<DOMReliefConfig>): void;
export declare function mergeConfig(base: Readonly<DOMReliefConfig>, changes: Partial<DOMReliefConfig>): DOMReliefConfig;
export declare function diffConfig(previous: Readonly<DOMReliefConfig>, next: Readonly<DOMReliefConfig>): ConfigChanges;
