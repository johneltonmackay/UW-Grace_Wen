/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/file', 'N/record', 'N/redirect', 'N/ui/serverWidget', 'N/error', 'N/task', 'N/log', 'N/url', 'N/search'],
    /**
     * @param{file} file
     * @param{record} record
     * @param{redirect} redirect
     * @param{serverWidget} serverWidget
     * @param{error} error
     * @param{task} task
     * @param{log} log
     */
    (file, record, redirect, serverWidget, error, task, log, url, search) => {
        const CONTEXT_METHOD = {
            GET: "GET",
            POST: "POST"
        };

        const onRequest = (scriptContext) => {
            try {
                if (scriptContext.request.method === CONTEXT_METHOD.POST) {
                    let scriptObj = scriptContext.request.parameters;
                    log.debug('onRequest POST scriptObj', scriptObj);

                    var uploadedFile = scriptContext.request.files.custpage_csv_file;
                    let recType = scriptObj.custpage_record_type
                    
                    if (uploadedFile){
                        if (uploadedFile.fileType !== file.Type.CSV) {
                            let mycustomError = error.create({
                                name: 'INVALID FILE TYPE',
                                message: 'Please upload CSV File Only',
                                notifyOff: false
                            });
    
                            redirect.toSuitelet({
                                scriptId: 'customscript_upload_csv_sl',
                                deploymentId: 'customdeploy_upload_csv_sl',
                                parameters: {
                                    data: mycustomError.message
                                }
                            });
                        } else {
                            log.debug('uploadedFile.name', uploadedFile.name)
                            let strFileName = uploadedFile.name
                            uploadedFile.folder = 3812; // PROD 
                            var fileId = uploadedFile.save();
                            if (fileId && recType) {
                                var mapReduceTask = null
                                if (recType == 'Cash Sale'){
                                    mapReduceTask = task.create({
                                        taskType: task.TaskType.MAP_REDUCE,
                                        scriptId: 'customscript_find_next_lot_number_mr',
                                        params: {
                                            custscript_file_name: strFileName
                                        }
                                    });
                                } 
                                if (recType == 'Cash Refund'){
                                    mapReduceTask = task.create({
                                        taskType: task.TaskType.MAP_REDUCE,
                                        scriptId: 'customscript_create_cash_refund_ia_mr',
                                        params: {
                                            custscript_custscript_file_name_csv: strFileName
                                        }
                                    });
                                }
                            
                                var taskId = mapReduceTask.submit();
                                log.debug('taskId', taskId);
                            
                                // Retry logic if taskId is not valid
                                var maxRetries = 5;  // Set maximum number of retries
                                var retries = 0;
                            
                                while (!taskId && retries < maxRetries) {
                                    log.debug('Retrying submission', 'Attempt #' + (retries + 1));
                                    taskId = mapReduceTask.submit();
                                    retries++;
                                }
                            
                                if (taskId) {
                                    redirect.toSuitelet({
                                        scriptId: 'customscript_upload_csv_sl',
                                        deploymentId: 'customdeploy_upload_csv_sl',
                                        parameters: {
                                            taskId: taskId,
                                            recType: recType,
                                            strFileName: strFileName
                                        }
                                    });
                                } else {
                                    let mycustomError = error.create({
                                        name: 'NO DEPLOYMENT AVAILABLE',
                                        message: 'Failed to submit task. Unable to get a valid task Id after ' + maxRetries + ' retries. Please Try Again Later.',
                                        notifyOff: false
                                    });
            
                                    redirect.toSuitelet({
                                        scriptId: 'customscript_upload_csv_sl',
                                        deploymentId: 'customdeploy_upload_csv_sl',
                                        parameters: {
                                            maxRetries: mycustomError.message
                                        }
                                    });
                                }
                            }
                            
                            log.debug('onRequest POST fileId', fileId);
                        }
                    } else {
                        redirect.toSuitelet({
                            scriptId: 'customscript_upload_csv_sl',
                            deploymentId: 'customdeploy_upload_csv_sl',
                        });
                    }
                } else {
                    let scriptObj = scriptContext.request.parameters;
                    log.debug('onRequest GET scriptObj', scriptObj);

                    if (scriptObj.maxRetries){
    
                        var objForm = serverWidget.createForm({
                            title: 'File Upload Error'
                        });
                    
                        objForm.addField({
                            id: 'custpage_error_message',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Error Message'
                        }).defaultValue = '<p style="color:red; font-weight:bold;">' + scriptObj.maxRetries + '</p>';

                        objForm.addSubmitButton({
                            label: 'Try Again'
                        });
                    
                    } else if (scriptObj.isDone && scriptObj.strFileName && scriptObj.recType) {
                        var objForm = viewResults({
                            transkey: scriptObj.strFileName,
                            recType: scriptObj.recType
                        })
                    } else {
                        var objForm = serverWidget.createForm({
                            title: 'Upload CSV File'
                        });

                        var optionField = objForm.addField({
                            id: 'custpage_record_type',
                            type: serverWidget.FieldType.SELECT,
                            label: 'Please Choose Record Type You Wanted To Upload?'
                        });
                        optionField.updateBreakType({
                            breakType: serverWidget.FieldBreakType.STARTCOL
                        });
                        optionField.isMandatory = true;
                        optionField.addSelectOption({
                            value: '',
                            text: ''
                        });
                        optionField.addSelectOption({
                            value: 'Cash Sale',
                            text: 'Cash Sale'
                        });
                        optionField.addSelectOption({
                            value: 'Cash Refund',
                            text: 'Cash Refund'
                        });
    
                        var fileField = objForm.addField({
                            id: 'custpage_csv_file',
                            type: serverWidget.FieldType.FILE,
                            label: 'CSV File'
                        });
                        fileField.isMandatory = true;

                        objForm.addButton({
                            id: 'custpage_goback_btn',
                            label : 'Refresh Page',
                            functionName: 'refreshPage'
                        }); 
    
                        objForm.addSubmitButton({
                            label: 'Upload'
                        });

                        objForm.clientScriptModulePath = '../CS/upload_csv_cs.js';
                    }

                    scriptContext.response.writePage(objForm);
                }
            } catch (err) {
                log.error('ERROR ONREQUEST:', err.message);
            }
        };

        // Private Function

        const viewResults = (options) => {
            try {
                var objForm = serverWidget.createForm({
                    title: 'Upload CSV File',
                });
                log.debug('buildForm options', options)

                objForm.clientScriptModulePath = '../CS/upload_csv_cs.js';

                objForm.addButton({
                    id: 'custpage_goback_btn',
                    label : 'Main Page',
                    functionName: 'refreshPage'
                }); 
                objForm.addField({
                    id: 'custpage_transkey',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Transaction Key'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                }).defaultValue = options.transkey;
 
                viewSublistFields({
                    form: objForm,  
                    parameters: options
                });

                return objForm;
            } catch (err) {
                log.error('ERROR_VIEW_RESULTS:', err.message)
            }
        }

        
        const viewSublistFields = (options) => {
            try {
                let arrFileId = []
                let sublist = options.form.addSublist({
                    id : 'custpage_sublist',
					type : serverWidget.SublistType.LIST,
					label : 'CSV Import Results',
					tab: 'custpage_tabid'
                });

                let ojbFldMap = fldMapping()

                let objFlds = null

                if (options.parameters.recType == 'Cash Refund'){
                    objFlds = ojbFldMap.cashRefundFields

                }

                if (options.parameters.recType == 'Cash Sale'){
                     objFlds = ojbFldMap.cashSalesFields
                }

                for (var strKey in objFlds) {
                    sublist.addField(objFlds[strKey]);
                }

                let paramTransKey = options.parameters.transkey
                log.debug('viewSublistFields paramTransKey', paramTransKey);
                if (paramTransKey){

                    arrFileId = searchFileId(paramTransKey)

                    if (arrFileId.length > 0){
                        let fileObj = file.load({
                            id: arrFileId[0].fileId
                        });
                        if (fileObj){
                            let fileContent = fileObj.getContents();
                            log.debug('fileContent', fileContent)
                            let arrResults = JSON.parse(fileContent)
                            arrResults.forEach((data, index) => {
                                for (const key in data) {
                                    let value = data[key];
                            
                                    if (!value) continue; // Skip falsy values early
                            
                                    if (key === 'line') {
                                        sublist.setSublistValue({
                                            id: `custpage_${key}`,
                                            line: index,
                                            value: parseInt(value, 10), // Ensure base 10 parsing
                                        });
                                    } else if (key === 'remarks'){
                                        let strStatus = data['status']
                                        if (strStatus == 'SUCCESS'){
                                            let SalesId = data['recordid']
                                            let strType = data['recType']

                                            log.debug('SalesId', SalesId)
                                            log.debug('strType', strType)

                                            var strRecUrl = url.resolveRecord({
                                                recordType: strType,
                                                recordId: SalesId
                                            });
                                            let recLink = `<a href='${strRecUrl}' target="_blank" rel="noopener noreferrer">${value}</a>`
                                            log.debug('recLink', recLink)

                                            sublist.setSublistValue({
                                                id: `custpage_${key}`,
                                                line: index,
                                                value: recLink,
                                            });
                                        } else {
                                            sublist.setSublistValue({
                                                id: `custpage_${key}`,
                                                line: index,
                                                value: value,
                                            });
                                        }
                                    } else if (key === 'data' && typeof value === 'object') {
                                        log.debug('objFldValue', value);
                                        for (const fld in value) {
                                            let fldValue = value[fld];
                                            if (!fldValue) continue; // Skip falsy values
                            
                                            sublist.setSublistValue({
                                                id: `custpage_${fld.toLowerCase()}`,
                                                line: index,
                                                value: fldValue,
                                            });
                                        }
                                    } else {
                                        sublist.setSublistValue({
                                            id: `custpage_${key}`,
                                            line: index,
                                            value: value,
                                        });
                                    }
                                }
                            });                            
                        }
                    }
                }
            } catch (err) {
                log.error("BUILD_FORM_ADD_SUBLIST_ERROR", err.message);
            }
        }

        const fldMapping = () => {
            cashSalesFields = {
                FILE_NAME: {
                    id: "custpage_fileid",
                    label: "FILE NAME",
                    type: "text",
                },
                LINE_NUMBER: {
                    id: "custpage_line",
                    label: "LINE NUMBER",
                    type: "INTEGER",
                },
                STATUS: {
                    id: "custpage_status",
                    label: "STATUS",
                    type: "text",
                },
                REMARKS: {
                    id: "custpage_remarks",
                    label: "REMARKS",
                    type: "textarea",
                },
                EXTERNAL_ID: {
                    id: "custpage_externalid",
                    label: "EXTERNAL ID",
                    type: "text",
                },
                TRANS_DATE: {
                    id: "custpage_trandate",
                    label: "TRANS DATE",
                    type: "text",
                },
                OTHER_REF: {
                    id: "custpage_otherrefnum",
                    label: "OTHER REF",
                    type: "text",
                },
                ITEM: {
                    id: "custpage_item",
                    label: "ITEM",
                    type: "text",
                },
                LOT_NUMBER: {
                    id: "custpage_lotnumber",
                    label: "LOT NUMBER",
                    type: "text",
                },
                QUANTITY: {
                    id: "custpage_quantity",
                    label: "QUANTITY",
                    type: "text",
                },
            }

            cashRefundFields = {
                FILE_NAME: {
                    id: "custpage_fileid",
                    label: "FILE NAME",
                    type: "text",
                },
                LINE_NUMBER: {
                    id: "custpage_line",
                    label: "LINE NUMBER",
                    type: "INTEGER",
                },
                STATUS: {
                    id: "custpage_status",
                    label: "STATUS",
                    type: "text",
                },
                REMARKS: {
                    id: "custpage_remarks",
                    label: "REMARKS",
                    type: "textarea",
                },
                ENTITY: {
                    id: "custpage_entity",
                    label: "ENTITY",
                    type: "text",
                },
                TRANS_DATE: {
                    id: "custpage_trandate",
                    label: "TRANS DATE",
                    type: "text",
                },
                OTHER_REF: {
                    id: "custpage_otherrefnum",
                    label: "OTHER REF",
                    type: "text",
                },
                ITEM: {
                    id: "custpage_item",
                    label: "ITEM",
                    type: "text",
                },
                LOT_NUMBER: {
                    id: "custpage_lotnumber",
                    label: "LOT NUMBER",
                    type: "text",
                },
                QUANTITY: {
                    id: "custpage_quantity",
                    label: "QUANTITY",
                    type: "text",
                },
            }

            return {
                cashSalesFields: cashSalesFields,
                cashRefundFields: cashRefundFields
            }
        }

        const searchFileId = (strFileName) => {
            log.debug('searchFileId strFileName', strFileName)

            let arrFileId = [];
            try {
                let objSearch = search.create({
                    type: 'file',
                    filters: [
                        ['name', 'is', `${strFileName}_logs.json`],
                        'AND',
                        ['folder', 'anyof', '3813'], // SuiteScripts > JEM > CSV_UPLOAD_CS_CR > File Logs
                    ],
                    columns: [
                        search.createColumn({ name: 'created', sort: search.Sort.DESC }),
                        search.createColumn({name: 'internalid'}),
                    ],
                });
                var searchResultCount = objSearch.runPaged().count;
                if (searchResultCount != 0) {
                    var pagedData = objSearch.runPaged({pageSize: 1000});
                    for (var i = 0; i < pagedData.pageRanges.length; i++) {
                        var currentPage = pagedData.fetch(i);
                        var pageData = currentPage.data;
                        if (pageData.length > 0) {
                            for (var pageResultIndex = 0; pageResultIndex < pageData.length; pageResultIndex++) {
                                arrFileId.push({
                                    dataCreated: pageData[pageResultIndex].getValue({ name: 'created', sort: search.Sort.DESC }),
                                    fileId: pageData[pageResultIndex].getValue({name: 'internalid'}),
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                log.error('searchFileId', err);
            }
            log.debug("searchFileId: arrFileId", arrFileId)
            return arrFileId;
        }
        

        return { onRequest };
    });

