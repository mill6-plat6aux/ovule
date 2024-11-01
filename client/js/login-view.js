/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

/**
 * @typedef { import("./lib/hardcore").ViewController } ViewController
 * @typedef { import("./lib/hardcore").Controls } Controls
 * @typedef { import("./lib/hardcore").Module } Module
 * @typedef { import("./lib/hardcore").HttpConnection } HttpConnection
 */

document.addEventListener("DOMContentLoaded", function() {
    let contentsFrame = View(".contents", {style: {width: "100%", height: "100%"}});
    document.getElementsByTagName("body")[0].appendChild(contentsFrame);

    document.globalStyles = {
        "html, body": {
            width: "100%",
            height: "100%",
            "font-family": "Noto",
            "font-weight": 400,
            position: "static",
            overflow: "hidden"
        },
        "body": {
            "background-color": "#999",
            // "background-image": "images/background.jpg",
            "background-size": "cover",
            "background-position": 0,
            "background-repeat": "no-repeat",
            "background-attachment": "fixed"
        },
        "div:focus": {
            outline: "1px solid rgba(0,0,0,0.6)",
            "outline-offset": -1
        },
        "::placeholder": {
            color: "white",
            "font-size": "medium",
            "font-weight": 300,
            "line-height": "1em",
            color: "gray",
        },
        ".scrollbar-hidden::-webkit-scrollbar": {
            display: "none"
        }
    };

    document.globalStyles = {
        "#login input:-webkit-autofill,#login input:-webkit-autofill:hover,#login input:-webkit-autofill:focus,#login input:-webkit-autofill:active": {
            "box-shadow": "0 0 0 1000px white inset",
            "-webkit-text-fill-color": "black"
        }
    };

    HttpConnection.defaultAccessPolicy = "cors";

    new LoginView();

    if(location.search != null && location.search.startsWith("?q=")) {
        let credential;
        let userOnly = false;
        if(location.search.indexOf("m=") != -1) {
            credential = location.search.substring("?q=".length, location.search.indexOf("m="));
            userOnly = true;
        }else {
            credential = location.search.substring("?q=".length);
        }
        let registerView = new CompanyRegistrationView();
        registerView.userOnly = userOnly;
        registerView.data = {credential: credential};
    }
});

class LoginView extends ViewController {

    constructor() {
        super();
        this.parent = "body";
        this.data = {};

        let width = 400;
        let height = 400;

        this.view = View("#login", {style: {
            width:"100%", 
            height:"100%", 
            "user-select": "none", 
            color: "black"
        }}, [
            View(".container", {width: width, height: height, style:{
                position: "absolute",
                left: (window.innerWidth-width)/2+"px",
                top:(window.innerHeight-height)/2+"px",
                "border-radius": 4,
                "background-color": "rgba(255,255,255,0.8)",
                padding: 32,
                visibility: "hidden"
            }}, [
                View(".contents", {style: {
                    opacity: 0
                }}, [
                    View(".title", {align: "center", style:{
                        margin: [32,0]
                    }}, [
                        InlineImage({style:{height: 64, margin: [0,0,16,0]}, src: "images/title.svg"}),
                        View({style:{"font-size": "x-small"}}, ["Product Footprint Management System"])
                    ]),
                    HtmlTag("form", [
                        InputComposite({style: {
                            "background-image": "images/account.svg",
                            "background-repeat": "no-repeat",
                            "background-size": 16,
                            "background-position": [8, "center"],
                            padding: [0,0,0,32]
                        }}, [
                            TextField("#userId", {dataKey: "userId", height: 40, placeholder:"User Name", required: "required", autocomplete: "username", tabIndex:1})
                        ]),
                        InputComposite({style: {
                            "background-image": "images/key.svg",
                            "background-repeat": "no-repeat",
                            "background-size": 16,
                            "background-position": [8, "center"],
                            padding: [0,0,0,32]
                        }}, [
                            PasswordField("#password", {dataKey: "password", height: 40, placeholder:"Password", required: "required", autocomplete: "current-password", tabIndex:2})
                        ])
                    ]),
                    View({align: "center", style: {
                        margin: [32,0,0,0]
                    }}, [
                        Button(".loginButton", {label: "Sign In", style: {"font-weight":"600", color: Colors.ApplyButton}, blocking: true, tapHandler: button => {
                            this.login(button);
                        }, tabIndex:3})
                    ])
                ])
            ])
        ]);

        this.showContainer(width, height);
    }

    showContainer(width, height) {
        let container = this.view.querySelector(".container");
        let initialWidth = width*0.8;
        let initialHeight = height*0.8;
        container.style.width = initialWidth+"px";
        container.style.height = initialHeight+"px";
        container.style.left = (window.innerWidth-initialWidth)/2+"px";
        container.style.top = (window.innerHeight-initialHeight)/2+"px";
        container.style.visibility = "visible";
        new FunctionalAnimation(progress => {
            let _width = initialHeight + (width - initialWidth)*progress;
            let _height = initialHeight + (height - initialHeight)*progress;
            container.style.width = _width+"px";
            container.style.height = _height+"px";
            container.style.left = (window.innerWidth-_width)/2+"px";
            container.style.top = (window.innerHeight-_height)/2+"px";
        }, FunctionalAnimation.methods.easeOut, 300).start().finish(() => {
            let contents = container.querySelector(".contents");
            new FunctionalAnimation(progress => {
                contents.style.opacity = progress;
            }, FunctionalAnimation.methods.easeInOut, 300).start();
        });
    }

    dismissContainer(completeHandler) {
        let container = this.view.querySelector(".container");
        let contents = container.querySelector(".contents");
        let width = container.offsetWidth;
        let height = container.offsetHeight;
        new FunctionalAnimation(progress => {
            contents.style.opacity = 1-progress;
        }, FunctionalAnimation.methods.easeInOut, 300).start().finish(() => {
            let container = this.view.querySelector(".container");
            let finalWidth = width*0.8;
            let finalHeight = height*0.8;
            new FunctionalAnimation(progress => {
                container.style.opacity = 1-progress;
                let _width = width - (width - finalWidth)*progress;
                let _height = height - (height - finalHeight)*progress;
                container.style.width = _width+"px";
                container.style.height = _height+"px";
                container.style.left = (window.innerWidth-_width)/2+"px";
                container.style.top = (window.innerHeight-_height)/2+"px";
            }, FunctionalAnimation.methods.easeOut, 300).start().finish(completeHandler);
        });
    }

    login(button) {
        if(!this.view.validate()) {
            button.restore();
            return;
        }
        let userId = this.data.userId;
        let password = this.data.password;
        let request = {client_id: userId, client_secret: password};
        HttpConnection.request(ContextPath+"/auth/token", "POST", request, "application/x-www-form-urlencoded").then(response => {
            HttpConnection.authorizationType = "Bearer";
            HttpConnection.authorization = response.access_token;
            Module.loadLogic("js/main-view.js", () => {
                this.dismissContainer(() => {
                    new MainView();
                });
            });
        }).catch(error => {
            button.restore();
        });
    }
}