import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

import { config, createDocument, installDom } from "./test.util.js";

import { attributeOf, horizontaltenTree, parseHtml, serializeSource } from "../src/parse.ts";


const PAGE = [
    "<!doctype html><html><head><title>T</title><style>p{}</style></head><body class=\"page\">",
    "<header id=\"top\"><a href=\"/\">Home</a></header>",
    "<main><p>Hello <b>big</b> world</p><script>run()</script><p> </p></main>",
    "</body></html>"
].join("");


function tags(root) {
    return horizontaltenTree(root).map((node) => node.tag);
}


describe("parseHtml", () => {
    before(() => {
        installDom();
    });

    test("starts at <body> and skips scripts by default", () => {
        const tree = parseHtml(PAGE, config());

        assert.ok(tree.root !== null);
        assert.deepEqual(tags(tree.root), ["body", "header", "a", "main", "p", "b", "p"]);
        assert.equal(tree.nodeCount, 7);
        assert.equal(tree.truncated, false);
    });

    test("includes <head> when skipHead is off", () => {
        const tree = parseHtml(PAGE, config({
            skipHead: false
        }));

        assert.ok(tree.root !== null);
        assert.equal(tree.root.tag, "html");
        assert.deepEqual(tree.root.children.map((node) => node.tag), ["head", "body"]);
        assert.ok(!tags(tree.root).includes("style"));
    });

    test("keeps script and style when skipScripts is off", () => {
        const tree = parseHtml(PAGE, config({
            skipHead: false,
            skipScripts: false
        }));

        assert.ok(tree.root !== null);
        assert.ok(tags(tree.root).includes("script"));
        assert.ok(tags(tree.root).includes("style"));
    });

    test("assigns depth and parent", () => {
        const tree = parseHtml(PAGE, config());
        const bold = horizontaltenTree(tree.root).find((node) => node.tag === "b");

        assert.ok(bold !== undefined);
        assert.equal(bold.depth, 3);
        assert.equal(bold.parent?.tag, "p");
        assert.equal(bold.parent?.parent?.tag, "main");
    });

    test("counts attribute characters as names plus values", () => {
        const tree = parseHtml("<body><div id=\"ab\" class=\"cde\"></div></body>", config());
        const div = (tree.root).children[0];

        assert.equal(div.attributes.length, 2);
        assert.equal(div.attributeChars, "id".length + "ab".length + "class".length + "cde".length);
        assert.equal(attributeOf(div, "class"), "cde");
        assert.equal(attributeOf(div, "missing"), "");
    });

    test("measures only direct, trimmed text and ignores whitespace-only runs", () => {
        const tree = parseHtml(PAGE, config());
        const paragraphs = horizontaltenTree(tree.root).filter((node) => node.tag === "p");

        assert.equal(paragraphs[0].textLength, "Hello".length + "world".length);
        assert.equal(paragraphs[1].textLength, 0);
    });

    test("turns text runs into leaves when textNodes is on", () => {
        const tree = parseHtml("<body><p>one <b>two</b> three</p></body>", config({
            textNodes: true
        }));
        const paragraph = (tree.root).children[0];

        assert.deepEqual(paragraph.children.map((node) => node.tag), ["#text", "b", "#text"]);
        assert.equal(paragraph.textLength, 0);
        assert.equal(paragraph.children[0].textLength, 3);
        assert.equal(paragraph.children[0].depth, 2);
    });

    test("stops at maxNodes and reports truncation", () => {
        const html = `<body><ul>${"<li>x</li>".repeat(50)}</ul></body>`;
        const tree = parseHtml(html, config({
            maxNodes: 10
        }));

        assert.equal(tree.nodeCount, 10);
        assert.equal(tree.truncated, true);
        assert.equal(horizontaltenTree(tree.root).length, 10);
    });

    test("stops below maxDepth and reports truncation", () => {
        const html = `<body>${"<div>".repeat(8)}${"</div>".repeat(8)}</body>`;
        const tree = parseHtml(html, config({
            maxDepth: 3
        }));
        const deepest = Math.max(...horizontaltenTree(tree.root).map((node) => node.depth));

        assert.equal(deepest, 3);
        assert.equal(tree.truncated, true);
    });
});

describe("horizontaltenTree", () => {
    before(() => {
        installDom();
    });

    test("returns nodes in document preorder", () => {
        const tree = parseHtml("<body><a><b></b><c></c></a><d></d></body>", config());

        assert.deepEqual(tags(tree.root), ["body", "a", "b", "c", "d"]);
    });
});

describe("serializeSource", () => {
    before(() => {
        installDom();
    });

    test("returns strings unchanged and serializes documents and elements", () => {
        const doc = createDocument("<!doctype html><html><head></head><body><p id=\"x\">a</p></body></html>");

        assert.equal(serializeSource("<p></p>"), "<p></p>");
        assert.equal(serializeSource(doc), doc.documentElement.outerHTML);
        assert.equal(serializeSource(doc.getElementById("x")), "<p id=\"x\">a</p>");
    });
});