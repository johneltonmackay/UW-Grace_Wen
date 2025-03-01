/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/ui/message', 'N/search', 'N/currentRecord', 'N/url', 'N/runtime', 'N/url', 'N/https', 'N/ui/dialog'],

    function (message, search, currentRecord, url, runtime, url, https, dialog,) {

        function pageInit(scriptContext) {
            try {
                console.log('Page Fully Loaded.');
                let urlParams = new URLSearchParams(window.location.search);
                let dataParam = urlParams.get('taskId');
                let strFileName = urlParams.get('strFileName');
                let strRecType = urlParams.get('recType');

                let strTaskId = dataParam;
                console.log('strTaskId', strTaskId);
                if (strTaskId) {
                    let myMsg = message.create({
                        title: 'Please Wait...',
                        message: 'Data Creation Started!',
                        type: message.Type.INFORMATION
                    });
                    myMsg.show({
                        duration: 5000 
                    });

                    setTimeout(function() {
                        checkScriptStatus(strTaskId, strFileName, strRecType);
                    }, 1000); // 1000 milliseconds = 1 second
                }
            } catch (error) {
                console.log('Error: pageInit', error.message);
            }
        }
        
        const searchScriptStatus = (mrIdValue) => {
            let isDone = true
            try {
                let objSearch = search.create({
                    type: 'scheduledscriptinstance',
                    filters:  [
                        ['taskid', 'startswith', mrIdValue],
                        'AND',
                        ['enddate', 'isempty', ''],
                    ],
                    columns: [
                        search.createColumn({ name: 'enddate' }),
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
                              let dtEndDate = pageData[pageResultIndex].getValue({name: 'enddate'})
                              console.log("searchScriptStatus dtEndDate", dtEndDate)
                              if (dtEndDate) {
                                isDone = false
                              }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('searchScriptStatus', err.message);
            }
            console.log("searchScriptStatus isDone", isDone)
            return isDone;
        }

        const checkScriptStatus = (mrIdValue, strFileName, strRecType) => {
            // Create a modal container
            const modal = document.createElement('div');
            modal.id = 'loadingModal';
            modal.style.position = 'fixed';
            modal.style.top = '50%';
            modal.style.left = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
            modal.style.padding = '20px';
            modal.style.backgroundColor = '#fff';
            modal.style.boxShadow = '0px 0px 10px rgba(0, 0, 0, 0.2)';
            modal.style.borderRadius = '8px';
            modal.style.width = '300px';
            modal.style.textAlign = 'center';
            modal.style.fontFamily = 'Arial, sans-serif';
    
            // Create title
            const title = document.createElement('h3');
            title.innerText = 'Processing...';
            modal.appendChild(title);
    
            // Create progress bar container
            const progressContainer = document.createElement('div');
            progressContainer.style.width = '100%';
            progressContainer.style.height = '10px';
            progressContainer.style.backgroundColor = '#ddd';
            progressContainer.style.borderRadius = '5px';
            progressContainer.style.marginTop = '10px';
            progressContainer.style.overflow = 'hidden';
    
            // Create progress bar
            const progressBar = document.createElement('div');
            progressBar.style.width = '0%';
            progressBar.style.height = '100%';
            progressBar.style.backgroundColor = '#4CAF50';
            progressBar.style.transition = 'width 0.8s linear';
            progressContainer.appendChild(progressBar);
    
            modal.appendChild(progressContainer);
            document.body.appendChild(modal);
    
            let progress = 0;
    
            const updateProgressBar = () => {
                progress = Math.min(progress + 10, 100);
                progressBar.style.width = `${progress}%`;
            };
    
            const pollStatus = () => {
                const isDone = searchScriptStatus(mrIdValue);
    
                if (!isDone) {
                    updateProgressBar();
                    setTimeout(pollStatus, 1000); // Retry every 1 second
                } else {
                    // Ensure progress bar reaches 100% before closing
                    progressBar.style.width = '100%';
    
                    setTimeout(() => {
                        // Remove modal
                        document.body.removeChild(modal);
    
                        // Show NetSuite standard pop-up dialog
                        dialog.create({
                            title: "Success",
                            message: "The process has been completed successfully.",
                            buttons: [{ label: "OK", value: true }]
                        }).then(() => {
                            // Redirect after user clicks "OK"
                            window.location.href = `/app/site/hosting/scriptlet.nl?script=709&deploy=1&isDone=True&strFileName=${encodeURIComponent(strFileName)}&recType=${encodeURIComponent(strRecType)}`;
                        });
                    }, 800); // Delay for a smooth transition
                }
            };
    
            // Start polling process
            pollStatus();
        };
        
        
        
        
        const refreshPage = () => {
            try {          
                var sURL = url.resolveScript({
                    scriptId : 'customscript_upload_csv_sl',
                    deploymentId : 'customdeploy_upload_csv_sl',
                    returnExternalUrl : false,
                });
            
                window.onbeforeunload = null;
                window.location = sURL;
            } catch (error) {
                console.log('Error: refreshPage', error.message)
            }
        }

        return {
            pageInit: pageInit,
            refreshPage: refreshPage,
        };

    });
