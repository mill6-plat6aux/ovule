/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../utility/database.js";
import { ErrorResponse, ErrorCode } from "arbuscular";
import { hasProductPrivilege } from "./authorization.js";
import { getProductFootprints } from "./pathfinder/event-manager.js";

/**
 * @type {import("arbuscular").handle}
 */
export async function getProductDataSources(session, request) {
    let userId = session.userId;
    if(!(await hasProductPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId = request.productId;
    return await connection.select("ProductDataSource.DataSourceId as dataSourceId", "dataSourceName")
        .from("ProductDataSource")
        .leftJoin("OrganizationProduct", "OrganizationProduct.ProductId", "ProductDataSource.ProductId")
        .leftJoin("DataSource", "DataSource.DataSourceId", "ProductDataSource.DataSourceId")
        .where({"ProductDataSource.ProductId": productId})
        .andWhere(function() {
            this.where({"OrganizationProduct.OrganizationId": organizationId}).orWhereIn("OrganizationProduct.OrganizationId", function() {
                this.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId})
            });
        });
}

/**
 * @type {import("arbuscular").handle}
 */
export async function addProductDataSource(session, request) {
    let userId = session.userId;
    if(!(await hasProductPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId = request.productId;
    let dataSourceId = request.dataSourceId;
    let transaction = await connection.transaction();
    try {
        let products = await connection.select("productId").from("OrganizationProduct").where({ProductId: productId}).andWhere(function() {
            this.where({OrganizationId: organizationId}).orWhereIn("OrganizationId", function() {
                this.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId});
            })
        });
        if(products.length != 1) throw ErrorResponse(ErrorCode.RequestError, "Invalid access.");
        await transaction.insert({ProductId: productId, DataSourceId: dataSourceId}).into("ProductDataSource");
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }

    // For child elements (parts), query the data source and attempt to obtain the product footprint from the remote service.
    let products = await connection.select("parentProductId").from("Product").where({ProductId: productId});
    if(products.length != 1) throw ErrorResponse(ErrorCode.RequestError, "Invalid access.");
    let parentProductId = products[0].parentProductId;
    if(parentProductId != null) {
        await getProductFootprints(userId, organizationId, dataSourceId, productId);
    }
}

/**
 * @type {import("arbuscular").handle}
 */
export async function deleteProductDataSource(session, request) {
    let userId = session.userId;
    if(!(await hasProductPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId = request.productId;
    let dataSourceId = request.dataSourceId;
    let transaction = await connection.transaction();
    try {
        let products = await connection.select("productId").from("OrganizationProduct").where({ProductId: productId}).andWhere(function() {
            this.where({OrganizationId: organizationId}).orWhereIn("OrganizationId", function() {
                this.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId});
            });
        });
        if(products.length != 1) throw ErrorResponse(ErrorCode.RequestError, "Invalid access.");
        await transaction("ProductDataSource").delete().where({DataSourceId: dataSourceId, ProductId: productId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}