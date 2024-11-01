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

class TaskView extends ViewController {

    constructor() {
        super();
        this.parent = "body > .main > .contents";
        this.data = [];
        this.view = View(".task", {style: {
            overflow: "hidden",
            opacity: 0
        }}, [
            View(".tasks", {style: {
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
                }}, ["Received Messages"]),
                Table(".receivedList", {
                    dataKey: "receivedTasks",
                    columns: [
                        {label: "Date", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "line-height": "1em",
                            width: 120
                        }, dataKey: "updatedDate", dataHandler: (cell, value, record) => {
                            cell.innerText = DateUtil.format(new Date(value), dateFormat+" HH:mm");
                        }},
                        {label: "From", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "line-height": "1em",
                            width: 120
                        }, dataKey: "clientOrganizationName"},
                        {label: "Status", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "line-height": "1em",
                            width: 96
                        }, dataKey: "status", dataHandler: (cell, value, record) => {
                            if(value == null) return;
                            let style;
                            if(value == "Unread" || value == "Pending") {
                                style = {
                                    display: "inline-block", 
                                    padding: 4,
                                    "font-size": "small",
                                    "border-radius": 4,
                                    "background-color": "black",
                                    color: "white"
                                };
                            }else if(value == "Rejected") {
                                style = {
                                    display: "inline-block", 
                                    padding: 4,
                                    "font-size": "small",
                                    "border-radius": 4,
                                    "background-color": "black",
                                    color: "white",
                                    opacity: 0.4
                                };
                            }else if(value == "Completed") {
                                style = {
                                    display: "inline-block", 
                                    padding: 4,
                                    "font-size": "small",
                                    "border-radius": 4,
                                    border: "1px solid black",
                                    color: "black"
                                };
                            }
                            cell.appendChild(View({style: style}, [value]))
                        }},
                        {label: "Message", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "line-height": "1em"
                        }, dataKey: "message", dataHandler: (cell, value, record) => {
                            if(value == null) return;
                            if(value.length > 100) {
                                value = value.substring(0, value.length) + "...";
                            }
                            cell.innerText = value;
                        }}
                    ],
                    rowHeight: 40, 
                    rowBorderStyle: "1px solid rgba(0,0,0,0.6)",
                    rowHighlightStyle: "rgba(0,0,0,0.1)",
                    animate: true,
                    tapHandler: record => {
                        HttpConnection.request(ContextPath+"/tasks/"+record.taskId, "GET").then(record => {
                            this.showDetailView(record);
                        });
                    }
                }),
                View({style: {
                    margin: [32,0,16,0],
                    "font-size": "1.5em",
                    "font-weight": 900
                }}, ["Sent Messages"]),
                Table(".sentList", {
                    dataKey: "sentTasks",
                    columns: [
                        {label: "Date", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "line-height": "1em",
                            width: 120
                        }, dataKey: "updatedDate", dataHandler: (cell, value, record) => {
                            cell.innerText = DateUtil.format(new Date(value), dateFormat+" HH:mm");
                        }},
                        {label: "To", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "line-height": "1em",
                            width: 120
                        }, dataKey: "recipientOrganizationName"},
                        {label: "Status", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "line-height": "1em",
                            width: 96
                        }, dataKey: "status", dataHandler: (cell, value, record) => {
                            if(value == null) return;
                            let style;
                            if(value == "Unread" || value == "Pending") {
                                style = {
                                    display: "inline-block", 
                                    padding: 4,
                                    "font-size": "small",
                                    "border-radius": 4,
                                    "background-color": "black",
                                    color: "white"
                                };
                            }else if(value == "Rejected") {
                                style = {
                                    display: "inline-block", 
                                    padding: 4,
                                    "font-size": "small",
                                    "border-radius": 4,
                                    "background-color": "black",
                                    color: "white",
                                    opacity: 0.4
                                };
                            }else if(value == "Completed") {
                                style = {
                                    display: "inline-block", 
                                    padding: 4,
                                    "font-size": "small",
                                    "border-radius": 4,
                                    border: "1px solid black",
                                    color: "black"
                                };
                            }
                            cell.appendChild(View({style: style}, [value]))
                        }},
                        {label: "Message", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "line-height": "1em"
                        }, dataKey: "message", dataHandler: (cell, value, record) => {
                            if(value == null) return;
                            if(value.length > 100) {
                                value = value.substring(0, value.length) + "...";
                            }
                            cell.innerText = value;
                        }}
                    ],
                    rowHeight: 40, 
                    rowBorderStyle: "1px solid rgba(0,0,0,0.6)",
                    rowHighlightStyle: "rgba(0,0,0,0.1)",
                    animate: true,
                    tapHandler: record => {
                        HttpConnection.request(ContextPath+"/tasks/"+record.taskId, "GET").then(record => {
                            this.showDetailView(record);
                        });
                    }
                }),
            ]),
            View(".taskDetail", {style: {
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
            ".receivedList": {
                height: window.innerHeight * 0.5 - 128
            },
            ".sentList": {
                height: window.innerHeight * 0.5 - 128
            }
        };

        HttpConnection.request(ContextPath+"/organization", "GET").then(organization => {
            this.organizationId = organization.organizationId;
            this.loadData();
        });
        this.showContainer();

        let listView = this.view.querySelector(".tasks");
        let detailView = this.view.querySelector(".taskDetail");
        let width = window.innerWidth - listView.offsetLeft - 16*2;
        width = width < 700 ? width : 700;
        listView.style.width = width+"px";
        detailView.style.width = listView.style.width;
        detailView.style.top = listView.style.top+"px";
        detailView.style.left = (listView.offsetLeft + width)+"px";
    }

    showContainer() {
        new FunctionalAnimation(progress => {
            this.view.style.opacity = progress;
        }, FunctionalAnimation.methods.easeInOut, 300).start();
    }

    loadData() {
        this.view.querySelector(".receivedList").animate = true;
        this.view.querySelector(".sentList").animate = true;
        Promise.all([
            HttpConnection.request(ContextPath+"/tasks/received", "GET"),
            HttpConnection.request(ContextPath+"/tasks/sent", "GET")
        ]).then(response => {
            this.data.receivedTasks = response[0];
            this.data.sentTasks = response[1];
            this.view.querySelector(".receivedList").animate = false;
            this.view.querySelector(".sentList").animate = false;
            this.reloadData();
        });
    }

    showDetailView(record) {
        let registerView = new TaskRegisterView();
        registerView.data = copyRecord(record);
        if(record.taskId == null) {
            registerView.applyHandler = record => {
                HttpConnection.request(ContextPath+"/tasks", "POST", record).then(response => {
                    this.loadData();
                    this.dismissDetailView();
                });
            };
        }else {
            registerView.applyHandler = record => {
                HttpConnection.request(ContextPath+"/tasks/"+record.taskId, "PUT", record).then(response => {
                    this.loadData();
                    this.dismissDetailView();
                });
            };
            registerView.deleteHandler = record => {
                HttpConnection.request(ContextPath+"/tasks/"+record.taskId, "DELETE", record).then(response => {
                    this.loadData();
                    this.dismissDetailView();
                });
            };
        }
        registerView.dismissHandler = () => {
            this.loadData();
            this.dismissDetailView();
        };

        let listView = this.view.querySelector(".tasks");
        let detailView = this.view.querySelector(".taskDetail");
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
        let listView = this.view.querySelector(".tasks");
        let detailView = this.view.querySelector(".taskDetail");
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

class TaskRegisterView extends ViewController {

    constructor() {
        super();
        this.parent = "body > .main > .contents > .task > .taskDetail";

        let statusList = [
            {value: "Unread", label: "Unread"},
            {value: "Pending", label: "Pending"},
            {value: "Rejected", label: "Rejected"},
            {value: "Completed", label: "Completed"}
        ];

        this.view = View([
            View({style: {
                margin: [0,0,16,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Task"]),
            View(".contents", {style: {overflow: "scroll"}}, [
                InputComposite({label: "Client Organization", labelColor: "black", style: {position: "relative"}}, [
                    View({dataKey: "clientOrganizationName", height: 24, style: {"line-height": "normal"}})
                ]),
                InputComposite({label: "Recipient Organization", labelColor: "black", style: {position: "relative"}}, [
                    View({dataKey: "recipientOrganizationName", height: 24, style: {"line-height": "normal"}})
                ]),
                InputComposite({label: "Type", labelColor: "black", style: {position: "relative"}}, [
                    View({dataKey: "taskType", height: 24, style: {"line-height": "normal"}, dataHandler: (element, value) => {
                        if(value == null) return;
                        if(value == "ProductFootprintNotification") {
                            element.innerText = "Product Footprint Notification";
                        }else if(value == "ProductFootprintRequest") {
                            element.innerText = "Product Footprint Request";
                        }else if(value == "ContractRequest") {
                            element.innerText = "Contract Request";
                        }
                    }})
                ]),
                InputComposite({label: "Status", labelColor: "black", style: {position: "relative"}}, [
                    Select({
                        dataKey: "status", 
                        items: statusList, 
                        valueKey: "value", 
                        labelHandler: item => {
                            return item["label"];
                        },
                        styleHandler: (item, current) => {
                            if(current) {
                                let style = {
                                    height: "auto",
                                    "line-height": "unset",
                                    display: "inline-block", 
                                    padding: 4,
                                    "border-radius": 4
                                };
                                if(item.value == "Unread" || item.value == "Pending") {
                                    style["background-color"] = "black";
                                    style["color"] = "white";
                                    style["opacity"] = 1;
                                    style["border"] = "none";
                                }else if(item.value == "Rejected") {
                                    style["background-color"] = "black";
                                    style["color"] = "white";
                                    style["opacity"] = 0.4;
                                    style["border"] = "none";
                                }else if(item.value == "Completed") {
                                    style["background-color"] = "transparent";
                                    style["color"] = "black";
                                    style["opacity"] = 1;
                                    style["border"] = "1px solid black";
                                }
                                return style;
                            }else {
                                return {
                                    display: "block",
                                    padding: [4,8],
                                    "line-height": "normal"
                                };
                            }
                        },
                        tabIndex: 1
                    }),
                ]),
                InputComposite({label: "Message", labelColor: "black", style: {position: "relative"}}, [
                    View({dataKey: "message", style: {"min-height": 24, "line-height": "1em"}})
                ]),
                InputComposite({label: "UpdatedDate", labelColor: "black", style: {position: "relative"}}, [
                    View({dataKey: "updatedDate", height: 24, style: {"line-height": "normal"}, dataHandler: (element, value) => {
                        if(value == null) return;
                        element.innerText = DateUtil.format(new Date(value), dateFormat+" HH:mm");
                    }})
                ]),
                InputComposite(".productNameField", {label: "ProductName", labelColor: "black", style: {position: "relative", display: "none"}}, [
                    View({dataKey: "productName", height: 24, style: {"line-height": "normal"}})
                ]),
                InputComposite({label: "Data", labelColor: "black", style: {position: "relative"}}, [
                    View(".dataView")
                ])
            ]),
            View(".controls", {align: "center", style: {margin: [16,0,0,0]}}, [
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
                }, tabIndex:6})
            ])
        ]);

        let contentsView = this.view.querySelector(".contents");
        let controlsView = this.view.querySelector(".controls");
        contentsView.style.maxHeight = (window.innerHeight - contentsView.offsetTop - controlsView.offsetHeight - 96)+"px";

        this.dataLoadedHandler = () => {
            if(this.data.taskId != null) {
                this.view.querySelector(".deleteButton").style.display = "inline-block";
            }
            if(this.data.replyMessage != null) {
                this.view.querySelector(".replyMessageField").style.display = "block";
            }
            if(this.data.productId != null) {
                this.view.querySelector(".productNameField").style.display = "block";
            }
            if(this.data.data != null) {
                this.loadTaskData();
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

    loadTaskData() {
        let data = this.data.data;
        let dataView = this.view.querySelector(".dataView");
        Object.keys(data).forEach(key => {
            let value = data[key];
            if(value == null) return; 
            if(key == "dataId") {
                dataView.appendChild(
                    InputComposite({label: "PF ID", labelColor: "black"}, [
                        View({height: 24, style: {"line-height": "normal"}}, [value])
                    ])
                );
            }else if(key == "version") {
                dataView.appendChild(
                    InputComposite({label: "Version", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 8px)", margin: 4}}, [
                        View({height: 24, style: {"line-height": "normal"}}, [value])
                    ])
                );
            }else if(key == "updatedDate") {
                dataView.appendChild(
                    InputComposite({label: "Updated Date", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 8px)", margin: 4}}, [
                        View({height: 24, style: {"line-height": "normal"}}, [DateUtil.format(new Date(value), dateFormat+" HH:mm")])
                    ])
                );
            }else if(key == "status") {
                dataView.appendChild(
                    InputComposite({label: "Status", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 8px)", margin: 4}}, [
                        View({height: 24, style: {"line-height": "normal"}}, [value])
                    ])
                );
            }else if(key == "availableStartDate") {
                dataView.appendChild(
                    InputComposite({label: "Available Start Date", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 8px)", margin: 4}}, [
                        View({height: 24, style: {"line-height": "normal"}}, [DateUtil.format(new Date(value), dateFormat+" HH:mm")])
                    ])
                );
            }else if(key == "availableEndDate") {
                dataView.appendChild(
                    InputComposite({label: "Available End Date", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 8px)", margin: 4}}, [
                        View({height: 24, style: {"line-height": "normal"}}, [DateUtil.format(new Date(value), dateFormat+" HH:mm")])
                    ])
                );
            }else if(key == "organization") {
                if(value.organizationName != null) {
                    dataView.appendChild(
                        InputComposite({label: "Organization Name", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 8px)", margin: 4}}, [
                            View({height: 24, style: {"line-height": "normal"}}, [value.organizationName])
                        ])
                    );
                }
                if(value.identifiers != null) {
                    dataView.appendChild(
                        InputComposite({label: "Organization Indentifiers", labelColor: "black"}, value.identifiers.map(identifier => {
                            return View({style: {
                                display: "inline-block",
                                border: "1px solid gray",
                                "border-radius": 4,
                                padding: 4
                            }}, [identifier.code])
                        }))
                    );
                }
            }else if(key == "product") {
                if(value.productName != null) {
                    dataView.appendChild(
                        InputComposite({label: "Product Name", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 8px)", margin: 4}}, [
                            View({height: 24, style: {"line-height": "normal"}}, [value.productName])
                        ])
                    );
                }
                if(value.productDescription != null) {
                    dataView.appendChild(
                        InputComposite({label: "Product Name", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 8px)", margin: 4}}, [
                            View({height: 24, style: {"line-height": "normal"}}, [value.productDescription])
                        ])
                    );
                }
                if(value.identifiers != null) {
                    dataView.appendChild(
                        InputComposite({label: "Product Indentifiers", labelColor: "black"}, value.identifiers.map(identifier => {
                            return View({style: {
                                display: "inline-block",
                                border: "1px solid gray",
                                "border-radius": 4,
                                padding: 4
                            }}, [identifier.code])
                        }))
                    );
                }
                if(value.productCategoryCpc != null) {
                    dataView.appendChild(
                        InputComposite({label: "Product Name", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 8px)", margin: 4}}, [
                            View({height: 24, style: {"line-height": "normal"}}, [value.productCategoryCpc])
                        ])
                    );
                }
            }
        });
    }
}

class RequestRegisterView extends PopoverViewController {

    constructor() {
        super();
        this.parent = "body";
        this.container.style.backgroundColor = "white";
        this.container.style.padding = "24px";
        this.container.style.borderRadius = "8px";
        this.view = View({width: 420}, [
            View({style: {
                margin: [0,0,16,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Request"]),
            InputComposite({label: "Destination", labelColor: "black", style: {position: "relative"}}, [
                View({dataKey: "recipientOrganizationName", height: 24})
            ]),
            InputComposite({label: "Message", labelColor: "black", style: {position: "relative"}}, [
                TextField({dataKey: "message", height: 24, required: "required", tabIndex:1}),
                RequiredLabel()
            ]),
            View({align: "center", style: {margin: [16,0,0,0]}}, [
                Button({label: "Send", style: {"font-weight":"600", margin: [0,8], color: Colors.ApplyButton}, tapHandler: button => {
                    this.register(button);
                }, tabIndex:2}),
                Button({label: "Cancel", style: {margin: [0,8], color: Colors.CancelButton}, tapHandler: button => {
                    this.dismiss();
                }, tabIndex:3})
            ])
        ]);
    }

    register(button) {
        if(!this.view.validate()) {
            button.restore();
            return;
        }
        this.applyHandler(this.data);
        this.dismiss();
    }
}