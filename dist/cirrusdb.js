/* Copyright 2014 Tristian Flanagan
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

'use strict';

/* Dependencies */

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var http = require('http');
var https = require('https');
var debug = require('debug');
var merge = require('lodash.merge');
var Promise = require('bluebird');
var Throttle = require('generic-throttle');

/* Debug */
var debugCore = debug('cirrusdb:core');
var debugRequest = debug('cirrusdb:request');
var debugResponse = debug('cirrusdb:response');

/* CirrusDB */

var CirrusDB = function () {
	function CirrusDB(options) {
		_classCallCheck(this, CirrusDB);

		this.settings = merge({}, CirrusDB.defaults, options || {});

		this._throttle = new Throttle(this.settings.connectionLimit, -1, this.settings.errorOnConnectionLimit);

		this._reqNum = 0;

		debugCore('Class initiated', this.settings);

		return this;
	}

	_createClass(CirrusDB, [{
		key: 'request',
		value: function request(localPath, options, body) {
			var _this = this;

			if (typeof localPath !== 'string') {
				if (localPath instanceof Array) {
					localPath = localPath.join('/');
				} else {
					body = options;
					options = localPath;

					localPath = '';
				}
			}

			return this._throttle.acquire(function (resolve, reject) {
				var reqNum = _this._reqNum;
				var path = [_this.settings.path, _this.settings.version, localPath].join('/');

				_this._reqNum += 1;

				if (!options) {
					options = {};
				}

				if (!options.headers) {
					options.headers = {};
				}

				if (options.requiresAuthorization) {
					if (!_this.settings.userToken) {
						return reject(new Error('Missing user token'));
					}

					options.headers.Authorization = 'Bearer ' + _this.settings.userToken;
				}

				if (body) {
					options.headers['Content-Type'] = 'application/json';
				}

				var request = merge({
					hostname: _this.settings.hostname,
					port: _this.settings.port,
					path: path,
					method: 'GET',
					agent: false
				}, options || {});

				debugRequest(reqNum, request.method, path, body);

				return handleRequest(request, body).then(function (response) {
					response = JSON.parse(response);

					if (!response.success) {
						throw new Error(response.message);
					}

					if (response.hasOwnProperty('results')) {
						return response.results;
					}

					return true;
				}).then(function (results) {
					debugResponse(reqNum, results);

					return results;
				}).then(resolve).catch(reject);
			});
		}

		/* Request Wrappers */

	}, {
		key: 'authenticate',
		value: function authenticate(body) {
			var _this2 = this;

			if (!body) {
				body = {};
			}

			if (!body.email && this.settings.email) {
				body.email = this.settings.email;
			} else if (body.email && !this.settings.email) {
				this.settings.email = body.email;
			}

			if (!body.password && this.settings.password) {
				body.password = this.settings.password;
			} else if (body.password && !this.settings.password) {
				this.settings.password = body.password;
			}

			return this.request('auth', {
				method: 'POST'
			}, body).then(function (results) {
				_this2.settings.userToken = results;

				return results;
			});
		}
	}, {
		key: 'verifyToken',
		value: function verifyToken(body) {
			return this.request('auth/verify-token', {
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getId',
		value: function getId() {
			return this.request('id', {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'getManifest',
		value: function getManifest() {
			return this.request('manifest');
		}
	}, {
		key: 'getUsage',
		value: function getUsage() {
			return this.request('usage', {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'getApplications',
		value: function getApplications() {
			return this.request({
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postApplication',
		value: function postApplication(body) {
			return this.request({
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getApplication',
		value: function getApplication(appid) {
			return this.request(appid, {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'getApplicationSettings',
		value: function getApplicationSettings(appid) {
			return this.request([appid, 'settings'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putApplication',
		value: function putApplication(appid, body) {
			return this.request(appid, {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteApplication',
		value: function deleteApplication(appid) {
			return this.request(appid, {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getFile',
		value: function getFile(appid, tableid, recordid, fieldid) {
			return this.request([appid, 'files', tableid, recordid, fieldid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'getPages',
		value: function getPages(appid) {
			return this.request([appid, 'pages'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postPage',
		value: function postPage(appid, body) {
			return this.request([appid, 'pages'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getPage',
		value: function getPage(appid, pageid) {
			return this.request([appid, 'pages', pageid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putPage',
		value: function putPage(appid, pageid, body) {
			return this.request([appid, 'pages', pageid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deletePage',
		value: function deletePage(appid, pageid) {
			return this.request([appid, 'pages', pageid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getRoles',
		value: function getRoles(appid) {
			return this.request([appid, 'roles'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postRole',
		value: function postRole(appid, body) {
			return this.request([appid, 'roles'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getRole',
		value: function getRole(appid, roleid) {
			return this.request([appid, 'roles', roleid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putRole',
		value: function putRole(appid, roleid, body) {
			return this.request([appid, 'roles', roleid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteRole',
		value: function deleteRole(appid, roleid) {
			return this.request([appid, 'roles', roleid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getTables',
		value: function getTables(appid) {
			return this.request([appid, 'tables'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postTable',
		value: function postTable(appid, body) {
			return this.request([appid, 'tables'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getTable',
		value: function getTable(appid, tableid) {
			return this.request([appid, 'tables', tableid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'getTableSettings',
		value: function getTableSettings(appid, tableid) {
			return this.request([appid, 'tables', tableid, 'settings'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putTable',
		value: function putTable(appid, tableid, body) {
			return this.request([appid, 'tables', tableid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteTable',
		value: function deleteTable(appid, tableid) {
			return this.request([appid, 'tables', tableid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getTableFields',
		value: function getTableFields(appid, tableid) {
			return this.request([appid, 'tables', tableid, 'fields'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postTableField',
		value: function postTableField(appid, tableid, body) {
			return this.request([appid, 'tables', tableid, 'fields'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getTableField',
		value: function getTableField(appid, tableid, fieldid) {
			return this.request([appid, 'tables', tableid, 'fields', fieldid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putTableField',
		value: function putTableField(appid, tableid, fieldid, body) {
			return this.request([appid, 'tables', tableid, 'fields', fieldid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteTableField',
		value: function deleteTableField(appid, tableid, fieldid) {
			return this.request([appid, 'tables', tableid, 'fields', fieldid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getTableForms',
		value: function getTableForms(appid, tableid) {
			return this.request([appid, 'tables', tableid, 'forms'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postTableForm',
		value: function postTableForm(appid, tableid, body) {
			return this.request([appid, 'tables', tableid, 'forms'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getTableForm',
		value: function getTableForm(appid, tableid, formid) {
			return this.request([appid, 'tables', tableid, 'forms', formid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putTableForm',
		value: function putTableForm(appid, tableid, formid, body) {
			return this.request([appid, 'tables', tableid, 'forms', formid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteTableForm',
		value: function deleteTableForm(appid, tableid, formid) {
			return this.request([appid, 'tables', tableid, 'forms', formid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getTableNotifications',
		value: function getTableNotifications(appid, tableid) {
			return this.request([appid, 'tables', tableid, 'notifications'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postTableNotification',
		value: function postTableNotification(appid, tableid, body) {
			return this.request([appid, 'tables', tableid, 'notifications'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getTableNotification',
		value: function getTableNotification(appid, tableid, notificationid) {
			return this.request([appid, 'tables', tableid, 'notifications', notificationid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putTableNotification',
		value: function putTableNotification(appid, tableid, notificationid, body) {
			return this.request([appid, 'tables', tableid, 'notifications', notificationid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteTableNotification',
		value: function deleteTableNotification(appid, tableid, notificationid) {
			return this.request([appid, 'tables', tableid, 'notifications', notificationid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getTableRecords',
		value: function getTableRecords(appid, tableid) {
			return this.request([appid, 'tables', tableid, 'records'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postTableRecord',
		value: function postTableRecord(appid, tableid, body) {
			return this.request([appid, 'tables', tableid, 'records'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getTableRecord',
		value: function getTableRecord(appid, tableid, recordid) {
			return this.request([appid, 'tables', tableid, 'records', recordid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putTableRecord',
		value: function putTableRecord(appid, tableid, recordid, body) {
			return this.request([appid, 'tables', tableid, 'records', recordid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteTableRecord',
		value: function deleteTableRecord(appid, tableid, recordid) {
			return this.request([appid, 'tables', tableid, 'records', recordid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getTableReports',
		value: function getTableReports(appid, tableid) {
			return this.request([appid, 'tables', tableid, 'reports'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postTableReport',
		value: function postTableReport(appid, tableid, body) {
			return this.request([appid, 'tables', tableid, 'reports'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getTableReport',
		value: function getTableReport(appid, tableid, reportid) {
			return this.request([appid, 'tables', tableid, 'reports', reportid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putTableReport',
		value: function putTableReport(appid, tableid, reportid, body) {
			return this.request([appid, 'tables', tableid, 'reports', reportid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteTableReport',
		value: function deleteTableReport(appid, tableid, reportid) {
			return this.request([appid, 'tables', tableid, 'reports', reportid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getTableWebhooks',
		value: function getTableWebhooks(appid, tableid) {
			return this.request([appid, 'tables', tableid, 'webhooks'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postTableWebhook',
		value: function postTableWebhook(appid, tableid, body) {
			return this.request([appid, 'tables', tableid, 'webhooks'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getTableWebhook',
		value: function getTableWebhook(appid, tableid, webhookid) {
			return this.request([appid, 'tables', tableid, 'webhooks', webhookid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putTableWebhook',
		value: function putTableWebhook(appid, tableid, webhookid, body) {
			return this.request([appid, 'tables', tableid, 'webhooks', webhookid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteTableWebhook',
		value: function deleteTableWebhook(appid, tableid, webhookid) {
			return this.request([appid, 'tables', tableid, 'webhooks', webhookid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getApplicationUsers',
		value: function getApplicationUsers(appid) {
			return this.request([appid, 'users'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postApplicationUser',
		value: function postApplicationUser(appid, body) {
			return this.request([appid, 'users'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getApplicationUser',
		value: function getApplicationUser(appid, userid) {
			return this.request([appid, 'users', userid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putApplicationUser',
		value: function putApplicationUser(appid, userid, body) {
			return this.request([appid, 'users', userid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteApplicationUser',
		value: function deleteApplicationUser(appid, userid) {
			return this.request([appid, 'users', userid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getVariables',
		value: function getVariables(appid) {
			return this.request([appid, 'variables'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postVariable',
		value: function postVariable(appid, body) {
			return this.request([appid, 'variables'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getVariable',
		value: function getVariable(appid, variableid) {
			return this.request([appid, 'variables', variableid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putVariable',
		value: function putVariable(appid, variableid, body) {
			return this.request([appid, 'variables', variableid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteVariable',
		value: function deleteVariable(appid, variableid) {
			return this.request([appid, 'variables', variableid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getUsers',
		value: function getUsers() {
			return this.request('users', {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postUser',
		value: function postUser(body) {
			return this.request('users', {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getUser',
		value: function getUser(userid) {
			return this.request(['users', userid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putUser',
		value: function putUser(userid, body) {
			return this.request(['users', userid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteUser',
		value: function deleteUser(userid) {
			return this.request(['users', userid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}, {
		key: 'getUserTokens',
		value: function getUserTokens(userid) {
			return this.request(['users', userid, 'tokens'], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'postUserToken',
		value: function postUserToken(userid, body) {
			return this.request(['users', userid, 'tokens'], {
				requiresAuthorization: true,
				method: 'POST'
			}, body);
		}
	}, {
		key: 'getUserToken',
		value: function getUserToken(userid, tokenid) {
			return this.request(['users', userid, 'tokens', tokenid], {
				requiresAuthorization: true
			});
		}
	}, {
		key: 'putUserToken',
		value: function putUserToken(userid, tokenid, body) {
			return this.request(['users', userid, 'tokens', tokenid], {
				requiresAuthorization: true,
				method: 'PUT'
			}, body);
		}
	}, {
		key: 'deleteUserToken',
		value: function deleteUserToken(userid, tokenid) {
			return this.request(['users', userid, 'tokens', tokenid], {
				requiresAuthorization: true,
				method: 'DELETE'
			});
		}
	}]);

	return CirrusDB;
}();

/* Helpers */


var handleRequest = function handleRequest(options, body) {
	return new Promise(function (resolve, reject) {
		var req = (options.port === 443 ? https : http).request(options, function (res) {
			var data = '';

			res.on('data', function (chunk) {
				data += chunk;
			});

			res.on('end', function () {
				resolve(data);
			});
		});

		if (body) {
			if ((typeof body === 'undefined' ? 'undefined' : _typeof(body)) === 'object') {
				try {
					body = JSON.stringify(body);
				} catch (err) {
					return reject(err);
				}
			}

			req.write(body);
		}

		req.on('error', function (err) {
			reject(err);
		});

		req.end();
	});
};

/* Expose Properties */
CirrusDB.defaults = {
	hostname: 'www.cirrusdb.com',
	port: 443,
	path: '/api',
	version: 'v1',

	email: '',
	password: '',
	userToken: '',

	connectionLimit: 10,
	errorOnConnectionLimit: false
};

/* Export Module */
if (typeof module !== 'undefined' && module.exports) {
	module.exports = CirrusDB;
} else if (typeof define === 'function' && define.amd) {
	define('CirrusDB', [], function () {
		return CirrusDB;
	});
}

if (typeof global !== 'undefined' && typeof window !== 'undefined' && global === window) {
	global.CirrusDB = CirrusDB;

	CirrusDB.defaults.hostname = window.location.hostname;
	CirrusDB.defaults.port = window.location.port;

	if (!CirrusDB.defaults.port) {
		CirrusDB.defaults.port = window.location.protocol === 'https:' ? 443 : 80;
	}
}
