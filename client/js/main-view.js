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

class MainView extends ViewController {

    static contents = {
        Organization: 0,
        Products: 1,
        EmissionFactors: 2,
        DataSources: 3,
        Tasks: 4
    };

    constructor() {
        super();
        this.parent = "body";
        this.view = View(".main", {style: {
            width: "100%",
            "min-height": "100%",
            "background-color": "rgba(255,255,255,0.8)",
            "user-select": "none",
            opacity: 0
        }}, [
            View(".menu", {width: 240, style: {
                display: "inline-block", 
                padding: [32,8,8,32],
                "vertical-align": "top",
            }}, [
                View(".title", [
                    InlineImage({height: 32, style:{margin: [0,8,16,0], float: "left"}, src: "images/title.svg"}),
                    View({style: {display: "inline-block", padding: [4,0,0,0], "font-size": "8px", "line-height": "8px"}}, ["Product Footprint<br/>Management<br/>System"])
                ]),
                View({style: {clear: "both"}}, [
                    MenuItem({title: "Organization", icon: "company.svg", tapHandler: () => {
                        this.handleContent(MainView.contents.Organization);
                    }}),
                    MenuItem({title: "Products", icon: "product.svg", tapHandler: () => {
                        this.handleContent(MainView.contents.Products);
                    }}),
                    MenuItem({title: "Emission Factors", icon: "emissions.svg", tapHandler: () => {
                        this.handleContent(MainView.contents.EmissionFactors);
                    }}),
                    MenuItem({title: "Data Source", icon: "datasource.svg", tapHandler: () => {
                        this.handleContent(MainView.contents.DataSources);
                    }}),
                    MenuItem({title: "Task", icon: "task.svg", tapHandler: () => {
                        this.handleContent(MainView.contents.Tasks);
                    }})
                ]),
                View({title: "Sign out", style: {
                    position: "absolute",
                    right: 0,
                    top: 0,
                    width: 40,
                    height: 40,
                    "background-image": "images/exit.svg",
                    "background-repeat": "no-repeat",
                    "background-size": 16,
                    "background-position": "center",
                    cursol: "default",
                    opacity: 0.4
                }, tapHandler: event => {
                    this.signOut();
                }})
            ]),
            View(".contents", {width: "calc(100% - 240px)", style: {
                display: "inline-block", 
                padding: 8,
                "min-height": "calc(100% - 32px)",
                "z-index": 0
            }})
        ]);
        this.showContainer(this.view);
        this.handleContent(MainView.contents.Organization);
    }

    showContainer(container) {
        new FunctionalAnimation(progress => {
            container.style.opacity = progress;
        }, FunctionalAnimation.methods.easeInOut, 300).start();
    }

    dismissContainer(container) {
        new FunctionalAnimation(progress => {
            container.style.opacity = 1-progress;
        }, FunctionalAnimation.methods.easeInOut, 300).start();
    }

    handleContent(index) {
        let menuItems = this.view.querySelectorAll(".menuItem");
        menuItems.forEach((menuItem, i) => {
            if(index == i) {
                menuItem.style.backgroundColor = "rgba(0,0,0,0.1)";
                menuItem.style.opacity = 1;
            }else {
                menuItem.style.backgroundColor = "transparent";
                menuItem.style.opacity = 0.6;
            }
        });
        let container = this.view.querySelector(".contents > div");
        if(container != null) {
            this.dismissContainer(container);
        }
        if(index == MainView.contents.Organization) {
            Module.loadLogic("js/organization-view.js", function() {
                new OrganizationView();
            });
        }else if(index == MainView.contents.Products) {
            Module.loadLogic("js/product-view.js", function() {
                new ProductView();
            });
        }else if(index == MainView.contents.EmissionFactors) {
            Module.loadLogic("js/emission-factor-view.js", function() {
                new EmissionFactorView();
            });
        }else if(index == MainView.contents.DataSources) {
            Module.loadLogic("js/datasource-view.js", function() {
                new DataSourceView();
            });
        }else if(index == MainView.contents.Tasks) {
            Module.loadLogic("js/task-view.js", function() {
                new TaskView();
            });
        }
    }

    signOut() {
        HttpConnection.request(ContextPath+"/sessions/current", "DELETE").then(response => {
            location.href = "/";
        });
    }
}

function MenuItem() {
    let _arguments = Array.prototype.slice.call(arguments);

    let title;
    let icon;
    for(let i=0; i<_arguments.length; i++) {
        var argument = _arguments[i];
        if(typeof argument == "object" && !Array.isArray(argument)) {
            let keys = Object.keys(argument);
            for(let j=0; j<keys.length; j++) {
                let key = keys[j];
                if(key == "title" && typeof argument[key] == "string") {
                    title = argument[key];
                    delete argument[key];
                }
                else if(key == "icon" && typeof argument[key] == "string") {
                    icon = argument[key];
                    delete argument[key];
                }
            }
            break;
        }
    }
    let element = View.apply(this, _arguments);
    element.classList.add("menuItem");
    element.styles = {
        margin: [8,0],
        padding: [8,8,8,32],
        cursol: "default",
        "border-radius": 4,
        "background-image": "images/"+icon,
        "background-repeat": "no-repeat",
        "background-size": 16,
        "background-position": [8, "center"]
    };
    element.innerText = title;
    return element;
}