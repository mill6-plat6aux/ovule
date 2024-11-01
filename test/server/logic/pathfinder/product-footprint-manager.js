/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import test from "ava";
import target from "../../../../server/logic/pathfinder/product-footprint-manager.js";

test("Parse OData Filter", t => {
    t.deepEqual(
        target.parseFilter(`productCategoryCpc eq '3342'`), 
        [{operand1: "productCategoryCpc", operator: "=", operand2: "3342"}]
    );
    t.deepEqual(
        target.parseFilter(`pcf/geographyCountry eq 'DE'`), 
        [{operand1: "pcf.geographyCountry", operator: "=", operand2: "DE"}]
    );
    t.deepEqual(
        target.parseFilter(`(pcf/referencePeriodStart ge '2023-01-01T00:00:00.000Z') and (pcf/referencePeriodEnd lt '2024-01-01T00:00:00.000Z')`), 
        [
            {operand1: "pcf.referencePeriodStart", operator: ">=", operand2: "2023-01-01T00:00:00.000Z"}, 
            {operator: "and", operation: {operand1: "pcf.referencePeriodEnd", operator: "<", operand2: "2024-01-01T00:00:00.000Z"}}
        ]
    );
    t.deepEqual(
        target.parseFilter(`productIds/any(productId:(productId eq 'urn:uuid:750db35f-c260-4f9c-8fa6-b2a573e9f923'))`), 
        [{operand1: "productIds", operator: "=", collector: "any", operand2: "urn:uuid:750db35f-c260-4f9c-8fa6-b2a573e9f923"}]);
});