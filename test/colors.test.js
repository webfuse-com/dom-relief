import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Color, SRGBColorSpace } from "three";

import { depthColor, depthGradient } from "../src/colors.ts";


function hslOf(color) {
    const target = {
        h: 0,
        s: 0,
        l: 0
    };

    return color.getHSL(target, SRGBColorSpace);
}


describe("depthColor", () => {
    test("runs from blue at depth 0 to red at depthMax", () => {
        const shallow = hslOf(depthColor(0, 10, new Color()));
        const deep = hslOf(depthColor(10, 10, new Color()));

        assert.ok(Math.abs(shallow.h - 0.62) < 0.01);
        assert.ok(deep.h < 0.01 || deep.h > 0.99);
    });

    test("uses a fixed scale, independent of how deep a document goes", () => {
        assert.equal(depthColor(4, 10, new Color()).getHex(), depthColor(4, 10, new Color()).getHex());
        assert.notEqual(depthColor(4, 10, new Color()).getHex(), depthColor(4, 20, new Color()).getHex());
    });

    test("keeps red beyond depthMax but gets darker", () => {
        const atMax = hslOf(depthColor(10, 10, new Color()));
        const beyond = hslOf(depthColor(13, 10, new Color()));

        assert.ok(beyond.h < 0.01 || beyond.h > 0.99);
        assert.ok(beyond.l < atMax.l);
    });

    test("builds a CSS gradient", () => {
        assert.match(depthGradient(), /^linear-gradient\(90deg, (#[0-9a-f]{6}(, )?){5}\)$/);
    });
});