/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../../utility/database.js";
import { ErrorResponse, ErrorCode, writeError } from "arbuscular";
import { formatToIso8601String } from "../../utility/date-utils.js";
import { hasProductFootprintPrivilege } from "../authorization.js";

/**
 * @type {import("arbuscular").handle}
 */
export async function getProductFootprints(session, request) {
    let organizationId = session.organizationId;
    let userId = session.userId;

    let limit;
    let limitOffset;
    let filter;
    let dataId;
    if(request != null) {
        limit = request.limit;
        limitOffset = request.limitOffset;
        filter = request.$filter;
        dataId = request.id;
    }

    let organizations = await connection.select("parentOrganizationId").from("Organization").where({OrganizationId: organizationId});
    if(organizations.length != 1) {
        throw ErrorResponse(ErrorCode.AuthorizationError, JSON.stringify({code: "AccessDenied", message: "Invalid organization."}));
    }
    let parentOrganizationId = organizations[0].parentOrganizationId;

    let filters = null;
    if(filter != null) {
        filters = parseFilter(filter);
        if(filters == null || filters.length == 0) {
            throw ErrorResponse(ErrorCode.StateError, "Failed to parse the filter.");
        }
    }

    if(dataId == null) {
        let productFootprints = await restoreProductFootprints(userId, organizationId, parentOrganizationId, filters, limit, limitOffset);
        let results = await Promise.all(productFootprints.map(async productFootprint => {
            return await convertProductFootprint(productFootprint);
        }));
        return {data: results};
    }else {
        let productFootprint = await restoreProductFootprint(userId, organizationId, parentOrganizationId, dataId);
        if(productFootprint == null) {
            throw ErrorResponse(ErrorCode.NotFoundError, JSON.stringify({code: "NoSuchFootprint", message: "Product footprint for the specified ID could not be found."}));
        }
        let result = await convertProductFootprint(productFootprint);
        return {data: result};
    }
}

/**
 * 
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {number | null} parentOrganizationId 
 * @param {Array<Operation | JoinedOperation> | null} filters 
 * @param {number} limit 
 * @param {number} limitOffset 
 * @returns {Promise<Array<import("../../../types/productFootprint.d.ts").ProductFootprint>>}
 */
export async function restoreProductFootprints(userId, organizationId, parentOrganizationId, filters, limit, limitOffset) {
    if(!(await hasProductFootprintPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, JSON.stringify({code: "AccessDenied", message: "Invalid user."}));
    }

    let query = createProductFootprintQuery(organizationId, parentOrganizationId);

    if(filters != null && filters.length > 0) {
        query.andWhere(function() {
            filters.forEach(filter => {
                addQueryWithFilter(filter, this);
            });
        });
    }

    if(limit != null) {
        query.limit(limit);
        if(limitOffset != null) {
            query.offset(limitOffset);
        }
    }

    let results = await query;
    
    return results;
}

/**
 * @param {number} userId 
 * @param {number} organizationId 
 * @param {number | null} parentOrganizationId 
 * @param {string} [dataId] 
 * @param {number} [productFootprintId] 
 * @returns {Promise<import("../../../types/productFootprint.d.ts").ProductFootprint>}
 */
export async function restoreProductFootprint(userId, organizationId, parentOrganizationId, dataId, productFootprintId) {
    if(!(await hasProductFootprintPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, JSON.stringify({code: "AccessDenied", message: "Invalid user."}));
    }

    let query = createProductFootprintQuery(organizationId, parentOrganizationId);

    if(dataId != null) {
        query.andWhere({DataId: dataId});
    }else if(productFootprintId != null) {
        query.andWhere({ProductFootprintId: productFootprintId});
    }
    
    let productFootprints = await query;
    if(productFootprints.length == 0) {
        throw ErrorResponse(ErrorCode.NotFoundError, JSON.stringify({code: "NoSuchFootprint", message: "The requested product footprint was not in this system."}));
    }
    let productFootprint = productFootprints.find(productFootprint => productFootprint.status == "Active");
    if(productFootprint == null) {
        writeError(`Product footprints were successfully obtained but there were no Active`);
        throw ErrorResponse(ErrorCode.StateError, JSON.stringify({code: "InternalError", message: "A problem occurred while obtaining the product footprint. Please contact your administrator."}));
    }
    return productFootprint;
}

/**
 * @param {number} organizationId 
 * @param {number|null} parentOrganizationId 
 * @returns {import("knex").Knex.QueryBuilder}
 */
function createProductFootprintQuery(organizationId, parentOrganizationId) {
    let query = connection.select(
        "productFootprintId",
        "dataId",
        "version",
        "updatedDate",
        "status",
        "statusComment",
        "availableStartDate",
        "availableEndDate",
        "ProductFootprint.OrganizationId as organizationId",
        "organizationName",
        "ProductFootprint.ProductId as productId",
        "productName",
        "cpcCode",
        "description",
        "comment",
        "ProductFootprint.AmountUnit as amountUnit",
        "ProductFootprint.Amount as amount",
        "carbonFootprint",
        "carbonFootprintIncludingBiogenic",
        "fossilEmissions",
        "fossilCarbonContent",
        "biogenicCarbonContent",
        "dLucEmissions",
        "landManagementEmissions",
        "otherBiogenicEmissions",
        "iLucGhgEmissions",
        "biogenicRemoval",
        "aircraftEmissions",
        "biogenicAccountingStandard",
        "boundaryProcesses",
        "measurementStartDate",
        "measurementEndDate",
        "region",
        "country",
        "subdivision",
        "exemptedEmissionsRate",
        "exemptedEmissionsReason",
        "packagingGhgEmissions",
        "allocationRules",
        "uncertaintyAssessment",
        "primaryDataShare"
    ).from("ProductFootprint")
    .leftJoin("Organization", "Organization.OrganizationId", "ProductFootprint.OrganizationId")
    .leftJoin("Product", "Product.ProductId", "ProductFootprint.ProductId");

    if(parentOrganizationId != null) {
        query.where({"ProductFootprint.OrganizationId": parentOrganizationId});
    }else {
        query.where({"ProductFootprint.OrganizationId": organizationId});
    }

    return query;
}

/**
 * @param {import("../../../types/productFootprint.d.ts").ProductFootprint} productFootprint 
 * @returns {Promise<object>}
 */
export async function convertProductFootprint(productFootprint) {
    let result = {
        id: productFootprint.dataId,
        specVersion: "2.2.0",
        precedingPfIds: undefined,
        version: convertValue(productFootprint, "version", null),
        created: convertValue(productFootprint, "updatedDate", null, "date"),
        updated: undefined,
        status: convertValue(productFootprint, "status", null),
        statusComment: convertValue(productFootprint, "statusComment", undefined),
        validityPeriodStart: convertValue(productFootprint, "availableStartDate", undefined, "date"),
        validityPeriodEnd: convertValue(productFootprint, "availableEndDate", undefined, "date"),
        companyName: convertValue(productFootprint, "organizationName", null),
        /** @type {Array<string>} */
        companyIds: [],
        productDescription: convertValue(productFootprint, "description", ""),
        /** @type {Array<string>} */
        productIds: [],
        productCategoryCpc: convertValue(productFootprint, "cpcCode", ""),
        productNameCompany: convertValue(productFootprint, "productName", null),
        comment: convertValue(productFootprint, "comment", ""),
        pcf: {
            declaredUnit: convertAmountUnit(productFootprint.amountUnit),
            unitaryProductAmount: convertValue(productFootprint, "amount", null),
            pCfExcludingBiogenic: convertValue(productFootprint, "carbonFootprint", null),
            pCfIncludingBiogenic: convertValue(productFootprint, "carbonFootprintIncludingBiogenic", undefined),
            fossilGhgEmissions: convertValue(productFootprint, "fossilEmissions", null),
            fossilCarbonContent: convertValue(productFootprint, "fossilCarbonContent", null),
            biogenicCarbonContent: convertValue(productFootprint, "biogenicCarbonContent", null),
            dLucGhgEmissions: convertValue(productFootprint, "dLucEmissions", undefined),
            landManagementGhgEmissions: convertValue(productFootprint, "landManagementEmissions", undefined),
            otherBiogenicGhgEmissions: convertValue(productFootprint, "otherBiogenicEmissions", undefined),
            iLucGhgEmissions: convertValue(productFootprint, "iLucGhgEmissions", undefined),
            biogenicCarbonWithdrawal: convertValue(productFootprint, "biogenicRemoval", undefined),
            aircraftGhgEmissions: convertValue(productFootprint, "aircraftEmissions", undefined),
            /** @type {string} */
            characterizationFactors: "AR6",
            /** @type {Array<string>} */
            ipccCharacterizationFactorsSources: [],
            /** @type {Array<string>} */
            crossSectoralStandardsUsed : [],
            /** @type {Array<object>|undefined} */
            productOrSectorSpecificRules : undefined,
            biogenicAccountingMethodology: convertValue(productFootprint, "biogenicAccountingStandard", undefined),
            boundaryProcessesDescription: convertValue(productFootprint, "boundaryProcesses", null),
            referencePeriodStart: convertValue(productFootprint, "measurementStartDate", null, "date"),
            referencePeriodEnd: convertValue(productFootprint, "measurementEndDate", null, 'date'),
            geographyCountrySubdivision: convertValue(productFootprint, "subdivision", undefined),
            geographyCountry: convertValue(productFootprint, "country", undefined),
            geographyRegionOrSubregion: convertValue(productFootprint, "region", undefined),
            /** @type {Array<object>|undefined} */
            secondaryEmissionFactorSources: undefined,
            exemptedEmissionsPercent: convertValue(productFootprint, "exemptedEmissionsRate", null, "number"),
            exemptedEmissionsDescription: convertValue(productFootprint, "exemptedEmissionsReason", null),
            packagingEmissionsIncluded: productFootprint.packagingGhgEmissions != null,
            packagingGhgEmissions: convertValue(productFootprint, "packagingGhgEmissions", undefined),
            allocationRulesDescription: convertValue(productFootprint, "allocationRules", undefined),
            uncertaintyAssessmentDescription: convertValue(productFootprint, "uncertaintyAssessment", undefined),
            primaryDataShare: convertValue(productFootprint, "primaryDataShare", undefined, "number"),
            dqi: undefined,
            assurance: undefined
        },
        extensions: undefined
    };

    let organizationIds = await connection.select("type", "code").from("OrganizationIdentifier").where({OrganizationId: productFootprint.organizationId});
    result.companyIds = convertOrganizationIdentifiers(organizationIds);

    let productIds = await connection.select("type", "code").from("ProductIdentifier").where({ProductId: productFootprint.productId});
    result.productIds = convertProductIdentifiers(productIds);

    result.pcf.ipccCharacterizationFactorsSources = (await connection.select("reportType").from("GwpReport").where({ProductFootprintId: productFootprint.productFootprintId})).map(entry => entry.reportType);
    if(result.pcf.ipccCharacterizationFactorsSources.length > 0) {
        result.pcf.characterizationFactors = result.pcf.ipccCharacterizationFactorsSources[0];
    }

    result.pcf.crossSectoralStandardsUsed  = (await connection.select("standard").from("AccountingStandard").where({ProductFootprintId: productFootprint.productFootprintId})).map(entry => {
        if(entry.standard == "GHGProtocol") {
            return "GHG Protocol Product standard";
        }else if(entry.standard == "ISO14067") {
            return "ISO Standard 14067";
        }else if(entry.standard == "ISO14044") {
            return "ISO Standard 14044";
        }else {
            throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
        }
    });

    let carbonAccountingRules = await connection.select("operator","ruleNames","operatorName").from("CarbonAccountingRuleReference").leftJoin("CarbonAccountingRule","CarbonAccountingRule.CarbonAccountingRuleId","CarbonAccountingRuleReference.CarbonAccountingRuleId").where({ProductFootprintId: productFootprint.productFootprintId});
    if(carbonAccountingRules.length > 0) {
        result.pcf.productOrSectorSpecificRules = carbonAccountingRules.map(carbonAccountingRule => {
            carbonAccountingRule.ruleNames = carbonAccountingRule.ruleNames.split(",");
            return carbonAccountingRule;
        });
    }

    let inventoryDatabases = await connection.select("EmissionFactorCategory.EmissionFactorCategoryId as emissionFactorCategoryId", "emissionFactorCategoryName","version").from("InventoryDatabaseReference").leftJoin("EmissionFactorCategory", "EmissionFactorCategory.EmissionFactorCategoryId", "InventoryDatabaseReference.EmissionFactorCategoryId").where({ProductFootprintId: productFootprint.productFootprintId});
    if(inventoryDatabases.length > 0) {
        result.pcf.secondaryEmissionFactorSources = inventoryDatabases;
    }

    let dataQualityIndicators = await connection.select("coverage","ter","tir","ger","completeness","reliability").from("DataQualityIndicator").where({ProductFootprintId: productFootprint.productFootprintId});
    if(dataQualityIndicators.length == 1) {
        if(dataQualityIndicators[0].coverage != null) {
            dataQualityIndicators[0].coverage = Number(dataQualityIndicators[0].coverage);
        }
        result.pcf.dqi = dataQualityIndicators[0];
    }

    let assurances = await connection.select("coverage","level","boundary","providerName","updatedDate","standard","comments").from("Assurance").where({ProductFootprintId: productFootprint.productFootprintId});
    if(assurances.length == 1) {
        if(assurances[0].coverage != null) {
            assurances[0].coverage = Number(assurances[0].coverage);
        }
        result.pcf.assurance = assurances[0];
    }

    return result;
}

/**
 * @typedef {object} Identifier
 * @property {string} type
 * @property {string} code
 */

/**
 * @param {Array<Identifier>} identifiers 
 * @returns {Array<string>}
 */
export function convertOrganizationIdentifiers(identifiers) {
    return identifiers.map(identifier => {
        if(identifier.type == "UUID") {
            return `urn:uuid:${identifier.code}`;
        }else if(identifier.type == "SGLN") {
            return `urn:epc:id:sgln:${identifier.code}`;
        }else if(identifier.type == "LEI") {
            return `urn:lei:${identifier.code}`;
        }else if(identifier.type == "SupplierSpecific") {
            return `urn:pathfinder:company:customcode:vendor-assigned:${identifier.code}`;
        }else if(identifier.type == "BuyerSpecific") {
            return `urn:pathfinder:company:customcode:buyer-assigned:${identifier.code}`;
        }else {
            return null;
        }
    }).filter(identifier => identifier != null);
}

/**
 * @param {Array<Identifier>} identifiers 
 * @returns {Array<string>}
 */
export function convertProductIdentifiers(identifiers) {
    return identifiers.map(identifier => {
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
    }).filter(identifier => identifier != null);
}

/**
 * @param {object} record 
 * @param {string} key 
 * @param {any} initialValue
 * @param {"string" | "number" | "boolean" | "date"} [type] 
 * @returns {any}
 */
function convertValue(record, key, initialValue, type) {
    let value = record[key];
    if(value != null) {
        if(type == "number") {
            value = Number(value);
        }else if(type == "boolean") {
            value = value == 1;
        }else if(type == "date") {
            value = formatToIso8601String(value, true);
        }
    }
    return value != null ? value : initialValue;
}

/**
 * @param {string} amountUnit 
 * @returns {string}
 */
function convertAmountUnit(amountUnit) {
    return {
        "kg": "kilogram",
        "l": "liter",
        "cubic meter": "m3",
        "square meter": "m2",
        "kilowatt hour": "kWh",
        "megajoule": "MJ",
        "ton kilometer": "t-km"
    }[amountUnit];
}

/**
 * @typedef {object} Operation
 * @property {string} operand1
 * @property {">" | "<" | ">=" | "<=" | "=" | "!="} operator
 * @property {"any" | "all"} [collector]
 * @property {string} operand2
 */

/**
 * @typedef {object} JoinedOperation
 * @property {"and" | "or" | "and not" | "or not"} operator
 * @property {Operation | JoinedOperation} operation
 */

/**
 * @param {string} source 
 * @returns {Array<Operation | JoinedOperation> | null}
 */
function parseFilter(source) {
    source = source.trim();
    
    // 0: operand1, 1: operator, 2: operand2
    let state = 0;
    // 0: number, 1: string
    let type = 0;
    let join;
    let group = 0;
    let skip = false;
    let value = "";
    let operand1;
    let operand2;
    /** @type {">" | "<" | ">=" | "<=" | "=" | "!=" | undefined} */
    let operator;
    /** @type {"any" | "all" | undefined} */
    let collector;

    let i;
    for(i=0; i<source.length; i++) {
        let c = source.charAt(i);
        if(c == '(') {
            group++;
            if(value.endsWith("any")) {
                skip = true;
                collector = "any";
                value = "";
            }else if(value.endsWith("all")) {
                skip = true;
                collector = "all";
                value = "";
            }
        }else if(c == ')') {
            group--;
            if(i == source.length-1) {
                operand2 = value;
            }
        }else if(state != 2 && c == '/') {
            if(value != null && value.length > 0) {
                if(operand1 == null) {
                    operand1 = value;
                }else {
                    operand1 += "."+value;
                }
                value = "";
            }
        }else if(type != 1 && c == ' ') {
            if(value != null && value.length > 0) {
                if(state == 0) {
                    if(value == "and") {
                        join = value;
                        value = "";
                    }else if(value == "or") {
                        join = value;
                        value = "";
                    }else if(value == "not") {
                        if(join == "and") {
                            join = "and not";
                        }else if(join == "or") {
                            join = "or not";
                        }
                        value = "";
                    }else {
                        if(operand1 == null) {
                            operand1 = value;
                        }else {
                            operand1 += "."+value;
                        }
                        state = 1;
                        value = "";
                    }
                }else if(state == 1) {
                    if(value == "gt") {
                        operator = ">";
                    }else if(value == "lt") {
                        operator = "<";
                    }else if(value == "ge") {
                        operator = ">=";
                    }else if(value == "le") {
                        operator = "<=";
                    }else if(value == "eq") {
                        operator = "=";
                    }else if(value == "ne") {
                        operator = "!=";
                    }
                    state = 2;
                    value = "";
                }else if(state == 2) {
                    operand2 = value;
                    break;
                }
            }else {
                if(state == 0 && skip) {
                    state = 1;
                    skip = false;
                }
            }
        }else if(state == 2 && c == '\'') {
            if(operand2 == null && type == 0) {
                type = 1;
            }else if(operand2 == null && type == 1) {
                operand2 = value;
                break;
            }
        }else {
            if(!skip) {
                value += c;
            }
            if(i == source.length-1) {
                operand2 = value;
            }
        }
    }
    if(operand1 === undefined || operand2 === undefined || operator === undefined) {
        return null;
    }
    /** @type {Operation | JoinedOperation} */
    let result;
    if(join === undefined) {
        result = {operand1, operator, operand2};
        if(collector !== undefined) {
            result.collector = collector;
        }
    }else {
        result = /** @type {Operation | JoinedOperation} */({operator: join, operation: {operand1, operator, operand2}});
    }
    /** @type {Array<Operation | JoinedOperation>} */
    let results = [result];
    if(i < source.length-1) {
        let _results = parseFilter(source.substring(i+1));
        if(_results != null) {
            results = results.concat(_results);
        }
    }
    return results;
}

/**
 * @param {Operation | JoinedOperation} filter 
 * @param {import("knex").Knex.QueryBuilder} query
 */
function addQueryWithFilter(filter, query) {
    /** @type {"and" | "or" | "and not" | "or not" | undefined} */
    let conjunction;
    /** @type {Operation} */
    let operation;
    if(filter["operand1"] == null) {
        conjunction = /** @type {"and" | "or" | "and not" | "or not"} */(filter.operator);
        operation = filter["operation"];
    }else {
        operation = /** @type {Operation} */(filter);
    }

    /**
     * @param {Operation} operation 
     * @returns {import("knex").Knex.QueryBuilder} 
     */
    function getOrganizationQuery(operation) {
        let value = operation.operand2;
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
            throw ErrorResponse(ErrorCode.RequestError, "Invalid query string.");
        }
        return connection.select("OrganizationId").from("OrganizationIdentifier").where({Type: type, Code: code});
    }

    /**
     * @param {Operation} operation 
     * @returns {import("knex").Knex.QueryBuilder} 
     */
    function getProductQuery(operation) {
        let value = operation.operand2;
        let type;
        let code;
        if(value.startsWith("urn:uuid:")) {
            type = "UUID";
            code = value.substring("urn:uuid:".length);
        }else if(value.startsWith("urn:epc:id:sgtin:")) {
            type = "SGTIN";
            code = value.substring("urn:epc:id:sgtin:".length);
        }else if(value.startsWith("urn:pathfinder:product:customcode:vendor-assigned:")) {
            type = "SupplierSpecific";
            code = value.substring("urn:pathfinder:product:customcode:vendor-assigned:".length);
        }else if(value.startsWith("urn:pathfinder:product:customcode:buyer-assigned:")) {
            type = "BuyerSpecific";
            code = value.substring("urn:pathfinder:product:customcode:buyer-assigned:".length);
        }else {
            throw ErrorResponse(ErrorCode.RequestError, "Invalid query string.");
        }
        return connection.select("ProductId").from("ProductIdentifier").where({Type: type, Code: code});
    }

    let property = {
        "id": {name: "ProductFootprintId", type: "string"},
        "specVersion": null,
        "precedingPfIds": {name: "PreviousProductFootprintId", type: "string"},
        "version": {name: "Version", type: "number"},
        "created": {name: "UpdatedDate", type: "date"},
        "updated": {name: "UpdatedDate", type: "date"},
        "status": {name: "Status", type: "string"},
        "statusComment": {name: "StatusComment", type: "string"},
        "validityPeriodStart": {name: "AvailableStartDate", type: "date"},
        "validityPeriodEnd": {name: "AvailableEndDate", type: "date"},
        "companyName": {name: "OrganizationName", type: "string"},
        "companyIds": {name: "ProductFootprint.OrganizationId", subquery: operation => {
            return getOrganizationQuery(operation);
        }},
        "productDescription": {name: "Description", type: "string"},
        "productIds": {name: "ProductFootprint.ProductId", subquery: operation => {
            return getProductQuery(operation);
        }},
        "productCategoryCpc": {name: "CpcCode", type: "string"},
        "productNameCompany": {name: "ProductName", type: "string"},
        "comment": {name: "Comment", type: "string"},
        "pcf.declaredUnit": {name: "", type: "string"},
        "pcf.unitaryProductAmount": {name: "", type: "string"},
        "pcf.pCfExcludingBiogenic": {name: "", type: "string"},
        "pcf.pCfIncludingBiogenic": {name: "", type: "string"},
        "pcf.fossilGhgEmissions": {name: "", type: "string"},
        "pcf.fossilCarbonContent": {name: "", type: "string"},
        "pcf.biogenicCarbonContent": {name: "", type: "string"},
        "pcf.dLucGhgEmissions": {name: "", type: "string"},
        "pcf.landManagementGhgEmissions": {name: "", type: "string"},
        "pcf.otherBiogenicGhgEmissions": {name: "", type: "string"},
        "pcf.iLucGhgEmissions": {name: "", type: "string"},
        "pcf.biogenicCarbonWithdrawal": {name: "", type: "string"},
        "pcf.aircraftGhgEmissions": {name: "", type: "string"},
        "pcf.characterizationFactors": {name: "", type: "string"},
        "pcf.ipccCharacterizationFactorsSources": {name: "", type: "string"},
        "pcf.crossSectoralStandardsUsed": {name: "", type: "string"},
        "pcf.productOrSectorSpecificRules.operator": {name: "", type: "string"},
        "pcf.productOrSectorSpecificRules.ruleNames": {name: "", type: "string"},
        "pcf.productOrSectorSpecificRules.otherOperatorName": {name: "", type: "string"},
        "pcf.biogenicAccountingMethodology": {name: "", type: "string"},
        "pcf.boundaryProcessesDescription": {name: "", type: "string"},
        "pcf.referencePeriodStart": {name: "", type: "date"},
        "pcf.referencePeriodEnd": {name: "", type: "date"},
        "pcf.geographyCountrySubdivision": {name: "", type: "string"},
        "pcf.geographyCountry": {name: "", type: "string"},
        "pcf.geographyRegionOrSubregion": {name: "", type: "string"},
        "pcf.secondaryEmissionFactorSources.name": {name: "", type: "string"},
        "pcf.secondaryEmissionFactorSources.version": {name: "", type: "string"},
        "pcf.exemptedEmissionsPercent": {name: "", type: "number"},
        "pcf.exemptedEmissionsDescription": {name: "", type: "string"},
        "pcf.packagingEmissionsIncluded": {name: "", type: "boolean"},
        "pcf.packagingGhgEmissions": {name: "", type: "string"},
        "pcf.allocationRulesDescription": {name: "", type: "string"},
        "pcf.uncertaintyAssessmentDescription": {name: "", type: "string"},
        "pcf.primaryDataShare ": {name: "", type: "number"},
        "pcf.dqi.coveragePercent": {name: "", type: "number"},
        "pcf.dqi.technologicalDQR": {name: "", type: "string"},
        "pcf.dqi.temporalDQR": {name: "", type: "string"},
        "pcf.dqi.geographicalDQR": {name: "", type: "string"},
        "pcf.dqi.completenessDQR": {name: "", type: "string"},
        "pcf.dqi.reliabilityDQR": {name: "", type: "string"},
        "pcf.assurance.assurance": {name: "", type: "string"},
        "pcf.assurance.coverage": {name: "", type: "string"},
        "pcf.assurance.level": {name: "", type: "string"},
        "pcf.assurance.boundary": {name: "", type: "string"},
        "pcf.assurance.providerName": {name: "", type: "string"},
        "pcf.assurance.completedAt": {name: "", type: "string"},
        "pcf.assurance.standardName": {name: "", type: "string"},
        "pcf.assurance.comments": {name: "", type: "string"}
    }[operation.operand1];
    if(property == null) return;

    /** @type {any} */
    let value = operation.operand2;
    if(property.type == "number") {
        value = Number(value);
    }else if(property.type == "date") {
        value = new Date(value);
    }else if(property.type == "boolean") {
        value = value == "true";
    }

    if(conjunction == null) {
        if(property.subquery != null) {
            let subquery = property.subquery(operation);
            if(operation.operator == "=") {
                query.where(property.name, "in", subquery);
            }else if(operation.operator == "!=") {
                query.where(property.name, "not in", subquery);
            }else {
                throw ErrorResponse(ErrorCode.RequestError, "Invalid query string.");
            }
        }else {
            query.where(property.name, operation.operator, value);
        }
    }else {
        if(property.subquery != null) {
            let subquery = property.subquery(operation);
            if(operation.operator == "=") {
                if(conjunction == "and") {
                    query.andWhere(property.name, "in", subquery);
                }else if(conjunction == "or") {
                    query.orWhere(property.name, "in", subquery);
                }else if(conjunction == "and not") {
                    query.andWhereNot(property.name, "in", subquery);
                }else if(conjunction == "or not") {
                    query.orWhereNot(property.name, "in", subquery);
                }
            }else if(operation.operator == "!=") {
                if(conjunction == "and") {
                    query.andWhere(property.name, "not in", subquery);
                }else if(conjunction == "or") {
                    query.orWhere(property.name, "not in", subquery);
                }else if(conjunction == "and not") {
                    query.andWhereNot(property.name, "not in", subquery);
                }else if(conjunction == "or not") {
                    query.orWhereNot(property.name, "not in", subquery);
                }
            }else {
                throw ErrorResponse(ErrorCode.RequestError, "Invalid query string.");
            }
        }else {
            if(conjunction == "and") {
                query.andWhere(property.name, operation.operator, value);
            }else if(conjunction == "or") {
                query.orWhere(property.name, operation.operator, value);
            }else if(conjunction == "and not") {
                query.andWhereNot(property.name, operation.operator, value);
            }else if(conjunction == "or not") {
                query.orWhereNot(property.name, operation.operator, value);
            }
        }
    }
}

let exports = {};
if(process.env.NODE_ENV === "test") {
    exports.parseFilter = parseFilter;
}
export default exports;