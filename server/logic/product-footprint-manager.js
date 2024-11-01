/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { connection } from "../utility/database.js";
import { ErrorResponse, ErrorCode, writeLog, LogLevel } from "arbuscular";
import { hasProductFootprintPrivilege } from "./authorization.js";
import { v4 as uuid } from "uuid";
import { formatToIso8601String } from "../utility/date-utils.js"
import { sendNotification, sendReply } from "./pathfinder/event-manager.js";
import { restoreReceivedTasksByProduct, updateTask } from "./task-manager.js";
import { syncProductFootprintToHarmony } from "./harmony/product-footprint-manager.js";

/**
 * @type {import("arbuscular").handle}
 */
export async function getProductFootprints(session, request) {
    let userId = session.userId;
    if(!(await hasProductFootprintPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productId;
    if(request != null) {
        productId = request.productId;
    }
    let query = connection.select(
        "productFootprintId",
        "dataId",
        "version",
        "updatedDate",
        "status",
        "organizationId",
        "productId",
        "amountUnit",
        "carbonFootprint"
    ).from("ProductFootprint")
    .where(function() {
        this.where({OrganizationId: organizationId})
        .orWhereIn("OrganizationId", function() {
            this.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId})
        })
    })
    .orderBy("updatedDate", "desc");
    if(productId != null) {
        query.andWhere({ProductId: productId});
    }
    return await query;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function getProductFootprint(session, request) {
    let userId = session.userId;
    if(!(await hasProductFootprintPrivilege(userId, "Read"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productFootprintId = request.productFootprintId;
    return restoreProductFootprint(organizationId, productFootprintId);
}

/**
 * @param {number} organizationId 
 * @param {number} productFootprintId 
 * @returns {Promise<import("../../types/productFootprint.d.ts").ProductFootprint>}
 */
async function restoreProductFootprint(organizationId, productFootprintId) {
    let productFootprints = await connection.select(
        "productFootprintId",
        "dataId",
        "version",
        "updatedDate",
        "status",
        "statusComment",
        "availableStartDate",
        "availableEndDate",
        "organizationId",
        "productId",
        "comment",
        "amountUnit",
        "amount",
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
    .where(function() {
        this.where({OrganizationId: organizationId})
        .orWhereIn("OrganizationId", function() {
            this.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId})
        })
    })
    .andWhere({ProductFootprintId: productFootprintId});
    if(productFootprints.length == 0) {
        throw ErrorResponse(ErrorCode.NotFoundError, "Not found.");
    }
    let productFootprint = productFootprints[0];
    
    // Date type cast
    productFootprint.updatedDate = formatToIso8601String(productFootprint.updatedDate);
    if(productFootprint.availableStartDate != null) {
        productFootprint.availableStartDate = formatToIso8601String(productFootprint.availableStartDate, true);
    }
    if(productFootprint.availableEndDate != null) {
        productFootprint.availableEndDate = formatToIso8601String(productFootprint.availableEndDate, true);
    }
    if(productFootprint.measurementStartDate != null) {
        productFootprint.measurementStartDate = formatToIso8601String(productFootprint.measurementStartDate, true);
    }
    if(productFootprint.measurementEndDate != null) {
        productFootprint.measurementEndDate = formatToIso8601String(productFootprint.measurementEndDate, true);
    }

    // Cast string type to numeric type
    if(productFootprint.exemptedEmissionsRate != null) {
        productFootprint.exemptedEmissionsRate = Number(productFootprint.exemptedEmissionsRate);
    }
    if(productFootprint.primaryDataShare != null) {
        productFootprint.primaryDataShare = Number(productFootprint.primaryDataShare);
    }

    productFootprint.gwpReports = (await connection.select("reportType").from("GwpReport").where({ProductFootprintId: productFootprint.productFootprintId})).map(entry => entry.reportType);

    productFootprint.accountingStandards = (await connection.select("standard").from("AccountingStandard").where({ProductFootprintId: productFootprint.productFootprintId})).map(entry => entry.standard);

    let carbonAccountingRules = await connection.select(
        "operator",
        "ruleNames",
        "operatorName"
    )
    .from("CarbonAccountingRuleReference")
    .leftJoin("CarbonAccountingRule","CarbonAccountingRule.CarbonAccountingRuleId","CarbonAccountingRuleReference.CarbonAccountingRuleId")
    .where({ProductFootprintId: productFootprint.productFootprintId});
    if(carbonAccountingRules.length > 0) {
        productFootprint.carbonAccountingRules = carbonAccountingRules.map(carbonAccountingRule => {
            carbonAccountingRule.ruleNames = carbonAccountingRule.ruleNames.split(",");
            return carbonAccountingRule;
        });
    }else {
        productFootprint.carbonAccountingRules = null;
    }

    let inventoryDatabases = await connection.select(
        "EmissionFactorCategory.EmissionFactorCategoryId as emissionFactorCategoryId", 
        "emissionFactorCategoryName",
        "version"
    )
    .from("InventoryDatabaseReference")
    .leftJoin("EmissionFactorCategory", "EmissionFactorCategory.EmissionFactorCategoryId", "InventoryDatabaseReference.EmissionFactorCategoryId")
    .where({ProductFootprintId: productFootprint.productFootprintId});
    if(inventoryDatabases.length > 0) {
        productFootprint.inventoryDatabases = inventoryDatabases;
    }else {
        productFootprint.inventoryDatabases = null;
    }

    let dataQualityIndicators = await connection.select(
        "coverage",
        "ter",
        "tir",
        "ger",
        "completeness",
        "reliability"
    )
    .from("DataQualityIndicator")
    .where({ProductFootprintId: productFootprint.productFootprintId});
    if(dataQualityIndicators.length == 1) {
        if(dataQualityIndicators[0].coverage != null) {
            dataQualityIndicators[0].coverage = Number(dataQualityIndicators[0].coverage);
        }
        productFootprint.dataQualityIndicator = dataQualityIndicators[0];
    }else {
        productFootprint.dataQualityIndicator = null;
    }

    let assurances = await connection.select(
        "coverage",
        "level",
        "boundary",
        "providerName",
        "updatedDate",
        "standard",
        "comments"
    )
    .from("Assurance")
    .where({ProductFootprintId: productFootprint.productFootprintId});
    if(assurances.length == 1) {
        if(assurances[0].coverage != null) {
            assurances[0].coverage = Number(assurances[0].coverage);
        }
        productFootprint.assurance = assurances[0];
    }else {
        productFootprint.assurance = null;
    }

    return productFootprint;
}

/**
 * @type {import("arbuscular").handle}
 */
export async function addProductFootprint(session, request) {
    let userId = session.userId;
    if(!(await hasProductFootprintPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let dataId = request.dataId != null ? request.dataId : uuid();
    let version = request.version;
    let updatedDate = new Date();
    let status = "Active";
    let statusComment = request.statusComment;
    let availableStartDate = request.availableStartDate;
    let availableEndDate = request.availableEndDate;
    let productId = request.productId;
    let comment = request.comment;
    let amountUnit = request.amountUnit;
    let amount = request.amount;
    let carbonFootprint = request.carbonFootprint;
    let carbonFootprintIncludingBiogenic = request.carbonFootprintIncludingBiogenic;
    let fossilEmissions = request.fossilEmissions;
    let fossilCarbonContent = request.fossilCarbonContent;
    let biogenicCarbonContent = request.biogenicCarbonContent;
    let dLucEmissions = request.dLucEmissions;
    let landManagementEmissions = request.landManagementEmissions;
    let otherBiogenicEmissions = request.otherBiogenicEmissions;
    let iLucGhgEmissions = request.iLucGhgEmissions;
    let biogenicRemoval = request.biogenicRemoval;
    let aircraftEmissions = request.aircraftEmissions;
    let gwpReports = request.gwpReports;
    let accountingStandards = request.accountingStandards;
    let carbonAccountingRules = request.carbonAccountingRules;
    let biogenicAccountingStandard = request.biogenicAccountingStandard;
    let boundaryProcesses = request.boundaryProcesses;
    let measurementStartDate = request.measurementStartDate;
    let measurementEndDate = request.measurementEndDate;
    let region = request.region;
    let country = request.country;
    let subdivision = request.subdivision;
    let inventoryDatabases = request.inventoryDatabases;
    let exemptedEmissionsRate = request.exemptedEmissionsRate;
    let exemptedEmissionsReason = request.exemptedEmissionsReason;
    let packagingGhgEmissions = request.packagingGhgEmissions;
    let allocationRules = request.allocationRules;
    let uncertaintyAssessment = request.uncertaintyAssessment;
    let primaryDataShare = request.primaryDataShare;
    let dataQualityIndicator = request.dataQualityIndicator;
    let assurance = request.assurance;
    if(measurementStartDate != null) {
        measurementStartDate = new Date(measurementStartDate);
    }
    if(measurementEndDate != null) {
        measurementEndDate = new Date(measurementEndDate);
    }
    if(availableStartDate != null) {
        availableStartDate = new Date(availableStartDate);
    }
    if(availableEndDate != null) {
        availableEndDate = new Date(availableEndDate);
    }
    
    let taskCheck = request.taskCheck != null ? request.taskCheck : true;
    let syncRequired = request.syncRequired != null ? request.syncRequired : true;

    let transaction = await connection.transaction();
    let productFootprintId;
    try {
        if(productId != null) {
            await transaction("ProductFootprint").update({Status: "Deprecated"}).where({ProductId: productId});
        }
        let ids = await transaction.insert({
            DataId: dataId,
            Version: version,
            UpdatedDate: updatedDate,
            Status: status,
            StatusComment: statusComment,
            AvailableStartDate: availableStartDate,
            AvailableEndDate: availableEndDate,
            OrganizationId: organizationId,
            ProductId: productId,
            Comment: comment,
            AmountUnit: amountUnit,
            Amount: amount,
            CarbonFootprint: carbonFootprint,
            CarbonFootprintIncludingBiogenic: carbonFootprintIncludingBiogenic,
            FossilEmissions: fossilEmissions,
            FossilCarbonContent: fossilCarbonContent,
            BiogenicCarbonContent: biogenicCarbonContent,
            DLucEmissions: dLucEmissions,
            LandManagementEmissions: landManagementEmissions,
            OtherBiogenicEmissions: otherBiogenicEmissions,
            ILucGhgEmissions: iLucGhgEmissions,
            BiogenicRemoval: biogenicRemoval,
            AircraftEmissions: aircraftEmissions,
            BiogenicAccountingStandard: biogenicAccountingStandard,
            BoundaryProcesses: boundaryProcesses,
            MeasurementStartDate: measurementStartDate,
            MeasurementEndDate: measurementEndDate,
            Region: region,
            Country: country,
            Subdivision: subdivision,
            ExemptedEmissionsRate: exemptedEmissionsRate,
            ExemptedEmissionsReason: exemptedEmissionsReason,
            PackagingGhgEmissions: packagingGhgEmissions,
            AllocationRules: allocationRules,
            UncertaintyAssessment: uncertaintyAssessment,
            PrimaryDataShare: primaryDataShare
        }).into("ProductFootprint");
        if(ids.length != 1) throw ErrorResponse(ErrorCode.StateError, "Inserting failed.");
        productFootprintId = ids[0];
        if(gwpReports != null && gwpReports.length > 0) {
            await Promise.all(gwpReports.map(async gwpReport => {
                await transaction.insert({ProductFootprintId: productFootprintId, ReportType: gwpReport}).into("GwpReport");
            }));
        }
        if(accountingStandards != null && accountingStandards.length > 0) {
            await Promise.all(accountingStandards.map(async accountingStandard => {
                await transaction.insert({ProductFootprintId: productFootprintId, Standard: accountingStandard}).into("AccountingStandard");
            }));
        }
        if(carbonAccountingRules != null && carbonAccountingRules.length > 0) {
            await Promise.all(carbonAccountingRules.map(async carbonAccountingRule => {
                let ids = await transaction.insert({OrganizationId: organizationId, Operator: carbonAccountingRule.operator, RuleNames: carbonAccountingRule.ruleNames.join(","), OperatorName: carbonAccountingRule.operatorName}).into("CarbonAccountingRule");
                if(ids.length == 0) {
                    throw ErrorResponse(ErrorCode.StateError, "Inserting failed.");
                }
                let carbonAccountingRuleId = ids[0];
                await transaction.insert({ProductFootprintId: productFootprintId, CarbonAccountingRuleId: carbonAccountingRuleId}).into("CarbonAccountingRuleReference");
            }));
        }
        if(inventoryDatabases != null && inventoryDatabases.length > 0) {
            await Promise.all(inventoryDatabases.map(async inventoryDatabase => {
                await transaction.insert({ProductFootprintId: productFootprintId, EmissionFactorCategoryId: inventoryDatabase.emissionFactorCategoryId}).into("InventoryDatabaseReference");
            }));
        }
        if(dataQualityIndicator != null) {
            await transaction.insert({
                ProductFootprintId: productFootprintId, 
                Coverage: dataQualityIndicator.coverage,
                Ter: dataQualityIndicator.ter,
                Tir: dataQualityIndicator.tir,
                Ger: dataQualityIndicator.ger,
                Completeness: dataQualityIndicator.completeness,
                Reliability: dataQualityIndicator.reliability
            }).into("DataQualityIndicator");
        }
        if(assurance != null) {
            await transaction.insert({
                ProductFootprintId: productFootprintId, 
                Coverage: assurance.coverage,
                Level: assurance.level,
                Boundary: assurance.boundary,
                ProviderName: assurance.providerName,
                UpdatedDate: assurance.updatedDate,
                Standard: assurance.standard,
                Comments: assurance.comments
            }).into("Assurance");
        }
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }

    writeLog(`Product footprint [${productFootprintId}] has been registered by the user [${userId}].`);
    writeLog(`ProductFootprintId:${productFootprintId} OrganizationId:${organizationId} ProductId:${productId} DataId: ${dataId}`, LogLevel.debug);

    // If this product footprint is requested by another organization, a response will be sent.
    if(taskCheck && productId != null) {
        let tasks = await restoreReceivedTasksByProduct(userId, organizationId, productId);
        await Promise.all(tasks.map(async task => {
            if(task.taskId == null) return;

            await sendReply(userId, organizationId, productId, task.taskId);

            await updateTask({userId, organizationId}, {
                taskId: task.taskId,
                status: "Completed",
                replyMessage: null
            });
        }));
    }

    // If it is own product, sync it to Harmony
    if(syncRequired && productId != null) {
        let products = await connection.select("organizationId").from("OrganizationProduct").where({ProductId: productId});
        if(products.length == 0) {
            throw ErrorResponse(ErrorCode.StateError, "Invalid state.");
        }
        let product = products[0];
        if(organizationId == product.organizationId) {
            await syncProductFootprintToHarmony(userId, organizationId, dataId, productId);
        }
    }

    return {productFootprintId: productFootprintId};
}

/**
 * @type {import("arbuscular").handle}
 */
export async function updateProductFootprint(session, request) {
    let userId = session.userId;
    if(!(await hasProductFootprintPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productFootprintId = request.productFootprintId;
    let updatedDate = new Date();
    let status = "Active";
    let statusComment = request.statusComment;
    let availableStartDate = request.availableStartDate;
    let availableEndDate = request.availableEndDate;
    let productId = request.productId;
    let comment = request.comment;
    let amountUnit = request.amountUnit;
    let amount = request.amount;
    let carbonFootprint = request.carbonFootprint;
    let carbonFootprintIncludingBiogenic = request.carbonFootprintIncludingBiogenic;
    let fossilEmissions = request.fossilEmissions;
    let fossilCarbonContent = request.fossilCarbonContent;
    let biogenicCarbonContent = request.biogenicCarbonContent;
    let dLucEmissions = request.dLucEmissions;
    let landManagementEmissions = request.landManagementEmissions;
    let otherBiogenicEmissions = request.otherBiogenicEmissions;
    let iLucGhgEmissions = request.iLucGhgEmissions;
    let biogenicRemoval = request.biogenicRemoval;
    let aircraftEmissions = request.aircraftEmissions;
    let gwpReports = request.gwpReports;
    let accountingStandards = request.accountingStandards;
    let carbonAccountingRules = request.carbonAccountingRules;
    let biogenicAccountingStandard = request.biogenicAccountingStandard;
    let boundaryProcesses = request.boundaryProcesses;
    let measurementStartDate = request.measurementStartDate;
    let measurementEndDate = request.measurementEndDate;
    let region = request.region;
    let country = request.country;
    let subdivision = request.subdivision;
    let inventoryDatabases = request.inventoryDatabases;
    let exemptedEmissionsRate = request.exemptedEmissionsRate;
    let exemptedEmissionsReason = request.exemptedEmissionsReason;
    let packagingGhgEmissions = request.packagingGhgEmissions;
    let allocationRules = request.allocationRules;
    let uncertaintyAssessment = request.uncertaintyAssessment;
    let primaryDataShare = request.primaryDataShare;
    let dataQualityIndicator = request.dataQualityIndicator;
    let assurance = request.assurance;
    if(measurementStartDate != null) {
        measurementStartDate = new Date(measurementStartDate);
    }
    if(measurementEndDate != null) {
        measurementEndDate = new Date(measurementEndDate);
    }
    if(availableStartDate != null) {
        availableStartDate = new Date(availableStartDate);
    }
    if(availableEndDate != null) {
        availableEndDate = new Date(availableEndDate);
    }

    let updateCheck = request.updateCheck != null ? request.updateCheck : true;
    let notifyRequired = request.notifyRequired != null ? request.notifyRequired : true;
    let taskCheck = request.taskCheck != null ? request.taskCheck : true;
    let syncRequired = request.syncRequired != null ? request.syncRequired : true;

    let dataId;
    let transaction = await connection.transaction();
    try {
        let productFootprint = await restoreProductFootprint(organizationId, productFootprintId);

        dataId = productFootprint.dataId;
        let version = productFootprint.version;

        let verificationResults;
        if(updateCheck) {
            // Check for differences
            let verificationResults = verifyUpdate(productFootprint, request);
            if(verificationResults == VersionUpType.minor) {
                // For minor version upgrades, the version is incremented. 
                version = version+1;
            }else if(verificationResults == VersionUpType.major) {
                // For major version upgrades, set the status of past data to Deprecated.
                await transaction("ProductFootprint").update({Status: "Deprecated", UpdatedDate: new Date()}).where({ProductFootprintId: productFootprintId, OrganizationId: organizationId});
                dataId = uuid();
                version = 0;
            }else {
                return;
            }
        }else {
            verificationResults = VersionUpType.minor;
        }

        let record = {
            DataId: dataId,
            Version: version,
            UpdatedDate: updatedDate,
            Status: status,
            StatusComment: statusComment,
            AvailableStartDate: availableStartDate,
            AvailableEndDate: availableEndDate,
            OrganizationId: organizationId,
            ProductId: productId,
            Comment: comment,
            AmountUnit: amountUnit,
            Amount: amount,
            CarbonFootprint: carbonFootprint,
            CarbonFootprintIncludingBiogenic: carbonFootprintIncludingBiogenic,
            FossilEmissions: fossilEmissions,
            FossilCarbonContent: fossilCarbonContent,
            BiogenicCarbonContent: biogenicCarbonContent,
            DLucEmissions: dLucEmissions,
            LandManagementEmissions: landManagementEmissions,
            OtherBiogenicEmissions: otherBiogenicEmissions,
            ILucGhgEmissions: iLucGhgEmissions,
            BiogenicRemoval: biogenicRemoval,
            AircraftEmissions: aircraftEmissions,
            BiogenicAccountingStandard: biogenicAccountingStandard,
            BoundaryProcesses: boundaryProcesses,
            MeasurementStartDate: measurementStartDate,
            MeasurementEndDate: measurementEndDate,
            Region: region,
            Country: country,
            Subdivision: subdivision,
            ExemptedEmissionsRate: exemptedEmissionsRate,
            ExemptedEmissionsReason: exemptedEmissionsReason,
            PackagingGhgEmissions: packagingGhgEmissions,
            AllocationRules: allocationRules,
            UncertaintyAssessment: uncertaintyAssessment,
            PrimaryDataShare: primaryDataShare
        };

        if(verificationResults == VersionUpType.minor) {
            await transaction("ProductFootprint").update(record).where({ProductFootprintId: productFootprintId});
        }else {
            await transaction("ProductFootprint").update({Status: "Deprecated"}).where({ProductFootprintId: productFootprintId});
            let ids = await transaction.insert(record).into("ProductFootprint");
            if(ids.length != 1) throw ErrorResponse(ErrorCode.StateError, "Inserting failed.");
            productFootprintId = ids[0];
        }
        
        await transaction("GwpReport").delete().where({ProductFootprintId: productFootprintId});
        if(gwpReports != null && gwpReports.length > 0) {
            await Promise.all(gwpReports.map(async gwpReport => {
                await transaction.insert({ProductFootprintId: productFootprintId, ReportType: gwpReport}).into("GwpReport");
            }));
        }
        await transaction("AccountingStandard").delete().where({ProductFootprintId: productFootprintId});
        if(accountingStandards != null && accountingStandards.length > 0) {
            await Promise.all(accountingStandards.map(async accountingStandard => {
                await transaction.insert({ProductFootprintId: productFootprintId, Standard: accountingStandard}).into("AccountingStandard");
            }));
        }
        if(carbonAccountingRules != null && carbonAccountingRules.length > 0) {
            let carbonAccountingRuleReferences = await connection.select("carbonAccountingRuleId").from("CarbonAccountingRuleReference").where({ProductFootprintId: productFootprintId});
            await Promise.all(carbonAccountingRuleReferences.map(async carbonAccountingRuleReference => {
                await transaction("CarbonAccountingRule").delete().where({CarbonAccountingRuleId: carbonAccountingRuleReference.carbonAccountingRuleId});
            }));
            await Promise.all(carbonAccountingRules.map(async carbonAccountingRule => {
                let ids = await transaction.insert({OrganizationId: organizationId, Operator: carbonAccountingRule.operator, RuleNames: carbonAccountingRule.ruleNames.join(","), OperatorName: carbonAccountingRule.operatorName}).into("CarbonAccountingRule");
                if(ids.length == 0) {
                    throw ErrorResponse(ErrorCode.StateError, "Inserting failed.");
                }
                let carbonAccountingRuleId = ids[0];
                await transaction.insert({ProductFootprintId: productFootprintId, CarbonAccountingRuleId: carbonAccountingRuleId}).into("CarbonAccountingRuleReference");
            }));
        }
        await transaction("InventoryDatabaseReference").delete().where({ProductFootprintId: productFootprintId});
        if(inventoryDatabases != null && inventoryDatabases.length > 0) {
            await Promise.all(inventoryDatabases.map(async inventoryDatabase => {
                await transaction.insert({ProductFootprintId: productFootprintId, EmissionFactorCategoryId: inventoryDatabase.emissionFactorCategoryId}).into("InventoryDatabaseReference");
            }));
        }
        await transaction("DataQualityIndicator").delete().where({ProductFootprintId: productFootprintId});
        if(dataQualityIndicator != null) {
            await transaction.insert({
                ProductFootprintId: productFootprintId, 
                Coverage: dataQualityIndicator.coverage,
                Ter: dataQualityIndicator.ter,
                Tir: dataQualityIndicator.tir,
                Ger: dataQualityIndicator.ger,
                Completeness: dataQualityIndicator.completeness,
                Reliability: dataQualityIndicator.reliability
            }).into("DataQualityIndicator");
        }
        await transaction("Assurance").delete().where({ProductFootprintId: productFootprintId});
        if(assurance != null) {
            await transaction.insert({
                ProductFootprintId: productFootprintId, 
                Coverage: assurance.coverage,
                Level: assurance.level,
                Boundary: assurance.boundary,
                ProviderName: assurance.providerName,
                UpdatedDate: assurance.updatedDate,
                Standard: assurance.standard,
                Comments: assurance.comments
            }).into("Assurance");
        }
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }

    writeLog(`Product footprint [${productFootprintId}] has been updated by the user [${userId}].`);
    writeLog(`ProductFootprintId:${productFootprintId} OrganizationId:${organizationId} ProductId:${productId} DataId: ${dataId}`, LogLevel.debug);

    // If the product in question has a data source associated with it, notify that endpoint.
    if(notifyRequired && productId != null) {
        await sendNotification(userId, organizationId, null, productId, dataId);
    }

    // If this product footprint is requested by another organization, a response will be sent.
    if(productId != null) {
        if(taskCheck) {
            let tasks = await restoreReceivedTasksByProduct(userId, organizationId, productId);
            await Promise.all(tasks.map(async task => {
                if(task.taskId == null) return;
        
                await sendReply(userId, organizationId, productId, task.taskId);
        
                await updateTask({userId, organizationId}, {
                    taskId: task.taskId,
                    status: "Completed",
                    replyMessage: null
                });
            }));
        }
    
        if(syncRequired) {
            await syncProductFootprintToHarmony(userId, organizationId, dataId, productId);
        }
    }

    return {productFootprintId: productFootprintId};
}

/**
 * @type {import("arbuscular").handle}
 */
export async function deleteProductFootprint(session, request) {
    let userId = session.userId;
    if(!(await hasProductFootprintPrivilege(userId, "Write"))) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid access.");
    }
    let organizationId = session.organizationId;
    let productFootprintId = request.productFootprintId;
    let transaction = await connection.transaction();
    try {
        await transaction("ProductFootprint").delete().where({ProductFootprintId: productFootprintId}).andWhere(function() {
            this.where({OrganizationId: organizationId}).orWhereIn("OrganizationId", function() {
                this.select("organizationId").from("Organization").where({ParentOrganizationId: organizationId});
            })
        });
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}

const VersionUpType = {
    none: 0,
    minor: 1,
    major: 2
};

/**
 * @param {object} object1 
 * @param {object} object2 
 * @returns {number} 
 */
function verifyUpdate(object1, object2) {
    let propertiesForMinorUpdate = [
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
        "boundaryProcesses",
        "packagingGhgEmissions",
        "allocationRules",
        "uncertaintyAssessment",
        "primaryDataShare"
    ];

    let propertiesForMajorUpdate = [
        "availableStartDate",
        "availableEndDate",
        "comment",
        "amountUnit",
        "amount",
        "biogenicAccountingStandard",
        "measurementStartDate",
        "measurementEndDate",
        "region",
        "country",
        "subdivision",
        "exemptedEmissionsRate",
        "exemptedEmissionsReason"
    ];

    let result;

    // check for major update

    result = propertiesForMajorUpdate.findIndex(key => {
        let value1 = object1[key];
        let value2 = object2[key];
        return value1 != value2;
    });
    if(result != -1) {
        return VersionUpType.major;
    }

    let gwpReports1 = object1.gwpReports;
    let gwpReports2 = object2.gwpReports;
    if(gwpReports1 != null) {
        if(gwpReports2 != null) {
            result = gwpReports1.every(entry => gwpReports2.includes(entry));
            if(result) {
                result = gwpReports2.every(entry => gwpReports1.includes(entry));
            }
        }else {
            result = false;
        }
    }else {
        if(gwpReports2 != null) {
            result = false;
        }
    }
    if(!result) {
        return VersionUpType.major;
    }

    let accountingStandards1 = object1.accountingStandards;
    let accountingStandards2 = object2.accountingStandards;
    if(accountingStandards1 != null) {
        if(accountingStandards2 != null) {
            result = accountingStandards1.every(entry => accountingStandards2.includes(entry));
            if(result) {
                result = accountingStandards2.every(entry => accountingStandards1.includes(entry));
            }
        }else {
            result = false;
        }
    }else {
        result = false;
    }
    if(!result) {
        return VersionUpType.major;
    }

    let carbonAccountingRules1 = object1.carbonAccountingRules;
    let carbonAccountingRules2 = object2.carbonAccountingRules;
    if(carbonAccountingRules1 != null) {
        if(carbonAccountingRules2 != null) {
            result = accountingStandards1.every(entry1 => {
                return carbonAccountingRules2.findIndex(entry2 => {
                    return entry1.name == entry2.name && entry1.ruleNames == entry2.ruleNames && entry1.operatorName == entry2.operatorName;
                }) != -1;
            });
        }else {
            result = false;
        }
    }else {
        if(carbonAccountingRules2 != null) {
            result = false;
        }
    }
    if(!result) {
        return VersionUpType.major;
    }

    if(object1.assurance != null) {
        if(object2.assurance == null) {
            return VersionUpType.minor;
        }else {
            let entry1 = object1.assurance;
            let entry2 = object2.assurance;
            if(entry1.coverage != entry2.coverage || entry1.level != entry2.level || entry1.boundary != entry2.boundary || entry1.providerName != entry2.providerName || entry1.updatedDate != entry2.updatedDate || entry1.standard != entry2.standard || entry1.comments != entry2.comments) {
                return VersionUpType.minor;
            }
        }
    }

    // check for minor update

    result = propertiesForMinorUpdate.findIndex(key => {
        let value1 = object1[key];
        let value2 = object2[key];
        return value1 !== value2;
    });
    if(result != -1) {
        return VersionUpType.minor;
    }

    let inventoryDatabases1 = object1.inventoryDatabases;
    let inventoryDatabases2 = object2.inventoryDatabases;
    if(inventoryDatabases1 != null) {
        if(inventoryDatabases2 != null) {
            result = inventoryDatabases1.every(entry1 => {
                return inventoryDatabases2.findIndex(entry2 => {
                    return entry1.emissionFactorCategoryId == entry2.emissionFactorCategoryId;
                }) != -1;
            });
            if(!result) {
                return VersionUpType.minor;
            }
            result = inventoryDatabases2.every(entry2 => {
                return inventoryDatabases1.findIndex(entry1 => {
                    return entry1.emissionFactorCategoryId == entry2.emissionFactorCategoryId;
                }) != -1;
            });
            if(!result) {
                return VersionUpType.minor;
            }
        }else {
            return VersionUpType.minor;
        }
    }else {
        if(inventoryDatabases2 != null) {
            return VersionUpType.minor;
        }
    }

    let dataQualityIndicator1 = object1.dataQualityIndicator;
    let dataQualityIndicator2 = object2.dataQualityIndicator;
    if(dataQualityIndicator1 != null) {
        if(dataQualityIndicator2 != null) {
            result = dataQualityIndicator1.every(entry1 => {
                return dataQualityIndicator2.findIndex(entry2 => {
                    return entry1.coverage == entry2.coverage && entry1.ter == entry2.ter && entry1.tir == entry2.tir && entry1.ger == entry2.ger && entry1.completeness == entry2.completeness && entry1.reliability == entry2.reliability;
                }) != -1;
            });
            if(!result) {
                return VersionUpType.minor;
            }
            result = inventoryDatabases2.every(entry2 => {
                return inventoryDatabases1.findIndex(entry1 => {
                    return entry1.coverage == entry2.coverage && entry1.ter == entry2.ter && entry1.tir == entry2.tir && entry1.ger == entry2.ger && entry1.completeness == entry2.completeness && entry1.reliability == entry2.reliability;
                }) != -1;
            });
            if(!result) {
                return VersionUpType.minor;
            }
        }else {
            return VersionUpType.minor;
        }
    }else {
        if(dataQualityIndicator2 != null) {
            return VersionUpType.minor;
        }
    }

    if(object1.assurance == null) {
        if(object2.assurance != null) {
            return VersionUpType.minor;
        }
    }

    return VersionUpType.none;
}