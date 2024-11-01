/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { readFileSync } from "fs";
import { parse } from "yaml";
import { v4 as uuid } from "uuid";
import { connection } from "../../utility/database.js";
import { Validator, ErrorResponse, ErrorCode, writeError, LogLevel } from "arbuscular";
import { request } from "../../utility/http.js";
import { restoreDataSource } from "../datasource-manager.js";
import { storeTask, updateTask } from "../task-manager.js";
import { addProduct, getProduct } from "../product-manager.js";
import { addProductFootprint, updateProductFootprint } from "../product-footprint-manager.js";
import { addEmissionFactorCategory } from "../emission-factor-manager.js";
import { formatToIso8601String } from "../../utility/date-utils.js";
import { restoreProductFootprint, convertProductFootprint } from "./product-footprint-manager.js";
import { hasTaskPrivilege } from "../authorization.js";

let contextPath;
if(process.env.CONTEXT_PATH != null) {
    contextPath = process.env.CONTEXT_PATH;
}else {
    contextPath = "http://localhost:3000";
}

/** @type {string} */
let defaultProtocol;
if(process.env.DEFAULT_PROTOCOL != null) {
    defaultProtocol = process.env.DEFAULT_PROTOCOL;
}else {
    defaultProtocol = "http";
}

const Spec = parse(readFileSync("./server/interface/pathfinder-2.2.0.yaml", "utf8"));

/**
 * @type {import("arbuscular").handle}
 */
export async function handleEvent(session, request) {
    let organizationId = session.organizationId;
    let userId = session.userId;

    let type = request.type;
    let source = request.source;
    let eventId = request.id;
    let data = request.data;

    if(!(await hasTaskPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, JSON.stringify({code: "AccessDenied", message: "Invalid user."}));
    }

    let parentOrganizationId;
    let organizations = await connection.select("parentOrganizationId").from("Organization").where({OrganizationId: organizationId});
    if(organizations == null) {
        throw ErrorResponse(ErrorCode.AuthorizationError, JSON.stringify({code: "AccessDenied", message: "Invalid organization."}));
    }
    parentOrganizationId = organizations[0].parentOrganizationId;

    if(type == null || typeof type != "string") {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The type property is not defined in the request."}));
    }

    if(source == null || typeof source != "string") {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The source property is not defined in the request."}));
    }
    if(source.startsWith("//")) {
        source = defaultProtocol+":"+source;
    }
    if(!/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/.test(source)) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The source property must be Action Events of your system."}));
    }
    let dataSource = await restoreDataSource(parentOrganizationId, undefined, source);
    if(dataSource == null) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The endpoint for the source property is not registered with this system."}));
    }

    if(eventId == null || typeof eventId != "string") {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The eventId property is not defined in the request."}));
    }
    
    if(data == null || typeof data != "object") {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The data property is not defined in the request."}));
    }

    if(type == "org.wbcsd.pathfinder.ProductFootprint.Published.v1") {
        await handleNotification(userId, organizationId, parentOrganizationId, eventId, data, dataSource);
    }else if(type == "org.wbcsd.pathfinder.ProductFootprintRequest.Created.v1") {
        await handleRequest(userId, organizationId, parentOrganizationId, eventId, data, dataSource);
    }else if(type == "org.wbcsd.pathfinder.ProductFootprintRequest.Fulfilled.v1") {
        await handleReply(userId, organizationId, parentOrganizationId, eventId, data, dataSource);
    }else if(type == "org.wbcsd.pathfinder.ProductFootprintRequest.Rejected.v1") {
        await handleReject(userId, organizationId, parentOrganizationId, eventId, data, dataSource);
    }
}

/**
 * @param {number} userId 
 * @param {number} clientOrganizationId 
 * @param {number} recipientOrganizationId
 * @param {string} eventId 
 * @param {object} data 
 * @param {import("../datasource-manager.js").DataSource} dataSource 
 */
async function handleNotification(userId, clientOrganizationId, recipientOrganizationId, eventId, data, dataSource) {
    if(data.pfIds == null || !Array.isArray(data.pfIds) || data.pfIds.length == 0) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The request body does not contain data.pfIds."}));
    }

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
    
    await Promise.all(data.pfIds.map(async pfId => {
        let response = await request("get", getFootprintsEndpoint.url+"/"+pfId, {
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
            await storeProductFootprint(userId, clientOrganizationId, productFootprint);
        }catch(error) {
            writeError(error.message);
            writeError(error.stack, LogLevel.debug);
            throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: error.message}));
        }

        try {
            await storeTask(userId, clientOrganizationId, {
                clientOrganizationId: clientOrganizationId,
                recipientOrganizationId: recipientOrganizationId,
                taskType: "ProductFootprintNotification",
                message: `${productFootprint.companyName} has updated its product footprint for ${productFootprint.productNameCompany}.`,
                status: "Unread",
                eventId: eventId,
                source: null,
                data: {
                    dataId: pfId
                }
            });
        }catch(error) {
            throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: error.message}));
        }
    }));
}

/**
 * @param {number} userId 
 * @param {number} clientOrganizationId 
 * @param {number} recipientOrganizationId
 * @param {string} eventId 
 * @param {object} data 
 * @param {import("../datasource-manager.js").DataSource} dataSource 
 */
async function handleRequest(userId, clientOrganizationId, recipientOrganizationId, eventId, data, dataSource) {
    if(data.pf == null || typeof data.pf != "object") {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The request body does not contain data.pf."}));
    }

    let productFootprint = {};
    if(data.pf.id != null && (/^[0-9A-F]{8}-[0-9A-F]{4}-[1-4]{1}[0-9A-F]{3}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(data.pf.id) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-4]{1}[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(data.pf.id))) {
        productFootprint.dataId = data.pf.id;
    }
    if(data.pf.version != null && typeof data.pf.version == "number") {
        productFootprint.version = data.pf.version;
    }
    if(data.pf.created != null && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3,9})?Z$/.test(data.pf.created)) {
        productFootprint.updatedDate = data.pf.created;
    }
    if(data.pf.status != null && (data.pf.status == "Active" || data.pf.status == "Deprecated")) {
        productFootprint.status = data.pf.status;
    }
    if(data.pf.validityPeriodStart != null && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3,9})?Z$/.test(data.pf.validityPeriodStart)) {
        productFootprint.availableStartDate = data.pf.validityPeriodStart;
    }
    if(data.pf.validityPeriodEnd != null && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3,9})?Z$/.test(data.pf.validityPeriodEnd)) {
        productFootprint.availableEndDate = data.pf.validityPeriodEnd;
    }
    if(data.pf.companyName != null) {
        if(productFootprint.organization == null) {
            productFootprint.organization = {};
        }
        productFootprint.organization.organizationName = data.pf.companyName;
    }
    if(data.pf.companyIds != null) {
        if(productFootprint.organization == null) {
            productFootprint.organization = {};
        }
        productFootprint.organization.identifiers = convertCompanyIds(data.pf.companyIds);
    }
    if(data.pf.productDescription != null) {
        if(productFootprint.product == null) {
            productFootprint.product = {};
        }
        productFootprint.product.description = data.pf.productDescription;
    }
    if(data.pf.productIds != null) {
        if(productFootprint.product == null) {
            productFootprint.product = {};
        }
        productFootprint.product.identifiers = convertProductIds(data.pf.productIds);
    }
    if(data.pf.productCategoryCpc != null && /^[0-9]{5,7}$/.test(data.pf.productCategoryCpc)) {
        if(productFootprint.product == null) {
            productFootprint.product = {};
        }
        productFootprint.product.CpcCode = data.pf.productCategoryCpc;
    }
    if(data.pf.productNameCompany != null) {
        if(productFootprint.product == null) {
            productFootprint.product = {};
        }
        productFootprint.product.productName = data.pf.productNameCompany;
    }

    try {
        await storeTask(userId, clientOrganizationId, {
            clientOrganizationId: clientOrganizationId,
            recipientOrganizationId: recipientOrganizationId,
            taskType: "ProductFootprintRequest",
            message: ((data.comment != null && typeof data.comment == "string") ? data.comment : null),
            status: "Unread",
            eventId: eventId,
            source: null,
            data: productFootprint
        });
    }catch(error) {
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: error.message}));
    }
}

/**
 * @param {number} userId 
 * @param {number} clientOrganizationId 
 * @param {number} recipientOrganizationId
 * @param {string} eventId 
 * @param {object} data 
 * @param {import("../datasource-manager.js").DataSource} dataSource 
 */
async function handleReply(userId, clientOrganizationId, recipientOrganizationId, eventId, data, dataSource) {
    if(data.requestEventId == null || typeof data.requestEventId != "string") {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The request body does not contain data.requestEventId."}));
    }
    if(data.pfs == null || !Array.isArray(data.pfs)) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The request body does not contain data.pfs."}));
    }
    
    let tasks = await connection.select("taskId", "eventId").from("Task").where({ClientOrganizationId: recipientOrganizationId, RecipientOrganizationId: clientOrganizationId, ExternalTaskId: data.requestEventId});
    if(tasks.length == 0) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: `The request associated with [${data.requestEventId}] is not registered in this system.`}));
    }

    try {
        data.pfs.forEach(productFootprint => {
            Validator.validate(productFootprint, Spec.components.schemas.ProductFootprint, Spec.components);
        });
    }catch(error) {
        writeError(error.message);
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The product footprint obtained from your system does not follow the Tech Spec."}));
    }
    
    await Promise.all(data.pfs.map(async productFootprint => {
        try {
            await storeProductFootprint(userId, clientOrganizationId, productFootprint);
        }catch(error) {
            writeError(error.message);
            writeError(error.stack, LogLevel.debug);
            throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: error.message}));
        }

        await Promise.all(tasks.map(async task => {
            try {
                await updateTask({userId: userId, organizationId: recipientOrganizationId}, {
                    taskId: task.taskId,
                    status: "Completed"
                });
            }catch(error) {
                throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: error.message}));
            }
        }));
    }));
}

/**
 * @param {number} userId 
 * @param {number} clientOrganizationId 
 * @param {number} recipientOrganizationId
 * @param {string} eventId 
 * @param {object} data 
 * @param {import("../datasource-manager.js").DataSource} dataSource 
 */
async function handleReject(userId, clientOrganizationId, recipientOrganizationId, eventId, data, dataSource) {
    if(data.requestEventId == null || typeof data.requestEventId != "string") {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The request body does not contain data.requestEventId."}));
    }
    if(data.error == null || typeof data.error != "object") {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The request body does not contain data.error."}));
    }
    
    let tasks = await connection.select("taskId", "eventId").from("Task").where({ClientOrganizationId: recipientOrganizationId, RecipientOrganizationId: clientOrganizationId, ExternalTaskId: data.requestEventId});
    if(tasks.length == 0) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: `The request associated with [${data.requestEventId}] is not registered in this system.`}));
    }

    await Promise.all(tasks.map(async task => {
        await updateTask({userId: userId, organizationId: clientOrganizationId}, {
            taskId: task.taskId,
            replyMessage: data.error.message != null ? data.error.message : data.error.code,
            status: "Rejected"
        });
    }));
}

/**
 * @param {number} userId 
 * @param {number} clientOrganizationId 
 * @param {number|null} recipientOrganizationId 
 * @param {number} productId 
 * @param {string} dataId 
 */
export async function sendNotification(userId, clientOrganizationId, recipientOrganizationId, productId, dataId) {
    let dataSource = await restoreDataSource(clientOrganizationId, undefined, undefined, productId);
    if(dataSource == null) {
        return;
    }
    let authenticateEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "Authenticate");
    if(authenticateEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, "The Action Authenticate for your system are not registered with this system.");
    }
    let updateEventEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "UpdateEvent");
    if(updateEventEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, "The Action Events for your system are not registered with this system.");
    }

    let accessToken = await getAccessToken(authenticateEndpoint.url, dataSource.userName, dataSource.password);

    let eventId = uuid();
    let response = await request("post", updateEventEndpoint.url, {
        host: new URL(updateEventEndpoint.url).hostname,
        authorization: "Bearer " + accessToken,
        "content-type": "application/cloudevents+json; charset=UTF-8"
    }, {
        type: "org.wbcsd.pathfinder.ProductFootprint.Published.v1",
        specversion: "1.0",
        id: eventId,
        source: contextPath.substring(contextPath.indexOf(":")+1) + "/pathfinder" + "/2/events",
        time: formatToIso8601String(new Date(), true),
        data: {
            pfIds: [dataId]
        }
    });
    if(response.status != 200) {
        writeError("An error was returned in the call to Action Events for Remote Service.");
        throw ErrorResponse(ErrorCode.StateError, "An error was returned in the call to Action Events for Remote Service.");
    }

    let organizations = await connection.select("organizationName").from("Organization").where({OrganizationId: clientOrganizationId});
    if(organizations.length == 0) {
        throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
    }
    let clientOrganizationName = organizations[0].organizationName;

    let products = await connection.select("productName").from("Product").where({ProductId: productId});
    if(products.length == 0) {
        throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
    }
    let productName = products[0].productName;

    if(recipientOrganizationId != null) {
        await storeTask(userId, clientOrganizationId, {
            clientOrganizationId: clientOrganizationId,
            recipientOrganizationId: recipientOrganizationId,
            taskType: "ProductFootprintNotification",
            message: `${clientOrganizationName} has updated its product footprint for ${productName}.`,
            status: "Completed",
            eventId: eventId,
            source: null,
            data: {
                dataId: dataId
            }
        });
    }
}

/**
 * @param {number} userId 
 * @param {number} clientOrganizationId 
 * @param {number|null} recipientOrganizationId 
 * @param {number} productId 
 * @param {string} eventId 
 * @param {string} message 
 */
export async function sendRequest(userId, clientOrganizationId, recipientOrganizationId, productId, eventId, message) {
    let dataSource = await restoreDataSource(clientOrganizationId, undefined, undefined, productId);
    if(dataSource == null) {
        return;
    }
    let authenticateEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "Authenticate");
    if(authenticateEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, "The Action Authenticate for your system are not registered with this system.");
    }
    let updateEventEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "UpdateEvent");
    if(updateEventEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, "The Action Events for your system are not registered with this system.");
    }

    let accessToken = await getAccessToken(authenticateEndpoint.url, dataSource.userName, dataSource.password);

    let requestProductFootprint = {};
    if(recipientOrganizationId != null) {
        let organizations = await connection.select("type", "code").from("OrganizationIdentifier").where({OrganizationId: recipientOrganizationId});
        if(organizations.length > 0) {
            requestProductFootprint.companyIds = organizations.map(organization => {
                let type = organization.type;
                let code = organization.code;
                if(type == "UUID") {
                    return "urn:uuid:"+code;
                }if(type == "SGLN") {
                    return "urn:epc:id:sgln:"+code;
                }if(type == "LEI") {
                    return "urn:lei:"+code;
                }if(type == "SupplierSpecific") {
                    return "urn:pathfinder:company:customcode:vendor-assigned:"+code;
                }if(type == "BuyerSpecific") {
                    return "urn:pathfinder:company:customcode:buyer-assigned:"+code;
                }else {
                    return null;
                }
            }).filter(entry => entry != null);
        }

        let products = await connection.select("type", "code").from("ProductIdentifier").where({ProductId: productId});
        if(products.length > 0) {
            requestProductFootprint.productIds = products.map(product => {
                let type = product.type;
                let code = product.code;
                if(type == "UUID") {
                    return "urn:uuid:"+code;
                }if(type == "SGTIN") {
                    return "urn:epc:id:sgtin:"+code;
                }if(type == "SupplierSpecific") {
                    return "urn:pathfinder:product:customcode:vendor-assigned:"+code;
                }if(type == "BuyerSpecific") {
                    return "urn:pathfinder:product:customcode:buyer-assigned:"+code;
                }else {
                    return null;
                }
            }).filter(entry => entry != null);
        }
    }

    let response = await request("post", updateEventEndpoint.url, {
        host: new URL(updateEventEndpoint.url).hostname,
        authorization: "Bearer " + accessToken,
        "content-type": "application/cloudevents+json; charset=UTF-8"
    }, {
        type: "org.wbcsd.pathfinder.ProductFootprintRequest.Created.v1",
        specversion: "1.0",
        id: eventId,
        source: contextPath.substring(contextPath.indexOf(":")+1) + "/pathfinder" + "/2/events",
        time: formatToIso8601String(new Date(), true),
        data: {
            pf: requestProductFootprint,
            comment: message
        }
    });
    if(response.status != 200) {
        writeError("An error was returned in the call to Action Events for Remote Service.");
        throw ErrorResponse(ErrorCode.StateError, "An error was returned in the call to Action Events for Remote Service.");
    }
}

/**
 * @param {number} userId 
 * @param {number} clientOrganizationId 
 * @param {number} productId 
 * @param {number} taskId 
 */
export async function sendReply(userId, clientOrganizationId, productId, taskId) {
    let dataSource = await restoreDataSource(clientOrganizationId, undefined, undefined, productId);
    if(dataSource == null) {
        return;
    }
    let authenticateEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "Authenticate");
    if(authenticateEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, "The Action Authenticate for your system are not registered with this system.");
    }
    let updateEventEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "UpdateEvent");
    if(updateEventEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, "The Action Events for your system are not registered with this system.");
    }

    let tasks = await connection.select("eventId").from("Task").where({TaskId: taskId});
    if(tasks.length == 0) {
        throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
    }
    let task = tasks[0];
    if(task.eventId == null) {
        throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
    }

    let productFootprints = await connection.select("productFootprintId").from("ProductFootprint").where({ProductId: productId, Status: "Active"});
    if(productFootprints.length == 0) {
        throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
    }
    productFootprints = await Promise.all(productFootprints.map(async _productFootprint => {
        let productFootprint = await restoreProductFootprint(userId, clientOrganizationId, null, undefined, _productFootprint.productFootprintId);
        return convertProductFootprint(productFootprint);
    }));

    let accessToken = await getAccessToken(authenticateEndpoint.url, dataSource.userName, dataSource.password);

    let response = await request("post", updateEventEndpoint.url, {
        host: new URL(updateEventEndpoint.url).hostname,
        authorization: "Bearer " + accessToken,
        "content-type": "application/cloudevents+json; charset=UTF-8"
    }, {
        type: "org.wbcsd.pathfinder.ProductFootprintRequest.Fulfilled.v1",
        specversion: "1.0",
        id: task.eventId,
        source: contextPath.substring(contextPath.indexOf(":")+1) + "/pathfinder" + "/2/events",
        time: formatToIso8601String(new Date(), true),
        data: {
            requestEventId: task.eventId,
            pfs: productFootprints
        }
    });
    if(response.status != 200) {
        writeError("An error was returned in the call to Action Events for Remote Service.");
        throw ErrorResponse(ErrorCode.StateError, "An error was returned in the call to Action Events for Remote Service.");
    }
}

/**
 * @param {number} userId 
 * @param {number} clientOrganizationId 
 * @param {number} productId 
 * @param {number} taskId 
 */
export async function sendReject(userId, clientOrganizationId, productId, taskId) {
    let dataSource = await restoreDataSource(clientOrganizationId, undefined, undefined, productId);
    if(dataSource == null) {
        return;
    }
    let authenticateEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "Authenticate");
    if(authenticateEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, "The Action Authenticate for your system are not registered with this system.");
    }
    let updateEventEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "UpdateEvent");
    if(updateEventEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, "The Action Events for your system are not registered with this system.");
    }

    let tasks = await connection.select("eventId", "replyMessage").from("Task").where({TaskId: taskId});
    if(tasks.length == 0) {
        throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
    }
    let task = tasks[0];
    if(task.eventId == null || task.productId == null) {
        throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
    }

    let accessToken = await getAccessToken(authenticateEndpoint.url, dataSource.userName, dataSource.password);

    let response = await request("post", updateEventEndpoint.url, {
        host: new URL(updateEventEndpoint.url).hostname,
        authorization: "Bearer " + accessToken,
        "content-type": "application/cloudevents+json; charset=UTF-8"
    }, {
        type: "org.wbcsd.pathfinder.ProductFootprintRequest.Rejected.v1",
        specversion: "1.0",
        id: task.eventId,
        source: contextPath.substring(contextPath.indexOf(":")+1) + "/pathfinder" + "/2/events",
        time: formatToIso8601String(new Date(), true),
        data: {
            requestEventId: task.eventId,
            error: {
                code: "BadRequest",
                message: task.replyMessage
            }
        }
    });
    if(response.status != 200) {
        writeError("An error was returned in the call to Action Events for Remote Service.");
        throw ErrorResponse(ErrorCode.StateError, "An error was returned in the call to Action Events for Remote Service.");
    }
}

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {number} dataSourceId 
 * @param {number} productId 
 */
export async function getProductFootprints(userId, organizationId, dataSourceId, productId) {
    let product = await getProduct({userId, organizationId}, {productId: productId});
    if(product.identifiers.length == 0) {
        return;
    }
    let identifiers = product.identifiers.map(identifier => {
        if(identifier.type == "UUID") {
            return `urn:uuid:${identifier.code}`;
        }else if(identifier.type == "SGTIN") {
            return `urn:epc:id:sgtin:${identifier.code}`;
        }else if(identifier.type == "SupplierSpecific") {
            return `urn:pathfinder:product:customcode:vendor-assigned:${identifier.code}`;
        }else if(identifier.type == "BuyerSpecific") {
            return `urn:pathfinder:product:customcode:buyer-assigned:${identifier.code}`;
        }else {
            return null;
        }
    }).filter(entry => entry != null);
    if(identifiers.length == 0) {
        return;
    }

    let dataSource = await restoreDataSource(organizationId, dataSourceId);
    if(dataSource == null) {
        throw ErrorResponse(ErrorCode.StateError, "The specified data source is not registered.")
    }
    let authenticateEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "Authenticate");
    if(authenticateEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, "Action Authenticate is not registered.");
    }
    let getFootprintsEndpoint = dataSource.endpoints.find(endpoint => endpoint.type == "GetFootprints");
    if(getFootprintsEndpoint == null) {
        throw ErrorResponse(ErrorCode.StateError, "Action Footprints is not registered.");
    }
    
    let accessToken = await getAccessToken(authenticateEndpoint.url, dataSource.userName, dataSource.password);

    let response = await request("get", getFootprintsEndpoint.url, {
        host: new URL(getFootprintsEndpoint.url).hostname,
        authorization: "Bearer " + accessToken
    });
    if(response.status != 200) {
        writeError(`Failed to obtain product footprint from the remote service. Status:${response.status}, URL:${getFootprintsEndpoint.url}`);
        throw ErrorResponse(ErrorCode.StateError, "Failed to obtain product footprint from the remote service.");
    }
    let productFootprints = response.body.data;
    productFootprints = productFootprints.filter(productFootprint => {
        return productFootprint.productIds.findIndex(productId => identifiers.includes(productId)) != -1;
    });
    if(productFootprints.length == 0) {
        writeError(`Product footprint retrieved from the remote service does not contain any content. URL:${getFootprintsEndpoint.url}`);
        throw ErrorResponse(ErrorCode.StateError, "Product footprint retrieved from the remote service does not contain any content.");
    }
    
    await Promise.all(productFootprints.map(async productFootprint => {
        try {
            Validator.validate(productFootprint, Spec.components.schemas.ProductFootprint, Spec.components);
        }catch(error) {
            writeError(error.message);
            throw ErrorResponse(ErrorCode.RequestError, `The product footprint obtained from the remote service does not follow the Tech Spec.`);
        }
    
        try {
            await storeProductFootprint(userId, organizationId, productFootprint);
        }catch(error) {
            writeError(error.message);
            writeError(error.stack, LogLevel.debug);
            throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: error.message}));
        }
    }));
}

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {object} productFootprint 
 */
async function storeProductFootprint(userId, organizationId, productFootprint) {
    let productIdEntries = convertProductIds(productFootprint.productIds);
    if(productIdEntries.length == 0) {
        throw ErrorResponse(ErrorCode.StateError, "Product identifiers included in the product footprint could not be interpreted by this system.");
    }

    let productIds = await Promise.all(productIdEntries.map(async productIdEntry => {
        let records = await connection.select("ProductIdentifier.ProductId as productId")
            .from("ProductIdentifier")
            .leftJoin("OrganizationProduct", "OrganizationProduct.ProductId", "ProductIdentifier.ProductId")
            .where({Type: productIdEntry.type, Code: productIdEntry.code})
            .andWhere(function() {
                this.where({OrganizationId: organizationId}).orWhereIn("OrganizationId", function() {
                    this.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId});
                })
            });
        if(records.length == 0) {
            return null;
        }
        return records[0].productId;
    }));
    productIds = productIds.filter(productId => productId != null);

    let productId;
    if(productIds.length == 0) {
        let result = await addProduct({userId: userId, organizationId: organizationId}, {
            productName: productFootprint.productNameCompany,
            description: productFootprint.productDescription,
            cpcCode: productFootprint.productCategoryCpc,
            identifiers: productIdEntries,
            parentProductId: null,
            organizationId: organizationId
        });
        productId = result[0].productId;
    }else {
        productId = productIds[0];
    }

    let emissionFactorCategoryIds;
    if(productFootprint.secondaryEmissionFactorSources != null) {
        emissionFactorCategoryIds = await Promise.all(productFootprint.secondaryEmissionFactorSources.map(async entry => {
            let result = await addEmissionFactorCategory({userId: userId, organizationId: organizationId}, {
                emissionFactorCategoryName: entry.name,
                version: entry.version,
                parentEmissionFactorCategoryId: null
            });
            return result.emissionFactorCategoryId;
        }));
    }

    let records = await connection.select("productFootprintId").from("ProductFootprint").where({DataId: productFootprint.id, Status: "Active"});
    if(records.length == 0) {
        await addProductFootprint({userId: userId, organizationId: organizationId}, {
            dataId: productFootprint.id,
            version: productFootprint.version,
            statusComment: productFootprint.statusComment,
            availableStartDate: productFootprint.validityPeriodStart,
            availableEndDate: productFootprint.validityPeriodEnd,
            productId: productId,
            comment: productFootprint.comment,
            amountUnit: convertAmountUnit(productFootprint.pcf.declaredUnit),
            amount: productFootprint.pcf.unitaryProductAmount,
            carbonFootprint: productFootprint.pcf.pCfExcludingBiogenic,
            carbonFootprintIncludingBiogenic: productFootprint.pcf.pCfIncludingBiogenic,
            fossilEmissions: productFootprint.pcf.fossilGhgEmissions,
            fossilCarbonContent: productFootprint.pcf.fossilCarbonContent,
            biogenicCarbonContent: productFootprint.pcf.biogenicCarbonContent,
            dLucEmissions: productFootprint.pcf.dLucGhgEmissions,
            landManagementEmissions: productFootprint.pcf.landManagementGhgEmissions,
            otherBiogenicEmissions: productFootprint.pcf.otherBiogenicGhgEmissions,
            iLucGhgEmissions: productFootprint.pcf.iLucGhgEmissions,
            biogenicRemoval: productFootprint.pcf.biogenicCarbonWithdrawal,
            aircraftEmissions: productFootprint.pcf.aircraftGhgEmissions,
            gwpReports: productFootprint.pcf.ipccCharacterizationFactorsSources,
            accountingStandards: convertAccountingStandard(productFootprint.pcf.crossSectoralStandardsUsed),
            carbonAccountingRules: convertCarbonAccountingRule(productFootprint.pcf.productOrSectorSpecificRules),
            biogenicAccountingStandard: productFootprint.pcf.biogenicAccountingMethodology,
            boundaryProcesses: productFootprint.pcf.boundaryProcessesDescription,
            measurementStartDate: productFootprint.pcf.referencePeriodStart,
            measurementEndDate: productFootprint.pcf.referencePeriodEnd,
            region: productFootprint.pcf.geographyRegionOrSubregion,
            country: productFootprint.pcf.geographyCountry,
            subdivision: productFootprint.pcf.geographyCountrySubdivision,
            inventoryDatabases: emissionFactorCategoryIds,
            exemptedEmissionsRate: productFootprint.pcf.exemptedEmissionsPercent,
            exemptedEmissionsReason: productFootprint.pcf.exemptedEmissionsDescription,
            packagingGhgEmissions: productFootprint.pcf.packagingGhgEmissions,
            allocationRules: productFootprint.pcf.allocationRulesDescription,
            uncertaintyAssessment: productFootprint.pcf.uncertaintyAssessmentDescription,
            primaryDataShare: productFootprint.pcf.primaryDataShare,
            dataQualityIndicator: convertDataQualityIndicator(productFootprint.pcf.dqi),
            assurance: convertAssurance(productFootprint.pcf.assurance)
        });
    }else {
        await updateProductFootprint({userId: userId, organizationId: organizationId}, {
            productFootprintId: records[0].productFootprintId,
            dataId: productFootprint.id,
            version: productFootprint.version,
            statusComment: productFootprint.statusComment,
            availableStartDate: productFootprint.validityPeriodStart,
            availableEndDate: productFootprint.validityPeriodEnd,
            productId: productId,
            comment: productFootprint.comment,
            amountUnit: convertAmountUnit(productFootprint.pcf.declaredUnit),
            amount: productFootprint.pcf.unitaryProductAmount,
            carbonFootprint: productFootprint.pcf.pCfExcludingBiogenic,
            carbonFootprintIncludingBiogenic: productFootprint.pcf.pCfIncludingBiogenic,
            fossilEmissions: productFootprint.pcf.fossilGhgEmissions,
            fossilCarbonContent: productFootprint.pcf.fossilCarbonContent,
            biogenicCarbonContent: productFootprint.pcf.biogenicCarbonContent,
            dLucEmissions: productFootprint.pcf.dLucGhgEmissions,
            landManagementEmissions: productFootprint.pcf.landManagementGhgEmissions,
            otherBiogenicEmissions: productFootprint.pcf.otherBiogenicGhgEmissions,
            iLucGhgEmissions: productFootprint.pcf.iLucGhgEmissions,
            biogenicRemoval: productFootprint.pcf.biogenicCarbonWithdrawal,
            aircraftEmissions: productFootprint.pcf.aircraftGhgEmissions,
            gwpReports: productFootprint.pcf.ipccCharacterizationFactorsSources,
            accountingStandards: convertAccountingStandard(productFootprint.pcf.crossSectoralStandardsUsed),
            carbonAccountingRules: convertCarbonAccountingRule(productFootprint.pcf.productOrSectorSpecificRules),
            biogenicAccountingStandard: productFootprint.pcf.biogenicAccountingMethodology,
            boundaryProcesses: productFootprint.pcf.boundaryProcessesDescription,
            measurementStartDate: productFootprint.pcf.referencePeriodStart,
            measurementEndDate: productFootprint.pcf.referencePeriodEnd,
            region: productFootprint.pcf.geographyRegionOrSubregion,
            country: productFootprint.pcf.geographyCountry,
            subdivision: productFootprint.pcf.geographyCountrySubdivision,
            inventoryDatabases: emissionFactorCategoryIds,
            exemptedEmissionsRate: productFootprint.pcf.exemptedEmissionsPercent,
            exemptedEmissionsReason: productFootprint.pcf.exemptedEmissionsDescription,
            packagingGhgEmissions: productFootprint.pcf.packagingGhgEmissions,
            allocationRules: productFootprint.pcf.allocationRulesDescription,
            uncertaintyAssessment: productFootprint.pcf.uncertaintyAssessmentDescription,
            primaryDataShare: productFootprint.pcf.primaryDataShare,
            dataQualityIndicator: convertDataQualityIndicator(productFootprint.pcf.dqi),
            assurance: convertAssurance(productFootprint.pcf.assurance)
        });
    }
}

/**
 * @param {string} url 
 * @param {string} userName 
 * @param {string} password 
 * @returns {Promise<string>}
 */
export async function getAccessToken(url, userName, password) {
    let response = await request("post", url, {
        host: new URL(url).hostname,
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
        authorization: "Basic " + Buffer.from(userName+":"+password).toString("base64")
    }, {grant_type: "client_credentials"});
    if(response.status != 200) {
        writeError(`An error was returned in the call to Action Events for Remote Service. Status:${response.status}, Body:${response.body}, URL: ${url}`);
        throw ErrorResponse(ErrorCode.StateError, `An error response was returned in authentication to the remote service.`);
    }
    if(response.body == null || response.body.access_token == null) {
        writeError(`The call to Action Authenticate was successful, but the response did not contain an access token. Body:${response.body}, URL: ${url}`);
        throw ErrorResponse(ErrorCode.StateError, `The call to Action Authenticate was successful, but the response did not contain an access token.`);
    }
    return response.body.access_token;
}

/**
 * @typedef {object} Identifier
 * @property {string} type
 * @property {string} code
 */

/**
 * @param {Array<string>} source
 * @returns {Array<Identifier>} 
 */
export function convertCompanyIds(source) {
    return source.map(value => {
        let type;
        let code;
        if(value.startsWith("urn:uuid:")) {
            type = "UUID";
            code = value.substring("urn:uuid:".length);
        }else if(value.startsWith("urn:epc:id:sgln:")) {
            type = "SGLN";
            code = value.substring("urn:epc:id:sgln:".length);
        }else if(value.startsWith("urn:lei:")) {
            type = "LEI";
            code = value.substring("urn:lei:".length);
        }else if(value.startsWith("urn:pathfinder:company:customcode:vendor-assigned:")) {
            type = "SupplierSpecific";
            code = value.substring("urn:pathfinder:company:customcode:vendor-assigned:".length);
        }else if(value.startsWith("urn:pathfinder:company:customcode:buyer-assigned:")) {
            type = "BuyerSpecific";
            code = value.substring("urn:pathfinder:company:customcode:buyer-assigned:".length);
        }else {
            return null;
        }
        return {type, code};
    }).filter(entry => entry != null);
}

/**
 * @param {Array<string>} source
 * @returns {Array<Identifier>} 
 */
export function convertProductIds(source) {
    return source.map(productId => {
        let type;
        let code;
        if(productId.startsWith("urn:uuid:")) {
            type = "UUID";
            code = productId.substring("urn:uuid:".length);
        }else if(productId.startsWith("urn:epc:id:sgtin:")) {
            type = "SGTIN";
            code = productId.substring("urn:epc:id:sgtin:".length);
        }else if(productId.startsWith("urn:pathfinder:product:customcode:vendor-assigned:")) {
            type = "SupplierSpecific";
            code = productId.substring("urn:pathfinder:product:customcode:vendor-assigned:".length);
        }else if(productId.startsWith("urn:pathfinder:product:customcode:buyer-assigned:")) {
            type = "BuyerSpecific";
            code = productId.substring("urn:pathfinder:product:customcode:buyer-assigned:".length);
        }else {
            return null;
        }
        return {type, code};
    }).filter(productIdEntry => productIdEntry != null);
}

/**
 * @param {string} source 
 * @returns {string|null}
 */
function convertAmountUnit(source) {
    if(source == null) return null;
    if(source == "liter") {
        return "l";
    }else if(source == "kilogram") {
        return "kg";
    }else if(source == "cubic meter") {
        return "m3";
    }else if(source == "square meter") {
        return "m2";
    }else if(source == "kilowatt hour") {
        return "kWh";
    }else if(source == "megajoule") {
        return "MJ";
    }else if(source == "ton kilometer") {
        return "t-km";
    }else {
        throw new Error(`Unknown amount unit ${source}.`);
    }
}

/**
 * @param {Array<string>} source 
 * @returns {Array<string>|null}
 */
function convertAccountingStandard(source) {
    if(source == null) return null;
    if(!Array.isArray(source)) return null;
    return source.map(entry => {
        if(entry == "GHG Protocol Product standard") {
            return "GHGProtocol";
        }else if(entry == "ISO Standard 14067") {
            return "ISO14067";
        }else if(entry == "ISO Standard 14044") {
            return "ISO14044";
        }else {
            throw new Error(`Unknown accounting standard ${source}.`);
        }
    });
}

/**
 * @param {Array<object>} source 
 * @returns {Array<object>|null}
 */
function convertCarbonAccountingRule(source) {
    if(source == null) return null;
    if(!Array.isArray(source)) return null;
    return source.map(entry => {
        return {operator: entry.operator, ruleNames: entry.ruleNames, operatorName: entry.otherOperatorName};
    });
}

/**
 * @param {object} source 
 * @returns {object|null}
 */
function convertDataQualityIndicator(source) {
    if(source == null) return null;
    return {
        coverage: source.coveragePercent,
        ter: source.technologicalDQR,
        tir: source.temporalDQR,
        ger: source.geographicalDQR,
        completeness: source.completenessDQR,
        reliability: source.reliabilityDQR
    };
}

/**
 * @param {object} source 
 * @returns {object|null}
 */
function convertAssurance(source) {
    if(source == null) return null;
    return {
        coverage: source.coverage,
        level: source.level,
        boundary: source.boundary,
        providerName: source.providerName,
        updatedDate: source.completedAt,
        standard: source.standardName,
        comments: source.comments
    };
}