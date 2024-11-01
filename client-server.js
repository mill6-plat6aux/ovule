/*!
 * Copyright 2023 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { createServer } from "http";
import { existsSync, readFile } from "fs";

let port = 3001;
let contentPath = "dist";

const server = createServer((request, response) => {
    let requestPath = request.url;
    if(requestPath == null) {
        response.writeHead(400);
        response.end("Bad access");
        return;
    }
    if(requestPath.startsWith("/?")) {
        requestPath = "/";
    }
    if(requestPath == "/") {
        requestPath = "/index.html";
    }
    if(!existsSync(contentPath+requestPath)) {
        response.writeHead(404);
        response.end("Not found");
        return;
    }
    readFile(contentPath+requestPath, (error, data) => {
        if(error != null) {
            console.error(error.message, error.stack);
            response.writeHead(500);
            response.end("Internal error");
            return;
        }
        if(requestPath == null) {
            return;
        }
        let contentType;
        if(requestPath.endsWith(".html")) {
            contentType = "text/html";
        }else if(requestPath.endsWith(".css")) {
            contentType = "text/css";
        }else if(requestPath.endsWith(".js")) {
            contentType = "text/javascript";
        }else if(requestPath.endsWith(".svg")) {
            contentType = "image/svg+xml";
        }else if(requestPath.endsWith(".jpg")) {
            contentType = "image/jpeg";
        }else if(requestPath.endsWith(".pdf")) {
            contentType = "application/pdf";
        }
        if(contentType == null) {
            response.writeHead(500);
            response.end("Internal error");
            return;
        }
        response.writeHead(200, {"Content-Type": contentType});
        response.write(data, error => {
            if(error != null) {
                console.error(error.message, error.stack);
                return;
            }
        });
        response.end();
    });
});
server.on("listening", () => {
    console.log(`Client Server is listening on ${port}.`);
});
server.listen(port);