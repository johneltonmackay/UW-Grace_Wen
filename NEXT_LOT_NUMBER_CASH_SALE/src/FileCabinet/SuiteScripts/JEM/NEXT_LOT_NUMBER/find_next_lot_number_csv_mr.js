/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/file', 'N/record', 'N/search', 'N/runtime', 'N/format', 'N/url', 'N/https', 'N/redirect'],
    /**
 * @param{file} file
 * @param{record} record
 * @param{search} search
 */
    (file, record, search, runtime, format, url, https, redirect) => {
  
        const getInputData = (inputContext) => {
            try {
                let validatedData = []

                let csvData = [];
                let emptyLines = [];
                let rawCSVRowdata = [];

                let invalidLines = {}; 
                let skippedLines = []; 
                let arrFilteredItems = []

                const stFileIdParam = runtime.getCurrentScript().getParameter({
                    name: 'custscript_file_name'
                });

                if (stFileIdParam){
                    let arrItem = findItem()
                    let arrFileId = searchFileId(stFileIdParam)
                    let intFileId = arrFileId[0].fileId
                    log.debug('getInputData intFileId', intFileId)
                    if (intFileId){
                        let fileObj = file.load({
                            id: intFileId
                        });
                    
                        let fileContent = fileObj.getContents();
                        let fileLines = fileContent.split('\n');
                        for (let i = 0; i < fileLines.length; i++) {

                            if (i != 0){
                                let line = fileLines[i].trim();

                                let columns = line.split(',');
                                log.debug('columns', columns)

                                if (columns.length == 7) {
                                    let rawLocation = columns[6].replace(/"/g, '')
                                    // log.debug('rawLocation', rawLocation)
                                    let intLocation = null
                                    if (rawLocation == 'Amazon.com'){
                                        intLocation = 3 //	FBA
                                    } else {
                                        intLocation = 5 // US Warehouse
                                    }
                                    let obj = {
                                        'lineNumber': i + 1,
                                        'fileId': stFileIdParam,
                                        'currency': 1,
                                        'entity': 5600, // Amazon Orii Kitchen USA
                                        'externalid': columns[0].replace(/"/g, ''),
                                        'trandate': stringToDate(columns[1].replace(/"/g, '')),
                                        'handlingmode': 'PROCESS',
                                        'location': intLocation,
                                        // 'memo': 'THIS IS TEST TRANSACTION - PLEASE IGNORE',
                                        'otherrefnum': columns[2].replace(/"/g, ''),
                                        'item': columns[3].replace(/"/g, ''),
                                        'quantity': columns[4].replace(/"/g, ''),
                                        'rate': columns[5].replace(/"/g, ''),
                                        'lotnumber': columns[6].replace(/"/g, ''),
                                        'lotquantity': columns[7].replace(/"/g, ''),
                                    };
                                    csvData.push(obj);
                                } else {
                                    invalidLines.fileId = stFileIdParam
                                    invalidLines.objColumns = columns

                                    skippedLines.push({
                                        line: i + 1,
                                        status: "SKIPPED",
                                        remarks: `Invalid Data: CSV File Columns be 34`,
                                        data: invalidLines
                                    })
                                }
                            }
                        }
                        // log.debug('getInputData fileContent', fileContent)
                        // log.debug('getInputData csvData', csvData)


                        csvData.forEach((data, i) => { 
                            let arrFilteredItem = arrItem.filter(item =>
                                item.item == data.item
                            );
                            // log.debug('arrFilteredItem', arrFilteredItem)

                            if (arrFilteredItem.length > 0){
                                    const arrFilteredLocation = arrFilteredItem.filter(item =>
                                        item.location == data.location
                                    );

                                    // log.debug('arrFilteredLocation', arrFilteredLocation)

                                    if (arrFilteredLocation.length > 0) {
                                        if (arrFilteredLocation[0].islotitem) {
                                            if (arrFilteredLocation[0].quantityavailable >= data.quantity){
                                                data.lotnumber = arrFilteredLocation[0].inventorynumber
                                                data.item_location = arrFilteredLocation[0].location
                                                data.quantityavailable = arrFilteredLocation[0].quantityavailable                   
                                                data.isLotNumbered = true
                                                validatedData.push(data)
                                            } else {
                                                skippedLines.push({
                                                    line: i + 1,
                                                    status: "SKIPPED",
                                                    remarks: `Not Enough Quantity Available for ${data.item}`,
                                                    data: data
                                                })
                                            }
                                        } else {
                                            data.isLotNumbered = false
                                            validatedData.push(data)
                                        }
                                    } else {
                                        let strLocation = null
                                        if (data.location == '3'){
                                            strLocation = 'FBA' 
                                        } else {
                                            strLocation = 'US Warehouse' // 
                                        }
                                        skippedLines.push({
                                            line: i + 1,
                                            status: "SKIPPED",
                                            remarks: `${strLocation} for Location Not Found for Item ${data.item}`,
                                            data: data
                                        })
                                    }
                            } else {
                                skippedLines.push({
                                    line: i + 1,
                                    status: "SKIPPED",
                                    remarks: `${data.item} Item Found Not Found`,
                                    data: data
                                })
                            }
                        });
                    }
                }

                let arrCashSaleId = checkDuplicates()

                validatedData.forEach(data => {
                    let hasDuplicates = false

                    const arrFilteredByIds = arrCashSaleId.filter(item =>
                        item.otherrefnum == data.otherrefnum || 
                        item.otherrefnum == data.externalid
                    );

                    if (arrFilteredByIds.length > 0){
                        hasDuplicates = true
                    } else {
                        hasDuplicates = false
                    }

                    if (!hasDuplicates) {
                        rawCSVRowdata.push(data)
                    } else {
                        skippedLines.push({
                            line: data.lineNumber,
                            status: 'FAILED',
                            remarks: `Order Id ${data.otherrefnum} is already used.`,
                            data: data
                        });
                    }
                });


                let inputData = {
                    fileId: stFileIdParam,
                    toProcess: rawCSVRowdata,
                    skippedLines: skippedLines,
                }

                arrFilteredItems.push(inputData)
                log.debug('getInputData arrFilteredItems', arrFilteredItems);

                // return [];  

                return arrFilteredItems;  
            } catch (error) {
                log.error('getInputData error', error.message)
            }      
        }
        

        const map = (mapContext) => {
            try {
                log.debug('map : mapContext', mapContext);
                let objMapValue = JSON.parse(mapContext.value)
                let arrToProcess = objMapValue.toProcess
                let arrSkippedLines = objMapValue.skippedLines;

                
                log.debug('File ID', objMapValue.fileId);

                let mapInput = {
                    toProcess: arrToProcess,
                    skippedLines: arrSkippedLines,
                }
        
                mapContext.write({
                    key: objMapValue.fileId,
                    value: mapInput
                });

            } catch (error) {
                log.error('map error', error.message)
            }
        }
        
        const reduce = (reduceContext) => {
            try {
                log.debug('reduce : reduceContext', reduceContext);
                let objReduceValues = JSON.parse(reduceContext.values[0])
                log.debug('reduce objReduceValues', objReduceValues);

                let arrToProcess = objReduceValues.toProcess
                let arrSkippedLines = objReduceValues.skippedLines

                let arrResults = [];
                    
                const CHUNK_SIZE = 15;

                log.debug('reduce arrToProcess.length', arrToProcess.length);

                if (arrToProcess.length > CHUNK_SIZE) {
                    let chunks = splitArrayIntoChunks(arrToProcess, CHUNK_SIZE);

                    for (let i = 0; i < chunks.length; i++) {
                        let chunk = chunks[i];

                        let fileId = createChunkFile(chunk, i)

                        if (fileId){
                            let slResponse = https.requestSuitelet({
                                scriptId: "customscript_process_cash_sale_sl",
                                deploymentId: "customdeploy_process_cash_sale_sl",
                                urlParams: {
                                    data: fileId
                                }
                            });
    
                            let parsedResponse = JSON.parse(slResponse.body);
                            log.debug('parsedResponse', parsedResponse);
    
                            if (parsedResponse.success) {
                                let parsedLogs = JSON.parse(parsedResponse.objLogs);
                                arrResults = [...arrResults, ...parsedLogs];
                                log.debug('Updated arrResults', arrResults);
                            }
                        }
                    }
                } else {
                    let fileId = createChunkFile(arrToProcess, 0)

                        if (fileId){
                            let slResponse = https.requestSuitelet({
                                scriptId: "customscript_process_cash_sale_sl",
                                deploymentId: "customdeploy_process_cash_sale_sl",
                                urlParams: {
                                    data: fileId
                                }
                            });
    
                            let parsedResponse = JSON.parse(slResponse.body);
                            log.debug('parsedResponse', parsedResponse);
    
                            if (parsedResponse.success) {
                                let parsedLogs = JSON.parse(parsedResponse.objLogs);
                                arrResults = [...arrResults, ...parsedLogs];
                                log.debug('Updated arrResults', arrResults);
                            }
                        }
                }

                arrResults = [...arrResults, ...arrSkippedLines];

                log.debug('Final Results', arrResults);


                if (arrResults.length > 0) {
                    createFileLogs(arrResults, reduceContext.key);
                }
            } catch (error) {
                log.error('reduce error', error.message);
            }
        };

        const summarize = (summaryContext) => {
          
        }

        //Private Function

        const createChunkFile = (arrLogs, index) => {
            let logId = null
            log.debug('createFileLogs arrLogs', arrLogs)
            try {
                let fileName = `paramChunkData_${index}.json`;
    
                let fileObj = file.create({
                    name: fileName,
                    fileType: file.Type.JSON,
                    contents: JSON.stringify(arrLogs)
                });
    
                fileObj.folder = 3815; // SuiteScripts > JEM > CSV_UPLOAD_CS_CR > File Logs > Parameter Chunk Data 2
    
                logId = fileObj.save();
                log.debug('createFileLogs logId', logId)
            } catch (error) {
                log.error('createFileLogs error', error.message)
            }
            return logId
        }

        const splitArrayIntoChunks = (array, chunkSize)  => { 
            let result = [];
            for (let i = 0; i < array.length; i += chunkSize) {
                result.push(array.slice(i, i + chunkSize));
            }
            return result;
        }

        const createFileLogs = (arrLogs, key) => {
            try {
                log.debug('createFileLogs arrLogs', arrLogs);
        
                let rawName = key || 'unknown_file'; // Get fileId safely
                let fileName = `${rawName}_logs.json`;
        
                // Sort log entries by lineNumber for better readability
                arrLogs.sort((a, b) => a.line - b.line);
        
                let fileObj = file.create({
                    name: fileName,
                    fileType: file.Type.JSON,
                    contents: JSON.stringify(arrLogs)
                });
        
                fileObj.folder = 3813; // SuiteScripts > JEM > CSV_UPLOAD_CS_CR > File Logs
                let logId = fileObj.save();
        
                log.debug('File Log Created', `Log ID: ${logId}, File Name: ${fileName}`);
                log.debug('File Content', JSON.stringify(arrLogs, null, 2));
            } catch (error) {
                log.error('createFileLogs error', error.message);
            }
        };

        const stringToDate = (date)  => {          
            return format.format({value: new Date(date), type: format.Type.DATETIME, timezone: format.Timezone.AMERICA_LOS_ANGELES}) 
        }

        const findItem = () => {
            let arrLotNumber = [];
              try {
                  let objSearch = search.create({
                      type: 'item',
                      filters:  [],
                      columns: [
                          search.createColumn({ name: 'internalid' }),
                          search.createColumn({ name: 'itemid' }),
                          search.createColumn({ name: 'type' }),
                          search.createColumn({ name: 'islotitem' }),
                          search.createColumn({ name: 'inventorynumber', join: 'inventorynumber' }),
                          search.createColumn({ name: 'location', join: 'inventorynumber' }),
                          search.createColumn({ name: 'quantityavailable', join: 'inventorynumber', sort: search.Sort.DESC }),
                      ]
                  });
                  
                  var searchResultCount = objSearch.runPaged().count;
                  if (searchResultCount != 0) {
                      var pagedData = objSearch.runPaged({pageSize: 1000});
                      for (var i = 0; i < pagedData.pageRanges.length; i++) {
                          var currentPage = pagedData.fetch(i);
                          var pageData = currentPage.data;
                          if (pageData.length > 0) {
                              for (var pageResultIndex = 0; pageResultIndex < pageData.length; pageResultIndex++) {
                                arrLotNumber.push({
                                      internalId: pageData[pageResultIndex].getValue({name: 'internalid'}),
                                      location: pageData[pageResultIndex].getValue({ name: 'location', join: 'inventorynumber' }),
                                      item: pageData[pageResultIndex].getValue({name: 'itemid'}),
                                      type: pageData[pageResultIndex].getValue({name: 'type'}),
                                      islotitem: pageData[pageResultIndex].getValue({name: 'islotitem'}),
                                      inventorynumber: pageData[pageResultIndex].getValue({ name: 'inventorynumber', join: 'inventorynumber' }),
                                      quantityavailable: pageData[pageResultIndex].getValue({name: 'quantityavailable', join: 'inventorynumber'}),
                                  });
                              }
                          }
                      }
                  }
              } catch (err) {
                  log.error('findItem', err.message);
              }
            //   log.debug("findItem arrLotNumber", arrLotNumber)
              return arrLotNumber;
        }

        const searchFileId = (strFileName) => {
            log.debug('searchFileId strFileName', strFileName)

            let arrFileId = [];
            try {
                let objSearch = search.create({
                    type: 'file',
                    filters: [
                        ['name', 'is', strFileName],
                        'AND',
                        ['folder', 'anyof', '3812'], // SuiteScripts > JEM > CSV_UPLOAD_CS_CR > UPLOADED_FILES
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

        const checkDuplicates = () => {
            let arrCashSaleId = [];
            try {
                let objSearch = search.create({
                    type: 'cashsale',
                    filters: [
                        ['type', 'anyof', 'CashSale'],
                        'AND',
                        ['mainline', 'is', 'T'],
                        'AND',
                        ['otherrefnum', 'isnotempty', ''],
                    ],
                    columns: [
                        search.createColumn({name: 'internalid'}),
                        search.createColumn({name: 'otherrefnum'}),
                        search.createColumn({name: 'externalid'}),
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
                                arrCashSaleId.push({
                                    internalid: pageData[pageResultIndex].getValue({ name: 'internalid', sort: search.Sort.DESC }),
                                    otherrefnum: pageData[pageResultIndex].getValue({name: 'otherrefnum'}),
                                    externalid: pageData[pageResultIndex].getValue({name: 'externalid'}),
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                log.error('checkDuplicates', err);
            }
            // log.debug("checkDuplicates: arrCashSaleId", arrCashSaleId)
            return arrCashSaleId;
        }


        return {getInputData, map, reduce, summarize}

    });




