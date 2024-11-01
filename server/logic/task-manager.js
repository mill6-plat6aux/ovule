/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../utility/database.js";
import { ErrorResponse, ErrorCode } from "arbuscular";
import { hasTaskPrivilege } from "./authorization.js";
import { sendRequest } from "./pathfinder/event-manager.js";
import { formatToIso8601String } from "../utility/date-utils.js";
import { getProduct } from "./product-manager.js";
import { v4 as uuid } from "uuid";

/**
 * @type {import("arbuscular").handle}
 */
export async function getReceivedTasks(session, request) {
    let userId = session.userId;
    if(!(await hasTaskPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    return getTasks(organizationId, null, null, null, false, null);
}

/**
 * @type {import("arbuscular").handle}
 */
export async function getSentTasks(session, request) {
    let userId = session.userId;
    if(!(await hasTaskPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    return getTasks(null, organizationId, null, null, false, null);
}

/**
 * @param {number} userId 
 * @param {number} organizationId Recipient organization
 * @param {number} productId 
 * @returns {Promise<Array<Task>>}
 */
export async function restoreReceivedTasksByProduct(userId, organizationId, productId) {
    if(!(await hasTaskPrivilege(userId, "Read"))) {
        return [];
    }
    let product = await getProduct({userId: userId, organizationId: organizationId}, {productId: productId});

    let tasks = await getTasks(organizationId, null, null, null, true, false);
    tasks = tasks.filter(task => {
        if(task.data == null || task.data.product == null) return false;
        let result = true;
        if(result && task.data.product.productName != null) {
            if(product.productName != task.data.product.productName) {
                result = false;
            }
        }
        if(result && task.data.product.description != null) {
            if(product.description != task.data.product.description) {
                result = false;
            }
        }
        if(result && task.data.product.cpcCode != null) {
            if(product.cpcCode != task.data.product.cpcCode) {
                result = false;
            }
        }
        if(result && task.data.product.identifiers != null) {
            let index = product.identifiers.findIndex(indentifier => {
                return task.data.product.identifiers.findIndex(_indentifier => indentifier.type == _indentifier.type && indentifier.code == _indentifier.code) != -1;
            });
            if(index == -1) {
                result = false;
            }
        }
        return result;
    });
    return tasks;
}

/**
 * @param {number} userId 
 * @param {number} organizationId Recipient organization
 * @param {number} taskId 
 * @returns {Promise<Task|null>}
 */
export async function restoreSentTaskByTaskId(userId, organizationId, taskId) {
    let tasks = await getTasks(organizationId, null, taskId, null, true, false);
    return tasks.length > 0 ? tasks[0] : null;
}

/**
 * @param {number} userId 
 * @param {number} organizationId Recipient organization
 * @param {string} eventId 
 * @returns {Promise<Array<Task>>}
 */
export async function restoreSentTasksByEventId(userId, organizationId, eventId) {
    return await getTasks(organizationId, null, null, eventId, true, false);
}

/**
 * @typedef {object} Task
 * @property {number} [taskId]
 * @property {number} clientOrganizationId
 * @property {string} [clientOrganizationName]
 * @property {number} recipientOrganizationId
 * @property {string} [recipientOrganizationName]
 * @property {string} taskType
 * @property {string|null} message
 * @property {"Unread" | "Pending" | "Rejected" | "Completed"} status
 * @property {string|null} eventId
 * @property {string|null} source
 * @property {object|null} [data]
 * @property {object|null} [productId]
 * @property {Date} [updatedDate]
 */

/**
 * @param {number|null} recipientOrganizationId
 * @param {number|null} clientOrganizationId
 * @param {number|null} taskId
 * @param {string|null} eventId
 * @param {boolean} dataRequired Decode data
 * @param {boolean|null} completed
 * @returns {Promise<Array<Task>>}
 */
async function getTasks(recipientOrganizationId, clientOrganizationId, taskId, eventId, dataRequired, completed) {
    if(recipientOrganizationId == null && clientOrganizationId == null) {
        throw ErrorResponse(ErrorCode.RequestError, "Invalid request.");
    }
    let columns = [
        "taskId", 
        "clientOrganizationId", 
        "ClientOrganization.OrganizationName as clientOrganizationName", 
        "recipientOrganizationId", 
        "RecipientOrganization.OrganizationName as recipientOrganizationName",
        "taskType", 
        "message",
        "status",
        "eventId",
        "source",
        "updatedDate"
    ];
    if(dataRequired) {
        columns.push("data");
    }
    let query = connection.column(columns).select().from("Task")
    .leftJoin("Organization as ClientOrganization", "ClientOrganization.OrganizationId", "Task.ClientOrganizationId")
    .leftJoin("Organization as RecipientOrganization", "RecipientOrganization.OrganizationId", "Task.RecipientOrganizationId")
    .orderBy("updatedDate", "desc");
    if(recipientOrganizationId != null) {
        query.where({RecipientOrganizationId: recipientOrganizationId});
    }
    if(clientOrganizationId != null) {
        query.where({ClientOrganizationId: clientOrganizationId});
    }
    if(taskId != null) {
        query.andWhere({TaskId: taskId});
    }
    if(eventId != null) {
        query.andWhere({EventId: eventId});
    }
    if(completed != null) {
        if(completed) {
            query.andWhere(function() {
                this.where({Status: "Rejected"}).orWhere({Status: "Completed"})
            });
        }else {
            query.andWhere(function() {
                this.where({Status: "Unread"}).orWhere({Status: "Pending"})
            });
        }
    }
    let tasks = await query;
    tasks = tasks.map(task => {
        task.updatedDate = formatToIso8601String(task.updatedDate, true);
        if(dataRequired && task.data != null) {
            task.data = JSON.parse(task.data.toString("utf8"));
        }
        return task;
    });
    return tasks;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function getTask(session, request) {
    let userId = session.userId;
    if(!(await hasTaskPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let taskId = request.taskId;
    let records = await connection.select(
        "taskId", 
        "clientOrganizationId", 
        "ClientOrganization.OrganizationName as clientOrganizationName", 
        "recipientOrganizationId", 
        "RecipientOrganization.OrganizationName as recipientOrganizationName",
        "taskType", 
        "message",
        "status",
        "data",
        "updatedDate"
    ).from("Task")
    .leftJoin("Organization as ClientOrganization", "ClientOrganization.OrganizationId", "Task.ClientOrganizationId")
    .leftJoin("Organization as RecipientOrganization", "RecipientOrganization.OrganizationId", "Task.RecipientOrganizationId")
    .where({TaskId: taskId})
    .andWhere(function() {
        this.where({ClientOrganizationId: organizationId}).orWhere({RecipientOrganizationId: organizationId});
    });
    if(records.length != 1) {
        throw ErrorResponse(ErrorCode.NotFoundError, "Not found.");
    }
    let record = records[0];
    if(record.data != null) {
        record.data = JSON.parse(record.data.toString("utf8"));
    }
    return record;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function addRequest(session, request) {
    let userId = session.userId;
    if(!(await hasTaskPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;

    let requestType = request.requestType;
    let recipientOrganizationId = request.recipientOrganizationId;
    let message = request.message;
    let productId = request.productId;
    let updatedDate = new Date();
    
    let clientOrganizationId = organizationId;
    
    let transaction = await connection.transaction();
    try {
        let organizations = await transaction.select("organizationName")
            .from("Organization")
            .where({OrganizationId: recipientOrganizationId, ParentOrganizationId: organizationId});
        if(organizations.length == 0) throw ErrorResponse(ErrorCode.RequestError, "Invalid organization.");
        let recipientOrganizationName = organizations[0].organizationName;

        let products = await transaction.select("productName")
            .from("Product")
            .leftJoin("OrganizationProduct", "OrganizationProduct.ProductId", "Product.ProductId")
            .whereIn("OrganizationId", function() {
                this.select("OrganizationId").from("Organization").where({ParentOrganizationId: organizationId});
            }).andWhere({"Product.ProductId": productId});
        if(products.length == 0) throw ErrorResponse(ErrorCode.RequestError, "Invalid products.");
        let productName = products[0].productName;

        let data = {
            organization: {
                organizationId: recipientOrganizationId,
                organizationName: recipientOrganizationName
            },
            product: {
                productId: productId,
                productName: productName
            }
        };

        let eventId = uuid();

        let ids = await transaction.insert({
            ClientOrganizationId: clientOrganizationId,
            RecipientOrganizationId: recipientOrganizationId,
            TaskType: requestType,
            Message: message,
            Status: "Unread",
            EventId: eventId,
            Data: Buffer.from(JSON.stringify(data)),
            ProductId: productId,
            UpdatedDate: updatedDate
        }).into("Task");
        if(ids.length == 0) throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
        let taskId = ids[0];

        await sendRequest(userId, clientOrganizationId, recipientOrganizationId, productId, eventId, message);

        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {Task} task 
 */
export async function storeTask(userId, organizationId, task) {
    if(!(await hasTaskPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let updatedDate = new Date();
    if(task.clientOrganizationId == null) {
        task.clientOrganizationId = organizationId;
    }
    if(organizationId != task.clientOrganizationId && organizationId != task.recipientOrganizationId) {
        throw ErrorResponse(ErrorCode.RequestError, "Invalid request.");
    }
    if(task.data != null && !(task.data instanceof Buffer)) {
        task.data = Buffer.from(JSON.stringify(task.data));
    }
    let transaction = await connection.transaction();
    let taskId;
    try {
        let ids = await transaction.insert({
            ClientOrganizationId: task.clientOrganizationId,
            RecipientOrganizationId: task.recipientOrganizationId,
            TaskType: task.taskType,
            Message: task.message,
            Status: task.status,
            EventId: task.eventId,
            Source: task.source,
            Data: task.data,
            ProductId: task.productId,
            UpdatedDate: updatedDate
        }).into("Task");
        if(ids.length == 0) throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
        taskId = ids[0];
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * @type {import("arbuscular").handle}
 */
export async function updateTask(session, request) {
    let userId = session.userId;
    if(!(await hasTaskPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let taskId = request.taskId;
    let taskType = request.taskType;
    let status = request.status;
    let replyMessage = request.replyMessage;
    let updatedDate = new Date();
    let transaction = await connection.transaction();
    try {
        let records = await connection.select("status").from("Task").where({TaskId: taskId}).andWhere(function() {
            this.where({ClientOrganizationId: organizationId}).orWhere({RecipientOrganizationId: organizationId})
        });
        if(records.length != 1) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Not found.");
        }
        let storedStatus = records[0].status;
        if(storedStatus == "Completed") {
            throw ErrorResponse(ErrorCode.RequestError, "Cannot change status because it has already been completed.");
        }
        await transaction("Task").update({
            Status: status,
            ReplyMessage: replyMessage,
            UpdatedDate: updatedDate
        }).where({TaskId: taskId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * @type {import("arbuscular").handle}
 */
export async function deleteTask(session, request) {
    let userId = session.userId;
    if(!(await hasTaskPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let taskId = request.taskId;
    let transaction = await connection.transaction();
    try {
        let records = await connection.select("status").from("Task").where({TaskId: taskId}).andWhere(function() {
            this.where({ClientOrganizationId: organizationId}).orWhere({RecipientOrganizationId: organizationId})
        });
        if(records.length != 1) {
            throw ErrorResponse(ErrorCode.NotFoundError, "Not found.");
        }
        let status = records[0].status;
        if(status != "Unread") {
            throw ErrorResponse(ErrorCode.RequestError, "The work cannot be cancelled because it has already been started.");
        }
        await transaction("Task").delete().where({TaskId: taskId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}