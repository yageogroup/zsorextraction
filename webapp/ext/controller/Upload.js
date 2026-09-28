sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/ui/layout/form/SimpleForm",
    "sap/ui/unified/FileUploader"
], function (
    MessageToast,
    MessageBox,
    Dialog,
    Button,
    Label,
    Input,
    SimpleForm,
    FileUploader
) {
    "use strict";

    const ALLOWED_EXT = ["pdf", "xls", "xlsx"];

    const MIME_BY_EXT = {
        pdf:  "application/pdf",
        xls:  "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };

    const INVALID_TYPE_MSG =
        "Only PDF or Excel files (.pdf, .xls, .xlsx) are allowed.";

    return {
        _pDialog: null,
        _oFile: null,

        _getExtension: function (oFile) {
            if (!oFile || !oFile.name || oFile.name.indexOf(".") === -1) {
                return "";
            }
            return oFile.name.split(".").pop().toLowerCase();
        },

        _isAllowedFile: function (oFile) {
            return ALLOWED_EXT.includes(this._getExtension(oFile));
        },

        _getMimeType: function (oFile) {
            // Some browsers return an empty type for .xls, so fall back to the extension
            return oFile.type || MIME_BY_EXT[this._getExtension(oFile)] || "";
        },

        uploadHandler: function (oContext, aSelectedContexts) {

            this._oFile = null;

            let oFileUploader = new FileUploader({
                width: "100%",
                placeholder: "Choose file (PDF or Excel)",
                fileType: ALLOWED_EXT,
                typeMissmatch: function (oEvent) {
                    this._oFile = null;
                    oEvent.getSource().clear();
                    MessageBox.error(
                        "File type '" + oEvent.getParameter("fileType") +
                        "' is not supported. " + INVALID_TYPE_MSG
                    );
                }.bind(this),
                change: function (oEvent) {
                    let oFiles = oEvent.getParameter("files");
                    let oFile = oFiles && oFiles.length > 0 ? oFiles[0] : null;

                    if (oFile && !this._isAllowedFile(oFile)) {
                        this._oFile = null;
                        oEvent.getSource().clear();
                        MessageBox.error(INVALID_TYPE_MSG);
                        return;
                    }
                    this._oFile = oFile;
                }.bind(this)
            });

            let oForm = new SimpleForm({
                content: [
                    new Label({ text: "File" }),
                    oFileUploader
                ]
            });

            this._pDialog = new Dialog({
                title: "Upload",
                content: [oForm],

                beginButton: new Button({
                    text: "Submit",
                    press: function () {

                        if (!this._oFile) {
                            MessageToast.show("Please select a file.");
                            return;
                        }

                        if (!this._isAllowedFile(this._oFile)) {
                            MessageBox.error(INVALID_TYPE_MSG);
                            return;
                        }

                        const oReader = new FileReader();

                        oReader.onload = function (e) {

                            let binary = "";
                            const bytes = new Uint8Array(e.target.result);
                            for (let i = 0; i < bytes.byteLength; i++) {
                                binary += String.fromCharCode(bytes[i]);
                            }
                            const sBase64 = btoa(binary);

                            let sActionName =
                                "com.sap.gateway.srvd.zsd_zsor_req.v0001.uploadFile";

                            let parameters = [];
                            parameters.push({ name: "file_name",    value: this._oFile.name });
                            parameters.push({ name: "mime_type",    value: this._getMimeType(this._oFile) });
                            parameters.push({ name: "file_content", value: sBase64 });

                            const oActionContext = this._controller
                                .getExtensionAPI()
                                .getModel()
                                .bindContext("/ZP_ZSOR_HDR")
                                .getBoundContext();

                            let mParameters = {
                                contexts: oActionContext,
                                label: "Upload",
                                invocationGrouping: "ChangeSet",
                                parameterValues: parameters,
                                skipParameterDialog: true
                            };

                            this.editFlow.invokeAction(
                                sActionName,
                                mParameters
                            ).then(function () {
                                MessageToast.show("File uploaded successfully");
                            });

                            this._oFile = null;
                            this._pDialog.close();

                        }.bind(this);

                        oReader.onerror = function () {
                            MessageToast.show(
                                "Failed to read the file. Please try again."
                            );
                        };

                        oReader.readAsArrayBuffer(this._oFile);
                    }.bind(this)
                }),

                endButton: new Button({
                    text: "Close",
                    press: function () {
                        this._oFile = null;
                        this._pDialog.close();
                    }.bind(this)
                }),

                afterClose: function () {
                    this._pDialog.destroy();
                    this._pDialog = null;
                }.bind(this)
            });

            this._pDialog.open();
        }
    };
});