/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

export interface ProductFootprint {
    productFootprintId: number|null,

    // id 
    dataId: string,
    version: number,
    // created / updated 
    updatedDate: string,
    status: "Active" | "Deprecated",
    statusComment: string,
    // validityPeriodStart
    availableStartDate: string|null,
    // validityPeriodEnd 
    availableEndDate: string|null,
    organizationId: number,
    productId: number,
    comment: string,

    // pcf.declaredUnit 
    amountUnit: "kg" | "l" | "m3" | "m2" | "kWh" | "MJ" | "t-km",
    // pcf.unitaryProductAmount  
    amount: string,
    // pcf.pCfExcludingBiogenic 
    carbonFootprint: string,
    // pcf.pCfIncludingBiogenic 
    carbonFootprintIncludingBiogenic: string|null,
    // pcf.fossilGhgEmissions 
    fossilEmissions: string,
    // pcf.fossilCarbonContent 
    fossilCarbonContent: string,
    // pcf.biogenicCarbonContent 
    biogenicCarbonContent: string,
    // pcf.dLucGhgEmissions 
    dLucEmissions: string|null,
    // pcf.landManagementGhgEmissions 
    landManagementEmissions: string|null,
    // pcf.otherBiogenicGhgEmissions 
    otherBiogenicEmissions: string|null,
    // pcf.iLucGhgEmissions 
    iLucGhgEmissions: string|null,
    // pcf.biogenicCarbonWithdrawal 
    biogenicRemoval: string|null,
    // pcf.aircraftGhgEmissions 
    aircraftEmissions: string|null,
    // pcf.ipccCharacterizationFactorsSources
    gwpReports: Array<"AR5" | "AR6">,
    // pcf.crossSectoralStandardsUsed 
    accountingStandards: Array<"GHGProtocol" | "ISO14067" | "ISO14044">,
    // pcf.productOrSectorSpecificRules 
    carbonAccountingRules: Array<CarbonAccountingRule>|null,
    // pcf.biogenicAccountingMethodology
    biogenicAccountingStandard: "PEF" | "ISO14067" | "GHGProtocol" | "Quantis" | null,
    // pcf.boundaryProcessesDescription
    boundaryProcesses: string,
    // pcf.referencePeriodStart 
    measurementStartDate: string,
    // pcf.referencePeriodEnd 
    measurementEndDate: string,
    // pcf.geographyCountrySubdivision
    region: string|null,
    // pcf.geographyCountry 
    country: string|null,
    // pcf.geographyRegionOrSubregion 
    subdivision: string|null,
    // pcf.secondaryEmissionFactorSources 
    inventoryDatabases: Array<InventoryDatabase>|null,
    // pcf.exemptedEmissionsPercent
    exemptedEmissionsRate: number,
    // pcf.exemptedEmissionsDescription
    exemptedEmissionsReason: string,
    // pcf.packagingGhgEmissions
    packagingGhgEmissions: string|null,
    // pcf.allocationRulesDescription 
    allocationRules: string|null,
    // pcf.uncertaintyAssessmentDescription
    uncertaintyAssessment: string|null,
    // pcf.primaryDataShare 
    primaryDataShare: number|null,
    // pcf.dqi 
    dataQualityIndicator: DataQualityIndicator|null,
    // pcf.assurance 
    assurance: Assurance|null,

    breakdown: Array<ChildProductFootprint>
}

export interface CarbonAccountingRule {
    operator: string,
    ruleNames: Array<string>,
    operatorName: string | null
}

export interface InventoryDatabase {
    emissionFactorCategoryId: number|null,
    emissionFactorCategoryName: string,
    version: string
}

export interface DataQualityIndicator {
    coverage: number|null,
    ter: number|null,
    tir: number|null,
    ger: number|null,
    completeness: number|null,
    reliability: number|null
}

export interface Assurance {
    coverage: "corporate level" | "product line" | "PCF system" | "product level" | null,
    level: "limited" | "reasonable" | null,
    boundary: "Gate-to-Gate" | "Cradle-to-Gate" | null,
    providerName: string|null,
    updatedDate: string|null,
    standard: string|null,
    comments: string|null
}

export interface ChildProductFootprint {
    productFootprintId: number,

    dataId?: string,
    updatedDate?: string,
    availableStartDate?: string|null,
    availableEndDate?: string|null,

    carbonFootprint?: string,
    carbonFootprintIncludingBiogenic?: string|null,

    measurementStartDate?: string,
    measurementEndDate?: string,

    primaryDataShare?: number|null,
    dataQualityIndicator?: DataQualityIndicator|null,
    assurance?: Assurance|null,

    breakdown?: Array<ChildProductFootprint>
}