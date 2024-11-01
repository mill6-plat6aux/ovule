/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../utility/database.js";
import { ErrorResponse, ErrorCode } from "arbuscular";
import { createHash } from "crypto";
import { hasUserPrivilege } from "./authorization.js";

/**
 * @type {import("arbuscular").handle}
 */
export async function getUsers(session) {
    let userId = session.userId;
    if(!(await hasUserPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let users = await connection.select(
        "userId", 
        "userName", 
        "userType", 
        "organizationId"
    ).from("User")
    .where({OrganizationId: organizationId})
    .orWhereIn("OrganizationId", function() {
        this.select("OrganizationId").from("Organization").where({ParentOrganizationId: organizationId})
    })
    await Promise.all(users.map(async user => {
        user.privileges = await connection.select("data", "permission").from("UserPrivilege").where({UserId: user.userId});
    }));
    return users;
}

/**
 * @typedef {object} User
 * @property {number} userId
 * @property {string} userName
 * @property {string} userType
 * @property {number} organizationId
 */

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {string} [userName]
 * @param {string} [userType]
 * @returns {Promise<Array<User>>}
 */
export async function restoreUser(userId, organizationId, userName, userType) {
    if(!(await hasUserPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let query = connection.select(
        "userId", 
        "userName", 
        "userType", 
        "organizationId"
    ).from("User")
    .where(function() {
        this.where({OrganizationId: organizationId});
        this.orWhereIn("OrganizationId", function() {
            this.select("OrganizationId").from("Organization").where({ParentOrganizationId: organizationId})
        });
    });
    if(userName != null) {
        query.andWhere({UserName: userName});
    }
    if(userType != null) {
        query.andWhere({UserType: userType});
    }
    return await query;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function addUser(session, request) {
    let userId = session.userId;
    if(!(await hasUserPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let userName = request.userName;
    let userType = request.userType;
    let password = request.password;
    let privileges = request.privileges;
    let _organizationId = request.organizationId;

    if(_organizationId == null) {
        _organizationId = organizationId;
    }

    if(/^(?=.*[A-Z])(?=.*[.?/-])[a-zA-Z0-9.,:;?!/\-+%$#^&*\(\)\[\]\{\}"']{8,24}$/.test(password)) {
        throw ErrorResponse(ErrorCode.RequestError, "Password must be a string of at least 8 characters containing lowercase and uppercase letters, numbers, and symbols.");
    }
    let hashedPassword = createHash("sha256").update(password).digest("hex");
    
    let transaction = await connection.transaction();
    try {
        let ids = await transaction.insert({UserName: userName, UserType: userType, Password: hashedPassword, OrganizationId: _organizationId}).into("User");
        if(ids.length != 1) throw ErrorResponse(ErrorCode.StateError, "Inserting failed.");
        let userId = ids[0];
        if(privileges != null && privileges.length > 0) {
            await Promise.all(privileges.map(async privilege => {
                await transaction.insert({UserId: userId, Data: privilege.data, Permission: privilege.permission}).into("UserPrivilege");
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
export async function updateUser(session, request) {
    let userId = session.userId;
    if(!(await hasUserPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let _userId = request.userId;
    let userName = request.userName;
    let userType = request.userType;
    let password = request.password;
    let privileges = request.privileges;
    let _organizationId = request.organizationId;
    
    if(_organizationId == null) {
        _organizationId = organizationId;
    }
    
    let hashedPassword = null;
    if(password != null) {
        if(/^(?=.*[A-Z])(?=.*[.?/-])[a-zA-Z0-9.,:;?!/\-+%$#^&*\(\)\[\]\{\}"']{8,24}$/.test(password)) {
            throw ErrorResponse(ErrorCode.RequestError, "Password must be a string of at least 8 characters containing lowercase and uppercase letters, numbers, and symbols.");
        }
        hashedPassword = createHash("sha256").update(password).digest("hex");
    }
    
    let transaction = await connection.transaction();
    try {
        if(organizationId != _organizationId) {
            let organizations = await transaction.select("parentOrganizationId").from("Organization").where({OrganizationId: _organizationId});
            if(organizations.length == 0) {
                throw ErrorResponse(ErrorCode.RequestError, "Invalid request.");
            }
            if(organizations[0].parentOrganizationId != organizationId) {
                throw ErrorResponse(ErrorCode.RequestError, "Invalid request.");
            }
        }
        
        let users = await transaction.select("organizationId").from("User").where({UserId: userId}).andWhere(function() {
            this.where({OrganizationId: organizationId}).orWhereIn("OrganizationId", function() {
                this.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId});
            });
        });
        if(users.length == 0) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Not found.");
        }

        if(hashedPassword != null) {
            await transaction("User").update({UserName: userName, Password: hashedPassword}).where({OrganizationId: _organizationId, UserId: _userId});
        }else {
            await transaction("User").update({UserName: userName}).where({OrganizationId: _organizationId, UserId: _userId});
        }
        await transaction("UserPrivilege").delete().where({UserId: _userId});
        if(privileges != null && privileges.length > 0) {
            await Promise.all(privileges.map(async privilege => {
                await transaction.insert({UserId: _userId, Data: privilege.data, Permission: privilege.permission}).into("UserPrivilege");
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
export async function deleteUser(session, request) {
    let userId = session.userId;
    if(!(await hasUserPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let _userId = request.userId;
    if(userId == null) {
        throw ErrorResponse(ErrorCode.RequestError, "Invalid request.");
    }
    let transaction = await connection.transaction();
    try {
        let users = await transaction.select("organizationId").from("User").where({UserId: userId}).andWhere(function() {
            this.where({OrganizationId: organizationId}).orWhereIn("OrganizationId", function() {
                this.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId});
            });
        });
        if(users.length == 0) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Not found.");
        }

        await transaction("User").delete().where({UserId: _userId, OrganizationId: organizationId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}