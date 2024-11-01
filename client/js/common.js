/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

let dateFormat;
if(navigator.language != null) {
    if(navigator.language == "en-US" || navigator.language == "en-us") {
        dateFormat = "MMM d, yyyy";
    }else if(navigator.language.startsWith("ja") || navigator.language.startsWith("zh") || navigator.language.startsWith("ko") || navigator.language.startsWith("hu")) {
        dateFormat = "yyyy/M/d";
    }else {
        dateFormat = "d MMM yyyy";
    }
}else {
    dateFormat = "d MMM yyyy";
}

/**
 * @param {"UUID"|"SGTIN"|"SGLN"|"LEI"|"SupplierSpecific"|"BuyerSpecific"} type 
 * @param {string} code 
 * @returns {boolean}
 */
function validateIdentifier(type, code) {
    if(type == "UUID") {
        return /^[0-9A-F]{8}-[0-9A-F]{4}-[1-4]{1}[0-9A-F]{3}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(code) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-4]{1}[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(code);
    }else if(type == "SGTIN") {
        return /^[0-9]{13,14}[0-9]{1,20}$/.test(code);
    }else if(type == "SGLN") {
        return /^[0-9]{13}[0-9]{1,20}$/.test(code);
    }else if(type == "LEI") {
        return /^[0-9A-Z]{20}$/.test(code);
    }else if(type == "SupplierSpecific" || type == "BuyerSpecific") {
        return true;
    }
    return false;
}

class IdentifierRegisterView extends PopoverViewController {

    /**
     * @param {string} title 
     * @param {"Company"|"Product"} identifierType 
     */
    constructor(title, identifierType) {
        super();
        this.parent = "body";
        this.container.style.backgroundColor = "white";
        this.container.style.padding = "24px";
        this.container.style.borderRadius = "8px";

        if(identifierType == "Company") {
            this.types = [
                {value: "UUID", label: "UUID"},
                {value: "SGLN", label: "SGLN"},
                {value: "LEI", label: "LEI"},
                {value: "SupplierSpecific", label: "Supplier Specific"},
                {value: "BuyerSpecific", label: "Buyer Specific"}
            ];
        }else if(identifierType == "Product") {
            this.types = [
                {value: "UUID", label: "UUID"},
                {value: "SGTIN"},
                {value: "SupplierSpecific", label: "Supplier Specific"},
                {value: "BuyerSpecific", label: "Buyer Specific"}
            ];
        }else {
            throw new Error("Invalid identifier type");
        }
        
        this.view = View({width: 420}, [
            View({style: {
                margin: [0,0,16,0],
                "font-size": "1.5em",
                "font-weight": 900
            }}, [title]),
            InputComposite({label: "Type", labelColor: "black", style: {position: "relative"}}, [
                Select({
                    dataKey: "type", 
                    items: this.types, 
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
            InputComposite({label: "Identifier", labelColor: "black", style: {position: "relative"}}, [
                TextField({dataKey: "code", height: 24, required: "required", tabIndex:2}),
                RequiredLabel()
            ]),
            View({align: "center", style: {margin: [16,0,0,0]}}, [
                Button({label: "Register", style: {"font-weight":"600", margin: [0,8], color: Colors.ApplyButton}, tapHandler: button => {
                    this.addIdentifier(button);
                }, tabIndex:3}),
                Button({label: "Cancel", style: {margin: [0,8], color: Colors.CancelButton}, tapHandler: button => {
                    this.dismiss();
                }, tabIndex:4})
            ])
        ]);
    }

    addIdentifier(button) {
        if(!this.view.validate()) {
            button.restore();
            return;
        }
        if(this.data.type == null) {
            Controls.Message("Please select the type.");
            return;
        }
        if(!validateIdentifier(this.data.type, this.data.code)) {
            let typeExp = this.types.find(type => type.value == this.data.type).label;
            Controls.Message("Please confirm the format of {1}.".replace("{1}", typeExp));
            return;
        }
        this.applyHandler(this.data);
        this.dismiss();
    }
}

/**
 * @param {object} source 
 * @returns {object}
 */
function copyRecord(source) {
    function _copyRecord(value) {
        if(Array.isArray(value)) {
            return value.map(element => _copyRecord(element));
        }else if(typeof value == "object" && value != null && !(value instanceof Date) && !(value instanceof File)) {
            return copyRecord(value);
        }else {
            return value;
        }
    }
	let target = {};
	Object.keys(source).forEach(key => {
        target[key] = _copyRecord(source[key]);
    });
    return target;
}

function RequiredLabel() {
    return View(".requiredLabel", {style: {
        display: "inline-block",
        position: "absolute",
        right: 2,
        top: 2,
        padding: 2,
        "font-size": "xx-small",
        "background-color": "black",
        color: "white",
        "border-radius": 4,
        opacity: 0.4
    }}, ["Required"]);
}