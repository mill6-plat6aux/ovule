/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../utility/database.js";
import { ErrorResponse, ErrorCode } from "arbuscular";
import { hasDataSourcePrivilege } from "./authorization.js";
import { createHash, createCipheriv, createDecipheriv } from "crypto";

// TODO: Change to a user-defined password
const PASSWORD_ENCRYPTION_KEY = "%L]N3k&4";

/**
 * @type {import("arbuscular").handle}
 */
export async function getDataSources(session, request) {
    let userId = session.userId;
    if(!(await hasDataSourcePrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId;
    let dataSourceName;
    if(request != null) {
        productId = request.productId;
        dataSourceName = request.dataSourceName;
    }
    let query = connection.select("dataSourceId", "dataSourceName", "dataSourceType", "userName").from("DataSource").where({OrganizationId: organizationId});
    if(productId != null) {
        query.leftJoin("ProductNotification", "ProductNotification.DataSourceId", "DataSource.DataSourceId");
        query.andWhere({ProductId: productId});
    }else if(dataSourceName != null) {
        query.andWhere("DataSourceName", "like", "%"+dataSourceName+"%");
    }
    let dataSources = await query;
    await Promise.all(dataSources.map(async dataSource => {
        dataSource.endpoints = await connection.select("type", "url").from("Endpoint").where({DataSourceId: dataSource.dataSourceId});
    }));
    return dataSources;
}

/**
 * @typedef {object} Endpoint
 * @property {string} type
 * @property {string} url
 */

/**
 * @typedef {object} DataSource
 * @property {number} dataSourceId
 * @property {string} userName
 * @property {string} password
 * @property {Array<Endpoint>} endpoints
 */

/**
 * @param {number} organizationId 
 * @param {number} [dataSourceId]
 * @param {string} [url]
 * @param {number} [productId] 
 * @param {string} [dataSourceType]
 * @returns {Promise<DataSource|null>}
 */
export async function restoreDataSource(organizationId, dataSourceId, url, productId, dataSourceType) {
    let query = connection.select("Endpoint.DataSourceId as dataSourceId", "dataSourceType", "userName", "password")
        .from("Endpoint")
        .leftJoin("DataSource", "DataSource.DataSourceId", "Endpoint.DataSourceId")
        .where({OrganizationId: organizationId});
    if(dataSourceId != null) {
        query.andWhere({"DataSource.DataSourceId": dataSourceId});
    }else if(url != null) {
        query.andWhere({Url: url});
    }else if(productId != null) {
        query.leftJoin("ProductDataSource", "ProductDataSource.DataSourceId", "DataSource.DataSourceId");
        query.andWhere({ProductId: productId});
    }else if(dataSourceType != null) {
        query.andWhere({DataSourceType: dataSourceType});
    }else {
        throw new Error("Either url or productId.");
    }
    let dataSources = await query;
    if(dataSources.length == 0) return null;
    let dataSource = dataSources[0];
    if(dataSource.password != null) {
        dataSource.password = decrypt(dataSource.password, organizationId.toString());
    }
    dataSource.endpoints = await connection.select("type", "url").from("Endpoint").where({DataSourceId: dataSource.dataSourceId});
    return dataSource;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function addDataSource(session, request) {
    let userId = session.userId;
    let organizationId = session.organizationId;
    let dataSourceName = request.dataSourceName;
    let dataSourceType = request.dataSourceType;
    let userName = request.userName;
    let password = request.password;
    let endpoints = request.endpoints;
    await storeDataSource(userId, organizationId, dataSourceName, dataSourceType, userName, password, endpoints);
}

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {string} dataSourceName 
 * @param {string} dataSourceType
 * @param {string} userName 
 * @param {string} password 
 * @param {Array<Endpoint>} endpoints 
 */
export async function storeDataSource(userId, organizationId, dataSourceName, dataSourceType, userName, password, endpoints) {
    if(!(await hasDataSourcePrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let encryptedPassword;
    if(password !== undefined) {
        encryptedPassword = encrypt(password, organizationId.toString());
    }
    let transaction = await connection.transaction();
    let dataSourceId;
    try {
        let record = {DataSourceName: dataSourceName, DataSourceType: dataSourceType, UserName: userName, Password: encryptedPassword, OrganizationId: organizationId};
        let ids = await transaction.insert(record).into("DataSource");
        if(ids.length != 1) throw ErrorResponse(ErrorCode.StateError, "Inserting failed.");
        dataSourceId = ids[0];
        if(endpoints != null) {
            await Promise.all(endpoints.map(async endpoint => {
                await transaction.insert({DataSourceId: dataSourceId, Type: endpoint.type, Url: endpoint.url}).into("Endpoint");
            }));
        }
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
    return {dataSourceId: dataSourceId};
}

/**
 * @type {import("arbuscular").handle}
 */
export async function updateDataSource(session, request) {
    let userId = session.userId;
    if(!(await hasDataSourcePrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let dataSourceId = request.dataSourceId;
    let dataSourceName = request.dataSourceName;
    let userName = request.userName;
    let password = request.password;
    let endpoints = request.endpoints;
    let transaction = await connection.transaction();
    try {
        let record = {DataSourceName: dataSourceName};
        if(userName !== undefined) {
            record["UserName"] = userName;
        }
        if(password !== undefined) {
            record["Password"] = encrypt(password, organizationId.toString());
        }
        await transaction("DataSource").update(record).where({DataSourceId: dataSourceId, OrganizationId: organizationId});
        await transaction("Endpoint").delete().where({DataSourceId: dataSourceId});
        if(endpoints != null && endpoints.length > 0) {
            await Promise.all(endpoints.map(async endpoint => {
                await transaction.insert({DataSourceId: dataSourceId, Type: endpoint.type, Url: endpoint.url}).into("Endpoint");
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
export async function deleteDataSource(session, request) {
    let userId = session.userId;
    if(!(await hasDataSourcePrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let dataSourceId = request.dataSourceId;
    let transaction = await connection.transaction();
    try {
        await transaction("DataSource").delete().where({DataSourceId: dataSourceId, OrganizationId: organizationId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * @param {string} password 
 * @param {string} solt 
 * @returns {Buffer}
 */
function encrypt(password, solt) {
    let key = createHash("sha256");
    key.update(PASSWORD_ENCRYPTION_KEY);
    let _key = key.digest();

    let iv = createHash("md5");
    iv.update(solt);
    let _iv = iv.digest();

    let cipher = createCipheriv("aes-256-cbc", _key, _iv);
    return Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
}

/**
 * @param {Buffer} password 
 * @param {string} solt 
 * @returns {string}
 */
function decrypt(password, solt) {
    let key = createHash("sha256");
    key.update(PASSWORD_ENCRYPTION_KEY);
    let _key = key.digest();

    let iv = createHash("md5");
    iv.update(solt);
    let _iv = iv.digest();

    let decipher = createDecipheriv("aes-256-cbc", _key, _iv);
    return decipher.update(password) + decipher.final("utf8");
}