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

class DataSourceView extends ViewController {

    constructor() {
        super();
        this.parent = "body > .main > .contents";
        this.data = [];
        this.view = View({style: {
            overflow: "hidden",
            opacity: 0
        }}, [
            View(".dataSources", {style: {
                margin: 16,
                padding: 32,
                "max-width": 700,
                "background-color": "rgba(255,255,255,0.6)",
                "border-radius": 8,
                "user-select": "none",
                position: "absolute"
            }}, [
                View({style: {
                    margin: [0,0,16,0],
                    "font-size": "1.5em",
                    "font-weight": 900
                }}, ["Data Source"]),
                View({style: {
                    margin: [0,0,16,0],
                    "font-size": "small"
                }}, ["If your business partners are using applications that implement Pathfinder, you can register their credentials and endpoints to notify them to register their own product footprints or request them to register the product footprints of other companies' products."]),
                View({height: 40}, [
                    Button(".addButton", {style: {
                        "background-image": "images/add.svg",
                        "background-position": [0, "center"],
                        "background-size": 16,
                        "background-repeat": "no-repeat",
                        padding: [8,8,8,20],
                    }, tapHandler: () => {
                        let record = {
                            dataSourceId: null,
                            dataSourceName: null,
                            endpoints: []
                        };
                        this.showDetailView(record);
                    }}, ["Add"])
                ]),
                Table(".list", {
                    dataKey: ".",
                    columns: [
                        {label: "Data Source Name", style: {
                            padding: [0,4],
                            width: 160,
                            "vertical-align": "middle",
                            "line-height": "1em"
                        }, dataKey: "dataSourceName"}
                    ],
                    rowHeight: 40, 
                    rowBorderStyle: "1px solid rgba(0,0,0,0.6)",
                    rowHighlightStyle: "rgba(0,0,0,0.1)",
                    animate: true,
                    tapHandler: record => {
                        this.showDetailView(record);
                    }
                })
            ]),
            View(".dataSourceDetail", {style: {
                margin: 16,
                padding: 32,
                "max-width": 700,
                "background-color": "rgba(255,255,255,0.6)",
                "border-radius": 8,
                "user-select": "none",
                visibility: "hidden",
                position: "absolute",
            }})
        ]);

        this.view.styles = {
            ".list": {
                height: window.innerHeight * 0.2
            },
            ".list > thead > tr > td:last-child": {
                "background": "unset"
            }
        };

        this.loadDataSources();
        this.showContainer();

        let listView = this.view.querySelector(".dataSources");
        let detailView = this.view.querySelector(".dataSourceDetail");
        let width = window.innerWidth - listView.offsetLeft - 16*2;
        width = width < 700 ? width : 700;
        listView.style.width = width+"px";
        detailView.style.width = listView.style.width;
        detailView.style.top = listView.style.top+"px";
        detailView.style.left = (listView.offsetLeft + width)+"px";

        let resizeObserver = new ResizeObserver(observations => {
            if(observations.length == 0) return;
            let height1 = listView.offsetHeight;
            let height2 = detailView.offsetHeight;
            this.view.style.height = ((height1 > height2 ? height1 : height2)+16*2)+"px";
        });
        resizeObserver.observe(listView);
        resizeObserver.observe(detailView);
    }

    showContainer() {
        new FunctionalAnimation(progress => {
            this.view.style.opacity = progress;
        }, FunctionalAnimation.methods.easeInOut, 300).start();
    }

    loadDataSources() {
        HttpConnection.request(ContextPath+"/datasources", "GET").then(products => {
            this.data = products;
            this.reloadView();
        });
    }

    reloadView() {
        let table = this.view.querySelector(".list");
        let header = table.querySelector("thead");
        table.style.height = (header.offsetHeight + 40 * (this.data.length > 0 ? this.data.length : 1) + 4) + "px";
    }

    showDetailView(record) {
        let registerView = new DataSourceRegisterView();
        
        let data = copyRecord(record);
        let endpoint;
        endpoint = record.endpoints.find(endpoint => endpoint.type == "Authenticate");
        if(endpoint != null) {
            data.authenticateUrl = endpoint.url;
        }
        endpoint = record.endpoints.find(endpoint => endpoint.type == "GetFootprints");
        if(endpoint != null) {
            data.footprintsUrl = endpoint.url;
        }
        endpoint = record.endpoints.find(endpoint => endpoint.type == "UpdateEvent");
        if(endpoint != null) {
            data.eventsUrl = endpoint.url;
        }

        registerView.data = data;
        if(record.dataSourceId == null) {
            registerView.applyHandler = record => {
                if(record.authenticateUrl != null) {
                    record.endpoints.push({
                        type: "Authenticate",
                        url: record.authenticateUrl
                    });
                    delete record.authenticateUrl;
                }
                if(record.footprintsUrl != null) {
                    record.endpoints.push({
                        type: "GetFootprints",
                        url: record.footprintsUrl
                    });
                    delete record.footprintsUrl;
                }
                if(record.eventsUrl != null) {
                    record.endpoints.push({
                        type: "UpdateEvent",
                        url: record.eventsUrl
                    });
                    delete record.eventsUrl;
                }
                HttpConnection.request(ContextPath+"/datasources", "POST", record).then(response => {
                    this.loadDataSources();
                    this.dismissDetailView();
                });
            };
        }else {
            registerView.applyHandler = record => {
                if(record.authenticateUrl != null) {
                    let entpoint = record.endpoints.find(endpoint => endpoint.type == "Authenticate");
                    if(entpoint == null) {
                        entpoint = {type: "Authenticate"};
                        record.endpoints.push(entpoint);
                    }
                    entpoint.url = record.authenticateUrl;
                    delete record.authenticateUrl;
                }
                if(record.footprintsUrl != null) {
                    let entpoint = record.endpoints.find(endpoint => endpoint.type == "GetFootprints");
                    if(entpoint == null) {
                        entpoint = {type: "GetFootprints"};
                        record.endpoints.push(entpoint);
                    }
                    entpoint.url = record.footprintsUrl;
                    delete record.footprintsUrl;
                }
                if(record.eventsUrl != null) {
                    let entpoint = record.endpoints.find(endpoint => endpoint.type == "UpdateEvent");
                    if(entpoint == null) {
                        entpoint = {type: "UpdateEvent"};
                        record.endpoints.push(entpoint);
                    }
                    entpoint.url = record.eventsUrl;
                    delete record.eventsUrl;
                }
                HttpConnection.request(ContextPath+"/datasources/"+record.dataSourceId, "PUT", record).then(response => {
                    this.loadDataSources();
                    this.dismissDetailView();
                });
            };
            registerView.deleteHandler = record => {
                HttpConnection.request(ContextPath+"/datasources/"+record.dataSourceId, "DELETE", record).then(response => {
                    this.loadDataSources();
                    this.dismissDetailView();
                });
            };
        }
        registerView.dismissHandler = () => {
            this.loadDataSources();
            this.dismissDetailView();
        };

        let listView = this.view.querySelector(".dataSources");
        let detailView = this.view.querySelector(".dataSourceDetail");
        detailView.style.visibility = "visible";
        let width = listView.offsetWidth+16;
        let listViewX = listView.offsetLeft-16;
        let detailViewX = detailView.offsetLeft-16;
        new FunctionalAnimation(progress => {
            listView.style.left = (listViewX - width*progress)+"px";
            detailView.style.left = (detailViewX - width*progress)+"px";
        }, FunctionalAnimation.methods.easeInOut, 300).start().finish(() => {
            listView.style.visibility = "hidden";
        });
    }

    dismissDetailView() {
        let listView = this.view.querySelector(".dataSources");
        let detailView = this.view.querySelector(".dataSourceDetail");
        listView.style.visibility = "visible";
        let width = listView.offsetWidth+16;
        let listViewX = listView.offsetLeft-16;
        let detailViewX = detailView.offsetLeft-16;
        new FunctionalAnimation(progress => {
            listView.style.left = (listViewX + width*progress)+"px";
            detailView.style.left = (detailViewX + width*progress)+"px";
        }, FunctionalAnimation.methods.easeInOut, 300).start().finish(() => {
            detailView.style.visibility = "hidden";
        });
    }
}

class DataSourceRegisterView extends ViewController {

    constructor() {
        super();
        this.parent = "body > .main > .contents .dataSourceDetail";

        let dataSourceTypes = [
            {label: "Pathfinder", value: "Pathfinder"}
        ];

        this.view = View([
            View({style: {
                margin: [0,0,16,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Data Source"]),
            View({style: {
                margin: [0,0,16,0],
                "font-size": "small"
            }}, ["The data source name should be easy to understand, such as the name of another company or the name of an application."]),
            InputComposite({label: "Data Source Name", labelColor: "black", style: {position: "relative"}}, [
                TextField({dataKey: "dataSourceName", height: 24, required: "required", tabIndex:1}),
                RequiredLabel()
            ]),
            InputComposite({label: "Data Source Type", labelColor: "black", style: {position: "relative"}}, [
                Select({
                    dataKey: "dataSourceType",
                    style: {height: 24, "vertical-align": "middle"}, 
                    items: dataSourceTypes, 
                    valueKey: "value", 
                    labelHandler: item => {
                        return item["label"];
                    },
                    styleHandler: (item, current) => {
                        return {
                            display: current ? "inline" : "block",
                            padding: current ? 0 : [4,8],
                            "line-height": "normal"
                        };
                    },
                    tabIndex:2
                }),
                RequiredLabel()
            ]),
            InputComposite({label: "User Name", labelColor: "black", style: {position: "relative"}}, [
                TextField({dataKey: "userName", height: 24, autocomplete: "off", tabIndex:3}),
                RequiredLabel()
            ]),
            InputComposite({label: "Password", labelColor: "black", style: {position: "relative"}}, [
                PasswordField({dataKey: "password", height: 24, autocomplete: "new-password", tabIndex:4}),
                RequiredLabel()
            ]),
            View(".endpoints", {style: {margin: [32,0,16,0]}}),
            View({align: "center", style: {margin: [16,0,0,0]}}, [
                Button({label: "Register", style: {"font-weight":"600", margin: [0,8], color: Colors.ApplyButton}, blocking: true, tapHandler: button => {
                    this.register(button);
                }, tabIndex:5}),
                Button(".deleteButton", {label: "Delete", style: {margin: [0,8], display: "none"}, tapHandler: button => {
                    Controls.Message("This data will be deleted. Are you sure?", "confirm", "OK", () => {
                        this.deleteHandler(this.data);
                    });
                }, tabIndex:6}),
                Button({label: "Close", style: {margin: [0,8], color: Colors.CancelButton}, tapHandler: button => {
                    this.dismissHandler();
                }, tabIndex:7})
            ])
        ]);

        let endpointView = new EndpointRegisterView();

        this.dataLoadedHandler = () => {
            endpointView.data = this.data;

            if(this.data.dataSourceId != null) {
                this.view.querySelector(".deleteButton").style.display = "inline-block";
            }
        };
    }

    register(button) {
        if(!this.view.validate()) {
            button.restore();
            return;
        }
        this.applyHandler(this.data);
    }
}

class EndpointRegisterView extends ViewController {

    constructor() {
        super();
        this.parent = "body > .main > .contents .dataSourceDetail .endpoints";
        this.view = View([
            View({style: {
                margin: [0,0,16,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Endpoints"]),
            InputComposite({label: "Action Authenticate URL", labelColor: "black", style: {position: "relative"}}, [
                TextField({dataKey: "authenticateUrl", height: 24, required: "required", placeholder: "https://exsample.com/auth/token", tabIndex:4}),
                RequiredLabel()
            ]),
            InputComposite({label: "Action List Footprints URL", labelColor: "black", style: {position: "relative"}}, [
                TextField({dataKey: "footprintsUrl", height: 24, required: "required", placeholder: "https://exsample.com/2/footprints", tabIndex:5}),
                RequiredLabel()
            ]),
            InputComposite({label: "Action Events URL", labelColor: "black", style: {position: "relative"}}, [
                TextField({dataKey: "eventsUrl", height: 24, placeholder: "https://exsample.com/2/events", tabIndex:6})
            ])
        ]);
    }
}