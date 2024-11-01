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

const GwpReports = [
    {label: "AR5", value: "AR5"},
    {label: "AR6", value: "AR6"}
];

const AccountingStandards = [
    {label: "GHG Protocol", value: "GHGProtocol"},
    {label: "ISO 14067", value: "ISO14067"},
    {label: "ISO 14044", value: "ISO14044"}
];

const BiogenicAccountingStandards = [
    {label: "", value: null},
    {label: "PEF", value: "PEF"},
    {label: "ISO 14067", value: "ISO14067"},
    {label: "GHG Protocol", value: "GHGProtocol"},
    {label: "Quantis", value: "Quantis"}
];

const AssuranceSelection = {
    Coverage: [
        {label: "", value: null},
        {label: "Corporate level", value: "corporate level"},
        {label: "Product line", value: "product line"},
        {label: "PCF system", value: "PCF system"},
        {label: "Product level", value: "product level"}
    ],
    Level: [
        {label: "", value: null},
        {label: "Limited", value: "limited"},
        {label: "Reasonable", value: "reasonable"}
    ],
    Boundary: [
        {label: "", value: null},
        {label: "Gate-to-Gate", value: "Gate-to-Gate"},
        {label: "Cradle-to-Gate", value: "Cradle-to-Gate"}
    ]
}

class ProductFootprintView extends ViewController {

    constructor() {
        super();
        this.parent = "body > .main > .contents > .productInfo > .productDetail .productFootprints";
        this.view = View({style: {
            overflow: "hidden"
        }}, [
            View([
                View({style: {
                    margin: [0,0,16,0],
                    "font-size": "1.5em",
                    "font-weight": 900
                }}, ["Product Footprints"]),
                View({height: 40}, [
                    Button(".addButton", {style: {
                        "background-image": "images/add.svg",
                        "background-position": [0, "center"],
                        "background-size": 16,
                        "background-repeat": "no-repeat",
                        padding: [8,8,8,20]
                    }, tapHandler: () => {
                        this.addProductFootprint();
                    }}, ["Add"]),
                    Button(".requestButton", {style: {
                        "background-image": "images/mail.svg",
                        "background-position": [0, "center"],
                        "background-size": 16,
                        "background-repeat": "no-repeat",
                        padding: [8,8,8,20],
                        margin: [0,0,0,16],
                        display: "none"
                    }, tapHandler: () => {
                        Module.loadLogic("js/task-view.js", () => {
                            let editor = new RequestRegisterView();
                            editor.data = {
                                requestType: "ProductFootprintRequest",
                                recipientOrganizationId: this.data.organizationId,
                                recipientOrganizationName: this.data.organizationName,
                                productId: this.data.productId,
                                message: null
                            };
                            editor.applyHandler = record => {
                                HttpConnection.request(ContextPath+"/requests", "POST", record).then(products => {
                                    Controls.Message("The request was sent to the specified destination.\nYou can check the contents of the sent request in Tasks.", "info", "OK", function() {});
                                });
                            };
                        });
                    }}, ["Request"])
                ]),
                Table(".list", {
                    dataKey: "productFootprints",
                    columns: [
                        {label: "Updated Date", style: {
                            padding: [0,4],
                            width: 120,
                            "vertical-align": "middle",
                            "line-height": "1em"
                        }, dataKey: "updatedDate", dataHandler: (cell, value, record) => {
                            if(value == null) return;
                            cell.innerText = DateUtil.format(new Date(value), dateFormat);
                        }},
                        {label: "Version", style: {
                            padding: [0,4],
                            width: 64,
                            "vertical-align": "middle",
                            "text-align": "right"
                        }, dataKey: "version"},
                        {label: "Status", style: {
                            padding: [0,4],
                            width: 64,
                            "vertical-align": "middle"
                        }, dataKey: "status", dataHandler: (cell, value, record) => {
                            let styles = {
                                display: "inline-block",
                                "line-height": "1em",
                                border: "1px solid #000",
                                "border-radius": 4,
                                "font-size": "small",
                                padding: 4
                            };
                            if(value == "Active") {
                                styles["background-color"] = "#000";
                                styles["color"] = "#fff";
                            }
                            cell.appendChild(View({style: styles}, [value]));
                        }},
                        {label: "Carbon Footprint", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "text-align": "right",
                            "font-weight": 600
                        }, dataKey: "carbonFootprint", dataHandler: (cell, value, record) => {
                            cell.innerText = StringUtil.currencyString(value, 3);
                        }},
                        {label: "", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "font-size": "small",
                            width: 120,
                        }, dataKey: "amountUnit", dataHandler: (cell, value, record) => {
                            cell.innerHTML = "<span>kg-CO<sub>2</sub>e / "+value+"</span>";
                        }}
                    ],
                    rowHeight: 40, 
                    rowBorderStyle: "1px solid rgba(0,0,0,0.6)",
                    rowHighlightStyle: "rgba(0,0,0,0.1)",
                    animate: true,
                    tapHandler: record => {
                        HttpConnection.request(ContextPath+"/product-footprints/"+record.productFootprintId, "GET").then(response => {
                            this.showDetailView(response);
                        });
                    }
                })
            ]),
            View(".productFootprintDetail", {style: {
                margin: 16,
                padding: 32,
                "max-width": 700,
                "background-color": "rgba(255,255,255,0.6)",
                "border-radius": 8,
                "user-select": "none",
                position: "absolute",
                visibility: "hidden"
            }})
        ]);

        this.view.styles = {
            ".list > thead > tr > td:last-child": {
                "background": "unset"
            }
        };

        this.dataLoadedHandler = () => {
            this.loadProductFootprints();

            if(this.data.parentProductId != null) {
                this.view.querySelector(".requestButton").style.display = "inline-block";
            }
        };

        let listView = document.querySelector("body > .main > .contents > .productInfo > .products");
        let detailView = this.view.querySelector(".productFootprintDetail");
        let width = window.innerWidth - listView.offsetLeft - 16*2;
        width = width < 700 ? width : 700;
        detailView.style.width = listView.style.width;
        detailView.style.top = "-16px";
        detailView.style.left = width+"px";
    }

    loadProductFootprints() {
        if(this.data.productId == null) return;
        HttpConnection.request(ContextPath+"/product-footprints?productId="+this.data.productId, "GET").then(productFootprints => {
            this.data.productFootprints = productFootprints;
            this.reloadData();
            this.reloadView();
        });
    }

    reloadView() {
        let table = this.view.querySelector(".list");
        let header = table.querySelector("thead");
        table.style.height = (header.offsetHeight + 40 * (this.data.productFootprints.length > 0 ? this.data.productFootprints.length : 1) + 4) + "px";
    }

    addProductFootprint() {
        if(this.data.productId == null) {
            Controls.Message("First click on the Register button to register your product.", "info", "OK", function() {});
            return;
        }
        if(this.data.productFootprints.length == 0) {
            let record = {
                productFootprintId: null,
                dataId: null,
                version: 0,
                updatedDate: null,
                status: "Active",
                statusComment: null,
                availableStartDate: null,
                availableEndDate: null,
                organizationId: null,
                productId: this.data.productId,
                comment: null,
                amountUnit: "kg",
                amount: null,
                carbonFootprint: null,
                carbonFootprintIncludingBiogenic: null,
                fossilEmissions: null,
                fossilCarbonContent: null,
                biogenicCarbonContent: null,
                dLucEmissions: null,
                landManagementEmissions: null,
                otherBiogenicEmissions: null,
                iLucGhgEmissions: null,
                biogenicRemoval: null,
                aircraftEmissions: null,
                gwpReports: ["AR6"],
                accountingStandards: ["GHGProtocol"],
                carbonAccountingRules: null,
                biogenicAccountingStandard: null,
                boundaryProcesses: "",
                measurementStartDate: null,
                measurementEndDate: null,
                region: null,
                country: null,
                subdivision: null,
                inventoryDatabases: null,
                exemptedEmissionsRate: null,
                exemptedEmissionsReason: "",
                packagingGhgEmissions: null,
                allocationRules: null,
                uncertaintyAssessment: null,
                primaryDataShare: null,
                dataQualityIndicator: null,
                assurance: null
            };
            this.showDetailView(record);
        }else {
            let record = this.data.productFootprints[0];
            HttpConnection.request(ContextPath+"/product-footprints/"+record.productFootprintId, "GET").then(response => {
                this.showDetailView(response);
            });
        }
    }

    showDetailView(record) {
        let registerView = new ProductFootprintRegisterView();
        registerView.productionActivities = this.data.productionActivities;
        registerView.data = record;
        if(record.productFootprintId == null) { 
            registerView.applyHandler = record => {
                HttpConnection.request(ContextPath+"/product-footprints", "POST", record).then(response => {
                    this.loadProductFootprints();
                    this.dismissDetailView();
                });
            };
        }else {
            registerView.applyHandler = record => {
                HttpConnection.request(ContextPath+"/product-footprints/"+record.productFootprintId, "PUT", record).then(response => {
                    this.loadProductFootprints();
                    this.dismissDetailView();
                });
            };
            registerView.deleteHandler = record => {
                HttpConnection.request(ContextPath+"/product-footprints/"+record.productFootprintId, "DELETE", record).then(response => {
                    this.loadProductFootprints();
                    this.dismissDetailView();
                });
            };
        }
        registerView.dismissHandler = () => {
            this.dismissDetailView();
        };

        let listView = document.querySelector("body > .main > .contents > .productInfo > .productDetail");
        let detailView = this.view.querySelector(".productFootprintDetail");
        detailView.style.visibility = "visible";
        let width = listView.offsetWidth+16;
        let listViewX = listView.offsetLeft-16;
        new FunctionalAnimation(progress => {
            listView.style.left = (listViewX - width*progress)+"px";
        }, FunctionalAnimation.methods.easeInOut, 300).start().finish(() => {
            listView.style.visibility = "hidden";
        });
    }

    dismissDetailView() {
        let listView = document.querySelector("body > .main > .contents > .productInfo > .productDetail");
        let detailView = this.view.querySelector(".productFootprintDetail");
        listView.style.visibility = "visible";
        let width = listView.offsetWidth+16;
        let listViewX = listView.offsetLeft-16;
        new FunctionalAnimation(progress => {
            listView.style.left = (listViewX + width*progress)+"px";
        }, FunctionalAnimation.methods.easeInOut, 300).start().finish(() => {
            detailView.style.visibility = "hidden";
        });
    }
}

class ProductFootprintRegisterView extends ViewController {

    /** @type {Array<object>} */
    productionActivities;
    
    /** @type {BigNumber} */
    productionEmissions;

    constructor() {
        super();
        this.parent = "body > .main > .contents .productFootprintDetail";
        let tabIndex = 1;
        this.view = View([
            View({style: {
                margin: [0,0,16,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Product Footprint"]),
            View(".contents", {style: {overflow: "scroll"}}, [
                InputComposite({label: "Product footprint ID", labelColor: "black", style: {position: "relative", margin: [4,0]}}, [
                    View({dataKey: "dataId", height: 24, style:{"line-height": "normal"}})
                ]),
                View([
                    InputComposite({label: "Version", labelColor: "black", style: {display: "inline-block", width: 112, margin: [4,4,4,0], "vertical-align": "top"}}, [
                        View({dataKey: "version", height: 24, style: {"text-align": "right", "line-height": "normal"}})
                    ]),
                    InputComposite({label: "Updated date", labelColor: "black", style: {display: "inline-block", width: "calc(100% - 120px)", margin: [4,0,4,4], "vertical-align": "top"}}, [
                        View({dataKey: "updatedDate", height: 24, style:{"line-height": "normal"}, dataHandler: (element, value) => {
                            if(value == null) return;
                            element.innerText = DateUtil.format(new Date(value), dateFormat);
                        }})
                    ])
                ]),
                View([
                    InputComposite({label: "Status", labelColor: "black", style: {display: "inline-block", width: 112, margin: [4,4,4,0], "vertical-align": "top"}}, [
                        View({dataKey: "status", style: {display: "inline-block", padding: 4, "border-radius": 4, border: "1px solid black", "font-size": "small"}, dataHandler: (element, value) => {
                            if(value == null) return;
                            if(value == "Active") {
                                element.style.backgroundColor = "black";
                                element.style.color = "white";
                            }else {
                                element.style.backgroundColor = "transparent";
                                element.style.color = "black";
                            }
                            element.innerText = value;
                        }})
                    ]),
                    InputComposite({label: "Status comment", labelColor: "black", style: {display: "inline-block", width: "calc(100% - 120px)", margin: [4,0,4,4], "vertical-align": "top"}}, [
                        TextField({dataKey: "statusComment", height: 24, tabIndex:(tabIndex++)})
                    ])
                ]),
                InputComposite({label: "Production unit amount", labelColor: "black", style: {position: "relative", margin: [4,0]}}, [
                    NumericField(".amountField", {dataKey: "amount", required: "required", height: 24, style: { display: "inline-block", "font-weight": 600}, tabIndex:(tabIndex++), changeHandler: () => {
                        this.updateCarbonFootprint();
                    }}),
                    Select(".amountUnitField", {
                        dataKey: "amountUnit", 
                        style: {height: 24, display: "inline-block", margin: [0,0,0,4]}, 
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
                            this.updateUnitField();
                        },
                        tabIndex:(tabIndex++)
                    }),
                    RequiredLabel()
                ]),
                View([
                    InputComposite(".carbonFootprintField", {label: "Carbon footprint", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,4,4,0], position: "relative", "vertical-align": "top"}}, [
                        NumericField({dataKey: "carbonFootprint", height: 24, style: {"font-weight": 600}, unit: "kg-CO<sub>2</sub>e / kg", required: "required", tabIndex:(tabIndex++), changeHandler: () => {
                            this.updateCarbonFootprint();
                        }}),
                        RequiredLabel()
                    ]),
                    InputComposite(".carbonFootprintField", {label: "Carbon footprint including biogenic", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,0,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "carbonFootprintIncludingBiogenic", height: 24, unit: "kg-CO<sub>2</sub>e / kg", tabIndex:(tabIndex++), changeHandler: () => {
                            this.updateCarbonFootprint();
                        }}),
                    ])
                ]),
                View([
                    InputComposite(".carbonFootprintField", {label: "Fossil emissions", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,4,4,0], position: "relative", "vertical-align": "top"}}, [
                        NumericField({dataKey: "fossilEmissions", height: 24, unit: "kg-CO<sub>2</sub>e / kg", required: "required", tabIndex:(tabIndex++), changeHandler: () => {
                            this.data.fossilCarbonContent = new BigNumber(this.data.fossilEmissions).multipliedBy(new BigNumber(12).dividedBy(new BigNumber(44))).toString();
                            this.updateCarbonFootprint();
                        }}),
                        RequiredLabel()
                    ]),
                    InputComposite(".carbonContentField", {label: "Fossil carbon content", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", position: "relative", margin: [4,0,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "fossilCarbonContent", height: 24, unit: "kg-C / kg", required: "required", tabIndex:(tabIndex++), changeHandler: () => {
                            this.data.fossilEmissions = new BigNumber(this.data.fossilCarbonContent).multipliedBy(new BigNumber(44).dividedBy(new BigNumber(12))).toString();
                            this.updateCarbonFootprint();
                        }}),
                        RequiredLabel()
                    ])
                ]),
                View([
                    InputComposite(".carbonFootprintField", {label: "Biogenic removal", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,4,4,0], "vertical-align": "top"}}, [
                        NumericField({dataKey: "biogenicRemoval", height: 24, unit: "kg-CO<sub>2</sub>e / kg", tabIndex:(tabIndex++), changeHandler: () => {
                            this.data.biogenicCarbonContent = new BigNumber(this.data.biogenicRemoval).multipliedBy(new BigNumber(12).dividedBy(new BigNumber(44))).multipliedBy(new BigNumber(-1)).toString();
                            this.updateCarbonFootprint();
                        }}),
                    ]),
                    InputComposite(".carbonContentField", {label: "Biogenic carbon content", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", position: "relative", margin: [4,0,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "biogenicCarbonContent", height: 24, unit: "kg-C / kg", required: "required", tabIndex:(tabIndex++), changeHandler: () => {
                            this.data.biogenicRemoval = new BigNumber(this.data.biogenicCarbonContent).multipliedBy(new BigNumber(44).dividedBy(new BigNumber(12))).multipliedBy(new BigNumber(-1)).toString();
                            this.updateCarbonFootprint();
                        }}),
                        RequiredLabel()
                    ])
                ]),
                View([
                    InputComposite(".carbonFootprintField", {label: "dLUC emissions", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,4,4,0], "vertical-align": "top"}}, [
                        NumericField({dataKey: "dLucEmissions", height: 24, unit: "kg-CO<sub>2</sub>e / kg", tabIndex:(tabIndex++)})
                    ]),
                    InputComposite(".carbonFootprintField", {label: "iLUC emissions", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", position: "relative", margin: [4,0,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "iLucGhgEmissions", height: 24, unit: "kg-CO<sub>2</sub>e / kg", tabIndex:(tabIndex++)})
                    ])
                ]),
                View([
                    InputComposite(".carbonFootprintField", {label: "Land management emissions", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,4,4,0], "vertical-align": "top"}}, [
                        NumericField({dataKey: "landManagementEmissions", height: 24, unit: "kg-CO<sub>2</sub>e / kg", tabIndex:(tabIndex++)})
                    ]),
                    InputComposite(".carbonFootprintField", {label: "Other biogenic emissions", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", position: "relative", margin: [4,0,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "otherBiogenicEmissions", height: 24, unit: "kg-CO<sub>2</sub>e / kg", tabIndex:(tabIndex++)})
                    ])
                ]),
                View([
                    InputComposite(".carbonFootprintField", {label: "Aircraft emissions", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,4,4,0], "vertical-align": "top"}}, [
                        NumericField({dataKey: "aircraftEmissions", height: 24, unit: "kg-CO<sub>2</sub>e / kg", tabIndex:(tabIndex++)})
                    ]),
                    InputComposite(".carbonFootprintField", {label: "Packaging emissions", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", position: "relative", margin: [4,0,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "packagingGhgEmissions", height: 24, unit: "kg-CO<sub>2</sub>e / kg", tabIndex:(tabIndex++)})
                    ])
                ]),
                View([
                    InputComposite({label: "GWP reports", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", position: "relative", margin: [4,4,4,0], "vertical-align": "top"}}, [
                        View(".gwpReportsField", {style: {display: "inline-block"}}),
                        Select(".gwpReportsSelector", {
                            style: {height: 24, display: "none"}, 
                            items: GwpReports, 
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
                                let value = GwpReports[index].value;
                                if(this.data.gwpReports.includes(value)) return;
                                this.data.gwpReports.push(value);
                                this.loadGwpReports();
                                let selector = this.view.querySelector(".gwpReportsSelector");
                                selector.style.display = "none";
                            },
                            tabIndex:(tabIndex++)
                        }),
                        Button(".addButton", {style: {
                            "background-image": "images/add.svg",
                            "background-position": "center",
                            "background-size": 16,
                            "background-repeat": "no-repeat",
                            width: 24, 
                            height: 24
                        }, tabIndex:(tabIndex++), tapHandler: () => {
                            let selector = this.view.querySelector(".gwpReportsSelector");
                            selector.style.display = "inline-block";
                            selector.dispatchEvent(new MouseEvent("click"));
                        }}),
                        RequiredLabel()
                    ]),
                    InputComposite({label: "Accounting standards", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", position: "relative", margin: [4,0,4,4], "vertical-align": "top"}}, [
                        View(".accountingStandardsField", {style: {display: "inline-block"}}),
                        Select(".accountingStandardsSelector", {
                            style: {height: 24, display: "none"}, 
                            itemHeight: "2em",
                            items: AccountingStandards, 
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
                                let value = AccountingStandards[index].value;
                                if(this.data.accountingStandards.includes(value)) return;
                                this.data.accountingStandards.push(value);
                                this.loadAccountingStandards();
                                let selector = this.view.querySelector(".accountingStandardsSelector");
                                selector.style.display = "none";
                            },
                            tabIndex:(tabIndex++)
                        }),
                        Button(".addButton", {style: {
                            "background-image": "images/add.svg",
                            "background-position": "center",
                            "background-size": 16,
                            "background-repeat": "no-repeat",
                            width: 24, 
                            height: 24
                        }, tabIndex:(tabIndex++), tapHandler: () => {
                            let selector = this.view.querySelector(".accountingStandardsSelector");
                            selector.style.display = "inline-block";
                            selector.dispatchEvent(new MouseEvent("click"));
                        }}),
                        RequiredLabel()
                    ])
                ]),
                View([
                    InputComposite({label: "Carbon accounting rule", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,4,4,0], "vertical-align": "top"}}, [
                        View({dataKey: "carbonAccountingRules", height: 24, tabIndex:(tabIndex++), tapHandler: () => {
                            let editor = new CarbonAccountingRuleRegisterView();
                            editor.data = this.data.carbonAccountingRules != null ? this.data.carbonAccountingRules : {operator: null, ruleNames: [], operatorName: null};
                            editor.applyHandler = data => {
                                this.data.carbonAccountingRules = data;
                            };
                        }})
                    ]),
                    InputComposite({label: "Biogenic accounting standard", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", position: "relative", margin: [4,0,4,4], "vertical-align": "top"}}, [
                        Select({
                            dataKey: "biogenicAccountingStandard",
                            style: {height: 24},
                            items: BiogenicAccountingStandards, 
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
                            tabIndex:(tabIndex++)
                        })
                    ])
                ]),
                InputComposite({label: "Boundary Processes", labelColor: "black", style: {position: "relative", margin: [4,0]}}, [
                    TextArea({dataKey: "boundaryProcesses", height: 24, tabIndex:(tabIndex++)})
                ]),
                View([
                    InputComposite({label: "Measurement start date", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,4,4,0], position: "relative", "vertical-align": "top"}}, [
                        DateField({dataKey: "measurementStartDate", width: "100%", height: 24, format: dateFormat, tabIndex:(tabIndex++)}),
                        RequiredLabel()
                    ]),
                    InputComposite({label: "Measurement end date", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,0,4,4], position: "relative", "vertical-align": "top"}}, [
                        DateField({dataKey: "measurementEndDate", width: "100%", height: 24, format: dateFormat, tabIndex:(tabIndex++)}),
                        RequiredLabel()
                    ])
                ]),
                View([
                    InputComposite({label: "Region", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 64px)", margin: [4,4,4,0], "vertical-align": "top"}}, [
                        Select({
                            dataKey: "region", 
                            style: {height: 24}, 
                            items: Regions, 
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
                            tabIndex:(tabIndex++)
                        })
                    ]),
                    InputComposite({label: "Country", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 64px)", margin: [4,4,4,4], "vertical-align": "top"}}, [
                        Select({
                            dataKey: "country", 
                            style: {height: 24}, 
                            items: Countries, 
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
                            tabIndex:(tabIndex++)
                        })
                    ]),
                    InputComposite({label: "Subdivision", labelColor: "black", style: {display: "inline-block", width: 112, margin: [4,0,4,4], "vertical-align": "top"}}, [
                        TextField({dataKey: "subdivision", height: 24, tabIndex:(tabIndex++)})
                    ])
                ]),
                View([
                    InputComposite({label: "Exempted Rate", labelColor: "black", style: {display: "inline-block", width: 160, margin: [4,4,4,0], position: "relative", "vertical-align": "top"}}, [
                        NumericField({dataKey: "exemptedEmissionsRate", height: 24, unit: "%", required: "required", tabIndex:(tabIndex++)}),
                        RequiredLabel()
                    ]),
                    InputComposite({label: "Exempted Emissions Reason", labelColor: "black", style: {display: "inline-block", width: "calc(100% - 168px)", margin: [4,0,4,4], position: "relative", "vertical-align": "top"}}, [
                        TextField({dataKey: "exemptedEmissionsReason", height: 24, tabIndex:(tabIndex++)})
                    ])
                ]),
                InputComposite({label: "Allocation Rules", labelColor: "black", style: {margin: [4,0], position: "relative"}}, [
                    TextField({dataKey: "allocationRules", height: 24, tabIndex:(tabIndex++)})
                ]),
                InputComposite({label: "Uncertainty Assessment", labelColor: "black", style: {margin: [4,0], position: "relative"}}, [
                    TextField({dataKey: "uncertaintyAssessment", height: 24, tabIndex:(tabIndex++)})
                ]),
                InputComposite({label: "Primary Data Share", labelColor: "black", style: {margin: [4,0], position: "relative"}}, [
                    NumericField({dataKey: "primaryDataShare", height: 24, unit: "%", tabIndex:(tabIndex++)})
                ]),
                InputComposite({label: "Data Quality Indicator", labelColor: "black", style: {margin: [4,0], position: "relative"}}, [
                    InputComposite({label: "Coverage", labelColor: "black", style: {display: "inline-block", width: "calc(33.3% - 8px)", margin: [4,4,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "coverage", height: 24, unit: "%", tabIndex:(tabIndex++)})
                    ]),
                    InputComposite({label: "Technological", labelColor: "black", style: {display: "inline-block", width: "calc(33.3% - 8px)", margin: [4,4,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "ter", height: 24, tabIndex:(tabIndex++)})
                    ]),
                    InputComposite({label: "Temporal", labelColor: "black", style: {display: "inline-block", width: "calc(33.3% - 8px)", margin: [4,4,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "tir", height: 24, tabIndex:(tabIndex++)})
                    ]),
                    InputComposite({label: "Geographical", labelColor: "black", style: {display: "inline-block", width: "calc(33.3% - 8px)", margin: [4,4,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "ger", height: 24, tabIndex:(tabIndex++)})
                    ]),
                    InputComposite({label: "Completeness", labelColor: "black", style: {display: "inline-block", width: "calc(33.3% - 8px)", margin: [4,4,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "completeness", height: 24, tabIndex:(tabIndex++)})
                    ]),
                    InputComposite({label: "Reliability", labelColor: "black", style: {display: "inline-block", width: "calc(33.3% - 8px)", margin: [4,4,4,4], "vertical-align": "top"}}, [
                        NumericField({dataKey: "reliability", height: 24, tabIndex:(tabIndex++)})
                    ]),
                ]),
                InputComposite({label: "Assurance", labelColor: "black", style: {margin: [4,0]}}, [
                    InputComposite({label: "Coverage", labelColor: "black", style: {display: "inline-block", width: "calc(33.3% - 8px)", margin: [4,4,4,4], "vertical-align": "top"}}, [
                        Select({
                            dataKey: "coverage", 
                            style: {height: 24}, 
                            items: AssuranceSelection.Coverage, 
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
                            tabIndex:(tabIndex++)
                        })
                    ]),
                    InputComposite({label: "Level", labelColor: "black", style: {display: "inline-block", width: "calc(33.3% - 8px)", margin: [4,4,4,4], "vertical-align": "top"}}, [
                        Select({
                            dataKey: "level", 
                            style: {height: 24}, 
                            items: AssuranceSelection.Level, 
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
                            tabIndex:(tabIndex++)
                        })
                    ]),
                    InputComposite({label: "Boundary", labelColor: "black", style: {display: "inline-block", width: "calc(33.3% - 8px)", margin: [4,4,4,4], "vertical-align": "top"}}, [
                        Select({
                            dataKey: "boundary", 
                            style: {height: 24}, 
                            items: AssuranceSelection.Boundary, 
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
                            tabIndex:(tabIndex++)
                        })
                    ]),
                    InputComposite({label: "Provider Name", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 8px)", margin: [4,4,4,4], "vertical-align": "top"}}, [
                        TextField({dataKey: "providerName", height: 24, tabIndex:(tabIndex++)})
                    ]),
                    InputComposite({label: "UpdatedDate", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 8px)", margin: [4,0,4,4], "vertical-align": "top"}}, [
                        DateField({dataKey: "updatedDate", width: "100%", height: 24, tabIndex:(tabIndex++)})
                    ]),
                    InputComposite({label: "Standard", labelColor: "black", style: {margin: [4,4,4,4], "vertical-align": "top"}}, [
                        TextField({dataKey: "standard", height: 24, tabIndex:(tabIndex++)})
                    ]),
                    InputComposite({label: "Comments", labelColor: "black", style: {margin: [4,4,4,4], "vertical-align": "top"}}, [
                        TextArea({dataKey: "comments", height: 24, tabIndex:(tabIndex++)})
                    ])
                ]),
                View([
                    InputComposite({label: "Available start date", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,4,4,0]}}, [
                        DateField({dataKey: "availableStartDate", width: "100%", height: 24, format: dateFormat, tabIndex:(tabIndex++)})
                    ]),
                    InputComposite({label: "Available end date", labelColor: "black", style: {display: "inline-block", width: "calc(50% - 4px)", margin: [4,0,4,4]}}, [
                        DateField({dataKey: "availableEndDate", width: "100%", height: 24, format: dateFormat, tabIndex:(tabIndex++)})
                    ])
                ]),
                InputComposite({label: "Comment", labelColor: "black", style: {position: "relative", margin: [4,0]}}, [
                    TextArea({dataKey: "comment", style: {"min-height": 24}, tabIndex:(tabIndex++)})
                ])
            ]),
            View({align: "center", style: {margin: [16,0,0,0]}}, [
                Button({label: "Register", style: {"font-weight":"600", margin: [0,8], color: Colors.ApplyButton}, blocking: true, tapHandler: button => {
                    this.register(button);
                }, tabIndex:(tabIndex++)}),
                Button(".deleteButton", {label: "Delete", style: {margin: [0,8], display: "none"}, tapHandler: button => {
                    Controls.Message("This data will be deleted. Are you sure?", "confirm", "OK", () => {
                        this.deleteHandler(this.data);
                    });
                }, tabIndex:(tabIndex++)}),
                Button({label: "Close", style: {margin: [0,8], color: Colors.CancelButton}, tapHandler: button => {
                    this.dismissHandler();
                }, tabIndex:(tabIndex++)})
            ])
        ]);

        this.view.querySelector(".contents").style.height = (window.innerHeight - 192) + "px";

        this.dataLoadedHandler = () => {
            this.updateUnitField();
            
            if(this.data.productId != null) {
                this.view.querySelector(".deleteButton").style.display = "inline-block";
            }
            this.loadGwpReports();
            this.loadAccountingStandards();
            if(this.data.productId != null) {
                this.totalProductionEmissions().then(productionEmissions => {
                    this.productionEmissions = productionEmissions;
                });
            }
        };
    }

    /**
     * Calculate carbon footprint from 
     *   production activities and emission factors, 
     *   component amounts and their product footprints.
     * @returns {BigNumber}
     */
    async totalProductionEmissions() {
        let carbonFootprint = new BigNumber(0);

        if(this.productionActivities != null && this.productionActivities.length > 0) {
            let emissionsList = await Promise.all(this.productionActivities.map(async productActivity => {
                let emissionFactorId = productActivity.emissionFactorId;
                let amount = productActivity.amount;
                let emissionFactor = await HttpConnection.request(ContextPath+"/emission-factors/"+emissionFactorId, "GET");
                let value = emissionFactor.value;
                let numeratorUnit = emissionFactor.numeratorUnit;
                let emissions = new BigNumber(value).multipliedBy(new BigNumber(amount));
                if(numeratorUnit == "t-CO2e") {
                    emissions = emissions.multipliedBy(new BigNumber(1000));
                }
                return emissions;
            }));
            carbonFootprint = emissionsList.reduce((result, emissions) => {
                return result.plus(emissions);
            }, carbonFootprint);
        }

        let parts = await HttpConnection.request(ContextPath+"/products?parentProductId="+this.data.productId, "GET");
        if(parts.length > 0) {
            let emissionsList = await Promise.all(parts.map(async product => {
                if(product.amount == null) return new BigNumber(0);
                let productFootprints = await HttpConnection.request(ContextPath+"/product-footprints?productId="+product.productId, "GET");
                let productFootprint = productFootprints.find(productFootprint => productFootprint.status == "Active");
                if(productFootprint == null || productFootprint.carbonFootprint == null) return new BigNumber(0);
                return new BigNumber(productFootprint.carbonFootprint).multipliedBy(new BigNumber(product.amount));
            }));
            carbonFootprint = emissionsList.reduce((result, emissions) => {
                return result.plus(emissions);
            }, carbonFootprint);
        }

        return carbonFootprint;
    }

    updateCarbonFootprint() {
        let fossilEmissions = this.data.fossilEmissions;
        let biogenicRemoval = this.data.biogenicRemoval;
        let aircraftEmissions = this.data.aircraftEmissions;
        let packagingGhgEmissions = this.data.packagingGhgEmissions;
        let carbonFootprint;
        let carbonFootprintIncludingBiogenic;
        if(this.data.amount != null && this.productionEmissions != null) {
            carbonFootprint = this.productionEmissions.dividedBy(new BigNumber(this.data.amount));
            carbonFootprintIncludingBiogenic = carbonFootprint;
        }else {
            carbonFootprint = new BigNumber(0);
            carbonFootprintIncludingBiogenic = carbonFootprint;
        }
        if(fossilEmissions != null) {
            carbonFootprint = carbonFootprint.plus(new BigNumber(fossilEmissions));
            carbonFootprintIncludingBiogenic = carbonFootprintIncludingBiogenic.plus(new BigNumber(fossilEmissions));
        }
        if(biogenicRemoval != null) {
            carbonFootprintIncludingBiogenic = carbonFootprintIncludingBiogenic.plus(new BigNumber(biogenicRemoval));
        }
        if(aircraftEmissions != null) {
            carbonFootprint = carbonFootprint.plus(new BigNumber(aircraftEmissions));
            carbonFootprintIncludingBiogenic = carbonFootprintIncludingBiogenic.plus(new BigNumber(aircraftEmissions));
        }
        if(packagingGhgEmissions != null) {
            carbonFootprint = carbonFootprint.plus(new BigNumber(packagingGhgEmissions));
            carbonFootprintIncludingBiogenic = carbonFootprintIncludingBiogenic.plus(new BigNumber(packagingGhgEmissions));
        }
        this.data.carbonFootprint = carbonFootprint.toString();
        this.data.carbonFootprintIncludingBiogenic = carbonFootprintIncludingBiogenic.toString();
        this.reloadData();
    }

    updateUnitField() {
        let amountField = this.view.querySelector(".amountField");
        let amountUnitField = this.view.querySelector(".amountUnitField");
        amountField.style.width = "calc(100% - " + (amountUnitField.offsetWidth + 8) + "px)";

        this.view.querySelectorAll(".carbonFootprintField").forEach(carbonFootprintField => {
            carbonFootprintField.querySelector("input").unit = "kg-CO<sub>2</sub>e / " + this.data.amountUnit;
        });
        this.view.querySelectorAll(".carbonContentField").forEach(carbonContentField => {
            carbonContentField.querySelector("input").unit = "kg-C / " + this.data.amountUnit;
        });
    }

    loadGwpReports() {
        let field = this.view.querySelector(".gwpReportsField");
        field.querySelectorAll(".item").forEach(item => item.remove());
        this.data.gwpReports.forEach(entry => {
            let view = View({style: {
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
                    "vertical-align": "middle"
                }}, [entry]), 
                View({style:{
                    margin: [0,0,0,4],
                    display: "inline-block",
                    "vertical-align": "middle",
                    width: 16,
                    height: 16,
                    "background-image": "images/remove.svg",
                    "background-repeat": "no-repeat",
                    "background-size": 16,
                    "background-position": "center",
                    cursor: "pointer"
                }, tapHandler: () => {
                    let index = view.indexOf(entry);
                    this.data.gwpReports.splice(index, 1);
                    view.remove();
                }})
            ]);
            field.appendChild(view);
        });
    }

    loadAccountingStandards() {
        let field = this.view.querySelector(".accountingStandardsField");
        field.querySelectorAll(".item").forEach(item => item.remove());
        this.data.accountingStandards.forEach(entry => {
            let view = View({style: {
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
                    "vertical-align": "middle"
                }}, [entry]), 
                View({style:{
                    margin: [0,0,0,4],
                    display: "inline-block",
                    "vertical-align": "middle",
                    width: 16,
                    height: 16,
                    "background-image": "images/remove.svg",
                    "background-repeat": "no-repeat",
                    "background-size": 16,
                    "background-position": "center",
                    cursor: "pointer"
                }, tapHandler: () => {
                    let index = view.indexOf(entry);
                    this.data.accountingStandards.splice(index, 1);
                    view.remove();
                }})
            ]);
            field.appendChild(view);
        });
    }

    register(button) {
        if(!this.view.validate()) {
            button.restore();
            return;
        }

        if(this.data.biogenicRemoval != null) {
            let biogenicRemoval = this.data.biogenicRemoval;
            if(typeof biogenicRemoval == "string" || typeof biogenicRemoval == "number") {
                biogenicRemoval = new BigNumber(biogenicRemoval);
            }
            if(!biogenicRemoval.isZero() && biogenicRemoval.isPositive()) {
                Controls.Message("The biogenic removal must be zero or negative.", "warning", function() {});
                return;
            }
        }

        if(this.data.availableStartDate != null && this.data.availableEndDate != null) {
            let startDate = this.data.availableStartDate;
            let endDate = this.data.availableEndDate;
            if(!(startDate instanceof Date)) {
                startDate = new Date(startDate);
            }
            if(!(endDate instanceof Date)) {
                endDate = new Date(endDate);
            }
            if(startDate.getTime() >= endDate.getTime()) {
                Controls.Message("The available Start Date must be earlier than the available end date.", "warning", function() {});
            }
        }

        if(this.data.measurementStartDate != null && this.data.measurementEndDate != null) {
            let startDate = this.data.measurementStartDate;
            let endDate = this.data.measurementEndDate;
            if(!(startDate instanceof Date)) {
                startDate = new Date(startDate);
            }
            if(!(endDate instanceof Date)) {
                endDate = new Date(endDate);
            }
            if(startDate.getTime() >= endDate.getTime()) {
                Controls.Message("The measurement start date must be earlier than the measurement end date.", "warning", function() {});
            }
        }

        if(this.data.exemptedEmissionsRate != null) {
            let number = this.data.exemptedEmissionsRate;
            if(typeof number != "number") {
                number = Number(number);
            }
            if(number < 0 || number > 100) {
                Controls.Message("The exempted emissions rate must be a number between 0 and 100.", "warning", function() {});
            }
        }

        if(this.data.primaryDataShare != null) {
            let number = this.data.primaryDataShare;
            if(typeof number != "number") {
                number = Number(number);
            }
            if(number < 0 || number > 100) {
                Controls.Message("The primary data share must be a number between 0 and 100.", "warning", function() {});
            }
        }

        if(this.data.dataQualityIndicator != null && this.data.dataQualityIndicator.coverage != null) {
            let number = this.data.dataQualityIndicator.coverage;
            if(typeof number != "number") {
                number = Number(number);
            }
            if(number < 0 || number > 100) {
                Controls.Message("The coverage must be a number between 0 and 100.", "warning", function() {});
            }
        }

        if(this.data.dataQualityIndicator != null && this.data.dataQualityIndicator.ter != null) {
            let number = this.data.dataQualityIndicator.ter;
            if(typeof number != "number") {
                number = Number(number);
            }
            if(number < 1 || number > 3) {
                Controls.Message("The TeR must be a number between 0 and 100.", "warning", function() {});
            }
        }

        if(this.data.dataQualityIndicator != null && this.data.dataQualityIndicator.tir != null) {
            let number = this.data.dataQualityIndicator.tir;
            if(typeof number != "number") {
                number = Number(number);
            }
            if(number < 1 || number > 3) {
                Controls.Message("The TiR must be a number between 0 and 100.", "warning", function() {});
            }
        }

        if(this.data.dataQualityIndicator != null && this.data.dataQualityIndicator.ger != null) {
            let number = this.data.dataQualityIndicator.ger;
            if(typeof number != "number") {
                number = Number(number);
            }
            if(number < 1 || number > 3) {
                Controls.Message("The GeR must be a number between 0 and 100.", "warning", function() {});
            }
        }

        if(this.data.dataQualityIndicator != null && this.data.dataQualityIndicator.completeness != null) {
            let number = this.data.dataQualityIndicator.completeness;
            if(typeof number != "number") {
                number = Number(number);
            }
            if(number < 1 || number > 3) {
                Controls.Message("The completeness must be a number between 0 and 100.", "warning", function() {});
            }
        }

        if(this.data.dataQualityIndicator != null && this.data.dataQualityIndicator.reliability != null) {
            let number = this.data.dataQualityIndicator.reliability;
            if(typeof number != "number") {
                number = Number(number);
            }
            if(number < 1 || number > 3) {
                Controls.Message("The reliability must be a number between 0 and 100.", "warning", function() {});
            }
        }

        if(this.data.carbonFootprint != null && typeof this.data.carbonFootprint == "number") {
            this.data.carbonFootprint = this.data.carbonFootprint.toString();
        }
        if(this.data.carbonFootprintIncludingBiogenic != null && typeof this.data.carbonFootprintIncludingBiogenic == "number") {
            this.data.carbonFootprintIncludingBiogenic = this.data.carbonFootprintIncludingBiogenic.toString();
        }
        if(this.data.fossilEmissions != null && typeof this.data.fossilEmissions == "number") {
            this.data.fossilEmissions = this.data.fossilEmissions.toString();
        }
        if(this.data.fossilCarbonContent != null && typeof this.data.fossilCarbonContent == "number") {
            this.data.fossilCarbonContent = this.data.fossilCarbonContent.toString();
        }
        if(this.data.biogenicCarbonContent != null && typeof this.data.biogenicCarbonContent == "number") {
            this.data.biogenicCarbonContent = this.data.biogenicCarbonContent.toString();
        }
        if(this.data.dLucEmissions != null && typeof this.data.dLucEmissions == "number") {
            this.data.dLucEmissions = this.data.dLucEmissions.toString();
        }
        if(this.data.landManagementEmissions != null && typeof this.data.landManagementEmissions == "number") {
            this.data.landManagementEmissions = this.data.landManagementEmissions.toString();
        }
        if(this.data.otherBiogenicEmissions != null && typeof this.data.otherBiogenicEmissions == "number") {
            this.data.otherBiogenicEmissions = this.data.otherBiogenicEmissions.toString();
        }
        if(this.data.iLucGhgEmissions != null && typeof this.data.iLucGhgEmissions == "number") {
            this.data.iLucGhgEmissions = this.data.iLucGhgEmissions.toString();
        }
        if(this.data.biogenicRemoval != null && typeof this.data.biogenicRemoval == "number") {
            this.data.biogenicRemoval = this.data.biogenicRemoval.toString();
        }
        if(this.data.aircraftEmissions != null && typeof this.data.aircraftEmissions == "number") {
            this.data.aircraftEmissions = this.data.aircraftEmissions.toString();
        }
        if(this.data.measurementStartDate != null && this.data.measurementStartDate instanceof Date){
            this.data.measurementStartDate = DateUtils.formatToIso8601String(this.data.measurementStartDate, true);
        }
        if(this.data.measurementEndDate != null && this.data.measurementEndDate instanceof Date){
            this.data.measurementEndDate = DateUtils.formatToIso8601String(this.data.measurementEndDate, true);
        }
        if(this.data.availableStartDate != null && this.data.availableStartDate instanceof Date){
            this.data.availableStartDate = DateUtils.formatToIso8601String(this.data.availableStartDate, true);
        }
        if(this.data.availableEndDate != null && this.data.availableEndDate instanceof Date){
            this.data.availableEndDate = DateUtils.formatToIso8601String(this.data.availableEndDate, true);
        }
        if(this.data.subdivision != null) {
            this.data.country = null;
            this.data.region = null;
        }
        if(this.data.country != null) {
            this.data.subdivision = null;
            this.data.region = null;
        }
        if(this.data.region != null) {
            this.data.subdivision = null;
            this.data.country = null;
        }
        if(this.data.amount != null && typeof this.data.amount == "number") {
            this.data.amount = this.data.amount.toString();
        }
        if(this.data.dataQualityIndicator != null && this.data.dataQualityIndicator.ter != null && typeof this.data.dataQualityIndicator.ter == "number") {
            this.data.dataQualityIndicator.ter = this.data.dataQualityIndicator.ter.toString();
        }
        if(this.data.dataQualityIndicator != null && this.data.dataQualityIndicator.tir != null && typeof this.data.dataQualityIndicator.tir == "number") {
            this.data.dataQualityIndicator.tir = this.data.dataQualityIndicator.tir.toString();
        }
        if(this.data.dataQualityIndicator != null && this.data.dataQualityIndicator.ger != null && typeof this.data.dataQualityIndicator.ger == "number") {
            this.data.dataQualityIndicator.ger = this.data.dataQualityIndicator.ger.toString();
        }
        if(this.data.dataQualityIndicator != null && this.data.dataQualityIndicator.completeness != null && typeof this.data.dataQualityIndicator.completeness == "number") {
            this.data.dataQualityIndicator.completeness = this.data.dataQualityIndicator.completeness.toString();
        }
        if(this.data.dataQualityIndicator != null && this.data.dataQualityIndicator.reliability != null && typeof this.data.dataQualityIndicator.reliability == "number") {
            this.data.dataQualityIndicator.reliability = this.data.dataQualityIndicator.reliability.toString();
        }
        if(this.data.exemptedEmissionsRate > 0 && this.data.exemptedEmissionsReason.length == 0) {
            Controls.Message("Since the Exempted Emissions Rate is greater than or equal to zero percent,\nplease state the reason for this in the Exempted Emissions Reason.", "warning", function(){});
            button.restore();
            return;
        }

        this.applyHandler(this.data);
    }
}

class CarbonAccountingRuleRegisterView extends PopoverViewController {

    constructor() {
        super();

        this.parent = "body";
        this.container.style.backgroundColor = "white";
        this.container.style.padding = "24px";
        this.container.style.borderRadius = "8px";

        let operators = [
            {label: "PEF", value: "PEF"},
            {label: "EPD", value: "EPD"},
            {label: "Other", value: "Other"}
        ];

        this.view = View({width: 320}, [
            View({style: {
                margin: [0,0,16,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, ["Carbon Accounting Rule"]),
            InputComposite({label: "Operator", labelColor: "black", style: {margin: [4,0], position: "relative"}}, [
                Select({
                    dataKey: "operator", 
                    style: {height: 24}, 
                    items: operators, 
                    selectedIndex: 0,
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
                    tabIndex: 1
                }),
                RequiredLabel()
            ]),
            InputComposite({label: "Rule Names", labelColor: "black", style: {margin: [4,0], position: "relative"}}, [
                View(".ruleNamesField", {style: {display: "inline-block", height: 24, "line-height": "normal"}, tabIndex:1}),
                TextField("ruleNameField", {width: "calc(100% - 32px)", height: 24, style: {display: "none"}, tabIndex: 2, changeHandler: event => {
                    this.loadRuleNames();
                }}),
                Button(".addButton", {style: {
                    "background-image": "images/add.svg",
                    "background-position": "center",
                    "background-size": 16,
                    "background-repeat": "no-repeat",
                    width: 24, 
                    height: 24
                }, tapHandler: () => {
                    let field = this.view.querySelector(".ruleNameField");
                    field.style.display = "inline-block";
                    field.focus();
                }}),
                RequiredLabel()
            ]),
            InputComposite({label: "Operator Name", labelColor: "black", style: {margin: [4,0], position: "relative"}}, [
                TextField({height: 24, tabIndex: 3})
            ]),
            View({align: "center", style: {margin: [16,0,0,0]}}, [
                Button({label: "Register", style: {"font-weight":"600", margin: [0,8], color: Colors.ApplyButton}, tapHandler: button => {
                    if(!this.view.validate()) {
                        button.restore();
                        return;
                    }
                    if(this.data.operator == null) {
                        Controls.Message("Please select the operator.");
                        return;
                    }
                    if(this.data.operator == "Other" && (this.data.operatorName == null || this.data.operatorName.length == 0)) {
                        Controls.Message("Please input the operator name.");
                        return;
                    }
                    this.applyHandler(button);
                }, tabIndex:4}),
                Button({label: "Cancel", style: {margin: [0,8], color: Colors.CancelButton}, tapHandler: button => {
                    this.dismiss();
                }, tabIndex:5})
            ]),
        ]);

        this.dataLoadedHandler = () => {
            this.loadRuleNames();
        }
    }

    loadRuleNames() {
        let field = this.view.querySelector(".ruleNamesField");
        this.data.ruleNames.forEach(entry => {
            let view = View({style: {
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
                    "vertical-align": "middle"
                }}, [entry]), 
                View({style:{
                    margin: [0,0,0,4],
                    display: "inline-block",
                    "vertical-align": "middle",
                    width: 16,
                    height: 16,
                    "background-image": "images/remove.svg",
                    "background-repeat": "no-repeat",
                    "background-size": 16,
                    "background-position": "center",
                    cursor: "pointer"
                }, tapHandler: () => {
                    let index = view.indexOf(entry);
                    this.data.ruleNames.splice(index, 1);
                    view.remove();
                }})
            ]);
            field.appendChild(view);
        });
    }
}