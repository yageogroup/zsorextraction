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

    return {
        _pDialog: null,
        _oFile: null,

        uploadHandler: function (oContext, aSelectedContexts) {

            let oFileUploader = new FileUploader({
                width: "100%",
                placeholder: "Choose file",
                change: function (oEvent) {
                    let oFiles = oEvent.getParameter("files");
                    this._oFile = oFiles && oFiles.length > 0 ? oFiles[0] : null;
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
                            parameters.push({ name: "mime_type",    value: this._oFile.type });
                            parameters.push({ name: "file_content", value: sBase64          });

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
                })
            });

            this._pDialog.open();
        }
    };
});