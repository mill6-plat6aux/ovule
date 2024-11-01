/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { v4 as uuid } from "uuid";
import { writeLog } from "arbuscular";
import { restoreDataSource } from "../datasource-manager.js";
import { formatToIso8601String } from "../../utility/date-utils.js";
import { convertOrganizationIdentifiers } from "../pathfinder/product-footprint-manager.js";
import { getOrganization } from "../organization-manager.js";
import { contextPath, getAccessToken } from "../pathfinder/event-manager.js";
import { requestToRemote } from "./contract-manager.js";

/**
 * @param {number} userId 
 * @param {number} organizationId 
 */
export async function syncOrganizationToHarmony(userId, organizationId) {
    let harmonyDataSource = await restoreDataSource(organizationId, undefined, undefined, undefined, "Harmony");
    if(harmonyDataSource == null) return;
    let authenticateEndpoint = harmonyDataSource.endpoints.find(endpoint => endpoint.type == "Authenticate");
    let updateEventEndpoint = harmonyDataSource.endpoints.find(endpoint => endpoint.type == "UpdateEvent");
    if(authenticateEndpoint == null || updateEventEndpoint == null) return;

    let organization = await getOrganization({userId, organizationId}, undefined);

    let accessToken = await getAccessToken(authenticateEndpoint.url, harmonyDataSource.userName, harmonyDataSource.password);

    await requestToRemote("post", updateEventEndpoint.url, accessToken, "application/cloudevents+json; charset=UTF-8", {
        type: "org.wbcsd.pathfinder.Company.Updated.v1",
        specversion: "1.0",
        id: uuid(),
        source: contextPath.substring(contextPath.indexOf(":")+1) + "/harmony" + "/2/events",
        time: formatToIso8601String(new Date(), true),
        data: {
            companyName: organization.organizationName,
            companyIds: convertOrganizationIdentifiers(organization.identifiers)
        }
    });
    writeLog("User for access from Harmony has been sent to Harmony.");
}