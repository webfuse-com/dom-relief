import { computeLayout } from "./layout.ts";
import { parseHtml, serializeSource } from "./parse.ts";
import type { DOMTree, DocumentSource, DOMReliefConfig, LayoutResult, ParseOptions } from "./types.ts";


export interface ReliefModel {
    readonly source: DocumentSource;
    readonly tree: DOMTree;
    readonly layout: LayoutResult | null;
}

interface CachedTree {
    readonly key: string;
    readonly tree: DOMTree;
}


function parseKey(options: ParseOptions): string {
    return [
        options.skipHead,
        options.skipScripts,
        options.textNodes,
        options.maxNodes,
        options.maxDepth
    ].join("|");
}


/*
 * Parses once per markup and parse options; lays out on demand.
 */
export class ModelCache {
    private readonly trees: Map<string, CachedTree> = new Map();

    build(config: Readonly<DOMReliefConfig>): ReliefModel[] {
        const key: string = parseKey(config);
        const sources: string[] = config.documents.map((source: DocumentSource): string => serializeSource(source));
        const wanted: Set<string> = new Set(sources);

        for(const html of Array.from(this.trees.keys())) {
            if(!wanted.has(html)) {
                this.trees.delete(html);
            }
        }

        return config.documents.map((source: DocumentSource, index: number): ReliefModel => {
            const tree: DOMTree = this.tree(sources[index], key, config);

            return {
                source: source,
                tree: tree,
                layout: tree.root !== null ? computeLayout(tree.root, config) : null
            };
        });
    }

    clear() {
        this.trees.clear();
    }

    private tree(html: string, key: string, options: ParseOptions): DOMTree {
        const cached: CachedTree | undefined = this.trees.get(html);

        if(cached !== undefined && cached.key === key) {
            return cached.tree;
        }

        const tree: DOMTree = parseHtml(html, options);

        this.trees.set(html, {
            key: key,
            tree: tree
        });

        return tree;
    }
}