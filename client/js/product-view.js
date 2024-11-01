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

class ProductView extends ViewController {

    constructor() {
        super();
        this.parent = "body > .main > .contents";
        this.data = [];
        this.view = View(".productInfo", {style: {
            overflow: "hidden",
            opacity: 0
        }}, [
            View(".products", {style: {
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
                }}, ["Products"]),
                View({style: {
                    margin: [0,0,16,0],
                    "font-size": "small"
                }}, ["With the left-most icon clicked, you can create a child element of that product by clicking the Add button."]),
                View({height: 40}, [
                    Button(".addButton", {style: {
                        "background-image": "images/add.svg",
                        "background-position": [0, "center"],
                        "background-size": 16,
                        "background-repeat": "no-repeat",
                        padding: [8,8,8,20],
                    }, tapHandler: () => {
                        let record = {
                            productId: null,
                            parentProductId: null,
                            productName: null,
                            amount: null,
                            amountUnit: null,
                            description: null,
                            cpcCode: null,
                            identifiers: [],
                            productionActivities: [],
                            productFootprints: [],
                            dataSources: []
                        };
                        if(this.selectedProduct != null) {
                            record.parentProductId = this.selectedProduct.productId;
                            record.parentProductName = this.selectedProduct.productName;
                            record.amountUnit = "kg";
                        }
                        this.showDetailView(record);
                    }}, ["Add"])
                ]),
                Table(".list", {
                    dataKey: ".",
                    columns: [
                        {label: "Product Name", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "line-height": "1em"
                        }, dataKey: "productName", dataHandler: (cell, value, record) => {
                            let iconPath;
                            if(record.open) {
                                iconPath = "images/product-open.svg";
                            }else {
                                iconPath = "images/product-close.svg";
                            }
                            let icon = View({style: {
                                display: "inline-block",
                                margin: [0,0,0,24*record.depth],
                                width: 32,
                                height: 32,
                                "background-image": iconPath,
                                "background-repeat": "no-repeat",
                                "background-size": 20,
                                "background-position": "center",
                                "vertical-align": "middle",
                                cursor: "pointer"
                            }, tapHandler: event => {
                                event.stopPropagation();
                                this.selectRow(record);
                            }});
                            cell.appendChild(icon);
                            cell.appendChild(HtmlTag("span", ".nameView", [value]));
                        }},
                        {label: "Amount", style: {
                            padding: [0,4],
                            width: 80,
                            "text-align": "right"
                        }, dataKey: "amount", dataHandler: (cell, value, record) => {
                            if(value == null) return;
                            cell.innerText = StringUtil.currencyString(value);
                        }},
                        {label: "", style: {
                            "vertical-align": "middle",
                            padding: [0,4],
                            width: 80,
                            "font-size": "small"
                        }, dataKey: "amountUnit"}
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
            View(".productDetail", {style: {
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

        this.loadProducts();
        this.showContainer();

        let listView = this.view.querySelector(".products");
        let detailView = this.view.querySelector(".productDetail");
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

    loadProducts() {
        this.view.querySelector(".list").animate = true;
        HttpConnection.request(ContextPath+"/products", "GET").then(products => {
            products.forEach(record => {
                record.open = false;
                record.depth = 0;
            });
            this.data = products;
            this.reloadView();
            this.view.querySelector(".list").animate = false;
        });
    }

    reloadView() {
        let table = this.view.querySelector(".list");
        let header = table.querySelector("thead");
        table.style.height = (header.offsetHeight + 40 * (this.data.length > 0 ? this.data.length : 1) + 4) + "px";
    }

    showDetailView(record) {
        let registerView = new ProductRegisterView();
        registerView.data = copyRecord(record);
        if(record.productId == null) {
            registerView.applyHandler = record => {
                delete record.productionActivities;
                delete record.productFootprints;
                delete record.dataSources;
                delete record.organizationName;
                delete record.parentProductName;
                HttpConnection.request(ContextPath+"/products", "POST", record).then(response => {
                    this.loadProducts();
                    this.dismissDetailView();
                });
            };
        }else {
            registerView.applyHandler = record => {
                delete record.productionActivities;
                delete record.productFootprints;
                delete record.dataSources;
                delete record.organizationName;
                delete record.parentProductName;
                HttpConnection.request(ContextPath+"/products/"+record.productId, "PUT", record).then(response => {
                    this.loadProducts();
                    this.dismissDetailView();
                });
            };
            registerView.deleteHandler = record => {
                HttpConnection.request(ContextPath+"/products/"+record.productId, "DELETE").then(response => {
                    this.loadProducts();
                    this.dismissDetailView();
                });
            };
        }
        registerView.dismissHandler = () => {
            this.loadProducts();
            this.dismissDetailView();
        };

        let listView = this.view.querySelector(".products");
        let detailView = this.view.querySelector(".productDetail");
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
        let listView = this.view.querySelector(".products");
        let detailView = this.view.querySelector(".productDetail");
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

    selectRow(selectedRecord) {
        let depth = selectedRecord.depth;
        let selectedIndex = this.data.findIndex(record => record.productId == selectedRecord.productId);

        if(!selectedRecord.open) {
            this.selectedProduct = selectedRecord;
            selectedRecord.open = true;

            HttpConnection.request(ContextPath+"/products?parentProductId="+selectedRecord.productId, "GET").then(products => {
                for(let i=products.length-1; i>=0; i--) {
                    let record = products[i];
                    record.depth = depth+1;
                    record.open = false;
                    this.data.splice(selectedIndex+1, 0, record);
                }
                this.reloadData();
                this.reloadView();
            });
        }else {
            this.selectedProduct = null;
            selectedRecord.open = false;

            let index = -1;
            for(let i=selectedIndex+1; i<this.data.length; i++) {
                let record = this.data[i];
                if(record.depth <= depth) break;
                index = i;
            }
            if(index != -1) {
                for(let i=index; i>selectedIndex; i--) {
                    this.data.splice(i, 1);
                }
            }
        }
    }
}

class ProductRegisterView extends ViewController {

    constructor() {
        super();
        this.parent = "body > .main > .contents > .productInfo > .productDetail";
        this.view = View([
            View({style: {
                margin: [0,0,16,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Product"]),
            View(".contents", {style: {overflow: "scroll"}}, [
                InputComposite({label: "Product Name", labelColor: "black", style: {position: "relative"}}, [
                    TextField({dataKey: "productName", height: 24, required: "required", tabIndex:1}),
                    RequiredLabel()
                ]),
                InputComposite(".identifiers", {label: "Product Identifier", labelColor: "black", style: {position: "relative"}}, [
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
                        let registerView = new IdentifierRegisterView("Product Identifier", "Product");
                        registerView.data = {type: "UUID"};
                        registerView.applyHandler = data => {
                            this.data.identifiers.push(data);
                            this.addIdentifier(data);
                        };
                    }, tabIndex:2}),
                    RequiredLabel()
                ]),
                InputComposite(".parentField", {label: "Parent Product Name", labelColor: "black", style: {position: "relative", display: "none"}}, [
                    View({dataKey: "parentProductName", style: {"min-height": "1em", padding: 4, "line-height": "normal"}})
                ]),
                InputComposite(".organizationField", {label: "Supplier", labelColor: "black", style: {position: "relative", display: "none"}}, [
                    View(".organizationNameDisplayField", {dataKey: "organizationName", style: {height: 24}, tapHandler: event => {
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
                                border: "1px solid gray"
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
                    View(".addOrganizationButton", {title: "Add Supplier", style:{
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
                    }, tabIndex:3})
                ]),
                InputComposite(".amountField", {label: "Amount comprising one parent product", labelColor: "black", style: {display: "none", position: "relative", margin: [4,0]}}, [
                    NumericField(".amountInputField", {dataKey: "amount", height: 24, style: { display: "inline-block", margin: [0,4,0,0] }, tabIndex:4}),
                    Select(".amountUnitField", {
                        dataKey: "amountUnit", 
                        style: {height: 24, display: "inline-block"}, 
                        items: AmountUnits, 
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
                        selectHandler: index => {
                            this.updateAmountUnitField();
                        },
                        tabIndex: 1
                    })
                ]),
                InputComposite({label: "Description", labelColor: "black"}, [
                    TextArea({dataKey: "description", height: 24, tabIndex:5})
                ]),
                InputComposite({label: "CPC Code", labelColor: "black"}, [
                    TextField({dataKey: "cpcCode", height: 24, pattern: "^[0-9]{1,7}$", tabIndex:6})
                ]),
                View(".productionActivity", {style: {margin: [32,0,16,0]}}),
                View(".productFootprints", {style: {margin: [32,0,16,0]}}),
                View(".dataSources", {style: {margin: [32,0,16,0]}})
            ]),
            View(".controls", {align: "center", style: {margin: [16,0,0,0]}}, [
                Button({label: "Register", style: {"font-weight":"600", margin: [0,8], color: Colors.ApplyButton}, blocking: true, tapHandler: button => {
                    this.register(button);
                }, tabIndex:7}),
                Button(".deleteButton", {label: "Delete", style: {margin: [0,8], display: "none"}, tapHandler: button => {
                    Controls.Message("This data will be deleted. Are you sure?", "confirm", "OK", () => {
                        this.deleteHandler(this.data);
                    });
                }, tabIndex:8}),
                Button({label: "Close", style: {margin: [0,8], color: Colors.CancelButton}, tapHandler: button => {
                    this.dismissHandler();
                }, tabIndex:9})
            ])
        ]);

        let contentsView = this.view.querySelector(".contents");
        let controlsView = this.view.querySelector(".controls");
        contentsView.style.height = (window.innerHeight - contentsView.offsetTop - controlsView.offsetHeight - 96)+"px";

        let activityView = new ProductionActivityRegisterView();
        let dataSourceView = new ProductDataSourceRegisterView();

        this.dataLoadedHandler = () => {
            if(this.data.identifiers != null) {
                this.data.identifiers.forEach(identifier => {
                    this.addIdentifier(identifier);
                });
            }

            activityView.data = this.data;
            dataSourceView.data = this.data;

            if(this.data.productId != null) {
                this.view.querySelector(".deleteButton").style.display = "inline-block";
            }

            // Parts
            if(this.data.parentProductId != null) {
                this.view.querySelector(".parentField").style.display = "block";
                this.view.querySelector(".organizationField").style.display = "block";
                this.view.querySelector(".amountField").style.display = "block";

                HttpConnection.request(ContextPath+"/products/"+this.data.parentProductId, "GET").then(response => {
                    this.data.parentProductName = response.productName;
                    this.reloadData();
                });

                let amountUnitField = this.view.querySelector(".amountUnitField");
                let resizeObserver = new ResizeObserver(observations => {
                    if(observations.length == 0) return;
                    resizeObserver.disconnect();
                    this.updateAmountUnitField();
                });
                resizeObserver.observe(amountUnitField);
            }

            if(this.data.organizationId != null) {
                HttpConnection.request(ContextPath+"/organizations/"+this.data.organizationId, "GET").then(response => {
                    this.data.organizationName = response.organizationName;
                    this.reloadData();
                });
            }

            Module.loadLogic("js/product-footprint-view.js", () => {
                let footprintView = new ProductFootprintView();
                footprintView.data = this.data;
            });
        };
    }

    updateAmountUnitField() {
        let amountInputField = this.view.querySelector(".amountInputField");
        let amountUnitField = this.view.querySelector(".amountUnitField");
        amountInputField.style.width = "calc(100% - " + (amountUnitField.offsetWidth + 8) + "px)";
    }

    addIdentifier(identifier) {
        let view = View({style:{
            display: "inline-block",
            "vertical-align": "middle",
            margin: 4,
            padding: 4,
            "border-radius": 4,
            border: "1px solid gray",
            "line-height": "1em"
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
                let index = this.data.identifiers.findIndex(_identifier => _identifier.code == identifier.code && _identifier.type == identifier.type);
                if(index == -1) return;
                this.data.identifiers.splice(index, 1);
                view.remove();
            }})
        ]);
        let addButton = this.view.querySelector(".identifiers > .addButton");
        addButton.before(view);
    }

    register(button) {
        if(!this.view.validate()) {
            button.restore();
            return;
        }
        this.applyHandler(this.data);
    }
}

class ProductionActivityRegisterView extends ViewController {

    addable = false;

    constructor() {
        super();
        this.parent = "body > .main > .contents > .productInfo > .productDetail .productionActivity";
        this.view = View([
            View({style: {
                margin: [0,0,8,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Production Activities"]),
            View({style: {
                margin: [0,0,16,0],
                "font-size": "small"
            }}, ["Set the energy and materials to produce a unit quantity of this product.<br/>Emission factors must be registered in advance."]),
            View({height: 40}, [
                Button(".addButton", {style: {
                    "background-image": "images/add.svg",
                    "background-position": [0, "center"],
                    "background-size": 16,
                    "background-repeat": "no-repeat",
                    padding: [8,8,8,20],
                }, tapHandler: () => {
                    if(!this.addable) {
                        Controls.Message("Before registering an activity, you must first register an emission factor.", "info", "OK", function() {});
                        return;
                    }
                    if(this.data.productId == null) {
                        Controls.Message("First click on the Register button to register your product.", "info", "OK", function() {});
                        return;
                    }
                    let record = {
                        productId: this.data.productId,
                        emissionFactorId: null,
                        amount: null,
                        emissionFactorName: null,
                        denominatorUnit: "kg"
                    };
                    this.data.productionActivities.push(record);
                    this.reloadData();
                    this.reloadView();
                }}, ["Add"])
            ]),
            Table(".list", {
                dataKey: "productionActivities",
                columns: [
                    {label: "Emission factor", style: {
                        padding: 8,
                        "vertical-align": "middle",
                        "line-height": "1em"
                    }, dataKey: "emissionFactorName"},
                    {label: "Amount", style: {
                        "vertical-align": "middle",
                        "text-align": "right",
                        padding: [0,4],
                        width: 80,
                        "font-weight": 600
                    }, dataKey: "amount", dataHandler: (cell, value, record) => {
                        if(value == null) return;
                        if(record.emissionFactorId === undefined) return;
                        cell.innerText = StringUtil.currencyString(value);
                    }},
                    {label: "", style: {
                        "vertical-align": "middle",
                        padding: [0,4],
                        width: 80,
                        "font-size": "small"
                    }, dataKey: "denominatorUnit"},
                    {label: "", style: {
                        width: 32,
                        "vertical-align": "middle",
                        "background-image": "images/remove.svg",
                        "background-repeat": "no-repeat",
                        "background-size": 16,
                        "background-position": "center",
                        cursor: "pointer"
                    }}
                ],
                rowHeight: 40, 
                rowBorderStyle: "1px solid rgba(0,0,0,0.6)",
                rowHighlightStyle: "rgba(0,0,0,0.1)",
                animate: true,
                tapHandler: (record, rowIndex, row, event) => {
                    let x = event.clientX - row.offset().left;
                    let cells = row.querySelectorAll("td");
                    let index = Array.from(cells).findIndex(cell => cell.offsetLeft <= x && cell.offsetLeft+cell.offsetWidth > x);
                    if(index == -1) return;
                    if(index == 0) {
                        this.editEmissionFactorName(cells[index], record);
                    }else if(index == 1) {
                        this.editAmount(cells[index], record);
                    }else if(index == 2) {
                        // this.editUnit(cells[index], record);
                    }else if(index == 3) {
                        this.deleteData(record, rowIndex);
                    }
                }
            })
        ]);

        this.view.styles = {
            ".list > thead > tr > td:last-child": {
                "background": "unset"
            }
        };

        // Check if at least one or more emission factor categories are registered
        HttpConnection.request(ContextPath+"/emission-factor-categories", "GET").then(response => {
            this.addable = response.length > 0;
        });

        this.dataLoadedHandler = () => {
            this.loadData();
        };
    }

    loadData() {
        if(this.data.productId == null) return;
        HttpConnection.request(ContextPath+"/production-activities/"+this.data.productId, "GET").then(activities => {
            Promise.all(activities.map(async activity => {
                let emissionFactor = await HttpConnection.request(ContextPath+"/emission-factors/"+activity.emissionFactorId, "GET");
                if(emissionFactor == null) return;
                activity.emissionFactorName = emissionFactor.emissionFactorName;
                activity.denominatorUnit = emissionFactor.denominatorUnit;
                return activity;
            })).then(activities => {
                this.data.productionActivities = activities;
                this.reloadData();
                this.reloadView();
            });
        });
    }

    reloadView() {
        let table = this.view.querySelector(".list");
        let header = table.querySelector("thead");
        table.style.height = (header.offsetHeight + 40 * (this.data.productionActivities.length > 0 ? this.data.productionActivities.length : 1) + 4) + "px";
    }

    editEmissionFactorName(cell, record) {
        cell.innerText = null;
        let textField = TextField({width:"100%", placeholder: "Emission factor name", height: 24, changeHandler: event => {
            let textField = event.currentTarget;
            if(textField.value == null || textField.value.length == 0) return;
            let emissionFactorName = textField.value;
            HttpConnection.request(ContextPath+"/emission-factors?emissionFactorName="+emissionFactorName, "GET").then(emissionFactors => {
                if(emissionFactors.length == 0) {
                    Controls.Message("Emission factor not found.", "info", "OK", function() {});
                    return;
                }

                if(emissionFactors.length == 1) {
                    let emissionFactor = emissionFactors[0];
                    record.emissionFactorId = emissionFactor.emissionFactorId;
                    record.emissionFactorName = emissionFactor.emissionFactorName;
                    record.denominatorUnit = emissionFactor.denominatorUnit;
                    textField.remove();
                    this.reloadData();
                    this.updateData(record);
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
                    border: "1px solid gray"
                }, tabIndex: 1}, emissionFactors.map((emissionFactor, index) => {
                    return View(".item", {tabindex: index+1, style: {
                        "line-height": "1em",
                        padding: 8
                    }, tapHandler: event => {
                        record.emissionFactorId = emissionFactor.emissionFactorId;
                        record.emissionFactorName = emissionFactor.emissionFactorName;
                        record.denominatorUnit = emissionFactor.denominatorUnit;
                        textField.remove();
                        cell.innerText = record.emissionFactorName;
                        this.updateData(record);
                    }}, [emissionFactor.emissionFactorName]);
                }));
                view.addEventListener("keydown", event => {
                    let selection = event.currentTarget;
                    let items = selection.querySelectorAll(".item");
                    if(event.code == "Enter" || event.code == "Space") {
                        if(document.activeElement != null) {
                            let index;
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
                            let index;
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
                view.querySelector(".item").focus();
                mask.appendChild(view);
                view.focus();
            });
        }});
        textField.value = record.emissionFactorName;
        cell.appendChild(textField);
        textField.focus();
    }

    editAmount(cell, record) {
        cell.innerText = null;
        let textField = NumericField({width:"100%", height: 24, changeHandler: event => {
            if(event.currentTarget.value == null) return;
            record.amount = event.currentTarget.value.toString();
            event.currentTarget.remove();
            cell.innerText = record.amount;
            this.updateData(record);
        }});
        textField.value = record.amount;
        cell.appendChild(textField);
        textField.focus();
    }

    editUnit(cell, record) {
        cell.innerText = null;
        let select = Select({
            style: {height: "1em", display: "inline-block", "vertical-align": "middle"}, 
            itemHeight: "1em",
            items: ProductActivityUnits, 
            selectedIndex: ProductActivityUnits.findIndex(entry => entry.value == record.denominatorUnit),
            valueKey: "value", 
            labelHandler: item => {
                return item["label"];
            },
            styleHandler: (item, current) => {
                return {
                    padding: [0,8],
                    "line-height": "1em"
                };
            },
            selectHandler: index => {
                record.denominatorUnit = ProductActivityUnits[index].value;
                cell.innerText = record.denominatorUnit;
                this.updateData(record);
            }
        });
        cell.appendChild(select);
        select.dispatchEvent(new MouseEvent("click"));
    }

    updateData(record) {
        if(record.emissionFactorId == null || record.amount == null) return;
        HttpConnection.request(ContextPath+"/production-activities/"+record.productId+"/"+record.emissionFactorId, "PUT", record);
    }

    deleteData(record, rowIndex) {
        if(record.emissionFactorId == null) {
            this.data.splice(rowIndex, 1);
            this.reloadData();
        }else {
            HttpConnection.request(ContextPath+"/production-activities/"+record.productId+"/"+record.emissionFactorId, "DELETE", record).then(response => {
                this.data.splice(rowIndex, 1);
                this.reloadData();
            });
        }
    }
}

class ProductDataSourceRegisterView extends ViewController {

    addable = false;

    constructor() {
        super();
        this.parent = "body > .main > .contents > .productInfo > .productDetail .dataSources";
        this.view = View([
            View({style: {
                margin: [0,0,8,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Data Source"]),
            View(".notes", {style: {
                margin: [0,0,16,0],
                "font-size": "small"
            }}),
            View({height: 40}, [
                Button(".addButton", {style: {
                    "background-image": "images/add.svg",
                    "background-position": [0, "center"],
                    "background-size": 16,
                    "background-repeat": "no-repeat",
                    padding: [8,8,8,20],
                }, tapHandler: () => {
                    if(!this.addable) {
                        Controls.Message("Before entering a notification, you must first register the data source.", "info", "OK", function() {});
                        return;
                    }
                    if(this.data.productId == null) {
                        Controls.Message("First click on the Register button to register your product.", "info", "OK", function() {});
                        return;
                    }
                    let record = {
                        productId: this.data.productId,
                        dataSourceId: null
                    };
                    this.data.dataSources.push(record);
                    this.reloadData();
                }}, ["Add"])
            ]),
            Table(".list", {
                dataKey: "dataSources",
                columns: [
                    {label: "Data Source", style: {
                        padding: 8,
                        "vertical-align": "middle",
                        "line-height": "1em"
                    }, dataKey: "dataSourceName"},
                    {label: "", style: {
                        width: 32,
                        "vertical-align": "middle",
                        "background-image": "images/remove.svg",
                        "background-repeat": "no-repeat",
                        "background-size": 16,
                        "background-position": "center",
                        cursor: "pointer"
                    }}
                ],
                rowHeight: 40, 
                rowBorderStyle: "1px solid rgba(0,0,0,0.6)",
                rowHighlightStyle: "rgba(0,0,0,0.1)",
                animate: true,
                tapHandler: (record, rowIndex, row, event) => {
                    let x = event.clientX - row.offset().left;
                    let cells = row.querySelectorAll("td");
                    let index = Array.from(cells).findIndex(cell => cell.offsetLeft <= x && cell.offsetLeft+cell.offsetWidth > x);
                    if(index == -1) return;
                    if(index == 0) {
                        this.editDataSourceName(cells[index], record);
                    }else if(index == 1) {
                        Controls.Message("This data will be deleted. Are you sure?", "confirm", "OK", () => {
                            this.deleteData(record, rowIndex);
                        });
                    }
                }
            })
        ]);

        this.view.styles = {
            ".list > thead > tr > td:last-child": {
                "background": "unset"
            }
        };

        // Check if at least one or more data sources are registered
        HttpConnection.request(ContextPath+"/datasources", "GET").then(response => {
            this.addable = response.length > 0;
        });

        this.dataLoadedHandler = () => {
            let notes = this.view.querySelector(".notes");
            if(this.data.parentProductId == null) {
                notes.innerText = "Registering a data source allows you to notify other companies when your product footprint is updated.";
            }else {
                notes.innerText = "Registering a data source allows you to obtain product footprints from other companies.";
            }
            this.loadData();
        };
    }

    loadData() {
        if(this.data.productId == null) return;
        HttpConnection.request(ContextPath+"/product-datasources/"+this.data.productId, "GET").then(response => {
            this.data.dataSources = response;
            this.reloadData();
            this.reloadView();
        });
    }

    reloadView() {
        let table = this.view.querySelector(".list");
        let header = table.querySelector("thead");
        table.style.height = (header.offsetHeight + 40 * (this.data.length > 0 ? this.data.length : 1) + 4) + "px";
    }

    editDataSourceName(cell, record) {
        cell.innerText = null;
        let textField = TextField({width:"100%", placeholder: "Data source name", height: 24, changeHandler: event => {
            let textField = event.currentTarget;
            if(textField.value == null || textField.value.length == 0) return;
            let dataSourceName = textField.value;
            HttpConnection.request(ContextPath+"/datasources?dataSourceName="+dataSourceName, "GET").then(dataSources => {
                if(dataSources.length == 0) {
                    Controls.Message("Data source not found.", "info", "OK", function() {});
                    return;
                }

                if(dataSources.length == 1) {
                    let dataSource = dataSources[0];
                    record.dataSourceId = dataSource.dataSourceId;
                    record.dataSourceName = dataSource.dataSourceName;
                    textField.remove();
                    this.reloadData();
                    this.updateData(record);
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
                let scrollY = document.querySelector("body > .main > .contents > .productInfo > .productDetail .contents").scrollTop;
                
                let view = View({style: {
                    position: "absolute",
                    "max-width": textField.offsetWidth,
                    "max-height": 24*3.5,
                    "overflow-y": "scroll",
                    top: (offset.top+textField.offsetHeight-scrollY)+"px",
                    left: offset.left+"px",
                    "background-color": "#FFF",
                    border: "1px solid gray",
                    cursor: "default"
                }}, dataSources.map((dataSource, index) => {
                    return View(".item", {tabindex: index+1, style: {
                        "line-height": "1em",
                        padding: 8
                    }, tapHandler: event => {
                        record.dataSourceId = dataSource.dataSourceId;
                        record.dataSourceName = dataSource.dataSourceName;
                        textField.remove();
                        cell.innerText = record.dataSourceName;
                        this.updateData(record);
                    }}, [dataSource.dataSourceName]);
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
        }});
        textField.value = record.dataSourceName !== undefined ? record.dataSourceName : null;
        cell.appendChild(textField);
        textField.focus();
    }

    updateData(record) {
        if(record.dataSourceId == null) return;
        HttpConnection.request(ContextPath+"/product-datasources/"+this.data.productId, "POST", record);
    }

    deleteData(record, rowIndex) {
        if(record.dataSourceId == null) {
            this.data.dataSources.splice(rowIndex, 1);
            this.reloadData();
        }else {
            HttpConnection.request(ContextPath+"/product-datasources/"+this.data.productId+"/"+record.dataSourceId, "DELETE").then(response => {
                this.data.dataSources.splice(rowIndex, 1);
                this.reloadData();
            });
        }
    }
}