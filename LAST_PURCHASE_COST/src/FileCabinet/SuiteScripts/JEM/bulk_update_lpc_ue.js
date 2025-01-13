/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/runtime'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, runtime) => {

        const afterSubmit = (scriptContext) => {
            // scriptContext.type == 'edit'
            log.debug('afterSubmit:', runtime.executionContext)
            if ( runtime.executionContext == runtime.ContextType.USEREVENT) {
                const newRecord = scriptContext.newRecord;
                let arrPOLinesValues = []; 
                let recType = newRecord.type
                let strId = newRecord.id
    
                const objCurrRec = record.load({
                    type: recType,
                    id: strId,
                    isDynamic: true
                })

                if (objCurrRec) {
                    let arrStatus = [
                        'Fully Billed',
                        'Partially Received',
                        'Pending Billing/Partially Received'
                    ]
                    let arrLineFieldIds = ['item', 'itemtype', 'rate'];
                    let strStatus = objCurrRec.getValue({
                        fieldId: 'status'
                    });
        
                    log.debug('afterSubmit strStatus', strStatus);
        
                    if (strStatus == 'Fully Billed' || arrStatus.includes(strStatus)) {
                        let intVendorId = objCurrRec.getValue({
                            fieldId: 'entity'
                        });

                        let intLineCount = objCurrRec.getLineCount({
                            sublistId: 'item'
                        });
        
                        log.debug('afterSubmit intLineCount', intLineCount);
        
        
                        for (let index = 0; index < intLineCount; index++) {
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
                                objLineValues.recId = strId
                                objLineValues.recType = objLineValues['itemtype']
                                objLineValues.itemTypeFound = false
                                objLineValues.isReprocess = false
                                arrPOLinesValues.push(objLineValues); 
                            }
                        }
        
                        log.debug('afterSubmit arrPOLinesValues', arrPOLinesValues);  

                        arrPOLinesValues.forEach(data => {
                            updateItemValues(data)
                        });
                    }
                }
  
            }
        };

        // Private Function

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

        return {afterSubmit}



    });
