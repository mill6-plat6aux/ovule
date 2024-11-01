/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { readFileSync } from "fs";
import { sep } from "path";
import { ErrorResponse, ErrorCode, writeError, Validator, LogLevel } from "arbuscular";
import { v4 as uuid } from "uuid";
import { hasDataSourcePrivilege, hasTaskPrivilege } from "../authorization.js";
import { request } from "../../utility/http.js";
import { restoreDataSource, storeDataSource } from "../datasource-manager.js";
import { formatToIso8601String } from "../../utility/date-utils.js";
import { getOrganization, restoreOrganizations, storeOrganization } from "../organization-manager.js";
import { convertOrganizationIdentifiers } from "../pathfinder/product-footprint-manager.js";
import { storeTask, restoreSentTaskByTaskId, restoreSentTasksByEventId, updateTask } from "../task-manager.js";
import { contextPath, convertCompanyIds, storeProductFootprint } from "../pathfinder/event-manager.js";
import { constants, createHash, createSign, privateDecrypt, publicEncrypt } from "crypto";
import { restoreUser } from "../user-manager.js";
import { connection } from "../../utility/database.js";
import { parse } from "yaml";

const privateKey = readFileSync("credentials"+sep+"private-key.pem", "utf8");

const Spec = parse(readFileSync("./server/interface/pathfinder-2.2.0.yaml", "utf8"));

/**
 * @type {import("arbuscular").handle}
 */
export async function requestContract(session, request) {
    let userId = session.userId;
    if(!(await hasDataSourcePrivilege(userId, "Write")) || !(await hasDataSourcePrivilege(userId, "Read")) || !(await hasTaskPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let recipientOrganizationName = request.organizationName;
    let recipientIdentifiers = request.identifiers;
    let productFootprintId = request.productFootprintId;
    let message = request.message;

    let organization = await getOrganization({userId, organizationId}, null);

    let recipientOrganizationId;
    let dataId;

    if(recipientOrganizationName != null || recipientIdentifiers != null) {
        if(recipientIdentifiers != null) {
            let organizations = await restoreOrganizations(userId, organizationId, undefined, undefined, recipientIdentifiers);
            if(organizations.length > 0) {
                recipientOrganizationId = organizations[0].organizationId;
            }
        }else if(recipientOrganizationName != null) {
            let organizations = await restoreOrganizations(userId, organizationId, undefined, recipientOrganizationName, undefined);
            if(organizations.length > 0) {
                recipientOrganizationId = organizations[0].organizationId;
            }
        }else {
            throw ErrorResponse(ErrorCode.RequestError, "Please enter at least one valid value for the company name or company identifier.");
        }
        if(recipientOrganizationId == undefined) {
            let result = await storeOrganization(userId, organizationId, recipientOrganizationName, "BusinessPartner", recipientIdentifiers);
            recipientOrganizationId = result.organizationId;
        }
    }else if(productFootprintId != null) {
        // TODO: specify organizationId
        let records = await connection.select("dataId").from("ProductFootprint").where({ProductFootprintId: productFootprintId});
        if(records.length == 0) {
            throw ErrorResponse(ErrorCode.RequestError, "Invalid state.");
        }
        dataId = records[0].dataId;
    }else {
        throw ErrorResponse(ErrorCode.RequestError, "Invalid request.");
    }

    let dataSource = await restoreDataSource(organizationId, undefined, undefined, undefined, "Harmony");
    if(dataSource == null) {
        throw ErrorResponse(ErrorCode.RequestError, "Harmony data source is not registered.");
    }
    let authenticateEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "Authenticate");
    let updateEventEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "UpdateEvent");
    if(authenticateEndpoint == null) {
        throw ErrorResponse(ErrorCode.RequestError, "No authentication endpoints are registered in the Harmony data source.");
    }
    if(updateEventEndpoint == null) {
        throw ErrorResponse(ErrorCode.RequestError, "No events endpoints are registered in the Harmony data source.");
    }

    let accessToken = await getAccessToken(authenticateEndpoint.url, dataSource.userName, dataSource.password);

    let eventId = uuid();
    let data = {
        requestor: {
            companyName: organization.organizationName,
            companyIds: convertOrganizationIdentifiers(organization.identifiers)
        },
        requestee: {},
        message: message
    };

    if(recipientOrganizationId != null) {
        data.requestee = {
            companyName: recipientOrganizationName,
            companyIds: recipientIdentifiers != null ? convertOrganizationIdentifiers(recipientIdentifiers) : undefined
        };
    }else if(dataId != null) {
        data.requestee = {
            id: dataId
        };
        recipientOrganizationId = organizationId;
    }

    await requestToRemote("post", updateEventEndpoint.url, accessToken, "application/cloudevents+json; charset=UTF-8", {
        type: "org.wbcsd.pathfinder.Contract.Request.v1",
        specversion: "1.0",
        id: eventId,
        source: contextPath.substring(contextPath.indexOf(":")+1) + "/harmony" + "/2/events",
        time: formatToIso8601String(new Date(), true),
        data: data
    });

    let taskId;
    try {
        taskId = await storeTask(userId, organizationId, {
            clientOrganizationId: organizationId,
            recipientOrganizationId: recipientOrganizationId,
            taskType: "ContractRequest",
            message: message,
            status: "Unread",
            eventId: eventId,
            source: null,
            productFootprintId: productFootprintId,
            data: data
        });
    }catch(error) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: error.message}));
    }
}

/**
 * @type {import("arbuscular").handle}
 */
export async function replyContract(session, request) {
    let userId = session.userId;
    if(!(await hasDataSourcePrivilege(userId, "Write")) || !(await hasDataSourcePrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let taskId = request.taskId;
    let userName = request.userName;
    let password = request.password;
    let message = request.message;

    let organization = await getOrganization({userId, organizationId}, null);

    let task = await restoreSentTaskByTaskId(userId, organizationId, taskId);
    if(task == null) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: "Invalid state."}));
    }
    if(task.eventId == null) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: "Invalid state."}));
    }

    const publicKey = task.data.requestor.publicKey;
    if(publicKey == null) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: "Invalid state."}));
    }

    let harmonyDataSource = await restoreDataSource(organizationId, undefined, undefined, undefined, "Harmony");
    if(harmonyDataSource == null) {
        throw ErrorResponse(ErrorCode.RequestError, "Harmony data source is not registered.");
    }
    let authenticateEndpoint = harmonyDataSource.endpoints.find(endpoint => endpoint.type == "Authenticate");
    let updateEventEndpoint = harmonyDataSource.endpoints.find(endpoint => endpoint.type == "UpdateEvent");
    if(authenticateEndpoint == null) {
        throw ErrorResponse(ErrorCode.RequestError, "No authentication endpoints are registered in the Harmony data source.");
    }
    if(updateEventEndpoint == null) {
        throw ErrorResponse(ErrorCode.RequestError, "No events endpoints are registered in the Harmony data source.");
    }

    let users = await restoreUser(userId, organizationId, userName, "Pathfinder");
    if(users.length == 0) {
        throw ErrorResponse(ErrorCode.RequestError, "The specified user does not exist. Please create a Pathfinder user in Organization first.");
    }

    let dataSource = {
        userName: encrypt(userName, publicKey),
        password: encrypt(password, publicKey),
        endpoints: [
            {type: "Authenticate", url: encrypt(contextPath + "/pathfinder" + "/auth/token", publicKey)},
            {type: "GetFootprints", url: encrypt(contextPath + "/pathfinder" + "/2/footprints", publicKey)},
            {type: "UpdateEvent", url: encrypt(contextPath + "/pathfinder" + "/2/events", publicKey)},
        ]
    };

    let accessToken = await getAccessToken(authenticateEndpoint.url, harmonyDataSource.userName, harmonyDataSource.password);

    let data = {
        requestEventId: task.eventId,
        requestSource: task.source,
        dataSource: dataSource,
        companyName: organization.organizationName,
        companyIds: convertOrganizationIdentifiers(organization.identifiers),
        message: message
    };
    await requestToRemote("post", updateEventEndpoint.url, accessToken, "application/cloudevents+json; charset=UTF-8", {
        type: "org.wbcsd.pathfinder.Contract.Reply.v1",
        specversion: "1.0",
        id: uuid(),
        source: contextPath.substring(contextPath.indexOf(":")+1) + "/harmony" + "/2/events",
        time: formatToIso8601String(new Date(), true),
        data: data
    });
}

/**
 * Request handler for Pathfinder Harmony
 * @type {import("arbuscular").handle}
 */
export async function handleContractEvent(session, request) {
    let organizationId = session.organizationId;
    let userId = session.userId;

    let type = request.type;
    let eventId = request.id;
    let source = request.source;
    let data = request.data;

    if(type == "org.wbcsd.pathfinder.Contract.Request.v1") {
        await handleContractRequest(userId, organizationId, eventId, source, data);
    }else if(type == "org.wbcsd.pathfinder.Contract.Reply.v1") {
        await handleContractReply(userId, organizationId, data);
    }
}

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {string} eventId 
 * @param {string} source 
 * @param {object} data 
 */
async function handleContractRequest(userId, organizationId, eventId, source, data) {
    let organizationName = data.requestor.companyName;
    let companyIds = data.requestor.companyIds;
    let message = data.message;

    let organizationIdentifiers = convertCompanyIds(companyIds);

    let clientOrganizationId;
    if(companyIds != null && companyIds.length > 0) {
        let organizations = await restoreOrganizations(userId, organizationId, undefined, undefined, organizationIdentifiers);
        if(organizations.length > 0) {
            clientOrganizationId = organizations[0].organizationId;
        }
    }
    if(clientOrganizationId == null && organizationName != null) {
        let organizations = await restoreOrganizations(userId, organizationId, undefined, organizationName);
        if(organizations.length > 0) {
            clientOrganizationId = organizations[0].organizationId;
        }
    }
    if(clientOrganizationId == null) {
        let result = await storeOrganization(userId, organizationId, organizationName, "BusinessPartner", organizationIdentifiers);
        clientOrganizationId = result.organizationId;
    }

    try {
        await storeTask(userId, organizationId, {
            clientOrganizationId: clientOrganizationId,
            recipientOrganizationId: organizationId,
            taskType: "ContractRequest",
            message: message,
            status: "Unread",
            eventId: eventId,
            source: source,
            data: data
        });
    }catch(error) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: error.message}));
    }
}

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {object} data 
 */
async function handleContractReply(userId, organizationId, data) {
    let requestEventId = data.requestEventId;
    let dataSource = data.dataSource;
    let organizationName = data.companyName;
    let message = data.message;

    let tasks = await restoreSentTasksByEventId(userId, organizationId, requestEventId);
    if(tasks.length == 0) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "No related request found."}));
    }
    let task = tasks[0];

    dataSource.userName = decrypt(dataSource.userName);
    dataSource.password = decrypt(dataSource.password);
    dataSource.endpoints = dataSource.endpoints.map(endpoint => {
        endpoint.url = decrypt(endpoint.url);
        return endpoint;
    });
    if(dataSource.userName.length == 0) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "Invalid userName."}));
    }
    if(dataSource.password.length == 0) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "Invalid password."}));
    }
    dataSource.endpoints.forEach(endpoint => {
        if(!/https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/.test(endpoint.url)) {
            throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "Invalid url."}));
        }
    });
    if(dataSource.endpoints.find(endpoint => endpoint.type == "Authenticate") == null) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "Endpoint does not contain Action Authenticate."}));
    }
    if(dataSource.endpoints.find(endpoint => endpoint.type == "GetFootprints") == null) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "Endpoint does not contain Action ListFootprints."}));
    }

    await storeDataSource(userId, organizationId, organizationName, "Pathfinder", dataSource.userName, dataSource.password, dataSource.endpoints);

    if(task.productFootprintId != null) {
        let productFootprints = await connection.select("dataId").from("ProductFootprint").where({ProductFootprintId: task.productFootprintId});
        if(productFootprints.length == 0) {
            writeError("The product footprint had already been deleted.");
            return;
        }
        let dataId = productFootprints[0].dataId;
        await getProductFootprint(userId, organizationId, dataSource, dataId, task.productFootprintId);
    }

    try {
        updateTask({userId, organizationId}, {
            taskId: task.taskId,
            status: "Completed",
            replyMessage: message
        });
    }catch(error) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: error.message}));
    }
}

/**
 * @param {string} string 
 * @param {string} publicKey 
 * @returns {string}
 */
function encrypt(string, publicKey) {
    let encryptedData = publicEncrypt({key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING}, Buffer.from(string));
    return Buffer.from(encryptedData).toString("base64");
}

/**
 * @param {string} string 
 * @returns {string}
 */
function decrypt(string) {
    let encryptedData = Buffer.from(string, "base64");
    let decryptedData = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING }, encryptedData);
    return decryptedData.toString();
}

/**
 * @param {string} requestPath 
 * @param {string} userName 
 * @param {string} password 
 * @returns {Promise<string>}
 */
export async function getAccessToken(requestPath, userName, password) {
    let url = new URL(requestPath);
    let response = await request("post", requestPath, {
        host: url.hostname,
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
        authorization: "Basic " + Buffer.from(userName+":"+password).toString("base64")
    }, {grant_type: "client_credentials"});
    if(response.status != 200) {
        writeError(`An error was returned in the call to Action Events for Remote Service. Status:${response.status}, Body:${response.body}, URL: ${requestPath}`);
        throw ErrorResponse(ErrorCode.StateError, `An error response was returned in authentication to the remote service.`);
    }
    if(response.body == null || response.body.access_token == null) {
        writeError(`The call to Action Authenticate was successful, but the response did not contain an access token. Body:${response.body}, URL: ${requestPath}`);
        throw ErrorResponse(ErrorCode.StateError, `The call to Action Authenticate was successful, but the response did not contain an access token.`);
    }
    return response.body.access_token;
}

/**
 * @param {"get"|"post"|"patch"|"put"|"delete"|"option"|"head"} method 
 * @param {string} requestPath 
 * @param {string} accessToken 
 * @param {string} [contentType] 
 * @param {object} [requestBody] 
 * @returns {Promise<object>}
 */
export async function requestToRemote(method, requestPath, accessToken, contentType, requestBody) {
    let url = new URL(requestPath);

    let contentDigestLabel = "sha-256";
    let contentDigest;
    if(requestBody != null && typeof requestBody == "object") {
        contentDigest = createHash("SHA256").update(JSON.stringify(requestBody)).digest("base64");
    }

    let signLabel = "sig1";
    let signInput = `${signLabel}=("@method" "@authority" "@path"`;
    if(contentDigest != null) {
        signInput += ` "content-digest"`;
    }
    signInput += `);created=${new Date().getTime()};alg="rsa-v1_5-sha256"`;
    let signData = `"@method": ${method}\n"@authority": ${url.hostname}\n"@path": ${url.pathname}`;
    if(contentDigest != null) {
        signData += `\n"content-digest": ${contentDigestLabel}=:${contentDigest}:`;
    }
    let signature = createSign("SHA256").update(signData).end().sign(privateKey, "base64");

    let requestHeader = {
        host: url.hostname,
        authorization: "Bearer " + accessToken,
        "content-type": contentType,
        "content-digest": `${contentDigestLabel}=:${contentDigest}:`,
        "signature-input": signInput,
        "signature": `${signLabel}=:${signature}:`
    };

    let response = await request(method, requestPath, requestHeader, requestBody);
    if(response.status != 200) {
        writeError(`Harmony returned an error. Status:${response.status} Response:${JSON.stringify(response.body)} URL:${requestPath}`)
        throw ErrorResponse(ErrorCode.StateError, "Harmony returned an error. Please contact the administrator.");
    }

    return response.body;
}

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {object} dataSource 
 * @param {string} dataId 
 * @param {number} [productFootprintId]
 */
async function getProductFootprint(userId, organizationId, dataSource, dataId, productFootprintId) {
    let authenticateEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "Authenticate");
    if(authenticateEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: "The Action Authenticate for your system are not registered with this system."}));
    }
    let getFootprintsEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "GetFootprints");
    if(getFootprintsEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: "The Action ListFootprints for your system are not registered with this system."}));
    }
    
    let accessToken;
    try {
        accessToken = await getAccessToken(authenticateEndpoint.url, dataSource.userName, dataSource.password);
    }catch(error) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: "Authentication to your system failed."}));
    }
    
    let response = await request("get", getFootprintsEndpoint.url+"/"+dataId, {
        host: new URL(getFootprintsEndpoint.url).hostname,
        authorization: "Bearer " + accessToken
    });
    if(response.status != 200) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: "Failed to obtain a product footprint for your system."}));
    }
    let productFootprint = response.body.data;
    if(productFootprint == null) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: "Failed to obtain a product footprint for your system."}));
    }

    try {
        Validator.validate(productFootprint, Spec.components.schemas.ProductFootprint, Spec.components);
    }catch(error) {
        writeError(error.message);
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The product footprint obtained from your system does not follow the Tech Spec."}));
    }
    try {
        await storeProductFootprint(userId, organizationId, productFootprint, productFootprintId);
    }catch(error) {
        writeError(error.message);
        writeError(error.stack, LogLevel.debug);
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: error.message}));
    }
}