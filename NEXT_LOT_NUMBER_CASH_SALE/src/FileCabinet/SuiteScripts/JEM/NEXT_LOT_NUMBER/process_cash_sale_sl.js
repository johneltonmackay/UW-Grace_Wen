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
                                let cashSale = record.create({
                                    type: record.Type.CASH_SALE,
                                    isDynamic: true
                                });

                                // Set main fields
                                cashSale.setValue({ fieldId: 'entity', value: data.entity });
                                cashSale.setValue({ fieldId: 'trandate', value: new Date(data.trandate) });
                                cashSale.setValue({ fieldId: 'currency', value: data.currency });
                                cashSale.setValue({ fieldId: 'externalid', value: data.externalid});
                                cashSale.setValue({ fieldId: 'location', value: data.isLotNumbered ? data.item_location : data.location });
                                cashSale.setValue({ fieldId: 'otherrefnum', value: data.otherrefnum });
                                cashSale.setValue({ fieldId: 'custbody_csv_cash_import_generated', value: true });

                                // Add inventory item details
                                cashSale.selectNewLine({ sublistId: 'item' });
                                cashSale.setCurrentSublistText({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    text: data.item
                                });
                                cashSale.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'quantity',
                                    value: parseFloat(data.quantity)
                                });
                                cashSale.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'rate',
                                    value: parseFloat(data.rate)
                                });

                                // Handle Lot Numbered Items
                                if (data.isLotNumbered) {
                                    var inventoryDetail = cashSale.getCurrentSublistSubrecord({
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

                                cashSale.commitLine({ sublistId: 'item' });

                                // Save the record
                                var cashSaleId = cashSale.save({
                                    enableSourcing: true,
                                    ignoreMandatoryFields: true
                                });

                                if (cashSaleId) {
                                    log.debug('Cash Sale Created', 'Cash Sale ID: ' + cashSaleId);
                                    arrProcessLogs.push({
                                        line: data.lineNumber,
                                        status: 'SUCCESS',
                                        recordid: cashSaleId,
                                        recType: 'cashsale',
                                        remarks: `Cash Sale Import Successful. Record ID: ${cashSaleId}`,
                                        data: data
                                    });
                                }
                            } catch (e) {
                                log.error('Error Processing Record', `Line: ${data.lineNumber}, Error: ${e.message}`);
                                arrProcessLogs.push({
                                    line: data.lineNumber,
                                    status: 'FAILED',
                                    remarks: `Cash Sale Import Failed. Error: ${e.message}`,
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
