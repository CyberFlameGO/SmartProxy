/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2017 Salar Khalilzadeh <salar2k@gmail.com>
 *
 * SmartProxy is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * SmartProxy is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with SmartProxy.  If not, see <http://www.gnu.org/licenses/>.
 */
var chromeProxy = {
	convertActiveProxyServer: function (activeProxyServer) {
		const resultDirect = "DIRECT";

		// invalid active proxy server
		if (!activeProxyServer || !activeProxyServer.host || !activeProxyServer.protocol || !activeProxyServer.port)
			return resultDirect;

		switch (activeProxyServer.protocol) {
			case "HTTP":
				return `PROXY ${activeProxyServer.host}:${activeProxyServer.port}`;

			case "HTTPS":
				return `HTTPS ${activeProxyServer.host}:${activeProxyServer.port}`;

			case "SOCKS4":
				return `SOCKS4 ${activeProxyServer.host}:${activeProxyServer.port}`;

			case "SOCKS5":
				return `SOCKS5 ${activeProxyServer.host}:${activeProxyServer.port}`;
		}

		// invalid proxy protocol
		return resultDirect;
	},
	matchPatternToRegExp: function (pattern) {
		// Source: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Match_patterns
		// Modified by Salar Khalilzadeh
		/**
		 * Transforms a valid match pattern into a regular expression
		 * which matches all URLs included by that pattern.
		 *
		 * @param  {string}  pattern  The pattern to transform.
		 * @return {RegExp}           The pattern's equivalent as a RegExp.
		 * @throws {TypeError}        If the pattern is not a valid MatchPattern
		 */

		// matches all valid match patterns (except '<all_urls>')
		// and extracts [ , scheme, host, path, ]
		const matchPattern = (/^(?:(\*|http|https|file|ftp|app):\/\/([^\/]+|)\/?(.*))$/i);

		if (pattern === '<all_urls>') {
			//return (/^(?:https?|file|ftp|app):\/\//);
			return null;
		}
		const match = matchPattern.exec(pattern);
		if (!match) {
			//throw new TypeError(`"${pattern}" is not a valid MatchPattern`);
			return null;
		}
		const [, scheme, host, path,] = match;

		return new RegExp('^(?:'
			+ (scheme === '*' ? 'https?' : escape(scheme)) + ':\\/\\/'
			+ (host === '*' ? "[^\\/]*" : escape(host).replace(/^\*\./g, '(?:[^\\/]+)?'))
			+ (path ? (path == '*' ? '(?:\\/.*)?' : ('\\/' + escape(path).replace(/\*/g, '.*'))) : '\\/?')
			+ ')$');
	},
	convertHosts: function (proxyRulesList) {
		if (!proxyRulesList || !proxyRulesList.length)
			return [];
		var result = [];

		for (let i = 0; i < proxyRulesList.length; i++) {
			let rule = proxyRulesList[i];

			if (!rule.enabled) continue;

			let regex = chromeProxy.matchPatternToRegExp(rule.pattern);
			if (regex != null)
				result.push(regex);
		}

		return result;
	},
	regexHostArrayToString: function (regexHostArray) {
		var proxyHostsAsStringArray = [];
		for (var index = 0; index < regexHostArray.length; index++) {
			var hostRegex = regexHostArray[index];

			proxyHostsAsStringArray.push(hostRegex.toString());
		}
		return proxyHostsAsStringArray;
	},
	generateChromePacScript: function (proxyInitData) {
		var proxyRules = proxyInitData.proxyRules;
		var proxyMode = proxyInitData.proxyMode;
		var resultActiveProxy = chromeProxy.convertActiveProxyServer(proxyInitData.activeProxyServer);

		var proxyHosts = chromeProxy.convertHosts(proxyRules);
		var proxyHostsAsString = chromeProxy.regexHostArrayToString(proxyHosts).join(",");

		var pacTemplateString = `var proxyMode = "${proxyMode}";
var proxyHosts = [${proxyHostsAsString}];
var hasActiveProxyServer = ${((proxyInitData.activeProxyServer) ? "true" : "false")};
const proxyModeType = {
	direct: "1",
	smartProxy: "2",
	always: "3",
	systemProxy: "4"
};
var resultActiveProxy = "${resultActiveProxy}";
const resultDirect = "DIRECT";
const resultSystem = "SYSTEM";
// -------------------------
// required PAC function that will be called to determine
// if a proxy should be used.
function FindProxyForURL(url, host) {

	// BUGFIX: we need implict convertion (==) instead of (===), since proxy mode comes from different places and i'm lazy to track it
	if (proxyMode == proxyModeType.direct)
		return resultDirect;

	// in chrome system mode is not controlled here
	if (proxyMode == proxyModeType.systemProxy)
		return resultSystem;

	// there should be active proxy
	if (!hasActiveProxyServer)
		// let the browser decide
		return null;

	if (proxyMode == proxyModeType.always)
		return resultActiveProxy;

	try {

		for (let i = 0; i < proxyHosts.length; i++) {
			let hostRegex = proxyHosts[i];

			if (hostRegex.test(url)) {
				return resultActiveProxy;
			}
		}
	} catch (e) {
		//polyfill.runtimeSendMessage('Error in FindProxyForURL for ' + url);
	}

	// let the browser decide
	return null;
}`;
		return pacTemplateString;
	},

}