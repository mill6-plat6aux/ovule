/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../utility/database.js";
import { ErrorResponse, ErrorCode } from "arbuscular";
import { hasProductActivityPrivilege } from "./authorization.js";
import { verifyOwnership } from "./emission-factor-manager.js";

/**
 * @type {import("arbuscular").handle}
 */
export async function getProductionActivities(session, request) {
    let userId = session.userId;
    if(!(await hasProductActivityPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId = request.productId;
    let emissionFactors = await connection.select(
        "ProductionActivity.ProductId as productId", 
        "emissionFactorId", 
        "amount"
    ).from("ProductionActivity").leftJoin("OrganizationProduct", "ProductionActivity.ProductId", "OrganizationProduct.ProductId").where({OrganizationId: organizationId, "ProductionActivity.ProductId": productId});
    return emissionFactors;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function updateProductionActivity(session, request) {
    let userId = session.userId;
    if(!(await hasProductActivityPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId = request.productId;
    let emissionFactorId = request.emissionFactorId;
    let amount = request.amount;
    let transaction = await connection.transaction();
    try {
        let products = await transaction.select("productId").from("OrganizationProduct").where({OrganizationId: organizationId, ProductId: productId});
        if(products.length != 1) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Product is not found.");
        }
        let owner = await verifyOwnership(transaction, organizationId, emissionFactorId);
        if(!owner) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Emission factor is not found.");
        }
        await transaction("ProductionActivity").delete().where({ProductId: productId, EmissionFactorId: emissionFactorId});
        await transaction.insert({ProductId: productId, EmissionFactorId: emissionFactorId, Amount: amount}).into("ProductionActivity");
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * @type {import("arbuscular").handle}
 */
export async function deleteProductionActivity(session, request) {
    let userId = session.userId;
    if(!(await hasProductActivityPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId = request.productId;
    let emissionFactorId = request.emissionFactorId;
    let transaction = await connection.transaction();
    try {
        let products = await transaction.select("productId").from("OrganizationProduct").where({OrganizationId: organizationId, ProductId: productId});
        if(products.length != 1) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Product is not found.");
        }
        let owner = await verifyOwnership(transaction, organizationId, emissionFactorId);
        if(!owner) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Emission factor is not found.");
        }
        await transaction("ProductionActivity").delete().where({ProductId: productId, EmissionFactorId: emissionFactorId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}