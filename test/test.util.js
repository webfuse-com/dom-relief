import { JSDOM } from "jsdom";

import { DEFAULT_CONFIG, mergeConfig } from "../src/config.ts";


let domWindow = null;


/*
 * `text` is the direct text length.
 */
export function buildTree(spec, depth = 0, parent = null) {
    const attributes = spec.attributes ?? [];
    const node = {
        tag: spec.tag,
        depth: depth,
        parent: parent,
        children: [],
        attributes: attributes,
        attributeChars: attributes.reduce((sum, pair) => sum + pair[0].length + pair[1].length, 0),
        textLength: spec.text ?? 0
    };

    for(const child of spec.children ?? []) {
        node.children.push(buildTree(child, depth + 1, node));
    }

    return node;
}

export function treeOf(root, nodeCount, truncated = false) {
    return {
        root: root,
        nodeCount: nodeCount,
        truncated: truncated
    };
}

export function config(changes = {}) {
    return mergeConfig(DEFAULT_CONFIG, changes);
}

export function samplePage() {
    return buildTree({
        tag: "body",
        children: [
            {
                tag: "header",
                attributes: [["class", "top"]],
                children: [
                    {
                        tag: "a",
                        attributes: [["href", "/"]],
                        text: 4
                    }
                ]
            },
            {
                tag: "main",
                children: [
                    {
                        tag: "p",
                        text: 120
                    },
                    {
                        tag: "p",
                        text: 30
                    },
                    {
                        tag: "p",
                        text: 5
                    }
                ]
            },
            {
                tag: "footer",
                text: 12
            }
        ]
    });
}

/*
 * Exposes jsdom's DOM classes as globals, like a browser.
 */
export function installDom() {
    if(domWindow !== null) {
        return domWindow;
    }

    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    const globals = globalThis;

    domWindow = dom.window;
    globals.DOMParser = domWindow.DOMParser;
    globals.Node = domWindow.Node;
    globals.Document = domWindow.Document;
    globals.Element = domWindow.Element;

    return domWindow;
}

export function createDocument(html) {
    const parser = new (installDom().DOMParser)();

    return parser.parseFromString(html, "text/html");
}