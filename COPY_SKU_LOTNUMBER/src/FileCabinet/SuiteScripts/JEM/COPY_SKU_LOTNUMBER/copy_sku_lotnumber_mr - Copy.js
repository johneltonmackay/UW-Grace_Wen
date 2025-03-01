/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/file'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, file) => {

        const getInputData = (inputContext) => {
            let inventoryItemData = []
            let objRecord = null
            try {
                objRecord = record.load({
                    type: 'lotnumberedinventoryitem',
                    id: '7850',
                    isDynamic: true,
                });
                log.debug('objRecord', objRecord)

                let arrAddedField = ['cogsaccount', 'assetaccount', 'incomeaccount', 'tracklandedcost', 'isdropshipitem']


                // arrAddedField.forEach(fldId => {
                //     let fldValue = objRecord.getText({
                //         fieldId: fldId
                //     })
                //     objRecord.fields[fldId] = fldValue
                // });

                inventoryItemData.push(objRecord)

                let fileObj = file.create({
                    name: 'data_logs',
                    fileType: file.Type.JSON,
                    contents: JSON.stringify(objRecord)
                });
                fileObj.folder = 3799;
                logId = fileObj.save();

            } catch (error) {
                log.error('getInputData Error', error.message)
            }
            
            return inventoryItemData;
        }


        const map = (mapContext) => {
            log.debug('mapContext', mapContext)
            const inventoryItemData = JSON.parse(mapContext.value);
            log.debug('mapContext inventoryItemData', inventoryItemData)
            try {
                // Create an inventory item record.
                const inventoryItem = record.create({
                    type: 'inventoryitem',
                    isDynamic: true,
                });

                // Set subsidiary first
                inventoryItem.setValue({
                    fieldId: 'subsidiary',
                    value: 3 // HQ-New : 上海讴睿厨道国际贸易有限公司
                });


                inventoryItem.setValue({
                    fieldId: 'costcategory',
                    value: 1 // Default Cost Category
                });

                inventoryItem.setValue({
                    fieldId: 'taxschedule',
                    value: 1 // Non Taxable
                });

                if (inventoryItemData.fields.unitstype) {
                    inventoryItem.setValue({
                        fieldId: 'unitstype',
                        value: inventoryItemData.fields.unitstype
                    });
                }

                const replaceFirstLetter = (data, replacement) => {
                    return replacement + data.slice(1);
                };

                const replaceDescription = (data) => {
                    return data.replace(/[\(\)（）]/g, '-');
                };

                // const replaceDescription = (data) => {
                //     return 'A1' + data;
                // };
                // else if (fieldId == 'stockdescription' || fieldId == 'invt_salesdesc' || fieldId == 'salesdescription'|| fieldId == 'purchasedescription' || fieldId == 'displayname'){
                //     let strDesc = replaceDescription(formattedValue)
                //     log.debug('strDesc', strDesc)
                //     inventoryItem.setValue({
                //         fieldId: fieldId,
                //         value: strDesc
                //     });
                // } 
                
                let arrSkipFieldIds = [
                    'createddate', 'baseunit', 'lastmodifieddate', 'islotitem', 'subsidiary', 'preferredlocation',
                    'location', 'stockdescription', 'invt_salesdesc',
                    'salesdescription', 'purchasedescription'
                ]
                // Iterate over fields and set values
                for (let [fieldId, value] of Object.entries(inventoryItemData.fields)) {
                    if (value !== null && value !== '' && value !== "" && value !== undefined) {
                        let formattedValue = value === 'T' ? true : value === 'F' ? false : value;
                        if (!arrSkipFieldIds.includes(fieldId)){
                            if (fieldId == 'itemid'){
                                let strItemId = replaceFirstLetter(inventoryItemData.fields.itemid, "8")
                                log.debug('strItemId', strItemId)
                                inventoryItem.setValue({
                                    fieldId: 'itemid',
                                    value: strItemId
                                });
                            } else {
                                inventoryItem.setValue({
                                    fieldId,
                                    value: formattedValue
                                });
                            }
                        }
                    }
                }
                let arrSkipSubFieldIds = ['subsidiary', 'lastmodifieddate']
                let arrSkipSublistIds = ['recmachcustrecorditem_name_number']
                // Handle sublists
                for (const [sublistId, sublistData] of Object.entries(inventoryItemData.sublists)) {
                    for (const [lineId, lineData] of Object.entries(sublistData)) {
                        if (!arrSkipSublistIds.includes(sublistId)){
                            let intVendor = null
                            let blnSublistValid = true
                            log.debug('sublistId', sublistId)
                            log.debug('lineData', lineData)
                            if (sublistId == 'itemvendor'){
                                for (let [lineFieldId, lineValue] of Object.entries(lineData)) {
                                    if (lineFieldId == 'vendor'){
                                        intVendor = lineValue ? lineValue : null
                                    }
                                }
                            }
                            if (!intVendor){
                                blnSublistValid = false
                            }
                            if (blnSublistValid){
                                inventoryItem.selectNewLine({ sublistId });
                                for (let [lineFieldId, lineValue] of Object.entries(lineData)) {
                                    if (lineValue || lineValue >= 0) {
                                        const formattedLineValue = lineValue === 'T' ? true : lineValue === 'F' ? false : lineValue;
                                        if (!arrSkipSubFieldIds.includes(lineFieldId)){
                                            if (formattedLineValue | formattedLineValue >= 0){
                                                log.debug('lineFieldId', lineFieldId)
                                                log.debug('formattedLineValue', formattedLineValue)
                                                inventoryItem.setCurrentSublistValue({
                                                    sublistId,
                                                    fieldId: lineFieldId,
                                                    value: formattedLineValue
                                                });
                                            }
                                        }
                                    }
                                }
                                inventoryItem.commitLine({ sublistId });
                            }

                        }

                    }
                }

                // Save the record.
                const recordId = inventoryItem.save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                });
                log.debug('Record Created', `ID: ${recordId}`);

            } catch (e) {
                log.error('Error creating inventory item', e);
            }
        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {

        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {
            summaryContext.mapSummary.errors.iterator().each((key, error) => {
                log.error(`Error with Key: ${key}`, error);
                return true;
            });
        }

        return {getInputData, map, reduce, summarize}

    });
