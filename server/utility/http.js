/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { createVerify } from "node:crypto";
import querystring from "node:querystring";

/**
 * @typedef {object} HttpResponse
 * @property {number|undefined} status
 * @property {import("node:http").IncomingHttpHeaders} headers
 * @property {object} body
 */

/**
 * @param {"get"|"post"|"patch"|"put"|"delete"|"option"|"head"} method 
 * @param {string} requestPath 
 * @param {import("node:http").IncomingHttpHeaders} [requestHeader] 
 * @param {object} [requestBody] 
 * @returns {Promise<HttpResponse>}
 */
export async function request(method, requestPath, requestHeader, requestBody) {
    const Http = requestPath.startsWith("https") ? await import("https") : await import("http");
    return new Promise((resolve, reject) => {
        let connection = Http.request(requestPath, {
            method: method,
            headers: requestHeader
        }, response => {
            let contentType = response.headers["content-type"];
            let status = response.statusCode;
            let buffer;
            response.on("data", chunk => {
                if(buffer == null) buffer = chunk;
                else buffer = Buffer.concat([buffer, chunk]);
            });
            response.on("end", () => {
                let result = buffer;
                if(result != null) {
                    if(contentType != null) {
                        if(contentType.startsWith("application/json")) {
                            result = result.toString("utf8");
                            try {
                                result = JSON.parse(result);
                            }catch(error) {
                                console.error(error);
                            }
                        }
                    }
                }
                resolve({status: status, headers: response.headers, body: result});
            });
        });
        connection.on("error", error => {
            reject(error);
        });
        if(requestBody != null) {
            if(requestHeader != null) {
                let contentType = requestHeader["content-type"];
                if(contentType != null) {
                    if(contentType.startsWith("application/json")) {
                        requestBody = JSON.stringify(requestBody);
                    }else if(contentType.startsWith("application/x-www-form-urlencoded")) {
                        requestBody = querystring.stringify(requestBody);
                    }else if(contentType.startsWith("application/cloudevents+json")) {
                        requestBody = JSON.stringify(requestBody);
                    }
                    connection.write(requestBody);
                }
            }
        }
        connection.end();
    });
}

/**
 * @param {import("http").IncomingMessage} request 
 * @param {string} publicKey 
 * @param {string} algorithm 
 * @returns {boolean}
 */
export function verifySignature(request, publicKey, algorithm) {
    let signatureInput = request.headers["signature-input"];
    let signature = request.headers["signature"];
    if(signatureInput == null || signature == null || typeof signatureInput != "string" || typeof signature != "string") return true;

    let signatureString = signature.substring(signature.indexOf(":")+1, signature.lastIndexOf(":"));

    let contentDigest = request.headers["content-digest"];

    let capturing = false;
    let property = "";
    let properties = [];
    for(let i=0; i<signatureInput.length; i++) {
        let c = signatureInput.charAt(i);
        if(c == ')') {
            break;
        }else if(c == '"') {
            if(!capturing) {
                capturing = true;
            }else {
                properties.push(property);
                capturing = false;
                property = "";
            }
        }else if(c != '(' && c != ' ') {
            if(capturing) {
                property += c;
            }
        }
    }

    let protocol = request.headers["x-forwarded-proto"];
    if(protocol == null) protocol = "https";
    let path = request.headers["x-forwarded-path"];
    if(path == null) path = "";
    let url = new URL(`${protocol}://${request.headers.host}${path}${request.url}`);

    let reproducedSignature = "";
    properties.forEach(property => {
        if(reproducedSignature.length > 0) {
            reproducedSignature += "\n";
        }
        if(property == "@method") {
            reproducedSignature += `"@method": ${request.method != null ? request.method.toLocaleLowerCase() : "get"}`;
        }else if(property == "@target-uri") {
            let protocol = request.headers["x-forwarded-proto"];
            if(protocol == null) protocol = "https";
            reproducedSignature += `"@target-uri": ${url.href}`;
        }else if(property == "@authority") {
            reproducedSignature += `"@authority": ${request.headers.host}`;
        }else if(property == "@scheme") {
            let protocol = request.headers["x-forwarded-proto"];
            if(protocol == null) protocol = "https";
            reproducedSignature += `"@scheme": ${protocol}`;
        }else if(property == "@request-target") {
            reproducedSignature += `"@request-target": ${request.url}`;
        }else if(property == "@path") {
            reproducedSignature += `"@path": ${url.pathname}`;
        }else if(property == "@query") {
            reproducedSignature += `"@query": ${url.search}`;
        }else if(property == "content-digest") {
            reproducedSignature += `"content-digest": ${contentDigest}`;
        }
    });

    return createVerify(algorithm).update(reproducedSignature).end().verify(publicKey, signatureString, "base64");
}