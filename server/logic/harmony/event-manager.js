/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../../utility/database.js";
import { storeOrganization } from "../organization-manager.js";
import { convertCompanyIds, convertProductIds, storeProductFootprint } from "../pathfinder/event-manager.js";
import { addProduct } from "../product-manager.js";
import { ExtensionDataSchema } from "./product-footprint-manager.js";

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {object} productFootprint 
 */
export async function storeChildProductFootprint(userId, organizationId, productFootprint) {
    if(productFootprint.extensions == null || !Array.isArray(productFootprint.extensions) || productFootprint.extensions.length == 0) return;
    let extension = productFootprint.extensions.find(extension => extension.dataSchema == ExtensionDataSchema);
    if(extension == null) return;
    if(extension.data.breakdownPfs == null || !Array.isArray(extension.data.breakdownPfs) || extension.data.breakdownPfs.length == 0) return;
    await Promise.all(extension.data.breakdownPfs.map(async (pf, index) => {
        let childOrganizationId;
        if(pf.companyName != null && pf.companyIds != null && Array.isArray(pf.companyIds) && pf.companyIds.length > 0) {
            let result = await storeOrganization(userId, organizationId, pf.companyName, "BusinessPartner", convertCompanyIds(pf.companyIds));
            childOrganizationId = result.organizationId;
        }
        let productId;
        if(pf.productNameCompany != null && pf.productIds != null && Array.isArray(pf.productIds) && pf.productIds.length > 0) {
            let result = await addProduct({userId: userId, organizationId: organizationId}, {
                productName: pf.productNameCompany,
                description: pf.productDescription,
                cpcCode: pf.productCategoryCpc,
                identifiers: convertProductIds(pf.productIds),
                parentProductId: organizationId,
                organizationId: childOrganizationId
            });
            productId = result.productId;
        }
        await storeProductFootprint(userId, organizationId, pf);
        await storeProductFootprintReference(productFootprint.productFootprintId, pf.productFootprintId, index+1);
    }));
}

/**
 * @param {number} parentProductFootprintId 
 * @param {number} childProductFootprintId 
 * @param {number} order 
 */
async function storeProductFootprintReference(parentProductFootprintId, childProductFootprintId, order) {
    let transaction = await connection.transaction();
    try {
        await transaction.delete().from("ProductFootprintReference").where({ParentProductFootprintId: parentProductFootprintId, ChildProductFootprintId: childProductFootprintId});
        await transaction.insert({ParentProductFootprintId: parentProductFootprintId, ChildProductFootprintId: childProductFootprintId, Order: order}).into("ProductFootprintReference");
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}