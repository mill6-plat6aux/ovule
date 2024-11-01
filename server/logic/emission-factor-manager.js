/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../utility/database.js";
import { ErrorResponse, ErrorCode } from "arbuscular";
import { hasEmissionFactorPrivilege } from "./authorization.js";

/**
 * @type {import("arbuscular").handle}
 */
export async function getEmissionFactors(session, request) {
    let userId = session.userId;
    if(!(await hasEmissionFactorPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let emissionFactorCategoryId = null;
    let emissionFactorName = null;
    if(request != null) {
        emissionFactorCategoryId = request.emissionFactorCategoryId != null ? request.emissionFactorCategoryId : null;
        emissionFactorName = request.emissionFactorName != null ? request.emissionFactorName : null;
    }
    let organizationId = session.organizationId;
    if(emissionFactorName != null) {
        let emissionFactors = await connection.select(
            "emissionFactorId", 
            "emissionFactorName", 
            "value", 
            "numeratorUnit", 
            "denominatorUnit",
            "emissionFactorCategoryId"
        ).from("EmissionFactor")
            .where("emissionFactorName", "like", "%"+emissionFactorName+"%");
        emissionFactors = await Promise.all(emissionFactors.map(async emissionFactor => {
            emissionFactor.valid = await _verifyOwnership(connection, organizationId, emissionFactor.emissionFactorCategoryId);
            return emissionFactor;
        }));
        return emissionFactors.filter(emissionFactor => {
            let valid = emissionFactor.valid;
            delete emissionFactor.valid;
            return valid;
        });
    }else {
        return await connection.select(
            "emissionFactorId", 
            "emissionFactorName", 
            "value", 
            "numeratorUnit", 
            "denominatorUnit",
            "EmissionFactor.EmissionFactorCategoryId as emissionFactorCategoryId"
        ).from("EmissionFactor").leftJoin("OrganizationEmissionFactorCategory", "OrganizationEmissionFactorCategory.EmissionFactorCategoryId", "EmissionFactor.EmissionFactorCategoryId").where({OrganizationId: organizationId, "EmissionFactor.EmissionFactorCategoryId": emissionFactorCategoryId});
    }
}

/**
 * @type {import("arbuscular").handle}
 */
export async function getEmissionFactor(session, request) {
    let userId = session.userId;
    if(!(await hasEmissionFactorPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let emissionFactorId = request.emissionFactorId;
    let emissionFactors = await connection.select(
        "emissionFactorId", 
        "emissionFactorName", 
        "value", 
        "numeratorUnit", 
        "denominatorUnit",
        "emissionFactorCategoryId"
    ).from("EmissionFactor").where({EmissionFactorId: emissionFactorId});
    if(emissionFactorId.length == 0) {
        throw ErrorResponse(ErrorCode.NotFoundError, "Emission factor is not found.");
    }
    let emissionFactor = emissionFactors[0];
    if(!(await _verifyOwnership(connection, organizationId, emissionFactor.emissionFactorCategoryId))) {
        throw ErrorResponse(ErrorCode.NotFoundError, "Emission factor is not found.");
    }
    emissionFactor.emissionFactorCategory = await getParentEmissionFactorCategory(emissionFactor.emissionFactorCategoryId);
    return emissionFactor;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function addEmissionFactor(session, request) {
    let userId = session.userId;
    if(!(await hasEmissionFactorPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let emissionFactorName = request.emissionFactorName;
    let value = request.value;
    let numeratorUnit = request.numeratorUnit;
    let denominatorUnit = request.denominatorUnit;
    let emissionFactorCategoryId = request.emissionFactorCategoryId;
    let transaction = await connection.transaction();
    let emissionFactorId;
    try {
        if(!(await _verifyOwnership(transaction, organizationId, emissionFactorCategoryId))) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Emission factor is not found.");
        }
        let ids = await transaction.insert({
            EmissionFactorName: emissionFactorName, 
            Value: value, 
            NumeratorUnit: numeratorUnit, 
            DenominatorUnit: denominatorUnit, 
            EmissionFactorCategoryId: emissionFactorCategoryId
        }).into("EmissionFactor");
        if(ids.length != 1) {
            throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
        }
        emissionFactorId = ids[0];
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
    return {emissionFactorId: emissionFactorId};
}

/**
 * @type {import("arbuscular").handle}
 */
export async function updateEmissionFactor(session, request) {
    let userId = session.userId;
    if(!(await hasEmissionFactorPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let emissionFactorId = request.emissionFactorId;
    let emissionFactorName = request.emissionFactorName;
    let value = request.value;
    let numeratorUnit = request.numeratorUnit;
    let denominatorUnit = request.denominatorUnit;
    let emissionFactorCategoryId = request.emissionFactorCategoryId;
    let transaction = await connection.transaction();
    try {
        let emissionFactors = await transaction.select("emissionFactorCategoryId").from("EmissionFactor").where({EmissionFactorId: emissionFactorId});
        if(emissionFactors.length == 0) {
            throw ErrorResponse(ErrorCode.StateError, "Invalid request.");
        }
        let _emissionFactorCategoryId = emissionFactors[0].emissionFactorCategoryId;
        if(!(await _verifyOwnership(transaction, organizationId, _emissionFactorCategoryId))) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Emission factor is not found.");
        }
        if(emissionFactorCategoryId != _emissionFactorCategoryId) {
            if(!(await _verifyOwnership(transaction, organizationId, emissionFactorCategoryId))) {
                throw ErrorResponse(ErrorCode.NotFoundError, "Emission factor is not found.");
            }
        }
        await transaction("EmissionFactor").update({
            EmissionFactorName: emissionFactorName, 
            Value: value, 
            NumeratorUnit: numeratorUnit, 
            DenominatorUnit: denominatorUnit, 
            EmissionFactorCategoryId: emissionFactorCategoryId
        }).where({EmissionFactorId: emissionFactorId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * @type {import("arbuscular").handle}
 */
export async function deleteEmissionFactor(session, request) {
    let userId = session.userId;
    if(!(await hasEmissionFactorPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let emissionFactorId = request.emissionFactorId;
    let transaction = await connection.transaction();
    try {
        if(!(await verifyOwnership(transaction, organizationId, emissionFactorId))) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Emission factor is not found.");
        }
        await transaction("EmissionFactor").delete().where({EmissionFactorId: emissionFactorId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * @type {import("arbuscular").handle}
 */
export async function getEmissionFactorCategories(session, request) {
    let userId = session.userId;
    if(!(await hasEmissionFactorPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let emissionFactorCategoryId = null;
    if(request != null) {
        emissionFactorCategoryId = request.emissionFactorCategoryId;
    }
    let organizationId = session.organizationId;
    return await connection.select(
        "EmissionFactorCategory.EmissionFactorCategoryId as emissionFactorCategoryId", 
        "emissionFactorCategoryName", 
        "version",
        "parentEmissionFactorCategoryId"
    ).from("EmissionFactorCategory").leftJoin("OrganizationEmissionFactorCategory", "OrganizationEmissionFactorCategory.EmissionFactorCategoryId", "EmissionFactorCategory.EmissionFactorCategoryId").where({OrganizationId: organizationId, ParentEmissionFactorCategoryId: emissionFactorCategoryId});
}

/**
 * @param {number} emissionFactorCategoryId 
 * @returns {Promise<object>}
 */
export async function getParentEmissionFactorCategory(emissionFactorCategoryId) {
    let emissionFactorCategories = await connection.select("emissionFactorCategoryId", "emissionFactorCategoryName", "version", "parentEmissionFactorCategoryId").from("EmissionFactorCategory").where({EmissionFactorCategoryId: emissionFactorCategoryId});
    if(emissionFactorCategories.length == 0) {
        return null;
    }
    let emissionFactorCategory = emissionFactorCategories[0];
    if(emissionFactorCategory.parentEmissionFactorCategoryId != null) {
        emissionFactorCategory.parent = await getParentEmissionFactorCategory(emissionFactorCategory.parentEmissionFactorCategoryId);
    }
    return emissionFactorCategory;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function addEmissionFactorCategory(session, request) {
    let userId = session.userId;
    if(!(await hasEmissionFactorPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let emissionFactorCategoryName = request.emissionFactorCategoryName;
    let version = request.version;
    let parentEmissionFactorCategoryId = request.parentEmissionFactorCategoryId;
    let transaction = await connection.transaction();
    let emissionFactorCategoryId;
    try {
        let ids = await transaction.insert({
            EmissionFactorCategoryName: emissionFactorCategoryName, 
            Version: version, 
            ParentEmissionFactorCategoryId: parentEmissionFactorCategoryId
        }).into("EmissionFactorCategory");
        if(ids.length != 1) throw ErrorResponse(ErrorCode.StateError, "Inserting failed.");
        emissionFactorCategoryId = ids[0];
        await transaction.insert({OrganizationId: organizationId, EmissionFactorCategoryId: emissionFactorCategoryId}).into("OrganizationEmissionFactorCategory");
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
    return {emissionFactorCategoryId: emissionFactorCategoryId};
}

/**
 * @type {import("arbuscular").handle}
 */
export async function updateEmissionFactorCategory(session, request) {
    let userId = session.userId;
    if(!(await hasEmissionFactorPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let emissionFactorCategoryId = request.emissionFactorCategoryId;
    let emissionFactorCategoryName = request.emissionFactorCategoryName;
    let version = request.version;
    let parentEmissionFactorCategoryId = request.parentEmissionFactorCategoryId
    let transaction = await connection.transaction();
    try {
        if(!(await _verifyOwnership(transaction, organizationId, emissionFactorCategoryId))) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Emission factor category is not found.");
        }
        await transaction("EmissionFactorCategory").update({
            EmissionFactorCategoryName: emissionFactorCategoryName, 
            Version: version, 
            ParentEmissionFactorCategoryId: parentEmissionFactorCategoryId
        }).where({EmissionFactorCategoryId: emissionFactorCategoryId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * @type {import("arbuscular").handle}
 */
export async function deleteEmissionFactorCategory(session, request) {
    let userId = session.userId;
    if(!(await hasEmissionFactorPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let emissionFactorCategoryId = request.emissionFactorCategoryId;
    let transaction = await connection.transaction();
    try {
        if(!(await _verifyOwnership(transaction, organizationId, emissionFactorCategoryId))) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Emission factor category is not found.");
        }
        await transaction("EmissionFactorCategory").delete().where({EmissionFactorCategoryId: emissionFactorCategoryId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * @param {import("knex").Knex} connection 
 * @param {number} organizationId 
 * @param {number} emissionFactorId 
 * @returns {Promise<boolean>}
 */
export async function verifyOwnership(connection, organizationId, emissionFactorId) {
    let emissionFactors = await connection.select("emissionFactorCategoryId").from("EmissionFactor").where({EmissionFactorId: emissionFactorId});
    if(emissionFactors.length == 0) {
        return false;
    }
    let emissionFactorCategoryId = emissionFactors[0].emissionFactorCategoryId;
    return _verifyOwnership(connection, organizationId, emissionFactorCategoryId);
}

/**
 * @param {import("knex").Knex} connection 
 * @param {number} organizationId 
 * @param {number} emissionFactorCategoryId 
 * @returns {Promise<boolean>}
 */
async function _verifyOwnership(connection, organizationId, emissionFactorCategoryId) {
    let organizationEmissionFactorCategories = await connection.select("organizationId").from("OrganizationEmissionFactorCategory").where({OrganizationId: organizationId, EmissionFactorCategoryId: emissionFactorCategoryId});
    if(organizationEmissionFactorCategories.length == 1) {
        return true;
    }
    let emissionFactorCategories = await connection.select("parentEmissionFactorCategoryId").from("EmissionFactorCategory").where({EmissionFactorCategoryId: emissionFactorCategoryId});
    if(emissionFactorCategories.length != 1) {
        return false;
    }
    let parentEmissionFactorCategoryId = emissionFactorCategories[0].parentEmissionFactorCategoryId;
    return _verifyOwnership(connection, organizationId, parentEmissionFactorCategoryId);
}