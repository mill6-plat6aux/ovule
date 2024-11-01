/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { v4 as uuid } from "uuid";
import { ErrorCode, ErrorResponse, writeLog } from "arbuscular";
import { restoreDataSource } from "../datasource-manager.js";
import { formatToIso8601String } from "../../utility/date-utils.js";
import {  convertOrganizationIdentifiers, convertProductIdentifiers, restoreProductFootprint, convertProductFootprint } from "../pathfinder/product-footprint-manager.js";
import { getOrganization } from "../organization-manager.js";
import { getProduct } from "../product-manager.js";
import { contextPath, getAccessToken } from "../pathfinder/event-manager.js";
import { requestToRemote } from "./contract-manager.js";
import { connection } from "../../utility/database.js";
import { hasProductFootprintPrivilege } from "../authorization.js";

export const ExtensionDataSchema = "https://mill6-plat6aux.github.io/traceability-extension/schema.json";

/**
 * @type {import("arbuscular").handle}
 */
export async function getProductFootprints(session, request) {
    let userId = session.userId;
    if(!(await hasProductFootprintPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId;
    let parentProductFootprintId;
    if(request != null) {
        productId = request.productId;
        parentProductFootprintId = request.parentProductFootprintId;
    }
    let query = connection.select(
        "productFootprintId",
        "dataId",
        "version",
        "updatedDate",
        "status",
        "organizationId",
        "productId",
        "amountUnit",
        "carbonFootprint"
    ).from("ProductFootprint")
    .where(function() {
        this.where({OrganizationId: organizationId})
        .orWhereIn("OrganizationId", function() {
            this.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId})
        })
    })
    .orderBy("updatedDate", "desc");
    if(productId != null) {
        query.andWhere({ProductId: productId});
    }
    if(parentProductFootprintId != null) {
        query.whereIn("ProductFootprintId", function() {
            this.select("ChildProductFootprintId").from("ProductFootprintReference").where({ParentProductFootprintId: parentProductFootprintId});
        });
    }
    return await query;
}

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {string} dataId 
 * @param {number} productId 
 */
export async function syncProductFootprintToHarmony(userId, organizationId, dataId, productId) {
    let harmonyDataSource = await restoreDataSource(organizationId, undefined, undefined, undefined, "Harmony");
    if(harmonyDataSource == null) return;
    let authenticateEndpoint = harmonyDataSource.endpoints.find(endpoint => endpoint.type == "Authenticate");
    let updateEventEndpoint = harmonyDataSource.endpoints.find(endpoint => endpoint.type == "UpdateEvent");
    if(authenticateEndpoint == null || updateEventEndpoint == null) return;

    let organization = await getOrganization({userId, organizationId}, undefined);
    let product = await getProduct({userId, organizationId}, {productId: productId});

    let accessToken = await getAccessToken(authenticateEndpoint.url, harmonyDataSource.userName, harmonyDataSource.password);

    await requestToRemote("post", updateEventEndpoint.url, accessToken, "application/cloudevents+json; charset=UTF-8", {
        type: "org.wbcsd.pathfinder.ProductFootprint.Updated.v1",
        specversion: "1.0",
        id: uuid(),
        source: contextPath.substring(contextPath.indexOf(":")+1) + "/harmony" + "/2/events",
        time: formatToIso8601String(new Date(), true),
        data: {
            id: dataId,
            companyName: organization.organizationName,
            companyIds: convertOrganizationIdentifiers(organization.identifiers),
            productIds: convertProductIdentifiers(product.identifiers),
            productNameCompany: product.productName
        }
    });
    writeLog("User for access from Harmony has been sent to Harmony.");
}

/**
 * @param {import("../../../types/productFootprint.d.ts").ProductFootprint} productFootprint 
 * @param {object} result
 */
export function convertChildProductFootprint(productFootprint, result) {
    if(productFootprint.breakdown == null) return;

    function convertBreakdown(productFootprint) {
        if(productFootprint.breakdown == null) return null;
        return productFootprint.breakdown.map(childProductFootprint => {
            let breakdown = convertBreakdown(childProductFootprint);
            if(breakdown != null) {
                childProductFootprint.breakdown = breakdown;
            }
            return {
                id: childProductFootprint.dataId
            };
        });
    }

    let breakdown = convertBreakdown(productFootprint);
    if(breakdown == null) return;

    if(result.extensions == null) {
        result.extensions = [];
    }
    result.extensions.push({
        "specVersion": "2.0.0",
        "dataSchema": ExtensionDataSchema,
        data: {
            breakdownPfs: breakdown
        }
    });
}

/**
 * @param {import("../../../types/productFootprint.d.ts").ProductFootprint} productFootprint 
 * @returns {Promise}
 */
export async function fillChildProductFootprints(productFootprint) {
    if(productFootprint.productId == null) return;
    let childProducts = await connection.select("productId").from("Product").where({ParentProductId: productFootprint.productId});
    if(childProducts.length > 0) {
        let breakdown = await Promise.all(childProducts.map(async childProduct => {
            let productFootprints = await connection.select("productFootprintId", "dataId").from("ProductFootprint").where({ProductId: childProduct.productId, Status: "Active"});
            if(productFootprints.length == 0) return null;
            let productFootprintId = productFootprints[0].productFootprintId;
            let dataId = productFootprints[0].dataId;
            if(dataId == null) return;
            return {
                productFootprintId: productFootprintId,
                dataId: dataId
            };
        }));
        let _breakdown = breakdown.filter(entry => entry != null);
        if(_breakdown.length > 0) {
            productFootprint.breakdown = _breakdown;
        }
    }
}

/**
 * @type {import("arbuscular").handle}
 */
export async function updateProductFootprintReference(session, request) {
    let userId = session.userId;
    if(!(await hasProductFootprintPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productFootprintId = request.productFootprintId;
    let parentProductFootprintId = request.parentProductFootprintId;
    let transaction = await connection.transaction();
    try {
        let references = await transaction.select("order").from("ProductFootprintReference").where({ParentProductFootprintId: parentProductFootprintId}).orderBy("Order", "desc");
        let order = 1;
        if(references.length > 0) {
            order = references[0].order + 1;
        }
        await transaction.delete().from("ProductFootprintReference").where({ParentProductFootprintId: parentProductFootprintId, ChildProductFootprintId: productFootprintId});
        await transaction.insert({ParentProductFootprintId: parentProductFootprintId, ChildProductFootprintId: productFootprintId, Order: order}).into("ProductFootprintReference");
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}