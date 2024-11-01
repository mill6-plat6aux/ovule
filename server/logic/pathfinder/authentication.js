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
    let result;
    try {
        result = await _authorize(request);
    }catch(error) {
        error.message = JSON.stringify({code: "BadRequest", message: error.message});
        throw error;
    }
    return result;
}