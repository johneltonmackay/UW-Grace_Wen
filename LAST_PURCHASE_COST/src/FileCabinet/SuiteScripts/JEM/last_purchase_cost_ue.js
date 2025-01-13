/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search) => {

        const afterSubmit = (scriptContext) => {
            const newRecord = scriptContext.newRecord;
            let recType = newRecord.type
            let strId = newRecord.id
            log.debug('afterSubmit recType', recType)
            try {
                if (scriptContext.type == 'create'){
                    const objCurrRec = record.load({
                        type: recType,
                        id: strId,
                        isDynamic: true
                    })
    
                    if (objCurrRec) {
                        let paramData = {
                            data: objCurrRec,
                            type: recType,
                            id: strId,
                            scriptContext: scriptContext
                        }
                        log.debug('afterSubmit paramData', paramData)
                        processData(paramData)
                    }
                }
            } catch (error) {
                log.error('afterSubmit error', error.message);
            }
        };

        // Private Function
        const processData = (paramData) => {
            try {
                let arrPOLinesValues = []
                let objCurrRec = paramData.data
                let strId = paramData.id
                let recType = paramData.type
                let objContext = paramData.scriptContext

                let strStatus = null
                let arrStatus = [
                    'Fully Billed',
                    'Partially Received',
                    'Pending Billing/Partially Received'
                ]
                let arrLineFieldIds = ['item', 'itemtype', 'rate'];

                let intVendorId = objCurrRec.getValue({
                    fieldId: 'entity'
                });

                let intLineCount = objCurrRec.getLineCount({
                    sublistId: 'item'
                });

                log.debug('afterSubmit intLineCount', intLineCount);

                let arrPO = getPOStatus()
                for (let index = 0; index < intLineCount; index++) {


                    let strPOId = objCurrRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'orderdoc',
                        line: index
                    });

                    if (strPOId){
                        const arrFilteredByID = arrPO.filter(item => parseInt(item.internalId) === parseInt(strPOId));

                        log.debug("afterSubmit arrFilteredByID", arrFilteredByID)

                        if (arrFilteredByID.length == 1) {
                            strStatus = arrFilteredByID[0].status
                        }
                    }

                    let objLogs = {
                        recordPOId: strPOId,
                        recordPOStatus: strStatus,
                        recordId: strId,
                        recordType: recType,
                        context: objContext.type
                    }
                    log.debug('afterSubmit objLogs', objLogs);

                               
                    if (strStatus == 'Fully Billed' || arrStatus.includes(strStatus)) {
                        let objLineValues = {};  

                        arrLineFieldIds.forEach(fieldId => {
                            let fieldValue = objCurrRec.getSublistValue({
                                sublistId: 'item',
                                fieldId: fieldId,
                                line: index
                            });
    
                            objLineValues[fieldId] = fieldValue;  
                        });
                                            
                        if (objLineValues['itemtype'] === 'Assembly' || objLineValues['itemtype'] === 'InvtPart') {
                            objLineValues.vendorId = intVendorId
                            objLineValues.recId = strPOId
                            objLineValues.recType = objLineValues['itemtype']
                            objLineValues.itemTypeFound = false
                            objLineValues.isReprocess = false
                            arrPOLinesValues.push(objLineValues); 
                        }
                    }
                }

                log.debug('afterSubmit arrPOLinesValues', arrPOLinesValues);  

                arrPOLinesValues.forEach(data => {
                    log.debug('arrPOLinesValues data', data);  
                    updateItemValues(data)
                });
            } catch (error) {
                log.error('processData Update Failed ', error.message)
            }
        }


        const updateItemValues = (data) => {
            try {
                log.debug('updateItemValues data', data)
                var submitFieldsId = record.submitFields({
                    type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                    id: data.item,
                    values: {
                        custitem_po_last_purchase_cost: data.rate,
                        custitem_po_vendor_id: data.vendorId,
                        custitem_last_po_reference: data.recId
                    },
                    options: {
                        enablesourcing: true,
                        ignoreMandatoryFields: true
                    }
                });
                log.debug({
                    title: 'Record updated',
                    details: 'Id of updated record: ' + submitFieldsId
                });
            } catch (error) {
                let objLogs = {
                    data: data,
                    error:  error.message
                }
                
                let newObjData = reprocessItemValues(objLogs)
                if (newObjData){
                    updateNewItemValues(newObjData)
                }
               
            }
        }

        const updateNewItemValues = (newObjData) => {
            try {
                log.debug('updateNewItemValues newObjData', newObjData)
                var submitFieldsId = record.submitFields({
                    type: newObjData.data.recType,
                    id: newObjData.data.item,
                    values: {
                        custitem_po_last_purchase_cost: newObjData.data.rate,
                        custitem_po_vendor_id: newObjData.data.vendorId,
                        custitem_last_po_reference: newObjData.data.recId
                    },
                    options: {
                        enablesourcing: true,
                        ignoreMandatoryFields: true
                    }
                });
                log.debug({
                    title: 'Record updated',
                    details: 'updateNewItemValues Id of updated record: ' + submitFieldsId
                });  
            } catch (error) {
                let objLogs = {
                    data: newObjData,
                    error:  error.message
                }
                log.error('updateNewItemValues Update Failed ', objLogs)
            }

        }

        const reprocessItemValues = (objLogs) => {

            let newObjData = null

            const errorMessage = objLogs.error;

            // Function to extract the value after a specific phrase
            function extractValueAfter(phrase, text) {
                const index = text.indexOf(phrase);
                if (index !== -1) {
                    // Get the substring after the phrase and split by spaces
                    const afterPhrase = text.substring(index + phrase.length).trim();
                    // Return the first word (until a space or punctuation is encountered)
                    const firstWord = afterPhrase.split(/[ ,.!?]/)[0].trim();
                    return firstWord;
                }
                return null;
            }

            // Extract the values after "different type:" and "specified:"
            const differentTypeValue = extractValueAfter('different type:', errorMessage);
            const specifiedTypeValue = extractValueAfter('specified:', errorMessage);

            objLogs.data.recType = differentTypeValue;
            objLogs.data.itemTypeFound = true;
            objLogs.data.isReprocess = true;

            log.debug('reprocessItemValues objLogs', objLogs)
            newObjData = objLogs

            return newObjData
        }

        const getPOStatus = () => {
            let arrPO = [];
            try {
                let objPOSearch = search.create({
                    type: 'purchaseorder',
                    filters: [
                        ['type', 'anyof', 'PurchOrd'],
                        'AND',
                        ['status', 'anyof', 'PurchOrd:G', 'PurchOrd:D', 'PurchOrd:E'], 
                        'AND',
                        ['mainline', 'is', 'T'],                   
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'statusref' }),
                    ]
                });
                
                var searchResultCount = objPOSearch.runPaged().count;
                if (searchResultCount != 0) {
                    var pagedData = objPOSearch.runPaged({pageSize: 1000});
                    for (var i = 0; i < pagedData.pageRanges.length; i++) {
                        var currentPage = pagedData.fetch(i);
                        var pageData = currentPage.data;
                        if (pageData.length > 0) {
                            for (var pageResultIndex = 0; pageResultIndex < pageData.length; pageResultIndex++) {
                                arrPO.push({
                                    internalId: pageData[pageResultIndex].getValue({name: 'internalid'}),
                                    status: pageData[pageResultIndex].getText({ name: 'statusref' }),
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                log.error('getPOStatus', err.message);
            }
            // log.debug("getPOStatus", arrPO)

            return arrPO;
        };

        return {afterSubmit}



    });
