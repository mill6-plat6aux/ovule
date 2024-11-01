/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../utility/database.js";

/**
 * @typedef {object} UserPrivilege
 * @property {"Organization"|"Users"|"Products"|"EmissionFactor"|"ProductActivity"|"ProductFootprint"|"DataSource"|"Task"} data
 * @property {"Read"|"Write"} permission
 */

/**
 * @param {number} userId 
 * @returns {Promise<Array<UserPrivilege>>}
 */
async function getPrivileges(userId) {
    let privileges = await connection.select("data", "permission").from("UserPrivilege").where({UserId: userId});
    return privileges;
}

/**
 * @param {number} userId 
 * @param {"Read"|"Write"} permission
 * @returns {Promise<boolean>}
 */
export async function hasOrganizationPrivilege(userId, permission) {
    let privileges = await getPrivileges(userId);
    return privileges.findIndex(privilege => privilege.data == "Organization" && privilege.permission == permission) != -1;
}

/**
 * @param {number} userId 
 * @param {"Read"|"Write"} permission
 * @returns {Promise<boolean>}
 */
export async function hasUserPrivilege(userId, permission) {
    let privileges = await getPrivileges(userId);
    return privileges.findIndex(privilege => privilege.data == "Users" && privilege.permission == permission) != -1;
}

/**
 * @param {number} userId 
 * @param {"Read"|"Write"} permission
 * @returns {Promise<boolean>}
 */
export async function hasProductPrivilege(userId, permission) {
    let privileges = await getPrivileges(userId);
    return privileges.findIndex(privilege => privilege.data == "Products" && privilege.permission == permission) != -1;
}

/**
 * @param {number} userId 
 * @param {"Read"|"Write"} permission
 * @returns {Promise<boolean>}
 */
export async function hasEmissionFactorPrivilege(userId, permission) {
    let privileges = await getPrivileges(userId);
    return privileges.findIndex(privilege => privilege.data == "EmissionFactor" && privilege.permission == permission) != -1;
}

/**
 * @param {number} userId 
 * @param {"Read"|"Write"} permission
 * @returns {Promise<boolean>}
 */
export async function hasProductActivityPrivilege(userId, permission) {
    let privileges = await getPrivileges(userId);
    return privileges.findIndex(privilege => privilege.data == "ProductActivity" && privilege.permission == permission) != -1;
}

/**
 * @param {number} userId 
 * @param {"Read"|"Write"} permission
 * @returns {Promise<boolean>}
 */
export async function hasProductFootprintPrivilege(userId, permission) {
    let privileges = await getPrivileges(userId);
    return privileges.findIndex(privilege => privilege.data == "ProductFootprint" && privilege.permission == permission) != -1;
}

/**
 * @param {number} userId 
 * @param {"Read"|"Write"} permission
 * @returns {Promise<boolean>}
 */
export async function hasDataSourcePrivilege(userId, permission) {
    let privileges = await getPrivileges(userId);
    return privileges.findIndex(privilege => privilege.data == "DataSource" && privilege.permission == permission) != -1;
}

/**
 * @param {number} userId 
 * @param {"Read"|"Write"} permission
 * @returns {Promise<boolean>}
 */
export async function hasTaskPrivilege(userId, permission) {
    let privileges = await getPrivileges(userId);
    return privileges.findIndex(privilege => privilege.data == "Task" && privilege.permission == permission) != -1;
}