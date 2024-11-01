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

class EmissionFactorView extends ViewController {

    selectedCategory = null;

    constructor() {
        super();
        this.parent = "body > .main > .contents";
        this.data = [];
        this.view = View({style: {
            opacity: 0
        }}, [
            View({style: {
                margin: 16,
                padding: 32,
                "max-width": 700,
                "background-color": "rgba(255,255,255,0.6)",
                "border-radius": 8,
                "user-select": "none"
            }}, [
                View({style: {
                    margin: [0,0,8,0],
                    "font-size": "1.5em",
                    "font-weight": 900
                }}, ["Emission Factors"]),
                View({style: {
                    margin: [0,0,16,0],
                    "font-size": "small"
                }}, ["The emission factor category is set to the inventory database name or subcategory.<br/>Clicking on a category's folder icon will display the subcategories and emission factors contained in that category."]),
                View({height: 40}, [
                    Button({style: {
                        "background-image": "images/add.svg",
                        "background-position": [0, "center"],
                        "background-size": 16,
                        "background-repeat": "no-repeat",
                        padding: [8,16,8,20]
                    }, tapHandler: () => {
                        let record = {
                            emissionFactorCategoryId: null,
                            emissionFactorCategoryName: null,
                            version: null,
                            parentEmissionFactorCategoryId: null
                        };
                        if(this.selectedCategory != null) {
                            record.depth = this.selectedCategory.depth == null ? 1 : this.selectedCategory.depth+1;
                        }
                        this.data.push(record);
                        this.reloadData();
                        this.reloadView();
                    }}, ["Add Category"]),
                    Button({style: {
                        "background-image": "images/add.svg",
                        "background-position": [0, "center"],
                        "background-size": 16,
                        "background-repeat": "no-repeat",
                        padding: [8,16,8,20]
                    }, tapHandler: () => {
                        if(this.selectedCategory == null) {
                            Controls.Message("Select an emission factor category.\nTo select, click on the folder icon.", "info", "OK", function() {});
                            return;
                        }
                        let record = {
                            emissionFactorId: null,
                            emissionFactorName: null,
                            value: null,
                            numeratorUnit: "kg-CO2e",
                            denominatorUnit: "kg",
                            emissionFactorCategoryId: this.selectedCategory.emissionFactorCategoryId
                        };
                        record.depth = this.selectedCategory.depth == null ? 1 : this.selectedCategory.depth+1;
                        this.data.push(record);
                        this.reloadData();
                        this.reloadView();
                    }}, ["Add Emission Factor"])
                ]),
                Table(".list", {
                    dataKey: ".",
                    columns: [
                        {label: "Emission Factor Name", style: {
                            padding: [0,4],
                            "vertical-align": "middle",
                            "line-height": "1em"
                        }, dataKey: "emissionFactorName", dataHandler: (cell, value, record) => {
                            let iconPath = "images/";
                            if(record.emissionFactorId === undefined) {
                                if(this.selectedCategory != null && record.emissionFactorCategoryId == this.selectedCategory.emissionFactorCategoryId) {
                                    iconPath += "folder-open.svg";
                                }else {
                                    iconPath += "folder.svg";
                                }
                            }else {
                                iconPath += "emissions.svg";
                            }
                            cell.appendChild(InlineImage({src: iconPath, width: 16, height: 16, style: {
                                "vertical-align": "middle", 
                                margin: [0,8,0,(record.depth == null ? 0 : 24*record.depth)]
                            }, tapHandler: event => {
                                event.stopPropagation();
                                this.selectRow(record);
                            }}));

                            let name;
                            if(record.emissionFactorId === undefined) {
                                name = record.emissionFactorCategoryName;
                            }else {
                                name = record.emissionFactorName;
                            }
                            if(record.version != null) {
                                name += " " + record.version;
                            }
                            if(name == null) {
                                name = "";
                            }
                            cell.appendChild(HtmlTag("span", ".nameView", [name]));
                        }},
                        {label: "Value", style: {
                            "vertical-align": "middle",
                            width: 120,
                            "text-align": "right",
                            "font-weight": 600,
                            padding: [0,4],
                        }, dataKey: "value", dataHandler: (cell, value, record) => {
                            if(value == null) return;
                            if(record.emissionFactorId === undefined) return;
                            cell.innerText = value;
                        }},
                        {label: "", style: {
                            "vertical-align": "middle",
                            width: 120,
                            "font-size": "small",
                            padding: [0,4],
                        }, dataKey: "numeratorUnit", dataHandler: (cell, value, record) => {
                            if(value == null) return;
                            if(record.emissionFactorId === undefined) return;
                            cell.innerText = record.numeratorUnit + "/" + record.denominatorUnit;
                        }},
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
                        this.dismissInputFields();
                        if(index == 0) {
                            // Emission factor category
                            if(record.emissionFactorId === undefined) {
                                this.editEmissionFactorCategoryName(cells[index], record);
                            }
                            // Emission factor
                            else {
                                this.editEmissionFactorName(cells[index], record);
                            }
                        }else if(index == 1) {
                            if(record.emissionFactorId !== undefined) {
                                this.editEmissionFactorValue(cells[index], record);
                            }
                        }else if(index == 2) {
                            if(record.emissionFactorId !== undefined) {
                                this.editEmissionFactorUnit(cells[index], record);
                            }
                        }else if(index == 3) {
                            Controls.Message("This data will be deleted. Are you sure?", "confirm", "OK", () => {
                                this.deleteData(record, rowIndex);
                            }, "Cancel", function() {});
                        }
                    }
                })
            ])
        ]);

        this.view.styles = {
            ".list > thead > tr > td:last-child": {
                "background": "unset"
            }
        };

        this.loadData();
        this.showContainer();
    }

    showContainer() {
        new FunctionalAnimation(progress => {
            this.view.style.opacity = progress;
        }, FunctionalAnimation.methods.easeInOut, 300).start();
    }

    dismissInputFields() {
        let inputFields = this.view.querySelectorAll(".list input");
        if(inputFields.length > 0) {
            let nameView = inputFields[0].parentElement.querySelector(".nameView");
            for(let i=inputFields.length-1; i>=0; i--) {
                inputFields[i].remove();
            }
            nameView.style.display = "inline";
        }

        let unitField = this.view.querySelector(".unitField");
        if(unitField != null) {
            unitField.remove();
        }
    }

    /**
     * 
     * @param {HTMLTableCellElement} cell 
     * @param {object} record 
     */
    editEmissionFactorCategoryName(cell, record) {
        let view = cell.querySelector(".nameView");
        let offset = view.offsetLeft;
        view.style.display = "none";

        let nameField = TextField({width: "calc(100% - "+(80+offset)+"px)", height: 24, placeholder: "Category", changeHandler: event => {
            if(event.currentTarget.value == null || event.currentTarget.value.length == 0) return;
            record.emissionFactorCategoryName = event.currentTarget.value;
            view.innerText = record.emissionFactorCategoryName + (record.version != null ? (" " + record.version) : "");
            this.updateData(record);
        }});
        nameField.addEventListener("forcus", event => {
            event.stopPropagation();
        });
        nameField.value = record.emissionFactorCategoryName;
        cell.appendChild(nameField);

        let versionField = TextField({width: 80, height: 24, placeholder: "Version", changeHandler: event => {
            if(event.currentTarget.value == null || event.currentTarget.value.length == 0) return;
            record.version = event.currentTarget.value;
            view.innerText = record.emissionFactorCategoryName + (record.version != null ? (" " + record.version) : "");
            this.updateData(record);
        }});
        versionField.addEventListener("click", event => {
            event.stopPropagation();
        });
        versionField.value = record.version;
        cell.appendChild(versionField);

        nameField.focus();
    }

    /**
     * 
     * @param {HTMLTableCellElement} cell 
     * @param {object} record 
     */
    editEmissionFactorName(cell, record) {
        let view = cell.querySelector(".nameView");
        let offset = view.offsetLeft;
        view.style.display = "none";

        let textField = TextField({width: "calc(100% - "+offset+"px)", height: 24, style: {"vertical-align": "middle"}, changeHandler: event => {
            if(event.currentTarget.value == null || event.currentTarget.value.length == 0) return;
            record.emissionFactorName = event.currentTarget.value;
            event.currentTarget.remove();
            view.innerText = record.emissionFactorName;
            view.style.display = "inline";
            this.updateData(record);
        }});
        textField.value = record.emissionFactorName;
        cell.appendChild(textField);
        textField.focus();
    }

    /**
     * 
     * @param {HTMLTableCellElement} cell 
     * @param {object} record 
     */
    editEmissionFactorValue(cell, record) {
        cell.innerText = null;
        let textField = NumericField({width:"100%", height: 24, changeHandler: event => {
            if(event.currentTarget.value == null) return;
            record.value = event.currentTarget.value.toString();
            event.currentTarget.remove();
            cell.innerText = record.value;
            this.updateData(record);
        }});
        textField.value = record.value;
        cell.appendChild(textField);
        textField.focus();
    }

    /**
     * 
     * @param {HTMLTableCellElement} cell 
     * @param {object} record 
     */
    editEmissionFactorUnit(cell, record) {
        cell.innerText = null;
        let unitField = View(".unitField", {style: {
            display: "inline-block", "white-space": "nowrap", "font-size": "small"
        }}, [
            Select({
                style: {display: "inline-block", "vertical-align": "middle"}, 
                items: EmissionFactorUnits, 
                selectedIndex: EmissionFactorUnits.findIndex(entry => entry.value == record.numeratorUnit),
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
                    record.numeratorUnit = EmissionFactorUnits[index].value;
                    cell.innerText = record.numeratorUnit + "/" + record.denominatorUnit;
                    this.updateData(record);
                }
            }),
            HtmlTag("span", {style: {"vertical-align": "middle"}}, ["/"]),
            Select({
                style: {display: "inline-block", "vertical-align": "middle"}, 
                items: ProductActivityUnits, 
                selectedIndex: ProductActivityUnits.findIndex(entry => entry.value == record.denominatorUnit),
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
                    record.denominatorUnit = ProductActivityUnits[index].value;
                    cell.innerText = record.numeratorUnit + "/" + record.denominatorUnit;
                    this.updateData(record);
                }
            })
        ]);
        cell.appendChild(unitField);
    }

    /**
     * @param {object} record 
     */
    updateData(record) {
        // Emission factor category
        if(record.emissionFactorId === undefined) {
            if(record.emissionFactorCategoryName == null) return;
            if(record.emissionFactorCategoryId == null) {
                HttpConnection.request(ContextPath+"/emission-factor-categories", "POST", record).then(response => {
                    record.emissionFactorCategoryId = response.emissionFactorCategoryId;
                });
            }else {
                HttpConnection.request(ContextPath+"/emission-factor-categories/"+record.emissionFactorCategoryId, "PUT", record);
            }
        }
        // Emission factor
        else {
            if(record.emissionFactorName == null || record.value == null) return;
            if(record.emissionFactorId == null) {
                HttpConnection.request(ContextPath+"/emission-factors", "POST", record).then(response => {
                    record.emissionFactorId = response.emissionFactorId;
                });
            }else {
                HttpConnection.request(ContextPath+"/emission-factors/"+record.emissionFactorId, "PUT", record);
            }
        }
    }

    /**
     * @param {object} record 
     * @param {number} rowIndex 
     */
    deleteData(record, rowIndex) {
        // Emission factor category
        if(record.emissionFactorId === undefined) {
            if(record.emissionFactorCategoryId == null) {
                this.data.splice(rowIndex, 1);
                this.reloadData();
            }else {
                HttpConnection.request(ContextPath+"/emission-factor-categories/"+record.emissionFactorCategoryId, "DELETE", record).then(response => {
                    this.data.splice(rowIndex, 1);
                });
            }
        }
        // Emission factor
        else {
            if(record.emissionFactorId == null) {
                this.data.splice(rowIndex, 1);
                this.reloadData();
            }else {
                HttpConnection.request(ContextPath+"/emission-factors/"+record.emissionFactorId, "DELETE", record).then(response => {
                    this.data.splice(rowIndex, 1);
                });
            }
        }
    }

    /**
     * @param {number} emissionFactorCategoryId 
     * @param {number} depth 
     */
    loadData(emissionFactorCategoryId, depth) {
        this.dismissInputFields();

        let table = this.view.querySelector(".list");
        let parameters = "";
        if(emissionFactorCategoryId == null) {
            table.animate = true;
        }else {
            table.animate = false;
            parameters += "?emissionFactorCategoryId="+emissionFactorCategoryId;
        }
        Promise.all([
            HttpConnection.request(ContextPath+"/emission-factor-categories"+parameters, "GET"),
            HttpConnection.request(ContextPath+"/emission-factors"+parameters, "GET")
        ]).then(results => {
            let data = results[0].concat(results[1]);
            data.sort((record1, record2) => {
                let name1 = record1.emissionFactorCategoryName != null ? record1.emissionFactorCategoryName : record1.emissionFactorName;
                let name2 = record2.emissionFactorCategoryName != null ? record2.emissionFactorCategoryName : record2.emissionFactorName;
                return name1 < name2 ? -1 : (name1 > name2 ? 1: 0);
            });
            if(emissionFactorCategoryId == null) {
                this.data = data;
            }else {
                data.forEach(record => {
                    record.depth = depth == null ? 1 : depth+1;
                });
                let index = this.data.findIndex(record => {
                    return record.emissionFactorCategoryId == emissionFactorCategoryId;
                });
                data.reverse().forEach(record => {
                    this.data.splice(index+1, 0, record);
                })
            }
            this.reloadData();
            this.reloadView();
        })
    }

    reloadView() {
        let table = this.view.querySelector(".list");
        let header = table.querySelector("thead");
        table.style.height = (header.offsetHeight + 40 * (this.data.length > 0 ? this.data.length : 1) + 4) + "px";
    }

    selectRow(record) {
        if(record.emissionFactorId != null) return;

        if(this.selectedCategory != null && this.selectedCategory.emissionFactorCategoryId == record.emissionFactorCategoryId) {
            this.selectedCategory = null;
            let index = this.data.findIndex(_record => _record.emissionFactorCategoryId == record.emissionFactorCategoryId);
            let depth = record.depth == null ? 0 : record.depth;
            let size = 0;
            for(let i=index+1; i<this.data.length; i++) {
                let _record = this.data[i];
                if(_record.depth == null || _record.depth <= depth) break;
                size++;
            }
            this.data.splice(index+1, size);
        }else {
            this.selectedCategory = record;
            this.loadData(record.emissionFactorCategoryId, record.depth);
        }
    }
}