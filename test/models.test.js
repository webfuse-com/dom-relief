import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

import { config, createDocument, installDom } from "./test.util.js";

import { ModelCache } from "../src/models.ts";


describe("ModelCache", () => {
    before(() => {
        installDom();
    });

    test("builds one model per document, in order", () => {
        const cache = new ModelCache();
        const models = cache.build(config({
            documents: ["<body><p>a</p></body>", "<body><div><span>b</span></div></body>"]
        }));

        assert.equal(models.length, 2);
        assert.equal(models[0].tree.nodeCount, 2);
        assert.equal(models[1].tree.nodeCount, 3);
        assert.ok(models[0].layout !== null);
        assert.equal(models[1].layout?.blocks.length, 3);
    });

    test("reuses parsed trees when only geometry changes", () => {
        const cache = new ModelCache();
        const documents = ["<body><p>a</p></body>"];
        const first = cache.build(config({
            documents: documents
        }));
        const second = cache.build(config({
            documents: documents,
            gap: 1
        }));

        assert.equal(second[0].tree, first[0].tree);
        assert.notEqual(second[0].layout, first[0].layout);
    });

    test("re-parses when parse options change", () => {
        const cache = new ModelCache();
        const documents = ["<body><p>one <b>two</b></p></body>"];
        const plain = cache.build(config({
            documents: documents
        }));
        const withText = cache.build(config({
            documents: documents,
            textNodes: true
        }));

        assert.notEqual(withText[0].tree, plain[0].tree);
        assert.equal(withText[0].tree.nodeCount, plain[0].tree.nodeCount + 2);
    });

    test("re-reads a live Document and re-parses only when its markup changed", () => {
        const cache = new ModelCache();
        const doc = createDocument("<!doctype html><html><head></head><body><p>a</p></body></html>");
        const first = cache.build(config({
            documents: [doc]
        }));
        const unchanged = cache.build(config({
            documents: [doc]
        }));

        doc.body.appendChild(doc.createElement("section"));

        const changed = cache.build(config({
            documents: [doc]
        }));

        assert.equal(unchanged[0].tree, first[0].tree);
        assert.notEqual(changed[0].tree, first[0].tree);
        assert.equal(changed[0].tree.nodeCount, first[0].tree.nodeCount + 1);
    });

    test("accepts an Element as a document", () => {
        const doc = createDocument("<!doctype html><html><head></head><body><main id=\"m\"><p>x</p></main></body></html>");
        const models = new ModelCache().build(config({
            documents: [doc.getElementById("m")]
        }));

        assert.equal(models[0].tree.root?.tag, "body");
        assert.equal(models[0].tree.nodeCount, 3);
    });

    test("gives an empty document a tree without a layout", () => {
        const models = new ModelCache().build(config({
            documents: [""],
            skipHead: true
        }));

        assert.equal(models[0].tree.root?.tag, "body");
        assert.equal(models[0].tree.nodeCount, 1);
    });
});