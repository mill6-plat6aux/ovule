-- MySQL Script generated by MySQL Workbench
-- Wed Oct 30 17:13:22 2024
-- Model: Ovule    Version: 1.0
-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema ovule
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema ovule
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `ovule` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin ;
USE `ovule` ;

-- -----------------------------------------------------
-- Table `ovule`.`Organization`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`Organization` (
  `OrganizationId` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `OrganizationName` VARCHAR(32) NOT NULL,
  `OrganizationType` ENUM('User', 'Department', 'BusinessPartner') NOT NULL DEFAULT 'User',
  `ParentOrganizationId` BIGINT UNSIGNED NULL,
  `Organizationcol` VARCHAR(45) NULL,
  PRIMARY KEY (`OrganizationId`),
  INDEX `fk_Organization_Organization1_idx` (`ParentOrganizationId` ASC) VISIBLE,
  CONSTRAINT `fk_Organization_Organization1`
    FOREIGN KEY (`ParentOrganizationId`)
    REFERENCES `ovule`.`Organization` (`OrganizationId`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`User`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`User` (
  `UserId` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `UserName` VARCHAR(128) NOT NULL,
  `Password` TINYBLOB NOT NULL,
  `OrganizationId` BIGINT UNSIGNED NOT NULL,
  `UserType` ENUM('General', 'Pathfinder') NOT NULL,
  PRIMARY KEY (`UserId`),
  UNIQUE INDEX `UserName_UNIQUE` (`UserName` ASC) VISIBLE,
  INDEX `fk_User_Organization1_idx` (`OrganizationId` ASC) VISIBLE,
  CONSTRAINT `fk_User_Organization1`
    FOREIGN KEY (`OrganizationId`)
    REFERENCES `ovule`.`Organization` (`OrganizationId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`OrganizationIdentifier`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`OrganizationIdentifier` (
  `OrganizationId` BIGINT UNSIGNED NOT NULL,
  `Code` VARCHAR(128) NOT NULL,
  `Type` ENUM('UUID', 'SGLN', 'LEI', 'SupplierSpecific', 'BuyerSpecific') NOT NULL,
  UNIQUE INDEX `Code_UNIQUE` (`Code` ASC) VISIBLE,
  INDEX `fk_OrganizationIdentifier_Organization1_idx` (`OrganizationId` ASC) VISIBLE,
  PRIMARY KEY (`OrganizationId`, `Code`),
  CONSTRAINT `fk_OrganizationIdentifier_Organization1`
    FOREIGN KEY (`OrganizationId`)
    REFERENCES `ovule`.`Organization` (`OrganizationId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`Product`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`Product` (
  `ProductId` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ProductName` VARCHAR(128) NOT NULL,
  `Description` VARCHAR(512) NULL,
  `CpcCode` VARCHAR(8) NULL,
  `ParentProductId` BIGINT UNSIGNED NULL,
  `Amount` DECIMAL(30,20) UNSIGNED NULL,
  `AmountUnit` ENUM('kg', 't', 'kl', 'm3', 'm2', 'Nm3', 'GJ', 'kWh') NULL,
  PRIMARY KEY (`ProductId`),
  INDEX `fk_Product_Product1_idx` (`ParentProductId` ASC) VISIBLE,
  CONSTRAINT `fk_Product_Product1`
    FOREIGN KEY (`ParentProductId`)
    REFERENCES `ovule`.`Product` (`ProductId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`ProductIdentifier`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`ProductIdentifier` (
  `ProductId` BIGINT UNSIGNED NOT NULL,
  `Code` VARCHAR(45) NOT NULL,
  `Type` ENUM('UUID', 'SGTIN', 'SupplierSpecific', 'BuyerSpecific') NOT NULL,
  INDEX `fk_ProductIdentifier_Product1_idx` (`ProductId` ASC) VISIBLE,
  PRIMARY KEY (`Code`, `ProductId`),
  UNIQUE INDEX `Code_UNIQUE` (`Code` ASC) VISIBLE,
  CONSTRAINT `fk_ProductIdentifier_Product1`
    FOREIGN KEY (`ProductId`)
    REFERENCES `ovule`.`Product` (`ProductId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`ProductFootprint`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`ProductFootprint` (
  `ProductFootprintId` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `DataId` VARCHAR(36) NOT NULL COMMENT 'PF ID of Pathfinder',
  `Version` INT NOT NULL DEFAULT 0,
  `UpdatedDate` DATETIME NOT NULL,
  `Status` ENUM('Active', 'Deprecated') NOT NULL DEFAULT 'Active',
  `StatusComment` VARCHAR(256) NULL,
  `AvailableStartDate` DATETIME NULL,
  `AvailableEndDate` DATETIME NULL,
  `OrganizationId` BIGINT UNSIGNED NOT NULL,
  `ProductId` BIGINT UNSIGNED NOT NULL,
  `Comment` VARCHAR(512) NULL,
  `AmountUnit` ENUM('kg', 'l', 'm3', 'm2', 'kWh', 'MJ', 't-km') NOT NULL,
  `Amount` DECIMAL(30,20) UNSIGNED NOT NULL,
  `CarbonFootprint` DECIMAL(30,20) NOT NULL,
  `CarbonFootprintIncludingBiogenic` DECIMAL(30,20) NULL,
  `FossilEmissions` DECIMAL(30,20) NOT NULL,
  `FossilCarbonContent` DECIMAL(30,20) NOT NULL,
  `BiogenicCarbonContent` DECIMAL(30,20) NOT NULL,
  `DLucEmissions` DECIMAL(30,20) NULL,
  `LandManagementEmissions` DECIMAL(30,20) NULL,
  `OtherBiogenicEmissions` DECIMAL(30,20) NULL,
  `ILucGhgEmissions` DECIMAL(30,20) NULL,
  `BiogenicRemoval` DECIMAL(30,20) NULL,
  `AircraftEmissions` DECIMAL(30,20) NULL,
  `BiogenicAccountingStandard` ENUM('PEF', 'ISO14067', 'GHGProtocol', 'Quantis') NULL,
  `BoundaryProcesses` VARCHAR(128) NOT NULL,
  `MeasurementStartDate` DATETIME NOT NULL,
  `MeasurementEndDate` DATETIME NOT NULL,
  `Region` ENUM('Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Australia and New Zealand', 'Central Asia', 'Eastern Asia', 'Eastern Europe', 'Latin America and the Caribbean', 'Melanesia', 'Micronesia', 'Northern Africa', 'Northern America', 'Northern Europe', 'Polynesia', 'South-eastern Asia', 'Southern Asia', 'Southern Europe', 'Sub-Saharan Africa', 'Western Asia', 'Western Europe') NULL,
  `Country` CHAR(2) NULL,
  `Subdivision` VARCHAR(6) NULL,
  `ExemptedEmissionsRate` DECIMAL(23,20) NOT NULL,
  `ExemptedEmissionsReason` VARCHAR(512) NOT NULL,
  `PackagingGhgEmissions` DECIMAL(23,20) NULL,
  `AllocationRules` VARCHAR(512) NULL,
  `UncertaintyAssessment` VARCHAR(512) NULL,
  `PrimaryDataShare` DECIMAL(23,20) NULL,
  PRIMARY KEY (`ProductFootprintId`),
  INDEX `fk_ProductFootprint_Organization1_idx` (`OrganizationId` ASC) VISIBLE,
  INDEX `fk_ProductFootprint_Product1_idx` (`ProductId` ASC) VISIBLE,
  UNIQUE INDEX `DataId_UNIQUE` (`DataId` ASC) VISIBLE,
  CONSTRAINT `fk_ProductFootprint_Organization1`
    FOREIGN KEY (`OrganizationId`)
    REFERENCES `ovule`.`Organization` (`OrganizationId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_ProductFootprint_Product1`
    FOREIGN KEY (`ProductId`)
    REFERENCES `ovule`.`Product` (`ProductId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`CarbonAccountingRule`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`CarbonAccountingRule` (
  `CarbonAccountingRuleId` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Operator` ENUM('PEF', 'EPD', 'Other') NOT NULL,
  `RuleNames` VARCHAR(512) NOT NULL COMMENT 'CSV',
  `OperatorName` VARCHAR(128) NULL,
  `OrganizationId` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`CarbonAccountingRuleId`),
  UNIQUE INDEX `RuleNames_UNIQUE` (`RuleNames` ASC) VISIBLE,
  INDEX `fk_CarbonAccountingRule_Organization1_idx` (`OrganizationId` ASC) VISIBLE,
  CONSTRAINT `fk_CarbonAccountingRule_Organization1`
    FOREIGN KEY (`OrganizationId`)
    REFERENCES `ovule`.`Organization` (`OrganizationId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`GwpReport`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`GwpReport` (
  `ProductFootprintId` BIGINT UNSIGNED NOT NULL,
  `ReportType` ENUM('AR5', 'AR6') NOT NULL,
  INDEX `fk_GwpReportReference_ProductFootprint1_idx` (`ProductFootprintId` ASC) VISIBLE,
  PRIMARY KEY (`ProductFootprintId`, `ReportType`),
  CONSTRAINT `fk_GwpReportReference_ProductFootprint1`
    FOREIGN KEY (`ProductFootprintId`)
    REFERENCES `ovule`.`ProductFootprint` (`ProductFootprintId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`AccountingStandard`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`AccountingStandard` (
  `ProductFootprintId` BIGINT UNSIGNED NOT NULL,
  `Standard` ENUM('GHGProtocol', 'ISO14067', 'ISO14044') NOT NULL,
  INDEX `fk_AccountingStandardReference_ProductFootprint1_idx` (`ProductFootprintId` ASC) VISIBLE,
  PRIMARY KEY (`ProductFootprintId`, `Standard`),
  CONSTRAINT `fk_AccountingStandardReference_ProductFootprint1`
    FOREIGN KEY (`ProductFootprintId`)
    REFERENCES `ovule`.`ProductFootprint` (`ProductFootprintId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`CarbonAccountingRuleReference`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`CarbonAccountingRuleReference` (
  `ProductFootprintId` BIGINT UNSIGNED NOT NULL,
  `CarbonAccountingRuleId` INT UNSIGNED NOT NULL,
  INDEX `fk_CarbonAccountingRuleReference_ProductFootprint1_idx` (`ProductFootprintId` ASC) VISIBLE,
  INDEX `fk_CarbonAccountingRuleReference_CarbonAccountingRule1_idx` (`CarbonAccountingRuleId` ASC) VISIBLE,
  PRIMARY KEY (`ProductFootprintId`, `CarbonAccountingRuleId`),
  CONSTRAINT `fk_CarbonAccountingRuleReference_ProductFootprint1`
    FOREIGN KEY (`ProductFootprintId`)
    REFERENCES `ovule`.`ProductFootprint` (`ProductFootprintId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_CarbonAccountingRuleReference_CarbonAccountingRule1`
    FOREIGN KEY (`CarbonAccountingRuleId`)
    REFERENCES `ovule`.`CarbonAccountingRule` (`CarbonAccountingRuleId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`EmissionFactorCategory`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`EmissionFactorCategory` (
  `EmissionFactorCategoryId` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `EmissionFactorCategoryName` VARCHAR(45) NOT NULL,
  `Version` VARCHAR(32) NULL,
  `ParentEmissionFactorCategoryId` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`EmissionFactorCategoryId`),
  INDEX `fk_EmissionFactorCategory_EmissionFactorCategory1_idx` (`ParentEmissionFactorCategoryId` ASC) VISIBLE,
  CONSTRAINT `fk_EmissionFactorCategory_EmissionFactorCategory1`
    FOREIGN KEY (`ParentEmissionFactorCategoryId`)
    REFERENCES `ovule`.`EmissionFactorCategory` (`EmissionFactorCategoryId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`InventoryDatabaseReference`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`InventoryDatabaseReference` (
  `ProductFootprintId` BIGINT UNSIGNED NOT NULL,
  `EmissionFactorCategoryId` BIGINT UNSIGNED NOT NULL,
  INDEX `fk_InventoryDatabaseReference_ProductFootprint1_idx` (`ProductFootprintId` ASC) VISIBLE,
  PRIMARY KEY (`ProductFootprintId`, `EmissionFactorCategoryId`),
  INDEX `fk_InventoryDatabaseReference_EmissionFactorCategory1_idx` (`EmissionFactorCategoryId` ASC) VISIBLE,
  CONSTRAINT `fk_InventoryDatabaseReference_ProductFootprint1`
    FOREIGN KEY (`ProductFootprintId`)
    REFERENCES `ovule`.`ProductFootprint` (`ProductFootprintId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_InventoryDatabaseReference_EmissionFactorCategory1`
    FOREIGN KEY (`EmissionFactorCategoryId`)
    REFERENCES `ovule`.`EmissionFactorCategory` (`EmissionFactorCategoryId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`DataQualityIndicator`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`DataQualityIndicator` (
  `ProductFootprintId` BIGINT UNSIGNED NOT NULL,
  `Coverage` DECIMAL(21,20) UNSIGNED NULL,
  `Ter` DECIMAL(21,20) UNSIGNED NULL,
  `Tir` DECIMAL(21,20) UNSIGNED NULL,
  `Ger` DECIMAL(21,20) UNSIGNED NULL,
  `Completeness` DECIMAL(21,20) UNSIGNED NULL,
  `Reliability` DECIMAL(21,20) UNSIGNED NULL,
  INDEX `fk_DataQualityIndicator_ProductFootprint1_idx` (`ProductFootprintId` ASC) VISIBLE,
  CONSTRAINT `fk_DataQualityIndicator_ProductFootprint1`
    FOREIGN KEY (`ProductFootprintId`)
    REFERENCES `ovule`.`ProductFootprint` (`ProductFootprintId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`Assurance`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`Assurance` (
  `ProductFootprintId` BIGINT UNSIGNED NOT NULL,
  `Coverage` ENUM('corporate level', 'product line', 'PCF system', 'product level') NULL,
  `Level` ENUM('limited', 'reasonable') NULL,
  `Boundary` ENUM('Gate-to-Gate', 'Cradle-to-Gate') NULL,
  `ProviderName` VARCHAR(128) NOT NULL,
  `UpdatedDate` DATETIME NULL,
  `Standard` VARCHAR(128) NULL,
  `Comments` VARCHAR(512) NULL,
  INDEX `fk_Assurance_ProductFootprint1_idx` (`ProductFootprintId` ASC) VISIBLE,
  CONSTRAINT `fk_Assurance_ProductFootprint1`
    FOREIGN KEY (`ProductFootprintId`)
    REFERENCES `ovule`.`ProductFootprint` (`ProductFootprintId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`EmissionFactor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`EmissionFactor` (
  `EmissionFactorId` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `EmissionFactorName` VARCHAR(32) NOT NULL,
  `Value` DECIMAL(30,20) UNSIGNED NOT NULL,
  `NumeratorUnit` ENUM('kg-CO2e', 't-CO2e') NOT NULL,
  `DenominatorUnit` ENUM('kg', 't', 'kl', 'm3', 'm2', 'Nm3', 'GJ', 'kWh') NOT NULL,
  `EmissionFactorCategoryId` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`EmissionFactorId`),
  INDEX `fk_EmissionFactor_EmissionFactorCategory1_idx` (`EmissionFactorCategoryId` ASC) VISIBLE,
  CONSTRAINT `fk_EmissionFactor_EmissionFactorCategory1`
    FOREIGN KEY (`EmissionFactorCategoryId`)
    REFERENCES `ovule`.`EmissionFactorCategory` (`EmissionFactorCategoryId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`ProductionActivity`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`ProductionActivity` (
  `ProductId` BIGINT UNSIGNED NOT NULL,
  `EmissionFactorId` BIGINT UNSIGNED NOT NULL,
  `Amount` DECIMAL(30,20) NOT NULL,
  INDEX `fk_ProductionActivity_Product1_idx` (`ProductId` ASC) VISIBLE,
  INDEX `fk_ProductionActivity_EmissionFactor1_idx` (`EmissionFactorId` ASC) VISIBLE,
  PRIMARY KEY (`ProductId`, `EmissionFactorId`),
  CONSTRAINT `fk_ProductionActivity_Product1`
    FOREIGN KEY (`ProductId`)
    REFERENCES `ovule`.`Product` (`ProductId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_ProductionActivity_EmissionFactor1`
    FOREIGN KEY (`EmissionFactorId`)
    REFERENCES `ovule`.`EmissionFactor` (`EmissionFactorId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`OrganizationProduct`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`OrganizationProduct` (
  `OrganizationId` BIGINT UNSIGNED NOT NULL,
  `ProductId` BIGINT UNSIGNED NOT NULL,
  INDEX `fk_OrganizationProduct_Organization1_idx` (`OrganizationId` ASC) VISIBLE,
  INDEX `fk_OrganizationProduct_Product1_idx` (`ProductId` ASC) VISIBLE,
  PRIMARY KEY (`OrganizationId`, `ProductId`),
  CONSTRAINT `fk_OrganizationProduct_Organization1`
    FOREIGN KEY (`OrganizationId`)
    REFERENCES `ovule`.`Organization` (`OrganizationId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_OrganizationProduct_Product1`
    FOREIGN KEY (`ProductId`)
    REFERENCES `ovule`.`Product` (`ProductId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`OrganizationEmissionFactorCategory`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`OrganizationEmissionFactorCategory` (
  `OrganizationId` BIGINT UNSIGNED NOT NULL,
  `EmissionFactorCategoryId` BIGINT UNSIGNED NOT NULL,
  INDEX `fk_OrganizationEmissionFactor_Organization1_idx` (`OrganizationId` ASC) VISIBLE,
  PRIMARY KEY (`OrganizationId`, `EmissionFactorCategoryId`),
  INDEX `fk_OrganizationEmissionFactor_EmissionFactorCategory1_idx` (`EmissionFactorCategoryId` ASC) VISIBLE,
  CONSTRAINT `fk_OrganizationEmissionFactor_Organization1`
    FOREIGN KEY (`OrganizationId`)
    REFERENCES `ovule`.`Organization` (`OrganizationId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_OrganizationEmissionFactor_EmissionFactorCategory1`
    FOREIGN KEY (`EmissionFactorCategoryId`)
    REFERENCES `ovule`.`EmissionFactorCategory` (`EmissionFactorCategoryId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`UserPrivilege`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`UserPrivilege` (
  `UserId` BIGINT UNSIGNED NOT NULL,
  `Data` ENUM('Organization', 'Users', 'Products', 'EmissionFactor', 'ProductActivity', 'ProductFootprint', 'DataSource', 'Task') NOT NULL,
  `Permission` ENUM('Read', 'Write') NOT NULL,
  INDEX `fk_Authority_User1_idx` (`UserId` ASC) VISIBLE,
  PRIMARY KEY (`UserId`, `Data`, `Permission`),
  CONSTRAINT `fk_Authority_User1`
    FOREIGN KEY (`UserId`)
    REFERENCES `ovule`.`User` (`UserId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`UserSession`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`UserSession` (
  `UserId` BIGINT UNSIGNED NOT NULL,
  `Session` CHAR(36) NOT NULL,
  `LoginDate` DATETIME NOT NULL,
  INDEX `fk_UserSession_User1_idx` (`UserId` ASC) VISIBLE,
  PRIMARY KEY (`UserId`, `Session`),
  CONSTRAINT `fk_UserSession_User1`
    FOREIGN KEY (`UserId`)
    REFERENCES `ovule`.`User` (`UserId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`DataSource`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`DataSource` (
  `DataSourceId` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `DataSourceName` VARCHAR(32) NOT NULL,
  `DataSourceType` ENUM('Pathfinder') NOT NULL DEFAULT 'Pathfinder',
  `UserName` VARCHAR(128) NULL,
  `Password` TINYBLOB NULL,
  `OrganizationId` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`DataSourceId`),
  INDEX `fk_DataSource_Organization1_idx` (`OrganizationId` ASC) VISIBLE,
  CONSTRAINT `fk_DataSource_Organization1`
    FOREIGN KEY (`OrganizationId`)
    REFERENCES `ovule`.`Organization` (`OrganizationId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`Endpoint`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`Endpoint` (
  `DataSourceId` BIGINT UNSIGNED NOT NULL,
  `Type` ENUM('Authenticate', 'GetFootprints', 'UpdateEvent') NOT NULL,
  `Url` VARCHAR(256) NOT NULL,
  PRIMARY KEY (`DataSourceId`, `Type`),
  INDEX `fk_Endpoint_DataSource1_idx` (`DataSourceId` ASC) VISIBLE,
  INDEX `idx_Endpoint_Url` (`Url` ASC) VISIBLE,
  CONSTRAINT `fk_Endpoint_DataSource1`
    FOREIGN KEY (`DataSourceId`)
    REFERENCES `ovule`.`DataSource` (`DataSourceId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`ProductDataSource`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`ProductDataSource` (
  `ProductId` BIGINT UNSIGNED NOT NULL,
  `DataSourceId` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`ProductId`, `DataSourceId`),
  INDEX `fk_ProductNotification_DataSource1_idx` (`DataSourceId` ASC) VISIBLE,
  CONSTRAINT `fk_ProductNotification_Product1`
    FOREIGN KEY (`ProductId`)
    REFERENCES `ovule`.`Product` (`ProductId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_ProductNotification_DataSource1`
    FOREIGN KEY (`DataSourceId`)
    REFERENCES `ovule`.`DataSource` (`DataSourceId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ovule`.`Task`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ovule`.`Task` (
  `TaskId` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ClientOrganizationId` BIGINT UNSIGNED NOT NULL,
  `RecipientOrganizationId` BIGINT UNSIGNED NOT NULL,
  `TaskType` ENUM('ProductFootprintNotification', 'ProductFootprintRequest') NOT NULL,
  `Message` VARCHAR(512) NULL,
  `ReplyMessage` VARCHAR(512) NULL,
  `Status` ENUM('Unread', 'Pending', 'Rejected', 'Completed') NOT NULL DEFAULT 'Unread',
  `EventId` VARCHAR(128) NULL COMMENT 'CloudEvents ID',
  `Source` VARCHAR(256) NULL COMMENT 'CloudEvents Source',
  `Data` LONGBLOB NULL,
  `ProductId` BIGINT UNSIGNED NULL,
  `UpdatedDate` DATETIME NOT NULL,
  PRIMARY KEY (`TaskId`),
  INDEX `fk_Task_Organization1_idx` (`ClientOrganizationId` ASC) VISIBLE,
  INDEX `fk_Task_Organization2_idx` (`RecipientOrganizationId` ASC) VISIBLE,
  INDEX `fk_Task_Product1_idx` (`ProductId` ASC) VISIBLE,
  CONSTRAINT `fk_Task_Organization1`
    FOREIGN KEY (`ClientOrganizationId`)
    REFERENCES `ovule`.`Organization` (`OrganizationId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_Task_Organization2`
    FOREIGN KEY (`RecipientOrganizationId`)
    REFERENCES `ovule`.`Organization` (`OrganizationId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_Task_Product1`
    FOREIGN KEY (`ProductId`)
    REFERENCES `ovule`.`Product` (`ProductId`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
