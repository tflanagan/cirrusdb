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
const qs = require('querystring');
const http = require('http');
const https = require('https');
const debug = require('debug');
const merge = require('lodash.merge');
const Promise = require('bluebird');
const Throttle = require('generic-throttle');

/* Debug */
const debugCore = debug('cirrusdb:core');
const debugRequest = debug('cirrusdb:request');
const debugResponse = debug('cirrusdb:response');

/* CirrusDB */
class CirrusDB {

	constructor(options) {
		this.settings = merge({}, CirrusDB.defaults, options || {});

		this._throttle = new Throttle(this.settings.connectionLimit, -1, this.settings.errorOnConnectionLimit);

		this._reqNum = 0;

		debugCore('Class initiated', this.settings);

		return this;
	}

	request(localPath, options, body) {
		if(typeof(localPath) !== 'string'){
			if(localPath instanceof Array){
				localPath = localPath.join('/');
			}else{
				body = options;
				options = localPath;

				localPath = '';
			}
		}

		return this._throttle.acquire((resolve, reject) => {
			const reqNum = this._reqNum;
			const path = [
				this.settings.path,
				this.settings.version,
				localPath
			].join('/');

			this._reqNum += 1;

			if(!options){
				options = {};
			}

			if(!options.headers){
				options.headers = {};
			}

			if(options.requiresAuthorization){
				if(!this.settings.userToken){
					return reject(new Error('Missing user token'));
				}

				options.headers.Authorization = 'Bearer ' + this.settings.userToken;
			}

			if(body){
				options.headers['Content-Type'] = 'application/json';
			}

			const request = merge({
				hostname: this.settings.hostname,
				port: this.settings.port,
				path: path,
				method: 'GET',
				agent: false
			}, options || {});

			debugRequest(reqNum, request.method, path, body);

			return handleRequest(request, body).then((response) => {
				if(!response.success){
					const err = new Error(response.message);

					err.code = response.statusCode;

					throw err;
				}

				if(response.hasOwnProperty('results')){
					return response.results;
				}

				return true;
			}).then((results) => {
				debugResponse(reqNum, results);

				return results;
			}).then(resolve).catch(reject);
		});
	}

	/* Request Wrappers */
	authenticate(body) {
		if(!body){
			body = {};
		}

		if(!body.email && this.settings.email){
			body.email = this.settings.email;
		}else
		if(body.email && !this.settings.email){
			this.settings.email = body.email;
		}

		if(!body.password && this.settings.password){
			body.password = this.settings.password;
		}else
		if(body.password && !this.settings.password){
			this.settings.password = body.password;
		}

		return this.request('auth', {
			method: 'POST'
		}, body).then((results) => {
			this.settings.userToken = results;

			return results;
		});
	}

	verifyToken(body) {
		return this.request('auth/verify-token', {
			method: 'POST'
		}, body);
	}

	getId() {
		return this.request('id', {
			requiresAuthorization: true
		});
	}

	getManifest() {
		return this.request('manifest');
	}

	getUsage() {
		return this.request('usage', {
			requiresAuthorization: true
		});
	}

	getApplications() {
		return this.request({
			requiresAuthorization: true
		});
	}

	postApplication(body) {
		return this.request({
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getApplication(appid) {
		return this.request(appid, {
			requiresAuthorization: true
		});
	}

	getApplicationSettings(appid) {
		return this.request([
			appid,
			'settings'
		], {
			requiresAuthorization: true
		});
	}

	putApplication(appid, body) {
		return this.request(appid, {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteApplication(appid) {
		return this.request(appid, {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getFile(appid, tableid, recordid, fieldid) {
		return this.request([
			appid,
			'files',
			tableid,
			recordid,
			fieldid
		], {
			requiresAuthorization: true
		});
	}

	getPages(appid) {
		return this.request([
			appid,
			'pages'
		], {
			requiresAuthorization: true
		});
	}

	postPage(appid, body) {
		return this.request([
			appid,
			'pages'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getPage(appid, pageid) {
		return this.request([
			appid,
			'pages',
			pageid
		], {
			requiresAuthorization: true
		});
	}

	putPage(appid, pageid, body) {
		return this.request([
			appid,
			'pages',
			pageid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deletePage(appid, pageid) {
		return this.request([
			appid,
			'pages',
			pageid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getRoles(appid) {
		return this.request([
			appid,
			'roles'
		], {
			requiresAuthorization: true
		});
	}

	postRole(appid, body) {
		return this.request([
			appid,
			'roles'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getRole(appid, roleid) {
		return this.request([
			appid,
			'roles',
			roleid
		], {
			requiresAuthorization: true
		});
	}

	putRole(appid, roleid, body) {
		return this.request([
			appid,
			'roles',
			roleid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteRole(appid, roleid) {
		return this.request([
			appid,
			'roles',
			roleid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getTables(appid) {
		return this.request([
			appid,
			'tables'
		], {
			requiresAuthorization: true
		});
	}

	postTable(appid, body) {
		return this.request([
			appid,
			'tables'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getTable(appid, tableid) {
		return this.request([
			appid,
			'tables',
			tableid
		], {
			requiresAuthorization: true
		});
	}

	getTableSettings(appid, tableid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'settings'
		], {
			requiresAuthorization: true
		});
	}

	putTable(appid, tableid, body) {
		return this.request([
			appid,
			'tables',
			tableid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteTable(appid, tableid) {
		return this.request([
			appid,
			'tables',
			tableid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getTableFields(appid, tableid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'fields'
		], {
			requiresAuthorization: true
		});
	}

	postTableField(appid, tableid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'fields'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getTableField(appid, tableid, fieldid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'fields',
			fieldid
		], {
			requiresAuthorization: true
		});
	}

	putTableField(appid, tableid, fieldid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'fields',
			fieldid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteTableField(appid, tableid, fieldid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'fields',
			fieldid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getTableForms(appid, tableid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'forms'
		], {
			requiresAuthorization: true
		});
	}

	postTableForm(appid, tableid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'forms'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getTableForm(appid, tableid, formid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'forms',
			formid
		], {
			requiresAuthorization: true
		});
	}

	putTableForm(appid, tableid, formid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'forms',
			formid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteTableForm(appid, tableid, formid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'forms',
			formid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getTableNotifications(appid, tableid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'notifications'
		], {
			requiresAuthorization: true
		});
	}

	postTableNotification(appid, tableid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'notifications'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getTableNotification(appid, tableid, notificationid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'notifications',
			notificationid
		], {
			requiresAuthorization: true
		});
	}

	putTableNotification(appid, tableid, notificationid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'notifications',
			notificationid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteTableNotification(appid, tableid, notificationid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'notifications',
			notificationid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getTableRecords(appid, tableid, options) {
		let url = [
			appid,
			'tables',
			tableid,
			'records'
		].join('/');

		if(options){
			url += ('?' + qs.stringify(options));
		}

		return this.request(url, {
			requiresAuthorization: true
		});
	}

	postTableRecord(appid, tableid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'records'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getTableRecord(appid, tableid, recordid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'records',
			recordid
		], {
			requiresAuthorization: true
		});
	}

	putTableRecord(appid, tableid, recordid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'records',
			recordid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteTableRecord(appid, tableid, recordid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'records',
			recordid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getTableReports(appid, tableid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'reports'
		], {
			requiresAuthorization: true
		});
	}

	postTableReport(appid, tableid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'reports'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getTableReport(appid, tableid, reportid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'reports',
			reportid
		], {
			requiresAuthorization: true
		});
	}

	putTableReport(appid, tableid, reportid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'reports',
			reportid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteTableReport(appid, tableid, reportid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'reports',
			reportid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getTableWebhooks(appid, tableid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'webhooks'
		], {
			requiresAuthorization: true
		});
	}

	postTableWebhook(appid, tableid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'webhooks'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getTableWebhook(appid, tableid, webhookid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'webhooks',
			webhookid
		], {
			requiresAuthorization: true
		});
	}

	putTableWebhook(appid, tableid, webhookid, body) {
		return this.request([
			appid,
			'tables',
			tableid,
			'webhooks',
			webhookid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteTableWebhook(appid, tableid, webhookid) {
		return this.request([
			appid,
			'tables',
			tableid,
			'webhooks',
			webhookid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getApplicationUsers(appid) {
		return this.request([
			appid,
			'users'
		], {
			requiresAuthorization: true
		});
	}

	postApplicationUser(appid, body) {
		return this.request([
			appid,
			'users'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getApplicationUser(appid, userid) {
		return this.request([
			appid,
			'users',
			userid
		], {
			requiresAuthorization: true
		});
	}

	putApplicationUser(appid, userid, body) {
		return this.request([
			appid,
			'users',
			userid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteApplicationUser(appid, userid) {
		return this.request([
			appid,
			'users',
			userid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getVariables(appid) {
		return this.request([
			appid,
			'variables'
		], {
			requiresAuthorization: true
		});
	}

	postVariable(appid, body) {
		return this.request([
			appid,
			'variables'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getVariable(appid, variableid) {
		return this.request([
			appid,
			'variables',
			variableid
		], {
			requiresAuthorization: true
		});
	}

	putVariable(appid, variableid, body) {
		return this.request([
			appid,
			'variables',
			variableid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteVariable(appid, variableid) {
		return this.request([
			appid,
			'variables',
			variableid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getUsers() {
		return this.request('users', {
			requiresAuthorization: true
		});
	}

	postUser(body) {
		return this.request('users', {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getUser(userid) {
		return this.request([
			'users',
			userid
		], {
			requiresAuthorization: true
		});
	}

	putUser(userid, body) {
		return this.request([
			'users',
			userid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteUser(userid) {
		return this.request([
			'users',
			userid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

	getUserTokens(userid) {
		return this.request([
			'users',
			userid,
			'tokens'
		], {
			requiresAuthorization: true
		});
	}

	postUserToken(userid, body) {
		return this.request([
			'users',
			userid,
			'tokens'
		], {
			requiresAuthorization: true,
			method: 'POST'
		}, body);
	}

	getUserToken(userid, tokenid) {
		return this.request([
			'users',
			userid,
			'tokens',
			tokenid
		], {
			requiresAuthorization: true
		});
	}

	putUserToken(userid, tokenid, body) {
		return this.request([
			'users',
			userid,
			'tokens',
			tokenid
		], {
			requiresAuthorization: true,
			method: 'PUT'
		}, body);
	}

	deleteUserToken(userid, tokenid) {
		return this.request([
			'users',
			userid,
			'tokens',
			tokenid
		], {
			requiresAuthorization: true,
			method: 'DELETE'
		});
	}

}

/* Helpers */
const handleRequest = function(options, body){
	return new Promise((resolve, reject) => {
		const req = (options.port === 443 ? https : http).request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				data = JSON.parse(data);

				data.statusCode = res.statusCode;

				resolve(data);
			});
		});

		if(body){
			if(typeof(body) === 'object'){
				try {
					body = JSON.stringify(body);
				}catch(err){
					return reject(err);
				}
			}

			req.write(body);
		}

		req.on('error', (err) => {
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
if(typeof(module) !== 'undefined' && module.exports){
	module.exports = CirrusDB;
}else
if(typeof(define) === 'function' && define.amd){
	define('CirrusDB', [], function(){
		return CirrusDB;
	});
}

if(typeof(global) !== 'undefined' && typeof(window) !== 'undefined' && global === window){
	global.CirrusDB = CirrusDB;

	CirrusDB.defaults.hostname = window.location.hostname;
	CirrusDB.defaults.port = window.location.port;

	if(!CirrusDB.defaults.port){
		CirrusDB.defaults.port = window.location.protocol === 'https:' ? 443 : 80;
	}
}
