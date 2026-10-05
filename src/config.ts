import type { DOMReliefConfig } from "./types.ts";


type ConfigKey = keyof DOMReliefConfig;

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


const PARSE_KEYS: readonly ConfigKey[] = [
    "skipHead",
    "skipScripts",
    "textNodes",
    "maxNodes",
    "maxDepth"
];

const GEOMETRY_KEYS: readonly ConfigKey[] = [
    "layerThickness",
    "attributeWeight",
    "textWeight",
    "gap",
    "layout"
];

const COLOR_KEYS: readonly ConfigKey[] = [
    "depthMax"
];

const PLACEMENT_KEYS: readonly ConfigKey[] = [
    "orientation",
    "sameScale"
];

const THEME_KEYS: readonly ConfigKey[] = [
    "background",
    "showGrid",
    "gridColor"
];

const MOTION_KEYS: readonly ConfigKey[] = [
    "interactive",
    "autoRotate",
    "autoFit"
];

const NUMBER_KEYS: readonly ConfigKey[] = [
    "maxNodes",
    "maxDepth",
    "layerThickness",
    "attributeWeight",
    "textWeight",
    "gap",
    "depthMax"
];

const CHOICES: Partial<Record<ConfigKey, readonly string[]>> = {
    layout: [
        "ordered",
        "squarified"
    ],
    orientation: [
        "horizontal",
        "vertical"
    ]
};


export const DEFAULT_CONFIG: Readonly<DOMReliefConfig> = {
    autoFit: true,
    autoRotate: false,
    attributeWeight: 1,
    background: "#F8FAFC",
    depthMax: 15,
    documents: [],
    gap: 0.25,
    gridColor: "#DADDE0",
    interactive: true,
    layerThickness: 2.0,
    layout: "ordered",
    maxDepth: 300,
    maxNodes: 40000,
    orientation: "horizontal",
    sameScale: true,
    showGrid: true,
    skipHead: true,
    skipScripts: true,
    textNodes: false,
    textWeight: 1
};


function sameDocuments(previous: DOMReliefConfig["documents"], next: DOMReliefConfig["documents"]): boolean {
    return previous.length === next.length && previous.every((source: DOMReliefConfig["documents"][number], index: number): boolean => source === next[index]);
}


export function validateChanges(changes: Partial<DOMReliefConfig>) {
    for(const key of Object.keys(changes)) {
        if(!(key in DEFAULT_CONFIG)) {
            throw new TypeError(`Unknown DOMRelief option "${key}"`);
        }

        const configKey: ConfigKey = key as ConfigKey;
        const value: unknown = changes[configKey];
        const expected: unknown = DEFAULT_CONFIG[configKey];
        const choices: readonly string[] | undefined = CHOICES[configKey];

        if(configKey === "documents") {
            if(!Array.isArray(value)) {
                throw new TypeError("DOMRelief option \"documents\" must be an array");
            }

            continue;
        }

        if(NUMBER_KEYS.includes(configKey)) {
            if(typeof value !== "number" || !Number.isFinite(value) || value < 0) {
                throw new TypeError(`DOMRelief option "${key}" must be a finite number of at least 0`);
            }

            continue;
        }

        if(choices !== undefined && !choices.includes(value as string)) {
            throw new TypeError(`DOMRelief option "${key}" must be one of ${choices.map((choice: string): string => `"${choice}"`).join(", ")}`);
        }

        if(typeof value !== typeof expected) {
            throw new TypeError(`DOMRelief option "${key}" must be a ${typeof expected}`);
        }
    }
}

export function mergeConfig(base: Readonly<DOMReliefConfig>, changes: Partial<DOMReliefConfig>): DOMReliefConfig {
    const merged: DOMReliefConfig = {
        ...base,
        ...changes
    };

    merged.documents = [ ...merged.documents ];

    return merged;
}

export function diffConfig(previous: Readonly<DOMReliefConfig>, next: Readonly<DOMReliefConfig>): ConfigChanges {
    const changed: (keys: readonly ConfigKey[]) => boolean = (keys: readonly ConfigKey[]): boolean => keys.some((key: ConfigKey): boolean => previous[key] !== next[key]);

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