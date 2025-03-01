/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/record', 'N/file'],
    (log, record, file) => {

        const CONTEXT_METHOD = {
            GET: "GET",
            POST: "POST"
        };

        const onRequest = (scriptContext) => {
            if (scriptContext.request.method === CONTEXT_METHOD.GET) {
                try {
                    let scriptObj = scriptContext.request.parameters;
                    log.debug('GET onRequest scriptObj', scriptObj);

                    let arrProcessLogs = [];

                    if (scriptObj.data) {

                        let fileObj = file.load({
                            id: scriptObj.data
                        });
                    
                        let fileContent = fileObj.getContents();
                        let arrParam = JSON.parse(fileContent)

                        log.debug('arrParam', arrParam);


                        // Process each record in the array
                        arrParam.forEach((data, i) => {
                            try {
                                var cashRefund = record.create({
                                    type: record.Type.CASH_REFUND,
                                    isDynamic: true
                                });

                                // Set main fields
                                cashRefund.setValue({ fieldId: 'entity', value: data.customerId });
                                cashRefund.setValue({ fieldId: 'trandate', value: new Date(data.trandate) });
                                cashRefund.setValue({ fieldId: 'location', value: data.isLotNumbered ? data.item_location : data.location });
                                cashRefund.setValue({ fieldId: 'memo', value: data.memo });
                                cashRefund.setValue({ fieldId: 'otherrefnum', value: data.otherrefnum });
                                cashRefund.setValue({ fieldId: 'account', value: data.account });
                                cashRefund.setValue({ fieldId: 'custbody_csv_cash_import_generated', value: true });

                                // Add inventory item details
                                cashRefund.selectNewLine({ sublistId: 'item' });
                                cashRefund.setCurrentSublistText({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    text: data.item
                                });
                                cashRefund.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'quantity',
                                    value: parseFloat(data.quantity)
                                });
                                cashRefund.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'amount',
                                    value: Math.abs(parseFloat(data.amount))
                                });

                                // Handle Lot Numbered Items
                                if (data.isLotNumbered) {
                                    var inventoryDetail = cashRefund.getCurrentSublistSubrecord({
                                        sublistId: 'item',
                                        fieldId: 'inventorydetail'
                                    });

                                    inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
                                    inventoryDetail.setCurrentSublistText({
                                        sublistId: 'inventoryassignment',
                                        fieldId: 'receiptinventorynumber',
                                        text: data.lotnumber
                                    });
                                    inventoryDetail.setCurrentSublistValue({
                                        sublistId: 'inventoryassignment',
                                        fieldId: 'quantity',
                                        value: parseFloat(data.quantity)
                                    });
                                    inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
                                }

                                cashRefund.commitLine({ sublistId: 'item' });

                                // Save the record
                                var cashRefundId = cashRefund.save({
                                    enableSourcing: true,
                                    ignoreMandatoryFields: true
                                });

                                if (cashRefundId) {
                                    log.debug('Cash Refund Created', 'Cash Refund ID: ' + cashRefundId);
                                    arrProcessLogs.push({
                                        line: data.lineNumber,
                                        status: 'SUCCESS',
                                        recordid: cashRefundId,
                                        recType: 'cashrefund',
                                        remarks: `Cash Refund Import Successful. Record ID: ${cashRefundId}`,
                                        data: data
                                    });
                                }
                            } catch (e) {
                                log.error('Error Processing Record', `Line: ${data.lineNumber}, Error: ${e.message}`);
                                arrProcessLogs.push({
                                    line: data.lineNumber,
                                    status: 'FAILED',
                                    remarks: `Cash Refund Import Failed. Error: ${e.message}`,
                                    data: data
                                });
                            }
                        });
                    }

                    scriptContext.response.write({
                        output: JSON.stringify({
                            success: true,
                            message: 'Processing Complete',
                            objLogs: JSON.stringify(arrProcessLogs)
                        })
                    });

                } catch (e) {
                    log.error('Error Processing Request', e.message);
                    scriptContext.response.write({
                        output: JSON.stringify({
                            success: false,
                            message: 'Error processing request: ' + e.message
                        })
                    });
                }
            }
        };

        return { onRequest };
    });
