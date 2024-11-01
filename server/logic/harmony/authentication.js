/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

/**
 * @typedef { import("http").IncomingMessage } IncomingMessage
 * @typedef { import("http").ServerResponse } ServerResponse
 */

import { authenticate as _authenticate, authorize as _authorize } from "../authentication.js";
import { readFileSync } from "fs";
import { sep } from "path";
import { verifySignature } from "../../utility/http.js";
import { ErrorCode, ErrorResponse } from "arbuscular";

const harmonyPublicKey = readFileSync("credentials"+sep+"harmony-public-key.pem", "utf8");

/**
 * @type {import ("arbuscular").authorize}
 */
export async function authenticate(request) {
    let result;
    try {
        result = await _authenticate(request);
    }catch(error) {
        error.message = JSON.stringify({code: "BadRequest", message: error.message});
        throw error;
    }
    return result;
}

/**
 * @type {import ("arbuscular").authorize}
 */
export async function authorize(request) {
    let session;
    try {
        session = await _authorize(request);
    }catch(error) {
        error.message = JSON.stringify({code: "BadRequest", message: error.message});
        throw error;
    }

    if(!verifySignature(request, harmonyPublicKey, "SHA256")) {
        throw ErrorResponse(ErrorCode.RequestError, JSON.stringify({code: "BadRequest", message: "The signature is incorrect."}))
    }

    return session;
}