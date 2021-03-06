﻿define(['./configuration/xApiSettings', './base64', './errorsHandler'],
    function (xApiSettings, base64, errorsHandler) {

        var states = {
            notInitialized: 0,
            initialized: 1,
            initializationFailed: 2
        };

        var state = states.notInitialized;

        var eventManager = {
            init: init,
            sendStatement: sendStatement
        };
        return eventManager;

        function init() {
            var dfd = Q.defer();
            switch (state) {
                case states.notInitialized:
                    var initPromise = Q.fcall(function () {
                        try {
                            initXDomainRequestTransport();
                            state = states.initialized;
                        } catch (e) {
                            state = states.initializationFailed;
                            throw e;
                        };
                    });

                    dfd.resolve(initPromise);
                    break;
                case states.initialized:
                    dfd.resolve();
                    break;
                case states.initializationFailed:
                    dfd.reject();
                    break;
            }

            return dfd.promise;
        }

        function sendStatement(statement, uri, username, password) {
            var dfd = Q.defer();

            var requestOptions = createRequestOptions(statement, uri, username, password);

            if (!$.support.cors) {
                requestOptions = getOptionsForIEMode(requestOptions);
            }

            $.ajax(requestOptions).done(function () {
                dfd.resolve();
            })
            .fail(function (request, textStatus, error) {
                dfd.reject(getErrorMessage(request, textStatus, error));
            });


            return dfd.promise;
        }

        function initXDomainRequestTransport() {
            if (window.XDomainRequest) {
                jQuery.ajaxTransport(function (s) {

                    var xdr;

                    return {

                        send: function (headers, complete) {

                            function callback(status, statusText, responses, responseHeaders) {
                                xdr.onload = xdr.onerror = xdr.ontimeout = jQuery.noop;
                                xdr = undefined;
                                complete(status, statusText, responses, responseHeaders);
                            }

                            xdr = new window.XDomainRequest();

                            xdr.onload = function () {
                                callback(200, "OK", { text: xdr.responseText });
                            };

                            xdr.onerror = function () {
                                callback(-1, errorsHandler.errors.xDomainRequestError);
                            };

                            if (s.timeout) {
                                xdr.timeout = s.timeout;
                                xdr.ontimeout = function () {
                                    callback(-1, errorsHandler.errors.timeoutError);
                                };
                            }

                            try {
                                xdr.open(s.type, s.url, true);
                            }
                            catch (e) {
                                var errorMessage;

                                if (location.protocol != s.url.split("/")[0]) {
                                    errorMessage = errorsHandler.errors.invalidProtocol;
                                } else {
                                    errorMessage = e.message;
                                }

                                callback(-1, errorMessage);
                                return;
                            }

                            xdr.send((s.hasContent && s.data) || null);
                        },

                        abort: function () {
                            if (xdr) {
                                xdr.onerror = jQuery.noop();
                                xdr.abort();
                            }
                        }
                    };

                });
            }
        }

        function getOptionsForIEMode(options) {
            var newUrl = options.url;

            //Everything that was on query string goes into form vars
            var formData = new Array();
            var qsIndex = newUrl.indexOf('?');
            if (qsIndex > 0) {
                formData.push(newUrl.substr(qsIndex + 1));
                newUrl = newUrl.substr(0, qsIndex);
            }

            //Method has to go on querystring, and nothing else
            options.url = newUrl + '?method=' + options.type;

            //Headers
            if (!_.isUndefined(options.headers) && _.isArray(options.headers)) {
                for (var headerName in options.headers) {
                    formData.push(headerName + "=" + encodeURIComponent(options.headers[headerName]));
                }
            }

            options.headers = {};

            //The original data is repackaged as "content" form var
            if (!_.isUndefined(options.data)) {
                formData.push('content=' + encodeURIComponent(options.data));
            }

            options.data = formData.join("&");
            options.type = "POST";

            return options;
        }

        function createRequestOptions(statement, url, userName, password) {
            var headers = [];
            headers["X-Experience-API-Version"] = xApiSettings.xApiVersion;
            headers["Content-Type"] = "application/json";
            var auth = "Basic " + base64.encode(userName + ':' + password);
            headers["Authorization"] = auth;

            var options = {};

            options.url = url;
            options.data = JSON.stringify(statement);
            options.type = 'POST';
            options.headers = headers;
            options.timeout = xApiSettings.timeout;
            options.contentType = 'application/json';
            options.async = true;

            options.beforeSend = function (xmlHttpRequest) {
                if (!_.isUndefined(options.headers) && _.isArray(options.headers)) {
                    for (var headerName in options.headers)
                        xmlHttpRequest.setRequestHeader(headerName, options.headers[headerName]);
                }
                options.headers = null;
            };

            return options;
        }

        function getErrorMessage(request, textStatus, error) {
            switch (request.status) {
                case 0:
                    error = errorsHandler.errors.invalidEndpoint;
                    break;
                case 400:
                    if (request.responseText.indexOf("Mbox") !== -1) {
                        error = errorsHandler.errors.invalidEmail;
                    } else if (request.responseText.indexOf("URL") !== -1 || request.responseText.indexOf("endpoint") !== -1) {
                        error = errorsHandler.errors.invalidEndpoint;
                    } else {
                        error = errorsHandler.errors.badRequest + request.responseText;
                    }

                    break;
                case 401:
                    error = errorsHandler.errors.invalidCredentials;
                    break;
                case 404:
                    error = errorsHandler.errors.notFoundEndpoint;
                    break;
                default:
                    error = errorsHandler.errors.unhandledMessage + request.statusText;
                    break;
            }

            return error;
        }
    }
);