/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../utility/database.js";
import { ErrorResponse, ErrorCode } from "arbuscular";
import { hasOrganizationPrivilege } from "./authorization.js";

/**
 * @type {import("arbuscular").handle}
 */
export async function getOrganizations(session, request) {
    let userId = session.userId;
    let organizationId = session.organizationId;
    let parentOrganizationId;
    let organizationName;
    if(request != null) {
        parentOrganizationId = request.parentOrganizationId;
        organizationName = request.organizationName;
    }
    return await restoreOrganizations(userId, organizationId, parentOrganizationId, organizationName);
}

/**
 * @typedef {object} Organization
 * @property {number} organizationId
 * @property {string} organizationName
 * @property {"User" | "Department" | "BusinessPartner"} organizationType
 * @property {number} parentOrganizationId
 * @property {Array<Identifier>} identifiers
 */

/**
 * @typedef {object} Identifier
 * @property {string} type
 * @property {string} code
 */

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {number} [parentOrganizationId] 
 * @param {string} [organizationName] 
 * @param {Array<Identifier>} [identifiers] 
 * @returns {Promise<Array<Organization>>}
 */
export async function restoreOrganizations(userId, organizationId, parentOrganizationId, organizationName, identifiers) {
    if(!(await hasOrganizationPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let query = connection.select("organizationId", "organizationName", "organizationType", "parentOrganizationId").from("Organization");
    if(parentOrganizationId != null) {
        query.whereIn("OrganizationId", function() {
            this.select("OrganizationId").from("Organization").where({ParentOrganizationId: organizationId});
        });
        query.andWhere({ParentOrganizationId: parentOrganizationId});
    }else if(organizationName != null) {
        query.where(function() {
            this.where({ParentOrganizationId: organizationId}).orWhere({OrganizationId: organizationId});
        });
        query.andWhere("OrganizationName", "like", "%"+organizationName+"%");
    }else if(identifiers != null && identifiers.length > 0) {
        query.whereIn("OrganizationId", function() {
            this.select("organizationId").from("OrganizationIdentifier");
            identifiers.forEach((identifier, index) => {
                if(index == 0) {
                    this.where({Code: identifier.code, Type: identifier.type});
                }else {
                    this.orWhere({Code: identifier.code, Type: identifier.type});
                }
            });
        });
        query.andWhere({ParentOrganizationId: organizationId});
    }else {
        query.where({ParentOrganizationId: organizationId});
    }
    let organizations = await query;
    await Promise.all(organizations.map(async organization => {
        organization.identifiers = await connection.select("code", "type").from("OrganizationIdentifier").where({OrganizationId: organization.organizationId});
    }));
    return organizations;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function getOrganization(session, request) {
    let userId = session.userId;
    if(!(await hasOrganizationPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let childOrganizationId;
    if(request != null) {
        childOrganizationId = request.organizationId;
    }
    let query = connection.select("organizationId", "organizationName", "organizationType", "parentOrganizationId").from("Organization");
    if(childOrganizationId == null || childOrganizationId == organizationId) {
        query.where({OrganizationId: organizationId});
    }else {
        query.where({OrganizationId: childOrganizationId, ParentOrganizationId: organizationId});
    }
    let organizations = await query;
    let organization = organizations[0];
    if(childOrganizationId == null || childOrganizationId == organizationId) {
        organization.identifiers = await connection.select("code", "type").from("OrganizationIdentifier").where({OrganizationId: organizationId});
    }else {
        organization.identifiers = await connection.select("code", "type").from("OrganizationIdentifier").where({OrganizationId: childOrganizationId});
    }
    return organization;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function addOrganization(session, request) {
    let userId = session.userId;
    let organizationId = session.organizationId;
    let organizationName = request.organizationName;
    let organizationType = request.organizationType;
    let identifiers = request.identifiers;
    return await storeOrganization(userId, organizationId, organizationName, organizationType, identifiers);
}

/**
 * @typedef {object} OrganizationRegistrationResult
 * @property {number} organizationId
 */

/**
 * @param {number} userId 
 * @param {number} organizationId Parent organization ID
 * @param {string} organizationName Child organization name
 * @param {string} organizationType Child organization type
 * @param {Array<Identifier>} identifiers Child organization identifiers
 * @returns {Promise<OrganizationRegistrationResult>}
 */
export async function storeOrganization(userId, organizationId, organizationName, organizationType, identifiers) {
    if(!(await hasOrganizationPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let transaction = await connection.transaction();
    let childOrganizationId;
    try {
        let organizations = await transaction.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId, OrganizationName: organizationName});
        if(organizations.length > 0) {
            throw ErrorResponse(ErrorCode.RequestError, "The name of that organization is already registered.");
        }
        let ids = await transaction.insert({
            OrganizationName: organizationName, 
            ParentOrganizationId: organizationId, 
            OrganizationType: (organizationType != null ? organizationType : "Department")
        }).into("Organization");
        if(ids.length != 1) throw ErrorResponse(ErrorCode.StateError, "Inserting failed.");
        childOrganizationId = ids[0];
        if(identifiers != null && identifiers.length > 0) {
            await Promise.all(identifiers.map(async identifier => {
                await transaction.insert({OrganizationId: childOrganizationId, Code: identifier.code, Type: identifier.type}).into("OrganizationIdentifier");
            }));
        }
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
    return {organizationId: childOrganizationId};
}

/**
 * @type {import("arbuscular").handle}
 */
export async function updateOrganization(session, request) {
    let userId = session.userId;
    if(!(await hasOrganizationPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let childOrganizationId = request.organizationId;
    let organizationName = request.organizationName;
    let identifiers = request.identifiers;
    let transaction = await connection.transaction();
    try {
        if(organizationId == childOrganizationId) {
            await transaction("Organization").update({OrganizationName: organizationName}).where({OrganizationId: organizationId});
        }else {
            let organizations = await transaction.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId, OrganizationName: organizationName}).andWhereNot({OrganizationId: childOrganizationId});
            if(organizations.length > 0) {
                throw ErrorResponse(ErrorCode.RequestError, "The name of that organization is already registered.");
            }
            await transaction("Organization").update({OrganizationName: organizationName}).where({OrganizationId: childOrganizationId, ParentOrganizationId: organizationId});
        }
        await transaction("OrganizationIdentifier").delete().where({OrganizationId: childOrganizationId});
        if(identifiers != null && identifiers.length > 0) {
            await Promise.all(identifiers.map(async identifier => {
                await transaction.insert({OrganizationId: childOrganizationId, Code: identifier.code, Type: identifier.type}).into("OrganizationIdentifier");
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
export async function deleteOrganization(session, request) {
    let userId = session.userId;
    if(!(await hasOrganizationPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let _organizationId = request.organizationId;
    let transaction = await connection.transaction();
    try {
        await transaction("Organization").delete().where({OrganizationId: _organizationId, ParentOrganizationId: organizationId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}