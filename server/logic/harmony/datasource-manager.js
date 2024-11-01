/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { readFileSync } from "fs";
import { sep } from "path";
import { writeLog } from "arbuscular";
import { restoreDataSource } from "../datasource-manager.js";
import { constants, publicEncrypt } from "crypto";
import { contextPath, getAccessToken } from "../pathfinder/event-manager.js";
import { requestToRemote } from "./contract-manager.js";

const harmonyPublicKey = readFileSync("credentials"+sep+"harmony-public-key.pem");

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {string} userName 
 * @param {string} password 
 */
export async function sendDataSourceToHarmony(userId, organizationId, userName, password) {
    let harmonyDataSource = await restoreDataSource(organizationId, undefined, undefined, undefined, "Harmony");
    if(harmonyDataSource == null) return;
    let authenticateEndpoint = harmonyDataSource.endpoints.find(endpoint => endpoint.type == "Authenticate");
    let updateDataSourceEndpoint = harmonyDataSource.endpoints.find(endpoint => endpoint.type == "UpdateDataSource");
    if(authenticateEndpoint == null || updateDataSourceEndpoint == null) return;
    let accessToken = await getAccessToken(authenticateEndpoint.url, harmonyDataSource.userName, harmonyDataSource.password);
    let dataSource = {
        userName: encrypt(userName),
        password: encrypt(password),
        endpoints: [
            { type: "Authenticate", url: encrypt(contextPath + "/harmony/auth/token") },
            { type: "UpdateEvent", url: encrypt(contextPath + "/harmony/2/events") }
        ]
    };
    await requestToRemote("post", updateDataSourceEndpoint.url, accessToken, "application/json", dataSource);
    writeLog("User for access from Harmony has been sent to Harmony.");
}

/**
 * @param {string} string 
 * @returns {string}
 */
function encrypt(string) {
    let encryptedData = publicEncrypt({ key: harmonyPublicKey, padding: constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(string));
    return Buffer.from(encryptedData).toString("base64");
}