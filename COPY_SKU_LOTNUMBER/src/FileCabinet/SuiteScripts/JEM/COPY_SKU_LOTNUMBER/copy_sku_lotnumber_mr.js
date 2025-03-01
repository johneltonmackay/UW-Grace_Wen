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
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            let inventoryItemData = []
            let objRecord = null
            let arrRecIds = [7850,
                7851,
                7852,
                7853,
                7854,
                7855,
                7856,
                7857,
                7858,
                7859,
                7860,
                7861,
                7862,
                7863,
                7864,
                7865,
                7866,
                7867,
                7868,
                7869,
                7870,
                7871,
                7872,
                7873,
                7874,
                7875,
                7876,
                7877,
                7878,
                7879,
                7880,
                7881,
                7882,
                7883,
                7884,
                7885,
                7886,
                7887,
                7888,
                7889,
                7890,
                7892,
                7892,
                7893,
                7894,
                10077,
                10078,
                10354,
                10355,
                10356,
                10357,
                10358,
                10359,
                10360,
                10361,
                10362,
                10381,
                10382,
                10383,
                10384,
                10385,
                10386,
                10387,
                10388,
                10389,
                10390,
                10391,
                10392,
                10393,
                10413,
                10422,
                10423,
                10424,
                10425,
                10426,
                10427,
                10496,
                10497,
                10498,
                10499,
                10500,
                10501,
                10502,
                10503,
                10512,
                10513,
                10514,
                10516,
                10532,
                10533,
                10535,
                10539,
                10540,
            ]
            try {
                arrRecIds.forEach(recId => {
                    objRecord = record.load({
                        type: 'lotnumberedinventoryitem',
                        id: recId,
                        isDynamic: false,
                    });
                    inventoryItemData.push(objRecord)
                });
               
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

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

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

                let arrSkipFieldIds = [
                    // "costingmethoddisplay",
                    // "custitem_sl_item_ygdj",
                    // "autoleadtime",
                    // "custitem_tn_item_expirationqtydate",
                    // "_eml_nkey_",
                    // "costcategory",
                    // "billqtyvarianceacct",
                    // "purchaseconversionrate",
                    // "invt_salesdesc",
                    // "lastpurchaseprice",
                    // "price3header",
                    // "pricingchange",
                    "stockdescription",
                    "cogsaccount",
                    // "unitswarningdisplayed",
                    // "price1headercount",
                    // "consumptionconversionrate",
                    // "totalquantityonhand",
                    // "costestimatetype",
                    "purchaseunit",
                    // "futurehorizon",
                    // "price4headercount",
                    // "subsidiary",
                    // "price5quantity1",
                    "custitem_tn_item_itemname",
                    // "handlingcostunits",
                    "saleunit",
                    "stockunit",
                    // "price5header",
                    // "froogleproductfeed",
                    // "billexchratevarianceacct",
                    "incomeaccount",
                    // "supplyreplenishmentmethod",
                    "currency",
                    // "price5headercount",
                    // "consumptionunit",
                    "invt_dispname",
                    // "seasonaldemand",
                    // "shippingcostunits",
                    // "unitstypewarningdisplayed",
                    // "custitem_last_po_reference",
                    // "custitem_po_vendor_id",
                    // "bassemblychild",
                    // "shipindividually",
                    // "customform",
                    // "price2quantity1",
                    // "minimumquantityunits",
                    "displayname",
                    "isdropshipitem",
                    // "custitem_sps_item_synch",
                    // "custitem_atlas_approved",
                    // "isonline",
                    // "price3quantity1",
                    // "totalquantityonhandunits",
                    // "autoreorderpoint",
                    // "accchange",
                    // "totalvalue",
                    // "costestimateunits",
                    "salesdescription",
                    // "price4quantity1",
                    // "origexchangerate",
                    // "price4header",
                    "taxschedule",
                    // "includechildren",
                    // "internalid",
                    // "price3headercount",
                    // "custitem5",
                    // "custitem4",
                    // "vendreturnvarianceaccount",
                    // "matchbilltoreceipt",
                    // "usemarginalrates",
                    // "isinactive",
                    // "origcostunits",
                    // "price2headercount",
                    "purchasedescription",
                    // "roundupascomponent",
                    "intercoincomeaccount",
                    "exchangerate",
                    // "purchasepricevarianceacct",
                    // "maximumquantityunits",
                    // "custitem_aeid",
                    // "custitem_po_last_purchase_cost",
                    // "price1matrixfields",
                    // "lastpurchasepriceunits",
                    // "offersupport",
                    // "price2matrixfields",
                    // "price1header",
                    // "custitem_comm_item",
                    "assetaccount",
                    // "price4matrixfields",
                    // "price5matrixfields",
                    // "unitstype",
                    // "price3matrixfields",
                    "costunits",
                    // "price1quantity1",
                    "tracklandedcost",
                    // "copydescription",
                    // "excludefromsitemap",
                    // "autopreferredstocklevel",
                    // "costingmethod",
                    // "weightunits",
                    // "quantityreorderunits",
                    // "isgcocompliant",
                    "averagecostunits",
                    "averagecost",
                    // "billpricevarianceacct",
                    // "saleconversionrate",
                    // "isspecialorderitem",
                    // "location",
                    // "transferpriceunits",
                    // "haschildren",
                    // "vendormapchange",
                    // "price2header",
                    // "stockconversionrate",
                    "itemid",
                    "upccode",
                    "custitem_duplicated_sku"
                  ];
                  
                
                // let arrSkipFieldIds = [
                //     'createddate', 'baseunit', 'lastmodifieddate', 'islotitem', 'subsidiary', 'preferredlocation', 'location',
                //     'stockconversionrate', 'upccode', 'baserecordtype', 'id'
                //     //  'stockdescription', 'invt_salesdesc', 'salesdescription', 'purchasedescription'
                //     ]
                // Iterate over fields and set values
                for (const [fieldId, value] of Object.entries(inventoryItemData.fields)) {
                    if (value !== null && value !== '' && value !== "" && value !== undefined) {
                        const formattedValue = value == 'T' ? true : value == 'F' ? false : value;
                        if (arrSkipFieldIds.includes(fieldId)){
                            try {
                                if (fieldId == 'itemid' || fieldId == 'custitem_tn_item_itemname'){
                                    log.debug('IF fieldId', fieldId)
                                    let strItemId = replaceFirstLetter(inventoryItemData.fields.itemid, "7")
                                    // log.debug('strItemId', strItemId)
                                    inventoryItem.setValue({
                                        fieldId: 'itemid',
                                        value: strItemId
                                    });
                                } else if (fieldId == 'stockdescription' || fieldId == 'invt_salesdesc' || fieldId == 'salesdescription'|| fieldId == 'purchasedescription' || fieldId == 'displayname'){
                                    log.debug('ELSE IF fieldId', fieldId)
                                    let strDesc = replaceDescription(formattedValue)
                                    // log.debug('strDesc', strDesc)
                                    inventoryItem.setValue({
                                        fieldId: fieldId,
                                        value: strDesc
                                    });
                                }
                                else if (fieldId == 'custitem_duplicated_sku'){
                                    // log.debug('ELSE IF fieldId', fieldId)
                                    inventoryItem.setValue({
                                        fieldId: fieldId,
                                        value: true
                                    });
                                } 
                                else {
                                    log.debug('ELSE fieldId', fieldId)
                                    inventoryItem.setValue({
                                        fieldId,
                                        value: formattedValue
                                    });
                                }
                            } catch (error) {
                                log.error('Field Error', error.message)
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
                            // log.debug('sublistId', sublistId)
                            // log.debug('lineData', lineData)
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
                                                // log.debug('lineFieldId', lineFieldId)
                                                // log.debug('formattedLineValue', formattedLineValue)
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
