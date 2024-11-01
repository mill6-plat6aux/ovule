/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { parse, ErrorResponse, ErrorCode } from "arbuscular";
import { createHash, createSign } from "crypto";
import { v4 as uuid } from "uuid";
import { connection } from "../utility/database.js";
import { readFileSync } from "fs";

const privateKey = readFileSync("credentials/private-key.pem");

const expiration = 30*60*1000;

/**
 * @type {import ("arbuscular").authenticate}
 */
export async function authenticate(request) {
    let userName;
    let password;
    if(request.headers.authorization != null && request.headers.authorization.startsWith("Basic ")) {
        let credential = request.headers.authorization.substring("Basic ".length).trim();
        credential = Buffer.from(credential, "base64").toString();
        let credentials = credential.split(":");
        if(credentials.length != 2) {
            throw ErrorResponse(ErrorCode.JwtParseError, "Please confirm your user ID or password.");
        }
        userName = credentials[0];
        password = credentials[1];
    }else if(request.headers["content-type"] != null && request.headers["content-type"].startsWith("application/x-www-form-urlencoded")) {
        let body = await parse(request);
        userName = body.client_id;
        password = body.client_secret;
    }
    if(userName == null || userName.length == 0 || password == null || password.length == 0) {
        throw ErrorResponse(ErrorCode.JwtParseError, "Please confirm your user name or password.");
    }

    let hashedPassword = createHash("sha256").update(password).digest("hex");
    let records = await connection("User").select("password", "organizationId", "userId").where("userName", userName);
    if(records.length != 1 || records[0].password == null) {
        throw ErrorResponse(ErrorCode.AuthenticationError, "Please confirm your user ID or password.");
    }
    if(hashedPassword != records[0].password) {
        throw ErrorResponse(ErrorCode.AuthenticationError, "Please confirm your user ID or password.");
    }
    let organizationId = records[0].organizationId;
    let userId = records[0].userId;

    let loginDate = new Date().getTime();
    let expiredDate = new Date(loginDate+expiration).getTime();
    let jwtHeaader = {typ: "JWT", alg: "RS256"};
    let jwtBody = {sub: userId, org: organizationId, iat: loginDate, exp: expiredDate, jti: uuid()};
    let token = createTotken(jwtHeaader, jwtBody);

    let transaction = await connection.transaction();
    try {
        await transaction.insert({UserId: userId, LoginDate: new Date(), Session: jwtBody.jti}).into("UserSession");
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }

    return {access_token: token, token_type: "Bearer"};
}

/**
 * @type {import ("arbuscular").authorize}
 */
export async function authorize(request) {
    let authorization = request.headers.authorization;
    if(authorization == null || !authorization.startsWith("Bearer ")) {
        throw ErrorResponse(ErrorCode.JwtParseError, "Invalid credential.");
    }
    let token = authorization.substring("Bearer ".length).trim();
    let tokens = token.split(".");
    if(tokens.length != 3) {
        throw ErrorResponse(ErrorCode.JwtParseError, "Invalid credential.");
    }
    let jwtHeaader;
    try {
        jwtHeaader = JSON.parse(Buffer.from(tokens[0], "base64").toString());
    }catch(error) {
        throw ErrorResponse(ErrorCode.JwtParseError, "Invalid credential.");
    }
    if(typeof jwtHeaader != "object" || jwtHeaader.typ != "JWT" || jwtHeaader.alg != "RS256") {
        throw ErrorResponse(ErrorCode.JwtParseError, "Invalid credential.");
    }
    let jwtBody;
    try {
        jwtBody = JSON.parse(Buffer.from(tokens[1], "base64").toString());
    }catch(error) {
        throw ErrorResponse(ErrorCode.JwtParseError, "Invalid credential.");
    }
    let current = new Date().getTime();
    if(typeof jwtBody != "object" || 
        jwtBody.sub == null || typeof jwtBody.sub != "number" || 
        jwtBody.org == null || typeof jwtBody.org != "number" || 
        jwtBody.iat == null || typeof jwtBody.iat != "number" || 
        jwtBody.exp == null || typeof jwtBody.exp != "number" ||
        jwtBody.jti == null || typeof jwtBody.jti != "string" ||
        jwtBody.iat > jwtBody.exp || jwtBody.iat > current) {
        throw ErrorResponse(ErrorCode.JwtParseError, "Invalid credential.");
    }
    if(jwtBody.exp <= current) {
        let transaction = await connection.transaction();
        try {
            await transaction.delete().from("UserSession").where({UserId: jwtBody.sub, Session: jwtBody.jti});
            await transaction.commit();
        }catch(error) {
            await transaction.rollback();
            throw error;
        }
        throw ErrorResponse(ErrorCode.JwtParseError, "Session timed out. Please sign in again.");
    }
    let _token = createTotken(jwtHeaader, jwtBody);
    let signature = _token.split(".")[2];
    if(signature != tokens[2]) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid credential.");
    }

    let records = await connection("UserSession").select("session").where("UserId", jwtBody.sub);
    if(records.length == 0) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid session.");
    }
    let validSession = records.find(record => record.session == jwtBody.jti);
    if(validSession == null) {
        throw ErrorResponse(ErrorCode.AuthorizationError, "Invalid session.");
    }

    return {userId: jwtBody.sub, organizationId: jwtBody.org, sessionId: validSession.session};
}

/**
 * @param {object} jwtHeaader 
 * @param {object} jwtBody 
 * @returns {string}
 */
function createTotken(jwtHeaader, jwtBody) {
    let token = Buffer.from(JSON.stringify(jwtHeaader)).toString("base64")+"."+Buffer.from(JSON.stringify(jwtBody)).toString("base64");
    let sign = createSign("RSA-SHA256").update(token).sign(privateKey, "base64");
    return token+"."+sign;
}

/**
 * @type {import ("arbuscular").handle}
 */
export async function deleteSession(session) {
    let userId = session.userId;
    let sessionId = session.sessionId;
    let transaction = await connection.transaction();
    try {
        await transaction("UserSession").delete().where({UserId: userId, Session: sessionId});
        await transaction.commit();
    }catch(error) {
        await transaction.rollback();
        throw error;
    }
}