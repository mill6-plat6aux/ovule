/*!
 * Copyright 2017 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import Knex from "knex";
import YAML from "yaml";
import { readFileSync } from "fs";
import { sep } from "path";

let settingFile = readFileSync("."+sep+"server"+sep+"database.yaml", "utf8");

/** @type {import("knex").Knex.Config} */
let setting = YAML.parse(settingFile);

if(process.env.DATABASE_HOST != null) {
    if(setting.connection == null) setting.connection = {};
    setting.connection["host"] = process.env.DATABASE_HOST;
}
if(process.env.DATABASE_PORT != null) {
    if(setting.connection == null) setting.connection = {};
    setting.connection["port"] = process.env.DATABASE_PORT;
}
if(process.env.DATABASE_USERNAME != null) {
    if(setting.connection == null) setting.connection = {};
    setting.connection["user"] = process.env.DATABASE_USERNAME;
}
if(process.env.DATABASE_PASSWORD != null) {
    if(setting.connection == null) setting.connection = {};
    setting.connection["password"] = process.env.DATABASE_PASSWORD;
}
if(process.env.DATABASE_DATABASE != null) {
    if(setting.connection == null) setting.connection = {};
    setting.connection["database"] = process.env.DATABASE_DATABASE;
}
if(setting.connection == null || typeof setting.connection != "object") {
    throw new Error("Database settings not found.");
}

/**
 * @type {import("mysql").TypeCast}
 */
setting.connection["typeCast"] = (field, next) => {
    // DECIMAL value to String
    if(field.type == "NEWDECIMAL") {
        let expression = field.string();
        if(expression == null) {
            return expression;
        }
        let result = "";
        let reserve = "";
        for(let i=0; i<expression.length; i++) {
            let char = expression.charAt(i);
            if(char == '0') {
                reserve += char;
            }else {
                if(reserve.length > 0) {
                    result += reserve;
                    reserve = "";
                }
                result += char;
            }
        }
        if(result.length > 0) {
            if(result.charAt(result.length-1) == '.') {
                result = result.substring(0, result.length-1);
            }
        }else {
            result = "0";
        }
        return result;
    }
    return next();
};

export let connection = Knex(setting);