/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/file'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, runtime, file) => {

        const beforeLoad = (scriptContext) => {
            const executionContext = runtime.executionContext;
            if (executionContext === runtime.ContextType.CSV_IMPORT){
                try {
                    createFileLogs(scriptContext, 'beforeLoad')

                    let arrAvailableLot = []
                    log.debug('executionContext', executionContext)

                    
                        const newRecord = scriptContext.newRecord;
                        const intLocation = newRecord.getValue({fieldId: 'location'})
                        log.debug('intLocation', intLocation)

                        const lineCount = newRecord.getLineCount({ sublistId: 'item' });

                        for (let i = 0; i < lineCount; i++) {
                            const itemId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                            // const lotNumber = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'inventorydetail', line: i });
                            log.debug('itemId', itemId)
                            // log.debug('lotNumber', lotNumber)

                            // // isLotDepleted(lotNumber)
                            arrAvailableLot = findNextAvailableLot(itemId, intLocation)

                            if (arrAvailableLot.length > 0) {
                                newRecord.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'inventorydetail',
                                    line: i,
                                    value: arrAvailableLot[0].internalId
                                });
                            }
                        }

                } catch (error) {
                    log.error('beforeLoad', error.message)
                }
            }
        }

        const beforeSubmit = (scriptContext) => {
            const executionContext = runtime.executionContext;
            if (executionContext === runtime.ContextType.CSV_IMPORT){
                try {
                    createFileLogs(scriptContext, 'beforeSubmit')
                } catch (error) {
                    log.error('beforeSubmit', error.message)
                }
            }
        }

        const afterSubmit = (scriptContext) => {
            const executionContext = runtime.executionContext;
            if (executionContext === runtime.ContextType.CSV_IMPORT){
                try {
                    createFileLogs(scriptContext, 'afterSubmit')
                } catch (error) {
                    log.error('afterSubmit', error.message)
                }
            }
        }

        const findNextAvailableLot = (itemId, intLocation) => {
            let arrLotNumber = [];
              try {
                  let objSearch = search.create({
                      type: 'inventorynumber',
                      filters:  [
                        ['item.internalid', 'anyof', itemId],
                        // 'AND',
                        // ['location', 'anyof', intLocation],
                        'AND',
                        ['quantityavailable', 'greaterthanorequalto', '1'],
                    ],
                      columns: [
                          search.createColumn({ name: 'internalid' }),
                          search.createColumn({ name: 'quantityonhand' }),
                          search.createColumn({ name: 'location' }),
                          search.createColumn({ name: 'item' }),
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
                                      quantityonhand: pageData[pageResultIndex].getValue({name: 'quantityonhand'}),
                                      location: pageData[pageResultIndex].getText({name: 'location'}),
                                      item: pageData[pageResultIndex].getValue({name: 'item'}),

                                  });
                              }
                          }
                      }
                  }
              } catch (err) {
                  log.error('findNextAvailableLot', err.message);
              }
              log.debug("findNextAvailableLot arrLotNumber", arrLotNumber)
              return arrLotNumber;
        }

        const createFileLogs = (arrLogs, index) => {
            let logId = null
            log.debug('createFileLogs arrLogs', arrLogs)
            try {
                let fileName = `fileLogs_${index}.json`;
    
                let fileObj = file.create({
                    name: fileName,
                    fileType: file.Type.JSON,
                    contents: JSON.stringify(arrLogs)
                });
    
                fileObj.folder = 3801; 
    
                logId = fileObj.save();
                log.debug('createFileLogs logId', logId)
            } catch (error) {
                log.error('createFileLogs error', error.message)
            }
            return logId
        }
    

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
