/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync, cpSync, readdirSync } from "fs";
import { sep } from "path";
import { parse } from "yaml";

const inputDir = "client";
const outputDir = "dist";

const cssDir = "css";
const imageDir = "images";
const jsDir = "js";

const indexHtmlFile = "index.html";
const constantsFile = "constants.js";

const i18nDir = "i18n";
const i18nMaps = readdirSync(i18nDir).map(fileName => {
    return { language: fileName.substring(0, fileName.lastIndexOf(".")), mapping: parse(readFileSync(i18nDir+sep+fileName, "utf8")) };
});

let processType = "preprocess";

if(process.argv.length > 2) {
    let args = process.argv;
    for(let i=2; i<args.length; i++) {
        processType = args[i];
    }
}

let contextPath;
if(process.env.CONTEXT_PATH != null) {
    contextPath = process.env.CONTEXT_PATH;
}else {
    contextPath = "http://localhost:3000";
}

if(processType == "preprocess") {
    if(existsSync(outputDir)) {
        rmSync(outputDir, {recursive: true});
    }

    copyContents(inputDir, outputDir);

    i18nMaps.forEach(i18nMap => {
        let language = i18nMap.language;
        copyContents(inputDir, outputDir+sep+language);
    });
}else if(processType == "postprocess") {
    let contents = readFileSync(outputDir+sep+jsDir+sep+constantsFile, "utf8");
    contents = contents.replace("$CONTEXT_PATH", contextPath);
    writeFileSync(outputDir+sep+jsDir+sep+constantsFile, contents);

    i18nMaps.forEach(i18nMap => {
        let language = i18nMap.language;
        let mapping = i18nMap.mapping;

        mkdirSync(outputDir+sep+language+sep+jsDir);
        cpSync(outputDir+sep+jsDir, outputDir+sep+language+sep+jsDir, {recursive: true});

        readdirSync(outputDir+sep+language+sep+jsDir, {withFileTypes: true}).forEach(fileEntry => {
            if(!fileEntry.isFile()) return;
            let fileName = fileEntry.name;
            let contents = readFileSync(outputDir+sep+language+sep+jsDir+sep+fileName, "utf8");
            Object.keys(mapping).forEach(key => {
                contents = contents.replace("\""+key+"\"", "\""+mapping[key]+"\"");
            });
            writeFileSync(outputDir+sep+language+sep+jsDir+sep+fileName, contents);
        });
    });
}

function copyContents(inputDir, outputDir) {
    mkdirSync(outputDir);
    mkdirSync(outputDir+sep+cssDir);
    mkdirSync(outputDir+sep+imageDir);
    
    cpSync(inputDir+sep+cssDir, outputDir+sep+cssDir, {recursive: true});
    cpSync(inputDir+sep+imageDir, outputDir+sep+imageDir, {recursive: true});

    // js files are copied by Babel.
    
    let indexHtml = readFileSync(inputDir+sep+indexHtmlFile, "utf8");
    indexHtml = indexHtml.replace("$CONTEXT_PATH", contextPath);
    writeFileSync(outputDir+sep+indexHtmlFile, indexHtml);
}
