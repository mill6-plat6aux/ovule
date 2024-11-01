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

class OrganizationView extends ViewController {

    constructor() {
        super();
        this.parent = "body > .main > .contents";
        this.view = View({style: {
            opacity: 0
        }}, [
            View(".organization", {style: {
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
                }}, ["Organization"]),
                InputComposite({label: "Organization Name", labelColor: "black", style: {margin: [16,0], position: "relative"}}, [
                    TextField({dataKey: "organizationName", height: 24, required: "required", tabIndex:1, changeHandler: () => {
                        this.updateOrganization();
                    }}),
                    RequiredLabel()
                ]),
                InputComposite({label: "Identifier", labelColor: "black", style: {margin: [16,0], position: "relative"}}, [
                    View(".identifiers", [
                        View(".addButton", {style:{
                            display: "inline-block",
                            "vertical-align": "middle",
                            width: 24,
                            height: 24,
                            "background-image": "images/add.svg",
                            "background-repeat": "no-repeat",
                            "background-size": 20,
                            "background-position": "center",
                            cursor: "pointer"
                        }, tapHandler: () => {
                            let registerView = new IdentifierRegisterView("Organization Identifier", "Company");
                            registerView.data = {type: "UUID"};
                            registerView.applyHandler = data => {
                                this.data.identifiers.push({type: data.type, code: data.code});
                                this.updateOrganization();
                                this.loadOrganizationIdentifiers(this.data.identifiers);
                            };
                        }})
                    ]),
                    RequiredLabel()
                ]),
                View(".organizations", {style: {margin: [32,0,16,0]}}),
                View(".users", {style: {margin: [32,0,16,0]}}),
            ]),
            View(".userDetail", {style: {
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

        this.dataLoadedHandler = () => {
            new OrganizationListView(this.data.organizationId);

            let userListView = new UserListView(this.data.organizationId);
            userListView.detailHandler = record => {
                this.showDetailView(record);
            };
            this.userListView = userListView;
        };

        this.loadData();
        this.showContainer();

        let organizationView = this.view.querySelector(".organization");
        let detailView = this.view.querySelector(".userDetail");
        let width = window.innerWidth - organizationView.offsetLeft - 16*2;
        width = width < 700 ? width : 700;
        organizationView.style.width = width+"px";
        detailView.style.width = organizationView.style.width;
        detailView.style.top = organizationView.style.top+"px";
        detailView.style.left = (organizationView.offsetLeft + width)+"px";

        let resizeObserver = new ResizeObserver(observations => {
            if(observations.length == 0) return;
            let height1 = organizationView.offsetHeight;
            let height2 = detailView.offsetHeight;
            this.view.style.height = ((height1 > height2 ? height1 : height2)+16*2)+"px";
        });
        resizeObserver.observe(organizationView);
        resizeObserver.observe(detailView);
    }

    showContainer() {
        new FunctionalAnimation(progress => {
            this.view.style.opacity = progress;
        }, FunctionalAnimation.methods.easeInOut, 300).start();
    }

    loadData() {
        HttpConnection.request(ContextPath+"/organization", "GET").then(response => {
            this.data = response;
            this.loadOrganizationIdentifiers(this.data.identifiers);
        });
    }

    updateOrganization() {
        if(!this.view.validate()) {
            button.restore();
            return;
        }
        let reuqest = this.data;
        HttpConnection.request(ContextPath+"/organizations/"+this.data.organizationId, "PUT", reuqest);
    }

    loadOrganizationIdentifiers(identifiers) {
        this.view.querySelectorAll(".identifier").forEach(element => {
            element.remove();
        });
        identifiers.forEach(identifier => {
            this.addOrganizationIdentifier(identifier);
        });
    }

    addOrganizationIdentifier(identifier) {
        let self = this;
        let addButton = this.view.querySelector(".identifiers > .addButton");
        addButton.before(View(".identifier", {style: {
            display: "inline-block",
            "vertical-align": "middle",
            "border-radius": 4,
            border: "1px solid gray",
            "white-space": "nowrap",
            padding: 4,
            margin: 4
        }}, [
            View({style:{
                display: "inline-block",
                "vertical-align": "middle",
                "user-select": "text",
                padding: [0,4]
            }}, [identifier.code]),
            View({style:{
                display: "inline-block",
                "vertical-align": "middle",
                width: 24,
                height: 24,
                "background-image": "images/remove.svg",
                "background-repeat": "no-repeat",
                "background-size": 16,
                "background-position": "center",
                cursor: "pointer"
            }, tapHandler: () => {
                Controls.Message("Are you sure you want to delete?", "warning", () => {
                    let index = this.data.identifiers.find(_identifier => _identifier.code == identifier.code && _identifier.type == identifier.type);
                    this.data.identifiers.splice(index, 1);
                    this.updateOrganization();
                    this.loadOrganizationIdentifiers(this.data.identifiers);
                }, function() {})
            }})
        ]));
    }

    showDetailView(record) {
        let registerView = new UserRegisterView();
        registerView.data = copyRecord(record);
        if(record.userId == null) {
            registerView.applyHandler = record => {
                HttpConnection.request(ContextPath+"/lablab"+"/users", "POST", record).then(response => {
                    this.userListView.loadData();
                    this.dismissDetailView();
                });
            };
        }else {
            registerView.applyHandler = record => {
                HttpConnection.request(ContextPath+"/lablab"+"/users/"+record.userId, "PUT", record).then(response => {
                    this.userListView.loadData();
                    this.dismissDetailView();
                });
            };
            registerView.deleteHandler = record => {
                HttpConnection.request(ContextPath+"/lablab"+"/users/"+record.userId, "DELETE", record).then(response => {
                    this.userListView.loadData();
                    this.dismissDetailView();
                });
            };
        }
        registerView.dismissHandler = () => {
            this.userListView.loadData();
            this.dismissDetailView();
        };

        let organizationView = this.view.querySelector(".organization");
        let detailView = this.view.querySelector(".userDetail");
        detailView.style.visibility = "visible";
        let width = organizationView.offsetWidth+16;
        let listViewX = organizationView.offsetLeft-16;
        let detailViewX = detailView.offsetLeft-16;
        new FunctionalAnimation(progress => {
            organizationView.style.left = (listViewX - width*progress)+"px";
            detailView.style.left = (detailViewX - width*progress)+"px";
        }, FunctionalAnimation.methods.easeInOut, 300).start().finish(() => {
            organizationView.style.visibility = "hidden";
        });
    }

    dismissDetailView() {
        let organizationView = this.view.querySelector(".organization");
        let detailView = this.view.querySelector(".userDetail");
        organizationView.style.visibility = "visible";
        let width = organizationView.offsetWidth+16;
        let listViewX = organizationView.offsetLeft-16;
        let detailViewX = detailView.offsetLeft-16;
        new FunctionalAnimation(progress => {
            organizationView.style.left = (listViewX + width*progress)+"px";
            detailView.style.left = (detailViewX + width*progress)+"px";
        }, FunctionalAnimation.methods.easeInOut, 300).start().finish(() => {
            detailView.style.visibility = "hidden";
        });
    }
}

class OrganizationListView extends ViewController {

    /**
     * @param {number} parentOrganizationId 
     */
    constructor(parentOrganizationId) {
        super();
        this.parentOrganizationId = parentOrganizationId;
        this.parent = "body > .main > .contents .organization .organizations";
        this.view = View([
            View({style: {
                margin: [0,0,8,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Business Partners"]),
            View({style: {
                margin: [0,0,16,0],
                "font-size": "small"
            }}, ["Register suppliers of parts and product deliveries."]),
            View({height: 40}, [
                Button(".addButton", {style: {
                    "background-image": "images/add.svg",
                    "background-position": [0, "center"],
                    "background-size": 16,
                    "background-repeat": "no-repeat",
                    padding: [8,8,8,20],
                }, tapHandler: () => {
                    let record = {
                        parentOrganizationId: this.parentOrganizationId,
                        organizationId: null,
                        organizationName: null,
                        organizationType: "BusinessPartner",
                        identifiers: []
                    };
                    let editor = new OrganizationRegisterView();
                    editor.data = record;
                    editor.applyHandler = record => {
                        this.updateData(record);
                    };
                }}, ["Add"])
            ]),
            Table(".list", {
                dataKey: ".",
                columns: [
                    {label: "Company Name", style: {
                        padding: 8,
                        "vertical-align": "middle",
                        "line-height": "1em"
                    }, dataKey: "organizationName"}
                ],
                rowHeight: 40, 
                rowBorderStyle: "1px solid rgba(0,0,0,0.6)",
                rowHighlightStyle: "rgba(0,0,0,0.1)",
                animate: true,
                tapHandler: (record, rowIndex, row, event) => {
                    let editor = new OrganizationRegisterView();
                    editor.data = copyRecord(record);
                    editor.applyHandler = record => {
                        this.updateData(record);
                    };
                    editor.deleteHandler = record => {
                        this.deleteData(record);
                    };
                }
            })
        ]);

        this.view.styles = {
            ".list > thead > tr > td:last-child": {
                "background": "unset"
            }
        };

        this.loadData();
    }

    loadData() {
        HttpConnection.request(ContextPath+"/organizations?parentOrganizationId="+this.parentOrganizationId, "GET").then(response => {
            this.data = response;
            this.reloadData();
            this.reloadView();
        });
    }

    reloadView() {
        let table = this.view.querySelector(".list");
        let header = table.querySelector("thead");
        table.style.height = (header.offsetHeight + 40 * (this.data.length > 0 ? this.data.length : 1) + 4) + "px";
    }

    updateData(record) {
        if(record.organizationId == null) {
            HttpConnection.request(ContextPath+"/organizations", "POST", record).then(response => {
                this.loadData();
            });
        }else {
            HttpConnection.request(ContextPath+"/organizations/"+record.organizationId, "PUT", record).then(response => {
                this.loadData();
            });
        }
    }

    deleteData(record) {
        if(record.organizationId == null) return;
        HttpConnection.request(ContextPath+"/organizations/"+record.organizationId, "DELETE").then(response => {
            this.loadData();
        });
    }
}

class OrganizationRegisterView extends PopoverViewController {

    constructor() {
        super();
        this.parent = "body";
        this.container.style.backgroundColor = "white";
        this.container.style.padding = "24px";
        this.container.style.borderRadius = "8px";

        this.view = View({width: 460}, [
            View({style: {
                margin: [0,0,16,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Business Partner"]),
            InputComposite({label: "Company Name", labelColor: "black", style: {margin: [16,0], position: "relative"}}, [
                TextField({dataKey: "organizationName", height: 24, required: "required", tabIndex:1}),
                RequiredLabel()
            ]),
            InputComposite({label: "Identifier", labelColor: "black", style: {margin: [16,0], position: "relative"}}, [
                View(".identifiers", [
                    View(".addButton", {style:{
                        display: "inline-block",
                        "vertical-align": "middle",
                        width: 24,
                        height: 24,
                        "background-image": "images/add.svg",
                        "background-repeat": "no-repeat",
                        "background-size": 20,
                        "background-position": "center",
                        cursor: "pointer"
                    }, tapHandler: () => {
                        let registerView = new IdentifierRegisterView("Organization Identifier", "Company");
                        registerView.data = {type: "UUID"};
                        registerView.applyHandler = data => {
                            this.data.identifiers.push({type: data.type, code: data.code});
                            this.loadOrganizationIdentifiers(this.data.identifiers);
                        };
                    }, tabIndex:2})
                ]),
                RequiredLabel()
            ]),
            View({align: "center", style: {margin: [16,0,0,0]}}, [
                Button({label: "Register", style: {"font-weight":"600", margin: [0,8], color: Colors.ApplyButton}, tapHandler: button => {
                    this.register(button);
                }, tabIndex:3}),
                Button(".deleteButton", {label: "Delete", style: {display: "none", margin: [0,8]}, tapHandler: button => {
                    this.deleteHandler(this.data);
                    this.dismiss();
                }, tabIndex:3}),
                Button({label: "Cancel", style: {margin: [0,8], color: Colors.CancelButton}, tapHandler: button => {
                    this.dismiss();
                }, tabIndex:4})
            ])
        ]);

        this.dataLoadedHandler = () => {
            if(this.data.organizationId != null) {
                this.view.querySelector(".deleteButton").style.display = "inline-block";
            }
            this.loadOrganizationIdentifiers(this.data.identifiers);
        };
    }

    loadOrganizationIdentifiers(identifiers) {
        this.view.querySelectorAll(".identifier").forEach(element => {
            element.remove();
        });
        identifiers.forEach(identifier => {
            this.addOrganizationIdentifier(identifier);
        });
    }

    addOrganizationIdentifier(identifier) {
        let self = this;
        let addButton = this.view.querySelector(".identifiers > .addButton");
        addButton.before(View(".identifier", {style: {
            display: "inline-block",
            "vertical-align": "middle",
            "border-radius": 4,
            border: "1px solid gray",
            "white-space": "nowrap",
            padding: 4,
            margin: 4
        }}, [
            View({style:{
                display: "inline-block",
                "vertical-align": "middle",
                "user-select": "text",
                padding: [0,4]
            }}, [identifier.code]),
            View({style:{
                display: "inline-block",
                "vertical-align": "middle",
                width: 24,
                height: 24,
                "background-image": "images/remove.svg",
                "background-repeat": "no-repeat",
                "background-size": 16,
                "background-position": "center",
                cursor: "pointer"
            }, tapHandler: () => {
                Controls.Message("Are you sure you want to delete?", "warning", () => {
                    let index = this.data.identifiers.find(_identifier => _identifier.code == identifier.code && _identifier.type == identifier.type);
                    this.data.identifiers.splice(index, 1);
                    this.updateOrganization();
                    this.loadOrganizationIdentifiers(this.data.identifiers);
                }, function() {})
            }})
        ]));
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

class UserListView extends ViewController {

    /**
     * @param {number} parentOrganizationId 
     */
    constructor(parentOrganizationId) {
        super();
        this.parentOrganizationId = parentOrganizationId;
        this.parent = "body > .main > .contents .organization .users";
        this.data = {};
        this.view = View([
            View({style: {
                margin: [0,0,8,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Users"]),
            View({style: {
                margin: [0,0,16,0],
                "font-size": "small"
            }}, ["If you want to allow access from other companies' applications, please add a user whose Type is Pathfinder."]),
            View({height: 40}, [
                Button(".addButton", {style: {
                    "background-image": "images/add.svg",
                    "background-position": [0, "center"],
                    "background-size": 16,
                    "background-repeat": "no-repeat",
                    padding: [8,8,8,20],
                }, tapHandler: () => {
                    let record = {
                        userId: null,
                        userName: null,
                        password: null,
                        userType: "General",
                        organizationId: this.parentOrganizationId,
                        privileges: []
                    };
                    this.detailHandler(record);
                }}, ["Add"])
            ]),
            Table(".list", {
                dataKey: "users",
                columns: [
                    {label: "User Name", style: {
                        padding: 8,
                        "vertical-align": "middle",
                        "line-height": "1em"
                    }, dataKey: "userName"},
                    {label: "Organization", style: {
                        "vertical-align": "middle",
                        padding: [0,4],
                        width: 160
                    }, dataKey: "organizationName"},
                    {label: "Type", style: {
                        "vertical-align": "middle",
                        padding: [0,4],
                        width: 80
                    }, dataKey: "userType", dataHandler: (cell, value, record) => {
                        if(value == null) return;
                        let style = {
                            display: "inline-block",
                            "font-size": "x-small",
                            "border-radius": 4,
                            padding: 4,
                            "line-height": "1em"
                        };
                        if(value == "General") {
                            style["border"] = "1px solid black";
                        }else {
                            style["background-color"] = "black";
                            style["color"] = "white";
                        }
                        cell.appendChild(View({style: style}, [value]));
                    }}
                ],
                rowHeight: 40, 
                rowBorderStyle: "1px solid rgba(0,0,0,0.6)",
                rowHighlightStyle: "rgba(0,0,0,0.1)",
                animate: true,
                tapHandler: (record, rowIndex, row, event) => {
                    this.detailHandler(record);
                }
            })
        ]);

        this.view.styles = {
            ".list > thead > tr > td:last-child": {
                "background": "unset"
            }
        };

        this.loadData();
    }

    loadData() {
        Promise.all([
            HttpConnection.request(ContextPath+"/organizations/"+this.parentOrganizationId, "GET"),
            HttpConnection.request(ContextPath+"/organizations?parentOrganizationId="+this.parentOrganizationId, "GET"),
            HttpConnection.request(ContextPath+"/lablab"+"/users", "GET")
        ]).then(results => {
            let organization = results[0];
            let organizations = results[1];
            organizations.push(organization);
            let users = results[2];
            users.forEach(user => {
                user.organizationName = organizations.find(organization => organization.organizationId == user.organizationId).organizationName;
            });
            this.data.users = users;
            this.reloadData();
            this.reloadView();
        });
    }

    reloadView() {
        let table = this.view.querySelector(".list");
        let header = table.querySelector("thead");
        table.style.height = (header.offsetHeight + 40 * (this.data.users.length > 0 ? this.data.users.length : 1) + 4) + "px";
    }
}

class UserRegisterView extends ViewController {

    constructor() {
        super();
        this.parent = "body > .main > .contents .userDetail";

        let userTypes = [
            {label: "General", value: "General"},
            {label: "Pathfinder", value: "Pathfinder"},
            {label: "Harmony", value: "Harmony"}
        ];

        this.view = View([
            View({style: {
                margin: [0,0,16,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["User"]),
            InputComposite({label: "User Name", labelColor: "black", style: {position: "relative"}}, [
                TextField({dataKey: "userName", height: 24, autocomplete: "off", tabIndex:1}),
                RequiredLabel()
            ]),
            InputComposite({label: "Password", labelColor: "black", style: {position: "relative"}}, [
                PasswordField({dataKey: "password", height: 24, autocomplete: "new-password", pattern: "^(?=.*?[0-9])(?=.*?[a-z])(?=.*?[A-Z])(?=.*?[~!@#$%^*\\(\\)\\{\\}_\\-=\\[\\]\\|:;\"'<>?,.\\/])[0-9a-zA-Z~!@#$%^*\\(\\)\\{\\}_\\-=\\[\\]\\|:;\"'<>?,.\\/]{8,}$", title: "Password should contain at least one uppercase letter, lowercase letter, number, or symbol.", tabIndex:2}),
                RequiredLabel()
            ]),
            InputComposite(".organizationField", {label: "Organization", labelColor: "black", style: {position: "relative"}}, [
                View(".organizationNameDisplayField", {dataKey: "organizationName", style: {height: 24, "line-height": "normal"}, tapHandler: event => {
                    let view = event.target;
                    view.style.display = "none";
                    let addOrganizationButton = this.view.querySelector(".addOrganizationButton");
                    addOrganizationButton.style.display = "inline-block";
                    let organizationNameField = this.view.querySelector(".organizationNameField");
                    if(this.data.organizationName != null) {
                        organizationNameField.value = this.data.organizationName;
                    }
                    organizationNameField.style.display = "inline-block";
                    organizationNameField.style.width = "calc(100% - "+this.view.querySelector(".addOrganizationButton").offsetWidth+"px)";
                    organizationNameField.focus();
                }}),
                TextField(".organizationNameField", {placeholder: "Organization Name", style: {height: 24,  display: "none"}, changeHandler: event => {
                    let textField = event.target;
                    let organizationName = textField.value;
                    if(organizationName == null || organizationName.length == 0) {
                        textField.style.display = "none";
                        this.view.querySelector(".addOrganizationButton").style.display = "none";
                        this.view.querySelector(".organizationNameDisplayField").style.display = "block";
                        return;
                    }
                    HttpConnection.request(ContextPath+"/organizations?organizationName="+organizationName, "GET").then(organizations => {
                        if(organizations.length == 0) {
                            Controls.Message("Organization not found.", "info", "OK", function() {});
                            return;
                        }
        
                        if(organizations.length == 1) {
                            this.data.organizationId = organizations[0].organizationId;
                            this.data.organizationName = organizations[0].organizationName;
                            let addOrganizationButton = this.view.querySelector(".addOrganizationButton");
                            let organizationNameField = this.view.querySelector(".organizationNameField");
                            addOrganizationButton.style.display = "none";
                            organizationNameField.style.display = "none";
                            this.view.querySelector(".organizationNameDisplayField").style.display = "block";
                            this.reloadData();
                            return;
                        }
        
                        let mask = View({style: {
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: "100%",
                            height: "100%"
                        }, tapHandler: event => {
                            event.currentTarget.remove();
                        }});
                        document.body.appendChild(mask);
        
                        let offset = HtmlElementUtil.offset(textField);
                        
                        let view = View({style: {
                            position: "absolute",
                            "max-width": textField.offsetWidth,
                            "max-height": 24*3.5,
                            "overflow-y": "scroll",
                            top: (offset.top+textField.offsetHeight)+"px",
                            left: offset.left+"px",
                            "background-color": "#FFF",
                            border: "1px solid gray",
                            "cursor": "default"
                        }}, organizations.map((organization, index) => {
                            return View(".item", {tabindex: index+1, style: {
                                "line-height": "1em",
                                padding: 8
                            }, tapHandler: event => {
                                this.data.organizationId = organization.organizationId;
                                this.data.organizationName = organization.organizationName;
                                let addOrganizationButton = this.view.querySelector(".addOrganizationButton");
                                let organizationNameField = this.view.querySelector(".organizationNameField");
                                addOrganizationButton.style.display = "none";
                                organizationNameField.style.display = "none";
                                this.view.querySelector(".organizationNameDisplayField").style.display = "block";
                                this.reloadData();
                            }}, [organization.organizationName]);
                        }));
                        view.addEventListener("keydown", event => {
                            let selection = event.currentTarget;
                            let items = selection.querySelectorAll(".item");
                            if(event.code == "Enter" || event.code == "Space") {
                                if(document.activeElement != null) {
                                    let index = -1;
                                    for(let i=0; i<items.length; i++) {
                                        if(items[i] == document.activeElement) {
                                            index = i;
                                            break;
                                        }
                                    }
                                    let selectedItem = items[index];
                                    selectedItem.dispatchEvent(new MouseEvent("click"));
                                    event.preventDefault();
                                    mask.remove();
                                }
                            }else if(event.code == "ArrowDown" || event.code == "ArrowUp") {
                                if(document.activeElement == null) {
                                    items[0].focus();
                                }else {
                                    let index = -1;
                                    for(let i=0; i<items.length; i++) {
                                        if(items[i] == document.activeElement) {
                                            index = i;
                                            break;
                                        }
                                    }
                                    if(event.code == "ArrowDown") {
                                        if(index < items.length-1) {
                                            items[index+1].focus();
                                        }else {
                                            items[0].focus();
                                        }
                                    }else {
                                        if(index > 0) {
                                            items[index-1].focus();
                                        }else {
                                            items[items.length-1].focus();
                                        }
                                    }
                                }
                            }
                        });
                        mask.appendChild(view);
                        view.querySelector(".item").focus();
                    });
                }}),
                View(".addOrganizationButton", {title: "Add Organization", style:{
                    display: "none",
                    "vertical-align": "middle",
                    width: 24,
                    height: 24,
                    "background-image": "images/add.svg",
                    "background-repeat": "no-repeat",
                    "background-size": 20,
                    "background-position": "center",
                    cursor: "pointer"
                }, tapHandler: () => {
                    Module.loadLogic("js/organization-view.js", () => {
                        let editor = new OrganizationRegisterView();
                        editor.data = {organizationId: null, organizationName: null, organizationType: "BusinessPartner", identifiers:[]};
                        editor.applyHandler = record => {
                            HttpConnection.request(ContextPath+"/organizations", "POST", record).then(organization => {
                                this.data.organizationId = organization.organizationId;
                                this.data.organizationName = record.organizationName;
                                let addOrganizationButton = this.view.querySelector(".addOrganizationButton");
                                let organizationNameField = this.view.querySelector(".organizationNameField");
                                addOrganizationButton.style.display = "none";
                                organizationNameField.style.display = "none";
                                this.reloadData();
                            });
                        };
                    });
                }, tabIndex:3}),
                RequiredLabel()
            ]),
            InputComposite({label: "Type", labelColor: "black", style: {position: "relative"}}, [
                Select({
                    dataKey: "userType",
                    style: {height: 24, "vertical-align": "middle"}, 
                    items: userTypes, 
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
                    selectHandler: selectedIndex => {
                        this.data.userType = userTypes[selectedIndex].value;
                        if(this.data.userType == "Pathfinder") {
                            this.data.readProductFootprint = true;
                            this.data.writeProducts = true;
                            this.data.writeEmissionFactor = true;
                            this.data.writeProductFootprint = true;
                            this.data.writeTask = true;
                        }else if(this.data.userType == "Harmony") {
                            this.data.readOrganization = true;
                            this.data.writeOrganization = true;
                            this.data.readDataSource = true;
                            this.data.writeDataSource = true;
                            this.data.readProducts = true;
                            this.data.writeProducts = true;
                            this.data.writeProductFootprint = true;
                            this.data.writeTask = true;
                        }
                        this.reloadData();
                    },
                    tabIndex:4
                }),
                RequiredLabel()
            ]),
            InputComposite({label: "Privileges", labelColor: "black", style: {position: "relative"}}, [
                InputComposite({label: "Read", labelColor: "black", style: {position: "relative"}}, [
                    Checkbox({dataKey: "readOrganization", label: "Business Partner", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:5}),
                    Checkbox({dataKey: "readUsers", label: "Users", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:6}),
                    Checkbox({dataKey: "readProducts", label: "Products", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:7}),
                    Checkbox({dataKey: "readEmissionFactor", label: "Emission Factor", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:8}),
                    Checkbox({dataKey: "readProductActivity", label: "Product Activity", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:9}),
                    Checkbox({dataKey: "readProductFootprint", label: "Product Footprint", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:10}),
                    Checkbox({dataKey: "readDataSource", label: "Data Source", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:11}),
                    Checkbox({dataKey: "readTask", label: "Task", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:12})
                ]),
                InputComposite({label: "Write", labelColor: "black", style: {position: "relative"}}, [
                    Checkbox({dataKey: "writeOrganization", label: "Business Partner", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:13}),
                    Checkbox({dataKey: "writeUsers", label: "Users", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:14}),
                    Checkbox({dataKey: "writeProducts", label: "Products", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:15}),
                    Checkbox({dataKey: "writeEmissionFactor", label: "Emission Factor", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:16}),
                    Checkbox({dataKey: "writeProductActivity", label: "Product Activity", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:17}),
                    Checkbox({dataKey: "writeProductFootprint", label: "Product Footprint", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:18}),
                    Checkbox({dataKey: "writeDataSource", label: "Data Source", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:19}),
                    Checkbox({dataKey: "writeTask", label: "Task", style: {display: "inline-block", margin: [0,16,0,0]}, tabIndex:20})
                ])
            ]),
            View({align: "center", style: {margin: [16,0,0,0]}}, [
                Button({label: "Register", style: {"font-weight":"600", margin: [0,8], color: Colors.ApplyButton}, blocking: true, tapHandler: button => {
                    this.register(button);
                }, tabIndex:21}),
                Button(".deleteButton", {label: "Delete", style: {margin: [0,8], display: "none"}, tapHandler: button => {
                    Controls.Message("This data will be deleted. Are you sure?", "confirm", "OK", () => {
                        this.deleteHandler(this.data);
                    });
                }, tabIndex:22}),
                Button({label: "Close", style: {margin: [0,8], color: Colors.CancelButton}, tapHandler: button => {
                    this.dismissHandler();
                }, tabIndex:23})
            ])
        ]);

        this.dataLoadedHandler = () => {
            if(this.data.userId != null) {
                this.view.querySelector(".deleteButton").style.display = "inline-block";
            }

            this.data.readOrganization = this.data.privileges.findIndex(privilege => privilege.permission == "Read" && privilege.data == "Organization") != -1;
            this.data.readUsers = this.data.privileges.findIndex(privilege => privilege.permission == "Read" && privilege.data == "Users") != -1;
            this.data.readProducts = this.data.privileges.findIndex(privilege => privilege.permission == "Read" && privilege.data == "Products") != -1;
            this.data.readEmissionFactor = this.data.privileges.findIndex(privilege => privilege.permission == "Read" && privilege.data == "EmissionFactor") != -1;
            this.data.readProductActivity = this.data.privileges.findIndex(privilege => privilege.permission == "Read" && privilege.data == "ProductActivity") != -1;
            this.data.readProductFootprint = this.data.privileges.findIndex(privilege => privilege.permission == "Read" && privilege.data == "ProductFootprint") != -1;
            this.data.readDataSource = this.data.privileges.findIndex(privilege => privilege.permission == "Read" && privilege.data == "DataSource") != -1;
            this.data.readTask = this.data.privileges.findIndex(privilege => privilege.permission == "Read" && privilege.data == "Task") != -1;
            this.data.writeOrganization = this.data.privileges.findIndex(privilege => privilege.permission == "Write" && privilege.data == "Organization") != -1;
            this.data.writeUsers = this.data.privileges.findIndex(privilege => privilege.permission == "Write" && privilege.data == "Users") != -1;
            this.data.writeProducts = this.data.privileges.findIndex(privilege => privilege.permission == "Write" && privilege.data == "Products") != -1;
            this.data.writeEmissionFactor = this.data.privileges.findIndex(privilege => privilege.permission == "Write" && privilege.data == "EmissionFactor") != -1;
            this.data.writeProductActivity = this.data.privileges.findIndex(privilege => privilege.permission == "Write" && privilege.data == "ProductActivity") != -1;
            this.data.writeProductFootprint = this.data.privileges.findIndex(privilege => privilege.permission == "Write" && privilege.data == "ProductFootprint") != -1;
            this.data.writeDataSource = this.data.privileges.findIndex(privilege => privilege.permission == "Write" && privilege.data == "DataSource") != -1;
            this.data.writeTask = this.data.privileges.findIndex(privilege => privilege.permission == "Write" && privilege.data == "Task") != -1;
            this.reloadData();
        };
    }

    register(button) {
        if(!this.view.validate()) {
            button.restore();
            return;
        }

        let privileges = [];
        if(this.data.readOrganization) {
            privileges.push({permission: "Read", data: "Organization"});
        }
        if(this.data.readUsers) {
            privileges.push({permission: "Read", data: "Users"});
        }
        if(this.data.readProducts) {
            privileges.push({permission: "Read", data: "Products"});
        }
        if(this.data.readEmissionFactor) {
            privileges.push({permission: "Read", data: "EmissionFactor"});
        }
        if(this.data.readProductActivity) {
            privileges.push({permission: "Read", data: "ProductActivity"});
        }
        if(this.data.readProductFootprint) {
            privileges.push({permission: "Read", data: "ProductFootprint"});
        }
        if(this.data.readDataSource) {
            privileges.push({permission: "Read", data: "DataSource"});
        }
        if(this.data.readTask) {
            privileges.push({permission: "Read", data: "Task"});
        }
        if(this.data.writeOrganization) {
            privileges.push({permission: "Write", data: "Organization"});
        }
        if(this.data.writeUsers) {
            privileges.push({permission: "Write", data: "Users"});
        }
        if(this.data.writeProducts) {
            privileges.push({permission: "Write", data: "Products"});
        }
        if(this.data.writeEmissionFactor) {
            privileges.push({permission: "Write", data: "EmissionFactor"});
        }
        if(this.data.writeProductActivity) {
            privileges.push({permission: "Write", data: "ProductActivity"});
        }
        if(this.data.writeProductFootprint) {
            privileges.push({permission: "Write", data: "ProductFootprint"});
        }
        if(this.data.writeDataSource) {
            privileges.push({permission: "Write", data: "DataSource"});
        }
        if(this.data.writeTask) {
            privileges.push({permission: "Write", data: "Task"});
        }
        this.data.privileges = privileges;
        delete this.data.readOrganization;
        delete this.data.readUsers;
        delete this.data.readProducts;
        delete this.data.readEmissionFactor;
        delete this.data.readProductActivity;
        delete this.data.readProductFootprint;
        delete this.data.readDataSource;
        delete this.data.readTask;
        delete this.data.writeOrganization;
        delete this.data.writeUsers;
        delete this.data.writeProducts;
        delete this.data.writeEmissionFactor;
        delete this.data.writeProductActivity;
        delete this.data.writeProductFootprint;
        delete this.data.writeDataSource;
        delete this.data.writeTask;

        this.applyHandler(this.data);
    }
}