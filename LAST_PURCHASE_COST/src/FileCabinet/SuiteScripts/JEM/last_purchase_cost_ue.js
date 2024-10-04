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
            const objNewRecord = scriptContext.newRecord;
            const recordId = objNewRecord.id;
            let arrPOLinesValues = []; 

            try {
                if (recordId) {
                    let arrLineFieldIds = ['item', 'itemtype', 'rate'];
                    let strStatus = objNewRecord.getValue({
                        fieldId: 'status'
                    });
        
                    log.debug('afterSubmit strStatus', strStatus);
        
                    if (strStatus == 'Fully Billed') {
                        let intVendorId = objNewRecord.getValue({
                            fieldId: 'entity'
                        });

                        let intLineCount = objNewRecord.getLineCount({
                            sublistId: 'item'
                        });
        
                        log.debug('afterSubmit intLineCount', intLineCount);
        
        
                        for (let index = 0; index < intLineCount; index++) {
                            let objLineValues = {};  
        
                            arrLineFieldIds.forEach(fieldId => {
                                let fieldValue = objNewRecord.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: fieldId,
                                    line: index
                                });
        
                                objLineValues[fieldId] = fieldValue;  
                            });
                                                
                            if (objLineValues['itemtype'] === 'Assembly' || objLineValues['itemtype'] === 'InvtPart') {
                                objLineValues.vendorId = intVendorId
                                objLineValues.recId = recordId
                                objLineValues.recType = objLineValues['itemtype'] === 'Assembly' 
                                    ? 'lotnumberedassemblyitem'     
                                    : 'lotnumberedinventoryitem'
                                arrPOLinesValues.push(objLineValues); 
                            }
                        }
        
                        log.debug('afterSubmit arrPOLinesValues', arrPOLinesValues);  

                        arrPOLinesValues.forEach(data => {
                            updateItemValues(data)
                        });
                    }
                }
            } catch (error) {
                log.error('afterSubmit error', error.message);
            }
        };

        // Private Function

        const updateItemValues = (data) => {
            var submitFieldsPromise = record.submitFields.promise({
                type: data.recType,
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
        
            submitFieldsPromise.then(function(recordId) {
                log.debug({
                    title: 'Record updated',
                    details: 'Id of updated record: ' + recordId
                });
        
            }, function(e) {
                log.error({
                    title: e.name,
                    details: e.message
                });
            });
        }

        return {afterSubmit}



    });
