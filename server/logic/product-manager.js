/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../utility/database.js";
import { ErrorResponse, ErrorCode } from "arbuscular";
import { hasProductPrivilege } from "./authorization.js";

/**
 * @type {import("arbuscular").handle}
 */
export async function getProducts(session, request) {
    let userId = session.userId;
    if(!(await hasProductPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let parentProductId;
    if(request != null) {
        parentProductId = request.parentProductId;
    }
    let query = connection.select(
        "Product.ProductId as productId", 
        "productName", 
        "amount",
        "amountUnit",
        "description", 
        "cpcCode", 
        "parentProductId",
        "organizationId"
    ).from("OrganizationProduct")
    .leftJoin("Product", "Product.ProductId", "OrganizationProduct.ProductId");
    if(parentProductId == null) {
        query.where({OrganizationId: organizationId, ParentProductId: null});
    }else {
        query.where(function() {
            this.where({OrganizationId: organizationId})
            .orWhereIn("OrganizationId", function() {
                this.select("OrganizationId").from("Organization").where({ParentOrganizationId: organizationId})
            })
        })
        .andWhere({ParentProductId: parentProductId});
    }
    let products = await query;
    await Promise.all(products.map(async product => {
        product.identifiers = await connection.select("code", "type").from("ProductIdentifier").where({ProductId: product.productId});
    }));
    return products;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function getProduct(session, request) {
    let userId = session.userId;
    if(!(await hasProductPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId = request.productId;
    let products = await connection.select(
        "Product.ProductId as productId", 
        "productName", 
        "amount",
        "amountUnit",
        "description", 
        "cpcCode", 
        "parentProductId",
        "organizationId"
    ).from("OrganizationProduct")
    .leftJoin("Product", "Product.ProductId", "OrganizationProduct.ProductId")
    .where({"Product.ProductId": productId})
    .andWhere(function() {
        this.where({OrganizationId: organizationId})
        .orWhereIn("OrganizationId", function() {
            this.select("OrganizationId").from("Organization").where({ParentOrganizationId: organizationId})
        })
    });
    if(products.length != 1) {
        throw ErrorResponse(ErrorCode.NotFoundError, "Not found.");
    }
    let product = products[0];
    product.identifiers = await connection.select("code", "type").from("ProductIdentifier").where({ProductId: product.productId});
    return product;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function addProduct(session, request) {
    let userId = session.userId;
    if(!(await hasProductPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productName = request.productName;
    let amount = request.amount;
    let amountUnit = request.amountUnit;
    let description = request.description;
    let cpcCode = request.cpcCode;
    let identifiers = request.identifiers;
    let parentProductId = request.parentProductId;
    let ownerOrganizationId = request.organizationId;
    if(ownerOrganizationId == null) {
        ownerOrganizationId = organizationId;
    }
    let transaction = await connection.transaction();
    let productId;
    try {
        // If an organization is specified, check whether it is under your own organization
        if(organizationId != ownerOrganizationId) {
            let records = await transaction.select("organizationId").from("Organization").where({OrganizationId: ownerOrganizationId, ParentOrganizationId: organizationId});
            if(records.length == 0) {
                throw ErrorResponse(ErrorCode.RequestError, "Invalid request.")
            }
        }
        let ids = await transaction.insert({
            ProductName: productName, 
            Description: description, 
            Amount: amount,
            AmountUnit: amountUnit,
            CpcCode: cpcCode,
            ParentProductId: parentProductId
        }).into("Product");
        if(ids.length != 1) throw ErrorResponse(ErrorCode.StateError, "Inserting failed.");
        productId = ids[0];
        await transaction.insert({OrganizationId: ownerOrganizationId, ProductId: productId}).into("OrganizationProduct");
        if(identifiers.length > 0) {
            await Promise.all(identifiers.map(async identifier => {
                await transaction.insert({ProductId: productId, Code: identifier.code, Type: identifier.type}).into("ProductIdentifier");
            }));
        }
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
    return {productId: productId};
}

/**
 * @type {import("arbuscular").handle}
 */
export async function updateProduct(session, request) {
    let userId = session.userId;
    if(!(await hasProductPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId = request.productId;
    let productName = request.productName;
    let amount = request.amount;
    let amountUnit = request.amountUnit;
    let description = request.description;
    let cpcCode = request.cpcCode;
    let identifiers = request.identifiers;
    let ownerOrganizationId = request.organizationId;
    if(ownerOrganizationId == null) {
        ownerOrganizationId = organizationId;
    }
    let transaction = await connection.transaction();
    try {
        // If an organization is specified, check whether it is under your own organization
        if(organizationId != ownerOrganizationId) {
            let records = await transaction.select("organizationId").from("Organization").where({OrganizationId: ownerOrganizationId, ParentOrganizationId: organizationId});
            if(records.length == 0) {
                throw ErrorResponse(ErrorCode.RequestError, "Invalid request.")
            }
        }
        let products = await transaction.select("organizationId").from("OrganizationProduct").where({ProductId: productId});
        if(products.length != 1) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Product is not found.");
        }
        let product = products[0];
        // Change owner organization
        if(product.organizationId != ownerOrganizationId) {
            await transaction("OrganizationProduct").delete().where({ProductId: productId, OrganizationId: product.organizationId});
            await transaction.insert({OrganizationId: ownerOrganizationId, ProductId: productId}).into("OrganizationProduct");
        }
        await transaction("Product").update({
            ProductName: productName, 
            Amount: amount,
            AmountUnit: amountUnit,
            Description: description, 
            cpcCode: cpcCode
        }).where({ProductId: productId});
        await transaction("ProductIdentifier").delete().where({ProductId: productId});
        if(identifiers.length > 0) {
            await Promise.all(identifiers.map(async identifier => {
                await transaction.insert({ProductId: productId, Code: identifier.code, Type: identifier.type}).into("ProductIdentifier");
            }));
        }
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * @type {import("arbuscular").handle}
 */
export async function deleteProduct(session, request) {
    let userId = session.userId;
    if(!(await hasProductPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId = request.productId;
    let transaction = await connection.transaction();
    try {
        let products = await transaction.select("productId").from("OrganizationProduct").where({OrganizationId: organizationId, ProductId: productId});
        if(products.length != 1) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Product is not found.");
        }
        await transaction("Product").delete().where({ProductId: productId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}